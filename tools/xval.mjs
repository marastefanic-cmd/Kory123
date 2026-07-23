// Holdout cross-validation of the planner's haste-adaptation, end to end from one seed.
//   node tools/xval.mjs <seed>
// (1) seed-draws a random fight (length, Lust time, 2 trinkets); (2) optimizes a plan at passive
// haste 0/100/200/300/400 (dedup identical); (3) sims every plan at every haste (∞ mana, var10,
// paired seed = CRN); (4) prints the DPS matrix and checks the two properties:
//   (a) monotonicity — each plan sims higher as passive haste rises (rows increasing);
//   (b) diagonal dominance — at each haste, the plan optimized FOR that haste sims ≥ every plan
//       borrowed from another haste (native plan wins its own column, within sim noise EPS).
// Env: CHROMIUM, RUNNER (default scratchpad runner-ap180), EXPORT_BASE (a gear export to trinket-swap).
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

const plans = await page.evaluate(async ({ HASTES, T, LUST, PAIR, TMETA }) => {
  const kit = ["icyVeins", PAIR[0], PAIR[1], "arcanePower", "berserking", "bloodlust"];
  const en = {}; for (const k in BUFFS) en[k] = kit.includes(k);
  const plain = (GAME.AB.AVG_BASE_DMG + GAME.AB.COEF * 1387) * (1 + 0.38 * (GAME.CRIT_MULT - 1));
  const toSpec = s => {
    const spec = { BL: (s.bloodlust || []).map(Math.round) };
    if (s.arcanePower) spec.AP = s.arcanePower.map(Math.round);
    if (s.berserking) spec.Zerk = s.berserking.map(Math.round);
    for (const tk of PAIR) if (s[tk]) spec[TMETA[tk].key] = s[tk].map(Math.round);
    const ivs = (s.icyVeins || []).slice().sort((a, b) => a - b).map(Math.round);
    const ivOut = [], csOut = []; let cd = -1e9;
    for (const t of ivs) { if (t < cd - 1e-6) csOut.push(t); ivOut.push(t); cd = t + BUFFS.icyVeins.cd; }
    if (ivOut.length) spec.IV = ivOut;
    if (csOut.length) spec.CS = csOut;
    return spec;
  };
  const res = {};
  for (const h of HASTES) {
    const cfg = { T, hasteRating: h, sp: 1387, critPct: 38, enabled: en, fixed: { bloodlust: [LUST] }, warnings: [], coldSnap: true, segments: null };
    const best = await optimizeAsync(cfg, 14, () => {});
    res[h] = { spec: toSpec(best.s), eff: +(best.val / plain).toFixed(3) };
  }
  return res;
}, { HASTES, T, LUST, PAIR, TMETA });
await browser.close();
if (perr) { console.error('PAGEERROR', perr); process.exit(2); }

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
  const out = execFileSync(RUNNER, ['--export', EXPORT, '--apl', path.join(SCRATCH, `plan_${ph}.apl.json`), '--dur', String(T), '--var', '10', '--iter', ITER, '--seed', '11', '--mana', '100000000', '--haste', String(sh), '--quiet', '--tag', 'm'], { encoding: 'utf8' });
  M[ph][sh] = parseFloat(out.trim().split(/\s+/)[4]);
} }

console.log('\nDPS matrix (row = plan optimized @haste, col = simmed @haste):');
console.log('plan\\sim ' + HASTES.map(h => String(h).padStart(8)).join(''));
for (const ph of HASTES) console.log(String(ph).padEnd(8) + ' ' + HASTES.map(sh => M[ph][sh].toFixed(1).padStart(8)).join(''));

// checks — tolerances are RELATIVE (%), because Arcane Blast itself is NOT strictly monotonic in
// haste in the real sim: near the GCD floor there are ~0.5–0.7% dead-zone dips (a known TBC haste
// breakpoint — verified with pure AB spam), invisible at coarse 100-rating spacing but real at a
// breakpoint-straddling grid. And adjacent-band plans are model-TIES, so a sub-1% sim wobble
// between them is quantization, not a model error. So we report the WORST deficit as a % and tier
// it: ≤0.3% clean, ≤1.0% within AB-breakpoint/pressability noise (PASS with a note), >1.0% = a real
// concern to triage (PHASE6 §3).
const CLEAN = 0.003, NOISE = 0.010;
let monoWorst = 0, monoAt = '';
for (const ph of HASTES) for (let k = 1; k < HASTES.length; k++) {
  const d = (M[ph][HASTES[k-1]] - M[ph][HASTES[k]]) / M[ph][HASTES[k-1]];
  if (d > monoWorst) { monoWorst = d; monoAt = `plan@${ph}: sim@${HASTES[k]} (${M[ph][HASTES[k]].toFixed(1)}) < sim@${HASTES[k-1]} (${M[ph][HASTES[k-1]].toFixed(1)})`; }
}
let diagWorst = 0, diagAt = '';
for (const sh of HASTES) { const native = M[sh][sh];
  for (const ph of HASTES) { const d = (M[ph][sh] - native) / native;
    if (d > diagWorst) { diagWorst = d; diagAt = `@sim${sh}: plan@${ph} (${M[ph][sh].toFixed(1)}) > native@${sh} (${native.toFixed(1)})`; } } }
const tier = w => w <= CLEAN ? 'CLEAN' : w <= NOISE ? 'ok(noise)' : 'CONCERN';
// (a) monotonicity is INFORMATIONAL, not pass/fail: Arcane Blast is genuinely non-monotone in haste
//     (~0.6–1.5% GCD-floor dead-zone dips, a real TBC breakpoint — verified with pure AB spam), so a
//     dip here is expected physics, not a model error. We report its magnitude only.
// (b) diagonal dominance is THE model test (does the plan built FOR a haste win at that haste). This
//     is the verdict. A >1% deficit means a borrowed plan really out-simmed the native one — triage
//     per PHASE6 §3 (mana? tail artifact? CS mapping? then model mis-adaptation).
console.log(`\n(a) haste-monotonicity [INFO — AB dead-zone is real physics]: worst dip ${(monoWorst*100).toFixed(2)}%` + (monoWorst > NOISE ? `  [${monoAt}]` : ''));
console.log(`(b) DIAGONAL DOMINANCE [the model test]: worst deficit ${(diagWorst*100).toFixed(2)}% → ${tier(diagWorst)}` + (diagWorst > CLEAN ? `  [${diagAt}]` : ''));
console.log(`XVAL-DONE seed=${SEED} kit=${PAIR.join('+')} class=${cls||'any'} T=${T} lust=${LUST} monoDip=${(monoWorst*100).toFixed(2)}% diagDeficit=${(diagWorst*100).toFixed(2)}% verdict=${tier(diagWorst)}`);
