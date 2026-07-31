import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  createSpectrum,
  filmOnThickSubstrate,
  fitTabulated,
  loadNkTable,
  prepareFitData,
  restrictToNkRange,
  robustBackground,
} from "../scientific-core.js";

test("matches Python background, calibration order and TMM references", () => {
  const backgroundWavelength = Array.from({ length: 99 }, (_, index) => 195 + index * 55 / 98);
  const backgroundCounts = backgroundWavelength.map((_, index) => 7 + [-2, 0, 2][index % 3]);
  const background = robustBackground(backgroundWavelength, backgroundCounts);
  assert.ok(Math.abs(background.level - 7) < 1e-12);
  assert.ok(Math.abs(background.sigma - 2.9652) < 1e-12);

  const rawWavelength = Array.from({ length: 12 }, (_, index) => 500 + index);
  const wavelengthNm = [...backgroundWavelength, ...rawWavelength];
  const dark = backgroundWavelength.map((_, index) => [-1, 0, 1][index % 3]);
  const tiled = (values) => Array.from({ length: 12 }, (_, index) => values[index % values.length]);
  const data = prepareFitData({
    wavelengthNm,
    sampleReflectanceCounts: [...dark, ...tiled([1, 10, 100])],
    sampleTransmittanceCounts: [...dark, ...tiled([1, 20, 100])],
    siliconCounts: [...dark, ...tiled([1, 2, 100])],
    openBeamCounts: [...dark, ...tiled([1, 4, 100])],
    siliconReflectance: wavelengthNm.map(() => 0.4),
  }, {
    wavelengthMinNm: 500,
    wavelengthMaxNm: 520,
    referenceThresholdFraction: 0,
    binWidthNm: 20,
  });
  assert.deepEqual(data.reflectance, [2]);
  assert.deepEqual(data.transmittance, [5]);

  const modeled = filmOnThickSubstrate([400, 700, 1064], [3, 3, 3], [0.5, 0.5, 0.5], 200, 1.46, "film");
  assertArrayClose(modeled.reflectance, [0.2496772231746735, 0.2756752079963227, 0.2132691141391003]);
  assertArrayClose(modeled.transmittance, [0.02806699405589832, 0.1069467010826171, 0.205415569893699]);
});

test("recovers a synthetic tabulated-film thickness reproducibly", () => {
  const wavelengthNm = Array.from({ length: 81 }, (_, index) => 300 + index * 10);
  const nk = { wavelengthNm, n: wavelengthNm.map(() => 2.5), k: wavelengthNm.map(() => 0.2) };
  const target = filmOnThickSubstrate(wavelengthNm, nk.n, nk.k, 237, 1.46, "film");
  const data = {
    wavelengthNm,
    reflectance: target.reflectance,
    transmittance: target.transmittance,
    reflectanceValid: wavelengthNm.map(() => true),
    transmittanceValid: wavelengthNm.map(() => true),
  };
  const configuration = {
    settings: { model: "fixed", substrateIndex: 1.46, incidence: "film", useReflectance: true, useTransmittance: true, sigmaReflectance: 0.02, sigmaTransmittance: 0.02 },
    initial: { thicknessNm: 180, nScale: 1, kScale: 1, rGain: 1, tGain: 1 },
    bounds: { thicknessNm: [100, 400], nScale: [0.85, 1.15], kScale: [0.5, 2], rGain: [0.1, 10], tGain: [0.1, 10] },
  };
  const first = fitTabulated(data, nk, configuration);
  const second = fitTabulated(data, nk, configuration);
  assert.ok(Math.abs(first.parameters.thicknessNm - 237) < 1e-3);
  assert.deepEqual(first.parameters, second.parameters);
});

test("recovers synthetic thickness and n,k scales", () => {
  const wavelengthNm = Array.from({ length: 81 }, (_, index) => 300 + index * 10);
  const nk = {
    wavelengthNm,
    n: wavelengthNm.map((wavelength) => 2.2 + 0.0005 * (wavelength - 300)),
    k: wavelengthNm.map((wavelength) => 0.15 + 0.0001 * (wavelength - 300)),
  };
  const target = filmOnThickSubstrate(
    wavelengthNm,
    nk.n.map((value) => value * 1.05),
    nk.k.map((value) => value * 1.2),
    237,
    1.46,
    "film",
  );
  const valid = wavelengthNm.map(() => true);
  const result = fitTabulated({ wavelengthNm, reflectance: target.reflectance, transmittance: target.transmittance, reflectanceValid: valid, transmittanceValid: valid }, nk, {
    settings: { model: "scaled", substrateIndex: 1.46, incidence: "film", useReflectance: true, useTransmittance: true, sigmaReflectance: 0.02, sigmaTransmittance: 0.02 },
    initial: { thicknessNm: 200, nScale: 1, kScale: 1, rGain: 1, tGain: 1 },
    bounds: { thicknessNm: [100, 400], nScale: [0.85, 1.15], kScale: [0.5, 2], rGain: [0.1, 10], tGain: [0.1, 10] },
  });
  assert.ok(Math.abs(result.parameters.thicknessNm - 237) < 1e-3);
  assert.ok(Math.abs(result.parameters.nScale - 1.05) < 1e-5);
  assert.ok(Math.abs(result.parameters.kScale - 1.2) < 1e-5);
});

test("reproduces the Python aGST fixed-table fit", () => {
  const read = (name) => readFileSync(new URL(`../examples/${name}`, import.meta.url), "utf8");
  const spectrum = createSpectrum({
    sampleName: "aGST",
    sampleR: read("agst-ref.txt"),
    sampleT: read("agst-tr.txt"),
    silicon: read("si-ref.txt"),
    openBeam: read("referencitrx.txt"),
    siliconModel: read("si_reflectance.txt"),
  });
  const nk = loadNkTable(read("aGST.txt"));
  const data = restrictToNkRange(prepareFitData(spectrum, {
    wavelengthMinNm: 300,
    wavelengthMaxNm: 1100,
    referenceThresholdFraction: 0.05,
    binWidthNm: 2,
    sampleSnrMinimum: 5,
    subtractBackground: true,
  }), nk);
  const result = fitTabulated(data, nk, {
    settings: { model: "fixed", substrateIndex: 1.46, incidence: "film", useReflectance: true, useTransmittance: true, sigmaReflectance: 0.02, sigmaTransmittance: 0.02 },
    initial: { thicknessNm: 250, nScale: 1, kScale: 1, rGain: 1, tGain: 1 },
    bounds: { thicknessNm: [125, 375], nScale: [0.85, 1.15], kScale: [0.5, 2], rGain: [0.1, 10], tGain: [0.1, 10] },
  });
  assert.equal(result.diagnostics.reflectanceBins, 289);
  assert.equal(result.diagnostics.transmittanceBins, 79);
  assert.ok(Math.abs(result.parameters.thicknessNm - 234.21575503) < 2e-3);
  assert.ok(Math.abs(result.parameters.rGain - 1.39816712) < 2e-6);
  assert.ok(Math.abs(result.parameters.tGain - 0.69779503) < 2e-6);
});

function assertArrayClose(actual, expected, tolerance = 1e-12) {
  assert.equal(actual.length, expected.length);
  actual.forEach((value, index) => assert.ok(Math.abs(value - expected[index]) < tolerance, `${value} != ${expected[index]}`));
}
