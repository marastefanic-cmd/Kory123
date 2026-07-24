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
// Kill-time variation (s). 0.5 is the MODEL-MATCHED metric: the scorer's `robust` (KILL_WINDOW=0.5s
// linear taper) is exactly expected damage under a uniform kill in [T−0.5, T+0.5]. var10 asks a
// different question (±10s kill hedging the model deliberately does not price, RULES §8) and adds a
// late-window premium; var0 is the razor-edge whole-cast parity trap. See ACCEPTANCE (PHASE7 metric
// decision).
const VAR = process.env.VAR || '0.5';


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
  const wallList = [...downtime, ...aoeWins].map(w => w[0]).sort((a, b) => a - b);
  return { res, fightT, lust, aoeTargets, wallList };
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

// sim matrix. WALL-JITTER (boss tables with phases): within a wall-bounded segment the cast train
// is phase-locked to the exit (the re-ramp), so a plan realizes haste value only in WHOLE casts
// before the next wall — a deterministic per-segment cast-parity worth up to ~±½ cast/segment that
// no kill-variance can smooth (dug to ground on Vashj: per-interval the sim matches the model
// EXACTLY; only the whole-cast truncation at walls differs — the model's continuous credit is the
// correct expectation for real fights, whose transition times vary run to run). The wash must vary
// SEGMENT LENGTHS: each wall gets its OWN shift δ_i (seeded, deterministic), and each press shifts
// with the wall that starts its segment (the raid tracks the boss). A RIGID translation (one δ for
// everything — the first design) preserves every segment's internal parity and washes NOTHING.
// WJITTER=2 → 1 nominal + 2·WJ jitter variants with per-wall δ_i ∈ [−WJ, +WJ].
const WJ = (process.env.BOSS && (out0.wallList || []).length) ? +(process.env.WJITTER ?? 2) : 0;
const walls = out0.wallList || [];
const mulb = seed => () => { seed |= 0; seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const VARIANTS = [walls.map(() => 0)];
for (let v = 1; v <= 2 * WJ; v++) {
  const rnd = mulb(9000 + v);
  VARIANTS.push(walls.map(() => Math.round((rnd() * 2 - 1) * WJ)));
}
const shiftSpec = (spec, ds) => {
  if (!ds.some(d => d)) return spec;
  const s = JSON.parse(JSON.stringify(spec));
  const shiftOf = t => { let d = 0; for (let i = 0; i < walls.length; i++) if (t >= walls[i]) d = ds[i]; return d; };
  for (const k in s) {
    // a window's end that coincides with ANOTHER window's start (seam — e.g. KT downtime→AoE at
    // 105) must move with THAT window's shift, or the two would overlap/gap at the seam
    if (k === '_intermissions' || k === '_aoe') s[k] = s[k].map(([a, z]) => { const i = walls.indexOf(a); const j = walls.indexOf(z); return [a + (i >= 0 ? ds[i] : 0), z + (j >= 0 ? ds[j] : (i >= 0 ? ds[i] : 0))]; });
    else if (Array.isArray(s[k])) s[k] = s[k].map(t => t + shiftOf(t));
  }
  return s;
};
const M = {};
for (const ph of HASTES) { M[ph] = {}; for (const sh of HASTES) {
  let acc = 0;
  for (let vi = 0; vi < VARIANTS.length; vi++) {
    const p = path.join(SCRATCH, `plan_${ph}_v${vi}.apl.json`);
    execFileSync('node', [path.join(REPO, 'tools/genapl.mjs'), JSON.stringify(shiftSpec(plans[ph].spec, VARIANTS[vi])), p]);
    const args = ['--export', EXPORT, '--apl', p, '--dur', String(FIGHT_T), '--var', VAR, '--iter', ITER, '--seed', '11', '--mana', '100000000', '--haste', String(sh), '--quiet', '--tag', 'm'];
    if (out0.aoeTargets) args.push('--targets', String(out0.aoeTargets));
    const out = execFileSync(RUNNER, args, { encoding: 'utf8' });
    acc += parseFloat(out.trim().split(/\s+/)[4]);
  }
  M[ph][sh] = acc / VARIANTS.length;
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
// 1e-6 relative = far below the printed 0.1-DPS precision — suppresses float-average artifacts of
// the jittered mean, NOT a graded tolerance (a real deficit is orders of magnitude above it).
const diagClean = diagWorst <= 1e-6;
console.log(`\n(a) haste-monotonicity [OBSERVED, not interpreted]: worst downward dip = ${(monoWorst*100).toFixed(2)}%` + (monoWorst > 0 ? `  [${monoAt}]` : ''));
console.log(`(b) DIAGONAL DOMINANCE: ${diagClean ? 'CLEAN — native dominates every column' : `DEFICIT ${(diagWorst*100).toFixed(2)}%  [${diagAt}]`}`);
console.log(`XVAL-DONE seed=${SEED} kit=${PAIR.join('+')} class=${process.env.BOSS ? 'BOSS:'+process.env.BOSS.replace(/[^A-Za-z]/g,'') : (cls||'any')} T=${FIGHT_T} lust=${out0.lust} var=${VAR} wj=${WJ} monoDip=${(monoWorst*100).toFixed(2)}% diag=${diagClean ? 'CLEAN' : 'DEFICIT'} diagWorst=${(diagWorst*100).toFixed(2)}%`);
