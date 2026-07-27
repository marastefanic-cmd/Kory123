// DID A CHANGE BREAK THE SEARCH? — score BOTH engines' plans with the SAME (new) scorer.
//
//   node tools/plan-sweep.mjs /path/to/OLD.html /tmp/a.json 3 --max-t=200
//   node tools/plan-sweep.mjs index.html        /tmp/b.json 3 --max-t=200
//   node tools/search-miss.mjs /tmp/a.json /tmp/b.json
//
// Exit: 0 = no plan got worse · 1 = the search REGRESSED somewhere · 2 = could not grade.
//
// ── WHY `plan-diff` CANNOT ANSWER THIS, AND IS RIGHT NOT TO ──────────────────────────────────────
// After a scorer change `plan-diff` prints `⚠⚠ THE SCORER CHANGED between A and B — a REPRICING. No
// ΔScore is attributable to the search; the sign split is NOT graded.` That refusal is correct: A's
// score and B's score are denominated in different currencies, so their difference means nothing.
//
// But there IS a question the repricing does not confound, and it is the one that matters:
//
//     score_new(planB)  ≥  score_new(planA)   ?
//
// Both plans, ONE scorer — the current one. If the new plan wins, the search found the new argmax and
// the timeline moved because the OPTIMUM moved. If the OLD plan wins, a better plan demonstrably
// exists and the search is no longer finding it. That is a search regression, and no amount of
// "the scorer changed" excuses it: the tool is emitting a plan it could have beaten.
//
// ⚠ This is the check that separates "my change re-priced the problem" from "my change broke the
// solver" — the two failure modes a repricing makes look identical in every other instrument.
//
// ── WHAT IT DOES NOT TELL YOU ────────────────────────────────────────────────────────────────────
// A pass means the new plan beats the OLD ONE. It does NOT mean the new plan is optimal — the old
// plan is just one witness. A silent pass on a corpus where nothing moved is also weak evidence, so
// cells whose plan did not change are counted separately and never dressed up as confirmations.
//
// ── PROVENANCE, because a plan from the wrong file is a wasted afternoon ──────────────────────────
// Sweep files record the engine they came from (`html`). Both are printed. If they are the same path
// this refuses to run: comparing an engine against itself is the most reassuring possible non-result.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadEngine, cfgFor } from './engine-node.mjs';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const die = m => { console.error('ERROR: ' + m); process.exit(2); };
const argv = process.argv.slice(2).filter(a => !a.startsWith('--'));
if (argv.length < 2) die('usage: node tools/search-miss.mjs <old-sweep.json> <new-sweep.json>\n' +
  '       (produce each with tools/plan-sweep.mjs against the respective engine)');

const read = f => {
  let j; try { j = JSON.parse(fs.readFileSync(f, 'utf8')); } catch (e) { die(`cannot read ${f}: ${e.message}`); }
  if (!Array.isArray(j.cells) || !j.cells.length) die(`${f} has no cells — is it a plan-sweep output?`);
  return j;
};
const A = read(argv[0]), B = read(argv[1]);
if (A.html === B.html) die(`both sweeps came from the same engine (${A.html}). Comparing an engine ` +
  'against itself cannot detect a regression and would report the most reassuring possible non-result.');

// ★ Scored with the CURRENT working tree, not with either sweep's engine — `ENGINE` overrides.
const api = loadEngine(process.env.ENGINE || path.join(REPO, 'index.html'));
const byName = a => Object.fromEntries(a.map(c => [c.name, c]));
const ma = byName(A.cells), mb = byName(B.cells);

console.log(`# search-miss — both plans scored by ${process.env.ENGINE || 'index.html'} (the current scorer)`);
console.log(`  A (old plans): ${A.html}`);
console.log(`  B (new plans): ${B.html}\n`);
console.log('| case | old plan | new plan | Δ | % | verdict |');
console.log('|---|---|---|---|---|---|');

let regressed = 0, better = 0, tied = 0, unchangedPlan = 0, skipped = 0;
const worst = [];
for (const name of Object.keys(mb)) {
  const kase = api.cases.find(c => c.name === name);
  if (!kase || !ma[name]) { skipped++; continue; }
  if (JSON.stringify(ma[name].s) === JSON.stringify(mb[name].s)) { unchangedPlan++; continue; }
  const cfg = cfgFor(api, kase);
  const sc = s => {
    const r = api.simulate(api.repair(JSON.parse(JSON.stringify(s)), cfg), cfg).robust;
    if (!Number.isFinite(r)) die(`non-finite score on "${name}" — a NaN would compare false everywhere ` +
      'and read as "not a regression". Refusing to grade.');
    return r;
  };
  const o = sc(ma[name].s), n = sc(mb[name].s), d = n - o;
  const v = d < -1e-6 ? '‼ REGRESSION' : d > 1e-6 ? 'better' : 'tie';
  if (d < -1e-6) { regressed++; worst.push({ name, o, n, d, a: ma[name].s, b: mb[name].s }); }
  else if (d > 1e-6) better++; else tied++;
  console.log(`| ${name} | ${o.toFixed(1)} | ${n.toFixed(1)} | ${d >= 0 ? '+' : ''}${d.toFixed(1)} | ${(100 * d / o >= 0 ? '+' : '')}${(100 * d / o).toFixed(3)}% | ${v} |`);
}

console.log(`\n  plans that MOVED: better ${better} · tie ${tied} · REGRESSIONS ${regressed}`);
console.log(`  plans that did not move: ${unchangedPlan}   (not evidence either way)` +
  (skipped ? `   · skipped ${skipped} (absent from one side)` : ''));

if (!regressed) {
  console.log('\n  ✅ No emitted plan is worse than the one the old engine emitted, under the current');
  console.log('     scorer. Where the timeline moved, it moved because the OPTIMUM moved.');
  process.exit(0);
}
console.log('\n‼ THE SEARCH REGRESSED. A demonstrably better plan exists and is no longer emitted:');
for (const w of worst) {
  console.log(`\n  ${w.name}   loses ${(-w.d).toFixed(1)} (${(100 * w.d / w.o).toFixed(3)}%)`);
  console.log(`    better, not found : ${JSON.stringify(w.a)}`);
  console.log(`    emitted           : ${JSON.stringify(w.b)}`);
}
console.log('\n  Each line above is a reproducible witness: a legal schedule the current scorer ranks');
console.log('  higher than the one the search returns. Fix the search, or record it as a known miss —');
console.log('  but do not re-record goldens over it silently.');
process.exit(1);
