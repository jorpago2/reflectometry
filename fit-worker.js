import { fitTabulated } from "./scientific-core.js";

self.addEventListener("message", ({ data }) => {
  try {
    const result = fitTabulated(data.fitData, data.nk, data.configuration, (progress) => {
      self.postMessage({ type: "progress", progress });
    });
    self.postMessage({ type: "result", result });
  } catch (error) {
    self.postMessage({ type: "error", message: error instanceof Error ? error.message : String(error) });
  }
});
