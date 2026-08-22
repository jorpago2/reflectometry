import { Accordion, AccordionItem, Button, Checkbox, FileUploaderButton, NumberInput, TextInput } from "@carbon/react";
import { useState } from "react";
import { ScientificPreflightSummary } from "@jorpago2/scientific-ui";
import { useReflectometry } from "../../app/reflectometry-context.ts";

type MeasurementFiles = {
  sampleR: File | null;
  sampleT: File | null;
  reflectanceReference: File | null;
  transmittanceReference: File | null;
  referenceReflectance: File | null;
};

const EMPTY_FILES: MeasurementFiles = {
  sampleR: null,
  sampleT: null,
  reflectanceReference: null,
  transmittanceReference: null,
  referenceReflectance: null,
};

function numberValue(event: unknown, data: { value?: string | number } | undefined) {
  const target = event && typeof event === "object" && "target" in event ? event.target : null;
  return Number(data?.value ?? (target instanceof HTMLInputElement ? target.value : undefined));
}

function channelCheck({
  available,
  evaluated,
  selected,
  count,
}: {
  available: boolean;
  evaluated: boolean;
  selected: boolean;
  count: number;
}) {
  if (!available) return { state: "not-run" as const, value: "Absent" };
  if (!selected) return { state: "not-run" as const, value: "Not selected" };
  if (!evaluated) return { state: "not-run" as const, value: "Not evaluated" };
  if (count < 10) return { state: "warning" as const, value: `${count} valid bins · insufficient (10 required)` };
  return { state: "passed" as const, value: `${count} valid bins` };
}

function FileControl({ id, label, file, onSelect }: { id: string; label: string; file: File | null; onSelect: (file: File | null) => void }) {
  const actionLabel = label.replace(" signal", "").replace(" table", "");
  return (
    <div className="measurement-file">
      <span className="measurement-file__label">{label}</span>
      <FileUploaderButton
        id={id}
        labelText={`${file ? "Replace" : "Choose"} ${actionLabel}`}
        accept={[".txt", "text/plain"]}
        buttonKind="tertiary"
        size="sm"
        onChange={(event: React.ChangeEvent<HTMLInputElement>) => onSelect(event.target.files?.[0] ?? null)}
      />
      <span className="measurement-file__name">{file?.name ?? "No file selected"}</span>
    </div>
  );
}

export default function MeasurementPanel({ advanced }: { advanced: boolean }) {
  const [state, actions] = useReflectometry();
  const [files, setFiles] = useState<MeasurementFiles>(EMPTY_FILES);
  const quality = state.sourceQuality;
  const setFile = (key: keyof MeasurementFiles, file: File | null) => setFiles((current) => ({ ...current, [key]: file }));
  const reflectance = channelCheck({ available: quality.reflectanceAvailable, evaluated: quality.evaluated, selected: state.controls.useReflectance, count: quality.reflectanceCount });
  const transmittance = channelCheck({ available: quality.transmittanceAvailable, evaluated: quality.evaluated, selected: state.controls.useTransmittance, count: quality.transmittanceCount });

  return <>
    <div className="configuration-summary">
      <span>Current source</span>
      <strong>{state.sourceLabel}</strong>
    </div>
    <ScientificPreflightSummary
      title="Data quality"
      description="Coverage and usable channels are checked before previewing or fitting the optical model."
      status={{ state: quality.ready ? "ready" : "needs-input", label: quality.ready ? "Data ready for model preview" : "Load measurement data" }}
      checks={[
        { id: "samples", label: "Spectral samples", state: quality.ready ? quality.pointCount >= 10 ? "passed" : "warning" : "not-run", value: quality.ready ? quality.pointCount : "—" },
        { id: "coverage", label: "Wavelength coverage", state: quality.ready && quality.wavelengthMaximumNm > quality.wavelengthMinimumNm ? "passed" : quality.ready ? "warning" : "not-run", value: quality.ready && quality.wavelengthMaximumNm > quality.wavelengthMinimumNm ? `${quality.wavelengthMinimumNm.toFixed(0)}–${quality.wavelengthMaximumNm.toFixed(0)} nm` : "Not available" },
        { id: "reflectance", label: "Reflectance channel", state: reflectance.state, value: reflectance.value },
        { id: "transmittance", label: "Transmittance channel", state: transmittance.state, value: transmittance.value },
      ]}
    />
    <Button className="full" kind="tertiary" type="button" disabled={state.operation.busy} onClick={actions.loadSyntheticExample}>{state.source?.type === "generated locally" ? "Reload synthetic example" : "Use synthetic example"}</Button>
    <Accordion className="configuration-accordion" size="sm" isFlush>
      <AccordionItem title="Open a saved fitting result">
        <div className="accordion-content">
          <FileUploaderButton
            id="saved-fit-file"
            labelText="Select saved fit JSON"
            accept={[".json", "application/json"]}
            buttonKind="tertiary"
            size="sm"
            onChange={(event: React.ChangeEvent<HTMLInputElement>) => {
              const file = event.target.files?.[0];
              if (file) void actions.loadSavedFit(file);
            }}
          />
          <p className="model-note">Current exports restore the measurement, complete stack, n,k tables, fitted values, bounds and fit controls.</p>
        </div>
      </AccordionItem>
      <AccordionItem title="Load measurement files">
        <div className="accordion-content">
          <TextInput id="sample-name" labelText="Sample name" maxLength={80} placeholder="My stack" value={state.controls.sampleName} onChange={(event) => actions.updateControl("sampleName", event.target.value)} />
          <div className="measurement-files">
            <FileControl id="file-sample-r" label="Sample R" file={files.sampleR} onSelect={(file) => setFile("sampleR", file)} />
            <FileControl id="file-sample-t" label="Sample T" file={files.sampleT} onSelect={(file) => setFile("sampleT", file)} />
            <FileControl id="file-r-reference" label="R reference signal" file={files.reflectanceReference} onSelect={(file) => setFile("reflectanceReference", file)} />
            <FileControl id="file-t-reference" label="T reference signal" file={files.transmittanceReference} onSelect={(file) => setFile("transmittanceReference", file)} />
            <FileControl id="file-reference-model" label="Reference R table" file={files.referenceReflectance} onSelect={(file) => setFile("referenceReflectance", file)} />
          </div>
          <Button className="full" kind="tertiary" type="button" disabled={state.operation.busy || Object.values(files).some((file) => !file)} onClick={() => void actions.loadLocalFiles(files)}>Process local files</Button>
          <p className="model-note">Signal files use wavelength (nm) and counts. Reference R and n,k tables accept wavelengths in nm or µm.</p>
        </div>
      </AccordionItem>
      {advanced && <AccordionItem title="Measurement processing" open>
        <div className="accordion-content">
          <div className="field-grid">
            <NumberInput id="wavelength-min" label="Minimum λ" helperText="nm" value={state.controls.wavelengthMinNm} min={195} max={2500} step={10} onChange={(event, data) => actions.updateControl("wavelengthMinNm", numberValue(event, data))} />
            <NumberInput id="wavelength-max" label="Maximum λ" helperText="nm" value={state.controls.wavelengthMaxNm} min={200} max={3000} step={10} onChange={(event, data) => actions.updateControl("wavelengthMaxNm", numberValue(event, data))} />
            <NumberInput id="reference-threshold" label="Reference threshold" helperText="%" value={state.controls.referenceThresholdPercent} min={0} max={99} step={1} onChange={(event, data) => actions.updateControl("referenceThresholdPercent", numberValue(event, data))} />
            <NumberInput id="bin-width" label="Median bin" helperText="nm" value={state.controls.binWidthNm} min={0.1} max={100} step={0.5} onChange={(event, data) => actions.updateControl("binWidthNm", numberValue(event, data))} />
            <NumberInput id="sample-snr" label="Minimum sample SNR" helperText="σ" value={state.controls.sampleSnrMinimum} min={0} max={100} step={0.5} onChange={(event, data) => actions.updateControl("sampleSnrMinimum", numberValue(event, data))} />
          </div>
          <Checkbox id="subtract-background" labelText="Subtract 195–250 nm background" checked={state.controls.subtractBackground} onChange={(_event, { checked }) => actions.updateControl("subtractBackground", checked)} />
        </div>
      </AccordionItem>}
    </Accordion>
  </>;
}
