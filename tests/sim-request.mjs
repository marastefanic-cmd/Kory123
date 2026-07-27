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
import { BENCH, runnerFlags, killWindow, encounterFor } from '../sim/benchmark.mjs';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const EXPORT = path.join(REPO, 'sim/model-ref.json');
const TEMPLATE_PATH = path.join(REPO, 'sim/model-ref-request.json');
// Every committed character/template PAIR is gated the same way: a template is a generated artifact,
// and a generated artifact that nothing regenerates is a stale artifact waiting to happen.
const CHARACTERS = [
  { name: 'model-ref (website + tools/bench.mjs --char model-ref)', export: EXPORT, template: TEMPLATE_PATH },
  { name: 'bench gear-B (tools/bench.mjs default, BENCH.md)',
    export: path.join(REPO, 'tools/bench/export.json'),
    template: path.join(REPO, 'tools/bench/export-request.json') },
];
const RUNNER = process.env.RUNNER;
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
  // ⛔ A DUPLICATE KEY IN `BENCH` IS SILENT AND THIS FILE IS THE ONLY PLACE THAT CAN SEE IT.
  // `hasteRatingPerPct` was declared twice — once in the GAME.AB mirror block (15.77) and again in
  // the wowsims rating conversions (15.76923). JS keeps the LAST one, so the first was dead from the
  // moment it was written, and `killWindow()` silently used wowsims' divisor where the comment said
  // the model's. It happened not to matter (0.005 %, 6 µs of window at 400 rating) — which is exactly
  // why nothing caught it. Parse the source: the evaluated object cannot report a key it never kept.
  {
    const src = fs.readFileSync(path.join(REPO, 'sim/benchmark.mjs'), 'utf8');
    const body = src.slice(src.indexOf('export const BENCH'), src.indexOf('export function'));
    const keys = [...body.matchAll(/^ {2}([A-Za-z_$][\w$]*):/gm)].map(m => m[1]);
    const dup = [...new Set(keys.filter((k, i) => keys.indexOf(k) !== i))];
    if (dup.length) bad.push(`sim/benchmark.mjs declares ${dup.map(d => `\`${d}\``).join(', ')} more than once. ` +
      'JS keeps the last, so the earlier one is dead code that reads as a decision — and the protocol ' +
      'is meant to be defined exactly once.');
  }
  // ★ THE WINDOW IS DERIVED NOW, NOT PINNED (2026-07-27). `BENCH.variation` survives only as the
  // legacy flat default; the live protocol is `killWindow(haste)` + `encounterFor(T, haste)`, which
  // reproduce the MODEL's one-sided window `U[T, T+d]` with `d` the terminal cast's own duration.
  // So the thing worth asserting is no longer a magic number — it is the DERIVATION:
  //   · the width must be positive and must SHRINK with haste (a faster terminal cast = a narrower
  //     window). A width that ignores haste is the bug the flat 0.5 was.
  //   · `encounterFor` must produce exactly `U[T, T+2w]`, i.e. the interval must START at T. Setting
  //     `variation` without re-centring `duration` silently lengthens the average fight, which is the
  //     one mistake this construction exists to prevent.
  // Measured: the derived window tracks the model across a cast boundary 7.8-8.8x more tightly than
  // the flat one (ratio spread 0.0208 % vs 0.1627 % on the current engine, tools/window-match.mjs).
  { const w0 = killWindow(0), w250 = killWindow(250);
    if (!(w0 > 0)) bad.push(`killWindow(0) must be positive, got ${w0}`);
    if (!(w250 < w0)) bad.push(`killWindow must SHRINK with haste: killWindow(250)=${w250} is not < killWindow(0)=${w0} — a width that ignores gear is exactly the flat-0.5 defect.`);
    if (Math.abs(w0 - 0.749) > 5e-4) bad.push(`killWindow(0) is ${w0}, expected ~0.749 = half a 3-stack Arcane Blast (2.5 - 3x0.334) at zero haste.`);
    const e = encounterFor(200, 150);
    if (Math.abs((e.duration - e.durationVariation) - 200) > 1e-9)
      bad.push(`encounterFor must yield U[T, T+2w]: the interval starts at ${(e.duration - e.durationVariation)}, not at T=200. Setting variation without re-centring duration lengthens every fight.`);
  }
  if (BENCH.variation === 0) bad.push('BENCH.variation must NOT be 0 — `--var 0` makes every iteration the same fight, turning DPS into a staircase of whole casts. It has faked a result twice (TOOLING ★★). It is the legacy default now, but it must stay non-zero for the callers that still pass it.');
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

// ── the RUNNER gate — AFTER §0, deliberately (PHASE11 §1.1 B8) ────────────────────────────────────
// This used to sit at the top of the file, above §0. But §0 imports only `BENCH` and needs no rig at
// all, so gating it on RUNNER meant that in every runner-less environment — which is most of them,
// and all of CI — even the always-runnable assertions never ran, and the file exited 0 having
// checked nothing. "Skips loudly rather than passing quietly" was true of the message and false of
// the coverage. §0 now always runs; only §1/§2, which genuinely shell out to the rig, are gated.
if (!RUNNER || !fs.existsSync(RUNNER)) {
  if (failures) {
    console.error(`\n${failures} protocol invariant check(s) FAILED (these need no runner).`);
    process.exit(1);
  }
  console.log('\nSKIPPED §1+§2 — set RUNNER=/path/to/runner to check the page request against the native rig.');
  console.log('          (sim/build-wasm.sh is wasm-only; see docs/TOOLING.md "Building the runner")');
  console.log('          §0 above DID run — it needs no rig.');
  process.exit(0);
}

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'simreq-'));
const template = JSON.parse(fs.readFileSync(TEMPLATE_PATH, 'utf8'));

// ── 1. template freshness, for every committed character ─────────────────────────────────────────
for (const ch of CHARACTERS) {
  if (!fs.existsSync(ch.template)) { failures++; console.error(`FAIL  ${ch.name}: ${path.relative(REPO, ch.template)} is missing`); continue; }
  const tpl = JSON.parse(fs.readFileSync(ch.template, 'utf8'));
  const dump = path.join(tmp, 'fresh.json');
  execFileSync(RUNNER, ['--export', ch.export, '--dur', String(tpl.encounter.duration),
    '--var', String(tpl.encounter.durationVariation), '--iter', String(tpl.simOptions.iterations),
    '--seed', String(tpl.simOptions.randomSeed), '--dumpreq', dump, '--tag', 't', '--quiet'],
    { encoding: 'utf8', stdio: ['ignore', 'ignore', 'ignore'] });
  const fresh = JSON.parse(fs.readFileSync(dump, 'utf8'));
  const d = diff(normalize(fresh), normalize(tpl));
  if (d.length) {
    failures++;
    console.error(`FAIL  ${ch.name}: ${path.relative(REPO, ch.template)} is STALE — regenerate it:`);
    console.error(`      runner --export ${path.relative(REPO, ch.export)} --dur ${tpl.encounter.duration} --var ${tpl.encounter.durationVariation} --iter ${tpl.simOptions.iterations} --seed ${tpl.simOptions.randomSeed} --dumpreq ${path.relative(REPO, ch.template)} --quiet`);
    for (const line of d.slice(0, 12)) console.error('        ' + line);
  } else {
    console.log(`PASS  ${ch.name}: template is a fresh --dumpreq of its export`);
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
