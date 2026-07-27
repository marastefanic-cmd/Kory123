// THE PRESS-FIRE THRESHOLD, measured by bisection instead of asserted.
//
//   RUNNER=/path/to/runner node tools/press-threshold-probe.mjs [--haste 0] [--boundaries 11,12.5]
//
// PHASE12 §6.6/§6.7 recorded the empirical rule "the schedule fires at the first cast boundary STRICTLY
// AFTER the scheduled time". Two mechanisms were candidates and BOTH are falsified by measurement:
//   · genuine strictness — no: `APLActionSchedule.IsReady` is `sim.CurrentTime >= timings[i]`;
//   · a 1 ns float-truncation shortfall — no: `tools/press-ns-probe.mjs` shows a schedule 1 ns BELOW
//     the boundary's own truncated value ALSO fires a full cast late.
//
// So the question the fix depends on is quantitative, not qualitative: **how far below a boundary must
// a schedule value sit to fire ON that boundary?** This bisects it. The answer is what
// `sim/planspec.mjs` must budget for.
//
// Exit 0 always — this is a measuring instrument, not a gate.
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { build } from './genapl-core.mjs';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const RUNNER = process.env.RUNNER || '/tmp/wowsims-build/tbc-new/runner-ap180';
if (!fs.existsSync(RUNNER)) { console.error(`ERROR: no RUNNER at ${RUNNER}`); process.exit(2); }

const argv = process.argv.slice(2);
const flag = (n, d) => { const i = argv.indexOf(`--${n}`); return i < 0 ? d : argv[i + 1]; };
const HASTE = flag('haste', '0');

let runs = 0;
// The aura-gain time for a Berserking scheduled at `v`. Berserking is ON-GCD; `--gem` swaps in an
// OFF-GCD on-use trinket so the two can be compared with one code path.
function auraAt(v, off) {
  const key = off ? 'Icon' : 'Zerk';
  const rx = off ? /\[\s*([0-9.]+)\][^\n]*Aura gained: \{ItemID: 29370/g
                 : /\[\s*([0-9.]+)\][^\n]*Aura gained: \{SpellID: 20554/g;
  const apl = `/tmp/thresh-${key}-${String(v).replace(/[.]/g, '_')}.json`;
  const log = apl + '.log';
  fs.writeFileSync(apl, JSON.stringify(build({ _prestack: 0, [key]: [v] })));
  runs++;
  try {
    execFileSync(RUNNER, ['--export', path.join(REPO, 'tools/bench/export.json'), '--apl', apl,
      '--dur', '60', '--var', '0', '--iter', '1', '--seed', '11', '--mana', '100000000',
      '--haste', HASTE, '--quiet'],
      { env: { ...process.env, SIMLOG: '1' }, maxBuffer: 1 << 28,
        stdio: ['ignore', fs.openSync(log, 'w'), fs.openSync(log, 'a')] });
  } catch { /* exit code irrelevant; the log is the instrument */ }
  const t = fs.readFileSync(log, 'utf8');
  // An equipped trinket also gains its aura at t=0 (the equip, not the press) — skip that one.
  const g = [...t.matchAll(rx)].map(m => +m[1]).filter(x => x > 0.05);
  fs.unlinkSync(apl); fs.unlinkSync(log);
  return g[0];
}

// Largest schedule value that still fires ON `B`, to `tol` seconds.
function threshold(B, lo, off) {
  let good = lo, bad = B;                       // good fires on B; bad overshoots
  if (auraAt(good, off) > B + 0.01) return null; // lo already overshoots — wrong interval
  for (let i = 0; i < 22 && bad - good > 1e-7; i++) {
    const mid = (good + bad) / 2;
    if (auraAt(mid, off) > B + 0.01) bad = mid; else good = mid;
  }
  return good;
}

console.log(`# press-fire threshold by bisection — haste ${HASTE}, runner ${path.basename(RUNNER)}\n`);
console.log('  A schedule value at or above the threshold overshoots to the NEXT boundary.\n');
console.log('  ability     boundary B   prev boundary   largest S firing on B   B - S');
const probes = [
  ['Zerk (on-GCD)',  false, 11.0,  9.5],
  ['Zerk (on-GCD)',  false, 12.5, 11.0],
  ['Zerk (on-GCD)',  false, 8.0,  6.5],
  ['Icon (off-GCD)', true,  11.0,  9.5],
  ['Icon (off-GCD)', true,  12.5, 11.0],
];
for (const [name, off, B, prev] of probes) {
  const s = threshold(B, prev + 0.05, off);
  console.log(`  ${name.padEnd(15)} ${B.toFixed(2).padStart(6)}   ${prev.toFixed(2).padStart(9)}   ` +
    (s === null ? '        (not bracketed)' : s.toFixed(6).padStart(20)) +
    (s === null ? '' : `   ${(B - s).toFixed(6)}`));
}
console.log(`\n  (${runs} runner invocations)`);
