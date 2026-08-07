// BRUTE vs SEARCH — for every brute-forced cell, does the SEARCH actually emit it?
//
//   node tools/brute-vs-search.mjs <cells.jsonl> [more.jsonl ...]
//
// Exit: 0 = the search matches every cell · 1 = at least one MISS · 2 = could not run.
//
// ── WHY ─────────────────────────────────────────────────────────────────────────────────────────
// User, 08-05, on the newly derived kit/haste/Lust cells: *"it's not guaranteed that the search model
// outputs them right now as they are right? so maybe you gotta make those work already even now and
// that would be hugely beneficial."* Exactly so. `lattice-brute` produces GROUND TRUTH by exhaustive
// enumeration; the search is a separate artifact that may or may not reach it. Every disagreement is
// a search defect with a known target — which is the most actionable kind this project can have,
// because the answer is already in hand and only the route to it is missing.
//
// ⛔ Grades on the engine's own `rankPair`/`planBetter`, never a re-implementation (§8t/§8u/§8y — four
// instruments have now re-typed a comparator and all four were wrong), and reports BOTH halves:
//   · an IDEAL-score gap  → a genuine SCORE miss (§8j family): the search never reached a better plan.
//   · an ideal TIE that the comparator still splits → a CANONICALISATION miss (§9p): same value, wrong
//     plateau member, and no hill-climb can feel the difference.
// Those are different defects with different fixes, and collapsing them is how §9p got mistaken for a
// scoring bug in the first place.
import fs from 'node:fs';
import { loadEngine, ALL_BUFFS } from './engine-node.mjs';

const die = m => { console.error('BRUTE-VS-SEARCH ERROR: ' + m); process.exit(2); };
const files = process.argv.slice(2).filter(a => !a.startsWith('--'));
if (!files.length) die('usage: node brute-vs-search.mjs <cells.jsonl> [...]');
const api = loadEngine(new URL('../index.html', import.meta.url).pathname);

const rows = [];
for (const f of files) {
  if (!fs.existsSync(f)) { console.error(`  (skipping missing ${f})`); continue; }
  for (const line of fs.readFileSync(f, 'utf8').split('\n').filter(Boolean)) {
    try { rows.push(JSON.parse(line)); } catch { /* partial write */ }
  }
}
if (!rows.length) die('no cells found');

const norm = s => Object.keys(s).sort().filter(k => (s[k] || []).length)
  .map(k => k + ':' + [...s[k]].sort((a, b) => a - b).join(',')).join('|');

let miss = 0, canon = 0, ok = 0, beaten = 0;
console.log(`# BRUTE vs SEARCH — ${rows.length} cell(s)\n`);
for (const r of rows) {
  const kit = (r.kit || '').split(',').filter(Boolean);
  const cfg = {
    T: r.T, hasteRating: r.haste || 0, sp: r.sp, critPct: r.crit, coldSnap: true, t5two: !!r.t5two,
    warnings: [],
    enabled: Object.fromEntries(ALL_BUFFS.map(k => [k, kit.includes(k) || (r.ati && k === 'ati') || (r.lust !== undefined && r.lust !== null && k === 'bloodlust')])),
    fixed: (r.lust === undefined || r.lust === null) ? {} : { bloodlust: [r.lust] },
    segments: r.interm ? api.buildSegments([{ from: +String(r.interm).split(',')[0], to: +String(r.interm).split(',')[1],
                                              type: 'intermission', mult: 1, targets: 0 }], r.T) : null,
  };
  const PLAIN = api.plainCastOf(cfg);
  const tag = `T=${r.T} lust=${r.lust ?? 'none'} h=${r.haste || 0} sp=${r.sp} ${r.ati ? '+ati ' : ''}${kit.filter(k => !['icyVeins', 'arcanePower', 'berserking'].includes(k)).join('+')}`;
  let emitted;
  try { emitted = (await api.optimizeAsync(cfg, undefined, () => {})).s; }
  catch (e) { console.log(`  ⚠ ${tag}: search threw — ${e.message}`); continue; }
  const pb = api.rankPair(r.best, cfg), pe = api.rankPair(emitted, cfg);
  const d = (pb.ideal - pe.ideal) / PLAIN;
  if (norm(emitted) === norm(r.best)) { ok++; console.log(`  ✓ ${tag}`); continue; }
  /* ⛔⛔ A REAL IDEAL GAP HAS TWO DIRECTIONS AND THEY ARE OPPOSITE FINDINGS — fixed 08-06 after this
     tool printed "brute is +-0.011082 casts better" on a cell where the SEARCH had won. The first
     draft assumed the enumeration is always ≥ the search, which is exactly the assumption
     `lattice-brute`'s own header disclaims: the sweep's winner is the best GRID layout under a
     bounded polish (`--top`, ≤3-coordinate cap), so a continuous search can legitimately beat it —
     measured twice on step-10 cells the same day (+0.011082, +0.028914).
       · search BELOW the enumeration → a SEARCH miss (§8j family): fix the move/seed classes.
       · search ABOVE the enumeration → the ENUMERATION is beaten: the candidate line is NOT the
         argmax and must not be presented for ruling — re-cut the cell at a finer step / wider top.
     Collapsing them mislabels an instrument-coverage problem as an engine defect. */
  if (pe.ideal > pb.ideal + pb.ifloor) {
    beaten++;
    console.log(`  ⛔ ENUMERATION BEATEN  ${tag}   the search is +${(-d).toFixed(6)} casts better — re-cut this cell (finer step / higher --top); do NOT rule on its line`);
    console.log(`       brute   ${JSON.stringify(r.best)}`);
    console.log(`       search  ${JSON.stringify(emitted)}`);
  } else if (pb.ideal > pe.ideal + pb.ifloor) {
    miss++;
    console.log(`  ⛔ SCORE MISS  ${tag}   brute is +${d.toFixed(6)} casts better`);
    console.log(`       brute   ${JSON.stringify(r.best)}`);
    console.log(`       search  ${JSON.stringify(emitted)}`);
  } else if (api.planBetter(pb, pe)) {
    canon++;
    console.log(`  ⚖️ CANONICAL  ${tag}   exact tie, comparator prefers the brute member (§9p)`);
    console.log(`       brute   ${JSON.stringify(r.best)}`);
    console.log(`       search  ${JSON.stringify(emitted)}`);
  } else { ok++; console.log(`  ✓ ${tag}  (different layout, but the search's is at least as good)`); }
}
console.log(`\nBRUTE-VS-SEARCH cells=${rows.length} ok=${ok} scoreMisses=${miss} canonicalMisses=${canon} enumerationBeaten=${beaten}`);
if (beaten) console.log(`⛔ ${beaten} cell(s) where the SEARCH beat the enumeration — those candidate lines are not argmaxes; re-cut them.`);
console.log(miss || canon
  ? `⛔ the search does not reproduce ${miss + canon} brute-forced cell(s) — each is a defect with a KNOWN target.`
  : beaten ? '' : '✓ the search reproduces every brute-forced cell.');
process.exit(miss || canon || beaten ? 1 : 0);
