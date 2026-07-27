// DOES THE EXACT SCORER ACTUALLY PICK BETTER PLANS? — the demonstration PHASE12 §0.4 demands.
//
//   node tools/scorer-duel.mjs --movers /tmp/movers.json [--n 20] [--seeds 11,12,13]
//
// ── WHY THIS EXISTS, IN THE PROJECT'S OWN WORDS ──────────────────────────────────────────────────
// §0.4: *"'the cast sum is correct' is now load-bearing for half the product, and that claim is
// supported by DERIVATION (it is what the docs define) and by SELF-CONSISTENCY, not by measurement
// against ground truth."* `tools/self-consistency.mjs` proves the model no longer disagrees with
// itself. It cannot prove the account it settled on is the better RANKER. Only the sim can, and only
// once the sim executes the plan it is handed — which is what the press-transcription fix bought
// (PHASE12 §6.9: transcription failures 7.14 % -> 0.00 %).
//
// ── THE EXPERIMENT ───────────────────────────────────────────────────────────────────────────────
// `tools/blast-radius.mjs --MOVERS_OUT` lists every pooled-argmax cell where the two accounts pick a
// DIFFERENT plan. For each one this duels those two plans head to head, in the sim, at that cell's own
// fight and character:
//
//     arm A = the plan the retired rate integral would have emitted
//     arm B = the plan the exact per-cast sum emits
//
// Same fight, same seeds, same character, same transcription. Whichever the sim scores higher is the
// better plan, and the count of B-wins over A-wins is the whole verdict. A tie inside the seed band is
// reported as a tie and counts for neither — a scorer change that only moves ties is not an
// improvement, and calling it one is how §6.5a got published and withdrawn.
//
// ⚠ THE KIT MUST BE WORN. A scheduled press of an unequipped trinket is a bit-identical no-op in
// wowsims (PHASE12 §2.1), so a duel of two plans that differ only in MQG timing, run on a character
// not wearing MQG, is a duel of two identical experiments that returns a confident 0.000. Each cell
// therefore equips its own pair onto the template, exactly as `tools/bench.mjs --kit` does.
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadEngine, ALL_BUFFS } from './engine-node.mjs';
import { REF } from './reference-gear.mjs';
import { planToSpec, REQUIRES_EQUIPPED } from '../sim/planspec.mjs';
import { build } from './genapl-core.mjs';
import { buildRequest, dpsOf } from '../sim/simreq.mjs';
import { BENCH } from '../sim/benchmark.mjs';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const die = m => { console.error('ERROR: ' + m); process.exit(2); };
const argv = process.argv.slice(2);
const arg = (k, d) => { const i = argv.indexOf('--' + k); return i >= 0 && argv[i + 1] !== undefined ? argv[i + 1] : d; };

const MOVERS = arg('movers', '/tmp/movers.json');
if (!fs.existsSync(MOVERS)) die(`no mover list at ${MOVERS} — produce one with:\n` +
  '  MOVERS_OUT=/tmp/movers.json node tools/blast-radius.mjs');
const rows = JSON.parse(fs.readFileSync(MOVERS, 'utf8'));
const N = +arg('n', '20');
const SEEDS = arg('seeds', '11,12,13').split(',').map(Number);
const ITER = +arg('iter', String(BENCH.iterations));
const FLOOR = +arg('floor', '0.25');   // DPS below which this instrument declares a tie — see below
const VAR = arg('var') === undefined ? BENCH.variation : +arg('var');

const ROUND_INDEX = process.env.ROUND_INDEX || '/tmp/index-round.html';
const ENGINE = process.env.ENGINE || path.join(REPO, 'index.html');
const api = loadEngine(ENGINE);
const EID = crypto.createHash('sha1').update(fs.readFileSync(ROUND_INDEX)).digest('hex').slice(0, 12);
const planOf = cfg => {
  const k = 'plan-' + crypto.createHash('sha1').update(JSON.stringify({ cfg, engine: EID, restarts: 14 })).digest('hex').slice(0, 24);
  const f = path.join(REPO, '.xval-cache', k + '.json');
  return fs.existsSync(f) ? JSON.parse(fs.readFileSync(f, 'utf8')).s : null;
};

// The gear-agnostic character: stats injected, equipment padded so a pair can be worn (GEAR-AGNOSTIC).
const TEMPLATE_PATH = path.join(REPO, 'sim/model-ref-request.json');
if (!fs.existsSync(TEMPLATE_PATH)) die(`missing ${TEMPLATE_PATH}`);
const byTrinket = Object.fromEntries(Object.values(REQUIRES_EQUIPPED).map(v => [v.trinket, v]));
function templateWearing(kitPair) {
  const T = JSON.parse(fs.readFileSync(TEMPLATE_PATH, 'utf8'));
  const items = T.raid.parties[0].players[0].equipment.items;
  while (items.length < 14) items.push({ id: 0, randomSuffix: 0, enchant: 0, gems: [] });
  for (let i = 0; i < 2; i++) {
    const v = byTrinket[kitPair[i]];
    if (!v) die(`unknown trinket key "${kitPair[i]}" in kit — a press of an unworn trinket is a silent no-op`);
    items[12 + i] = { id: v.item, randomSuffix: 0, enchant: 0, gems: [] };
  }
  return T;
}

globalThis.wasmready = () => {};
await import(path.join(REPO, 'sim/wasm_exec.js'));
const go = new globalThis.Go();
const { instance } = await WebAssembly.instantiate(fs.readFileSync(path.join(REPO, 'sim/sim.wasm')), go.importObject);
go.run(instance);
if (typeof globalThis.raidSimJson !== 'function') die('sim.wasm did not expose raidSimJson');
const sim = req => {
  const out = JSON.parse(globalThis.raidSimJson(JSON.stringify(req)));
  if (out && out.errorResult) die('sim returned an error: ' + out.errorResult);
  const d = dpsOf(out);
  if (!d || !Number.isFinite(d.avg)) die('sim returned no DPS — a NaN would slide through as "not a regression"');
  return d.avg;
};

const mean = xs => xs.reduce((s, x) => s + x, 0) / xs.length;
const sd = xs => xs.length < 2 ? 0 : Math.sqrt(xs.reduce((s, x) => s + (x - mean(xs)) ** 2, 0) / (xs.length - 1));

console.log(`SCORER DUEL — the exact per-cast sum vs the retired rate integral, in the sim\n`);
console.log(`  ${Math.min(N, rows.length)} of ${rows.length} mover cells · ${SEEDS.length} seeds · ${ITER} iters · var ${VAR} · tie floor ${FLOOR} DPS`);
console.log(`  plans from ${ROUND_INDEX} · scored/transcribed by ${ENGINE}\n`);
console.log('  kit      class    T   h    integral -> castSum      sim Δ (B−A)      verdict');

let bWin = 0, aWin = 0, tie = 0, skipped = 0;
const deltas = [];
for (const row of rows.slice(0, N)) {
  const kitPair = row.kit.split('+');
  const kit = ['icyVeins', ...kitPair, 'arcanePower', 'berserking', 'bloodlust'];
  const en = {}; for (const k of ALL_BUFFS) en[k] = kit.includes(k);
  const cfg = { T: row.T, hasteRating: row.h, ...REF, t5two: false,   // model-ref wears no armour set
                enabled: en, fixed: { bloodlust: [row.lust] }, warnings: [], coldSnap: true, segments: null };
  const mk = h => planOf({ ...cfg, hasteRating: h, ...REF });
  const sA = mk(row.integralH), sB = mk(row.castSumH);
  if (!sA || !sB) { skipped++; continue; }

  const TEMPLATE = templateWearing(kitPair);
  const specOf = s => {
    const optR = api.simulate(s, cfg, true);
    return planToSpec({ cfg, best: { s }, optR }, api.BUFFS);
  };
  const A = specOf(sA), B = specOf(sB);
  if (A.burn || B.burn) { skipped++; continue; }
  const req = (spec, seed) => buildRequest(TEMPLATE, {
    sp: cfg.sp, critPct: cfg.critPct, hasteRating: cfg.hasteRating, T: cfg.T,
    iterations: ITER, seed, variation: VAR, targets: A.targets, apl: build(spec),
  });
  const per = SEEDS.map(seed => sim(req(B.spec, seed)) - sim(req(A.spec, seed)));
  const d = mean(per), band = sd(per);
  deltas.push(d);
  // A delta inside its own seed band is a TIE, not a win. Both arms share the seed (common random
  // numbers), so the band is the residual plan-vs-plan noise, and calling anything under it a win is
  // precisely the error §6.5a made.
  //
  // ⚠ AND THE BAND ALONE IS NOT ENOUGH. With common random numbers the seed band collapses to ±0.00
  // on essentially every cell, so "|d| <= band" declares a WINNER for a delta of +0.00 vs -0.00 —
  // it turns rounding into a verdict, and it flattered this tool's own first verdict from 6-8 to
  // 14-10 before anyone looked at the band column. FLOOR is the sim's practical resolution: 0.25 DPS
  // on ~2700 DPS is ~0.01 %, comfortably under the corpus's smallest real deficit (0.004 % ~ 0.11 DPS)
  // and comfortably over the noise. A verdict this instrument cannot resolve must read `tie`.
  const verdict = Math.abs(d) <= Math.max(band, FLOOR) ? 'tie' : (d > 0 ? 'CAST-SUM' : 'integral');
  if (verdict === 'tie') tie++; else if (d > 0) bWin++; else aWin++;
  console.log(`  ${row.kit.padEnd(8)} ${row.cls.padEnd(7)} ${String(row.T).padStart(3)} ${String(row.h).padStart(3)}  ` +
    `${String(row.integralH).padStart(4)} -> ${String(row.castSumH).padEnd(4)}   ` +
    `${(d >= 0 ? '+' : '') + d.toFixed(2)} ± ${band.toFixed(2)} DPS`.padStart(22) + `   ${verdict}`);
}

const decided = bWin + aWin;
console.log(`\n  cast-sum's plan wins ${bWin} · integral's plan wins ${aWin} · ties ${tie}` +
  (skipped ? ` · skipped ${skipped}` : ''));
if (decided) {
  console.log(`  of the ${decided} DECIDED cells, the exact per-cast sum picks the better plan ` +
    `${(100 * bWin / decided).toFixed(0)} % of the time`);
  console.log(`  mean Δ across all duelled cells: ${(mean(deltas) >= 0 ? '+' : '') + mean(deltas).toFixed(2)} DPS`);
}
console.log(`\n  ⚠ This is the ONLY evidence that licenses re-recording exact-match goldens (PHASE12 §0.4).`);
console.log(`    Deriving that the cast sum is the documented objective is not the same as showing it ranks better.`);
process.exit(0);
