# Cross-validation raw matrices — the CURRENT acceptance round

> **⏳ ROUND 6 IS BEING GATHERED (07-25) — this directory is INCOMPLETE until it holds 36 tables.**
> Until then, do **not** read a verdict off it: a partial directory is exactly the shape the collector
> and the verifier were hardened against (both exit 2 on no/unparseable data, but neither can know that
> 20 tables is "all of them"). Round 5 — the last round gathered under **`emit=intent`**, before the
> P7.14 AoE press-snap fix and before PHASE9's `groupSeeds` — is archived at
> `tools/xval-results-archive/phase7-round5/`.
>
> **Why round 6 exists — three changes at once, all of them landed after round 5 was gathered:**
> 1. **`EMIT=fire` (P7.15, PHASE7 §5.22)** — the sim is now fed the **fire times the tool prints**, not
>    the optimizer's raw press *intents*. Round 5's tables carry **no `emit=` stamp**, which is the rule
>    for classifying a stale table.
> 2. **The P7.14 AoE press-snap fix (PHASE7 §5.19)** — changes KT's plans (KT is the corpus's only `aoe`
>    preset), so the 3 surviving over-floor boss cells are expected to move.
> 3. **PHASE9's `groupSeeds` (§5.14)** — a new seed class. Bit-identical on the golden corpus, but the
>    corpus holds the PRNG seed fixed and is structurally blind to a robustness fix, so plans on *these*
>    fights may move.
>
> **⚠ Watch for the INVERTED artifact sign on the `emit` half** (ACCEPTANCE, P7.15): `intent` *inflated*
> two of the banked 60 plans by ~0.26% (an MQG press deferred past a wall gains time at the front, but
> its 300 s cooldown then pushes the second press past the fight end). An inflated plan sitting in a
> **borrowed** column manufactures a **phantom deficit** — so some round-5 deficits may **vanish** here
> rather than merely shift. Every `XVAL-DONE` must read `emit=fire` and **`artifact=0`**.

Committed output of the holdout haste-adaptation cross-val (`tools/xval.mjs`, driven by
`tools/xval-campaign.sh` + `tools/xval-boss.sh`). The scratchpad they are produced in is ephemeral;
**these files are the durable record** the ledger is assembled from.

This directory always holds **one round — the current one**. When a new round supersedes it, snapshot
the old one into `tools/xval-results-archive/<phase>-round<N>/` *first* (append-only, like
`docs/archive/`), then refill. Keeping every round is not bookkeeping: comparing a round
**table-by-table against its predecessor** is what let Phase 7 §5.13 prove B2 unchanged by the §5.11
tie-break at zero measurement cost. Two rounds can agree on a headline while disagreeing about every
plan underneath, and only the archive can tell them apart.

That comparison is now an instrument rather than a stack of hand-run `diff`s:

```
node tools/xval-round-diff.mjs tools/xval-results-archive/phase7-round4 tools/xval-results [--full]
```

Per table it prints how many `(haste → plan)` cells changed and which, both invariants side by side,
and — the useful column — the **eff level shift**, which separates the only two ways a round can
differ:

| signature | meaning | follow-up |
|---|---|---|
| plans move, **eff ≈ +0.000%** | a **tie-break** — the score is unchanged, the search just picked differently among equals | none; nothing it optimizes moved |
| plans move, **eff shifts in a consistent band** | a **repricing** — the scorer changed and the plan changes are downstream | every ranking gathered under the old scorer is stale |

Both are confirmed on real pairs: round3→round4 (§5.11 canonicalization) is 10/345 cells at ±0.001%,
independently reproducing §5.13's hand-derived conclusion; round4→round5 (the reference-gear
correction) is the other shape. It exits **2 when it could not compare** — zero overlapping tables, or
a table still being written — because "0 plans changed" is also what a misread directory prints.

**★ Read the trailing `EFF-AUDIT` line too — the per-table eff *range* hides the thing that matters**
(added 07-25, PHASE9 §5.15). A table printing `eff -0.035%..+0.000%` can be a pure tie-break, a pure
regression, or both at once in adjacent cells. The audit splits it:

```
EFF-AUDIT unchangedSpecs=82 scorerMoved=0 movedSpecs=18 → worse=3 better=0 tie=15
```

- `scorerMoved` counts cells whose spec is **byte-identical** but whose eff is not. It must be **0**;
  any other value means the rounds were gathered by different scorers and **no** eff delta is
  attributable to the search. This is a *proof*, not an assumption — it is what licenses everything else.
- With the scorer pinned, `worse` is a **search regression by definition and needs no sim**: the
  optimizer rejected a layout it had previously found and its own objective prefers. A pure-search
  change may move a plan only to an equal or better score.

It found three such cells on round5→round6 (the −8.5% CPU landing), which every existing gate had
missed because they gate on plan-*identity* and were only ever run on a corpus where plans didn't move.
**Since 07-25 this is a GRADE: `worse > 0` under a pinned scorer is exit 1** (the tool's contract is
now 0 = compared cleanly · 1 = search regression · 2 = could not compare). `--observe` restores the
observation-only exit for a round pair *known* to trade eff deliberately (an epsilon-bounded
legibility canonicalization like §5.11) — pass it because you can name the trade, not because the
exit is inconvenient. Either way, **do not read a final acceptance verdict off a round whose
EFF-AUDIT shows `worse > 0`;** attribute the regression first.

## What's here
- `<kit>-<class>.txt` — one full run per (trinket kit × fight-length class). Each file contains:
  the fight header (seed, length, Lust time, trinkets, haste set), the per-haste optimized plan specs,
  the **N×N DPS matrix** (row = plan optimized @haste, col = simmed @haste; the diagonal is each plan
  at its native haste), and the trailing `XVAL-DONE … monoDip=… diag=CLEAN|DEFICIT diagWorst=…` line.
- `boss-<name>-<kit>.txt` — the same run against a boss preset's real T/Lust/segments (`BOSS=…` mode),
  with AoE phases **valued** (genapl `_aoe` → Arcane Explosion + `--targets N`).

A complete round is **36 tables**: 6 kits × 5 fight-length classes, plus 6 boss tables.

## How to read one
- **monoDip** (invariant A) must be `0.0000%`. With ∞ mana, more haste ⇒ more casts ⇒ more damage for a
  *fixed* plan, so every row is non-decreasing by construction. Any nonzero value is a regression — a
  prepull crept back in, or a new harness bug: stop and fix, don't trust the table.
- **diag** (invariant B) = `CLEAN` (the native/diagonal plan wins every column) or `DEFICIT X%` (a plan
  optimized for a *different* haste out-simmed the native somewhere, by X%).

  **⚠ Do NOT weigh a deficit by fight length.** An earlier version of this file said a sub-1% deficit on
  a short/medium fight was "unconfirmed boundary quantization" and only long/XL deficits were real
  signal. That is **overturned** (ACCEPTANCE "The PASS criterion", user-directed; PHASE7 §5.9): the bar
  is **ZERO deficit columns**, and every borrowed-plan win is a mandatory investigation, not a number to
  be excused by the fight it appeared on. Fight length is still *published* — as the length-robust `★`
  tag in the ledger, a hint about where to look first — but it grades nothing.

## Regenerate / roll up
```
bash tools/xval-campaign.sh                      # 6 kits × 5 classes  (writes to the scratchpad xvcamp dir)
bash tools/xval-boss.sh                          # Vashj / Al'ar / KT × representative kits
node tools/xval-collect.mjs tools/xval-results   # → the CLEAN/DEFICIT ledger markdown
node tools/xval-verify.mjs tools/xval-results    # → the independent recompute + verdict (exit 0/1/2)
node tools/xval-round-diff.mjs <prev-round-dir> tools/xval-results   # → what changed vs the last round
```
Run the verifier before believing the ledger — it is a second, independent implementation of both
invariants, and it exits **2 when it could not grade** (empty directory, or a crashed table with no
matrix) precisely so a missing round can never read as a pass. Both instruments carried that false-pass
bug until 07-25; see the DIARY corrections ledger.

Every sim here is **cold open (`_prestack:0`), infinite mana (`--mana 100000000`), `var 0.5`
(the model-matched kill window), wall-jitter v2 on boss tables (`WJITTER=2`), AoE phases valued,
paired seed 11 (CRN), the AP-180 patched runner**, on the breakpoint-straddle haste sets in
`tools/xval-haste-sets.json`. The full locked protocol lives in `docs/ACCEPTANCE.md` — deviating from
any line of it has cost a real bug at least once. **Never compare a prepulled sim to the model.**
