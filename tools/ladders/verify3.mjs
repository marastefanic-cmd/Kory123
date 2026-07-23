import fs from 'fs';
const dir='/tmp/claude-0/-home-user-Kory123/e436da46-89c3-50bc-bce2-5b6be890f704/scratchpad/';
const parse=k=>{const p=JSON.parse(k);return {iv1:p[0][0],iv2:p[0][1],tA:p[1][0],tB:p[2][0],ap:p[3][0],zerk:p[4][0]};};
const load=f=>JSON.parse(fs.readFileSync(dir+f,'utf8')).map(r=>({h:r.h,toolEff:r.toolEff,best:r.top[0].eff,
  opt:r.top.filter(t=>t.eff===r.top[0].eff).map(t=>({...parse(t.key),key:t.key})),
  top0:parse(r.top[0].key), top0key:r.top[0].key, toolPlan:r.toolPlan}));
const out=console.log;

out('=== Skull press position vs h (top0), and whether skull rides Lust [18,58] ===');
for(const [f,slot] of [['ladder-isc-skull.json','tB'],['ladder-scb-skull.json','tB'],['ladder-skull-mqg.json','tA']]){
  const d=load(f);
  out(f,':',d.map(r=>r.h+':'+r.top0[slot]).join(' '));
  const onLust=d.filter(r=>r.top0[slot]>=18&&r.top0[slot]<=58).map(r=>r.h);
  out('  skull on Lust at h:',onLust.join(',')||'never');
}

out(''); out('=== isc position in isc kits (does the SP trinket ride Lust?) ===');
for(const f of ['ladder-isc-scb.json','ladder-isc-skull.json','ladder-isc-mqg.json']){
  const d=load(f);
  out(f,':',d.map(r=>r.h+':'+r.top0.tA).join(' '));
}
out(''); out('=== scb position in scb kits ===');
for(const [f,slot] of [['ladder-isc-scb.json','tB'],['ladder-scb-skull.json','tA'],['ladder-scb-mqg.json','tA']]){
  const d=load(f);
  out(f,':',d.map(r=>r.h+':'+r.top0[slot]).join(' '));
}

out(''); out('=== Constant offset audit: toolEff - top0.eff per file (rounded 3dp histogram) ===');
for(const f of ['ladder-isc-scb.json','ladder-isc-skull.json','ladder-isc-mqg.json','ladder-scb-skull.json','ladder-scb-mqg.json','ladder-skull-mqg.json']){
  const d=load(f);
  const hist={};
  for(const r of d){const g=(r.toolEff-r.best).toFixed(2); hist[g]=(hist[g]||0)+1;}
  out(f, JSON.stringify(hist));
}

out(''); out('=== toolPlan spot-check where tool beats grid by ~constant: are tool presses off the 5s grid? ===');
for(const [f,hs] of [['ladder-scb-mqg.json',[100,200,300]],['ladder-skull-mqg.json',[100,200,300]],['ladder-scb-skull.json',[200]]]){
  const d=load(f);
  for(const h of hs){ const r=d.find(r=>r.h===h); out(f,'h='+h,'tool:',r.toolPlan,' grid-top0:',r.top0key,' grid eff:',r.best,' tool eff:',r.toolEff); }
}

out(''); out('=== skull-mqg high-h AP oddities (h=220,280,290,295,300) all co-opts ===');
{
  const d=load('ladder-skull-mqg.json');
  for(const h of [215,220,225,275,280,290,295,300]){
    const r=d.find(r=>r.h===h); if(!r) continue;
    out('h='+h, r.opt.map(k=>k.key).join(' '), '| tool:',r.toolPlan);
  }
}

out(''); out('=== isc-skull h=85,90 (AP split from isc) all co-opts ===');
{
  const d=load('ladder-isc-skull.json');
  for(const h of [80,85,90,95]){ const r=d.find(r=>r.h===h); out('h='+h, r.opt.map(k=>k.key).join(' ')); }
}

out(''); out('=== L6 exact min separation incl. co-opts (lockout kits) ===');
for(const [f] of [['ladder-isc-skull.json'],['ladder-isc-mqg.json'],['ladder-skull-mqg.json']]){
  let mn=1e9, where=null;
  for(const r of load(f)) for(const k of r.opt){ const s=Math.abs(k.tA-k.tB); if(s<mn){mn=s;where={h:r.h,key:k.key};} }
  out(f,'min |tA-tB| over all co-opts:',mn,'at',JSON.stringify(where));
}
