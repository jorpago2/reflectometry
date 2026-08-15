import { SkipToContent } from "@carbon/react";
import { ScientificHeader, ScientificRunControl, useScientificShortcut } from "@jorpago2/scientific-ui";
import { useCallback, useEffect, useMemo, useState } from "react";
import { operationLabel, operationScientificState, type OperationStatus } from "./operation-status.ts";

export default function AppHeader() {
  const [sourceReady, setSourceReady] = useState(false);
  const [operation, setOperation] = useState<OperationStatus>({
    phase: "needs-input",
    busy: false,
    message: "Load measurement data or the synthetic example to begin.",
  });

  useEffect(() => {
    const updateSourceStatus = (event: Event) => {
      setSourceReady(Boolean((event as CustomEvent<{ ready: boolean }>).detail?.ready));
    };
    window.addEventListener("reflectometry:source-status", updateSourceStatus);
    return () => window.removeEventListener("reflectometry:source-status", updateSourceStatus);
  }, []);

  useEffect(() => {
    const updateOperationStatus = (event: Event) => {
      const detail = (event as CustomEvent<OperationStatus>).detail;
      if (detail) setOperation(detail);
    };
    window.addEventListener("reflectometry:operation-status", updateOperationStatus);
    return () => window.removeEventListener("reflectometry:operation-status", updateOperationStatus);
  }, []);

  const runFit = useCallback(() => document.getElementById("fit-button")?.click(), []);
  const cancelFit = useCallback(() => document.getElementById("cancel-operation")?.click(), []);
  const cancelShortcut = useMemo(() => ({
    id: "reflectometry:cancel-fit",
    shortcut: "Escape",
    description: "Cancel fitting",
    displayKeys: ["Esc"],
    handler: cancelFit,
    enabled: operation.busy,
    priority: 20,
  }), [cancelFit, operation.busy]);
  useScientificShortcut(cancelShortcut);

  const state = operationScientificState(operation, sourceReady);
  const label = operationLabel(operation, sourceReady);

  return (
    <ScientificHeader
      aria-label="Reflectometry"
      product="Reflectometry"
      productIcon="reflectometry"
      descriptor="Optical fitting"
      href="./"
      skipLink={<SkipToContent href="#reflectometry-workspace">Skip to fitting workspace</SkipToContent>}
      contextLabel="Current measurement"
      context={<span id="header-source-name">No measurement loaded</span>}
      contextDetail={<span id="header-source-status" className="visually-hidden" aria-hidden="true">Needs input</span>}
      status={{ state, label, progress: operation.progress, detail: operation.message }}
      primaryAction={(
        <ScientificRunControl
          size="md"
          execution={{
            state,
            label,
            progress: operation.progress,
            detail: operation.message,
            onRun: runFit,
            onStop: cancelFit,
            runLabel: "Fit",
            stopLabel: "Cancel",
            disabled: !sourceReady,
            disabledReason: "Load measurement data before fitting.",
          }}
        />
      )}
      help={{
        id: "app-help",
        summary: "Load spectra, define the stack, preview the model, then run a fit and inspect residuals and uncertainty.",
        footer: "Reflectometry v4.0.0",
      }}
    />
  );
}
