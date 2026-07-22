// Generate an APLRotation JSON for a MANA-MANAGED "conserve" Arcane rotation,
// used to read the FINITE-MANA stat weights out of wowsims (docs/PLAN.md option B,
// docs/EP.md "layout EP is an infinite-mana ceiling").
//
// The infinite-mana harness (tools/genapl.mjs) spams Arcane Blast forever, so it
// only reflects the time-limited (layout) weights. Real Arcane play is mana-bound
// (pure AB-spam OOMs hard: 420s real-mana 945 DPS vs 2264 infinite), so it CONSERVES:
//   - BURN  (Bloodlust / Arcane Power / Icy Veins up, or scheduled cooldown windows):
//           spam Arcane Blast regardless of mana.
//   - CONSERVE (no burn active): a mana-threshold bang-bang controller — Arcane Blast
//           while mana% is above the conserve threshold, else Frostbolt (cheaper,
//           net mana-positive with JoW/regen). This parks the mage AT THE MANA MARGIN,
//           which is exactly where the value of mana = the AB-over-Frostbolt gap.
//   - Evocation when mana runs deep-low (recover between bursts).
// Cooldowns fire at FIXED scheduled times (APLActionSchedule), same interface as genapl.
//
// The point is the value of mana falls out: adding mana/regen buys AB-over-Frostbolt
// uptime (positive mp5/spirit/int); adding haste only speeds the (mana-capped) filler,
// so it deflates vs the infinite-mana ceiling. Trust-anchor before use (docs/TOOLING.md):
// build -> sim -> confirm it conserves (sane mana curve, not OOM, not pure-AB-spam).
import fs from 'fs';
import { pathToFileURL } from 'url';

const AB = 30451;   // Arcane Blast
const FB = 27072;   // Frostbolt (coef 0.814, FlatCost 330, 3.0s base -> 2.5 w/ Imp Frostbolt)
const EVO = 12051;  // Evocation (channel, 8min cd, restores 15%/tick x4)
// Aura spellIds that mark a "burn" (AB-spam regardless of mana)
const AURA = { BL: 2825, AP: 12042, IV: 12472 };

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
const sched = (times, id) => ({ action: { schedule: { schedule: fmt(times), innerAction: { castSpell: { spellId: id } } } } });
const cast = id => ({ castSpell: { spellId: { spellId: id } } });
const auraActive = spellId => ({ auraIsActive: { auraId: { spellId } } });
const manaPctGe = v => ({ cmp: { op: "OpGe", lhs: { currentManaPercent: {} }, rhs: { const: { val: String(v) } } } });
const manaPctLt = v => ({ cmp: { op: "OpLt", lhs: { currentManaPercent: {} }, rhs: { const: { val: String(v) } } } });
const orv = (...vals) => ({ or: { vals } });
const andv = (...vals) => ({ and: { vals } });

// spec: { IV:[..],AP:[..],CS:[..],Zerk:[..],BL:[..],Icon:[..],Gem:[..],
//         _conserve:0.30, _evo:0.06, _burnWindows:[[a,z],..], _intermission(s),
//         _prestack:N, _noEvo:bool }
export function build(spec){
  const pl = [];
  const conserveThresh = spec._conserve ?? 0.35; // AB while mana% above this, else Frostbolt
  const evoThresh      = spec._evo      ?? 0.06; // Evocate when mana% falls below this
  const prestack = spec._prestack || 1;

  // Cold Snap first so its IV-reset lands before the IV schedule evaluates.
  if (spec.CS?.length)   pl.push(sched(spec.CS, IDS.CS));
  if (spec.BL?.length)   pl.push(sched(spec.BL, IDS.BL));
  if (spec.IV?.length)   pl.push(sched(spec.IV, IDS.IV));
  if (spec.AP?.length)   pl.push(sched(spec.AP, IDS.AP));
  if (spec.Icon?.length) pl.push(sched(spec.Icon, IDS.Icon));
  if (spec.Gem?.length)  pl.push(sched(spec.Gem, IDS.Gem));
  if (spec.Zerk?.length) pl.push(sched(spec.Zerk, IDS.Zerk));

  // "burn" predicate: any burn aura up, OR inside an explicit burn window.
  const burnVals = [auraActive(AURA.BL), auraActive(AURA.AP), auraActive(AURA.IV)];
  const inWindow = ([a,z]) => andv(
    { cmp: { op: "OpGe", lhs: { currentTime: {} }, rhs: { const: { val: `${a}s` } } } },
    { cmp: { op: "OpLt", lhs: { currentTime: {} }, rhs: { const: { val: `${z}s` } } } },
  );
  (spec._burnWindows || []).forEach(w => burnVals.push(inWindow(w)));
  const isBurn = orv(...burnVals);

  // Intermission gate: no casting at all during downtime (boss untargetable).
  let notInter = null;
  const upWin = ([a,z]) => orv(
    { cmp: { op: "OpLt", lhs: { currentTime: {} }, rhs: { const: { val: `${a}s` } } } },
    { cmp: { op: "OpGe", lhs: { currentTime: {} }, rhs: { const: { val: `${z}s` } } } },
  );
  if (spec._intermissions) notInter = andv(...spec._intermissions.map(upWin));
  else if (spec._intermission) notInter = upWin(spec._intermission);
  const gate = cond => notInter ? andv(notInter, ...(Array.isArray(cond)?cond:[cond])) : (Array.isArray(cond)? andv(...cond) : cond);

  // 0) Autocast the EXTERNAL mana cooldowns the sim manages but the APL would otherwise
  //    suppress: Innervate (fires <70% mana for mages) and Mana Tide Totem (6%/tick x4 at
  //    ~40s), plus any consumables. wowsims removes APL-referenced MCDs from this set, so our
  //    scheduled IV/AP/Icon/Gem/Zerk/Evocation are NOT double-fired — only the truly-external
  //    party mana CDs are. Without this the mage is starved of a big chunk of real raid mana.
  if (!spec._noAutocast) pl.push({ action: { autocastOtherCooldowns: {} } });
  // 1) Evocation when deep-low on mana AND not currently burning (never Evocate in Lust).
  if (!spec._noEvo) {
    pl.push({ action: { condition: gate([manaPctLt(evoThresh), { not: { val: isBurn } }]), ...cast(EVO) } });
  }
  // 2) Arcane Blast while burning, OR while mana is above the conserve threshold.
  pl.push({ action: { condition: gate(orv(isBurn, manaPctGe(conserveThresh))), ...cast(AB) } });
  // 3) Frostbolt filler (conserve) — unconditional (only the intermission gate, if any).
  pl.push({ action: notInter ? { condition: notInter, ...cast(FB) } : cast(FB) });

  // prepull AB casts to seed the opener stack (default 1, at -2.3s).
  const prepullActions = [];
  const startT = -2.3 - (prestack - 1) * 1.5;
  for (let i = 0; i < prestack; i++) {
    prepullActions.push({ action: cast(AB), doAtValue: { const: { val: `${(startT + i * 1.5).toFixed(2)}s` } } });
  }
  return { type: "TypeAPL", prepullActions, priorityList: pl };
}

// Run the CLI only when invoked directly (not when imported by a test harness).
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href && process.argv[2]) {
  const spec = JSON.parse(process.argv[2]);
  const out = process.argv[3] || '/dev/stdout';
  fs.writeFileSync(out, JSON.stringify(build(spec), null, 1));
}
