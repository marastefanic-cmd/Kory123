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
// "I accept worse plans"). Everything else still needs the head-to-head SIM duel of old plan vs
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
  changed.push({ name, T: a.T, a: na, b: nb,
                 subsec: flr(a.s) === flr(b.s),         // press moved but not across a second

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
const worse = changed.filter(c => c.dScore < 0);
const better = changed.filter(c => c.dScore > 0);
const tie = changed.filter(c => c.dScore === 0);
const ungraded = changed.filter(c => !Number.isFinite(c.dScore));
console.log(`SCORE-AUDIT unchangedCells=${sameCells} scorerMoved=${scorerMoved}${unscored ? ` unscored=${unscored}` : ''} ` +
            `movedCells=${changed.length}${ungraded.length ? ` (${ungraded.length} carry no score)` : ''} ` +
            `→ worse=${worse.length} better=${better.length} tie=${tie.length}`);
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
console.log(changed.length ? 'PLAN-DIFF CHANGED (allowed)' : 'PLAN-DIFF IDENTICAL');
process.exit(0);
