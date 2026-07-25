// RIPPLE AUDIT — price EVERY cross-val deficit column against the tail-lattice ripple floor.
//
//   node tools/xval-collect.mjs tools/xval-results --json /tmp/targets.json
//   node tools/ripple-audit.mjs /tmp/targets.json
//
// The question: the acceptance test still reports 135 borrowed-win columns (ACCEPTANCE invariant B).
// `tools/lattice-ripple.mjs` showed that ONE of them (isc-skull short @sim40) is an INSTRUMENT
// ARTIFACT — the sim sums over its integer cast lattice while the model integrates the continuum
// limit, leaving a tail-phase sawtooth of peak-to-peak `1 - W/c` casts (W = 1.0s). How much of the
// REST of the ledger does that term cover?  Needs NO sim: every round-5 cell was measured at
// var=0.5, and the bound is arithmetic on the model's own cast list.
//
//   ripplePct = 100 * (1 - W/c) / Nt        c  = the tail cast period (s)
//                                           Nt = the fight's total value in TAIL-CAST equivalents
//                                                (robust / dmg_tail) — the tail cast is unbuffed and
//                                                so worth LESS than the average cast; dividing by a
//                                                raw cast count would overstate the bound.
//
// ── PRE-REGISTERED, BEFORE THE FIRST RUN ─────────────────────────────────────────────────────
// P1 COVERAGE     >=70% of the 135 columns satisfy deficit% <= ripplePct.
// P2 CORRELATION  Spearman rho(deficit%, ripplePct) > 0 across all columns.
// P3 DISCRIMINATION  the KT-420 family (the two worst cells, 0.38% / 0.36%) must EXCEED its own
//                 bound. A 420s fight has ~4x the casts of a 99s one, so its floor is ~4x smaller;
//                 if the bound "explains" even those, it is too loose to mean anything.
// P4 VACUITY GUARD  if >95% of columns are inside the bound AND median(ripplePct) > 3x
//                 median(deficit%), the verdict is "BOUND UNINFORMATIVE", not "model vindicated".
//                 An upper bound that everything satisfies is not evidence. This clause exists so
//                 the tool can return a NULL result, per the standing rule that a test which cannot
//                 fail measures nothing (DIARY).
// P5 ARITHMETIC SELF-CHECK  median ripplePct must fall monotonically short > medium > medlong >
//                 long > xl (it is 1/N and nothing else). A violation means this tool is wrong, not
//                 that the model is interesting.
//
// ── WHAT A PASS DOES AND DOES NOT LICENSE ────────────────────────────────────────────────────
// Being inside the floor means the cell CANNOT be resolved by this instrument at this taper width.
// It does NOT prove the model is right there — an unmeasurable deficit and no deficit are the same
// reading. And it is NOT a licence to discretize the scorer: lattice-ripple.mjs section 3 shows the
// discrete sum is a WORSE predictor of the sim across a full column (r 0.7910 vs 0.9337). The
// actionable output is the OVER-FLOOR list: the columns a real model defect could still live in.
//
// ⚠ BOSS rows carry a SECOND artifact channel (wall-bounded cast parity, TOOLING wall-jitter), so
// for them `ripplePct` is a LOWER bound on the total instrument floor. Flagged `wall` below.
// ⚠ Cells whose tail is not a constant rate/damage regime are reported UNPRICED, never silently
// priced with a formula that does not apply.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadEngine } from './engine-node.mjs';
import { REF } from './reference-gear.mjs';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const KW = 0.5, W = 2 * KW;
const TARGETS = process.argv[2];
if (!TARGETS || !fs.existsSync(TARGETS)) {
  console.error('usage: node tools/ripple-audit.mjs <targets.json from xval-collect --json>');
  process.exit(2);
}
const cells = JSON.parse(fs.readFileSync(TARGETS, 'utf8'));
if (!Array.isArray(cells) || !cells.length) { console.error('ERROR: empty target set — an empty read is never a pass.'); process.exit(2); }

const { simulate, buildSegments, BUFFS, cases } = loadEngine(path.join(REPO, 'index.html'));

// genapl spec key -> engine buff key. CS presses are ALREADY inside IV (xval.mjs:171-175 emits the
// full IV list and duplicates the Cold-Snap ones into CS), so CS is not re-added here.
const UNSPEC = { BL: 'bloodlust', AP: 'arcanePower', Zerk: 'berserking', Icon: 'isc', Gem: 'scb', Skull: 'skull', MQG: 'mqg', IV: 'icyVeins' };
const slug = s => String(s).replace(/[^A-Za-z0-9]/g, '').toLowerCase();

function segmentsFor(klass, T) {
  if (!/^boss:/i.test(String(klass))) return null;
  const want = slug(String(klass).replace(/^boss:/i, ''));
  const hits = cases.filter(c => slug(c.name) === want);
  if (hits.length !== 1) throw new Error(`boss preset for "${klass}" resolved to ${hits.length} presets — refusing to guess`);
  const p = hits[0];
  // mirror index.html's normalization (legacy single-window `intermission`, xval.mjs:156)
  const raw = p.phases || (p.intermission ? [{ type: 'intermission', from: p.intermission[0], to: p.intermission[1] }] : []);
  if (!raw.length) return null;
  const rows = raw.map(ph => ({ from: ph.from, to: ph.to, type: ph.type, mult: ph.mult || 1, targets: ph.targets || 0 }));
  return buildSegments(rows, T);
}

function priceCell(cell) {
  const pair = cell.kit.split('+');
  const kit = ['icyVeins', pair[0], pair[1], 'arcanePower', 'berserking', 'bloodlust'];
  const enabled = {}; for (const k in BUFFS) enabled[k] = kit.includes(k);
  const segments = segmentsFor(cell.class, cell.T);
  const cfg = { T: cell.T, hasteRating: cell.simH, ...REF, enabled,
                fixed: { bloodlust: [cell.lust] }, warnings: [], coldSnap: true, segments };
  const state = {};
  for (const [sk, bk] of Object.entries(UNSPEC)) if (cell.nativeSpec[sk]) state[bk] = cell.nativeSpec[sk].slice();
  const r = simulate(state, cfg, true);
  const cs = r.casts;
  if (!cs || cs.length < 4) return { unpriced: 'cast list too short' };
  const tl = cs.slice(-3);
  const flat = tl.every(c => Math.abs(c.interval - tl[0].interval) < 1e-9 && Math.abs(c.dmg - tl[0].dmg) < 1e-6);
  const last = cs[cs.length - 1];
  // WHICH period is "the" tail period?  The sawtooth comes from the lattice spacing AT THE KILL
  // EDGE: the taper is only W=1.0s wide, so just the cast(s) completing in [T-KW, T+KW] matter.
  // That is `last.interval` — NOT a min/mean over the last few casts, which can reach back several
  // seconds into a different buff regime. (First cut used min-over-last-3 as a "conservative" bound
  // and it broke the P5 monotonicity check and mislabelled a low-haste cell as floor-tail: being
  // conservative about the NUMBER while being wrong about the DERIVATION is not conservative.)
  const c = last.interval;
  // A non-flat tail (a buff expiring, a segment boundary) makes the edge period genuinely ambiguous.
  // Price the alternative too and let the reporting call such a cell INDETERMINATE if the verdict
  // flips between them — no false pass in EITHER direction.
  const cAlt = Math.min(...tl.map(x => x.interval));
  const Nt = r.robust / last.dmg;                 // fight total in TAIL-cast equivalents
  const rip = cc => Math.max(0, 1 - W / cc);      // 0 at/below the GCD floor
  return { c, cAlt, flat, Nt, ripple: rip(c), ripplePct: 100 * rip(c) / Nt,
           ripplePctAlt: 100 * rip(cAlt) / Nt, casts: cs.length };
}

// ── price every column ──
const rows = [], unpriced = [];
for (const cell of cells) {
  let p;
  try { p = priceCell(cell); } catch (e) { unpriced.push({ cell, why: String(e.message || e) }); continue; }
  if (p.unpriced) { unpriced.push({ cell, why: p.unpriced }); continue; }
  const inA = cell.pct <= p.ripplePct, inB = cell.pct <= p.ripplePctAlt;
  rows.push({ ...cell, ...p, inside: inA, indet: inA !== inB, wall: /^boss:/i.test(String(cell.class)) });
}

const med = a => { if (!a.length) return NaN; const s = a.slice().sort((x, y) => x - y); const m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };
function spearman(xs, ys) {
  const rank = a => { const idx = a.map((v, i) => [v, i]).sort((p, q) => p[0] - q[0]); const r = new Array(a.length);
    for (let i = 0; i < idx.length;) { let j = i; while (j + 1 < idx.length && idx[j + 1][0] === idx[i][0]) j++;
      const avg = (i + j) / 2 + 1; for (let k = i; k <= j; k++) r[idx[k][1]] = avg; i = j + 1; } return r; };
  const a = rank(xs), b = rank(ys), n = a.length;
  const ma = a.reduce((s, v) => s + v, 0) / n, mb = b.reduce((s, v) => s + v, 0) / n;
  let sab = 0, saa = 0, sbb = 0;
  for (let i = 0; i < n; i++) { const da = a[i] - ma, db = b[i] - mb; sab += da * db; saa += da * da; sbb += db * db; }
  return sab / Math.sqrt(saa * sbb);
}

console.log(`RIPPLE AUDIT — ${cells.length} deficit columns, ${rows.length} priced, ${unpriced.length} unpriced`);
console.log(`bound: ripplePct = 100*(1 - W/c)/Nt,  W = ${W.toFixed(1)}s (the var=0.5 taper)\n`);

// ── P5 arithmetic self-check first: if the tool is wrong, nothing below means anything ──
const ORDER = ['short', 'medium', 'medlong', 'long', 'xl'];
console.log('P5 ARITHMETIC SELF-CHECK — median ripplePct by length class (must FALL: it is 1/N)');
const meds = [];
for (const k of ORDER) {
  const g = rows.filter(r => r.class === k);
  if (!g.length) { console.log(`  ${k.padEnd(8)} (none)`); continue; }
  const m = med(g.map(r => r.ripplePct));
  meds.push(m);
  console.log(`  ${k.padEnd(8)} n=${String(g.length).padStart(3)}  median ripple ${m.toFixed(3)}%   median c ${med(g.map(r => r.c)).toFixed(3)}s   median Nt ${med(g.map(r => r.Nt)).toFixed(0)}`);
}
const bossRows = rows.filter(r => r.wall);
if (bossRows.length) console.log(`  ${'boss'.padEnd(8)} n=${String(bossRows.length).padStart(3)}  median ripple ${med(bossRows.map(r => r.ripplePct)).toFixed(3)}%   (⚠ wall parity adds MORE floor)`);
let mono = true;
for (let i = 1; i < meds.length; i++) if (meds[i] > meds[i - 1] + 1e-9) mono = false;
console.log(`  => ${mono ? 'MONOTONE ✓' : '**NOT MONOTONE — this tool is suspect, stop here**'}\n`);

// ── P1 / P2 ── INDETERMINATE cells (verdict flips with the ambiguous edge period) are held out of
// both buckets: counting them either way would be a false pass in one direction.
const determinate = rows.filter(r => !r.indet);
const indet = rows.filter(r => r.indet);
const inside = determinate.filter(r => r.inside), over = determinate.filter(r => !r.inside);
const cov = 100 * inside.length / determinate.length;
const rho = spearman(rows.map(r => r.ripplePct), rows.map(r => r.pct));
const mDef = med(rows.map(r => r.pct)), mRip = med(rows.map(r => r.ripplePct));
console.log(`P1 COVERAGE     ${inside.length}/${determinate.length} = ${cov.toFixed(1)}% inside the floor  (bar >=70%)  ${cov >= 70 ? 'PASS' : 'FAIL'}`);
console.log(`                (+${indet.length} INDETERMINATE — ambiguous kill-edge period, verdict flips; held out of both buckets)`);
console.log(`P2 CORRELATION  Spearman rho(ripple%, deficit%) = ${rho.toFixed(3)}  (bar >0)  ${rho > 0 ? 'PASS' : 'FAIL'}`);
console.log(`   median deficit ${mDef.toFixed(3)}%   median ripple floor ${mRip.toFixed(3)}%   ratio ${(mRip / mDef).toFixed(2)}x`);

// ── P4 vacuity guard, BEFORE any claim ──
const vacuous = cov > 95 && mRip > 3 * mDef;
console.log(`P4 VACUITY      ${vacuous ? '**BOUND UNINFORMATIVE** (>95% inside AND floor >3x the median deficit) — report a NULL result' : 'informative (the bound separates cells)'}`);

// ── P3 discrimination ──
const kt = rows.filter(r => /kael/i.test(String(r.class)));
console.log(`\nP3 DISCRIMINATION — the KT-420 family (${kt.length} columns), which must NOT be explained away:`);
for (const r of kt.slice().sort((a, b) => b.pct - a.pct))
  console.log(`   @${String(r.simH).padStart(3)}  deficit ${r.pct.toFixed(3)}%  floor ${r.ripplePct.toFixed(3)}%  ${r.inside ? 'inside (⚠ bound too loose here)' : 'OVER FLOOR ✓'}`);
const ktOver = kt.filter(r => !r.inside).length;
console.log(`   => ${ktOver}/${kt.length} over floor  ${kt.length && ktOver >= Math.ceil(kt.length / 2) ? 'PASS (the bound discriminates)' : 'FAIL (the bound explains everything ⇒ meaningless)'}`);

// ── the actionable output ──
console.log(`\n=== OVER-FLOOR COLUMNS (${over.length}) — the only cells a real model defect can still live in ===`);
console.log('| kit | class | T | sim-h | deficit % | floor % | over by | tail c | Nt | family |');
console.log('|---|---|---|---|---|---|---|---|---|---|');
// FAMILY PARTITION — "over the floor" is not one thing:
//   FLOOR-TAIL  c <= 1.10s: the ripple is ~0 BY CONSTRUCTION (exactly 0 at c=1.000, the GCD floor),
//               so the deficit cannot be tail-lattice at all. The cleanest target for real model work.
//   KT-AoE      Kael'thas: carries its own AoE + wall channels (ACCEPTANCE coverage gap) — a known
//               separate family, not evidence about the scorer.
//   SATURATED   over by <0.03pp: sitting ON its ceiling, i.e. what a PURE-ripple cell at worst tail
//               phase looks like. Not a defect signal; the bound is peak-to-peak and this is the peak.
//   RESIDUAL    genuinely over, slow tail — part ripple, part something else. Needs decomposition.
const famOf = r => (/kael/i.test(String(r.class)) ? 'KT-AoE'
                  : r.c <= 1.10 ? 'FLOOR-TAIL'
                  : (r.pct - r.ripplePct) < 0.03 ? 'SATURATED' : 'RESIDUAL');
for (const r of over.slice().sort((a, b) => (b.pct - b.ripplePct) - (a.pct - a.ripplePct)))
  console.log(`| ${r.kit} | ${r.class}${r.wall ? ' ⚠wall' : ''} | ${r.T} | ${r.simH} | ${r.pct.toFixed(3)} | ${r.ripplePct.toFixed(3)} | ${(r.pct - r.ripplePct).toFixed(3)} | ${r.c.toFixed(3)}${r.flat ? '' : '~'} | ${r.Nt.toFixed(0)} | ${famOf(r)} |`);

const fams = {};
for (const r of over) fams[famOf(r)] = (fams[famOf(r)] || 0) + 1;
console.log(`\nover-floor by family: ${Object.entries(fams).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k}=${v}`).join('  ')}`);
const ft = over.filter(r => famOf(r) === 'FLOOR-TAIL');
if (ft.length) {
  console.log(`\n★ FLOOR-TAIL (${ft.length}) is the sharp target: the kill-edge lattice period sits at/near the GCD`);
  console.log(`  floor, where the ripple is provably ~0 (EXACTLY 0 at c=1.000 — the closed form's built-in`);
  console.log(`  zero), so these deficits have NO tail-lattice explanation at all.`);
  // MEASURE the family's shape, don't assert it — the first draft of this blurb claimed
  // "HIGH-haste / LONG-fight" and a low-haste cell was sitting in the list.
  const hs = ft.map(r => r.simH).sort((a, b) => a - b), ts = ft.map(r => r.T).sort((a, b) => a - b);
  console.log(`  deficits: ${ft.map(r => r.pct.toFixed(3)).sort((a, b) => b - a).join(', ')}%`);
  console.log(`  sim-haste: min ${hs[0]} median ${med(hs)} max ${hs[hs.length - 1]}   T: min ${ts[0]} median ${med(ts)} max ${ts[ts.length - 1]}`);
  const rippleFam = inside.concat(over.filter(r => famOf(r) === 'SATURATED'));
  if (rippleFam.length) console.log(`  vs the ripple-explained family — sim-haste median ${med(rippleFam.map(r => r.simH))}, T median ${med(rippleFam.map(r => r.T))}`);
  console.log(`  => if those two distributions differ, one mechanism cannot be behind both. Work these first.`);
}

if (indet.length) {
  console.log(`\n=== INDETERMINATE (${indet.length}) — the kill-edge period is ambiguous (non-flat tail), and the`);
  console.log(`    inside/over verdict FLIPS between the two defensible reads. Claimed for neither side. ===`);
  for (const r of indet.slice().sort((a, b) => b.pct - a.pct))
    console.log(`  ${r.kit} ${r.class} T=${r.T} @${r.simH}  deficit ${r.pct.toFixed(3)}%  floor ${r.ripplePct.toFixed(3)}% (c=${r.c.toFixed(3)}) vs ${r.ripplePctAlt.toFixed(3)}% (c=${r.cAlt.toFixed(3)})`);
}

if (unpriced.length) {
  console.log(`\n=== UNPRICED (${unpriced.length}) — no bound claimed, these stay open ===`);
  for (const u of unpriced) console.log(`  ${u.cell.kit} ${u.cell.class} T=${u.cell.T} @${u.cell.simH} (deficit ${u.cell.pct}%) — ${u.why}`);
}

console.log(`\nRIPPLE-AUDIT-DONE priced=${rows.length} inside=${inside.length} over=${over.length} indet=${indet.length} unpriced=${unpriced.length} rho=${rho.toFixed(3)} mono=${mono ? 1 : 0} vacuous=${vacuous ? 1 : 0}`);
