// Generate an APLRotation JSON that spams Arcane Blast and fires cooldowns at
// FIXED scheduled times (via APLActionSchedule). Used to force the tool's
// chosen overlay (or an alternative) into the real wowsims engine.
import fs from 'fs';

const AB = 30451;
// ActionID inner values (spellId for spells, itemId for on-use trinkets)
const IDS = {
  IV:   {spellId:12472},
  AP:   {spellId:12042},
  CS:   {spellId:11958},
  Zerk: {spellId:20554, tag:1},
  BL:   {spellId:2825, tag:-1},
  Icon: {itemId:29370},
  Gem:  {itemId:22044},
};
const fmt = arr => (arr||[]).map(t=>`${t}s`).join(', ');

function sched(times, id){
  return { action: { schedule: { schedule: fmt(times), innerAction: { castSpell: { spellId: id } } } } };
}

// spec: { IV:[..], AP:[..], CS:[..], Zerk:[..], BL:[..], Icon:[..], Gem:[..], _prestack:N }
export function build(spec){
  const pl = [];
  const prestack = spec._prestack ?? 1;  // number of prepull AB casts (stacks); 0 = open cold from 0 stacks
  // Cold Snap first so its IV-reset lands before the IV schedule evaluates.
  if (spec.CS?.length)   pl.push(sched(spec.CS, IDS.CS));
  if (spec.BL?.length)   pl.push(sched(spec.BL, IDS.BL));
  if (spec.IV?.length)   pl.push(sched(spec.IV, IDS.IV));
  if (spec.AP?.length)   pl.push(sched(spec.AP, IDS.AP));
  if (spec.Icon?.length) pl.push(sched(spec.Icon, IDS.Icon));
  if (spec.Gem?.length)  pl.push(sched(spec.Gem, IDS.Gem));
  if (spec.Zerk?.length) pl.push(sched(spec.Zerk, IDS.Zerk));
  // Arcane Blast spam — optionally gated OFF during an intermission window
  // (boss untargetable: no casting, but cooldowns keep ticking).
  let abCond = null;
  const gap = ([a, z]) => ({ or: { vals: [
    { cmp: { op: "OpLt", lhs: { currentTime: {} }, rhs: { const: { val: `${a}s` } } } },
    { cmp: { op: "OpGe", lhs: { currentTime: {} }, rhs: { const: { val: `${z}s` } } } },
  ] } });
  if (spec._intermissions) {            // multiple downtime windows: AB off during ANY of them
    abCond = { and: { vals: spec._intermissions.map(gap) } };
  } else if (spec._intermission) {
    abCond = gap(spec._intermission);
  }
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

if (process.argv[2]) {
  const spec = JSON.parse(process.argv[2]);
  const out = process.argv[3] || '/dev/stdout';
  fs.writeFileSync(out, JSON.stringify(build(spec), null, 1));
}
