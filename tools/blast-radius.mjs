// BLAST RADIUS: how many EMITTED plans move when the arbiter is the per-cast sum instead of the
// RETIRED rate integral? No sim.
//
// ⚠ ORIGINALLY a BEFORE-the-change measurement of PHASE12 step 1, when the cast-sum arm was
// hypothetical. Step 1 has landed, so the cast-sum arm is now just `robust` — but this tool keeps
// recomputing it from the board on purpose, because the OTHER arm (`integral`) is still live and the
// comparison is still the honest question "how far did retiring the integral move the tool?".
//
// ⚠⚠ THE RECOMPUTE CHANGED WITH THE SCORER (PHASE12 §9, user ruling 07-27). This file used to carry
// its own `KW=0.5` symmetric kill taper read at each cast's COMPLETION. That taper is RETIRED from
// the objective. The uniform rule is now, per cast:
//
//     credit = min(1, (nextCut - castStart) / castDuration)          ← one-sided, read at the START
//
// so a cast completing exactly at T earns a FULL cast where the taper paid 0.5. Keeping the taper
// here would have measured a blast radius against a scorer that no longer exists.
// (This corpus is `segments: null`, so the only cut is T — see the assertion at the scoring site.)
import crypto from 'node:crypto'; import fs from 'node:fs'; import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadEngine, ALL_BUFFS } from './engine-node.mjs';
import { REF } from './reference-gear.mjs';
// IDX = the round blob (the plan cache keys on its sha1). ENGINE = the scorer under test, defaulting
// to the working tree — see tools/self-consistency.mjs for why the two must be separable.
const REPO=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
// ⚠ `IDX` used to default to `/tmp/index-round.html`, a session scratch file that dies with the
// container, so this tool crashed on a raw `node:fs` stack trace in any fresh clone. Fall back to the
// repo's own index.html and SAY SO on stderr — a silent fallback would quietly change which cached
// plans are found (the cache keys on this file's sha1), and "no movers" is the most reassuring
// possible wrong answer. Same semantics and same wording as tools/self-consistency.mjs.
const ROUND=process.env.ROUND_INDEX;
const IDX=ROUND||path.join(REPO,'index.html');
if(!fs.existsSync(IDX)){console.error(`ERROR: ROUND_INDEX=${IDX} does not exist.`);process.exit(2);}
if(!ROUND)console.error('note: no ROUND_INDEX set — keying the plan cache on the repo\'s own index.html.\n' +
  '      Cached plans from a different engine will simply not be found, so the corpus may be smaller.');
const ENGINE=process.env.ENGINE||path.join(REPO,'index.html');
if(!fs.existsSync(ENGINE)){console.error(`ERROR: ENGINE=${ENGINE} does not exist.`);process.exit(2);}
const api=loadEngine(ENGINE);
const EID=crypto.createHash('sha1').update(fs.readFileSync(IDX)).digest('hex').slice(0,12);
// The boundary credit, re-derived from the cast's own start and duration (see the header).
const creditOf=(c,T)=>c.cast>1e-9?Math.min(1,Math.max(0,(T-c.t)/c.cast)):0;
const planOf=cfg=>{const k='plan-'+crypto.createHash('sha1').update(JSON.stringify({cfg,engine:EID,restarts:14})).digest('hex').slice(0,24);
  const f=path.join(REPO,'.xval-cache',k+'.json'); return fs.existsSync(f)?JSON.parse(fs.readFileSync(f,'utf8')).s:null;};
const dir=path.join(REPO,'tools/xval-results');
let cells=0, moved=0; const movers=[];
for(const f of fs.readdirSync(dir).filter(x=>x.endsWith('.txt')).sort()){
  const txt=fs.readFileSync(path.join(dir,f),'utf8'); const d=txt.match(/^XVAL-DONE .*/m); if(!d) continue;
  const kv=Object.fromEntries([...d[0].matchAll(/(\w+)=(\S+)/g)].map(x=>[x[1],x[2]]));
  if(String(kv.class).startsWith('BOSS:')) continue;
  const L=txt.split('\n'), hi=L.findIndex(l=>l.startsWith('plan\\sim')); if(hi<0) continue;
  const H=L[hi].trim().split(/\s+/).slice(1).map(Number);
  const kit=['icyVeins',...kv.kit.split('+'),'arcanePower','berserking','bloodlust'];
  const en={}; for(const k of ALL_BUFFS) en[k]=kit.includes(k);
  const mk=h=>({T:+kv.T,hasteRating:h,...REF,enabled:en,fixed:{bloodlust:[+kv.lust]},warnings:[],coldSnap:true,segments:null});
  const champ={}; let ok=true; for(const h of H){const s=planOf(mk(h)); if(!s){ok=false;break;} champ[h]=s;}
  if(!ok) continue;
  for(const Hh of H){
    const cfg=mk(Hh);
    if(cfg.segments) throw new Error('blast-radius: cfg carries segments, so T is not the only cut and '+
      'creditOf() would credit against the wrong boundary. This corpus is meant to be segments:null.');
    let bi=Hh,bv=-Infinity, bc=Hh,bcv=-Infinity;
    for(const ph of H){
      const r=api.simulate(champ[ph],cfg,true);
      const cnt=r.casts.reduce((a,x)=>a+x.dmg*creditOf(x,cfg.T),0);
      // ⚠ read the INTEGRAL from its own field. Since PHASE12 step 1, `robust` IS the cast sum, so
      // taking the integral arm from `robust` would compare the new scorer against itself and report
      // a blast radius of zero — the most reassuring possible wrong answer.
      const integ=r.integral??r.robust;
      if(integ>bv+1e-9){bv=integ;bi=ph;}
      if(cnt>bcv+1e-9){bcv=cnt;bc=ph;}
    }
    cells++;
    if(bi!==bc){moved++; movers.push({
      txt:`${kv.kit} ${kv.class} T=${kv.T} @h${Hh}: integral picks plan@${bi} -> cast-sum picks plan@${bc}`,
      row:{kit:kv.kit,cls:kv.class,T:+kv.T,lust:+kv.lust,h:Hh,integralH:bi,castSumH:bc}});}
  }
}
// ⛔ ZERO CELLS IS NOT "NO BLAST RADIUS". With the wrong round blob the plan cache is keyed on a
// different engine hash, nothing is found, every table is skipped, and the tool would print
// `0 (NaN%)` — an empty set reported as a reassuring null result. Refuse instead.
if(!cells){console.error('ERROR: 0 pooled-argmax cells — the plan cache holds nothing for this engine hash.\n' +
  `       ROUND_INDEX=${IDX}\n` +
  '       Point ROUND_INDEX at the index.html the cached plans were solved with, or re-solve.\n' +
  '       Refusing to report a blast radius over an empty set.');process.exit(2);}
console.log(`BLAST RADIUS of the objective being the CREDITED per-cast sum rather than the RETIRED rate integral (class stratum, no sim)\n`);
console.log(`  plans from ${IDX}  ·  scored by ${ENGINE}`);
console.log(`  pooled-argmax cells: ${cells}`);
console.log(`  cells where the EMITTED plan CHANGES: ${moved}  (${(100*moved/cells).toFixed(1)}%)\n`);
for(const m of movers.slice(0,14)) console.log('   '+m.txt);
if(movers.length>14) console.log(`   … and ${movers.length-14} more`);
// The mover list is the WORK LIST for the sim demonstration (PHASE12 §0.4: deriving that the cast sum
// is right is not the same as showing it), so hand it over as data rather than as prose.
if(process.env.MOVERS_OUT){fs.mkdirSync(path.dirname(path.resolve(process.env.MOVERS_OUT)),{recursive:true});
  fs.writeFileSync(process.env.MOVERS_OUT,JSON.stringify(movers.map(m=>m.row),null,1));
  console.log(`\n  wrote ${movers.length} mover(s) -> ${process.env.MOVERS_OUT}`);}
