// Portfolio EP — the mana-free LAYOUT stat weights (SP / crit / haste) aggregated over a set
// of fights at your real gear. Model route: for each fight, optimize the cooldown layout, then
// finite-difference simulate().total per stat (frozen; + re-optimized haste for breakpoints).
// Aggregation is the portfolio-correct one: SUM the (weighted) absolute derivatives across fights,
// normalize to SP once — NOT an average of per-fight normalized EPs. See docs/EP.md.
//
//   node portfolio-ep.mjs portfolio.json
//
// portfolio.json shape:
//   { "gear": {"sp":1387,"crit":38,"haste":0,"coldSnap":true},
//     "kit":  ["icyVeins","isc","scb","arcanePower","berserking","bloodlust"],
//     "weights": null,                       // or [w1..wN]; null = equal (each fight once)
//     "fights": [ {"name":"..","T":200,"pins":{"bloodlust":[5]},"intermission":[90,130]},
//                 {"name":"..","T":420,"pins":{"bloodlust":[260]},
//                  "phases":[{"type":"intermission","from":"0:15","to":"0:30"},
//                            {"type":"aoe","from":"1:45","to":"2:25","targets":6}]}, ... ] }
import { chromium } from 'playwright-core';
import fs from 'fs'; import path from 'path'; import { fileURLToPath } from 'url';
const __dir = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(__dir, '..');
const CFG = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
const CRIT_RATING_PER_PCT = 22.08, D = 100;

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM || '/opt/pw-browsers/chromium' });
const page = await browser.newPage();
let perr = null; page.on('pageerror', e => (perr = String(e)));
await page.goto('file://' + path.join(REPO, 'index.html'));

const rows = [];
for (const f of CFG.fights) {
  const gear = { ...CFG.gear, ...(f.gear || {}) };
  const kit = f.kit || CFG.kit;
  const r = await page.evaluate(async ({ f, gear, kit, CRIT_RATING_PER_PCT, D }) => {
    const ALL = ["ati","powerInfusion","drums","icyVeins","skull","isc","scb","arcanePower","berserking","mqg","bloodlust"];
    const enabled = {}; for (const k of ALL) enabled[k] = kit.includes(k);
    let segments = null;
    if (f.phases) segments = buildSegments(f.phases.map(p=>({from:p.from,to:p.to,type:p.type,mult:p.mult||1,targets:p.targets||0})), f.T);
    else if (f.intermission) segments = buildSegments([{from:f.intermission[0],to:f.intermission[1],type:'intermission',mult:1,targets:0}], f.T);
    const mk = (dsp,dcr,dha) => ({ T:f.T, hasteRating:(gear.haste||0)+dha, sp:gear.sp+dsp, critPct:gear.crit+dcr, enabled, fixed:f.pins||{}, warnings:[], coldSnap:gear.coldSnap!==false, segments });
    const best = await optimizeAsync(mk(0,0,0),14,()=>{}); const S = best.s;
    const tot = cfg => simulate(S,cfg,false).total;
    const dcr = D/CRIT_RATING_PER_PCT;
    const dSP=(tot(mk(D,0,0))-tot(mk(-D,0,0)))/(2*D);
    const dCR=(tot(mk(0,dcr,0))-tot(mk(0,-dcr,0)))/(2*D);
    const dHA=(tot(mk(0,0,D))-tot(mk(0,0,-D)))/(2*D);
    const hiP=await optimizeAsync(mk(0,0,D),14,()=>{}), hiM=await optimizeAsync(mk(0,0,-D),14,()=>{});
    const dHAr=(simulate(hiP.s,mk(0,0,D),false).total - simulate(hiM.s,mk(0,0,-D),false).total)/(2*D);
    return { base_total: tot(mk(0,0,0)), dSP, dCR, dHA, dHAr };
  }, { f, gear, kit, CRIT_RATING_PER_PCT, D });
  if (perr) { console.error('PAGEERROR on', f.name, ':', perr); await browser.close(); process.exit(2); }
  rows.push({ name: f.name, ...r });
}
await browser.close();

const W = CFG.weights || CFG.fights.map(() => 1);
let SdSP=0, SdCR=0, SdHA=0, SdHAr=0;
rows.forEach((r,i) => { SdSP+=W[i]*r.dSP; SdCR+=W[i]*r.dCR; SdHA+=W[i]*r.dHA; SdHAr+=W[i]*r.dHAr; });
console.log('Per-fight EP (SP = 1.000):');
rows.forEach((r,i) => console.log(
  `  ${r.name.padEnd(30)} w=${W[i]}  Crit=${(r.dCR/r.dSP).toFixed(3)}  Haste=${(r.dHA/r.dSP).toFixed(3)} (reopt ${(r.dHAr/r.dSP).toFixed(3)})`));
console.log('\n=== PORTFOLIO EP (weighted sum of absolute derivatives, normalized to SP) ===');
console.log(`  Spell Power  = 1.000`);
console.log(`  Spell Crit   = ${(SdCR/SdSP).toFixed(3)}   per rating`);
console.log(`  Spell Haste  = ${(SdHA/SdSP).toFixed(3)} frozen / ${(SdHAr/SdSP).toFixed(3)} re-optimized   per rating`);
console.log(`  (spirit / mp5 / mana = separate sustain check — not a layout stat, docs/EP.md)`);
