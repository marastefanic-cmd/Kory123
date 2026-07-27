// INTERNAL CONSISTENCY — no sim anywhere. The model computes the SAME quantity two ways:
//   (1) the DISCRETE cast walk: for each Arcane Blast it already knows haste, stacks (=> cast time),
//       AP on/off, SP buffs, crit -> `casts[i].dmg`. Sum it with the kill-window taper.
//   (2) the RATE INTEGRAL over breakpoint spans -> `robust`, which is what actually ranks plans.
// If (1) != (2) the model disagrees with ITSELF, and the disagreement is an upper bound on how much
// of the corpus's deficit could ever be a real modelling result.
import crypto from 'node:crypto'; import fs from 'node:fs'; import path from 'node:path';
import { loadEngine, ALL_BUFFS } from '/home/user/Kory123/tools/engine-node.mjs';
import { REF, plainCastInPage } from '/home/user/Kory123/tools/reference-gear.mjs';
const REPO='/home/user/Kory123', IDX='/tmp/index-round.html';
const api=loadEngine(IDX);
const PLAIN=new Function('GAME','R',`return (${plainCastInPage.toString()})(R);`)(api.GAME,REF);
const EID=crypto.createHash('sha1').update(fs.readFileSync(IDX)).digest('hex').slice(0,12);
const KW=0.5, taper=(tc,T)=>Math.min(1,Math.max(0,(T+KW-tc)/(2*KW)));
const planOf=cfg=>{const k='plan-'+crypto.createHash('sha1').update(JSON.stringify({cfg,engine:EID,restarts:14})).digest('hex').slice(0,24);
  const f=path.join(REPO,'.xval-cache',k+'.json'); return fs.existsSync(f)?JSON.parse(fs.readFileSync(f,'utf8')).s:null;};
const dir=path.join(REPO,'tools/xval-results'); const gaps=[]; let n=0;
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
  for(const simH of H){ const cfg=mk(simH);
    for(const ph of H){
      const r=api.simulate(champ[ph],cfg,true);
      const counted=r.casts.reduce((a,x)=>a+x.dmg*taper(x.t+x.cast,cfg.T),0);
      gaps.push({gapEff:(r.robust-counted)/PLAIN, gapPct:100*(r.robust-counted)/r.robust});
      n++;
    }
  }
}
const g=gaps.map(x=>x.gapEff).sort((a,b)=>a-b), p=gaps.map(x=>Math.abs(x.gapPct)).sort((a,b)=>a-b);
const med=v=>v.length%2?v[(v.length-1)/2]:(v[v.length/2-1]+v[v.length/2])/2;
console.log(`INTERNAL CONSISTENCY of the model with itself — ${n} plan-scorings, NO SIM\n`);
console.log(`  robust(integral) - taperedCastSum, in EFFECTIVE ARCANE BLASTS:`);
console.log(`     min ${g[0].toFixed(3)}   median ${med(g).toFixed(3)}   max ${g[g.length-1].toFixed(3)}   spread ${(g[g.length-1]-g[0]).toFixed(3)} eff ABs`);
console.log(`  |gap| as a % of the score:  median ${med(p).toFixed(4)}%   p90 ${p[Math.floor(0.9*p.length)].toFixed(4)}%   max ${p[p.length-1].toFixed(4)}%`);
console.log(`\n  For scale, the corpus's ENTIRE deficit range is 0.004%-0.380%,`);
console.log(`  and the model's own margins in the deficit columns are ~0.005%-0.07%.`);
