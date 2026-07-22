# PLAN.md — Phase 4: understand the optimum, then make the search find it

**Status: A + measure + B LANDED; C's guard machinery landed and triage-clean (0 search misses,
25/25 goldens). One acceptance item open: `tests/monotonicity.mjs` = 0 violations (running).**
When that certifies, delete this file (fold anything lasting into ROADMAP) and consider restoring the
deferred UI (leeway bands + reasoning tags — logic in git history).

## What landed (see ROADMAP "Phase 4" for the full record)

- **A** `tools/explore.mjs` — the brute-enumeration oracle/rule-finder (RULES §16).
- **B** The exact discrete ramp, compromise-less (RULES §3): cold 0-stack opener + post-gap re-ramps at
  true cast lengths on the press board (single source of truth); ramp casts scored discretely at their
  completions (jitter-smoothed ±½ GCD); **press-snap** — presses landing mid-ramp-cast fire at the cast's
  real end (sim-log-verified); integral everywhere else. Haste placement-independence preserved exactly;
  fixed-layout haste sweeps show 0 drops. All mover classes sim-confirmed on the FIXED rig (TOOLING:
  `ap-cd-at-cast.patch`, runner provenance).
- **C (machinery)** `basinHop` window-teleport guard + joint window-move in `polish` + kill-anchored seed +
  denser shift ladder + top-6 snaps. Triage: 19 model-driven improvements, 6 ties, **0 search misses** vs
  the previous tool's plans.

## Open

1. **Monotonicity certification** — `tests/monotonicity.mjs` (sweep 0–150, then `--step 1` spot checks)
   must show 0 violations on the final model. If a violation survives, it is a SEARCH miss by
   construction (the fixed-layout theorem still holds — verified post-ramp) — extend basinHop anchors or
   seeds until clean.
2. **Known headroom (not a regression):** on 5:40 the fractional-polish basin sits ~0.1 casts above the
   integer champion (`polish(old-golden)` = 582901 vs champion 582560). The champion still beats the old
   tool's plan; closing the last fractional gap is future search work.
3. **Runtime:** basinHop roughly doubles `optimizeAsync` (~15–40s per plan headless). Acceptable; optimize
   later if the UI feels it.
