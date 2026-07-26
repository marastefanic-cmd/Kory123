// Plan → genapl spec. THE TRANSCRIPTION CONVENTION, in one place.
//
// This is the step that decides *what the sim is actually asked to execute*, and it is the step the
// cross-val harness got wrong once at a cost of −1.5% on a KT plan (xval.mjs P7.15). It is therefore
// shared verbatim by the terminal harness and the in-page "verify in the sim" button: if the two ever
// transcribed a plan differently, the button would be verifying a plan the tool never printed.
//
// ★★★ EMIT = FIRE TIMES, FLOORED. `best.s` holds press INTENTS; what the tool PRINTS and what the
// model SCORES are FIRE times — the intent snapped forward to the next cast boundary
// (`simulate(s, cfg, true).actEff`). genapl schedules every cooldown UNCONDITIONALLY (only Arcane
// Blast is gated on `_intermissions`), so feeding INTENTS makes the sim press mid-downtime and buff a
// burn the model never charged. A duel is only a duel if the sim executes the plan the tool prints.
// Flooring matches index.html's display convention exactly (a press at floor(F) ≤ F snaps to the same
// boundary).
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

// run: { cfg, best, optR } — optR must come from simulate(best.s, cfg, true) so actEff exists.
// Returns { spec, targets, skipped[] }.
export function planToSpec(run, BUFFS) {
  const { cfg, best, optR } = run;
  const eff = (optR && optR.actEff) || {};
  const at = k => (eff[k] || []).slice().sort((a, b) => a - b).map(Math.floor);

  const skipped = [];
  const spec = { _prestack: 0 };
  for (const k of Object.keys(best.s || {})) {
    if (UNTRANSCRIBABLE[k]) { if ((eff[k] || []).length) skipped.push(UNTRANSCRIBABLE[k]); continue; }
    const sk = SPEC_KEY[k];
    if (!sk) { skipped.push(k); continue; }
    if (k === "icyVeins") continue;         // handled below (Cold Snap split)
    const times = at(k);
    if (times.length) spec[sk] = times;
  }
  // Icy Veins: a use that lands before its own cooldown is back must be a Cold Snap reset, and the
  // sim needs the reset scheduled as its own press or the IV simply will not fire.
  const ivs = at("icyVeins");
  if (ivs.length) {
    const ivOut = [], csOut = [];
    let cd = -1e9;
    for (const t of ivs) {
      if (t < cd - 1e-6) csOut.push(t);
      ivOut.push(t);
      cd = t + BUFFS.icyVeins.cd;
    }
    spec.IV = ivOut;
    if (csOut.length) spec.CS = csOut;
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

  return { spec, targets, skipped, burn };
}
