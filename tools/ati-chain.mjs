// ATI EXACT CHAIN — the truth instrument for the stochastic mechanic, and the SECOND CERTIFIER
// every Ashtongue-bearing declaration needs (added 08-07; the §12.3a probe rebuilt as a tool, and
// extended from bare fights to full LAYOUTS).
//
//   node tools/ati-chain.mjs                        # validation battery only
//   node tools/ati-chain.mjs --cells=tools/cells/derive-0806.jsonl[,more.jsonl]
//   node tools/ati-chain.mjs --self-test            # chain's proc branch zeroed; battery must FAIL
//
// Exit: 0 = validated (and every ATI cell certified, if --cells) · 1 = a cell's emission is NOT
//       truth-co-optimal, or validation failed · 2 = could not run.
//
// ── WHAT IT IS ───────────────────────────────────────────────────────────────────────────────────
// The proc process is a finite Markov chain: state after cast k is (t, rem, prevCastEnd, fired
// window starts), everything on the millisecond lattice, so E[Σ dmg·frac] propagates cast by cast
// with NO sampling error. This build carries the engine's full execution conventions — press→fire at
// (path-dependent) boundaries, externals at the call, haste snapshotted at cast start, value read at
// completion over (start, end], the boundary credit — so it scores whole layouts, which the retired
// §12.3a scratchpad probe could not. Validated two ways every run:
//   V1  per-layout, q=0 arm vs the engine's ATI-off deterministic walk: robust/plain to ~1e-9
//       (proves the mechanics replication — any drift here voids every verdict below);
//   V2  bare-ATI arm vs §12.3a's published residual table (five rows incl. h=300/600).
//
// ── WHY A SECOND CERTIFIER, AND WHY THE RESIDUAL IT MEASURES CANNOT BE FIXED IN-MODEL ────────────
// Measured 08-07 on the gem+ati cell: the integrand's engine−truth residual is +0.007 on the
// truth-best layout but +0.056 on the STRUCTURE-IDENTICAL layout with Icy Veins #1 abutting the proc
// carry (iv[60,85] vs iv[60,90]) — so the engine separates two layouts by 0.049 casts that the truth
// chain says are tied to 0.000025. The §19 ridge's residual preference for the abutting second is
// ARTIFACT, and it is 3× the ≤+0.018 drain bound §12.3a recorded (IV windows add haste edges, and
// the residual lives at edges).
// ⛔ And the artifact is not a bug with a fix waiting: the continuum's stratum drain
// `fit = (DUR − consumed)/a_s` is EXACTLY the uniform-phase average of the true integer survivor
// count — E[⌈(X−δ)/a⌉] over δ~U[0,a) is X/a identically — so the integrand is already the correct
// phase-average, and what remains is the truth's phase NON-uniformity at proc-chain edges (plus the
// count↔phase covariance). Pricing that requires the cast lattice, which may not re-enter the
// integrand (§8l). ⇒ the residual is an accepted limit with a measured bound, and the chain is how
// an ATI declaration proves it is not locking an artifact: the emitted layout must sit within the
// project's own tie band of the chain's truth-top over the engine-ranked competitor set.
// ⚠ NOT a CI gate — a cell takes minutes-to-hours. It is a declaration-time instrument, like
// lattice-brute. ⚠ And not a new comparator: the band is IMPORTED (rankPair().band), never retyped.
import fs from 'node:fs';
import { loadEngine, ALL_BUFFS } from './engine-node.mjs';

const SELFTEST = process.argv.includes('--self-test');
const CELLS = (process.argv.find(a => a.startsWith('--cells=')) || '').split('=')[1];
const HTML = (process.argv.find(a => a.startsWith('--html=')) || '').split('=')[1]
          || new URL('../index.html', import.meta.url).pathname;
const api = loadEngine(HTML);
const G = api.GAME, B = api.BUFFS;
if (!G.ATI) { console.error('ATI-CHAIN ERROR: engine has no GAME.ATI.'); process.exit(2); }
const RTG = G.HASTE_RATING_PER_PCT * 100;
const ATISCALE = G.ATI.RATING / RTG;
const EXTERNAL = new Set(['bloodlust', 'powerInfusion', 'drums']);
const OFF_TRINKETS = ['skull', 'mqg', 'isc'];   // mirrors the engine's shared on-use lockout
const ms = x => Math.round(x * 1000);

// per-cast proc chance at the EFFECTIVE crit — ati-mc's qOf, re-read from TALENTS (never retyped)
const qOf = crit => {
  const f = 0.02 * api.TALENTS.arcaneConcentration;
  const pot = 0.10 * api.TALENTS.arcanePotency;
  return f * Math.min(1, crit + pot) * G.ATI.PROC_CHANCE + (1 - f) * crit * G.ATI.PROC_CHANCE;
};

function cfgOf({ T, lust, sp, crit, haste = 0, t5two = false, kit = [], ati = false }) {
  return {
    T, hasteRating: haste, sp, critPct: crit, coldSnap: true, t5two, warnings: [],
    enabled: Object.fromEntries(ALL_BUFFS.map(k => [k, kit.includes(k) || (ati && k === 'ati') || (lust !== undefined && k === 'bloodlust')])),
    fixed: lust === undefined ? {} : { bloodlust: [lust] },
    segments: null,
  };
}

/* The chain walk. Returns E[Σ dmg·frac] / plainCastOf — the truth expectation in effective casts.
   Refuses (throws) on anything whose engine convention it does not replicate: segments, PI, and
   layouts that are not legal as written (a deferred press breaks prefix firing). */
function chainE(layout, cfg, { atiOn = true } = {}) {
  if (cfg.segments) throw new Error('chainE: segmented fights not implemented');
  const T = ms(cfg.T), DUR = ms(G.ATI.DUR);
  const crit = Math.min(1, Math.max(0, (cfg.critPct || 0) / 100));
  const critF = 1 + crit * (G.CRIT_MULT - 1);
  const t5add = cfg.t5two ? 0.2 : 0;
  const q = (atiOn && !SELFTEST) ? qOf(crit) : atiOn && SELFTEST ? 0 : 0; // self-test: proc branch dead

  const evs = [];
  for (const key in layout) {
    const def = B[key];
    if (!def || def.kind === 'proc' || !layout[key].length) continue;
    const sorted = layout[key].slice().sort((a, b) => a - b);
    for (let j = 0; j < sorted.length; j++) evs.push({ key, def, ts: sorted[j], gap: j > 0 ? sorted[j] - sorted[j - 1] : 0 });
  }
  evs.sort((a, b) => a.ts - b.ts);
  const lastScore = Object.create(null); let lastTrinketScore = null;
  for (const e of evs) {
    let m2 = e.ts;   // the engine's geoStart — pure geometry, so it is path-independent
    if (e.gap && lastScore[e.key] !== undefined) m2 = Math.max(m2, lastScore[e.key] + (e.gap >= e.def.cd - 1e-9 ? e.def.cd : e.def.dur));
    if (lastTrinketScore && lastTrinketScore.key !== e.key && OFF_TRINKETS.includes(e.key)) m2 = Math.max(m2, lastTrinketScore.end);
    if (m2 > e.ts + 1e-9) throw new Error(`chainE: press ${e.key}@${e.ts} deferred by legality — layout not legal as written`);
    if (e.key === 'powerInfusion') throw new Error('chainE: the PI/Bloodlust override is not replicated here');
    e.minStart = ms(m2); e.tsMs = ms(e.ts); e.durMs = ms(e.def.dur);
    lastScore[e.key] = m2;
    if (OFF_TRINKETS.includes(e.key)) lastTrinketScore = { key: e.key, end: m2 + e.def.dur };
  }

  let states = new Map([['0|0|0|', 1]]);
  let acc = 0, k = 0;
  while (states.size) {
    const next = new Map();
    const stacks = Math.min(G.AB.MAX_STACKS, k);
    const prevRamp = k > 0 && (k - 1) < G.AB.MAX_STACKS;
    for (const [skey, p] of states) {
      const parts = skey.split('|');
      const t = +parts[0], rem = +parts[1], pce = +parts[2];
      const auras = parts[3] === '' ? [] : parts[3].split(',');
      while (auras.length < evs.length) {          // fire pending presses at this boundary
        const e = evs[auras.length];
        if (e.tsMs > t) break;
        let aura;
        if (EXTERNAL.has(e.key) || e.ts < 0) aura = e.tsMs;
        else {
          let eff = Math.max(e.minStart, e.tsMs);
          if (prevRamp && e.tsMs < pce) eff = Math.max(e.minStart, pce);
          aura = Math.max(eff, pce);
        }
        auras.push(String(aura));
      }
      let mult = 1, rating = cfg.hasteRating;      // START pass — haste snapshot
      for (let i = 0; i < auras.length; i++) {
        if (auras[i] === 'x') continue;
        const a0 = +auras[i], e = evs[i];
        if (t >= a0 + e.durMs) { auras[i] = 'x'; continue; }
        if (e.def.kind === 'mult') mult *= e.def.value;
        else if (e.def.kind === 'rating') rating += e.def.value;
      }
      const multDn = mult * (1 + rating / RTG);
      const mEff = (atiOn && rem > 0) ? multDn + mult * ATISCALE : multDn;
      const gcd = ms(Math.max(G.GCD_FLOOR, G.GCD_BASE / mEff));
      const cast = ms((G.AB.BASE_CAST - G.AB.STACK_CAST_REDUCTION * stacks) / mEff);
      const interval = Math.max(cast, gcd);
      const tc = t + cast;                         // VALUE pass at completion, (start, end]
      let dmgMult = 1, sp = cfg.sp;
      for (let i = 0; i < auras.length; i++) {
        if (auras[i] === 'x') continue;
        const a0 = +auras[i], e = evs[i];
        if (e.def.kind !== 'dmg' && e.def.kind !== 'sp') continue;
        if (!(tc > a0 && tc <= a0 + e.durMs)) continue;
        if (e.def.kind === 'dmg') dmgMult *= e.def.value; else sp += e.def.value;
      }
      const dmg = (G.AB.AVG_BASE_DMG + G.AB.COEF * sp) * critF * (dmgMult + t5add);
      acc += p * dmg * (cast > 0 ? Math.min(1, (T - t) / cast) : 1);
      const t2 = t + interval;
      if (t2 >= T) continue;
      // once every press has fired, prevCastEnd can never matter again — merge those paths
      const pceKey = auras.length < evs.length ? String(tc) : '0';
      const aKey = auras.join(',');
      if (q > 0) {
        const kp = `${t2}|${DUR - (interval - cast)}|${pceKey}|${aKey}`;
        next.set(kp, (next.get(kp) || 0) + p * q);
      }
      const kn = `${t2}|${Math.max(0, rem - interval)}|${pceKey}|${aKey}`;
      next.set(kn, (next.get(kn) || 0) + p * (1 - q));
    }
    states = next; k++;
    if (k > 4000) throw new Error('chainE: runaway');
  }
  return acc / api.plainCastOf(cfg);
}

const engIdeal = (lay, cfg) => api.simulate(structuredClone(lay), cfg, true).integral / api.plainCastOf(cfg);
const engRobust = (lay, cfg) => api.simulate(structuredClone(lay), cfg, true).robust / api.plainCastOf(cfg);

// ═══ validation battery ═══
let bad = 0;
{
  console.log('# V1 — q=0 arm vs the engine ATI-off walk (mechanics replication)');
  const cell = { T: 120, lust: 20, sp: 1387, crit: 44, t5two: true, kit: ['icyVeins', 'scb', 'arcanePower', 'berserking'] };
  const lays = {
    'iv[60,85] cluster-split': { icyVeins: [60, 85], scb: [50], arcanePower: [50], berserking: [55], bloodlust: [20] },
    'iv[65,90] cluster@25': { icyVeins: [65, 90], scb: [25], arcanePower: [25], berserking: [25], bloodlust: [20] },
  };
  const cfgOff = cfgOf(cell);
  for (const [name, lay] of Object.entries(lays)) {
    const d = chainE(lay, cfgOff, { atiOn: false }) - engRobust(lay, cfgOff);
    const ok = Math.abs(d) < 1e-7; if (!ok) bad++;
    console.log(`  ${ok ? '✓' : '⛔'} ${name.padEnd(26)} Δ ${d.toExponential(2)}`);
  }
  console.log('\n# V2 — bare-ATI arm vs the §12.3a published residuals (engine integral − chain)');
  const rows = [
    { name: 'T=120 h=0 crit 50.765', c: { T: 120, sp: 1000, crit: 50.765, ati: true }, lay: {}, want: 0.0069 },
    { name: 'T=180 h=0 crit 25', c: { T: 180, sp: 1000, crit: 25, ati: true }, lay: {}, want: 0.0044 },
    { name: 'T=120 h=300 crit 40', c: { T: 120, haste: 300, sp: 1000, crit: 40, ati: true }, lay: {}, want: 0.0038 },
    { name: 'T=120 h=600 crit 40', c: { T: 120, haste: 600, sp: 1000, crit: 40, ati: true }, lay: {}, want: -0.0018 },
    { name: 'lust@30 T=120 crit 50.765', c: { T: 120, lust: 30, sp: 1000, crit: 50.765, ati: true }, lay: { bloodlust: [30] }, want: 0.0048 },
  ];
  for (const v of rows) {
    const cfg = cfgOf(v.c);
    const d = engIdeal(v.lay, cfg) - chainE(v.lay, cfg);
    const ok = Math.abs(d - v.want) < 0.003; if (!ok) bad++;
    console.log(`  ${ok ? '✓' : '⛔'} ${v.name.padEnd(28)} ${d >= 0 ? '+' : ''}${d.toFixed(4)} (published ${v.want >= 0 ? '+' : ''}${v.want.toFixed(4)})`);
  }
}
if (SELFTEST) {
  console.log(bad ? '\n✓ SELF-TEST PASSED — the dead proc branch was CAUGHT by the battery.'
                  : '\n⛔ SELF-TEST FAILED — the battery cannot detect a dead proc branch; it asserts nothing.');
  process.exit(bad ? 0 : 1);
}
if (bad) { console.log('\n⛔ VALIDATION FAILED — no verdict below is quotable.'); process.exit(1); }
console.log('\n✓ validated');

// ═══ certification: for each ATI cell, the emission must be truth-co-optimal ═══
if (CELLS) {
  let uncert = 0;
  for (const file of CELLS.split(',')) {
    for (const line of fs.readFileSync(file, 'utf8').split('\n')) {
      if (!line.trim()) continue;
      const c = JSON.parse(line);
      if (!c.ati) continue;
      const kit = (c.kit || '').split(',').filter(Boolean);
      const cfg = cfgOf({ T: c.T, lust: c.lust ?? undefined, sp: c.sp, crit: c.crit, haste: c.haste || 0, t5two: !!c.t5two, kit, ati: true });
      const plain = api.plainCastOf(cfg);
      const tieBand = api.rankPair(structuredClone(c.best), cfg).band / plain;   // TIE_CASTS, imported
      const canon = lay => Object.keys(lay).sort().map(k => `${k}:${lay[k].join('/')}`).join(' ');
      const seen = new Map();
      const addIfLegal = lay => {
        const key = canon(lay);
        if (seen.has(key)) return;
        if (canon(api.repair(structuredClone(lay), cfg)) !== key) return;
        seen.set(key, { lay, ideal: engIdeal(lay, cfg) });
      };
      const bases = [c.best, ...(c.plateauSample || [])];
      for (const lay of bases) addIfLegal(structuredClone(lay));
      const tracks = Object.keys(c.best).filter(k2 => !EXTERNAL.has(k2));
      for (const base of bases) {
        const coords = [];
        for (const k2 of tracks) (base[k2] || []).forEach((_, i) => coords.push({ k: k2, i }));
        for (let a = 0; a < coords.length; a++) for (const da of [-10, -5, 5, 10]) {
          const l1 = structuredClone(base); l1[coords[a].k][coords[a].i] += da;
          if (l1[coords[a].k][coords[a].i] >= 0) addIfLegal(l1);
          for (let b2 = a + 1; b2 < coords.length; b2++) for (const db of [-10, -5, 5, 10]) {
            const l2 = structuredClone(l1); l2[coords[b2].k][coords[b2].i] += db;
            if (l2[coords[a].k][coords[a].i] >= 0 && l2[coords[b2].k][coords[b2].i] >= 0) addIfLegal(l2);
          }
        }
      }
      const ranked = [...seen.values()].sort((x, y) => y.ideal - x.ideal);
      const top = ranked.slice(0, 24);
      for (const r of top) r.chain = chainE(r.lay, cfg);
      const byChain = [...top].sort((x, y) => y.chain - x.chain);
      const emitted = top.find(r => canon(r.lay) === canon(c.best));
      const gap = byChain[0].chain - emitted.chain;
      const ok = gap <= tieBand;
      if (!ok) uncert++;
      console.log(`\n## ${file} · ${canon(c.best)}`);
      console.log(`   engine ideal ${emitted.ideal.toFixed(6)} · chain E ${emitted.chain.toFixed(6)} · truth-top ${byChain[0].chain.toFixed(6)} (${canon(byChain[0].lay)})`);
      console.log(`   truth-gap ${gap.toFixed(6)} vs band ${tieBand} → ${ok
        ? '✓ CERTIFIED — the emission is truth-co-optimal; the engine margin around it is artifact-free to the band'
        : '⛔ NOT CERTIFIED — the emission is a truth-LOSER; the engine margin is artifact. Do not declare this cell.'}`);
      if (!ok) for (const r of byChain.slice(0, 5))
        console.log(`     chain ${r.chain.toFixed(6)}  engineΔ ${(r.ideal - ranked[0].ideal).toFixed(6)}  ${canon(r.lay)}`);
    }
  }
  process.exit(uncert ? 1 : 0);
}
