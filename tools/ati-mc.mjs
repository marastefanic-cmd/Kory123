// ASHTONGUE MONTE CARLO — the stochastic model's falsifier (added 08-03 with the renewal model).
//
//   node tools/ati-mc.mjs                 # engine vs a seeded MC of the true proc process
//   node tools/ati-mc.mjs --self-test     # swaps the reference for the RETIRED down-lattice form; must FAIL
//   node tools/ati-mc.mjs --html=other.html
//
// Exit: 0 = engine agrees with the process · 1 = disagreement · 2 = could not run.
//
// ── WHY THIS EXISTS ──────────────────────────────────────────────────────────────────────────────
// The Ashtongue proc is the one stochastic mechanic in an otherwise deterministic model, and the sim
// that used to falsify stochastic claims is retired. law-check asserts the engine against the renewal
// CLOSED FORMS — but those forms were derived by the same person who wrote the engine, so this tool
// asks the only independent referee left: a direct seeded simulation of the process itself
// (cast-by-cast, real proc rolls, haste snapshot at cast start, refresh-on-proc, no ICD).
//   · STEADY: the engine's interior integral slope (differenced, so the toll and the engagement
//     transient cancel) must match the MC's long-run cast rate at MC-noise tolerance.
//   · FULL FIGHT: the engine's whole-fight effective casts (toll model + ν-threaded transient) must
//     match an MC that walks the REAL ramp lattice, within the documented approximation budget
//     (continuous-transient residual ~0.03 + ramp-blend fictions ~0.1; see ESTABLISHED-FACTS §12.4).
// Deterministic: mulberry32, fixed seeds — same numbers every run (Determinism is a feature).
//
// ⚠ The MC re-states the PROCESS (intervals, rolls, refresh) but re-types no constant: everything is
// read from the engine's GAME/TALENTS/BUFFS (reference-gear doctrine).
import { loadEngine, ALL_BUFFS } from './engine-node.mjs';

const SELFTEST = process.argv.includes('--self-test');
const HTML = (process.argv.find(a => a.startsWith('--html=')) || '').split('=')[1]
          || new URL('../index.html', import.meta.url).pathname;
const api = loadEngine(HTML);
const G = api.GAME;
if (!G.ATI) { console.error('ATI-MC ERROR: engine has no GAME.ATI — predates the renewal model.'); process.exit(2); }

const mulberry32 = s => () => { s |= 0; s = s + 0x6D2B79F5 | 0; let t = Math.imul(s ^ s >>> 15, 1 | s); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
const msq = x => Math.round(x * 1000) / 1000;
const RTG = G.HASTE_RATING_PER_PCT * 100;

// per-cast proc chance at the EFFECTIVE crit — the same mixture the engine's atiProcQ implements,
// re-derived here from TALENTS/GAME (single-target; this tool does not model AoE phases)
const qOf = crit => {
  const f = 0.02 * api.TALENTS.arcaneConcentration;
  const pot = 0.10 * api.TALENTS.arcanePotency;
  return f * Math.min(1, crit + pot) * G.ATI.PROC_CHANCE + (1 - f) * crit * G.ATI.PROC_CHANCE;
};
// interval of a cast at `stacks`, haste multiplier m (msq'd, floored — the engine's own lattice rules)
const ivOf = (m, stacks) => {
  const gcd = msq(Math.max(G.GCD_FLOOR, G.GCD_BASE / m));
  return Math.max(msq((G.AB.BASE_CAST - G.AB.STACK_CAST_REDUCTION * stacks) / m), gcd);
};

// ── the true process, from a cold pull: real ramp lattice, proc rolls at completions ─────────────
// Returns expected effective casts by T (continuous credit for the straddling cast, the engine's own
// convention) averaged over `runs` seeded runs. `wins` = raid-external haste windows [start, end,
// mult] (aura at the CALL, both accounts agree on that geometry — no press-snap seam in this check);
// haste snapshots at cast START, exactly the engine's rule.
function mcFight(T, h, crit, runs, seed, wins) {
  const rnd = mulberry32(seed), q = qOf(crit);
  let acc = 0;
  for (let rr = 0; rr < runs; rr++) {
    let t = 0, rem = 0, stacks = 0, casts = 0;
    while (t < T) {
      let mult = 1;
      if (wins) for (const [ws, we, wm] of wins) if (t >= ws && t < we) mult *= wm;
      const m = mult * (1 + (h + (rem > 0 ? G.ATI.RATING : 0)) / RTG);
      const i = ivOf(m, stacks);
      casts += Math.min(1, (T - t) / i);
      t += i;
      if (stacks < G.AB.MAX_STACKS) stacks++;
      if (rnd() < q) rem = G.ATI.DUR; else rem = Math.max(0, rem - i);
    }
    acc += casts;
  }
  return acc / runs;
}
// long-run steady cast rate (burn-in past the ramp + one proc window)
function mcSteadyRate(h, crit, nCasts, seed) {
  const rnd = mulberry32(seed), q = qOf(crit);
  let rem = 0, stacks = 0;
  for (let k = 0; k < 20000; k++) {
    const i = ivOf(1 + (h + (rem > 0 ? G.ATI.RATING : 0)) / RTG, stacks);
    if (stacks < G.AB.MAX_STACKS) stacks++;
    if (rnd() < q) rem = G.ATI.DUR; else rem = Math.max(0, rem - i);
  }
  let time = 0;
  for (let k = 0; k < nCasts; k++) {
    const i = ivOf(1 + (h + (rem > 0 ? G.ATI.RATING : 0)) / RTG, stacks);
    time += i;
    if (rnd() < q) rem = G.ATI.DUR; else rem = Math.max(0, rem - i);
  }
  return nCasts / time;
}

// ── the engine side ──────────────────────────────────────────────────────────────────────────────
const cfgOf = (T, h, critPct, lust) => ({
  T, hasteRating: h, sp: 1000, critPct,
  enabled: Object.fromEntries(ALL_BUFFS.map(k => [k, k === 'ati' || (lust !== undefined && k === 'bloodlust')])),
  fixed: lust !== undefined ? { bloodlust: [lust] } : {}, warnings: [], coldSnap: true, segments: null,
});
const one = critPct => (G.AB.AVG_BASE_DMG + G.AB.COEF * 1000) * (1 + (critPct / 100) * (G.CRIT_MULT - 1));
const casts = (T, h, critPct, lust) => api.simulate(lust !== undefined ? { bloodlust: [lust] } : {},
  cfgOf(T, h, critPct, lust), true).integral / one(critPct);

/* ⚠ NEGATIVE CONTROL — `--self-test` replaces the ENGINE's steady reading with the RETIRED model's:
   attempts counted on the DOWN lattice (`dur/b` exponent) and the E[1/i] blend — the exact pre-08-03
   integrand. That form under-prices the proc by ~3e-3 casts/s at buffed crit, ~6× this gate's
   tolerance, so if the gate cannot fail on it, its tolerance asserts nothing. */
const retiredRate = (h, crit) => {
  const q = qOf(crit);
  const b = ivOf(1 + h / RTG, G.AB.MAX_STACKS), a = ivOf(1 + (h + G.ATI.RATING) / RTG, G.AB.MAX_STACKS);
  const P = 1 - Math.pow(1 - q, G.ATI.DUR / b);
  return P / a + (1 - P) / b;
};

let bad = 0;
const chk = (name, got, want, tol) => {
  const ok = Math.abs(got - want) <= tol;
  if (!ok) bad++;
  console.log(`  ${ok ? '✓' : '⛔'} ${name.padEnd(52)} ${got.toFixed(5)}   mc ${want.toFixed(5)}   (tol ${tol})`);
};

console.log('# ATI-MC — the engine against a seeded simulation of the real proc process\n');
console.log('STEADY (interior slope, toll+transient differenced out, vs long-run MC rate):');
const STATES = [
  { h: 0, crit: 25 }, { h: 0, crit: 50.765 }, { h: 300, crit: 40 }, { h: 900, crit: 40 },
];
for (const { h, crit } of STATES) {
  const eng = SELFTEST ? retiredRate(h, crit / 100)
                       : (casts(300, h, crit) - casts(150, h, crit)) / 150;
  const mc = mcSteadyRate(h, crit / 100, 2e6, 1234567);
  chk(`steady rate h=${h} crit=${crit}`, eng, mc, 8e-4);
}
console.log('\nFULL FIGHT (engine toll + nu-threaded transient vs MC on the REAL ramp lattice):');
for (const { T, h, crit } of [{ T: 120, h: 0, crit: 50.765 }, { T: 180, h: 0, crit: 25 }]) {
  const eng = casts(T, h, crit);
  const mc = mcFight(T, h, crit / 100, 200000, 424242);
  chk(`full fight T=${T} h=${h} crit=${crit}`, eng, mc, 0.25);
}
// WINDOWED full fight — the edge-memory check (08-04). A Bloodlust pinned mid-fight puts two haste
// edges in the proc's path; the true average transitions over one 5s window at each. The engine
// carries that transition exactly (the strata machinery) — the residual here is the pre-existing
// in-flight-straddle convention at the edges plus the continuous-transient smoothing, both priced
// in ESTABLISHED-FACTS §12.3/§12.4. Pinned externals only: their aura starts at the CALL in both
// accounts, so this check has no press-snap seam.
console.log('\nWINDOWED (a pinned Bloodlust mid-fight — proc memory crossing haste edges):');
for (const { T, h, crit, lust } of [{ T: 120, h: 0, crit: 50.765, lust: 30 }, { T: 150, h: 0, crit: 38, lust: 60 }]) {
  const eng = casts(T, h, crit, lust);
  const mc = mcFight(T, h, crit / 100, 200000, 91919, [[lust, lust + 40, 1.3]]);
  chk(`lust@${lust} T=${T} crit=${crit}`, eng, mc, 0.15);
}

if (SELFTEST) {
  console.log(`\n${bad ? `SELF-TEST PASS — the retired down-lattice form was caught by ${bad} line(s).`
                       : 'SELF-TEST FAIL — the gate cannot distinguish the retired model. Its tolerance asserts nothing.'}`);
  process.exit(bad ? 0 : 1);
}
console.log(`\n${bad ? `⛔ ${bad} check(s) failed — the engine disagrees with the process it claims to model.`
                     : '✓ the engine reproduces the real proc process (steady exactly; full fight inside the documented budget).'}`);
process.exit(bad ? 1 : 0);
