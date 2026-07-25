// Compare two cross-val ROUNDS table-by-table.
//
//   node tools/xval-round-diff.mjs <dirA> <dirB> [--full]
//   e.g. node tools/xval-round-diff.mjs tools/xval-results-archive/phase7-round4 tools/xval-results
//
// tools/xval-results/README.md has always said that "comparing a round table-by-table against its
// predecessor is what let Phase 7 §5.13 prove B2 unchanged by the §5.11 tie-break at zero measurement
// cost", and that "two rounds can agree on a headline while disagreeing about every plan underneath".
// That comparison was being done BY HAND, one `diff` at a time, which is why the archive's whole
// purpose kept getting spent on spot-checks of two or three tables.  This is that comparison as an
// instrument.
//
// What it reports per table: how many (haste → plan) cells changed and which, the eff LEVEL shift
// (min/max %), and both invariants side by side (monoDip, diag CLEAN/DEFICIT, diagWorst).
//
// ★ HOW TO READ THE eff COLUMN — it separates the two ways a round can differ, and they need
// completely different follow-up:
//
//   plans move, eff ≈ +0.000%      →  a TIE-BREAK.  The score is unchanged and the search merely
//                                     chose differently among equals.  Confirmed on the real pair:
//                                     round3→round4 (the §5.11 legibility canonicalization) is
//                                     10/345 cells changed at eff ±0.001% — which is also what
//                                     PHASE7 §5.13 concluded by hand, so it is a live check that
//                                     this tool and that claim agree.
//   plans move, eff shifts by a     →  a REPRICING.  Every cell moves together because the SCORER
//   consistent band                    changed, and the plan changes are downstream of it.
//                                     Round4→round5 (the reference-gear correction) is this shape:
//                                     a −0.4…−1.1% band on every cell, with a minority of plans
//                                     flipping.
//
// The distinction matters because a tie-break needs no re-verification (the number it optimizes is
// unchanged) while a repricing invalidates every ranking gathered under the old scorer.
//
// ★ A ROUND DIFF IS AN OBSERVATION, NOT A GRADE.  Exit codes follow the project contract:
//   0 = compared cleanly · 2 = COULD NOT compare.  Exit 1 is unused on purpose — "12 plans changed"
// is data for a human, and no threshold here decides whether the model got better.  Only the sim
// columns can say that, and this tool does not touch them.
//
// ★ THE FALSE-PASS SHAPE THIS TOOL HAS.  Its headline is an ABSENCE ("0 plans changed"), which is
// exactly what a misread directory, a filename convention drift, or an unparseable table also
// produces.  So: zero overlapping tables is exit 2, never "identical"; a table that yields zero plan
// specs is an ERROR for that table, never a table with nothing changed; and every skipped/unmatched
// file is printed by name.  An empty comparison must be impossible to mistake for a clean one.
import fs from 'fs';
import path from 'path';

const args = process.argv.slice(2);
const FULL = args.includes('--full');
const dirs = args.filter(a => !a.startsWith('--'));
if (dirs.length !== 2) {
  console.error('ERROR: usage: node tools/xval-round-diff.mjs <dirA> <dirB> [--full]');
  console.error('  dirA = the OLDER round (e.g. tools/xval-results-archive/phase7-round4)');
  console.error('  dirB = the NEWER round (e.g. tools/xval-results)');
  process.exit(2);
}
const [DA, DB] = dirs;
for (const d of [DA, DB]) {
  if (!fs.existsSync(d) || !fs.statSync(d).isDirectory()) {
    console.error(`ERROR: not a directory: ${d}`); process.exit(2);
  }
}

// ── parse one table (the same shape xval-collect.mjs reads) ──────────────────────────────────────
function parse(file) {
  const txt = fs.readFileSync(file, 'utf8');
  const done = txt.match(/^XVAL-DONE .*/m);
  if (!done) return { err: 'no XVAL-DONE (crashed, or still being written)' };
  const kv = Object.fromEntries([...done[0].matchAll(/(\w+)=(\S+)/g)].map(x => [x[1], x[2]]));
  const specs = {};
  for (const m of txt.matchAll(/plan@h(\d+): eff=([\d.]+)\s+(\{.*\})/g)) {
    let spec; try { spec = JSON.parse(m[3]); } catch { return { err: `unparseable plan spec at h${m[1]}` }; }
    specs[+m[1]] = { eff: +m[2], spec };
  }
  // A table with a XVAL-DONE line but no plan specs is a MISREAD, not a table whose plans all match.
  if (!Object.keys(specs).length) return { err: 'XVAL-DONE present but zero plan specs parsed' };
  return { kv, specs };
}

// Canonical text for a plan spec, so key order can never masquerade as a plan change.  (The specs
// come from one emitter so the order is stable in practice — but "in practice" is how a diff tool
// starts reporting churn nobody made.)
const canon = s => JSON.stringify(Object.keys(s).sort().map(k => [k, s[k]]));

const listing = d => new Set(fs.readdirSync(d).filter(f => f.endsWith('.txt')));
const A = listing(DA), B = listing(DB);
const both = [...A].filter(f => B.has(f)).sort();
const onlyA = [...A].filter(f => !B.has(f)).sort();
const onlyB = [...B].filter(f => !A.has(f)).sort();

if (!both.length) {
  console.error(`ERROR: no table filename appears in BOTH directories — nothing to compare.`);
  console.error(`  ${DA}: ${A.size} tables · ${DB}: ${B.size} tables`);
  console.error(`  (zero overlap is a MISREAD — a renamed convention or a wrong path — not "no changes".)`);
  process.exit(2);
}

console.log(`round diff:  A = ${DA}\n             B = ${DB}`);
console.log(`${both.length} table(s) in both${onlyA.length ? `, ${onlyA.length} only in A` : ''}${onlyB.length ? `, ${onlyB.length} only in B` : ''}\n`);

let nErr = 0, nTablesChanged = 0, nCells = 0, nCellsChanged = 0;
let defA = 0, defB = 0;
const flips = [], changedTables = [];

for (const f of both) {
  const a = parse(path.join(DA, f)), b = parse(path.join(DB, f));
  if (a.err || b.err) {
    console.log(`✗ ${f}\n    A: ${a.err || 'ok'}\n    B: ${b.err || 'ok'}`);
    nErr++; continue;
  }
  // Compare on the hastes BOTH rounds planned. A haste set that changed between rounds is itself
  // worth saying out loud — silently intersecting would hide a protocol change.
  const ha = Object.keys(a.specs).map(Number).sort((x, y) => x - y);
  const hb = Object.keys(b.specs).map(Number).sort((x, y) => x - y);
  const sameSet = ha.length === hb.length && ha.every((h, i) => h === hb[i]);
  const H = ha.filter(h => h in b.specs);

  const changed = H.filter(h => canon(a.specs[h].spec) !== canon(b.specs[h].spec));
  const dEff = H.map(h => (b.specs[h].eff - a.specs[h].eff) / a.specs[h].eff * 100);
  const lo = Math.min(...dEff), hi = Math.max(...dEff);

  nCells += H.length; nCellsChanged += changed.length;
  if (changed.length) { nTablesChanged++; changedTables.push(f); }
  if (a.kv.diag === 'DEFICIT') defA++;
  if (b.kv.diag === 'DEFICIT') defB++;
  if (a.kv.diag !== b.kv.diag) flips.push(`${f}: ${a.kv.diag} → ${b.kv.diag}`);

  const mark = changed.length ? '±' : '=';
  const inv = `diag ${a.kv.diag}/${a.kv.diagWorst} → ${b.kv.diag}/${b.kv.diagWorst}   monoDip ${a.kv.monoDip} → ${b.kv.monoDip}`;
  console.log(`${mark} ${f.replace(/\.txt$/, '').padEnd(28)} plans ${String(changed.length).padStart(2)}/${String(H.length).padEnd(2)} changed   eff ${lo >= 0 ? '+' : ''}${lo.toFixed(3)}%..${hi >= 0 ? '+' : ''}${hi.toFixed(3)}%   ${inv}`);
  if (!sameSet) console.log(`    ⚠ haste sets differ: A=[${ha}] B=[${hb}] — compared on the ${H.length} shared point(s)`);
  if (changed.length) console.log(`    changed @h: ${changed.join(', ')}`);
  if (FULL) for (const h of changed) {
    console.log(`      h${h}  A eff=${a.specs[h].eff}  ${JSON.stringify(a.specs[h].spec)}`);
    console.log(`      h${h}  B eff=${b.specs[h].eff}  ${JSON.stringify(b.specs[h].spec)}`);
  }
}

for (const f of onlyA) console.log(`  (only in A, not compared) ${f}`);
for (const f of onlyB) console.log(`  (only in B, not compared) ${f}`);

console.log(`\nROUND-DIFF tables=${both.length} compared=${both.length - nErr} errored=${nErr} ` +
            `tablesWithPlanChange=${nTablesChanged} planCells=${nCellsChanged}/${nCells} ` +
            `deficitTables=${defA}→${defB}`);
if (flips.length) { console.log('verdict flips:'); for (const x of flips) console.log(`  ${x}`); }
else console.log('verdict flips: none');
if (changedTables.length) console.log(`tables with ≥1 plan change: ${changedTables.map(f => f.replace(/\.txt$/, '')).join(', ')}`);

// Errored tables mean the comparison is INCOMPLETE, and an incomplete comparison whose headline is
// "nothing changed" is the false-pass shape this tool is built to avoid.  Refuse to be read as clean.
if (nErr) {
  console.log(`\nROUND-DIFF-INCOMPLETE — ${nErr} table(s) could not be parsed; the counts above are PARTIAL.`);
  process.exit(2);
}
process.exit(0);
