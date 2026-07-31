// HOW MUCH OF THE PLAN IS THE TIE-BREAK CHOOSING? — measure the plateaus, not one cell.
//
//   node tools/plan-sweep.mjs index.html /tmp/b.json 3 --max-t=200
//   node tools/plateau-audit.mjs /tmp/b.json [--k=2] [--span=3] [--json]
//
// Exit: 0 always — this is a MEASUREMENT, not a gate. It asserts nothing about which layout is right.
//
// ── WHY THIS EXISTS ──────────────────────────────────────────────────────────────────────────────
// MODEL-DEFECTS §8y found that on the 2:00 · Lust 0:05 cell, **3446 of 1,582,581 enumerated layouts
// sit within one tie band of the argmax**, and the declared test T6 ranks 33rd inside that plateau.
// That reframes an open user call: "is T6's layout right?" is unanswerable in isolation, because the
// SCORE does not distinguish it from thousands of others — the SHAPE tie-break does. So the real
// question is the general one:
//
//     when the score cannot separate two layouts, is `fewest distinct press moments → earliest`
//     the right rule — or should it be "put the value cluster on 3 stacks", the rule the user
//     declared for T3?
//
// Answering THAT needs two numbers this tool produces, per cell:
//   · **plateau width** — how much of the emitted plan's neighbourhood is score-tied with the best
//     point in it. If this is large everywhere, the tie-break is choosing most of the plan and is a
//     first-class part of the objective rather than a formality.
//   · **the 3-stack test** — does the emitted plan press the value cluster at the moment the T3 rule
//     names, and if not, is there a score-TIED layout that does? A tie-break that systematically
//     lands off the 3-stack moment while a tied alternative sits on it is a tie-break with a bias;
//     one that lands on it nearly everywhere makes T6 an anomaly rather than a symptom.
//
// ⚠ THE NEIGHBOURHOOD IS BOUNDED, so "plateau width" is a LOCAL density, not a global count. It is
// comparable across cells (same k, same span) and is NOT the 3446 figure, which came from a full
// enumeration. Reported as a fraction of probes for exactly that reason.
// ⚠ It reuses `rankPair`/`planBetter`/`plainCastOf` from the engine rather than re-deriving them —
// four instruments in this repo have now been caught re-implementing the comparator (§8t, §8u, §8y).
import fs from 'node:fs';
import { loadEngine, cfgFor } from './engine-node.mjs';

const die = m => { console.error('PLATEAU ERROR: ' + m); process.exit(2); };
const args = process.argv.slice(2);
const SWEEP = args.find(a => !a.startsWith('--'));
const numArg = (n, d) => { const a = args.find(x => x.startsWith(`--${n}=`)); return a ? +a.split('=')[1] : d; };
if (!SWEEP) die('usage: node plateau-audit.mjs <sweep.json> [--k=2] [--span=3] [--json]');
const K = numArg('k', 2), SPAN = numArg('span', 3), JSONOUT = args.includes('--json');

let sweep;
try { sweep = JSON.parse(fs.readFileSync(SWEEP, 'utf8')); } catch (e) { die(`cannot read ${SWEEP}: ${e.message}`); }
if (!sweep.cells || !sweep.cells.length) die(`${SWEEP} has no cells`);

const api = loadEngine(new URL('../index.html', import.meta.url).pathname);
if (!api.rankPair || !api.planBetter || !api.plainCastOf) die('this index.html predates rankPair/planBetter/plainCastOf.');
const G = api.GAME;
const DELTAS = []; for (let d = -SPAN; d <= SPAN; d++) if (d) DELTAS.push(d);

/* THE 3-STACK MOMENT, derived and not typed. ESTABLISHED-FACTS §1.2e: the opener anchor is
   `ceil(ΣC_k)` UNHASTED — m-independent, because the ramp toll is fixed (§8q). The T3 rule adds the
   raid call: press "as soon as a) 3 Arcane Blast stacks are active and b) Lust is active". */
const stackMoment = cfg => {
  let sum = 0;
  for (let k = 0; k < G.AB.MAX_STACKS; k++)
    sum += Math.max(Math.round((G.AB.BASE_CAST - G.AB.STACK_CAST_REDUCTION * k) * 1000) / 1000,
                    Math.round(Math.max(G.GCD_FLOOR, G.GCD_BASE) * 1000) / 1000);
  const threeStacks = Math.ceil(sum);
  const lust = (cfg.fixed && cfg.fixed.bloodlust && cfg.fixed.bloodlust.length) ? cfg.fixed.bloodlust[0] : null;
  return lust === null ? threeStacks : Math.max(threeStacks, lust);
};
// The "value cluster" is the T3 rule's subject: everything except Berserking and the raid calls.
const CLUSTER = ['arcanePower', 'isc', 'scb'];
const clusterAt = plan => {
  const ts = CLUSTER.filter(k => plan[k] && plan[k].length).map(k => Math.round(plan[k][0]));
  return ts.length ? Math.min(...ts) : null;
};

const rows = [];
let skipped = 0;
for (const cell of sweep.cells) {
  if (cell.error || !cell.s) { skipped++; continue; }
  const kase = cell.setup ? { name: cell.name, ...cell.setup } : api.cases.find(c => c.name === cell.name);
  if (!kase) { skipped++; continue; }
  const cfg = cfgFor(api, kase);
  const clone = o => JSON.parse(JSON.stringify(o));
  const rep = s => api.repair(clone(s), cfg);
  const plain = api.plainCastOf(cfg);

  const coords = [];
  for (const k of Object.keys(cell.s).sort()) {
    if (cfg.fixed && cfg.fixed[k]) continue;
    (cell.s[k] || []).forEach((_, i) => coords.push([k, i]));
  }
  const intact = (cand, r) => {
    for (const k in cand) {
      if (!r[k] || r[k].length !== cand[k].length) return false;
      for (let j = 0; j < cand[k].length; j++) if (Math.abs(r[k][j] - cand[k][j]) > 1e-9) return false;
    }
    return true;
  };

  const basePair = api.rankPair(rep(cell.s), cfg);
  const band = basePair.band || 0;
  let hi = basePair.score, probes = 0;
  const cands = [];                       // every legal neighbour, kept so the band filter runs after hi is known
  const move = deltas => {
    const cand = clone(cell.s);
    for (const [ci, d] of deltas) {
      const [k, i] = coords[ci];
      const t = Math.round(cand[k][i]) + d;
      if (t > cfg.T - 1) return;
      cand[k][i] = t;
    }
    const r = rep(cand);
    if (!intact(cand, r)) return;
    probes++;
    const p = api.rankPair(r, cfg);
    if (p.score > hi) hi = p.score;
    cands.push({ score: p.score, plan: r });
  };
  const walk = (start, depth, acc) => {
    if (acc.length) move(acc);
    if (depth === K) return;
    for (let c = start; c < coords.length; c++) for (const d of DELTAS) walk(c + 1, depth + 1, [...acc, [c, d]]);
  };
  walk(0, 0, []);

  const tied = cands.filter(c => c.score >= hi - band);
  const sm = stackMoment(cfg), cAt = clusterAt(cell.s);
  // Is there a SCORE-TIED layout that satisfies the T3 rule, when the emitted plan does not?
  const tiedOnStack = tied.filter(c => clusterAt(c.plan) === sm).length;
  /* ★★★★★ THE CANONICALISATION TEST — added after the user's framing: *"I expect there will be a lot
     of plateaus, especially in short fights where you use everything once, that's why we implemented
     the earliest rule so we always have THE correct answer."*
     ⇒ then the tie-break is a CANONICALISER, not a physics claim, and the question that matters is not
     "is this layout best" (nothing on a plateau is) but **"is the tool emitting the canonical member of
     its own plateau?"** That is a property the tool can be WRONG about, and T6 is exactly a case where
     it was: a score-tied layout existed with 3 distinct press moments against the emitted 4, and the
     search simply could not reach it. Measured here for every cell. */
  const emittedDistinct = api.planShape(rep(cell.s)).distinct;
  let minDistinct = emittedDistinct;
  for (const c of tied) { const d = api.planShape(c.plan).distinct; if (d < minDistinct) minDistinct = d; }
  rows.push({
    name: cell.name, T: cell.T, probes,
    tied: tied.length, tiedFrac: probes ? tied.length / probes : 0,
    // "decided by score" = nothing else in the neighbourhood is even tied with the best point.
    decidedByScore: tied.length <= 1,
    gapToHi: (hi - basePair.score) / plain, bandCasts: band / plain,
    stackMoment: sm, clusterAt: cAt, onStack: cAt === sm, tiedOnStack,
    emittedDistinct, minDistinct, canonicalMissed: emittedDistinct > minDistinct,
  });
}

if (JSONOUT) { console.log(JSON.stringify({ k: K, span: SPAN, rows }, null, 1)); process.exit(0); }

console.log(`# PLATEAU AUDIT — how much of the plan is the TIE-BREAK choosing?  (k=${K}, span=±${SPAN}s)`);
console.log(`#   sweep: ${SWEEP}\n`);
console.log('  ' + 'cell'.padEnd(40) + '  probes   tied  tied%   cluster  3-stk  on?   press-moments');
for (const r of rows) {
  console.log('  ' + r.name.padEnd(40) +
    ` ${String(r.probes).padStart(6)} ${String(r.tied).padStart(6)} ${(r.tiedFrac * 100).toFixed(1).padStart(5)}%` +
    `   ${String(r.clusterAt).padStart(6)} ${String(r.stackMoment).padStart(6)}  ${r.onStack ? ' ✓ ' : ' ✗ '}` +
    `  ${r.emittedDistinct}${r.canonicalMissed ? ` ⛔ tied layout has ${r.minDistinct}` : ' ✓'}`);
}
const n = rows.length;
const byScore = rows.filter(r => r.decidedByScore).length;
const onStack = rows.filter(r => r.onStack).length;
const biased = rows.filter(r => !r.onStack && r.tiedOnStack > 0);
const missed = rows.filter(r => r.canonicalMissed);
const meanFrac = rows.reduce((a, r) => a + r.tiedFrac, 0) / (n || 1);
const wide = rows.filter(r => r.tiedFrac > 0.5).length;

console.log(`\nPLATEAU cells=${n}${skipped ? ` skipped=${skipped}` : ''}  ` +
            `mean tied-fraction ${(meanFrac * 100).toFixed(1)}%  (>50% tied in ${wide}/${n} cells)  ` +
            `decided by SCORE alone ${byScore}/${n}`);

console.log(`\n★★★ THE CANONICALISATION TEST — is the tool emitting the canonical member of its own`);
console.log(`    plateau? Cells where a score-TIED layout has FEWER distinct press moments than the`);
console.log(`    one emitted: **${missed.length} of ${n}**`);
for (const m of missed)
  console.log(`      · ${m.name}  emitted ${m.emittedDistinct} press moments, a tied layout has ${m.minDistinct}`);
if (!missed.length)
  console.log('      (none — every emitted plan is already the fewest-press-moments member it can reach)');

console.log(`\n★ AND THE T3-RULE CHECK: cluster on the 3-stack moment in ${onStack}/${n} cells.`);
console.log(`  Cells OFF it with a score-tied layout ON it: **${biased.length} of ${n}**`);
for (const b of biased)
  console.log(`      · ${b.name}  cluster@${b.clusterAt} vs 3-stack@${b.stackMoment}, ${b.tiedOnStack} tied layout(s) on it`);
if (!biased.length)
  console.log('      (none — the current tie-break is not systematically choosing against the T3 rule)');
process.exit(0);
