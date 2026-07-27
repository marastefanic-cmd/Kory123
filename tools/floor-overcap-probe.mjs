// Does the model under-charge GCD-floor overcap? PRE-REGISTERED before the run:
//  H: in deficit columns, the sim's preferred (borrowed) plan wastes LESS haste to the floor than
//     the model's native pick -> the model is buying haste the floor eats.
//  P1: mean (gcdCappedTime_native - gcdCappedTime_borrowed) > 0, and significantly so.
//  P2: the effect must be CONCENTRATED at simH>200, where the grid-controlled directional bias lives.
//  P3 FALSIFIER: if the same difference appears in columns where the model and sim AGREE, it is a
//     property of borrowed-vs-native plans generally, not of the model's error. Control included.
import crypto from 'node:crypto'; import fs from 'node:fs'; import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadEngine, ALL_BUFFS } from './engine-node.mjs';
import { REF } from './reference-gear.mjs';
const REPO=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
// ⚠ ONE index.html here, deliberately and unchanged by the portability fix: `IDX` is BOTH the round
// blob the plan cache keys on AND the engine that scores the pooled argmax (P1's "model's pick"), so
// splitting it into ROUND_INDEX/ENGINE the way tools/self-consistency.mjs does would change what the
// probe measures. It is only no longer pinned to `/tmp/index-round.html`, a session scratch file that
// dies with the container and took this tool down with it in any fresh clone.
const ROUND=process.env.ROUND_INDEX;
const IDX=ROUND||path.join(REPO,'index.html');
if(!fs.existsSync(IDX)){console.error(`ERROR: ROUND_INDEX=${IDX} does not exist.`);process.exit(2);}
if(!ROUND)console.error('note: no ROUND_INDEX set — scoring with, and keying the plan cache on, the repo\'s own index.html.\n' +
  '      Cached plans solved with a different engine will not be found, so the corpus may be smaller.');
const api=loadEngine(IDX);
const EID=crypto.createHash('sha1').update(fs.readFileSync(IDX)).digest('hex').slice(0,12);
const planOf=cfg=>{const k='plan-'+crypto.createHash('sha1').update(JSON.stringify({cfg,engine:EID,restarts:14})).digest('hex').slice(0,24);
  const f=path.join(REPO,'.xval-cache',k+'.json'); return fs.existsSync(f)?JSON.parse(fs.readFileSync(f,'utf8')).s:null;};
const dir=path.join(REPO,'tools/xval-results');
const rows=[];
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
    const cfg=mk(simH);
    // model's pick = pooled argmax (B1); sim's pick = argmax of the column
    let nat=simH,bv=api.simulate(champ[simH],cfg).robust;
    for(const h of H){if(h===simH)continue;const v=api.simulate(champ[h],cfg).robust; if(v>bv+1e-7){bv=v;nat=h;}}
    let sw=H[0]; for(const h of H) if(M[h][simH]>M[sw][simH]) sw=h;
    const gN=api.simulate(champ[nat],cfg,true).gcdCappedTime, gB=api.simulate(champ[sw],cfg,true).gcdCappedTime;
    // REAL control: in an AGREEMENT column native==sim-winner, so native-vs-itself is 0 BY
    // CONSTRUCTION (the vacuous-control defect). Use the sim s SECOND-ranked rival instead, so
    // both arms are "native vs a plan the sim ranked below it".
    let second=null,sv=-Infinity; for(const h of H){if(h===sw)continue; if(M[h][simH]>sv){sv=M[h][simH];second=h;}}
    const gC=second!==null?api.simulate(champ[second],cfg,true).gcdCappedTime:null;
    rows.push({simH,T:+kv.T,agree:nat===sw,dGcd:gN-gB,dCtl:gC===null?null:gN-gC});
  }
}
// ⛔ ZERO ROWS IS NOT "NO EFFECT". With the wrong round blob every table is skipped for want of a
// cached plan and the probe prints `(none)` on every pre-registered line — an empty set wearing the
// costume of a null result. Refuse instead.
if(!rows.length){console.error('ERROR: 0 columns — the plan cache holds nothing for this engine hash.\n' +
  `       ROUND_INDEX=${IDX}\n` +
  '       Point ROUND_INDEX at the index.html the cached plans were solved with, or re-solve.\n' +
  '       Refusing to test P1/P2/P3 over an empty set.');process.exit(2);}
const stat=(xs)=>{const n=xs.length,m=xs.reduce((a,b)=>a+b,0)/n;const sd=Math.sqrt(xs.reduce((a,b)=>a+(b-m)**2,0)/Math.max(1,n-1));
  return {n,m,sd,se:sd/Math.sqrt(n),t:m/(sd/Math.sqrt(n))};};
const dis=rows.filter(r=>!r.agree), agr=rows.filter(r=>r.agree);
const f=(lbl,xs)=>{if(!xs.length){console.log(lbl.padEnd(34)+' (none)');return;} const s=stat(xs.map(x=>x.dGcd));
  console.log(lbl.padEnd(34)+' n='+String(s.n).padStart(3)+'  mean ΔgcdCapped(native-borrowed) = '+s.m.toFixed(3)+'s  t='+s.t.toFixed(2)+(Math.abs(s.t)>2?'  ★':''));};
console.log('GCD-FLOOR OVERCAP PROBE  (positive Δ = the model\'s pick wastes MORE haste to the floor)\n');
f('P1 all DISAGREEMENT columns',dis);
f('P2   simH<=70',dis.filter(r=>r.simH<=70));
f('P2   70<simH<=200',dis.filter(r=>r.simH>70&&r.simH<=200));
f('P2   simH>200',dis.filter(r=>r.simH>200));
console.log('');
const fc=(lbl,xs)=>{const v=xs.filter(x=>x.dCtl!==null).map(x=>({dGcd:x.dCtl})); f(lbl,v);};
fc('P3 CONTROL: agree, vs 2nd-ranked',agr);
fc('P3   simH>200, vs 2nd-ranked',agr.filter(r=>r.simH>200));
fc('P3   ALL columns, vs 2nd-ranked',rows);

// The CONTRAST — the quantity the P2/P3 split is really about. Neither arm is individually
// significant; the question is whether they differ from each other. Welch two-sample t.
const welch=(a,b)=>{const m=x=>x.reduce((p,q)=>p+q,0)/x.length;
  const v=x=>{const mm=m(x);return x.reduce((p,q)=>p+(q-mm)**2,0)/(x.length-1);};
  const ma=m(a),mb=m(b),va=v(a),vb=v(b),na=a.length,nb=b.length;
  const se=Math.sqrt(va/na+vb/nb);
  const df=(va/na+vb/nb)**2/((va/na)**2/(na-1)+(vb/nb)**2/(nb-1));
  return {d:ma-mb,t:(ma-mb)/se,df};};
console.log('\nCONTRAST — disagreement columns vs their matched control (native vs 2nd-ranked):');
for(const [lbl,f2] of [['all',()=>true],['simH<=70',r=>r.simH<=70],['70<simH<=200',r=>r.simH>70&&r.simH<=200],['simH>200',r=>r.simH>200]]){
  const A=rows.filter(r=>!r.agree&&f2(r)).map(r=>r.dGcd);
  const B=rows.filter(r=>r.agree&&f2(r)&&r.dCtl!==null).map(r=>r.dCtl);
  if(A.length<3||B.length<3){console.log('  '+lbl.padEnd(14)+' (too few)');continue;}
  const w=welch(A,B);
  console.log('  '+lbl.padEnd(14)+' nA='+String(A.length).padStart(3)+' nB='+String(B.length).padStart(3)+
    '  Δ='+w.d.toFixed(3)+'s  t='+w.t.toFixed(2)+'  df='+w.df.toFixed(0)+(Math.abs(w.t)>2?'  ★ SIGNIFICANT':'  not significant'));
}
