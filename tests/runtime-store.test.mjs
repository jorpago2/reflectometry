import assert from "node:assert/strict";
import test from "node:test";
import { ReflectometryStore } from "../src/runtime/reflectometry-store.ts";

test("keeps preview explicit and preserves the previous result when configuration changes", () => {
  const store = new ReflectometryStore();
  try {
    assert.equal(store.getSnapshot().hasMeasurement, false);
    assert.equal(store.getSnapshot().hasResult, false);

    store.loadSyntheticExample();
    assert.equal(store.getSnapshot().hasMeasurement, true);
    assert.equal(store.getSnapshot().hasResult, false, "loading data must not calculate a model implicitly");
    assert.equal(store.getSnapshot().operation.phase, "ready");

    store.preview();
    const preview = store.getSnapshot();
    assert.equal(preview.fitResult.preview, true);
    assert.equal(preview.operation.phase, "preview");
    assert.equal(preview.resultStale, false);

    const layer = preview.layers[0];
    store.updateParameter(layer.id, "thicknessNm", "value", 175);
    const edited = store.getSnapshot();
    assert.equal(edited.hasResult, true, "the last valid result remains visible");
    assert.equal(edited.resultStale, true);
    assert.equal(edited.operation.phase, "stale");
    assert.equal(edited.layers[0].specs.thicknessNm.value, 175);

    store.preview();
    assert.equal(store.getSnapshot().resultStale, false);
    assert.equal(store.getSnapshot().fitResult.preview, true);
  } finally {
    store.dispose();
  }
});

test("keeps layer history and parameter links inside the runtime state", () => {
  const store = new ReflectometryStore();
  try {
    store.addLayer();
    const added = store.getSnapshot();
    assert.equal(added.layers.length, 2);
    assert.equal(added.canUndo, true);

    const [first, second] = added.layers;
    store.linkParameter(second.id, "n", `${first.id}__n`);
    assert.equal(store.getSnapshot().layers[1].links.n, `${first.id}__n`);
    assert.equal(store.getSnapshot().layers[1].specs.n.fit, false);

    store.undo();
    assert.equal(store.getSnapshot().layers[1].links.n, undefined);
    store.undo();
    assert.equal(store.getSnapshot().layers.length, 1);
    store.redo();
    assert.equal(store.getSnapshot().layers.length, 2);
  } finally {
    store.dispose();
  }
});
