#!/usr/bin/env node
// cell-band.mjs — put an ERROR BAR on a single cross-validation matrix cell.
//
// WHY THIS EXISTS.  Every `pct` in the cross-val corpus is a SINGLE-SEED POINT ESTIMATE:
// `xval.mjs:264` hardcodes `--seed 11`.  So the whole per-cell deficit corpus — the numbers that
// decide whether ACCEPTANCE passes — has never had a confidence interval.  The only tool that does
// band a delta, `plan-duel.mjs`, defaults to CONTIGUOUS seeds (11,12,13,14,15), which TOOLING
// §"Statistical protocol" says are NOT independent replicates: per-iteration seed = base + i, so at
// iter=6000 seeds 11 and 12 share 5999 of 6000 iterations.  A band built from near-duplicates can
// only be too NARROW, which makes "new wins" the easy answer.  This tool measures the real one.
//
// WHAT IT REPLAYS.  A boss matrix cell in `xval.mjs` is NOT one sim run — it is the MEAN over
// `1 + 2*WJITTER` wall-jitter variants (`xval.mjs:233-245`), at ITER=6000 for boss tables
// (`xval-boss.sh:17`) versus ITER=10000 for class tables.  The corpus is therefore two instruments,
// and reproducing a boss cell to the decimal requires replaying the SAME variant set.  The
// mulb/VARIANTS/shiftSpec block below is copied VERBATIM from xval.mjs on purpose — if it drifts,
// this stops being a replay.  Keep them in sync.
//
// Usage:
//   RUNNER=$SP/wowsims/runner-ap180 EXPORT=$SP/seedband/export.json \
//   node tools/cell-band.mjs --a '<specA json>' --b '<specB json>' \
//     --walls 15,42,69,94,105,160,306 --dur 420 --haste 195 --targets 6 \
//     --iter 6000 --seeds 11,100011,200011,300011,400011 --seeds2 11,12,13,14,15
//
// `--seeds` is the PRIMARY group (use independent base seeds: gaps >= iter).  `--seeds2` is an
// optional comparison group (e.g. contiguous) reported alongside so the two sd's can be compared.
// Both groups share the generated APLs, so adding a group costs only its own sim runs.

import { execFile, execFileSync } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';

const REPO = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const arg = k => { const i = process.argv.indexOf('--' + k); return i > 0 ? process.argv[i + 1] : null; };
const die = m => { console.error('ERROR: ' + m); process.exit(2); };

const RUNNER = process.env.RUNNER;
const EXPORT = process.env.EXPORT;
if (!RUNNER || !EXPORT) die('set RUNNER=/path/to/runner-ap180 EXPORT=/path/to/export.json');
for (const [n, p] of [['RUNNER', RUNNER], ['EXPORT', EXPORT]]) if (!fs.existsSync(p)) die(`${n} not found: ${p}`);

const SPEC_A = arg('a') || die('--a <spec json> required');
const SPEC_B = arg('b') || die('--b <spec json> required');
const LABEL_A = arg('labelA') || 'A';
const LABEL_B = arg('labelB') || 'B';
const DUR = arg('dur') || die('--dur <seconds> required');
const HASTE = arg('haste') || die('--haste <rating> required');
const TARGETS = arg('targets') || null;
const ITER = arg('iter') || '6000';
const VAR = arg('var') || '0.5';
const WJ = arg('wj') === null ? 2 : +arg('wj');
const walls = (arg('walls') || '').split(',').filter(s => s !== '').map(Number);
const NVAR = arg('variants') ? +arg('variants') : 1 + 2 * WJ;   // xval.mjs's count by default
const parseSeeds = s => s.split(',').map(x => parseInt(x, 10)).filter(Number.isFinite);
const SEEDS = parseSeeds(arg('seeds') || '11');
const SEEDS2 = arg('seeds2') ? parseSeeds(arg('seeds2')) : null;
const JOBS = +(arg('jobs') || Math.max(1, os.cpus().length));
const SCRATCH = arg('scratch') || fs.mkdtempSync(path.join(os.tmpdir(), 'cellband-'));

// ── VERBATIM from xval.mjs:239-257 (see header) ────────────────────────────────────────────────
const mulb = seed => () => { seed |= 0; seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
// Loop bound parameterized by --variants (default `1 + 2*WJ` = xval.mjs's count, byte-identical then).
// The draws come from the SAME `mulb(9000+v)` sequence, so the corpus's variant set is a PREFIX of any
// deeper one — that nesting is what makes --prefix a convergence curve rather than N unrelated samples.
// ⚠ Deepen a wash with MORE VARIANTS, never a wider WJ: if 2*WJ exceeds the gap between two adjacent
// walls, a jittered variant can put them out of order (KT's 94 and 105 are 11 s apart) and the "fight"
// it sims is then geometrically impossible.
const VARIANTS = [walls.map(() => 0)];
for (let v = 1; v <= NVAR - 1; v++) {
  const rnd = mulb(9000 + v);
  VARIANTS.push(walls.map(() => Math.round((rnd() * 2 - 1) * WJ)));
}
{ // wall-order guard — the check xval.mjs never needed because its WJ is fixed at 2
  const bad = VARIANTS.map((ds, vi) => [vi, walls.map((w, i) => w + ds[i])]).filter(([, ws]) => ws.some((w, i) => i && w <= ws[i - 1]));
  if (bad.length) die(`WJ=${WJ} reorders walls in ${bad.length} variant(s) (e.g. v${bad[0][0]} → [${bad[0][1].join(',')}]). Use more --variants at a smaller --wj instead.`);
}
const shiftSpec = (spec, ds) => {
  if (!ds.some(d => d)) return spec;
  const s = JSON.parse(JSON.stringify(spec));
  const shiftOf = t => { let d = 0; for (let i = 0; i < walls.length; i++) if (t >= walls[i]) d = ds[i]; return d; };
  for (const k in s) {
    if (k === '_intermissions' || k === '_aoe') s[k] = s[k].map(([a, z]) => { const i = walls.indexOf(a); const j = walls.indexOf(z); return [a + (i >= 0 ? ds[i] : 0), z + (j >= 0 ? ds[j] : (i >= 0 ? ds[i] : 0))]; });
    else if (Array.isArray(s[k])) s[k] = s[k].map(t => t + shiftOf(t));
  }
  return s;
};
// ───────────────────────────────────────────────────────────────────────────────────────────────

// Generate one APL per (plan, variant). Shared across every seed — seeds only change the sim RNG.
const APL = { A: [], B: [] };
for (const [side, spec] of [['A', SPEC_A], ['B', SPEC_B]]) {
  const base = JSON.parse(spec);
  for (let vi = 0; vi < VARIANTS.length; vi++) {
    const p = path.join(SCRATCH, `${side}_v${vi}.apl.json`);
    execFileSync('node', [path.join(REPO, 'tools/genapl.mjs'), JSON.stringify(shiftSpec(base, VARIANTS[vi])), p]);
    APL[side].push(p);
  }
}

const runOne = (aplPath, seed) => new Promise((res, rej) => {
  const args = ['--export', EXPORT, '--apl', aplPath, '--dur', String(DUR), '--var', VAR, '--iter', String(ITER),
    '--seed', String(seed), '--mana', '100000000', '--haste', String(HASTE), '--quiet', '--tag', 'm'];
  if (TARGETS) args.push('--targets', String(TARGETS));
  execFile(RUNNER, args, { encoding: 'utf8', maxBuffer: 1 << 24 }, (err, out) => {
    if (err) return rej(new Error(`runner failed (seed ${seed}, ${path.basename(aplPath)}): ${err.message}`));
    const dps = parseFloat(String(out).trim().split(/\s+/)[4]);
    // Same NaN guard as xval.mjs — a NaN here would silently poison every mean downstream.
    if (!Number.isFinite(dps)) return rej(new Error(`could not parse DPS (field 5) for seed ${seed}, ${path.basename(aplPath)}: ${JSON.stringify(String(out).trim().split('\n').pop() || '')}`));
    res(dps);
  });
});

// Build the full job list up front, then drain it with a fixed-width pool.
const jobs = [];
const allSeeds = [...new Set([...SEEDS, ...(SEEDS2 || [])])];
for (const seed of allSeeds) for (const side of ['A', 'B']) for (let vi = 0; vi < VARIANTS.length; vi++) jobs.push({ seed, side, vi });
const cell = {}; // cell[seed][side][vi] = dps
let done = 0;
const t0 = Date.now();
async function worker() {
  for (;;) {
    const j = jobs.shift();
    if (!j) return;
    const dps = await runOne(APL[j.side][j.vi], j.seed);
    ((cell[j.seed] ||= {})[j.side] ||= [])[j.vi] = dps;
    done++;
    if (done % 10 === 0 || !jobs.length) process.stderr.write(`\r  ${done}/${done + jobs.length} sims  ${((Date.now() - t0) / 1000).toFixed(0)}s   `);
  }
}
console.log(`CELL BAND  haste=${HASTE} dur=${DUR}${TARGETS ? ` targets=${TARGETS}` : ''} iter=${ITER} var=${VAR}`);
console.log(`  walls=[${walls.join(',')}] wj=${WJ} → ${VARIANTS.length} variants (cell = mean over variants, as xval.mjs)`);
console.log(`  ${LABEL_A}: ${SPEC_A}`);
console.log(`  ${LABEL_B}: ${SPEC_B}`);
console.log(`  ${allSeeds.length} base seeds × 2 plans × ${VARIANTS.length} variants = ${jobs.length} runs, ${JOBS} concurrent`);
await Promise.all(Array.from({ length: Math.min(JOBS, jobs.length) }, worker));
process.stderr.write('\n');

const mean = a => a.reduce((x, y) => x + y, 0) / a.length;
const sd = a => a.length < 2 ? NaN : Math.sqrt(a.reduce((x, y) => x + (y - mean(a)) ** 2, 0) / (a.length - 1));
const rows = allSeeds.map(seed => {
  const a = mean(cell[seed].A), b = mean(cell[seed].B);
  return { seed, a, b, d: b - a, pct: 100 * (b - a) / a };
});
console.log(`\n     seed  ${LABEL_A.padStart(9)}  ${LABEL_B.padStart(9)}      Δ(B−A)     pct%`);
for (const r of rows) console.log(`${String(r.seed).padStart(9)}  ${r.a.toFixed(1).padStart(9)}  ${r.b.toFixed(1).padStart(9)}  ${(r.d >= 0 ? '+' : '') + r.d.toFixed(1).padStart(9)}  ${r.pct.toFixed(3).padStart(7)}`);

// PER-VARIANT BREAKDOWN (first seed). A boss cell is a MEAN over wall-jitter variants; if the
// per-variant `pct` is wide, the cell's headline number is mostly wash SAMPLING ERROR (SEM ≈
// spread/√N), not a plan difference. This is the diagnostic the corpus never printed.
const s0 = allSeeds[0];
console.log(`\nPER-VARIANT at seed ${s0} (δ per wall [${walls.join(',')}]):`);
const vpct = [];
for (let vi = 0; vi < VARIANTS.length; vi++) {
  const a = cell[s0].A[vi], b = cell[s0].B[vi], p = 100 * (b - a) / a;
  vpct.push(p);
  console.log(`  v${String(vi).padEnd(2)} δ=[${VARIANTS[vi].map(d => String(d).padStart(2)).join(',')}]  ${a.toFixed(1).padStart(8)}  ${b.toFixed(1).padStart(8)}  pct ${p.toFixed(4).padStart(8)}`);
}
{
  const m = vpct.reduce((x, y) => x + y, 0) / vpct.length;
  const s = vpct.length < 2 ? NaN : Math.sqrt(vpct.reduce((x, y) => x + (y - m) ** 2, 0) / (vpct.length - 1));
  console.log(`  across variants: mean ${m.toFixed(4)}  sd ${s.toFixed(4)}  range [${Math.min(...vpct).toFixed(4)}, ${Math.max(...vpct).toFixed(4)}]  SEM(N=${vpct.length}) ±${(s / Math.sqrt(vpct.length)).toFixed(4)}`);
}
// PREFIX CONVERGENCE — the variant sets are nested, so the mean over the first k is the cell as the
// corpus would have computed it with k variants. A decreasing curve means the wash was under-sampled.
const PREFIX = (arg('prefix') || '').split(',').filter(s => s).map(Number).filter(k => k >= 1 && k <= VARIANTS.length);
if (PREFIX.length) {
  console.log(`\nPREFIX CONVERGENCE (mean over the first k variants; k=${1 + 2 * WJ} is what xval.mjs computes):`);
  console.log(`      k  ${LABEL_A.padStart(9)}  ${LABEL_B.padStart(9)}     pct%   ±SEM`);
  for (const k of PREFIX) {
    const av = cell[s0].A.slice(0, k), bv = cell[s0].B.slice(0, k);
    const a = av.reduce((x, y) => x + y, 0) / k, b = bv.reduce((x, y) => x + y, 0) / k;
    const pk = vpct.slice(0, k);
    const m = pk.reduce((x, y) => x + y, 0) / k;
    const s = k < 2 ? NaN : Math.sqrt(pk.reduce((x, y) => x + (y - m) ** 2, 0) / (k - 1));
    console.log(`  ${String(k).padStart(5)}  ${a.toFixed(1).padStart(9)}  ${b.toFixed(1).padStart(9)}  ${(100 * (b - a) / a).toFixed(4).padStart(7)}  ±${(s / Math.sqrt(k)).toFixed(4)}`);
  }
}
if (arg('dump')) fs.writeFileSync(arg('dump'), JSON.stringify({ walls, WJ, VARIANTS, haste: HASTE, dur: DUR, targets: TARGETS, iter: ITER, var: VAR, specA: JSON.parse(SPEC_A), specB: JSON.parse(SPEC_B), cell }, null, 1));

const summarize = (name, seeds) => {
  const p = rows.filter(r => seeds.includes(r.seed)).map(r => r.pct);
  const m = mean(p), s = sd(p), band = 2 * s / Math.sqrt(p.length);
  const pos = p.filter(x => x > 0).length;
  console.log(`\n${name} (n=${p.length}): mean pct = ${m.toFixed(4)}  sd = ${s.toFixed(4)}  band(95% on mean) = ±${band.toFixed(4)}  → [${(m - band).toFixed(4)}, ${(m + band).toFixed(4)}]`);
  console.log(`  per-seed range [${Math.min(...p).toFixed(4)}, ${Math.max(...p).toFixed(4)}]   sign: ${LABEL_B}>${LABEL_A} in ${pos}/${p.length} seeds`);
  return { m, s, band, p };
};
const S1 = summarize('PRIMARY', SEEDS);
if (SEEDS2) {
  const S2 = summarize('COMPARISON', SEEDS2);
  console.log(`\nsd(PRIMARY)/sd(COMPARISON) = ${(S1.s / S2.s).toFixed(2)}   (>1 ⇒ the comparison group UNDERSTATES the spread)`);
}
if (!arg('scratch')) fs.rmSync(SCRATCH, { recursive: true, force: true });
