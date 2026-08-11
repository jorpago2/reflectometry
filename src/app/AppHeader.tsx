import { SkipToContent } from "@carbon/react";
import { ScientificHeader, ScientificRunControl, useScientificShortcut } from "@jorpago2/scientific-ui";
import { useCallback, useEffect, useMemo, useState } from "react";

interface OperationStatus {
  busy: boolean;
  kind: "neutral" | "running" | "success" | "error";
  message: string;
  progress?: number;
}

export default function AppHeader() {
  const [sourceReady, setSourceReady] = useState(false);
  const [operation, setOperation] = useState<OperationStatus>({
    busy: false,
    kind: "neutral",
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

  const state = operation.busy
    ? "running"
    : operation.kind === "error"
      ? "failed"
      : operation.kind === "success"
        ? "up-to-date"
        : /stale|changed/i.test(operation.message)
          ? "modified"
          : sourceReady
            ? "ready"
            : "needs-input";
  const label = operation.busy
    ? operation.message
    : state === "failed"
      ? "Error"
      : state === "up-to-date"
        ? "Up to date"
        : state === "modified"
          ? "Modified"
          : sourceReady
            ? "Ready"
            : "Needs input";

  return (
    <ScientificHeader
      aria-label="Reflectometry"
      product="Reflectometry"
      productMark="R"
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
