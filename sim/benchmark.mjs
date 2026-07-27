// THE BENCHMARK — one definition, two consumers.
//
// Everything here is a setting of the *duel protocol*: how this project asks wowsims "of these two
// layouts, which does the real engine prefer?". It is imported by BOTH consumers rather than typed
// out in each:
//
//   • the page          — `index.html`'s "Verify in the benchmark sim" button (via sim/simreq.mjs)
//   • the terminal      — `tools/plan-duel.mjs --sim`, `tests/sim-duel.mjs`, `tests/sim-request.mjs`
//
// ★ THE REASON THIS FILE EXISTS is the one the reference-gear file already learned the hard way: a
// setting written out in two places is a setting that will eventually differ in two places, and the
// failure mode is silent — both sides keep printing plausible DPS. So: **import it, never retype it.**
// `runnerFlags()` below exists so even the NATIVE command line is generated from this object; if you
// find yourself writing `'--var', '0.5'` into a new tool, you are re-opening that bug.
//
// ── WHAT IS SHARED, AND WHAT DELIBERATELY IS NOT ──────────────────────────────────────────────────
// SHARED: the protocol — duration variation, mana, hit cap, rating conversions, seeds, iterations,
// the tie band. These describe *how the question is asked*, and must match everywhere.
//
// NOT SHARED: the CHARACTER. There are two, on purpose:
//   • `tools/reference-gear.mjs` + a real wowsims export — the harness's cross-val instrument, which
//     compares the model against a specific, fully-geared raid setup (Tirisfal 2pc, effective SP
//     ≈1450). That file is explicitly NOT for `index.html`.
//   • `sim/model-ref.json` — the BENCHMARK character used by the page: synthetic, gear-less, no
//     buffs, no consumes, hit-capped, standard Arcane talents, with the planner's own three inputs
//     (spell damage / crit / haste rating) injected on top.
// They answer different questions and must be free to differ. What must NEVER differ is the protocol
// below — hence this file, and hence `tests/sim-request.mjs`, which asserts that the request the PAGE
// builds is byte-identical to the request the NATIVE runner builds for the same duel.

export const BENCH = Object.freeze({
  // ── the fight ───────────────────────────────────────────────────────────────────────────────────
  // ⚠ Duration variation USED to be justified as "the model's kill-window WIDTH" — that rationale
  // DIED 2026-07-27 when the kill taper was retired (PHASE12 §9). The model is now deterministic at
  // T and credits a straddling cast its fitting fraction, so there is no window here to match.
  // ★ The value stays 0.5 anyway, on its OWN evidence, which never depended on the model: the sim
  // has a discontinuity the model no longer has, and averaging over T ± 0.5 is how the SIM avoids
  // parking its fight end on it. Model and sim now smooth the same problem by different means —
  // analytically vs numerically — and reconciling their two answers is an OPEN question recorded in
  // PHASE12 §9.4. Do not "fix" it by flipping this to 0; that reintroduces the measured failure below.
  // ★★ NEVER 0 — SETTLED BY MEASUREMENT 07-26 (`tools/var-decision.mjs`, BENCH §3): at
  // var 0 mean casts is flat for 1.5s then jumps +0.97 casts in one 0.1s step, and when two arms
  // differ in TERMINAL cast rate the measured effect swings −32.8 → −0.9 → −31.8 DPS across 0.1s of
  // fight length (worst step 31.4 DPS vs 3.3 here). It is also not quieter — seed band 0.06/0.40 vs
  // 0.04/0.25 — because a fixed duration parks the fight end exactly on the discontinuity.
  variation: 0.5,

  // Mana is not in the model at all, so it must not be in the arbiter either: the duel isolates the
  // LAYOUT. 1e8 is "infinite" for any fight length this tool accepts.
  manaInject: 1e8,

  // ── the statistics ──────────────────────────────────────────────────────────────────────────────
  // 10k is where the mean settles to ~0.02% (TOOLING: "10–60k is plenty"; 250k was always wasteful).
  // More iterations cannot shrink a *structural* disagreement — those are cast-boundary parity and
  // wall phase, which metric design fixes, not sample size.
  iterations: 10000,

  // ★ ONE SEED FOR BOTH ARMS = common random numbers. The two layouts then meet the same fights in
  // the same order, so the paired DIFFERENCE is resolved far better than either absolute DPS. This is
  // the single most important line in the file: change it to "a seed per arm" and a 0.3% real effect
  // vanishes into ±2% single-iteration spread.
  seed: 11,

  // Multi-seed band for the terminal instruments, which can afford the wall clock. Base seeds must be
  // spaced by at least `iterations` or the runs share iterations and the "band" collapses to ~0 —
  // which passes every delta (plan-duel.mjs asserts this).
  seeds: Object.freeze([11, 100011, 200011, 300011, 400011]),

  // Below this, a duel result is noise wearing a decimal point. The UI says "too close to call"
  // rather than crowning a winner, which is the difference between an instrument and a slot machine.
  tieBandPct: 0.05,

  // ── the character's fixed knobs (the synthetic benchmark mage; see sim/model-ref.json) ──────────
  // Spell hit pinned at the cap so misses never enter the comparison. vs a level-73 target the base
  // miss is 17% and 16% hit removes all of it except a **1% irreducible floor**
  // (`math.Max(0.01, …)` in wowsims' SpellChanceToMiss) — which cancels between arms anyway.
  hitCapPct: 16,

  // wowsims rating conversions, read from the source at `ade9f39` rather than folklore:
  //   SpellHitRatingPerHitPercent   = 12.615385   (sim/core/base_stats_auto_gen.go)
  //   SpellHasteRatingPerHastePercent = 15.76923  (the model uses 15.77 — same number, MECHANICS §2)
  hitRatingPerPct: 12.615385,
  hasteRatingPerPct: 15.76923,
  critRatingPerPct: 22.08,

  // The model never prepulls, so neither may anything compared to it. A prepull cast sits at a FIXED
  // −2.3s that does not scale with haste, which makes a haste sweep non-monotone — physically
  // impossible, and it silently corrupts every gear comparison (TOOLING ★★★, RULES §3, genapl header).
  prestack: 0,
});

// Native `runner` flags for one arm, GENERATED from BENCH so the command line cannot drift from what
// the page sends into the wasm. `opts`: { export, apl, T, seed?, iterations?, targets?, sp?, critPct?,
// hasteRating?, tag? }. Stat injections are omitted when absent, exactly as the runner treats 0.
export function runnerFlags(opts) {
  const f = [
    "--export", opts.export,
    "--apl", opts.apl,
    "--dur", String(opts.T),
    "--var", String(BENCH.variation),
    "--iter", String(opts.iterations ?? BENCH.iterations),
    "--seed", String(opts.seed ?? BENCH.seed),
    "--mana", String(BENCH.manaInject),
  ];
  if (opts.sp) f.push("--sp", String(opts.sp));
  if (opts.critPct) f.push("--crit", String(opts.critPct * BENCH.critRatingPerPct));
  if (opts.hasteRating) f.push("--haste", String(opts.hasteRating));
  if (opts.targets > 1) f.push("--targets", String(opts.targets));
  f.push("--quiet", "--tag", opts.tag || "bench");
  return f;
}

// `node sim/benchmark.mjs` prints the protocol — for shell scripts, and so a human can read the
// settings without opening a source file.
if (typeof process !== "undefined" && process.argv && process.argv[1] &&
    process.argv[1].endsWith("benchmark.mjs")) {
  console.log(JSON.stringify(BENCH, null, 2));
}
