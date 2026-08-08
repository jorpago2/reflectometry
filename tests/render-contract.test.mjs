import assert from "node:assert/strict";
import test from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { createServer } from "vite";

test("renders every control required by the scientific workspace", async () => {
  const server = await createServer({ appType: "custom", logLevel: "silent", server: { middlewareMode: true } });
  try {
    const { default: App } = await server.ssrLoadModule("/src/app/App.tsx");
    const html = renderToStaticMarkup(React.createElement(App));
    for (const id of ["fit-panel-button", "bootstrap-button", "bootstrap-prerequisite", "undo-button", "redo-button", "print-report", "download-json", "download-csv", "download-nk"]) {
      assert.match(html, new RegExp(`id="${id}"`), `${id} must stay mounted at startup`);
    }
  } finally {
    await server.close();
  }
});
