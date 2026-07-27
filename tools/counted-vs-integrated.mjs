// APPLES-TO-APPLES: score "effective ABs" as the docs DEFINE it — a SUM OVER CASTS — with the SAME
// kill-window taper the integral uses, and ask which account predicts the sim better.
//   effCounted  = sum over board casts of dmg * taper(completion)     <- discrete, tapered
//   effIntegral = robust                                             <- continuous, tapered (ranks today)
// The only difference is discrete-vs-continuous. Pre-registered: the metric is the SAME one that
// falsified full discretization on gear A (mean Pearson r vs sim DPS over a whole column, plus the
// argmax repair/break split), so the two results are directly comparable.
import crypto from 'node:crypto'; import fs from 'node:fs'; import path from 'node:path';
import { loadEngine, ALL_BUFFS } from '/home/user/Kory123/tools/engine-node.mjs';
import { REF } from '/home/user/Kory123/tools/reference-gear.mjs';
const REPO='/home/user/Kory123', IDX='/tmp/index-round.html';
const api=loadEngine(IDX);
const EID=crypto.createHash('sha1').update(fs.readFileSync(IDX)).digest('hex').slice(0,12);
const KW=0.5;
const planOf=cfg=>{const k='plan-'+crypto.createHash('sha1').update(JSON.stringify({cfg,engine:EID,restarts:14})).digest('hex').slice(0,24);
  const f=path.join(REPO,'.xval-cache',k+'.json'); return fs.existsSync(f)?JSON.parse(fs.readFileSync(f,'utf8')).s:null;};
const taper=(tc,T)=>Math.min(1,Math.max(0,(T+KW-tc)/(2*KW)));
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
    for(const ph of H){
      const r=api.simulate(champ[ph],cfg,true);
      I.push(r.robust);
      C.push(r.casts.reduce((a,x)=>a+x.dmg*taper(x.t+x.cast,cfg.T),0));
      S.push(M[ph][simH]);
    }
    cols.push({I,C,S});
  }
}
const pear=(a,b)=>{const n=a.length,ma=a.reduce((x,y)=>x+y,0)/n,mb=b.reduce((x,y)=>x+y,0)/n;
  let s=0,x2=0,y2=0; for(let i=0;i<n;i++){const p=a[i]-ma,q=b[i]-mb;s+=p*q;x2+=p*p;y2+=q*q;} return (x2<=0||y2<=0)?null:s/Math.sqrt(x2*y2);};
const rI=[],rC=[]; for(const c of cols){const a=pear(c.I,c.S),b=pear(c.C,c.S); if(a!==null&&b!==null){rI.push(a);rC.push(b);}}
const mI=rI.reduce((a,b)=>a+b,0)/rI.length, mC=rC.reduce((a,b)=>a+b,0)/rC.length;
let fix=0,dis=0,brk=0,agr=0;
for(const c of cols){const iS=c.S.indexOf(Math.max(...c.S)),iI=c.I.indexOf(Math.max(...c.I)),iC=c.C.indexOf(Math.max(...c.C));
  if(iS!==iI){dis++; if(iC===iS)fix++;} else {agr++; if(iC!==iS)brk++;}}
console.log(`COUNTED vs INTEGRATED effective ABs — ${cols.length} class columns, same taper on both\n`);
console.log(`  mean Pearson r vs sim DPS:  INTEGRATED ${mI.toFixed(4)}   COUNTED ${mC.toFixed(4)}   ${mC>mI?`COUNTED IMPROVES by ${(mC-mI).toFixed(4)}`:`**COUNTED WORSE by ${(mI-mC).toFixed(4)}**`}`);
console.log(`  columns improved ${rC.filter((v,i)=>v>rI[i]).length}/${rI.length}   worsened ${rC.filter((v,i)=>v<rI[i]).length}/${rI.length}`);
console.log(`\n  argmax:  repairs ${fix}/${dis} disagreements (${(100*fix/Math.max(1,dis)).toFixed(1)}%)   BREAKS ${brk}/${agr} agreements (${(100*brk/Math.max(1,agr)).toFixed(1)}%)   net ${fix-brk>=0?'+':''}${fix-brk}`);
