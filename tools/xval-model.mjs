// MODEL-side cross-val: the search-adequacy half of the acceptance test, with NO sim.
// For each fight in a results dir (kit/T/lust/boss + haste set parsed from the committed xval
// tables), re-OPTIMIZE a plan at every haste with the CURRENT engine, cross-score every plan at
// every haste with the model's own scorer, and report every column where a borrowed plan
// model-beats the native — i.e., the search at H failed to find a layout its own objective prefers.
// This is the by-construction half of invariant B: if the model-side matrix is clean and the sim
// metric is model-matched (var0.5 + wall-jitter, TOOLING), the sim-side matrix can only fail on a
// true scorer mis-ranking. Deterministic; minutes for one kit, no rig needed.
//   CHROMIUM=… node tools/xval-model.mjs [resultsDir] [--kit isc,scb] [--class short|…|BOSS]
import { createRequire } from 'module';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const { chromium } = createRequire(path.join(REPO, 'tests', 'package.json'))('playwright-core');
const args = process.argv.slice(2);
const opt = (f) => { const i = args.indexOf(f); return i >= 0 ? args[i + 1] : null; };
const dir = args.filter(a => !a.startsWith('--') && a !== opt('--kit') && a !== opt('--class'))[0] || path.join(REPO, 'tools/xval-results');
const kitF = opt('--kit'), clsF = opt('--class');

const fights = [];
for (const f of fs.readdirSync(dir).filter(f => f.endsWith('.txt')).sort()) {
  const txt = fs.readFileSync(path.join(dir, f), 'utf8');
  const done = txt.match(/^XVAL-DONE .*/m);
  if (!done) continue;
  const kv = Object.fromEntries([...done[0].matchAll(/(\w+)=(\S+)/g)].map(x => [x[1], x[2]]));
  const hdr = txt.split('\n').find(l => l.startsWith('plan\\sim'));
  if (!hdr) continue;
  const hastes = hdr.trim().split(/\s+/).slice(1).map(Number);
  if (kitF && kv.kit !== kitF.replace(',', '+')) continue;
  if (clsF && !kv.class.startsWith(clsF)) continue;
  const bossM = f.match(/^boss-([A-Za-z]+)-/);
  fights.push({ file: f, kit: kv.kit.split('+'), cls: kv.class, T: +kv.T, lust: +kv.lust, boss: bossM ? bossM[1] : null, hastes });
}
console.error(`${fights.length} fights`);

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM || '/opt/pw-browsers/chromium' });
const page = await browser.newPage();
page.on('pageerror', e => { console.error('PAGEERROR', String(e)); process.exit(2); });
await page.goto('file://' + path.join(REPO, 'index.html'));

let totalCols = 0, tables = 0;
for (const t of fights) {
  const r = await page.evaluate(async ({ t }) => {
    const kitKeys = ['icyVeins', t.kit[0], t.kit[1], 'arcanePower', 'berserking', 'bloodlust'];
    const en = {}; for (const k in BUFFS) en[k] = kitKeys.includes(k);
    let segments = null;
    if (t.boss) {
      const p = (window.BOSS_PRESETS || []).find(x => x.name.replace(/[^A-Za-z]/g, '') === t.boss);
      const rows = (p.phases || []).map(ph => ({ from: ph.from, to: ph.to, type: ph.type, mult: ph.mult || 1, targets: ph.targets || 0 }));
      segments = rows.length ? buildSegments(rows, p.T) : null;
    }
    const mk = h => ({ T: t.T, hasteRating: h, sp: 1387, critPct: 38, enabled: en, fixed: { bloodlust: [t.lust] }, warnings: [], coldSnap: true, segments });
    const plans = {};
    for (const h of t.hastes) plans[h] = (await optimizeAsync(mk(h), 14, () => {})).s;
    const defCols = [];
    for (const H of t.hastes) {
      const cfg = mk(H);
      const native = simulate(plans[H], cfg).robust;
      let best = native, bestPh = H;
      for (const h of t.hastes) { const v = simulate(plans[h], cfg).robust; if (v > best + 1e-7) { best = v; bestPh = h; } }
      if (bestPh !== H) defCols.push({ H, bestPh, margin: +((best - native) / 2241).toFixed(3) });
    }
    return { defCols };
  }, { t });
  tables++;
  totalCols += r.defCols.length;
  const s = r.defCols.length ? r.defCols.map(d => `@${d.H}←${d.bestPh}(+${d.margin})`).join(' ') : 'CLEAN';
  console.log(`${t.kit.join('+')} ${t.cls} T=${t.T}: ${s}`);
}
console.log(`\nMODEL-XVAL: ${tables} tables, ${totalCols} model-side borrowed-win columns (bar = 0)`);
await browser.close();
