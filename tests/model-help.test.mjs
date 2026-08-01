import assert from "node:assert/strict";
import test from "node:test";
import { MODEL_LABELS, modelParameterSpecs } from "../src/dielectric-models.ts";
import { COMPONENT_GUIDES, EMA_RULE_GUIDES, MODEL_GUIDES, parameterDescription } from "../src/model-help.ts";

test("documents every optical model, component, and current parameter", () => {
  assert.deepEqual(Object.keys(MODEL_GUIDES).sort(), Object.keys(MODEL_LABELS).sort());
  for (const guide of [...Object.values(MODEL_GUIDES), ...Object.values(COMPONENT_GUIDES), ...Object.values(EMA_RULE_GUIDES)]) {
    assert.ok(guide.summary || guide.represents);
    assert.match(guide.equation.mathml, /<mrow>/);
    for (const reference of guide.references) assert.match(reference.doi, /^10\.\d{4,9}\//);
  }

  const specifications = Object.keys(MODEL_LABELS).flatMap((model) => Object.keys(modelParameterSpecs(model)));
  specifications.push(...Object.keys(modelParameterSpecs("composite", undefined, 150, {
    taucLorentz: 5, lorentz: 5, gaussian: true, cody: true, drudeSmith: true, brendelBormann: true, criticalPoint: true,
  })));
  for (const parameter of new Set(specifications)) assert.doesNotMatch(parameterDescription(parameter), /^Numerical parameter/);
});
