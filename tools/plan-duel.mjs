// THE DUEL — verification scoped to what actually changed (docs/PHASE9.md §5.4).
//
// The user's rule, which this implements: *"if you implement a rule, you only need to test the
// things it affected. If the model's output is exactly the same for a setup there's no reason to
// re-test it. But if it DOES change, retest against its PREVIOUS layout — even if the diagonal and
// monotonicity improve, that one spot may be worse than its previous iteration."*
//
// `monoDip` / `diagWorst` / CLEAN-vs-DEFICIT are AGGREGATES. An aggregate can hold or improve while
// a single cell regresses. So for every cell `plan-diff.mjs` reports as CHANGED, this puts the OLD
// schedule and the NEW schedule head to head — same cfg, same engine, same sim harness, same seeds.
//
//   node tools/plan-diff.mjs A.json B.json          # WHICH cells moved
//   node tools/plan-duel.mjs --old A.json --new B.json [--sim]   # whether each move was an UPGRADE
//
// ─────────────────────────────────────────────────────────────────────────────────────────────
// ★★ TWO TRAPS THIS TOOL EXISTS TO NOT FALL INTO
//
// (1) **NEVER SUBTRACT TWO RUNS' RECORDED SCORES.** Sweep A's `score` and sweep B's `score` come
//     from two different engines. If the scorer moved at all, that subtraction prices two plans in
//     two currencies and reports the exchange rate as a verdict. This is exactly the PHASE8 §20.6
//     repricing trap (`t5two`, effective SP ≈1450) that made round-4 and round-5 xval tables
//     incomparable. Both schedules are therefore RE-SCORED here, under one engine at a time.
//
// (2) **IF THE SCORER CHANGED, THE MODEL CANNOT ARBITRATE ITS OWN CHANGE.** The new optimizer
//     maximized the new scorer, so "the new scorer prefers the new plan" is true by construction and
//     means nothing. That is circular, and a circular PASS is the defect class this repo tracks.
//     So the tool MEASURES whether the scorer moved (does each engine give the SAME schedule the
//     SAME score?) instead of trusting the caller to declare it — and when it did move, the model
//     verdict is withheld and the sim becomes the only arbiter. No `--sim`, no verdict: **exit 2
//     (could not grade)**, never a green.
//
// ─────────────────────────────────────────────────────────────────────────────────────────────
// ★★ THE TWO RULES THAT LET IT GRADE ANYWAY (and the one that stops it)
//
// Blanket refusal whenever the scorer moves would make this tool nearly useless — most real edits
// touch pricing. Two asymmetries rescue most cells without a single sim run:
//
// (A) **THE CONFESSION RULE.** Circularity has a DIRECTION. `newEngine(new) > newEngine(old)` is
//     true by construction and proves nothing. But `newEngine(new) < newEngine(old)` — the new
//     engine ranking the OLD plan higher — is a confession: the search was free to keep the old
//     layout and score better under its own objective, and didn't. No repricing can manufacture
//     that direction. It is a SEARCH-MISS, gradeable with no sim. Crucially this can only ever
//     turn CANNOT-GRADE into a FAILURE, never into a pass — a refinement that can only get
//     stricter cannot introduce the false-pass defect class this repo tracks.
//
// (B) **THE FEASIBLE-SET GUARD**, which must be tested FIRST and is what stops (A) from lying.
//     Every model verdict benchmarks against `newEngine(old plan)`. That number is meaningless if
//     the new build could not legally EMIT the old plan. This is ORTHOGONAL to the scorer moving:
//     a pure CONSTRAINT change (a cooldown, a use cap) leaves simulate()'s pricing bit-identical —
//     so `scorerMoved` reads FALSE — while making the old layout unreachable. Measured, not
//     assumed: repair the old plan under the NEW build and check the score survives.
//
// Exit codes: 0 = every changed cell graded and non-regressing · 1 = a cell REGRESSED · 2 = could
// not grade. Could-not-grade beats every other verdict.
//
// ─────────────────────────────────────────────────────────────────────────────────────────────
// CONTROLS THIS TOOL HAS PASSED (re-run them after any edit to the verdict chain — an instrument
// whose failure mode is a PASS must be exercised in BOTH directions, never just the happy one):
//
//   C1  identical plans (index.html vs its instrumented census copy)
//         → "NO CHANGED CELLS", exit 0.                                   [negative control]
//   C2  PRNG seed 1337→4242, and C2b `starts` clamped 14→1
//         → 0 of 16 plans changed, exit 0.  (Both became FINDINGS in their own right — PHASE9.)
//   C3  `isc.dur` 20→18 — a pure PRICING change
//         → scorerMoved TRUE on all 8 changed cells; 5 graded ★REGRESSION by the confession rule,
//           3 correctly refused (1 indifferent at Δ0, 2 preferring the new plan). exit 2.
//   C4  `isc.cd` 120→180 — a pure CONSTRAINT change, the adversarial case for (A)
//         → scorerMoved reads FALSE (pricing untouched), and WITHOUT guard (B) the tool called 9
//           cells "★ REGRESSION under an UNCHANGED objective": confident, precise, and entirely
//           false — the old `isc:[5,127]` is 122s apart and simply illegal at cd:180. With (B):
//           10 honest CANNOT-GRADEs, 0 false accusations. exit 2.
//
// Sim duel (`--sim`) needs RUNNER + EXPORT_BASE, as xval does. It is a RANKING test under a common
// harness, not an absolute-agreement test: both sides run the same gear export at the same
// `--haste`, so a gear mismatch against the preset cancels in the difference.
import { execFileSync } from 'node:child_process';
import { BENCH, runnerFlags } from '../sim/benchmark.mjs';   // the ONE duel protocol — never retype `--var 0.5` / `--mana 1e8` here, and never hand-assemble the argv either
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { loadEngine, cfgFor } from './engine-node.mjs';
import { planToSpec } from '../sim/planspec.mjs';

const die = m => { console.error('DUEL ERROR: ' + m); process.exit(2); };
const arg = k => { const a = process.argv.find(x => x.startsWith(`--${k}=`)); if (a) return a.slice(k.length + 3);
                   const i = process.argv.indexOf(`--${k}`); return i > 0 && !String(process.argv[i + 1] || '').startsWith('--') ? process.argv[i + 1] : null; };
const flag = k => process.argv.includes(`--${k}`);

const OLD_J = arg('old'), NEW_J = arg('new');
if (!OLD_J || !NEW_J) die('usage: node plan-duel.mjs --old A.json --new B.json [--old-html X] [--new-html Y] [--sim] [--seeds 11,100011,200011] [--iter 6000] [--only "case name"]');

const readJson = p => { try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch (e) { die(`cannot read ${p}: ${e.message}`); } };
const A = readJson(OLD_J), B = readJson(NEW_J);

// A sweep that did not complete cannot found a duel: an ERROR cell has no schedule, and a cell
// silently absent from one side would read as "unchanged" — a PASS produced by missing data.
for (const [tag, S, p] of [['old', A, OLD_J], ['new', B, NEW_J]]) {
  if (!Array.isArray(S.cells) || !S.cells.length) die(`${p} has no cells.`);
  const errs = S.cells.filter(c => c.error);
  if (errs.length) die(`${tag} sweep ${p} has ${errs.length} ERROR cell(s) (${errs.map(c => c.name).join(', ')}) — an incomplete sweep cannot found a duel.`);
}

// ── pair the corpora by NAME, and refuse on any asymmetry ─────────────────────────────────────
const aBy = new Map(A.cells.map(c => [c.name, c])), bBy = new Map(B.cells.map(c => [c.name, c]));
const onlyA = [...aBy.keys()].filter(n => !bBy.has(n)), onlyB = [...bBy.keys()].filter(n => !aBy.has(n));
if (onlyA.length || onlyB.length)
  die(`the two sweeps do not cover the same corpus — old-only: [${onlyA.join(', ')}] new-only: [${onlyB.join(', ')}]. ` +
      `Re-sweep both with the same --max-t; a case present on one side only cannot be duelled and must not be counted as unchanged.`);

const ONLY = arg('only');
const changed = [...aBy.keys()]
  .filter(n => JSON.stringify(aBy.get(n).s) !== JSON.stringify(bBy.get(n).s))
  .filter(n => !ONLY || n === ONLY);
if (ONLY && !aBy.has(ONLY)) die(`--only "${ONLY}" is not in the corpus.`);

if (!changed.length) {
  console.log(`DUEL: NO CHANGED CELLS across ${aBy.size} case(s)${ONLY ? ` (filtered to "${ONLY}")` : ''} — nothing to duel.`);
  console.log(`Per the scoping rule, an unchanged plan under an unchanged sim needs no re-test.`);
  process.exit(0);
}

// ── engines ───────────────────────────────────────────────────────────────────────────────────
const REPO = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const exists = p => { try { return !!p && fs.statSync(p).isFile(); } catch { return false; } };
const OLD_H = arg('old-html') || (exists(A.html) ? A.html : null);
const NEW_H = arg('new-html') || (exists(B.html) ? B.html : path.join(REPO, 'index.html'));
if (!OLD_H) die(`the old engine is not available: ${OLD_J} recorded html="${A.html}" which no longer exists. ` +
                `Pass --old-html (e.g. a git worktree of the pre-change index.html). Without it the scorer-change ` +
                `test cannot run, and without THAT the model verdict may be circular.`);
if (!exists(NEW_H)) die(`--new-html ${NEW_H} does not exist.`);

const oldEng = loadEngine(OLD_H), newEng = loadEngine(NEW_H);
const caseOf = (eng, name) => eng.cases.find(c => c.name === name);

// ── sim plumbing (mirrors tools/xval.mjs; see its comments for the subtleties) ────────────────
// equip = the item worn; key = the genapl action that FIRES it. scb is the subtle one: wear
// Serpent-Coil Braid (30720), but the +225 SP is granted by CASTING a Mana Emerald (22044).
const TMETA = { isc: { item: 29370, key: 'Icon' }, scb: { item: 30720, key: 'Gem' },
                skull: { item: 32483, key: 'Skull' }, mqg: { item: 19339, key: 'MQG' } };
// Buffs the model can plan but genapl CANNOT express. Left unchecked these are dropped in silence
// and the sim runs a fight that is missing a cooldown — this harness's dominant failure mode
// (genapl's own header calls it out). A cell using one of these is UNSIMMABLE, not "simmed fine".
const NO_APL = ['ati', 'powerInfusion', 'drums'];

// ★★★ TRANSCRIPTION IS `sim/planspec.mjs`, NOT A PRIVATE COPY (PHASE11 §1.1 B4, fixed 07-26).
//
// This function used to be a hand-rolled twin that emitted `best.s` press INTENTS with `Math.round`.
// The canonical convention since P7.15 is **fire times, FLOORED** — the intent snapped forward to the
// next cast boundary (`simulate(s, cfg, true).actEff`) — because genapl schedules every cooldown
// unconditionally, so feeding intents makes the sim press mid-downtime and buff a burn the model
// never charged. That exact mis-transcription cost −1.5% on a KT plan when `xval.mjs` had it.
//
// The divergence is not hypothetical and not small: on the first golden case, an Arcane Power intent
// of `4` fires at **4.667**. The two conventions agree only when the intent already sits on a cast
// boundary. So the arbitration tool — the one used to decide whether an engine change is a
// regression — was duelling plans the tool never prints.
//
// It is now the shared module, which also retires four private re-derivations: the Cold Snap split,
// the intermission/AoE extraction, the target count, and the untranscribable-buff check (planspec
// REPORTS what it dropped via `skipped`, rather than each caller keeping its own NO_APL list).
function toSpec(s, cfg, eng) {
  const optR = eng.simulate(s, cfg, true);       // `true` ⇒ detail, which is what carries actEff
  return planToSpec({ cfg, best: { s }, optR }, eng.BUFFS);
}

const SIM = flag('sim');
let RUNNER, EXPORT, SEEDS, ITER, SCRATCH;
if (SIM) {
  RUNNER = process.env.RUNNER; const BASE = process.env.EXPORT_BASE;
  if (!RUNNER || !BASE) die('--sim needs RUNNER=/path/to/runner and EXPORT_BASE=/path/to/gear-export.json');
  for (const [n, p] of [['RUNNER', RUNNER], ['EXPORT_BASE', BASE]])
    if (!exists(p)) die(`${n}="${p}" does not exist — a missing binary surfaces as an ENOENT stack trace mid-duel rather than as a refusal.`);
  // ★★ MEASURED DEFECT, FIXED 07-25 (P7.13-S3). The old default was `11,12,13,14,15` — CONTIGUOUS
  // seeds, which TOOLING §"Statistical protocol" says are not independent replicates (per-iteration
  // seed = base + i, so at iter=6000 seeds 11 and 12 share 5999 of 6000 iterations). `tools/cell-band.mjs`
  // measured what that costs on a real cell: seeds 12–15 reproduced seed 11 to the printed decimal on
  // BOTH plans ⇒ **sd = 0.0000, band = ±0.0000**, while independent seeds gave sd 0.0058 pp. A zero band
  // makes `|mean| > band` TRUE for every nonzero delta, so this tool declared every delta significant —
  // a false-PASS in the one instrument whose entire job is arbitration. Defaults are now spaced by 10⁵
  // (≫ any iter we run). Do not "tidy" them back into a contiguous run.
  SEEDS = (arg('seeds') || BENCH.seeds.join(',')).split(',').map(x => parseInt(x, 10));
  if (SEEDS.some(x => !Number.isInteger(x))) die('--seeds must be a comma-separated list of integers.');
  // The band below is a spread ACROSS seeds. With fewer than 3 there is no spread to speak of and
  // the tool would print a confident delta with no way to know if it is noise.
  if (SEEDS.length < 3) die(`--seeds needs at least 3 values for a noise band (got ${SEEDS.length}). A delta with no band is a guess with a decimal point.`);
  ITER = arg('iter') || process.env.ITER || '6000';
  // A band across seeds is only a band if the seeds draw different iterations. Contiguous seeds at
  // iter=N share N−|Δ| of N iterations and collapse the band to ~0 (measured: exactly 0).
  {
    const s = SEEDS.slice().sort((a, b) => a - b);
    const minGap = Math.min(...s.slice(1).map((v, i) => v - s[i]));
    if (minGap < +ITER) die(`--seeds are spaced ${minGap} apart but iter=${ITER}: seeds closer than iter share ` +
      `${+ITER - minGap} of ${ITER} iterations and the resulting "band" is ~0, which passes every delta. ` +
      `Space base seeds by >= iter (e.g. 11,100011,200011,300011,400011).`);
  }
  SCRATCH = fs.mkdtempSync(path.join(os.tmpdir(), 'duel-'));
  EXPORT = { base: JSON.parse(fs.readFileSync(BASE, 'utf8')), path: path.join(SCRATCH, 'export.json') };
}

function simDps(spec, cfg, targets, trinkets, seed) {
  const exp = JSON.parse(JSON.stringify(EXPORT.base));
  exp.player.equipment.items[12] = { id: TMETA[trinkets[0]].item };
  exp.player.equipment.items[13] = { id: TMETA[trinkets[1]].item };
  fs.writeFileSync(EXPORT.path, JSON.stringify(exp));
  const apl = path.join(SCRATCH, 'duel.apl.json');
  execFileSync('node', [path.join(REPO, 'tools/genapl.mjs'), JSON.stringify(spec), apl]);
  // ★ The flag SHAPE comes from runnerFlags() too, not just the values (PHASE11 §1.1 B4).
  // Hand-assembling the argv while importing BENCH for the numbers is the pattern
  // sim/benchmark.mjs:13-14 explicitly forbids: it keeps the two sides agreeing on constants while
  // letting them drift on which flags are passed at all — and a flag this tool forgets is a setting
  // the runner silently defaults, with no disagreement for the anti-drift gate to catch.
  const args = runnerFlags({ export: EXPORT.path, apl, T: cfg.T, iterations: ITER, seed,
                             hasteRating: cfg.hasteRating || 0, targets, tag: 'm' });
  const out = execFileSync(RUNNER, args, { encoding: 'utf8' });
  const dps = parseFloat(out.trim().split(/\s+/)[4]);
  // A NaN here compares FALSE against everything, so it would slide through the verdict logic as
  // "not a regression" — the exact silent-double-PASS xval.mjs was bitten by.
  if (!Number.isFinite(dps)) die(`could not parse DPS (whitespace field 5) from runner output; last line was ${JSON.stringify(out.trim().split('\n').pop() || '')}`);
  return dps;
}

// ── the duel ──────────────────────────────────────────────────────────────────────────────────
console.log(`DUEL — ${changed.length} changed cell(s) of ${aBy.size}\n  old: ${OLD_J} (${OLD_H})\n  new: ${NEW_J} (${NEW_H})` +
            (SIM ? `\n  sim: ${path.basename(RUNNER)} seeds=[${SEEDS}] iter=${ITER}` : `\n  sim: OFF (--sim to enable)`));

const rows = [];
for (const name of changed) {
  const cOld = caseOf(oldEng, name), cNew = caseOf(newEng, name);
  if (!cOld || !cNew) die(`case "${name}" is in the sweeps but not in one of the engines' preset tables.`);
  const cfgOld = cfgFor(oldEng, cOld), cfgNew = cfgFor(newEng, cNew);
  const norm = g => JSON.stringify({ ...g, warnings: undefined });
  // If the PRESET itself moved between the two builds, the two schedules answer two different
  // questions and there is no duel to run — only the appearance of one.
  if (norm(cfgOld) !== norm(cfgNew))
    die(`case "${name}" has a DIFFERENT SETUP in the two builds (the preset changed, not just the plan) — these two plans are not comparable.`);

  const sOld = aBy.get(name).s, sNew = bBy.get(name).s;
  const sc = (eng, s) => eng.simulate(s, cfgFor(eng, cNew)).robust;
  const oldOnOld = sc(oldEng, sOld), oldOnNew = sc(oldEng, sNew);
  const newOnOld = sc(newEng, sOld), newOnNew = sc(newEng, sNew);

  // MEASURED, not declared: does each engine give the SAME schedule the SAME score?
  const scorerMoved = Math.abs(oldOnOld - newOnOld) > 1e-9 || Math.abs(oldOnNew - newOnNew) > 1e-9;

  // Is the OLD plan something the NEW engine would actually stand behind? `newOnOld` prices a
  // schedule the old build emitted; if the new build's legality rules would rewrite it, that
  // price is a PHANTOM — a score for a line the new engine would never itself produce. We only
  // need the operational version of "legal": repair it under the new rules and see whether the
  // score survives. A cosmetic re-ordering is fine; a score change is not.
  let phantom = null;
  try {
    const rOld = newEng.repair(JSON.parse(JSON.stringify(sOld)), cfgNew);
    if (Math.abs(sc(newEng, rOld) - newOnOld) > 1e-9)
      phantom = 'the NEW build repairs the old plan to a different score — newOnOld is a price for a line the new engine would never emit';
  } catch (e) { phantom = `the NEW build could not repair the old plan (${e.message})`; }

  const row = { name, sOld, sNew, oldOnOld, oldOnNew, newOnOld, newOnNew, scorerMoved, phantom,
                dModel: newOnNew - newOnOld, dOldModel: oldOnNew - oldOnOld };

  if (SIM) {
    const trinkets = Object.keys(TMETA).filter(k => cfgNew.enabled[k]);
    const blocked = NO_APL.filter(k => cfgNew.enabled[k]);
    if (blocked.length) row.unsimmable = `kit uses ${blocked.join('+')}, which genapl cannot express — simming it would silently omit the buff`;
    else if (trinkets.length !== 2) row.unsimmable = `kit has ${trinkets.length} on-use trinket(s); the export has exactly 2 slots`;
    else {
      const a = toSpec(sOld, cfgNew, newEng), b = toSpec(sNew, cfgNew, newEng);
      // planspec reports what it could not transcribe instead of dropping it in silence. A burn phase
      // has no sim equivalent at all, and a skipped buff means the sim would run a fight missing a
      // cooldown — either way the duel is not a duel, so say so rather than print a number.
      const lost = [...new Set([...a.skipped, ...b.skipped])];
      if (a.burn || b.burn) { row.unsimmable = 'fight has a BURN phase — a model construct the sim has no knob for'; rows.push(row); continue; }
      if (lost.length) { row.unsimmable = `genapl cannot express ${lost.join(', ')} — simming it would silently omit the buff`; rows.push(row); continue; }
      const d = [];
      for (const seed of SEEDS) {                      // COMMON RANDOM NUMBERS: same seed both sides
        const dOld = simDps(a.spec, cfgNew, a.targets, trinkets, seed);
        const dNew = simDps(b.spec, cfgNew, b.targets, trinkets, seed);
        d.push(dNew - dOld);
      }
      const mean = d.reduce((x, y) => x + y, 0) / d.length;
      const sd = Math.sqrt(d.reduce((x, y) => x + (y - mean) ** 2, 0) / Math.max(1, d.length - 1));
      row.sim = { deltas: d, mean, band: 2 * sd / Math.sqrt(d.length) };   // ≈95% on the paired mean
    }
  }
  rows.push(row);
}

// ── verdicts ──────────────────────────────────────────────────────────────────────────────────
const f = x => (x >= 0 ? '+' : '') + x.toFixed(3);
let regressed = 0, ungraded = 0;
for (const r of rows) {
  console.log(`\n─── ${r.name}`);
  console.log(`  old  ${JSON.stringify(r.sOld)}`);
  console.log(`  new  ${JSON.stringify(r.sNew)}`);
  console.log(`  model @NEW engine : old ${r.newOnOld.toFixed(3)}  new ${r.newOnNew.toFixed(3)}  Δ ${f(r.dModel)}`);
  console.log(`  model @OLD engine : old ${r.oldOnOld.toFixed(3)}  new ${r.oldOnNew.toFixed(3)}  Δ ${f(r.dOldModel)}`);
  if (r.sim) {
    const { mean, band, deltas } = r.sim;
    const call = Math.abs(mean) <= band ? 'INSIDE NOISE' : mean > 0 ? 'new wins' : 'OLD wins';
    console.log(`  sim  (paired, ${deltas.length} seeds): Δ ${f(mean)} DPS ± ${band.toFixed(2)}  → ${call}`);
  } else if (r.unsimmable) console.log(`  sim  UNSIMMABLE — ${r.unsimmable}`);

  if (r.phantom) {
    // ── THE FEASIBLE-SET GUARD ────────────────────────────────────────────────────────────────
    // Every model comparison below benchmarks the new plan against `newOnOld` — the new engine's
    // price for the OLD plan. That benchmark is only meaningful if the new engine could actually
    // EMIT the old plan. When it can't, `newOnOld` credits the new build with a line its own
    // rules forbid, and the delta measures the illegality, not the search.
    //
    // This is ORTHOGONAL to whether the scorer moved, which is why it has to be tested first: a
    // pure CONSTRAINT change (a cooldown, a use cap, a legality rule) leaves simulate()'s pricing
    // bit-identical — scorerMoved reads FALSE — while making the old layout unreachable. Without
    // this guard the tool takes that branch and reports "the search got WORSE under an UNCHANGED
    // objective" on every such cell: a confident, precise, actionable, and entirely false
    // accusation. The feasible set moved; the search did not regress.
    console.log(`  VERDICT: ⚠ CANNOT GRADE — the FEASIBLE SET moved, not (only) the score.`);
    console.log(`           ${r.phantom}.`);
    console.log(`           The two plans do not live in the same legal space, so no model delta between them means anything.`);
    console.log(`           ${r.unsimmable ? 'And this cell is UNSIMMABLE: ' + r.unsimmable : 'Only a sim of the two ACTUAL lines can rank them (--sim).'}`);
    ungraded++;
  } else if (!r.scorerMoved) {
    // Same objective on both sides ⇒ the model is a legitimate arbiter (CLAUDE.md: the effective-AB
    // count is what the tool maximizes, so it is what ranks two lines).
    if (r.dModel < -1e-9) { console.log(`  VERDICT: ★ REGRESSION — the search got WORSE at this cell under an UNCHANGED objective.`); regressed++; }
    else if (r.dModel > 1e-9) console.log(`  VERDICT: IMPROVED (search found a better plan under the same objective).`);
    else console.log(`  VERDICT: TIE on score — a legibility/tie-break move, not a value change.`);
  } else if (r.dModel < -1e-9 && !r.phantom) {
    // ── THE CONFESSION RULE ───────────────────────────────────────────────────────────────────
    // Circularity is ASYMMETRIC, and that asymmetry is the only reason this tool can grade at
    // all once the scorer has moved:
    //   dModel > 0  "the new engine prefers the new plan" — TRUE BY CONSTRUCTION. The search
    //               maximized that very objective, so a positive delta is an artifact of the
    //               setup, not evidence. This is the PHASE8 §20.6 repricing trap.
    //   dModel < 0  "the new engine prefers the OLD plan" — a CONFESSION. The new objective
    //               itself says the search left value on the table at this cell. Nothing about
    //               the scorer change can manufacture this: the search was free to keep the old
    //               layout and score higher under its own currency, and it didn't. That is a
    //               SEARCH-MISS in the Phase-7 sense, and it is valid whether or not the scorer
    //               moved. The old engine's opinion is not needed and is not used.
    //
    // Note which way this escape hatch can move a verdict: it converts CANNOT-GRADE into a
    // REGRESSION, never into a pass. Per the project's false-pass defect class (§ the standing
    // doctrine: an instrument whose failure mode is a PASS), a refinement that can only ever get
    // STRICTER cannot introduce the failure we actually care about.
    console.log(`  VERDICT: ★ REGRESSION (CONFESSION) — the scorer moved, but the NEW engine itself ranks the OLD plan`);
    console.log(`           higher by ${(-r.dModel).toFixed(3)}. The search could have kept the old layout and scored better under`);
    console.log(`           its own objective. Not a repricing artifact — a SEARCH-MISS. No sim needed to call this.`);
    regressed++;
  } else if (r.sim) {
    const { mean, band } = r.sim;
    if (mean < -band) { console.log(`  VERDICT: ★ REGRESSION — the scorer changed, and the SIM ranks the old plan higher beyond the noise band.`); regressed++; }
    else if (mean > band) console.log(`  VERDICT: IMPROVED (scorer changed; the sim independently prefers the new plan).`);
    else console.log(`  VERDICT: NO SIM-DETECTABLE DIFFERENCE — the scorer changed and the sim cannot separate the two plans at this iteration count. Not evidence of an upgrade.`);
  } else {
    console.log(`  VERDICT: ⚠ CANNOT GRADE — the SCORER CHANGED, so "the new model prefers the new plan" is true by construction and proves nothing.`);
    // Say WHY the confession rule above didn't rescue this cell — otherwise "cannot grade" reads
    // as one undifferentiated bucket when it is really three distinct situations.
    if (r.phantom) console.log(`           The confession check is UNAVAILABLE here: ${r.phantom}.`);
    else if (Math.abs(r.dModel) <= 1e-9) console.log(`           The new engine is INDIFFERENT between the two plans (Δ 0) on a plan that visibly moved — it cannot rank them.`);
    else console.log(`           The new engine prefers the new plan, which is exactly the direction that proves nothing.`);
    console.log(`           ${r.unsimmable ? 'And this cell is UNSIMMABLE: ' + r.unsimmable : 'Re-run with --sim (RUNNER + EXPORT_BASE) — the sim is the only arbiter here.'}`);
    ungraded++;
  }
}

console.log(`\n${'═'.repeat(70)}`);
console.log(`DUEL SUMMARY: ${rows.length} changed cell(s) · ${regressed} REGRESSED · ${ungraded} could not be graded`);
const moved = rows.filter(r => r.scorerMoved);
if (moved.length) {
  const conf = moved.filter(r => r.dModel < -1e-9 && !r.phantom).length;
  console.log(`  note: the scorer MOVED on ${moved.length} cell(s). A POSITIVE model delta there is circular and was never used;`);
  console.log(`        ${conf} cell(s) were graded anyway by the CONFESSION rule (the new engine ranks the OLD plan higher — a`);
  console.log(`        direction the repricing cannot manufacture). The rest need --sim.`);
}
if (regressed) console.log(`  ⚠ An aggregate (monoDip / diagWorst / CLEAN) can improve while these cells got worse. That is what this tool is for.`);
process.exit(ungraded ? 2 : regressed ? 1 : 0);
