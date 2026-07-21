// Evaluate the MODEL score (simulate().robust/total) for explicit schedules under
// one cfg — to compare what the planner's scorer thinks of hand-built layouts.
//   node evalsched.mjs '{"case":{T,pins,phases,gear,kit}, "scheds":{"name":{key:[t,...]}}}'
import { chromium } from 'playwright-core';
import path from 'path';
import { fileURLToPath } from 'url';
const __dir = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(__dir, '..');
const IN = JSON.parse(process.argv[2]);
const ALL_BUFFS = ["ati", "powerInfusion", "drums", "icyVeins", "skull", "isc", "scb", "arcanePower", "berserking", "mqg", "bloodlust"];
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM || '/opt/pw-browsers/chromium' });
const page = await browser.newPage();
await page.goto('file://' + path.join(REPO, 'index.html'));
const defaults = await page.evaluate(() => ({ gear: window.GOLDEN_DEFAULTS.gear, kit: window.GOLDEN_DEFAULTS.kit }));
const c = IN.case;
const gear = { ...defaults.gear, ...(c.gear || {}) };
const kit = c.kit || defaults.kit;
const out = await page.evaluate(({ c, gear, kit, scheds, ALL_BUFFS }) => {
  const enabled = {}; for (const k of ALL_BUFFS) enabled[k] = kit.includes(k);
  let segments = null;
  if (c.phases) segments = buildSegments(c.phases.map(p => ({ from: p.from, to: p.to, type: p.type, mult: p.mult || 1, targets: p.targets || 0 })), c.T);
  const cfg = { T: c.T, hasteRating: gear.haste || 0, sp: gear.sp, critPct: gear.crit, enabled, fixed: c.pins || {}, warnings: [], coldSnap: gear.coldSnap !== false, segments };
  const res = {};
  for (const name in scheds) {
    const rep = repair(scheds[name], cfg);
    const r = simulate(rep, cfg, true);
    res[name] = { robust: +r.robust.toFixed(1), total: +r.total.toFixed(1), repaired: Object.fromEntries(Object.entries(rep).filter(([, v]) => v.length).map(([k, v]) => [k, v])) };
  }
  return res;
}, { c, gear, kit, scheds: IN.scheds, ALL_BUFFS });
for (const name in out) {
  console.log(`\n${name}: robust=${out[name].robust} total=${out[name].total}`);
  for (const k in out[name].repaired) console.log(`  ${k.padEnd(12)} [${out[name].repaired[k].join(', ')}]`);
}
await browser.close();
