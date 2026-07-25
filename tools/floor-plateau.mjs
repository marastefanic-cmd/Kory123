// FLOOR PLATEAU — is the FLOOR-TAIL deficit a VALUATION error or a TIE-BREAK failure?
//
//   node tools/xval-collect.mjs tools/xval-results --json /tmp/targets.json
//   node tools/ripple-audit.mjs /tmp/targets.json --json /tmp/priced.json
//   node tools/floor-plateau.mjs /tmp/priced.json
//
// ── WHERE THIS COMES FROM ────────────────────────────────────────────────────────────────────
// `ripple-audit` reduced the 135 round-5 deficit columns to a 9-cell over-floor FLOOR-TAIL family
// and stratifying its output gives the real shape of it:
//
//   unconditionally   floored edge (c<=1.10) n=12 med 0.066%  vs  slow edge n=123 med 0.033%   p=0.16
//   BUT haste is a NEGATIVE confounder — inside the slow stratum, HIGH haste has a SMALLER
//   deficit (simH>=200 med 0.020% vs simH<200 med 0.041%, p=0.021), which is just the ripple's 1/N.
//   controlling for it therefore STRENGTHENS the effect:
//   within simH>=155  floored n=10 med 0.074%  vs  slow n=48 med 0.018%   p=0.022   (same at >=200, >=230)
//
// So: **conditional on high gear haste, a GCD-FLOORED KILL EDGE multiplies the deficit ~4x** — and
// that is exactly where the ripple bound goes to ~0, which is why 9 of those 10 clear the bound.
// It is NOT a skull-trinket effect: off the floor, skull cells have if anything a SMALLER deficit
// than non-skull ones (0.031% vs 0.036%, n=59/64). The floored stratum is 92% skull only because
// skull's +175 haste rating is WHAT FLOORS THE EDGE. Confounder, not cause.
//
// ── THE HYPOTHESIS, AND WHY IT IS NOT THE OBVIOUS ONE ────────────────────────────────────────
// The obvious story is "the model mis-values something at the floor". But RULES §2 certified the
// floor's LOCATION against the sim (PHASE8 round 4 F1: three crossing ratings, each bracketed to
// one rating point, sim kink inside the same point as the model's). So the suspect is not the
// formula — it is what the formula does to the SEARCH:
//
//   H_PLATEAU: past the floor the rate integral is exactly FLAT in surplus haste, so the model is
//   INDIFFERENT among placements that differ only in surplus haste. The sim is not indifferent: at
//   dt = 1.0s its cast lattice is a STAIRCASE, and whether a window fits 20 casts or 21 depends on
//   phase. Where the model has a plateau the sim has steps, so the model lands on an ARBITRARY
//   point of the plateau (decided by the legibility/canonical tie-breaks, which are not a
//   maximization) while the sim has a best step. That predicts a deficit which is small, ONE-SIDED,
//   and concentrated exactly where the floor binds — the observed shape.
//
// ── PRE-REGISTERED, BEFORE THE FIRST RUN ─────────────────────────────────────────────────────
// Both plans are RE-SCORED here at the common haste simH (targets.json's nativeEff/borrowedEff are
// each plan's OWN-haste score and are NOT a ranking — using them as one would be the compare-two-
// currencies error TOOLING warns about). Both go through the identical call, so the comparison is
// one code path.
//
// P1 PLATEAU  median |model delta| is SMALLER in the floored stratum than in the slow stratum,
//             even though the SIM deficit there is LARGER. That is the signature of a tie-break
//             failure rather than a valuation error.
// P2 SIGN     in the floored stratum the model should mostly PREFER NATIVE (delta >= 0) or tie. A
//             model that prefers the rival is a SEARCH miss, which pooling is supposed to have
//             eliminated — so any delta < 0 here is a finding in its own right and is listed.
// P3 FALSIFIER  if |model delta| is LARGER in the floored stratum, H_PLATEAU IS DEAD and the
//             residual is a valuation error at the floor instead. This must be reported as such,
//             not re-framed. (The ledger's tracked failure mode is evidence selected by the
//             hypothesis — DIARY rows 259, 264, 272.)
// P4 SELF-CHECK  gcdCappedTime/T must be HIGHER in the floored stratum. If a "floored edge" cell
//             does not actually spend more of its fight at the cap, then `c = last.interval` is
//             picking up one lucky last cast and this whole stratification means nothing.
// P5 NULL     if the floored stratum has fewer than 8 usable cells, report UNDERPOWERED and make
//             no claim. n=12 is thin; a p-value on 4 cells would be theatre.
//
// ── WHAT A PASS DOES NOT LICENSE ─────────────────────────────────────────────────────────────
// P1 passing says the deficit lives in the TIE-BREAK, not the scorer. It does NOT say which
// tie-break, and it is NOT a licence to add a sim-shaped quantization term to the scorer — the
// column control in `lattice-ripple.mjs` section 3 already refused that (r 0.79 vs 0.93). The
// follow-up it licenses is a search/tie-break probe: at a plateau cell, enumerate the plateau and
// ask whether ANY point of it the model rates equal-or-better also wins in the sim.
//
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadEngine } from './engine-node.mjs';
import { REF } from './reference-gear.mjs';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PRICED = process.argv[2];
// `--json <path>` dumps the SCORED rows (priced row + dModel + capFrac + cast counts) so a follow-up
// probe reads them instead of re-implementing score(). One scoring implementation, many readers.
const JSON_OUT = (() => { const i = process.argv.indexOf('--json'); return i > 0 ? process.argv[i + 1] : null; })();
if (!PRICED || !fs.existsSync(PRICED)) {
  console.error('usage: node tools/floor-plateau.mjs <priced.json from ripple-audit --json> [--json out.json]');
  process.exit(2);
}
const rows = JSON.parse(fs.readFileSync(PRICED, 'utf8'));
if (!Array.isArray(rows) || !rows.length) { console.error('ERROR: empty input — an empty read is never a pass.'); process.exit(2); }

const { simulate, buildSegments, BUFFS, cases } = loadEngine(path.join(REPO, 'index.html'));
const UNSPEC = { BL: 'bloodlust', AP: 'arcanePower', Zerk: 'berserking', Icon: 'isc', Gem: 'scb', Skull: 'skull', MQG: 'mqg', IV: 'icyVeins' };
const slug = s => String(s).replace(/[^A-Za-z0-9]/g, '').toLowerCase();

function segmentsFor(klass, T) {
  if (!/^boss:/i.test(String(klass))) return null;
  const want = slug(String(klass).replace(/^boss:/i, ''));
  const hits = cases.filter(c => slug(c.name) === want);
  if (hits.length !== 1) throw new Error(`boss preset "${klass}" resolved to ${hits.length} presets — refusing to guess`);
  const p = hits[0];
  const raw = p.phases || (p.intermission ? [{ type: 'intermission', from: p.intermission[0], to: p.intermission[1] }] : []);
  if (!raw.length) return null;
  return buildSegments(raw.map(ph => ({ from: ph.from, to: ph.to, type: ph.type, mult: ph.mult || 1, targets: ph.targets || 0 })), T);
}

// score ONE spec at ONE haste — the identical call for native and rival, so the two numbers are
// in one currency (TOOLING: "if two numbers in one comparison came from different code paths, the
// comparison is not a measurement").
function score(cell, spec) {
  const pair = cell.kit.split('+');
  const kit = ['icyVeins', pair[0], pair[1], 'arcanePower', 'berserking', 'bloodlust'];
  const enabled = {}; for (const k in BUFFS) enabled[k] = kit.includes(k);
  const cfg = { T: cell.T, hasteRating: cell.simH, ...REF, enabled,
                fixed: { bloodlust: [cell.lust] }, warnings: [], coldSnap: true, segments: segmentsFor(cell.class, cell.T) };
  const state = {};
  for (const [sk, bk] of Object.entries(UNSPEC)) if (spec[sk]) state[bk] = spec[sk].slice();
  const r = simulate(state, cfg, true);
  return { robust: r.robust, capFrac: r.gcdCappedTime / cell.T, casts: r.casts ? r.casts.length : 0 };
}

const out = [];
for (const cell of rows) {
  if (!cell.nativeSpec || !cell.borrowedSpec) continue;
  let n, b;
  try { n = score(cell, cell.nativeSpec); b = score(cell, cell.borrowedSpec); }
  catch (e) { console.log(`  SKIP ${cell.kit} ${cell.class} @${cell.simH}: ${e.message}`); continue; }
  // model delta, as a PERCENT of native, signed so that POSITIVE = the model prefers NATIVE (the
  // same orientation as the sim's `pct`, which is positive when the RIVAL wins — note the flip).
  const dModel = 100 * (n.robust - b.robust) / n.robust;
  out.push({ ...cell, dModel, capFrac: n.capFrac, capFracRival: b.capFrac, castsN: n.casts, castsB: b.casts });
}

const med = a => { const s = [...a].sort((x, y) => x - y); return s.length ? s[Math.floor(s.length / 2)] : NaN; };
function mw(a, b) {                       // Mann-Whitney U, normal approx, tie-corrected
  const all = [...a.map(v => [v, 0]), ...b.map(v => [v, 1])].sort((x, y) => x[0] - y[0]);
  const rk = new Array(all.length); const tie = []; let i = 0;
  while (i < all.length) { let j = i; while (j + 1 < all.length && all[j + 1][0] === all[i][0]) j++;
    const rr = (i + j + 2) / 2; for (let k = i; k <= j; k++) rk[k] = rr; tie.push(j - i + 1); i = j + 1; }
  let R1 = 0; for (let k = 0; k < all.length; k++) if (all[k][1] === 0) R1 += rk[k];
  const n1 = a.length, n2 = b.length, N = n1 + n2;
  const U = R1 - n1 * (n1 + 1) / 2, mu = n1 * n2 / 2;
  const tsum = tie.reduce((s, t) => s + t * t * t - t, 0);
  const sd = Math.sqrt(n1 * n2 / 12 * ((N + 1) - tsum / (N * (N - 1))));
  const z = (U - mu) / sd;
  const erf = x => { const t = 1 / (1 + 0.3275911 * x); return 1 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-x * x); };
  return { z, p: 2 * (1 - 0.5 * (1 + erf(Math.abs(z) / Math.SQRT2))) };
}

const FL = out.filter(x => x.c <= 1.10), SL = out.filter(x => x.c > 1.10);
console.log(`\nscored ${out.length} columns at their own simH (native + rival, one code path each)`);
console.log(`  floored edge (c<=1.10): n=${FL.length}    slow edge: n=${SL.length}`);

if (FL.length < 8) {
  console.log('\nP5 NULL: UNDERPOWERED — fewer than 8 floored cells. No claim made.');
  console.log('\nFLOOR-PLATEAU-DONE verdict=UNDERPOWERED');
  process.exit(0);
}

const aFL = FL.map(x => Math.abs(x.dModel)), aSL = SL.map(x => Math.abs(x.dModel));
const m1 = mw(aFL, aSL);
const p1 = med(aFL) < med(aSL);
console.log('\n=== P1 PLATEAU — is |model delta| SMALLER where the floor binds? ===');
console.log(`  floored  med |dModel| ${med(aFL).toFixed(4)}%   med sim deficit ${med(FL.map(x => x.pct)).toFixed(3)}%`);
console.log(`  slow     med |dModel| ${med(aSL).toFixed(4)}%   med sim deficit ${med(SL.map(x => x.pct)).toFixed(3)}%`);
console.log(`  Mann-Whitney z=${m1.z.toFixed(2)} p=${m1.p.toFixed(4)}   =>  P1 ${p1 ? 'PASS' : 'FAIL'}`);
if (!p1) console.log('  ★ P3 FALSIFIER FIRED: H_PLATEAU is DEAD. The floored residual is a VALUATION error,\n    not a tie-break failure. Do not re-frame this — it is the pre-registered opposite outcome.');

console.log('\n=== P2 SIGN — does the model prefer NATIVE at the floored cells? ===');
const wrong = FL.filter(x => x.dModel < -1e-9);
console.log(`  model prefers native (or ties): ${FL.length - wrong.length}/${FL.length}`);
if (wrong.length) {
  console.log('  ★ model prefers the RIVAL at these — a SEARCH miss that pooling should have removed:');
  for (const x of wrong) console.log(`     ${x.kit} ${x.class} T=${x.T} @${x.simH}  dModel ${x.dModel.toFixed(4)}%  sim ${x.pct.toFixed(3)}%`);
}

console.log('\n=== P4 SELF-CHECK — do "floored edge" cells really spend more time at the cap? ===');
const cFL = med(FL.map(x => x.capFrac)), cSL = med(SL.map(x => x.capFrac));
const m4 = mw(FL.map(x => x.capFrac), SL.map(x => x.capFrac));
const p4 = cFL > cSL;
console.log(`  floored med capFrac ${(100 * cFL).toFixed(1)}%   slow med capFrac ${(100 * cSL).toFixed(1)}%   z=${m4.z.toFixed(2)} p=${m4.p.toFixed(4)}  =>  P4 ${p4 ? 'PASS' : 'FAIL'}`);
if (!p4) console.log('  ★ P4 FAILED: `c = last.interval` is not tracking a materially floored fight.\n    The whole floored/slow stratification is then an artifact of one lucky last cast — say so.');

console.log('\n=== the floored cells, one line each ===');
console.log('| kit | class | T | simH | c | sim deficit % | model d % | capFrac | casts N/B |');
console.log('|---|---|---|---|---|---|---|---|---|');
for (const x of FL.sort((p, q) => q.pct - p.pct))
  console.log(`| ${x.kit} | ${x.class} | ${x.T} | ${x.simH} | ${x.c.toFixed(3)} | ${x.pct.toFixed(3)} | ${x.dModel >= 0 ? '+' : ''}${x.dModel.toFixed(4)} | ${(100 * x.capFrac).toFixed(1)}% | ${x.castsN}/${x.castsB} |`);

// ── POST-HOC — NOT PRE-REGISTERED. Read as hypothesis-GENERATING, never as confirmation. ──────
// Added after the first run, once P3 fired. Two things the pre-registered set does not say:
//
//  (a) P2's "12/12 prefers native" is a VALIDITY CHECK, not evidence. dModel >= 0 holds BY
//      CONSTRUCTION — native IS the model's own argmax at that haste, so only a search miss can
//      make it negative. What carries the content is the MAGNITUDE of dModel, and that is what
//      P1/P3 tested.
//  (b) the sim deficit `pct` alone UNDERSTATES the disagreement. The sim says rival by `pct`; the
//      model says native by `dModel`. The two rankings are apart by the SUM. That sum is the
//      quantity a valuation fix would have to close.
console.log('\n=== POST-HOC (not pre-registered) — the JOINT ranking disagreement, dModel + pct ===');
const jFL = FL.map(x => x.dModel + x.pct), jSL = SL.map(x => x.dModel + x.pct);
const mj = mw(jFL, jSL);
console.log(`  floored med ${med(jFL).toFixed(4)} pp   slow med ${med(jSL).toFixed(4)} pp   ratio ${(med(jFL) / med(jSL)).toFixed(2)}x   z=${mj.z.toFixed(2)} p=${mj.p.toFixed(4)}`);
const capAll = out.map(x => x.capFrac), pctAll = out.map(x => x.pct);
const rank = a => { const s = a.map((v, i) => [v, i]).sort((x, y) => x[0] - y[0]); const r = new Array(a.length); s.forEach(([, i], k) => r[i] = k); return r; };
const rc = (() => { const A = rank(capAll), B = rank(pctAll), n = A.length;
  const ma = (n - 1) / 2; let sa = 0, sb = 0, sab = 0;
  for (let i = 0; i < n; i++) { sa += (A[i] - ma) ** 2; sb += (B[i] - ma) ** 2; sab += (A[i] - ma) * (B[i] - ma); }
  return sab / Math.sqrt(sa * sb); })();
console.log(`  Spearman(capFrac, sim deficit) over all ${out.length} = ${rc.toFixed(3)}`);
console.log('  ⚠ EXPLORATORY. A capFrac link would point at the floor-slack/ramp credit (index.html:919-931,');
console.log('    worth +0.33..+0.41 pp when the floor binds — big enough that a ~15% error in it IS these');
console.log('    deficits). That is a hypothesis to PRE-REGISTER and test, not a result of this run.');

if (JSON_OUT) {
  fs.writeFileSync(JSON_OUT, JSON.stringify(out, null, 1));
  console.log(`\nwrote ${out.length} scored rows -> ${JSON_OUT}`);
}

const verdict = !p4 ? 'STRATIFICATION-INVALID' : p1 ? 'TIE-BREAK' : 'VALUATION';
console.log(`\nFLOOR-PLATEAU-DONE verdict=${verdict} nFloored=${FL.length} medAbsDeltaFloored=${med(aFL).toFixed(4)} medAbsDeltaSlow=${med(aSL).toFixed(4)} p1=${m1.p.toFixed(4)} modelPrefersRival=${wrong.length} p4=${p4 ? 1 : 0}`);
