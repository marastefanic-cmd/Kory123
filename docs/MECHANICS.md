# MECHANICS.md — the verified game formulas

The physics layer. These are the TBC 2.4.3 formulas the model computes with — cross-checked against
the wowsims source and the references in `docs/SOURCES.md`, and corroborated by our own wowsims runs.
**`docs/RULES.md` (the strategy) is *derived* from what's here — read this first.** Constants live in
`index.html` `GAME`/`BUFFS`; their sources are in the `SOURCES.md` ledger.

Notation: `m` = total haste multiplier; `SP` = spell power; a "cast" below means one Arcane Blast.

---

## 0. ★★★★★★ WHAT THE SCORER **IS** — the canonical statement. Read this before changing anything.

**User, 07-31, verbatim — this is the definition of record and it supersedes any looser paraphrase
elsewhere in the docs:**

> *The scorer is an integral of a function of "momentary dps", not the overall dps throughout the fight
> at a given moment, but a theoretical momentary dps — "if I started casting the spell right now, how
> much damage would that spell deal divided by how many seconds it would take to cast" — that is graphed
> out and the area under that graph is summed. That graph changes based on arcane blast stacks and
> cooldown usage. The model then finds the cooldown layout that maximizes this function's integral's
> value.*

⚠ **The word "momentary" is the load-bearing one, and the negation in it is the part that gets lost.**
It is **not** "the DPS you are doing at time `t`". It is a **counterfactual about a spell you have not
cast**: *if I began a cast at this instant, what would it be worth per second?* Nothing about the past,
nothing about what is in flight. That is why the objective needs no cast lattice — the function is
defined pointwise at every real `t`, and the score is `∫₀ᵀ rate(t) dt`. Three separate versions of
`scoreStart` smuggled a lattice into it and each cost a measured defect (MODEL-DEFECTS §8l).

**What the graph is a function of** — and it is a short list, which is the point:
* **Arcane Blast stacks**, because they set the cast time (and only the cast time — AB damage is
  stack-independent in 2.4.3, SOURCES). This is the only thing modelled *dynamically*.
* **Cooldown usage** — every buff is a value overlaid on that curve over a known interval.

> ### ⛔⛔⛔ THIS IS HOW THE **SCORER** WORKS — IT IS NOT A CLAIM ABOUT HOW THE GAME WORKS
> **User, 07-31:** *"Note that this is how the scorer works, not how it works ingame. Ingame the casting
> time and activating cooldown inbetween casts is a real thing, but it's unrealistic to follow to the
> millisecond throughout real gameplay and finnicky stuff comes out. This integral path of calculating is
> the clean followable pattern recognition that the scorer then can actually work with."*
>
> The discrete layer is **real in the game**: casts have durations, cooldowns are pressed between them,
> boundaries exist. The integral does not deny any of that. What it denies is that **chasing it to the
> millisecond is useful**, and there are two separate reasons, both earned:
> 1. **It is not executable.** Nobody plays to the millisecond. A plan whose value depends on which
>    sub-cast instant you pressed at is advice that cannot be followed, so its extra "precision" is not
>    precision at all.
> 2. **It is not even stable.** Resolving that layer makes the objective *finnicky* — knife-edge cliffs
>    at cast boundaries, flat plateaus resolved by float noise, a score that moves when the lattice
>    re-phases rather than when the plan gets better. Every one of those pathologies has been measured
>    here, not theorised: §8i, §8k, §8l, §8q and §8s are all one lattice leaking into a ranking.
>
> ⇒ **the integral is chosen for TRACTABILITY AND FOLLOWABILITY, and that is a sufficient justification.**
> It yields a clean differentiable surface, which is what makes alignment a continuous cost/benefit
> (RULES §10), the composition laws closed forms (§7a), and *"A beats B"* arithmetic.
> ⛔ **Two corollaries, and both have been violated before:**
> * **Do not "improve" the model by making it more literally discrete.** That direction is retired and
>   was measured: discretizing the scorer is falsified (ROADMAP / PHASE10 §8.23), and it is what the
>   deleted `exact-match` goldens quietly rewarded.
> * **Do not justify the model's choices by appeal to in-game execution either.** The integral does not
>   need the game to cooperate with it; it needs to be tractable, honest about what it averages, and
>   gated. Reaching for *"but a player could do X in game"* to defend a modelling choice is the same
>   category error in the opposite direction, and it was made in this repo on 07-31 (RULES §10's first
>   draft) before being corrected.
>
> ⚠ **The honest cost, stated plainly:** the model reports a **MEAN** and says nothing about variance,
> and it is **infinite-mana**. Those are the prices of this abstraction. They are accepted, standing
> decisions — not oversights, and not things to fix by adding the discrete layer back.

> ### ★ THE SCORING PART HAS TO BE PERFECTIBLE. THE SEARCH PART DOES NOT.
> *"This is pretty straight forward by itself and has to be easily perfected, the math scoring part not
> the search part, that one can be hard."*
> Keep the two apart when something looks wrong. A plan that looks wrong is a **search** defect, a
> **tie-break** defect, or a **scoring** defect, and CLAUDE.md's table tells you which by enumerating the
> neighbourhood. ⛔ Reaching for a scoring change first is how §8j, §8m and §8s would each have become
> permanent damage — all three were the search.

**The only genuinely tricky parts, named by the user and no others:**
1. **Arcane Blast stacks.** *"The only thing you have to calculate [is] WHEN the first possible spell at
   a given arcane blast stacks amount would finish casting, and then shorten the cast time for the next
   AB accordingly — and that activating haste can make that happen sooner."* That is the whole ramp
   problem, stated exactly. §1 below is its arithmetic; §1.2 of ESTABLISHED-FACTS is its closed form.
2. **AoE phases.** RULES §9. Still doable math — and there are tests to gate theories.

> ### ⛔⛔ AND THE STANDING RESULT THE MATH MUST KEEP REPRODUCING
> *"By itself, there's no innate value in hasting on the ramp. It only comes into play because of other
> factors, and the math should guide you to that realisation again should you need it."*
>
> It does, and here is the derivation so nobody has to rediscover it under pressure. The ramp's cost is
> `toll(m) = [Σₖ max(C_k/m, i(m)) − 3·i(m)] / i(m)` with `i(m) = max(FLOOR, G/m)`. **Below the GCD floor**
> `max(C_k/m, i) = C_k/m` and `i = G/m`, so the `1/m` cancels top and bottom and the toll is
> **exactly 1.332 at every `m`** — haste cannot compress the ramp, because it shortens the ramp casts and
> the yardstick they are measured against by the identical factor. **No innate value. The algebra says so
> without being told.**
>
> ⚠ **The GCD cap is not an exception to this rule — it is a first-class feature of the model, and of
> course it applies here too** (user, 07-31). It is not a caveat bolted onto the rule afterwards; it is
> in the **master law itself** — `rate(m) = min(1/F, m/G)`, where the `min` *is* the cap. Everything this
> project knows about haste is downstream of that one `min`: the 788.5 rating cap, the **zero** (not
> "diminishing") value of a point above it, the five onset thresholds, the tent, the packing law.
> ⇒ so read the rule as scoped rather than qualified: **haste has no innate value on the ramp throughout
> the regime where the cap is not binding**, which is `m ≤ 1.5` and is where essentially all planning
> happens. What follows is the same law evaluated on the other side of its own `min`. Above the floor
> (`m > 1.5`, reachable at zero gear haste via `Bloodlust ×1.30 × Icy Veins ×1.20 = 1.56`) the yardstick
> `i` pins at 1.0 s while the ramp casts keep shortening, so the toll collapses: `1.165 / 0.787 / 0.333`
> at `m = 1.56 / 1.716 / 2.0`. That is **not** haste acquiring innate ramp value. It is haste having run
> out of anywhere else to go — the steady rate is pinned by the cap, so the ramp is the only place left
> where a second of haste can still do anything. Same law, same `min`, other branch. ESTABLISHED-FACTS §1.2b states the same thing as a threshold:
> ramp-neutrality holds **exactly while `m·v ≤ 1.5`**, the buff's own onset threshold, and inverts above.
> ⇒ **the rule is safe to state in the strong form the user does**, provided you remember that "other
> factors" includes the GCD cap. Gated both ways: `law-check`'s `§8r` pair asserts neutrality below the
> threshold and the inversion above it; `tools/toll-audit.mjs` asserts the closed form at eight haste
> levels. History: MODEL-DEFECTS §8q (the ramp was the last lattice leak) and §9a F1 (the toll was flat
> above the floor, which under-credited nothing and over-charged the ramp by up to 1.33 casts).

> ### ★★ THE RAMP, RESTATED BY THE USER (08-04) — and why the "toll" IS that restatement, rearranged
> User, reviewing the Ashtongue rebuild: *"we just have a different variable for the damage divided by
> casting time, then the number that's the divider, the casting time, just changes after the first cast
> finished … you know what haste is there at t=0, so you know how long the first cast will take, so for
> the duration of the first cast you just divide damage … by the casting time at 0 AB stacks given
> current haste, after that time subsides, you repeat."* — i.e. the momentary-rate graph of §0 with the
> divisor stepping at each ramp cast's (haste-dependent) completion.
> **The engine agrees with this in BOTH accounts, and the totals are one identity apart:**
> · the BOARD WALK implements the description literally — cast by cast, each ramp cast at its own
>   `C_k/m` with the local `m` (cooldowns, procs) read at that cast's start;
> · the INTEGRAL books the identical total, because the user's form and the toll form are the same
>   expression rearranged: `3 + (T − ΣC_k/m)·rate(m)` `=` `T·rate(m) − Σ(C_k − G)/G` (expand ΣC_k/m·m/G
>   = ΣC_k/G and collect). ⇒ **the subtracted "toll" is not an estimated cast count — it is the user's
>   own equation solved for the empty fight**, and CI asserts exactly that number at h = 0…1600
>   (law-check's empty-fight lines, toll-audit).
> ⚠ **The one thing the totals leave open is WHERE in time the slowness is booked**, which matters only
> when a VALUE window partially overlaps the opener. Booking it inside each cast's own hasted span —
> the literal reading of the description — was measured on the T3 Icy-Veins ladder and moves IV#1 to
> 0:00 against the user's own declared 0:07 (the compression leak: the span shrinks with haste, so
> covering the ramp becomes a bonus, violating the ramp-neutrality ruling quoted above). Booked over
> the unhasted `ΣC_k` window, both ladders peak where declared. Same totals, different overlap pricing;
> the declared tests chose. Reversible only as a user call, knowing T3's Icy Veins moves with it.

---

## 1. Cast time, Arcane Blast stacks, and the GCD

- **Arcane Blast** base cast = **2.5 s**, reduced by **334 ms per AB debuff stack** (max 3 stacks):
  `cast_base(stacks) = 2.5 − 0.334·stacks`. At 3 stacks = **1.498 s**. Each stack also costs +75% mana;
  the debuff lasts 8 s. We model steady-state **3 stacks** (the opener ramp is over in ~3 casts).
  ⚠ **0.334, NOT 1/3** — this line said "1/3 s … at 3 stacks = 1.5 s" until 07-27, which is the
  tooltip's phrasing and not the game's number. wowsims encodes `time.Millisecond * -334`
  (`sim/mage/arcane_charge.go:17`), the 0.667 ms per stack COMPOUNDS one-signed, and the two cast
  lattices drifted ~0.35 s apart by t=200 on a buffed plan — costing 26 of 196 presses the cast the
  model scored them on. §1.1 carries the measurement and the history.
- **GCD** = 1.5 s base, reduced by haste, **floored at 1.0 s**.
- Haste divides both: `hasted_cast = cast_base / m`, `hasted_gcd = max(1.0, 1.5 / m)`. You can't start
  the next cast until both finish, so the **interval between cast starts** is:

  **`interval(m) = max(cast_base/m, max(1.0, 1.5/m))`.**  At 3 stacks (`cast_base = 1.5`) this is
  **`interval = max(1.5/m, 1.0)`.**

*Verified:* wowsims mage/cast code.

### ✅ 1.1 The model and wowsims agree on the cast lattice — CLOSED 2026-07-27

*"Matches our sims exactly" was measured at 60 s and is false as a general statement.* Found 2026-07-27
(PHASE12 §6.9a) while diagnosing the press-fire offset:

```
  wowsims  sim/mage/arcane_charge.go:17   castTimeReduction := time.Millisecond * -334
  model    index.html GAME.AB             STACK_CAST_REDUCTION: 1/3        (333.333… ms)
```

wowsims also rounds every cast to the millisecond (`sim/core/cast.go:137-138`), so its ramp is
`2.500 / 2.166 / 1.832 / 1.498` — read straight off a combat log's `Cast Time =` field, never
`2.167 / 1.833 / 1.5`. The ramp therefore ends **2 ms** behind the model, and:

- **at h=0 the offset freezes there**, because both then run GCD-capped at exactly 1.5 s. This is why a
  60 s bare-stream check reported "exact" — and why the combat log, which prints 2 decimals, shows the
  boundary as `11.00` when `sim.CurrentTime` is `10.998`.
- **off the GCD cap it accumulates**, once per cast, one-signed, sign varying with haste:
  **0.080 s over 300 s bare** (`tools/lattice-drift.mjs`), and **~0.35 s by t=200 on a plan with haste
  buffs in it**, because every buff re-quantizes the interval.

**✅ Both were corrected on 2026-07-27** — the model now takes 334 ms per stack and rounds every cast
and GCD to the millisecond, exactly as `sim/core/cast.go:137-138` does. The bare-stream drift went from
**0.080 s to 0.005 s over 300 s**, which is the combat log's own 2-decimal printing floor: the grids
coincide. ⚠ Its gate (`tools/lattice-drift.mjs`) probed wowsims and is **deleted with the sim
(07-30)**; the rule stands on what that gate measured, and nothing re-checks it now — same status as
the snapshot-rule and window-span gates (CLAUDE.md's retired-approaches list).

⚠ **The millisecond rounding is the part that mattered; the 334 ms constant alone moved the bare
lattice by exactly nothing** — measured twice before the cause was understood. In steady state Arcane
Blast is **GCD-bound**: the 3-stack cast is 1.498 s, under the 1.5 s GCD at every haste, so the interval
comes from `max(1.0, 1.5/m)` and the stack constant never enters it. The constant still matters for the
**ramp** and for **cast completion times**, which is where the value-snapshot rule (§4) reads.

Consequence that made it worth chasing: this was the entire mechanism behind "a scheduled press fires a
full cast late" (`10.998 >= 11.000` is false).

## 2. Haste

Haste **rating** converts to a percentage, then percentage buffs stack **multiplicatively** on top:

- **Rating → %:** `15.77 rating = 1%` at level 70 ⇒ rating contributes a factor `(1 + rating/1577)`.
- **Total multiplier:** `m = (1 + rating/1577) · (1+h₁) · (1+h₂) · …` over each %-haste buff
  (Bloodlust +30% → ×1.30, Icy Veins +20% → ×1.20, Berserking +10% → ×1.10). They **multiply**, they
  do not add.
- **The GCD floor is the load-bearing consequence.** `interval = max(1.5/m, 1.0)` hits **1.0 s at
  m = 1.5 (+50% total haste)**. Past +50%, the interval stays 1.0 — **any further haste is wasted.**

*Worked example (0 gear haste, the reference character):*
| state | m | 1.5/m | interval | wasted? |
|---|---|---|---|---|
| none | 1.00 | 1.500 | 1.500 | — |
| Lust | 1.30 | 1.154 | 1.154 | no |
| Lust+Berserking | 1.43 | 1.049 | 1.049 | no (under floor) |
| **Lust+IcyVeins** | **1.56** | 0.962 | **1.000** | **yes — floored, ~3.8% lost** |
| Lust+IV+Berserking | 1.716 | 0.874 | 1.000 | yes (Berserking on top adds nothing) |

*Verified:* multiplicative stacking and the 1.0 s floor reproduce wowsims to <0.1%.

## 3. Damage per cast

`cast_damage = (base + SP · coef) · crit_factor · damage_mult`

- **Base** ≈ 720 (average of Arcane Blast's damage range at the modeled rank).
- **Spell-power coefficient** `coef = base_cast_time / 3.5` — the TBC direct-damage rule — using AB's
  **2.5 s base** cast (not the stack-reduced time): `coef = 2.5/3.5 ≈ 0.714`.
- **Arcane Blast damage is STACK-INDEPENDENT.** Stacks change only cast *time* and mana; `base` and
  `coef` do not change with stacks. So a cast is worth the same at 1 stack or 3 — only how *fast* you
  cast changes. *(Verified in-sim and on the AB tooltip — this is why the model can treat damage as
  stack-independent and put all the stack effect into `interval`.)*
- **`damage_mult`** = product of damage-multiplier buffs: Arcane Power ×1.30. (Spell-power actives —
  Icon +155, Serpent-Coil gem +225 — enter through `SP`, not `damage_mult`.)
- **`crit_factor` = `1 + crit · (CRIT_MULT − 1)`.** `CRIT_MULT ≈ 1.8175` (a crit's damage vs a normal
  hit, incl. base 1.5× + Arcane talents + meta gem — exact composition flagged `verify` in SOURCES).
  Crit is the **same for every cast**, so it **cancels** in any overlay comparison — it changes total
  DPS but never *which* schedule wins. **One exception, in AoE only:** Clearcasting → Arcane Potency
  raises effective crit on a *target-scaled* fraction of casts (Arcane Concentration procs per hit, so
  more targets ⇒ more Clearcasting ⇒ Potency's +30% crit on more casts). That makes an AoE cast worth
  more per target as the target count grows — a real, sim-verified super-linearity the planner credits
  via `aoeCritAmp(N, crit)` (§4, `RULES §9`). It's derivable from crit × N × fixed talent ranks, so crit
  still "cancels" for single-target; it just doesn't fully cancel *across* an AoE-vs-single-target choice.

### On-use buffs are off-GCD and fire BETWEEN casts — so score them by cast-counting, never by "GCD cost"

Every on-use cooldown (Icy Veins, Icon, gem, Arcane Power, Berserking, trinkets) is **off the global
cooldown** and is macro'd into the cast spam — `/cast Icy Veins /use 13 /cast Arcane Blast`, pressed
repeatedly as the *previous* cast finishes, so the buffs pop **between casts** and the next Arcane Blast
begins already-buffed. Consequences the model must respect:
- **A buff press never clips or delays a cast and costs no GCD.** It is *free* to press. So its value is
  purely the **effective ABs it buys**: `(added SP · coef, or the damage_mult) × (# casts inside its
  window) × (overlapping AP/haste multipliers)`. Count casts, not clocks. A window with AP + haste holds
  **more, ×1.3-richer** casts, so one buff there can beat two on bare windows — compare
  `casts_X · mult_X` against `casts_Y + casts_Z`, ceteris paribus. (This is the whole objective, §4: the
  planner aligns every cooldown across all permutations to maximize the ABs effectively cast.)
- **A free press can still be net-NEGATIVE — but only through ALIGNMENT or COOLDOWN COUPLING, never a
  cast cost.** Pressing a buff here can forgo pressing it on a better-buffed window (alignment), or a use
  now can push its next use past a window where it mattered more, or off the fight entirely (coupling,
  the align-vs-twice rule, RULES §4). "It's off-GCD, so more uses can't hurt" is the **wrong** inference:
  more uses never cost casts, but mis-*aligned* uses cost effective ABs. Evaluate by cast-counting.
- **Corollary — a "negative free buff" is a flag to INVESTIGATE with the combat log, never to trust
  raw.** If the sim shows a *free, off-GCD* buff as net-negative, open the `SIMLOG=1` combat log before
  believing it. The usual cause is a **cooldown coupling the simple analysis missed**: the press
  quantizes to the next cast boundary, its cooldown runs from that *late* fire-time, and a *later*
  same-track use gets pushed off its window — or, per the **known harness bug** (`docs/archive/16-sim-tooling.md`),
  **DROPPED entirely** (`APLActionSchedule` consumes the timing while the queued off-GCD cast is lost).
  Either way the buff's *own* value is fine; a *later* use is what suffered. Confirm by finding where
  each use actually fires in the log — e.g. the Vashj icon@4:00's "−4.2" was its *terminal* icon@6:00
  being dropped, not the exit icon being worthless. Don't conclude "more uses can't help" from a raw
  drop-a-press number on the (currently drop-buggy) schedule harness; prefer **count-preserving**
  comparisons until the harness fix lands.

## 4. The driving equation: effective ABs cast

> ## ★★★★★ THE OBJECTIVE IS AN INTEGRAL, AND IT RANKS — ⚠ CORRECTED 2026-07-30 (MODEL-DEFECTS §8h)
>
> ⛔⛔ **THIS BANNER SAID THE OPPOSITE FOR THREE DAYS AND THE REVERSAL IS THE POINT.** Phase 12 (07-27)
> made the per-cast SUM the ranking quantity and retired the rate integral. On 07-30 that was measured
> against `docs/ESTABLISHED-FACTS.md`'s closed forms and **the sum is the one that is wrong** — it
> ranked *Berserking with nothing up* (0.7250) ABOVE *Berserking inside Bloodlust* (0.7203) against
> laws of 0.667 and 0.867, a ~0.15-cast inversion, because moving a haste window shifts the whole
> downstream lattice and re-prices the terminal cast. The integral hits all three law values to four
> decimals. ⇒ **the rate integral RANKS; the per-cast sum is REPORTED only.** `simulate()` returns
> both: `integral` (ranks) and `robust` (reported). If you find a doc claiming otherwise, it predates
> 07-30.
>
> ★ **The user's framing, which is what the engine implements:** the integral of *"the damage a spell
> would deal right now, divided by the time it would take to cast right now"*. The only thing that has
> to be modelled dynamically is the **Arcane Blast stack count**, because that is what moves the
> denominator; every buff is a value overlaid on that curve at a known time.
>
> ★ **THE OBJECTIVE IS A PAIR, not a number.** Integral first; inside `TIE_CASTS = 0.002` casts the
> score is tied and the SHAPE decides — fewest distinct press moments → earliest → the flattened press
> vector (`rankPair`/`planBetter`). Without the tie-break a search wanders inside a plateau, which is
> what the 07-28 revert punished.
>
> **What is still true from the old banner:** the per-cast sum is EXACT and needs no approximation —
> for each Arcane Blast the model knows the haste, the stack count (hence the cast time), whether
> Arcane Power is up (×1.30), which spell power buffs apply, and crit as a constant that cancels. It is
> simply the wrong thing to rank on, because a plan's value is the area under the rate curve rather
> than the realized lattice's tally. `simulate()` accumulates it and returns it as `total`/`robust`.
> Gate:
> `tools/self-consistency.mjs` reads `0.00e+0` over 3000 generated plan-scorings (460 699 casts) with
> 0 structural violations, no sim, no cache. ⚠ The `0.00e+0` alone is NOT sufficient — it compares two
> accounts that both read the same `casts` board, so it passed straight through the PHASE13 §2.5
> epsilon defects. The **structural** line is the one that leaves the model.
>
> ★ **Each term carries a BOUNDARY CREDIT (PHASE12 §9, user ruling 07-27):**
> ```
> credit = min(1, (nextCut − castStart) / castDuration)
> ```
> where a **cut** is a boundary you would not carry a cast across: the fight end `T`, an **intermission
> start**, and an **AoE phase start** — and nothing else.
>
> ★★ **THREE kinds of boundary, TWO of them cuts, for TWO DIFFERENT REASONS.** The asymmetry is the
> whole rule:
>
> | boundary | does the cast land? | would you cancel it? | cut? | why |
> |---|---|---|---|---|
> | **intermission start** | **no** — boss untargetable | n/a | ✅ **cut** | **physics** |
> | **AoE phase start** | **yes**, for full AB damage | **yes** — AE is worth several ABs | ✅ **cut** | **policy** |
> | **burn edge** | yes | **no** — you keep casting AB | ⛔ **not a cut** | a *value* boundary, snapshot rule |
>
> At an AoE start the phase does not arrive on the same second every pull, so with the wall `~ U[W, W+d]`
> the credit is exactly `P(the wall has not arrived by completion)`: the other branch is a **cancelled**
> cast worth zero, and the expectation is `frac × dmg` — the same one-sided window as the kill.
> ⇒ **Because the cast is CANCELLED rather than merely re-priced, the Arcane Explosion lattice starts AT
> THE WALL**, not at the Blast's natural end. Verified: a Blast starting **58.998** against a wall at
> **60.000** is credited **66.9 %** = `(60 − 58.998)/1.498`, and the first AE fires at exactly **60.000**.
> Crediting partially without truncating would be the worst of both — paying less and gaining nothing.
>
> ⚠ **This has flipped TWICE in one day; keep the reasoning, it is the valuable part.** It shipped **as**
> a cut (07-27, on "the spell changes there"), was **removed on physics** hours later — the sim measured
> an AB started at 59.000 with an AoE phase opening at 60.000 completing at 60.498 and **landing for full
> AB damage** (1886.4, a 25 %-resist roll off a ~2577 typical hit) — and was then **restored on policy**
> by user ruling the same day. ★ **The measurement is still true and it is not what decides the
> question**: the question was never *"does the cast land"* but *"what would the player do"*, and no sim
> can answer that.
> ⚠⚠ **A deliberate, PRICED divergence from the sim:** wowsims' APL cannot cancel a cast, so it finishes
> the Blast and lands it. Any sim comparison would show a gap at an AoE wall and that gap is **not a
> bug** — and with `model-audit` deleted alongside the sim, nothing measures it any more (accepted).
> ⚠⚠ An **instant** cast (Arcane Explosion, `cast = 0`) takes credit **1**, not 0 — `min(1, (cut−t)/dur)
> → 1` as `dur → 0`; the first divide-by-zero guard returned 0 and credited every AE at nothing (42 %
> error on Kael'thas). A cast completing exactly at `T` earns a **FULL**
> cast; one that straddles a cut earns the fraction that fits. Algebraically this is a **one-sided**
> window whose width is the cast's own duration: for a cut `~ U[C, C+W]`, credit `= (C+W−completion)/W`,
> and `W = duration` gives exactly `(C − start)/duration` — i.e. *"the fight lasts at least T, and at
> most one more cast."*
>
> ⛔ **THREE APPROACHES ARE RETIRED. Do not let any of them back in.**
> 0. **The symmetric kill taper.** `KILL_WINDOW = 0.5` weighted every cast by
>    `clamp((T + KW − completion)/2KW, 0, 1)`, which paid a cast completing **exactly at T** only
>    **0.5** — a symmetric window asserts the boss is already dead half the time. It was also
>    *kill-only*, so a cast completing inside an **intermission** was paid in full (measured: starts
>    89.616, wall 90, completes 91.114 — credited 2242.1, now `frac 0.2563` / `credited 574.8`). A
>    local `KW = 0.5` survives in `index.html` feeding **only** the `integral` diagnostic.
> 1. **Ranking on the rate integral.** It is the continuum limit — the expectation over a uniformly
>    random cast phase — and a given plan's phase is *determined*, so it is the wrong evaluation for
>    ranking two concrete plans. Measured gap: **median 0.2114 % of score, max 1.4263 %**, against
>    ranking margins of ~0.005–0.07 %. It survives only as the `integral` diagnostic.
> 2. **One snapshot rule for both kinds of buff.** ★ **Haste is fixed at the cast's START** (an
>    in-flight cast keeps its speed) **and value — +SP, damage multipliers — is read at the cast's
>    COMPLETION**, over `(start, end]`. Both edges measured: a cast completing exactly on the gain is
>    not paid, one completing exactly on the fade is. Deciding both at the cast's start over-paid one
>    cast per window (measured by `tools/snapshot-rule.mjs` / `tools/credit-check.mjs` — both deleted
>    with the sim; the rule stands on what they measured).
> 3. **Expiring a buff window at `press + duration`.** A self-press cannot fire while a cast is in
>    flight, so the window must run its full duration from when the ability actually FIRES. Expiring
>    from the press made every mid-cast window short by the slip — a whole cast in the measured case
>    (`tools/window-span.mjs`: Icy Veins at 9.6 covered 15 casts, wowsims 16). **Raid externals are the
>    exception**: Lust/PI/Drums are pressed by someone else and start when CALLED.
>
> **Consequence for this document:** the integral form below is kept because it is how the quantity is
> DERIVED. It is not how it is EVALUATED.


Put §1–§3 together. Instantaneous DPS at time `t` is one cast's damage divided by how long that cast
takes:

**`DPS(t) = cast_damage(t) / interval(t)`** and **`total = ∫ DPS(t) dt`** over the fight (intermissions
contribute 0 — no casting).

**The dimensionless form is the quantity that actually matters: "effective ABs cast."** Divide the
integrand by a *plain* AB's damage (`base·crit`, no buffs). Crit cancels; what's left is each cast's
**multiplier relative to a plain AB** — a cast under Arcane Power ≈ ×1.30, spell power adds
`(SP·coef)/base`, an AoE cast is `targets ×` an AE cast, etc. — integrated over the cast rate:

**`effectiveABs = ∫ [cast_damage(t)/plainAB] / interval(t) dt`.**

This is the **single number the planner maximizes**, and the only one it needs (raw damage is just this
× a constant). ★ **The integral form is the one that RANKS, and that is not a derivation convenience —
it is the correction of 07-30 (§8h).** The two forms differ by a median 0.21 % of score, and the earlier
reading of that gap was backwards: it concluded that because a given plan's cast phase is *determined*,
the realized per-cast sum must be the right evaluation. But a plan's cast phase is determined only
relative to a lattice the plan itself moves — shift one haste window and every downstream cast
re-prices, which contaminates the marginal attribution the ranking depends on. Measured against the
closed forms, the sum misses by up to 0.24 casts where the integral misses by 0.0000.
A haste buff raises how *many* casts fit; a damage/SP buff raises what each is *worth*.
The evaluated form is therefore
**`effectiveABs = Σ_i [cast_damage_i/plainAB] × min(1, (nextCut − start_i)/duration_i)`** — the
boundary credit of the banner above, which is also the *only* place a fight boundary enters the number.
`total`/`robust` (`simulate` in `index.html`) is this SUM up to the constant, and it is the **REPORTED**
number. ⛔ The roles swapped twice: `rateAt`'s integral ranked until 07-27, the sum ranked 07-27→07-30,
and the **integral ranks again since 07-30** (§8h). `simulate()` returns both on purpose. **Everything the
planner decides is a *consequence* of maximizing this one quantity — Lust alignment, haste sequencing,
SP-on-fast-casts are *methods* that usually maximize it, never rules in their own right.** When a
heuristic and the effective-AB count (or the sim, its ground truth) disagree, the count wins.

⛔ **BUT IT IS NOT THE CURRENCY TO COMPARE *SETUPS* ON — this paragraph used to say it was, and that
was wrong.** The user-directed ruling (ROADMAP payoff 2, `docs/EP.md`, CLAUDE.md) is: plan each setup
with its **own** ideal cooldown usage, then compare them on **absolute at-kill damage** — or on each
setup's optimal-APL sim DPS — **never** on the effective-AB count. The reason is the definition three
paragraphs up: effective ABs is normalized to **each setup's own plain AB**, so it divides out flat
spell power and crit *by construction*. That is exactly what makes it the right objective **within** a
setup (it isolates scheduling) and a blind one **across** setups, where raw SP/crit throughput is most
of what you are trying to measure. A setup with +200 SP and no scheduling change scores an identical
effective-AB total and hits far harder. **Do not collapse the two currencies.**

## 5. What the formulas force (the decisions they drive)

Directly from §4, each **sim-corroborated**:

1. **Haste value = extra casts, and haste past the floor is worth 0.** A haste buff lowers
   `interval` → more casts; but once `interval = 1.0` (m ≥ 1.5), lowering it further does nothing.
   ⇒ *only the haste below the +50% floor counts; a 2nd haste buff stacked onto an already-floored
   window is worth exactly nothing.* (Drives: sequential — not overlapping — haste packing; "IV
   slides out of Lust once gear pushes Lust alone toward the floor.")
2. **A spellpower/damage buff's value scales with the FLUX `cast_damage/interval` in its window.** The
   flux is larger where casts are faster. ⇒ *put spellpower and Arcane Power on the fastest
   (haste-buffed) casts.* And because `cast_damage = (base + SP·coef)·damage_mult`, a spellpower buff
   overlapping Arcane Power is worth `damage_mult` (×1.30) more — **SP × AP is multiplicative.**
3. **Two pure-haste buffs — overlap vs sequence** (0 gear haste). Below the floor, a pure-haste buff is
   **position-independent**: over a fixed fight it banks the same fractional extra casts wherever it
   lands, so overlapping two of them yields **no extra effective ABs from the haste product — a wash,
   not a synergy.** *Sim-confirmed:* Berserking **inside** Lust vs **after** it (both unfloored, no
   damage buffs) score an identical **2367.4 DPS** at 0 gear (var 0, 300k, mana-independent). The
   multiplicative arithmetic (`1.30 · 1.10 = 1.43`) is real, but the *product itself* buys nothing.
   - What overlap *can* cost is the **GCD floor.** Two haste buffs whose combined multiplier passes
     `m = 1.5` spill the excess into the pinned 1.0s interval, where it's wasted: Lust+IV = `1.56`
     wastes ~4% (an exact wash), Lust+IV+Berserking wastes *all* of Berserking. Overlap cost
     `∝ max(0, (h_a + h_b) − headroom)`, where **headroom `= 1.5/g − 1`** (0.5 at 0 gear; it shrinks as
     gear haste `g` rises — which is why "IV slides out of Lust", §5 pt 5 / RULES §5).

   ⇒ *the reason to* **sequence** *haste buffs (IV in Lust, Berserking on the unfloored tail) is to keep
   each under the floor; the reason to put haste on Lust at all is* **flux** *(speeding the damage/SP
   casts, pt 2) or banking before an early kill — never the haste product.* "Synergy" is the wrong lens:
   score haste by the effective ABs it adds (§4), and the placement follows.
4. **Damage per cast is stack-independent** ⇒ ramp position doesn't change a haste buff's banked value
   (haste is ~position-independent among max-stack windows), but a **damage/SP** buff still wants the
   post-ramp fast casts (fewer, slower casts during the ramp = less flux).
5. **Joint value depends on the window INTERSECTION, not the start-seconds.** Since the integrand is a
   product of the buff multipliers active at `t`, two buffs contribute their combined value only over
   the seconds they actually **overlap** — and a shorter buff `d` fully overlaps a longer buff `D`
   whenever it's *contained* in it, which holds for a **range** of starts (`[Dstart, Dend−d]`), not one
   second. ⇒ *many placements are exactly DPS-equivalent (a containment equivalence class), so the
   planner must pick the consistent member — "aligned" means contained, not "same start-second."* And a
   **lone** buff (intersecting nothing) is position-independent (pt 3/4): its whole valid range is one
   tie. This is the placement rule (RULES §11); with 3+ differing-duration buffs the equivalent region
   is the **intersection** of the pairwise constraints.

The strategic rules in `docs/RULES.md` (buff-into-Lust packing, align-vs-twice, known-kill planning,
placement/containment, etc.) are these consequences applied to real fights and pinned down by sim. If a
rule ever seems to contradict §1–§4, re-derive from here and re-check against wowsims.

## 6. The Ashtongue proc — the one stochastic mechanic, and its exact expectation *(added 08-03)*

**The game facts** (`GAME.ATI`, SOURCES "Ashtongue Talisman"): a spell critical strike has a **50 %**
chance to grant **+145 spell haste rating for 5.0 s**, refresh-on-proc, **no internal cooldown**. The
rating lands additively in the one `(1 + rating/1577)` pool (wowsims `sim/core/unit.go:501`), so a
live proc multiplies through every percent window exactly like gear rating. Haste is snapshotted at
a cast's START (§2's rule), so a proc landing mid-cast speeds the next cast, not the one in flight,
and a proc expiring mid-cast does not slow it.

**Why this is the one place crit is load-bearing** (single target): crit is a constant factor on
every cast's damage and cancels out of every plan comparison (§4) — but the PROC RATE is `crit × ½`
per completion, and what the proc grants is *haste*, which interacts with the GCD floor and with
where every haste window sits. So with the talisman equipped, crit changes which plan wins
(MODEL-DEFECTS §9b: 3849 rank flips over +3 pp). The proc rate reads the **effective** crit — sheet
crit plus the Clearcasting→Arcane Potency lift (+3 pp single target, more on AoE where Clearcasting
procs per hit) — while the damage side of that same lift stays normalised away because it cancels.

**The expectation the model computes** is the exact renewal steady state of the proc's feedback
loop — a live proc speeds casting, faster casting rolls more procs into the same 5 s window — plus
the exact ramp-up from every cold start. Algebra, verification (closed forms to 1e-6 against the
engine; a seeded Monte Carlo of the true process to 2e-4), and the priced non-goals:
ESTABLISHED-FACTS §12. Instruments: law-check's ATI block and `tools/ati-mc.mjs`.
