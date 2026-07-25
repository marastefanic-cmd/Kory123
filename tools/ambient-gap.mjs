// AMBIENT GAP — is FLOOR-TAIL a distinct defect family, or the SAME corpus-wide disagreement seen
// after the ruler shrank to zero?
//
//   node tools/xval-collect.mjs tools/xval-results --json /tmp/targets.json
//   node tools/ripple-audit.mjs  /tmp/targets.json --json /tmp/priced.json
//   node tools/floor-plateau.mjs /tmp/priced.json  --json /tmp/scored.json
//   node tools/ambient-gap.mjs   /tmp/scored.json
//
// ── WHERE THIS COMES FROM ────────────────────────────────────────────────────────────────────
// `ripple-audit` priced all 135 round-5 deficit columns against the tail-lattice ripple floor
// (1 − W/c): 97/121 land INSIDE it, and the 24 over-floor cells split into 4 families of which
// FLOOR-TAIL (9 cells, floor provably ~0 because c→1.000 ⇒ W/c→1) was the gradeable residual.
// `floor-plateau` then killed the tie-break explanation for it: pre-registered P1 predicted the
// model would be nearly INDIFFERENT at floored cells and it is not — median |dModel| is LARGER
// there (0.0543% vs 0.0325%), so P3 fired and H_PLATEAU is dead.
//
// That run also produced two POST-HOC readings, which is exactly why they need a pre-registered
// test before anyone builds on them:
//   • the JOINT ranking disagreement (dModel + pct — the sim says rival by pct, the model says
//     native by dModel, so the rankings are apart by the SUM) was only 1.22x larger in the floored
//     stratum, p=0.35. Nearly FLAT, where the sim deficit alone was 2–4x.
//   • Spearman(capFrac, sim deficit) = −0.135 over all 135 — the WRONG SIGN for the obvious
//     mechanism candidate (a mis-sized floor-slack/ramp credit, index.html:919-931, worth
//     +0.33..+0.41 pp when the floor binds). Disfavoured on sign before it was ever pursued.
//
// ── THE HYPOTHESIS ───────────────────────────────────────────────────────────────────────────
//   H_AMBIENT: the model↔sim JOINT ranking disagreement is a roughly CONSTANT corpus-wide scale
//   (~0.1 pp), and the ripple floor governs only how much of it is MASKED — not how much of it
//   exists. Under H_AMBIENT, FLOOR-TAIL is not a defect family at all: it is the corner where
//   W/c → 1 removes the ruler, so an ordinary ~0.1 pp of ambient disagreement becomes visible and
//   gets labelled a residual.
//
// This matters because it is the difference between "there is one more bug to find at the GCD
// floor" and "Phase 7's diagnostic charter is exhausted and the remainder is instrument noise".
//
// ── PRE-REGISTERED, BEFORE THE FIRST RUN ─────────────────────────────────────────────────────
// A1 FLATNESS   the joint gap must NOT track the ripple floor: |Spearman(joint, ripplePct)| < 0.20.
//               If the joint gap grew with the floor, the floor would be measuring something real
//               about the disagreement rather than merely masking it.
// A2 HOMOGENEITY  median joint gap across the 5 labels (inside + the 4 over-floor families) must sit
//               inside a 2.0x max/min band. A distinct defect family should stand OUT of the band;
//               if every label agrees to within 2x, "family" is a labelling artifact of the ruler.
// A3 MASKING    the SIM DEFICIT (pct) must track the floor MORE than the joint gap does:
//               Spearman(pct, ripplePct) > Spearman(joint, ripplePct). This is the positive content
//               of H_AMBIENT — the ruler shows up in the masked quantity, not the total one.
// A4 FALSIFIER  if Spearman(joint, ripplePct) >= 0.20, or if any family's median joint gap sits
//               outside the 2x band, H_AMBIENT IS DEAD: the corpus carries localized disagreement
//               beyond the ambient scale and there IS a mechanism left to find. Report it that way —
//               do not rescue H_AMBIENT by re-defining the strata after seeing them.
//               ⚠ CORRECTED AFTER THE FIRST RUN (07-25): as first written this clause said the
//               falsifier would mean "the FLOORED CORNER carries extra disagreement", because
//               FLOOR-TAIL was the family under investigation. That was an assumption smuggled into
//               a verdict string. A4 DID fire (spread 3.37x) and it was NOT FLOOR-TAIL: the band
//               broke on KT-AoE / SATURATED / RESIDUAL (~3x `inside`) while FLOOR-TAIL came in at
//               1.30x `inside`, the closest of the four. The report now COMPUTES which labels break
//               the band instead of assuming. The test itself is unchanged.
// A5 GUARD      report n per label. Any label with n < 4 is listed but EXCLUDED from the A2 band —
//               a median over 3 cells is not a median. If that leaves fewer than 3 usable labels,
//               A2 is UNDERPOWERED and only A1/A3 are reported.
//
// ── WHAT A PASS DOES AND DOES NOT LICENSE ────────────────────────────────────────────────────
// A pass says the residual after ripple-pricing is HOMOGENEOUS — one ambient scale, no localized
// defect — which is the evidence needed to close Phase 7's *diagnostic* charter. It does NOT say
// the model is correct: an ambient 0.1 pp two-sided disagreement is still 0.1 pp, and this says
// nothing about WHY it exists. And it is NOT a licence to change `index.html` — no result in this
// file localizes anything to a line of the engine.
// It also does not touch the ACCEPTANCE criterion. Whether "deficit below the ripple floor" counts
// as passing is a USER call, already filed as an open decision in ACCEPTANCE + DIARY.
//
import fs from 'node:fs';

const SCORED = process.argv[2];
if (!SCORED || !fs.existsSync(SCORED)) {
  console.error('usage: node tools/ambient-gap.mjs <scored.json from floor-plateau --json>');
  process.exit(2);
}
const rows = JSON.parse(fs.readFileSync(SCORED, 'utf8'));
if (!Array.isArray(rows) || !rows.length) { console.error('ERROR: empty input — an empty read is never a pass.'); process.exit(2); }

// same family labelling as ripple-audit, so the two tools cannot drift apart in what they mean
const famOf = r => (/kael/i.test(String(r.class)) ? 'KT-AoE'
                  : r.c <= 1.10 ? 'FLOOR-TAIL'
                  : (r.pct - r.ripplePct) < 0.03 ? 'SATURATED' : 'RESIDUAL');
const labelOf = r => (r.inside ? 'inside' : famOf(r));

const med = a => { const s = [...a].sort((x, y) => x - y); return s.length ? s[Math.floor(s.length / 2)] : NaN; };
const rank = a => { const s = a.map((v, i) => [v, i]).sort((x, y) => x[0] - y[0]); const r = new Array(a.length);
  let i = 0; while (i < s.length) { let j = i; while (j + 1 < s.length && s[j + 1][0] === s[i][0]) j++;
    const rr = (i + j) / 2; for (let k = i; k <= j; k++) r[s[k][1]] = rr; i = j + 1; } return r; };
const spearman = (x, y) => { const A = rank(x), B = rank(y), n = A.length;
  const ma = A.reduce((s, v) => s + v, 0) / n, mb = B.reduce((s, v) => s + v, 0) / n;
  let sa = 0, sb = 0, sab = 0;
  for (let i = 0; i < n; i++) { sa += (A[i] - ma) ** 2; sb += (B[i] - mb) ** 2; sab += (A[i] - ma) * (B[i] - mb); }
  return sab / Math.sqrt(sa * sb); };

const use = rows.filter(r => Number.isFinite(r.dModel) && Number.isFinite(r.pct) && Number.isFinite(r.ripplePct));
for (const r of use) { r.joint = r.dModel + r.pct; r.label = labelOf(r); }
console.log(`\nambient-gap over ${use.length} scored columns (of ${rows.length} read)`);

// ── A1 / A3 ──────────────────────────────────────────────────────────────────────────────────
const rJoint = spearman(use.map(r => r.joint), use.map(r => r.ripplePct));
const rPct   = spearman(use.map(r => r.pct),   use.map(r => r.ripplePct));
const a1 = Math.abs(rJoint) < 0.20;
const a3 = rPct > rJoint;
console.log('\n=== A1 FLATNESS — does the JOINT gap track the ripple floor? ===');
console.log(`  Spearman(joint, ripplePct) = ${rJoint.toFixed(3)}   =>  A1 ${a1 ? 'PASS' : 'FAIL'}  (need |rho| < 0.20)`);
console.log('\n=== A3 MASKING — does the SIM DEFICIT track the floor MORE than the joint gap does? ===');
console.log(`  Spearman(pct, ripplePct)   = ${rPct.toFixed(3)}`);
console.log(`  Spearman(joint, ripplePct) = ${rJoint.toFixed(3)}   =>  A3 ${a3 ? 'PASS' : 'FAIL'}  (need pct > joint)`);

// ── A2 / A5 ──────────────────────────────────────────────────────────────────────────────────
const LABELS = ['inside', 'FLOOR-TAIL', 'KT-AoE', 'SATURATED', 'RESIDUAL'];
console.log('\n=== A2 HOMOGENEITY — median joint gap by label (A5: n<4 listed but excluded) ===');
console.log('| label | n | med joint pp | med sim deficit pp | med floor pp | in A2 band |');
console.log('|---|---|---|---|---|---|');
const band = [];
for (const L of LABELS) {
  const g = use.filter(r => r.label === L); if (!g.length) continue;
  const mj = med(g.map(r => r.joint)), usable = g.length >= 4;
  if (usable) band.push({ L, mj });
  console.log(`| ${L} | ${g.length} | ${mj.toFixed(4)} | ${med(g.map(r => r.pct)).toFixed(4)} | ${med(g.map(r => r.ripplePct)).toFixed(4)} | ${usable ? 'yes' : 'no (n<4)'} |`);
}
let a2 = null, ratio = NaN, lo = NaN, argLo = '';
const OUTLIERS = [];
if (band.length < 3) {
  console.log(`  A2 UNDERPOWERED — only ${band.length} label(s) with n>=4. No homogeneity claim.`);
} else {
  lo = Math.min(...band.map(b => b.mj)); const hi = Math.max(...band.map(b => b.mj));
  ratio = hi / lo; a2 = ratio <= 2.0;
  const argHi = band.find(b => b.mj === hi).L; argLo = band.find(b => b.mj === lo).L;
  // WHICH labels break the band — the pre-registered A4 text asserted it would be the floored corner.
  // On the first run it was NOT (see the note at A4 below), so the report names them instead of
  // assuming. The TEST is untouched; only the attribution is computed rather than assumed.
  for (const b of band) if (b.mj / lo > 2.0) OUTLIERS.push(b);
  console.log(`  spread ${ratio.toFixed(2)}x  (max ${argHi} ${hi.toFixed(4)} / min ${argLo} ${lo.toFixed(4)})  =>  A2 ${a2 ? 'PASS' : 'FAIL'}  (need <= 2.0x)`);
}

// ── verdict ──────────────────────────────────────────────────────────────────────────────────
const dead = !a1 || a2 === false;
if (dead) {
  console.log('\n★ A4 FALSIFIER FIRED: H_AMBIENT is DEAD — the post-ripple residual is NOT one homogeneous');
  console.log('  scale, so there IS at least one localized mechanism left to find.');
  if (OUTLIERS.length) {
    console.log(`  it is carried by: ${OUTLIERS.map(b => `${b.L} (${(b.mj / lo).toFixed(2)}x ${argLo})`).join(', ')}`);
    const ft = band.find(b => b.L === 'FLOOR-TAIL');
    if (ft && !OUTLIERS.includes(ft))
      console.log(`  ⚠ NOT by FLOOR-TAIL — it is ${(ft.mj / lo).toFixed(2)}x ${argLo}, INSIDE the band. In the joint`
                + `\n    currency the floored corner is the LEAST anomalous over-floor family; the ripple floor only`
                + `\n    made it look like the most gradeable one because its own floor is ~0. Retarget accordingly.`);
  }
  console.log('  ⚠ Do not rescue H_AMBIENT by re-defining the strata after seeing them. "H_AMBIENT holds for');
  console.log('    the labels inside the band" is a NEW hypothesis needing its own pre-registered test.');
} else {
  console.log('\nH_AMBIENT SURVIVES: the post-ripple residual is one homogeneous scale, not a localized defect.');
  console.log('  ⚠ This does NOT say the model is correct — an ambient two-sided ~0.1 pp gap is still a gap,');
  console.log('  and nothing here localizes it to a line of the engine. No index.html change is licensed.');
}
const verdict = dead ? 'AMBIENT-DEAD' : (a2 === null ? 'AMBIENT-PARTIAL' : 'AMBIENT-HOLDS');
console.log(`\nAMBIENT-GAP-DONE verdict=${verdict} n=${use.length} rhoJoint=${rJoint.toFixed(3)} rhoPct=${rPct.toFixed(3)} a1=${a1 ? 1 : 0} a2=${a2 === null ? 'na' : (a2 ? 1 : 0)} a3=${a3 ? 1 : 0} spread=${Number.isFinite(ratio) ? ratio.toFixed(2) : 'na'}`);
