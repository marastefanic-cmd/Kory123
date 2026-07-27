/* Sim worker: loads the wowsims WASM build and runs ONE arm of a duel.
 *
 * Classic worker on purpose — Go's wasm_exec.js is a classic script and expects `importScripts`.
 * The main thread sends a fully-built RaidSimRequest (sim/simreq.mjs made it); this only runs it.
 * Keeping the request-building on the main thread means the worker holds no convention of its own,
 * so there is exactly one place where "what the sim is asked to do" is decided.
 */
/* eslint-env worker */
self.wasmready = () => {};   // wasm_exec's main() calls this once the Go runtime is up

/* ★ A FAILED BOOT MUST NOT BE CACHED (PHASE11 §1.1 B2, fixed 07-26).
 *
 * This was `let ready = null; if (ready) return ready;` with no rejection path — so a promise that
 * REJECTED was memoized exactly like one that resolved. One flaky `sim.wasm` fetch (22 MB, and the
 * people this tool is for are on raid-night wifi) permanently bricked the sim button: every later
 * duel re-threw the original error, and the only cure was a page reload the UI never suggests.
 *
 * The retry is cheap and bounded — the expensive part, the 22 MB fetch, is exactly what failed, so
 * there is nothing to lose by trying it again. What we must NOT do is re-run the parts that DID
 * succeed: `importScripts` re-executes its script, and `go.run()` parks the Go runtime on a channel
 * forever, so a second `go.run` on a live runtime is not a retry, it is a second runtime. Hence the
 * per-step guards below rather than a blanket re-boot.
 */
let ready = null;

function boot(base) {
  if (ready) return ready;
  const p = ready = (async () => {
    if (typeof self.Go !== "function") importScripts(base + "wasm_exec.js");
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
  // Un-memoize on failure so the NEXT duel retries instead of replaying the old error forever.
  // The `p === ready` guard matters: without it a slow first boot that fails could clear a second,
  // already-succeeding boot's promise. The `.catch` also marks this rejection as handled — the
  // caller in `onmessage` awaits `boot()` and reports the error, so without it every failed boot
  // additionally logs an unhandled rejection.
  p.catch(() => { if (ready === p) ready = null; });
  return p;
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
