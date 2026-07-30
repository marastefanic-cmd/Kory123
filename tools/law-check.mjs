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

const api = loadEngine(new URL('../index.html', import.meta.url).pathname);
const G = api.GAME;

// One plain, unbuffed Arcane Blast at the reference setup — the unit every law below is quoted in.
// Read from GAME, never re-typed (reference-gear.mjs doctrine).
const SP = 1000, CRIT = 25;
const one = (G.AB.AVG_BASE_DMG + G.AB.COEF * SP) * (1 + (CRIT / 100) * (G.CRIT_MULT - 1));

const cfgOf = (T, kit, fixed, haste) => ({
  T, hasteRating: haste || 0, sp: SP, critPct: CRIT,
  enabled: Object.fromEntries(ALL_BUFFS.map(k => [k, kit.includes(k)])),
  fixed: fixed || {}, warnings: [], coldSnap: true, segments: null,
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
  const c = cfgOf(120, []);
  const ivAB = m => 1 / rate(m);
  const ivAE = m => Math.max(msq(G.GCD_FLOOR), msq(G.GCD_BASE / m)) === msq(Math.max(G.GCD_FLOOR, G.GCD_BASE / m))
                  ? msq(Math.max(G.GCD_FLOOR, G.GCD_BASE / m)) : msq(Math.max(G.GCD_FLOOR, G.GCD_BASE / m));
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
