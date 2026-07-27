// DOES THE MODEL CREDIT EXACTLY THE CASTS THE SIM CREDITS? — the gate for PHASE12's bug 3.
//
//   RUNNER=… node tools/credit-check.mjs            # exits 1 on any disagreement
//   ENGINE=/tmp/idx-prev.html node tools/credit-check.mjs    # the negative control
//
// ── WHAT IT CHECKS ────────────────────────────────────────────────────────────────────────────────
// Not "how long is the window" (that is `tools/window-span.mjs`) but **which casts it pays**. wowsims
// resolves the two kinds of buff at different moments, measured in `tools/snapshot-rule.mjs`:
//
//   · HASTE  — the cast's speed is fixed when it BEGINS (Berserking faded 21.00; the cast that started
//              20.55 still ran its buffed 1.362 s while the next ran 1.498 s).
//   · VALUE  — +SP and damage multipliers are read at cast COMPLETION, strictly after the gain:
//                 9.50 -> 11.00 : SP 1386.2   <- completes ON the gain, does NOT get it
//                30.50 -> 32.00 : SP 1456.2   <- STARTED inside the window and still LOST it
//
// The model's walk applied the START rule to both until 2026-07-27.
//
// ── ⚠ THE CASE THAT MUST BE CHOSEN DELIBERATELY ──────────────────────────────────────────────────
// On a press that lands MID-CAST the old defects CANCEL: the window ended one cast early *and* the
// test point was one cast early, so model and sim agreed and the bug was invisible. The discriminating
// case is a press that lands ON a cast boundary — there the window is right and only the test point is
// wrong, and the model over-credits by exactly one cast. A gate that only ran the mid-cast case would
// have passed on the broken engine, which is the whole reason this file names its press times.
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { loadEngine, ALL_BUFFS } from './engine-node.mjs';
import { REF } from './reference-gear.mjs';
import { build } from './genapl-core.mjs';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const RUNNER = process.env.RUNNER || '/tmp/wowsims-build/tbc-new/runner-ap180';
if (!fs.existsSync(RUNNER)) {
  console.log('# credit-check — SKIPPED LOUDLY: no RUNNER.');
  console.log('  The committed sim/sim.wasm exposes no combat log, so "which casts did the sim pay?"');
  console.log('  needs the native runner (docs/TOOLING.md). Re-run with RUNNER=<path>.');
  process.exit(0);
}
const api = loadEngine(process.env.ENGINE || path.join(REPO, 'index.html'));

// model press time, and the schedule value that fires on the SAME boundary in the sim (the two grids
// are not the same grid — sim/planspec.mjs's header).
const CASES = [
  { key: 'isc',  spec: 'Icon', press: 11,   sched: 10.6, why: 'value (+SP) pressed ON a boundary — the discriminating case' },
  { key: 'isc',  spec: 'Icon', press: 10.5, sched: 10.1, why: 'value (+SP) pressed mid-cast — where the old defects cancelled' },
  { key: 'scb',  spec: 'Gem',  press: 20,   sched: 19.6, why: 'value (+SP), a shorter window' },
];

let failures = 0;
console.log(`# credit-check — which casts does each side pay?  engine ${process.env.ENGINE || 'index.html'}\n`);
for (const c of CASES) {
  const en = {}; for (const k of ALL_BUFFS) en[k] = (k === c.key);
  const cfg = { T: 60, hasteRating: 0, ...REF, enabled: en, fixed: {}, warnings: [], coldSnap: false, segments: null };
  const r = api.simulate({ [c.key]: [c.press] }, cfg, true);
  const base = Math.min(...r.casts.map(x => x.dmg));
  const modelOn = r.casts.filter(x => x.dmg > base + 1e-6).map(x => +x.t.toFixed(2));

  const apl = `/tmp/credit-${c.spec}-${c.press}.json`, log = apl + '.log';
  fs.writeFileSync(apl, JSON.stringify(build({ _prestack: 0, [c.spec]: [c.sched] })));
  try {
    execFileSync(RUNNER, ['--export', path.join(REPO, 'tools/bench/export.json'), '--apl', apl,
      '--dur', '60', '--var', '0', '--iter', '1', '--seed', '11', '--mana', '100000000',
      '--haste', '0', '--quiet'],
      { env: { ...process.env, SIMLOG: '1' }, maxBuffer: 1 << 28,
        stdio: ['ignore', fs.openSync(log, 'w'), fs.openSync(log, 'a')] });
  } catch { /* the log is the instrument */ }
  const txt = fs.readFileSync(log, 'utf8');
  const starts = [...txt.matchAll(/\[\s*([0-9.]+)\]\s*\[Player[^\]]*\] Casting \{SpellID: 30451\}/g)].map(m => +m[1]);
  const sp = [...txt.matchAll(/\[\s*([0-9.]+)\][^\n]*\{SpellID: 30451\} \[DEBUG\][^\n]*SP: ([0-9.]+)/g)]
    .map(m => ({ tc: +m[1], sp: +m[2] }));
  if (!sp.length) { console.error(`ERROR: no [DEBUG] SP lines in ${log} — cannot grade`); process.exit(2); }
  const hi = Math.max(...sp.map(x => x.sp));
  // a cast the SIM paid, mapped from its completion back to its start
  const simOn = sp.filter(x => x.sp > hi - 1).map(x => {
    let best = null; for (const s of starts) if (s < x.tc - 1e-9 && (best === null || s > best)) best = s;
    return +best.toFixed(2);
  });

  const sm = new Set(modelOn.map(x => x.toFixed(2))), ss = new Set(simOn.map(x => x.toFixed(2)));
  const onlyM = [...sm].filter(x => !ss.has(x)), onlyS = [...ss].filter(x => !sm.has(x));
  const ok = !onlyM.length && !onlyS.length;
  if (!ok) failures++;
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${c.spec}@${c.press} — ${c.why}`);
  console.log(`        model paid ${String(modelOn.length).padStart(2)} casts · sim paid ${String(simOn.length).padStart(2)}`);
  if (!ok) {
    console.log(`        only the model paid: ${onlyM.join(' ') || '(none)'}`);
    console.log(`        only the sim paid  : ${onlyS.join(' ') || '(none)'}`);
  }
}
console.log('');
if (failures) {
  console.log(`✗ ${failures} case(s) disagree — the model is paying a different set of casts than the sim.`);
  console.log('  Read the two snapshot rules in index.html\'s board walk before changing anything:');
  console.log('  haste is fixed at cast START, value is read at cast COMPLETION (tools/snapshot-rule.mjs).');
  process.exit(1);
}
console.log('✓ the model credits exactly the casts the sim credits');
process.exit(0);
