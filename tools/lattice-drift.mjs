// THE CAST LATTICE: does the model's boundary grid match wowsims' — and for how long?
//
//   RUNNER=… node tools/lattice-drift.mjs [--dur 300] [--index /tmp/index-round.html]
//
// ── WHY ───────────────────────────────────────────────────────────────────────────────────────────
// PHASE12 §6.6 step 1 measured the BARE cast stream at 60 s and called it exact (mean 0.0001 s at
// h=0). That is true at 60 s and false as a general statement, and the difference is the whole of the
// press-fire offset:
//
//   wowsims  sim/mage/arcane_charge.go:17   castTimeReduction := time.Millisecond * -334
//   model    index.html                     STACK_CAST_REDUCTION: 1/3          (333.333… ms)
//
// The two disagree by 0.667 ms per Arcane Blast stack, and wowsims additionally `.Round(time.Milli-
// second)`s every cast (sim/core/cast.go:137-138). At h=0 the ramp ends 2 ms behind the model and then
// both run GCD-capped at exactly 1.5 s, so the offset FREEZES at 2 ms — invisible in a combat log that
// prints 2 decimals ("11.00" is really 10.998). Off the GCD cap the per-cast difference no longer
// cancels and the offset ACCUMULATES, once per cast, in the same direction.
//
// That 2 ms is the entire mechanism behind "the schedule fires a full cast late": `APLActionSchedule.
// IsReady` is `sim.CurrentTime >= timing` — not strict — but at the boundary CurrentTime is 10.998 and
// the schedule says 11, so it misses and waits for 12.498. §6.7's "fires at the first boundary STRICTLY
// AFTER" is the right consequence attached to the wrong cause, and the cause is what sets the fix's
// safety margin.
//
// ── WHAT THIS PRINTS ──────────────────────────────────────────────────────────────────────────────
// Per haste level: the model's and the sim's cast-start grids, the drift at the first/median/last
// cast, and whether the drift stays inside the margin `sim/planspec.mjs` budgets for.
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { loadEngine, ALL_BUFFS } from './engine-node.mjs';
import { REF } from './reference-gear.mjs';
import { build } from './genapl-core.mjs';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const RUNNER = process.env.RUNNER || '/tmp/wowsims-build/tbc-new/runner-ap180';
const argv = process.argv.slice(2);
const flag = (n, d) => { const i = argv.indexOf(`--${n}`); return i < 0 ? d : argv[i + 1]; };
const DUR = +flag('dur', '300');
const IDX = flag('index', '/tmp/index-round.html');
if (!fs.existsSync(RUNNER)) { console.error(`ERROR: no RUNNER at ${RUNNER}`); process.exit(2); }

const api = loadEngine(IDX);
const AB = 30451;

console.log(`# cast-lattice drift, BARE stream (no cooldowns), ${DUR}s, runner ${path.basename(RUNNER)}\n`);
console.log('  haste   casts (model/sim)   drift @cast1    @median      @last     per-cast');
const rows = [];
for (const h of [0, 40, 80, 130, 200, 300]) {
  const en = {}; for (const k of ALL_BUFFS) en[k] = false;
  const cfg = { T: DUR, hasteRating: h, ...REF, enabled: en, fixed: {}, warnings: [], coldSnap: false, segments: null };
  const r = api.simulate({}, cfg, true);
  const model = r.casts.map(c => c.t);

  const apl = `/tmp/lattice-${h}.json`, log = `/tmp/lattice-${h}.log`;
  fs.writeFileSync(apl, JSON.stringify(build({ _prestack: 0 })));
  try {
    execFileSync(RUNNER, ['--export', path.join(REPO, 'tools/bench/export.json'), '--apl', apl,
      '--dur', String(DUR), '--var', '0', '--iter', '1', '--seed', '11', '--mana', '100000000',
      '--haste', String(h), '--quiet'],
      { env: { ...process.env, SIMLOG: '1' }, maxBuffer: 1 << 28,
        stdio: ['ignore', fs.openSync(log, 'w'), fs.openSync(log, 'a')] });
  } catch { /* the log is the instrument */ }
  const txt = fs.readFileSync(log, 'utf8');
  const sim = [...txt.matchAll(new RegExp(`\\[\\s*([0-9.]+)\\]\\s*\\[Player[^\\]]*\\] Casting \\{SpellID: ${AB}\\}`, 'g'))].map(m => +m[1]);
  if (!sim.length) { console.log(`  ${String(h).padStart(5)}   (no AB cast lines parsed)`); continue; }

  const n = Math.min(model.length, sim.length);
  const d = i => sim[i] - model[i];
  const last = d(n - 1);
  rows.push({ h, last });
  console.log(`  ${String(h).padStart(5)}   ${String(model.length).padStart(4)}/${String(sim.length).padEnd(4)}       ` +
    `${d(0).toFixed(3).padStart(7)}s  ${d(n >> 1).toFixed(3).padStart(8)}s  ${last.toFixed(3).padStart(8)}s  ` +
    `${(last / Math.max(1, n - 1) * 1000).toFixed(3).padStart(7)} ms`);
}
// ⚠ the log prints 2 decimals, so every drift below ~5 ms is at the printing floor — the SIGN and the
// GROWTH are the readable signal, not the third decimal.
const worst = rows.reduce((a, b) => Math.abs(b.last) > Math.abs(a.last) ? b : a, { h: null, last: 0 });
console.log(`\n  worst end-of-fight drift: ${worst.last.toFixed(3)}s at haste ${worst.h}`);
console.log('  (drift is one-signed and grows with cast count: it is a CONSTANT mismatch, not noise.)');
console.log('\n  For the transcription: a schedule value must land strictly inside the sim interval that');
console.log('  precedes the intended boundary, so its margin must exceed this drift. planspec.mjs');
console.log('  schedules at the MIDPOINT of the preceding model interval — margin ≥ half a cast (≥0.5s).');
