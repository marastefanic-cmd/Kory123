// THE BENCH — `docs/BENCH.md`'s design, implemented, and runnable from the repo alone.
//
//   node tools/bench.mjs --preset "5:00 lust 0:05"            value of the model's plan
//   node tools/bench.mjs --preset "5:00 lust 0:05" --vs naive  model plan vs mash-on-cooldown
//   node tools/bench.mjs --preset X --char model-ref           on the UI's gear-agnostic character
//   node tools/bench.mjs --spec-a '{"IV":[0],…}' --spec-b '…' --T 300 --haste 0
//     [--seeds 11,100011,200011] [--iter 10000] [--var 0.5] [--no-control] [--json] [--list]
//
// ★★ ZERO SETUP. It runs `sim/sim.wasm` — committed, patched (`ap-cd-at-cast` +
// `apl-schedule-strict-ready` @ `ade9f39`) — so there is no clone, no protoc, no `go build`, no
// scratchpad probe, and no `RUNNER`/`EXPORT_BASE` to resolve. That is BENCH.md §5's standing
// requirement ("a fresh container must be able to produce a number from the repo alone") in its
// strong form. `tests/sim-duel.mjs` asserts the shipped wasm equals the native runner to the printed
// decimal, so nothing is given up by not building one.
//
// ★★ IT IS THE SAME BACKBONE AS THE WEBSITE'S BUTTON. Protocol from `sim/benchmark.mjs`,
// transcription from `sim/planspec.mjs`, APL from `tools/genapl-core.mjs`, request from
// `sim/simreq.mjs`, engine from `sim/sim.wasm`. Change one of those and BOTH the agent tool and the
// user-facing verification change together — which is the entire point (`tests/sim-request.mjs`
// asserts the two build identical requests).
//
// ── WHAT IT MEASURES (BENCH.md §2.1, difference-in-differences) ───────────────────────────────────
// For each arm it sims the same character TWICE — with the planned presses, and with a **never-press**
// control — and reports
//
//     value(arm) = DPS(arm, presses) − DPS(arm, no presses)
//
// so every passive (trinket stats, gems, enchants, buffs, set bonuses) appears in both terms and
// cancels EXACTLY. What survives is only what the actives did. ⚠ The control is *never-press*, not
// "press at 0" — a press at 0 is still a press and still perturbs the cast lattice.
// `--no-control` drops it (raw DPS, 2× faster, only valid when both arms wear identical passives).
//
// ── THE TWO CHARACTERS, AND WHY THERE ARE TWO ────────────────────────────────────────────────────
//   --char bench      `tools/bench/export.json`  — BENCH.md's FROZEN gear-B raid setup. Real gear,
//                     real raid buffs: it sets the OPERATING POINT (the SP/crit/haste at which a
//                     layout is optimal), which is what a model-vs-sim campaign must hold fixed.
//   --char model-ref  `sim/model-ref.json`       — the synthetic, gear-less mage the website's button
//                     uses, with SP/crit/haste injected. Use it to reproduce exactly what a user sees.
// They answer different questions and must stay free to differ; what they share is the protocol.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from './genapl-core.mjs';
import { planToSpec } from '../sim/planspec.mjs';
import { buildRequest, dpsOf } from '../sim/simreq.mjs';
import { BENCH } from '../sim/benchmark.mjs';
import { loadEngine, cfgFor, ALL_BUFFS } from './engine-node.mjs';
import { REF } from './reference-gear.mjs';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const die = m => { console.error('BENCH ERROR: ' + m); process.exit(2); };

const argv = process.argv.slice(2);
const has = k => argv.includes('--' + k);
const arg = (k, d) => { const i = argv.indexOf('--' + k); return i >= 0 && argv[i + 1] !== undefined ? argv[i + 1] : d; };

// ★★ EACH CHARACTER CARRIES ITS OWN MODEL PARAMETERS, and the tool FORCES the model cfg to them.
// This is the single most bug-prone line in any model-vs-sim tool here: if the cfg the model scores
// does not describe the character the sim runs, the two numbers are about different mages and
// "agrees / disagrees" is meaningless. It has happened — PHASE8 §6/§7 found the xval harness omitting
// `t5two` and using `sp: 1387` where the export's effective SP was ≈1450, a silent 20% mis-valuation
// of the whole AB stream. `tools/reference-gear.mjs` exists for exactly this and says "SPREAD IT,
// DON'T COPY IT", so `bench` spreads REF rather than re-typing its numbers.
//   inject: true  → the sim character is gear-less, so the model's stats are injected into it
//   inject: false → the sim character already HAS its stats; injecting would double-count them,
//                   so instead the MODEL is moved to the character (…REF)
const CHARS = {
  bench:      { export: 'tools/bench/export.json',  request: 'tools/bench/export-request.json',
                note: "BENCH.md's frozen gear-B raid setup (real gear + raid buffs)",
                inject: false, model: REF },
  'model-ref':{ export: 'sim/model-ref.json',        request: 'sim/model-ref-request.json',
                note: 'the synthetic gear-less mage the website button uses (stats injected)',
                inject: true,  model: { t5two: false } },   // no gear ⇒ no set bonus, ever
};
const CHAR = arg('char', 'bench');
if (!CHARS[CHAR]) die(`--char must be one of: ${Object.keys(CHARS).join(', ')}`);
const TEMPLATE_PATH = path.join(REPO, CHARS[CHAR].request);
if (!fs.existsSync(TEMPLATE_PATH)) die(`${CHARS[CHAR].request} is missing — regenerate it with:\n` +
  `  runner --export ${CHARS[CHAR].export} --dur 300 --var ${BENCH.variation} --iter 1 --seed ${BENCH.seed} --dumpreq ${CHARS[CHAR].request} --quiet`);
const TEMPLATE = JSON.parse(fs.readFileSync(TEMPLATE_PATH, 'utf8'));

const ITER = +arg('iter', BENCH.iterations);
// ⚠ DEFAULT 0.5, NOT 0. BENCH.md §3's RNG table lists `--var 0` as "standard for gates"; TOOLING ★★
// says `--var 0` quantizes DPS to (integer casts × avg damage)/T and has faked a result twice. The
// difference of two staircases is still a staircase, so §2.1's control does NOT rescue it. Default
// follows TOOLING and matches the website's button; pass `--var 0` deliberately if you want the
// count-preserving read, and confirm anything it says at 0.5 (TOOLING).
const VAR = arg('var') === undefined ? BENCH.variation : +arg('var');
const SEEDS = arg('seeds', String(BENCH.seed)).split(',').map(Number);
if (SEEDS.some(s => !Number.isFinite(s))) die('--seeds must be comma-separated integers');
const CONTROL = !has('no-control');
const JSONOUT = has('json');

// ── the sim (committed wasm, no native rig) ──────────────────────────────────────────────────────
async function loadSim() {
  globalThis.wasmready = () => {};
  await import(path.join(REPO, 'sim/wasm_exec.js'));
  const go = new globalThis.Go();
  const { instance } = await WebAssembly.instantiate(fs.readFileSync(path.join(REPO, 'sim/sim.wasm')), go.importObject);
  go.run(instance);
  if (typeof globalThis.raidSimJson !== 'function') die('sim.wasm did not expose raidSimJson — rebuild with sim/build-wasm.sh');
  return req => {
    const out = JSON.parse(globalThis.raidSimJson(JSON.stringify(req)));
    if (out && out.errorResult) die('sim returned an error: ' + out.errorResult);
    const d = dpsOf(out);
    if (!d || !Number.isFinite(d.avg)) die('sim returned no DPS — a NaN here would slide through every comparison as "not a regression"');
    return d.avg;
  };
}

// ── the model ────────────────────────────────────────────────────────────────────────────────────
const api = loadEngine(path.join(REPO, 'index.html'));
const PRESETS = api.cases;
if (has('list')) {
  console.log('presets (BOSS_PRESETS + GOLDEN_PRESETS, from index.html):');
  for (const c of PRESETS) console.log('  ' + c.name);
  process.exit(0);
}

// Build the arms. Either a preset (the model solves it) or explicit specs.
const specA = arg('spec-a'), specB = arg('spec-b');
let arms, cfg, targets = 0;

if (specA) {
  const T = +arg('T', 0);
  if (!T) die('--spec-a needs --T <seconds>');
  cfg = { T, hasteRating: +arg('haste', 0), sp: +arg('sp', 1150), critPct: +arg('crit', 25),
          enabled: {}, fixed: {}, warnings: [], coldSnap: true, segments: null, ...CHARS[CHAR].model };
  arms = [{ label: 'A', spec: JSON.parse(specA) }];
  if (specB) arms.push({ label: 'B', spec: JSON.parse(specB) });
} else {
  const name = arg('preset');
  if (!name) die('need --preset <name> (see --list) or --spec-a <json> --T <seconds>');
  const c = PRESETS.find(p => p.name === name) || PRESETS.find(p => p.name.includes(name));
  if (!c) die(`no preset matching ${JSON.stringify(name)} — see --list`);
  cfg = { ...cfgFor(api, c), ...CHARS[CHAR].model };   // ★ the model must describe the SIMMED character
  process.stderr.write(`solving "${c.name}" on the ${CHAR} character (sp ${cfg.sp}, crit ${cfg.critPct}%, T5-2pc ${cfg.t5two ? 'on' : 'off'}) …\n`);
  const best = await api.optimizeAsync(cfg, 14, () => {});
  const optR = api.simulate(best.s, cfg, true);
  const A = planToSpec({ cfg, best, optR }, api.BUFFS);
  if (A.burn) die('this preset has a Burn phase — "AB damage ×N" has no encounter knob in wowsims, so it cannot be simmed (BENCH.md/sim README).');
  targets = A.targets;
  arms = [{ label: 'model plan', spec: A.spec, model: optR, skipped: A.skipped }];

  const vs = arg('vs');
  if (vs === 'naive') {
    const nv = api.naiveSchedule(cfg);
    const nvR = api.simulate(nv, cfg, true);
    const B = planToSpec({ cfg, best: { s: nv }, optR: nvR }, api.BUFFS);
    arms.push({ label: 'mash on cooldown', spec: B.spec, model: nvR, skipped: B.skipped });
  } else if (vs) {
    arms.push({ label: 'given spec', spec: JSON.parse(vs) });
  }
}

// The never-press control: the SAME fight with no cooldown presses at all. Phase gating
// (`_intermissions` / `_aoe`) is kept — it is part of the encounter, not part of the plan.
const controlSpec = spec => {
  const c = { _prestack: BENCH.prestack };
  if (spec._intermissions) c._intermissions = spec._intermissions;
  if (spec._intermission) c._intermission = spec._intermission;
  if (spec._aoe) c._aoe = spec._aoe;
  return c;
};

const sim = await loadSim();
const INJECT = CHARS[CHAR].inject;
const req = (spec, seed) => buildRequest(TEMPLATE, {
  sp: INJECT ? cfg.sp : 0,            // a geared export already HAS its stats; injecting would
  critPct: INJECT ? cfg.critPct : 0,  // double-count them (hence `model:` moves the MODEL instead)
  hasteRating: cfg.hasteRating,       // gear haste is a planner input on both characters
  T: cfg.T, iterations: ITER, seed, variation: VAR, targets, apl: build(spec),
});

const t0 = Date.now();
const rows = [];
for (const a of arms) {
  const per = [];
  for (const seed of SEEDS) {
    const withPresses = sim(req(a.spec, seed));
    const control = CONTROL ? sim(req(controlSpec(a.spec), seed)) : 0;
    per.push({ seed, dps: withPresses, control, value: withPresses - control });
  }
  const mean = xs => xs.reduce((s, x) => s + x, 0) / xs.length;
  const sd = xs => xs.length < 2 ? 0 : Math.sqrt(xs.reduce((s, x) => s + (x - mean(xs)) ** 2, 0) / (xs.length - 1));
  rows.push({ label: a.label, per, dps: mean(per.map(p => p.dps)), control: mean(per.map(p => p.control)),
              value: mean(per.map(p => p.value)), sd: sd(per.map(p => p.value)), skipped: a.skipped || [],
              modelTotal: a.model ? a.model.total : null });
}
const wall = ((Date.now() - t0) / 1000).toFixed(1);

if (JSONOUT) {
  console.log(JSON.stringify({ char: CHAR, cfg: { T: cfg.T, hasteRating: cfg.hasteRating, sp: cfg.sp, critPct: cfg.critPct },
    protocol: { iterations: ITER, variation: VAR, seeds: SEEDS, control: CONTROL }, arms: rows, wallSeconds: +wall }, null, 2));
  process.exit(0);
}

const f = n => (n >= 0 ? '+' : '−') + Math.abs(n).toFixed(1);
console.log(`\n  character  ${CHAR} — ${CHARS[CHAR].note}`);
console.log(`  fight      ${cfg.T}s · ${cfg.hasteRating} haste rating · ${cfg.sp} SP · ${cfg.critPct}% crit · T5-2pc ${cfg.t5two ? 'on' : 'off'}` +
            (INJECT ? '  (injected into a gear-less character)' : '  (the export\'s own gear; the MODEL was moved to it — reference-gear.mjs)'));
console.log(`  protocol   ${ITER} iters · var ${VAR} · seed${SEEDS.length > 1 ? 's' : ''} ${SEEDS.join(',')} · ${CONTROL ? 'never-press control (BENCH §2.1)' : 'RAW DPS, no control'} · ${wall}s\n`);
for (const r of rows) {
  console.log(`  ${r.label}`);
  console.log(`    presses ${r.dps.toFixed(1)} DPS` + (CONTROL ? ` · control ${r.control.toFixed(1)} · value ${f(r.value)}` + (SEEDS.length > 1 ? ` ± ${r.sd.toFixed(2)}` : '') : ''));
  if (r.skipped.length) console.log(`    ⚠ not transcribable, absent from BOTH arms: ${r.skipped.join(', ')}`);
}
if (rows.length === 2) {
  const [a, b] = rows;
  const dSim = CONTROL ? a.value - b.value : a.dps - b.dps;
  const pct = 100 * dSim / (CONTROL ? Math.abs(b.value) || 1 : b.dps);
  // The band: sd of the paired per-seed difference, not of either arm (CRN makes the pair tight).
  const pairs = a.per.map((p, i) => (CONTROL ? p.value - b.per[i].value : p.dps - b.per[i].dps));
  const m = pairs.reduce((s, x) => s + x, 0) / pairs.length;
  const band = pairs.length < 2 ? null : Math.sqrt(pairs.reduce((s, x) => s + (x - m) ** 2, 0) / (pairs.length - 1));
  console.log(`\n  SIM    ${a.label} − ${b.label} = ${f(dSim)} DPS` + (band === null ? '' : ` ± ${band.toFixed(2)} (${pairs.length} seeds)`));
  if (a.modelTotal && b.modelTotal) {
    const dModel = 100 * (a.modelTotal / b.modelTotal - 1);
    console.log(`  MODEL  ${dModel >= 0 ? '+' : '−'}${Math.abs(dModel).toFixed(3)}% — ${Math.sign(dSim) === Math.sign(dModel) || Math.abs(dSim) < 1e-9 ? 'AGREES with the sim' : '⚠ DISAGREES with the sim on which side is better — that is a finding, not noise to average away'}`);
  }
  if (band !== null && Math.abs(m) < band) console.log(`  ⚠ |Δ| < 1σ of the seed band — this comparison cannot separate the two arms at ${ITER} iterations.`);
}
console.log();
// ★ `optimizeAsync`'s `breathe()` holds a MessageChannel, and the Go runtime inside sim.wasm parks on
// a channel — both keep node's event loop ref'd, so this process never exits on its own. Leave
// deliberately: a tool that HANGS after printing reads, to a caller piping through `tail`, exactly
// like a tool that is still working. (Same reason, same fix as tools/plan-sweep.mjs's child mode.)
process.exit(0);
