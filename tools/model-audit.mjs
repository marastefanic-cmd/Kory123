// THE END-TO-END AUDIT — does the model's entire cast-by-cast account match a real combat log?
//
//   RUNNER=… node tools/model-audit.mjs [--preset "2:00 lust 0:05"] [--all] [--show 12]
//                                       [--by-cause] [--cache DIR] [--horizon 2.0] [--macro 0.05]
//   node tools/model-audit.mjs --self-check      # the classifier's negative control — no runner needed
//
// `--cache DIR` persists each fight's solved plan + parsed log, keyed on the engine's AND the runner's
// bytes. The gather is the whole cost (a solve plus a sim per fight); the classification is arithmetic.
// With a warm cache the entire 23-fight split re-derives in about a second, so the attribution can be
// re-cut — different horizon, different macro threshold, a new class — without re-running anything.
//
// ── WHY THIS, WHEN THERE ARE ALREADY FOUR GATES ──────────────────────────────────────────────────
// `window-span`, `credit-check`, `press-fire` and `lattice-drift` each check ONE thing on a
// purpose-built one-press fight. Every scoring bug this phase found was invisible to some of them and
// visible to none until it was looked for specifically — and two of them CANCELLED, so a narrow probe
// passed on a broken engine. This is the wide check: take a plan the tool actually emits, run it, and
// compare **everything the model claims, cast for cast**.
//
// ── WHAT IS CHECKABLE, AND WHAT IS NOT ───────────────────────────────────────────────────────────
// Deterministic and therefore checked, per Arcane Blast:
//   · the cast COUNT
//   · each cast's START time                     — the lattice
//   · each cast's CAST TIME                      — the haste snapshot (fixed at cast start)
//   · the SPELL POWER the cast used              — the value snapshot (read at cast completion)
//   · the DAMAGE MULTIPLIER the cast got         — Arcane Power, Tirisfal 2pc
//
// NOT checkable and deliberately not compared: the per-cast base-damage ROLL (668–772, a real RNG draw
// even at `--var 0`) and crit (a constant factor that cancels out of "effective ABs" by construction —
// CLAUDE.md's objective). The multiplier is recovered as `AfterAttackerMods / BaseDamage`, which
// divides the roll out.
//
// ⚠ ONE KNOWN, LOGGED DIFFERENCE IS SUBTRACTED, NOT IGNORED: the bench character wears Tirisfal 4pc,
// whose +70 SP proc (`SpellID: 37444`) the model does not schedule — it is a proc, and RULES §14 says
// procs are counted, never planned. Its windows are read out of the log and removed from the sim's SP
// before comparing, so the audit tests the model's own claims rather than punishing it for a proc it
// deliberately does not model. Anything else that differs is a real disagreement.
// ★ …and that subtraction was itself WRONG until 2026-07-27, in the exact way the model used to be:
// it read the proc window with the wrong edge rule and charged the model for it. See `procTools`.
//
// ══ ⚠⚠ A PASS COUNT IS MEANINGLESS UNTIL THE RESIDUE IS ATTRIBUTED — READ THIS ════════════════════
// **Part of the disagreement this tool reports is EXPECTED BY DESIGN.** At an **AoE phase start** the
// model treats the wall as a CUT BY POLICY (PHASE13 §1): the in-flight Arcane Blast is **cancelled**
// (credited only the fraction that fit) and the Arcane Explosion lattice restarts **at the wall**.
// **wowsims' APL has no cancel action** — it finishes the Blast and lands it for full damage, and its
// AE stream therefore starts at the Blast's natural end. So the model and the sim are *supposed* to
// disagree there, and everything downstream of the wall inherits that offset. Counting it against the
// model is counting a deliberate modelling decision as a bug.
//
// ⇒ `--by-cause` splits the residue by LOCATION, so the pass count means something:
//     · `aoe`        — a Blast in flight ACROSS an AoE wall  → PRICED, not a defect (PHASE13 §1)
//     · `aoexit`     — the AoE phase's far edge (AE lattice) → a finding; §1's ruling does NOT cover it
//     · `inter`      — at an intermission edge               → a finding, localised
//     · `ramp`       — the opening ramp                      → a finding, localised
//     · `window`     — at a buff-window edge, no phase near  → a finding: window membership
//     · `proc`       — the Tirisfal subtraction's own edge   → THIS TOOL's error, not the model's
//     · `none`       — no boundary anywhere near             → the genuinely unexplained residue
// plus a `ms-lattice` bucket for everything under `--macro` (default 50 ms): wowsims takes 334 ms per
// Arcane Blast stack where the model takes 1/3 s and rounds every cast to the millisecond, so the two
// grids sit a few ms apart for a whole fight. That is a KNOWN, NAMED cause (MECHANICS §1.1), and it is
// most of what the raw counts used to be.
//
// ★ And the classifier reports EVENTS, not raw counts: two lattices that diverged once and then ran in
// parallel disagree on every later cast, and calling that "40 mismatches" is 39 double-counts. A
// mismatch is an EVENT only where the model↔sim offset *changes*; the rest is `carry` and inherits its
// originating event's class. Casts are matched by TIME, not by index — one extra cast on either side
// makes index `i` name different casts and turns a single defect into a whole-fight tail of noise
// (Lady Vashj's index-aligned "worst start deviation 15.01 s" is one phantom cast, not a 15 s error).
// See `docs/TOOLING.md`'s standing-divergence block.
//
// ⛔ The classifier EXPLAINS; it must never SUPPRESS. The PASS/FAIL verdict and the four mismatch
// counts above it are computed exactly as before and are unaffected by any of this — an instrument
// that launders the defect it was built to catch is this repo's most expensive recurring failure
// (PHASE13 §8). The corrected pass count is printed BESIDE the real one, never instead of it.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { loadEngine, cfgFor } from './engine-node.mjs';
import { REF } from './reference-gear.mjs';
import { planToSpec } from '../sim/planspec.mjs';
import { build, CAST_STREAM_IDS } from './genapl-core.mjs';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const RUNNER = process.env.RUNNER || '/tmp/wowsims-build/tbc-new/runner-ap180';
const argv = process.argv.slice(2);
const flag = (n, d) => { const i = argv.indexOf(`--${n}`); return i < 0 ? d : argv[i + 1]; };
const has = n => argv.includes(`--${n}`);
const ENGINE = process.env.ENGINE || path.join(REPO, 'index.html');
const CACHE = flag('cache', null);
const SHOW = +flag('show', '10');
const HORIZON = +flag('horizon', '2.0');   // seconds: how close a boundary must be to own an event
const T5_PROC_SP = 70;     // Tirisfal 4pc, SpellID 37444 — logged, and subtracted (see header)
// the log prints 2 dp for times and 1 dp for SP, so those are the resolution floors
const TOL = { t: 0.011, cast: 0.0011, sp: 0.15, mult: 0.002 };

// A cached record must be invalidated by anything that could change it. The engine's bytes decide the
// plan; the runner's bytes decide the log. Keying on the preset name alone is the cache-key bug this
// repo has hit twice (PHASE13 §4.1/§8) — so both go in, and a stale record is recomputed, not served.
const sha1 = b => crypto.createHash('sha1').update(b).digest('hex').slice(0, 16);
const cacheKey = () => sha1(fs.readFileSync(ENGINE)) + '-' +
  (fs.existsSync(RUNNER) ? sha1(fs.readFileSync(RUNNER)) : 'no-runner');

const api = loadEngine(ENGINE);
const picked = has('all') ? api.cases
  : api.cases.filter(c => c.name === flag('preset', '2:00 lust 0:05'));
if (!picked.length) { console.error(`no such preset — try --all or one of:\n  ${api.cases.map(c => c.name).join('\n  ')}`); process.exit(2); }

const slug = n => n.replace(/\W+/g, '_');
const cachePath = n => CACHE && path.join(CACHE, `${slug(n)}.json`);

// ── GATHER: solve the plan, run the sim, parse the log into a plain-JSON record ───────────────────
// Split out from the comparison so the classification can be re-derived without re-running a ~9-minute
// solve+sim sweep (`--cache DIR`). The record holds only what both accounts assert; every judgement
// happens downstream of it.
async function gather(kase) {
  // ★★ THE MODEL MUST DESCRIBE THE CHARACTER THE SIM RUNS. `cfgFor` gives the PRESET's gear; the sim
  // below runs `tools/bench/export.json`. Spreading REF moves the model onto that character, exactly
  // as `tools/bench.mjs` does — reference-gear.mjs's whole reason for existing.
  // ⚠ Skipping this is not a small error and it is not hypothetical: it is PHASE8 §6/§7's recorded
  // defect, and it cost this audit an hour. Without REF the model ran with `t5two: false` against a
  // character wearing Tirisfal 2pc, so every cast's damage multiplier looked wrong by exactly the 2pc,
  // and Arcane Power looked like ×1.25 in the sim against the model's ×1.30. Both were artefacts.
  const cfg = { ...cfgFor(api, kase), ...REF };
  const best = await api.optimizeAsync(cfg, 3, () => {});
  const optR = api.simulate(best.s, cfg, true);
  const A = planToSpec({ cfg, best, optR }, api.BUFFS);
  // ⚠ A SKIP RECORD CARRIES THE CACHE KEY TOO. Without `v`/`key` it never validates, so every run
  // re-solved the untranscribable fights and printed "cache stale" at them — a warning that means
  // "your engine changed" firing when nothing had.
  const stub = why => ({ v: 1, key: cacheKey(), name: kase.name, skip: why });
  if (A.burn) return stub('burn phase, not simmable');
  if (A.skipped.length) return stub(`untranscribable: ${A.skipped.join(', ')}`);

  const apl = `/tmp/audit-${slug(kase.name)}.json`, log = apl + '.log';
  fs.writeFileSync(apl, JSON.stringify(build(A.spec)));
  const args = ['--export', path.join(REPO, 'tools/bench/export.json'), '--apl', apl,
    '--dur', String(cfg.T), '--var', '0', '--iter', '1', '--seed', '11',
    '--mana', '100000000', '--haste', String(cfg.hasteRating), '--quiet'];
  if (A.targets) args.push('--targets', String(A.targets));
  try {
    execFileSync(RUNNER, args, { env: { ...process.env, SIMLOG: '1' }, maxBuffer: 1 << 28,
      stdio: ['ignore', fs.openSync(log, 'w'), fs.openSync(log, 'a')] });
  } catch { /* the log is the instrument */ }
  const txt = fs.readFileSync(log, 'utf8');

  // ── the sim's own account ──────────────────────────────────────────────────────────────────────
  // ⚠ LOG-FORMAT FACT (add it to TOOLING's list): durations are Go's `Duration.String()`, so the UNIT
  // CHANGES with the magnitude — `Cast Time = 2.083s` but `Cast Time = 960ms, GCD = 1s` once the value
  // drops under a second. A regex anchored on `([0-9.]+)s` silently matches only the slow casts: on a
  // Lust plan it found 72 of 94 and dropped exactly the fast ones, i.e. the casts a haste audit is
  // most about. Parse the unit.
  const dur = (v, u) => +v * (u === 'ms' ? 0.001 : 1);
  const castsOf = id => [...txt.matchAll(new RegExp(
    `\\[\\s*([0-9.]+)\\]\\s*\\[Player[^\\]]*\\] Casting \\{SpellID: ${id}\\}[^\\n]*Cast Time = ([0-9.]+)(ms|s)[,)]`, 'g'))]
    .map(m => ({ t: +m[1], cast: dur(m[2], m[3]) }));
  const casts = castsOf(CAST_STREAM_IDS.AB);
  // The AE stream is NOT graded (the model's AoE credit is a policy call, header) — it is parsed so the
  // AoE-wall divergence can be SHOWN rather than asserted: the model restarts the AE lattice at the
  // wall, the sim at the cancelled Blast's natural end, and that is visible in one line of the log.
  const simAE = castsOf(CAST_STREAM_IDS.AE);
  const dbg = [...txt.matchAll(/\[\s*([0-9.]+)\][^\n]*\{SpellID: 30451\} \[DEBUG\][^\n]*SP: ([0-9.]+),\s*BaseDamage:([0-9.]+),\s*AfterAttackerMods:([0-9.]+)/g)]
    .map(m => ({ tc: +m[1], sp: +m[2], base: +m[3], after: +m[4] }));
  // the Tirisfal 4pc proc windows, so its +70 SP can be removed
  const gains = [...txt.matchAll(/\[\s*([0-9.]+)\][^\n]*Gained \{"SpellDamage": 70\.000,\} from \{SpellID: 37444\}/g)].map(m => +m[1]);
  const fades = [...txt.matchAll(/\[\s*([0-9.]+)\][^\n]*Aura faded: \{SpellID: 37444\}/g)].map(m => +m[1]);
  if (!casts.length || !dbg.length) { console.error(`ERROR: ${kase.name}: no AB casts parsed from ${log}`); process.exit(2); }

  return {
    v: 1, key: cacheKey(), name: kase.name, T: cfg.T, haste: cfg.hasteRating,
    sp: cfg.sp, t5two: !!cfg.t5two,
    // the FULL model board (AE casts included) — the comparison filters, the classifier needs them
    model: optR.casts.map(c => ({ t: c.t, cast: c.cast, castDn: c.castDn, sp: c.sp,
      dmgMult: c.dmgMult, stacks: c.stacks, ae: !!c.ae, frac: c.frac })),
    sim: casts, simAE, dbg, gains, fades,
    segments: (cfg.segments || []).map(s => ({ start: s.start, end: s.end, type: s.type, targets: s.targets | 0 })),
    actEff: optR.actEff || {},
    bufDur: Object.fromEntries(Object.entries(api.BUFFS).map(([k, d]) => [k, d.dur])),
    bufVal: Object.fromEntries(Object.entries(api.BUFFS).map(([k, d]) => [k, { kind: d.kind, value: d.value }])),
  };
}

async function record(kase) {
  const p = cachePath(kase.name);
  if (p && fs.existsSync(p)) {
    try {
      const r = JSON.parse(fs.readFileSync(p, 'utf8'));
      if (r.key === cacheKey() && r.v === 1) return r;
      console.log(`      (cache stale for ${kase.name} — engine or runner changed; re-gathering)`);
    } catch { /* corrupt cache entry: re-gather */ }
  }
  const r = await gather(kase);
  if (p) { fs.mkdirSync(CACHE, { recursive: true }); fs.writeFileSync(p, JSON.stringify(r)); }
  return r;
}

// ── ALIGNMENT ────────────────────────────────────────────────────────────────────────────────────
// ⚠ WHY NOT COMPARE BY INDEX. When one side has a cast the other does not, index `i` stops naming the
// same cast on both sides and EVERY later comparison is against the wrong partner: Lady Vashj's
// index-aligned "worst start deviation 15.01 s" is one desync, not a 15-second modelling error. So the
// classifier aligns on TIME (global, monotone, gaps allowed) and reports what is unmatched. The
// headline verdict above still uses the index comparison, unchanged — this replaces no number, it
// explains one.
function alignByTime(mt, st, tol = 0.75, gap = 0.5) {
  const n = mt.length, m = st.length, INF = 1e18;
  const D = [], P = [];
  for (let i = 0; i <= n; i++) { D.push(new Float64Array(m + 1).fill(INF)); P.push(new Int8Array(m + 1)); }
  D[0][0] = 0;
  for (let i = 1; i <= n; i++) { D[i][0] = D[i - 1][0] + gap; P[i][0] = 1; }
  for (let j = 1; j <= m; j++) { D[0][j] = D[0][j - 1] + gap; P[0][j] = 2; }
  for (let i = 1; i <= n; i++) for (let j = 1; j <= m; j++) {
    let best = D[i - 1][j] + gap, p = 1;
    if (D[i][j - 1] + gap < best) { best = D[i][j - 1] + gap; p = 2; }
    const d = Math.abs(mt[i - 1] - st[j - 1]);
    if (d <= tol && D[i - 1][j - 1] + d < best) { best = D[i - 1][j - 1] + d; p = 0; }
    D[i][j] = best; P[i][j] = p;
  }
  const pairs = [], loneM = [], loneS = [];
  let i = n, j = m;
  while (i > 0 || j > 0) {
    const p = i === 0 ? 2 : j === 0 ? 1 : P[i][j];
    if (p === 0) { pairs.push([i - 1, j - 1]); i--; j--; }
    else if (p === 1) { loneM.push(--i); }
    else { loneS.push(--j); }
  }
  pairs.reverse(); loneM.reverse(); loneS.reverse();
  return { pairs, loneM, loneS };
}

// ── THE CAUSE CLASSIFIER ─────────────────────────────────────────────────────────────────────────
// ★ TWO REGIMES, AND CONFLATING THEM IS WHAT MADE THE OLD NUMBER UNREADABLE. The start/cast-time
// residue splits cleanly by MAGNITUDE, and the two halves have different causes and different fixes:
//
//   · |Δ| < MACRO — the MILLISECOND LATTICE. wowsims takes 334 ms per Arcane Blast stack where the
//     model takes 1/3 s, and rounds every cast with `.Round(time.Millisecond)` (MECHANICS §1.1,
//     sim/planspec.mjs header). The two grids therefore sit a few ms apart and stay there. Measured
//     here: a FLAT ~10 ms for a whole 135 s fight. It is a KNOWN, NAMED cause — not a mystery — and a
//     fight whose entire residue is this is failing the audit's 11 ms tolerance, not the physics.
//   · |Δ| ≥ MACRO — a real placement disagreement, worth a location. A cast is ≥ 1 s, so 50 ms is
//     ~5 % of the shortest possible one: comfortably above the lattice and far below anything that
//     could be a cast.
//
// ⚠ THE THRESHOLD IS NOT A TOLERANCE. Nothing is forgiven by landing under it — the headline
// PASS/FAIL never sees it. It only decides which bucket the explanation goes in.
const MACRO = +flag('macro', '0.05');
// ⚠ ONLY THE AoE **START** IS THE PRICED CLASS. PHASE13 §1's ruling is about the Blast in flight
// ACROSS THE WALL — the model cancels it, wowsims lands it. The AoE phase's **exit** is a different
// question with no ruling behind it: both sides simply resume Arcane Blast after an Arcane Explosion
// stream, and if they resume at different instants that is the AE lattice disagreeing, which is a
// finding. Folding the exit into the priced bucket would forgive a defect using a ruling that does not
// cover it — so they are two classes, and `aoexit` counts against the model.
const CLASSES = ['aoe', 'aoexit', 'inter', 'ramp', 'window', 'proc', 'none'];
const CLASS_LABEL = {
  aoe:    'AoE wall / start (PRICED, §1)',
  aoexit: 'AoE phase exit (AE lattice)',
  inter:  'intermission edge',
  ramp:   'opening ramp',
  window: 'buff-window edge',
  proc:   'Tirisfal 4pc proc edge (tool)',
  none:   'UNEXPLAINED (no boundary near)',
};

function boundaries(rec) {
  const b = [];
  for (const s of rec.segments) {
    if (s.type === 'aoe') { b.push({ kind: 'aoe', t: s.start, what: 'AoE start' }); b.push({ kind: 'aoexit', t: s.end, what: 'AoE end' }); }
    else if (s.type === 'intermission') { b.push({ kind: 'inter', t: s.start, what: 'intermission start' }); b.push({ kind: 'inter', t: s.end, what: 'intermission end' }); }
  }
  return b;
}
// Every buff window edge, in the space the model reads it in. HASTE is snapshotted at a cast's START
// and VALUE at its COMPLETION (PHASE12 §6.12), so a haste-window edge and an sp/dmg-window edge are
// asked about different instants — the caller passes whichever applies to the column it is grading.
function windowEdges(rec) {
  const w = [];
  for (const [k, times] of Object.entries(rec.actEff || {})) {
    const d = rec.bufDur[k], v = rec.bufVal[k];
    if (d === undefined) continue;
    for (const t of times) { w.push({ k, t, edge: 'open', kind: v.kind, value: v.value }); w.push({ k, t: t + d, edge: 'close', kind: v.kind, value: v.value }); }
  }
  return w.sort((a, b) => a.t - b.t);
}
const distTo = (a, b, x) => x < a ? a - x : x > b ? x - b : 0;   // distance from x to the span [a,b]

// ── the Tirisfal 4pc proc, subtracted correctly ──────────────────────────────────────────────────
// ⚠⚠ THIS TOOL BROKE ITS OWN RULE AND THE BUG COST 70 SP ON EVERY CAST OF A FIGHT. The proc window is
// `(gain, fade]` — the SAME open-left/closed-right window PHASE12 §6.12a measured for every other
// value buff — because a cast completing exactly ON the gain does not get it. `procUp` tested
// `gain <= tc`, so a cast completing exactly on a gain was treated as buffed and had 70 subtracted
// from an SP that never contained it. That value then became the MINIMUM, i.e. the unbuffed baseline
// every other cast is measured against, and the whole fight read +70 in the sim column: `4:00 lust
// 0:05` reported 14 spell-power mismatches, every one of them the tool's.
// ★ The control that catches it: with the window right, the baseline recovered by subtracting the proc
// must equal the raw minimum SP — buffs and procs only ADD, so the lowest raw SP already IS unbuffed.
// If the two disagree the subtraction is wrong, and the audit says so instead of grading with it.
function procTools(rec) {
  // up ⟺ some gain is strictly before `t` and its fade is not yet strictly before it — i.e. the window
  // `(gain, fade]`. BOTH tests are strict, and that is the whole content of the rule: a cast completing
  // exactly ON the gain misses the buff, and one completing exactly ON the fade keeps it.
  const up = t => {
    let n = 0;
    for (const g of rec.gains) if (g < t - 1e-9) n++;
    for (const f of rec.fades) if (f < t - 1e-9) n--;
    return n > 0;
  };
  const baseSp = Math.min(...rec.dbg.map(x => x.sp - (up(x.tc) ? T5_PROC_SP : 0)));
  const rawMin = Math.min(...rec.dbg.map(x => x.sp));
  const bad = Math.abs(baseSp - rawMin) > 0.05;
  return { up, baseSp, rawMin, bad };
}

// Which boundary, if any, owns an event on model cast `mc`? `probe` is the instant that column is
// read at — the cast's span for a start/haste question, its completion for a value question.
function classify(mc, bnds, wins, kinds, probeLo, probeHi) {
  let best = null;
  for (const b of bnds) {
    const d = distTo(probeLo, probeHi, b.t);
    if (d <= HORIZON && (!best || d < best.d)) best = { cls: b.kind, d, why: `${b.what} @${b.t.toFixed(0)}` };
  }
  if (best) return best;
  if (mc.stacks < 3 && probeHi < 12) return { cls: 'ramp', d: 0, why: `opening ramp (stacks ${mc.stacks})` };
  let bw = null;
  for (const w of wins) {
    if (kinds && !kinds.includes(w.kind)) continue;
    const d = distTo(probeLo, probeHi, w.t);
    if (d <= HORIZON && (!bw || d < bw.d)) bw = { cls: 'window', d, why: `${w.k} ${w.edge} @${w.t.toFixed(2)}` };
  }
  if (bw) return bw;
  return { cls: 'none', d: Infinity, why: 'no boundary within ' + HORIZON.toFixed(1) + 's' };
}

const HASTE_KINDS = ['mult', 'rating', 'proc'];      // buffs that move the cast TIME
const VALUE_KINDS = ['sp', 'dmg'];                    // buffs that move SP / damage multiplier

function analyse(rec) {
  const M = rec.model.filter(c => !c.ae);
  const S = rec.sim;
  const bnds = boundaries(rec), wins = windowEdges(rec);
  const { pairs, loneM, loneS } = alignByTime(M.map(c => c.t), S.map(c => c.t));

  const baseMult = Math.min(...rec.dbg.filter(x => x.base > 0).map(x => x.after / x.base));
  const { up: procUp, baseSp } = procTools(rec);

  const out = { events: [], carry: { t: 0 }, lone: [], counts: {},
    micro: { t: 0, cast: 0, worstT: 0, worstCast: 0 } };
  for (const c of CLASSES) out.counts[c] = { t: 0, cast: 0, sp: 0, mult: 0, carryT: 0 };

  // unmatched casts — one side asserts a cast the other never makes. Its own kind of finding.
  for (const i of loneM) out.lone.push({ side: 'model', i, t: M[i].t, frac: M[i].frac, ...classify(M[i], bnds, wins, null, M[i].t, M[i].t + M[i].cast) });
  for (const j of loneS) out.lone.push({ side: 'sim', j, t: S[j].t, ...classify({ stacks: 3 }, bnds, wins, null, S[j].t, S[j].t + S[j].cast) });

  let prevOff = null, lastEvent = null;
  for (const [i, j] of pairs) {
    const m = M[i], s = S[j];
    const d = rec.dbg.find(x => Math.abs(x.tc - (s.t + s.cast)) < 0.06) || rec.dbg[j];
    const simSp = d ? d.sp - (procUp(d.tc) ? T5_PROC_SP : 0) - baseSp : null;
    const simMult = d && d.base > 0 ? (d.after / d.base) / baseMult : null;
    const mSp = m.sp - rec.sp, mMult = m.dmgMult / (rec.t5two ? 1.2 : 1);
    const off = s.t - m.t;
    const dc = Math.abs(s.cast - m.castDn);
    const ds = simSp === null ? 0 : Math.abs(simSp - mSp);
    const dm = simMult === null ? 0 : Math.abs(simMult - mMult);

    // ★ START: an EVENT only where the offset CHANGES by a MACRO step. Two lattices that parted once
    // and then ran in parallel disagree on every later cast; counting each is 1 finding and N−1 echoes
    // of it. Below MACRO the offset is the millisecond lattice and gets its own bucket.
    if (Math.abs(off) > TOL.t) {
      const jump = prevOff === null ? Math.abs(off) : Math.abs(off - prevOff);
      if (Math.abs(off) < MACRO) { out.micro.t++; out.micro.worstT = Math.max(out.micro.worstT, Math.abs(off)); }
      else if (jump >= MACRO) {
        const c = classify(m, bnds, wins, HASTE_KINDS, m.t, m.t + m.cast);
        lastEvent = c.cls;
        out.events.push({ col: 'start', i, j, t: m.t, st: s.t, delta: off, jump, ...c });
        out.counts[c.cls].t++;
      } else { out.carry.t++; out.counts[lastEvent || 'none'].carryT++; }
    }
    prevOff = off;

    if (dc > TOL.cast) {
      if (dc < MACRO) { out.micro.cast++; out.micro.worstCast = Math.max(out.micro.worstCast, dc); }
      else {
        const c = classify(m, bnds, wins, HASTE_KINDS, m.t, m.t + m.cast);
        out.events.push({ col: 'cast', i, j, t: m.t, m: m.castDn, s: s.cast, delta: s.cast - m.castDn, ...c });
        out.counts[c.cls].cast++;
      }
    }
    // VALUE columns are read at the cast's COMPLETION (PHASE12 §6.12), so probe there.
    if (ds > TOL.sp) {
      // ⚠ THE TOOL'S OWN SUBTRACTION HAS AN EDGE, and it must not be charged to the model. The header
      // removes the Tirisfal 4pc +70 SP proc from the sim's SP by reading its gain/fade lines; a cast
      // completing ON one of those instants can fall on the wrong side of `procUp`'s `<=`, leaving a
      // residue of EXACTLY 70. No modelled buff is worth 70 SP, so the value is unambiguous — but the
      // classification is still gated on a proc edge actually being nearby, so a genuine 70 elsewhere
      // stays visible.
      const procEdge = [...rec.gains, ...rec.fades].some(e => Math.abs(e - (m.t + m.cast)) <= HORIZON);
      let c = Math.abs(ds - T5_PROC_SP) < 0.6 && procEdge
        ? { cls: 'proc', d: 0, why: `Tirisfal 4pc +${T5_PROC_SP} SP proc edge — the tool's subtraction, not the model` }
        : classify(m, bnds, wins, VALUE_KINDS, m.t + m.cast, m.t + m.cast);
      const named = Object.entries(rec.bufVal).find(([, v]) => v.kind === 'sp' && Math.abs(v.value - ds) < 0.6);
      out.events.push({ col: 'sp', i, j, t: m.t, tc: m.t + m.cast, m: mSp, s: simSp, delta: simSp - mSp,
        exact: named ? named[0] : null, ...c });
      out.counts[c.cls].sp++;
    }
    if (dm > TOL.mult) {
      const c = classify(m, bnds, wins, VALUE_KINDS, m.t + m.cast, m.t + m.cast);
      out.events.push({ col: 'mult', i, j, t: m.t, tc: m.t + m.cast, m: mMult, s: simMult, delta: simMult - mMult, ...c });
      out.counts[c.cls].mult++;
    }
  }
  out.pairs = pairs.length;
  return out;
}

// ── THE NEGATIVE CONTROL (`--self-check`) ────────────────────────────────────────────────────────
// ⚠ PHASE13 §8: "every new instrument needs a control that must fail before its green is believed",
// and the specific failure this classifier could have is the one §1 warns about — quietly filing a
// real defect under a priced heading. So the control feeds it synthetic fights whose right answers are
// known by construction, INCLUDING a fight with no AoE phase at all whose whole residue is a macro
// mismatch: if that ever comes back "explained", the classifier is laundering. It needs no runner.
function selfCheck() {
  const bufDur = { scb: 15, isc: 20 }, bufVal = { scb: { kind: 'sp', value: 225 }, isc: { kind: 'sp', value: 155 } };
  // 40 casts, 1.5 s apart, model and sim identical unless `bend` moves one sim cast onward.
  const mk = (segments, bendAt, bendBy) => {
    const model = [], sim = [], dbg = [];
    for (let i = 0; i < 40; i++) {
      const t = i * 1.5, off = i >= bendAt ? bendBy : 0;
      model.push({ t, cast: 1.5, castDn: 1.5, sp: 1000, dmgMult: 1, stacks: 3, ae: false, frac: 1 });
      sim.push({ t: t + off, cast: 1.5 });
      dbg.push({ tc: t + off + 1.5, sp: 1000, base: 700, after: 700 });
    }
    return { v: 1, key: '', name: 'self-check', T: 60, haste: 0, sp: 1000, t5two: false,
      model, sim, simAE: [], dbg, gains: [], fades: [], segments, actEff: {}, bufDur, bufVal };
  };
  const seg = (a, z, type) => [{ start: 0, end: a, type: 'normal', targets: 0 },
    { start: a, end: z, type, targets: 6 }, { start: z, end: 60, type: 'normal', targets: 0 }];
  const probes = [
    // name                            record                             what MUST come back
    ['interior mismatch ⇒ none',       mk([], 20, 0.5),                   a => a.counts.none.t === 1 && a.counts.aoe.t === 0],
    ['mismatch at an AoE start ⇒ aoe', mk(seg(30, 45, 'aoe'), 20, 0.5),   a => a.counts.aoe.t === 1],
    ['mismatch at an AoE end ⇒ aoexit',mk(seg(15, 30, 'aoe'), 20, 0.5),   a => a.counts.aoexit.t === 1 && a.counts.aoe.t === 0],
    ['mismatch at an intermission ⇒ inter', mk(seg(30, 45, 'intermission'), 20, 0.5), a => a.counts.inter.t === 1],
    // 20 ms: above the audit's 11 ms resolution floor (so it IS a mismatch) but below MACRO.
    ['20 ms offset ⇒ ms-lattice, NOT none', mk([], 20, 0.020),            a => a.micro.t === 20 && a.counts.none.t === 0],
    ['a parallel shift is ONE event, not 20', mk([], 20, 0.5),            a => a.events.filter(e => e.col === 'start').length === 1 && a.carry.t === 19],
    // ⛔ THE LAUNDERING CONTROL: no AoE segment exists, so nothing may be filed under `aoe`.
    ['no AoE phase ⇒ aoe bucket empty', mk([], 20, 0.5),                  a => a.counts.aoe.t + a.counts.aoe.cast + a.counts.aoe.sp + a.counts.aoe.mult === 0],
  ];
  let bad = 0;
  for (const [name, rec, want] of probes) {
    const a = analyse(rec);
    const okp = want(a);
    if (!okp) bad++;
    console.log(`  ${okp ? 'ok  ' : 'FAIL'}  ${name}` + (okp ? '' :
      `   got: ${CLASSES.map(c => `${c}=${a.counts[c].t}`).join(' ')} micro=${a.micro.t} carry=${a.carry.t} events=${a.events.length}`));
  }
  console.log(bad ? `\n✗ ${bad} of ${probes.length} control(s) failed — the classifier does not mean what it prints.`
    : `\n✓ ${probes.length} controls pass: each synthetic defect lands in the bucket it belongs in, and a`
      + '\n  fight with no AoE phase cannot be filed under the priced AoE heading.');
  process.exit(bad ? 2 : 0);
}
if (has('self-check')) selfCheck();

// ═══ MAIN ════════════════════════════════════════════════════════════════════════════════════════
if (!fs.existsSync(RUNNER) && !(CACHE && picked.every(k => fs.existsSync(cachePath(k.name))))) {
  console.log('# model-audit — SKIPPED LOUDLY: no RUNNER.');
  console.log('  The committed sim/sim.wasm exposes no combat log, and this audit IS a log walk.');
  console.log('  Re-run with RUNNER=<path to runner-ap180> (docs/TOOLING.md "Building the runner").');
  process.exit(0);
}

let failures = 0, audited = 0, aoeOnly = 0, microOnly = 0;
const TOTAL = {}; for (const c of CLASSES) TOTAL[c] = { t: 0, cast: 0, sp: 0, mult: 0, carryT: 0 };
const MICRO = { t: 0, cast: 0, worstT: 0, worstCast: 0 };
let totalCarry = 0, totalLone = 0;
const perFight = [];

for (const kase of picked) {
  const rec = await record(kase);
  if (rec.skip) { console.log(`  SKIP  ${rec.name} — ${rec.skip}`); continue; }

  // ── compare, cast for cast ─────────────────────────────────────────────────────────────────────
  // ⚠ COMPARE BUFF DELTAS, NOT ABSOLUTES. The model's `sp` is its declared spell power and `dmgMult`
  // is normalised so 1.0 = no cooldowns; the sim reports the character's real SP and a multiplier that
  // already contains talents and set bonuses. Comparing those raw measures the GEAR CALIBRATION, which
  // is a different question and drowns the one being asked. Each side is therefore referred to its own
  // unbuffed baseline, so what is graded is exactly the model's buff accounting.
  const M = rec.model.filter(c => !c.ae), casts = rec.sim, dbg = rec.dbg;
  const { up: procUp, baseSp, rawMin, bad: procBad } = procTools(rec);
  if (procBad) console.log(`  ⚠ ${rec.name}: proc-subtraction control FAILED — baseline ${baseSp.toFixed(1)} vs raw min ` +
    `${rawMin.toFixed(1)}. The SP column below is the TOOL's error, not the model's (see procTools).`);
  const baseMult = Math.min(...dbg.filter(x => x.base > 0).map(x => x.after / x.base));
  const n = Math.min(M.length, casts.length);
  let badT = 0, badCast = 0, badSp = 0, badMult = 0;
  let wT = 0, wC = 0, wS = 0, wM = 0;
  const rows = [];
  for (let i = 0; i < n; i++) {
    const m = M[i], s = casts[i];
    const d = dbg.find(x => Math.abs(x.tc - (s.t + s.cast)) < 0.06) || dbg[i];
    // each side's BUFF contribution, referred to its own unbuffed baseline
    const simSp = d ? d.sp - (procUp(d.tc) ? T5_PROC_SP : 0) - baseSp : null;
    const simMult = d && d.base > 0 ? (d.after / d.base) / baseMult : null;
    const mSp = m.sp - rec.sp, mMult = m.dmgMult / (rec.t5two ? 1.2 : 1);
    const dt = Math.abs(s.t - m.t), dc = Math.abs(s.cast - m.castDn);
    const ds = simSp === null ? 0 : Math.abs(simSp - mSp);
    const dm = simMult === null ? 0 : Math.abs(simMult - mMult);
    if (dt > TOL.t) badT++;
    if (dc > TOL.cast) badCast++;
    if (ds > TOL.sp) badSp++;
    if (dm > TOL.mult) badMult++;
    if (dt > wT) wT = dt; if (dc > wC) wC = dc; if (ds > wS) wS = ds; if (dm > wM) wM = dm;
    if (rows.length < SHOW) rows.push({ i, m, s, simSp, simMult, mSp, mMult, dt, dc, ds, dm });
  }

  // ⚠ REPORT THE MAGNITUDE, NOT JUST A COUNT AGAINST A THRESHOLD. A count says "17 of 314 casts
  // disagree" whether the disagreement is 12 ms of accumulated rounding or a whole cast — and those
  // need completely different responses. The worst deviation per column is the number that tells you
  // which.
  const countOk = M.length === casts.length;
  const ok = countOk && !badT && !badCast && !badSp && !badMult;
  if (!ok) failures++;
  audited++;
  console.log(`\n${ok ? 'PASS' : 'FAIL'}  ${rec.name}  (T=${rec.T}, ${rec.haste} haste)`);
  console.log(`      casts: model ${M.length} · sim ${casts.length}${countOk ? '' : '   ⛔ COUNT DIFFERS'}`);
  console.log(`      per-cast mismatches — start ${badT} · cast time ${badCast} · spell power ${badSp} · damage mult ${badMult}   (of ${n})`);
  console.log(`      worst deviation     — start ${wT.toFixed(4)}s · cast ${wC.toFixed(4)}s · SP ${wS.toFixed(1)} · mult ${wM.toFixed(4)}`);

  // ── the cause split ────────────────────────────────────────────────────────────────────────────
  const A = analyse(rec);
  for (const c of CLASSES) for (const k of ['t', 'cast', 'sp', 'mult', 'carryT']) TOTAL[c][k] += A.counts[c][k];
  MICRO.t += A.micro.t; MICRO.cast += A.micro.cast;
  MICRO.worstT = Math.max(MICRO.worstT, A.micro.worstT); MICRO.worstCast = Math.max(MICRO.worstCast, A.micro.worstCast);
  totalCarry += A.carry.t; totalLone += A.lone.length;
  const seg = c => { const x = A.counts[c]; return x.t + x.cast + x.sp + x.mult; };
  // ⚠ EVERY residue item must land in exactly one of these three, or the classifier is laundering.
  // `nonAoe` therefore counts the ms-lattice bucket, the carry and the unmatched casts too — an
  // earlier draft summed only the located events and duly declared a fight with no AoE phase at all
  // "AoE-wall ONLY". That is §8's self-flattering instrument, caught by its own output.
  const aoeTot = seg('aoe') + A.lone.filter(l => l.cls === 'aoe').length;
  const nonAoe = CLASSES.filter(c => c !== 'aoe').reduce((a, c) => a + seg(c), 0)
    + A.lone.filter(l => l.cls !== 'aoe').length + A.micro.t + A.micro.cast + A.carry.t;
  const unex = A.counts.none.t + A.counts.none.cast + A.counts.none.sp + A.counts.none.mult
    + A.counts.none.carryT + A.lone.filter(l => l.cls === 'none').length;
  const explainedByAoe = !ok && aoeTot > 0 && nonAoe === 0;
  // the other honest corrected count: a fight whose ENTIRE residue is the ms lattice (MECHANICS §1.1)
  const explainedByMicro = !ok && !explainedByAoe &&
    (A.micro.t + A.micro.cast) > 0 && (nonAoe - A.micro.t - A.micro.cast) === 0 && aoeTot === 0;
  if (explainedByAoe) aoeOnly++;
  if (explainedByMicro) microOnly++;
  perFight.push({ name: rec.name, ok, A, aoeTot, nonAoe, unex, explainedByAoe, explainedByMicro });
  console.log(`      by cause (events)   — ` + CLASSES.map(c => `${c} ${seg(c)}`).join(' · ') +
    ` · unmatched ${A.lone.length} · carry ${A.carry.t} · ms-lattice ${A.micro.t + A.micro.cast}` +
    (explainedByAoe ? '   ← AoE-wall ONLY (priced)' : explainedByMicro ? `   ← ms-lattice ONLY (worst ${(Math.max(A.micro.worstT, A.micro.worstCast) * 1000).toFixed(0)} ms)` : ''));

  if (has('by-cause') && (A.events.length || A.lone.length)) {
    // ★ PRINT THE CREDIT, AT FULL PRECISION, AND SAY WHEN IT IS MATERIAL. An unmatched model cast at a
    // wall is TWO different findings wearing one label. A cast starting a few ms before the wall and
    // credited ~0.1 % is a rounding sliver the model has already priced at nothing. A cast starting
    // 3e-14 before it and credited 100 % is a whole Arcane Blast the model banked in full inside an
    // intermission — and only the raw float says which, because both print as "90.000".
    for (const l of A.lone) console.log(
      `      · UNMATCHED ${l.side === 'model' ? 'model' : 'sim  '} cast @${l.t.toFixed(12)}` +
      (l.frac !== undefined ? ` credited ${(l.frac * 100).toFixed(2)}%` +
        (l.frac > 0.5 ? '  ⛔ MATERIAL — a whole cast the sim never makes' : ' (sliver, priced ~0)') : '') +
      `   [${l.cls}] ${l.why}`);
    for (const e of A.events) {
      const head = `      · ${e.col.padEnd(5)} i=${String(e.i).padStart(3)} t=${e.t.toFixed(3).padStart(8)}`;
      const body = e.col === 'start' ? `model→sim ${e.delta >= 0 ? '+' : ''}${e.delta.toFixed(3)}s (jump ${e.jump.toFixed(3)}s)`
        : e.col === 'cast' ? `model ${e.m.toFixed(3)} sim ${e.s.toFixed(3)} (Δ ${e.delta >= 0 ? '+' : ''}${e.delta.toFixed(3)}s)`
        : e.col === 'sp' ? `model ${e.m.toFixed(1)} sim ${e.s.toFixed(1)} (Δ ${e.delta >= 0 ? '+' : ''}${e.delta.toFixed(1)}${e.exact ? ` = exactly ${e.exact}` : ''}) tc=${e.tc.toFixed(3)}`
        : `model ${e.m.toFixed(3)} sim ${e.s.toFixed(3)} (Δ ${e.delta >= 0 ? '+' : ''}${e.delta.toFixed(3)}) tc=${e.tc.toFixed(3)}`;
      console.log(`${head}  ${body}   [${e.cls}] ${e.why}`);
    }
    // The AoE-wall divergence, SHOWN. The model cancels the straddling Blast and starts the AE
    // lattice at the wall; wowsims finishes the Blast and starts AE after it. One line each.
    for (const s of rec.segments.filter(s => s.type === 'aoe')) {
      const mAE = rec.model.filter(c => c.ae && c.t >= s.start - 1e-9 && c.t < s.end);
      const sAE = rec.simAE.filter(c => c.t >= s.start - 1e-9 && c.t < s.end);
      const straddle = rec.model.filter(c => !c.ae && c.t < s.start && c.t + c.cast > s.start)[0];
      console.log(`      · AoE WALL @${s.start} — ` +
        (straddle ? `model CANCELS the straddling Blast (starts ${straddle.t.toFixed(3)}, credited ${(straddle.frac * 100).toFixed(1)}%); ` +
          'wowsims lands it in full ⇒ the PRICED divergence (PHASE13 §1) IS in play here. '
          : '⚠ NO Blast in flight across the wall, so the priced divergence DOES NOT ARISE here — ' +
            'nothing at this wall may be excused by §1. ') +
        `first AE model ${mAE.length ? mAE[0].t.toFixed(3) : 'none'} vs sim ${sAE.length ? sAE[0].t.toFixed(3) : 'none'}` +
        `; AE count model ${mAE.length} sim ${sAE.length}`);
    }
  }

  if (rows.length) {
    console.log('      i   model t / sim t     model cast / sim   buff SP m/sim      buff mult m/sim');
    for (const r of rows) console.log(
      `      ${String(r.i).padStart(2)}  ${r.m.t.toFixed(3).padStart(8)} ${r.s.t.toFixed(2).padStart(8)}   ` +
      `${r.m.castDn.toFixed(3).padStart(7)} ${r.s.cast.toFixed(3).padStart(7)}   ` +
      `${r.mSp.toFixed(1).padStart(7)} ${(r.simSp === null ? NaN : r.simSp).toFixed(1).padStart(8)}   ` +
      `${r.mMult.toFixed(3).padStart(7)} ${(r.simMult === null ? NaN : r.simMult).toFixed(3).padStart(7)}`);
  }
}

// ── the roll-up ──────────────────────────────────────────────────────────────────────────────────
console.log('\n── RESIDUE BY CAUSE, all audited fights ────────────────────────────────────────────');
console.log('   located events (|Δt| ≥ ' + (MACRO * 1000).toFixed(0) + ' ms)     start  cast    SP  mult   (start-carry)');
for (const c of CLASSES) {
  const x = TOTAL[c];
  console.log(`   ${CLASS_LABEL[c].padEnd(32)} ${String(x.t).padStart(5)} ${String(x.cast).padStart(5)} ` +
    `${String(x.sp).padStart(5)} ${String(x.mult).padStart(5)}   ${String(x.carryT).padStart(6)}`);
}
console.log(`   ${'ms lattice (MECHANICS §1.1)'.padEnd(32)} ${String(MICRO.t).padStart(5)} ${String(MICRO.cast).padStart(5)} ` +
  `${'—'.padStart(5)} ${'—'.padStart(5)}        —    worst ${(MICRO.worstT * 1000).toFixed(0)} ms start / ${(MICRO.worstCast * 1000).toFixed(0)} ms cast`);
console.log(`   unmatched casts (one side only): ${totalLone}     start-carry total: ${totalCarry}`);
const sumC = c => TOTAL[c].t + TOTAL[c].cast + TOTAL[c].sp + TOTAL[c].mult;
console.log(`\n   ⇒ ${sumC('aoe')} event(s) are the PRICED AoE-wall divergence (PHASE13 §1) — not defects.`);
console.log(`   ⇒ ${MICRO.t + MICRO.cast} deviation(s) are the sub-${(MACRO * 1000).toFixed(0)} ms lattice — a known, named cause, not a mystery.`);
console.log(`   ⇒ ${sumC('none') + TOTAL.none.carryT} event(s) have no boundary within ${HORIZON.toFixed(1)}s. Those, and only those, are unattributed.`);
if (perFight.length) {
  console.log('\n   per fight:  fight                                verdict    AoE  non-AoE  unexplained');
  for (const f of perFight) console.log(
    `               ${f.name.padEnd(36)} ${(f.ok ? 'PASS' : f.explainedByAoe ? 'FAIL*' : f.explainedByMicro ? 'FAIL†' : 'FAIL').padEnd(8)} ` +
    `${String(f.aoeTot).padStart(4)} ${String(f.nonAoe).padStart(8)} ${String(f.unex).padStart(12)}`);
  console.log('               * entire residue is the priced AoE-wall divergence   † entire residue is the ms lattice');
}

console.log('');
if (failures) {
  console.log(`✗ ${failures} of ${audited} audited fight(s) disagree with the sim.`);
  console.log(`  Of those, ${aoeOnly} are ENTIRELY the priced AoE-wall divergence (PHASE13 §1)`);
  console.log(`  ⇒ CORRECTED PASS COUNT ${audited - failures + aoeOnly} of ${audited} (was ${audited - failures} of ${audited}).`);
  console.log(`  A further ${microOnly} fail on nothing but the sub-${(MACRO * 1000).toFixed(0)} ms lattice (${audited - failures + aoeOnly + microOnly} of ${audited} if that is also set aside);`);
  console.log('  that is a KNOWN cause, but it is not a priced one — do not fold it into the headline.');
  console.log('  Read the column that failed: START is the cast lattice (MECHANICS §1.1), CAST TIME is');
  console.log('  the haste snapshot, SPELL POWER and DAMAGE MULT are the value snapshot read at cast');
  console.log('  COMPLETION (PHASE12 §6.12). Those are three different fixes — do not guess which.');
  process.exit(1);
}
console.log(`✓ ${audited} fight(s): the model's cast count, cast lattice, cast times, spell power and`);
console.log('  damage multipliers all match wowsims cast for cast.');
process.exit(0);
