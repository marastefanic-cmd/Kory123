// THE ANTI-DRIFT GATE for the in-page benchmark sim.
//
// The whole claim behind the "Verify in the benchmark sim" button is that the page runs *the same
// benchmark the terminal runs*. Sharing modules makes that likely; this makes it CHECKED. It asserts,
// for a matrix of real duel inputs:
//
//   1. TEMPLATE FRESHNESS — regenerating `sim/model-ref-request.json` from `sim/model-ref.json` with
//      the native runner reproduces the committed file. (Catches: someone edits the character export
//      and forgets the template, or vice versa.)
//   2. REQUEST EQUALITY — the request `sim/simreq.mjs` builds in the PAGE equals, field for field, the
//      request the NATIVE runner builds from the same inputs via `--dumpreq`. (Catches: a protocol
//      constant, a stat index, an encounter override, or an APL that drifted on one side only.)
//
// Requires the native rig: RUNNER=/path/to/runner. Without it the test SKIPS LOUDLY (exit 0 with a
// message) rather than passing quietly — a gate that silently no-ops is worse than no gate.
//
//   RUNNER=/path/to/runner node tests/sim-request.mjs
import fs from 'fs';
import path from 'path';
import os from 'os';
import { fileURLToPath } from 'url';
import { execFileSync } from 'child_process';
import { build } from '../tools/genapl-core.mjs';
import { buildRequest } from '../sim/simreq.mjs';
import { BENCH, runnerFlags } from '../sim/benchmark.mjs';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const EXPORT = path.join(REPO, 'sim/model-ref.json');
const TEMPLATE_PATH = path.join(REPO, 'sim/model-ref-request.json');
const RUNNER = process.env.RUNNER;

if (!RUNNER || !fs.existsSync(RUNNER)) {
  console.log('SKIPPED — set RUNNER=/path/to/runner to check the page request against the native rig.');
  console.log('          (build one with: bash sim/build-wasm.sh is wasm-only; see docs/TOOLING.md "Building the runner")');
  process.exit(0);
}

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'simreq-'));
const template = JSON.parse(fs.readFileSync(TEMPLATE_PATH, 'utf8'));
let failures = 0;

// Fields a duel legitimately varies per run, plus request-identity noise the runner stamps.
// Everything else must match exactly.
const normalize = (req) => {
  const r = JSON.parse(JSON.stringify(req));
  delete r.requestId;
  return r;
};
// SEMANTIC equality, not textual. The runner dumps with protojson `EmitUnpopulated: true`, so it
// spells out every default field (`hide: false`, `notes: ""`, `rank: 0`, `condition: null`, `[]`),
// while the APL the page hands in simply omits them — and in protobuf an absent field and its default
// ARE the same message. So a field present on one side and missing on the other is equal ONLY when
// the present value is that type's default. `iterations: 10000` vs missing is still a FAILURE; that
// asymmetry is the whole point, and it is why this is not written as "ignore missing keys".
const isProtoDefault = v => v === false || v === '' || v === 0 || v === null ||
                            (Array.isArray(v) && v.length === 0);
const diff = (a, b, p = '', out = []) => {
  if (a === undefined || b === undefined) {
    const present = a === undefined ? b : a;
    if (!isProtoDefault(present)) out.push(`${p}: ${JSON.stringify(a)} vs ${JSON.stringify(b)}  [present on one side only, and not a proto default]`);
    return out;
  }
  if (typeof a !== typeof b || (a === null) !== (b === null)) { out.push(`${p}: ${JSON.stringify(a)} vs ${JSON.stringify(b)}`); return out; }
  if (a && typeof a === 'object') {
    if (Array.isArray(a) !== Array.isArray(b)) { out.push(`${p}: array vs object`); return out; }
    const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
    for (const k of keys) diff(a[k], b[k], p ? `${p}.${k}` : k, out);
  } else if (a !== b) {
    // protojson stringifies int64 (`randomSeed`) and emits doubles at full precision — compare
    // numerically whenever both sides parse as numbers, textually otherwise.
    const na = Number(a), nb = Number(b);
    const numeric = a !== '' && b !== '' && Number.isFinite(na) && Number.isFinite(nb);
    if (!(numeric && Math.abs(na - nb) < 1e-9)) out.push(`${p}: ${JSON.stringify(a)} vs ${JSON.stringify(b)}`);
  }
  return out;
};

// ── 0. protocol INVARIANTS ────────────────────────────────────────────────────────────────────────
// Sharing one constant makes the two sides AGREE; it cannot make the shared value CORRECT. A typo in
// `BENCH` propagates to both paths and check 2 would happily pass it. These assert the values
// themselves against the decisions TOOLING/RULES record — the load-bearing ones, each with the reason
// it is load-bearing, so a future edit has to argue with a sentence rather than a bare number.
{
  const bad = [];
  if (BENCH.variation === 0) bad.push('variation must NOT be 0 — `--var 0` makes every iteration the same fight, turning DPS into a staircase of whole casts. It has faked a result twice (TOOLING ★★).');
  if (BENCH.variation !== 0.5) bad.push(`variation is ${BENCH.variation}, expected 0.5 — the model's kill-window WIDTH (RULES §8). Changing it re-prices every duel; do it deliberately and update TOOLING.`);
  if (BENCH.prestack !== 0) bad.push('prestack must be 0 — the model opens COLD, and a prepull sits at a fixed −2.3s that does not scale with haste, making any haste comparison non-monotone (TOOLING ★★★).');
  if (!(BENCH.manaInject >= 1e7)) bad.push('manaInject is too small to be "infinite" — the duel must isolate the LAYOUT, not mana.');
  if (BENCH.iterations < 10000) bad.push(`iterations is ${BENCH.iterations} — the mean settles to ~0.02% at 10k; below that a duel cannot resolve the differences this project argues about (TOOLING).`);
  if (BENCH.tieBandPct <= 0) bad.push('tieBandPct must be > 0 — without a "too close to call" band the UI reports noise as a winner.');
  const gaps = BENCH.seeds.slice(1).map((x, i) => x - BENCH.seeds[i]);
  if (gaps.some(g => g < BENCH.iterations)) bad.push(`base seeds are spaced ${Math.min(...gaps)} apart but iterations is ${BENCH.iterations} — runs closer than that SHARE iterations, so the multi-seed band collapses toward 0 and passes every delta.`);
  if (BENCH.hitCapPct !== 16) bad.push('hitCapPct should be 16 — vs a level-73 target the base spell miss is 17% and 16% hit removes all but the 1% irreducible floor.');
  if (bad.length) {
    failures++;
    console.error('FAIL  benchmark protocol invariants:');
    for (const m of bad) console.error('        - ' + m);
  } else {
    console.log('PASS  benchmark protocol invariants (var≠0, cold open, infinite mana, seed spacing, hit cap)');
  }
}

// ── 1. template freshness ─────────────────────────────────────────────────────────────────────────
{
  const dump = path.join(tmp, 'fresh.json');
  execFileSync(RUNNER, ['--export', EXPORT, '--dur', String(template.encounter.duration),
    '--var', String(template.encounter.durationVariation), '--iter', String(template.simOptions.iterations),
    '--seed', String(template.simOptions.randomSeed), '--dumpreq', dump, '--tag', 't', '--quiet'],
    { encoding: 'utf8', stdio: ['ignore', 'ignore', 'ignore'] });
  const fresh = JSON.parse(fs.readFileSync(dump, 'utf8'));
  const d = diff(normalize(fresh), normalize(template));
  if (d.length) {
    failures++;
    console.error('FAIL  model-ref-request.json is STALE — regenerate it from model-ref.json:');
    console.error(`      ${path.basename(RUNNER)} --export sim/model-ref.json --dur ${template.encounter.duration} --var ${template.encounter.durationVariation} --iter ${template.simOptions.iterations} --seed ${template.simOptions.randomSeed} --dumpreq sim/model-ref-request.json --quiet`);
    for (const line of d.slice(0, 12)) console.error('        ' + line);
  } else {
    console.log('PASS  template matches the runner\'s own --dumpreq for the committed character');
  }
}

// ── 2. page request == native request, across a matrix of duel inputs ────────────────────────────
const CASES = [
  { name: 'plain 5:00',        sp: 1150, critPct: 25,   hasteRating: 0,   T: 300, spec: { _prestack: 0, IV: [0], AP: [4], Icon: [0], BL: [5] } },
  { name: 'geared 2:40',       sp: 1450, critPct: 38,   hasteRating: 200, T: 160, spec: { _prestack: 0, IV: [7], AP: [7], Gem: [7], Skull: [7], BL: [5], Zerk: [50] } },
  { name: 'cold snap 7:20',    sp: 1150, critPct: 25,   hasteRating: 100, T: 440, spec: { _prestack: 0, IV: [0, 180, 200], CS: [200], AP: [0], BL: [260] } },
  { name: 'intermission',      sp: 1150, critPct: 25,   hasteRating: 0,   T: 200, spec: { _prestack: 0, IV: [0], AP: [0], BL: [5], _intermissions: [[90, 130]] } },
  { name: 'aoe 4 targets',     sp: 1150, critPct: 25,   hasteRating: 0,   T: 200, targets: 4, spec: { _prestack: 0, IV: [0], AP: [0], BL: [5], _aoe: [[60, 90]] } },
  { name: 'odd stats',         sp: 1337, critPct: 31.5, hasteRating: 37,  T: 95,  spec: { _prestack: 0, IV: [10], MQG: [10], BL: [10] } },
];

for (const c of CASES) {
  const apl = build(c.spec);
  const aplPath = path.join(tmp, 'case.apl.json');
  fs.writeFileSync(aplPath, JSON.stringify(apl, null, 1));

  // native: let the runner build the request from the same export + the same APL + BENCH's flags
  const dump = path.join(tmp, 'case.req.json');
  execFileSync(RUNNER, [...runnerFlags({
    export: EXPORT, apl: aplPath, T: c.T, sp: c.sp, critPct: c.critPct,
    hasteRating: c.hasteRating, targets: c.targets, tag: 'case',
  }), '--dumpreq', dump], { encoding: 'utf8', stdio: ['ignore', 'ignore', 'ignore'] });
  const native = JSON.parse(fs.readFileSync(dump, 'utf8'));

  // page: the module the browser runs
  const page = buildRequest(template, {
    sp: c.sp, critPct: c.critPct, hasteRating: c.hasteRating, T: c.T,
    targets: c.targets, iterations: BENCH.iterations, seed: BENCH.seed, apl,
  });

  const d = diff(normalize(native), normalize(page));
  if (d.length) {
    failures++;
    console.error(`FAIL  ${c.name}: the page's request differs from the runner's`);
    for (const line of d.slice(0, 12)) console.error('        ' + line);
    if (d.length > 12) console.error(`        …and ${d.length - 12} more`);
  } else {
    console.log(`PASS  ${c.name}: page request === native runner request`);
  }
}

fs.rmSync(tmp, { recursive: true, force: true });
if (failures) {
  console.error(`\n${failures} check(s) FAILED — the in-page benchmark is no longer the terminal benchmark.`);
  process.exit(1);
}
console.log('\nAll good: the page and the terminal build the identical benchmark request.');
