import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));

async function filesUnder(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(entries.map(async (entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return filesUnder(path);
    return /\.(?:ts|tsx)$/.test(entry.name) ? [path] : [];
  }));
  return nested.flat();
}

async function readMany(paths) {
  return Promise.all(paths.map(async (path) => ({ path, text: await readFile(path, "utf8") })));
}

test("keeps controls React-owned and the scientific runtime DOM-free", async () => {
  const [uiFiles, runtimeFiles, scientificFiles] = await Promise.all([
    Promise.all(["src/app", "src/features", "src/shared"].map((directory) => filesUnder(join(root, directory)))).then((groups) => groups.flat()),
    filesUnder(join(root, "src/runtime")),
    filesUnder(join(root, "src/scientific")),
  ]);
  const [uiSources, runtimeSources, scientificSources] = await Promise.all([readMany(uiFiles), readMany(runtimeFiles), readMany(scientificFiles)]);
  const ui = uiSources.map(({ text }) => text).join("\n");
  const runtime = runtimeSources.map(({ text }) => text).join("\n");
  const scientific = scientificSources.map(({ text }) => text).join("\n");

  assert.equal(existsSync(join(root, "src/multilayer-app.ts")), false, "the legacy DOM controller must not return");
  assert.equal(existsSync(join(root, "src/scientific/dom-contract.ts")), false, "the scientific layer must not own a DOM contract");
  assert.doesNotMatch(ui, /multilayer-app|dom-contract/);

  for (const pattern of [
    /\bdocument\.(?:getElementById|querySelector(?:All)?|createElement(?:NS)?|addEventListener|removeEventListener|dispatchEvent)\b/,
    /\b(?:appendChild|replaceChildren|insertBefore|removeChild)\s*\(/,
    /\.(?:textContent|innerHTML|outerHTML)\s*=/,
    /\.(?:classList|style)\.(?:add|remove|toggle|setProperty)\s*\(/,
    /\.click\(\)/,
    /\bMutationObserver\b/,
    /\bnew\s+CustomEvent\b/,
    /\bwindow\.dispatchEvent\b/,
  ]) assert.doesNotMatch(ui, pattern);

  const listenerCalls = [...ui.matchAll(/\b([A-Za-z_$][\w$]*)\.(addEventListener|removeEventListener)\(\s*["']([^"']+)["']/g)].map((match) => `${match[1]}.${match[2]}:${match[3]}`);
  const allowedListeners = new Set([
    "query.addEventListener:change",
    "query.removeEventListener:change",
    "window.addEventListener:scientific-ui:theme-applied",
    "window.removeEventListener:scientific-ui:theme-applied",
  ]);
  assert.deepEqual(listenerCalls.filter((call) => !allowedListeners.has(call)), [], "UI listeners must be React handlers or an explicitly bounded browser boundary");

  assert.doesNotMatch(runtime, /\bdocument\b|\bwindow\.(?:getElementById|querySelector|querySelectorAll|createElement|dispatchEvent)/);
  assert.doesNotMatch(scientific, /from\s+["'](?:react|react-dom|@carbon\/react|@jorpago2\/scientific-ui)["']/);
  assert.doesNotMatch(scientific, /\bdocument\.|\bwindow\.(?:getElementById|querySelector|querySelectorAll|createElement|dispatchEvent)/);

  const main = await readFile(join(root, "src/main.tsx"), "utf8");
  assert.equal((main.match(/document\.getElementById/g) ?? []).length, 1, "only the React root may be looked up during boot");
  assert.doesNotMatch(main, /document\.documentElement|document\.querySelector|document\.createElement/);
});
