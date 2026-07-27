// CAST-TIMING FIDELITY: does the MODEL's board-walk cast count match what wowsims actually casts?
// This is the measurement that decides whether a discrete "effective ABs" count is salvageable.
import crypto from 'node:crypto'; import fs from 'node:fs'; import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { loadEngine, ALL_BUFFS } from '/home/user/Kory123/tools/engine-node.mjs';
import { REF } from '/home/user/Kory123/tools/reference-gear.mjs';
import { planToSpec } from '/home/user/Kory123/sim/planspec.mjs';
import { build } from '/home/user/Kory123/tools/genapl-core.mjs';
const REPO='/home/user/Kory123', IDX='/tmp/index-round.html', RUNNER='/tmp/wowsims-build/tbc-new/runner-ap180';
const api=loadEngine(IDX);
const EID=crypto.createHash('sha1').update(fs.readFileSync(IDX)).digest('hex').slice(0,12);
const planOf=cfg=>{const k='plan-'+crypto.createHash('sha1').update(JSON.stringify({cfg,engine:EID,restarts:14})).digest('hex').slice(0,24);
  const f=path.join(REPO,'.xval-cache',k+'.json'); return fs.existsSync(f)?JSON.parse(fs.readFileSync(f,'utf8')).s:null;};
const T=300, lust=223, simH=0;
const kit=['icyVeins','isc','scb','arcanePower','berserking','bloodlust'];
const en={}; for(const k of ALL_BUFFS) en[k]=kit.includes(k);
const cfg={T,hasteRating:simH,...REF,enabled:en,fixed:{bloodlust:[lust]},warnings:[],coldSnap:true,segments:null};
const AB=30451;   // Arcane Blast
for(const [lbl,h] of [['plan@0',0],['plan@20',20]]){
  const s=planOf({...cfg,hasteRating:h});
  const r=api.simulate(s,cfg,true);
  const {spec}=planToSpec({cfg,best:{s},optR:r},api.BUFFS);
  const apl=`/tmp/cf-${h}.json`; fs.writeFileSync(apl,JSON.stringify(build(spec)));
  const log=`/tmp/cf-${h}.log`;
  try{ execFileSync(RUNNER,['--export',path.join(REPO,'tools/bench/export.json'),'--apl',apl,
    '--dur',String(T),'--var','0','--iter','1','--seed','11','--mana','100000000','--haste',String(simH),'--quiet'],
    {env:{...process.env,SIMLOG:'1'},stdio:['ignore',fs.openSync(log,'w'),fs.openSync(log,'a')],maxBuffer:1<<28});
  }catch{}
  const txt=fs.readFileSync(log,'utf8');
  const casting=[...txt.matchAll(new RegExp(`\\[\\s*([0-9.]+)\\]\\s*\\[Player[^\\]]*\\] Casting \\{SpellID: ${AB}\\}`,'g'))].map(m=>+m[1]);
  // model: casts started before T
  const modelStarts=r.casts.map(c=>c.t);
  console.log(`${lbl}:  MODEL board casts=${r.castCount}   SIM 'Casting AB' events=${casting.length}   delta=${casting.length-r.castCount}`);
  if(casting.length){
    console.log(`        model  last 3 cast STARTS: ${modelStarts.slice(-3).map(x=>x.toFixed(3)).join('  ')}`);
    console.log(`        sim    last 3 cast STARTS: ${casting.slice(-3).map(x=>x.toFixed(3)).join('  ')}`);
    const n=Math.min(modelStarts.length,casting.length);
    let maxAbs=0,sum=0; for(let i=0;i<n;i++){const d=Math.abs(casting[i]-modelStarts[i]); sum+=d; if(d>maxAbs)maxAbs=d;}
    console.log(`        per-cast |sim-model| start drift over ${n} casts: mean ${(sum/n).toFixed(3)}s  max ${maxAbs.toFixed(3)}s`);
  } else console.log('        (no AB Casting lines parsed — check SIMLOG / spell id)');
}
