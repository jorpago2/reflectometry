import assert from "node:assert/strict";
import test from "node:test";
import { scrambledSobolPoints } from "../src/scientific/fitting/sobol.ts";

test("matches scipy.stats.qmc.Sobol with scramble=True and seed=1729", () => {
  assert.deepEqual(scrambledSobolPoints(1, 4), [
    [0.6290463367477059],
    [0.37120115850120783],
    [0.09335567243397236],
    [0.9136970061808825],
  ]);
  assert.deepEqual(scrambledSobolPoints(3, 2)[1], [
    0.34841533098369837,
    0.19044235814362764,
    0.24077162891626358,
  ]);
});
