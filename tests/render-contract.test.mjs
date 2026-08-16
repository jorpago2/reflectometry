import assert from "node:assert/strict";
import test from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { createServer } from "vite";
import { ScientificUiProvider } from "@jorpago2/scientific-ui";

test("renders the React shell and initial workflow contract", async () => {
  const server = await createServer({ appType: "custom", logLevel: "silent", server: { middlewareMode: true } });
  try {
    const [{ default: App }, { default: ReflectometryProvider }] = await Promise.all([
      server.ssrLoadModule("/src/app/App.tsx"),
      server.ssrLoadModule("/src/app/ReflectometryProvider.tsx"),
    ]);
    const html = renderToStaticMarkup(
      React.createElement(
        ScientificUiProvider,
        null,
        React.createElement(ReflectometryProvider, null, React.createElement(App)),
      ),
    );

    for (const id of ["reflectometry-workspace", "configuration-panel", "workflow-measurement", "workflow-layers", "workflow-fit"]) {
      assert.match(html, new RegExp(`(?:id|aria-controls)="${id}"`), `${id} must stay mounted in the React shell`);
    }
    for (const label of ["Data", "Layer stack", "Fit", "Start with measurement data", "Load example", "Preview model"]) {
      assert.match(html, new RegExp(label));
    }
    assert.match(html, /aria-label="Configuration tools"/);
    assert.match(html, /aria-label="Fit results"/);
    assert.match(html, /aria-label="Fit status"/);
    assert.doesNotMatch(html, /multilayer-app|dom-contract|LegacyPlotCard|simulation=/);
    assert.doesNotMatch(html, /id="layers"|id="substrate-editor"|id="results-content"/);
  } finally {
    await server.close();
  }
});
