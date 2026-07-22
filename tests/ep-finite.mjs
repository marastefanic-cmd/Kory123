// ep-finite.mjs — FINITE-MANA stat weights via wowsims finite-difference on the
// conserve rotation (docs/PLAN.md option B; docs/EP.md "the layout EP is an
// infinite-mana ceiling"). This is the SIM route for the *real gearing* weights.
//
// The infinite-mana model/route (tests/ep-model.mjs, ep-sim.sh) weighs the layout
// (time-limited) stats: it AB-spams forever, so haste is a ceiling (~1.4) and the
// regen stats read ~0. Real Arcane is mana-bound (pure AB-spam OOMs: 420s 945 DPS
// vs 2264 infinite), so it CONSERVES (tools/genconserve.mjs). On that rotation, at
// REAL mana, the weights move the two ways the layout model can't see: haste deflates
// and mp5/spirit/int-mana become positive.
//
// Method: central finite-difference the runner (rebuilt with --int/--spirit/--mp5)
// on a fixed cooldown schedule. Each stat perturbation changes the cast SEQUENCE
// (mana-bound), so CRN pairing desyncs — we rely on large N (SEM=stdev/sqrt(iter))
// instead. EP_stat = (dDPS/dstat)/(dDPS/dSP), SP normalized to 1.
//
// Usage:  node ep-finite.mjs [--dur 300] [--iter 120000] [--seed 11] [--inf]
//         --inf also runs the SAME schedule at +900k mana (infinite) for the contrast.
import { execFileSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { build } from '../tools/genconserve.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SP = process.env.MYSP || process.env.SP;
const RUNNER = process.env.RUNNER;
const GEAR = process.env.GEAR;
if (!RUNNER || !GEAR || !SP) { console.error('set RUNNER, GEAR, MYSP env (source scratchpad/env.sh)'); process.exit(1); }

const arg = (k, d) => { const i = process.argv.indexOf(k); return i >= 0 ? process.argv[i+1] : d; };
const has = k => process.argv.includes(k);
const DUR  = +arg('--dur', 300);
const ITER = +arg('--iter', 120000);
const SEED = +arg('--seed', 11);
const INF  = has('--inf');
const NATIVE = has('--native'); // finite-difference the export's OWN wowsims Arcane rotation (cross-check)

// A representative realistic single-target schedule: opener burst + on-cadence repeats.
const SCHED = { BL:[10], IV:[10,190], AP:[10,190], Icon:[10,130,250], Gem:[10,190], Zerk:[10,190] };

// stat -> {flag, step}. step is the +/- delta for the central difference.
const STATS = [
  { key:'SP',     flag:'--sp',     step:50,   label:'Spell power' },
  { key:'Crit',   flag:'--crit',   step:150,  label:'Crit rating' },
  { key:'Haste',  flag:'--haste',  step:150,  label:'Haste rating' },
  { key:'Int',    flag:'--int',    step:150,  label:'Intellect' },
  { key:'Spirit', flag:'--spirit', step:200,  label:'Spirit' },
  { key:'MP5',    flag:'--mp5',    step:50,   label:'MP5' },
  { key:'Mana',   flag:'--mana',   step:3000, label:'Mana pool' },
];

const aplPath = path.join(SP, '_epf.apl.json');
fs.writeFileSync(aplPath, JSON.stringify(build(SCHED), null, 1));

function run(extraFlags, tag) {
  // NATIVE: omit --apl so the export's own wowsims Arcane rotation drives (auto-manages
  // cooldowns + conserve). Otherwise force our pinned-schedule conserve APL.
  const aplArgs = NATIVE ? [] : ['--apl', aplPath];
  const args = ['--export', GEAR, ...aplArgs, '--dur', String(DUR), '--var', '0',
                '--iter', String(ITER), '--seed', String(SEED), '--tag', tag, '--quiet', ...extraFlags];
  const out = execFileSync(RUNNER, args, { encoding:'utf8' }).trim().split('\t');
  return { dps:+out[4], sem:+out[5] / Math.sqrt(ITER) };
}

function weights(baseFlags, label) {
  console.log(`\n=== ${label}  (dur=${DUR}s, iter=${ITER}, seed=${SEED}) ===`);
  const rows = [];
  for (const s of STATS) {
    const hi = run([...baseFlags, s.flag, String(+s.step)],  `${s.key}+`);
    const lo = run([...baseFlags, s.flag, String(-s.step)],  `${s.key}-`);
    const per = (hi.dps - lo.dps) / (2 * s.step);     // DPS per unit of stat
    const sem = Math.hypot(hi.sem, lo.sem) / (2 * s.step);
    rows.push({ ...s, per, sem, hi:hi.dps, lo:lo.dps });
  }
  const spW = rows.find(r => r.key === 'SP').per;
  console.log('stat      DPS/unit    SEM      EP(/SP)   per-rating(crit,haste /22.08)');
  for (const r of rows) {
    const ep = r.per / spW;
    const perRating = (r.key === 'Crit' || r.key === 'Haste') ? `   ${ep.toFixed(3)}` : '';
    console.log(`${r.key.padEnd(8)}  ${r.per.toFixed(4).padStart(9)}  ${r.sem.toFixed(4).padStart(7)}  ${ep.toFixed(3).padStart(7)}${perRating}`);
  }
  return { rows, spW };
}

const base = run([], 'base');
console.log(`base conserve DPS @${DUR}s real mana = ${base.dps.toFixed(1)} (SEM ${base.sem.toFixed(2)})`);
const real = weights([], 'FINITE (real mana) — the gearing weights');
if (INF) {
  const infBase = run(['--mana','900000'], 'infbase');
  console.log(`\nbase conserve DPS @${DUR}s +900k (infinite) mana = ${infBase.dps.toFixed(1)}`);
  weights(['--mana','900000'], 'INFINITE mana (same schedule) — the layout ceiling');
}
