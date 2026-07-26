# Cross-validation raw matrices — the CURRENT acceptance round

> ## 🔄 GEAR-B ROUND 1 IS GATHERING HERE (`docs/PHASE10.md` §8)
>
> On 2026-07-26 the reference character was re-exported and this directory was cleared
> (`docs/BENCH.md` §1), leaving the project with no acceptance measurement at all. The first gear-B
> round is now landing here. Everything up to and including round 7 — the entire gear-A corpus — is at
> [`../xval-results-archive/gearA-pre-20260726/`](../xval-results-archive/gearA-pre-20260726/); read
> that directory's README before quoting any figure from it.
>
> **The driver changed** — `tools/xval-bench.mjs` + `tools/xval-bench-campaign.sh`, running the
> committed `sim/sim.wasm`, with no `RUNNER`/`EXPORT_BASE` to resolve. `tools/xval.mjs` and its three
> shell wrappers are KEPT, not deleted: they are the only way to reproduce an archived gear-A round.
> The two drivers were run head to head on one cell and produce **byte-identical plans and a matrix
> agreeing in every cell to the printed decimal** (PHASE10 §8.9), across two JS hosts (chromium vs bare
> node) and two sim entry points (`RunRaidSimConcurrent` vs single-threaded `RunRaidSim`). So these
> tables are continuous in **method** with the archive and incomparable in **number**.
>
> ★ **Every table stamps its whole protocol** — `iter`, `simseed`, `mana`, `targets`, `char`, `wasm`
> and `tool` are on the `XVAL-DONE` line in addition to the fields gear-A carried. A gear-B table is
> identifiable by `char=bench-gearB`; **that stamp, not the directory name, is what tells the two
> baselines apart.**
>
> ★★ **AND IT IS NOW READ BY AN INSTRUMENT — run it first:** `node tools/xval-stamp-audit.mjs
> tools/xval-results` asserts one protocol across every table, the expected 36-cell set, each kit's
> committed haste grid, `_prestack:0` on every plan row, and no NUL/NaN. It refuses the archived
> gear-A round outright. Exit `0`/`1`/`2`; **a partial directory is exit 2**, so the "do not read a
> verdict off a partial directory" warning below is no longer purely a matter of your own judgement
> (PHASE10 §8.19).
>
> ⚠ **NUL bytes mean the table is CORRUPT — two processes wrote it.** `run_cell` opens with `>`, which
> truncates, so a second campaign pointed at this directory cuts a file the first has open and the gap
> fills with NULs. It happened once (07-26) and the corrupted table **still parsed** — header, ten plan
> lines, full matrix, valid `XVAL-DONE`. There is now a writer lock, and `xval-verify.mjs` /
> `xval-collect.mjs` refuse any file containing a NUL. Never grade around that error; re-gather the cell.
>
> ★ **Resuming is supported and safe:** `SKIP_EXISTING=1 bash tools/xval-bench-campaign.sh` skips cells
> that already carry `XVAL-DONE`, and `tools/xval-checkpoint.sh` commits and pushes completed tables
> while the campaign runs, so hours of compute survive a container reclaim.
>
> ★ **Do not read a verdict off a partial directory.** A round is 36 tables; fewer is not "most of the
> answer", it is no answer. `xval-collect.mjs` and `xval-verify.mjs` both exit 2 on missing or
> unparseable data, but neither can know that 20 tables is not all of them — that judgement is yours,
> and it is the failure this warning exists to prevent.
>
> ★ **Do not compare anything landing here to a gear-A number.** BENCH §1: any table mixing the two is
> void. B2's sim preference already moved ~0.39 pp *and changed sign* across the baselines (BENCH §3e),
> which is larger than most effects the corpus exists to resolve.
>
> **How the next round differs from every previous one** (`docs/PHASE10.md`):
> `tools/bench.mjs` + the committed `sim/sim.wasm` (no clone, no protoc, no `go build`, no
> `RUNNER`/`EXPORT_BASE` — a duel is ~10 s cold) · **`--var 0.5` settled by measurement**
> (`tools/var-decision.mjs`) rather than by convention · **difference-in-differences** against a
> never-press control (BENCH §2.1) · **the model cfg forced to the simmed character** (`…REF` spread
> from `tools/reference-gear.mjs`, making the PHASE8 §6/§7 defect structurally impossible) · and the
> same backbone the website's verification button runs, asserted identical by `tests/sim-request.mjs`.
>
> **Stamp every table** with `emit=`, `var=`, `iter=`, its seed list and the tool that produced it. A
> number without its protocol cannot be compared to anything later — the round-5/round-6 `emit=`
> confusion is the recorded case.

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
bash tools/xval-bench-campaign.sh                # ★ THE CURRENT DRIVER — 36 cells, no rig, into this dir
SKIP_EXISTING=1 bash tools/xval-bench-campaign.sh   #   resume after an interruption
node tools/xval-verify.mjs  tools/xval-results   # → the independent recompute + verdict (exit 0/1/2) — RUN FIRST
node tools/xval-collect.mjs tools/xval-results   # → the CLEAN/DEFICIT ledger markdown
node tools/xval-persist.mjs tools/xval-results   # → the length-persistence work list (the prioritizer)
node tools/xval-collect.mjs tools/xval-results --json /tmp/targets.json
node tools/xval-band.mjs /tmp/targets.json       # → PHASE10 §5's grading rule: is a deficit real at ≥3 seeds?
node tools/xval-round-diff.mjs <prev-round-dir> tools/xval-results   # → what changed vs the last round
```
⚠ **`xval-round-diff` against a gear-A round is VOID** (BENCH §1) — the two baselines are different
characters. It is for comparing gear-B rounds to each other.

*Superseded, kept for reproducing the archive:* `bash tools/xval-campaign.sh` / `tools/xval-boss.sh` /
`tools/xval-kit.sh`, which drive `tools/xval.mjs` and need `RUNNER` + `EXPORT_BASE`.
Run the verifier before believing the ledger — it is a second, independent implementation of both
invariants, and it exits **2 when it could not grade** (empty directory, or a crashed table with no
matrix) precisely so a missing round can never read as a pass. Both instruments carried that false-pass
bug until 07-25; see the DIARY corrections ledger.

Every sim here is **cold open (`_prestack:0`), infinite mana (`--mana 100000000`), `var 0.5`
(the model-matched kill window), wall-jitter v2 on boss tables (`WJITTER=2`), AoE phases valued,
paired seed 11 (CRN), the AP-180 patched runner**, on the breakpoint-straddle haste sets in
`tools/xval-haste-sets.json`. The full locked protocol lives in `docs/ACCEPTANCE.md` — deviating from
any line of it has cost a real bug at least once. **Never compare a prepulled sim to the model.**
