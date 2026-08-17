import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("keeps responsive panels and floating actions inside their owning React viewport", async () => {
  const [workspace, statusBar, styles, plot, results] = await Promise.all([
    read("src/features/measurement/WorkspaceView.tsx"),
    read("src/features/results/ResultsStatusBar.tsx"),
    read("src/styles/carbon.scss"),
    read("src/shared/plots/PlotCard.tsx"),
    read("src/features/results/ResultsWorkspace.tsx"),
  ]);

  assert.match(workspace, /useRef<HTMLElement>/);
  assert.match(workspace, /lastTriggerRef/);
  assert.match(workspace, /query\.addEventListener\("change", updateLayout\)/);
  assert.match(workspace, /query\.removeEventListener\("change", updateLayout\)/);
  assert.match(workspace, /panelRef\.current\?\.querySelector<HTMLElement>\("\.scientific-task-panel__heading h2"\)\?\.focus\(\)/);
  assert.match(workspace, /onKeyDown=/);
  assert.match(workspace, /event\.key === "Escape"/);
  assert.match(workspace, /inert=\{state\.operation\.busy\}/);
  assert.match(workspace, /aria-busy=\{state\.operation\.busy\}/);
  assert.match(workspace, /hidden=\{!activeSection\}/);
  assert.match(workspace, /className="results scientific-stage"/);
  assert.match(workspace, /aria-hidden=\{overlayPanelOpen \|\| undefined\}/);
  assert.match(workspace, /inert=\{overlayPanelOpen\}/);
  assert.doesNotMatch(workspace, /document\.(?:getElementById|querySelector|querySelectorAll)|dispatchEvent|\.click\(\)|MutationObserver/);

  assert.match(statusBar, /<ScientificStatusBar/);
  assert.match(statusBar, /<OverflowMenu/);
  assert.match(statusBar, /onClick=\{actions\.cancel\}/);
  assert.match(statusBar, /URL\.createObjectURL/);
  assert.match(statusBar, /URL\.revokeObjectURL/);
  assert.match(statusBar, /href=\{exports\?\./);
  assert.doesNotMatch(statusBar, /data-export-target|document\.|\.click\(\)|dispatchEvent/);

  assert.match(plot, /createScientificPlotlyConfig/);
  assert.match(plot, /createScientificPlotlyLayout/);
  assert.match(plot, /prepareScientificPlotlyToolbar/);
  assert.match(plot, /Plotly\.react/);
  assert.match(plot, /ResizeObserver/);
  assert.match(plot, /plotlyRef\.current\.purge/);
  assert.match(plot, /collectPlotStatistics/);
  assert.match(plot, /scientific-visually-hidden/);
  assert.match(plot, /aria-describedby=\{`\$\{plotId\}-help \$\{plotId\}-summary`\}/);
  assert.match(plot, /onClick=\{\(\) =>/);
  assert.doesNotMatch(plot, /document\.(?:getElementById|querySelector|querySelectorAll|createElement)|appendChild|replaceChildren|textContent\s*=|innerHTML\s*=|classList\.(?:add|remove|toggle)/);

  assert.match(results, /state\.layers\.map/);
  assert.match(results, /state\.controls\.substrateThicknessUm/);
  assert.match(results, /data-correlation=\{value >= 0 \? "positive" : "negative"\}/);
  assert.match(results, /style=\{\{ "--correlation-strength"/);
  assert.doesNotMatch(results, /document\.|createElement|replaceChildren|textContent\s*=|innerHTML\s*=|\.click\(\)/);

  assert.match(styles, /\.configuration-panel-body \{[^}]*overflow-y: auto;/s);
  assert.match(styles, /\.results-content \{[^}]*min-inline-size: 0;/s);
  assert.doesNotMatch(styles, /\.results-tab-list \{ overflow-x: auto; \}/);
  assert.match(styles, /\.table-scroll \{[^}]*overflow-x: auto;/s);
  assert.match(styles, /\.parameter-row \{ display: grid; grid-template-columns: 3\.5rem/);
  assert.match(styles, /\.parameter-row,\n {2}\.parameter-row:has\(> :nth-child\(3\):last-child\) \{ grid-template-columns: repeat\(2, minmax\(0, 1fr\)\)/);
  assert.doesNotMatch(styles, /\.workflow-navigation\s+(?:ul|li|\.cds--btn)/);
  assert.match(styles, /@media \(max-width: 65\.99rem\)/);
  assert.match(styles, /@container \(max-width: 38rem\)/);
  assert.match(styles, /\.plotly-chart \{[^}]*block-size: 330px;/s);
  assert.doesNotMatch(styles, /\.plotly-chart \.modebar|file-selector-button|grid-template-columns: 1\.5rem repeat\(4/);
});
