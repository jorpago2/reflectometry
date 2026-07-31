import {
  createSpectrum,
  diagnosticsOf,
  evaluateOpticalModel,
  loadNkTable,
  prepareFitData,
  restrictToNkRange,
} from "./scientific-core.js";
import {
  MODEL_LABELS,
  modelParameterSpecs,
  refractiveIndexModel,
  tabulatedRefractiveIndex,
  validateModelAvailability,
} from "./dielectric-models.js";

const DEMOS = {
  agst: { label: "aGST", thickness: 250, sampleR: "agst-ref.txt", sampleT: "agst-tr.txt", nk: "aGST.txt" },
  cgst: { label: "cGST", thickness: 250, sampleR: "cgst-ref.txt", sampleT: "cgst-tr.txt", nk: "cGST.txt" },
  asb2sb3: { label: "aSb₂Se₃", thickness: 200, sampleR: "asb2sb3-ref.txt", sampleT: "asb2sb3-tr.txt", nk: "aSb2Se3.txt" },
  csb2sb3: { label: "cSb₂Se₃", thickness: 200, sampleR: "csb2sb3-ref.txt", sampleT: "csb2sb3-tr.txt", nk: "cSb2Se3.txt" },
  vo2: { label: "VO₂", thickness: 150, sampleR: "vo2-ref.txt", sampleT: "vo2-tr.txt", nk: "VO2_22C.txt" },
};

const elements = Object.fromEntries([...document.querySelectorAll("[id]")].map((element) => [element.id, element]));
const required = ["load-demo", "load-files", "shared-gains", "preview-button", "fit-button", "download-nk-csv", "alternative-details", "alternative-solutions", "rt-chart", "residual-chart", "nk-chart", "status"];
if (required.some((id) => !elements[id])) throw new Error("The interface is incomplete.");

const state = { spectrum: null, nk: null, fitData: null, evaluation: null, fitResult: null, sharedCalibration: null, source: null, worker: null, sampleId: "agst", parameterSpecs: {} };

elements["load-demo"].addEventListener("click", () => loadDemo(elements["demo-sample"].value));
elements["load-files"].addEventListener("click", loadLocalFiles);
elements["shared-gains"].addEventListener("click", startSharedGainCalibration);
elements["preview-button"].addEventListener("click", previewModel);
elements["fit-button"].addEventListener("click", fitModel);
elements.model.addEventListener("change", () => { rebuildParameterEditor(); previewModel(); });
elements["show-ellipsometry"].addEventListener("change", () => state.evaluation && drawAll());
elements["regularize-ellipsometry"].addEventListener("change", updateEllipsometryControls);
elements["download-json"].addEventListener("click", downloadJson);
elements["download-csv"].addEventListener("click", downloadCsv);
elements["download-nk-csv"].addEventListener("click", downloadNkCsv);
window.addEventListener("resize", () => state.evaluation && drawAll());

async function loadDemo(id) {
  const demo = DEMOS[id];
  if (!demo) return;
  setBusy(true, `Loading ${demo.label}…`);
  try {
    const paths = {
      sampleR: `examples/${demo.sampleR}`,
      sampleT: `examples/${demo.sampleT}`,
      silicon: "examples/si-ref.txt",
      openBeam: "examples/referencitrx.txt",
      siliconModel: "examples/si_reflectance.txt",
      nk: `examples/${demo.nk}`,
    };
    const entries = await Promise.all(Object.entries(paths).map(async ([name, path]) => [name, await fetchText(path), path]));
    const texts = Object.fromEntries(entries.map(([name, text]) => [name, text]));
    await setSource(texts, demo.label, Object.fromEntries(entries.map(([name, , path]) => [name, path])));
    state.sampleId = id;
    rebuildParameterEditor();
    elements["use-t"].checked = id !== "cgst";
    elements["source-name"].textContent = `${demo.label} · included demonstration data`;
    previewModel();
  } catch (error) {
    showError(error);
  } finally {
    setBusy(false);
  }
}

async function loadLocalFiles() {
  const fields = {
    sampleR: "file-sample-r",
    sampleT: "file-sample-t",
    silicon: "file-silicon",
    openBeam: "file-open",
    siliconModel: "file-si-model",
    nk: "file-nk",
  };
  const files = Object.fromEntries(Object.entries(fields).map(([name, id]) => [name, elements[id].files[0]]));
  const missing = Object.entries(files).filter(([, file]) => !file).map(([name]) => name);
  if (missing.length) return showError(new Error("Select all six files before processing."));
  setBusy(true, "Reading local files…");
  try {
    const texts = Object.fromEntries(await Promise.all(Object.entries(files).map(async ([name, file]) => [name, await file.text()])));
    const names = Object.fromEntries(Object.entries(files).map(([name, file]) => [name, file.name]));
    const sampleName = files.sampleR.name.replace(/-ref\.txt$/i, "") || "sample";
    await setSource(texts, sampleName, names);
    state.sampleId = normalizedSampleId(sampleName);
    rebuildParameterEditor();
    elements["source-name"].textContent = `${sampleName} · local files`;
    previewModel();
  } catch (error) {
    showError(error);
  } finally {
    setBusy(false);
  }
}

async function setSource(texts, sampleName, names) {
  state.spectrum = createSpectrum({ sampleName, ...texts });
  state.nk = loadNkTable(texts.nk);
  state.source = {
    sampleName,
    files: names,
    sha256: Object.fromEntries(await Promise.all(Object.entries(texts).map(async ([name, text]) => [name, await sha256(text)]))),
  };
  state.fitResult = null;
}

async function startSharedGainCalibration() {
  try {
    const calibration = currentCalibrationSettings();
    const settings = {
      substrateIndex: numberValue("substrate-index", 1.001, 5),
      incidence: elements.incidence.value,
      sigmaReflectance: numberValue("sigma-r", 0.0001, 1),
      sigmaTransmittance: numberValue("sigma-t", 0.0001, 1),
    };
    setBusy(true, "Preparing shared R/T calibration…");
    const common = {
      silicon: await fetchText("examples/si-ref.txt"),
      openBeam: await fetchText("examples/referencitrx.txt"),
      siliconModel: await fetchText("examples/si_reflectance.txt"),
    };
    const records = await Promise.all(Object.entries(DEMOS).map(async ([sampleId, demo]) => {
      const texts = {
        ...common,
        sampleR: await fetchText(`examples/${demo.sampleR}`),
        sampleT: await fetchText(`examples/${demo.sampleT}`),
        nk: await fetchText(`examples/${demo.nk}`),
      };
      return {
        sampleId,
        nominalThicknessNm: demo.thickness,
        data: prepareFitData(createSpectrum({ sampleName: demo.label, ...texts }), calibration),
        nk: loadNkTable(texts.nk),
      };
    }));
    if (state.worker) state.worker.terminate();
    state.worker = new Worker(new URL("./fit-worker.js", import.meta.url), { type: "module" });
    state.worker.addEventListener("message", handleWorkerMessage);
    state.worker.addEventListener("error", (event) => finishFitError(event.message));
    elements["fit-progress"].hidden = false;
    elements["fit-progress"].value = 10;
    state.worker.postMessage({ operation: "shared-gains", records, settings });
  } catch (error) {
    setBusy(false);
    showError(error);
  }
}

function prepareCurrentData() {
  if (!state.spectrum || !state.nk) throw new Error("Load a sample and its n,k table first.");
  const data = prepareFitData(state.spectrum, currentCalibrationSettings());
  state.fitData = new Set(["fixed", "scaled"]).has(elements.model.value) ? restrictToNkRange(data, state.nk) : data;
  return state.fitData;
}

function currentCalibrationSettings() {
  return {
    wavelengthMinNm: numberValue("wavelength-min", 195, 3000),
    wavelengthMaxNm: numberValue("wavelength-max", 196, 3000),
    referenceThresholdFraction: numberValue("reference-threshold", 0, 99) / 100,
    binWidthNm: numberValue("bin-width", 0.1, 100),
    sampleSnrMinimum: numberValue("sample-snr", 0, 100),
    subtractBackground: elements["subtract-background"].checked,
  };
}

function currentSettings() {
  const useReflectance = elements["use-r"].checked;
  const useTransmittance = elements["use-t"].checked;
  if (!useReflectance && !useTransmittance) throw new Error("Select R, T, or both channels.");
  return {
    model: elements.model.value,
    substrateIndex: numberValue("substrate-index", 1.001, 5),
    incidence: elements.incidence.value,
    useReflectance,
    useTransmittance,
    sigmaReflectance: numberValue("sigma-r", 0.0001, 1),
    sigmaTransmittance: numberValue("sigma-t", 0.0001, 1),
    preferSpectralShape: elements["prefer-shape"].checked,
    regularizeEllipsometry: elements["regularize-ellipsometry"].checked && !elements["regularize-ellipsometry"].disabled,
    showEllipsometry: elements["show-ellipsometry"].checked,
    sigmaN: numberValue("sigma-n", 0.0001, 10),
    sigmaK: numberValue("sigma-k", 0.0001, 10),
  };
}

function validateSelectedChannels(data, settings) {
  if (settings.useReflectance && data.reflectanceValid.filter(Boolean).length < 10) {
    throw new Error("Fewer than 10 reflectance bins pass the sample/reference masks.");
  }
  if (settings.useTransmittance && data.transmittanceValid.filter(Boolean).length < 10) {
    throw new Error("Fewer than 10 transmittance bins pass the masks; disable T or revise the SNR threshold.");
  }
}

function normalizedSampleId(name) {
  const normalized = name.toLowerCase().replace(/[^a-z0-9]/g, "");
  return ({ agst: "agst", cgst: "cgst", asb2se3: "asb2sb3", csb2se3: "csb2sb3", asb2sb3: "asb2sb3", csb2sb3: "csb2sb3", vo2: "vo2" })[normalized] ?? "custom";
}

function rebuildParameterEditor() {
  const availability = { cody: new Set(["agst", "asb2sb3"]).has(state.sampleId), "drude-tl": state.sampleId === "vo2" };
  [...elements.model.options].forEach((option) => {
    if (option.value in availability) option.disabled = !availability[option.value];
  });
  if (elements.model.selectedOptions[0]?.disabled) elements.model.value = "fixed";
  const closest = state.nk ? state.nk.wavelengthNm.reduce((best, value, index) => Math.abs(value - 1064) < Math.abs(state.nk.wavelengthNm[best] - 1064) ? index : best, 0) : 0;
  state.parameterSpecs = modelParameterSpecs(elements.model.value, state.sampleId, { n: state.nk?.n[closest] ?? 3, k: state.nk?.k[closest] ?? 0.1 });
  for (const name of ["rGain", "tGain"]) if (state.sharedCalibration?.gains[name] && state.parameterSpecs[name]) {
    state.parameterSpecs[name] = { ...state.parameterSpecs[name], value: state.sharedCalibration.gains[name], fit: false };
  }
  const rows = Object.entries(state.parameterSpecs).map(([name, specification]) => {
    const row = document.createElement("div");
    row.className = "parameter-row";
    const fit = document.createElement("input");
    fit.type = "checkbox";
    fit.id = `fit-${name}`;
    fit.checked = specification.fit;
    fit.disabled = Boolean(state.sharedCalibration?.gains[name]);
    fit.setAttribute("aria-label", `Fit ${specification.label}`);
    const label = document.createElement("label");
    label.className = "parameter-name";
    label.htmlFor = `parameter-${name}`;
    label.textContent = specification.label;
    if (specification.unit) {
      const unit = document.createElement("span");
      unit.className = "parameter-unit";
      unit.textContent = specification.unit;
      label.append(unit);
    }
    row.append(fit, label);
    for (const [kind, value] of [["parameter", specification.value], ["minimum", specification.minimum], ["maximum", specification.maximum]]) {
      const input = document.createElement("input");
      input.type = "number";
      input.id = `${kind}-${name}`;
      input.value = String(value);
      input.step = "any";
      input.disabled = Boolean(state.sharedCalibration?.gains[name]);
      input.setAttribute("aria-label", `${kind} ${specification.label}`);
      row.append(input);
    }
    return row;
  });
  elements["model-parameters"].replaceChildren(...rows);
  const notes = {
    fixed: "Uses the ellipsometry table without changing n or k; thickness and channel gains can be fitted.",
    scaled: "Scales tabulated n and k independently. This phenomenological correction is not inherently Kramers–Kronig consistent.",
    constant: "Assumes wavelength-independent n and k. Use only over a narrow spectral band.",
    tl1: "One causal Tauc–Lorentz transition. The default fit releases thickness and oscillator amplitude only.",
    tl2: "Two passive Tauc–Lorentz transitions sharing one bandgap.",
    "tl-gaussian": "A causal Tauc–Lorentz background plus one Gaussian interband transition.",
    cody: "Causal Cody–Lorentz absorption with an Urbach tail; restricted to amorphous GST and Sb₂Se₃.",
    "drude-tl": "Free-carrier Drude response plus a causal Tauc–Lorentz background; restricted to VO₂.",
  };
  elements["model-note"].textContent = notes[elements.model.value];
  updateEllipsometryControls();
}

function updateEllipsometryControls() {
  const unsupported = new Set(["fixed", "drude-tl"]).has(elements.model.value);
  elements["regularize-ellipsometry"].disabled = unsupported;
  for (const id of ["sigma-n", "sigma-k"]) elements[id].disabled = unsupported || !elements["regularize-ellipsometry"].checked;
  if (!unsupported && elements["regularize-ellipsometry"].checked && !state.sharedCalibration) {
    for (const [name, enabled] of [["rGain", elements["use-r"].checked], ["tGain", elements["use-t"].checked]]) {
      const fit = document.querySelector(`#fit-${name}`);
      if (fit && enabled) fit.checked = true;
    }
  }
}

function currentParameters() {
  return Object.fromEntries(Object.keys(state.parameterSpecs).map((name) => {
    const value = Number(document.querySelector(`#parameter-${name}`)?.value);
    if (!Number.isFinite(value)) throw new Error(`${state.parameterSpecs[name].label} must be finite.`);
    return [name, value];
  }));
}

function currentBounds(initial) {
  const bounds = {};
  const fittedParameters = [];
  for (const name of Object.keys(state.parameterSpecs)) {
    const minimum = Number(document.querySelector(`#minimum-${name}`)?.value);
    const maximum = Number(document.querySelector(`#maximum-${name}`)?.value);
    if (!Number.isFinite(minimum) || !Number.isFinite(maximum) || minimum >= maximum || initial[name] < minimum || initial[name] > maximum) {
      throw new Error(`${state.parameterSpecs[name].label} must have a finite value inside valid bounds.`);
    }
    bounds[name] = [minimum, maximum];
    if (document.querySelector(`#fit-${name}`)?.checked) fittedParameters.push(name);
  }
  if (!fittedParameters.length) throw new Error("Select at least one parameter to fit.");
  validatePhysicalBounds(elements.model.value, initial, bounds, fittedParameters);
  return { bounds, fittedParameters };
}

function validatePhysicalBounds(model, values, bounds, fitted) {
  const activeMaximum = (name) => fitted.includes(name) ? bounds[name][1] : values[name];
  const activeMinimum = (name) => fitted.includes(name) ? bounds[name][0] : values[name];
  const oscillators = model === "tl2"
    ? [["resonance1Ev", "broadening1Ev"], ["resonance2Ev", "broadening2Ev"]]
    : new Set(["tl1", "tl-gaussian", "drude-tl"]).has(model) ? [["resonanceEv", "broadeningEv"]] : [];
  for (const [resonance, width] of oscillators) {
    if (activeMinimum(resonance) <= activeMaximum("bandgapEv")) throw new Error(`Set min(${resonance}) above max(bandgap).`);
    if (activeMaximum(width) >= 2 * activeMinimum(resonance)) throw new Error(`Set max(${width}) below 2·min(${resonance}).`);
  }
  if (model === "cody" && (activeMinimum("transitionEv") <= activeMaximum("bandgapEv") || activeMinimum("resonanceEv") <= activeMaximum("bandgapEv"))) {
    throw new Error("Set min(transition) and min(resonance) above max(bandgap).");
  }
}

function previewModel() {
  try {
    const fitData = prepareCurrentData();
    const parameters = currentParameters();
    const settings = currentSettings();
    validateSelectedChannels(fitData, settings);
    validateModelAvailability(settings.model, state.sampleId);
    state.evaluation = evaluateOpticalModel(fitData, state.nk, parameters, settings);
    state.fitResult = { parameters, evaluation: state.evaluation, diagnostics: diagnosticsOf(fitData, state.evaluation, settings), preview: true };
    renderResult(state.fitResult, "Model updated; parameters have not been optimized yet.");
  } catch (error) {
    showError(error);
  }
}

function fitModel() {
  try {
    const fitData = prepareCurrentData();
    const initial = currentParameters();
    const settings = currentSettings();
    validateSelectedChannels(fitData, settings);
    validateModelAvailability(settings.model, state.sampleId);
    const { bounds, fittedParameters } = currentBounds(initial);
    if (settings.regularizeEllipsometry && !state.sharedCalibration && ((settings.useReflectance && !fittedParameters.includes("rGain")) || (settings.useTransmittance && !fittedParameters.includes("tGain")))) {
      throw new Error("Enable fitting for the active R/T gains before a regularized fit.");
    }
    if (state.worker) state.worker.terminate();
    state.worker = new Worker(new URL("./fit-worker.js", import.meta.url), { type: "module" });
    state.worker.addEventListener("message", handleWorkerMessage);
    state.worker.addEventListener("error", (event) => finishFitError(event.message));
    elements["fit-progress"].hidden = false;
    elements["fit-progress"].value = 0;
    setBusy(true, "Screening the parameter space…");
    state.worker.postMessage({ fitData, nk: state.nk, configuration: { settings, initial, bounds, fittedParameters } });
  } catch (error) {
    showError(error);
  }
}

function handleWorkerMessage({ data }) {
  if (data.type === "progress") {
    elements["fit-progress"].value = data.progress;
    setStatus(`Fitting parameters… ${data.progress}%`);
    return;
  }
  if (data.type === "error") return finishFitError(data.message);
  if (data.type === "shared-result") {
    state.worker.terminate();
    state.worker = null;
    elements["fit-progress"].hidden = true;
    setBusy(false);
    state.sharedCalibration = data.result;
    rebuildParameterEditor();
    previewModel();
    const { rGain, tGain } = data.result.gains;
    const excludedT = Object.entries(data.result.includedChannels).filter(([, channels]) => !channels.T).map(([sample]) => sample);
    const sharedWarning = data.result.gainsOutsideOperationalRange.length ? ` Warning: outside 0.8–1.2: ${data.result.gainsOutsideOperationalRange.join(", ")}.` : "";
    setStatus(`Shared gains fixed: R=${format(rGain, 4)}, T=${format(tGain, 4)}. T excluded for: ${excludedT.join(", ") || "none"}. Bounds: ${data.result.parametersAtBounds.join(", ") || "none"}.${sharedWarning}`);
    return;
  }
  if (data.type === "result") {
    state.fitResult = data.result;
    state.evaluation = data.result.evaluation;
    const parameters = data.result.parameters;
    for (const [name, value] of Object.entries(parameters)) {
      const input = document.querySelector(`#parameter-${name}`);
      if (input) input.value = Number(value).toPrecision(8);
    }
    setBusy(false);
    elements["fit-progress"].hidden = true;
    renderResult(data.result, "Fit completed on this device.");
    state.worker.terminate();
    state.worker = null;
  }
}

function finishFitError(message) {
  if (state.worker) state.worker.terminate();
  state.worker = null;
  elements["fit-progress"].hidden = true;
  setBusy(false);
  showError(new Error(message));
}

function renderResult(result, message) {
  const { parameters, diagnostics: values } = result;
  elements["metric-thickness"].textContent = format(parameters.thicknessNm, 2);
  elements["metric-rmse-r"].textContent = values.rmseReflectance === null ? "—" : format(values.rmseReflectance, 4);
  elements["metric-rmse-t"].textContent = values.rmseTransmittance === null ? "—" : format(values.rmseTransmittance, 4);
  elements["metric-bins"].textContent = `${values.reflectanceBins} / ${values.transmittanceBins}`;
  const condition = values.normalizedJacobianCondition;
  elements["diagnostic-condition"].textContent = condition === null ? "—" : Number.isFinite(condition) ? condition.toExponential(2) : "∞";
  elements["diagnostic-condition-note"].textContent = condition === null ? "Available after fitting" : condition > 1e4 ? "Poor local identifiability" : "Below the 10⁴ warning threshold";
  elements["diagnostic-bounds"].textContent = values.parametersAtBounds.length ? values.parametersAtBounds.join(", ") : "None";
  elements["diagnostic-power"].textContent = format(values.maximumPowerBalance, 5);
  elements["diagnostic-power-note"].textContent = values.minimumAbsorption < -1e-8 ? "Energy-balance warning" : "Passive R + T ≤ 1";
  elements["diagnostic-alternatives"].textContent = values.nearEqualAlternativeMinima === null ? "—" : String(values.nearEqualAlternativeMinima);
  renderAlternativeSolutions(values.alternativeSolutions ?? [], result.preview);
  const uncertainties = Object.entries(values.parameterStandardErrorsApproximate)
    .filter(([, value]) => Number.isFinite(value))
    .map(([name, value]) => `${name} ± ${format(value, 3)}`);
  const warnings = [];
  if (values.gainsOutsideOperationalRange.length) warnings.push(`gain outside 0.8–1.2: ${values.gainsOutsideOperationalRange.join(", ")}`);
  if (state.sharedCalibration?.gainsOutsideOperationalRange.length) warnings.push(`shared gain outside 0.8–1.2: ${state.sharedCalibration.gainsOutsideOperationalRange.join(", ")}`);
  const shape = Object.entries(values.shapeAfterAffineAlignment ?? {}).map(([channel, metric]) => `${channel}=${format(metric.rmse, 4)}`);
  if (shape.length) warnings.push(`Affine-shape RMSE: ${shape.join(", ")}`);
  if (Number.isFinite(values.indexVsEllipsometry?.rmseDeltaN)) warnings.push(`n,k RMSE vs ellipsometry: ${format(values.indexVsEllipsometry.rmseDeltaN, 3)}, ${format(values.indexVsEllipsometry.rmseDeltaK, 3)}`);
  if (uncertainties.length) warnings.push(`Approximate 1σ: ${uncertainties.join("; ")}`);
  elements["diagnostic-note"].textContent = warnings.join(" · ") || "Local finite-difference diagnostics; uncertainty estimates are approximate.";
  elements["download-json"].disabled = false;
  elements["download-csv"].disabled = false;
  elements["download-nk-csv"].disabled = false;
  const parameterText = Object.entries(parameters).map(([name, value]) => `${name}=${format(value, 5)}`).join("; ");
  elements["provenance-text"].textContent = `${state.source.sampleName}; ${MODEL_LABELS[elements.model.value]}; ${parameterText}.`;
  setStatus(message);
  drawAll();
}

function renderAlternativeSolutions(solutions, preview) {
  elements["alternative-details"].hidden = preview || !solutions.length;
  if (preview || !solutions.length) return elements["alternative-solutions"].replaceChildren();
  const fitted = Object.keys(state.parameterSpecs).filter((name) => document.querySelector(`#fit-${name}`)?.checked);
  const rows = solutions.map((solution) => {
    const row = document.createElement("tr");
    const metrics = `${solution.channelMetrics.R ? format(solution.channelMetrics.R.rmse, 4) : "—"} / ${solution.channelMetrics.T ? format(solution.channelMetrics.T.rmse, 4) : "—"}`;
    const indexMetrics = `${Number.isFinite(solution.indexVsEllipsometry.rmseDeltaN) ? format(solution.indexVsEllipsometry.rmseDeltaN, 3) : "—"} / ${Number.isFinite(solution.indexVsEllipsometry.rmseDeltaK) ? format(solution.indexVsEllipsometry.rmseDeltaK, 3) : "—"}`;
    const parameterText = fitted.map((name) => `${name}=${Number(solution.parameters[name]).toPrecision(5)}`).join("; ");
    for (const value of [
      solution.rank,
      solution.localStart || "initial",
      Number(solution.robustCost).toExponential(3),
      `${format(100 * solution.relativeCostIncrease, 2)}%`,
      format(solution.normalizedParameterDistanceFromBest, 4),
      metrics,
      indexMetrics,
      solution.fittedParametersAtBounds.join(", ") || "None",
      parameterText,
    ]) {
      const cell = document.createElement("td");
      cell.textContent = String(value);
      row.append(cell);
    }
    return row;
  });
  elements["alternative-solutions"].replaceChildren(...rows);
}

function drawAll() {
  if (!state.fitData || !state.evaluation) return;
  const x = state.fitData.wavelengthNm;
  drawChart(elements["rt-chart"], x, [
    { values: state.fitData.reflectance.map((value, index) => state.fitData.reflectanceValid[index] ? value : Number.NaN), color: "#a8bbb4", points: true },
    { values: state.evaluation.reflectanceScaled, color: "#cbf36b" },
    { values: state.fitData.transmittance.map((value, index) => state.fitData.transmittanceValid[index] ? value : Number.NaN), color: "#718d84", points: true },
    { values: state.evaluation.transmittanceScaled, color: "#ff8a57" },
  ], { minimumY: 0, yLabel: "R, T" });
  drawChart(elements["residual-chart"], x, [
    { values: state.evaluation.reflectanceScaled.map((value, index) => state.fitData.reflectanceValid[index] ? value - state.fitData.reflectance[index] : Number.NaN), color: "#cbf36b" },
    { values: state.evaluation.transmittanceScaled.map((value, index) => state.fitData.transmittanceValid[index] ? value - state.fitData.transmittance[index] : Number.NaN), color: "#ff8a57" },
  ], { symmetricY: true, yLabel: "Model − data" });
  const indexSeries = [
    { values: state.evaluation.n, color: "#cbf36b" },
    { values: state.evaluation.k, color: "#ff8a57" },
  ];
  if (elements["show-ellipsometry"].checked) {
    const ellipsometry = tabulatedRefractiveIndex(state.nk, x);
    indexSeries.push(
      { values: ellipsometry.n.map((value, index) => x[index] >= 300 && x[index] <= 1100 ? value : Number.NaN), color: "#8da858", dash: [5, 4] },
      { values: ellipsometry.k.map((value, index) => x[index] >= 300 && x[index] <= 1100 ? value : Number.NaN), color: "#b66b4d", dash: [5, 4] },
    );
  }
  drawChart(elements["nk-chart"], x, indexSeries, { minimumY: 0, yLabel: "n, k" });
}

function drawChart(canvas, x, series, options) {
  const ratio = Math.min(2, window.devicePixelRatio || 1);
  const width = Math.max(320, Math.round(canvas.clientWidth));
  const height = Math.max(240, Math.round(canvas.clientHeight));
  canvas.width = Math.round(width * ratio);
  canvas.height = Math.round(height * ratio);
  const context = canvas.getContext("2d");
  context.scale(ratio, ratio);
  const margin = { left: 52, right: 18, top: 16, bottom: 36 };
  const plotWidth = width - margin.left - margin.right;
  const plotHeight = height - margin.top - margin.bottom;
  const xMinimum = Math.min(...x);
  const xMaximum = Math.max(...x);
  const finiteValues = series.flatMap((entry) => entry.values.filter(Number.isFinite));
  const maximumAbsoluteY = Math.max(...finiteValues.map(Math.abs));
  const yMinimum = options.symmetricY ? -(maximumAbsoluteY || 1) * 1.08 : options.minimumY ?? Math.min(...finiteValues);
  const yMaximumRaw = options.symmetricY ? maximumAbsoluteY || 1 : Math.max(...finiteValues);
  const yMaximum = yMaximumRaw > yMinimum ? yMaximumRaw * 1.08 : yMinimum + 1;
  const xPixel = (value) => margin.left + (value - xMinimum) / (xMaximum - xMinimum) * plotWidth;
  const yPixel = (value) => margin.top + (yMaximum - value) / (yMaximum - yMinimum) * plotHeight;

  context.clearRect(0, 0, width, height);
  context.font = "11px ui-monospace, monospace";
  context.fillStyle = "#6f8a81";
  context.strokeStyle = "#25473d";
  context.lineWidth = 1;
  for (let step = 0; step <= 4; step += 1) {
    const y = margin.top + step / 4 * plotHeight;
    const value = yMaximum - step / 4 * (yMaximum - yMinimum);
    context.beginPath(); context.moveTo(margin.left, y); context.lineTo(width - margin.right, y); context.stroke();
    context.fillText(format(value, yMaximum < 2 ? 2 : 1), 5, y + 4);
  }
  for (let step = 0; step <= 4; step += 1) {
    const value = xMinimum + step / 4 * (xMaximum - xMinimum);
    const px = xPixel(value);
    context.fillText(String(Math.round(value)), px - 14, height - 10);
  }
  context.fillText("λ / nm", width - 50, height - 10);
  context.save(); context.translate(14, margin.top + 12); context.rotate(-Math.PI / 2); context.fillText(options.yLabel, 0, 0); context.restore();

  for (const entry of series) {
    context.strokeStyle = entry.color;
    context.fillStyle = entry.color;
    context.lineWidth = entry.points ? 1 : 2;
    context.globalAlpha = entry.points ? 0.8 : 1;
    context.setLineDash(entry.dash ?? []);
    context.beginPath();
    let drawing = false;
    entry.values.forEach((value, index) => {
      if (!Number.isFinite(value)) { drawing = false; return; }
      const px = xPixel(x[index]);
      const py = yPixel(value);
      if (drawing) context.lineTo(px, py); else context.moveTo(px, py);
      drawing = true;
    });
    context.stroke();
    if (entry.points) entry.values.forEach((value, index) => {
      if (!Number.isFinite(value) || index % Math.max(1, Math.floor(entry.values.length / 140)) !== 0) return;
      context.fillRect(xPixel(x[index]) - 1.25, yPixel(value) - 1.25, 2.5, 2.5);
    });
  }
  context.setLineDash([]);
  context.globalAlpha = 1;
}

function exportPayload() {
  if (!state.fitResult || !state.fitData) throw new Error("No results are available for export.");
  return {
    schema: "reflectometry-browser-fit/v1",
    application: { name: "Reflectometry", version: "0.8.0", url: "https://jorpago2.github.io/reflectometry/" },
    generatedAt: new Date().toISOString(),
    source: state.source,
    calibration: {
      wavelengthRangeNm: [Number(elements["wavelength-min"].value), Number(elements["wavelength-max"].value)],
      referenceThresholdFraction: Number(elements["reference-threshold"].value) / 100,
      binWidthNm: Number(elements["bin-width"].value),
      sampleSnrMinimum: Number(elements["sample-snr"].value),
      subtractBackground: elements["subtract-background"].checked,
    },
    model: {
      ...currentSettings(),
      parameters: state.fitResult.parameters,
      parameterConfiguration: Object.fromEntries(Object.keys(state.parameterSpecs).map((name) => [name, {
        fit: Boolean(document.querySelector(`#fit-${name}`)?.checked),
        minimum: Number(document.querySelector(`#minimum-${name}`)?.value),
        maximum: Number(document.querySelector(`#maximum-${name}`)?.value),
      }])),
    },
    diagnostics: state.fitResult.diagnostics,
    sharedGainCalibration: state.sharedCalibration,
    optimizer: state.fitResult.preview ? null : { method: "SciPy-compatible scrambled Sobol screening + bounded trust-region reflective least squares", seed: 1729, screeningPoints: state.fitResult.screeningPoints, localRefinements: state.fitResult.localRefinements },
    assumptions: ["normal incidence", "single coherent homogeneous isotropic film", "optically thick incoherent substrate", "shared gains require unchanged detector settings and geometry across samples"],
  };
}

function downloadJson() {
  try { saveFile(JSON.stringify(exportPayload(), null, 2), `${safeName(state.source.sampleName)}-fit.json`, "application/json"); }
  catch (error) { showError(error); }
}

function downloadCsv() {
  try {
    exportPayload();
    const reference = tabulatedRefractiveIndex(state.nk, state.fitData.wavelengthNm);
    const header = "wavelength_nm,reflectance_calibrated_signal,transmittance_calibrated_signal,reflectance_snr_valid,transmittance_snr_valid,reflectance_model_physical,transmittance_model_physical,reflectance_model_times_gain,transmittance_model_times_gain,reflectance_residual,transmittance_residual,n_model,k_model,n_ellipsometry,k_ellipsometry,delta_n_model_minus_ellipsometry,delta_k_model_minus_ellipsometry";
    const rows = state.fitData.wavelengthNm.map((wavelength, index) => {
      const referenceN = wavelength >= 300 && wavelength <= 1100 ? reference.n[index] : "";
      const referenceK = wavelength >= 300 && wavelength <= 1100 ? reference.k[index] : "";
      return [
      wavelength,
      state.fitData.reflectance[index],
      state.fitData.transmittance[index],
      state.fitData.reflectanceValid[index],
      state.fitData.transmittanceValid[index],
      state.evaluation.reflectance[index],
      state.evaluation.transmittance[index],
      state.evaluation.reflectanceScaled[index],
      state.evaluation.transmittanceScaled[index],
      state.fitData.reflectanceValid[index] ? state.evaluation.reflectanceScaled[index] - state.fitData.reflectance[index] : "",
      state.fitData.transmittanceValid[index] ? state.evaluation.transmittanceScaled[index] - state.fitData.transmittance[index] : "",
      state.evaluation.n[index],
      state.evaluation.k[index],
      referenceN,
      referenceK,
      referenceN === "" ? "" : state.evaluation.n[index] - referenceN,
      referenceK === "" ? "" : state.evaluation.k[index] - referenceK,
      ].join(",");
    });
    saveFile([header, ...rows].join("\n"), `${safeName(state.source.sampleName)}-fit.csv`, "text/csv");
  } catch (error) { showError(error); }
}

function downloadNkCsv() {
  try {
    exportPayload();
    const wavelengthNm = state.nk.wavelengthNm.filter((value) => value >= 300 && value <= 1100);
    const reference = tabulatedRefractiveIndex(state.nk, wavelengthNm);
    const modeled = refractiveIndexModel(elements.model.value, wavelengthNm, state.fitResult.parameters, state.nk);
    const header = "wavelength_nm,n_model,k_model,n_ellipsometry,k_ellipsometry,delta_n_model_minus_ellipsometry,delta_k_model_minus_ellipsometry";
    const rows = wavelengthNm.map((wavelength, index) => [wavelength, modeled.n[index], modeled.k[index], reference.n[index], reference.k[index], modeled.n[index] - reference.n[index], modeled.k[index] - reference.k[index]].join(","));
    saveFile([header, ...rows].join("\n"), `${safeName(state.source.sampleName)}-fit-nk.csv`, "text/csv");
  } catch (error) { showError(error); }
}

function saveFile(content, name, type) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const link = document.createElement("a");
  link.href = url; link.download = name; link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function safeName(value) { return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "sample"; }
function format(value, digits) { return Number.isFinite(value) ? Number(value).toFixed(digits) : "—"; }

function numberValue(id, minimum, maximum) {
  const value = Number(elements[id].value);
  if (!Number.isFinite(value) || value < minimum || value > maximum) throw new Error(`${elements[id].closest("label")?.textContent.trim() || id}: value outside the allowed range.`);
  return value;
}

async function sha256(text) {
  if (!crypto.subtle) return null;
  const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text)));
  return [...digest].map((value) => value.toString(16).padStart(2, "0")).join("");
}

async function fetchText(path) {
  const response = await fetch(new URL(path, import.meta.url));
  if (!response.ok) throw new Error(`Could not load ${path}.`);
  return response.text();
}

function setBusy(busy, message = null) {
  elements["load-demo"].disabled = busy;
  elements["load-files"].disabled = busy;
  elements["shared-gains"].disabled = busy;
  elements["preview-button"].disabled = busy;
  elements["fit-button"].disabled = busy;
  document.querySelectorAll(".controls input, .controls select").forEach((control) => {
    if (busy) {
      control.dataset.disabledBeforeBusy = String(control.disabled);
      control.disabled = true;
    } else if ("disabledBeforeBusy" in control.dataset) {
      control.disabled = control.dataset.disabledBeforeBusy === "true";
      delete control.dataset.disabledBeforeBusy;
    }
  });
  if (message) setStatus(message);
}

function setStatus(message) { elements.status.textContent = message; }
function showError(error) { setStatus(`Error: ${error instanceof Error ? error.message : String(error)}`); }

loadDemo("agst");
