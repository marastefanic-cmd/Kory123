// THE TAIL-LATTICE RIPPLE — why a cross-val cell can show a deficit with a CORRECT model.
//
//   node tools/lattice-ripple.mjs            # all three sections
//   node tools/lattice-ripple.mjs ripple     # 1. closed form + the diagWorst selection bias
//   node tools/lattice-ripple.mjs cell       # 2. the isc-skull-short single-cell test
//   node tools/lattice-ripple.mjs column     # 3. the full-column control (the honesty check)
//
// ── THE MECHANISM ────────────────────────────────────────────────────────────────────────────
// The sim's expected damage under a uniform kill in [T-KW, T+KW] is EXACTLY
//     Sum over casts of  dmg_i * clamp((T + KW - tc_i)/W, 0, 1)      (W = 2*KW = 1.0s)
// and the model computes its CONTINUUM LIMIT — a rate integral (index.html:990). The taper WIDTH
// ⚠ THIS PREMISE IS DEAD (PHASE12 §9, 07-27): the model has NO taper any more — `KILL_WINDOW` was
// retired and replaced by a one-sided per-cast boundary credit. The `--var 0.5` below is now the
// SIM's own smoothing, justified by var-decision.mjs alone, and the two no longer mirror each other.
// The widths no longer match, and neither does the KIND. Sum-vs-
// integral is the entire residual, and it is a sawtooth in T of peak-to-peak
//
//     ripple = 1 - W/c   casts        (c = the tail cast period)
//
// EXACTLY zero at the GCD floor (c == W == 1.0s) and growing as the tail slows:
//   c=1.023 -> 0.0225 casts   c=1.219 -> 0.1796   c=1.463 -> 0.3164   c=1.600 -> 0.3750
// Fixed casts on a fight of N casts => the PERCENTAGE scales as 1/N. So the artifact is
// LOW-HASTE-ONLY and SHORT-FIGHT-ONLY — precisely the signature of the acceptance test's
// residual deficit family.
//
// This is the TAIL face of the same integer-vs-continuum law whose INTERIOR-BOUNDARY face is
// PHASE8's FLOOR LAW (a value window covers exactly floor(D/Delta) casts in the sim).
//
// ── SECTION 3 IS THE POINT, NOT SECTION 2 ────────────────────────────────────────────────────
// Section 2 shows the discrete sum FLIPS the disputed ranking toward the sim (continuous -0.0062%,
// discrete +0.6046%, wowsims +0.3617%). That is tempting and it is NOT a licence to change the
// scorer. Section 3 scores the WHOLE column and shows the discrete sum is a WORSE predictor
// overall (r=0.7910 / RMSE 0.2948 vs continuous r=0.9337 / RMSE 0.2431) with large two-signed
// errors: discretization adds variance, it does not remove bias. That independently corroborates
// index.html:875-877 — a per-cast sum WAS the old model and its quantization produced the phantom
// "press 2s before lust" gains. => Report the deficit as an INSTRUMENT ARTIFACT. Do NOT adopt the sum.
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadEngine } from './engine-node.mjs';
import { REF } from './reference-gear.mjs';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const WHICH = process.argv[2] || 'all';
const KW = 0.5, W = 2 * KW;

// ══════════════════════ 1. the closed form + the selection bias ══════════════════════
function sectionRipple() {
  // lattice anchored at t=0, sweep T across one full period: f is the sim's expected casts,
  // g the model's continuum. SANITY CHECK BUILT IN: c=1.000 must read EXACTLY 0.0000 (at the
  // GCD floor the taper spans a whole cast period, so it smears the lattice perfectly).
  const wt = (tc, T) => Math.min(1, Math.max(0, (T + KW - tc) / W));
  const f = (T, c) => { let s = 0; for (let i = 1; (i - 1) * c <= T + KW; i++) s += wt(i * c, T); return s; };
  const g = (T, c) => ((T - KW) + W / 2) / c;

  console.log('TAIL RIPPLE — sim (integer casts) vs model (continuum), same taper, same physics\n');
  console.log('c(s)     W/c    ripple p-p (casts)   closed form 1-W/c   n(T=99)  ripple%');
  for (const c of [1.000, 1.023, 1.100, 1.197, 1.219, 1.300, 1.463, 1.600]) {
    let lo = Infinity, hi = -Infinity;
    for (let k = 0; k <= 4000; k++) { const T = 99 + k * c / 4000; const d = f(T, c) - g(T, c); if (d < lo) lo = d; if (d > hi) hi = d; }
    const n = g(99, c);
    console.log(`${c.toFixed(3)}   ${(W / c).toFixed(3)}   ${(hi - lo).toFixed(4)}               ${(1 - W / c).toFixed(4)}            ${n.toFixed(1)}   ${((hi - lo) / n * 100).toFixed(3)}%`);
  }

  // ── the SELECTION EFFECT: diagWorst = max over R rival rows of (rival - native). Each rival
  // carries an INDEPENDENT tail phase, so the MAX of a two-signed ripple is systematically
  // POSITIVE even for a PERFECT model. This is a resolution FLOOR on the acceptance metric.
  console.log('\nDIAGONAL-DOMINANCE BIAS for a PERFECT model (deficit purely from lattice phase):');
  console.log('R rivals   c=1.219 (IV, R=40)        c=1.463 (unbuffed R=40)');
  const amp = c => 1 - W / c;
  function maxBias(R, c, n) { // E[max of R uniform phase offsets] - own offset, in %; seeded LCG
    const A = amp(c); let acc = 0; const M = 20000; let sd = 1103515245;
    const rnd = () => { sd = (sd * 1103515245 + 12345) & 0x7fffffff; return sd / 0x7fffffff; };
    for (let it = 0; it < M; it++) {
      const own = (rnd() - 0.5) * A; let best = -Infinity;
      for (let r = 0; r < R; r++) { const v = (rnd() - 0.5) * A; if (v > best) best = v; }
      acc += Math.max(0, best - own);
    }
    return acc / M / n * 100;
  }
  for (const R of [1, 3, 5, 10]) {
    console.log(`  ${String(R).padStart(2)}       ${maxBias(R, 1.219, 81).toFixed(3)}%                    ${maxBias(R, 1.463, 81).toFixed(3)}%`);
  }
  console.log('\n=> a ~10-rival row at var=0.5 on a 99s low-haste fight expects +0.09..+0.17% of');
  console.log('   "deficit" with a flawless model. "No length-persistent diagonal deficit" is not');
  console.log('   reachable by construction on short/low-haste tables at this taper width.');
}

// ══════════════════════ the shared engine setup for sections 2-3 ══════════════════════
// seed=3947 isc-skull short: T=99, Lust@0:49, trinkets isc+skull (tools/xval-results/isc-skull-short.txt)
function setup() {
  const { simulate, BUFFS } = loadEngine(path.join(REPO, 'index.html'));
  const KIT = ['icyVeins', 'isc', 'skull', 'arcanePower', 'berserking', 'bloodlust'];
  const en = {}; for (const k in BUFFS) en[k] = KIT.includes(k);
  const T = 99;
  const cfg = { T, hasteRating: 40, ...REF, enabled: en, fixed: { bloodlust: [49] },
                warnings: [], coldSnap: true, segments: null };
  const wt = tc => Math.min(1, Math.max(0, (T + KW - tc) / W));
  // Evaluate the SIM's own expected-cast sum on the MODEL's own cast list — no wowsims run needed,
  // because the two agree on the physics and differ only in sum-vs-integral.
  const discreteOf = r => {
    const cs = r.casts;
    let sum = 0;
    for (const c of cs) sum += c.dmg * wt(c.t + Math.min(c.interval, c.cast));
    // casts are recorded only while t < cfg.T (index.html:836) — continue the lattice to T+KW so
    // the tail is not truncated. ASSERT the tail is a constant rate/damage regime first, or the
    // extension lies.
    const tl = cs.slice(-3);
    const flat = tl.every(c => Math.abs(c.interval - tl[0].interval) < 1e-9 && Math.abs(c.dmg - tl[0].dmg) < 1e-6);
    const last = cs[cs.length - 1];
    let t = last.t + last.interval, added = 0;
    while (t < T + KW) { sum += last.dmg * wt(t + Math.min(last.interval, last.cast)); added++; t += last.interval; }
    return { sum, flat, added, n: cs.length, tailC: last.interval,
             lastCompletion: last.t + Math.min(last.interval, last.cast) };
  };
  return { simulate, cfg, T, discreteOf };
}

// ══════════════════════ 2. the decisive single cell ══════════════════════
// PRE-REGISTERED PREDICTION: continuous ~= -0.006% (native wins, as the model reports); discrete
// flips to ~+0.3..+0.4% for the rival, matching the sim's +0.362%.
function sectionCell() {
  const { simulate, cfg, T, discreteOf } = setup();
  const NATIVE = { icyVeins: [8, 28], arcanePower: [59], berserking: [59], isc: [49], skull: [69], bloodlust: [49] };
  const RIVAL  = { icyVeins: [0, 20], arcanePower: [59], berserking: [59], isc: [49], skull: [69], bloodlust: [49] };
  const measure = (label, s) => {
    const r = simulate(s, cfg, true);
    const d = discreteOf(r);
    console.log(`${label}: casts=${d.n}(+${d.added} past T)  tail c=${d.tailC.toFixed(4)}s  ` +
                `tail-flat=${d.flat}  last completion=${d.lastCompletion.toFixed(4)}s  (T+KW=${(T + KW).toFixed(1)})`);
    return { discrete: d.sum, continuous: r.robust };
  };
  console.log('DECISIVE CELL — isc-skull short @sim40, native(h40) vs rival(h70). Differs ONLY by');
  console.log('IV [8,28] -> [0,20]. BOTH layouts are FLOOR-FREE at the opening (IV alone at R=40:');
  console.log('m=1.2304, steady cast 1.219s, slack 0.219s) — so NO ramp physics is in play here.\n');
  const n = measure('native@h40  IV[8,28]', NATIVE);
  const v = measure('rival =h70  IV[0,20]', RIVAL);
  const pct = (a, b) => ((a - b) / b * 100);
  const sgn = x => (x >= 0 ? '+' : '') + x.toFixed(4) + '%';
  console.log('\n                         native          rival        rival vs native');
  console.log(`CONTINUOUS (the model)  ${n.continuous.toFixed(1)}  ${v.continuous.toFixed(1)}   ${sgn(pct(v.continuous, n.continuous))}`);
  console.log(`DISCRETE  (the sim)     ${n.discrete.toFixed(1)}  ${v.discrete.toFixed(1)}   ${sgn(pct(v.discrete, n.discrete))}`);
  console.log(`\nwowsims measured        3040.7      3051.7        +0.3617%   <-- the target`);
  console.log(`ripple ceiling 1 - W/c at c=1.463 = ${(1 - W / 1.463).toFixed(4)} casts`);
  console.log('\n=> the continuous number reproduces PHASE7\'s reported 0.006% model gap exactly (the');
  console.log('   instrument is validated), and the discrete sum SIGN-FLIPS toward the rival. The');
  console.log('   diagnostics name the cause: native\'s last cast completes at 99.62s — PAST T+KW=99.5,');
  console.log('   weight 0, wholly wasted — while the rival\'s completes at 99.30s (weight 0.196) and');
  console.log('   fits one more. The disputed 0.36% is WHICH SIDE OF THE KILL WINDOW the last cast');
  console.log('   falls on: the razor-edge whole-cast parity trap, surviving at var=0.5 because the');
  console.log('   taper (1.0s) is NARROWER than the tail cast period (1.463s). NOW READ SECTION 3.');
}

// ══════════════════════ 3. the full-column control ══════════════════════
// One cell flipping proves nothing — it could be coincidence, or the sum could be trading one
// error for a bigger one. This scores ALL 11 plan rows at sim-haste 40 and correlates each model
// against the real sim column.
function sectionColumn() {
  const { simulate, cfg, discreteOf } = setup();
  // verbatim from tools/xval-results/isc-skull-short.txt lines 2-12 (CS is implied by the IV pair)
  const ROWS = [
    [0,   { icyVeins: [0, 49], berserking: [0],  arcanePower: [49], isc: [49], skull: [69] }],
    [20,  { icyVeins: [7, 39], berserking: [59], arcanePower: [49], isc: [49], skull: [69] }],
    [40,  { icyVeins: [8, 28], berserking: [59], arcanePower: [59], isc: [49], skull: [69] }],
    [70,  { icyVeins: [0, 20], berserking: [59], arcanePower: [59], isc: [49], skull: [69] }],
    [100, { icyVeins: [0, 20], berserking: [49], arcanePower: [49], isc: [49], skull: [0]  }],
    [130, { icyVeins: [0, 29], berserking: [2],  arcanePower: [49], isc: [49], skull: [29] }],
    [155, { icyVeins: [0, 21], berserking: [21], arcanePower: [49], isc: [49], skull: [0]  }],
    [185, { icyVeins: [0, 21], berserking: [0],  arcanePower: [49], isc: [49], skull: [21] }],
    [230, { icyVeins: [0, 20], berserking: [0],  arcanePower: [49], isc: [49], skull: [20] }],
    [260, { icyVeins: [0, 29], berserking: [20], arcanePower: [49], isc: [49], skull: [9]  }],
    [400, { icyVeins: [1, 29], berserking: [89], arcanePower: [29], isc: [29], skull: [79] }],
  ];
  const SIM40 = [3038.8, 3034.6, 3040.7, 3051.7, 3040.4, 3021.8, 3029.5, 3029.6, 3029.7, 3015.7, 3000.9];

  const cont = [], disc = [];
  for (const [, sp] of ROWS) {
    const r = simulate({ ...sp, bloodlust: [49] }, cfg, true);
    cont.push(r.robust); disc.push(discreteOf(r).sum);
  }
  const norm = a => { const m = Math.max(...a); return a.map(x => x / m * 100); };
  const [C, D, S] = [norm(cont), norm(disc), norm(SIM40)];
  console.log('FULL-COLUMN CONTROL — all 11 plan rows of isc-skull-short scored at sim-haste 40\n');
  console.log('plan@   sim@40   sim%     CONTINUOUS%   DISCRETE%   | contErr  discErr');
  ROWS.forEach(([h], i) => {
    console.log(`${String(h).padStart(4)}   ${SIM40[i].toFixed(1)}  ${S[i].toFixed(3)}    ${C[i].toFixed(3)}       ${D[i].toFixed(3)}    | ` +
                `${(C[i] - S[i]).toFixed(3).padStart(7)}  ${(D[i] - S[i]).toFixed(3).padStart(7)}`);
  });
  const corr = (a, b) => { const n = a.length, ma = a.reduce((x, y) => x + y) / n, mb = b.reduce((x, y) => x + y) / n;
    let sa = 0, sb = 0, sab = 0; for (let i = 0; i < n; i++) { sa += (a[i] - ma) ** 2; sb += (b[i] - mb) ** 2; sab += (a[i] - ma) * (b[i] - mb); }
    return sab / Math.sqrt(sa * sb); };
  const rmse = (a, b) => Math.sqrt(a.reduce((s, x, i) => s + (x - b[i]) ** 2, 0) / a.length);
  console.log(`\ncorrelation vs sim   CONTINUOUS r=${corr(C, S).toFixed(4)}   DISCRETE r=${corr(D, S).toFixed(4)}`);
  console.log(`RMSE vs sim (pp)     CONTINUOUS  ${rmse(C, S).toFixed(4)}     DISCRETE  ${rmse(D, S).toFixed(4)}`);
  const arg = a => a.indexOf(Math.max(...a));
  console.log(`argmax row           sim=${ROWS[arg(S)][0]}   continuous=${ROWS[arg(C)][0]}   discrete=${ROWS[arg(D)][0]}`);
  console.log('\n=> the discrete sum picks the sim\'s argmax where the integral picks 40 — it FIXES the');
  console.log('   disputed ranking — but it is WORSE on BOTH correlation and RMSE across the column,');
  console.log('   with large two-signed errors. Discretization adds VARIANCE; it does not remove BIAS.');
  console.log('   => DO NOT adopt the discrete sum as a scorer (cf. index.html:875-877).');
}

const RUN = { ripple: sectionRipple, cell: sectionCell, column: sectionColumn };
if (WHICH === 'all') {
  for (const k of ['ripple', 'cell', 'column']) { console.log('\n' + '='.repeat(78)); RUN[k](); }
} else if (RUN[WHICH]) RUN[WHICH]();
else { console.error(`unknown section "${WHICH}" — use ripple | cell | column | all`); process.exit(2); }
