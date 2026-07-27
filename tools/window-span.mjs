// HOW LONG DOES A BUFF WINDOW LAST IN THE MODEL'S DISCRETE WALK, vs in the sim?
//
//   RUNNER=… node tools/window-span.mjs
//
// The discrete cast walk pushes a fired buff onto `active` at the first cast boundary ≥ its effective
// press time, but expires it on `t >= w.start + dur` where `w.start` is the PRESS time. So a press
// landing mid-cast gets a window that starts late and ends on time — i.e. SHORTER than the buff's own
// duration, by the press slip.
//
// That never mattered while the rate integral was the arbiter: the integral scored from
// `scoreStart = eff + slip` for a FULL duration, which is the phase-average of "starts at the next
// boundary, runs its full length" — the correct semantics. PHASE12 step 1 makes the discrete walk the
// arbiter, so the approximation is now load-bearing and has to be checked against the sim rather than
// inherited.
//
// This counts, for one press at a series of offsets, how many Arcane Blasts the buff covers in the
// model's walk and in wowsims. If the model is systematically one cast short, the walk's expiry is
// wrong and the fix is to expire from the boundary the buff actually started on.
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
  console.log(`  ${String(press).padEnd(6)}  ${String(buffed.length).padStart(16)}   ${simBuffed.padStart(17)}   ` +
    `${mFirst === null ? '—' : `${mFirst.toFixed(2)}–${mLast.toFixed(2)}`.padEnd(18)}    ` +
    `${sFirst === undefined || sFirst === null ? '—' : `${sFirst.toFixed(2)}–${sLast.toFixed(2)}`}` +
    `   (eff ${eff === undefined ? '?' : eff.toFixed(3)})`);
}
console.log('\n  If the model is short by a cast wherever the press lands mid-cast, the walk is expiring');
console.log('  the window from the PRESS time instead of from the boundary the buff started on.');
