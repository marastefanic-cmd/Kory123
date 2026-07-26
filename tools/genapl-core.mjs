// Generate an APLRotation JSON that spams Arcane Blast and fires cooldowns at
// FIXED scheduled times (via APLActionSchedule). Used to force the tool's
// chosen overlay (or an alternative) into the real wowsims engine.
//
// ★★★ THE MODEL DOES NOT PREPULL — OPEN COLD (0 stacks), ALWAYS. ★★★
// `_prestack` DEFAULTS TO 0 (cold open) to MATCH the model (RULES §3: "the mage opens COLD, 0 stacks
// at the first Arcane Blast — no prestack modeled"). A prepull cast is scheduled at a FIXED wall-time
// (−2.3s), which does NOT scale with haste, so at higher haste it finishes early and mistimes the
// opener ramp — this made a fixed-rotation, infinite-mana haste sweep LOSE a cast as haste rose
// (h130=53 → h140=52), a physically-impossible result that blocked the Phase-6 cross-val. Cold open
// removes it and restores strict haste-monotonicity (docs/archive/07-phase6-xval-run.md §4.7). DO NOT set _prestack>0 for
// any sim that is compared to the model. The only legitimate use of _prestack>0 is a deliberate
// ramp-isolation experiment that is NOT compared to the cold-open model — and even then, know that
// the fixed prepull time makes it haste-non-monotone.
//
// ── THIS FILE IS THE PURE CORE ─────────────────────────────────────────────────────────────────
// No node imports, no side effects: it is imported BOTH by `tools/genapl.mjs` (the CLI the sim
// harness drives) AND by the in-page sim verifier that ships to the website. One APL builder, one
// convention — if the harness and the page ever disagreed about what a plan means, the in-page
// "verify" button would be verifying something the terminal never runs. Keep it dependency-free.
const AB = 30451;
const AE = 27082;   // Arcane Explosion — cast during `_aoe` windows (see the AB-spam block)
// ActionID inner values (spellId for spells, itemId for on-use trinkets)
const IDS = {
  IV:   {spellId:12472},
  AP:   {spellId:12042},
  CS:   {spellId:11958},
  Zerk: {spellId:20554, tag:1},
  BL:   {spellId:2825, tag:-1},
  Icon: {itemId:29370},
  Gem:  {itemId:22044},
  Skull:{itemId:32483},   // Skull of Gul'dan (+175 haste on-use, spell 40396)
  MQG:  {itemId:19339},   // Mind Quickening Gem (+330 haste on-use, spell 23723)
};
const fmt = arr => (arr||[]).map(t=>`${t}s`).join(', ');

function sched(times, id){
  return { action: { schedule: { schedule: fmt(times), innerAction: { castSpell: { spellId: id } } } } };
}

// spec: { IV:[..], AP:[..], CS:[..], Zerk:[..], BL:[..], Icon:[..], Gem:[..], _prestack:N }
// Every key `build` understands.  A key NOT in this set used to be dropped in total silence, which is
// this harness's dominant failure mode wearing a new hat: `{IcyVeins:[20]}` (or `icon`, or any typo)
// emitted a well-formed APL with that cooldown simply ABSENT, the sim ran happily, printed a plausible
// DPS, and every comparison built on it was wrong with nothing anywhere saying so.
const SPEC_KEYS = new Set(['IV','AP','CS','Zerk','BL','Icon','Gem','Skull','MQG',
                           '_prestack','_intermission','_intermissions','_aoe']);
const TIME_KEYS = ['IV','AP','CS','Zerk','BL','Icon','Gem','Skull','MQG'];

export function build(spec){
  if (!spec || typeof spec !== 'object' || Array.isArray(spec)) throw new Error(`genapl: spec must be an object (got ${Array.isArray(spec) ? 'array' : typeof spec})`);
  const unknown = Object.keys(spec).filter(k => !SPEC_KEYS.has(k));
  if (unknown.length) throw new Error(`genapl: unknown spec key(s): ${unknown.join(', ')} — known: ${[...SPEC_KEYS].join(' ')}. Refusing to emit an APL that silently omits a cooldown.`);
  // A non-finite press time formats straight through `${t}s` ("nulls", "NaNs") into the schedule
  // string, where it is worth nothing but looks like a scheduled press in the emitted JSON.
  for (const k of TIME_KEYS) {
    if (spec[k] === undefined || spec[k] === null) continue;
    if (!Array.isArray(spec[k])) throw new Error(`genapl: spec.${k} must be an array of seconds (got ${typeof spec[k]})`);
    const bad = spec[k].filter(t => !Number.isFinite(t));
    if (bad.length) throw new Error(`genapl: spec.${k} has non-numeric press time(s): ${JSON.stringify(bad)}`);
  }
  const pl = [];
  const prestack = spec._prestack ?? 0;  // COLD OPEN by default (model never prepulls — see header ★★★). >0 only for non-model ramp-isolation experiments.
  // ★★★ The rule that is easiest to violate by accident and impossible to see in the output: a
  // prepull's fixed −2.3s is haste-blind, so a model-compared haste sweep goes non-monotone.
  if (prestack > 0) console.error(`genapl: WARNING — _prestack=${prestack} (NOT a cold open). Valid ONLY for a ramp-isolation experiment; NEVER for a sim compared to the model (RULES §3, TOOLING ★★★).`);
  // Cold Snap first so its IV-reset lands before the IV schedule evaluates.
  if (spec.CS?.length)   pl.push(sched(spec.CS, IDS.CS));
  if (spec.BL?.length)   pl.push(sched(spec.BL, IDS.BL));
  if (spec.IV?.length)   pl.push(sched(spec.IV, IDS.IV));
  if (spec.AP?.length)   pl.push(sched(spec.AP, IDS.AP));
  if (spec.Icon?.length) pl.push(sched(spec.Icon, IDS.Icon));
  if (spec.Gem?.length)  pl.push(sched(spec.Gem, IDS.Gem));
  if (spec.Skull?.length) pl.push(sched(spec.Skull, IDS.Skull));
  if (spec.MQG?.length)  pl.push(sched(spec.MQG, IDS.MQG));
  if (spec.Zerk?.length) pl.push(sched(spec.Zerk, IDS.Zerk));
  // Arcane Blast spam — optionally gated OFF during an intermission window
  // (boss untargetable: no casting, but cooldowns keep ticking).
  // AoE phases (`_aoe: [[a,z],…]`): cast Arcane EXPLOSION (27082) inside the window instead of
  // AB — pair with `runner --targets N` so the sim values the window at N mobs (AB is
  // single-target, so the extra dummies are inert outside the window; AE never applies the AB
  // debuff, so the exit re-ramp is real — matches the model, RULES §9). Before this, an AoE
  // window was simmed as DOWNTIME and the model's AoE credit was unmeasurable (the KT caveat).
  let abCond = null;
  const gap = ([a, z]) => ({ or: { vals: [
    { cmp: { op: "OpLt", lhs: { currentTime: {} }, rhs: { const: { val: `${a}s` } } } },
    { cmp: { op: "OpGe", lhs: { currentTime: {} }, rhs: { const: { val: `${z}s` } } } },
  ] } });
  const inside = ([a, z]) => ({ and: { vals: [
    { cmp: { op: "OpGe", lhs: { currentTime: {} }, rhs: { const: { val: `${a}s` } } } },
    { cmp: { op: "OpLt", lhs: { currentTime: {} }, rhs: { const: { val: `${z}s` } } } },
  ] } });
  const offWins = [ ...(spec._intermissions || (spec._intermission ? [spec._intermission] : [])),
                    ...(spec._aoe || []) ];   // AB is off during downtime AND during AE windows
  if (spec._aoe?.length) {
    const aeCond = spec._aoe.length === 1 ? inside(spec._aoe[0]) : { or: { vals: spec._aoe.map(inside) } };
    pl.push({ action: { condition: aeCond, castSpell: { spellId: { spellId: AE } } } });
  }
  if (offWins.length) abCond = { and: { vals: offWins.map(gap) } };
  pl.push({ action: abCond
    ? { condition: abCond, castSpell: { spellId: { spellId: AB } } }
    : { castSpell: { spellId: { spellId: AB } } } });
  // prepull AB casts: default 1 (at -2.3s). More casts pre-stack the AB debuff so the
  // opener starts at 3 stacks (removes the ramp), to isolate ramp vs lust-alignment.
  const prepullActions = [];
  const startT = -2.3 - (prestack - 1) * 1.5;
  for (let i = 0; i < prestack; i++) {
    prepullActions.push({ action: { castSpell: { spellId: { spellId: AB } } }, doAtValue: { const: { val: `${(startT + i * 1.5).toFixed(2)}s` } } });
  }
  return {
    type: "TypeAPL",
    prepullActions,
    priorityList: pl,
  };
}
export { SPEC_KEYS, TIME_KEYS };
