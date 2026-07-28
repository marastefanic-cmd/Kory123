# ESTABLISHED FACTS — how each cooldown behaves

Measured, reproducible behaviour of every cooldown, one at a time. **This file records facts only.**
Where the planner's model fails to reproduce one, that is written down in
`docs/MODEL-DEFECTS.md` instead — a fact and a bug are different kinds of statement and mixing them
makes both harder to trust.

User, 2026-07-28: *"observe the behavior of each singular buff at different haste levels, then in
combination with other buffs… so they are referencable and testable whether our model follows them."*

## Scope, and how this file is laid out

**Part I** is **one cooldown, alone, on an otherwise bare fight** — nothing overlaps anything. It
establishes how each cooldown behaves **around Arcane Blast stacks and the GCD floor, and nothing
else**. **Part II** adds the second cooldown, which is where *alignment* — the thing the planner is
actually for — first appears. **Part III** adds the third, and finds no new rule: the composition table
extends by inclusion–exclusion.

Read Part I first: every Part II result is stated as a deviation from it, and the interaction term is
only meaningful because each cooldown alone is already known to be interior-flat.

# Part I — one cooldown at a time

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
> **2b. ★★ PLACEMENT IS UNCORRELATED WITH SPELL POWER AND WITH CRIT — verified across 1224 cells, for
> BOTH families, at 17 passive-haste levels.** All eight cooldowns × haste 0→800 in steps of 50 ×
> spell power 500 / 1000 / 2000 × crit 0 / 25 / 50 %:
>
> | | worst spread over all 1224 cells |
> |---|---|
> | interior flat? | **0.000000 casts** — every cooldown except Bloodlust (rule 5) |
> | pull cost independent of SP and crit? | **0.000000** |
>
> There are no diminishing returns and no interaction with either stat. This is not a coincidence, it
> is what placement *is*: spell power and crit change what a cast is **worth**; they never change
> **when** casts happen, and placement is a question about when. Crit cancels outright (it multiplies
> the cooldown's value and the plain cast alike).
>
> ⚠ **Quote the pull cost as a fraction of the cooldown's own value, not in plain casts.** The two
> differ for a flat +SP buff and only one of them is baseline-independent. Serpent-Coil's pull penalty
> is exactly **two covered casts** at every baseline — but one covered cast of a +225 SP buff is worth
> `0.714286 × 225 / (720 + 0.714286 × SP)` = **0.1492** plain casts at 500 SP and **0.0748** at 2000,
> so the same structural fact reads as a 2× "dependence" in the wrong unit. It is the unit moving, not
> the fact. (Measuring in plain casts is what made this rule appear to fail at `scb@h800`.)
>
> ⚠ The *size* of the pull penalty does move with passive haste — but only as an integer ratio of
> covered casts. Arcane Power reads exactly −1/5, −1/10, −2/11, −1/11, −1/6, −1/12, −2/13, −1/13,
> −1/7, −1/14, −2/15 as haste rises: `−(casts missed)/(casts covered)`, and the ramp occupies a
> different number of cast slots as casts get faster. No spell power or crit anywhere in it.
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
>
> **5. A RAID EXTERNAL behaves differently from a self-press, and this is the one place the two
> families genuinely part.** A cooldown you press yourself cannot go off mid-cast, so its window
> begins at your next cast boundary and runs its full duration from there. **Bloodlust does not wait
> for you.** The shaman's cast completes, the aura lands, and its 40 s expires 40 s later whatever you
> were doing — so the part of the window you spend finishing your in-flight cast is window you paid
> for and cannot use:
>
>     usable = [call + slip, call + 40]        slip = the wait to your next cast boundary
>     covered = floor((40 − slip) / 1.1538) + 1  = 35 while slip ≤ 0.769 s at h=0, else 34
>
> The buff never speeds up a cast already in flight — haste is snapshot at cast start. That is exactly
> why the slip is lost rather than recovered. ⇒ **A raid external's value depends on the sub-cast phase
> of the call**, alternating between two adjacent cast counts, where a self-press does not.
>
> ⛔ The sim **cannot measure this** — its Bloodlust is an APL `castSpell`, so the aura can only begin
> at one of the mage's own action opportunities and `slip` is structurally zero. A placement sweep in
> wowsims returns 1462.30 DPS at *every* sub-cast offset, identical to the last digit. `docs/TOOLING.md`
> carries the full write-up; do not read that flatness as the sim disagreeing with the model.

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

⚠ **The Bloodlust column is the only one whose last digits depend on where the ladder sampled, and that
is rule 5, not an error.** Being a raid external its window is anchored to the *call*, so its value
alternates by **0.23 casts** between two adjacent covered-cast counts as the call moves across a cast
period; "the" interior value is whichever phase the sample landed on. Every other column — all
self-presses, all snapping to a cast boundary — has an interior spread of exactly 0.000000 at every
rung. ⛔ The sim reads this column flat, and that is a harness limitation rather than a contradiction
(`docs/TOOLING.md`).

    node tools/facts-ladder.mjs --haste=0:850:10                 # the ladder above
    node tools/facts-ladder.mjs --mode=grid   --haste=0:800:50   # the SP × crit independence check
    node tools/facts-ladder.mjs --mode=placement --haste=0,400,800   # the per-placement tables below

### ★ Where the PULL takes over — and it is the same threshold

The tent describes the *interior* value. The **pull** value has its own curve, and the two cross at the
same place. Below a cooldown's threshold the pull is worth a hair more than the interior and that
margin barely moves; from the threshold onward it climbs without bound, because the interior is
draining to zero while the pull — where casts are still 2.500 / 2.166 / 1.832 s — is not.

Icy Veins (threshold **394.3**), as a fraction of the cooldown's own value:

| passive haste | interior (casts) | pull (casts) | pull worth |
|---|---|---|---|
| 300 | 3.3336 | 3.2216 | −3.4 % |
| 350 | 3.3393 | 3.3940 | +1.6 % |
| **390** | **3.3422** | 3.3963 | +1.6 % |
| 400 | 3.2904 | 3.3531 | +1.9 % |
| 450 | 2.8635 | 3.0112 | +5.2 % |
| 500 | 2.4415 | 2.6746 | +9.5 % |
| 600 | 1.6000 | 2.0820 | +30.1 % |
| 700 | 0.7502 | 1.3607 | +81.4 % |
| 750 | 0.3330 | 1.0059 | +202 % |
| 780 | 0.0798 | 0.7894 | +889 % |
| **789** | **0.0000** | 0.7204 | the pull is the **whole** cooldown |

The interior column peaks at 390 and falls from 400 — the tent apex. The pull column is flat-ish
through 400 and then rises monotonically at every single rung. So the user's prediction (07-28) —
*"the only observable difference in behavior starts to happen at passive haste's level where Icy Veins
+ passive haste + 3 Arcane Blast stacks = GCD cap, where Icy Veins is pushed to start @0"* — is
confirmed, at **394.3** rather than the remembered 389.

⚠ The residual **+2.1 %** the pull carries *below* the threshold is not explained by any of this, and
is filed as an open question in `docs/MODEL-DEFECTS.md`. It is small (0.0554 casts) and it does not
grow, but it should be zero by the arithmetic. **The figure was 2.812 % until 07-28** — that version
averaged the *terminal* placement into the interior baseline, which rule 4 now says is a different
regime; excluding it gives 2.078 %.

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

---

# Part II — two cooldowns at a time

Everything above is one cooldown alone, which is deliberately blind to the thing the planner actually
optimizes: **alignment**. This part adds the second cooldown, and one number carries all of it.

## The combination law

    interaction(a, b)  =  V(both)  −  V(a alone)  −  V(b alone)

Zero means the two are independent and may be placed separately. Everything the planner is *for* lives
in the cases where it is not zero.

> ### ★ THE LAW, for a HASTE cooldown paired with a VALUE cooldown
> *(one of four — the full set is the composition table below)*
>
>     interaction = Δ(casts the value buff covers) × s
>
>     where  Δ(covered) = casts it covers WITH the haste buff − casts it covers WITHOUT
>            s          = the value buff's per-cast bonus, relative to a plain Arcane Blast
>                       = COEF·ΔSP / (AVG_BASE + COEF·SP)     for a +spell-power buff
>                       = value − 1                            for a damage multiplier
>
> The haste cooldown does not make the value cooldown *stronger*; it makes it cover **more casts**.
> That is the whole of the interaction, and `Δ(covered)` is always a **whole number** away from a
> boundary — you cannot cover two-thirds of a cast.
>
> ⚠ **Count the covered casts at COMPLETION, and read them off the board, not off the clock.** A value
> buff applies over `(auraStart, auraStart + dur]` measured at each cast's *completion*, and `auraStart`
> is the next cast boundary after the press — which the haste cooldown itself moves. Reconstructing the
> window by hand from the press time gives the wrong count (it did here, twice); `casts[].sp` records
> what the model actually applied.

> ### ★★ THE GENERALISATION BACK INTO THE SINGLES — per point of temporary spell power
>
>     d(interaction) / d(ΔSP)  =  Δ(covered) · COEF / (AVG_BASE + COEF·SP)
>
> A haste cooldown gains this much per 1 point of temporary spell power it is overlaid with. It is
> **symmetric** and may be read from either end — the haste cooldown is worth more because the extra
> casts it creates are worth more, or the value buff is worth more because it covers more casts. Same
> number, and there is no third effect.
>
> Note what is and is not in it: `Δ(covered)` depends on passive **haste** and on the two durations;
> the denominator depends on passive **spell power**. Crit appears nowhere — it scales the cooldown and
> the plain cast alike and cancels, exactly as in rule 2b.

## ★★★ THE COMPOSITION TABLE — it does not matter WHICH spell, only by how much

User, 2026-07-28: *"from this point onwards it shouldn't really matter what spell or what effect is the
one modifying the haste or damage side of the equation, just by how much."* That is right, and the
table below is the whole of it. **Which rule applies is decided by where the modifier sits in the damage
formula**, not by the cooldown's name, icon, or which "family" a doc filed it under:

    dmg = (AVG_BASE + COEF · sp) · critFactor · dmgMult          per cast
    interval = max(GCD_FLOOR, GCD_BASE / m)                       how many casts

| modifier | where it acts | reduce it to |
|---|---|---|
| +N spell power | inside the bracket | `s = COEF·N / (AVG_BASE + COEF·SP)` |
| ×v damage | multiplies everything | `s = v − 1` |
| ×v haste | the interval | `v` |
| +R haste rating | the interval | `v = (1 + (h+R)/1577) / (1 + h/1577)` |
| crit | multiplies everything | **nothing — it cancels** |

Then every pair follows one of four rules, and no cooldown identity survives into any of them:

| pair | interaction | sign |
|---|---|---|
| **sp × sp** | `0` — exactly, always | none |
| **dmg × sp**, **dmg × dmg** | `n × s₁ × s₂` | always **+** |
| **haste × value** | `Δ(covered) × s` | always **+** |
| **haste × haste** | `d·[1/i(v₁v₂m) + 1/i(m) − 1/i(v₁m) − 1/i(v₂m)]` | **+** below the pair threshold, **−** above |

Three things follow that are worth stating out loud, because each one contradicts a natural guess:

1. **Two spell-power buffs cannot interact** — spell power is additive inside the bracket, so two
   deltas are one bigger delta. (P2, measured `0.000000` everywhere.)
2. **Arcane Power is not a spell-power buff.** It is a damage *multiplier*, so it multiplies the
   spell-power bonus too and does interact with Icon and Serpent-Coil. Filing it with them under
   "value cooldowns" gets this backwards. (P3.)
3. **Only haste × haste can be negative**, and it is the only rule with a threshold in it — because it
   is the only one where the GCD floor can refuse to spend what you bought. (P4.)

⇒ **To price a cooldown this corpus has never seen, you need three numbers and no lore**: its duration,
which of the two clocks it moves, and by how much.

## P1. Icy Veins + Icon of the Silver Crescent

+20 % casting haste (20 s) with +155 spell power (20 s). Equal durations, so "aligned" means pressing
both at the same second.

### Conclusions

**Overlapping wins, and it is worth about a sixth of a cast.** At h=0 / 1000 SP the best aligned layout
beats the best disjoint one by **0.1762 casts** (+0.42 % of the fight). **Sim-confirmed**: +0.389 %
measured against +0.416 % modelled, and +0.705 % against +0.731 % on the other disjoint arrangement —
both agreeing to 0.03 pp against a ±0.035 % seed band.

**Below Icy Veins' cap threshold, press them at the same moment, as early as 3 stacks allow.** Every
aligned interior placement from @5 to @35 is *identical* (3.9013 casts at h=0/1000 SP) and every one of
them beats every non-aligned layout. The interaction is exactly **3.000 × s** at all of them.

**Above the threshold Icy Veins moves to the pull and Icon stays at 3 stacks** — `IV@0 + Icon@5`. This
is the layout the planner should produce at high haste, and it is *not* an abandonment of the overlap:
two 20 s windows 5–6 s apart still share 15 s, so moving Icy Veins to the pull surrenders **exactly one
covered cast**, not the whole interaction.

**The breakpoint moves DOWN as passive spell power rises**, because a fixed +155 is worth relatively
less on a bigger base, so there is less reason to stay aligned with it.

### The exact trade

Moving Icy Veins from aligned to the pull is worth, in casts:

    margin = (Icy Veins' own pull advantage)  −  Δ(covered) × s
           = 0.0544                           −  1 × s              at h=340

Measured at h=340 against the closed form, and the surrendered coverage is **1.000 covered cast** at
every spell power:

| passive SP | s | Icon-covered casts, aligned → pulled | predicted margin | measured margin |
|---|---|---|---|---|
| 500 | 0.10279 | 19.000 → 18.000 | −0.0484 | **−0.0484** |
| 1000 | 0.07719 | 19.000 → 18.000 | −0.0228 | **−0.0228** |
| 2000 | 0.05153 | 19.000 → 18.000 | +0.0029 | **+0.0029** |
| 4000 | 0.03095 | 19.000 → 18.000 | +0.0234 | **+0.0234** |

(negative = stay aligned). Four decimals, four spell powers. Setting the margin to zero gives the
break-even directly: at h=340 it is **1841 passive spell power**.

### Breakpoints

Where `IV@0 + Icon@t` first beats `IV@t + Icon@t`, brute-forced on a 1 s press grid:

| passive SP | s | Icy Veins leaves the interior at |
|---|---|---|
| 500 | 0.10279 | **h = 425** |
| 1000 | 0.07719 | **h = 410** |
| 2000 | 0.05153 | below the threshold — see the warning |
| 4000 | 0.03095 | below the threshold — see the warning |

Above the breakpoint the margin grows monotonically and without competition: at 1000 SP it is +0.006
casts at h=410, +0.056 at 440, +0.24 at 550, +0.53 at 700.

⚠ **Below Icy Veins' 394.3 threshold this comparison is not stable, and that instability is a model
artifact rather than a fact about the game.** The margin there is `residual − s`, where `residual` is the ~0.0544-cast pull advantage the
model shows below every threshold and that the arithmetic says should be zero
(`docs/MODEL-DEFECTS.md`, open question). So:

* at 500 and 1000 SP, `s` comfortably exceeds the residual and aligned wins cleanly at every rung —
  the answer is stable and correct;
* at 2000 SP `s ≈ residual` and the model's answer **flips back and forth in bands** as passive haste
  moves (aligned at 200–220 and 300–320, pulled at 150–190, 230–290, 330+), with the pulled margins at
  ~0.003 casts and the aligned ones at ~0.16;
* at 4000 SP the residual wins outright and the model prefers the pull everywhere.

⇒ **The SP-dependence of the breakpoint is real and its direction is confirmed. Its exact location at
high passive spell power is currently decided by the unexplained residual**, and should be re-measured
once that is settled. It is the first time the residual has been seen choosing a *pair* layout rather
than nudging a single one.

### Data

`node tools/facts-pair.mjs --a=icyVeins --b=isc --haste=0 --sp=1000 --step=5`

Aligned diagonal at h=0 / 1000 SP (`s = 0.07719`) — press both at @t:

| t | pair (casts) | interaction | interaction / s | regime |
|---|---|---|---|---|
| 0 | 3.8023 | 0.1544 | **2.000** | pull |
| 5 | 3.9013 | 0.2316 | **3.000** | interior |
| 10 | 3.9013 | 0.2316 | **3.000** | interior |
| 15 | 3.9013 | 0.2316 | **3.000** | interior |
| 20 | 3.9013 | 0.2316 | **3.000** | interior |
| 25 | 3.9013 | 0.2316 | **3.000** | interior |
| 30 | 3.9013 | 0.2316 | **3.000** | interior |
| 35 | 3.9013 | 0.2316 | **3.000** | interior |
| 40 | 3.7065 | 0.1955 | 2.533 | terminal |

The three placement regimes of Part I reappear in the *interaction*: whole in the interior, one cast
smaller at the pull (the ramp casts are long, so Icy Veins creates fewer extra casts inside a 20 s
window), and fractional at the kill (boundary credit).

Covered-cast counts behind the interior row, read off `casts[].sp` — Icon covers **13** casts alone and
**16** with Icy Veins, at every interior placement.

And the interaction is exactly `3 × s` at every spell power, which is the generalisation stated as a
measurement rather than a derivation:

| passive SP | s | interaction | interaction / s | per 1 temporary SP |
|---|---|---|---|---|
| 500 | 0.10279 | 0.30836 | 3.0000 | 1.9894e−3 |
| 750 | 0.08817 | 0.26451 | 3.0000 | 1.7065e−3 |
| 1000 | 0.07719 | 0.23157 | 3.0000 | 1.4940e−3 |
| 1500 | 0.06180 | 0.18541 | 3.0000 | 1.1962e−3 |
| 2000 | 0.05153 | 0.15459 | 3.0000 | 9.9734e−4 |
| 3000 | 0.03867 | 0.11602 | 3.0000 | 7.4850e−4 |

⚠ The continuous closed form `N × s` — Icy Veins' own interior value times `s` — predicts 2.6662 × s
and is **11 % low**. `Δ(covered)` is an integer (3), not `N` (2.6662): the fight is a lattice of whole
casts, and a 20 s window either does or does not contain a cast. Use the integer.

## P2. Icon of the Silver Crescent + Serpent-Coil Braid — `sp × sp`

**Interaction is exactly 0.000000**, at every passive haste and every passive spell power measured.
Two spell-power buffs cannot interact, and the reason is one line of the damage formula: spell power
enters as `(AVG_BASE + COEF·sp)`, so two deltas on the same cast are just **one bigger delta**. There is
no cross term to find.

⇒ **Place them independently.** Each maximizes itself — which by rule 2 means each goes as soon as 3
Arcane Blast stacks are up — and neither placement constrains the other. Confirmed at haste 0 and 400
× spell power 500, 1000, 2000: `−0.000000` in all six.

## P3. Arcane Power + a spell-power buff — `dmg × sp`

★ **Arcane Power is NOT a spell-power buff, and this is where the difference shows.** It multiplies
damage (`×1.30`) rather than adding spell power, so it multiplies the spell-power bonus as well:

    per cast under both  =  1.30 × (1 + s)  =  1.30 + 1.30·s
    sum of the parts     =  0.30 + s
    interaction          =  n × 0.30 × s          ← a real, positive cross term

Measured at h=0, and the covered count comes out an exact integer at every spell power:

| passive SP | s (Icon) | interaction | ÷ (0.3 × s) |
|---|---|---|---|
| 500 | 0.10279 | 0.30836 | **10.000** |
| 1000 | 0.07719 | 0.23157 | **10.000** |
| 2000 | 0.05153 | 0.15459 | **10.000** |

⇒ **Arcane Power wants to overlap with your spell-power cooldowns**, even though those cooldowns do not
care about each other (P2). Grouping it with Icon or Serpent-Coil under one "value family" heading is
the natural mistake and it is wrong: the family that matters is *where in the damage formula the
modifier sits*, not whether we call it a damage cooldown.

## P4. The haste × haste family

**There is no `s` here** — neither cooldown changes what a cast is worth, so the interaction is entirely
about the GCD floor. Two haste multipliers compound, and what happens depends on whether the compounded
multiplier is still under the floor:

    interaction = d · [ 1/i(v₁v₂·m_p) + 1/i(m_p) − 1/i(v₁·m_p) − 1/i(v₂·m_p) ]
    where  d = the shorter duration,  i(m) = max(1.0, 1.5/m)

Uncapped this is `d·m_p·(v₁−1)(v₂−1)/1.5` — **positive**, the ordinary multiplicative bonus for stacking
haste. Once the *pair* floors the GCD the first term is clipped to `d` and the expression **turns
negative**: you are paying for haste the floor will not let you spend.

> ### ★★ THE PAIR THRESHOLD, AND WHY IT IS THE ONE THAT MATTERS
> A pair floors the GCD at `v₁·v₂·m_p = 1.5`, so its threshold is roughly **each cooldown's own
> threshold divided by the other's multiplier** — always far lower than either alone. Two haste
> cooldowns stop wanting to overlap **long before** either one stops being useful by itself.

| pair | pair threshold | their own thresholds | interaction h=0 | interaction h=400 |
|---|---|---|---|---|
| Icy Veins + Bloodlust | **−61** | 394 / 243 | +0.0788 | **−3.2904** |
| Bloodlust + MQG | **−87** | 243 / 459 | −0.2016 | −2.8736 |
| Icy Veins + MQG | **64** | 394 / 459 | +0.6008 | −2.8736 |
| Bloodlust + Skull | **68** | 243 / 614 | +0.4953 | −1.5548 |
| Berserking + Bloodlust | **77** | 573 / 243 | +0.2056 | −0.9105 |
| Icy Veins + Berserking | **215** | 394 / 573 | +0.1255 | −0.9105 |
| Icy Veins + Skull | **219** | 394 / 614 | +0.3338 | −1.5548 |
| Berserking + MQG | **243** | 573 / 459 | −0.0534 | −0.7013 |
| MQG + Skull | *284* | 459 / 614 | *cannot overlap* | *cannot overlap* |
| Berserking + Skull | **398** | 573 / 614 | +0.1128 | −0.0017 |

**At h=400 every single haste × haste pair is negative, and the aligned layout loses outright.** Icy
Veins on Bloodlust costs **3.29 casts** there. This is the general form of the rule this project already
had as "Icy Veins slides out of Lust with gear" (RULES §3) — it is not special to those two cooldowns
and it is not special to Lust.

**Your assumption confirmed: haste × haste varies with passive haste and with nothing else.** Across
haste 0 / 200 / 400 / 600 × spell power 500 / 1000 / 2000 × crit 0 / 25 / 50 %, the interaction's spread
over the 9 spell-power × crit combinations is **0.00000000 casts** at every haste, for every pair tested.

⚠ **The closed form gets the sign right for 7 of the 9 measurable pairs at h=0 and the magnitude to
~0.1 casts, but it is a continuous approximation of a discrete lattice and it does miss.** Icy Veins +
Bloodlust is a boundary case (it predicts exactly 0.0000 and measures +0.0788), and Berserking + MQG
predicts +0.1395 against a measured −0.0534. Both misses are on 10 s windows where one whole cast is
~0.14 casts of interaction — i.e. both are inside one cast's quantization of zero. **Use the table, not
the formula, when the predicted value is small.**

⚠ Every Bloodlust row also carries rule 5's caveat: as a raid external its window is anchored to the
call, so its exact interaction depends on the sub-cast phase and the sim cannot arbitrate it.

## P5. Icy Veins × Lust and Berserking × Lust, with Lust PINNED

The general `haste × haste` rule (P4) treats both presses as free. In every real fight Bloodlust is a
**pinned raid call**, which turns the question into a different and more useful one: *given that Lust
is at a fixed second, where does my own haste cooldown go?* Measured on a 1:40 fight with Lust pinned
at 0:07 (so it covers 7–47 s), 1387 SP, 38 % crit, value in casts above "Lust alone":

### Icy Veins (20 s)

| passive haste | best placement | at the pull | at 3 stacks / inside Lust | just after Lust |
|---|---|---|---|---|
| 0 | **@1** — the pull | **2.945** | 2.746 | 2.668 |
| 100 | **@47** — after Lust | 2.071 | 1.436 | **3.011** |
| 200 | **@47** | 1.520 | 0.591 | **3.169** |
| 300 | **@47** | 1.222 | **0.000** | **3.334** |
| 400 | **@47** | 1.213 | **0.000** | **3.290** |

### Berserking (10 s)

| passive haste | best placement | at the pull | inside Lust | just after Lust |
|---|---|---|---|---|
| 0 | **@39** | 0.925 | 0.931 | 0.726 |
| 100 | **@1** | 0.926 | 0.835 | 0.732 |
| 200 | **@44** | 0.630 | 0.410 | 0.818 |
| 300 | **@47** | 0.576 | **0.000** | **0.814** |
| 400 | **@47** | 0.666 | **0.000** | **0.910** |

> ### ★★★ ABOVE 243 PASSIVE HASTE, ANY HASTE COOLDOWN USED INSIDE LUST IS WORTH EXACTLY ZERO
> Not "nearly zero" — **0.0000**. Bloodlust alone floors the GCD at **243** (Part I's tent table), so
> from that point on there is no interval left for a second haste cooldown to shorten. Pinned to the
> rating point:
>
> | passive haste | Icy Veins inside Lust | Berserking inside Lust |
> |---|---|---|
> | 200 | 0.5907 | 0.4101 |
> | 220 | 0.1970 | 0.0989 |
> | 240 | 0.0154 | 0.0077 |
> | **243** | **0.0000** | **0.0000** |
> | 300 | 0.0000 | 0.0000 |
>
> ⇒ **At any geared haste level, never put a haste cooldown inside Lust.** This is the sharpest form of
> the rule the project has carried as "Icy Veins slides out of Lust with gear" (RULES §3), and it names
> the exact rating at which it stops being a trade-off and becomes free.

⚠ **At h=0 the ordering is `pull > inside Lust > after Lust`, and that is not the same rule.** With
nothing floored, Lust is nearly transparent to Icy Veins (P4's interaction is ≈ 0 there — the floor has
not started biting, so Icy Veins converts the same 2.67 casts whether Lust is up or not). What decides
the placement at h=0 is not Lust at all, it is the **pull advantage** of Part I rule 3. Reading the h=0
row as "get out of Lust" and the h=300 row as the same rule would be wrong: they are the pull advantage
and the GCD floor respectively, and they only happen to point the same way once.

## The full pair table

`node tools/facts-pair.mjs --mode=all --haste=0,400 --sp=1000 --step=5`, aligned-interior layout.
"overlap worth" is the aligned layout minus the best legal **disjoint** layout — negative means
separate them.

| pair | family | interaction h=0 | worth h=0 | interaction h=400 | worth h=400 |
|---|---|---|---|---|---|
| Icy Veins + Berserking | haste × haste | 0.1255 | −0.0267 | −0.9105 | −0.9732 |
| Icy Veins + Bloodlust | haste × haste | 0.0788 | −0.1267 | −3.2904 | −3.6340 |
| Icy Veins + MQG | haste × haste | 0.6008 | 0.4633 | −2.8736 | −2.9364 |
| Icy Veins + Skull | haste × haste | 0.3338 | 0.1001 | −1.5548 | −1.6192 |
| Berserking + Bloodlust | haste × haste | 0.2056 | 0.1282 | −0.9105 | −1.4167 |
| Berserking + MQG | haste × haste | −0.0534 | −0.0848 | −0.7013 | −0.7456 |
| Berserking + Skull | haste × haste | 0.1128 | 0.0788 | −0.0017 | −0.0017 |
| Bloodlust + MQG | haste × haste | −0.2016 | −0.2505 | −2.8736 | −3.1707 |
| Bloodlust + Skull | haste × haste | 0.4953 | 0.4937 | −1.5548 | −1.9215 |
| MQG + Skull | haste × haste | — | — | — | — |
| Icy Veins + Arcane Power | haste × dmg | 0.6000 | 0.5446 | 0.9000 | 0.8372 |
| Berserking + Arcane Power | haste × dmg | 0.0000 | −0.0314 | 0.3000 | 0.3000 |
| Bloodlust + Arcane Power | haste × dmg | 0.6000 | 0.5226 | 0.9000 | 0.3937 |
| MQG + Arcane Power | haste × dmg | 0.6000 | 0.6000 | 0.6000 | 0.5556 |
| Skull + Arcane Power | haste × dmg | 0.3000 | 0.2673 | 0.3000 | 0.3000 |
| Icy Veins + Icon | haste × sp | 0.2316 | 0.1762 | 0.3088 | 0.2460 |
| Icy Veins + Serpent-Coil | haste × sp | 0.2241 | 0.1687 | 0.3362 | 0.2734 |
| Berserking + Icon | haste × sp | 0.0772 | 0.0458 | 0.0772 | 0.0772 |
| Berserking + Serpent-Coil | haste × sp | 0.0000 | −0.0314 | 0.1121 | 0.1121 |
| Bloodlust + Icon | haste × sp | 0.3088 | 0.2452 | 0.3088 | −0.1887 |
| Bloodlust + Serpent-Coil | haste × sp | 0.2241 | 0.1467 | 0.3362 | −0.1701 |
| MQG + Icon | haste × sp | — | — | — | — |
| MQG + Serpent-Coil | haste × sp | 0.2241 | 0.2241 | 0.2241 | 0.1798 |
| Skull + Icon | haste × sp | — | — | — | — |
| Skull + Serpent-Coil | haste × sp | 0.1121 | 0.0793 | 0.1121 | 0.1121 |
| Arcane Power + Icon | dmg × sp | 0.2316 | 0.2316 | 0.2779 | 0.2779 |
| Arcane Power + Serpent-Coil | dmg × sp | 0.3362 | 0.3362 | 0.4034 | 0.4034 |
| Icon + Serpent-Coil | sp × sp | **−0.0000** | −0.0000 | **−0.0000** | −0.0000 |

**Every `haste × dmg` figure is an exact integer multiple of 0.3**, and every `haste × sp` figure an
exact integer multiple of that buff's `s` (0.07719 for Icon, 0.11205 for Serpent-Coil, at 1000 SP). The
integer is `Δ(covered)`. Nothing in this table is fractional except where a window touches the kill.

### ⛔ Three pairs CANNOT overlap at all

Icon of the Silver Crescent, Mind Quickening Gem and Skull of Gul'dan are all **on-use trinkets and
share a lockout** — using one locks the group for that buff's duration. `repair` retimes any schedule
that tries, so `MQG + Icon`, `MQG + Skull` and `Skull + Icon` have no overlapping layout to measure.
Their alignment question is answered by the item, not by the arithmetic.

---

# Part III — three cooldowns

## The law extends by inclusion–exclusion, and nothing new is needed

    V(abc) = Σ singles  +  Σ pair terms  +  TRIPLE-SPECIFIC term

and the triple-specific term is just the next product in the expansion. For Icy Veins + Icon + Arcane
Power it is `Δ₃ × s × (v−1)` — the casts Icy Veins adds *inside the region covered by both value
cooldowns*, each paid the product of their two bonuses. Measured:

| passive haste | triple-specific term | = Δ₃ × s × 0.3 |
|---|---|---|
| 0 | 0.0463 | **2** × 0.07719 × 0.3 |
| 400 | 0.0695 | **3** × 0.07719 × 0.3 |

Same integer structure as everywhere else. ⇒ **A triple needs no new rule.** Expand the product of the
per-cast multipliers, count the covered casts at each level of overlap, and you have it.

## T1. Icy Veins + Icon of the Silver Crescent + Arcane Power

### Conclusions

**The value cooldowns form a cluster, and the cluster is what the haste cooldown is holding on to.**
Walking away from Icon alone costs `s = 0.07719` per surrendered cast. Walking away from Icon *and*
Arcane Power costs the cluster bonus

    B = 1.30 × (1 + s) − 1 = 0.30 + 1.30·s = 0.40035          at 1000 SP

which is **5.19× dearer**. So Icy Veins clings to the cluster far longer than it clings to Icon alone.

**Confirmed: the breakpoint moves a long way up.**

| layout | Icy Veins leaves the interior at |
|---|---|
| Icy Veins + Icon (pair, P1) | **h = 410** |
| Icy Veins + Icon + Arcane Power | **h ≈ 472** |

(brute-forced on a 1 s press grid at 1000 SP; aligned wins through h=470, `IV@0` wins from h=475.)

⚠ The transition is a **step, not a smooth crossing** — the margin jumps 0.333 casts between h=470 and
h=475 — because `Δ(covered)` changes by a whole cast. The closed form gives the right *scale* for the
shift; the exact rung is set by where a covered cast is gained or lost.

**Confirmed: the value cooldowns never want the pull — at any passive haste.** Across h = 0 … 800,
`Icon@0` and `ArcanePower@0` lose in every single case, and Arcane Power is always the worst arm
because its per-cast bonus is the largest thing to waste on a ramp:

| passive haste | Icy Veins @0 | Icon @0 | Arcane Power @0 | all three @0 |
|---|---|---|---|---|
| 0 | −0.4221 | −0.3474 | −1.1084 | −0.7453 |
| 200 | −0.5897 | −0.3474 | −1.1316 | −0.5897 |
| 400 | −0.4148 | −0.4709 | −1.4779 | −0.7379 |
| 600 | **best** | −0.5824 | −1.1438 | −0.3232 |
| 800 | **best** | −0.8938 | −1.4552 | −0.4003 |

*(casts, against the best aligned-interior layout)*

### Why the value cooldowns can never want the pull — and it is a theorem, not a measurement

User, 2026-07-28: *"at no point will it be worth for Icon and Arcane Power themselves to go to start,
since even Icy vein'd start of ramp will be slower than unhasted casting at 3 stacks."* Exactly right,
and it holds at every haste because it is structural rather than numerical:

| passive haste | Icy-Veins'd ramp intervals | fastest of them | bare 3-stack interval |
|---|---|---|---|
| 0 | 2.083 / 1.805 / 1.527 | 1.527 | 1.500 |
| 200 | 1.849 / 1.602 / 1.355 | 1.355 | 1.331 |
| 400 | 1.662 / 1.440 / 1.218 | 1.218 | 1.197 |
| 600 | 1.509 / 1.308 / 1.106 | 1.106 | 1.087 |
| 800 | 1.382 / 1.198 / 1.013 | 1.013 | 1.000 |

★ **The ordering can never invert.** Each Arcane Blast stack removes a fixed 0.334 s of cast time, so a
ramp cast is *always* longer than a 3-stack cast at the same haste; a haste multiplier divides both by
the same factor and preserves the ordering; and the GCD floor applies to both, so at the extreme they
converge to 1.000 s and tie rather than cross. A value window opened at the pull therefore always
covers **fewer or equal** casts, never more — measured as 2 fewer at h=0 and h=400, 1 fewer at h=800.

The margin does narrow with haste (1.527 vs 1.500 at h=0; 1.013 vs 1.000 at h=800), so the *penalty*
shrinks. It never reverses.

### Sim verification

All three pull arms, duelled against the aligned layout with common random numbers, 5 seeds × 10 000
iterations at h=0 / 1000 SP:

| arm | sim | model |
|---|---|---|
| Icy Veins @0 | −0.891 % | −0.903 % |
| Icon @0 | −0.721 % | −0.743 % |
| Arcane Power @0 | −2.393 % | −2.372 % |

Same ordering, agreeing to **0.02 pp** on every arm against a ±0.04 % seed band.

## Still to do

The remaining triples, and more baselines for the pairs (Part II's table is haste 0 and 400 at 1000 SP;
`haste × sp` and `dmg × sp` rows move with passive spell power exactly as P1's did, `haste × haste` rows
do not move at all). The structural questions are now closed by the composition table and its
inclusion–exclusion extension, so what is left is filling cells rather than finding rules.

⚠ One instrument caveat to carry forward: `--mode=triple` excludes the terminal placement from its
interior arm, but a press one second short of it (`@39` on a 60 s fight) still picks up boundary credit
and won the aligned arm at two rungs. Read the layout column, not just the number.

## The two generators

| | what it produces | cost |
|---|---|---|
| `tools/facts-ladder.mjs` | model only — one cooldown, arbitrary haste granularity, value in casts, closed form beside it, flatness and threshold assertions | seconds |
| `tools/facts-pair.mjs` | model only — two or three cooldowns, brute-forced over their press times; the interaction surface, the breakpoint sweep, and the triple decomposition (Parts II–III) | seconds to minutes |
| `tools/buff-atlas.mjs` | model **and** sim, one baseline at a time — the per-placement tables | minutes |
| `tools/jitter.mjs` | model only — re-scores a whole plan as an **expectation over execution error** rather than at its nominal seconds | seconds |

Use the ladder and the pair tool to find where something interesting happens, and the atlas to have the
sim rule on it. ★ Reach for `jitter.mjs` whenever a plan's margin is small enough that it might be
exact-timing luck: it answers "is this advantage EXECUTABLE", which is a different question from "is
this advantage real" and the one a raider is actually asking. A margin that survives ±1 s of press
error is a rule; one that does not is a coincidence of the lattice. ★ For a PAIR the sim genuinely can rule — both cooldowns are self-presses, so the aura
snapping that makes it blind to Bloodlust's placement (rule 5) does not apply.
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
