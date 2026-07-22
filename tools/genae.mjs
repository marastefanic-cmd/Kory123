// AE-spam APL: Arcane Explosion (27082) on GCD, with optional cooldowns scheduled.
// The AoE counterpart to genapl.mjs — pair with `runner --targets N` (duplicates the
// encounter target to N mobs) to value an Arcane-Explosion AoE phase in the real sim.
// Same spec keys as genapl (IV/AP/Icon/Gem/Zerk/BL). See docs/TOOLING.md "Evaluating AoE".
import fs from 'fs';
const AE=27082;
const IDS={ IV:{spellId:12472}, AP:{spellId:12042}, Zerk:{spellId:20554,tag:1}, BL:{spellId:2825,tag:-1}, Icon:{itemId:29370}, Gem:{itemId:22044} };
const fmt=a=>(a||[]).map(t=>`${t}s`).join(', ');
const sched=(times,id)=>({action:{schedule:{schedule:fmt(times),innerAction:{castSpell:{spellId:id}}}}});
export function build(spec){
  const pl=[];
  for(const k of ['IV','AP','Icon','Gem','Zerk','BL']) if(spec[k]?.length) pl.push(sched(spec[k],IDS[k]));
  pl.push({action:{castSpell:{spellId:{spellId:AE}}}});
  return {type:'TypeAPL',prepullActions:[],priorityList:pl};
}
if(process.argv[2]){ fs.writeFileSync(process.argv[3]||'/dev/stdout', JSON.stringify(build(JSON.parse(process.argv[2])),null,1)); }
