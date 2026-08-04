// BRUTE-CELL — exhaustive scan of ONE fight's dominant degrees of freedom, to get ground truth.
//
//   node tools/brute-cell.mjs --T=380 --lust=60
//   node tools/brute-cell.mjs --T=160 --lust=20 --sp=1387 --crit=38 --json=/tmp/cell.json
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
//
// ★ FIXED 08-04 — THE FIFTH INSTRUMENT TO GRADE ON THE WRONG OBJECTIVE, now on the pair. This file
// scored `simulate().robust / <hand-typed normalizer>`: the per-cast SUM (REPORTED since §8h, never
// ranking) over a re-typed plain-cast constant — the exact §8t/§8u/§8y mistake, made a fifth time.
// It now imports the engine's own `rankPair`/`planBetter`/`plainCastOf` and grades on the OBJECTIVE
// PAIR, reporting the tie PLATEAU (every member within the band of the maximum) rather than one
// winner — the §8y revision precedent requires a ruling to have SEEN the plateau, so an instrument
// that hides it cannot feed one. Gear is parameterized (--sp --crit --haste --t5two) because the
// hard-coded buffed gear silently denominated every earlier reading in one pipeline's stats.
import fs from 'node:fs';
import { loadEngine, cfgFor } from './engine-node.mjs';

const arg = (n, d) => { const a = process.argv.find(x => x.startsWith(`--${n}=`)); return a ? a.split('=')[1] : d; };
const num = (n, d) => +arg(n, d);
const T = num('T', 380), LUSTRAW = arg('lust', '60');
const LUSTS = LUSTRAW === 'none' ? [] : LUSTRAW.split(',').map(Number);
const SP = num('sp', 1611.8875), CRIT = num('crit', 50.76538949275363), HASTE = num('haste', 0);
const T5 = arg('t5two', '1') !== '0';
const JSONOUT = arg('json', null);
const api = loadEngine(new URL('../index.html', import.meta.url).pathname);
const B = api.BUFFS;

const KIT = ['icyVeins', 'isc', 'scb', 'arcanePower', 'berserking', 'bloodlust'];
const cfg = { ...cfgFor(api, { name: 'x', T, pins: LUSTS.length ? { bloodlust: LUSTS } : {},
  gear: { haste: HASTE, sp: SP, crit: CRIT, coldSnap: true }, kit: KIT }), t5two: T5 };
const plain = api.plainCastOf(cfg);
const band = api.TIE_CASTS * plain;
const clone = o => JSON.parse(JSON.stringify(o));
const pairOf = s => api.rankPair(api.repair(clone(s), cfg), cfg);
const key = s => Object.keys(s).sort().map(k => `${k}:${s[k].join(',')}`).join(' ');

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

console.log(`# BRUTE-CELL  T=${T}  Bloodlust ${LUSTS.length ? 'pinned ' + LUSTS.join(',') : 'NONE'}  sp=${SP} crit=${CRIT} h=${HASTE} t5two=${T5}\n`);
let n = 0;
const seen = new Map();   // repaired-plan key -> { pair, s } — the plateau needs every distinct member
const consider = s => {
  const rep = api.repair(clone(s), cfg);
  const k = key(rep);
  if (seen.has(k)) { n++; return; }
  seen.set(k, { pair: api.rankPair(rep, cfg), s: rep });
  n++;
};
for (let c = 0; c <= T - 1; c++) {
  const isc = chain('isc', c), scb = chain('scb', c), ap = chain('arcanePower', c);
  for (const zerkA of [...new Set([0, c, ...LUSTS])]) {
    const zerk = chain('berserking', zerkA);
    for (let ivA = Math.max(0, c - 12); ivA <= Math.min(T - 1, c + 12); ivA++) {
      for (const iv of ivVariants(ivA)) {
        consider({ icyVeins: iv, isc, scb, arcanePower: ap, berserking: zerk,
                   ...(LUSTS.length ? { bloodlust: LUSTS.slice() } : {}) });
      }
    }
  }
}
console.log(`  evaluated ${n.toLocaleString()} anchor-and-chain layouts (${seen.size.toLocaleString()} distinct after repair)\n`);

// the plateau: every distinct member within one band of the maximum score; canonical by planBetter
const all = [...seen.values()];
let hi = -Infinity;
for (const m of all) if (m.pair.score > hi) hi = m.pair.score;
const plateau = all.filter(m => m.pair.score >= hi - band);
let canon = plateau[0];
for (const m of plateau) if (api.planBetter(m.pair, canon.pair)) canon = m;
plateau.sort((a, b) => b.pair.score - a.pair.score);
console.log(`  FAMILY ARGMAX  ${(hi / plain).toFixed(6)} casts · plateau ${plateau.length} member(s) within the band`);
for (const m of plateau.slice(0, 8)) {
  console.log(`   ${m === canon ? '★' : '·'} Δ ${((m.pair.score - hi) / plain).toFixed(6)}  ${key(m.s)}`);
}
if (plateau.length > 8) console.log(`   … ${plateau.length - 8} more`);

// …against what the optimizer emits
const own = (await api.optimizeAsync(cfg, 14, () => {})).s;
const ownPair = pairOf(own);
console.log(`\n  OPTIMIZER   ${(ownPair.score / plain).toFixed(6)} casts   ${key(api.repair(clone(own), cfg))}`);
const d = (hi - ownPair.score) / plain;
const beaten = api.planBetter(canon.pair, ownPair);
console.log(`\n  Δ(family argmax − emitted) = ${d >= 0 ? '+' : ''}${d.toFixed(6)} casts  (${Math.round(Math.abs(d) / api.TIE_CASTS)}× the tie band)`);
console.log(d > api.TIE_CASTS ? '  ⛔ the optimizer is beaten by an anchor-and-chain layout — a genuine SEARCH miss.'
          : d < -api.TIE_CASTS ? '  ✓ the optimizer BEATS every anchor-and-chain layout — its answer is outside this family.'
          : beaten ? '  · tied on score; the family holds a better-SHAPED member (tie-break, not damage).'
          : '  ✓ the optimizer matches the exhaustive scan within the tie band.');

if (JSONOUT) {
  fs.writeFileSync(JSONOUT, JSON.stringify({
    T, lust: LUSTS, sp: SP, crit: CRIT, haste: HASTE, t5two: T5,
    evaluated: n, distinct: seen.size, plainCast: plain, band,
    familyArgmaxCasts: hi / plain,
    plateau: plateau.map(m => ({ casts: m.pair.score / plain, dCasts: (m.pair.score - hi) / plain,
                                 canonical: m === canon, s: m.s })),
    emitted: { s: own, casts: ownPair.score / plain },
    dCasts: d, beatenOnShape: beaten && Math.abs(d) <= api.TIE_CASTS,
    searchMiss: d > api.TIE_CASTS,
  }, null, 1));
  console.log(`\n  → ${JSONOUT}`);
}
process.exit(0);
