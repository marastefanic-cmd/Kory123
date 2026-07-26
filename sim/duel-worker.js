/* Sim worker: loads the wowsims WASM build and runs ONE arm of a duel.
 *
 * Classic worker on purpose — Go's wasm_exec.js is a classic script and expects `importScripts`.
 * The main thread sends a fully-built RaidSimRequest (sim/simreq.mjs made it); this only runs it.
 * Keeping the request-building on the main thread means the worker holds no convention of its own,
 * so there is exactly one place where "what the sim is asked to do" is decided.
 */
/* eslint-env worker */
self.wasmready = () => {};   // wasm_exec's main() calls this once the Go runtime is up

let ready = null;

function boot(base) {
  if (ready) return ready;
  ready = (async () => {
    importScripts(base + "wasm_exec.js");
    const go = new self.Go();
    const src = await fetch(base + "sim.wasm");
    if (!src.ok) throw new Error(`could not load sim.wasm (HTTP ${src.status})`);
    // instantiateStreaming needs Content-Type: application/wasm; fall back for hosts that don't set it
    let instance;
    try {
      ({ instance } = await WebAssembly.instantiateStreaming(src.clone(), go.importObject));
    } catch (_) {
      const bytes = await src.arrayBuffer();
      ({ instance } = await WebAssembly.instantiate(bytes, go.importObject));
    }
    go.run(instance);                       // never resolves; the Go runtime parks on a channel
    if (typeof self.raidSimJson !== "function") throw new Error("sim.wasm did not expose raidSimJson");
  })();
  return ready;
}

self.onmessage = async (e) => {
  const { id, base, request } = e.data;
  try {
    await boot(base);
    const t0 = Date.now();
    const out = JSON.parse(self.raidSimJson(JSON.stringify(request)));
    self.postMessage({ id, ok: true, result: out, ms: Date.now() - t0 });
  } catch (err) {
    self.postMessage({ id, ok: false, error: String((err && err.message) || err) });
  }
};
