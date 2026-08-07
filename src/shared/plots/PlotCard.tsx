import { Button } from "@carbon/react";

export type PlotCardProps = {
  eyebrow?: string;
  title: string;
  canvasId: string;
  label: string;
  legend: Array<{ className: string; text: string }>;
  eyebrowId?: string;
};

export default function PlotCard({ eyebrow, title, canvasId, label, legend, eyebrowId }: PlotCardProps) {
  return (
    <section className="plot-card">
      <div className="plot-heading">
        <div>{eyebrow ? <p id={eyebrowId}>{eyebrow}</p> : null}<h2>{title}</h2></div>
        <ul className="legend" aria-label={`${title} legend`}>{legend.map((item) => <li className={item.className} key={item.text}>{item.text}</li>)}</ul>
      </div>
      <div className="chart-shell"><div id={canvasId} className="plotly-chart" tabIndex={0} role="img" aria-label={label} aria-describedby={`${canvasId}-help`} /></div>
      <div className="chart-toolbar"><span id={`${canvasId}-help`}>Hover to inspect · Wheel or +/- to zoom · Drag or ←/→ to pan</span><Button className="chart-reset" kind="ghost" size="sm" type="button" data-reset-chart={canvasId}>Reset view</Button></div>
    </section>
  );
}
