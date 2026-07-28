// FACTS-LADDER — the generator behind `docs/ESTABLISHED-FACTS.md`.
//
// Answers one question at whatever haste granularity you ask for: **where you press a cooldown, and
// what passive haste does to that answer.** It measures ONE cooldown at a time on an otherwise bare
// fight, so nothing here is contaminated by alignment with anything else — that is the whole point of
// the facts corpus, and the reason its numbers are quotable.
//
// Three modes:
//   --mode=placement   the per-press-time table (pull / interior / terminal) at one baseline
//   --mode=ladder      (default) steady-state value in CASTS across a fine passive-haste sweep,
//                      printed beside the closed form it is supposed to obey
//   --mode=grid        the same sweep crossed with spell power and crit, asserting that neither
//                      changes placement behaviour (`--sps=`, `--crits=`)
//
// ★ WHY THE LADDER NEEDS TO BE FINE. At {0, 400, 800} a haste cooldown's value reads "high, high,
// zero" and looks like a cliff. It is not a cliff — it is a TENT, and the peak sits exactly at that
// cooldown's own GCD-cap threshold. You cannot see a peak with three samples, and every conclusion
// about combining two haste cooldowns depends on which side of its peak each one is on.
//
// ── THE CLOSED FORM (derived from the engine's own constants, then checked against it) ────────────
// In steady state the Arcane Blast interval is GCD-bound at every haste: the 3-stack cast is 1.498 s,
// under the 1.5 s base GCD, so `interval = max(GCD_FLOOR, GCD_BASE / m) = max(1.0, 1.5/m)`.
// A haste cooldown of duration `d` therefore buys `d/i_buff − d/i_bare` casts, which has three
// regimes in passive haste (`m_p = 1 + h/15.77/100`, `m_b` = the buffed multiplier):
//
//   neither capped   (m_b·m_p < 1.5)   multiplier: d·m_p·(v−1)/1.5     ← RISES with passive haste
//                                      rating:     d·R/(15.77·100·1.5) ← FLAT in passive haste
//   buff capped only (m_p < 1.5 ≤ m_b·m_p)         d·(1 − m_p/1.5)     ← FALLS to zero at h=789
//   both capped      (m_p ≥ 1.5)                   0
//
// Three consequences, all confirmed below and all invisible at coarse granularity:
//   1. The peak is at the cooldown's own threshold — the `m_b·m_p = 1.5` crossover.
//   2. A MULTIPLIER gains value as you gear haste (it multiplies a bigger base); a RATING buff does
//      not (it adds a fixed rating). Same family, opposite gearing behaviour.
//   3. ★ Above its own threshold a cooldown's value stops depending on its STRENGTH entirely — the
//      falling limb `d·(1 − m_p/1.5)` mentions only duration and passive haste. Two 20 s haste
//      cooldowns of wildly different strength are worth *the same* there, because both pin the
//      interval at the 1.0 s floor and the floor does not care how hard you hit it.
//
// ⚠ The model will not match the closed form to the last decimal, and should not: it rounds every
// cast to whole milliseconds (wowsims' `Duration.Round`), and the fight opens with a 3-cast ramp whose
// casts are longer than steady state. The `err` column prices exactly that gap; it is a few percent
// and does not grow with haste. A gap that DID grow with haste would be a finding.
import { loadEngine, ALL_BUFFS } from './engine-node.mjs';

const args = Object.fromEntries(process.argv.slice(2).map(a => {
  const m = a.match(/^--([^=]+)(?:=(.*))?$/); return m ? [m[1], m[2] ?? true] : [a, true];
}));
const HTML = args.html || 'index.html';
const api = loadEngine(HTML);

// ── engine stamp — refuse to measure with a rolled-back engine ────────────────────────────────────
// The container reverted this clone twice while the facts corpus was being gathered, silently putting
// the PRE-boundary-credit engine back. Every number below is a boundary-credit number, so a stale
// engine would not error — it would quietly publish a different fact. `frac` only exists post-PHASE12.
{
  const probe = { T: 30, hasteRating: 0, sp: 1000, critPct: 25, enabled: {}, fixed: {}, warnings: [], coldSnap: false, segments: null };
  const r = api.simulate(api.repair({}, probe), probe, true);
  if (!r.casts.length || r.casts[0].frac === undefined) {
    console.error('FACTS-LADDER ERROR: this index.html predates the boundary credit (casts[].frac absent).');
    console.error('  The working tree is rolled back. Re-sync from origin/master before measuring.');
    process.exit(2);
  }
}

const T      = Number(args.T ?? 60);
const SP     = Number(args.sp ?? 1000);
const CRIT   = Number(args.crit ?? 25);
const STEP   = Number(args.step ?? 5);            // placement granularity, seconds
const HASTES = (() => {
  if (!args.haste) return Array.from({ length: 86 }, (_, i) => i * 10);   // 0..850 by 10
  const s = String(args.haste);
  const m = s.match(/^(\d+):(\d+):(\d+)$/);       // lo:hi:step
  if (m) { const o = []; for (let h = +m[1]; h <= +m[2]; h += +m[3]) o.push(h); return o; }
  return s.split(',').map(Number);
})();
const HASTE_FAMILY = ['bloodlust', 'icyVeins', 'mqg', 'berserking', 'skull'];
const VALUE_FAMILY = ['arcanePower', 'isc', 'scb'];
const KEYS = args.buffs ? String(args.buffs).split(',') : [...HASTE_FAMILY, ...VALUE_FAMILY];

const clone = o => JSON.parse(JSON.stringify(o));
// `sp`/`crit` are parameters, not globals, because `--mode=grid` varies them. They default to the
// single-baseline values so ladder and placement mode read unchanged.
const cfgFor = (key, haste, sp = SP, crit = CRIT) => {
  const enabled = {}; for (const k of ALL_BUFFS) enabled[k] = (k === key);
  return { T, hasteRating: haste, sp, critPct: crit, enabled, fixed: {}, warnings: [], coldSnap: false, segments: null };
};
// ⚠ `repair` drops `cfg.fixed` entries for keys absent from the schedule, so the key must be in BOTH
// or a pinned raid external (Bloodlust) scores as never pressed — which read as a column of zeros
// once already. Pass the schedule; let repair legalise it.
const score = (key, t, haste, collect = false, sp = SP, crit = CRIT) => {
  const cfg = cfgFor(key, haste, sp, crit);
  return api.simulate(api.repair(t === null ? {} : clone({ [key]: [t] }), cfg), cfg, collect);
};
// One plain 3-stack Arcane Blast, so values are quoted in CASTS rather than raw damage.
const oneCast = (haste, sp = SP, crit = CRIT) => {
  const r = score('__none__', null, haste, true, sp, crit);
  const c = r.casts.find(x => x.stacks >= api.GAME.AB.MAX_STACKS);
  if (!c) { console.error('FACTS-LADDER ERROR: no full-stack cast in a bare fight.'); process.exit(2); }
  return c.dmg;
};
// When the first full-stack cast STARTS — the earliest press that is not a pull press.
const t3Of = (haste, sp = SP, crit = CRIT) => {
  const c = score('__none__', null, haste, true, sp, crit).casts.find(x => x.stacks >= api.GAME.AB.MAX_STACKS);
  return c ? c.t : 0;
};

// ★ Read the constants off GAME; never re-type them (reference-gear doctrine). A `??` fallback here
// would be the same bug in a politer costume: the closed form would keep "agreeing" with a renamed
// constant by silently using the number this file remembered.
const G = api.GAME.GCD_BASE, F = api.GAME.GCD_FLOOR, RATING_PER_PCT = api.GAME.HASTE_RATING_PER_PCT;
if (![G, F, RATING_PER_PCT].every(x => typeof x === 'number' && x > 0)) {
  console.error('FACTS-LADDER ERROR: GAME is missing GCD_BASE / GCD_FLOOR / HASTE_RATING_PER_PCT.');
  process.exit(2);
}
const mp = h => 1 + h / (RATING_PER_PCT * 100);
// Closed-form casts bought by one use of `key` at passive haste `h` — the three regimes above.
function predict(key, h) {
  const d = api.BUFFS[key];
  const p = mp(h);
  const buffed = d.kind === 'mult' ? p * d.value : 1 + (h + d.value) / (RATING_PER_PCT * 100);
  const iBare = Math.max(F, G / p), iBuff = Math.max(F, G / buffed);
  return d.dur / iBuff - d.dur / iBare;
}
// The passive haste at which `key` first floors the GCD — the peak of its tent. Returned as the exact
// real, because rounding it to an integer here is how "394" and "395" both ended up in the docs for
// the same 394.25.
function threshold(key) {
  const d = api.BUFFS[key], R = RATING_PER_PCT * 100;
  return d.kind === 'mult' ? (G / F / d.value - 1) * R : (G / F - 1) * R - d.value;
}

// A press time that is unambiguously INTERIOR: at/after 3 stacks, and its window ends before the
// kill — so neither the ramp nor the terminal cast is in the measurement.
const interiorT = (key, haste, sp = SP, crit = CRIT) => {
  const dur = api.BUFFS[key].dur, last = T - dur, t3 = t3Of(haste, sp, crit);
  const t = Math.max(Math.ceil(t3 / STEP) * STEP, Math.min(last - STEP, Math.floor((last - STEP) / STEP) * STEP));
  return t >= last ? null : t;
};

const pad = (s, n) => String(s).padStart(n);

// ── grid mode ─────────────────────────────────────────────────────────────────────────────────────
// ★ THE CLAIM UNDER TEST, from the user (07-28): a cooldown's PLACEMENT behaviour is a property of the
// GCD floor and the Arcane Blast ramp, and of nothing else — so it must be **uncorrelated with spell
// power and with crit**, at every passive haste, for both families. Spell power and crit change what a
// cast is WORTH; they do not change WHEN casts happen, and placement is a question about when.
//
// So this mode does not ask "is the value the same" (it is not — more spell power means every cast is
// worth more). It asks whether the two placement facts survive: the interior is flat, and the pull
// differs from it by the same amount. Both are quoted in CASTS, which divides the worth back out.
if (args.mode === 'grid') {
  const SPS   = String(args.sps   || '500,1000,2000').split(',').map(Number);
  const CRITS = String(args.crits || '0,25,50').split(',').map(Number);
  console.log(`GRID — is placement behaviour independent of spell power and crit, at every haste?`);
  console.log(`T=${T}s.  haste ${HASTES[0]}..${HASTES[HASTES.length - 1]} (${HASTES.length} steps) × SP ${SPS.join('/')} × crit ${CRITS.join('/')}%`);
  console.log(`"pull cost" = (pull − interior) / interior — the fraction of the cooldown's own value that`);
  console.log(`pressing it at the pull instead of the interior gains or loses.\n`);
  // ★ WHY THE RATIO AND NOT THE RAW CAST DELTA. The first version of this mode asserted on
  // `pull − interior` measured in plain casts, and Serpent-Coil "failed" with a 0.1488-cast spread
  // across the SP axis. It is not a dependency, it is the UNIT: the structural penalty is exactly two
  // COVERED casts at every baseline, but one covered cast of a flat +225 SP buff is worth
  //   COEF·225 / (AVG_BASE + COEF·SP)  =  0.1492 plain casts at 500 SP and 0.0748 at 2000,
  // because a fixed spell-power buff is a smaller relative boost on a bigger base. Both measured
  // numbers are exactly 2× those. Dividing by the cooldown's own interior value removes the unit and
  // leaves the structural claim, which is the one under test. (Crit cancels either way — `critFactor`
  // multiplies numerator and denominator alike.)
  let flatWorst = 0, flatAt = '', spreadWorst = 0, spreadAt = '', n = 0;
  for (const key of KEYS) {
    const d = api.BUFFS[key];
    console.log(`### ${d.name} (${d.dur}s, ${d.kind})`);
    console.log('   haste |   pull cost, min … max over the SP×crit grid |   spread | interior flat?');
    for (const h of HASTES) {
      const ratios = [];
      let flat = 0;
      for (const sp of SPS) for (const crit of CRITS) {
        const it = interiorT(key, h, sp, crit);
        if (it === null) continue;
        const unit = oneCast(h, sp, crit), base = score(key, null, h, false, sp, crit).robust;
        const interior = (score(key, it, h, false, sp, crit).robust - base) / unit;
        const pull = (score(key, 0, h, false, sp, crit).robust - base) / unit;
        // above a haste cooldown's cap the interior is exactly 0, so the ratio is undefined — skip
        // rather than print an infinity, and say so in the header line below.
        if (Math.abs(interior) > 1e-9) ratios.push((pull - interior) / interior);
        const t3 = t3Of(h, sp, crit), last = T - d.dur, vs = [];
        for (let t = Math.ceil(t3 / STEP) * STEP; t < last - 1e-9; t += STEP)
          vs.push((score(key, t, h, false, sp, crit).robust - base) / unit);
        if (vs.length > 1) flat = Math.max(flat, Math.max(...vs) - Math.min(...vs));
        n++;
      }
      if (flat > flatWorst) { flatWorst = flat; flatAt = `${key}@h${h}`; }
      if (!ratios.length) { console.log(`   ${pad(h, 5)} |   (interior value is zero — above the cap)      |          | ${flat.toFixed(6)}`); continue; }
      const spread = Math.max(...ratios) - Math.min(...ratios);
      if (spread > spreadWorst) { spreadWorst = spread; spreadAt = `${key}@h${h}`; }
      console.log(`   ${pad(h, 5)} | ${pad(Math.min(...ratios).toFixed(6), 12)} … ${pad(Math.max(...ratios).toFixed(6), 12)}` +
                  `        | ${spread.toFixed(6)} | ${flat.toFixed(6)}`);
    }
    console.log('');
  }
  console.log(`Over ${n} (buff × haste × SP × crit) cells:`);
  // Bloodlust is expected to fail this one — rule 5, see the note in ladder mode.
  const extOnly = /^(bloodlust|powerInfusion|drums)@/.test(flatAt);
  console.log(`  interior flat everywhere?           worst spread ${flatWorst.toFixed(6)} casts` +
              (flatWorst < 1e-6 ? '  ✓'
                : extOnly ? `  — ${flatAt}, a raid external anchored to the CALL (rule 5), expected`
                          : `  ✗ at ${flatAt}`));
  console.log(`  pull cost independent of SP/crit?   worst spread ${spreadWorst.toFixed(6)}` +
              (spreadWorst < 1e-6 ? '  ✓' : `  ✗ at ${spreadAt}`));
  process.exit(0);
}

if (args.mode === 'placement') {
  console.log(`PLACEMENT — T=${T}s, ${SP} SP, ${CRIT}% crit, passive haste ${HASTES.join('/')}, one cooldown alone.`);
  console.log('Value in CASTS relative to never pressing it.\n');
  for (const key of KEYS) {
    const d = api.BUFFS[key];
    console.log(`### ${d.name}  (${d.dur}s)`);
    for (const h of HASTES) {
      const unit = oneCast(h), base = score(key, null, h).robust, t3 = t3Of(h);
      const last = T - d.dur;
      console.log(`  passive haste ${h}   (3 stacks from ${t3.toFixed(2)}s)`);
      for (let t = 0; t <= last + 1e-9; t += STEP) {
        const v = (score(key, t, h).robust - base) / unit;
        const tag = t < t3 - 1e-9 ? 'pull' : (t >= last - 1e-9 ? 'covers the kill' : '');
        console.log(`    @${pad(t, 3)}s  ${pad(v.toFixed(4), 9)} casts  ${tag}`);
      }
    }
    console.log('');
  }
  process.exit(0);
}

// ── ladder mode ───────────────────────────────────────────────────────────────────────────────────
console.log(`LADDER — steady-state value of one cooldown, in CASTS, across passive haste.`);
console.log(`T=${T}s, ${SP} SP, ${CRIT}% crit. Interior placement only (no ramp, no kill boundary).`);
console.log(`Haste: ${HASTES[0]}..${HASTES[HASTES.length - 1]} in ${HASTES.length} steps.\n`);

let worstErr = 0, worstAt = '';
const bareCap = (G / F - 1) * RATING_PER_PCT * 100;
for (const key of KEYS) {
  const d = api.BUFFS[key];
  const isHaste = HASTE_FAMILY.includes(key);
  const th = isHaste ? threshold(key) : null;
  console.log(`### ${d.name}  (${d.dur}s, ${d.kind}${d.kind === 'rating' ? ' +' + d.value : ' x' + d.value})` +
              (isHaste ? `   threshold ${th}` : ''));
  console.log(isHaste ? '   haste |  measured |  closed form |  err (casts) |   err % | interior spread'
                      : '   haste |  measured | interior spread');
  const rows = [];
  for (const h of HASTES) {
    const it = interiorT(key, h);
    if (it === null) continue;
    const unit = oneCast(h), base = score(key, null, h).robust;
    const v = (score(key, it, h).robust - base) / unit;
    // flatness: every interior press must agree, or "the interior value" is not a thing
    const t3 = t3Of(h), last = T - d.dur, vs = [];
    for (let t = Math.ceil(t3 / STEP) * STEP; t < last - 1e-9; t += STEP) vs.push((score(key, t, h).robust - base) / unit);
    const spread = vs.length > 1 ? Math.max(...vs) - Math.min(...vs) : 0;
    const p = isHaste ? predict(key, h) : null;
    // ⚠ Price the gap in CASTS, not in percent. A percentage against a prediction that is heading to
    // zero reads 11% at h=780 for an absolute miss of 0.016 casts — the metric panicking, not the
    // model. Percent is still shown per row for scale; the ledger below ranks on the absolute.
    const err = isHaste ? v - p : 0;
    const errPct = isHaste && Math.abs(p) > 1e-9 ? (v - p) / p * 100 : 0;
    if (isHaste && Math.abs(err) > worstErr) { worstErr = Math.abs(err); worstAt = `${key}@${h}`; }
    rows.push({ h, v, p, err, errPct, spread });
  }
  const shown = rows.filter(r => HASTES.length <= 40 || r.h % 50 === 0 || (th && Math.abs(r.h - th) <= 10));
  for (const r of shown) {
    console.log(isHaste
      ? `   ${pad(r.h, 5)} | ${pad(r.v.toFixed(4), 9)} | ${pad(r.p.toFixed(4), 12)} | ${pad(r.err.toFixed(4), 12)} | ${pad(r.errPct.toFixed(1) + '%', 7)} | ${r.spread.toFixed(6)}`
      : `   ${pad(r.h, 5)} | ${pad(r.v.toFixed(4), 9)} | ${r.spread.toFixed(6)}`);
  }
  if (isHaste) {
    const peak = rows.reduce((a, b) => (b.v > a.v ? b : a), rows[0]);
    const zero = rows.find(r => r.v < 1e-9);
    console.log(`   measured max ${peak.v.toFixed(3)} casts at h=${peak.h};  falls to zero at h=${zero ? zero.h : '>' + HASTES[HASTES.length - 1]}` +
                `  (bare GCD cap ${bareCap.toFixed(1)})`);
    // ── IS THE THRESHOLD RIGHT? Falsify it, don't admire it. ─────────────────────────────────────
    // "The measured argmax is near the threshold" is not a test: a RATING buff's closed form has no
    // peak at all (flat, then falling), so its argmax lands wherever the ms ripple is highest — which
    // is how Skull's apex read h=30 against a threshold of 613. The threshold is a claim about WHERE
    // THE CURVE BENDS, so test it by bending the curve somewhere else and checking that fits worse.
    const d = api.BUFFS[key];
    const rms = shift => {
      const capAt = th + shift;                      // counterfactual: the buff floors the GCD here
      let s = 0;
      for (const r of rows) {
        const p = mp(r.h);
        const buffed = d.kind === 'mult' ? p * d.value : 1 + (r.h + d.value) / (RATING_PER_PCT * 100);
        // ⚠ NO `Math.max(F, …)` on the else branch — that was the first version and it made the whole
        // test a no-op: above the true threshold the max already returns F, so "move the cap 50 later"
        // predicted exactly the same numbers and scored an identical rms. The counterfactual has to
        // let the interval go BELOW the floor before `capAt`, which is precisely the claim being
        // falsified ("the floor starts biting here, not 50 rating either side of here").
        const iBuff = r.h >= capAt ? F : G / buffed;
        const pred = d.dur / iBuff - d.dur / Math.max(F, G / p);
        s += (r.v - pred) ** 2;
      }
      return Math.sqrt(s / rows.length);
    };
    const base = rms(0), lo = rms(-50), hi = rms(+50);
    const ok = base < lo && base < hi;
    console.log(`   THRESHOLD ${th.toFixed(1)} — rms fit ${base.toFixed(4)} casts;  shifted −50: ${lo.toFixed(4)}   +50: ${hi.toFixed(4)}` +
                `  — ${ok ? 'the stated threshold fits BEST' : '✗ a shifted threshold fits better'}`);
  }
  const flat = Math.max(...rows.map(r => r.spread));
  // ⚠ NOT-FLAT IS EXPECTED FOR A RAID EXTERNAL AND MUST NOT BE READ AS A BUG. A self-press cannot go
  // off mid-cast, so its window begins at a cast boundary and covers a fixed number of casts. Bloodlust
  // is pressed by someone else and its 40 s runs from the CALL, so the slip to your next boundary is
  // window you cannot use, and the covered count alternates between two adjacent integers. That is
  // ESTABLISHED-FACTS rule 5, and it was mis-filed as a model defect for part of 07-28 because the sim
  // reads it flat (its Bloodlust is an APL castSpell, so the aura snaps and slip is structurally zero).
  const external = key === 'bloodlust' || key === 'powerInfusion' || key === 'drums';
  console.log(`   worst interior spread over the whole ladder: ${flat.toFixed(6)} casts` +
              (flat < 1e-6 ? '  ✓ FLAT everywhere'
                : external ? '  — expected: raid external, window anchored to the CALL (rule 5)'
                           : '  ⚠ NOT FLAT — a self-press interior must not depend on where you press it'));
  console.log('');
}
if (worstErr) console.log(`Worst model-vs-closed-form gap: ${worstErr.toFixed(4)} casts at ${worstAt}`);

// ── THE COLLAPSE — the structural claim, checked without the closed form ─────────────────────────
// Consequence 3 says the falling limb `d·(1 − m_p/1.5)` mentions only DURATION and passive haste. So
// above BOTH their thresholds, two haste cooldowns of the same duration must be worth *identically*
// the same — however differently they are specced. Icy Veins is a ×1.2 multiplier, Mind Quickening
// Gem is +330 rating, Skull of Gul'dan is +175 rating; all three last 20 s. If the collapse holds,
// the falling limb is confirmed from measurement alone, with no model of the floor assumed.
const byDur = {};
for (const key of KEYS.filter(k => HASTE_FAMILY.includes(k))) (byDur[api.BUFFS[key].dur] ??= []).push(key);
const groups = Object.entries(byDur).filter(([, ks]) => ks.length > 1);
if (groups.length) {
  console.log('\nTHE COLLAPSE — same duration, different strength, both above threshold:');
  for (const [dur, ks] of groups) {
    const start = Math.max(...ks.map(threshold));
    const hs = HASTES.filter(h => h > start + 20 && h < bareCap - 20);
    if (!hs.length) { console.log(`  ${dur}s: no ladder samples between ${start.toFixed(0)} and the bare cap — nothing to compare`); continue; }
    let worst = 0, worstH = hs[0];
    for (const h of hs) {
      const vals = ks.map(k => {
        const it = interiorT(k, h);
        return it === null ? null : (score(k, it, h).robust - score(k, null, h).robust) / oneCast(h);
      }).filter(v => v !== null);
      const spread = Math.max(...vals) - Math.min(...vals);
      if (spread > worst) { worst = spread; worstH = h; }
    }
    console.log(`  ${dur}s (${ks.join(', ')}) over h=${hs[0]}..${hs[hs.length - 1]}:  worst disagreement ${worst.toFixed(6)} casts at h=${worstH}` +
                (worst < 1e-6 ? '  ✓ THEY COLLAPSE — strength stops mattering above the threshold' : '  ✗ they do not collapse'));
  }
}
