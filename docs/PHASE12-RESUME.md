# PHASE 12 — RESUME HERE (handoff, updated 2026-07-27 evening)

**Read `docs/PHASE12.md` §0 (the charter), then §6.9 / §6.10 / §6.11 (what landed today).** This file
is the 60-second state and the exact next action. Delete it when the phase closes.

## 1. ⛔ THE FIRST THING TO KNOW: `exact-match` IS RED, ON PURPOSE

Plans moved by design — **41.1 % of pooled-argmax cells, 16 of 16 QUICK sweep cases** — and the
goldens were **deliberately not re-recorded**. §0.4 licenses re-recording only on a demonstration that
the exact scorer *ranks better*, and that demonstration has not been obtained (§4 below).

⛔ **Do NOT run `exact-match --update` to make it green.** That freezes an unproven objective into the
project's own definition of correct and destroys the record of what the retired scorer emitted.

## 2. What landed today, in order

| | what | evidence |
|---|---|---|
| **step 2** — press transcription | the sim now fires every press on the cast the model scored it on | 7.14 % → **0.00 %** transcription failures on real logs; engine block byte-identical, so no plan moved |
| **step 1** — the objective | rank on the per-cast sum, not the rate integral | `self-consistency` **0.00e+0** at 2755 scorings (control: the old engine still FAILS at 0.2114 %) |
| **bug 2** — buff windows | mid-cast presses were given short windows | `window-span` now matches wowsims at every offset (was 15 casts vs 16) |
| **bug 3** — snapshot rule | haste is fixed at cast START, value is read at cast COMPLETION; the walk used one rule for both | `credit-check` 4/4; the pre-fix engine pays 14 casts where the sim pays 13 |
| **the lattice** | 334 ms per stack **and** ms-rounding of every cast/GCD | drift 0.080 s → **0.005 s**; LATTICE press failures **8 → 0** |

Five separate commits, never combined, each with its own gate.

★ **Each fix uncovered the next.** Bug 1 was simply never checked — nobody had asked whether the
number that ranks is the number the docs define. Bug 2 was **inert** until bug 1 landed (the integral
never read the walk's windows). Bug 3 **cancelled against bug 2** on any mid-cast press, so model and
sim agreed exactly and the pair was invisible to any probe that did not deliberately choose a
boundary-aligned press. Assume the next fix uncovers the next one, and pick discriminating cases on
purpose rather than convenience.

## 3. ▶▶ THE NEXT ACTION — the cooldown chain (§6.14c, priced by §6.16)

★ **`tools/model-audit.mjs` is now the standing bar: the model must predict the combat log press by
press.** On a single-use fight it already does — `2:00 lust 0:05`, 94/94 casts, zero mismatches on cast
starts, cast times, spell power and damage multiplier, cast times exact to the millisecond.

⛔ **On multi-use fights it does not — 17 of 23.** Cast counts still match everywhere (314/314 on the
7:20), but `4:00 lust 0:05` is off by **exactly one Icon (155 SP) and exactly one Arcane Power (0.25)**
on the wrong casts, dragging 0.665 s of lattice with it. The fights that pass are exactly those with a
single use of each cooldown. Same cause as below.

✅ The cast lattice is CLOSED (§6.14): 334 ms per stack **and** millisecond rounding of every cast and
GCD. Bare-stream drift 0.080 s → **0.005 s**, and LATTICE-class press failures **8 → 0** of 196.

What did not move is `HELD` = 18, and it is a different mechanism — **the fourth appearance of
press-moment-vs-fire-moment**:

- the model chains a cooldown from `lastEff[key] = eff`, the **press moment**;
- wowsims starts it when the spell is actually **cast**, at the fire boundary `auraAt ≥ eff`.

So the model legalises a use at `eff + cd` that the sim still has on cooldown until `auraAt + cd`, and
`innerSpell.IsReady` defers it a whole cast. **The model can emit a plan the sim cannot execute.**

⇒ Fix `repair()`/`lastEff` to chain from the FIRE, not the press. It is a **legality** rule, so the
objective is untouched — but plans move, so it rides alone. Then re-run §4's demonstration.

## 4. The demonstration that is still owed (§0.4)

```
MOVERS_OUT=/tmp/movers.json node tools/blast-radius.mjs      # the disagreement work list
node tools/scorer-duel.mjs --movers /tmp/movers.json --n 24  # duel each in the sim, ~20 min
```

Current reading, on the fixed engine: **6 cast-sum / 8 integral / 10 ties**, mean +0.28 DPS.
**INCONCLUSIVE — not "the integral is better".** At n=24 neither resolves.

⚠ The first reading of this said **14–10** and was an instrument error: with common random numbers the
seed band collapses to ±0.00, so *"tie if |Δ| ≤ band"* declared a winner for `+0.00` against `−0.00`.
There is a `--floor` (0.25 DPS) now. **A tie rule needs a resolution floor, not just a noise band.**

## 5. ★ THE VERIFICATION LOOP IS NOW MOSTLY SIM-LESS — use it

With an exact objective, *"is the emitted plan the best plan at this haste?"* is arithmetic.
`tools/xval-model.mjs` re-optimizes at every haste and cross-scores every plan at every haste with **no
sim at all**; `tools/brute-grid.mjs` brute-forces regions the search never visits. Both were built as
*"the by-construction half"*, subordinate to the sim. **They are now the primary instrument**, and a
round that took days of sim time is minutes of arithmetic.

⚠ **A sim-less sweep tests the SEARCH, not the physics** — it confirms the model against itself, so it
cannot catch a wrong constant. That is still the sim's job: it is how the 334 ms mismatch was caught.

**Keep the sim** (the gear-agnostic one). Four jobs the model cannot do: anchor the physics; cover
blind spots the model does not represent at all (mana, AoE weighting); back the in-page button, which
is how a player checks the tool's claim against the real engine; and falsify the search where brute
force is not tractable. What is dead is the *geared corpus workflow* — already the 07-26 ruling that
round 1 was the last geared round.

## 6. ⛔ `docs/ACCEPTANCE.md` HAS NO CURRENT READING

Every verdict in it was gathered against all three defects above. **The tables are kept — they are the
append-only record and the evidence trail — but their verdicts are not the model's status.** "B2 fails,
142 borrowed-win columns, worst 0.380 %" measures a broken instrument, not the search. Re-gather
(mostly sim-less, §5) before quoting any of it.

## 6b. ⏸ PRESENTATION, AFTER THE MODEL — not a model task

The printed press second is wrong on **1.8 %** of presses (§6.13): pressing it fires the macro a cast
early. Always fixable (`floor(auraAt)`, and a correct whole second provably always exists). **User
ruling: the model and its activations come first; how findings are presented is a separate, later
pass.** Do not pick this up ahead of the model work in §3.

## 7. Loose ends, all resumable and none blocking

- **7 of 8 boss band columns ungraded** — `tools/xval-results/band-scope/` has the targets + resume
  command. ⚠ Void as a model verdict, for the same reason as §6.
- **`ripple-audit` fails its own P3/P5 self-checks** (archive/11 §8.30) — no ripple decomposition is
  quotable until repaired. Its `mono=0` stamp means FAILURE while the adjacent `vacuous=0` means success.
- **The unmerged UI branch** `origin/claude/webapp-optimization-brainstorm-unpipp` — merge order and
  the resolved TRINKETS-reorder analysis are in archive/11 §9.3.
- **PHASE11** (the platform phase: CI bring-up, the module split) is still demoted behind this.

## 8. Instruments built this phase (do not re-derive)

| tool | what it answers |
|---|---|
| `tools/self-consistency.mjs` | **the step-1 gate** — does the thing that RANKS equal the board the tool SHOWS? no sim |
| `tools/window-span.mjs` | **the bug-2 gate** — model buff-window span vs wowsims |
| `tools/snapshot-rule.mjs` | when a buff applies to a cast: haste at START, value at COMPLETION |
| `tools/credit-check.mjs` | **the bug-3 gate** — does the model pay exactly the casts the sim pays? |
| `tests/press-fire.mjs` | **the step-2 gate** — part A no-sim, part B skips loudly without `RUNNER` |
| `tools/press-exposure.mjs` | corpus press-transcription exposure, pure arithmetic |
| `tools/press-headtohead.mjs` | old vs new transcription on real logs; splits transcription / HELD / LATTICE |
| `tools/press-ns-probe.mjs` | kills the nanosecond theory for the press offset |
| `tools/press-threshold-probe.mjs` | bisects the real press-fire threshold (`B − 0.002`) |
| `tools/lattice-drift.mjs` | model-vs-sim cast-grid drift, by haste and fight length |
| `tools/blast-radius.mjs` | how many emitted plans a scorer change moves (`MOVERS_OUT=` for the work list) |
| `tools/scorer-duel.mjs` | **the §0.4 demonstration** — the two accounts' picks, duelled in the sim |
| `tools/model-audit.mjs` | ★ **the wide gate** — the whole per-cast account vs a real combat log |
| `tools/plan-rescore.mjs` | did the new plan actually BEAT the old one, judged by one engine? no sim |
| `tools/plan-shift.mjs` | how FAR plans moved — plateau hop vs real re-decision |
| `tools/display-second.mjs` | does pressing the printed second land the window the model scored? |

## 9. ⚠ TWO INSTRUMENTS LIED IN THE FLATTERING DIRECTION THIS SESSION

Both were caught only by reading their own output columns, and both would have shipped a wrong
conclusion:

- a failure classifier that asked whether the *model's fire time* was past the sim's boundary — true
  for any press near a boundary once the grids drift — reported the **retired transcription's own 14
  failures as unfixable**, i.e. it exonerated the bug it existed to catch;
- a tie rule with no resolution floor turned `+0.00` against `−0.00` into a verdict and moved a
  headline from 6–8 to **14–10**.

- **three tools loaded the ROUND BLOB as the engine**, so they measured the old code no matter what had
  just changed — `lattice-drift` printed a byte-identical `0.080 s` across two consecutive cast-timing
  fixes, which reads as "the fix did nothing". Keep `ROUND_INDEX` (the plan source) and `ENGINE` (the
  code under test, defaulting to the working tree) separate, always;
- **`credit-check` hardcoded press times** calibrated to the lattice of the day, so when the grid moved
  2 ms its two arms silently stopped being the same experiment. A gate must not carry its own copy of
  the geometry it is checking — derive it.

★ **Any instrument that can absolve, or fail to see, the defect it was built to catch is worse than no
instrument.**
Control a new one in the negative direction — seed the failure and check it fails — before believing a
green run. `tests/page-equiv.mjs` was controlled that way this session; so was `self-consistency`.
