// Diff two plan-sweep.mjs outputs at FULL FLOAT PRECISION and print the changed-cell work list.
//
// This is the fast gate. Two questions it answers that exact-match cannot:
//   1. Did ANY press move, including by less than a second? This compares best.s — the schedule
//      the optimizer chose — while exact-match compares the derived FIRE times (presses snapped
//      to cast boundaries, hence fractional and floored to seconds for display). A change the
//      floor absorbs would pass exact-match and fail here. ⚠ Whether such a case exists in this
//      corpus is UNMEASURED: every press time in it is currently an integer (273/273), so the
//      SUB-SEC tag below is a live DETECTOR for that hole, not evidence that it is open.
//   2. WHICH setups changed — so downstream sim work is proportional to the cells a rule
//      actually moved, not to the size of the corpus.
//
// It does NOT answer "is the new plan better" — WITH ONE EXCEPTION, added 07-25 after PHASE9
// §5.15 (three search regressions rode a `changed=0` gate into the tree because nothing here
// graded on ΔScore's SIGN). When the two runs share a scorer — which this tool now PROVES, by
// checking that every cell whose plan is byte-identical scores byte-identically — a changed cell
// whose score went DOWN is a SEARCH REGRESSION by definition, no sim needed: the optimizer
// rejected a layout it had previously found and that its own objective prefers. That single case
// is graded (exit 1, even under --allow-change: that flag means "I expect plans to move", not
// "I accept worse plans").
//
// ⚠ TWO THINGS ABOUT "ITS OWN OBJECTIVE" THAT WERE WRONG UNTIL 07-30, AND BOTH MADE THIS GATE CRY
// WOLF (MODEL-DEFECTS §8t):
//   1. The score it read was `best.val`, which `optimizeAsync` sets to `simulate().robust` — the
//      per-cast SUM. Since §8h the sum is the REPORTED number and the rate INTEGRAL is what ranks.
//      So this gate was grading search changes against a retired objective, and it called three
//      cells regressions when two were improvements of +0.0058 and +0.0392 casts. plan-sweep now
//      records `rankScore`; `robust` rides along as a diagnostic.
//   2. The objective is a PAIR, not a number: inside `TIE_CASTS` the integral is tied and the SHAPE
//      decides (fewest distinct press moments → earliest). A banded move is now reported as
//      `tieBreak`, and only a banded move that ADDS press moments fails.
// Everything else still needs the head-to-head SIM duel of old plan vs
// new plan under ONE harness; a positive ΔScore is still only the model's opinion of itself,
// and if the scorer moved (a repricing) NO delta is attributable to the search. This tool's
// output is that duel's work list.
//
// Usage:  node plan-diff.mjs <A.json> <B.json> [--allow-change]
// Exit:   0 = every plan identical (or changes present with --allow-change, none score-worse
//             under a proven-identical scorer)
//         1 = a plan changed (default: that is a FAILURE — the byte-identical claim is broken),
//             or a SEARCH REGRESSION (scorer pinned + ΔScore<0) — this one fires even with
//             --allow-change
//         2 = could not compare (missing cell, error cell, corpus mismatch)
import fs from 'node:fs';

const [, , AP, BP, ...flags] = process.argv;
const allow = flags.includes('--allow-change');
const die = m => { console.error('DIFF ERROR: ' + m); process.exit(2); };
if (!AP || !BP) die('usage: node plan-diff.mjs <A.json> <B.json> [--allow-change]');

const rd = p => { try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch (e) { die(`cannot read ${p}: ${e.message}`); } };
const A = rd(AP), B = rd(BP);

// Compare BY NAME, not by index: a preset inserted into the middle of the table would otherwise
// silently shift every later comparison and report the whole corpus as changed.
const idx = z => new Map(z.cells.map(c => [c.name, c]));
const [ia, ib] = [idx(A), idx(B)];
const onlyA = [...ia.keys()].filter(k => !ib.has(k)), onlyB = [...ib.keys()].filter(k => !ia.has(k));
const errs = [...A.cells, ...B.cells].filter(c => c.error);

const keys = s => Object.keys(s).filter(k => s[k] && s[k].length).sort();
const norm = s => keys(s).map(k => `${k}:[${s[k].slice().sort((x, y) => x - y).join(',')}]`).join(' ');
const flr = s => keys(s).map(k => `${k}:[${s[k].slice().sort((x, y) => x - y).map(Math.floor).join(',')}]`).join(' ');

// SCORER-IDENTITY proof (PHASE9 §5.15): every cell whose plan is byte-identical must score
// byte-identically — determinism guarantees it when A and B share a scorer. If any does not,
// the runs were scored by different objectives and no ΔScore below is attributable to the
// search. `unscored` counts cells that carry no score at all (an old sweep JSON): identity is
// then proven only on the cells that have one, and the audit says so rather than overclaiming.
const changed = [];
let sameCells = 0, scorerMoved = 0, unscored = 0;
for (const name of ia.keys()) {
  if (!ib.has(name)) continue;
  const a = ia.get(name), b = ib.get(name);
  if (a.error || b.error) continue;                     // counted as errs, not as "same"
  const scored = Number.isFinite(a.score) && Number.isFinite(b.score);
  if (!scored) unscored++;
  const [na, nb] = [norm(a.s), norm(b.s)];
  if (na === nb) {
    sameCells++;
    if (scored && a.score !== b.score) {
      scorerMoved++;
      console.error(`  ⚠ SCORER MOVED at "${name}": identical plan, score ${a.score} → ${b.score}`);
    }
    continue;
  }
  /* ★ THE OBJECTIVE IS A PAIR (MODEL-DEFECTS §8h): the integral, then the shape tie-break (fewest
     distinct press moments → earliest). Grading on the integral ALONE reports every legitimate
     tie-break move as a search regression, which it did on 07-30: Leotheras moved −0.001155 casts —
     inside `TIE_CASTS`, and from 4 distinct press moments to 3, exactly the move the tie-break is
     FOR. The band is carried per cell from the engine's own constant, never retyped here. */
  const band = Math.max(Number.isFinite(a.band) ? a.band : 0, Number.isFinite(b.band) ? b.band : 0);
  changed.push({ name, T: a.T, a: na, b: nb,
                 subsec: flr(a.s) === flr(b.s),         // press moved but not across a second
                 band, banded: Number.isFinite(a.band) && Number.isFinite(b.band),
                 dDistinct: (Number.isFinite(a.distinct) && Number.isFinite(b.distinct)) ? b.distinct - a.distinct : NaN,
                 dScore: scored ? b.score - a.score : NaN });
}

console.log(`plan diff:  A = ${AP}\n            B = ${BP}`);
console.log(`${ia.size} case(s) in A, ${ib.size} in B, ${[...ia.keys()].filter(k => ib.has(k)).length} compared`);
for (const c of changed) {
  const d = Number.isFinite(c.dScore) ? `  Δscore ${c.dScore >= 0 ? '+' : ''}${c.dScore.toFixed(6)}` : '';
  // Deliberately NOT "exact-match cannot see this": the fire-time snap can still carry a
  // sub-second schedule change across a second boundary. This flags it for a human to check.
  console.log(`\n± ${c.name} (T=${c.T})${c.subsec ? '  [SUB-SEC in best.s — may be invisible to exact-match]' : ''}${d}`);
  console.log(`    A: ${c.a}\n    B: ${c.b}`);
}
for (const n of onlyA) console.log(`  (only in A) ${n}`);
for (const n of onlyB) console.log(`  (only in B) ${n}`);
for (const e of errs) console.error(`  ERROR cell "${e.name}": ${String(e.error).split('\n')[0]}`);

const sub = changed.filter(c => c.subsec).length;
console.log(`\nPLAN-DIFF compared=${[...ia.keys()].filter(k => ib.has(k)).length} changed=${changed.length} subSecOnly=${sub} onlyA=${onlyA.length} onlyB=${onlyB.length} errors=${errs.length}`);
if (changed.length) console.log(`DUEL WORK LIST (sim old-vs-new under ONE harness): ${changed.map(c => c.name).join(', ')}`);

// ── the ΔScore sign audit (PHASE9 §5.15 — the rule this gate was missing) ──
// Inside the band the two plans are TIED on the first half of the objective, and the shape decides.
/* ★ §9l — IN-BAND MOVES ARE GRADED BY THE ENGINE'S OWN COMPARATOR, NOT A RE-IMPLEMENTATION.
   The old rule here ("a banded move that ADDS press moments went backwards") hard-coded `distinct`,
   which the §9l comparator REMOVED — so the day the comparator changed, this gate started failing
   the comparator's own legitimate canonicalizations (measured: Leotheras, an EXACT ideal tie at
   Δideal = −1.3e-14 casts, flagged "backwards" for +1 press moment). That is the fourth instrument
   to re-implement the comparator and age out of sync (§8t, §8u, anchors' deltaLine — CLAUDE.md's
   standing instruction exists because of exactly this file). So: load B's engine and ask
   `planBetter` under each cell's own cfg. A banded move the comparator itself prefers is the
   tie-break working; one it does not prefer went backwards. The legacy dDistinct heuristic remains
   ONLY as the fallback for old sweeps whose html predates the comparator export. */
const inBand = c => c.banded && Math.abs(c.dScore) <= c.band;
let graded = null;
try {
  const { loadEngine, cfgFor } = await import('./engine-node.mjs');
  const bHtml = process.argv.find(a => a.startsWith('--engine='))?.split('=')[1] || B.html;
  const api = loadEngine(bHtml);
  if (api.rankPair && api.planBetter && api.repair) {
    graded = new Map();
    for (const c of changed) {
      if (!inBand(c)) continue;
      const row = api.cases.find(x => x.name === c.name);
      if (!row) continue;
      const cfg = cfgFor(api, row);
      const rp = s => api.rankPair(api.repair(JSON.parse(JSON.stringify(s)), cfg), cfg);
      graded.set(c.name, api.planBetter(rp(ib.get(c.name).s), rp(ia.get(c.name).s)));
    }
  }
} catch { /* engine unavailable — legacy heuristic below */ }
const worse = changed.filter(c => c.dScore < 0 && !inBand(c));
const better = changed.filter(c => c.dScore > 0 && !inBand(c));
const tieOk = c => graded && graded.has(c.name) ? graded.get(c.name) : !(c.dDistinct > 0);
const tieBreak = changed.filter(c => inBand(c) && tieOk(c));
const tieBad = changed.filter(c => inBand(c) && !tieOk(c));
const tie = changed.filter(c => c.dScore === 0 && !c.banded);
const ungraded = changed.filter(c => !Number.isFinite(c.dScore));
console.log(`SCORE-AUDIT unchangedCells=${sameCells} scorerMoved=${scorerMoved}${unscored ? ` unscored=${unscored}` : ''} ` +
            `movedCells=${changed.length}${ungraded.length ? ` (${ungraded.length} carry no score)` : ''} ` +
            `→ worse=${worse.length} better=${better.length} tie=${tie.length}` +
            `${tieBreak.length ? ` tieBreak=${tieBreak.length}` : ''}${tieBad.length ? ` tieBreakWORSESHAPE=${tieBad.length}` : ''}`);
for (const c of tieBreak) console.log(`   · "${c.name}" is INSIDE the tie band (Δ ${c.dScore.toFixed(6)}, band ±${c.band.toFixed(6)})` +
                                      `${Number.isFinite(c.dDistinct) ? `, press moments ${c.dDistinct > 0 ? '+' : ''}${c.dDistinct}` : ''} — the shape tie-break, not a score move.`);
for (const c of tieBad) console.error(`  ⚠ "${c.name}" is inside the tie band but B has ${c.dDistinct} MORE press moment(s) — the tie-break went backwards.`);
if (scorerMoved) {
  console.log('⚠⚠ THE SCORER CHANGED between A and B (identical plan(s) scored differently) — a REPRICING.');
  console.log('   No ΔScore above is attributable to the search; the sign split is NOT graded.');
} else if (worse.length && sameCells) {
  console.error(`⚠⚠ SEARCH REGRESSION — ${worse.length} cell(s) where B's plan scores LOWER on B's own objective`);
  console.error('   (scorer identity proven on the unchanged cells). A pure-search change may move a plan only');
  console.error('   to an EQUAL or BETTER score — attribute each cell to its cause before landing.');
} else if (worse.length) {
  console.log(`⚠ ${worse.length} cell(s) scored lower, but ZERO cells are unchanged so scorer identity is UNPROVABLE`);
  console.log('   here — grade these with xval-round-diff or a duel, not on this line.');
}

// Could-not-compare beats every other verdict: an error cell or a corpus mismatch means the
// comparison did not cover what it claims to have covered.
if (errs.length || onlyA.length || onlyB.length) {
  console.error('PLAN-DIFF-INCOMPLETE — the counts above do NOT cover the whole corpus.');
  process.exit(2);
}
if (changed.length && !allow) { console.error('PLAN-DIFF FAIL — plans changed.'); process.exit(1); }
// The one graded case: scorer pinned + a strictly lower score = a defect by definition, and it
// fails even under --allow-change (that flag admits movement, not regression).
if (worse.length && sameCells && !scorerMoved) { console.error('PLAN-DIFF FAIL — search regression.'); process.exit(1); }
if (tieBad.length && !scorerMoved) { console.error('PLAN-DIFF FAIL — tie-break went backwards.'); process.exit(1); }
console.log(changed.length ? 'PLAN-DIFF CHANGED (allowed)' : 'PLAN-DIFF IDENTICAL');
process.exit(0);
