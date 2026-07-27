# MECHANICS.md — the verified game formulas

The physics layer. These are the TBC 2.4.3 formulas the model computes with — cross-checked against
the wowsims source and the references in `docs/SOURCES.md`, and corroborated by our own wowsims runs.
**`docs/RULES.md` (the strategy) is *derived* from what's here — read this first.** Constants live in
`index.html` `GAME`/`BUFFS`; their sources are in the `SOURCES.md` ledger.

Notation: `m` = total haste multiplier; `SP` = spell power; a "cast" below means one Arcane Blast.

---

## 1. Cast time, Arcane Blast stacks, and the GCD

- **Arcane Blast** base cast = **2.5 s**, reduced by **1/3 s per AB debuff stack** (max 3 stacks):
  `cast_base(stacks) = 2.5 − (1/3)·stacks`. At 3 stacks = **1.5 s**. Each stack also costs +75% mana;
  the debuff lasts 8 s. We model steady-state **3 stacks** (the opener ramp is over in ~3 casts).
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
coincide. Gate: `tools/lattice-drift.mjs`.

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
  same-track use gets pushed off its window — or, per the **known harness bug** (`docs/TOOLING.md`),
  **DROPPED entirely** (`APLActionSchedule` consumes the timing while the queued off-GCD cast is lost).
  Either way the buff's *own* value is fine; a *later* use is what suffered. Confirm by finding where
  each use actually fires in the log — e.g. the Vashj icon@4:00's "−4.2" was its *terminal* icon@6:00
  being dropped, not the exit icon being worthless. Don't conclude "more uses can't help" from a raw
  drop-a-press number on the (currently drop-buggy) schedule harness; prefer **count-preserving**
  comparisons until the harness fix lands.

## 4. The driving equation: effective ABs cast

> ## ★★★★ THE OBJECTIVE IS EXACT — ✅ since 2026-07-27 (PHASE12 §6.10/§6.11)
>
> Effective ABs cast is a **deterministic per-cast sum**. For each Arcane Blast the model already knows
> the haste and the stack count (hence the cast time), whether Arcane Power is up (×1.30), which spell
> power buffs apply (normalizable against a plain cast), and crit as a constant factor that cancels.
> **There is nothing to approximate**, and since 07-27 `simulate()` accumulates exactly that sum and
> returns it as `total`/`totalEarly`/`robust` — which are now **one and the same number**. Gate:
> `tools/self-consistency.mjs` reads `0.00e+0` over 2755 plan-scorings, no sim.
>
> ★ **Each term carries a BOUNDARY CREDIT (PHASE12 §9, user ruling 07-27):**
> ```
> credit = min(1, (nextCut − castStart) / castDuration)
> ```
> where a **cut** is a moment the cast **stops LANDING**: the fight end `T` and an **intermission
> start** (boss untargetable) — **and nothing else**. ⛔ **Neither a burn edge nor an AoE edge is a
> cut**: the boss is targetable at both, and the spell a cast uses is chosen at its **START**, so a
> cast in flight is unaffected by the phase it completes in. Both are *value* questions under the
> snapshot rule below. ⚠ The AoE edge shipped briefly **as** a cut (the spell changes there) and the
> sim falsified it the same day: an AB started at 59.000 with an AoE phase opening at 60.000 completes
> at 60.498 and **lands for full AB damage** — docking it paid *less* than the game pays.
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
>    cast per window (`tools/snapshot-rule.mjs`, `tools/credit-check.mjs`).
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
× a constant). ⚠ **Written as an integral above for derivation only — the quantity is a SUM OVER
CASTS and must be evaluated as one.** The integral is the continuum limit, i.e. the expectation over a
uniformly random cast phase; a given plan's phase is *determined*, so for ranking two concrete plans
the realized per-cast sum is the correct evaluation and the integral is an approximation to it — they
differ by a median 0.21 % of score, which is why ranking on the integral is retired (banner above). A haste buff raises how *many* casts fit; a damage/SP buff raises what each is *worth*.
The evaluated form is therefore
**`effectiveABs = Σ_i [cast_damage_i/plainAB] × min(1, (nextCut − start_i)/duration_i)`** — the
boundary credit of the banner above, which is also the *only* place a fight boundary enters the number.
`total` (`simulate` in `index.html`) is this SUM up to the constant — ⛔ it was `rateAt`'s integral
until 07-27; `rateAt` now feeds only the `integral` diagnostic. **Everything the
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
