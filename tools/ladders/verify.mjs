import fs from 'fs';
// The ladder JSONs are committed right here beside this script, so read from our own directory.
// (This used to hardcode an absolute scratchpad path containing a SESSION ID: a leak into a
// shareable artifact, and dead the moment the container is reclaimed. `LADDER_DIR=` overrides.)
const dir = process.env.LADDER_DIR || new URL('./', import.meta.url).pathname;
const FILES=[
 {f:'ladder-isc-scb.json',  A:'isc', B:'scb',  lockout:false, sp:['A','B'].filter((_,i)=>['isc','scb'].includes(['isc','scb'][i]))},
 {f:'ladder-isc-skull.json',A:'isc', B:'skull',lockout:true},
 {f:'ladder-isc-mqg.json',  A:'isc', B:'mqg',  lockout:true},
 {f:'ladder-scb-skull.json',A:'scb', B:'skull',lockout:false},
 {f:'ladder-scb-mqg.json',  A:'scb', B:'mqg',  lockout:false},
 {f:'ladder-skull-mqg.json',A:'skull',B:'mqg', lockout:true},
];
const SP=new Set(['isc','scb']);
const parse=k=>{const p=JSON.parse(k);return {iv1:p[0][0],iv2:p[0][1],tA:p[1][0],tB:p[2][0],ap:p[3][0],zerk:p[4][0]};};
const data={};
for(const F of FILES){
  const d=JSON.parse(fs.readFileSync(dir+F.f,'utf8'));
  data[F.f]=d.map(r=>({h:r.h, toolEff:r.toolEff, best:r.top[0].eff,
    opt:r.top.filter(t=>t.eff===r.top[0].eff).map(t=>parse(t.key)),
    optKeys:r.top.filter(t=>t.eff===r.top[0].eff).map(t=>t.key),
    top0:parse(r.top[0].key), top0key:r.top[0].key}));
}
const out=console.log;

out('================ L1: universal skeleton (h>=10) ================');
for(const F of FILES){
  const rungs=data[F.f].filter(r=>r.h>=10);
  let viol=[];
  for(const r of rungs){
    // strict: top0. lenient: any co-optimal key satisfying (iv1<=5 && (straddle or exit))
    const okKey=k=> k.iv1<=5 && ((k.iv2>=20&&k.iv2<58)||k.iv2>=58);
    const strictOK=okKey(r.top0);
    const lenientOK=r.opt.some(okKey);
    if(!strictOK||!lenientOK) viol.push({h:r.h,strictOK,lenientOK,key:r.top0key,all:r.optKeys});
  }
  // transition monotonicity: classify each rung strict-top0 and lenient (prefer exit if any co-opt exits)
  const cls=rungs.map(r=>({h:r.h,
    strict:r.top0.iv2>=58?'exit':(r.top0.iv2>=20?'straddle':'other('+r.top0.iv2+')'),
    lenientExit:r.opt.some(k=>k.iv2>=58),
    lenientStraddle:r.opt.some(k=>k.iv2>=20&&k.iv2<58)}));
  // strict monotonicity: once exit, never straddle again
  let sMono=true,sBad=[];
  let seen=false;
  for(const c of cls){ if(c.strict==='exit') seen=true; else if(seen){sMono=false;sBad.push(c.h);} }
  // lenient: once NO co-opt straddles (pure exit), does straddle ever reappear among co-opts?
  let lMono=true,lBad=[]; let pureExitSeen=false;
  for(const c of cls){ const pureExit=c.lenientExit&&!c.lenientStraddle;
    if(pureExit) pureExitSeen=true; else if(pureExitSeen&&c.lenientStraddle){lMono=false;lBad.push(c.h);} }
  out(F.f);
  out('  iv1<=5 & iv2 straddle/exit violations:', viol.length? JSON.stringify(viol.slice(0,6)) : 'none');
  out('  strict(top0) classes:', cls.map(c=>c.h+':'+(c.strict==='exit'?'E':c.strict==='straddle'?'S':c.strict)).join(' '));
  out('  strict monotone once-exit:', sMono?'YES':'NO, straddle returns at h='+sBad.join(','));
  out('  lenient monotone (pure-exit never re-admits straddle):', lMono?'YES':'NO at h='+lBad.join(','));
}

out(''); out('================ L2: breakpoints (first h where IV2>=58 and stays) ================');
const claimed={'ladder-isc-scb.json':80,'ladder-isc-skull.json':60,'ladder-isc-mqg.json':60,'ladder-scb-skull.json':20,'ladder-scb-mqg.json':20,'ladder-skull-mqg.json':15};
const bp={};
for(const F of FILES){
  const rungs=data[F.f];
  // strict: first h such that top0.iv2>=58 for all h'>=h
  let sBP=null;
  for(let i=0;i<rungs.length;i++){ if(rungs.slice(i).every(r=>r.top0.iv2>=58)){sBP=rungs[i].h;break;} }
  // lenient-exit-available: first h such that for all h'>=h SOME co-opt exits
  let lBP=null;
  for(let i=0;i<rungs.length;i++){ if(rungs.slice(i).every(r=>r.opt.some(k=>k.iv2>=58))){lBP=rungs[i].h;break;} }
  // pure: first h such that for all h'>=h NO co-opt straddles
  let pBP=null;
  for(let i=0;i<rungs.length;i++){ if(rungs.slice(i).every(r=>!r.opt.some(k=>k.iv2>=20&&k.iv2<58))){pBP=rungs[i].h;break;} }
  bp[F.f]={sBP,lBP,pBP};
  out(F.f,'claimed:',claimed[F.f],'| strict top0:',sBP,'| exit-available:',lBP,'| pure-exit (no straddle co-opt):',pBP);
}

out(''); out('================ L3: MQG never in [18,58] ================');
for(const F of FILES){
  if(F.B!=='mqg'&&F.A!=='mqg') continue;
  const get=k=>F.B==='mqg'?k.tB:k.tA;
  let sViol=[],lViol=[];
  for(const r of data[F.f]){
    const inBand=t=>t>=18&&t<=58;
    if(inBand(get(r.top0))) sViol.push({h:r.h,mqg:get(r.top0),key:r.top0key});
    if(r.opt.every(k=>inBand(get(k)))) lViol.push({h:r.h,mqgs:r.opt.map(get),keys:r.optKeys});
  }
  out(F.f);
  out('  top0 in [18,58]:', sViol.length?JSON.stringify(sViol):'none');
  out('  ALL co-opts in [18,58]:', lViol.length?JSON.stringify(lViol):'none');
}

out(''); out('================ L4: ramp-hug band (SP-trinket + AP <=10, IV2 exit) ================');
for(const F of FILES){
  const spSlots=[]; if(SP.has(F.A))spSlots.push('tA'); if(SP.has(F.B))spSlots.push('tB');
  const cond=k=> k.iv2>=58 && k.ap<=10 && spSlots.every(s=>k[s]<=10);
  const sHs=data[F.f].filter(r=>cond(r.top0)).map(r=>r.h);
  const lHs=data[F.f].filter(r=>r.opt.some(cond)).map(r=>r.h);
  const bands=hs=>{ if(!hs.length)return 'NONE'; const all=data[F.f].map(r=>r.h);
    let bs=[],start=hs[0],prev=hs[0];
    for(let i=1;i<hs.length;i++){ const gap=all.indexOf(hs[i])-all.indexOf(prev);
      if(gap>1){bs.push([start,prev]);start=hs[i];} prev=hs[i]; }
    bs.push([start,prev]); return bs.map(b=>b[0]+'..'+b[1]).join(', ');};
  out(F.f,'(SP slots:',spSlots.length?spSlots.join('+'):'none — cluster=AP only',')');
  out('  strict bands:',bands(sHs));
  out('  lenient bands:',bands(lHs));
}

out(''); out('================ L5: h>=240, Zerk outside cluster (<=5 or >=58) ================');
for(const F of FILES){
  let sViol=[],lViol=[];
  for(const r of data[F.f].filter(r=>r.h>=240)){
    const ok=k=>k.zerk<=5||k.zerk>=58;
    if(!ok(r.top0)) sViol.push({h:r.h,zerk:r.top0.zerk,key:r.top0key});
    if(!r.opt.some(ok)) lViol.push({h:r.h,zerks:r.opt.map(k=>k.zerk)});
  }
  out(F.f,'| top0 violations:', sViol.length?JSON.stringify(sViol):'none','| no-co-opt-satisfies:',lViol.length?JSON.stringify(lViol):'none');
}

out(''); out('================ L6: lockout separation >=18 / scb co-press ================');
for(const F of FILES){
  if(F.lockout){
    let sViol=[],lViol=[];
    for(const r of data[F.f]){
      const sep=k=>Math.abs(k.tA-k.tB);
      if(sep(r.top0)<18) sViol.push({h:r.h,sep:sep(r.top0),key:r.top0key});
      if(r.opt.every(k=>sep(k)<18)) lViol.push({h:r.h});
    }
    out(F.f,'LOCKOUT | top0 sep<18:',sViol.length?JSON.stringify(sViol):'none','| all-co-opt sep<18:',lViol.length?JSON.stringify(lViol):'none');
    const seps=data[F.f].map(r=>Math.abs(r.top0.tA-r.top0.tB));
    out('  min sep (top0):',Math.min(...seps),' max:',Math.max(...seps));
  } else {
    const hits=data[F.f].filter(r=>r.opt.some(k=>Math.abs(k.tA-k.tB)<=5));
    const t0hits=data[F.f].filter(r=>Math.abs(r.top0.tA-r.top0.tB)<=5);
    out(F.f,'SCB | rungs w/ co-press<=5s (top0):',t0hits.length,'/',data[F.f].length,'| (any co-opt):',hits.length,'| example:',t0hits.length?JSON.stringify({h:t0hits[0].h,key:t0hits[0].top0key}):(hits.length?JSON.stringify({h:hits[0].h,key:hits[0].optKeys.find(K=>{const k=parse(K);return Math.abs(k.tA-k.tB)<=5;})}):'NONE'));
  }
}

out(''); out('================ V7: toolEff >= top0.eff - 0.15 ================');
for(const F of FILES){
  const bad=data[F.f].filter(r=>!(r.toolEff>=r.best-0.15)).map(r=>({h:r.h,tool:r.toolEff,best:r.best,gap:+(r.best-r.toolEff).toFixed(3)}));
  const worst=data[F.f].reduce((m,r)=>Math.max(m,r.best-r.toolEff),-1);
  out(F.f,'| violations:',bad.length?JSON.stringify(bad):'none','| worst gap:',worst.toFixed(3));
}
