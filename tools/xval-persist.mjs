// THE CONSISTENT-ALTERNATIVE TEST — the length-persistence half of invariant B, as a committed
// script (restart-proof, unlike an LLM agent re-deriving it in a heredoc).
//
// WHY THIS EXISTS. `xval-verify.mjs`'s invariant-B banner is an EXISTENCE test: "does ANY rival plan
// beat native in ANY column". Run over a table with ~10 columns × ~9 rivals that is ~90 comparisons,
// and the comparisons are near-ties — the diagonal's own median winning margin is ~0.003%, an order of
// magnitude BELOW the harness's own CRN/10k-iteration resolution (~0.02%, PHASE7 §5.4). An existence
// test over that many coin flips reports DEFICIT for a converged model and a broken one alike, so it
// cannot discriminate (ACCEPTANCE "What the B banner can and cannot tell you").
//
// WHAT THIS TESTS INSTEAD. A genuine haste-ADAPTATION defect at (kit, haste c) has exactly one possible
// shape: ONE specific rival layout is really better there, so it beats native at MOST FIGHT LENGTHS —
// the defect is a property of the (kit, haste) cell, and fight length is not what causes it. So: group
// the five fight-length-class tables of a kit, and for each haste column ask whether any SINGLE rival
// haste out-sims native in at least (nTables − 1) of them. No magnitude threshold, no
// borrower-distance threshold, nothing tuned after seeing the data — the only free choice is "loses at
// most one length", which is what "persistent" means.
//   ★ A post-hoc sieve is NOT this test. A three-filter sieve (persistence ≥4/5 AND borrower ≥2 grid
//   steps AND magnitude ≥0.10%), thresholds picked after looking at round 5, named FOUR columns — and
//   all four FAIL this test, while BOTH columns this test names were REJECTED by the sieve (DIARY,
//   07-25). Thresholds chosen after seeing the data are not evidence.
//
// SCOPE. This is a PRIORITIZER, not a redefinition of the PASS criterion. ACCEPTANCE's bar is
// user-directed and unchanged: ZERO borrowed-win columns, no tolerance band. This script says where a
// real structural defect can be, i.e. what to fix FIRST — a column it clears is still a column whose
// borrowed win must be explained before the model is called complete.
//
// Also prints the three distributions that justify reading the banner this way: the borrowed-win rate
// (pure noise would give ~99.8%, not ~39% — so the diagonal genuinely dominates most columns), the
// native-win margin distribution (how close the "wins" are), and the borrower's grid distance (local
// near-degeneracy vs a distant, structurally different layout).
//
// Run: node tools/xval-persist.mjs [dir]
// Exit: 0 = graded, no persistent alternative · 1 = graded, ≥1 persistent alternative · 2 = could not
// grade. (`xval.mjs` and `xval-round-diff.mjs` deliberately never exit 1 because they GATHER; this one
// GRADES, so it does.)
import fs from 'fs'; import path from 'path';

const dir = process.argv[2] || '/home/user/Kory123/tools/xval-results';
const CLASSES = ['short', 'medium', 'medlong', 'long', 'xl'];

const files = fs.existsSync(dir) ? fs.readdirSync(dir).filter(f => f.endsWith('.txt')).sort() : [];
if (files.length === 0) {
  console.error(`ERROR: no *.txt cross-val matrices in ${dir} — nothing to grade.`);
  process.exit(2);
}

// ---- parse -----------------------------------------------------------------------------------
const tables = [], unparsed = [];
for (const f of files) {
  const lines = fs.readFileSync(path.join(dir, f), 'utf8').split('\n');
  const hdr = lines.findIndex(l => l.startsWith('plan\\sim'));
  if (hdr < 0) { unparsed.push(f); continue; }   // a crashed table is an UNGRADED cell, never a skip
  const cols = lines[hdr].trim().split(/\s+/).slice(1).map(Number);
  const M = {};
  for (let i = hdr + 1; i < lines.length; i++) {
    const t = lines[i].trim(); if (!t || !/^\d/.test(t)) break;
    const p = t.split(/\s+/).map(Number);
    M[p[0]] = {}; cols.forEach((c, k) => { M[p[0]][c] = p[1 + k]; });
  }
  const spec = {};
  for (const l of lines.slice(0, hdr)) {
    const m = l.match(/^\s*plan@h(\d+):\s+eff=[\d.]+\s+(\{.*\})\s*$/);
    if (m) spec[+m[1]] = m[2];
  }
  const base = f.replace(/\.txt$/, '');
  const cm = base.match(new RegExp(`^(.*)-(${CLASSES.join('|')})$`));
  tables.push({ file: f, M, cols, spec, family: cm ? cm[1] : null, cls: cm ? cm[2] : null });
}
if (unparsed.length) {
  console.error(`ERROR: ${unparsed.length} file(s) carry no matrix (crashed run?) — the grid is ` +
                `INCOMPLETE and any grade would cover fewer cells than it claims:\n  ${unparsed.join('\n  ')}`);
  process.exit(2);
}

// ---- per-column: native vs the best rival ----------------------------------------------------
const borrowed = [], nativeWins = [];
for (const t of tables) for (const c of t.cols) {
  if (t.M[c] == null) continue;
  const native = t.M[c][c]; if (!isFinite(native) || native <= 0) continue;
  let best = -Infinity, bestPh = null;
  for (const ph of Object.keys(t.M).map(Number)) if (ph !== c && isFinite(t.M[ph][c]) && t.M[ph][c] > best) { best = t.M[ph][c]; bestPh = ph; }
  if (bestPh == null) continue;
  const dist = Math.abs(t.cols.indexOf(bestPh) - t.cols.indexOf(c));
  const same = t.spec[bestPh] != null && t.spec[bestPh] === t.spec[c];
  const rec = { file: t.file, c, bestPh, dist, same, mag: Math.abs(best - native) / native * 100 };
  (best > native ? borrowed : nativeWins).push(rec);
}
const total = borrowed.length + nativeWins.length;
const stat = a => {
  const s = a.slice().sort((x, y) => x - y), n = s.length;
  if (!n) return null;
  const q = p => s[Math.min(n - 1, Math.floor(p * (n - 1)))];
  return { n, med: n % 2 ? s[(n - 1) / 2] : (s[n / 2 - 1] + s[n / 2]) / 2,
           mean: s.reduce((x, y) => x + y, 0) / n, p90: q(0.9), max: s[n - 1] };
};
const bs = stat(borrowed.map(r => r.mag)), ns = stat(nativeWins.map(r => r.mag));
const pc = (k, d) => `${(k / d * 100).toFixed(1)}%`;
console.log(`tables parsed: ${tables.length}   columns: ${total}`);
console.log(`\nBORROWED-WIN RATE: ${borrowed.length}/${total} = ${pc(borrowed.length, total)}`);
console.log(`  (if every true delta were 0, max-of-k rivals beats native ~1-2^-k of the time ≈ 99.8% —`);
console.log(`   so the diagonal is genuinely dominant in the majority of columns, not coin-flipping.)`);
if (bs) console.log(`  borrowed margin %: median ${bs.med.toFixed(3)} mean ${bs.mean.toFixed(3)} p90 ${bs.p90.toFixed(3)} max ${bs.max.toFixed(3)}` +
  `  |  <=0.02%: ${pc(borrowed.filter(r => r.mag <= 0.02).length, borrowed.length)}  <=0.10%: ${pc(borrowed.filter(r => r.mag <= 0.10).length, borrowed.length)}`);
if (ns) console.log(`  NATIVE margin %:   median ${ns.med.toFixed(3)} mean ${ns.mean.toFixed(3)} p90 ${ns.p90.toFixed(3)} max ${ns.max.toFixed(3)}` +
  `  <- the diagonal's own wins are near-ties too (CRN resolution ~0.02%)`);
if (borrowed.length) {
  const adj = borrowed.filter(r => r.dist === 1).length, near = borrowed.filter(r => r.dist <= 2).length;
  console.log(`  borrower distance: byte-identical plan ${borrowed.filter(r => r.same).length}` +
              `  ·  adjacent haste ${adj} (${pc(adj, borrowed.length)})  ·  <=2 grid steps ${near} (${pc(near, borrowed.length)})` +
              `  ·  >=5 steps ${borrowed.filter(r => r.dist >= 5).length}`);
}

// ---- the test: a CONSISTENT better rival across fight lengths ---------------------------------
const fams = new Map();
for (const t of tables) if (t.family) { if (!fams.has(t.family)) fams.set(t.family, []); fams.get(t.family).push(t); }
const hist = new Map(), hits = [];
let kitCols = 0;
for (const [fam, ts] of [...fams].sort()) {
  const hastes = [...new Set(ts.flatMap(t => t.cols))].sort((a, b) => a - b);
  for (const c of hastes) {
    const inTbl = ts.filter(t => t.M[c] != null && t.cols.includes(c));
    if (inTbl.length < 2) continue;                     // persistence is undefined on one length
    kitCols++;
    let bestWins = 0, bestRival = null, bestMags = null;
    for (const ph of hastes) {
      if (ph === c) continue;
      const mags = [];
      for (const t of inTbl) if (t.M[ph] && t.M[ph][c] > t.M[c][c]) mags.push((t.M[ph][c] - t.M[c][c]) / t.M[c][c] * 100);
      if (mags.length > bestWins) { bestWins = mags.length; bestRival = ph; bestMags = mags; }
    }
    hist.set(bestWins, (hist.get(bestWins) || 0) + 1);
    // PERSISTENT = the same rival wins at all but at most ONE fight length.
    if (bestWins >= inTbl.length - 1 && bestWins >= 2)
      hits.push({ fam, c, rival: bestRival, wins: bestWins, of: inTbl.length, mags: bestMags });
  }
}
console.log(`\nCONSISTENT-ALTERNATIVE TEST over ${kitCols} kit-columns (${fams.size} kit families ×` +
            ` their haste grids; boss tables are one length each and are excluded)`);
const maxW = Math.max(0, ...[...hist.keys()]);
for (let w = maxW; w >= 0; w--) if (hist.has(w))
  console.log(`   best rival wins ${w} of the lengths : ${String(hist.get(w)).padStart(3)} columns` +
              `${w >= 2 && hits.some(h => h.wins === w) ? ' ★' : ''}`);
console.log(`\nCOLUMNS WITH A CONSISTENT (loses <=1 length) BETTER RIVAL: ${hits.length}`);
for (const h of hits.sort((a, b) => b.wins - a.wins || a.fam.localeCompare(b.fam)))
  console.log(`   ${h.fam} h${h.c}  <- rival plan@h${h.rival}  wins ${h.wins}/${h.of}` +
              `  margins% [${h.mags.map(m => m.toFixed(3)).join(', ')}]`);
if (!hits.length) console.log(`   (none — no (kit, haste) cell has a single layout that is better at most lengths)`);
console.log(`\nNOTE: clearing this test does NOT clear invariant B. ACCEPTANCE's bar is zero borrowed-win`);
console.log(`columns; this test only says which ones can be a STRUCTURAL adaptation defect.`);

process.exit(hits.length ? 1 : 0);
