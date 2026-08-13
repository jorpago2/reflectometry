import {
  createSpectrum,
  createSyntheticSpectrum,
  diagnosticsOf,
  evaluateOpticalModel,
  loadNkTable,
  prepareFitData,
  restrictToNkRange,
} from "./scientific/solvers/scientific-core.ts";
import { MODEL_LABELS, modelParameterSpecs } from "./scientific/models/dielectric-models.ts";
import { COMPONENT_GUIDES, EMA_RULE_GUIDES, MODEL_GUIDES, parameterDescription } from "./features/layer-stack/model-help.ts";
import { parseSavedFit, SAVED_FIT_SCHEMA } from "./scientific/fitting/saved-fit.ts";
import Plotly from "plotly.js-basic-dist-min";
import {
  SCIENTIFIC_PLOT_LINE_WIDTHS,
  createScientificPlotlyConfig,
  createScientificPlotlyLayout,
  prepareScientificPlotlyToolbar,
} from "@jorpago2/scientific-ui";

const MULTILAYER_MODEL_LABELS = {
  fixed: MODEL_LABELS.fixed,
  scaled: MODEL_LABELS.scaled,
  constant: MODEL_LABELS.constant,
  composite: "Independent dielectric components",
  cauchy: MODEL_LABELS.cauchy,
  sellmeier: MODEL_LABELS.sellmeier,
  "forouhi-bloomer": MODEL_LABELS["forouhi-bloomer"],
  "kk-spline": MODEL_LABELS["kk-spline"],
  ema: MODEL_LABELS.ema,
};
const COMPONENT_LABELS = { gaussian: "Gaussian", cody: "Cody–Lorentz", drude: "Drude", drudeSmith: "Drude–Smith", brendelBormann: "Brendel–Bormann", criticalPoint: "Critical point / Adachi" };
const DEFAULT_COMPONENTS = { taucLorentz: 1, lorentz: 0, gaussian: false, cody: false, drude: false, drudeSmith: false, brendelBormann: false, criticalPoint: false };
const TABLE_MODELS = new Set(["fixed", "scaled"]);
const LAYER_ACTION_ICONS = {
  up: { viewBox: "0 0 16 16", paths: ["M3.7 6.7 7.5 2.9 7.5 15 8.5 15 8.5 2.9 12.3 6.7 13 6 8 1 3 6z"] },
  down: { viewBox: "0 0 16 16", paths: ["M12.3 9.3 8.5 13.1 8.5 1 7.5 1 7.5 13.1 3.7 9.3 3 10 8 15 13 10z"] },
  duplicate: { viewBox: "0 0 32 32", paths: ["M28,10V28H10V10H28m0-2H10a2,2,0,0,0-2,2V28a2,2,0,0,0,2,2H28a2,2,0,0,0,2-2V10a2,2,0,0,0-2-2Z", "M4,18H2V4A2,2,0,0,1,4,2H18V4H4Z"] },
  remove: { viewBox: "0 0 32 32", paths: ["M12 12H14V24H12z", "M18 12H20V24H18z", "M4,6V8H6V28a2,2,0,0,0,2,2H24a2,2,0,0,0,2-2V8h2V6ZM8,28V8H24V28Z", "M12 2H20V4H12z"] },
} as const;
const SAVED_CONTROL_IDS = ["wavelength-min", "wavelength-max", "reference-threshold", "bin-width", "sample-snr", "subtract-background", "use-r", "use-t", "prefer-shape", "sigma-r", "sigma-t", "sigma-n", "sigma-k", "fit-r-gain", "fit-t-gain", "r-gain", "t-gain", "screening-points", "local-refinements", "bootstrap-samples"];
const OPTIMIZER_CONTROL_IDS = new Set(["screening-points", "local-refinements", "bootstrap-samples"]);

function appendLayerActionIcon(button: HTMLButtonElement, action: keyof typeof LAYER_ACTION_ICONS) {
  const specification = LAYER_ACTION_ICONS[action];
  const icon = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  icon.setAttribute("viewBox", specification.viewBox);
  icon.setAttribute("aria-hidden", "true");
  icon.setAttribute("focusable", "false");
  for (const pathData of specification.paths) {
    const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
    path.setAttribute("d", pathData);
    icon.append(path);
  }
  button.append(icon);
}
function themeValue(name: string) {
  const value = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  if (!value) throw new Error(`Missing Carbon theme token ${name}.`);
  return value;
}

const PLOT_BLUE = themeValue("--color-plot-r");
const PLOT_TEAL = themeValue("--color-plot-t");
const PLOT_BLUE_BAND = themeValue("--color-plot-r-band");
const PLOT_TEAL_BAND = themeValue("--color-plot-t-band");

function plotTheme() {
  return {
    background: themeValue("--plot-background"),
    grid: themeValue("--plot-grid"),
    axis: themeValue("--plot-axis"),
    text: themeValue("--plot-text"),
    textPrimary: themeValue("--plot-text-primary"),
  };
}
const elements: Record<string, any> = new Proxy({}, {
  get(_target, property: string) {
    const element = document.getElementById(property);
    if (!element) throw new Error(`Scientific UI contract is missing #${property}.`);
    return element;
  },
});
const state: any = { spectrum: null, fitData: null, evaluation: null, fitResult: null, resultStale: false, source: null, layers: [], substrate: null, activeLayerId: null, nextLayer: 1, worker: null, pendingConfiguration: null, history: [], future: [], lastSnapshot: null, restoringHistory: false };
const chartStates = new Map<any, any>();

elements["reset-example"].addEventListener("click", loadSyntheticExample);
elements["load-files"].addEventListener("click", loadLocalFiles);
elements["saved-fit-file"].addEventListener("change", loadSavedFit);
elements["add-layer"].addEventListener("click", () => {
  captureLayerInputs();
  if (state.layers.length >= 12) return showError(new Error("The coherent stack is limited to 12 layers."));
  pushHistory();
  const layer = makeLayer("constant", 100, null);
  state.layers.push(layer);
  state.activeLayerId = layer.id;
  renderLayers();
  previewModel(`Layer ${state.layers.length} added. Model preview updated; undo is available.`);
});
for (const container of [elements.layers, elements["substrate-editor"]]) {
  container.addEventListener("change", handleLayerChange);
  container.addEventListener("click", handleLayerClick);
  container.addEventListener("click", handleParameterHelp);
}
document.addEventListener("click", (event) => !(event.target as Element).closest(".parameter-help-button, .parameter-help-popover") && closeParameterHelp());
document.addEventListener("keydown", handleGlobalShortcut);
for (const id of ["substrate-thickness", "incidence"]) elements[id].addEventListener("change", () => { pushHistory(); renderStackDiagram(); commitHistorySnapshot(); markResultStale(); });
elements["preview-button"].addEventListener("click", previewModel);
elements["fit-button"].addEventListener("click", fitModel);
elements["bootstrap-button"].addEventListener("click", bootstrapUncertainty);
elements["cancel-operation"].addEventListener("click", cancelOperation);
elements["undo-button"].addEventListener("click", undoEdit);
elements["redo-button"].addEventListener("click", redoEdit);
elements["print-report"].addEventListener("click", () => window.print());
elements["solutions-content"].addEventListener("click", (event) => { const button = (event.target as Element).closest<HTMLElement>("button[data-solution]"); if (button) applyAlternativeSolution(Number(button.dataset.solution)); });
elements["download-json"].addEventListener("click", downloadJson);
elements["download-csv"].addEventListener("click", downloadSpectraCsv);
elements["download-nk"].addEventListener("click", downloadLayersNkCsv);
for (const button of document.querySelectorAll<HTMLElement>("[data-reset-chart]")) button.addEventListener("click", () => resetChart(elements[button.dataset.resetChart!]));
for (const id of ["fit-r-gain", "fit-t-gain"]) elements[id].addEventListener("change", updateFitCount);
for (const id of SAVED_CONTROL_IDS) elements[id].addEventListener("change", () => { pushHistory(); commitHistorySnapshot(); if (!OPTIMIZER_CONTROL_IDS.has(id)) markResultStale(); });

function handleGlobalShortcut(event: KeyboardEvent) {
  if (event.defaultPrevented || event.repeat) return;
  if ((event.ctrlKey || event.metaKey) && event.key === "Enter") {
    event.preventDefault();
    if (!state.worker && !elements["fit-button"].disabled) elements["fit-button"].click();
  } else if (event.key === "Escape") {
    const parameterHelpOpen = Boolean(document.querySelector('.parameter-help-button[aria-expanded="true"]'));
    const operationRunning = Boolean(state.worker);
    closeParameterHelp();
    if (state.worker) cancelOperation();
    if (parameterHelpOpen || operationRunning) event.preventDefault();
  }
}

function makeLayer(model, thicknessNm, nk) {
  const id = `layer${state.nextLayer++}`;
  const components = { ...DEFAULT_COMPONENTS };
  const specs = layerSpecs(model, thicknessNm, nk, components);
  const ema = { method: "bruggeman", hostNk: null, inclusionNk: null, hostSource: null, inclusionSource: null };
  return { id, name: `Layer ${state.layers.length + 1}`, model, components, ema, nk, nkSource: null, regularize: false, links: {}, specs, specCache: { ...specs } };
}

function makeSubstrate(model = "constant", nk = null) {
  const components = { ...DEFAULT_COMPONENTS };
  const ema = { method: "bruggeman", hostNk: null, inclusionNk: null, hostSource: null, inclusionSource: null };
  const specs = substrateSpecs(model, nk, components);
  if (model === "constant") { specs.n.value = 1.46; specs.n.minimum = 1; specs.n.maximum = 3; specs.k.value = 0; }
  return { id: "substrate", name: "Substrate", model, components, ema, nk, nkSource: null, regularize: false, links: {}, specs, specCache: { ...specs } };
}

function modelLabel(model) { return MULTILAYER_MODEL_LABELS[model] ?? MODEL_LABELS[model] ?? model; }

function layerSpecs(model, thicknessNm, nk, components, previous: any = {}) {
  const referenceIndex = nk ? nk.wavelengthNm.reduce((best, value, index) => Math.abs(value - 1064) < Math.abs(nk.wavelengthNm[best] - 1064) ? index : best, 0) : 0;
  const generated: any = modelParameterSpecs(model, { n: nk?.n[referenceIndex] ?? 2, k: nk?.k[referenceIndex] ?? 0.05 }, thicknessNm, components);
  delete generated.rGain;
  delete generated.tGain;
  return Object.fromEntries((Object.entries(generated) as [string, any][]).map(([name, specification]) => [name, previous[name] ? { ...specification, ...previous[name] } : specification]));
}

function substrateSpecs(model, nk, components, previous: any = {}) {
  const generated = layerSpecs(model, 1000, nk, components, previous);
  delete generated.thicknessNm;
  for (const [name, specification] of Object.entries(generated)) if (!previous[name]) specification.fit = false;
  return generated;
}

function rebuildLayerSpecs(layer) {
  layer.specCache = { ...layer.specCache, ...layer.specs };
  layer.specs = layer.id === "substrate" ? substrateSpecs(layer.model, layer.nk, layer.components, layer.specCache) : layerSpecs(layer.model, layer.specs.thicknessNm.value, layer.nk, layer.components, layer.specCache);
  layer.specCache = { ...layer.specCache, ...layer.specs };
}

function loadSyntheticExample() {
  setBusy(true, "Generating a neutral synthetic stack…");
  try {
    state.spectrum = createSyntheticSpectrum();
    state.layers = [];
    state.substrate = makeSubstrate();
    const layer = makeLayer("constant", 150, null);
    layer.name = "Generic layer";
    state.layers = [layer];
    state.activeLayerId = layer.id;
    state.source = { sampleName: "Synthetic stack", type: "deterministic browser-generated example", truth: { layers: [{ thicknessNm: 150, n: 2, k: 0.05 }], substrate: { n: 1.46, k: 0, thicknessUm: 1000 } } };
    setSourceName("Synthetic stack · generated locally");
    elements["use-t"].checked = true;
    renderLayers();
    previewModel();
    resetHistory();
  } catch (error) { showError(error); }
  finally { setBusy(false); }
}

function initializeWorkspace() {
  state.layers = [];
  state.substrate = makeSubstrate();
  const layer = makeLayer("constant", 150, null);
  layer.name = "Generic layer";
  state.layers = [layer];
  state.activeLayerId = layer.id;
  renderLayers();
  resetHistory();
  setStatus("Load measurement data or the synthetic example to begin.");
}

async function loadLocalFiles() {
  const fields = { sampleR: "file-sample-r", sampleT: "file-sample-t", reflectanceReference: "file-r-reference", transmittanceReference: "file-t-reference", referenceReflectance: "file-reference-model" };
  const files = Object.fromEntries(Object.entries(fields).map(([name, id]) => [name, elements[id].files[0]]));
  const missing = Object.entries(files).filter(([, file]) => !file).map(([name]) => name);
  if (missing.length) return showError(new Error(`Select the required files: ${missing.join(", ")}.`));
  pushHistory();
  setBusy(true, "Reading local files…");
  try {
    const texts = Object.fromEntries(await Promise.all(Object.entries(files).map(async ([name, file]) => [name, await file.text()])));
    const sampleName = elements["sample-name"].value.trim() || files.sampleR.name.replace(/-ref\.txt$/i, "") || "sample";
    state.spectrum = createSpectrum({ sampleName, ...texts });
    state.source = { sampleName, type: "local files", files: Object.fromEntries(Object.entries(files).map(([name, file]) => [name, file.name])) };
    setSourceName(`${sampleName} · local files`);
    if (!state.layers.length) {
      const layer = makeLayer("constant", 100, null);
      state.layers = [layer]; state.activeLayerId = layer.id; renderLayers();
    }
    previewModel();
    commitHistorySnapshot();
  } catch (error) { showError(error); }
  finally { setBusy(false); }
}

async function loadSavedFit(event) {
  const file = event.target.files[0]; if (!file) return;
  if (file.size > 50 * 1024 * 1024) { event.target.value = ""; return showError(new Error("Saved fit JSON files are limited to 50 MB.")); }
  setBusy(true, "Opening saved fit…");
  try { restoreSavedFit(parseSavedFit(await file.text()), file.name); }
  catch (error) { showError(error); }
  finally { event.target.value = ""; setBusy(false); }
}

function restoreSavedFit(saved, fileName) {
  state.nextLayer = 1;
  const layers = saved.stack.map((entry) => {
    const thicknessNm = Number.isFinite(entry.parameters.thicknessNm) ? entry.parameters.thicknessNm : 100;
    const layer = makeLayer(entry.opticalModel, thicknessNm, entry.nkTable);
    layer.id = entry.id; layer.name = entry.name;
    for (const name of ["taucLorentz", "lorentz"]) if (Number.isInteger(entry.dielectricComponents?.[name])) layer.components[name] = Math.max(0, Math.min(5, entry.dielectricComponents[name]));
    for (const name of Object.keys(COMPONENT_LABELS)) layer.components[name] = Boolean(entry.dielectricComponents?.[name]);
    layer.nk = entry.nkTable; layer.nkSource = entry.nkSource; layer.regularize = entry.regularizedToNk;
    layer.links = { ...entry.parameterLinks };
    if (entry.effectiveMedium) layer.ema = { method: entry.effectiveMedium.method, hostNk: entry.effectiveMedium.hostNk, inclusionNk: entry.effectiveMedium.inclusionNk, hostSource: entry.effectiveMedium.hostSource, inclusionSource: entry.effectiveMedium.inclusionSource };
    layer.specs = layerSpecs(layer.model, thicknessNm, layer.nk, layer.components);
    for (const [name, specification] of Object.entries(layer.specs)) {
      const setting = entry.parameterSettings[name];
      if (setting) Object.assign(specification, setting);
      if (Number.isFinite(entry.parameters[name])) specification.value = entry.parameters[name];
    }
    layer.specCache = { ...layer.specs };
    return layer;
  });
  state.layers = layers; state.activeLayerId = saved.activeLayerId;
  const savedSubstrate = saved.substrateMaterial;
  state.substrate = makeSubstrate(savedSubstrate?.opticalModel ?? "constant", savedSubstrate?.nkTable ?? null);
  if (savedSubstrate) {
    for (const name of ["taucLorentz", "lorentz"]) if (Number.isInteger(savedSubstrate.dielectricComponents?.[name])) state.substrate.components[name] = Math.max(0, Math.min(5, savedSubstrate.dielectricComponents[name]));
    for (const name of Object.keys(COMPONENT_LABELS)) state.substrate.components[name] = Boolean(savedSubstrate.dielectricComponents?.[name]);
    state.substrate.nkSource = savedSubstrate.nkSource; state.substrate.regularize = savedSubstrate.regularizedToNk;
    if (savedSubstrate.effectiveMedium) state.substrate.ema = { method: savedSubstrate.effectiveMedium.method, hostNk: savedSubstrate.effectiveMedium.hostNk, inclusionNk: savedSubstrate.effectiveMedium.inclusionNk, hostSource: savedSubstrate.effectiveMedium.hostSource, inclusionSource: savedSubstrate.effectiveMedium.inclusionSource };
    state.substrate.specs = substrateSpecs(state.substrate.model, state.substrate.nk, state.substrate.components);
    for (const [name, specification] of Object.entries(state.substrate.specs) as [string, any][]) { if (savedSubstrate.parameterSettings[name]) Object.assign(specification, savedSubstrate.parameterSettings[name]); if (Number.isFinite(savedSubstrate.parameters[name])) specification.value = savedSubstrate.parameters[name]; }
    state.substrate.specCache = { ...state.substrate.specs };
  } else { state.substrate.specs.n.value = saved.substrate.n; state.substrate.specs.k.value = saved.substrate.k; }
  const usedIds = new Set(layers.map((layer) => layer.id)); state.nextLayer = 1; while (usedIds.has(`layer${state.nextLayer}`)) state.nextLayer += 1;
  applySavedControls(saved.controls);
  elements["substrate-thickness"].value = String(saved.substrate.thicknessUm); elements.incidence.value = saved.substrate.incidence;
  elements["r-gain"].value = String(saved.gains.reflectance); elements["t-gain"].value = String(saved.gains.transmittance);
  if (saved.spectrum) {
    state.spectrum = saved.spectrum;
    state.source = { ...(saved.source ?? {}), sampleName: saved.spectrum.sampleName };
  }
  const sampleName = saved.spectrum?.sampleName ?? state.source?.sampleName ?? fileName.replace(/\.json$/i, "");
  setSourceName(`${sampleName} · ${saved.spectrum ? "restored saved fit" : "legacy fit configuration"}`);
  renderLayers();
  const missingTables = [...layers, state.substrate].filter((layer) => (TABLE_MODELS.has(layer.model) && !layer.nk) || (layer.model === "ema" && (!layer.ema.hostNk || !layer.ema.inclusionNk)));
  if (missingTables.length) {
    clearResult();
    resetHistory();
    setStatus(`Loaded configuration from ${fileName}. Reload the missing n,k tables for: ${missingTables.map((layer) => layer.name).join(", ")}.`);
    return;
  }
  const config = configuration(); const fitData = prepareCurrentData(); validateChannels(fitData, config.settings);
  state.evaluation = evaluateOpticalModel(fitData, null, config.initial, config.settings);
  const freshDiagnostics = diagnosticsOf(fitData, state.evaluation, config.settings);
  const diagnostics = saved.spectrum ? mergeSavedDiagnostics(freshDiagnostics, saved.diagnostics) : freshDiagnostics;
  const optimizer = normalizeSavedOptimizer(saved.optimizer);
  state.fitResult = { parameters: config.initial, evaluation: state.evaluation, diagnostics, optimizer, preview: !saved.spectrum, configuration: config };
  renderResult(saved.spectrum ? `Saved fit loaded from ${fileName}.` : `Legacy configuration loaded from ${fileName}; the current measurement remains active because this file contains no spectra.`);
  resetHistory();
}

function applySavedControls(controls) {
  for (const id of SAVED_CONTROL_IDS) if (Object.hasOwn(controls, id)) {
    if (elements[id].type === "checkbox") elements[id].checked = Boolean(controls[id]);
    else elements[id].value = String(controls[id]);
  }
}

function mergeSavedDiagnostics(fresh, saved) {
  if (!saved) return fresh;
  const validIntervals = (value) => value && typeof value === "object" && (Object.values(value) as any[]).every((interval) => interval === null || (Number.isFinite(interval.lower95) && Number.isFinite(interval.upper95)));
  const validCorrelation = (value) => Array.isArray(value?.names) && Array.isArray(value?.matrix) && value.matrix.length === value.names.length && value.matrix.every((row) => Array.isArray(row) && row.length === value.names.length && row.every(Number.isFinite));
  const validBand = (value) => Array.isArray(value) && value.length === state.fitData?.wavelengthNm.length && value.every((interval) => Number.isFinite(interval?.lower95) && Number.isFinite(interval?.upper95));
  const bootstrap = saved.bootstrap;
  const layerBands = bootstrap?.bands?.layers;
  const validLayerBands = !layerBands || (typeof layerBands === "object" && (Object.values(layerBands) as any[]).every((bands) => validBand(bands?.n) && validBand(bands?.k)));
  const validBootstrap = validIntervals(bootstrap?.parameterIntervals) && validCorrelation(bootstrap?.parameterCorrelation) && validBand(bootstrap?.bands?.reflectance) && validBand(bootstrap?.bands?.transmittance) && validBand(bootstrap?.bands?.n) && validBand(bootstrap?.bands?.k) && validLayerBands;
  return {
    ...fresh,
    normalizedJacobianCondition: Number.isFinite(saved.normalizedJacobianCondition) ? saved.normalizedJacobianCondition : null,
    parametersAtBounds: Array.isArray(saved.parametersAtBounds) ? saved.parametersAtBounds.map(String) : [],
    nearEqualAlternativeMinima: Number.isFinite(saved.nearEqualAlternativeMinima) ? saved.nearEqualAlternativeMinima : null,
    alternativeSolutions: Array.isArray(saved.alternativeSolutions) ? saved.alternativeSolutions.filter((solution) => solution && typeof solution === "object" && solution.parameters && Object.values(solution.parameters).every(Number.isFinite)) : [],
    parameterStandardErrorsApproximate: saved.parameterStandardErrorsApproximate && typeof saved.parameterStandardErrorsApproximate === "object" ? saved.parameterStandardErrorsApproximate : {},
    parameterConfidenceIntervals95Approximate: validIntervals(saved.parameterConfidenceIntervals95Approximate) ? saved.parameterConfidenceIntervals95Approximate : {},
    parameterCorrelation: validCorrelation(saved.parameterCorrelation) ? saved.parameterCorrelation : { names: [], matrix: [] },
    bootstrap: validBootstrap ? bootstrap : null,
  };
}

function normalizeSavedOptimizer(saved) {
  const solver = saved?.selectedSolver;
  return {
    ...(saved ?? {}),
    logarithmicallySampledParameters: Array.isArray(saved?.logarithmicallySampledParameters) ? saved.logarithmicallySampledParameters : [],
    selectedSolver: solver && typeof solver === "object" ? { success: Boolean(solver.success), message: String(solver.message ?? "Saved fit loaded."), evaluations: Number.isFinite(solver.evaluations) ? solver.evaluations : 0, optimality: Number.isFinite(solver.optimality) ? solver.optimality : null } : { success: true, message: "Saved fit loaded.", evaluations: 0, optimality: null },
  };
}

function clearResult() {
  state.fitData = null; state.evaluation = null; state.fitResult = null;
  for (const id of ["metric-thickness", "metric-rmse-r", "metric-rmse-t", "metric-parameters", "diagnostic-condition", "diagnostic-bounds", "diagnostic-power"]) elements[id].textContent = "—";
  elements["diagnostic-convergence"].textContent = "Not evaluated"; elements["diagnostic-evaluations"].textContent = "Missing optical data";
  for (const id of ["download-json", "download-csv", "download-nk", "print-report", "bootstrap-button"]) elements[id].disabled = true;
  updateBootstrapGuidance();
  const uncertainty = document.createElement("p"); uncertainty.textContent = "Run a fit to estimate uncertainty."; elements["uncertainty-content"].replaceChildren(uncertainty);
  const solutions = document.createElement("p"); solutions.textContent = "No fitted alternatives yet."; elements["solutions-content"].replaceChildren(solutions);
  for (const chart of [elements["rt-chart"], elements["residual-chart"], elements["nk-chart"]]) Plotly.purge(chart);
}

function renderLayers() {
  sanitizeParameterLinks();
  synchronizeLinkedParameters();
  const cards = state.layers.map((layer, index) => renderMaterialCard(layer, index));
  elements.layers.replaceChildren(...cards);
  elements["substrate-editor"].replaceChildren(renderMaterialCard(state.substrate, 0, true));
  updateFitCount();
  renderStackDiagram();
  commitHistorySnapshot();
}

function sanitizeParameterLinks() {
  const positions = new Map<string, number>(state.layers.map((layer, index) => [layer.id, index] as [string, number]));
  for (const [index, layer] of state.layers.entries()) for (const [name, source] of Object.entries(layer.links ?? {}) as [string, string][]) {
    const sourceId = source.slice(0, source.indexOf("__")); if (!positions.has(sourceId) || positions.get(sourceId) >= index || !state.layers[positions.get(sourceId)].specs[name]) delete layer.links[name];
  }
}

function materialById(id) { return id === "substrate" ? state.substrate : state.layers.find((candidate) => candidate.id === id); }

function synchronizeLinkedParameters(parameters: any = null) {
  for (const layer of state.layers) for (const [name, sourceKey] of Object.entries(layer.links ?? {}) as [string, string][]) {
    const separator = sourceKey.indexOf("__"); const source = materialById(sourceKey.slice(0, separator)); const sourceName = sourceKey.slice(separator + 2);
    const value = parameters?.[sourceKey] ?? source?.specs[sourceName]?.value;
    if (Number.isFinite(value) && layer.specs[name]) { layer.specs[name].value = value; layer.specs[name].fit = false; }
  }
}

function editorSnapshot() {
  const snapshot: any = structuredClone({
    source: state.source, layers: state.layers, substrate: state.substrate, activeLayerId: state.activeLayerId, nextLayer: state.nextLayer,
    controls: Object.fromEntries([...SAVED_CONTROL_IDS, "substrate-thickness", "incidence"].map((id) => [id, elements[id].type === "checkbox" ? elements[id].checked : elements[id].value])),
  });
  snapshot.spectrum = state.spectrum;
  snapshot.layers.forEach((layer, index) => { layer.nk = state.layers[index].nk; layer.ema.hostNk = state.layers[index].ema.hostNk; layer.ema.inclusionNk = state.layers[index].ema.inclusionNk; });
  snapshot.substrate.nk = state.substrate.nk; snapshot.substrate.ema.hostNk = state.substrate.ema.hostNk; snapshot.substrate.ema.inclusionNk = state.substrate.ema.inclusionNk;
  return snapshot;
}

function commitHistorySnapshot() { if (!state.restoringHistory && state.substrate) state.lastSnapshot = editorSnapshot(); }
function resetHistory() { state.history = []; state.future = []; state.lastSnapshot = editorSnapshot(); updateHistoryButtons(); }
function pushHistory() {
  if (state.restoringHistory || !state.lastSnapshot) return;
  state.history.push(state.lastSnapshot); if (state.history.length > 30) state.history.shift(); state.future = []; updateHistoryButtons();
}
function updateHistoryButtons() { elements["undo-button"].disabled = !state.history.length || Boolean(state.worker); elements["redo-button"].disabled = !state.future.length || Boolean(state.worker); }
function restoreHistorySnapshot(snapshot) {
  state.restoringHistory = true;
  state.spectrum = snapshot.spectrum; state.source = snapshot.source; state.layers = snapshot.layers; state.substrate = snapshot.substrate; state.activeLayerId = snapshot.activeLayerId; state.nextLayer = snapshot.nextLayer;
  applySavedControls(snapshot.controls); elements["substrate-thickness"].value = snapshot.controls["substrate-thickness"]; elements.incidence.value = snapshot.controls.incidence;
  setSourceName(`${state.source?.sampleName ?? "Measurement"} · restored edit`);
  renderLayers(); state.restoringHistory = false; previewModel(); state.lastSnapshot = editorSnapshot(); updateHistoryButtons();
}
function undoEdit() { if (!state.history.length) return; state.future.push(state.lastSnapshot); restoreHistorySnapshot(state.history.pop()); }
function redoEdit() { if (!state.future.length) return; state.history.push(state.lastSnapshot); restoreHistorySnapshot(state.future.pop()); }

function renderMaterialCard(material, index, substrate = false) {
  const card = document.createElement("article"); card.className = `layer-card${substrate ? " substrate-card" : ""}`; card.dataset.layerId = material.id;
  const header = document.createElement("div"); header.className = "layer-card-header";
  const order = document.createElement("span"); order.className = "layer-order"; order.textContent = substrate ? "S" : String(index + 1).padStart(2, "0");
  const name = document.createElement("input"); name.className = "layer-name"; name.value = material.name; name.maxLength = 60; name.dataset.field = "name"; name.disabled = substrate; name.setAttribute("aria-label", substrate ? "Substrate name" : `Layer ${index + 1} name`);
  header.append(order, name);
  if (!substrate) {
    const actions = document.createElement("div"); actions.className = "layer-actions";
    for (const [action, label, disabled] of [["up", "Move up", index === 0], ["down", "Move down", index === state.layers.length - 1], ["duplicate", "Duplicate", state.layers.length === 12], ["remove", "Remove", state.layers.length === 1]] as [keyof typeof LAYER_ACTION_ICONS, string, boolean][]) {
      const button = document.createElement("button"); button.type = "button"; button.dataset.action = action; button.disabled = disabled; button.setAttribute("aria-label", `${label} ${material.name}`); appendLayerActionIcon(button, action); actions.append(button);
    }
    header.append(actions);
  }
  const selectors = document.createElement("div"); selectors.className = "field-pair";
  const modelChoices = Object.hasOwn(MULTILAYER_MODEL_LABELS, material.model) ? MULTILAYER_MODEL_LABELS : { ...MULTILAYER_MODEL_LABELS, [material.model]: modelLabel(material.model) };
  selectors.append(selectControl("Optical model", "model", modelChoices, material.model));
  const components = document.createElement("fieldset"); components.className = "component-selector"; components.hidden = material.model !== "composite";
  const legend = document.createElement("legend"); legend.textContent = "Additive dielectric components"; components.append(legend);
  for (const [field, key, label] of [["tl-count", "taucLorentz", "Tauc–Lorentz oscillators"], ["lorentz-count", "lorentz", "Lorentz oscillators"]]) {
    const control = document.createElement("label"); control.className = "component-count"; control.textContent = label;
    const select = document.createElement("select"); select.dataset.field = field;
    for (let count = 0; count <= 5; count += 1) { const option = document.createElement("option"); option.value = String(count); option.textContent = String(count); option.selected = count === material.components[key]; select.append(option); }
    control.append(select); components.append(control);
  }
  for (const [component, label] of Object.entries(COMPONENT_LABELS)) { const control = checkControl(label, "component", material.components[component], false); control.querySelector("input").dataset.component = component; components.append(control); }
  const ema = document.createElement("fieldset"); ema.className = "component-selector ema-selector"; ema.hidden = material.model !== "ema";
  const emaLegend = document.createElement("legend"); emaLegend.textContent = "Effective-medium constituents"; ema.append(emaLegend);
  ema.append(selectControl("Mixing rule", "ema-method", { bruggeman: "Bruggeman (symmetric)", "maxwell-garnett": "Maxwell–Garnett (inclusions in host)" }, material.ema.method));
  for (const role of ["host", "inclusion"]) {
    const label = `${role[0].toUpperCase()}${role.slice(1)} n,k table`;
    ema.append(fileControl(material.id, label, `ema-${role}-file`, material.ema[`${role}Source`]));
  }
  const reference = document.createElement("div"); reference.className = "layer-reference"; reference.hidden = material.model === "ema";
  reference.append(fileControl(material.id, `${substrate ? "Substrate" : "Layer"} n,k table`, "nk-file", material.nkSource));
  const flags = document.createElement("div"); flags.className = "layer-flags";
  if (!substrate) flags.append(checkControl("Active n,k plot", "active", state.activeLayerId === material.id, false, "radio"));
  flags.append(checkControl("Regularize to n,k", "regularize", material.regularize, !material.nk || material.model === "fixed" || material.model === "ema"));
  const tableHeader = document.createElement("div"); tableHeader.className = "parameter-header";
  for (const text of ["Fit", "Parameter", "Value", "Min", "Max", "1σ"]) { const span = document.createElement("span"); span.textContent = text; tableHeader.append(span); }
  const table = document.createElement("div"); table.className = "parameter-table";
  for (const [parameter, specification] of Object.entries(material.specs)) table.append(parameterRow(material, parameter, specification));
  const editor = document.createElement("details"); editor.className = "layer-editor"; editor.setAttribute("name", "material-editor"); editor.open = !substrate && material.id === state.activeLayerId;
  const summary = document.createElement("summary"); summary.textContent = substrate ? "Edit substrate model" : "Edit optical model and fit parameters";
  const body = document.createElement("div"); body.className = "layer-editor-body"; body.append(selectors, renderModelHelp(material), components, ema, reference, flags, tableHeader, table);
  editor.append(summary, body); card.append(header, editor);
  return card;
}

function renderStackDiagram() {
  const fromSubstrate = elements.incidence.value === "substrate";
  elements["stack-direction"].textContent = `INCIDENT / ${fromSubstrate ? "SUBSTRATE" : "STACK"} SIDE`;
  elements["stack-arrow"].textContent = fromSubstrate ? "↑" : "↓";

  const layers = [];
  for (const [index, layer] of state.layers.entries()) {
    const item = document.createElement("li"); item.className = "stack-layer"; item.classList.toggle("active", layer.id === state.activeLayerId);
    const order = document.createElement("span"); order.className = "stack-layer-order"; order.textContent = String(index + 1).padStart(2, "0");
    const identity = document.createElement("div");
    const name = document.createElement("strong"); name.textContent = layer.name;
    const model = document.createElement("small"); model.textContent = modelLabel(layer.model);
    identity.append(name, model);
    const thickness = document.createElement("span"); thickness.className = "stack-thickness"; thickness.textContent = `${format(layer.specs.thicknessNm?.value, 2)} nm`;
    item.append(order, identity, thickness); layers.push(item);
  }
  elements["stack-layers"].replaceChildren(...layers);
  const substrateDescription = state.substrate.model === "constant" ? `N = ${format(state.substrate.specs.n.value, 3)} + ${format(state.substrate.specs.k.value, 3)}i` : modelLabel(state.substrate.model);
  elements["stack-substrate-index"].textContent = `${substrateDescription} · ${format(Number(elements["substrate-thickness"].value), 3)} µm`;
}

function selectControl(labelText, field, choices: Record<string, string>, value) {
  const label = document.createElement("label"); label.textContent = labelText;
  const select = document.createElement("select"); select.dataset.field = field;
  for (const [choice, text] of Object.entries(choices)) { const option = document.createElement("option"); option.value = choice; option.textContent = text; option.selected = choice === value; select.append(option); }
  label.append(select); return label;
}

function fileControl(materialId, labelText, field, sourceText) {
  const control = document.createElement("div"); control.className = "native-file-control";
  const label = document.createElement("span"); label.className = "native-file-label"; label.textContent = labelText;
  const input = document.createElement("input"); input.type = "file"; input.accept = ".txt,text/plain"; input.dataset.field = field; input.className = "visually-hidden"; input.id = `${materialId}-${field}`;
  const trigger = document.createElement("label"); trigger.className = "native-file-trigger"; trigger.htmlFor = input.id; trigger.textContent = "Choose file";
  input.setAttribute("aria-label", `Choose file for ${labelText}`);
  const source = document.createElement("p"); source.id = `${input.id}-source`; source.className = "model-note"; source.textContent = sourceText ?? "No n,k table loaded.";
  input.setAttribute("aria-describedby", source.id);
  control.append(label, input, trigger, source);
  return control;
}

function checkControl(text, field, checked, disabled, type = "checkbox") {
  const label = document.createElement("label"); label.className = "check";
  const input = document.createElement("input"); input.type = type; input.name = type === "radio" ? "active-layer" : ""; input.dataset.field = field; input.checked = checked; input.disabled = disabled;
  const span = document.createElement("span"); span.textContent = text; label.append(input, span); return label;
}

function parameterRow(layer, parameter, specification) {
  const row = document.createElement("div"); row.className = "parameter-row"; row.dataset.parameter = parameter;
  const linkedSource = layer.links?.[parameter]; row.classList.toggle("parameter-linked", Boolean(linkedSource));
  const fit = document.createElement("input"); fit.type = "checkbox"; fit.dataset.kind = "fit"; fit.checked = specification.fit; fit.disabled = Boolean(linkedSource); fit.setAttribute("aria-label", `Fit ${layer.name} ${specification.label}`);
  const fitControl = document.createElement("label"); fitControl.className = "parameter-fit-control";
  const fitLabel = document.createElement("span"); fitLabel.textContent = "Fit"; fitControl.append(fit, fitLabel);
  const description = parameterDescription(parameter);
  const label = document.createElement("span"); label.className = "parameter-name";
  const owner = document.createElement("span"); owner.className = "parameter-owner"; owner.textContent = layer.name;
  label.append(owner, document.createTextNode(specification.label));
  const helpId = `${layer.id}-${parameter}-help`;
  const helpButton = document.createElement("button"); helpButton.type = "button"; helpButton.className = "parameter-help-button"; helpButton.textContent = "i"; helpButton.setAttribute("aria-label", `Information for ${specification.label}`); helpButton.setAttribute("aria-controls", helpId); helpButton.setAttribute("aria-expanded", "false"); label.append(helpButton);
  const help = document.createElement("span"); help.id = helpId; help.className = "parameter-help-popover"; help.setAttribute("role", "tooltip"); help.hidden = true; help.textContent = description; label.append(help);
  if (specification.unit) { const unit = document.createElement("span"); unit.className = "parameter-unit"; unit.textContent = specification.unit; label.append(unit); }
  if (layer.id !== "substrate") {
    const candidates = state.layers.slice(0, state.layers.indexOf(layer)).filter((candidate) => candidate.specs[parameter]);
    if (candidates.length) {
      const link = document.createElement("select"); link.className = "parameter-link"; link.dataset.field = "parameter-link"; link.dataset.parameter = parameter; link.setAttribute("aria-label", `Link ${layer.name} ${specification.label}`);
      const independent = document.createElement("option"); independent.value = ""; independent.textContent = "Independent"; link.append(independent);
      for (const candidate of candidates) { const option = document.createElement("option"); option.value = `${candidate.id}__${parameter}`; option.textContent = `Link to ${candidate.name}`; option.selected = option.value === linkedSource; link.append(option); }
      label.append(link);
    }
  }
  row.append(fitControl, label);
  for (const [kind, value] of [["value", specification.value], ["minimum", specification.minimum], ["maximum", specification.maximum]]) {
    const field = document.createElement("label"); field.className = `parameter-field parameter-field-${kind}`;
    const fieldLabel = document.createElement("span"); fieldLabel.textContent = kind === "value" ? "Value" : kind === "minimum" ? "Min" : "Max";
    const input = document.createElement("input"); input.type = "number"; input.step = "any"; input.dataset.kind = kind; input.value = String(value); input.disabled = Boolean(linkedSource); input.setAttribute("aria-label", `${kind} ${layer.name} ${specification.label}`);
    field.append(fieldLabel, input); row.append(field);
  }
  const uncertaintyField = document.createElement("span"); uncertaintyField.className = "parameter-field parameter-uncertainty-field";
  const uncertaintyLabel = document.createElement("span"); uncertaintyLabel.textContent = "1σ";
  const uncertainty = document.createElement("span"); uncertainty.className = "parameter-uncertainty"; uncertainty.textContent = specification.uncertainty ?? "—";
  uncertaintyField.append(uncertaintyLabel, uncertainty); row.append(uncertaintyField);
  return row;
}

function handleParameterHelp(event) {
  const button = event.target.closest(".parameter-help-button"); if (!button) return;
  event.stopPropagation();
  const help = document.getElementById(button.getAttribute("aria-controls")); if (!help) return;
  const open = help.hidden; closeParameterHelp();
  help.hidden = !open; button.setAttribute("aria-expanded", String(open));
  if (open) button.setAttribute("aria-describedby", help.id);
}

function closeParameterHelp() {
  for (const button of document.querySelectorAll('.parameter-help-button[aria-expanded="true"]')) {
    const help = document.getElementById(button.getAttribute("aria-controls")); if (help) help.hidden = true;
    button.setAttribute("aria-expanded", "false"); button.removeAttribute("aria-describedby");
  }
}

function renderModelHelp(layer) {
  const guide = MODEL_GUIDES[layer.model];
  const details = document.createElement("details"); details.className = "model-help";
  const summary = document.createElement("summary"); summary.textContent = `Model guide · ${modelLabel(layer.model)}`;
  const body = document.createElement("div"); body.className = "model-help-body";
  const description = document.createElement("p"); description.className = "model-summary"; description.textContent = guide.summary;
  body.append(description, equationBlock(guide.equation), helpFact("Typically represents", guide.represents), helpFact("Scope / limitation", guide.limitation));

  const activeGuides = [];
  if (layer.model === "composite") {
    if (layer.components.taucLorentz) activeGuides.push([`${layer.components.taucLorentz} × Tauc–Lorentz`, COMPONENT_GUIDES.taucLorentz]);
    if (layer.components.lorentz) activeGuides.push([`${layer.components.lorentz} × Lorentz`, COMPONENT_GUIDES.lorentz]);
    for (const component of Object.keys(COMPONENT_LABELS)) if (layer.components[component]) activeGuides.push([COMPONENT_LABELS[component], COMPONENT_GUIDES[component]]);
  } else if (layer.model === "ema") activeGuides.push([EMA_RULE_GUIDES[layer.ema.method].title, EMA_RULE_GUIDES[layer.ema.method]]);

  if (activeGuides.length) {
    const heading = document.createElement("h4"); heading.textContent = "Active contributions"; body.append(heading);
    for (const [title, activeGuide] of activeGuides) {
      const section = document.createElement("section"); section.className = "model-component";
      const componentTitle = document.createElement("h5"); componentTitle.textContent = title;
      const componentSummary = document.createElement("p"); componentSummary.textContent = activeGuide.summary ?? activeGuide.represents;
      section.append(componentTitle, componentSummary, equationBlock(activeGuide.equation));
      if (activeGuide.summary && activeGuide.represents) section.append(helpFact("Typically represents", activeGuide.represents));
      body.append(section);
    }
  }

  const parameterHeading = document.createElement("h4"); parameterHeading.textContent = "Parameters in this material";
  const parameters = document.createElement("dl"); parameters.className = "model-parameter-help";
  for (const [name, specification] of Object.entries(layer.specs) as [string, any][]) {
    const term = document.createElement("dt"); term.textContent = `${specification.label}${specification.unit ? ` (${specification.unit})` : ""}`;
    const definition = document.createElement("dd"); definition.textContent = parameterDescription(name);
    parameters.append(term, definition);
  }
  body.append(parameterHeading, parameters);

  const references = [guide, ...activeGuides.map(([, activeGuide]) => activeGuide)].flatMap((item) => item.references ?? []);
  const uniqueReferences = [...new Map(references.map((item) => [item.doi.toLowerCase(), item])).values()];
  const referenceHeading = document.createElement("h4"); referenceHeading.textContent = "References";
  const referenceList = document.createElement("ul"); referenceList.className = "model-references";
  for (const item of uniqueReferences) {
    const entry = document.createElement("li"); entry.append(document.createTextNode(`${item.citation} `));
    const link = document.createElement("a"); link.href = `https://doi.org/${item.doi}`; link.target = "_blank"; link.rel = "noreferrer"; link.textContent = item.doi; entry.append(link); referenceList.append(entry);
  }
  const notation = document.createElement("p"); notation.className = "model-notation"; notation.textContent = "Notation: E = hc/λ in eV; N = n + ik; ε = N². Equations follow the implementation used by this tool.";
  body.append(referenceHeading, referenceList, notation);
  details.append(summary, body);
  return details;
}

function equationBlock(equation) {
  const block = document.createElement("div"); block.className = "scientific-equation";
  block.innerHTML = `<math xmlns="http://www.w3.org/1998/Math/MathML" display="block" aria-label="${equation.label}">${equation.mathml}</math>`;
  return block;
}

function helpFact(label, text) {
  const paragraph = document.createElement("p"); paragraph.className = "model-fact";
  const strong = document.createElement("strong"); strong.textContent = `${label}: `; paragraph.append(strong, document.createTextNode(text)); return paragraph;
}

async function handleLayerChange(event) {
  const card = event.target.closest(".layer-card"); if (!card) return;
  const layer = materialById(card.dataset.layerId); if (!layer) return;
  pushHistory();
  if (event.target.dataset.kind) { captureLayerInputs(); synchronizeLinkedParameters(); renderLayers(); return; }
  const field = event.target.dataset.field;
  if (field === "name") { layer.name = event.target.value.trim() || layer.name; renderStackDiagram(); commitHistorySnapshot(); return; }
  if (field === "active") { state.activeLayerId = layer.id; renderStackDiagram(); drawAll(); commitHistorySnapshot(); return; }
  if (field === "regularize") { layer.regularize = event.target.checked; commitHistorySnapshot(); return; }
  if (field === "parameter-link") {
    captureLayerInputs(); const parameter = event.target.dataset.parameter;
    if (event.target.value) layer.links[parameter] = event.target.value; else delete layer.links[parameter];
    synchronizeLinkedParameters(); renderLayers(); previewModel(); return;
  }
  if (field === "component") {
    captureLayerInputs();
    const component = event.target.dataset.component; layer.components[component] = event.target.checked;
    if (event.target.checked && component === "drude") layer.components.drudeSmith = false;
    if (event.target.checked && component === "drudeSmith") layer.components.drude = false;
    rebuildLayerSpecs(layer); renderLayers(); previewModel(); return;
  }
  if (field === "tl-count" || field === "lorentz-count") {
    captureLayerInputs(); layer.components[field === "tl-count" ? "taucLorentz" : "lorentz"] = Number(event.target.value); rebuildLayerSpecs(layer); renderLayers(); previewModel(); return;
  }
  if (field === "ema-method") { layer.ema.method = event.target.value; previewModel(); return; }
  if (field === "ema-host-file" || field === "ema-inclusion-file") {
    if (!event.target.files[0]) return;
    const role = field.includes("host") ? "host" : "inclusion";
    try {
      captureLayerInputs(); layer.ema[`${role}Nk`] = loadNkTable(await event.target.files[0].text()); layer.ema[`${role}Source`] = event.target.files[0].name; renderLayers(); previewModel();
    } catch (error) { showError(error); }
    return;
  }
  if (field === "nk-file") {
    if (!event.target.files[0]) return;
    try { captureLayerInputs(); layer.nk = loadNkTable(await event.target.files[0].text()); layer.nkSource = event.target.files[0].name; layer.regularize = false; rebuildLayerSpecs(layer); renderLayers(); previewModel(); }
    catch (error) { showError(error); }
    return;
  }
  captureLayerInputs();
  if (field === "model") {
    try { layer.model = event.target.value; layer.regularize = false; rebuildLayerSpecs(layer); renderLayers(); previewModel(); }
    catch (error) { showError(error); }
  }
}

function handleLayerClick(event) {
  const button = event.target.closest("button[data-action]"); if (!button) return;
  const card = button.closest(".layer-card"); const index = state.layers.findIndex((layer) => layer.id === card?.dataset.layerId); if (index < 0) return;
  pushHistory();
  captureLayerInputs();
  if (button.dataset.action === "remove") { const [removed] = state.layers.splice(index, 1); if (state.activeLayerId === removed.id) state.activeLayerId = state.layers[Math.max(0, index - 1)].id; renderLayers(); previewModel(`${removed.name} removed. Model preview updated; undo is available.`); }
  if (button.dataset.action === "up" || button.dataset.action === "down") { const moved = state.layers[index]; const target = index + (button.dataset.action === "up" ? -1 : 1); [state.layers[index], state.layers[target]] = [state.layers[target], state.layers[index]]; renderLayers(); previewModel(`${moved.name} moved to position ${target + 1}. Model preview updated; undo is available.`); }
  if (button.dataset.action === "duplicate") {
    const original = state.layers[index]; const copy = structuredClone(original); copy.nk = original.nk; copy.ema.hostNk = original.ema.hostNk; copy.ema.inclusionNk = original.ema.inclusionNk; copy.id = `layer${state.nextLayer++}`; copy.name = `${copy.name} copy`; copy.links = {};
    state.layers.splice(index + 1, 0, copy); state.activeLayerId = copy.id; renderLayers(); previewModel(`${original.name} duplicated as ${copy.name}. Model preview updated; undo is available.`);
  }
}

function captureLayerInputs() {
  for (const card of document.querySelectorAll<HTMLElement>("#layers .layer-card, #substrate-editor .layer-card")) {
    const layer = materialById(card.dataset.layerId); if (!layer) continue;
    layer.name = card.querySelector<HTMLInputElement>('[data-field="name"]')?.value.trim() || layer.name;
    for (const row of card.querySelectorAll<HTMLElement>(".parameter-row")) {
      const specification = layer.specs[row.dataset.parameter]; if (!specification) continue;
      specification.fit = row.querySelector<HTMLInputElement>('[data-kind="fit"]')!.checked;
      for (const kind of ["value", "minimum", "maximum"]) specification[kind] = Number(row.querySelector<HTMLInputElement>(`[data-kind="${kind}"]`)!.value);
    }
  }
}

function configuration() {
  captureLayerInputs();
  if (!state.layers.length) throw new Error("Add at least one layer.");
  const useReflectance = elements["use-r"].checked; const useTransmittance = elements["use-t"].checked;
  if (!useReflectance && !useTransmittance) throw new Error("Select R, T, or both channels.");
  const initial = { rGain: numberValue("r-gain", 0.1, 10), tGain: numberValue("t-gain", 0.1, 10) };
  const bounds = { rGain: [0.1, 10], tGain: [0.1, 10] }; const fittedParameters = [];
  if (elements["fit-r-gain"].checked && useReflectance) fittedParameters.push("rGain");
  if (elements["fit-t-gain"].checked && useTransmittance) fittedParameters.push("tGain");
  for (const layer of state.layers) {
    if (TABLE_MODELS.has(layer.model) && !layer.nk) throw new Error(`${layer.name}: ${MODEL_LABELS[layer.model]} requires an n,k table.`);
    if (layer.model === "composite" && !layer.components.taucLorentz && !layer.components.lorentz && !Object.keys(COMPONENT_LABELS).some((name) => layer.components[name])) throw new Error(`${layer.name}: select at least one dielectric component.`);
    if (layer.model === "ema" && (!layer.ema.hostNk || !layer.ema.inclusionNk)) throw new Error(`${layer.name}: load both EMA constituent n,k tables.`);
    for (const [name, specification] of Object.entries(layer.specs) as [string, any][]) {
      const key = `${layer.id}__${name}`; const { value, minimum, maximum } = specification;
      if (![value, minimum, maximum].every(Number.isFinite) || minimum >= maximum || value < minimum || value > maximum) throw new Error(`${layer.name}: ${specification.label} must have a finite value inside valid bounds.`);
      initial[key] = value; bounds[key] = [minimum, maximum]; if (specification.fit) fittedParameters.push(key);
    }
  }
  const substrate = state.substrate;
  if (TABLE_MODELS.has(substrate.model) && !substrate.nk) throw new Error(`Substrate: ${MODEL_LABELS[substrate.model]} requires an n,k table.`);
  if (substrate.model === "composite" && !substrate.components.taucLorentz && !substrate.components.lorentz && !Object.keys(COMPONENT_LABELS).some((name) => substrate.components[name])) throw new Error("Substrate: select at least one dielectric component.");
  if (substrate.model === "ema" && (!substrate.ema.hostNk || !substrate.ema.inclusionNk)) throw new Error("Substrate: load both EMA constituent n,k tables.");
  for (const [name, specification] of Object.entries(substrate.specs) as [string, any][]) {
    const key = `substrate__${name}`; const { value, minimum, maximum } = specification;
    if (![value, minimum, maximum].every(Number.isFinite) || minimum >= maximum || value < minimum || value > maximum) throw new Error(`Substrate: ${specification.label} must have a finite value inside valid bounds.`);
    initial[key] = value; bounds[key] = [minimum, maximum]; if (specification.fit) fittedParameters.push(key);
  }
  const parameterLinks = Object.fromEntries(state.layers.flatMap((layer) => Object.entries(layer.links ?? {}).map(([name, source]) => [`${layer.id}__${name}`, source])));
  for (const [target, source] of Object.entries(parameterLinks)) {
    if (!Object.hasOwn(initial, target) || !Object.hasOwn(initial, source)) throw new Error(`Invalid linked parameter: ${target}.`);
    initial[target] = initial[source];
    const position = fittedParameters.indexOf(target); if (position >= 0) fittedParameters.splice(position, 1);
  }
  if (fittedParameters.length > 11) throw new Error(`Select at most 11 fitted parameters; ${fittedParameters.length} are selected.`);
  const substrateThicknessUm = numberValue("substrate-thickness", 10, 1e6);
  const minimumSubstrateThicknessUm = numberValue("wavelength-max", 196, 3000) / 100;
  if (substrateThicknessUm < minimumSubstrateThicknessUm) throw new Error(`Substrate thickness must be at least ${format(minimumSubstrateThicknessUm, 3)} µm (10× the maximum wavelength).`);
  const settings = {
    layers: state.layers.map(({ id, name, model, components, ema, nk, regularize }) => ({ id, name, model, components, ema, nk, regularize })),
    activeLayerId: state.activeLayerId,
    substrate: { model: substrate.model, components: substrate.components, ema: substrate.ema, nk: substrate.nk, regularize: substrate.regularize }, substrateThicknessNm: 1000 * substrateThicknessUm, incidence: elements.incidence.value, parameterLinks,
    useReflectance, useTransmittance,
    sigmaReflectance: numberValue("sigma-r", 0.0001, 1), sigmaTransmittance: numberValue("sigma-t", 0.0001, 1),
    sigmaN: numberValue("sigma-n", 0.0001, 10), sigmaK: numberValue("sigma-k", 0.0001, 10),
    preferSpectralShape: elements["prefer-shape"].checked,
  };
  return { settings, initial, bounds, fittedParameters };
}

function prepareCurrentData() {
  if (!state.spectrum) throw new Error("Load a measurement first.");
  let data = prepareFitData(state.spectrum, {
    wavelengthMinNm: numberValue("wavelength-min", 195, 3000), wavelengthMaxNm: numberValue("wavelength-max", 196, 3000),
    referenceThresholdFraction: numberValue("reference-threshold", 0, 99) / 100, binWidthNm: numberValue("bin-width", 0.1, 100),
    sampleSnrMinimum: numberValue("sample-snr", 0, 100), subtractBackground: elements["subtract-background"].checked,
  });
  for (const layer of state.layers.filter((candidate) => TABLE_MODELS.has(candidate.model))) data = restrictToNkRange(data, layer.nk);
  for (const layer of state.layers.filter((candidate) => candidate.model === "ema")) {
    data = restrictToNkRange(data, layer.ema.hostNk);
    data = restrictToNkRange(data, layer.ema.inclusionNk);
  }
  if (TABLE_MODELS.has(state.substrate.model)) data = restrictToNkRange(data, state.substrate.nk);
  if (state.substrate.model === "ema") { data = restrictToNkRange(data, state.substrate.ema.hostNk); data = restrictToNkRange(data, state.substrate.ema.inclusionNk); }
  state.fitData = data; publishSourceQuality(true); return data;
}

function validateChannels(data, settings) {
  if (settings.useReflectance && data.reflectanceValid.filter(Boolean).length < 10) throw new Error("Fewer than 10 reflectance bins pass the masks.");
  if (settings.useTransmittance && data.transmittanceValid.filter(Boolean).length < 10) throw new Error("Fewer than 10 transmittance bins pass the masks; disable T or revise the SNR threshold.");
}

function previewModel(message = "Model preview updated; parameters have not been optimized.") {
  if (!state.spectrum) return setStatus("Load measurement data or the synthetic example before previewing the model.");
  try {
    const config = configuration(); const fitData = prepareCurrentData(); validateChannels(fitData, config.settings);
    state.evaluation = evaluateOpticalModel(fitData, null, config.initial, config.settings);
    state.fitResult = { parameters: config.initial, evaluation: state.evaluation, diagnostics: diagnosticsOf(fitData, state.evaluation, config.settings), preview: true, configuration: config };
    renderResult(message);
    commitHistorySnapshot();
  } catch (error) { showError(error); }
}

function fitModel() {
  if (!state.spectrum) return setStatus("Load measurement data or the synthetic example before fitting.");
  try {
    const config = configuration(); const fitData = prepareCurrentData(); validateChannels(fitData, config.settings);
    if (!config.fittedParameters.length) throw new Error("Select at least one parameter to fit.");
    const screeningPoints = integerValue("screening-points", 64, 4096); if (screeningPoints & (screeningPoints - 1)) throw new Error("Sobol points must be a power of two.");
    const localRefinements = integerValue("local-refinements", 1, 50);
    pushHistory();
    startFitWorker(`Screening ${screeningPoints} Sobol points…`);
    state.pendingConfiguration = config;
    state.worker.postMessage({ fitData, nk: null, configuration: { ...config, screeningPoints, localRefinements } });
  } catch (error) { showError(error); }
}

function bootstrapUncertainty() {
  try {
    if (!state.fitResult || state.fitResult.preview) throw new Error("Run a fit before estimating bootstrap uncertainty.");
    const samples = integerValue("bootstrap-samples", 5, 200);
    startFitWorker(`Running ${samples} residual-bootstrap refits…`);
    state.worker.postMessage({ operation: "bootstrap", fitData: state.fitData, nk: null, configuration: state.fitResult.configuration, bestParameters: state.fitResult.parameters, samples });
  } catch (error) { showError(error); }
}

function handleWorkerMessage({ data }) {
  if (data.type === "progress") { elements["fit-progress"].value = data.progress; setStatus(`Fitting parameters… ${data.progress}%`); return; }
  if (data.type === "bootstrap-progress") { elements["fit-progress"].value = data.progress; setStatus(`Bootstrap refits… ${data.progress}%`); return; }
  if (data.type === "bootstrap-result") {
    stopFitWorker();
    state.fitResult.diagnostics.bootstrap = data.result;
    renderResult(`Bootstrap complete: ${data.result.successfulSamples} of ${data.result.requestedSamples} refits converged.`); return;
  }
  if (data.type === "error") return finishFitError(data.message);
  if (data.type !== "result") return;
  stopFitWorker();
  state.fitResult = { ...data.result, configuration: state.pendingConfiguration }; state.pendingConfiguration = null; state.evaluation = data.result.evaluation;
  for (const layer of [...state.layers, state.substrate]) for (const specificationName of Object.keys(layer.specs)) {
    const key = `${layer.id}__${specificationName}`; layer.specs[specificationName].value = data.result.parameters[key];
    layer.specs[specificationName].uncertainty = formatUncertainty(data.result.diagnostics.parameterStandardErrorsApproximate[key]);
  }
  synchronizeLinkedParameters(data.result.parameters);
  elements["r-gain"].value = data.result.parameters.rGain; elements["t-gain"].value = data.result.parameters.tGain;
  renderLayers();
  renderResult(data.result.optimizer.selectedSolver.success ? "Fit complete." : `Fit stopped: ${data.result.optimizer.selectedSolver.message}`);
}

function startFitWorker(message) {
  if (state.worker) state.worker.terminate();
  state.worker = new Worker(new URL("./scientific/workers/fit-worker.ts", import.meta.url), { type: "module" });
  state.worker.addEventListener("message", handleWorkerMessage); state.worker.addEventListener("error", (event) => finishFitError(event.message));
  elements["fit-progress"].hidden = false; elements["fit-progress"].value = 0; elements["cancel-operation"].hidden = false; setBusy(true, message);
}

function markResultStale() {
  if (!state.fitResult) return;
  state.resultStale = true;
  for (const id of ["download-json", "download-csv", "download-nk", "print-report", "bootstrap-button"]) elements[id].disabled = true;
  updateBootstrapGuidance();
  setStatus("Configuration changed. Preview the model or run a new fit; displayed results are stale.");
}

function stopFitWorker() { if (state.worker) state.worker.terminate(); state.worker = null; elements["fit-progress"].hidden = true; elements["cancel-operation"].hidden = true; setBusy(false); }
function cancelOperation() { if (!state.worker) return; stopFitWorker(); state.pendingConfiguration = null; setStatus(state.resultStale ? "Calculation cancelled; displayed results still precede the current configuration." : "Calculation cancelled; previous valid results were kept."); }
function finishFitError(message) { stopFitWorker(); state.pendingConfiguration = null; showError(new Error(message)); }

function renderResult(message) {
  state.resultStale = false;
  elements["results-empty"].hidden = true;
  elements["results-content"].hidden = false;
  const result = state.fitResult; const diagnostics = result.diagnostics;
  elements["metric-thickness"].textContent = format(state.layers.reduce((sum, layer) => sum + result.parameters[`${layer.id}__thicknessNm`], 0), 2);
  elements["metric-rmse-r"].textContent = formatNullable(diagnostics.rmseReflectance, 5);
  elements["metric-rmse-t"].textContent = formatNullable(diagnostics.rmseTransmittance, 5);
  elements["metric-parameters"].textContent = String(result.configuration?.fittedParameters?.length ?? result.optimizer?.logarithmicallySampledParameters?.length ?? selectedFitCount());
  elements["diagnostic-convergence"].textContent = result.preview ? "Preview" : result.optimizer.selectedSolver.success ? "Converged" : "Stopped";
  elements["diagnostic-evaluations"].textContent = result.preview ? "No optimizer run" : `${result.optimizer.selectedSolver.evaluations} selected-start evaluations`;
  elements["diagnostic-condition"].textContent = Number.isFinite(diagnostics.normalizedJacobianCondition) ? Number(diagnostics.normalizedJacobianCondition).toExponential(2) : "—";
  elements["diagnostic-bounds"].textContent = diagnostics.parametersAtBounds.length ? diagnostics.parametersAtBounds.join(", ") : "None";
  elements["diagnostic-power"].textContent = format(diagnostics.maximumPowerBalance, 5);
  elements["diagnostic-note"].textContent = diagnostics.nearEqualAlternativeMinima > 0 ? `${diagnostics.nearEqualAlternativeMinima} near-equal alternative minima were found; report parameter ambiguity.` : "Check residual structure, bound hits, and Jacobian conditioning before interpreting fitted optical constants.";
  elements["report-meta"].textContent = `Reflectometry fit report · ${state.source?.sampleName ?? "sample"} · generated ${new Date().toLocaleString("en-GB")}`;
  for (const id of ["download-json", "download-csv", "download-nk", "print-report", "bootstrap-button"]) elements[id].disabled = Boolean(result.preview);
  updateBootstrapGuidance();
  renderUncertainty(diagnostics); renderAlternativeSolutions(diagnostics.alternativeSolutions ?? []);
  setStatus(message); drawAll();
}

function parameterLabel(key) {
  if (key === "rGain") return "R gain"; if (key === "tGain") return "T gain";
  const separator = key.indexOf("__"); if (separator < 0) return key;
  const material = materialById(key.slice(0, separator)); const name = key.slice(separator + 2);
  return `${material?.name ?? key.slice(0, separator)} · ${material?.specs[name]?.label ?? name}`;
}

function renderUncertainty(diagnostics) {
  const bootstrap = diagnostics.bootstrap; const local = diagnostics.parameterConfidenceIntervals95Approximate ?? {};
  const intervals = bootstrap?.parameterIntervals ?? local;
  const correlation = bootstrap?.parameterCorrelation ?? diagnostics.parameterCorrelation;
  const content = document.createDocumentFragment();
  const note = document.createElement("p"); note.textContent = bootstrap ? `${bootstrap.method}; ${bootstrap.successfulSamples}/${bootstrap.requestedSamples} successful refits, deterministic seed ${bootstrap.seed}.` : "Approximate 95% intervals and correlations from the local Jacobian. Run the bootstrap before reporting uncertainty."; content.append(note);
  if (Object.keys(intervals).length) {
    const table = document.createElement("table"); table.className = "scientific-data-table uncertainty-data-table";
    const caption = document.createElement("caption"); caption.className = "visually-hidden"; caption.textContent = "Approximate 95% parameter intervals";
    const tableHead = document.createElement("thead"); const head = document.createElement("tr");
    for (const label of ["Parameter", "Lower 95%", "Estimate", "Upper 95%"]) { const cell = document.createElement("th"); cell.scope = "col"; cell.textContent = label; head.append(cell); }
    tableHead.append(head); const tableBody = document.createElement("tbody");
    for (const [name, interval] of Object.entries(intervals) as [string, any][]) if (interval) {
      const row = document.createElement("tr");
      const parameter = document.createElement("th"); parameter.scope = "row"; parameter.textContent = parameterLabel(name); row.append(parameter);
      for (const value of [format(interval.lower95, 5), format(state.fitResult.parameters[name] ?? interval.median, 5), format(interval.upper95, 5)]) { const cell = document.createElement("td"); cell.textContent = value; row.append(cell); }
      tableBody.append(row);
    }
    table.append(caption, tableHead, tableBody);
    content.append(table);
  }
  if (correlation?.matrix?.length) {
    const heading = document.createElement("h3"); heading.textContent = "Parameter correlation"; content.append(heading);
    const table = document.createElement("table"); table.className = "scientific-data-table correlation-data-table";
    const caption = document.createElement("caption"); caption.className = "visually-hidden"; caption.textContent = "Parameter correlation matrix";
    const tableHead = document.createElement("thead"); const head = document.createElement("tr"); const corner = document.createElement("th"); corner.scope = "col"; head.append(corner);
    for (const name of correlation.names) { const cell = document.createElement("th"); cell.scope = "col"; cell.textContent = parameterLabel(name); head.append(cell); }
    tableHead.append(head); const tableBody = document.createElement("tbody");
    correlation.matrix.forEach((values, rowIndex) => {
      const row = document.createElement("tr"); const label = document.createElement("th"); label.scope = "row"; label.textContent = parameterLabel(correlation.names[rowIndex]); row.append(label);
      values.forEach((value) => { const cell = document.createElement("td"); cell.textContent = format(value, 2); cell.dataset.correlation = value >= 0 ? "positive" : "negative"; cell.style.setProperty("--correlation-strength", `${8 + 52 * Math.abs(value)}%`); row.append(cell); }); tableBody.append(row);
    });
    table.append(caption, tableHead, tableBody); content.append(table);
  }
  elements["uncertainty-content"].replaceChildren(content);
}

function renderAlternativeSolutions(solutions) {
  if (!solutions.length) { const note = document.createElement("p"); note.textContent = "No distinct local alternatives were retained."; elements["solutions-content"].replaceChildren(note); return; }
  const cards = solutions.map((solution, index) => {
    const card = document.createElement("article"); card.className = "fit-solution";
    const title = document.createElement("strong"); title.textContent = `Solution ${solution.rank}`;
    const channelMetrics = (Object.entries(solution.channelMetrics ?? {}) as [string, any][]).map(([channel, values]) => `${channel} RMSE ${format(values.rmse, 5)}`).join(" · ");
    const metrics = document.createElement("span"); metrics.textContent = `Δcost ${format(100 * solution.relativeCostIncrease, 2)}% · distance ${format(solution.normalizedParameterDistanceFromBest, 3)}${channelMetrics ? ` · ${channelMetrics}` : ""}${solution.fittedParametersAtBounds?.length ? ` · bounds: ${solution.fittedParametersAtBounds.length}` : ""}`;
    const button = document.createElement("button"); button.type = "button"; button.className = "solution-action"; button.dataset.solution = String(index); button.textContent = "Use as new start";
    card.append(title, metrics, button); return card;
  }); elements["solutions-content"].replaceChildren(...cards);
}

function applyAlternativeSolution(index) {
  const alternatives = state.fitResult?.diagnostics.alternativeSolutions ?? []; const solution = alternatives[index]; if (!solution) return;
  pushHistory();
  for (const material of [...state.layers, state.substrate]) for (const name of Object.keys(material.specs)) if (Number.isFinite(solution.parameters[`${material.id}__${name}`])) material.specs[name].value = solution.parameters[`${material.id}__${name}`];
  elements["r-gain"].value = String(solution.parameters.rGain); elements["t-gain"].value = String(solution.parameters.tGain); synchronizeLinkedParameters(solution.parameters); renderLayers(); previewModel();
  state.fitResult.diagnostics.alternativeSolutions = alternatives; renderAlternativeSolutions(alternatives);
  setStatus(`Solution ${solution.rank} loaded as editable starting values.`);
}

function drawAll() {
  if (!state.fitData || !state.evaluation) return;
  const x = state.fitData.wavelengthNm;
  const bootstrapBands = state.fitResult?.diagnostics.bootstrap?.bands;
  drawChart(elements["rt-chart"], x, [
    ...(bootstrapBands ? [{ lower: bootstrapBands.reflectance.map((entry) => entry.lower95), upper: bootstrapBands.reflectance.map((entry) => entry.upper95), color: PLOT_BLUE_BAND, band: true }, { lower: bootstrapBands.transmittance.map((entry) => entry.lower95), upper: bootstrapBands.transmittance.map((entry) => entry.upper95), color: PLOT_TEAL_BAND, band: true }] : []),
    { label: "R data", values: state.fitData.reflectance.map((value, index) => state.fitData.reflectanceValid[index] ? value : NaN), color: PLOT_BLUE, points: true, marker: "circle", line: false },
    { label: "R model", values: state.evaluation.reflectanceScaled, color: PLOT_BLUE },
    { label: "T data", values: state.fitData.transmittance.map((value, index) => state.fitData.transmittanceValid[index] ? value : NaN), color: PLOT_TEAL, points: true, marker: "square", line: false },
    { label: "T model", values: state.evaluation.transmittanceScaled, color: PLOT_TEAL, dash: [7, 4] },
  ], { minimumY: 0, yLabel: "Reflectance / transmittance", xLabel: "Wavelength (nm)" });
  drawChart(elements["residual-chart"], x, [
    { label: "R residual", values: state.evaluation.reflectanceScaled.map((value, index) => state.fitData.reflectanceValid[index] ? value - state.fitData.reflectance[index] : NaN), color: PLOT_BLUE },
    { label: "T residual", values: state.evaluation.transmittanceScaled.map((value, index) => state.fitData.transmittanceValid[index] ? value - state.fitData.transmittance[index] : NaN), color: PLOT_TEAL, dash: [7, 4] },
  ], { symmetricY: true, zeroLine: true, yLabel: "Residual (model − data)", xLabel: "Wavelength (nm)" });
  const active = state.evaluation.layerIndices.find((layer) => layer.id === state.activeLayerId) ?? state.evaluation.layerIndices[0];
  elements["nk-layer-label"].textContent = `${active.name} · ${modelLabel(active.model)}`;
  const activeBands = bootstrapBands?.layers?.[active.id] ?? (bootstrapBands?.layerId === active.id ? bootstrapBands : null);
  const indexBands = activeBands ? [{ lower: activeBands.n.map((entry) => entry.lower95), upper: activeBands.n.map((entry) => entry.upper95), color: PLOT_BLUE_BAND, band: true }, { lower: activeBands.k.map((entry) => entry.lower95), upper: activeBands.k.map((entry) => entry.upper95), color: PLOT_TEAL_BAND, band: true }] : [];
  drawChart(elements["nk-chart"], x, [...indexBands, { label: "n", values: active.n, color: PLOT_BLUE }, { label: "k", values: active.k, color: PLOT_TEAL, dash: [7, 4] }], { minimumY: 0, yLabel: "Optical constants, n and k", xLabel: "Wavelength (nm)" });
}

function drawCanvasChart(canvas, x, series, options) {
  const fullMinimumX = Math.min(...x); const fullMaximumX = Math.max(...x); const existing = chartStates.get(canvas);
  const chart = existing && existing.fullMinimumX === fullMinimumX && existing.fullMaximumX === fullMaximumX ? existing : { minimumX: fullMinimumX, maximumX: fullMaximumX, hoverIndex: null, dragging: false };
  Object.assign(chart, { x, series, options, fullMinimumX, fullMaximumX });
  chartStates.set(canvas, chart);
  renderChart(canvas);
}

function niceTicks(minimum, maximum, target = 5) {
  const range = Math.max(Number.EPSILON, maximum - minimum); const exponent = Math.floor(Math.log10(range / target)); const fraction = range / target / 10 ** exponent;
  const step = (fraction <= 1 ? 1 : fraction <= 2 ? 2 : fraction <= 5 ? 5 : 10) * 10 ** exponent;
  const ticks = []; for (let value = Math.ceil(minimum / step) * step; value <= maximum + step * 1e-9; value += step) ticks.push(Math.abs(value) < step * 1e-9 ? 0 : value);
  return ticks;
}

function renderChart(canvas) {
  const chart = chartStates.get(canvas); if (!chart) return;
  const theme = plotTheme();
  const ratio = Math.max(1, window.devicePixelRatio || 1); const bounds = canvas.getBoundingClientRect(); const width = Math.max(260, bounds.width); const height = Math.max(240, bounds.height);
  const pixelWidth = Math.round(width * ratio); const pixelHeight = Math.round(height * ratio); canvas.width = pixelWidth; canvas.height = pixelHeight;
  const context = canvas.getContext("2d"); context.setTransform(pixelWidth / width, 0, 0, pixelHeight / height, 0, 0);
  const margin = { left: 64, right: 18, top: 18, bottom: 52 }; const plotWidth = width - margin.left - margin.right; const plotHeight = height - margin.top - margin.bottom;
  const visible = chart.x.map((value, index) => value >= chart.minimumX && value <= chart.maximumX ? index : -1).filter((index) => index >= 0);
  let values = chart.series.flatMap((entry) => visible.flatMap((index) => [entry.values?.[index], entry.lower?.[index], entry.upper?.[index]]).filter(Number.isFinite)); if (!values.length) values = [0, 1];
  const maximumAbsolute = Math.max(...values.map(Math.abs)); let yMinimum; let yMaximum;
  if (chart.options.symmetricY) { yMinimum = -(maximumAbsolute || 1) * 1.08; yMaximum = (maximumAbsolute || 1) * 1.08; }
  else { yMinimum = chart.options.minimumY ?? Math.min(...values); yMaximum = Math.max(...values); const padding = Math.max((yMaximum - yMinimum) * .06, Math.abs(yMaximum) * .02, .01); if (chart.options.minimumY == null) yMinimum -= padding; yMaximum += padding; }
  if (yMaximum <= yMinimum) yMaximum = yMinimum + 1;
  const xPixel = (value) => margin.left + (value - chart.minimumX) / (chart.maximumX - chart.minimumX || 1) * plotWidth; const yPixel = (value) => margin.top + (yMaximum - value) / (yMaximum - yMinimum) * plotHeight;
  Object.assign(chart, { geometry: { margin, plotWidth, plotHeight, width, height, xPixel, yPixel }, yMinimum, yMaximum });
  context.fillStyle = theme.background; context.fillRect(0, 0, width, height); context.font = '11px "IBM Plex Sans", "Helvetica Neue", Arial, sans-serif'; context.lineWidth = 1;
  const xTicks = niceTicks(chart.minimumX, chart.maximumX, width < 480 ? 4 : 6); const yTicks = niceTicks(yMinimum, yMaximum, 5);
  context.strokeStyle = theme.grid; context.fillStyle = theme.text;
  for (const value of yTicks) { const y = yPixel(value); context.beginPath(); context.moveTo(margin.left, y); context.lineTo(width - margin.right, y); context.stroke(); context.textAlign = "right"; context.fillText(formatTick(value), margin.left - 8, y + 4); }
  for (const value of xTicks) { const px = xPixel(value); context.beginPath(); context.moveTo(px, margin.top); context.lineTo(px, height - margin.bottom); context.stroke(); context.textAlign = "center"; context.fillText(formatTick(value), px, height - margin.bottom + 18); }
  if (chart.options.zeroLine && yMinimum < 0 && yMaximum > 0) { context.save(); context.strokeStyle = theme.axis; context.setLineDash([3, 3]); context.beginPath(); context.moveTo(margin.left, yPixel(0)); context.lineTo(width - margin.right, yPixel(0)); context.stroke(); context.restore(); }
  context.strokeStyle = theme.textPrimary; context.lineWidth = 1.2; context.beginPath(); context.moveTo(margin.left, margin.top); context.lineTo(margin.left, height - margin.bottom); context.lineTo(width - margin.right, height - margin.bottom); context.stroke();
  context.fillStyle = theme.textPrimary; context.font = '12px "IBM Plex Sans", "Helvetica Neue", Arial, sans-serif'; context.textAlign = "center"; context.fillText(chart.options.xLabel, margin.left + plotWidth / 2, height - 7);
  context.save(); context.translate(16, margin.top + plotHeight / 2); context.rotate(-Math.PI / 2); context.fillText(chart.options.yLabel, 0, 0); context.restore();
  context.save(); context.beginPath(); context.rect(margin.left, margin.top, plotWidth, plotHeight); context.clip();
  for (const entry of chart.series.filter((candidate) => candidate.band)) { context.fillStyle = entry.color; context.beginPath(); visible.forEach((index, order) => order ? context.lineTo(xPixel(chart.x[index]), yPixel(entry.lower[index])) : context.moveTo(xPixel(chart.x[index]), yPixel(entry.lower[index]))); [...visible].reverse().forEach((index) => context.lineTo(xPixel(chart.x[index]), yPixel(entry.upper[index]))); context.closePath(); context.fill(); }
  for (const entry of chart.series.filter((candidate) => !candidate.band)) {
    context.strokeStyle = entry.color; context.fillStyle = entry.color; context.lineWidth = 1.7; context.setLineDash(entry.dash ?? []);
    if (entry.line !== false) { context.beginPath(); let drawing = false; for (const index of visible) { const value = entry.values[index]; if (!Number.isFinite(value)) { drawing = false; continue; } if (drawing) context.lineTo(xPixel(chart.x[index]), yPixel(value)); else context.moveTo(xPixel(chart.x[index]), yPixel(value)); drawing = true; } context.stroke(); }
    if (entry.points) { context.setLineDash([]); const stride = Math.max(1, Math.floor(visible.length / 100)); visible.forEach((index, order) => { if (order % stride || !Number.isFinite(entry.values[index])) return; const px = xPixel(chart.x[index]); const py = yPixel(entry.values[index]); context.beginPath(); if (entry.marker === "circle") context.arc(px, py, 2.3, 0, Math.PI * 2); else context.rect(px - 2.2, py - 2.2, 4.4, 4.4); context.fill(); }); }
  }
  if (chart.hoverIndex != null) { const px = xPixel(chart.x[chart.hoverIndex]); context.save(); context.strokeStyle = theme.axis; context.lineWidth = 1; context.setLineDash([3, 3]); context.beginPath(); context.moveTo(px, margin.top); context.lineTo(px, height - margin.bottom); if (Number.isFinite(chart.hoverY)) { context.moveTo(margin.left, chart.hoverY); context.lineTo(width - margin.right, chart.hoverY); } context.stroke(); context.restore(); for (const entry of chart.series.filter((candidate) => !candidate.band)) { const value = entry.values[chart.hoverIndex]; if (!Number.isFinite(value)) continue; context.fillStyle = entry.color; context.beginPath(); context.arc(px, yPixel(value), 3.5, 0, Math.PI * 2); context.fill(); } }
  context.restore();
}

function formatTick(value) {
  const absolute = Math.abs(value); if (absolute && (absolute >= 10000 || absolute < .001)) return value.toExponential(1);
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: absolute < 1 ? 3 : absolute < 10 ? 2 : 1 }).format(value);
}

function nearestChartIndex(values, target) {
  let low = 0; let high = values.length - 1; while (low < high) { const middle = Math.floor((low + high) / 2); if (values[middle] < target) low = middle + 1; else high = middle; }
  return low > 0 && Math.abs(values[low - 1] - target) < Math.abs(values[low] - target) ? low - 1 : low;
}

function handleChartPointerMove(event) {
  const canvas = event.currentTarget; const chart = chartStates.get(canvas); if (!chart) return; const { margin, plotWidth, plotHeight } = chart.geometry;
  if (chart.dragging) { const span = chart.dragMaximumX - chart.dragMinimumX; panChart(canvas, -(event.offsetX - chart.dragX) / plotWidth * span, chart.dragMinimumX, chart.dragMaximumX); return; }
  if (event.offsetX < margin.left || event.offsetX > margin.left + plotWidth || event.offsetY < margin.top || event.offsetY > margin.top + plotHeight) return handleChartPointerLeave(event);
  const wavelength = chart.minimumX + (event.offsetX - margin.left) / plotWidth * (chart.maximumX - chart.minimumX); chart.hoverIndex = nearestChartIndex(chart.x, wavelength); chart.hoverY = event.offsetY;
  const tooltip = canvas.parentElement.querySelector(".chart-tooltip"); const lines = [`λ = ${formatTick(chart.x[chart.hoverIndex])} nm`]; for (const entry of chart.series.filter((candidate) => candidate.label)) { const value = entry.values[chart.hoverIndex]; if (Number.isFinite(value)) lines.push(`${entry.label}: ${formatTick(value)}`); }
  tooltip.textContent = lines.join("\n"); tooltip.hidden = false; tooltip.classList.toggle("align-left", event.offsetX > canvas.clientWidth * .72); tooltip.style.left = `${event.offsetX + (event.offsetX > canvas.clientWidth * .72 ? -10 : 10)}px`; tooltip.style.top = `${Math.max(6, event.offsetY - 12)}px`; renderChart(canvas);
}

function handleChartPointerLeave(event) { const canvas = event.currentTarget; const chart = chartStates.get(canvas); if (!chart || chart.dragging) return; chart.hoverIndex = null; canvas.parentElement.querySelector(".chart-tooltip").hidden = true; renderChart(canvas); }
function handleChartPointerDown(event) { const chart = chartStates.get(event.currentTarget); if (!chart || event.button !== 0) return; chart.dragging = true; chart.dragX = event.offsetX; chart.dragMinimumX = chart.minimumX; chart.dragMaximumX = chart.maximumX; event.currentTarget.setPointerCapture(event.pointerId); }
function handleChartPointerUp(event) { const chart = chartStates.get(event.currentTarget); if (!chart) return; chart.dragging = false; if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId); }

function handleChartWheel(event) {
  const canvas = event.currentTarget; const chart = chartStates.get(canvas); if (!chart) return; event.preventDefault(); const { margin, plotWidth } = chart.geometry;
  const centre = chart.minimumX + Math.max(0, Math.min(1, (event.offsetX - margin.left) / plotWidth)) * (chart.maximumX - chart.minimumX); zoomChart(canvas, Math.exp(event.deltaY * .0015), centre);
}

function handleChartKeydown(event) {
  const canvas = event.currentTarget; const chart = chartStates.get(canvas); if (!chart) return; const centre = (chart.minimumX + chart.maximumX) / 2; const span = chart.maximumX - chart.minimumX;
  if (["+", "="].includes(event.key)) zoomChart(canvas, .8, centre); else if (event.key === "-") zoomChart(canvas, 1.25, centre); else if (event.key === "ArrowLeft") panChart(canvas, -span * .1); else if (event.key === "ArrowRight") panChart(canvas, span * .1); else if (["0", "Escape"].includes(event.key)) resetChart(canvas); else return; event.preventDefault();
}

function zoomChart(canvas, factor, centre) {
  const chart = chartStates.get(canvas); if (!chart) return; const fullSpan = chart.fullMaximumX - chart.fullMinimumX; const span = Math.max(fullSpan / 50, Math.min(fullSpan, (chart.maximumX - chart.minimumX) * factor)); const fraction = (centre - chart.minimumX) / (chart.maximumX - chart.minimumX || 1);
  let minimum = centre - span * fraction; let maximum = minimum + span; if (minimum < chart.fullMinimumX) { minimum = chart.fullMinimumX; maximum = minimum + span; } if (maximum > chart.fullMaximumX) { maximum = chart.fullMaximumX; minimum = maximum - span; }
  chart.minimumX = minimum; chart.maximumX = maximum; renderChart(canvas);
}

function panChart(canvas, shift, initialMinimum = null, initialMaximum = null) {
  const chart = chartStates.get(canvas); if (!chart) return; const minimum = initialMinimum ?? chart.minimumX; const maximum = initialMaximum ?? chart.maximumX; const span = maximum - minimum; let nextMinimum = Math.max(chart.fullMinimumX, Math.min(chart.fullMaximumX - span, minimum + shift)); chart.minimumX = nextMinimum; chart.maximumX = nextMinimum + span; renderChart(canvas);
}

function resetCanvasChart(canvas) { const chart = chartStates.get(canvas); if (!chart) return; chart.minimumX = chart.fullMinimumX; chart.maximumX = chart.fullMaximumX; chart.hoverIndex = null; canvas.parentElement.querySelector(".chart-tooltip").hidden = true; renderChart(canvas); }

function drawChart(chart, x, series, options) {
  const theme = plotTheme();
  const compactModebar = chart.getBoundingClientRect().width < 308;
  const traces = series.flatMap((entry) => entry.band ? [
    { type: "scatter", mode: "lines", x, y: entry.lower, line: { width: 0 }, hoverinfo: "skip", showlegend: false },
    { type: "scatter", mode: "lines", x, y: entry.upper, line: { width: 0 }, fill: "tonexty", fillcolor: entry.color, hoverinfo: "skip", showlegend: false },
  ] : [{
    type: "scatter",
    mode: entry.line === false ? "markers" : entry.points ? "lines+markers" : "lines",
    name: entry.label,
    x,
    y: entry.values,
    line: { color: entry.color, width: SCIENTIFIC_PLOT_LINE_WIDTHS.primary, dash: entry.dash?.length ? "dash" : "solid" },
    marker: { color: entry.color, size: entry.points ? 5 : 0, symbol: entry.marker === "square" ? "square" : "circle" },
    hovertemplate: `${entry.label}: %{y:.4g}<extra></extra>`,
  }]);
  const values = series.flatMap((entry) => [entry.values, entry.lower, entry.upper].filter(Boolean).flat()).filter(Number.isFinite);
  const maximumAbsolute = Math.max(1e-12, ...values.map(Math.abs));
  const layout = createScientificPlotlyLayout({
    height: 330,
    margin: { l: 68, r: 20, t: compactModebar ? 112 : 56, b: 56 },
    uirevision: chart.id,
    showlegend: false,
    theme: { background: theme.background, text: theme.text, textSecondary: theme.text, grid: theme.grid, axis: theme.axis },
    xTitle: options.xLabel,
    yTitle: options.yLabel,
    overrides: { yaxis: {
      title: { text: options.yLabel },
      ...(options.symmetricY ? { range: [-maximumAbsolute * 1.08, maximumAbsolute * 1.08] } : {}),
      ...(!options.symmetricY && options.minimumY != null ? { rangemode: "tozero" } : {}),
    } },
  }) as Partial<Plotly.Layout>;
  const config = createScientificPlotlyConfig({
    filename: chart.id,
    scrollZoom: true,
  }) as Partial<Plotly.Config>;
  void Plotly.react(chart, traces, layout, config).then(prepareScientificPlotlyToolbar);
}

function resetChart(chart) { void Plotly.relayout(chart, { "xaxis.autorange": true, "yaxis.autorange": true }); }

function exportPayload() {
  if (!state.fitResult || state.fitResult.preview) throw new Error("Run a fit before exporting results.");
  captureLayerInputs();
  return {
    schema: SAVED_FIT_SCHEMA, application: { name: "Reflectometry", version: "4.0.0", url: "https://jorpago2.github.io/reflectometry/" }, generatedAt: new Date().toISOString(), source: state.source, activeLayerId: state.activeLayerId,
    measurement: { spectrum: state.spectrum },
    controls: Object.fromEntries(SAVED_CONTROL_IDS.map((id) => [id, elements[id].type === "checkbox" ? elements[id].checked : elements[id].value])),
    stack: state.layers.map((layer) => ({
      id: layer.id,
      name: layer.name,
      opticalModel: layer.model,
      dielectricComponents: layer.model === "composite" ? { ...layer.components } : null,
      effectiveMedium: layer.model === "ema" ? { method: layer.ema.method, hostSource: layer.ema.hostSource, inclusionSource: layer.ema.inclusionSource, hostNk: layer.ema.hostNk, inclusionNk: layer.ema.inclusionNk } : null,
      nkSource: layer.nkSource,
      nkTable: layer.nk,
      regularizedToNk: layer.regularize,
      parameters: Object.fromEntries(Object.keys(layer.specs).map((name) => [name, state.fitResult.parameters[`${layer.id}__${name}`]])),
      parameterSettings: Object.fromEntries((Object.entries(layer.specs) as [string, any][]).map(([name, specification]) => [name, { minimum: specification.minimum, maximum: specification.maximum, fit: specification.fit, uncertainty: specification.uncertainty ?? null }])),
      parameterLinks: { ...layer.links },
    })),
    substrate: {
      refractiveIndex: { n: state.evaluation.substrateIndex.n[Math.floor(state.fitData.wavelengthNm.length / 2)], k: state.evaluation.substrateIndex.k[Math.floor(state.fitData.wavelengthNm.length / 2)] },
      opticalModel: state.substrate.model,
      dielectricComponents: state.substrate.model === "composite" ? { ...state.substrate.components } : null,
      effectiveMedium: state.substrate.model === "ema" ? { method: state.substrate.ema.method, hostSource: state.substrate.ema.hostSource, inclusionSource: state.substrate.ema.inclusionSource, hostNk: state.substrate.ema.hostNk, inclusionNk: state.substrate.ema.inclusionNk } : null,
      nkSource: state.substrate.nkSource, nkTable: state.substrate.nk, regularizedToNk: state.substrate.regularize,
      parameters: Object.fromEntries(Object.keys(state.substrate.specs).map((name) => [name, state.fitResult.parameters[`substrate__${name}`]])),
      parameterSettings: Object.fromEntries((Object.entries(state.substrate.specs) as [string, any][]).map(([name, specification]) => [name, { minimum: specification.minimum, maximum: specification.maximum, fit: specification.fit, uncertainty: specification.uncertainty ?? null }])),
      thicknessUm: Number(elements["substrate-thickness"].value), incidence: elements.incidence.value,
    }, gains: { reflectance: state.fitResult.parameters.rGain, transmittance: state.fitResult.parameters.tGain },
    diagnostics: state.fitResult.diagnostics, optimizer: state.fitResult.optimizer,
    assumptions: ["normal incidence", "homogeneous isotropic coherent layers", "finite phase-incoherent dispersive substrate", "Beer–Lambert substrate attenuation", "incoherent rear-surface returns"],
  };
}

function downloadJson() {
  try {
    const filename = `${safeName(state.source.sampleName)}-multilayer-fit.json`;
    saveFile(JSON.stringify(exportPayload(), null, 2), filename, "application/json;charset=utf-8");
    setStatus(`Fit exported as ${filename}.`);
  } catch (error) { showError(error); }
}
function downloadSpectraCsv() {
  try { exportPayload(); const header = "wavelength_nm,reflectance_data,transmittance_data,reflectance_valid,transmittance_valid,reflectance_model,transmittance_model,reflectance_residual,transmittance_residual";
    const rows = state.fitData.wavelengthNm.map((wavelength, index) => [wavelength, state.fitData.reflectance[index], state.fitData.transmittance[index], state.fitData.reflectanceValid[index], state.fitData.transmittanceValid[index], state.evaluation.reflectanceScaled[index], state.evaluation.transmittanceScaled[index], state.fitData.reflectanceValid[index] ? state.evaluation.reflectanceScaled[index] - state.fitData.reflectance[index] : "", state.fitData.transmittanceValid[index] ? state.evaluation.transmittanceScaled[index] - state.fitData.transmittance[index] : ""].join(",")); const filename = `${safeName(state.source.sampleName)}-multilayer-spectra.csv`; saveFile(`${[header, ...rows].join("\n")}\n`, filename, "text/csv;charset=utf-8"); setStatus(`Spectra exported as ${filename}.`);
  } catch (error) { showError(error); }
}
function downloadLayersNkCsv() {
  try { exportPayload(); const header = "layer_order,layer_id,layer_name,model,wavelength_nm,n,k"; const materials = [...state.evaluation.layerIndices, { id: "substrate", name: "Substrate", model: state.substrate.model, ...state.evaluation.substrateIndex }]; const rows = materials.flatMap((layer, order) => state.fitData.wavelengthNm.map((wavelength, index) => [order + 1, layer.id, csvCell(layer.name), layer.model, wavelength, layer.n[index], layer.k[index]].join(","))); const filename = `${safeName(state.source.sampleName)}-multilayer-nk.csv`; saveFile(`${[header, ...rows].join("\n")}\n`, filename, "text/csv;charset=utf-8"); setStatus(`Layer indices exported as ${filename}.`); }
  catch (error) { showError(error); }
}

function selectedFitCount() { captureLayerInputs(); return [...state.layers, state.substrate].reduce((sum, layer) => sum + (Object.entries(layer.specs) as [string, any][]).filter(([name, specification]) => specification.fit && !layer.links?.[name]).length, Number(elements["fit-r-gain"].checked) + Number(elements["fit-t-gain"].checked)); }
function updateFitCount() { const count = selectedFitCount(); elements["fit-count"].textContent = `${count} / 11 fitted parameters selected.${count > 11 ? " Reduce the selection before fitting." : ""}`; elements["fit-count"].classList.toggle("fit-limit-warning", count > 11); }
function numberValue(id, minimum, maximum) { const value = Number(elements[id].value); if (!Number.isFinite(value) || value < minimum || value > maximum) throw new Error(`${id.replaceAll("-", " ")} must be from ${minimum} to ${maximum}.`); return value; }
function integerValue(id, minimum, maximum) { const value = numberValue(id, minimum, maximum); if (!Number.isInteger(value)) throw new Error(`${id.replaceAll("-", " ")} must be an integer.`); return value; }
function format(value, digits = 3) { return Number.isFinite(value) ? Number(value).toFixed(digits).replace(/\.?0+$/, "") : "—"; }
function formatNullable(value, digits) { return value == null ? "—" : format(value, digits); }
function formatUncertainty(value) { return Number.isFinite(value) ? `±${Number(value).toPrecision(3)}` : "—"; }
function publishSourceQuality(ready = Boolean(state.spectrum)) { const wavelengths = state.fitData?.wavelengthNm ?? []; window.dispatchEvent(new CustomEvent("reflectometry:source-status", { detail: { ready, pointCount: wavelengths.length, wavelengthMinimumNm: wavelengths[0], wavelengthMaximumNm: wavelengths.at(-1), reflectanceCount: state.fitData?.reflectanceValid?.filter(Boolean).length ?? 0, transmittanceCount: state.fitData?.transmittanceValid?.filter(Boolean).length ?? 0 } })); }
function setSourceName(value) { elements["source-name"].textContent = value; const context = document.getElementById("header-source-name"); if (context) { context.textContent = value; context.title = value; } const ready = value !== "No measurement loaded"; const status = document.getElementById("header-source-status"); if (status) { status.textContent = ready ? "Ready" : "Needs input"; status.dataset.state = ready ? "ready" : "needs-input"; } publishSourceQuality(ready); }
function setControlDisabled(id, disabled) { elements[id].disabled = disabled; const fileButton = document.querySelector<HTMLButtonElement>(`button[data-file-input="${id}"]`); if (fileButton) fileButton.disabled = disabled; }
function updateBootstrapGuidance() {
  const guidance = elements["bootstrap-prerequisite"];
  guidance.textContent = state.worker
    ? "Complete or cancel the current calculation first."
    : !state.fitResult || state.fitResult.preview
      ? "Run fit to enable bootstrap uncertainty."
      : state.resultStale
        ? "Run fit again after the configuration change to enable bootstrap uncertainty."
        : "Bootstrap uncertainty is available for the current fit.";
}
function publishOperationStatus(message, kind) {
  const progress = state.worker ? Number(elements["fit-progress"].value) : undefined;
  window.dispatchEvent(new CustomEvent("reflectometry:operation-status", {
    detail: { busy: Boolean(state.worker), kind, message, progress },
  }));
}
function setBusy(busy, message = "") { (document.querySelector(".controls") as HTMLElement).inert = busy; for (const id of ["fit-button", "fit-panel-button", "preview-button", "bootstrap-button", "reset-example", "load-files", "saved-fit-file", "add-layer", "undo-button", "redo-button"]) setControlDisabled(id, busy); if (!busy) { elements["bootstrap-button"].disabled = !state.fitResult || Boolean(state.fitResult.preview) || state.resultStale; updateHistoryButtons(); } updateBootstrapGuidance(); if (message) setStatus(message); else { const currentMessage = elements.status.textContent ?? ""; const kind = elements.status.closest(".status-row")?.dataset.kind ?? "neutral"; publishOperationStatus(currentMessage, kind); } }
function setStatus(message) {
  elements.status.textContent = message;
  const row = elements.status.closest(".status-row");
  const kind = /^Error:/i.test(message) ? "error" : /fitting|screening|bootstrap/i.test(message) ? "running" : /optimized|complete|exported/i.test(message) ? "success" : "neutral";
  if (row) row.dataset.kind = kind;
  publishOperationStatus(message, kind);
}
function showError(error) { setStatus(`Error: ${error instanceof Error ? error.message : String(error)}`); }
function safeName(value) { return String(value ?? "sample").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "sample"; }
function csvCell(value) { return `"${String(value).replaceAll('"', '""')}"`; }
function saveFile(content, name, type) { const blob = content instanceof Blob ? content : new Blob([content], { type }); const url = URL.createObjectURL(blob); const link = document.createElement("a"); link.href = url; link.download = name; link.click(); URL.revokeObjectURL(url); }

initializeWorkspace();
