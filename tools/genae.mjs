// AE-spam APL: Arcane Explosion (27082) on GCD, with optional cooldowns scheduled.
// The AoE counterpart to genapl.mjs — pair with `runner --targets N` (duplicates the
// encounter target to N mobs) to value an Arcane-Explosion AoE phase in the real sim.
// Same spec keys as genapl (IV/AP/Icon/Gem/Zerk/BL). See docs/TOOLING.md "Evaluating AoE".
import fs from 'fs';
const AE=27082;
const IDS={ CS:{spellId:11958}, IV:{spellId:12472}, AP:{spellId:12042}, Zerk:{spellId:20554,tag:1}, BL:{spellId:2825,tag:-1}, Icon:{itemId:29370}, Gem:{itemId:22044},
            Skull:{itemId:32483}, MQG:{itemId:19339} };
const fmt=a=>(a||[]).map(t=>`${t}s`).join(', ');
const sched=(times,id)=>({action:{schedule:{schedule:fmt(times),innerAction:{castSpell:{spellId:id}}}}});
// Unlike genapl, this generator has NO intermission gating: it casts straight through downtime.
// A spec carrying _intermissions used to be accepted in silence and produced an INFLATED DPS from
// a clean-looking run, so unsupported keys are now rejected rather than dropped.
const KNOWN=new Set([...Object.keys(IDS),'_abAfter']);
export function build(spec){
  const pl=[];
  const unknown=Object.keys(spec).filter(k=>!KNOWN.has(k));
  if(unknown.length) throw new Error(`genae: unsupported spec key(s) ${unknown.join(', ')} — this generator has no intermission gating and would cast through downtime (use genapl for gated fights)`);
  for(const k in IDS) if(spec[k]!=null && !Array.isArray(spec[k])) throw new Error(`genae: spec.${k} must be an array of fire times (got ${typeof spec[k]})`);
  // CS first so its IV-reset lands before the IV schedule evaluates (same as genapl)
  for(const k of ['CS','IV','AP','Icon','Gem','Skull','MQG','Zerk','BL']) if(spec[k]?.length) pl.push(sched(spec[k],IDS[k]));
  // optional AE→AB handoff: AE only before _abAfter, plain AB from there on (the
  // AoE-phase EXIT — the post-AoE re-ramp is real: AE never applies the AB debuff)
  if(spec._abAfter!=null){
    pl.push({action:{condition:{cmp:{op:'OpLt',lhs:{currentTime:{}},rhs:{const:{val:`${spec._abAfter}s`}}}},castSpell:{spellId:{spellId:AE}}}});
    pl.push({action:{castSpell:{spellId:{spellId:30451}}}});
  } else {
    pl.push({action:{castSpell:{spellId:{spellId:AE}}}});
  }
  return {type:'TypeAPL',prepullActions:[],priorityList:pl};
}
if(process.argv[2]){ fs.writeFileSync(process.argv[3]||'/dev/stdout', JSON.stringify(build(JSON.parse(process.argv[2])),null,1)); }
