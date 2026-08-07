import assert from "node:assert/strict";
import test from "node:test";
import { parseSavedFit, SAVED_FIT_SCHEMA } from "../src/scientific/fitting/saved-fit.ts";

test("saved fits restore complete v8 data and legacy substrate units", () => {
  const wavelengthNm = Array.from({ length: 20 }, (_, index) => 195 + 2 * index);
  const spectrum = { sampleName: "Sample", wavelengthNm, sampleReflectanceCounts: wavelengthNm, sampleTransmittanceCounts: wavelengthNm, reflectanceReferenceCounts: wavelengthNm, transmittanceReferenceCounts: wavelengthNm, referenceReflectance: wavelengthNm.map(() => 0.3) };
  const nkTable = { wavelengthNm: [300, 1100], n: [1.52, 1.45], k: [0.01, 0] };
  const base = { stack: [{ id: "layer1", name: "Layer", opticalModel: "constant", parameters: { thicknessNm: 100, n: 2, k: 0.1 }, parameterLinks: {} }], substrate: { refractiveIndex: { n: 1.5, k: 0.01 }, opticalModel: "scaled", nkTable, parameters: { nScale: 1, kScale: 1 }, parameterSettings: {}, thicknessUm: 1000, incidence: "film" }, gains: { reflectance: 1, transmittance: 1 } };
  const restored = parseSavedFit(JSON.stringify({ ...base, schema: SAVED_FIT_SCHEMA, measurement: { spectrum }, controls: { "use-r": true } }));
  assert.equal(restored.spectrum.sampleName, "Sample");
  assert.equal(restored.stack[0].parameters.thicknessNm, 100);
  assert.equal(restored.controls["use-r"], true);
  assert.equal(restored.substrateMaterial.opticalModel, "scaled");
  assert.deepEqual(restored.substrateMaterial.nkTable, nkTable);
  const legacy = parseSavedFit(JSON.stringify({ ...base, schema: "reflectometry-browser-fit/v5", substrate: { ...base.substrate, thicknessUm: undefined, thicknessNm: 500000 } }));
  assert.equal(legacy.substrate.thicknessUm, 500);
  assert.equal(legacy.spectrum, null);
  assert.throws(() => parseSavedFit("not JSON"), /not valid JSON/);
  assert.throws(() => parseSavedFit(JSON.stringify({ ...base, schema: SAVED_FIT_SCHEMA, stack: [{ ...base.stack[0], opticalModel: "__proto__" }] })), /unsupported optical model/);
  assert.throws(() => parseSavedFit(JSON.stringify({ ...base, schema: SAVED_FIT_SCHEMA, substrate: { ...base.substrate, opticalModel: "__proto__" } })), /substrate uses an unsupported optical model/);
  assert.throws(() => parseSavedFit(JSON.stringify({ ...base, schema: SAVED_FIT_SCHEMA, substrate: { ...base.substrate, parameterSettings: { nScale: { minimum: 1.1, maximum: 2, fit: true } } } })), /outside its saved bounds/);
});
