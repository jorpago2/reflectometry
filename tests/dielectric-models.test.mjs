import assert from "node:assert/strict";
import test from "node:test";
import {
  brendelBormannDielectric,
  cauchyRefractiveIndex,
  codyLorentzDielectric,
  compositeDielectric,
  criticalPointDielectric,
  drudeDielectric,
  drudeSmithDielectric,
  drudeTaucLorentzDielectric,
  effectiveMediumRefractiveIndex,
  forouhiBloomerRefractiveIndex,
  gaussianOscillatorDielectric,
  kkSplineDielectric,
  lorentzOscillatorDielectric,
  modelParameterSpecs,
  multiTaucLorentzDielectric,
  passiveRefractiveIndex,
  refractiveIndexModel,
  sellmeierRefractiveIndex,
  taucGaussianDielectric,
  taucLorentzDielectric,
} from "../src/scientific/models/dielectric-models.ts";
import { filmOnThickSubstrate, fitEllipsometrySeed, fitOpticalModel } from "../src/scientific/solvers/scientific-core.ts";

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

test("combines dielectric components independently without duplicating epsilon infinity", () => {
  const tlParameters = {
    epsilonInf: 4,
    tl1__amplitudeEv: 80,
    tl1__resonanceEv: 3,
    tl1__broadeningEv: 1,
    tl1__bandgapEv: 0.4,
  };
  const tl = taucLorentzDielectric(wavelengthNm, 4, 80, 3, 1, 0.4);
  const tlComposite = compositeDielectric(wavelengthNm, tlParameters, { taucLorentz: 1 });
  assertArrayClose(tlComposite.epsilon1, tl.epsilon1);
  assertArrayClose(tlComposite.epsilon2, tl.epsilon2);

  const gaussianParameters = { gaussian__amplitude: 5, gaussian__centerEnergyEv: 3.8, gaussian__fwhmEv: 1 };
  const gaussian = gaussianOscillatorDielectric(wavelengthNm, 5, 3.8, 1);
  const drudeParameters = { drude__plasmaEnergyEv: 4.16, drude__gammaEv: 0.67 };
  const drude = drudeDielectric(wavelengthNm, 4.16, 0.67);
  const independent = compositeDielectric(wavelengthNm, { epsilonInf: 4, ...gaussianParameters, ...drudeParameters }, { gaussian: true, drude: true });
  assertArrayClose(independent.epsilon1, gaussian.epsilon1.map((value, index) => 4 + value + drude.epsilon1[index]));
  assertArrayClose(independent.epsilon2, gaussian.epsilon2.map((value, index) => value + drude.epsilon2[index]));

  const combined = compositeDielectric(wavelengthNm, { ...tlParameters, ...gaussianParameters, ...drudeParameters }, { taucLorentz: 1, gaussian: true, drude: true });
  const legacy = drudeTaucLorentzDielectric(wavelengthNm, { epsilonInf: 4, plasmaEnergyEv: 4.16, drudeGammaEv: 0.67, amplitudeEv: 80, resonanceEv: 3, broadeningEv: 1, bandgapEv: 0.4 });
  assertArrayClose(combined.epsilon1, legacy.epsilon1.map((value, index) => value + gaussian.epsilon1[index]));
  assertArrayClose(combined.epsilon2, legacy.epsilon2.map((value, index) => value + gaussian.epsilon2[index]));
});

test("creates material-agnostic parameter specifications", () => {
  const tl = modelParameterSpecs("tl1");
  assert.equal(tl.epsilonInf.value, 4);
  assert.equal(tl.amplitudeEv.value, 80);
  const custom = modelParameterSpecs("tl1", { n: 3, k: 0.1 }, 333);
  assert.equal(custom.thicknessNm.value, 333);
  assert.equal(custom.thicknessNm.minimum, 166.5);
  const composite = modelParameterSpecs("composite", { n: 3, k: 0.1 }, 250, { taucLorentz: 1, gaussian: true, drude: false });
  assert.ok(composite["tl1__amplitudeEv"] && composite["gaussian__amplitude"]);
  assert.equal(composite["drude__plasmaEnergyEv"], undefined);
  const fiveOscillators = modelParameterSpecs("composite", { n: 3, k: 0.1 }, 250, { taucLorentz: 5 });
  assert.ok(fiveOscillators["tl5__amplitudeEv"]);
  const fiveParameters = Object.fromEntries(Object.entries(fiveOscillators).filter(([name]) => name !== "thicknessNm").map(([name, specification]) => [name, specification.value]));
  const dielectric = compositeDielectric(wavelengthNm, fiveParameters, { taucLorentz: 5 });
  assert.ok(dielectric.epsilon1.every(Number.isFinite) && dielectric.epsilon2.every(Number.isFinite));
  assert.throws(() => modelParameterSpecs("composite", { n: 3, k: 0.1 }, 250, { taucLorentz: 6 }), /0 to 5/);
});

test("evaluates every generic optical model with passive finite results", () => {
  const drude = drudeDielectric(wavelengthNm, 4, 0.5);
  const drudeSmithLimit = drudeSmithDielectric(wavelengthNm, 4, 0.5, 0);
  assertArrayClose(drudeSmithLimit.epsilon1, drude.epsilon1);
  assertArrayClose(drudeSmithLimit.epsilon2, drude.epsilon2);

  for (const dielectric of [
    lorentzOscillatorDielectric(wavelengthNm, 2, 3, 0.5),
    brendelBormannDielectric(wavelengthNm, { strength: 2, resonanceEv: 3, gammaEv: 0.5, sigmaEv: 0.3 }),
    criticalPointDielectric(wavelengthNm, { amplitude: 2, energyEv: 3, broadeningEv: 0.2 }),
    kkSplineDielectric(wavelengthNm, { epsilonInf: 2, splineEpsilon2_1: 0.1, splineEpsilon2_2: 0.5, splineEpsilon2_3: 1, splineEpsilon2_4: 1, splineEpsilon2_5: 0.2 }),
  ]) {
    assert.ok(dielectric.epsilon1.every(Number.isFinite));
    assert.ok(dielectric.epsilon2.every((value) => Number.isFinite(value) && value >= 0));
  }

  const cauchy = cauchyRefractiveIndex([500], { cauchyA: 1.5, cauchyBUm2: 0.01, cauchyCUm4: 0, urbachK0: 0, urbachReferenceEv: 1.5, urbachEnergyEv: 0.1 });
  assert.ok(Math.abs(cauchy.n[0] - 1.54) < 1e-12 && cauchy.k[0] === 0);
  const silica = sellmeierRefractiveIndex([589.3], { sellmeierB1: 0.6961663, sellmeierC1Um2: 0.00467915, sellmeierB2: 0.4079426, sellmeierC2Um2: 0.0135121, sellmeierB3: 0.8974794, sellmeierC3Um2: 97.934 });
  assert.ok(Math.abs(silica.n[0] - 1.4584) < 1e-4 && silica.k[0] === 0);
  const forouhi = forouhiBloomerRefractiveIndex([800, 1500], { nInfinity: 1.5, amplitudeEv: 1, bEv: 3, cEv2: 4, bandgapEv: 1 });
  assert.ok(forouhi.n.every((value) => Number.isFinite(value) && value > 0));
  assert.equal(forouhi.k[1], 0);

  const hostNk = { wavelengthNm: [300, 1200], n: [1.5, 1.5], k: [0, 0] };
  const inclusionNk = { wavelengthNm: [300, 1200], n: [2.5, 2.5], k: [0.2, 0.2] };
  for (const method of ["bruggeman", "maxwell-garnett"]) {
    const host = effectiveMediumRefractiveIndex(wavelengthNm, { volumeFraction: 0 }, { method, hostNk, inclusionNk });
    const inclusion = effectiveMediumRefractiveIndex(wavelengthNm, { volumeFraction: 1 }, { method, hostNk, inclusionNk });
    assertArrayClose(host.n, wavelengthNm.map(() => 1.5));
    assertArrayClose(inclusion.n, wavelengthNm.map(() => 2.5));
    assertArrayClose(inclusion.k, wavelengthNm.map(() => 0.2));
  }
  const absorbingMixture = effectiveMediumRefractiveIndex(wavelengthNm, { volumeFraction: 0.5 }, { method: "bruggeman", hostNk, inclusionNk });
  assert.ok(absorbingMixture.k.every((value) => Number.isFinite(value) && value >= 0));

  const lorentzSpecs = modelParameterSpecs("composite", { n: 3, k: 0.1 }, 250, { taucLorentz: 0, lorentz: 5 });
  assert.ok(lorentzSpecs["lorentz5__strength"]);
  assert.throws(() => modelParameterSpecs("composite", { n: 3, k: 0.1 }, 250, { lorentz: 6 }), /0 to 5 Lorentz/);
});

test("rejects non-physical wavelength and tabulated-index inputs at model boundaries", () => {
  assert.throws(() => criticalPointDielectric([0], { amplitude: 2, energyEv: 3, broadeningEv: 0.2 }), /finite and positive/);
  assert.throws(() => effectiveMediumRefractiveIndex([500], { volumeFraction: 0.5 }, {
    method: "bruggeman",
    hostNk: { wavelengthNm: [400, 600], n: [1.5, Number.NaN], k: [0, 0] },
    inclusionNk: { wavelengthNm: [400, 600], n: [2.5, 2.5], k: [0.1, 0.1] },
  }), /Invalid ellipsometry n,k table/);
});

test("fits a dynamic ellipsometry seed from the loaded n,k table", () => {
  const grid = Array.from({ length: 81 }, (_, index) => 300 + 10 * index);
  const truth = { epsilonInf: 4, amplitudeEv: 80, resonanceEv: 3, broadeningEv: 1, bandgapEv: 1 };
  const nk = refractiveIndexModel("tl1", grid, truth, null);
  const result = fitEllipsometrySeed({ wavelengthNm: grid, ...nk }, "tl1", modelParameterSpecs("tl1"));
  assert.ok(Math.abs(result.parameters.epsilonInf - truth.epsilonInf) < 1e-8);
  assert.ok(Math.abs(result.parameters.amplitudeEv - truth.amplitudeEv) < 1e-8);
  assert.ok(result.diagnostics.rmseDeltaN < 1e-8);
  assert.ok(result.diagnostics.solver.success);
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
    screeningPoints: 64,
    localRefinements: 1,
  });
  assert.ok(Math.abs(result.parameters.thicknessNm - 237) < 1e-3);
  assert.ok(Math.abs(result.parameters.amplitudeEv - 70) < 1e-3);
  assert.equal(result.optimizer.screeningPoints, 64);
  assert.equal(result.optimizer.localRefinementsRequested, 1);
  assert.equal(result.optimizer.failedStarts.length, 0);
});

function assertArrayClose(actual, expected, tolerance = 1e-12) {
  assert.equal(actual.length, expected.length);
  actual.forEach((value, index) => assert.ok(Math.abs(value - expected[index]) < tolerance, `${value} != ${expected[index]}`));
}
