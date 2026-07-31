import {
  createSpectrum,
  evaluateTabulated,
  loadNkTable,
  prepareFitData,
  restrictToNkRange,
} from "./scientific-core.js";

const DEMOS = {
  agst: { label: "aGST", thickness: 250, sampleR: "agst-ref.txt", sampleT: "agst-tr.txt", nk: "aGST.txt" },
  cgst: { label: "cGST", thickness: 250, sampleR: "cgst-ref.txt", sampleT: "cgst-tr.txt", nk: "cGST.txt" },
  asb2sb3: { label: "aSb₂Se₃", thickness: 200, sampleR: "asb2sb3-ref.txt", sampleT: "asb2sb3-tr.txt", nk: "aSb2Se3.txt" },
  csb2sb3: { label: "cSb₂Se₃", thickness: 200, sampleR: "csb2sb3-ref.txt", sampleT: "csb2sb3-tr.txt", nk: "cSb2Se3.txt" },
  vo2: { label: "VO₂", thickness: 150, sampleR: "vo2-ref.txt", sampleT: "vo2-tr.txt", nk: "VO2_22C.txt" },
};

const elements = Object.fromEntries([...document.querySelectorAll("[id]")].map((element) => [element.id, element]));
const required = ["load-demo", "load-files", "preview-button", "fit-button", "rt-chart", "nk-chart", "status"];
if (required.some((id) => !elements[id])) throw new Error("La interfaz está incompleta.");

const state = { spectrum: null, nk: null, fitData: null, evaluation: null, fitResult: null, source: null, worker: null };

elements["load-demo"].addEventListener("click", () => loadDemo(elements["demo-sample"].value));
elements["load-files"].addEventListener("click", loadLocalFiles);
elements["preview-button"].addEventListener("click", previewModel);
elements["fit-button"].addEventListener("click", fitModel);
elements.model.addEventListener("change", () => {
  elements["scale-fields"].hidden = elements.model.value !== "scaled";
  previewModel();
});
elements["download-json"].addEventListener("click", downloadJson);
elements["download-csv"].addEventListener("click", downloadCsv);
window.addEventListener("resize", () => state.evaluation && drawAll());

async function loadDemo(id) {
  const demo = DEMOS[id];
  if (!demo) return;
  setBusy(true, `Cargando ${demo.label}…`);
  try {
    const paths = {
      sampleR: `examples/${demo.sampleR}`,
      sampleT: `examples/${demo.sampleT}`,
      silicon: "examples/si-ref.txt",
      openBeam: "examples/referencitrx.txt",
      siliconModel: "examples/si_reflectance.txt",
      nk: `examples/${demo.nk}`,
    };
    const entries = await Promise.all(Object.entries(paths).map(async ([name, path]) => {
      const response = await fetch(new URL(path, import.meta.url));
      if (!response.ok) throw new Error(`No se pudo cargar ${path}.`);
      return [name, await response.text(), path];
    }));
    const texts = Object.fromEntries(entries.map(([name, text]) => [name, text]));
    await setSource(texts, demo.label, Object.fromEntries(entries.map(([name, , path]) => [name, path])));
    setNominalThickness(demo.thickness);
    elements["use-t"].checked = id !== "cgst";
    elements["source-name"].textContent = `${demo.label} · datos de demostración incluidos`;
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
  if (missing.length) return showError(new Error("Selecciona los seis archivos antes de procesar."));
  setBusy(true, "Leyendo archivos locales…");
  try {
    const texts = Object.fromEntries(await Promise.all(Object.entries(files).map(async ([name, file]) => [name, await file.text()])));
    const names = Object.fromEntries(Object.entries(files).map(([name, file]) => [name, file.name]));
    const sampleName = files.sampleR.name.replace(/-ref\.txt$/i, "") || "muestra";
    await setSource(texts, sampleName, names);
    elements["source-name"].textContent = `${sampleName} · archivos locales`;
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

function setNominalThickness(value) {
  elements.thickness.value = String(value);
  elements["thickness-min"].value = String(value * 0.5);
  elements["thickness-max"].value = String(value * 1.5);
}

function prepareCurrentData() {
  if (!state.spectrum || !state.nk) throw new Error("Carga primero una muestra y su tabla n,k.");
  const data = prepareFitData(state.spectrum, {
    wavelengthMinNm: numberValue("wavelength-min", 195, 3000),
    wavelengthMaxNm: numberValue("wavelength-max", 196, 3000),
    referenceThresholdFraction: numberValue("reference-threshold", 0, 99) / 100,
    binWidthNm: numberValue("bin-width", 0.1, 100),
    sampleSnrMinimum: numberValue("sample-snr", 0, 100),
    subtractBackground: elements["subtract-background"].checked,
  });
  state.fitData = restrictToNkRange(data, state.nk);
  return state.fitData;
}

function currentSettings() {
  const useReflectance = elements["use-r"].checked;
  const useTransmittance = elements["use-t"].checked;
  if (!useReflectance && !useTransmittance) throw new Error("Selecciona R, T o ambos canales.");
  return {
    model: elements.model.value,
    substrateIndex: numberValue("substrate-index", 1.001, 5),
    incidence: elements.incidence.value,
    useReflectance,
    useTransmittance,
    sigmaReflectance: numberValue("sigma-r", 0.0001, 1),
    sigmaTransmittance: numberValue("sigma-t", 0.0001, 1),
  };
}

function validateSelectedChannels(data, settings) {
  if (settings.useReflectance && data.reflectanceValid.filter(Boolean).length < 10) {
    throw new Error("Menos de 10 bins de reflectancia superan las máscaras de señal y referencia.");
  }
  if (settings.useTransmittance && data.transmittanceValid.filter(Boolean).length < 10) {
    throw new Error("Menos de 10 bins de transmitancia superan las máscaras; desactiva T o revisa el SNR.");
  }
}

function currentParameters() {
  return {
    thicknessNm: numberValue("thickness", 1, 5000),
    nScale: elements.model.value === "scaled" ? numberValue("n-scale", 0.85, 1.15) : 1,
    kScale: elements.model.value === "scaled" ? numberValue("k-scale", 0.5, 2) : 1,
    rGain: 1,
    tGain: 1,
  };
}

function currentBounds(initial) {
  const minimum = numberValue("thickness-min", 1, 5000);
  const maximum = numberValue("thickness-max", 2, 10000);
  if (!(minimum < maximum) || initial.thicknessNm < minimum || initial.thicknessNm > maximum) {
    throw new Error("El espesor inicial debe estar dentro de unas cotas válidas.");
  }
  return {
    thicknessNm: [minimum, maximum],
    nScale: [0.85, 1.15],
    kScale: [0.5, 2],
    rGain: [0.1, 10],
    tGain: [0.1, 10],
  };
}

function previewModel() {
  try {
    const fitData = prepareCurrentData();
    const parameters = currentParameters();
    const settings = currentSettings();
    validateSelectedChannels(fitData, settings);
    state.evaluation = evaluateTabulated(fitData, state.nk, parameters, settings);
    state.fitResult = { parameters, evaluation: state.evaluation, diagnostics: diagnostics(fitData, state.evaluation, settings), preview: true };
    renderResult(state.fitResult, "Modelo actualizado; todavía no se han optimizado parámetros.");
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
    const bounds = currentBounds(initial);
    if (state.worker) state.worker.terminate();
    state.worker = new Worker(new URL("./fit-worker.js", import.meta.url), { type: "module" });
    state.worker.addEventListener("message", handleWorkerMessage);
    state.worker.addEventListener("error", (event) => finishFitError(event.message));
    elements["fit-progress"].hidden = false;
    elements["fit-progress"].value = 0;
    setBusy(true, "Explorando el espacio de parámetros…");
    state.worker.postMessage({ fitData, nk: state.nk, configuration: { settings, initial, bounds } });
  } catch (error) {
    showError(error);
  }
}

function handleWorkerMessage({ data }) {
  if (data.type === "progress") {
    elements["fit-progress"].value = data.progress;
    setStatus(`Ajustando parámetros… ${data.progress} %`);
    return;
  }
  if (data.type === "error") return finishFitError(data.message);
  if (data.type === "result") {
    state.fitResult = data.result;
    state.evaluation = data.result.evaluation;
    const parameters = data.result.parameters;
    elements.thickness.value = parameters.thicknessNm.toFixed(3);
    elements["n-scale"].value = parameters.nScale.toFixed(5);
    elements["k-scale"].value = parameters.kScale.toFixed(5);
    setBusy(false);
    elements["fit-progress"].hidden = true;
    renderResult(data.result, "Ajuste completado en el dispositivo.");
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
  elements["download-json"].disabled = false;
  elements["download-csv"].disabled = false;
  elements["provenance-text"].textContent = `${state.source.sampleName}; modelo ${elements.model.value}; d=${format(parameters.thicknessNm, 3)} nm; n×${format(parameters.nScale, 5)}; k×${format(parameters.kScale, 5)}; ganancias R/T=${format(parameters.rGain, 5)}/${format(parameters.tGain, 5)}.`;
  setStatus(message);
  drawAll();
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
  drawChart(elements["nk-chart"], x, [
    { values: state.evaluation.n, color: "#cbf36b" },
    { values: state.evaluation.k, color: "#ff8a57" },
  ], { minimumY: 0, yLabel: "n, k" });
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
  const yMinimum = options.minimumY ?? Math.min(...finiteValues);
  const yMaximumRaw = Math.max(...finiteValues);
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
  context.globalAlpha = 1;
}

function diagnostics(data, evaluation, settings) {
  const rmse = (modeled, measured, valid) => {
    const residuals = modeled.map((value, index) => valid[index] ? value - measured[index] : Number.NaN).filter(Number.isFinite);
    return residuals.length ? Math.sqrt(residuals.reduce((sum, value) => sum + value ** 2, 0) / residuals.length) : null;
  };
  return {
    rmseReflectance: settings.useReflectance ? rmse(evaluation.reflectanceScaled, data.reflectance, data.reflectanceValid) : null,
    rmseTransmittance: settings.useTransmittance ? rmse(evaluation.transmittanceScaled, data.transmittance, data.transmittanceValid) : null,
    reflectanceBins: data.reflectanceValid.filter(Boolean).length,
    transmittanceBins: data.transmittanceValid.filter(Boolean).length,
  };
}

function exportPayload() {
  if (!state.fitResult || !state.fitData) throw new Error("No hay resultados para exportar.");
  return {
    schema: "reflectometry-browser-fit/v1",
    generatedAt: new Date().toISOString(),
    source: state.source,
    calibration: {
      wavelengthRangeNm: [Number(elements["wavelength-min"].value), Number(elements["wavelength-max"].value)],
      referenceThresholdFraction: Number(elements["reference-threshold"].value) / 100,
      binWidthNm: Number(elements["bin-width"].value),
      sampleSnrMinimum: Number(elements["sample-snr"].value),
      subtractBackground: elements["subtract-background"].checked,
    },
    model: { ...currentSettings(), parameters: state.fitResult.parameters },
    diagnostics: state.fitResult.diagnostics,
    optimizer: state.fitResult.preview ? null : { method: "Halton screening + bounded Nelder-Mead", screeningPoints: state.fitResult.screeningPoints, localRefinements: state.fitResult.localRefinements },
    assumptions: ["normal incidence", "single coherent homogeneous isotropic film", "optically thick incoherent substrate"],
  };
}

function downloadJson() {
  try { saveFile(JSON.stringify(exportPayload(), null, 2), `${safeName(state.source.sampleName)}-fit.json`, "application/json"); }
  catch (error) { showError(error); }
}

function downloadCsv() {
  try {
    exportPayload();
    const header = "wavelength_nm,reflectance_measured,reflectance_modeled,transmittance_measured,transmittance_modeled,n,k";
    const rows = state.fitData.wavelengthNm.map((wavelength, index) => [
      wavelength,
      state.fitData.reflectanceValid[index] ? state.fitData.reflectance[index] : "",
      state.evaluation.reflectanceScaled[index],
      state.fitData.transmittanceValid[index] ? state.fitData.transmittance[index] : "",
      state.evaluation.transmittanceScaled[index],
      state.evaluation.n[index],
      state.evaluation.k[index],
    ].join(","));
    saveFile([header, ...rows].join("\n"), `${safeName(state.source.sampleName)}-fit.csv`, "text/csv");
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
  if (!Number.isFinite(value) || value < minimum || value > maximum) throw new Error(`${elements[id].closest("label")?.textContent.trim() || id}: valor fuera de rango.`);
  return value;
}

async function sha256(text) {
  if (!crypto.subtle) return null;
  const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text)));
  return [...digest].map((value) => value.toString(16).padStart(2, "0")).join("");
}

function setBusy(busy, message = null) {
  elements["load-demo"].disabled = busy;
  elements["load-files"].disabled = busy;
  elements["preview-button"].disabled = busy;
  elements["fit-button"].disabled = busy;
  if (message) setStatus(message);
}

function setStatus(message) { elements.status.textContent = message; }
function showError(error) { setStatus(`Error: ${error instanceof Error ? error.message : String(error)}`); }

loadDemo("agst");
