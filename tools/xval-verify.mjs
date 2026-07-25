// Deterministic invariant recompute for the Phase-6/acceptance cross-val matrices — the
// arithmetic half of the adversarial check, as a committed script (restart-proof, unlike an
// LLM agent). Parses every tools/xval-results/*.txt grid and independently verifies:
//   (a) monoDip — every row non-decreasing across sim-haste (invariant A);
//   (b) diagonal dominance — per column, best borrowed plan vs native; worst deficit + ALL
//       borrowed-win columns; cross-checks against each file's reported diagWorst.
// Prints the length-robust (long/xl, non-KT) target set. Run: node tools/xval-verify.mjs [dir]
import fs from 'fs'; import path from 'path';
const dir = process.argv[2] || '/home/user/Kory123/tools/xval-results';
let worstMono = 0, worstMonoAt = '', worstDef = 0, worstDefAt = '', totalBorrowWinCols = 0, nTables = 0, mismatches = [];
const longRobust = [], unparsed = [];
const files = fs.readdirSync(dir).filter(f => f.endsWith('.txt')).sort();
// An empty read is NEVER a pass — with no matrices, both invariants report their happy value off an
// empty set ("= zero, invariant A holds", "worst deficit 0.00%"). Same defect the collector carried
// until 07-25 (DIARY); this instrument is the check on that one, so it must not share the shape.
if (files.length === 0) {
  console.error(`ERROR: no *.txt cross-val matrices in ${dir} — nothing to verify.`);
  process.exit(2);
}
for (const f of files) {
  const txt = fs.readFileSync(path.join(dir, f), 'utf8');
  const lines = txt.split('\n');
  const hdr = lines.findIndex(l => l.startsWith('plan\\sim'));
  // A file with no matrix is a CRASHED table, i.e. an ungraded cell of the acceptance grid — not a
  // file to step over in silence. Recorded and made fatal below.
  if (hdr < 0) { unparsed.push(f); continue; }
  const cols = lines[hdr].trim().split(/\s+/).slice(1).map(Number);
  const M = {};
  for (let i = hdr + 1; i < lines.length; i++) {
    const t = lines[i].trim(); if (!t || !/^\d/.test(t)) break;
    const parts = t.split(/\s+/).map(Number);
    const ph = parts[0]; M[ph] = {};
    cols.forEach((c, k) => { M[ph][c] = parts[1 + k]; });
  }
  const planHastes = Object.keys(M).map(Number);
  nTables++;
  for (const ph of planHastes) for (let k = 1; k < cols.length; k++) {
    const a = M[ph][cols[k - 1]], b = M[ph][cols[k]]; const dip = (a - b) / a;
    if (dip > worstMono) { worstMono = dip; worstMonoAt = `${f} row@${ph}: ${a}->${b}`; }
  }
  let tblWorst = 0, tblWorstAt = '', borrowCols = 0;
  for (const c of cols) {
    if (M[c] == null) continue;
    const native = M[c][c]; let best = native, bestPh = c;
    for (const ph of planHastes) if (M[ph][c] > best) { best = M[ph][c]; bestPh = ph; }
    if (best > native) { borrowCols++; const d = (best - native) / native;
      if (d > tblWorst) { tblWorst = d; tblWorstAt = `@sim${c}: plan@${bestPh}(${best}) > native(${native})`; } }
  }
  totalBorrowWinCols += borrowCols;
  if (tblWorst > worstDef) { worstDef = tblWorst; worstDefAt = `${f} ${tblWorstAt}`; }
  const rep = txt.match(/diagWorst=([\d.]+)%/); const repV = rep ? parseFloat(rep[1]) : null;
  const mine = +(tblWorst * 100).toFixed(2);
  if (repV != null && Math.abs(repV - mine) > 0.02) mismatches.push(`${f}: reported ${repV}% vs recompute ${mine}%`);
  if (/-(long|xl)\.txt$/.test(f) && borrowCols > 0) longRobust.push(`${f}: ${mine}% (${borrowCols} col) ${tblWorstAt}`);
}
console.log(`tables parsed: ${nTables}`);
console.log(`(a) worst monoDip: ${(worstMono*100).toFixed(4)}%  ${worstMono>1e-9?'DIP '+worstMonoAt:'= zero, invariant A holds'}`);
console.log(`(b) worst diagonal deficit: ${(worstDef*100).toFixed(2)}%  [${worstDefAt}]`);
console.log(`(b) total borrowed-plan-wins columns: ${totalBorrowWinCols}`);
console.log(`cross-check vs reported diagWorst: ${mismatches.length? 'MISMATCHES:\n  '+mismatches.join('\n  ') : 'all match'}`);
// ⚠ This list is a HINT, not a persistence test. "Appears in a long or xl table" is not the same
// statement as "this (kit, haste) cell is genuinely mis-adapted" — at the 0.02% scale these margins live
// at, landing on a long fight is a coin flip. The test that grades length-persistence properly is
// tools/xval-persist.mjs (ACCEPTANCE "What the B BANNER can and cannot tell you"); it names 2 columns
// where this list names 11 tables, and they barely overlap. Steer work off THAT one.
console.log(`\nborrowed wins on a long/xl table (non-KT) — a hint about where to look, NOT a persistence`);
console.log(`test; run \`node tools/xval-persist.mjs\` for the graded target list:`);
for (const l of longRobust.sort()) if (!/Kael/.test(l)) console.log('  '+l);

// The verdict, with an exit code — so "run it before believing any ledger" is mechanical rather than
// a reading exercise. 2 = the instrument could not grade (missing/crashed data); 1 = graded, FAILED.
if (unparsed.length) {
  console.error(`\nERROR: ${unparsed.length} file(s) carry no matrix (crashed run?) — the grid is INCOMPLETE ` +
                `and the verdict below would cover fewer cells than it claims:\n  ${unparsed.join('\n  ')}`);
  process.exit(2);
}
if (nTables === 0) { console.error(`\nERROR: 0 matrices parsed — nothing to verify.`); process.exit(2); }
const aFail = worstMono > 5e-4, bFail = totalBorrowWinCols > 0;
console.log(`\nVERDICT over ${nTables} tables: A ${aFail ? 'FAILS' : 'holds'} · B ${bFail ? 'FAILS' : 'holds'}` +
            `  ->  ACCEPTANCE ${aFail || bFail ? 'NOT PASSING' : 'PASSING'}`);
if (aFail || bFail) process.exit(1);
