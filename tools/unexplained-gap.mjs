// UNEXPLAINED GAP — the third currency, and the one that should have been used for the target list.
//
//   node tools/xval-collect.mjs tools/xval-results --json /tmp/targets.json
//   node tools/ripple-audit.mjs  /tmp/targets.json --json /tmp/priced.json
//   node tools/floor-plateau.mjs /tmp/priced.json  --json /tmp/scored.json
//   node tools/unexplained-gap.mjs /tmp/scored.json
//
// ── THE DEFECT IN THE PREVIOUS CURRENCY (mine, from the run before this one) ──────────────────
// `ambient-gap` established that the sim deficit `pct` is only half the disagreement — the model
// also had an opinion, `dModel` — and ranked the over-floor families by `joint = dModel + pct`.
// That re-ordered the target list and demoted FLOOR-TAIL, which stands. But it also promoted
// SATURATED to second-worst (0.268 pp, 3.29x ambient) and I wrote that its "confirmatory, not a
// defect signal" label therefore needed re-deriving.
//
// That promotion is an ARTIFACT OF THE CURRENCY. `pct` carries a known instrument budget — the
// tail-lattice ripple, `ripplePct` — and `dModel` carries none (it is model-vs-model, no sim, so no
// lattice at all). Adding them puts a bounded quantity and an unbounded one in one number, and then
// comparing that number across families whose ceilings differ by 9x (0.022 pp for FLOOR-TAIL vs
// 0.189 pp for SATURATED) compares mostly the ceilings. SATURATED is BY DEFINITION the family whose
// `pct` is almost entirely covered by its own large ceiling, so `joint` flatters its defect the most.
//
// ── THE RIGHT QUANTITY ───────────────────────────────────────────────────────────────────────
//   unexplained = dModel + max(0, pct − ripplePct)
//
// Read it as a LOWER BOUND on the model's valuation error on that pair: the sim ranks the rival
// ahead by `pct`, of which at most `ripplePct` can be sum-vs-integral artifact, so at least
// `pct − ripplePct` is a real ordering the model got backwards — and the model additionally scored
// its own pick ahead by `dModel`, which no artifact excuses. Subtract the budget from the term that
// HAS one; do not subtract it from the term that does not.
//
// ⚠ `dModel` is the model grading itself, so it is only an error term IF the sim's ordering is right.
// That is why U5 reports the two terms separately: a family driven by `dModel` is a different kind
// of finding (the model is confidently wrong about magnitude) than one driven by an over-ceiling
// `pct` (the sim sees an ordering the artifact cannot cover).
//
// ── PRE-REGISTERED, BEFORE THE FIRST RUN ─────────────────────────────────────────────────────
// U1 SATURATED  its median unexplained gap should fall to roughly `inside`'s, because its `pct` is
//               ~fully covered by its own ceiling *by construction*. Threshold: within 1.5x of
//               `inside`. If it does, PHASE7 §5.16d's "confirmatory, not a defect signal" reading is
//               VINDICATED and my `joint` ranking over-penalized it — say so plainly.
// U2 SHRINKAGE  the max/min spread across labels should be SMALLER than `joint`'s 3.37x. That is the
//               test that the ripple correction removes artifact rather than adding noise.
// U3 FALSIFIER  if the spread does NOT shrink, the correction is not working and one of two things is
//               true: the ripple is the wrong artifact model, or the residual is dominated by
//               `dModel`, which the ripple never touched. U5's split decides which. Report it as a
//               failure of this currency — do not keep inventing currencies until one agrees.
// U4 TARGET     whichever label tops `unexplained` is the target, reported whether or not it is the
//               one `joint` picked. Three currencies have now produced three orderings; the honest
//               conclusion if they keep disagreeing is that the ordering is INSTRUMENT-DEPENDENT and
//               no target list is trustworthy — which is itself the finding, not a failure.
// U5 SPLIT      always print the `dModel`-only and `max(0, pct − ripplePct)`-only medians per label,
//               so which term drives each family is visible and not inferable only from the total.
// U6 SENSITIVITY  recompute with `ripplePctAlt` (the min-over-last-3 edge period kept by
//               `ripple-audit` as a sensitivity read). If the label ORDERING flips between the two,
//               the verdict is ORDERING-FRAGILE and no target may be named. 14 of the 135 cells are
//               already INDETERMINATE between the two periods; the ordering must survive them.
//
// ── WHAT A PASS DOES NOT LICENSE ─────────────────────────────────────────────────────────────
// This is still arithmetic over one 135-column corpus with a ~0.1 pp signal and no fresh sim. It
// names where to look; it localizes nothing to a line of `index.html`, and no engine change is
// licensed by it. The acceptance-criterion restatement remains a user call.
//
import fs from 'node:fs';

const SCORED = process.argv[2];
if (!SCORED || !fs.existsSync(SCORED)) {
  console.error('usage: node tools/unexplained-gap.mjs <scored.json from floor-plateau --json>');
  process.exit(2);
}
const rows = JSON.parse(fs.readFileSync(SCORED, 'utf8'));
if (!Array.isArray(rows) || !rows.length) { console.error('ERROR: empty input — an empty read is never a pass.'); process.exit(2); }

// identical labelling to ripple-audit / ambient-gap, so the three cannot drift apart
const famOf = r => (/kael/i.test(String(r.class)) ? 'KT-AoE'
                  : r.c <= 1.10 ? 'FLOOR-TAIL'
                  : (r.pct - r.ripplePct) < 0.03 ? 'SATURATED' : 'RESIDUAL');
const labelOf = r => (r.inside ? 'inside' : famOf(r));
const LABELS = ['inside', 'FLOOR-TAIL', 'KT-AoE', 'SATURATED', 'RESIDUAL'];
const med = a => { const s = [...a].sort((x, y) => x - y); return s.length ? s[Math.floor(s.length / 2)] : NaN; };

const use = rows.filter(r => Number.isFinite(r.dModel) && Number.isFinite(r.pct) && Number.isFinite(r.ripplePct));
for (const r of use) {
  r.label = labelOf(r);
  r.overC = Math.max(0, r.pct - r.ripplePct);                                    // sim deficit the ceiling cannot cover
  r.unexp = r.dModel + r.overC;                                                  // the lower bound on valuation error
  r.unexpAlt = r.dModel + Math.max(0, r.pct - (r.ripplePctAlt ?? r.ripplePct));  // U6 sensitivity
  r.joint = r.dModel + r.pct;
}
console.log(`\nunexplained-gap over ${use.length} scored columns (of ${rows.length} read)`);

// ── the table (U5 SPLIT is inline: the two terms are their own columns) ───────────────────────
console.log('\n=== median gap by label, in all three currencies ===');
console.log('| label | n | joint pp | **unexplained pp** | of which dModel | of which pct−ceiling | ceiling pp |');
console.log('|---|---|---|---|---|---|---|');
const band = [], altBand = [];
for (const L of LABELS) {
  const g = use.filter(r => r.label === L); if (!g.length) continue;
  const mu = med(g.map(r => r.unexp));
  if (g.length >= 4) { band.push({ L, mu, n: g.length }); altBand.push({ L, mu: med(g.map(r => r.unexpAlt)) }); }
  console.log(`| ${L} | ${g.length} | ${med(g.map(r => r.joint)).toFixed(4)} | **${mu.toFixed(4)}** | `
            + `${med(g.map(r => r.dModel)).toFixed(4)} | ${med(g.map(r => r.overC)).toFixed(4)} | ${med(g.map(r => r.ripplePct)).toFixed(4)} |`);
}
if (band.length < 3) { console.log('\nUNDERPOWERED — fewer than 3 labels with n>=4.'); process.exit(0); }

const base = band.find(b => b.L === 'inside');
const byU = [...band].sort((a, b) => b.mu - a.mu);
const spread = byU[0].mu / byU[byU.length - 1].mu;
const JOINT_SPREAD = 3.37;                       // ambient-gap's measured value, for U2

// ── U1 ───────────────────────────────────────────────────────────────────────────────────────
const sat = band.find(b => b.L === 'SATURATED');
let u1 = null;
if (sat && base) {
  u1 = sat.mu / base.mu <= 1.5;
  console.log('\n=== U1 SATURATED — does its gap fall to ~ambient once its own ceiling is subtracted? ===');
  console.log(`  SATURATED ${sat.mu.toFixed(4)} vs inside ${base.mu.toFixed(4)} = ${(sat.mu / base.mu).toFixed(2)}x   =>  U1 ${u1 ? 'PASS' : 'FAIL'}  (need <= 1.5x)`);
  if (u1) console.log('  ⇒ §5.16d\'s "confirmatory, not a defect signal" is VINDICATED, and the `joint` ranking\n    (which put SATURATED second-worst at 3.29x) OVER-PENALIZED it. Say so plainly.');
}

// ── U2 / U3 ──────────────────────────────────────────────────────────────────────────────────
const u2 = spread < JOINT_SPREAD;
console.log('\n=== U2 SHRINKAGE — does subtracting the ceiling make the residual more homogeneous? ===');
console.log(`  unexplained spread ${spread.toFixed(2)}x  (max ${byU[0].L} ${byU[0].mu.toFixed(4)} / min ${byU[byU.length - 1].L} ${byU[byU.length - 1].mu.toFixed(4)})`);
console.log(`  vs joint spread ${JOINT_SPREAD.toFixed(2)}x   =>  U2 ${u2 ? 'PASS' : 'FAIL'}`);
if (!u2) {
  const dSpread = (() => { const m = band.map(b => med(use.filter(r => r.label === b.L).map(r => r.dModel)));
    return Math.max(...m) / Math.min(...m); })();
  console.log('  ★ U3 FALSIFIER FIRED: the correction did not homogenize the residual.');
  console.log(`    dModel-only spread is ${dSpread.toFixed(2)}x — if that is the large one, the residual is`);
  console.log('    dominated by the MODEL\'s own margin, which the ripple never touched, and the ripple is');
  console.log('    simply not the relevant artifact for these families. Do not invent a fourth currency to fix it.');
}

// ── U6 ───────────────────────────────────────────────────────────────────────────────────────
const ordU = byU.map(b => b.L).join('>');
const ordAlt = [...altBand].sort((a, b) => b.mu - a.mu).map(b => b.L).join('>');
const u6 = ordU === ordAlt;
console.log('\n=== U6 SENSITIVITY — does the ordering survive the ambiguous kill-edge period? ===');
console.log(`  primary  ${ordU}`);
console.log(`  alt      ${ordAlt}   =>  U6 ${u6 ? 'PASS' : 'FAIL'}`);
if (!u6) console.log('  ★ ORDERING-FRAGILE: the target ordering flips with the edge period. NAME NO TARGET.');

// ── U4 ───────────────────────────────────────────────────────────────────────────────────────
console.log('\n=== U4 TARGET ===');
if (!u6) {
  console.log('  none nameable — U6 failed.');
} else {
  const top = byU[0];
  console.log(`  ${top.L} (n=${band.find(b => b.L === top.L).n}, ${top.mu.toFixed(4)} pp, ${(top.mu / base.mu).toFixed(2)}x ambient)`);
  const g = use.filter(r => r.label === top.L);
  const dm = med(g.map(r => r.dModel)), oc = med(g.map(r => r.overC));
  console.log(`  driven by ${dm > oc ? 'dModel (the model is confidently wrong about MAGNITUDE)' : 'pct−ceiling (the sim sees an ordering the artifact cannot cover)'}`
            + `  — dModel ${dm.toFixed(4)} vs pct−ceiling ${oc.toFixed(4)}`);
  console.log('  ⚠ three currencies have now produced target orderings; if they keep disagreeing, the honest');
  console.log('    conclusion is that the ordering is INSTRUMENT-DEPENDENT and no target list is trustworthy.');
}

// ── POST-HOC STABILITY MEASUREMENT — added AFTER the first run. NOT a pre-registered test. ────
// U4's conclusion ("the ordering is INSTRUMENT-DEPENDENT") rested on an n=3 anecdote: three
// currencies produced three orderings. That is an observation about three arbitrary formulas, not a
// measurement of whether THIS corpus can rank these families at all. This block measures that
// directly: resample the 135 columns with replacement (seeded LCG — the numbers must reproduce),
// recompute the per-label medians, and count how often each label comes out on top.
//
// There is deliberately NO pass/fail threshold here. It is a confidence read on the ranking, and it
// is reported whatever it says: if the top label wins a large majority of resamples the ordering is
// a real feature of the corpus and only my three formulas disagreed; if the top spot is split, the
// corpus cannot rank these families and no currency ever could.
let lcg = 20260725;                                        // fixed seed: determinism is a feature
const rnd = () => ((lcg = (lcg * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
const BOOT = 20000, wins = {}, ranks = {};
for (const b of band) { wins[b.L] = 0; ranks[b.L] = []; }
for (let it = 0; it < BOOT; it++) {
  const samp = new Array(use.length);
  for (let i = 0; i < use.length; i++) samp[i] = use[(rnd() * use.length) | 0];
  const ms = [];
  for (const b of band) {
    const g = samp.filter(r => r.label === b.L);
    if (g.length) ms.push({ L: b.L, v: med(g.map(r => r.unexp)) });
  }
  ms.sort((a, y) => y.v - a.v);
  if (ms.length) wins[ms[0].L]++;
  ms.forEach((m, i) => ranks[m.L].push(i + 1));
}
console.log('\n=== POST-HOC STABILITY (not pre-registered): can this corpus rank the families at all? ===');
console.log(`  ${BOOT} seeded bootstrap resamples of the ${use.length} columns, ranked by unexplained gap`);
console.log('| label | P(tops the list) | mean rank |');
console.log('|---|---|---|');
for (const b of byU) console.log(`| ${b.L} | ${(100 * wins[b.L] / BOOT).toFixed(1)}% | ${(ranks[b.L].reduce((s, x) => s + x, 0) / ranks[b.L].length).toFixed(2)} |`);
const pTop = 100 * wins[byU[0].L] / BOOT;
console.log(`  the nominal top (${byU[0].L}) holds first place in ${pTop.toFixed(1)}% of resamples.`);
console.log(pTop >= 80
  ? '  ⇒ the TOP of the ordering is a stable feature of the corpus; only my three currencies disagreed\n    about the ranks BELOW it. U4 must be narrowed to "the tail ordering is instrument-dependent".'
  : '  ⇒ the top spot is NOT stable under resampling. The corpus cannot rank these families, so no\n    currency could have; U4\'s instrument-dependence is a property of the DATA, not of my formulas.');

const verdict = !u6 ? 'ORDERING-FRAGILE' : (!u2 ? 'CORRECTION-INERT' : 'RETARGETED');
console.log(`\nUNEXPLAINED-GAP-DONE verdict=${verdict} n=${use.length} spread=${spread.toFixed(2)} jointSpread=${JOINT_SPREAD} top=${u6 ? byU[0].L : 'none'} u1=${u1 === null ? 'na' : (u1 ? 1 : 0)} u2=${u2 ? 1 : 0} u6=${u6 ? 1 : 0}`);
