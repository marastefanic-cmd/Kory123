# MODEL DEFECTS — where the planner disagrees with an established fact

`docs/ESTABLISHED-FACTS.md` records **facts**: measured, reproducible cooldown behaviour, with no
commentary about the planner. This file is the other half — every place the model fails to reproduce
one of those facts, with its size, its reproduction, and whether the mechanism is known.

Keeping them apart is deliberate. A fact stays true when the model is fixed; a defect does not. Mixed
into one document, neither reads cleanly, and the facts file becomes hard to trust as a reference.

## How to use this file

1. A defect here means: **the sim satisfies an established fact and the model does not.** That is the
   only thing that qualifies. A model/sim gap where the SIM is the odd one out is a harness problem,
   not a model defect, and belongs in `docs/TOOLING.md`.
2. Sizes are quoted in **casts**, not percentages — a percentage of a single cooldown's value sounds
   enormous when the cooldown is small. One cast at Baseline A is 2242.1 damage.
3. Before fixing, reproduce. Every entry carries the exact command.

---

## D1 — the model resolves sub-cast lattice phase as though it were damage

**Status: OPEN. Mechanism not established. Three witnesses, one bug.**

The model books *where the cast lattice happens to land* as real expected damage. Because a cooldown's
placement shifts every cast after it, a placement that is genuinely worth the same can come out ahead
by a fraction of a cast — and the model spends real layout quality chasing it.

| witness | size | the fact it violates |
|---|---|---|
| **Bloodlust's interior alternates between exactly two values** | **0.231 casts** | ESTABLISHED-FACTS rule 1 |
| Berserking "prefers" partial Bloodlust overlap over sitting fully inside it | **0.185 casts** | RULES §5b |
| Icy Veins before Bloodlust valued above Icy Veins inside it | **0.287 casts** | ESTABLISHED-FACTS §1 rule 1 |

All three are **sub-cast**, all three are on placements that shift the downstream lattice, and all
three are **deterministic** — the Bloodlust figure is identical at 10 000 and 60 000 iterations, so it
is not Monte-Carlo noise.

### The Bloodlust witness — measured head-to-head, and the model loses by ~3600σ

This is the sharpest of the three and the one to develop a fix against, because the sim's verdict on it
is not close. Duelling `BL@10` against `BL@15` with **common random numbers** (both arms on the same
seed, so the paired difference resolves far better than either absolute DPS), 5 seeds × 10 000
iterations, h=0, T=60:

| | Δ |
|---|---|
| model | +399.0 damage = **+0.2310 casts** = +0.497 % of the fight |
| what that predicts in sim DPS | **+7.26 DPS** |
| sim, measured | **+0.001 ± 0.002 DPS** |

Every individual seed reads 0.000 – 0.004. There is no overlap with the prediction whatsoever.

It is not a fight-length artifact: at `T=180`, with 26 interior placements instead of 2, the model still
alternates between exactly **7.842457** and **8.073431** casts, on a period of 15 s — which at h=0 is
exactly ten cast intervals.

**Localized.** The sim's own action table reports Arcane Blast `casts = 467318` over 10 000 iterations
— i.e. **46.7318 casts per fight, byte-identical in both arms**. The model books 46.5113 at @10 and
46.7423 at @15. So the sim fits the same number of casts wherever Bloodlust goes, and the model's @10
arm is the one that is wrong, by 0.22 casts. The whole discrepancy is the *terminal* cast: both model
arms start 47 casts, and the last one earns `frac` 0.5113 at @10 against 0.7423 at @15.

**Mechanism — this one is established, unlike the rest of D1.** Bloodlust is the only cooldown the
model treats as a raid *external*: `isExternal` sets `auraAt = eff = e.ts`, so its window is literally
`[ts, ts+40]` with no snapping. How many cast boundaries fall inside that window therefore depends on
`ts mod interval` — 34 covered casts at @10, 35 at @15 — and the extra hasted cast pulls the whole
downstream lattice 0.346 s earlier, which the kill-boundary credit banks as 0.231 of an extra cast. In
wowsims the aura can only begin on a GCD, so the covered count is placement-invariant and nothing
shifts.

⚠ **Note what is *not* wrong here.** A real shaman does press Lust mid-cast, so a real window really can
begin at an arbitrary sub-cast phase — the model's physics is arguably closer to a real pull than the
sim's is. The defect is that the model **resolves** that phase into a 0.5 % scoring difference instead
of averaging over it, and 0.5 % is far more than enough to pick a plan. Nobody can know their cast
lattice to ±0.3 s when planning, which is the engine's own stated reason for phase-averaging the press
moment a few lines earlier in the same function.

### Reproduction

    node tools/buff-atlas.mjs --T 60 --sp 1000 --crit 25 --haste 0 --step 5 --iter 60000 --md
    node tools/facts-ladder.mjs --haste=0:850:10 --buffs=bloodlust    # "⚠ NOT FLAT" on most rungs

Bloodlust's sim column is flat to **0.00 %** across every interior placement. The model's is not: it
pays 13547.2 at 5 s and 10 s and **13946.2** at 15 s.

`tools/facts-ladder.mjs` now asserts interior flatness on every rung of the haste ladder, so this
defect fails loudly rather than needing to be noticed: Bloodlust reports a worst interior spread of
0.231538 casts, and **every other cooldown reports exactly 0.000000**.

### The direction to look, from the user (07-28)

> *"The only difference can possibly be the clipping of haste buffs that miraculously align in a way
> that if you pop IV a little earlier it can clip an extra cast, but that is not executable in the
> fight, and I think that's why we previously went with the integral equation."*

The retired rate integral was the **phase average**; the discrete per-cast sum realizes **one** phase.
That is the trade to re-examine.

⚠ **Not** by restoring the integral as the arbiter — it disagreed with the per-cast sum by a median
0.2114 % of score against ranking margins of ~0.005–0.07 %, which is why it was retired
(archived PHASE12 §6.10). And **not** by giving up the boundary credit, which is a separate and
correct thing (a cast that does not fit earns the fraction that does). The question is narrower: should
the *terminal* phase of a plan be realized or averaged?

### What has already been ruled out

Two mechanisms were proposed, measured, and **falsified** — recorded so nobody spends the afternoon
again:

* **Ramp compression.** "Icy Veins on the opening ramp buys a whole cast." It buys **0.068 %**
  (sim, `IV@0` vs `IV@20` bare, +1.1 DPS ± 0.07 over 5 seeds), not a cast.
* **Snapshot spill.** "A cast begun under the buff finishes hasted, so a placement that spills more
  past the window edge is worth more." Spill varies 4× (0.246 s → 0.996 s) across placements and the
  value is **identical** in every one. The model already handles the snapshot rule correctly.

### Partial mitigation already shipped

`structuralSnap` (RULES §5b) breaks ties toward the structurally sensible layout when the difference is
inside the 0.05 % band. It bounds the *symptom* — it does not fix the cause, and the Bloodlust witness
(2.92 % of that cooldown's value) is well outside the band it can reach.

---

## ⚠ Unresolved — a pull advantage at h=0 that should not exist

**Status: OPEN QUESTION, not yet classified.** At h=0, pressing a haste cooldown at the pull is worth
**+2.8 % (model) / +2.1 % (sim)** over any interior placement — about **0.05 of a cast**.

It is in **both** columns, so it is not D1 (which is model-only by definition). But by the arithmetic it
should not exist: at h=0 nothing is floored, the ramp casts are cast-bound and the steady casts are
GCD-bound, and a haste multiplier divides both by the same factor. ESTABLISHED-FACTS rule 3 explains a
pull advantage **at and above a buff's cap threshold** — h=0 is far below every threshold (the lowest,
Bloodlust, is 243).

It is also **perfectly stable**: 2.812 % at all 12 spell-power × crit combinations, to three decimals.
A quantity that constant is a mechanism, not noise.

⇒ Two possibilities, and picking between them matters: either it is a real effect neither the arithmetic
nor rule 3 captures, **or** part of what is filed above as D1 is real and the model is not wrong about
it. Do not fix D1 without settling this first.

## Not defects — recorded so they are not re-filed

* **Serpent-Coil's steady-state column is not flat in the SIM** (1.85 % at 60 k iterations). The model
  is exactly flat. The spread **shrinks with iterations** (2.98 % → 1.85 %) and wanders
  non-monotonically on the smallest value in the table (≈33 DPS against ~1700 total). That is
  Monte-Carlo noise, not a mechanism, and not a fact — see ESTABLISHED-FACTS §8.
* **A haste cooldown is worth more pressed at the pull.** Real, and in both columns: the ramp casts are
  longer than the GCD floor, so haste still converts there. It grows with passive haste and becomes the
  *entire* value of the cooldown above the cap. ESTABLISHED-FACTS rule 3.

* **A haste cooldown is worth something above the GCD cap when its window reaches the kill.** Raised
  07-28 as a suspected clipping bug — *"is the clipping by the kill not respecting the GCD cap? that it
  takes remaining time to cast not capped by the GCD?"* It respects it. At h=800 Icy Veins leaves the
  lattice byte-identical (59 casts, 1.000 s apart, with and without), and its entire 0.1390-cast value
  is the last cast completing in 0.828 s instead of 0.994 s, so more of it lands before the boss dies.
  The floor caps how often a cast may **start**, never how fast one **goes** — `frac` divides by the
  cast duration, which is correct, and dividing by the GCD-bound interval instead would be the bug. The
  sim agrees independently (0.00 DPS at every interior placement, 5.20 DPS at the terminal one).
  ESTABLISHED-FACTS rule 4.
