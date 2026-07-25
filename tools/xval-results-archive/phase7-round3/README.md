> **ARCHIVE — Phase 7, acceptance ROUND 3** (snapshot taken 07-25, before round 4 replaced it).
> Round 3 is the state after §5.11 legibility canonicalization landed. Its successor lives in
> `tools/xval-results/`; the round-by-round narrative is in `docs/ACCEPTANCE.md` and `docs/PHASE7.md`.

# Phase-6 cross-validation raw matrices

Committed output of the holdout haste-adaptation cross-val (`tools/xval.mjs`, driven by
`tools/xval-campaign.sh`). The scratchpad these were produced in is ephemeral; **these files are the
durable record** the `docs/archive/07-phase6-xval-run.md` §2.1 ledger is assembled from.

## What's here
- `<kit>-<class>.txt` — one full run per (trinket kit × fight-length class). Each file contains:
  the fight header (seed, length, Lust time, trinkets, haste set), the per-haste optimized plan specs,
  the **N×N DPS matrix** (row = plan optimized @haste, col = simmed @haste; the diagonal is each plan
  at its native haste), and the trailing `XVAL-DONE … monoDip=… diag=CLEAN|DEFICIT diagWorst=…` line.
- `boss-<name>.txt` — the same run against a boss preset's real T/Lust/segments (`BOSS=…` mode).

## How to read one
- **monoDip** must be `0.00%` — the cold-open invariant (more haste never sims worse for a *fixed*
  plan). Any nonzero value is a regression (a prepull crept back in, or a new harness bug): stop and
  fix, don't trust the table. See PHASE6 §1(a)/§4.7.
- **diag** = `CLEAN` (the native/diagonal plan wins every column) or `DEFICIT X%` (a plan optimized
  for a *different* haste out-simmed the native somewhere, by X%). Weigh a deficit by **fight length**,
  not by monoDip: on a short/medium fight, plan-to-plan boundary quantization is worth up to ~0.5–1%,
  so a sub-1% deficit there is unconfirmed; long/XL deficits, or ones that grow with length, are real
  signal. See PHASE6 §3.0.

## Regenerate / roll up
```
bash tools/xval-campaign.sh                 # all 6 kits × 5 classes (writes to the scratchpad xvcamp dir)
node tools/xval-collect.mjs tools/xval-results   # → the §2.1 CLEAN/DEFICIT ledger markdown
```
Every sim here is **cold open (`_prestack:0`), infinite mana (`--mana 100000000`), var10, seed 11,
AP-180 patched runner** — the locked Phase-6 protocol (PHASE6 §1). Do not compare any prepulled sim to
the model.
