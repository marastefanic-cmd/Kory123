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

**measure · Quantify the ramp-blindness ranking error** — **in progress.** Use A to answer: does the model's
flat-3-stacks (ramp-blind) scoring ever flip a *ranking* decision vs the sim? Early signal: **probably not.**
The ramp *evens out* for cast count (RULES §3, proven + sim-confirmed), the constant ramp deficit cancels
between layouts, and every model-vs-sim gap found so far traced to a **sim-setup artifact** (a haste buff
jammed at the fight end) or an effect the model already captures (Lust-stacking floor waste) — **not** a
model error. Still to stress: a scenario where a *damage* buff could want the pull (the one direction the
model would over-credit); the current scenarios never put a damage buff there. If that stays clean → **skip B**.

**B · De-ramp-blind the scorer** — **gated on `measure`.** Only if the data shows a real ranking error (most
likely: damage buffs over-credited at the pull, feeding degenerate "stack everything at 0:00" plans). Scope it
to exactly that differential; keep the constant-offset cancellation; sim-gate every golden that moves. This is
the *one* change that can destabilize the goldens (why the ramp was left out originally — `index.html:684`),
so it does not start until A has measured it and C is not yet touched.

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
