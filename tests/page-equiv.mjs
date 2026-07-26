// PAGE == TERMINAL, with no native rig. The gate `tests/sim-request.mjs` cannot be on a bare container.
//
//   node tests/page-equiv.mjs               # assert the page and the terminal build the same request
//   node tests/page-equiv.mjs --dps         # + sim both sides and assert identical DPS (slower)
//   node tests/page-equiv.mjs --self-test   # NEGATIVE CONTROL: seed a break, demand a failure
//
// ── WHY THIS EXISTS ──────────────────────────────────────────────────────────────────────────────
// `sim/README.md`'s central claim is that the website's "Check in the benchmark sim" button and this
// project's terminal harness are ONE code path, so a user's finding and an agent's finding are the
// same measurement. `tests/sim-request.mjs` is the gate for that claim — but its §1+§2, the halves
// that actually compare the two requests, **SKIP without a native `RUNNER`**. On a fresh container,
// in CI, and for anyone who has not installed Go + protoc, the project's most load-bearing claim is
// therefore UNEXERCISED, and its gate reports success anyway. That is precisely the silent-pass class
// PHASE11 §1 tracks (B7/B8 are the same shape).
//
// This test closes that hole using only what the repo ships. It does NOT replace sim-request: that
// one proves `module == native runner`, which needs the runner. This one proves `page == module`,
// which is the seam sim-request structurally cannot reach (PHASE11 §1.2 F5 — "the anti-drift gate
// cannot reach the page's inline glue; B1 lived exactly there").
//
// ── WHAT IS COMPARED, AND WHY IT IS THE RIGHT THING ──────────────────────────────────────────────
// Both sides run the WHOLE chain — optimizer → planToSpec → genapl → simreq — and the comparison is
// on the resulting `RaidSimRequest`, deep-equal, field for field:
//
//   page side      index.html in a real Chromium, over http (file:// blocks both the ES-module
//                  imports and the Worker), driving runSimDuel's own arm-A path
//   terminal side  tools/engine-node.mjs (the engine in bare node) + the same sim/*.mjs modules
//
// The request is the right invariant because it is the LAST point before the engine: same request +
// same `sim.wasm` + fixed seed ⇒ identical DPS, deterministically. Comparing requests is therefore
// strictly stronger than comparing DPS (it localises a divergence instead of averaging it away) and
// ~20x cheaper. `--dps` additionally runs both through the wasm for the belt-and-braces version.
//
// ⚠ The page side deliberately re-implements NOTHING. It calls the page's own `simModules()`,
// `planspec.planToSpec` and `simreq.buildRequest` — so if index.html ever drifts to a private copy
// (as `planToSpecInline` already did for the Debug export — PHASE11 §1.1 B1), this test keeps
// passing while the *page* is wrong. That is a known limit, stated so nobody mistakes it for
// coverage: it gates the BUTTON's path, which is the one users press.
//
// ── COVERAGE ────────────────────────────────────────────────────────────────────────────────────
// Two fights, chosen for the two things that have actually broken here:
//   · a plain fight            — the ordinary path
//   · Kael'thas Sunstrider     — the corpus's only AoE preset (`targets: 6`). Targets are exactly
//                                what B1 dropped, and a dropped target count is invisible in any
//                                single-target case.
import { chromium } from 'playwright-core';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadEngine, cfgFor } from '../tools/engine-node.mjs';
import { planToSpec } from '../sim/planspec.mjs';
import { buildRequest, dpsOf } from '../sim/simreq.mjs';
import { build as genaplBuild } from '../tools/genapl-core.mjs';
import { BENCH } from '../sim/benchmark.mjs';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const WANT_DPS = process.argv.includes('--dps');
const SELF_TEST = process.argv.includes('--self-test');
const INDEX = path.join(REPO, 'index.html');

// Fights to check. `name` is matched against the page's own preset tables, so the cases stay in sync
// with index.html rather than being a third copy of the fight list (PHASE11 §1.2 F3's failure mode).
const CASES = ['2:00 lust 0:05', "Kael'thas Sunstrider"];

const MIME = { '.html': 'text/html', '.mjs': 'text/javascript', '.js': 'text/javascript',
               '.json': 'application/json', '.wasm': 'application/wasm' };

function serve() {
  return new Promise(resolve => {
    const srv = http.createServer((req, res) => {
      const rel = decodeURIComponent(req.url.split('?')[0]).replace(/^\/+/, '');
      const file = path.join(REPO, rel);
      if (!file.startsWith(REPO) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
        res.writeHead(404).end('not found'); return;
      }
      res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream' });
      fs.createReadStream(file).pipe(res);
    });
    srv.listen(0, '127.0.0.1', () => resolve(srv));
  });
}

// Deep-equal that NAMES the first divergence — "requests differ" is not an actionable failure.
function firstDiff(a, b, at = '') {
  if (a === b) return null;
  if (typeof a !== typeof b) return `${at || '<root>'}: type ${typeof a} vs ${typeof b}`;
  if (a === null || b === null || typeof a !== 'object')
    return `${at || '<root>'}: ${JSON.stringify(a)} vs ${JSON.stringify(b)}`;
  if (Array.isArray(a) !== Array.isArray(b)) return `${at}: array vs object`;
  if (Array.isArray(a) && a.length !== b.length) return `${at}.length: ${a.length} vs ${b.length}`;
  for (const k of new Set([...Object.keys(a), ...Object.keys(b)])) {
    if (!(k in a)) return `${at}.${k}: missing on the page side`;
    if (!(k in b)) return `${at}.${k}: missing on the terminal side`;
    const d = firstDiff(a[k], b[k], `${at}.${k}`);
    if (d) return d;
  }
  return null;
}

// ── the terminal side ───────────────────────────────────────────────────────────────────────────
const api = loadEngine(INDEX);
const byName = Object.fromEntries(api.cases.map(c => [c.name, c]));
for (const n of CASES) if (!byName[n]) { console.error(`SETUP ERROR: preset ${JSON.stringify(n)} is not in index.html's tables`); process.exit(2); }

const TEMPLATE = JSON.parse(fs.readFileSync(path.join(REPO, 'sim/model-ref-request.json'), 'utf8'));

async function terminalSide(name) {
  const c = byName[name];
  const cfg = cfgFor(api, c);
  const best = await api.optimizeAsync(cfg, 14, () => {});
  const optR = api.simulate(best.s, cfg, true);
  const A = planToSpec({ cfg, best, optR }, api.BUFFS);
  const opts = { sp: cfg.sp, critPct: cfg.critPct, hasteRating: cfg.hasteRating, T: cfg.T,
                 iterations: BENCH.iterations, seed: BENCH.seed, targets: A.targets };
  return { spec: A.spec, targets: A.targets, request: buildRequest(TEMPLATE, { ...opts, apl: genaplBuild(A.spec) }) };
}

// ── the page side ───────────────────────────────────────────────────────────────────────────────
const PAGE_ARM = async ({ name, breakIt }) => {
  const all = [...(window.BOSS_PRESETS || []), ...(window.GOLDEN_PRESETS || [])];
  const c = all.find(x => x.name === name);
  if (!c) throw new Error('preset not found in page: ' + name);
  const d = window.GOLDEN_DEFAULTS;
  const gear = { ...d.gear, ...(c.gear || {}) };
  const kit = c.kit || d.kit;
  const ALL = ["ati","powerInfusion","drums","icyVeins","skull","isc","scb","arcanePower","berserking","mqg","bloodlust"];
  const enabled = {}; for (const k of ALL) enabled[k] = kit.includes(k);
  let segments = null;
  if (c.phases) segments = buildSegments(c.phases.map(p => ({ from: p.from, to: p.to, type: p.type, mult: p.mult || 1, targets: p.targets || 0 })), c.T);
  else if (c.intermission) segments = buildSegments([{ from: c.intermission[0], to: c.intermission[1], type: 'intermission', mult: 1, targets: 0 }], c.T);
  const cfg = { T: c.T, hasteRating: gear.haste || 0, sp: gear.sp, critPct: gear.crit, enabled,
                fixed: c.pins || {}, warnings: [], coldSnap: gear.coldSnap !== false, segments };
  const best = await optimizeAsync(cfg, 14, () => {});
  const optR = simulate(best.s, cfg, true);

  // runSimDuel's arm-A path, through the page's OWN modules.
  const { planspec, simreq, genapl, template, BENCH } = await simModules();
  const A = planspec.planToSpec({ cfg, best, optR }, BUFFS);
  const opts = { sp: cfg.sp, critPct: cfg.critPct, hasteRating: cfg.hasteRating, T: cfg.T,
                 iterations: BENCH.iterations, seed: BENCH.seed,
                 // --self-test seeds B1's exact bug: drop the AoE target count on the page side.
                 targets: breakIt ? 0 : A.targets };
  return { spec: A.spec, targets: A.targets,
           request: simreq.buildRequest(template, { ...opts, apl: genapl.build(A.spec) }) };
};

const srv = await serve();
const PORT = srv.address().port;
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM || undefined });
const page = await browser.newPage();
const pageErrs = [];
page.on('pageerror', e => pageErrs.push(String(e)));
await page.goto(`http://127.0.0.1:${PORT}/index.html`, { waitUntil: 'load' });
if (pageErrs.length) { console.error('PAGEERROR loading index.html:\n' + pageErrs.join('\n')); process.exit(2); }

let failed = 0;
for (const name of CASES) {
  // --self-test breaks the AoE case only: a single-target case cannot express a dropped target
  // count, which is itself the point B1 made.
  const breakIt = SELF_TEST && name === CASES[1];
  const [P, T] = [await page.evaluate(PAGE_ARM, { name, breakIt }), await terminalSide(name)];

  const specDiff = firstDiff(P.spec, T.spec);
  const reqDiff = firstDiff(P.request, T.request);
  const ok = !specDiff && !reqDiff;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${T.targets ? `  (targets=${T.targets})` : ''}`);
  if (specDiff) console.log(`        spec differs at    ${specDiff}`);
  if (reqDiff) console.log(`        request differs at ${reqDiff}`);
  if (!ok) failed++;

  if (WANT_DPS && ok) {
    const dT = await simDps(T.request);
    const dP = await page.evaluate(async req => {
      const { simreq } = await simModules();
      return simreq.dpsOf((await simRun(req, 0)).result).avg;
    }, P.request);
    const same = Math.abs(dT - dP) < 1e-9;
    console.log(`      ${same ? 'PASS' : 'FAIL'}  DPS page ${dP} vs terminal ${dT}`);
    if (!same) failed++;
  }
}
await browser.close();
srv.close();

if (SELF_TEST) {
  // The negative control's contract is INVERTED: a green run means the gate is blind.
  if (failed > 0) { console.log('\nSELF-TEST PASS — the seeded break (targets dropped on the AoE case) was caught.'); process.exit(0); }
  console.error('\nSELF-TEST FAIL — the seeded break was NOT caught. This gate proves nothing; fix it before trusting a green run.');
  process.exit(1);
}
if (failed) { console.error(`\n${failed} divergence(s) — the page and the terminal are NOT running the same chain.`); process.exit(1); }
console.log(`\nAll ${CASES.length} case(s) identical: page == terminal, through optimizer → planspec → genapl → simreq.`);
process.exit(0);

// wasm, only for --dps
async function simDps(request) {
  globalThis.wasmready = () => {};
  await import(path.join(REPO, 'sim/wasm_exec.js'));
  const go = new globalThis.Go();
  const { instance } = await WebAssembly.instantiate(fs.readFileSync(path.join(REPO, 'sim/sim.wasm')), go.importObject);
  go.run(instance);
  return dpsOf(JSON.parse(globalThis.raidSimJson(JSON.stringify(request)))).avg;
}
