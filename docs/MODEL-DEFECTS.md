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

**Status: OPEN. Mechanism not established. Two witnesses, one bug** — a third was withdrawn on 07-28
(see below), which is why the count in older commits reads three.

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

**Status: OPEN. The most important open item in this repo. Nothing has been changed on the strength of
it.**

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
