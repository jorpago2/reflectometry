import {
  createSpectrum,
  createSyntheticSpectrum,
  diagnosticsOf,
  evaluateOpticalModel,
  loadNkTable,
  prepareFitData,
  restrictToNkRange,
} from "./scientific-core.js";
import { MODEL_LABELS, modelParameterSpecs } from "./dielectric-models.js";
import { COMPONENT_GUIDES, EMA_RULE_GUIDES, MODEL_GUIDES, parameterDescription } from "./model-help.js";
import { parseSavedFit, SAVED_FIT_SCHEMA } from "./saved-fit.js";

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
const SAVED_CONTROL_IDS = ["wavelength-min", "wavelength-max", "reference-threshold", "bin-width", "sample-snr", "subtract-background", "use-r", "use-t", "prefer-shape", "sigma-r", "sigma-t", "sigma-n", "sigma-k", "fit-r-gain", "fit-t-gain", "r-gain", "t-gain", "screening-points", "local-refinements"];
const elements = Object.fromEntries([...document.querySelectorAll("[id]")].map((element) => [element.id, element]));
const state = { spectrum: null, fitData: null, evaluation: null, fitResult: null, source: null, layers: [], activeLayerId: null, nextLayer: 1, worker: null, pendingConfiguration: null };

elements["reset-example"].addEventListener("click", loadSyntheticExample);
elements["load-files"].addEventListener("click", loadLocalFiles);
elements["saved-fit-file"].addEventListener("change", loadSavedFit);
elements["add-layer"].addEventListener("click", () => {
  captureLayerInputs();
  if (state.layers.length >= 12) return showError(new Error("The coherent stack is limited to 12 layers."));
  const layer = makeLayer("constant", 100, null);
  state.layers.push(layer);
  state.activeLayerId = layer.id;
  renderLayers();
  previewModel();
});
elements.layers.addEventListener("change", handleLayerChange);
elements.layers.addEventListener("click", handleLayerClick);
elements.layers.addEventListener("click", handleParameterHelp);
document.addEventListener("click", (event) => !event.target.closest(".parameter-help-button, .parameter-help-popover") && closeParameterHelp());
document.addEventListener("keydown", (event) => event.key === "Escape" && closeParameterHelp());
for (const id of ["substrate-index", "substrate-extinction", "substrate-thickness", "incidence"]) elements[id].addEventListener("change", renderStackDiagram);
elements["preview-button"].addEventListener("click", previewModel);
elements["fit-button"].addEventListener("click", fitModel);
elements["download-json"].addEventListener("click", downloadJson);
elements["download-csv"].addEventListener("click", downloadSpectraCsv);
elements["download-nk"].addEventListener("click", downloadLayersNkCsv);
window.addEventListener("resize", () => state.evaluation && drawAll());
for (const id of ["fit-r-gain", "fit-t-gain"]) elements[id].addEventListener("change", updateFitCount);

function makeLayer(model, thicknessNm, nk) {
  const id = `layer${state.nextLayer++}`;
  const components = { ...DEFAULT_COMPONENTS };
  const specs = layerSpecs(model, thicknessNm, nk, components);
  const ema = { method: "bruggeman", hostNk: null, inclusionNk: null, hostSource: null, inclusionSource: null };
  return { id, name: `Layer ${state.layers.length + 1}`, model, components, ema, nk, nkSource: null, regularize: false, specs, specCache: { ...specs } };
}

function modelLabel(model) { return MULTILAYER_MODEL_LABELS[model] ?? MODEL_LABELS[model] ?? model; }

function layerSpecs(model, thicknessNm, nk, components, previous = {}) {
  const referenceIndex = nk ? nk.wavelengthNm.reduce((best, value, index) => Math.abs(value - 1064) < Math.abs(nk.wavelengthNm[best] - 1064) ? index : best, 0) : 0;
  const generated = modelParameterSpecs(model, { n: nk?.n[referenceIndex] ?? 2, k: nk?.k[referenceIndex] ?? 0.05 }, thicknessNm, components);
  delete generated.rGain;
  delete generated.tGain;
  return Object.fromEntries(Object.entries(generated).map(([name, specification]) => [name, previous[name] ? { ...specification, ...previous[name] } : specification]));
}

function rebuildLayerSpecs(layer) {
  layer.specCache = { ...layer.specCache, ...layer.specs };
  layer.specs = layerSpecs(layer.model, layer.specs.thicknessNm.value, layer.nk, layer.components, layer.specCache);
  layer.specCache = { ...layer.specCache, ...layer.specs };
}

function loadSyntheticExample() {
  setBusy(true, "Generating a neutral synthetic stack…");
  try {
    state.spectrum = createSyntheticSpectrum();
    state.layers = [];
    const layer = makeLayer("constant", 150, null);
    layer.name = "Generic layer";
    state.layers = [layer];
    state.activeLayerId = layer.id;
    state.source = { sampleName: "Synthetic stack", type: "deterministic browser-generated example", truth: { layers: [{ thicknessNm: 150, n: 2, k: 0.05 }], substrate: { n: 1.46, k: 0, thicknessUm: 1000 } } };
    elements["source-name"].textContent = "Synthetic stack · generated locally";
    elements["use-t"].checked = true;
    renderLayers();
    previewModel();
  } catch (error) { showError(error); }
  finally { setBusy(false); }
}

async function loadLocalFiles() {
  const fields = { sampleR: "file-sample-r", sampleT: "file-sample-t", reflectanceReference: "file-r-reference", transmittanceReference: "file-t-reference", referenceReflectance: "file-reference-model" };
  const files = Object.fromEntries(Object.entries(fields).map(([name, id]) => [name, elements[id].files[0]]));
  const missing = Object.entries(files).filter(([, file]) => !file).map(([name]) => name);
  if (missing.length) return showError(new Error(`Select the required files: ${missing.join(", ")}.`));
  setBusy(true, "Reading local files…");
  try {
    const texts = Object.fromEntries(await Promise.all(Object.entries(files).map(async ([name, file]) => [name, await file.text()])));
    const sampleName = elements["sample-name"].value.trim() || files.sampleR.name.replace(/-ref\.txt$/i, "") || "sample";
    state.spectrum = createSpectrum({ sampleName, ...texts });
    state.source = { sampleName, type: "local files", files: Object.fromEntries(Object.entries(files).map(([name, file]) => [name, file.name])) };
    elements["source-name"].textContent = `${sampleName} · local files`;
    if (!state.layers.length) {
      const layer = makeLayer("constant", 100, null);
      state.layers = [layer]; state.activeLayerId = layer.id; renderLayers();
    }
    previewModel();
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
  const usedIds = new Set(layers.map((layer) => layer.id)); state.nextLayer = 1; while (usedIds.has(`layer${state.nextLayer}`)) state.nextLayer += 1;
  applySavedControls(saved.controls);
  elements["substrate-index"].value = String(saved.substrate.n); elements["substrate-extinction"].value = String(saved.substrate.k); elements["substrate-thickness"].value = String(saved.substrate.thicknessUm); elements.incidence.value = saved.substrate.incidence;
  elements["r-gain"].value = String(saved.gains.reflectance); elements["t-gain"].value = String(saved.gains.transmittance);
  if (saved.spectrum) {
    state.spectrum = saved.spectrum;
    state.source = { ...(saved.source ?? {}), sampleName: saved.spectrum.sampleName };
  }
  const sampleName = saved.spectrum?.sampleName ?? state.source?.sampleName ?? fileName.replace(/\.json$/i, "");
  elements["source-name"].textContent = `${sampleName} · ${saved.spectrum ? "restored saved fit" : "legacy fit configuration"}`;
  renderLayers();
  const missingTables = layers.filter((layer) => (TABLE_MODELS.has(layer.model) && !layer.nk) || (layer.model === "ema" && (!layer.ema.hostNk || !layer.ema.inclusionNk)));
  if (missingTables.length) {
    clearResult();
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
}

function applySavedControls(controls) {
  for (const id of SAVED_CONTROL_IDS) if (Object.hasOwn(controls, id)) {
    if (elements[id].type === "checkbox") elements[id].checked = Boolean(controls[id]);
    else elements[id].value = String(controls[id]);
  }
}

function mergeSavedDiagnostics(fresh, saved) {
  if (!saved) return fresh;
  return {
    ...fresh,
    normalizedJacobianCondition: Number.isFinite(saved.normalizedJacobianCondition) ? saved.normalizedJacobianCondition : null,
    parametersAtBounds: Array.isArray(saved.parametersAtBounds) ? saved.parametersAtBounds.map(String) : [],
    nearEqualAlternativeMinima: Number.isFinite(saved.nearEqualAlternativeMinima) ? saved.nearEqualAlternativeMinima : null,
    parameterStandardErrorsApproximate: saved.parameterStandardErrorsApproximate && typeof saved.parameterStandardErrorsApproximate === "object" ? saved.parameterStandardErrorsApproximate : {},
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
  for (const id of ["download-json", "download-csv", "download-nk"]) elements[id].disabled = true;
  for (const canvas of [elements["rt-chart"], elements["residual-chart"], elements["nk-chart"]]) canvas.getContext("2d").clearRect(0, 0, canvas.width, canvas.height);
}

function renderLayers() {
  const cards = state.layers.map((layer, index) => {
    const card = document.createElement("article");
    card.className = "layer-card";
    card.dataset.layerId = layer.id;
    const header = document.createElement("div"); header.className = "layer-card-header";
    const order = document.createElement("span"); order.className = "layer-order"; order.textContent = String(index + 1).padStart(2, "0");
    const name = document.createElement("input"); name.className = "layer-name"; name.value = layer.name; name.maxLength = 60; name.dataset.field = "name"; name.setAttribute("aria-label", `Layer ${index + 1} name`);
    const actions = document.createElement("div"); actions.className = "layer-actions";
    for (const [action, label, disabled] of [["up", "↑", index === 0], ["down", "↓", index === state.layers.length - 1], ["remove", "×", state.layers.length === 1]]) {
      const button = document.createElement("button"); button.type = "button"; button.dataset.action = action; button.textContent = label; button.disabled = disabled; button.setAttribute("aria-label", `${action} ${layer.name}`); actions.append(button);
    }
    header.append(order, name, actions);
    const selectors = document.createElement("div"); selectors.className = "field-pair";
    const modelChoices = Object.hasOwn(MULTILAYER_MODEL_LABELS, layer.model) ? MULTILAYER_MODEL_LABELS : { ...MULTILAYER_MODEL_LABELS, [layer.model]: modelLabel(layer.model) };
    selectors.append(selectControl("Optical model", "model", modelChoices, layer.model));
    const modelHelp = renderModelHelp(layer);
    const components = document.createElement("fieldset"); components.className = "component-selector"; components.hidden = layer.model !== "composite";
    const legend = document.createElement("legend"); legend.textContent = "Additive dielectric components"; components.append(legend);
    for (const [field, key, label] of [["tl-count", "taucLorentz", "Tauc–Lorentz oscillators"], ["lorentz-count", "lorentz", "Lorentz oscillators"]]) {
      const oscillatorControl = document.createElement("label"); oscillatorControl.className = "oscillator-count"; oscillatorControl.textContent = label;
      const oscillatorCount = document.createElement("select"); oscillatorCount.dataset.field = field;
      for (let count = 0; count <= 5; count += 1) { const option = document.createElement("option"); option.value = String(count); option.textContent = String(count); option.selected = count === layer.components[key]; oscillatorCount.append(option); }
      oscillatorControl.append(oscillatorCount); components.append(oscillatorControl);
    }
    for (const [component, label] of Object.entries(COMPONENT_LABELS)) {
      const control = checkControl(label, "component", layer.components[component], false); control.querySelector("input").dataset.component = component; components.append(control);
    }
    const reference = document.createElement("div"); reference.className = "layer-reference";
    reference.hidden = layer.model === "ema";
    const fileLabel = document.createElement("label"); fileLabel.textContent = "Layer n,k table";
    const file = document.createElement("input"); file.type = "file"; file.accept = ".txt,text/plain"; file.dataset.field = "nk-file"; fileLabel.append(file);
    const source = document.createElement("p"); source.textContent = layer.nkSource ?? "No n,k table loaded.";
    reference.append(fileLabel, source);
    const ema = document.createElement("fieldset"); ema.className = "component-selector ema-selector"; ema.hidden = layer.model !== "ema";
    const emaLegend = document.createElement("legend"); emaLegend.textContent = "Effective-medium constituents"; ema.append(emaLegend);
    ema.append(selectControl("Mixing rule", "ema-method", { bruggeman: "Bruggeman (symmetric)", "maxwell-garnett": "Maxwell–Garnett (inclusions in host)" }, layer.ema.method));
    for (const role of ["host", "inclusion"]) {
      const fileControl = document.createElement("label"); fileControl.textContent = `${role[0].toUpperCase()}${role.slice(1)} n,k table`;
      const emaFile = document.createElement("input"); emaFile.type = "file"; emaFile.accept = ".txt,text/plain"; emaFile.dataset.field = `ema-${role}-file`; fileControl.append(emaFile);
      const emaSource = document.createElement("p"); emaSource.textContent = layer.ema[`${role}Source`] ?? "No n,k table loaded.";
      ema.append(fileControl, emaSource);
    }
    const flags = document.createElement("div"); flags.className = "layer-flags";
    flags.append(checkControl("Active n,k plot", "active", state.activeLayerId === layer.id, false, "radio"));
    flags.append(checkControl("Regularize to n,k", "regularize", layer.regularize, !layer.nk || layer.model === "fixed" || layer.model === "ema"));
    const tableHeader = document.createElement("div"); tableHeader.className = "parameter-header";
    for (const text of ["Fit", "Parameter", "Value", "Min", "Max", "1σ"]) { const span = document.createElement("span"); span.textContent = text; tableHeader.append(span); }
    const table = document.createElement("div"); table.className = "parameter-table";
    for (const [parameter, specification] of Object.entries(layer.specs)) table.append(parameterRow(layer, parameter, specification));
    card.append(header, selectors, modelHelp, components, ema, reference, flags, tableHeader, table);
    return card;
  });
  elements.layers.replaceChildren(...cards);
  updateFitCount();
  renderStackDiagram();
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
  elements["stack-substrate-index"].textContent = `N = ${format(Number(elements["substrate-index"].value), 3)} + ${format(Number(elements["substrate-extinction"].value), 3)}i · ${format(Number(elements["substrate-thickness"].value), 3)} µm`;
}

function selectControl(labelText, field, choices, value) {
  const label = document.createElement("label"); label.textContent = labelText;
  const select = document.createElement("select"); select.dataset.field = field;
  for (const [choice, text] of Object.entries(choices)) { const option = document.createElement("option"); option.value = choice; option.textContent = text; option.selected = choice === value; select.append(option); }
  label.append(select); return label;
}

function checkControl(text, field, checked, disabled, type = "checkbox") {
  const label = document.createElement("label"); label.className = "check";
  const input = document.createElement("input"); input.type = type; input.name = type === "radio" ? "active-layer" : ""; input.dataset.field = field; input.checked = checked; input.disabled = disabled;
  const span = document.createElement("span"); span.textContent = text; label.append(input, span); return label;
}

function parameterRow(layer, parameter, specification) {
  const row = document.createElement("div"); row.className = "parameter-row"; row.dataset.parameter = parameter;
  const fit = document.createElement("input"); fit.type = "checkbox"; fit.dataset.kind = "fit"; fit.checked = specification.fit; fit.setAttribute("aria-label", `Fit ${layer.name} ${specification.label}`);
  const description = parameterDescription(parameter);
  const label = document.createElement("span"); label.className = "parameter-name"; label.append(document.createTextNode(specification.label));
  const helpId = `${layer.id}-${parameter}-help`;
  const helpButton = document.createElement("button"); helpButton.type = "button"; helpButton.className = "parameter-help-button"; helpButton.textContent = "?"; helpButton.setAttribute("aria-label", `Help for ${specification.label}`); helpButton.setAttribute("aria-controls", helpId); helpButton.setAttribute("aria-expanded", "false"); label.append(helpButton);
  const help = document.createElement("span"); help.id = helpId; help.className = "parameter-help-popover"; help.setAttribute("role", "tooltip"); help.hidden = true; help.textContent = description; label.append(help);
  if (specification.unit) { const unit = document.createElement("span"); unit.className = "parameter-unit"; unit.textContent = specification.unit; label.append(unit); }
  row.append(fit, label);
  for (const [kind, value] of [["value", specification.value], ["minimum", specification.minimum], ["maximum", specification.maximum]]) {
    const input = document.createElement("input"); input.type = "number"; input.step = "any"; input.dataset.kind = kind; input.value = String(value); input.setAttribute("aria-label", `${kind} ${layer.name} ${specification.label}`); row.append(input);
  }
  const uncertainty = document.createElement("span"); uncertainty.className = "parameter-uncertainty"; uncertainty.textContent = specification.uncertainty ?? "—"; row.append(uncertainty);
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
  for (const button of elements.layers.querySelectorAll('.parameter-help-button[aria-expanded="true"]')) {
    const help = document.getElementById(button.getAttribute("aria-controls")); if (help) help.hidden = true;
    button.setAttribute("aria-expanded", "false"); button.removeAttribute("aria-describedby");
  }
}

function renderModelHelp(layer) {
  const guide = MODEL_GUIDES[layer.model];
  const details = document.createElement("details"); details.className = "model-help";
  const summary = document.createElement("summary"); summary.textContent = `Model guide · ${modelLabel(layer.model)}`;
  const body = document.createElement("div"); body.className = "model-help-body";
  const description = document.createElement("p"); description.className = "model-help-summary"; description.textContent = guide.summary;
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
      const section = document.createElement("section"); section.className = "component-help";
      const componentTitle = document.createElement("h5"); componentTitle.textContent = title;
      const componentSummary = document.createElement("p"); componentSummary.textContent = activeGuide.summary ?? activeGuide.represents;
      section.append(componentTitle, componentSummary, equationBlock(activeGuide.equation));
      if (activeGuide.summary && activeGuide.represents) section.append(helpFact("Typically represents", activeGuide.represents));
      body.append(section);
    }
  }

  const parameterHeading = document.createElement("h4"); parameterHeading.textContent = "Parameters in this layer";
  const parameters = document.createElement("dl"); parameters.className = "model-parameter-help";
  for (const [name, specification] of Object.entries(layer.specs)) {
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
  const block = document.createElement("div"); block.className = "model-equation";
  block.innerHTML = `<math xmlns="http://www.w3.org/1998/Math/MathML" display="block" aria-label="${equation.label}">${equation.mathml}</math>`;
  return block;
}

function helpFact(label, text) {
  const paragraph = document.createElement("p"); paragraph.className = "model-help-fact";
  const strong = document.createElement("strong"); strong.textContent = `${label}: `; paragraph.append(strong, document.createTextNode(text)); return paragraph;
}

async function handleLayerChange(event) {
  const card = event.target.closest(".layer-card"); if (!card) return;
  const layer = state.layers.find((candidate) => candidate.id === card.dataset.layerId); if (!layer) return;
  if (event.target.dataset.kind) { captureLayerInputs(); updateFitCount(); renderStackDiagram(); return; }
  const field = event.target.dataset.field;
  if (field === "name") { layer.name = event.target.value.trim() || layer.name; renderStackDiagram(); return; }
  if (field === "active") { state.activeLayerId = layer.id; renderStackDiagram(); drawAll(); return; }
  if (field === "regularize") { layer.regularize = event.target.checked; return; }
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
  captureLayerInputs();
  if (button.dataset.action === "remove") { const [removed] = state.layers.splice(index, 1); if (state.activeLayerId === removed.id) state.activeLayerId = state.layers[Math.max(0, index - 1)].id; renderLayers(); previewModel(); }
  if (button.dataset.action === "up" || button.dataset.action === "down") { const target = index + (button.dataset.action === "up" ? -1 : 1); [state.layers[index], state.layers[target]] = [state.layers[target], state.layers[index]]; renderLayers(); previewModel(); }
}

function captureLayerInputs() {
  for (const card of elements.layers.querySelectorAll(".layer-card")) {
    const layer = state.layers.find((candidate) => candidate.id === card.dataset.layerId); if (!layer) continue;
    layer.name = card.querySelector('[data-field="name"]')?.value.trim() || layer.name;
    for (const row of card.querySelectorAll(".parameter-row")) {
      const specification = layer.specs[row.dataset.parameter]; if (!specification) continue;
      specification.fit = row.querySelector('[data-kind="fit"]').checked;
      for (const kind of ["value", "minimum", "maximum"]) specification[kind] = Number(row.querySelector(`[data-kind="${kind}"]`).value);
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
    for (const [name, specification] of Object.entries(layer.specs)) {
      const key = `${layer.id}__${name}`; const { value, minimum, maximum } = specification;
      if (![value, minimum, maximum].every(Number.isFinite) || minimum >= maximum || value < minimum || value > maximum) throw new Error(`${layer.name}: ${specification.label} must have a finite value inside valid bounds.`);
      initial[key] = value; bounds[key] = [minimum, maximum]; if (specification.fit) fittedParameters.push(key);
    }
  }
  if (fittedParameters.length > 11) throw new Error(`Select at most 11 fitted parameters; ${fittedParameters.length} are selected.`);
  const substrateThicknessUm = numberValue("substrate-thickness", 10, 1e6);
  const minimumSubstrateThicknessUm = numberValue("wavelength-max", 196, 3000) / 100;
  if (substrateThicknessUm < minimumSubstrateThicknessUm) throw new Error(`Substrate thickness must be at least ${format(minimumSubstrateThicknessUm, 3)} µm (10× the maximum wavelength).`);
  const settings = {
    layers: state.layers.map(({ id, name, model, components, ema, nk, regularize }) => ({ id, name, model, components, ema, nk, regularize })),
    activeLayerId: state.activeLayerId,
    substrateIndex: numberValue("substrate-index", 0.001, 20), substrateExtinction: numberValue("substrate-extinction", 0, 100), substrateThicknessNm: 1000 * substrateThicknessUm, incidence: elements.incidence.value,
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
  state.fitData = data; return data;
}

function validateChannels(data, settings) {
  if (settings.useReflectance && data.reflectanceValid.filter(Boolean).length < 10) throw new Error("Fewer than 10 reflectance bins pass the masks.");
  if (settings.useTransmittance && data.transmittanceValid.filter(Boolean).length < 10) throw new Error("Fewer than 10 transmittance bins pass the masks; disable T or revise the SNR threshold.");
}

function previewModel() {
  try {
    const config = configuration(); const fitData = prepareCurrentData(); validateChannels(fitData, config.settings);
    state.evaluation = evaluateOpticalModel(fitData, null, config.initial, config.settings);
    state.fitResult = { parameters: config.initial, evaluation: state.evaluation, diagnostics: diagnosticsOf(fitData, state.evaluation, config.settings), preview: true, configuration: config };
    renderResult("Model updated; parameters have not been optimized yet.");
  } catch (error) { showError(error); }
}

function fitModel() {
  try {
    const config = configuration(); const fitData = prepareCurrentData(); validateChannels(fitData, config.settings);
    if (!config.fittedParameters.length) throw new Error("Select at least one parameter to fit.");
    const screeningPoints = integerValue("screening-points", 64, 4096); if (screeningPoints & (screeningPoints - 1)) throw new Error("Sobol points must be a power of two.");
    const localRefinements = integerValue("local-refinements", 1, 50);
    if (state.worker) state.worker.terminate();
    state.worker = new Worker(new URL("./fit-worker.js", import.meta.url), { type: "module" });
    state.worker.addEventListener("message", handleWorkerMessage); state.worker.addEventListener("error", (event) => finishFitError(event.message));
    elements["fit-progress"].hidden = false; elements["fit-progress"].value = 0; setBusy(true, `Screening ${screeningPoints} Sobol points…`);
    state.pendingConfiguration = config;
    state.worker.postMessage({ fitData, nk: null, configuration: { ...config, screeningPoints, localRefinements } });
  } catch (error) { showError(error); }
}

function handleWorkerMessage({ data }) {
  if (data.type === "progress") { elements["fit-progress"].value = data.progress; setStatus(`Fitting parameters… ${data.progress}%`); return; }
  if (data.type === "error") return finishFitError(data.message);
  if (data.type !== "result") return;
  state.worker.terminate(); state.worker = null; elements["fit-progress"].hidden = true; setBusy(false);
  state.fitResult = { ...data.result, configuration: state.pendingConfiguration }; state.pendingConfiguration = null; state.evaluation = data.result.evaluation;
  for (const layer of state.layers) for (const specificationName of Object.keys(layer.specs)) {
    const key = `${layer.id}__${specificationName}`; layer.specs[specificationName].value = data.result.parameters[key];
    layer.specs[specificationName].uncertainty = formatUncertainty(data.result.diagnostics.parameterStandardErrorsApproximate[key]);
  }
  elements["r-gain"].value = data.result.parameters.rGain; elements["t-gain"].value = data.result.parameters.tGain;
  renderLayers();
  renderResult(data.result.optimizer.selectedSolver.success ? "Fit complete." : `Fit stopped: ${data.result.optimizer.selectedSolver.message}`);
}

function finishFitError(message) { if (state.worker) state.worker.terminate(); state.worker = null; state.pendingConfiguration = null; elements["fit-progress"].hidden = true; setBusy(false); showError(new Error(message)); }

function renderResult(message) {
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
  for (const id of ["download-json", "download-csv", "download-nk"]) elements[id].disabled = Boolean(result.preview);
  setStatus(message); drawAll();
}

function drawAll() {
  if (!state.fitData || !state.evaluation) return;
  const x = state.fitData.wavelengthNm;
  drawChart(elements["rt-chart"], x, [
    { values: state.fitData.reflectance.map((value, index) => state.fitData.reflectanceValid[index] ? value : NaN), color: "#a8b3ae", points: true },
    { values: state.evaluation.reflectanceScaled, color: "#d9ff43" },
    { values: state.fitData.transmittance.map((value, index) => state.fitData.transmittanceValid[index] ? value : NaN), color: "#78827d", points: true },
    { values: state.evaluation.transmittanceScaled, color: "#ff5a1f" },
  ], { minimumY: 0, yLabel: "R, T" });
  drawChart(elements["residual-chart"], x, [
    { values: state.evaluation.reflectanceScaled.map((value, index) => state.fitData.reflectanceValid[index] ? value - state.fitData.reflectance[index] : NaN), color: "#d9ff43" },
    { values: state.evaluation.transmittanceScaled.map((value, index) => state.fitData.transmittanceValid[index] ? value - state.fitData.transmittance[index] : NaN), color: "#ff5a1f" },
  ], { symmetricY: true, yLabel: "Model − data" });
  const active = state.evaluation.layerIndices.find((layer) => layer.id === state.activeLayerId) ?? state.evaluation.layerIndices[0];
  elements["nk-layer-label"].textContent = `${active.name.toUpperCase()} / ${MODEL_LABELS[active.model].toUpperCase()}`;
  drawChart(elements["nk-chart"], x, [{ values: active.n, color: "#d9ff43" }, { values: active.k, color: "#ff5a1f" }], { minimumY: 0, yLabel: "n, k" });
}

function drawChart(canvas, x, series, options) {
  const ratio = Math.min(2, window.devicePixelRatio || 1); const width = Math.max(320, Math.round(canvas.clientWidth)); const height = Math.max(240, Math.round(canvas.clientHeight));
  canvas.width = width * ratio; canvas.height = height * ratio; const context = canvas.getContext("2d"); context.scale(ratio, ratio);
  const margin = { left: 52, right: 18, top: 16, bottom: 36 }; const plotWidth = width - margin.left - margin.right; const plotHeight = height - margin.top - margin.bottom;
  const xMinimum = Math.min(...x); const xMaximum = Math.max(...x); let values = series.flatMap((entry) => entry.values.filter(Number.isFinite)); if (!values.length) values = [0, 1];
  const maximumAbsolute = Math.max(...values.map(Math.abs)); const yMinimum = options.symmetricY ? -(maximumAbsolute || 1) * 1.08 : options.minimumY ?? Math.min(...values);
  const rawMaximum = options.symmetricY ? maximumAbsolute || 1 : Math.max(...values); const yMaximum = rawMaximum > yMinimum ? rawMaximum * 1.08 : yMinimum + 1;
  const xPixel = (value) => margin.left + (value - xMinimum) / (xMaximum - xMinimum) * plotWidth; const yPixel = (value) => margin.top + (yMaximum - value) / (yMaximum - yMinimum) * plotHeight;
  context.fillStyle = "#07100d"; context.fillRect(0, 0, width, height); context.font = "11px ui-monospace, monospace"; context.fillStyle = "#91a39c"; context.strokeStyle = "#294039";
  for (let step = 0; step <= 4; step += 1) { const y = margin.top + step / 4 * plotHeight; const value = yMaximum - step / 4 * (yMaximum - yMinimum); context.beginPath(); context.moveTo(margin.left, y); context.lineTo(width - margin.right, y); context.stroke(); context.fillText(format(value, yMaximum < 2 ? 2 : 1), 5, y + 4); }
  for (let step = 0; step <= 4; step += 1) { const value = xMinimum + step / 4 * (xMaximum - xMinimum); context.fillText(String(Math.round(value)), xPixel(value) - 14, height - 10); }
  context.fillText("λ / nm", width - 50, height - 10); context.save(); context.translate(14, margin.top + 12); context.rotate(-Math.PI / 2); context.fillText(options.yLabel, 0, 0); context.restore();
  for (const entry of series) { context.strokeStyle = entry.color; context.fillStyle = entry.color; context.lineWidth = entry.points ? 1 : 2; context.beginPath(); let drawing = false; entry.values.forEach((value, index) => { if (!Number.isFinite(value)) { drawing = false; return; } const px = xPixel(x[index]); const py = yPixel(value); if (drawing) context.lineTo(px, py); else context.moveTo(px, py); drawing = true; }); context.stroke(); if (entry.points) entry.values.forEach((value, index) => { if (Number.isFinite(value) && index % Math.max(1, Math.floor(entry.values.length / 140)) === 0) context.fillRect(xPixel(x[index]) - 1.25, yPixel(value) - 1.25, 2.5, 2.5); }); }
}

function exportPayload() {
  if (!state.fitResult || state.fitResult.preview) throw new Error("Run a fit before exporting results.");
  captureLayerInputs();
  return {
    schema: SAVED_FIT_SCHEMA, application: { name: "Reflectometry", version: "3.6.0", url: "https://jorpago2.github.io/reflectometry/" }, generatedAt: new Date().toISOString(), source: state.source, activeLayerId: state.activeLayerId,
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
      parameterSettings: Object.fromEntries(Object.entries(layer.specs).map(([name, specification]) => [name, { minimum: specification.minimum, maximum: specification.maximum, fit: specification.fit, uncertainty: specification.uncertainty ?? null }])),
    })),
    substrate: { refractiveIndex: { n: Number(elements["substrate-index"].value), k: Number(elements["substrate-extinction"].value) }, thicknessUm: Number(elements["substrate-thickness"].value), incidence: elements.incidence.value }, gains: { reflectance: state.fitResult.parameters.rGain, transmittance: state.fitResult.parameters.tGain },
    diagnostics: state.fitResult.diagnostics, optimizer: state.fitResult.optimizer,
    assumptions: ["normal incidence", "homogeneous isotropic coherent layers", "finite phase-incoherent substrate", "uniform complex substrate index", "Beer–Lambert substrate attenuation", "incoherent rear-surface returns"],
  };
}

function downloadJson() { try { saveFile(JSON.stringify(exportPayload(), null, 2), `${safeName(state.source.sampleName)}-multilayer-fit.json`, "application/json"); } catch (error) { showError(error); } }
function downloadSpectraCsv() {
  try { exportPayload(); const header = "wavelength_nm,reflectance_data,transmittance_data,reflectance_valid,transmittance_valid,reflectance_model,transmittance_model,reflectance_residual,transmittance_residual";
    const rows = state.fitData.wavelengthNm.map((wavelength, index) => [wavelength, state.fitData.reflectance[index], state.fitData.transmittance[index], state.fitData.reflectanceValid[index], state.fitData.transmittanceValid[index], state.evaluation.reflectanceScaled[index], state.evaluation.transmittanceScaled[index], state.fitData.reflectanceValid[index] ? state.evaluation.reflectanceScaled[index] - state.fitData.reflectance[index] : "", state.fitData.transmittanceValid[index] ? state.evaluation.transmittanceScaled[index] - state.fitData.transmittance[index] : ""].join(",")); saveFile([header, ...rows].join("\n"), `${safeName(state.source.sampleName)}-multilayer-spectra.csv`, "text/csv");
  } catch (error) { showError(error); }
}
function downloadLayersNkCsv() {
  try { exportPayload(); const header = "layer_order,layer_id,layer_name,model,wavelength_nm,n,k"; const rows = state.evaluation.layerIndices.flatMap((layer, order) => state.fitData.wavelengthNm.map((wavelength, index) => [order + 1, layer.id, csvCell(layer.name), layer.model, wavelength, layer.n[index], layer.k[index]].join(","))); saveFile([header, ...rows].join("\n"), `${safeName(state.source.sampleName)}-multilayer-nk.csv`, "text/csv"); }
  catch (error) { showError(error); }
}

function selectedFitCount() { captureLayerInputs(); return state.layers.reduce((sum, layer) => sum + Object.values(layer.specs).filter((specification) => specification.fit).length, Number(elements["fit-r-gain"].checked) + Number(elements["fit-t-gain"].checked)); }
function updateFitCount() { const count = selectedFitCount(); elements["fit-count"].textContent = `${count} / 11 fitted parameters selected.${count > 11 ? " Reduce the selection before fitting." : ""}`; elements["fit-count"].classList.toggle("warning", count > 11); }
function numberValue(id, minimum, maximum) { const value = Number(elements[id].value); if (!Number.isFinite(value) || value < minimum || value > maximum) throw new Error(`${id.replaceAll("-", " ")} must be from ${minimum} to ${maximum}.`); return value; }
function integerValue(id, minimum, maximum) { const value = numberValue(id, minimum, maximum); if (!Number.isInteger(value)) throw new Error(`${id.replaceAll("-", " ")} must be an integer.`); return value; }
function format(value, digits = 3) { return Number.isFinite(value) ? Number(value).toFixed(digits).replace(/\.?0+$/, "") : "—"; }
function formatNullable(value, digits) { return value == null ? "—" : format(value, digits); }
function formatUncertainty(value) { return Number.isFinite(value) ? `±${Number(value).toPrecision(3)}` : "—"; }
function setBusy(busy, message = "") { for (const id of ["fit-button", "preview-button", "reset-example", "load-files", "saved-fit-file", "add-layer"]) elements[id].disabled = busy; if (message) setStatus(message); }
function setStatus(message) { elements.status.textContent = message; }
function showError(error) { setStatus(`Error: ${error instanceof Error ? error.message : String(error)}`); }
function safeName(value) { return String(value ?? "sample").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "sample"; }
function csvCell(value) { return `"${String(value).replaceAll('"', '""')}"`; }
function saveFile(content, name, type) { const blob = content instanceof Blob ? content : new Blob([content], { type }); const url = URL.createObjectURL(blob); const link = document.createElement("a"); link.href = url; link.download = name; link.click(); URL.revokeObjectURL(url); }

loadSyntheticExample();
