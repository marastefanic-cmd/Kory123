// WHY a press scheduled ON a cast boundary fires a whole cast LATE — the mechanism, not the symptom.
//
//   node tools/press-ns-probe.mjs            # needs RUNNER (native); prints the ns ledger + 3 sim probes
//
// PHASE12 §6.6/§6.7 established the empirical rule "wowsims' schedule fires at the first cast boundary
// STRICTLY AFTER the scheduled time". That rule is right about the consequence and wrong about the
// cause, and the difference decides the fix.
//
// `APLActionSchedule.IsReady` is `sim.CurrentTime >= timings[i]` — NOT strict. The strictness is a
// ONE-NANOSECOND artifact:
//
//   sim/core/utils.go:  func DurationFromSeconds(s float64) time.Duration {
//                           return time.Duration(float64(time.Second) * s)   // float -> int = TRUNCATE
//                       }
//
// Arcane Blast at 1 stack is (2.5 - 1/3) = 2.1666666666666665 s -> x1e9 = 2166666666.67 -> 2166666666 ns,
// losing 0.67 ns. Those truncations ACCUMULATE along the cast chain, so the boundary the combat log
// prints as `11.00` is really 10999999999 ns. `time.ParseDuration("11s")` is exactly 11000000000 ns.
// 10999999999 >= 11000000000 is false, by 1 ns, so the schedule waits for the NEXT evaluation — a full
// cast later.
//
// ⇒ THE RULE IS NOT "strictly after". It is "at the first boundary whose NANOSECOND COUNT reaches the
// scheduled nanosecond count", and boundaries sit within ~a few ns of the value the log prints, on
// EITHER side depending on the haste/stack path. A fix that subtracts exactly 1 ns (or that trusts
// "strictly after" as a law) is betting on the sign of an accumulated rounding error. The transcription
// must instead schedule far enough below the intended boundary to clear the whole float fuzz, while
// staying above the PREVIOUS boundary.
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { build } from './genapl-core.mjs';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const RUNNER = process.env.RUNNER || '/tmp/wowsims-build/tbc-new/runner-ap180';

// ── the ns ledger, pure arithmetic, no sim ───────────────────────────────────────────────────────
// Reproduce Go's truncation exactly: Math.trunc(seconds * 1e9).
const trunc = s => Math.trunc(s * 1e9);
const CASTS = [2.5, 2.5 - 1 / 3, 2.5 - 2 / 3, 1.5, 1.5, 1.5, 1.5, 1.5, 1.5, 1.5];
console.log('# the nanosecond ledger at h=0 (Go truncation, reproduced in JS — no sim)\n');
console.log('  boundary   printed      actual ns      vs the round number');
let acc = 0;
for (const c of CASTS) {
  const roundNs = Math.round(acc / 1e9) * 1e9;
  const delta = acc - roundNs;
  console.log(`  ${(acc / 1e9).toFixed(9).padStart(13)}  ${(acc / 1e9).toFixed(2).padStart(6)}  ${String(acc).padStart(13)}  ${delta === 0 ? 'exact' : (delta > 0 ? '+' : '') + delta + ' ns'}`);
  acc += trunc(c);
}

if (!fs.existsSync(RUNNER)) {
  console.log(`\n(no RUNNER at ${RUNNER} — ledger only; set RUNNER=<path> for the sim probes)`);
  process.exit(0);
}

// ── the sim probes ───────────────────────────────────────────────────────────────────────────────
// If the cause is the 1 ns, then scheduling at 10.999999999s (the boundary's TRUE value) fires on
// time, while 11s does not — and the gap between them is a single nanosecond.
function auraAt(spec, tag) {
  const apl = path.join('/tmp', `ns-probe-${tag}.json`);
  const log = apl + '.log';
  fs.writeFileSync(apl, JSON.stringify(build(spec)));
  try {
    execFileSync(RUNNER, ['--export', path.join(REPO, 'tools/bench/export.json'), '--apl', apl,
      '--dur', '60', '--var', '0', '--iter', '1', '--seed', '11', '--mana', '100000000',
      '--haste', '0', '--quiet'],
      { env: { ...process.env, SIMLOG: '1' }, maxBuffer: 1 << 28,
        stdio: ['ignore', fs.openSync(log, 'w'), fs.openSync(log, 'a')] });
  } catch { /* exit code is irrelevant; the log is the instrument */ }
  const t = fs.readFileSync(log, 'utf8');
  const g = [...t.matchAll(/\[\s*([0-9.]+)\][^\n]*Aura gained: \{SpellID: 20554/g)].map(m => +m[1]);
  return g[0];
}

console.log('\n# the sim probes — Berserking, h=0. The 11.00 boundary is really 10999999999 ns.\n');
const cases = [
  ['11s',            11,           'exactly the round number — 1 ns ABOVE the boundary'],
  ['10.999999999s',  10.999999999, 'the boundary\'s TRUE ns value — should fire ON it'],
  ['10.999999998s',  10.999999998, '1 ns below the boundary — should also fire ON it'],
  ['10.5s',          10.5,         'comfortably inside the previous interval'],
];
for (const [label, v, why] of cases) {
  const a = auraAt({ _prestack: 0, Zerk: [v] }, String(v).replace('.', '_'));
  const late = a !== undefined && a > 11.4;
  console.log(`  schedule ${label.padEnd(15)} -> aura ${a === undefined ? '(none)' : a.toFixed(2)}   ${late ? 'LATE by a full cast' : 'on the 11.00 boundary'}   (${why})`);
}
console.log('\n  If 11s is late and 10.999999999s is not, the cause is the nanosecond, not a "strictly');
console.log('  after" rule — and the fix must clear float fuzz with margin, not shave one ns.');
