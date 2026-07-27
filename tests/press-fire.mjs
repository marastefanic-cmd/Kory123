// PRESS-FIRE TIMING — the gate that did not exist, and whose absence is why the transcription bug
// lived in the corpus for the whole project.
//
//   node tests/press-fire.mjs                          # part A only (no sim, no browser, ~1 min)
//   RUNNER=/path/to/runner-ap180 node tests/press-fire.mjs      # + part B, graded against a real log
//   RESTARTS=14 node tests/press-fire.mjs               # search depth (default 3 — see below)
//
// PHASE12 §6.7, stated as plainly as it can be: *"`tests/sim-request.mjs` asserts the request is
// well-formed, not that a scheduled press fires when asked. **No gate in this repo covers press-fire
// timing** — which is exactly why it survived this long."* This is that gate.
//
// ── PART A — the transcription invariant (NO SIM; this is the part CI can always run) ─────────────
// `sim/planspec.mjs` emits a SCHEDULE VALUE, not a press time: wowsims only evaluates its APL at cast
// boundaries, and its cast lattice does not sit exactly on the model's (it takes 334 ms per Arcane
// Blast stack where the model takes 1/3 s, and rounds every cast to the millisecond — up to 80 ms of
// drift by 300 s, `tools/lattice-drift.mjs`). So the value has to land strictly inside the interval
// that ENDS at the cast the model buffs, with enough margin at BOTH edges that a lattice shift in
// either direction cannot move the press to a neighbouring cast.
//
// Part A asserts exactly that, per press, on every preset the page ships — and it asserts it against
// LATTICE_WORST, the measured drift, so the margin is checked against evidence rather than against
// the constant planspec happens to use. Every preset contributes a search-free `naiveSchedule` plan;
// a few also contribute a real optimizer plan (see below for why only a few).
//
// ── PART B — the sim actually does it (needs a native RUNNER) ────────────────────────────────────
// The committed `sim/sim.wasm` does not expose a combat log, so grading *when* a press fired needs the
// native runner. Part B therefore SKIPS LOUDLY without `RUNNER` rather than passing quietly — the same
// contract `tests/sim-request.mjs` uses, and for the same reason: a gate that silently no-ops is worse
// than no gate, because it reports success.
//
// Exit codes: 0 graded clean · 1 graded and failing · 2 could not grade.
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { loadEngine, cfgFor } from '../tools/engine-node.mjs';
import { planToSpec } from '../sim/planspec.mjs';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const INDEX = process.env.INDEX || path.join(REPO, 'index.html');
// ⚠ 3, not the 14 the tool ships with — and on purpose. What part A checks is GEOMETRY: given a plan's
// fire times and the model's cast grid, does the emitted schedule value stay clear of both edges of the
// interval it has to land in? That holds or fails identically for a good plan and a mediocre one, so a
// deep search buys this gate nothing. See the plan-selection block below for the rest of the budget.
const RESTARTS = +(process.env.RESTARTS || 3);

// How much cast-lattice drift every schedule value must survive, in EITHER direction (the sign flips
// with haste, so one-sided margin is not enough). A bare stream drifts 0.080 s over 300 s
// (`tools/lattice-drift.mjs`); a plan with haste buffs in it reaches ~0.35 s by t=200, because every
// buff re-quantizes the interval (`tools/press-headtohead.mjs`, the `off` column). 0.30 s is the
// contract part A holds the transcription to.
//
// ⚠ This is BELOW what planspec actually budgets (half an interval, ≥ 0.5 s) on purpose: part A is a
// floor the rule must clear, not a restatement of the rule. Setting it equal to SLACK would make this
// assert that planspec does what planspec does.
const LATTICE_WORST = 0.30;

let failures = 0, checked = 0, presses = 0;
const fail = (msg) => { failures++; console.log(`  FAIL  ${msg}`); };

const api = loadEngine(INDEX);

// ── PART A ───────────────────────────────────────────────────────────────────────────────────────
console.log('# part A — transcription invariant (no sim)\n');
const KEY_OF = { IV: 'icyVeins', AP: 'arcanePower', Zerk: 'berserking', BL: 'bloodlust',
                 Icon: 'isc', Gem: 'scb', Skull: 'skull', MQG: 'mqg' };
// EVERY preset gets a `naiveSchedule` plan — no search at all, and it presses everything on
// cooldown, so it has MORE presses than an optimized plan and they cluster against cooldown
// boundaries, which is the geometry most likely to expose a bad schedule value. That covers all 25
// shapes (intermissions, the Kael'thas AoE window, 7-minute fights) for free.
//
// A handful of REAL optimizer plans go in on top, because those are what actually ships. Only a few:
// running the optimizer on all 25 made this a ~35-minute gate — worse than exact-match, which at
// least covers the render path — and a gate nobody runs protects nothing. Cheapest-first (shortest
// fights), plus the shortest phased preset so a real plan exercises the downtime/AoE paths too.
const OPTIMIZED = 5;
const byT = [...api.cases].sort((a, b) => a.T - b.T);
const phased = byT.find(c => c.phases || c.intermission);
const chosen = new Set(byT.slice(0, OPTIMIZED).map(c => c.name));
if (phased) chosen.add(phased.name);

const runs = [];
const plans = [];
for (const c of api.cases) {
  const cfg = cfgFor(api, c);
  const nv = api.naiveSchedule(cfg);
  const nvR = api.simulate(nv, cfg, true);
  plans.push({ c: { name: c.name + ' [naive]' }, cfg, best: { s: nv }, optR: nvR,
               A: planToSpec({ cfg, best: { s: nv }, optR: nvR }, api.BUFFS) });
  if (!chosen.has(c.name)) continue;
  const best = await api.optimizeAsync(cfg, RESTARTS, () => {});
  const optR = api.simulate(best.s, cfg, true);
  runs.push({ c, cfg, best, optR, A: planToSpec({ cfg, best, optR }, api.BUFFS) });
  plans.push(runs[runs.length - 1]);
}
for (const { c, optR, A } of plans) {
  const starts = optR.casts.map(x => x.t);
  checked++;

  for (const [sk, times] of Object.entries(A.spec)) {
    if (sk.startsWith('_')) continue;
    const modelKey = KEY_OF[sk];
    // Cold Snap has no buff of its own: it is the IV reset, transcribed at the same times as the IV
    // uses it enables, so it is graded through IV rather than against an actEff list of its own.
    if (sk === 'CS') continue;
    const eff = ((optR.actEff || {})[modelKey] || []).slice().sort((a, b) => a - b);
    if (eff.length !== times.length) {
      fail(`${c.name}: ${sk} has ${times.length} schedule value(s) for ${eff.length} model press(es)`);
      continue;
    }
    for (let i = 0; i < times.length; i++) {
      presses++;
      const S = times[i], fire = eff[i];
      let idx = -1;
      for (let j = 0; j < starts.length; j++) { if (starts[j] >= fire - 1e-9) { idx = j; break; } }
      if (idx < 0) continue;                       // press lands past the last cast — buffs nothing
      const hi = starts[idx], lo = idx > 0 ? starts[idx - 1] : 0;
      if (hi === lo) continue;                     // the very first cast, at t=0
      // The press must reach the target cast for ANY lattice offset within the measured worst case.
      if (!(S <= hi - LATTICE_WORST))
        fail(`${c.name}: ${sk}[${i}] schedule ${S} is within ${LATTICE_WORST}s of its target cast ` +
             `${hi.toFixed(3)} — a lattice shift would push the press a full cast LATE`);
      if (!(S > lo + LATTICE_WORST))
        fail(`${c.name}: ${sk}[${i}] schedule ${S} is within ${LATTICE_WORST}s of the PREVIOUS cast ` +
             `${lo.toFixed(3)} — a lattice shift would fire the press a full cast EARLY`);
      // And the expected fire time planspec reports has to be the cast the model actually buffs (or,
      // for a press in a downtime gap, the press moment itself).
      const want = A.fire[sk][i];
      if (!(want <= hi + 1e-9 && want >= S - 1e-9))
        fail(`${c.name}: ${sk}[${i}] expected fire ${want} is not in (${S}, ${hi.toFixed(3)}]`);
    }
  }
}
console.log(`  ${checked} plan(s) over ${api.cases.length} preset(s), ${presses} press(es) checked, ${failures} failure(s)\n`);

// ── PART B ───────────────────────────────────────────────────────────────────────────────────────
const RUNNER = process.env.RUNNER || '';
if (!RUNNER) {
  console.log('# part B — SKIPPED LOUDLY: no RUNNER set.');
  console.log('  The committed sim/sim.wasm exposes no combat log, so grading WHEN a press fired needs');
  console.log('  the native runner (docs/TOOLING.md "Building the runner"). Part A still ran; it is the');
  console.log('  arithmetic half. Re-run with RUNNER=<path> before trusting a transcription change.');
} else if (!fs.existsSync(RUNNER)) {
  console.error(`ERROR: RUNNER does not exist: ${RUNNER}`);
  process.exit(2);
} else {
  console.log(`# part B — press-verify against ${path.basename(RUNNER)}\n`);
  const EXPORT = process.env.EXPORT_BASE || path.join(REPO, 'tools/bench/export.json');
  if (!fs.existsSync(EXPORT)) { console.error(`ERROR: no character export at ${EXPORT}`); process.exit(2); }
  // A handful of shapes, not all of them: part B costs a sim run each, and part A already covers the
  // arithmetic on every preset. Pick the ones whose lattices differ most — a long fight (drift has
  // time to accumulate), a short one, and whatever the page ships with phases.
  const pick = [...runs].sort((a, b) => b.cfg.T - a.cfg.T).slice(0, 2)
    .concat([...runs].sort((a, b) => a.cfg.T - b.cfg.T).slice(0, 1))
    .concat(runs.filter(r => r.cfg.segments && r.cfg.segments.some(s => s.type !== 'normal')).slice(0, 1));
  const seen = new Set();
  for (const r of pick) {
    if (seen.has(r.c.name)) continue;
    seen.add(r.c.name);
    if (r.A.burn) { console.log(`  ${r.c.name}: SKIP (burn phase — the sim has no such knob)`); continue; }
    const args = ['--spec', JSON.stringify(r.A.spec), '--fire', JSON.stringify(r.A.fire),
      '--cast', JSON.stringify(r.A.cast),
      '--run', '--dur', String(r.cfg.T), '--haste', String(r.cfg.hasteRating),
      '--export', EXPORT];
    if (r.A.targets) args.push('--targets', String(r.A.targets));
    let out = '', code = 0;
    try {
      out = execFileSync(process.execPath, [path.join(REPO, 'tools/press-verify.mjs'), ...args],
        { env: { ...process.env, RUNNER }, encoding: 'utf8', maxBuffer: 1 << 28 });
    } catch (e) {
      out = (e.stdout || '') + (e.stderr || '');
      code = e.status ?? 2;
    }
    if (code === 2) { console.error(`ERROR: press-verify could not grade ${r.c.name}:\n${out}`); process.exit(2); }
    const bad = out.split('\n').filter(l => /WRONG CAST|DROPPED|UNCLAIMED/.test(l));
    if (code !== 0 || bad.length) { fail(`${r.c.name}:\n${out.split('\n').map(l => '        ' + l).join('\n')}`); continue; }
    // HELD / LATTICE are NOT transcription failures and do not fail this gate — but they are not
    // nothing either, so they are counted out loud. They are the model/sim cast-time mismatch showing
    // through, and the day they reach zero is the day that constant got fixed.
    const held = (out.match(/← HELD/g) || []).length + (out.match(/← LATTICE/g) || []).length;
    console.log(`  ${r.c.name}: OK — every press fired on the cast the model scored it on` +
      (held ? `  (${held} press(es) HELD/LATTICE — the cast-time mismatch, not the transcription)` : ''));
  }
}

console.log('');
if (failures) { console.log(`✗ ${failures} failure(s)`); process.exit(1); }
console.log('✓ press-fire timing holds');
// ⚠ EXIT EXPLICITLY. `optimizeAsync` breathes through a MessageChannel, which keeps node's event loop
// ref'd forever — the script finishes and the process just sits in ep_poll. `tools/plan-sweep.mjs:75`
// records the same trap. Without this the gate LOOKS like a 35-minute hang (it is really ~7s of CPU),
// and anything piping its output waits for an EOF that never comes.
process.exit(0);
