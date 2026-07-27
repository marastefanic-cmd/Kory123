// Exact-match regression suite for the Arcane overlay planner.
//
// The optimizer is deterministic (fixed PRNG seed) and leftover haste snaps to the
// earliest efficient spot, so one setup produces exactly one schedule. This runner
// loads the real index.html in a headless browser, reads the fight table straight
// from the page (window.GOLDEN_PRESETS — the SAME "Debugging presets" the UI shows,
// so a preset you confirm in the tool IS the locked test), runs each through the
// actual optimizer, canonicalises the resulting plan (setup header + windows, exactly
// what "Copy as text" shows minus the cosmetic peak-haste/price tags), and compares
// it to a frozen golden.
//
//   node exact-match.mjs             # check every case against tests/golden.json
//   node exact-match.mjs --update    # regenerate the golden (after an INTENTIONAL change)
//   JOBS=1 node exact-match.mjs      # force sequential (the parallel control)
//
// The cases are independent, so they are fanned across JOBS browser pages (default
// cores-1). This is a HARNESS change only — the engine is untouched, so it carries no
// determinism risk, and JOBS=1 vs JOBS=N must produce byte-identical output. Two
// things make that true and are easy to break:
//   · results are keyed by name and re-emitted in spec.cases order, so neither the
//     console output nor a regenerated golden.json depends on completion order;
//   · a case that throws or hits a pageerror becomes an ERROR (exit 2 = could not
//     grade), never a silently absent one.
//
// For the every-edit loop use tools/plan-sweep.mjs + tools/plan-diff.mjs instead
// (bare node, no browser, ~16x faster). This stays the golden gate before a commit,
// and it is the only one that covers the render path. See docs/archive/10-phase9-performance.md §5.
//
// Requires: playwright-core + a Chromium (set CHROMIUM=/path/to/chromium, or rely on
// the PLAYWRIGHT default). See tests/README.md.
import { chromium } from 'playwright-core';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { fileURLToPath } from 'url';

const __dir = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(__dir, '..');
// INDEX= points the suite at a scratch copy — used to exercise this runner's own failure
// paths (a guard that is never made to fire is not known to work).
const URL = 'file://' + (process.env.INDEX ? path.resolve(process.env.INDEX) : path.join(REPO, 'index.html'));
let spec; // sourced from index.html's GOLDEN_PRESETS once the page loads (see below)
const goldenPath = path.join(__dir, 'golden.json');
const update = process.argv.includes('--update');
const golden = fs.existsSync(goldenPath) ? JSON.parse(fs.readFileSync(goldenPath, 'utf8')) : {};

const ALL_BUFFS = ["ati", "powerInfusion", "drums", "icyVeins", "skull", "isc", "scb", "arcanePower", "berserking", "mqg", "bloodlust"];

// Evaluated inside the page, once per case. Defined here so every page runs the same
// source; playwright serialises it to the renderer.
const PLAN = async ({ c, gear, kit, ALL_BUFFS }) => {
  const enabled = {};
  for (const k of ALL_BUFFS) enabled[k] = kit.includes(k);
  let segments = null;
  if (c.phases) {
    const rows = c.phases.map(p => ({ from: p.from, to: p.to, type: p.type, mult: p.mult || 1, targets: p.targets || 0 }));
    segments = buildSegments(rows, c.T);
  } else if (c.intermission) {
    segments = buildSegments([{ from: c.intermission[0], to: c.intermission[1], type: 'intermission', mult: 1, targets: 0 }], c.T);
  }
  const cfg = { T: c.T, hasteRating: gear.haste || 0, sp: gear.sp, critPct: gear.crit, enabled, fixed: c.pins || {}, warnings: [], coldSnap: gear.coldSnap !== false, segments };
  const best = await optimizeAsync(cfg, 14, () => {});
  const optR = simulate(best.s, cfg, true);
  const windows = scheduleRows({ cfg, best, optR });
  const L = [];
  L.push(`Setup: ${cfg.sp} SP · ${cfg.critPct}% crit · ${cfg.hasteRating} haste rating · Cold Snap ${cfg.coldSnap ? 'on' : 'off'}`);
  L.push(`Cooldowns: ${ALL_BUFFS.filter(k => cfg.enabled[k]).map(k => BUFFS[k].name).join(', ')}`);
  const pins = Object.entries(cfg.fixed || {}).filter(([, v]) => v && v.length).map(([k, v]) => `${BUFFS[k].name} @ ${v.map(t => fmtT(t)).join('/')}`);
  if (pins.length) L.push(`Pinned: ${pins.join('; ')}`);
  if (cfg.segments) for (const s of cfg.segments) {
    if (s.type === 'normal') continue;
    L.push(`[${s.type === 'intermission' ? 'Intermission' : s.type === 'burn' ? 'Burn x' + s.mult : 'AoE x' + s.targets} ${fmtT(s.start)}-${fmtT(s.end)}]`);
  }
  windows.forEach((w, i) => {
    // mirror the UI: print (and sort by) the ACTUAL fire time floored to the second (a.sec,
    // set by scheduleRows) — not the intent second
    const wt = Math.min(...w.acts.map(a => a.sec));
    L.push(`[Window ${i + 1} @ ${fmtT(wt)}]`);
    const acts = w.acts.slice().sort((a, b) => a.t - b.t || ALL_BUFFS.indexOf(a.k) - ALL_BUFFS.indexOf(b.k));
    for (const a of acts) L.push(`  ${fmtT(a.sec)}  ${a.coldSnap ? 'Cold Snap -> ' : ''}${BUFFS[a.k].name}`);
  });
  return L.join('\n');
};

const t0 = Date.now();
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM || '/opt/pw-browsers/chromium' });

async function openPage() {
  const pg = await browser.newPage();
  const box = { err: null };
  pg.on('pageerror', e => (box.err = String(e)));
  await pg.goto(URL);
  return { pg, box };
}

const first = await openPage();
if (first.box.err) { console.error('PAGEERROR loading index.html:', first.box.err); await browser.close(); process.exit(2); }

// Single source of truth: the fight table lives in index.html (window.GOLDEN_PRESETS),
// the same list the "Debugging presets" strip renders. Read it straight from the page.
spec = await first.pg.evaluate(() => {
  if (!Array.isArray(window.GOLDEN_PRESETS) || !window.GOLDEN_DEFAULTS)
    throw new Error('window.GOLDEN_PRESETS / GOLDEN_DEFAULTS missing in index.html');
  // Two baked strips are locked: the real Boss presets and the abstract Debugging presets.
  return { gear: window.GOLDEN_DEFAULTS.gear, kit: window.GOLDEN_DEFAULTS.kit,
           cases: [...(window.BOSS_PRESETS || []), ...window.GOLDEN_PRESETS] };
});

const JOBS = Math.max(1, Math.min(+(process.env.JOBS || 0) || Math.max(1, os.cpus().length - 1), spec.cases.length));
// Round-robin, not contiguous blocks: solve cost grows with the number of presses a fight
// admits and the presets are T-ordered, so contiguous slices hand one page every long fight
// and leave the rest idle. See docs/archive/10-phase9-performance.md §5.6.
const slices = Array.from({ length: JOBS }, (_, j) => spec.cases.map((_, i) => i).filter((_, k) => k % JOBS === j)).filter(s => s.length);

const results = {};
const errors = [];
let done = 0;
await Promise.all(slices.map(async (slice, j) => {
  const { pg, box } = j === 0 ? first : await openPage();
  if (box.err) { errors.push({ name: `page ${j}`, err: 'PAGEERROR on load: ' + box.err }); return; }
  for (const i of slice) {
    const c = spec.cases[i];
    const gear = { ...spec.gear, ...(c.gear || {}) };
    const kit = c.kit || spec.kit;
    box.err = null;
    try {
      const plan = await pg.evaluate(PLAN, { c, gear, kit, ALL_BUFFS });
      if (box.err) errors.push({ name: c.name, err: 'PAGEERROR: ' + box.err });
      else results[c.name] = plan;
    } catch (e) {
      errors.push({ name: c.name, err: String((e && e.message) || e) });
    }
    process.stderr.write(`  [${++done}/${spec.cases.length}] ${c.name}\n`);
  }
}));
await browser.close();
const wall = ((Date.now() - t0) / 1000).toFixed(1);

// A case that could not be produced is NOT a case that agrees. Bail before anything reads
// `results` as if it covered the corpus — could-not-grade beats every other verdict.
if (errors.length) {
  for (const e of errors) console.error(`ERROR  ${e.name}: ${e.err}`);
  console.error(`\nCOULD NOT GRADE — ${errors.length} case(s) errored (jobs=${JOBS}, ${wall}s).`);
  process.exit(2);
}

// Re-emit in spec.cases order, never completion order: with JOBS>1 the insertion order of
// `results` depends on which page finished first, and JSON.stringify preserves it — a
// regenerated golden.json would churn on job count alone.
const ordered = {};
for (const c of spec.cases) if (results[c.name] !== undefined) ordered[c.name] = results[c.name];

// Guards the PARTITION, not the per-case failures (those already exited above). `slices` is a
// computed round-robin cover of the index range; if a future edit to it ever dropped an index,
// no case would error and the corpus would silently shrink — the failure mode being a PASS.
const covered = Object.keys(ordered).length;
if (covered !== spec.cases.length) {
  console.error(`PARTITION HOLE — ran ${covered} of ${spec.cases.length} cases at jobs=${JOBS}; the slicing does not cover the corpus.`);
  process.exit(2);
}

if (update) {
  const n = Object.keys(ordered).length;
  fs.writeFileSync(goldenPath, JSON.stringify(ordered, null, 2) + '\n');
  console.log(`Wrote ${n} cases → ${path.relative(process.cwd(), goldenPath)}  (jobs=${JOBS}, ${wall}s)`);
  process.exit(0);
}

let pass = 0, fail = 0, missing = 0;
for (const c of spec.cases) {
  const got = ordered[c.name], want = golden[c.name];
  if (want === undefined) { missing++; console.log(`MISSING  ${c.name}   (run with --update to record)`); continue; }
  if (got === want) { pass++; console.log(`PASS  ${c.name}`); continue; }
  fail++;
  console.log(`\nFAIL  ${c.name}`);
  const gl = got.split('\n'), wl = want.split('\n'), n = Math.max(gl.length, wl.length);
  for (let i = 0; i < n; i++) {
    if (gl[i] === wl[i]) continue;
    if (wl[i] !== undefined) console.log(`   - ${wl[i]}`);
    if (gl[i] !== undefined) console.log(`   + ${gl[i]}`);
  }
}
console.log(`\n${pass} passed, ${fail} failed${missing ? `, ${missing} missing` : ''}  (jobs=${JOBS}, ${wall}s)`);
process.exit(fail || missing ? 1 : 0);
