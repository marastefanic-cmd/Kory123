// BLAST RADIUS of PHASE12 step 1, measured BEFORE changing anything. No sim.
// If the arbiter becomes the tapered per-cast sum, how many EMITTED plans change?
import crypto from 'node:crypto'; import fs from 'node:fs'; import path from 'node:path';
import { loadEngine, ALL_BUFFS } from '/home/user/Kory123/tools/engine-node.mjs';
import { REF } from '/home/user/Kory123/tools/reference-gear.mjs';
const REPO='/home/user/Kory123', IDX='/tmp/index-round.html';
const api=loadEngine(IDX);
const EID=crypto.createHash('sha1').update(fs.readFileSync(IDX)).digest('hex').slice(0,12);
const KW=0.5, taper=(tc,T)=>Math.min(1,Math.max(0,(T+KW-tc)/(2*KW)));
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
    let bi=Hh,bv=-Infinity, bc=Hh,bcv=-Infinity;
    for(const ph of H){
      const r=api.simulate(champ[ph],cfg,true);
      const cnt=r.casts.reduce((a,x)=>a+x.dmg*taper(x.t+x.cast,cfg.T),0);
      if(r.robust>bv+1e-9){bv=r.robust;bi=ph;}
      if(cnt>bcv+1e-9){bcv=cnt;bc=ph;}
    }
    cells++;
    if(bi!==bc){moved++; movers.push(`${kv.kit} ${kv.class} T=${kv.T} @h${Hh}: integral picks plan@${bi} -> cast-sum picks plan@${bc}`);}
  }
}
console.log(`BLAST RADIUS of making the objective the tapered per-cast sum (class stratum, no sim)\n`);
console.log(`  pooled-argmax cells: ${cells}`);
console.log(`  cells where the EMITTED plan CHANGES: ${moved}  (${(100*moved/cells).toFixed(1)}%)\n`);
for(const m of movers.slice(0,14)) console.log('   '+m);
if(movers.length>14) console.log(`   … and ${movers.length-14} more`);
