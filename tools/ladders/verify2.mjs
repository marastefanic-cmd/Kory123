import fs from 'fs';
const dir='/tmp/claude-0/-home-user-Kory123/e436da46-89c3-50bc-bce2-5b6be890f704/scratchpad/';
const FILES=[
 {f:'ladder-isc-scb.json',  A:'isc', B:'scb'},
 {f:'ladder-isc-skull.json',A:'isc', B:'skull'},
 {f:'ladder-isc-mqg.json',  A:'isc', B:'mqg'},
 {f:'ladder-scb-skull.json',A:'scb', B:'skull'},
 {f:'ladder-scb-mqg.json',  A:'scb', B:'mqg'},
 {f:'ladder-skull-mqg.json',A:'skull',B:'mqg'},
];
const parse=k=>{const p=JSON.parse(k);return {iv1:p[0][0],iv2:p[0][1],tA:p[1][0],tB:p[2][0],ap:p[3][0],zerk:p[4][0]};};
const load=F=>JSON.parse(fs.readFileSync(dir+F.f,'utf8')).map(r=>({h:r.h,toolEff:r.toolEff,best:r.top[0].eff,
  opt:r.top.filter(t=>t.eff===r.top[0].eff).map(t=>({...parse(t.key),key:t.key})),
  top0:parse(r.top[0].key), top0key:r.top[0].key}));
const out=console.log;

out('=== L1 below h=10: what the exempt rungs look like ===');
for(const F of FILES){
  for(const r of load(F).filter(r=>r.h<10)){
    out(F.f,'h='+r.h,'top0:',r.top0key,'co-opts:',r.opt.length);
  }
}

out(''); out('=== L1 detail: IV1 values at h>=10 (all co-opts) ===');
for(const F of FILES){
  const vals=new Set();
  for(const r of load(F).filter(r=>r.h>=10)) r.opt.forEach(k=>vals.add(k.iv1));
  out(F.f,'IV1 values seen:',[...vals].sort((a,b)=>a-b).join(','));
}

out(''); out('=== L3 adversarial: ANY co-opt with MQG in [18,58]? ===');
for(const F of FILES.filter(F=>F.B==='mqg')){
  let hits=[];
  for(const r of load(F)) for(const k of r.opt) if(k.tB>=18&&k.tB<=58) hits.push({h:r.h,mqg:k.tB,key:k.key});
  out(F.f, hits.length?JSON.stringify(hits):'none — MQG outside [18,58] in every recorded co-optimal');
  const all=new Set(); for(const r of load(F)) r.opt.forEach(k=>all.add(k.tB));
  out('  all MQG press times seen:',[...all].sort((a,b)=>a-b).join(','));
}

out(''); out('=== L4 failure autopsy: ladder-isc-mqg full ladder (top0) ===');
{
  const F=FILES[2];
  for(const r of load(F)) out('h='+String(r.h).padStart(3),'IV=['+r.top0.iv1+','+r.top0.iv2+']','isc='+r.top0.tA,'mqg='+r.top0.tB,'AP='+r.top0.ap,'Zerk='+r.top0.zerk,' co-opts:'+r.opt.length, r.opt.length>1?('| alts: '+r.opt.slice(1).map(k=>k.key).join(' ')):'');
}

out(''); out('=== L4 near-miss check for isc-mqg: min over h of max(isc,AP) when IV2 exit ===');
{
  const F=FILES[2];
  for(const r of load(F)){
    const cands=r.opt.filter(k=>k.iv2>=58);
    if(!cands.length) continue;
    const best=cands.reduce((m,k)=>Math.min(m,Math.max(k.tA,k.ap)),1e9);
    if(best<=20) out('h='+r.h,'min max(isc,AP) among exit co-opts:',best);
  }
}

out(''); out('=== L5 context: zerk trajectory (top0) per file ===');
for(const F of FILES){
  const d=load(F);
  out(F.f,':',d.map(r=>r.h+':'+r.top0.zerk).join(' '));
}

out(''); out('=== V7 tightest rungs (gap > 0.10) & rungs where tool BEAT grid ===');
for(const F of FILES){
  for(const r of load(F)){
    const gap=r.best-r.toolEff;
    if(gap>0.10) out(F.f,'h='+r.h,'gap='+gap.toFixed(3),'tool='+r.toolEff,'grid='+r.best);
    if(gap<-0.001) out(F.f,'h='+r.h,'TOOL BEAT GRID by',(-gap).toFixed(3));
  }
}

out(''); out('=== Missed-pattern scan: AP vs SP-trinket co-press; cluster location low vs high haste ===');
for(const F of FILES){
  const spSlot = F.A==='isc'||F.A==='scb' ? 'tA' : (F.B==='scb'?'tB':null);
  const d=load(F);
  if(spSlot){
    const bad=d.filter(r=>!r.opt.some(k=>Math.abs(k[spSlot]-k.ap)<=5));
    out(F.f,'AP within 5s of SP trinket ('+spSlot+') violated at:',bad.length?bad.map(r=>r.h+'(top0 '+spSlot+'='+r.top0[spSlot]+',AP='+r.top0.ap+')').join(' '):'never — AP rides SP trinket at every rung');
  } else {
    out(F.f,'no SP trinket; AP positions:',d.map(r=>r.h+':'+r.top0.ap).join(' '));
  }
}
