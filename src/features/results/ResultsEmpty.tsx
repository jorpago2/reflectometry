import { ScientificEmptyState, ScientificExampleWorkflow } from "@jorpago2/scientific-ui";
import { useEffect, useState } from "react";

export default function ResultsEmpty({ engineReady }: { engineReady: boolean }) {
  const [hasMeasurement, setHasMeasurement] = useState(false);
  const [hasResults, setHasResults] = useState(false);

  useEffect(() => {
    const sourceName = document.getElementById("source-name");
    if (!sourceName) return;
    const update = () => setHasMeasurement(sourceName.textContent?.trim() !== "No measurement loaded");
    update();
    const observer = new MutationObserver(update);
    observer.observe(sourceName, { childList: true, characterData: true, subtree: true });
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const results = document.getElementById("results-content");
    if (!results) return;
    const update = () => setHasResults(!results.hidden);
    update();
    const observer = new MutationObserver(update);
    observer.observe(results, { attributes: true, attributeFilter: ["hidden"] });
    return () => observer.disconnect();
  }, []);

  return <ScientificEmptyState
    id="results-empty"
    className="results-empty"
    hidden={hasResults}
    title={hasMeasurement ? "Measurement ready" : "Start with measurement data"}
    description={hasMeasurement ? "Preview the optical model before starting an optimization." : "Load spectra or use the built-in example to inspect the optical response."}
    action={<ScientificExampleWorkflow
      loaded={hasMeasurement}
      loadLabel="Load example"
      runLabel="Preview model"
      busy={!engineReady}
      runDisabled={!engineReady}
      description={!engineReady
        ? "Starting the local scientific engine…"
        : hasMeasurement
        ? "The example inputs are loaded. Inspect the layer stack, then preview the optical model explicitly."
        : "Load the deterministic synthetic stack, inspect its inputs, then preview it explicitly."}
      onLoad={() => document.getElementById("reset-example")?.click()}
      onRun={() => document.getElementById("preview-button")?.click()}
    />}
  />;
}
