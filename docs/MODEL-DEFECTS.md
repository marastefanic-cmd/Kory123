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

* **A declared AoE phase at N ≤ 2 scores WORSE than not declaring one, and that is correct.** Probed
  07-31: an `aoe` segment forces the Arcane Explosion stream unconditionally, and the per-cast ratio
  `M(N)` is **below 1** there — at sp 1387 / crit 38 % it reads `N=1 0.4026 · N=2 0.8186 · N=3 1.2459`.
  (With the Tirisfal 2pc on the whole column divides by 1.2 — the set lifts Arcane Blast by +20 % and
  Arcane Explosion by nothing, `index.html:1475` — giving `0.3355 / 0.6822 / 1.0382`, same bracket but
  **N = 3 within 4 % of a wash**.) So a 2:00 fight carrying an N=2 AoE window scores **125.83 against 132.00** for the same
  fight with no phase declared, and the tool "loses" damage by being told about the adds. That looked
  like an unmodelled `max(AE, AB)` choice. **It is not.** An AoE phase is a **user-declared constraint**
  — *"I am AoEing here"* — not something the planner elects; the UI accepts `N ∈ [1, 20]` precisely so
  you can price a weak forced AoE. RULES §9 already carries this case explicitly and by name (*"below
  threshold a weak AoE (N=2, M=0.82) is a **dead zone the burst dodges** — the plain-fight layout
  squeezed into the non-AoE time"*), and the dodge behaviour was brute-grid enumerated and sim-gated in
  Phase 5. The lower score is the model **correctly reporting the cost of the constraint**, which is the
  answer a planner should give. ⇒ Do not add a `max(AE, AB)` per-cast election to the AoE segment: it
  would silently overrule a constraint the user typed, and it would delete the dead-zone dodge that §9's
  placement thresholds are built on.
  ⚠ The one part that stayed genuinely arguable was the **AoE-start cut**, whose stated justification
  in RULES §9 is the policy *"adds are up, AE is worth several ABs, so you CANCEL the Blast"* — a
  premise false at `M(N) < 1`, where you would not cancel a Blast to start a worse spell. Bounded at
  `≤ 1 − frac` of one cast (≤ ~0.75 % of a 2:00 fight, once per phase).
  ⚖️ **DECIDED 08-04 (clean-the-slate delegation): the cut stands for EVERY declared AoE phase, and
  the declaration is the semantics.** Typing an `aoe` phase into the timeline MEANS "I switch to
  Arcane Explosion at this wall" — the same reading the paragraph above already gives the phase's
  cost, applied to its edge. If you would not cancel a Blast at N ≤ 2, the fight you should declare
  has no AoE phase there (or a `burn` if the adds merely raise damage) — the input language already
  expresses both plays, so a per-N election inside the cut would second-guess a constraint the user
  typed, exactly what the `max(AE, AB)` rejection above forbids. One rule, no crossover knob.

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

---

## §8k — ✅ T1 PASSES. The abutment residual, cracked (07-30)

`node tests/anchors.mjs` → **1 of 2 passed**. T1 emits the declared layout exactly:
`icyVeins[0,20] isc[20] scb[20] arcanePower[20] bloodlust[20] berserking[40]`.

### The mechanism, and it took an instrumented dump to see

§8j left a 0.003296-cast residual that decided T1. Dumping the integral's own segment table (a
scratch copy of `index.html` with the window list and every segment pushed to a debug array) showed it
in one line. The real cast boundaries were **20.4150** and **40.4150**; the windows were:

```
icyVeins  [20.4130, 40.4130]      berserking [40.3750, 50.3750]
segment   [40.3750, 40.4130] len 0.0380 rate 1.000000 → 0.038000
```

`auraAt` is `max(eff, prevCastEnd)` — the previous cast's **completion**. When the interval is GCD-bound
(at h=0 that is every buffed window: a 3-stack Blast is 1.498 s against a 1.0 s floor) the cast finishes
`GCD − castTime` **before** the next one starts. At m = 1.56 that is `1.0 − 0.96 = 0.04 s` of dead time
containing no cast. The discrete walk never notices — it tests each cast's own start against the window.
The integral integrates the continuum and therefore **prices the gap**: Berserking's window opened 0.038 s
before Icy Veins' closed, both plus Bloodlust put m at 1.716 (over the floor, so Berserking is worth
exactly nothing there), and Berserking lost 0.038 s of its 10 s to a sliver with no cast in it.

**Fix:** for a self-press that landed while a cast was in flight, the integral's window starts at the
cast starting NOW (`t`), full duration preserved. `start: auraAt` is untouched, so the discrete walk stays
exactly as `tools/window-span.mjs` verified it against wowsims. An idle press is excluded on purpose (a
press during downtime really does burn duration before casting resumes) and a raid external keeps
`auraAt` (it lands when called). Verified: `zerk@40 = @41 = @42 = @43 = 92.866400`, so the plateau now
begins at 0:40 and the earliest tie-break takes it.

### The tie band, re-derived and bracketed

`TIE_REL = 1e-7` (float equality) rested on "every true plateau is algebraically exact". True on ONE
lattice; false across two. On T1, `d=0` and the whole plan slid `+9 s` are **provably equal by the closed
forms** (IV × Lust = 0 at h=0, the ramp is haste-neutral, cluster and Berserking sit in identical
contexts) and the integral separates them by 0.001097 casts — which decomposes as two ~0.78-cast moves
nearly cancelling (`−0.779542` then `+0.780639`), i.e. accumulated millisecond quantisation, not a term
with an address.

So the band is now **0.002 casts**, bracketed by measurement on both sides:

| | casts | |
|---|---|---|
| resolution floor (two provably-equal layouts) | 0.001097 | — |
| **the band** | **0.002** | 1.8× above the floor |
| smallest verified law step (Berserking's 0.835 s of Icy Veins overlap, `0.835 × 0.013811`) | 0.011532 | 5.8× above the band |
| next law step (Berserking leaving Bloodlust, per second of press) | 0.023388 | — |

⛔ Do not raise it toward the upper bound. At 0.0115 it starts calling a real overlap a tie and the first
casualty is Berserking sliding out of Bloodlust for free.

### Law regression battery — all four reproduce after the change

```
Berserking adds:  Lust-only 0.8674 (law 0.867) · nothing 0.6647 (law 0.667) · IV+Icon+gem 0.9547 (law 0.951)
Berserking leaving Bloodlust: −0.023388 per press-second, uniform = 1.154 s of window × 0.020267  ✓
Berserking inside Icy Veins (under the cap): 0.011532 = 0.835 s × 0.013811  ✓
T2 cluster slide: monotone from 0:20, 20 and 21 tie, then −0.028951/s  ✓
```

Gates: `self-consistency` 0.00e+0 / 0 structural · `page-equiv` 2/2 · `sim-request` §0 PASS.

### ★ T2's last three presses — the model is right again, for a concrete reason

Emitted `icyVeins[19,140] isc[19,140] berserking[141]` against declared `[20,140] [20,140] [140]`, and the
integral prefers the emitted by **0.028920** — well outside the band, so the shape rule never applies.
The fire times say why:

```
declared:  isc@20.000 / 141.496      ← the second Icon slips a whole cast
emitted :  isc@19.000 / 140.000      ← it lands on the boundary
```

The Icon's 2-minute cooldown chains from its **fire**. Pressed at 0:20 it is ready at exactly 140.000 —
which falls just *after* a cast boundary, so the second use is deferred a full 1.496 s to the next one.
Pressed at 0:19 it is ready at 139.000, comfortably before that boundary, and the second use fires at
140.000 on the dot.

⇒ Real, and useful advice a player could act on: **press the Icon a second before the Bloodlust call so
its second use clears the cast boundary at 2:20.** ⚠ But it is also knife-edge — which side of a boundary
a cooldown expires on is exactly the sub-cast lattice phase D1 is about, and a real pull will not put it
there. This is the one remaining disagreement with the declared layouts and it is a **D1 question, not a
scoring one**: the fix is to stop resolving which side of a boundary a cooldown lands on, not to reprice
anything.

---

## §8l — ★★★★★ THE INTEGRAL IS PURE WINDOW GEOMETRY (07-30). The reframing that closed T1 properly.

User: *"since it's an integral can't you just slow down the casting rate once the buff disappears? I
thought that's essentially what we're doing, calculating the summary of an area under the 'dps in time'
function, and you're free to calculate that and model the graph as needed."*

They are right, and it reframes three separate patches this file took in one day. The integral is
`∫ rate(m(t)) dt` — an area under an instantaneous-DPS curve. `m(t)` is fully determined by **window
geometry**: press times, durations, wall events. A cast lattice has no business in it. Every earlier
version of `scoreStart` smuggled the lattice in and paid for it:

| `scoreStart` was | what it cost |
|---|---|
| `eff + prevInterval/2` (press + expected snap) | two presses firing at the same boundary got different windows ⇒ the 0.0815-cast cluster smear the user reported as nonsense (§8i) |
| `auraAt` (previous cast's COMPLETION) | under the GCD floor that sits `GCD − castTime` before the next cast starts, so the integral priced a 0.038 s sliver containing no cast (§8k) |
| `t` (next cast's START) | right about the sliver, but it makes the window edge a function of LATTICE PHASE — the one thing the integral exists to be free of |

⇒ **`scoreStart` is now the legalized press moment and nothing else**: what the player asked for, moved
only by real legality (cooldown chain, trinket lockout).

### Measured

T1's whole-plan slide, `d = 0…6`:

```
lattice-snapped  +0.00000  −0.11091  +0.00002  −0.21160  −0.12487  −0.22737  −0.14064
pure geometry    +0.00000  −0.43956  −0.14650  −0.48795  −0.19490  −0.43824  −0.14519
```

The declared layout goes from winning by **0.00002** to winning by **0.14650**. The near-ties were the
lattice leaking in, not real plateaus.

And the integral is now clean in isolation — a lone press slid anywhere in the fight's interior:

```
icyVeins / isc / scb / arcanePower / berserking, pressed 138…146 on a 180 s fight:  +0.00000 everywhere
icyVeins slid toward the kill, 160→178:  −0.4000 per 3 s = 0.1333 casts/s, exactly rate(1.2) − rate(1.0)
```

Flat where nothing changes, and exactly the law where truncation bites. All four law steps still land
(Berserking adds 0.8674 Lust-only / 0.6647 with nothing / 0.9547 under IV+Icon+gem, against 0.867 /
0.667 / 0.951).

### ★ The architectural split, now explicit

- **Geometry ranks.** `scoreStart` = legalized press time. Smooth, phase-free, reproduces the closed
  forms. This is the *expectation*.
- **The lattice executes.** `start: auraAt` is untouched — press-snapping, cooldown-from-fire, and
  everything `tools/window-span.mjs` verified against wowsims. `sim/planspec.mjs` transcribes from this,
  so it must stay sim-faithful. This is the *realization*.

⚠ It prices a bounded, systematic divergence from the sim: where the sim defers a press to the next cast
boundary, the integral credits from the press — half a cast interval in expectation. **That is the point.**
The player cannot control which side of a boundary their cooldown expires on, so the ranking must not
resolve it. This is the D1 answer, arrived at from the user's argument rather than from another patch.

### Status

`node tests/anchors.mjs` → **1 of 2**. T1 emits the declared layout exactly. T2 is now an **exact tie on
the reported objective** (`Δ = −0.0000`) with the whole plan shifted a few seconds
(`IV[21,142] isc[21,142] scb[24,145] AP[24] zerk[145]`), so what remains there is which member of a
value-equivalent class gets emitted — a tie-break question, not a pricing one. The tie band (0.002 casts,
bracketed in §8k) is narrower than the multi-buff interaction residue that separates them, so the shape
rule never fires. ⇒ **Next: derive the residue for interacting windows the way §8l derived it for a lone
one, and widen nothing until that number is known.**

Gates after: `self-consistency` 0.00e+0 / 0 structural · `page-equiv` 2/2 · `sim-request` §0 ·
`bench --preset "2:00 lust 0:05" --vs naive` **MODEL +1.531 % AGREES with the sim**.

---

## §8m — ✅✅ D1 IS CLOSED. `2 of 2`. (07-30)

```
node tests/anchors.mjs
PASS  T1 — 2:00, Bloodlust pinned 0:20, h=0, 1000 SP, 25 % crit
PASS  T2 — 3:00, Bloodlust pinned 0:20, h=0, 1000 SP, 25 % crit
2 of 2 passed.
```

`.github/workflows/ci.yml`'s `the-tests` job has had `continue-on-error` **removed** — its stated exit
condition was *"the day anchors goes green"*.

### The last defect: a COUPLED coordinate the descent could not reach

After §8l the scorer was right and T2 still emitted `scb[22,142] AP[22] zerk[142]` against the declared
`[20,140] [20] [140]`. The two are **the same plan in value**:

```
integral  WANT 144.10964343   GOT 144.10964343   Δ = −2.8e-14      (bit-identical)
per-cast  WANT 143.930242     GOT 143.930242     Δ =  0.000000      (exact)
distinct press seconds   WANT 2   GOT 4
```

So the tie-break wanted the declared layout. It could not get there, because **every single-coordinate
step toward it is downhill**:

```
slide scb alone  by −2   Δ = −0.067
slide AP alone   by −2   Δ = −0.067
slide zerk alone by −2   Δ = −0.018
slide all three  by −2   Δ = −2.8e-14   ✓
```

Each lone step **splits the cluster**, and Arcane Power (×1.30) multiplies the gem (+225 SP) — the
`dmg × sp = n·d·s` cross term of ESTABLISHED-FACTS §4. A coordinate descent cannot reach a coupled
optimum like that at any effort or any number of rounds; only the simultaneous move can.

**Fix:** a fourth move class in `phaseRerank` — **a co-pressed cluster slides as a unit**. The subsets
are not guessed, they are read off the plan: group the planner-controlled tracks by the second they are
pressed at, and slide each such group together. A handful of candidates, deterministic, and it is the
same structure D2 calls *"cluster with the other presses"*.

### The through-line for all seven

**The cast lattice had leaked into the ranking objective in four separate places** — `scoreStart` (three
different wrong values in one day), the cooldown chain the ranking reads, the interval quantisation, and
a GCD-gap sliver. The integral is `∫ rate(m(t)) dt`; `m(t)` is set by press times, durations and wall
events; a lattice has no business in it. The split is now explicit and must stay:

| | ranks | executes |
|---|---|---|
| window start | `scoreStart` = legalized press moment (geometry) | `start: auraAt` = the real fire boundary |
| cooldown chain | `lastScore` — press-chained | `lastFire` — fire-chained, as wowsims does |
| why | the player controls the press, not which side of a boundary it lands on | `sim/planspec.mjs` transcribes this; it must be executable |

⛔ **Do not merge the two chains.** Fire-chaining the ranking is what dragged the lattice back in through
the back door (the Icon pressed at 0:20 *fires* at 20.998 purely because that is where a boundary fell,
so its 2-minute cooldown read ready at 2:21.496 and the second cluster could not co-press at all).
Press-chaining legality is what PHASE12 §6.14c already banned (HELD 18 of 196).

### Verification, in full

| gate | result |
|---|---|
| `tests/anchors.mjs` | **2 of 2** |
| `tools/law-check.mjs` (new) | all 6 closed forms reproduce at ≤5e-4 |
| `tools/law-check.mjs --self-test` | negative control CAUGHT by 4 lines |
| `tools/self-consistency.mjs` | 0.00e+0, **0** structural violations |
| `tests/page-equiv.mjs` + `--self-test` | 2/2, seeded break caught |
| `tests/sim-request.mjs` | protocol invariants PASS |
| `tests/sim-duel.mjs` | wasm boots, paired delta 0.710 % |
| `bench --vs naive`, 4 presets | `2:00` +1.531 % · `3:20` +1.284 % · `2:40 lust 0:07` +1.491 % · `1:40` +1.774 % — **all AGREE with the sim**, +35 to +43 DPS over the control |

⚠ **Blast radius, stated plainly:** `plan-diff` reports **16 of 16** preset plans changed, 15 scoring
lower on the per-cast sum. That sum is the number §8h proved mispriced, so a drop in it is not evidence
of harm — but it is not evidence of improvement either, and `plan-diff` says so itself
(*"scorer identity is UNPROVABLE here — grade these with a duel"*). The four presets sim-checked above
all agree; **the remaining twelve have not been duelled.** That is the open verification debt from this
change, and `docs/ACCEPTANCE.md` still has no current reading.

### ★ The lasting lesson, and it is about instruments

Seven defects, and **every single one was found by comparing a measured number to a closed form.** Not
one would have been caught by a plan diff, a golden file, or `self-consistency` — which printed a clean
`0.00e+0` straight through all seven, because it asks whether the scorer agrees with *itself*. Two of
them had been absorbed by the goldens for weeks. `tools/law-check.mjs` now automates the method that
worked, with its expectations **derived in the file** and a negative control that proves it can resolve
a 3.6 % error.

---

## §8n — ⛔ OPEN: the 07-30 change REGRESSES the preset corpus. 13σ, sim-measured.

**Status: OPEN and unresolved. `docs/ACCEPTANCE.md` still has no current reading and this makes the gap
worse, not better.** §8m's verification table used the WRONG INSTRUMENT and its conclusion must be
corrected here.

### ★ THE CORRECTION FIRST

§8m reported `bench --preset X --vs naive` on four presets, all "AGREE with the sim", as if that
verified the change. **It does not.** `--vs naive` asks *"does this plan beat mashing on cooldown"* — a
question every remotely sane plan passes. It never compares the NEW plan to the OLD one, which is the
only question a plan change raises. CLAUDE.md says this in so many words (*"if a plan **did** change,
DUEL it head-to-head against its previous layout"*) and §8m cited the wrong tool anyway. Corrected
below with the right one.

### What the right instrument says

`tools/plan-duel.mjs --old <pre-07-30 sweep> --new <current sweep>`: **15 of 16 changed cells flagged
REGRESSED**, with `scorerMoved` reading FALSE — because the *reported* score (`simulate().robust`) is
untouched by this change; only the *ranking* quantity moved. ⚠ So `plan-duel`'s confession rule is
firing on a stale premise (it assumes `robust` is the objective, which was true until §8h) and its
verdict wording overstates its case. But the underlying number is real and needed a sim.

**Morogrim Tidewalker, head to head on the committed wasm, 6000 iterations, 3 seeds:**

```
NEW plan  2602.1 DPS · control 2146.2 · value +455.9 ± 1.47
OLD plan  2612.2 DPS · control 2146.2 · value +466.0 ± 1.46
SIM  NEW − OLD = −10.1 DPS ± 0.75          ⇒ 13σ. REAL.
```

Setup audited before believing it, per the standing caution:
- **Bloodlust transcription ruled out.** `planToSpec` emitted `BL:[4.915]` for NEW and `BL:[5.166]` for
  OLD off the same pinned 0:05 call. Holding it identical changes nothing (−10.1 either way), and the
  same plan at BL 4.915 / 5.000 / 5.166 duels to **+0.0 ± 0.00**.
- **Arm A confirmed.** `bench`'s own fresh solve duels to +0.0 ± 0.00 against the sweep's recorded plan,
  so the sweep and bench agree on what the model emits.

### ⚠⚠ AND YET THE SIM ALSO CONFIRMS §8h. Both of these are true.

The §8h conviction of the per-cast sum was *not* circular — it was checked against the sim on a clean
single-coordinate question, and the sum lost:

```
Berserking inside Bloodlust  vs  Berserking with nothing up   (identical plans otherwise)
  law:  0.867 vs 0.667        sum: 0.7203 vs 0.7250 (INVERTED)      integral: 0.8667 vs 0.6667
  SIM:  A − B = +4.1 DPS ± 0.21 (3 seeds, 20σ)  ⇒ the law and the integral are RIGHT, the sum is WRONG
Icy Veins covering the opening ramp vs 3 s later
  SIM:  A − B = +3.2 DPS ± 0.51  ⇒ the integral is RIGHT again
```

⚠ **Methodological note worth keeping:** ESTABLISHED-FACTS' closed forms are derived from a *continuous
rate* model, which is the integral's own worldview. Convicting the per-cast sum by comparing it to them
would have been circular — the sim measurements above are what make it a finding. **The converse also
holds: the closed forms cannot arbitrate the integral either.** `tools/law-check.mjs` is a
self-consistency gate between the doc and the engine, not evidence about the world.

### Why the 10 DPS could not be attributed

The coordinates are strongly coupled, and single-coordinate bisection gives contradictory answers
depending on which end you start from:

| move | from OLD | from NEW (reverting) |
|---|---|---|
| Berserking 30.309 ↔ 19.915 | **−11.9 DPS** | +0.0 (tie) |
| Icy Veins [4.166,128] ↔ [0,126] | **−10.9 DPS** | +5.2 (NEW better) |

Both readings are correct: Berserking at 0:20 **overlaps OLD's Icy Veins** (which runs to 24.166) where
it is worth ~nothing over the GCD floor, and is a free tie against NEW's (which ends at 20.000). So
neither plan has a single bad press — NEW is 10 DPS worse *as a whole*, and nothing in it is locally
wrong.

### The one localised model/sim disagreement found

Given NEW's Icy Veins `[0,126]`, Berserking placed at 0:20 / 0:25 / 0:30 / 0:35:

```
integral  132.8244  132.7581  132.7525  132.7525     ← prefers 0:20 by 0.072 casts
sum       132.6362  132.6362  132.6362  132.6362     ← exact tie
SIM       0:20 − 0:30 = +0.0 DPS ± 0.17              ← exact tie
```

The integral's 0.072 is `Berserking × (Arcane Power + Icon)` — 1 s of AP overlap at ×1.30 plus 6 s of
Icon at +7.7 %, which is `0.0867 × (0.30 + 6 × 0.077) ≈ 0.066`, the measured step to two figures. **The
law says the integral is right and the sim says the sum is right**, at ~1.4 model DPS against a sim band
that excludes anything above ~0.5. That is the smallest, sharpest instance of the disagreement and it is
where the next attempt should start.

### Where this leaves the change

| verified | result |
|---|---|
| the two declared layouts (`tests/anchors.mjs`) | ✅ **2 of 2** |
| the closed forms (`tools/law-check.mjs`) | ✅ 6/6, negative control caught |
| single-coordinate buff placement, sim-arbitrated | ✅ integral right on both cases tested (+4.1, +3.2 DPS) |
| **the preset corpus, sim-arbitrated** | ⛔ **Morogrim −10.1 DPS ± 0.75 (13σ)** |
| the other 14 changed cells | **UNMEASURED** |

⇒ **Do not treat this as finished.** The change is separable: `cfg.phaseRank === false` restores
sum-ranking while keeping every SEARCH fix (structural candidate times, fixed-point rounds, the
co-pressed-cluster move), which are objective-agnostic. That flag is the A/B that decides whether the
trade is "the anchors" against "the corpus", or whether a variant gets both.

---

## §8o — ✅ CLOSED 07-31. It was fixed by §8q the same day and nobody re-checked. (opened 07-30)

> ✅ **CLOSED — the symptom AND the mechanism are both gone, and both are now gated.**
> §8o located a real inconsistency: dead time between a press and the first cast it can affect was
> charged **zero** at steady state but the **realized** amount on the ramp, and neither is the average.
> Its proof was a segment dump where Icy Veins pressed at 3.0 gained nothing until the in-flight ramp
> cast ended at 4.666; the consequence was a period-2 wobble that made Icy-Veins-at-the-pull win.
>
> **§8q's fixed ramp toll** — spread over the UNHASTED `ΣC_k`, landed the same day for a different
> reason — removed it. Re-measured 07-31 on §8o's own case, Morogrim with only Icy Veins #1 moving:
>
> ```
>   sub-second sweep across the 4.666 boundary, 26 samples at 0.1 s
>     every Δ = 0.000875, identical to 1e-9   ⇒ zero flat steps: the charge is CONTINUOUS
>   ramp sweep 0→7   132.830712 … 133.009593   monotone, 0 direction changes, argmax @7
>     §8o measured argmax @0 with a ±0.14 zigzag
> ```
>
> ⇒ Both are now `law-check` lines (`§8o: press response is LINEAR across the ramp`, `§8o: the ramp
> sweep 0→7 is monotone`), so the fix cannot silently regress. **This is the user's own principle
> expressed as a gate**: the sub-cast offset is unresolvable, so the model must average over it — and a
> window that starts late also ends late, so what survives is a constant rate of change, not a
> staircase.
>
> ⚠ **AND §8o's HANDOFF IS DISCHARGED.** It asked for the Berserking-before-vs-inside-Bloodlust ordering
> to be gated first, to localise a suspected "second defect" without another sim run. That gate is in
> (`§5b`) and **passes on the shipped engine**, and the candidate uniform-slip build now fails *three*
> closed forms rather than the one §8o predicted — so the second defect, if it was ever separate from
> the ramp, is gone with it. ⛔ Do not re-attempt the uniform slip: a pure window shift is already
> value-neutral here (measured: identical to 6 decimals at every sub-second offset), so there is
> nothing for it to correct.
>
> The original entry follows unchanged, as the record of how it was found.

## (original) §8o — the integral charges DEAD TIME inconsistently. Located, not fixed. (07-30)

User, correcting me on the physics and then giving the design principle: *"a real mage can only press it
between casts using the macro … but that's below the boundary of what's worth trying to follow. For our
model and for determining the best overlaying of spells ON AVERAGE this approach works"*, and *"even if it
activates midcast of one fight it will also deactivate in the middle of another, so the haste clipping
doesn't work there — we actually calculate the value of that buff."*

⛔ **I had this wrong and it matters.** §8l justified pure window geometry partly on *"a real mage presses
mid-cast; Berserking and the trinkets are off the GCD"*. **False** — presses go through a macro that
fires between casts. The right justification is the user's: the sub-cast offset is **unresolvable**, so
the model must average over it, and a window that starts late also *ends* late, so the edge effects
cancel and what survives is the buff's average value. Same conclusion, sound reason. The §8l entry's
reasoning is corrected here; its code is unaffected.

### The defect, from the segment dump

The integral charges the dead time between a press and the cast it can affect **inconsistently**:

- **at steady state: ZERO** — a window opens exactly at the press;
- **on the ramp: the REALIZED amount** — `rate` is forced to a ramp cast's own duration, so Icy Veins
  pressed at 3.0 loses exactly 1.666 s to the cast running 2.5 → 4.666.

Neither is the average. And the ramp is therefore **the one place the integral resolves the very jitter
it exists to average away.** Proof, from the instrumented segment table — `IV@3` emits two adjacent
segments across the press with the *same* rate:

```
[2.500,3.000] len 0.500 rate 0.461681      ← Icy Veins starts at 3.000 and the rate does not move
[3.000,4.666] len 1.666 rate 0.461681
```

That is what produces the period-2 wobble as a press crosses a ramp boundary (0 / 2.5 / 4.666 / 6.498),
and the wobble is what chooses Icy-Veins-at-the-pull — which the sim says is **10.0 DPS ± 0.97 worse**.

### Charging it uniformly: fixes one thing, breaks another

`scoreStart = geoStart + prevInterval/2` (press-chained AND unconditional — *not* the pre-07-30
`eff + slip`, which was fire-chained and applied only when the press happened to land mid-cast):

```
Morogrim, only Icy Veins #1 moving:
  IV#1@       0        2        3        4        5        6
  before  132.6935 132.6785 132.4471 132.5892 132.4066 132.5487   ⛔ argmax @0, ±0.14 wobble
  after   132.7427 133.0044 132.7595 132.9016 132.7441 132.8304   ✓ argmax @2
  sum     132.6362 133.0063 132.9709 132.9709 132.7039 132.7039   ✓ argmax @2 — and the sim agrees
```

⛔ **But it introduces a bigger error.** The descent under it emits, on T1,
`icyVeins[2,23] isc[23] scb[23] arcanePower[23] berserking[2]` scoring **above** the declared layout —
Berserking pressed at 0:02, *before* the Bloodlust call. Both the closed forms and the sim say that is
worse (Berserking in Bloodlust adds 0.867 casts, under Icy Veins alone 0.80). Both anchors fail. So the
dead-time inconsistency is **not the only defect**; something else interacts with it, and reverting is
the honest call. **Not landed.**

⚠ One law-check line moves under it and the FILE'S OWN HEADER predicted this: *"if a line fails,
re-derive before you touch the engine."* "Berserking 1.000 s inside Icy Veins" reads 0.00518 against a
1.000 s expectation. With both windows shifted by *different* expected slips the true overlap is
`E[max(0, 20 − fire)] = 0.4 s` (Berserking's fire uniform on `[19, 20.25]`), and the engine's 0.375 is
that expectation's point estimate. The engine was right; the expectation was stale. ⇒ if the uniform slip
is ever revisited, re-derive that line first.

### Four hypotheses, four falsified — recorded so they are not retried

| hypothesis | how it died |
|---|---|
| the integral over-credits haste × value overlap | sim: Berserking fully inside Arcane Power vs outside = **+5.0 DPS ± 0.14** against a law prediction of 5. The continuous model is exact. |
| the regression is transcription slip | NEW's total press→fire slip is **0.750 s**, OLD's is **1.859 s** — NEW transcribes *better*. |
| the Bloodlust transcription differs between arms | it does (4.915 vs 5.166 off the same pinned 0:05) and it is worth **+0.0 ± 0.00**. |
| the flat-ramp substitution is the cause | integrating the ramp continuously (rate = 1/its own duration ⇒ exactly one cast) moved the ladder by **0.008 casts** and changed no argmax. Reverted. |

### What is established and durable

1. **The continuous/average objective is right**, for the user's reason (unresolvable jitter; cancelling
   edge effects) — not for the wrong one §8l gave.
2. **The sim confirms the model's pricing on every clean single-coordinate question tested**: Berserking
   in Bloodlust vs nothing **+4.1 ± 0.21**, Berserking inside Arcane Power vs outside **+5.0 ± 0.14**,
   Icy Veins on the ramp in isolation **+1.0** (where the per-cast sum's +0.055 casts matches to the
   decimal and the integral says a flat tie).
3. **The dead-time inconsistency is real and precisely located** (above), with the segment dump as proof.
4. **The shipped state passes both anchors and regresses Morogrim by 13σ.** Both are true; neither
   cancels the other.

⇒ Next: find the second defect that co-occurs with the dead-time one. The sharpest lead is that the
uniform-slip build ranks Berserking *before* Bloodlust above Berserking *inside* it — a question the
closed forms answer unambiguously and `tools/law-check.mjs` could gate directly. Add that case to the
gate first; it will localise the second defect without another sim run.

---

## §8p — ✅ CLOSED 07-30 BY §8x (was: ⛔ THE DEFECT, NAMED: haste × **spellpower** is over-credited ~⅓)

> ✅ **CLOSED — see §8x at the end of this file.** The engine reproduces the haste × SP cross-term
> closed form `D·s·[rate(m·a) − rate(m)]` to **0.000 %** on four pairs, so the over-credit is not in
> the model. It was a model-vs-SIM gap, and with the simulator retired that comparison no longer
> exists. ⚠ Read §8x before citing anything below as current.


User, correcting the frame — describing the RESULT they expect for Morogrim rather than a new rule:
*"Morogrim has to pop the first cluster (everything except Berserking) as soon as a) 3 Arcane Blast stacks
are active and b) Lust is active, then exactly 2 minutes after the first cluster the second cluster gets
popped — IV (Cold Snap), Icon, Gem and Berserking."* Plus: *"AP only fits once, and the first cluster
gives it more value because Lust > Berserking, so it stays in the first one."*

Bloodlust is pinned 0:05 on Morogrim and the third stack completes at 6.498, so that rule reads
`IV[7,127] Icon[7,127] Gem[7,127] AP[7] Berserking[127]`.

### All three plans, sim-arbitrated (6000 iters, wasm, Bloodlust identical)

| plan | integral | per-cast sum | SIM |
|---|---|---|---|
| OLD (pre-07-30) | 132.4471 | **132.9709** | **best** |
| **USER'S RULE** @0:07 / 2:07 | 132.7102 | 132.8547 | −2.4 DPS vs OLD |
| NEW (what the tool emits) | **132.8244** | 132.6362 | −10.1 vs OLD, **−7.5 vs the user's** |

⇒ **The user's rule beats the shipped output by +7.5 DPS**, and the shipped output is the worst of the
three. Neither objective picks the user's plan: the sum picks OLD, the integral picks NEW.

### The −2.4 is entirely Berserking, and it inverts the law

Their layout with ONLY Berserking moved — 2:07 (with the second cluster) vs 0:30 (inside Bloodlust):

```
SIM  A − B = −1.2 DPS ± 0.20 (3 seeds)     law predicted +1.24 DPS for the cluster
```

Same magnitude, opposite sign. And at the user's OWN declared gear (T2 exactly: 3:00, 1000 SP, 25 % crit,
Lust 0:20, on `--char model-ref` with injected stats) the same choice is a **dead tie**:

```
Berserking 2:20 (their rule) − Berserking 0:42 (in Lust) = −0.1 DPS ± 0.01     law predicted +1.4
```

So their T2 layout is **not penalised at their gear** — the two options really are equivalent there, which
is why the anchors pass. The model just believes the cluster option is worth +1.4 DPS more than it is, and
that belief is what pulls Berserking onto the second cluster everywhere, and off Bloodlust on Morogrim
where the sim wants it in Lust.

### Isolated: the cross term is ~⅓ too big, and ONLY for +SP

Berserking fully inside Icon + gem, nothing else in the fight, 1000 SP / 25 % crit, T=180:

```
MODEL  +0.1258 casts   (= 0.66471 × (s₁₅₅ + s₂₂₅ = 0.1892) — the closed form, EXACTLY)  ≈ +1.21 DPS
SIM    +0.8 DPS ± 0.00 (3 seeds)                                                        ⇒ ≈ +0.083 casts
```

★ **And the same cross term against a DAMAGE MULTIPLIER is exact.** Berserking fully inside Arcane Power
vs outside: law 0.26 casts ≈ 5 DPS, **SIM +5.0 DPS ± 0.14**. Matched to the decimal.

⇒ **`haste × dmg-multiplier` is right; `haste × +SP` is ~⅓ too generous.** The engine implements
`s = COEF·ΔSP/(BASE + COEF·SP)` faithfully (0.1892 is the correct per-cast damage ratio, verified by hand),
so **the closed form in `docs/ESTABLISHED-FACTS.md` §4 is what is wrong**, not its implementation. That is
the first time this project has found an error in the facts doc itself rather than in the engine.

⚠ **This also invalidates the `law-check` line built on it.** `tools/law-check.mjs`'s "Berserking under
IV + Icon + gem" case asserts `D × Δrate × (1 + s₁₅₅ + s₂₂₅)` and the engine reproduces it to 5 decimals —
so the gate is confirming a formula the sim refuses. Exactly the circularity §8n warned about: law-check is
a doc↔engine consistency gate, never evidence about the world. **Mark that line as unverified until the
cross term is re-derived.**

### The leading explanation, and how to test it

A haste buff inside a value window makes the casts *within* that window denser — but the net **extra**
cast materialises at the end of the shifted lattice, where the value buff is long gone. So the gain is
`Δrate × duration × s` only if the extra casts stay inside the window, and they do not. A damage
multiplier would show the same effect, so that hypothesis has to explain why Arcane Power matched
exactly — the most likely difference is that `dmgMult` pools **additively** with the T5-2pc term
(`(dmgMult + t5add)`, PHASE8 §25) while +SP enters through the coefficient, so the two are not the same
algebra at all.
⇒ **Next: sweep the cross term against ΔSP (155, 225, 380, 600) and against buff duration in the sim, and
fit it.** If the deficit scales with `duration/fightRemaining` the "extra cast lands at the end" story is
right and the closed form needs that factor. This needs no new instrument — `bench --char model-ref
--spec-a/--spec-b` does it, as above.

### §8p addendum — T3 is now a declared test, and the SUM already agrees with the user

User: *"my declared plan has to be the best, I'm certain enough about it to be able to make it into a hard
test along with the other two examples."* Added as **T3** in `tests/anchors.mjs` (the Morogrim preset,
cfg from the fight table via `cfgFor` — sp 1387, crit 38, Lust pinned 0:05).

```
2 of 3 passed.
FAIL  T3  want  IV@0:07/2:07  Icon@0:07/2:07  Gem@0:07/2:07  AP@0:07  Lust@0:05  Zerk@2:07
          got   IV@0:00/2:06  Icon@0:06/2:06  Gem@0:06/2:06  AP@0:06  Lust@0:05  Zerk@0:20
          Δ (want − got) = +0.2185 effective casts on the shipped objective
```

★ **Read that Δ.** The per-cast sum ranks the user's layout **0.2185 casts ABOVE** what the tool emits, and
the sim ranks it **+7.5 DPS above** (§8p). So on this case the sum and the sim agree with the user and only
the **integral** — the quantity that actually ranks — disagrees. That is the sharpest statement of the open
defect available: two independent arbiters against the ranking objective on a declared case.

⇒ Two things must be true for T3 to go green, and they are separable:
1. **`haste × +SP` must stop being ~⅓ too generous** (§8p) — that is what puts Berserking at 0:20 instead
   of 2:07.
2. **Haste spent on the opening ramp must be charged properly** — that is what puts Icy Veins at 0:00
   instead of 0:07. The derivation, in the user's own framing: during a k-stack ramp cast the rate is
   `m/C_k` (cast-bound, `C_k` = 2.5 / 2.166 / 1.832) against `m/G` at steady state, so a haste buff gains
   `(m−1)/2.5 = 0.080` casts/s over the 0-stack cast versus `(m−1)/1.5 = 0.133` at steady state — **40 %
   less**. Icy Veins at the pull spends 5.4 s of its 20 s there. ⚠ Note the engine's ramp handling was
   already probed twice (§8o: integrating the ramp at `1/own duration` moved the ladder 0.008 casts) so the
   fix is NOT "integrate the ramp" — it is that the compression hand-off credits `1.083 s × the local
   post-ramp rate` (≈1.08 casts with Lust up) where the true value of finishing the ramp sooner is
   `1.083 × (rate₃ₛₜₐcₖ − rate₂ₛₜₐcₖ) ≈ 0.157` casts.

---

## §8q — ✅✅✅ 3 OF 3. The ramp was the last lattice leak. (07-30)

```
node tests/anchors.mjs
PASS  T1 — 2:00 · PASS  T2 — 3:00 · PASS  T3 — Morogrim
3 of 3 passed.
```

### How it was found: an INDEPENDENT reference integrator

Rather than patch the engine again, the user's model was implemented **from scratch** — no shared code
with `simulate()` — so it could arbitrate instead of agreeing by construction. Built two ways:

| reference variant | §5 named values (0.867 / 0.667 / 0.951) | Morogrim argmax |
|---|---|---|
| walks the cast lattice | **0.6887** / 0.6587 / 0.7442 ⛔ | EMITTED |
| no lattice: `∫ min(1/F, m/G)·dmg dt` − fixed toll | **0.8674 / 0.6647 / 0.9547** ✓ | **DECLARED** ✓ |

★ The lattice-walking version fails the laws the same way the per-cast sum does, and the sim confirms the
laws (`+4.1 DPS ± 0.21`). **So no form of the cast lattice may enter the ranking — including in the ramp**,
which was the one place it still lived.

### The three ramp forms, all measured on the T3 ladders

| ramp model | Icy Veins #1 argmax | why |
|---|---|---|
| region integrated at `1/(cast's own span)` | **0:00** ⛔ | the span shrinks with haste, so compression pays and covering the ramp becomes a bonus — the lattice, readmitted |
| toll LUMPED at the ramp start | 0:07, but cluster **0:05** ⛔ | a value buff pressed 0:05 gets full credit for `[5, 6.498]`, casts the opener never makes |
| **toll spread over `ΣC_k`, the UNHASTED length** | **0:07** ✓ | a fixed number of casts lost over a fixed stretch of time |

Both halves are load-bearing. **Fixed count** ⇒ haste cannot compress it, so the ramp stays neutral — the
user's correction: *"haste over ramp is worth exactly the same as haste after ramp. What's worth more is
the alignment with AP and SP buffs."* **Spread** ⇒ a value window overlapping the opener pays its share,
which is what makes the cluster wait for 3 stacks. Resulting ladders:

```
IV#1 alone :  0:−0.179  2:−0.044  4:−0.026  5:−0.017  6:−0.009  7:+0.000  8:−0.068
joint slide:  4:−0.361   5:−0.155  6:−0.052  7:+0.000  8:+0.000  9:+0.000
```

The plateau begins at exactly 0:07 — the first whole second with 3 stacks (6.498) **and** Lust (0:05) both
live — and the earliest tie-break takes it. The user's rule, derived rather than asserted.

### And one more coupled coordinate, through `repair` rather than through the score

With that landed T3 read `IV[7,129] isc[7,129] scb[8,129] AP[8] zerk[129]` — bit-identical integral to the
declared (133.009593 both) with 4 distinct press moments against 3, so the tie-break wanted the declared
and could not reach it:

```
2nd cluster 2:09→2:07 alone   −0.0098 casts   (outside the band, correctly refused)
then gem/AP 0:08→0:07         +0.0098 casts   (exactly cancelling)
```

Coupled through **legality**: with the gem used at 0:08 its 2-minute cooldown makes 2:07 illegal, so moving
the second cluster alone gets relegalized and split. And the co-pressed-cluster move class could not do the
enabling step, because it slid **every press of a member track** — sliding the 0:08 group by −1 dragged the
gem's *second* use 2:09→2:08 and split the cluster it was meant to leave alone.
⇒ **Fix: the cluster slide moves only the presses AT that second** (key + index), not whole tracks. Then
`{gem#1, AP} 0:08→0:07` lands on its own — score-neutral, strictly better on shape — and the second
cluster's move becomes legal and free.

### Verification

| gate | result |
|---|---|
| `tests/anchors.mjs` | **3 of 3** |
| `tools/law-check.mjs` + `--self-test` | 6/6; negative control caught by 4 lines |
| `tools/self-consistency.mjs` | 0.00e+0, **0** structural |
| `tests/page-equiv.mjs` + `--self-test` | 2/2; seeded break caught |
| `tests/sim-request.mjs` | protocol invariants PASS |
| `bench --preset "T1 · 2:00 lust 0:20" --vs naive` | MODEL +1.931 % **AGREES with the sim** |

**Morogrim, sim-duelled head to head (6000 iters, 3 seeds):**

```
NEW (= declared) − this morning's emitted :  +7.6 DPS ± 0.60      ⇒ a large real gain
NEW (= declared) − pre-today OLD          :  −2.3 DPS ± 0.24
```

⚠ **The −2.3 is stated, not hidden.** It is entirely the Berserking placement of §8p — the sim prefers it
inside Bloodlust, the closed forms prefer it with the second cluster, and the user was told and reaffirmed
the declared layout, so it stands. §8p (haste × +SP ~⅓ too generous in the closed form) is still **OPEN**
and is the reason that one press disagrees.

⚠ **Open debt:** the full preset corpus has not been re-swept or duelled since this change.
`docs/ACCEPTANCE.md` still has no current reading.

---

## §8r — ⚖️ CHARACTERISED AND GATED 07-31. The fork stands as a USER CALL, not a defect. (07-30)

> ⚖️ **CALL RESOLVED 08-04, to the status quo (clean-the-slate delegation): statement 1 stands.**
> The declared layouts were measured under the fixed ramp toll and depend on it; adopting statement
> 2 would move Icy Veins #1 to the pull (~0.49 casts on Morogrim) and break them — i.e. the ground
> truth the user personally declared already embodies the statement-1 choice, so the fork was
> materially decided the day those layouts were locked. The characterisation below (both statements
> true about the game; the model honours one; residual 0.000000 under four law-check lines) stays as
> the record; reopening requires re-ruling the declared tests themselves.

> **Measured 07-31 with a proper control** — both placements inside the SAME company (Lust pinned
> `[0,60]`, buff at 0 vs 20), because comparing 0 against 100 also moves the buff out of Lust and that
> confound reads as a 0.20-cast "ramp effect" that is nothing of the kind:
>
> ```
>   Icy Veins      ramp 2.668977   clear 2.668977   residual  0.000000
>   Berserking     ramp 0.867377   clear 0.867377   residual  0.000000
>   Icon (+SP)     ramp 1.234984   clear 1.337803   residual −0.102819
>   Arcane Power   ramp 3.499880   clear 3.899480   residual −0.399600
> ```
>
> ⇒ **Statement 1 is implemented EXACTLY, not approximately** — a haste buff over the ramp is worth
> identically what it is worth after it, to 1e-9, for both haste buffs. And its second half holds too:
> a VALUE buff correctly prefers to be clear of the ramp, because a value window spent on slow ramp
> casts covers fewer of them. Four `law-check` lines now gate all of it (§8r block).
>
> ⇒ **Statement 2 — the opener COMPRESSING under haste — remains deliberately unmodelled**, and this is
> a **user call rather than a defect to fix**: §8r measured that adopting it moves Icy Veins #1 to the
> pull and breaks the declared layouts. Both statements are true about the game; the model can only
> honour one, and the declared layouts pick statement 1.
> ⚠ Anyone revisiting it should note the residual is a clean **0.000000**, not a fudge — there is no
> partial credit hiding in the current build that a compression model would double-count.
>
> The original entry follows unchanged.

## (original) §8r — cooldowns chain from the PRESS everywhere (07-30), and the one fork it exposed

User: *"with our model the trinket and the stat changes should apply the moment it's pressed. That's what
I've been saying the entire time."*

### What was wrong

The RANKING was already press-chained (§8m's `lastScore`). **Legality and display were not** — the walk
still gated on `lastFire`. So on T2: the Icon pressed at 0:20 lands mid-cast and the macro fires at the
next boundary, 21.498; a fire-chained 2-minute cooldown then reads ready at **141.498**, and the schedule
printed `2:21` for a plan whose declared rule says `2:20`. Demonstrably that and nothing else — slide the
first press and the second follows:

```
press 1st @0:18 → Icon fires 18.000 / 140.000        press 1st @0:20 → 20.000 / 141.496   ⛔
press 1st @0:19 → Icon fires 19.000 / 140.000        press 1st @0:21 → 21.000 / 141.496
```

⇒ the walk now uses `lastScore` (press-chained) for legality too, so there is **one chain again**.
`anchors` stays **3 of 3** and T2 prints `0:20 … 2:20` throughout.

⚠⚠ **A PRICED DIVERGENCE FROM THE SIM, reversing PHASE12 §6.14c on purpose.** wowsims starts a cooldown at
the CAST, so it fires the second use up to one cast later than this plan prints and `model-audit` WILL show
a gap. §6.14c measured that as HELD 18 of 196 — but that was when the DISCRETE WALK was also the arbiter.
Since §8l the ranking is pure press geometry, so the board no longer *scores* a fight the sim cannot
produce; it transcribes one the sim executes a fraction of a cast later. Deliberate. Do not "fix" it back.

### ⛔ THE FORK: two user statements that the model cannot both honour

Both are true about the game and they pull opposite ways:

1. *"haste over ramp is worth exactly the same as haste after ramp. What's worth more is the alignment
   with AP and SP buffs."* → the opener is a **fixed** toll; hasting it earns nothing directly.
2. *"sometimes overlaying the haste buff onto the ramp makes the arcane blast stacks stack quicker, but
   that's all deterministic math."* → the opener **shortens** with haste, so the steady phase starts
   sooner.

**With no other buffs up they agree exactly** — that is ramp-neutrality, and it checks out:

```
20 s window, m=1.0 : 3 + (20 − 6.498)/1.5  = 12.001        gain 2.667
20 s window, m=1.2 : 3 + (20 − 5.415)/1.25 = 14.668        gain 2.667 — identical to a steady 20 s
```

**They diverge only when another buff covers the compression window.** On Morogrim, Bloodlust is pinned
0:05, so the 1.083 s that a hasted opener saves is cashed at the Lust-boosted rate (1.0 casts/s, capped)
instead of the opener rate — worth ~0.49 casts, which beats the ~0.13 that Icy Veins gains by aligning with
the cluster. Measured, switching only that:

```
fixed toll  (statement 1) → Icy Veins #1 argmax 0:07   ✓ the declared layout, anchors 3 of 3
hasted opener (statement 2) → Icy Veins #1 argmax 0:00  ⛔ anchors 2 of 3
```

⇒ **Statement 1 is what ships**, because it is what reproduces all three declared layouts. Statement 2 is
recorded here as the unresolved half: it is a true fact about the game that this objective does not model,
and the reason is that crediting it at the local (buffed) rate makes covering the ramp a bonus, which
contradicts statement 1's neutrality. Resolving it properly needs the compression credited at the rate
prevailing where the extra casting actually lands, not where the compression happens — that is unbuilt.

Gates after: `anchors` **3 of 3** · `law-check` 6/6 + negative control caught · `self-consistency`
0.00e+0 / 0 structural · `page-equiv` 2/2 · `sim-request` PASS.

---

## §8s — ✅ THE SEARCH CANNOT SLIDE A TRAIN OF ABUTTING WINDOWS. Two user-reported cells, up to 0.10 casts. (07-30)

Two plans reported wrong by the user on the same day, same shape, same cause:

```
2:00 · 1387 SP · 38 % crit · Lust 0:05
  emitted   Icy Veins 0:05 (fires 0:06) · cluster 0:07 · Berserking 0:25 · Cold-Snap IV 0:35
  user      "why is the first IV at 0:06 not 0:07 along with the other things? And Berserking not 0:27"

1:15 · same gear · Lust 0:05 · intermission 0:50-0:55
  emitted   Icy Veins 0:02 · cluster 0:07 · Berserking 0:21 · Cold-Snap IV 0:55
  user      "isn't it much better to do IV@7, Zerking @27?"
```

The user is right in both, and it is a **search** failure, not a scoring one — brute force over the
whole neighbourhood says so:

| case | emitted | argmax | gap |
|---|---|---|---|
| 2:00 | IV[5,35] Zerk 25 · **100.779046** | IV[7,37] Zerk 27 · **100.784861** | **0.0058 casts** (2.9× the tie band) |
| 1:15 | IV[2,55] Zerk 21 · **67.348403** | IV[7,55] Zerk 27 · **67.450603** | **0.1022 casts** |

The 2:00 argmax is the max over 373k layouts (IV₁ 0–14 × IV₂ × Berserking × cluster 5–12), and the
1-D profile in IV₁ with everything else re-optimised at each point is a clean monotone ridge:

```
IV1  0  100.722680      IV1  4  100.776022      IV1  8  100.784745
IV1  1  100.746328      IV1  5  100.779046 ←    IV1  9  100.784630
IV1  2  100.769976      IV1  6  100.781953      IV1 10  100.784514
IV1  3  100.772999      IV1  7  100.784861 ★    IV1 11  100.716838
```

There is nothing subtle in the objective. The problem is that the emitted point is a **2-D local
maximum**:

```
improving 1-coordinate moves from IV[5,35] Zerk 25:  0
improving 2-coordinate moves:                        0
improving 3-coordinate moves:                        6   best `IV1+2 & IV2+2 & Zerk+2`  +0.005815
```

### Why the three coordinates are welded together

Under the GCD cap a second haste buff **inside** the first is worth far less than beside it
(ESTABLISHED-FACTS §4), so the optimum **packs the haste windows back to back**: Icy Veins [5,25] ·
Berserking [25,35] · Icy Veins [35,55]. Move any one alone and it overlaps its neighbour, at
−0.0867 casts per overlapping second (§5.1's Berserking-in-Bloodlust law). The train has to move as a
train. The 0.0058 the train is worth is then the **cluster alignment**: at IV₁ = 7 the Icy Veins window
[7,27] coincides exactly with Icon's [7,27], and haste × value multiply.

⇒ This is `phaseRerank` move class 3 (§8m) one dimension up. Class 3 groups presses that share a
**second**; the new class 3c groups presses that share an **edge** — link two presses when one
window's end lands on the other's start, take connected components, slide each as a unit.

⚠ **The tolerance is EXACT equality and that is the whole ballgame.** A ±1 s link was tried first and
made the move useless: Icon's window ends 0:27, one second past Berserking's 0:26 press, so a ±1 link
swept Icon into the train and every slide dragged it off the cluster. Measured — with ±1 the descent
stalled at IV[6,36] Zerk 26 (100.781953, still short); with exact equality it reaches 100.784861.

⚠ **Class 3c is ADDITIVE to class 3, not a replacement, and the two graphs must not be merged.**
Merging lets a cluster get swallowed by a train it happens to abut, and the pure cluster slide is what
reaches T2 and T3.

Both cases are now tests (**T6**, **T7**), and T7 is the largest search miss the suite has ever
carried. `anchors` **7 of 7**.

Gates after: `anchors` **7 of 7** · `law-check` 6/6 + negative control caught · `self-consistency`
0.00e+0 / 0 structural.

---

## §8t — ⚠ THE PLAN-STABILITY GATE WAS GRADING AGAINST THE RETIRED OBJECTIVE (07-30)

Found while verifying §8s. `plan-diff` reported **three SEARCH REGRESSIONS** on a change that is a
strict improvement. It was not:

```
                              Δ integral (RANKS)   Δ robust (what the gate read)
Leotheras the Blind             -0.001155 casts        -0.099466 casts
Fathom-lord Karathress          +0.005815 casts        -0.038086 casts
High Astromancer Solarian       +0.039226 casts        -0.232345 casts
```

**Two independent bugs, both in the instrument:**

1. `plan-sweep` recorded `best.val`, and `optimizeAsync` sets `val = simulate().robust` — the per-cast
   **sum**. Since §8h the sum is the REPORTED number and the rate **integral** is what ranks. So the
   only plan-stability gate in the project was grading every search change against a retired
   objective. ⇒ it now records `rankScore`, with `robust` alongside as a diagnostic.
2. Even on the right number the verdict was wrong for Leotheras, because **the objective is a PAIR**.
   −0.001155 casts is inside `TIE_CASTS = 0.002`; the plans are tied on the integral and the shape
   decides — and B has **3 distinct press moments against A's 4**, which is exactly the move the
   tie-break exists for. ⇒ `plan-sweep` now carries `band` (the engine's own `TIE_CASTS` in that
   cell's damage units, read from the engine, never retyped) and `distinct`; `plan-diff` reports a
   banded move as `tieBreak`, and fails only when a banded move ADDS press moments.

⛔ **This is the same stale-premise class as §8n** (`plan-duel` assuming `robust` is the objective) and
as the four §6 instruments that flattered themselves in Phase 12. When the objective moved on 07-30,
three instruments kept reading the old one; two are now fixed and the standing lesson is unchanged:
**read what a tool measures, not its verdict line.**

---

## §8u — ✅ THE SEARCH NOW HAS A GATE. `tools/search-audit.mjs` (07-30)

Three defects shipped wrong plans this week — §8j, §8m, §8s — and **all three were search misses that
every gate in the repo was blind to**:

| gate | why it could not see them |
|---|---|
| `tests/anchors.mjs` | covers 7 declared cells; §8s was found because the **user** read two plans |
| `tools/law-check.mjs` | correctly stayed GREEN — the scorer was right, the descent never visited the answer |
| `tools/self-consistency.mjs` | compares the objective against itself; cannot see the search at all |
| the deleted `exact-match` | **locked in whatever the search emitted**, so a miss became the golden |
| `tools/search-witnesses.mjs` | needs someone to have already found a better plan by hand |

⇒ Sweep every preset, then ask the objective directly: **is there a small simultaneous move that beats
the plan the tool emitted?**

```
node tools/plan-sweep.mjs index.html /tmp/b.json 3 --max-t=200   # ~30 s, the expensive half
node tools/search-audit.mjs /tmp/b.json --k=3                    # seconds, re-solves nothing
node tools/search-audit.mjs /tmp/b.json --k=3 --self-test        # the negative control
```

**It reproduces the week's misses from the pre-fix engine, to the digit and unprompted:**

```
⛔ NOT OPT  Fathom-lord Karathress   → +0.005815 casts via berserking#0+2 & icyVeins#0+2 & icyVeins#1+2
⛔ NOT OPT  High Astromancer Solarian → +0.030041 casts via berserking#0+3 & icyVeins#0+3
SEARCH-AUDIT k=3 span=3 graded=10 localOptima=8 MISSES=2
```

`+0.005815` is exactly the 2:00 gap the user reported. On the current engine: **14 of 14 local optima.**

### ⚠ Three things that had to be right, each of which was wrong first

1. **`k=3` is the floor that matters, not `span`.** On the 2:00 cell there were **zero** improving
   1-coordinate moves, **zero** 2-coordinate, and six 3-coordinate. A k=1 or k=2 audit calls that plan
   optimal. Cost is `C(n,k)·span^k` ≈ 4.9k scorings at n=6 — under a second, because the sweep already
   paid for the solving.
2. **★ It must grade on the objective PAIR, and grading on `rankScore` alone made it lie immediately.**
   The first version reported **T1 — a declared test, and the argmax — as a search miss**, "beaten by
   +0.000347 casts": 5.8× INSIDE `TIE_CASTS`, by a layout that shifts every press +3 s and is strictly
   worse on the `earliest` tie-break. It now uses the engine's own `rankPair`/`planBetter`, so a
   candidate counts only if the OPTIMIZER would have taken it. ⇒ **that is the THIRD instrument in one
   day to grade on half the objective** (§8t: `plan-sweep`, `search-witnesses`, and this one). The
   comparator is now exported rather than re-implemented, which is the only durable fix.
3. **The self-test had to be unable to seed a tie.** It displaces one press per plan and requires every
   displacement to be caught; it picks the smallest nudge the *engine's own comparator* calls strictly
   worse, so it can never seed the false positive of item 2. A plan with no such nudge is reported
   UNPERTURBABLE, never silently counted as a pass. Result: `displaced=14 caught=14`.

⚠ **A PASS IS NOT OPTIMALITY, and the gate says so in its own output.** It asserts no move of ≤k
coordinates by ≤span seconds wins. T2's declared Berserking sits **+120 s** from where the descent put
it (§8j) — outside every bounded neighbourhood at any k. Global optimality needs the constructive
enumeration (`docs/archive/18-phase13-post-exact-objective.md` §3); this is that programme's regression net, not its replacement.

### Fixed in the same pass: the witness gate had been ERRORING, not passing

`tools/search-witnesses.mjs` resolved each witness through `api.cases.find(c => c.name === w.case)`.
Two of its three witnesses named presets deleted on 07-30 when `GOLDEN_PRESETS` became the declared-test
list, so the gate exited **2** — not passing, not failing, erroring — for as long as that was true.
⇒ a witness may now carry an inline `setup` and that is preferred: **a witness is a fact about a FIGHT,
not about a row in a table.** It was also scoring on `.robust`; fixed to `rankScore` (item 2 again).

---

## §8v — ⚠ OPEN, AND IT IS A **REACHABILITY** ISSUE ON AN EXACTLY-TIED PLATEAU, NOT A TIE-BREAK ONE (07-30)

> ⚖️ **SETTLED 08-04, under the user's clean-the-slate delegation.** Two facts close it: the tie is
> BIT-EXACT (Δ = 0.000e+0 — no damage is at stake, by construction), and the comparator's own first
> criterion (fewest distinct press moments) already prefers the member the tool EMITS (3 moments vs
> the unreachable member's 4) — so the shipped answer is the canonical member of its plateau by the
> declared tie-break order, and the "which member" user call resolves to the status quo. The
> reachability half was only ever actionable through the constructive enumeration, which is revoked
> as a build (ROADMAP: brute-cell/search-audit are the standing research instruments); a class of
> moves that can never change a score by even one band is not worth a search mechanism.

Reported by the user as *"teeeeeechnically we could improve this layout to uphold the 'earliest possible
that's samesies' rule — it's more of a showcase of this being a technicality that might help us in the
future if we catch it now."* They are right, and the reason is more interesting than the case.

**2:00 · 1387 SP · 38 % crit · Lust pinned 0:10.** Two layouts:

```
emitted     IV[10,40]  cluster 10  Zerk 30     100.785091666 casts   3 press moments {10,30,40}
user's      IV[0 ,20]  cluster 10  Zerk 40     100.785091666 casts   4 press moments {0,10,20,40}
                                               Δ = 0.000e+0 — BIT-IDENTICAL, not merely banded
```

They are exactly tied because the IV split is the same on both: 30 s of Icy Veins inside Bloodlust and
10 s outside, just arranged differently — and at h=0 a second of Icy Veins is worth 0.13345 casts inside
Lust and 0.13333 outside, i.e. the same to four figures (one is GCD-capped, the other is not). The
opener costs nothing either way, because the ramp toll is m-independent (§8q).

### The two hypotheses, and BOTH were wrong

**Hypothesis 1 — "the tie-break ordering is wrong."** The objective's second half is *fewest distinct
press moments → earliest*, so it never reaches "earliest" here: 3 beats 4 and the comparison stops.
⇒ **Tested by flipping the order** (earliest before fewest-moments) and re-running everything:

```
anchors      7 of 7 — the ordering is NOT constrained by any declared layout
plan-sweep   1 of 14 cells moved: Leotheras the Blind, and it gained a press moment
             SCORE-AUDIT … tieBreakWORSESHAPE=1  ⚠ "the tie-break went backwards"
the reported case  UNCHANGED
```

So the flip costs a cell and does not fix the case. **Reverted.** (★ The `tieBreakWORSESHAPE` line is
`plan-diff`'s, added hours earlier in §8t — the first time that check earned its keep.)

**Hypothesis 2 — "the search just needs one more move class."** No. Every path between the two layouts
is a **cliff**, and the numbers are not close:

```
IV1 10→0                −0.382   IV1→0 & IV2→20        −0.867
IV2 40→20               −0.866   IV1→0 & Zerk→40       −1.250
Zerk 30→40              −0.867   IV2→20 & Zerk→40      −0.866
                    all three simultaneously            ±0.000   ← the only tie
```

The two layouts are **isolated points of an exactly-tied plateau separated by a valley up to 1.25 casts
deep**, and the three coordinates move by three DIFFERENT deltas (−10, −20, +10). Every move class the
descent has — whole-plan slide, per-track slide, co-pressed cluster, abutting train, single press — is
a *uniform* shift of some subset. **No uniform move connects these two points, at any span.**

### ⇒ Why this is worth having caught, and what actually fixes it

This is a **fourth** defect kind, distinct from the three `tools/search-audit.mjs` classifies:

| kind | symptom | fixed in |
|---|---|---|
| scoring | the closed form disagrees | `simulate()` — `law-check` goes red |
| tie-break | tied, wrong plateau member | `planBetter` / `planShape` |
| search (reachable) | a small simultaneous move wins | a move class in `phaseRerank` |
| **search (unreachable tie)** | **an equal-scoring layout no continuous path reaches** | **nothing in a descent — see below** |

A descent can only compare what it holds. A **constructive enumeration** (`docs/archive/18-phase13-post-exact-objective.md` §3) holds
both candidates by construction, because both press only on group seconds — `{0, 10, 20, 40}` and
`{10, 30, 40}` are each a subset of the same derived lattice. ⇒ **the user's technicality is
automatically resolved by the enumeration, and by nothing short of it.** That is the strongest argument
yet for building it, and it arrived as a throwaway observation about a plan that is not even wrong.

✅ **AUTO-RESOLVED 08-05 BY §9s — this user call no longer exists.** The whole trade below is priced in
PRESS MOMENTS, and the `distinct` criterion that counted them is ABOLISHED (user ruling). With the
earliest-press vector deciding, `IV at 0:00` simply wins: it is earlier, and "costs a press moment" is
no longer a cost the comparator can charge. ⇒ the user's own rule was the answer, and abolishing the
proxy that opposed it settled the question without anyone having to choose. Kept for the reasoning.

⚠ (historical) **WHAT WAS OPEN WAS A USER CALL, NOT A BUG.** Once both layouts are in hand the tie-break has to
choose, and there is no ordering that gets both properties: the Lust pin at 0:10 forces the value cluster
to 0:10, so **putting Icy Veins at 0:00 inherently costs a press moment**. The trade is exactly:

- **3 press moments, IV at 0:10** (what ships) — fewer separate things to get right.
- **4 press moments, IV at 0:00** (the user's rule) — the same damage, banked 10 s earlier, and one
  button pressed alone before the macro rather than inside it.

⛔ Do not "fix" this by widening `TIE_CASTS`. The two are already at Δ = 0; the band is not what is
stopping it.

---

## §8w — ✅ THE BANDED COMPARATOR IS A RATCHET, AND THE DESCENT WAS WALKING DOWNHILL (07-30)

Found by the user asking a question no test covers: *"try now with different trinkets and observe how
the model behaves."* **Every declared test and every swept preset uses the same kit.** The first
alternative kit tried had a defect.

**2:00 · Lust 0:05 · 1387 SP · 38 % crit · kit `IV + Icon + Gem + Skull + AP + Berserking`.**
The tool emits Skull at **0:29**. Brute force says **0:35**, worth **+0.007936 casts — 4× the tie
band** — and it is a **single-coordinate** move, the easiest kind there is.

### The mechanism, and it is general

`planBetter` is a BANDED comparator, and **a banded comparator is not transitive**. Inside `TIE_CASTS`
the score is declared tied and the SHAPE decides — including *earliest*. So each individually-banded,
individually-earlier step is individually "better", and the descent takes all of them:

```
  0:35 → 0:34   −0.001323 casts   inside band → "better" (earlier)   ✓ taken
  0:34 → 0:33   −0.001323 casts   inside band → "better" (earlier)   ✓ taken
  …six steps…
  net           −0.007936 casts   OUTSIDE the band by 4.0×
  planBetter(0:29, 0:35) = false  ← it arrived at a plan its own comparator calls worse
```

Confirmed directly: `phaseRerank` started at Skull 0:35 **returns 0:29**, and started at 0:33 returns
**0:27** — it does not merely fail to improve, it actively degrades a better input.

### ★ Why a TRINKET kit exposed it and the declared tests never could

The ratchet needs a gradient that fits *inside* the band. §7a is why flat-rating trinkets produce
exactly that: a rating buff riding a multiplier is worth `h(a−1)` per second, and Skull's
`+175 → h = 0.111` makes each one-second step **0.0013 casts** — comfortably inside 0.002. The
multiplicative kit (Icon + Gem) moves in steps of ~0.0867 casts/s, **65× the band**, so nothing there
is ever banded and the ratchet never engages. ⇒ **the defect lives precisely where the gradient is
shallow, which is precisely the gear the test suite does not cover.**

### The fix: a high-water mark

```js
let ceiling = val.score;
…
if (v.score < ceiling - v.band) return false;      // refuse anything a band below the best seen
if (planBetter(v, val)) { …; if (v.score > ceiling) ceiling = v.score; return true; }
```

Drift is now bounded by the band itself — the tolerance the project already accepts as "tied" — instead
of accumulating without limit. Result: every starting point (29, 33, 35, 60) converges to **0:34**,
0.0013 casts off the argmax and inside the band, and the descent is no longer path-dependent.

⛔ **Do NOT "fix" this by shrinking `TIE_CASTS`.** The ratchet works at ANY band width, because the step
that defeats it is whatever sits just inside. And the band is bracketed by measurement (1.8× the
resolution floor, 5.8× below the smallest verified law step) — it is not free to move.

**Gates after:** `anchors` **7 of 7** · `law-check` 6/6 + control caught · `plan-diff` vs the
pre-fix sweep **IDENTICAL, 0 of 14 cells changed** · `search-audit` k=3 **14/14 local optima**,
self-test 14 displaced / 14 caught.
⇒ the fix is strictly additive: it changes nothing on the kit the suite covers, and repairs the kit it
does not.

### ⚠ THE STANDING GAP THIS EXPOSES, WHICH IS BIGGER THAN THE BUG

`tests/anchors.mjs` (7 cells), `tools/plan-sweep.mjs` (17 presets) and therefore
`tools/search-audit.mjs` **all run one kit**: `icyVeins + isc + scb + arcanePower + berserking +
bloodlust`. Skull, MQG, Drums, Power Infusion and the Ashtongue proc are **completely unaudited**, and
the first probe outside the covered kit found a 4×-band single-coordinate miss. Widening the sweep to a
kit × haste matrix is the obvious next gate.

---

## §8x — ✅ §8p IS CLOSED, AND THE WAY IT CLOSED MARKS A LIMIT OF THE POST-SIM WORLD (07-30)

§8p stood as *"haste × **spellpower** is over-credited ~⅓; haste × **damage-mult** is exact"*, measured
model-vs-**sim** (model +0.1258 casts against a sim reading of +0.8 DPS). The simulator is retired, so
the only way left to settle it is against the algebra — which is also the method that found every
scoring defect on 07-30.

**The closed form.** A haste buff `a` over duration `D` adds `D·[rate(m·a) − rate(m)]` casts. If a +SP
buff covers the same window, each of those extra casts is worth `(1+s)` rather than 1, so the gain from
OVERLAPPING the two windows rather than holding them apart is exactly

```
D · s · [rate(m·a) − rate(m)],      s = COEF·ΔSP / (BASE + COEF·SP)
```

**Measured, 300 s fight, h = 0, no other buffs, isolated pairs:**

| pair | measured Δ | closed form | error |
|---|---|---|---|
| Icy Veins ×1.20 · Icon +155 | 0.205843 | 0.205843 | **0.00 %** |
| Icy Veins ×1.20 · gem +225 | 0.224104 | 0.224104 | **0.00 %** |
| Berserking ×1.10 · Icon +155 | 0.051310 | 0.051310 | **0.00 %** |
| Berserking ×1.10 · gem +225 | 0.074482 | 0.074482 | **−0.00 %** |

⇒ **There is no ~⅓ over-credit in the model.** The engine reproduces its own cross-term law exactly,
on every pair, at four decimals. Two new `law-check` lines pin it.

### ⚠⚠ AND HERE IS THE PART THAT MATTERS MORE THAN THE CLOSURE

§8p was never a claim about the model's internal arithmetic — it was a **model-vs-sim disagreement**,
and only one of those two things still exists. So the honest statement is:

- ✅ **The model is self-consistent with its own laws.** That is now provable and is gated.
- ⛔ **Whether the LAW matches the game is no longer falsifiable.** The instrument that could have
  answered it is deleted by decision.

That is a real and permanent limit, not a to-do. Every remaining sim-denominated open item is in the
same position — **§8n** (*"the 07-30 change REGRESSES the preset corpus, 13σ, sim-measured"*) most of
all. ⇒ **Do not reopen a sim-measured defect expecting to resolve it.** Either re-pose it as a closed
form and check the engine against that — which is what this section did — or leave it recorded as
unfalsifiable. ⛔ The one thing that is NOT allowed is quietly treating a sim-era number as current
evidence; that is the stale-premise failure §8t and §8n both punish.

---

## §8y — ✅ CLOSED 07-31: T6 revised by user ruling, move class 3d shipped (opened 07-30)

Found by finishing the kit × haste matrix (§8w's standing gap). Three things came out of one thread and
they are separable — two are fixed, the third is a question only the user can settle.

### 1. ✅ The last SCORE miss in the kit matrix, and its move class

`tools/kit-sweep.mjs` + `tools/search-audit.mjs --k=3` read **59 of 63 local optima**, with one real
SCORE miss:

```
icon+gem+skull · h200 · 2:40 · Lust 0:07 · intermission 1:30–2:10
  emitted   AP[15,30]  gem[15,30]  gem[135,150]      115.551159
  argmax    AP[16,31]  gem[16,31]  gem[136,151]      115.557051    +0.005892 casts  (2.9× the band)
  AP#0+1 alone −0.016255 · gem#0+1 alone −0.033561 · gem#1+1 alone −0.003175
```

Every coordinate is downhill and so is the class-3 CLUSTER slide `{AP#0, gem#0}` at −0.0498: the move
only pays once the gem's **second** use comes along. And it cannot come by itself — the gem's cooldown
is 120 s and `135 − 16 = 119`, so the pure cluster slide is ILLEGAL, `repair` relegalizes it, and
`intact()` refuses it. **This is the third distinct way two presses couple**, after a shared second
(class 3) and a shared window edge (class 3c): they couple through **legality**. Class 3's own header
already names the shape on T3 — *"coupled through `repair`, not through the score"* — but there the
sequencing escape worked because the first half of the move was free; here it is −0.0498, so nothing
lands and the descent stops.

**Move class 3d — the cooldown-chain closure.** Slide the group, then close the chain with `repair`
ITSELF rather than a hand-written push: `repair` is the forward legalizer, it already knows Cold Snap,
the trinket lockout and the per-track separation, and re-deriving those rules inside a move class is
the copies-drift defect this repo tracks. It is idempotent, so the closed candidate satisfies
`intact()` by construction. Accepted only if every track keeps its press COUNT (`repair` also DROPS a
press pushed past the kill, and a "slide" that deletes a cooldown use is a different move).

**Measured with 3d in place:** `search-audit --k=3` over the kit matrix goes **59/63 → 63 of 63, SCORE
misses 1 → 0**. The preset sweep changes **2 of 15 cells**, both the same fight, both inside the tie
band and both *reducing* distinct press moments. Cost: the 63-cell kit sweep runs roughly **2× longer**.

⛔ **IT IS NOT SHIPPED, AND THE CODE IS PRESERVED IN THIS SECTION FOR WHEN THE CALL BELOW IS MADE.**
It makes declared test **T6** fail — see part 3.

```js
    // phaseRerank, immediately after move class 3c
    {
      const bySec = new Map();
      for (const k of keys) (s[k] || []).forEach((t, i) => {
        const sec = Math.round(t);
        if (!bySec.has(sec)) bySec.set(sec, []);
        bySec.get(sec).push({ k, i });
      });
      const mems = [...bySec.entries()].sort((a, b) => a[0] - b[0]).map(([, m]) => m)
        .filter(g => g.length > 1 && g.length < keys.length);
      for (const k of keys) (s[k] || []).forEach((_, i) => mems.push([{ k, i }]));   // singles too
      let hit = false;
      for (const mem of mems) {
        for (const d of SHIFTS) {
          const slid = shiftedAt(s, mem, d);
          if (!slid) continue;
          const closed = repair(cloneS(slid), cfg);
          let ok = true, same = true;
          for (const k in slid) {
            if (!closed[k] || closed[k].length !== slid[k].length) { ok = false; break; }
            for (let j = 0; j < slid[k].length; j++) if (Math.abs(closed[k][j] - slid[k][j]) > 1e-9) same = false;
          }
          if (!ok || same) continue;
          if (tryCand(closed)) { moved = true; hit = true; break; }
        }
        if (hit) break;
      }
    }
```

### 2. ✅ TWO MORE INSTRUMENTS GRADING ON THE WRONG NUMBER — the fourth and the ratchet

**`tests/anchors.mjs` was reporting failure size on `robust`, the RETIRED per-cast sum**, under the
label *"on the shipped objective"*. On T6 that turned a gap of **+0.000231 casts** — 8.6× INSIDE the
tie band, i.e. a dead tie — into a printed **"−0.1028 effective casts"**, which reads as a catastrophic
scoring failure and would send the next reader into `simulate()` after a plateau. It also re-typed the
plain-cast normalizer instead of calling `plainCastOf`.
★ **This is the FOURTH instrument to make that exact mistake in three days** — `plan-sweep`/`plan-diff`
(§8t), `search-audit` (§8u), now `anchors`. CLAUDE.md already carries the instruction that would have
prevented it: **import the comparator, never re-implement it.** It now reads `rankPair`/`plainCastOf`/
`planShape` off the engine and reports BOTH halves of the pair, naming the failure class — a gap inside
the band is not a score difference at all, it is the SHAPE tie-break, which is a different defect with
a different fix.

**`tools/search-audit.mjs` had no high-water ceiling**, so it reported as "misses" precisely the moves
the engine's §8w guard exists to refuse. Three cells, all of this shape:

```
icon+skull · h0 · 2:00 · Lust 0:05 — skull swept, everything else held
  … 33: 100.816271   34: 100.817594 (emitted)   35: 100.818916 (argmax)   36: 100.811893 …
  the gate's advice was `skull#0-1`, i.e. 34 → 33 — two bands BELOW the argmax, walking downhill.
```

`planBetter` is banded and therefore non-transitive; applying it to a single step with no reference
point follows the ratchet off a cliff. The gate now grades against the NEIGHBOURHOOD'S OWN best score,
which it — unlike the descent — can see in full: a candidate counts only if it is within one band of
`hiScore`. Conservative for SCORE misses (the argmax always survives, so a real miss is still
reported). **Result: tie-break misses 3 → 0, SCORE misses unchanged at 1**, and the `--self-test`
negative control still catches **63 of 63** displaced plans.
⛔ Do NOT "fix" this by dropping the shape half instead — that is the §8u mistake, which reported the
declared T1 as a miss 5.8× inside the band.

### 1b. ⛔⛔ AND ON THE FULL KIT MATRIX, 3d REGRESSES A CELL BY 90× THE BAND (measured 07-31)

⚠ **THIS SUPERSEDES PART 1's "strictly additive" reading, and it withdraws a recommendation.** Part 1
priced move class 3d on the **15-preset** corpus, where it changed 2 cells (one fight), both inside the
band — which reads as clean. Swept across the **63-cell kit × haste matrix** (`kit-sweep --html=`, added
for exactly this), it changes **13 of 63**:

| | cells | detail |
|---|---|---|
| inside the tie band (canonicalisation) | 9 | 5 of them reduce distinct press moments — 3d doing its job |
| outside the band, BETTER | 3 | `icon+gem+skull·h200·2:40` **+0.0847** · `pi+icon+gem·h200·3:00` **+0.0143** · `drums+icon+gem·h200·3:00` **+0.0068** |
| outside the band, **WORSE** | **1** | `drums+icon+gem · h0 · 2:40 interm` **−0.181543 casts, 90× the band** |

```
  drums+icon+gem · h0 · 2:40 · Lust 0:07 · intermission 1:30–2:10
    without 3d   AP[20] Zerk[20] drums[0,130] IV[30,140] Icon[20,140] gem[20,140]   104.143286   6 moments
    with 3d      AP[7]  Zerk[7]  drums[7,130] IV[37,137] Icon[7,137]  gem[7,137]    103.961744   4 moments
    planBetter(with3d, without3d) = FALSE      planBetter(without3d, with3d) = TRUE
```

⇒ **3d emitted a plan its OWN comparator rejects**, and the single regression is **larger than the
largest gain**. Verified by scoring both layouts on ONE engine, so it is a real score difference and
not an artifact of comparing two builds.

### ✅ 1c. THE MECHANISM **IS** ESTABLISHED, AND THE FIX IS ONE LINE OF POSITION (07-31)

Both hypotheses below were tested and **hypothesis 2 is FALSIFIED**: solved ALONE under the 3d engine,
`drums+icon+gem · h0 · 2:40 interm` reads **103.961744**, identical to its in-sweep value. It is not
cross-cell memo contamination; `kit-sweep` is exonerated and the regression is a real property of 3d.

**Nor is it `phaseRerank` losing monotonicity.** From an identical start, both engines return an
identical result — A→A and B→B on both. The two layouts are each a local optimum under both move sets.

⇒ **A GREEDY DESCENT IS NOT MONOTONE IN ITS MOVE SET.** Offered a new move *early*, the descent takes a
different locally-better step and converges to a **worse basin**. Nothing is walking downhill; it is
simply arriving somewhere else. 3d sat after class 3c, i.e. before the single-press and structural
classes, so it preempted them.

**The fix is to run 3d LAST**, after every older class. The descent then exhausts exactly the moves it
had before, reaches exactly the fixed point it reached before, and only then is 3d consulted — where it
can only extend. **Strictly ≥ by construction, not by measurement.** Verified:

```
  drums+icon+gem · h0 · 2:40 interm      no 3d 104.143286 · 3d EARLY 103.961744 · 3d LAST 104.143286
```

### ★★ AND THE USER HIT THIS DEFECT INDEPENDENTLY, ON A REAL FIGHT

07-31, a 7:00 Kael'thas plan hand-edited through lock-and-validate beat the tool by **+0.113552 casts,
57× the tie band**:

```
  model   … scb[105,281,401] arcanePower[105,285] berserking[107,287]     254.861547
  user    … scb[105,285,405] arcanePower[105,285] berserking[110,290]     254.975099
```

The gem sat at 281 while Arcane Power sat at 285 — **the value cluster was split by 4 seconds**, and
closing it carries **0.084** of the 0.114 on its own. It could not be closed because the gem's 120 s
cooldown makes `285 + 120 = 405`, so its third use must move too: the chain closure exactly.
⇒ With 3d LAST, `phaseRerank` from the model plan reaches **254.982121** — better than the user's own
line, additionally finding `isc[-5,115,…]`.

### ✅✅ RESOLVED 07-31 — T6 REVISED BY USER RULING, 3d SHIPPED

The user ruled: **revise T6, ship 3d.** The reasoning is their own framing of what the tie-break is
for — *"I expect there will be a lot of plateaus, especially in short fights where you use everything
once, that's why we implemented the earliest rule so we always have THE correct answer."* If it is a
canonicaliser, then the canonical member IS the answer, and the old T6 was simply the member the search
happened to reach. Nothing about damage was overturned: the two layouts are tied at +0.000231 casts,
8.6× inside the band, so the scorer never had the power to separate them.

```
  T6 was    icyVeins[7,37]  isc[7]  scb[7]  arcanePower[7]  berserking[27]     4 press moments
  T6 now    icyVeins[15,35] isc[15] scb[15] arcanePower[15] berserking[5]      3 press moments
```

⇒ **`index.html` ships move class 3d, placed LAST** (§1c — position is load-bearing). Gates after:
anchors **8/8**, law-check green with its control catching 9 lines, self-consistency `0.00e+0` / 0
structural, `search-audit` on the preset sweep **no SCORE miss**, and the **kit × haste matrix
63 of 63 local optima — SCORE misses 0, tie-break misses 0**, up from 59/63 with one real miss. The
matrix that opened §8y now closes it.
★ And the user's own case is fixed: on the 7:00 Kael'thas cell the shipped engine reaches **254.982121**
from the old model plan — past both the old model (254.861547) and the hand-edited line (254.975099).

⚠ **This is the only declared layout ever revised, and the bar it had to clear is recorded** so the
precedent is not misread: it was legitimate ONLY because the tool did not get its way on damage. The
score gap was inside the tolerance the project already calls "tied", so the change settled which member
of a plateau is canonical, not whose layout does more. **Editing a test because the tool disagrees with
it remains forbidden** — that is what killed `exact-match`.

### ⛔ (superseded) SO 3d IS READY, AND T6 IS THE ONLY THING BLOCKING IT

With the position fixed, 3d costs nothing on the kit matrix and repairs a 0.114-cast miss on a fight the
user actually plans. It still makes **T6 fail**, exactly as part 3 describes and for the same reason —
it makes T6's tied-but-differently-shaped alternative *reachable*. That is unchanged by the
repositioning, because it is not a search defect at all: it is the plateau ruling.
⇒ **The T6 call now has a price attached.** It is no longer an abstract question about one declared
layout; answering it ships a measured improvement on a real user fight. `index.html` stays clean
(anchors 8/8, `PLAN-DIFF IDENTICAL`) until it is answered.

### ⚠ THE MECHANISM (superseded by 1c above — kept for the reasoning that got there)

This should not be reachable. `phaseRerank` carries the §8w ceiling, and `phaseFinish` seeds `bv` from
its own input and only adopts on `planBetter`, so both stages are monotone by construction. Two
hypotheses, **both unverified**, and the probes for each exceeded the session's runtime (this cell is
among the slowest in the matrix):

1. **Chain drift in `phaseFinish`.** It has the identical banded-accept structure §8w fixed inside
   `phaseRerank` and **no ceiling guard** — but ~8 starts caps the drift at ~8 bands ≈ 0.016 casts,
   an order of magnitude short of 0.18. Insufficient on its own.
2. **Cross-cell memo contamination.** `kit-sweep` solves all 63 cells in ONE process and `simulate`'s
   memo is module-level state. §8z found one incomplete memo key the same day; a second would make a
   later cell read an earlier cell's score, and 3d changes the call ORDER. ⇒ the decisive probe is
   solving this cell ALONE under the 3d engine: if it emits the good plan, the regression is memo
   contamination and **not a property of 3d at all** — and, far more seriously, it would mean
   `kit-sweep` results in general are order-dependent.

⛔ **UNTIL ONE OF THOSE IS CONFIRMED, 3d STAYS OUT** — and note hypothesis 2 would indict the
instrument rather than the move class, so "ship 3d and fix the cell" is not available either.
⛔ **The 07-30 recommendation *"on that evidence I'd revise T6 and ship 3d"* is WITHDRAWN.** It rested
on the 15-preset corpus, which did not contain this cell. The T6 call (part 3) is now **independent**
of 3d: T6 is a question about the tie-break, 3d is a search change that needs its own clearance.

---

### 3. ⛔ THE OPEN QUESTION — T6 IS NOT THE ARGMAX, AND THE OBJECTIVE PREFERS SOMETHING ELSE

With 3d in place the tool emits, for T6 (2:00, Lust 0:05, 1387 SP, 38 % crit, h = 0):

```
  declared (T6)   AP[7]  Icon[7]  gem[7]  IV[7,37]   Zerk[27]     100.784861   4 press moments {5,7,27,37}
  emitted w/ 3d   AP[15] Icon[15] gem[15] IV[15,35]  Zerk[5]      100.785092   3 press moments {5,15,35}
                                                                  Δ = +0.000231 casts
```

**Brute force settles it: over 1,582,581 legal cluster-locked layouts, the declared T6 ranks 33rd, and
the emitted plan IS the score argmax.** 3446 layouts sit within one band of that argmax — the plateau
is enormous. And the emitted plan does not merely tie: it wins the tie-break's **first** criterion,
3 distinct press moments against 4, because Berserking rides the raid's Bloodlust call at 0:05.

⚠⚠ **THE "ARGMAX OVER 373k LAYOUTS" CLAIM IN §8s, `tests/anchors.mjs` AND CLAUDE.md IS THEREFORE TOO
STRONG AND IS CORRECTED HERE.** That enumeration was real but its space was narrower — it did not
range Berserking down onto the Lust call, nor the cluster up to 0:15. §8s's actual finding stands
untouched: the *then-emitted* `IV[5,35] Zerk 25` (100.779046) was a genuine search miss worth
+0.0058 casts, and move class 3c fixed it. What does not stand is "and the result is the global argmax".

**It is a coherent plan, not an exploit.** Checked against the project's own laws: Berserking [5,15]
abuts Icy Veins [15,35] abuts Icy Veins [35,55] — the packing law (RULES §4c), a clean train from the
Lust call. Sweeping Berserking with everything else held shows the model pricing both effects exactly:
+0.0203/s from 0→5 (converting seconds from outside Lust to inside it — `0.0867 − 0.0667`, the
ESTABLISHED-FACTS §5 pair values to four decimals) and −0.0867/s after 5 (each second of overlap with
Icy Veins, the §8s number). ⚠ A first hypothesis — that the plateau is an artifact of the opener ramp
being priced haste-neutral (§8q) — was tested and is **FALSE**: the model prices the ramp, `Zerk@0` is
−0.101 casts against `Zerk@5`.

⇒ **THE CALL IS THE USER'S, AND IT IS THE FIRST THING TO SETTLE NEXT SESSION.** Two coherent readings:

- **(a) T6 stands.** Then the objective's tie-break is missing a rule that prefers it — the obvious
  candidate is anchoring the value cluster at 3 stacks, which is exactly the rule the user declared for
  T3 (*"pop the first cluster as soon as 3 Arcane Blast stacks are active and Lust is active"*). That
  is a change to the crown-jewel objective and ripples through all eight tests.
- **(b) T6 is revised** to the objective's answer. ★ Worth noting that (b) still satisfies the user's
  ORIGINAL complaint, which was *"why is the first IV at 0:06 not 0:07 **along with the other
  things**"* — a demand that Icy Veins be co-pressed with the cluster. It is, at 0:15.

⛔ **Until that is answered, class 3d stays out and the last kit-matrix SCORE miss stays open.** Shipping
3d today would make the tool emit, for the very fight the user filed a bug report about, a plan they
did not ask for — on a 0.000231-cast difference the model itself declares to be noise.
⚠ T6 is also the ONE declared test flagged in `tests/anchors.mjs`'s header as having no explicit user
mandate (it came from a question, and was added on the assistant's initiative). That flag is now
load-bearing rather than decorative.

---

## §8z — ✅ THE MEMO KEY OMITTED `killMode`, AND IT CORRUPTED THE MEASUREMENT SENT TO FIND IT (07-31)

Chasing the open item §8y left behind — *the integral RANKS but stops hard at T, while the per-cast
board applies the one-sided kill credit; two boundary conventions and only the simple one ranks* — the
first sweep-wide measurement came back **exactly 0.000000 casts of shift in all 15 cells**. That is too
clean to be a physical result, and it was not one.

**`simMemoCfgSig` listed `boundaryCharge` but not `killMode`.** Two cfgs differing only in the kill rule
hashed identically, so the second was served the first's cached score. The instrument built to ask
"does the kill rule move a ranking?" was structurally incapable of seeing the answer.
⇒ fixed by adding `cfg.killMode || "none"` to the signature. **Plan-neutral by construction** (nothing
in the product sets `killMode`) and verified so: `PLAN-DIFF IDENTICAL` 15/15, anchors 8/8, law-check green.

⚠ **A SECOND, DEEPER CACHE ASSUMPTION IS UNCHANGED AND IS NOT A BUG: `if (simMemoCfg === cfg) return
simMemoCfgSig`.** The identity fast path never re-reads the fields, so **mutating a cfg after its first
`simulate` call silently keeps the old signature** regardless of what the key contains. That is a
documented design ("one cfg dominates any run"), not a defect — but it means a probe must build a
FRESH cfg per variant, and a probe that mutates one in place will read stale numbers no matter how
complete the key is. Both of this session's throwaway probes hit it before the pattern was understood.

### And the answer to the question, now that it can be asked

| | measured |
|---|---|
| level shift, `none` → `oneSided` | **+0.499333 casts**, 250× the tie band |
| …and it is the SAME shift in all 15 corpus cells | yes — `rate_at_kill · KWD/2` = `(1/1.5)·(1.498/2)` |
| neighbourhood argmax changes | **0 of 15** |
| margin between two layouts that DIFFER in rate at the kill | moves **0.0999 casts**, 50× the band |
| argmax over 75,600 layouts on a 60 s fight built so buffs cover the kill | **identical under both modes** |

⇒ **The kill rule is a pure LEVEL SHIFT on this corpus, and a constant cannot change a ranking.** The
old note guessed the right exposure — *"the case it could bite is two plans differing in RATE at the
kill, which the four cases do not cover"* — and that case is now covered and does not bite: the tail
credit favours the layout with the higher rate at the kill, which is already winning on the same
grounds inside the fight, so the credit **reinforces rather than reverses**. ⇒ §18 CLOSED as measured
rank-neutral; the default `none` stays. ⛔ The residual risk is stated precisely rather than left as
"probably fine": it is rank-neutral **only** while compared layouts share a cast rate at T. A future
buff that can run past the kill on one line and not another re-opens it, and the 60 s construction
above is the ready-made probe.

---

## §9a — ✅✅ CLOSED 07-31. The opener toll was wrong four ways; all four are fixed, plus the debuff anchor.

> **✅ LANDED THE SAME DAY, AND NO PLAN MOVED.** `PLAN-DIFF IDENTICAL` — 15/15 swept cells emit
> byte-identical plans against the pre-fix engine, with one cell repriced (T8, whose intermission at
> 0:15-0:20 is exactly F3/F4 territory). anchors **8 of 8**, self-consistency **0.00e+0 / 0 structural**,
> `toll-audit` **12/12**, `objective-ref` **9/9** against an independent transcription.
> ★ **F1 and F4 turned out to be ONE fix, and a structural one.** A ramp cast now records its own
> realised interval `iv` and the steady interval `sv` at the same haste; the rung is `(iv − sv)/sv`.
> F4 falls out because `interval` was computed from `stacks`, so the rung is automatically indexed by
> the stack count. F1 falls out because above the floor `sv` pins at 1.0 s while `iv` keeps shrinking.
> **And §8q survives**: below the floor the `1/m` cancels top and bottom, so every rung is
> haste-invariant — §8q's ramp-neutrality *is* the sub-floor regime.
> ⚠ **Six `law-check` expectations were stale, not the engine** — that file's header says to assume
> exactly this, and it was right again. The important one: `§8r: Icy Veins is exactly ramp-neutral`
> pinned Bloodlust for a matched control, putting Icy Veins at `m·v = 1.56`, and §1.2b says neutrality
> holds *exactly while `m·v ≤ 1.5`*. The control had put the buff above its own threshold and asserted
> neutrality there; it read 0.00000 only because the toll was flat. It now reads **+0.16602** against a
> closed form of `tollLaw(1.3) − tollLaw(1.56)`, and the gate asserts **both sides** of the threshold.
> ⛔ **Still open from this section: nothing.** The remaining items are §9b (PoM, Potency) and the
> "filed separately" list below — none of them is the toll.

### (the original filing follows)


Three subagents were briefed separately — one on AoE phases, one on burn/intermission phases, one on the
integral's exactness — with no shared context beyond `BRIEF.md`. All three converged on the **same
twelve lines**: the toll block at `index.html:1721-1733` and its application at `:1788`. That convergence
is the finding's main credential; each defect below was independently reproduced with an **exact closed
form matched to ≥6 decimals**, not a sampled estimate.

Orientation: the toll represents *Arcane Blasts lost while stacks build*. It is computed as a lump
(`lost`) spread as a negative rate over a fixed unhasted window `NOMINAL = ΣC_k = 6.498 s`, and charged
as `contrib = (rateAt(mid) − tollR · scanAt(mid).dmg2) · len`.

### F1 — the toll is charged flat at 1.332 casts at EVERY haste, and above the GCD floor that is fiction

`lost` is built from the unhasted ladder `(C_k − G)/G`, which is m-independent **only while the steady
interval is `G/m`**. Once `m > 1.5` the steady interval pins at the 1.0 s floor while the ramp casts keep
shrinking, so the true deficit collapses. `ESTABLISHED-FACTS §1.2` already states the general form
`[Σ max(C_k/m, i) − 3i] / i` and tabulates it; the engine no longer reproduces that table.

| m | 1.0 | 1.2 | 1.5 | **1.56** | 1.716 | 2.0 | 2.5 |
|---|---|---|---|---|---|---|---|
| general form | 1.332 | 1.332 | 1.332 | **1.165** | 0.787 | 0.333 | 0.000 |
| engine ∫ | 1.332 | 1.332 | 1.332 | **1.332** | 1.332 | 1.332 | 1.332 |

★★★ **THIS DOES NOT CONTRADICT §8q — IT SUBSUMES IT, AND THAT IS THE WHOLE REASON THE FIX IS SAFE.**
§8q rejected recomputing the toll at hasted cast times because it made haste *compress* the ramp and sent
Icy Veins back to the pull. Below the floor `max(C_k/m, i) = C_k/m` and `i = G/m`, so the `1/m` cancels
top and bottom and the general form is **identically 1.332 at every m ≤ 1.5** — §8q's haste-invariance is
exactly the sub-floor regime, which is where §8q was measured. The general form preserves it and adds
only the above-floor decay. ⇒ `§11`'s flat-form assertion is the special case mistaken for the law.
⚠ **Reachable at ZERO gear haste**: `Bloodlust ×1.30 × Icy Veins ×1.20 = 1.56`. This is an ordinary raid
pull, not an exotic corner.
Measured consequence — the §8o signature, a flat plateau where the truth has a slope: at h=450 with Lust
pinned and Icy Veins slid 0→20 s, `rankScore` is **bit-identical** across the whole sweep while the
engine's own realised lattice spreads **0.4807 casts** (240× `TIE_CASTS`). At h=0 on an ordinary
post-intermission re-ramp the same shape costs 0.1447 casts (72× the band).
⇒ **The model prices haste coverage of a cold ramp at exactly zero. The truth is 0.14–1.33 casts.**

### F2 — the toll is priced as an ARCANE EXPLOSION when its window overlaps an AoE phase

`tollR · scanAt(mid, segB).dmg2` reads the **local** per-cast damage, which inside an AoE segment is
`AE × N × aoeCritAmp`. Casts lost to an Arcane Blast ramp are then billed at `M(N)` — and there is no AB
ramp inside an AoE phase at all (`prevCastRamp = !isAoe && …`, `:1487`). Two audits derived the same
closed form `lost · (overlap / NOMINAL) · (M(N) − 1)` and matched it to 6 dp:

| N | 1 | 2 | 3 | 4 | 6 | 10 | 20 |
|---|---|---|---|---|---|---|---|
| extra toll (casts) | −0.061 | −0.11 | +0.15 | +0.41 | **+0.94** | **+2.05** | +3.5 |

**Decision-relevant, not just a level shift**: sliding Arcane Power across the window, pressing at the
pull is charged **0.7731 casts** more "opener toll" than pressing at 0:08 (387× the tie band), of which
0.568 is the spurious AoE-priced portion. It fires on re-ramps too (intermission → adds is the realistic
shape): with the AoE 4 s after an intermission exit, +1.245 casts.

### F3 — the toll VANISHES where its window meets an intermission or the fight end

The toll rides on `contrib`, so the integral's `if (segB.type === "intermission") … continue` deletes it,
and `bps` is clipped at `T` with `killW = 0` past it. Neither reduction is declared anywhere — `lost`
already handles a ramp cut short, so this is a second, silent truncation. Opposite sign to F1/F2:

| fight | declared | charged | lost |
|---|---|---|---|
| control | 1.3320 | 1.3320 | 0 |
| intermission [3,20], T=120 | 2.4427 | 1.8448 | **0.598** |
| intermission [3,31], T=33 | 1.7773 | 0.7180 | **1.059** |

### F4 — the per-cast cost is indexed by POSITION IN THE GROUP, not by stack count

`:1729` uses `idx`, which restarts at 0 per contiguous ramp group; `boardRamp` never carries `stacks`.
Those coincide only when a ramp starts cold. They do **not** in the mid-cast-lapse band added 07-28
(`lapsedMidCast`, `:1496`), where the walk correctly emits stacks `[3,1,2]` so the ramp resumes at **1
stack**. The engine charges the 0-stack and 1-stack deficits (`0.666667 + 0.444000 = 1.110667`) for casts
that are actually 1-stack and 2-stack (`0.4440 + 0.2213 = 0.6653`, which is what `ESTABLISHED-FACTS
§1.2d` and this file's own "✅ FIXED 07-28" entry both state). **Over-charge exactly 0.445333 casts**,
223× the tie band — reproduced identically by two audits, and confirmed by a one-line corrected copy
(`boardRamp[i].k = stacks`) that moves **exactly 0.445333** on the affected cases and **exactly 0.000000**
everywhere else. The 07-28 fix landed in the walk and was never propagated to the toll.
Second trigger: any phase that *interrupts a ramp in progress* — `flush()` restarts `idx` at 0 regardless
of the resuming cast's stack count.

### What is NOT wrong — checked hard, and worth not re-checking

* **The breakpoint set is COMPLETE and the midpoint rule is EXACT.** 400 randomised fuzz configs
  (random T, kits, phase layouts at non-integer times, prepull presses, haste 0–400) under three
  independent tests — refinement invariance to 32–512×, a bisected discontinuity hunt at 120k–300k
  samples, and a brute Riemann sum. **Worst relative Δ = 7.0e-16; missed breakpoints = 0.** The defect is
  in the *integrand*, never in the integration.
* **Terminal handling at `T` is exact** (`d(score)/dT − rate = 2.5e-13`), and there is no ramp
  double-count — the "suppression" the comments at `:1646`/`:1690` describe was removed by §8q.
* **AE damage factors, the AE = GCD interval (0 disagreements over 5607 haste states), `aoeCritAmp`'s
  algebra (exact to 1e-12), and Tirisfal's exclusion from AE** all verified against SOURCES.
* **The burn multiplier is a clean OUTER multiplier** on the additive AP+Tirisfal pool — ratio exactly
  2.000000000 in all four `{t5two} × {AP}` cells, which is the game's bucketing (a target damage-taken
  debuff is a separate bucket from caster percent-damage-done aura mods).
* **Intermission accounting is exact**: `(200−30)/1.5 − 2×1.332` to float precision, no credit for dead
  time and no refund.

### Blast radius, and why no gate caught any of this

**All four are latent on the shipped corpus** — checked against all 18 presets, Δ = 0.000000 on every
one. No preset has a gap in the mid-cast-lapse band, no preset uses `burn` at all, and Kael'thas (the
only AoE fight) has every ramp group starting at 0 stacks with no toll window overlapping its AoE phase.
⇒ they are reachable only through the "Complicated fight" editor and through `m > 1.5`, which is exactly
the *"correct across **future** phases, trinkets, gear, and spell-haste levels"* property CLAUDE.md sets
as the goal. `exact-match` locks in whatever the search emits, `self-consistency` compares the objective
against itself, and `law-check` had no toll line above the floor — so none of the three could see it.

### Also found, filed separately, NOT part of the toll block

* ✅ **FIXED 08-04 — `buildSegments` overlap resolution is ORDER-INDEPENDENT and the UI warns.** The
  old rule was "last row wins ENTIRELY", silently deleting the other phase, so the same fight scored
  **202.40 vs 212.00 effective casts (Δ = 4.7 %)** depending on data-entry order. The winner of each
  elementary interval is now chosen by a TOTAL order (intermission > aoe > burn; inside a type the
  later-starting, then earlier-ending, then stronger row — the "execute burn nested in a whole-fight
  burn" idiom resolves the way the user means it), so permuting the rows cannot change the segments —
  verified both orders score bit-identically, and the old rule demonstrably didn't. Overlaps are
  reported on the returned array (`.overlaps`) and the phase editor surfaces a warning naming the
  rows, the interval, and the winner. Non-overlapping input resolves identically to the old rule
  (single covering row per interval): 27/27 presets carry zero overlaps and the preset plan-sweep is
  byte-identical across the change. ⚠ Still open from the same audit: the UI writes `mult` onto every
  row including AoE rows, and the AoE damage branch ignores `seg.mult` entirely, so a burn can never
  apply to Arcane Explosion.
* ✅ **FIXED 08-04 — `killMode:"oneSided"` scored `(T, T+KWD]` with the last phase still in force**: a
  fight ending in a 10-target AoE phase booked phantom Arcane Explosion after the boss died (measured
  +2.21 casts on the repro; the original filing said +1.71 on its case). The integral's segment scan
  now nulls `segB` past the last segment's end — the walk's own "past the last defined phase: plain
  casting" convention — so the tail earns the plain one-sided AB flux (+0.499 casts, identical to the
  non-AoE-ending control's, which is the window's honest content). `"sym"`'s `T±0.5` kinks are now in
  `bps` too — measured, the mode had been reading BIT-IDENTICAL to `"none"` (its window never
  contained a slice midpoint), worse than the 7e-4 the filing estimated. Both were latent at the
  default: verified inert — plan-sweep `PLAN-DIFF IDENTICAL` with `scorerMoved=0`, the whole battery
  green.
* ✅ **SETTLED 08-04 — the AoE press-snap (RULES §9 Correction 3) reaches the EXECUTION layer, not
  the ranking, and that split is deliberate (MECHANICS §0, which postdates the correction).** This
  entry originally read "two presses that fire at the identical instant are separated by 0.05783
  casts... `rankScore` is perfectly linear in press time across the phase" — **that does not
  reproduce on the current engine**, and the re-measurement (fight: intermission [60,90] → aoe
  [90,150] ×6, isc and AP swept one press-second at a time, h0 and h200) replaces it:
  · the snap is ALIVE where it should be: presses 98 and 99 both fire (`actEff`) at 99.000 — fire
    times, board, reported sum and transcription all see it;
  · the ranking across the phase INTERIOR is **flat to the digit** — same-instant presses tie at
    Δ = 0.000000, exact and non-exact lattices alike (correct translation invariance, not a slope);
  · a window hanging PAST the wall is priced (−0.053 casts/s at h0), so Correction 2 is intact;
  · same-instant presses ARE separated across a DEAD ZONE (presses 59–90 all fire at 90.000, scored
    apart by up to 4.96 casts) — the geometry discounting window seconds that contain no casts,
    which only ever demotes DOMINATED candidates (the same-fire family's winner has no dead
    coverage), so no emitted plan is affected;
  · **the one real residue is the exactly-flush clamp**: window ends 145→150 all tie, so "flush
    loses its last AE" is unexpressed — bounded at ~E[slip] × wall slope ≈ 0.04 casts, kept out of
    emitted plans by the tie-break's "earliest" (which resolves the plateau away from the wall),
    and pricing it is a user-gated SCORING change (a one-sided expectation charge at AoE-cut window
    ends, kin to the kill credit — never a lattice). RULES §9 Correction 3 carries the full status.
* ✅ **FIXED 08-04 — `rampCasts` / `rampCastDmg` deleted.** It was the pre-§8q discrete ramp-damage
  scoring path surviving as write-only work: an O(|active|) Set build + sort + piecewise integration
  per ramp cast on EVERY `simulate()` (called ~5.7 M times per long-fight optimize), read by nothing.
  Its private helpers (`nonAB`, `segAt`, `RAMP_JITTER`) went with it; `rampSpans` stays (a live
  breakpoint feeder). Verified bit-identical: preset plan-sweep `PLAN-DIFF IDENTICAL` with
  `scorerMoved=0`, anchors 17/17, full scorer battery green — and the same 21-cell sweep dropped
  ~20 % CPU (133 s → 107 s), which is what deleting per-call dead work from the hottest function
  should buy.

### ✅ SETTLED AT THE SOURCE, AND FIXED — the AB debuff anchors on the last LANDED COMPLETION

> **✅ LANDED 07-31.** `lastCastStart` is now `lastCastEnd`, because all three of its uses change meaning:
> the gap is completion→start and the mid-cast-lapse test is completion→completion. Plans unchanged.
> ★ **Two instruments had memorised the old anchor**, and both were the instrument being wrong:
> `law-check` hardcoded "L = 4 / 6 / 8" for the three cases — the right lengths for a START anchor —
> which encodes the anchor **twice**, so the gate could never say it had moved, only that something
> broke. It now reads the realised gap off the board and predicts the case from it, sweeping L = 3…11 s
> plus a line asserting the sweep actually **contains** all three. `toll-audit` had a two-case law and a
> third case (`3,3,3`, no re-ramp at all) appears once the anchor buys ~1.5 s of headroom.


Raised by two audits as an open question, then settled by a third **against wowsims source** rather than
by argument. `sim/mage/arcane_blast.go` calls `mage.ArcaneChargesAura.Activate(sim); AddStack(sim)`
**inside `ApplyEffects`** — at damage resolution, on cast **completion**, and only `if result.Landed()`.
`sim/mage/arcane_charge.go` gives that aura `Duration: 8 s`. ⇒ the debuff expires at *(completion of the
last Blast that RESOLVED) + 8 s*.

`index.html` tests `t − lastCastStart >= DEBUFF_DUR` (and `lapsedMidCast` uses the same anchor), where
`lastCastStart` is the **start** of the last Blast in the walk — **including a Blast the walk itself
scored as cut at an intermission or AoE wall** (`frac ≈ 0.001`, no damage, yet it still sets
`lastCastStart` and increments `stacks`). Two errors in one: start-vs-completion, and counting a
cancelled cast as one that landed.

⚠ **Why nobody caught it:** the two anchors differ by `interval − cast`, which at h = 0 is **2 ms** — a
3-stack Blast is 1.498 s against a 1.500 s GCD. It grows to **0.040 s under Lust × IV**, **0.127 s under
Lust × IV × Berserking**, and to a **whole cast time** whenever the pre-wall Blast actually resolves. And
it lands on the knife-edge of the 8 s cliff, whose price is 1.332 casts (full re-ramp) or 0.665 (the
mid-cast-lapse band). A 2 ms error is worth 1.11 casts when it decides which side of a cliff you are on.

**Demonstrated to change the plan, with controls run first.** A patched copy re-anchoring on the last
landed completion (+147 bytes): **7605 schedules on phase-free fights, 0 differ** — the patch touches
only gap handling. Then on intermission `[51.8, 58.8]` at m = 1.56, the debuff lapses **21 ms** before
the next completion: game → resume at 1 stack, model → 3 stacks, and the whole downstream lattice
re-phases by 0.64 s. On that one fight **423 of 5460 layout pairs genuinely reorder** (both margins above
`TIE_CASTS`), largest margin **±1.110667 casts = 555× the tie band**; `icyVeins:[39]` beats `[40]` by
1.11 in the stock model and *loses* by 1.11 under the wowsims anchor, and the top-ranked layout differs
outright. Breadth: **110 of 707** one-coordinate ladders score differently, and the disagreements run in
**both directions** — so it cannot be absorbed into a constant.

---

## §9b — TWO MECHANICS THE MODEL DOES NOT HAVE (07-31)

### PoM — ✅ RESOLVED 08-04 AS A RULE, NOT A TRACK (RULES §18) — Presence of Mind is not modelled, and deliberately so

> **The valuation below closed to a formula, and the formula is the resolution:** zero at steady
> state (GCD-bound at every haste), 0.667 casts m-independent on a cold ramp's first cast, scaled by
> the damage state over the ramp (1.004 under AP) — so the optimal use is *"first Blast of each cold
> ramp; give charges to AP-covered ramps first"*, decidable by eye from the plan the tool already
> prints. PoM is off-GCD and shares nothing with any scheduled track, so pressing it moves no other
> press and cannot change which layout is optimal — a search dimension would reach nothing the rule
> doesn't. RULES §18 carries the rule and the one honest residual (the early-cluster cheapening,
> no demonstrated flip). The measurement below stands as the derivation.

`sim/mage/presence_of_mind.go`: off the GCD (`DefaultCast: {NonEmpty: true}`, no GCD field — exactly the
"free press" class this tool already schedules), **180 s cooldown**, `SpellMod_CastTime_Pct −1` on the
next non-instant cast. It is a 15-point Arcane talent **every 40-point Arcane raider has**. The only
mention anywhere in the repo is one incidental clause in `README.md:68`.

Its valuation is the interesting part, and it is a scheduling decision rather than a constant:
* **At steady state it is worth exactly ZERO.** A 3-stack Blast is 1.498 s — under the GCD at every
  haste and every rating tested, so the interval is always GCD-bound and deleting the cast time saves
  nothing. (Zero cast-bound cases across h ∈ {0…1200} × {bare, Lust, Lust+IV, Lust+IV+Zerk}.)
* **On a cold ramp it is worth `(2.5 − 1.5)/1.5 = 0.6667` casts, m-independent** — it deletes the
  largest of the three toll rungs (`1.3320 → 0.6653`, and that 1.3320 matches the documented opener toll
  exactly, which is the check that the reasoning is sound).
* **And its value is priced by the damage state over the ramp it covers, exactly like the toll**: on the
  T=98 / Lust 0:05 cluster ladder it is worth **1.004 casts** with the cluster at 0:00 (Arcane Power over
  the ramp) and **0.667** at 0:07 and later — a 0.337-cast spread, 168× the tie band. That drops the cost
  of pressing the opening cluster early by 29 % (1.181 → 0.844 casts), which is precisely the quantity
  the docs say decides 0:05 vs 0:07.

0.6667 casts is **0.476 % of a 200 s fight** — larger than the entire 0.004–0.380 % cross-val deficit
range the project is chasing, and 333× `TIE_CASTS`. With a 180 s cooldown and any fight containing
intermissions there are 2–3 cold ramps and 2 charges, i.e. a genuine allocation problem the tool cannot
currently express. *(Honest caveat from the audit: the single-coordinate opener ladder above 0:07 is an
exact plateau, so no argmax FLIP was demonstrated — the evidence is magnitude and schedule-dependence.)*

### Potency — the single-target +3 pp crit is normalised away, and that is only safe WITHOUT Ashtongue

`sim/mage/talents.go`: Arcane Concentration procs `0.02 × ranks` **per landing hit** (10 % at 5/5), and
the Clearcasting aura carries `ArcanePotency × 10 × SpellCritRatingPerCritPercent` = **+30 % crit**,
consumed by the next damaging cast. Single target that is exactly **+3.0 pp average Arcane Blast crit,
permanently**. `aoeCritAmp` is a ratio against the N = 1 Potency baseline, so it returns exactly 1 at
N = 1 and the +3 pp never reaches `critFactor`; `buffedStats()` adds Arcane Impact's +6 % but no Potency
term. `SOURCES.md` records this as a *readout* omission. **It is more than that.**

Crit cancels only where it is a constant factor, and it is **not** constant in `qCast = crit ×
ATI.procChance` — the Ashtongue Talisman's proc rate is a **haste** source, so it interacts with the GCD
floor and with where every haste buff goes. Measured over 1023 layouts / 522 753 pairs at crit 38 → 41
(the exact Potency delta):

| kit | genuine rank flips (both margins > `TIE_CASTS`) |
|---|---|
| no Ashtongue | **0** |
| with Ashtongue | **3849** |

Largest: `{IV@20, cluster@20, Zerk@6}` beats `{IV@40, cluster@5, Zerk@42}` by 0.0366 at crit 38 and
**loses by 0.0389 at crit 41** (18× the tie band). The no-Ashtongue control's max shape difference is
`3.3e-16` — float noise — which is the clean confirmation that crit really does cancel otherwise. ⇒ the
AoE channel for crit is already known and flagged in SOURCES; **the Ashtongue channel is not.**
✅ **CLOSED 08-03 (§9m):** the Ashtongue channel now feeds the proc rate — `atiProcQ` reads the
effective crit (the exact Potency mixture), the constants moved into `GAME.ATI` with a SOURCES row,
and the law-check ATI block pins the lift at 1e-6. The PoM half of this section stays open.

### Verified CLEAN against wowsims source — do not re-derive these

* **Haste pooling is exact.** `core/unit.go:501` — percent buffs multiplicative, all rating sources
  (gear, Drums 80, Skull 175, MQG 330, Ashtongue 145) additive into one pool; `GCDMin = 1 s`,
  `GCDDefault = 1500 ms`. The floor-vs-rounding nesting is provably equivalent to wowsims'
  `max(GCDMin, …Round(ms))`.
* **Every `BUFFS` row matches the source**, including Berserking's `ShouldActivate: tag == 1` selecting
  the 10 % rank (the model's full-health assumption), Ashtongue's `ProcChance 0.5` on crit with
  **genuinely no ICD** (so the per-hit AoE roll `1−(1−crit·0.5)^N` is right), and PI sharing Bloodlust's
  exclusive category while Icy Veins does not.
* **Arcane Explosion**: coefficient `0.214`, roll 377–407 → mean 392, GCD-bound and instant, and
  `CalcAndDealAoeDamage` deals full damage to every target with **no target cap and no total-damage
  cap** — so the model's linear-in-N is exactly what wowsims does. (A TBC-era AoE damage cap could not
  be substantiated in the source; flagged so it is not re-derived.)
* **The AB spellpower coefficient** `2.5/3.5 = 0.7142857` vs wowsims' `0.71399998665` is not a pure
  constant (it re-prices +SP buffs), so it was measured rather than waved through: max score difference
  `5.8e-4` casts over 1023 layouts, **0 rank flips**. Immaterial.
* **The mana gem is off-GCD** in wowsims, so the tool's free-press treatment of the SCB trigger is
  correct. It does sit on the 2 min `GetCombatConsumableCD` shared with potions — latent only if potions
  are ever added.

---

## §9c — ✅ CLOSED 08-01. The tie-break had no notion of COLD SNAP; now it is criterion one.

**T9 was declared red and is now green, 9 of 9.** The user's 6:20 ruling put the second Icy Veins at
3:00 against the 3:05 the tool emitted. The two layouts are **bit-identical** under the objective —
`rankScore` returns the same double, `a === b` exactly — so the scorer had no say and the tie-break
decided. It decided wrong.

### The fix, and it is the user's own reasoning

3:00 is where Icy Veins comes off its own 180 s cooldown, so `0 → 180 → 360` closes with **no Cold
Snap**; the emitted `0 → 185 → 365` must burn one to reach 360. User, 08-01: *"this is the rare case of
Cold Snap literally not gaining any value ever"* — at 6:20 a fourth use would land at 540, past the
kill, **which is exactly why the two tie**. Spending a limited resource that buys nothing is not
neutral: it forecloses an option for no return. So among score-tied layouts, prefer the one that keeps
the charge. `planShape` gains `snaps` (Icy Veins gaps shorter than its cooldown — Cold Snap resets Icy
Veins and nothing else) and `planBetter` tests it **before** `distinct`.

⚠ **It has to outrank `distinct`, and T9 is the case that proves it:** 3:05 co-presses Icy Veins with the
scb/AP/Berserking cluster (**7** distinct press moments) against 3:00 giving it its own (**8**), so
`distinct` actively prefers the layout that burns the Cold Snap.
✅ **And T6 is untouched**, which is the constraint that killed the alternatives: both of T6's candidates
spend one Cold Snap (its two Icy Veins sit 20 s and 30 s apart, far inside the cooldown), so `snaps`
ties there and `distinct` still decides it — exactly as that ruling requires.

### ⛔ Two alternatives, both falsified — do not re-propose them

1. **"Earliest first"** — flips T6 straight back to its pre-ruling layout (`[5,7,7,7,7,27,37]` is earlier
   than `[5,5,15,15,15,15,35]` at index 1).
2. **"Count only SELF-CREATED press moments"** (riding an externally-pinned press is free). This was
   filed here on 08-01 as the promising hypothesis and it is **WRONG** — checked, not assumed. It does
   explain T6 (Berserking rides the raid's Bloodlust call). It does **nothing** for T9, which has no pins
   at all, so both candidates' moments are entirely self-created and the count is still 7 against 8 in
   the wrong direction. ★ Recorded rather than deleted because it was constructed to fit T6 and then
   asserted to fit T9 without being evaluated against it — the exact failure mode this file exists for.

### Verification

`anchors` **9 of 9** · `plan-sweep` + `plan-diff` **PLAN-DIFF IDENTICAL** with `scorerMoved=0` across 15
cells, so no corpus cell has a score-tied pair that differs in Cold Snap usage and nothing else moved ·
`law-check` all reproduce · `self-consistency` PASS. Determinism is preserved: `snaps` is a pure function
of the schedule, so one setup still yields one schedule.

---

## §9d — ✅ CLOSED 08-01. T11 needed a CHARGE-RELOCATION move; the search had none.

> **✅ 11 of 11.** Fixed by ONE new move class in `polish`, and none of the three earlier attempts
> below was needed — all three stay reverted. `law-check` green, `self-consistency` PASS,
> `plan-sweep`+`plan-diff` **PLAN-DIFF IDENTICAL** with `scorerMoved=0` across 15 cells, so the change
> is search-only and moved no existing plan.
>
> **The move: rebuild the Cold-Snap track's WHOLE chain from an anchor** — `[a − dur, a, a + cd, …]`
> for each anchor in {the pull, the raid calls, wherever the other tracks already sit}. At `a = 10`
> that constructs `[-10, 10, 190, 370]` exactly.
>
> ★ **Why no existing class could reach it.** Every other move *perturbs*: `SHIFTS` slides one index or
> a suffix, 3d closes cooldown chains. Re-siting a Cold Snap means relocating a **pair** of presses
> across the fight while the rest of the chain re-spaces — and every intermediate step is worse, so a
> greedy descent can never walk there. `[-8, 172, 192, 372]` was a *true* local optimum: every
> single-press neighbour worse, and both layouts spend one Cold Snap so §9c's `snaps` could not
> separate them either. ⇒ **the lesson is the shape of the move, not the cell**: when a resource has a
> placement (not just a time), the search needs a class that proposes placements WHOLE.
>
> ### (the original diagnosis, kept — it is what made the fix findable)


T11 (6:30, Bloodlust pinned 0:10) declares `icyVeins[-10, 10, 190, 370]` with the cluster on 0:10. The
tool emits the cluster on 0:06 with `icyVeins[0, 180, 360, 380]`, **0.396459 casts worse** — ~200×
`TIE_CASTS`, so not a plateau. `tests/anchors.mjs` classifies it **SEARCH failure**, i.e. `scorerBeats()`
found nothing better in the declared layout's own neighbourhood: the scorer already prefers T11 and the
descent never visits it.

### Localised to `groupSeeds`, with measurements

| | best seed reachable | target (T11) |
|---|---|---|
| shipped | **293.74** casts (32 seeds, **0** with a prepull) | **296.47** |

**No seed is within 2.7 casts of the target basin.** That is the whole defect — this is not a
move-set/comparator problem, because the declared layout is a local optimum the descent would keep if it
ever arrived.

`groupSeeds` builds chains from origins `{0} ∪ pinned raid calls`, then derives every track from the
**same** chain, and spends Cold Snap only as an early repeat *inside* it. Two consequences:
1. **No seed ever contains a prepull press.** Measured: 0 of 32.
2. Origin-10 chains *do* exist — some seed puts Icon on the `[10, 130, 250, 370]` cadence — so the
   origin is reachable. What is missing is the **Icy Veins prepull anchored on that chain**.

### ⚠ An attempted fix, MEASURED NULL and REVERTED — do not re-land it unchanged

A `front` variant was added: for the Cold-Snap track, prepend `G[0] − dur` (clamped to `earliestPress`'s
`−(dur−1)`), so the chain's first press consumes the charge instead of a later short gap.
* It **fires**: 56 seeds instead of 32, 24 carrying a prepull.
* It **raises the best seed 293.74 → 295.21**.
* It **still falls 1.26 casts short**, every prepull seed anchoring at `−19/1` off the **origin-0**
  chain rather than `−10/10` off the origin-10 one — and **the emitted plan is byte-identical**, T11
  still red, 10 of 11.
⇒ reverted on the project's own pre-registered rule (PHASE9 reverted a change measured null). The idea is
right and the anchoring is wrong: the prepull must hang off the **pinned-origin** chain, not off 0.

### The next step, stated precisely

Generate, for each chain whose origin is a **pinned raid call** `o`, an Icy Veins variant
`[o − dur, o, …]`. Then re-measure the best-seed number above; it has to clear **296.47** before the
descent can matter. `groupSeeds` is now exported from `tools/engine-node.mjs` so this is a two-line probe
rather than an instrumented rebuild.

★ **Why the pin is what exposed it, and why T10-vs-T11 is the instrument to keep.** T10 is the *same
fight without the raid Lust* and it **passes** — the only origin is 0, so the origin-0 chain is also the
right one and the descent stumbles into the prepull unaided. Pin Bloodlust at 0:10 and the good layout
hangs off origin 10 with a *negative* first press, outside every bounded neighbourhood of the origin-0
basin. Two declared fights differing by a single pinned press, one solved and one missed, is a far
sharper localiser than any single failing cell.

### §9d continued — 08-01: THREE CANDIDATE FIXES, ALL MEASURED, ALL REVERTED

T11 is **not fixed**. Recording the attempts with numbers so none of them is re-tried blind.

| # | change | effect on the seed pool | effect on T11 |
|---|---|---|---|
| 1 | `front` seed variant — prepend `G[0] − dur` for the Cold-Snap track | 32 → 56 seeds, 0 → 24 with a prepull; best seed **293.74 → 295.21** | emission **byte-identical** |
| 2 | stop culling group seeds against `bar` (the 6th-best BASE seed) | — | emission **byte-identical** |
| 3 | append-a-ready-use move in `polish` | — | basin **changed**, score **296.0706 → 296.0495 (worse by 0.021)** |

★ **THE DECISIVE MEASUREMENT, and it is the one to build on.** The whole deficit is **ONE UNPRESSED
COOLDOWN**, and nothing in the pipeline can create it:

```
iv[-10, 10, 250]        --repair-->  unchanged   292.2204 casts
iv[-10, 10, 190]        --repair-->  unchanged   292.8906
iv[-10, 10, 190, 370]                            296.4697   <- declared
```
`polish` only ever SHIFTS presses; `repair` does not append here. So no reachable sequence of moves
constructs the declared layout from any seed — which is why fixes 1 and 2 could not possibly have worked,
and why measuring them was worth more than reasoning about them.

⚠ **But fix 3 shows "add a move that appends" is not sufficient either.** With it the search reaches the
right *neighbourhood* — Icon lands on `[10, 130, 250, 370]`, **exactly** the declared cadence, and the
whole cluster moves to 0:10 — yet Icy Veins comes out `[-8, 172, 192, 372]`: it spends Cold Snap in the
MIDDLE (172 → 192) instead of at the OPENER (−10 → 10), and everything sits ~2 s late. Both layouts spend
exactly one Cold Snap, so §9c's `snaps` criterion cannot separate them, and the middle placement scores
marginally *lower* — so this is a genuine local optimum the descent settles into, two seconds and one
charge-placement away from the answer.

⇒ **the open question is now sharp: what move takes `[-8, 172, 192, 372]` to `[-10, 10, 190, 370]`?** It
is not a shift of one press (the whole Cold-Snap pair has to relocate from mid-fight to the opener while
the chain re-spaces). That is a *charge-relocation* move class, and no existing class expresses it —
`SHIFTS` moves one index or a suffix, and move class 3d closes cooldown chains but does not re-site a
Cold Snap.

---

## §9e — ⛔ THE SEARCH CLIMBS `robust` BUT THE RANKING IS `integral` (08-02)

> ⚖️ **RECLASSIFIED 08-04: a RECORDED CONTINGENCY, not queued work.** The retarget is
> "a phase of work, not a patch" (§9e-b — both half-measures measurably WORSE, 12/17 → 11/17), and
> the mismatch is fully masked today: anchors 17/17, `search-audit` 72/72 on the kit matrix, all
> three witnesses reached, and the §9o/§9k move classes reach what the mismatch once hid. The search
> is not required to be perfect (the user's own doctrine); the gates exist precisely to surface the
> day this mismatch costs a declared layout — THAT red, not this entry, is the trigger for the
> retarget, and §9e-b's measurements are the map whoever does it must start from.

**Found chasing a harness discrepancy that turned out to be a real defect.** A user layout at h=50 tied the
emitted plan (`102.875414` vs `102.876055`, Δ = **0.000641 casts**, inside the 0.002 band) and WINS the
tie-break — `snaps` 1 = 1, then `distinct` **4 < 5**, so `planBetter(user, model) = true`. The tool emits
the model plan anyway.

### The mechanism, and it is structural

* `polish()` and the inner hill-climb passes maximize **`simulate(...).robust`** (`index.html:2466`) — the
  per-cast board sum.
* Finalists are ranked by **`rankScore` = `simulate(...).integral`** (`:2469`, marked "THE RANKING
  QUANTITY") through `planBetter`/`rankPair`, in `phaseFinish`/`phaseRerank` only.

⇒ **the descent climbs one hill and the answer is graded on another.** Anything that is better on
`integral` but not on `robust` is invisible to every inner pass, and only survives if some *other* pass
happens to construct it. That is a whole class of search misses, not one cell.
⚠ It is NOT a scorer defect: `integral` is correct and gated (`law-check`, `objective-ref`,
`toll-audit`). The two quantities legitimately differ — §8h retired the per-cast sum as a RANKING
quantity precisely because it inverted "Berserking inside Bloodlust" against a closed form.

### ★ And it retro-explains §9d's failed fixes

§9d's seed variant and cull fix both measured **byte-identical** emissions, which was baffling at the
time. If the inner passes grade on `robust`, a seed that is better on `integral` is discarded by the very
first polish — so improving the seed pool cannot help until the objective the descent climbs is the one
the answer is graded on.

### The fix to evaluate (NOT yet attempted)

Make `polish` climb `rankScore`/`planBetter` instead of `robust`. ⚠ Two reasons to measure rather than
assume: (1) `robust` is cheaper, and `polish` is the hottest loop in the project — PHASE9 measured it —
so this is a real CPU question; (2) `planBetter` is a **banded, non-transitive** comparator and a naive
hill-climb on it needs the §8w high-water ratchet or it walks downhill. Gate on `anchors` 11/11 +
`plan-sweep`/`plan-diff` before believing it.

### Also settled here — the terminal recipe, which three probes got wrong tonight

The page's headline casts number is `simulate(s, cfg, true).integral / plainCastOf(cfg)`, scored on the
schedule itself. `tools/engine-node.mjs` **does** export `rankScore`, `plainCastOf`, `planShape`,
`planBetter`, `rankPair`, `TIE_CASTS`. The score-relevant cfg fields are exactly the engine's own memo
signature (`:905`): `T, hasteRating, sp, critPct, coldSnap, t5two, boundaryCharge, killMode, enabled,
fixed, segments` — and `cfgFor` silently drops `t5two` (−20% on everything) and `boundaryCharge`.
⛔ **Never rank a layout on `.robust` in a probe.** It produced a phantom 0.21-cast gap on the case above
and is the fifth time this confusion has cost this project real time.


---

## §9f — ⚠ RETRACTED 08-02: the `T=380 lust@60` "search miss" was PHANTOM

Reported twice on 08-01/02 as a confirmed search miss worth **+0.426 casts (213× the band)**, with a
constructive witness. **It is not a miss.** `tools/search-cross.mjs` scored candidates on
`simulate(...).robust`, and the ranking quantity is `.integral` (§9e). Re-measured correctly:

| | integral (RANKS) | robust (what was used) |
|---|---|---|
| witness `icyVeins[-19,1,181,361] scb[6,185,365]` | 287.719130 | 287.360378 |
| what the tool emits | **287.882025** | 286.934076 |
| Δ (witness − emitted) | **−0.162894** | +0.426302 |

**The sign flips.** The tool's own plan is better by 0.163 casts on the quantity that decides. The
instrument is fixed to read `.integral`; the finding is withdrawn.

⇒ **and the same error voids the rest of that run**, including the `T=390 lust@60` +0.0288 hit. Nothing
`search-cross` reported before 08-02 should be treated as a search defect until re-run.
★ The one claim that SURVIVES is the cross-kit bug it found in itself (a no-Lust host "beaten" by a
Lust donor's plan, +8.88 casts) — that was a structural fault, independent of which score was read.
⚠ Lesson, and it is the fifth time: an instrument that ranks on the wrong quantity does not fail loudly.
It produces plausible, well-formed, confidently-reported findings that are entirely fictional.

---

## §9e-b — ⛔ THE `robust`→`integral` RETARGET IS ALL-OR-NOTHING, AND BOTH HALF-MEASURES ARE WORSE (08-02)

§9e named the defect: `polish()` and the inner passes climb `simulate(...).robust` while the answer is
graded by `rankScore` = `.integral`. **Proven concretely on T12** (2:00, Lust 0:20, h=22), where the two
quantities point in OPPOSITE directions:

| `icyVeins` | integral (RANKS) | robust (what polish climbs) |
|---|---|---|
| `[10, 60]` — declared | **101.250528** | 100.981386 |
| `[15, 60]` — emitted | 100.823483 | **101.059677** |

So the descent reliably converges on the layout the objective ranks **0.427 casts lower**. That is the
mechanism, not a hypothesis.

### ⚠ But retargeting is NOT a one-line fix — both attempts measured WORSE

| attempt | anchors |
|---|---|
| baseline | **12 of 17** |
| `polish()` alone → `.integral` (7 climb sites) | **11 of 17** — T17 regressed |
| + `basinHop` and the challenge pass → `.integral` | **11 of 17** |

Reverted. The reason the half-measure hurts is instructive: with `polish` on `integral` and the later
passes still on `robust`, the finishing stack actively **pushes polish's answers back** to
`robust`-optimal ones. **A consistently-wrong objective beats a mixed one.**
⇒ the retarget has to cover every consumer at once, and `index.html:2477` records that `robust` "remains
the REPORTED score and every consumer still reads" it — including a quality-tolerance pass (`QTOL`,
`nulled`, overlap heuristics) whose thresholds are all calibrated in `robust` units. Those constants have
to be re-derived, not just re-pointed. **This is a phase of work, not a patch.**

★ It also explains §9d's two null results, which were baffling at the time: improving the seed pool
cannot help when the very first `polish` grades on the wrong quantity and discards the good seed.

⇒ **T12, T13 and T16 are red for this reason** — the scorer ranks the declared layout first at every
band (`haste-bands --assert` 7/7, mid-band margins 0.04–0.51 casts); only the descent disagrees.


---

## §9g — ✅ `wastedPre` VERIFIED ON THE CORPUS (08-02)

The `wastedPre` tie-break criterion (a prepull that funds no extra use is pointless — user ruling on the
h=900 emission) touches how every PLATEAU resolves, so it needed a corpus check, not just `anchors`.

```
plan-diff  compared=21  changed=1  scorerMoved=0  movedCells=1 → worse=0 better=0 tie=0 tieBreak=1
  · "P7 · 2:00 lust 0:20 · h=900" is INSIDE the tie band (Δ 0.000000, band ±4.150877),
    press moments 0 — the shape tie-break, not a score move.
```

**Exactly one cell moved, and it is the reported one.** `scorerMoved=0`, so no plan was re-priced;
`worse=0`, so nothing regressed. The re-solve confirms the emission is now `icyVeins[0] berserking[0]`
with the cluster at 0:20 — no prepull, and the pointless-prepull count is 0.
✅ `anchors` 12 of 17, unchanged: T8 (THE PREPULL CASE) keeps its `isc[-5, 115]`, whose prepull is what
makes the second Icon fit a 120 s cooldown inside a 135 s fight, so it scores 0 on the new criterion.
⇒ the criterion is doing precisely one thing and nothing else, which is what a tie-break change should
look like.

---

## §9h — ⛔⛔ THE SEARCH'S WRONG OBJECTIVE IS MASKING A SCORER DEFECT ON T8 (08-02)

A fully coordinated `robust → integral` retarget was built and measured (~66 sites, every hill-climb
class; reporting left on `robust`; a pair-climb variant with the §8w ratchet on top). **It scores 10 of
17 against a baseline of 12** and must not land. But the reason is the finding:

### ★ The integral RANKS A NON-DECLARED LAYOUT ABOVE T8, by 47× the tie band

```
T8 declared (ground truth)  isc[-5,115] scb[0,120] berserking[0]  icyVeins[95,115] arcanePower[120]
                              integral 108.732582   robust 108.770745
the challenger              isc[-5,115] scb[0,120] berserking[95] icyVeins[20,115] arcanePower[120]
                              integral 108.825901   robust 108.570177
    Δ integral = +0.093319 casts (47× the 0.002 band)      Δ robust = −0.200568
```

`tests/anchors.mjs` states the rule: *"if the scorer ranks something higher than them, the scorer is
failing."* By that rule **the integral is failing on T8** — and it has been all along. T8 is green today
**only because the descent climbs `robust`, which prefers the declared layout**, so the integral's argmax
is never proposed. ⇒ **one defect is masking another**, and fixing the search EXPOSES the scorer.
That is why every retarget attempt loses tests: it is not breaking things, it is revealing them.

### The other blockers, all measured

* **T12 is red at the SCORER level too**, independently of the search: the declared layout is beaten in
  its own ≤3-coordinate / ≤3-second neighbourhood by `zerk+3 & iv+3` at **+0.006120 casts (3× band)**.
* **T13 / T16 / T17 sit on integral-EXACT plateaus** (|Δ| ≤ 0.00065 casts) where the declared layout wins
  only on shape. The emitted members are **fixed points of every move class**, pair-climb included
  (verified by direct `polish(emission)` probes: zero movement). Escaping needs three press-rows —
  `isc`, the cluster, and `iv₂` — moved as ONE block, and no move class offers that.
* ⇒ **ceiling argument: under the current objective even a PERFECT search scores 12/17**, exactly
  baseline. The retarget cannot beat HEAD, so there is nothing to tune.

### ⛔ And the scale premise in §9e-b was WRONG — corrected here

I assumed `robust` and `integral` were different magnitudes needing re-derived thresholds. Measured
`integral/robust` on five plans: **0.9996 · 1.0027 · 0.9977 · 1.0027 · 1.0042** — within 0.43 %. Every
threshold is already cfg-derived and scale-free in casts (`QTOL` = 1.0 cast, `TIE_TOL` = 0.001,
`MARG` = 0.1) or a float-tie epsilon. **No constant needed rescaling.** What actually differs is
**plateau STRUCTURE**: the integral has exact plateaus where `robust` has gradients — so the robust
surface is *navigable* where the integral surface is flat, which is why a descent on it reaches members
the integral-descent cannot.

### The real work list, in order

1. **Fix the T8 integral mispricing** — the known/unknown-phase crossover at `index.html:2604-2630` is
   the flagged suspect. Nothing else can proceed past this: T8 is ground truth.
2. **Reconcile T12/T16** — the declared layouts lose in their own neighbourhoods, so either the scorer is
   wrong there too or those declarations need a user ruling.
3. **A coupled multi-row move class**, for the plateau members no single-row move can reach.
4. Only then retarget the search. ⚠ Corpus check on the best candidate: 4 of 21 plans moved, including
   T12 flagged **SEARCH REGRESSION** — `PLAN-DIFF FAIL`. Not landable in any form today.

---

## §9i — ⛔⛔ THE T8 MISPRICING IS REAL AND SIM-CONFIRMED; §9h's "robust is the refuted lattice error" was WRONG (08-02)

> ⚖️ **RECLASSIFIED 08-04: an ACCEPTED, DOCUMENTED LIMIT — not open work.** Every avenue this family
> (§9i → §9j → §9j-addendum → §9m) identified was tried and measured: the phase-averaged-walk
> architecture fails its own pre-registered gates on plain fights (0.15–0.56 casts of regression
> against a +0.13-cast signal), the value-landing term alone sign-flips out-of-sample, and the
> verdict written at §9m — *"the FULL §9j program or nothing"* — meets three standing facts: the
> scorer is CLOSED by user ruling (*"never come back to the scoring function"*), the sim that would
> gate a new attempt is retired (§8x), and the T8 anchor PASSES today (the search cannot reach the
> mispriced challenger, which is also why `distinct` stays in the comparator and the T8 lock
> revision stays unexecuted — §9l's two conditionals are hereby PERMANENT unless the user reopens
> the scorer). `t8-cell` line 1 stays pinned red as the documented blind spot, exactly as the
> §9j-addendum prescribed. This is the same category as the flush clamp and the AoE-weighting gap:
> known, bounded (~0.13 casts, one kill-flush geometry), written down, and deliberately not chased.

**The duel ran** — the retired sim tooling survives (`sim/sim.wasm` + `benchmark.mjs` protocol, extracted
read-only at rev `69f02dd`), and the T8 disagreement was simmed head-to-head, common random numbers,
derived one-sided kill window, both seed sets:

| run | Δ (declared − challenger) | seed band | σ |
|---|---|---|---|
| 5 seeds × 10k | **+4.21 DPS (+0.217 %)** | ±0.068 | **62σ** |
| 3 disjoint seeds × 20k | **+4.30 DPS (+0.222 %)** | ±0.022 | **200σ** |

+0.22 % of ≈90 effective casts ≈ **+0.20 casts — landing on the per-cast board's +0.2006 almost
exactly**, while the integral's −0.0933 (challenger preference) is **sign-wrong**. Every seed prefers
declared. (One common-mode transcription deviation, labeled: the chain cannot express the isc prepull,
so isc moved −5→0 in BOTH arms; the arms' tails are identical, cannot flip a 4-DPS sign.)

### ⛔ My §9h interpretation is retracted

§9h/§9i-draft framed robust's declared-preference as "the documented sim-refuted lattice failure" and the
integral's challenger-preference as "sim-anchored law composition." **The sim just refuted that framing at
62σ.** The law composition (+0.203 zerk-in-Lust − 0.105 forfeited overlap) is built from laws that are
each individually true and gated — but their COMPOSITION on this fight misses ~0.29 casts of real
structure. Laws verified in isolation do not compose freely across company this complex. That sentence is
the §9i lesson.

### But the sim's 62σ is also not the last word — the wall-phase audit

The duel's protocol pins the intermission at exactly 15.000 with a fully deterministic cast lattice
(no procs in kit ⇒ cast timing identical every iteration; σ is over damage rolls only). The model treats
walls as fuzzy **by user ruling** (*"an intermission does not land on the same second every pull"* —
RULES §9). The board reproduces the sim's account (Δ matches to 0.0006 casts at the pinned phase), so the
board was swept over wall phase δ ∈ [0, 1.45] with the challenger's exit-press riding the exit (the first
sweep parked IV at fixed 20 and measured its head falling into the dead zone — a confound worth
recording: it read as a perfect −0.1333·δ linear drift, the IV rate gain):

```
Δ(challenger − declared), robust, per wall phase:  min −0.29 · max +0.52 · SIGN FLIPS (19/30 declared)
phase MEAN:  −0.036 declared    ·    integral (phase-flat control): +0.093 challenger
per-move phase means:  IV 95→20 = −0.0548 (integral −0.0023) · zerk 0→95 = +0.0188 (integral +0.0956)
```

⇒ three findings, in order of importance:
1. **The mispricing is REAL, not a phase artifact**: even under the model's own fuzzy-wall semantics the
   phase-averaged truth prefers DECLARED, and the integral sits **~0.13 casts** off it on this one cell —
   65× the tie band. Both moves contribute (IV-in-Lust under-credited ~0.05; the zerk move over-credited
   ~0.08).
2. **The sim's 62σ overstates the margin**: one phase realization of a ±0.4-cast knife-edge. The honest
   sim-side margin is the phase mean, ≈ −0.04, not −0.20. A future re-duel should jitter the wall.
3. **The integral is exactly phase-flat** — as designed. The defect is not noise; it is a missing term.

### Where it does NOT reproduce

§8f measured the pure integral reproducing the named §5 values AND the declared Morogrim argmax on
**plain fights** — so the missing term involves T8's structure: an interior intermission, a kill-flush
Lust block, a capped (GCD-floor) window inside it, and value windows flush with the kill. Which of those
ingredients breaks the composition is exactly the isolation now running.

---

## §9j — ✅ ISOLATED (08-02): the integral's missing structure is LATTICE-LOCK, and it has NO smooth fix

Five ablations (plain control · +kill-flush · +intermission · capped-window · value-overlap), each
scored as Δ(phase-averaged board) vs Δ(integral) on the disputed T8 moves. Calibration reproduced §9i's
per-move numbers exactly, and the **plain control validates §8f** (gap −0.008 ≈ 0 — the integral is
right on plain fights, which is why this hid for weeks).

**The mechanism, one sentence:** the board's windows are *lattice-locked* — a press fires on a cast
boundary and haste snapshots at cast start — so every window realizes a WHOLE number of buffed
intervals and an INTEGER number of boosted completions, while the integral credits fractional `D/i`
from the press moment.

Three faces, on T8 all at once:
1. **The ceil-sawtooth on every haste window — EXACT closed form, confirmed:**
   `Δ = (ceil(D/i_in)·i_in − D) · (1/i_in − 1/i_out)`, periodic in window length with period `i_in`.
   It vanishes when `D` divides evenly (a 20 s window over 1.0 s capped casts: residue 0) — **which is
   exactly why 20 s windows hid the defect** and why the bare kill-flush IV probe measured 0.000.
2. **Kill-flush tail clip:** windows ending flush at T lose their press→fire snap outright, and the
   snap is smaller on a GCD-capped stream than a 1.154 stream. Expectation form predicts +0.044 where
   the realization is +0.110 — 2.5× — so **no phase-free closed form**.
3. **Integer value completions:** the board credits N∈ℤ extra boosted completions (measured: exactly
   1× premium for isc, exactly 0× for scb on the same fight); the integral credits the continuous
   (1+s) law.

**Non-additive:** a wall re-anchors the downstream lattice (deleting zerk@0 from the wall-swept fight
leaves the IV gap unchanged to 4 decimals — the wall wipes upstream phase). Back-prediction of both T8
per-move gaps from measured components: **+0.0525 and +0.0768, exact**.

### ⇒ The fix architecture (decided here, implementation next)

*"The sim-confirmed T8 verdict is reachable only by walking the lattice, not by adding a smooth term
to the integral."* So the ranking must EVALUATE by walking: **`rankScore` becomes the lattice walk
phase-averaged over the model's own declared uncertainties** (walls one-sided `U[W, W+1.498]`; the
kill's one-sided credit already averages the kill; exit-presses ride the exit, per `dodgeDowntime`'s
own semantics and the §9i confound lesson). The `integral` stays in the return — it is the law-check
quantity and the reported score, and on plain fights the two agree (ablation 1). MECHANICS §0's
canonical statement stands: the objective is unchanged; what changes is evaluating it at the fidelity
the sim just proved necessary. Gates for the implementation, pre-registered: `t8-cell` BOTH lines
green · `law-check` green (it reads `.integral`, untouched) · anchors lose NO currently-green test ·
cost measured and acceptable · `plan-diff` with every moved cell explained.

### §9j addendum — ⛔ THE ARCHITECTURE IS REFUTED (08-03). Measured, reverted, nothing landed.

`rankScore = phase-averaged lattice walk` was implemented faithfully (t8-cell's new line read
**+0.036010 — the §9i instrument's number exactly**) and failed its pre-registered gates:

* **Variant c (walls slide, exit-presses ride):** anchors **15 of 15 graded cases RED** against a
  baseline of 14 green — regressions of 0.15–0.56 casts (75–280× the band), 13 cells with the declared
  layout beaten in its own neighbourhood. The walk-mean has its own pathologies on plain fights,
  dwarfing the +0.13-cast T8 signal it was built to capture.
* **Variant d (rigid shift):** inverts the **sim-verified** §5 ladder step (in-cluster 0.951 >
  in-Lust 0.867) on T2 — already refuted by historical sim evidence. Cross-checked against the engine's
  own `phaseScore` at N=30 (agrees to 4 decimals): the measure itself, not the implementation.
* **The §9j premise "plain fights agree" does NOT generalize** beyond the calibrated T8 move pair.
* **The separable hybrid** (`integral + [mean_δ robust − robust@δ=0]`), which preserves every plain
  anchor by construction, gives the **wrong sign on T8** (−0.258): the T8 verdict lives in the walk's
  δ=0 baseline account, not in the wall-phase term. ⇒ **the pre-registered gates are mutually
  unsatisfiable for this whole change family, at any K.** Attempt preserved (report + diff path in the
  08-03 run log); nothing committed.

**Standing state:** the integral remains the ranking. `t8-cell` line 1 stays pinned red as the
documented, sim-settled blind spot. The walk cannot rank anything until its own plain-fight mispricing
(the §8h terminal-credit family) is solved — a model phase with its own sim gates, not a patch.
**Still actionable without touching the scorer:** T13/T16 are integral-exact plateaus lost to tie-break
REACHABILITY (a coupled multi-row move class); T12 is a basin miss whose declared layout is itself
+0.006-beaten (3× band) — a user ruling or a sim duel decides that one.

---

## §9k — ⛔ T16'S RESIDUAL IS THE COMPARATOR ROUNDING A REAL SLOPE (08-03) — pending a user decision

The band-structure re-anchor move class (landed with this entry) turned T13 green and transformed T16:
the emission improved +0.0352 casts to `iv[8,60]/zerk@28`, an in-band tie with the declared
`iv[10,60]/zerk@30` — and the agent PROVED no move class can close the rest:

* `planBetter` itself prefers 8/28: class 3c walks declared → 8/28 in steps of **−0.000724 casts each**
  — real, resolvable slope (the measurement floor is 0.0011... per *pair* of steps: the full walk loses
  0.00145, above the floor) — but each step is inside `TIE_CASTS = 0.002`, so the band calls it a tie
  and `sum` (earliest-first) accepts. The canonical plateau member under today's comparator IS 8/28.
* So T16 stays red regardless of search: `scorerBeats` flags the in-band beat at HEAD, emission or not.

**The user's principle, stated the same hour (verbatim):** *"only way it can lie is if you're rounding
something too strictly."* That is this defect exactly: the band rounds a measurable 0.0015-cast
difference to zero, then a tie-breaker buys earliness with it. Two exits, both user-level:
1. **Rule T16's declared to the canonical member** `iv[8,60]/zerk@28` (T6-precedent, in-band).
2. **Shrink `TIE_CASTS`** so the tie-break decides only genuine plateaus. ★ The 0.002 band was sized
   against a 0.0011 noise floor measured BEFORE §8l made the ranking pure window geometry — post-§8l,
   provably-equal layouts compare **bit-identical** (T9's tie: `a === b` exactly), so the floor may now
   be ~1e-12 and the band ~2000× too wide. Re-measure the floor, then shrink; §8w's ratchet and every
   in-band canonicalization (T1/T6/T9) must be re-verified under the new band. A comparator phase with
   its own gates — NOT a quick constant change.

---

## §9l — THE COMPARATOR REDESIGN, ASSEMBLED FROM USER RULINGS (08-03) — the next gated batch

### The 8/28 drift mechanism, answered exactly (user: *"understand why and make sure it's never harmful"*)
Class 3c slides the {IV, zerk} pair −1s at a time. Each step loses 0.000724 REAL casts — inside the
0.002 band ⇒ `planBetter` calls it a tie ⇒ `sum` (earliest) rewards the step ⇒ adopted. The walk rides
the sub-band slope until the §8w ratchet refuses cumulative loss > one band: 8/28 IS the ratchet
boundary, not a structure. Harm bounded (≤ 0.002 casts anywhere, by the ratchet) but the output is
off-grid junk. General law: **a banded comparator + a directional tie-break + iterative adoption =
drift down any sub-band real slope.** Any future tie-break criterion must be checked against this.

### Why magnitude cannot be the tie test
The ms-clock hair (iv@95-vs-@20 at the h=0 flip: quantized +0.0023, MUST tie — user ruling, the flip
identity `1.3+1.2−1 = 1.5` makes the ideal difference EXACTLY 0) is BIGGER than T16's real slope
(0.0007/step, must NOT tie). ⇒ **the tie detector must be the IDEAL (unquantized) law** — the exact
rate form `law-check --self-test` already carries. Real ideal-law difference → score decides, however
small (kills all drift fuel). Ideal difference ≡ 0 → true tie → the hierarchy. Quantized `.integral`
remains the reported score and the law-check quantity; only TIE DETECTION consults the ideal form.

### The full ordering (each clause a user ruling, cited)
1. real (ideal-law) score difference decides — *"the scorer has to be flawless… it's just math"*;
2. fewest Cold Snaps spent (T9);
3. no prepull that funds no extra use (P7);
4. on-grid beats off-grid — *"never ever is it 13,33"*, 8/28 same class;
5. **earliest-valid** — *"the earliest possible rule"*, where valid = the press does full work:
   value presses anchor no earlier than ramp end / next structural point (*"@5 the ramp isn't built…
   you'd be popping the first thing @7"*); pure-haste presses may ride a call through the ramp.
(`distinct` demoted below all of the above or removed — pending T6's A/B outcome.)

### Standing instructions captured
* **T8's lock: user-issued revision** (08-03, named the test): canonical member is the `iv[20,115]`
  form — lands WITH this batch, not before it.
* **T6: A (current @15 lock) or B (original @7)** — the user's ramp reasoning derives B; explicit
  A-or-B word still required by lock protocol before the file changes.
* T12 lock restored to 10/30 and IMMUTABLE; the scorer-prefers-15/35 question is a **sim duel**, and
  its evidence goes to the user alone.
* Gates for the batch: full anchors suite (work-until-green on every lock), law-check + self-test,
  self-consistency, haste-bands --assert, t8-cell, plan-sweep/plan-diff with every moved cell
  classified. The §9k band-shrink mission is DEAD (T6's true tie sits below any workable shrunken
  band; the ideal-law detector replaces it).

### §9l closure — T6 ANSWERED (08-03): the lock stands as-is (user pasted the exact plan)
T6 = the current file lock: Berserking@5 riding the call, cluster+IV@15, CS-IV@35. No edit.
★ THE RECONCILING HYPOTHESIS, the batch's FIRST measurement: §8y's brute force ranked this member #1
of 1,582,581 — so its +0.000231 over cluster@7 may be REAL ideal-law slope, not ms residue. If
Δideal(15 vs 7) > 0: the score itself decides T6 (no tie-break involved) and EVERY ruling becomes
consistent under one ordering — ideal-law decides above noise → snaps → wastedPre → grid →
earliest-valid — with `distinct`/fewest-moments needed NOWHERE. If Δideal = 0 exactly, earliest picks
@7 ≠ lock and the ordering needs a T6 carve-out: measure first, design second.

### §9l — ✅ LANDED as variant A′ (08-03), and the `distinct` criterion is DEPRECATED BY RULING

**Landed:** the ideal-law tie detector (float floor 2.6e-14, ten orders below the smallest real slope),
ordering ideal-score → snaps → wastedPre → grid → distinct → lex-earliest, ratchet on the ideal
quantity, plan-diff's grader now imports the engine comparator. **T16 green — the §9k drift is
structurally impossible** (each 8/28 step has real ideal loss 1.2e-3 → refused). anchors 16/17 cases,
T12 the only red (bit-unchanged, exempt pending its sim evidence); plan-sweep 21/21 byte-identical —
the quantized scorer is provably untouched. Wall 1.11×.

**The directed design (distinct removed, T8 revised) failed its gates for measured reasons:**
1. ⛔ **The T8 revision cannot land before the §9i scorer fix.** With iv@20 resolving the flip-tie,
   Bloodlust is vacated and Δideal(zerk@95 challenger − revised lock) = **+0.094 casts, a REAL
   ideal-law difference** — so "score decides" MUST emit the sim-refuted §9i layout. Under the current
   scorer, "the lock and the ruleset agree" is unsatisfiable. The revision stays queued behind the fix.
2. T10 and T13 went red under lex-earliest: their locks are the LATER members of exact ideal ties, so
   today their greens depend on `distinct`.

**User ruling (08-03, verbatim):** *"[clumping] is a bonus when it's a simple to follow plan, it
shouldn't need a rule on its own, as the 'earliest possible' tiebreaker should take care of the very
same thing."* ⇒ `distinct` is retained ONLY as a measured necessity for T10/T13's current exact ties,
and is marked DEPRECATED: the §9i landing-snapshot term is precisely about window-edge landings, so
once it lands, cluster-placement "ties" like T10's 7-vs-10 and T13's 0-vs-5 are expected to become REAL
score differences the fixed scorer resolves — at which point `distinct` must be re-tested for removal
(the user's ruling wins the moment the measurement allows it).

## §9m — ⛔ THE VALUE-LANDING TERM ALONE IS SIM-REFUTED OUT-OF-SAMPLE (08-03). It calibrates on its three cells and sign-flips on two new ones. Nothing landed; the patch is preserved.

> ⚖️ **08-04: subsumed by the §9i reclassification — the whole family is an accepted limit.** The
> "full §9j program or nothing" verdict stands, and "nothing" is what the standing rulings choose.

The §9i/§9j landing-snapshot term was implemented in full and run through the whole battery. The
working form, per qualifying self-pressed value window: **`corr = P · (N − paid)`** — `N` = whole
completions landing inside the window from a canonical walk anchored at the window's OWN press
(msq-quantised / `_ideal`-exact via the shared `intervalAt`, walking the board's realised ramp casts
where the stretch crosses a ramp; translation-invariant, so §8l's lone-slid-press flatness law
survives), `paid` = the continuous credit the integral already paid (∫dt/i piecewise, minus toll
share), `P` = the JOINT counterfactual premium of same-(anchor,fade) windows (AP+SCB share one
straddler; the additive T5 pool makes marginals non-additive). Back-edge-only was tried FIRST and
rejected by measurement: it manufactures false sub-band ideal slopes on co-pressed trains (a
+0.00116 hump on the T2 family when `repair` moves second uses 140→141 while the game pays the same
13 casts); the integer-N form makes those exact ties and keeps cluster-monotonicity and §8o's
linearity. Scope rulings honoured: fades at/past T keep the kill's one-sided credit; fades beyond
the first cut stay fuzzy-wall phase-averaged; anchors inside intermission/AoE skipped; dmg/sp only —
haste windows keep §8g's phase account.

**Calibration — all three cells behaved as specified:**
- T12 pair: Δ(15/35 − 10/30) = +0.0102 → **+0.325635** vs perturbation-averaged sim ≈ +0.255
  (ratio 1.27), and phase-immune across all six perturbations (+0.3126…+0.3282), mirroring the
  sim's 48–96σ immunity. The corrected account reproduces the sim log's isc-fade identity.
- T8: Δ(declared − challenger) = −0.0933 → **−0.0403**, toward the phase-averaged board's −0.036
  (not flipped: the residue is the §9j haste-window family — T8's value fades sit on the wall and
  at the kill).
- The board (`robust`) untouched; value-free configs bit-identical; self-consistency PASS.

**The refutation — two NEW out-of-sample wasm duels** (69f02dd protocol: CRN, spaced seeds, exact
T5-2pc stat cancellation, derived one-sided kill window, 20k iterations × 5 seeds):
1. **h=22, A-shape (iv[0,20]+CS, zerk@40) vs the T12 lock (15/35):** sim **LOCK +0.684 DPS
   (+0.030 %), 6.1σ, every seed**. HEAD model: LOCK +0.0547 ✓. Term model: **A +0.0031 — sign
   flipped against the sim.**
2. **T16's cell, D (10/30) vs C (5/25), h=33 sp=700:** sim **D +1.319 DPS (+0.074 %), 23.5σ** —
   ★ **the T16 lock is sim-CONFIRMED.** HEAD: D +0.0036 ✓. Term: **C +0.106 — sign flipped, ~0.18
   casts off.**

**Diagnosis.** The value-landing physics is real — the §9i T12 forensics stand untouched. But the
still-unmodelled §9j haste-window landing residues (face 1: haste start-snapshot; face 2:
kill-flush) are the SAME ORDER (~0.03–0.13 casts) as the real inter-shape margins, and on the locked
cells HEAD's two errors currently CANCEL. Landing the value half alone unbalances that cancellation:
strictly more physics, strictly worse rankings. A face-1 pilot overshoots the other way (+0.14 vs
sim +0.03) — each face needs its own isolating duels before any composite. Under the term the suite
confirms the diagnosis mechanically: T13 emits the B-shape (+0.0899 over its lock), T16 emits
cluster@45/iv[45,65] (+0.3313 over its lock — directly contradicted by duel 2), law-check 4 red,
haste-bands 8/15.

**Consequences that stand:**
1. **The T8 revision (iv[20,115]) stays blocked** — the zerk@95 challenger's ideal margin over the
   revised lock is +0.094 → **+0.0413** under the term: halved, still the wrong sign to land it.
2. **`distinct` is NOT removable yet** (the §9l re-test, performed): under the term T10's 7-vs-10
   tie resolves toward the lock (+0.130) but T13's 0-vs-5 resolves AGAINST it (−0.0899) — one
   resolution goes the wrong way and the resolver itself is refuted. Deprecated stays deprecated.
3. **The fix is the FULL §9j program or nothing:** value landings + face 1 + face 2, each isolated
   by its own sim cells before composition. Duels 1 and 2 above are the ready-made gates, alongside
   T12 and T8.

Artifacts (scratchpad, ⚠ ephemeral — the numbers above are the durable record): the full patch
against 13a794d, the duel driver, both sweeps, and the original T12 forensics.

## §9n — ✅ THE ASHTONGUE MODEL REBUILT AS THE EXACT RENEWAL LAW (08-03) — two defects closed, one channel opened

User request: *"make sure that crit chance enters the proc rate, that it's not just a flat line of
average value. Increased local haste also increases the chance of a proc, and that proc increases
haste further etc, so the math might be complicated, so do it properly."* The math turned out to have
an exact closed form — the renewal steady state — and BOTH shipped accounts disagreed with it.

**Defect 1 — the integrand had no feedback at all.** `rateAt`'s exponent was `dur/intDn`: attempts
counted on the DOWN lattice, so a live proc's faster casts never fed back into the refresh chance.
Exact law: `n = ceil(dur/a)` on the UP lattice, `P = 1−(1−q)^n`, `R = 1/(aP + b(1−P))` — the renewal
cycle IS the fixed point of the proc→haste→proc cascade. Size at buffed crit (50.765 %, h=0):
P 0.623 vs 0.690 true, R 0.70484 vs 0.70779 ⇒ **~1 effective cast per 6-minute ATI fight**, 500× the
tie band. (The old E[1/i] blend was also wrong-shaped: casts/cycle ÷ time/cycle gives the
cast-weighted 1/E[i], not E[1/i].)

**Defect 2 — the walk's trailing window was off by one cast and mean-field.** It evicted history by
cast START (`recentT[ri] <= t − dur`), dropping the completion whose proc still covers this cast
(worth ≈ (1−P)·q of uptime), and counted attempts on its own blended lattice (self-consistent
mean-field P ≈ 0.644 — closer than the integrand but still 4.6 pp short). Replaced by the
counterfactual-age product (age = k·a + deadTime < dur), which is the exact discrete law in steady
state AND in the engagement transient, and ages correctly across intermissions.

**Also closed here:** the §9b Ashtongue channel — `q` now reads the EFFECTIVE crit (the
Clearcasting→Arcane Potency mixture, `atiProcQ`), so the +3 pp that produced 3849 rank flips is in
the proc rate (and only there — the damage side still cancels and stays normalised away). ATI's
constants moved into `GAME.ATI` with a SOURCES row (they were uncited and invisible to
constants-cited — the §9b caveat). The engagement transient (every cold start begins proc-cold) is
new modeling, threaded through the integrand as a lattice-free age ODE and carried natively by the
walk; MC-priced at +0.130 casts against steady-state-everywhere, of which +0.100 is recovered.

**Verification** (all green, all in the tree): law-check ATI block — the steady law by length
differencing (cancels toll AND transient; tolerance 1e-6 against a 0.34-cast Potency-lift effect and
a 0.44-cast feedback effect over the window), exact values at crits 25/40/80, above-cap zero;
`tools/ati-mc.mjs` — the engine against a direct seeded simulation of the true process (steady to
2e-5 casts/s at four states; full fights incl. the REAL ramp lattice within 0.05–0.08 casts against
a 0.25 budget; `--self-test` seeds the retired down-lattice form and it is caught by 3 lines);
self-consistency's new ati-on corpus cells (0 mismatches, 0 structural); kit-sweep's new
`ati+icon+gem` kit. Full algebra and the priced non-goals (window-edge P-memory ±0.05–0.15,
continuous-transient residual 0.030, gap<5s linear remnant, q→1 first-cast loss): ESTABLISHED-FACTS
§12. ⚠ ati/drums stay OFF in every declared test and preset, and the whole change is gated behind
`enabled.ati` — plan-sweep A/B reads IDENTICAL on the preset corpus.

**What remains open on ATI:** no declared layout runs with the proc enabled — kit-sweep asserts
local optimality only. Deriving ati-on test cells for user ruling is the length-ladder workflow
(ROADMAP ▶▶ A), unchanged.

### §9n addendum — the renewal model arbitrated against wowsims (08-03, user-requested)

The user asked for the obvious test: *"seed some random fights with ashtongue talisman, predict their
rankings, and sim to verify."* Done, plus two sharper single-number tests. Full protocol, numbers and
harness traps: ESTABLISHED-FACTS §12.5. Headline:

- **Ranking: 28 of 29 resolvable pairs agree** (3 random fights × 5 random legal layouts, CRN duels).
- **Proc physics, parameter-free** (crit saturated ⇒ `q = 0.5` exactly): uptime 89.54 % sim vs
  90.97 % closed form; mean interval 1.403 s vs 1.3819 s. Residual ~1.5 %, fully attributable to the
  ramp + cold start the closed form excludes and §12.3 models.
- **The crit channel, confirmed twice over**: crit inferred from the proc uptime (39.60 %) matches
  crit solved from DPS ratios (39.34 %) to 0.26 pp. That is the user's actual question —
  *"make sure that crit chance enters the proc rate"* — answered by measurement, through the proc.
- **wowsims' own implementation matches `GAME.ATI` exactly** (`sim/mage/items.go:119-145`: 5 s, 145
  spell haste rating, ProcChance 0.5, crit outcome, no ICD).

⚠ **OPEN, and deliberately not smoothed over: the long-fight MAGNITUDE gap.** Order is right, size is
not — the sim/predicted DPS ratio is ~0.9 on short fights but 0.07–0.44 on several 5:30 pairs, i.e.
the model over-states some long-fight margins. Ruled out: dropped presses (the sim's `casts`/aura
uptimes confirm every scheduled press fires), Cold Snap transcription (with it stated, Icy Veins
reads exactly 40 s / 2 procs), mana (cast count is flat in `mp5`), and gear mismatch (the sim's gear
haste is ~0, measured from its cast count). Not yet ruled out: the press-snap seam (the sim's APL
cannot press mid-cast, and the model's ranking is press-time geometry), and the model's own
long-fight window accounting. ~~**This is a scorer-side question and it is the next thing to pull on
if ATI work resumes.**~~
⚖️ **RECLASSIFIED 08-04: an ACCEPTED LIMIT, on the leading hypothesis's own terms.** The paragraph
below already names the likely cause — the standing INFINITE-MANA user decision — and already states
the consequence: *"the honest fix is a documented limit, not a scorer term."* The discriminating
test (a sim cast-count comparison) needs the retired instrument (§8x), the scorer is closed by
ruling, and order — the thing the tool ranks plans by — is right at 28/29. So the gap is filed where
the infinite-mana decision's other costs live: the tool reports a MEAN under infinite mana, and
long-fight haste-window MARGINS (not orderings) are overstated by an amount nothing can now measure.
Reopen only alongside a user decision to revisit infinite mana itself.
✅ **And the user sealed exactly that, 08-04, reviewing this walkthrough:** *"the scoring the way we
have shouldn't care about mana so why is this an issue?"* — it isn't one, inside the model's own
terms. The gap was only ever a statement about sim-vs-model comparability, and the sim is deleted by
ruling. This entry is the record of having observed the infinite-mana limit quantitatively once, not
an invitation to fix it.

★ **AND IT IS NOT AN ASHTONGUE QUESTION — that is the most useful thing about it.** The gap is in
what a HASTE WINDOW is worth, and it splits by fight length, not by kit: ratios sit near 1.0 on the
1:20 cells and collapse on the 5:30 ones. The leading hypothesis is the **standing infinite-mana
decision** (CLAUDE.md, user ruling): the model buys `dur × Δrate` extra casts from a haste window
unconditionally, while a real 5:30 mage pays for those casts out of a finite pool and gives some
back later — which would look exactly like this, and would be a known accepted limitation surfacing
rather than a defect. ⚠ Not confirmed: `secondsOomAvg` reads 0 on these cells, but that metric only
counts time at literally zero mana and this session proved it does not detect a mage stalling to
afford its next cast (§12.5's second trap). **The discriminating measurement is a CAST COUNT, not a
DPS number**: press one haste window on a long fight, with and without, and ask whether the sim's
Arcane Blast count rises by the `dur × Δrate` the model charges for. If it does, the model's window
valuation is right and the DPS gap is elsewhere; if it does not, this is the mana seam and the
honest fix is a documented limit, not a scorer term. ⛔ That test needs the sim, which is deleted by
ruling — so it is a question to POSE before any future arbitration, not a reason to rebuild one.

⚠ An INDEPENDENT full-fight Monte Carlo (no shared code with the engine, real proc rolls) was run
alongside as a sim-free control: **53 of 54 pairs agree** on margins over 0.3 casts, and the
per-layout Ashtongue INCREMENT — the difference that cancels everything the two accounts share —
agrees to a few percent, with the largest deviations tracking the WINDOW-START CONVENTION rather than
the proc model (matching the MC's window starts to the scorer's press-time geometry moves the worst
cell from +0.33 casts to +0.06). The one MC disagreement is on the AoE cell and reproduces with the
proc DISABLED (scorer +0.673 casts vs MC +0.085), so it is the known continuous-vs-discrete AoE-wall
divergence, not an Ashtongue defect.

## §9o — ✅ CLOSED 08-04 — a shape-specific search miss at `h400 · 3:00 lust 0:20`, pre-existing (found 08-03 by the widened kit sweep)

> **✅ FIXED by `phaseRerank` move class 6, THE CHAIN-DRAGGED CLUSTER — a search fix, as the entry
> below demanded; `simulate()` untouched and `law-check` green throughout.** Decomposed by
> measurement before designing the move (the `icon+gem` cell; every number from `rankPair` on the
> cell's own cfg):
>
> | move | Δ casts | |
> |---|---|---|
> | `scb#0`+2 alone (chain pushes `scb#1` to 127, splitting it from AP) | −0.036 | ⛔ |
> | `{AP, scb#1}`+2 alone (the 125-cluster's placement is a flat plateau) | 0.000 | tie, refused |
> | whole 125-cluster +2 (isc#1 iv#1 AP scb#1) | 0.000 | tie, refused |
> | **all three together** — the audit's move | **+0.020** | ✓ |
>
> The three coordinates are coupled through TWO mechanisms at once: `scb[5,125]` is cooldown-FLUSH
> (gap = cd = 120 s), so buying scb#0 two more seconds under the pinned Bloodlust *forces* scb#1 out
> of the 125 value cluster through `repair`'s chain — and the §4 cross term makes relocating scb#1
> without Arcane Power a pure loss. Class 3d sees the chain but not the cluster partner; class 3
> sees the cluster but not the chain. Neither can compose the move, and every 1- and 2-coordinate
> component is downhill — the §8m/§8s signature one coupling deeper.
> ⇒ **Class 6**: slide each single press; where `repair`'s closure MOVES other presses, offer each
> co-pressed partner of a dragged press riding the same slide (each alone, then all together).
> Everything derived (the chain from `repair` itself, partners from the plan's own press seconds),
> deterministic, and **gated on `!moved` after class 5** — the 3d position lesson at full strength:
> every previously-reachable fixed point is reached and ranked first, so a cell where every
> chain-dragged candidate is refused is byte-identical by construction.
> ★ **Verified 08-04**: kit-sweep **68 of 72 cells byte-identical**, the four changed all improved —
> and the descent, offered the coupled move, walks BEYOND the audit's bounded recommendation into a
> better basin (the whole value cluster leaves 0:05 for 0:10, Arcane Power joins the OPENER, the
> 120 s chains re-site at 2:10): `icon+gem` **+0.0339** casts (audit saw +0.0201), `pi+icon+gem`
> **+0.0219** (+0.0130), `ati+icon+gem` **+0.0322** (+0.0191), plus `icon+mqg · h400 · 3:00`
> **+0.0138** — a cell the k=3 audit had called a local optimum, i.e. a real miss *invisible to the
> gate* that the move class caught anyway. `search-audit --k=3` now reads **72/72 local optima**
> (was 69/72), its `--self-test` catches 72/72 displacements, anchors **17/17**, preset plan-sweep
> `PLAN-DIFF IDENTICAL` (21/21), and the full scorer battery (law-check ± self-test,
> self-consistency, constants-cited ± self-test, toll-audit --strict, objective-ref, ati-mc ±
> self-test, cfg-contract --strict) is green — the scorer never moved, which is what "a search
> defect" was supposed to mean.

`kit-sweep` gained an `ati+icon+gem` kit (8 kits × 3 haste × 3 shapes = 72 cells) and `search-audit
--k=3` came back **69/72**. All three misses are the SAME 3-coordinate move on the SAME shape —
`arcanePower#0+2 & scb#0+2 & scb#1+2` at `h400 · 3:00 lust 0:20`, worth **+0.013…+0.020 casts**
(6–10× the tie band) — and one of them is the CONTROL kit `icon+gem`, which contains neither
Ashtongue nor Drums.

**Attributed by measurement, not by argument.** Both engines score the emitted plan and the improved
plan bit-identically (173.788238 → 173.808314, Δ +0.020077 under `d43054e` and under HEAD alike), and
a full base-engine kit sweep reads **68/72** — the same `icon+gem` and `pi+icon+gem` misses, plus a
tie-break miss HEAD does not have:

| engine | localOptima | SCORE misses | tieBreak misses |
|---|---|---|---|
| base (`d43054e`) | 68/72 | icon+gem h400·3:00 · pi+icon+gem h400·3:00 · ati+icon+gem h0·2:40 | 1 |
| HEAD (renewal ATI) | **69/72** | icon+gem h400·3:00 · pi+icon+gem h400·3:00 · ati+icon+gem **h400·3:00** | **0** |

⇒ the ATI kit's miss MOVED rather than appeared — off the old model's `h0 · 2:40 interm` cell and onto
the same `h400 · 3:00` shape every other kit misses, which is what a changed proc model should do to
an ATI-kit landscape. The renewal model is net **neutral-to-better** on this matrix.

★ **The finding is the SHAPE, not the kit.** Three unrelated kits fail identically at h=400 on the
3:00 Lust-0:20 fight, which says the defect is in the SEARCH's reachability on that geometry (above
the GCD cap, where §7's crossovers live), not in any cooldown's model. It is a **search** item —
`phaseRerank`'s move classes or the seed classes — and per the standing rule it must NOT be answered
in `simulate()`: the scorer ranks the better plan correctly, which is the only reason the miss is
visible at all (`law-check` green throughout).

### §9m addendum — ✅ THE EDGE-MEMORY ± ELIMINATED (08-04, user challenge)

Reviewing the decision walkthrough the user asked, of §12.4's priced ±0.05–0.15 edge-memory term:
*"can't you average out the values? why do you need +-?"* — and the honest answer was that the ± was
a CHOICE (the integrand snapping to the new steady average at a buff edge) dressed as a limitation.
The transition average has the same closed-form structure as everything else: the outgoing state's
attempts become a stratum that drains out of the trailing window as new attempts displace it,
`P_down(d) = P0·ρ^d` per advance segment, same Newton inversion, structural kinks crossed exactly.
Intermission gaps ride the same list as procless strata (making the old linear `(dur−gap)/a` remnant
exact too), and the walk's aging became per-cast-exact (`atiUpAcc` — each attempt ages by the
intervening casts' own up intervals). Plain-fight numbers are BIT-IDENTICAL (no edges ⇒ no strata ⇒
same algebra: all ATI law lines unchanged to the digit); windowed fights move ≤0.03 casts; ati-off
paths untouched (plan-diff IDENTICAL). New windowed `ati-mc` check (pinned Bloodlust — externals
share exact window geometry, no press-snap seam): engine−truth +0.102 → +0.079 at lust@30, the
removed part being both edge biases (which partially cancel in totals but NOT in plan differentials —
the ranking-relevant half). What remains in the budget: the +0.03 cold-start continuous smoothing
(§8l's lattice ban, accepted) and the pre-existing all-buffs straddle convention (PHASE8 §25, not an
ATI term).

## §9p — ⛔ PLATEAU CANONICALISATION: the search settles on the member it reached, not the canonical one (08-04, T7)

Found by `tools/lattice-brute.mjs` while reaffirming the declared corpus, and it is a NEW defect class
— not a scoring error and not a §8j-style unreachable-optimum, but a third thing: **on an exact
plateau the search has no gradient, so it keeps whichever member it happened to land on.**

T7 (1:15, Lust 0:05, intermission 0:50–0:55), all 12,976,848 legal grid layouts enumerated:

| layout | ideal casts | snaps | wastedPre | offGrid | invalid | distinct |
|---|---|---|---|---|---|---|
| what the search emits (= old T7) | 67.452203 | 1 | 0 | 0 | 0 | **4** |
| `iv[15,55] · cluster@15 · zerk@5` | 67.452203 | 1 | 0 | 0 | 0 | **3** |

Identical under the ideal law to every digit, so `planBetter` falls through to `distinct` and prefers
the second — Berserking rides the Bloodlust call instead of taking its own press. The user ruled the
revision in (*"I agree with the revision to T7"*); the test is now RED by design, exactly as T11 is.

★ **Why it is NOT the §8j family.** §8j/§9d misses are SCORE misses — a better layout the descent
cannot reach, worth 0.005–0.4 casts. Here the score gap is **exactly zero**: no hill-climb, at any
neighbourhood size or effort, can prefer the canonical member, because nothing in the objective's
first component distinguishes them. The move is 3 coordinates and 22 seconds (`zerk 27→5` together
with `cluster 7→15` and `iv#1 7→15`), so it is outside every bounded neighbourhood as well.

✅ **T7's revised layout re-certified 08-04 under the alias-fixed instrument** (below): brute force
over all 12,976,848 legal grid layouts returns *"THE CHECKED LAYOUT IS THE GLOBAL OPTIMUM of the
lattice"* for `iv[15,55] · cluster@15 · zerk@5`. The ruling rests on a clean measurement.

⚠⚠ **AND THE INSTRUMENT HAD TO BE FIXED FIRST — the near-miss is worth recording.** The same tool
briefly reported that `iv[15,30]` beat the declared T6 layout `iv[15,35]`. It did not: `simulate`
legalises internally, so a press scheduled before its cooldown is ready simply FIRES when it is, and
the two are the SAME PLAN scoring identically (100.785092). Only their press VECTORS differ, so the
earliest-press tie-break preferred the illegal spelling. ⇒ `lattice-brute` now refuses any candidate
`repair` rewrites (the `intact` discipline `tests/anchors.mjs`'s `scorerBeats` already used, for
exactly this reason — it drops ~25 % of polished candidates). **T6 needed no revision; T7's survived
the fix.** The lesson generalises: an instrument that proposes layouts must prove they are what they
claim to be before its verdict means anything.

⇒ **The fix is a CANONICALISATION pass, not a better search.** After the score is settled, propose
plateau-preserving restructurings and accept on `planBetter` alone: merge a press moment into another
(especially onto a pinned raid call), then re-slide the remaining cluster. The user's own statement of
what the tie-break is FOR is the specification: *"I expect there will be a lot of plateaus, especially
in short fights where you use everything once, that's why we implemented the earliest rule so we
always have THE correct answer."* A canonicaliser is what makes that true; today the rule only decides
between members the search happens to visit.
⚠ It must accept ONLY on a strict `planBetter` improvement with the ideal score tied — a pass that can
move the score is a scorer change wearing a finishing-pass costume, and this project has paid for that
shape twice (§8y part 1b, the `finishLine` floor).

## §9q — ✅ T8 WAS BEATEN BY 0.094 CASTS — RULED AND REVISED 08-05 (was: awaiting a user ruling)

Found by `tools/lattice-brute.mjs` during the corpus reaffirmation. Unlike §9p (T7), this is **outside
the tie band by 47×**, so the §8y revision precedent does NOT cover it: it is a claim that a declared
layout is beaten on damage, which only the user can rule on.

```
declared T8  iv[95,115] · isc[-5,115] · scb[0,120] · ap[120] · zerk[0]    ideal 108.733278
brute best   iv[20,115] · isc[-5,115] · scb[0,120] · ap[120] · zerk[100]  ideal 108.827502   +0.094224
```
Both repair-INTACT (legal, distinct plans), both `snaps 1 · wastedPre 0 · offGrid 0 · invalid 0`, so
every shape criterion ties and the gap is pure score. Verified independently of the sweep.

★ **T8's HEADLINE CLAIM IS UNTOUCHED AND CONFIRMED.** The test exists for the PREPULL (`isc[-5,115]`,
worth +0.323591 casts, 162× the band) and the brute-force winner **keeps that press exactly**. What
moves is the part the declaration never argued about: the first Icy Veins (0:95 → 0:20, i.e. off the
Bloodlust call and onto the intermission exit) and Berserking (0:00 → 1:40, i.e. into the Lust window
instead of the opener). Reading T8's own comment, attention was entirely on the Icon; IV and
Berserking were whatever the tool emitted at the time.

✅ **RULED 08-05 — T8 IS REVISED TO THE BRUTE-FORCE LAYOUT.** User confirmed it in the tool (Debug
export, locked & validated at their buffed gear: 107.466 → 107.568, +0.102 casts) and ruled it in.
The locked layout is `iv[20,115] · isc[-5,115] · scb[0,120] · ap[120] · zerk[95]`.
★ **The canonical Berserking second is 95, not the 100 this instrument reported.** The plateau is
{95, 100, 105} — exactly tied at both gear levels — and 95 wins on `distinct` (it shares the second
with the Bloodlust call: 6 press moments against 7), before the earliest rule is even reached. 95
never entered `lattice-brute`'s candidate pool, so the instrument named a non-canonical member of a
plateau it had correctly located: a COVERAGE gap (the pool is the top-N structures' polish bands),
not a comparator error. Fourth instrument defect this corpus has caught.
★★ **AND THE ICY VEINS HALF WAS ALWAYS GOVERNED BY THE EARLIEST RULE** — user, 08-05: *"the first IV
should have always been @20 as per the earliest rule and I have mentioned that previously, but I guess
it got lost along the way."* Measured: `iv#1 95→20` is **exactly 0.000000**, the ESTABLISHED-FACTS
pair `Icy Veins × Bloodlust = 0.000` at h=0. A 0.000000 tie means the tie-break governed from the
start, so the old layout was non-canonical on its own terms before any of this ran.

⇒ **This is the value of exhaustive enumeration stated as cleanly as it can be**: the corpus checked
what it was looking at, and the brute force checked what it was not. ⛔ The test is NOT edited. Until
the user rules, T8 stands as declared and this entry is the record of the discrepancy.
⚠ The search emits the declared layout, so this is ALSO a search miss of 0.094 casts (§8j family) —
whichever way the ruling goes, the search cannot currently reach the better layout.

## §9r — ✅ THE CORPUS REAFFIRMATION, COMPLETE (08-04/05) — 13 certified, 1 finding, 3 uncertifiable

User goal: *"use the new bruteforcing tool to reaffirm that all current tests are actually the global
optimums."* Every declared test was re-derived from scratch by exhaustive enumeration, `--check`ed
against its declared layout, and graded on the objective PAIR with the plateau reported.

| test | method | layouts | verdict |
|---|---|---|---|
| T1 · T6 · T12–T17 | full 5 s lattice | 217,676,160 each | ✅ **global optimum** (8 cells) |
| T4 | full 5 s lattice | 59,772,768 | ✅ global optimum |
| T7 | full 5 s lattice | 12,976,848 | ✅ global optimum **on the revised layout** (§9p) |
| T2 · T3 · T5 | 10 s lattice + ±5 s polish | 46 M – 159 M | ✅ global optimum |
| **T8** | 10 s lattice + ±5 s polish | 12 M | ✅ **revised 08-05 and now GREEN** — §9q ruled, §9s freed the search |
| T9 · T10 · T11 | `brute-cell` family scan | 72 k – 90 k | ⚖️ **not certifiable** — see below |

★ **T9/T10/T11 CANNOT BE CERTIFIED BY ANY INSTRUMENT THIS PROJECT HAS, and the reason is precise.**
Raw enumeration is ~10¹⁸ layouts (6:20–6:30 fights, 3–4 uses per track) — hopeless. `brute-cell`'s
anchor-and-chain scan is the fallback, and its own header states the limit: *"a layout whose tracks do
NOT chain at their own cooldowns … is outside the family and this will miss it."* All three declared
layouts are exactly that — their gem chains are DELAYED (`scb[5,185,365]`, 180 s apart on a 120 s
cooldown), which is why the family argmax comes in **1.03–1.69 casts BELOW** the declared layout:

```
T9   declared 279.874759   family argmax 278.668167   (declared better by 1.206592)
T10  declared 288.067837   family argmax 287.037259   (declared better by 1.030579)
T11  declared 297.075872   family argmax 295.388458   (declared better by 1.687415)
```
⇒ the honest statement is **not** "certified" and **not** "beaten": *the declared layout beats an
exhaustive scan of ~70–90 k anchor-and-chain layouts by more than a cast, and nothing that was
searched rivals it.* That is real positive evidence — a deliberately-delayed chain outperforming every
chain-at-own-cooldown layout is the finding T9/T10/T11 were declared to capture — but it is weaker
than the short cells' certificate, and it must not be quoted as one.

⚠ **Three instrument defects were found BY the corpus during this run**, each caught because a
declared test disagreed: the quantised-max selection (ideal score must rank, §9p), the truncated
candidate pool (the swept band must be pair-ranked too), and alias acceptance (candidates `repair`
rewrites are the same plan). The first two produced no false verdicts; the third produced one (a
phantom T6 revision) and was caught before it reached a ruling. ⇒ **the corpus tested the tester**,
which is the strongest argument yet for declared layouts being the project's most valuable asset.


## §9s — ✅ THE `distinct` TIE-BREAK ABOLISHED (08-05, user ruling) — and it FIXED §9q's search miss

User, restating a ruling the docs had recorded but the code had not applied: *"I also previously said
to abolish the fewest presses rule, that one is messy and aligning to earliest possible will also
naturally align presses."* §9l marked `distinct` DEPRECATED BY RULING on 08-03; `planBetter` was still
comparing it. Now removed.

★ **VERIFIED NON-DESTRUCTIVE BEFORE REMOVAL.** Every ruling ever decided on this criterion is
reproduced by the earliest-press vector alone:

| ruling | decided on `distinct` | earliest-vector picks |
|---|---|---|
| T6 revision (07-31) | 3 moments vs 4 | the revised layout ✓ |
| T7 revision (08-04, §9p) | 3 moments vs 4 | the revised layout ✓ |
| T8 canonical Berserking (08-05, §9q) | 6 moments vs 7 | `zerk[95]` ✓ |

⇒ the user's argument is the mechanism: **co-pressing is what MAKES a press vector early.** Sharing a
second with an existing press leaves the vector's earlier entries untouched; giving a track its own
later second pushes an entry back. So `distinct` was a lossy PROXY for "earliest" — and the lossiness
is the messy part, since it could prefer a LATE cluster over an EARLY split.

★★ **AND IT CLOSED §9q's SEARCH MISS AS A SIDE EFFECT.** T8 was revised to the brute-force layout and
was expected RED until the search learned a coupled 2-coordinate move it could not reach. With
`distinct` gone the search reaches it unaided: **anchors 16/17, T8 PASSING.** The criterion had been
actively steering the descent away from the better layout — the old T8 has 6 distinct moments against
the revised layout's 6, but intermediate states on the path have more, so `distinct` penalised every
route to it. ⛔ Do not reintroduce it; if a case ever seems to need it, the answer is a shape criterion
with its own argument, not this one back.

⚠ **T7 remains RED** (§9p) — its move is a genuine 3-coordinate relocation, not a tie-break artifact,
so it still needs the canonicalisation pass §9p specifies.

## §9t — ⛔ NO 2-TRINKET EQUIP CAP: the tool plans fights that cannot be played (08-05, user-found)

User, correcting a kit I had queued: *"SCB Ashtongue and Skull all occupy trinket slots and you can at
most have 2 equipped."* `TRINKETS = TRINKET_TIERS.flatMap(...)` = **`[mqg, isc, scb, skull, ati]`**, the
game gives you **two** slots, and **nothing in the tool enforces that.** `TRINKETS` is used only for UI
grouping and for `OFF_TRINKETS` (the 20 s shared on-use lockout, correctly `[skull, mqg, isc]` — `scb`
is gem-triggered and `ati` is passive, so neither takes the lockout, but both still take a SLOT).

⇒ a user can tick all five and the planner will happily produce a schedule, a cast count and an
expected-damage figure for a character that cannot exist. Same family as the `buildSegments`
overlap bug (ROADMAP): the UI accepts an impossible setup and the model answers it without complaint.

**What it voided here** — caught before any of it reached a ruling:
- `kit-sweep`'s `ati+icon+gem` (ati+isc+scb) and `icon+gem+skull` (isc+scb+skull) — both three
  trinkets. Now `ati+gem` and `gem+skull`, which are the two kits the user names as Phase-3 practical.
- Two derivation cells (`D6-ati+icon+gem`, `E5-ati+skull+scb`) — dropped.

⚠ **The fix is validation, not scoring**: the engine is right to model whatever kit it is handed (that
is what makes A/B kit comparison possible); it is the INPUT layer that should refuse a third trinket,
and `cfg`-building tools should assert it. ⛔ Do not enforce it inside `simulate` — a hard refusal
there would break `kit-sweep`'s legitimate use of odd kits for gradient probing.
