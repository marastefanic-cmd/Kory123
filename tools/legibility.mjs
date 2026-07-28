// IS THE EMITTED SCHEDULE LEGIBLE? — count the press ROWS a player actually has to hit.
//
//   node tools/legibility.mjs <sweepA.json> <sweepB.json>
//
// Exit: 0 always — this is a MEASUREMENT, not a gate. Legibility is not something to enforce with a
// threshold; it is something to watch while changing the search.
//
// ── WHY THIS EXISTS ──────────────────────────────────────────────────────────────────────────────
// The user's ruling (07-28): *"I want the perfect plan, I just want the timeline/schedule rounded to
// something legible."* Those are two separate properties and this repo already measures the first
// (`tools/search-miss.mjs`, on the objective). Nothing measured the second — so "the plans got less
// pressable" was an assertion nobody could check, and it was used once to defer a search fix.
//
// ── WHAT "LEGIBLE" MEANS HERE, CONCRETELY ────────────────────────────────────────────────────────
// The displayed plan is a list of press SECONDS with the activations on each. What a player executes
// is one row per second, and cooldowns landing on the SAME second are macro'd together — so:
//
//   · ROWS       = distinct whole seconds carrying at least one press. Fewer is better.
//   · MAXCLUSTER = the largest number of activations sharing one second. Bigger is better.
//   · LONERS     = seconds carrying exactly one press. These are the ones that cost attention.
//
// ⚠ Whole seconds, because that is the granularity the plan is PRINTED at — `a.sec =
// Math.floor(a.t + EPS)`. Two presses 0.4 s apart are one row to the player and must count as one.
import fs from 'node:fs';

const die = m => { console.error('ERROR: ' + m); process.exit(2); };
const [pa, pb] = process.argv.slice(2);
if (!pa || !pb) die('usage: node tools/legibility.mjs <sweepA.json> <sweepB.json>');

const load = p => {
  if (!fs.existsSync(p)) die(`${p} does not exist`);
  const j = JSON.parse(fs.readFileSync(p, 'utf8'));
  if (!Array.isArray(j.cells)) die(`${p} has no cells[] — is it a plan-sweep output?`);
  return j;
};
const A = load(pa), B = load(pb);
if (A.html === B.html) die(`both sweeps came from the same engine (${A.html}).`);

// One schedule → its legibility triple. `s` is {key: [seconds]}; a press at 4.6 prints as "0:04".
const legOf = s => {
  const rows = new Map();
  for (const key in s) for (const t of s[key]) {
    const sec = Math.floor(t + 1e-9);
    rows.set(sec, (rows.get(sec) || 0) + 1);
  }
  const counts = [...rows.values()];
  return { rows: counts.length, presses: counts.reduce((a, x) => a + x, 0),
           maxCluster: counts.length ? Math.max(...counts) : 0,
           loners: counts.filter(c => c === 1).length };
};

const byName = j => new Map(j.cells.filter(c => c.s).map(c => [c.name, c.s]));
const ma = byName(A), mb = byName(B);
const names = [...ma.keys()].filter(n => mb.has(n));
if (!names.length) die('no cases in common — refusing to report over an empty set.');

console.log(`# legibility — press ROWS a player has to hit (whole seconds)`);
console.log(`  A: ${A.html}\n  B: ${B.html}\n`);
console.log('| case | rows A→B | max cluster A→B | lone rows A→B |');
console.log('|---|---|---|---|');
let dRows = 0, dLone = 0, dCluster = 0, moved = 0;
for (const n of names) {
  const a = legOf(ma.get(n)), b = legOf(mb.get(n));
  if (a.rows === b.rows && a.maxCluster === b.maxCluster && a.loners === b.loners) continue;
  moved++;
  dRows += b.rows - a.rows; dLone += b.loners - a.loners; dCluster += b.maxCluster - a.maxCluster;
  const arrow = (x, y) => `${x} → ${y}${y === x ? '' : y < x ? ' ✓' : ' ✗'}`;
  console.log(`| ${n} | ${arrow(a.rows, b.rows)} | ${a.maxCluster} → ${b.maxCluster}${b.maxCluster > a.maxCluster ? ' ✓' : b.maxCluster < a.maxCluster ? ' ✗' : ''} | ${arrow(a.loners, b.loners)} |`);
}
if (!moved) { console.log('| — | no case changed its press layout | | |'); }
console.log(`\n  ${moved} of ${names.length} case(s) changed layout.`);
console.log(`  total press rows      ${dRows >= 0 ? '+' : ''}${dRows}   (negative = fewer rows to hit = MORE legible)`);
console.log(`  total lone rows       ${dLone >= 0 ? '+' : ''}${dLone}   (negative = fewer single-press seconds = MORE legible)`);
console.log(`  total max-cluster     ${dCluster >= 0 ? '+' : ''}${dCluster}   (positive = bigger macro groups = MORE legible)`);
console.log('\n  ⚠ Read this NEXT TO tools/search-miss.mjs, never instead of it. Legibility is only worth');
console.log('    anything on plans that are already optimal — this tool cannot tell you they are.');
