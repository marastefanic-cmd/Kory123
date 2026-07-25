# ACCEPTANCE — the standing test the model must pass to be called complete

**The planner is NOT complete until it survives this test fully.** This is not a Phase-6 artifact — it
is the **completion criterion**, re-run after every fix/upgrade phase. Phase 6 built and first ran it;
future phases fix what it exposes and re-run it. A documented deficit is a **debt to fix, not a state to
accept** (user-directed).

> **The current committed round is round 5 (07-25), gathered on the CORRECTED harness gear**
> (`tools/reference-gear.mjs`, `t5two` + effective `sp: 1450`; PHASE8 §20). It supersedes round 4, which is
> archived at `tools/xval-results-archive/phase7-round4/`. The repricing moved **124 of 345 plan cells
> (35.9%)** and every `eff` by −0.4…−1.1% (KT −6.1…−6.8%) — and moved the verdict **not at all**
> (`deficitTables 34→34`, zero verdict flips, `monoDip` 0.00% in both). **So the B failure is not a
> reference-gear artifact** (PHASE7 §6).

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
  tolerated. **⚠ But read "What the B BANNER can and cannot tell you" below before using the per-table
  CLEAN/DEFICIT banner to steer work: the bar is right, the *banner* is an existence test over ~90
  near-ties and has almost no discriminating power. Prioritize with `tools/xval-persist.mjs`.** (A residual measurement subtlety — fixed-length DPS quantization can make two plans clip
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
     **⚠ And enforcing B1 by construction COSTS an instrument: it empties the SEARCH-MISS side of
     `diagnose-deficit.mjs`'s partition.** With pooling on (`xval.mjs:176-190`, default) `model(B,H) ≤
     model(N,H)` is forced, so the tool reports `SEARCH-MISS 0 · SEARCH-MISS(other) 0 · SCORER-GAP N` on
     *any* pooled round — round 5 gave `0 · 0 · 135` — which is B1 restated, not a finding about the
     search. The partition can only route work again on a `POOL=0` round. PHASE7 §5.16.
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
- **`tools/xval-persist.mjs`** — **the CONSISTENT-ALTERNATIVE test: the length-persistence half of
  invariant B, and the instrument that turns "34/36 tables FAIL" into a work list** (added 07-25; see
  "What the B BANNER can and cannot tell you"). Groups a kit's five fight-length tables and asks, per
  haste column, whether any **single** rival haste out-sims native at all-but-at-most-one length — the
  only shape a genuine haste-*adaptation* defect can take, since the defect would be a property of the
  `(kit, haste)` cell and fight length is not what causes it. **No magnitude threshold, no
  borrower-distance threshold, nothing tuned after seeing the data**; the one free choice, "loses at most
  one length", is what *persistent* means. It also prints the three distributions that justify reading
  the banner the way that section does (borrowed-win rate, the **native** margin distribution, borrower
  grid distance). Exit `0` no persistent alternative · `1` ≥1 · `2` could not grade — it *grades*, which
  is why it uses 1 where `xval.mjs`/`xval-round-diff.mjs` (which *gather*) never do. Controlled in both
  directions before being believed: empty dir → **2**, a matrix-less table → **2**, synthetic tables with
  a strictly dominant diagonal → **0** and zero hits, the same tables with one rival injected at
  `+0.045%` in every length → **1** naming exactly that column. **⚠ It is a PRIORITIZER, not a
  redefinition of the PASS criterion** — a column it clears still carries a borrowed win that must be
  explained before the model is complete.
- **`tools/diagnose-deficit.mjs`** — per borrowed-win column, re-score the borrowed and native plans with
  the **model** at the deficit's sim-haste and print the margin + the track-level diff. **⚠ Its
  SEARCH-MISS / SCORER-GAP partition is DEGENERATE on any pooled round** — B1-by-construction forces
  `model(B,H) ≤ model(N,H)`, so the verdict is `0 · 0 · N` whatever the search does (round 5: `0 · 0 ·
  135`). A ⚠ banner now leads the file; re-gather with `POOL=0` to make the partition mean something.
  What it still measures honestly, and what PHASE7 §5.16 used it for: the **model margin** (how close the
  objective thinks the two layouts are) and the **track diff** (what actually differs).
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

## Current status (2026-07-25, **round 5** — the corrected reference gear) — NOT PASSING (B)
All 36 tables re-gathered on the current engine (cross-haste pooling ON, var0.5, per-wall jitter v2, KT
AoE valued) **and the corrected harness gear** (`tools/reference-gear.mjs`: `t5two` + effective
`sp: 1450`), on the **same 36 seeds as rounds 3–4**. Current round in `tools/xval-results/`; earlier
rounds under `tools/xval-results-archive/` (`phase6/`, `phase7-round2/`, `phase7-round3/`,
`phase7-round4/`). Invariants recomputed with `tools/xval-verify.mjs` and cross-checked by
`tools/xval-collect.mjs` — the two agree on every headline number.
- **Invariant A: PASS** — `monoDip = 0.0000%` on all 36 tables (every row rechecked cell-by-cell).
- **Invariant B (model side, B1): HOLDS BY CONSTRUCTION** — pooling makes every emitted plan the argmax
  over the cross-haste champion set, so no borrowed plan can out-SCORE a native (verified per run).
- **Invariant B (sim side): FAILS on the bar** — **135** borrowed-win columns across 34/36 tables
  (bar = zero). Distribution: median 0.035%, mean 0.069%, worst **0.38%**
  (`boss-KT-isc-scb @sim95`, `plan@165` 2238.5 > native 2230.1); ≥0.3%: 3, ≥0.2%: 12, ≥0.1%: 30.
  CLEAN 2/36 (`isc+scb medlong`, `isc+scb xl` — the same two as round 4).
- **But of those 135, exactly TWO can be a structural adaptation defect** (`tools/xval-persist.mjs`;
  see "What the B BANNER can and cannot tell you"): `isc-mqg h40` (rival `plan@h70` wins **5/5**
  lengths) and `isc-skull h20` (rival `plan@h100`, **4/5**). Every other column's best rival is
  length-inconsistent — the signature of a local near-tie, not of a plan built for the wrong haste.
  **That two-column list is the Phase-7 work list; the 135 is the bar.**
- Movement Phase 6 → r3 → r4 → **r5**: worst 0.77% → 0.40% → 0.40% → **0.38%**; columns 167 → 145 →
  142 → **135**; mean width 0.160% → 0.081% → 0.081% → **0.069%**; KT's 2.68% AoE artifact eliminated
  at round 3 (now 0.38%, ordinary). **Do not read that drift as progress** — see below.

**★★★ THE 135 DECOMPOSES: 80% of it is BELOW the instrument's own resolution, and what is left splits
into FOUR families with different mechanisms (07-25, `tools/ripple-audit.mjs`).** Every round-5 column
was measured at `--var 0.5`, so the tail-lattice ripple floor `1 − W/c` (RULES §8) can be priced on each
one *arithmetically, with no sim run*: `ripplePct = 100·(1 − W/c)/Nt`, where `c` is the **kill-edge**
lattice period and `Nt = robust/dmg_tail` is the fight total in tail-cast equivalents (the tail cast is
unbuffed, so a raw cast count would overstate the floor). Reproduce with:
```
node tools/xval-collect.mjs tools/xval-results --json /tmp/targets.json
node tools/ripple-audit.mjs /tmp/targets.json
```
All five predictions were **pre-registered in the tool header before the first run** and all five pass —
including a vacuity guard that would have declared the bound uninformative, and an arithmetic self-check
(median floor must fall with fight length, since it is 1/N: **0.282 → 0.183 → 0.112 → 0.101 → 0.078%**
across short→xl, MONOTONE ✓).

| bucket | n | reading |
|---|---|---|
| **inside the floor** | **97 / 121** determinate (**80.2%**) | the deficit is smaller than the ripple the metric carries — **unmeasurable at this taper width**, not "correct" |
| **INDETERMINATE** | 14 | the kill-edge period is ambiguous (non-flat tail) and the verdict *flips* between the two defensible reads — claimed for neither side |
| **over the floor** | 24 | the only cells a real model defect can still live in |

Median deficit **0.035%** vs median floor **0.134%** — the typical column is **3.8× below** the ruler.
Spearman ρ(floor, deficit) = **+0.118**: the floor *bounds* the deficits but barely *predicts* which are
worst, so it is a **ceiling, not an explanation** — do not report it as one. The four over-floor families:

- **FLOOR-TAIL (9) — ~~★ THE SHARP TARGET~~ → ~~★ THE *LEAST* ANOMALOUS OF THE FOUR~~ → ⛔ NO FAMILY RANK
  IS SUPPORTABLE (07-25).** Worked in PHASE7 §5.16e–f; two pre-registered hypotheses falsified, then the
  ranking itself falsified. The ranking below is by **sim deficit**, which hides the model's own margin;
  re-ranked in the **joint** currency (`dModel + pct`) FLOOR-TAIL came last (1.30× ambient) — but `joint`
  adds an unbounded term to a ripple-bounded one, and in the corrected `unexplained = dModel +
  max(0, pct − ripplePct)` FLOOR-TAIL returns to **2nd (2.63× ambient)**. **Three currencies, three
  orderings, no family holding its rank**, and a seeded 20 000-resample bootstrap says the nominal worst
  family tops only **60.8 %** of resamples — the between-family differences (~0.1 pp) are the size of the
  instrument's own per-cell ceiling (corpus median 0.134 pp). ⇒ **there is no trustworthy family target list here;
  the "least anomalous" superlative is WITHDRAWN and only the measurement stands** (FLOOR-TAIL's ceiling is
  ~0.022 pp, **6× below `inside`'s 0.139**, so no ruler covers its gap). RULES §8 consequence 5. Also dead:
  `H_PLATEAU` (the model is *not* indifferent at the floor —
  median |model Δ| is **larger** there, 0.0543% vs 0.0325%) and the floor-slack/ramp-credit candidate
  (ρ(capFrac, deficit) = **−0.135**, wrong sign). RULES §8 consequence 4. The original reading follows,
  kept because its *measurements* stand and only its **priority** was wrong:
  The kill-edge period sits at
  or near the GCD floor, where the ripple is provably ~0 — **exactly 0.000% for three of them**
  (`c = 1.000`, the closed form's built-in zero: at `c = W` the taper smears the lattice perfectly). So
  these deficits have **no tail-lattice explanation at all**. Deficits 0.040–0.166%, and the family's
  shape is the **mirror image** of the ripple family: sim-haste median **240** (min 70) and T median
  **395** (min 218), versus **110 / 218** for the ripple-explained cells. **One mechanism cannot be
  behind both.** Cleanest single target in the ledger: `mqg+skull xl T=395 @265` — deficit **0.090%**,
  floor **exactly 0.000%**, and *no walls and no AoE* (not a boss row), so no other artifact channel is
  available either.
- **KT-AoE (6)** — Kael'thas at 420s, incl. the two worst cells overall (0.377%, 0.363%). Carries its own
  AoE + wall-parity channels (coverage gaps below); **not evidence about the scorer.** This family is
  what makes the bound non-vacuous: a 420s fight has ~4× the casts of a 99s one, so its floor is ~4×
  smaller and 6/8 KT columns clear it.
- **SATURATED (5)** — over by <0.03 pp, i.e. sitting *on* their own ceiling. ✅ **VINDICATED (07-25), after
  being wrongly flagged.** The `joint` currency ranked it second-worst (0.268 pp, 3.29× ambient) and I wrote
  that its "confirmatory" label needed re-deriving. That was an **artifact of the currency**: SATURATED is
  *defined* as the family whose `pct` is nearly fully covered by its own (large, 0.189 pp) ceiling, so adding
  the unbounded `dModel` to an uncorrected `pct` flatters its defect more than any other family's. In the
  corrected `unexplained` currency it is **0.037 pp = 0.92× ambient, mean bootstrap rank 4.03 of 5 — the
  *least* anomalous family in the corpus.** It does **not** need re-deriving; the original reading below is
  right. RULES §8 consequence 5. Original reading: this is
  **confirmatory, not
  a defect signal**: the amplitude is peak-to-peak and `diagWorst` is a `max` over ~10 rivals, which
  selects precisely for the worst tail phase. Note what it does to the cell `tools/lattice-ripple.mjs`
  independently diagnosed — `isc+skull short T=99 @40`, deficit **0.362%** against a floor of
  **0.360%**, saturating to **0.002 pp**. The closed form was derived without being fitted to that
  number, so this is an out-of-sample hit on the mechanism.
- **RESIDUAL (4)** — genuinely over with a slow tail (part ripple, part something else); needs
  decomposition before it means anything.

⚠ **What "inside the floor" does and does not license.** It means the cell **cannot be resolved by this
instrument at this taper width** — an unmeasurable deficit and no deficit are the *same reading*. It is
not a proof the model is right there, and it is **not** a licence to discretize the scorer
(`lattice-ripple.mjs` §3: the discrete sum is a *worse* predictor across a full column, r 0.7910 vs
0.9337). The actionable output is the over-floor list — ~~and within it FLOOR-TAIL first~~ ~~ordered by the
JOINT gap: KT-AoE / SATURATED / RESIDUAL first, FLOOR-TAIL last~~ **and NOTHING within it: the 24 over-floor
cells cannot be ordered by family at all** (07-25, above — three currencies gave three orderings and the
bootstrap tops the nominal worst family at only 60.8 %). ⇒ **the unit of remaining work is a CELL with a
fresh sim duel, not a family**, or more columns for power. Do not invent a fourth currency.

**★★★ THAT CELL DUEL HAS NOW BEEN RUN, AND IT RE-PRICES THE OVER-FLOOR LIST: 24 → 18 CELLS (07-25,
`tools/cell-band.mjs`, PHASE7 §5.17).** The ripple floor prices **one** wall — the tail. A **boss** column has
**seven** (KT: 15,42,69,94,105,160,306), six of them interior and unpriced, and a boss cell is a *5-variant
wall-jitter mean* while a class cell is a single un-jittered run. So **the corpus is two instruments with
different noise**, and grading boss cells against a tail-only floor was grading them against a ruler
`tools/ripple-audit.mjs`'s own header already called a **lower bound** for them. Measured at the top boss
cell: seed sd **0.0058 pp** (negligible — the single-seed design is vindicated for count-preserving cells)
vs wall-jitter variant sd **0.1427 pp** over 33 geometries ⇒ SEM(N=5) ±0.0638, **95 % band ±0.1251**, i.e.
**12× the seed band** and about the size of boss cells' median ripple ceiling (0.1024). Applying it:

| boss over-floor cell | `pct` | tail ceiling | excess | > ±0.1251? |
|---|---|---|---|---|
| `isc+scb` KT T=420 @195 | 0.3630 | 0.0865 | 0.2765 | **SURVIVES** |
| `isc+scb` KT T=420 @95 | 0.3770 | 0.1073 | 0.2697 | **SURVIVES** |
| `isc+scb` KT T=420 @245 | 0.2100 | 0.0772 | 0.1328 | **SURVIVES** |
| `isc+scb` KT @215 | — | — | 0.0953 | inside |
| `mqg+skull` KT @100 | — | — | 0.0900 | inside |
| `isc+scb` KT @20 | — | — | 0.0662 | inside |
| `mqg+skull` Vashj @295 | — | — | 0.0519 | inside |
| `mqg+skull` Vashj @235 | — | — | 0.0123 | inside |
| `mqg+skull` Al'ar @295 | — | — | 0.0051 | inside |

⇒ **6 of the 9 boss over-floor cells are not deficits**, and the KT-AoE family shrinks to a 3-cell
single-kit residue. ⚠ **Two honest limits.** (a) The 0.1427 sd is measured at **one** cell; transferring it
to the other eight is a first-order prior, strongest exactly where the survivors are (same kit, same fight,
same length). (b) The **15 class over-floor cells are untouched** — `downtime`/`aoeWins` are populated only
inside `if (BOSS)` (`tools/xval.mjs:139-163`), so a class fight genuinely has one wall and its ripple floor
is **complete**. Top class cell stands: `isc+skull long T=293 @130`, excess **0.1653**.

**And the 3 survivors are localized to a single named blind spot.** Ablating the AoE window at the top cell
(press times, walls, geometries and seed all identical; `_aoe` deleted and `--targets` dropped) collapses the
deficit from **+0.2930 ±0.0068 pp to −0.0063 ±0.0048 pp** on the parity-free geometries — statistically
identical. **The AoE window accounts for 102 % of it.** Outside the window the model ranks this pair exactly
right, so this is **not** a burn-model, search, or tail-lattice error: it is **within-AoE-window placement**
(the model packs the cluster against the window end; the sim wants it ~10 s earlier). Filed as the
Correction-3 *candidate* in RULES §9 — measured at one cell family, cause not yet named, **no engine change
made**. Phase 7's remaining work is that one term.

**★★★ Round 5 proves the B failure is NOT a reference-gear artifact.** The correction was a genuine
repricing: `xval-round-diff` reports **124 of 345 plan cells changed (35.9%)** across 34/36 tables on a
−0.4…−1.1% `eff` level shift (KT −6.1…−6.8%). And the verdict did not budge — `deficitTables 34→34`,
**zero verdict flips**, `monoDip` 0.00% before and after. Per-table widths wander *both ways* under a
pure repricing (12 tables improved, 8 worsened, 16 unchanged; net 0.42 pp over 36 tables), including
`scb-skull-short` 0.02%→**0.23%** and `scb-mqg-short` 0.03%→**0.21%** — a table can go from
essentially-clean to among-the-worst with **no model change at all**. Two consequences: the round-over-round
headline drift above is mostly repricing, not convergence; and PHASE8 §20.2's pre-flight claim that the
correction was "rank-neutral, the plans will not move" is **withdrawn** (it was one fight family at four
hastes; this is 36 fights at 7–11 hastes). It also confirms invariant A was already clean at round 4
rather than being fixed by the new gear.

**Data was certified before being accepted as the record** (the harness audit of 07-25 found 36
false-pass defects across 14 tools, several of which could have silently corrupted a whole round):
6 distinct per-kit haste grids each correctly matched to its kit — none is the coarse
`[0,100,200,300,400]` default an empty `HASTES` would have substituted — all 345 plan rows carry
`_prestack:0` (cold open, no prepull), no `NaN`/`undefined`, all 36 carry `XVAL-DONE`.

**★★★ The worst non-KT column in round 5 is DIAGNOSED, and it is an INSTRUMENT ARTIFACT, not a model
defect.** `isc-skull short T=99 @sim40 ← plan@70`, **0.362%**, differs from native in **one track**:
`IV[8,28]` vs `IV[0,20]` (Icon and Skull byte-identical), and the model prices the pair 0.006% apart.

*The first attribution was wrong and is withdrawn.* That 0.006% was blamed on the model crediting
ramp-covering haste at exactly 0.000 (`index.html:926-928`) — the "ramp under-credit debt". **Falsified two
ways.** (1) `tools/ramp-marginal.mjs`: the model's ramp credit is *exactly floor-slack recovery* — 0.0000
floor-free (provably the right answer) and +0.33…+0.41 pp when the floor binds — so there is no
under-credit to patch (RULES §3). (2) **Both layouts in this cell are floor-free at the opening** (IV alone
at R=40 ⇒ m=1.2304, steady cast 1.219 s, 0.219 s of slack), so **no ramp physics is in play here at all**
and the model's 0.006% is *correct*.

**The real mechanism is the tail-lattice ripple** (RULES §8, `tools/lattice-ripple.mjs`). The sim counts
**integer** casts under the kill taper; the model integrates its **continuum limit**. Same width
(`KILL_WINDOW = 0.5` ≡ `--var 0.5`), different kind — a sawtooth of `1 − W/c` casts, `0.3164` at this
fight's tail rate `c = 1.4629 s`. Evaluating the *sim's own* expected-cast sum on the *model's own* cast
list settles it with no wowsims run:

| scorer | native | rival | rival vs native |
|---|---|---|---|
| **continuous** (the model) | 242539.5 | 242524.5 | **−0.0062%** ← reproduces the reported model gap exactly |
| **discrete** (the sim's formula) | 239621.7 | 241070.6 | **+0.6046%** ← sign flip |
| wowsims measured | 3040.7 | 3051.7 | **+0.3617%** |

The tail diagnostics name the cause outright: **native's last cast completes at 99.6216 s — past
`T+KW = 99.5`, weight 0, a wholly wasted cast** — while the rival's completes at 99.3041 s (weight 0.196)
and fits one more. `tail-flat=true` for both, so the lattice extension is legitimate. **The disputed 0.36%
is which side of the kill window the last cast falls on** — the razor-edge whole-cast parity trap
`xval.mjs` names for `var=0`, surviving at `var=0.5` because the taper (1.0 s) is *narrower* than the tail
cast period (1.463 s).

**⚠ And the fix is NOT to discretize the scorer** — the full-column control refuses it. All 11 plan rows
scored at sim-haste 40: the discrete sum picks the sim's argmax (row 70) where the integral picks 40, so it
*does* fix the disputed ranking — but across the column it is a **worse predictor on both metrics**
(`r = 0.7910` / RMSE 0.2948 vs the integral's `r = 0.9337` / RMSE 0.2431) with large two-signed errors
(+0.669, +0.469, −0.241 pp). Discretization adds variance without removing bias, independently re-deriving
`index.html:875-877` (a per-cast sum *was* the old model; its quantization produced the phantom gains).

**⚠⚠ This puts a POSITIVE-BIASED FLOOR under the metric itself.** `diagWorst` is a `max` over ~10 rival
rows of a two-signed ripple, each row carrying an independent tail phase, so **its expectation is positive
even for a perfect model**: `+0.037/+0.065%` at R=1 rising to `+0.094/+0.165%` at R=10 (Monte-Carlo, 20k
seeded, at `c = 1.219/1.463`, n=81). Because the ripple is a *fixed cast count*, the percentage scales as
`1/N` — **the artifact is short-fight-and-low-haste only**, which is exactly the shape of the residual
deficit family. ⇒ *"No length-persistent diagonal deficit"* **is not reachable by construction** on short,
low-haste tables at this taper width. **This is a user-facing criterion call**, filed below as a coverage
gap: the honest form of the test is likely *"deficit below the ripple floor"*, not *"no deficit"*.

**So: not passing yet** — but the accounting has changed **twice**. Remaining owners: the two persistent
columns (Phase 7), PHASE8 (the B2 family, highest-effort scorer work), and the metric-design task for the
near-tie tail — now merged with the criterion question above, since both say the ruler is too coarse for what
is left. **Second repricing (07-25):** the boss half of the over-floor list is down from 9 cells to 3, and
those 3 are one mechanism — **within-AoE-window placement** (above). So what is left of Phase 7 is *one named
term at one kit*, plus 15 class cells whose floor is complete and whose top excess is 0.1653 pp. **The ramp-credit patch is CANCELLED** (there was no defect). Re-run this in full after each.
A performance phase is also open (`docs/PHASE9.md`); by construction it must leave every plan
byte-identical, so it cannot invalidate a round — but re-run the exact-match suite after each of its
steps, and if any plan ever *does* move, the round is void.

## Known coverage gaps in the test itself (make the test stronger over time)
- **~~Single-worst-cell reporting hides structure.~~ CLOSED (P7.1 + 07-25).** The collector now publishes
  **every** borrowed-win column with its locus and the full width distribution, and
  `tools/xval-persist.mjs` grades length-*persistence* properly (the collector's `★` tag is only "this
  kit×haste also violates on long/xl", which is weaker — it is a hint, not the test).
- **Wide plateaus make adaptation vacuously "clean."** Where the tool emits one byte-identical plan
  across most of a kit's haste band, the cross-val isn't really testing adaptation there — only the
  plateau vs. the differing endpoints. Note this when reading a CLEAN result. *Measured at round 5: this
  is NOT what is behind the failures — **0 of 135** borrowed-win columns have a borrower plan
  byte-identical to the native, so every one is a real plan difference (`xval-persist.mjs`).*
- **★★★ THE METRIC HAS A POSITIVE-BIASED RESOLUTION FLOOR, so `diagWorst = 0` is not reachable by
  construction on short/low-haste tables** (07-25; RULES §8, `tools/lattice-ripple.mjs`). The sim counts
  integer casts under the kill taper, the model integrates the continuum limit; the residual is a sawtooth
  of `1 − W/c` casts (`W = 1.0 s`, `c` = tail cast period) — **exactly 0 at the GCD floor**, `0.32` casts at
  `c = 1.463 s`. `diagWorst` then takes a **`max` over ~10 rival rows** of that *two-signed* quantity, each
  row with an independent tail phase, so its **expectation is positive for a flawless model**:
  `+0.094…+0.165%` at R=10 on an 81-cast fight. Since the ripple is a fixed cast count, the percentage
  scales as `1/N` — the floor is **short-fight and low-haste only**, which is precisely where the residual
  deficits live. **Two things follow.** (a) A cell below the floor is **not evidence of a model defect** —
  the round-5 worst non-KT column is now diagnosed as exactly this. (b) **The criterion itself needs
  restating** — plausibly *"deficit below the ripple floor for the table's tail rate"* rather than *"no
  deficit"*. That is a **user call and is NOT being made unilaterally**; until it is made, read a
  short/low-haste DEFICIT under ~0.1–0.2% as *at the ruler's limit*. This compounds the model-side limit
  already recorded below (58/135 round-5 columns priced ≤0.02% apart — under the model's *own* resolution).
  Widening the taper toward the tail cast period would shrink the floor, but it also **changes the
  objective** (`KILL_WINDOW` is the half-cast hedge of RULES §8) — do not "fix" the ruler by moving the goal.
- **~~KT AoE simmed as downtime~~ (genapl has no Arcane-Explosion emission) — ~~KT numbers exclude AoE
  damage.~~ CLOSED at task #53.** `genapl` emits Arcane Explosion for every `_aoe` window and the runner gets
  `--targets N` (`tools/xval.mjs:133,161,177,265`); the round-5 KT columns are AoE-**valued**. ⚠ Stale copies
  of this claim survived in several headers long after it was false — when a doc and the code disagree about
  what a harness emits, **read the code**.
- **★★ THE FLOOR IS A TAIL-ONLY RULER, SO IT UNDER-PRICES BOSS COLUMNS BY ~0.13 pp** (07-25, above; RULES §8
  consequence 6). A boss column carries 7 walls and is a 5-variant mean; a class column carries 1 and is a
  single run. Never pool a boss and a class cell into one statistic without saying which instrument each came
  from — the 2.8× over-floor enrichment of boss cells was entirely this. Priced now for boss cells
  (±0.1251), still unpriced for the *interior*-wall contribution at any other boss length or kit.
- **Ashtongue** (random on-crit proc) is out of the kits — needs a different, stochastic treatment (Phase 7).
- **No exhaustive ground truth above ~h150** for SP-trinket-free kits (the 5s grid can't express the
  off-grid optimum) — the tool is certified only ≥ the coarse grid there.

### ★★ What a PASS here does and does NOT prove (user's challenge, 07-25)

The user asked directly whether the big test has a logical flaw, and whether it is even a definitive
"is the tool reliably correct in every scenario." Both deserve a straight answer, so it is written here
rather than left implied by the gap list above.

**It is a SAMPLED, GRID-LIMITED COMPARISON — not a proof of optimality.** The test compares the model's
plan against *the best plan a 5-second-grid sim search found*, at 7–11 haste points on 36 fight shapes.
Every word of that bounds it: the reference is a **grid search**, not an optimum (the gap above already
concedes there is no exhaustive ground truth over ~h150); the haste points are a **sample** of a
continuum; the 36 shapes are a **sample** of fight space; and Ashtongue is excluded outright (it is
stochastic). So a CLEAN verdict means **"agrees with a
grid-limited reference on the sampled points"** — a strong statement, and a different one from "optimal."
Read it as the former. It is the best available instrument, not an oracle.

**⚠ And a PASS is a TABLE-LEVEL summary, so it cannot certify a cell.** `monoDip`, `diagWorst` and the
CLEAN/DEFICIT verdict are aggregates; they can hold or improve while an individual cell regressed. A
change that moves plans is therefore **not** verified by "the table still passes" — each moved cell needs
old-plan-vs-new-plan **simmed head-to-head under one harness**. That duel requirement, its cost model,
and the repricing trap that stops you doing it by subtracting two rounds' tables are in
`docs/TOOLING.md` → *Scope the verification to what CHANGED — and DUEL what did*.

**Consequence for how this doc is used:** this test is the *"are we done yet"* measurement — run once
per campaign, not per change. It is **not** the per-change gate, and it never was one; using it that way
is what made the iteration loop slow. The per-change gate is the fast plan-diff instrument
(`docs/PHASE9.md §5`), and the duel is what sits between them.

### ★★★ What the B BANNER can and cannot tell you (07-25, round 5) — the bar is right, the banner is nearly powerless

The user's challenge above was answered for the *test*. Round 5 answered it for the **banner**, and the
answer is sharper: `xval-verify.mjs`'s `B FAILS` line, and the per-table `CLEAN`/`DEFICIT` tag, **have
almost no discriminating power — they would read the same for a converged model and a broken one.**
This does NOT relax the bar (zero borrowed-win columns, user-directed, unchanged). It changes what you
are allowed to *conclude* from the banner, and therefore how work gets prioritized.

**1. It is an EXISTENCE test, evaluated at a near-perfect tie.** B asks "does *any* rival beat native in
*any* column" — with ~10 columns × ~9 rivals that is ~90 comparisons per table. And they are not
comfortable comparisons: in the 210 columns where the diagonal *wins*, its **median winning margin is
0.003%** — an order of magnitude *below* the harness's own CRN/10k-iteration resolution of ~0.02%
(PHASE7 §5.4). Most of those 90 comparisons are coin flips at the resolution limit.

**2. So a DEFICIT verdict is close to arithmetically forced.** At the observed per-column borrowed-win
rate of **39.1%**, an existence test over ~10 columns returns DEFICIT with probability
`1 − 0.609¹⁰ ≈ 99.3%`. The bar therefore cannot be *reached* by anything short of a model that wins
every near-tie, and a test that essentially cannot pass measures nothing on the way there — the mirror
of the project's standing rule that *a test that cannot fail measures nothing* (DIARY). Observed CLEAN is
2/36 = 5.6%, i.e. **better** than that null (0.7%), which is itself the first hint that the model is not
the problem.

**3. And the model is genuinely right most of the time.** If every true delta were zero, max-of-9 rivals
would exceed native with probability `1 − 2⁻⁹ ≈ 99.8%` of columns. Observed is **39.1%** — nowhere near
noise. The diagonal is *really* dominant in the majority of columns; what fails is the tail of near-ties.

**4. The failures are LOCAL near-degeneracy, not adaptation failure.** Of the 135 borrowed-win columns:
**0** have a byte-identical borrower plan (so they are real plan differences), but **80 (59.3%) borrow
from the immediately adjacent haste column** and **114 (84.4%) from within 2 grid steps**; only 7 come
from ≥5 steps away. Magnitudes: median 0.035%, mean 0.069%, p90 0.191%, max 0.377% — **34.1% are ≤0.02%**
(at or below CRN resolution) and 77.8% are ≤0.10%. "The plan built for h70 wins at h40" is what a flat
optimum looks like when measured with a ±0.02% ruler, not what a wrong adaptation rule looks like.
**Confirmed at track level** (PHASE7 §5.16, `tools/diagnose-deficit.mjs` dossiers): **132 of 135** have
identical press *counts* on every track — pure **retimings**, only 3 structurally different plans — and
the *model's own* margin is ≤0.02% in **58 of 135**, with **14 exact ties**. ⚠ "Retiming" is a statement
about structure, not size: the median row moves 6 presses and its worst press moves 24s. And those 58
matter more than the count suggests — where the model's margin is below the ruler, **the model has no
opinion to be wrong about**, so no search fix can reach them; they are a *resolution* property of the
objective (a metric-design task), while the other 77 carry a real model preference a scorer term could fix.

**5. The principled test — and it needs no tuned thresholds.** A length-persistent structural defect at
`(kit, haste c)` can only have one shape: **one specific rival layout is genuinely better there, so it
beats native at MOST fight lengths** (the defect is a property of the cell; fight length is not what
causes it). Run unrigged over all 57 kit-columns — no magnitude filter, no distance filter — the best
rival's win-count distributes `5/5:1 · 4/5:1 · 3/5:10 · 2/5:20 · 1/5:16 · 0/5:9`, so **exactly two
columns** carry a consistent (loses ≤1 length) better rival:

| kit-column | rival | wins | per-length margins % |
|---|---|---|---|
| `isc-mqg` h40 | `plan@h70` | **5/5** | 0.094, 0.007, 0.260, 0.101, 0.073 |
| `isc-skull` h20 | `plan@h100` | **4/5** | 0.087, 0.007, 0.066, 0.011 |

That is the tractable Phase-7 target list — **2 of 57 kit-columns, down from "34/36 tables FAIL"** —
and it is now a committed instrument, `tools/xval-persist.mjs`, rather than a one-off analysis.
⚠ Even these two need a magnitude-vs-resolution judgement before being called defects: each has at least
one length at 0.007%, well inside the ±0.02% ruler.

**6. ★★★ The methodological correction that matters most: a sieve whose thresholds you chose after seeing
the data is not evidence.** Before running the test above, a three-filter sieve was built — persistence
≥4/5 **AND** borrower ≥2 grid steps **AND** magnitude ≥0.10% — and it reduced the 34 failing tables to
four columns (`isc-skull h130` 0.279%, `scb-skull h90` 0.229%, `isc-mqg h20` 0.133%, `isc-mqg h110`
0.101%). The two tests **disagree completely**. All four sieve survivors *fail* the unrigged test (best
3/5, with magnitudes inconsistent by 20×: `isc-skull h130`'s rival h185 gives 0.009% / 0.014% / 0.279%),
and **both unrigged survivors had been rejected by the sieve** — `isc-mqg h40` killed by the distance
filter (maxDist only 1 step), `isc-skull h20` by the magnitude filter (worst 0.087%). Trust the
threshold-free test that names the only physically possible *shape* of the defect; discard the sieve.
Nothing from it is recorded as a finding.

**Consequence for the verdict banner:** leave the bar and the banner as they are — `B FAILS` is a true
statement about a user-directed bar, and softening it would be exactly the "grade the deficit by
magnitude" move the user overturned. But **never steer work off it.** Read `xval-verify.mjs` for the bar,
`xval-persist.mjs` for where a defect can actually be, and the collector for the full published
distribution.
