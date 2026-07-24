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
- **(B) Diagonal dominance (a hard invariant — the model test).** In every column, the native (diagonal)
  plan must sim ≥ every plan borrowed from another haste. This should be **provably always true, just like
  monotonicity** — the plan the tool builds FOR a haste is, by claim, the best plan AT that haste, so no
  borrowed plan can beat it. CLEAN = native wins every column; any DEFICIT is a **violation**. The bar is
  **zero deficits**, not "small enough" — deficits are not to be graded by fight length or magnitude and
  tolerated. (A residual measurement subtlety — fixed-length DPS quantization can make two plans clip
  different partial casts — is itself something the fix phase must design away, e.g. a length-independent
  metric or a by-construction guarantee, so the invariant can hold cleanly. That's how it's *achievable*.)

## The PASS criterion *(amended Phase 7, user-directed: the guarantee is BY CONSTRUCTION, not a tolerance)*
The model **passes** when, across all six trinket kits × the five fight-length classes × the boss shapes:
1. `monoDip = 0.00%` on **every** table (invariant A, no exceptions — kept forever: it is computed from
   the same matrix the campaign already sims, so the check is FREE, and it only speaks when something
   breaks), AND
2. **Invariant B in two enforced layers:**
   - **(B1) MODEL-level dominance, BY CONSTRUCTION — zero exceptions, deterministic.** The plan the tool
     emits at haste H must model-score ≥ every plan the tool emits at any other haste of the kit's set,
     re-scored at H (`tools/diagnose-deficit.mjs` / `tools/xval-model.mjs` verify this with NO sim). The
     mechanism is cross-haste candidate pooling in the search: the native search *considers* every
     neighbor champion, so a borrowed plan can at worst BE the native plan. A B1 violation is always a
     search bug.
   - **(B2) SIM-level: every borrowed-plan win is a MANDATORY investigation, never tolerated noise.**
     With B1 enforced, a sim-side violation can only be (a) a scorer mis-ranking — root-cause it with the
     minimal-pair method and fix the term (the Al'ar/Vashj digs are the template), or (b) measurement
     structure — which must be DEMONSTRATED (var-width sweep, jitter robustness) and then fixed in the
     harness (as var0.5 and wall-jitter-v2 were), not excused. The full deficit-column DISTRIBUTION
     (worst / mean / ≥0.1% / ≥0.3% buckets) is always published so nothing hides behind a label.
   KT counts with its AoE measured (genapl `_aoe`). There is no accepted tolerance band: the loop
   terminates by exhausting explanations, not by declaring a floor.

## How to run it
```
# fixed rig (rebuild per fresh session — PHASE6 §6): runner-ap180 + a gear export (user data, not in repo)
bash tools/xval-campaign.sh                    # 6 kits × 5 fight-length classes, 2-concurrent, ITER=6000
bash tools/xval-boss.sh                         # Vashj / Al'ar / KT × representative kits
node tools/xval-collect.mjs tools/xval-results  # → the CLEAN/DEFICIT ledger, with deficit-cell localization
```
Locked protocol (do NOT deviate — each cost a real bug once; PHASE6 §1, PHASE7 §5): **cold open
(`_prestack:0`, never prepull) · ∞ mana (`--mana 100000000`) · `var 0.5` — the MODEL-MATCHED kill window
(the scorer's `robust` is exactly expected damage under a uniform kill in T±0.5s; var10's ±10s hedging
premium and var0's whole-cast parity are both off-question — TOOLING) · wall-jitter on boss tables
(`WJITTER=2`: cells averaged over δ∈{−2..+2}s wall shifts with post-wall presses tracking — fixed-wall
cast parity is measurement structure no phase-averaged model can rank) · AoE phases VALUED (genapl
`_aoe` → Arcane Explosion + `--targets N`; the KT caveat is closed) · paired seed 11 (CRN) · the AP-180
patched runner · breakpoint-straddle haste sets (`tools/xval-haste-sets.json`)**. Raw matrices are
committed to `tools/xval-results/` (always the CURRENT round); when a new round supersedes them,
snapshot the old round into `tools/xval-results-archive/<phase>/` first (append-only, like
`docs/archive/`) — history stays first-class, never just git archaeology. The collector output is
the authoritative row-by-row ledger.

## Current status (2026-07-23, first full run — 36 tables) — NOT PASSING
Data-gathering complete: 30 fight-class tables (6 kits × 5 classes) + 6 boss tables (Vashj/Al'ar/KT ×
{mqg+skull, isc+scb}), all committed to `tools/xval-results/`. Invariants independently recomputed with
`tools/xval-verify.mjs`.
- **Invariant A: PASS** — `monoDip = 0.00%` on **all 36** tables (every row rechecked cell-by-cell; zero
  dips anywhere).
- **Invariant B: FAILS** — **35/36 tables carry ≥1 diagonal deficit** (167 borrowed-plan-wins columns
  total; worst non-KT 0.77%; KT 1.06%/2.68% with an AoE-not-simmed measurement caveat). Per the invariant
  above, every one is a violation; this status does **not** rank them or excuse any as quantization/small.
  The data (where each lands, length behaviour, mechanism spot-checks) is in `PHASE6.md §2.1/§4.5`,
  `tools/xval-collect.mjs`, and `tools/xval-verify.mjs` — recorded for the fix phase, not graded here.

**So: the model does not survive this test.** The fix phase (PHASE7) diagnoses the patterns and
eliminates ALL diagonal deficits so invariant B holds everywhere — including KT once genapl emits AE.

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
