// WHAT DOES THE SCORER PAY FOR A CAST THAT DOES NOT FINISH BEFORE A BOUNDARY?
//
//   node tools/wall-credit.mjs [--preset "2:40 lust 0:07 intermission 1:30-2:10"]
//
// ── THE TWO BOUNDARIES ARE NOT THE SAME PROBLEM, AND CONFLATING THEM IS THE WHOLE POINT ──────────
//
// **The KILL is uncertain.** Nobody knows the exact second the boss dies, so a cast completing near T
// is worth `dmg × P(boss still alive at completion)`. With a uniform kill over T ± KILL_WINDOW that is
// a linear ramp, and `robust` already applies it (`index.html:1183`): a cast completing exactly at T is
// paid **0.5**, one completing at T − 0.5 is paid 1.0, one at T + 0.5 is paid 0.
//   ★ The fraction depends on WHEN THE CAST COMPLETES — never on how far through the cast the boundary
//   cut it. A 0.75 s cast and a 2.5 s cast that both complete at T + 0.3 are worth exactly the same,
//   because the boss's survival does not care how long you had been channelling. Crediting cast
//   PROGRESS instead would pay for damage that never lands and would bias the search toward parking
//   casts against the edge, with no mechanism behind it.
//
// **An INTERMISSION wall is known exactly.** The boss goes untargetable at a scheduled second. There
// is no distribution to integrate: a cast completing after the wall deals **zero**. Partial credit here
// is not a smoothing convenience, it is a payment for damage that provably does not occur.
//
// ── ⚠ WHAT THIS PROBE FOUND, 2026-07-27 — THE MODEL PAYS FULL PRICE AT AN INTERMISSION WALL ──────
// The walk advances one cast at a time and reads its segment at the cast's START (`index.html:994`);
// the credit test at `:1183-1184` only ever asks `tcC <= cfg.T`. Nothing asks whether the cast
// COMPLETED into downtime. Measured on `2:40 lust 0:07 intermission 1:30-2:10`:
//
//     cast starts 89.616  ·  wall at 90.000  ·  completes 91.114  ·  credited dmg = 2242.1
//
// i.e. **full value for a cast that finishes 1.114 s into a window where the boss cannot be hit.**
// The sibling helper `dmgOf` gets this right — `index.html:1327`, `if (nonAB(segAt(tc))) return 0;
// // completes into downtime/AoE — no AB damage` — so the rule is already written down in this file,
// one function over, and the main walk does not apply it. That is the shape of every scoring bug this
// phase has found: the correct rule exists somewhere and the path that RANKS does not take it.
//
// ⇒ The fix is `dmg = 0` when the completion lands in an intermission, NOT partial credit. It is a
// scoring change, so plans will move and it rides alone (PHASE12 §0.3).
//
// ⚠ Adjacent and NOT settled by this probe: a cast starting in a normal segment and completing inside
// an **AoE** phase. `dmgOf` treats that as zero too (`nonAB` covers `aoe`), but the boss IS targetable
// there, so zero is not obviously right — the cast lands, it just lands during AoE. Decide it
// deliberately rather than inheriting it from this fix.
//
// Exit: 0 = probed and clean · 1 = probed and the scorer over-credits · 2 = could not probe.
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadEngine, cfgFor } from './engine-node.mjs';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const argv = process.argv.slice(2);
const flag = (n, d) => { const i = argv.indexOf(`--${n}`); return i < 0 ? d : argv[i + 1]; };
const die = m => { console.error('ERROR: ' + m); process.exit(2); };

const api = loadEngine(process.env.ENGINE || path.join(REPO, 'index.html'));
const NAME = flag('preset', '2:40 lust 0:07 intermission 1:30-2:10');
const kase = api.cases.find(c => c.name === NAME) || die(`no preset "${NAME}" — see tools/bench.mjs --list`);
const cfg = cfgFor(api, kase);
const walls = (cfg.segments || []).filter(s => s.type === 'intermission');
if (!walls.length) die(`preset "${NAME}" has no intermission — this probe needs a hard wall to test.`);

// A deliberately plain schedule: the question is about the SCORER, not about a clever layout.
const S = api.repair({ bloodlust: [7], arcanePower: [7], icyVeins: [7] }, cfg);
const r = api.simulate(S, cfg, true);
if (!r.casts || !r.casts.length) die('simulate returned no cast board — pass collect=true');

const inWall = x => walls.some(w => x > w.start + 1e-9 && x < w.end - 1e-9);
console.log(`# wall-credit — "${NAME}"`);
console.log(`  T = ${cfg.T} · intermissions ${JSON.stringify(walls.map(w => [w.start, w.end]))}\n`);

const spanning = r.casts.filter(c => !inWall(c.t) && inWall(c.t + c.cast));
console.log('  casts that START before a wall and COMPLETE inside the untargetable window:');
if (!spanning.length) console.log('    (none on this schedule — try another preset or layout)');
for (const c of spanning)
  console.log(`    start ${c.t.toFixed(3)}  →  end ${(c.t + c.cast).toFixed(3)}   credited dmg = ${c.dmg.toFixed(1)}` +
    `   ${c.dmg > 0 ? '⚠ SHOULD BE 0 — boss untargetable' : '✓ zero'}`);
const overcredited = spanning.filter(c => c.dmg > 0);

// The kill edge, for contrast: here partial credit is CORRECT, and `robust` already applies it.
const tail = r.casts.filter(c => c.t + c.cast > cfg.T + 1e-9);
console.log('\n  for contrast — the KILL edge, where partial credit is right and already implemented:');
console.log(`    total  = ${r.total.toFixed(1)}   (hard cut: only casts completing by T)`);
console.log(`    robust = ${r.robust.toFixed(1)}   (kill taper: dmg × P(alive at completion), T ± 0.5 s)`);
for (const c of tail.slice(0, 2)) {
  const frac = Math.min(1, Math.max(0, (cfg.T + 0.5 - (c.t + c.cast)) / 1.0));
  console.log(`    a cast completing ${(c.t + c.cast).toFixed(3)} (T+${((c.t + c.cast) - cfg.T).toFixed(3)}) is paid ` +
    `${(100 * frac).toFixed(1)} % of ${c.dmg.toFixed(1)} — and would be paid the SAME whatever its cast LENGTH.`);
}

console.log('');
if (overcredited.length) {
  console.log(`‼ ${overcredited.length} cast(s) credited at FULL value for damage that cannot land.`);
  console.log('  Fix is dmg = 0 on completion-into-downtime, matching `dmgOf` at index.html:1327 —');
  console.log('  NOT partial credit: an intermission wall is known exactly, so there is no');
  console.log('  distribution to integrate and nothing to smear. See this file\'s header.');
  process.exit(1);
}
console.log('✓ no cast is credited for completing into downtime.');
