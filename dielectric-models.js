export const PHOTON_ENERGY_EV_NM = 1239.8419843320026;

export const MODEL_LABELS = {
  fixed: "Fixed tabulated n,k",
  scaled: "Scaled tabulated n,k",
  constant: "Constant n,k (narrow band)",
  tl1: "Tauc–Lorentz (1 oscillator, causal)",
  tl2: "Tauc–Lorentz (2 oscillators, causal)",
  "tl-gaussian": "Tauc–Lorentz + Gaussian (causal)",
  cody: "Cody–Lorentz (amorphous, causal)",
  "drude-tl": "Drude + Tauc–Lorentz (VO₂ metal)",
};

export const NOMINAL_THICKNESS_NM = {
  agst: 250,
  cgst: 250,
  asb2sb3: 200,
  csb2sb3: 200,
  vo2: 150,
};

const TL_PRESETS = {
  agst: { epsilonInf: [1.53, 0.5, 5], amplitudeEv: [114, 30, 250], resonanceEv: [2.55, 2.3, 4.5], broadeningEv: [3.91, 0.2, 4.5], bandgapEv: [0.65, 0.35, 1] },
  cgst: { epsilonInf: [2.36, 0.5, 8], amplitudeEv: [181, 30, 400], resonanceEv: [1.32, 1.2, 2.5], broadeningEv: [2.13, 0.2, 2.3], bandgapEv: [0.53, 0.25, 0.9] },
  asb2sb3: { epsilonInf: [4, 1, 15], amplitudeEv: [80, 10, 500], resonanceEv: [3, 1.8, 5.5], broadeningEv: [1, 0.1, 3.5], bandgapEv: [1.16, 0.9, 1.4] },
  csb2sb3: { epsilonInf: [4, 1, 20], amplitudeEv: [80, 10, 600], resonanceEv: [2.5, 1.7, 5.5], broadeningEv: [1, 0.1, 3.3], bandgapEv: [1.06, 0.75, 1.3] },
  vo2: { epsilonInf: [4, 1, 15], amplitudeEv: [80, 10, 500], resonanceEv: [3, 1.6, 5], broadeningEv: [1, 0.1, 3.1], bandgapEv: [0.4, 0.2, 0.8] },
};

const ELLIPSOMETRY_SEEDS = {
  agst: {
    tl1: { epsilonInf: 1.1859581696, amplitudeEv: 156.9796852391, resonanceEv: 2.8517342434, broadeningEv: 4.5, bandgapEv: 0.6241743869 },
    tl2: { epsilonInf: 0.9207561235, amplitude1Ev: 124.6126748725, resonance1Ev: 2.7350981706, broadening1Ev: 4.5, amplitude2Ev: 40.7349554167, resonance2Ev: 3.2, broadening2Ev: 5, bandgapEv: 0.6447495472 },
    "tl-gaussian": { epsilonInf: 1.0870251138, amplitudeEv: 157.2316282025, resonanceEv: 2.7879926184, broadeningEv: 4.5, bandgapEv: 0.6457289982, gaussianAmplitude: 0.9806635696, gaussianCenterEv: 3.8440279312, gaussianFwhmEv: 3.480363721 },
    cody: { epsilonInf: 1.2010650032, amplitudeEv: 111.9447015671, transitionEv: 1.135806991, broadeningEv: 5, crossoverEv: 0.876115222, resonanceEv: 3.1304152044, urbachEv: 0.1997567257, bandgapEv: 0.5190613802 },
  },
  cgst: {
    tl1: { epsilonInf: 1.9229528086, amplitudeEv: 139.3915175486, resonanceEv: 1.456856692, broadeningEv: 1.976612672, bandgapEv: 0.25 },
    tl2: { epsilonInf: 1.8645010911, amplitude1Ev: 138.3274939796, resonance1Ev: 1.4548330141, broadening1Ev: 1.9640327883, amplitude2Ev: 1, resonance2Ev: 3.2, broadening2Ev: 5, bandgapEv: 0.25 },
    "tl-gaussian": { epsilonInf: 0.5, amplitudeEv: 139.4178821341, resonanceEv: 1.4624673069, broadeningEv: 1.983736254, bandgapEv: 0.25, gaussianAmplitude: 84.0974476512, gaussianCenterEv: 5.4390381385, gaussianFwhmEv: 0.1000000352 },
  },
  asb2sb3: {
    tl1: { epsilonInf: 1.7804862753, amplitudeEv: 164.8113314557, resonanceEv: 2.5994694212, broadeningEv: 3.1843005574, bandgapEv: 1.3062333079 },
    tl2: { epsilonInf: 1.7813387578, amplitude1Ev: 163.6828325188, resonance1Ev: 2.5966331473, broadening1Ev: 3.1770002258, amplitude2Ev: 1.0000122654, resonance2Ev: 3.2, broadening2Ev: 3.8452819818, bandgapEv: 1.3061466078 },
    "tl-gaussian": { epsilonInf: 1.7804308218, amplitudeEv: 164.8107869006, resonanceEv: 2.5994711099, broadeningEv: 3.1842946255, bandgapEv: 1.3062323841, gaussianAmplitude: 0.0003965868, gaussianCenterEv: 6.4987702812, gaussianFwhmEv: 1.26982847 },
    cody: { epsilonInf: 1.9038818765, amplitudeEv: 89.3094478719, transitionEv: 1.4932227882, broadeningEv: 3.9480578275, crossoverEv: 1.2430762883, resonanceEv: 2.7457520306, urbachEv: 0.0602260423, bandgapEv: 1.2565694075 },
  },
  csb2sb3: {
    tl1: { epsilonInf: 1, amplitudeEv: 205.7301912767, resonanceEv: 2.4859071057, broadeningEv: 2.6287553918, bandgapEv: 0.9766788612 },
    tl2: { epsilonInf: 1.3580597044, amplitude1Ev: 194.2041501786, resonance1Ev: 2.2752808378, broadening1Ev: 2.3834017241, amplitude2Ev: 17.8155038957, resonance2Ev: 3.2, broadening2Ev: 1.2626406651, bandgapEv: 1.0137402947 },
    "tl-gaussian": { epsilonInf: 1, amplitudeEv: 352.5408306005, resonanceEv: 1.823128557, broadeningEv: 2.8136041277, bandgapEv: 1.1371299375, gaussianAmplitude: 8.8489195319, gaussianCenterEv: 2.8949294417, gaussianFwhmEv: 0.8370174188 },
  },
  vo2: {
    tl1: { epsilonInf: 2.4157523024, amplitudeEv: 20.4847229431, resonanceEv: 3.5757032102, broadeningEv: 3.1, bandgapEv: 0.2 },
    tl2: { epsilonInf: 2.000700204, amplitude1Ev: 18.8785081299, resonance1Ev: 3.527965032, broadening1Ev: 3.1, amplitude2Ev: 4.6811156432, resonance2Ev: 6, broadening2Ev: 5, bandgapEv: 0.2 },
    "tl-gaussian": { epsilonInf: 1, amplitudeEv: 20.6492735606, resonanceEv: 3.5553494846, broadeningEv: 3.1, bandgapEv: 0.2, gaussianAmplitude: 95.7964965008, gaussianCenterEv: 5.9721402862, gaussianFwhmEv: 0.1000000094 },
  },
};

function seeded(specifications, model, sample) {
  for (const [name, value] of Object.entries(ELLIPSOMETRY_SEEDS[sample]?.[model] ?? {})) {
    if (specifications[name]) specifications[name] = { ...specifications[name], value };
  }
  return specifications;
}

export function modelParameterSpecs(model, sample, referenceAt1064 = { n: 3, k: 0.1 }) {
  const thickness = NOMINAL_THICKNESS_NM[sample] ?? 200;
  const parameter = (label, unit, values, fit = false) => ({ label, unit, value: values[0], minimum: values[1], maximum: values[2], fit });
  const common = {
    thicknessNm: parameter("Film thickness", "nm", [thickness, 0.5 * thickness, 1.5 * thickness], true),
    rGain: parameter("R gain", "", [1, 0.1, 10], model === "fixed" || model === "scaled" || model === "constant"),
    tGain: parameter("T gain", "", [1, 0.1, 10], model === "fixed" || model === "scaled" || model === "constant"),
  };
  if (model === "fixed") return common;
  if (model === "scaled") return {
    thicknessNm: common.thicknessNm,
    nScale: parameter("n scale", "", [1, 0.85, 1.15], true),
    kScale: parameter("k scale", "", [1, 0.5, 2], true),
    rGain: common.rGain,
    tGain: common.tGain,
  };
  if (model === "constant") {
    const n = Math.max(referenceAt1064.n, 1);
    const k = Math.max(referenceAt1064.k, 0);
    return {
      thicknessNm: common.thicknessNm,
      n: parameter("n", "", [n, Math.max(1, n - 1), n + 1], true),
      k: parameter("k", "", [k, Math.max(0, k - 1), k + 1], true),
      rGain: common.rGain,
      tGain: common.tGain,
    };
  }
  const preset = TL_PRESETS[sample] ?? TL_PRESETS.asb2sb3;
  const tl = {
    thicknessNm: common.thicknessNm,
    epsilonInf: parameter("ε∞", "", preset.epsilonInf),
    amplitudeEv: parameter("A", "eV", preset.amplitudeEv, true),
    resonanceEv: parameter("E₀", "eV", preset.resonanceEv),
    broadeningEv: parameter("C", "eV", preset.broadeningEv),
    bandgapEv: parameter("E_g", "eV", preset.bandgapEv),
  };
  if (model === "tl1") return seeded({ ...tl, rGain: common.rGain, tGain: common.tGain }, model, sample);
  if (model === "tl2") {
    const secondResonance = Math.max(3.4, preset.resonanceEv[0] + 0.8);
    return seeded({
      thicknessNm: common.thicknessNm,
      epsilonInf: tl.epsilonInf,
      amplitude1Ev: parameter("A₁", "eV", [0.75 * preset.amplitudeEv[0], 1, preset.amplitudeEv[2]], true),
      resonance1Ev: parameter("E₀₁", "eV", preset.resonanceEv),
      broadening1Ev: parameter("C₁", "eV", preset.broadeningEv),
      amplitude2Ev: parameter("A₂", "eV", [0.25 * preset.amplitudeEv[0], 1, preset.amplitudeEv[2]], true),
      resonance2Ev: parameter("E₀₂", "eV", [secondResonance, 3.2, 6]),
      broadening2Ev: parameter("C₂", "eV", [1.5, 0.1, 5]),
      bandgapEv: tl.bandgapEv,
      rGain: common.rGain,
      tGain: common.tGain,
    }, model, sample);
  }
  if (model === "tl-gaussian") return seeded({
    ...tl,
    gaussianAmplitude: parameter("Gaussian amplitude", "", [5, 1e-4, 150], true),
    gaussianCenterEv: parameter("Gaussian center", "eV", [3.8, 2.4, 6.5]),
    gaussianFwhmEv: parameter("Gaussian FWHM", "eV", [1, 0.1, 4]),
    rGain: common.rGain,
    tGain: common.tGain,
  }, model, sample);
  if (model === "cody") {
    const transitionLower = preset.bandgapEv[2] + 0.05;
    const transition = Math.max(transitionLower + 0.15, preset.bandgapEv[0] + 0.4);
    const resonanceLower = Math.max(transitionLower + 0.1, preset.resonanceEv[1]);
    return seeded({
      thicknessNm: common.thicknessNm,
      epsilonInf: tl.epsilonInf,
      amplitudeEv: tl.amplitudeEv,
      transitionEv: parameter("Eₜ", "eV", [transition, transitionLower, 3.8]),
      broadeningEv: parameter("γ", "eV", [Math.max(0.5, preset.broadeningEv[0]), 0.1, 5]),
      crossoverEv: parameter("Eₚ", "eV", [0.8, 0.05, 3]),
      resonanceEv: parameter("E₀", "eV", [Math.max(resonanceLower + 0.2, preset.resonanceEv[0]), resonanceLower, 6.5]),
      urbachEv: parameter("Eᵤ", "eV", [0.07, 0.005, 0.3]),
      bandgapEv: tl.bandgapEv,
      rGain: common.rGain,
      tGain: common.tGain,
    }, model, sample);
  }
  if (model === "drude-tl") return {
    thicknessNm: common.thicknessNm,
    epsilonInf: tl.epsilonInf,
    plasmaEnergyEv: parameter("Plasma energy", "eV", [4.16, 1, 8], true),
    drudeGammaEv: parameter("Drude γ", "eV", [0.67, 0.05, 3]),
    amplitudeEv: parameter("A", "eV", preset.amplitudeEv),
    resonanceEv: tl.resonanceEv,
    broadeningEv: tl.broadeningEv,
    bandgapEv: tl.bandgapEv,
    rGain: common.rGain,
    tGain: common.tGain,
  };
  throw new Error(`Unsupported optical model: ${model}.`);
}

export function validateModelAvailability(model, sample) {
  if (model === "cody" && !new Set(["agst", "asb2sb3"]).has(sample)) {
    throw new Error("Cody–Lorentz is restricted to the amorphous GST and Sb₂Se₃ samples.");
  }
  if (model === "drude-tl" && sample !== "vo2") throw new Error("Drude + Tauc–Lorentz is restricted to VO₂.");
}

export function refractiveIndexModel(model, wavelengthNm, parameters, nk) {
  if (model === "constant") return { n: wavelengthNm.map(() => parameters.n), k: wavelengthNm.map(() => parameters.k) };
  if (model === "fixed" || model === "scaled") {
    if (!nk) throw new Error("The selected model requires a matching ellipsometry n,k table.");
    const n = interpolate(nk.wavelengthNm, nk.n, wavelengthNm);
    const k = interpolate(nk.wavelengthNm, nk.k, wavelengthNm);
    return model === "scaled"
      ? { n: n.map((value) => value * parameters.nScale), k: k.map((value) => value * parameters.kScale) }
      : { n, k };
  }
  let dielectric;
  if (model === "tl1") dielectric = taucLorentzDielectric(wavelengthNm, parameters.epsilonInf, parameters.amplitudeEv, parameters.resonanceEv, parameters.broadeningEv, parameters.bandgapEv);
  else if (model === "tl2") dielectric = multiTaucLorentzDielectric(wavelengthNm, parameters);
  else if (model === "tl-gaussian") dielectric = taucGaussianDielectric(wavelengthNm, parameters);
  else if (model === "cody") dielectric = codyLorentzDielectric(wavelengthNm, parameters);
  else if (model === "drude-tl") dielectric = drudeTaucLorentzDielectric(wavelengthNm, parameters);
  else throw new Error(`Unsupported optical model: ${model}.`);
  return passiveRefractiveIndex(dielectric);
}

export function taucLorentzDielectric(wavelengthNm, epsilonInf, amplitudeEv, resonanceEv, broadeningEv, bandgapEv) {
  validatePositiveWavelengths(wavelengthNm);
  if (![epsilonInf, amplitudeEv, resonanceEv, broadeningEv, bandgapEv].every(Number.isFinite) || epsilonInf <= 0 || amplitudeEv <= 0) {
    throw new Error("Tauc–Lorentz ε∞ and amplitude must be finite and positive.");
  }
  if (bandgapEv < 0 || resonanceEv <= bandgapEv || broadeningEv <= 0) throw new Error("Tauc–Lorentz requires E₀ > E_g ≥ 0 and C > 0.");
  if (broadeningEv >= 2 * resonanceEv) throw new Error("Tauc–Lorentz requires C < 2E₀ for the analytical causal form.");
  const e0 = resonanceEv;
  const width = broadeningEv;
  const gap = bandgapEv;
  const gamma2 = e0 ** 2 - width ** 2 / 2;
  const alpha = Math.sqrt(4 * e0 ** 2 - width ** 2);
  const epsilon1 = [];
  const epsilon2 = [];
  for (const wavelength of wavelengthNm) {
    const energy = PHOTON_ENERGY_EV_NM / wavelength;
    const aL = (gap ** 2 - e0 ** 2) * energy ** 2 + gap ** 2 * width ** 2 - e0 ** 2 * (e0 ** 2 + 3 * gap ** 2);
    const aA = (energy ** 2 - e0 ** 2) * (e0 ** 2 + gap ** 2) + gap ** 2 * width ** 2;
    const zeta4 = (energy ** 2 - gamma2) ** 2 + alpha ** 2 * width ** 2 / 4;
    const gapDistance = Math.max(Math.abs(energy - gap), Number.EPSILON);
    const real = epsilonInf
      + amplitudeEv * width * aL / (2 * Math.PI * zeta4 * alpha * e0) * Math.log((e0 ** 2 + gap ** 2 + alpha * gap) / (e0 ** 2 + gap ** 2 - alpha * gap))
      - amplitudeEv * aA / (Math.PI * zeta4 * e0) * (Math.PI - Math.atan((2 * gap + alpha) / width) + Math.atan((alpha - 2 * gap) / width))
      + 2 * amplitudeEv * e0 * gap * (energy ** 2 - gamma2) / (Math.PI * zeta4 * alpha) * (Math.PI + 2 * Math.atan(2 * (gamma2 - gap ** 2) / (alpha * width)))
      - amplitudeEv * e0 * width * (energy ** 2 + gap ** 2) / (Math.PI * zeta4 * energy) * Math.log(gapDistance / (energy + gap))
      + 2 * amplitudeEv * e0 * width * gap / (Math.PI * zeta4) * Math.log(gapDistance * (energy + gap) / Math.sqrt((e0 ** 2 - gap ** 2) ** 2 + gap ** 2 * width ** 2));
    const imaginary = energy > gap
      ? amplitudeEv * e0 * width * (energy - gap) ** 2 / (energy * ((energy ** 2 - e0 ** 2) ** 2 + width ** 2 * energy ** 2))
      : 0;
    if (!Number.isFinite(real) || !Number.isFinite(imaginary)) throw new Error("Tauc–Lorentz produced non-finite optical constants; revise the parameters.");
    epsilon1.push(real);
    epsilon2.push(imaginary);
  }
  return { epsilon1, epsilon2 };
}

export function multiTaucLorentzDielectric(wavelengthNm, parameters) {
  const first = taucLorentzDielectric(wavelengthNm, parameters.epsilonInf, parameters.amplitude1Ev, parameters.resonance1Ev, parameters.broadening1Ev, parameters.bandgapEv);
  const second = taucLorentzDielectric(wavelengthNm, 1, parameters.amplitude2Ev, parameters.resonance2Ev, parameters.broadening2Ev, parameters.bandgapEv);
  return { epsilon1: first.epsilon1.map((value, index) => value + second.epsilon1[index] - 1), epsilon2: first.epsilon2.map((value, index) => value + second.epsilon2[index]) };
}

export function gaussianOscillatorDielectric(wavelengthNm, amplitude, centerEnergyEv, fwhmEv) {
  validatePositiveWavelengths(wavelengthNm);
  if (![amplitude, centerEnergyEv, fwhmEv].every((value) => Number.isFinite(value) && value > 0)) throw new Error("Gaussian amplitude, center energy, and FWHM must be finite and positive.");
  const widthScale = 2 * Math.sqrt(Math.log(2)) / fwhmEv;
  const epsilon1 = [];
  const epsilon2 = [];
  for (const wavelength of wavelengthNm) {
    const energy = PHOTON_ENERGY_EV_NM / wavelength;
    const positive = widthScale * (energy + centerEnergyEv);
    const resonant = widthScale * (energy - centerEnergyEv);
    epsilon1.push(2 * amplitude / Math.sqrt(Math.PI) * (dawson(positive) - dawson(resonant)));
    epsilon2.push(amplitude * (Math.exp(-(resonant ** 2)) - Math.exp(-(positive ** 2))));
  }
  return { epsilon1, epsilon2 };
}

export function taucGaussianDielectric(wavelengthNm, parameters) {
  const tl = taucLorentzDielectric(wavelengthNm, parameters.epsilonInf, parameters.amplitudeEv, parameters.resonanceEv, parameters.broadeningEv, parameters.bandgapEv);
  const gaussian = gaussianOscillatorDielectric(wavelengthNm, parameters.gaussianAmplitude, parameters.gaussianCenterEv, parameters.gaussianFwhmEv);
  return { epsilon1: tl.epsilon1.map((value, index) => value + gaussian.epsilon1[index]), epsilon2: tl.epsilon2.map((value, index) => value + gaussian.epsilon2[index]) };
}

const codyCache = new WeakMap();

export function codyLorentzDielectric(wavelengthNm, parameters) {
  validatePositiveWavelengths(wavelengthNm);
  if (!(parameters.epsilonInf > 0)) throw new Error("Cody–Lorentz ε∞ must be finite and positive.");
  const cacheKey = [parameters.transitionEv, parameters.broadeningEv, parameters.crossoverEv, parameters.resonanceEv, parameters.urbachEv, parameters.bandgapEv].join("|");
  let byParameters = codyCache.get(wavelengthNm);
  if (!byParameters) { byParameters = new Map(); codyCache.set(wavelengthNm, byParameters); }
  let unit = byParameters.get(cacheKey);
  if (!unit) {
    const integrationEnergy = Array.from({ length: 1200 }, (_, index) => 0.01 + index * (30 - 0.01) / 1199);
    const step = integrationEnergy[1] - integrationEnergy[0];
    const integrationEpsilon2 = codyLorentzEpsilon2(integrationEnergy, 1, parameters);
    const kkAtIndex = (row) => {
      let sum = 0;
      for (let column = 1 - (row & 1); column < integrationEnergy.length; column += 2) {
        sum += 4 * step / Math.PI * integrationEnergy[column] * integrationEpsilon2[column]
          / (integrationEnergy[column] ** 2 - integrationEnergy[row] ** 2);
      }
      return sum;
    };
    const energies = wavelengthNm.map((value) => PHOTON_ENERGY_EV_NM / value);
    const real = energies.map((energy) => {
      const position = Math.max(0, Math.min(1199, (energy - 0.01) / step));
      const lower = Math.min(1198, Math.floor(position));
      const fraction = position - lower;
      return kkAtIndex(lower) * (1 - fraction) + kkAtIndex(lower + 1) * fraction;
    });
    unit = { real, imaginary: codyLorentzEpsilon2(energies, 1, parameters) };
    byParameters.set(cacheKey, unit);
  }
  return {
    epsilon1: unit.real.map((value) => parameters.epsilonInf + parameters.amplitudeEv * value),
    epsilon2: unit.imaginary.map((value) => parameters.amplitudeEv * value),
  };
}

function codyLorentzEpsilon2(energyEv, amplitudeEv, parameters) {
  const { transitionEv, broadeningEv, crossoverEv, resonanceEv, urbachEv, bandgapEv } = parameters;
  const values = [amplitudeEv, transitionEv, broadeningEv, crossoverEv, resonanceEv, urbachEv, bandgapEv];
  if (!values.every(Number.isFinite) || Math.min(...values.slice(0, -1)) <= 0 || bandgapEv < 0) throw new Error("Cody–Lorentz energies and amplitude must be finite and positive.");
  if (transitionEv <= bandgapEv || resonanceEv <= bandgapEv) throw new Error("Cody–Lorentz requires Eₜ > E_g and E₀ > E_g.");
  const onset = (energy) => (energy - bandgapEv) ** 2 / ((energy - bandgapEv) ** 2 + crossoverEv ** 2);
  const lorentz = (energy) => amplitudeEv * resonanceEv * broadeningEv * energy / ((energy ** 2 - resonanceEv ** 2) ** 2 + broadeningEv ** 2 * energy ** 2);
  const transitionScale = transitionEv * onset(transitionEv) * lorentz(transitionEv);
  return energyEv.map((energy) => energy <= transitionEv
    ? transitionScale / energy * Math.exp((energy - transitionEv) / urbachEv)
    : onset(energy) * lorentz(energy));
}

export function drudeTaucLorentzDielectric(wavelengthNm, parameters) {
  if (!(parameters.plasmaEnergyEv > 0) || !(parameters.drudeGammaEv > 0)) throw new Error("Drude plasma energy and γ must be finite and positive.");
  const interband = taucLorentzDielectric(wavelengthNm, parameters.epsilonInf, parameters.amplitudeEv, parameters.resonanceEv, parameters.broadeningEv, parameters.bandgapEv);
  const epsilon1 = [];
  const epsilon2 = [];
  wavelengthNm.forEach((wavelength, index) => {
    const energy = PHOTON_ENERGY_EV_NM / wavelength;
    const denominator = energy ** 4 + parameters.drudeGammaEv ** 2 * energy ** 2;
    epsilon1.push(interband.epsilon1[index] - parameters.plasmaEnergyEv ** 2 * energy ** 2 / denominator);
    epsilon2.push(interband.epsilon2[index] + parameters.plasmaEnergyEv ** 2 * parameters.drudeGammaEv * energy / denominator);
  });
  return { epsilon1, epsilon2 };
}

export function passiveRefractiveIndex({ epsilon1, epsilon2 }) {
  const n = [];
  const k = [];
  epsilon1.forEach((real, index) => {
    const imaginary = epsilon2[index];
    const magnitude = Math.hypot(real, imaginary);
    const realIndex = Math.sqrt(Math.max(0, (magnitude + real) / 2));
    const extinction = Math.sqrt(Math.max(0, (magnitude - real) / 2));
    if (!Number.isFinite(realIndex) || !Number.isFinite(extinction) || imaginary < -1e-14) throw new Error("The dielectric model did not produce a passive refractive index.");
    n.push(realIndex);
    k.push(extinction);
  });
  return { n, k };
}

function validatePositiveWavelengths(wavelengthNm) {
  if (!wavelengthNm.length || wavelengthNm.some((value) => !Number.isFinite(value) || value <= 0)) throw new Error("Wavelengths must be finite and positive.");
}

function interpolate(x, y, points) {
  return points.map((point) => {
    if (point <= x[0]) return y[0];
    if (point >= x.at(-1)) return y.at(-1);
    let low = 0;
    let high = x.length - 1;
    while (high - low > 1) {
      const middle = (low + high) >> 1;
      if (x[middle] <= point) low = middle;
      else high = middle;
    }
    return y[low] + (y[high] - y[low]) * (point - x[low]) / (x[high] - x[low]);
  });
}

function dawson(value) {
  const absolute = Math.abs(value);
  if (absolute < 0.2) {
    const square = value ** 2;
    return value * (1 - (2 / 3) * square * (1 - 0.4 * square * (1 - (2 / 7) * square)));
  }
  const h = 0.4;
  const n0 = 2 * Math.round(0.5 * absolute / h);
  const shifted = absolute - n0 * h;
  let exponential = Math.exp(2 * shifted * h);
  const exponentialStep = exponential ** 2;
  let denominator1 = n0 + 1;
  let denominator2 = denominator1 - 2;
  let sum = 0;
  for (let index = 0; index < 6; index += 1) {
    const coefficient = Math.exp(-(((2 * index + 1) * h) ** 2));
    sum += coefficient * (exponential / denominator1 + 1 / (denominator2 * exponential));
    denominator1 += 2;
    denominator2 -= 2;
    exponential *= exponentialStep;
  }
  return Math.sign(value) * 0.5641895835477563 * Math.exp(-(shifted ** 2)) * sum;
}
