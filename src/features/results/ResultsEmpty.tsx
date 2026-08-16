import { ScientificEmptyState, ScientificExampleWorkflow } from "@jorpago2/scientific-ui";
import { useReflectometry } from "../../app/reflectometry-context.ts";

export default function ResultsEmpty() {
  const [state, actions] = useReflectometry();

  return <ScientificEmptyState
    className="results-empty"
    title={state.hasMeasurement ? "Measurement ready" : "Start with measurement data"}
    description={state.hasMeasurement ? "Preview the optical model before starting an optimization." : "Load spectra or use the built-in example to inspect the optical response."}
    action={<ScientificExampleWorkflow
      loaded={state.hasMeasurement}
      loadLabel="Load example"
      runLabel="Preview model"
      busy={state.operation.busy}
      runDisabled={!state.canPreview}
      description={state.hasMeasurement
        ? "The example inputs are loaded. Inspect the layer stack, then preview the optical model explicitly."
        : "Load the deterministic synthetic stack, inspect its inputs, then preview it explicitly."}
      onLoad={actions.loadSyntheticExample}
      onRun={actions.preview}
    />}
  />;
}
