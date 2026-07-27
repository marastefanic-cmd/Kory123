> **ARCHIVE — Phase 7, acceptance ROUND 4** (snapshot taken 07-25, before the round-5 re-baseline
> replaced it). Round 4 is the last round gathered under the **OLD harness gear** — the model side
> planned for a mage without `t5two` and at `sp: 1387`, which is not the mage the sim runs. That is
> what round 5 corrects (`tools/reference-gear.mjs`, PHASE8 §20); the two rounds are therefore the
> before/after pair for that correction, and the point of keeping this one is to be able to diff them
> table-by-table. Its successor lives in `tools/xval-results/`; the round-by-round narrative is in
> `docs/ACCEPTANCE.md` and `docs/archive/08-phase7-xval-fixes.md`.

# Cross-validation raw matrices — the CURRENT acceptance round

> **⚠ STALE as of 07-25 — gathered under the OLD harness gear.** These tables were produced before
> `tools/reference-gear.mjs` landed, so the model side built its plans **without `t5two` and at `sp: 1387`**
> — a mage the sim does not run (PHASE8 §6/§7/§20). The *sim* columns used the real export and are fine;
> what is suspect is **which plan each row optimized to**. The pre-flight measurement says the correction is
> rank-neutral at this scale (same argmax at every haste; one 0.011-eff-AB reorder at h150), so these tables
> are unlikely to move materially — but they are **no longer authoritative**. Re-baseline with
> `bash tools/xval-rerun.sh` and snapshot these into `tools/xval-results-archive/` first, per the rule below.

Committed output of the holdout haste-adaptation cross-val (`tools/xval.mjs`, driven by
`tools/xval-campaign.sh` + `tools/xval-boss.sh`). The scratchpad they are produced in is ephemeral;
**these files are the durable record** the ledger is assembled from.

This directory always holds **one round — the current one**. When a new round supersedes it, snapshot
the old one into `tools/xval-results-archive/<phase>-round<N>/` *first* (append-only, like
`docs/archive/`), then refill. Keeping every round is not bookkeeping: comparing a round
**table-by-table against its predecessor** is what let Phase 7 §5.13 prove B2 unchanged by the §5.11
tie-break at zero measurement cost. Two rounds can agree on a headline while disagreeing about every
plan underneath, and only the archive can tell them apart.

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
