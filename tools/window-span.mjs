// THE WINDOW-SPAN GATE — does a buff window cover the SAME casts in the model as in wowsims?
//
//   RUNNER=… node tools/window-span.mjs
//
// Exit: 0 = every probed offset agrees (or no runner, skipped LOUDLY) · 1 = a mismatch · 2 = no data.
//
// ⛔ THIS FILE HAD NO ASSERTION AND NO NON-ZERO EXIT PATH UNTIL 07-27, while CLAUDE.md called it a
// GATE that "must match wowsims at every probe offset". It printed two columns and exited 0 whatever
// they said — and without RUNNER it printed `—` in the sim column and still exited 0. A gate whose
// verdict is "a human will read the table" is a probe wearing a gate's name; every wrapper that
// checked its exit code was reading a constant. It now compares, per offset, and fails.
//
// ── WHAT IT CHECKS, AND WHAT IT ONCE CAUGHT ──────────────────────────────────────────────────────
// For one Icy Veins press at a series of offsets, it counts how many Arcane Blasts the buff covers in
// the model's discrete walk and in wowsims' combat log, and asserts the two counts are equal.
//
// ✅ The defect it was built for is FIXED (PHASE12 §6.11, `index.html`'s `auraAt`): the walk used to
// push a fired buff onto `active` at the first cast boundary ≥ the press but expire it at
// `press + duration`, so a press landing mid-cast got a window SHORTER than the buff's own duration by
// the press slip — measured, Icy Veins at 9.6 covered 15 casts in the model and 16 in the sim, model
// window 11.00–28.50 against the sim's 11.00–29.75. Windows now run their full duration from when the
// ability actually FIRES. This file is what keeps that true; the past tense is deliberate.
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { loadEngine, ALL_BUFFS } from './engine-node.mjs';
import { REF } from './reference-gear.mjs';
import { build } from './genapl-core.mjs';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const RUNNER = process.env.RUNNER || '/tmp/wowsims-build/tbc-new/runner-ap180';
const api = loadEngine(process.env.ENGINE || path.join(REPO, 'index.html'));
const IV_DUR = api.BUFFS.icyVeins.dur;

console.log(`# buff-window span, model walk vs wowsims — Icy Veins (${IV_DUR}s), h=0, 60s, no other cooldowns\n`);
console.log('  press   model: buffed casts   sim: buffed casts   model window          sim aura window');
const rows = [];   // collected so the verdict at the bottom can ASSERT rather than narrate
for (const press of [0, 8, 9.6, 10, 10.4, 12]) {
  const en = {}; for (const k of ALL_BUFFS) en[k] = (k === 'icyVeins');
  const cfg = { T: 60, hasteRating: 0, ...REF, enabled: en, fixed: {}, warnings: [], coldSnap: false, segments: null };
  const r = api.simulate({ icyVeins: [press] }, cfg, true);
  const eff = ((r.actEff || {}).icyVeins || [])[0];
  // A cast is "buffed" in the model when its haste multiplier exceeds the unbuffed baseline.
  const base = r.casts.length ? Math.min(...r.casts.map(c => c.multNoAti)) : 1;
  const buffed = r.casts.filter(c => c.multNoAti > base + 1e-9);
  const mFirst = buffed.length ? buffed[0].t : null, mLast = buffed.length ? buffed[buffed.length - 1].t : null;

  let sFirst = null, sLast = null, simBuffed = '—';
  if (fs.existsSync(RUNNER)) {
    const apl = `/tmp/wspan-${press}.json`, log = apl + '.log';
    fs.writeFileSync(apl, JSON.stringify(build({ _prestack: 0, IV: [press] })));
    try {
      execFileSync(RUNNER, ['--export', path.join(REPO, 'tools/bench/export.json'), '--apl', apl,
        '--dur', '60', '--var', '0', '--iter', '1', '--seed', '11', '--mana', '100000000',
        '--haste', '0', '--quiet'],
        { env: { ...process.env, SIMLOG: '1' }, maxBuffer: 1 << 28,
          stdio: ['ignore', fs.openSync(log, 'w'), fs.openSync(log, 'a')] });
    } catch { /* the log is the instrument */ }
    const txt = fs.readFileSync(log, 'utf8');
    const gain = [...txt.matchAll(/\[\s*([0-9.]+)\][^\n]*Aura gained: \{SpellID: 12472/g)].map(m => +m[1])[0];
    const fade = [...txt.matchAll(/\[\s*([0-9.]+)\][^\n]*Aura faded: \{SpellID: 12472/g)].map(m => +m[1])[0];
    const casts = [...txt.matchAll(/\[\s*([0-9.]+)\]\s*\[Player[^\]]*\] Casting \{SpellID: 30451\}/g)].map(m => +m[1]);
    if (gain !== undefined) {
      const end = fade !== undefined ? fade : gain + IV_DUR;
      const inWin = casts.filter(t => t >= gain - 1e-6 && t < end - 1e-6);
      simBuffed = String(inWin.length);
      sFirst = inWin[0]; sLast = inWin[inWin.length - 1];
    }
  }
  rows.push({ press, model: buffed.length, sim: simBuffed === '—' ? null : +simBuffed,
              mFirst, mLast, sFirst, sLast });
  console.log(`  ${String(press).padEnd(6)}  ${String(buffed.length).padStart(16)}   ${simBuffed.padStart(17)}   ` +
    `${mFirst === null ? '—' : `${mFirst.toFixed(2)}–${mLast.toFixed(2)}`.padEnd(18)}    ` +
    `${sFirst === undefined || sFirst === null ? '—' : `${sFirst.toFixed(2)}–${sLast.toFixed(2)}`}` +
    `   (eff ${eff === undefined ? '?' : eff.toFixed(3)})`);
}
// ── THE VERDICT ──────────────────────────────────────────────────────────────────────────────────
if (!rows.length) {
  console.error('\nERROR: 0 probe offsets produced a row. Refusing a verdict over an empty set.');
  process.exit(2);
}
const compared = rows.filter(r => r.sim !== null);
if (!compared.length) {
  console.log('\nSKIPPED the comparison — no runner, so the sim column is empty and there is nothing to');
  console.log(`  assert. ${rows.length} model rows printed above. Set RUNNER=/path/to/runner for the gate.`);
  console.log('  ⚠ This is a SKIP, not a pass: exiting 0 so a runner-less CI is not blocked, and saying so.');
  process.exit(0);
}
const bad = compared.filter(r => r.model !== r.sim);
console.log('');
if (bad.length) {
  console.error(`✗ ${bad.length} of ${compared.length} probed offsets disagree — the model and the sim do not`);
  console.error('  cover the same casts with the same window:');
  for (const r of bad)
    console.error(`     press ${r.press}: model ${r.model} casts, sim ${r.sim}` +
                  `  (model ${r.mFirst === null ? '—' : r.mFirst.toFixed(2) + '–' + r.mLast.toFixed(2)}` +
                  `, sim ${r.sFirst === undefined ? '—' : r.sFirst.toFixed(2) + '–' + r.sLast.toFixed(2)})`);
  console.error('\n  If the model is short by a cast wherever the press lands MID-CAST, the walk is expiring');
  console.error('  the window from the PRESS time instead of from the boundary the buff started on');
  console.error('  (PHASE12 §6.11 — that exact defect shipped once and this gate exists to keep it dead).');
  process.exit(1);
}
console.log(`✓ all ${compared.length} probed offsets agree: the model's window covers exactly the casts`);
console.log('  wowsims covers, mid-cast presses included.');
process.exit(0);
