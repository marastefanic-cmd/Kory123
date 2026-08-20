// Browser probe for the "Which trinkets?" card (shipped 08-07): run a 1-pair comparison on a short
// fight, assert the table renders with a damage figure, and that Load applies the kit and re-runs.
//
//   node tests/kitcmp-probe.mjs        # needs Chromium (PLAYWRIGHT_BROWSERS_PATH); over HTTP, never file://
//
// ⚠ ON-DEMAND, not CI — CI is browser-free by design ("no browser, no rig"); this is the check to run
// after touching the card or anything the comparison path reads (readCfg, runOptimize, buildBuffList).
// The engine-side guarantee is stronger and free: the card is DISPLAY-ONLY, so the engine block must
// be byte-identical whenever it changes — diff <script id="engine-src"> against HEAD.
import { openPage } from './page-open.mjs';

const { page, errors, close } = await openPage();
const fail = async m => { console.error('⛔ ' + m); if (errors.length) console.error('page errors:', errors); await close(); process.exit(1); };

// short fight so the solves are quick
await page.fill('#in-len', '1:00');
// pool: icon + gem only → exactly one pair, one solve
await page.evaluate(() => {
  for (const i of document.querySelectorAll('#kitcmp-pool input')) i.checked = ['isc', 'scb'].includes(i.dataset.kit);
});
await page.click('#btn-kitcmp');
await page.waitForFunction(() => document.querySelector('#kitcmp-box table tbody tr'), null, { timeout: 300000 });
const row = await page.evaluate(() => {
  const tr = document.querySelector('#kitcmp-box tbody tr');
  return { cells: [...tr.querySelectorAll('td')].map(td => td.textContent.trim()), note: document.querySelector('#kitcmp-note').textContent };
});
if (errors.length) await fail('page errors during comparison: ' + errors.join(' | '));
if (!/Icon of the Silver Crescent \+ Serpent-Coil Braid/.test(row.cells[0])) await fail('pair label wrong: ' + row.cells[0]);
if (!/^[\d,]+$/.test(row.cells[1])) await fail('damage cell not numeric: ' + row.cells[1]);
if (row.cells[2] !== 'best') await fail('single row should read "best": ' + row.cells[2]);
console.log('✓ table:', row.cells.join(' · '));

// Load: applies the kit and triggers the main run
await page.click('#kitcmp-box [data-load]');
await page.waitForFunction(() => window.__run && !document.querySelector('#btn-run').disabled, null, { timeout: 300000 });
const st = await page.evaluate(() => ({
  enabled: Object.fromEntries(['isc', 'scb', 'skull', 'mqg', 'ati'].map(k => [k, !!window.__run.cfg.enabled[k]])),
  T: window.__run.cfg.T,
}));
if (errors.length) await fail('page errors during load-run: ' + errors.join(' | '));
if (!(st.enabled.isc && st.enabled.scb && !st.enabled.skull && !st.enabled.mqg && !st.enabled.ati)) await fail('Load did not apply the pair: ' + JSON.stringify(st.enabled));
if (st.T !== 60) await fail('fight length lost: ' + st.T);
console.log('✓ Load applied the pair and the main run solved at T=' + st.T);
await close();
console.log('KITCMP PROBE OK');
