import {
  MODEL_LABELS,
  modelParameterSpecs,
  type DielectricComponents,
  type EffectiveMedium,
  type NkTable,
  type NumericParameters,
  type OpticalModel,
  type ParameterSpecifications,
} from "../scientific/models/dielectric-models.ts";
import { parseSavedFit, SAVED_FIT_SCHEMA, type ParsedSavedFit } from "../scientific/fitting/saved-fit.ts";
import {
  createSpectrum,
  createSyntheticSpectrum,
  diagnosticsOf,
  evaluateOpticalModel,
  loadNkTable,
  prepareFitData,
  restrictToNkRange,
} from "../scientific/solvers/scientific-core.ts";
import type {
  AlternativeSolution,
  ConfidenceInterval,
  FitConfiguration,
  FitData,
  FitDiagnostics,
  OpticalEvaluation,
  OpticalSettings,
  ParameterCorrelation,
  Spectrum,
} from "../scientific/solvers/scientific-core.ts";
import type { ReflectometryPhase } from "../app/operation-status.ts";

export const MULTILAYER_MODEL_LABELS = {
  fixed: MODEL_LABELS.fixed,
  scaled: MODEL_LABELS.scaled,
  constant: MODEL_LABELS.constant,
  composite: "Independent dielectric components",
  cauchy: MODEL_LABELS.cauchy,
  sellmeier: MODEL_LABELS.sellmeier,
  "forouhi-bloomer": MODEL_LABELS["forouhi-bloomer"],
  "kk-spline": MODEL_LABELS["kk-spline"],
  ema: MODEL_LABELS.ema,
} as const satisfies Partial<Record<OpticalModel, string>>;

export const COMPONENT_LABELS = {
  gaussian: "Gaussian",
  cody: "Cody–Lorentz",
  drude: "Drude",
  drudeSmith: "Drude–Smith",
  brendelBormann: "Brendel–Bormann",
  criticalPoint: "Critical point / Adachi",
} as const;

export type MaterialComponents = DielectricComponents & {
  taucLorentz: number;
  lorentz: number;
  gaussian: boolean;
  cody: boolean;
  drude: boolean;
  drudeSmith: boolean;
  brendelBormann: boolean;
  criticalPoint: boolean;
};

const DEFAULT_COMPONENTS: MaterialComponents = {
  taucLorentz: 1,
  lorentz: 0,
  gaussian: false,
  cody: false,
  drude: false,
  drudeSmith: false,
  brendelBormann: false,
  criticalPoint: false,
};
const TABLE_MODELS = new Set<OpticalModel>(["fixed", "scaled"]);

export type MaterialEma = EffectiveMedium & {
  hostSource: string | null;
  inclusionSource: string | null;
};

export interface OpticalMaterial {
  id: string;
  name: string;
  model: OpticalModel;
  components: MaterialComponents;
  ema: MaterialEma;
  nk: NkTable | null;
  nkSource: string | null;
  regularize: boolean;
  links: Record<string, string>;
  specs: ParameterSpecifications;
  specCache: ParameterSpecifications;
}

export interface SourceInfo extends Record<string, unknown> {
  sampleName?: string;
  type?: string;
}

export interface BootstrapInterval extends ConfidenceInterval {
  median: number;
}

export interface BootstrapResult {
  requestedSamples: number;
  successfulSamples: number;
  seed: number;
  method: string;
  evidenceMode: string;
  parameterIntervals: Record<string, BootstrapInterval>;
  parameterCorrelation: ParameterCorrelation;
  bands: {
    wavelengthNm: number[];
    reflectance: BootstrapInterval[];
    transmittance: BootstrapInterval[];
    layerId?: string | null;
    n: BootstrapInterval[];
    k: BootstrapInterval[];
    layers: Record<string, { n: BootstrapInterval[]; k: BootstrapInterval[] }>;
  };
}

export type RuntimeDiagnostics = FitDiagnostics & { bootstrap?: BootstrapResult | null };
export type RuntimeOptimizer = {
  selectedSolver: { success: boolean; message: string; evaluations: number; optimality: number | null };
  logarithmicallySampledParameters?: string[];
  [name: string]: unknown;
};
export interface RuntimeFitResult {
  parameters: NumericParameters;
  evaluation: OpticalEvaluation;
  diagnostics: RuntimeDiagnostics;
  optimizer?: RuntimeOptimizer;
  preview: boolean;
  configuration: FitConfiguration;
  cost?: number;
}

export interface EditorSnapshot extends Record<string, unknown> {
  source: SourceInfo | null;
  spectrum: Spectrum | null;
  layers: OpticalMaterial[];
  substrate: OpticalMaterial;
  activeLayerId: string | null;
  nextLayer: number;
  controls: Record<string, boolean | number | string>;
}

type FitWorkerMessage =
  | { type: "progress" | "bootstrap-progress"; progress: number }
  | { type: "bootstrap-result"; result: BootstrapResult }
  | { type: "error"; message: string }
  | { type: "result"; result: Omit<RuntimeFitResult, "preview" | "configuration"> };

export interface ReflectometryControls {
  sampleName: string;
  wavelengthMinNm: number;
  wavelengthMaxNm: number;
  referenceThresholdPercent: number;
  binWidthNm: number;
  sampleSnrMinimum: number;
  subtractBackground: boolean;
  substrateThicknessUm: number;
  incidence: "film" | "substrate";
  useReflectance: boolean;
  useTransmittance: boolean;
  preferSpectralShape: boolean;
  sigmaReflectance: number;
  sigmaTransmittance: number;
  sigmaN: number;
  sigmaK: number;
  fitReflectanceGain: boolean;
  fitTransmittanceGain: boolean;
  reflectanceGain: number;
  transmittanceGain: number;
  screeningPoints: number;
  localRefinements: number;
  bootstrapSamples: number;
}

export type ProcessingControlErrors = Partial<Record<
  "wavelengthMinNm" | "wavelengthMaxNm" | "referenceThresholdPercent" | "binWidthNm" | "sampleSnrMinimum",
  string
>>;

export function getProcessingControlErrors(controls: Pick<
  ReflectometryControls,
  "wavelengthMinNm" | "wavelengthMaxNm" | "referenceThresholdPercent" | "binWidthNm" | "sampleSnrMinimum"
>): ProcessingControlErrors {
  const errors: ProcessingControlErrors = {};
  const within = (value: number, minimum: number, maximum: number) => Number.isFinite(value) && value >= minimum && value <= maximum;
  if (!within(controls.wavelengthMinNm, 195, 2500)) errors.wavelengthMinNm = "Enter a minimum wavelength from 195 to 2500 nm.";
  if (!within(controls.wavelengthMaxNm, 200, 3000)) errors.wavelengthMaxNm = "Enter a maximum wavelength from 200 to 3000 nm.";
  if (!errors.wavelengthMinNm && !errors.wavelengthMaxNm && controls.wavelengthMinNm >= controls.wavelengthMaxNm) {
    const message = "Minimum wavelength must be lower than maximum wavelength.";
    errors.wavelengthMinNm = message;
    errors.wavelengthMaxNm = message;
  }
  if (!within(controls.referenceThresholdPercent, 0, 99)) errors.referenceThresholdPercent = "Enter a reference threshold from 0 to 99%.";
  if (!within(controls.binWidthNm, 0.1, 100)) errors.binWidthNm = "Enter a median bin width from 0.1 to 100 nm.";
  if (!within(controls.sampleSnrMinimum, 0, 100)) errors.sampleSnrMinimum = "Enter a minimum sample SNR from 0 to 100 σ.";
  return errors;
}

export interface OperationState {
  phase: ReflectometryPhase;
  busy: boolean;
  message: string;
  progress?: number;
}

export interface SourceQuality {
  ready: boolean;
  pointCount: number;
  wavelengthMinimumNm: number;
  wavelengthMaximumNm: number;
  reflectanceCount: number;
  transmittanceCount: number;
  reflectanceAvailable: boolean;
  transmittanceAvailable: boolean;
  evaluated: boolean;
}

export interface ExportFile {
  content: string;
  name: string;
  type: string;
}

export interface ReflectometrySnapshot {
  controls: ReflectometryControls;
  layers: OpticalMaterial[];
  substrate: OpticalMaterial;
  activeLayerId: string | null;
  source: SourceInfo | null;
  sourceLabel: string;
  sourceQuality: SourceQuality;
  processingErrors: ProcessingControlErrors;
  operation: OperationState;
  fitData: FitData | null;
  evaluation: OpticalEvaluation | null;
  fitResult: RuntimeFitResult | null;
  resultStale: boolean;
  hasMeasurement: boolean;
  hasResult: boolean;
  canPreview: boolean;
  canFit: boolean;
  canBootstrap: boolean;
  canExport: boolean;
  canUndo: boolean;
  canRedo: boolean;
  selectedFitCount: number;
  autosaveSnapshot: Record<string, unknown>;
}

const DEFAULT_CONTROLS: ReflectometryControls = {
  sampleName: "",
  wavelengthMinNm: 300,
  wavelengthMaxNm: 1100,
  referenceThresholdPercent: 5,
  binWidthNm: 2,
  sampleSnrMinimum: 5,
  subtractBackground: true,
  substrateThicknessUm: 1000,
  incidence: "film",
  useReflectance: true,
  useTransmittance: true,
  preferSpectralShape: true,
  sigmaReflectance: 0.02,
  sigmaTransmittance: 0.02,
  sigmaN: 0.5,
  sigmaK: 0.25,
  fitReflectanceGain: false,
  fitTransmittanceGain: false,
  reflectanceGain: 1,
  transmittanceGain: 1,
  screeningPoints: 512,
  localRefinements: 16,
  bootstrapSamples: 20,
};

const SAVED_CONTROL_MAP: Record<string, keyof ReflectometryControls> = {
  "wavelength-min": "wavelengthMinNm",
  "wavelength-max": "wavelengthMaxNm",
  "reference-threshold": "referenceThresholdPercent",
  "bin-width": "binWidthNm",
  "sample-snr": "sampleSnrMinimum",
  "subtract-background": "subtractBackground",
  "use-r": "useReflectance",
  "use-t": "useTransmittance",
  "prefer-shape": "preferSpectralShape",
  "sigma-r": "sigmaReflectance",
  "sigma-t": "sigmaTransmittance",
  "sigma-n": "sigmaN",
  "sigma-k": "sigmaK",
  "fit-r-gain": "fitReflectanceGain",
  "fit-t-gain": "fitTransmittanceGain",
  "r-gain": "reflectanceGain",
  "t-gain": "transmittanceGain",
  "screening-points": "screeningPoints",
  "local-refinements": "localRefinements",
  "bootstrap-samples": "bootstrapSamples",
};

function modelLabel(model: string): string {
  return Object.hasOwn(MODEL_LABELS, model) ? MODEL_LABELS[model as OpticalModel] : model;
}

function layerSpecs(model: OpticalModel, thicknessNm: number, nk: NkTable | null, components: MaterialComponents, previous: ParameterSpecifications = {}): ParameterSpecifications {
  const referenceIndex = nk
    ? nk.wavelengthNm.reduce((best: number, value: number, index: number) => Math.abs(value - 1064) < Math.abs(nk.wavelengthNm[best] - 1064) ? index : best, 0)
    : 0;
  const generated = modelParameterSpecs(model, { n: nk?.n[referenceIndex] ?? 2, k: nk?.k[referenceIndex] ?? 0.05 }, thicknessNm, components);
  delete generated.rGain;
  delete generated.tGain;
  return Object.fromEntries(Object.entries(generated).map(([name, specification]) => [name, previous[name] ? { ...specification, ...previous[name] } : specification]));
}

function substrateSpecs(model: OpticalModel, nk: NkTable | null, components: MaterialComponents, previous: ParameterSpecifications = {}): ParameterSpecifications {
  const generated = layerSpecs(model, 1000, nk, components, previous);
  delete generated.thicknessNm;
  for (const [name, specification] of Object.entries(generated)) if (!previous[name]) specification.fit = false;
  return generated;
}

function format(value: unknown, digits = 3) {
  return Number.isFinite(value) ? Number(value).toFixed(digits).replace(/\.?0+$/, "") : "—";
}

function formatUncertainty(value: unknown) {
  return Number.isFinite(value) ? `±${Number(value).toPrecision(3)}` : "—";
}

function safeName(value: unknown) {
  return String(value ?? "sample").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "sample";
}

function csvCell(value: unknown) {
  return `"${String(value).replaceAll('"', '""')}"`;
}

function recordOf(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null;
}

function finiteInterval(value: unknown): value is BootstrapInterval {
  const interval = recordOf(value);
  return Boolean(interval && Number.isFinite(interval.lower95) && Number.isFinite(interval.upper95));
}

export class ReflectometryStore {
  private listeners = new Set<() => void>();
  private controls: ReflectometryControls = { ...DEFAULT_CONTROLS };
  private spectrum: Spectrum | null = null;
  private fitData: FitData | null = null;
  private evaluation: OpticalEvaluation | null = null;
  private fitResult: RuntimeFitResult | null = null;
  private resultStale = false;
  private source: SourceInfo | null = null;
  private layers: OpticalMaterial[] = [];
  private substrate: OpticalMaterial;
  private activeLayerId: string | null = null;
  private nextLayer = 1;
  private worker: Worker | null = null;
  private workerToken = 0;
  private pendingConfiguration: FitConfiguration | null = null;
  private history: EditorSnapshot[] = [];
  private future: EditorSnapshot[] = [];
  private lastEditorSnapshot: EditorSnapshot | null = null;
  private restoringHistory = false;
  private operation: OperationState = {
    phase: "needs-input",
    busy: false,
    message: "Load measurement data or the synthetic example to begin.",
  };
  private snapshot!: ReflectometrySnapshot;

  constructor() {
    this.substrate = this.makeSubstrate();
    const layer = this.makeLayer("constant", 150, null);
    layer.name = "Generic layer";
    this.layers = [layer];
    this.activeLayerId = layer.id;
    this.resetHistory(false);
    this.snapshot = this.createSnapshot();
  }

  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  getSnapshot = () => this.snapshot;

  dispose = () => {
    this.worker?.terminate();
    this.worker = null;
    this.workerToken += 1;
    this.listeners.clear();
  };

  private publish() {
    this.snapshot = this.createSnapshot();
    this.listeners.forEach((listener) => listener());
  }

  private setStatus(message: string, phase: ReflectometryPhase = this.operation.phase, progress?: number) {
    this.operation = { busy: Boolean(this.worker), phase, message, ...(progress === undefined ? {} : { progress }) };
    this.publish();
  }

  private showError(error: unknown) {
    this.setStatus(`Error: ${error instanceof Error ? error.message : String(error)}`, "error");
  }

  private makeLayer(model: OpticalModel, thicknessNm: number, nk: NkTable | null): OpticalMaterial {
    const id = `layer${this.nextLayer++}`;
    const components = { ...DEFAULT_COMPONENTS };
    const specs = layerSpecs(model, thicknessNm, nk, components);
    const ema: MaterialEma = { method: "bruggeman", hostNk: null, inclusionNk: null, hostSource: null, inclusionSource: null };
    return { id, name: `Layer ${this.layers.length + 1}`, model, components, ema, nk, nkSource: null, regularize: false, links: {}, specs, specCache: { ...specs } };
  }

  private makeSubstrate(model: OpticalModel = "constant", nk: NkTable | null = null): OpticalMaterial {
    const components = { ...DEFAULT_COMPONENTS };
    const ema: MaterialEma = { method: "bruggeman", hostNk: null, inclusionNk: null, hostSource: null, inclusionSource: null };
    const specs = substrateSpecs(model, nk, components);
    if (model === "constant") {
      specs.n.value = 1.46;
      specs.n.minimum = 1;
      specs.n.maximum = 3;
      specs.k.value = 0;
    }
    return { id: "substrate", name: "Substrate", model, components, ema, nk, nkSource: null, regularize: false, links: {}, specs, specCache: { ...specs } };
  }

  private rebuildLayerSpecs(material: OpticalMaterial) {
    material.specCache = { ...material.specCache, ...material.specs };
    material.specs = material.id === "substrate"
      ? substrateSpecs(material.model, material.nk, material.components, material.specCache)
      : layerSpecs(material.model, material.specs.thicknessNm.value, material.nk, material.components, material.specCache);
    material.specCache = { ...material.specCache, ...material.specs };
  }

  private materialById(id: string) {
    return id === "substrate" ? this.substrate : this.layers.find((candidate) => candidate.id === id);
  }

  private sanitizeParameterLinks() {
    const positions = new Map(this.layers.map((layer, index) => [layer.id, index]));
    for (const [index, layer] of this.layers.entries()) {
      for (const [name, source] of Object.entries(layer.links ?? {}) as [string, string][]) {
        const sourceId = source.slice(0, source.indexOf("__"));
        const sourcePosition = positions.get(sourceId);
        if (sourcePosition === undefined || sourcePosition >= index || !this.layers[sourcePosition].specs[name]) delete layer.links[name];
      }
    }
  }

  private synchronizeLinkedParameters(parameters: NumericParameters | null = null) {
    for (const layer of this.layers) {
      for (const [name, sourceKey] of Object.entries(layer.links ?? {}) as [string, string][]) {
        const separator = sourceKey.indexOf("__");
        const source = this.materialById(sourceKey.slice(0, separator));
        const sourceName = sourceKey.slice(separator + 2);
        const value = parameters?.[sourceKey] ?? source?.specs[sourceName]?.value;
        if (typeof value === "number" && Number.isFinite(value) && layer.specs[name]) {
          layer.specs[name].value = value;
          layer.specs[name].fit = false;
        }
      }
    }
  }

  private sourceQuality(): SourceQuality {
    const wavelengths = this.fitData?.wavelengthNm ?? this.spectrum?.wavelengthNm ?? [];
    const reflectanceAvailable = Boolean(this.spectrum
      && this.spectrum.sampleReflectanceCounts.some(Number.isFinite)
      && this.spectrum.reflectanceReferenceCounts.some(Number.isFinite)
      && this.spectrum.referenceReflectance.some(Number.isFinite));
    const transmittanceAvailable = Boolean(this.spectrum
      && this.spectrum.sampleTransmittanceCounts.some(Number.isFinite)
      && this.spectrum.transmittanceReferenceCounts.some(Number.isFinite));
    return {
      ready: Boolean(this.spectrum),
      pointCount: wavelengths.length,
      wavelengthMinimumNm: wavelengths[0] ?? 0,
      wavelengthMaximumNm: wavelengths.at(-1) ?? 0,
      reflectanceCount: this.fitData?.reflectanceValid?.filter(Boolean).length ?? 0,
      transmittanceCount: this.fitData?.transmittanceValid?.filter(Boolean).length ?? 0,
      reflectanceAvailable,
      transmittanceAvailable,
      evaluated: Boolean(this.fitData),
    };
  }

  private createSnapshot(): ReflectometrySnapshot {
    const selectedFitCount = this.selectedFitCount();
    const hasMeasurement = Boolean(this.spectrum);
    const fitResult = this.fitResult;
    const hasResult = Boolean(fitResult);
    const busy = Boolean(this.worker);
    const processingErrors = getProcessingControlErrors(this.controls);
    const controlsValid = Object.keys(processingErrors).length === 0 && (this.controls.useReflectance || this.controls.useTransmittance);
    return {
      controls: this.controls,
      layers: this.layers,
      substrate: this.substrate,
      activeLayerId: this.activeLayerId,
      source: this.source,
      sourceLabel: this.source ? `${this.source.sampleName ?? "Measurement"} · ${this.source.type ?? "local data"}` : "No measurement loaded",
      sourceQuality: this.sourceQuality(),
      processingErrors,
      operation: { ...this.operation, busy },
      fitData: this.fitData,
      evaluation: this.evaluation,
      fitResult: this.fitResult,
      resultStale: this.resultStale,
      hasMeasurement,
      hasResult,
      canPreview: hasMeasurement && !busy && controlsValid,
      canFit: hasMeasurement && !busy && controlsValid && selectedFitCount > 0 && selectedFitCount <= 11,
      canBootstrap: Boolean(fitResult && !fitResult.preview && !this.resultStale && !busy),
      canExport: Boolean(fitResult && !fitResult.preview && !this.resultStale && !busy),
      canUndo: this.history.length > 0 && !busy,
      canRedo: this.future.length > 0 && !busy,
      selectedFitCount,
      autosaveSnapshot: this.editorSnapshot(),
    };
  }

  updateControl = <K extends keyof ReflectometryControls>(key: K, value: ReflectometryControls[K]) => {
    if (Object.is(this.controls[key], value)) return;
    this.pushHistory();
    this.controls = { ...this.controls, [key]: value };
    this.commitHistorySnapshot(false);
    if (!["screeningPoints", "localRefinements", "bootstrapSamples", "sampleName"].includes(key)) this.markResultStale(false);
    this.publish();
  };

  loadSyntheticExample = () => {
    try {
      this.spectrum = createSyntheticSpectrum();
      this.nextLayer = 1;
      this.substrate = this.makeSubstrate();
      const layer = this.makeLayer("constant", 150, null);
      layer.name = "Generic layer";
      this.layers = [layer];
      this.activeLayerId = layer.id;
      this.controls = { ...this.controls, useTransmittance: true };
      this.source = {
        sampleName: "Synthetic stack",
        type: "generated locally",
        truth: { layers: [{ thicknessNm: 150, n: 2, k: 0.05 }], substrate: { n: 1.46, k: 0, thicknessUm: 1000 } },
      };
      this.clearResult(false);
      this.resetHistory(false);
      this.setStatus("Example loaded. Review the stack, then preview the model or run the fit.", "ready");
    } catch (error) {
      this.showError(error);
    }
  };

  loadLocalFiles = async (files: Record<string, File | null>) => {
    const missing = Object.entries(files).filter(([, file]) => !file).map(([name]) => name);
    if (missing.length) return this.showError(new Error(`Select the required files: ${missing.join(", ")}.`));
    this.pushHistory();
    this.operation = { phase: "fitting", busy: true, message: "Reading local files…" };
    this.publish();
    try {
      const completeFiles = files as Record<string, File>;
      const texts = Object.fromEntries(await Promise.all(Object.entries(completeFiles).map(async ([name, file]) => [name, await file.text()])));
      const sampleName = this.controls.sampleName.trim() || completeFiles.sampleR.name.replace(/-ref\.txt$/i, "") || "sample";
      this.spectrum = createSpectrum({ sampleName, ...texts });
      this.source = { sampleName, type: "local files", files: Object.fromEntries(Object.entries(completeFiles).map(([name, file]) => [name, file.name])) };
      this.clearResult(false);
      this.commitHistorySnapshot(false);
      this.operation = { phase: "ready", busy: false, message: "Measurement processed. Review the stack, then preview the model or run the fit." };
    } catch (error) {
      this.operation = { ...this.operation, busy: false };
      this.showError(error);
      return;
    }
    this.publish();
  };

  loadSavedFit = async (file: File) => {
    if (file.size > 50 * 1024 * 1024) return this.showError(new Error("Saved fit JSON files are limited to 50 MB."));
    this.operation = { phase: "fitting", busy: true, message: "Opening saved fit…" };
    this.publish();
    try {
      this.restoreSavedFit(parseSavedFit(await file.text()), file.name);
    } catch (error) {
      this.operation = { ...this.operation, busy: false };
      this.showError(error);
    }
  };

  private restoreSavedFit(saved: ParsedSavedFit, fileName: string) {
    this.nextLayer = 1;
    this.layers = saved.stack.map((entry) => {
      const thicknessNm = Number.isFinite(entry.parameters.thicknessNm) ? entry.parameters.thicknessNm : 100;
      const layer = this.makeLayer(entry.opticalModel, thicknessNm, entry.nkTable);
      layer.id = entry.id;
      layer.name = entry.name;
      for (const name of ["taucLorentz", "lorentz"] as const) {
        const count = entry.dielectricComponents?.[name];
        if (typeof count === "number" && Number.isInteger(count)) layer.components[name] = Math.max(0, Math.min(5, count));
      }
      for (const name of Object.keys(COMPONENT_LABELS) as Array<keyof typeof COMPONENT_LABELS>) layer.components[name] = Boolean(entry.dielectricComponents?.[name]);
      layer.nk = entry.nkTable;
      layer.nkSource = entry.nkSource;
      layer.regularize = entry.regularizedToNk;
      layer.links = { ...entry.parameterLinks };
      if (entry.effectiveMedium) layer.ema = { ...entry.effectiveMedium };
      layer.specs = layerSpecs(layer.model, thicknessNm, layer.nk, layer.components);
      for (const [name, specification] of Object.entries(layer.specs)) {
        if (entry.parameterSettings[name]) Object.assign(specification, entry.parameterSettings[name]);
        if (Number.isFinite(entry.parameters[name])) specification.value = entry.parameters[name];
      }
      layer.specCache = { ...layer.specs };
      return layer;
    });
    this.activeLayerId = saved.activeLayerId;
    const savedSubstrate = saved.substrateMaterial;
    this.substrate = this.makeSubstrate(savedSubstrate?.opticalModel ?? "constant", savedSubstrate?.nkTable ?? null);
    if (savedSubstrate) {
      for (const name of ["taucLorentz", "lorentz"] as const) {
        const count = savedSubstrate.dielectricComponents?.[name];
        if (typeof count === "number" && Number.isInteger(count)) this.substrate.components[name] = Math.max(0, Math.min(5, count));
      }
      for (const name of Object.keys(COMPONENT_LABELS) as Array<keyof typeof COMPONENT_LABELS>) this.substrate.components[name] = Boolean(savedSubstrate.dielectricComponents?.[name]);
      this.substrate.nkSource = savedSubstrate.nkSource;
      this.substrate.regularize = savedSubstrate.regularizedToNk;
      if (savedSubstrate.effectiveMedium) this.substrate.ema = { ...savedSubstrate.effectiveMedium, method: savedSubstrate.effectiveMedium.method === "maxwell-garnett" ? "maxwell-garnett" : "bruggeman" };
      this.substrate.specs = substrateSpecs(this.substrate.model, this.substrate.nk, this.substrate.components);
      for (const [name, specification] of Object.entries(this.substrate.specs)) {
        if (savedSubstrate.parameterSettings[name]) Object.assign(specification, savedSubstrate.parameterSettings[name]);
        if (Number.isFinite(savedSubstrate.parameters[name])) specification.value = savedSubstrate.parameters[name];
      }
      this.substrate.specCache = { ...this.substrate.specs };
    } else {
      this.substrate.specs.n.value = saved.substrate.n;
      this.substrate.specs.k.value = saved.substrate.k;
    }
    const usedIds = new Set(this.layers.map((layer) => layer.id));
    this.nextLayer = 1;
    while (usedIds.has(`layer${this.nextLayer}`)) this.nextLayer += 1;
    this.applySavedControls(saved.controls);
    this.controls = {
      ...this.controls,
      substrateThicknessUm: saved.substrate.thicknessUm,
      incidence: saved.substrate.incidence === "substrate" ? "substrate" : "film",
      reflectanceGain: saved.gains.reflectance,
      transmittanceGain: saved.gains.transmittance,
    };
    if (saved.spectrum) {
      this.spectrum = saved.spectrum;
      this.source = { ...(saved.source ?? {}), sampleName: saved.spectrum.sampleName, type: typeof saved.source?.type === "string" ? saved.source.type : "restored saved fit" };
    }
    this.sanitizeParameterLinks();
    this.synchronizeLinkedParameters();
    const missingTables = [...this.layers, this.substrate].filter((material) => (TABLE_MODELS.has(material.model) && !material.nk) || (material.model === "ema" && (!material.ema.hostNk || !material.ema.inclusionNk)));
    if (missingTables.length) {
      this.clearResult(false);
      this.resetHistory(false);
      this.operation = { phase: this.spectrum ? "ready" : "needs-input", busy: false, message: `Loaded configuration from ${fileName}. Reload the missing n,k tables for: ${missingTables.map((material) => material.name).join(", ")}.` };
      this.publish();
      return;
    }
    const config = this.configuration();
    const fitData = this.prepareCurrentData();
    this.validateChannels(fitData, config.settings);
    this.evaluation = evaluateOpticalModel(fitData, null, config.initial, config.settings);
    const freshDiagnostics = diagnosticsOf(fitData, this.evaluation, config.settings);
    const diagnostics = saved.spectrum ? this.mergeSavedDiagnostics(freshDiagnostics, saved.diagnostics) : freshDiagnostics;
    const optimizer = this.normalizeSavedOptimizer(saved.optimizer);
    this.fitResult = { parameters: config.initial, evaluation: this.evaluation, diagnostics, optimizer, preview: !saved.spectrum, configuration: config };
    this.resultStale = false;
    this.resetHistory(false);
    this.operation = { phase: saved.spectrum ? "fit-success" : "preview", busy: false, message: saved.spectrum ? `Saved fit loaded from ${fileName}.` : `Legacy configuration loaded from ${fileName}; the current measurement remains active because this file contains no spectra.` };
    this.publish();
  }

  private applySavedControls(controls: Record<string, unknown>) {
    const next = { ...this.controls };
    for (const [savedKey, controlKey] of Object.entries(SAVED_CONTROL_MAP)) {
      if (!Object.hasOwn(controls, savedKey)) continue;
      const current = next[controlKey];
      Object.assign(next, { [controlKey]: typeof current === "boolean" ? Boolean(controls[savedKey]) : Number(controls[savedKey]) });
    }
    this.controls = next;
  }

  private mergeSavedDiagnostics(fresh: FitDiagnostics, saved: Record<string, unknown> | null): RuntimeDiagnostics {
    if (!saved) return fresh;
    const validIntervals = (value: unknown): boolean => Boolean(recordOf(value) && Object.values(recordOf(value)!).every((interval) => interval === null || finiteInterval(interval)));
    const validCorrelation = (value: unknown): value is ParameterCorrelation => {
      const correlation = recordOf(value);
      if (!correlation || !Array.isArray(correlation.names) || !Array.isArray(correlation.matrix)) return false;
      const names = correlation.names;
      return names.every((name) => typeof name === "string") && correlation.matrix.length === names.length && correlation.matrix.every((row) => Array.isArray(row) && row.length === names.length && row.every(Number.isFinite));
    };
    const validBand = (value: unknown): value is BootstrapInterval[] => Array.isArray(value) && value.length === this.fitData?.wavelengthNm.length && value.every(finiteInterval);
    const bootstrap = recordOf(saved.bootstrap);
    const bands = recordOf(bootstrap?.bands);
    const layerBands = recordOf(bands?.layers);
    const validLayerBands = !layerBands || Object.values(layerBands).every((value) => {
      const layer = recordOf(value);
      return Boolean(layer && validBand(layer.n) && validBand(layer.k));
    });
    const validBootstrap = Boolean(bootstrap && bands && validIntervals(bootstrap.parameterIntervals) && validCorrelation(bootstrap.parameterCorrelation) && validBand(bands.reflectance) && validBand(bands.transmittance) && validBand(bands.n) && validBand(bands.k) && validLayerBands);
    const alternatives = Array.isArray(saved.alternativeSolutions)
      ? saved.alternativeSolutions.filter((value) => {
        const solution = recordOf(value);
        const parameters = recordOf(solution?.parameters);
        return Boolean(solution && parameters && Object.values(parameters).every(Number.isFinite));
      }) as AlternativeSolution[]
      : [];
    return {
      ...fresh,
      normalizedJacobianCondition: Number.isFinite(saved.normalizedJacobianCondition) ? Number(saved.normalizedJacobianCondition) : null,
      parametersAtBounds: Array.isArray(saved.parametersAtBounds) ? saved.parametersAtBounds.map(String) : [],
      nearEqualAlternativeMinima: Number.isFinite(saved.nearEqualAlternativeMinima) ? Number(saved.nearEqualAlternativeMinima) : null,
      alternativeSolutions: alternatives,
      parameterStandardErrorsApproximate: recordOf(saved.parameterStandardErrorsApproximate) as Record<string, number | null> ?? {},
      parameterConfidenceIntervals95Approximate: validIntervals(saved.parameterConfidenceIntervals95Approximate) ? saved.parameterConfidenceIntervals95Approximate as Record<string, ConfidenceInterval | null> : {},
      parameterCorrelation: validCorrelation(saved.parameterCorrelation) ? saved.parameterCorrelation : { names: [], matrix: [] },
      bootstrap: validBootstrap ? bootstrap as unknown as BootstrapResult : null,
    };
  }

  private normalizeSavedOptimizer(saved: Record<string, unknown> | null): RuntimeOptimizer {
    const solver = recordOf(saved?.selectedSolver);
    return {
      ...(saved ?? {}),
      logarithmicallySampledParameters: Array.isArray(saved?.logarithmicallySampledParameters) ? saved.logarithmicallySampledParameters.map(String) : [],
      selectedSolver: solver
        ? { success: Boolean(solver.success), message: String(solver.message ?? "Saved fit loaded."), evaluations: Number.isFinite(solver.evaluations) ? Number(solver.evaluations) : 0, optimality: Number.isFinite(solver.optimality) ? Number(solver.optimality) : null }
        : { success: true, message: "Saved fit loaded.", evaluations: 0, optimality: null },
    };
  }

  updateMaterialName = (materialId: string, name: string) => {
    const material = this.materialById(materialId);
    if (!material || material.id === "substrate") return;
    this.edit(() => { material.name = name.trim().slice(0, 60) || material.name; });
  };

  updateMaterialModel = (materialId: string, model: string) => {
    const material = this.materialById(materialId);
    if (!material || material.model === model) return;
    if (!Object.hasOwn(MULTILAYER_MODEL_LABELS, model)) return this.showError(new Error(`Unsupported optical model: ${model}.`));
    this.edit(() => {
      material.model = model as keyof typeof MULTILAYER_MODEL_LABELS;
      material.regularize = false;
      this.rebuildLayerSpecs(material);
    });
  };

  updateComponentCount = (materialId: string, component: "taucLorentz" | "lorentz", count: number) => {
    const material = this.materialById(materialId);
    if (!material) return;
    if (!Number.isInteger(count) || count < 0 || count > 5) return this.showError(new Error("Select from 0 to 5 dielectric oscillators."));
    this.edit(() => {
      material.components[component] = count;
      this.rebuildLayerSpecs(material);
    });
  };

  toggleComponent = (materialId: string, component: string, checked: boolean) => {
    const material = this.materialById(materialId);
    if (!material) return;
    if (!Object.hasOwn(COMPONENT_LABELS, component)) return this.showError(new Error(`Unsupported dielectric component: ${component}.`));
    this.edit(() => {
      material.components[component as keyof typeof COMPONENT_LABELS] = checked;
      if (checked && component === "drude") material.components.drudeSmith = false;
      if (checked && component === "drudeSmith") material.components.drude = false;
      this.rebuildLayerSpecs(material);
    });
  };

  updateEmaMethod = (materialId: string, method: string) => {
    const material = this.materialById(materialId);
    if (!material) return;
    if (!new Set(["bruggeman", "maxwell-garnett"]).has(method)) return this.showError(new Error(`Unsupported effective-medium method: ${method}.`));
    this.edit(() => { material.ema.method = method === "maxwell-garnett" ? "maxwell-garnett" : "bruggeman"; });
  };

  loadMaterialTable = async (materialId: string, field: "nk" | "host" | "inclusion", file: File) => {
    const material = this.materialById(materialId);
    if (!material) return;
    try {
      const table = loadNkTable(await file.text());
      this.edit(() => {
        if (field === "nk") {
          material.nk = table;
          material.nkSource = file.name;
          material.regularize = false;
          this.rebuildLayerSpecs(material);
        } else {
          material.ema[`${field}Nk`] = table;
          material.ema[`${field}Source`] = file.name;
        }
      });
    } catch (error) {
      this.showError(error);
    }
  };

  setMaterialRegularization = (materialId: string, checked: boolean) => {
    const material = this.materialById(materialId);
    if (material) this.edit(() => { material.regularize = checked; });
  };

  setActiveLayer = (materialId: string) => {
    if (!this.layers.some((layer) => layer.id === materialId)) return;
    this.activeLayerId = materialId;
    this.commitHistorySnapshot(false);
    this.publish();
  };

  updateParameter = (materialId: string, parameter: string, kind: "fit" | "value" | "minimum" | "maximum", value: boolean | number) => {
    const material = this.materialById(materialId);
    const specification = material?.specs[parameter];
    if (!specification) return;
    this.edit(() => {
      if (kind === "fit") specification.fit = Boolean(value);
      else specification[kind] = Number(value);
    });
  };

  linkParameter = (materialId: string, parameter: string, source: string) => {
    const material = this.materialById(materialId);
    if (!material) return;
    this.edit(() => {
      if (source) material.links[parameter] = source;
      else delete material.links[parameter];
      this.sanitizeParameterLinks();
      this.synchronizeLinkedParameters();
    });
  };

  addLayer = () => {
    if (this.layers.length >= 12) return this.showError(new Error("The coherent stack is limited to 12 layers."));
    this.edit(() => {
      const layer = this.makeLayer("constant", 100, null);
      this.layers.push(layer);
      this.activeLayerId = layer.id;
    });
    this.setStatus(`Layer ${this.layers.length} added. Preview or fit to update the model.`, "stale");
  };

  moveLayer = (layerId: string, direction: -1 | 1) => {
    const index = this.layers.findIndex((layer) => layer.id === layerId);
    const target = index + direction;
    if (index < 0 || target < 0 || target >= this.layers.length) return;
    const moved = this.layers[index];
    this.edit(() => { [this.layers[index], this.layers[target]] = [this.layers[target], this.layers[index]]; });
    this.setStatus(`${moved.name} moved to position ${target + 1}. Preview or fit to update the model.`, "stale");
  };

  duplicateLayer = (layerId: string) => {
    const index = this.layers.findIndex((layer) => layer.id === layerId);
    if (index < 0 || this.layers.length >= 12) return;
    this.edit(() => {
      const original = this.layers[index];
      const copy = structuredClone(original);
      copy.nk = original.nk;
      copy.ema.hostNk = original.ema.hostNk;
      copy.ema.inclusionNk = original.ema.inclusionNk;
      copy.id = `layer${this.nextLayer++}`;
      copy.name = `${copy.name} copy`;
      copy.links = {};
      this.layers.splice(index + 1, 0, copy);
      this.activeLayerId = copy.id;
    });
  };

  removeLayer = (layerId: string) => {
    if (this.layers.length <= 1) return;
    const index = this.layers.findIndex((layer) => layer.id === layerId);
    if (index < 0) return;
    const name = this.layers[index].name;
    this.edit(() => {
      this.layers.splice(index, 1);
      if (this.activeLayerId === layerId) this.activeLayerId = this.layers[Math.max(0, index - 1)].id;
      this.sanitizeParameterLinks();
    });
    this.setStatus(`${name} removed. Preview or fit to update the model.`, "stale");
  };

  private edit(mutation: () => void) {
    this.pushHistory();
    mutation();
    this.sanitizeParameterLinks();
    this.synchronizeLinkedParameters();
    this.commitHistorySnapshot(false);
    this.markResultStale(false);
    this.publish();
  }

  private editorSnapshot() {
    const snapshot: EditorSnapshot = structuredClone({
      source: this.source,
      spectrum: this.spectrum,
      layers: this.layers,
      substrate: this.substrate,
      activeLayerId: this.activeLayerId,
      nextLayer: this.nextLayer,
      controls: { ...this.serializedControls(), "substrate-thickness": this.controls.substrateThicknessUm, incidence: this.controls.incidence },
    });
    snapshot.layers.forEach((layer, index) => {
      layer.nk = this.layers[index].nk;
      layer.ema.hostNk = this.layers[index].ema.hostNk;
      layer.ema.inclusionNk = this.layers[index].ema.inclusionNk;
    });
    snapshot.substrate.nk = this.substrate.nk;
    snapshot.substrate.ema.hostNk = this.substrate.ema.hostNk;
    snapshot.substrate.ema.inclusionNk = this.substrate.ema.inclusionNk;
    return snapshot;
  }

  private commitHistorySnapshot(publish = true) {
    if (this.restoringHistory || !this.substrate) return;
    this.lastEditorSnapshot = this.editorSnapshot();
    if (publish) this.publish();
  }

  private resetHistory(publish = true) {
    this.history = [];
    this.future = [];
    this.lastEditorSnapshot = this.editorSnapshot();
    if (publish) this.publish();
  }

  private pushHistory() {
    if (this.restoringHistory || !this.lastEditorSnapshot) return;
    this.history.push(this.lastEditorSnapshot);
    if (this.history.length > 30) this.history.shift();
    this.future = [];
  }

  private restoreHistorySnapshot(snapshot: EditorSnapshot) {
    this.restoringHistory = true;
    this.spectrum = snapshot.spectrum;
    this.source = snapshot.source;
    this.layers = snapshot.layers;
    this.substrate = snapshot.substrate;
    this.activeLayerId = snapshot.activeLayerId;
    this.nextLayer = snapshot.nextLayer;
    this.applySavedControls(snapshot.controls ?? {});
    this.controls = {
      ...this.controls,
      substrateThicknessUm: Number(snapshot.controls?.["substrate-thickness"] ?? this.controls.substrateThicknessUm),
      incidence: snapshot.controls?.incidence === "substrate" ? "substrate" : "film",
    };
    this.restoringHistory = false;
    this.lastEditorSnapshot = this.editorSnapshot();
    this.markResultStale(false);
    this.publish();
  }

  undo = () => {
    if (!this.history.length) return;
    if (this.lastEditorSnapshot) this.future.push(this.lastEditorSnapshot);
    const snapshot = this.history.pop();
    if (snapshot) this.restoreHistorySnapshot(snapshot);
  };

  redo = () => {
    if (!this.future.length) return;
    if (this.lastEditorSnapshot) this.history.push(this.lastEditorSnapshot);
    const snapshot = this.future.pop();
    if (snapshot) this.restoreHistorySnapshot(snapshot);
  };

  restoreAutosave = (value: Record<string, unknown>) => {
    const candidate = value as Partial<EditorSnapshot>;
    if (!Array.isArray(candidate.layers) || !candidate.layers.length || !candidate.substrate || !candidate.controls) return this.showError(new Error("The saved session is incomplete."));
    const snapshot = candidate as EditorSnapshot;
    this.restoringHistory = true;
    this.spectrum = snapshot.spectrum ?? null;
    this.source = snapshot.source ?? null;
    this.layers = snapshot.layers;
    this.substrate = snapshot.substrate;
    this.activeLayerId = snapshot.activeLayerId;
    this.nextLayer = snapshot.nextLayer;
    this.applySavedControls(snapshot.controls ?? {});
    this.controls = {
      ...this.controls,
      substrateThicknessUm: Number(snapshot.controls?.["substrate-thickness"] ?? this.controls.substrateThicknessUm),
      incidence: snapshot.controls?.incidence === "substrate" ? "substrate" : "film",
    };
    this.clearResult(false);
    this.restoringHistory = false;
    this.resetHistory(false);
    this.setStatus("Previous session restored. Preview the model or run a new fit.", this.spectrum ? "ready" : "needs-input");
  };

  private configuration(): FitConfiguration {
    if (!this.layers.length) throw new Error("Add at least one layer.");
    if (!this.controls.useReflectance && !this.controls.useTransmittance) throw new Error("Select R, T, or both channels.");
    const initial: NumericParameters = { rGain: this.numberValue(this.controls.reflectanceGain, "R gain", 0.1, 10), tGain: this.numberValue(this.controls.transmittanceGain, "T gain", 0.1, 10) };
    const bounds: Record<string, [number, number]> = { rGain: [0.1, 10], tGain: [0.1, 10] };
    const fittedParameters: string[] = [];
    if (this.controls.fitReflectanceGain && this.controls.useReflectance) fittedParameters.push("rGain");
    if (this.controls.fitTransmittanceGain && this.controls.useTransmittance) fittedParameters.push("tGain");
    for (const layer of this.layers) {
      this.validateMaterial(layer, initial, bounds, fittedParameters);
    }
    this.validateMaterial(this.substrate, initial, bounds, fittedParameters);
    const parameterLinks = Object.fromEntries(this.layers.flatMap((layer) => Object.entries(layer.links ?? {}).map(([name, source]) => [`${layer.id}__${name}`, source])));
    for (const [target, source] of Object.entries(parameterLinks) as [string, string][]) {
      if (!Object.hasOwn(initial, target) || !Object.hasOwn(initial, source)) throw new Error(`Invalid linked parameter: ${target}.`);
      initial[target] = initial[source];
      const position = fittedParameters.indexOf(target);
      if (position >= 0) fittedParameters.splice(position, 1);
    }
    if (fittedParameters.length > 11) throw new Error(`Select at most 11 fitted parameters; ${fittedParameters.length} are selected.`);
    const substrateThicknessUm = this.numberValue(this.controls.substrateThicknessUm, "Substrate thickness", 10, 1e6);
    const minimumSubstrateThicknessUm = this.numberValue(this.controls.wavelengthMaxNm, "Maximum wavelength", 196, 3000) / 100;
    if (substrateThicknessUm < minimumSubstrateThicknessUm) throw new Error(`Substrate thickness must be at least ${format(minimumSubstrateThicknessUm, 3)} µm (10× the maximum wavelength).`);
    const settings: OpticalSettings = {
      layers: this.layers.map(({ id, name, model, components, ema, nk, regularize }) => ({ id, name, model, components, ema, nk, regularize })),
      activeLayerId: this.activeLayerId,
      substrate: { model: this.substrate.model, components: this.substrate.components, ema: this.substrate.ema, nk: this.substrate.nk, regularize: this.substrate.regularize },
      substrateThicknessNm: 1000 * substrateThicknessUm,
      incidence: this.controls.incidence,
      parameterLinks,
      useReflectance: this.controls.useReflectance,
      useTransmittance: this.controls.useTransmittance,
      sigmaReflectance: this.numberValue(this.controls.sigmaReflectance, "σR", 0.0001, 1),
      sigmaTransmittance: this.numberValue(this.controls.sigmaTransmittance, "σT", 0.0001, 1),
      sigmaN: this.numberValue(this.controls.sigmaN, "σn", 0.0001, 10),
      sigmaK: this.numberValue(this.controls.sigmaK, "σk", 0.0001, 10),
      preferSpectralShape: this.controls.preferSpectralShape,
    };
    return { settings, initial, bounds, fittedParameters };
  }

  private validateMaterial(material: OpticalMaterial, initial: NumericParameters, bounds: Record<string, [number, number]>, fittedParameters: string[]) {
    const prefix = material.id === "substrate" ? "Substrate" : material.name;
    if (TABLE_MODELS.has(material.model) && !material.nk) throw new Error(`${prefix}: ${MODEL_LABELS[material.model]} requires an n,k table.`);
    if (material.model === "composite" && !material.components.taucLorentz && !material.components.lorentz && !Object.keys(COMPONENT_LABELS).some((name) => material.components[name])) throw new Error(`${prefix}: select at least one dielectric component.`);
    if (material.model === "ema" && (!material.ema.hostNk || !material.ema.inclusionNk)) throw new Error(`${prefix}: load both EMA constituent n,k tables.`);
    for (const [name, specification] of Object.entries(material.specs)) {
      const key = `${material.id}__${name}`;
      const { value, minimum, maximum } = specification;
      if (![value, minimum, maximum].every(Number.isFinite) || minimum >= maximum || value < minimum || value > maximum) throw new Error(`${prefix}: ${specification.label} must have a finite value inside valid bounds.`);
      initial[key] = value;
      bounds[key] = [minimum, maximum];
      if (specification.fit) fittedParameters.push(key);
    }
  }

  private prepareCurrentData() {
    if (!this.spectrum) throw new Error("Load a measurement first.");
    let data = prepareFitData(this.spectrum, {
      wavelengthMinNm: this.numberValue(this.controls.wavelengthMinNm, "Minimum wavelength", 195, 3000),
      wavelengthMaxNm: this.numberValue(this.controls.wavelengthMaxNm, "Maximum wavelength", 196, 3000),
      referenceThresholdFraction: this.numberValue(this.controls.referenceThresholdPercent, "Reference threshold", 0, 99) / 100,
      binWidthNm: this.numberValue(this.controls.binWidthNm, "Median bin", 0.1, 100),
      sampleSnrMinimum: this.numberValue(this.controls.sampleSnrMinimum, "Minimum sample SNR", 0, 100),
      subtractBackground: this.controls.subtractBackground,
    });
    for (const layer of this.layers.filter((candidate) => TABLE_MODELS.has(candidate.model))) if (layer.nk) data = restrictToNkRange(data, layer.nk);
    for (const layer of this.layers.filter((candidate) => candidate.model === "ema")) {
      if (layer.ema.hostNk) data = restrictToNkRange(data, layer.ema.hostNk);
      if (layer.ema.inclusionNk) data = restrictToNkRange(data, layer.ema.inclusionNk);
    }
    if (TABLE_MODELS.has(this.substrate.model) && this.substrate.nk) data = restrictToNkRange(data, this.substrate.nk);
    if (this.substrate.model === "ema") {
      if (this.substrate.ema.hostNk) data = restrictToNkRange(data, this.substrate.ema.hostNk);
      if (this.substrate.ema.inclusionNk) data = restrictToNkRange(data, this.substrate.ema.inclusionNk);
    }
    this.fitData = data;
    return data;
  }

  private validateChannels(data: FitData, settings: OpticalSettings) {
    if (settings.useReflectance && data.reflectanceValid.filter(Boolean).length < 10) throw new Error("Fewer than 10 reflectance bins pass the masks.");
    if (settings.useTransmittance && data.transmittanceValid.filter(Boolean).length < 10) throw new Error("Fewer than 10 transmittance bins pass the masks; disable T or revise the SNR threshold.");
  }

  preview = () => {
    if (!this.spectrum) return this.setStatus("Load measurement data or the synthetic example before previewing the model.", "needs-input");
    try {
      const config = this.configuration();
      const fitData = this.prepareCurrentData();
      this.validateChannels(fitData, config.settings);
      this.evaluation = evaluateOpticalModel(fitData, null, config.initial, config.settings);
      this.fitResult = { parameters: config.initial, evaluation: this.evaluation, diagnostics: diagnosticsOf(fitData, this.evaluation, config.settings), preview: true, configuration: config };
      this.resultStale = false;
      this.commitHistorySnapshot(false);
      this.setStatus("Model preview updated; parameters have not been optimized.", "preview");
    } catch (error) {
      this.showError(error);
    }
  };

  fit = () => {
    if (!this.spectrum) return this.setStatus("Load measurement data or the synthetic example before fitting.", "needs-input");
    try {
      const config = this.configuration();
      const fitData = this.prepareCurrentData();
      this.validateChannels(fitData, config.settings);
      if (!config.fittedParameters?.length) throw new Error("Select at least one parameter to fit.");
      const screeningPoints = this.integerValue(this.controls.screeningPoints, "Sobol points", 64, 4096);
      if (screeningPoints & (screeningPoints - 1)) throw new Error("Sobol points must be a power of two.");
      const localRefinements = this.integerValue(this.controls.localRefinements, "Local refinements", 1, 50);
      this.pushHistory();
      this.pendingConfiguration = config;
      this.startFitWorker(`Screening ${screeningPoints} Sobol points…`);
      this.worker!.postMessage({ operation: "fit", fitData, nk: null, configuration: { ...config, screeningPoints, localRefinements } });
    } catch (error) {
      this.showError(error);
    }
  };

  bootstrap = () => {
    try {
      if (!this.fitResult || this.fitResult.preview) throw new Error("Run a fit before estimating bootstrap uncertainty.");
      const samples = this.integerValue(this.controls.bootstrapSamples, "Bootstrap replicates", 5, 200);
      this.startFitWorker(`Running ${samples} residual-bootstrap refits…`);
      this.worker!.postMessage({ operation: "bootstrap", fitData: this.fitData, nk: null, configuration: this.fitResult.configuration, bestParameters: this.fitResult.parameters, samples });
    } catch (error) {
      this.showError(error);
    }
  };

  private startFitWorker(message: string) {
    this.stopFitWorker(false);
    const token = this.workerToken;
    const worker = new Worker(new URL("../scientific/workers/fit-worker.ts", import.meta.url), { type: "module" });
    this.worker = worker;
    worker.addEventListener("message", (event) => this.handleWorkerMessage(event, token));
    worker.addEventListener("error", (event) => this.finishFitError(event.message, token));
    this.operation = { phase: "fitting", busy: true, message, progress: 0 };
    this.publish();
  }

  private handleWorkerMessage = ({ data }: MessageEvent<FitWorkerMessage>, token: number) => {
    if (token !== this.workerToken) return;
    if (data.type === "progress") return this.setStatus(`Fitting parameters… ${data.progress}%`, "fitting", data.progress);
    if (data.type === "bootstrap-progress") return this.setStatus(`Bootstrap refits… ${data.progress}%`, "fitting", data.progress);
    if (data.type === "bootstrap-result") {
      this.stopFitWorker(false);
      if (!this.fitResult) return;
      this.fitResult.diagnostics.bootstrap = data.result;
      this.setStatus(`Bootstrap complete: ${data.result.successfulSamples} of ${data.result.requestedSamples} refits converged.`, "bootstrap-success");
      return;
    }
    if (data.type === "error") return this.finishFitError(data.message, token);
    if (data.type !== "result") return;
    const configuration = this.pendingConfiguration;
    this.stopFitWorker(false);
    if (!configuration) return this.showError(new Error("The fit configuration is no longer available."));
    this.fitResult = { ...data.result, preview: false, configuration };
    this.pendingConfiguration = null;
    this.evaluation = data.result.evaluation;
    for (const material of [...this.layers, this.substrate]) {
      for (const specificationName of Object.keys(material.specs)) {
        const key = `${material.id}__${specificationName}`;
        material.specs[specificationName].value = data.result.parameters[key];
        material.specs[specificationName].uncertainty = formatUncertainty(data.result.diagnostics.parameterStandardErrorsApproximate[key]);
      }
    }
    this.synchronizeLinkedParameters(data.result.parameters);
    this.controls = { ...this.controls, reflectanceGain: data.result.parameters.rGain, transmittanceGain: data.result.parameters.tGain };
    this.resultStale = false;
    this.commitHistorySnapshot(false);
    const solver = data.result.optimizer?.selectedSolver;
    this.setStatus(solver?.success !== false ? "Fit complete." : `Fit stopped: ${solver.message}`, solver?.success !== false ? "fit-success" : "error");
  };

  private stopFitWorker(publish = true) {
    this.worker?.terminate();
    this.worker = null;
    this.workerToken += 1;
    if (publish) this.publish();
  }

  cancel = () => {
    if (!this.worker) return;
    this.stopFitWorker(false);
    this.pendingConfiguration = null;
    this.setStatus(
      this.resultStale ? "Calculation cancelled; displayed results still precede the current configuration." : "Calculation cancelled; previous valid results were kept.",
      this.resultStale ? "stale" : this.fitResult?.preview ? "preview" : this.fitResult ? "fit-success" : this.spectrum ? "ready" : "needs-input",
    );
  };

  private finishFitError(message: string, token: number) {
    if (token !== this.workerToken) return;
    this.stopFitWorker(false);
    this.pendingConfiguration = null;
    this.showError(new Error(message));
  }

  private markResultStale(publish = true) {
    if (!this.fitResult) return;
    this.resultStale = true;
    this.operation = { phase: "stale", busy: false, message: "Configuration changed. Preview the model or run a new fit; displayed results are stale." };
    if (publish) this.publish();
  }

  private clearResult(publish = true) {
    this.fitData = null;
    this.evaluation = null;
    this.fitResult = null;
    this.resultStale = false;
    if (publish) this.publish();
  }

  applyAlternative = (index: number) => {
    const alternatives = this.fitResult?.diagnostics.alternativeSolutions ?? [];
    const solution = alternatives[index];
    if (!solution) return;
    this.pushHistory();
    for (const material of [...this.layers, this.substrate]) {
      for (const name of Object.keys(material.specs)) {
        const value = solution.parameters[`${material.id}__${name}`];
        if (Number.isFinite(value)) material.specs[name].value = value;
      }
    }
    this.controls = { ...this.controls, reflectanceGain: solution.parameters.rGain, transmittanceGain: solution.parameters.tGain };
    this.synchronizeLinkedParameters(solution.parameters);
    this.commitHistorySnapshot(false);
    this.markResultStale(false);
    this.setStatus(`Solution ${solution.rank} loaded as editable starting values. Preview or fit to update the model.`, "stale");
  };

  parameterLabel = (key: string) => {
    if (key === "rGain") return "R gain";
    if (key === "tGain") return "T gain";
    const separator = key.indexOf("__");
    if (separator < 0) return key;
    const material = this.materialById(key.slice(0, separator));
    const name = key.slice(separator + 2);
    return `${material?.name ?? key.slice(0, separator)} · ${material?.specs[name]?.label ?? name}`;
  };

  modelLabel = modelLabel;

  private selectedFitCount() {
    return [...this.layers, this.substrate].reduce(
      (sum, material) => sum + Object.entries(material.specs).filter(([name, specification]) => specification.fit && !material.links?.[name]).length,
      Number(this.controls.fitReflectanceGain && this.controls.useReflectance) + Number(this.controls.fitTransmittanceGain && this.controls.useTransmittance),
    );
  }

  private numberValue(value: number, label: string, minimum: number, maximum: number) {
    if (!Number.isFinite(value) || value < minimum || value > maximum) throw new Error(`${label} must be from ${minimum} to ${maximum}.`);
    return value;
  }

  private integerValue(value: number, label: string, minimum: number, maximum: number) {
    const result = this.numberValue(value, label, minimum, maximum);
    if (!Number.isInteger(result)) throw new Error(`${label} must be an integer.`);
    return result;
  }

  private serializedControls() {
    return Object.fromEntries(Object.entries(SAVED_CONTROL_MAP).map(([savedKey, controlKey]) => [savedKey, this.controls[controlKey]]));
  }

  private exportPayload() {
    const fitResult = this.fitResult;
    const evaluation = this.evaluation;
    const fitData = this.fitData;
    if (!fitResult || fitResult.preview || !evaluation?.substrateIndex || !fitData) throw new Error("Run a fit before exporting results.");
    return {
      schema: SAVED_FIT_SCHEMA,
      application: { name: "Reflectometry", version: "4.0.0", url: "https://jorpago2.github.io/reflectometry/" },
      generatedAt: new Date().toISOString(),
      source: this.source,
      activeLayerId: this.activeLayerId,
      measurement: { spectrum: this.spectrum },
      controls: this.serializedControls(),
      stack: this.layers.map((layer) => ({
        id: layer.id,
        name: layer.name,
        opticalModel: layer.model,
        dielectricComponents: layer.model === "composite" ? { ...layer.components } : null,
        effectiveMedium: layer.model === "ema" ? { method: layer.ema.method, hostSource: layer.ema.hostSource, inclusionSource: layer.ema.inclusionSource, hostNk: layer.ema.hostNk, inclusionNk: layer.ema.inclusionNk } : null,
        nkSource: layer.nkSource,
        nkTable: layer.nk,
        regularizedToNk: layer.regularize,
        parameters: Object.fromEntries(Object.keys(layer.specs).map((name) => [name, fitResult.parameters[`${layer.id}__${name}`]])),
        parameterSettings: Object.fromEntries(Object.entries(layer.specs).map(([name, specification]) => [name, { minimum: specification.minimum, maximum: specification.maximum, fit: specification.fit, uncertainty: specification.uncertainty ?? null }])),
        parameterLinks: { ...layer.links },
      })),
      substrate: {
        refractiveIndex: { n: evaluation.substrateIndex.n[Math.floor(fitData.wavelengthNm.length / 2)], k: evaluation.substrateIndex.k[Math.floor(fitData.wavelengthNm.length / 2)] },
        opticalModel: this.substrate.model,
        dielectricComponents: this.substrate.model === "composite" ? { ...this.substrate.components } : null,
        effectiveMedium: this.substrate.model === "ema" ? { method: this.substrate.ema.method, hostSource: this.substrate.ema.hostSource, inclusionSource: this.substrate.ema.inclusionSource, hostNk: this.substrate.ema.hostNk, inclusionNk: this.substrate.ema.inclusionNk } : null,
        nkSource: this.substrate.nkSource,
        nkTable: this.substrate.nk,
        regularizedToNk: this.substrate.regularize,
        parameters: Object.fromEntries(Object.keys(this.substrate.specs).map((name) => [name, fitResult.parameters[`substrate__${name}`]])),
        parameterSettings: Object.fromEntries(Object.entries(this.substrate.specs).map(([name, specification]) => [name, { minimum: specification.minimum, maximum: specification.maximum, fit: specification.fit, uncertainty: specification.uncertainty ?? null }])),
        thicknessUm: this.controls.substrateThicknessUm,
        incidence: this.controls.incidence,
      },
      gains: { reflectance: fitResult.parameters.rGain, transmittance: fitResult.parameters.tGain },
      diagnostics: fitResult.diagnostics,
      optimizer: fitResult.optimizer,
      assumptions: ["normal incidence", "homogeneous isotropic coherent layers", "finite phase-incoherent dispersive substrate", "Beer–Lambert substrate attenuation", "incoherent rear-surface returns"],
    };
  }

  createExport = (kind: "json" | "spectra" | "nk"): ExportFile => {
    const payload = this.exportPayload();
    const fitData = this.fitData;
    const evaluation = this.evaluation;
    if (!fitData || !evaluation?.layerIndices || !evaluation.substrateIndex) throw new Error("Run a fit before exporting results.");
    const base = safeName(this.source?.sampleName);
    if (kind === "json") return { content: JSON.stringify(payload, null, 2), name: `${base}-multilayer-fit.json`, type: "application/json;charset=utf-8" };
    if (kind === "spectra") {
      const header = "wavelength_nm,reflectance_data,transmittance_data,reflectance_valid,transmittance_valid,reflectance_model,transmittance_model,reflectance_residual,transmittance_residual";
      const rows = fitData.wavelengthNm.map((wavelength, index) => [wavelength, fitData.reflectance[index], fitData.transmittance[index], fitData.reflectanceValid[index], fitData.transmittanceValid[index], evaluation.reflectanceScaled[index], evaluation.transmittanceScaled[index], fitData.reflectanceValid[index] ? evaluation.reflectanceScaled[index] - fitData.reflectance[index] : "", fitData.transmittanceValid[index] ? evaluation.transmittanceScaled[index] - fitData.transmittance[index] : ""].join(","));
      return { content: `${[header, ...rows].join("\n")}\n`, name: `${base}-multilayer-spectra.csv`, type: "text/csv;charset=utf-8" };
    }
    const header = "layer_order,layer_id,layer_name,model,wavelength_nm,n,k";
    const materials = [...evaluation.layerIndices, { id: "substrate", name: "Substrate", model: this.substrate.model, ...evaluation.substrateIndex }];
    const rows = materials.flatMap((layer, order) => fitData.wavelengthNm.map((wavelength, index) => [order + 1, layer.id, csvCell(layer.name), layer.model, wavelength, layer.n[index], layer.k[index]].join(",")));
    return { content: `${[header, ...rows].join("\n")}\n`, name: `${base}-multilayer-nk.csv`, type: "text/csv;charset=utf-8" };
  };
}
