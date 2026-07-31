import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("ships one English-only material-agnostic multilayer interface", async () => {
  const files = await Promise.all(["index.html", "multilayer.html", "multilayer-app.js", "scientific-core.js", "dielectric-models.js"].map((name) => readFile(new URL(`../${name}`, import.meta.url), "utf8")));
  const combined = files.join("\n");
  assert.match(files[0], /<html lang="en">/);
  assert.match(files[0], /url=multilayer\.html/);
  assert.match(files[1], /Build the stack/);
  assert.match(files[1], /id="reset-example"/);
  assert.match(files[1], /R reference signal/);
  assert.match(files[1], /id="add-layer"/);
  assert.match(files[1], /LAYERS N,K/);
  assert.match(files[2], /Independent dielectric components/);
  assert.match(files[2], /Tauc–Lorentz oscillators/);
  assert.match(files[2], /Lorentz oscillators/);
  assert.match(files[2], /Brendel–Bormann/);
  assert.match(files[2], /Drude–Smith/);
  assert.match(files[2], /Effective-medium constituents/);
  assert.match(files[2], /deterministic browser-generated example/);
  assert.doesNotMatch(combined, new RegExp(["single", "layer"].join("[- ]") + "|material " + "preset|included example", "i"));
  assert.doesNotMatch(combined, /\b(?:Cargar|Ajustar|Calibración|Muestra|Espesor|Índice|Parámetros|Reflectancia|Transmitancia)\b/i);
});
