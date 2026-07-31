import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  affineShapeResidual,
  calibrateSharedGains,
  createSpectrum,
  evaluateOpticalModel,
  filmOnThickSubstrate,
  filmStackOnThickSubstrate,
  fitResidualVector,
  fitTabulated,
  loadNkTable,
  prepareFitData,
  restrictToNkRange,
  robustBackground,
} from "../scientific-core.js";

test("multilayer TMM reproduces the single-film solver and conserves lossless power", () => {
  const wavelengthNm = [400, 550, 800, 1050];
  const n = [2, 2.2, 2.4, 2.6];
  const k = [0.1, 0.2, 0.3, 0.4];
  for (const incidence of ["film", "substrate"]) {
    const single = filmOnThickSubstrate(wavelengthNm, n, k, 210, 1.46, incidence);
    const stack = filmStackOnThickSubstrate(wavelengthNm, [{ n, k, thicknessNm: 210 }], 1.46, incidence);
    assertArrayClose(stack.reflectance, single.reflectance, 5e-15);
    assertArrayClose(stack.transmittance, single.transmittance, 5e-15);
  }

  const lossless = filmStackOnThickSubstrate(wavelengthNm, [
    { n: wavelengthNm.map(() => 1.45), k: wavelengthNm.map(() => 0), thicknessNm: 90 },
    { n: wavelengthNm.map(() => 2.1), k: wavelengthNm.map(() => 0), thicknessNm: 130 },
  ], 1.52, "film");
  lossless.reflectance.forEach((reflectance, index) => assert.ok(Math.abs(reflectance + lossless.transmittance[index] - 1) < 2e-14));

  const opaque = filmStackOnThickSubstrate([500], [{ n: [2], k: [5], thicknessNm: 100000 }], 1.52, "film");
  assert.ok(Number.isFinite(opaque.reflectance[0]) && Number.isFinite(opaque.transmittance[0]));
});

test("evaluates independently parameterized layers", () => {
  const wavelengthNm = [450, 550, 650];
  const data = { wavelengthNm };
  const settings = {
    substrateIndex: 1.5,
    incidence: "film",
    activeLayerId: "top",
    layers: [
      { id: "top", name: "Top", model: "constant" },
      { id: "bottom", name: "Bottom", model: "constant" },
    ],
  };
  const parameters = {
    top__thicknessNm: 80, top__n: 1.8, top__k: 0,
    bottom__thicknessNm: 120, bottom__n: 2.4, bottom__k: 0.1,
    rGain: 1, tGain: 1,
  };
  const evaluated = evaluateOpticalModel(data, null, parameters, settings);
  assert.deepEqual(evaluated.n, wavelengthNm.map(() => 1.8));
  assert.deepEqual(evaluated.k, wavelengthNm.map(() => 0));
  assert.equal(evaluated.layerIndices.length, 2);
  assert.ok(evaluated.reflectance.every((value) => value >= 0 && value <= 1));
  assert.ok(evaluated.transmittance.every((value) => value >= 0 && value <= 1));
});

test("recovers a synthetic multilayer thickness with namespaced parameters", () => {
  const wavelengthNm = Array.from({ length: 41 }, (_, index) => 420 + 15 * index);
  const valid = wavelengthNm.map(() => true);
  const settings = {
    substrateIndex: 1.52, incidence: "film", activeLayerId: "top", useReflectance: true, useTransmittance: true,
    sigmaReflectance: 0.01, sigmaTransmittance: 0.01, preferSpectralShape: true, sigmaN: 0.5, sigmaK: 0.25,
    layers: [
      { id: "top", name: "Top", model: "constant" },
      { id: "bottom", name: "Bottom", model: "constant" },
    ],
  };
  const truth = { top__thicknessNm: 83, top__n: 1.72, top__k: 0, bottom__thicknessNm: 137, bottom__n: 2.35, bottom__k: 0.08, rGain: 1, tGain: 1 };
  const empty = { wavelengthNm };
  const synthetic = evaluateOpticalModel(empty, null, truth, settings);
  const data = { wavelengthNm, reflectance: synthetic.reflectance, transmittance: synthetic.transmittance, reflectanceValid: valid, transmittanceValid: valid };
  const result = fitTabulated(data, null, {
    settings,
    initial: { ...truth, top__thicknessNm: 65 },
    bounds: { top__thicknessNm: [50, 110] },
    fittedParameters: ["top__thicknessNm"],
    screeningPoints: 64,
    localRefinements: 3,
  });
  assert.ok(Math.abs(result.parameters.top__thicknessNm - truth.top__thicknessNm) < 1e-5);
});

test("fits an independently composed layer through the multilayer worker contract", () => {
  const wavelengthNm = Array.from({ length: 41 }, (_, index) => 400 + 15 * index);
  const valid = wavelengthNm.map(() => true);
  const settings = {
    substrateIndex: 1.5, incidence: "film", activeLayerId: "film", useReflectance: true, useTransmittance: true,
    sigmaReflectance: 0.01, sigmaTransmittance: 0.01, preferSpectralShape: true, sigmaN: 0.5, sigmaK: 0.25,
    layers: [{ id: "film", name: "Composite film", model: "composite", components: { tl1: true, gaussian: true } }],
  };
  const truth = {
    film__thicknessNm: 180, film__epsilonInf: 3,
    film__tl1__amplitudeEv: 55, film__tl1__resonanceEv: 3.2, film__tl1__broadeningEv: 1, film__tl1__bandgapEv: 0.8,
    film__gaussian__amplitude: 4, film__gaussian__centerEnergyEv: 4.2, film__gaussian__fwhmEv: 0.8,
    rGain: 1, tGain: 1,
  };
  const synthetic = evaluateOpticalModel({ wavelengthNm }, null, truth, settings);
  const data = { wavelengthNm, reflectance: synthetic.reflectance, transmittance: synthetic.transmittance, reflectanceValid: valid, transmittanceValid: valid };
  const result = fitTabulated(data, null, {
    settings,
    initial: { ...truth, film__tl1__amplitudeEv: 45 },
    bounds: { film__tl1__amplitudeEv: [20, 90] },
    fittedParameters: ["film__tl1__amplitudeEv"],
    screeningPoints: 64,
    localRefinements: 1,
  });
  assert.ok(Math.abs(result.parameters.film__tl1__amplitudeEv - 55) < 1e-4);
  assert.deepEqual(result.optimizer.logarithmicallySampledParameters, ["film__tl1__amplitudeEv"]);
});

test("recovers shared R/T gains across samples", () => {
  const wavelengthNm = Array.from({ length: 41 }, (_, index) => 350 + index * 20);
  const valid = wavelengthNm.map(() => true);
  const trueGains = { rGain: 1.17, tGain: 0.88 };
  const records = [
    { sampleId: "sample-a", nominalThicknessNm: 200, thicknessNm: 218, n: 2.4, k: 0.12 },
    { sampleId: "sample-b", nominalThicknessNm: 200, thicknessNm: 184, n: 3.1, k: 0.35 },
  ].map((record) => {
    const nk = { wavelengthNm, n: wavelengthNm.map(() => record.n), k: wavelengthNm.map(() => record.k) };
    const optical = filmOnThickSubstrate(wavelengthNm, nk.n, nk.k, record.thicknessNm, 1.46, "film");
    return {
      sampleId: record.sampleId,
      nominalThicknessNm: record.nominalThicknessNm,
      nk,
      data: {
        wavelengthNm,
        reflectance: optical.reflectance.map((value) => value * trueGains.rGain),
        transmittance: optical.transmittance.map((value) => value * trueGains.tGain),
        reflectanceValid: valid,
        transmittanceValid: valid,
      },
    };
  });
  const result = calibrateSharedGains(records, { substrateIndex: 1.46, incidence: "film", sigmaReflectance: 0.02, sigmaTransmittance: 0.02 });
  assert.ok(Math.abs(result.gains.rGain - trueGains.rGain) < 1e-5);
  assert.ok(Math.abs(result.gains.tGain - trueGains.tGain) < 1e-5);
  assert.ok(Math.abs(result.fittedThicknessNm["sample-a"] - 218) < 1e-3);
  assert.ok(Math.abs(result.fittedThicknessNm["sample-b"] - 184) < 1e-3);
});

test("matches Python affine-shape and ellipsometry-prior residuals", () => {
  const shapeModel = [0, 1, 0.2, 0.8, 0.1];
  const shapeMeasured = shapeModel.map((value) => 0.15 + 1.7 * value);
  const aligned = affineShapeResidual(shapeModel, shapeMeasured);
  assertArrayClose(aligned.residuals, shapeModel.map(() => 0), 1e-14);
  assert.ok(Math.abs(aligned.gain - 1.7) < 1e-14);
  assert.ok(Math.abs(aligned.offset - 0.15) < 1e-14);
  assert.ok(Math.sqrt(affineShapeResidual([...shapeModel].reverse(), shapeMeasured).residuals.reduce((sum, value) => sum + value ** 2, 0) / shapeModel.length) > 0.1);

  const wavelengthNm = Array.from({ length: 11 }, (_, index) => 300 + index * 80);
  const nk = { wavelengthNm, n: wavelengthNm.map(() => 2.5), k: wavelengthNm.map(() => 0.2) };
  const parameters = { thicknessNm: 200, n: 2, k: 0.1, rGain: 1, tGain: 1 };
  const settings = {
    model: "constant", substrateIndex: 1.46, incidence: "film", useReflectance: true, useTransmittance: true,
    sigmaReflectance: 0.02, sigmaTransmittance: 0.02, preferSpectralShape: true,
    regularizeEllipsometry: true, sigmaN: 0.5, sigmaK: 0.25,
  };
  const valid = wavelengthNm.map(() => true);
  const emptyData = { wavelengthNm, reflectance: [], transmittance: [], reflectanceValid: valid, transmittanceValid: valid };
  const evaluation = evaluateOpticalModel(emptyData, nk, parameters, settings);
  const data = { ...emptyData, reflectance: evaluation.reflectanceScaled, transmittance: evaluation.transmittanceScaled };
  const residuals = fitResidualVector(data, nk, parameters, evaluation, settings);
  assert.equal(residuals.length, 66);
  assertArrayClose(residuals.slice(0, 44), Array(44).fill(0), 1e-14);
  assertArrayClose(residuals.slice(44, 55), Array(11).fill(-1), 1e-14);
  assertArrayClose(residuals.slice(55), Array(11).fill(-0.4), 1e-14);
});

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
  const alternatives = first.diagnostics.alternativeSolutions;
  assert.ok(alternatives.length >= 1 && alternatives.length <= 5);
  assert.deepEqual(alternatives.map((solution) => solution.rank), alternatives.map((_, index) => index + 1));
  assert.ok(Math.abs(alternatives[0].relativeCostIncrease) < 1e-12);
  assert.ok(alternatives.every((solution, index) => index === 0 || solution.robustCost >= alternatives[index - 1].robustCost));
  assert.equal(first.diagnostics.nearEqualAlternativeMinima, Math.max(0, alternatives.filter((solution) => solution.relativeCostIncrease <= 0.05).length - 1));
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

test("reproduces Python/SciPy fixed-table fits for every bundled material", () => {
  const read = (name) => readFileSync(new URL(`../examples/${name}`, import.meta.url), "utf8");
  const references = {
    agst: { files: ["agst-ref.txt", "agst-tr.txt", "aGST.txt"], nominal: 250, useT: true, thickness: 234.21543802, rGain: 1.3981671261, tGain: 0.6977925667, bins: [289, 79] },
    asb2sb3: { files: ["asb2sb3-ref.txt", "asb2sb3-tr.txt", "aSb2Se3.txt"], nominal: 200, useT: true, thickness: 215.53910555, rGain: 1.3549330249, tGain: 1.0707410972, bins: [289, 267] },
    cgst: { files: ["cgst-ref.txt", "cgst-tr.txt", "cGST.txt"], nominal: 250, useT: false, thickness: 125, rGain: 1.4623690113, tGain: 1, bins: [289, 0] },
    csb2sb3: { files: ["csb2sb3-ref.txt", "csb2sb3-tr.txt", "cSb2Se3.txt"], nominal: 200, useT: true, thickness: 181.56175835, rGain: 1.0070495334, tGain: 0.8921679150, bins: [289, 182] },
    vo2: { files: ["vo2-ref.txt", "vo2-tr.txt", "VO2_22C.txt"], nominal: 150, useT: true, thickness: 115.94348973, rGain: 0.8790394080, tGain: 1.2718703539, bins: [289, 282] },
  };
  const sharedRecords = [];
  for (const [sample, reference] of Object.entries(references)) {
    const [sampleR, sampleT, nkFile] = reference.files;
    const spectrum = createSpectrum({ sampleName: sample, sampleR: read(sampleR), sampleT: read(sampleT), silicon: read("si-ref.txt"), openBeam: read("referencitrx.txt"), siliconModel: read("si_reflectance.txt") });
    const nk = loadNkTable(read(nkFile));
    const data = restrictToNkRange(prepareFitData(spectrum, { wavelengthMinNm: 300, wavelengthMaxNm: 1100, referenceThresholdFraction: 0.05, binWidthNm: 2, sampleSnrMinimum: 5, subtractBackground: true }), nk);
    sharedRecords.push({ sampleId: sample, nominalThicknessNm: reference.nominal, data, nk });
    const result = fitTabulated(data, nk, {
      settings: { model: "fixed", substrateIndex: 1.46, incidence: "film", useReflectance: true, useTransmittance: reference.useT, sigmaReflectance: 0.02, sigmaTransmittance: 0.02 },
      initial: { thicknessNm: reference.nominal, nScale: 1, kScale: 1, rGain: 1, tGain: 1 },
      bounds: { thicknessNm: [0.5 * reference.nominal, 1.5 * reference.nominal], nScale: [0.85, 1.15], kScale: [0.5, 2], rGain: [0.1, 10], tGain: [0.1, 10] },
      fittedParameters: ["thicknessNm", "rGain", "tGain"],
    });
    assert.equal(result.diagnostics.reflectanceBins, reference.bins[0], sample);
    assert.equal(result.diagnostics.transmittanceBins, reference.bins[1], sample);
    assert.ok(Math.abs(result.parameters.thicknessNm - reference.thickness) < 2e-3, sample);
    assert.ok(Math.abs(result.parameters.rGain - reference.rGain) < 2e-5, sample);
    assert.ok(Math.abs(result.parameters.tGain - reference.tGain) < 2e-5, sample);
    assert.ok(result.diagnostics.maximumPowerBalance <= 1 + 1e-10, sample);
    assert.ok(result.diagnostics.normalizedJacobianCondition >= 1, sample);
    assert.ok(Object.values(result.diagnostics.parameterStandardErrorsApproximate).every(Number.isFinite), sample);
    if (!reference.useT) assert.ok(!("tGain" in result.diagnostics.parameterStandardErrorsApproximate));
  }
  const shared = calibrateSharedGains(sharedRecords, { substrateIndex: 1.46, incidence: "film", sigmaReflectance: 0.02, sigmaTransmittance: 0.02 });
  assert.ok(Math.abs(shared.gains.rGain - 1.34441394) < 2e-3);
  assert.ok(Math.abs(shared.gains.tGain - 1.11359892) < 5e-4);
  assert.ok(Math.abs(shared.fittedThicknessNm.cgst - 125) < 1e-6);
});

function assertArrayClose(actual, expected, tolerance = 1e-12) {
  assert.equal(actual.length, expected.length);
  actual.forEach((value, index) => assert.ok(Math.abs(value - expected[index]) < tolerance, `${value} != ${expected[index]}`));
}
