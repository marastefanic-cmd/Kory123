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

// Every `continue` below is a table that will NOT be graded.  Silently dropping them is the
// false-pass defect (DIARY 07-25): the verdict line would then report "0 borrowed-win columns"
// over a set that filtering or crashed runs had emptied.  Count every skip, name it, and make
// "nothing to grade" an ERROR rather than a clean bill of health.
const fights = [], broken = [], filtered = [];
const files = fs.readdirSync(dir).filter(f => f.endsWith('.txt')).sort();
if (files.length === 0) {
  console.error(`ERROR: no *.txt cross-val tables in ${dir} — nothing to grade.`);
  process.exit(2);
}
for (const f of files) {
  const txt = fs.readFileSync(path.join(dir, f), 'utf8');
  const done = txt.match(/^XVAL-DONE .*/m);
  if (!done) { broken.push(`${f}: no XVAL-DONE line (crashed run?)`); continue; }
  const kv = Object.fromEntries([...done[0].matchAll(/(\w+)=(\S+)/g)].map(x => [x[1], x[2]]));
  const hdr = txt.split('\n').find(l => l.startsWith('plan\\sim'));
  if (!hdr) { broken.push(`${f}: no matrix header`); continue; }
  const hastes = hdr.trim().split(/\s+/).slice(1).map(Number);
  if (hastes.some(h => !Number.isFinite(h))) { broken.push(`${f}: unparseable haste in matrix header`); continue; }
  // A malformed XVAL-DONE (the `2>&1` stream merge can interleave into it) yields T=NaN, and a
  // NaN fight scores every plan identically -> it would print CLEAN having never been scored.
  const T = +kv.T, lust = +kv.lust;
  if (!Number.isFinite(T) || !Number.isFinite(lust)) { broken.push(`${f}: T=${kv.T} lust=${kv.lust} — malformed XVAL-DONE`); continue; }
  if (kitF && kv.kit !== kitF.replace(',', '+')) { filtered.push(f); continue; }
  if (clsF && kv.class !== clsF) { filtered.push(f); continue; }   // exact: `--class med` must not silently take medlong too
  // The recorded class is authoritative; the filename is only a fallback.  Detecting bosses from
  // the filename alone re-scores a boss table as a plain fight if it was ever saved under
  // another name — segments=null, and it prints CLEAN on a fight shape that never existed.
  const boss = kv.class && kv.class.startsWith('BOSS:') ? kv.class.slice(5)
             : (f.match(/^boss-([A-Za-z]+)-/) || [])[1] || null;
  fights.push({ file: f, kit: kv.kit.split('+'), cls: kv.class, T, lust, boss, hastes });
}
if (broken.length) {
  console.error(`ERROR: ${broken.length} of ${files.length} table(s) could not be parsed — the grid is INCOMPLETE\n` +
                `and any verdict below would cover fewer cells than it claims:`);
  for (const b of broken) console.error(`  - ${b}`);
  process.exit(2);
}
if (fights.length === 0) {
  const want = [kitF ? `--kit ${kitF}` : null, clsF ? `--class ${clsF}` : null].filter(Boolean).join(' ');
  console.error(`ERROR: ${files.length} table(s) in ${dir}, but \`${want}\` matched NONE.`);
  if (kitF) console.error(`(kit keys are order-sensitive and match the table names, e.g. "isc,scb" not "scb,isc".)`);
  if (clsF) console.error(`(class must match EXACTLY: short|medium|medlong|long|xl|BOSS:<Name> — "med" is not "medium".)`);
  process.exit(2);
}
console.error(`${fights.length} fights${filtered.length ? ` (${filtered.length} filtered out)` : ''}`);

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
      if (!p) throw new Error(`boss preset not found for tag "${t.boss}" (${t.file})`);
      // Two presets (Lurker, Solarian) carry the LEGACY `intermission: [from,to]` field and no
      // `phases`.  Reading `p.phases || []` drops their downtime entirely — for Lurker that is
      // 40s of a 160s fight — and both sides then agree on a fight that does not exist.
      // Normalize exactly as the UI's own preset applier does.
      const rawPhases = p.phases || (p.intermission ? [{ type: "intermission", from: p.intermission[0], to: p.intermission[1] }] : []);
      if (!rawPhases.length && (p.phases || p.intermission)) throw new Error(`preset ${t.boss} has phases that normalized away`);
      const rows = rawPhases.map(ph => ({ from: ph.from, to: ph.to, type: ph.type, mult: ph.mult || 1, targets: ph.targets || 0 }));
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
console.log(`\nMODEL-XVAL: ${tables} tables, ${totalCols} model-side borrowed-win columns (bar = 0)` +
            `  ->  ${totalCols === 0 ? 'CLEAN' : 'FAILS'}`);
await browser.close();
// 0 = graded clean · 1 = graded and failing · 2 = could not grade (see the guards above).
process.exit(totalCols === 0 ? 0 : 1);
