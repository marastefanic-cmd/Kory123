// PHASE8 §21 — ROUND 10: decompose P3's context asymmetry into C-BE vs C-CASCADE. No sims.
// Everything reads the LANDED engine via engine-node; the executed IV#3 fire times come from
// §17.5's logged table (AS*/BS* logs, transcribed there and quoted in PHASE8.md).
import { loadEngine } from '/home/user/Kory123/tools/engine-node.mjs';

const api = loadEngine('/home/user/Kory123/index.html');
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
  // per-cast damage local to the window: price the realized casts by re-simulating with the cast
  // count difference valued at the model's own board — cleanest: quantized credit = dCasts × the
  // damage of the marginal (last) cast in the with-MQG stream before T.
  const casts = simulate(withM, cfg, true).casts;
  const last = casts[casts.length - 1];
  const perCast = last.dmg !== undefined ? last.dmg : null;
  console.log(`ctx ${ctx}: dModel=${dModel.toFixed(2)} (${pp(ctx, dModel).toFixed(4)} pp) ` +
              `dCasts=${dCasts} lastCastKeys=${JSON.stringify(Object.keys(last))}`);
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
const tot = s => simulate(s, cfg).total;
for (const ctx of ['A', 'B']) {
  const withM = mk(ctx, S3), noM = { ...mk(ctx, S3), mqg: [] };
  const dTot = tot(withM) - tot(noM);
  const dQuant = boardDmg(withM) - boardDmg(noM);
  console.log(`ctx ${ctx}: dTotal=${pp(ctx, dTot).toFixed(4)} pp  dQuant=${pp(ctx, dQuant).toFixed(4)} pp  C-BE(total)=${pp(ctx, dTot - (dQuant)).toFixed(4)} pp`);
}
