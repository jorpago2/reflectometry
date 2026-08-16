import {
  MODEL_LABELS,
  type DielectricComponents,
  type NkTable,
  type NumericParameters,
  type OpticalModel,
} from "../models/dielectric-models.ts";

type JsonObject = Record<string, unknown>;
type SavedControl = boolean | string;
export type SavedParameterSetting = {
  minimum: number;
  maximum: number;
  fit: boolean;
  uncertainty: string | null;
};
export type SavedParameterSettings = Record<string, SavedParameterSetting>;

export type SavedFitLayer = {
  id: string;
  name: string;
  opticalModel: OpticalModel;
  dielectricComponents: DielectricComponents | null;
  effectiveMedium: {
    method: "bruggeman" | "maxwell-garnett";
    hostSource: string | null;
    inclusionSource: string | null;
    hostNk: NkTable | null;
    inclusionNk: NkTable | null;
  } | null;
  nkSource: string | null;
  nkTable: NkTable | null;
  regularizedToNk: boolean;
  parameters: NumericParameters;
  parameterSettings: SavedParameterSettings;
  parameterLinks: Record<string, string>;
};

export type SavedSpectrum = {
  wavelengthNm: number[];
  sampleReflectanceCounts: number[];
  sampleTransmittanceCounts: number[];
  reflectanceReferenceCounts: number[];
  transmittanceReferenceCounts: number[];
  referenceReflectance: number[];
  sampleName: string;
};

export const SAVED_FIT_SCHEMA = "reflectometry-browser-fit/v8";
const SUPPORTED_SCHEMAS = new Set(["reflectometry-browser-fit/v5", "reflectometry-browser-fit/v6", "reflectometry-browser-fit/v7", SAVED_FIT_SCHEMA]);
const BOOLEAN_CONTROLS = new Set(["subtract-background", "use-r", "use-t", "prefer-shape", "fit-r-gain", "fit-t-gain"]);
const CONTROL_RANGES = {
  "wavelength-min": [195, 3000], "wavelength-max": [196, 3000], "reference-threshold": [0, 99], "bin-width": [0.1, 100], "sample-snr": [0, 100],
  "sigma-r": [0.0001, 1], "sigma-t": [0.0001, 1], "sigma-n": [0.0001, 10], "sigma-k": [0.0001, 10], "r-gain": [0.1, 10], "t-gain": [0.1, 10],
  "screening-points": [64, 4096], "local-refinements": [1, 50], "bootstrap-samples": [5, 200],
};

function object(value: unknown, name: string): JsonObject {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(`${name} is missing or invalid.`);
  return value as JsonObject;
}

function finite(value: unknown, name: string): number {
  if (typeof value !== "number" || !Number.isFinite(value)) throw new Error(`${name} must be a finite number.`);
  return value;
}

function numericArray(value: unknown, name: string, allowNull = false): number[] {
  if (!Array.isArray(value) || !value.length) throw new Error(`${name} must be a non-empty array.`);
  return value.map((entry, index) => {
    if (allowNull && entry === null) return Number.NaN;
    return finite(entry, `${name}[${index}]`);
  });
}

function table(value: unknown, name: string): NkTable | null {
  if (value == null) return null;
  const source = object(value, name);
  const wavelengthNm = numericArray(source.wavelengthNm, `${name}.wavelengthNm`);
  const n = numericArray(source.n, `${name}.n`);
  const k = numericArray(source.k, `${name}.k`);
  if (wavelengthNm.length < 2 || n.length !== wavelengthNm.length || k.length !== wavelengthNm.length) throw new Error(`${name} arrays must have the same length.`);
  if (wavelengthNm.some((entry) => !(entry > 0)) || wavelengthNm.some((entry, index) => index && entry <= wavelengthNm[index - 1]) || n.some((entry) => entry <= 0) || k.some((entry) => entry < 0)) throw new Error(`${name} must contain positive, increasing wavelengths, positive n, and non-negative k values.`);
  return { wavelengthNm, n, k };
}

function spectrum(value: unknown): SavedSpectrum | null {
  if (value == null) return null;
  const source = object(value, "measurement.spectrum");
  const result: SavedSpectrum = {
    wavelengthNm: numericArray(source.wavelengthNm, "measurement.spectrum.wavelengthNm"),
    sampleReflectanceCounts: numericArray(source.sampleReflectanceCounts, "measurement.spectrum.sampleReflectanceCounts"),
    sampleTransmittanceCounts: numericArray(source.sampleTransmittanceCounts, "measurement.spectrum.sampleTransmittanceCounts"),
    reflectanceReferenceCounts: numericArray(source.reflectanceReferenceCounts, "measurement.spectrum.reflectanceReferenceCounts"),
    transmittanceReferenceCounts: numericArray(source.transmittanceReferenceCounts, "measurement.spectrum.transmittanceReferenceCounts"),
    referenceReflectance: numericArray(source.referenceReflectance, "measurement.spectrum.referenceReflectance", true),
    sampleName: typeof source.sampleName === "string" ? source.sampleName.slice(0, 80) : "Saved measurement",
  };
  const length = result.wavelengthNm.length;
  const channels = [result.sampleReflectanceCounts, result.sampleTransmittanceCounts, result.reflectanceReferenceCounts, result.transmittanceReferenceCounts, result.referenceReflectance];
  if (length < 20 || channels.some((channel) => channel.length !== length)) throw new Error("Saved measurement arrays must have the same length and at least 20 points.");
  if (result.wavelengthNm.some((entry) => !(entry > 0)) || result.wavelengthNm.some((entry, index) => index && entry <= result.wavelengthNm[index - 1])) throw new Error("Saved measurement wavelengths must be positive and strictly increasing.");
  if (result.wavelengthNm.filter((entry) => entry >= 195 && entry <= 250).length < 20) throw new Error("The saved measurement needs at least 20 background points from 195 to 250 nm.");
  return result;
}

function numberRecord(value: unknown, name: string): NumericParameters {
  const source = object(value, name);
  return Object.fromEntries(Object.entries(source).map(([key, entry]) => [key, finite(entry, `${name}.${key}`)]));
}

function parameterSettings(value: unknown): SavedParameterSettings {
  if (value == null) return {};
  const source = object(value, "parameterSettings");
  return Object.fromEntries(Object.entries(source).map(([name, setting]) => {
    const item = object(setting, `parameterSettings.${name}`);
    const minimum = finite(item.minimum, `parameterSettings.${name}.minimum`);
    const maximum = finite(item.maximum, `parameterSettings.${name}.maximum`);
    if (minimum >= maximum) throw new Error(`parameterSettings.${name} has invalid bounds.`);
    if (item.fit !== undefined && typeof item.fit !== "boolean") throw new Error(`parameterSettings.${name}.fit must be true or false.`);
    return [name, { minimum, maximum, fit: item.fit === true, uncertainty: typeof item.uncertainty === "string" ? item.uncertainty.slice(0, 40) : null }];
  }));
}

function controlRecord(value: unknown): Record<string, SavedControl> {
  if (value == null) return {};
  const source = object(value, "controls"); const result: Record<string, SavedControl> = {};
  for (const name of BOOLEAN_CONTROLS) if (Object.hasOwn(source, name)) {
    if (typeof source[name] !== "boolean") throw new Error(`controls.${name} must be true or false.`);
    result[name] = source[name];
  }
  for (const [name, [minimum, maximum]] of Object.entries(CONTROL_RANGES)) if (Object.hasOwn(source, name)) {
    const number = Number(source[name]);
    if (!Number.isFinite(number) || number < minimum || number > maximum) throw new Error(`controls.${name} is outside the supported range.`);
    if ((name === "screening-points" && (!Number.isInteger(number) || (number & (number - 1)))) || (["local-refinements", "bootstrap-samples"].includes(name) && !Number.isInteger(number))) throw new Error(`controls.${name} is invalid.`);
    result[name] = String(source[name]);
  }
  if (Number(result["wavelength-min"]) >= Number(result["wavelength-max"])) throw new Error("The saved wavelength range is invalid.");
  if (result["use-r"] === false && result["use-t"] === false) throw new Error("The saved fit has no active measurement channel.");
  return result;
}

function isOpticalModel(value: unknown): value is OpticalModel {
  return typeof value === "string" && Object.hasOwn(MODEL_LABELS, value);
}

function componentRecord(value: unknown, name: string): DielectricComponents | null {
  if (value == null) return null;
  return object(value, name) as DielectricComponents;
}

export function parseSavedFit(text: string) {
  let parsed: unknown;
  try { parsed = JSON.parse(text); } catch { throw new Error("The selected file is not valid JSON."); }
  const payload = object(parsed, "Saved fit");
  if (typeof payload.schema !== "string" || !SUPPORTED_SCHEMAS.has(payload.schema)) throw new Error("Unsupported saved-fit schema. Expected reflectometry-browser-fit/v5 through v8.");
  if (!Array.isArray(payload.stack) || !payload.stack.length || payload.stack.length > 12) throw new Error("The saved stack must contain 1 to 12 layers.");
  const ids = new Set<string>();
  const stack: SavedFitLayer[] = payload.stack.map((entry, index) => {
    const layer = object(entry, `stack[${index}]`);
    if (!isOpticalModel(layer.opticalModel)) throw new Error(`stack[${index}] uses an unsupported optical model.`);
    const id = typeof layer.id === "string" && /^[A-Za-z][A-Za-z0-9_-]{0,49}$/.test(layer.id) ? layer.id : `layer${index + 1}`;
    if (ids.has(id)) throw new Error(`Duplicate layer id: ${id}.`); ids.add(id);
    const effective = layer.effectiveMedium == null ? null : object(layer.effectiveMedium, `stack[${index}].effectiveMedium`);
    const parameters = numberRecord(layer.parameters, `stack[${index}].parameters`);
    if (!(parameters.thicknessNm > 0)) throw new Error(`stack[${index}].parameters.thicknessNm must be positive.`);
    const settings = parameterSettings(layer.parameterSettings);
    for (const [name, setting] of Object.entries(settings)) if (Number.isFinite(parameters[name]) && (parameters[name] < setting.minimum || parameters[name] > setting.maximum)) throw new Error(`stack[${index}].parameters.${name} lies outside its saved bounds.`);
    return {
      id,
      name: typeof layer.name === "string" ? layer.name.slice(0, 60) : `Layer ${index + 1}`,
      opticalModel: layer.opticalModel,
      dielectricComponents: componentRecord(layer.dielectricComponents, `stack[${index}].dielectricComponents`),
      effectiveMedium: effective ? {
        method: effective.method === "maxwell-garnett" ? effective.method : "bruggeman",
        hostSource: typeof effective.hostSource === "string" ? effective.hostSource : null,
        inclusionSource: typeof effective.inclusionSource === "string" ? effective.inclusionSource : null,
        hostNk: table(effective.hostNk, `stack[${index}].effectiveMedium.hostNk`),
        inclusionNk: table(effective.inclusionNk, `stack[${index}].effectiveMedium.inclusionNk`),
      } : null,
      nkSource: typeof layer.nkSource === "string" ? layer.nkSource : null,
      nkTable: table(layer.nkTable, `stack[${index}].nkTable`),
      regularizedToNk: Boolean(layer.regularizedToNk),
      parameters,
      parameterSettings: settings,
      parameterLinks: layer.parameterLinks && typeof layer.parameterLinks === "object" ? Object.fromEntries(Object.entries(layer.parameterLinks).filter((entry): entry is [string, string] => Object.hasOwn(parameters, entry[0]) && typeof entry[1] === "string" && entry[1].includes("__"))) : {},
    };
  });
  const substrate = object(payload.substrate, "substrate");
  const substrateIndex = object(substrate.refractiveIndex, "substrate.refractiveIndex");
  const thicknessUm = substrate.thicknessUm ?? finite(substrate.thicknessNm, "substrate.thicknessNm") / 1000;
  const gains = object(payload.gains, "gains");
  const controls = controlRecord(payload.controls);
  const parsedSubstrate = { n: finite(substrateIndex.n, "substrate.refractiveIndex.n"), k: finite(substrateIndex.k ?? 0, "substrate.refractiveIndex.k"), thicknessUm: finite(thicknessUm, "substrate.thicknessUm"), incidence: substrate.incidence === "substrate" ? "substrate" : "film" };
  const parsedGains = { reflectance: finite(gains.reflectance, "gains.reflectance"), transmittance: finite(gains.transmittance, "gains.transmittance") };
  if (!(parsedSubstrate.n > 0) || parsedSubstrate.k < 0 || parsedSubstrate.thicknessUm < 10 || !Object.values(parsedGains).every((value) => value >= 0.1 && value <= 10)) throw new Error("Saved substrate or gain values are outside the supported range.");
  if (payload.schema === SAVED_FIT_SCHEMA && !isOpticalModel(substrate.opticalModel)) throw new Error("substrate uses an unsupported optical model.");
  const substrateOpticalModel: OpticalModel = isOpticalModel(substrate.opticalModel) ? substrate.opticalModel : "constant";
  const substrateParameters = payload.schema === SAVED_FIT_SCHEMA && substrate.parameters ? numberRecord(substrate.parameters, "substrate.parameters") : { n: parsedSubstrate.n, k: parsedSubstrate.k };
  const substrateParameterSettings = payload.schema === SAVED_FIT_SCHEMA ? parameterSettings(substrate.parameterSettings) : {};
  for (const [name, setting] of Object.entries(substrateParameterSettings)) if (Number.isFinite(substrateParameters[name]) && (substrateParameters[name] < setting.minimum || substrateParameters[name] > setting.maximum)) throw new Error(`substrate.parameters.${name} lies outside its saved bounds.`);
  const substrateEffective = substrate.effectiveMedium == null ? null : object(substrate.effectiveMedium, "substrate.effectiveMedium");
  const measurement = payload.measurement == null ? null : object(payload.measurement, "measurement");
  return {
    schema: payload.schema,
    stack,
    activeLayerId: typeof payload.activeLayerId === "string" && ids.has(payload.activeLayerId) ? payload.activeLayerId : stack[0].id,
    substrate: parsedSubstrate,
    substrateMaterial: payload.schema === SAVED_FIT_SCHEMA ? {
      opticalModel: substrateOpticalModel,
      dielectricComponents: componentRecord(substrate.dielectricComponents, "substrate.dielectricComponents"),
      effectiveMedium: substrateEffective ? {
        method: substrateEffective.method === "maxwell-garnett" ? "maxwell-garnett" : "bruggeman",
        hostSource: typeof substrateEffective.hostSource === "string" ? substrateEffective.hostSource : null,
        inclusionSource: typeof substrateEffective.inclusionSource === "string" ? substrateEffective.inclusionSource : null,
        hostNk: table(substrateEffective.hostNk, "substrate.effectiveMedium.hostNk"),
        inclusionNk: table(substrateEffective.inclusionNk, "substrate.effectiveMedium.inclusionNk"),
      } : null,
      nkSource: typeof substrate.nkSource === "string" ? substrate.nkSource : null,
      nkTable: table(substrate.nkTable, "substrate.nkTable"),
      regularizedToNk: Boolean(substrate.regularizedToNk),
      parameters: substrateParameters,
      parameterSettings: substrateParameterSettings,
    } : null,
    gains: parsedGains,
    spectrum: spectrum(measurement?.spectrum),
    controls,
    source: payload.source && typeof payload.source === "object" ? payload.source as JsonObject : null,
    diagnostics: payload.diagnostics && typeof payload.diagnostics === "object" ? payload.diagnostics as JsonObject : null,
    optimizer: payload.optimizer && typeof payload.optimizer === "object" ? payload.optimizer as JsonObject : null,
  };
}

export type ParsedSavedFit = ReturnType<typeof parseSavedFit>;
