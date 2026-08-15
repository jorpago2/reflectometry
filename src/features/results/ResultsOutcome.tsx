import { ScientificOutcomeSummary, useScientificResultTransition } from "@jorpago2/scientific-ui";
import { useEffect, useRef, useState } from "react";
import { operationLabel, operationScientificState, type OperationStatus } from "../../app/operation-status.ts";

interface SourceStatus {
  ready: boolean;
  pointCount: number;
  wavelengthMinimumNm: number;
  wavelengthMaximumNm: number;
  reflectanceCount: number;
  transmittanceCount: number;
}

const initialOperation: OperationStatus = {
  phase: "needs-input",
  busy: false,
  message: "Load measurement data or use the synthetic example to begin.",
};

const initialSource: SourceStatus = {
  ready: false,
  pointCount: 0,
  wavelengthMinimumNm: 0,
  wavelengthMaximumNm: 0,
  reflectanceCount: 0,
  transmittanceCount: 0,
};

function runLegacyAction(id: string) {
  document.getElementById(id)?.click();
}

export default function ResultsOutcome() {
  const outcomeHeading = useRef<HTMLHeadingElement>(null);
  const [operation, setOperation] = useState(initialOperation);
  const [source, setSource] = useState(initialSource);

  useEffect(() => {
    const updateOperation = (event: Event) => {
      const detail = (event as CustomEvent<OperationStatus>).detail;
      if (detail) setOperation(detail);
    };
    const updateSource = (event: Event) => {
      const detail = (event as CustomEvent<Partial<SourceStatus>>).detail;
      if (!detail) return;
      setSource({
        ready: Boolean(detail.ready),
        pointCount: Number(detail.pointCount) || 0,
        wavelengthMinimumNm: Number(detail.wavelengthMinimumNm) || 0,
        wavelengthMaximumNm: Number(detail.wavelengthMaximumNm) || 0,
        reflectanceCount: Number(detail.reflectanceCount) || 0,
        transmittanceCount: Number(detail.transmittanceCount) || 0,
      });
    };
    window.addEventListener("reflectometry:operation-status", updateOperation);
    window.addEventListener("reflectometry:source-status", updateSource);
    return () => {
      window.removeEventListener("reflectometry:operation-status", updateOperation);
      window.removeEventListener("reflectometry:source-status", updateSource);
    };
  }, []);

  const state = operationScientificState(operation, source.ready);

  useScientificResultTransition({
    state,
    resultRef: outcomeHeading,
    completionKey: operation.phase === "fit-success" || operation.phase === "bootstrap-success" || operation.phase === "error" ? operation.message : null,
  });

  return (
    <ScientificOutcomeSummary
      className="reflectometry-outcome"
      title="Optical fit outcome"
      headingRef={outcomeHeading}
      status={{ state, label: operation.busy ? "Fitting optical model" : operationLabel(operation, source.ready), detail: operation.message, progress: operation.progress }}
      summary={state === "up-to-date"
        ? "The displayed model corresponds to the current stack and measurement. Inspect residuals, uncertainty and alternative solutions before accepting the fit."
        : state === "modified"
          ? "The displayed result belongs to an earlier configuration. Preview or fit again before interpretation or export."
          : state === "failed"
            ? "The previous valid result remains available. Correct the reported problem before fitting again."
            : source.ready
              ? "The measurement is ready. Preview the model for a deterministic check or run the optimizer for fitted parameters."
              : "Load measurement data or the synthetic example before previewing or fitting the stack."}
      metrics={source.ready ? [
        { id: "spectral-points", label: "Spectral samples", value: source.pointCount, format: { notation: "standard", significantDigits: 8 } },
        { id: "spectral-range", label: "Wavelength range", value: `${source.wavelengthMinimumNm.toFixed(0)}–${source.wavelengthMaximumNm.toFixed(0)}`, unit: "nm" },
        { id: "fit-channels", label: "Usable channels", value: `${source.reflectanceCount ? "R" : ""}${source.reflectanceCount && source.transmittanceCount ? " + " : ""}${source.transmittanceCount ? "T" : ""}` },
      ] : []}
      actions={[
        { id: "fit", label: operation.busy ? "Fit running…" : "Run fit", emphasis: "primary", disabled: !source.ready || operation.busy, disabledReason: !source.ready ? "Load measurement data before fitting." : undefined, onClick: () => runLegacyAction("fit-button") },
        { id: "preview", label: "Preview model", emphasis: "secondary", collapseAt: "sm", disabled: !source.ready || operation.busy, disabledReason: !source.ready ? "Load measurement data before previewing." : undefined, onClick: () => runLegacyAction("preview-button") },
      ]}
    />
  );
}
