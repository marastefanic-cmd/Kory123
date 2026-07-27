# EP.md — stat weights, two ways (and why we don't need a bespoke calculator)

Goal: an **EP / stat-weight** number (how much a point of each stat is worth, normalised to spell
power) for a given setup, planned by *its own* ideal cooldown usage. We get it two independent ways that
**cross-check** each other — and neither is a heavy new subsystem.

## The model route — EP in closed form from the effective-damage integral

> ## ⚠ THE INTEGRAL BELOW IS THE **DERIVATION**, NOT THE OBJECTIVE (07-27, PHASE12 §6.10 + §9)
>
> `simulate()` no longer ranks on `∫ cast_damage/interval dt`. The objective is the **per-cast sum**
> `D = Σ_i cast_damage_i × credit_i`, with the **boundary credit**
> `credit_i = min(1, (nextCut − start_i)/duration_i)` (fight end, intermission start, or either AoE
> edge). Two consequences for this section:
>
> - **The partials below still hold as the continuum form** — each `∫ … /interval dt` is the limit of
>   the corresponding `Σ_i …` over casts, and the shapes (SP ∝ cast count, crit ∝ damage, haste ∝ the
>   *unfloored* portion) are exactly why the weights come out clean. Read them as the derivation.
> - **They now omit a boundary term.** Haste changes a cast's `duration`, which changes the *denominator*
>   of the straddling cast's credit as well as how many casts fit; SP/crit do not. That term is small
>   (one cast per cut) and is **not** in the closed forms below. It **is** in the finite-difference
>   route, which is what actually runs — `tests/ep-model.mjs` differences `simulate().total`, and
>   `total`/`totalEarly`/`robust` are all the credited sum now. ⇒ **When the two disagree on haste on a
>   short or wall-heavy fight, the finite difference is the one to trust.**
> - ⛔ The retired symmetric kill taper (`KILL_WINDOW = 0.5`) is **not** in any formula here and never
>   was; nothing in this file needs unwinding for it.

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

## The model's layout EP is an INFINITE-MANA ceiling — the real gearing weights are COMPUTED (finite-mana)

The model route (and the sim route on the AB-spam APL) assume infinite mana, so its weights are the
**layout / time-limited** EP. Real Arcane play is **mana-managed** — you **conserve** (Frostbolt filler
below a mana threshold, AB-spam in the burn windows) so you never OOM, spending the budget *to the
margin*. The mana constraint moves the weights, and we now **compute** the move instead of guessing it:
a wowsims **finite-difference on the conserve rotation** (`tools/genconserve.mjs` +
`tests/ep-finite.mjs`), at real mana, with the runner extended for `--int/--spirit/--mp5`
(`tools/wowsims-patches/runner-main.go`). **The sim models the whole real raid mana economy** on the
player's export — regen (mana-spring mp5 + Shadow-Priest/Vampiric-Touch **+250 mp5** + `spirit·√int·0.30`
while casting), **JoW** 74/hit, **Mana Tide** 6%/tick×4, **Innervate** (5× spirit + full-regen),
**Evocation** 15%×4, the **Mana-Emerald gem**, Molten Armor (not Mage Armor). The external CDs only fire
because the conserve APL includes `autocastOtherCooldowns` — without it Innervate + Mana Tide are silently
suppressed and the mage is starved (−6% DPS; see TOOLING).

### The computed finite-mana weights (SP = 1.0, 300s single-target, all var0 seed 11)

| Stat | **Finite (real mana)** | Finite — native rot. x-check | Infinite (layout ceiling) |
|---|---|---|---|
| Spell power | **1.000** | 1.000 | 1.000 |
| Intellect | **1.076** | 1.133 | 0.557 |
| Haste (per rating) | **0.962** | 1.001 | 1.439 |
| Crit (per rating) | **0.789** | 0.760 | 0.689 |
| MP5 | **0.658** | 0.890 | 0.000 |
| Spirit | **0.535** | 0.550 | 0.000 |
| Mana (pool) | **0.008** | 0.008 | 0.006 |

**Real-gearing order: SP ≈ Int > Haste > Crit > MP5 > Spirit ≫ Mana.** Both faces of the mana constraint
are now numbers, not adjectives: **MP5/Spirit go 0 → 0.66/0.54** (the layout model zeros them *exactly*;
the constraint makes them solidly positive), and **Int nearly doubles** 0.56 → 1.08 (at infinite mana it
is pure throughput — the 0.557 matches the closed form below to ~10% — and finite mana adds its mana-pool
+ `√int` spirit-regen value). **Haste deflates** 1.44 → 0.96, but only by a third — **not** to the
folklore ~0.4–0.6. Cross-checked three ways: the conserve rotation and the export's **own native wowsims
Arcane rotation agree** (haste 0.96 vs 1.00; conserve DPS 1916 vs native 1969, −2.7%), and the analytic
value-of-mana brackets MP5 (below).

### Why haste is NOT the weak stat the folklore claims (the key correction)

The "haste ≈ 0.4–0.6, mana kills it" wisdom is about the **naive AB-spam-until-OOM-then-idle** rotation —
measured on *that* rotation haste EP is **0.03** (pure-spam) to ~0.35. But a real mage **conserves with
Frostbolt**, and Frostbolt is cheap (cost 272, cast 2.5s, ≈ mana-neutral with JoW+regen) — so the mage is
**never idle**, and haste buys casts everywhere (faster filler *and* faster burn). The deflation is only
the fraction of casting that is genuinely mana-limited, ≈ ⅓ here. So haste keeps ≈ ⅔ of its ceiling.
- **Fight length** (conserve, real mana): haste EP **0.80 (145s) → 0.96 (300s) → 1.02 (420s)** — it
  *rises* with length in EP terms, because SP/unit falls faster than haste/unit as the buffed burst is
  diluted by filler. But in **absolute DPS per haste-rating** haste is highest on the shortest fight
  (0.975 @40s vs 0.774 @420s) — the classic "short = time-limited" intuition is right in raw DPS; the EP
  *ratio* inverts only because spell power out-scales haste even harder on short fights. (Even a 40s
  all-burst fight sits below the 1.44 ceiling: its opener is **GCD-floored**, where haste is wasted.)
- **Intermissions** shift it back: 60s of downtime on a 420s fight drops haste EP **1.02 → 0.92** (less
  casting time) and lifts MP5 EP **0.70 → 0.84** (bank regen in the dead zone, burn it in the next burst).

### The value of mana (analytic cross-check, `tests/mana-value.mjs` — the "option C" route)

At the conserve margin the mage trades Frostbolt for sustained 3-stack Arcane Blast:
`valueOfMana = (DPS_AB − DPS_FB)/(drain_AB − drain_FB) = (2242 − 1404)/(458 − 79) ≈ **2.2 dmg/mana**`
(JoW-adjusted; DPS/drains sim-measured). Then `MP5 EP = 0.2 mana/s · 2.2 / SP_weight ≈ 0.49–0.55`,
bracketing the sim's 0.66 — an independent, closed-form confirmation that the finite weights are
physically grounded, not a harness artifact. (Spirit/Int mana value flows through the same `valueOfMana`
but via regen-conversion + Innervate's amplification — too coupled for the closed form, so the sim is
authoritative there.) Locked numbers: `tests/finite-weights.json`.

**The layout (infinite) EP is still correct for what it's for** — ranking *cooldown layouts* and pure
*throughput* gear where mana isn't the swing factor; it just isn't the gearing EP for a mana-limited spec.
**Never let mana feed back into the infinite-mana layout model** — the two engines stay separate (the
layout-first principle below); the finite weights are a *reading* off the sim, not a change to the planner.

## Practical notes / caveats
- **Trust-anchor the APL first** (build it, sim it, confirm the DPS matches the tool's expectation)
  before trusting weights — same discipline as any sim gating (`TOOLING`).
- **Intellect is THROUGHPUT for Arcane — plus a big mana part when mana-bound (both now VALIDATED).**
  `1 int` gives, at 5/5 Mind Mastery + 5/5 Arcane Mind (`sim/mage/talents.go`): `×1.15` int (Arcane Mind),
  then **+0.29 spell power** (Mind Mastery `0.05·rank` SP/int) **and +0.317 crit rating** (int→crit
  `0.0125%`/int, `mana.go`, ×1.15). So **`int EP ≈ 0.29·SP_EP + 0.317·crit_EP`** for the throughput part.
  **Confirmed:** at *infinite* mana the sim measures Int **0.557** vs the closed form 0.29·1.0 + 0.317·0.69
  = **0.51** (~10%). At *real* mana Int rises to **1.076** — the extra ≈ 0.52 is int's mana value (int→mana
  pool `×15`, and int→spirit-regen via the `√int` term). So finite Int ≈ **co-#1 with SP**, not the
  ~0.5–0.9 once guessed. Don't file int with the sustain stats.
- **Layout-first, mana-free (design principle, user-set) — and the sustain stats are now COMPUTED, not ~0.**
  The *model route* optimizes the cooldown **layout** assuming mana isn't binding — mana management is
  **downstream** (you manage mana to realize the layout, never the reverse), so the model route weighs only
  the **layout / throughput** stats (SP, crit, haste, + AoE Potency) and reads spirit/mp5/mana **exactly 0
  by construction**. That is *correct for the model*, and the finite-mana engine stays **separate** (a sim
  *reading*, never fed back into the layout optimizer). But for **gearing** the sustain stats are real and
  now measured on the conserve rotation (table above): **MP5 0.66, Spirit 0.54, Mana-pool ~0.008** at 300s
  — the regen stats are solidly positive (MP5/Spirit ≈ Crit-tier), the raw pool ~0 (the reservoir cycles;
  it only scales Mana-Tide 6% / Evocation 15%). Spirit is lifted by **Innervate** (5× spirit + full-regen
  for 20s), which is why it out-punches its `√int·0.30`-while-casting base. These are the **gearing** EP;
  the layout EP is for **cooldown-layout / throughput** decisions. (The old "worst case haste 0.35 → 1.52"
  scale note was the naive OOM rotation vs infinite; the conserve rotation's real-vs-infinite haste is a
  much milder 0.96 → 1.44 — see the haste correction above.)
- **Setup comparison** falls out of the same machinery — plan each setup, then compare on **absolute**
  at-kill damage (or each setup's optimal-APL sim DPS), **not** the effective-casts count (that's
  normalised per-setup, so it hides flat SP/crit throughput; it's the *within*-setup objective only).
