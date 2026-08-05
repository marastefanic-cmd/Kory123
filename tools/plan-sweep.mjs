// Sweep every baked preset through the optimizer in BARE NODE, fanned across processes,
// emit the FULL-PRECISION schedule per case, and audit each plan for legality.
//
// Why this exists: tests/exact-match.mjs is the only plan gate and it is browser-bound — engine and
// presets are reachable only through a live page. 9m07s sequential; ~270-337s parallelized, which is
// how it runs today, so the "sequentially in one chromium page" this header used to claim is stale
// (PHASE11 §1.3 I7). Either way it is a browser tax. This sweeps the same corpus in BARE NODE across
// processes (the engine is DOM-free by construction — it already runs in a Web Worker), emits
// best.s (the schedule the optimizer CHOSE) at float precision, needs no golden to maintain
// (plan-diff.mjs diffs A vs B), and admits a QUICK tier. See docs/archive/10-phase9-performance.md §5.
//
// ⚠ It does NOT replace exact-match, and the reason is NOT "exact-match floors to seconds and
// so misses sub-second shifts" — that claim was MEASURED FALSE (all 273 press times across all
// 25 cases are integers; a floor cannot lose a whole number). The honest difference: exact-match
// compares derived FIRE times, which are presses snapped to cast boundaries and therefore
// genuinely fractional; this compares the schedule upstream of that snap. At least as sensitive,
// strictly more so wherever the floor absorbs a change — but whether such a case exists in this
// corpus is UNMEASURED. exact-match also covers the whole render path, which this never touches.
//
// Usage:  node plan-sweep.mjs <index.html> <out.json> [jobs]
//
// FALSE-PASS GUARDS (this repo's tracked defect class — an instrument whose failure mode is a
// PASS): a child that dies, throws, or reports nothing becomes an ERROR cell, never a missing
// one; the parent asserts one result per case index before writing; any ERROR exits 2.
// Exit codes: 0 = swept every case clean · 1 = a plan is ILLEGAL · 2 = could not sweep.
import { fork } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import { loadEngine, cfgFor } from './engine-node.mjs';

const HTML = process.argv[2], OUT = process.argv[3];
const die = m => { console.error('SWEEP ERROR: ' + m); process.exit(2); };
if (!HTML || !OUT) die('usage: node plan-sweep.mjs <index.html> <out.json> [jobs]');

// Legality audit, carried over from the Jul-19 browser prober. Orthogonal to an A-vs-B diff:
// it catches an ILLEGAL plan even when there is no B to compare against.
function illegal(s, cfg, BUFFS) {
  const p = [];
  for (const k in s) {
    for (const t of s[k]) {
      if (Math.abs(t - Math.round(t)) > 1e-9) p.push(`${k}@${t} fractional`);
      /* ⚠ A NEGATIVE PRESS IS LEGAL NOW — prepull activation, RULES §7b (07-30). This read
         `t < -1e-9` and flagged every prepull as an illegal plan, which is the predicate being older
         than the feature rather than the plan being wrong. The real bound is the same one `repair`
         enforces: strictly greater than `-dur`, because at `-dur` the whole window is spent before the
         pull. On the whole-second grid that is `-(dur - 1)`. */
      if (t < -(BUFFS[k].dur - 1) - 1e-9) p.push(`${k}@${t} deeper than -(dur-1): the whole window is prepull`);
    }
    const ts = s[k];
    // Icy Veins is exempt: Cold Snap legitimately re-presses it inside its own cooldown.
    if (k !== 'icyVeins') for (let i = 1; i < ts.length; i++)
      if (ts[i] - ts[i - 1] < BUFFS[k].cd - 1e-6) p.push(`${k} cd violation ${ts[i - 1]}->${ts[i]}`);
  }
  const tr = ['skull', 'mqg', 'isc'].flatMap(k => (s[k] || []).map(t => ({ t, k }))).sort((a, b) => a.t - b.t);
  for (let i = 1; i < tr.length; i++)
    if (tr[i].t - tr[i - 1].t < 20 - 1e-6) p.push(`trinket lockout ${tr[i - 1].k}@${tr[i - 1].t}->${tr[i].k}@${tr[i].t}`);
  return p;
}

// ── child mode ────────────────────────────────────────────────────────────────
if (process.env.SWEEP_CHILD) {
  const api = loadEngine(HTML);
  const out = [];
  for (const i of JSON.parse(process.env.SWEEP_IDXS)) {
    const c = api.cases[i];
    const t0 = Date.now();
    let cell;
    try {
      const cfg = cfgFor(api, c);
      const best = await api.optimizeAsync(cfg, 14, () => {});
      /* ⚠ `score` MUST BE THE RANKING QUANTITY, and `best.val` is not it. `optimizeAsync` returns
         `val = simulate().robust` — the per-cast sum, which since MODEL-DEFECTS §8h is the REPORTED
         number and no longer the one that ranks (the rate integral does). Recording `val` made
         plan-diff's SCORE-AUDIT grade every search change against a RETIRED objective, and on
         2026-07-30 it did exactly that: it called three cells "SEARCH REGRESSION" when, on the
         integral, two were improvements (+0.0058 Karathress, +0.0392 Solarian) and the third was
         −0.0012 casts — inside `TIE_CASTS` and won on the shape tie-break (3 distinct press moments
         against 4). Same stale-premise class as `plan-duel`'s, recorded in §8n.
         `robust` is kept alongside so the reported number is still diffable, but the audit reads
         `score`. Falls back for an engine predating `rankScore`; such a sweep is then unscored, which
         plan-diff already reports rather than silently trusting. */
      const score = typeof api.rankScore === 'function' ? api.rankScore(best.s, cfg) : undefined;
      /* The objective is a PAIR, so a diff that reads only the first half misgrades every move that
         lands inside the band and wins on shape. Carry the other half: `band` is the engine's own
         TIE_CASTS in this cell's damage units, and `shape` is the ENGINE'S OWN `planShape` — recorded
         whole rather than as one hand-picked field.
         ⚠ `distinct` is kept as a separate key ONLY so an old plan-diff can still read a new sweep;
         the criterion itself was ABOLISHED on 08-05 (§9s) and nothing grades on it. Recording the
         whole shape is the fix for the deeper problem: the previous version stored exactly one
         criterion, so the day the comparator's order changed, every sweep on disk silently stopped
         carrying the field that decides. */
      const band = api.TIE_CASTS !== undefined && api.plainCastOf ? api.TIE_CASTS * api.plainCastOf(cfg) : undefined;
      const shape = api.planShape ? api.planShape(best.s, cfg) : undefined;
      cell = { i, name: c.name, T: c.T, ms: Date.now() - t0, score, band, shape, distinct: shape ? shape.distinct : undefined,
               robust: best.val ?? best.score, s: best.s, bad: illegal(best.s, cfg, api.BUFFS) };
    } catch (e) {
      cell = { i, name: c.name, T: c.T, ms: Date.now() - t0, error: String((e && e.stack) || e) };
    }
    out.push(cell);
    process.send({ tick: c.name, ms: cell.ms, bad: cell.bad?.length || 0, err: !!cell.error });
  }
  process.send({ done: out });
  // breathe()'s MessageChannel keeps node's event loop ref'd, so the child never exits on its
  // own. Flush the IPC write, then leave deliberately — a gate that HANGS reads as a slow gate,
  // which is the same false signal as one that passes wrongly.
  setTimeout(() => process.exit(0), 50);
}

// ── parent mode ───────────────────────────────────────────────────────────────
else {
  const api = loadEngine(HTML);          // validates the file up front, before we fan out
  const N = api.cases.length;

  // --max-t=N restricts the sweep to short fights (the QUICK tier). Solve cost is ~exponential in
  // the number of presses that FIT, so a handful of long fights own most of the CPU and one case
  // sets an Amdahl floor the full sweep can never beat. T is the honest proxy for press count.
  // The subset is a DELIBERATE coverage trade, so it is named in the output and in the JSON —
  // a gate that quietly grades fewer cases than you think is the false-pass defect class.
  const maxT = +((process.argv.find(a => a.startsWith('--max-t=')) || '').split('=')[1] || 0);
  const pick = Array.from({ length: N }, (_, i) => i).filter(i => !maxT || api.cases[i].T <= maxT);
  if (!pick.length) die(`--max-t=${maxT} selected 0 of ${N} cases.`);
  const jobs = Math.max(1, Math.min(+(process.argv[4] || 0) || Math.max(1, os.cpus().length - 1), pick.length));
  // Round-robin, not contiguous blocks: case cost grows with T and the presets are ordered by
  // T, so contiguous slices hand one child every long fight and idle the rest.
  const slices = Array.from({ length: jobs }, (_, j) => pick.filter((_, k) => k % jobs === j));

  const t0 = Date.now();
  let done = 0;
  const cells = new Map();
  await Promise.all(slices.filter(s => s.length).map(idxs => new Promise(res => {
    const ch = fork(process.argv[1], [HTML, OUT],
      { env: { ...process.env, SWEEP_CHILD: '1', SWEEP_IDXS: JSON.stringify(idxs) },
        stdio: ['ignore', 'inherit', 'inherit', 'ipc'] });
    ch.on('message', m => {
      if (m.tick) process.stderr.write(`  [${++done}/${pick.length}] ${m.tick} ${(m.ms / 1000).toFixed(1)}s${m.err ? ' ERROR' : m.bad ? ` ILLEGAL(${m.bad})` : ''}\n`);
      if (m.done) for (const c of m.done) cells.set(c.i, c);
    });
    // A child that exits without reporting must not silently shrink the corpus.
    ch.on('exit', code => { for (const i of idxs) if (!cells.has(i)) cells.set(i, { i, name: api.cases[i].name, error: `child exited ${code} without reporting` }); res(); });
    ch.on('error', e => { for (const i of idxs) if (!cells.has(i)) cells.set(i, { i, name: api.cases[i].name, error: 'fork: ' + e.message }); res(); });
  })));

  const all = pick.map(i => cells.get(i) || { i, name: api.cases[i].name, error: 'never reported' });
  const errs = all.filter(c => c.error), bad = all.filter(c => c.bad?.length);
  const wall = (Date.now() - t0) / 1000;
  fs.writeFileSync(OUT, JSON.stringify({ html: HTML, n: all.length, ofTotal: N, maxT: maxT || null, jobs, wallSec: +wall.toFixed(1), cells: all }, null, 1));
  const slow = all.filter(c => !c.error).sort((a, b) => b.ms - a.ms).slice(0, 3)
    .map(c => `${c.name} ${(c.ms / 1000).toFixed(1)}s`).join(', ');
  console.log(`SWEEP ${errs.length ? 'INCOMPLETE' : bad.length ? 'ILLEGAL' : 'OK'} cases=${all.length}/${N}${maxT ? ` (QUICK --max-t=${maxT})` : ''} jobs=${jobs} wall=${wall.toFixed(1)}s cpu=${(all.reduce((a, c) => a + (c.ms || 0), 0) / 1000).toFixed(0)}s errors=${errs.length} illegal=${bad.length} → ${OUT}`);
  if (slow) console.log(`  slowest: ${slow}`);
  for (const b of bad) console.error(`  ILLEGAL case[${b.i}] "${b.name}": ${b.bad.join('; ')}`);
  for (const e of errs) console.error(`  ERROR case[${e.i}] "${e.name}": ${e.error}`);
  process.exit(errs.length ? 2 : bad.length ? 1 : 0);
}
