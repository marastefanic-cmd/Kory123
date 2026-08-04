// LATTICE BRUTE FORCE — the user's enumeration, exactly as specified (08-04).
//
//   node tools/lattice-brute.mjs --T=100 --lust=7 --sp=1387 --crit=38 [--step=5] [--polish=5]
//   node tools/lattice-brute.mjs --T=120 --lust=5 --ati            # the proc costs no dimension
//   node tools/lattice-brute.mjs --T=100 --lust=7 --check=7,37/7/7/27   # assert a known layout wins
//
// Exit: 0 = swept · 1 = --check layout was BEATEN (a finding) · 2 = could not sweep.
//
// ── THE METHOD, AND WHY IT IS SHAPED THIS WAY (user, 08-04) ─────────────────────────────────────
// *"you'd calculate all of the following 0,0 - 0,5 - 0,10 … until 30,30,30. Obviously a lot of those
// combinations will never make sense, but I also dont think it's worth excluding them from the
// bruteforce as that seems more complicated figuring out which ones to exclude. If you take the
// winner and just try the ±5s to find the global optimum we dont even have to worry about the
// 3stacks and fight ending breakpoints."*
//
// Two rulings are encoded there and both are load-bearing:
//  1. **PRUNE ONLY BY LEGALITY, NEVER BY STRATEGY.** A cooldown-spacing filter is arithmetic the
//     engine already computes; "this combination makes no sense" is a strategy assumption, and
//     baking one into a certification instrument is how you certify your own prior. Every layout the
//     cooldowns permit is scored — including the ones that look absurd.
//  2. **THE GRID NEEDS NO ANCHORS, BECAUSE THE POLISH FINDS THEM.** Every integer second is within
//     ⌊step/2⌋ of a grid point, so a local ±polish sweep recovers the 3-stack moment (6.498s → 7),
//     the T−5k end alignments and the cast-boundary offsets without the instrument needing to know
//     they exist. ★ That also removes a real defect of the anchored design: the 3-stack moment MOVES
//     with haste (and with Ashtongue on it moves stochastically), so an anchored grid is
//     gear-dependent in a way this one is not.
//
// ⚠ **THE HONEST LIMIT, AND IT IS WHY `--check` EXISTS: THE POLISH IS LOCAL.** The sweep's winner is
// the best GRID layout; the polish explores its neighbourhood only. If the true optimum sits off-grid
// in a basin whose own grid samples all score below some other structure, no polish reaches it. That
// is not a hypothetical — it is the §8m/§8s coupled-move family, where every 1- and 2-coordinate step
// toward the answer is downhill. ⇒ the mitigation is `--top`: polish the top-N DISTINCT structures,
// not just the winner. N is a coverage knob, and the ground-truth cells below are how it was set.
//
// ⚠ Grades on `.integral` during the sweep (one simulate call, ~38µs measured) and on the full
// `rankPair`/`planBetter` PAIR only within the final band — a pair grade costs two simulate calls, so
// paying it 10⁷ times would double the run for a decision that only matters among near-winners.
// ⛔ The comparator is IMPORTED, never re-implemented: four instruments in this project have now
// re-typed a comparator or a normalizer and all four were wrong (§8t, §8u, §8y, and `anchors` itself).
import { loadEngine, ALL_BUFFS } from './engine-node.mjs';
import { fork } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const die = m => { console.error('LATTICE-BRUTE ERROR: ' + m); process.exit(2); };
const arg = (k, d) => { const a = process.argv.find(s => s.startsWith(`--${k}=`)); return a ? a.split('=')[1] : d; };
const flag = k => process.argv.includes(`--${k}`);
const HTML = arg('html', fileURLToPath(new URL('../index.html', import.meta.url)));
const api = loadEngine(HTML);
const B = api.BUFFS, G = api.GAME;

const T = +arg('T', 120), STEP = +arg('step', 5), POLISH = +arg('polish', 5), TOPN = +arg('top', 24);
const LUST = arg('lust', undefined) === undefined ? undefined : +arg('lust');
const SP = +arg('sp', 1387), CRIT = +arg('crit', 38), HASTE = +arg('haste', 0);
const T5 = flag('t5two'), ATI = flag('ati');
const KIT = (arg('kit', 'icyVeins,isc,scb,arcanePower,berserking')).split(',').filter(Boolean);

/* `--interm=from,to` — the declared corpus needs it (T5 1:30–2:10, T7 0:50–0:55, T8 0:15–0:20), and
   the phase shape is built by the ENGINE's own `buildSegments`, the same call `tests/anchors.mjs:154`
   makes, so a cell here is the identical fight the test asserts rather than a re-typed approximation. */
const INTERM = arg('interm', null);
const cfg = {
  T, hasteRating: HASTE, sp: SP, critPct: CRIT, coldSnap: true, t5two: T5, warnings: [],
  enabled: Object.fromEntries(ALL_BUFFS.map(k => [k, KIT.includes(k) || (ATI && k === 'ati') || (LUST !== undefined && k === 'bloodlust')])),
  fixed: LUST === undefined ? {} : { bloodlust: [LUST] },
  segments: INTERM ? api.buildSegments([{ from: +INTERM.split(',')[0], to: +INTERM.split(',')[1],
                                          type: 'intermission', mult: 1, targets: 0 }], T) : null,
};
const PLAIN = api.plainCastOf(cfg);

/* ── PER-TRACK USE-VECTORS: every legal combination of grid seconds for one cooldown ──────────────
   Legality only (this is ruling 1): uses are strictly increasing, spaced by the cooldown — except
   Icy Veins, whose SECOND use may also come from Cold Snap (one charge, `COLD_SNAP_CD` apart), which
   is why the declared corpus is full of IV pairs 20–30 s apart. The empty vector (never press it) is
   always a candidate: a certification tool may not assume a cooldown is worth using. */
function useVectors(key) {
  const def = B[key], grid = [];
  /* ★ PREPULL SECONDS ARE PART OF THE GRID (user, 08-04: *"oh ye and prepull activations, good call,
     I forgot about those"*). RULES §7b: a press may sit in `(−dur, 0)` — the cooldown starts ticking
     early and only the post-0 part of the window is credited — and the declared corpus uses it
     (T8's `isc[−5]`, T10's `iv[−10]`). The polish alone would only reach −POLISH from the 0 grid
     point, so deeper prepulls need their own grid seconds. `earliestPress` bounds it at −(dur−1). */
  for (let t = -STEP; t > -def.dur; t -= STEP) grid.unshift(t);
  for (let t = 0; t <= T - 1; t += STEP) grid.push(t);
  const maxUses = key === 'scb' ? 3 : Math.floor(T / def.cd) + 1 + (key === 'icyVeins' && cfg.coldSnap ? 1 : 0);
  const out = [[]];
  const rec = (start, acc) => {
    if (acc.length >= maxUses) return;
    for (let i = start; i < grid.length; i++) {
      const t = grid[i];
      if (acc.length) {
        const gap = t - acc[acc.length - 1];
        const snapOK = key === 'icyVeins' && cfg.coldSnap && acc.length === 1 && gap >= def.dur;
        if (gap < def.cd && !snapOK) continue;
      }
      const next = [...acc, t];
      out.push(next);
      rec(i + 1, next);
    }
  };
  rec(0, []);
  return out;
}

const TRACKS = KIT.filter(k => B[k] && B[k].kind !== 'proc');
const VEC = TRACKS.map(useVectors);
const SIZES = VEC.map(v => v.length);
const TOTAL = SIZES.reduce((a, b) => a * b, 1);

const schedOf = idx => {
  const s = {};
  for (let i = 0; i < TRACKS.length; i++) if (VEC[i][idx[i]].length) s[TRACKS[i]] = [...VEC[i][idx[i]]];
  if (LUST !== undefined) s.bloodlust = [LUST];
  return s;
};
const keyOf = s => TRACKS.map(k => (s[k] || []).join('.')).join('|');
const score = s => api.simulate(s, cfg, false).integral;

// ── the sweep: mixed-radix walk over the use-vector product, keeping the top band ────────────────
function sweep(from, to) {
  const idx = new Array(TRACKS.length).fill(0);
  let n = from;
  for (let i = TRACKS.length - 1, r = from; i >= 0; i--) { idx[i] = r % SIZES[i]; r = Math.floor(r / SIZES[i]); }
  const top = [];
  let worst = -Infinity;
  for (; n < to; n++) {
    const s = schedOf(idx);
    const v = score(s);
    if (top.length < TOPN * 8 || v > worst) {
      top.push({ v, s });
      if (top.length > TOPN * 16) { top.sort((a, b) => b.v - a.v); top.length = TOPN * 8; worst = top[top.length - 1].v; }
    }
    for (let i = TRACKS.length - 1; i >= 0; i--) { if (++idx[i] < SIZES[i]) break; idx[i] = 0; }
  }
  top.sort((a, b) => b.v - a.v);
  return top.slice(0, TOPN * 8);
}

/* ── THE POLISH: a full ±POLISH cartesian at 1 s resolution around a candidate ────────────────────
   Not coordinate-wise — the whole neighbourhood at once, because the defects this instrument exists
   to catch are COUPLED moves where every single-coordinate step is downhill (§8m, §8s, §9o). For a
   5-track single-use layout that is 11⁵ ≈ 161k evaluations, ~6 s — affordable per candidate, which
   is what makes `--top` polishing viable at all. */
/* ⛔⛔ AND IT RETURNS A TOP-K BAND, NOT AN ARGMAX — the defect T1 exposed (08-04, fixed the same day).
   The polish maximises the QUANTISED integral, but the engine's comparator ranks on the IDEAL
   (unquantised) score FIRST and only falls to shape when that ties exactly (§9l). Millisecond
   quantisation residue is ~0.001 casts — LARGER than the ideal-law differences the comparator is
   built to resolve — so a quantised argmax can walk away from the canonical answer and never offer
   it for comparison. Measured on T1: the declared layout `iv[0,20]` and the polish's `iv[20,50]`
   have IDENTICAL ideal scores (101.444195, gap 0.0e0 — provably the same value under the exact law)
   and differ by 0.001155 quantised, which is the documented resolution floor (0.001097). Returning
   only the quantised max reported `iv[20,50]` as "best" when `planBetter` prefers the declared one
   on the earliest-press rule. ⇒ hand the parent a BAND and let the real comparator choose. */
function polish(s0) {
  const coords = [];
  for (const k of TRACKS) (s0[k] || []).forEach((t, j) => coords.push([k, j]));
  if (!coords.length) return [{ v: score(s0), s: s0 }];
  const KEEP = 64;
  const band = [];
  let worst = -Infinity;
  const cur = JSON.parse(JSON.stringify(s0));
  const rec = d => {
    if (d === coords.length) {
      for (const k of TRACKS) if (cur[k]) for (let i = 1; i < cur[k].length; i++) if (cur[k][i] <= cur[k][i - 1]) return;
      const v = score(cur);
      if (band.length < KEEP * 4 || v > worst) {
        band.push({ v, s: JSON.parse(JSON.stringify(cur)) });
        if (band.length > KEEP * 8) { band.sort((a, b) => b.v - a.v); band.length = KEEP * 4; worst = band[band.length - 1].v; }
      }
      return;
    }
    const [k, j] = coords[d], t0 = s0[k][j];
    for (let dt = -POLISH; dt <= POLISH; dt++) {
      const t = t0 + dt;
      if (t < -(B[k].dur - 1) || t >= T) continue;
      cur[k][j] = t;
      rec(d + 1);
    }
    cur[k][j] = t0;
  };
  rec(0);
  band.sort((a, b) => b.v - a.v);
  return band.slice(0, KEEP);
}

// ── child mode: sweep one slice, return its top band ─────────────────────────────────────────────
if (process.env.LB_CHILD) {
  const [from, to] = process.env.LB_CHILD.split(',').map(Number);
  const top = sweep(from, to);
  process.send({ top: top.map(x => ({ v: x.v, s: x.s })) });
  process.exit(0);
}
/* ── child mode: polish a batch ───────────────────────────────────────────────────────────────────
   The polish is the EXPENSIVE half and it was single-threaded in the parent: a 6-coordinate layout
   is 11⁶ ≈ 1.77M evaluations, so polishing a dozen structures costs more than sweeping 10⁸ layouts.
   It is embarrassingly parallel over candidates, so it forks like the sweep does. */
if (process.env.LB_POLISH) {
  process.on('message', m => {
    process.send({ done: m.list.flatMap(s => polish(s)) });
    process.exit(0);
  });
  // ⚠ and BLOCK — a bare handler registration falls straight through into the parent's sweep below,
  // so every polish child re-ran the whole enumeration (and its own optimizeAsync). The handler
  // exits the process; this await simply stops module evaluation until it does.
  await new Promise(() => {});
}

const JOBS = +arg('jobs', 6);
console.log(`# LATTICE BRUTE — T=${T} lust=${LUST ?? 'none'} h=${HASTE} sp=${SP} crit=${CRIT}${T5 ? ' t5two' : ''}${ATI ? ' +ATI' : ''}`);
console.log(`#   grid ${STEP}s · tracks ${TRACKS.join(',')} · use-vectors ${SIZES.join(' × ')} = ${TOTAL.toLocaleString()} layouts`);
console.log(`#   polish ±${POLISH}s (full cartesian) on the top ${TOPN} distinct structures · ${JOBS} workers\n`);
if (TOTAL > 4e8) die(`${TOTAL.toLocaleString()} layouts is beyond the raw regime — raise --step or shorten T (see the header's limit note).`);

/* ── RESUMABILITY (`--out=file.jsonl`) — a killed run must not cost the night ─────────────────────
   A 5-track cell is ~17 minutes and long-running background processes DO get killed (measured: a T1
   run died at 262 bytes with no stack trace — an external kill, not a crash). An overnight programme
   that loses a cell to that and silently redoes it is the same wasted-night failure as one that
   crashes. So: one JSON line per finished cell, keyed by the cell's own parameters, and a run whose
   key is already present exits immediately. A batch is then just a shell loop that can be
   interrupted and restarted at will. */
const OUT = arg('out', null);
const CELLKEY = JSON.stringify({ T, LUST, SP, CRIT, HASTE, T5, ATI, KIT: KIT.join(','), STEP, POLISH, TOPN, INTERM });
if (OUT) {
  try {
    const prior = (await import('node:fs')).readFileSync(OUT, 'utf8').split('\n').filter(Boolean);
    if (prior.some(l => { try { return JSON.parse(l).cell === CELLKEY; } catch { return false; } })) {
      console.log('already done (--out has this cell) — skipping'); process.exit(0);
    }
  } catch { /* no file yet */ }
}
const t0 = Date.now();
const slice = Math.ceil(TOTAL / JOBS);
const kids = [];
for (let j = 0; j < JOBS; j++) {
  const from = j * slice, to = Math.min(TOTAL, from + slice);
  if (from >= to) continue;
  kids.push(new Promise((res, rej) => {
    const c = fork(fileURLToPath(import.meta.url), process.argv.slice(2), { env: { ...process.env, LB_CHILD: `${from},${to}` } });
    c.on('message', m => res(m.top));
    c.on('error', rej);
    c.on('exit', code => { if (code) rej(new Error(`worker exited ${code}`)); });
  }));
}
const bands = await Promise.all(kids);
const all = bands.flat().sort((a, b) => b.v - a.v);
const sweepSecs = (Date.now() - t0) / 1000;

// distinct structures for polishing: dedupe by press-key
const seen = new Set(), cands = [];
for (const x of all) { const k = keyOf(x.s); if (seen.has(k)) continue; seen.add(k); cands.push(x); if (cands.length >= TOPN) break; }

console.log(`sweep: ${TOTAL.toLocaleString()} layouts in ${sweepSecs.toFixed(1)}s (${(TOTAL / sweepSecs / 1000).toFixed(0)}k/s)`);
console.log(`  grid winner   ${(all[0].v / PLAIN).toFixed(4)} casts   ${JSON.stringify(all[0].s)}`);

/* ★★ PLATEAUS ARE THE EXPECTED OUTCOME, AND THE COMPARATOR — NOT ITERATION ORDER — RESOLVES THEM.
   User, 08-04, on the basin worry: *"that just can't happen. Especially if we keep the lust locked
   @10 seconds and the fights on a nice length that is cleanly divisible by 5 seconds… Only thing
   that might happen is that you'd find a plateau around it and the 'correct answer' would be to move
   it earlier because of the 'earliest but same' rule in the search."* Exactly so: with Lust and T on
   the grid the only off-grid features left are sub-5 s (the 3-stack moment, cast boundaries), which
   the local polish sweeps up — so what remains is FLAT REGIONS, and picking the max by iteration
   order is precisely the "search wanders inside a tie" defect the 07-28 revert punished.
   ⇒ every layout inside `TIE_CASTS` of the best score is collected as the PLATEAU and the canonical
   member is chosen by the engine's own `planBetter(rankPair(...))` — snaps, then wastedPre, then
   offGrid, then the flattened press vector ("earliest but same"). Reporting the plateau is also what
   the §8y revision precedent requires: a ruling made without seeing it cannot invoke that precedent. */
const t1 = Date.now();
const batches = Array.from({ length: JOBS }, () => []);
cands.forEach((c, i) => batches[i % JOBS].push(c.s));
const polished = (await Promise.all(batches.filter(b => b.length).map(list => new Promise((res, rej) => {
  const c = fork(fileURLToPath(import.meta.url), process.argv.slice(2), { env: { ...process.env, LB_POLISH: '1' } });
  c.on('message', m => res(m.done));
  c.on('error', rej);
  c.send({ list });
})))).flat();
/* ★ SELECT WITH THE ENGINE'S COMPARATOR, ON THE IDEAL SCORE — not the quantised max (see polish()).
   The candidate pool is the union of every polished band, deduped; each gets a real `rankPair`, the
   winner is the `planBetter` reduction (ideal score → snaps → wastedPre → offGrid → distinct →
   earliest press vector), and the PLATEAU is everything whose IDEAL score ties the winner's to the
   float floor — i.e. layouts the exact law cannot separate at all, which is the only honest meaning
   of "tied" and the set a §8y revision ruling has to see. */
const bandAbs = api.TIE_CASTS * PLAIN;
const uniq = polished.filter((p, i, a) => a.findIndex(q => keyOf(q.s) === keyOf(p.s)) === i)
                     .filter(p => polished[0] && true);
/* ⚠ AND THE POOL MUST INCLUDE THE SWEPT BAND, NOT ONLY THE POLISHED ONE — T1, 08-04. The polish
   seeds are the top-N DISTINCT structures, and on a flat cell those can all come from one family:
   T1's declared layout is a GRID layout (0 and 20 are grid seconds) that the sweep scored correctly,
   but it sits two grid steps from the nearest seed, so no ±5s polish reached it and it never entered
   the final comparison. The sweep's own band is already in hand — pair-rank it too. A few thousand
   `rankPair` calls cost ~2 s against a 17-minute sweep. */
const poolSeen = new Set(uniq.map(p => keyOf(p.s)));
for (const x of all) { const k = keyOf(x.s); if (!poolSeen.has(k)) { poolSeen.add(k); uniq.push(x); } }
const pairs = uniq.map(p => ({ ...p, pair: api.rankPair(p.s, cfg) }));
let best = pairs[0];
for (const p of pairs) if (api.planBetter(p.pair, best.pair)) best = p;
const ifloor = best.pair.ifloor;
const plateau = pairs.filter(p => Math.abs(p.pair.ideal - best.pair.ideal) <= ifloor);
const polishSecs = (Date.now() - t1) / 1000;
console.log(`polish: ${cands.length} structures × ±${POLISH}s in ${polishSecs.toFixed(1)}s → ${pairs.length} distinct candidates`);
console.log(`  BEST (planBetter) ${(best.pair.score / PLAIN).toFixed(6)} quant · ${(best.pair.ideal / PLAIN).toFixed(6)} ideal`);
console.log(`                    ${JSON.stringify(best.s)}`);
const qmax = pairs.reduce((m, p) => Math.max(m, p.pair.score), -Infinity);
if (qmax > best.pair.score + 1e-9)
  console.log(`  ⚠ a layout scores ${((qmax - best.pair.score) / PLAIN).toFixed(6)} casts HIGHER on the quantised`
            + ` integral but LOSES on the pair — that gap is ms-quantisation residue (floor ~0.0011), not value.`);
console.log(`  plateau       ${plateau.length} layout(s) the EXACT law cannot separate (ideal ties to the float floor)`);
for (const p of plateau.slice(0, 8)) if (keyOf(p.s) !== keyOf(best.s))
  console.log(`     quantΔ${((p.pair.score - best.pair.score) / PLAIN).toFixed(6)}  ${JSON.stringify(p.s)}`);

const band = api.TIE_CASTS;
/* ── THE DECLARED-LAYOUT CHECK — the primary use (`--check`) ──────────────────────────────────────
   ★ THIS INSTRUMENT SIDESTEPS THE SEARCH ENTIRELY (user, 08-04): *"basically we're sidestepping the
   search function and using the super quick scorer to bruteforce the problem, verify the winners on
   current tests so that we can apply the same approach on figuring out new tests for new trinkets
   and haste levels and spellpower levels and crit levels."* So the question it answers is *"is this
   layout the global optimum of the lattice?"* — a fact about the OBJECTIVE, not about the descent.
   That is what makes it a test-DERIVATION tool: a cell can be certified for gear the search has
   never been audited on, and the answer does not move when the search changes. */
const CHECK = arg('check', null);
if (CHECK) {
  const want = {}; CHECK.split('/').forEach((part, i) => { if (part) want[TRACKS[i]] = part.split(',').map(Number); });
  if (LUST !== undefined) want.bloodlust = [LUST];
  const wp = api.rankPair(want, cfg);
  const dIdeal = (best.pair.ideal - wp.ideal) / PLAIN, dQuant = (best.pair.score - wp.score) / PLAIN;
  const tiedExactly = Math.abs(best.pair.ideal - wp.ideal) <= wp.ifloor;
  const beatsIt = api.planBetter(best.pair, wp);
  console.log(`\n  --check layout ${(wp.score / PLAIN).toFixed(6)} quant · ${(wp.ideal / PLAIN).toFixed(6)} ideal`);
  console.log(`                 ${JSON.stringify(want)}`);
  console.log(`  vs brute best  idealΔ ${dIdeal >= 0 ? '+' : ''}${dIdeal.toFixed(6)} · quantΔ ${dQuant >= 0 ? '+' : ''}${dQuant.toFixed(6)} casts`);
  console.log(`  ⇒ ${
    !beatsIt ? '✅ THE CHECKED LAYOUT IS THE GLOBAL OPTIMUM of the lattice (nothing found beats it on the pair)'
    : tiedExactly ? '⚖️ exact-law TIE, but the comparator prefers the brute-force member (a TIE-BREAK finding, not a scoring one)'
    : dIdeal > bandAbs / PLAIN ? '⛔ BEATEN — brute force found a strictly better layout under the exact law'
    : '⚠ beaten inside the tie band — see the plateau above'}`);
  if (beatsIt && !tiedExactly && dIdeal > bandAbs / PLAIN) process.exit(1);
}

if (OUT) {
  const fs = await import('node:fs');
  fs.appendFileSync(OUT, JSON.stringify({
    cell: CELLKEY, T, lust: LUST, sp: SP, crit: CRIT, haste: HASTE, t5two: T5, ati: ATI, kit: KIT.join(','),
    interm: INTERM, layouts: TOTAL, sweepSecs: +sweepSecs.toFixed(1), polishSecs: +polishSecs.toFixed(1),
    best: best.s, quant: best.pair.score / PLAIN, ideal: best.pair.ideal / PLAIN,
    plateau: plateau.length, plateauSample: plateau.slice(0, 6).map(p => p.s),
    check: CHECK || null,
  }) + '\n');
  console.log(`  recorded → ${OUT}`);
}

/* ── OPTIONAL: what the SEARCH would have emitted (`--vs-tool`) ───────────────────────────────────
   OFF by default. Useful when auditing the SEARCH (does the descent reach what brute force proves?),
   pure overhead when deriving a TEST. ⚠ signature is (cfg, seed, onProgress) — anchors.mjs:499 is
   the canonical call site; passing the callback as arg 2 throws `onProgress is not a function`. */
if (flag('vs-tool')) {
  const tool = (await api.optimizeAsync(cfg, undefined, () => {})).s;
  const tv = api.simulate(tool, cfg, false).integral;
  const gap = (best.v - tv) / PLAIN;
  console.log(`\n  tool emits    ${(tv / PLAIN).toFixed(4)} casts   ${JSON.stringify(tool)}`);
  console.log(`  brute − tool  ${gap >= 0 ? '+' : ''}${gap.toFixed(4)} casts  (tie band ${band})  ⇒ ${
    gap > band ? '⛔ SEARCH MISS — brute force found a better layout' :
    gap < -band ? '★ the tool BEATS the lattice (off-grid, or outside the polish radius)' :
    '✓ agree within the tie band'}`);
}
