import { MODEL_LABELS, modelParameterSpecs } from "../scientific/models/dielectric-models.ts";
import { parseSavedFit, SAVED_FIT_SCHEMA } from "../scientific/fitting/saved-fit.ts";
import {
  createSpectrum,
  createSyntheticSpectrum,
  diagnosticsOf,
  evaluateOpticalModel,
  loadNkTable,
  prepareFitData,
  restrictToNkRange,
} from "../scientific/solvers/scientific-core.ts";
import type { ReflectometryPhase } from "../app/operation-status.ts";

export const MULTILAYER_MODEL_LABELS: Record<string, string> = {
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

export const COMPONENT_LABELS: Record<string, string> = {
  gaussian: "Gaussian",
  cody: "Cody–Lorentz",
  drude: "Drude",
  drudeSmith: "Drude–Smith",
  brendelBormann: "Brendel–Bormann",
  criticalPoint: "Critical point / Adachi",
};

const DEFAULT_COMPONENTS = {
  taucLorentz: 1,
  lorentz: 0,
  gaussian: false,
  cody: false,
  drude: false,
  drudeSmith: false,
  brendelBormann: false,
  criticalPoint: false,
};
const TABLE_MODELS = new Set(["fixed", "scaled"]);

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
}

export interface ExportFile {
  content: string;
  name: string;
  type: string;
}

export interface ReflectometrySnapshot {
  controls: ReflectometryControls;
  layers: any[];
  substrate: any;
  activeLayerId: string | null;
  source: any;
  sourceLabel: string;
  sourceQuality: SourceQuality;
  operation: OperationState;
  fitData: any;
  evaluation: any;
  fitResult: any;
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

function modelLabel(model: string) {
  return MULTILAYER_MODEL_LABELS[model] ?? MODEL_LABELS[model] ?? model;
}

function layerSpecs(model: string, thicknessNm: number, nk: any, components: any, previous: any = {}) {
  const referenceIndex = nk
    ? nk.wavelengthNm.reduce((best: number, value: number, index: number) => Math.abs(value - 1064) < Math.abs(nk.wavelengthNm[best] - 1064) ? index : best, 0)
    : 0;
  const generated: any = modelParameterSpecs(model, { n: nk?.n[referenceIndex] ?? 2, k: nk?.k[referenceIndex] ?? 0.05 }, thicknessNm, components);
  delete generated.rGain;
  delete generated.tGain;
  return Object.fromEntries(Object.entries(generated).map(([name, specification]: [string, any]) => [name, previous[name] ? { ...specification, ...previous[name] } : specification]));
}

function substrateSpecs(model: string, nk: any, components: any, previous: any = {}) {
  const generated = layerSpecs(model, 1000, nk, components, previous);
  delete generated.thicknessNm;
  for (const [name, specification] of Object.entries(generated) as [string, any][]) if (!previous[name]) specification.fit = false;
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

export class ReflectometryStore {
  private listeners = new Set<() => void>();
  private controls: ReflectometryControls = { ...DEFAULT_CONTROLS };
  private spectrum: any = null;
  private fitData: any = null;
  private evaluation: any = null;
  private fitResult: any = null;
  private resultStale = false;
  private source: any = null;
  private layers: any[] = [];
  private substrate: any;
  private activeLayerId: string | null = null;
  private nextLayer = 1;
  private worker: Worker | null = null;
  private pendingConfiguration: any = null;
  private history: any[] = [];
  private future: any[] = [];
  private lastEditorSnapshot: any = null;
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

  private makeLayer(model: string, thicknessNm: number, nk: any) {
    const id = `layer${this.nextLayer++}`;
    const components = { ...DEFAULT_COMPONENTS };
    const specs = layerSpecs(model, thicknessNm, nk, components);
    const ema = { method: "bruggeman", hostNk: null, inclusionNk: null, hostSource: null, inclusionSource: null };
    return { id, name: `Layer ${this.layers.length + 1}`, model, components, ema, nk, nkSource: null, regularize: false, links: {}, specs, specCache: { ...specs } };
  }

  private makeSubstrate(model = "constant", nk: any = null) {
    const components = { ...DEFAULT_COMPONENTS };
    const ema = { method: "bruggeman", hostNk: null, inclusionNk: null, hostSource: null, inclusionSource: null };
    const specs = substrateSpecs(model, nk, components);
    if (model === "constant") {
      specs.n.value = 1.46;
      specs.n.minimum = 1;
      specs.n.maximum = 3;
      specs.k.value = 0;
    }
    return { id: "substrate", name: "Substrate", model, components, ema, nk, nkSource: null, regularize: false, links: {}, specs, specCache: { ...specs } };
  }

  private rebuildLayerSpecs(material: any) {
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

  private synchronizeLinkedParameters(parameters: any = null) {
    for (const layer of this.layers) {
      for (const [name, sourceKey] of Object.entries(layer.links ?? {}) as [string, string][]) {
        const separator = sourceKey.indexOf("__");
        const source = this.materialById(sourceKey.slice(0, separator));
        const sourceName = sourceKey.slice(separator + 2);
        const value = parameters?.[sourceKey] ?? source?.specs[sourceName]?.value;
        if (Number.isFinite(value) && layer.specs[name]) {
          layer.specs[name].value = value;
          layer.specs[name].fit = false;
        }
      }
    }
  }

  private sourceQuality(): SourceQuality {
    const wavelengths = this.fitData?.wavelengthNm ?? this.spectrum?.wavelengthNm ?? [];
    return {
      ready: Boolean(this.spectrum),
      pointCount: wavelengths.length,
      wavelengthMinimumNm: wavelengths[0] ?? 0,
      wavelengthMaximumNm: wavelengths.at(-1) ?? 0,
      reflectanceCount: this.fitData?.reflectanceValid?.filter(Boolean).length ?? 0,
      transmittanceCount: this.fitData?.transmittanceValid?.filter(Boolean).length ?? 0,
    };
  }

  private createSnapshot(): ReflectometrySnapshot {
    const selectedFitCount = this.selectedFitCount();
    const hasMeasurement = Boolean(this.spectrum);
    const hasResult = Boolean(this.fitResult);
    const busy = Boolean(this.worker);
    return {
      controls: this.controls,
      layers: this.layers,
      substrate: this.substrate,
      activeLayerId: this.activeLayerId,
      source: this.source,
      sourceLabel: this.source ? `${this.source.sampleName ?? "Measurement"} · ${this.source.type ?? "local data"}` : "No measurement loaded",
      sourceQuality: this.sourceQuality(),
      operation: { ...this.operation, busy },
      fitData: this.fitData,
      evaluation: this.evaluation,
      fitResult: this.fitResult,
      resultStale: this.resultStale,
      hasMeasurement,
      hasResult,
      canPreview: hasMeasurement && !busy,
      canFit: hasMeasurement && !busy && selectedFitCount > 0 && selectedFitCount <= 11,
      canBootstrap: hasResult && !this.fitResult.preview && !this.resultStale && !busy,
      canExport: hasResult && !this.fitResult.preview && !this.resultStale && !busy,
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

  private restoreSavedFit(saved: any, fileName: string) {
    this.nextLayer = 1;
    this.layers = saved.stack.map((entry: any) => {
      const thicknessNm = Number.isFinite(entry.parameters.thicknessNm) ? entry.parameters.thicknessNm : 100;
      const layer = this.makeLayer(entry.opticalModel, thicknessNm, entry.nkTable);
      layer.id = entry.id;
      layer.name = entry.name;
      for (const name of ["taucLorentz", "lorentz"]) if (Number.isInteger(entry.dielectricComponents?.[name])) layer.components[name] = Math.max(0, Math.min(5, entry.dielectricComponents[name]));
      for (const name of Object.keys(COMPONENT_LABELS)) layer.components[name] = Boolean(entry.dielectricComponents?.[name]);
      layer.nk = entry.nkTable;
      layer.nkSource = entry.nkSource;
      layer.regularize = entry.regularizedToNk;
      layer.links = { ...entry.parameterLinks };
      if (entry.effectiveMedium) layer.ema = { ...entry.effectiveMedium };
      layer.specs = layerSpecs(layer.model, thicknessNm, layer.nk, layer.components);
      for (const [name, specification] of Object.entries(layer.specs) as [string, any][]) {
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
      for (const name of ["taucLorentz", "lorentz"]) if (Number.isInteger(savedSubstrate.dielectricComponents?.[name])) this.substrate.components[name] = Math.max(0, Math.min(5, savedSubstrate.dielectricComponents[name]));
      for (const name of Object.keys(COMPONENT_LABELS)) this.substrate.components[name] = Boolean(savedSubstrate.dielectricComponents?.[name]);
      this.substrate.nkSource = savedSubstrate.nkSource;
      this.substrate.regularize = savedSubstrate.regularizedToNk;
      if (savedSubstrate.effectiveMedium) this.substrate.ema = { ...savedSubstrate.effectiveMedium };
      this.substrate.specs = substrateSpecs(this.substrate.model, this.substrate.nk, this.substrate.components);
      for (const [name, specification] of Object.entries(this.substrate.specs) as [string, any][]) {
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
      incidence: saved.substrate.incidence,
      reflectanceGain: saved.gains.reflectance,
      transmittanceGain: saved.gains.transmittance,
    };
    if (saved.spectrum) {
      this.spectrum = saved.spectrum;
      this.source = { ...(saved.source ?? {}), sampleName: saved.spectrum.sampleName, type: saved.source?.type ?? "restored saved fit" };
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
      (next as any)[controlKey] = typeof current === "boolean" ? Boolean(controls[savedKey]) : Number(controls[savedKey]);
    }
    this.controls = next;
  }

  private mergeSavedDiagnostics(fresh: any, saved: any) {
    if (!saved) return fresh;
    const validIntervals = (value: any) => value && typeof value === "object" && Object.values(value).every((interval: any) => interval === null || (Number.isFinite(interval.lower95) && Number.isFinite(interval.upper95)));
    const validCorrelation = (value: any) => Array.isArray(value?.names) && Array.isArray(value?.matrix) && value.matrix.length === value.names.length && value.matrix.every((row: any[]) => Array.isArray(row) && row.length === value.names.length && row.every(Number.isFinite));
    const validBand = (value: any) => Array.isArray(value) && value.length === this.fitData?.wavelengthNm.length && value.every((interval: any) => Number.isFinite(interval?.lower95) && Number.isFinite(interval?.upper95));
    const bootstrap = saved.bootstrap;
    const layerBands = bootstrap?.bands?.layers;
    const validLayerBands = !layerBands || (typeof layerBands === "object" && Object.values(layerBands).every((bands: any) => validBand(bands?.n) && validBand(bands?.k)));
    const validBootstrap = validIntervals(bootstrap?.parameterIntervals) && validCorrelation(bootstrap?.parameterCorrelation) && validBand(bootstrap?.bands?.reflectance) && validBand(bootstrap?.bands?.transmittance) && validBand(bootstrap?.bands?.n) && validBand(bootstrap?.bands?.k) && validLayerBands;
    return {
      ...fresh,
      normalizedJacobianCondition: Number.isFinite(saved.normalizedJacobianCondition) ? saved.normalizedJacobianCondition : null,
      parametersAtBounds: Array.isArray(saved.parametersAtBounds) ? saved.parametersAtBounds.map(String) : [],
      nearEqualAlternativeMinima: Number.isFinite(saved.nearEqualAlternativeMinima) ? saved.nearEqualAlternativeMinima : null,
      alternativeSolutions: Array.isArray(saved.alternativeSolutions) ? saved.alternativeSolutions.filter((solution: any) => solution && typeof solution === "object" && solution.parameters && Object.values(solution.parameters).every(Number.isFinite)) : [],
      parameterStandardErrorsApproximate: saved.parameterStandardErrorsApproximate && typeof saved.parameterStandardErrorsApproximate === "object" ? saved.parameterStandardErrorsApproximate : {},
      parameterConfidenceIntervals95Approximate: validIntervals(saved.parameterConfidenceIntervals95Approximate) ? saved.parameterConfidenceIntervals95Approximate : {},
      parameterCorrelation: validCorrelation(saved.parameterCorrelation) ? saved.parameterCorrelation : { names: [], matrix: [] },
      bootstrap: validBootstrap ? bootstrap : null,
    };
  }

  private normalizeSavedOptimizer(saved: any) {
    const solver = saved?.selectedSolver;
    return {
      ...(saved ?? {}),
      logarithmicallySampledParameters: Array.isArray(saved?.logarithmicallySampledParameters) ? saved.logarithmicallySampledParameters : [],
      selectedSolver: solver && typeof solver === "object"
        ? { success: Boolean(solver.success), message: String(solver.message ?? "Saved fit loaded."), evaluations: Number.isFinite(solver.evaluations) ? solver.evaluations : 0, optimality: Number.isFinite(solver.optimality) ? solver.optimality : null }
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
    this.edit(() => {
      material.model = model;
      material.regularize = false;
      this.rebuildLayerSpecs(material);
    });
  };

  updateComponentCount = (materialId: string, component: "taucLorentz" | "lorentz", count: number) => {
    const material = this.materialById(materialId);
    if (!material) return;
    this.edit(() => {
      material.components[component] = count;
      this.rebuildLayerSpecs(material);
    });
  };

  toggleComponent = (materialId: string, component: string, checked: boolean) => {
    const material = this.materialById(materialId);
    if (!material) return;
    this.edit(() => {
      material.components[component] = checked;
      if (checked && component === "drude") material.components.drudeSmith = false;
      if (checked && component === "drudeSmith") material.components.drude = false;
      this.rebuildLayerSpecs(material);
    });
  };

  updateEmaMethod = (materialId: string, method: string) => {
    const material = this.materialById(materialId);
    if (!material) return;
    this.edit(() => { material.ema.method = method; });
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
    this.edit(() => { specification[kind] = value; });
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
    const snapshot: any = structuredClone({
      source: this.source,
      layers: this.layers,
      substrate: this.substrate,
      activeLayerId: this.activeLayerId,
      nextLayer: this.nextLayer,
      controls: { ...this.serializedControls(), "substrate-thickness": this.controls.substrateThicknessUm, incidence: this.controls.incidence },
    });
    snapshot.spectrum = this.spectrum;
    snapshot.layers.forEach((layer: any, index: number) => {
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

  private restoreHistorySnapshot(snapshot: any) {
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
    this.future.push(this.lastEditorSnapshot);
    this.restoreHistorySnapshot(this.history.pop());
  };

  redo = () => {
    if (!this.future.length) return;
    this.history.push(this.lastEditorSnapshot);
    this.restoreHistorySnapshot(this.future.pop());
  };

  restoreAutosave = (snapshot: any) => {
    if (!snapshot?.layers?.length || !snapshot.substrate) return this.showError(new Error("The saved session is incomplete."));
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

  private configuration() {
    if (!this.layers.length) throw new Error("Add at least one layer.");
    if (!this.controls.useReflectance && !this.controls.useTransmittance) throw new Error("Select R, T, or both channels.");
    const initial: any = { rGain: this.numberValue(this.controls.reflectanceGain, "R gain", 0.1, 10), tGain: this.numberValue(this.controls.transmittanceGain, "T gain", 0.1, 10) };
    const bounds: any = { rGain: [0.1, 10], tGain: [0.1, 10] };
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
    const settings = {
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

  private validateMaterial(material: any, initial: any, bounds: any, fittedParameters: string[]) {
    const prefix = material.id === "substrate" ? "Substrate" : material.name;
    if (TABLE_MODELS.has(material.model) && !material.nk) throw new Error(`${prefix}: ${MODEL_LABELS[material.model]} requires an n,k table.`);
    if (material.model === "composite" && !material.components.taucLorentz && !material.components.lorentz && !Object.keys(COMPONENT_LABELS).some((name) => material.components[name])) throw new Error(`${prefix}: select at least one dielectric component.`);
    if (material.model === "ema" && (!material.ema.hostNk || !material.ema.inclusionNk)) throw new Error(`${prefix}: load both EMA constituent n,k tables.`);
    for (const [name, specification] of Object.entries(material.specs) as [string, any][]) {
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
    for (const layer of this.layers.filter((candidate) => TABLE_MODELS.has(candidate.model))) data = restrictToNkRange(data, layer.nk);
    for (const layer of this.layers.filter((candidate) => candidate.model === "ema")) {
      data = restrictToNkRange(data, layer.ema.hostNk);
      data = restrictToNkRange(data, layer.ema.inclusionNk);
    }
    if (TABLE_MODELS.has(this.substrate.model)) data = restrictToNkRange(data, this.substrate.nk);
    if (this.substrate.model === "ema") {
      data = restrictToNkRange(data, this.substrate.ema.hostNk);
      data = restrictToNkRange(data, this.substrate.ema.inclusionNk);
    }
    this.fitData = data;
    return data;
  }

  private validateChannels(data: any, settings: any) {
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
      if (!config.fittedParameters.length) throw new Error("Select at least one parameter to fit.");
      const screeningPoints = this.integerValue(this.controls.screeningPoints, "Sobol points", 64, 4096);
      if (screeningPoints & (screeningPoints - 1)) throw new Error("Sobol points must be a power of two.");
      const localRefinements = this.integerValue(this.controls.localRefinements, "Local refinements", 1, 50);
      this.pushHistory();
      this.pendingConfiguration = config;
      this.startFitWorker(`Screening ${screeningPoints} Sobol points…`);
      this.worker!.postMessage({ fitData, nk: null, configuration: { ...config, screeningPoints, localRefinements } });
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
    this.worker?.terminate();
    this.worker = new Worker(new URL("../scientific/workers/fit-worker.ts", import.meta.url), { type: "module" });
    this.worker.addEventListener("message", this.handleWorkerMessage);
    this.worker.addEventListener("error", (event) => this.finishFitError(event.message));
    this.operation = { phase: "fitting", busy: true, message, progress: 0 };
    this.publish();
  }

  private handleWorkerMessage = ({ data }: MessageEvent<any>) => {
    if (data.type === "progress") return this.setStatus(`Fitting parameters… ${data.progress}%`, "fitting", data.progress);
    if (data.type === "bootstrap-progress") return this.setStatus(`Bootstrap refits… ${data.progress}%`, "fitting", data.progress);
    if (data.type === "bootstrap-result") {
      this.stopFitWorker(false);
      this.fitResult.diagnostics.bootstrap = data.result;
      this.setStatus(`Bootstrap complete: ${data.result.successfulSamples} of ${data.result.requestedSamples} refits converged.`, "bootstrap-success");
      return;
    }
    if (data.type === "error") return this.finishFitError(data.message);
    if (data.type !== "result") return;
    this.stopFitWorker(false);
    this.fitResult = { ...data.result, configuration: this.pendingConfiguration };
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
    this.setStatus(data.result.optimizer.selectedSolver.success ? "Fit complete." : `Fit stopped: ${data.result.optimizer.selectedSolver.message}`, data.result.optimizer.selectedSolver.success ? "fit-success" : "error");
  };

  private stopFitWorker(publish = true) {
    this.worker?.terminate();
    this.worker = null;
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

  private finishFitError(message: string) {
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
      (sum, material) => sum + Object.entries(material.specs).filter(([name, specification]: [string, any]) => specification.fit && !material.links?.[name]).length,
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
    if (!this.fitResult || this.fitResult.preview) throw new Error("Run a fit before exporting results.");
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
        parameters: Object.fromEntries(Object.keys(layer.specs).map((name) => [name, this.fitResult.parameters[`${layer.id}__${name}`]])),
        parameterSettings: Object.fromEntries(Object.entries(layer.specs).map(([name, specification]: [string, any]) => [name, { minimum: specification.minimum, maximum: specification.maximum, fit: specification.fit, uncertainty: specification.uncertainty ?? null }])),
        parameterLinks: { ...layer.links },
      })),
      substrate: {
        refractiveIndex: { n: this.evaluation.substrateIndex.n[Math.floor(this.fitData.wavelengthNm.length / 2)], k: this.evaluation.substrateIndex.k[Math.floor(this.fitData.wavelengthNm.length / 2)] },
        opticalModel: this.substrate.model,
        dielectricComponents: this.substrate.model === "composite" ? { ...this.substrate.components } : null,
        effectiveMedium: this.substrate.model === "ema" ? { method: this.substrate.ema.method, hostSource: this.substrate.ema.hostSource, inclusionSource: this.substrate.ema.inclusionSource, hostNk: this.substrate.ema.hostNk, inclusionNk: this.substrate.ema.inclusionNk } : null,
        nkSource: this.substrate.nkSource,
        nkTable: this.substrate.nk,
        regularizedToNk: this.substrate.regularize,
        parameters: Object.fromEntries(Object.keys(this.substrate.specs).map((name) => [name, this.fitResult.parameters[`substrate__${name}`]])),
        parameterSettings: Object.fromEntries(Object.entries(this.substrate.specs).map(([name, specification]: [string, any]) => [name, { minimum: specification.minimum, maximum: specification.maximum, fit: specification.fit, uncertainty: specification.uncertainty ?? null }])),
        thicknessUm: this.controls.substrateThicknessUm,
        incidence: this.controls.incidence,
      },
      gains: { reflectance: this.fitResult.parameters.rGain, transmittance: this.fitResult.parameters.tGain },
      diagnostics: this.fitResult.diagnostics,
      optimizer: this.fitResult.optimizer,
      assumptions: ["normal incidence", "homogeneous isotropic coherent layers", "finite phase-incoherent dispersive substrate", "Beer–Lambert substrate attenuation", "incoherent rear-surface returns"],
    };
  }

  createExport = (kind: "json" | "spectra" | "nk"): ExportFile => {
    this.exportPayload();
    const base = safeName(this.source?.sampleName);
    if (kind === "json") return { content: JSON.stringify(this.exportPayload(), null, 2), name: `${base}-multilayer-fit.json`, type: "application/json;charset=utf-8" };
    if (kind === "spectra") {
      const header = "wavelength_nm,reflectance_data,transmittance_data,reflectance_valid,transmittance_valid,reflectance_model,transmittance_model,reflectance_residual,transmittance_residual";
      const rows = this.fitData.wavelengthNm.map((wavelength: number, index: number) => [wavelength, this.fitData.reflectance[index], this.fitData.transmittance[index], this.fitData.reflectanceValid[index], this.fitData.transmittanceValid[index], this.evaluation.reflectanceScaled[index], this.evaluation.transmittanceScaled[index], this.fitData.reflectanceValid[index] ? this.evaluation.reflectanceScaled[index] - this.fitData.reflectance[index] : "", this.fitData.transmittanceValid[index] ? this.evaluation.transmittanceScaled[index] - this.fitData.transmittance[index] : ""].join(","));
      return { content: `${[header, ...rows].join("\n")}\n`, name: `${base}-multilayer-spectra.csv`, type: "text/csv;charset=utf-8" };
    }
    const header = "layer_order,layer_id,layer_name,model,wavelength_nm,n,k";
    const materials = [...this.evaluation.layerIndices, { id: "substrate", name: "Substrate", model: this.substrate.model, ...this.evaluation.substrateIndex }];
    const rows = materials.flatMap((layer: any, order: number) => this.fitData.wavelengthNm.map((wavelength: number, index: number) => [order + 1, layer.id, csvCell(layer.name), layer.model, wavelength, layer.n[index], layer.k[index]].join(",")));
    return { content: `${[header, ...rows].join("\n")}\n`, name: `${base}-multilayer-nk.csv`, type: "text/csv;charset=utf-8" };
  };
}
