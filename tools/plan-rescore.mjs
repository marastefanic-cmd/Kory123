// WAS THE NEW PLAN ACTUALLY BETTER, JUDGED BY THE NEW SCORER? — no sim, pure arithmetic.
//
//   node tools/plan-rescore.mjs A.json B.json      # two tools/plan-sweep.mjs outputs
//
// `tools/plan-diff.mjs` says whether plans moved; `tools/plan-shift.mjs` says how far. Neither says
// whether the move was an IMPROVEMENT, because each sweep's score is in its own engine's currency and
// the two are not comparable.
//
// This settles it the only way that is valid: take BOTH plans and score them with the SAME (current)
// engine. Then
//   score(B) > score(A)  — the new engine found a plan its own objective prefers. Working as intended.
//   score(B) ≈ score(A)  — a PLATEAU. The plans differ but the objective is indifferent; a big time
//                          shift here is cosmetic churn, not a decision, and it should not be read as
//                          "the model changed its mind".
//   score(B) < score(A)  — ⛔ THE SEARCH REGRESSED. The old engine's plan beats the new engine's own
//                          output under the new engine's own scorer, which is a search failure and
//                          nothing to do with the scorer change.
//
// The last case is the one worth building a tool for: it is invisible to plan-diff (which only sees
// "changed") and to a sim duel (which answers a different question, and slowly).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadEngine, cfgFor } from './engine-node.mjs';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const [A, B] = process.argv.slice(2);
if (!A || !B) { console.error('usage: node tools/plan-rescore.mjs A.json B.json'); process.exit(2); }
const api = loadEngine(process.env.ENGINE || path.join(REPO, 'index.html'));
const byName = Object.fromEntries(api.cases.map(c => [c.name, c]));
const load = f => new Map(JSON.parse(fs.readFileSync(f, 'utf8')).cells.map(c => [c.name, c]));
const a = load(A), b = load(B);

// effective ABs, so the numbers are readable rather than raw damage
const crit = c => Math.min(1, Math.max(0, c.critPct / 100));
const plain = c => (api.GAME.AB.AVG_BASE_DMG + api.GAME.AB.COEF * c.sp) *
  (1 + crit(c) * (api.GAME.CRIT_MULT - 1)) * (c.t5two ? 1.2 : 1);

let better = 0, worse = 0, tie = 0;
const rows = [];
for (const [name, ca] of a) {
  const cb = b.get(name); if (!cb || !byName[name]) continue;
  const cfg = cfgFor(api, byName[name]);
  const P = plain(cfg);
  const sa = api.simulate(ca.s, cfg).robust / P;
  const sb = api.simulate(cb.s, cfg).robust / P;
  const d = sb - sa;
  // "indifferent" at 0.001 effective ABs — a thousandth of one cast, i.e. float noise, not a decision.
  const v = Math.abs(d) < 1e-3 ? 'plateau' : (d > 0 ? 'better' : 'WORSE');
  if (v === 'better') better++; else if (v === 'WORSE') worse++; else tie++;
  rows.push({ name, sa, sb, d, v });
}

console.log(`RESCORE — both plans judged by the CURRENT engine, in effective ABs. NO SIM.\n`);
console.log('  fight                                        old plan    new plan       Δ   verdict');
for (const r of rows.sort((x, y) => x.d - y.d))
  console.log(`  ${r.name.padEnd(42)} ${r.sa.toFixed(3).padStart(9)} ${r.sb.toFixed(3).padStart(11)} ` +
    `${((r.d >= 0 ? '+' : '') + r.d.toFixed(3)).padStart(8)}   ${r.v}`);
console.log(`\n  new plan better: ${better} · plateau (|Δ| < 0.001 casts): ${tie} · ⛔ WORSE: ${worse}`);
if (worse) {
  console.log('\n  ⛔ A cell where the OLD engine\'s plan outscores the NEW engine\'s own output, under the');
  console.log('     NEW engine\'s scorer, is a SEARCH failure — not a scorer question. The old plan is a');
  console.log('     ready-made seed: feed it in and see whether the search can hold it.');
}
process.exit(worse ? 1 : 0);
