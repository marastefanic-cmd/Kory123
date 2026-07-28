# PLAN — replace the goldens with an anchored correctness suite

**In flight as of 2026-07-28. Delete this file when it lands, folding anything lasting into ROADMAP.**

User: *"I think it would be better if we got rid of all the 'goldens' and 'tests' and just established
them from the ground up on extremely concrete examples, and then reverse engineer the rest."*

## The diagnosis is right

`tests/golden.json` asserts **stability, not correctness**. It locks in whatever the optimizer said on
the day it was recorded. Three things this session demonstrated the cost of:

1. **It cannot judge a change.** The `structuralSnap` attempt read *19 passed, 6 failed* and every
   failure was a one-second press shift. The suite could not say whether that was an improvement or a
   regression — `tools/plan-diff.mjs` had to, by comparing **scores**, and it found the one cell that
   actually mattered.
2. **It defends the current objective.** If the objective is wrong — and `docs/MODEL-DEFECTS.md`'s
   ground-truth entry is live evidence that it may be — then the goldens encode wrong answers and make
   *fixing* them look like a regression. A test that resists correction is worse than no test.
3. **It says nothing about what a plan SHOULD look like.** All the knowledge for that now exists in
   `docs/ESTABLISHED-FACTS.md` and none of it is asserted anywhere.

## But two things must not be thrown out with it

**⚠ 1. Stability and correctness are different tests and the project needs both.** A correctness anchor
says "this layout is right". It does *not* notice that an unrelated edit quietly moved fourteen other
plans. That is a real failure mode and it is what the goldens were for.
⇒ The replacement for that job is **not** another golden file — it is `plan-sweep` + `plan-diff`, which
already exists, runs in ~33 s against exact-match's ~9 min, and reports **Δscore** rather than a text
diff. It is strictly the better stability instrument and it is already written.

**⚠⚠ 2. "Concrete examples where I know the answer" needs an ARBITER, and right now there isn't one.**
This is the load-bearing caution. As of today:

* the per-cast sum ranks the model's layouts first,
* the retired continuous integral ranks the user's layouts first,
* **the sim has not ruled on either.**

Baking the user's layouts in as ground truth *before* the sim rules would lock in unverified answers —
the same failure the goldens are being retired for, with a different author. And the user's intuition,
while very good, was measured wrong twice this session (Berserking onto the second cluster: −0.0995
casts; Arcane Power onto the second cluster: −1.1555).

⇒ **Anchors must be sim-certified, not just author-certified.** Where the sim and the author agree, the
anchor is solid. Where they disagree, that disagreement is the finding and the anchor waits.

## The order of work

1. **Settle the objective first** (`MODEL-DEFECTS.md`, the ground-truth entry). Score the corpus under
   both objectives, list every disagreement, and **sim-duel each one**. The sim does not care which
   objective proposed a plan, which is exactly why it can arbitrate. Until this runs, no anchor built on
   either objective is trustworthy.
2. **Then build the anchor suite.** Each anchor is a fight plus a layout plus *why*:
   * the setup (T, haste, SP, crit, kit, pins),
   * the asserted layout,
   * the **rule from `ESTABLISHED-FACTS.md` it demonstrates** — an anchor with no rule behind it is a
     golden wearing a better name,
   * its sim margin over the runner-up, with the seed band,
   * and a **negative control**: the plausible layout it must beat, so the anchor fails loudly if the
     engine ever prefers the wrong one.
3. **Assert the rules directly too**, not only through layouts. `tools/rules-audit.mjs` already checks
   the inclusion–exclusion expansion closes to `0.000e+0`; `tools/facts-ladder.mjs` already asserts
   interior flatness and the cap thresholds. Promote both to gates.
4. **Then retire `exact-match` + `golden.json`**, replaced by: anchors (correctness) + `plan-diff`
   (stability) + the rule gates (self-consistency).

## What is already built toward this

| piece | what it does | status |
|---|---|---|
| `docs/ESTABLISHED-FACTS.md` | the rules the anchors will cite | Parts I–III done |
| `tools/rules-audit.mjs` | scorer vs the rules; search vs coordinate descent | works, not a gate |
| `tools/facts-ladder.mjs` | flatness + threshold assertions | works, not a gate |
| `tools/jitter.mjs` | execution-robustness expectation | works |
| `tools/plan-diff.mjs` | Δscore stability signal, with a regression verdict | already a gate |
| `tests/layout-rules.mjs` | property test of the layout spec | exists |
| `tests/anchors.mjs` | the anchor suite | **started 07-28 — A1 in, RED** |

## Standing warnings

⚠ **Narrowed 07-28, after the user pushed back with *"or it's a blocker of legitimate progress"* — and
they are right.** The original wording here was "do not delete `golden.json` before the anchors exist
and pass", which is too strong: the sim has since ruled that the goldens encode at least one **inverted**
ranking, so protecting them protects a wrong answer. A test that locks in a sign error is not
protection.

The real requirement is narrower and much cheaper: **do not leave the STABILITY job uncovered.** That
job is "did an unrelated edit quietly move fourteen other plans", and `plan-sweep` + `plan-diff` already
does it better than `golden.json` ever did — it reports Δscore with a regression verdict instead of a
text diff, and runs in ~33 s against ~9 min. ⇒ Wire `plan-diff` into CI as the gate, and `golden.json`
can go the same day. That is a small piece of work, not a phase, and it is not a reason to wait for the
anchors.

⛔ Do not make an anchor out of a layout whose margin is inside `BENCH.tieBandPct` (0.05 %) unless the
tie itself is the assertion. Most of this session's disputed layouts are inside that band once execution
error is accounted for, which means the honest anchor is *"these two are equivalent"*, not *"this one
wins"*.

## Status 07-28 — what is and is not a blocker

**The two ground-truth examples are NOT yet "the only tests".** As of now:

| | state |
|---|---|
| `tests/anchors.mjs` | **exists, 1 anchor (A1), RED** — asserts Berserking inside Lust at h=0 |
| `golden.json` + `exact-match` | **still the gate**, still encoding the D1-afflicted plans |
| the second example (2:45 / 1387 SP) | **not yet an anchor** — its property has not been isolated to a
  single two-source-backed statement the way A1's was |
| D1 | **diagnosed, not fixed** |

**The one real blocker is D1**, and it is now well-posed rather than vague: the ranking resolves a
single lattice phase, so a 0.03 % phase spike at Berserking @57 beats a genuine +0.2056-cast interaction
at @40–@50. Averaging the ranking over ±1 s of press error flattens the spike (one sample wide) and
leaves the plateau (three samples wide) standing.

**`golden.json` is a procedural blocker, not a real one.** Fixing D1 will legitimately change many
plans, and `exact-match` will fail on all of them — but that is the file asserting stale answers, not a
regression. Wire `plan-diff` in as the gate (it reports Δscore with a regression verdict) and the
goldens can be retired the same day. Nothing needs to wait for the full anchor suite.

⇒ **Order from here:** fix D1 → A1 goes green → re-derive whatever `plan-diff` flags → retire
`golden.json`. Anchors accumulate after that, one per rule, as they are isolated.

---

# Should the model be rebuilt from scratch? — assessed 07-28

**No. The defect is one layer above the model, and a rewrite would reproduce it.**

## What is verified correct, and would survive a rewrite unchanged

| | evidence |
|---|---|
| `simulate()`'s objective | `self-consistency` **0.00e+0**, **0** structural violations |
| the cast lattice | matches wowsims to **±0.010 casts** at every Icy Veins placement on a bare fight |
| value windows / snapshot rules / boundary credit | `window-span`, `credit-check`, `snapshot-rule`, `wall-credit` all green |
| the facts corpus (Parts I–III) | engine-independent — measured behaviour, not model output |
| the instruments | `facts-ladder`, `facts-pair`, `jitter`, `rules-audit`, `plan-diff`, `bench` — all engine-independent |

A rewrite discards a scorer that has been verified **at the cast level** in order to fix a problem that
is not at the cast level.

## Where the defect actually is

`simulate()` returns a **correct number for one lattice phase**. D1 is that the optimizer treats that
number as the objective, when the thing worth maximising is a **neighbourhood** of it. That is a
statement about what gets *ranked*, not about what gets *computed* — so it is a change **around**
`simulate()`, not to it. Rebuilding from scratch reproduces the same architecture and meets the same
wall on day two, unless the rewrite changes the objective — which does not require a rewrite.

## The part that IS worth rebuilding

Not the scorer — the **finishing passes**. `finishLine` (two tolerance regimes) → `finishLineFloored`
(three arms) → `structuralSnap` (a 0.05 % band, edge-spans, press rows, a cast-count guard). They
interact in ways that bit twice in one day:

* a free tie-break move changed the incumbent, and the older band-spending clause then chose
  differently — a **0.0156-cast regression** from a change that could not lose a point on its own;
* the pass refuses cast-count changes by design, which made a correct rule-based tie-break **inert**.

★ **And most of them exist to paper over D1.** The 0.05 % band, the structural snapping, the legibility
tie-breaks — all are machinery for choosing between layouts whose score differences are phase noise. **A
neighbourhood objective removes that noise at the source, and most of this layer can then be deleted
rather than debugged.** That is the rebuild worth doing, and it is downstream of the objective decision,
not a substitute for it.

## The path, in order

1. **Settle the neighbourhood.** Two candidates (`MODEL-DEFECTS.md`): lattice-phase-local width vs
   execution-error width. ⚠ Decide it by **measurement across several ground-truth cases**, not by which
   one fixes A1 — one case cannot distinguish a correct objective from a tuned one.
2. **Re-rank on it.** In the search, where cast-count changes are legal. Not in a finishing pass — that
   host is eliminated by measurement.
3. **Let the passes fall out.** Re-run the anchors and `plan-diff`; delete whatever finishing machinery
   is no longer earning its place.
4. **Then the goldens.** `plan-diff` becomes the stability gate, `golden.json` retires, anchors
   accumulate one per rule.

⇒ Rebuilding now would mean re-deriving the verified half in order to reach the same open question. The
open question is cheap to answer and the answer is what tells you which half to rebuild.

---

# ✅ STEP 1 IS ANSWERED — 07-28. And the answer changes step 2's shape

Full evidence: `docs/MODEL-DEFECTS.md`, *"★★★★★★ THE MECHANISM"*. Instrument:
`node tools/phase-audit.mjs`. In one paragraph:

**The scorer is exact** — it reproduces wowsims' cast count to **0.002 casts** across nine layouts once
both engines are handed the same fight, and at that point it already picks Berserking *inside* Bloodlust.
The defect is that the fight it is handed is **over-specified**: "the shaman Lusts at 0:20" is an input
known to the second, and the ranking's answer changes **four times** as that call slides across one
1.5 s cast interval. The phase-mean gives **one** answer across the same interval.

**Neither candidate width from step 1 was right, and the reason is the randomiser, not the width.** Both
averaged over *press* offsets — moving presses against a fixed lattice. A player controls that. What
they do not control is where their cast stream sits against the raid's clock. Slide **that** and the
ground-truth tally goes 0/4 → 2/4 with every residual 5–10× smaller.

## Revised order from here

1. ~~Settle the neighbourhood~~ ✅ — one lattice period, phase of the lattice against the wall clock.
   No free parameter.
2. **Make it affordable — MEASURED 07-28, and the two obvious routes both have a problem.**
   * **low-N average.** Convergence measured on the Berserking sweep and the four pairs:

     | N | Berserking argmax | ground-truth pairs |
     |---|---|---|
     | 1 (today) | @57 outside ✗ | 0/4 |
     | 2 | @50 inside ✓ | 1/4 |
     | 3 | @50 inside ✓ | 1/4 |
     | 4 | @50 inside ✓ | 3/4 |
     | 6–8 | @45–50 inside ✓ | 1–2/4 |
     | 12–48 | @45 inside ✓ | **2/4, stable** |

     ⚠ **Low N is not "cheaper", it is NOISIER**, and the 3/4 at N=4 is that noise, not a better answer
     — it does not survive to N=8. The single-press verdict is robust from N=2, but the full-layout
     verdicts only settle at N≈12. ⇒ budget **12×**, not 2×.
   * **analytic.** ⛔ **Not the two-line correction it looks like.** Sketched and rejected 07-28: the
     per-edge overhang really is uniform, but the phase-mean slides *one* wall offset δ, so every
     segment's length moves together — the per-segment factorisation that would give a closed form
     does not hold, and a naive "+½ per segment" term rewards layouts for having *more* haste
     segments. It needs a real derivation, not an inline fix.

   ⇒ **The affordable shape is neither: keep the point score for SEARCH, phase-mean only to CHOOSE.**
   The search's job is to find basins, and its discrimination there is far coarser than 0.2 casts. The
   phase term only decides between finalists. So: run `optimizeCore` unchanged, then a bounded
   coordinate-descent polish under the phase-mean from its winner. Cost is `moves × N` **once**, not
   per search step.
   ⚠ Pre-register the acceptance test before writing it, or this becomes the fifth tuned term
   (PHASE12 §6.1–§6.3). The test should be: A1 green, A2/A3 green or tied, `plan-diff` shows no cell
   losing phase-mean score, and `phase-audit --mode anchor` reads STABLE.
3. **Re-rank on it after the search**, where cast-count changes are legal (`structuralSnap` is
   eliminated as a host — it refuses cast-count changes by design).
4. **Chase the residual.** A3 (−0.017 casts) and Ex2 (−0.089) still rank the optimizer's layout first
   under the phase-mean. Isolate those the way Berserking was isolated — single press at a time, model
   against sim, **with the Lust pin moved onto a cast boundary** so the sim is a legitimate arbiter
   (TOOLING, "it biases every duel on a Lusted fight").
5. Then the goldens, as above.

## The ranking candidates, scored (07-28) — `both` leads, and A2 is a modelling gap

Pre-registered on two criteria so neither alone can be gamed. Full tables: `MODEL-DEFECTS.md` §8d.

| ranking | one answer across a cast interval? | ground-truth pairs |
|---|---|---|
| point (ships today) | ✗ 4 answers | 0/4 |
| pin-mean (average the raid call over its second) | ✗ 2 answers | 3/4 or 2/4 |
| phase-mean (average the lattice against the wall) | ✓ 1 | 2/4 |
| **both** | **✓ 1** | 3/4 or 2/4 |

⛔ **The tally column cannot choose between them and must not be used to.** Switching the raid-call
window from `U[t, t+1)` to `U[t±½)` — a modelling choice with nothing to do with the phase question,
and both readings defensible — moves the tally by a whole case in both directions. The anchor-slide
column does **not** move: it is identical under either window. ⇒ **The lattice term is the established
fix; the raid-call window is a separate open question and four cases cannot settle it.**

⛔ And do not go hunting for the framing that scores 4/4. A2's residual has an identified cause that no
averaging framing addresses: a press whose purpose is to align with a raid call should **co-move with
the call**, and the plan specifies presses on a wall clock. Fixing that by tuning a co-move radius is
the fifth falsified term waiting to happen.

★ And the strongest single result argues for doing **less**, not more: with the Bloodlust pin on a cast
boundary, the **shipped point score already picks the user's layout on all four isolated presses, and
matches wowsims to ≤0.008 casts** (§8c). The ranking change is for robustness to an unspecifiable
input — it is not a correction of a wrong answer.

## ⚠ Two traps this created

* **Do not un-retire the rate integral.** The integral is the phase *expectation* and that is why it
  ranked the user's layouts first — but it also over-pays a partial cast at a window's back edge
  (PHASE8 §25.5) and cannot express the two snapshot rules. Phase-averaging the **exact sum** keeps
  what PHASE12 got right and drops only the phase degree of freedom. PHASE12 §6.10 stands.
* **Do not read a sim duel on a mid-cast Lust pin as an arbiter.** It is measuring a fight 0.415 s
  different from the planned one, worth 0.21 casts, applied to some arms and not others.
