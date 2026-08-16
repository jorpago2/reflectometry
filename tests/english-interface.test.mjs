import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("ships one English-only material-agnostic React interface", async () => {
  const [index, main, app, workspace, measurement, layers, fit, results, outcome, statusBar, plot, navigation, runtime, help, core, models, carbonBase, styles, vite, packageJson] = await Promise.all([
    read("index.html"),
    read("src/main.tsx"),
    read("src/app/App.tsx"),
    read("src/features/measurement/WorkspaceView.tsx"),
    read("src/features/measurement/MeasurementPanel.tsx"),
    read("src/features/layer-stack/LayerStackEditor.tsx"),
    read("src/features/fit/FitPanel.tsx"),
    read("src/features/results/ResultsWorkspace.tsx"),
    read("src/features/results/ResultsOutcome.tsx"),
    read("src/features/results/ResultsStatusBar.tsx"),
    read("src/shared/plots/PlotCard.tsx"),
    read("src/shared/carbon/WorkspaceNavigation.tsx"),
    read("src/runtime/reflectometry-store.ts"),
    read("src/features/layer-stack/model-help.ts"),
    read("src/scientific/solvers/scientific-core.ts"),
    read("src/scientific/models/dielectric-models.ts"),
    read("src/styles/carbon-base.scss"),
    read("src/styles/carbon.scss"),
    read("vite.config.ts"),
    read("package.json"),
  ]);
  const ui = [app, workspace, measurement, layers, fit, results, outcome, statusBar, plot, navigation, runtime].join("\n");
  const combined = [ui, help, core, models].join("\n");

  assert.match(index, /<html lang="en">/);
  for (const metadata of ["theme-color", "canonical", "favicon.svg", "og:site_name", "og:url", "og:image:alt", "twitter:title", "twitter:description", "twitter:image:alt"]) {
    assert.match(index, new RegExp(metadata));
  }
  assert.match(index, /src="\/src\/main\.tsx"/);
  assert.match(main, /createRoot/);
  assert.match(main, /ScientificUiProvider/);
  assert.match(main, /ReflectometryProvider/);
  assert.match(main, /carbon-base\.scss[\s\S]*scientific-ui\/styles\.css[\s\S]*carbon\.scss/);
  assert.match(vite, /base: "\/reflectometry\/"/);
  assert.doesNotMatch(app, /multilayer-app|dom-contract/);

  assert.match(workspace, /<ScientificAppShell\b/);
  assert.match(workspace, /<ScientificTaskPanel[\s\S]*id="configuration-panel"/);
  assert.match(workspace, /panelOpen=\{Boolean\(activeSection\)\}/);
  assert.match(workspace, /hidden=\{!activeSection\}/);
  assert.match(workspace, /inert=\{state\.operation\.busy\}/);
  assert.match(workspace, /onKeyDown=/);
  assert.match(navigation, /label: "Data"/);
  assert.match(navigation, /label: "Layer stack"/);
  assert.match(navigation, /label: "Fit"/);
  assert.match(navigation, /onClick=\{/);
  assert.doesNotMatch(ui, /ScientificToolRail|TabsVertical|TabListVertical|mobileView|DisclosurePanel/);

  for (const component of ["Accordion", "Checkbox", "FileUploaderButton", "NumberInput", "TextInput"]) assert.match(measurement, new RegExp(`<${component}\\b`));
  for (const component of ["Accordion", "Checkbox", "FileUploaderButton", "IconButton", "Modal", "NumberInput", "RadioButton", "Select", "TextInput", "Toggletip"]) assert.match(layers, new RegExp(`\\b${component}\\b`));
  for (const component of ["Checkbox", "CheckboxGroup", "NumberInput", "Select"]) assert.match(fit, new RegExp(`<${component}\\b`));
  assert.doesNotMatch([measurement, layers, fit].join("\n"), /<(?:input|select|details)\b/);
  assert.match(measurement, /R reference signal/);
  assert.match(measurement, /id="saved-fit-file"/);
  assert.match(measurement, /onClick=\{actions\.loadSyntheticExample\}/);
  assert.match(layers, /micrometres \(µm\)/);
  assert.match(layers, /onClick=\{actions\.addLayer\}/);
  assert.match(fit, /onClick=\{run\}/);
  assert.match(fit, /state\.canBootstrap/);

  assert.match(results, /<Tabs>/);
  assert.match(results, /<Tab>Overview</);
  for (const tab of ["Fit quality", "Optical n,k"]) assert.match(results, new RegExp(`<Tab aria-label="${tab}"`));
  assert.equal([...results.matchAll(/<TabPanel className="results-tab-panel[^>]*>/g)].length, 3);
  assert.match(results, /plotId="rt-chart"/);
  assert.match(results, /plotId="residual-chart"/);
  assert.match(results, /plotId="nk-chart"/);
  assert.match(results, /state\.layers\.map/);
  assert.match(results, /stack-card/);
  assert.match(outcome, /onClick: actions\.fit/);
  assert.match(outcome, /onClick: actions\.preview/);
  assert.match(statusBar, /<ScientificStatusBar/);
  assert.match(statusBar, /<OverflowMenu/);
  assert.match(statusBar, /href=\{exports\?\./);
  assert.match(plot, /Plotly\.react/);
  assert.match(plot, /onClick=\{/);
  assert.doesNotMatch(ui, /LegacyPlotCard|legacy-|All tools|Local processing/i);

  for (const token of ["MULTILAYER_MODEL_LABELS", "parseSavedFit", "SAVED_FIT_SCHEMA", "substrateThicknessNm: 1000 \\* substrateThicknessUm"]) assert.match(runtime, new RegExp(token));
  assert.match(help, /Kramers–Kronig/);
  assert.match(layers, /https:\/\/doi\.org\//);
  assert.match(carbonBase, /@use "@carbon\/react"/);
  assert.match(carbonBase, /@use "@carbon\/react\/scss\/config" with \([\s\S]*\$font-path: "@ibm\/plex"/);
  assert.match(styles, /@use "@carbon\/react\/scss\/spacing" as spacing/);
  assert.doesNotMatch(styles, /var\(--cds-spacing-/);
  assert.match(styles, /@media \(max-width: 65\.99rem\)/);
  assert.match(styles, /@container \(max-width: 38rem\)/);
  for (const token of ["--color-plot-r", "--color-plot-t", "--plot-background", "--plot-grid", "--plot-axis"]) assert.match(styles, new RegExp(token));
  assert.doesNotMatch(styles, /parameter-help-mark|file-selector-button|workbench-shell\[data-panel-open/);

  assert.match(packageJson, /"@carbon\/react"/);
  assert.match(packageJson, /"sass"/);
  assert.doesNotMatch(packageJson, /storybook/i);
  assert.doesNotMatch(`${combined}\n${styles}\n${vite}\n${packageJson}`, /headlessui|heroicons|tailwindcss/i);
  assert.doesNotMatch(combined, /\b(?:Cargar|Ajustar|Calibración|Muestra|Espesor|Índice|Parámetros|Reflectancia|Transmitancia)\b/i);
});
