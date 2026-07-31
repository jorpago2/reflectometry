import assert from "node:assert/strict";
import test from "node:test";
import {
  codyLorentzDielectric,
  drudeTaucLorentzDielectric,
  gaussianOscillatorDielectric,
  modelParameterSpecs,
  multiTaucLorentzDielectric,
  passiveRefractiveIndex,
  refractiveIndexModel,
  taucGaussianDielectric,
  taucLorentzDielectric,
} from "../dielectric-models.js";
import { filmOnThickSubstrate, fitOpticalModel } from "../scientific-core.js";

const wavelengthNm = [300, 400, 700, 1064];

test("matches Python causal dielectric-model references", () => {
  const tl = taucLorentzDielectric(wavelengthNm, 4, 80, 3, 1, 1.1);
  assertArrayClose(tl.epsilon1, [-5.130922971221162, 3.0799300118806183, 18.46024805831342, 14.619917452945685]);
  assertArrayClose(tl.epsilon2, [6.48481096706442, 31.031855240388523, 1.6274316827891355, 0.014680266242116106]);

  const multi = multiTaucLorentzDielectric(wavelengthNm, { epsilonInf: 4, amplitude1Ev: 60, resonance1Ev: 3, broadening1Ev: 1, amplitude2Ev: 20, resonance2Ev: 4, broadening2Ev: 1.2, bandgapEv: 1.1 });
  assertArrayClose(multi.epsilon1, [-3.8057084604068243, 8.418774890399373, 17.82271603628856, 14.4823785092854]);
  assertArrayClose(multi.epsilon2, [13.15709698545037, 25.537908190306517, 1.3642343947785889, 0.012632213281716634]);

  const gaussian = gaussianOscillatorDielectric(wavelengthNm, 5, 3.8, 1);
  assertArrayClose(gaussian.epsilon1, [-2.3444172092435505, 3.148235217642269, 1.1839995563889987, 1.004976324019193], 2e-7);
  assertArrayClose(gaussian.epsilon2, [3.6779124157439123, 1.2831726092603386, 5.530833142354141e-5, 2.188646953842338e-8]);

  const hybrid = taucGaussianDielectric(wavelengthNm, { epsilonInf: 4, amplitudeEv: 80, resonanceEv: 3, broadeningEv: 1, bandgapEv: 1.1, gaussianAmplitude: 5, gaussianCenterEv: 3.8, gaussianFwhmEv: 1 });
  assertArrayClose(hybrid.epsilon1, [-7.475340180464713, 6.2281652295228875, 19.64424761470242, 15.624893776964878], 2e-7);

  const cody = codyLorentzDielectric(wavelengthNm, { epsilonInf: 4, amplitudeEv: 100, transitionEv: 1.6, broadeningEv: 2.4, crossoverEv: 0.8, resonanceEv: 3.6, urbachEv: 0.05, bandgapEv: 1.1 });
  assertArrayClose(cody.epsilon1, [-5.663415765430534, 24.194337946851658, 32.63112483780516, 25.442836912520548], 2e-11);
  assertArrayClose(cody.epsilon2, [28.94031194659773, 34.67408608888959, 5.5186436088398745, 0.0007265195323114285]);

  const drude = drudeTaucLorentzDielectric(wavelengthNm, { epsilonInf: 4, plasmaEnergyEv: 4.16, drudeGammaEv: 0.67, amplitudeEv: 80, resonanceEv: 3, broadeningEv: 1, bandgapEv: 0.4 });
  assertArrayClose(drude.epsilon1, [-14.482711975150663, -6.181725591618758, 27.244575514836882, 16.75254742846215]);
  assertArrayClose(drude.epsilon2, [9.983836774570227, 56.9333218607679, 8.617488650243352, 7.525672963492401]);
  const index = passiveRefractiveIndex(drude);
  assert.ok(index.n.every((value) => value >= 0));
  assert.ok(index.k.every((value) => value >= 0));
});

test("uses the Python-derived ellipsometry seeds for bundled samples", () => {
  const tl = modelParameterSpecs("tl1", "agst");
  assert.ok(Math.abs(tl.epsilonInf.value - 1.1859581695838666) < 1e-9);
  assert.ok(Math.abs(tl.amplitudeEv.value - 156.97968523911194) < 1e-9);
  const cody = modelParameterSpecs("cody", "asb2sb3");
  assert.ok(Math.abs(cody.bandgapEv.value - 1.2565694074958578) < 1e-9);
});

test("recovers synthetic Tauc–Lorentz thickness and amplitude", () => {
  const grid = Array.from({ length: 81 }, (_, index) => 300 + index * 10);
  const targetParameters = { thicknessNm: 237, epsilonInf: 4, amplitudeEv: 70, resonanceEv: 3, broadeningEv: 1, bandgapEv: 0.8, rGain: 1, tGain: 1 };
  const index = refractiveIndexModel("tl1", grid, targetParameters, null);
  const target = filmOnThickSubstrate(grid, index.n, index.k, targetParameters.thicknessNm, 1.46, "film");
  const valid = grid.map(() => true);
  const result = fitOpticalModel({ wavelengthNm: grid, reflectance: target.reflectance, transmittance: target.transmittance, reflectanceValid: valid, transmittanceValid: valid }, null, {
    settings: { model: "tl1", substrateIndex: 1.46, incidence: "film", useReflectance: true, useTransmittance: true, sigmaReflectance: 0.02, sigmaTransmittance: 0.02 },
    initial: { ...targetParameters, thicknessNm: 210, amplitudeEv: 60 },
    bounds: { thicknessNm: [100, 400], epsilonInf: [0.5, 20], amplitudeEv: [10, 200], resonanceEv: [1.6, 5.5], broadeningEv: [0.1, 3.1], bandgapEv: [0, 1.5], rGain: [0.1, 10], tGain: [0.1, 10] },
    fittedParameters: ["thicknessNm", "amplitudeEv"],
  });
  assert.ok(Math.abs(result.parameters.thicknessNm - 237) < 1e-3);
  assert.ok(Math.abs(result.parameters.amplitudeEv - 70) < 1e-3);
});

function assertArrayClose(actual, expected, tolerance = 1e-12) {
  assert.equal(actual.length, expected.length);
  actual.forEach((value, index) => assert.ok(Math.abs(value - expected[index]) < tolerance, `${value} != ${expected[index]}`));
}
