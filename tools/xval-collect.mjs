// Collect the cross-val results from a directory of xval output files into the acceptance ledger.
// PHASE7 upgrade: reports EVERY borrowed-plan-wins column per table (the single-worst-cell summary
// hid ~130 columns behind the 35 worst cells), flags length-robust loci (a kit×sim-haste that
// violates on a long/xl fight — least likely to be boundary quantization), recomputes monoDip
// (invariant A) and diagonal dominance (invariant B) from the raw matrices, and cross-checks each
// file's reported diagWorst. The bar is ZERO deficit columns (ACCEPTANCE invariant B) — nothing here
// grades or excuses a violation; the locus tags are data for the diagnostic, not verdicts.
//   node tools/xval-collect.mjs <dir> [--json targets.json]
// --json writes the full target set (every borrowed-win column, with the native + borrowed plan
// specs parsed from the file) for tools/diagnose-deficit.mjs to consume.
import fs from 'fs';
import path from 'path';
const args = process.argv.slice(2);
const jsonIdx = args.indexOf('--json');
const jsonOut = jsonIdx >= 0 ? args[jsonIdx + 1] : null;
const dir = args.filter((a, i) => a !== '--json' && i !== jsonIdx + 1)[0] || '/home/user/Kory123/tools/xval-results';

const tables = [];
for (const f of fs.readdirSync(dir).filter(f => f.endsWith('.txt')).sort()) {
  const txt = fs.readFileSync(path.join(dir, f), 'utf8');
  const done = txt.match(/^XVAL-DONE .*/m);
  if (!done) { tables.push({ file: f, err: 'no XVAL-DONE (crashed?)' }); continue; }
  const kv = Object.fromEntries([...done[0].matchAll(/(\w+)=(\S+)/g)].map(x => [x[1], x[2]]));
  // plan specs: "  plan@h30: eff=226.369  {json}"
  const specs = {};
  for (const m of txt.matchAll(/plan@h(\d+): eff=([\d.]+)\s+(\{.*\})/g)) specs[+m[1]] = { eff: +m[2], spec: JSON.parse(m[3]) };
  // the DPS matrix
  const lines = txt.split('\n');
  const hdr = lines.findIndex(l => l.startsWith('plan\\sim'));
  if (hdr < 0) { tables.push({ file: f, err: 'no matrix' }); continue; }
  const cols = lines[hdr].trim().split(/\s+/).slice(1).map(Number);
  const M = {};
  for (let i = hdr + 1; i < lines.length; i++) {
    const t = lines[i].trim(); if (!t || !/^\d/.test(t)) break;
    const parts = t.split(/\s+/).map(Number);
    M[parts[0]] = Object.fromEntries(cols.map((c, k) => [c, parts[1 + k]]));
  }
  const planHastes = Object.keys(M).map(Number);
  // invariant A — monoDip (every row non-decreasing)
  let mono = 0, monoAt = '';
  for (const ph of planHastes) for (let k = 1; k < cols.length; k++) {
    const a = M[ph][cols[k - 1]], b = M[ph][cols[k]], d = (a - b) / a;
    if (d > mono) { mono = d; monoAt = `row@${ph}: ${a}->${b}`; }
  }
  // invariant B — EVERY borrowed-plan-wins column (not just the worst cell)
  const defCols = [];
  for (const c of cols) {
    if (M[c] == null) continue;
    const native = M[c][c];
    let best = native, bestPh = c;
    for (const ph of planHastes) if (M[ph][c] > best) { best = M[ph][c]; bestPh = ph; }
    if (best > native) defCols.push({ simH: c, borrowedH: bestPh, native, borrowed: best, pct: +((best - native) / native * 100).toFixed(3) });
  }
  defCols.sort((a, b) => b.pct - a.pct);
  const rep = txt.match(/diagWorst=([\d.]+)%/);
  const worst = defCols.length ? defCols[0].pct : 0;
  const mismatch = rep && Math.abs(parseFloat(rep[1]) - +worst.toFixed(2)) > 0.02;
  tables.push({ file: f, kit: kv.kit, class: kv.class, T: +kv.T, lust: +kv.lust, seed: +kv.seed,
    mono: +(mono * 100).toFixed(4), monoAt, defCols, worst, mismatch, specs,
    boss: /^BOSS:/.test(kv.class || '') });
}

const band = t => t.boss ? t.class.replace('BOSS:', 'boss:') : t.class;
const isLongish = t => !t.boss && (t.class === 'long' || t.class === 'xl');
// length-robust loci: kit × sim-haste that violates on a long/xl fight
const robustLoci = new Set();
for (const t of tables) if (!t.err && isLongish(t)) for (const d of t.defCols) robustLoci.add(`${t.kit}@${d.simH}`);

const ok = tables.filter(t => !t.err);
const clean = ok.filter(t => t.defCols.length === 0);
const deficit = ok.filter(t => t.defCols.length > 0);
const errs = tables.filter(t => t.err);
const monoBad = ok.filter(t => t.mono > 0.05);
const totalCols = ok.reduce((n, t) => n + t.defCols.length, 0);
const mismatches = ok.filter(t => t.mismatch);

console.log(`## Cross-val ledger (${ok.length} tables, ${totalCols} borrowed-win columns)\n`);
console.log(`- **Invariant A (monoDip):** ${monoBad.length ? '⚠ ' + monoBad.length + ' tables with monoDip>0.05% — REGRESSION: ' + monoBad.map(t => t.file).join(', ') : 'all ≤0.05% ✓'}`);
console.log(`- **Invariant B (diagonal dominance):** ${totalCols === 0 ? 'ZERO deficit columns — PASS ✓' : `**FAILS** — ${deficit.length}/${ok.length} tables carry ${totalCols} borrowed-win columns (bar = zero)`}`);
console.log(`- **CLEAN tables:** ${clean.length}/${ok.length}` + (errs.length ? `  ·  **ERRORS:** ${errs.length}` : ''));
if (mismatches.length) console.log(`- ⚠ reported-diagWorst mismatches: ${mismatches.map(t => t.file).join(', ')}`);
if (totalCols) { // width DISTRIBUTION (§5.9: report distributions, not zero-bar counts)
  const w = ok.flatMap(t => t.defCols.map(d => d.pct)).sort((a, b) => a - b);
  const med = w[Math.floor(w.length / 2)], mean = w.reduce((s, x) => s + x, 0) / w.length;
  const ge = x => w.filter(v => v >= x).length;
  console.log(`- **Width distribution:** median ${med.toFixed(3)}% · mean ${mean.toFixed(3)}% · max ${w[w.length - 1].toFixed(2)}% · ≥0.3%: ${ge(0.3)} · ≥0.2%: ${ge(0.2)} · ≥0.1%: ${ge(0.1)}`);
}

if (totalCols) {
  console.log(`\n### ALL deficit columns (worst first; ★ = length-robust locus — same kit×sim-haste violates on long/xl)\n`);
  console.log('| kit | class | T | sim-haste | borrowed plan | deficit % | robust |');
  console.log('|-----|-------|---|-----------|---------------|-----------|--------|');
  const flat = [];
  for (const t of deficit) for (const d of t.defCols) flat.push({ t, d });
  flat.sort((a, b) => b.d.pct - a.d.pct);
  for (const { t, d } of flat) {
    const rob = robustLoci.has(`${t.kit}@${d.simH}`) ? '★' : '';
    console.log(`| ${t.kit} | ${band(t)} | ${t.T} | ${d.simH} | plan@${d.borrowedH} (${d.borrowed.toFixed(1)} > ${d.native.toFixed(1)}) | ${d.pct.toFixed(2)} | ${rob} |`);
  }
  console.log(`\n### Per-table summary\n`);
  console.log('| kit | class | T | deficit cols | worst % | monoDip |');
  console.log('|-----|-------|---|--------------|---------|---------|');
  for (const t of ok.slice().sort((a, b) => b.worst - a.worst)) {
    console.log(`| ${t.kit} | ${band(t)} | ${t.T} | ${t.defCols.length} | ${t.worst ? t.worst.toFixed(2) : 'CLEAN'} | ${t.mono.toFixed(2)} |`);
  }
  console.log(`\n### Length-robust loci (kit × sim-haste violating on long/xl — start here, but ALL columns are targets)\n`);
  for (const l of [...robustLoci].sort()) console.log(`- ${l}`);
}
if (clean.length) { console.log(`\n### Clean tables\n`); for (const t of clean) console.log(`- ${t.kit} ${band(t)} (T=${t.T})`); }
if (errs.length) { console.log(`\n### Errors\n`); for (const t of errs) console.log(`- ${t.file}: ${t.err}`); }

if (jsonOut) {
  const targets = [];
  for (const t of deficit) for (const d of t.defCols) targets.push({
    file: t.file, kit: t.kit, class: t.class, T: t.T, lust: t.lust, seed: t.seed,
    simH: d.simH, borrowedH: d.borrowedH, nativeDPS: d.native, borrowedDPS: d.borrowed, pct: d.pct,
    robust: robustLoci.has(`${t.kit}@${d.simH}`),
    nativeSpec: t.specs[d.simH] ? t.specs[d.simH].spec : null,
    borrowedSpec: t.specs[d.borrowedH] ? t.specs[d.borrowedH].spec : null,
    nativeEff: t.specs[d.simH] ? t.specs[d.simH].eff : null,
    borrowedEff: t.specs[d.borrowedH] ? t.specs[d.borrowedH].eff : null,
  });
  fs.writeFileSync(jsonOut, JSON.stringify(targets, null, 1));
  console.log(`\n[targets JSON → ${jsonOut}: ${targets.length} columns]`);
}
