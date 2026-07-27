// WHY IS THERE DRIFT? Bisect it. Start with NOTHING scheduled — no cooldowns at all — where the cast
// stream is pure (base cast time, stacks, GCD). If model and sim agree there, the drift is in buffs
// or press timing. If they DISAGREE there, it is in the base cast/ramp model itself.
//
//   RUNNER=… node tools/drift-bisect.mjs          # ENGINE=<index.html> to bisect a different engine
import fs from 'node:fs'; import path from 'node:path'; import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { loadEngine, ALL_BUFFS } from './engine-node.mjs';
import { REF } from './reference-gear.mjs';
import { build } from './genapl-core.mjs';
const REPO=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const RUNNER=process.env.RUNNER||'/tmp/wowsims-build/tbc-new/runner-ap180';
if(!fs.existsSync(RUNNER)){console.error(`ERROR: no RUNNER at ${RUNNER}\n` +
  '       Bisecting the drift needs wowsims\' own combat log, which the committed sim/sim.wasm does\n' +
  '       not expose. Re-run with RUNNER=<path to runner-ap180> (docs/TOOLING.md "Building the runner").');
  process.exit(2);}
// ⚠ THE ENGINE UNDER TEST IS THE WORKING TREE — and there is no plan cache here, so `ROUND_INDEX` has
// no role: nothing is looked up by sha1, the index is read only for its cast walk. This used to be
// hardcoded to `/tmp/index-round.html`, which both died with the container AND made the tool blind to
// the very cast-timing change it was pointed at (the defect tools/lattice-drift.mjs carries a warning
// about: it reported a byte-identical number across two consecutive fixes).
const ENGINE=process.env.ENGINE||path.join(REPO,'index.html');
if(!fs.existsSync(ENGINE)){console.error(`ERROR: ENGINE=${ENGINE} does not exist.`);process.exit(2);}
if(process.env.ROUND_INDEX&&!process.env.ENGINE)
  console.error(`note: ROUND_INDEX is set but IGNORED here — this tool has no plan cache, so the index is\n` +
    `      purely the engine under test. Using ENGINE=${ENGINE}; set ENGINE=<path> to bisect another.`);
const api=loadEngine(ENGINE);
const AB=30451;
const runSim=(spec,T,haste)=>{
  const apl=`/tmp/db-${Math.abs(JSON.stringify(spec).length)}-${haste}.json`; fs.writeFileSync(apl,JSON.stringify(build(spec)));
  const log=apl+'.log';
  try{ execFileSync(RUNNER,['--export',path.join(REPO,'tools/bench/export.json'),'--apl',apl,'--dur',String(T),
    '--var','0','--iter','1','--seed','11','--mana','100000000','--haste',String(haste),'--quiet'],
    {env:{...process.env,SIMLOG:'1'},stdio:['ignore',fs.openSync(log,'w'),fs.openSync(log,'a')],maxBuffer:1<<28});}catch{}
  const t=fs.readFileSync(log,'utf8');
  return [...t.matchAll(new RegExp(`\\[\\s*([0-9.]+)\\]\\s*\\[Player[^\\]]*\\] Casting \\{SpellID: ${AB}\\}`,'g'))].map(m=>+m[1]);
};
const cases=[
  {n:'BARE: no cooldowns at all, h=0',   en:[],                       spec:{_prestack:0}, h:0},
  {n:'BARE: no cooldowns at all, h=200', en:[],                       spec:{_prestack:0}, h:200},
];
const T=60;
for(const c of cases){
  const en={}; for(const k of ALL_BUFFS) en[k]=c.en.includes(k);
  const cfg={T,hasteRating:c.h,...REF,enabled:en,fixed:{},warnings:[],coldSnap:false,segments:null};
  const r=api.simulate({},cfg,true);
  const sim=runSim(c.spec,T,c.h);
  const mdl=r.casts.map(x=>x.t);
  const n=Math.min(mdl.length,sim.length);
  let sum=0,mx=0; for(let i=0;i<n;i++){const d=Math.abs(sim[i]-mdl[i]); sum+=d; if(d>mx)mx=d;}
  console.log(`\n${c.n}`);
  console.log(`  casts: model ${mdl.length}   sim ${sim.length}`);
  console.log(`  model first 6: ${mdl.slice(0,6).map(x=>x.toFixed(3)).join(' ')}`);
  console.log(`  sim   first 6: ${sim.slice(0,6).map(x=>x.toFixed(3)).join(' ')}`);
  console.log(`  model last 3 : ${mdl.slice(-3).map(x=>x.toFixed(3)).join(' ')}`);
  console.log(`  sim   last 3 : ${sim.slice(-3).map(x=>x.toFixed(3)).join(' ')}`);
  console.log(`  drift over ${n}: mean ${(sum/n).toFixed(4)}s  max ${mx.toFixed(4)}s`);
  // per-cast INTERVALS — the thing that actually accumulates
  const di=[],si=[];
  for(let i=1;i<Math.min(8,mdl.length);i++) di.push((mdl[i]-mdl[i-1]).toFixed(3));
  for(let i=1;i<Math.min(8,sim.length);i++) si.push((sim[i]-sim[i-1]).toFixed(3));
  console.log(`  model intervals: ${di.join(' ')}`);
  console.log(`  sim   intervals: ${si.join(' ')}`);
}
