// Browser probe for the stat-weights tile (shipped 08-07): run a preset, assert the tile renders
// with finite, positive layout-EP values and the infinite-mana caveat.
//
//   node tests/statw-probe.mjs        # on-demand, not CI ("no browser, no rig") — run after touching
//                                     # renderStatWeights or anything its finite differences read.
// The engine-side guarantee is free: the tile is DISPLAY-ONLY (six simulate() calls on cfg variants),
// so the engine block must be byte-identical whenever this changes — diff <script id="engine-src">.
import { openPage } from './page-open.mjs';

const { page, errors, close } = await openPage();
const fail = async m => { console.error('⛔ ' + m); if (errors.length) console.error('page errors:', errors); await close(); process.exit(1); };

await page.evaluate(() => applyState(goldenToState(window.GOLDEN_PRESETS.find(p => p.name === 'T1 · 2:00 lust 0:20'))));
await page.click('#btn-run');
await page.waitForFunction(() => window.__run && !document.getElementById('statw').hidden, null, { timeout: 300000 });
if (errors.length) await fail('page errors: ' + errors.join(' | '));
const txt = await page.evaluate(() => document.getElementById('statw').textContent.replace(/\s+/g, ' '));
const m = txt.match(/crit ([\d.]+)\/rating · haste ([\d.]+)\/rating · int ≈ ([\d.]+)/);
if (!m) await fail('weights line not found: ' + txt.slice(0, 160));
const [crit, haste, int_] = m.slice(1).map(Number);
if (!(crit > 0 && crit < 3 && haste > 0 && haste < 3 && int_ > 0 && int_ < 3)) await fail('weights out of sane range: ' + m[0]);
if (!/Infinite-mana/.test(txt)) await fail('infinite-mana caveat missing');
console.log(`✓ tile: crit ${crit} · haste ${haste} · int ${int_} (per rating, SP=1) with the caveat`);
await close();
console.log('STATW PROBE OK');
