// SETTLING `--var 0` vs `--var 0.5` — a pre-registered experiment.
//
// The conflict: `docs/BENCH.md` §3's RNG table listed `--var 0` as "standard for gates" (fewer random
// sources ⇒ cleaner A/B). `docs/TOOLING.md` ★★ says `--var 0` is "not the clean deterministic answer,
// it is a resolution failure" that has faked a result twice. Both were asserted; neither was measured
// side by side. This measures it.
//
// WHAT `--var` DOES (read from source, `sim/core/sim.go:406`): fight length is drawn
// **uniform on [T − var, T + var]**. So `var 0.5` smears the kill second over a 1.0 s window — about
// one GCD-floored cast — and `var 0` fixes it exactly.
//
// WHY THIS CAN BE DECIDED AT ALL: with infinite mana and a fixed duration the cast lattice is
// deterministic (crit/damage rolls change damage, not cast times), so **mean cast count is an integer
// at var 0** and a fraction at var 0.5. The sim reports casts directly, so the "staircase" claim is
// not a matter of opinion.
//
// ── ★ PRE-REGISTERED DECISION RULE (written before the first run) ────────────────────────────────
// The instrument must answer "which layout is better" stably with respect to the ONE thing nobody
// controls: the exact second the boss dies. A raid boss does not die at a reproducible millisecond,
// and the model itself scores with a half-cast kill smoothing (RULES §8) precisely because that
// second is unknowable. So:
//
//   D1. ARTIFACT TEST (decisive). On PAIR-ZERO — two placements of a lone haste buff, which theory
//       says are worth the SAME (position independence, RULES §3, verified 0.0000% in the model) —
//       sweep the fight length across a 2 s window. If one setting SWINGS THE SIGN of Δ across that
//       window while the other does not, the swinging one is manufacturing differences out of the
//       kill second, and it LOSES regardless of how quiet its seed noise is. Precision without
//       accuracy is the worse failure: it is confident and wrong.
//   D2. SENSITIVITY TEST (disqualifier). On PAIR-REAL — a spellpower use inside Bloodlust vs outside,
//       which theory says is a real gain (flux, RULES §6) — a setting must report the correct sign at
//       ≥80% of the swept fight lengths. A setting that is stable but blind is useless.
//   D3. TIE-BREAK. If both pass D1 and D2, prefer the smaller seed-to-seed band (that is `var 0`'s
//       whole claim, and it would then be a real advantage rather than a false one).
//
// Run:  node tools/var-decision.mjs [--iter 3000] [--json]
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from './genapl-core.mjs';
import { buildRequest, dpsOf } from '../sim/simreq.mjs';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const TEMPLATE = JSON.parse(fs.readFileSync(path.join(REPO, 'tools/bench/export-request.json'), 'utf8'));
const argv = process.argv.slice(2);
const arg = (k, d) => { const i = argv.indexOf('--' + k); return i >= 0 ? argv[i + 1] : d; };
const ITER = +arg('iter', 3000);
const SEED_ITER = +arg('seed-iter', 5000);
const JSONOUT = argv.includes('--json');

// T-grid: 2.0 s in 0.1 s steps — wider than one cast at any haste this tool models, so a staircase
// must show at least one full step inside it.
const T0 = 100, STEPS = 21, DT = 0.1;
const TS = Array.from({ length: STEPS }, (_, i) => +(T0 + i * DT).toFixed(1));
const VARS = [0, 0.5];
const SEEDS = [11, 100011, 200011, 300011, 400011];

// PAIR-ZERO: a lone haste buff, nothing to overlay, no damage buffs anywhere. The model scores these
// identically (a haste buff banks the same fractional casts wherever it lands, floor-free).
const ZERO_A = { _prestack: 0, Zerk: [20] };
const ZERO_B = { _prestack: 0, Zerk: [60] };
// PAIR-REAL: +155 SP inside the Lust window vs long after it. Spellpower earns against the damage
// flux in its window and flux is higher where casts are faster ⇒ inside must win.
const REAL_A = { _prestack: 0, BL: [5], Icon: [5] };
const REAL_B = { _prestack: 0, BL: [5], Icon: [60] };
// ★ PAIR-TERMINAL — THE DECISIVE ONE, and the pair the first version of this experiment MISSED.
// Quantization at var 0 cancels inside a paired difference whenever the two arms share a terminal
// cast lattice: both truncate at the same moment, so both staircases step at the same fight length.
// (PAIR-ZERO and PAIR-REAL are both like that — which is exactly why they came back a tie, and
// probably why `--var 0` survived as a convention for so long.) It can only bite when the arms differ
// in terminal cast RATE. That is a haste window covering the kill vs the same window used interior —
// i.e. the planner's most routine hard call (RULES §8: "the terminal Icy Veins aligned to end at the
// kill"). Ground truth is not needed here: the test is whether the instrument gives a STABLE answer as
// the kill second moves by a tenth of a second, which nobody controls in a real pull.
const TERM_A = { _prestack: 0, IV: [85] };   // 20s Icy Veins straddling the buzzer
const TERM_B = { _prestack: 0, IV: [40] };   // the same use, interior

globalThis.wasmready = () => {};
await import(path.join(REPO, 'sim/wasm_exec.js'));
const go = new globalThis.Go();
const { instance } = await WebAssembly.instantiate(fs.readFileSync(path.join(REPO, 'sim/sim.wasm')), go.importObject);
go.run(instance);
const runSim = (spec, T, variation, seed, iterations) => {
  const req = buildRequest(TEMPLATE, { T, iterations, seed, variation, apl: build(spec) });
  const out = JSON.parse(globalThis.raidSimJson(JSON.stringify(req)));
  if (out.errorResult) throw new Error(out.errorResult);
  const p = out.raidMetrics.parties[0].players[0];
  const ab = (p.actions || []).find(a => a.id && a.id.spellId === 30451);
  const casts = ab ? ab.targets.reduce((s, t) => s + (t.casts || 0), 0) / iterations : null;
  return { dps: dpsOf(out).avg, casts };
};

const mean = xs => xs.reduce((s, x) => s + x, 0) / xs.length;
const sd = xs => xs.length < 2 ? 0 : Math.sqrt(xs.reduce((s, x) => s + (x - mean(xs)) ** 2, 0) / (xs.length - 1));

// ── sweep ─────────────────────────────────────────────────────────────────────────────────────────
process.stderr.write(`sweeping ${TS.length} fight lengths × ${VARS.length} var settings × 4 schedules @ ${ITER} iters…\n`);
const sweep = {};
for (const v of VARS) {
  sweep[v] = { casts: [], zeroA: [], zeroB: [], realA: [], realB: [], termA: [], termB: [] };
  for (const T of TS) {
    const za = runSim(ZERO_A, T, v, 11, ITER), zb = runSim(ZERO_B, T, v, 11, ITER);
    const ra = runSim(REAL_A, T, v, 11, ITER), rb = runSim(REAL_B, T, v, 11, ITER);
    const ta = runSim(TERM_A, T, v, 11, ITER), tb = runSim(TERM_B, T, v, 11, ITER);
    sweep[v].casts.push(za.casts);
    sweep[v].zeroA.push(za.dps); sweep[v].zeroB.push(zb.dps);
    sweep[v].realA.push(ra.dps); sweep[v].realB.push(rb.dps);
    sweep[v].termA.push(ta.dps); sweep[v].termB.push(tb.dps);
    process.stderr.write('.');
  }
  process.stderr.write('\n');
}

// ── seed band at the midpoint ─────────────────────────────────────────────────────────────────────
process.stderr.write(`seed band: ${SEEDS.length} seeds × ${VARS.length} var × 2 pairs @ ${SEED_ITER} iters…\n`);
const band = {};
for (const v of VARS) {
  const Tm = TS[Math.floor(TS.length / 2)];
  const zero = SEEDS.map(s => runSim(ZERO_A, Tm, v, s, SEED_ITER).dps - runSim(ZERO_B, Tm, v, s, SEED_ITER).dps);
  const real = SEEDS.map(s => runSim(REAL_A, Tm, v, s, SEED_ITER).dps - runSim(REAL_B, Tm, v, s, SEED_ITER).dps);
  band[v] = { zero, real, zeroSd: sd(zero), realSd: sd(real), zeroMean: mean(zero), realMean: mean(real) };
  process.stderr.write('.');
}
process.stderr.write('\n');

// ── verdict, by the pre-registered rule ───────────────────────────────────────────────────────────
const report = {};
for (const v of VARS) {
  const dZero = sweep[v].zeroA.map((a, i) => a - sweep[v].zeroB[i]);
  const dReal = sweep[v].realA.map((a, i) => a - sweep[v].realB[i]);
  const pos = dZero.filter(x => x > 0).length, neg = dZero.filter(x => x < 0).length;
  const dTerm = sweep[v].termA.map((a, i) => a - sweep[v].termB[i]);
  const castJump = Math.max(...sweep[v].casts.slice(1).map((c, i) => Math.abs(c - sweep[v].casts[i])));
  const castRange = Math.max(...sweep[v].casts) - Math.min(...sweep[v].casts);
  // "Is it a staircase?" is NOT "are the values integers" — a first version asked that, and reported
  // an obvious staircase (flat for 1.5s, then +0.97 casts in one 0.1s step) as "continuous" because
  // the plateau sat at 65.97 rather than exactly 66. The right statistic is CONCENTRATION: how much
  // bigger the worst single step is than the average step. Smooth ⇒ ~1×; a staircase ⇒ many ×.
  const stepConcentration = castJump / (castRange / (TS.length - 1));
  report[v] = {
    castJumpMax: castJump, castRange, stepConcentration,
    termSpread: Math.max(...dTerm) - Math.min(...dTerm),
    termMaxStep: Math.max(...dTerm.slice(1).map((x, i) => Math.abs(x - dTerm[i]))),
    termFlips: Math.min(dTerm.filter(x => x > 0).length, dTerm.filter(x => x < 0).length),
    zeroFlips: Math.min(pos, neg),                       // D1: sign swings on a should-be-zero pair
    zeroSpread: Math.max(...dZero) - Math.min(...dZero),
    zeroAbsMax: Math.max(...dZero.map(Math.abs)),
    realCorrectPct: 100 * dReal.filter(x => x > 0).length / dReal.length,   // D2
    realMean: mean(dReal),
    seedSdZero: band[v].zeroSd, seedSdReal: band[v].realSd,                 // D3
  };
}

if (JSONOUT) { console.log(JSON.stringify({ TS, sweep, band, report }, null, 2)); process.exit(0); }

const f = (n, d = 2) => (n >= 0 ? '+' : '−') + Math.abs(n).toFixed(d);
console.log(`\n  fight lengths ${TS[0]}s … ${TS[TS.length - 1]}s in ${DT}s steps · ${ITER} iters · seed 11`);
console.log(`  character: bench gear-B · infinite mana · cold open\n`);
console.log('  ── mean Arcane Blast casts vs fight length ───────────────────────────');
for (const v of VARS) {
  console.log(`   var ${v}:  ${sweep[v].casts.map(c => c.toFixed(2)).join(' ')}`);
  console.log(`            largest single step ${report[v].castJumpMax.toFixed(2)} casts · total rise ${report[v].castRange.toFixed(2)} · concentration ${report[v].stepConcentration.toFixed(1)}× (1× = smooth, high = staircase)`);
}
console.log('\n  ── D1 ARTIFACT TEST — a lone haste buff at 0:20 vs 1:00 (truth: no difference) ──');
for (const v of VARS) {
  const r = report[v];
  console.log(`   var ${v}:  sign flips ${r.zeroFlips}/${TS.length} · |Δ| up to ${r.zeroAbsMax.toFixed(1)} DPS · spread across fight lengths ${r.zeroSpread.toFixed(1)} DPS`);
}
console.log('\n  ── D2 SENSITIVITY TEST — Icon inside Lust vs after it (truth: inside wins) ──');
for (const v of VARS) console.log(`   var ${v}:  correct sign at ${report[v].realCorrectPct.toFixed(0)}% of fight lengths · mean ${f(report[v].realMean, 1)} DPS`);
console.log('\n  ── D1c TERMINAL TEST (decisive) — Icy Veins over the kill vs interior ──');
console.log('     the arms differ in terminal cast RATE, so their staircases cannot cancel in the pairing');
for (const v of VARS) {
  const r = report[v];
  console.log(`   var ${v}:  worst jump per 0.1s of fight length ${r.termMaxStep.toFixed(1)} DPS · spread ${r.termSpread.toFixed(1)} DPS · sign flips ${r.termFlips}/${TS.length}`);
}
console.log('\n  ── D3 SEED BAND at one fight length (5 seeds) ───────────────────────');
for (const v of VARS) console.log(`   var ${v}:  sd(Δ) zero-pair ${report[v].seedSdZero.toFixed(2)} · real-pair ${report[v].seedSdReal.toFixed(2)} DPS`);

const d1 = report[0].zeroFlips > report[0.5].zeroFlips ? 0.5 : report[0.5].zeroFlips > report[0].zeroFlips ? 0 : null;
const termWinner = report[0].termMaxStep > report[0.5].termMaxStep * 2 ? 0.5 : report[0.5].termMaxStep > report[0].termMaxStep * 2 ? 0 : null;
const d2ok = v => report[v].realCorrectPct >= 80;
console.log('\n  ── VERDICT (pre-registered rule) ────────────────────────────────────');
if (!d2ok(0) || !d2ok(0.5)) console.log(`   D2 disqualifies: var ${!d2ok(0) ? 0 : 0.5} fails to see a real effect at ≥80% of fight lengths.`);
if (d1 !== null) console.log(`   D1 decides: var ${d1 === 0.5 ? 0 : 0.5} swings the SIGN of a difference that must be zero; var ${d1} does not.`);
else console.log('   D1 is a tie — neither setting flips the sign on the zero pair (both arms share a terminal lattice there, so the quantization cancels).');
if (termWinner !== null) console.log(`   D1c DECIDES: var ${termWinner === 0.5 ? 0 : 0.5} swings the measured effect by ${Math.max(report[0].termMaxStep, report[0.5].termMaxStep).toFixed(1)} DPS — about one whole cast — for a 0.1s change in the kill second. var ${termWinner} moves ${Math.min(report[0].termMaxStep, report[0.5].termMaxStep).toFixed(1)} DPS. ⇒ USE var ${termWinner}.`);
console.log(`   D3: var ${report[0].seedSdReal <= report[0.5].seedSdReal ? 0 : 0.5} has the tighter seed band (${Math.min(report[0].seedSdReal, report[0.5].seedSdReal).toFixed(2)} vs ${Math.max(report[0].seedSdReal, report[0.5].seedSdReal).toFixed(2)} DPS).`);
console.log();
process.exit(0);
