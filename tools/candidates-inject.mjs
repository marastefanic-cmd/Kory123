// CANDIDATES → index.html — put the brute-forced lines where the user can read and rule on them.
//
//   node tools/candidates-inject.mjs <cells.jsonl> [more.jsonl ...] [--dry]
//
// Exit: 0 = injected (or --dry printed) · 2 = could not run.
//
// ── WHY THIS IS A GENERATOR AND NOT A HAND-EDIT ──────────────────────────────────────────────────
// User, 08-05: *"put it up into the html so I can actually see the lines and I'll confirm them."*
// The lines being confirmed are an ENUMERATION's output, and the one thing that must never happen is
// a line on the page drifting from the run that produced it — a stale candidate the user rules on is
// worse than no candidate at all, because the ruling then attaches to a layout nothing measured.
// So the array between the markers is written from the JSONL, every time, and never by hand. That is
// the same doctrine `tools/reference-gear.mjs` applies to gear and `engine-node.mjs` to the
// comparator: read the source of truth, never re-type it.
//
// ⚠ RE-RUN IT AFTER ANY ENGINE CHANGE. `lattice-brute` grades with the engine's own comparator at run
// time, so a cell swept before a tie-break change can name a plateau member the current comparator
// would not. This project changed that THREE times on 08-05 alone (§9u/§9w/§9x) plus a move class
// (§9y). The banner in `docs/DECISION-PACKAGES.md` exists for the same reason.
// ⛔ It also refuses to inject a cell whose kit is unplayable (more than two of the five trinkets,
// §9t) — the tool must not invite a ruling on a character that cannot exist.
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const die = m => { console.error('CANDIDATES ERROR: ' + m); process.exit(2); };
const files = process.argv.slice(2).filter(a => !a.startsWith('--'));
const DRY = process.argv.includes('--dry');
if (!files.length) die('usage: node candidates-inject.mjs <cells.jsonl> [...] [--dry]');

const HTML = fileURLToPath(new URL('../index.html', import.meta.url));
const TRINKETS = ['mqg', 'isc', 'scb', 'skull', 'ati'];
const BEGIN = '  /* CANDIDATES:BEGIN — generated, do not edit by hand */';
const END = '  /* CANDIDATES:END */';
const htmlSrc = fs.readFileSync(HTML, 'utf8');

/* ★★★ TYPED vs EFFECTIVE, AND WHY THIS TOOL HAS TO KNOW THE DIFFERENCE (§9z).
   The enumeration works in the engine's units: `cfg.critPct` is the FINAL crit. The page's crit box is
   your UNBUFFED sheet value, and `buffedStats` adds the Arcane Impact talent to it before the engine
   ever sees it. So a cell enumerated at crit 44 must be presented as "type 38", or the user loads the
   row and the tool silently solves a different fight.
   ⛔ The talent constant is READ OUT OF index.html, never re-typed — same doctrine as
   `reference-gear.mjs` reading GAME. If the parse fails the tool REFUSES rather than guessing, because
   a silently-wrong offset is exactly the failure this is here to prevent.
   ⚠ Belt and braces: each row also carries `eff`, the stats the enumeration actually used, and the
   page checks its own `readCfg()` against them on load. So if this offset ever drifts, the row says so
   instead of the user confirming a line that was never computed. */
const mTal = /arcaneImpact:\s*(\d+)/.exec(htmlSrc);
if (!mTal) die('could not read TALENTS.arcaneImpact out of index.html — the talent block moved, and guessing the crit offset is exactly what this tool must not do');
const TALENT_CRIT_PCT = 2 * (+mTal[1]);

const rows = [];
for (const f of files) {
  if (!fs.existsSync(f)) { console.error(`  (skipping missing ${f})`); continue; }
  for (const line of fs.readFileSync(f, 'utf8').split('\n').filter(Boolean)) {
    try { rows.push(JSON.parse(line)); } catch { /* a partial write at the tail — the run is still going */ }
  }
}
if (!rows.length) die('no cells found — has the enumeration produced anything yet?');

// Later cells win: a re-cut of the same cell supersedes the earlier grading, which is the whole
// point of re-running after an engine change.
const byCell = new Map();
for (const r of rows) byCell.set(r.cell, r);

const fmtT = s => (s < 0 ? '-' : '') + Math.floor(Math.abs(s) / 60) + ':' + String(Math.round(Math.abs(s) % 60)).padStart(2, '0');
const kitLabel = kit => {
  const t = kit.filter(k => TRINKETS.includes(k));
  return t.length ? t.map(k => ({ isc: 'icon', scb: 'gem', skull: 'skull', mqg: 'mqg', ati: 'ati' })[k]).join('+') : 'base';
};

const out = [];
let skipped = 0;
for (const r of [...byCell.values()]) {
  const kit = String(r.kit || '').split(',').filter(Boolean);
  if (r.ati && !kit.includes('ati')) kit.push('ati');
  if (r.lust !== undefined && r.lust !== null && !kit.includes('bloodlust')) kit.push('bloodlust');
  const equipped = kit.filter(k => TRINKETS.includes(k)).length;
  if (equipped > 2) {                                  // §9t — two trinket slots, and only two
    console.error(`  ⛔ SKIPPED ${r.cell}: ${equipped} trinkets — that character cannot exist`);
    skipped++; continue;
  }
  const line = {};
  for (const k of Object.keys(r.best || {}).sort()) {
    if (k === 'bloodlust') continue;                   // the pin is an input, not part of the answer
    if ((r.best[k] || []).length) line[k] = r.best[k].map(t => Math.round(t));
  }
  const name = `${fmtT(r.T)}${r.lust === undefined || r.lust === null ? ' no-lust' : ' lust ' + fmtT(r.lust)}` +
    ` · ${kitLabel(kit)}` + (r.haste ? ` · h${r.haste}` : '') +
    (r.sp !== 1387 ? ` · sp${Math.round(r.sp)}` : '') +
    (r.crit - TALENT_CRIT_PCT !== 38 ? ` · crit${Math.round(r.crit - TALENT_CRIT_PCT)}` : '') +
    (r.interm ? ` · interm ${String(r.interm).split(',').map(x => fmtT(+x)).join('-')}` : '');
  // typed = what to put in the boxes; eff = what the enumeration solved at. The page adds the talent.
  const gear = { sp: r.sp, crit: +(r.crit - TALENT_CRIT_PCT).toFixed(6) };
  if (r.haste) gear.haste = r.haste;
  if (r.t5two) gear.t5two = true;
  const p = { name, T: r.T, ...(r.lust === undefined || r.lust === null ? {} : { pins: { bloodlust: [r.lust] } }),
              gear, kit, line, casts: +(+r.quant).toFixed(6), plateau: r.plateau || 1, layouts: r.layouts || 0,
              eff: { sp: r.sp, crit: r.crit, t5two: !!r.t5two } };
  if (r.interm) {
    const [a, b] = String(r.interm).split(',').map(Number);
    p.phases = [{ from: a, to: b, type: 'intermission' }];
  }
  out.push(p);
}
out.sort((a, b) => a.name.localeCompare(b.name));

const body = out.map(p => '  ' + JSON.stringify(p) + ',').join('\n');
const src = fs.readFileSync(HTML, 'utf8');
const i = src.indexOf(BEGIN), j = src.indexOf(END);
if (i < 0 || j < 0) die('the CANDIDATES markers are missing from index.html — did the block move?');
const next = src.slice(0, i + BEGIN.length) + '\n' + body + '\n' + src.slice(j);

console.log(`# CANDIDATES — ${out.length} cell(s) from ${byCell.size} enumerated${skipped ? `, ${skipped} skipped as unplayable` : ''}`);
for (const p of out) console.log(`  ${p.plateau > 1 ? '⚖️' : '✓'} ${p.name.padEnd(46)} ${p.casts.toFixed(3)} casts · plateau ${p.plateau}`);
if (DRY) { console.log('\n(--dry: index.html not written)'); process.exit(0); }
fs.writeFileSync(HTML, next);
console.log(`\n✓ injected into ${HTML}`);
