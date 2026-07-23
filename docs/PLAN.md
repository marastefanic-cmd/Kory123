# PLAN.md — Phase 5: crack AoE phases (or prove they're just a phase modifier)

**Status: planned (user-directed).** The question to settle: is an AoE phase fully captured as a
**per-cast damage modifier on the phase** (Arcane Explosion spam = same interval physics as 3-stack AB,
damage × `M(N)`), or does it change PLACEMENT structure in ways the current model/rules miss? Whatever
survives becomes RULES §9's final form, the same way Phase 4's brute-forcing settled the haste laws.

## What is already known (don't re-derive)

- **AE constants are exact vs source** (`arcane_explosion.go`, spell 27082): 377–407 base (avg 392),
  coef 0.214, instant, GCD-bound, full per-target damage. A 6-target AE cast ≈ 2.25× an AB cast.
- **Interval physics is IDENTICAL to steady AB**: AE interval = `max(1.0, 1.5/m)` = 3-stack AB's — haste
  and the GCD floor behave the same during AoE. (So the *rate* side of an AoE phase is nothing new.)
- **Super-linearity in N is real and modeled**: Clearcasting→Arcane Potency per-hit procs → `aoeCritAmp`
  (RULES §9; talent-isolation-verified; ~75–80% of the measured amp, conservative).
- **AE neither builds nor refreshes AB stacks** → an AoE run ≥ 8s ends in a re-ramp (now modeled exactly).
- **AP/IV over AoE sim-verified** (≈×1.30 / ×1.18–1.20); KT's double-IV-over-AoE golden is sim-supported.
- Harness: `runner --targets N` + `tools/genae.mjs` (AE-spam APL). Use the FIXED rig only
  (strict-ready + ap-cd-at-cast; TOOLING provenance rules).

## The questions Phase 5 answers

1. **The modifier claim.** If damage/cast = `M(N)`× and interval physics is identical, an AoE phase should
   place exactly like a **burn phase** with `mult = M(N)` (plus the re-ramp at its end). Verify: brute
   (segments-aware) vs the model's placement on fights with an AoE window — if optima coincide with the
   burn-phase-equivalent fight, the claim holds and §9 collapses to "AoE = burn × M(N) + exit ramp".
2. **The N-threshold bands.** At what target count does the damage cluster (Icon/gem/AP) abandon Lust for
   the AoE window? Predicted from flux: when `M(N) × (AoE-window rate)` beats the Lust-window flux —
   compute the closed form, brute-verify, sim-gate. Same for IV/Zerk (haste on instants = same value, so
   haste should follow the cluster only via the §7 coupling, not for its own sake).
3. **Phase-edge effects.** The AoE exit re-ramp (already modeled) + entry: last AB before the phase, first
   AB after; does the optimizer hold cooldowns through short AoE phases correctly (cooldowns tick, stacks
   survive < 8s)?
4. **KT re-certification.** The only AoE boss golden — re-gate its plan classes on the fixed rig with
   `--targets` isolation (its old gates predate the AP-180 patch).

## Method (the Phase-4 playbook, reused)

- Extend `tools/brute-grid.mjs` to accept a **segments** spec (AoE window [a,b] × N targets) — the full
  5s-grid enumeration is ~11μs/cell, so exhaustive certification stays <1 min per (haste, N) point.
- Sweep N = 2/4/6/10 × haste = 0/150/250 on a T=80-with-AoE fight; map the layout morphology; find the
  N-thresholds; generalize the closed form; sim-gate every novel class (genae + --targets, var0+var10,
  paired seeds).
- Solidify into RULES §9 (bands + the modifier verdict); ROADMAP the record; delete this file.

## Guardrails

Exact-match 25/25 throughout (any golden move must be a strict model improvement + sim-gated — KT is the
one likely mover); determinism; scorer physics untouched unless a verified blind spot demands it (then
sim-gated, Phase-4·B style); docs in the same commit.
