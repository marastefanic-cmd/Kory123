// PRESS OFFSET: where does a scheduled press actually FIRE — in the model, and in wowsims?
//
//   RUNNER=… node tools/press-offset-probe.mjs     # ENGINE=<index.html> to probe a different engine
import fs from 'node:fs'; import path from 'node:path'; import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { loadEngine, ALL_BUFFS } from './engine-node.mjs';
import { REF } from './reference-gear.mjs';
import { build } from './genapl-core.mjs';
const REPO=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const RUNNER=process.env.RUNNER||'/tmp/wowsims-build/tbc-new/runner-ap180';
if(!fs.existsSync(RUNNER)){console.error(`ERROR: no RUNNER at ${RUNNER}\n` +
  '       The sim arm reads "Aura gained" out of wowsims\' combat log, which the committed\n' +
  '       sim/sim.wasm does not expose. Re-run with RUNNER=<path to runner-ap180>\n' +
  '       (docs/TOOLING.md "Building the runner").');process.exit(2);}
// ⚠ THE ENGINE UNDER TEST IS THE WORKING TREE — no plan cache is involved here, so `ROUND_INDEX` has
// no role: nothing is looked up by sha1 and the index is read only for `actEff`. Hardcoding the round
// blob both died with the container and pointed the probe at the OLD engine after every press-timing
// fix, which is the exact blindness tools/lattice-drift.mjs warns about.
const ENGINE=process.env.ENGINE||path.join(REPO,'index.html');
if(!fs.existsSync(ENGINE)){console.error(`ERROR: ENGINE=${ENGINE} does not exist.`);process.exit(2);}
if(process.env.ROUND_INDEX&&!process.env.ENGINE)
  console.error(`note: ROUND_INDEX is set but IGNORED here — this tool has no plan cache, so the index is\n` +
    `      purely the engine under test. Using ENGINE=${ENGINE}; set ENGINE=<path> to probe another.`);
const api=loadEngine(ENGINE);
// bare cast boundaries at h=0: 0, 2.5, 4.667, 6.5, 8.0, 9.5, 11.0, 12.5 ...
// press ON a boundary (11) vs just AFTER one (11.1) vs mid-cast (10)
for(const press of [11, 12.5, 10, 11.1, 9.6]){
  const spec={_prestack:0, Zerk:[press]};
  const apl=`/tmp/d4-${press}.json`; fs.writeFileSync(apl,JSON.stringify(build(spec))); const log=apl+'.log';
  try{ execFileSync(RUNNER,['--export',path.join(REPO,'tools/bench/export.json'),'--apl',apl,'--dur','60',
    '--var','0','--iter','1','--seed','11','--mana','100000000','--haste','0','--quiet'],
    {env:{...process.env,SIMLOG:'1'},stdio:['ignore',fs.openSync(log,'w'),fs.openSync(log,'a')],maxBuffer:1<<28});}catch{}
  const t=fs.readFileSync(log,'utf8');
  const gain=[...t.matchAll(/\[\s*([0-9.]+)\][^\n]*Aura gained: \{SpellID: 20554/g)].map(m=>+m[1]);
  const en={}; for(const k of ALL_BUFFS) en[k]=(k==='berserking');
  const cfg={T:60,hasteRating:0,...REF,enabled:en,fixed:{},warnings:[],coldSnap:false,segments:null};
  const r=api.simulate({berserking:[press]},cfg,true);
  const eff=(r.actEff&&r.actEff.berserking)||[];
  console.log(`press intent ${String(press).padEnd(5)}  model actEff=${eff[0]!==undefined?eff[0].toFixed(3):'?'}   sim aura gained=${gain[0]!==undefined?gain[0].toFixed(3):'(none)'}   offset=${eff[0]!==undefined&&gain[0]!==undefined?(gain[0]-eff[0]).toFixed(3):'?'}s`);
}
