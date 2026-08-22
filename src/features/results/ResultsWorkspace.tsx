import { Accordion, AccordionItem, Button, InlineNotification, Tab, TabList, TabPanel, TabPanels, Tabs } from "@carbon/react";
import { ScientificMetricGrid } from "@jorpago2/scientific-ui";
import { useMemo } from "react";
import { useReflectometry } from "../../app/reflectometry-context.ts";
import PlotCard, { type PlotSeries } from "../../shared/plots/PlotCard.tsx";
import ResultsEmpty from "./ResultsEmpty.tsx";
import ResultsOutcome from "./ResultsOutcome.tsx";

function format(value: unknown, digits = 3) {
  return Number.isFinite(value) ? Number(value).toFixed(digits).replace(/\.?0+$/, "") : "—";
}

function StackDiagram() {
  const [state, actions] = useReflectometry();
  const fromSubstrate = state.controls.incidence === "substrate";
  const substrateDescription = state.substrate.model === "constant"
    ? `N = ${format(state.substrate.specs.n.value, 3)} + ${format(state.substrate.specs.k.value, 3)}i`
    : actions.modelLabel(state.substrate.model);
  return (
    <section className="stack-card" aria-labelledby="stack-title">
      <div className="section-heading"><p>Structure</p><h2 id="stack-title">Layer stack</h2></div>
      <figure className="stack-figure">
        <div className="stack-beam"><span>INCIDENT / {fromSubstrate ? "SUBSTRATE" : "STACK"} SIDE</span><strong aria-hidden="true">{fromSubstrate ? "↑" : "↓"}</strong><small>LIGHT</small></div>
        <div className="stack-diagram">
          <div className="stack-medium stack-air"><strong>Ambient</strong><span>air · n = 1.000</span></div>
          <ol className="stack-layers">
            {state.layers.map((layer, index) => <li key={layer.id} className={`stack-layer${layer.id === state.activeLayerId ? " active" : ""}`}>
              <span className="stack-layer__order">{String(index + 1).padStart(2, "0")}</span>
              <div><strong>{layer.name}</strong><small>{actions.modelLabel(layer.model)}</small></div>
              <span>{format(layer.specs.thicknessNm?.value, 2)} nm</span>
            </li>)}
          </ol>
          <div className="stack-medium stack-substrate"><strong>Substrate</strong><span>{substrateDescription} · {format(state.controls.substrateThicknessUm, 3)} µm</span></div>
        </div>
        <figcaption>Schematic view · layer thicknesses are labelled, not drawn to scale.</figcaption>
      </figure>
    </section>
  );
}

function UncertaintyPanel() {
  const [state, actions] = useReflectometry();
  const result = state.fitResult;
  if (!result) return <p>Run a fit to estimate uncertainty.</p>;
  const diagnostics = result.diagnostics;
  const bootstrap = diagnostics.bootstrap;
  const intervals = bootstrap?.parameterIntervals ?? diagnostics.parameterConfidenceIntervals95Approximate ?? {};
  const correlation = bootstrap?.parameterCorrelation ?? diagnostics.parameterCorrelation;
  const intervalLabel = bootstrap ? "Bootstrap 95% parameter intervals" : "Approximate 95% parameter intervals from the local Jacobian";
  return <div className="uncertainty-content">
    <p>{bootstrap ? `${bootstrap.method}; ${bootstrap.successfulSamples}/${bootstrap.requestedSamples} successful refits. Evidence mode: ${bootstrap.evidenceMode === "reporting-support" ? "reporting support" : "exploratory"}.` : "Approximate 95% intervals and correlations from the local Jacobian. Run the bootstrap before reporting uncertainty."}</p>
    {Object.keys(intervals).length > 0 && <div className="table-scroll" tabIndex={0} aria-label={intervalLabel}>
      <table className="scientific-data-table"><caption className="visually-hidden">{intervalLabel}</caption><thead><tr><th scope="col">Parameter</th><th scope="col">Lower 95%</th><th scope="col">Estimate</th><th scope="col">Upper 95%</th></tr></thead><tbody>
        {Object.entries(intervals).map(([name, interval]) => interval && <tr key={name}><th scope="row">{actions.parameterLabel(name)}</th><td>{format(interval.lower95, 5)}</td><td>{format(result.parameters[name] ?? ("median" in interval ? interval.median : null), 5)}</td><td>{format(interval.upper95, 5)}</td></tr>)}
      </tbody></table>
    </div>}
    {correlation?.matrix?.length > 0 && <>
      <h3>Parameter correlation</h3>
      <div className="table-scroll" tabIndex={0} aria-label="Parameter correlation matrix">
        <table className="scientific-data-table correlation-table"><caption className="visually-hidden">Parameter correlation matrix</caption><thead><tr><th scope="col" />{correlation.names.map((name: string) => <th key={name} scope="col">{actions.parameterLabel(name)}</th>)}</tr></thead><tbody>
          {correlation.matrix.map((values: number[], row: number) => <tr key={correlation.names[row]}><th scope="row">{actions.parameterLabel(correlation.names[row])}</th>{values.map((value, column) => <td key={`${row}-${column}`} data-correlation={value >= 0 ? "positive" : "negative"} style={{ "--correlation-strength": `${8 + 52 * Math.abs(value)}%` } as React.CSSProperties}>{format(value, 2)}</td>)}</tr>)}
        </tbody></table>
      </div>
    </>}
  </div>;
}

function AlternativeSolutions() {
  const [state, actions] = useReflectometry();
  const solutions = state.fitResult?.diagnostics?.alternativeSolutions ?? [];
  if (!solutions.length) return <p>No distinct local alternatives were retained.</p>;
  return <div className="alternative-solutions">{solutions.map((solution, index) => <article className="fit-solution" key={solution.rank}>
    <div><strong>Solution {solution.rank}</strong><span>Δcost {format(100 * solution.relativeCostIncrease, 2)}% · distance {format(solution.normalizedParameterDistanceFromBest, 3)}</span></div>
    <Button kind="tertiary" size="sm" type="button" onClick={() => actions.applyAlternative(index)}>Use as new start</Button>
  </article>)}</div>;
}

function FitQuality() {
  const [state] = useReflectometry();
  const result = state.fitResult;
  if (!result) return null;
  const diagnostics = result.diagnostics;
  const totalThickness = state.layers.reduce((sum, layer) => sum + result.parameters[`${layer.id}__thicknessNm`], 0);
  return <div className="result-column">
    <ScientificMetricGrid columns={4} metrics={[
      { id: "thickness", label: "Total thickness", value: format(totalThickness, 2), unit: "nm" },
      { id: "rmse-r", label: "RMSE(R)", value: format(diagnostics.rmseReflectance, 5), unit: "fraction" },
      { id: "rmse-t", label: "RMSE(T)", value: format(diagnostics.rmseTransmittance, 5), unit: "fraction" },
      { id: "fit-parameters", label: "Fit parameters", value: String(result.configuration?.fittedParameters?.length ?? state.selectedFitCount), unit: "selected" },
    ]} />
    <section className="diagnostics" aria-labelledby="diagnostics-title">
      <div className="section-heading"><p>Fit health</p><h2 id="diagnostics-title">Diagnostics</h2></div>
      <ScientificMetricGrid columns={4} metrics={[
        { id: "convergence", label: "Convergence", value: result.preview ? "Preview" : result.optimizer?.selectedSolver?.success ? "Converged" : "Stopped", detail: result.preview ? "No optimizer run" : `${result.optimizer?.selectedSolver?.evaluations ?? 0} selected-start evaluations` },
        { id: "condition", label: "Jacobian condition", value: Number.isFinite(diagnostics.normalizedJacobianCondition) ? Number(diagnostics.normalizedJacobianCondition).toExponential(2) : "—", detail: "Large means non-identifiable" },
        { id: "bounds", label: "Bound hits", value: diagnostics.parametersAtBounds?.length ? diagnostics.parametersAtBounds.join(", ") : "None", detail: "Fitted parameters" },
        { id: "power", label: "Max R + T", value: format(diagnostics.maximumPowerBalance, 5), detail: "Physical model" },
      ]} />
      <p>{(diagnostics.nearEqualAlternativeMinima ?? 0) > 0 ? `${diagnostics.nearEqualAlternativeMinima} near-equal alternative minima were found; report parameter ambiguity.` : "Check residual structure, bound hits and Jacobian conditioning before interpreting fitted optical constants."}</p>
      <Accordion className="result-details" size="sm">
        <AccordionItem title="Parameter uncertainty and correlation"><UncertaintyPanel /></AccordionItem>
        <AccordionItem title="Alternative fitted solutions"><AlternativeSolutions /></AccordionItem>
      </Accordion>
    </section>
  </div>;
}

export default function ResultsWorkspace() {
  const [state, actions] = useReflectometry();
  const plots = useMemo(() => {
    const fitData = state.fitData;
    const evaluation = state.evaluation;
    if (!fitData || !evaluation?.layerIndices?.length) return null;
    const x = fitData.wavelengthNm;
    const bands = state.fitResult?.diagnostics?.bootstrap?.bands;
    const rt: PlotSeries[] = [
      ...(bands ? [
        { lower: bands.reflectance.map((entry) => entry.lower95), upper: bands.reflectance.map((entry) => entry.upper95), color: "r" as const, band: true },
        { lower: bands.transmittance.map((entry) => entry.lower95), upper: bands.transmittance.map((entry) => entry.upper95), color: "t" as const, band: true },
      ] : []),
      { label: "R data", values: fitData.reflectance.map((value, index) => fitData.reflectanceValid[index] ? value : Number.NaN), color: "r", points: true, marker: "circle", line: false },
      { label: "R model", values: evaluation.reflectanceScaled, color: "r" },
      { label: "T data", values: fitData.transmittance.map((value, index) => fitData.transmittanceValid[index] ? value : Number.NaN), color: "t", points: true, marker: "square", line: false },
      { label: "T model", values: evaluation.transmittanceScaled, color: "t", dash: true },
    ];
    const residual: PlotSeries[] = [
      { label: "R residual", values: evaluation.reflectanceScaled.map((value, index) => fitData.reflectanceValid[index] ? value - fitData.reflectance[index] : Number.NaN), color: "r" },
      { label: "T residual", values: evaluation.transmittanceScaled.map((value, index) => fitData.transmittanceValid[index] ? value - fitData.transmittance[index] : Number.NaN), color: "t", dash: true },
    ];
    const active = evaluation.layerIndices.find((layer) => layer.id === state.activeLayerId) ?? evaluation.layerIndices[0];
    const activeBands = bands?.layers?.[active.id] ?? (bands?.layerId === active.id ? bands : null);
    const nk: PlotSeries[] = [
      ...(activeBands ? [
        { lower: activeBands.n.map((entry) => entry.lower95), upper: activeBands.n.map((entry) => entry.upper95), color: "r" as const, band: true },
        { lower: activeBands.k.map((entry) => entry.lower95), upper: activeBands.k.map((entry) => entry.upper95), color: "t" as const, band: true },
      ] : []),
      { label: "n", values: active.n, color: "r" },
      { label: "k", values: active.k, color: "t", dash: true },
    ];
    return { x, rt, residual, nk, activeLabel: `${active.name} · ${actions.modelLabel(active.model)}` };
  }, [actions, state.activeLayerId, state.evaluation, state.fitData, state.fitResult]);

  return <>
    {state.operation.phase === "error" && <InlineNotification className="runtime-notification" hideCloseButton kind="error" lowContrast title="The calculation needs attention" subtitle={state.operation.message.replace(/^Error:\s*/, "")} />}
    {!state.hasResult || !plots ? <ResultsEmpty /> : <div className="results-content">
      <ResultsOutcome />
      <Tabs>
        <TabList contained className="results-tab-list cds--tabs--full-width" aria-label="Result views">
          <Tab>Overview</Tab><Tab aria-label="Fit quality">Quality</Tab><Tab aria-label="Optical n,k">n,k</Tab>
        </TabList>
        <TabPanels>
          <TabPanel className="results-tab-panel overview-panel">
            <PlotCard title="Reflectance and transmittance" plotId="rt-chart" label="Interactive reflectance and transmittance spectra" x={plots.x} series={plots.rt} xLabel="Wavelength (nm)" yLabel="Reflectance / transmittance" minimumY={0} />
            <StackDiagram />
          </TabPanel>
          <TabPanel className="results-tab-panel">
            <FitQuality />
            <PlotCard title="Spectral residuals" plotId="residual-chart" label="Interactive spectral residuals" x={plots.x} series={plots.residual} xLabel="Wavelength (nm)" yLabel="Residual (model − data)" symmetricY />
          </TabPanel>
          <TabPanel className="results-tab-panel">
            <PlotCard eyebrow={plots.activeLabel} title="Complex refractive index" plotId="nk-chart" label="Interactive active-layer refractive index" x={plots.x} series={plots.nk} xLabel="Wavelength (nm)" yLabel="Optical constants, n and k" minimumY={0} />
            <section className="provenance"><Accordion size="sm"><AccordionItem title="Model assumptions and scope"><p>Normal incidence; homogeneous isotropic coherent layers; finite phase-incoherent dispersive substrate with Beer–Lambert attenuation and incoherent rear-surface returns. Surface roughness, gradients, anisotropy, scattering and oblique incidence are not included.</p></AccordionItem></Accordion></section>
          </TabPanel>
        </TabPanels>
      </Tabs>
    </div>}
  </>;
}
