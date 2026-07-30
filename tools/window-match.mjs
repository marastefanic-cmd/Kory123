// ARE THE MODEL'S AND THE SIM'S KILL WINDOWS THE SAME WINDOW? — the reconciliation test.
//
//   node tools/window-match.mjs [--preset "T2 · 3:00 lust 0:20"] [--steps 11]
//
// Exit: 0 = the two track each other · 1 = they do not · 2 = could not measure.
//
// ── THE QUESTION ─────────────────────────────────────────────────────────────────────────────────
// The model credits a cast that straddles the kill the FRACTION of itself that fits. That is
// algebraically a ONE-SIDED window whose width is the cast's own duration `d`: `U[T, T+d]`.
// The sim has the same problem and solves it numerically — it averages over a jittered fight length.
// For a long time those two were unrelated: the sim used a flat symmetric `±0.5`, justified as "the
// model's kill-window WIDTH" long after that constant had been deleted.
//
// `sim/benchmark.mjs`'s `encounterFor()` now derives the sim's window from the model's:
//     duration = T + d/2 ,  durationVariation = d/2   ⇒   U[T, T+d]
// This file is the check that the derivation actually did what it claims.
//
// ── THE MEASUREMENT, AND WHY THIS SHAPE ──────────────────────────────────────────────────────────
// Sweep the fight length T across ONE cast interval in small steps. A cast boundary crosses T during
// the sweep, so any mismatch in how the two sides handle the boundary shows up as a WOBBLE:
//
//   · model score(T)                     — should rise smoothly and near-linearly
//   · sim total damage(T) = DPS × T      — likewise, IF its window matches
//   · ratio model/sim                    — the diagnostic. Constant ⇒ same window. Wobbling ⇒ not.
//
// The ratio is the right statistic because the two are in different units and on different
// characters: absolute agreement is neither expected nor interesting. What matters is whether they
// disagree *as a function of where the boundary falls*, which is exactly what a window mismatch does
// and what a units difference cannot do.
//
// ⚠ Read the SPREAD of the ratio, never a single point. One ratio tells you nothing; eleven ratios
// across a cast interval tell you whether the boundary is handled the same way.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from './genapl-core.mjs';
import { buildRequest, dpsOf } from '../sim/simreq.mjs';
import { BENCH, killWindow } from '../sim/benchmark.mjs';
import { loadEngine, cfgFor } from './engine-node.mjs';
import { REF, plainCastInPage } from './reference-gear.mjs';
import { planToSpec } from '../sim/planspec.mjs';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const die = m => { console.error('ERROR: ' + m); process.exit(2); };
const argv = process.argv.slice(2);
const flag = (n, d) => { const i = argv.indexOf(`--${n}`); return i < 0 ? d : argv[i + 1]; };

const api = loadEngine(path.join(REPO, 'index.html'));
const NAME = flag('preset', 'T2 · 3:00 lust 0:20');
const STEPS = +flag('steps', '11');
const kase = api.cases.find(c => c.name === NAME) || die(`no preset "${NAME}"`);
const base = cfgFor(api, kase);
const PLAIN = new Function('GAME', 'R', `return (${plainCastInPage.toString()})(R);`)(api.GAME, REF);

// One fixed layout across the whole sweep: the question is about the BOUNDARY, not about the plan.
const best = await api.optimizeAsync(base, 3, () => {});
const S = best.s;

globalThis.wasmready = () => {};
await import(path.join(REPO, 'sim/wasm_exec.js'));
const go = new globalThis.Go();
const { instance } = await WebAssembly.instantiate(fs.readFileSync(path.join(REPO, 'sim/sim.wasm')), go.importObject);
go.run(instance);
const TEMPLATE = JSON.parse(fs.readFileSync(path.join(REPO, 'sim/model-ref-request.json'), 'utf8'));

const d = killWindow(base.hasteRating || 0) * 2;   // one terminal cast
const step = d / (STEPS - 1);
console.log(`# window-match — "${NAME}"`);
console.log(`  terminal 3-stack cast d = ${d.toFixed(4)} s at haste ${base.hasteRating || 0}; sweeping T across one d in ${STEPS} steps\n`);

const run = (T, variation) => {
  const cfg = { ...base, T };
  const model = api.simulate(api.repair(JSON.parse(JSON.stringify(S)), cfg), cfg).robust / PLAIN;
  const spec = planToSpec({ cfg, best: { s: S }, optR: api.simulate(api.repair(JSON.parse(JSON.stringify(S)), cfg), cfg, true) }, api.BUFFS);
  const req = buildRequest(TEMPLATE, {
    sp: 0, critPct: 0, hasteRating: cfg.hasteRating || 0, T, iterations: 20000, seed: BENCH.seed,
    ...(variation === undefined ? {} : { variation }), targets: spec.targets || 0, apl: build(spec.spec),
  });
  const out = JSON.parse(globalThis.raidSimJson(JSON.stringify(req)));
  if (out && out.errorResult) die('sim error: ' + out.errorResult);
  const dps = dpsOf(out);
  if (!dps || !Number.isFinite(dps.avg)) die('sim returned no DPS');
  return { model, simTotal: dps.avg * T };
};

const spread = a => (Math.max(...a) - Math.min(...a)) / (a.reduce((s, x) => s + x, 0) / a.length);
const rows = [];
for (let i = 0; i < STEPS; i++) {
  const T = +(base.T + i * step).toFixed(4);
  const derived = run(T, undefined);          // the new, model-matched window
  const legacy = run(T, 0.5);                 // the retired flat symmetric one
  rows.push({ T, dm: derived.model, ds: derived.simTotal, lm: legacy.model, ls: legacy.simTotal });
}
console.log('|   T   | model eff | sim total (derived) | ratio | sim total (flat 0.5) | ratio |');
console.log('|---|---|---|---|---|---|');
for (const r of rows)
  console.log(`| ${r.T.toFixed(3)} | ${r.dm.toFixed(3)} | ${r.ds.toFixed(0)} | ${(r.dm / r.ds * 1e5).toFixed(4)} | ${r.ls.toFixed(0)} | ${(r.lm / r.ls * 1e5).toFixed(4)} |`);

const rd = spread(rows.map(r => r.dm / r.ds)), rl = spread(rows.map(r => r.lm / r.ls));
console.log(`\n  ratio spread across the sweep — DERIVED window: ${(100 * rd).toFixed(4)} %`);
console.log(`                                  flat 0.5      : ${(100 * rl).toFixed(4)} %`);
console.log(`  improvement: ${(rl / rd).toFixed(2)}x ${rd < rl ? 'tighter' : '⚠ WORSE'}`);
if (rd < rl) {
  console.log('\n  ✅ The derived window tracks the model across a cast boundary more closely than the flat');
  console.log('     one did. The two are now smoothing the SAME window rather than two different ones.');
  process.exit(0);
}
console.log('\n  ‼ The derived window is NOT tighter. Either the derivation is wrong or the boundary is not');
console.log('    what dominates this preset — check a shorter fight, where one cast is a larger share.');
process.exit(1);
