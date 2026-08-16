import { Button } from "@carbon/react";
import {
  SCIENTIFIC_PLOT_LINE_WIDTHS,
  ScientificPlotFrame,
  createScientificPlotlyConfig,
  createScientificPlotlyLayout,
  prepareScientificPlotlyToolbar,
  type ScientificPlotLegendItem,
} from "@jorpago2/scientific-ui";
import { useEffect, useMemo, useRef, useState, type KeyboardEvent, type MouseEvent } from "react";
import type { Config, Data, Layout, PlotlyHTMLElement } from "plotly.js";

type PlotlyApi = typeof import("plotly.js");
type PlotRoot = PlotlyHTMLElement & { removeListener?: (event: "plotly_relayout", callback: () => void) => void };

export type PlotSeries = {
  band?: boolean;
  color: "r" | "t";
  dash?: boolean;
  label?: string;
  line?: boolean;
  lower?: number[];
  marker?: "circle" | "square";
  points?: boolean;
  upper?: number[];
  values?: number[];
};

export type PlotCardProps = {
  eyebrow?: string;
  title: string;
  plotId: string;
  label: string;
  series: PlotSeries[];
  x: number[];
  xLabel: string;
  yLabel: string;
  minimumY?: number;
  symmetricY?: boolean;
};

function token(name: string, fallback: string) {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback;
}

function syncToolbarToggleState(root: Element) {
  const frame = root.matches(".scientific-plot-frame") ? root : root.closest(".scientific-plot-frame");
  const scope = frame ?? root;
  scope.querySelectorAll<HTMLElement>('.modebar-btn[data-attr="dragmode"]').forEach((button) => {
    button.setAttribute("aria-pressed", String(button.classList.contains("active")));
  });
  const fullscreen = scope.querySelector<HTMLElement>('.modebar-btn[data-title="Toggle fullscreen"]');
  if (fullscreen) fullscreen.setAttribute("aria-pressed", String(frame?.classList.contains("scientific-plot-frame--fullscreen") ?? false));
}

function prepareToolbar(root: Element) {
  prepareScientificPlotlyToolbar(root);
  syncToolbarToggleState(root);
}

function scheduleToolbarToggleState(root: Element) {
  window.requestAnimationFrame(() => window.requestAnimationFrame(() => syncToolbarToggleState(root)));
}

export default function PlotCard({ eyebrow, title, plotId, label, series, x, xLabel, yLabel, minimumY, symmetricY }: PlotCardProps) {
  const plotRef = useRef<HTMLDivElement>(null);
  const plotlyRef = useRef<PlotlyApi | null>(null);
  const [compactToolbar, setCompactToolbar] = useState(false);
  const [themeRevision, setThemeRevision] = useState(0);
  const legend = useMemo<ScientificPlotLegendItem[]>(() => series.filter((entry) => entry.label).map((entry) => ({
    id: entry.label!,
    label: entry.label!,
    color: entry.color === "r" ? "var(--color-plot-r)" : "var(--color-plot-t)",
    style: entry.points && entry.line === false ? "dot" : entry.dash ? "dash" : "line",
  })), [series]);

  useEffect(() => {
    const updateTheme = () => setThemeRevision((current) => current + 1);
    window.addEventListener("scientific-ui:theme-applied", updateTheme);
    return () => window.removeEventListener("scientific-ui:theme-applied", updateTheme);
  }, []);

  useEffect(() => {
    const chart = plotRef.current;
    if (!chart) return;
    const observer = new ResizeObserver(([entry]) => {
      const compact = entry.contentRect.width < 400;
      setCompactToolbar((current) => current === compact ? current : compact);
    });
    observer.observe(chart);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const chart = plotRef.current;
    if (!chart || !x.length || !series.length) return;
    let active = true;
    let resizeObserver: ResizeObserver | null = null;
    let plotRoot: PlotRoot | null = null;
    const syncPlotlyMode = () => scheduleToolbarToggleState(chart);
    const colors = {
      r: token("--color-plot-r", "#4589ff"),
      t: token("--color-plot-t", "#08bdba"),
      rBand: token("--color-plot-r-band", "rgba(69,137,255,.16)"),
      tBand: token("--color-plot-t-band", "rgba(8,189,186,.16)"),
    };
    const traces = series.flatMap<Data>((entry) => entry.band ? [
      { type: "scatter", mode: "lines", x, y: entry.lower, line: { width: 0 }, hoverinfo: "skip", showlegend: false },
      { type: "scatter", mode: "lines", x, y: entry.upper, line: { width: 0 }, fill: "tonexty", fillcolor: entry.color === "r" ? colors.rBand : colors.tBand, hoverinfo: "skip", showlegend: false },
    ] : [{
      type: "scatter",
      mode: entry.line === false ? "markers" : entry.points ? "lines+markers" : "lines",
      name: entry.label,
      x,
      y: entry.values,
      line: { color: colors[entry.color], width: SCIENTIFIC_PLOT_LINE_WIDTHS.primary, dash: entry.dash ? "dash" : "solid" },
      marker: { color: colors[entry.color], size: entry.points ? 5 : 0, symbol: entry.marker === "square" ? "square" : "circle" },
      hovertemplate: `${entry.label}: %{y:.4g}<extra></extra>`,
    }]);
    const values = series.flatMap((entry) => [entry.values, entry.lower, entry.upper].filter(Boolean).flat() as number[]).filter(Number.isFinite);
    const maximumAbsolute = Math.max(1e-12, ...values.map(Math.abs));
    const layout = createScientificPlotlyLayout({
      height: 330,
      margin: compactToolbar ? { l: 52, r: 8, t: 40, b: 52 } : { l: 68, r: 20, t: 56, b: 56 },
      uirevision: plotId,
      showlegend: false,
      theme: {
        background: token("--plot-background", "#ffffff"),
        text: token("--plot-text", "#525252"),
        textSecondary: token("--plot-text", "#525252"),
        grid: token("--plot-grid", "#e0e0e0"),
        axis: token("--plot-axis", "#8d8d8d"),
      },
      xTitle: xLabel,
      yTitle: yLabel,
      overrides: { yaxis: {
        title: { text: yLabel },
        ...(symmetricY ? { range: [-maximumAbsolute * 1.08, maximumAbsolute * 1.08] } : {}),
        ...(!symmetricY && minimumY != null ? { rangemode: "tozero" } : {}),
      } },
    });
    const config = createScientificPlotlyConfig({
      filename: plotId,
      scrollZoom: true,
      removeButtons: compactToolbar ? ["toImage", "zoomIn2d", "zoomOut2d"] : [],
    });
    void import("plotly.js-basic-dist-min").then(({ default: Plotly }) => {
      if (!active) return;
      plotlyRef.current = Plotly;
      void Plotly.react(chart, traces, layout as Partial<Layout>, config as Partial<Config>).then((root) => {
        plotRoot = root;
        prepareToolbar(root);
        root.on("plotly_relayout", syncPlotlyMode);
      });
      resizeObserver = new ResizeObserver(() => {
        void Promise.resolve(Plotly.Plots.resize(chart)).then(() => {
          const surface = chart.closest(".scientific-plot-frame__surface") ?? chart;
          window.requestAnimationFrame(() => prepareToolbar(surface));
        });
      });
      resizeObserver.observe(chart);
    });
    return () => {
      active = false;
      resizeObserver?.disconnect();
      plotRoot?.removeListener?.("plotly_relayout", syncPlotlyMode);
      if (plotlyRef.current) plotlyRef.current.purge(chart);
    };
  }, [compactToolbar, minimumY, plotId, series, symmetricY, themeRevision, x, xLabel, yLabel]);

  const syncTogglesAfterInteraction = (event: MouseEvent<HTMLElement> | KeyboardEvent<HTMLElement>) => {
    const target = event.target instanceof Element ? event.target.closest(".modebar-btn") : null;
    if (target || ("key" in event && event.key === "Escape")) {
      scheduleToolbarToggleState(event.currentTarget);
    }
  };

  return (
    <ScientificPlotFrame
      className="plot-card"
      eyebrow={eyebrow}
      title={title}
      legend={legend}
      instructions={<span id={`${plotId}-help`}>{compactToolbar ? "Tap to inspect · Pinch or choose Zoom · Drag to pan" : "Hover to inspect · Wheel or +/- to zoom · Drag or ←/→ to pan"}</span>}
      actions={<Button className="chart-reset" kind="ghost" size="lg" type="button" onClick={() => { if (plotRef.current && plotlyRef.current) void plotlyRef.current.relayout(plotRef.current, { "xaxis.autorange": true, "yaxis.autorange": true }); }}>Reset view</Button>}
    >
      <div
        ref={plotRef}
        className="plotly-chart scientific-plot-surface"
        tabIndex={0}
        role="img"
        aria-label={label}
        aria-describedby={`${plotId}-help`}
        onClickCapture={syncTogglesAfterInteraction}
        onKeyUpCapture={syncTogglesAfterInteraction}
      />
    </ScientificPlotFrame>
  );
}
