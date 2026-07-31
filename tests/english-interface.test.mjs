import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("ships an English-only application interface", async () => {
  const files = await Promise.all(["index.html", "app.js", "scientific-core.js"].map((name) => readFile(new URL(`../${name}`, import.meta.url), "utf8")));
  assert.match(files[0], /<html lang="en">/);
  assert.match(files[0], /From spectral signals to/);
  assert.match(files[0], /Tauc–Lorentz \(2 oscillators, causal\)/);
  assert.match(files[0], /Regularize toward ellipsometry/);
  assert.match(files[0], /Calibrate shared R\/T gains/);
  assert.match(files[0], /id="residual-chart"/);
  assert.match(files[0], /id="download-nk-csv"/);
  assert.doesNotMatch(files.join("\n"), /\b(?:Cargar|Ajustar|Calibración|Muestra|Espesor|Índice|Parámetros|Reflectancia|Transmitancia)\b/i);
});
