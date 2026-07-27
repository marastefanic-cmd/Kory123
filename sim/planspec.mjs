// Plan → genapl spec. THE TRANSCRIPTION CONVENTION, in one place.
//
// This is the step that decides *what the sim is actually asked to execute*, and it is the step the
// cross-val harness got wrong once at a cost of −1.5% on a KT plan (xval.mjs P7.15). It is therefore
// shared verbatim by the terminal harness and the in-page "verify in the sim" button: if the two ever
// transcribed a plan differently, the button would be verifying a plan the tool never printed.
//
// ★★★ EMIT = A SCHEDULE VALUE THAT MAKES THE PRESS FIRE AT THE MODEL'S FIRE TIME. `best.s` holds
// press INTENTS; what the tool PRINTS and what the model SCORES are FIRE times
// (`simulate(s, cfg, true).actEff`). genapl schedules every cooldown UNCONDITIONALLY (only Arcane
// Blast is gated on `_intermissions`), so feeding INTENTS makes the sim press mid-downtime and buff a
// burn the model never charged. A duel is only a duel if the sim executes the plan the tool prints.
//
// ⚠⚠ THE SCHEDULE VALUE IS NOT THE PRESS TIME. It is the value that makes wowsims fire the press AT
// the press time, and the two are different because the sim only *evaluates* its APL at cast
// boundaries. `APLActionSchedule.IsReady` is `sim.CurrentTime >= timing`, so a press fires at the
// first boundary whose clock reaches the scheduled value. Emit the fire time verbatim and a press
// landing on a boundary can miss it — the sim's cast lattice does not sit exactly on the model's.
//
// ── WHY THE LATTICES DIFFER (measured, `tools/lattice-drift.mjs`) ─────────────────────────────────
//   wowsims  sim/mage/arcane_charge.go:17   castTimeReduction := time.Millisecond * -334
//   model    index.html GAME.AB             STACK_CAST_REDUCTION: 1/3          (333.333… ms)
// plus wowsims `.Round(time.Millisecond)`s every cast (sim/core/cast.go:137-138). At h=0 the ramp ends
// 2 ms behind the model and then both run GCD-capped, so the offset FREEZES at 2 ms — and the combat
// log prints 2 decimals, so the boundary reads "11.00" while `sim.CurrentTime` is 10.998. `schedule
// 11s` misses it by 2 ms and the press waits a whole cast. Off the GCD cap the offset accumulates
// instead: up to **80 ms** by 300 s, one-signed, sign varying with haste.
//
// ⚠ PHASE12 §6.6/§6.7 recorded this as "the schedule fires at the first boundary STRICTLY AFTER the
// scheduled time". That is the right consequence attached to the wrong cause — `IsReady` is `>=`, and
// a schedule 1 ns below the boundary's own value ALSO fires late (`tools/press-ns-probe.mjs`). The
// cause is the lattice offset, and it is what sets the margin below: a fix that shaved a nanosecond,
// or that trusted "strictly after" as a law, would be betting on the sign of a rounding error.
//
// ── THE RULE ──────────────────────────────────────────────────────────────────────────────────────
// The model applies a press to the FIRST CAST whose start is ≥ its fire time (that is what the
// discrete walk in `simulate()` does — the press event fires at a cast boundary and the buff is in
// `active` for that cast onward). Call that boundary B. Then:
//
//   emit the fire time, CLAMPED into `[prevBoundary + SLACK, B − SLACK]`.
//
//   · a press in the middle of a cast, or in a downtime gap, is nowhere near either edge, so it is
//     emitted verbatim. Inside a hardcast the sim waits for that cast to end, which IS B; inside a gap
//     the sim fires it within a ReactionTime, which is where the model starts the buff's duration.
//   · a press ON or NEAR B is pulled back to `B − SLACK`, so no lattice offset can make it miss B and
//     buff the cast after it;
//   · a press just AFTER the previous boundary is pushed up to `prev + SLACK`, so no lattice offset in
//     the other direction can make it fire a cast EARLY. Both edges matter: the drift's sign flips
//     with haste.
//
// SLACK = min(0.5 s, interval/2) — as much margin as the interval can give, which is the most a
// transcription can do from the model's grid alone. Intervals are ≥ the 1 s GCD floor, so in practice
// this is 0.5 s, and at exactly 1 s the clamp collapses to the interval's midpoint: maximal tolerance
// in both directions, by construction.
//
// ⚠ Why 0.5 and not the 0.08 s a bare stream drifts: measured on real PLANS the two grids are ~0.32 s
// apart by t=180 (`tools/press-verify.mjs --fire` prints the gap as its `off` column). Every haste
// buff re-quantizes the interval, so a buffed plan accumulates far more than a bare one. 0.25 s was
// tried first and left a Berserking press firing a cast late at t=180 — this margin is set by that
// measurement, not by a guess.
//
// ⛔ AND IT IS A CEILING, NOT A CURE. A drift bigger than half an interval cannot be transcribed
// around at all: the model would be naming a boundary the sim does not have. The drift's own cause is
// the 334 ms / (1/3) s mismatch above — fixing THAT is a model change (it moves cast times, so it
// moves plans) and belongs in its own commit, not this one. Until then `tests/press-fire.mjs` part B
// is the tripwire that says when the ceiling has been hit.
//
// ⛔ The retired convention was `Math.floor(actEff)`, justified as "a press at floor(F) ≤ F snaps to
// the same boundary". That is false whenever F is not itself a boundary, and it cost real casts in
// BOTH directions: `tools/press-exposure.mjs` over the round's 32416 presses found **1.5 % fired a
// full cast EARLY** (floor moved the value back past a boundary) and **25.2 % landed ON a boundary**,
// where which cast got buffed was decided by the millisecond of lattice offset, not by the plan.
//
// ★★★ COLD OPEN, ALWAYS (`_prestack: 0`). The model never prepulls; a prepull's fixed −2.3s is
// haste-blind and silently corrupts any haste comparison (TOOLING ★★★, RULES §3).
//
// A press that the model's repair() legalized away has no `actEff` entry and is NOT emitted — handing
// it to the sim would grant a buff window the model never scored.

// tool key → genapl spec key.
//
// ★ WHY DRUMS AND POWER INFUSION ARE ABSENT — it is an ENGINE limit, not a genapl gap, and it fails
// SILENTLY (measured 07-26, user-challenged: "how come it can do Bloodlust?"). In wowsims, a spell is
// only addressable from an APL if it is registered with `SpellFlagAPL`:
//   • Bloodlust     `registerBloodlustCD` → Flags: SpellFlagAPL | …            ⇒ schedulable ✓
//   • Drums 35476   `drumsSpellConfig`    → Flags: SpellFlagNoOnCastComplete   ⇒ NOT schedulable
//   • Power Inf.    `registerExternalConsecutiveCDApproximation` → same, no APL flag ⇒ NOT schedulable
// Both are registered as auto-fired `MajorCooldown`s instead — the sim's own scheduler decides when,
// which is precisely the thing a press-timing duel must not let it decide. Scheduling them anyway
// produces **no error and no effect**: measured 2128.9 DPS with and without the press, bit-identical,
// zero aura uptime. That silent no-op is this harness's dominant failure mode wearing the engine's
// clothes, which is why `planToSpec` REPORTS what it dropped instead of quietly omitting it.
// Fixable upstream — a third entry in `tools/wowsims-patches/` adding `SpellFlagAPL` to those two —
// at the cost of re-certifying the trust anchor (BENCH §3d). Not done unprompted.
//
// Ashtongue is a different case entirely and is NOT patchable: it is a passive proc, so there is no
// press to schedule at all (RULES §14 — it is counted, never planned).
export const SPEC_KEY = {
  icyVeins: "IV", arcanePower: "AP", berserking: "Zerk", bloodlust: "BL",
  isc: "Icon", scb: "Gem", skull: "Skull", mqg: "MQG",
};
export const UNTRANSCRIBABLE = { ati: "Ashtongue Talisman", drums: "Drums of Battle", powerInfusion: "Power Infusion" };

// ★ spec key → the item that must be EQUIPPED for that press to do anything, and the trinket key the
// harnesses name it by. An on-use is only castable while its item is worn, and wowsims does NOT
// complain when it is not: a scheduled press of an unequipped trinket is a **bit-identical no-op**
// (measured 07-26 on the bench character, which wears isc+scb — `Skull:[0]` and `MQG:[0]` both
// returned 2127.17, the never-press control's value to the decimal). That is the same silent-omission
// failure `UNTRANSCRIBABLE` exists to prevent, reached by a different route, so any tool that lets a
// caller supply BOTH a spec and a character must check them against each other.
//
// ⚠ `Gem` is the subtle one and the reason this cannot be derived from genapl's ActionIDs: the APL
// FIRES a Mana Emerald (itemId 22044) but the +225 SP "Mana Surge" that makes it worth pressing comes
// from wearing **Serpent-Coil Braid (30720)**. The id that must be equipped is not the id that is cast.
export const REQUIRES_EQUIPPED = {
  Icon:  { item: 29370, trinket: "isc",   name: "Icon of the Silver Crescent" },
  Gem:   { item: 30720, trinket: "scb",   name: "Serpent-Coil Braid" },
  Skull: { item: 32483, trinket: "skull", name: "Skull of Gul'dan" },
  MQG:   { item: 19339, trinket: "mqg",   name: "Mind Quickening Gem" },
};

// Which of a spec's presses would be silent no-ops on a character wearing `equippedIds`.
// Returns [] when everything the spec presses is worn.
export function unequippedPresses(spec, equippedIds) {
  const worn = new Set((equippedIds || []).map(Number));
  return Object.entries(REQUIRES_EQUIPPED)
    .filter(([k, v]) => (spec[k] || []).length && !worn.has(v.item))
    .map(([k, v]) => `${k} (${v.name}, item ${v.item})`);
}

// See the header. Half an interval is the whole budget a value derived from the model's grid can have,
// and intervals are ≥ the 1 s GCD floor, so this caps at 0.5 s and binds in practice.
const SLACK_CAP = 0.5;
const EPS = 1e-9;
// Emit whole milliseconds — wowsims parses the schedule string with `time.ParseDuration`, and a raw
// float prints 17 digits of noise. Round DOWN so the value can never creep up onto the boundary it is
// deliberately staying below.
const ms = t => Math.floor(t * 1000 + EPS) / 1000;

// Turn one model FIRE time into the schedule value that reproduces it, given the model's cast grid.
// `starts` are cast start times (ascending); `spans[i]` is cast i's end (start + cast time), which is
// where the sim's next APL evaluation happens if the press lands inside that cast.
function scheduleFor(fire, starts, spans) {
  let idx = -1;                                    // the cast the MODEL buffs: first start ≥ fire
  for (let i = 0; i < starts.length; i++) { if (starts[i] >= fire - EPS) { idx = i; break; } }
  if (idx < 0) return { at: ms(fire), fire, cast: -1 };  // press lands past the last cast — buffs nothing
  // The press must land in the sim interval that ENDS at the model's target boundary, and it has to
  // still land there once the sim's lattice is shifted by up to the measured drift — so it needs the
  // margin at BOTH edges, not just below the target. Clamping into [lo+slack, hi−slack] survives any
  // offset smaller than slack in either direction. It is inert for a press in a downtime gap, which
  // is nowhere near either edge, so those keep their exact fire time.
  const hi = starts[idx], lo = idx > 0 ? starts[idx - 1] : 0;
  const slack = Math.min(SLACK_CAP, (hi - lo) / 2);
  const at = ms(Math.min(Math.max(fire, lo + slack), hi - slack));
  // What the sim will actually do with that value: if it lands inside a hardcast in flight, the press
  // waits and goes off at the next APL evaluation — the following cast start. Otherwise (a downtime
  // gap, an instant-AE window) it fires where it is asked.
  // ⚠ One residual ambiguity, deliberately left visible rather than modelled away: when Arcane Blast
  // is GCD-capped (cast < GCD, i.e. above ~50 % haste) there is an idle remainder between the cast's
  // end and the next start. An OFF-GCD on-use can fire inside it; an on-GCD ability cannot. This
  // predicts the on-GCD answer, so `tools/press-verify.mjs` grading an off-GCD trinket in that
  // remainder will report an early slip bounded by the remainder. It is a model/sim gap, not a
  // transcription one — the cast that gets buffed is the same either way.
  // "Inside a cast" is STRICT at the left edge: a press scheduled exactly ON a boundary is evaluated
  // at that boundary, and genapl puts every press AHEAD of the Arcane Blast action, so it goes off
  // before the cast it buffs begins. Treating the boundary as already-casting reported a press at
  // t=0 as firing at 2.5 — the tool's own opener, wrong by a whole cast.
  let held = -1;
  for (let i = 0; i < starts.length; i++) { if (starts[i] < at - EPS && at < spans[i] - EPS) { held = i; break; } }
  return { at, cast: idx, fire: held < 0 ? at : (held + 1 < starts.length ? starts[held + 1] : spans[held]) };
}

// run: { cfg, best, optR } — optR must come from simulate(best.s, cfg, true) so actEff AND casts exist.
// Returns { spec, fire, cast, targets, skipped[], burn }.
//   spec[key] = the SCHEDULE VALUES handed to genapl (see the header — not press times)
//   fire[key] = the times those presses are expected to GO OFF, in MODEL time
//   cast[key] = the INDEX of the cast each press must buff (−1 = past the last cast)
// The last two are what `tools/press-verify.mjs` grades the combat log against. No gate covered
// press-fire timing before 2026-07-27, which is exactly why the floored convention survived so long
// (PHASE12 §6.7).
//
// ⚠ GRADE ON `cast`, REPORT ON `fire`. The model's cast grid and the sim's are not the same grid — by
// 200 s into a buffed plan they differ by ~0.35 s (far more than the 0.08 s a bare stream shows, since
// every haste buff re-quantizes the interval). So a press can land on exactly the right CAST while its
// wall-clock time is a third of a second off, and a time-tolerance verdict would call that a failure.
// The cast index is the thing a duel actually depends on; the time difference is a measurement of the
// lattice, not a transcription defect.
export function planToSpec(run, BUFFS) {
  const { cfg, best, optR } = run;
  const eff = (optR && optR.actEff) || {};
  // The cast grid is not optional here: without it the schedule values would have to be guessed, and
  // guessing is the defect this function was rewritten to remove. Refuse rather than silently degrade.
  if (!optR || !optR.casts) throw new Error(
    'planToSpec: optR.casts is missing — pass simulate(s, cfg, true). The transcription needs the ' +
    'model cast grid to place each press on the cast the model actually buffs (PHASE12 §6.7).');
  const starts = optR.casts.map(c => c.t);
  const spans = optR.casts.map(c => c.t + c.cast);
  const sched = k => (eff[k] || []).slice().sort((a, b) => a - b).map(t => scheduleFor(t, starts, spans));

  const skipped = [];
  const spec = { _prestack: 0 }, fire = {}, cast = {};
  const put = (sk, rows) => {
    if (!rows.length) return;
    spec[sk] = rows.map(r => r.at); fire[sk] = rows.map(r => r.fire); cast[sk] = rows.map(r => r.cast);
  };
  for (const k of Object.keys(best.s || {})) {
    if (UNTRANSCRIBABLE[k]) { if ((eff[k] || []).length) skipped.push(UNTRANSCRIBABLE[k]); continue; }
    const sk = SPEC_KEY[k];
    if (!sk) { skipped.push(k); continue; }
    if (k === "icyVeins") continue;         // handled below (Cold Snap split)
    put(sk, sched(k));
  }
  // Icy Veins: a use that lands before its own cooldown is back must be a Cold Snap reset, and the
  // sim needs the reset scheduled as its own press or the IV simply will not fire. ⚠ The reset test
  // is on the model's FIRE times, not on the schedule values — the schedule values are pulled back by
  // up to SLACK, and comparing those against the cooldown would misclassify a use at the boundary.
  const ivFire = (eff.icyVeins || []).slice().sort((a, b) => a - b);
  if (ivFire.length) {
    const ivOut = [], csOut = [];
    let cd = -1e9;
    for (const t of ivFire) {
      const row = scheduleFor(t, starts, spans);
      if (t < cd - 1e-6) csOut.push(row);
      ivOut.push(row);
      cd = t + BUFFS.icyVeins.cd;
    }
    put("IV", ivOut);
    put("CS", csOut);
  }

  // Phases. Intermissions gate Arcane Blast off; AoE windows cast Arcane Explosion instead and the
  // encounter gets N targets (RULES §9). `targets` is the max target count across AoE windows — the
  // sim has one target list for the whole pull, and extra dummies are inert outside the AE windows
  // because Arcane Blast is single-target.
  const downtime = [], aoe = [];
  let targets = 0;
  for (const s of cfg.segments || []) {
    if (s.type === "intermission") downtime.push([Math.round(s.start), Math.round(s.end)]);
    else if (s.type === "aoe") { aoe.push([Math.round(s.start), Math.round(s.end)]); targets = Math.max(targets, s.targets | 0); }
  }
  if (downtime.length) spec._intermissions = downtime;
  if (aoe.length) spec._aoe = aoe;

  // Burn phases are a MODEL construct (Arcane Blast damage ×N for a window). The sim has no such
  // knob — it would need a real encounter mechanic — so a burn fight cannot be transcribed.
  const burn = (cfg.segments || []).some(s => s.type === "burn");

  return { spec, fire, cast, targets, skipped, burn };
}
