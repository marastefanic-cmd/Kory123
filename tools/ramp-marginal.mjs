// PROBE: does the model credit a haste window for COVERING THE OPENING RAMP?
//
//   node tools/ramp-marginal.mjs
//
// ── WHY IT EXISTS ────────────────────────────────────────────────────────────────────────────
// RULES §3 recorded the sim paying ~+0.079 pp for ramp coverage while "the model's haste marginal
// is flat in position to 0.0000 pp" (PHASE8 §15.5 F5) — and ROADMAP called that "a genuine defect
// in that axiom". This probe was built to test that claim, and it FALSIFIED it.
//
// The algebra says position-independence is only exact BELOW the GCD floor:
//   floor-free: casts(haste on ramp) == casts(haste interior), EXACTLY (both 68.000 at T=100).
//       Case A (window covers the ramp)  = 3 + (Dh + T - Rb - D)/c
//       Case B (window interior, steady) = 3 + (Dh - Rb + T - D)/c        -- algebraically IDENTICAL
//   floored:    the ramp's casts (2.5/2.167/1.833s base) sit further from the 1.0s floor than the
//       steady cast (1.5s base) does, so haste spent on the ramp is NOT clipped while haste spent
//       on a floored steady stream IS -> coverage should WIN, by exactly the recovered floor slack.
//
// ── PRE-REGISTERED DECISION RULE (stated before the run) ─────────────────────────────────────
// Regime A (no Lust):  m = 1.0254 * 1.20 = 1.230 -> steady 1.219s, floor slack. Expect ~0.000.
// Regime B (Lust@0):   m = 1.0254 * 1.30 * 1.20 = 1.599 -> steady 0.938 -> FLOORED. Expect > 0.
// If BOTH read 0.000 the model has a real gap; if A=0 and B>0 the model is structurally right and
// F5's flat reading came from a floor-free setup (so the sim's premium is unexplained).
//
// ── VERDICT (this is what it prints) ─────────────────────────────────────────────────────────
// A = EXACTLY 0.0000 pp on all 6 legs, with bit-identical `robust` values -> correct, per the algebra.
// B = +0.3298 (IV R=40) / +0.3455 (MQG R=40) / +0.4063 (IV R=70) / +0.4077 (MQG R=70) pp, magnitude
//     monotone in the floor slack (0.062 -> 0.086s), and EXACTLY 0.0000 for Berserking at both hastes
//     because its steady cast (1.023s / 1.004s) never crosses the floor. That Zerk leg is the
//     within-regime control: same Lust, same ramp, weaker haste buff => zero.
// Cross-check: an independent hand derivation predicted +0.27 casts for IV+Lust@R=40; +0.3298 pp on
// ~89.7 casts = +0.296 casts. Two derivations agree.
// => The model's ramp-coverage credit IS floor-slack recovery, which is the whole of the physics.
//    There is no axiom to fix. The sim's +0.079 pp premium (measured floor-free, where the right
//    answer is 0) is a residual with no identified mechanism => a sim-setup audit trigger per
//    CLAUDE.md, NOT a model bug. Do not patch index.html on it (PHASE8 §7).
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadEngine } from './engine-node.mjs';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const api = loadEngine(path.join(REPO, 'index.html'));
const { simulate, BUFFS, defaults } = api;
const G = defaults.gear;

const mkCfg = (T, haste, kit) => {
  const enabled = {};
  for (const k in BUFFS) enabled[k] = kit.includes(k);
  return { T, hasteRating: haste, sp: G.sp, critPct: G.crit, enabled,
           fixed: {}, warnings: [], coldSnap: false, segments: null };
};

const HR = 15.77;
const steadyCast = m => Math.max(1.0, 1.5 / m);
const rampCast = (n, m) => Math.max(1.0, (2.5 - n / 3) / m);

function probe(label, T, R, buff, extra) {
  const kit = [buff, ...Object.keys(extra)];
  const cfg = mkCfg(T, R, kit);
  const gearM = 1 + R / (HR * 100);
  const bm = BUFFS[buff];
  const bMult = bm.kind === 'mult' ? bm.value : 1 + bm.value / (HR * 100);
  const withLust = extra.bloodlust !== undefined ? 1.3 : 1;
  const m = gearM * bMult * withLust;
  const rows = [];
  // The ramp ends around 6.3s, so AT=0 is the only press that covers it (RULES §3: AT=5 snaps
  // past the ramp's last boundary). Sweep well past it to confirm interior flatness.
  for (const at of [0, 5, 10, 20, 30, 40]) {
    const s = { [buff]: [at] };
    for (const k in extra) s[k] = extra[k];
    rows.push([at, simulate(s, cfg).robust]);
  }
  const base = rows.find(r => r[0] === 20)[1];
  console.log(`\n${label}`);
  console.log(`  m(buff+gear${withLust > 1 ? '+lust' : ''}) = ${m.toFixed(4)}  steady cast ${steadyCast(m).toFixed(3)}s` +
              `${1.5 / m < 1.0 ? '  <-- FLOORED (slack ' + (1.0 - 1.5 / m).toFixed(3) + 's wasted/cast)' : '  (floor slack ' + (1.5 / m - 1.0).toFixed(3) + 's)'}` +
              `   ramp casts ${[0, 1, 2].map(n => rampCast(n, m).toFixed(3)).join('/')}s`);
  for (const [at, v] of rows) {
    const pp = (v - base) / base * 100;
    console.log(`   AT=${String(at).padStart(2)}  robust ${v.toFixed(6)}   vs AT=20: ${pp >= 0 ? '+' : ''}${pp.toFixed(4)} pp${at === 0 ? '   <-- covers the ramp' : ''}`);
  }
  return rows;
}

console.log('='.repeat(78));
console.log('MODEL ramp-coverage marginal — is a haste press at 0 worth more than one at 20?');
console.log('='.repeat(78));

for (const R of [40, 70]) {
  for (const buff of ['icyVeins', 'mqg', 'berserking']) {
    probe(`REGIME A (no Lust, floor-free) — ${buff} @ R=${R}, T=100`, 100, R, buff, {});
  }
}
for (const R of [40, 70]) {
  for (const buff of ['icyVeins', 'mqg', 'berserking']) {
    probe(`REGIME B (Lust@0, floor binds) — ${buff} @ R=${R}, T=100`, 100, R, buff, { bloodlust: [0] });
  }
}
console.log('\nREAD THE HEADER for the pre-registered decision rule and the verdict.');
