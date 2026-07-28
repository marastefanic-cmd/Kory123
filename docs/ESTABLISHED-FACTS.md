# ESTABLISHED FACTS — measured behaviour of every cooldown, one at a time

**What this file is.** A growing table of *measured* single-cooldown behaviour, on a fixed baseline,
with the SIM and the MODEL side by side. It exists so that placement arguments stop being arguments.

User, 2026-07-28: *"observe the behavior of each singular buff at different haste levels, then in
combination with other buffs… some are obvious but should be documented too, so they are referencable
and testable whether our model follows them."*

⚠ **Why it was needed.** In a single session the project argued about cooldown placement from first
principles and got it wrong in **both** directions — a correct measurement was twice explained with an
incorrect mechanism (see `docs/RULES.md` §5b and this file's Anomaly 1). Prose reasoning about the GCD
floor is reliable enough to generate a hypothesis and not reliable enough to settle one. A table is.

## Baseline A — the reference fight

| | |
|---|---|
| fight length | **60 s** |
| passive haste | **0** |
| spell power | **1000** |
| crit | **25 %** |
| Tirisfal Regalia 2-pc / 4-pc | **OFF** |
| mana | **infinite** (`BENCH.manaInject`, so the duel isolates the LAYOUT) |
| opener | **cold** (`_prestack: 0` — never prepull in a model-compared sim) |
| 3 Arcane Blast stacks built at | **t = 6.50 s** |

More baselines get added over time (other haste levels first — that is where the GCD floor starts to
bind and the rules below are expected to change). **Do not edit a baseline in place**: add a new one,
so the vectors between them stay readable.

## Method

    node tools/buff-atlas.mjs --T 60 --sp 1000 --crit 25 --haste 0 --step 5 --iter 60000 --md

One cooldown at a time, alone, on an otherwise bare fight, pressed at 0, 5, 10 … up to `T − duration`.

* **SIM** = `DPS(one press) − DPS(never press)` — difference-in-differences (BENCH §2.1), so every
  passive cancels exactly and what survives is only what the active did.
* **MODEL** = `robust(one press) − robust(no presses)` — the same question asked of the scorer.

The columns are in different units (DPS vs the model's damage sum). **Read each column's SHAPE, never
the absolute numbers against each other.**

### Two placements are structurally different and are judged separately

* **`t = 0` (pull)** — the buff covers the opening ramp, where casts are 2.500 / 2.166 / 1.832 s, all
  *above* the 1.5 s GCD.
* **`t = T − duration` (clipped)** — the window ends exactly at the kill, so the last cast under it is
  cut by the fight end and earns only partial credit. Not a placement choice anyone makes.

The flatness verdict covers the **interior** — everywhere a player actually has a free choice.
Value buffs pressed before full stacks are exempt too, and marked `ramp`.

## The expectations, stated BEFORE measuring

Recorded first so the table is a check and not a fishing expedition (user, 07-28):

* **HASTE buffs** (Icy Veins, Berserking, Bloodlust, Mind-Quickening Gem, Skull of Gul'dan) — value is
  **flat across every placement**. A haste buff shortens a slow cast and a fast cast by the same
  *fraction*, so where it lands cannot matter on a bare fight.
  ⚠ *"if they aren't [flat] then that's a fault in setting up the sim"* — a non-flat SIM column is a
  harness bug to hunt, not a fact to write down.
* **VALUE buffs** (Arcane Power, Icon, Serpent-Coil) — flat across every placement **at or after 3
  Arcane Blast stacks**. Before that the mage casts slower, so a fixed-duration damage buff covers
  fewer casts and is genuinely worth less.

⛔ **Power Infusion and Drums of Battle are omitted** (user, 07-28). `sim/planspec.mjs`'s
`UNTRANSCRIBABLE` lists both — wowsims has no APL action for either — so they could only ever have
produced a model column with nothing to check it against. Ashtongue is out too: a proc, not a press.

## ✅ RESULT — the expectations hold, with two named exceptions

| cooldown | kind | sim flat? | model flat? |
|---|---|---|---|
| Icy Veins | haste | ✓ 0.07 % | ✓ **0.00 %** |
| Berserking | haste | ✓ 0.01 % | ✓ **0.00 %** |
| Bloodlust | haste | ✓ 0.00 % | ✗ **2.92 %** ← Anomaly 1 |
| Mind Quickening Gem | haste | ✓ 0.12 % | ✓ **0.00 %** |
| Skull of Gul'dan | haste | ✓ 0.06 % | ✓ **0.00 %** |
| Arcane Power | value | ✓ 0.09 % | ✓ **0.00 %** |
| Icon of the Silver Crescent | value | ✓ 0.07 % | ✓ **0.00 %** |
| Serpent-Coil Braid | value | ✗ 1.85 % ← Anomaly 2 | ✓ **0.00 %** |

*(spread across interior placements, as a percentage of that cooldown's own mean value; 60 000
iterations, seed 11)*

★ **The model is EXACTLY flat — 0.00 %, not "flat within noise" — for seven of eight.** It is tighter
than the sim's own Monte-Carlo floor. The user's rule is not merely satisfied, it is satisfied
identically, which is the strongest form the claim can take.

### ⛔ Anomaly 1 — Bloodlust: the MODEL is not flat, and the sim is

    press at    sim ΔDPS    model Δ
       5 s       252.91     13547.2
      10 s       252.88     13547.2
      15 s       252.88     13946.2    <-- +399, i.e. +2.92%

The sim is flat to **0.00 %**. The model over-pays a single interior placement by 399 = **0.178 casts**
— sub-cast, and **deterministic**: it does not move between 10 000 and 60 000 iterations, so it is not
noise. This is a **scorer defect**, and it is the same family as `docs/PHASE13.md` §3.9 (Icy Veins
before Bloodlust over-valued by 0.287 casts) and RULES §5b's Berserking artifact (0.185 casts): the
model resolving where the cast lattice lands as though it were damage.

⇒ The three known instances are all **0.18–0.29 casts**, all sub-cast, all on placements that shift the
downstream lattice. Treat them as one bug with three witnesses.

### ⚠ Anomaly 2 — Serpent-Coil: the SIM is not flat, and it is NOISE not mechanism

The model is exactly flat (1935.6 at every interior placement). The sim wanders **non-monotonically**
across ~1 DPS on a 34 DPS value. The tell: the spread **shrinks with iterations**, 2.98 % at 10 k →
1.85 % at 60 k. A mechanism would not. Serpent-Coil is the smallest-value cooldown in the table
(34 DPS against ~1700 total), so it has the worst signal-to-noise of any row.

⇒ **Not recorded as a fact.** If it matters later, raise iterations and use the multi-seed band —
`BENCH.seeds` — rather than reading one seed.

## Raw tables

## Icy Veins  —  HASTE buff, 20s (+20% haste · 20s · 3m)
Expectation: flat across INTERIOR placements — t=0 (pull) and t=40s (window clipped by the kill) judged separately.

| press at | sim ΔDPS | model Δ | |
|---|---|---|---|
| 0s | 85.35 | 4701.4 | pull |
| 5s | 83.61 | 4605.7 |  |
| 10s | 83.55 | 4605.7 |  |
| 15s | 83.55 | 4605.7 |  |
| 20s | 83.55 | 4605.7 |  |
| 25s | 83.55 | 4605.7 |  |
| 30s | 83.55 | 4605.7 |  |
| 35s | 83.55 | 4605.7 |  |
| 40s | 83.53 | 4375.6 | clipped by kill |

  SIM  : mean 83.56 · spread 0.06 = 0.07% of mean  ✓ FLAT
  MODEL: mean 4605.68 · spread 0.00 = 0.00% of mean  ✓ FLAT

## Berserking  —  HASTE buff, 10s (+10% haste · 10s · 3m)
Expectation: flat across INTERIOR placements — t=0 (pull) and t=50s (window clipped by the kill) judged separately.

| press at | sim ΔDPS | model Δ | |
|---|---|---|---|
| 0s | 23.62 | 1306.5 | pull |
| 5s | 22.68 | 1252.3 |  |
| 10s | 22.68 | 1252.3 |  |
| 15s | 22.68 | 1252.3 |  |
| 20s | 22.68 | 1252.3 |  |
| 25s | 22.68 | 1252.3 |  |
| 30s | 22.68 | 1252.3 |  |
| 35s | 22.68 | 1252.3 |  |
| 40s | 22.68 | 1252.3 |  |
| 45s | 22.68 | 1252.3 |  |
| 50s | 19.92 | 975.3 | clipped by kill |

  SIM  : mean 22.68 · spread 0.00 = 0.01% of mean  ✓ FLAT
  MODEL: mean 1252.32 · spread 0.00 = 0.00% of mean  ✓ FLAT

## Bloodlust  —  HASTE buff, 40s (+30% haste · 40s)
Expectation: flat across INTERIOR placements — t=0 (pull) and t=20s (window clipped by the kill) judged separately.

| press at | sim ΔDPS | model Δ | |
|---|---|---|---|
| 0s | 255.25 | 14080.0 | pull |
| 5s | 252.86 | 13547.2 |  |
| 10s | 252.86 | 13547.2 |  |
| 15s | 252.86 | 13946.2 |  |
| 20s | 245.70 | 13293.7 | clipped by kill |

  SIM  : mean 252.86 · spread 0.00 = 0.00% of mean  ✓ FLAT
  MODEL: mean 13680.20 · spread 398.99 = 2.92% of mean  ✗ NOT FLAT
  ⛔ the MODEL disagrees with a flat sim — a scorer defect, at 2.92% of the buff's own value.

## Mind Quickening Gem  —  HASTE buff, 20s (+330 haste · 20s · 5m)
Expectation: flat across INTERIOR placements — t=0 (pull) and t=40s (window clipped by the kill) judged separately.

| press at | sim ΔDPS | model Δ | |
|---|---|---|---|
| 0s | 87.94 | 4888.2 | pull |
| 5s | 91.45 | 5090.0 |  |
| 10s | 91.56 | 5090.0 |  |
| 15s | 91.56 | 5090.0 |  |
| 20s | 91.56 | 5090.0 |  |
| 25s | 91.56 | 5090.0 |  |
| 30s | 91.56 | 5090.0 |  |
| 35s | 91.56 | 5090.0 |  |
| 40s | 86.15 | 4587.3 | clipped by kill |

  SIM  : mean 91.54 · spread 0.11 = 0.12% of mean  ✓ FLAT
  MODEL: mean 5090.00 · spread 0.00 = 0.00% of mean  ✓ FLAT

## Arcane Power  —  VALUE buff, 15s (+30% dmg · 15s · 3m)
Expectation: flat across INTERIOR placements >= 6.50s (full stacks) — t=0 (pull) and t=45s (window clipped by the kill) judged separately.

| press at | sim ΔDPS | model Δ | |
|---|---|---|---|
| 0s | 75.05 | 4145.8 | ramp, pull |
| 5s | 93.69 | 5182.3 | ramp |
| 10s | 93.94 | 5182.3 |  |
| 15s | 93.90 | 5182.3 |  |
| 20s | 93.95 | 5182.3 |  |
| 25s | 93.94 | 5182.3 |  |
| 30s | 93.92 | 5182.3 |  |
| 35s | 93.87 | 5182.3 |  |
| 40s | 93.87 | 5182.3 |  |
| 45s | 90.62 | 5010.7 | clipped by kill |

  SIM  : mean 93.91 · spread 0.08 = 0.09% of mean  ✓ FLAT
  MODEL: mean 5182.25 · spread 0.00 = 0.00% of mean  ✓ FLAT

## Icon of the Silver Crescent  —  VALUE buff, 20s (+155 dmg · 20s · 2m)
Expectation: flat across INTERIOR placements >= 6.50s (full stacks) — t=0 (pull) and t=40s (window clipped by the kill) judged separately.

| press at | sim ΔDPS | model Δ | |
|---|---|---|---|
| 0s | 27.57 | 1600.1 | ramp, pull |
| 5s | 29.96 | 1733.4 | ramp |
| 10s | 29.97 | 1733.4 |  |
| 15s | 29.97 | 1733.4 |  |
| 20s | 29.98 | 1733.4 |  |
| 25s | 29.97 | 1733.4 |  |
| 30s | 29.96 | 1733.4 |  |
| 35s | 29.96 | 1733.4 |  |
| 40s | 29.19 | 1689.3 | clipped by kill |

  SIM  : mean 29.97 · spread 0.02 = 0.07% of mean  ✓ FLAT
  MODEL: mean 1733.44 · spread 0.00 = 0.00% of mean  ✓ FLAT

## Serpent-Coil Braid  —  VALUE buff, 15s (+225 dmg on gem · 3 charges)
Expectation: flat across INTERIOR placements >= 6.50s (full stacks) — t=0 (pull) and t=45s (window clipped by the kill) judged separately.

| press at | sim ΔDPS | model Δ | |
|---|---|---|---|
| 0s | 26.08 | 1548.5 | ramp, pull |
| 5s | 32.81 | 1935.6 | ramp |
| 10s | 32.90 | 1935.6 |  |
| 15s | 33.14 | 1935.6 |  |
| 20s | 33.11 | 1935.6 |  |
| 25s | 33.30 | 1935.6 |  |
| 30s | 33.39 | 1935.6 |  |
| 35s | 33.51 | 1935.6 |  |
| 40s | 33.34 | 1935.6 |  |
| 45s | 32.06 | 1871.5 | clipped by kill |

  SIM  : mean 33.24 · spread 0.61 = 1.85% of mean  ✗ NOT FLAT
  MODEL: mean 1935.60 · spread 0.00 = 0.00% of mean  ✓ FLAT
  ⚠ the SIM column is not flat — per the 07-28 ruling that is a HARNESS setup fault to hunt, not a fact.

## Skull of Gul’dan  —  HASTE buff, 20s (+175 haste · 20s · 2m)
Expectation: flat across INTERIOR placements — t=0 (pull) and t=40s (window clipped by the kill) judged separately.

| press at | sim ΔDPS | model Δ | |
|---|---|---|---|
| 0s | 48.94 | 2646.5 | pull |
| 5s | 47.97 | 2590.0 |  |
| 10s | 47.94 | 2590.0 |  |
| 15s | 47.94 | 2590.0 |  |
| 20s | 47.94 | 2590.0 |  |
| 25s | 47.94 | 2590.0 |  |
| 30s | 47.94 | 2590.0 |  |
| 35s | 47.94 | 2590.0 |  |
| 40s | 47.91 | 2430.1 | clipped by kill |

  SIM  : mean 47.95 · spread 0.03 = 0.06% of mean  ✓ FLAT
  MODEL: mean 2589.97 · spread 0.00 = 0.00% of mean  ✓ FLAT

## summary

| cooldown | sim flat? | model flat? |
|---|---|---|
| Icy Veins | ✓ 0.07% | ✓ 0.00% |
| Berserking | ✓ 0.01% | ✓ 0.00% |
| Bloodlust | ✓ 0.00% | ✗ 2.92% |
| Mind Quickening Gem | ✓ 0.12% | ✓ 0.00% |
| Arcane Power | ✓ 0.09% | ✓ 0.00% |
| Icon of the Silver Crescent | ✓ 0.07% | ✓ 0.00% |
| Serpent-Coil Braid | ✗ 1.85% | ✓ 0.00% |
| Skull of Gul’dan | ✓ 0.06% | ✓ 0.00% |


## How to extend this file

1. Pick the next baseline — **haste levels first**, since the GCD floor is what makes these rules
   conditional, and everything above is measured where it does not yet bind.
2. Run `tools/buff-atlas.mjs` with the new parameters and append a section. Keep Baseline A intact.
3. When a rule survives two baselines, promote it into `docs/RULES.md` with a pointer back here.
4. ⚠ The tool **refuses to print** if `index.html` is an older engine (it checks `casts[].frac`). That
   guard exists because a container restart silently rolled this repo back mid-session on 07-28 and a
   batch of measurements ran against the pre-boundary-credit scorer before anyone noticed.
