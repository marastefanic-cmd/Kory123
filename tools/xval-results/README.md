# Cross-validation raw matrices — the CURRENT acceptance round

> **⚠ RE-BASELINE IN FLIGHT (round 5, started 07-25).** Round 4 — the previous contents, now snapshotted
> into `tools/xval-results-archive/phase7-round4/` — was gathered under the **old harness gear**: the model
> side built its plans without `t5two` and at `sp: 1387`, a mage the sim does not run (PHASE8 §6/§7/§20).
> The *sim* columns used the real export and were fine; what was suspect is **which plan each row optimized
> to**. `tools/reference-gear.mjs` fixed that, and this directory is being refilled kit-by-kit on the
> corrected gear. **Until the trailing `RERUN-DONE failures=0` lands, this round is PARTIAL — a mix of
> round-4 and round-5 tables — and no acceptance verdict may be read off it.**
>
> **⚠ And the pre-flight under-predicted this.** PHASE8 §20.2's probe measured the correction as
> *rank-neutral* (same argmax at every haste on its fight; one 0.011-eff-AB reorder at h150), which was
> read as "the plans will not move". The round itself says otherwise: `xval-round-diff` on the first four
> completed tables reports **6 of 40 `(haste → plan)` cells changed**, on a −0.4…−1.1% eff level shift.
> The probe was one fight family at four hastes; the round is 36 fights at 7–10 hastes each, and
> rank-neutrality on one fight is simply not the same statement as rank-neutrality everywhere. Nothing
> about the *decision* changed — the correction is right either way, because a harness must describe the
> mage the sim runs — but the claim "the headline is not expected to move" is no longer supported and is
> withdrawn until this round finishes.

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
