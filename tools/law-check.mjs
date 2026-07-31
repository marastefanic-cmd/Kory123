// LAW CHECK — does the engine reproduce `docs/ESTABLISHED-FACTS.md`'s closed forms?
//
//   node tools/law-check.mjs
//
// ── WHY THIS EXISTS, AND WHY IT IS NOT ONE OF "THE TESTS" ─────────────────────────────────────────
// `tests/anchors.mjs` asserts WHICH LAYOUT IS RIGHT — two layouts the user declared. This file asserts
// something different and prior: that the SCORER agrees with the algebra the whole project is derived
// from. It never mentions a plan the user cares about; it prices one buff against a closed form and
// checks the number. So it belongs with the harness-integrity gates (`sim-request`, `page-equiv`,
// `self-consistency`), not with the two tests.
//
// ★ It exists because 2026-07-30 found five scoring defects in one day and EVERY one of them was caught
// by comparing a measured number to a closed form, never by a plan diff:
//   · the per-cast sum ranked "Berserking with nothing up" (0.7250) ABOVE "Berserking inside Bloodlust"
//     (0.7203) — a ~0.15-cast inversion against laws of 0.667 and 0.867 (MODEL-DEFECTS §8h).
//   · the integral scored windows from the press, so a value buff pressed ON the Bloodlust call was
//     docked `0.1496 × s` casts — matched to three decimals by each buff's own value fraction (§8i).
//   · `auraAt` put a window edge in the GCD gap, pricing a 0.038 s sliver containing no cast (§8k).
//   · the cast lattice leaked into the ranking through `scoreStart` and then through the cooldown
//     chain, making provably-equal layouts differ (§8l).
// A golden file would have absorbed every one of those silently. A closed form cannot.
//
// ⚠ EXPECTATIONS ARE DERIVED HERE, NOT COPIED FROM AN OLD RUN. Each `chk` line carries the algebra it
// tests. When the model's geometry changes the derivation may change with it — that happened while this
// file was being written: the "Berserking inside Icy Veins" case was 0.835 s of overlap under the old
// fire-snapped windows and is exactly 1.000 s under pure geometry, so the law value moved from 0.011532
// to 0.013811 and the ENGINE was right both times. ⛔ If a line fails, re-derive before you touch the
// engine — a stale expectation here looks exactly like a scorer regression.
import { loadEngine, ALL_BUFFS } from './engine-node.mjs';

/* --html= targets an ALTERNATIVE engine, like plan-sweep and kit-sweep. Without it a candidate scorer
   change can only be gated by editing index.html in place, which is exactly how a half-finished fix
   gets committed by accident. */
const HTML = (process.argv.find(a => a.startsWith('--html=')) || '').split('=')[1]
          || new URL('../index.html', import.meta.url).pathname;
const api = loadEngine(HTML);
const G = api.GAME;

// One plain, unbuffed Arcane Blast at the reference setup — the unit every law below is quoted in.
// Read from GAME, never re-typed (reference-gear.mjs doctrine).
const SP = 1000, CRIT = 25;
const D5 = 10;   // Berserking duration, used by §5 and §5b
const one = (G.AB.AVG_BASE_DMG + G.AB.COEF * SP) * (1 + (CRIT / 100) * (G.CRIT_MULT - 1));

const cfgOf = (T, kit, fixed, haste, extra) => ({
  T, hasteRating: haste || 0, sp: SP, critPct: CRIT,
  enabled: Object.fromEntries(ALL_BUFFS.map(k => [k, kit.includes(k)])),
  fixed: fixed || {}, warnings: [], coldSnap: true, segments: null, ...(extra || {}),
});
// The RANKING quantity, in effective casts. This is what `rankScore` reads.
const I = (s, c) => api.simulate(api.repair(JSON.parse(JSON.stringify(s)), c), c, true).integral / one;

/* The master law, ESTABLISHED-FACTS §1: `rate(m) = min(1/F, m/G)` — BUT MILLISECOND-QUANTISED, because
   the engine is and wowsims is (`sim/core/cast.go:137-138` rounds both the cast and the GCD). The doc
   states the ideal form; the engine adds the rounding, and on a haste × haste pair the two differ
   MEASURABLY — writing this gate with the unquantised form failed the Icy-Veins × Berserking line at
   0.01381 measured against 0.01333 ideal, a 3.6 % gap, and the ENGINE was right.
   ⇒ so the gate quantises too, and the ideal-vs-quantised gap is itself a fact worth knowing: never
   quote a closed form to more than ~2 significant figures without saying which one you meant. */
const msq = x => Math.round(x * 1000) / 1000;
/* ⚠ NEGATIVE CONTROL — `--self-test` drops the quantisation and REQUIRES the gate to fail.
   PHASE11's standing rule: every gate needs a deliberately-broken input that must fail before its green
   is believed, and this project has shipped two gates whose failure mode was a pass (B7, B8). Here the
   break is the real mistake that was made while writing the file: using the ideal `min(1/F, m/G)`
   instead of the millisecond-quantised one. It is a 3.6 % error on the haste × haste line, which is
   exactly the scale of the defects this gate exists to catch — so if the gate cannot see it, its
   tolerances are decoration. Inverts its own exit contract, like `page-equiv --self-test`. */
const SELFTEST = process.argv.includes('--self-test');
const rate = SELFTEST
  ? m => Math.min(1 / G.GCD_FLOOR, m / G.GCD_BASE)
  : m => 1 / Math.max(msq(Math.max(G.GCD_FLOOR, G.GCD_BASE / m)),
                      msq((G.AB.BASE_CAST - G.AB.STACK_CAST_REDUCTION * G.AB.MAX_STACKS) / m));

let bad = 0;
const chk = (name, got, want, tol, algebra) => {
  const ok = Math.abs(got - want) <= tol;
  if (!ok) bad++;
  console.log(`  ${ok ? '✓' : '⛔'} ${name.padEnd(46)} ${got.toFixed(5)}   law ${want.toFixed(5)}`);
  if (!ok) console.log(`        ${algebra}`);
};

const KIT = ['icyVeins', 'isc', 'scb', 'arcanePower', 'berserking', 'bloodlust'];
console.log('# LAW CHECK — the engine against ESTABLISHED-FACTS\' closed forms');
console.log(`#   h=0, ${SP} SP, ${CRIT}% crit · one plain Arcane Blast = ${one.toFixed(2)} damage\n`);

// ═══ §5 — what 10 s of Berserking is worth in three different company ═════════════════════════════
// Berserking is x1.10 haste for 10 s. Its value is `dur × [rate(m·1.1) − rate(m)] × (value premium)`.
{
  const c = cfgOf(180, KIT, { bloodlust: [20] });
  const base = { icyVeins: [20, 140], isc: [20, 140], scb: [20, 140], arcanePower: [20], bloodlust: [20] };
  const b = I(base, c);
  const D = G.berserkingDur || 10;

  // Inside Bloodlust (m 1.3), no Icy Veins: 10 × [rate(1.43) − rate(1.3)].
  chk('Berserking in Bloodlust, no Icy Veins', I({ ...base, berserking: [42] }, c) - b,
      D * (rate(1.43) - rate(1.3)), 0.0005, `${D} × [rate(1.43) − rate(1.3)]`);

  // With nothing up (m 1.0): 10 × [rate(1.1) − rate(1.0)].
  chk('Berserking with nothing up', I({ ...base, berserking: [100] }, c) - b,
      D * (rate(1.1) - rate(1.0)), 0.0005, `${D} × [rate(1.1) − rate(1.0)]`);

  // Under Icy Veins + Icon + gem: the haste term at m 1.2, times the value premium the extra casts
  // carry. s = COEF·ΔSP / (BASE + COEF·SP) for each spellpower buff (ESTABLISHED-FACTS §3).
  const sOf = dsp => (G.COEF ?? G.AB.COEF) * dsp / (G.AB.AVG_BASE_DMG + G.AB.COEF * SP);
  const prem = 1 + sOf(155) + sOf(225);
  chk('Berserking under IV + Icon + gem', I({ ...base, berserking: [145] }, c) - b,
      D * (rate(1.32) - rate(1.2)) * prem, 0.0005,
      `${D} × [rate(1.32) − rate(1.2)] × (1 + s₁₅₅ + s₂₂₅ = ${prem.toFixed(4)})`);
}

/* ═══ PHASES — THE ARCANE BLAST DEBUFF HAS THREE CASES, AND ALL THREE ARE PHYSICS ════════════════
   Added 07-31. The phase machinery (AoE / burn / intermission) is the most intricate part of the
   scorer and NOTHING asserted it. The load-bearing mechanic is the Arcane Blast debuff: applied on
   COMPLETION, lasting `DEBUFF_DUR` (8 s) from the previous cast's START. With `G` = start→start gap
   and `ct` this cast's own length there are THREE outcomes, not two:

     G ≤ DEBUFF_DUR − ct     refreshed in time                      → stacks stay 3
     DEBUFF_DUR − ct < G < DEBUFF_DUR
                             the cast BEGINS with stacks (snapshot, so it keeps the fast cast time)
                             but the old debuff lapses mid-cast, so its completion lands a FRESH
                             stack                                  → 3, then 1, 2, 3
     G ≥ DEBUFF_DUR          already gone when the cast begins      → 0, then 1, 2, 3

   The middle band is the one an engine forgets — this one modelled only the outer two for most of the
   project (index.html ~:1362). Gated here on the STACK SEQUENCE itself, which is the physics, rather
   than on a score, which is a consequence.
   ★ AoE phases are the sharp test: Arcane Explosion neither builds nor refreshes the debuff, so the
   decay must be measured from the last ARCANE BLAST even though you never stopped casting. */
{
  const seq = (L, type) => {
    const c = cfgOf(300, [], null, 0, { segments: api.buildSegments([{ from: 100, to: 100 + L, type, mult: 1, targets: 6 }], 300) });
    const r = api.simulate(api.repair({}, c), c, true);
    // stacks of the first three ARCANE BLASTS after the phase ends
    return r.casts.filter(x => x.t >= 100 + L - 1e-9).slice(0, 3).map(x => x.stacks).join(',');
  };
  for (const type of ['intermission', 'aoe']) {
    chk(`${type}: 4 s gap keeps the debuff`,      seq(4, type) === '3,3,3' ? 0 : 1, 0, 0, `got [${seq(4, type)}], want [3,3,3]`);
    chk(`${type}: 6 s gap lapses MID-CAST`,       seq(6, type) === '3,1,2' ? 0 : 1, 0, 0, `got [${seq(6, type)}], want [3,1,2] — the third case`);
    chk(`${type}: 8 s gap is a full re-ramp`,     seq(8, type) === '0,1,2' ? 0 : 1, 0, 0, `got [${seq(8, type)}], want [0,1,2]`);
  }
}
/* ★ THE TWO PHASE TYPES RESUME DIFFERENTLY, AND IT IS NOT A BUG — gated 07-31.
   An independent reference implementation (`tools/objective-ref.mjs`) showed the re-ramp toll appearing
   at phase lengths offset by EXACTLY one cast interval between `intermission` and `aoe` (aoe charges it
   from L=5, intermission only from L=6), which reads like the two anchoring the Arcane Blast debuff on
   different casts. They do not — the last Arcane Blast is 99.498 in BOTH. The difference is the
   RESUME: an AoE phase spends its final GCD on an Arcane Explosion, so the first Arcane Blast cannot
   start until that GCD expires, while an intermission leaves nothing running and resumes AT the wall.
   The extra 1.5 s of start-to-start gap is what tips the debuff a phase-length earlier. Real physics,
   and nothing stated it. */
{
  const L = 5, END = 100 + L;
  const firstAB = type => {
    const c = cfgOf(300, [], null, 0, { segments: api.buildSegments([{ from: 100, to: END, type, mult: 1, targets: 6 }], 300) });
    const r = api.simulate(api.repair({}, c), c, true);
    return r.casts.find(x => x.t >= END - 1e-9).t;
  };
  chk('an intermission resumes AT the wall', firstAB('intermission'), END, 1e-9,
      'nothing is casting during an intermission, so no GCD is owed on the way out');
  // last AE of a 5 s phase is at 100 + 3×1.5 = 104.5; its GCD runs to 106.0.
  chk('an AoE phase owes its last Explosion’s GCD', firstAB('aoe'), 106.0, 1e-9,
      'AE lattice 100/101.5/103/104.5 ⇒ the trailing GCD pushes the first Arcane Blast to 106.0');
}
{
  // Arcane Explosion is INSTANT, so an AoE phase runs at the bare GCD and fits exactly L/GCD casts.
  const L = 12;
  const c = cfgOf(300, [], null, 0, { segments: api.buildSegments([{ from: 100, to: 100 + L, type: 'aoe', mult: 1, targets: 6 }], 300) });
  const r = api.simulate(api.repair({}, c), c, true);
  const inPhase = r.casts.filter(x => x.t >= 100 && x.t < 100 + L);
  chk('AoE phase fits L / GCD Arcane Explosions', inPhase.length, L / G.GCD_BASE, 0,
      'instant cast ⇒ GCD-bound ⇒ 12 s / 1.5 s = 8');
  chk('…every one at the bare GCD', Math.max(...inPhase.map(x => Math.abs(x.interval - G.GCD_BASE))), 0, 1e-9,
      'no Arcane Blast cast time anywhere inside an AoE phase');
}

/* ★★★ A PHASE HAS A CLOSED FORM, AND IT IS EXACT — derived and gated 07-31.
   The phase machinery was the largest block of the scorer with no closed form behind it: everything
   above prices a BUFF, and RULES §9 states `M(N)` as a ratio without ever pinning what a phase does to
   the SCORE. It turns out to be exactly what the integral says it should be, with no residual:

       burn:  Δ = L · rate(m) · (mult − 1)                    ← no toll; Arcane Blast never stops
       aoe:   Δ = L · rate(m) · (M(N) − 1) − toll(L)          ← plus the re-ramp once the debuff drops
       inter: Δ = −L · rate(m)             − toll(L)          ← M = 0, the same form

   i.e. a phase REPLACES `L · rate` casts with `M ×` as many, and separately pays the Arcane Blast
   debuff's rebuild if it ran long enough to drop it. `M(N)` is RULES §9's own ratio, re-derived here
   from GAME rather than quoted. ⛔ The burn line has NO toll term and that is the physics, not an
   omission: you keep casting Arcane Blast through a burn phase, so the stacks never fall off. If a
   future edit adds a toll there, this line fails and the reason is already written down.
   ⚠ `toll(L)` is read from the ENGINE, not asserted — where the debuff expires is the three-case
   model gated above, and folding it in here would just re-test that. What IS asserted is that once
   you know the toll, the rest of a phase's cost is exactly the replacement term. */
{
  const L = 30, R = rate(1);
  const critF = 1 + (CRIT / 100) * (G.CRIT_MULT - 1);
  const seg = (type, extra) => cfgOf(300, [], null, 0, { segments: api.buildSegments(
    [{ from: 100, to: 100 + L, type, mult: 1, targets: 0, ...extra }], 300) });
  const none = I({}, cfgOf(300, []));
  // The re-ramp toll a long phase pays, taken from the engine's own intermission (M = 0 isolates it).
  const toll = -(I({}, seg('intermission', {})) - none) - L * R;

  chk('a burn phase with mult=1 is a NO-OP', I({}, seg('burn', { mult: 1 })) - none, 0, 1e-9,
      'a ×1 multiplier changes no damage, and Arcane Blast never stops, so nothing at all happens');
  for (const mult of [1.5, 2, 3, 5]) {
    chk(`burn ×${mult} = L·rate·(mult−1), no toll`, I({}, seg('burn', { mult })) - none,
        L * R * (mult - 1), 1e-9, `${L}·${R.toFixed(4)}·${(mult - 1).toFixed(1)} — stacks never drop through a burn`);
  }
  const M = N => ((G.AE.AVG_BASE_DMG + G.AE.COEF * SP) * N * critF * api.aoeCritAmp(N, CRIT / 100))
               / ((G.AB.AVG_BASE_DMG + G.AB.COEF * SP) * critF);
  for (const N of [1, 2, 3, 6, 10, 20]) {
    chk(`aoe N=${N} = L·rate·(M(N)−1) − toll`, I({}, seg('aoe', { targets: N })) - none,
        L * R * (M(N) - 1) - toll, 1e-9, `M(${N}) = ${M(N).toFixed(4)}, toll = ${toll.toFixed(4)}`);
  }
}

/* ★★ PHASES COMPOSE — two abutting segments are one segment, gated 07-31.
   Splitting a phase at an interior point must not change the score: the two halves cover the same
   seconds at the same rate, and the split point is not a boundary of anything physical. A failure here
   means a per-segment fixed cost (an entry ramp, a re-anchor, a double-charged toll) that the single
   segment does not pay — the exact shape of the "AoE lattice re-anchors" family of bugs. */
{
  const S = phases => I({}, cfgOf(300, [], null, 0, { segments: api.buildSegments(phases, 300) }));
  for (const [type, extra] of [['burn', { mult: 2 }], ['aoe', { targets: 6 }], ['intermission', {}]]) {
    const split = S([{ from: 100, to: 110, type, mult: 1, targets: 0, ...extra },
                     { from: 110, to: 120, type, mult: 1, targets: 0, ...extra }]);
    chk(`two abutting ${type} halves == one whole`, split - S([{ from: 100, to: 120, type, mult: 1, targets: 0, ...extra }]),
        0, 1e-9, 'an interior split point is not a boundary of anything physical');
  }
}

/* ★★ A PHASE SLID IN THE INTERIOR IS FLAT — the phase analogue of §8l, gated 07-31.
   §8l pins that sliding a lone PRESS inside a uniform region cannot change `∫ rate dt`. The same
   argument applies to a PHASE: translating a fixed-length segment through a uniform region moves the
   boundary between two constant-rate regions without changing either one's total length, so the
   integral is invariant. Nothing asserted it, and it is the sharpest available test of the phase
   machinery — it fails the instant the cast lattice leaks into phase scoring, which is precisely the
   defect family §8i / §8k / §8l all came from (each first showed as a boundary priced against the
   lattice rather than against geometry).
   ⚠ Deliberately swept across a FULL cast interval (1.6 s > 1.498 s) so the straddling Arcane Blast
   changes identity mid-sweep — at W ≥ 101.0 the cut lands on the *next* cast. A shorter sweep could sit
   inside one cast and pass without ever exercising the boundary.
   ★ Run at BOTH a length that keeps the Arcane Blast debuff and one that drops it, so the re-ramp toll
   is covered too: the toll must be translation-invariant as well, and only the long case tests that. */
{
  for (const [type, L, extra] of [['aoe', 4, { targets: 6 }], ['aoe', 12, { targets: 6 }],
                                  ['intermission', 4, {}], ['intermission', 12, {}],
                                  ['burn', 4, { mult: 2 }], ['burn', 12, { mult: 2 }]]) {
    const v = [];
    for (let W = 100; W <= 101.6; W += 0.2) {
      const c = cfgOf(300, [], null, 0, { segments: api.buildSegments(
        [{ from: +W.toFixed(2), to: +W.toFixed(2) + L, type, mult: 1, targets: 0, ...extra }], 300) });
      v.push(I({}, c));
    }
    chk(`a ${type} (L=${L}) slid in the interior is FLAT`, Math.max(...v) - Math.min(...v), 0, 1e-9,
        'translating a fixed-length segment through a uniform region cannot change ∫ rate dt');
  }
}

/* ═══ UNGATED SURFACE, CLOSED 07-31 — four behaviours nothing asserted ═══════════════════════════
   Audit of what `simulate` DOES against what this file CHECKED found four live behaviours with no
   closed form behind them. Ungated surface is where the next defect hides, and three of these are
   recent additions (prepull 07-30, the Tirisfal toggle, the buff panel's PI). */
{
  // 1. PREPULL — a window pressed before the pull is credited only from t = 0. Icy Veins at −5 with a
  //    20 s duration must be worth 15 s of haste, not 20. (RULES §7b, added 07-30, never gated.)
  const c = cfgOf(300, ['icyVeins']);
  const b = I({}, c);
  const full = I({ icyVeins: [100] }, c) - b;
  const pre  = I({ icyVeins: [-5] }, c) - b;
  chk('prepull is credited only from t=0', pre, full * 15 / 20, 0.002,
      'Icy Veins at −5 keeps 15 of its 20 s; the 5 s before the pull buy nothing');
}
{
  // 2. POWER INFUSION IS SUPPRESSED UNDER BLOODLUST — same ExclusiveCategory, highest priority wins
  //    (docs/SOURCES.md, wowsims `core/buffs.go`). Inside Lust, PI must be worth EXACTLY zero.
  const c = cfgOf(300, ['powerInfusion', 'bloodlust'], { bloodlust: [0] });
  const b = I({ bloodlust: [0] }, c);
  chk('Power Infusion inside Bloodlust is worth 0', I({ bloodlust: [0], powerInfusion: [10] }, c) - b, 0, 0.002,
      'BL (1.3) and PI (1.2) share one MultiplyCastSpeed category — BL wins, PI contributes nothing');
  chk('Power Infusion outside Bloodlust is worth its own haste',
      I({ bloodlust: [0], powerInfusion: [100] }, c) - b, 15 * (rate(1.2) - rate(1.0)), 0.002,
      '15 s × [rate(1.2) − rate(1.0)] once Bloodlust has expired');
}
{
  // 3. TIRISFAL 2pc POOLS ADDITIVELY WITH ARCANE POWER on an Arcane Blast (docs/SOURCES.md, one
  //    SpellMod_DamageDone_Pct pool). So AP lifts a T5'd cast by 1.5/1.2 = ×1.25, not ×1.30.
  /* ⚠ RE-DERIVED — the first expectation here was `1.25/1.30` and it FAILED at 0.83333. The engine was
     right and the expectation was wrong, exactly as this file's header instructs you to assume. In
     `one` units a plain cast is 1.0 without the set and 1.2 with it, so the ADDITIVE pool makes an AP
     cast 1.3 and 1.5 respectively:
         off: rel = (1.3−1.0)·n / N        on: rel = (1.5−1.2)·n / (1.2·N)      ⇒ ratio = 1/1.2
     The 0.3 numerator is IDENTICAL both ways — the whole effect is the 1.2× larger baseline.
     ★ And that is precisely what discriminates the two hypotheses: were the pool MULTIPLICATIVE, an AP
     cast would be 1.2×1.3 = 1.56, giving `(1.56−1.2)·n/(1.2·N) = 0.3n/N` and a ratio of exactly **1.0**.
     So this line reads 1/1.2 for additive and 1.0 for multiplicative — a clean one-bit test of the
     SOURCES ruling, which is worth more than the magnitude. */
  const off = cfgOf(300, ['arcanePower']), on = cfgOf(300, ['arcanePower'], null, 0, { t5two: true });
  const rel = c => (I({ arcanePower: [100] }, c) - I({}, c)) / I({}, c);
  chk('Tirisfal + Arcane Power pool ADDITIVELY', rel(on) / rel(off), 1 / 1.2, 0.002,
      'additive ⇒ 1/1.2 = 0.8333; multiplicative would read exactly 1.0');
}
{
  // 4. AN INTERMISSION REMOVES ITS OWN LENGTH OF CASTING, and then costs a re-ramp on the way out.
  //    So the loss must EXCEED the bare seconds — that inequality is the law worth pinning.
  const plain = cfgOf(300, []);
  const withI = cfgOf(300, [], null, 0, { segments: api.buildSegments([{ from: 100, to: 140, type: 'intermission', mult: 1, targets: 0 }], 300) });
  const lost = I({}, plain) - I({}, withI);
  chk('a 40 s intermission costs more than 40 s of casting', Math.sign(lost - 40 * rate(1.0)), 1, 0,
      `lost ${lost.toFixed(4)} casts vs ${(40 * rate(1.0)).toFixed(4)} bare — the excess is the re-ramp toll`);
}

/* ═══ §8r — THE RAMP TREATS HASTE AND VALUE BUFFS DIFFERENTLY, AND BOTH ARE ON PURPOSE ═══════════
   MODEL-DEFECTS §8r records a fork between two user statements that both describe the real game:
     1. *"haste over ramp is worth exactly the same as haste after ramp. What's worth more is the
        alignment with AP and SP buffs."*
     2. *"sometimes overlaying the haste buff onto the ramp makes the arcane blast stacks stack
        quicker."*
   Statement 1 is what ships, because it is what reproduces the declared layouts; statement 2 — the
   opener COMPRESSING under haste — is deliberately unmodelled, and §8r measured that adopting it moves
   Icy Veins #1 to the pull and breaks anchors. Gated here so neither half drifts silently.

   ⚠ THE CONTROL MATTERS: both placements must sit inside the SAME company. Comparing a buff at 0
   against one at 100 also moves it out of Bloodlust, and that confound reads as a 0.20-cast "ramp
   effect" that is nothing of the kind. Lust is pinned [0,60] and the two placements are 0 and 20.
   ⇒ HASTE: residual exactly 0 — statement 1, and it is exact rather than approximate.
   ⇒ VALUE: residual NEGATIVE — a value window spent on slow ramp casts covers fewer of them, so it
     correctly prefers to be clear of the ramp. That is statement 1's own second half. */
{
  const c = cfgOf(300, ['icyVeins', 'berserking', 'isc', 'arcanePower', 'bloodlust'], { bloodlust: [0] });
  const b = I({ bloodlust: [0] }, c);
  const res = k => (I({ bloodlust: [0], [k]: [0] }, c) - b) - (I({ bloodlust: [0], [k]: [20] }, c) - b);
  chk('§8r: Icy Veins is exactly ramp-neutral',  res('icyVeins'),   0, 1e-9, 'statement 1: haste over the ramp == haste after it');
  chk('§8r: Berserking is exactly ramp-neutral', res('berserking'), 0, 1e-9, 'statement 1, second haste buff');
  // The value buffs must PREFER to be clear of the ramp — sign is the law, magnitude is the record.
  chk('§8r: Icon prefers to be clear of the ramp',  Math.sign(res('isc')),         -1, 0, `measured ${res('isc').toFixed(6)} casts`);
  chk('§8r: Arcane Power prefers clear of the ramp', Math.sign(res('arcanePower')), -1, 0, `measured ${res('arcanePower').toFixed(6)} casts`);
}

/* ═══ §8o — DEAD TIME IS CHARGED CONTINUOUSLY, INCLUDING ACROSS A RAMP BOUNDARY ══════════════════
   MODEL-DEFECTS §8o was "located, not fixed": the integral charged the gap between a press and the
   first cast it can affect as ZERO at steady state but as the REALIZED amount on the ramp, and neither
   is the average. Its proof was that Icy Veins pressed at 3.0 gained nothing until the in-flight ramp
   cast ended at 4.666 — two adjacent segments with the same rate — which produced a period-2 wobble as
   a press crossed a ramp boundary and made Icy-Veins-at-the-pull win.

   §8q's fixed ramp toll (spread over the UNHASTED ΣC_k) fixed it, and nobody re-checked. Verified
   07-31 and gated here so it cannot come back:
     · the response to moving a press across the 4.666 boundary is EXACTLY LINEAR — 26 samples at 0.1 s,
       every Δ identical to 1e-9. A realized-dead-time charge would show flat steps; an averaged one
       cannot.
     · the ramp sweep 0→7 is MONOTONE with no direction change, argmax at the 3-stack moment. §8o
       measured argmax @0 with a ±0.14 zigzag.
   ⚠ This is the user's principle expressed as a gate: the sub-cast offset is unresolvable, so the model
   must AVERAGE over it — and a window that starts late also ends late, so what survives is a constant
   rate of change, not a staircase. */
{
  const c = cfgOf(165, KIT, { bloodlust: [5] });
  const base = { isc: [7, 127], scb: [7, 127], arcanePower: [7], berserking: [127], bloodlust: [5] };
  const at = t => I({ ...base, icyVeins: [t, 127] }, c);
  // linearity across the ramp boundary at 4.666
  const d0 = at(2.5) - at(2.4);
  let maxDev = 0;
  for (let t = 2.5; t < 4.9; t += 0.1) maxDev = Math.max(maxDev, Math.abs((at(+(t + 0.1).toFixed(1)) - at(+t.toFixed(1))) - d0));
  chk('§8o: press response is LINEAR across the ramp', maxDev, 0, 1e-9,
      'every 0.1 s step must move the score by the same amount — a flat step is a realized dead-time charge');
  // and the ramp sweep must be monotone, not a period-2 wobble
  let flips = 0, p2 = at(0), p1 = at(1);
  for (let t = 2; t <= 7; t++) { const v = at(t); if (Math.sign(v - p1) !== Math.sign(p1 - p2)) flips++; p2 = p1; p1 = v; }
  chk('§8o: the ramp sweep 0→7 is monotone', flips, 0, 0,
      '§8o measured a ±0.14 period-2 zigzag here with the argmax at the pull');
}

/* ═══ §5b — BERSERKING MUST PREFER **INSIDE** BLOODLUST TO **BEFORE** IT ══════════════════════════
   Added 07-31 on MODEL-DEFECTS §8o's own handoff: *"the sharpest lead is that the uniform-slip build
   ranks Berserking BEFORE Bloodlust above Berserking INSIDE it — a question the closed forms answer
   unambiguously and `tools/law-check.mjs` could gate directly. Add that case to the gate first; it will
   localise the second defect without another sim run."*

   This is the ordering §8o's candidate fix got WRONG, and it is the reason that fix was reverted rather
   than landed. Gating it means the next attempt at the dead-time inconsistency fails HERE, on a closed
   form, in a second — instead of failing as a mysterious 13σ regression on a preset.
   ⚠ Deliberately an ORDERING assertion, not a magnitude one. The two windows sit in different company
   (m 1.0 vs m 1.3), so the exact gap depends on where the ramp toll lands; what the closed forms fix
   beyond argument is the SIGN. ESTABLISHED-FACTS §5: 10 s of Berserking is worth 0.667 casts with
   nothing up and 0.867 inside Bloodlust. */
{
  const c = cfgOf(180, ['berserking', 'bloodlust'], { bloodlust: [40] });
  const before = I({ berserking: [25], bloodlust: [40] }, c);   // [25,35] — ends before Lust starts
  const inside = I({ berserking: [45], bloodlust: [40] }, c);   // [45,55] — wholly inside Lust
  chk('Berserking INSIDE Bloodlust beats BEFORE it', inside - before,
      D5 * (rate(1.43) - rate(1.3)) - D5 * (rate(1.1) - rate(1.0)), 0.002,
      'inside − before = 10×[rate(1.43)−rate(1.3)] − 10×[rate(1.1)−rate(1.0)] — the SIGN is the law');
}

// ═══ §4 — haste × haste under the GCD cap ════════════════════════════════════════════════════════
// Icy Veins [0,20] and Berserking pressed at 19 vs 21: exactly 1.000 s of the 10 s window moves from
// inside Icy Veins to outside it. Per second that is worth
//   [rate(1.32) − rate(1.2)] − [rate(1.1) − rate(1.0)]
// ⚠ 1.000 s, not 0.835 s — under pure window geometry (MODEL-DEFECTS §8l) the overlap is the press
// difference itself. Under the old fire-snapped windows it was 0.835 s and the law read 0.011532.
{
  const c = cfgOf(120, ['icyVeins', 'berserking']);
  const per = (rate(1.32) - rate(1.2)) - (rate(1.1) - rate(1.0));
  chk('Berserking 1.000 s inside Icy Veins',
      I({ icyVeins: [0], berserking: [19] }, c) - I({ icyVeins: [0], berserking: [21] }, c),
      1.0 * per, 0.0002, `1.000 × ([rate(1.32) − rate(1.2)] − [rate(1.1) − rate(1.0)])`);
}

// ═══ §1.2c — truncation at the kill is linear in the seconds lost ════════════════════════════════
// Icy Veins is 20 s on a 120 s fight: pressed at 105 it loses 5 s to the kill, at 108 it loses 8 s.
// Each lost second is worth rate(1.2) − rate(1.0).
{
  const c = cfgOf(120, ['icyVeins']);
  chk('Icy Veins truncated 3 s more by the kill',
      I({ icyVeins: [108] }, c) - I({ icyVeins: [105] }, c),
      -3 * (rate(1.2) - rate(1.0)), 0.0005, `−3 × [rate(1.2) − rate(1.0)]`);
}

// ═══ §8l — a lone press slid in the interior changes NOTHING ══════════════════════════════════════
// The integral is `∫ rate(m(t)) dt` over window geometry. Sliding one window inside a uniform region
// moves the same area to a different place, so the total is invariant. This is the invariant that
// three earlier versions of `scoreStart` broke, each time by leaking the cast lattice in.
{
  const c = cfgOf(180, ['icyVeins']);
  const f = [138, 140, 142, 144, 146].map(t => I({ icyVeins: [t] }, c));
  chk('a lone press in the interior is FLAT', Math.max(...f) - Math.min(...f), 0, 1e-6,
      'sliding one window inside a uniform region cannot change ∫ rate dt');
}

// ═══ The value cluster is monotone off the raid call ══════════════════════════════════════════════
// Moving the whole cluster later can only lose Bloodlust overlap, so the slide must be non-increasing
// from the pin. A HUMP here means a window edge is being priced against the lattice again (§8i/§8k
// both showed up first as a hump at exactly this spot).
{
  const c = cfgOf(180, KIT, { bloodlust: [20] });
  const Q = t => ({ icyVeins: [t, 140], isc: [t, 140], scb: [t, 140], arcanePower: [t], bloodlust: [20], berserking: [140] });
  const st = [20, 21, 22, 23, 24, 25].map(t => I(Q(t), c));
  const mono = st.every((v, i) => i === 0 || v <= st[i - 1] + 1e-9);
  if (!mono) bad++;
  console.log(`  ${mono ? '✓' : '⛔'} ${'value cluster monotone off the raid call'.padEnd(46)} ` +
              st.map(v => ((v - st[0]) >= 0 ? '+' : '') + (v - st[0]).toFixed(5)).join(' '));
}

/* ═══ §4 — the haste × SPELLPOWER cross term. ★ THIS IS THE LINE THAT CLOSED §8p ═══════════════════
   A haste buff `a` over duration `D` adds `D·[rate(m·a) − rate(m)]` casts. If a +SP buff covers the
   same window each of those extra casts is worth `(1+s)` rather than 1, so the gain from OVERLAPPING
   the two windows rather than holding them apart is exactly

       D · s · [rate(m·a) − rate(m)],      s = COEF·ΔSP / (BASE + COEF·SP)

   MODEL-DEFECTS §8p recorded this as over-credited by ~⅓, measured model-vs-SIM. The engine
   reproduces the closed form to **0.000 %** on all four pairs, so the discrepancy was never in the
   model's internal arithmetic. ⚠ With the simulator retired, whether the LAW matches the game is no
   longer falsifiable — this line pins the model to its own algebra and can do nothing more. */
{
  const c = cfgOf(300, ['icyVeins', 'isc', 'scb', 'berserking']);
  const sOf = dsp => G.AB.COEF * dsp / (G.AB.AVG_BASE_DMG + G.AB.COEF * SP);
  for (const [label, hk, vk, a, dsp, D] of [
    ['haste × SP: IV × Icon',   'icyVeins',   'isc', 1.20, 155, 20],
    ['haste × SP: Zerk × gem',  'berserking', 'scb', 1.10, 225, 10],
  ]) {
    const stacked  = I({ [hk]: [100], [vk]: [100] }, c);
    const separate = I({ [hk]: [100], [vk]: [200] }, c);
    chk(label, stacked - separate, D * sOf(dsp) * (rate(a) - rate(1.0)), 5e-6,
        `${D} × s(${dsp}) × [rate(${a}) − rate(1)]`);
  }
}

/* ═══ AoE — §9. NEVER CHECKED BEFORE 07-30, and the first law is a genuine simplification ═════════
   Arcane Explosion is INSTANT (`cast = 0`), so its interval is purely the GCD. Arcane Blast at 3
   stacks is `max(msq(1.498/m), gcd)` — and the cast term can never win: below m = 1.5 the GCD is the
   larger of the two (1.5/m > 1.498/m), and above it both sit on the 1.0 s floor.
   ⇒ **AT 3 STACKS AN AoE PHASE CHANGES ONLY THE DAMAGE PER CAST, NEVER THE RATE.** That is worth
   knowing before reasoning about AoE: haste is worth exactly the same inside an AoE phase as outside
   it, and the whole value of the phase is the damage multiple. */
{
  const ivAB = m => 1 / rate(m);
  const ivAE = m => msq(Math.max(G.GCD_FLOOR, G.GCD_BASE / m));
  let worst = 0;
  for (const m of [1.0, 1.1, 1.2, 1.3, 1.43, 1.5, 1.56, 1.716, 2.0]) worst = Math.max(worst, Math.abs(ivAB(m) - ivAE(m)));
  chk('AoE: AB and AE intervals identical', worst, 0, 1e-12,
      'AE interval = gcd; AB = max(msq(1.498/m), gcd) and the gcd always wins at 3 stacks');
}

/* §9b — CRIT DOES **NOT** CANCEL ONCE AN AoE PHASE EXISTS, and the project has claimed the opposite.
   `crit is a constant factor and cancels` is true single-target: it multiplies every Arcane Blast
   equally and divides out of the normalisation. An Arcane Explosion carries an EXTRA crit-dependent
   term — `aoeCritAmp`, the Clearcasting → Arcane Potency amplification, which rises with the target
   count and FALLS as base crit rises (Potency has less headroom to add). So the AE/AB damage ratio is
   a function of crit, and the more crit you have the LESS an AoE phase is worth relative to single
   target. Measured at 1387 SP, N = 6: 2.6290 at 0 % crit → 2.5600 at 60 %, a 2.6 % swing. */
{
  /* ⚠ The expectation is RE-DERIVED from the talent constants, not quoted from a run. A first draft
     hardcoded 0.0690 — a number measured at 1387 SP while this file runs at 1000 — and it failed at
     0.07241, which reads exactly like a scorer regression and is not one. That is the failure mode
     this file's header warns about, caught by its own rule. */
  const AC = 0.02 * api.TALENTS.arcaneConcentration;    // per-HIT Clearcasting proc chance
  const POT = 0.10 * api.TALENTS.arcanePotency;         // crit added to the cast after a proc
  const critMultAt = c => 1 + Math.min(1, c) * (G.CRIT_MULT - 1);
  const amp = (N, c) => critMultAt(c + (1 - Math.pow(1 - AC, N)) * POT) / critMultAt(c + (1 - Math.pow(1 - AC, 1)) * POT);
  // critFactor multiplies BOTH an Arcane Explosion and an Arcane Blast, so it divides out; what does
  // NOT divide out is the amplification, which is why crit stops cancelling the moment N > 1.
  const K = (G.AE.AVG_BASE_DMG + G.AE.COEF * SP) / (G.AB.AVG_BASE_DMG + G.AB.COEF * SP);
  const ratio = (crit, N) => K * N * api.aoeCritAmp(N, crit);
  chk('AoE: single target, crit DOES cancel', ratio(0.60, 1) - ratio(0.00, 1), 0, 1e-12,
      'at N = 1 the amplification is 1 by construction, so the ratio is crit-independent');
  chk('AoE: at N=6 crit does NOT cancel', ratio(0.00, 6) - ratio(0.60, 6),
      K * 6 * (amp(6, 0.00) - amp(6, 0.60)), 1e-9,
      'K·N·[amp(N,0) − amp(N,0.6)], amp re-derived from arcaneConcentration/arcanePotency');
}

/* §9c — AN AoE PHASE IS A **CONSTRAINT**, NOT AN ELECTION, AND BELOW THE CROSSOVER IT COSTS DAMAGE.
   Probed 07-31 and filed under MODEL-DEFECTS "Not defects". `M(N)` — the per-cast AE/AB ratio — is
   **below 1** at low target counts, so an `aoe` segment there scores WORSE than the same fight with no
   phase declared at all. That reads like a missing `max(AE, AB)` per-cast election. It is not: the user
   DECLARES the phase ("I am AoEing here"), the UI accepts `N ∈ [1,20]` precisely so a weak forced AoE
   can be priced, and RULES §9 names this case — *"below threshold a weak AoE (N=2, M=0.82) is a dead
   zone the burst dodges"* — as brute-grid enumerated, sim-gated Phase-5 behaviour. The lower score is
   the model correctly reporting the COST OF THE CONSTRAINT.
   ⇒ These two lines exist so that adding such an election, or moving a constant that relocates the
   crossover, fails HERE with the doctrine attached rather than silently deleting the dodge that §9's
   placement thresholds are built on. */
{
  const K = (G.AE.AVG_BASE_DMG + G.AE.COEF * SP) / (G.AB.AVG_BASE_DMG + G.AB.COEF * SP);
  const M = N => K * N * api.aoeCritAmp(N, CRIT / 100);
  // The crossover must bracket N=2 / N=3. If a constant moves it, RULES §9's N*≈2.5 needs re-deriving.
  chk('AoE: M(2) < 1 < M(3) — the crossover brackets', (M(2) < 1 && M(3) > 1) ? 0 : 1, 0, 0,
      `M(1)=${M(1).toFixed(4)} M(2)=${M(2).toFixed(4)} M(3)=${M(3).toFixed(4)} — RULES §9 quotes N*≈2.5`);
  // …and the segment must OBEY it rather than electing the better spell.
  const phase = N => cfgOf(200, [], null, 0,
    { segments: api.buildSegments([{ from: 60, to: 90, type: 'aoe', mult: 1, targets: N }], 200) });
  const none = I({}, cfgOf(200, []));
  chk('AoE: a weak phase is FORCED, so it costs casts', Math.sign(I({}, phase(2)) - none), -1, 0,
      `N=2 scores ${I({}, phase(2)).toFixed(4)} vs ${none.toFixed(4)} with no phase — a constraint, ` +
      'not an election; do NOT "fix" this with a per-cast max(AE, AB)');
  chk('AoE: a strong phase pays', Math.sign(I({}, phase(6)) - none), 1, 0,
      `N=6 scores ${I({}, phase(6)).toFixed(4)} vs ${none.toFixed(4)}`);
}

/* ═══ THE EFFECTIVE-AB NORMALIZATION ITSELF — added 07-30, answering a direct user question:
   *"verify the effective ABs cast is getting calculated correctly."*
   Everything above checks what a BUFF is worth; nothing checked the quantity those worths are
   denominated in. The empty fight has a closed form with no free parameters at all:

       effective ABs (no buffs) = T · rate(m) − toll,     toll = Σ_k (C_k − G)/G   at m = 1

   ★ AND THE TOLL IS UNHASTED, WHICH IS THE WHOLE POINT (MODEL-DEFECTS §8q). Recomputing it at hasted
   cast times is the obvious derivation and it is WRONG — it is what makes compression pay and sends
   Icy Veins back to the pull. A *fixed* toll is what keeps the ramp haste-neutral, so asserting the
   SAME 1.332 at h = 0 and h = 600 is asserting §8q directly, which nothing else did.
   ⚠ These lines are not decoration under the negative control: at h ≠ 0 they read the quantised
   `rate`, so `--self-test`'s unquantised form breaks them. */
{
  const G1 = 1 / rate(1);
  const toll = [0, 1, 2].reduce((a, k) =>
    a + (Math.max(msq((G.AB.BASE_CAST - G.AB.STACK_CAST_REDUCTION * k) / 1), G1) - G1) / G1, 0);
  // A cast with nothing up is worth EXACTLY 1 — that is what "effective ABs" means.
  chk('a plain cast is worth exactly 1', api.plainCastOf(cfgOf(120, [])) / one, 1, 1e-12,
      'plainCastOf must equal (BASE + COEF·SP)·critFactor — the divisor `I()` uses');
  for (const T of [120, 300]) {
    chk(`empty ${T}s fight = T·rate − toll`, I({}, cfgOf(T, [])), T * rate(1) - toll, 1e-9,
        `${T}·${rate(1).toFixed(6)} − ${toll.toFixed(6)}; the ramp toll is Σ(C_k−G)/G at m=1`);
  }
  for (const h of [200, 400, 600]) {
    const m = 1 + h / (G.HASTE_RATING_PER_PCT * 100);
    chk(`empty 300s fight at h=${h} (toll still ${toll.toFixed(3)})`, I({}, cfgOf(300, [], null, h)),
        300 * rate(m) - toll, 1e-9,
        'the toll is HASTE-INVARIANT (§8q) — if this fails with a smaller toll, the ramp is being ' +
        'compressed by haste and Icy Veins will drift back to the pull');
  }
}

if (SELFTEST) {
  console.log(`\n${bad ? `SELF-TEST PASS — the seeded break (unquantised rate) was caught by ${bad} line(s).`
                       : 'SELF-TEST FAIL — the gate did NOT notice an unquantised rate. Its tolerances assert nothing.'}`);
  process.exit(bad ? 0 : 1);
}
console.log(`\n${bad ? `⛔ ${bad} law(s) violated — re-derive the expectation BEFORE touching the engine (see header).`
                    : '✓ all laws reproduce'}`);
process.exit(bad ? 1 : 0);
