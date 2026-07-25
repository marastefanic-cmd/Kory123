# ACCEPTANCE — the standing test the model must pass to be called complete

**The planner is NOT complete until it survives this test fully.** This is not a Phase-6 artifact — it
is the **completion criterion**, re-run after every fix/upgrade phase. Phase 6 built and first ran it;
future phases fix what it exposes and re-run it. A documented deficit is a **debt to fix, not a state to
accept** (user-directed).

> **⚠ The current committed round is STALE (07-25).** `tools/xval-results/` was gathered before the harness
> gear correction (`tools/reference-gear.mjs`; PHASE8 §20), so its model side optimized against `sp: 1387`
> with no `t5two` — not the gear the sim runs. Measured as rank-neutral at this scale, so the verdicts are
> unlikely to move; still, **re-baseline before quoting the ledger as authoritative** (`bash tools/xval-rerun.sh`).

Read `docs/DIARY.md` for history and `docs/TOOLING.md` for the sim methodology (esp. the ★★★
never-prepull rule and the ★ mana trap). **Every harness cfg's gear comes from `tools/reference-gear.mjs`
— spread it, never re-type it** (TOOLING "THE REFERENCE GEAR"). The run that first built and executed this test is archived at
`docs/archive/07-phase6-xval-run.md` (cited across the docs as *PHASE6 §x*).

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
# fixed rig (rebuild per fresh session — TOOLING "Building the runner" + "RUNNER PROVENANCE"):
#   runner-ap180 + a gear export (user data, never committed)
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

### The instruments (all committed; the sim rig itself is scratchpad-ephemeral — TOOLING)
- **`tools/xval.mjs`** — the cross-val instrument. `node tools/xval.mjs <seed>`. Env: `KIT=a,b` (explicit
  kit; else seed-drawn) · `TCLASS=short|medium|medlong|long|xl` · `HASTES=…` · `BOSS="Lady Vashj"|…`
  (load a preset's real T/Lust/segments instead of a class-drawn fight) · `ITER` · `SCRATCH`. Forces cold
  open (`_prestack:0`) and ∞ mana. Prints the N×N matrix + an `XVAL-DONE … monoDip diag diagWorst` line.
- **`tools/xval-haste-sets.json`** — the committed per-kit breakpoint-straddle haste sets (source of
  truth for granularity; read by `xval-kit.sh`).
- **`tools/xval-kit.sh`** — one kit across all five fight-classes. `bash tools/xval-kit.sh mqg,skull`.
  Tees matrices to `$XVDIR/<kit>-<class>.txt`; seeds deterministically (`1000 + cksum(kit)%9000 + classIdx`).
- **`tools/xval-campaign.sh`** / **`tools/xval-boss.sh`** — all six kits (2-concurrent, `ITER=6000`;
  `KITS=…` overridable) / the boss-shape tables (Vashj + Al'ar + KT × representative kits, with
  `--targets N` on AoE phases).
- **★ The three wrappers above + `xval-rerun.sh` carried the false-pass class ONE LEVEL UP** (fixed
  07-25, each demonstrated on the pre-fix file rather than argued). None consulted the exit status of
  the `node xval.mjs` it launched, none consulted the `python3` haste-set lookup, and each printed its
  completion banner unconditionally — so HEAD's `xval-kit.sh bogus1` printed five `XVAL-FAIL` lines and
  then **`KIT-DONE bogus1`, exit 0**, and HEAD's campaign printed **`CAMPAIGN-DONE`, exit 0** over three
  children that had all exited 2. Now: every launch is graded on `rc` **and** its `XVAL-DONE` line;
  banners carry `clean=/deficit=/failed=` counts; a nonzero failure count prints
  `KIT-|BOSS-|CAMPAIGN-|RERUN-INCOMPLETE` and exits **2**. Three further defects closed in
  `xval-rerun.sh`: `wait $PIDS` returns only the **last** pid's status (a first-kit death was
  invisible — replicated: two children, first exits 2, `wait $PIDS` returns 0); the restart-skip probe
  checked only the two **endpoint** classes, so a kit whose middle classes failed was skipped forever;
  and `git push … || true` let a "durable checkpoint" silently never reach the remote (now retried with
  backoff, then loud). Exit-code contract throughout: `0` graded clean · `1` graded and failing ·
  `2` could not grade. **Exit 1 is unused by design** on this path — a `diag=DEFICIT` is an
  *observation*, not a failure; `xval.mjs` gathers data and does not grade the model.
  Both halves of the lesson were exercised: seven **negative** controls (missing/empty kit arg, unknown
  kit, empty haste set, nonexistent `RUNNER`, unset `EXPORT_BASE`, …) each required to exit **2**, and a
  **positive** control on healthy data — `KITS="scb,mqg"` × all five classes, `monoDip=0.00%
  diag=CLEAN diagWorst=0.00%` on every row, `KIT-DONE scb-mqg clean=5 deficit=0 failed=0` →
  `CAMPAIGN-DONE kits=1 failed=0`, exit **0**. A guard that only ever rejects is its own kind of
  broken instrument; this one still grades real data.
- **`tools/xval-collect.mjs`** — a results directory → the CLEAN/DEFICIT ledger markdown, every
  borrowed-win column + length-robust loci (`--json` exports the target list); asserts `monoDip ≈ 0`.
  **★ Zero tables is a hard error (exit 2), never a pass** — fixed 07-25 after a dry run on a scratch
  copy of 35 round-4 tables read **none** of them and printed `ZERO deficit columns — PASS ✓`. Two
  defects, both now closed: (1) the positional-arg filter (`i !== jsonIdx + 1`) silently dropped
  `argv[0]` whenever `--json` was absent, because `jsonIdx` was `-1` — so a supplied directory was
  discarded and the default used; (2) an empty (or wholly unparseable) read still reached the
  `totalCols === 0 ⇒ PASS` branch. **Lesson: an instrument that can report PASS on no data is not an
  instrument.** The bug never bit in practice only because the documented command above passes the
  directory that happens to equal the default.
- **`tools/xval-verify.mjs`** — the deterministic invariant **recompute** (restart-proof, unlike an LLM
  adversary): re-derives monoDip and diagonal dominance from every matrix and cross-checks each file's
  reported `diagWorst`. Run it before believing any ledger. **It now ends in a verdict with an exit
  code** — `0` PASSING · `1` graded and FAILING · `2` *could not grade* — so "run it first" is
  mechanical rather than a reading exercise. Hardened 07-25 alongside the collector, against the same
  failure shape: an empty directory used to print `= zero, invariant A holds` off an empty set, and a
  **crashed table** (a file with no matrix) was stepped over by a silent `continue` — i.e. an ungraded
  cell of the grid vanished while the verdict still claimed to cover it. Both are now exit-2 errors,
  the second listing the offending files.
- **`tools/genapl.mjs`** — model plan → wowsims APLRotation JSON (the bridge that makes a schedule
  simmable). **Never** set `_prestack>0` for a model comparison. Hardened 07-25 against its own
  false-pass shape: an **unknown spec key was dropped in total silence**, so `{"IcyVeins":[20]}` (or
  any typo) emitted a well-formed APL with that cooldown simply **absent**, the sim ran, printed a
  plausible DPS, and every comparison built on it was wrong with nothing saying so — now a hard error
  listing the known keys, matching the guard `genae.mjs` already had. Also: a missing/empty spec used
  to fall through to a silent **exit 0 having written nothing**, leaving a *stale* outfile for the
  runner to sim under the new experiment's name (now exit 2); non-numeric press times formatted
  straight through `${t}s` into the schedule (now rejected); and `_prestack>0` announces itself on
  stderr. Verified byte-identical to the pre-fix generator on 5 healthy specs covering every key.
- **`tools/explore.mjs`** — the P4.measure ramp-blindness gate. Its runner parse was the same
  unvalidated `parseFloat(field 5)` that was `xval.mjs`'s worst defect; here `NaN` fails every
  comparison and falls through to `‼ DISAGREE (real ranking flip)` — a false *alarm* rather than a
  false pass, but it corrupts the same gate. Now exit 2 with the offending line.
- **`tools/genconserve.mjs`** — the finite-mana **conserve** rotation generator (the gearing-EP
  baseline, `docs/EP.md`). Hardened 07-25 with three fixes, two of them `genapl.mjs`'s defects
  verbatim: a **missing or empty CLI spec** fell through to a silent **exit 0 having written
  nothing**, leaving a *stale* outfile the runner then simmed under the new experiment's name
  (demonstrated on the pre-fix file: `EXIT=0`, outfile still `{"STALE":"previous experiment"}`);
  non-finite press times formatted straight through `` `${t}s` `` into the schedule. The third runs
  the *other* way: `_noAutocast` was **read** by `build` but **absent from the known-key set**, so the
  unknown-key guard rejected the one flag `docs/TOOLING.md:75` documents (`unknown spec key(s)
  _noAutocast`) and emitted no APL at all. **A guard that over-rejects is the same defect class as one
  that under-rejects** — it just fails loudly, which is why it went unchased for so long. Verified
  **6/6 byte-identical** to the pre-fix generator on specs covering every key.
- **`tools/haste-ladder.mjs`** — the RULES §16 brute-grid ladder marched across gear haste, and the
  optimizer's continuous **certification** against it. It graded `best.val` — the score the tool
  *reports* — against the grid optimum, with a `0.15` pressability-slack band. That band is the same
  width as the worst `val`/emitted-plan drift that used to leak out of `optimizeAsync` (0.153 eff
  casts, PHASE7 §5.14), so a real miss could sit inside the slack while the reported number looked
  clean. It now grades `simulate(best.s, cfg).robust` — the plan actually emitted — matching the fix
  already made to `brute-grid --tool`, so the certification no longer *depends* on the engine
  re-scoring. Behaviour-neutral on the post-§5.14 engine, proven not asserted: **7/7 ladder cfgs
  (h=0…300), 0 with drift, worst `0.00e+0`**.
- **`tools/ladder-analyze.mjs`** — cross-pair band-table compression over the ladder dumps. Exited **1**
  when handed **no input files**, i.e. a caller whose glob expanded to nothing read "you gave me
  nothing" as a real negative verdict. Now exit **2**, per the shared contract (0 = graded clean · 1 =
  graded and failing · 2 = could not grade).

## Current status (2026-07-25, **round 4** — gathered on the shipped post-§5.11 engine) — NOT PASSING (B)
All 36 tables re-run on the current engine (cross-haste pooling ON, var0.5, per-wall jitter v2, KT AoE
valued), on the **same 36 seeds as round 3**. Current round in `tools/xval-results/`; earlier rounds
under `tools/xval-results-archive/` (`phase6/`, `phase7-round2/`, `phase7-round3/`). Invariants
recomputed with `tools/xval-verify.mjs` and cross-checked by `tools/xval-collect.mjs` — the two agree
on every headline number.
- **Invariant A: PASS** — `monoDip = 0.0000%` on all 36 tables (every row rechecked cell-by-cell).
- **Invariant B (model side, B1): HOLDS BY CONSTRUCTION** — pooling makes every emitted plan the argmax
  over the cross-haste champion set, so no borrowed plan can out-SCORE a native (verified per run).
- **Invariant B (sim side): FAILS** — **142** borrowed-win columns across 34/36 tables (bar = zero).
  Distribution: median 0.044%, mean 0.081%, worst **0.40%**; ≥0.3%: 9, ≥0.2%: 17, ≥0.1%: 34. CLEAN
  2/36 (`isc+scb medlong`, `isc+scb xl`). The ≥0.3% head is the **B2 scorer-gap family**
  (`docs/PHASE8.md`; worst case `isc+mqg medlong @sim70`, `plan@40` 2787.5 > native 2776.5). The
  sub-0.05% tail (half the columns) sits at the fixed-length measurement's quantization scale —
  eliminating it is a design task (length-independent metric or a sim-side by-construction guarantee),
  tracked, not excused.
- Movement Phase 6 → round 3 → round 4: worst 0.77% → 0.40% → **0.40%**; columns 167 → 145 → **142**;
  KT's 2.68% AoE artifact eliminated at round 3 (now 0.39%, ordinary); mean width 0.160% → 0.081% →
  0.081%.

**Round 4 closes the "engine drift" debt round 3 carried** — the record now matches the shipped engine.
It also settles what §5.11 was worth: 29/36 tables came back byte-identical, the 7 that moved changed
at `h0` only and mixed-signed, and the −3 columns are tie-resolution landing where it lands, **not the
deficit shrinking** (PHASE7 §5.13). Critically, the worst cell is in the byte-identical set — B2 is
empirically invariant to the tie-break, so PHASE8's charge is unchanged.

**Data was certified before being accepted as the record** (the harness audit of 07-25 found 36
false-pass defects across 14 tools, several of which could have silently corrupted a whole round):
6 distinct per-kit haste grids each correctly matched to its kit — none is the coarse
`[0,100,200,300,400]` default an empty `HASTES` would have substituted — all 345 plan rows carry
`_prestack:0` (cold open, no prepull), no `NaN`/`undefined`, all 36 carry `XVAL-DONE`.

**So: not passing yet.** Remaining owners: PHASE8 (the B2 family, highest-effort scorer work) and the
metric-design task for the quantization tail. Re-run this in full after each.
A performance phase is also open (`docs/PHASE9.md`); by construction it must leave every plan
byte-identical, so it cannot invalidate a round — but re-run the exact-match suite after each of its
steps, and if any plan ever *does* move, the round is void.

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
