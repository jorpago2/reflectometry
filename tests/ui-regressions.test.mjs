import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("keeps responsive panels and floating actions inside their owning viewport", async () => {
  const [workspace, statusBar, styles, app] = await Promise.all([
    read("src/features/measurement/WorkspaceView.tsx"),
    read("src/features/results/ResultsStatusBar.tsx"),
    read("src/styles/carbon.scss"),
    read("src/multilayer-app.ts"),
  ]);

  assert.match(workspace, /scrollTo\(\{ top: 0 \}\)/);
  assert.match(workspace, /getElementById\("results-content"\)\?\.scrollTo\(\{ top: 0 \}\)/);
  assert.match(workspace, /inert=\{overlayPanelOpen\}/);
  assert.match(workspace, /aria-hidden=\{overlayPanelOpen \|\| undefined\}/);
  assert.match(workspace, /size="sm" isFlush/);
  assert.match(statusBar, /direction="top" flipped/);
  assert.match(workspace, /\(max-width: 65\.98rem\)/);
  assert.match(styles, /grid-template-rows: minmax\(0, 1fr\)/);
  assert.match(styles, /@include breakpoint\.breakpoint-down\("lg"\)/);
  assert.match(styles, /\.controls \{[^}]*min-block-size: 0;[^}]*block-size: 100%;[^}]*overflow: auto;/s);
  assert.match(styles, /\.configuration-panel-heading \{[^}]*z-index: 2;/s);
  assert.equal(styles.match(/padding: 0 spacing\.\$spacing-05 spacing\.\$spacing-05;/g)?.length, 2);
  assert.match(styles, /\.parameter-help-popover \{[^\n]*inset-block-end:/);
  assert.match(styles, /\.parameter-help-popover \{[^\n]*inset-inline-end: 0;/);
  assert.match(styles, /\.parameter-help-popover \{[^\n]*inline-size: min\(18rem, 100%\);/);
  assert.match(styles, /\.status-row #fit-progress \{[^\n]*grid-column: 2;/);
  assert.match(styles, /\.status-row:has\(#fit-progress:not\(\[hidden\]\)\) \.export-menu \{ display: none; \}/);
  assert.match(styles, /\.result-panel-content \{[^\n]*overflow-x: auto;/);
  assert.match(styles, /\.controls\[data-configuration-mode="basic"\]/);
  assert.match(styles, /\.parameter-row \{ grid-template-columns: repeat\(2, minmax\(0, 1fr\)\)/);
  assert.match(styles, /\.parameter-field-minimum \{ grid-column: 1; grid-row: 3; \}/);
  assert.match(styles, /\.parameter-field-maximum \{ grid-column: 2; grid-row: 3; \}/);
  assert.match(styles, /\.plotly-chart \.modebar-group \.modebar-btn \{[^\n]*inline-size: 2\.75rem;[^\n]*min-block-size: 2\.75rem;[^\n]*block-size: 2\.75rem;/);
  assert.match(styles, /\.plotly-chart\.js-plotly-plot \.plotly \.modebar-group \{ display: contents; \}/);
  assert.match(styles, /\.layer-actions button \{[^\n]*inline-size: 2\.75rem;[^\n]*block-size: 2\.75rem;/);
  assert.match(app, /const compactModebar = chart\.getBoundingClientRect\(\)\.width < 308/);
  assert.match(app, /t: compactModebar \? 112 : 56/);
  assert.match(app, /function configurePlotlyControls\(/);
  assert.match(app, /button\.tabIndex = 0/);
  assert.doesNotMatch(styles, /grid-template-columns: 1\.5rem repeat\(4/);
  assert.match(app, /cell\.dataset\.correlation/);
  assert.doesNotMatch(app, /cell\.style\.backgroundColor/);
  assert.match(app, /function fileControl\(/);
  assert.match(app, /input\.className = "visually-hidden"/);
  assert.doesNotMatch(styles, /file-selector-button/);
});
