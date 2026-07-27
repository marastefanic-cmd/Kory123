// CAST-TIMING FIDELITY: does the MODEL's board-walk cast count match what wowsims actually casts?
// This is the measurement that decides whether a discrete "effective ABs" count is salvageable.
import crypto from 'node:crypto'; import fs from 'node:fs'; import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { loadEngine, ALL_BUFFS } from './engine-node.mjs';
import { REF } from './reference-gear.mjs';
import { planToSpec } from '../sim/planspec.mjs';
import { build } from './genapl-core.mjs';
const REPO=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
// ⚠ ONE index.html here, on purpose and unchanged by the portability fix: `IDX` is BOTH the round blob
// the plan cache keys on AND the engine whose board walk is being compared to the sim. Splitting it
// into ROUND_INDEX/ENGINE the way tools/self-consistency.mjs does would change what is measured (the
// walk would come from a different engine than the plans), so it stays one file — but it is no longer
// pinned to `/tmp/index-round.html`, a session scratch file that dies with the container.
const ROUND=process.env.ROUND_INDEX;
const IDX=ROUND||path.join(REPO,'index.html');
if(!fs.existsSync(IDX)){console.error(`ERROR: ROUND_INDEX=${IDX} does not exist.`);process.exit(2);}
if(!ROUND)console.error('note: no ROUND_INDEX set — walking, and keying the plan cache on, the repo\'s own index.html.\n' +
  '      Cached plans solved with a different engine will not be found.');
// The sim arm IS this tool: without the native runner there is nothing to compare the board walk to.
const RUNNER=process.env.RUNNER||'/tmp/wowsims-build/tbc-new/runner-ap180';
if(!fs.existsSync(RUNNER)){console.error(`ERROR: no RUNNER at ${RUNNER}\n` +
  '       This tool compares the model\'s board walk against wowsims\' own combat log, which the\n' +
  '       committed sim/sim.wasm does not expose. Re-run with RUNNER=<path to runner-ap180>\n' +
  '       (docs/TOOLING.md "Building the runner").');process.exit(2);}
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
  // ⛔ A missing cached plan is not an empty fight. Without the round blob the lookup returns null,
  // and simulating null would either throw deep inside the engine or (worse) walk a no-press plan and
  // report a fidelity number for a fight nobody asked about.
  if(!s){console.error(`ERROR: no cached plan for ${lbl} in ${path.join(REPO,'.xval-cache')}.\n` +
    `       ROUND_INDEX=${IDX} — the plan cache keys on this file's sha1.\n` +
    '       Point ROUND_INDEX at the index.html the cached plans were solved with, or re-solve.');process.exit(2);}
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
