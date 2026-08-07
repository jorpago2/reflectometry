import { Button, Column, Grid, Tab, TabList, TabPanel, TabPanels, Tabs } from "@carbon/react";
import { Add, ArrowRight, Redo, Renew, Undo } from "@carbon/react/icons";
import PlotCard from "../../shared/plots/PlotCard.tsx";
import { useEffect, useState } from "react";
import ResultsEmpty from "../results/ResultsEmpty.tsx";
import ResultsStatusBar from "../results/ResultsStatusBar.tsx";
import WorkspaceNavigation, { type WorkflowSection } from "../../shared/carbon/WorkspaceNavigation.tsx";

type PanelHeadingProps = { title: string; description: string; onClose: () => void };

function PanelHeading({ title, description, onClose }: PanelHeadingProps) {
  return <header className="configuration-panel-heading"><div><h2>{title}</h2><p>{description}</p></div><Button kind="ghost" size="sm" type="button" onClick={onClose}>Close</Button></header>;
}

export default function WorkspaceView() {
  const [activeSection, setActiveSection] = useState<WorkflowSection | null>(null);
  const [sampleName, setSampleName] = useState("");
  const [wavelengthRange, setWavelengthRange] = useState({ min: "300", max: "1100" });
  const [measurementProcessing, setMeasurementProcessing] = useState({ threshold: "5", bin: "2", snr: "5", subtractBackground: true });
  const [fitChannels, setFitChannels] = useState({ reflectance: true, transmittance: true, shape: true });
  const closePanel = () => {
    const trigger = activeSection;
    setActiveSection(null);
    if (trigger) window.requestAnimationFrame(() => document.getElementById(`workflow-${trigger}`)?.focus());
  };
  const togglePanel = (section: WorkflowSection) => {
    setActiveSection((current) => current === section ? null : section);
    window.requestAnimationFrame(() => window.dispatchEvent(new Event("resize")));
  };
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
            <aside id="configuration-panel" className="controls" aria-label="Data, stack, and fit controls" hidden={!activeSection}>
              <div className="configuration-tabs">
                <section className="configuration-panel" hidden={activeSection !== "measurement"}>
              <PanelHeading title="Measurement" description="Choose the data source and processing." onClose={closePanel} />
              <h3 className="section-label">Data source</h3>
              <p id="source-name" className="source-name">No measurement loaded</p>
              <Button id="reset-example" className="full" kind="tertiary" type="button">Use synthetic example</Button>
              <details>
                <summary>Open a saved fitting result</summary>
                <label>Saved fit JSON<input id="saved-fit-file" type="file" accept=".json,application/json" /></label>
                <p className="model-note">Current exports restore the measurement, complete stack, n,k tables, fitted values, bounds, and fit controls. Older exports restore the configuration available in those files.</p>
              </details>
              <details>
                <summary>Load measurement files</summary>
                <div className="file-grid">
                  <label>Sample name<input id="sample-name" type="text" maxLength={80} placeholder="My stack" value={sampleName} onChange={(event) => setSampleName(event.target.value)} /></label>
                  <label>Sample R<input id="file-sample-r" type="file" accept=".txt,text/plain" /></label>
                  <label>Sample T<input id="file-sample-t" type="file" accept=".txt,text/plain" /></label>
                  <label>R reference signal<input id="file-r-reference" type="file" accept=".txt,text/plain" /></label>
                  <label>T reference signal<input id="file-t-reference" type="file" accept=".txt,text/plain" /></label>
                  <label>Reference R table<input id="file-reference-model" type="file" accept=".txt,text/plain" /></label>
                </div>
                <Button id="load-files" className="full" kind="tertiary" type="button">Process local files</Button>
                <p className="model-note">Signal files use wavelength (nm) and counts. The reference R and layer n,k tables accept wavelength in nm or µm.</p>
              </details>
              <details className="advanced-controls">
                <summary>Measurement processing</summary>
                <div className="field-pair">
                  <label>Minimum λ <span>nm</span><input id="wavelength-min" type="number" value={wavelengthRange.min} onChange={(event) => setWavelengthRange((current) => ({ ...current, min: event.target.value }))} min="195" max="2500" step="10" /></label>
                  <label>Maximum λ <span>nm</span><input id="wavelength-max" type="number" value={wavelengthRange.max} onChange={(event) => setWavelengthRange((current) => ({ ...current, max: event.target.value }))} min="200" max="3000" step="10" /></label>
                  <label>Reference threshold <span>%</span><input id="reference-threshold" type="number" value={measurementProcessing.threshold} onChange={(event) => setMeasurementProcessing((current) => ({ ...current, threshold: event.target.value }))} min="0" max="99" step="1" /></label>
                  <label>Median bin <span>nm</span><input id="bin-width" type="number" value={measurementProcessing.bin} onChange={(event) => setMeasurementProcessing((current) => ({ ...current, bin: event.target.value }))} min="0.1" max="100" step="0.5" /></label>
                </div>
                <label>Minimum sample SNR <span>σ</span><input id="sample-snr" type="number" value={measurementProcessing.snr} onChange={(event) => setMeasurementProcessing((current) => ({ ...current, snr: event.target.value }))} min="0" max="100" step="0.5" /></label>
                <label className="check"><input id="subtract-background" type="checkbox" checked={measurementProcessing.subtractBackground} onChange={(event) => setMeasurementProcessing((current) => ({ ...current, subtractBackground: event.target.checked }))} /><span>Subtract 195–250 nm background</span></label>
              </details>
                </section>

                <section className="configuration-panel" hidden={activeSection !== "layers"}>
              <PanelHeading title="Layer stack" description="Geometry, optical models and substrate." onClose={closePanel} />
              <details className="stack-scope"><summary>Model assumptions</summary><p className="model-note">Order: incident medium at the top, substrate at the bottom. Layers are coherent; substrate propagation is phase-incoherent and includes absorption. Enter substrate thickness in µm; it must be at least 10× the maximum fitted wavelength.</p></details>
              <div className="field-pair compact-pair">
                <label>Substrate thickness <span>micrometres (µm)</span><input id="substrate-thickness" type="number" defaultValue="1000" min="10" max="1000000" step="1" /></label>
                <label>Incidence<select id="incidence" defaultValue="film"><option value="film">Stack side</option><option value="substrate">Substrate side</option></select></label>
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
              <PanelHeading title="Fit" description="Channels, optimizer and uncertainty." onClose={closePanel} />
              <div className="channel-row">
                <label className="check"><input id="use-r" type="checkbox" checked={fitChannels.reflectance} onChange={(event) => setFitChannels((current) => ({ ...current, reflectance: event.target.checked }))} /><span>Fit R</span></label>
                <label className="check"><input id="use-t" type="checkbox" checked={fitChannels.transmittance} onChange={(event) => setFitChannels((current) => ({ ...current, transmittance: event.target.checked }))} /><span>Fit T</span></label>
                <label className="check"><input id="prefer-shape" type="checkbox" checked={fitChannels.shape} onChange={(event) => setFitChannels((current) => ({ ...current, shape: event.target.checked }))} /><span>Shape residual</span></label>
              </div>
              <details className="advanced-controls">
                <summary>Weights and optimizer</summary>
                <div className="field-pair">
                  <label>σR<input id="sigma-r" type="number" defaultValue="0.02" min="0.0001" max="1" step="0.005" /></label>
                  <label>σT<input id="sigma-t" type="number" defaultValue="0.02" min="0.0001" max="1" step="0.005" /></label>
                  <label>σn<input id="sigma-n" type="number" defaultValue="0.5" min="0.0001" max="10" step="0.05" /></label>
                  <label>σk<input id="sigma-k" type="number" defaultValue="0.25" min="0.0001" max="10" step="0.05" /></label>
                </div>
                <div className="global-parameter-grid">
                  <label className="check"><input id="fit-r-gain" type="checkbox" /><span>Fit R gain</span></label><input id="r-gain" type="number" defaultValue="1" min="0.1" max="10" step="0.01" aria-label="R gain" />
                  <label className="check"><input id="fit-t-gain" type="checkbox" /><span>Fit T gain</span></label><input id="t-gain" type="number" defaultValue="1" min="0.1" max="10" step="0.01" aria-label="T gain" />
                </div>
                <div className="field-pair">
                  <label>Sobol points<select id="screening-points" defaultValue="512"><option>64</option><option>128</option><option>256</option><option>512</option><option>1024</option><option>2048</option></select></label>
                  <label>Local refinements<input id="local-refinements" type="number" defaultValue="16" min="1" max="50" step="1" /></label>
                  <label>Bootstrap replicates<select id="bootstrap-samples" defaultValue="20"><option>20</option><option>50</option><option>100</option></select></label>
                </div>
                <Button id="bootstrap-button" className="full" kind="tertiary" type="button" disabled>Estimate bootstrap uncertainty</Button>
              </details>
              <p id="fit-count" className="model-note">0 / 11 fitted parameters selected.</p>
                </section>
              </div>
            </aside>

            <section id="results-panel" className="results" aria-label="Fit results">
            <ResultsEmpty />
            <div id="results-content" hidden>
            <div className="actions result-actions"><Button id="preview-button" kind="tertiary" renderIcon={Renew} type="button">Update</Button><Button id="fit-button" kind="primary" renderIcon={ArrowRight} type="button">Fit parameters</Button></div>
            <div className="results-tabs">
            <Tabs onChange={() => window.requestAnimationFrame(() => window.dispatchEvent(new Event("resize")))}>
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
                  <details className="result-details report-details"><summary>Report information</summary><p id="report-meta" className="report-meta" /></details>
                  <section className="diagnostics">
                    <div className="plot-heading"><div><p>FIT HEALTH</p><h2>Diagnostics</h2></div></div>
                    <div className="diagnostic-grid">
                      <article><span>CONVERGENCE</span><strong id="diagnostic-convergence">Preview</strong><small id="diagnostic-evaluations">No optimizer run</small></article>
                      <article><span>JACOBIAN CONDITION</span><strong id="diagnostic-condition">—</strong><small>large means non-identifiable</small></article>
                      <article><span>BOUND HITS</span><strong id="diagnostic-bounds">—</strong><small>fitted parameters</small></article>
                      <article><span>MAX R + T</span><strong id="diagnostic-power">—</strong><small>physical model</small></article>
                    </div>
                    <p id="diagnostic-note">Preview the stack before fitting. Multilayer inverse problems can have several nearly equivalent solutions.</p>
                    <details id="uncertainty-panel" className="result-details"><summary>Parameter uncertainty and correlation</summary><div id="uncertainty-content" className="result-detail-content"><p>Run a fit to estimate local uncertainty, then optionally run the residual bootstrap.</p></div></details>
                    <details id="solutions-panel" className="result-details"><summary>Alternative fitted solutions</summary><div id="solutions-content" className="result-detail-content"><p>No fitted alternatives yet.</p></div></details>
                  </section>
                  <PlotCard title="Spectral residuals" canvasId="residual-chart" label="Interactive spectral residuals" legend={[{ className: "r-model", text: "R residual" }, { className: "t-model", text: "T residual" }]} />
                </TabPanel>
                <TabPanel className="results-tab-panel">
                  <PlotCard eyebrow="Active layer" eyebrowId="nk-layer-label" title="Complex refractive index" canvasId="nk-chart" label="Interactive active-layer refractive index" legend={[{ className: "n-line", text: "n" }, { className: "k-line", text: "k" }]} />
                  <section className="provenance"><details><summary>Model assumptions and scope</summary><p>Normal incidence; homogeneous isotropic coherent layers; finite phase-incoherent dispersive substrate with Beer–Lambert attenuation and incoherent rear-surface returns. Cauchy–Urbach is phenomenological, Sellmeier assumes transparency, EMA assumes subwavelength isotropic constituents, and the five-knot KK spline is bandwidth limited. Residual bootstrap intervals assume exchangeable spectral residuals and local refits near the selected minimum. Surface roughness, gradients, anisotropy, scattering, and oblique incidence are not included.</p></details></section>
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
