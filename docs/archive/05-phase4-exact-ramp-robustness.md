<!-- ARCHIVED phase plan — recovered from git history. Source: docs/PLAN.md @ 8c271bc
     2026-07-22 — Defer leeway bands + reasoning tags; add monotonicity test + Phase 4 plan
     Historical snapshot of the plan AS WRITTEN (intent + rationale at the time); later
     phases may have revised or reversed it. Outcomes & corrections: docs/DIARY.md. -->

# PLAN.md — Phase 4: optimizer robustness (haste-monotonicity)

**Status: planned (user-directed).** The scorer physics and the Phase-3 helpers are solid; the gap the
user found is **search robustness** — tiny input changes flip the layout and occasionally *lose* effective
casts. This phase makes the optimizer honour the monotonicity invariant. UI flair (leeway bands, reasoning
tags) is **deferred** until this is airtight (both removed from `index.html` this session; restore from git).

## The invariant (proven this session — it is a theorem, not a heuristic)

**With infinite mana, adding spell haste can only raise (or, at the GCD floor, hold) the effective-AB count
— for the SAME layout. Therefore the optimum is non-decreasing in haste, and any decrease is a SEARCH MISS,
not a model breakpoint.**

Proof, in our model: for a fixed layout the score is the cast-rate integral `∫ dmg/interval dt`, with
`interval = max(cast/m, gcd(m))`. `dmg` is haste-independent; `interval` only shrinks as the haste
multiplier `m` grows (or holds at the floor); the buff windows are anchored at **intent times** — the
scorer deliberately does **not** snap them to the moving cast boundary, so no button-press quantization
enters the score (`simulate`, `eff = e.ts`); a layout feasible at low haste stays feasible at high haste
(cooldown spacing is in fixed seconds). Non-decreasing integrand over fixed bounds ⇒ non-decreasing
integral. **Verified empirically** (`fixedmono` scratch test): three fixed layouts, robust non-decreasing
across haste 0–250 at 1-rating resolution, zero drops. So the model has **no weird breakpoints** — even
through buff activation (the *display*'s effective times snap to cast boundaries and shift with haste, but
that is cosmetic and never enters the score or the optimizer's objective).

## The bug (measured this session)

The multi-start search misses the monotone optimum on some inputs:
- **71 vs 70 haste (1:40):** 71-optimum robust **205479**, but the 70-plan re-scored at 71 = **205597**.
  The search found something *worse than a plan it already had*. The 71-plan even had `IcyVeins:[0, 47]`
  (an IV pressed at t=0) — a degenerate candidate the local search didn't clean up.
- **Haste sweep (1:40, step 5):** 2 "worse-than-prev-plan" misses (h=25, h=75), each ~**0.02–0.03**
  effective casts. Small in DPS (~0.03%) but each flips the LAYOUT visibly (opener cluster 0:07↔0:17,
  Berserking 0:07↔0:27), which is what reads as broken and erodes trust.
- **10 haste (1:40):** cluster parked at 0:17 with Berserking overcapping at 0:07, when the clean plan
  (cluster 0:07, Berserking spread to 0:27) ties it. `slideEarliest` can't fix this — it only pulls
  earlier; it can't spread Berserking later, and the two moves are jointly optimal.

## Acceptance criterion (the test — already written)

`tests/monotonicity.mjs` sweeps haste over plain fights and asserts effcasts is (a) non-decreasing and
(b) never worse than the previous-haste plan re-scored at the current haste. **Currently fails; target = 0
violations.** Add `--step 1` for the fine 70→71 class. Plain fights only (intermission ramps are a
model-vs-sim topic, not monotonicity — RULES §10).

## Approach (investigate in order; each is model-neutral or sim-gated)

1. **Monotone / canonical seeding.** Seed the multi-start with strong structured candidates so the search
   can't miss the obvious optimum: the canonical "all cooldowns packed at the earliest burst, haste buffs
   spread off the GCD floor" layout, plus the "IV-out-of-Lust" high-haste variant (RULES §5). If the true
   optimum for each haste regime is among the seeds, the local search finds it consistently.
2. **Self-consistency guard (cheap, deterministic, directly enforces the invariant).** After
   `optimizeAsync`, evaluate a small fixed set of reference layouts (canonical + the champion) at the
   current cfg and keep the best. Guarantees "never worse than an obvious candidate." Could also compare
   against the plan the tool produces at a slightly lower haste (the invariant says it must be beatable).
3. **Tie-canonicalization beyond `slideEarliest`.** The visible flips are largely *tied* plans chosen
   inconsistently. `slideEarliest` canonicalizes cluster POSITION (earliest); we also need the haste-buff
   SPREAD canonicalized (Berserking off the floored opener → its natural later tick) so tied plans look the
   same across haste. Extend/replace `spreadLoneHaste`.
4. **Kill degenerate candidates + deepen search.** Diagnose the `IcyVeins:[0]`-type artifacts (how the
   search produces them and why the local passes don't clean them up); widen starts / strengthen local
   moves where a specific haste band misses.

## Diagnostic leads (scratch harnesses exist under the session scratchpad)

`h7071.mjs` (search-miss cross-check), `monosweep.mjs` / `tests/monotonicity.mjs` (sweep), `fixedmono.mjs`
(model monotonicity proof), `h10probe.mjs` (tie structure). Reuse these.

## Guardrails
- exact-match **25/25** throughout (any golden that moves must be model-neutral, or sim-gated if a blind
  spot is in play — but this phase should mostly *tighten* the search, not change optima).
- Determinism preserved (seeded PRNG; no `Date.now`/`Math.random` outside it).
- Don't touch the scorer physics — it's proven monotone. This is a **search** phase.
- Keep docs current (RULES §10 / a new "optimizer robustness" note; ROADMAP) in the same commit.

## Deferred this session (restore when the search is airtight)
- The timeline **leeway "press anywhere" bands** and the action-plan **reasoning tags** — both removed from
  `index.html` (the logic — `leewayZones`, the tag inference — is in git history). They diluted focus and
  could mislead while the search still mis-places. The haste-graph reference LINES stay (they harm nothing).
- `leewayZones()` remains defined but unused; re-wire it (or delete) when the leeway UI returns.
