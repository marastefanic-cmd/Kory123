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

// tool key → genapl spec key. Ashtongue, Drums and Power Infusion have no genapl key: the first is a
// passive proc (never a scheduled press) and the other two are raid externals genapl does not emit,
// so a plan using them cannot be transcribed faithfully — `planToSpec` reports them instead of
// silently dropping them (this harness's dominant failure mode is a silent omission that still sims).
export const SPEC_KEY = {
  icyVeins: "IV", arcanePower: "AP", berserking: "Zerk", bloodlust: "BL",
  isc: "Icon", scb: "Gem", skull: "Skull", mqg: "MQG",
};
export const UNTRANSCRIBABLE = { ati: "Ashtongue Talisman", drums: "Drums of Battle", powerInfusion: "Power Infusion" };

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
