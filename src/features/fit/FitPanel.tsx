import { Accordion, AccordionItem, Button, Checkbox, CheckboxGroup, NumberInput, Select, SelectItem } from "@carbon/react";
import { ArrowRight } from "@carbon/react/icons";
import { useReflectometry } from "../../app/reflectometry-context.ts";

function numberValue(event: unknown, data: { value?: string | number } | undefined) {
  const target = event && typeof event === "object" && "target" in event ? event.target : null;
  return Number(data?.value ?? (target instanceof HTMLInputElement ? target.value : undefined));
}

export default function FitPanel({ advanced, onRun }: { advanced: boolean; onRun?: () => void }) {
  const [state, actions] = useReflectometry();
  const controls = state.controls;
  const run = () => {
    actions.fit();
    onRun?.();
  };
  return <>
    <CheckboxGroup className="channel-row" legendText="Fit channels" orientation="vertical">
      <Checkbox id="use-r" labelText="Fit reflectance (R)" checked={controls.useReflectance} onChange={(_event, { checked }) => actions.updateControl("useReflectance", checked)} />
      <Checkbox id="use-t" labelText="Fit transmittance (T)" checked={controls.useTransmittance} onChange={(_event, { checked }) => actions.updateControl("useTransmittance", checked)} />
      <Checkbox id="prefer-shape" labelText="Prefer spectral shape" checked={controls.preferSpectralShape} onChange={(_event, { checked }) => actions.updateControl("preferSpectralShape", checked)} />
    </CheckboxGroup>
    {advanced && <Accordion className="configuration-accordion" size="sm" isFlush>
      <AccordionItem title="Weights, gains and optimizer" open>
        <div className="accordion-content">
          <div className="field-grid">
            <NumberInput id="sigma-r" label="σR" value={controls.sigmaReflectance} min={0.0001} max={1} step={0.005} onChange={(event, data) => actions.updateControl("sigmaReflectance", numberValue(event, data))} />
            <NumberInput id="sigma-t" label="σT" value={controls.sigmaTransmittance} min={0.0001} max={1} step={0.005} onChange={(event, data) => actions.updateControl("sigmaTransmittance", numberValue(event, data))} />
            <NumberInput id="sigma-n" label="σn" value={controls.sigmaN} min={0.0001} max={10} step={0.05} onChange={(event, data) => actions.updateControl("sigmaN", numberValue(event, data))} />
            <NumberInput id="sigma-k" label="σk" value={controls.sigmaK} min={0.0001} max={10} step={0.05} onChange={(event, data) => actions.updateControl("sigmaK", numberValue(event, data))} />
          </div>
          <div className="gain-grid">
            <Checkbox id="fit-r-gain" labelText="Fit R gain" checked={controls.fitReflectanceGain} onChange={(_event, { checked }) => actions.updateControl("fitReflectanceGain", checked)} />
            <NumberInput id="r-gain" label="R gain" value={controls.reflectanceGain} min={0.1} max={10} step={0.01} onChange={(event, data) => actions.updateControl("reflectanceGain", numberValue(event, data))} />
            <Checkbox id="fit-t-gain" labelText="Fit T gain" checked={controls.fitTransmittanceGain} onChange={(_event, { checked }) => actions.updateControl("fitTransmittanceGain", checked)} />
            <NumberInput id="t-gain" label="T gain" value={controls.transmittanceGain} min={0.1} max={10} step={0.01} onChange={(event, data) => actions.updateControl("transmittanceGain", numberValue(event, data))} />
          </div>
          <div className="field-grid">
            <Select id="screening-points" labelText="Sobol points" value={String(controls.screeningPoints)} onChange={(event) => actions.updateControl("screeningPoints", Number(event.target.value))}>
              {[64, 128, 256, 512, 1024, 2048].map((value) => <SelectItem key={value} value={String(value)} text={String(value)} />)}
            </Select>
            <NumberInput id="local-refinements" label="Local refinements" value={controls.localRefinements} min={1} max={50} step={1} onChange={(event, data) => actions.updateControl("localRefinements", numberValue(event, data))} />
            <Select id="bootstrap-samples" labelText="Bootstrap replicates" value={String(controls.bootstrapSamples)} onChange={(event) => actions.updateControl("bootstrapSamples", Number(event.target.value))}>
              <SelectItem value="20" text="20 · exploratory" />
              <SelectItem value="50" text="50 · exploratory" />
              <SelectItem value="100" text="100 · exploratory" />
              <SelectItem value="200" text="200 · reporting support" />
            </Select>
          </div>
          <Button className="full" kind="tertiary" type="button" disabled={!state.canBootstrap} onClick={actions.bootstrap}>Estimate bootstrap uncertainty</Button>
          <p className="model-note" aria-live="polite">{state.operation.busy ? "Complete or cancel the current calculation first." : !state.fitResult || state.fitResult.preview ? "Run fit to enable bootstrap uncertainty." : state.resultStale ? "Run fit again after the configuration change." : "Bootstrap uncertainty is available for the current fit."}</p>
        </div>
      </AccordionItem>
    </Accordion>}
    <p className={`fit-count${state.selectedFitCount > 11 ? " fit-count--warning" : ""}`}>{state.selectedFitCount} / 11 fitted parameters selected.</p>
    <Button className="full" kind="primary" renderIcon={ArrowRight} type="button" disabled={!state.canFit} onClick={run}>Run fit</Button>
  </>;
}
