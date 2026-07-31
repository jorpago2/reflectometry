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
  composite: "Independent dielectric components",
  cauchy: "Cauchy + optional Urbach absorption",
  sellmeier: "Sellmeier (3 resonances, transparent)",
  "forouhi-bloomer": "Forouhi–Bloomer (amorphous)",
  "kk-spline": "Kramers–Kronig constrained B-spline",
  ema: "Effective-medium mixture",
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

export function modelParameterSpecs(model, sample, referenceAt1064 = { n: 3, k: 0.1 }, nominalThicknessNm = null, components = {}) {
  const thickness = nominalThicknessNm ?? NOMINAL_THICKNESS_NM[sample] ?? 200;
  if (!Number.isFinite(thickness) || thickness <= 0) throw new Error("Nominal film thickness must be positive and finite.");
  const parameter = (label, unit, values, fit = false) => ({ label, unit, value: values[0], minimum: values[1], maximum: values[2], fit });
  const common = {
    thicknessNm: parameter("Film thickness", "nm", [thickness, 0.5 * thickness, 1.5 * thickness], true),
    rGain: parameter("R gain", "", [1, 0.1, 10], model === "fixed" || model === "scaled" || model === "constant"),
    tGain: parameter("T gain", "", [1, 0.1, 10], model === "fixed" || model === "scaled" || model === "constant"),
  };
  if (model === "composite") {
    const preset = TL_PRESETS[sample] ?? TL_PRESETS.asb2sb3;
    const specifications = {
      thicknessNm: common.thicknessNm,
      epsilonInf: parameter("ε∞", "", preset.epsilonInf),
    };
    const add = (prefix, entries) => Object.entries(entries).forEach(([name, specification]) => { specifications[`${prefix}__${name}`] = specification; });
    const taucLorentzCount = components.taucLorentz ?? Number(Boolean(components.tl1)) + Number(Boolean(components.tl2));
    if (!Number.isInteger(taucLorentzCount) || taucLorentzCount < 0 || taucLorentzCount > 5) throw new Error("Select from 0 to 5 Tauc–Lorentz oscillators.");
    for (let oscillator = 1; oscillator <= taucLorentzCount; oscillator += 1) {
      if (oscillator === 1) add("tl1", {
        amplitudeEv: parameter("TL1 · A", "eV", preset.amplitudeEv, true),
        resonanceEv: parameter("TL1 · E₀", "eV", preset.resonanceEv),
        broadeningEv: parameter("TL1 · C", "eV", preset.broadeningEv),
        bandgapEv: parameter("TL1 · E_g", "eV", preset.bandgapEv),
      });
      else {
        const resonance = Math.min(10, Math.max(preset.bandgapEv[2] + 0.4, preset.resonanceEv[0] + 0.8 * (oscillator - 1)));
        const resonanceMinimum = Math.max(preset.bandgapEv[2] + 0.05, resonance - 0.8);
        const broadeningMaximum = Math.min(5, 1.8 * resonanceMinimum);
        add(`tl${oscillator}`, {
          amplitudeEv: parameter(`TL${oscillator} · A`, "eV", [preset.amplitudeEv[0] / oscillator, 1e-4, preset.amplitudeEv[2]], true),
          resonanceEv: parameter(`TL${oscillator} · E₀`, "eV", [resonance, resonanceMinimum, Math.min(12, resonance + 2)]),
          broadeningEv: parameter(`TL${oscillator} · C`, "eV", [Math.min(1.5, 0.7 * broadeningMaximum), 0.05, broadeningMaximum]),
          bandgapEv: parameter(`TL${oscillator} · E_g`, "eV", preset.bandgapEv),
        });
      }
    }
    const lorentzCount = components.lorentz ?? 0;
    if (!Number.isInteger(lorentzCount) || lorentzCount < 0 || lorentzCount > 5) throw new Error("Select from 0 to 5 Lorentz oscillators.");
    for (let oscillator = 1; oscillator <= lorentzCount; oscillator += 1) add(`lorentz${oscillator}`, {
      strength: parameter(`Lorentz ${oscillator} · strength`, "", [2 / oscillator, 1e-4, 100], true),
      resonanceEv: parameter(`Lorentz ${oscillator} · E₀`, "eV", [1.5 + oscillator, 0.1, 12]),
      gammaEv: parameter(`Lorentz ${oscillator} · γ`, "eV", [0.5, 0.005, 5]),
    });
    if (components.gaussian) add("gaussian", {
      amplitude: parameter("Gaussian · amplitude", "", [5, 1e-4, 150], true),
      centerEnergyEv: parameter("Gaussian · center", "eV", [3.8, 0.2, 10]),
      fwhmEv: parameter("Gaussian · FWHM", "eV", [1, 0.05, 8]),
    });
    if (components.cody) add("cody", {
      amplitudeEv: parameter("Cody · A", "eV", preset.amplitudeEv, true),
      transitionEv: parameter("Cody · Eₜ", "eV", [Math.max(preset.bandgapEv[2] + 0.2, preset.bandgapEv[0] + 0.4), preset.bandgapEv[2] + 0.05, 3.8]),
      broadeningEv: parameter("Cody · γ", "eV", [Math.max(0.5, preset.broadeningEv[0]), 0.1, 5]),
      crossoverEv: parameter("Cody · Eₚ", "eV", [0.8, 0.05, 3]),
      resonanceEv: parameter("Cody · E₀", "eV", [Math.max(2, preset.resonanceEv[0]), Math.max(1, preset.bandgapEv[2] + 0.1), 6.5]),
      urbachEv: parameter("Cody · Eᵤ", "eV", [0.07, 0.005, 0.3]),
      bandgapEv: parameter("Cody · E_g", "eV", preset.bandgapEv),
    });
    if (components.drude) add("drude", {
      plasmaEnergyEv: parameter("Drude · plasma energy", "eV", [4.16, 0.05, 12], true),
      gammaEv: parameter("Drude · γ", "eV", [0.67, 0.005, 5]),
    });
    if (components.drudeSmith) add("drudeSmith", {
      plasmaEnergyEv: parameter("Drude–Smith · plasma energy", "eV", [4.16, 0.05, 12], true),
      gammaEv: parameter("Drude–Smith · γ", "eV", [0.67, 0.005, 5]),
      backscattering: parameter("Drude–Smith · c₁", "", [-0.5, -1, 0], true),
    });
    if (components.brendelBormann) add("brendelBormann", {
      strength: parameter("Brendel–Bormann · strength", "", [2, 1e-4, 100], true),
      resonanceEv: parameter("Brendel–Bormann · E₀", "eV", [3, 0.1, 12]),
      gammaEv: parameter("Brendel–Bormann · γ", "eV", [0.5, 0.005, 5]),
      sigmaEv: parameter("Brendel–Bormann · σ", "eV", [0.3, 0.005, 4]),
    });
    if (components.criticalPoint) add("criticalPoint", {
      amplitude: parameter("Critical point · amplitude", "", [2, 1e-4, 100], true),
      energyEv: parameter("Critical point · E₀", "eV", [3, 0.1, 12]),
      broadeningEv: parameter("Critical point · Γ", "eV", [0.2, 0.005, 3]),
    });
    return specifications;
  }
  if (model === "cauchy") return {
    thicknessNm: common.thicknessNm,
    cauchyA: parameter("Cauchy A", "", [1.5, 1, 6], true),
    cauchyBUm2: parameter("Cauchy B", "µm²", [0.01, -1, 2]),
    cauchyCUm4: parameter("Cauchy C", "µm⁴", [0, -1, 2]),
    urbachK0: parameter("Urbach k₀", "", [0, 0, 2]),
    urbachReferenceEv: parameter("Urbach reference", "eV", [1.5, 0.1, 10]),
    urbachEnergyEv: parameter("Urbach energy", "eV", [0.1, 0.005, 2]),
    rGain: common.rGain, tGain: common.tGain,
  };
  if (model === "sellmeier") return {
    thicknessNm: common.thicknessNm,
    sellmeierB1: parameter("Sellmeier B₁", "", [0.6961663, 0, 10], true),
    sellmeierC1Um2: parameter("Sellmeier C₁", "µm²", [0.00467915, 1e-6, 1]),
    sellmeierB2: parameter("Sellmeier B₂", "", [0.4079426, 0, 10]),
    sellmeierC2Um2: parameter("Sellmeier C₂", "µm²", [0.0135121, 1e-6, 4]),
    sellmeierB3: parameter("Sellmeier B₃", "", [0.8974794, 0, 20]),
    sellmeierC3Um2: parameter("Sellmeier C₃", "µm²", [97.934, 4.01, 400]),
    rGain: common.rGain, tGain: common.tGain,
  };
  if (model === "forouhi-bloomer") return {
    thicknessNm: common.thicknessNm,
    nInfinity: parameter("Forouhi–Bloomer n∞", "", [1.5, 1, 6], true),
    amplitudeEv: parameter("Forouhi–Bloomer A", "eV", [1, 1e-4, 100], true),
    bEv: parameter("Forouhi–Bloomer B", "eV", [3, 0.05, 12]),
    cEv2: parameter("Forouhi–Bloomer C", "eV²", [4, 0.01, 100]),
    bandgapEv: parameter("Forouhi–Bloomer E_g", "eV", [1, 0, 5]),
    rGain: common.rGain, tGain: common.tGain,
  };
  if (model === "kk-spline") return {
    thicknessNm: common.thicknessNm,
    epsilonInf: parameter("ε∞", "", [2, 0.5, 20]),
    splineEpsilon2_1: parameter("ε₂ knot · 0.50 eV", "", [0.1, 0, 100], true),
    splineEpsilon2_2: parameter("ε₂ knot · 1.63 eV", "", [0.5, 0, 100], true),
    splineEpsilon2_3: parameter("ε₂ knot · 2.75 eV", "", [1, 0, 100], true),
    splineEpsilon2_4: parameter("ε₂ knot · 3.88 eV", "", [1, 0, 100], true),
    splineEpsilon2_5: parameter("ε₂ knot · 5.00 eV", "", [0.2, 0, 100], true),
    rGain: common.rGain, tGain: common.tGain,
  };
  if (model === "ema") return {
    thicknessNm: common.thicknessNm,
    volumeFraction: parameter("Inclusion volume fraction", "", [0.5, 0, 1], true),
    rGain: common.rGain, tGain: common.tGain,
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

export function refractiveIndexModel(model, wavelengthNm, parameters, nk, options = {}) {
  if (model === "constant") return { n: wavelengthNm.map(() => parameters.n), k: wavelengthNm.map(() => parameters.k) };
  if (model === "cauchy") return cauchyRefractiveIndex(wavelengthNm, parameters);
  if (model === "sellmeier") return sellmeierRefractiveIndex(wavelengthNm, parameters);
  if (model === "forouhi-bloomer") return forouhiBloomerRefractiveIndex(wavelengthNm, parameters);
  if (model === "ema") return effectiveMediumRefractiveIndex(wavelengthNm, parameters, options.ema);
  if (model === "fixed" || model === "scaled") {
    if (!nk) throw new Error("The selected model requires a matching ellipsometry n,k table.");
    const { n, k } = tabulatedRefractiveIndex(nk, wavelengthNm);
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
  else if (model === "composite") dielectric = compositeDielectric(wavelengthNm, parameters, options.components);
  else if (model === "kk-spline") dielectric = kkSplineDielectric(wavelengthNm, parameters);
  else throw new Error(`Unsupported optical model: ${model}.`);
  return passiveRefractiveIndex(dielectric);
}

export function compositeDielectric(wavelengthNm, parameters, components = {}) {
  validatePositiveWavelengths(wavelengthNm);
  if (!(parameters.epsilonInf > 0)) throw new Error("The composite model requires a finite positive ε∞.");
  const taucLorentzCount = components.taucLorentz ?? Number(Boolean(components.tl1)) + Number(Boolean(components.tl2));
  if (!Number.isInteger(taucLorentzCount) || taucLorentzCount < 0 || taucLorentzCount > 5) throw new Error("Select from 0 to 5 Tauc–Lorentz oscillators.");
  const lorentzCount = components.lorentz ?? 0;
  if (!Number.isInteger(lorentzCount) || lorentzCount < 0 || lorentzCount > 5) throw new Error("Select from 0 to 5 Lorentz oscillators.");
  const enabled = ["gaussian", "cody", "drude", "drudeSmith", "brendelBormann", "criticalPoint"].filter((name) => components[name]);
  if (!taucLorentzCount && !lorentzCount && !enabled.length) throw new Error("Select at least one dielectric component.");
  if (components.drude && components.drudeSmith) throw new Error("Choose Drude or Drude–Smith, not both.");
  const epsilon1 = wavelengthNm.map(() => parameters.epsilonInf);
  const epsilon2 = wavelengthNm.map(() => 0);
  const values = (prefix) => Object.fromEntries(Object.entries(parameters).filter(([name]) => name.startsWith(`${prefix}__`)).map(([name, value]) => [name.slice(prefix.length + 2), value]));
  const add = (dielectric, subtractBackground = false) => dielectric.epsilon1.forEach((value, index) => {
    epsilon1[index] += value - Number(subtractBackground);
    epsilon2[index] += dielectric.epsilon2[index];
  });
  for (let oscillator = 1; oscillator <= taucLorentzCount; oscillator += 1) {
    const componentParameters = values(`tl${oscillator}`);
    add(taucLorentzDielectric(wavelengthNm, 1, componentParameters.amplitudeEv, componentParameters.resonanceEv, componentParameters.broadeningEv, componentParameters.bandgapEv), true);
  }
  for (let oscillator = 1; oscillator <= lorentzCount; oscillator += 1) {
    const componentParameters = values(`lorentz${oscillator}`);
    add(lorentzOscillatorDielectric(wavelengthNm, componentParameters.strength, componentParameters.resonanceEv, componentParameters.gammaEv));
  }
  for (const component of enabled) {
    const componentParameters = values(component);
    if (component === "gaussian") add(gaussianOscillatorDielectric(wavelengthNm, componentParameters.amplitude, componentParameters.centerEnergyEv, componentParameters.fwhmEv));
    else if (component === "cody") add(codyLorentzDielectric(wavelengthNm, { ...componentParameters, epsilonInf: 1 }), true);
    else if (component === "drude") add(drudeDielectric(wavelengthNm, componentParameters.plasmaEnergyEv, componentParameters.gammaEv));
    else if (component === "drudeSmith") add(drudeSmithDielectric(wavelengthNm, componentParameters.plasmaEnergyEv, componentParameters.gammaEv, componentParameters.backscattering));
    else if (component === "brendelBormann") add(brendelBormannDielectric(wavelengthNm, componentParameters));
    else if (component === "criticalPoint") add(criticalPointDielectric(wavelengthNm, componentParameters));
    else throw new Error(`Unsupported dielectric component: ${component}.`);
  }
  return { epsilon1, epsilon2 };
}

export function lorentzOscillatorDielectric(wavelengthNm, strength, resonanceEv, gammaEv) {
  validatePositiveWavelengths(wavelengthNm);
  if (![strength, resonanceEv, gammaEv].every((value) => Number.isFinite(value) && value > 0)) throw new Error("Lorentz strength, resonance, and damping must be finite and positive.");
  const epsilon1 = []; const epsilon2 = [];
  for (const wavelength of wavelengthNm) {
    const energy = PHOTON_ENERGY_EV_NM / wavelength;
    const denominator = (resonanceEv ** 2 - energy ** 2) ** 2 + gammaEv ** 2 * energy ** 2;
    epsilon1.push(strength * resonanceEv ** 2 * (resonanceEv ** 2 - energy ** 2) / denominator);
    epsilon2.push(strength * resonanceEv ** 2 * gammaEv * energy / denominator);
  }
  return { epsilon1, epsilon2 };
}

export function drudeSmithDielectric(wavelengthNm, plasmaEnergyEv, gammaEv, backscattering) {
  if (!Number.isFinite(backscattering) || backscattering < -1 || backscattering > 0) throw new Error("Drude–Smith c₁ must be from −1 to 0.");
  const drude = drudeDielectric(wavelengthNm, plasmaEnergyEv, gammaEv);
  const epsilon1 = []; const epsilon2 = [];
  wavelengthNm.forEach((wavelength, index) => {
    const energy = PHOTON_ENERGY_EV_NM / wavelength;
    const denominator = gammaEv ** 2 + energy ** 2;
    const correction = { re: 1 + backscattering * gammaEv ** 2 / denominator, im: backscattering * gammaEv * energy / denominator };
    const value = dielectricComplexMul({ re: drude.epsilon1[index], im: drude.epsilon2[index] }, correction);
    epsilon1.push(value.re); epsilon2.push(value.im);
  });
  return { epsilon1, epsilon2 };
}

const HERMITE_NODES = [-3.436159118837738, -2.53273167423279, -1.756683649299882, -1.036610829789514, -0.342901327223705, 0.342901327223705, 1.036610829789514, 1.756683649299882, 2.53273167423279, 3.436159118837738];
const HERMITE_WEIGHTS = [0.000007640432856, 0.001343645746781, 0.033874394455481, 0.240138611082315, 0.610862633735326, 0.610862633735326, 0.240138611082315, 0.033874394455481, 0.001343645746781, 0.000007640432856];

export function brendelBormannDielectric(wavelengthNm, parameters) {
  const { strength, resonanceEv, gammaEv, sigmaEv } = parameters;
  if (![strength, resonanceEv, gammaEv, sigmaEv].every((value) => Number.isFinite(value) && value > 0)) throw new Error("Brendel–Bormann parameters must be finite and positive.");
  const samples = HERMITE_NODES.map((node, index) => ({ resonance: resonanceEv + Math.SQRT2 * sigmaEv * node, weight: HERMITE_WEIGHTS[index] / Math.sqrt(Math.PI) })).filter((sample) => sample.resonance > 0);
  const normalization = samples.reduce((sum, sample) => sum + sample.weight, 0);
  const epsilon1 = wavelengthNm.map(() => 0); const epsilon2 = wavelengthNm.map(() => 0);
  for (const sample of samples) {
    const dielectric = lorentzOscillatorDielectric(wavelengthNm, strength, sample.resonance, gammaEv);
    dielectric.epsilon1.forEach((value, index) => { epsilon1[index] += value * sample.weight / normalization; epsilon2[index] += dielectric.epsilon2[index] * sample.weight / normalization; });
  }
  return { epsilon1, epsilon2 };
}

export function criticalPointDielectric(wavelengthNm, parameters) {
  const { amplitude, energyEv, broadeningEv } = parameters;
  if (![amplitude, energyEv, broadeningEv].every((value) => Number.isFinite(value) && value > 0)) throw new Error("Critical-point parameters must be finite and positive.");
  const epsilon1 = []; const epsilon2 = [];
  for (const wavelength of wavelengthNm) {
    const energy = PHOTON_ENERGY_EV_NM / wavelength;
    const normalized = { re: energy / energyEv, im: broadeningEv / energyEv };
    const argument = dielectricComplexSub({ re: 1, im: 0 }, dielectricComplexMul(normalized, normalized));
    const value = dielectricComplexScale(dielectricComplexLog(argument), -amplitude);
    epsilon1.push(value.re); epsilon2.push(value.im);
  }
  return { epsilon1, epsilon2 };
}

export function cauchyRefractiveIndex(wavelengthNm, parameters) {
  validatePositiveWavelengths(wavelengthNm);
  if (![parameters.cauchyA, parameters.cauchyBUm2, parameters.cauchyCUm4, parameters.urbachK0, parameters.urbachReferenceEv, parameters.urbachEnergyEv].every(Number.isFinite)
    || parameters.cauchyA <= 0 || parameters.urbachK0 < 0 || parameters.urbachEnergyEv <= 0) throw new Error("Invalid Cauchy–Urbach parameters.");
  const n = []; const k = [];
  for (const wavelength of wavelengthNm) {
    const wavelengthUm = wavelength / 1000;
    const index = parameters.cauchyA + parameters.cauchyBUm2 / wavelengthUm ** 2 + parameters.cauchyCUm4 / wavelengthUm ** 4;
    const extinction = parameters.urbachK0 * Math.exp(Math.min(100, (PHOTON_ENERGY_EV_NM / wavelength - parameters.urbachReferenceEv) / parameters.urbachEnergyEv));
    if (!(index > 0) || !Number.isFinite(extinction)) throw new Error("Cauchy–Urbach produced non-physical optical constants.");
    n.push(index); k.push(extinction);
  }
  return { n, k };
}

export function sellmeierRefractiveIndex(wavelengthNm, parameters) {
  validatePositiveWavelengths(wavelengthNm);
  const coefficients = [1, 2, 3].map((index) => [parameters[`sellmeierB${index}`], parameters[`sellmeierC${index}Um2`]]);
  if (!coefficients.flat().every(Number.isFinite) || coefficients.some(([b, c]) => b < 0 || c <= 0)) throw new Error("Sellmeier coefficients must be finite with B ≥ 0 and C > 0.");
  const n = wavelengthNm.map((wavelength) => {
    const square = (wavelength / 1000) ** 2;
    const indexSquared = 1 + coefficients.reduce((sum, [b, c]) => sum + b * square / (square - c), 0);
    if (!(indexSquared > 0) || coefficients.some(([, c]) => Math.abs(square - c) < 1e-10)) throw new Error("A Sellmeier pole lies in the calculation range.");
    return Math.sqrt(indexSquared);
  });
  return { n, k: wavelengthNm.map(() => 0) };
}

export function forouhiBloomerRefractiveIndex(wavelengthNm, parameters) {
  validatePositiveWavelengths(wavelengthNm);
  const { nInfinity, amplitudeEv, bEv, cEv2, bandgapEv } = parameters;
  if (![nInfinity, amplitudeEv, bEv, cEv2, bandgapEv].every(Number.isFinite) || nInfinity < 1 || amplitudeEv <= 0 || bandgapEv < 0 || 4 * cEv2 <= bEv ** 2) throw new Error("Forouhi–Bloomer requires n∞ ≥ 1, A > 0, E_g ≥ 0, and 4C > B².");
  const q = 0.5 * Math.sqrt(4 * cEv2 - bEv ** 2);
  const b0 = amplitudeEv / q * (-(bEv ** 2) / 2 + bandgapEv * bEv - bandgapEv ** 2 + cEv2);
  const c0 = amplitudeEv / q * ((bandgapEv ** 2 + cEv2) * bEv / 2 - 2 * bandgapEv * cEv2);
  const n = []; const k = [];
  for (const wavelength of wavelengthNm) {
    const energy = PHOTON_ENERGY_EV_NM / wavelength;
    const denominator = energy ** 2 - bEv * energy + cEv2;
    n.push(nInfinity + (b0 * energy + c0) / denominator);
    k.push(energy > bandgapEv ? amplitudeEv * (energy - bandgapEv) ** 2 / denominator : 0);
  }
  if (n.some((value) => !(value > 0)) || k.some((value) => value < 0 || !Number.isFinite(value))) throw new Error("Forouhi–Bloomer produced non-physical optical constants.");
  return { n, k };
}

export function effectiveMediumRefractiveIndex(wavelengthNm, parameters, ema) {
  if (!ema?.hostNk || !ema?.inclusionNk || !new Set(["bruggeman", "maxwell-garnett"]).has(ema.method)) throw new Error("EMA requires host and inclusion n,k tables and a supported mixing rule.");
  const fraction = parameters.volumeFraction;
  if (!Number.isFinite(fraction) || fraction < 0 || fraction > 1) throw new Error("EMA volume fraction must be from 0 to 1.");
  const host = tabulatedRefractiveIndex(ema.hostNk, wavelengthNm); const inclusion = tabulatedRefractiveIndex(ema.inclusionNk, wavelengthNm);
  const epsilon1 = []; const epsilon2 = [];
  wavelengthNm.forEach((_, index) => {
    const hostEpsilon = indexToDielectric(host.n[index], host.k[index]); const inclusionEpsilon = indexToDielectric(inclusion.n[index], inclusion.k[index]);
    let effective;
    if (ema.method === "maxwell-garnett") {
      const numerator = dielectricComplexAdd(dielectricComplexAdd(inclusionEpsilon, dielectricComplexScale(hostEpsilon, 2)), dielectricComplexScale(dielectricComplexSub(inclusionEpsilon, hostEpsilon), 2 * fraction));
      const denominator = dielectricComplexSub(dielectricComplexAdd(inclusionEpsilon, dielectricComplexScale(hostEpsilon, 2)), dielectricComplexScale(dielectricComplexSub(inclusionEpsilon, hostEpsilon), fraction));
      effective = dielectricComplexMul(hostEpsilon, dielectricComplexDiv(numerator, denominator));
    } else {
      const linear = dielectricComplexAdd(dielectricComplexScale(hostEpsilon, 2 - 3 * fraction), dielectricComplexScale(inclusionEpsilon, 3 * fraction - 1));
      const discriminant = dielectricComplexAdd(dielectricComplexMul(linear, linear), dielectricComplexScale(dielectricComplexMul(hostEpsilon, inclusionEpsilon), 8));
      const root = dielectricComplexSqrt(discriminant);
      const candidates = [root, dielectricComplexScale(root, -1)].map((value) => dielectricComplexScale(dielectricComplexAdd(linear, value), 0.25));
      const mixture = dielectricComplexAdd(dielectricComplexScale(hostEpsilon, 1 - fraction), dielectricComplexScale(inclusionEpsilon, fraction));
      effective = candidates.filter((candidate) => candidate.im >= -1e-12).sort((a, b) => dielectricComplexDistance(a, mixture) - dielectricComplexDistance(b, mixture))[0];
      if (!effective) throw new Error("Bruggeman EMA has no passive physical branch for these constituents.");
    }
    epsilon1.push(effective.re); epsilon2.push(effective.im);
  });
  return passiveRefractiveIndex({ epsilon1, epsilon2 });
}

const KK_SPLINE_ENERGIES_EV = [0.5, 1.625, 2.75, 3.875, 5];
const kkSplineCache = new WeakMap();

export function kkSplineDielectric(wavelengthNm, parameters) {
  validatePositiveWavelengths(wavelengthNm);
  if (!(parameters.epsilonInf > 0)) throw new Error("KK B-spline ε∞ must be positive.");
  const amplitudes = KK_SPLINE_ENERGIES_EV.map((_, index) => parameters[`splineEpsilon2_${index + 1}`]);
  if (!amplitudes.every((value) => Number.isFinite(value) && value >= 0)) throw new Error("KK B-spline ε₂ knots must be finite and non-negative.");
  let basis = kkSplineCache.get(wavelengthNm);
  if (!basis) { basis = precomputeKkSplineBasis(wavelengthNm); kkSplineCache.set(wavelengthNm, basis); }
  return {
    epsilon1: wavelengthNm.map((_, row) => parameters.epsilonInf + amplitudes.reduce((sum, amplitude, column) => sum + amplitude * basis.real[column][row], 0)),
    epsilon2: wavelengthNm.map((_, row) => amplitudes.reduce((sum, amplitude, column) => sum + amplitude * basis.imaginary[column][row], 0)),
  };
}

function precomputeKkSplineBasis(wavelengthNm) {
  const step = KK_SPLINE_ENERGIES_EV[1] - KK_SPLINE_ENERGIES_EV[0];
  const cubic = (energy, center) => { const distance = Math.abs((energy - center) / step); return distance < 1 ? 2 / 3 - distance ** 2 + distance ** 3 / 2 : distance < 2 ? (2 - distance) ** 3 / 6 : 0; };
  const maximum = 30; const bins = 800; const delta = maximum / bins; const integrationEnergy = Array.from({ length: bins }, (_, index) => (index + 0.5) * delta);
  const energies = wavelengthNm.map((wavelength) => PHOTON_ENERGY_EV_NM / wavelength);
  const real = []; const imaginary = [];
  for (const center of KK_SPLINE_ENERGIES_EV) {
    const basisAtGrid = integrationEnergy.map((energy) => cubic(energy, center));
    imaginary.push(energies.map((energy) => cubic(energy, center)));
    real.push(energies.map((energy) => {
      const fAtEnergy = energy * cubic(energy, center);
      let integral = 0;
      integrationEnergy.forEach((value, index) => {
        const denominator = value ** 2 - energy ** 2;
        if (Math.abs(denominator) > 1e-8) integral += delta * (value * basisAtGrid[index] - fAtEnergy) / denominator;
      });
      integral += fAtEnergy / (2 * energy) * Math.log(Math.abs((maximum - energy) / (maximum + energy)));
      return 2 / Math.PI * integral;
    }));
  }
  return { real, imaginary };
}

function indexToDielectric(n, k) { return { re: n ** 2 - k ** 2, im: 2 * n * k }; }
function dielectricComplexAdd(a, b) { return { re: a.re + b.re, im: a.im + b.im }; }
function dielectricComplexSub(a, b) { return { re: a.re - b.re, im: a.im - b.im }; }
function dielectricComplexScale(a, scale) { return { re: a.re * scale, im: a.im * scale }; }
function dielectricComplexMul(a, b) { return { re: a.re * b.re - a.im * b.im, im: a.re * b.im + a.im * b.re }; }
function dielectricComplexDiv(a, b) { const denominator = b.re ** 2 + b.im ** 2; return { re: (a.re * b.re + a.im * b.im) / denominator, im: (a.im * b.re - a.re * b.im) / denominator }; }
function dielectricComplexSqrt(value) { const magnitude = Math.hypot(value.re, value.im); return { re: Math.sqrt(Math.max(0, (magnitude + value.re) / 2)), im: Math.sign(value.im || 1) * Math.sqrt(Math.max(0, (magnitude - value.re) / 2)) }; }
function dielectricComplexLog(value) { return { re: Math.log(Math.hypot(value.re, value.im)), im: Math.atan2(value.im, value.re) }; }
function dielectricComplexDistance(a, b) { return Math.hypot(a.re - b.re, a.im - b.im); }

export function tabulatedRefractiveIndex(nk, wavelengthNm) {
  if (!nk?.wavelengthNm?.length || nk.wavelengthNm.length !== nk.n?.length || nk.n.length !== nk.k?.length) throw new Error("Invalid ellipsometry n,k table.");
  return { n: interpolate(nk.wavelengthNm, nk.n, wavelengthNm), k: interpolate(nk.wavelengthNm, nk.k, wavelengthNm) };
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
  const drude = drudeDielectric(wavelengthNm, parameters.plasmaEnergyEv, parameters.drudeGammaEv);
  return {
    epsilon1: interband.epsilon1.map((value, index) => value + drude.epsilon1[index]),
    epsilon2: interband.epsilon2.map((value, index) => value + drude.epsilon2[index]),
  };
}

export function drudeDielectric(wavelengthNm, plasmaEnergyEv, gammaEv) {
  validatePositiveWavelengths(wavelengthNm);
  if (!(plasmaEnergyEv > 0) || !(gammaEv > 0)) throw new Error("Drude plasma energy and γ must be finite and positive.");
  const epsilon1 = [];
  const epsilon2 = [];
  wavelengthNm.forEach((wavelength) => {
    const energy = PHOTON_ENERGY_EV_NM / wavelength;
    const denominator = energy ** 4 + gammaEv ** 2 * energy ** 2;
    epsilon1.push(-(plasmaEnergyEv ** 2) * energy ** 2 / denominator);
    epsilon2.push(plasmaEnergyEv ** 2 * gammaEv * energy / denominator);
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
