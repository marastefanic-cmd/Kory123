// PHASE8 §21 — ROUND 10: decompose P3's context asymmetry into C-BE vs C-CASCADE. No sims.
// Everything reads the LANDED engine via engine-node; the executed IV#3 fire times come from
// §17.5's logged table (AS*/BS* logs, transcribed there and quoted in PHASE8.md).
import path from 'path';
import { fileURLToPath } from 'url';
import { loadEngine } from './engine-node.mjs';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const api = loadEngine(path.join(REPO, 'index.html'));
const { simulate, BUFFS } = api;

const kit = ['icyVeins', 'isc', 'mqg', 'arcanePower', 'berserking', 'bloodlust'];
const en = {}; for (const k in BUFFS) en[k] = kit.includes(k);
const cfg = { T: 229, hasteRating: 70, sp: 1450, critPct: 38, enabled: en,
              fixed: { bloodlust: [162] }, warnings: [], coldSnap: true, segments: null, t5two: true };
const REST = {
  A: { bloodlust: [162], arcanePower: [8, 188], berserking: [0, 188], icyVeins: [0, 20, 200] },
  B: { bloodlust: [162], arcanePower: [4, 192], berserking: [6, 192], icyVeins: [0, 20, 202] },
};
const mk = (ctx, trink) => ({ ...REST[ctx], isc: trink.isc, mqg: trink.mqg });
const S2 = { isc: [4, 182], mqg: [100] }, S3 = { isc: [4, 182], mqg: [202] };
const rob = s => simulate(s, cfg).robust;
const cc = s => simulate(s, cfg).castCount;

// §17.5 P3 Δresid targets (primary inputs), pp of the S0 baseline; asymmetry = the decomposition target
const P3 = { A: -0.2106, B: -0.4068 };
const TARGET = Math.abs(P3.A - P3.B); // 0.1962 pp

// Normalizer: pp are % of each context's S0-arm robust (the §17 convention: d = 100*(x/S0 - 1))
const S0 = { isc: [29, 183], mqg: [9] };
const base = { A: rob(mk('A', S0)), B: rob(mk('B', S0)) };
const pp = (ctx, d) => 100 * d / base[ctx];

console.log('=== C-BE: the model credit of MQG@202 vs its own discrete cast realization, per context');
// The model's price of the press = robust with vs without MQG's 2nd... MQG@202 is the ONLY use in S3.
// dModel = full model credit (continuous integral); dCasts = whole casts the discrete board actually
// gains by T. The continuous-minus-quantized remainder is the back-edge/runway over-credit for a
// haste window on an ANCHORED lattice (press at IV@202's own second → phase locked, no averaging).
for (const ctx of ['A', 'B']) {
  const withM = mk(ctx, S3), noM = { ...mk(ctx, S3), mqg: [] };
  const dModel = rob(withM) - rob(noM);
  const dCasts = cc(withM) - cc(noM);
  console.log(`ctx ${ctx}: dModel=${dModel.toFixed(2)} (${pp(ctx, dModel).toFixed(4)} pp) dCasts=${dCasts}`);
}

console.log('\n=== C-CASCADE: model-priced effect of the UNREQUESTED IV#3 slide (executed times, §17.5)');
// Executed IV#3 fire times (from the §17.5 combat-log table): requested IV#3 = 200 (A) / 202 (B).
const EXEC = { A: { S2: 202.00, S3: 201.00 }, B: { S2: 202.03, S3: 202.13 } };
for (const ctx of ['A', 'B']) {
  const req = REST[ctx].icyVeins[2];
  const s2req = mk(ctx, S2), s3req = mk(ctx, S3);
  const dReq = rob(s3req) - rob(s2req);                      // the model's P3 as measured (requested times)
  const ivAt = (s, t) => ({ ...s, icyVeins: [s.icyVeins[0], s.icyVeins[1], t] });
  const dExec = rob(ivAt(s3req, EXEC[ctx].S3)) - rob(ivAt(s2req, EXEC[ctx].S2)); // P3 as the sim EXECUTED it
  const casc = dExec - dReq;                                  // what the cascade injected into d_sim
  console.log(`ctx ${ctx}: IV#3 req=${req} exec S2=${EXEC[ctx].S2} S3=${EXEC[ctx].S3} ` +
              `dModelReq=${pp(ctx, dReq).toFixed(4)} pp dModelExec=${pp(ctx, dExec).toFixed(4)} pp ` +
              `C-CASCADE=${pp(ctx, casc).toFixed(4)} pp`);
}
console.log(`\nTARGET asymmetry = ${TARGET.toFixed(4)} pp   (P3 A=${P3.A} B=${P3.B})`);

console.log('\n=== C-BE proper: continuous credit minus board-realized credit (quantization over-credit)');
// ⚠ C-BE NO LONGER MEASURES QUANTIZATION. It was defined as CONTINUOUS credit (`robust`, then the
// rate integral) minus DISCRETE board damage, so the remainder was the integral's over-payment of a
// partial cast. Since PHASE12 §6.10 `robust` is itself the discrete per-cast sum, so both arms are
// now discrete and the only thing left between them is the BOUNDARY CREDIT: `dmg` below is each
// cast's FULL damage, while `robust` summed `dmg * frac`. `dModel - dQuant` is therefore
// −(the credit withheld at the cuts), not a quantization over-credit, and F2's "both must be > 0 =
// model over-credit" sign test is inverted with respect to its own hypothesis.
// ⇒ Read C-BE as an archived PHASE8 quantity. Do not re-derive a new claim from these two lines
//   without redefining them first. (Summing `c.credited` instead of `c.dmg` would make dQuant equal
//   dModel identically — a tautology, not a fix.)
const boardDmg = s => simulate(s, cfg, true).casts.reduce((a, c) => a + c.dmg, 0);
const res = {};
for (const ctx of ['A', 'B']) {
  const withM = mk(ctx, S3), noM = { ...mk(ctx, S3), mqg: [] };
  const dModel = rob(withM) - rob(noM);
  const dQuant = boardDmg(withM) - boardDmg(noM);
  const cbe = pp(ctx, dModel - dQuant);
  res[ctx] = { dModel: pp(ctx, dModel), dQuant: pp(ctx, dQuant), cbe };
  console.log(`ctx ${ctx}: dModel=${pp(ctx, dModel).toFixed(4)} pp  dQuant(board)=${pp(ctx, dQuant).toFixed(4)} pp  C-BE=${cbe.toFixed(4)} pp`);
}
const dCBE = Math.abs(res.A.cbe - res.B.cbe);
console.log(`\nΔC-BE = ${dCBE.toFixed(4)} pp  ·  ΔC-CASCADE = 0.0133 pp  ·  TARGET = ${TARGET.toFixed(4)} pp`);
console.log(`F1 completeness: (ΔC-BE + ΔC-CASC)/target = ${(100 * (dCBE + 0.0133) / TARGET).toFixed(1)}%`);
console.log(`F2 sign: C-BE(A)=${res.A.cbe.toFixed(4)} C-BE(B)=${res.B.cbe.toFixed(4)} (both must be > 0 = model over-credit)`);
console.log(`F4 levels: sim-vs-model gap A=0.2105 B=0.4068 — compare C-BE per context`);

console.log('\n=== F3 sensitivity: C-BE in the UNTAPERED currency (total, not robust) — is the residual the kill taper?');
// ⛔⛔ F3 IS NOW PERMANENTLY VACUOUS — NOT "sometimes degenerate at this T", ALWAYS, EVERYWHERE. ⛔⛔
//
// F3's whole design was to re-measure C-BE in a currency the kill taper does NOT touch (`total`, the
// hard cut at T) and see whether the residual survived. That required `total` and `robust` to be two
// different numbers. Since the boundary-credit rewrite (PHASE12 §9, user ruling 07-27) they are the
// SAME ACCUMULATOR: `KILL_WINDOW` and the symmetric taper are retired, one uniform credit rule
// `min(1, (nextCut - castStart)/castDuration)` applies at every cut, and simulate() returns
// `total === robust === totalEarly` by construction. All three are still returned so no caller
// crashes — which is precisely why this block must announce the degeneracy rather than infer from it.
//
// The old guard below tested `total !== robust` and reported VACUOUS "at this config". That reading
// is obsolete: there is no config, no T and no gear at which it can be non-degenerate again, so the
// conditional verdict would understate the problem. It is kept and still evaluated ONLY so that a
// future engine that genuinely re-separates the currencies is detected and says so out loud.
//
// ⇒ The 0.0724 pp residual F3 was built to explain remains UNEXPLAINED, and this instrument can no
//   longer be the thing that explains it. See PHASE8 §21.5 erratum.
const tot = s => simulate(s, cfg).total;
let degenerate = true;
for (const ctx of ['A', 'B']) {
  const withM = mk(ctx, S3), noM = { ...mk(ctx, S3), mqg: [] };
  const rW = simulate(withM, cfg), rN = simulate(noM, cfg);
  if (rW.total !== rW.robust || rN.total !== rN.robust) degenerate = false;
  const dTot = tot(withM) - tot(noM);
  const dQuant = boardDmg(withM) - boardDmg(noM);
  console.log(`ctx ${ctx}: dTotal=${pp(ctx, dTot).toFixed(4)} pp  dQuant=${pp(ctx, dQuant).toFixed(4)} pp  ` +
              `C-BE(total)=${pp(ctx, dTot - dQuant).toFixed(4)} pp  ` +
              `[total===robust? ${rW.total === rW.robust ? 'YES' : 'no'}]`);
}
console.log(degenerate
  ? '⛔ F3 IS VACUOUS — AND PERMANENTLY SO, not merely at this config.\n' +
    '  total ≡ robust bitwise on both arms, because since PHASE12 §9 the engine accumulates\n' +
    '  total, robust and totalEarly into ONE number (the credited per-cast sum). The symmetric\n' +
    '  kill taper this test was designed to exclude NO LONGER EXISTS to be excluded, so\n' +
    '  "identical in the untapered currency" is a tautology at every T, gear and haste — never\n' +
    '  evidence about the residual. F3 CANNOT BE RUN AGAINST THIS ENGINE. The 0.0724 pp residual\n' +
    '  remains wholly unexplained and needs a different instrument. See PHASE8 §21.5 erratum.'
  : '⚠ the currencies came back DIFFERENT — total !== robust. That contradicts PHASE12 §9, under which\n' +
    '  they are one accumulator. Either the engine re-separated them (then F3 discriminates again and\n' +
    '  this file needs its header revisited) or something is wrong. Do not use these numbers until you\n' +
    '  know which.');
