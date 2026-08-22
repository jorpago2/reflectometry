import { SkipToContent } from "@carbon/react";
import { ScientificHeader, ScientificRunControl, useScientificShortcut } from "@jorpago2/scientific-ui";
import { useMemo } from "react";
import { useReflectometry } from "./reflectometry-context.ts";
import { operationLabel, operationScientificState } from "./operation-status.ts";

export default function AppHeader() {
  const [state, actions] = useReflectometry();
  const scientificState = operationScientificState(state.operation, state.hasMeasurement);
  const label = operationLabel(state.operation, state.hasMeasurement);
  const processingError = Object.values(state.processingErrors)[0];
  const fitDisabledReason = !state.hasMeasurement
    ? "Load measurement data before fitting."
    : processingError
      ? processingError
      : !state.controls.useReflectance && !state.controls.useTransmittance
        ? "Select reflectance, transmittance, or both fit channels."
        : state.selectedFitCount === 0
          ? "Select at least one fitted parameter."
          : state.selectedFitCount > 11
            ? "Select at most 11 fitted parameters."
            : undefined;

  useScientificShortcut(useMemo(() => ({
    id: "reflectometry:cancel-fit",
    shortcut: "Escape",
    description: "Cancel fitting",
    displayKeys: ["Esc"],
    handler: actions.cancel,
    enabled: state.operation.busy,
    priority: 20,
  }), [actions, state.operation.busy]));

  return (
    <ScientificHeader
      aria-label="Reflectometry"
      product="Reflectometry"
      compactProduct="Reflectometry"
      productIcon="reflectometry"
      descriptor="Optical fitting"
      href="./"
      skipLink={<SkipToContent href="#reflectometry-workspace">Skip to fitting workspace</SkipToContent>}
      contextLabel="Current measurement"
      context={<span title={state.sourceLabel}>{state.source?.sampleName ?? "No measurement loaded"}</span>}
      contextDetail={<span className="visually-hidden">{state.hasMeasurement ? "Ready" : "Needs input"}</span>}
      status={{ state: scientificState, label, progress: state.operation.progress, detail: state.operation.message }}
      primaryAction={(
        <ScientificRunControl
          size="md"
          execution={{
            state: scientificState,
            label,
            progress: state.operation.progress,
            detail: state.operation.message,
            onRun: actions.fit,
            onStop: actions.cancel,
            runLabel: "Fit",
            stopLabel: "Cancel",
            disabled: !state.canFit,
            disabledReason: fitDisabledReason,
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
