// SIM DUEL — the in-page verifier's engine, driven from node.
//
// Runs the SAME modules the website's "Verify in the sim" button runs (sim/planspec.mjs →
// tools/genapl-core.mjs → sim/simreq.mjs → sim/sim.wasm), so a result you get in the terminal and a
// result a user gets in the browser come from one code path. Use it to:
//   • sanity-check the wasm rig after a rebuild
//   • duel two layouts headlessly
//   • cross-check the wasm against the native runner (RUNNER=/path/to/runner)
//
//   node tests/sim-duel.mjs                       # built-in self-check (wasm vs native reference)
//   node tests/sim-duel.mjs --iter 10000          # heavier
//
// ★ The wasm path uses core.RunRaidSim (single-threaded); the native runner uses
//   RunRaidSimConcurrent. Measured equal to the printed decimal at 2k and 10k iterations on the
//   reference character — that equality is what makes the button "the same verification", so this
//   file asserts it whenever RUNNER is set.
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { execFileSync } from 'child_process';
import { build } from '../tools/genapl-core.mjs';
import { buildRequest, dpsOf } from '../sim/simreq.mjs';
import { BENCH, runnerFlags } from '../sim/benchmark.mjs';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const TEMPLATE = JSON.parse(fs.readFileSync(path.join(REPO, 'sim/model-ref-request.json'), 'utf8'));

const argv = process.argv.slice(2);
const arg = (k, d) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : d; };
const ITER = +arg('--iter', BENCH.iterations);

// ── wasm bootstrap (node) ─────────────────────────────────────────────────────────────────────────
export async function loadSim() {
  globalThis.wasmready = () => {};
  await import(path.join(REPO, 'sim/wasm_exec.js'));
  const go = new globalThis.Go();
  const { instance } = await WebAssembly.instantiate(fs.readFileSync(path.join(REPO, 'sim/sim.wasm')), go.importObject);
  go.run(instance);
  if (typeof globalThis.raidSimJson !== 'function') throw new Error('sim.wasm did not expose raidSimJson');
  return (req) => JSON.parse(globalThis.raidSimJson(JSON.stringify(req)));
}

export function requestFor(spec, opts) {
  return buildRequest(TEMPLATE, { ...opts, apl: build(spec) });
}

// ── self-check ────────────────────────────────────────────────────────────────────────────────────
if (import.meta.url === `file://${process.argv[1]}`) {
  const GEAR = { sp: 1150, critPct: 25, hasteRating: 0, T: 300 };
  const ARMS = {
    'IV at the pull': { _prestack: 0, IV: [0], Skull: [0], Gem: [4], AP: [4], BL: [120], Icon: [0] },
    'IV at 0:30':     { _prestack: 0, IV: [30], Skull: [0], Gem: [4], AP: [4], BL: [120], Icon: [0] },
  };
  const run = await loadSim();
  const out = {};
  for (const [name, spec] of Object.entries(ARMS)) {
    const t0 = Date.now();
    const res = run(requestFor(spec, { ...GEAR, iterations: ITER, seed: BENCH.seed }));
    const d = dpsOf(res);
    out[name] = d.avg;
    console.log(`  ${name.padEnd(16)} ${d.avg.toFixed(1)} DPS   (${Date.now() - t0}ms, ${ITER} iters)`);
  }
  const [a, b] = Object.values(out);
  console.log(`\n  paired delta: ${(100 * (a / b - 1)).toFixed(3)}%  (same seed = common random numbers)`);

  // Cross-check against the native runner when one is available.
  const RUNNER = process.env.RUNNER;
  if (RUNNER && fs.existsSync(RUNNER)) {
    const tmp = fs.mkdtempSync('/tmp/simduel-');
    let bad = 0;
    for (const [name, spec] of Object.entries(ARMS)) {
      const aplPath = path.join(tmp, 'a.apl.json');
      fs.writeFileSync(aplPath, JSON.stringify(build(spec), null, 1));
      // flags GENERATED from the shared protocol — no `--var 0.5` / `--mana 1e8` typed here
      const tsv = execFileSync(RUNNER, runnerFlags({
        export: path.join(REPO, 'sim/model-ref.json'), apl: aplPath, T: GEAR.T,
        sp: GEAR.sp, critPct: GEAR.critPct, hasteRating: GEAR.hasteRating,
        iterations: ITER, seed: BENCH.seed, tag: 'native',
      }), { encoding: 'utf8' });
      const native = +tsv.trim().split('\n').pop().split('\t')[4];
      const delta = Math.abs(native - out[name]);
      const ok = delta < 0.05;
      if (!ok) bad++;
      console.log(`  ${ok ? 'MATCH' : 'DRIFT'}  ${name.padEnd(16)} wasm ${out[name].toFixed(1)} vs native ${native.toFixed(1)}`);
    }
    fs.rmSync(tmp, { recursive: true, force: true });
    if (bad) { console.error('\nFAIL — the shipped wasm and the native runner disagree.'); process.exit(1); }
    console.log('\nPASS — shipped wasm == native runner.');
  } else {
    console.log('\n  (set RUNNER=/path/to/runner to cross-check the shipped wasm against the native rig)');
  }
}
