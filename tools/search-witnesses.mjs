// THE KNOWN-SEARCH-MISS GATE — is each recorded witness still beating the search?
//
//   node tools/search-witnesses.mjs [--json]
//
// Exit: 0 = every witness is now REACHED (the search is at least as good) · 1 = at least one witness
//       still beats the search · 2 = could not grade.
//
// ── WHY A SEPARATE GATE ──────────────────────────────────────────────────────────────────────────
// A search miss is invisible to everything else here. `exact-match` locks in whatever the search
// emits, so a miss silently BECOMES the golden and the suite goes green over it. `self-consistency`
// compares the objective against itself and cannot see the search at all. The only thing that can
// show a better plan exists is a second witness — and `tests/search-witnesses.json` is where those
// are kept so they are not lost between sessions.
//
// ⚠ THIS GATE'S PASS IS DELIBERATELY WEAK, and saying so is the point: a witness going green means
// *this particular plan* is now reached. It is NOT a claim that the search found the optimum at that
// cell — optimality is a much stronger statement and needs enumeration, not a witness. Read a pass as
// "the known hole is closed", never as "the search is correct".
//
// ⚠ It also re-verifies that each witness is still LEGAL under the current engine (a `repair()`
// fixpoint) before comparing. A witness that has become illegal is not a search miss — it is a stale
// witness, and reporting it as a miss would send someone hunting a bug that is not there.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadEngine, cfgFor } from './engine-node.mjs';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const die = m => { console.error('ERROR: ' + m); process.exit(2); };
const JSONOUT = process.argv.includes('--json');

const F = path.join(REPO, 'tests/search-witnesses.json');
let doc; try { doc = JSON.parse(fs.readFileSync(F, 'utf8')); } catch (e) { die(`cannot read ${F}: ${e.message}`); }
const W = doc.witnesses;
if (!Array.isArray(W)) die('search-witnesses.json has no `witnesses` array');
// ★ An empty list must NOT exit 0 quietly. "No known misses" and "the file lost its contents" look
// identical from the outside, and this repo has shipped that exact false pass three times.
if (!W.length) die('the witness list is EMPTY. That is either a repo in perfect shape or a lost file, ' +
  'and this gate cannot tell them apart — so it refuses rather than passing. Delete the gate ' +
  'deliberately if the list is meant to be empty.');

const api = loadEngine(process.env.ENGINE || path.join(REPO, 'index.html'));
const rows = [];
let stillMissing = 0, reached = 0;

for (const w of W) {
  /* ★ RESOLVE FROM `setup` FIRST — a witness is a fact about a FIGHT, not about a row in a table.
     On 2026-07-30 two of three witnesses named presets that had been deleted when GOLDEN_PRESETS
     became the declared-test list, and this gate had been exiting 2 for as long as that was true:
     not passing, not failing, ERRORING, which in practice means nobody was checking search misses at
     all. The `die` below is still right for a witness that names a preset AND has no setup — a
     silently-skipped witness is worse — but the fix is to stop depending on the name. */
  const kase = w.setup ? { name: w.case, ...w.setup } : api.cases.find(c => c.name === w.case);
  if (!kase) die(`witness names preset "${w.case}", which no longer exists, and carries no inline ` +
    '`setup` — add {T, pins, gear?, kit?, phases?} to the witness rather than re-adding the preset.');
  const cfg = cfgFor(api, kase);
  const clone = o => JSON.parse(JSON.stringify(o));
  const rep = s => api.repair(clone(s), cfg);
  /* ⛔ `rankScore`, NOT `simulate().robust`. This read `.robust` — the per-cast SUM — which stopped
     being the ranking quantity on 07-30 (MODEL-DEFECTS §8h; the rate integral ranks). A witness gate
     denominated in the reported number can call a REACHED witness still-missing and vice versa. Same
     defect as §8t found in `plan-sweep`; three instruments carried it, and this was the third. */
  const sc = s => {
    const v = api.rankScore(rep(s), cfg);
    if (!Number.isFinite(v)) die(`non-finite score on "${w.case}"`);
    return v;
  };
  const legal = JSON.stringify(rep(w.schedule)) === JSON.stringify(rep(rep(w.schedule)));
  const best = await api.optimizeAsync(cfg, 14, () => {});
  const emitted = api.rankScore(best.s, cfg);
  const witness = sc(w.schedule);
  const gap = witness - emitted;
  const status = !legal ? 'STALE (witness no longer legal)' : gap > 1e-6 ? 'STILL MISSING' : 'reached';
  if (status === 'STILL MISSING') stillMissing++; else if (status === 'reached') reached++;
  rows.push({ case: w.case, legal, witness, emitted, gap, pct: 100 * gap / emitted, status, emittedPlan: best.s });
}

if (JSONOUT) { console.log(JSON.stringify({ rows, stillMissing, reached }, null, 2)); process.exit(stillMissing ? 1 : 0); }

console.log('# search-witnesses — known better plans vs what the search emits (14 restarts)\n');
console.log('| case | witness | emitted | shortfall | status |');
console.log('|---|---|---|---|---|');
for (const r of rows)
  console.log(`| ${r.case} | ${r.witness.toFixed(1)} | ${r.emitted.toFixed(1)} | ${r.gap > 0 ? '−' + r.gap.toFixed(1) + ` (${r.pct.toFixed(3)}%)` : '—'} | ${r.status} |`);

console.log('');
if (stillMissing) {
  console.log(`‼ ${stillMissing} witness(es) still beat the search. Each is a legal schedule the current`);
  console.log('  scorer ranks higher than what the tool emits. This is SEARCH work, not objective work —');
  console.log('  the objective ranked them correctly, which is how they were found in the first place.');
  process.exit(1);
}
console.log(`✓ all ${reached} witness(es) reached. ⚠ That closes the known holes; it does NOT mean the`);
console.log('  search finds the optimum. Optimality needs enumeration, not witnesses.');
// ⚠ EXPLICIT, and not decoration. The failure path calls `process.exit(1)`; falling off the end here
// left node alive on a pending engine handle, so the PASS path HUNG — a green gate that never
// returns reads as a timeout, i.e. exactly like a failure. It cost a reviewer a 600 s timeout.
process.exit(0);
