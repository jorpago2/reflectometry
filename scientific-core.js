import { refractiveIndexModel } from "./dielectric-models.js";
import { scrambledSobolPoints } from "./sobol.js";

const EPSILON = Number.EPSILON;
const LOG_PARAMETERS = new Set(["amplitude", "amplitudeEv", "amplitude1Ev", "amplitude2Ev", "broadeningEv", "broadening1Ev", "broadening2Ev", "fwhmEv", "gammaEv", "gaussianAmplitude", "gaussianFwhmEv", "plasmaEnergyEv", "drudeGammaEv", "rGain", "tGain"]);
const CAUSAL_ELLIPSOMETRY_MODELS = new Set(["tl1", "tl2", "tl-gaussian", "cody"]);
const baseParameterName = (name) => name.includes("__") ? name.slice(name.lastIndexOf("__") + 2) : name;
const isLogParameter = (name) => LOG_PARAMETERS.has(baseParameterName(name));

export function parseNumericTable(text, minimumColumns = 2) {
  const rows = String(text)
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("#") && !line.startsWith(";"))
    .map((line) => line.replaceAll(";", " ").split(/\s+/).map((field) => Number(field.replace(",", "."))))
    .filter((row) => row.length >= minimumColumns && row.every(Number.isFinite));
  if (!rows.length) throw new Error(`No numeric table with ${minimumColumns} columns was found.`);
  const width = Math.min(...rows.map((row) => row.length));
  return rows.map((row) => row.slice(0, width));
}

export function loadNkTable(text) {
  const rows = parseNumericTable(text, 3).map((row) => row.slice(0, 3));
  const factor = median(rows.map((row) => row[0])) < 10 ? 1000 : 1;
  rows.sort((a, b) => a[0] - b[0]);
  const wavelengthNm = rows.map((row) => row[0] * factor);
  if (wavelengthNm.some((value, index) => index && value <= wavelengthNm[index - 1])) {
    throw new Error("The n,k table contains repeated or unordered wavelengths.");
  }
  return {
    wavelengthNm,
    n: rows.map((row) => row[1]),
    k: rows.map((row) => Math.max(0, row[2])),
  };
}

export function createSpectrum({ sampleName, sampleR, sampleT, silicon, openBeam, siliconModel }) {
  const r = parseNumericTable(sampleR).map((row) => row.slice(0, 2));
  const t = parseNumericTable(sampleT).map((row) => row.slice(0, 2));
  const si = parseNumericTable(silicon).map((row) => row.slice(0, 2));
  const open = parseNumericTable(openBeam).map((row) => row.slice(0, 2));
  if (![t, si, open].every((table) => sameGrid(r, table))) {
    throw new Error("The sample and reference spectra do not share the same wavelength grid.");
  }
  const model = parseNumericTable(siliconModel).map((row) => row.slice(0, 2)).sort((a, b) => a[0] - b[0]);
  const wavelengthNm = r.map((row) => row[0]);
  return {
    sampleName,
    wavelengthNm,
    sampleReflectanceCounts: r.map((row) => row[1]),
    sampleTransmittanceCounts: t.map((row) => row[1]),
    siliconCounts: si.map((row) => row[1]),
    openBeamCounts: open.map((row) => row[1]),
    siliconReflectance: interpolate(
      model.map((row) => row[0]),
      model.map((row) => row[1]),
      wavelengthNm.map((value) => value / 1000),
      Number.NaN,
    ),
  };
}

function sameGrid(a, b) {
  return a.length === b.length && a.every((row, index) => row[0] === b[index][0]);
}

export function median(values) {
  if (!values.length) return Number.NaN;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

function standardDeviation(values) {
  if (values.length < 2) return 0;
  const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
  return Math.sqrt(values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / (values.length - 1));
}

export function robustBackground(wavelengthNm, counts, minimumNm = 195, maximumNm = 250) {
  const values = counts.filter((value, index) => wavelengthNm[index] >= minimumNm && wavelengthNm[index] <= maximumNm);
  if (values.length < 20 || values.some((value) => !Number.isFinite(value))) {
    throw new Error("At least 20 finite points from 195 to 250 nm are required to estimate the background.");
  }
  const level = median(values);
  let sigma = 1.4826 * median(values.map((value) => Math.abs(value - level)));
  if (sigma <= EPSILON) sigma = standardDeviation(values);
  if (sigma <= EPSILON) throw new Error("The background-noise estimate is zero.");
  return { level, sigma };
}

export function prepareFitData(spectrum, options) {
  const {
    wavelengthMinNm,
    wavelengthMaxNm,
    referenceThresholdFraction,
    binWidthNm,
    sampleSnrMinimum = 0,
    subtractBackground = false,
  } = options;
  if (!(referenceThresholdFraction >= 0 && referenceThresholdFraction < 1)) {
    throw new Error("The reference threshold must be between 0 and 100%.");
  }
  if (!(wavelengthMinNm < wavelengthMaxNm) || !(binWidthNm > 0) || sampleSnrMinimum < 0) {
    throw new Error("The wavelength range, bin width, and SNR must be valid.");
  }
  const channels = {
    sampleR: spectrum.sampleReflectanceCounts,
    sampleT: spectrum.sampleTransmittanceCounts,
    silicon: spectrum.siliconCounts,
    openBeam: spectrum.openBeamCounts,
  };
  const background = Object.fromEntries(
    Object.entries(channels).map(([name, counts]) => [name, robustBackground(spectrum.wavelengthNm, counts)]),
  );
  const corrected = Object.fromEntries(
    Object.entries(channels).map(([name, counts]) => [
      name,
      counts.map((value) => value - (subtractBackground ? background[name].level : 0)),
    ]),
  );
  const finiteMax = (values) => Math.max(...values.filter(Number.isFinite));
  const siliconThreshold = referenceThresholdFraction * finiteMax(corrected.silicon);
  const openThreshold = referenceThresholdFraction * finiteMax(corrected.openBeam);
  const reflectanceMask = spectrum.wavelengthNm.map((wavelength, index) => (
    wavelength >= wavelengthMinNm
    && wavelength <= wavelengthMaxNm
    && Number.isFinite(spectrum.siliconReflectance[index])
    && Number.isFinite(corrected.sampleR[index])
    && Number.isFinite(corrected.silicon[index])
    && corrected.sampleR[index] >= 0
    && corrected.silicon[index] > siliconThreshold
    && corrected.sampleR[index] - (subtractBackground ? 0 : background.sampleR.level) >= sampleSnrMinimum * background.sampleR.sigma
  ));
  const transmittanceMask = spectrum.wavelengthNm.map((wavelength, index) => (
    wavelength >= wavelengthMinNm
    && wavelength <= wavelengthMaxNm
    && Number.isFinite(corrected.sampleT[index])
    && Number.isFinite(corrected.openBeam[index])
    && corrected.sampleT[index] >= 0
    && corrected.openBeam[index] > openThreshold
    && corrected.sampleT[index] - (subtractBackground ? 0 : background.sampleT.level) >= sampleSnrMinimum * background.sampleT.sigma
  ));
  const validIndices = spectrum.wavelengthNm.map((_, index) => index).filter((index) => reflectanceMask[index] || transmittanceMask[index]);
  if (validIndices.length < 10) throw new Error("Fewer than 10 valid calibrated points remain.");

  const bins = new Map();
  for (const index of validIndices) {
    const bin = Math.floor((spectrum.wavelengthNm[index] - wavelengthMinNm) / binWidthNm);
    if (!bins.has(bin)) bins.set(bin, []);
    bins.get(bin).push(index);
  }
  const wavelengthNm = [];
  const reflectance = [];
  const transmittance = [];
  const reflectanceValid = [];
  const transmittanceValid = [];
  for (const indices of bins.values()) {
    const rIndices = indices.filter((index) => reflectanceMask[index]);
    const tIndices = indices.filter((index) => transmittanceMask[index]);
    wavelengthNm.push(median(indices.map((index) => spectrum.wavelengthNm[index])));
    reflectance.push(rIndices.length
      ? median(rIndices.map((index) => corrected.sampleR[index]))
        / median(rIndices.map((index) => corrected.silicon[index]))
        * median(rIndices.map((index) => spectrum.siliconReflectance[index]))
      : Number.NaN);
    transmittance.push(tIndices.length
      ? median(tIndices.map((index) => corrected.sampleT[index]))
        / median(tIndices.map((index) => corrected.openBeam[index]))
      : Number.NaN);
    reflectanceValid.push(Boolean(rIndices.length));
    transmittanceValid.push(Boolean(tIndices.length));
  }
  return {
    wavelengthNm,
    reflectance,
    transmittance,
    reflectanceValid,
    transmittanceValid,
    rawValidPoints: validIndices.length,
    rawValidReflectance: reflectanceMask.filter(Boolean).length,
    rawValidTransmittance: transmittanceMask.filter(Boolean).length,
    background: { subtracted: subtractBackground, aggregationOrder: "median_counts_before_normalization", ...background },
  };
}

export function restrictToNkRange(data, nk) {
  const keep = data.wavelengthNm.map((value) => value >= nk.wavelengthNm[0] && value <= nk.wavelengthNm.at(-1));
  const filtered = {};
  for (const [key, values] of Object.entries(data)) {
    filtered[key] = Array.isArray(values) && values.length === keep.length ? values.filter((_, index) => keep[index]) : values;
  }
  if (filtered.wavelengthNm.length < 10) throw new Error("Fewer than 10 bins overlap the n,k table.");
  return filtered;
}

export function evaluateOpticalModel(data, nk, parameters, settings) {
  validateModelInputs(parameters, settings);
  if (settings.layers?.length) return evaluateMultilayerModel(data, parameters, settings);
  const index = refractiveIndexModel(settings.model, data.wavelengthNm, parameters, nk);
  const optical = filmOnThickSubstrate(
    data.wavelengthNm,
    index.n,
    index.k,
    parameters.thicknessNm,
    settings.substrateIndex,
    settings.incidence,
  );
  return {
    ...optical,
    reflectanceScaled: optical.reflectance.map((value) => value * parameters.rGain),
    transmittanceScaled: optical.transmittance.map((value) => value * parameters.tGain),
    n: index.n,
    k: index.k,
  };
}

export const evaluateTabulated = evaluateOpticalModel;

function evaluateMultilayerModel(data, parameters, settings) {
  const layerIndices = settings.layers.map((layer) => {
    const layerParameters = parametersForLayer(parameters, layer.id);
    const index = refractiveIndexModel(layer.model, data.wavelengthNm, layerParameters, layer.nk ?? null, { components: layer.components });
    return { id: layer.id, name: layer.name, model: layer.model, thicknessNm: layerParameters.thicknessNm, n: index.n, k: index.k };
  });
  const optical = filmStackOnThickSubstrate(data.wavelengthNm, layerIndices, settings.substrateIndex, settings.incidence);
  const active = layerIndices.find((layer) => layer.id === settings.activeLayerId) ?? layerIndices[0];
  return {
    ...optical,
    reflectanceScaled: optical.reflectance.map((value) => value * parameters.rGain),
    transmittanceScaled: optical.transmittance.map((value) => value * parameters.tGain),
    n: active.n,
    k: active.k,
    activeLayerId: active.id,
    layerIndices,
  };
}

function parametersForLayer(parameters, layerId) {
  const prefix = `${layerId}__`;
  return Object.fromEntries(Object.entries(parameters).filter(([name]) => name.startsWith(prefix)).map(([name, value]) => [name.slice(prefix.length), value]));
}

function validateModelInputs(parameters, settings) {
  if (Object.values(parameters).some((value) => !Number.isFinite(value))) throw new Error("Optical parameters must be finite.");
  if (!(parameters.rGain > 0) || !(parameters.tGain > 0)) throw new Error("Channel gains must be positive.");
  if (settings.layers?.length) {
    if (settings.layers.length > 12) throw new Error("The coherent stack is limited to 12 layers.");
    for (const layer of settings.layers) {
      if (!(parameters[`${layer.id}__thicknessNm`] > 0)) throw new Error(`Layer ${layer.name} must have a positive thickness.`);
    }
  } else if (!(parameters.thicknessNm > 0)) throw new Error("Film thickness must be positive.");
  if (settings.substrateIndex <= 1) throw new Error("The substrate refractive index must be greater than 1.");
  if (!new Set(["film", "substrate"]).has(settings.incidence)) throw new Error("Unsupported incidence geometry.");
}

export function filmOnThickSubstrate(wavelengthNm, n, k, thicknessNm, substrateIndex, incidence = "film") {
  if (!(thicknessNm > 0) || !(substrateIndex > 1) || wavelengthNm.length !== n.length || n.length !== k.length) {
    throw new Error("Invalid TMM grid or parameters.");
  }
  const rearReflectance = ((substrateIndex - 1) / (substrateIndex + 1)) ** 2;
  const rearTransmittance = 1 - rearReflectance;
  const reflectance = [];
  const transmittance = [];
  for (let index = 0; index < wavelengthNm.length; index += 1) {
    if (incidence === "film") {
      const forward = coherentSingleFilm(wavelengthNm[index], n[index], k[index], thicknessNm, 1, substrateIndex);
      const reverse = coherentSingleFilm(wavelengthNm[index], n[index], k[index], thicknessNm, substrateIndex, 1);
      const denominator = 1 - rearReflectance * reverse.reflectance;
      reflectance.push(forward.reflectance + forward.transmittance * reverse.transmittance * rearReflectance / denominator);
      transmittance.push(forward.transmittance * rearTransmittance / denominator);
    } else {
      const stack = coherentSingleFilm(wavelengthNm[index], n[index], k[index], thicknessNm, substrateIndex, 1);
      const denominator = 1 - rearReflectance * stack.reflectance;
      reflectance.push(rearReflectance + rearTransmittance ** 2 * stack.reflectance / denominator);
      transmittance.push(rearTransmittance * stack.transmittance / denominator);
    }
  }
  return { reflectance, transmittance };
}

export function filmStackOnThickSubstrate(wavelengthNm, layers, substrateIndex, incidence = "film") {
  if (!Array.isArray(layers) || !layers.length || layers.length > 12 || !(substrateIndex > 1) || !new Set(["film", "substrate"]).has(incidence)) {
    throw new Error("Invalid multilayer TMM stack or substrate.");
  }
  for (const layer of layers) {
    if (!(layer.thicknessNm > 0) || layer.n.length !== wavelengthNm.length || layer.k.length !== wavelengthNm.length) throw new Error("Every layer must define positive thickness and n,k on the calculation grid.");
  }
  const rearReflectance = ((substrateIndex - 1) / (substrateIndex + 1)) ** 2;
  const rearTransmittance = 1 - rearReflectance;
  const reflectance = [];
  const transmittance = [];
  for (let index = 0; index < wavelengthNm.length; index += 1) {
    const slice = layers.map((layer) => ({ n: layer.n[index], k: layer.k[index], thicknessNm: layer.thicknessNm }));
    if (incidence === "film") {
      const forward = coherentFilmStack(wavelengthNm[index], slice, 1, substrateIndex);
      const reverse = coherentFilmStack(wavelengthNm[index], [...slice].reverse(), substrateIndex, 1);
      const denominator = 1 - rearReflectance * reverse.reflectance;
      reflectance.push(forward.reflectance + forward.transmittance * reverse.transmittance * rearReflectance / denominator);
      transmittance.push(forward.transmittance * rearTransmittance / denominator);
    } else {
      const stack = coherentFilmStack(wavelengthNm[index], [...slice].reverse(), substrateIndex, 1);
      const denominator = 1 - rearReflectance * stack.reflectance;
      reflectance.push(rearReflectance + rearTransmittance ** 2 * stack.reflectance / denominator);
      transmittance.push(rearTransmittance * stack.transmittance / denominator);
    }
  }
  return { reflectance, transmittance };
}

export function calibrateSharedGains(records, settings) {
  if (!Array.isArray(records) || !records.length) throw new Error("Shared calibration requires sample records with n,k tables.");
  if (!(settings.substrateIndex > 1) || !new Set(["film", "substrate"]).has(settings.incidence) || !(settings.sigmaReflectance > 0) || !(settings.sigmaTransmittance > 0)) throw new Error("Shared calibration settings are invalid.");
  const usable = records.map((record) => ({
    ...record,
    useReflectance: record.data.reflectanceValid.filter(Boolean).length >= 0.5 * record.data.wavelengthNm.length,
    useTransmittance: record.data.transmittanceValid.filter(Boolean).length >= 0.5 * record.data.wavelengthNm.length,
  })).filter((record) => record.useReflectance || record.useTransmittance);
  if (!usable.some((record) => record.useReflectance) || !usable.some((record) => record.useTransmittance)) {
    throw new Error("Shared calibration requires informative R and T channels across the selected samples.");
  }
  const lower = [0.1, 0.1, ...usable.map((record) => 0.5 * record.nominalThicknessNm)];
  const upper = [10, 10, ...usable.map((record) => 1.5 * record.nominalThicknessNm)];
  const initial = [1, 1, ...usable.map((record) => record.nominalThicknessNm)];
  const normalizedInitial = initial.map((value, index) => (value - lower[index]) / (upper[index] - lower[index]));
  const physical = (point) => point.map((value, index) => lower[index] + value * (upper[index] - lower[index]));
  const residualFunction = (point) => {
    const values = physical(point);
    return usable.flatMap((record, index) => {
      const evaluation = evaluateOpticalModel(record.data, record.nk, {
        thicknessNm: values[index + 2], rGain: values[0], tGain: values[1],
      }, { ...settings, model: "fixed" });
      const residuals = [];
      if (record.useReflectance) record.data.reflectance.forEach((value, bin) => {
        if (record.data.reflectanceValid[bin]) residuals.push((evaluation.reflectanceScaled[bin] - value) / settings.sigmaReflectance);
      });
      if (record.useTransmittance) record.data.transmittance.forEach((value, bin) => {
        if (record.data.transmittanceValid[bin]) residuals.push((evaluation.transmittanceScaled[bin] - value) / settings.sigmaTransmittance);
      });
      return residuals;
    });
  };
  const gainSeed = [[0, 0], [0, 0]];
  usable.forEach((record) => {
    const evaluation = evaluateOpticalModel(record.data, record.nk, { thicknessNm: record.nominalThicknessNm, rGain: 1, tGain: 1 }, { ...settings, model: "fixed" });
    for (const [channel, enabled, valid, measured, modeled] of [
      [0, record.useReflectance, record.data.reflectanceValid, record.data.reflectance, evaluation.reflectance],
      [1, record.useTransmittance, record.data.transmittanceValid, record.data.transmittance, evaluation.transmittance],
    ]) if (enabled) measured.forEach((value, index) => {
      if (valid[index]) { gainSeed[channel][0] += modeled[index] * value; gainSeed[channel][1] += modeled[index] ** 2; }
    });
  });
  const informedStart = normalizedInitial.map((value, index) => {
    if (index < 2) return (Math.max(lower[index], Math.min(upper[index], gainSeed[index][0] / gainSeed[index][1])) - lower[index]) / (upper[index] - lower[index]);
    return !usable[index - 2].useTransmittance ? 0 : value;
  });
  const starts = [normalizedInitial, informedStart];
  const normalizedSolution = starts.map((start) => boundedTrustRegionReflective(start, residualFunction, { returnDetails: true }))
    .map((solver) => ({ point: solver.point, solver, cost: softL1Cost(residualFunction(solver.point)) }))
    .sort((a, b) => a.cost - b.cost)[0];
  const solution = physical(normalizedSolution.point);
  const names = ["rGain", "tGain", ...usable.map((record) => `${record.sampleId}.thicknessNm`)];
  const parametersAtBounds = names.filter((name, index) => Math.abs(solution[index] - lower[index]) <= 1e-5 * Math.max(1, Math.abs(lower[index]))
    || Math.abs(solution[index] - upper[index]) <= 1e-5 * Math.max(1, Math.abs(upper[index])));
  return {
    gains: { rGain: solution[0], tGain: solution[1] },
    fittedThicknessNm: Object.fromEntries(usable.map((record, index) => [record.sampleId, solution[index + 2]])),
    includedChannels: Object.fromEntries(usable.map((record) => [record.sampleId, { R: record.useReflectance, T: record.useTransmittance }])),
    gainsOutsideOperationalRange: ["rGain", "tGain"].filter((name, index) => solution[index] < 0.8 || solution[index] > 1.2),
    parametersAtBounds,
    robustCost: normalizedSolution.cost,
    optimizer: {
      method: "bounded trust-region reflective least squares with soft-L1 loss",
      success: normalizedSolution.solver.success,
      message: normalizedSolution.solver.message,
      evaluations: normalizedSolution.solver.evaluations,
      optimality: normalizedSolution.solver.optimality,
    },
  };
}

function coherentSingleFilm(wavelengthNm, n, k, thicknessNm, incidentIndex, exitIndex) {
  if (!(wavelengthNm > 0) || !(n > 0) || k < 0) throw new Error("Non-physical wavelength or complex refractive index.");
  const film = { re: n, im: k };
  const phase = complexScale(film, 2 * Math.PI * thicknessNm / wavelengthNm);
  const propagation = complexExpI(complexScale(phase, 2));
  const r01 = complexDiv(complexSub({ re: incidentIndex, im: 0 }, film), complexAdd({ re: incidentIndex, im: 0 }, film));
  const r12 = complexDiv(complexSub(film, { re: exitIndex, im: 0 }), complexAdd(film, { re: exitIndex, im: 0 }));
  const denominator = complexAdd({ re: 1, im: 0 }, complexMul(complexMul(r01, r12), propagation));
  const reflectionAmplitude = complexDiv(complexAdd(r01, complexMul(r12, propagation)), denominator);
  const numerator = complexScale(complexMul(film, complexExpI(phase)), 4 * incidentIndex);
  const transmissionDenominator = complexMul(
    complexMul(complexAdd({ re: incidentIndex, im: 0 }, film), complexAdd(film, { re: exitIndex, im: 0 })),
    denominator,
  );
  const transmissionAmplitude = complexDiv(numerator, transmissionDenominator);
  return {
    reflectance: complexAbs2(reflectionAmplitude),
    transmittance: (exitIndex / incidentIndex) * complexAbs2(transmissionAmplitude),
  };
}

function coherentFilmStack(wavelengthNm, layers, incidentIndex, exitIndex) {
  if (!(wavelengthNm > 0) || !(incidentIndex > 0) || !(exitIndex > 0)) throw new Error("Non-physical multilayer boundary conditions.");
  for (const layer of layers) {
    if (!(layer.n > 0) || layer.k < 0 || !(layer.thicknessNm > 0)) throw new Error("Non-physical multilayer optical constants.");
  }
  const media = [{ re: incidentIndex, im: 0 }, ...layers.map((layer) => ({ re: layer.n, im: layer.k })), { re: exitIndex, im: 0 }];
  const last = media.length - 2;
  let reflectionAmplitude = fresnelReflection(media[last], media[last + 1]);
  let transmissionAmplitude = fresnelTransmission(media[last], media[last + 1]);
  for (let interfaceIndex = last - 1; interfaceIndex >= 0; interfaceIndex -= 1) {
    const propagation = complexExpI(complexScale(media[interfaceIndex + 1], 2 * Math.PI * layers[interfaceIndex].thicknessNm / wavelengthNm));
    const roundTrip = complexMul(propagation, propagation);
    const reflection = fresnelReflection(media[interfaceIndex], media[interfaceIndex + 1]);
    const denominator = complexAdd({ re: 1, im: 0 }, complexMul(complexMul(reflection, reflectionAmplitude), roundTrip));
    transmissionAmplitude = complexDiv(complexMul(complexMul(fresnelTransmission(media[interfaceIndex], media[interfaceIndex + 1]), transmissionAmplitude), propagation), denominator);
    reflectionAmplitude = complexDiv(complexAdd(reflection, complexMul(reflectionAmplitude, roundTrip)), denominator);
  }
  return {
    reflectance: complexAbs2(reflectionAmplitude),
    transmittance: (exitIndex / incidentIndex) * complexAbs2(transmissionAmplitude),
  };
}

function fresnelReflection(left, right) { return complexDiv(complexSub(left, right), complexAdd(left, right)); }
function fresnelTransmission(left, right) { return complexDiv(complexScale(left, 2), complexAdd(left, right)); }

function complexAdd(a, b) { return { re: a.re + b.re, im: a.im + b.im }; }
function complexSub(a, b) { return { re: a.re - b.re, im: a.im - b.im }; }
function complexMul(a, b) { return { re: a.re * b.re - a.im * b.im, im: a.re * b.im + a.im * b.re }; }
function complexScale(a, value) { return { re: a.re * value, im: a.im * value }; }
function complexDiv(a, b) {
  const denominator = b.re ** 2 + b.im ** 2;
  return { re: (a.re * b.re + a.im * b.im) / denominator, im: (a.im * b.re - a.re * b.im) / denominator };
}
function complexExpI(value) {
  const magnitude = Math.exp(-value.im);
  return { re: magnitude * Math.cos(value.re), im: magnitude * Math.sin(value.re) };
}
function complexAbs2(value) { return value.re ** 2 + value.im ** 2; }

export function fitEllipsometrySeed(nk, model, specifications) {
  if (!CAUSAL_ELLIPSOMETRY_MODELS.has(model)) throw new Error("Dynamic ellipsometry seeding is available only for causal dielectric models.");
  const selected = nk.wavelengthNm.map((value) => value >= 300 && value <= 1100);
  let wavelengthNm = nk.wavelengthNm.filter((_, index) => selected[index]);
  let targetN = nk.n.filter((_, index) => selected[index]);
  let targetK = nk.k.filter((_, index) => selected[index]);
  if (wavelengthNm.length < 20) throw new Error("Dynamic seeding needs at least 20 n,k points from 300 to 1100 nm.");
  if (new Set(["tl1", "tl2"]).has(model)) {
    const stride = Math.max(1, Math.ceil(wavelengthNm.length / 250));
    wavelengthNm = wavelengthNm.filter((_, index) => index % stride === 0);
    targetN = targetN.filter((_, index) => index % stride === 0);
    targetK = targetK.filter((_, index) => index % stride === 0);
  }
  const names = Object.keys(specifications).filter((name) => !new Set(["thicknessNm", "rGain", "tGain"]).has(name));
  const lower = names.map((name) => specifications[name].minimum);
  const upper = names.map((name) => specifications[name].maximum);
  const start = names.map((name, index) => (specifications[name].value - lower[index]) / (upper[index] - lower[index]));
  const targetEpsilon1 = targetN.map((value, index) => value ** 2 - targetK[index] ** 2);
  const targetEpsilon2 = targetN.map((value, index) => 2 * value * targetK[index]);
  const populationDeviation = (values) => {
    const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
    return Math.sqrt(values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / values.length);
  };
  const realScale = Math.max(populationDeviation(targetEpsilon1), 1);
  const imaginaryScale = Math.max(populationDeviation(targetEpsilon2), 1);
  const toParameters = (point) => Object.fromEntries(names.map((name, index) => [name, lower[index] + point[index] * (upper[index] - lower[index])]));
  const residualFunction = (point) => {
    const modeled = refractiveIndexModel(model, wavelengthNm, toParameters(point), nk);
    const epsilon1 = modeled.n.map((value, index) => value ** 2 - modeled.k[index] ** 2);
    const epsilon2 = modeled.n.map((value, index) => 2 * value * modeled.k[index]);
    return [
      ...epsilon1.map((value, index) => (value - targetEpsilon1[index]) / realScale),
      ...epsilon2.map((value, index) => (value - targetEpsilon2[index]) / imaginaryScale),
    ];
  };
  const maximumEvaluations = ({ tl1: 1500, tl2: 2500, "tl-gaussian": 3000, cody: 1800 })[model];
  const solver = boundedTrustRegionReflective(start, residualFunction, { returnDetails: true, maximumEvaluations });
  const parameters = toParameters(solver.point);
  const fullWavelength = nk.wavelengthNm.filter((value) => value >= 300 && value <= 1100);
  const referenceN = nk.n.filter((_, index) => selected[index]);
  const referenceK = nk.k.filter((_, index) => selected[index]);
  const modeled = refractiveIndexModel(model, fullWavelength, parameters, nk);
  const diagnostics = indexDiagnostics(
    fullWavelength,
    modeled.n.map((value, index) => value - referenceN[index]),
    modeled.k.map((value, index) => value - referenceK[index]),
  );
  diagnostics.parametersAtBounds = names.filter((name, index) => solver.point[index] <= 1e-5 || solver.point[index] >= 1 - 1e-5);
  diagnostics.solver = { success: solver.success, message: solver.message, evaluations: solver.evaluations, optimality: solver.optimality };
  diagnostics.wavelengthRangeNm = [300, 1100];
  return { parameters, diagnostics };
}

export function fitOpticalModel(data, nk, configuration, progress = () => {}) {
  const { settings, initial, bounds } = configuration;
  const screeningPoints = configuration.screeningPoints ?? 512;
  const localRefinements = configuration.localRefinements ?? 16;
  if (!Number.isInteger(screeningPoints) || screeningPoints < 64 || screeningPoints > 4096 || (screeningPoints & (screeningPoints - 1))) {
    throw new Error("Sobol screening points must be a power of two from 64 to 4096.");
  }
  if (!Number.isInteger(localRefinements) || localRefinements < 1 || localRefinements > 50) {
    throw new Error("Local refinements must be an integer from 1 to 50.");
  }
  const requestedParameters = configuration.fittedParameters
    ?? (settings.model === "scaled" ? ["thicknessNm", "nScale", "kScale", "rGain", "tGain"] : ["thicknessNm", "rGain", "tGain"]);
  const fittedParameters = requestedParameters.filter((name) => (
    !(name === "rGain" && !settings.useReflectance) && !(name === "tGain" && !settings.useTransmittance)
  ));
  if (!fittedParameters.length) throw new Error("Select at least one parameter to fit.");
  const names = fittedParameters;
  const lower = names.map((name) => bounds[name][0]);
  const upper = names.map((name) => bounds[name][1]);
  const toPhysical = (point) => Object.fromEntries(names.map((name, index) => [
    name,
    isLogParameter(name)
      ? Math.exp(Math.log(lower[index]) + point[index] * (Math.log(upper[index]) - Math.log(lower[index])))
      : lower[index] + point[index] * (upper[index] - lower[index]),
  ]));
  const objective = (point) => {
    const variable = toPhysical(point);
    const parameters = { ...initial, ...variable };
    const evaluated = evaluateOpticalModel(data, nk, parameters, settings);
    const residuals = fitResidualVector(data, nk, parameters, evaluated, settings);
    return { cost: softL1Cost(residuals), residuals, parameters, evaluated };
  };

  const initialPoint = names.map((name, index) => isLogParameter(name)
    ? (Math.log(initial[name]) - Math.log(lower[index])) / (Math.log(upper[index]) - Math.log(lower[index]))
    : (initial[name] - lower[index]) / (upper[index] - lower[index]));
  const sampledCandidates = scrambledSobolPoints(names.length, screeningPoints).map((point, index) => {
    let candidate;
    try { candidate = { point, sobolIndex: index, ...objective(point) }; }
    catch { candidate = { point, sobolIndex: index, cost: Number.POSITIVE_INFINITY }; }
    if (index % Math.max(1, Math.floor(screeningPoints / 12)) === 0) progress(Math.round(index / screeningPoints * 45));
    return candidate;
  });
  const finiteCandidates = sampledCandidates.filter((candidate) => Number.isFinite(candidate.cost));
  if (localRefinements > 1 && !finiteCandidates.length) throw new Error("No finite Sobol screening point was found inside the parameter bounds.");
  const starts = selectDiverseStarts(initialPoint, finiteCandidates, localRefinements);
  let best = { point: initialPoint, ...objective(initialPoint) };
  const refinementCount = starts.length;
  const refinedCandidates = [];
  const failedStarts = [];
  for (let index = 0; index < refinementCount; index += 1) {
    try {
      const solver = boundedTrustRegionReflective(starts[index].point, (point) => objective(point).residuals, { returnDetails: true });
      const refined = { localStart: index + 1, point: solver.point, solver, ...objective(solver.point) };
      refinedCandidates.push(refined);
      if (refined.cost < best.cost) best = refined;
    } catch (error) {
      failedStarts.push({ localStart: index + 1, message: error instanceof Error ? error.message : String(error) });
    }
    progress(50 + Math.round((index + 1) / refinementCount * 50));
  }
  if (!refinedCandidates.some((candidate) => distance(candidate.point, best.point) < 1e-12)) refinedCandidates.push({ localStart: 0, ...best });
  const finiteScreeningCosts = finiteCandidates.map((candidate) => candidate.cost).sort((a, b) => a - b);
  const optimizer = {
    method: "SciPy-compatible scrambled Sobol screening followed by bounded trust-region reflective least squares",
    seed: 1729,
    screeningPoints,
    finiteScreeningPoints: finiteCandidates.length,
    localRefinementsRequested: localRefinements,
    localRefinementsCompleted: refinedCandidates.filter((candidate) => candidate.localStart > 0).length,
    selectedStart: best.localStart ?? 0,
    selectedSobolIndices: starts.slice(1).map((start) => start.sobolIndex),
    selectedSobolCosts: starts.slice(1).map((start) => start.cost),
    screeningCostSummary: finiteScreeningCosts.length ? {
      minimum: finiteScreeningCosts[0],
      median: median(finiteScreeningCosts),
      maximum: finiteScreeningCosts.at(-1),
    } : { minimum: null, median: null, maximum: null },
    logarithmicallySampledParameters: names.filter(isLogParameter),
    failedStarts,
    selectedSolver: best.solver ? {
      success: best.solver.success,
      message: best.solver.message,
      evaluations: best.solver.evaluations,
      optimality: best.solver.optimality,
    } : { success: true, message: "The visible initial point had the lowest evaluated cost.", evaluations: 0, optimality: null },
  };
  const diagnostics = diagnosticsOf(data, best.evaluated, settings, {
    nk,
    parameters: best.parameters,
    bounds,
    fittedParameters,
    refinedCandidates,
    bestCost: best.cost,
    bestPoint: best.point,
    optimizer,
  });
  return { parameters: best.parameters, evaluation: best.evaluated, cost: best.cost, diagnostics, optimizer, screeningPoints, localRefinements: refinementCount };
}

export const fitTabulated = fitOpticalModel;

function softL1Cost(residuals) { return residuals.reduce((sum, value) => sum + Math.sqrt(1 + value ** 2) - 1, 0); }

export function diagnosticsOf(data, evaluation, settings, fit = null) {
  const rmse = (modeled, measured, valid) => {
    const residuals = modeled.map((value, index) => valid[index] ? value - measured[index] : Number.NaN).filter(Number.isFinite);
    return residuals.length ? Math.sqrt(residuals.reduce((sum, value) => sum + value ** 2, 0) / residuals.length) : null;
  };
  const powerBalance = evaluation.reflectance.map((value, index) => value + evaluation.transmittance[index]);
  const result = {
    rmseReflectance: settings.useReflectance ? rmse(evaluation.reflectanceScaled, data.reflectance, data.reflectanceValid) : null,
    rmseTransmittance: settings.useTransmittance ? rmse(evaluation.transmittanceScaled, data.transmittance, data.transmittanceValid) : null,
    reflectanceBins: data.reflectanceValid.filter(Boolean).length,
    transmittanceBins: data.transmittanceValid.filter(Boolean).length,
    maximumPowerBalance: Math.max(...powerBalance),
    minimumAbsorption: Math.min(...powerBalance.map((value) => 1 - value)),
    normalizedJacobianCondition: null,
    parametersAtBounds: [],
    gainsOutsideOperationalRange: [],
    nearEqualAlternativeMinima: null,
    alternativeSolutions: [],
    parameterStandardErrorsApproximate: {},
    shapeAfterAffineAlignment: {},
    indexVsEllipsometry: {},
    regularizedTowardEllipsometry: settings.layers?.length
      ? settings.layers.some((layer) => layer.regularize && layer.nk && layer.model !== "fixed")
      : Boolean(settings.regularizeEllipsometry && settings.model !== "fixed"),
  };
  for (const [channel, enabled, measured, modeled, valid] of [
    ["R", settings.useReflectance, data.reflectance, evaluation.reflectanceScaled, data.reflectanceValid],
    ["T", settings.useTransmittance, data.transmittance, evaluation.transmittanceScaled, data.transmittanceValid],
  ]) {
    if (!enabled) continue;
    const measuredValid = measured.filter((_, index) => valid[index]);
    const modeledValid = modeled.filter((_, index) => valid[index]);
    const shape = affineShapeResidual(modeledValid, measuredValid);
    result.shapeAfterAffineAlignment[channel] = {
      rmse: Math.sqrt(shape.residuals.reduce((sum, value) => sum + value ** 2, 0) / shape.residuals.length),
      gain: shape.gain,
      offset: shape.offset,
    };
  }
  if (!fit) return result;

  result.parametersAtBounds = fit.fittedParameters.filter((name) => {
    const [lower, upper] = fit.bounds[name];
    const value = fit.parameters[name];
    return Math.abs(value - lower) <= 1e-5 * Math.max(1, Math.abs(lower))
      || Math.abs(value - upper) <= 1e-5 * Math.max(1, Math.abs(upper));
  });
  result.gainsOutsideOperationalRange = ["rGain", "tGain"].filter((name) => (
    fit.fittedParameters.includes(name) && (fit.parameters[name] < 0.8 || fit.parameters[name] > 1.2)
  ));
  result.alternativeSolutions = rankAlternativeMinima(data, settings, fit);
  result.nearEqualAlternativeMinima = Math.max(0, result.alternativeSolutions.filter((solution) => solution.relativeCostIncrease <= 0.05).length - 1);
  const comparison = indexComparison(fit.nk, fit.parameters, settings);
  result.indexVsEllipsometry = comparison?.diagnostics ?? {};
  const sensitivity = localSensitivity(data, fit.nk, fit.parameters, settings, fit.bounds, fit.fittedParameters);
  result.normalizedJacobianCondition = sensitivity.condition;
  result.parameterStandardErrorsApproximate = sensitivity.standardErrors;
  result.optimizer = fit.optimizer;
  return result;
}

export function affineShapeResidual(modeled, measured) {
  if (modeled.length !== measured.length || !modeled.length || !modeled.every(Number.isFinite) || !measured.every(Number.isFinite)) throw new Error("Shape comparison requires matching finite spectra.");
  const mean = (values) => values.reduce((sum, value) => sum + value, 0) / values.length;
  const modeledMean = mean(modeled);
  const measuredMean = mean(measured);
  const centered = modeled.map((value) => value - modeledMean);
  const denominator = centered.reduce((sum, value) => sum + value ** 2, 0);
  const gain = denominator > Number.EPSILON
    ? Math.max(0, centered.reduce((sum, value, index) => sum + value * (measured[index] - measuredMean), 0) / denominator)
    : 0;
  const offset = measuredMean - gain * modeledMean;
  return { residuals: modeled.map((value, index) => gain * value + offset - measured[index]), gain, offset };
}

export function fitResidualVector(data, nk, parameters, evaluation, settings) {
  const residuals = [];
  for (const [enabled, measured, modeled, valid, sigma] of [
    [settings.useReflectance, data.reflectance, evaluation.reflectanceScaled, data.reflectanceValid, settings.sigmaReflectance],
    [settings.useTransmittance, data.transmittance, evaluation.transmittanceScaled, data.transmittanceValid, settings.sigmaTransmittance],
  ]) {
    if (!enabled) continue;
    const measuredValid = measured.filter((_, index) => valid[index]);
    const modeledValid = modeled.filter((_, index) => valid[index]);
    residuals.push(...modeledValid.map((value, index) => (value - measuredValid[index]) / sigma));
    if (settings.preferSpectralShape) residuals.push(...affineShapeResidual(modeledValid, measuredValid).residuals.map((value) => value / sigma));
  }
  if (settings.layers?.length) {
    for (const layer of settings.layers.filter((candidate) => candidate.regularize)) {
      if (layer.model === "drude-tl") throw new Error(`Layer ${layer.name}: a Drude model cannot be regularized toward an insulating n,k table.`);
      const comparison = indexComparisonForModel(layer.nk, parametersForLayer(parameters, layer.id), layer.model, layer.components);
      if (!comparison) throw new Error(`Layer ${layer.name}: regularization requires an n,k table with at least 10 points from 300 to 1100 nm.`);
      residuals.push(...comparison.deltaN.map((value) => value / settings.sigmaN));
      residuals.push(...comparison.deltaK.map((value) => value / settings.sigmaK));
    }
  } else if (settings.regularizeEllipsometry && settings.model !== "fixed") {
    if (settings.model === "drude-tl") throw new Error("The metallic VO₂ model cannot be regularized toward the 22 °C insulating n,k table.");
    const comparison = indexComparison(nk, parameters, settings);
    if (!comparison) throw new Error("Ellipsometry regularization requires a matching n,k table from 300 to 1100 nm.");
    residuals.push(...comparison.deltaN.map((value) => value / settings.sigmaN));
    residuals.push(...comparison.deltaK.map((value) => value / settings.sigmaK));
  }
  return residuals;
}

function indexComparison(nk, parameters, settings) {
  if (settings.layers?.length) {
    const layer = settings.layers.find((candidate) => candidate.id === settings.activeLayerId && candidate.nk)
      ?? settings.layers.find((candidate) => candidate.nk);
    return layer ? indexComparisonForModel(layer.nk, parametersForLayer(parameters, layer.id), layer.model, layer.components) : null;
  }
  return indexComparisonForModel(nk, parameters, settings.model);
}

function indexComparisonForModel(nk, parameters, model, components = undefined) {
  if (!nk) return null;
  const selected = nk.wavelengthNm.map((value) => value >= 300 && value <= 1100);
  const wavelengthNm = nk.wavelengthNm.filter((_, index) => selected[index]);
  if (wavelengthNm.length < 10) return null;
  const reference = { n: nk.n.filter((_, index) => selected[index]), k: nk.k.filter((_, index) => selected[index]) };
  const modeled = refractiveIndexModel(model, wavelengthNm, parameters, nk, { components });
  const deltaN = modeled.n.map((value, index) => value - reference.n[index]);
  const deltaK = modeled.k.map((value, index) => value - reference.k[index]);
  return { wavelengthNm, reference, modeled, deltaN, deltaK, diagnostics: indexDiagnostics(wavelengthNm, deltaN, deltaK) };
}

function indexDiagnostics(wavelengthNm, deltaN, deltaK) {
  const rmse = (values) => Math.sqrt(values.reduce((sum, value) => sum + value ** 2, 0) / values.length);
  const diagnostics = {
    overlapPoints: wavelengthNm.length,
    rmseDeltaN: rmse(deltaN),
    rmseDeltaK: rmse(deltaK),
    weightedRmseDeltaN: rmse(deltaN),
    weightedRmseDeltaK: rmse(deltaK),
    maximumAbsoluteDeltaN: Math.max(...deltaN.map(Math.abs)),
    maximumAbsoluteDeltaK: Math.max(...deltaK.map(Math.abs)),
  };
  for (const [key, minimum, maximum] of [["Uv300To400Nm", 300, 400], ["Visible400To900Nm", 400, 900], ["Nir900To1100Nm", 900, 1100]]) {
    const selected = wavelengthNm.map((value) => value >= minimum && value <= maximum);
    const bandN = deltaN.filter((_, index) => selected[index]);
    const bandK = deltaK.filter((_, index) => selected[index]);
    if (bandN.length) {
      diagnostics[`rmseDeltaN${key}`] = rmse(bandN);
      diagnostics[`rmseDeltaK${key}`] = rmse(bandK);
    }
  }
  return diagnostics;
}

function localSensitivity(data, nk, parameters, settings, bounds, fittedParameters) {
  const residual = fitResidualVector(data, nk, parameters, evaluateOpticalModel(data, nk, parameters, settings), settings);
  const jacobian = residual.map(() => []);
  for (const name of fittedParameters) {
    const [lower, upper] = bounds[name];
    const step = Math.max((upper - lower) * 1e-5, Math.max(1, Math.abs(parameters[name])) * 1e-7);
    const below = Math.max(lower, parameters[name] - step);
    const above = Math.min(upper, parameters[name] + step);
    if (!(above > below)) continue;
    const lowParameters = { ...parameters, [name]: below };
    const highParameters = { ...parameters, [name]: above };
    const low = fitResidualVector(data, nk, lowParameters, evaluateOpticalModel(data, nk, lowParameters, settings), settings);
    const high = fitResidualVector(data, nk, highParameters, evaluateOpticalModel(data, nk, highParameters, settings), settings);
    residual.forEach((value, row) => {
      const softL1JacobianWeight = (1 + value ** 2) ** -0.75;
      jacobian[row].push((high[row] - low[row]) / (above - below) * softL1JacobianWeight);
    });
  }
  if (!jacobian.length || !jacobian[0]?.length) return { condition: null, standardErrors: {} };
  const columns = jacobian[0].length;
  const gram = Array.from({ length: columns }, (_, row) => Array.from({ length: columns }, (_, column) => (
    jacobian.reduce((sum, values) => sum + values[row] * values[column], 0)
  )));
  const norms = gram.map((row, index) => Math.sqrt(row[index]));
  let condition = Number.POSITIVE_INFINITY;
  if (norms.every((value) => value > Number.EPSILON)) {
    const correlation = gram.map((row, i) => row.map((value, j) => value / (norms[i] * norms[j])));
    const eigenvalues = symmetricEigenvalues(correlation).sort((a, b) => a - b);
    if (eigenvalues[0] > Number.EPSILON) condition = Math.sqrt(eigenvalues.at(-1) / eigenvalues[0]);
  }
  const inverse = invertMatrix(gram);
  const degreesOfFreedom = residual.length - columns;
  const variance = degreesOfFreedom > 0 ? residual.reduce((sum, value) => sum + value ** 2, 0) / degreesOfFreedom : Number.NaN;
  const standardErrors = Object.fromEntries(fittedParameters.map((name, index) => [
    name,
    inverse && Number.isFinite(variance) ? Math.sqrt(Math.max(0, inverse[index][index] * variance)) : null,
  ]));
  return { condition, standardErrors };
}

function rankAlternativeMinima(data, settings, fit) {
  const distinct = [];
  const selectedPoints = [];
  for (const candidate of [...fit.refinedCandidates].sort((a, b) => a.cost - b.cost)) {
    if (selectedPoints.some((point) => distance(candidate.point, point) / Math.sqrt(Math.max(1, candidate.point.length)) < 1e-3)) continue;
    const channelMetrics = {};
    for (const [channel, enabled, measured, modeled, valid] of [
      ["R", settings.useReflectance, data.reflectance, candidate.evaluated.reflectanceScaled, data.reflectanceValid],
      ["T", settings.useTransmittance, data.transmittance, candidate.evaluated.transmittanceScaled, data.transmittanceValid],
    ]) {
      if (!enabled) continue;
      const measuredValid = measured.filter((_, index) => valid[index]);
      const modeledValid = modeled.filter((_, index) => valid[index]);
      const raw = modeledValid.map((value, index) => value - measuredValid[index]);
      const shape = affineShapeResidual(modeledValid, measuredValid).residuals;
      const rmse = (values) => Math.sqrt(values.reduce((sum, value) => sum + value ** 2, 0) / values.length);
      channelMetrics[channel] = { rmse: rmse(raw), shapeRmse: rmse(shape) };
    }
    const comparison = indexComparison(fit.nk, candidate.parameters, settings);
    distinct.push({
      rank: distinct.length + 1,
      localStart: candidate.localStart,
      robustCost: candidate.cost,
      relativeCostIncrease: (candidate.cost - fit.bestCost) / Math.max(Math.abs(fit.bestCost), 1e-12),
      normalizedParameterDistanceFromBest: distance(candidate.point, fit.bestPoint) / Math.sqrt(Math.max(1, candidate.point.length)),
      parameters: candidate.parameters,
      channelMetrics,
      indexVsEllipsometry: comparison?.diagnostics ?? {},
      fittedParametersAtBounds: fit.fittedParameters.filter((name) => {
        const [lower, upper] = fit.bounds[name];
        return Math.abs(candidate.parameters[name] - lower) <= 1e-6 * Math.max(1, Math.abs(lower))
          || Math.abs(candidate.parameters[name] - upper) <= 1e-6 * Math.max(1, Math.abs(upper));
      }),
    });
    selectedPoints.push(candidate.point);
    if (distinct.length === 5) break;
  }
  return distinct;
}

function symmetricEigenvalues(matrix) {
  const values = matrix.map((row) => [...row]);
  for (let iteration = 0; iteration < 50 * values.length ** 2; iteration += 1) {
    let p = 0; let q = 1; let largest = 0;
    for (let row = 0; row < values.length; row += 1) for (let column = row + 1; column < values.length; column += 1) {
      if (Math.abs(values[row][column]) > largest) { largest = Math.abs(values[row][column]); p = row; q = column; }
    }
    if (largest < 1e-12) break;
    const angle = 0.5 * Math.atan2(2 * values[p][q], values[q][q] - values[p][p]);
    const cosine = Math.cos(angle); const sine = Math.sin(angle);
    for (let index = 0; index < values.length; index += 1) {
      if (index === p || index === q) continue;
      const ip = values[index][p]; const iq = values[index][q];
      values[index][p] = values[p][index] = cosine * ip - sine * iq;
      values[index][q] = values[q][index] = sine * ip + cosine * iq;
    }
    const pp = values[p][p]; const qq = values[q][q]; const pq = values[p][q];
    values[p][p] = cosine ** 2 * pp - 2 * sine * cosine * pq + sine ** 2 * qq;
    values[q][q] = sine ** 2 * pp + 2 * sine * cosine * pq + cosine ** 2 * qq;
    values[p][q] = values[q][p] = 0;
  }
  return values.map((row, index) => row[index]);
}

function invertMatrix(matrix) {
  const size = matrix.length;
  const rows = matrix.map((row, index) => [...row, ...Array.from({ length: size }, (_, column) => Number(index === column))]);
  for (let column = 0; column < size; column += 1) {
    let pivot = column;
    for (let row = column + 1; row < size; row += 1) if (Math.abs(rows[row][column]) > Math.abs(rows[pivot][column])) pivot = row;
    if (Math.abs(rows[pivot][column]) <= Number.EPSILON) return null;
    [rows[column], rows[pivot]] = [rows[pivot], rows[column]];
    const divisor = rows[column][column];
    rows[column] = rows[column].map((value) => value / divisor);
    for (let row = 0; row < size; row += 1) {
      if (row === column) continue;
      const factor = rows[row][column];
      rows[row] = rows[row].map((value, index) => value - factor * rows[column][index]);
    }
  }
  return rows.map((row) => row.slice(size));
}

function selectDiverseStarts(initialPoint, candidates, count) {
  const ranked = [...candidates].sort((a, b) => a.cost - b.cost);
  const selected = [{ point: initialPoint, sobolIndex: null, cost: null }];
  if (count === 1) return selected;
  const used = new Set();
  for (const candidate of ranked) {
    if (selected.every((chosen) => distance(candidate.point, chosen.point) / Math.sqrt(initialPoint.length) >= 0.05)) {
      selected.push(candidate); used.add(candidate);
    }
    if (selected.length === count) return selected;
  }
  for (const candidate of ranked) {
    if (!used.has(candidate)) selected.push(candidate);
    if (selected.length === count) break;
  }
  return selected;
}

function boundedTrustRegionReflective(start, residualFunction, options = {}) {
  const tolerance = 1e-8;
  const maximumEvaluations = options.maximumEvaluations ?? 3000;
  let evaluations = 0;
  let success = false;
  let message = "The maximum number of residual evaluations was reached.";
  const evaluate = (point) => {
    const residuals = residualFunction(point);
    evaluations += 1;
    if (!residuals.length || !residuals.every(Number.isFinite)) throw new Error("The optimizer produced non-finite residuals.");
    return residuals;
  };
  let point = makeStrictlyFeasible(start);
  let trueResiduals = evaluate(point);
  let jacobian = finiteDifferenceJacobian(point, trueResiduals, evaluate);
  let scaled = scaleSoftL1(jacobian, trueResiduals);
  let gradient = jacobianGradient(scaled.jacobian, scaled.residuals);
  let scaleInverse = jacobianColumnNorms(scaled.jacobian);
  let scale = scaleInverse.map((value) => 1 / value);
  let { v, derivative } = colemanLiScaling(point, gradient);
  const scaledV = v.map((value, index) => derivative[index] === 0 ? value : value * scaleInverse[index]);
  let trustRadius = vectorNorm(point.map((value, index) => value * scaleInverse[index] / Math.sqrt(scaledV[index])));
  if (!(trustRadius > 0)) trustRadius = 1;
  let cost = softL1Cost(trueResiduals);

  while (evaluations < maximumEvaluations) {
    ({ v, derivative } = colemanLiScaling(point, gradient));
    const optimality = Math.max(...gradient.map((value, index) => Math.abs(value * v[index])));
    if (optimality < tolerance) {
      success = true;
      message = "The first-order optimality tolerance was satisfied.";
      break;
    }
    const transformedV = v.map((value, index) => derivative[index] === 0 ? value : value * scaleInverse[index]);
    const transform = transformedV.map((value, index) => Math.sqrt(value) * scale[index]);
    const diagonal = gradient.map((value, index) => Math.max(0, value * derivative[index] * scale[index]));
    const transformedGradient = gradient.map((value, index) => value * transform[index]);
    const transformedJacobian = scaled.jacobian.map((row) => row.map((value, index) => value * transform[index]));
    const hessian = gramMatrix(transformedJacobian, diagonal);
    const theta = Math.max(0.995, 1 - optimality);
    let actualReduction = -1;
    let accepted = null;
    let terminate = false;

    while (actualReduction <= 0 && evaluations < maximumEvaluations) {
      const trustStep = solveTrustRegionSubproblem(hessian, transformedGradient, trustRadius);
      const physicalStep = trustStep.map((value, index) => value * transform[index]);
      const selected = selectReflectiveStep(point, hessian, transformedGradient, physicalStep, trustStep, transform, trustRadius, theta);
      const candidate = makeStrictlyFeasible(point.map((value, index) => value + selected.step[index]));
      const candidateResiduals = evaluate(candidate);
      const candidateCost = softL1Cost(candidateResiduals);
      actualReduction = cost - candidateCost;
      const transformedStepNorm = vectorNorm(selected.transformedStep);
      const ratio = selected.predictedReduction > 0 ? actualReduction / selected.predictedReduction : actualReduction === 0 ? 1 : 0;
      const nextRadius = ratio < 0.25 ? 0.25 * transformedStepNorm
        : ratio > 0.75 && transformedStepNorm > 0.95 * trustRadius ? 2 * trustRadius : trustRadius;
      const stepNorm = vectorNorm(selected.step);
      terminate = (actualReduction < tolerance * cost && ratio > 0.25)
        || stepNorm < tolerance * (tolerance + vectorNorm(point));
      trustRadius = nextRadius;
      if (actualReduction > 0) accepted = { point: candidate, residuals: candidateResiduals, cost: candidateCost };
      if (terminate || !(transformedStepNorm > 0) || !(trustRadius > 0)) break;
    }

    if (!accepted) {
      success = optimality < 10 * tolerance;
      message = success
        ? "No improving step was found after reaching near-optimal first-order conditions."
        : "No cost-reducing trust-region step was found.";
      break;
    }
    point = accepted.point;
    trueResiduals = accepted.residuals;
    cost = accepted.cost;
    jacobian = finiteDifferenceJacobian(point, trueResiduals, evaluate);
    scaled = scaleSoftL1(jacobian, trueResiduals);
    gradient = jacobianGradient(scaled.jacobian, scaled.residuals);
    const currentScaleInverse = jacobianColumnNorms(scaled.jacobian);
    scaleInverse = scaleInverse.map((value, index) => Math.max(value, currentScaleInverse[index]));
    scale = scaleInverse.map((value) => 1 / value);
    if (terminate) {
      success = true;
      message = "The cost or step-size tolerance was satisfied.";
      break;
    }
  }
  const finalScaling = colemanLiScaling(point, gradient).v;
  const optimality = Math.max(...gradient.map((value, index) => Math.abs(value * finalScaling[index])));
  const details = { point, success, message, evaluations, optimality, cost };
  return options.returnDetails ? details : point;
}

function finiteDifferenceJacobian(point, residuals, evaluate) {
  const jacobian = residuals.map(() => Array(point.length).fill(0));
  const relativeStep = Math.sqrt(Number.EPSILON);
  for (let axis = 0; axis < point.length; axis += 1) {
    let step = relativeStep * Math.max(1, Math.abs(point[axis]));
    if (point[axis] + step > 1) step = -step;
    const trial = point.map((value, index) => index === axis ? value + step : value);
    const shifted = evaluate(trial);
    residuals.forEach((value, row) => { jacobian[row][axis] = (shifted[row] - value) / step; });
  }
  return jacobian;
}

function scaleSoftL1(jacobian, residuals) {
  const weights = residuals.map((value) => (1 + value ** 2) ** -0.75);
  return {
    jacobian: jacobian.map((row, index) => row.map((value) => value * weights[index])),
    residuals: residuals.map((value) => value * (1 + value ** 2) ** 0.25),
  };
}

function jacobianGradient(jacobian, residuals) {
  return jacobian[0].map((_, column) => jacobian.reduce((sum, row, index) => sum + row[column] * residuals[index], 0));
}

function jacobianColumnNorms(jacobian) {
  return jacobian[0].map((_, column) => Math.sqrt(jacobian.reduce((sum, row) => sum + row[column] ** 2, 0)) || 1);
}

function colemanLiScaling(point, gradient) {
  const v = Array(point.length).fill(1);
  const derivative = Array(point.length).fill(0);
  gradient.forEach((value, index) => {
    if (value < 0) { v[index] = 1 - point[index]; derivative[index] = -1; }
    else if (value > 0) { v[index] = point[index]; derivative[index] = 1; }
  });
  return { v, derivative };
}

function gramMatrix(jacobian, diagonal = []) {
  const size = jacobian[0].length;
  return Array.from({ length: size }, (_, row) => Array.from({ length: size }, (_, column) => (
    jacobian.reduce((sum, values) => sum + values[row] * values[column], 0) + (row === column ? diagonal[row] ?? 0 : 0)
  )));
}

function solveTrustRegionSubproblem(hessian, gradient, radius) {
  const solve = (regularization) => {
    const matrix = hessian.map((row, index) => row.map((value, column) => value + (index === column ? regularization : 0)));
    return solveLinearSystem(matrix, gradient.map((value) => -value));
  };
  const gaussNewton = solve(0);
  if (gaussNewton && vectorNorm(gaussNewton) <= radius) return gaussNewton;
  let lower = 0;
  let upper = Math.max(1e-12, vectorNorm(gradient) / radius);
  let step = solve(upper);
  while ((!step || vectorNorm(step) > radius) && upper < 1e30) { lower = upper; upper *= 2; step = solve(upper); }
  for (let iteration = 0; iteration < 60; iteration += 1) {
    const regularization = 0.5 * (lower + upper);
    const candidate = solve(regularization);
    if (!candidate || vectorNorm(candidate) > radius) lower = regularization;
    else { upper = regularization; step = candidate; }
  }
  return step ?? gradient.map(() => 0);
}

function selectReflectiveStep(point, hessian, gradient, step, transformedStep, transform, radius, theta) {
  const quadratic = (value) => 0.5 * dot(value, matrixVector(hessian, value)) + dot(gradient, value);
  if (inUnitBounds(point.map((value, index) => value + step[index]))) {
    return { step, transformedStep, predictedReduction: -quadratic(transformedStep) };
  }
  const { stride: boundStride, hits } = stepSizeToBounds(point, step);
  const reflectedTransformed = transformedStep.map((value, index) => hits[index] ? -value : value);
  const reflected = reflectedTransformed.map((value, index) => value * transform[index]);
  const boundedStep = step.map((value) => value * boundStride);
  const boundedTransformed = transformedStep.map((value) => value * boundStride);
  const onBound = point.map((value, index) => value + boundedStep[index]);
  const trustStride = positiveTrustIntersection(boundedTransformed, reflectedTransformed, radius);
  const reflectedBoundStride = stepSizeToBounds(onBound, reflected).stride;
  const reflectedLimit = Math.min(reflectedBoundStride, trustStride);
  let reflectedValue = Number.POSITIVE_INFINITY;
  let reflectedCandidate = null;
  if (reflectedLimit > 0) {
    const lower = (1 - theta) * boundStride / reflectedLimit;
    const upper = reflectedLimit === reflectedBoundStride ? theta * reflectedBoundStride : trustStride;
    if (lower <= upper) {
      const stride = minimizeQuadraticAlong(hessian, gradient, boundedTransformed, reflectedTransformed, lower, upper);
      reflectedCandidate = boundedTransformed.map((value, index) => value + stride * reflectedTransformed[index]);
      reflectedValue = quadratic(reflectedCandidate);
    }
  }
  const interiorTransformed = boundedTransformed.map((value) => value * theta);
  const interiorValue = quadratic(interiorTransformed);
  const antiGradient = gradient.map((value) => -value);
  const antiGradientNorm = vectorNorm(antiGradient);
  let gradientCandidate = antiGradient.map(() => 0);
  let gradientValue = Number.POSITIVE_INFINITY;
  if (antiGradientNorm > 0) {
    const antiGradientStep = antiGradient.map((value, index) => value * transform[index]);
    const maximumStride = Math.min(radius / antiGradientNorm, theta * stepSizeToBounds(point, antiGradientStep).stride);
    const stride = minimizeQuadraticAlong(hessian, gradient, antiGradient.map(() => 0), antiGradient, 0, maximumStride);
    gradientCandidate = antiGradient.map((value) => value * stride);
    gradientValue = quadratic(gradientCandidate);
  }
  const candidates = [
    { transformedStep: interiorTransformed, value: interiorValue },
    { transformedStep: reflectedCandidate, value: reflectedValue },
    { transformedStep: gradientCandidate, value: gradientValue },
  ].filter((candidate) => candidate.transformedStep);
  const selected = candidates.sort((a, b) => a.value - b.value)[0];
  return {
    transformedStep: selected.transformedStep,
    step: selected.transformedStep.map((value, index) => value * transform[index]),
    predictedReduction: -selected.value,
  };
}

function stepSizeToBounds(point, step) {
  const strides = step.map((value, index) => value > 0 ? (1 - point[index]) / value : value < 0 ? -point[index] / value : Number.POSITIVE_INFINITY);
  const stride = Math.min(...strides);
  const tolerance = 1e-12 * Math.max(1, Math.abs(stride));
  return { stride, hits: strides.map((value) => Math.abs(value - stride) <= tolerance) };
}

function positiveTrustIntersection(point, direction, radius) {
  const a = dot(direction, direction);
  const b = dot(point, direction);
  const c = dot(point, point) - radius ** 2;
  return (-b + Math.sqrt(Math.max(0, b ** 2 - a * c))) / a;
}

function minimizeQuadraticAlong(hessian, gradient, origin, direction, lower, upper) {
  const hessianDirection = matrixVector(hessian, direction);
  const a = 0.5 * dot(direction, hessianDirection);
  const b = dot(direction, matrixVector(hessian, origin)) + dot(gradient, direction);
  const candidates = [lower, upper];
  if (a !== 0) {
    const stationary = -b / (2 * a);
    if (stationary > lower && stationary < upper) candidates.push(stationary);
  }
  return candidates.sort((left, right) => (a * left ** 2 + b * left) - (a * right ** 2 + b * right))[0];
}

function makeStrictlyFeasible(point) { return point.map((value) => Math.max(1e-10, Math.min(1 - 1e-10, value))); }
function inUnitBounds(point) { return point.every((value) => value >= 0 && value <= 1); }
function dot(left, right) { return left.reduce((sum, value, index) => sum + value * right[index], 0); }
function vectorNorm(vector) { return Math.sqrt(dot(vector, vector)); }
function matrixVector(matrix, vector) { return matrix.map((row) => dot(row, vector)); }

function solveLinearSystem(matrix, vector) {
  const size = vector.length;
  const rows = matrix.map((row, index) => [...row, vector[index]]);
  for (let column = 0; column < size; column += 1) {
    let pivot = column;
    for (let row = column + 1; row < size; row += 1) if (Math.abs(rows[row][column]) > Math.abs(rows[pivot][column])) pivot = row;
    if (Math.abs(rows[pivot][column]) <= Number.EPSILON) return null;
    [rows[column], rows[pivot]] = [rows[pivot], rows[column]];
    for (let row = column + 1; row < size; row += 1) {
      const factor = rows[row][column] / rows[column][column];
      for (let index = column; index <= size; index += 1) rows[row][index] -= factor * rows[column][index];
    }
  }
  const solution = Array(size).fill(0);
  for (let row = size - 1; row >= 0; row -= 1) {
    solution[row] = (rows[row][size] - rows[row].slice(row + 1, size).reduce((sum, value, index) => sum + value * solution[row + 1 + index], 0)) / rows[row][row];
  }
  return solution;
}

function distance(a, b) {
  return Math.sqrt(a.reduce((sum, value, index) => sum + (value - b[index]) ** 2, 0));
}

function interpolate(x, y, points, outside = null) {
  return points.map((point) => {
    if (point < x[0]) return outside === null ? y[0] : outside;
    if (point > x.at(-1)) return outside === null ? y.at(-1) : outside;
    let low = 0;
    let high = x.length - 1;
    while (high - low > 1) {
      const middle = (low + high) >> 1;
      if (x[middle] <= point) low = middle;
      else high = middle;
    }
    const span = x[high] - x[low];
    return span === 0 ? y[low] : y[low] + (y[high] - y[low]) * (point - x[low]) / span;
  });
}
