// COUNTED vs INTEGRATED — which account of the same fight predicts the sim better?
//
// ⚠⚠ ITS ORIGINAL QUESTION IS GONE (PHASE12 §6.10 + §9, 07-27). This file was written when `robust`
// WAS the rate integral, so it could put the two accounts side by side under one shared taper:
//     effCounted  = sum over board casts of dmg * taper(completion)   <- discrete, tapered
//     effIntegral = robust                                           <- continuous, tapered (RANKED)
// Both of those premises are now false. `robust` is the per-cast sum, so reading the integral arm
// from `robust` would compare the counted sum against ITSELF and report a perfect tie — the most
// reassuring possible wrong answer. And the shared taper no longer exists: `KILL_WINDOW` and the
// symmetric taper are RETIRED from the objective in favour of one uniform boundary credit,
//     credit = min(1, (nextCut - castStart) / castDuration)           <- one-sided, read at the START
// applied at every cut, under which a cast completing exactly at T earns a FULL cast (it earned 0.5).
//
// ── WHAT IT STILL MEASURES (NOT RETIRED, BUT NARROWER) ───────────────────────────────────────────
// The integral arm now reads its OWN field, `r.integral`, which survives as a diagnostic. So the
// comparison is still live and still worth running: **does the LIVE objective (credited per-cast sum)
// track sim DPS better than the RETIRED rate integral did?** That is the retrospective justification
// for the retirement, on the same corpus and the same two statistics as before.
//
// ⛔ WHAT YOU MAY NO LONGER CLAIM FROM IT. The old pre-registration said "the only difference is
// discrete-vs-continuous, so this is directly comparable to the gear-A experiment that falsified full
// discretization". That comparability is **VOID**: the two arms now differ in discretization AND in
// the credit rule at once, so a difference cannot be attributed to either. Treat the numbers as a
// retrospective sanity check on the retirement, never as a re-run of the falsified experiment.
import crypto from 'node:crypto'; import fs from 'node:fs'; import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadEngine, ALL_BUFFS } from './engine-node.mjs';
import { REF } from './reference-gear.mjs';
// ⚠ IDX = the ROUND BLOB, and it is ONLY a cache key (the plan cache hashes it). ENGINE = the scorer
// under test, defaulting to the working tree. They used to be one constant here, which meant this
// tool scored with the ROUND's engine — i.e. it could never see a scorer change at all, and would
// have gone on printing pre-PHASE12 numbers forever. Separated to match self-consistency.mjs and
// blast-radius.mjs, whose headers carry the same warning.
const REPO=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
// ⚠ `IDX` used to default to `/tmp/index-round.html`, a session scratch file that dies with the
// container — a raw `node:fs` stack trace in any fresh clone. Fall back to the repo's own index.html
// and SAY SO on stderr: the fallback silently changes which cached plans are found (the cache keys on
// this file's sha1), and a smaller corpus that is never announced is how a null result gets published.
const ROUND=process.env.ROUND_INDEX;
const IDX=ROUND||path.join(REPO,'index.html');
if(!fs.existsSync(IDX)){console.error(`ERROR: ROUND_INDEX=${IDX} does not exist.`);process.exit(2);}
if(!ROUND)console.error('note: no ROUND_INDEX set — keying the plan cache on the repo\'s own index.html.\n' +
  '      Cached plans from a different engine will simply not be found, so the corpus may be smaller.');
const ENGINE=process.env.ENGINE||path.join(REPO,'index.html');
if(!fs.existsSync(ENGINE)){console.error(`ERROR: ENGINE=${ENGINE} does not exist.`);process.exit(2);}
const api=loadEngine(ENGINE);
const EID=crypto.createHash('sha1').update(fs.readFileSync(IDX)).digest('hex').slice(0,12);
const planOf=cfg=>{const k='plan-'+crypto.createHash('sha1').update(JSON.stringify({cfg,engine:EID,restarts:14})).digest('hex').slice(0,24);
  const f=path.join(REPO,'.xval-cache',k+'.json'); return fs.existsSync(f)?JSON.parse(fs.readFileSync(f,'utf8')).s:null;};
// The boundary credit, re-derived from the cast's own start and duration. This corpus is
// `segments: null`, so the only cut is T — asserted at the scoring site.
const creditOf=(c,T)=>c.cast>1e-9?Math.min(1,Math.max(0,(T-c.t)/c.cast)):0;
const dir=path.join(REPO,'tools/xval-results'); const cols=[];
for(const f of fs.readdirSync(dir).filter(x=>x.endsWith('.txt')).sort()){
  const txt=fs.readFileSync(path.join(dir,f),'utf8'); const d=txt.match(/^XVAL-DONE .*/m); if(!d) continue;
  const kv=Object.fromEntries([...d[0].matchAll(/(\w+)=(\S+)/g)].map(x=>[x[1],x[2]]));
  if(String(kv.class).startsWith('BOSS:')) continue;
  const L=txt.split('\n'), hi=L.findIndex(l=>l.startsWith('plan\\sim')); if(hi<0) continue;
  const H=L[hi].trim().split(/\s+/).slice(1).map(Number); const M={};
  for(let i=hi+1;i<L.length;i++){const p=L[i].trim().split(/\s+/); if(p.length!==H.length+1||!/^\d+$/.test(p[0])){if(Object.keys(M).length)break;else continue;}
    M[+p[0]]=Object.fromEntries(H.map((h,k)=>[h,+p[k+1]]));}
  if(Object.keys(M).length!==H.length) continue;
  const kit=['icyVeins',...kv.kit.split('+'),'arcanePower','berserking','bloodlust'];
  const en={}; for(const k of ALL_BUFFS) en[k]=kit.includes(k);
  const mk=h=>({T:+kv.T,hasteRating:h,...REF,enabled:en,fixed:{bloodlust:[+kv.lust]},warnings:[],coldSnap:true,segments:null});
  const champ={}; let ok=true; for(const h of H){const s=planOf(mk(h)); if(!s){ok=false;break;} champ[h]=s;}
  if(!ok) continue;
  for(const simH of H){
    const cfg=mk(simH); const I=[],C=[],S=[];
    if(cfg.segments) throw new Error('counted-vs-integrated: cfg carries segments, so T is not the only cut '+
      'and creditOf() would credit against the wrong boundary. This corpus is meant to be segments:null.');
    for(const ph of H){
      const r=api.simulate(champ[ph],cfg,true);
      // ⛔ NOT `r.robust` — since PHASE12 step 1 that IS the counted arm, and this loop would be
      // correlating a quantity with itself. The integral survives only under its own name.
      if(r.integral===undefined) throw new Error('counted-vs-integrated: the engine returns no `integral` field. '+
        'The retired rate integral is this tool\'s ENTIRE second arm — without it there is nothing to compare, '+
        'and falling back to `robust` would silently print a perfect tie. Retire this file instead.');
      I.push(r.integral);
      C.push(r.casts.reduce((a,x)=>a+x.dmg*creditOf(x,cfg.T),0));
      S.push(M[ph][simH]);
    }
    cols.push({I,C,S});
  }
}
// ⛔ ZERO COLUMNS IS NOT A TIE. With the wrong round blob nothing is found in the plan cache, every
// table is skipped, and the means below come out `NaN` — which reads as an instrument fault only if
// someone is looking. Refuse over an empty set instead.
if(!cols.length){console.error('ERROR: 0 class columns — the plan cache holds nothing for this engine hash.\n' +
  `       ROUND_INDEX=${IDX}\n` +
  '       Point ROUND_INDEX at the index.html the cached plans were solved with, or re-solve.\n' +
  '       Refusing to correlate two accounts over an empty set.');process.exit(2);}
const pear=(a,b)=>{const n=a.length,ma=a.reduce((x,y)=>x+y,0)/n,mb=b.reduce((x,y)=>x+y,0)/n;
  let s=0,x2=0,y2=0; for(let i=0;i<n;i++){const p=a[i]-ma,q=b[i]-mb;s+=p*q;x2+=p*p;y2+=q*q;} return (x2<=0||y2<=0)?null:s/Math.sqrt(x2*y2);};
const rI=[],rC=[]; for(const c of cols){const a=pear(c.I,c.S),b=pear(c.C,c.S); if(a!==null&&b!==null){rI.push(a);rC.push(b);}}
const mI=rI.reduce((a,b)=>a+b,0)/rI.length, mC=rC.reduce((a,b)=>a+b,0)/rC.length;
let fix=0,dis=0,brk=0,agr=0;
for(const c of cols){const iS=c.S.indexOf(Math.max(...c.S)),iI=c.I.indexOf(Math.max(...c.I)),iC=c.C.indexOf(Math.max(...c.C));
  if(iS!==iI){dis++; if(iC===iS)fix++;} else {agr++; if(iC!==iS)brk++;}}
console.log(`COUNTED (LIVE objective: credited per-cast sum) vs INTEGRATED (RETIRED rate integral) — ${cols.length} class columns`);
console.log(`⚠ the two arms differ in BOTH discretization and credit rule; this is a retrospective check on the`);
console.log(`  retirement, NOT a re-run of the falsified full-discretization experiment (see the header).\n`);
console.log(`  plans keyed on ${IDX}  ·  scored by ${ENGINE}\n`);
console.log(`  mean Pearson r vs sim DPS:  INTEGRATED ${mI.toFixed(4)}   COUNTED ${mC.toFixed(4)}   ${mC>mI?`COUNTED IMPROVES by ${(mC-mI).toFixed(4)}`:`**COUNTED WORSE by ${(mI-mC).toFixed(4)}**`}`);
console.log(`  columns improved ${rC.filter((v,i)=>v>rI[i]).length}/${rI.length}   worsened ${rC.filter((v,i)=>v<rI[i]).length}/${rI.length}`);
console.log(`\n  argmax:  repairs ${fix}/${dis} disagreements (${(100*fix/Math.max(1,dis)).toFixed(1)}%)   BREAKS ${brk}/${agr} agreements (${(100*brk/Math.max(1,agr)).toFixed(1)}%)   net ${fix-brk>=0?'+':''}${fix-brk}`);
