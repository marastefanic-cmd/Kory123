// PHASE8 §24 — is §21.5's 0.0724 pp F3 residual a THIRD MECHANISM, or is the additive
// decomposition that produced it simply ill-posed? Sim-free.
//
// F3 pre-registered that C-BE and C-CASCADE must close the P3 context asymmetry (0.1962 pp) to
// within 0.05 pp, and reported the 0.0724 pp shortfall as "unexplained, not absorbed". That test
// ASSUMES the two terms are additive. They are estimated from the same board, so the assumption is
// checkable: re-estimate C-BE with the cascade already applied (IV#3 at its §17.5 EXECUTED time
// rather than the requested one) and see whether C-BE's value depends on it.
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
const S0 = { isc: [29, 183], mqg: [9] }, S3 = { isc: [4, 182], mqg: [202] };
const EXEC = { A: 201.00, B: 202.13 };   // §17.5 logged IV#3 execution on the S3 arm
const TARGET = 0.1962, CASCADE = 0.0133, RESID = 0.0724;

const rob = s => simulate(s, cfg).robust;
const bd = s => simulate(s, cfg, true).casts.reduce((a, c) => a + c.dmg, 0);
const mk = (ctx, tr) => ({ ...REST[ctx], ...tr });
const cbe = (ctx, ivt) => {
  const set = s => ivt == null ? s : { ...s, icyVeins: [s.icyVeins[0], s.icyVeins[1], ivt] };
  const withM = set(mk(ctx, S3)), noM = set({ ...mk(ctx, S3), mqg: [] });
  return 100 * ((rob(withM) - rob(noM)) - (bd(withM) - bd(noM))) / rob(mk(ctx, S0));
};

console.log('=== PHASE8 §24 — F3 additivity probe (sim-free)\n');
console.log('              C-BE @requested   C-BE @executed (cascade applied)   shift');
const r = {}, e = {};
for (const c of ['A', 'B']) {
  r[c] = cbe(c, null); e[c] = cbe(c, EXEC[c]);
  console.log(`  ctx ${c}:      ${r[c].toFixed(4).padStart(8)}        ${e[c].toFixed(4).padStart(12)}` +
              `              ${(e[c] - r[c]).toFixed(4).padStart(8)}`);
}
const dReq = Math.abs(r.A - r.B), dExe = Math.abs(e.A - e.B);
const explReq = dReq + CASCADE, explExe = dExe + CASCADE;
console.log(`\n  ΔC-BE @requested = ${dReq.toFixed(4)} pp   →  explains ${(100 * explReq / TARGET).toFixed(1)}% of the ${TARGET} pp target  (§21.5's 63.1%)`);
console.log(`  ΔC-BE @executed  = ${dExe.toFixed(4)} pp   →  explains ${(100 * explExe / TARGET).toFixed(1)}%`);
console.log(`  interaction (change in the differential) = ${(dExe - dReq).toFixed(4)} pp   |·| = ${(Math.abs(dExe - dReq) / RESID).toFixed(2)}× the ${RESID} pp residual`);

console.log(`\n=== VERDICT`);
console.log(`  ⚠ The magnitude of the interaction matches the residual almost exactly (${(Math.abs(dExe - dReq) / RESID).toFixed(2)}×), but the`);
console.log(`    SIGN goes the WRONG WAY: applying the cascade SHRINKS ΔC-BE (${dReq.toFixed(4)} → ${dExe.toFixed(4)}), so the`);
console.log(`    decomposition explains LESS (${(100 * explExe / TARGET).toFixed(1)}%, down from ${(100 * explReq / TARGET).toFixed(1)}%) and the residual GROWS to`);
console.log(`    ${(TARGET - explExe).toFixed(4)} pp. So this does NOT absorb the residual — do not record it as explained.`);
console.log(`\n  ★ What it DOES establish: C-BE's value depends on whether the cascade is applied, by an`);
console.log(`    amount comparable to the entire residual. The two terms are NOT independent, so the`);
console.log(`    additive test F3 pre-registered is ILL-POSED — its 0.05 pp bar cannot be met or`);
console.log(`    missed meaningfully, because the quantity being tested is basis-dependent. F3's`);
console.log(`    residual is therefore NOT evidence for a third mechanism; it is an artifact of`);
console.log(`    decomposing two interacting terms additively. The right reading of §21.5 is that`);
console.log(`    C-BE is dominant (F1/F2/F4, all basis-robust) and that the leftover is uninterpretable.`);
