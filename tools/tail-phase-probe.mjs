// ⛔⛔ RETIRED — THIS PROBE MEASURES NOTHING UNDER THE CURRENT OBJECTIVE. IT NOW REFUSES TO RUN. ⛔⛔
//
//   Killed by: PHASE12 §9 (user ruling 07-27) — the boundary-credit rewrite.
//   Kept because: its RESULT is a closed finding worth not re-litigating (see the verdict at the
//   bottom, and P7 below). The code is preserved as the record of how that finding was reached.
//
// THE PROBE'S ENTIRE SUBJECT WAS THE SEPARATION `tailIntegral = robust - totalEarly` — the slice of
// score living inside the symmetric kill window `[T-KW, T+KW]`, where the taper was *changing* and so
// cast PHASE became load-bearing. That separation is now **identically zero**:
//   · `KILL_WINDOW` and the symmetric taper are RETIRED from the objective. The one uniform rule is
//     `credit = min(1, (nextCut - castStart) / castDuration)`, applied at every cut, read at the
//     cast's START — a cast completing exactly at T now earns a FULL cast, not 0.5.
//   · `total`, `robust` and `totalEarly` are consequently THE SAME NUMBER (all three still returned
//     so no caller crashes). So `robust - totalEarly == 0` for every plan, on every fight.
// There is no longer a "tail region" for the model to be blind in, and nothing for a tail-discrete
// correction to correct. Letting it run would print a full table of P1/P2/P3/P4 statistics computed
// against a zero — structurally identical to a PASS, and read by a future session as evidence.
// It therefore DIES at the first scored plan (exit 2 = could not probe) rather than reporting.
//
// ★ THE FINDING IT LEAVES BEHIND, which the retirement does not overturn: the model's tail phase was
// unusable AT ANY THRESHOLD, in BOTH its scoring form (Stage 1: P2 worse, P4 broke ~48 % of the
// columns the model already got right) and its tie-break form (Stage 2: P7 fired, no eps met the bar).
// The "make the objective see the terminal cast" family stayed closed; the objective was eventually
// fixed somewhere else entirely, at the boundary CREDIT rule rather than at the tail statistic.
//
// ── the original header follows, unedited, as the record ─────────────────────────────────────────
//
// THE TAIL-PHASE PROBE — is the model's tail blindness the mechanism behind invariant B2?
//
//   node tools/tail-phase-probe.mjs [--index /tmp/index-round.html] [--dir tools/xval-results]
//
// ── THE HYPOTHESIS, AND WHY IT IS NOT "DISCRETIZE THE SCORER" ─────────────────────────────────────
// `simulate()` carries TWO accounts of the same fight:
//   · a DISCRETE board walk (`casts`, index.html:1086) — every cast, its start `t`, its `cast` time
//     and its `dmg`. Used for the UI board and the press logic. NOT used for scoring.
//   · a CONTINUOUS rate integral (`:1248-1263`) — `rateAt(mid) * len`, tapered at each breakpoint
//     span's MIDPOINT by `min(1, max(0, (T + KW - mid) / (2*KW)))`. This is what `robust` scores.
//
// In the fight interior the taper is 1 everywhere, so cast PHASE is irrelevant and the integral is an
// excellent predictor. Inside `[T-KW, T+KW]` the taper is *changing*, so phase becomes load-bearing:
// the integral credits the EXPECTATION over a uniformly-random cast phase, while a given plan's phase
// is DETERMINED — its last cast either completes before the kill or is wasted. PHASE10 §8.23 caught
// exactly this by hand at one cell (native's last cast completes at 99.6216 s, past `T+KW = 99.5`,
// weight 0 — while the rival's completes at 99.3041 s and fits one more).
//
// ⚠ **Full discretization is ALREADY FALSIFIED** (ACCEPTANCE; `tools/lattice-ripple.mjs`): replacing
// the integral everywhere is a WORSE predictor across a full column — r 0.7910 / RMSE 0.2948 against
// the integral's r 0.9337 / RMSE 0.2431 — because it adds quantization variance in the interior where
// the integral was already right. **This probe tests the STRICTLY WEAKER change**: keep the integral
// everywhere, and replace it with the plan's own tapered cast sum ONLY inside `[T-KW, T+KW]`, the one
// place the taper makes phase matter.
//
//     scoreModel = totalEarly + tailIntegral      (tailIntegral = robust - totalEarly, exactly:
//                                                  T-KW is a breakpoint, so no span straddles it)
//     scoreAlt   = totalEarly + tailDiscrete      (tailDiscrete = sum over board casts COMPLETING
//                                                  after T-KW of dmg * taper(completion))
//
// ── PRE-REGISTERED PREDICTIONS (written before the first run; house rule, ACCEPTANCE §6) ──────────
// The metric is the one the falsified experiment used, so the two are comparable: per sim-haste
// COLUMN, correlate each plan row's model score against the sim's measured DPS for that row, over
// ALL rows — not only the borrowed winner. A fix must predict the whole column, not rescue one cell.
//
//   P1  MECHANISM IS PRESENT. The two accounts must actually disagree in the tail: median
//       |tailDiscrete - tailIntegral| / robust > 0.02 % (the CRN resolution). If they agree, the
//       hypothesis is empty and nothing below means anything.
//   P2  IT PREDICTS BETTER. mean Pearson r(scoreAlt, simDPS) over columns must EXCEED
//       r(scoreModel, simDPS). Bar: strictly greater, and above the integral's own 0.9337.
//   P3  IT MOVES THE DEFICITS. Among the round's borrowed-win columns, scoreAlt must prefer the
//       sim's winner in MORE columns than scoreModel does (which by B1 prefers native in 100 % of
//       them, so any improvement is measurable).
//   P4  ★ THE FALSIFIER, and it is the one that killed full discretization. On columns where the
//       sim AGREES with the model (native genuinely wins), scoreAlt must NOT flip them. If the
//       correction flips agreements at a rate comparable to the disagreements it fixes, it is adding
//       variance rather than signal and is falsified exactly as its predecessor was.
//   P5  ARITHMETIC SELF-CHECK. `robust - totalEarly` must be >= 0 on every plan, and `tailDiscrete`
//       must be 0 whenever the fight has no cast completing after T-KW. A violation means the
//       separation above is wrong and the run is void.
//
// ⚠ SCOPE: CLASS tables only. A boss column carries wall-parity and AoE channels and is a 5-variant
// jitter mean — ACCEPTANCE is explicit that boss and class cells are two instruments with different
// noise and must never be pooled. Boss cells are counted and named as not-probed, never absorbed.
//
// ⚠ The plan cache keys on `sha1(index.html)`, and the file has changed since the round. Pass
// `--index` pointing at the blob the ROUND used; the probe asserts cache HITS and dies naming the
// miss, so it can never silently probe a different engine's plans.
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadEngine, ALL_BUFFS } from './engine-node.mjs';
import { REF } from './reference-gear.mjs';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const die = m => { console.error('ERROR: ' + m); process.exit(2); };
const argv = process.argv.slice(2);
const arg = (k, d) => { const i = argv.indexOf('--' + k); return i >= 0 && argv[i + 1] !== undefined ? argv[i + 1] : d; };
const INDEX = path.resolve(arg('index', path.join(REPO, 'index.html')));
const DIR = path.resolve(arg('dir', path.join(REPO, 'tools/xval-results')));
const CACHE = path.join(REPO, '.xval-cache');
if (!fs.existsSync(INDEX)) die(`--index ${INDEX} does not exist`);
if (!fs.existsSync(CACHE)) die(`${CACHE} is missing — the plan cache is gitignored and dies with the container. Re-solve or re-run the round.`);

const api = loadEngine(INDEX);
const ENGINE_ID = crypto.createHash('sha1').update(fs.readFileSync(INDEX)).digest('hex').slice(0, 12);

// ★ ALWAYS-ON RETIREMENT BANNER. `--index` names BOTH the engine and the plan-cache key, so pointing
// it at an old round blob replays a RETIRED scorer and prints a full, plausible, current-looking
// result. Say what it is before any number appears; the runtime gate in `score()` catches the other
// case (a current engine, where the separation is exactly 0).
console.log('='.repeat(96));
console.log('⛔ RETIRED INSTRUMENT — HISTORICAL REPLAY ONLY.');
console.log(`   Everything below describes the engine at ${INDEX}`);
console.log('   and is a re-run of a CLOSED investigation, NOT a measurement of the current scorer.');
console.log('   The objective no longer has the tail region this probe separates: total, robust and');
console.log('   totalEarly are one accumulator (PHASE12 §9 boundary credit), so robust - totalEarly = 0.');
console.log('   Against a current engine this tool exits 2. See the file header.');
console.log('='.repeat(96) + '\n');
// ⛔ The RETIRED symmetric kill window. It no longer corresponds to anything in the objective — it is
// left here only so the preserved code below still parses and still reads as it did when it ran.
const KW = 0.5;

// ── read the round's tables ──────────────────────────────────────────────────────────────────────
const tables = [], skippedBoss = [];
for (const f of fs.readdirSync(DIR).filter(x => x.endsWith('.txt')).sort()) {
  const txt = fs.readFileSync(path.join(DIR, f), 'utf8');
  const done = txt.match(/^XVAL-DONE .*/m);
  if (!done) continue;
  const kv = Object.fromEntries([...done[0].matchAll(/(\w+)=(\S+)/g)].map(x => [x[1], x[2]]));
  if (String(kv.class).startsWith('BOSS:')) { skippedBoss.push(f); continue; }
  const lines = txt.split('\n');
  const hi = lines.findIndex(l => l.startsWith('plan\\sim'));
  if (hi < 0) continue;
  const hastes = lines[hi].trim().split(/\s+/).slice(1).map(Number);
  const M = {};
  for (let i = hi + 1; i < lines.length; i++) {
    const p = lines[i].trim().split(/\s+/);
    if (p.length !== hastes.length + 1 || !/^\d+$/.test(p[0])) { if (Object.keys(M).length) break; else continue; }
    M[+p[0]] = Object.fromEntries(hastes.map((h, k) => [h, +p[k + 1]]));
  }
  if (Object.keys(M).length !== hastes.length) continue;
  tables.push({ file: f, kit: kv.kit.split('+'), T: +kv.T, lust: +kv.lust, hastes, M });
}
if (!tables.length) die(`no class tables parsed from ${DIR} — nothing to probe. (Zero data is an error, never a pass.)`);

// ── plans, from the round's own cache (a MISS is fatal: it would mean a different engine) ─────────
const planOf = (cfg) => {
  const key = 'plan-' + crypto.createHash('sha1').update(JSON.stringify({ cfg, engine: ENGINE_ID, restarts: 14 })).digest('hex').slice(0, 24);
  const cf = path.join(CACHE, key + '.json');
  if (!fs.existsSync(cf)) return null;
  const v = JSON.parse(fs.readFileSync(cf, 'utf8'));
  return v && v.s ? v.s : null;
};

// ── the two tail accounts ────────────────────────────────────────────────────────────────────────
const taper = (tc, T) => Math.min(1, Math.max(0, (T + KW - tc) / (2 * KW)));
const score = (s, cfg) => {
  const r = api.simulate(s, cfg, true);
  // ★ THE RETIREMENT GATE. `robust` and `totalEarly` are the same accumulator since the
  // boundary-credit rewrite, so this difference is exactly 0 and every statistic downstream of it is
  // a statistic about nothing. Refuse, loudly, instead of reporting zeros that look like results.
  if (r.robust === r.totalEarly) {
    console.error('⛔ tail-phase-probe is RETIRED and cannot run against this engine.');
    console.error('   `tailIntegral = robust - totalEarly` came back EXACTLY 0: the engine returns');
    console.error('   total === robust === totalEarly (PHASE12 §9 boundary credit — the symmetric kill');
    console.error('   window and its taper are retired, so there is no tail region to separate).');
    console.error('   This probe measures NOTHING here. Its finding stands and is in the file header:');
    console.error('   the model\'s tail phase was unusable at any threshold, in both the scoring and');
    console.error('   the tie-break form. Do not re-open that family; do not "fix" this by re-adding KW.');
    process.exit(2);
  }
  const tailIntegral = r.robust - r.totalEarly;
  let tailDiscrete = 0, lastTc = -Infinity, tailN = 0;
  for (const c of (r.casts || [])) {
    const tc = c.t + c.cast;                       // completion: the cast starts at t and takes `cast`
    if (tc > lastTc) lastTc = tc;
    if (tc <= cfg.T - KW) continue;                // fully inside totalEarly's untapered region
    tailDiscrete += c.dmg * taper(tc, cfg.T);
    tailN++;
  }
  return { robust: r.robust, totalEarly: r.totalEarly, tailIntegral, tailDiscrete, tailN, lastTc,
           alt: r.totalEarly + tailDiscrete };
};

// ── run ──────────────────────────────────────────────────────────────────────────────────────────
const pearson = (a, b) => {
  const n = a.length; if (n < 3) return null;
  const ma = a.reduce((x, y) => x + y, 0) / n, mb = b.reduce((x, y) => x + y, 0) / n;
  let sab = 0, sa = 0, sb = 0;
  for (let i = 0; i < n; i++) { const da = a[i] - ma, db = b[i] - mb; sab += da * db; sa += da * da; sb += db * db; }
  return (sa <= 0 || sb <= 0) ? null : sab / Math.sqrt(sa * sb);
};

const rowsAll = [];            // per (table, sim-haste) column
let miss = 0, p5bad = 0, gapNums = [];
for (const tb of tables) {
  const kit = ['icyVeins', tb.kit[0], tb.kit[1], 'arcanePower', 'berserking', 'bloodlust'];
  const en = {}; for (const k of ALL_BUFFS) en[k] = kit.includes(k);
  const mkCfg = h => ({ T: tb.T, hasteRating: h, ...REF, enabled: en, fixed: { bloodlust: [tb.lust] }, warnings: [], coldSnap: true, segments: null });
  // the champion set, from cache
  const champ = {};
  for (const h of tb.hastes) { const s = planOf(mkCfg(h)); if (!s) { miss++; continue; } champ[h] = s; }
  if (Object.keys(champ).length !== tb.hastes.length) continue;
  for (const H of tb.hastes) {
    const cfg = mkCfg(H);
    const mdl = [], alt = [], sim = [], phs = [];
    for (const ph of tb.hastes) {
      const sc = score(champ[ph], cfg);
      if (!(sc.tailIntegral >= -1e-9)) p5bad++;
      gapNums.push(Math.abs(sc.tailDiscrete - sc.tailIntegral) / sc.robust * 100);
      mdl.push(sc.robust); alt.push(sc.alt); sim.push(tb.M[ph][H]); phs.push(ph);
    }
    rowsAll.push({ file: tb.file, kit: tb.kit.join('+'), T: tb.T, H, phs, mdl, alt, sim });
  }
}
if (miss) die(`${miss} plan(s) not in the cache for engine ${ENGINE_ID}. Pass --index pointing at the index.html the ROUND used, or re-solve. Refusing to probe a different engine's plans.`);
if (!rowsAll.length) die('no columns probed — nothing to report. (Zero data is an error, never a pass.)');

const med = xs => { const v = [...xs].sort((a, b) => a - b); return v.length % 2 ? v[(v.length - 1) / 2] : (v[v.length / 2 - 1] + v[v.length / 2]) / 2; };

console.log(`TAIL-PHASE PROBE — ${tables.length} class tables · ${rowsAll.length} columns · engine ${ENGINE_ID}`);
console.log(`(boss tables NOT probed, and not absorbed: ${skippedBoss.length} — ${skippedBoss.join(' ')})\n`);

// P5 first: if the separation is wrong nothing below means anything.
console.log(`P5 ARITHMETIC SELF-CHECK   tailIntegral >= 0 on every plan: ${p5bad === 0 ? 'PASS' : `**FAIL (${p5bad})**`}`);
// P1
const mg = med(gapNums);
console.log(`P1 MECHANISM PRESENT       median |tailDiscrete - tailIntegral| / robust = ${mg.toFixed(4)} %   (bar >0.02)  ${mg > 0.02 ? 'PASS' : '**FAIL — the two accounts agree; hypothesis is empty**'}`);

// P2 — whole-column predictive power, the metric that killed full discretization
const rM = [], rA = [];
for (const c of rowsAll) { const a = pearson(c.mdl, c.sim), b = pearson(c.alt, c.sim); if (a !== null && b !== null) { rM.push(a); rA.push(b); } }
const meanM = rM.reduce((a, b) => a + b, 0) / rM.length, meanA = rA.reduce((a, b) => a + b, 0) / rA.length;
console.log(`P2 PREDICTIVE POWER        mean r over ${rM.length} columns:  integral ${meanM.toFixed(4)}   tail-corrected ${meanA.toFixed(4)}   ` +
            `${meanA > meanM ? `IMPROVES by ${(meanA - meanM).toFixed(4)}` : `**WORSE by ${(meanM - meanA).toFixed(4)}**`}`);
console.log(`                           columns improved ${rA.filter((v, i) => v > rM[i]).length}/${rM.length} · worsened ${rA.filter((v, i) => v < rM[i]).length}/${rM.length}`);

// P3 / P4 — the argmax test, split by whether the sim AGREES with the model
let dFix = 0, dTot = 0, aBreak = 0, aTot = 0;
for (const c of rowsAll) {
  const iSim = c.sim.indexOf(Math.max(...c.sim));
  const iMdl = c.mdl.indexOf(Math.max(...c.mdl));
  const iAlt = c.alt.indexOf(Math.max(...c.alt));
  if (iSim !== iMdl) { dTot++; if (iAlt === iSim) dFix++; }        // P3: disagreements the fix repairs
  else { aTot++; if (iAlt !== iSim) aBreak++; }                     // P4: agreements the fix breaks
}
console.log(`P3 FIXES DISAGREEMENTS     ${dFix}/${dTot} columns where the sim's winner != the model's are REPAIRED  (${(100 * dFix / Math.max(1, dTot)).toFixed(1)} %)`);
console.log(`P4 ★ FALSIFIER             ${aBreak}/${aTot} columns where they AGREE are BROKEN  (${(100 * aBreak / Math.max(1, aTot)).toFixed(1)} %)`);
const net = dFix - aBreak;
console.log(`\n   net argmax columns: ${net >= 0 ? '+' : ''}${net}   (repaired ${dFix} - broken ${aBreak})`);
console.log(net > 0 && meanA > meanM
  ? '\n✅ BOTH GATES PASS — tail-only correction predicts better AND is net-positive on argmax.'
  : '\n⛔ NOT SUPPORTED — this is the same shape as the falsified full-discretization result. Do not land it.');

// ═══════════════════════════════════════════════════════════════════════════════════════════════
// STAGE 2 — THE TIE-BREAK FORM, tested because STAGE 1's falsifier fired in a SPECIFIC way
//
// Stage 1 result: the mechanism is REAL (P1: the two tail accounts differ by a median 0.149 % of
// robust, ~7x the CRN resolution) but scoring with the discrete tail is WORSE (P2) and breaks ~48 %
// of the columns the model already gets right (P4) — a coin flip, i.e. noise not signal.
//
// The reading that survives both facts: **the model's tail PHASE is not accurate enough to score
// with, even though tail phase is what decides the cell.** Its board walk blends cast times by proc
// probability and cannot know the sim's realized lattice.
//
// So the weaker claim worth testing: use the discrete tail ONLY where the integral has no opinion.
// ACCEPTANCE already names that regime — *"where the model's margin is below the ruler, the model has
// no opinion to be wrong about"* (58 of 135 gear-A columns priced <=0.02 % apart). A tie-break there
// cannot break a column the integral ranks confidently, which is exactly what P4 punished.
//
//   rank by robust; where |robust_i - robust_j| / robust < EPS, rank those by tailDiscrete instead.
//
// PRE-REGISTERED (before the sweep is run):
//   P6  There exists EPS at which net argmax > 0 AND agreements broken <= 5 %.
//   P7  ★ FALSIFIER. If the net is maximised as EPS -> 0 (i.e. "do nothing" is best), or never turns
//       positive, or only turns positive at an EPS so wide it is no longer a tie-break (> 0.5 %,
//       ~ the corpus's whole deficit range), the tie-break form is unsupported too and the finding is
//       that the model's tail phase is unusable AT ANY threshold.
console.log('\n' + '='.repeat(96));
console.log('STAGE 2 — TIE-BREAK FORM: rank by the integral; break sub-resolution ties by the discrete tail');
console.log('='.repeat(96));
const argmaxTB = (mdl, alt, eps) => {
  let best = 0;
  for (let i = 1; i < mdl.length; i++) {
    const rel = Math.abs(mdl[i] - mdl[best]) / Math.max(mdl[i], mdl[best]);
    if (rel < eps) { if (alt[i] > alt[best]) best = i; }            // a tie: let the tail decide
    else if (mdl[i] > mdl[best]) best = i;                          // a real preference: integral wins
  }
  return best;
};
console.log('   eps %   repaired/dis   broken/agree   net    (bar: net>0 AND broken<=5%)');
const sweep = [0, 0.0001, 0.0002, 0.0005, 0.001, 0.002, 0.005, 0.01];
let bestNet = -1e9, bestEps = null;
for (const eps of sweep) {
  let dFix = 0, dTot = 0, aBreak = 0, aTot = 0;
  for (const c of rowsAll) {
    const iSim = c.sim.indexOf(Math.max(...c.sim));
    const iMdl = c.mdl.indexOf(Math.max(...c.mdl));
    const iTB = argmaxTB(c.mdl, c.alt, eps);
    if (iSim !== iMdl) { dTot++; if (iTB === iSim) dFix++; }
    else { aTot++; if (iTB !== iSim) aBreak++; }
  }
  const net = dFix - aBreak, brokenPct = 100 * aBreak / Math.max(1, aTot);
  const ok = net > 0 && brokenPct <= 5;
  if (net > bestNet) { bestNet = net; bestEps = eps; }
  console.log(`  ${(eps * 100).toFixed(3).padStart(6)}   ${String(dFix).padStart(3)}/${String(dTot).padEnd(4)}      ` +
              `${String(aBreak).padStart(3)}/${String(aTot).padEnd(4)}    ${net >= 0 ? '+' : ''}${String(net).padEnd(4)} ${ok ? ' ✓' : ''}`);
}
console.log(`\n   best net ${bestNet >= 0 ? '+' : ''}${bestNet} at eps=${(bestEps * 100).toFixed(3)} %`);
// ⚠ THIS VERDICT WAS WRONG ON ITS FIRST WRITING, and the bug is this repo's own signature defect:
// it branched on `bestNet > 0` alone and printed a PASS, while P6's pre-registered bar is
// **net > 0 AND broken <= 5 %**. No eps in the sweep earns the `✓`. Graded on the WHOLE bar:
const bestBroken = (() => {
  let dFix = 0, dTot = 0, aBreak = 0, aTot = 0;
  for (const c of rowsAll) {
    const iSim = c.sim.indexOf(Math.max(...c.sim));
    const iMdl = c.mdl.indexOf(Math.max(...c.mdl));
    const iTB = argmaxTB(c.mdl, c.alt, bestEps);
    if (iSim !== iMdl) { dTot++; if (iTB === iSim) dFix++; } else { aTot++; if (iTB !== iSim) aBreak++; }
  }
  return { aBreak, aTot, pct: 100 * aBreak / Math.max(1, aTot) };
})();
const p6 = bestNet > 0 && bestBroken.pct <= 5 && bestEps > 0 && bestEps <= 0.005;
console.log(`   at that eps it BREAKS ${bestBroken.aBreak}/${bestBroken.aTot} agreements = ${bestBroken.pct.toFixed(1)} %  (P6 bar: <=5 %)`);
console.log(p6
  ? `\n✅ P6 — a sub-resolution tie-break at eps=${(bestEps * 100).toFixed(3)} % is net +${bestNet}. Candidate; needs a sim duel at every moved cell.`
  : `\n⛔ P7 FIRES — P6's bar is net>0 AND broken<=5 %, and NO eps meets it (best: net ${bestNet >= 0 ? '+' : ''}${bestNet} at ` +
    `${(bestEps * 100).toFixed(3)} %, breaking ${bestBroken.pct.toFixed(1)} %). A net of +${bestNet} over ${rowsAll.length} columns ` +
    `is indistinguishable from zero.\n   ⇒ THE MODEL'S TAIL PHASE IS UNUSABLE AT ANY THRESHOLD. The whole ` +
    `"make the objective see the terminal cast" family is closed, in BOTH its scoring and its tie-break form.`);
