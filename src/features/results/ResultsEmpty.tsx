import { Button } from "@carbon/react";

export default function ResultsEmpty() {
  return <div id="results-empty" className="results-empty"><strong>Start with measurement data</strong><p>Load spectra or use the built-in example to inspect the optical response.</p><Button kind="tertiary" type="button" onClick={() => document.getElementById("reset-example")?.click()}>Use example</Button></div>;
}
