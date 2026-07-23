# ACCEPTANCE — the standing test the model must pass to be called complete

**The planner is NOT complete until it survives this test fully.** This is not a Phase-6 artifact — it
is the **completion criterion**, re-run after every fix/upgrade phase. Phase 6 built and first ran it;
future phases fix what it exposes and re-run it. A documented deficit is a **debt to fix, not a state to
accept** (user-directed).

Read `docs/PHASE6.md` for the current run's detail, `docs/DIARY.md` for history, `docs/TOOLING.md` for
the sim methodology (esp. the ★★★ never-prepull rule and the ★ mana trap).

---

## What the test is — holdout haste-adaptation cross-validation
The planner claims to **re-optimize the layout as gear haste changes**. This test asks the real sim
(wowsims) whether that adaptation is *correct*, end-to-end, on random fights the tool has never seen.

For a fight (random by class, or a boss preset) and a trinket kit:
1. Optimize a plan at **each passive haste** in the kit's breakpoint-straddle set (§1 of PHASE6).
2. Sim **every plan at every haste** → an N×N DPS matrix. Rows = the haste a plan was optimized FOR;
   columns = the haste it's SIMMED at. The **diagonal** = each plan at its native haste.

## The two invariants it enforces
- **(A) Strict haste-monotonicity (a hard invariant / regression canary).** With ∞ mana, more haste ⇒
  more casts ⇒ more damage, for a FIXED plan — so every row must be **non-decreasing**. The harness
  reports `monoDip`; it MUST be ~0.00%. A nonzero value is a regression (a prepull crept back in, or a
  new harness bug) — stop and fix, do not gather. *Necessary but not sufficient for correctness: it
  proves haste isn't harmful, not that the absolute DPS is calibrated.*
- **(B) Diagonal dominance (the model test).** In every column, the native (diagonal) plan must sim ≥
  every plan borrowed from another haste. CLEAN = native wins every column. DEFICIT X% = a borrowed
  plan out-simmed native somewhere. **Weigh a deficit by fight length** (§3.0): short/medium sub-1% may
  be plan-to-plan boundary quantization (unconfirmed); a long/XL deficit, or one that persists/grows
  with length, is real model mis-adaptation.

## The PASS criterion
The model **passes** when, across all six trinket kits × the five fight-length classes × the boss
shapes:
1. `monoDip = 0.00%` on **every** table (invariant A, no exceptions), AND
2. Every diagonal DEFICIT is either **CLEAN** or **provably boundary-quantization only** — i.e. it
   vanishes/reverses as the fight lengthens (the quantization fingerprint) and does NOT persist or grow
   onto long/XL fights. Any length-persistent or length-robust diagonal deficit is a **model bug to fix**,
   not a pass.

## How to run it
```
# fixed rig (rebuild per fresh session — PHASE6 §6): runner-ap180 + a gear export (user data, not in repo)
bash tools/xval-campaign.sh                    # 6 kits × 5 fight-length classes, 2-concurrent, ITER=6000
bash tools/xval-boss.sh                         # Vashj / Al'ar / KT × representative kits
node tools/xval-collect.mjs tools/xval-results  # → the CLEAN/DEFICIT ledger, with deficit-cell localization
```
Locked protocol (do NOT deviate — each cost a real bug once; PHASE6 §1): **cold open (`_prestack:0`,
never prepull) · ∞ mana (`--mana 100000000`) · var10 · paired seed 11 (CRN) · the AP-180 patched
runner · breakpoint-straddle haste sets (`tools/xval-haste-sets.json`)**. Raw matrices are committed to
`tools/xval-results/`; the collector output is the authoritative row-by-row ledger.

## Current status (2026-07-23, first full run — 36 tables) — NOT PASSING
Data-gathering complete: 30 fight-class tables (6 kits × 5 classes) + 6 boss tables (Vashj/Al'ar/KT ×
{mqg+skull, isc+scb}), all committed to `tools/xval-results/`.
- **Invariant A: PASS** — `monoDip = 0.00%` on **all 36** tables (18 adversarially re-verified: zero
  row-dips anywhere; full-set re-run confirming the rest).
- **Invariant B: OPEN** — every **fight-class** deficit is sub-1% (worst 0.77%); Vashj/Al'ar boss sub-0.6%.
  But **not all are pure quantization:**
  - `mqg+skull` carries a low-haste deficit that *persists and grows* onto long/XL (0.38%/0.32%) — a
    real, tiny (~0.1–0.6% DPS) model slack. **This is the primary blocker.**
  - The SP-trinket-free kits (`scb+skull`, `scb+mqg`) add mid/HIGH-haste deficits (h210–290, ~0.1–0.3%)
    — the §4.2 region (no exhaustive ground truth above ~h150 there); triage pending.
  - `isc+scb`/`isc+mqg` low-haste deficits reverse/vanish with length ⇒ quantization, not model error.
  - Mechanism is heterogeneous (IV/Cold-Snap sequencing recurs most); the single-worst-cell summary hides
    secondary deficit columns, some length-robust (§7 collector upgrade).
- **KT boss is EXCLUDED** (1.06%/2.68%): its AoE window is simmed as downtime (genapl has no
  Arcane-Explosion), so the model optimized valuing AoE the sim can't reward — a **harness limitation**,
  not a haste-adaptation failure. Re-run KT after adding AE emission (§7).

**So: the model does not yet fully survive this test.** The fix phase owns the `mqg+skull` low-haste slack
+ the scb §4.2 items, then re-runs this in full (incl. KT once AE emission lands). See PHASE6 §4.1/§4.5.

## Known coverage gaps in the test itself (make the test stronger over time)
- **Single-worst-cell reporting hides structure.** `XVAL-DONE`/the collector surface one worst cell per
  table; the raw grids carry more borrowed-plan-wins columns (some on long/XL). A future harness pass
  should report the FULL set of deficit columns, not just the worst, and flag length-robust ones.
- **Wide plateaus make adaptation vacuously "clean."** Where the tool emits one byte-identical plan
  across most of a kit's haste band, the cross-val isn't really testing adaptation there — only the
  plateau vs. the differing endpoints. Note this when reading a CLEAN result.
- **KT AoE simmed as downtime** (genapl has no Arcane-Explosion emission) — KT numbers exclude AoE damage.
- **Ashtongue** (random on-crit proc) is out of the kits — needs a different, stochastic treatment (Phase 7).
- **No exhaustive ground truth above ~h150** for SP-trinket-free kits (the 5s grid can't express the
  off-grid optimum) — the tool is certified only ≥ the coarse grid there.
