// PHASE7 §2 — the decisive diagnostic. For EVERY borrowed-win column in the cross-val results,
// score the borrowed plan B and the native plan N with the MODEL (the engine's own scorer) at the
// deficit's sim-haste H, and partition:
//   SEARCH-MISS  — model(B,H) > model(N,H): the model agrees B is better at H but the optimizer
//                  didn't find it → fix the SEARCH (anchors / candidate pooling).
//   SCORER-GAP   — model(B,H) ≤ model(N,H) yet B out-simmed N: the effective-AB scorer mis-ranks
//                  the two layouts → fix the SCORER term (deeper, sim-gated).
// Deterministic, no sim needed (it interrogates the model, not wowsims). Also reports the model-best
// plan among ALL the table's candidate layouts at H (any candidate above native = a search miss the
// borrowed-plan comparison alone might understate), and the track-level diff N vs B.
// KT caveat: its sim numbers exclude AoE (genapl gap) — the model-side verdict still stands (a
// search miss is a search miss), but the "B out-sims N" premise is unmeasured until AE emission.
//   CHROMIUM=… node tools/diagnose-deficit.mjs [resultsDir] [--json dossiers.json]
import { createRequire } from 'module';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const { chromium } = createRequire(path.join(REPO, 'tests', 'package.json'))('playwright-core');
const args = process.argv.slice(2);
const jsonIdx = args.indexOf('--json');
const jsonOut = jsonIdx >= 0 ? args[jsonIdx + 1] : null;
const dir = args.filter((a, i) => a !== '--json' && i !== jsonIdx + 1)[0] || path.join(REPO, 'tools/xval-results');

// ── parse every results table (matrix + specs + metadata) ──
const tables = [];
for (const f of fs.readdirSync(dir).filter(f => f.endsWith('.txt')).sort()) {
  const txt = fs.readFileSync(path.join(dir, f), 'utf8');
  const done = txt.match(/^XVAL-DONE .*/m);
  if (!done) continue;
  const kv = Object.fromEntries([...done[0].matchAll(/(\w+)=(\S+)/g)].map(x => [x[1], x[2]]));
  const specs = {};
  for (const m of txt.matchAll(/plan@h(\d+): eff=([\d.]+)\s+(\{.*\})/g)) specs[+m[1]] = JSON.parse(m[3]);
  const lines = txt.split('\n');
  const hdr = lines.findIndex(l => l.startsWith('plan\\sim'));
  if (hdr < 0) continue;
  const cols = lines[hdr].trim().split(/\s+/).slice(1).map(Number);
  const M = {};
  for (let i = hdr + 1; i < lines.length; i++) {
    const t = lines[i].trim(); if (!t || !/^\d/.test(t)) break;
    const parts = t.split(/\s+/).map(Number);
    M[parts[0]] = Object.fromEntries(cols.map((c, k) => [c, parts[1 + k]]));
  }
  const defCols = [];
  for (const c of cols) {
    if (M[c] == null) continue;
    const native = M[c][c];
    let best = native, bestPh = c;
    for (const ph of Object.keys(M).map(Number)) if (M[ph][c] > best) { best = M[ph][c]; bestPh = ph; }
    if (best > native) defCols.push({ simH: c, borrowedH: bestPh, simN: native, simB: best });
  }
  if (!defCols.length) continue;
  const bossM = f.match(/^boss-([A-Za-z]+)-/);
  tables.push({ file: f, kit: kv.kit.split('+'), cls: kv.class, T: +kv.T, lust: +kv.lust,
    boss: bossM ? bossM[1] : null, specs, defCols, hastes: cols });
}
console.error(`${tables.length} tables with deficits; ${tables.reduce((n, t) => n + t.defCols.length, 0)} target columns`);

// ── score everything with the engine ──
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM || '/opt/pw-browsers/chromium' });
const page = await browser.newPage();
let perr = null; page.on('pageerror', e => (perr = String(e)));
await page.goto('file://' + path.join(REPO, 'index.html'));

const dossiers = [];
for (const t of tables) {
  const out = await page.evaluate(({ t }) => {
    // spec (genapl keys, FIRE-time seconds) → engine schedule (buff keys). CS is derived from IV
    // spacing by the engine's own chain logic; _prestack/_intermissions are harness-side.
    const K2B = { IV: 'icyVeins', AP: 'arcanePower', Zerk: 'berserking', Icon: 'isc', Gem: 'scb', Skull: 'skull', MQG: 'mqg', BL: 'bloodlust' };
    const toSched = spec => {
      const s = {};
      for (const k in spec) if (K2B[k] && Array.isArray(spec[k]) && spec[k].length) s[K2B[k]] = spec[k].slice();
      return s;
    };
    let segments = null;
    if (t.boss) {
      const p = (window.BOSS_PRESETS || []).find(x => x.name.replace(/[^A-Za-z]/g, '') === t.boss);
      if (!p) throw new Error('boss preset not found: ' + t.boss);
      const rows = (p.phases || []).map(ph => ({ from: ph.from, to: ph.to, type: ph.type, mult: ph.mult || 1, targets: ph.targets || 0 }));
      segments = rows.length ? buildSegments(rows, p.T) : null;
    }
    const kitKeys = ['icyVeins', t.kit[0], t.kit[1], 'arcanePower', 'berserking', 'bloodlust'];
    const en = {}; for (const k in BUFFS) en[k] = kitKeys.includes(k);
    const plain = (GAME.AB.AVG_BASE_DMG + GAME.AB.COEF * 1387) * (1 + 0.38 * (GAME.CRIT_MULT - 1));
    const res = [];
    for (const d of t.defCols) {
      const cfg = { T: t.T, hasteRating: d.simH, sp: 1387, critPct: 38, enabled: en, fixed: { bloodlust: [t.lust] }, warnings: [], coldSnap: true, segments };
      const scores = {};
      for (const h of t.hastes) scores[h] = simulate(toSched(t.specs[h]), cfg).robust;
      let bestPh = d.simH, bestV = scores[d.simH];
      for (const h of t.hastes) if (scores[h] > bestV + 1e-7) { bestV = scores[h]; bestPh = h; }
      const nSpec = t.specs[d.simH], bSpec = t.specs[d.borrowedH];
      const tracks = [];
      for (const k of new Set([...Object.keys(nSpec), ...Object.keys(bSpec)])) {
        if (k.startsWith('_')) continue;
        if (JSON.stringify(nSpec[k] || null) !== JSON.stringify(bSpec[k] || null)) tracks.push(`${k}: ${JSON.stringify(nSpec[k] || [])} vs ${JSON.stringify(bSpec[k] || [])}`);
      }
      res.push({ simH: d.simH, borrowedH: d.borrowedH,
        modelN: +(scores[d.simH] / plain).toFixed(4), modelB: +(scores[d.borrowedH] / plain).toFixed(4),
        modelBestPh: bestPh, modelBest: +(bestV / plain).toFixed(4), tracks });
    }
    return res;
  }, { t });
  if (perr) { console.error('PAGEERROR', perr); process.exit(2); }
  for (let i = 0; i < t.defCols.length; i++) {
    const d = t.defCols[i], r = out[i];
    const simPct = +((d.simB - d.simN) / d.simN * 100).toFixed(3);
    // verdict vs the sim-winning borrowed plan; anyAbove = ANY candidate layout model-scores above
    // native (a search miss even if the sim-winner itself doesn't)
    const verdict = r.modelB > r.modelN ? 'SEARCH-MISS' : (r.modelBest > r.modelN ? 'SEARCH-MISS(other)' : 'SCORER-GAP');
    dossiers.push({ file: t.file, kit: t.kit.join('+'), cls: t.cls, T: t.T, lust: t.lust,
      simH: d.simH, borrowedH: d.borrowedH, simPct,
      modelN: r.modelN, modelB: r.modelB, modelMargin: +(r.modelB - r.modelN).toFixed(4),
      modelBestPh: r.modelBestPh, modelBest: r.modelBest,
      verdict, kt: /Kaelthas/.test(t.file), tracks: r.tracks });
  }
}
await browser.close();

// ── report ──
const by = v => dossiers.filter(d => d.verdict === v);
console.log(`\n## Deficit dossiers (${dossiers.length} target columns)\n`);
console.log(`- SEARCH-MISS (model prefers B): ${by('SEARCH-MISS').length}`);
console.log(`- SEARCH-MISS(other) (model prefers a 3rd candidate over native): ${by('SEARCH-MISS(other)').length}`);
console.log(`- SCORER-GAP (model prefers native; sim disagrees): ${by('SCORER-GAP').length}\n`);
console.log('| kit | class | T | simH | borrowed | sim Δ% | model N | model B | Δmodel (casts) | verdict |');
console.log('|-----|-------|---|------|----------|--------|---------|---------|----------------|---------|');
for (const d of dossiers.sort((a, b) => b.simPct - a.simPct)) {
  console.log(`| ${d.kit} | ${d.cls} | ${d.T} | ${d.simH} | plan@${d.borrowedH} | ${d.simPct.toFixed(2)} | ${d.modelN.toFixed(3)} | ${d.modelB.toFixed(3)} | ${d.modelMargin >= 0 ? '+' : ''}${d.modelMargin.toFixed(3)} | ${d.verdict}${d.kt ? ' (KT-caveat)' : ''} |`);
}
console.log(`\n### Track-level diffs (worst 15 by sim Δ)\n`);
for (const d of dossiers.slice(0, 15)) {
  console.log(`**${d.kit} ${d.cls} T=${d.T} @sim${d.simH} vs plan@${d.borrowedH}** (${d.verdict}, simΔ ${d.simPct}%, modelΔ ${d.modelMargin}):`);
  for (const tr of d.tracks) console.log(`  - ${tr}`);
}
if (jsonOut) { fs.writeFileSync(jsonOut, JSON.stringify(dossiers, null, 1)); console.log(`\n[dossiers → ${jsonOut}]`); }
