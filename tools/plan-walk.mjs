// THE MINIMAL-PAIR WALK — localise a model-vs-sim disagreement to a single track.
//
//   node tools/plan-walk.mjs --table tools/xval-results/isc-mqg-medlong.txt --sim-haste 40 --rival 70
//   node tools/plan-walk.mjs --spec-a '{…}' --spec-b '{…}' --T 229 --sim-haste 40 --kit isc,mqg
//     [--seeds 11,100011,200011] [--iter 6000] [--json]
//
// ── WHAT IT IS FOR ────────────────────────────────────────────────────────────────────────────────
// A cross-val deficit says "the sim prefers the plan built for another haste". That is a whole-plan
// statement, and a whole plan differs in five or six tracks at once. PHASE8 §16/§17 showed the way
// out: walk the path between the two layouts ONE TRACK AT A TIME, in BOTH directions, and read off
// which move carries the gap. That localised B2 to a single press.
//
// For each track it reports the MODEL delta (the scorer's own objective, sim-free) beside the SIM
// delta (paired CRN over several seeds). The interesting rows are where they DISAGREE IN SIGN: those
// are scorer error. Rows where both agree are the model being right about a real effect.
//
// ── THE THREE TRAPS THIS HAS TO AVOID, ALL PAID FOR ALREADY ───────────────────────────────────────
// ★ 1. LEGALITY IS STRUCTURAL, NOT A DRIFT TEST (PHASE8 §17.5). An intermediate plan can violate a
//   cooldown, and wowsims will happily sim it — the press simply does not fire, or fires late. Two
//   illegal plans once got retimed by only 2.0 s, well under a cast interval, so "the presses landed
//   near where I asked" proves nothing. Every intermediate is checked A PRIORI here, against BUFFS'
//   own cooldowns, and an illegal one is REPORTED AND SKIPPED rather than silently simmed.
// ★ 2. THE KIT MUST MATCH THE SPEC (§8.7). A press of an unworn trinket is a bit-identical no-op, so
//   a walk run on the wrong character silently deletes the very track under test.
// ★ 3. SEEDS MUST BE SPACED (BENCH §3c.3). wowsims seeds per iteration; adjacent seeds share draws
//   and the band collapses to zero, which passes every delta.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from './genapl-core.mjs';
import { buildRequest, dpsOf } from '../sim/simreq.mjs';
import { BENCH } from '../sim/benchmark.mjs';
import { REQUIRES_EQUIPPED, unequippedPresses } from '../sim/planspec.mjs';
import { loadEngine, ALL_BUFFS } from './engine-node.mjs';
import { REF, plainCastInPage } from './reference-gear.mjs';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const die = m => { console.error('ERROR: ' + m); process.exit(2); };
const argv = process.argv.slice(2);
const arg = (k, d) => { const i = argv.indexOf('--' + k); return i >= 0 && argv[i + 1] !== undefined ? argv[i + 1] : d; };
const has = k => argv.includes('--' + k);

const api = loadEngine(path.join(REPO, 'index.html'));
const PLAIN = new Function('GAME', 'R', `return (${plainCastInPage.toString()})(R);`)(api.GAME, REF);

// ── inputs: either a table cell, or two explicit specs ────────────────────────────────────────────
let specA, specB, T, KIT, simHaste, label;
const tablePath = arg('table');
if (tablePath) {
  if (!fs.existsSync(tablePath)) die(`no such table: ${tablePath}`);
  const txt = fs.readFileSync(tablePath, 'utf8');
  const done = txt.match(/^XVAL-DONE .*/m);
  if (!done) die(`${tablePath} has no XVAL-DONE line`);
  const kv = Object.fromEntries([...done[0].matchAll(/(\w+)=(\S+)/g)].map(x => [x[1], x[2]]));
  T = +kv.T; KIT = (kv.kit || '').replace('+', ',');
  simHaste = +arg('sim-haste', NaN);
  const rival = +arg('rival', NaN);
  if (!Number.isFinite(simHaste) || !Number.isFinite(rival)) die('--table needs --sim-haste and --rival');
  const specs = {};
  for (const m of txt.matchAll(/plan@h(\d+): eff=([\d.]+)\s+(\{.*\})/g)) specs[+m[1]] = JSON.parse(m[3]);
  if (!specs[simHaste]) die(`no plan@h${simHaste} in the table`);
  if (!specs[rival]) die(`no plan@h${rival} in the table`);
  specA = specs[simHaste]; specB = specs[rival];
  label = `${path.basename(tablePath)} @sim${simHaste}: native plan@${simHaste} → rival plan@${rival}`;
} else {
  specA = JSON.parse(arg('spec-a') || die('need --table or --spec-a/--spec-b'));
  specB = JSON.parse(arg('spec-b') || die('need --spec-b'));
  T = +arg('T', 0) || die('need --T');
  simHaste = +arg('sim-haste', 0);
  KIT = arg('kit') || die('need --kit a,b');
  label = `explicit pair @haste ${simHaste}`;
}

const ITER = +arg('iter', 6000);
const SEEDS = arg('seeds', BENCH.seeds.slice(0, 3).join(',')).split(',').map(Number);
const sorted = [...SEEDS].sort((a, b) => a - b);
if (SEEDS.length > 1) {
  const gap = Math.min(...sorted.slice(1).map((s, i) => s - sorted[i]));
  if (gap < ITER) die(`seed spacing ${gap} < iterations ${ITER} — the runs would share draws and the band would collapse (BENCH §3c.3).`);
}

// ── the character ────────────────────────────────────────────────────────────────────────────────
const byTrinket = Object.fromEntries(Object.values(REQUIRES_EQUIPPED).map(v => [v.trinket, v]));
const TEMPLATE = JSON.parse(fs.readFileSync(path.join(REPO, 'tools/bench/export-request.json'), 'utf8'));
{
  const pair = KIT.split(',').map(x => x.trim());
  if (pair.length !== 2 || pair.some(k => !byTrinket[k])) die(`--kit must be two of ${Object.keys(byTrinket).join(',')}`);
  const items = TEMPLATE.raid.parties[0].players[0].equipment.items;
  while (items.length < 14) items.push({ id: 0, randomSuffix: 0, enchant: 0, gems: [] });
  items[12] = { id: byTrinket[pair[0]].item, randomSuffix: 0, enchant: 0, gems: [] };
  items[13] = { id: byTrinket[pair[1]].item, randomSuffix: 0, enchant: 0, gems: [] };
}
const EQUIPPED = TEMPLATE.raid.parties[0].players[0].equipment.items.map(i => i && i.id).filter(Boolean);
for (const [n, s] of [['A', specA], ['B', specB]]) {
  const dead = unequippedPresses(s, EQUIPPED);
  if (dead.length) die(`spec ${n} presses ${dead.join(', ')} which kit "${KIT}" does not equip — the walk would test a deleted track.`);
}

// ── legality, a priori (trap 1) ──────────────────────────────────────────────────────────────────
// Cooldowns come from the engine's own BUFFS table, never re-typed. Icy Veins is the one track whose
// re-press can be legal early — a Cold Snap resets it — so it is checked against the CS list.
const SPEC_TO_BUFF = { IV: 'icyVeins', AP: 'arcanePower', Zerk: 'berserking', BL: 'bloodlust',
                       Icon: 'isc', Gem: 'scb', Skull: 'skull', MQG: 'mqg' };
// ⚠⚠ THIS CHECK WAS HALF-BUILT ONCE, AND THE HALF THAT WAS MISSING PRODUCED A CONFIDENT WRONG TABLE.
// The first version checked only SAME-TRACK cooldowns and missed the SHARED trinket lockout, which
// runs ACROSS tracks: `OFF_TRINKETS = [skull, mqg, isc]` — firing one locks the other two for that
// buff's DURATION (`index.html:1001,1040`). A walk step that moved MQG to 9 s while Icon sat at 6 s
// therefore emitted a spec wowsims cannot execute: it does not error, and it does not drop the press
// either — it RETIMES it to the first legal moment, 26 s, which happened to be exactly where the
// other arm already had it. Two different specs, one execution, `Δ = +0.000` in both model and sim
// across three seeds. Read naively that says "MQG placement does not matter here"; it actually says
// "this row measured nothing". Exactly PHASE8 §17.5's rule — legality is STRUCTURAL, and drift
// magnitude is not a legality test.
function illegal(spec) {
  const bad = [];
  for (const [k, bk] of Object.entries(SPEC_TO_BUFF)) {
    const ts = (spec[k] || []).slice().sort((a, b) => a - b);
    const cd = (api.BUFFS[bk] || {}).cd;
    if (!cd) continue;
    for (let i = 1; i < ts.length; i++) {
      const gap = ts[i] - ts[i - 1];
      if (gap >= cd - 1e-6) continue;
      if (k === 'IV' && (spec.CS || []).some(c => Math.abs(c - ts[i]) < 1e-6)) continue;  // Cold Snap reset
      bad.push(`${k} ${ts[i - 1]}→${ts[i]} (gap ${gap}s < cd ${cd}s)`);
    }
  }
  // the shared offensive-trinket lockout, across tracks
  const OFF = ['skull', 'mqg', 'isc'];                       // index.html:835 — scb is NOT one of these
  const specOf = Object.fromEntries(Object.entries(SPEC_TO_BUFF).map(([sk, bk]) => [bk, sk]));
  const presses = [];
  for (const bk of OFF) {
    const sk = specOf[bk];
    for (const t of (spec[sk] || [])) presses.push({ t, sk, dur: (api.BUFFS[bk] || {}).dur || 0 });
  }
  presses.sort((a, b) => a.t - b.t);
  for (let i = 1; i < presses.length; i++) {
    const p = presses[i - 1], q = presses[i];
    if (q.t < p.t + p.dur - 1e-6)
      bad.push(`${q.sk}@${q.t} inside ${p.sk}@${p.t}'s ${p.dur}s trinket lockout (shared: ${OFF.join('/')})`);
  }
  return bad;
}

// ── the model side (sim-free) ────────────────────────────────────────────────────────────────────
// Score a genapl spec with the engine by turning it back into a schedule. `fixed` pins every press,
// so `simulate` evaluates exactly this layout rather than re-optimising it.
const kitKeys = KIT.split(',').map(x => x.trim());
const enabled = {}; for (const k of ALL_BUFFS) enabled[k] = ['icyVeins', 'arcanePower', 'berserking', 'bloodlust', ...kitKeys].includes(k);
function modelScore(spec) {
  const s = {};
  for (const [k, bk] of Object.entries(SPEC_TO_BUFF)) if ((spec[k] || []).length) s[bk] = spec[k].slice();
  const cfg = { T, hasteRating: simHaste, ...REF, enabled, fixed: {}, warnings: [], coldSnap: true, segments: null };
  return api.simulate(s, cfg).robust / PLAIN;
}

// ── the sim side ─────────────────────────────────────────────────────────────────────────────────
globalThis.wasmready = () => {};
await import(path.join(REPO, 'sim/wasm_exec.js'));
const go = new globalThis.Go();
const { instance } = await WebAssembly.instantiate(fs.readFileSync(path.join(REPO, 'sim/sim.wasm')), go.importObject);
go.run(instance);
const simOne = (spec, seed) => {
  const req = buildRequest(TEMPLATE, { sp: 0, critPct: 0, hasteRating: simHaste, T, iterations: ITER,
    seed, variation: BENCH.variation, targets: 0, apl: build(spec) });
  const out = JSON.parse(globalThis.raidSimJson(JSON.stringify(req)));
  if (out && out.errorResult) die('sim error: ' + out.errorResult);
  const d = dpsOf(out);
  if (!d || !Number.isFinite(d.avg)) die('sim returned no DPS');
  return d.avg;
};
const simMean = spec => SEEDS.map(s => simOne(spec, s));

// ── the walk ─────────────────────────────────────────────────────────────────────────────────────
// One track at a time, A→B and B→A. Reporting BOTH directions is what makes an interaction visible:
// a term that carries the gap in one direction and not the other is context-dependent, not additive.
const TRACKS = ['BL', 'AP', 'Zerk', 'Icon', 'Gem', 'Skull', 'MQG', 'IV+CS'];
const swap = (from, to, track) => {
  const out = JSON.parse(JSON.stringify(from));
  const keys = track === 'IV+CS' ? ['IV', 'CS'] : [track];   // a CS is meaningless without its IV
  for (const k of keys) { if (to[k] === undefined) delete out[k]; else out[k] = to[k].slice(); }
  return out;
};
const differs = t => {
  const keys = t === 'IV+CS' ? ['IV', 'CS'] : [t];
  return keys.some(k => JSON.stringify(specA[k]) !== JSON.stringify(specB[k]));
};
const live = TRACKS.filter(differs);

const mean = xs => xs.reduce((s, x) => s + x, 0) / xs.length;
const sd = xs => xs.length < 2 ? 0 : Math.sqrt(xs.reduce((s, x) => s + (x - mean(xs)) ** 2, 0) / (xs.length - 1));

console.log(`\n# Minimal-pair walk — ${label}`);
console.log(`  T=${T}s · kit=${KIT} · sim-haste=${simHaste} · ITER=${ITER} · seeds ${SEEDS.join(',')} · var ${BENCH.variation}`);
console.log(`  native  ${JSON.stringify(specA)}`);
console.log(`  rival   ${JSON.stringify(specB)}`);
console.log(`  tracks that differ: ${live.join(', ')}${live.length ? '' : ' (none — the specs are identical)'}\n`);

const baseA = simMean(specA), baseB = simMean(specB);
const mA = modelScore(specA), mB = modelScore(specB);
const dSimWhole = mean(baseB) - mean(baseA);
const pairWhole = baseB.map((v, i) => v - baseA[i]);
console.log(`  WHOLE PAIR   sim ${dSimWhole >= 0 ? '+' : ''}${dSimWhole.toFixed(2)} DPS (${(100 * dSimWhole / mean(baseA)).toFixed(3)}%) ± ${sd(pairWhole).toFixed(2)}` +
            `   ·   model ${(mB - mA >= 0 ? '+' : '')}${(mB - mA).toFixed(3)} eff casts (${(100 * (mB - mA) / mA).toFixed(3)}%)`);
console.log(`  ${Math.sign(dSimWhole) === Math.sign(mB - mA) ? 'model and sim AGREE on the whole pair' : '⚠ MODEL AND SIM DISAGREE on the whole pair — that is the defect this walk localises'}\n`);

console.log('| move | dir | model Δ% | sim Δ% | ± | verdict |');
console.log('|---|---|---|---|---|---|');
const rows = [];
for (const t of live) {
  for (const [dir, from, to, mFrom] of [['A→B', specA, specB, mA], ['B→A', specB, specA, mB]]) {
    const cand = swap(from, to, t);
    const bad = illegal(cand);
    if (bad.length) { console.log(`| ${t} | ${dir} | — | — | — | ⚠ ILLEGAL, skipped: ${bad.join('; ')} |`); continue; }
    const m = modelScore(cand);
    const per = simMean(cand);
    const baseSim = dir === 'A→B' ? baseA : baseB;
    const pair = per.map((v, i) => v - baseSim[i]);
    const dSim = 100 * mean(pair) / mean(baseSim);
    const dMod = 100 * (m - mFrom) / mFrom;
    const agree = Math.sign(dSim) === Math.sign(dMod) || Math.abs(dSim) < 1e-9;
    rows.push({ track: t, dir, dMod, dSim, sd: 100 * sd(pair) / mean(baseSim) });
    console.log(`| ${t} | ${dir} | ${dMod >= 0 ? '+' : ''}${dMod.toFixed(3)} | ${dSim >= 0 ? '+' : ''}${dSim.toFixed(3)} | ${(100 * sd(pair) / mean(baseSim)).toFixed(3)} | ${agree ? 'agree' : '**⚠ SIGN DISAGREEMENT**'} |`);
  }
}
// The move that carries the gap: largest |sim Δ| in the A→B direction, and whether the model saw it.
const ab = rows.filter(r => r.dir === 'A→B').sort((a, b) => Math.abs(b.dSim) - Math.abs(a.dSim));
if (ab.length) {
  const top = ab[0];
  console.log(`\n★ Largest single-track move A→B: **${top.track}**, sim ${top.dSim >= 0 ? '+' : ''}${top.dSim.toFixed(3)}% vs model ${top.dMod >= 0 ? '+' : ''}${top.dMod.toFixed(3)}%` +
              ` — ${Math.sign(top.dSim) === Math.sign(top.dMod) ? 'the model sees this one' : '**the model has the SIGN WRONG here**'}`);
  const sumSim = ab.reduce((s, r) => s + r.dSim, 0);
  console.log(`  additivity check: single-track sim moves sum to ${sumSim >= 0 ? '+' : ''}${sumSim.toFixed(3)}% against a whole-pair ${(100 * dSimWhole / mean(baseA)).toFixed(3)}%` +
              ` — ${Math.abs(sumSim - 100 * dSimWhole / mean(baseA)) < 0.05 ? 'ADDITIVE, so the tracks can be read independently' : '⚠ NOT additive: the tracks INTERACT, so no single move "is" the gap'}`);
}
if (has('json')) console.log('\n' + JSON.stringify({ label, T, KIT, simHaste, specA, specB, rows }, null, 1));
process.exit(0);
