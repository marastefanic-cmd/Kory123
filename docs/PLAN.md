# PLAN.md — Phase 4: understand the optimum, then make the search find it

**Status: in flight (user-directed).** The original Phase 4 was "kill the 70→71 non-monotonicity" (a pure
search bug). It's now reframed: before hardening the search we **build the instrument** that finds the true
optimum without a search and **measure** whether the model even needs fixing. Three workstreams, in a forced
order (each is a prerequisite for the next):

## The sequence (locked): A → measure → B(gated) → C

**A · Exploration harness** (`tools/explore.mjs`) — **DONE this session.** Brute-scores every placement of a
small buff set on the model over a gear-haste sweep; the winner is exact by construction (no search), so it's
both a ground-truth **oracle** for the search and a **rule-finder**. It reproduced the theorycraft
autonomously (RULES §3/§5/§7/§16): damage buffs place greedily (no breakpoint), haste buffs carry the
breakpoints — **but SP buffs shift those breakpoints** (AP in-Lust moved IV's exit from ~15→~80 rating), so
the decomposition is *coupled*, not separable. `--sim` cross-checks ramp-sensitive winners against wowsims.

**measure · Quantify the ramp-blindness ranking error** — **DONE, answer: the error is real but small.**
Haste placement is ramp-indifferent (proven + sim-confirmed); the genuine gap is **damage buffs on a ramp**:
the blind model ties "damage on the ramp" with "damage past it" while the sim prefers past it (+0.1% at a
Lust-pull, +0.39% at an intermission exit; the user's ≥394-haste "Icon eats the ramp" case measured ≤0.1%).
Self-limiting in DPS but produces wrong-*looking* plans, and the user chose to fix the physics (→ B).

**B · De-ramp-blind the scorer** — **GREENLIT (user-directed) and in flight; WIP patch = `tools/ramp-dock.wip.patch`**
(apply with `git apply tools/ramp-dock.wip.patch`; the no-op `scanAt`/`intervalAt` refactor it builds on is
landed). The user chose full de-ramp-blinding over a tie-break: the ramp is a real fight mechanic, and fixing
the physics keeps the "earliest possible" rule clean. Decisions locked: **pull starts at 0 stacks, no prestack
modeling** (a start-intermission input already covers delayed openers); intermission exits always re-ramp.
- **Design (the WIP dock):** keep `interval` (cast-count/haste valuation) UNTOUCHED — the ramp's cast-count
  cost is exactly 1.333 casts per ramp-start, haste-independent below the floor, so haste placement-
  independence (RULES §3) is preserved *exactly* (verified 0.0000% pre-vs-post at h0–200). Dock only the
  DAMAGE of the phantom casts, sampled at each ramp cast's **completion time** (damage lands on completion;
  midpoint sampling re-created the phantom "haste compresses the ramp" credit and was sim-refuted — the
  IV@0-vs-IV@5 pull flip, sim says IV@5 by +0.07%).
- **Sim scoreboard so far** (prestack 0, 80k iters, 2 seeds): exit-ramp damage delay **+0.39% CONFIRMED**;
  bare-pull (late-Lust) cluster 0:00→0:06 delay **+0.10% CONFIRMED**; early-Lust opener does NOT move
  (golden confirmed at exact 6.5s boundary); "haste-first" opener (Zerk@5, IV+cluster@15, from the 4:00 /
  Solarian movers) **−0.20% REFUTED** — the deficit heuristic overcharges when a single ramp completion sits
  inside an early damage window.
- **Golden triage under the dock** (25 cases): 10 byte-identical, **9 model-driven movers** (sim-gate each
  class), **4 SEARCH MISSES** (1:40 −34, Morogrim −97, 2:40 −97, 5:40 −915 robust: the search returns plans
  *worse than the old golden re-scored* — C-fragility exposed by the new landscape), **2 tie-drifts**
  (Lurker, 2:40-intermission: equal score, different canonical text).
- **Next for B:** replace the deficit heuristic with the **exact discrete ramp** — integrate `[rampStart,
  rampEnd)` as the sum of the 3 real completions instead of rate×time (kills the (b) overcharge by
  construction), re-triage, sim-gate the surviving movers, and only then `--update` those goldens. The 4
  search misses + 2 tie-drifts must be fixed (C) before the suite can go green — **B and C land together.**

**C · Optimizer robustness (haste-monotonicity)** — the original Phase 4, now **last** (it must tune the
search to the *final* scoring model). Acceptance: `tests/monotonicity.mjs` = **0 violations**, exact-match
stays green. With A providing the oracle + canonical seeds and the coupling rule understood (§16), seed the
multi-start with the structured optima (packed / IV-out / SP-coupled variants), add a self-consistency guard
(never return worse than an obvious candidate or than the lower-haste plan re-scored), and canonicalize ties.

## Why this order (the dependencies are forced)
- **A first:** it's the instrument for B and C, low-risk (pure tooling, can't touch a golden), and it turns
  "the search misbehaves" into "here is the exact optimum it should have found."
- **A gates B:** you can only trust a ramp model if you can prove it matches the sim across placements — that
  *is* A.
- **B before C:** C tunes the search to the model; changing the model after would mean redoing C.

## The invariant C enforces (proven — a theorem, not a heuristic)
With infinite mana, adding spell haste can only raise (or, at the GCD floor, hold) the effective-AB count for
the **same** layout (`interval` only shrinks; buff windows scored at intent times; a low-haste layout stays
feasible). So the optimum is non-decreasing in haste and **any decrease is a SEARCH MISS**. Verified
empirically 0–250 rating, zero drops. The measured misses (71-vs-70 on 1:40; ~0.02–0.03-cast sweep misses)
are the search returning worse than a plan it already had — a search-quality bug, not a model breakpoint.

## Guardrails
- exact-match **25/25** throughout; any golden that moves is model-neutral or sim-gated (a blind spot in play).
- Determinism preserved (seeded PRNG; no `Date.now`/`Math.random` outside it).
- Don't touch the scorer physics except in B, and only if `measure` warrants it. Keep docs current in the same
  commit (RULES §3/§16, TOOLING, ROADMAP).

## Deferred this session (restore when the search is airtight)
- Timeline **leeway "press anywhere" bands** + action-plan **reasoning tags** (removed from `index.html`;
  logic in git history). The haste-graph reference LINES stay.
