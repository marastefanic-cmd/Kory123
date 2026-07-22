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

## The model's layout EP is an INFINITE-MANA ceiling — real Arcane weights differ

The model route (and the sim route on the AB-spam APL) assume infinite mana, so its weights are the
**layout / time-limited** EP. Real Arcane play is **mana-managed** (conserve with Frostbolt filler to
never OOM = spending the mana budget *to the margin*), and the mana constraint moves weights **two ways
the infinite-mana model can't see** — the same coin, both faces:
- **It deflates haste.** When mana binds, `total casts = mana_budget / mana_per_cast`, which haste
  doesn't change — more haste just spends the budget faster and idles sooner (~0 net casts). Haste only
  pays in the **time-limited burn windows** (AB-spammed regardless of mana). So real haste ≈ **0.4–0.6**,
  not the model's ~1.4 ceiling (matches generalised Arcane wisdom that haste is the weak stat; sim
  anchors: 0.35 real-mana-OOM ↔ 1.38 infinite). Short fights that are genuinely time-limited keep haste
  high; long/conserve fights don't.
- **It inflates the mana/regen stats** (§ sustain bullet): +1 mana buys AB-over-Frostbolt uptime (~1.5
  dmg/mana), so mp5/spirit/int-pool are modestly-to-solidly positive, not ~0.

**Best-guess real-play weights (mana-managed Arcane, per rating, SP=1.0):** SP 1.00 · **Int 0.6–0.9**
(Mind Mastery SP + crit + mana pool — top-tier) · **Crit 0.7–0.85** · **Haste 0.4–0.6** · MP5 0.2–0.4 ·
Spirit 0.15–0.3 · Mana 0.1–0.2 → **SP > Int ≈ Crit > MP5 ≈ Haste > Spirit > Mana.** These are guesstimates;
the **finite-mana model** (ROADMAP / `docs/PLAN.md`) computes them. The layout EP is still correct for
what it's for — ranking *cooldown layouts* and *throughput* gear where mana isn't the swing factor; it
just isn't the gearing EP for a mana-limited spec.

## Practical notes / caveats
- **Trust-anchor the APL first** (build it, sim it, confirm the DPS matches the tool's expectation)
  before trusting weights — same discipline as any sim gating (`TOOLING`).
- **Intellect is THROUGHPUT for Arcane, not sustain — value it off SP/crit EP.** `1 int` gives, at 5/5
  Mind Mastery + 5/5 Arcane Mind (`sim/mage/talents.go`): `×1.15` int (Arcane Mind), then **+0.29 spell
  power** (Mind Mastery `0.05·rank` SP/int) **and +0.317 crit rating** (int→crit `0.0125%`/int, `mana.go`,
  ×1.15). So **`int EP ≈ 0.29·SP_EP + 0.317·crit_EP`** (+ a ~0 mana part when not mana-bound) — e.g. this
  phase (SP_EP 1.0, crit_EP 0.72) → **≈ 0.52**. (A mana-bound sim adds a big mana chunk on top: wowsims'
  default-rotation Int 1.42 = ~0.29 SP + ~0.24 crit + ~0.89 mana — the mana part vanishes for
  not-mana-bound fights.) Don't file int with the sustain stats.
- **Layout-first, mana-free (design principle, user-set).** The model optimizes the cooldown **layout**
  assuming mana isn't the binding constraint; mana management is **downstream** — you manage mana to
  realize the layout, never the reverse. So the model route weighs only the **layout / throughput** stats
  (SP, crit, haste, + the AoE Potency term). **Sustain** stats (spirit / mp5 / raw mana pool) have real
  value but *only* through mana, which the model deliberately ignores — so they read ~0 here **by
  construction**. They are **not literally zero in reality**, though: a player who never OOMs but still
  *conserves* (Frostbolt filler on non-burn stretches, rather than pure AB-spam) sits at the mana margin,
  where +1 mana buys AB-over-Frostbolt uptime worth ~**1.5 dmg/mana** (the AB-vs-Frostbolt gap). So for
  such play, guesstimate mp5 ~0.12–0.25 EP / spirit ~0.08–0.18 (throttled ~30% while casting) / raw mana
  ~0.03–0.08 — bigger on long/low-downtime fights, ~0 on ones you AB-spam start to finish. Keep them a
  separate sustain check ("enough to chain-cast the burn windows, then stop"),
  never folded into the layout weights. Justified because for realistic fights (short, or long with
  intermission downtime / conservation) mana isn't binding in the high-value windows anyway, so the
  infinite-mana layout is also the realizable one. A genuinely mana-bound fight is the exception —
  spot-check that *one* with a real-mana sim; don't re-model the tool. (Measured worst case, for scale:
  the same optimal schedule at real vs infinite mana moved haste EP 0.35 → 1.52 — mana, not cooldowns,
  is what a naïve full-mana-constrained sim like wowsims' default rotation is really pricing when it
  reports haste ≈ 0.)
- **Setup comparison** falls out of the same machinery — plan each setup, then compare on **absolute**
  at-kill damage (or each setup's optimal-APL sim DPS), **not** the effective-casts count (that's
  normalised per-setup, so it hides flat SP/crit throughput; it's the *within*-setup objective only).
