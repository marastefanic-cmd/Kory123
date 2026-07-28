// FACTS-PAIR — how two cooldowns behave TOGETHER, and how much of that is interaction.
//
// `tools/facts-ladder.mjs` measures one cooldown alone, which is where every fact about the GCD floor
// and the Arcane Blast ramp comes from. It is also, by construction, blind to the thing the planner
// actually optimizes: **alignment**. This tool is the next layer — for a PAIR, brute-force every
// (pressA, pressB) on a grid and decompose what comes out.
//
// ── THE ONE NUMBER THAT MATTERS ──────────────────────────────────────────────────────────────────
//     interaction(a, b) = V(both) − V(a alone) − V(b alone)
// Zero means the two cooldowns are independent and you may place them separately. Positive means
// overlapping them is worth more than the sum of the parts, and the whole alignment problem lives in
// that term. Because each cooldown alone is already measured to be interior-flat, the interaction is
// clean: it is not contaminated by where inside the fight the pair sits, only by how they sit relative
// to each other.
//
// ── THE CLOSED FORM, FOR A HASTE × VALUE PAIR ────────────────────────────────────────────────────
// A +ΔSP buff makes every cast it covers worth `1 + s` plain casts, where
//     s = COEF·ΔSP / (AVG_BASE + COEF·SP)              (crit cancels — it scales both)
// A haste cooldown adds `N` casts. If those added casts land INSIDE the value window, each is worth
// `1 + s` instead of 1, so
//     interaction = (casts the haste cooldown adds inside the value window) × s
//                 = N × s          when the windows are aligned and the value window covers them all
// ⇒ **the generalisation, per point of temporary spell power:**
//     d(interaction)/d(ΔSP) = N · COEF / (AVG_BASE + COEF·SP)
// It is symmetric and can be read from either side: the haste cooldown is worth more because its extra
// casts are worth more, or the value buff is worth more because it covers more casts. Same number.
//
// ── AND THE BREAKPOINT THAT FALLS OUT OF IT ──────────────────────────────────────────────────────
// Above its GCD-cap threshold a haste cooldown's interior value drains while its PULL value does not
// (facts rule 3), so at some passive haste it prefers the pull — abandoning the overlap. Break-even is
// where the pull advantage exactly pays for the lost interaction:
//     pullAdvantage(h)  =  s(SP)
// ★ Since `s` FALLS as passive spell power rises, **more spell power moves the breakpoint DOWN**: the
// temporary +SP is worth relatively less against a bigger base, so there is less reason to stay
// aligned with it. That is a prediction with a sign, and `--mode=breakpoint` measures it.
import { loadEngine, ALL_BUFFS } from './engine-node.mjs';

const args = Object.fromEntries(process.argv.slice(2).map(a => {
  const m = a.match(/^--([^=]+)(?:=(.*))?$/); return m ? [m[1], m[2] ?? true] : [a, true];
}));
const api = loadEngine(args.html || 'index.html');

{ // engine stamp — see facts-ladder.mjs; a rolled-back clone answers a different question silently
  const p = { T: 30, hasteRating: 0, sp: 1000, critPct: 25, enabled: {}, fixed: {}, warnings: [], coldSnap: false, segments: null };
  const r = api.simulate(api.repair({}, p), p, true);
  if (!r.casts.length || r.casts[0].frac === undefined) {
    console.error('FACTS-PAIR ERROR: this index.html predates the boundary credit (casts[].frac absent).');
    process.exit(2);
  }
}

const T    = Number(args.T ?? 60);
const STEP = Number(args.step ?? 1);
const A    = String(args.a ?? 'icyVeins');
const B    = String(args.b ?? 'isc');
for (const k of [A, B]) if (!api.BUFFS[k]) { console.error(`FACTS-PAIR ERROR: no cooldown "${k}"`); process.exit(2); }
const list = (v, d) => String(v ?? d).split(',').map(Number);
const range = v => { const m = String(v).match(/^(\d+):(\d+):(\d+)$/); if (!m) return null;
                     const o = []; for (let x = +m[1]; x <= +m[2]; x += +m[3]) o.push(x); return o; };
const HASTES = range(args.haste) || list(args.haste, '0');
const SPS    = range(args.sp)    || list(args.sp, '1000');
const CRIT   = Number(args.crit ?? 25);

const EXTERNAL = new Set(['bloodlust', 'powerInfusion', 'drums']);
const clone = o => JSON.parse(JSON.stringify(o));

// Score a schedule. ⚠ Externals must go in `cfg.fixed` too — `repair` applies `fixed` inside its
// `for (const key in schedule)` loop, so a pinned key absent from the schedule is dropped silently.
function scoreOf(sched, h, sp) {
  const enabled = {}; for (const k of ALL_BUFFS) enabled[k] = (k in sched);
  const fixed = {}; for (const k of Object.keys(sched)) if (EXTERNAL.has(k)) fixed[k] = sched[k];
  const cfg = { T, hasteRating: h, sp, critPct: CRIT, enabled, fixed, warnings: [], coldSnap: false, segments: null };
  const rep = api.repair(clone(sched), cfg);
  // ★ REFUSE A MOVED PRESS. `repair` legalises — cooldowns, the shared trinket lockout, use caps — and
  // a moved press means the cell measured a DIFFERENT layout than the one it is about to be labelled
  // with. Silently mislabelled cells are how a pair surface grows a phantom ridge.
  let moved = null;
  for (const k of Object.keys(sched))
    if (!rep[k] || rep[k].length !== sched[k].length || rep[k].some((t, i) => Math.abs(t - sched[k][i]) > 1e-9))
      moved = `${k}: asked ${JSON.stringify(sched[k])}, repair returned ${JSON.stringify(rep[k])}`;
  return { v: api.simulate(rep, cfg).robust, moved };
}
const unitOf = (h, sp) => {
  const cfg = { T, hasteRating: h, sp, critPct: CRIT, enabled: {}, fixed: {}, warnings: [], coldSnap: false, segments: null };
  const c = api.simulate(api.repair({}, cfg), cfg, true).casts.find(x => x.stacks >= api.GAME.AB.MAX_STACKS);
  return c.dmg;
};
const t3Of = (h, sp) => {
  const cfg = { T, hasteRating: h, sp, critPct: CRIT, enabled: {}, fixed: {}, warnings: [], coldSnap: false, segments: null };
  const c = api.simulate(api.repair({}, cfg), cfg, true).casts.find(x => x.stacks >= api.GAME.AB.MAX_STACKS);
  return c ? c.t : 0;
};
const timesFor = key => { const o = []; for (let t = 0; t <= T - api.BUFFS[key].dur + 1e-9; t += STEP) o.push(+t.toFixed(3)); return o; };

// The per-cast bonus of a value cooldown, and the closed-form interaction slope.
const G = api.GAME.AB;
const sOf = (key, sp) => {
  const d = api.BUFFS[key];
  if (d.kind === 'sp')  return G.COEF * d.value / (G.AVG_BASE_DMG + G.COEF * sp);
  if (d.kind === 'dmg') return d.value - 1;
  return null;                                    // haste cooldowns have no per-cast bonus
};

// Solve one (haste, sp) cell by brute force over both press times.
function solve(h, sp) {
  const unit = unitOf(h, sp), zero = scoreOf({}, h, sp).v;
  const tA = timesFor(A), tB = timesFor(B);
  const soloA = {}, soloB = {};
  let skipped = 0;
  for (const t of tA) { const r = scoreOf({ [A]: [t] }, h, sp); if (r.moved) { skipped++; continue; } soloA[t] = (r.v - zero) / unit; }
  for (const t of tB) { const r = scoreOf({ [B]: [t] }, h, sp); if (r.moved) { skipped++; continue; } soloB[t] = (r.v - zero) / unit; }
  let best = null;
  const cells = [];
  for (const a of tA) for (const b of tB) {
    if (soloA[a] === undefined || soloB[b] === undefined) continue;
    const r = scoreOf({ [A]: [a], [B]: [b] }, h, sp);
    if (r.moved) { skipped++; continue; }
    const pair = (r.v - zero) / unit;
    const inter = pair - soloA[a] - soloB[b];
    const cell = { a, b, pair, inter, overlap: Math.max(0, Math.min(a + api.BUFFS[A].dur, b + api.BUFFS[B].dur) - Math.max(a, b)) };
    cells.push(cell);
    if (!best || pair > best.pair + 1e-9) best = cell;
  }
  return { best, cells, soloA, soloB, unit, skipped };
}

const pad = (s, n) => String(s).padStart(n);
const nameA = api.BUFFS[A].name, nameB = api.BUFFS[B].name;

if (args.mode === 'breakpoint') {
  // ★ TWO NAMED ARMS, NOT AN ARGMAX. Reading the breakpoint off `argmax over the whole grid` does not
  // work: the pair surface is quantised (the interaction moves in whole covered casts), so the winner
  // hops between neighbouring layouts and the flip looks like it happens several rungs earlier than it
  // does. Compare the two layouts the question is actually about, and find where their difference
  // changes sign.
  //   ALIGNED — both pressed together, in the interior          (the low-haste answer)
  //   PULLED  — the haste cooldown at 0, the value one interior (the high-haste answer)
  // ⚠ Note PULLED is NOT "no overlap": two 20 s windows 5 s apart still share 15 s, so moving Icy
  // Veins to the pull surrenders only part of the interaction, not all of it. Anyone reasoning about
  // this as "abandon the overlap" will predict the wrong breakpoint.
  console.log(`BREAKPOINT — when does ${nameA} leave the interior, and does spell power move it?`);
  console.log(`T=${T}s, crit ${CRIT}%, press grid ${STEP}s.`);
  console.log(`  ALIGNED = best interior t of  ${A}@t + ${B}@t`);
  console.log(`  PULLED  = best interior t of  ${A}@0 + ${B}@t\n`);
  for (const sp of SPS) {
    const s = sOf(B, sp);
    console.log(`### spell power ${sp}   (${nameB} is worth s = ${s.toFixed(5)} per covered cast)`);
    console.log(`   haste |  ALIGNED (casts) | its layout |  PULLED (casts) | its layout |  PULLED − ALIGNED`);
    let flipped = null, prev = null;
    for (const h of HASTES) {
      const unit = unitOf(h, sp), zero = scoreOf({}, h, sp).v, t3 = t3Of(h, sp);
      const interior = timesFor(A).filter(t => t >= t3 - 1e-9 && t < T - api.BUFFS[A].dur - 1e-9);
      let al = null, pu = null;
      for (const t of interior) {
        const r1 = scoreOf({ [A]: [t], [B]: [t] }, h, sp);
        if (!r1.moved) { const v = (r1.v - zero) / unit; if (!al || v > al.v + 1e-9) al = { v, t }; }
        const r2 = scoreOf({ [A]: [0], [B]: [t] }, h, sp);
        if (!r2.moved) { const v = (r2.v - zero) / unit; if (!pu || v > pu.v + 1e-9) pu = { v, t }; }
      }
      if (!al || !pu) { console.log(`   ${pad(h, 5)} | (no legal interior layout)`); continue; }
      const d = pu.v - al.v;
      if (flipped === null && prev !== null && prev <= 0 && d > 0) flipped = h;
      prev = d;
      console.log(`   ${pad(h, 5)} | ${pad(al.v.toFixed(4), 16)} | ${pad(`@${al.t}+@${al.t}`, 10)} | ${pad(pu.v.toFixed(4), 15)} | ` +
                  `${pad(`@0+@${pu.t}`, 10)} | ${pad(d.toFixed(4), 17)} ${d > 0 ? 'PULLED wins' : ''}`);
    }
    console.log(`   ⇒ ${nameA} leaves the interior at h=${flipped ?? '(no sign change in this ladder)'}\n`);
  }
  process.exit(0);
}

// ── default: the pair surface at each baseline ───────────────────────────────────────────────────
for (const h of HASTES) for (const sp of SPS) {
  const { best, cells, soloA, soloB, skipped } = solve(h, sp);
  const t3 = t3Of(h, sp), s = sOf(B, sp), sA = sOf(A, sp);
  console.log(`═══ ${nameA} + ${nameB} — haste ${h}, ${sp} SP, ${CRIT}% crit, T=${T}s ═══`);
  if (skipped) console.log(`    (${skipped} grid cells skipped: repair moved a press, so they would be mislabelled)`);
  console.log(`    3 stacks from ${t3.toFixed(2)}s.  press grid ${STEP}s.`);
  const disjoint = cells.filter(c => c.overlap < 1e-9);
  const full = cells.filter(c => c.overlap >= Math.min(api.BUFFS[A].dur, api.BUFFS[B].dur) - 1e-9);
  const bestDis = disjoint.reduce((x, y) => (!x || y.pair > x.pair ? y : x), null);
  console.log(`    BEST OVERALL     @${best.a}s + @${best.b}s   ${best.pair.toFixed(4)} casts   overlap ${best.overlap.toFixed(0)}s   interaction ${best.inter.toFixed(4)}`);
  if (bestDis) console.log(`    BEST DISJOINT    @${bestDis.a}s + @${bestDis.b}s   ${bestDis.pair.toFixed(4)} casts   overlap 0s   interaction ${bestDis.inter.toFixed(4)}`);
  if (bestDis) console.log(`    ⇒ overlapping is worth ${(best.pair - bestDis.pair).toFixed(4)} casts`);
  if (full.length) {
    const lo = Math.min(...full.map(c => c.inter)), hi = Math.max(...full.map(c => c.inter));
    console.log(`    interaction when fully overlapped: ${lo.toFixed(4)} … ${hi.toFixed(4)} over ${full.length} such layouts`);
  }
  if (disjoint.length) {
    const lo = Math.min(...disjoint.map(c => c.inter)), hi = Math.max(...disjoint.map(c => c.inter));
    console.log(`    interaction when disjoint:         ${lo.toFixed(4)} … ${hi.toFixed(4)} over ${disjoint.length} such layouts`);
  }
  // The aligned diagonal — press both at the same moment. This is the layout a player would write,
  // and printing it whole is the only way to see that the interaction is QUANTISED: the value buff
  // covers a whole number of the casts the haste buff created, never a fractional one.
  if (api.BUFFS[A].dur === api.BUFFS[B].dur) {
    console.log(`    ── pressed together, @t + @t ──`);
    console.log(`       t   |   pair (casts) | interaction | interaction / s`);
    for (const c of cells.filter(x => Math.abs(x.a - x.b) < 1e-9)) {
      const q = s !== null && sA === null ? (c.inter / s).toFixed(3) : '—';
      console.log(`      ${pad(c.a, 4)} | ${pad(c.pair.toFixed(4), 14)} | ${pad(c.inter.toFixed(4), 11)} | ${pad(q, 15)}`);
    }
  }
  const top = cells.slice().sort((x, y) => y.pair - x.pair).slice(0, 5);
  console.log(`    ── best 5 layouts ──`);
  for (const c of top) console.log(`      @${pad(c.a, 3)}s + @${pad(c.b, 3)}s   ${c.pair.toFixed(4)} casts   overlap ${pad(c.overlap.toFixed(0), 2)}s   interaction ${c.inter.toFixed(4)}`);
  // closed form: N (the haste cooldown's own interior value) × s (the value cooldown's per-cast bonus)
  if (s !== null && sOf(A, sp) === null) {
    const keys = Object.keys(soloA).map(Number).sort((x, y) => x - y);
    const interior = keys.filter(t => t >= t3 - 1e-9 && t < T - api.BUFFS[A].dur - 1e-9);
    const N = soloA[interior[Math.floor(interior.length / 2)]];
    console.log(`    CLOSED FORM      N × s = ${N.toFixed(4)} × ${s.toFixed(5)} = ${(N * s).toFixed(4)} casts`);
    console.log(`    per 1 temporary spell power: N·COEF/(AVG_BASE+COEF·SP) = ${(N * G.COEF / (G.AVG_BASE_DMG + G.COEF * sp)).toExponential(4)} casts`);
  }
  console.log('');
}
