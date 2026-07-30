// THE TESTS. There are two, and they are the two layouts the user declared exactly.
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
// ⚠ **The harness-integrity gates are NOT tests of the plan and they stay**: `sim-request.mjs`
// (protocol invariants), `sim-duel.mjs` (the wasm boots), `page-equiv.mjs` (page == terminal request),
// `press-fire.mjs` (transcription grading) and `tools/self-consistency.mjs` (the scorer agrees with its
// own board). They catch a broken wasm, a drifted protocol constant and a self-contradicting scorer —
// none of which is a claim about which layout is best. Deleting those removes the floor this file
// stands on.
//
// ── WHAT THESE TWO ASSERT, AND WHY TIMESTAMPS ARE FAIR GAME HERE ──────────────────────────────────
// Both pin **every press time**, which is the user's explicit ruling: *"these two examples I sent are
// genuinely safe to lock even the timestamps on… these two need to always be this way."* It rests on
// two separate grounds and it matters which one a failure is about:
//   · the SCORE part — Bloodlust is pinned late (0:20) so no Arcane-Blast-stack cheese is available,
//     every press follows a law in `docs/ESTABLISHED-FACTS.md`, and wowsims prefers these layouts over
//     what the optimizer emitted (Example 1: +2.0 DPS ± 0.37 over 5 seeds).
//   · the TIE-BREAK part — where a press sits on a plateau the sim cannot resolve, the exact second is
//     the STRUCTURAL choice: cluster with the other presses, fewest distinct press moments, most robust
//     to a press landing late. Same ruling as `docs/MODEL-DEFECTS.md` D2.
//
// ✅ BOTH PASS as of 2026-07-30 — `2 of 2` — and the CI job is BLOCKING again. MODEL-DEFECTS D1 is
// CLOSED. Seven defects fell to get here (§8h-§8m) and the through-line is one sentence: the cast
// lattice had leaked into the RANKING objective in four separate places. The integral is now pure
// window geometry (`∫ rate(m(t)) dt` over press times, durations and wall events), its cooldown chain
// is geometric too, the objective is a pair (integral, then fewest press moments -> earliest), and the
// descent can slide a co-pressed cluster as a unit.
// ⛔ IF THIS GOES RED, DO NOT LOOSEN THE ASSERTION AND DO NOT RESTORE `continue-on-error`. Run
// `node tools/law-check.mjs` first: it asserts the scorer against the closed forms, and every one of
// the seven defects was found that way rather than by any plan diff. A press OUTSIDE its law is a
// scoring defect; a press on the wrong member of a plateau is a tie-break defect; a press the search
// never visited is a search defect. They are fixed in three different places and law-check tells you
// which. Full record: docs/MODEL-DEFECTS.md §8h-§8m.
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
  fixed: { bloodlust: [20] }, warnings: [], coldSnap: true, segments: null,
});

/* ★ T3 — MOROGRIM, declared 2026-07-30. The user gave the RULE and its consequence, not a timetable:
   *"Morogrim has to pop the first cluster (everything except Berserking) as soon as a) 3 Arcane Blast
   stacks are active and b) Lust is active, then exactly 2 minutes after the first cluster the second
   cluster gets popped — IV (due to Cold Snap resetting the CD), Icon, Gem and Berserking"*, plus
   *"AP only fits once, and the first cluster gives it more value because Lust > Berserking, so it stays
   in the first one. Everything else can be used exactly twice."*
   Bloodlust is pinned 0:05 and the third stack completes at 6.498, so the first legal whole second with
   both conditions live is 0:07, and the Icon's 2-minute cooldown puts the second cluster at 2:07.
   ⛔ RED TODAY, and the reason is ONE press. `docs/MODEL-DEFECTS.md` §8p: the model over-credits
   `haste × +spellpower` by about a third (the closed form, not the code), which pulls Berserking onto the
   second cluster and — separately — it under-charges haste spent on the opening ramp, so it presses Icy
   Veins at the pull instead of waiting for 3 stacks. The derivation the user's rule follows from:
   during a k-stack ramp cast the rate is `m/C_k` (cast-bound, C_k = 2.5 / 2.166 / 1.832) against `m/G`
   at steady state, so a haste buff gains `(m−1)/2.5 = 0.080` casts per second over the 0-stack cast
   versus `(m−1)/1.5 = 0.133` at steady state — **~40 % less**. Icy Veins at the pull therefore spends
   5.4 s of its 20 s on nearly worthless ground.
   ⚠ The sim currently prefers Berserking in Bloodlust here by 1.2 DPS ± 0.20 while the closed forms
   prefer the cluster by 1.24 — the disagreement of §8p. The user was told and reaffirmed the layout, so
   it stands as declared. */
const CASES = [
  { name: 'T1 — 2:00, Bloodlust pinned 0:20, h=0, 1000 SP, 25 % crit',
    T: 120, sp: 1000, crit: 25,
    want: { icyVeins: [0, 20], isc: [20], scb: [20], arcanePower: [20], bloodlust: [20], berserking: [40] } },
  { name: 'T2 — 3:00, Bloodlust pinned 0:20, h=0, 1000 SP, 25 % crit',
    T: 180, sp: 1000, crit: 25,
    want: { icyVeins: [20, 140], isc: [20, 140], scb: [20, 140], arcanePower: [20], bloodlust: [20], berserking: [140] } },
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
console.log('# THE TESTS — the two layouts declared exactly (user, 2026-07-28)\n');
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
  console.log('\n⛔ T1/T2 went green on 07-30 (D1 closed). A failure here is a REGRESSION unless it is T3, whose');
  console.log('   open defect is docs/MODEL-DEFECTS.md §8p. Run `node tools/law-check.mjs` first — every');
  console.log('   scoring defect this project has found was caught by a closed form, never by a plan diff.');
}
process.exit(failures ? 1 : 0);
