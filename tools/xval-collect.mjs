// Collect Phase-6 cross-val results from a directory of xval output files into a markdown ledger
// for PHASE6.md §2. Splits CLEAN (native dominates every column) from DEFICIT, flags each row's
// fight length (short fights carry plan-to-plan boundary quantization — weigh deficits against it),
// confirms monoDip≈0 everywhere (the cold-open invariant — any nonzero is a regression to flag), and
// LOCALIZES each deficit to its cell (which sim-haste, which borrowed plan won) + a neutral locus tag
// (low-haste ≤70 = the §4.1 straddle-basin region; higher = investigate). Localization is data for the
// next-pass triage — it does NOT decide fixes.
//   node tools/xval-collect.mjs <dir>
import fs from 'fs';
import path from 'path';
const dir = process.argv[2] || '/tmp/claude-0/-home-user-Kory123/e436da46-89c3-50bc-bce2-5b6be890f704/scratchpad/xvcamp';
const rows = [];
for (const f of fs.readdirSync(dir).filter(f => f.endsWith('.txt')).sort()) {
  const txt = fs.readFileSync(path.join(dir, f), 'utf8');
  const m = txt.match(/^XVAL-DONE .*/m);
  if (!m) { rows.push({ file: f, err: 'no XVAL-DONE (crashed?)' }); continue; }
  const kv = Object.fromEntries([...m[0].matchAll(/(\w+)=(\S+)/g)].map(x => [x[1], x[2]]));
  // deficit cell: "(b) DIAGONAL DOMINANCE: DEFICIT X%  [@simH: plan@P (v) > native@H (v)]"
  let simH = null, planH = null;
  const c = txt.match(/DEFICIT [\d.]+%\s*\[@sim(\d+): plan@(\d+)/);
  if (c) { simH = +c[1]; planH = +c[2]; }
  rows.push({ file: f, ...kv, mono: parseFloat(kv.monoDip), deficit: parseFloat(kv.diagWorst), T: +kv.T, simH, planH });
}
const band = T => T <= 130 ? 'short' : T <= 200 ? 'medium' : T <= 260 ? 'medlong' : T <= 380 ? 'long' : 'xl';
// neutral locus tag by the sim-haste the deficit lands at (raw fact + region name, not a verdict)
const locus = r => r.simH == null ? '—' : (r.simH <= 70 ? `low-haste h${r.simH} (§4.1 basin region)` : `mid/high h${r.simH} — investigate`);
const clean = rows.filter(r => r.diag === 'CLEAN');
const defs  = rows.filter(r => r.diag === 'DEFICIT').sort((a,b)=>b.deficit-a.deficit);
const errs  = rows.filter(r => r.err);
const monoBad = rows.filter(r => r.mono > 0.05);
const lowN = defs.filter(r => r.simH != null && r.simH <= 70).length;
const hiN  = defs.filter(r => r.simH != null && r.simH > 70).length;
console.log(`## Cross-val results (${rows.length} tables)\n`);
console.log(`- **Monotonicity (cold-open invariant):** ${monoBad.length ? '⚠ '+monoBad.length+' tables with monoDip>0.05% — REGRESSION' : 'all ≤0.05% ✓'}`);
console.log(`- **CLEAN (native dominates every column):** ${clean.length}/${rows.length}`);
console.log(`- **DEFICIT:** ${defs.length}/${rows.length}` + (errs.length?`  ·  **ERRORS:** ${errs.length}`:''));
if (defs.length) console.log(`- **Deficit loci:** ${lowN} at low haste (≤70, §4.1 basin region) · ${hiN} at mid/high haste (investigate)`);
console.log(`\n### Deficits (worst first) — weigh against fight length; a diagonal deficit on a short fight may be plan-to-plan boundary quantization\n`);
console.log('| kit | class | T | fight-band | diag deficit | monoDip | deficit cell | locus |');
console.log('|-----|-------|---|-----------|--------------|---------|--------------|-------|');
for (const r of defs) console.log(`| ${r.kit} | ${r.class} | ${r.T} | ${band(r.T)} | **${r.diagWorst}** | ${r.monoDip} | @sim${r.simH}: plan@${r.planH}>native | ${locus(r)} |`);
console.log(`\n### Clean tables\n`);
for (const r of clean) console.log(`- ${r.kit} ${r.class} (T=${r.T}, ${band(r.T)})`);
if (errs.length) { console.log(`\n### Errors\n`); for (const r of errs) console.log(`- ${r.file}: ${r.err}`); }
