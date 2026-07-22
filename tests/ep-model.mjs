// Model-route EP: finite-difference the planner's own effective-damage (simulate().total)
// for one preset, at ±Δ per stat. FROZEN = same optimal schedule, perturbed stats (the
// apples-to-apples match to a frozen-APL sim). REOPT = re-run the optimizer at each
// perturbation (captures haste breakpoints). Normalized to SP=1.
//   node ep-model.mjs "6:00 lust 4:20"
import { chromium } from 'playwright-core';
import path from 'path'; import { fileURLToPath } from 'url';
const __dir = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(__dir, '..');
const CASE = process.argv[2] || '6:00 lust 4:20';
const CRIT_RATING_PER_PCT = 22.08; // level-70 spell crit rating per 1%
const D = 100; // delta in rating / SP

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM || '/opt/pw-browsers/chromium' });
const page = await browser.newPage();
let perr = null; page.on('pageerror', e => (perr = String(e)));
await page.goto('file://' + path.join(REPO, 'index.html'));

const out = await page.evaluate(async ({ CASE, CRIT_RATING_PER_PCT, D }) => {
  const ALL = ["ati","powerInfusion","drums","icyVeins","skull","isc","scb","arcanePower","berserking","mqg","bloodlust"];
  const c = window.GOLDEN_PRESETS.find(p => p.name === CASE);
  if (!c) throw new Error('preset not found: ' + CASE);
  const gear = { ...window.GOLDEN_DEFAULTS.gear, ...(c.gear||{}) };
  const kit = c.kit || window.GOLDEN_DEFAULTS.kit;
  const enabled = {}; for (const k of ALL) enabled[k] = kit.includes(k);
  let segments = null;
  if (c.phases) segments = buildSegments(c.phases.map(p=>({from:p.from,to:p.to,type:p.type,mult:p.mult||1,targets:p.targets||0})), c.T);
  else if (c.intermission) segments = buildSegments([{from:c.intermission[0],to:c.intermission[1],type:'intermission',mult:1,targets:0}], c.T);
  const mkcfg = (dsp,dcr,dha) => ({ T:c.T, hasteRating:(gear.haste||0)+dha, sp:gear.sp+dsp, critPct:gear.crit+dcr, enabled, fixed:c.pins||{}, warnings:[], coldSnap:gear.coldSnap!==false, segments });

  const base = mkcfg(0,0,0);
  const best = await optimizeAsync(base, 14, ()=>{});      // optimal schedule at base
  const S = best.s;
  const tot = cfg => simulate(S, cfg, false).total;         // FROZEN: same schedule S
  const dcr = D / CRIT_RATING_PER_PCT;                       // 100 crit rating -> %
  // central differences, frozen schedule
  const dSP = (tot(mkcfg(+D,0,0)) - tot(mkcfg(-D,0,0)))/(2*D);
  const dCR = (tot(mkcfg(0,+dcr,0)) - tot(mkcfg(0,-dcr,0)))/(2*D);
  const dHA = (tot(mkcfg(0,0,+D)) - tot(mkcfg(0,0,-D)))/(2*D);
  // REOPT haste: re-optimize at ±D haste, compare total of each own optimum
  const hiP = await optimizeAsync(mkcfg(0,0,+D),14,()=>{}); const hiM = await optimizeAsync(mkcfg(0,0,-D),14,()=>{});
  const dHA_reopt = (simulate(hiP.s, mkcfg(0,0,+D), false).total - simulate(hiM.s, mkcfg(0,0,-D), false).total)/(2*D);
  return { base_total: simulate(S,base,false).total, dSP, dCR, dHA, dHA_reopt,
           ep_crit: dCR/dSP, ep_haste: dHA/dSP, ep_haste_reopt: dHA_reopt/dSP,
           schedule_changed_hi: JSON.stringify(hiP.s)!==JSON.stringify(S) || JSON.stringify(hiM.s)!==JSON.stringify(S) };
}, { CASE, CRIT_RATING_PER_PCT, D });
if (perr) { console.error('PAGEERROR:', perr); await browser.close(); process.exit(2); }
await browser.close();
console.log(`Model route — preset "${CASE}"  (Δ=${D} rating/SP, central diff)`);
console.log(`  base effective-damage (total) = ${out.base_total.toFixed(1)}`);
console.log(`  d(total)/dSP    = ${out.dSP.toFixed(4)}`);
console.log(`  d(total)/dCrit  = ${out.dCR.toFixed(4)}  (per crit rating)`);
console.log(`  d(total)/dHaste = ${out.dHA.toFixed(4)}  (frozen)   ${out.dHA_reopt.toFixed(4)}  (re-optimized)`);
console.log(`  EP (SP=1.000):  Crit=${out.ep_crit.toFixed(3)}   Haste_frozen=${out.ep_haste.toFixed(3)}   Haste_reopt=${out.ep_haste_reopt.toFixed(3)}`);
console.log(`  schedule changed under ±${D} haste? ${out.schedule_changed_hi}`);
