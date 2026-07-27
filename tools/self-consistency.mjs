// INTERNAL CONSISTENCY — no sim anywhere. THE PHASE12 STEP-1 GATE.
//
// The model computes the same fight two ways:
//   (1) the DISCRETE cast walk: for each Arcane Blast it already knows haste, stacks (=> cast time),
//       AP on/off, SP buffs, crit -> `casts[i].dmg`. Sum it with the kill-window taper.
//   (2) the RATE INTEGRAL over breakpoint spans.
// Until 2026-07-27 (2) was `robust` — what ranked every plan — and the two differed by a **median
// 0.2114 % of score, max 1.4263 %** over 2755 plan-scorings, against a corpus whose entire deficit
// range is 0.004–0.380 % and whose ranking margins are ~0.005–0.07 %. The model disagreed with itself
// by ~30x the effect it was being asked to resolve.
//
// ── WHAT THIS NOW GRADES, AND WHY IT IS NOT CIRCULAR ─────────────────────────────────────────────
// `robust` is now the per-cast sum, so "robust vs the cast sum" could be made trivially zero by
// construction. It is not: `robust` is accumulated INSIDE the board walk on every call (the optimizer
// scores with `collect` off), while the number checked against it here is recomputed independently
// from the `casts` array the walk reports. So a zero says the thing that RANKS and the board the tool
// SHOWS are the same quantity — which is exactly the invariant that was broken, and exactly the one a
// future refactor would break again.
//
// The old gap is still printed, from the returned `integral`. It is a diagnostic now, not a verdict —
// but it is the number that made this phase, so it stays visible.
import crypto from 'node:crypto'; import fs from 'node:fs'; import path from 'node:path';
import { loadEngine, ALL_BUFFS } from '/home/user/Kory123/tools/engine-node.mjs';
import { REF, plainCastInPage } from '/home/user/Kory123/tools/reference-gear.mjs';
// ⚠ TWO index.html's, on purpose. `IDX` is the ROUND BLOB: the plan cache keys on its sha1, so it is
// the only file whose plans can be looked up. `ENGINE` is the engine those plans are SCORED with, and
// it defaults to the working tree — otherwise this gate would measure the very engine it is meant to
// check the change against. Plans are inputs here; the scorer is the thing under test.
const REPO='/home/user/Kory123', IDX=process.env.ROUND_INDEX||'/tmp/index-round.html';
const ENGINE=process.env.ENGINE||path.join(REPO,'index.html');
const api=loadEngine(ENGINE);
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
      gaps.push({gapEff:(r.robust-counted)/PLAIN, gapPct:100*(r.robust-counted)/r.robust,
                 oldEff:((r.integral??r.robust)-counted)/PLAIN, oldPct:100*((r.integral??r.robust)-counted)/r.robust});
      n++;
    }
  }
}
const g=gaps.map(x=>x.gapEff).sort((a,b)=>a-b), p=gaps.map(x=>Math.abs(x.gapPct)).sort((a,b)=>a-b);
const og=gaps.map(x=>x.oldEff).sort((a,b)=>a-b), op=gaps.map(x=>Math.abs(x.oldPct)).sort((a,b)=>a-b);
const med=v=>v.length%2?v[(v.length-1)/2]:(v[v.length/2-1]+v[v.length/2])/2;
console.log(`INTERNAL CONSISTENCY of the model with itself — ${n} plan-scorings, NO SIM`);
console.log(`  plans from ${IDX}  ·  scored by ${ENGINE}\n`);
console.log(`  ★ THE GATE — robust(what RANKS) - taperedCastSum(the board the tool SHOWS):`);
console.log(`     min ${g[0].toExponential(2)}   median ${med(g).toExponential(2)}   max ${g[g.length-1].toExponential(2)}   (effective ABs)`);
console.log(`     |gap| as a % of score:  median ${med(p).toExponential(2)}%   max ${p[p.length-1].toExponential(2)}%`);
const PASS = p[p.length-1] < 1e-9;
console.log(`     ${PASS ? '✓ PASS — one objective, to float precision' : '✗ FAIL — the model still disagrees with itself'}\n`);
console.log(`  (diagnostic) the RETIRED rate integral - taperedCastSum, i.e. the gap this phase closed:`);
console.log(`     min ${og[0].toFixed(3)}   median ${med(og).toFixed(3)}   max ${og[og.length-1].toFixed(3)}   spread ${(og[og.length-1]-og[0]).toFixed(3)} eff ABs`);
console.log(`     |gap| as a % of score:  median ${med(op).toFixed(4)}%   p90 ${op[Math.floor(0.9*op.length)].toFixed(4)}%   max ${op[op.length-1].toFixed(4)}%`);
console.log(`\n  For scale, the corpus's ENTIRE deficit range is 0.004%-0.380%,`);
console.log(`  and the model's own margins in the deficit columns are ~0.005%-0.07%.`);
process.exit(PASS ? 0 : 1);
