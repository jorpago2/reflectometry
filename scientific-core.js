const EPSILON = Number.EPSILON;

export function parseNumericTable(text, minimumColumns = 2) {
  const rows = String(text)
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("#") && !line.startsWith(";"))
    .map((line) => line.replaceAll(";", " ").split(/\s+/).map((field) => Number(field.replace(",", "."))))
    .filter((row) => row.length >= minimumColumns && row.every(Number.isFinite));
  if (!rows.length) throw new Error(`No se encontró una tabla numérica con ${minimumColumns} columnas.`);
  const width = Math.min(...rows.map((row) => row.length));
  return rows.map((row) => row.slice(0, width));
}

export function loadNkTable(text) {
  const rows = parseNumericTable(text, 3).map((row) => row.slice(0, 3));
  const factor = median(rows.map((row) => row[0])) < 10 ? 1000 : 1;
  rows.sort((a, b) => a[0] - b[0]);
  const wavelengthNm = rows.map((row) => row[0] * factor);
  if (wavelengthNm.some((value, index) => index && value <= wavelengthNm[index - 1])) {
    throw new Error("La tabla n,k contiene longitudes de onda repetidas o desordenadas.");
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
    throw new Error("La muestra y las referencias no comparten la misma malla espectral.");
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
    throw new Error("Se necesitan al menos 20 puntos finitos entre 195 y 250 nm para estimar el fondo.");
  }
  const level = median(values);
  let sigma = 1.4826 * median(values.map((value) => Math.abs(value - level)));
  if (sigma <= EPSILON) sigma = standardDeviation(values);
  if (sigma <= EPSILON) throw new Error("La estimación del ruido de fondo es cero.");
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
    throw new Error("El umbral de referencia debe estar entre 0 y 100 %.");
  }
  if (!(wavelengthMinNm < wavelengthMaxNm) || !(binWidthNm > 0) || sampleSnrMinimum < 0) {
    throw new Error("El intervalo espectral, el bin y el SNR deben ser válidos.");
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
  if (validIndices.length < 10) throw new Error("Quedan menos de 10 puntos calibrados válidos.");

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
  if (filtered.wavelengthNm.length < 10) throw new Error("Menos de 10 bins coinciden con la tabla n,k.");
  return filtered;
}

export function evaluateTabulated(data, nk, parameters, settings) {
  validateModelInputs(parameters, settings);
  const n = interpolate(nk.wavelengthNm, nk.n, data.wavelengthNm);
  const k = interpolate(nk.wavelengthNm, nk.k, data.wavelengthNm);
  const modelN = settings.model === "scaled" ? n.map((value) => value * parameters.nScale) : n;
  const modelK = settings.model === "scaled" ? k.map((value) => value * parameters.kScale) : k;
  const optical = filmOnThickSubstrate(
    data.wavelengthNm,
    modelN,
    modelK,
    parameters.thicknessNm,
    settings.substrateIndex,
    settings.incidence,
  );
  return {
    ...optical,
    reflectanceScaled: optical.reflectance.map((value) => value * parameters.rGain),
    transmittanceScaled: optical.transmittance.map((value) => value * parameters.tGain),
    n: modelN,
    k: modelK,
  };
}

function validateModelInputs(parameters, settings) {
  const values = [parameters.thicknessNm, parameters.nScale, parameters.kScale, parameters.rGain, parameters.tGain, settings.substrateIndex];
  if (values.some((value) => !Number.isFinite(value) || value <= 0)) throw new Error("Los parámetros ópticos deben ser finitos y positivos.");
  if (settings.substrateIndex <= 1) throw new Error("El índice del sustrato debe ser mayor que 1.");
  if (!new Set(["film", "substrate"]).has(settings.incidence)) throw new Error("Geometría de incidencia no válida.");
}

export function filmOnThickSubstrate(wavelengthNm, n, k, thicknessNm, substrateIndex, incidence = "film") {
  if (!(thicknessNm > 0) || !(substrateIndex > 1) || wavelengthNm.length !== n.length || n.length !== k.length) {
    throw new Error("Malla o parámetros TMM no válidos.");
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

function coherentSingleFilm(wavelengthNm, n, k, thicknessNm, incidentIndex, exitIndex) {
  if (!(wavelengthNm > 0) || !(n > 0) || k < 0) throw new Error("Índice complejo o longitud de onda no físicos.");
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

export function fitTabulated(data, nk, configuration, progress = () => {}) {
  const { settings, initial, bounds } = configuration;
  const names = settings.model === "scaled" ? ["thicknessNm", "nScale", "kScale"] : ["thicknessNm"];
  const lower = names.map((name) => bounds[name][0]);
  const upper = names.map((name) => bounds[name][1]);
  const toPhysical = (point) => Object.fromEntries(names.map((name, index) => [name, lower[index] + point[index] * (upper[index] - lower[index])]));
  const objective = (point) => {
    const variable = toPhysical(point);
    const parameters = {
      thicknessNm: variable.thicknessNm,
      nScale: variable.nScale ?? 1,
      kScale: variable.kScale ?? 1,
      rGain: 1,
      tGain: 1,
    };
    const evaluated = evaluateTabulated(data, nk, parameters, settings);
    parameters.rGain = settings.useReflectance
      ? robustOptimalGain(evaluated.reflectance, data.reflectance, data.reflectanceValid, bounds.rGain, settings.sigmaReflectance)
      : 1;
    parameters.tGain = settings.useTransmittance
      ? robustOptimalGain(evaluated.transmittance, data.transmittance, data.transmittanceValid, bounds.tGain, settings.sigmaTransmittance)
      : 1;
    const scaled = evaluateTabulated(data, nk, parameters, settings);
    return { cost: robustCost(data, scaled, settings), parameters, evaluated: scaled };
  };

  const initialPoint = names.map((name, index) => (initial[name] - lower[index]) / (upper[index] - lower[index]));
  // ponytail: Halton keeps this dependency-free; port the Python Sobol sequence if identical screening paths become necessary.
  const screeningPoints = names.length === 1 ? 192 : 384;
  const candidates = [{ point: initialPoint, ...objective(initialPoint) }];
  for (let index = 1; index < screeningPoints; index += 1) {
    const point = names.map((_, dimension) => halton(index, [2, 3, 5][dimension]));
    candidates.push({ point, ...objective(point) });
    if (index % 48 === 0) progress(Math.round(index / screeningPoints * 45));
  }
  candidates.sort((a, b) => a.cost - b.cost);
  let best = candidates[0];
  for (let index = 0; index < Math.min(6, candidates.length); index += 1) {
    const refinedPoint = nelderMead(candidates[index].point, (point) => objective(point).cost);
    const refined = { point: refinedPoint, ...objective(refinedPoint) };
    if (refined.cost < best.cost) best = refined;
    progress(50 + Math.round((index + 1) / 6 * 50));
  }
  const diagnostics = diagnosticsOf(data, best.evaluated, settings);
  return { parameters: best.parameters, evaluation: best.evaluated, cost: best.cost, diagnostics, screeningPoints, localRefinements: 6 };
}

function robustOptimalGain(modeled, measured, valid, [minimum, maximum], sigma) {
  const derivative = (gain) => modeled.reduce((sum, value, index) => {
    if (!valid[index]) return sum;
    const residual = (gain * value - measured[index]) / sigma;
    return sum + residual * value / sigma / Math.sqrt(1 + residual ** 2);
  }, 0);
  if (derivative(minimum) >= 0) return minimum;
  if (derivative(maximum) <= 0) return maximum;
  let lower = minimum;
  let upper = maximum;
  for (let iteration = 0; iteration < 60; iteration += 1) {
    const middle = (lower + upper) / 2;
    if (derivative(middle) < 0) lower = middle;
    else upper = middle;
  }
  return (lower + upper) / 2;
}

function robustCost(data, evaluation, settings) {
  const residuals = [];
  if (settings.useReflectance) {
    data.reflectance.forEach((value, index) => {
      if (data.reflectanceValid[index]) residuals.push((evaluation.reflectanceScaled[index] - value) / settings.sigmaReflectance);
    });
  }
  if (settings.useTransmittance) {
    data.transmittance.forEach((value, index) => {
      if (data.transmittanceValid[index]) residuals.push((evaluation.transmittanceScaled[index] - value) / settings.sigmaTransmittance);
    });
  }
  if (!residuals.length) throw new Error("Selecciona reflectancia, transmitancia o ambas.");
  return residuals.reduce((sum, value) => sum + 2 * (Math.sqrt(1 + value ** 2) - 1), 0);
}

function diagnosticsOf(data, evaluation, settings) {
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

function halton(index, base) {
  let fraction = 1;
  let result = 0;
  let value = index;
  while (value > 0) {
    fraction /= base;
    result += fraction * (value % base);
    value = Math.floor(value / base);
  }
  return result;
}

function nelderMead(start, objective) {
  const dimension = start.length;
  const clamp = (point) => point.map((value) => Math.max(0, Math.min(1, value)));
  let simplex = [start, ...start.map((_, index) => clamp(start.map((value, axis) => value + (axis === index ? 0.06 : 0))))]
    .map((point) => ({ point, value: objective(point) }));
  for (let iteration = 0; iteration < 140; iteration += 1) {
    simplex.sort((a, b) => a.value - b.value);
    if (Math.max(...simplex.slice(1).map((entry) => distance(entry.point, simplex[0].point))) < 1e-6) break;
    const centroid = Array.from({ length: dimension }, (_, axis) => simplex.slice(0, dimension).reduce((sum, entry) => sum + entry.point[axis], 0) / dimension);
    const reflected = clamp(centroid.map((value, axis) => value + (value - simplex[dimension].point[axis])));
    const reflectedValue = objective(reflected);
    if (reflectedValue < simplex[0].value) {
      const expanded = clamp(centroid.map((value, axis) => value + 2 * (reflected[axis] - value)));
      const expandedValue = objective(expanded);
      simplex[dimension] = expandedValue < reflectedValue ? { point: expanded, value: expandedValue } : { point: reflected, value: reflectedValue };
    } else if (reflectedValue < simplex[dimension - 1].value) {
      simplex[dimension] = { point: reflected, value: reflectedValue };
    } else {
      const contracted = clamp(centroid.map((value, axis) => value + 0.5 * (simplex[dimension].point[axis] - value)));
      const contractedValue = objective(contracted);
      if (contractedValue < simplex[dimension].value) simplex[dimension] = { point: contracted, value: contractedValue };
      else simplex = [simplex[0], ...simplex.slice(1).map((entry) => {
        const point = clamp(entry.point.map((value, axis) => simplex[0].point[axis] + 0.5 * (value - simplex[0].point[axis])));
        return { point, value: objective(point) };
      })];
    }
  }
  simplex.sort((a, b) => a.value - b.value);
  return simplex[0].point;
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
