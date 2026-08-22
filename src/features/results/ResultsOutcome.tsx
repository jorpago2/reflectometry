import { ScientificOutcomeSummary, useScientificResultTransition } from "@jorpago2/scientific-ui";
import { useRef } from "react";
import { operationLabel, operationScientificState } from "../../app/operation-status.ts";
import { useReflectometry } from "../../app/reflectometry-context.ts";

export default function ResultsOutcome() {
  const outcomeHeading = useRef<HTMLHeadingElement>(null);
  const [snapshot, actions] = useReflectometry();
  const state = operationScientificState(snapshot.operation, snapshot.hasMeasurement);
  const source = snapshot.sourceQuality;
  const inputError = Object.values(snapshot.processingErrors)[0]
    ?? (!snapshot.controls.useReflectance && !snapshot.controls.useTransmittance ? "Select reflectance, transmittance, or both fit channels." : undefined);

  useScientificResultTransition({
    state,
    resultRef: outcomeHeading,
    completionKey: ["fit-success", "bootstrap-success", "error"].includes(snapshot.operation.phase) ? snapshot.operation.message : null,
  });

  return (
    <ScientificOutcomeSummary
      className="reflectometry-outcome"
      title="Optical fit outcome"
      headingRef={outcomeHeading}
      status={{ state, label: snapshot.operation.busy ? "Fitting optical model" : operationLabel(snapshot.operation, snapshot.hasMeasurement), detail: snapshot.operation.message, progress: snapshot.operation.progress }}
      summary={state === "up-to-date"
        ? "The displayed model corresponds to the current stack and measurement. Inspect residuals, uncertainty and alternative solutions before accepting the fit."
        : state === "modified"
          ? "The displayed result belongs to an earlier configuration. Preview or fit again before interpretation or export."
          : state === "failed"
            ? "The previous valid result remains available. Correct the reported problem before fitting again."
            : snapshot.hasMeasurement
              ? "The measurement is ready. Preview the model for a deterministic check or run the optimizer for fitted parameters."
              : "Load measurement data or the synthetic example before previewing or fitting the stack."}
      metrics={snapshot.hasMeasurement ? [
        { id: "spectral-points", label: "Spectral samples", value: source.pointCount, format: { notation: "standard", significantDigits: 8 } },
        { id: "spectral-range", label: "Wavelength range", value: `${source.wavelengthMinimumNm.toFixed(0)}–${source.wavelengthMaximumNm.toFixed(0)}`, unit: "nm" },
        { id: "fit-channels", label: "Usable channels", value: `${source.reflectanceCount ? "R" : ""}${source.reflectanceCount && source.transmittanceCount ? " + " : ""}${source.transmittanceCount ? "T" : ""}` },
      ] : []}
      actions={[
        { id: "fit", label: snapshot.operation.busy ? "Fit running…" : "Run fit", emphasis: "primary", disabled: !snapshot.canFit, disabledReason: !snapshot.hasMeasurement ? "Load measurement data before fitting." : inputError, onClick: actions.fit },
        { id: "preview", label: "Preview model", emphasis: "secondary", collapseAt: "never", disabled: !snapshot.canPreview, disabledReason: !snapshot.hasMeasurement ? "Load measurement data before previewing." : inputError, onClick: actions.preview },
      ]}
    />
  );
}
