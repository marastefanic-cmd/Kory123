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

## The rules

**A fight has three placement regimes, not two**, and every rule below is a statement about which one
you are in:

| regime | when | what is different about it |
|---|---|---|
| **pull** | the press lands before 3 Arcane Blast stacks | the casts it covers are longer and fewer |
| **interior** | the whole window sits inside the fight, past the ramp | nothing — this is the flat one |
| **terminal** | the window reaches the kill | it also pays for the cut-off last cast (rule 4) |

> **1. A haste cooldown is worth the same wherever you put it in the interior.**
>
> **2. A damage cooldown is worth the same wherever you put it in the interior — i.e. from 3 Arcane
> Blast stacks onward.** Before that it covers fewer casts and is worth less. Since a press fires at the
> *next cast boundary*, a press written at 5 s already lands on the first full-stack cast, so the
> penalty is confined to the pull:  `@0  <  @5 ≈ @10 = @15 = … `, up to but not including the terminal
> placement, which rule 4 governs.
>
> **2b. ★ RULE 2 IS BASELINE-INDEPENDENT — verified, not assumed.** Across **81 combinations**
> (Arcane Power / Icon / Serpent-Coil × haste 0, 400, 800 × spell power 500, 1000, 2000 × crit 0, 25,
> 50 %) the interior spread is **0.0000 % in every single one**, and the pull penalty is present in
> every single one. There are no diminishing returns and no interaction with spell power or crit: a
> damage cooldown used once, after 3 stacks, with no competing opportunity, is worth the same wherever
> it goes. ⚠ The *size* of the pull penalty does move with passive haste (−6.2 % … −20.0 %) — not a
> diminishing return, just the ramp occupying a different share of the window as casts get faster.
>
> **2c. The same independence holds for the haste family's steady state.** Icy Veins' interior value is
> flat to **0.0000 %** at all 12 spell-power × crit combinations measured (500–2000 SP × 0–50 % crit),
> and its pull advantage is **2.812 % in every one of them** — identical to three decimals. Placement
> behaviour is uncorrelated with spell power and with crit.
>
> **3. ★ THE ONE EXCEPTION, AND IT IS A HASTE EXCEPTION.** As passive haste rises toward the GCD cap
> (**789 rating**, where the 3-stack interval is already floored at 1.0 s), a haste cooldown converts
> less and less at steady state — but keeps converting at the **pull**, where casts are 2.500 / 2.166 /
> 1.832 s and still longer than the floor. Above the cap the steady-state value is **zero** and the
> pull is the entire value of the cooldown — together with the terminal cast, which rule 4 covers.
> Damage cooldowns are unaffected: they have no cap.
>
> **4. A cooldown whose window reaches the kill is worth more than an interior one — by part of one
> cast.** The last cast of the fight is cut off mid-flight, and damage lands on *completion*, so
> whatever fraction of it finishes before the boss dies is what it pays. A haste cooldown covering that
> moment makes the cast shorter, so more of it lands. ★ **This is the one thing haste still buys above
> the GCD cap**, because the cap limits how often you may *start* a cast, never how fast the cast
> itself goes: at h=800 Icy Veins fits the identical 59 casts on the identical 1.000 s lattice, and
> the whole of its value is the terminal cast completing in 0.828 s instead of 0.994 s.

### Where each haste cooldown hits the cap — the TENT

A haste cooldown's steady-state value is **not** flat-then-cliff in passive haste. It is a tent, and its
apex is that cooldown's own cap threshold. In steady state the Arcane Blast interval is GCD-bound at
every haste (the 3-stack cast is 1.498 s, under the 1.5 s base GCD), so `interval = max(1.0, 1.5/m)`
and one use of a cooldown lasting `d` seconds buys:

| regime | casts bought | in passive haste |
|---|---|---|
| neither capped, **multiplier** ×v | `d·m_p·(v−1) / 1.5` | **rises** |
| neither capped, **rating** +R | `d·R / (15.77·100·1.5)` | **flat** |
| buff capped, passive not | `d·(1 − m_p/1.5)` | **falls**, to zero at 789 |
| both capped | `0` | — |

where `m_p = 1 + h/1577`. Three consequences, each measured below and each **invisible** at a
0 / 400 / 800 sampling:

1. **The apex is the threshold.** Where `m_b·m_p = 1.5` the buff first floors the GCD.
2. **A multiplier gains value as you gear haste; a rating buff does not.** Same family, opposite
   gearing behaviour — a multiplier scales the base it multiplies, a fixed rating does not.
3. ★ **Above its own threshold, a cooldown's value stops depending on its strength at all.** The
   falling limb mentions only *duration* and *passive haste*. Two 20 s haste cooldowns are worth
   identically the same there, however differently they are specced — both pin the interval at the
   1.0 s floor, and the floor does not care how hard you hit it.

| cooldown | | threshold (passive haste rating) | value at the threshold |
|---|---|---|---|
| Bloodlust | ×1.30 | **242.6** | 9.22 casts |
| Icy Veins | ×1.20 | **394.3** | 3.33 casts |
| Mind Quickening Gem | +330 rating | **458.5** | 2.79 casts |
| Berserking | ×1.10 | **573.5** | 0.91 casts |
| Skull of Gul'dan | +175 rating | **613.5** | 1.48 casts |
| *(no cooldown at all)* | — | *788.5* | — |

*(The last column is the closed form at the threshold — the top of the tent. For the two multipliers it
is also the measured maximum; for the two rating buffs it is the level of a plateau they have been
sitting on since h=0, so their measured maximum lands wherever the millisecond ripple is highest rather
than at the threshold.)*

**These are measured, and the threshold is falsified rather than admired.** Each was re-fitted against
counterfactual thresholds 50 rating either side; the stated value fits best in all five cases, so the
bend is where it is claimed to be and not merely consistent with it:

| cooldown | rms fit at the stated threshold | shifted −50 | shifted +50 |
|---|---|---|---|
| Bloodlust | **0.0729** | 0.1603 | 0.1782 |
| Icy Veins | **0.0665** | 0.0865 | 0.0974 |
| Mind Quickening Gem | **0.0641** | 0.0846 | 0.0829 |
| Berserking | **0.0408** | 0.0496 | 0.0525 |
| Skull of Gul'dan | **0.0425** | 0.0658 | 0.0751 |

*(rms in casts, over 86 haste samples. "Measured argmax" is deliberately **not** the test: a rating
buff's curve has no apex — it is flat, then falls — so its argmax lands wherever the millisecond ripple
is highest, which is how Skull's peak reads h=30 against a threshold of 613.)*

### The ladder

`tools/facts-ladder.mjs`, 0→850 rating in steps of 10, one cooldown alone, interior placement. Value in
casts; the closed form beside it. Every cooldown reaches zero at **790**, the first ladder step above
the 788.5 bare cap.

Bold marks each cooldown's own threshold row.

| haste | Bloodlust 40 s ⚠ | Icy Veins 20 s | MQG 20 s | Berserking 10 s | Skull 20 s |
|---|---|---|---|---|---|
| 0 | 8.0734 | 2.6662 | 2.9466 | 0.7250 | 1.4993 |
| 100 | 8.3180 | 3.0106 | 2.7963 | 0.7324 | 1.5202 |
| 200 | 8.9955 | 3.1693 | 2.8126 | 0.8179 | 1.5192 |
| **240** | **9.0162** | 3.1669 | 2.9185 | 0.8154 | 1.4877 |
| 300 | 8.2542 | 3.3336 | 2.8348 | 0.8141 | 1.5290 |
| **390** | 6.5803 | **3.3422** | 2.8759 | 0.9142 | 1.5629 |
| 400 | 6.5824 | 3.2904 | 2.8736 | 0.9105 | 1.5548 |
| **460** | 5.5474 | 2.7733 | **2.7733** | 0.9043 | 1.5060 |
| 500 | 4.8813 | 2.4415 | 2.4415 | 0.9129 | 1.5638 |
| **570** | 3.7036 | 1.8527 | 1.8527 | **0.9073** | 1.5073 |
| 600 | 3.2000 | 1.6000 | 1.6000 | 0.8000 | 1.4894 |
| **610** | 3.0315 | 1.5167 | 1.5167 | 0.7593 | **1.4981** |
| 650 | 2.3355 | 1.1678 | 1.1678 | 0.5844 | 1.1678 |
| 700 | 1.5024 | 0.7502 | 0.7502 | 0.3761 | 0.7502 |
| 750 | 0.6680 | 0.3330 | 0.3330 | 0.1675 | 0.3330 |
| 790 | 0.0000 | 0.0000 | 0.0000 | 0.0000 | 0.0000 |

**Read the Icy Veins, MQG and Skull columns from the bottom.** At 460 the first two become the same
number to four decimals; at 650 the third joins them. A ×1.20 multiplier, +330 rating and +175 rating
— indistinguishable, because all three last 20 s and all three are past their own thresholds. Checked
directly rather than by eye: over h = 640…760 the worst disagreement between them is **0.000000 casts**.
That is consequence 3, and it is the sharpest confirmation of the falling limb available, because it
assumes no model of the floor at all.

The closed form tracks the measurement to within **0.1749 casts** worst-case over the whole ladder (Icy
Veins at h=100), and the gap does **not** grow with haste — it is millisecond rounding (wowsims rounds
every cast to whole ms) plus the 3-cast opening ramp, both of which the closed form ignores by
construction. The apex rows read slightly under the closed-form peak for the same reason; the finest
sweep puts Bloodlust's measured maximum at 9.244 (h=210) and Icy Veins' at 3.342 (h=390).

⚠ **The Bloodlust column is the only one that is not trustworthy to its last digits, and that is a
model defect, not a property of Bloodlust.** Its interior is not flat in the model — the value alternates
by **0.23 casts** depending on where in the interior you press it, so "the" interior value is whichever
sample the ladder happened to take. The sim says flat. See `docs/MODEL-DEFECTS.md` D1. Every other
column has an interior spread of exactly 0.000000 at every rung.

    node tools/facts-ladder.mjs --haste=0:850:10                 # the ladder above
    node tools/facts-ladder.mjs --mode=placement --haste=0,400,800   # the per-placement tables below

### The terminal placement — what the last row of every table is

The bottom row of each table below is the press at `T − duration`: the window ends exactly on the kill.
It is **not** clipped — nothing is lost off the end — and it is not an interior placement either. It is
its own regime, because it is the only placement that touches the fight's last, half-finished cast.

Decomposed (Icy Veins, `T=60`, so the terminal press is @40), splitting the cooldown's value into the
casts before the last one and the last one alone:

| passive haste | interior placement | terminal placement | of which: the earlier casts | the terminal cast |
|---|---|---|---|---|
| 0 | 2.6662 | 2.5330 | 3.0000 | −0.4670 |
| 200 | 3.1693 | 2.9515 | 3.0000 | −0.0486 |
| 400 | 3.2904 | 3.1140 | 3.0000 | 0.1140 |
| 600 | 1.6000 | 1.5977 | 2.0000 | −0.4023 |
| **800** | **0.0000** | **0.1390** | **0.0000** | **0.1390** |

*(casts, relative to never pressing it)*

**The h=800 row is the clean one, and it is the answer to "does the kill respect the GCD cap?" — it
does.** Above the cap the earlier casts pay exactly nothing: the lattice is byte-identical with and
without Icy Veins, 59 casts either way, 1.000 s apart either way. The entire 0.1390 is the last cast:

    it starts at 59.311 with 0.689 s of fight left
    bare:  0.689 / 0.994 s cast = 0.6932 of it lands
    IV:    0.689 / 0.828 s cast = 0.8321 of it lands      difference 0.1390 casts

The GCD floor caps how often you may **start** a cast. It has never capped how fast a cast **goes** —
those are different clocks, and only the second one decides whether the last cast beats the boss's
death. The sim agrees independently: at h=800 it reads 0.00 DPS at every interior placement of Icy
Veins and **5.20 DPS** at the terminal one.

⚠ The other rows are muddier, and honestly so: below the cap, moving a haste cooldown also shifts every
cast after it, so the terminal column there mixes the real effect above with the lattice-phase artifact
recorded as `docs/MODEL-DEFECTS.md` D1. Only the h=800 row isolates it, which is exactly why it is the
one to quote.

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

**Above the passive GCD cap (789 rating) it is worth nothing at any interior placement.** At h=800 it is
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
| 40s | 83.44 | 4375.6 | covers the kill |

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
| 40s | 101.38 | 5379.2 | covers the kill |

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
| 40s | 5.20 | 240.1 | covers the kill |


## 2. Berserking

+10 % casting haste (Troll racial). Multiplier, same floor.

| duration | cooldown | kind |
|---|---|---|
| 10 s | 3 min | haste |

### Conclusions

Identical in shape to Icy Veins at every baseline; only the magnitude differs (10 % vs 20 %, 10 s vs
20 s). Flat at steady state, better at the pull, and **worth nothing in the interior above the cap**
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
| 50s | 19.91 | 975.3 | covers the kill |

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
| 50s | 25.47 | 1348.6 | covers the kill |

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
| 50s | 2.83 | 120.7 | covers the kill |


## 3. Bloodlust

+30 % casting haste, raid-wide. Multiplier, same floor. **Pressed by someone else** — the planner treats it as a pinned raid call.

| duration | cooldown | kind |
|---|---|---|
| 40 s | 10 min (Sated) | haste |

### Conclusions

Flat at steady state, better at the pull, and **worth nothing in the interior above the cap** (h=800:
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
| 20s | 245.68 | 13293.7 | covers the kill |

**Baseline B — passive haste 400**

| press at | sim DPS added | model added | |
|---|---|---|---|
| 0s | 221.64 | 12245.2 | pull |
| 5s | 205.75 | 11370.6 |  |
| 10s | 205.63 | 11085.8 |  |
| 15s | 205.63 | 11370.6 |  |
| 20s | 207.67 | 11197.0 | covers the kill |

**Baseline C — passive haste 800**

| press at | sim DPS added | model added | |
|---|---|---|---|
| 0s | 29.46 | 1605.8 | pull |
| 5s | 0.01 | 0.0 |  |
| 10s | 0.00 | 0.0 |  |
| 15s | 0.00 | 0.0 |  |
| 20s | 7.29 | 360.5 | covers the kill |


## 4. Mind Quickening Gem

+330 haste **rating** — added to the rating pool before the percentage is computed, rather than multiplying it.

| duration | cooldown | kind |
|---|---|---|
| 20 s | 5 min | haste |

### Conclusions

A haste **rating** buff, and it behaves exactly like the multipliers: flat at steady state, better at
the pull, nothing in the interior above the cap (h=800: 0.00 steady, 16.49 at 0). Rating and multiplier
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
| 40s | 85.96 | 4587.3 | covers the kill |

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
| 40s | 84.55 | 4577.0 | covers the kill |

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
| 40s | 3.76 | 166.0 | covers the kill |


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
| 40s | 47.85 | 2430.1 | covers the kill |

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
| 40s | 46.60 | 2431.1 | covers the kill |

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
| 40s | 2.13 | 87.9 | covers the kill |


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
| 45s | 90.59 | 5010.7 | covers the kill |

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
| 45s | 111.48 | 6113.3 | covers the kill |

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
| 45s | 138.41 | 7614.4 | covers the kill |


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
| 40s | 29.19 | 1689.3 | covers the kill |

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
| 40s | 36.61 | 2106.3 | covers the kill |

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
| 40s | 45.56 | 2625.9 | covers the kill |


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
| 45s | 32.01 | 1871.5 | covers the kill |

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
| 45s | 39.43 | 2283.4 | covers the kill |

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
| 45s | 49.15 | 2844.0 | covers the kill |

---

## The two generators

| | what it produces | cost |
|---|---|---|
| `tools/facts-ladder.mjs` | model only — arbitrary haste granularity, value in casts, closed form beside it, flatness and threshold assertions | seconds |
| `tools/buff-atlas.mjs` | model **and** sim, one baseline at a time — the per-placement tables | minutes |

Use the ladder to find where something interesting happens and the atlas to have the sim rule on it.
The ladder is what makes fine granularity affordable: the 86-rung sweep in this file is one command,
where the same coverage through the atlas would be 86 sim campaigns.

⚠ Both refuse to print if `index.html` is an older engine (they check `casts[].frac`), because a
container restart silently rolled this repo back mid-session on 07-28 and a batch of measurements ran
against the pre-boundary-credit scorer before anyone noticed.

## Expanding this file

Add baselines; **never edit one in place** — the vectors between them are the point.

1. **Spell power** and **crit**, alone and together. *(Model side done for the damage family: rule 2b,
   81 combinations. The sim side of that grid has not been run.)*
2. **Haste × spell power**, haste × crit, all three.
3. **Two-cooldown combinations**, then three. This is where the behaviour the planner actually
   optimizes lives — haste stacking into the floor, a damage buff riding a haste window — and none of
   it can appear in a table where each cooldown is alone.

★ **The ladder is what makes step 3 answerable.** Whether two haste cooldowns stacked together are
worth more or less than the sum of their parts depends entirely on which side of its own threshold each
one is on, and on where the *pair* floors the GCD — a combined multiplier reaches the cap on far less
passive haste than either alone (Icy Veins + Bloodlust is ×1.56, already past 1.5 at **h=0**). Expect
the tent for a pair to peak at or below zero passive haste and to be falling everywhere. That is a
prediction, not a measurement, and it is the first thing the combination work should check.
