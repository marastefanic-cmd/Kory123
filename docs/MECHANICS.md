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

## 4. The driving equation: cast-rate DPS

Put §1–§3 together. Instantaneous DPS at time `t` is one cast's damage divided by how long that cast
takes:

**`DPS(t) = cast_damage(t) / interval(t)`** and **`total = ∫ DPS(t) dt`** over the fight (intermissions
contribute 0 — no casting).

This single integral is the whole scoring model (`simulate`/`rateAt` in `index.html`). Everything the
planner decides falls out of it.

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
3. **Two pure-haste buffs — overlap vs separate** (0 gear haste). Fire A and B in the *same* window,
   or in two *separate* windows? Work the integral (each buff alone stays under the floor, the
   overlap goes over it): **`overlap − separate = d · (0.5 − (h_a + h_b)) / 1.5`** per buff-window `d`.
   - The `0.5` is the **floor headroom** — the haste that takes you from `m = 1` up to the `m = 1.5`
     floor — **not** the two buffs' combined haste. Haste never adds: overlapping Lust and IV gives
     `m = 1.30 · 1.20 = 1.56` (**+56%, already over the floor**), not +50%. The wash at Lust+IV
     happens because their *additive* percentages `30 + 20` equal the 50% headroom, so the ~4% the
     `×1.56` overlap spills past the floor (wasted) exactly cancels the multiplicative gain.
   - Below headroom (e.g. Lust+Berserking, `30 + 10 = 40 < 50` → `m = 1.43`, under floor) overlap wins
     by a hair; above it, separate wins. With gear haste `g` the headroom shrinks to `1.5/g − 1`,
     tipping everything toward separate (this is why "IV slides out of Lust" — §5 pt 5 / RULES §5).

   ⇒ *haste-on-haste is never a real synergy; the reason to stack haste into Lust is to speed the
   damage-buffed casts, not the haste product itself.*
4. **Damage per cast is stack-independent** ⇒ ramp position doesn't change a haste buff's banked value
   (haste is ~position-independent among max-stack windows), but a **damage/SP** buff still wants the
   post-ramp fast casts (fewer, slower casts during the ramp = less flux).

The strategic rules in `docs/RULES.md` (buff-into-Lust packing, align-vs-twice, known-kill planning,
etc.) are these consequences applied to real fights and pinned down by sim. If a rule ever seems to
contradict §1–§4, re-derive from here and re-check against wowsims.
