import { Accordion, AccordionItem, Button, Checkbox, CheckboxGroup, Column, ContentSwitcher, FileUploaderButton, Grid, NumberInput, Select, SelectItem, Switch, Tab, TabList, TabPanel, TabPanels, Tabs, TextInput } from "@carbon/react";
import { Add, ArrowRight, Redo, Renew, Undo } from "@carbon/react/icons";
import PlotCard from "../../shared/plots/PlotCard.tsx";
import { useEffect, useRef, useState } from "react";
import ResultsEmpty from "../results/ResultsEmpty.tsx";
import ResultsStatusBar from "../results/ResultsStatusBar.tsx";
import WorkspaceNavigation, { type WorkflowSection } from "../../shared/carbon/WorkspaceNavigation.tsx";
import { ScientificTaskPanel } from "@jorpago2/scientific-ui";

type FileControlProps = { id: string; fieldLabel: string; label: string; accept: string[] };
type ConfigurationMode = "basic" | "advanced";
type ConfigurationModeControlProps = { mode: ConfigurationMode; onChange: (mode: ConfigurationMode) => void };

const OVERLAY_LAYOUT_QUERY = "(max-width: 65.98rem)";

const PANEL_COPY: Record<WorkflowSection, { title: string; description: string }> = {
  measurement: { title: "Measurement", description: "Choose the data source and processing." },
  layers: { title: "Layer stack", description: "Geometry, optical models and substrate." },
  fit: { title: "Fit", description: "Channels, optimizer and uncertainty." },
};

function FileControl({ id, fieldLabel, label, accept }: FileControlProps) {
  return <div className="file-control"><span className="file-control-label">{fieldLabel}</span><FileUploaderButton id={id} labelText={label} accept={accept} buttonKind="tertiary" size="sm" data-file-input={id} /></div>;
}

function ConfigurationModeControl({ mode, onChange }: ConfigurationModeControlProps) {
  return <div className="configuration-mode"><span>Configuration detail</span><ContentSwitcher aria-label="Configuration detail" selectedIndex={mode === "basic" ? 0 : 1} size="sm" onChange={({ name }) => onChange(name === "advanced" ? "advanced" : "basic")}><Switch name="basic" text="Basic" /><Switch name="advanced" text="Advanced" /></ContentSwitcher><p>{mode === "basic" ? "Core workflow and parameter values." : "Bounds, model guidance, optimizer and uncertainty controls."}</p></div>;
}

export default function WorkspaceView() {
  const [activeSection, setActiveSection] = useState<WorkflowSection | null>(null);
  const [configurationMode, setConfigurationMode] = useState<ConfigurationMode>("basic");
  const [isOverlayLayout, setIsOverlayLayout] = useState(() => typeof window !== "undefined" && window.matchMedia(OVERLAY_LAYOUT_QUERY).matches);
  const panelRef = useRef<HTMLElement>(null);
  const overlayPanelOpen = Boolean(activeSection && isOverlayLayout);
  const panelCopy = activeSection ? PANEL_COPY[activeSection] : PANEL_COPY.measurement;
  const closePanel = () => {
    const trigger = activeSection;
    setActiveSection(null);
    if (trigger) window.requestAnimationFrame(() => document.getElementById(`workflow-${trigger}`)?.focus());
  };
  const togglePanel = (section: WorkflowSection) => {
    const opening = activeSection !== section;
    setActiveSection(opening ? section : null);
    window.requestAnimationFrame(() => {
      if (opening) {
        panelRef.current?.scrollTo({ top: 0 });
        if (isOverlayLayout) document.getElementById(`configuration-panel-title-${section}`)?.focus();
      }
      window.dispatchEvent(new Event("resize"));
    });
  };
  const runFitFromPanel = () => {
    document.getElementById("fit-button")?.click();
    if (isOverlayLayout) closePanel();
  };
  useEffect(() => {
    const query = window.matchMedia(OVERLAY_LAYOUT_QUERY);
    const updateLayout = () => setIsOverlayLayout(query.matches);
    updateLayout();
    query.addEventListener("change", updateLayout);
    return () => query.removeEventListener("change", updateLayout);
  }, []);
  useEffect(() => {
    if (!overlayPanelOpen || panelRef.current?.contains(document.activeElement)) return;
    window.requestAnimationFrame(() => document.getElementById(`configuration-panel-title-${activeSection}`)?.focus());
  }, [activeSection, overlayPanelOpen]);
  useEffect(() => {
    if (!activeSection) return;
    const handleEscape = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.key !== "Escape") return;
      event.preventDefault();
      const trigger = activeSection;
      setActiveSection(null);
      window.requestAnimationFrame(() => document.getElementById(`workflow-${trigger}`)?.focus());
    };
    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [activeSection]);
  return (
    <>
      <h1 className="visually-hidden">Reflectometry</h1>
      <Grid id="reflectometry-workspace" className="workspace multilayer-workspace" fullWidth condensed tabIndex={-1}>
        <Column className="workbench-column" sm={4} md={8} lg={16} xlg={16} max={16}>
          <div className="workbench-shell" data-panel-open={Boolean(activeSection)}>
            <WorkspaceNavigation activeSection={activeSection} onToggle={togglePanel} />
            <ScientificTaskPanel
              ref={panelRef}
              id="configuration-panel"
              className="controls"
              title={panelCopy.title}
              titleId={activeSection ? `configuration-panel-title-${activeSection}` : undefined}
              eyebrow={panelCopy.description}
              onClose={closePanel}
              closeLabel="Close"
              bodyClassName="configuration-tabs"
              data-configuration-mode={configurationMode}
              hidden={!activeSection}
            >
                <section className="configuration-panel" hidden={activeSection !== "measurement"}>
              <ConfigurationModeControl mode={configurationMode} onChange={setConfigurationMode} />
              <h3 className="section-label">Data source</h3>
              <p id="source-name" className="source-name">No measurement loaded</p>
              <Button id="reset-example" className="full" kind="tertiary" type="button">Use synthetic example</Button>
              <Accordion className="configuration-accordion" size="sm" isFlush>
                <AccordionItem title="Open a saved fitting result">
                  <div className="accordion-content">
                    <FileControl id="saved-fit-file" fieldLabel="Saved fit" label="Select saved fit JSON" accept={[".json", "application/json"]} />
                    <p className="model-note">Current exports restore the measurement, complete stack, n,k tables, fitted values, bounds, and fit controls. Older exports restore the configuration available in those files.</p>
                  </div>
                </AccordionItem>
                <AccordionItem title="Load measurement files">
                  <div className="accordion-content">
                    <div className="file-grid">
                      <TextInput id="sample-name" labelText="Sample name" maxLength={80} placeholder="My stack" />
                      <FileControl id="file-sample-r" fieldLabel="Sample R" label="Select sample R" accept={[".txt", "text/plain"]} />
                      <FileControl id="file-sample-t" fieldLabel="Sample T" label="Select sample T" accept={[".txt", "text/plain"]} />
                      <FileControl id="file-r-reference" fieldLabel="R reference signal" label="Select R reference signal" accept={[".txt", "text/plain"]} />
                      <FileControl id="file-t-reference" fieldLabel="T reference signal" label="Select T reference signal" accept={[".txt", "text/plain"]} />
                      <FileControl id="file-reference-model" fieldLabel="Reference R table" label="Select reference R table" accept={[".txt", "text/plain"]} />
                    </div>
                    <Button id="load-files" className="full" kind="tertiary" type="button">Process local files</Button>
                    <p className="model-note">Signal files use wavelength (nm) and counts. The reference R and layer n,k tables accept wavelength in nm or µm.</p>
                  </div>
                </AccordionItem>
                <AccordionItem className="advanced-only" title="Measurement processing">
                  <div className="accordion-content">
                    <div className="field-pair">
                      <NumberInput id="wavelength-min" label="Minimum λ" helperText="nm" defaultValue={300} min={195} max={2500} step={10} />
                      <NumberInput id="wavelength-max" label="Maximum λ" helperText="nm" defaultValue={1100} min={200} max={3000} step={10} />
                      <NumberInput id="reference-threshold" label="Reference threshold" helperText="%" defaultValue={5} min={0} max={99} step={1} />
                      <NumberInput id="bin-width" label="Median bin" helperText="nm" defaultValue={2} min={0.1} max={100} step={0.5} />
                    </div>
                    <NumberInput id="sample-snr" label="Minimum sample SNR" helperText="σ" defaultValue={5} min={0} max={100} step={0.5} />
                    <Checkbox id="subtract-background" labelText="Subtract 195–250 nm background" defaultChecked />
                  </div>
                </AccordionItem>
              </Accordion>
                </section>

                <section className="configuration-panel" hidden={activeSection !== "layers"}>
              <ConfigurationModeControl mode={configurationMode} onChange={setConfigurationMode} />
              <Accordion className="configuration-accordion stack-scope advanced-only" size="sm" isFlush>
                <AccordionItem title="Model assumptions"><p className="model-note">Order: incident medium at the top, substrate at the bottom. Layers are coherent; substrate propagation is phase-incoherent and includes absorption. Enter substrate thickness in µm; it must be at least 10× the maximum fitted wavelength.</p></AccordionItem>
              </Accordion>
              <div className="field-pair compact-pair">
                <NumberInput id="substrate-thickness" label="Substrate thickness" helperText="micrometres (µm)" defaultValue={1000} min={10} max={1000000} step={1} />
                <Select id="incidence" labelText="Incidence" defaultValue="film"><SelectItem value="film" text="Stack side" /><SelectItem value="substrate" text="Substrate side" /></Select>
              </div>
              <div id="layers" className="layer-list" />
              <div className="stack-toolbar">
                <Button id="undo-button" kind="ghost" renderIcon={Undo} type="button" disabled aria-label="Undo stack edit">Undo</Button>
                <Button id="redo-button" kind="ghost" renderIcon={Redo} type="button" disabled aria-label="Redo stack edit">Redo</Button>
                <Button id="add-layer" kind="tertiary" renderIcon={Add} type="button">Add layer</Button>
              </div>
              <div className="section-heading substrate-heading"><span>S</span><h3>Dispersive substrate</h3></div>
              <div id="substrate-editor" />
                </section>

                <section className="configuration-panel" hidden={activeSection !== "fit"}>
              <ConfigurationModeControl mode={configurationMode} onChange={setConfigurationMode} />
              <CheckboxGroup className="channel-row" legendText="Fit channels" orientation="vertical">
                <Checkbox id="use-r" labelText="Fit R" defaultChecked />
                <Checkbox id="use-t" labelText="Fit T" defaultChecked />
                <Checkbox id="prefer-shape" labelText="Shape residual" defaultChecked />
              </CheckboxGroup>
              <Accordion className="configuration-accordion advanced-controls" size="sm" isFlush>
                <AccordionItem title="Weights and optimizer">
                  <div className="accordion-content">
                    <div className="field-pair">
                      <NumberInput id="sigma-r" label="σR" defaultValue={0.02} min={0.0001} max={1} step={0.005} />
                      <NumberInput id="sigma-t" label="σT" defaultValue={0.02} min={0.0001} max={1} step={0.005} />
                      <NumberInput id="sigma-n" label="σn" defaultValue={0.5} min={0.0001} max={10} step={0.05} />
                      <NumberInput id="sigma-k" label="σk" defaultValue={0.25} min={0.0001} max={10} step={0.05} />
                    </div>
                    <div className="global-parameter-grid">
                      <Checkbox id="fit-r-gain" labelText="Fit R gain" />
                      <NumberInput id="r-gain" label="R gain" defaultValue={1} min={0.1} max={10} step={0.01} />
                      <Checkbox id="fit-t-gain" labelText="Fit T gain" />
                      <NumberInput id="t-gain" label="T gain" defaultValue={1} min={0.1} max={10} step={0.01} />
                    </div>
                    <div className="field-pair">
                      <Select id="screening-points" labelText="Sobol points" defaultValue="512">
                        {[64, 128, 256, 512, 1024, 2048].map((value) => <SelectItem key={value} value={String(value)} text={String(value)} />)}
                      </Select>
                      <NumberInput id="local-refinements" label="Local refinements" defaultValue={16} min={1} max={50} step={1} />
                      <Select id="bootstrap-samples" labelText="Bootstrap replicates" defaultValue="20">
                        {[20, 50, 100].map((value) => <SelectItem key={value} value={String(value)} text={String(value)} />)}
                      </Select>
                    </div>
                    <Button id="bootstrap-button" className="full" kind="tertiary" type="button" aria-describedby="bootstrap-prerequisite" disabled>Estimate bootstrap uncertainty</Button>
                    <p id="bootstrap-prerequisite" className="model-note" aria-live="polite">Run fit to enable bootstrap uncertainty.</p>
                  </div>
                </AccordionItem>
              </Accordion>
              <p id="fit-count" className="model-note">0 / 11 fitted parameters selected.</p>
              <Button id="fit-panel-button" className="full fit-panel-action" kind="primary" renderIcon={ArrowRight} type="button" onClick={runFitFromPanel}>Run fit</Button>
                </section>
            </ScientificTaskPanel>

            <section id="results-panel" className="results scientific-stage" aria-label="Fit results" aria-hidden={overlayPanelOpen || undefined} inert={overlayPanelOpen}>
            <ResultsEmpty />
            <div id="results-content" hidden>
            <div className="actions result-actions"><Button id="preview-button" kind="tertiary" renderIcon={Renew} type="button">Preview model</Button><Button id="fit-button" kind="primary" renderIcon={ArrowRight} type="button">Run fit</Button></div>
            <div className="results-tabs">
            <Tabs onChange={() => window.requestAnimationFrame(() => {
              document.getElementById("results-content")?.scrollTo({ top: 0 });
              window.dispatchEvent(new Event("resize"));
            })}>
              <TabList contained className="results-tab-list" aria-label="Result views">
                <Tab className="results-tab">Overview</Tab>
                <Tab className="results-tab">Fit quality</Tab>
                <Tab className="results-tab">Optical n,k</Tab>
              </TabList>
              <TabPanels>
                <TabPanel className="results-tab-panel overview-panel">
                  <PlotCard title="Reflectance and transmittance" canvasId="rt-chart" label="Interactive reflectance and transmittance spectra" legend={[{ className: "r-data", text: "R data" }, { className: "r-model", text: "R model" }, { className: "t-data", text: "T data" }, { className: "t-model", text: "T model" }]} />
                  <section className="stack-card" aria-labelledby="stack-title">
                    <div className="plot-heading"><div><h2 id="stack-title">Layer stack</h2></div></div>
                    <figure className="stack-figure">
                      <div className="stack-beam"><span id="stack-direction">INCIDENT / STACK SIDE</span><strong id="stack-arrow" aria-hidden="true">↓</strong><small>LIGHT</small></div>
                      <div id="stack-diagram" className="stack-diagram">
                        <div className="stack-medium stack-air"><strong>Ambient</strong><span>air · n = 1.000</span></div>
                        <ol id="stack-layers" className="stack-layers" />
                        <div className="stack-medium stack-substrate"><strong>Substrate</strong><span id="stack-substrate-index" /></div>
                      </div>
                      <figcaption>Schematic view · layer thicknesses are labelled, not drawn to scale.</figcaption>
                    </figure>
                  </section>
                </TabPanel>
                <TabPanel className="results-tab-panel">
                  <div className="metrics">
                    <article><span>TOTAL THICKNESS</span><strong id="metric-thickness">—</strong><small>nm</small></article>
                    <article><span>RMSE(R)</span><strong id="metric-rmse-r">—</strong><small>fraction</small></article>
                    <article><span>RMSE(T)</span><strong id="metric-rmse-t">—</strong><small>fraction</small></article>
                    <article><span>FIT PARAMETERS</span><strong id="metric-parameters">—</strong><small>selected</small></article>
                  </div>
                  <Accordion className="result-details report-details" size="sm"><AccordionItem title="Report information"><p id="report-meta" className="report-meta" /></AccordionItem></Accordion>
                  <section className="diagnostics">
                    <div className="plot-heading"><div><p>FIT HEALTH</p><h2>Diagnostics</h2></div></div>
                    <div className="diagnostic-grid">
                      <article><span>CONVERGENCE</span><strong id="diagnostic-convergence">Preview</strong><small id="diagnostic-evaluations">No optimizer run</small></article>
                      <article><span>JACOBIAN CONDITION</span><strong id="diagnostic-condition">—</strong><small>large means non-identifiable</small></article>
                      <article><span>BOUND HITS</span><strong id="diagnostic-bounds">—</strong><small>fitted parameters</small></article>
                      <article><span>MAX R + T</span><strong id="diagnostic-power">—</strong><small>physical model</small></article>
                    </div>
                    <p id="diagnostic-note">Preview the stack before fitting. Multilayer inverse problems can have several nearly equivalent solutions.</p>
                    <Accordion className="result-details" size="sm">
                      <AccordionItem title="Parameter uncertainty and correlation"><div id="uncertainty-panel"><div id="uncertainty-content" className="result-panel-content" tabIndex={0} aria-label="Parameter uncertainty and correlation tables"><p>Run a fit to estimate local uncertainty, then optionally run the residual bootstrap.</p></div></div></AccordionItem>
                      <AccordionItem title="Alternative fitted solutions"><div id="solutions-panel"><div id="solutions-content" className="result-panel-content"><p>No fitted alternatives yet.</p></div></div></AccordionItem>
                    </Accordion>
                  </section>
                  <PlotCard title="Spectral residuals" canvasId="residual-chart" label="Interactive spectral residuals" legend={[{ className: "r-model", text: "R residual" }, { className: "t-model", text: "T residual" }]} />
                </TabPanel>
                <TabPanel className="results-tab-panel">
                  <PlotCard eyebrow="Active layer" eyebrowId="nk-layer-label" title="Complex refractive index" canvasId="nk-chart" label="Interactive active-layer refractive index" legend={[{ className: "n-line", text: "n" }, { className: "k-line", text: "k" }]} />
                  <section className="provenance"><Accordion size="sm"><AccordionItem title="Model assumptions and scope"><p>Normal incidence; homogeneous isotropic coherent layers; finite phase-incoherent dispersive substrate with Beer–Lambert attenuation and incoherent rear-surface returns. Cauchy–Urbach is phenomenological, Sellmeier assumes transparency, EMA assumes subwavelength isotropic constituents, and the five-knot KK spline is bandwidth limited. Residual bootstrap intervals assume exchangeable spectral residuals and local refits near the selected minimum. Surface roughness, gradients, anisotropy, scattering, and oblique incidence are not included.</p></AccordionItem></Accordion></section>
                </TabPanel>
              </TabPanels>
            </Tabs>
            </div>
            </div>
            <div className="results-context">
              <ResultsStatusBar />
            </div>
            </section>
          </div>
        </Column>
      </Grid>
    </>
  );
}
