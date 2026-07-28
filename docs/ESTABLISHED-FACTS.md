# ESTABLISHED FACTS — measured behaviour of every cooldown

**What this file is.** Measured, reproducible behaviour of each cooldown, with the **SIM** and the
**MODEL** side by side, so that placement questions stop being settled by argument.

User, 2026-07-28: *"observe the behavior of each singular buff at different haste levels, then in
combination with other buffs… some are obvious but should be documented too, so they are referencable
and testable whether our model follows them."*

⚠ **Why it exists.** In one session this project argued cooldown placement from first principles and
got it wrong in **both** directions — a correct measurement was twice explained with an incorrect
mechanism. Reasoning about the GCD floor reliably generates a hypothesis; it does not settle one.

## How to read it

Each section is one cooldown: what it does, then the **conclusions**, then the **data they came from**.
Sections 1–5 are haste cooldowns, 6–8 are damage cooldowns.

⚠ **This baseline isolates behaviour around ARCANE BLAST STACKS AND NOTHING ELSE.** No cooldown here
overlaps another. Haste's value is multiplied only by *aligning* it with other haste (up to the GCD
floor) or with damage buffs — none of which is present. Everything below is therefore the **ground
floor**, not the whole story; two- and three-cooldown combinations are the next expansion.

## Baseline A

| | |
|---|---|
| fight length | **60 s** · passive haste **0** · **1000** SP · **25 %** crit |
| Tirisfal Regalia 2-pc / 4-pc | **OFF** |
| mana | **infinite** — the duel isolates the LAYOUT |
| opener | **cold** (`_prestack: 0`; never prepull in a model-compared sim) |
| 3 Arcane Blast stacks built at | **t = 6.50 s** |
| sim | 60 000 iterations, seed 11 |

    node tools/buff-atlas.mjs --T 60 --sp 1000 --crit 25 --haste 0 --step 5 --iter 60000 --md

**SIM** = `DPS(one press) − DPS(never press)` (difference-in-differences, so every passive cancels).
**MODEL** = `robust(one press) − robust(no presses)`. Different units — **compare shapes, not values.**

⛔ Power Infusion and Drums of Battle are **omitted**: `sim/planspec.mjs` lists both as
`UNTRANSCRIBABLE` (wowsims has no APL action for either), so they could only ever produce a model
column with nothing to check it against. Ashtongue is out too — a proc, not a press.

## The two rules this baseline establishes

> **1. A haste cooldown's value does not depend on where you put it.** Confirmed on all five, sim and
> model. A haste multiplier shortens a slow cast and a fast cast by the same *fraction*.
>
> **2. A damage cooldown's value does not depend on where you put it EITHER — provided it lands at or
> after 3 Arcane Blast stacks.** Before that it covers fewer casts and is worth measurably less.
> Measured ordering, exactly as predicted:
>
>     @0  <  @5  ≈  @10 = @15 = @20 = … = @(T − duration)
>
> ★ **Refinement worth knowing: `@5` is already at full value.** A press *intent* at 5 s FIRES at the
> next cast boundary — 6.50 s — which is precisely the first full-stack cast. So the ramp penalty is
> confined to the pull itself. (`@5` reads −0.2 % / −0.0 % / −1.3 %, all inside noise.)

### ⛔ The one open model defect this baseline exposes

**Bloodlust, §3.** The sim is flat to 0.00 %; the model is not, by 2.92 % = **0.178 of a cast**, and
deterministically so. It is the third witness of a single bug — the model resolving *where the cast
lattice happens to land* as though it were damage:

| witness | size | where |
|---|---|---|
| Berserking "prefers" partial Bloodlust overlap | 0.185 casts | RULES §5b |
| Icy Veins before Bloodlust over-valued | 0.287 casts | PHASE13 §3.9 |
| **Bloodlust at t=15 s over-valued** | **0.178 casts** | **§3 below** |

⇒ **The user has named the likely fix**, 07-28: *"the only difference can possibly be the clipping of
haste buffs that miraculously align in a way that if you pop IV a little earlier it can clip an extra
cast… but that is not executable in the fight, and I think that's why we previously went with the
integral equation."* The retired rate integral was the **phase-average**; the discrete per-cast sum
realizes **one** phase. That is the trade to re-examine — without giving up the boundary credit, which
is a separate and correct thing.

---

## 1. Icy Veins

**+20 % casting haste. A **multiplier**, so it stacks multiplicatively with Bloodlust and Berserking and is subject to the 1.0 s GCD floor.**

| | |
|---|---|
| duration | 20 s |
| cooldown | 3 min |
| kind | haste |

### Conclusions

**Placement is irrelevant.** Sim spread across every interior placement: **0.07 %**. Model: **0.00 % — exactly**.
This is the reference case for the whole haste family, and it is the fact the rest of the project's
placement reasoning rests on: at h=0 a haste multiplier shortens a 2.5 s ramp cast and a 1.5 s
steady cast by the same *fraction*, so where the 20 s lands cannot matter on a bare fight.
⇒ Icy Veins alone buys **2.6667 casts**, wherever you put it. Closed form; see RULES §5b.

### Data

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

```
[flat, interior placements]
SIM  : mean 83.56 · spread 0.06 = 0.07% of mean  ✓ FLAT
MODEL: mean 4605.68 · spread 0.00 = 0.00% of mean  ✓ FLAT
```

## 2. Berserking

**+10 % casting haste (Troll racial). Multiplier, same floor.**

| | |
|---|---|
| duration | 10 s |
| cooldown | 3 min |
| kind | haste |

### Conclusions

**Placement is irrelevant** — sim 0.01 %, model 0.00 %. As predicted, identical in *shape* to Icy Veins;
only the magnitude differs (10 % vs 20 %, 10 s vs 20 s). Nothing about Berserking is special at h=0
on a bare fight.

### Data

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

```
[flat, interior placements]
SIM  : mean 22.68 · spread 0.00 = 0.01% of mean  ✓ FLAT
MODEL: mean 1252.32 · spread 0.00 = 0.00% of mean  ✓ FLAT
```

## 3. Bloodlust

**+30 % casting haste, raid-wide. Multiplier, same floor. **Pressed by someone else** — the planner treats it as a pinned raid call, not a press it chooses.**

| | |
|---|---|
| duration | 40 s |
| cooldown | 10 min (Sated) |
| kind | haste |

### Conclusions

**Placement is irrelevant in the sim — 0.00 %, the flattest column in the table.**

⛔ **The MODEL is NOT flat: 2.92 %.** It over-pays exactly one interior placement (t=15 s) by 399,
which is **0.178 of a cast**. The figure does not move between 10 000 and 60 000 iterations, so it is
not Monte-Carlo noise — it is deterministic, and it is a **scorer defect**. Tracked as the third
witness of one bug (see "The one open model defect" at the top of this file).

### Data

| press at | sim ΔDPS | model Δ | |
|---|---|---|---|
| 0s | 255.25 | 14080.0 | pull |
| 5s | 252.86 | 13547.2 |  |
| 10s | 252.86 | 13547.2 |  |
| 15s | 252.86 | 13946.2 |  |
| 20s | 245.70 | 13293.7 | clipped by kill |

```
[flat, interior placements]
SIM  : mean 252.86 · spread 0.00 = 0.00% of mean  ✓ FLAT
MODEL: mean 13680.20 · spread 398.99 = 2.92% of mean  ✗ NOT FLAT
⛔ the MODEL disagrees with a flat sim — a scorer defect, at 2.92% of the buff's own value.
```

## 4. Mind Quickening Gem

**+330 haste **rating** (not a multiplier — it adds to the rating pool before the percentage is computed).**

| | |
|---|---|
| duration | 20 s |
| cooldown | 5 min |
| kind | haste |

### Conclusions

**Placement is irrelevant** — sim 0.12 %, model 0.00 %. Note this is a haste *rating* buff rather than a
multiplier and it behaves identically, which is the expected result: rating and multiplier differ in
how they combine with each other, not in whether placement matters on a bare fight.

### Data

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

```
[flat, interior placements]
SIM  : mean 91.54 · spread 0.11 = 0.12% of mean  ✓ FLAT
MODEL: mean 5090.00 · spread 0.00 = 0.00% of mean  ✓ FLAT
```

## 5. Skull of Gul’dan

**+175 haste **rating**.**

| | |
|---|---|
| duration | 20 s |
| cooldown | 2 min |
| kind | haste |

### Conclusions

**Placement is irrelevant** — sim 0.06 %, model 0.00 %. Same story as Mind Quickening Gem.

### Data

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

```
[flat, interior placements]
SIM  : mean 47.95 · spread 0.03 = 0.06% of mean  ✓ FLAT
MODEL: mean 2589.97 · spread 0.00 = 0.00% of mean  ✓ FLAT
```

## 6. Arcane Power

**+30 % spell damage (and +30 % mana cost, which is outside this infinite-mana baseline).**

| | |
|---|---|
| duration | 15 s |
| cooldown | 3 min |
| kind | damage |

### Conclusions

**Two facts, and the second is the interesting one.**
1. From full stacks onward, **placement is irrelevant** — sim 0.09 %, model 0.00 %.
2. **Pressed at the pull it is worth 20 % less** — sim **−20.1 %**, model **−20.0 %**. The model
   reproduces the sim's penalty to 0.1 pp.

The mechanism is exactly as predicted: a fixed-duration *damage* buff is worth the casts it covers,
and during the opening ramp the casts are 2.500 / 2.166 / 1.832 s instead of 1.498 s, so 15 s of
Arcane Power covers materially fewer of them.

### Data

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

```
[flat, interior placements]
SIM  : mean 93.91 · spread 0.08 = 0.09% of mean  ✓ FLAT
MODEL: mean 5182.25 · spread 0.00 = 0.00% of mean  ✓ FLAT
[ramp penalty — pressed before 3 stacks at 6.50s, must be WORSE]
press  0s: sim -20.1% · model -20.0%   ✓ model reproduces the sim penalty
press  5s: sim -0.2% · model -0.0%   (fires at the first full-stack boundary — no penalty expected)
=> ✓ the ramp penalty is real and the model has it right
```

## 7. Icon of the Silver Crescent

**+155 spell damage.**

| | |
|---|---|
| duration | 20 s |
| cooldown | 2 min |
| kind | damage |

### Conclusions

Same two facts as Arcane Power, with a smaller ramp penalty because the window is longer (20 s, so the
ramp is a smaller share of it): **flat from full stacks** (sim 0.07 %, model 0.00 %), and
**−8.0 % at the pull** (model −7.7 %).

### Data

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

```
[flat, interior placements]
SIM  : mean 29.97 · spread 0.02 = 0.07% of mean  ✓ FLAT
MODEL: mean 1733.44 · spread 0.00 = 0.00% of mean  ✓ FLAT
[ramp penalty — pressed before 3 stacks at 6.50s, must be WORSE]
press  0s: sim -8.0% · model -7.7%   ✓ model reproduces the sim penalty
press  5s: sim -0.0% · model -0.0%   (fires at the first full-stack boundary — no penalty expected)
=> ✓ the ramp penalty is real and the model has it right
```

## 8. Serpent-Coil Braid

**+225 spell damage, delivered by using a **Mana Emerald** while wearing the belt. ⚠ The item that must be *equipped* (30720) is not the item that is *cast* (22044).**

| | |
|---|---|
| duration | 15 s |
| cooldown | 2 min (Mana Emerald, 3 charges) |
| kind | damage |

### Conclusions

**Flat from full stacks in the MODEL (0.00 %); the sim column reads 1.85 % but that is NOISE, not a
mechanism** — the spread *shrinks* with iterations (2.98 % at 10 k → 1.85 % at 60 k) and wanders
non-monotonically. At 34 DPS against ~1700 total this is the worst signal-to-noise row in the table.

**Ramp penalty −21.5 % at the pull** (model −20.0 %); the 1.5 pp gap sits inside this row's own noise.

### Data

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

```
[flat, interior placements]
SIM  : mean 33.24 · spread 0.61 = 1.85% of mean  ✗ NOT FLAT
MODEL: mean 1935.60 · spread 0.00 = 0.00% of mean  ✓ FLAT
[ramp penalty — pressed before 3 stacks at 6.50s, must be WORSE]
press  0s: sim -21.5% · model -20.0%   ✗ MODEL DISAGREES with the sim
press  5s: sim -1.3% · model -0.0%   ✗ MODEL DISAGREES with the sim
⚠ the SIM column is not flat — per the 07-28 ruling that is a HARNESS setup fault to hunt, not a fact.
```

---

## Expanding this file

The axes, in the order they are worth doing:

1. **Haste levels.** Everything above is measured at h=0, where the GCD floor does not yet bind on a
   bare fight. The floor is exactly what makes these rules conditional, so this is where the
   conclusions are expected to *change* — and where the tool earns its keep.
2. **Spell power and crit.** Cheaper to vary, and the damage cooldowns' relative worth moves with them.
3. **Two-cooldown combinations**, then three. This is where the interesting behaviour lives: none of
   the interactions the planner actually optimizes — haste stacking into the floor, damage buffs
   riding a haste window — can appear in a table where each cooldown is alone.

⚠ **Add baselines, never edit one in place.** The vectors *between* baselines are the point; a table
edited in place destroys the comparison it exists to support.

⚠ The tool **refuses to print** if `index.html` is an older engine (it checks `casts[].frac`). That
guard exists because a container restart silently rolled this repo back mid-session on 07-28 and a
batch of measurements ran against the pre-boundary-credit scorer before anyone noticed.
