import {
  Accordion,
  AccordionItem,
  Button,
  Checkbox,
  FileUploaderButton,
  IconButton,
  Modal,
  NumberInput,
  RadioButton,
  Select,
  SelectItem,
  TextInput,
  Toggletip,
  ToggletipButton,
  ToggletipContent,
} from "@carbon/react";
import { Add, ArrowDown, ArrowUp, Copy, Information, Redo, TrashCan, Undo } from "@carbon/react/icons";
import { useRef, useState } from "react";
import { useReflectometry } from "../../app/reflectometry-context.ts";
import { COMPONENT_GUIDES, EMA_RULE_GUIDES, MODEL_GUIDES, parameterDescription } from "./model-help.ts";
import { COMPONENT_LABELS, MULTILAYER_MODEL_LABELS, type OpticalMaterial } from "../../runtime/reflectometry-store.ts";
import type { ParameterSpecification } from "../../scientific/models/dielectric-models.ts";

function numberValue(event: unknown, data: { value?: string | number } | undefined) {
  const target = event && typeof event === "object" && "target" in event ? event.target : null;
  return Number(data?.value ?? (target instanceof HTMLInputElement ? target.value : undefined));
}

function MaterialFile({ id, label, actionLabel, source, onSelect }: { id: string; label: string; actionLabel: string; source: string | null; onSelect: (file: File) => void }) {
  return (
    <div className="material-file">
      <span className="material-file__label">{label}</span>
      <FileUploaderButton
        id={id}
        labelText={`${source ? "Replace" : "Choose"} ${actionLabel}`}
        accept={[".txt", "text/plain"]}
        buttonKind="tertiary"
        size="sm"
        onChange={(event: React.ChangeEvent<HTMLInputElement>) => {
          const file = event.target.files?.[0];
          if (file) onSelect(file);
        }}
      />
      <span className="material-file__source">{source ?? "No n,k table loaded."}</span>
    </div>
  );
}

type GuideEntry = {
  title?: string;
  summary?: string;
  equation: { label: string; mathml: string };
  represents: string;
  limitation?: string;
  references: Array<{ citation: string; doi: string }>;
};

function ModelGuide({ material }: { material: OpticalMaterial }) {
  const guide = MODEL_GUIDES[material.model];
  if (!guide) return null;
  const activeGuides: Array<[string, GuideEntry]> = [];
  if (material.model === "composite") {
    if (material.components.taucLorentz) activeGuides.push([`${material.components.taucLorentz} × Tauc–Lorentz`, COMPONENT_GUIDES.taucLorentz]);
    if (material.components.lorentz) activeGuides.push([`${material.components.lorentz} × Lorentz`, COMPONENT_GUIDES.lorentz]);
    for (const component of Object.keys(COMPONENT_LABELS) as Array<keyof typeof COMPONENT_LABELS>) if (material.components[component]) activeGuides.push([COMPONENT_LABELS[component], COMPONENT_GUIDES[component]]);
  } else if (material.model === "ema") {
    activeGuides.push([EMA_RULE_GUIDES[material.ema.method].title, EMA_RULE_GUIDES[material.ema.method]]);
  }
  const references = [guide, ...activeGuides.map(([, item]) => item)].flatMap((item) => item.references ?? []);
  const uniqueReferences = [...new Map(references.map((item) => [item.doi.toLowerCase(), item])).values()];

  return (
    <Accordion className="model-guide" size="sm" isFlush>
      <AccordionItem title={`Model guide · ${Object.hasOwn(MULTILAYER_MODEL_LABELS, material.model) ? MULTILAYER_MODEL_LABELS[material.model as keyof typeof MULTILAYER_MODEL_LABELS] : material.model}`}>
        <div className="model-guide__body">
          <p>{guide.summary}</p>
          <div className="scientific-equation" dangerouslySetInnerHTML={{ __html: `<math xmlns="http://www.w3.org/1998/Math/MathML" display="block" aria-label="${guide.equation.label}">${guide.equation.mathml}</math>` }} />
          <dl>
            <dt>Typically represents</dt><dd>{guide.represents}</dd>
            <dt>Scope / limitation</dt><dd>{guide.limitation}</dd>
          </dl>
          {activeGuides.length > 0 && <>
            <h4>Active contributions</h4>
            {activeGuides.map(([title, item]) => <section className="model-guide__component" key={title}>
              <h5>{title}</h5>
              <p>{item.summary ?? item.represents}</p>
              <div className="scientific-equation" dangerouslySetInnerHTML={{ __html: `<math xmlns="http://www.w3.org/1998/Math/MathML" display="block" aria-label="${item.equation.label}">${item.equation.mathml}</math>` }} />
            </section>)}
          </>}
          <h4>Parameters in this material</h4>
          <dl>{Object.entries(material.specs).flatMap(([name, specification]) => [
            <dt key={`${name}-term`}>{specification.label}{specification.unit ? ` (${specification.unit})` : ""}</dt>,
            <dd key={`${name}-definition`}>{parameterDescription(name)}</dd>,
          ])}</dl>
          <h4>References</h4>
          <ul>{uniqueReferences.map((item) => <li key={item.doi}>{item.citation} <a href={`https://doi.org/${item.doi}`} target="_blank" rel="noreferrer">{item.doi}</a></li>)}</ul>
          <p className="model-note">Notation: E = hc/λ in eV; N = n + ik; ε = N². Equations follow the implementation used by this tool.</p>
        </div>
      </AccordionItem>
    </Accordion>
  );
}

function ComponentEditor({ material }: { material: OpticalMaterial }) {
  const [, actions] = useReflectometry();
  if (material.model !== "composite") return null;
  return (
    <fieldset className="component-editor">
      <legend>Additive dielectric components</legend>
      <div className="component-editor__counts">
        {(["taucLorentz", "lorentz"] as const).map((component) => <Select
          key={component}
          id={`${material.id}-${component}`}
          labelText={component === "taucLorentz" ? "Tauc–Lorentz oscillators" : "Lorentz oscillators"}
          value={String(material.components[component])}
          onChange={(event) => actions.updateComponentCount(material.id, component, Number(event.target.value))}
        >
          {[0, 1, 2, 3, 4, 5].map((count) => <SelectItem key={count} value={String(count)} text={String(count)} />)}
        </Select>)}
      </div>
      <div className="component-editor__checks">
        {Object.entries(COMPONENT_LABELS).map(([component, label]) => <Checkbox
          key={component}
          id={`${material.id}-${component}`}
          labelText={label}
          checked={Boolean(material.components[component])}
          onChange={(_event, { checked }) => actions.toggleComponent(material.id, component, checked)}
        />)}
      </div>
    </fieldset>
  );
}

function EmaEditor({ material }: { material: OpticalMaterial }) {
  const [, actions] = useReflectometry();
  if (material.model !== "ema") return null;
  return (
    <fieldset className="component-editor">
      <legend>Effective-medium constituents</legend>
      <Select id={`${material.id}-ema-method`} labelText="Mixing rule" value={material.ema.method} onChange={(event) => actions.updateEmaMethod(material.id, event.target.value)}>
        <SelectItem value="bruggeman" text="Bruggeman (symmetric)" />
        <SelectItem value="maxwell-garnett" text="Maxwell–Garnett (inclusions in host)" />
      </Select>
      <MaterialFile id={`${material.id}-ema-host`} label="Host n,k table" actionLabel="host n,k" source={material.ema.hostSource} onSelect={(file) => void actions.loadMaterialTable(material.id, "host", file)} />
      <MaterialFile id={`${material.id}-ema-inclusion`} label="Inclusion n,k table" actionLabel="inclusion n,k" source={material.ema.inclusionSource} onSelect={(file) => void actions.loadMaterialTable(material.id, "inclusion", file)} />
    </fieldset>
  );
}

function ParameterRow({ material, name, specification, advanced }: { material: OpticalMaterial; name: string; specification: ParameterSpecification; advanced: boolean }) {
  const [state, actions] = useReflectometry();
  const linkedSource = material.links?.[name] ?? "";
  const candidates = material.id === "substrate" ? [] : state.layers.slice(0, state.layers.findIndex((layer) => layer.id === material.id)).filter((candidate) => candidate.specs[name]);
  return (
    <div className={`parameter-row${linkedSource ? " parameter-row--linked" : ""}`}>
      <Checkbox
        id={`${material.id}-${name}-fit`}
        className="parameter-row__fit"
        labelText="Fit"
        checked={Boolean(specification.fit)}
        disabled={Boolean(linkedSource)}
        onChange={(_event, { checked }) => actions.updateParameter(material.id, name, "fit", checked)}
      />
      <div className="parameter-row__identity">
        <span>{specification.label}{specification.unit ? <small>{specification.unit}</small> : null}</span>
        <Toggletip align="bottom-left">
          <ToggletipButton label={`Information for ${specification.label}`}><Information size={16} /></ToggletipButton>
          <ToggletipContent><p>{parameterDescription(name)}</p></ToggletipContent>
        </Toggletip>
        {advanced && candidates.length > 0 && <Select
          id={`${material.id}-${name}-link`}
          labelText={`Link ${specification.label}`}
          hideLabel
          size="sm"
          value={linkedSource}
          onChange={(event) => actions.linkParameter(material.id, name, event.target.value)}
        >
          <SelectItem value="" text="Independent" />
          {candidates.map((candidate) => <SelectItem key={candidate.id} value={`${candidate.id}__${name}`} text={`Link to ${candidate.name}`} />)}
        </Select>}
      </div>
      {(["value", ...(advanced ? ["minimum", "maximum"] as const : [])] as const).map((kind) => <NumberInput
        key={kind}
        id={`${material.id}-${name}-${kind}`}
        className={`parameter-row__${kind}`}
        label={`${kind === "value" ? "Value" : kind === "minimum" ? "Minimum" : "Maximum"} ${material.name} ${specification.label}`}
        hideLabel
        size="sm"
        step={0.001}
        value={specification[kind]}
        disabled={Boolean(linkedSource)}
        onChange={(event, data) => actions.updateParameter(material.id, name, kind, numberValue(event, data))}
      />)}
      {advanced && <div className="parameter-row__uncertainty"><span>1σ</span><strong>{specification.uncertainty ?? "—"}</strong></div>}
    </div>
  );
}

function MaterialCard({ material, index, substrate = false, advanced, onRequestRemove }: { material: OpticalMaterial; index: number; substrate?: boolean; advanced: boolean; onRequestRemove: (material: OpticalMaterial, trigger: HTMLElement) => void }) {
  const [state, actions] = useReflectometry();
  return (
    <article className={`material-card${substrate ? " material-card--substrate" : ""}`} aria-labelledby={`${material.id}-title`}>
      <div className="material-card__header">
        <span className="material-card__order" aria-hidden="true">{substrate ? "S" : String(index + 1).padStart(2, "0")}</span>
        <TextInput
          id={`${material.id}-name`}
          labelText={substrate ? "Substrate name" : `Layer ${index + 1} name`}
          hideLabel
          value={material.name}
          disabled={substrate}
          maxLength={60}
          onChange={(event) => actions.updateMaterialName(material.id, event.target.value)}
        />
        <h3 id={`${material.id}-title`} className="visually-hidden">{material.name}</h3>
        {!substrate && <div className="material-card__actions">
          <IconButton label={`Move up ${material.name}`} kind="ghost" size="sm" disabled={index === 0 || state.operation.busy} onClick={() => actions.moveLayer(material.id, -1)}><ArrowUp /></IconButton>
          <IconButton label={`Move down ${material.name}`} kind="ghost" size="sm" disabled={index === state.layers.length - 1 || state.operation.busy} onClick={() => actions.moveLayer(material.id, 1)}><ArrowDown /></IconButton>
          <IconButton label={`Duplicate ${material.name}`} kind="ghost" size="sm" disabled={state.layers.length >= 12 || state.operation.busy} onClick={() => actions.duplicateLayer(material.id)}><Copy /></IconButton>
          <IconButton label={`Remove ${material.name}`} kind="ghost" size="sm" disabled={state.layers.length === 1 || state.operation.busy} onClick={(event) => onRequestRemove(material, event.currentTarget)}><TrashCan /></IconButton>
        </div>}
      </div>
      <Accordion className="material-card__editor" size="sm" isFlush>
        <AccordionItem title={substrate ? "Edit substrate model" : "Edit optical model and fit parameters"} open={!substrate && material.id === state.activeLayerId}>
          <div className="material-editor">
            <Select id={`${material.id}-model`} labelText="Optical model" value={material.model} onChange={(event) => actions.updateMaterialModel(material.id, event.target.value)}>
              {Object.entries(MULTILAYER_MODEL_LABELS).map(([value, text]) => <SelectItem key={value} value={value} text={text} />)}
            </Select>
            {advanced && <ModelGuide material={material} />}
            <ComponentEditor material={material} />
            <EmaEditor material={material} />
            {material.model !== "ema" && <MaterialFile id={`${material.id}-nk-file`} label={`${substrate ? "Substrate" : "Layer"} n,k table`} actionLabel={`${substrate ? "substrate" : "layer"} n,k`} source={material.nkSource} onSelect={(file) => void actions.loadMaterialTable(material.id, "nk", file)} />}
            <div className="material-editor__flags">
              {!substrate && <RadioButton id={`${material.id}-active`} name="active-layer" value={material.id} labelText="Active n,k plot" checked={state.activeLayerId === material.id} onChange={() => actions.setActiveLayer(material.id)} />}
              {advanced && <Checkbox id={`${material.id}-regularize`} labelText="Regularize to n,k" checked={Boolean(material.regularize)} disabled={!material.nk || material.model === "fixed" || material.model === "ema"} onChange={(_event, { checked }) => actions.setMaterialRegularization(material.id, checked)} />}
            </div>
            <div className="parameter-table" role="group" aria-label={`${material.name} parameters`}>
              <div className={`parameter-table__head${advanced ? "" : " parameter-table__head--basic"}`} aria-hidden="true"><span>Fit</span><span>Parameter</span><span>Value</span>{advanced && <><span>Min</span><span>Max</span><span>1σ</span></>}</div>
              {Object.entries(material.specs).map(([name, specification]) => <ParameterRow key={name} material={material} name={name} specification={specification} advanced={advanced} />)}
            </div>
          </div>
        </AccordionItem>
      </Accordion>
    </article>
  );
}

export default function LayerStackEditor({ advanced }: { advanced: boolean }) {
  const [state, actions] = useReflectometry();
  const [removeCandidate, setRemoveCandidate] = useState<OpticalMaterial | null>(null);
  const removeTriggerRef = useRef<HTMLElement | null>(null);
  const addLayerButtonRef = useRef<HTMLButtonElement | null>(null);
  const requestRemove = (material: OpticalMaterial, trigger: HTMLElement) => {
    removeTriggerRef.current = trigger;
    setRemoveCandidate(material);
  };
  return <>
    <div className="stack-editor__scope">
      <NumberInput id="substrate-thickness" label="Substrate thickness" helperText="micrometres (µm)" value={state.controls.substrateThicknessUm} min={10} max={1000000} step={1} onChange={(event, data) => actions.updateControl("substrateThicknessUm", numberValue(event, data))} />
      <Select id="incidence" labelText="Incidence" value={state.controls.incidence} onChange={(event) => actions.updateControl("incidence", event.target.value as "film" | "substrate")}><SelectItem value="film" text="Stack side" /><SelectItem value="substrate" text="Substrate side" /></Select>
    </div>
    <div className="layer-list">{state.layers.map((layer, index) => <MaterialCard key={layer.id} material={layer} index={index} advanced={advanced} onRequestRemove={requestRemove} />)}</div>
    <div className="stack-toolbar">
      <Button kind="ghost" renderIcon={Undo} type="button" disabled={!state.canUndo} onClick={actions.undo}>Undo</Button>
      <Button kind="ghost" renderIcon={Redo} type="button" disabled={!state.canRedo} onClick={actions.redo}>Redo</Button>
      <Button ref={addLayerButtonRef} kind="tertiary" renderIcon={Add} type="button" disabled={state.layers.length >= 12 || state.operation.busy} onClick={actions.addLayer}>Add layer</Button>
    </div>
    <div className="stack-editor__substrate-heading"><span>S</span><div><p>Substrate</p><h3>Dispersive substrate</h3></div></div>
    <MaterialCard material={state.substrate} index={0} substrate advanced={advanced} onRequestRemove={requestRemove} />
    <Modal
      open={Boolean(removeCandidate)}
      launcherButtonRef={removeTriggerRef}
      danger
      modalHeading={`Remove ${removeCandidate?.name ?? "layer"}?`}
      primaryButtonText="Remove layer"
      secondaryButtonText="Cancel"
      onRequestClose={() => setRemoveCandidate(null)}
      onRequestSubmit={() => {
        if (removeCandidate) actions.removeLayer(removeCandidate.id);
        removeTriggerRef.current = addLayerButtonRef.current;
        setRemoveCandidate(null);
      }}
    >
      <p>The remaining layers keep their current order and parameters. You can undo this change afterwards.</p>
    </Modal>
  </>;
}
