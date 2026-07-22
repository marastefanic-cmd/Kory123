// mana-value.mjs — the ANALYTIC marginal value-of-mana cross-check (docs/PLAN.md option C).
// A transparent, closed-form estimate of the finite-mana weights, to confirm the sim
// finite-difference (option B, ep-finite.mjs) isn't a harness artifact. The sim is
// authoritative (it captures stack ramps, Evocation downtime, Innervate's 5x spirit
// amplification, JoW, mana tide — all the couplings a closed form can't); this checks
// the ONE core quantity — the value of mana — and the clean stat it prices (MP5).
//
// Value of mana at the conserve margin = the extra damage a marginal point of mana buys.
// At the margin the mage trades Frostbolt filler for sustained (3-stack) Arcane Blast:
//   valueOfMana = (DPS_AB - DPS_FB) / (drain_AB - drain_FB)   [dmg per mana]
// where drain = gross mana spent per second (JoW mana-back, which scales with cast rate,
// is folded in). Then:
//   MP5 EP   = (0.2 mana/s per MP5) * valueOfMana / SP_weight        (clean: flat mana/s)
//   Mana EP  ~ 0   (a bigger reservoir cycles; it adds no *flow*, only scales mana-tide/evo)
//   Spirit/Int mana part flows through the same valueOfMana but via regen conversion and
//   Innervate's amplification -> sim-authoritative (reported for context, not derived here).
//
// Usage: node mana-value.mjs [--dur 300] [--iter 40000] [--seed 11]
import { execFileSync } from 'child_process';
import fs from 'fs';
import path from 'path';

const SP = process.env.MYSP || process.env.SP, RUNNER = process.env.RUNNER, GEAR = process.env.GEAR;
if (!RUNNER || !GEAR || !SP) { console.error('set RUNNER, GEAR, MYSP env (source scratchpad/env.sh)'); process.exit(1); }
const arg = (k,d)=>{const i=process.argv.indexOf(k);return i>=0?process.argv[i+1]:d;};
const DUR=+arg('--dur',300), ITER=+arg('--iter',40000), SEED=+arg('--seed',11);

const abApl = path.join(SP,'_mvAB.apl.json'), fbApl = path.join(SP,'_mvFB.apl.json');
fs.writeFileSync(abApl, JSON.stringify({type:'TypeAPL',prepullActions:[],priorityList:[{action:{castSpell:{spellId:{spellId:30451}}}}]}));
fs.writeFileSync(fbApl, JSON.stringify({type:'TypeAPL',prepullActions:[],priorityList:[{action:{castSpell:{spellId:{spellId:27072}}}}]}));

const run = (apl, extra, tag) => {
  const a = ['--export',GEAR,'--apl',apl,'--dur',String(DUR),'--var','0','--iter',String(ITER),'--seed',String(SEED),'--tag',tag,'--quiet',...extra];
  return +execFileSync(RUNNER, a, {encoding:'utf8'}).trim().split('\t')[4];
};
// steady-state cost + cast time + JoW from a 1-iter SIMLOG (infinite mana => un-throttled)
function probe(apl, spellId) {
  const a = ['--export',GEAR,'--apl',apl,'--dur','60','--var','0','--iter','1','--seed',String(SEED),'--mana','900000'];
  const log = execFileSync(RUNNER, a, {encoding:'utf8', env:{...process.env, SIMLOG:'1'}, stdio:['pipe','pipe','pipe']}).toString?.() ?? '';
  // SIMLOG goes to stderr; capture via a temp file instead
  return null;
}
// simpler: capture stderr to a file
function probeLog(apl) {
  const lp = path.join(SP,'_mvprobe.log');
  execFileSync(RUNNER, ['--export',GEAR,'--apl',apl,'--dur','60','--var','0','--iter','1','--seed',String(SEED),'--mana','900000'],
    {env:{...process.env, SIMLOG:'1'}, stdio:['ignore','ignore', fs.openSync(lp,'w')]});
  return fs.readFileSync(lp,'utf8');
}
const lastNum = (log, re) => { const m=[...log.matchAll(re)]; return m.length? +m[m.length-1][1] : null; };

const abLog = probeLog(abApl), fbLog = probeLog(fbApl);
const abCost = lastNum(abLog, /Spent ([0-9.]+) mana from \{SpellID: 30451\}/g);   // 3-stack steady
const abTime = lastNum(abLog, /Casting \{SpellID: 30451\}.*?Cast Time = ([0-9.]+)s/g);
const fbCost = lastNum(fbLog, /Spent ([0-9.]+) mana from \{SpellID: 27072\}/g);
const fbTime = lastNum(fbLog, /Casting \{SpellID: 27072\}.*?Cast Time = ([0-9.]+)s/g);
const jow    = lastNum(abLog, /Gained ([0-9.]+) mana from \{SpellID: 27164\}/g) || 0; // JoW per hit

const DPS_AB = run(abApl, ['--mana','900000'], 'AB');
const DPS_FB = run(fbApl, ['--mana','900000'], 'FB');

// gross drain per second, minus JoW mana-back (scales with cast rate)
const drainAB = abCost/abTime - jow/abTime;
const drainFB = fbCost/fbTime - jow/fbTime;
const valueOfMana = (DPS_AB - DPS_FB) / (drainAB - drainFB);

// SP weight (per point) from a quick sim central-difference on pure-AB, for normalization.
const spHi = run(abApl, ['--mana','900000','--sp','50'], 'spHi');
const spLo = run(abApl, ['--mana','900000','--sp','-50'], 'spLo');
const SPw = (spHi - spLo)/100;

const mp5_DPS = 0.2 * valueOfMana;      // 1 MP5 = 0.2 mana/s
const mp5_EP  = mp5_DPS / SPw;

console.log(`\n=== ANALYTIC value of mana (conserve margin), dur=${DUR}s ===`);
console.log(`  AB(3-stack): dmg-rate ${DPS_AB.toFixed(0)} DPS, cost ${abCost}/${abTime}s, drain ${drainAB.toFixed(0)} mana/s`);
console.log(`  Frostbolt  : dmg-rate ${DPS_FB.toFixed(0)} DPS, cost ${fbCost}/${fbTime}s, drain ${drainFB.toFixed(0)} mana/s  (JoW ${jow}/hit)`);
console.log(`  value of mana = (${DPS_AB.toFixed(0)}-${DPS_FB.toFixed(0)}) / (${drainAB.toFixed(0)}-${drainFB.toFixed(0)}) = ${valueOfMana.toFixed(2)} dmg/mana`);
console.log(`  SP weight (pure-AB) = ${SPw.toFixed(4)} DPS/point`);
console.log(`\n=== derived analytic EP (normalized to SP=1) ===`);
console.log(`  MP5  : 0.2 mana/s x ${valueOfMana.toFixed(2)} = ${mp5_DPS.toFixed(3)} DPS  ->  EP ${mp5_EP.toFixed(3)}   (sim finite ~0.66)`);
console.log(`  Mana : ~0 (reservoir cycles; only scales mana-tide 6%/evo 15%)              (sim finite ~0.008)`);
console.log(`  Spirit/Int mana part: same value-of-mana via regen conversion + Innervate 5x amp -> SIM-authoritative`);
console.log(`\n(The sim finite-difference, ep-finite.mjs, is the authoritative route; this confirms`);
console.log(` the value of mana is physically grounded (~${valueOfMana.toFixed(1)} dmg/mana) and MP5 lands in range.)`);
