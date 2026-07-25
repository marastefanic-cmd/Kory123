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
// It does NOT answer "is the new plan better". A model score delta is the model's own opinion,
// and the model is the thing under test; a changed cell needs a head-to-head SIM duel of old
// plan vs new plan under ONE harness. This tool's output is that duel's work list.
//
// Usage:  node plan-diff.mjs <A.json> <B.json> [--allow-change]
// Exit:   0 = every plan identical (or changes present with --allow-change)
//         1 = a plan changed (default: that is a FAILURE — the byte-identical claim is broken)
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

const changed = [];
for (const name of ia.keys()) {
  if (!ib.has(name)) continue;
  const a = ia.get(name), b = ib.get(name);
  if (a.error || b.error) continue;                     // counted as errs, not as "same"
  const [na, nb] = [norm(a.s), norm(b.s)];
  if (na === nb) continue;
  changed.push({ name, T: a.T, a: na, b: nb,
                 subsec: flr(a.s) === flr(b.s),         // press moved but not across a second

                 dScore: (b.score ?? NaN) - (a.score ?? NaN) });
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

// Could-not-compare beats every other verdict: an error cell or a corpus mismatch means the
// comparison did not cover what it claims to have covered.
if (errs.length || onlyA.length || onlyB.length) {
  console.error('PLAN-DIFF-INCOMPLETE — the counts above do NOT cover the whole corpus.');
  process.exit(2);
}
if (changed.length && !allow) { console.error('PLAN-DIFF FAIL — plans changed.'); process.exit(1); }
console.log(changed.length ? 'PLAN-DIFF CHANGED (allowed)' : 'PLAN-DIFF IDENTICAL');
process.exit(0);
