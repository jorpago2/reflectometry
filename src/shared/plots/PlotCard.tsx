import { Button } from "@carbon/react";
import { ScientificPlotFrame, type ScientificPlotLegendItem } from "@jorpago2/scientific-ui";

export type PlotCardProps = {
  eyebrow?: string;
  title: string;
  canvasId: string;
  label: string;
  legend: Array<{ className: string; text: string }>;
  eyebrowId?: string;
};

export default function PlotCard({ eyebrow, title, canvasId, label, legend, eyebrowId }: PlotCardProps) {
  const scientificLegend: ScientificPlotLegendItem[] = legend.map((item) => ({
    id: item.text,
    label: item.text,
    color: item.className.startsWith("r-") || item.className === "n-line" ? "var(--color-plot-r)" : "var(--color-plot-t)",
    style: item.className.endsWith("data") ? "dot" : item.className === "t-model" || item.className === "k-line" ? "dash" : "line",
  }));
  return (
    <ScientificPlotFrame
      className="plot-card"
      eyebrow={eyebrow ? <span id={eyebrowId}>{eyebrow}</span> : undefined}
      title={title}
      legend={scientificLegend}
      instructions={<span id={`${canvasId}-help`}>Hover to inspect · Wheel or +/- to zoom · Drag or ←/→ to pan</span>}
      actions={<Button className="chart-reset" kind="ghost" size="lg" type="button" data-reset-chart={canvasId}>Reset view</Button>}
    >
      <div id={canvasId} className="plotly-chart scientific-plot-surface" tabIndex={0} role="img" aria-label={label} aria-describedby={`${canvasId}-help`} />
    </ScientificPlotFrame>
  );
}
