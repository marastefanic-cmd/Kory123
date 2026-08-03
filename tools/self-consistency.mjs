// INTERNAL CONSISTENCY — no sim anywhere. THE STANDING SCORER GATE.
//
//   node tools/self-consistency.mjs            # grades the working tree's index.html
//   ENGINE=/path/to/other.html node tools/self-consistency.mjs
//
// Exit: 0 = the model agrees with itself · 1 = it does not · 2 = could not grade.
//
// The model computes the same fight two ways:
//   (1) the DISCRETE cast walk: for each Arcane Blast it already knows haste, stacks (=> cast time),
//       AP on/off, SP buffs, crit -> `casts[i].dmg`, times the BOUNDARY CREDIT that cast earned.
//   (2) the RATE INTEGRAL over breakpoint spans.
// Until 2026-07-27 (2) was `robust` — what ranked every plan — and the two differed by a **median
// 0.2114 % of score, max 1.4263 %** over 2755 plan-scorings, against a corpus whose entire deficit
// range is 0.004–0.380 % and whose ranking margins are ~0.005–0.07 %. The model disagreed with itself
// by ~30x the effect it was being asked to resolve.
//
// ── THE CREDIT RULE (PHASE12 §9, user ruling 07-27) ──────────────────────────────────────────────
// `KILL_WINDOW` and the SYMMETRIC kill taper are RETIRED from the objective. The one uniform rule is:
//
//     credit = min(1, (nextCut - castStart) / castDuration)          ← NO taper, read at the START
//
// a one-sided window whose width is the cast's own duration, applied identically at every cut. A cast
// completing exactly at T earns a FULL cast where the retired taper paid it 0.5.
//
// ── WHAT THIS GRADES, AND WHY IT IS NOT CIRCULAR ─────────────────────────────────────────────────
// `robust` is now the per-cast credited sum, so "robust vs the cast sum" could be made trivially zero
// by construction. It is not, and keeping it that way is the entire value of this file:
//   · `robust` is accumulated INSIDE the board walk on every call (the optimizer scores with
//     `collect` off), and is read here EXACTLY ONCE, as the graded quantity.
//   · the number checked against it is rebuilt from the `casts` array out of `t`, `cast` and `dmg`
//     only, against a cut lattice this file derives from `cfg.segments` ITSELF. ⛔ It deliberately
//     does NOT read the board's `credited` field, and does NOT read its `frac` field either — both
//     are written by the same statement that feeds the accumulator, so summing them would grade the
//     scorer against itself and print 0.00e+0 no matter what broke.
// So a zero says the thing that RANKS and the board the tool SHOWS are the same quantity — the exact
// invariant that was broken, and the exact one a future refactor would break again.
//
// `frac`/`credited` ARE read, but only for the secondary agreement counter below, which is a
// different question (does the board report the credit the walk applied?) and never the verdict.
//
// ── ⚠ TWO THINGS ABOUT THIS FILE CHANGED ON 2026-07-27, AND BOTH WERE DEFECTS IN THE GATE ────────
//
// 1. **The corpus was untracked scratch, so the gate could not run.** It read plans out of
//    `.xval-cache/`, which is `.gitignore`d and keyed on the sha1 of an `index.html`. That means: a
//    clean checkout has no corpus at all, and — worse — **editing `simulate()` changes the hash, so
//    the gate CLAUDE.md says to run after any change to `simulate()` stopped finding its own corpus
//    at exactly the moment it was needed.** Measured: 8993 cache entries present, 0 hits, for every
//    committed revision of `index.html`. A standing gate whose corpus evaporates on the change it is
//    meant to grade is not a standing gate.
//    ⇒ The corpus is now GENERATED, from the presets shipped in `index.html` crossed with a haste
//    ladder and a deterministic schedule family (never-press, mash-on-cooldown, and seeded press
//    sets legalised through `repair`). No search, no cache, no network: a few seconds from a bare
//    clone. Schedules are INPUTS here — the gate gets no truer if they are optimal, only slower.
//
// 2. **The corpus was `segments: null` by construction, so the cut lattice was never graded.** With
//    one cut at `T` the re-derivation is `min(1,(T-start)/cast)` and any bug in the *lattice* — which
//    cut a cast is measured against, whether the walk jumps an intermission wall — is invisible. Two
//    real defects lived in exactly that blind spot until the log audit found them (PHASE13 §2.5): a
//    whole Arcane Blast banked at `frac = 1.0` while completing 1.5 s INSIDE an intermission, worth
//    0.99 % (Lurker) and 1.47 % (Solarian) of fight score. **This gate printed a clean PASS through
//    both.** The corpus now includes every segmented and AoE preset, and the lattice is re-derived
//    here from `cfg.segments` rather than trusted.
//
// The old gap is still printed, from the returned `integral`. ⚠ Read it as "the RETIRED rate integral
// vs the LIVE objective" — it folds in the credit-rule change as well as discrete-vs-continuous, so
// it is no longer the clean 0.2114 % measurement that opened the phase. Diagnostic, never a verdict.
import fs from 'node:fs'; import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadEngine, cfgFor } from './engine-node.mjs';
import { REF, plainCastInPage } from './reference-gear.mjs';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ENGINE = process.env.ENGINE || path.join(REPO, 'index.html');
if (!fs.existsSync(ENGINE)) { console.error(`ERROR: ENGINE=${ENGINE} does not exist.`); process.exit(2); }
const api = loadEngine(ENGINE);
const PLAIN = new Function('GAME', 'R', `return (${plainCastInPage.toString()})(R);`)(api.GAME, REF);
const clone = o => JSON.parse(JSON.stringify(o));
const EPS = 1e-9;   // the engine's own boundary epsilon (index.html, `const EPS`), matched on purpose

// ── THE CUT LATTICE, RE-DERIVED ──────────────────────────────────────────────────────────────────
// Independently of the engine, from the segment list alone. The rule (RULES §9, PHASE13 §1): a cut is
// the START of a segment you would not carry an Arcane Blast across — an intermission (the boss is
// untargetable, so the cast cannot land) or an AoE phase (it lands, but you cancel it to spam Arcane
// Explosion). Adjacent cutting segments merge: only the first of a run is a cut. Far edges are never
// cuts. The fight end is always one.
// ⚠ If this ever drifts into "call the engine's helper", the gate stops being independent and starts
// agreeing with itself. It is 6 lines precisely so re-typing it stays cheaper than importing it.
const cutsOf = cfg => {
  const segs = cfg.segments, out = [];
  const cutting = sg => !!sg && (sg.type === 'intermission' || sg.type === 'aoe');
  if (segs) for (let k = 0; k < segs.length; k++)
    if (cutting(segs[k]) && !cutting(segs[k - 1]) && segs[k].start > EPS) out.push(segs[k].start);
  out.push(cfg.T);
  return out.sort((a, b) => a - b);
};
// The boundary credit, re-derived. `c.t` is the cast's start and `c.cast` its duration, both raw board
// fields. ⚠ An Arcane Explosion is INSTANT (`cast === 0`): its credit is the limit `min(1, ∞) = 1`,
// not zero. A `cast > 0 ? … : 0` guard here credited every AE in a KT AoE phase ZERO and reported a
// 42 % gap that was entirely the tool's — the loudest false alarm this file has produced.
const nextCut = (cuts, t, eps) => { for (const x of cuts) if (x > t + eps) return x; return cuts[cuts.length - 1]; };
const creditOf = (c, cuts) => {
  const cut = nextCut(cuts, c.t, EPS);
  return c.cast > EPS ? Math.min(1, Math.max(0, (cut - c.t) / c.cast)) : 1;
};

// ── ⚠ THE THIRD CHECK, AND WITHOUT IT THIS GATE IS BLIND TO THE BUGS IT MOST NEEDS TO CATCH ──────
// The two checks above ask "does `robust` equal the credit summed over the board?". Both sides read
// the SAME `c.t`, so a defect in *which casts exist* — or in which cut a cast is measured against —
// is invisible to them: the accumulator and the re-derivation make the identical error and agree.
// Measured, on the engine that shipped the PHASE13 §2.5 defects: `robust - creditedCastSum` reads
// **0.00e+0 across all 750 scorings** while a whole Arcane Blast is banked at `frac = 1.0` starting
// 2.8e-14 s before an intermission wall and completing 1.5 s inside it. A clean pass, straight
// through a 1.47 %-of-score bug.
//
// So grade the board STRUCTURALLY too, against the physics rather than against the accumulator, and
// do it at the MILLISECOND — the lattice wowsims actually runs on (`sim/core/cast.go` rounds every
// cast and GCD to `time.Millisecond`). At that resolution a cast starting 2.8e-14 s before a wall IS
// a cast starting at the wall, which is the whole point: the 1e-9 engine epsilon is the right
// tolerance for *agreeing with the transcriber*, and the wrong one for asking a physical question.
const MS = 1e-6;   // a microsecond: three orders below the sim's own lattice, so nothing real hides
function structuralViolations(cfg, casts, cuts) {
  const bad = [];
  const ims = (cfg.segments || []).filter(sg => sg.type === 'intermission');
  for (const c of casts) {
    // I1 — the boss is UNTARGETABLE. No cast may begin inside an intermission, at any tolerance
    // coarser than float noise. This is physics, not accounting.
    for (const im of ims)
      if (c.t > im.start - MS && c.t < im.end - MS)
        bad.push({ kind: 'cast starts inside an intermission', t: c.t, wall: im.start, frac: c.frac });
    // I2 — a cast must be measured against the cut it actually crosses. Recomputing the credit at
    // millisecond resolution must not change it: if it does, the walk stepped over a wall that the
    // 1e-9 lattice let it skip.
    const ref = c.cast > EPS ? Math.min(1, Math.max(0, (nextCut(cuts, c.t, MS) - c.t) / c.cast)) : 1;
    if (Math.abs(ref - creditOf(c, cuts)) > 1e-6)
      bad.push({ kind: 'credit measured against the wrong cut', t: c.t, frac: c.frac, atMs: ref });
  }
  return bad;
}

// ── THE SCHEDULE FAMILY — deterministic, search-free ─────────────────────────────────────────────
// A seeded LCG, not `Math.random`: this repo's determinism rule applies to its tools too, and a gate
// that grades a different corpus on every run cannot be bisected. `repair()` legalises whatever comes
// out (cooldowns, Cold Snap, use caps), so a nonsense press set is still a schedule the engine would
// accept — which is the point: the scorer must agree with itself on plans the search would never emit,
// not only on the polished ones it does.
const lcg = seed => () => (seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
const PRESSABLE = ['icyVeins', 'arcanePower', 'isc', 'scb', 'mqg', 'skull', 'berserking', 'serpent'];
function scheduleFamily(cfg) {
  const out = [{ tag: 'never-press', s: api.repair({}, cfg) },
               { tag: 'mash-on-cd', s: api.repair(clone(api.naiveSchedule(cfg)), cfg) }];
  for (let seed = 1; seed <= 4; seed++) {
    const rnd = lcg(seed * 7919 + Math.round(cfg.T) * 31 + (cfg.hasteRating | 0));
    const s = {};
    for (const k of PRESSABLE) {
      if (!cfg.enabled[k]) continue;
      const n = 1 + Math.floor(rnd() * 3);
      s[k] = Array.from({ length: n }, () => Math.round(rnd() * cfg.T * 10) / 10).sort((a, b) => a - b);
    }
    out.push({ tag: `seeded-${seed}`, s: api.repair(s, cfg) });
  }
  return out;
}

// ── WALL-ON-LATTICE PROBES — the corpus arm that is AIMED at the defect ──────────────────────────
// The shipped presets put their intermission walls wherever the encounter puts them, and whether a
// wall lands within float-noise of a cast boundary is then pure luck. It is not a rare coincidence
// though — it is what happens whenever the wall is a lattice point, which whole-second walls very
// often are — and when it happens the walk's clock arrives a few ulps SHORT (89.999999999999972 for
// a wall at 90), because the clock is a running float sum of millisecond-quantized intervals.
//
// So construct the coincidence instead of waiting for it: walk the fight with no wall, read the cast
// starts off the board, and put a wall at the MILLISECOND each one rounds to. That is the number a
// user would type and the number the sim would use, and the walk will re-derive the same few-ulps-low
// sum when it gets there. Any engine that compares against the wall without an epsilon steps straight
// over it — which is exactly the defect, reproduced on demand rather than hoped for.
function wallProbes(cfg, board) {
  const out = [];
  const n = board.length;
  if (n < 8) return out;
  for (const frac of [0.3, 0.5, 0.72]) {
    const c = board[Math.floor(n * frac)];
    const w = Math.round(c.t * 1000) / 1000;              // the ms lattice point, as a user would enter it
    if (w < 5 || w + 10 > cfg.T - 5) continue;
    out.push({ ...cfg, segments: api.buildSegments(
      [{ from: w, to: w + 10, type: 'intermission', mult: 1, targets: 0 }], cfg.T) });
  }
  return out;
}

// ── THE CORPUS ───────────────────────────────────────────────────────────────────────────────────
// Every preset the page ships (boss encounters AND the abstract debugging presets, so intermissions
// and AoE phases are both in), crossed with a haste ladder, plus the wall-on-lattice probes above.
// Haste is varied because the cast lattice is a function of it: a fixed haste can park every boundary
// comfortably inside a segment and hide a wall bug, which is precisely how the two PHASE13 §2.5
// defects survived — and how this gate reported `0.00e+0` straight through them.
const HASTE_DELTAS = [0, 60, 130, 220, 330];
const gaps = [];
let n = 0, boardFracBad = 0, boardCreditBad = 0, segCases = 0, aoeCases = 0, castsGraded = 0, probeCfgs = 0;
const worst = { pct: -1 };
const struct = [];   // structural violations, with the cell that produced them
for (const kase of api.cases) {
  const base = cfgFor(api, kase);
  if (base.segments) segCases++;
  if ((base.segments || []).some(sg => sg.type === 'aoe')) aoeCases++;
  for (const dh of HASTE_DELTAS) {
    const cfg0 = { ...base, hasteRating: (base.hasteRating || 0) + dh };
    const family = scheduleFamily(cfg0);
    // The shipped cfg, then the same fight with a wall parked on one of its own lattice points,
    // then the shipped cfg with the Ashtongue proc ON — no preset kit carries `ati`, so without this
    // variant the walk's whole proc path (blended intervals, the counterfactual-age window, the
    // dead-time aging across intermissions) would run in ZERO corpus cells and a green here would
    // say nothing about it (added 08-03 with the renewal model).
    const probes = wallProbes(cfg0, api.simulate(clone(family[0].s), cfg0, true).casts);
    probeCfgs += probes.length;
    const cfgAti = { ...cfg0, enabled: { ...cfg0.enabled, ati: true } };
    for (const cfg of [cfg0, ...probes, cfgAti]) {
      const cuts = cutsOf(cfg);
      for (const { s } of family) {
        const r = api.simulate(clone(s), cfg, true);
        const counted = r.casts.reduce((a, x) => a + x.dmg * creditOf(x, cuts), 0);
        for (const x of r.casts) {
          const f = creditOf(x, cuts);
          if (Math.abs((x.frac ?? NaN) - f) > 1e-12) boardFracBad++;
          if (Math.abs((x.credited ?? NaN) - x.dmg * f) > 1e-9) boardCreditBad++;
        }
        castsGraded += r.casts.length;
        const tag = cfg === cfg0 ? kase.name
                  : cfg === cfgAti ? `${kase.name} [ati on]`
                  : `${kase.name} [wall probe @ ${cfg.segments.find(g => g.type === 'intermission').start}]`;
        for (const v of structuralViolations(cfg, r.casts, cuts))
          struct.push({ ...v, name: tag, dh, T: cfg.T });
        const gapPct = 100 * (r.robust - counted) / r.robust;
        if (Math.abs(gapPct) > worst.pct) Object.assign(worst, { pct: Math.abs(gapPct), name: tag, dh, gap: r.robust - counted });
        gaps.push({ gapEff: (r.robust - counted) / PLAIN, gapPct,
                    oldEff: ((r.integral ?? r.robust) - counted) / PLAIN,
                    oldPct: 100 * ((r.integral ?? r.robust) - counted) / r.robust });
        n++;
      }
    }
  }
}
// ⛔ ZERO SCORINGS IS NOT A PASS. "The model agrees with itself" over an empty set is the single most
// reassuring wrong answer this repo knows how to produce, and it has shipped that shape four times
// (xval-collect, xval-verify, the wrapper banners, and this file's own cache lookup).
if (!n) { console.error('ERROR: 0 plan-scorings — the preset table came out empty. Refusing a verdict.'); process.exit(2); }
// A corpus with no segmented fight cannot see a cut-lattice bug, and that blind spot is why this gate
// passed through both PHASE13 §2.5 defects. Refuse rather than report a partial pass as a pass.
if (!segCases || !aoeCases) {
  console.error(`ERROR: corpus has ${segCases} segmented and ${aoeCases} AoE presets — it cannot grade the cut\n` +
                '       lattice, which is the half of the objective that has actually been wrong. Refusing.');
  process.exit(2);
}

const g = gaps.map(x => x.gapEff).sort((a, b) => a - b), p = gaps.map(x => Math.abs(x.gapPct)).sort((a, b) => a - b);
const og = gaps.map(x => x.oldEff).sort((a, b) => a - b), op = gaps.map(x => Math.abs(x.oldPct)).sort((a, b) => a - b);
const med = v => v.length % 2 ? v[(v.length - 1) / 2] : (v[v.length / 2 - 1] + v[v.length / 2]) / 2;
console.log(`INTERNAL CONSISTENCY of the model with itself — ${n} plan-scorings, ${castsGraded} casts, NO SIM`);
console.log(`  engine ${ENGINE}`);
console.log(`  corpus ${api.cases.length} presets (${segCases} segmented, ${aoeCases} with an AoE phase)` +
            ` x ${HASTE_DELTAS.length} haste steps x 6 schedules, + ${probeCfgs} wall-on-lattice probes — generated, no cache\n`);
console.log(`  ★ THE GATE — robust(what RANKS) - creditedCastSum(re-derived from the board):`);
console.log(`     min ${g[0].toExponential(2)}   median ${med(g).toExponential(2)}   max ${g[g.length - 1].toExponential(2)}   (effective ABs)`);
console.log(`     |gap| as a % of score:  median ${med(p).toExponential(2)}%   max ${p[p.length - 1].toExponential(2)}%`);
const PASS = p[p.length - 1] < 1e-9;
if (!PASS) console.log(`     worst cell: "${worst.name}" at haste +${worst.dh}  gap ${worst.gap.toFixed(3)}  (${worst.pct.toFixed(4)} % of score)`);
console.log(`     ${PASS ? '✓ PASS — one objective, to float precision' : '✗ FAIL — the model still disagrees with itself'}\n`);
console.log(`  (secondary) the board REPORTS the credit the walk applied:  frac mismatches ${boardFracBad}   credited mismatches ${boardCreditBad}` +
            `   ${boardFracBad || boardCreditBad ? '✗ the casts board is lying about its own credit' : '✓'}\n`);
// ★ The structural check is a SEPARATE verdict, printed separately, because it answers a separate
// question — "is the board itself physical?" — and the gate above cannot fail when it does.
console.log(`  ★ STRUCTURAL — the board against the physics, at millisecond resolution:  ${struct.length} violation(s)  ${struct.length ? '✗' : '✓'}`);
if (struct.length) {
  const byKind = {};
  for (const v of struct) (byKind[v.kind] = byKind[v.kind] || []).push(v);
  for (const [kind, vs] of Object.entries(byKind)) {
    console.log(`     ${vs.length} x ${kind}`);
    for (const v of vs.slice(0, 4))
      console.log(`        "${v.name}" haste +${v.dh}: cast starts ${v.t.toPrecision(18)}` +
                  (v.wall !== undefined ? ` · wall ${v.wall}` : '') + ` · frac ${v.frac?.toFixed(4)}` +
                  (v.atMs !== undefined ? ` · at ms resolution it would be ${v.atMs.toExponential(2)}` : ''));
    if (vs.length > 4) console.log(`        … and ${vs.length - 4} more`);
  }
}
console.log('');
console.log(`  (diagnostic) the RETIRED rate integral - creditedCastSum. ⚠ NOT the phase's clean 0.2114 %:`);
console.log(`  it now mixes discrete-vs-continuous WITH the retired-taper-vs-boundary-credit change,`);
console.log(`  and this corpus is not the one that measurement was taken on. Order of magnitude only.`);
console.log(`     min ${og[0].toFixed(3)}   median ${med(og).toFixed(3)}   max ${og[og.length - 1].toFixed(3)}   spread ${(og[og.length - 1] - og[0]).toFixed(3)} eff ABs`);
console.log(`     |gap| as a % of score:  median ${med(op).toFixed(4)}%   p90 ${op[Math.floor(0.9 * op.length)].toFixed(4)}%   max ${op[op.length - 1].toFixed(4)}%`);
console.log(`\n  For scale, the cross-val corpus's ENTIRE deficit range is 0.004%-0.380%,`);
console.log(`  and the model's own margins in the deficit columns are ~0.005%-0.07%.`);
// ⚠ The exit code covers the secondary too. A board that misreports its own `frac`/`credited` is
// broken even when the accumulator happens to be right, and printing that while exiting 0 is exactly
// the "loud output, quiet pass" failure this repo keeps catching.
process.exit(PASS && !boardFracBad && !boardCreditBad && !struct.length ? 0 : 1);
