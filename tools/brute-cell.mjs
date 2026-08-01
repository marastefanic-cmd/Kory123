// BRUTE-CELL — exhaustive scan of ONE fight's dominant degrees of freedom, to get ground truth.
//
//   node tools/brute-cell.mjs --T=380 --lust=60
//
// ── WHY A STRUCTURED SCAN AND NOT A TRUE BRUTE FORCE ────────────────────────────────────────────
// A real brute force over 6 tracks × 380 press-seconds is 380^k and hopeless (§8y managed 1,582,581
// layouts for a **2:00** fight). But the search space is not flat: a plan is a small number of ANCHORS
// with each track chained off one of them at its own cooldown. Every declared layout in the corpus has
// that shape, and so does every candidate any instrument has ever proposed. So scan the ANCHORS
// exhaustively and let the cooldown chains follow — that is a complete enumeration of the family the
// answer actually lives in, at ~10^5 evaluations instead of ~10^12.
//
// ⚠ WHAT IT THEREFORE CANNOT SEE, stated plainly so a clean result is not over-read: a layout whose
// tracks do NOT chain at their own cooldowns (a deliberately delayed use, a use dropped to re-align a
// later one) is outside the family and this will miss it. It is ground truth for "the best
// anchor-and-chain layout", not for "the best layout".
import { loadEngine, cfgFor } from './engine-node.mjs';

const arg = (n, d) => { const a = process.argv.find(x => x.startsWith(`--${n}=`)); return a ? +a.split('=')[1] : d; };
const T = arg('T', 380), LUST = arg('lust', 60);
const api = loadEngine(new URL('../index.html', import.meta.url).pathname);
const G = api.GAME, B = api.BUFFS;

const KIT = ['icyVeins', 'isc', 'scb', 'arcanePower', 'berserking', 'bloodlust'];
const cfg = { ...cfgFor(api, { name: 'x', T, pins: { bloodlust: [LUST] },
  gear: { haste: 0, sp: 1611.8875, crit: 50.76538949275363, coldSnap: true }, kit: KIT }), t5two: true };
const one = (G.AB.AVG_BASE_DMG + G.AB.COEF * cfg.sp) *
  (1 + Math.min(1, cfg.critPct / 100) * (G.CRIT_MULT - 1)) * (cfg.t5two ? 1.2 : 1);
const sc = s => api.simulate(api.repair(JSON.parse(JSON.stringify(s)), cfg), cfg, true).robust / one;

// a track chained from `a` at its own cooldown, clipped to the fight
const chain = (k, a) => { const out = []; for (let t = a; t <= T - 1; t += B[k].cd) out.push(t); return out; };
// Icy Veins gets the extra Cold Snap charge, and WHERE it is spent is a real degree of freedom (§9d):
// as a prepull double onto the anchor, as an immediate double after it, or at the end of the chain.
const ivVariants = a => {
  const base = chain('icyVeins', a), dur = B.icyVeins.dur, out = [base];
  const pre = Math.max(a - dur, -(dur - 1));
  if (pre < a) out.push([pre, ...base]);
  if (base.length) {
    out.push([...base.slice(0, 1), a + dur, ...base.slice(1)]);
    const last = base[base.length - 1];
    if (last + dur <= T - 1) out.push([...base, last + dur]);
  }
  return out;
};

console.log(`# BRUTE-CELL  T=${T}  Bloodlust pinned ${LUST}\n`);
let best = null, n = 0;
const CL = [];                        // cluster anchors: every second
for (let c = 0; c <= T - 1; c++) CL.push(c);
for (const c of CL) {
  const isc = chain('isc', c), scb = chain('scb', c), ap = chain('arcanePower', c);
  for (const zerkA of [...new Set([0, c, LUST])]) {
    const zerk = chain('berserking', zerkA);
    for (let ivA = Math.max(0, c - 12); ivA <= Math.min(T - 1, c + 12); ivA++) {
      for (const iv of ivVariants(ivA)) {
        const s = { icyVeins: iv, isc, scb, arcanePower: ap, berserking: zerk, bloodlust: [LUST] };
        const v = sc(s); n++;
        if (!best || v > best.v) best = { v, s: JSON.parse(JSON.stringify(s)) };
      }
    }
  }
}
console.log(`  evaluated ${n.toLocaleString()} anchor-and-chain layouts\n`);
console.log(`  BEST FOUND  ${best.v.toFixed(6)} casts`);
for (const k of Object.keys(best.s).sort()) console.log(`     ${k.padEnd(12)} [${best.s[k]}]`);

// …against what the optimizer emits, and against the cross-seeding witness
const own = (await api.optimizeAsync(cfg, 14, () => {})).s;
console.log(`\n  OPTIMIZER   ${sc(own).toFixed(6)} casts`);
for (const k of Object.keys(own).sort()) console.log(`     ${k.padEnd(12)} [${own[k]}]`);
const d = best.v - sc(own);
console.log(`\n  Δ = ${d >= 0 ? '+' : ''}${d.toFixed(6)} casts  (${Math.round(Math.abs(d) / 0.002)}× the 0.002 tie band)`);
console.log(d > 0.002 ? '  ⛔ the optimizer is beaten by an anchor-and-chain layout — a genuine SEARCH miss.'
          : d < -0.002 ? '  ✓ the optimizer BEATS every anchor-and-chain layout — its answer is outside this family.'
          : '  ✓ the optimizer matches the exhaustive scan within the tie band.');
