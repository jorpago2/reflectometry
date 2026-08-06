import { Disclosure, DisclosureButton, DisclosurePanel, Popover, PopoverButton, PopoverPanel, Tab, TabGroup, TabList, TabPanel, TabPanels } from "@headlessui/react";
import { ArrowDownTrayIcon, ArrowPathIcon, ArrowRightIcon, ChevronDownIcon, PlusIcon, QuestionMarkCircleIcon } from "@heroicons/react/24/outline";
import { useEffect, type ReactNode } from "react";

type PlotCardProps = {
  eyebrow: string;
  title: string;
  canvasId: string;
  label: string;
  legend: Array<{ className: string; text: string }>;
  eyebrowId?: string;
};

type WorkflowSectionProps = {
  title: string;
  description: string;
  children: ReactNode;
  defaultOpen?: boolean;
};

function WorkflowSection({ title, description, children, defaultOpen = false }: WorkflowSectionProps) {
  return (
    <Disclosure as="section" className="workflow-section" defaultOpen={defaultOpen}>
      <DisclosureButton className="workflow-trigger">
        <span><strong>{title}</strong><small>{description}</small></span>
        <ChevronDownIcon className="disclosure-icon" aria-hidden="true" />
      </DisclosureButton>
      <DisclosurePanel className="workflow-content" unmount={false}>{children}</DisclosurePanel>
    </Disclosure>
  );
}

function PlotCard({ eyebrow, title, canvasId, label, legend, eyebrowId }: PlotCardProps) {
  return (
    <section className="plot-card">
      <div className="plot-heading">
        <div><p id={eyebrowId}>{eyebrow}</p><h2>{title}</h2></div>
        <div className="legend">{legend.map((item) => <span className={item.className} key={item.text}>{item.text}</span>)}</div>
      </div>
      <div className="chart-shell">
        <div id={canvasId} className="plotly-chart" tabIndex={0} role="img" aria-label={label} aria-describedby={`${canvasId}-help`} />
      </div>
      <div className="chart-toolbar">
        <span id={`${canvasId}-help`}>Hover to inspect · Wheel or +/− to zoom · Drag or ←/→ to pan</span>
        <button className="chart-reset" type="button" data-reset-chart={canvasId}>Reset view</button>
      </div>
    </section>
  );
}

export default function App() {
  useEffect(() => {
    void import("./multilayer-app.ts").catch((error: unknown) => {
      const status = document.getElementById("status");
      if (status) status.textContent = `Error loading the application: ${error instanceof Error ? error.message : String(error)}`;
    });
  }, []);

  return (
    <>
      <a className="skip-link" href="#reflectometry-workspace">Skip to fitting workspace</a>
      <header className="masthead flex min-h-16 items-center gap-6 bg-ui-surface/94 px-[clamp(1rem,4vw,2.5rem)] py-3">
        <a className="brand" href="./" aria-label="Reflectometry home">
          <span className="brand-mark" aria-hidden="true"><i /><i /><i /></span>
          REFLECTO<span>METRY</span>
        </a>
        <p className="masthead-context">Multilayer optical modelling · local fitting</p>
        <a className="suite-link" href="https://jorpago2.github.io/" aria-label="Online Simulators & Tools">All tools</a>
        <Popover className="app-help">
          <PopoverButton id="app-help" className="app-help-button" aria-keyshortcuts="?">
            <QuestionMarkCircleIcon className="ui-icon" aria-hidden="true" />
            Help
          </PopoverButton>
          <PopoverPanel className="app-help-panel"><strong>Quick workflow</strong><p>Load spectra, define the stack, preview the model, then fit and inspect residuals and uncertainty.</p><dl><div><dt><kbd>Ctrl/⌘</kbd> + <kbd>Enter</kbd></dt><dd>Fit parameters</dd></div><div><dt><kbd>Esc</kbd></dt><dd>Cancel fitting</dd></div><div><dt><kbd>?</kbd></dt><dd>Toggle this help</dd></div></dl></PopoverPanel>
        </Popover>
        <p className="privacy"><span aria-hidden="true" /> Local processing</p>
      </header>

      <main className="min-h-dvh w-full bg-ui-canvas font-ui-body text-ui-ink" aria-label="Reflectometry workspace">
        <nav className="workspace-jump" aria-label="Workspace areas">
          <a href="#configuration-panel">Configuration</a>
          <a href="#results-panel">Results</a>
        </nav>

        <div id="reflectometry-workspace" className="workspace multilayer-workspace grid min-h-240 grid-cols-1" tabIndex={-1}>
          <aside id="configuration-panel" className="controls bg-ui-surface" aria-label="Data, stack, and fit controls">
            <WorkflowSection title="Measurement" description="Choose spectra or start with generated data" defaultOpen>
              <button id="reset-example" className="secondary full" type="button">Load synthetic example</button>
              <details>
                <summary>Open a saved fitting result</summary>
                <label>Saved fit JSON<input id="saved-fit-file" type="file" accept=".json,application/json" /></label>
                <p className="model-note">Current exports restore the measurement, complete stack, n,k tables, fitted values, bounds, and fit controls. Older exports restore the configuration available in those files.</p>
              </details>
              <details>
                <summary>Load my measurement files</summary>
                <div className="file-grid">
                  <label>Sample name<input id="sample-name" type="text" maxLength={80} placeholder="My stack" /></label>
                  <label>Sample R<input id="file-sample-r" type="file" accept=".txt,text/plain" /></label>
                  <label>Sample T<input id="file-sample-t" type="file" accept=".txt,text/plain" /></label>
                  <label>R reference signal<input id="file-r-reference" type="file" accept=".txt,text/plain" /></label>
                  <label>T reference signal<input id="file-t-reference" type="file" accept=".txt,text/plain" /></label>
                  <label>Reference R table<input id="file-reference-model" type="file" accept=".txt,text/plain" /></label>
                </div>
                <button id="load-files" className="secondary full" type="button">Process local files</button>
                <p className="model-note">Signal files use wavelength (nm) and counts. The reference R and layer n,k tables accept wavelength in nm or µm.</p>
              </details>
              <p id="source-name" className="source-name">No measurement loaded</p>
              <details className="advanced-controls">
                <summary>Measurement processing</summary>
                <div className="field-pair">
                  <label>Minimum λ <span>nm</span><input id="wavelength-min" type="number" defaultValue="300" min="195" max="2500" step="10" /></label>
                  <label>Maximum λ <span>nm</span><input id="wavelength-max" type="number" defaultValue="1100" min="200" max="3000" step="10" /></label>
                  <label>Reference threshold <span>%</span><input id="reference-threshold" type="number" defaultValue="5" min="0" max="99" step="1" /></label>
                  <label>Median bin <span>nm</span><input id="bin-width" type="number" defaultValue="2" min="0.1" max="100" step="0.5" /></label>
                </div>
                <label>Minimum sample SNR <span>σ</span><input id="sample-snr" type="number" defaultValue="5" min="0" max="100" step="0.5" /></label>
                <label className="check"><input id="subtract-background" type="checkbox" defaultChecked /><span>Subtract 195–250 nm background</span></label>
              </details>
            </WorkflowSection>

            <WorkflowSection title="Layer stack" description="Geometry, optical models and substrate">
              <p className="model-note">Order: incident medium at the top, substrate at the bottom. Layers are coherent; substrate propagation is phase-incoherent and includes absorption. Enter substrate thickness in µm; it must be at least 10× the maximum fitted wavelength.</p>
              <div className="field-pair compact-pair">
                <label>Substrate thickness <span>micrometres (µm)</span><input id="substrate-thickness" type="number" defaultValue="1000" min="10" max="1000000" step="1" /></label>
                <label>Incidence<select id="incidence" defaultValue="film"><option value="film">Stack side</option><option value="substrate">Substrate side</option></select></label>
              </div>
              <div id="layers" className="layer-list" />
              <div className="stack-toolbar">
                <button id="undo-button" className="secondary" type="button" disabled aria-label="Undo stack edit">↶ Undo</button>
                <button id="redo-button" className="secondary" type="button" disabled aria-label="Redo stack edit">↷ Redo</button>
                <button id="add-layer" className="secondary button-with-icon" type="button"><PlusIcon className="ui-icon" aria-hidden="true" />Add layer</button>
              </div>
              <div className="section-heading substrate-heading"><span>S</span><h3>Dispersive substrate</h3></div>
              <div id="substrate-editor" />
            </WorkflowSection>

            <WorkflowSection title="Fit" description="Channels, optimizer and uncertainty">
              <div className="channel-row">
                <label className="check"><input id="use-r" type="checkbox" defaultChecked /><span>Fit R</span></label>
                <label className="check"><input id="use-t" type="checkbox" defaultChecked /><span>Fit T</span></label>
                <label className="check"><input id="prefer-shape" type="checkbox" defaultChecked /><span>Shape residual</span></label>
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
                <button id="bootstrap-button" className="secondary full" type="button" disabled>Estimate bootstrap uncertainty</button>
              </details>
              <p id="fit-count" className="model-note">0 / 11 fitted parameters selected.</p>
            </WorkflowSection>

            <div className="actions"><button id="preview-button" className="secondary button-with-icon" type="button"><ArrowPathIcon className="ui-icon" aria-hidden="true" />Update model</button><button id="fit-button" className="primary button-with-icon" type="button">Fit parameters <ArrowRightIcon className="ui-icon" aria-hidden="true" /></button></div>
          </aside>

          <section id="results-panel" className="results grid min-w-0 content-start gap-6 bg-ui-canvas-muted px-[clamp(1rem,4vw,2.5rem)] pt-8 pb-10" aria-label="Fit results">
            <div id="results-empty" className="results-empty"><span className="empty-mark" aria-hidden="true" /><strong>No results yet</strong><p>Load measurement data or the synthetic example, then update the model or fit the selected parameters.</p><a href="#configuration-panel">Open configuration</a></div>
            <div id="results-content" hidden>
            <div className="status-row">
              <p id="status" role="status" aria-live="polite">Waiting for measurement data.</p>
              <progress id="fit-progress" max="100" defaultValue="0" hidden aria-label="Fit progress" />
              <button id="cancel-operation" className="text-button cancel-action" type="button" hidden aria-controls="fit-progress">CANCEL</button>
              <details className="export-menu">
                <summary className="text-button export-menu-button button-with-icon"><ArrowDownTrayIcon className="ui-icon" aria-hidden="true" />Export<ChevronDownIcon className="menu-chevron" aria-hidden="true" /></summary>
                <div className="export-menu-items">
                  <button id="print-report" className="export-menu-item" disabled type="button">Print report</button>
                  <button id="download-json" className="export-menu-item" disabled type="button">Project JSON</button>
                  <button id="download-csv" className="export-menu-item" disabled type="button">Spectra CSV</button>
                  <button id="download-nk" className="export-menu-item" disabled type="button">Layers n,k</button>
                </div>
              </details>
            </div>
            <header id="report-meta" className="report-meta" />
            <TabGroup className="results-tabs" onChange={() => window.requestAnimationFrame(() => window.dispatchEvent(new Event("resize")))}>
              <TabList className="results-tab-list" aria-label="Result views">
                <Tab className="results-tab">Overview</Tab>
                <Tab className="results-tab">Fit quality</Tab>
                <Tab className="results-tab">Optical constants</Tab>
              </TabList>
              <TabPanels>
                <TabPanel className="results-tab-panel" unmount={false}>
                  <section className="stack-card" aria-labelledby="stack-title">
                    <div className="plot-heading"><div><p>PHYSICAL CROSS-SECTION</p><h2 id="stack-title">Layer stack</h2></div></div>
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
                  <PlotCard eyebrow="MEASUREMENT / MODEL" title="Reflectance and transmittance" canvasId="rt-chart" label="Interactive reflectance and transmittance spectra" legend={[{ className: "r-data", text: "R data" }, { className: "r-model", text: "R model" }, { className: "t-data", text: "T data" }, { className: "t-model", text: "T model" }]} />
                </TabPanel>
                <TabPanel className="results-tab-panel" unmount={false}>
                  <div className="metrics">
                    <article><span>TOTAL THICKNESS</span><strong id="metric-thickness">—</strong><small>nm</small></article>
                    <article><span>RMSE(R)</span><strong id="metric-rmse-r">—</strong><small>fraction</small></article>
                    <article><span>RMSE(T)</span><strong id="metric-rmse-t">—</strong><small>fraction</small></article>
                    <article><span>FIT PARAMETERS</span><strong id="metric-parameters">—</strong><small>selected</small></article>
                  </div>
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
                  <PlotCard eyebrow="MODEL − DATA" title="Spectral residuals" canvasId="residual-chart" label="Interactive spectral residuals" legend={[{ className: "r-model", text: "R residual" }, { className: "t-model", text: "T residual" }]} />
                </TabPanel>
                <TabPanel className="results-tab-panel" unmount={false}>
                  <PlotCard eyebrow="ACTIVE LAYER" eyebrowId="nk-layer-label" title="Complex refractive index" canvasId="nk-chart" label="Interactive active-layer refractive index" legend={[{ className: "n-line", text: "n" }, { className: "k-line", text: "k" }]} />
                  <section className="provenance"><details><summary>Model assumptions and scope</summary><p>Normal incidence; homogeneous isotropic coherent layers; finite phase-incoherent dispersive substrate with Beer–Lambert attenuation and incoherent rear-surface returns. Cauchy–Urbach is phenomenological, Sellmeier assumes transparency, EMA assumes subwavelength isotropic constituents, and the five-knot KK spline is bandwidth limited. Residual bootstrap intervals assume exchangeable spectral residuals and local refits near the selected minimum. Surface roughness, gradients, anisotropy, scattering, and oblique incidence are not included.</p></details></section>
                </TabPanel>
              </TabPanels>
            </TabGroup>
            </div>
          </section>
        </div>
      </main>
      <footer><span>Reflectometry · v4.0.0</span><span>React + TypeScript + Vite · local processing</span><a href="https://jorpago2.github.io/" aria-label="Online Simulators & Tools">All tools</a></footer>
    </>
  );
}
