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

**Status: OPEN, MECHANISM ESTABLISHED 07-28. ⚠ And the name above is now MISLEADING — read
*"★★★★★★ THE MECHANISM"* below before anything else in this entry.** In short: the scorer is **not**
booking phase as damage. It is exact, and it reproduces wowsims' cast count to **0.002 casts** once
both are handed the same fight. The defect is one layer up — the fight it is handed is
**over-specified**, and the ranking resolves a sub-second input the user cannot supply. Several
paragraphs below were written against the older reading and are bannered where they sit.

**Two witnesses, one bug** — a third was withdrawn on 07-28 (see below), which is why the count in
older commits reads three.

The model books *where the cast lattice happens to land* as real expected damage. Because a cooldown's
placement shifts every cast after it, a placement that is genuinely worth the same can come out ahead
by a fraction of a cast — and the model spends real layout quality chasing it.

| witness | size | the fact it violates |
|---|---|---|
| Berserking "prefers" partial Bloodlust overlap over sitting fully inside it | **0.185 casts** | RULES §5b |
| Icy Veins before Bloodlust valued above Icy Veins inside it | **0.287 casts** | ESTABLISHED-FACTS §1 rule 1 |

Both are **sub-cast**, both are on placements that shift the downstream lattice, and both are
**deterministic** — the figures are identical at 10 000 and 60 000 iterations, so they are not
Monte-Carlo noise.

### ⛔ WITHDRAWN — the third witness was never a defect (07-28)

A third witness used to sit in that table: *"Bloodlust at t=15 s valued above Bloodlust at t=5 s or
t=10 s, 0.178 casts"*, later re-measured at 0.231 casts and filed here as the sharpest of the three,
on the strength of a head-to-head duel in which the model predicted **+7.26 DPS** and the sim measured
**+0.001 ± 0.002**. That looked like a ~3600σ refutation. It is not one: **the sim cannot express the
question**, and a gap where the sim is the odd one out is a harness limitation, not a model defect —
rule 1 of this file, applied to the entry that was breaking it.

The user's objection is what unpicked it: *"the midcast lust will only affect the next cast, so it's
essentially the same, it won't speed up the already going one."* The first half is right and both
engines already agree on it — haste is snapshot at cast start, so an in-flight cast is never sped up.
But the conclusion does not follow, **because the buff's 40 s clock starts at the call while your first
hasted cast starts at your next boundary**. Whatever sits between them is window you paid for and
cannot use:

    aura      [call, call + 40]
    usable    [call + slip, call + 40]        slip = time to your next cast boundary
    count     floor((40 − slip) / 1.1538) + 1  = 35 while slip ≤ 0.769 s, else 34

Swept at millisecond resolution across one full 1.5 s lattice period, the model flips 34 → 35 at
**slip = 0.764 s** — the arithmetic says 0.769, and one ladder step of ms rounding separates them. So
the model is computing the right thing.

**The sim is flat because its Bloodlust is cast by the mage.** `tools/genapl-core.mjs` transcribes it
as `castSpell(spellId 2825)` on the mage's own APL, so the aura can only ever begin on one of *his*
GCDs and `slip` is structurally zero. Swept across the same lattice period at 0.2 s steps, wowsims
returns **1462.30 DPS at every single offset** — not "flat within noise", identical to the last printed
digit, which is what a snapped aura looks like and what no genuinely varying quantity looks like.

⇒ Filed as a harness limitation in `docs/TOOLING.md`. **Do not re-file it here**, and do not "fix" the
model by snapping raid externals to a cast boundary — that would be copying the harness's artifact into
the engine. `isExternal` setting `auraAt = e.ts` with no snapping is correct: someone else presses
Bloodlust, and their cast does not wait for your global cooldown.

⚠ What survives is a much narrower question, and it belongs to D1's "realize vs average" theme rather
than to this witness: the effect is real *for a given lattice phase*, and the phase is deterministic
from a clean pull — but it is not knowable to ±0.3 s on a real one. Whether the planner should resolve
it or average over it is a judgement call about what the tool is for, not a defect against a fact.

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
inside the 0.05 % band. It bounds the *symptom* — it does not fix the cause, and both surviving
witnesses (0.185 and 0.287 casts) are outside the band it can reach.

---

## D2 — the model emits the uglier of two BIT-IDENTICAL layouts

**Status: OPEN. Mechanism established, fix specified (two parts), not yet landed. Two witnesses.**

★ **No scoring change is needed.** Both witnesses are *exact* ties — the scorer is right about the
number and wrong only about which of several identically-scoring layouts it emits. That makes the fix
strictly a tie-break, and a tie-break gated on bit-equality can never cost damage.

On the `1:40 · h=0 · 1387 SP · 38 % crit · Lust pinned 0:07` fight the optimizer emits

    0:02  Icy Veins            0:06  Icon · Serpent-Coil · Arcane Power      0:07  Bloodlust

when the layout with the value cluster at **0:07** — one press moment, coinciding with the Lust call —
scores `196814.3490798448` against `196814.3490798448`. **Bit-identical**, `0.000e+0` apart, and it has
**4 press rows instead of 5**.

### It is not a cosmetic preference — the legible layout is measurably more robust

User, 2026-07-28: *"the fights, the lust activation, the movement etc, are not executable to the
millisecond, so the hypothetical perfect clipping is not realistic; what is realistic is following an
established logical set of rules."* Measured with `tools/jitter.mjs`, which re-scores a plan as an
expectation over execution error instead of at its nominal times:

| jitter model | model plan | legible layout | Δ |
|---|---|---|---|
| exact (nominal seconds) | 87.7794 | 87.7794 | **+0.0000** |
| common (whole opener shifts ±1 s) | 87.5499 | 87.6382 | **+0.0883** |
| call (the raid call moves ±1 s) | 87.4097 | 87.4097 | +0.0000 |
| independent (every press wanders ±1 s) | 87.4713 | 87.6194 | **+0.1481** |

⇒ **Identical when executed perfectly, strictly better when executed by a human.** Legibility is not
being traded against damage here; it is free at nominal times and then pays. Fewer distinct press
moments means fewer things to land late.

### Second witness — and it shows the fix must be broader than "fewer press rows"

`2:00 · h=0 · 1000 SP · 25 % crit · Lust pinned 0:10`. The optimizer emits **Icon at 0:06**, with Icy
Veins, while Serpent-Coil, Arcane Power and Bloodlust all sit at 0:10.

**Icon @5 through @10 are an exact six-second plateau** — every one of them scores identically, because
Icon covers **exactly 19 casts** at every placement in that range. The window slides but the count does
not: the completion rule clips the last cast at the far end exactly as fast as the slower pre-Lust casts
are given up at the near end. (User, 2026-07-28, predicting this before it was measured: *"the concrete
exact per cast modeling under the hood might have it come out exactly the same, because exactly the same
amount of casts will be affected."* It does.)

Within that plateau the model picks the **earliest** second, which is the one that splits the value
cluster. Moving it to 0:10 — joining Serpent-Coil, Arcane Power and the Lust call — is again free and
again better in practice:

| | Icon @0:06 (emitted) | Icon @0:10 | Δ |
|---|---|---|---|
| exact | 101.7380 | 101.7380 | **+0.0000** |
| common jitter ±1.5 s | 101.4853 | 101.4963 | **+0.0110** |
| pinned call moves | 101.2884 | 101.2994 | **+0.0110** |
| independent jitter | 101.2660 | 101.2774 | **+0.0115** |
| **worst case** (independent) | 100.4420 | **100.4960** | better floor |

★★ **`pressRows` cannot see this one.** Both layouts have exactly four press rows — `{6, 10, 27, 38}`
either way, because Icy Veins is already at 0:06. What changes is *which* moment Icon joins, and
therefore whether the value cluster is coherent. So the one-clause fix below is necessary and **not
sufficient**: it fixes the first witness and leaves this one.

⇒ **The tie-break metric should be the jitter expectation itself.** It is principled (it answers the
question a raider is actually asking), it is measurable (`tools/jitter.mjs`), it subsumes both press-row
merging and cluster coherence, and it is only ever consulted on an **exact** tie — so it can never cost
damage. A common-shift expectation is ~7 extra scorings per candidate, which a finishing pass can
afford.

### Mechanism

`structuralSnap` (`index.html`, the finishing pass) gates every candidate move on

    if (xc < cross && xr <= rows) { ...accept... }

— the **edge-span count must strictly decrease** before the press-row count is even consulted. Moving
the cluster from 0:06 to 0:07 spans no fewer buff edges; it only merges two press rows into one. So
`xc < cross` is false and the move is never taken. The pass can trade rows as a tie-break *within* a
span improvement, but it can never take a pure row reduction, however free.

### The fix — two parts, and the second is the one that matters

**1. Let a pure row reduction through** (fixes witness 1):

    if ((xc < cross && xr <= rows) || (xc === cross && xr < rows)) { ...accept... }

**2. Break exact ties on the jitter expectation** (fixes witness 2, which part 1 cannot see):

    // only ever consulted when r.robust === val0 to the bit, so it can never cost damage
    const robustness = sched => mean over δ ∈ {−1, −0.5, 0, +0.5, +1} of
                                simulate(repair(shiftAllPresses(sched, δ)), cfg).robust
    accept if robustness(candidate) > robustness(current)

⚠ Both change the rendering of plans that have a free move available, so they need `exact-match` re-run
and its goldens re-recorded — under a hard gate that a plan may only move when its score is **exactly**
unchanged, never merely inside the tie band.

### ⛔ ATTEMPTED 07-28 AND REVERTED — the gate caught it

Both parts were implemented and measured. They do what they were meant to (the `1:40` cluster moved to
0:07), but the sweep says they also move plans they should not:

    node tools/plan-sweep.mjs <orig> A.json 3 --max-t=200
    node tools/plan-sweep.mjs index.html B.json 3 --max-t=200
    node tools/plan-diff.mjs A.json B.json

    compared=16 changed=3   worse=1 better=0 tie=2
    ⚠⚠ SEARCH REGRESSION — 1 cell where B's plan scores LOWER on B's own objective
       (2:20 lust 0:05)

`exact-match` read **19 passed, 6 failed**, every failure a one-second press shift.

**Root cause of the leak, and it is the thing to design around next time.** The two new clauses are
each individually gated on bit-equality and cannot lose a point on their own. But accepting a tied move
changes `sx`, and `structuralSnap`'s *first* clause — the original span-reduction one — is allowed to
spend the 0.05 % band. So a free move can carry the plan to a state from which the band-spending clause
then makes a *different* choice than it would have. The tie-break is free; the path through the search
is not.

⇒ **A correct implementation must make the whole pass value-monotone**, not just the new clauses: keep
the best-scoring layout seen and never return one that scores below it, or run the robustness tie-break
as a separate final pass over layouts already known to be bit-identical, rather than inline where it can
perturb the span clause. Until then D2 stays open and `index.html` is unchanged.

⚠ **Not landed.** It changes the rendering of every plan that has a free row merge available, so it
needs `exact-match` re-run and its goldens re-recorded — and each changed plan checked to be
bit-identical in value, not merely inside the tie band. That is the gate: this fix may only ever move
plans whose score is **exactly** unchanged.

### Reproduction

    node tools/jitter.mjs \
      --spec '{"T":100,"hasteRating":0,"sp":1387,"critPct":38,"coldSnap":true,
               "kit":["icyVeins","isc","scb","arcanePower","berserking","bloodlust"],"pins":{"bloodlust":[7]}}' \
      --plans '{"model":{"isc":[6],"bloodlust":[7],"icyVeins":[1,48],"arcanePower":[6],"scb":[6],"berserking":[41]},
                "legible":{"isc":[7],"bloodlust":[7],"icyVeins":[1,48],"arcanePower":[7],"scb":[7],"berserking":[41]}}'

### ⚠ What is NOT wrong with that plan — do not "fix" the two-regime split

The same export was read as *"the cooldowns are smeared across 0:02–0:07 instead of one clean moment"*.
The smear is **correct**, and Parts I–III say why: Icy Veins belongs at the pull (rule 3's pull
advantage, and P5's pinned-Lust table reads 2.945 casts at @1 against 2.746 inside Lust and 2.668 after
it), while the value cluster can never want the pull (T1's theorem — a ramp cast is always longer than
a 3-stack cast, so a value window opened at the pull always covers fewer casts). Two cooldown families,
two different rules, two different seconds. Only the **cluster's own** second is misplaced, and only by
one.

## ✅ CRACKED 07-28 — it is D1, on ONE press, and it is big enough to flip a plan

**The ground-truth inversion is fully explained. It is not the objective, not the ramp, not the
lattice, not the harness. It is `D1` — the model booking sub-cast lattice phase as real damage — landing
on a single Berserking press.**

### The isolation

Hand layout against optimizer layout, adding one cooldown at a time to both, ratio `hand / optimizer` in
each engine (`>1` = that engine prefers the hand layout):

| step | model | sim | |
|---|---|---|---|
| Icy Veins only | 1.000660 | 1.000640 | agree |
| + Lust | 0.996853 | 0.999344 | agree |
| + Arcane Power | 0.996999 | 0.999434 | agree |
| + Icon | 0.997057 | 0.999449 | agree |
| + Gem | 0.997120 | 0.999662 | agree |
| **+ Berserking** | 0.998883 | **1.001445** | **★ DISAGREE** |

Five steps agree. The sixth flips the sim and not the model. **The entire inversion is the Berserking
press.**

### Single variable — the hand layout, moving only Berserking (Lust covers 20–60)

| Berserking at | inside Lust? | model damage | sim damage |
|---|---|---|---|
| 40 / 45 | yes | 175309 | **193000** ← sim's best |
| 50 | yes | 175345 | 193000 |
| 55 | no | 175331 | 192589 |
| **57** | **no** | **175402** ← model's best | 192665 |
| 60 – 80 | no | 174954 | ~192600 |

**The model picks @57, outside Lust. The sim picks @40, inside it.**

★★ **And the model contradicts its OWN corpus.** `ESTABLISHED-FACTS.md` P4 measures Berserking ×
Bloodlust at h=0 as **+0.2056 casts** — the pair is ×1.43, *under* the 1.5 the GCD floor needs, so
nothing is clipped and Berserking wants to be inside Lust. The sim agrees with the corpus. The optimizer
does not.

### Why the model gets it wrong — the mechanism

Read the model's column: 175345 at @50, **down** to 175331 at @55, **up** to 175402 at @57, **down** to
174954 at @60. **Non-monotone.** The @57 figure is a **spike of +57 damage (+0.03 %)** over the
inside-Lust plateau — and the sim's column over the same range is clean and monotone, with inside-Lust
ahead by **+0.17 %**.

That spike is lattice phase. It is exactly D1: *"the model books where the cast lattice happens to land
as real expected damage."* What is new is the **size of its consequence** — 0.03 % of phase noise is
enough to override a genuine +0.2056-cast interaction and move a press 17 seconds, which then flips the
whole plan comparison.

### What this settles

* **The user's layouts were right, and for the reason they gave.** Berserking belongs inside Lust at
  h=0. Their claim *"overlaying Berserking with IV, Gem and Icon has to be better than overlaying it
  with a naked lust"* is the same instinct, and the corpus and the sim both back it.
* **The objective does not need changing.** ⛔ Every entry below arguing toward the integral is
  explained by this instead. The per-cast sum is fine; it is being fed a phase artifact.
* **D1 is promoted from a tie-break nuisance to the top open defect.** Its previous witnesses were
  0.185 and 0.287 casts and were treated as cosmetic. This one changes which plan the tool prints.

### The fix — it works, and it has a FREE PARAMETER that flips the answer

D1's cure is to stop resolving one lattice phase: let the **ranking** read a neighbourhood instead of a
point. No new objective is needed — the same per-cast sum, averaged over press offsets. Tested on the
failing sweep before writing any of it into the engine:

| averaging window | ranking picks | verdict |
|---|---|---|
| ±1.5 s | Berserking **@50** | ✓ inside Lust — matches ground truth |
| **±1.0 s** | Berserking **@50** | ✓ inside Lust — matches ground truth |
| **±0.75 s** | Berserking **@57** | ✗ still outside Lust |

**The fix works — and only above some width.** At ±0.75 s the @57 spike is still wide enough to survive
the average and the wrong answer comes back.

⛔ **That is a tuned constant, and this repo has a rule against exactly this.** PHASE12 §6.1–§6.3 records
four scorer terms falsified after being tuned against the quantity they were meant to resolve. Choosing
±1.0 s *because it gives the answer we want* would be the fifth. It must be derived.

**What a derivation has to contend with:** the obvious principled width is **one full lattice period** —
that is what makes an average a true *phase* average, independent of where the lattice sits. But there
is no single period in a real fight: at h=0 the bare interval is 1.5 s, under Lust it is 1.1538 s, under
Lust+Berserking 1.049 s. A press near the pull sits on a 2.5 s ramp cast. **The window would have to be
local to the press, not global** — plausibly `±½ · (the interval at that press's own fire time)`, which
at the Berserking press under Lust is ±0.577 s, i.e. in the region that currently gives the *wrong*
answer.

⇒ Two candidate framings, and they are not the same and should not be conflated:

1. **Lattice-phase average** — width = the local cast interval. Mathematically principled, no free
   parameter, and on this evidence may not fix the case.
2. **Execution-error average** — width = how accurately a human presses (~±1 s). Physically motivated,
   fixes the case, but the width is an empirical claim about players, not about the game, and it
   belongs in `BENCH` beside `tieBandPct` rather than inside `simulate()`.

**Neither is written yet, and the choice between them is the open design question.** `tests/anchors.mjs`
is the pass/fail signal for whichever wins.

### ⛔⛔ ALL THREE FRAMINGS ARE NOW DEAD — phase-averaging does NOT reconcile the rankings

Step 1 of the plan was *"settle the neighbourhood by measurement across several ground-truth cases, not
by which width fixes A1"*. Done, and the answer is that **none of them do**. Each framing scoring the
**full** ground-truth layout against the **full** model layout, on all four cases the sim decides for
ground truth:

| framing | A2 (2:00 L@20) | A3 (3:00 L@20) | Ex2 (2:00 L@10) | Ex1 (2:45 L@10) | tally |
|---|---|---|---|---|---|
| point (today) | ✗ | ✗ | ✗ | ✗ | **0/4** |
| ±0.75 s lattice-phase | ✗ | ✗ | ✗ | ✗ | **0/4** |
| ±1.0 s execution | ✗ | ✗ | ✗ | ✗ | **0/4** |
| ±1.5 s execution | ✗ | ✗ | ✗ | ✗ | **0/4** |

**The model layout scores higher under every framing, at every width, on every case.** Averaging moves
the numbers (A2: 175505 → 175332 as the window widens) but never the ordering.

⚠ **This does not contradict the earlier de-risk, and the difference is the finding.** Averaging *did*
fix the **Berserking-only** sweep — holding every other press at its ground-truth value, ±1.0 s picked
@50 over @57. It fails here because the full layouts differ in **more than Berserking**: Icy Veins
(@0/20 vs @5/25) and the value cluster (@20 vs @25) also move, and the model scores *those* differences
in its own favour under every framing.

⇒ **So there are at least two separate disagreements, not one.** The Berserking one is phase noise and
averaging addresses it. Whatever is happening on the Icy Veins / cluster placements is **not phase
noise**, survives averaging at every width tested, and is currently unexplained — it is the larger of
the two, since it outweighs the Berserking correction in all four cases.

### What is eliminated, and what the next question is

Eliminated by measurement, in order: the objective choice (sum vs integral), the ramp, the Icy Veins ×
Bloodlust interaction, the harness anchoring convention, `structuralSnap` as a host, and now
**phase-averaging as the ranking fix**.

**The open question is now narrower and different**: on these four cases, isolate the *Icy Veins and
cluster* placements the way the Berserking press was isolated — single-variable sweeps of each, model
against sim, holding the rest at ground truth. The Berserking ladder found its answer in one run; the
same method has not yet been pointed at the other two presses.

### ⛔ AND A THIRD FRAMING WAS TRIED AND IS DEAD — `structuralSnap` cannot host this fix

The most attractive option looked like a **rule-based tie-break with no free constant**: the whole
@40…@57 range spans **0.053 % of score**, i.e. it sits *inside* `tieBandPct`, so by the tool's own
standard the score should not be choosing between those layouts and a rule should. The rule is already
measured — P4's +0.2056 casts for a haste pair that stays under the floor — so a `nestedHastePairs`
criterion in `structuralSnap` would need no tuning at all.

**It is inert, by construction.** `structuralSnap` opens with

    const n0 = simulate(s0, cfg, true).casts.length;
    …
    if (r.casts.length !== n0) continue;      // a CAST was gained or lost ⇒ not phase

and the move in question changes the cast count:

| Berserking at | `casts.length` | robust |
|---|---|---|
| @57 (outside Lust) | **94** | 175505 |
| @50 / @45 / @40 (inside) | **93** | 175450 / 175172 / 174566 |

The pass is a *"same casts, better shape"* polisher and refuses cast-count changes on purpose. The
correct move is precisely such a change. ⇒ **The fix cannot live in the finishing pass. It has to live
where cast-count changes are legal — in what the search RANKS.**

⚠ Note the sub-finding, which is D1 stated at its sharpest: the model believes the outside-Lust layout
fits **one more cast** (94 vs 93) and that extra cast is worth more than a +0.2056-cast interaction.
The sim disagrees on both counts. The 94th cast is a boundary-credit artifact at one lattice phase.

---

# ★★★★★★ THE MECHANISM — established 07-28, and it clears the scorer

Everything above this line was written while the mechanism was unknown, and several of its framings are
falsified by what follows. **The scorer is not the defect.** Read this section before acting on any
earlier one.

## 0. THE DEFECT IN ONE TABLE — the real optimizer, one instruction, five plans

`T=120 · h=0 · 1000 SP · 25 % crit · full kit`. The *only* thing that changes between rows is where
inside its own second the shaman's Bloodlust is assumed to land. Every row is the same instruction.

| Bloodlust at | what the tool tells the player to do |
|---|---|
| 20.000 | Icy Veins 0:05 / 0:25 · cluster 0:25 · Berserking **0:57** |
| 20.375 | Icy Veins 0:00 / 0:20 · cluster 0:20 · Berserking 0:51 |
| 20.750 | Icy Veins 0:01 / 0:21 · cluster 0:21 · Berserking 0:53 |
| 21.125 | Icy Veins **0:30 / 0:59** · cluster **0:30** · Berserking **0:19** |
| 21.498 | Icy Veins 0:20 / 0:55 · cluster 0:20 · Berserking **0:41 — inside Lust** |

Five plans, including one (21.125) with a completely different strategy — Berserking *before* the Lust
and the whole cluster ten seconds after it.

### And the search is not what is failing. Cross-scoring proves it

Score all five layouts at all five pins (casts, relative to the best layout in each column):

| layout | @20.000 | @20.375 | @20.750 | @21.125 | @21.498 |
|---|---|---|---|---|---|
| from 20.000 | **0.0000** | −0.4052 | −0.3531 | −0.3885 | −0.2350 |
| from 20.375 | −0.0721 | **0.0000** | −0.6802 | −0.7156 | −0.7723 |
| from 20.750 | −0.2150 | −0.3518 | **0.0000** | −0.2009 | −0.2577 |
| from 21.125 | −0.3792 | −0.1822 | −0.1302 | **0.0000** | −0.3999 |
| from 21.498 | −0.3224 | −0.4593 | −0.0748 | −0.1101 | **0.0000** |

**The diagonal is all zeros.** Every emitted plan really is optimal at its own pin — the search found
the right answer every time. And the off-diagonal is enormous: the plan that is optimal at 20.375 is
**0.77 casts worse** at 21.498.

⇒ **The optimizer is answering a question the user did not ask, correctly.** That is the whole defect,
and no amount of better searching fixes it.

## 1. The scorer is EXACT. Measured, against wowsims, at 0.002 casts

Hand both engines the *same* fight and the per-cast sum reproduces wowsims' Arcane Blast count to the
third decimal. Nine Berserking placements, `T=120 · h=0 · 1000 SP · 25 % crit · Icy Veins 0/BL ·
Bloodlust pinned on a cast boundary (20.415)`, 3 seeds × 10 000 iterations:

| Berserking | model Σfrac | sim casts | Δ model | Δ sim |
|---|---|---|---|---|
| @35 | 92.5594 | 92.5450 | −0.5801 | −0.5815 |
| @40 | 93.1395 | 93.1258 | **0.0000** | −0.0007 |
| @45 | 93.1395 | 93.1265 | 0.0000 | **0.0000** |
| @50 | 93.1395 | 93.1265 | 0.0000 | 0.0000 |
| @53 | 92.8812 | 92.8718 | −0.2583 | −0.2547 |
| @55 | 92.9226 | 92.9130 | −0.2170 | −0.2135 |
| @57 | 92.9640 | 92.9510 | −0.1756 | −0.1755 |
| @60 | 92.9146 | 92.9062 | −0.2250 | −0.2203 |
| @65 | 92.9352 | 92.9252 | −0.2043 | −0.2013 |

**Mean |Δmodel − Δsim| = 0.0019 casts.** The point ranking's answer is @40 — *inside* Bloodlust, which
is the user's ground truth and ESTABLISHED-FACTS P4. Nothing is wrong with the arithmetic.

⇒ **Retire the reading that D1 is a scoring error.** It is not, and the four rebuild/objective framings
that assumed it was were all chasing the wrong layer.

## 2. So why does the same scorer prefer Berserking OUTSIDE Bloodlust on the ground-truth cases?

Because the ground-truth cases pin Bloodlust at **20.000**, and that is a different fight.

Bloodlust is a raid external: its aura runs `[call, call + 40]`. The useful part starts at your next
cast boundary, so a call at 20.000 and a call at 20.415 buy **different amounts of casting**, and the
difference lands entirely at the far end — a cast starting at 60.242 is inside a 20.415 Lust and
outside a 20.000 one. Measured worth of that 0.415 s: **0.21 casts.**

That is larger than the interaction the plan is supposed to be resolving (Berserking × Bloodlust,
**+0.2056 casts**, ESTABLISHED-FACTS P4).

## 3. The consequence, and it is the whole defect — `node tools/phase-audit.mjs`

Slide the Bloodlust call across **one cast interval** — 20.000 to 21.500, every value of which is the
same instruction, *"the shaman lusts at 0:20"* — and ask each ranking where Berserking goes:

| Bloodlust called at | point ranking picks | phase-mean picks |
|---|---|---|
| 20.000 | @57 — **outside** ✗ | @45 — inside ✓ |
| 20.375 | @40 — inside ✓ | @45 — inside ✓ |
| 20.750 | @45 — inside ✓ | @45 — inside ✓ |
| 21.125 | @53 — **outside** ✗ | @45 — inside ✓ |
| 21.500 | @53 — **outside** ✗ | @45 — inside ✓ |
| | **UNSTABLE — 4 answers** | **STABLE — 1 answer** |

**The tool's answer to a question posed to the second is decided at the 100 ms.** That is D1, and it is
not a defect of the scorer — it is a defect of *what gets ranked*.

## 4. The fix, and it has NO free parameter

The phase of the player's cast stream against the raid's clock is set by pull reaction, latency, and
every global that is not an Arcane Blast. After a minute of casting it is **uniform over one interval**
and no player controls it. A planner may therefore only rank on a quantity that is **invariant** to it:

> score = the per-cast sum, averaged over the lattice's phase against the wall clock.

The averaging width is **one full lattice period** — that is what makes it a phase average rather than
a smoothing, so there is nothing to tune. (Contrast the ±1.0 s "execution error" width tried earlier,
which was an empirical claim about players and was chosen because it gave the wanted answer.)

⚠⚠ **THE RANDOMISER IS THE FINDING AND THE EARLIER ATTEMPT HAD IT BACKWARDS.** The 0/4 result recorded
above averaged over **press offsets** — moving each press against a fixed lattice. That is the wrong
unknown: a player *does* control when they press relative to their own casting, because they press
between casts. What they do not control is where the cast stream sits relative to the raid's clock. So
the lattice slides and the wall events stay:

    engine t = 0 IS the first cast
    ⇒ "lattice δ later" == every wall event, every press, and T, δ EARLIER

That one sign change is the difference between 0/4 and the table below.

## 5. Re-running step 1 with the correct randomiser

Ground truth ranked above the optimizer's own layout, all four locked cases, `--mode pair`:

| case | point: gt − model | phase-mean: gt − model |
|---|---|---|
| A2 · 2:00 · Lust@0:20 | −0.1039 casts ✗ | **+0.0439 casts ✓** |
| A3 · 3:00 · Lust@0:20 | −0.1788 casts ✗ | −0.0168 casts ✗ |
| Ex2 · 2:00 · Lust@0:10 | −0.4151 casts ✗ | −0.0890 casts ✗ |
| Ex1 · 2:45 · Lust@0:10 | −0.2098 casts ✗ | **+0.0083 casts ✓** |
| | **0/4** | **2/4** |

**Not a fix on its own, and it should not be reported as one.** But every residual shrinks by 5–10×,
and the two that still lose do so by 0.017 and 0.089 casts — inside and near `BENCH.tieBandPct`
respectively, where D2's structural tie-break is the right arbiter rather than the score.

## 6. Where the margin actually lives — the body is INVARIANT

Decomposing A2's twelve candidate layouts into *casts that complete before T* and *the terminal partial
cast*:

| | spread across all 12 layouts |
|---|---|
| body (92 full casts) | **173737 — identical in every one, to the digit** |
| terminal partial cast | 829 → 1720 |

Every haste cooldown's entire contribution to the objective, at this fight length, is expressed through
**one partial cast at the kill**. That is not a bug — haste's payoff genuinely is "did one more cast
fit" — but it means the ranking has exactly one channel, and that channel is phase.

## 7. ⇒ It also retro-explains PHASE12's 0.2114 %

PHASE12 retired the rate integral because it disagreed with the per-cast sum by a **median 0.2114 % of
score**. One cast at this setup is 1/93 = 1.075 % of score, so **0.2114 % = 0.197 casts** — the same
0.2 casts measured here as the lattice-phase term, from a completely independent direction.

★ The integral is the phase *expectation*; the sum is the phase *realisation*. They differ by exactly
the phase term. PHASE12 was right that the sum is the exact account **of a fight whose phase you know**,
and right to rank on it rather than on an approximation. What was not asked is whether the phase is
knowable. It is not.

⛔ **This is NOT a licence to un-retire the integral, and PHASE12 §6.10's rejection stands.** The
integral also over-pays a partial cast at a window's back edge (PHASE8 §25.5) and cannot express the
two snapshot rules exactly. The phase-mean of the exact sum keeps everything PHASE12 got right —
per-cast values, both snapshot rules, boundary credit — and removes only the degree of freedom the
search was exploiting.

## 8. Reproduction

    node tools/phase-audit.mjs                      # the anchor-slide table (§3)
    node tools/phase-audit.mjs --mode sweep --press berserking --from 35 --to 65
    node tools/phase-audit.mjs --mode pair --a '<schedule>' --b '<schedule>' --T 120

## 8b. SECOND CONFIRMATION — Ex2's Icon press, isolated the same way

Ex2 (`T=120 · Lust@0:10 · 1000 SP · 25 % crit`) is the case where the optimizer puts **Icon of the
Silver Crescent at 0:05**, five seconds ahead of Bloodlust, and the user puts it **with** Bloodlust.
The user's reason is the composition table's `haste × value` term: a +SP window is worth more where
casts are fastest, so it wants to sit inside Lust, not straddle its edge.

Hold every other press at ground truth, move the Lust pin onto the cast boundary (10.998), and sweep
Icon alone:

| Icon at | Δ point | Δ phase-mean | Δ sim |
|---|---|---|---|
| 2.000 | −0.4014 | −0.4014 | −0.3837 |
| 4.000 | −0.2779 | −0.2779 | −0.2648 |
| **5.000** (what the tool emits) | −0.1544 | −0.2470 | **−0.1470** |
| **10.998** (with Lust) | **0.0000** | **0.0000** | **0.0000** |
| 12.000 | −0.1235 | −0.0720 | −0.1177 |
| 15.000 | −0.1930 | −0.1640 | −0.1848 |
| 20.000 | −0.3088 | −0.2798 | −0.2958 |
| 25.000 | −0.4246 | −0.3956 | −0.4064 |

**argmax: point @10.998 · phase-mean @10.998 · sim @10.998 — unanimous, and it is the user's layout.**
The point column tracks the sim to **≤ 0.008 casts on every row**.

★ So the tool only prefers Icon@5 when Bloodlust is pinned **mid-cast**. Given the same fight the sim
is given, its own point score already agrees with the user and with wowsims. That is the second
independent confirmation of §1–§3, on a different cooldown, a different fight, and a **value** buff
rather than a haste one.

## 8c. ★★★ FOUR ISOLATIONS, FAIR PIN — the point score is 4/4 against the sim AND against the user

Every disputed press from the four ground-truth cases, isolated the way Berserking was: hold the rest
at ground truth, move the Bloodlust pin onto a cast boundary, sweep one press.

| isolation | point | phase-mean | wowsims | user's layout | point vs sim |
|---|---|---|---|---|---|
| A2 · Berserking (Lust@20.415) | @40 ✓ | @45 ✓ | @45 ✓ | inside Lust | ≤0.002 casts |
| Ex2 · Icon | @10.998 ✓ | @10.998 ✓ | @10.998 ✓ | with Lust | ≤0.008 |
| Ex2 · Icy Veins 1st use | @10.998 ✓ | **@8 ✗** | @10.998 ✓ | with Lust | ≤0.016 except 3 ramp rows |
| Ex2 · Berserking | @30 ✓ | @30 ✓ | @30 ✓ | @30 | ≤0.003 |

★★★ **Given the same fight the sim is given, the shipped point score already picks the user's layout on
all four presses.** It is the mid-cast Lust pin, not the ranking, that breaks it.

⚠ **And note the third row: the phase-mean is NOT uniformly better.** On Ex2's Icy Veins press it picks
@8 while point and sim both pick @10.998 — the sim scores @8 at −0.0035 casts (a tie) against the
phase-mean's +0.109 preference. Phase-averaging is a way to make the answer *insensitive* to an input
nobody supplies; it is not independently more accurate, and it must not be sold as such.

⚠ A separate residual is visible in that row and is **not** the phase term: on three presses (@0, @2,
@8 — all at or just past the ramp) the point score is off the sim by ~0.16 casts, while the other five
rows agree to 0.016. That is a ramp effect, unexamined, and it is its own question.

## 8d. The four candidate rankings, scored on both criteria

Two pre-registered criteria, because either alone is gameable: **(i)** does the ranking give ONE answer
as the raid call slides across a cast interval, and **(ii)** does it rank the user's layout above the
optimizer's on the four locked cases.

| ranking | anchor-slide (i) | ground-truth pairs (ii) |
|---|---|---|
| **point** — what ships today | UNSTABLE — 4 answers | 0/4 |
| **pin-mean** — average the raid call over the second the user gave | UNSTABLE — 2 answers | **3/4** |
| **phase-mean** — average the lattice against the wall clock | **STABLE — 1** | 2/4 |
| **both** — the product of the two | **STABLE — 1** | **3/4** |

The two randomisations are different unknowns — *when the shaman actually casts it* and *where my cast
stream sits* — so averaging over the product is not double-counting.

### ⛔⛔ BUT THE (ii) COLUMN CANNOT SELECT BETWEEN THEM, AND I ALMOST LET IT

The pin window above is `U[t, t+1)` — *"no earlier than the plan, up to a second late"*. The other
defensible reading is that a `mm:ss` field is a rounded value, so the call is `U[t−½, t+½)`. Both are
honest models of a human calling Bloodlust. Re-run with the symmetric window:

| ranking | A2 | A3 | Ex2 | Ex1 | tally | anchor-slide |
|---|---|---|---|---|---|---|
| pin-mean `U[t, t+1)` | ✗ −0.136 | ✓ +0.010 | ✓ +0.341 | ✓ +0.491 | 3/4 | UNSTABLE (2) |
| pin-mean `U[t±½)` | ✓ +0.046 | ✓ +0.021 | ✗ −0.156 | ✗ −0.058 | 2/4 | UNSTABLE (2) |
| both `U[t, t+1)` | ✗ −0.181 | ✓ +0.008 | ✓ +0.027 | ✓ +0.099 | 3/4 | **STABLE @45** |
| both `U[t±½)` | ✓ +0.010 | ✗ −0.020 | ✗ −0.076 | ✓ +0.026 | 2/4 | **STABLE @45** |

**A modelling choice with nothing to do with the phase question moves the tally by a whole case, in
both directions.** ⇒ The four-case corpus cannot arbitrate between these rankings, and "3/4 beats 2/4"
is not a result. Choosing the asymmetric window *because it tallies better* would be the fifth term
falsified the way PHASE12 §6.1–§6.3's four were.

★ **What survives the choice is the finding.** The anchor-slide verdict is identical under both windows:
the **lattice** term is what buys stability, the **pin** term does not, and neither depends on which
window convention is used. That is the discriminating criterion precisely because it is insensitive to
the modelling question the tally is sensitive to.

⇒ Report it that way: **phase-averaging the lattice is the established fix; the raid-call window is a
separate, still-open modelling choice, and the corpus is too small to settle it.**

### ⚠ A2 is the sole survivor, and the reason is a modelling gap, not a knob

Under `both`, A2 still ranks the optimizer's layout first by **0.161 casts**, and pin-averaging is what
costs it: A2's ground-truth layout presses its whole cluster **at** the pin, so when the pin moves the
cluster falls off it, while the optimizer's cluster sits 5 s inside Lust and does not care.

★ **That is a real defect in all four framings, and it should not be fixed by choosing a different
one.** A player does not press Icon at a pre-agreed wall-clock second — they press it *when the Lust
lands*. So a press whose whole purpose is to align with a raid call must **co-move with that call**,
and none of these rankings model that. ⛔ Do not paper over it with a "presses within X seconds of a pin
co-move" rule: X is exactly the kind of tuned constant PHASE12 §6.1–§6.3 records four casualties of.
The honest statement is that the plan's presses are specified relative to two different clocks and the
model only has one.

## 8e. ✅ THE FIX IS LANDED — `phaseFinish` / `phaseRerank` / `phaseScore` in `index.html`

Shipped 07-28. The search is **unchanged** and still ranks on the point score — its job is finding
basins and its discrimination there is far coarser than the 0.2-cast phase term. What changed is the
final **choice**: a bounded multi-start coordinate descent under `phaseScore`, run once on the search's
winner. `cfg.phaseRank === false` turns it off, which is how every A/B below was measured.

**Two things were measured rather than assumed, and both changed the design:**

1. **Single-press moves cannot reach the answer.** A per-press descent from the point winner on A2
   emitted the point winner *unchanged*, though ground truth scores +83 above it under the phase mean.
   The two layouts differ by a −5 s shift of Icy Veins **and** the whole cluster **and** a −17 s move of
   Berserking, and no single step improves alone. ⇒ three move classes: whole-plan slide, per-track
   slide, per-press move.
2. **One start is not enough either.** With the descent seeded only from the point winner, the pin
   slide still produced an outlier plan at 1 of 5 pins. ⇒ it gets the same structural starts the main
   search gets (naive, packed, pin-stacked, kill-anchored).

⚠ And a wiring bug worth remembering: the first version hung the re-rank off `optimizeAsync`'s **pooled**
return only, and the common path leaves through an early return above it — so it was dead for every
ordinary solve while appearing to work.

### What it achieves, measured

| | before | after |
|---|---|---|
| `tests/anchors.mjs` **A1** (Berserking inside Lust) | FAIL | ✅ **PASS** |
| Berserking inside Lust across the 5-pin slide | 1 of 5 | **4 of 5** |
| worst off-diagonal in the cross-score table | **0.77 casts** | **~0.15** |
| `plan-sweep` corpus, on the objective that now ranks | — | **13 changed cells, 13 better, 0 worse** (+0.08 … +0.54 casts) |
| `self-consistency` | 0.00e+0 · 0 structural | unchanged |
| wall clock (A3, T=180) | 13.1 s | 14.2 s (**+8 %**) |

### ⛔ What it does NOT achieve — state this, do not round it up

* **A2 and A3 are still RED.** They lock exact timestamps, and the phase mean's winner is a *third*
  layout (A2: Icy Veins 0:06/0:26 · cluster 0:23 · Berserking 0:50), which it scores **above** ground
  truth. The failure has changed in kind — it is no longer "Berserking outside Lust", it is "not these
  exact seconds" — but it is still a failure.
* **Stability is reduced ~5×, not achieved.** One of five pins still emits a structurally different
  plan, and cross-scoring confirms that plan really is the phase-mean argmax there. Some pin
  sensitivity survives because the phase mean removes the *lattice* phase and the pin-to-kill distance
  is still resolved exactly.
* The point score **falls** on 12 of 13 changed cells (0.01–0.70 casts). That is the deliberate price,
  not a regression — but it means `exact-match`/`golden.json` had to be re-recorded, and any comparison
  to a pre-07-28 corpus is denominated in the old objective.

## 8f. ★★★★ USER CHALLENGE 07-28: *"Are integrals really not the way? They feel like the way."* — MEASURED, AND THEY ARE

⚠ **This section supersedes §8e's implementation choice.** §8e's finding stands (rank on the phase
expectation); its *implementation* — a 12-sample average — is the wrong way to compute it, and the
measurement below is unambiguous about that.

A rate integral **is** a phase expectation, in closed form, exactly, at O(segments): `E[casts in a
segment of length L at interval i] = L/i` averaged over phase, which is precisely what the integral
computes. A sampled mean is an approximation of it. So the question is not "sum vs integral" — it is
"which arithmetic computes the phase expectation", and one of them needs no samples.

### The decisive test — the anchor slide, all three rankings

Bloodlust slid across one 1.5 s cast interval of *"lust at 0:20"*; where does each ranking put
Berserking?

| ranking | @20.000 | @20.375 | @20.750 | @21.125 | @21.498 | |
|---|---|---|---|---|---|---|
| point (pre-07-28) | @57 | @40 | @45 | @53 | @53 | **UNSTABLE — 4 answers** |
| **integral** (the diagnostic) | @45 | @45 | @45 | @45 | @45 | ✅ **STABLE** |
| phase-mean N=12 (**shipped §8e**) | @45 | **@50** | @45 | @45 | @45 | ⚠ **UNSTABLE — 2 answers** |

**The retired integral passes the test the shipped fix was built to pass, and the shipped fix does
not.** At N=12 the sampling noise is still large enough to flip @45↔@50; `phase-audit`'s N=48 is
stable, which is exactly the tell that the difference is sampling, not substance. The integral's curve
is also smooth where the sampled one is bumpy (non-monotone between @53 and @55) — the residual is
noise, and the integral has none because it does not sample.

### But "properly implement the stacks" is necessary and NOT sufficient — three terms are missing

Against an N=96 phase mean (the definition) over four sweeps, the integral's **argmax agreed 4/4** —
but the level residual runs **0.09 – 0.34 casts per layout**, far above the 0.005–0.07-cast margins
this project argues at. So it ranks well *here* and is not yet the phase expectation. Three closed-form
corrections, none of them speculative:

1. **The kill window is still the RETIRED symmetric one.** `index.html` says so in as many words —
   *"the retired symmetric kill window, kept ONLY so the `integral` diagnostic below still…"*. PHASE12
   §9 replaced `KILL_WINDOW = 0.5` with a one-sided window whose width is the cast's own duration. That
   correction was never applied here because nothing ranked on the integral.
2. **Haste-window edges — never implemented at all.** The integral switches rate exactly at the edge;
   the game snapshots at cast start, so a cast beginning just inside keeps the fast interval past the
   edge, and one beginning just before the window carries the slow interval into it. Both are closed
   form, opposite signs, and they nearly cancel — which is why the residual is 0.03 on a narrow sweep
   and 0.34 on a wide one:

       trailing edge  gain = ½ − i_in /(2·i_out)      at h=0, 1.049→1.364:  +0.115 casts
       leading  edge  loss = i_out/(2·i_in ) − ½      at h=0, 1.364→1.049:  −0.150 casts

   ⚠ PHASE8 §25.5 deliberately skipped the haste half on the reasoning that *"a cast that does not fit
   is not LOST, it happens later at the slower rate"*. True — and it is still a rate error at the edge,
   which is a different claim from the count error §25.5 was rejecting.
3. **Value-window back edge.** The integral pays a fractional cast that never completes inside the
   window. `boundaryCharge` **already implements exactly this** and ships OFF — measured ANTI-B2, but
   against the old corpus and against an arbiter that no longer exists. It is defined again and must be
   re-measured, not assumed dead.

★ **The stacks are already done.** The ramp is scored discretely inside the integral path (each of the
first `MAX_STACKS` casts placed at its own completion, phase-averaged over `RAMP_JITTER`) precisely
because a rate is wrong while the interval changes per cast. That was the user's suspected gap; it is
the one part that is already right.

### Does the integral get the two locked layouts? — measured 07-28

**Ranking: 4/4, where the shipped rankings are 0/4 and 1/4.** Ground truth minus its rival, in casts:

| case | point | **integral** | phase-mean N=96 |
|---|---|---|---|
| A2 · 2:00 · Lust@0:20 | ✗ −0.0814 | ✅ **+0.0322** | ✗ −0.1075 |
| A3 · 3:00 · Lust@0:20 | ✗ −0.2145 | ✅ **+0.0462** | ✗ −0.0447 |
| Ex2 · 2:00 · Lust@0:10 | ✗ −0.4535 | ✅ **+0.0093** | ✗ −0.0917 |
| Ex1 · 2:45 · Lust@0:10 | ✗ −0.2183 | ✅ **+0.0703** | ✓ +0.0086 |

**Optimising on it** (same three move classes and multi-start as `phaseRerank`, score swapped):

| | A2 |
|---|---|
| integral argmax | Icy Veins 0:00/0:20 · **Icon 0:20** · Gem 0:21 · AP 0:21 · Berserking 0:48 |
| ground truth | Icy Veins 0:00/0:20 · Icon 0:20 · Gem 0:20 · AP 0:20 · Berserking 0:40 |
| | **structure identical**, Δ = **0.0108 casts** — inside `tieBandPct` |

★ A2's *structure* is exact: Icy Veins at the pull, Cold-Snap Icy Veins onto the Lust, the value
cluster with the Lust, Berserking inside the Lust. What is left is a within-band tie-break (Gem/AP one
second, Berserking @48 vs @40) — D2 territory, not a scoring question.

⚠ **A3 is not there**: the integral argmax puts both clusters at 0:33 / 2:33 rather than 0:20 / 2:20,
Δ = **0.1145 casts**. That is *inside the uncorrected integral's own 0.09–0.34-cast error band*, so it
is not yet an answer either way — it has to be re-asked once the three corrections land.

### ⛔ CORRECTION 1 IS DELETED, NOT LANDED — an integral needs NO fight-end window (user, 07-28)

*"I don't fully understand integral, but from what I know about them we shouldn't need any variance at
fight end no?"* — **correct, and it removes a term rather than fixing one.**

The kill window is a **de-quantizer**. The per-cast sum has a 0/1 cliff at the terminal cast — one
completing at 119.99 counts 1, one at 120.01 counts 0 — so it needs a smear, and PHASE12 §9's
`credit = min(1, (cut − start)/dur)` *is* that smear. `U[T, T+d]` is the **interpretation** of a
smoothing device, reverse-derived from it, not an independent claim about fight lengths.
`∫₀^T rate(t) dt` has no cliff: the terminal cast comes out fractional automatically.

So a window past `T` could only be expressing uncertainty in `T` itself — and measured, it does **no
ranking work**:

| integral, ground truth − rival (casts) | A2 | A3 | Ex2 | Ex1 |
|---|---|---|---|---|
| `none` — hard `∫₀^T` | +0.0322 | +0.0462 | +0.0093 | +0.0703 |
| `sym` — the old ±0.5 | +0.0322 | +0.0462 | +0.0093 | +0.0703 |
| `oneSided` — PHASE12 §9's `U[T, T+d]` | +0.0322 | +0.0462 | +0.0093 | +0.0703 |

**Identical to four decimals, every case.** Two plans compared at one `T` share the tail flux, so the
window scales both equally and cancels. ⇒ default **`none`**, which needs no constant and no
justification at all. `cfg.killMode` keeps the other two so the claim is one flag to re-test.
⚠ Not over-claimed: the case that could bite is two plans differing in *rate* at the kill, which these
four do not cover.

★ This is the second time in one day that the right move on the integral was to **delete** a term the
sum needed. Both times the term was a discreteness artifact wearing a physical interpretation.

### (superseded) Correction 1 as first attempted — the one-sided kill window

`KW = 0.5` → `KWD = (BASE_CAST − MAX_STACKS·STACK_CAST_REDUCTION) / m`, weight `min(1, (T + KWD − t)/KWD)`.
The old form paid a cast completing exactly at T only **½**, and at zero haste its width (1.0 s) was
**33 % narrower** than the cast it stood in for (1.498 s). `self-consistency` unchanged (`0.00e+0`,
0 structural) — the integral is a diagnostic, so nothing that ships moved.

⚠ **It is a level shift, not a ranking term, on the A2 pair**: gt and rival both rose by +862 and the
gap stayed **0.0322 casts to four decimals**. Both layouts run at the same steady interval into the
kill, so the flux near T is identical and the window scales them equally. It will matter where two
layouts differ in *rate* at the kill — which is exactly the case the symmetric window mispriced.

### ★★★ THE DIRECT QUESTION — do the user's layouts beat the CLIPPING plans under the integral?

Not the phase-reranked rivals: the **original** point-score plans, the ones that banked the terminal
partial cast. User layout minus that plan, in casts:

| case | point score | **INTEGRAL** | last cast start / frac — yours | — the model's |
|---|---|---|---|---|
| A2 · 2:00 · Lust@0:20 | ✗ −0.1135 | ✅ **+0.1722** | 118.637 / 0.9099 | **119.965 / 0.0234** |
| A3 · 3:00 · Lust@0:20 | ✗ −0.1938 | ✅ **+0.0531** | 178.840 / 0.7744 | **179.932 / 0.0454** |
| Ex2 · 2:00 · Lust@0:10 | ✗ −0.4535 | ✅ **+0.0093** | 118.939 / 0.7083 | 119.642 / 0.2390 |
| Ex1 · 2:45 · Lust@0:10 | ✗ −0.2183 | ✅ **+0.0703** | 163.840 / 0.7744 | **164.901 / 0.0661** |

**4/4 for the user, and the clipping is legible in the last two columns.** In every case the model's
plan puts its final cast start within ~0.4 s of the kill, earning a 0.02–0.24 sliver, while the user's
carries a genuinely partial 0.71–0.91 tail. That is the lattice slid so one more cast squeaks under the
wire — not a better plan.

A2 decomposed, and it is the whole margin:

| | full casts completing before T | terminal partial | total |
|---|---|---|---|
| user | 92 = 173737 | 1571.7 | 175308.9 |
| model | **93 = 175465** | **40.4** | 175504.9 |

The model's entire +196 point win is converting a 0.91-of-a-cast tail into a 93rd *full* cast plus a
0.02 sliver — **+0.1135 casts of pure phase.** The integral, which has no terminal cast to bank, flips
it to **+0.1722 for the user**.

⚠ Margins against the integral's own uncorrected error band (0.09–0.34 casts, §8f): A2's **+0.172 is
decisive**; A3's +0.053, Ex1's +0.070 and Ex2's +0.009 are **inside it** and are direction, not proof,
until the two edge corrections land.

### ⇒ What this means for §8e

`phaseScore`/`phaseRerank` should be treated as **provisional**. They established the objective and
they moved 13 of 13 swept cells in its favour, but they compute it by brute force at 12× the cost and
still measure UNSTABLE on the one criterion that discriminates. The corrected integral is the same
objective computed exactly and once. ⛔ It is *not* a return to PHASE12 §6.10's rejected quantity —
that was the integral **as it stands**, with a retired kill window and two missing edge terms.

## 8g. ✅ THE TWO REMAINING EDGE TERMS DO NOT EXIST — measured 07-28, 13/13 rows at 0.00000

Asked to fix them. Measured first, and **neither is a term.** Against an N=96 phase mean of the exact
per-cast sum — the definition the closed form is graded against — with each buff self-pressed and
interior on a long fight:

| buff | h | integral | phase-mean N=96 | Δ |
|---|---|---|---|---|
| Icy Veins | 0 / 300 | 2.66667 / 3.17396 | 2.66667 / 3.17396 | **0.00000** |
| Berserking | 0 / 400 | 0.66667 / 0.83576 | 0.66667 / 0.83576 | **0.00000** |
| Power Infusion | 0 | 2.00000 | 2.00000 | **0.00000** |
| Mind Quickening Gem | 0 | 2.79011 | 2.79011 | **0.00000** |
| Skull of Gul'dan | 200 | 1.47960 | 1.47960 | **0.00000** |
| Drums of Battle | 100 | 1.01458 | 1.01458 | **0.00000** |
| Icon (value) | 0 / 300 | 1.02922 / 1.22501 | identical | **0.00000** |
| Serpent-Coil (value) | 0 | 1.12052 | identical | **0.00000** |
| Arcane Power (value) | 0 / 400 | 3.00000 / 3.76094 | identical | **0.00000** |
| Icy Veins + Icon together | 0 / 300 | 3.90173 / 4.64397 | identical | **0.00000** |

### Why the haste-edge term I derived is wrong — I double-counted

The derivation was: the cast in flight at a window's leading edge was started at the *old* rate, so the
new rate does not begin at the edge; correction `½(1 − i_before/i_after)` per transition, netting
`−(r−1)²/(2r)` per window. For Icy Veins at h = 0 that predicts **−0.0167 casts**. Measured: **0.00000.**

The error: **each buffed cast saves `(i_out − i_in)` of time no matter where in the window it sits**, and
which casts are buffed is decided by which *start* inside `[a,b]` — the snapshot rule. Phase-averaged,
`E[casts started inside] = (b−a)/i_in`, so the gain is `(b−a)·(1/i_in − 1/i_out)` exactly. The "late
start" at the leading edge is already priced by the count; charging for it again is a second bite.

### Why the value back-edge term does not exist either — the two edges cancel identically

At the leading edge the straddling cast **completes inside**, so the discrete truth credits it in full
while the integral credits the post-edge fraction — expectation **½ a cast**, so discrete − integral =
**+½**. At the trailing edge the straddling cast **completes outside**, so discrete credits 0 while the
integral again credits **½** ⇒ **−½**. Both halves are ½ *in cast units*, independent of the local
interval, so they cancel for every window at every haste.

⇒ **PHASE8 §25's `boundaryCharge` is correcting an error that does not exist in expectation.** It was
defined against a *realised* completion count (`nSim` = board casts completing inside) versus the
continuous count — i.e. it drags the integral toward **one lattice phase**. That is the same
phase-realisation confusion this whole section is about. It stays OFF, now for a derived reason instead
of "it measured ANTI-B2".

★ **Third time today the correct fix was deletion** (the kill window, §8f; these two). Every one was a
discreteness artifact wearing a physical interpretation.

### ⚠ What the residual in the SWEEPS actually is — and it is not an edge term

The 0.085–0.34-cast integral-vs-phase-mean spread reported earlier on four *sweeps* survives correct
pinning and survives removing the external entirely (0.111 with no Bloodlust at all), so it is neither
the pin nor the call-anchoring. It is the **press-snap Jensen gap**: `scoreStart` evaluates a self-press
at its *expected* slip, while the phase expectation averages the *value* over the slip distribution. For
a lone interior window the value is flat in the start position — which is exactly why the table above
reads 0.00000 — but once a window's edge sweeps across *another* window's edge the covered overlap is
piecewise-linear with kinks, and evaluating at the mean ≠ the mean of the evaluation.

**It moved no argmax** — 4/4 on the original sweeps and 3/3 on the external-free re-run. Open, bounded,
and a different animal from the two terms this section closes.

## ✅ FIXED 07-28 — the Arcane Blast debuff had only TWO cases in the engine; the game has three

**Found by the user, in one sentence:** *"if the intermission, or AoE, or anything that would make you
stop casting, lasts between 6.5–8 seconds, then the weird rule about Arcane Blasts applies — the first
one cast will still have the increased casting speed because of the stacks, but won't finish casting
before the stacks reset."*

Exactly right. The debuff is applied on **completion** and expires `DEBUFF_DUR = 8 s` after the previous
cast's **start**. With `G` = start→start gap and `ct` = the resuming cast's length:

| | condition | game | engine, before |
|---|---|---|---|
| refreshed | `G ≤ 8 − ct` | 3 stacks throughout | 3 ✓ |
| **mid-cast lapse** | **`8 − ct < G < 8`** | cast is **fast** (snapshot), then **1 stack** | **3 ✗** |
| cold | `G ≥ 8` | 0 stacks, full re-ramp | 0 ✓ |

The walk had a single binary test at cast start (`if (t − lastCastStart >= DEBUFF_DUR) stacks = 0`), so
inside the band it reported stacks `[3,3,3]` where the game gives `[3,1,2]`, and charged **zero** for a
real cost of `d₁ + d₂` = **0.6653 casts** — half the full opener toll, on a gap that looks harmless.

★ **And the user got the haste direction right too**: the band is `(8 − ct, 8)`, so its **width is the
cast time** and it **shrinks** as haste rises — (6.502, 8) at h=0, (7.001, 8) at the GCD cap.

**Fix:** `lapsedMidCast` in `simulateRaw` — resolved after `castLen` is known, so the cast keeps its fast
speed and only its *completion* restarts the chain at 1.

**Verified:** the three-way table reproduces `[3,1,2]` across the band; `self-consistency` `0.00e+0` with
0 structural violations; `plan-diff` **IDENTICAL** on the swept corpus. No preset has a gap in the band
— the corpus downtimes are 5, 15, 40, 40, 54, 135 and 155 s — so this is **pure correctness with zero
plan movement**, and it will bite the first encounter with a ~7-second movement or AoE phase.

⚠ Same rule covers an **AoE phase**: Arcane Explosion neither builds nor refreshes the AB debuff, so an
AoE window is a gap in the AB stream and its exit takes the identical branch.

## 9. What is still open

1. **Cost.** The phase-mean is N× `simulate()`. It cannot go into the search at N=48 as-is. Two routes:
   charge each haste-window edge and the kill their phase *expectation* analytically inside the walk
   (O(1), no averaging), or average at low N and measure the error. Neither is written.
2. **A3 and Ex2 still lose**, by 0.017 and 0.089 casts. Those layouts differ from ground truth in more
   than one press, and the residual has not been isolated to a press the way Berserking was.
3. Whether the same slide should be applied to **intermission and AoE walls**, which are also
   externally anchored and also specified to the second.

---

## ⛔ D3 — WITHDRAWN THE SAME DAY. It is not Icy Veins × Bloodlust; it is BLOODLUST ALONE, and it is the harness

**Status: WITHDRAWN. The entry below was filed on an incomplete ladder and the next measurement
refuted it. Kept in full because the correction is the useful part.**

The ladder that produced D3 added Bloodlust *on top of two Icy Veins uses*, so it could not tell
"the pair interacts badly" from "Bloodlust alone is mis-counted". Splitting them:

| layout | model `Σfrac` | sim casts | model − sim |
|---|---|---|---|
| bare | 78.669 | 78.660 | +0.008 |
| Icy Veins @20 **only** | 81.335 | 81.325 | +0.010 |
| **Bloodlust @20 only** | 86.511 | 86.732 | **−0.220** |
| Bloodlust + Icy Veins @20 | 89.256 | 89.477 | −0.221 |

**The whole error is in Bloodlust by itself**, and it does not grow when Icy Veins is added. Icy Veins'
marginal value *inside* Lust is **2.745 casts in both engines — identical to three decimals**. There is
no interaction defect, and the implied doubly-floored interval is **1.0000 s**, exactly what the model
assumes. D3's mechanism was wrong in every particular.

### What it actually is — and it is already documented, as a HARNESS limitation

This is `docs/TOOLING.md`'s *"the sim cannot start an external's aura off a cast boundary"*, seen from
the other side. At h=0 casts sit on `…19.498, 20.998…`, so a Lust **called at 20**:

    model   aura [20, 60]        usable [20.998, 60]      — the 0.998 s slip is LOST (rule 5)
    sim     aura [20.998, 60.998]                          — a full 40 s, because the APL can only
                                                             fire it on the mage's GCD

The sim gets **0.998 s more Lust than the model**, worth ≈ 0.20 casts at the 1.1538 s Lust interval —
against a measured 0.220. ⇒ **The model is right and the sim is short a rule.** ESTABLISHED-FACTS rule 5
and the TOOLING entry both say so explicitly, and both warn against "fixing" the model to match.

### ⚠⚠ WHICH MEANS THE GROUND-TRUTH INVERSION MAY BE AN ARTIFACT

Every duel in this file was run on a harness that hands Bloodlust ~1 s of free extra uptime. That
**systematically favours whichever layout packs more into Lust** — which is precisely the hand-built
layout in both ground-truth cases. The 2.0 DPS ± 0.37 measurement stands as a measurement; what it
means is now in doubt.

### ⛔ …AND THAT SUSPICION IS ITSELF REFUTED — tested the same hour

The harness cannot be *made* to start an aura off a GCD, but the model can be given **the sim's own
window**, which is the same comparison from the other side. Pinning Lust at the boundary the sim
actually uses (20.998 instead of 20):

| Lust pinned at | model `Σfrac` | sim casts | model − sim |
|---|---|---|---|
| 20 | 86.511 | 86.732 | −0.221 |
| **20.998** | 86.742 | 86.732 | **+0.010** |

**The absolute offset is 100 % the anchoring convention** — aligned, the model returns to the same
±0.010 agreement it shows everywhere else. Mechanism confirmed.

**But the ranking does not flip.** Re-scoring the two ground-truth layouts with the sim's own Lust
window:

| Lust anchored at | model plan | hand plan | model's verdict |
|---|---|---|---|
| 20 (the model's rule) | 101.5996 | 101.4861 | model plan by **0.1135** casts |
| **20.998 (the sim's)** | 101.3312 | 101.0041 | model plan by **0.3271** casts |

against the sim's *hand plan wins by 2.0 ± 0.37 DPS*. **Giving the model the sim's own Lust window makes
the disagreement bigger, not smaller.**

⇒ **The inversion is real and is NOT a harness artifact.** The anchoring convention explains the 0.22-cast
*absolute* offset and none of the *relative* ranking. Retract the suspicion above.

### Where that leaves it

Cast counts now agree between the engines to ±0.010 once the windows are aligned, and the sim's own
figures put damage-per-cast at 2072.1 (model plan) against 2072.5 (hand plan) — **the hand plan's casts
are worth 0.02 % more**. With counts equal, the entire remaining disagreement is therefore on the
**value** side: *which casts get covered by which cooldown*, not how many casts there are.

⇒ **Next: audit the value windows, not the lattice.** For each layout, compare the model's per-cast
`sp` and `dmgMult` board against the sim's, cast for cast. `tools/model-audit.mjs` does exactly this and
needs a native runner (`tools/build-runner.sh`). The lattice is now excluded by measurement, which makes
this a much narrower search than it was this morning.

### (original D3 entry, refuted above, retained for the record)

## D3 — the model UNDER-COUNTS CASTS WHEN ICY VEINS OVERLAPS BLOODLUST (07-28)

**Status: ⛔ REFUTED — see the correction immediately above.**

Built up one **haste** cooldown at a time (value cooldowns cannot change a cast count), bare fight →
the hand-built layout, `T=120 · h=0 · 1000 SP · 25 %`. Model boundary-credited count against wowsims:

| layout | model `Σfrac` | sim casts | model − sim |
|---|---|---|---|
| bare | 78.669 | 78.660 | +0.008 |
| Icy Veins @0 | 81.391 | 81.381 | +0.010 |
| + Cold-Snap Icy Veins @20 | 84.057 | 84.044 | +0.012 |
| **+ Bloodlust @20** | 91.979 | 92.198 | **−0.218** |
| + Berserking @40 | 92.910 | 93.128 | −0.218 |

**The error appears entirely on one step and does not grow afterwards.** Two Icy Veins uses alone are
fine (+0.012). Adding Bloodlust *on top of the second Icy Veins* costs **0.230 casts** of accuracy in a
single move, and Berserking then adds nothing.

### The condition

Icy Veins @20 (covering 20–40) and Bloodlust @20 (covering 20–60) **fire at the same instant and
overlap for 20 s**. At h=0 that pair is **×1.56**, which is past the 1.5 the GCD floor needs — so this
is precisely the **overcap** region the facts corpus documents. The model computes the floored interval
as

    cast = msq(1.498 / 1.56) = 0.960 s      gcd = msq(max(1.0, 1.5/1.56)) = 1.000 s
    interval = max(0.960, 1.000) = 1.000 s

and gets 20 casts from the 20 s overlap. The sim gets ~0.22 more, implying an effective interval nearer
**0.989 s**. **Something about how wowsims resolves a doubly-floored window is not what the model
assumes**, and the model is the one that is wrong — its number is a clean 1.000 s and reality is not.

### Why this matters more than its size

* It is **the** cause of the inverted ranking on ground truth. The hand-built layout is exactly the one
  that stacks Icy Veins into Lust; the optimizer's layout is the one that does not. Under-counting the
  stacked layout by 0.23 casts is what makes the optimizer prefer its own.
* It therefore **explains the whole sum-vs-integral episode without needing a new objective.** The
  entries below observe a real inversion; this is its mechanism. ⛔ Do not change the objective on the
  strength of them.
* It sits on the **overcap**, which this session established is a *price, not a prohibition* — and the
  planner's advice about when to stack haste into Lust is derived from exactly these numbers.

### Next step

Measure the sim's actual steady-state interval inside a doubly-floored window — `SIMLOG=1` on an
Icy-Veins-plus-Bloodlust fight, and read consecutive Arcane Blast starts between 20 s and 40 s. If they
are 0.989 s rather than 1.000 s, the fix is in `stepFor`'s floor arithmetic and the whole corpus's
overcap numbers need re-deriving with it.

## ★★★★★★ LOCALISED — the model MISCOUNTS CASTS by ~1 on a mid-ramp Icy Veins (07-28)

**Status: OPEN, and it supersedes the objective debate below as the first thing to fix.**

Reverse-engineering the ground-truth disagreement to its arithmetic, as the user asked (*"it should just
be an equation… figure out the reverse engineering towards the known solution"*). Example 1
(`2:00 · h=0 · 1000 SP · 25 % · Lust@20`):

⚠ **First pass compared the wrong quantities and is corrected here.** `castCount` is casts *started*
before T — an integer, 94 vs 93 — while the sim reports an **average over its kill window** `U[T, T+d]`.
The comparable model quantity is `Σfrac`, the boundary-credited count. Like for like:

| | model `Σfrac` | **wowsims** | error |
|---|---|---|---|
| optimizer's layout (Icy Veins fires **6.498**, mid-ramp) | 93.023 | **93.008** | **+0.015 — essentially exact** |
| hand-built layout (Icy Veins fires **0**, on the pull) | 92.910 | **93.126** | **−0.216 — under-counted** |

| | model says | sim says |
|---|---|---|
| which layout fits more casts | optimizer's, by **+0.113** | hand-built, by **+0.118** |

And the damage *per cast* is the same in both plans to 0.02 % (2072.1 vs 2072.5). **So the entire
disagreement is cast count, and the model has the comparison backwards** — but the error is **0.216
casts, not ~1**, and it is **not** an over-count of the optimizer's layout. The model is accurate on
that one. It **under-counts the hand-built layout**, whose distinguishing feature is that **Icy Veins
fires at 0, hasting the opening ramp**.

⇒ **The defect is: the model under-credits Icy Veins used at the pull, by ~0.22 casts.** That is
coherent with the open question further down — the model *does* show a pull advantage (+2.078 %), and
this says the true one is **larger** than the model believes.

★★ **This is not an objective-choice error.** Value, alignment, the per-cast sum, the integral — none of
them are implicated. The two plans' casts are worth the same. One plan is simply being credited **a cast
it does not get**, and it is the plan whose Icy Veins fires *after* the ramp rather than at the pull.

⇒ **The prior conclusion — "the ranking is inverted, therefore the objective may be wrong" — is
premature and possibly wrong.** The ranking IS inverted, that measurement stands (2.0 DPS ± 0.37). But
the cause localises to the **cast lattice**, not to the choice of objective. A scorer summing the wrong
number of casts will rank wrongly under *any* objective, and swapping the sum for the integral would
paper over it rather than fix it.

### Why this is the right thing to chase first

* At **0.216 casts** it is ~0.23 % of the fight — 3–40× the margins argued over this session
  (0.005–0.07 %), and enough to flip this ranking on its own.
* ⛔ **The ramp is EXONERATED (07-28).** Isolated on a bare Icy-Veins-only fight, the model matches the
  sim to **±0.010 casts at every placement including the pull** (ESTABLISHED-FACTS, *the model's cast
  lattice is exact*). The −0.216 does **not** reproduce without other cooldowns present. ⇒ The defect is
  in cooldown **interaction**, not in the cast walk. Next suspects, in order: the Cold-Snap second Icy
  Veins, the pinned external, and the value cluster's effect on the lattice.
* It plausibly subsumes the **open question** below (the unexplained +2.078 % pull advantage at h=0).
  If the model miscounts the ramp under haste, a phantom pull advantage is exactly the symptom.
* And it is checkable without any objective change: `model-audit` compares the model's cast board to
  wowsims' combat log cast-for-cast.

### Next step, concretely

Isolate it on a **bare fight**: Icy Veins alone at 0 versus at an interior second, model `Σfrac` against
wowsims' cast count. If the −0.216 reproduces there, the defect is in how the walk hastes the three ramp
casts (2.500 / 2.166 / 1.832 s) and needs no plan context at all. `tools/model-audit.mjs` gives the
cast-for-cast diff once a native runner is available (`tools/build-runner.sh`).

⛔ Do **not** switch the objective on the strength of the entries below until this is resolved. They
observe a real inversion; this entry explains it without needing a new objective.

## ★★★★★ THE SIM HAS RULED — the model's ranking is INVERTED on ground truth (07-28)

**Status: ESTABLISHED. This is the finding the objective question was waiting on.**

Two layouts supplied as ground truth with **Bloodlust pinned at 0:20**, deliberately late enough that
"Icy Veins reaching left to cheese an Arcane Blast stack is no longer even plausible". Duelled
head-to-head in wowsims, common random numbers:

| case | model scorer says | **sim says** |
|---|---|---|
| `2:00 · h=0 · 1000 SP · 25 %` | hand-built layout **−0.112 %** | **hand-built WINS by 2.0 DPS ± 0.37** (5 seeds, ~5.4σ) |
| `3:00 · h=0 · 1000 SP · 25 %` | hand-built layout **−0.134 %** | hand-built wins by 0.4 DPS (inside the tie band) |

**On the case that resolves, the model's ranking is inverted.** Not close: 2.0 ± 0.37 DPS is ~0.13 % of
the fight, roughly 3× `BENCH.tieBandPct`, and the model had the sign backwards.

⇒ Combined with the entry below — the retired continuous integral ranks these same hand-built layouts
**first** where the per-cast sum ranks them last — the picture is consistent across four independent
cases and two independent instruments:

* the **per-cast sum** (what ranks today) prefers the optimizer's layouts,
* the **continuous integral** prefers the hand-built ones,
* the **execution-jitter expectation** collapses the sum's margin by 81–88 %,
* and the **sim** — which does not care which objective proposed a plan — prefers the hand-built ones.

**Three of the four point the same way, and the fourth is the one currently in charge.**

### What this does and does not establish

**Does:** the single-phase per-cast sum is not a reliable ranker at h=0 with a late-pinned Lust. Its
sign can be wrong against the arbiter. That is a stronger statement than "it over-resolves".

**Does not:** it does not yet establish the integral as the replacement. Only two of these cases were
scored under the integral, and neither has been swept across haste. The integral has its own known
defect (over-paying a partial cast at a window's back edge) and PHASE12's measurements against it stand.

⇒ **The next measurement is no longer optional and no longer ambiguous**: score the whole corpus under
both objectives, and sim-duel *every* disagreement. If the integral's picks keep winning, the objective
changes. Four cases is a strong prior, not a corpus.

## ★★★★ REVERSE-ENGINEERED FROM GROUND TRUTH — the objective that produces the wanted layouts is the RETIRED INTEGRAL

**Status: ✅ ACTED ON 07-30 — the integral now ranks, paired with a tie-break. See §8h below for what
landed, what it fixed, and the two residuals it did not.** (Everything in this section stands as
written; it was the correct call.)

User, 2026-07-28, supplying two hand-built layouts as ground truth: *"If the lust is pinned at 10 to
dissolve any possibility of the arcane blast stacks mattering, this is what I'm 100 % sure I want the
output to be. That's a ground truth and you can reverse engineer from there."* And separately: *"I don't
care what kind of math we have to make for my output to be the correct one, but the one that does is
the right approach. IF it's the integrals or whatever."*

It is the integrals. Both layouts, scored under the two objectives the engine still computes:

| case | per-cast sum (what ranks today) | continuous rate integral (retired, still emitted as `integral`) |
|---|---|---|
| `2:45 · 1387 SP · 38 %` | model +0.2270 | **user +0.0731** |
| `2:00 · 1000 SP · 25 %` | model +0.4535 | **user +0.0093** |

**The sum ranks the model's layout first in both cases. The integral ranks the user's layout first in
both cases.** Two independent cases, both reversing.

### Why, and it reframes PHASE12's retirement rather than contradicting it

The user's reasoning is *explicitly continuous*: *"we lose 4 seconds of Icon under IV alone, and gain 4
seconds of icon under lust+zerking… that is strictly better."* That sentence **is** a rate integral —
it prices window-seconds against the local cast rate, never counting whole casts. The discrete sum
cannot express it, and this file already documents why: the two 4-second regions contain **exactly three
casts each** at this lattice phase, so the sum sees a tie (or a loss) where the continuous quantity sees
`3.575 − 3.000 = +0.575` casts (ESTABLISHED-FACTS, *weak dominance*).

⇒ **The sum is one lattice phase; the integral is the phase average.** PHASE12 retired the integral for
disagreeing with the sum by a median 0.2114 % against ranking margins of 0.005–0.07 % — but that is
exactly the relationship a *mean* has to a *single sample*, and the retirement argument assumed the sum
was the truth and the integral the error. The user's ground truth is evidence for the opposite reading.

Corroborated independently: the empirical phase average (`tools/jitter.mjs`, ±1 s of press error)
collapses the sum's margin by **81–88 %** on the 2:45 case and gives the hand-built layout the better
floor. Two different smoothings of the same single-phase artifact, both pointing the same way.

### ⛔ What must NOT be done with this

* **Do not simply switch `robust` back to the integral.** PHASE12's measurements stand as measurements;
  what changed is their interpretation. The integral also has real defects the sum does not — it
  over-pays a partial cast at a window's back edge, which is what the (default-off) boundary charge was
  built to correct.
* **Do not tune scorer terms against the integral** — four terms were falsified that way (PHASE12
  §6.1–§6.3).
* **Do not treat two reversing cases as a proof.** They are ground truth from one user at one haste
  level (h=0) with Lust pinned to remove the stack question. The claim that needs testing is whether the
  integral ranking is better **across the corpus and at rising passive haste**, which is exactly the
  regime the user says they cannot check by hand.

### The programme this implies

1. Score the whole golden corpus under both objectives; list every case where they disagree.
2. For each disagreement, duel the two layouts **in the sim** — the sim is the arbiter for a search or
   ranking question, and it does not care which objective proposed the plan.
3. If the integral's picks win in the sim, the retirement is overturned on evidence and the objective
   changes; if they lose, the user's ground truth is a low-haste special case and needs its own rule.
4. Either way the golden corpus is re-derived. This is a phase of work, not an edit.

⚠ Until step 2 has run, **neither objective is established as correct** and `index.html` is unchanged.

## ⚠⚠ THE SCORER OVER-RESOLVES — most of its margin is not executable

**Status: OPEN, and it is the most consequential open item in this file.** Not a defect in what the
scorer computes — the objective is exact and `self-consistency` reads `0.00e+0`. A defect in what it is
asked to *rank*: a single lattice phase, when a real pull is a distribution over phases.

User, 2026-07-28: *"I don't fully wanna trust the outputs yet, because the current scorer says that my
suggested changes are worse. But they just aren't. They might be under specific clippings and whatnot."*
Measured on the `2:45 · h=0 · 1387 SP · 38 % crit · Lust 0:10` fight, model plan against the
hand-written one:

| | model | hand-written | Δ |
|---|---|---|---|
| **exact** (what the tool ranks on) | 133.0817 | 132.8547 | **−0.2270** |
| common ±1 s | 132.8039 | 132.7663 | −0.0376 |
| pinned call moves | 132.7936 | 132.7663 | −0.0273 |
| independent ±1 s | 132.7059 | 132.6622 | −0.0437 |
| **worst case** | 132.1810 | **132.3009** | **+0.1199 in the hand-written plan's favour** |

★ **81–88 % of the model's margin evaporates once presses cannot land to the millisecond.** What
survives is 0.027–0.044 casts ≈ **0.03 % of the fight** — inside the tool's own `tieBandPct = 0.05 %`
"too close to call" band. By the project's own standard these two layouts are **a tie under realistic
execution**, and the hand-written one has the better floor and roughly a third less spread
(range 0.57 casts against 0.90 on the independent grid).

⇒ **The user's distrust of the ranking is justified, and it is narrower than "the scorer is wrong".**
The scorer is right about the number; the number is a single-phase realisation, and the ranking margin
it produces is mostly phase artifact rather than signal. Same root as D1, but this is the consequence
that actually reaches the user: it is what decides which plan gets printed.

**The design question it poses**, and it is a real one rather than a bug to patch: should the tool rank
on the exact single-phase objective, or on the phase-averaged one? Ranking on the average would resolve
D1, D2 and this entry at once, and would make the corpus's *weak dominance* rule
(`docs/ESTABLISHED-FACTS.md`) the operative one — but it changes every plan and needs the whole golden
corpus re-derived, so it is a phase of work, not an edit.

⛔ Do **not** implement it as "restore the rate integral". That was a different quantity, it disagreed
with the per-cast sum by a median 0.2114 % against ranking margins of 0.005–0.07 %, and it was retired
for cause (archived PHASE12 §6.10). The phase average of the *exact* per-cast sum is not the integral;
it is the same objective evaluated over a distribution of press offsets, which is what
`tools/jitter.mjs` already computes.

## ✅ CLOSED 07-28 — the h=0 pull advantage is REAL, not a defect

**The sim confirms it to three decimals.** Bare fight, Icy Veins alone, `T=120 · h=0 · 1000 SP`:
the pull is worth **2.722 casts (model) / 2.720 (sim)** against an interior placement's
**2.666 / 2.665** — **+2.10 % model, +2.06 % sim**. Both engines see the same 0.055-cast advantage.

⇒ It never belonged in this file: a defect requires the sim to satisfy a fact the model does not, and
here they agree. Moved to `docs/ESTABLISHED-FACTS.md` as a fact. What remains open is the **derivation**
— the closed form says the pull and the interior should be equal at h=0 — and that is a gap in the
arithmetic, not in the model. The original entry is kept below for its history.

### (original entry, retained)

## ⚠ Superseded — a pull advantage at h=0 that should not exist

**Status: OPEN QUESTION, not yet classified.** At h=0, pressing a haste cooldown at the pull is worth
**+2.078 % (model)** over any interior placement — **0.0554 of a cast**. The sim shows a pull advantage
of the same order (~2.1 % at the coarser resolution it was gathered at).

It is in **both** columns, so it is not D1 (which is model-only by definition). But by the arithmetic it
should not exist: at h=0 nothing is floored, the ramp casts are cast-bound and the steady casts are
GCD-bound, and a haste multiplier divides both by the same factor. ESTABLISHED-FACTS rule 3 explains a
pull advantage **at and above a buff's cap threshold** — h=0 is far below every threshold (the lowest,
Bloodlust, is 243).

It is also **perfectly stable**: identical across all 1224 (cooldown × haste × spell power × crit)
cells of the grid, to a spread of 0.000000. A quantity that constant is a mechanism, not noise.

⚠ **The figure was 2.812 % until 07-28 and that was wrong** — it averaged the *terminal* placement into
the interior baseline, and ESTABLISHED-FACTS rule 4 now establishes the terminal as a separate regime
that is worth *less* than the interior, which inflated the apparent pull advantage. Against a clean
interior (@5…@35, all identical) it is **+2.078 %, or 0.0554 casts**. Same open question, smaller.

⇒ Two possibilities, and picking between them matters: either it is a real effect neither the arithmetic
nor rule 3 captures, **or** part of what is filed above as D1 is real and the model is not wrong about
it. Do not fix D1 without settling this first.

### ★ 07-28 — this now decides a PAIR layout, not just a nudge

Until now this was a tie-break-sized discrepancy on where one cooldown sits. Measuring Icy Veins +
Icon (ESTABLISHED-FACTS P1) put it in charge of a real structural choice for the first time.

The question "press Icy Veins with Icon, or at the pull?" has an exact margin:

    margin(pull − aligned)  =  residual  −  Δ(covered) × s
                            =  0.0544    −  1 × s            at h=340

where `residual` is the ~0.0544-cast pull advantage recorded above and `s` is Icon's per-cast bonus.
So it is not a rounding error on the answer — **it is one of the two terms that decide it**, and
it wins whenever `s` drops below 0.0544, i.e. above ~1841 passive spell power at h=340. Measured:

| passive SP | s | model's answer below the 394 threshold |
|---|---|---|
| 500 | 0.10279 | aligned, stable at every rung ✓ |
| 1000 | 0.07719 | aligned, stable at every rung ✓ |
| 2000 | 0.05153 | **flips in bands** as haste moves — aligned at 200–220 and 300–320, pulled at 150–190, 230–290, 330+ |
| 4000 | 0.03095 | pulled everywhere — entirely on the residual |

The pulled margins in the unstable rows are ~0.003 casts against aligned margins of ~0.16: the model is
choosing the structurally wrong layout by a hair, in a region where the right answer is not close.

⇒ **This raises the priority of settling it.** It also gives a much sharper test than a tie-band
nudge: whatever explains or removes the residual must make the 2000 and 4000 SP rows read "aligned,
stable" below the threshold, while leaving the 500/1000 rows and everything above the threshold
unchanged.

⚠ Attribute this to the open question, **not to D1** — the residual appears in the sim column too, so
by this file's own rule 1 it is not (yet) a model defect. An earlier draft of this block filed it under
D1, which would have made D1 look like it had a sim-confirmed witness. It does not.



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

---

## §8h — ✅ THE INTEGRAL RANKS, PAIRED WITH A TIE-BREAK (landed 07-30)

The user pasted two plans off the shipped build and said the tool was *"generating nonsense … very
inconsistent results, though technically correct some of them, it's generating mistrust"*, then diagnosed
it themselves: *"all the buffs are aligned to their maximum potential … Berserking sits fully inside Lust
and never overlaps with IV, this is a good result, just not consistently placed per the earliest rule."*

**First, what it is NOT.** Three presses of the page's button on the same inputs returned the identical
plan, and the pooled path matched the sequential one the tests run. Not nondeterminism.

### The defect: the per-cast sum misprices a haste buff

T2 declared, sliding ONLY Berserking, asking what its 10 s adds — against ESTABLISHED-FACTS §5:

| Berserking placed… | law | per-cast **sum** | rate **integral** |
|---|---|---|---|
| inside Bloodlust, no Icy Veins | 0.867 | **0.700 / 0.720** ✗ | 0.8667 ✓ |
| with nothing up at all | 0.667 | **0.725** ✗ | 0.6667 ✓ |
| under Icy Veins + Icon + gem (their 2:20) | 0.951 | 0.928 | 0.9514 ✓ |

The sum ranks Berserking-with-nothing-up (0.7250) **above** Berserking-inside-Bloodlust (0.7203). Not a
tie-break failure — a ~0.15-cast inversion, 2–8× the margins it was resolving. Cause: moving a haste
window shifts the whole downstream lattice, which re-prices the terminal cast, so the *marginal*
attribution is contaminated by where the fight ends. The integral matches all three law values to four
decimals.

### And the plateaus are algebraically exact, which is what makes a tie-break principled

T1, sliding only Berserking through the Lust-no-IV gap: presses **40…49 score identically**, and past
the Lust edge the decline is exactly **−0.0200 casts per second** — precisely
`[rate(1.43) − rate(1.3)] − [rate(1.1) − rate(1.0)]`. Real steps are ~2e-2 casts; true ties are exact to
float. So `TIE_REL = 1e-7` is float equality, not a tolerance. ⛔ Do not widen it.

### What landed

`rankPair` / `planBetter` in `index.html`: rank on `simulate().integral`, then break ties by **fewest
distinct press moments → earliest → the flattened press vector** (a total order, so determinism holds).
`phaseFinish` and `phaseRerank` both use it. `simulate().robust` remains the reported number and every
consumer still reads it. `cfg.phaseRank === false` still restores the pre-07-28 behaviour.

**Why this rescues what the 07-28 duel rejected** (Hydross −5.4 DPS, 137σ): that attempt pointed the
ranking at the integral with **no tie-break**, and its two symptoms — *"the cluster stopped being
co-pressed"*, *"the first Icy Veins left the opening ramp"* — are what a flat plateau does to a search
with no canonical member to fall to. Fixing the score without fixing the tie-break traded a biased
ranking for an arbitrary one. The plateau is the integral working; the wandering was the missing half.

### Result on the two tests

**T1 went from six presses wrong to one, at an exact tie.** Icy Veins 0:00/0:20, the whole value cluster
co-pressed on 0:20, Bloodlust 0:20 — the declared layout — with Berserking at 0:41 instead of 0:40 and
`Δ (want − got) = 0.0000` on the reported objective.

**T2 is still structurally wrong**: Berserking at 0:41 (inside Bloodlust) instead of 2:20 (with the
second cluster), and the first cluster smeared 0:20 / 0:21 / 0:23.

### The two residuals, both measured

**R1 — T1's last second is a real 0.0108-cast difference, not noise.** Isolated:

```
Lust + Berserking only     zerk@40 vs @41  Δ = 0.000000   ← a tie, as the law says
Icy Veins + Lust only      zerk@40 vs @41  Δ = +0.010833  ← the whole effect
```

Icy Veins pressed at 0:20 is scored starting 0.625 s late (half the 1.25 s cadence it was pressed
inside); Berserking at 0:40 starts 0.500 s late (half the 1.0 s cadence *it* was pressed inside). Two
windows that abut at their press times therefore overlap by **0.125 s** in the score, and Berserking is
worth zero under IV+Lust (m = 1.716, over the GCD floor): 0.125 × 0.0867 = 0.010833, to the digit.

The user's objection is correct in principle — *"the integral equation has to agree with what I'm
saying"* — and `scoreStart = eff + prevInterval/2` is a point estimate substituted into a nonlinear
overlap, with both presses drawing on **one** lattice rather than two independent ones. ⛔ **But removing
it was measured and is NET WORSE**: `slip = 0` makes 40 and 41 tie exactly (101.39909 both) and then
moves the whole T1 cluster off 0:20 to 0:21 and Berserking to 0:47 — one press wrong becomes four. Left
in, recorded here, reverted. The right fix prices the clamp **at the clamping edge** (see the Al'ar
evidence in `index.html`'s firing block) instead of biasing every window; that is unbuilt.

**R2 — T2's first cluster wants 0:21, not 0:20, and every smear is worse than co-pressing.** With
Berserking held at the declared 2:20, moving one member off 0:20 always loses (isc@21 −0.018,
scb@23 −0.088, AP@23 −0.039, IV@21 −0.073) — **the user is right that the cluster belongs together** —
but sliding the whole cluster as a unit reads 0:20 → +0.000, 0:21 → **+0.0815**, 0:22 → +0.052,
0:23 → +0.023, 0:24 → −0.007. So the co-pressed layout is penalised ~0.08 casts for sitting exactly on
the pinned 20.000 Bloodlust call, and that penalty is what pays for the smear. Unexplained; it survives
`slip = 0` (which moves the peak to 0:22), so it is **not** the R1 mechanism. This is the next thing to
crack.

### Blast radius — not yet graded

`plan-sweep` + `plan-diff` over the 16-cell preset grid: **16 of 16 plans changed**, 13 scoring lower on
the per-cast sum (which is the mispriced number, so that is expected rather than reassuring) and zero
cells unchanged — so `plan-diff`'s own note applies: *"scorer identity is UNPROVABLE here — grade these
with xval-round-diff or a duel, not on this line."* ⚠ **The duel work list is 16 cells and has not been
run.** Until it is, this change is justified by the closed forms and by T1, not by the sim. Harness
gates that DID pass after it: `self-consistency` 0.00e+0 / 0 structural, `sim-request` §0,
`page-equiv` 2/2.

---

## §8i — ✅ THE INTEGRAL SCORED EVERY WINDOW FROM THE PRESS, NOT THE FIRE (fixed 07-30)

User: *"crack anything and everything that's not working as expected and what's preventing the model
from outputting what I want it to."* This is the defect that was producing the smeared clusters they
reported as nonsense (`0:17 Icon · 0:18 Icy Veins · 0:21 gem · 0:21 Arcane Power`).

### The measurement that found it

With Berserking held at the declared 2:20, sliding the whole first cluster off the 0:20 Bloodlust pin
*gained* +0.0815 casts. Isolating one cluster member at a time, against each buff's own value fraction
`s = COEF·ΔSP/(BASE + COEF·SP)` (AP: `s = 0.30`):

| pressed at 0:20 vs 0:21 | s | measured Δ | predicted `0.1496 × s` |
|---|---|---|---|
| Icy Veins (pure haste) | 0 | **+0.00000** | 0 |
| Icon of the Silver Crescent | 0.0772 | +0.01152 | 0.01155 |
| Serpent-Coil gem | 0.1120 | +0.01672 | 0.01676 |
| Arcane Power | 0.30 | +0.04476 | 0.04490 |

Three decimals on all three, and **zero** for the pure-haste buff — which is the fingerprint: only a
VALUE buff could see it.

### The mechanism

Bloodlust is pinned at 20.000 and is a raid external, so it lands mid-cast. The Arcane Blast already in
flight keeps its un-hasted 1.5 s (haste snapshots at cast START — the rule is right) and ends at 21.498.
The integral scored each window from `scoreStart = eff + prevInterval/2` — press time plus expected
slip — so a cluster pressed at 0:20 got windows starting 20.75 and one pressed at 0:21 got 21.75. The
earlier window spends 0.748 s of itself on that slow cast, which costs `0.1496 × s` casts.

**But both presses fire at 21.498** — `auraAt` says so for both, and the discrete walk scores them as
the same plan, because they *are* the same plan. Only the integral separated them.

This is CLAUDE.md's **retired approach #2** — *"expiring a buff window from the PRESS time"* — still live
in the integral path. The discrete walk was fixed in PHASE12 §6.11 to run each window its full duration
from where the ability actually FIRES; `scoreStart` was left behind because nothing ranked on the
integral at the time. The moment it ranked again, a retired convention inside it became load-bearing.

### The fix

`scoreStart: auraAt` (index.html, the firing block). One token.

⚠ **NOT the same as deleting the slip**, which was tried first and measured NET WORSE: `eff + 0` is
still the press time, so it still separates two presses that fire together — it moved T1's cluster off
0:20 entirely and Berserking to 0:47 (one press wrong became four).

### What it fixed, measured

- Single-buff slides across the pin are now **flat to 0.00000** (were −0.045 at 0:20 for Arcane Power).
- The whole-cluster slide is **monotone from 0:20**: 0:20 and 0:21 tie exactly, then −0.029 per second.
- **The integral now prefers Berserking at 2:20 over inside Bloodlust** (144.0797 vs 144.0110) — the
  user's structural claim, reproduced.
- T2's Icon lands on 0:20/2:20 and the T2 gap fell 0.2281 → 0.1509 casts.
- Gates: `self-consistency` 0.00e+0 / 0 structural (the change is confined to `scanAt`/the rate
  integrand; the discrete walk already used `auraAt`).

### ★ AND ONE PLACE THE MODEL IS RIGHT AND THE DECLARED LAYOUT IS NOT

T2's second cluster prefers **2:21 over 2:20 by +0.029 casts, then goes flat**. Isolated, every buff
alone ties 140 vs 141. The fire times explain it: pressed at 140, Icy Veins fires 140.00 but the Icon
and gem fire at **141.50** — the Icon's first use fired at 0:21.5 (its press slipped to the cast
boundary) and its 2-minute cooldown chains from the FIRE (PHASE12 §6.14c). So pressing the second
cluster at 2:20 **splits** it: haste 1.5 s ahead of the value buffs. 2:21 keeps it together.
⇒ This is not a defect to fix. It is a real consequence of a rule the project already verified, and it
means the declared T2 is ~0.029 casts short of its own intent. Worth telling the user rather than
silently matching.

---

## §8j — ✅ THE SEARCH COULD NOT REACH THE DECLARED LAYOUTS AT ALL (fixed 07-30)

After §8h and §8i the scorer agreed with the user's structure. The plans still did not, and this is why —
it is the largest single defect of the day and it is not a scoring one.

### The measurement

Descending from the "everything on the pinned raid call" start that `phaseStarts` already builds:

| | descent reaches | the declared layout scores |
|---|---|---|
| T=120 | 101.380 | **101.441** |
| T=180 | 143.407 | **144.080** |

The T=180 miss is **0.67 casts** — an order of magnitude larger than every scoring defect in §8h + §8i
combined. And the descent's own answer names the cause: it settles on `berserking[10]`.

### The cause

`phaseRerank` moved a single press by at most **±12 s** (`MOVES`) and slid a whole track by at most
**±8 s** (`SHIFTS`). From a start with Berserking at 0:20, the declared 0:40 is +20 away and T2's 2:20
is +120. **The neighbourhood does not contain the answer at any effort**, so `berserking[10]` — the best
point within ±12 s of 20 — was the honest local optimum of a search looking in the wrong place.

### The fix, in three parts

1. **Structural candidate times.** Each press is also offered every window edge already in the plan
   (`t` and `t + dur` for every track), every cooldown's next availability (`t + cd` — this is where a
   SECOND use lives, and it is exactly the Icon's `21.5 + 120 = 141.5`), the pull, and
   `T − dur` (the last moment the buff still runs in full). A few dozen times, not a scan: the
   interesting positions are sparse and named by `ESTABLISHED-FACTS` §4–§5 — value stacks on value,
   haste goes where the other haste is not. Deterministic (sorted, deduped, whole seconds).
2. **Rounds run to a fixed point** (cap 24, a runaway backstop) instead of 3. Measured: feeding the
   descent its own output escaped `berserking[10]` and gained a further 0.064 casts, so the old cap was
   truncating a descent that had not converged.
3. **One cast lattice.** `intervalAt` (the integral's interval) had no millisecond quantisation while
   the walk's `stepFor` did — two different lattices, which CLAUDE.md forbids. Now both are
   `msq(max(FLOOR, …))`, rounding OUTSIDE the floor exactly as the walk does. ⚠ This one measured
   **null** on the residual below (0.003293 → 0.003296); it is kept as a correctness alignment, not as
   a fix, and that is stated rather than implied.

### Result — and it is a mixed one, which is the honest reading

- **T2 is now an exact tie**: `Δ (want − got) = 0.0000` on the reported objective, down from 0.2281 at
  the start of the day. Structurally it is the declared layout shifted onto the Icon's real cooldown
  (`IV[20,141] isc[20,141] scb[22,143] AP[22] zerk[143]`).
- **T1 REGRESSED in appearance**: `IV[5,27] cluster@27 zerk@47`, `Δ = −0.0607`. The stronger search now
  *reaches* the residual-artifact basin below, which the ±12 s neighbourhood had been unable to find.
  A better search over a slightly-wrong objective finds the objective's flaw — that is the regression,
  and covering it up by re-crippling the search would be trading a real bug for a flattering number.
- Whole suite now runs in **9.6 s** (was minutes), because the descent converges instead of grinding.
- Gates: `self-consistency` 0.00e+0 / 0 structural · `page-equiv` 2/2 · `sim-request` §0 PASS.

### ⛔ THE ONE REMAINING DEFECT — an abutment residual of ~0.003–0.008 casts. NOT CRACKED.

Reproduction: kit = Icy Veins + Berserking + Bloodlust, `T=120`, `h=0`, Lust pinned 0:20,
`icyVeins:[0,20]`, slide Berserking:

```
zerk@39  92.776366     ← 1 s inside Icy Veins: −0.0867, EXACTLY the law
zerk@40  92.863104     ← windows abut with MEASURED overlap 0.000 s
zerk@41  92.866400     ← +0.003296 over @40
zerk@42  92.866400     ← flat thereafter
```

What is known:
- **T-independent**: +0.003293 at T = 100/110/120/130/150/200, identically. Not a fight-end effect.
- **Needs the abutting window**: with `icyVeins:[0]` (nothing ending at 40) the slide is flat to
  0.000000. With `icyVeins:[0,25]` (a real 5 s overlap) the step is +0.086667 — one second of overlap,
  exact to the law. So the model prices a genuine overlap perfectly and a zero overlap as ≈0.038 s of
  overlap.
- **Survives the lattice unification** (fix 3 above), so it is not the ms-rounding mismatch.
- **Not only at the GCD floor.** The same family appears under the cap: Berserking abutting Bloodlust's
  end reads −0.023387 then −0.007783 per second where the law says a uniform −0.020267.
- The arithmetic coincidence `0.038 × 0.0866667 = 0.0032933` matches the measured 0.0032930 to four
  figures, where `0.038 = 1.0 − msq(1.5/1.56)`, but the window geometry has zero overlap by direct
  measurement, so this is recorded as unexplained rather than as the mechanism.

⇒ **This residual is now the sole thing between the tool and the user's two declared layouts**, and it
decides T1 outright. It is ~0.003 % of a fight and below anything the sim can resolve, so it cannot be
graded by duel — it needs the integral's edge terms derived, not measured. ⛔ Do NOT widen `TIE_REL` to
swallow it: real law steps of 0.0200 casts/s live only 6× above it.
