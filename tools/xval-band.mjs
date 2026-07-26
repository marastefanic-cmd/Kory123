// THE DEFICIT BAND — PHASE10 §5's grading rule, as a committed instrument.
//
//   node tools/xval-collect.mjs tools/xval-results --json /tmp/targets.json
//   node tools/xval-band.mjs /tmp/targets.json [--seeds 11,100011,200011] [--iter 6000] [--top N]
//
// ── WHAT IT DECIDES ───────────────────────────────────────────────────────────────────────────────
// A cross-val round reports a borrowed-win column from ONE seed. PHASE10 §5 pre-registers that
//
//     "a deficit counts as real only if it survives at >=3 seeds with |Δ| > 1σ of the paired band"
//
// and the gear-A corpus learned why the hard way: per-variant wall-jitter sd was **0.1427 pp** while
// seed sd was **0.0058 pp**, so a single reading looked ~25× more precise than it was. This re-runs
// each deficit column's two plans head to head at several widely-spaced seeds and reports the paired
// mean and sd, so a column can be graded instead of eyeballed.
//
// ── THE THREE THINGS IT MUST NOT GET WRONG ────────────────────────────────────────────────────────
// ★ 1. SEED SPACING. wowsims seeds PER ITERATION, so seeds closer together than `iterations` share
//   nearly all their draws and the "band" collapses toward zero — which passes every delta. That trap
//   has already been walked into twice here (BENCH §3c.3's +1.20 pp "reproduced across seeds 1/2/3",
//   and `plan-duel.mjs` defaulting to 11..15). Asserted below, not assumed.
// ★ 2. THE KIT. An on-use trinket only fires while its item is WORN, and wowsims does not complain
//   when it is not — the press is a bit-identical no-op (sim/planspec.mjs REQUIRES_EQUIPPED). Four of
//   the six kits name Skull or MQG, so a band computed on the default character would silently
//   compare two plans with their trinket presses deleted. The kit comes from the table's own
//   `XVAL-DONE kit=` field and the trinkets are equipped from it.
// ★ 3. WALL JITTER. A boss cell in the matrix is a **5-variant mean** (WJITTER=2), a class cell a
//   single un-jittered run — "the corpus is two instruments with different noise" (ACCEPTANCE). A band
//   that re-ran only the nominal geometry would be measuring a different quantity than the cell it is
//   grading, so the variants are reproduced here with the same seeds and the same shift rule.
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from './genapl-core.mjs';
import { buildRequest, dpsOf } from '../sim/simreq.mjs';
import { BENCH } from '../sim/benchmark.mjs';
import { REQUIRES_EQUIPPED, unequippedPresses } from '../sim/planspec.mjs';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const die = m => { console.error('ERROR: ' + m); process.exit(2); };
const argv = process.argv.slice(2);
const arg = (k, d) => { const i = argv.indexOf('--' + k); return i >= 0 && argv[i + 1] !== undefined ? argv[i + 1] : d; };

const FLAG_TAKES_VALUE = new Set(['--seeds', '--iter', '--top']);
const targetsPath = argv.find((a, i) => !a.startsWith('--') && !FLAG_TAKES_VALUE.has(argv[i - 1]));
if (!targetsPath || !fs.existsSync(targetsPath))
  die('need the targets JSON from `node tools/xval-collect.mjs <dir> --json <file>`');
const targets = JSON.parse(fs.readFileSync(targetsPath, 'utf8'));
if (!Array.isArray(targets)) die(`${targetsPath} is not the collector's target array.`);

// ⚠ CONFIGURATION IS VALIDATED BEFORE THE DATA IS LOOKED AT — the order matters, and getting it
// backwards was caught by this file's own negative controls. With the empty-targets exit first, a
// run with collapsed seed spacing on a CLEAN round exited 0 with a reassuring message, so the very
// misconfiguration these guards exist to catch was unreachable exactly when the round looked good.
// A broken instrument must announce itself whatever the data says.
const SEEDS = arg('seeds', BENCH.seeds.join(',')).split(',').map(Number);
const ITER = +arg('iter', 6000);
const TOP = +arg('top', 0);
if (SEEDS.some(s => !Number.isFinite(s))) die('--seeds must be comma-separated integers');
if (SEEDS.length < 3) die(`--seeds needs at least 3 (PHASE10 §5 grades on >=3); got ${SEEDS.length}.`);
const sorted = [...SEEDS].sort((a, b) => a - b);
const minGap = Math.min(...sorted.slice(1).map((s, i) => s - sorted[i]));
if (minGap < ITER) die(`seed spacing ${minGap} < iterations ${ITER}: wowsims seeds PER ITERATION, so these ` +
  `runs would share ~${(100 * (1 - minGap / ITER)).toFixed(1)}% of their draws and the band would collapse toward zero — ` +
  `which passes every delta (BENCH §3c.3). Space them by more than --iter.`);

// Zero targets is a real and GOOD outcome (invariant B held), but it must never be reported as a
// graded band over nothing — the false-pass shape every instrument here was hardened against.
if (targets.length === 0) { console.log('No borrowed-win columns in the round — nothing to band. (That is invariant B HOLDING, not an empty read.)'); process.exit(0); }

// ── the sim ──────────────────────────────────────────────────────────────────────────────────────
globalThis.wasmready = () => {};
await import(path.join(REPO, 'sim/wasm_exec.js'));
const go = new globalThis.Go();
const { instance } = await WebAssembly.instantiate(fs.readFileSync(path.join(REPO, 'sim/sim.wasm')), go.importObject);
go.run(instance);
if (typeof globalThis.raidSimJson !== 'function') die('sim.wasm did not expose raidSimJson');
const TEMPLATE0 = JSON.parse(fs.readFileSync(path.join(REPO, 'tools/bench/export-request.json'), 'utf8'));
const WASM_ID = crypto.createHash('sha1').update(fs.readFileSync(path.join(REPO, 'sim/sim.wasm'))).digest('hex').slice(0, 12);
const byTrinket = Object.fromEntries(Object.values(REQUIRES_EQUIPPED).map(v => [v.trinket, v]));

const withKit = kit => {
  const t = JSON.parse(JSON.stringify(TEMPLATE0));
  const items = t.raid.parties[0].players[0].equipment.items;
  const pair = kit.split('+').map(x => x.trim());
  if (pair.length !== 2 || pair.some(k => !byTrinket[k])) die(`unrecognised kit "${kit}" in the targets file.`);
  while (items.length < 14) items.push({ id: 0, randomSuffix: 0, enchant: 0, gems: [] });
  items[12] = { id: byTrinket[pair[0]].item, randomSuffix: 0, enchant: 0, gems: [] };
  items[13] = { id: byTrinket[pair[1]].item, randomSuffix: 0, enchant: 0, gems: [] };
  return t;
};

// Wall jitter, reproduced from xval-bench.mjs verbatim — same walls, same variant seeds, same shift
// rule. Anything else grades a different quantity than the matrix cell it is checking.
const mulb = seed => () => { seed |= 0; seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const variantsFor = (spec, WJ) => {
  const walls = [...(spec._intermissions || []), ...(spec._aoe || [])].map(w => w[0]).sort((a, b) => a - b);
  if (!walls.length || !WJ) return { walls, sets: [[]] };
  const sets = [walls.map(() => 0)];
  for (let v = 1; v <= 2 * WJ; v++) { const r = mulb(9000 + v); sets.push(walls.map(() => Math.round((r() * 2 - 1) * WJ))); }
  return { walls, sets };
};
const shiftSpec = (spec, walls, ds) => {
  if (!ds.length || !ds.some(d => d)) return spec;
  const sp = JSON.parse(JSON.stringify(spec));
  const shiftOf = t => { let d = 0; for (let i = 0; i < walls.length; i++) if (t >= walls[i]) d = ds[i]; return d; };
  for (const k in sp) {
    if (k === '_intermissions' || k === '_aoe') sp[k] = sp[k].map(([a, z]) => { const i = walls.indexOf(a), j = walls.indexOf(z); return [a + (i >= 0 ? ds[i] : 0), z + (j >= 0 ? ds[j] : (i >= 0 ? ds[i] : 0))]; });
    else if (Array.isArray(sp[k])) sp[k] = sp[k].map(t => t + shiftOf(t));
  }
  return sp;
};

const CACHE_DIR = path.join(REPO, '.xval-cache');
fs.mkdirSync(CACHE_DIR, { recursive: true });
const simOne = (tpl, kit, spec, simHaste, T, targetsN, seed) => {
  const key = 'dps-' + crypto.createHash('sha1').update(JSON.stringify({
    spec, simHaste, T, VAR: BENCH.variation, ITER, seed, targets: targetsN || 0,
    trinkets: kit.split('+').map(k => byTrinket[k].item), wasm: WASM_ID, mana: BENCH.manaInject,
  })).digest('hex').slice(0, 24);
  const cf = path.join(CACHE_DIR, key + '.json');
  if (fs.existsSync(cf)) { try { const v = JSON.parse(fs.readFileSync(cf, 'utf8')).dps; if (Number.isFinite(v)) return v; } catch { /* re-sim */ } }
  const req = buildRequest(tpl, { sp: 0, critPct: 0, hasteRating: simHaste, T, iterations: ITER,
    seed, variation: BENCH.variation, targets: targetsN || 0, apl: build(spec) });
  const out = JSON.parse(globalThis.raidSimJson(JSON.stringify(req)));
  if (out && out.errorResult) die('sim returned an error: ' + out.errorResult);
  const d = dpsOf(out);
  if (!d || !Number.isFinite(d.avg)) die(`sim returned no DPS (spec ${JSON.stringify(spec)} @${simHaste})`);
  const tmp = `${cf}.${process.pid}.tmp`; fs.writeFileSync(tmp, JSON.stringify({ dps: d.avg })); fs.renameSync(tmp, cf);
  return d.avg;
};

// ── grade ────────────────────────────────────────────────────────────────────────────────────────
const list = (TOP ? [...targets].sort((a, b) => b.pct - a.pct).slice(0, TOP) : targets);
console.log(`# Deficit band — ${list.length} column(s) · ${SEEDS.length} seeds ${SEEDS.join(',')} · ITER=${ITER} · var ${BENCH.variation}`);
console.log(`# PHASE10 §5: a deficit is REAL only if it survives at >=3 seeds with |Δ| > 1σ of the paired band.\n`);
console.log('| kit | class | T | sim-haste | borrowed | round-1 pct | band mean pct | band sd | seeds borrowed wins | verdict |');
console.log('|---|---|---|---|---|---|---|---|---|---|');
let real = 0, noise = 0;
for (const t of list) {
  if (!t.nativeSpec || !t.borrowedSpec) { console.log(`| ${t.kit} | ${t.class} | ${t.T} | ${t.simH} | ${t.borrowedH} | ${t.pct} | — | — | — | ⚠ specs missing from the table |`); continue; }
  const tpl = withKit(t.kit);
  const equipped = tpl.raid.parties[0].players[0].equipment.items.map(i => i && i.id).filter(Boolean);
  for (const [lbl, sp] of [['native', t.nativeSpec], ['borrowed', t.borrowedSpec]]) {
    const dead = unequippedPresses(sp, equipped);
    if (dead.length) die(`${t.file} ${lbl} plan presses ${dead.join(', ')} which kit "${t.kit}" does not equip — the band would be meaningless.`);
  }
  const isBoss = /^BOSS:/.test(t.class || '');
  const WJ = isBoss ? 2 : 0;
  const vN = variantsFor(t.nativeSpec, WJ), vB = variantsFor(t.borrowedSpec, WJ);
  const targetsN = (t.nativeSpec._aoe || []).length ? 6 : 0;   // the corpus's only AoE preset is KT ×6
  const per = SEEDS.map(seed => {
    const mean = (spec, v) => v.sets.reduce((s, ds) => s + simOne(tpl, t.kit, shiftSpec(spec, v.walls, ds), t.simH, t.T, targetsN, seed), 0) / v.sets.length;
    const nat = mean(t.nativeSpec, vN), bor = mean(t.borrowedSpec, vB);
    return 100 * (bor - nat) / nat;                              // >0 ⇒ the borrowed plan still wins
  });
  const m = per.reduce((s, x) => s + x, 0) / per.length;
  const sd = Math.sqrt(per.reduce((s, x) => s + (x - m) ** 2, 0) / (per.length - 1));
  const wins = per.filter(x => x > 0).length;
  const isReal = wins >= 3 && Math.abs(m) > sd;
  if (isReal) real++; else noise++;
  console.log(`| ${t.kit} | ${t.class} | ${t.T} | ${t.simH} | plan@${t.borrowedH} | ${t.pct.toFixed(3)} | ${m >= 0 ? '+' : ''}${m.toFixed(3)} | ${sd.toFixed(3)} | ${wins}/${per.length} | ${isReal ? '**REAL**' : 'not resolvable'} |`);
}
console.log(`\n**${real} real · ${noise} not resolvable** at ${SEEDS.length} seeds, ITER=${ITER}.`);
console.log(`(A column is "not resolvable" when it does not clear its own paired band — that is a statement about ` +
            `THIS instrument at THIS iteration count, not a proof the model is right there. ACCEPTANCE's bar is still zero columns.)`);
process.exit(0);
