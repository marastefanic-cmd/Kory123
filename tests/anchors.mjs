// THE TESTS. There are EIGHT, and they are the layouts the user declared exactly.
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
// initiative. It IS the verified argmax over 373k layouts, so it asserts something true; it simply has
// no explicit user mandate the way the others do. Remove it if the user says so.
//
// ── WHAT THESE ASSERT, AND WHY TIMESTAMPS ARE FAIR GAME HERE ──────────────────────────────────────
// All of them pin **every press time**, which is the user's explicit ruling: *"these two examples I
// sent are genuinely safe to lock even the timestamps on… these two need to always be this way."* It
// rests on two separate grounds and it matters which one a failure is about:
//   · the SCORE part — every press follows a law in `docs/ESTABLISHED-FACTS.md`, and where a layout was
//     contested it was settled by enumeration (T6: the argmax over 373k layouts) or by the sim
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
   abutting-window train slide). Both were emitted wrong by the shipped build and both are now the
   BRUTE-FORCE ARGMAX, enumerated rather than asserted:
     T6  2:00, Lust 0:05     — emitted IV[5,35] Zerk 25 (100.7790); argmax IV[7,37] Zerk 27 (100.7849)
                               over 373k layouts. Gap 0.0058 casts, 2.9× the tie band.
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
  const V = s => api.simulate(api.repair(JSON.parse(JSON.stringify(s)), cfg), cfg).robust;
  const one = (api.GAME.AB.AVG_BASE_DMG + api.GAME.AB.COEF * c.sp) * (1 + (c.crit / 100) * (api.GAME.CRIT_MULT - 1));
  if (diffs.length) console.log(`      Δ (want − got) = ${((V(c.want) - V(got)) / one).toFixed(4)} effective casts on the shipped objective`);
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
  const V = s => api.simulate(api.repair(JSON.parse(JSON.stringify(s)), cfg), cfg).robust;
  const one = (api.GAME.AB.AVG_BASE_DMG + api.GAME.AB.COEF * cfg.sp) * (1 + (cfg.critPct / 100) * (api.GAME.CRIT_MULT - 1)) * (cfg.t5two ? 1.2 : 1);
  if (diffs.length) console.log(`      Δ (want − got) = ${((V(c.want) - V(got)) / one).toFixed(4)} effective casts on the shipped objective`);
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
