import assert from "node:assert/strict";
import test from "node:test";
import { operationLabel, operationScientificState } from "../src/app/operation-status.ts";

test("preview text cannot be promoted to a converged fit by wording", () => {
  const preview = { phase: "preview", busy: false, message: "Parameters have not been optimized." };
  assert.equal(operationScientificState(preview, true), "ready");
  assert.equal(operationLabel(preview, true), "Preview current · not fitted");
});

test("only typed fit completion produces validated state", () => {
  const fit = { phase: "fit-success", busy: false, message: "Fit complete." };
  assert.equal(operationScientificState(fit, true), "up-to-date");
  assert.equal(operationLabel(fit, true), "Fit converged · review validation");
  assert.equal(operationScientificState({ ...fit, phase: "stale" }, true), "modified");
});
