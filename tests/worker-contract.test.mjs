import assert from "node:assert/strict";
import test from "node:test";

test("fit worker rejects missing and unsupported operations", async () => {
  const originalSelf = globalThis.self;
  const messages = [];
  let messageHandler = null;
  globalThis.self = {
    addEventListener(type, handler) {
      if (type === "message") messageHandler = handler;
    },
    postMessage(message) {
      messages.push(message);
    },
  };

  try {
    await import(`../src/scientific/workers/fit-worker.ts?worker-contract=${Date.now()}`);
    assert.equal(typeof messageHandler, "function");
    messageHandler({ data: {} });
    messageHandler({ data: { operation: "unsupported" } });
    assert.deepEqual(messages.map((message) => message.type), ["error", "error"]);
    assert.match(messages[0].message, /Unsupported fit-worker operation: undefined/);
    assert.match(messages[1].message, /Unsupported fit-worker operation: unsupported/);
  } finally {
    if (originalSelf === undefined) delete globalThis.self;
    else globalThis.self = originalSelf;
  }
});
