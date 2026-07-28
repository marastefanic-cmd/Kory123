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
const SCORE  = String(args.score ?? 'point');
if (!['point','integral'].includes(SCORE)) { console.error('FACTS-PAIR ERROR: --score must be point|integral'); process.exit(2); }

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
  // ★ SCORE SELECTOR (07-28). `--score integral` reads the phase EXPECTATION instead of the realised
  // per-cast sum. A pair's VALUE is a difference at one lattice phase and the phase term largely
  // cancels between neighbouring cells, so the two agree closely — but a BEST-PLACEMENT verdict is an
  // argmax, and there the phase term is the same size as the interaction (MODEL-DEFECTS §8f).
  const r0 = api.simulate(rep, cfg);
  return { v: SCORE === 'integral' ? r0.integral : r0.robust, moved };
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

// ── the composition rules, spell-agnostically ─────────────────────────────────────────────────────
// ★ WHICH RULE APPLIES IS DECIDED BY WHERE THE MODIFIER SITS IN THE DAMAGE FORMULA, not by which spell
// it is. `dmg = (AVG_BASE + COEF·sp) · critFactor · dmgMult`, so:
//   +SP  buffs add INSIDE the bracket   ⇒ two of them are one bigger delta ⇒ they cannot interact
//   ×dmg buffs multiply the WHOLE thing ⇒ they interact with everything that changes the damage
//   haste changes HOW MANY casts happen ⇒ it interacts with anything that changes what a cast is worth
// This is why Arcane Power does not behave like Icon even though both are "value" cooldowns: Icon adds
// spell power, Arcane Power multiplies damage.
const FAMILY = key => {
  const k = api.BUFFS[key].kind;
  return k === 'mult' || k === 'rating' ? 'haste' : k === 'sp' ? 'sp' : 'dmg';
};
function ruleFor(a, b) {
  const fa = FAMILY(a), fb = FAMILY(b), set = [fa, fb].sort().join('+');
  if (set === 'sp+sp')       return { name: 'sp × sp',       expect: 'exactly 0 — spell power is additive inside the damage bracket' };
  if (set === 'dmg+sp')      return { name: 'dmg × sp',      expect: 'n × (v−1) × s — a multiplier scales the spell-power bonus too' };
  if (set === 'dmg+dmg')     return { name: 'dmg × dmg',     expect: 'n × (v1−1) × (v2−1)' };
  if (set === 'haste+sp')    return { name: 'haste × sp',    expect: 'Δ(covered casts) × s' };
  if (set === 'dmg+haste')   return { name: 'haste × dmg',   expect: 'Δ(covered casts) × (v−1)' };
  return { name: 'haste × haste', expect: 'd·[1/i(v₁v₂m) + 1/i(m) − 1/i(v₁m) − 1/i(v₂m)] — sign flips at the PAIR threshold' };
}

// ── triples ───────────────────────────────────────────────────────────────────────────────────────
// ★ THE POINT OF A TRIPLE IS THAT THE VALUE COOLDOWNS FORM A CLUSTER. Pairwise, Icy Veins moving to the
// pull surrenders `Δ(covered) × s` — one cast of Icon's bonus. Add Arcane Power and the casts it
// surrenders are worth the CLUSTER's bonus instead:
//     B = 1.30·(1 + s) − 1 = 0.30 + 1.30·s
// which at 1000 SP is 0.4003 against s = 0.0772 — 5.2× dearer. So the haste cooldown should cling to
// the cluster far longer than it clings to Icon alone, and the breakpoint should move a long way up.
// The three-way decomposition that makes this checkable:
//     interaction(all three) = V(abc) − V(a) − V(b) − V(c) + 2·V(none)
//     pairwise sum           = Σ over the three pairs
//     TRIPLE-SPECIFIC term   = interaction(all three) − pairwise sum
// A zero triple-specific term means the pairs tell the whole story and no new rule is needed.
if (args.mode === 'triple' || args.mode === 'triple-breakpoint') {
  const C = String(args.c ?? 'arcanePower');
  if (!api.BUFFS[C]) { console.error(`FACTS-PAIR ERROR: no cooldown "${C}"`); process.exit(2); }
  const KEYS3 = [A, B, C], nameC = api.BUFFS[C].name;
  const sc3 = (ts, h, sp) => scoreOf(Object.fromEntries(KEYS3.map((k, i) => [k, [ts[i]]]).filter(([, v], i) => ts[i] !== null)), h, sp);
  const one = (k, t, h, sp) => scoreOf({ [k]: [t] }, h, sp);

  for (const h of HASTES) for (const sp of SPS) {
    const unit = unitOf(h, sp), zero = scoreOf({}, h, sp).v, t3 = t3Of(h, sp);
    const V = r => r.moved ? null : (r.v - zero) / unit;
    const sB = sOf(B, sp), sC = sOf(C, sp);
    const clusterB = sB !== null && sC !== null ? (1 + sB) * (1 + sC) - 1 : null;
    console.log(`═══ ${nameA} + ${nameB} + ${nameC} — haste ${h}, ${sp} SP, ${CRIT}% crit, T=${T}s ═══`);
    console.log(`    3 stacks from ${t3.toFixed(2)}s, press grid ${STEP}s.`);
    if (clusterB !== null)
      console.log(`    ${nameB} alone is worth s=${sB.toFixed(5)} per covered cast; with ${nameC} the CLUSTER is worth ` +
                  `B=${clusterB.toFixed(5)} — ${(clusterB / sB).toFixed(2)}× dearer to walk away from.`);

    // ⚠ strict `<`, excluding the TERMINAL placement: a window ending exactly at the kill is its own
    // regime (rule 4) and it won the aligned arm at h=450 and h=625, which is not the layout the
    // breakpoint question is about.
    const interior = timesFor(A).filter(t => t >= t3 - 1e-9 && t < T - Math.max(...KEYS3.map(k => api.BUFFS[k].dur)) - 1e-9);
    // the four named layouts the question is about
    const arms = {};
    for (const t of interior) {
      arms.ALIGNED = pick(arms.ALIGNED, V(sc3([t, t, t], h, sp)), `all three @${t}`);
      arms['A at pull'] = pick(arms['A at pull'], V(sc3([0, t, t], h, sp)), `${A}@0, other two @${t}`);
      arms['B at pull'] = pick(arms['B at pull'], V(sc3([t, 0, t], h, sp)), `${B}@0, other two @${t}`);
      arms['C at pull'] = pick(arms['C at pull'], V(sc3([t, t, 0], h, sp)), `${C}@0, other two @${t}`);
      arms['all at pull'] = pick(arms['all at pull'], V(sc3([0, 0, 0], h, sp)), 'all three @0');
    }
    const best = Object.entries(arms).reduce((x, y) => (!x || (y[1] && y[1].v > x[1].v) ? y : x), null);
    for (const [k, a] of Object.entries(arms))
      if (a) console.log(`    ${k.padEnd(12)} ${pad(a.v.toFixed(4), 9)} casts   ${a.how.padEnd(34)}` +
                         `${k === best[0] ? '  ← best' : `  ${(a.v - best[1].v).toFixed(4)}`}`);

    if (args.mode !== 'triple-breakpoint') {
      // the three-way decomposition
      const t = Math.max(...interior.filter(x => x <= interior[Math.floor(interior.length / 2)]));
      const vAll = V(sc3([t, t, t], h, sp));
      const singles = KEYS3.map(k => V(one(k, t, h, sp)));
      const pairs = [[0, 1], [0, 2], [1, 2]].map(([i, j]) => {
        const s2 = {}; s2[KEYS3[i]] = [t]; s2[KEYS3[j]] = [t];
        const v = V(scoreOf(s2, h, sp));
        return v === null ? null : v - singles[i] - singles[j];
      });
      if (vAll !== null && singles.every(x => x !== null) && pairs.every(x => x !== null)) {
        const inter3 = vAll - singles.reduce((x, y) => x + y, 0);
        const pairSum = pairs.reduce((x, y) => x + y, 0);
        console.log(`    ── decomposition at @${t} ──`);
        console.log(`       singles      ${singles.map(x => x.toFixed(4)).join('  ')}`);
        console.log(`       pair terms   ${pairs.map(x => x.toFixed(4)).join('  ')}   (${A}+${B}, ${A}+${C}, ${B}+${C})`);
        console.log(`       total interaction ${inter3.toFixed(4)}   −  pairwise sum ${pairSum.toFixed(4)}   ` +
                    `=  TRIPLE-SPECIFIC ${(inter3 - pairSum).toFixed(4)}`);
      }
    }
    console.log('');
  }
  process.exit(0);
}
function pick(cur, v, how) { return v === null ? cur : (!cur || v > cur.v + 1e-9 ? { v, how } : cur); }

if (args.mode === 'all') {
  // Every unordered pair, at each baseline, judged on the aligned-interior layout.
  const KEYS_ALL = args.buffs ? String(args.buffs).split(',')
                              : ['icyVeins', 'berserking', 'bloodlust', 'mqg', 'skull', 'arcanePower', 'isc', 'scb'];
  for (const h of HASTES) for (const sp of SPS) {
    console.log(`═══ ALL PAIRS — haste ${h}, ${sp} SP, ${CRIT}% crit, T=${T}s ═══`);
    console.log(`   pair                                     | family        | interaction | overlap worth | note`);
    const t3 = t3Of(h, sp), unit = unitOf(h, sp), zero = scoreOf({}, h, sp).v;
    for (let i = 0; i < KEYS_ALL.length; i++) for (let j = i + 1; j < KEYS_ALL.length; j++) {
      const a = KEYS_ALL[i], b = KEYS_ALL[j], rule = ruleFor(a, b);
      const label = `${api.BUFFS[a].name} + ${api.BUFFS[b].name}`;
      // ⚠ BOTH ARMS GET THE SAME SEARCH. The first version fixed the aligned arm at the earliest
      // interior second while giving the disjoint arm a full grid sweep, which handed several pairs a
      // spurious "SEPARATE THEM" — the aligned layout was losing to a better-placed rival, not to
      // separation. Aligned = the best t with both pressed together; disjoint = the best legal
      // non-overlapping pair. Same freedom on each side.
      let al = null, tAl = null;
      for (const t of timesFor(a)) {
        if (t < t3 - 1e-9 || t > T - api.BUFFS[b].dur + 1e-9) continue;
        const r = scoreOf({ [a]: [t], [b]: [t] }, h, sp);
        if (r.moved) continue;
        if (!al || r.v > al.v + 1e-9) { al = r; tAl = t; }
      }
      let note = '';
      if (!al) al = scoreOf({ [a]: [Math.ceil(t3 / STEP) * STEP], [b]: [Math.ceil(t3 / STEP) * STEP] }, h, sp);
      if (al.moved) {
        // the shared on-use trinket lockout is the usual cause, and it is a FACT about the pair
        const locked = ['skull', 'mqg', 'isc'].includes(a) && ['skull', 'mqg', 'isc'].includes(b);
        note = locked ? 'CANNOT overlap — shared on-use trinket lockout' : 'repair moved a press';
        console.log(`   ${label.padEnd(40)} | ${rule.name.padEnd(13)} |      —      |       —       | ${note}`);
        continue;
      }
      const sA = (scoreOf({ [a]: [tAl] }, h, sp).v - zero) / unit;
      const sB = (scoreOf({ [b]: [tAl] }, h, sp).v - zero) / unit;
      const inter = (al.v - zero) / unit - sA - sB;
      // best disjoint layout on the grid, for "is overlapping worth it"
      let bestDis = null;
      for (const ta of timesFor(a)) for (const tb of timesFor(b)) {
        if (Math.min(ta + api.BUFFS[a].dur, tb + api.BUFFS[b].dur) - Math.max(ta, tb) > 1e-9) continue;
        const r = scoreOf({ [a]: [ta], [b]: [tb] }, h, sp);
        if (r.moved) continue;
        const v = (r.v - zero) / unit;
        if (!bestDis || v > bestDis + 1e-9) bestDis = v;
      }
      const alV = (al.v - zero) / unit;
      const worth = bestDis === null ? null : alV - bestDis;
      if (worth !== null && worth < -1e-6) note = 'SEPARATE THEM — aligned loses';
      console.log(`   ${label.padEnd(40)} | ${rule.name.padEnd(13)} | ${pad(inter.toFixed(4), 11)} | ` +
                  `${pad(worth === null ? '—' : worth.toFixed(4), 13)} | ${note}`);
    }
    console.log('');
  }
  process.exit(0);
}

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
