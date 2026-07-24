// Holdout cross-validation of the planner's haste-adaptation, end to end from one seed.
//   node tools/xval.mjs <seed>
// (1) seed-draws a random fight (length by TCLASS, Lust time, 2 trinkets — or KIT/BOSS overrides);
// (2) optimizes a plan at each passive haste in HASTES (the kit's breakpoint-straddle set — default
// the coarse 0/100/200/300/400 if unset; dedup identical); (3) sims every plan at every haste
// (COLD OPEN — _prestack:0, the model never prepulls; ∞ mana; var10; paired seed = CRN); (4) prints
// the DPS matrix and reports two readings:
//   (a) haste-monotonicity — a REGRESSION CANARY. With ∞ mana more haste never sims a fixed plan
//       worse, so every row must be non-decreasing; monoDip must be ~0.00% (cold open, PHASE6 §4.7).
//       A nonzero dip ⇒ a prepull crept back in or a new harness bug — stop and fix, don't gather.
//   (b) diagonal dominance — the model test. At each haste, does the plan optimized FOR that haste
//       sim ≥ every plan borrowed from another haste? CLEAN = native wins every column; DEFICIT X% =
//       a borrowed plan won somewhere. NO tolerance is applied — weigh a deficit by fight length
//       (short/medium sub-1% = plan-to-plan boundary quantization, unconfirmed; long/XL = real).
// Env: CHROMIUM, RUNNER (default scratchpad runner-ap180), EXPORT_BASE (a gear export to trinket-swap),
//      KIT=a,b, TCLASS=short|…|xl, HASTES=…, BOSS="Lady Vashj"|…, ITER, SCRATCH.
import { createRequire } from 'module';
import { execFileSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const { chromium } = createRequire(path.join(REPO, 'tests', 'package.json'))('playwright-core');
const SEED = parseInt(process.argv[2] || '1', 10) >>> 0;
const SCRATCH = process.env.SCRATCH || '/tmp/xval-' + SEED;
fs.mkdirSync(SCRATCH, { recursive: true });
const RUNNER = process.env.RUNNER;
const EXPORT_BASE = process.env.EXPORT_BASE;
if (!RUNNER || !EXPORT_BASE) { console.error('set RUNNER=/path/to/runner-ap180 EXPORT_BASE=/path/to/export.json'); process.exit(1); }
const ITER = process.env.ITER || '10000';
const VAR = process.env.VAR || '10';   // kill-time variation (s); the metric decision lives in ACCEPTANCE


// ── seeded draw (mulberry32) ──
let s = SEED;
const rnd = () => { s |= 0; s = (s + 0x6D2B79F5) | 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
// fight-length CLASSES by cooldown-use count (2-min = skull/scb/isc, 3-min = IV/AP/Zerk, 5-min = mqg;
// CS→IV grants IV +1 in each). Ranges chosen so each class cleanly hits its use counts.
const TCLASS = { short: [75, 115], medium: [150, 195], medlong: [205, 255], long: [265, 375], xl: [385, 460] };
const cls = process.env.TCLASS;
const [tlo, thi] = cls && TCLASS[cls] ? TCLASS[cls] : [90, 420];
const T = tlo + Math.floor(rnd() * (thi - tlo + 1));
const LUST = Math.floor(rnd() * Math.max(1, T - 40));
const TRK = ["isc", "scb", "skull", "mqg"];
let PAIR;
if (process.env.KIT) { PAIR = process.env.KIT.split(','); }        // explicit kit (campaign mode)
else { const i = Math.floor(rnd() * 4); let j = Math.floor(rnd() * 3); if (j >= i) j++; PAIR = [TRK[i], TRK[j]]; }
const HASTES = process.env.HASTES ? process.env.HASTES.split(',').map(Number) : [0, 100, 200, 300, 400];
const fmtT = x => `${Math.floor(x/60)}:${String(x%60).padStart(2,'0')}`;
console.log(`seed=${SEED}  class=${cls||'any'}  fight=${fmtT(T)} (${T}s)  Lust@${fmtT(LUST)}  trinkets=${PAIR.join('+')}  haste=[${HASTES.join(',')}]`);

// trinket → {itemId, genapl key}
// item = the EQUIPPABLE item that provides the on-use (goes in a trinket slot); key = the genapl
// action that FIRES it. scb is the subtle one: the equipped item is Serpent-Coil Braid (30720, a
// trinket), but its +225 SP "Mana Surge" is granted by CASTING a Mana Emerald (itemId 22044, what
// genapl's "Gem" fires) while SCB is worn — so equip 30720, fire 22044.
const TMETA = { isc: { item: 29370, key: 'Icon' }, scb: { item: 30720, key: 'Gem' }, skull: { item: 32483, key: 'Skull' }, mqg: { item: 19339, key: 'MQG' } };
// build the trinket-swapped export
const exp = JSON.parse(fs.readFileSync(EXPORT_BASE, 'utf8'));
exp.player.equipment.items[12] = { id: TMETA[PAIR[0]].item };
exp.player.equipment.items[13] = { id: TMETA[PAIR[1]].item };
const EXPORT = path.join(SCRATCH, 'export.json');
fs.writeFileSync(EXPORT, JSON.stringify(exp));

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM || '/opt/pw-browsers/chromium' });
const page = await browser.newPage();
let perr = null; page.on('pageerror', e => (perr = String(e)));
await page.goto('file://' + path.join(REPO, 'index.html'));

// BOSS mode: override the random fight with a boss preset's shape (T, Lust, phases). The kit stays
// the drawn/KIT pair (we test each kit ON the boss's fight shape). Intermission phases sim cleanly
// (genapl _intermissions = AB off during downtime). AoE phases are VALUED (PHASE7 §3c): genapl
// `_aoe` windows cast Arcane Explosion (27082), and the runner gets `--targets N` (the extra
// dummies are inert outside the window — AB is single-target — so only the AE window is worth ×N,
// exactly the model's M(N) physics, RULES §9). The old "simmed as downtime" KT caveat is CLOSED.
const out0 = await page.evaluate(async ({ HASTES, T, LUST, PAIR, TMETA, BOSS }) => {
  let segments = null, downtime = [], aoeWins = [], aoeTargets = 0, fightT = T, lust = LUST;
  if (BOSS) {
    const p = (window.BOSS_PRESETS || []).find(x => x.name === BOSS || x.name.toLowerCase().includes(BOSS.toLowerCase()));
    if (!p) throw new Error('boss preset not found: ' + BOSS);
    fightT = p.T; lust = (p.pins && p.pins.bloodlust && p.pins.bloodlust[0]) || 0;
    const rows = (p.phases || []).map(ph => ({ from: ph.from, to: ph.to, type: ph.type, mult: ph.mult || 1, targets: ph.targets || 0 }));
    segments = rows.length ? buildSegments(rows, fightT) : null;
    for (const ph of (p.phases || [])) {
      if (ph.type === 'intermission') downtime.push([ph.from, ph.to]);
      if (ph.type === 'aoe') { aoeWins.push([ph.from, ph.to]); aoeTargets = Math.max(aoeTargets, ph.targets || 0); }
    }
  }
  const kit = ["icyVeins", PAIR[0], PAIR[1], "arcanePower", "berserking", "bloodlust"];
  const en = {}; for (const k in BUFFS) en[k] = kit.includes(k);
  const plain = (GAME.AB.AVG_BASE_DMG + GAME.AB.COEF * 1387) * (1 + 0.38 * (GAME.CRIT_MULT - 1));
  const toSpec = s => {
    const spec = { _prestack: 0, BL: (s.bloodlust || []).map(Math.round) }; // COLD OPEN — the model never prepulls (genapl header ★; PHASE6 §4.7). NEVER change to >0.
    if (s.arcanePower) spec.AP = s.arcanePower.map(Math.round);
    if (s.berserking) spec.Zerk = s.berserking.map(Math.round);
    for (const tk of PAIR) if (s[tk]) spec[TMETA[tk].key] = s[tk].map(Math.round);
    const ivs = (s.icyVeins || []).slice().sort((a, b) => a - b).map(Math.round);
    const ivOut = [], csOut = []; let cd = -1e9;
    for (const t of ivs) { if (t < cd - 1e-6) csOut.push(t); ivOut.push(t); cd = t + BUFFS.icyVeins.cd; }
    if (ivOut.length) spec.IV = ivOut;
    if (csOut.length) spec.CS = csOut;
    if (downtime.length) spec._intermissions = downtime; // AB off during intermissions
    if (aoeWins.length) spec._aoe = aoeWins;             // Arcane Explosion during AoE windows
    return spec;
  };
  const res = {};
  for (const h of HASTES) {
    const cfg = { T: fightT, hasteRating: h, sp: 1387, critPct: 38, enabled: en, fixed: { bloodlust: [lust] }, warnings: [], coldSnap: true, segments };
    const best = await optimizeAsync(cfg, 14, () => {});
    res[h] = { spec: toSpec(best.s), eff: +(best.val / plain).toFixed(3) };
  }
  return { res, fightT, lust, aoeTargets };
}, { HASTES, T, LUST, PAIR, TMETA, BOSS: process.env.BOSS || null });
await browser.close();
if (perr) { console.error('PAGEERROR', perr); process.exit(2); }
const plans = out0.res;
const FIGHT_T = out0.fightT;   // boss overrides T for the sim/labels below
if (process.env.BOSS) console.log(`  BOSS=${process.env.BOSS}  T=${FIGHT_T}  Lust@${out0.lust}${out0.aoeTargets ? `  AoE phase VALUED: AE windows ×${out0.aoeTargets} targets (--targets)` : ''}`);

for (const h of HASTES) console.log(`  plan@h${h}: eff=${plans[h].eff}  ${JSON.stringify(plans[h].spec)}`);
// dedupe by spec signature
const sig = sp => JSON.stringify(Object.keys(sp).sort().reduce((o,k)=>(o[k]=sp[k],o),{}));
const uniq = {}; for (const h of HASTES) uniq[sig(plans[h].spec)] = h; // rep haste per unique plan
console.log(`unique plans: ${Object.keys(uniq).length}/${HASTES.length}`);

// sim matrix
for (const h of HASTES) {
  const p = path.join(SCRATCH, `plan_${h}.apl.json`);
  execFileSync('node', [path.join(REPO, 'tools/genapl.mjs'), JSON.stringify(plans[h].spec), p]);
}
const M = {};
for (const ph of HASTES) { M[ph] = {}; for (const sh of HASTES) {
  const args = ['--export', EXPORT, '--apl', path.join(SCRATCH, `plan_${ph}.apl.json`), '--dur', String(FIGHT_T), '--var', VAR, '--iter', ITER, '--seed', '11', '--mana', '100000000', '--haste', String(sh), '--quiet', '--tag', 'm'];
  if (out0.aoeTargets) args.push('--targets', String(out0.aoeTargets));
  const out = execFileSync(RUNNER, args, { encoding: 'utf8' });
  M[ph][sh] = parseFloat(out.trim().split(/\s+/)[4]);
} }

console.log('\nDPS matrix (row = plan optimized @haste, col = simmed @haste):');
console.log('plan\\sim ' + HASTES.map(h => String(h).padStart(8)).join(''));
for (const ph of HASTES) console.log(String(ph).padEnd(8) + ' ' + HASTES.map(sh => M[ph][sh].toFixed(1).padStart(8)).join(''));

// DATA-GATHERING pass — report raw observations, draw NO conclusions:
// (a) haste-monotonicity: the worst "more haste sims LOWER" dip across any fixed plan's row.
//     REGRESSION CANARY — must be ~0 since the cold-open fix (PHASE6 §4.7 RESOLVED); a nonzero dip
//     means a prepull crept back in or a new harness bug. Reported raw; do not soften.
// (b) diagonal dominance: did ANY borrowed plan out-sim the native plan in its own column?
//     CLEAN = no (native is the max in every column). DEFICIT = yes, by diagWorst% at the named cell.
//     No tolerance applied — a deficit is a deficit; what (if anything) to do about it is NEXT pass.
let monoWorst = 0, monoAt = '';
for (const ph of HASTES) for (let k = 1; k < HASTES.length; k++) {
  const d = (M[ph][HASTES[k-1]] - M[ph][HASTES[k]]) / M[ph][HASTES[k-1]];
  if (d > monoWorst) { monoWorst = d; monoAt = `plan@${ph}: sim@${HASTES[k]} (${M[ph][HASTES[k]].toFixed(1)}) < sim@${HASTES[k-1]} (${M[ph][HASTES[k-1]].toFixed(1)})`; }
}
let diagWorst = 0, diagAt = '';
for (const sh of HASTES) { const native = M[sh][sh];
  for (const ph of HASTES) { const d = (M[ph][sh] - native) / native;
    if (d > diagWorst) { diagWorst = d; diagAt = `@sim${sh}: plan@${ph} (${M[ph][sh].toFixed(1)}) > native@${sh} (${native.toFixed(1)})`; } } }
const diagClean = diagWorst <= 1e-9;
console.log(`\n(a) haste-monotonicity [OBSERVED, not interpreted]: worst downward dip = ${(monoWorst*100).toFixed(2)}%` + (monoWorst > 0 ? `  [${monoAt}]` : ''));
console.log(`(b) DIAGONAL DOMINANCE: ${diagClean ? 'CLEAN — native dominates every column' : `DEFICIT ${(diagWorst*100).toFixed(2)}%  [${diagAt}]`}`);
console.log(`XVAL-DONE seed=${SEED} kit=${PAIR.join('+')} class=${process.env.BOSS ? 'BOSS:'+process.env.BOSS.replace(/[^A-Za-z]/g,'') : (cls||'any')} T=${FIGHT_T} lust=${out0.lust} monoDip=${(monoWorst*100).toFixed(2)}% diag=${diagClean ? 'CLEAN' : 'DEFICIT'} diagWorst=${(diagWorst*100).toFixed(2)}%`);
