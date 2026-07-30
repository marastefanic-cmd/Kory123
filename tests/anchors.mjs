// THE TESTS. There are EIGHT, and they are the layouts the user declared exactly.
//
// ══════════════════════════════════════════════════════════════════════════════════════════════════
// ★★★★★★ THESE ARE HARD TESTS. THEY ARE GROUND TRUTH. — user ruling, 2026-07-30, verbatim:
//
//   *"These have to be the output our tool. If the search misses them the search is failing; if the
//    scorer ranks something higher than them, the scorer is failing."*
//
// Read that as two SEPARATE failure modes with two different fixes, and this file now checks BOTH:
//
//   1. SEARCH FAILURE — `optimizeAsync` emits something other than the declared layout. Caught by
//      comparing press times. Fix in `phaseRerank`'s move classes or the seed classes; §8j, §8m, §8s
//      and §8w were all this. ⛔ NEVER by editing the layout.
//   2. SCORER FAILURE — some layout in the declared one's own neighbourhood RANKS HIGHER. Caught by
//      `scorerBeats()` below, which enumerates every move of ≤3 coordinates by ≤3 s and asks the
//      engine's own comparator. If anything wins, the declared layout is not the argmax under the
//      current objective — and because the layout is ground truth, **that is the objective being
//      wrong**. Fix in `simulate()`. ⛔ NEVER by editing the layout.
//
// ⛔⛔ THERE IS NO THIRD OPTION. A red here is never "the test is too strict" and never "the layout
// drifted". These eight were each declared by the user after reading the plan, and the contested ones
// were settled by BRUTE-FORCE ARGMAX rather than by assertion. Adjusting one to match the tool would
// destroy the only ground truth the project has — which is exactly what killed `exact-match`.
//
// ── ⚠⚠ AND THEY ARE ALL h = 0. THIS IS A DELIBERATE, STATED LIMIT. ────────────────────────────────
// `cfgFor` hardcodes `hasteRating: 0`; every case runs at zero gear haste (T1/T2 at 1000 SP / 25 %
// crit, T3–T8 at 1387 / 38 %). The user, same ruling: *"make sure that these are noted as h=0
// examples, figuring out higher haste is trickier."* That is not an oversight to fix by adding haste
// to these — it is the boundary of what is currently DECLARED. Above h = 0 the GCD cap starts binding
// and the right answers genuinely change: RULES §5 has Icy Veins sliding out of Lust as gear haste
// grows, §7 puts the IV+Berserking stack/split crossover at ~264 rating, §7a-ii the IV+Skull one at
// ~228. None of that is pinned by any test here.
// ⇒ `tools/kit-sweep.mjs` + `tools/search-audit.mjs` cover h ∈ {0, 200, 400} across seven kits, but
// they assert only that a plan is not beaten in its neighbourhood — never that it is RIGHT. Nothing
// declares a correct layout above h = 0. Treat a high-haste plan as unverified.
//
// ── ★ WHAT THE EQUATION IS, and it is the reason these eight can be ground truth at all ───────────
// The user's framing, which the engine implements: **the integral of "the damage a spell would deal
// right now, divided by the time it would take to cast right now"**, over the fight. The only thing
// that has to be modelled dynamically is the Arcane Blast stack count, because that is what changes
// the denominator. Everything else — haste multipliers, +SP, damage multipliers, the raid buffs — is
// a value overlaid on that curve at a known time. `docs/ESTABLISHED-FACTS.md` §0.1/§0.2.
// ⇒ Because the objective is an exact integral rather than an estimate, "layout A beats layout B" is
// ARITHMETIC. So a declared layout being out-ranked is a statement about the arithmetic, never about
// the layout — which is precisely what makes failure mode 2 above meaningful.
// ══════════════════════════════════════════════════════════════════════════════════════════════════
//
//   node tests/anchors.mjs
//
// ── WHY THIS IS THE WHOLE SUITE (user decision, 2026-07-28, restated twice) ───────────────────────
// *"I think it would be better if we got rid of all the 'goldens' and 'tests' and just established
// them from the ground up on extremely concrete examples."*  …  *"I want only the two exactly declared
// layouts to be tests."*
//
// So the plan-correctness gates that used to live beside this file are **deleted**, not disabled:
//   · `exact-match.mjs` + `golden.json` — locked whatever the optimizer said the day they were
//     recorded. They asserted STABILITY, never correctness, and they were re-recorded twice this month
//     to accommodate objective changes — a test rewritten whenever it disagrees is not a test.
//   · `layout-rules.mjs` — asserted plan SHAPE from a prose spec. Its R4 encoded a two-body rule as
//     universal (the Berserking × Bloodlust sign depends on the FULL multiplier — ESTABLISHED-FACTS
//     §5.1), and its R3 rested on a per-cast-sum cast count that §1.2b later showed is ramp-NEUTRAL.
//     Rules belong in the facts doc with their algebra; a paraphrase asserted here aged worse.
//   · `monotonicity.mjs` — a real invariant, but one `tools/` can sweep on demand.
//
// ⚠ **The harness-integrity gates are NOT tests of the plan and they stay.** Four of the five were sim
// gates and went with the simulator on 07-30 (`sim-request`, `sim-duel`, `page-equiv`, `press-fire`);
// `tools/self-consistency.mjs` survives and is the one that matters most, because a scorer that
// contradicts itself is the failure mode that hides longest. `tools/search-audit.mjs` joined the floor
// the same day: it asks whether the emitted plan is beaten by a small move, which no layout test can.
//
// ⚠ The ruling above says "the two"; it was made when there WERE two (07-28). The user has declared
// six more since, each the same way — by reading a plan the tool emitted and saying whether it was
// right — so the suite grows by declaration and never by recording. T7 and T8 carry an explicit ruling
// (*"easily lockable on this one"*, *"then this can get locked"*); they are pinned to a BRUTE-FORCE
// ARGMAX rather than to what the optimizer happened to say, which is the distinction that got
// `exact-match` deleted.
// ⚠⚠ **T6 IS THE ONE EXCEPTION AND IT IS FLAGGED ON PURPOSE.** It came from a bug report — *"why is the
// first IV at 0:06 not 0:07"* — which is a question, not a ruling, and it was added on the assistant's
// initiative. It has no explicit user mandate the way the others do. Remove it if the user says so.
// ⛔⛔ **AND IT IS NOT THE ARGMAX — CORRECTED 07-30 (MODEL-DEFECTS §8y).** This line used to claim
// *"it IS the verified argmax over 373k layouts, so it asserts something true"*. A wider enumeration
// falsifies that: over **1,582,581** legal cluster-locked layouts T6's declared layout ranks **33rd**,
// and the argmax is `AP/Icon/gem/IV @0:15 · IV @0:35 · Berserking @0:05` at +0.000231 casts — 8.6×
// INSIDE the tie band, and ahead on the tie-break's first criterion too (3 distinct press moments
// against 4, Berserking riding the Bloodlust call). The old enumeration was real but its space was
// narrower: it never ranged Berserking down onto the Lust call nor the cluster up to 0:15.
// ⇒ T6 currently passes only because the SEARCH cannot reach that layout. Move class 3d (§8y) makes it
// reachable and T6 goes red. **Whether T6 stands or is revised is an open USER CALL** — see §8y part 3;
// until it is answered, 3d stays out of `index.html` and one kit-matrix SCORE miss stays open.
//
// ── WHAT THESE ASSERT, AND WHY TIMESTAMPS ARE FAIR GAME HERE ──────────────────────────────────────
// All of them pin **every press time**, which is the user's explicit ruling: *"these two examples I
// sent are genuinely safe to lock even the timestamps on… these two need to always be this way."* It
// rests on two separate grounds and it matters which one a failure is about:
//   · the SCORE part — every press follows a law in `docs/ESTABLISHED-FACTS.md`, and where a layout was
//     contested it was settled by enumeration (T6: better than the then-emitted plan by 0.0058 casts
//     over 373k layouts — ⚠ NOT the global argmax, see the correction above) or by the sim
//     (Example 1: +2.0 DPS ± 0.37 over 5 seeds), never by assertion.
//   · the TIE-BREAK part — where a press sits on a plateau the sim cannot resolve, the exact second is
//     the STRUCTURAL choice: cluster with the other presses, fewest distinct press moments, most robust
//     to a press landing late. Same ruling as `docs/MODEL-DEFECTS.md` D2.
//
// ✅ ALL EIGHT PASS as of 2026-07-30 — `8 of 8` — and the CI job is BLOCKING again. MODEL-DEFECTS D1 is
// CLOSED. Seven scoring defects fell to get there (§8h-§8m) and the through-line is one sentence: the
// cast lattice had leaked into the RANKING objective in four separate places. The integral is now pure
// window geometry (`∫ rate(m(t)) dt` over press times, durations and wall events), its cooldown chain
// is geometric too, the objective is a pair (integral, then fewest press moments -> earliest), and the
// descent can slide a co-pressed cluster (§8m) or a train of abutting windows (§8s) as a unit.
// ⛔ IF THIS GOES RED, DO NOT LOOSEN THE ASSERTION AND DO NOT RESTORE `continue-on-error`. Run
// `node tools/law-check.mjs` first: it asserts the scorer against the closed forms, and every one of
// the scoring defects was found that way rather than by any plan diff. A press OUTSIDE its law is a
// scoring defect; a press on the wrong member of a plateau is a tie-break defect; a press the search
// never visited is a SEARCH defect (§8j, §8m, §8s — and the last two were invisible to every
// aggregate the project owns). They are fixed in three different places and law-check tells you
// which. Full record: docs/MODEL-DEFECTS.md §8h-§8t.
import { loadEngine, ALL_BUFFS, cfgFor as presetCfg } from '../tools/engine-node.mjs';

const api = loadEngine(new URL('../index.html', import.meta.url).pathname);

// FALSE-PASS GUARD: an engine without per-cast `frac` predates the boundary-credit board, and every
// verdict below would be about a scorer that no longer exists.
{
  const c = { T: 30, hasteRating: 0, sp: 1000, critPct: 25, enabled: {}, fixed: {}, warnings: [], coldSnap: true, segments: null };
  const probe = api.simulate(api.repair({}, c), c, true);
  if (!probe.casts || probe.casts[0].frac === undefined) {
    console.error('ANCHORS ERROR: this index.html predates the boundary-credit board (casts[].frac).');
    process.exit(2);
  }
}

const KIT = ['icyVeins', 'isc', 'scb', 'arcanePower', 'berserking', 'bloodlust'];
const cfgFor = c => ({
  T: c.T, hasteRating: 0, sp: c.sp, critPct: c.crit,
  enabled: Object.fromEntries(ALL_BUFFS.map(k => [k, KIT.includes(k)])),
  fixed: { bloodlust: [c.lust] }, warnings: [], coldSnap: true,
  segments: c.intermission
    ? api.buildSegments([{ from: c.intermission[0], to: c.intermission[1], type: 'intermission', mult: 1, targets: 0 }], c.T)
    : null,
});

/* ★ T3 — MOROGRIM, declared 2026-07-30, as a RULE rather than a timetable: *"pop the first cluster
   (everything except Berserking) as soon as a) 3 Arcane Blast stacks are active and b) Lust is active,
   then exactly 2 minutes after the first cluster the second cluster gets popped — IV (Cold Snap), Icon,
   Gem and Berserking"*, plus *"AP only fits once, and the first cluster gives it more value because
   Lust > Berserking, so it stays in the first one."*
   Lust is pinned 0:05 and the third stack completes at 6.498, so the first whole second with both
   conditions live is 0:07, and 2 minutes on is 2:07. ✅ GREEN since §8q.

   ★ T4/T5 — declared 07-30 off the shipped build, at the DEFAULT gear (1387 SP, 38 % crit) with Lust
   pinned 0:07, which is the first setup family the suite covers besides 1000 SP / Lust 0:20:
     T4  1:40, no phases      — one cluster on the Lust call, Berserking alone at 0:27, Cold-Snap Icy
                                Veins at 0:37. The only case where Berserking is NOT co-pressed with a
                                cluster, so it pins the lone-Berserking placement that nothing else does.
     T5  2:40, intermission 1:30–2:10 — the RE-RAMP case, and the first test to cover it at all. Casting
                                resumes at 2:10 and the same rule applies again: the second cluster goes
                                as soon as a) everything is off cooldown and b) 3 stacks are rebuilt.
                                The re-ramp runs 130 → 132.5 → 134.666 → 136.498, so 3 stacks are live
                                from 136.498 and the first whole second is **2:17** — the user's own
                                stated assumption, and it is derived here rather than copied.
   ⚠ T5 is the only guard on the re-ramp path, which §8q's opener-toll change made load-bearing (every
   re-ramp pays the toll again). Do not delete it without replacing that coverage.

   ★★ T6/T7 — declared 07-30 as two REPORTED BUGS, and they are the regression guard for §8s (the
   abutting-window train slide). Both were emitted wrong by the shipped build and both were enumerated
   rather than asserted — ⚠ but read the T6 correction at the top of this file: "enumerated" meant
   "beats the plan it replaced over the space searched", NOT "is the global argmax", and for T6 the
   stronger reading is now falsified (§8y):
     T6  2:00, Lust 0:05     — emitted IV[5,35] Zerk 25 (100.7790); declared IV[7,37] Zerk 27 (100.7849)
                               over 373k layouts. Gap 0.0058 casts, 2.9× the tie band. ⛔ A 1.58M-layout
                               enumeration later put the declared layout 33rd; see §8y part 3.
     T7  1:15, Lust 0:05, intermission 0:50–0:55 — emitted IV[2,55] Zerk 21 (67.3484); argmax
                               IV[7,55] Zerk 27 (67.4506). Gap 0.1022 casts, and the LARGEST search
                               miss in the suite. Icy Veins had run off to 0:02, two seconds before the
                               cluster it should sit on, because the emitted point was a 2-D local
                               maximum whose only escape moved three coordinates at once.
   ★★★ T8 — THE PREPULL TEST, and it is the only one that asserts a NEGATIVE press time.
   The user built this fight specifically to make a prepull strictly beneficial, and it is the only
   case so far where all of RULES §7b's conditions hold at once:
     · Icon's first window [0,20] has its tail killed by the 0:15–0:20 intermission — so pressing 5 s
       early costs NOTHING (usable uptime is 15 s either way);
     · Icon's two uses sit EXACTLY 120 s apart — the cooldown, so use #2 is genuinely blocked;
     · use #2's window [120,140] is cut by the 135 s kill, so moving it earlier actually ADDS time.
   Worth **+0.323591 casts, 162× the tie band** over the [0,120] the cooldown used to force. The user's
   ruling was conditional — *"if you can implement and modify that in this next fight Icon would be
   popped at -5s, then this can get locked"* — and the optimizer emits `isc:[-5,115]` unprompted.
   ⚠ It is the regression guard for the whole negative-press-time path: `earliestPress`, repair's
   floors, the prepull aura branch in `simulate`, and phaseRerank's bounds. If it goes red, prepull is
   broken somewhere in that chain and no other test covers it.

   ⚠ T7's second Icy Veins lands ON the intermission end (0:55) rather than after it — the argmax, not
   a rounding artifact: a press during an intermission is legal and the window is already running when
   casting resumes. It is the only test that pins that, so a change to the intermission handling shows
   up here first. */
const CASES = [
  { name: 'T1 — 2:00, Bloodlust pinned 0:20, h=0, 1000 SP, 25 % crit',
    T: 120, sp: 1000, crit: 25, lust: 20,
    want: { icyVeins: [0, 20], isc: [20], scb: [20], arcanePower: [20], bloodlust: [20], berserking: [40] } },
  { name: 'T2 — 3:00, Bloodlust pinned 0:20, h=0, 1000 SP, 25 % crit',
    T: 180, sp: 1000, crit: 25, lust: 20,
    want: { icyVeins: [20, 140], isc: [20, 140], scb: [20, 140], arcanePower: [20], bloodlust: [20], berserking: [140] } },
  { name: 'T4 — 1:40, Bloodlust pinned 0:07, h=0, 1387 SP, 38 % crit',
    T: 100, sp: 1387, crit: 38, lust: 7,
    want: { icyVeins: [7, 37], isc: [7], scb: [7], arcanePower: [7], bloodlust: [7], berserking: [27] } },
  { name: 'T5 — 2:40, Bloodlust pinned 0:07, intermission 1:30-2:10, 1387 SP, 38 % crit',
    T: 160, sp: 1387, crit: 38, lust: 7, intermission: [90, 130],
    want: { icyVeins: [7, 137], isc: [7, 137], scb: [7, 137], arcanePower: [7], bloodlust: [7], berserking: [137] } },
  { name: 'T6 — 2:00, Bloodlust pinned 0:05, h=0, 1387 SP, 38 % crit',
    T: 120, sp: 1387, crit: 38, lust: 5,
    want: { icyVeins: [7, 37], isc: [7], scb: [7], arcanePower: [7], bloodlust: [5], berserking: [27] } },
  { name: 'T7 — 1:15, Bloodlust pinned 0:05, intermission 0:50-0:55, 1387 SP, 38 % crit',
    T: 75, sp: 1387, crit: 38, lust: 5, intermission: [50, 55],
    want: { icyVeins: [7, 55], isc: [7], scb: [7], arcanePower: [7], bloodlust: [5], berserking: [27] } },
  { name: 'T8 — 2:15, Bloodlust pinned 1:35, intermission 0:15-0:20 — THE PREPULL CASE',
    T: 135, sp: 1387, crit: 38, lust: 95, intermission: [15, 20],
    want: { isc: [-5, 115], scb: [0, 120], berserking: [0], icyVeins: [95, 115], arcanePower: [120], bloodlust: [95] } },
];

// T3 uses a real BOSS preset, so its cfg comes from the fight table (sp 1387, crit 38, Lust pinned 0:05)
// rather than the hand-built one above — `cfgFor` is the same constructor the UI and the sweeps use.
const BOSS_CASES = [
  { name: 'T3 — Morogrim Tidewalker (preset): cluster on 3 stacks + Lust, second cluster +2:00',
    preset: 'Morogrim Tidewalker',
    want: { icyVeins: [7, 127], isc: [7, 127], scb: [7, 127], arcanePower: [7], bloodlust: [5], berserking: [127] } },
];

const mmss = t => `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, '0')}`;
const fmt = s => Object.keys(s).sort().map(k => `${k}@${s[k].map(mmss).join('/')}`).join('  ');

/* ★★★★★ THE SCORER CHECK — user ruling, 2026-07-30, and it is the OTHER half of what these tests mean:
   *"These have to be the output our tool. If the search misses them the search is failing; if the
   scorer ranks something higher than them, the scorer is failing."*

   Those are two DIFFERENT failures with two different fixes, and a test that only compares press times
   can see one of them. Comparing `got` to `want` catches the SEARCH. This catches the SCORER: it
   enumerates every move of <=3 coordinates by <=3 s around the DECLARED layout and asserts that the
   engine's own comparator prefers none of them. If something wins, the declared layout is not the
   argmax under the current objective — and since the layouts are ground truth, that is the objective
   being wrong, not the layout.

   ⚠ It grades on the objective PAIR (`rankPair`/`planBetter`), the same comparator the optimizer
   adopts with — never on `rankScore` alone. Three instruments in this repo have made that mistake in
   one day (MODEL-DEFECTS §8t, §8u); inside `TIE_CASTS` the score is tied and the SHAPE decides.
   ⚠ A candidate `repair` had to relegalize is refused rather than scored, so a plan is never judged
   against a layout nobody could actually press. */
function scorerBeats(want, cfg) {
  if (!api.rankPair || !api.planBetter) return null;   // engine predates the comparator export
  const clone = o => JSON.parse(JSON.stringify(o));
  const rep = x => api.repair(clone(x), cfg);
  const basePair = api.rankPair(rep(want), cfg);
  const coords = [];
  for (const k of Object.keys(want).sort()) {
    if (cfg.fixed && cfg.fixed[k]) continue;          // pinned raid calls are not ours to move
    want[k].forEach((_, i) => coords.push([k, i]));
  }
  const D = [-3, -2, -1, 1, 2, 3];
  let best = null;
  const walk = (start, depth, acc) => {
    if (acc.length) {
      const cand = clone(want);
      let ok = true;
      for (const [ci, d] of acc) {
        const [k, i] = coords[ci];
        const t = Math.round(cand[k][i]) + d;
        if (t < -(api.BUFFS[k].dur - 1) || t > cfg.T - 1) { ok = false; break; }
        cand[k][i] = t;
      }
      if (ok) {
        const r = rep(cand);
        let intact = true;
        for (const k in cand) {
          if (!r[k] || r[k].length !== cand[k].length) { intact = false; break; }
          for (let j = 0; j < cand[k].length; j++) if (Math.abs(r[k][j] - cand[k][j]) > 1e-9) { intact = false; break; }
        }
        if (intact) {
          const p = api.rankPair(r, cfg);
          if (api.planBetter(p, basePair) && (!best || api.planBetter(p, best.p))) best = { p, r, acc: acc.slice(), coords };
        }
      }
    }
    if (depth === 3) return;
    for (let i = start; i < coords.length; i++) for (const d of D) walk(i + 1, depth + 1, [...acc, [i, d]]);
  };
  walk(0, 0, []);
  if (!best) return null;
  return { move: best.acc.map(([ci, d]) => `${coords[ci][0]}#${coords[ci][1]}${d > 0 ? '+' : ''}${d}`).join(' & '),
           gain: (best.p.score - basePair.score) / api.plainCastOf(cfg), plan: best.r };
}

/* ⚠⚠⚠ THE FAILURE SIZE IS REPORTED ON THE OBJECTIVE PAIR — AND IT USED TO BE REPORTED ON `robust`,
   WHICH IS THE RETIRED PER-CAST SUM. Fixed 07-30 (MODEL-DEFECTS §8y). This file printed
   `simulate(...).robust` under the label "on the shipped objective", and since §8h that number is
   REPORTED, not ranked — the rate integral ranks. The consequence was not cosmetic: on T6 it turned a
   gap of **+0.000231 casts** (8.6× INSIDE the tie band, i.e. a dead tie) into a printed
   **"−0.1028 effective casts"**, which reads as a catastrophic scoring failure and would send the next
   reader straight into `simulate()` after a plateau.
   ★ THIS IS THE FOURTH INSTRUMENT IN THIS REPO TO MAKE THAT EXACT MISTAKE — after `plan-sweep` and
   `plan-diff` (§8t) and `search-audit` (§8u). CLAUDE.md's standing instruction is the fix: **import the
   comparator, never re-implement it.** So this reads `rankPair`/`plainCastOf`/`TIE_CASTS` off the
   engine, and it reports BOTH halves of the pair, because a gap inside the band is not a score
   difference at all — it is the SHAPE tie-break, and that is a different defect with a different fix. */
const deltaLine = (want, got, cfg) => {
  const rep = s => api.repair(JSON.parse(JSON.stringify(s)), cfg);
  const pw = api.rankPair(rep(want), cfg), pg = api.rankPair(rep(got), cfg);
  const pc = api.plainCastOf(cfg);
  const d = (pw.score - pg.score) / pc, band = (pw.band || 0) / pc;
  const sw = api.planShape(rep(want)).distinct, sg = api.planShape(rep(got)).distinct;
  const verdict = Math.abs(d) < band
    ? `TIED on score (|Δ| < band ${band.toFixed(6)}) ⇒ this is a TIE-BREAK gap: want has ${sw} distinct press moments, got has ${sg}`
    : d < 0 ? 'the emitted plan SCORES HIGHER than the declared layout ⇒ a SCORER failure (see the header)'
            : 'the declared layout scores higher ⇒ a SEARCH failure (the descent never reached it)';
  return `      Δ (want − got) = ${d.toFixed(6)} casts on the RANKING integral — ${verdict}`;
};

let failures = 0;
console.log('# THE TESTS — the layouts declared exactly (user, 2026-07-28 .. 07-30)\n');
for (const c of CASES) {
  const cfg = cfgFor(c);
  const got = (await api.optimizeAsync(cfg, undefined, () => {})).s;
  const diffs = [];
  for (const k of Object.keys(c.want)) {
    const g = (got[k] || []).map(x => +x.toFixed(3)), w = c.want[k];
    if (g.length !== w.length || g.some((v, i) => Math.abs(v - w[i]) > 1e-6)) diffs.push(`${k}: want [${w}] got [${g}]`);
  }
  for (const k of Object.keys(got)) if (!(k in c.want)) diffs.push(`${k}: unexpected, got [${got[k]}]`);
  if (diffs.length) failures++;
  console.log(`${diffs.length ? 'FAIL' : 'PASS'}  ${c.name}`);
  console.log(`      want  ${fmt(c.want)}`);
  console.log(`      got   ${fmt(got)}`);
  for (const d of diffs) console.log(`      ⛔ ${d}`);
  // Score both, so a failure carries its SIZE and not only its shape.
  if (diffs.length) console.log(deltaLine(c.want, got, cfg));
  const beat = scorerBeats(c.want, cfg);
  if (beat) {
    failures++;
    console.log(`      ⛔⛔ SCORER FAILURE — the declared layout is NOT the argmax of its own neighbourhood.`);
    console.log(`         beaten by ${beat.gain >= 0 ? '+' : ''}${beat.gain.toFixed(6)} casts via ${beat.move}`);
    console.log(`         ⇒ the layout is GROUND TRUTH, so this is the OBJECTIVE being wrong. Do not "fix" the layout.`);
  }
  console.log('');
}

for (const c of BOSS_CASES) {
  const row = api.cases.find(x => x.name === c.preset);
  if (!row) { console.log(`FAIL  ${c.name}\n      ⛔ preset ${JSON.stringify(c.preset)} not in the fight table`); failures++; continue; }
  const cfg = presetCfg(api, row);
  const got = (await api.optimizeAsync(cfg, undefined, () => {})).s;
  const diffs = [];
  for (const k of Object.keys(c.want)) {
    const g = (got[k] || []).map(x => +x.toFixed(3)), w = c.want[k];
    if (g.length !== w.length || g.some((v, i) => Math.abs(v - w[i]) > 1e-6)) diffs.push(`${k}: want [${w}] got [${g}]`);
  }
  for (const k of Object.keys(got)) if (!(k in c.want)) diffs.push(`${k}: unexpected, got [${got[k]}]`);
  if (diffs.length) failures++;
  console.log(`${diffs.length ? 'FAIL' : 'PASS'}  ${c.name}`);
  console.log(`      want  ${fmt(c.want)}`);
  console.log(`      got   ${fmt(got)}`);
  for (const d of diffs) console.log(`      ⛔ ${d}`);
  if (diffs.length) console.log(deltaLine(c.want, got, cfg));
  const beat = scorerBeats(c.want, cfg);
  if (beat) {
    failures++;
    console.log(`      ⛔⛔ SCORER FAILURE — the declared layout is NOT the argmax of its own neighbourhood.`);
    console.log(`         beaten by ${beat.gain >= 0 ? '+' : ''}${beat.gain.toFixed(6)} casts via ${beat.move}`);
    console.log(`         ⇒ the layout is GROUND TRUTH, so this is the OBJECTIVE being wrong. Do not "fix" the layout.`);
  }
  console.log('');
}

const N = CASES.length + BOSS_CASES.length;
console.log(`${N - failures} of ${N} passed.`);
if (failures) {
  console.log('\n⛔ All eight were GREEN on 07-30, so a failure here is a REGRESSION. Run `node tools/law-check.mjs`');
  console.log('   first — every scoring defect this project has found was caught by a closed form, never by a');
  console.log('   plan diff. A press OUTSIDE its law is a scoring defect; a press on the wrong member of a');
  console.log('   plateau is a tie-break defect; a press the search never visited is a SEARCH defect (§8j,');
  console.log('   §8m, §8s) — three different fixes, and law-check tells you which.');
}
process.exit(failures ? 1 : 0);
