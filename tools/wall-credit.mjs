// BOUNDARY-CREDIT REGRESSION GATE — does the scorer pay only the FRACTION of a cast that fits?
//
//   node tools/wall-credit.mjs [--preset "2:40 lust 0:07 intermission 1:30-2:10"]
//
// Exit: 0 = every cast is credited correctly · 1 = the scorer mis-credits at a cut · 2 = could not probe.
//
// ── THE DEFECT THIS FILE WAS WRITTEN TO EXHIBIT, AND ITS FIX ─────────────────────────────────────
// Written 2026-07-27 as a PROBE. It measured, on `2:40 lust 0:07 intermission 1:30-2:10`:
//
//     cast starts 89.616  ·  wall at 90.000  ·  completes 91.114  ·  credited dmg = 2242.1
//
// i.e. FULL value for a cast finishing 1.114 s into a window where the boss cannot be hit. The walk
// read each cast's segment at its START and the credit test only ever asked `tcC <= cfg.T`, so
// nothing asked whether the cast COMPLETED into downtime.
//
// **That defect is FIXED** (PHASE12 §9, user ruling 07-27), and this file is now the gate that keeps
// it fixed. The probe's own conclusion was overturned in the fixing, which is worth recording: it
// argued for `dmg = 0` at a wall and partial credit only at the kill. The ruling went the other way —
// ONE uniform rule at every cut — and the reasoning is below.
//
// ── WHY THE TWO BOUNDARIES ARE THE SAME RULE (the ruling this file used to argue against) ────────
// The probe's case for treating them differently was that **the kill is uncertain** (nobody knows the
// second the boss dies, so credit is a survival probability) while **an intermission wall is known
// exactly** (the boss goes untargetable on a scheduled second, so a cast completing after it deals a
// hard zero). The ruling: an intermission does not land on the same second every pull either. Phase
// timers drift with raid damage, with the boss's own cast order, with a taunt landing late. Modelling
// the wall as exact is the identical mistake to modelling the kill as exact — it just feels safer
// because the number is written in a strategy guide.
//
// So there is one rule, at every cut:
//
//     credit = min(1, (nextCut - castStart) / castDuration)     ← multiplies the cast's own value
//
// A **cut** is any moment where the cast stops landing or the spell changes: the fight end T, an
// intermission start, and either edge of an AoE phase. A BURN edge is NOT a cut — the boss is
// targetable and the spell is the same, so a burn multiplier is a VALUE question under the snapshot
// rule, not a landing question.
//
// ★ It is not a smoothing heuristic. It is algebraically a ONE-SIDED window whose width is the cast's
// own duration: for the true cut ~ U[C, C+W], credit = (C + W − completion)/W, and setting W = the
// cast duration gives exactly (C − start)/duration. It reads "the cut happens no earlier than C, and
// no later than one cast after C". The RETIRED symmetric taper — which paid a cast completing exactly
// at T only 0.5 — was that same integral with a two-sided window where a one-sided one belongs.
//
// ★★ Note what the credit depends on, because the probe got this backwards too. Under the retired
// taper the fraction depended only on WHEN THE CAST COMPLETED, never on how far through the cast the
// boundary cut it. Under the credit rule it is the opposite by construction: the fraction IS the
// share of the cast that fits, so a 0.75 s cast and a 2.5 s cast whose completions both land at
// cut + 0.3 are NOT worth the same. That is the intended meaning — a longer cast has more of itself
// stranded past the boundary — and it is why this gate checks `frac` against the cast's own geometry
// rather than against a completion-time curve.
//
// ── WHAT THIS GATE ASSERTS, per cast on the board ────────────────────────────────────────────────
//   A. `frac` equals `min(1, max(0, (nextCut(start) - start) / cast))`, recomputed here from the
//      cast's own `t` and `cast` and from the cut lattice rebuilt from `cfg.segments` and `cfg.T`.
//   B. `credited` equals `dmg * frac` — the board reports the product the objective actually summed.
//   C. Every cast that COMPLETES past its next cut carries `frac < 1` strictly. This is the original
//      defect, stated as an assertion: it is the case that used to be paid in full.
//   D. `dmg` is still the cast's FULL damage (unscaled), so `dmg > credited` exactly on the cast in C.
// A wall-spanning cast is REQUIRED to exist — a preset that produces none cannot exercise the gate,
// and passing vacuously is the failure mode this repo keeps catching, so that exits 2, not 0.
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
if (!walls.length) die(`preset "${NAME}" has no intermission — this gate needs a hard wall to test.`);

// A deliberately plain schedule: the question is about the SCORER, not about a clever layout.
const S = api.repair({ bloodlust: [7], arcanePower: [7], icyVeins: [7] }, cfg);
const r = api.simulate(S, cfg, true);
if (!r.casts || !r.casts.length) die('simulate returned no cast board — pass collect=true');
if (r.casts[0].frac === undefined || r.casts[0].credited === undefined)
  die('the cast board carries no `frac`/`credited`. This engine predates the boundary-credit rule ' +
      '(PHASE12 §9); there is nothing for this gate to check and a silent pass would be a lie.');

// ── the cut lattice, rebuilt independently of the engine ─────────────────────────────────────────
// Mirrors index.html's construction: merge adjacent segments calling for the same thing, and a cut is
// a boundary between different ones. Rebuilt rather than imported, because a gate that reads the
// engine's own lattice cannot catch the engine building the wrong lattice.
// A cut is a segment START you would not carry a cast across: an intermission (cannot land) or an
// AoE phase (would cancel to spam Arcane Explosion). Far edges are not cuts.
const cutsAt = sg => !!sg && (sg.type === 'intermission' || sg.type === 'aoe');
const CUTS = [];
if (cfg.segments) for (let k = 0; k < cfg.segments.length; k++)
  if (cutsAt(cfg.segments[k]) && !cutsAt(cfg.segments[k - 1]) && cfg.segments[k].start > 1e-9)
    CUTS.push(cfg.segments[k].start);
CUTS.push(cfg.T);
CUTS.sort((a, b) => a - b);
const nextCut = ts => { for (const c of CUTS) if (c > ts + 1e-9) return c; return cfg.T; };
const expectFrac = c => c.cast > 1e-9 ? Math.min(1, Math.max(0, (nextCut(c.t) - c.t) / c.cast)) : 0;

console.log(`# wall-credit — boundary-credit regression gate — "${NAME}"`);
console.log(`  T = ${cfg.T} · intermissions ${JSON.stringify(walls.map(w => [w.start, w.end]))}`);
console.log(`  cut lattice (fight end + phase edges): [${CUTS.map(x => x.toFixed(3)).join(', ')}]\n`);

// ── A/B/D: the board is internally honest about the credit it applied ────────────────────────────
let badFrac = 0, badCredited = 0, badFull = 0;
for (const c of r.casts) {
  const f = expectFrac(c);
  if (Math.abs(c.frac - f) > 1e-9) {
    if (badFrac++ < 5) console.log(`  ✗ frac  start ${c.t.toFixed(3)} cast ${c.cast.toFixed(3)}: board ${c.frac.toFixed(6)} expected ${f.toFixed(6)}`);
  }
  if (Math.abs(c.credited - c.dmg * c.frac) > 1e-9) {
    if (badCredited++ < 5) console.log(`  ✗ credited  start ${c.t.toFixed(3)}: board ${c.credited.toFixed(3)} != dmg*frac ${(c.dmg * c.frac).toFixed(3)}`);
  }
  // D: `dmg` must stay the FULL value. A partial cast whose `dmg` was already scaled would be
  // double-docked by the objective and would make model-audit's damage comparison wrong.
  if (c.frac < 1 - 1e-9 && !(c.dmg > c.credited + 1e-9)) badFull++;
}
console.log(`  A  frac == min(1,(nextCut-start)/cast)   : ${badFrac ? `✗ ${badFrac} cast(s) wrong` : `✓ all ${r.casts.length} casts`}`);
console.log(`  B  credited == dmg * frac                : ${badCredited ? `✗ ${badCredited} cast(s) wrong` : '✓'}`);
console.log(`  D  dmg is the FULL (unscaled) damage     : ${badFull ? `✗ ${badFull} partial cast(s) have dmg <= credited` : '✓'}`);

// ── C: the original defect, as an assertion ──────────────────────────────────────────────────────
// Every cast completing past its next cut must be docked. Reported at both kinds of cut separately,
// because the whole point of the ruling is that they are one rule — so seeing both obey it is the
// evidence, not a formality.
const spanning = r.casts.filter(c => c.t + c.cast > nextCut(c.t) + 1e-9);
const inWall = x => walls.some(w => x > w.start + 1e-9 && x < w.end - 1e-9);
const atWall = spanning.filter(c => inWall(c.t + c.cast));
const atKill = spanning.filter(c => c.t + c.cast > cfg.T + 1e-9);
console.log(`\n  casts whose completion lands past their next cut: ${spanning.length}` +
            `  (${atWall.length} into an intermission, ${atKill.length} past the kill)`);
let undocked = 0;
for (const c of spanning) {
  const ok = c.frac < 1 - 1e-9;
  if (!ok) undocked++;
  const where = inWall(c.t + c.cast) ? 'intermission' : (c.t + c.cast > cfg.T ? 'kill' : 'cut');
  console.log(`    start ${c.t.toFixed(3)} → end ${(c.t + c.cast).toFixed(3)}  cut ${nextCut(c.t).toFixed(3)} (${where})` +
    `   frac ${c.frac.toFixed(4)}   dmg ${c.dmg.toFixed(1)} → credited ${c.credited.toFixed(1)}` +
    `   ${ok ? '✓ docked' : '‼ PAID IN FULL — the original defect is back'}`);
}
console.log(`  C  a cast completing past a cut is docked: ${undocked ? `✗ ${undocked} paid in full` : '✓'}`);

// ── the gate's own coverage: refuse to pass on a preset that exercises nothing ───────────────────
if (!spanning.length)
  die(`this schedule produced NO cast completing past a cut, so A-D were checked against nothing that\n` +
      `       could distinguish a working scorer from the broken one. Pick a preset/layout that strands a\n` +
      `       cast at a wall (the default preset does). Refusing to report a vacuous pass.`);
if (!atWall.length)
  die(`no cast completes into an intermission on this schedule. The kill edge alone cannot show that the\n` +
      `       SAME rule runs at a wall, which is the finding this gate exists to hold. Refusing to pass.`);

// ── E: THE AoE WALL, ON A CONSTRUCTED FIGHT — because NO PRESET EXERCISES ONE ────────────────────
// ⚠ This block exists because of a near-miss. The corpus has exactly one AoE fight (Kael'thas), and
// its Arcane Blast lattice lands on **exactly** 105.000, the phase start — so no cast straddles the
// wall, and `exact-match` came back 25/25 UNCHANGED across the entire AoE-cut ruling. A green suite
// there was not evidence; it was an alignment coincidence. So this builds a fight whose lattice
// cannot align, and asserts BOTH halves of the ruling directly:
//   · the straddling Blast is credited the fraction that FIT   (not 0, not 1)
//   · the Arcane Explosion stream starts AT THE WALL           (CANCELLED, not run to completion)
// The second half is the easy one to lose: crediting partially without truncating would pay less and
// gain nothing, which is a penalty rather than a policy.
let aoeBad = 0;
{
  const aoeCase = { name: 'wall-credit AoE probe', T: 120, phases: [{ from: 60, to: 80, type: 'aoe', targets: 5 }] };
  const c2 = cfgFor(api, aoeCase);
  const r2 = api.simulate(api.repair({ arcanePower: [5] }, c2), c2, true);
  const strad = r2.casts.filter(c => !c.ae && c.t < 60 - 1e-9 && c.t + c.cast > 60 + 1e-9).pop();
  const firstAE = r2.casts.find(c => c.ae);
  if (!strad) { console.log('  ✗ AoE probe: no cast straddles the wall — it cannot test what it exists to test.'); aoeBad++; }
  else {
    const want = (60 - strad.t) / strad.cast;
    if (Math.abs(strad.frac - want) > 1e-9) { console.log(`  ✗ AoE straddle: frac ${strad.frac.toFixed(6)}, expected ${want.toFixed(6)}`); aoeBad++; }
    if (!firstAE || Math.abs(firstAE.t - 60) > 1e-9) {
      console.log(`  ✗ AoE truncation: first Arcane Explosion at ${firstAE ? firstAE.t.toFixed(3) : '(none)'}, expected 60.000 — the Blast ran to completion instead of being cancelled.`);
      aoeBad++;
    }
    if (!aoeBad) console.log(`  D  AoE wall: Blast at ${strad.t.toFixed(3)} credited ${(100 * strad.frac).toFixed(1)}%, first Arcane Explosion at ${firstAE.t.toFixed(3)} — cancelled, not finished: ✓`);
  }
}

const fail = badFrac + badCredited + badFull + undocked + aoeBad;
console.log('');
if (fail) {
  console.log(`‼ ${fail} boundary-credit violation(s). The scorer is not applying`);
  console.log('  credit = min(1, (nextCut - castStart) / castDuration) at every cut.');
  console.log('  This is a REGRESSION of PHASE12 §9. Read this file\'s header before "fixing" it —');
  console.log('  in particular, do NOT reintroduce dmg = 0 at a wall or a symmetric kill taper.');
  process.exit(1);
}
console.log('✓ every cast is credited exactly the fraction of itself that fits before its next cut,');
console.log('  at the intermission wall and at the kill alike — one rule, both boundaries.');
