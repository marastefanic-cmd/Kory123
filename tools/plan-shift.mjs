// HOW FAR DID THE PLANS ACTUALLY MOVE? — the size of a change, not just the fact of one.
//
//   node tools/plan-shift.mjs A.json B.json        # two tools/plan-sweep.mjs outputs
//
// `tools/plan-diff.mjs` answers "did anything change" and is deliberately binary, because for a
// refactor under a byte-identical constraint that is the only question. After a deliberate MODEL
// change the useful question is different: **did the shape of the plan change, or did the same plan
// slide by a second?** "16 of 16 cases changed" is true of both and distinguishes nothing — it reads
// as a rewrite when the reality can be a one-second nudge on every press.
//
// So this reports the DISTRIBUTION of per-press shifts, and separates:
//   · presses that moved by under a second        — the same plan, re-placed
//   · presses that moved by a cast or more        — a genuinely different decision
//   · presses that appeared or vanished           — a structural change (a use added/dropped)
import fs from 'node:fs';

const [A, B] = process.argv.slice(2);
if (!A || !B) { console.error('usage: node tools/plan-shift.mjs A.json B.json'); process.exit(2); }
const load = f => {
  const j = JSON.parse(fs.readFileSync(f, 'utf8'));
  return new Map(j.cells.map(c => [c.name, c]));
};
const a = load(A), b = load(B);

const shifts = [];
let structural = 0, cells = 0, sameShape = 0;
const perCell = [];
for (const [name, ca] of a) {
  const cb = b.get(name); if (!cb) continue;
  cells++;
  const keys = new Set([...Object.keys(ca.s || {}), ...Object.keys(cb.s || {})]);
  let worst = 0, moved = 0, struct = 0, n = 0;
  for (const k of keys) {
    const xa = (ca.s[k] || []).slice().sort((x, y) => x - y);
    const xb = (cb.s[k] || []).slice().sort((x, y) => x - y);
    if (xa.length !== xb.length) { struct++; structural++; continue; }
    for (let i = 0; i < xa.length; i++) {
      const d = Math.abs(xb[i] - xa[i]);
      shifts.push(d); n++;
      if (d > 1e-9) moved++;
      if (d > worst) worst = d;
    }
  }
  if (!struct && worst < 1.5) sameShape++;
  perCell.push({ name, worst, moved, n, struct });
}

shifts.sort((x, y) => x - y);
const q = p => shifts.length ? shifts[Math.min(shifts.length - 1, Math.floor(p * shifts.length))] : 0;
const under = t => shifts.filter(d => d <= t + 1e-9).length;
const pct = n => (100 * n / shifts.length).toFixed(1) + '%';

console.log(`PLAN SHIFT — ${cells} cells, ${shifts.length} comparable presses\n`);
console.log(`  identical press time            ${String(under(0)).padStart(5)}   ${pct(under(0))}`);
console.log(`  moved ≤ 1 s (same plan, nudged) ${String(under(1) - under(0)).padStart(5)}   ${pct(under(1) - under(0))}`);
console.log(`  moved 1–5 s                     ${String(under(5) - under(1)).padStart(5)}   ${pct(under(5) - under(1))}`);
console.log(`  moved > 5 s (a real re-decision)${String(shifts.length - under(5)).padStart(5)}   ${pct(shifts.length - under(5))}`);
console.log(`  presses added/removed outright  ${String(structural).padStart(5)}`);
console.log(`\n  per-press shift: median ${q(0.5).toFixed(2)}s · p90 ${q(0.9).toFixed(2)}s · max ${(shifts[shifts.length - 1] || 0).toFixed(2)}s`);
console.log(`  cells whose SHAPE is unchanged (every press within 1.5 s, none added/dropped): ${sameShape}/${cells}`);
console.log('\n  worst shift per cell:');
for (const c of perCell.sort((x, y) => y.worst - x.worst))
  console.log(`    ${c.name.padEnd(42)} ${c.worst.toFixed(2).padStart(7)}s   (${c.moved}/${c.n} presses moved${c.struct ? `, ${c.struct} key(s) restructured` : ''})`);
