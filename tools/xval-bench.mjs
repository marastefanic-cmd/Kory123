// THE CROSS-VAL, ON THE BENCH BACKBONE — one acceptance table, from the repo alone.
//
//   node tools/xval-bench.mjs <seed>
//   KIT=isc,scb TCLASS=short HASTES=0,20,65,… node tools/xval-bench.mjs 5521
//   KIT=isc,scb BOSS="Kael'thas Sunstrider" HASTES=… node tools/xval-bench.mjs 5043
//
// ── WHY THIS FILE EXISTS (the PHASE10 §4.2 gap) ───────────────────────────────────────────────────
// Phase 10's charter is "re-measure ACCEPTANCE on gear B with `tools/bench.mjs`", and §2's table names
// bench.mjs as the driver. But bench.mjs is a **two-arm duel** — it cannot emit the N×N
// plan-haste × sim-haste matrix the acceptance test is *defined* as, and `xval-collect.mjs` /
// `xval-verify.mjs` / `xval-persist.mjs` all parse that matrix. Meanwhile `tools/xval.mjs`, which DOES
// emit it, needs `RUNNER` + `EXPORT_BASE` — the native rig whose absence is the whole premise of the
// phase ("it finally costs almost nothing", §1.3).
//
// So the phase's *intent* — the committed wasm, one settled protocol, the same backbone as the
// website's button — needed a matrix driver. This is it. It is `xval.mjs`'s protocol with
// `bench.mjs`'s engine:
//
//   protocol      sim/benchmark.mjs        (var 0.5, seed 11 CRN, mana 1e8, cold open)
//   transcription sim/planspec.mjs         (fire times, floored — the plan the tool PRINTS)
//   APL           tools/genapl-core.mjs
//   request       sim/simreq.mjs           (patches tools/bench/export-request.json)
//   engine        sim/sim.wasm             (patched wowsims @ ade9f39; == native runner, tests/sim-duel.mjs)
//                 …or the NATIVE runner via `RUNNER=/path/to/runner-ap180` — ~6× faster for bulk
//                 gathering (GEAR-AGNOSTIC §4). Stamped `engine=` and keyed into the DPS cache, so a
//                 matrix can never mix the two. See the engine block below.
//   model         tools/engine-node.mjs    (index.html's engine block in bare node — no chromium)
//   gear          tools/reference-gear.mjs (spread, never re-typed)
//
// ⚠ WHAT IS DELIBERATELY UNCHANGED FROM `xval.mjs`, because changing it would make the round mean
// something else: the seeded fight draw (same seed ⇒ same T/Lust/kit, so the holdout SAMPLE is the
// gear-A design), the fight-length classes, the cross-haste pooling, the wall-jitter wash and its
// seeds, the artifact guard, and the output format down to the `XVAL-DONE` line. Every guard below
// that exits 2 was a real bug in `xval.mjs` at least once; they are carried over on purpose.
//
// ⚠ WHAT IS DIFFERENT, and must be stamped rather than assumed:
//   · the ENGINE is the committed wasm, not a per-session native build (`wasm=` on XVAL-DONE);
//   · the CHARACTER is `tools/bench/export.json` — gear B (`char=bench`), trinket-swapped per kit;
//   · `iter=` and `seeds=` are stamped, which gear-A tables did not carry (PHASE10 §3, "stamp
//     everything" — the round-5/round-6 `emit=` confusion is the recorded cost of not doing this).
// ★ A gear-B table must NEVER be diffed against a gear-A one (BENCH §1). The `char=` stamp is what
// lets a later reader tell them apart without trusting a directory name.
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from './genapl-core.mjs';
import { planToSpec } from '../sim/planspec.mjs';
import { buildRequest, dpsOf } from '../sim/simreq.mjs';
import { BENCH } from '../sim/benchmark.mjs';
import { loadEngine, ALL_BUFFS } from './engine-node.mjs';
import { REF, plainCastInPage } from './reference-gear.mjs';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
// Exit-code contract, shared with every instrument here: 0 = graded clean · 1 = graded and failing ·
// 2 = COULD NOT GRADE. This file never exits 1: it GATHERS. A `diag=DEFICIT` is an observation.
const die = m => { console.error('ERROR: ' + m); process.exit(2); };

// ── the fight draw (mulberry32) — byte-identical to xval.mjs so a seed names the same fight ───────
const SEED_ARG = process.argv[2] ?? '1';
if (!/^\d+$/.test(String(SEED_ARG).trim()))
  die(`seed must be a non-negative integer (got "${SEED_ARG}") — parseInt would have silently graded seed 0.`);
const SEED = parseInt(SEED_ARG, 10) >>> 0;

let s = SEED;
const rnd = () => { s |= 0; s = (s + 0x6D2B79F5) | 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const TCLASS = { short: [75, 115], medium: [150, 195], medlong: [205, 255], long: [265, 375], xl: [385, 460] };
const cls = process.env.TCLASS;
if (cls && !TCLASS[cls]) die(`TCLASS="${cls}" is not a known class (known: ${Object.keys(TCLASS).join(' ')}) — refusing to fall back to the generic length band.`);
const [tlo, thi] = cls ? TCLASS[cls] : [90, 420];
const T = tlo + Math.floor(rnd() * (thi - tlo + 1));
const LUST = Math.floor(rnd() * Math.max(1, T - 40));
const TRK = ['isc', 'scb', 'skull', 'mqg'];
let PAIR;
if (process.env.KIT) {
  PAIR = process.env.KIT.split(',').map(x => x.trim());
  if (PAIR.length !== 2 || PAIR.some(k => !TRK.includes(k)) || PAIR[0] === PAIR[1])
    die(`KIT="${process.env.KIT}" must be exactly two DISTINCT keys from ${TRK.join(',')}.`);
} else { const i = Math.floor(rnd() * 4); let j = Math.floor(rnd() * 3); if (j >= i) j++; PAIR = [TRK[i], TRK[j]]; }

let HASTES;
if (process.env.HASTES === undefined) HASTES = [0, 100, 200, 300, 400];
else {
  HASTES = process.env.HASTES.split(',').map(x => x.trim()).filter(x => x !== '').map(Number);
  if (!HASTES.length || !HASTES.every(Number.isFinite))
    die(`HASTES="${process.env.HASTES}" did not parse to a non-empty list of numbers — refusing to fall back to the coarse [0,100,200,300,400] grid.`);
}

const ITER = +(process.env.ITER || BENCH.iterations);
if (!Number.isFinite(ITER) || ITER < 1) die(`ITER="${process.env.ITER}" must be a positive integer.`);
// var 0.5 by MEASUREMENT (BENCH §3, tools/var-decision.mjs), not by convention. Read from BENCH so it
// cannot drift from the page's button; overridable only deliberately.
const VAR = process.env.VAR === undefined ? BENCH.variation : +process.env.VAR;
if (!Number.isFinite(VAR) || VAR < 0) die(`VAR="${process.env.VAR}" must be a non-negative number.`);
const SIMSEED = +(process.env.SIMSEED || BENCH.seed);   // one seed both arms = CRN
// P7.15 transcription convention. `fire` = the times the tool PRINTS (sim/planspec.mjs). `intent` is
// NOT offered here: this instrument is new, so it has no old round to reproduce, and offering the
// pre-07-25 convention would only create a way to gather an incomparable table by accident.
const EMIT = process.env.EMIT || 'fire';
if (EMIT !== 'fire') die(`EMIT="${EMIT}": this driver emits FIRE times only (sim/planspec.mjs). Use tools/xval.mjs + a native runner to reproduce an EMIT=intent round.`);

// ── the model (index.html's engine block, bare node) ──────────────────────────────────────────────
const api = loadEngine(path.join(REPO, 'index.html'));
// The plain-cast normalizer from its ONE definition, evaluated against the engine's own GAME table.
// Re-typing 720 / 2.5÷3.5 / 0.8175 here is the drift reference-gear.mjs exists to prevent, and the
// normalizer must be built from the SAME object as the cfg or every `eff` is rescaled (that file ★).
const PLAIN = new Function('GAME', 'R', `return (${plainCastInPage.toString()})(R);`)(api.GAME, REF);
if (!Number.isFinite(PLAIN) || PLAIN <= 0) die(`bad plain-cast normalizer ${PLAIN}`);

// BOSS mode: take the preset's real T / Lust / phases instead of the drawn fight. The KIT stays the
// drawn (or given) pair — we test each kit ON the boss's shape.
let segments = null, downtime = [], aoeWins = [], aoeTargets = 0, fightT = T, lust = LUST;
const BOSS = process.env.BOSS || null;
if (BOSS) {
  const all = api.cases.slice(0, api.nBoss);
  const exact = all.filter(x => x.name === BOSS);
  const hits = exact.length ? exact : all.filter(x => x.name.toLowerCase().includes(BOSS.toLowerCase()));
  if (!hits.length) die(`boss preset not found: ${BOSS}`);
  // A SUBSTRING that matched several presets used to silently take the first — grading a different
  // boss than the caller named, filed under the caller's label.
  if (hits.length > 1) die(`BOSS="${BOSS}" is AMBIGUOUS — matches ${hits.map(x => x.name).join(' | ')}`);
  const p = hits[0];
  fightT = p.T; lust = (p.pins && p.pins.bloodlust && p.pins.bloodlust[0]) || 0;
  // Mirror index.html's preset normalization: two SHIPPED presets carry the LEGACY single-window
  // `intermission:[from,to]` and no `phases`. Reading only `p.phases` dropped their downtime entirely
  // and the run reported CLEAN for a boss whose defining feature had been deleted.
  const rawPhases = p.phases || (p.intermission ? [{ type: 'intermission', from: p.intermission[0], to: p.intermission[1] }] : []);
  const rows = rawPhases.map(ph => ({ from: ph.from, to: ph.to, type: ph.type, mult: ph.mult || 1, targets: ph.targets || 0 }));
  segments = rows.length ? api.buildSegments(rows, fightT) : null;
  for (const ph of rawPhases) {
    if (ph.type === 'intermission') downtime.push([ph.from, ph.to]);
    if (ph.type === 'aoe') { aoeWins.push([ph.from, ph.to]); aoeTargets = Math.max(aoeTargets, ph.targets || 0); }
  }
  if (rows.some(r => r.type === 'burn'))
    die(`BOSS="${BOSS}" has a Burn phase — "AB damage ×N" has no encounter knob in wowsims, so it cannot be simmed (BENCH.md / sim/README.md).`);
}

const fmtT = x => `${Math.floor(x / 60)}:${String(x % 60).padStart(2, '0')}`;
console.log(`seed=${SEED}  class=${cls || 'any'}  fight=${fmtT(T)} (${T}s)  Lust@${fmtT(LUST)}  trinkets=${PAIR.join('+')}  haste=[${HASTES.join(',')}]  emit=${EMIT}`);

// ── solve: cross-haste pooling (invariant B1 by construction, ACCEPTANCE) ─────────────────────────
// Solve each haste ONCE for the champion set C = {champ(h)}, then EMIT at each H the argmax over C
// scored at H. Guarantees the emitted plan at H model-scores ≥ every champ at H, so no borrowed plan
// can out-SCORE a native. POOL=0 restores the raw per-haste search (to MEASURE what pooling fixes).
const kit = ['icyVeins', PAIR[0], PAIR[1], 'arcanePower', 'berserking', 'bloodlust'];
const en = {}; for (const k of ALL_BUFFS) en[k] = kit.includes(k);
const mkCfg = h => ({ T: fightT, hasteRating: h, ...REF, enabled: en, fixed: { bloodlust: [lust] }, warnings: [], coldSnap: true, segments });
const POOL = (process.env.POOL || '1') !== '0';

// planspec.mjs emits keys in `best.s` order; xval.mjs's table format lists them BL, AP, Zerk,
// trinkets, IV, CS, phases. Canonicalize for the record so two tables are diffable by eye. Purely
// cosmetic — genapl reads by key, and every consumer JSON.parses.
const KEY_ORDER = ['_prestack', 'BL', 'AP', 'Zerk', 'Icon', 'Gem', 'Skull', 'MQG', 'IV', 'CS', '_intermissions', '_intermission', '_aoe'];
const canon = sp => {
  const o = {};
  for (const k of KEY_ORDER) if (sp[k] !== undefined) o[k] = sp[k];
  for (const k of Object.keys(sp)) if (o[k] === undefined) o[k] = sp[k];   // never drop an unknown key
  return o;
};

// ── PLAN CACHE + SHARDING — what makes a 420s AoE boss table fit on this box ──────────────────────
// A KT solve costs minutes (measured: 113–165s at T≈420, ~280s with the AoE phase) and a KT matrix is
// 100 cells × 5 wall-jitter variants ≈ 14 CPU-hours at ITER=6000. There are only TWO boss tables per
// boss, so a table-level `xargs -P4` leaves half the box idle for the longest job in the round.
// Sharding fixes that — but only if the shards do not each redo every solve, so the plans are cached
// first. This is LOSSLESS, not an approximation: the optimizer is deterministic by construction
// (CLAUDE.md, "Determinism is a feature"), so one (engine, cfg) has exactly one answer.
//   SOLVE_ONLY=1   solve + cache every haste, emit nothing, exit 0     (run this first)
//   SHARD=k/n      sim only plan-rows ≡ k (mod n), warm the DPS cache, emit nothing, exit 0
//   (default)      the full table — every solve and every sim a cache hit after the above
// The key carries the ENGINE CONTENT, so an edit to index.html invalidates every plan rather than
// silently mixing two engines' schedules into one matrix.
const CACHE_ON = process.env.DPS_CACHE !== '0';
const CACHE_DIR = (process.env.DPS_CACHE && !['0', '1'].includes(process.env.DPS_CACHE))
  ? process.env.DPS_CACHE : path.join(REPO, '.xval-cache');
if (CACHE_ON) fs.mkdirSync(CACHE_DIR, { recursive: true });
const ENGINE_ID = crypto.createHash('sha1').update(fs.readFileSync(path.join(REPO, 'index.html'))).digest('hex').slice(0, 12);
const readCache = key => {
  if (!CACHE_ON) return null;
  const cf = path.join(CACHE_DIR, key + '.json');
  if (!fs.existsSync(cf)) return null;
  try { return JSON.parse(fs.readFileSync(cf, 'utf8')); } catch { return null; }   // corrupt → recompute
};
const writeCache = (key, val) => {
  if (!CACHE_ON) return;
  const cf = path.join(CACHE_DIR, key + '.json');
  const tmp = `${cf}.${process.pid}.tmp`;                 // rename is atomic, so parallel shards
  fs.writeFileSync(tmp, JSON.stringify(val)); fs.renameSync(tmp, cf);   // cannot corrupt each other
};

const champ = {};
for (const h of HASTES) {
  const cfg = mkCfg(h);
  const key = 'plan-' + crypto.createHash('sha1').update(JSON.stringify({ cfg, engine: ENGINE_ID, restarts: 14 })).digest('hex').slice(0, 24);
  const hit = readCache(key);
  if (hit && hit.s) { champ[h] = hit.s; process.stderr.write(`  plan h${h} from cache\n`); continue; }
  const t0 = Date.now();
  champ[h] = (await api.optimizeAsync(cfg, 14, () => {})).s;
  process.stderr.write(`  solved h${h} in ${((Date.now() - t0) / 1000).toFixed(1)}s\n`);
  writeCache(key, { s: champ[h] });
}
if (process.env.SOLVE_ONLY === '1') { console.log(`SOLVE-ONLY seed=${SEED} kit=${PAIR.join('+')} hastes=${HASTES.length} — plans cached, no table emitted.`); process.exit(0); }
const plans = {};
const skippedAll = new Set();
for (const H of HASTES) {
  const cfg = mkCfg(H);
  let bestH = champ[H], bestV = api.simulate(champ[H], cfg).robust;
  if (POOL) for (const h of HASTES) {
    if (h === H) continue;
    const v = api.simulate(champ[h], cfg).robust;
    if (v > bestV + 1e-7) { bestV = v; bestH = champ[h]; }
  }
  const optR = api.simulate(bestH, cfg, true);
  const { spec, targets, skipped, burn } = planToSpec({ cfg, best: { s: bestH }, optR }, api.BUFFS);
  if (burn) die('this fight has a Burn phase — not simmable (see above).');
  for (const k of skipped) skippedAll.add(k);
  if (BOSS && (targets || 0) !== aoeTargets) die(`transcription disagrees about AoE targets at h${H}: planspec says ${targets}, the preset says ${aoeTargets}.`);
  plans[H] = { spec: canon(spec), eff: +(bestV / PLAIN).toFixed(3) };
}
// ★ A cooldown the kit ENABLED but the transcription could not express would be simmed as absent in
// BOTH arms and nothing would say so — planspec.mjs's whole reason for returning `skipped`. The kits
// here are exactly the transcribable four trinkets + IV/AP/Zerk/BL, so this must be empty.
if (skippedAll.size) die(`not transcribable, so absent from every sim in this table: ${[...skippedAll].join(', ')}. ` +
  `The kit must only contain cooldowns planspec.mjs can express (see sim/planspec.mjs UNTRANSCRIBABLE).`);

if (BOSS) console.log(`  BOSS=${BOSS}  T=${fightT}  Lust@${lust}${aoeTargets ? `  AoE phase VALUED: AE windows ×${aoeTargets} targets (--targets)` : ''}`);

// ── the artifact guard: reads ONLY the emitted spec, shares no code with simulate() ───────────────
// The standing correlated-error risk (TOOLING lesson 6): the fire times fed to the sim come from
// `simulate()`, the very function the duel is supposed to certify. This check does not use it.
// Under EMIT=fire a press inside a wall is FAITHFUL (the engine fires gap presses in place; a trinket
// is usable while the boss is untargetable), so it is reported as `wallPress=`, not as an artifact.
const ART_KEYS = ['BL', 'AP', 'Zerk', 'Icon', 'Gem', 'Skull', 'MQG', 'IV', 'CS'];
const wallPresses = [];
for (const h of HASTES) {
  const sp = plans[h].spec, wins = sp._intermissions || [];
  for (const k of ART_KEYS) for (const t of (sp[k] || [])) {
    const w = wins.find(([a, b]) => t >= a && t < b);
    if (w) wallPresses.push(`h${h} ${k}@${t} inside intermission [${w[0]},${w[1]})`);
  }
}
if (wallPresses.length) {
  console.log(`  WALL-PRESS NOTE: ${wallPresses.length} press(es) emitted inside an intermission — FAITHFUL under EMIT=fire (the engine fires gap presses IN PLACE; the wall seconds are zero-valued by model and sim alike). Reported for visibility, not an alarm.`);
  for (const a of wallPresses) console.log(`     ${a}`);
}

for (const h of HASTES) console.log(`  plan@h${h}: eff=${plans[h].eff}  ${JSON.stringify(plans[h].spec)}`);
const sig = sp => JSON.stringify(Object.keys(sp).sort().reduce((o, k) => (o[k] = sp[k], o), {}));
const uniq = {}; for (const h of HASTES) uniq[sig(plans[h].spec)] = h;
console.log(`unique plans: ${Object.keys(uniq).length}/${HASTES.length}`);

// ── the sim (committed wasm) ─────────────────────────────────────────────────────────────────────
const TMETA = { isc: { item: 29370 }, scb: { item: 30720 }, skull: { item: 32483 }, mqg: { item: 19339 } };
const TEMPLATE_PATH = path.join(REPO, 'tools/bench/export-request.json');
if (!fs.existsSync(TEMPLATE_PATH)) die(`tools/bench/export-request.json is missing — see tools/bench.mjs for the --dumpreq recipe.`);
const TEMPLATE = JSON.parse(fs.readFileSync(TEMPLATE_PATH, 'utf8'));
// Trinket swap: the on-use requires the item EQUIPPED, so each kit needs its own two trinket slots.
// (Slots 12/13 are the trinket slots; the committed template already wears isc+scb.) The wasm is
// built `with_db`, so an item id resolves inside the engine — verified by direct probe: all four
// on-uses produce a non-zero paired value, and swapping changes the never-press control.
{
  const items = TEMPLATE.raid.parties[0].players[0].equipment.items;
  if (items.length < 14) die(`the request template has ${items.length} equipment slots — expected ≥14 (trinkets are 12/13).`);
  items[12] = { id: TMETA[PAIR[0]].item, randomSuffix: 0, enchant: 0, gems: [] };
  items[13] = { id: TMETA[PAIR[1]].item, randomSuffix: 0, enchant: 0, gems: [] };
}
// ── THE ENGINE: committed wasm by default, native runner via RUNNER= ──────────────────────────────
// ★ WHY A SECOND BACKEND EXISTS (added 07-27, mid-round, deliberately — PHASE10 §8.26).
// `docs/GEAR-AGNOSTIC.md` §4 measured the native runner at **~6× the wasm** on the sim half and
// prescribes it for exactly this job: *"bulk corpus gathering → native runner — 6× on the sim half is
// hours per round"*. Its own caveat ("the boss half is solve-dominated") does NOT apply once the
// solves are cached, which is the state a boss table reaches after the SOLVE_ONLY pre-pass — the boss
// half is then purely sim-bound. Measured on this box: a boss cell costs ~80 CPU-s per sim on wasm
// (a Vashj APL evaluates a 7-clause intermission condition every GCD), i.e. ~13 h for the remaining
// stratum against ~2 h native.
//
// ⚠⚠ THE RULES THIS MUST OBEY, because `tools/xval-bench.mjs` is otherwise FROZEN mid-round
// (GEAR-AGNOSTIC §6.2). That freeze exists so a MATRIX is never assembled from two instruments — so:
//   1. an engine switch is legitimate only BETWEEN whole tables, never within one. Enforced by the
//      cache key below, which carries the engine identity, so a wasm-warmed entry can never be served
//      into a native matrix (that is the exact failure the freeze names).
//   2. it is STAMPED — `engine=` on every XVAL-DONE line — so no reader has to infer it.
//   3. it is only defensible because the two are PROVEN equal here: `tests/sim-duel.mjs` with RUNNER
//      passes in this container (wasm == native to the printed decimal), and GEAR-AGNOSTIC §4 puts the
//      residual at 0.02–0.05 DPS ≈ 0.002 %, ~15× below the smallest deficit this corpus grades.
//   4. the strata stay separate anyway — ACCEPTANCE ★★ forbids pooling boss and class cells, since
//      they already differ in wall-jitter structure and noise.
const RUNNER = process.env.RUNNER || '';
let ENGINE, sim;
if (RUNNER) {
  if (!fs.existsSync(RUNNER)) die(`RUNNER="${RUNNER}" does not exist.`);
  const rst = fs.statSync(RUNNER);
  ENGINE = `native:${path.basename(RUNNER)}:${rst.size}`;   // size pins a rebuilt binary as a new engine
  // The runner takes an EXPORT, not a request, so the trinket swap happens on the export instead.
  const exp = JSON.parse(fs.readFileSync(path.join(REPO, 'tools/bench/export.json'), 'utf8'));
  exp.player.equipment.items[12] = { id: TMETA[PAIR[0]].item };
  exp.player.equipment.items[13] = { id: TMETA[PAIR[1]].item };
  const EXPORT = path.join(os.tmpdir(), `xvb-export-${PAIR.join('-')}-${process.pid}.json`);
  fs.writeFileSync(EXPORT, JSON.stringify(exp));
  const APLDIR = fs.mkdtempSync(path.join(os.tmpdir(), 'xvb-apl-'));
  let n = 0;
  sim = (spec, simHaste) => {
    const aplPath = path.join(APLDIR, `a${n++}.json`);
    fs.writeFileSync(aplPath, JSON.stringify(build(spec)));
    const args = ['--export', EXPORT, '--apl', aplPath, '--dur', String(fightT), '--var', String(VAR),
      '--iter', String(ITER), '--seed', String(SIMSEED), '--mana', String(BENCH.manaInject),
      '--haste', String(simHaste), '--quiet', '--tag', 'xvb'];
    if (aoeTargets) args.push('--targets', String(aoeTargets));
    const out = execFileSync(RUNNER, args, { encoding: 'utf8', maxBuffer: 1 << 26 });
    // The runner prints a TSV line; DPS is whitespace field 5. A NaN here would propagate into the
    // matrix and BOTH invariant loops compare with `>`, which is FALSE for NaN — a confident double
    // PASS over nothing. This was xval.mjs's worst historical defect; the guard is carried over.
    const dps = parseFloat(out.trim().split('\n').pop().split(/\s+/)[4]);
    if (!Number.isFinite(dps)) die(`could not parse DPS (field 5) from the runner: ${JSON.stringify(out.trim().split('\n').pop())}`);
    return dps;
  };
} else {
  const WASM_PATH = path.join(REPO, 'sim/sim.wasm');
  ENGINE = 'wasm:' + crypto.createHash('sha1').update(fs.readFileSync(WASM_PATH)).digest('hex').slice(0, 12);
  globalThis.wasmready = () => {};
  await import(path.join(REPO, 'sim/wasm_exec.js'));
  const go = new globalThis.Go();
  const { instance } = await WebAssembly.instantiate(fs.readFileSync(WASM_PATH), go.importObject);
  go.run(instance);
  if (typeof globalThis.raidSimJson !== 'function') die('sim.wasm did not expose raidSimJson — rebuild with sim/build-wasm.sh');
  sim = (spec, simHaste) => {
    const req = buildRequest(TEMPLATE, {
      sp: 0, critPct: 0, hasteRating: simHaste,
      T: fightT, iterations: ITER, seed: SIMSEED, variation: VAR, targets: aoeTargets || 0, apl: build(spec),
    });
    const out = JSON.parse(globalThis.raidSimJson(JSON.stringify(req)));
    if (out && out.errorResult) die('sim returned an error: ' + out.errorResult);
    const d = dpsOf(out);
    if (!d || !Number.isFinite(d.avg)) die(`sim returned no DPS for a plan simmed @${simHaste}.`);
    return d.avg;
  };
}
const WASM_ID = ENGINE;   // the cache key's engine field — see runSim below

// ── wall jitter (boss tables) — verbatim from xval.mjs, including the variant seeds ───────────────
// Within a wall-bounded segment the cast train is phase-locked to the exit, so a plan realizes haste
// value only in WHOLE casts before the next wall — a deterministic per-segment cast parity no kill
// variance can smooth. The wash must vary SEGMENT LENGTHS: each wall gets its OWN shift, and each
// press moves with the wall that starts its segment. A rigid translation washes nothing.
let WJ = 0;
const walls = [...downtime, ...aoeWins].map(w => w[0]).sort((a, b) => a - b);
if (BOSS && walls.length) {
  const wjEnv = process.env.WJITTER;
  WJ = (wjEnv === undefined || wjEnv === '') ? 2 : +wjEnv;   // `??` does NOT catch an empty string
  if (!Number.isFinite(WJ) || WJ < 0) die(`WJITTER="${wjEnv}" must be a non-negative number.`);
}
const mulb = seed => () => { seed |= 0; seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const VARIANTS = [walls.map(() => 0)];
for (let v = 1; v <= 2 * WJ; v++) { const r = mulb(9000 + v); VARIANTS.push(walls.map(() => Math.round((r() * 2 - 1) * WJ))); }
const shiftSpec = (spec, ds) => {
  if (!ds.some(d => d)) return spec;
  const sp = JSON.parse(JSON.stringify(spec));
  const shiftOf = t => { let d = 0; for (let i = 0; i < walls.length; i++) if (t >= walls[i]) d = ds[i]; return d; };
  for (const k in sp) {
    // a window END that coincides with ANOTHER window's START (a seam) must move with THAT window's
    // shift, or the two overlap or gap at the seam.
    if (k === '_intermissions' || k === '_aoe') sp[k] = sp[k].map(([a, z]) => { const i = walls.indexOf(a), j = walls.indexOf(z); return [a + (i >= 0 ? ds[i] : 0), z + (j >= 0 ? ds[j] : (i >= 0 ? ds[i] : 0))]; });
    else if (Array.isArray(sp[k])) sp[k] = sp[k].map(t => t + shiftOf(t));
  }
  return sp;
};

// ── one sim = one cache entry (content-addressed, lossless) ──────────────────────────────────────
// The engine is deterministic at a fixed seed (probed: bit-identical across repeat calls), so an
// identical (spec, haste, dur, var, iter, seed, targets, trinkets, wasm) tuple has an identical
// answer. A table's matrix has duplicate rows (`unique plans: 9/10` is typical), so this is not a
// micro-optimisation. The key carries the WASM CONTENT, not a path — a rebuilt engine is a different
// experiment, which is the failure this repo has already had once (the stale unpatched runner).
let cacheHit = 0, cacheMiss = 0;
const runSim = (spec, simHaste) => {
  const key = CACHE_ON ? 'dps-' + crypto.createHash('sha1').update(JSON.stringify({
    spec, simHaste, T: fightT, VAR, ITER, seed: SIMSEED, targets: aoeTargets || 0,
    trinkets: PAIR.map(k => TMETA[k].item), wasm: WASM_ID, mana: BENCH.manaInject,
  })).digest('hex').slice(0, 24) : null;
  if (key) {
    const hit = readCache(key);
    if (hit && Number.isFinite(hit.dps)) { cacheHit++; return hit.dps; }
  }
  // both backends guard their own NaN (see the engine block); this is the one call site.
  const dps = sim(spec, simHaste);
  cacheMiss++;
  if (key) writeCache(key, { dps });
  return dps;
};

// SHARD=k/n — sim only the plan-rows congruent to k, warm the cache, emit no table. The full run
// afterwards reads every one of them back. A malformed SHARD must never be read as "no sharding":
// that would silently gather a whole table under a name the caller meant as one slice of it.
let SHARD = null;
if (process.env.SHARD !== undefined && process.env.SHARD !== '') {
  const m = /^(\d+)\/(\d+)$/.exec(process.env.SHARD);
  if (!m || +m[2] < 1 || +m[1] >= +m[2]) die(`SHARD="${process.env.SHARD}" must be "k/n" with 0 ≤ k < n.`);
  SHARD = { k: +m[1], n: +m[2] };
}

const M = {};
for (let i = 0; i < HASTES.length; i++) {
  const ph = HASTES[i];
  if (SHARD && i % SHARD.n !== SHARD.k) continue;
  M[ph] = {};
  for (const sh of HASTES) {
    let acc = 0;
    for (const ds of VARIANTS) acc += runSim(shiftSpec(plans[ph].spec, ds), sh);
    M[ph][sh] = acc / VARIANTS.length;
  }
}
if (SHARD) { console.log(`SHARD-DONE ${SHARD.k}/${SHARD.n} seed=${SEED} kit=${PAIR.join('+')} rows=${Object.keys(M).length} cache=${cacheHit}/${cacheHit + cacheMiss} — cache warmed, no table emitted.`); process.exit(0); }

console.log('\nDPS matrix (row = plan optimized @haste, col = simmed @haste):');
console.log('plan\\sim ' + HASTES.map(h => String(h).padStart(8)).join(''));
for (const ph of HASTES) console.log(String(ph).padEnd(8) + ' ' + HASTES.map(sh => M[ph][sh].toFixed(1).padStart(8)).join(''));

// ── the two readings. DATA-GATHERING: report raw observations, draw NO conclusions ────────────────
let monoWorst = 0, monoAt = '';
for (const ph of HASTES) for (let k = 1; k < HASTES.length; k++) {
  const d = (M[ph][HASTES[k - 1]] - M[ph][HASTES[k]]) / M[ph][HASTES[k - 1]];
  if (d > monoWorst) { monoWorst = d; monoAt = `plan@${ph}: sim@${HASTES[k]} (${M[ph][HASTES[k]].toFixed(1)}) < sim@${HASTES[k - 1]} (${M[ph][HASTES[k - 1]].toFixed(1)})`; }
}
let diagWorst = 0, diagAt = '';
for (const sh of HASTES) {
  const native = M[sh][sh];
  for (const ph of HASTES) {
    const d = (M[ph][sh] - native) / native;
    if (d > diagWorst) { diagWorst = d; diagAt = `@sim${sh}: plan@${ph} (${M[ph][sh].toFixed(1)}) > native@${sh} (${native.toFixed(1)})`; }
  }
}
// 1e-6 relative is far below the printed 0.1-DPS precision — it suppresses float artifacts of the
// jittered mean, and is NOT a graded tolerance (a real deficit is orders of magnitude above it).
const diagClean = diagWorst <= 1e-6;
console.log(`\n(a) haste-monotonicity [OBSERVED, not interpreted]: worst downward dip = ${(monoWorst * 100).toFixed(2)}%` + (monoWorst > 0 ? `  [${monoAt}]` : ''));
console.log(`(b) DIAGONAL DOMINANCE: ${diagClean ? 'CLEAN — native dominates every column' : `DEFICIT ${(diagWorst * 100).toFixed(2)}%  [${diagAt}]`}`);
// ★ EVERY protocol constant is stamped. A number without its protocol cannot be compared to anything
// later — PHASE10 §3, and the round-5/round-6 `emit=` confusion is the recorded case.
console.log(`XVAL-DONE seed=${SEED} kit=${PAIR.join('+')} class=${BOSS ? 'BOSS:' + BOSS.replace(/[^A-Za-z]/g, '') : (cls || 'any')} T=${fightT} lust=${lust} var=${VAR} wj=${WJ} emit=${EMIT} artifact=0${wallPresses.length ? ` wallPress=${wallPresses.length}` : ''} iter=${ITER} simseed=${SIMSEED} mana=${BENCH.manaInject} targets=${aoeTargets || 0} char=bench-gearB engine=${ENGINE} tool=xval-bench pool=${POOL ? 1 : 0} cache=${cacheHit}/${cacheHit + cacheMiss} monoDip=${(monoWorst * 100).toFixed(2)}% diag=${diagClean ? 'CLEAN' : 'DEFICIT'} diagWorst=${(diagWorst * 100).toFixed(2)}%`);
// The Go runtime inside sim.wasm parks on a channel and optimizeAsync's breathe() holds a
// MessageChannel — both keep node's event loop ref'd, so this process never exits on its own.
process.exit(0);
