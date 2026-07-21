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

*Verified:* wowsims mage/cast code; matches our sims exactly.

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
  DPS but never *which* schedule wins.

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
- **Corollary — a SIM trap.** If the sim shows a *free, off-GCD* buff as net-negative with **no**
  alignment or cooldown reason (the other cooldowns don't move, it catches live casts, it has no cd
  conflict), do **not** trust it — suspect a **harness artifact**, e.g. a fixed-time scheduled press
  landing *mid-cast* rather than between casts (worst on the slow post-intermission ramp, where casts
  are long). See `docs/TOOLING.md` (the fixed-offset-mid-cast trap) — the model's cast-counting is the
  referee there, not the raw sim number.

## 4. The driving equation: effective ABs cast

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
× a constant). A haste buff raises how *many* casts fit; a damage/SP buff raises what each is *worth*.
`total` (`simulate`/`rateAt` in `index.html`) is this integral up to the constant. **Everything the
planner decides is a *consequence* of maximizing this one quantity — Lust alignment, haste sequencing,
SP-on-fast-casts are *methods* that usually maximize it, never rules in their own right.** When a
heuristic and the effective-AB count (or the sim, its ground truth) disagree, the count wins. This is
also the output to compare **setups** on: plan each with its own ideal cooldown usage, then read off
whose effective-AB total is higher to decide which trinkets/gear to bring.

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
