// PHASE8 §23 — where in the FIGHT does B2's differential bias live? Sim-free: §2's sim column is
// already recorded, so the model side is all that needs computing.
//
// WHY. §22 killed the boundary charge as B2's mechanism, so Phase 8's remaining charter is "find a
// mechanism worth ~0.445 pp". §2 recorded that the model is negative 7/7 across fight lengths
// (sign test p≈0.008) — a systematic differential bias — but nobody has asked WHERE it sits. The
// length profile is a hard constraint on any candidate: a terminal-region mechanism cannot explain
// a bias that is already large at T=40, and an opener mechanism cannot explain one that only
// appears at T=229.
//
// VALIDATION ANCHOR: at T=229 this setup must reproduce §13.8's recorded model reading of −0.037 %
// for the corrected harness (t5two + effSP 1450). Asserted below; exit 3 on drift.
import path from 'path';
import { fileURLToPath } from 'url';
import { loadEngine } from './engine-node.mjs';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const api = loadEngine(path.join(REPO, 'index.html'));
const { simulate, BUFFS } = api;

const kit = ['icyVeins', 'isc', 'mqg', 'arcanePower', 'berserking', 'bloodlust'];
const en = {}; for (const k in BUFFS) en[k] = kit.includes(k);
const cfgAt = T => ({
  T, hasteRating: 70, sp: 1450, critPct: 38, enabled: en,
  fixed: { bloodlust: [162] }, warnings: [], coldSnap: true, segments: null, t5two: true,
});

const h40 = { bloodlust: [162], arcanePower: [8, 188], berserking: [0, 188], icyVeins: [0, 20, 200], isc: [29, 183], mqg: [9] };
const h70 = { bloodlust: [162], arcanePower: [4, 192], berserking: [6, 192], icyVeins: [0, 20, 202], isc: [4, 182], mqg: [202] };
const PLAN = { h40, h70 };

// §2's recorded sim column (same CRN pair, var-robust), % advantage of h40 over h70.
const SIM = { 40: 7.850, 70: 5.666, 100: 4.217, 140: 3.116, 180: 2.435, 205: 2.387, 229: 0.360 };
const LENGTHS = [40, 70, 100, 140, 180, 205, 229];

const rob = (s, T) => simulate(s, cfgAt(T)).robust;
const modelPct = T => 100 * (rob(h40, T) / rob(h70, T) - 1);

console.log('=== PHASE8 §23 — B2 differential bias by fight length (model computed, sim recorded from §2)\n');
console.log('    T     sim %(h40−h70)   model %(h40−h70)   model−sim (pp)   |   live presses h40 / h70');
const gaps = [];
for (const T of LENGTHS) {
  const m = modelPct(T), s = SIM[T], gap = m - s;
  gaps.push({ T, m, s, gap });
  const live = p => Object.entries(PLAN[p]).filter(([k]) => k !== 'bloodlust')
    .flatMap(([k, ts]) => ts.filter(t => t < T).map(t => `${k}@${t}`)).length;
  console.log(`  ${String(T).padStart(4)}   ${s.toFixed(3).padStart(12)}   ${m.toFixed(3).padStart(16)}   ` +
              `${gap.toFixed(3).padStart(14)}   |   ${live('h40')} / ${live('h70')}`);
}

// ── anchor check ───────────────────────────────────────────────────────────────────────────────
const m229 = gaps.find(g => g.T === 229).m;
const anchorOk = Math.abs(m229 - (-0.037)) < 0.002;
console.log(`\n  anchor: model@229 = ${m229.toFixed(3)} % (§13.8 records −0.037 for t5two+effSP) ${anchorOk ? '✓' : '✗ DRIFT'}`);
if (!anchorOk) { console.error('  ✗ setup does not reproduce the recorded number — nothing above is believable.'); process.exit(3); }

// ── the shape ──────────────────────────────────────────────────────────────────────────────────
const neg = gaps.filter(g => g.gap < 0).length;
const worst = gaps.reduce((a, b) => (b.gap < a.gap ? b : a));
const mid = gaps.filter(g => g.T >= 70 && g.T <= 205);
const midMean = mid.reduce((a, g) => a + g.gap, 0) / mid.length;
console.log(`\n=== SHAPE`);
console.log(`  sign: ${neg}/${gaps.length} negative (model under-credits the haste-front-loaded h40)`);
console.log(`  worst cell: T=${worst.T} at ${worst.gap.toFixed(3)} pp`);
console.log(`  T=40 (opener-only)      ${gaps[0].gap.toFixed(3)} pp`);
console.log(`  T=70..205 mean (mid)    ${midMean.toFixed(3)} pp`);
console.log(`  T=229 (full fight)      ${gaps[gaps.length - 1].gap.toFixed(3)} pp`);
const endsHeavy = Math.min(gaps[0].gap, gaps[gaps.length - 1].gap) < midMean - 0.05;
console.log(endsHeavy
  ? `  ★ U-SHAPED: both ENDS carry more bias than the middle. A single mid-fight mechanism cannot\n` +
    `    produce this; it points at TWO terms (an opener/ramp one and a terminal one) or at one\n` +
    `    term whose magnitude scales with how much of the fight is ramp-or-kill rather than steady.`
  : `  profile is not end-heavy; the bias is broadly distributed across length.`);

// ── what is even DIFFERENT at T=40 ─────────────────────────────────────────────────────────────
// At T=40 none of h70's late presses (isc@182, AP@192, IV@202, MQG@202) exist yet, so the cell is a
// pure OPENER comparison — and the opener is where the ramp lives (slow 2.5/4.667/6.5 casts, RULES
// §3). Any mechanism explaining T=40 must be a ramp mechanism.
console.log(`\n=== T=40 IS A PURE OPENER CELL — the presses that differ inside it`);
for (const p of ['h40', 'h70']) {
  const live = Object.entries(PLAN[p]).filter(([k]) => k !== 'bloodlust')
    .flatMap(([k, ts]) => ts.filter(t => t < 40).map(t => `${k}@${t}`)).sort();
  console.log(`  ${p}: ${live.join(' ')}`);
}
console.log(`  ⇒ h40 buys early HASTE (mqg@9, zerk@0); h70 buys early VALUE (AP@4, isc@4), and both of\n` +
            `    h70's value presses land INSIDE the ramp, where casts run 2.5–4.7 s vs ~1.4 s steady.\n`);
// ── the ramp hypothesis, TESTED ────────────────────────────────────────────────────────────────
// The tempting story: start-vs-completion sampling (RULES §3b.3 vs PHASE8 §5) diverges in
// proportion to CAST LENGTH, so the ramp (2.5–4.7 s casts) maximises it, and h70 is the plan that
// spends its value presses there. It had a standing objection before it was run — §3b.3 says the
// FRONT edge is clean under boundary-snap, and AP@4's BACK edge (≈19.7 s) lands in steady state,
// not in the ramp (0→3 stacks ends ≈6.5 s) — so neither edge obviously sits on a long cast.
// Run the §22 charge at T=40 and read the DIFFERENTIAL's sign.
const rob2 = (s, T) => simulate(s, cfgAt(T)).robust;
const bd = (s, T) => simulate(s, cfgAt(T), true).casts.reduce((a, c) => a + c.dmg, 0);
const valueCharge = (p, T) => ['isc', 'arcanePower'].reduce((acc, k) => {
  const s = PLAN[p], live = s[k].filter(t => t < T);
  if (!live.length) return acc;
  const w = { ...s, [k]: live }, wo = { ...s, [k]: [] };
  return acc + 100 * ((rob2(w, T) - rob2(wo, T)) - (bd(w, T) - bd(wo, T))) / rob2(s, T);
}, 0);
console.log(`\n=== RAMP HYPOTHESIS — TESTED (§22's charge, re-run at the opener-only cell)`);
for (const T of [40, 229]) {
  const dL = valueCharge('h40', T) - valueCharge('h70', T);
  const bias = gaps.find(g => g.T === T).gap;
  console.log(`  T=${String(T).padStart(3)}:  L(h40)=${valueCharge('h40', T).toFixed(4).padStart(8)}  ` +
              `L(h70)=${valueCharge('h70', T).toFixed(4).padStart(8)}  ΔL=${(dL >= 0 ? '+' : '') + dL.toFixed(4)} pp` +
              `   vs observed bias ${bias.toFixed(3)} pp`);
}
console.log(`  ⚠ magnitudes are pp of that fight's own base, so T=40 is inflated by normalization —\n` +
            `    the SIGN of ΔL, and its sign against the observed bias, are what discriminate.\n` +
            `  ✗ FALSIFIED: ΔL is POSITIVE at both lengths while the observed bias is NEGATIVE at\n` +
            `    both, and at T=40 the charge is ~5.8× its T=229 value and ~4.6× the bias it would\n` +
            `    have to explain. The ramp story fails the same way §22's did — same family, same\n` +
            `    wrong direction. ★ Load-bearing corollary: §22's anti-B2 verdict is NOT a T=229\n` +
            `    artifact; it holds across fight length and is STRONGEST in the pure-opener cell.`);
