# EP.md — stat weights, two ways (and why we don't need a bespoke calculator)

Goal: an **EP / stat-weight** number (how much a point of each stat is worth, normalised to spell
power) for a given setup, planned by *its own* ideal cooldown usage. We get it two independent ways that
**cross-check** each other — and neither is a heavy new subsystem.

## The model route — EP in closed form from the effective-damage integral

The scorer's objective is `D = ∫ cast_damage(t) / interval(t) dt` (`MECHANICS §4`;
`cast_damage = (base + SP·coef)·crit_factor·dmg_mult`, `interval = max(cast_base/m, GCD_floor)`,
`m = (1+rating/1577)·∏ haste buffs`). EP is just its partials, and they come out clean:

- **`∂D/∂SP = coef · crit_factor · ∫ dmg_mult/interval dt`** — spell power scales every cast linearly; its
  weight is the (dmg_mult-weighted) cast count.
- **`∂D/∂crit = (CRIT_MULT−1) · ∫ (base+SP·coef)·dmg_mult/interval dt`** — per unit crit *fraction*;
  divide by `22.08` for per crit *rating*. (Add the AoE `aoeCritAmp` crit-term on AoE segments.)
- **`∂D/∂hasteRating = (1/(1577·1.5)) · ∫_UNFLOORED cast_damage·m dt`** — haste only buys casts where
  `interval > floor`; **floored windows contribute 0**. So the model's haste EP *automatically* discounts
  the GCD floor (Lust+IV overcap, etc.) — the thing a naïve weight gets wrong.

**Envelope theorem** — because the schedule is *optimal*, `dD*/dstat` (re-optimising) equals the partial
holding the schedule **fixed**, to first order: the optimizer's own shift is zero-gradient at the optimum.
So the frozen-schedule weight is the correct *marginal* EP **except at a haste breakpoint** (where the
optimal schedule jumps — IV sliding out of Lust). There, re-optimising lifts haste EP; that gap is the
entire reason a frozen-rotation sim "undervalues haste," and it's a narrow, detectable case (re-run the
planner at gear±Δ; if the schedule changed, you're on a breakpoint).

Compute it: `tests/ep-model.mjs "<preset name>"` finite-differences `simulate().total` on the page
(frozen **and** re-optimised), normalised to SP=1.

## The sim route — finite-difference wowsims on the same optimal schedule

Feed wowsims the planner's optimal schedule as a forced-schedule APL (`tools/genapl.mjs` already emits it
— `APLActionSchedule` per cooldown, which the web UI's Rotation → APL also supports) and either use its
native **Stat Weights → Calculate**, or finite-difference the `runner` directly (flags `--sp` / `--crit`
/ `--haste` add bonusStats): `tests/ep-sim.sh '<genapl-spec>' [dur] [iter] [delta]`. Common random numbers
(same `--seed`) keep the paired diff low-noise. This is a *frozen*-rotation weight; it matches the
model's frozen weight away from breakpoints. **Because we feed it our own haste-aware schedule, the
classic "frozen rotation undervalues haste" bias is gone** — the frozen rotation *is* the optimum.

## Cross-check (validated, `6:00 lust 4:20`, 0 gear haste, ~1387 SP / 38% crit)

| EP (SP = 1.000) | Model route | Sim route (frozen) |
|---|---|---|
| Crit (per rating) | 0.697 | 0.687 |
| Haste (per rating) | 1.432 (frozen) · 1.471 (re-opt) | 1.513 |

**Crit agrees to ~1.5%** — a direct validation of the model's damage/crit formula against the engine.
**Haste agrees to ~5%**, model slightly lower: expected, because the model is deliberately **ramp-blind**
(steady 3 stacks — it doesn't credit haste for compressing the opening 0/1/2-stack ramp, to avoid the
reverted "phantom triple-stack the pull" incentive; RULES §3, `index.html` footer). The re-optimised
model haste (1.471 > frozen 1.432) moves *toward* the sim — this setup sits on a haste breakpoint (the
optimizer reported the schedule changing under ±100 haste), exactly the envelope-theorem case above.

## Practical notes / caveats
- **Trust-anchor the APL first** (build it, sim it, confirm the DPS matches the tool's expectation)
  before trusting weights — same discipline as any sim gating (`TOOLING`).
- The rig is **infinite-mana, AB-only**, so these are **overlay + throughput** weights: mana stats
  (spirit / mp5) read ~0 and crit/haste are burn-window values, not a mana-constrained full rotation.
  Consistent with the planner's own assumptions.
- **Setup comparison** falls out of the same machinery — plan each setup, then compare on **absolute**
  at-kill damage (or each setup's optimal-APL sim DPS), **not** the effective-casts count (that's
  normalised per-setup, so it hides flat SP/crit throughput; it's the *within*-setup objective only).
