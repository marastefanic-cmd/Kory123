// Ad-hoc probe: run the optimizer on arbitrary fight configs and dump the RAW
// schedule (per-key press times) + the copy-as-text windows. Not a test — a
// development scope for eyeballing what the optimizer actually generates.
//   node probe.mjs '<json-cfg-overrides>'   (array of {name,T,pins,gear,kit,intermission,phases})
import { chromium } from 'playwright-core';
import path from 'path';
import { fileURLToPath } from 'url';

const __dir = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(__dir, '..');

const CASES = JSON.parse(process.argv[2] || '[]');

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM || '/opt/pw-browsers/chromium' });
const page = await browser.newPage();
let perr = null;
page.on('pageerror', e => (perr = String(e)));
await page.goto('file://' + path.join(REPO, 'index.html'));

const defaults = await page.evaluate(() => ({ gear: window.GOLDEN_DEFAULTS.gear, kit: window.GOLDEN_DEFAULTS.kit }));
const ALL_BUFFS = ["ati", "powerInfusion", "drums", "icyVeins", "skull", "isc", "scb", "arcanePower", "berserking", "mqg", "bloodlust"];

for (const c of CASES) {
  const gear = { ...defaults.gear, ...(c.gear || {}) };
  const kit = c.kit || defaults.kit;
  const out = await page.evaluate(async ({ c, gear, kit, ALL_BUFFS }) => {
    const enabled = {};
    for (const k of ALL_BUFFS) enabled[k] = kit.includes(k);
    let segments = null;
    if (c.phases) segments = buildSegments(c.phases.map(p => ({ from: p.from, to: p.to, type: p.type, mult: p.mult || 1, targets: p.targets || 0 })), c.T);
    else if (c.intermission) segments = buildSegments([{ from: c.intermission[0], to: c.intermission[1], type: 'intermission', mult: 1, targets: 0 }], c.T);
    const cfg = { T: c.T, hasteRating: gear.haste || 0, sp: gear.sp, critPct: gear.crit, enabled, fixed: c.pins || {}, warnings: [], coldSnap: gear.coldSnap !== false, segments };
    const best = await optimizeAsync(cfg, 14, () => {});
    const r = simulate(best.s, cfg, true);
    const sched = {};
    for (const k in best.s) if (best.s[k].length) sched[k] = best.s[k].map(t => +t.toFixed(2));
    return { sched, robust: +r.robust.toFixed(1), total: +r.total.toFixed(1), val: +best.val.toFixed(1) };
  }, { c, gear, kit, ALL_BUFFS });
  if (perr) { console.error('PAGEERROR on', c.name, ':', perr); await browser.close(); process.exit(2); }
  console.log(`\n=== ${c.name} (T=${c.T}) ===`);
  console.log('  robust=%s total=%s', out.robust, out.total);
  for (const k of ALL_BUFFS) if (out.sched[k]) console.log('  %s: [%s]', k.padEnd(13), out.sched[k].join(', '));
}
await browser.close();
