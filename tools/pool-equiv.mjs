// POOLED == SEQUENTIAL, AS A STANDING GATE — the §5.5 byte-equality assertion (landed 08-04).
//
//   node tools/pool-equiv.mjs                # 0 = pooled and sequential plans are byte-identical
//   node tools/pool-equiv.mjs --self-test    # corrupt every pooled polish; the gate must CATCH it
//
// Exit: 0 = pass · 1 = divergence (or a self-test break not caught) · 2 = could not run.
//
// ── WHY THIS EXISTS ──────────────────────────────────────────────────────────────────────────────
// The page runs every real solve through a POOL of polish-server workers (index.html's
// `makeEngineWorker("pool")` + `attachPool`), with a first-accept-in-order reduction the engine
// comments claim returns plans BYTE-IDENTICAL to the sequential path. Every test and every sweep in
// this repo runs the SEQUENTIAL path (node has no Blob workers), so the one path users actually hit
// carried a "verified" claim with no standing gate behind it — PHASE13 §5.5's third owed job. This
// tool reproduces the page's exact plumbing in node: worker_threads serve `polish(j.s, j.cfg)` over
// transferred MessagePorts (the same protocol as the Blob harness, node ports being web-compatible:
// `onmessage` receives an event carrying `.data`), the orchestrating engine instance adopts them via
// its own exported `poolInit`, and `optimizeAsync` then runs its real pooled reduction.
//
// ⚠ TWO WAYS THIS GATE COULD LIE, BOTH GUARDED (the PHASE11 B7/B8 rule):
//   · VACUOUSLY — if `poolInit` never took, the "pooled" run is sequential and equality proves
//     nothing. The ports are wrapped in counting shims; zero jobs crossing a port is a FAILURE.
//   · TOOTHLESSLY — if the comparison could not see a divergence. `--self-test` corrupts every
//     pooled polish result (press displaced, val inflated so the corruption WINS the reduction) and
//     requires the equality check to fail. Inverts its exit contract, like law-check --self-test.
import { Worker } from 'node:worker_threads';
import { loadEngine, cfgFor } from './engine-node.mjs';

const SELFTEST = process.argv.includes('--self-test');
const die = m => { console.error('POOL-EQUIV ERROR: ' + m); process.exit(2); };
const HTML = new URL('../index.html', import.meta.url).pathname;

// Three quick cells that exercise the paths that matter: a plain Lust fight, an intermission shape
// (segments + re-ramp), and an above-cap haste point (where §7's crossovers live).
const CELLS = [
  { name: '2:00 lust 0:05', T: 120, pins: { bloodlust: [5] },
    kit: ['icyVeins', 'isc', 'scb', 'arcanePower', 'berserking', 'bloodlust'],
    gear: { haste: 0, sp: 1387, crit: 38 } },
  { name: '2:40 lust 0:07 interm', T: 160, pins: { bloodlust: [7] },
    kit: ['icyVeins', 'isc', 'scb', 'arcanePower', 'berserking', 'bloodlust'],
    gear: { haste: 0, sp: 1387, crit: 38 }, phases: [{ from: 90, to: 130, type: 'intermission' }] },
  { name: '2:00 lust 0:05 h200', T: 120, pins: { bloodlust: [5] },
    kit: ['icyVeins', 'isc', 'skull', 'arcanePower', 'berserking', 'bloodlust'],
    gear: { haste: 200, sp: 1387, crit: 38 } },
];

// Watchdog: a worker that failed to load the engine leaves poolMap awaiting forever. A hung green
// gate is indistinguishable from a timeout (§3.1's own witness-gate lesson) — die loudly instead.
const watchdog = setTimeout(() => die('watchdog: pooled solve did not complete in 600 s — a pool worker is wedged'), 600_000);

// ── the pool: worker_threads serving polish() over transferred ports, the page's protocol ────────
const N_WORKERS = 3;
const BOOT = `
  const { parentPort } = require('node:worker_threads');
  import(${JSON.stringify(new URL('./engine-node.mjs', import.meta.url).href)}).then(({ loadEngine }) => {
    const api = loadEngine(${JSON.stringify(HTML)});
    if (typeof api.polish !== 'function') throw new Error('engine exports no polish()');
    parentPort.on('message', msg => {
      if (!msg || msg.type !== 'pool-port') return;
      for (const port of msg.ports) {
        // node-style listener: the raw job value, exactly what the Blob harness reads off ev.data
        port.on('message', j => port.postMessage(api.polish(j.s, j.cfg)));
      }
      parentPort.postMessage({ type: 'ready' });
    });
  }).catch(e => { throw e; });
`;

const workers = [];
const ready = [];
for (let i = 0; i < N_WORKERS; i++) {
  const w = new Worker(BOOT, { eval: true });
  w.on('error', e => die(`pool worker ${i} died: ${e.message}`));
  ready.push(new Promise(res => w.on('message', m => { if (m && m.type === 'ready') res(); })));
  workers.push(w);
}

// ── the two engine instances: one stays sequential, one adopts the pool ──────────────────────────
const seqApi = loadEngine(HTML);
const poolApi = loadEngine(HTML);
if (typeof poolApi.poolInit !== 'function') die('this index.html exports no poolInit — the loader and the engine are out of step');

let jobsCrossed = 0;
const shims = [];
for (const w of workers) {
  const { port1, port2 } = new MessageChannel();
  w.postMessage({ type: 'pool-port', ports: [port1] }, [port1]);
  // The shim gives the engine the web-shaped object poolInit expects while letting this gate COUNT
  // the traffic (the vacuity guard) and, under --self-test, corrupt it (the teeth guard).
  const shim = {
    onmessage: null,
    postMessage: m => { jobsCrossed++; port2.postMessage(m); },
  };
  port2.onmessage = ev => {
    let r = ev.data;
    if (SELFTEST && r && r.s) {
      r = JSON.parse(JSON.stringify(r));
      const k = Object.keys(r.s).find(k => Array.isArray(r.s[k]) && r.s[k].length);
      if (k) { r.s[k][0] = Math.round(r.s[k][0]) + 1; r.val = (r.val || 0) + 1e6; }
    }
    if (shim.onmessage) shim.onmessage({ data: r });
  };
  shims.push(shim);
}
await Promise.all(ready);
poolApi.poolInit(shims);

// ── solve every cell both ways and compare bytes ─────────────────────────────────────────────────
let bad = 0;
for (const cell of CELLS) {
  const t0 = Date.now();
  const seqBest = await seqApi.optimizeAsync(cfgFor(seqApi, cell), undefined, () => {});
  const crossedBefore = jobsCrossed;
  const poolBest = await poolApi.optimizeAsync(cfgFor(poolApi, cell), undefined, () => {});
  const crossed = jobsCrossed - crossedBefore;
  const same = JSON.stringify(seqBest.s) === JSON.stringify(poolBest.s) && seqBest.val === poolBest.val;
  const tag = same ? '✓ identical' : '⛔ DIVERGED ';
  console.log(`  ${tag} ${cell.name.padEnd(24)} ${String(((Date.now() - t0) / 1000).toFixed(0)).padStart(3)}s  pool jobs=${crossed}`);
  if (!same) {
    bad++;
    console.log(`      seq  ${JSON.stringify(seqBest.s)}  val ${seqBest.val}`);
    console.log(`      pool ${JSON.stringify(poolBest.s)}  val ${poolBest.val}`);
  }
  if (!crossed) { bad++; console.error(`  ⛔ VACUOUS at "${cell.name}" — zero jobs crossed a pool port; the pooled path did not run pooled.`); }
}
clearTimeout(watchdog);
for (const w of workers) w.terminate();

if (SELFTEST) {
  console.log(`\nSELF-TEST: every pooled polish was corrupted (press +1, val +1e6) — divergence REQUIRED.`);
  if (bad) { console.log('✓ SELF-TEST PASS — the corruption was caught, so a real divergence would be too.'); process.exit(0); }
  console.error('⛔ SELF-TEST FAIL — corrupted pool results audited clean: the comparison is decoration.');
  process.exit(1);
}
if (bad) { console.error('\n⛔ POOL-EQUIV FAIL — the pooled and sequential paths disagree (or the pool was idle).'); process.exit(1); }
console.log('\n✓ POOL-EQUIV PASS — pooled and sequential solves return byte-identical plans, and the pool demonstrably ran.');
process.exit(0);
