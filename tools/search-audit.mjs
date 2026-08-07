// IS THE EMITTED PLAN EVEN A LOCAL OPTIMUM? — enumerate the neighbourhood and say so.
//
//   node tools/plan-sweep.mjs index.html /tmp/b.json 3      # solve every preset (this is the slow part)
//   node tools/search-audit.mjs /tmp/b.json                 # ~seconds: audit them all
//   node tools/search-audit.mjs /tmp/b.json --k=3 --span=4  # deeper (slower, still no re-solve)
//
// Exit: 0 = every plan is a k-coordinate local optimum · 1 = at least one is not · 2 = could not grade.
//
// ── WHY THIS EXISTS, AND WHY IT IS STRONGER THAN ANYTHING ELSE HERE ──────────────────────────────
// The three defects that produced wrong plans in this project's worst week were ALL search misses —
// `docs/MODEL-DEFECTS.md` §8j, §8m, §8s — and every one was invisible to every gate the repo owned:
//   · `tests/anchors.mjs` covers 8 declared cells. §8s was found because the USER read two plans.
//   · `tools/self-consistency.mjs` compares the objective against itself; it cannot see the search.
//   · `tools/law-check.mjs` asserts the SCORER against the algebra; on all three it stayed green,
//     correctly — the scorer was right and the descent simply never visited the answer.
//   · the deleted `exact-match` LOCKED IN whatever the search emitted, so a miss became the golden.
//   · `tools/search-witnesses.mjs` needs someone to have already found a better plan by hand.
// This one needs nothing found in advance. It takes the plan the tool actually emits and asks the
// objective directly: **is there a small simultaneous move that beats it?**
//
// ── WHY `k` MATTERS MORE THAN `span`, AND THIS IS THE WHOLE LESSON OF §8m/§8s ─────────────────────
// Both defects were points where EVERY single-coordinate move and EVERY pair was downhill, and only
// a 3-coordinate move escaped. On the 2:00 · Lust 0:05 cell:
//     improving 1-coordinate moves: 0    improving 2-coordinate moves: 0    improving 3-coordinate: 6
// A k=1 audit is nearly free and would have called that plan optimal. ⇒ **k=2 is the floor for this
// gate to mean anything, and k=3 is what actually catches the class of defect this repo keeps
// producing.** The cost is `C(n,k)·span^k` scorings, which for a typical n≈6, k=3, span=6 is ~4.9k
// probes — well under a second, because the expensive part (solving) already happened in the sweep.
//
// ⚠ A PASS IS NOT OPTIMALITY. It says no move of ≤k coordinates by ≤span seconds beats this plan.
// The declared Berserking on T2 sits +120 s from where the descent put it (§8j) — no bounded
// neighbourhood of any k finds that. Global optimality is deliberately not claimed: the constructive
// enumeration was revoked as a build 08-04 (ROADMAP §4); `tools/brute-cell.mjs`'s complete
// anchor-and-chain family scan is the wider standing instrument, and this gate is the regression net.
//
// ⚠ PINNED RAID CALLS ARE EXCLUDED from the coordinate set. They are not the planner's to move, and
// `repair` would put them back — a candidate that gets relegalized is scored as one layout and would
// be reported as another, which is the exact failure `phaseRerank`'s `intact()` guard exists to stop.
import fs from 'node:fs';
import { loadEngine, cfgFor } from './engine-node.mjs';

const die = m => { console.error('AUDIT ERROR: ' + m); process.exit(2); };
const args = process.argv.slice(2);
const SWEEP = args.find(a => !a.startsWith('--'));
const numArg = (name, dflt) => { const a = args.find(x => x.startsWith(`--${name}=`)); return a ? +a.split('=')[1] : dflt; };
if (!SWEEP) die('usage: node search-audit.mjs <sweep.json> [--k=3] [--span=3] [--json]');

const K = numArg('k', 3);            // how many coordinates may move AT ONCE
const SPAN = numArg('span', 3);      // by up to how many seconds, each way
const JSONOUT = args.includes('--json');
/* ⚠ NEGATIVE CONTROL — `--self-test` DISPLACES each emitted plan and REQUIRES the audit to catch it.
   PHASE11's standing rule: every gate needs a deliberately-broken input that must fail before its green
   is believed, and this repo has shipped two gates whose failure mode was a PASS (B7, B8).
   The break here is the real one: nudge a press off the plan the search chose. Because the emitted
   plan is (claimed to be) a local optimum, the move BACK must be visible from the displaced point — so
   a displaced plan that audits clean means this gate's neighbourhood is decoration.
   ★ It picks, per cell, the smallest single-coordinate nudge the ENGINE'S OWN comparator says is
   strictly worse, so it can never seed a move that is merely a tie — the exact false positive that
   made this gate report T1 as a miss before it graded on the pair. A cell with no such nudge (a plan
   sitting on a wide plateau) is reported as UNPERTURBABLE rather than silently counted as a pass.
   Inverts its exit contract, like `law-check --self-test`. */
const SELFTEST = args.includes('--self-test');
if (K < 1 || K > 4) die('--k must be 1..4 (k>=2 is the floor for this gate to mean anything; see header)');

let sweep;
try { sweep = JSON.parse(fs.readFileSync(SWEEP, 'utf8')); } catch (e) { die(`cannot read ${SWEEP}: ${e.message}`); }
if (!sweep.cells || !sweep.cells.length) die(`${SWEEP} has no cells`);

const api = loadEngine(new URL('../index.html', import.meta.url).pathname);
const DELTAS = []; for (let d = -SPAN; d <= SPAN; d++) if (d) DELTAS.push(d);

const rows = [];
const seedNotes = [];
let bad = 0, scoreBad = 0, graded = 0, skipped = 0;

for (const cell of sweep.cells) {
  if (cell.error || !cell.s) { skipped++; continue; }
  /* ★ A CELL MAY CARRY ITS OWN `setup` — prefer it. `tools/kit-sweep.mjs` emits cells for gear the
     preset table does not contain at all, and the same lesson applies as to `search-witnesses.json`:
     a cell is a fact about a FIGHT, not a row in a table. A name-keyed cell is one preset rename from
     void, which is exactly how the witness gate spent days exiting 2 instead of checking anything. */
  const kase = cell.setup ? { name: cell.name, ...cell.setup } : api.cases.find(c => c.name === cell.name);
  if (!kase) { skipped++; console.error(`  ⚠ skipping "${cell.name}" — not in the current fight table and no inline setup`); continue; }
  const cfg = cfgFor(api, kase);
  const clone = o => JSON.parse(JSON.stringify(o));
  const rep = s => api.repair(clone(s), cfg);

  /* ⚠⚠ GRADE ON THE OBJECTIVE PAIR, NOT ON THE SCORE. This is the third instrument in this repo to
     get that wrong and the mistake is always the same shape (§8t): `rankScore` alone is HALF the
     objective — inside `TIE_CASTS` the integral is tied and the SHAPE decides (fewest distinct press
     moments → earliest → the flattened press vector). Grading on the score alone, this gate reported
     T1 — a DECLARED TEST, and the argmax — as a search miss "beaten by +0.000347 casts", which is 5.8×
     INSIDE the band, by a layout that shifts every press +3 s and is strictly worse on `earliest`.
     ⇒ use the engine's own `rankPair`/`planBetter`, the same comparator `phaseRerank` adopts with. A
     candidate only counts as a miss if the OPTIMIZER would have taken it. */
  if (!api.rankPair || !api.planBetter) die('this index.html predates rankPair/planBetter — the audit ' +
    'would have to re-implement the comparator, and a re-implemented comparator is the copies-drift defect.');
  const pairOf = s => api.rankPair(rep(s), cfg);

  // Coordinates = every planner-controlled press. Pinned raid calls are not the planner's to move.
  const coordsOf = plan => {
    const out = [];
    for (const k of Object.keys(plan).sort()) {
      if (cfg.fixed && cfg.fixed[k]) continue;
      (plan[k] || []).forEach((_, i) => out.push([k, i]));
    }
    return out;
  };

  let plan = cell.s;
  if (SELFTEST) {
    const emitted = pairOf(cell.s), cs = coordsOf(cell.s);
    let seeded = null;
    outer: for (const d of [1, -1, 2, -2, 3, -3]) for (let ci = 0; ci < cs.length; ci++) {
      const [k, i] = cs[ci];
      const cand = JSON.parse(JSON.stringify(cell.s));
      const t = Math.round(cand[k][i]) + d;
      if (t < 0 || t > cfg.T - 1) continue;
      cand[k][i] = t;
      const r = rep(cand);
      if (JSON.stringify(r) === JSON.stringify(rep(cell.s))) continue;      // relegalized straight back
      if (!api.planBetter(emitted, pairOf(cand))) continue;                 // a tie is not a break
      seeded = { plan: cand, what: `${k}#${i}${d > 0 ? '+' : ''}${d}` };
      break outer;
    }
    if (!seeded) { skipped++; console.error(`  ⚠ UNPERTURBABLE "${cell.name}" — no single nudge is strictly worse; not counted either way`); continue; }
    plan = seeded.plan;
    seedNotes.push(`${cell.name}: ${seeded.what}`);
  }

  const basePair = pairOf(plan);
  const base = basePair.score;
  if (!Number.isFinite(base)) { skipped++; continue; }
  const coords = coordsOf(plan);

  // A candidate `repair` had to relegalize is REFUSED, not scored — see the header.
  const intact = (cand, r) => {
    for (const k in cand) {
      if (!r[k] || r[k].length !== cand[k].length) return false;
      for (let j = 0; j < cand[k].length; j++) if (Math.abs(r[k][j] - cand[k][j]) > 1e-9) return false;
    }
    return true;
  };

  /* ★★★★★ THE HIGH-WATER CEILING — added 07-30 (MODEL-DEFECTS §8y), and without it this gate reports
     as "misses" exactly the moves the ENGINE deliberately refuses.

     `planBetter` is a BANDED comparator and therefore NOT TRANSITIVE (§8w): inside `TIE_CASTS` the
     score is tied and the SHAPE decides, including "earliest", so each individually-banded,
     individually-earlier step is individually "better" and a chain of them walks downhill without
     limit. `phaseRerank` was fixed by keeping a high-water mark and refusing anything more than one
     band below the best score SEEN. This gate applies `planBetter` to a single step with no such
     reference — so on the first kit sweep it reported three cells as tie-break misses whose recommended
     move is a step AWAY from the argmax:

         icon+skull · h0 · 2:00 · Lust 0:05 — skull swept, everything else held
           …  33: 100.816271   34: 100.817594 (emitted)   35: 100.818916 (argmax)   36: 100.811893 …
         the gate's advice was `skull#0-1`, i.e. 34 → 33: two bands below the argmax, and the exact
         step the engine's ceiling exists to refuse.

     ⇒ Grade against the NEIGHBOURHOOD'S OWN best score, which this gate — unlike the descent — can see
     in full: a candidate counts only if it is within one band of `hiScore`. Conservative for SCORE
     misses (the argmax always survives, so a real miss is still reported, and if a candidate is tied
     with the argmax and better-shaped it is the canonical member and still reported) and it removes
     precisely the downhill advice. ⛔ Do not "fix" this by dropping the shape half instead: that is the
     §8u mistake, which reported the declared T1 as a miss 5.8× inside the band. */
  let best = null, probes = 0, hiScore = base;
  const seen = [];
  const move = deltas => {
    const cand = clone(plan);
    for (const [ci, d] of deltas) {
      const [k, i] = coords[ci];
      const t = Math.round(cand[k][i]) + d;
      if (t < 0 || t > cfg.T - 1) return;
      cand[k][i] = t;
    }
    const r = rep(cand);
    if (!intact(cand, r)) return;
    probes++;
    const p = api.rankPair(r, cfg);
    if (p.score > hiScore) hiScore = p.score;
    if (api.planBetter(p, basePair)) seen.push({ v: p.score, pair: p, deltas: deltas.slice() });
  };
  // every subset of <=K coordinates, every delta assignment
  const walk = (start, depth, acc) => {
    if (acc.length) move(acc);
    if (depth === K) return;
    for (let c = start; c < coords.length; c++) for (const d of DELTAS) walk(c + 1, depth + 1, [...acc, [c, d]]);
  };
  walk(0, 0, []);
  // Apply the ceiling only now: `hiScore` is not known until the whole neighbourhood has been probed.
  for (const cnd of seen) {
    if (cnd.v < hiScore - (cnd.pair.band || 0)) continue;
    if (!best || api.planBetter(cnd.pair, best.pair)) best = cnd;
  }

  graded++;
  const plain = (api.plainCastOf && api.plainCastOf(cfg)) || 1;
  const gainCasts = best ? (best.v - base) / plain : 0;
  const kMoved = best ? best.deltas.length : 0;
  /* ★ TWO KINDS OF MISS, AND THEY ARE NOT THE SAME SEVERITY — separated 07-30 after the first kit
     sweep reported "beaten by +-0.001323 casts", i.e. a NEGATIVE gain, which reads as nonsense.
       · SCORE miss   — the candidate scores higher by more than the band. Real lost damage; the
                        descent could not reach a better plan. §8j/§8m/§8s are all this.
       · TIE-BREAK miss — the candidate is TIED on score (inside the band) and better on SHAPE, so
                        `planBetter` prefers it but the descent settled on the other member. Nothing
                        is lost in damage; the plan is simply not the canonical member of its plateau.
     Reporting them with one label made a 0.0013-cast canonicalisation look like a scoring defect and
     would have sent the next reader into `simulate()`. They are fixed in different places. */
  const scoreMiss = best && gainCasts > (best.pair.band || 0) / plain;
  if (best) bad++;
  if (scoreMiss) scoreBad++;
  rows.push({
    name: cell.name, T: cell.T, coords: coords.length, probes,
    optimal: !best, gainCasts, kMoved, scoreMiss: !!scoreMiss,
    move: best ? best.deltas.map(([ci, d]) => `${coords[ci][0]}#${coords[ci][1]}${d > 0 ? '+' : ''}${d}`).join(' & ') : null,
  });
}

if (JSONOUT) { console.log(JSON.stringify({ k: K, span: SPAN, selfTest: SELFTEST, rows }, null, 1)); process.exit(SELFTEST ? (bad === graded && graded > 0 ? 0 : 1) : (scoreBad ? 1 : 0)); }

if (SELFTEST) {
  console.log(`# SEARCH AUDIT --self-test — every emitted plan was displaced by one press; each must be CAUGHT\n`);
  for (const n of seedNotes) console.log(`  seeded  ${n}`);
  const caught = bad, missedByGate = graded - bad;
  console.log(`\nSELF-TEST k=${K} span=${SPAN} displaced=${graded} caught=${caught} NOT-caught=${missedByGate}${skipped ? ` unperturbable=${skipped}` : ''}`);
  if (!graded) { console.error('SELF-TEST FAIL — nothing was displaced, so nothing was asserted.'); process.exit(1); }
  if (missedByGate) {
    console.error(`⛔ SELF-TEST FAIL — ${missedByGate} displaced plan(s) audited CLEAN. The neighbourhood is`);
    console.error('   decoration there: a press was demonstrably in the wrong place and the gate could not see it.');
    process.exit(1);
  }
  console.log('✓ SELF-TEST PASS — every displaced plan was caught, so a real miss of this size would be too.');
  process.exit(0);
}

console.log(`# SEARCH AUDIT — is each emitted plan a ${K}-coordinate local optimum within ±${SPAN}s?`);
console.log(`#   sweep: ${SWEEP}\n`);
for (const r of rows) {
  const tag = r.optimal ? '✓ local-opt' : r.scoreMiss ? '⛔ SCORE   ' : '· tiebreak ';
  console.log(`  ${tag} ${r.name.padEnd(38)} T=${String(r.T).padStart(3)}  ${String(r.coords).padStart(2)} coords · ${String(r.probes).padStart(5)} probes` +
    (r.optimal ? '' : `\n              → ${r.scoreMiss ? `beaten by +${r.gainCasts.toFixed(6)} casts` : `TIED (Δ ${r.gainCasts.toFixed(6)}) but better SHAPE`}` +
                      ` via a ${r.kMoved}-coordinate move: ${r.move}`));
}
console.log(`\nSEARCH-AUDIT k=${K} span=${SPAN} graded=${graded}${skipped ? ` skipped=${skipped}` : ''} ` +
            `localOptima=${graded - bad} SCORE-MISSES=${scoreBad} tieBreakMisses=${bad - scoreBad}`);
if (bad - scoreBad) {
  console.log(`\n· ${bad - scoreBad} cell(s) are TIED but not the canonical member of their plateau. No damage is`);
  console.log('  lost; the fix is in `planBetter`/`planShape` or in the descent\'s move order, not in the scorer.');
}
if (scoreBad) {
  console.error('\n⛔ At least one emitted plan is beaten by a small simultaneous move — a SEARCH defect.');
  console.error('   ⛔ Do NOT "fix" this in `simulate()`. The scorer ranked the better plan correctly, which is');
  console.error('   how the miss was found at all; run `node tools/law-check.mjs` to confirm it is still green.');
  console.error('   The fix belongs in `phaseRerank`\'s move classes or in the seed classes — §8j added structural');
  console.error('   candidate times, §8m the co-pressed cluster slide, §8s the abutting-window train slide, and');
  console.error('   each was a move the descent could not make rather than a number it got wrong.');
  process.exit(1);
}
console.log('✓ no SCORE miss — every emitted plan survives its neighbourhood. ⚠ That is LOCAL optimality only — a press');
console.log('  120 s from where the descent put it (§8j) is outside every bounded neighbourhood.');
process.exit(0);
