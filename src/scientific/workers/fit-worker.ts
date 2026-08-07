import { bootstrapFitUncertainty, calibrateSharedGains, fitEllipsometrySeed, fitOpticalModel } from "../engine.ts";

self.addEventListener("message", ({ data }) => {
  try {
    if (data.operation === "bootstrap") {
      const result = bootstrapFitUncertainty(data.fitData, data.nk, data.configuration, data.bestParameters, data.samples, (progress) => self.postMessage({ type: "bootstrap-progress", progress }));
      self.postMessage({ type: "bootstrap-result", result });
      return;
    }
    if (data.operation === "shared-gains") {
      self.postMessage({ type: "progress", progress: 10 });
      const result = calibrateSharedGains(data.records, data.settings);
      self.postMessage({ type: "shared-result", result });
      return;
    }
    if (data.operation === "ellipsometry-seed") {
      const result = fitEllipsometrySeed(data.nk, data.model, data.specifications);
      self.postMessage({ type: "seed-result", result });
      return;
    }
    const result = fitOpticalModel(data.fitData, data.nk, data.configuration, (progress) => {
      self.postMessage({ type: "progress", progress });
    });
    self.postMessage({ type: "result", result });
  } catch (error) {
    self.postMessage({ type: "error", message: error instanceof Error ? error.message : String(error) });
  }
});
