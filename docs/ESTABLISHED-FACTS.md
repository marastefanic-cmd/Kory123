# ESTABLISHED FACTS — how each cooldown behaves

Measured, reproducible behaviour of every cooldown, one at a time. **This file records facts only.**
Where the planner's model fails to reproduce one, that is written down in
`docs/MODEL-DEFECTS.md` instead — a fact and a bug are different kinds of statement and mixing them
makes both harder to trust.

User, 2026-07-28: *"observe the behavior of each singular buff at different haste levels, then in
combination with other buffs… so they are referencable and testable whether our model follows them."*

## Scope of these baselines

Every measurement below is **one cooldown, alone, on an otherwise bare fight**. Nothing overlaps
anything. So this file establishes how each cooldown behaves **around Arcane Blast stacks and the GCD
floor, and nothing else** — haste's value is multiplied by *aligning* it with other haste or with
damage buffs, and none of that can appear here. Combinations are the next expansion.

## The three rules

> **1. A haste cooldown is worth the same wherever you put it at steady state.**
>
> **2. A damage cooldown is worth the same wherever you put it — from 3 Arcane Blast stacks onward.**
> Before that it covers fewer casts and is worth less. Since a press fires at the *next cast boundary*,
> a press written at 5 s already lands on the first full-stack cast, so the penalty is confined to the
> pull:  `@0  <  @5 ≈ @10 = @15 = … = @(T − duration)`
>
> **3. ★ THE ONE EXCEPTION, AND IT IS A HASTE EXCEPTION.** As passive haste rises toward the GCD cap
> (**~789 rating**, where the 3-stack interval is already floored at 1.0 s), a haste cooldown converts
> less and less at steady state — but keeps converting at the **pull**, where casts are 2.500 / 2.166 /
> 1.832 s and still longer than the floor. Above the cap the steady-state value is **zero** and the
> pull is the entire value of the cooldown. Damage cooldowns are unaffected: they have no cap.

## Baselines

| | fight | passive haste | spell power | crit |
|---|---|---|---|---|
| **A** | 60 s | 0 | 1000 | 25 % |
| **B** | 60 s | 400 | 1000 | 25 % |
| **C** | 60 s | 800 (above the cap) | 1000 | 25 % |

All: Tirisfal 2-pc/4-pc **off**, mana **infinite**, opener **cold** (`_prestack: 0`), 3 stacks built at
**t = 6.50 s**, sim 20 000 iterations seed 11.

    node tools/buff-atlas.mjs --T 60 --sp 1000 --crit 25 --haste {0,400,800} --step 5 --md

Columns are **absolute value added by the press**: `DPS(one press) − DPS(never press)` for the sim, and
`robust(one press) − robust(no presses)` for the model. Different units — compare *shapes*.

⛔ Power Infusion and Drums of Battle are omitted: `sim/planspec.mjs` lists both as `UNTRANSCRIBABLE`
(wowsims has no APL action for either), so they could only produce a model column with nothing to check
it against. Ashtongue is out too — a proc, not a press.

---

## 1. Icy Veins

+20 % casting haste, as a **multiplier** — it stacks multiplicatively with Bloodlust and Berserking, and is subject to the 1.0 s GCD floor.

| duration | cooldown | kind |
|---|---|---|
| 20 s | 3 min | haste |

### Conclusions

**Placement does not matter at steady state.** Every interior placement is worth the same, at every
baseline measured.

**Pressed at the pull it is worth more, and the gap grows with passive haste.** The opening casts are
2.500 / 2.166 / 1.832 s — longer than the GCD floor — so haste still converts there after it has
stopped converting at 3 stacks.

**Above the passive GCD cap (~789 rating) it is worth NOTHING except at the pull.** At h=800 it is
0.00 DPS at every steady-state placement and 22.71 DPS pressed at 0.

### Data

**Baseline A — passive haste 0**

| press at | sim DPS added | model added | |
|---|---|---|---|
| 0s | 85.21 | 4701.4 | pull |
| 5s | 83.52 | 4605.7 |  |
| 10s | 83.45 | 4605.7 |  |
| 15s | 83.45 | 4605.7 |  |
| 20s | 83.45 | 4605.7 |  |
| 25s | 83.45 | 4605.7 |  |
| 30s | 83.45 | 4605.7 |  |
| 35s | 83.45 | 4605.7 |  |
| 40s | 83.44 | 4375.6 | clipped by kill |

**Baseline B — passive haste 400**

| press at | sim DPS added | model added | |
|---|---|---|---|
| 0s | 104.91 | 5792.3 | pull |
| 5s | 102.86 | 5683.9 |  |
| 10s | 102.81 | 5683.9 |  |
| 15s | 102.81 | 5683.9 |  |
| 20s | 102.81 | 5683.9 |  |
| 25s | 102.81 | 5683.9 |  |
| 30s | 102.81 | 5683.9 |  |
| 35s | 102.81 | 5683.9 |  |
| 40s | 101.38 | 5379.2 | clipped by kill |

**Baseline C — passive haste 800**

| press at | sim DPS added | model added | |
|---|---|---|---|
| 0s | 22.71 | 1237.3 | pull |
| 5s | 0.01 | 0.0 |  |
| 10s | 0.00 | 0.0 |  |
| 15s | 0.00 | 0.0 |  |
| 20s | 0.00 | 0.0 |  |
| 25s | 0.00 | 0.0 |  |
| 30s | 0.00 | 0.0 |  |
| 35s | 0.00 | 0.0 |  |
| 40s | 5.20 | 240.1 | clipped by kill |


## 2. Berserking

+10 % casting haste (Troll racial). Multiplier, same floor.

| duration | cooldown | kind |
|---|---|---|
| 10 s | 3 min | haste |

### Conclusions

Identical in shape to Icy Veins at every baseline; only the magnitude differs (10 % vs 20 %, 10 s vs
20 s). Flat at steady state, better at the pull, and **worth nothing but the pull above the cap**
(h=800: 0.00 DPS steady, 12.28 DPS at 0).

### Data

**Baseline A — passive haste 0**

| press at | sim DPS added | model added | |
|---|---|---|---|
| 0s | 23.56 | 1306.5 | pull |
| 5s | 22.65 | 1252.3 |  |
| 10s | 22.65 | 1252.3 |  |
| 15s | 22.65 | 1252.3 |  |
| 20s | 22.65 | 1252.3 |  |
| 25s | 22.65 | 1252.3 |  |
| 30s | 22.65 | 1252.3 |  |
| 35s | 22.65 | 1252.3 |  |
| 40s | 22.65 | 1252.3 |  |
| 45s | 22.65 | 1252.3 |  |
| 50s | 19.91 | 975.3 | clipped by kill |

**Baseline B — passive haste 400**

| press at | sim DPS added | model added | |
|---|---|---|---|
| 0s | 26.54 | 1465.8 | pull |
| 5s | 28.17 | 1572.7 |  |
| 10s | 28.23 | 1572.7 |  |
| 15s | 28.23 | 1572.7 |  |
| 20s | 28.23 | 1572.7 |  |
| 25s | 28.23 | 1572.7 |  |
| 30s | 28.23 | 1572.7 |  |
| 35s | 28.23 | 1572.7 |  |
| 40s | 28.23 | 1572.7 |  |
| 45s | 28.23 | 1572.7 |  |
| 50s | 25.47 | 1348.6 | clipped by kill |

**Baseline C — passive haste 800**

| press at | sim DPS added | model added | |
|---|---|---|---|
| 0s | 12.28 | 670.8 | pull |
| 5s | 0.00 | 0.0 |  |
| 10s | 0.00 | 0.0 |  |
| 15s | 0.00 | 0.0 |  |
| 20s | 0.00 | 0.0 |  |
| 25s | 0.00 | 0.0 |  |
| 30s | 0.00 | 0.0 |  |
| 35s | 0.00 | 0.0 |  |
| 40s | 0.00 | 0.0 |  |
| 45s | 0.00 | 0.0 |  |
| 50s | 2.83 | 120.7 | clipped by kill |


## 3. Bloodlust

+30 % casting haste, raid-wide. Multiplier, same floor. **Pressed by someone else** — the planner treats it as a pinned raid call.

| duration | cooldown | kind |
|---|---|---|
| 40 s | 10 min (Sated) | haste |

### Conclusions

Flat at steady state, better at the pull, and **worth nothing but the pull above the cap** (h=800:
0.00 DPS steady, 29.46 DPS at 0). The largest haste cooldown in the game and it obeys the same rule as
the smallest.

### Data

**Baseline A — passive haste 0**

| press at | sim DPS added | model added | |
|---|---|---|---|
| 0s | 255.22 | 14080.0 | pull |
| 5s | 252.81 | 13547.2 |  |
| 10s | 252.80 | 13547.2 |  |
| 15s | 252.80 | 13946.2 |  |
| 20s | 245.68 | 13293.7 | clipped by kill |

**Baseline B — passive haste 400**

| press at | sim DPS added | model added | |
|---|---|---|---|
| 0s | 221.64 | 12245.2 | pull |
| 5s | 205.75 | 11370.6 |  |
| 10s | 205.63 | 11085.8 |  |
| 15s | 205.63 | 11370.6 |  |
| 20s | 207.67 | 11197.0 | clipped by kill |

**Baseline C — passive haste 800**

| press at | sim DPS added | model added | |
|---|---|---|---|
| 0s | 29.46 | 1605.8 | pull |
| 5s | 0.01 | 0.0 |  |
| 10s | 0.00 | 0.0 |  |
| 15s | 0.00 | 0.0 |  |
| 20s | 7.29 | 360.5 | clipped by kill |


## 4. Mind Quickening Gem

+330 haste **rating** — added to the rating pool before the percentage is computed, rather than multiplying it.

| duration | cooldown | kind |
|---|---|---|
| 20 s | 5 min | haste |

### Conclusions

A haste **rating** buff, and it behaves exactly like the multipliers: flat at steady state, better at
the pull, nothing but the pull above the cap (h=800: 0.00 steady, 16.49 at 0). Rating and multiplier
differ in how they combine with *each other*, not in whether placement matters on a bare fight.

### Data

**Baseline A — passive haste 0**

| press at | sim DPS added | model added | |
|---|---|---|---|
| 0s | 87.80 | 4888.2 | pull |
| 5s | 91.28 | 5090.0 |  |
| 10s | 91.40 | 5090.0 |  |
| 15s | 91.40 | 5090.0 |  |
| 20s | 91.40 | 5090.0 |  |
| 25s | 91.40 | 5090.0 |  |
| 30s | 91.40 | 5090.0 |  |
| 35s | 91.40 | 5090.0 |  |
| 40s | 85.96 | 4587.3 | clipped by kill |

**Baseline B — passive haste 400**

| press at | sim DPS added | model added | |
|---|---|---|---|
| 0s | 90.38 | 5040.6 | pull |
| 5s | 89.04 | 4964.0 |  |
| 10s | 89.01 | 4964.0 |  |
| 15s | 89.01 | 4964.0 |  |
| 20s | 89.01 | 4964.0 |  |
| 25s | 89.01 | 4964.0 |  |
| 30s | 89.01 | 4964.0 |  |
| 35s | 89.01 | 4964.0 |  |
| 40s | 84.55 | 4577.0 | clipped by kill |

**Baseline C — passive haste 800**

| press at | sim DPS added | model added | |
|---|---|---|---|
| 0s | 16.49 | 903.7 | pull |
| 5s | 0.00 | 0.0 |  |
| 10s | 0.00 | 0.0 |  |
| 15s | 0.00 | 0.0 |  |
| 20s | 0.00 | 0.0 |  |
| 25s | 0.00 | 0.0 |  |
| 30s | 0.00 | 0.0 |  |
| 35s | 0.00 | 0.0 |  |
| 40s | 3.76 | 166.0 | clipped by kill |


## 5. Skull of Gul’dan

+175 haste **rating**.

| duration | cooldown | kind |
|---|---|---|
| 20 s | 2 min | haste |

### Conclusions

Same as Mind Quickening Gem in every respect (h=800: 0.00 steady, 9.67 at 0).

### Data

**Baseline A — passive haste 0**

| press at | sim DPS added | model added | |
|---|---|---|---|
| 0s | 48.96 | 2646.5 | pull |
| 5s | 47.93 | 2590.0 |  |
| 10s | 47.90 | 2590.0 |  |
| 15s | 47.90 | 2590.0 |  |
| 20s | 47.90 | 2590.0 |  |
| 25s | 47.90 | 2590.0 |  |
| 30s | 47.90 | 2590.0 |  |
| 35s | 47.90 | 2590.0 |  |
| 40s | 47.85 | 2430.1 | clipped by kill |

**Baseline B — passive haste 400**

| press at | sim DPS added | model added | |
|---|---|---|---|
| 0s | 47.47 | 2586.1 | pull |
| 5s | 49.03 | 2685.8 |  |
| 10s | 49.09 | 2685.8 |  |
| 15s | 49.09 | 2685.8 |  |
| 20s | 49.09 | 2685.8 |  |
| 25s | 49.09 | 2685.8 |  |
| 30s | 49.09 | 2685.8 |  |
| 35s | 49.09 | 2685.8 |  |
| 40s | 46.60 | 2431.1 | clipped by kill |

**Baseline C — passive haste 800**

| press at | sim DPS added | model added | |
|---|---|---|---|
| 0s | 9.67 | 514.4 | pull |
| 5s | 0.00 | 0.0 |  |
| 10s | 0.00 | 0.0 |  |
| 15s | 0.00 | 0.0 |  |
| 20s | 0.00 | 0.0 |  |
| 25s | 0.00 | 0.0 |  |
| 30s | 0.00 | 0.0 |  |
| 35s | 0.00 | 0.0 |  |
| 40s | 2.13 | 87.9 | clipped by kill |


## 6. Arcane Power

+30 % spell damage (and +30 % mana cost, outside these infinite-mana baselines).

| duration | cooldown | kind |
|---|---|---|
| 15 s | 3 min | damage |

### Conclusions

**Placement does not matter from 3 Arcane Blast stacks onward** — every interior placement is worth the
same, at every baseline.

**Pressed at the pull it is worth materially less**, because a fixed-duration damage buff is worth the
casts it covers and the ramp casts are slower. The size of that penalty moves with baseline: 18.6 DPS
at h=0, 9.9 at h=400, 19.0 at h=800.

**A press at 5 s is already at full value** — the press fires at the next cast boundary, 6.50 s, which
is the first full-stack cast. The penalty is confined to the pull itself.

⚠ Unlike the haste cooldowns, **nothing here changes above the GCD cap.** A damage buff has no cap.

### Data

**Baseline A — passive haste 0**

| press at | sim DPS added | model added | |
|---|---|---|---|
| 0s | 75.08 | 4145.8 | ramp, pull |
| 5s | 93.69 | 5182.3 | ramp |
| 10s | 93.94 | 5182.3 |  |
| 15s | 93.82 | 5182.3 |  |
| 20s | 93.95 | 5182.3 |  |
| 25s | 93.94 | 5182.3 |  |
| 30s | 93.97 | 5182.3 |  |
| 35s | 93.85 | 5182.3 |  |
| 40s | 93.79 | 5182.3 |  |
| 45s | 90.59 | 5010.7 | clipped by kill |

**Baseline B — passive haste 400**

| press at | sim DPS added | model added | |
|---|---|---|---|
| 0s | 103.18 | 5700.5 | ramp, pull |
| 5s | 113.05 | 6218.7 | ramp |
| 10s | 112.91 | 6218.7 |  |
| 15s | 113.02 | 6218.7 |  |
| 20s | 113.01 | 6218.7 |  |
| 25s | 112.95 | 6218.7 |  |
| 30s | 112.88 | 6218.7 |  |
| 35s | 112.91 | 6218.7 |  |
| 40s | 113.00 | 6218.7 |  |
| 45s | 111.48 | 6113.3 | clipped by kill |

**Baseline C — passive haste 800**

| press at | sim DPS added | model added | |
|---|---|---|---|
| 0s | 122.48 | 6736.9 | ramp, pull |
| 5s | 141.50 | 7773.4 |  |
| 10s | 141.39 | 7773.4 |  |
| 15s | 141.52 | 7773.4 |  |
| 20s | 141.41 | 7773.4 |  |
| 25s | 141.38 | 7773.4 |  |
| 30s | 141.41 | 7773.4 |  |
| 35s | 141.49 | 7773.4 |  |
| 40s | 141.46 | 7773.4 |  |
| 45s | 138.41 | 7614.4 | clipped by kill |


## 7. Icon of the Silver Crescent

+155 spell damage.

| duration | cooldown | kind |
|---|---|---|
| 20 s | 2 min | damage |

### Conclusions

Same two facts as Arcane Power, with a smaller pull penalty because the window is longer (20 s, so the
ramp is a smaller share of it): 2.4 DPS at h=0, 2.4 at h=400, 4.7 at h=800. Flat from full stacks
onward at every baseline, and unaffected by the GCD cap.

### Data

**Baseline A — passive haste 0**

| press at | sim DPS added | model added | |
|---|---|---|---|
| 0s | 27.56 | 1600.1 | ramp, pull |
| 5s | 29.96 | 1733.4 | ramp |
| 10s | 29.96 | 1733.4 |  |
| 15s | 29.96 | 1733.4 |  |
| 20s | 29.98 | 1733.4 |  |
| 25s | 29.97 | 1733.4 |  |
| 30s | 29.96 | 1733.4 |  |
| 35s | 29.94 | 1733.4 |  |
| 40s | 29.19 | 1689.3 | clipped by kill |

**Baseline B — passive haste 400**

| press at | sim DPS added | model added | |
|---|---|---|---|
| 0s | 34.59 | 2000.1 | ramp, pull |
| 5s | 36.98 | 2133.5 | ramp |
| 10s | 36.96 | 2133.5 |  |
| 15s | 36.99 | 2133.5 |  |
| 20s | 36.96 | 2133.5 |  |
| 25s | 36.96 | 2133.5 |  |
| 30s | 36.96 | 2133.5 |  |
| 35s | 36.96 | 2133.5 |  |
| 40s | 36.61 | 2106.3 | clipped by kill |

**Baseline C — passive haste 800**

| press at | sim DPS added | model added | |
|---|---|---|---|
| 0s | 41.63 | 2400.1 | ramp, pull |
| 5s | 46.31 | 2666.8 |  |
| 10s | 46.28 | 2666.8 |  |
| 15s | 46.28 | 2666.8 |  |
| 20s | 46.28 | 2666.8 |  |
| 25s | 46.28 | 2666.8 |  |
| 30s | 46.28 | 2666.8 |  |
| 35s | 46.29 | 2666.8 |  |
| 40s | 45.56 | 2625.9 | clipped by kill |


## 8. Serpent-Coil Braid

+225 spell damage, delivered by using a **Mana Emerald** while wearing the belt. ⚠ The item that must be *equipped* (30720) is not the item that is *cast* (22044).

| duration | cooldown | kind |
|---|---|---|
| 15 s | 2 min (Mana Emerald, 3 charges) | damage |

### Conclusions

Same two facts again. ⚠ This is the smallest-value cooldown in the table (≈33 DPS against ~1700 total),
so it has the worst signal-to-noise of any row: its steady-state column wanders ~1 DPS, and that spread
**shrinks with iterations** (2.98 % at 10 k → 1.85 % at 60 k), which is the signature of Monte-Carlo
noise rather than a mechanism. Read it with more iterations or a multi-seed band before drawing a
conclusion from a small difference.

### Data

**Baseline A — passive haste 0**

| press at | sim DPS added | model added | |
|---|---|---|---|
| 0s | 25.71 | 1548.5 | ramp, pull |
| 5s | 32.47 | 1935.6 | ramp |
| 10s | 32.75 | 1935.6 |  |
| 15s | 33.36 | 1935.6 |  |
| 20s | 33.02 | 1935.6 |  |
| 25s | 33.28 | 1935.6 |  |
| 30s | 33.39 | 1935.6 |  |
| 35s | 33.57 | 1935.6 |  |
| 40s | 33.20 | 1935.6 |  |
| 45s | 32.01 | 1871.5 | clipped by kill |

**Baseline B — passive haste 400**

| press at | sim DPS added | model added | |
|---|---|---|---|
| 0s | 35.25 | 2129.2 | ramp, pull |
| 5s | 38.85 | 2322.7 | ramp |
| 10s | 39.60 | 2322.7 |  |
| 15s | 39.36 | 2322.7 |  |
| 20s | 39.74 | 2322.7 |  |
| 25s | 39.98 | 2322.7 |  |
| 30s | 39.85 | 2322.7 |  |
| 35s | 39.60 | 2322.7 |  |
| 40s | 39.91 | 2322.7 |  |
| 45s | 39.43 | 2283.4 | clipped by kill |

**Baseline C — passive haste 800**

| press at | sim DPS added | model added | |
|---|---|---|---|
| 0s | 42.46 | 2516.3 | ramp, pull |
| 5s | 49.41 | 2903.4 |  |
| 10s | 49.97 | 2903.4 |  |
| 15s | 49.95 | 2903.4 |  |
| 20s | 50.02 | 2903.4 |  |
| 25s | 49.94 | 2903.4 |  |
| 30s | 49.74 | 2903.4 |  |
| 35s | 50.04 | 2903.4 |  |
| 40s | 49.84 | 2903.4 |  |
| 45s | 49.15 | 2844.0 | clipped by kill |

---

## Expanding this file

Add baselines; **never edit one in place** — the vectors between them are the point.

1. **Spell power** and **crit**, alone and together.
2. **Haste × spell power**, haste × crit, all three.
3. **Two-cooldown combinations**, then three. This is where the behaviour the planner actually
   optimizes lives — haste stacking into the floor, a damage buff riding a haste window — and none of
   it can appear in a table where each cooldown is alone.

⚠ The generator refuses to print if `index.html` is an older engine (it checks `casts[].frac`), because
a container restart silently rolled this repo back mid-session on 07-28 and a batch of measurements ran
against the pre-boundary-credit scorer before anyone noticed.
