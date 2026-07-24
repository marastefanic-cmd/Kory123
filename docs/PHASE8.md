# PHASE 8 — the B2 scorer-gap family (reserved for the highest-effort model)

**Status:** SCOPED, not started. This is the work the user reserved for "unleash the strongest model
with the highest effort." Phase 7 fixed everything cheaper: three press-execution scorer terms (RULES
§3b), two search passes, the metric (var0.5 + wall-jitter), the KT AoE harness, and — the big one —
**cross-haste pooling, which makes model-side invariant B1 hold BY CONSTRUCTION** (ARCHITECTURE;
end-to-end proof: scb+mqg medlong deficit 0.20% → **0.01%** with pooling, same seed). What remains is a
small, hard residual that pooling CANNOT touch, because the model itself mis-ranks the two layouts.

## What's left (the B2 family)
After Phase 7, the fight-class round improved from Phase 6 **worst 0.77% → 0.40%, mean 0.160% → 0.075%,
columns ≥0.3% 19 → 5** (var0.5, apples-to-apples). The **~5 var-robust ≥0.3% columns** that remain are
all SCORER-GAPs: the model *prefers the native* plan, yet the sim prefers a *borrowed* one. Pooling only
adopts a borrowed plan when the model agrees it's better — so these survive. They share one shape: the
**sim prefers pull/early-anchored on-use haste** where the model tolerates a later placement.

Representative (the one dug to ground):
- **isc+mqg medlong T=229 Lust@162, sim@70.** Native puts MQG@202 (on IV@202, on the terminal cluster,
  near the T=229 kill); the borrowed plan puts MQG@9 (early). **Moving ONLY MQG@202→@9 captures the
  whole deficit: sim +0.461%** (the rest of the layout diff is noise/negative). But the **model ranks
  MQG@202 HIGHER** (marginal 3.536 vs 3.194 casts; model prefers native by 0.34 casts). So the model is
  backwards on this one placement by ~0.34 casts, and the sim says it's worth ~0.46%.

## Why it's HARD (what was ruled out — each is clean in isolation)
The deficit does NOT reduce to any single clean scorer term. Isolated minimal-pairs (this session,
`scratchpad/posindep.mjs`, `iso2.mjs`, `clincher.mjs`, sim var0.5 CRN + model):
1. **Haste over a DAMAGE (SP) buff** — position-independent in the model, **0.000 cast gap** (Skull
   on/off Icon). NOT the bug.
2. **Haste stacked on IV (another haste) near the floor** — model AND sim BOTH prefer stacked
   (model +0.5 cast, sim +0.53%). They AGREE. NOT the bug.
3. **Lone haste early vs late (kill-truncation)** — model early==late EXACTLY (position-independent),
   sim early≈late (0.004%, noise). Both a wash. NOT the bug.
So each candidate mechanism is individually correct. The 0.46% is an **emergent interaction of all
three at once** — MQG simultaneously (a) stacked on IV, (b) on the terminal damage cluster, (c) within
a cast or two of the kill — that the model's separable cast-rate integral doesn't capture jointly.

## The Phase-8 task
Find the joint-interaction term. Likely candidates to investigate with the strongest model:
- The **kill-window width** (`KILL_WINDOW = 0.5s`) vs how haste banks extra casts toward the kill when
  the haste buff ALSO rides a near-terminal damage/IV cluster (the banked casts land in the taper).
- Whether the **discrete-ramp / press-snap machinery** interacts with a near-kill floored window
  differently than the steady integral assumes.
- A possible **joint haste×damage×kill correction** — but this touches the CORE integral, is high-risk
  (can move the 25 goldens), and MUST be sim-gated across every golden + the full campaign. Do it as its
  own carefully-gated phase, one hypothesis at a time, exactly like the Phase-7 §3b terms.

## Guardrails (unchanged)
Determinism; exact-match 25/25; a golden may move ONLY if its effective-AB count improves AND it
sim-verifies (var0.5 CRN); B1 must stay clean by construction (pooling); monoDip=0. The full acceptance
re-run (var0.5 + wall-jitter, pooling ON) is the thorough gate — run it after any core-integral change.
