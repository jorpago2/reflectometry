import { Button } from "@carbon/react";
import { ScientificEmptyState } from "@jorpago2/scientific-ui";
import { useEffect, useState } from "react";

export default function ResultsEmpty() {
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

  if (hasResults) return null;

  return <ScientificEmptyState
    id="results-empty"
    className="results-empty"
    title={hasMeasurement ? "Measurement ready" : "Start with measurement data"}
    description={hasMeasurement ? "Preview the optical model before starting an optimization." : "Load spectra or use the built-in example to inspect the optical response."}
    action={hasMeasurement
      ? <Button kind="tertiary" type="button" onClick={() => document.getElementById("preview-button")?.click()}>Preview model</Button>
      : <Button kind="tertiary" type="button" onClick={() => document.getElementById("reset-example")?.click()}>Use example</Button>}
  />;
}
