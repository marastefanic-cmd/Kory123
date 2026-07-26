# ROADMAP.md — status, current work, open questions

## Resuming after a context clear (start here)

### ⏳ 0. FRESHEST STATE (07-26) — PHASE 8's FINALE IS FALSIFIED; the sim rig is GONE and is the next task

**Read this first — it supersedes the round-6/7 block below on what to do next.**

- 🎨 **UI REWORK LANDED (07-26, user-directed; engine untouched, exact-match 25/25 bit-identical).**
  For first-time legibility on the published site: the live **Pressboard is deleted** (board, clock,
  play/stop/reset, next-up banner, timeline playhead, `follow`/`pressPlan` code) and the **activation
  schedule adopted its visuals** — one line per press *second* with co-pressed activations clustered as
  icon tiles, inside window cards carrying peak haste / AB cast / mana. Copy-as-text (the golden) is
  byte-identical. The **model assumptions** were re-verified claim-by-claim against the engine — **one
  was stale and wrong** (it still said the AB stack ramp was *not* modeled, contradicting Phase 4 and
  RULES §3; the trinket-lockout bullet also omitted the Icon) — and are now sectioned, verdict-chipped
  (`sim-verified` / `beta` / `not modeled`), rendered at page load, and reachable from a masthead
  button. **Beta badges** mark Ashtongue / Drums / Power Infusion (user call: source-verified physics,
  placement never sim-certified end-to-end). Masthead shortened and retitled "WoW Anniversary cooldown
  optimizer for Arcane mages"; phase-editor dropdown no longer overlays its label and its trailing
  number field states its unit (`× damage`, `targets`). Record: DIARY 07-26 + its ledger row;
  ARCHITECTURE `renderSchedule`/`renderAssumptions`.
- 🧪 **THE BENCH IS NOW A TOOL — `tools/bench.mjs` (07-26, user-directed).** `docs/BENCH.md` had
  declared the gear-agnostic bench the standing practice hours earlier but **nothing implemented it**
  (all 15 sim-capable tools still resolved `RUNNER`+`EXPORT_BASE` from a scratchpad). Now:
  `node tools/bench.mjs --preset "2:00 lust 0:05" --vs naive` → **~10s, cold, from the repo alone**,
  because it runs the committed `sim/sim.wasm`. Implements BENCH §2.1 (never-press control), prints a
  **seed band on the paired difference** and the **model's Δ beside the sim's** with a sign-agreement
  check, and **forces the model cfg to the simmed character** (spreads `REF` — the first version
  reproduced PHASE8 §6/§7's two-different-mages defect and mispriced a duel 1.434% → 1.314%).
  Same backbone as the website button; `tests/sim-request.mjs` now gates BOTH committed characters.
  ✅ **The `--var` conflict is SETTLED (07-26, measured):** `tools/var-decision.mjs` decides for
  **0.5**. At var 0 the effect size of a real difference swings a whole cast (−32.8 → −0.9 → −31.8 DPS)
  for a 0.1s change in the kill second whenever the arms differ in terminal cast rate, and var 0 is
  **not** quieter (seed band 0.06/0.40 vs 0.04/0.25) — a fixed duration sits *on* the discontinuity.
  It cancels only when both arms truncate identically, which is why the convention survived. BENCH §3
  and TOOLING ★★ now carry the numbers.
  ✅ **Drums/PI exclusion re-diagnosed:** not a genapl gap — upstream never flags those spells
  `SpellFlagAPL`, so no APL can press them, and the attempt is a **silent** no-op (bit-identical DPS).
  Patchable via a third wowsims patch if the default kit ever needs to verify whole.
- 🔬 **THE SIM SHIPS IN THE PAGE (07-26, user-directed; engine untouched, exact-match 25/25).**
  A **"Check in the benchmark sim"** button runs the real wowsims engine as WASM in the browser and duels the
  model plan against your hand-edited timeline (or against "mash on cooldown" when there isn't one).
  **Not a second implementation** — `planspec` → `genapl-core` → `simreq` → `sim.wasm`, every link
  shared with the terminal harness, and `tests/sim-duel.mjs` asserts the shipped wasm equals the
  native runner to the printed decimal. **Gear-agnostic**: fixed synthetic mage, the user's SP/crit/
  haste injected, hit-capped, infinite mana, cold open, `var 0.5` — absolute DPS is meaningless and
  the UI says so, only the paired same-seed difference is reported. Refuses Burn phases (no encounter
  knob) and names Drums/PI/Ashtongue as dropped (no genapl press). ~10s for both arms at 10k
  iterations. **Follow-up same day (two user calls):** the button is renamed **"Check in the benchmark
  sim"** and carries a **"?"** dialog spelling out that it is NOT a sim of the user's gear (plus how to
  read the gap, and what it can't see); and every protocol constant now lives ONCE in
  `sim/benchmark.mjs` — imported by the page, `tools/plan-duel.mjs` and both tests, with
  `runnerFlags()` generating the native command line — backed by `tests/sim-request.mjs`, which asserts
  the page's request equals the runner's field-for-field, plus protocol invariants (because sharing a
  constant proves agreement, never correctness). Record: `sim/README.md`, TOOLING ★ section, DIARY 07-26.
  **Next steps if it earns its keep:** teach genapl a Drums press so the default kit verifies whole;
  a multi-seed error bar instead of a fixed tie band; and the search-miss alarm (a legal hand-edit
  that out-scores the model under its OWN scorer is a confession, gradeable with no sim at all).
- 📝 **COPY AUDIT of everything the user reads (07-26, user-directed; engine untouched, exact-match
  25/25).** `index.html` + `README.md` verified claim-by-claim against the engine. **README carried the
  same disproven ramp claim in three places**, two deleted features (press price tags, clipped-press
  value tags), a superseded press-timing description, and **IV-crossover numbers that do not reproduce**
  ("~100 rating" ×3 and "~150–200" ×1; re-measured: **~15** for IV+Icon, ~80 with AP in the cluster,
  never-in-Lust with a full opener kit — RULES §5 had this right all along). Page side: plain-language
  rewrite with tooltips on the result tiles and the timeline legend, "Debugging presets" → "Reference
  fights" collapsed behind a `<details>`, and a **"Show the numbers behind each claim"** toggle that
  hides the technically-true-but-irrelevant mechanism by default. **Two missing statements added**: the
  search is multi-start local + polish (**a very good plan, not a proven-optimal one**, with
  ACCEPTANCE's residual behind the fold) and the output is deterministic/reproducible. DIARY 07-26 +
  its second ledger row.

- ✗ **THE BOUNDARY CHARGE MUST NOT BE IMPLEMENTED (PHASE8 §22; 07-26).** The Phase-8 finale was
  "implement the per-window continuous-vs-discrete charge". It is **falsified on sign**: re-priced
  against the *anchored* lattice (the shape §21.5 proved the flat `frac(D/Δ)` gets wrong), the value
  charge is **still anti-B2 and 4.3× worse** — `ΔL` `+0.036 pp` (flat, §13.8) → **`+0.156 pp`**
  (anchored), where B2 needs a **negative** charge to close its `−0.380 pp`. §13.8's retirement of
  the lattice-quantization family therefore **survives** §21.5's invalidation of its ruler, and B2's
  residual target stays **≈0.445 pp**. The trap, stated plainly: **C-BE dominating the ASYMMETRY
  (§21.5) says nothing about its sign in the LEVELS** — §21.4's "collapses to implementing one term"
  was an invalid inference. Instrument: `tools/p8-boundary-charge.mjs` (sim-free; reproduces §21.5's
  C-BE to 4 dp as a built-in gate, and asserts the value/haste cleanliness split it depends on).
  `index.html` is **untouched** — no golden risk, exact-match still 25/25.
- ✅ **THE RIG REBUILDS FROM THE DOCUMENTED RECIPE — nothing was lost (TOOLING, verified 07-26).**
  Executed end to end in a fresh container: `wowsims/tbc-new` @ `ade9f39` + `tools/wowsims-patches/*`
  → `runner-ap180`, 18 MB, provenance checks passing (`innerSpell`=3, `CD.Use`=0). ⚠ **The repo is
  `wowsims/tbc-new`, NOT `wowsims/tbc`** — it declares module `github.com/wowsims/tbc`, so deriving
  the URL from the runner's imports lands on the archived pre-APL repo and wastes a lot of time.
  Two steps the recipe omitted are now written down: `sim/core/proto` must be generated with
  `protoc` (plugin **v1.36.10**, matching the repo), and `cmd/runner/` must be created from
  `tools/wowsims-patches/runner-main.go`. **The only thing not in the repo is the gear export, and
  that is deliberate** (user data). Ask the owner for it.
- ✅✅ **PHASE 8'S CHARTER IS DISCHARGED (PHASE8 §26) — with a NEGATIVE result.** The phase narrowed
  to one deliverable, "implement the per-window boundary charge", and that is done: implemented,
  audited, gated, **sign gate FAILED (6/7 lengths worse)**, shipped OFF. Eight findings are now
  SETTLED and must not be re-opened — see the §26.1 table. ⚠ **B2 itself is NOT solved**: the
  residual target stands at **≈0.445 pp**, now constrained to a **U-shaped length profile** with
  **0.16–0.91 pp of quantization headwind** against it. That is the SUCCESSOR question, not Phase
  8's remainder — and it is **sim-gated**, so it cannot start until the rig is restored (§22.6).
- ✅ **THE CHARGE IS IMPLEMENTED AND GATED — AND IT SHIPS OFF (PHASE8 §25).** The finale was executed,
  not just proxied: `cfg.boundaryCharge` (default OFF) prices each value window from the board's own
  anchored lattice (`nModel` continuous cast-equivalents − `nSim` completions inside the window) ×
  premium. **The §20 sign gate FAILS on the real scorer: 6 of 7 fight lengths WORSE**, and it
  overshoots at short fights — T=40 goes `−0.197 → +0.467`, flipping sign and growing. Three
  independent measurements now agree (§22 proxy@229, §23 proxy across length, §25 the real scorer).
  Gates green for the OFF path: `plan-diff SCORE-AUDIT scorerMoved=0`, `PLAN-DIFF IDENTICAL`,
  exact-match **25/25**. No golden churn, so the "sim-verified better" gate never engages.
  ⚠ **Do not turn it on** without a sim gate justifying it on fidelity grounds other than B2 ranking.
  ★ **And COMPLETING the family does not rescue it (§25.5a):** the goal's "+0.15/+0.26 pp" sizing
  came from a HASTE window (`MQG@202`), so the coded charge is half the term — but combining the
  anchored `L` with §13.8's measured `U` gives **Δnet = +0.186 pp**, *more* anti-B2 than value-only
  (+0.156). `ΔU` is **−0.030** where it would need to exceed **+0.156** to flip. **No version of the
  family — value, haste or both, flat or anchored — closes B2.** Tool: `tools/p8-family-net.mjs`.
- ★★ **A cfg field that changes a score MUST be in `cfgSigOf` (PHASE9 §5.19).** The first §25 gate
  run read ON≡OFF at all 7 lengths — the charge was never computed, because `SIM_MEMO` served the
  OFF entry. Silent, no error, looked like a clean null. Fixed; guard proposed in PHASE9 §4.
- ★ **B2's bias is U-SHAPED IN FIGHT LENGTH, and §22 holds at every length (PHASE8 §23; sim-free).**
  `model − sim` = **−0.197** pp at T=40, mean **−0.116** across T=70..205, **−0.397** at T=229 — both
  ENDS ≈2–3× the middle, and 7/7 negative on the *corrected* harness (so §2's sign test is not a
  harness artifact). Constraint on any candidate: a terminal-only mechanism cannot explain T=40
  (where none of h70's late presses exist yet) and an opener-only one cannot explain T=229 — it
  needs **two terms, or one that scales with how much of the fight is ramp-or-kill vs steady**.
  The obvious ramp story (start-vs-completion divergence ∝ cast length, maximal in the 2.5–4.7 s
  ramp where h70 spends `AP@4`+`isc@4`) was **tested and falsified on sign**: `ΔL` is `+0.912` pp at
  T=40 against a `−0.197` pp bias. ⇒ **§22's verdict is not a T=229 artifact** — the quantization
  family points wrong at every length and is *strongest* in the pure-opener cell. Instrument:
  `tools/p8-b2-length.mjs` (anchored to §13.8's recorded −0.037, exit 3 on drift).
- ✅ **F3's 0.0724 pp residual is CLOSED as a lead (PHASE8 §24; sim-free).** Not a third mechanism —
  the additive test that produced it is **ill-posed**. Re-estimating C-BE with the cascade applied
  moves ΔC-BE `0.1105 → 0.0311` (interaction = −0.0794 pp, **1.10× the residual**), so the two terms
  are not independent and the 0.05 pp bar can be neither met nor missed meaningfully. ⚠ Note the
  sign: applying it makes the decomposition explain *less* (22.6 %, residual grows to 0.152), so it
  **does not absorb** the residual — it retires it as uninterpretable. F1/F2/F4 are basis-robust and
  C-BE's dominance is unaffected. Instrument: `tools/p8-f3-additivity.mjs`.
- **Consequently the goal's item 2 is BLOCKED, not skipped.** The two persistence columns
  (`isc-mqg h40` 5/5, `isc-skull h20` 4/5) and KT `mqg+skull` 0.31 % were to be re-diagnosed *after*
  the charge landed. The charge is not landing, so they revert to their prior status — same physics
  family, still open, now with the charge explicitly ruled out as their explanation too.

### ⏳ 0b. Round 6/7 state (07-25/26) — ROUND 6 COMPLETE AND GRADED; the groupSeeds fix is staged

**Read this before anything below it; items 1–2 describe round 5, which round 6 supersedes.**

- ✅ **ROUND 6 GRADED (late 07-25 — full record: PHASE7 §5.23 + DIARY).** 36/36 tables under
  `emit=fire`: monoDip 0.00% everywhere · **the persistence work list is UNCHANGED and now
  harness-fix-robust: `isc-mqg h40` (5/5) + `isc-skull h20` (4/5)** · KT isc+scb's 3 over-floor
  survivors **DISSOLVED** under P7.14+fire (0.38%→0.09%, inside the band); KT mqg+skull re-shaped
  0.15%→**0.31%** `[@sim0: plan@30 > native@0; native presses AP@109, 4s into the AoE window]` —
  the round-7 look, after the fix lands. Two instrument defects found and fixed by the round
  itself: the artifact guard's stale deferral premise (wall presses fire IN PLACE, faithful —
  `wallPress=` info now, `artifact=` reserved for intent) and the EFF-AUDIT's missing per-table
  scoping (`ungraded=` bucket for pin-less tables; KT's P7.14 repricing no longer reads as search
  regressions). Final audit: `worse=7 better=5 tie=44 ungraded=30` — the 7 are the attributed
  groupSeeds cells below.
- ★★★ **THE §5.15 REGRESSIONS ARE ATTRIBUTED AND THE FIX IS ★LANDED★ (PHASE9 §5.16; 07-26).**
  Golden gate: 24/25 bit-identical + **Kael'thas strictly better (Δscore +17.79, terminal cluster
  381→396)**, golden re-recorded on the arbiter rule; exact-match re-run and green post-update.
  CPU: +16.5% vs the −8.5% landing (net ≈ +6.6% vs pre-§5.12) — reclaim candidates open in
  PHASE9 §4. The landing also carries the footer build stamp and the preset-overwrite flash.
  ★ **THEN THE TAIL LOTTERY CLOSED THE SAME NIGHT (PHASE9 §5.17):** the round-7 identity filter
  found a third instance (`isc-mqg-xl @h20`: round 6 rode a 1e-10 float-dust snap lead and its tail
  won +14), so the filed remedy landed — **`finishLine(entrant)`**, the whole finishing tail run
  once per hop arm, FINALS decide. The §5.16 h20 hair heals; goldens byte-identical (25/25, no
  re-record); CPU +10.4% (cumulative ≈ +18% vs pre-§5.12 — reclaim is now the live §4 work). ONE
  residual, structurally new and stopped-by-decision: `isc-mqg-xl @h20` −0.005 vs round 6 via the
  recursive no-CS sub-solve's chain-candidate family — the named `--observe` trade for round 7.
  **Next: ROUND 7 — re-gather the cells the fix moved** (identity filter re-run under the FINAL
  engine → r7-resim.sh the changed list; cheap under DPS_CACHE) so the acceptance ledger reflects
  the landed engine, then the round-diff vs round 6 must read `worse=0` (+ the one named observe).
  All 7 cells
  = **groupSeeds ALONE** (groom exit exonerated by single-variable isolation). Mechanism: an
  ADDITIVE seed class wired through three EXCLUSIVE selection points (seed-fill eviction of
  randoms · top-6 snap displacement · winner-take-all into basinHop — h160: a +34 snap lead in a
  dead-end basin traded away +3594 of hop). Fix = fill-first + base-top-6-preserved + hop-both
  with strict-improvement override (ties carry the old selection — h260's hops tie EXACTLY on two
  layouts). Validated on all 60 cells of the 6 affected tables: **≥ round 6 everywhere, ≥ round 5
  at 59/60**; the one residual (`isc-mqg-medlong @h20`, −0.001 eff) is the finishing-tail
  winner-take-all, documented with two filed remedies (callable `finishLine` double-run;
  cluster-shift move class). Landing gates in flight: golden A/B sweep + SCORE-AUDIT, then
  exact-match. Landing also carries a footer build stamp + preset-overwrite flash (user-reported
  UX trap: a preset load silently resets typed gear).

- **Round 6 = the `emit=fire` re-gather** (task #70). `tools/xval-results/` is being refilled; round 5
  is archived at `tools/xval-results-archive/phase7-round5/` (the last `emit=intent` round — a table
  with **no `emit=` stamp** is `intent`, that is the classification rule). The driver
  (`tools/xval-rerun.sh`) is detached and **commits + pushes each batch itself**, so the round lands
  in git with or without a live session. A complete round is **36 tables**.
- **Every `XVAL-DONE` so far reads `emit=fire artifact=0 monoDip=0.00%`** — the two things task #70
  asks to verify are holding on all 30 class tables.
- **The rig lives OUTSIDE this session's scratchpad.** Discover it by CONTENT, never by mtime — that
  is what `tools/xval-env.sh` does (`ls -dt /tmp/claude-*/*/*/scratchpad` then test for
  `wowsims/runner-ap180`). Only one sibling scratchpad has it.
  ⚠ **Override `XVDIR` to a fresh dir** when re-running: `ckpt()` copies `$XVDIR/*.txt` into the repo
  blindly, and the default `$SP/xvcamp7` still holds prior-round tables that would contaminate it.
- **★★★ NEW DEFECT, and it gates the final verdict — `docs/PHASE9.md §5.15`.** The −8.5% CPU landing
  (§5.12 groom early exit + §5.14 `groupSeeds`) is **not plan-neutral off the golden corpus, and the
  movement is one-directional**. Round5→round6 on 100 class cells:
  `EFF-AUDIT unchangedSpecs=82 scorerMoved=0 movedSpecs=18 → worse=3 better=0 tie=15`. Worst is
  `mqg-skull-medlong @h265`, eff **204.883 → 204.812 (−0.0347 %)**, a genuine restructure
  (`AP:[3,183]→[4,205]`, `MQG:[60]→[140]`). Needs **no sim**: `eff` is the model's own objective and
  the audit *proves* the scorer is pinned (82 byte-identical specs score byte-identically), so a lower
  eff means the optimizer rejected a layout it had found and its own objective prefers.
  - Why no gate caught it: both landed on `PLAN-DIFF changed=0` over the 25 goldens. `plan-diff` does
    carry a per-cell `dScore`, but with `changed=0` that field was **never populated** — the one number
    that would have caught it was structurally guaranteed empty on the only corpus it ran against.
    ✅ **The gate hole is CLOSED (07-25): `plan-diff` now carries the SCORE-AUDIT** — scorer-identity
    proof on unchanged cells, sign split on changed ones, and scorer-pinned `ΔScore<0` = exit 1 even
    under `--allow-change` (PHASE9 §5.15 open item 2 → landed; §5.3 contract updated).
    ✅ **And `xval-round-diff` now GRADES it too**: `worse>0` under a pinned scorer = exit 1, with
    `--observe` as the named-trade opt-out (user asked, deferred; decided default-fatal to match).
    ⚠ On the full 30 class tables the audit reads `movedSpecs=52 → worse=7 better=5 tie=40` — the
    attribution list is **SEVEN cells** (worst still `mqg-skull-medlong @h265` −0.0347%), not the 3
    the first-10 snapshot showed, and `better=0` did not survive the full half (5 cells improved).
  - **Attribution is owed** (task #4): groom-exit vs `groupSeeds` vs interaction, one variable at a
    time against `git show <pre-landing>:index.html`. Sim-free. Needs **idle cores**, and must not
    modify the repo's `index.html` while a campaign is reading it per cell — sweep a scratchpad copy.
  - **Do not read a FINAL acceptance verdict off an engine carrying this.** Round 6 is still the
    `emit=fire` re-baseline the docs demand (acceptance was already failing), but the verdict waits.
- **Grade the round when 36 tables are present** (a partial directory is the false-pass shape both
  instruments were hardened against):
  ```
  grep -h XVAL-DONE tools/xval-results/*.txt        # assert emit=fire + artifact=0 on all 36
  node tools/xval-verify.mjs   tools/xval-results
  node tools/xval-collect.mjs  tools/xval-results
  node tools/xval-persist.mjs  tools/xval-results
  node tools/xval-round-diff.mjs tools/xval-results-archive/phase7-round5 tools/xval-results
  ```
  Watch for **phantom deficits vanishing** on the boss half: `intent` *inflated* 2 of 60 banked plans
  ~0.26 %, and an inflated plan in a *borrowed* column manufactures a deficit that was never real
  (PHASE7 §5.22). Also expect KT's 3 over-floor survivors to move — P7.14 changes KT plans.
- **Still open after that:** the 15 class over-floor cells (Phase 7) and B2's crossing-location error
  with the P3 context-asymmetry round-10 candidate (Phase 8).

1. Read `CLAUDE.md` (auto-loaded) → `docs/MECHANICS.md` → `docs/RULES.md` → this file, then
   `docs/ARCHITECTURE.md` (line ranges) and `docs/TOOLING.md` (how to sim-verify) before touching code.
2. **Plan in flight: `docs/PHASE7.md` — FIX the cross-val deficits so the acceptance test passes.
   Status 2026-07-25: the FIXES ARE LANDED and **round 5 is gathered and read (PHASE7 §5.15)**.
   ★★★ **The work list is TWO kit-columns, not 34 failing tables** — `isc-mqg h40` (rival `plan@h70`
   beats native at **5/5** fight lengths) and `isc-skull h20` (rival `plan@h100`, 4/5), found by the
   unrigged consistent-alternative test `tools/xval-persist.mjs`. The `B FAILS on 34/36` banner is an
   *existence* test over ~90 near-ties per table (the diagonal's own median winning margin is **0.003%**,
   below the harness's ~0.02% resolution), so it cannot discriminate — the bar stays zero columns, but do
   not steer work off it (ACCEPTANCE "What the B BANNER can and cannot tell you"). Round 5 also **killed
   the reference-gear explanation**: the correction moved 124/345 plan cells (35.9%) and *zero* verdicts.
   ★★★ **Round 5 is now DECOMPOSED, and the residual is 9 cells, not 135** (`tools/ripple-audit.mjs`,
   07-25). `diagnose-deficit` under pooling returns `SEARCH-MISS 0 · SCORER-GAP 135`, which is
   **tautological** (pooling makes every alternative reachable, so nothing can be classed a search miss —
   a `POOL=0` round would be needed to restore that axis). So the 135 were priced instead against the
   **tail-lattice ripple floor** — the instrument's own resolution, `100·(1 − W/c)/Nt`, pure arithmetic on
   the model's cast list since every column was already measured at `--var 0.5` (RULES §8, five predictions
   pre-registered before the first run, all five pass): **97/121 = 80.2 % of decided columns are BELOW the
   floor** and the median column is **3.8× below the ruler**. Of the 24 that exceed it, 6 are Kael'thas-420
   (its own AoE + wall-parity channels), 5 are **saturating** on the ceiling (<0.03 pp over, expected since
   the amplitude is peak-to-peak and `diagWorst` maxes over ~10 rivals), 4 are slow-tail residuals — and
   **9 are `FLOOR-TAIL`, where the ripple is provably ~0 (exactly 0.000 % for three).**
   ★★★ **FLOOR-TAIL was then WORKED, and it is NOT the target — the target list was mis-ordered by the
   ruler** (`tools/floor-plateau.mjs` + `tools/ambient-gap.mjs`, 07-25; two pre-registered hypotheses, both
   **falsified**, no `index.html` change). (1) `H_PLATEAU` — that the floored residual is a *tie-break*
   failure, the rate integral being flat in surplus haste so the model is indifferent where the sim's
   Δ=1.0 s lattice is a staircase — is **dead**: at the 12 floored cells the model is *not* indifferent,
   median |model Δ| is **larger** there (0.0543 % vs 0.0325 %), and the stratification is real (time at the
   GCD cap 15.6 % vs 5.7 %, p=0.008). (2) The obvious replacement — a mis-sized floor-slack/ramp credit — is
   **disfavoured on sign**: ρ(capFrac, deficit) = **−0.135**. (3) The decisive move was changing the
   **currency**: the sim deficit `pct` hides the model's own margin, so the real disagreement is
   `joint = model Δ + pct`, the amount a fix must close. In that currency the four over-floor families
   re-rank and **FLOOR-TAIL comes LAST**: `inside` 0.081 pp · **FLOOR-TAIL 0.106 (1.30×)** · KT-AoE 0.236
   (2.90×) · SATURATED 0.268 (3.29×) · RESIDUAL 0.274 (3.37×). FLOOR-TAIL only *looked* like the sharp
   target because its own floor is ~0.022 pp, 6× below `inside`'s 0.139 — no ruler was covering an
   otherwise ordinary gap.
   ⛔ **AND THEN THE WHOLE FAMILY-TARGETING PROGRAMME DIED — the corpus cannot rank these families at all**
   (`tools/unexplained-gap.mjs`, 07-25; 6 pre-registered predictions, `verdict=ORDERING-FRAGILE`, no
   `index.html` change). `joint` is itself defective: it adds an **unbounded** term (`dModel`, model-vs-model,
   no sim ⇒ no lattice ⇒ no artifact budget) to a **ripple-bounded** one, and family ceilings differ **9×**
   (0.022 vs 0.189 pp), so cross-family `joint` mostly compares **ceilings**. The corrected currency —
   `unexplained = dModel + max(0, pct − ripplePct)` — gives a **third** ordering, and **no family holds its
   rank across the three**: RESIDUAL 1st→1st→3rd · KT-AoE 2nd→3rd→**1st** · SATURATED 3rd→2nd→**last** ·
   FLOOR-TAIL 4th→4th→2nd. A seeded 20 000-resample bootstrap says why: the nominal worst family tops only
   **60.8 %** of resamples (FLOOR-TAIL 14.5 %, RESIDUAL 15.5 %, SATURATED 9.2 %) — **the ~0.1 pp
   between-family differences are the size of the instrument's own per-cell ceiling (corpus median 0.134 pp).** The
   instrument-dependence is a property of the **data**, not of the formulas. Two of my own claims retract:
   **SATURATED is VINDICATED** (0.037 pp = 0.92× ambient, mean rank 4.03 of 5 — the *least* anomalous family;
   it does **not** need re-deriving, and `joint` flattered its defect precisely because it is *defined* by
   having its `pct` covered by a large ceiling), and **FLOOR-TAIL's "least anomalous" is withdrawn as a
   superlative** (2nd at 2.63× ambient in `unexplained`; the measurement stands, the rank never did). Also
   corrected: the "model is ~0.06 pp over-confident everywhere" figure came from **subtracting two medians**
   — measured directly it is **0.040 pp**. ⇒ **Next is NOT a family.** Aggregate re-ranking of these 135
   columns is exhausted; the only honest moves are a **fresh per-cell sim duel**, **more columns** for power,
   or the queued **acceptance-criterion restatement (user call)**. Do not invent a fourth currency.
   ★★★ **THE PER-CELL DUEL RAN, AND IT ANSWERED P7.13 BY MEASUREMENT — the over-floor list is 18, not 24,
   and the survivor is ONE NAMED TERM** (`tools/cell-band.mjs`, 07-25; six pre-registered tests, no
   `index.html` change). Three findings, each standing alone:
   (1) **The corpus finally has an error bar, and the corpus is TWO INSTRUMENTS.** The ripple floor prices
   **one** wall (the tail); a boss column has **seven** and is a **5-variant wall-jitter mean**, where a class
   column has one wall and is a single un-jittered run (`downtime`/`aoeWins` are populated only inside
   `if (BOSS)`, `xval.mjs:139-163`). Measured at the top boss cell: seed sd **0.0058 pp** — negligible, so the
   corpus's single-seed design is **vindicated** — vs wall-jitter variant sd **0.1427 pp** ⇒ 95 % band
   **±0.1251**, *12× the seed band*. **6 of the 9 boss over-floor cells fall inside it**; only
   `isc+scb/KT/420` at sim-haste 195/95/245 survive. Class cells are untouched and their floor is complete,
   which fully explains the 2.8× boss over-floor enrichment as a ruler artifact. Two sub-findings recorded:
   the variant spread is **bimodal, separated by exactly one cast** (PHASE8's FLOOR LAW on a walled fight ⇒
   quote the parity-free subset, never the mixture), and `VARIANTS[0]` is **δ=0 by construction** so the
   un-jittered geometry carries **20 %** of every boss cell (worth +0.067 pp here; not acted on — it would
   move every committed boss cell).
   (2) **The arbitration tool's band was identically ZERO and is fixed.** `plan-duel.mjs` defaulted to
   contiguous seeds `11..15`, which at iter 6000 reproduce each other to the printed decimal ⇒ `|mean| > band`
   passed **every** delta. Defaults now spaced by 10⁵ plus a hard `min gap < iter` guard. No committed verdict
   rested on it. Lesson: **put the guard in the tool** — TOOLING had stated the rule correctly for weeks.
   (3) ★★★ **The survivor is 100 % AoE-WINDOW VALUATION.** Ablating `_aoe` (press times, walls, geometries and
   seed identical) collapses the deficit from **+0.2930 ±0.0068 pp to −0.0063 ±0.0048** — the window accounts
   for **102 %** of the parity-free gap, so burn model, search and tail lattice are excluded in one
   measurement. What remains is **within-window placement**, filed as the **Correction-3 candidate**.
   ★★★ **P7.14 SOLVED IT (07-25, PHASE7 §5.18; RULES §9 Correction 3 promoted CANDIDATE → CONFIRMED; no
   `index.html` change).** The entire surviving boss deficit is **ONE Arcane Explosion cast**, and the
   "model packs against the END, sim wants it 10 s earlier" reading is **RETIRED** — the model's press-time
   curve is *flat to the decimal* across the window interior (translation invariance, correct) and spikes
   only **at the wall**. Mechanism: a press inside an AoE phase fires **~0.58 s late**, the AE lattice is
   **hard-anchored to the phase start**, and the APL stops casting AE at the phase end — so a window placed
   **flush** (`press + dur == phaseEnd`) has its slipped tail **clamped** and loses its last lattice point,
   where an interior window's slip is self-cancelling. **One-sided ⇒ a ranking error.** Closed on both
   sides: an assumption-free aura-state ledger over the two combat logs gives **+2995 damage** vs measured
   **2919 ± 35** (**102.6 %**), and the model's own artifact cusp is **+368** at exactly `P = phaseEnd −
   dur` (bit-equal at other phase ends; non-additive across keys — AP alone −29, Gem alone −68, Zerk alone
   0, all three +368). **368 + 2995 = 0.347 pp** = exactly the observed sign flip. A **pre-registered
   predictive sweep** confirms it and **all three falsifiers fail to fire**: sim pct vs the model's champion
   is flat at +0.2926/+0.2943/+0.3019/+0.2960 for P ∈ {126..129}, the 129→130 step is **370 SEM** and
   **98.5 % of exactly one cast**, and all five wall-jitter variants put the cliff at the same P (sd 0.0018)
   ⇒ the snap is **δ-invariant**, as a phase-start-anchored lattice requires. Method note: the decomposition
   cost **zero extra sim runs** — it fell out of the `SIMLOG=1` logs captured for the legality gate (new
   TOOLING technique: **walk the aura stream and pool damage per state; crit cancels**). ⇒ **Phase 7's
   diagnostic mandate is DISCHARGED — every residual deficit in this corpus is explained.** What is left is
   an **engine fix, not a diagnosis**. ★ **THE FIX IS LANDED (07-25, PHASE7 §5.19).** Not via the two
   guards §5.18 named — flipping `:855`/`:820` drags the ramp bookkeeping and the AE step function with
   it — but via an explicit AoE case in the event-firing branch plus a per-segment **anchoring test**: an
   AoE lattice is EXACT iff the phase's first cast boundary *is* the phase start (after an intermission,
   or at the pull), and only then does a press snap deterministically; after a **burn** phase the lattice
   inherits the AB stream's arbitrary phase and the phase-averaged slip stands. **Scoped by the same
   determinism criterion §3b.1 uses, not by segment type.** Every measured press-time cell moved toward
   the sim and the DUEL sign flipped (`−0.0536 pp` wrong → `+0.0081 pp` right, sim `+0.2930`); magnitudes
   undershoot because the residual is the known **PHASE8 back-edge over-credit**, which is deliberately
   unimplemented. Blast radius is provably one preset (KT is the corpus's only `aoe` phase) and
   `plan-diff` over the 16 sub-200 s cases is IDENTICAL. **Landing gate (PHASE7 §5.20):** exact-match
   **24/25 — Kael'thas only**, the exact predicted radius, golden re-recorded; and because
   `GOLDEN_DEFAULTS` runs KT at **haste 0** while every piece of the fix's evidence is at **haste 195**,
   it was re-duelled at the golden's own config (5 base seeds × 9 wall-jitter variants, 90 sims): model
   **+0.058 pp**, sim **−0.0067 ± 0.0047 pp** = −0.14 DPS ≈ **1/75 of a cast**, ~19× inside the boss
   band. So the change is a **0.29 pp win where it was derived and a sub-noise wash at the golden** —
   landed on that basis. ⚠ Generalisable: Δ = `max(1.0, 1.5/m)` is haste-dependent, so **wall-clipping
   conclusions are not haste-portable**. Plus 15 class cells whose floor is complete (top
   excess 0.1653 pp) and which carry no AoE window, so this finding does not touch them.

   ✅ **P7.15 CLOSED (07-25) — the harness WAS measuring the wrong plan, but the deficits are real.**
   `xval.mjs` fed the sim **press intents** where the tool/goldens/exact-match all speak **fire times**.
   Now `EMIT=fire` by default (floored fire times = the plan the tool prints); `EMIT=intent` reproduces
   pre-07-25 rounds; the value is stamped on every header and on `XVAL-DONE`, and **a log with no `emit=`
   is `intent`**. Priced corpus-wide over the banked 60 plans, the alarm deflated hard: the first
   "123 s of downtime burn" was **92 % legitimate CLIP** (a buff *tail* into a wall is already charged);
   true ARTIFACTs are **2 plans (3 %), 10.0 s**, and because fire times are **floored** only **18/60**
   specs change at all. **★ The 3 surviving over-floor deficit cells are not among the 18** — bit-identical
   under both conventions — so the boss deficits are **model signal, not harness fiction.** ⚠ Two things
   to carry forward: the artifact's sign is **inverted** (intent *inflated* two plans ~0.26 % via an MQG
   cooldown cascade past the fight end), so an inflated **borrowed** plan can manufacture a **phantom
   deficit**; and the 2/60 rate is pre-P7.14 and expected to rise. **⚠⚠ Every boss table in ACCEPTANCE is
   `emit=intent` and must be re-gathered under `emit=fire` before any verdict.** (PHASE7 §5.22 ·
   TOOLING lesson 3 · ACCEPTANCE harness-fidelity block.)

   ✅ **Three methodology blindspots named and CLOSED with instruments (07-25).** (1) **Identity filter
   first** — price nothing before checking whether the input differs at all; landed as **`DPS_CACHE`**, a
   lossless content-addressed sim cache (runner determinism *verified*: 2152.4 ×3 at fixed seed), keyed on
   runner `path:size:mtime` + gear-export content hash so a rebuild self-invalidates, with
   `DPS_CACHE_VERIFY=1` to re-sim and exit 2 on mismatch. ~70 % of a boss re-gather now costs zero sims.
   (2) **The acceptance test is purely RELATIVE** and cannot see uniform error; the absolute anchor is
   `tools/brute-grid.mjs --tool`, now run as a standing check — **6/6 PASS** across `isc+scb` and
   `mqg+skull` at h0/h195/h300 (worst Δ −0.062, inside the 0.15 pressability slack), plus an AoE-window
   fight. (3) **The harness shares `simulate()` with the model** (a correlated-error risk that already bit
   once, as the Vashj phase-drop bug, and which `EMIT=fire` *increases*); paid for with a
   `simulate()`-independent **ARTIFACT GUARD** — pure arithmetic on the emitted spec + the preset's own
   `_intermissions` table — that must read 0 under `emit=fire` and stamps `artifact=N` on `XVAL-DONE`.
   (TOOLING lessons 5–7 · DIARY corrections ledger.)
   What landed earlier: three sim-gated scorer terms (RULES §3b — press-snap
   slippage at hard edges; externals snap to the cast lattice, which tempers the IV@0 "ramp
   compression" credit; ramp casts snapshot buffs at cast START), two search passes (polished CS
   chain-geometry family; drop-one-use escape), the KT AoE harness gap closed (genapl `_aoe` →
   Arcane Explosion + `--targets`), and the MEASUREMENT locked to the model-matched protocol
   (**var 0.5** + wall-jitter on boss tables + 10–60k iters — TOOLING; do NOT regress to var10/var0
   or 150k+ iters). Goldens regenerated under the recalibration — every move gated (model ≥ old on
   all 25, CRN sim net-positive, wall fights +0.3–0.5%). **Deferred to the next round (PHASE7
   §5.6):** cross-haste candidate pooling (closes 19/19 probed search misses; 2–3× solve cost),
   the Al'ar opener residual, the isc+skull straddle-credit and scb+skull count-trade margins
   (≤0.2% at the corrected metric — re-measured by the running campaign first).
   **§5.11 (legibility) is now LANDED** — `canonicalWindowOrder` at the three `resolve(...)` sites plus
   a second anchor base in the packing pass; two goldens moved (Hydross = bit-exact tie, now
   cluster-first; `4:00 lust 0:05` = strict +0.0067 eff casts), 23 byte-identical, suite 25/25.
   **Two phases now stand open behind Phase 7:** `docs/PHASE8.md` (the B2 model-vs-sim ranking error — the
   "joint interaction" framing is **withdrawn**, round 1 traced it to a retimed trinket press and round 2
   established **THE FLOOR LAW** + two harness input errors; §8 falsifies the SP-under-haste candidate.
   **Round 3 ran and closed** (§11–§13): the law generalizes to **one window, two sampling rules** —
   value buffs read at cast completion ⇒ `floor`, haste buffs read at cast *start* and frozen ⇒ `ceil`
   (`cast.go:138`/`:187`), halving the residual and killing the "haste buffs are exempt" claim. Applied to
   the B2 pair the whole quantization family has the **wrong sign**, so **B2's target rises 0.38 → 0.445 pp**
   (§13.8; §12's opposite verdict was a sign error, corrected in place). §13.9 then **excludes per-buff
   valuation entirely** — signed residual positive on all 6 buffs × 13 hastes (a 0.369 pp *level* that
   cancels in B2, since both plans carry identical window multiplicities) with **no leg's haste slope
   clearing its own noise**; generous scaling reaches 0.048 pp of 0.445. **B2 is a layout property**
   (window×window or window×kill). **Round 4 ran and closed** (§14, pre-registered before it ran): the
   stacked-haste / **GCD-floor** probe. **F1 PASSES and is the round's keeper** — three sets cross the
   floor at three different ratings (64.25 / 215.05 / 243.45), each bracketed to one rating point, and the
   sim's marginal kinks inside the same point the model's does in all three, so `max(1.5/m, 1.0)` binding
   at `m ≥ 1.5` is now **certified against the sim** (RULES §2) and the floor leaves the suspect list.
   **F3 FAILS** — `ΔI(IV+MQG+Zerk) = −0.259 ± 0.032 pp`, negative at 13/13 ratings, worth **−0.114 pp** to
   B2 against a +0.445 target; retired same-day, and explained as §13.9's per-buff under-credit **failing
   to stack** (`ΔI ≡ resid(S) − Σ resid(singles)`; it is a *per-window* constant, so it cancels in B2 for
   the same multiplicity reason). Also banked: **`--var 0` quantizes to integer casts** and is unusable
   for marginals (TOOLING). **Window×window is out — window × kill is the sole survivor**, and §15 must
   pre-register it: it is the one axis every probe so far is structurally blind to, since all of them
   measured steady-state fights that never end. **Round 5 ran and closed** (§15, pre-registered): the
   **position sweep**. **F2 passes exactly** — the model's haste marginal is flat in press position to
   **0.0000 pp**, so the position-independence axiom (`index.html:926-928`) is implemented to the last
   digit. **F4 FAILS** — `Σ = −0.063 pp` (R=40) / `−0.109 pp` (R=70) where B2 needs positive; the two
   "live" position flags are both **clip-boundary snap** in a last-second band **neither B2 plan enters**
   (tails of 9 s and 7 s). Window × kill retired same-day — the clause's fifth firing — which leaves **B2
   with no candidate expressible in a single-buff fight at all**, so the phase switches instrument class
   to the **two-plan differential** (§16: walk the five-move path between the two real plans, both
   directions, and localize the residual to a move). **One finding banked, and later WITHDRAWN as a model
   defect:** the sim pays ~**+0.079 pp** for haste covering the **opening ramp** (6/6 haste legs, both
   hastes) where the model paid 0.0000. That was read as "a genuine defect in that axiom" — **and it is
   not.** `tools/ramp-marginal.mjs` shows the model's ramp credit is *exactly* floor-slack recovery: **0.0000
   floor-free** (which the algebra proves is the right answer — F5's sweep was single-buff, hence floor-free)
   and **+0.33…+0.41 pp when the floor binds**, with a Berserking control at exactly 0.0000 and a hand
   derivation agreeing to +0.296 vs +0.27 casts. The model is structurally correct; the sim's premium is a
   residual with no identified mechanism ⇒ a **sim-setup audit trigger**, not a patch (RULES §3, PHASE8 §7).
   It is not B2 either: the only ramp-coverage difference between the plans is `Zerk@0` vs `Zerk@6` on a
   ramp `IV@0` covers in both, worth 0.009–0.027 pp.
   **Rounds 6 and 7 ran and closed, and between them they LOCALIZED B2 COMPLETELY** (§16.5, §17.5). Round 6
   walked the five-press path between the two real layouts in both directions: **G1 reproduces §1's headline
   to four digits** (sim +0.3602 %, model −0.0204 %), and **G3 fires** — one move, the **trinket pair**,
   carries **−0.325 pp of the −0.396 pp gap (82 %)**, same-signed both ways, against a −0.02…−0.06 pp
   background. Round 7 then split the pair by parking `MQG` at 100 s so every intermediate clears the
   category-1141 lockout: **path additivity holds to 0.0007 / 0.0003 pp**, the **`Icon`-only step costs
   +0.0044 / +0.0027 pp — `Icon` is EXONERATED** (§15.5's exact 0.000 survives context), and the entire
   defect sits on **one press: `MQG 100 → 202`, arriving on `IV@202`** — **−0.2106 pp / −0.4068 pp, 53–103 %
   of the whole gap**, and carrying essentially all of the context asymmetry (0.196 pp of it). Stated
   plainly: **the model pays +0.26…+0.36 % for moving `MQG` onto `IV` at the end of the fight, and the sim
   pays ≈ 0.** §18 is pre-registered and crosses {stacked, solo} × {mid-fight, at the kill} — legal at last
   because `Icon` can now be switched off — to decide between **haste-multiplier composition** and
   **fight-end truncation**. Three method by-products banked in TOOLING: **drift magnitude is not a legality
   test** (two illegal plans retimed by only 2.0–2.1 s, under one cast interval — run the a-priori structural
   check FIRST), the **cooldown chain** (`AP@[8,188]` is exactly one CD apart and cannot execute: 9.06 ⇒
   189.51), and the **cascade gate** (a press moving slides every downstream boundary-snapped press — `IV#3`
   by 1.00 s — so *"hold the rest fixed" is a property of the request, not the execution*; differential
   contrasts must now verify the controls held to < 0.30 s).
   **Round 8 ran and answered §18's question: it is the STACK, not the kill** (§18.6). With `Icon` off, `MQG`
   is the only on-use trinket and the crossed design becomes legal. **K1 reproduces the P3 step (−0.367 pp)**,
   but so does **K3 — the identical press position with 78 s of runway (−0.298 pp, 81 % of K1)** — while a
   **solo** haste buff pressed *at the kill* is priced correctly (**K4 +0.0115 pp**; model and sim agree to
   0.012 pp). **J2 (fight-end truncation) is falsified**, so the fix is not in how the integral terminates at
   `T`; K1−K3 = −0.069 pp is a small residual kill term. K2 (stacked on `BL`) was contaminated by the cascade
   gate and carries no verdict, leaving one J1 clause untested. **The combat log finally names a mechanism:**
   the stacked arm casts at **exactly 1.000 s for twenty seconds — the GCD floor** (unfloored `IV×MQG×gear`
   = 0.9896 s, so ~1.05 % of the stacked haste is clipped), the sim's window census is **exactly symmetric**
   (solo `MQG` +3 casts, stacked `MQG` +3 casts, fight total 230 = 230), and `AP`'s 15 s value window covers
   **15 cast starts in both arms** — the floor law surviving a case where Δ itself was manipulated. The model
   books **+1 net cast (229 → 230)** instead. The scorer is **not** missing the floor; the §19 hypothesis is
   ≈ +0.17 pp of banked fractional cast plus ≈ +0.12 pp of `AP`-packing credit, and per CLAUDE.md that is a
   **sim-setup audit trigger** to discharge before the model is blamed.
   **Round 9 discharged that trigger, and the answer was PRESS PHASE: `--var` dithers DURATION, not press
   phase**, and the treatment re-phases its own controls (a supposedly-fixed `BL` fires 162.05 vs 163.26),
   so a single-phase contrast is confounded at ≈0.3 pp — exactly the size being hunted (§19.7). But the
   pre-registered **L0** leg then δ-averaged the sim over a full cast interval and **phase is worth only
   23 %**: mean `Δresid` = **−0.2280 pp** of the −0.2978 at δ=0, so **L0b fires — the defect is REAL** and
   §19.1's candidate stands (§19.8). Two by-products matter more than the verdict: `sd(d_sim)` = **0.049 pp**,
   so **single-phase contrasts are NOT noise** — B2's 0.40 % and the acceptance low-haste slack stand on their
   own — and `sd(d_model)` = **0.017 pp** *certifies* `index.html:762-785`'s slip-invariance claim, which makes
   this a **level** error the scorer commits equally at every phase (no re-timing fix can close it).
   Phase-averaged the sim **agrees on sign** but is **5.3× smaller**, so the target is "the model over-credits
   a stacked press ~5×", not "the model inverts a ranking". §19.7.5's **required cross-check then agreed**:
   aligning the *model* to the sim's executed presses (the second, independent phase removal) gives
   **−0.2122 pp** against L0's −0.2280 — gap 0.016 pp, tolerance 0.10 → `ROUTES AGREE`, so the residual is a
   property of the scorer and not of either reduction (§19.9). That leg had to suppress `index.html:785`'s
   `slip = prevInterval/2` — an executed time has already snapped, so scoring it through the stock engine
   double-counts the snap by ≈0.72 s, *larger than the confound being removed*; done by patching the engine
   text **in memory** (the page's own Worker trick), never on disk. Corroborations: `maxMove` 0.006 s, residual
   spread **halved** (0.024 vs 0.047), and casts `230→230` at every δ — confirming §19.7.3's "+1 cast" was a
   symptom. **L1 then ran and reframed the round (§19.10): NEITHER falsifier fires.** Across
   `R ∈ {0…400}` the model reproduces the *whole* haste dependence of the stacking contrast — sign flip and
   slope (`d_sim` +0.40 %→−1.05 %, `d_model` +0.33 %→−1.01 %) — with **mean Δresid −0.045 pp (sd 0.086)**, i.e.
   no average bias. L1b fails (0.116 < 0.15) so **§18.6's floor story is not retired**; L1a fails on *sign*
   (Spearman(clip %, |Δresid|) = **−0.800**) because the residual **peaks AT the crossing** (`R=70`,
   `u=0.9898`, −0.181 pp) and decays once clipping is deep — a boundary **discretization** disagreement, so the
   floor is at most a component. **B2 is therefore a crossing-location error, not a level error:** the sim's
   sign flip is in `(53,70)`, the model's in `(70,120)` — one grid step late. And gating on the sim's own
   0.049 pp noise, the model **inverts nothing it can resolve: 6 AGREE / 0 DISAGREE / 2 ties**, both "ties"
   being `d_sim` = −0.008 % and 0.000 % — *hand-computed here; instrumented later in §19.14, which
   reproduces it exactly and establishes that it is a claim about the **PRESS**, not about B2.*
   §19.8's "over-credits ~5×" was read at `R=70`, the single most
   adversarial haste in the range. Target for **L2**: explain the *position of the sign flip*, not the
   magnitude (**+0.18 pp just past the crossing, ≈0 by `R=200`, absent below**). Instrument 20/20; two
   defect-class lessons in §19.10 (an over-rejecting materiality guard; a fixture that was unrealistic in the
   very dimension its guard measures). **L2 then closed the truncation candidate (§19.11): L2b FIRES.**
   Sliding `T` across one full stacked cast interval at `R=70`, the var-0 `d_sim` swing is **0.0076 %** —
   39× short of L2a's 0.30 bar and exactly **1.0× the DPS print quantum's swing floor**. The finding is
   stronger than "flat": truncation is **real and large** (per-arm level sawtooth **0.276 % / 0.284 %**,
   flattened to 0.045 % / 0.042 % by the ±3 s dither) but **97.3 % COMMON-MODE** — the MQG window ends ≥98 s
   before the kill and no haste buff is live in either arm after `t≈222`, so both approach `T` in the same
   haste state and §19.1's required *differential* terminal phase does not exist. The gate's cast accounting
   agrees independently (**230/230** at three `T`, **231/231** at 301.2 — the arms gain their cast together),
   and mean `Δresid` at var 3.0 (**−0.1796 pp**) is **24× the entire var-0 swing**, so truncation is excluded
   by size as well as by mechanism. Cross-leg reproduction is exact (L2's var-3.0 `T=300` row ≡ L1's `R=70`
   row; the two gate records are byte-identical across independent runner invocations). One new clue on the
   surviving suspect: at `T=301.2` the model counts **230→231** where the sim counts **231→231** — a one-cast
   discretization disagreement at the very `T` the sim gains a cast. **§19.10's target stands, minus one
   suspect.** Instrument 32/32 green first run, and it carries the round's sharpest lesson: **a verdict whose
   evidence is an ABSENCE needs a positive sensitivity control** (a flat reading and a blind instrument are
   the same number, and the blind one exits 0).
   **L3 then delivered the round's biggest result (§19.13): L3b AND ★ L3c BOTH FIRE.** The K2 repair — MQG
   stacked onto **`BL`** instead of `IV`, with a matched solo reference 30 s earlier — reads `Δresid` =
   **+0.0159 pp** at `R=70` (bar 0.15), so **stacking onto `BL` is priced correctly** and §18.6's *"the model
   mis-composes two overlapping haste multipliers"* is **too broad: the distinguishing feature is not
   "stacking".** And across the whole sweep `max |Δresid|` = **0.0396 pp** with mean **−0.0187**, only
   **0.0120 pp** from L1's well-clipped mean −0.0067 — even though `BL`+MQG is **floored at every gear haste**
   (crossing at `R = −72`, unreachable) and so **never visits** the crossing where L1 localized the defect.
   The BL residuals nevertheless lie on **L1's own curve**, so `Δresid` is a function of the **clip fraction
   alone**: **K2 and K3 unify and buff composition is RETIRED as a separate suspect.** What survives as B2's
   cause is §19.10's single finding — a **crossing-location** error, the model's sign flip one grid step late.
   Secondary L3d: the repaired like-for-like number **+0.0352** vs round 8's voided **+0.0402** — the
   contamination was **real but immaterial to the answer**. Both scoring columns agree on all three verdicts;
   controls all green (reproduction 8/8 exact, sensitivity re-derives −0.1808 = 3.6× the L3b bar, and a new
   **CONTROL 3** asserting each arm is byte-identical across the two pair records that contain it). Instrument
   **30/30 first run** (13 derived fixtures with *aimed* perturbations; the headline is **`blindl1`** — the
   sensitivity control's own control, a well-formed L1 rewritten to see nothing, which must be refused). It
   also caught a defect class **in our own pre-registration**: §19.12's additive reference-invariance is a
   **NEAR-ALGEBRAIC control** — computed from the same three per-arm numbers as the thing it checks, so it
   cannot fail for a measurement reason. Kept but relabelled WEAK; the substantive form (re-read the
   falsifiers against the *other* solo reference) added and passing.
   **★★ ROUND 9 CLOSES (§19.14) — and closing it found a false pass in the round's own headline.** §19.10's
   *"0 DISAGREE"* rank census had **no script, no fixture and no control** — computed by hand, quoted into this
   file and DIARY, and about to carry a phase-level synthesis, despite being exactly the ABSENCE shape §19.11
   had just warned about. It now has an instrument (`r9census.mjs`, battery **18/18**) which reproduces the hand
   count exactly on **both** scoring columns, and whose §19.11 sensitivity control is **real data, not a
   fixture**: round 6's G1 endpoint pair (`d_sim` **+0.3602** vs `d_model` **−0.0370**, **3.7× BAR**) must read
   DISAGREE or the run refuses to grade. **★★★ That makes the scope measurable rather than rhetorical:** the *same
   census* returns DISAGREE on the two-plan pair and 0 DISAGREE on the isolated press at all 8 hastes, so
   **B2 is real AND no single press inverts anything — both, without contradiction.** A per-press residual below
   the sim's resolution still flips a resolvable *plan-level* ranking, because §17's path additivity (0.0007 pp)
   sums it against the terms the model gets right. §19.10 must **not** be read as "B2 isn't real." The
   confound-removal chain now reads **−0.396** (two plans) → **−0.4068** (one press, ctx B) → **−0.3672** (Icon
   off) → **−0.2978** (truncation out, J2 falsified) → **−0.2122** (press phase out) → **−0.1808** (L1's `R=70`,
   the sweep's *peak*, mean **−0.045**). All four legs' pre-registered questions are answered. **The one
   surviving B2 suspect is the crossing-location error** (sign flip one grid step late, ≈ 20–50 rating
   too pro-stacking); the strongest candidate for a round 10 is **P3's context asymmetry** (§17.5: −0.2106 ctx A
   vs −0.4068 ctx B — **0.1962 pp** on the same press), which the clip fraction alone does not explain
   and `docs/PHASE9.md` (**performance/refactor**, user-reported CPU cost; every change there is gated on
   byte-identical plans. **LANDED 07-25 — two changes.** (i) the **groom-loop early exit** (§5.12):
   rounds ≥1 are the same deterministic function of `s`, so a no-op round proves the rest are no-ops —
   `PLAN-DIFF changed=0`, DUEL no cells, **−10.1% CPU** (7:20 −12.8%, KT −12.5%). (ii) **`groupSeeds`**
   (§5.14): the missing seed class that closes the `5:40 lust 0:05` SEARCH-MISS root-caused in §5.13 —
   chain entrants spaced by the kit's own cooldowns, with a long-cd track allowed to decline the opening
   group (now RULES **§4b**). Corpus differ **IDENTICAL ×25**, and that is the *correct* result: the
   sweep holds the PRNG seed fixed, so it is structurally blind to a robustness fix — the seed axis shows
   **2/6 → 6/6** with zero regressions on a 3-case × 3-seed control. A top-K score cut was measured and
   **rejected** (polish-best at raw rank 13/40 and 12/12; top-3 loses 8087.794 corpus-wide).
   **Netted, both together** (the interaction gate neither had alone, swept back-to-back vs `HEAD` on
   idle cores): **−8.5% CPU / −5.3% wall, 25/25 bit-identical** — the groom saving minus `groupSeeds`'
   extra polishes. Absolute CPU is **not** comparable across sweeps (the same pristine engine measures
   695.1 s at `jobs=2` and 635 s at `jobs=3`); only a within-session, same-`jobs` pair means anything.
   The phase's larger deliverable is **§5's iteration gate** — bare-node `plan-sweep` + `plan-diff` +
   the sim-free `plan-duel`, ~16× faster than exact-match on the quick tier — which is what made the
   above tractable. **§4.7** turns the "fewer
   steps" ask into a *pass-firing census* — a pass is redundant iff its input is already its own fixpoint
   on the whole corpus — and **§4.9** records the two dedups that need no measurement at all: polish()'s
   five identical accept paths and the block-shift primitive written twice. **§4.12 corrects §4.3**, which
   had headed the landing ladder: not 3 sites but **12**, "exact" only via a five-step key-order proof
   (backed by a 228,685-test probe, 0 disagreements), and "~20× cheaper" is **backwards — measured 2.9×
   slower**, so the sig-swap is REJECTED and only the *hoist* half lands. The bench that killed it found
   the bigger win instead: **§4.13 — native `JSON.stringify` beats `sigOf` as the memo key** (0.483 vs
   1.400 µs × 1.98M calls ≈ **1.8 s CPU/solve**), retiring the "cheaper hand-rolled encode" item too;
   revised ladder in §4.13.1).
   Background: Phase 6 (the haste-adaptation cross-val, `docs/archive/07-phase6-xval-run.md`) was data-complete: 36
   tables, monoDip=0 everywhere, 167 borrowed-win columns keeping the standing acceptance test
   (`docs/ACCEPTANCE.md`) OPEN; Phase 7's diagnostic (`tools/diagnose-deficit.mjs`) partitioned
   every one (19 search misses / 26 KT-caveat / a few real scorer terms / metric artifacts). History up to here: Phase 5 landed (`docs/PLAN.md` deleted; see
   "Phase 5 — AoE phases cracked" below for the verdict, thresholds, and gates; Phase 4's record is
   below it). Earlier history: Phase 3
   = raid-buff/proc tightening + **deterministic mana & haste helpers**, all shipped without touching the
   scorer/optimizer core (exact-match **25/25**): only-raid-pinnable cooldowns, Drums/PI verified +
   sim-source-anchored, Ashtongue → free-leeway "press anywhere" zones, per-window target-mana chip, the
   4×-Frostbolt haste breakpoint on the timeline, and why-here action-plan reasons. The heavy **in-tool
   finite-mana *mode* stays DROPPED** — the finite-mana *stat weights* (`docs/EP.md`) already answer the
   mana question. The **infinite-mana planner is the product**; keep it that way. Also done earlier: verified
   the tool is correct across gear haste (physics trust-anchored at non-zero rating; the "IV slides out of
   Lust" layout, RULES §5, now EMERGES from the packing pass and sim-verifies **+2%** at h250) and that
   haste trinkets place correctly (MQG/Skull avoid the floored Lust, ride a damage burst for flux). See the
   **Done — gear-haste** entry below. Already done and behind all this: the harness audit (W1), drop-bug
   fix (W1.5), ramp-aware SP shift (W2a → Vashj **4:05/6:05**), AP-cd
   **resolved** (real TBC AP = 180s cd-on-activation; sim's 195s is a wowsims quirk — a known blind spot
   for multi-AP timing; SOURCES / TOOLING ★), the **AoE Potency amplification** (modeled + sim-validated),
   **EP** two-route cross-check + `portfolio-ep`, the **Boss presets** (10 real encounters, tested), and
   the **finite-mana stat weights** (`docs/EP.md`: SP≈Int>Haste 0.96>Crit>MP5>Spirit≫Mana — haste is NOT
   folklore-weak). Findings are the authoritative
   reference in `docs/TOOLING.md` — read its **Methodology** section (model = objective/arbiter, sim =
   calibration) and the ★ drop-bug + stats protocol. The intermission re-gate is **done** (KT +
   4:00-multi both re-confirmed ≥ their alternatives on the fixed rig — see Status). The **AoE crit-proc
   amplification** (Clearcasting → Arcane Potency) is now **modeled** (below). **The finite-mana /
   conserve-rotation stat weights are now DONE** (`docs/PLAN.md` deleted; below + `docs/EP.md`): the real
   gearing weights are **computed** via a wowsims finite-difference on a conserve rotation — **SP ≈ Int >
   Haste > Crit > MP5 > Spirit ≫ Mana**. The infinite-mana layout EP is a ceiling; the mana constraint
   **inflates the regen stats** (MP5 0→0.66, Spirit 0→0.54) and **deflates haste, but only to ≈ 0.96**
   (not the folklore 0.4–0.6 — that's the OOM-idle rotation; a Frostbolt-conserving mage never idles).
   **No plan in flight.** **The model / cast-counting was RIGHT on Vashj; the sim was wrong because of the
   drop bug — fix the sim, don't distrust the model.**
3. **★ HARNESS GEAR CORRECTED (07-25) — the committed cross-val tables are STALE until re-baselined.**
   PHASE8 §6/§7's correction has LANDED (§20): the model cfgs every harness builds now describe the gear
   the sim actually runs — **Tirisfal 2pc (`t5two`) and effective SP 1450**, not the nameplate 1387 — from
   **one** module, `tools/reference-gear.mjs`, **spread** into each cfg (`{ T, hasteRating: h, ...REF, … }`).
   §6 had pre-registered this as "add `t5two` to both cfg builders"; it was really **seven sites in six
   spellings across five tools**, including a bare literal `2241`. Six tools rewired (`xval`, `xval-model`,
   `diagnose-deficit`, `haste-ladder`, `brute-grid`, `explore`); `index.html` and `tests/monotonicity.mjs`
   deliberately **excluded** (§7: neither correction is a model change). Measured before landing: the
   correction is **rank-neutral at the acceptance scale** — same argmax plan at every haste, one 0.011-eff-AB
   reorder at h150 — and moves a plan's score by **−0.56…−0.67 %** (the AP repricing; the ×1.2 cancels in
   `eff` only because `plain` now carries it). **What this means for the ledger:** `tools/xval-results/`
   (36 tables) was gathered with the *old* cfg, so the plans in it were chosen by a slightly mis-specified
   model. Rank-neutrality says the tables are unlikely to move materially — but they are no longer
   *authoritative*, and **§7's decomposition table (`+0.0084 pp` mean bias) predates `t5two` outright and
   must be recomputed before it is quoted again.** Next action: `bash tools/xval-rerun.sh` (restart-safe,
   checkpoints into `tools/xval-results/`, `ITER=6000`) — §6's other half.
4. Baseline check: `cd tests && CHROMIUM=/opt/pw-browsers/chromium node exact-match.mjs` (expect 25/25).
5. The sim harness (`runner` binary, gear export, `wowsims/tbc-new` source) persists in the session
   **scratchpad** and survives `/clear` *within the same session* — check it's there before rebuilding
   (`docs/TOOLING.md`); only a brand-new session needs a rebuild. Sim-gate every golden that moves.
6. Constraints (also in `CLAUDE.md`): commit to branch `claude/wow-arcane-cooldown-optimizer-vbm3as`
   with the configured author/trailers; never leak identity or a model id into `index.html` or any
   pushed artifact; no PR unless asked; keep determinism; keep these docs current in the same commit.

## The goal, and the payoffs it unlocks

**The planner is the goal** (see `CLAUDE.md`): a trustworthy, *generalisable* tool that maximizes the
**effective ABs cast** (`MECHANICS §4`) for any setup and reports that number. Every heuristic (Lust
packing, haste sequencing, downtime avoidance) is a *consequence* of that objective, not a hardcoded
rule — keeping that framing is what makes it generalise to future phases/trinkets/gear/haste.

Payoffs the same engine then unlocks (secondary — the planner's correctness comes first):
1. **Haste-agnostic ideal APL** — emit a cooldown plan that adapts per gear set (the tool already
   re-optimizes per input; this is the live/conditional-APL form).
2. **Setup comparison — NO dedicated feature needed** (user-directed). Run each setup; compare on the
   **absolute** at-kill damage (or the wowsims DPS of each setup's optimal APL), **not** the
   effective-casts count — effective-casts is normalized to *each setup's own* plain AB (it divides out
   flat SP/crit to isolate scheduling), so it's the right *within*-setup objective but hides raw SP/crit
   throughput *across* setups.
3. **EP / stat weights — DONE as two lightweight cross-checking routes** (user-directed; no bespoke
   calculator). The EP is closed-form partials of the effective-damage integral (**model route**,
   `tests/ep-model.mjs`) AND a finite-difference of wowsims on the planner's optimal schedule (**sim
   route**, `tests/ep-sim.sh` + `runner --sp/--crit/--haste`). **Validated** on `6:00 lust 4:20`: crit EP
   **0.697 vs 0.687** (~1.5%), haste EP **1.43–1.47 vs 1.51** (~5%, model lower by the deliberate
   ramp-blindness; the re-opt value moves toward the sim — this setup is on a haste breakpoint). Full
   derivation, envelope-theorem argument, and caveats in **`docs/EP.md`**. **Portfolio EP over a fight
   set** (`tests/portfolio-ep.mjs`): runs the model route over N fights at your real gear and aggregates
   by the **summed weighted absolute derivatives, normalized to SP once** (NOT averaged per-fight EPs —
   that mis-weights short fights). Awaiting the user's 10 phase-fight inputs to produce the phase EP.

## Phase 3 progress (in flight — `docs/PLAN.md`)

- **Task 1 — remove mage-managed-cooldown pinning: DONE.** Only the raid calls (Bloodlust, Drums, Power
  Infusion — `RAID_PINNABLE`) expose a pin control now; every mage cooldown (IV/AP/gem/Zerk/Icon/haste
  trinkets) is the planner's to schedule. `buildBuffList` + `readCfg` both gate on the set (stale
  mage-cooldown times in a saved preset are ignored). Optimizer unchanged, presets pin only bloodlust →
  exact-match unaffected. See ARCHITECTURE "Inputs" note.
- **Task 2 — test + tighten Drums + Power Infusion: DONE (verify + lock; no tighten needed — the model
  was already correct).** Verified deterministically (PI ⊂ BL adds 0 haste, PI-past-BL gains only the tail,
  Drums additive) and at the optimizer level (Tinnitus ≥120s spacing, burst-riding for flux, off-floor
  sequencing at high haste; PI@0's intrinsic BL overlap and Drums-on-near-floored-opener both **proven
  optimal** vs alternatives, not search misses). **The one uncertain mechanic — PI not stacking with BL —
  is sim-source-verified** (wowsims `"MultiplyCastSpeed"` ExclusiveCategory, BL prio 1.3 > PI 1.2; IV uses
  the direct `.AttachMultiplyCastSpeed` so it still stacks). Locked 2 Debugging goldens (`3:20 … drums`,
  `3:20 … PI`); exact-match **25/25** (23 existing byte-identical). No fresh end-to-end APL sim — no blind
  spot on a plain fight, physics anchored (RULES §13, SOURCES, TOOLING).
- **Task 3 — Ashtongue model → LEEWAY ZONES (user-refined): in progress.** Kept ATI **passive** (steady-state
  proc-uptime folded into window haste — real DPS; excluding from scoring rejected). No scheduled press / no
  proc verdict: the scorer averages the proc, and within a true free-leeway interval aligning a press with a
  proc is **never anti-synergous** (user's call), so the honest depiction is just the interval. **Building:**
  `leewayZones` computes, per mobile press, the maximal contiguous interval where moving it ties the champion
  within `QTOL` (position-independent presses only — §3); the timeline draws a **dotted "press anywhere here"
  band** over it; the action-plan Flexible/earliest tag (task 6) reports the same interval. Narrow/sub-cast
  ties are not drawn (§10 tie-break ≠ free leeway). RULES §14. Output-only (timeline + tags) → exact-match
  unaffected.
- **Task 4 — per-window "target mana": DONE.** Each schedule window shows a blue `~N.Nk mana` chip =
  the AB-spam spend over its burst span (195 base × (1 + 0.75·stacks) + 30% under AP, per-cast real
  stacks; AoE casts excluded — SOURCES/wowsims). Tooltip gives casts, the ≈100/s casting-regen offset,
  the net pool-drop to bank, and the gem/Evocation note when it exceeds a pool. Pure read over the
  existing cast list; **mana never feeds the optimizer.** Display-only → exact-match 25/25. ARCHITECTURE.
- **Task 5 — haste breakpoints on the timeline: DONE.** The haste curve now marks two reference lines:
  the existing **+50% GCD cap** (3-stack AB hits the 1.0s floor) and a new **+25% "4× FB"** line — the
  Frostbolt filler soft cap (≈394 gear rating): at +25% passive haste a 2.5s Frostbolt casts in 2.0s, so
  4 fill the 8s AB debuff (filler 3→4). Verified vs Icy-Veins TBC theory + the project's Frostbolt/AB-debuff
  sources (RULES §15, SOURCES). Informational only (the planner never casts Frostbolt) → exact-match 25/25.
- **Task 6 — placement-reasoning action-plan tags: DONE.** `pressPlan` no longer quotes raw damage deltas
  (`deliberate: +N dmg` / `locked here by its cooldown`); every press row now carries a *why-here* reason
  inferred structurally — **Alignment** (press with the raid call / first burst on the Lust window),
  **Flexible** (a `run.leeway` interval → "press anytime X–Y", + the ATI nudge when enabled),
  **Cooldown-timed** (next use ~exactly one cd later), **Cold Snap** (extra IV window), else **Positioned**
  (no slack). Verified across fights (opener, on-Lust-window, CS chains, flexible gem, cooldown-cycled
  bursts). Output-only → exact-match 25/25.
- **Follow-up (user-directed): the haste trend is now proc-free.** The timeline curve + the schedule's
  peak-haste / AB-cast / at-GCD-floor readouts use the **deterministic** haste (`multNoAti`/`capDn`/`castDn`
  — no averaged Ashtongue), and a **second GCD-floor line "cap if Ashtongue"** (≈+40.8%) shows where a live
  proc reaches the cap. ATI stays in the *scored* effective-AB count; this is display-only (RULES §14/§15,
  ARCHITECTURE). exact-match 25/25.
- **Phase 3 is complete** (all 6 tasks + the proc-free-trend follow-up).

## Phase 5 — AoE phases cracked *(COMPLETE — verdict: burn ×M(N) + two corrections; RULES §9)*

The question: is an AoE phase fully a per-cast damage modifier on the phase, or does it change
placement structure? Settled the Phase-4 way — full-5s-grid enumeration (`brute-grid --aoe/--burn`,
two shapes × N∈{2,3,4,6,10} × h∈{0,150,250}) against a burn-×M(N) control, novel classes sim-gated on
the fixed rig. **Verdict: AoE = burn × `M(N)` + exit-re-ramp + SP-dilution** — layouts coincide with
the control at 21/24 points; the divergences ARE the two corrections. All in RULES §9; the scorer was
already exact (no engine change; exact-match 25/25 untouched, KT plan unchanged).
- **Thresholds (h0 reference):** cluster chases the window at M(N)>1 vs co-resident Lust (N*≈2.5),
  M(N)>1.30 vs disjoint Lust (N*≈3.2); SP buffs lag one N-step (`M_sp ≈ 0.30·N·amp`, knife-edge bridge
  at N=4); haste migrates from M(N)>1 (bare window = floor headroom). Flux-predicted BEFORE the grid;
  N=3 confirmed both directions.
- **Gates (all green):** cluster marginal AE-vs-Lust 0.85/1.15/1.77 at N=3/4/6 (var0≡var10); exit-ramp
  retreat +0.497% vs model +0.501% (same-stream CRN); KT double-IV +10.0% both far seeds (model +9.09%);
  AE interval physics multiplicative (log: 1.25/1.136), IV +5.66% vs 5.71%, Zerk stack +0.24% vs +0.30%
  under var10 (var0 = exact-tie quantization trap, TOOLING).
- **Discovery — Tirisfal 2pc ×1.2 on AB + AP additivity in wowsims** (TOOLING ★, SOURCES): per-cast
  anchor decomposed to the digit; thresholds shift ×1.2 on T5 gear (no class flips; KT robust). Two
  open user calls below.
- KT re-certified: the 1:45 cluster (N=6 threshold case) + double-IV-over-AoE both re-gated with
  `--targets` isolation on the fixed rig; the old "standing model assumption" caveat is CLOSED.

## Phase 4 — understand the optimum, then make the search find it *(COMPLETE — monotonicity certified 0 violations)*

Ran as **A → measure → B → C** (the plan that lived in `docs/PLAN.md`):
- **A · exploration harness** (`tools/explore.mjs`) — **DONE.** Brute-scores every placement of a small buff
  set over a gear-haste sweep (no search → exact optimum), the oracle + rule-finder for the rest. Reproduced
  the theorycraft autonomously (RULES §16) and pinned the coupling: **damage buffs place greedily, haste
  buffs carry the breakpoints — but SP buffs SHIFT those breakpoints** (AP moved IV's exit-Lust from
  ~15→~80 rating). Cap thresholds nailed: 243 / 394 / 789.
- **measure — DONE.** The real ramp gaps: (i) damage buffs on a ramp (model tied, sim docked ≤0.4%), and
  (ii) press timing during ramps (sparse deterministic boundaries — phase-averaging invalid there). Haste
  placement stays ramp-indifferent (theorem + sim, 0.00%).
- **B — LANDED, compromise-less** (user-directed). The exact discrete ramp: cold 0-stack opener + post-gap
  re-ramps, true cast lengths on the board (single source of truth), ramp casts scored discretely at their
  completions (jitter-smoothed), press-snap to real ramp boundaries, integral everywhere else. Haste
  indifference preserved exactly; fixed-layout haste sweep still 0 drops. Full physics battery vs the sim in
  RULES §3. **Harness had to be fixed to gate it**: `ap-cd-at-cast.patch` (real AP-180 in the sim) + the
  runner-provenance trap — see TOOLING; two "refutations" turned out to be harness contamination.
- **C — DONE, certified.** `basinHop` (window-teleport self-consistency guard: the champion's window
  blocks re-based on each other's anchors, each track's natural next cd-tick, and the kill anchor,
  re-polished; iterated with the canonicalizers to a **fixpoint** so the returned plan is basin-stable
  AND canonical), a joint window-move in `polish` (co-pressed clusters cross valleys together), a
  kill-anchored seed, a denser shift ladder (±3/±6 ramp-boundary hops, ±30/±60), top-6 final snaps.
  **`tests/monotonicity.mjs`: 0 violations** across both reference fights, haste 0–150 — and the original
  70→71 bug case now yields the identical stable layout with rising effective casts. The test's tolerance
  is the DESIGNED pressability slack (0.15 effective casts = coPressAlign's castVal/8 "execution beats
  microtiming" trade, which varies with haste); the underlying objective is monotone to float precision.
  Two rounds of golden triage under the strengthening search: first 19 improvements / 0 misses, then the
  fixpoint found deeper basins on 18 more (all strict robust gains) — goldens locked at that final level
  (exact-match 25/25). The search never returns worse than any earlier tool version's plan on any preset.
  **Certified against exhaustive enumeration** (user-directed): on the simplest full-fledged fight (T=80,
  Lust@20, six tracks incl. CS-chain, ~131k-cell staged brute force to 1s resolution) the tool's output
  equals the brute optimum **byte-for-byte** (74.118 eff casts; IV@0 → CS-IV@20 + full cluster@20, Zerk@40
  sequential). Without AP the optimum is a two-layout mirror TIE (damage on either Lust half); AP breaks
  the symmetry toward early, and the sim tilts the same way under kill variance (+0.3% var10) — so the
  earliest-canonical choice (`slideEarliest`) is also the sim-preferred one.
  Search cost: ~20–40s per plan headless (basinHop dominates) — optimize later if the UI feels it.
  **Headroom follow-up (backlog, landed):** `basinHop` gained **ramp-exit anchors** (the first full-stack
  cast after each cold start, read off the champion's own board) — the h160-class "hug the ramp exit"
  descent-valley miss is CLOSED (tool 80.659 > the 5s-grid brute's 80.618: the 1s polish around the exact
  exit out-resolves the grid). Remaining known residuals: the h40/h50 **straddle basins** (IV part-way
  into Lust trading overcap for cluster coupling — a lone-track mid-gap basin no anchor reaches),
  ≤0.033 casts, inside the pressability slack; chase only if a real fight ever lands on that edge.

**UI: leeway bands + reasoning tags PERMANENTLY REJECTED (user decision, post-certification).** A plateau
tie for one press is conditional on every other press staying put — moving it shifts other optima — so
"press anywhere from here to here" over-promises and was cut for good; `leewayZones()` deleted from
`index.html` (git history has it; do not restore). Also decided: NO in-tool exact mode (brute-grid is a
research instrument — generalize its findings into rules); NO finite-mana model (unreliable inputs — the
ramp-aware per-window mana-cost chip on the infinite-mana plan is the ceiling of mana UX). The
haste-graph reference lines stay. **Next: Phase 5 — crack AoE phases (docs/PLAN.md).**

## Done — gear-haste + haste-trinket correctness (this session, user-directed)

The user redirected off the in-tool finite-mana idea (dropped) to **verify the planner is correct with
passive gear haste and haste-rating trinkets, and improve it where it isn't.** Findings + the one change:

- **Physics is anchored at non-zero gear haste.** Rating trinkets (Drums 80 / Skull 175 / MQG 330 / ATI
  145-proc) and passive `hasteRating` share **one** path — additive in the `(1 + rating/1577)` factor,
  then × the %-haste buffs (Lust/IV/Berserking), floored by `intervalOf` — the **same formula
  trust-anchored at h0** (runner plain-AB h0 = 2264.9/944.4, exact). So trinket + gear haste is correct by
  construction; a `--haste N` sweep confirms the interval/floor scale as expected.
- **Haste trinkets place correctly.** The model **avoids** stacking MQG/Skull on the floored opener Lust
  (MQG-in-Lust −9.6k vs the model plan) and instead rides MQG on the **2nd damage burst** (speeding its
  SCB/AP casts — flux, MECHANICS §5 pt 2), beating a lone bare-window MQG (+2.4k). No trinket-placement bug.
- **FIX 1 — the "IV slides out of Lust as gear haste grows" layout now EMERGES** (RULES §5, long
  documented as theory, not realized in the search). As passive rating pushes Lust itself near the GCD
  floor, a haste buff stacked ON Lust overcaps (worth ~0) while the DAMAGE cluster still wants Lust's fast
  casts — so the win is **cluster-on-Lust, IV sequenced/stacked just past it.** The sequential
  window-packing pass now generates two **exit** modes (haste after the window: `exitSeq` sequenced on the
  tail, `exitStack` overlapped at the window end to keep each buff's 2nd cd-tick before the kill) in
  addition to the usual `packIn`. Kept only on a strict robust gain, so **inert at h0** (IV-in-Lust wins →
  goldens byte-identical, exact-match **23/23**) and self-selecting above the breakpoint — no per-haste
  rule. Improves the whole high-haste range in model score, monotonic (only adds candidates).
- **FIX 2 — CS materiality by VALUE not COUNT (what closed the last hold-out, the ~h200 band).** At high
  gear haste the CS-champion carries an **incidental** extra IV parked on the near-floored Lust (worth ~0)
  while CS's real job is to slide a *different* IV fully OFF Lust — but the gate counted IVs, saw the count
  rise, applied the full "adds a use" bar, and vetoed the whole cluster-on-Lust layout back to the glued
  no-CS plan. Fix: trim the champ to the no-CS IV count by dropping its **least-valuable** IV; if that
  costs **< a cast**, the extra IV is incidental → CS is really **repositioning** (sub-cast regime) → keep
  it (RULES §8 last bullet, ARCHITECTURE CS-materiality). **Result: cluster-on-Lust is now consistent at
  EVERY gear-haste level** (h50…h300, 4:00: opener isc@5 throughout; no h200 island). **Sim-verified:
  cluster-on-Lust vs glued = +61/+54 DPS at h250, +53/+55 at h200** (var0/var10, 250k — both agree).
  Exact-match **23/23** (h0 goldens unaffected — the trim only fires where the exit layout wins). See
  RULES §5/§8, ARCHITECTURE (packing modes + CS-materiality value gate).

## Done — finite-mana / conserve-rotation stat weights (this session, user-requested)

The real **gearing** stat weights, computed (options **B + C** of the deleted `docs/PLAN.md`; the
infinite-mana layout engine stays default and untouched — exact-match **23/23**). We did **not** build the
in-tool second engine (option A) — the plan gated it on wanting an interactive conserve planner, which
wasn't requested; the deliverable is the *numbers*, cross-validated, + the harness + docs.
- **Harness:** `tools/genconserve.mjs` (conserve APL — AB-spam in burn windows, Frostbolt filler below a
  mana threshold, Evocation, and **`autocastOtherCooldowns`** so Innervate + Mana Tide actually fire), the
  runner extended with **`--int/--spirit/--mp5`** (`tools/wowsims-patches/runner-main.go`),
  `tests/ep-finite.mjs` (sim finite-difference, option B), `tests/mana-value.mjs` (analytic value-of-mana,
  option C), `tests/finite-weights.json` (locked numbers).
- **Result (300s single-target, SP=1):** **SP 1.00 · Int 1.08 · Haste 0.96 · Crit 0.79 · MP5 0.66 ·
  Spirit 0.54 · Mana ~0** — vs the infinite ceiling on the *same* schedule (Haste 1.44, MP5/Spirit **0**,
  Int 0.56). **Order: SP ≈ Int > Haste > Crit > MP5 > Spirit ≫ Mana** (`docs/EP.md`, RULES §12).
- **The headline correction:** haste is **not** the weak stat for a *conserving* mage — the "0.4–0.6"
  folklore is the **OOM-idle** rotation (pure-spam haste EP **0.03**); with Frostbolt filler the mage never
  idles and haste stays **≈ 0.96**. Cross-validated three ways: the conserve rotation and the export's
  **own native wowsims rotation agree** (haste 0.96 vs 1.00; DPS 1916 vs 1969, −2.7%), and the analytic
  value-of-mana (**~2.2 dmg/mana**) brackets MP5. Fight-length: haste EP 0.80→0.96→1.02 (145/300/420s) in
  EP terms, but **absolute** DPS/rating is highest on short fights; intermissions push haste ↓, regen ↑.
- **The mana economy is the SIM's, not reimplemented** (option B's whole point): JoW, Mana Tide, Innervate
  (5× spirit), Evocation, Vampiric-Touch (+250 mp5), regen — all fire on the player's real export
  (verified in the combat log). The one gotcha: a schedule-only APL suppresses the external mana CDs unless
  it includes `autocastOtherCooldowns` (−6% DPS if missing; TOOLING ★). **Mana never feeds back into the
  infinite-mana layout optimizer** (the layout-first principle holds; this is a sim *reading*).

## Done — AoE crit-proc amplification (Clearcasting → Arcane Potency)

The runner can now value AoE (`--targets N` + `tools/genae.mjs` AE-spam; `--crit` to sweep crit — see
TOOLING). Findings, all sim-measured on the fixed rig:
- The model's AE scoring **core is exact** (base 392 / coef 0.214 / instant-GCD-bound / linear per-target
  / AP ×1.30, matching `arcane_explosion.go`).
- 6-target AE is **super-linear** — **+8.6% per-target at crit 38%** (and it *falls* as crit rises: +11%
  @10% crit → +7.7% @55%). **Talent-isolation (zero Arcane Concentration/Potency) makes it VANISH**
  (gear on-crit SP procs — Tirisfal 4pc etc. — add ~0), so the effect is **entirely Clearcasting →
  Arcane Potency**, which is **always-present and gear-agnostic** (depends only on crit × N × fixed
  talent ranks). Arcane Concentration procs **per hit** (`talents.go`), 3/3 Potency = **+30% crit**
  (sim-confirmed via the combat log), so more targets ⇒ more Clearcasting ⇒ Potency up on more casts.
- **Implemented** (`index.html`): `TALENTS = {arcaneConcentration:5, arcanePotency:3}` + `aoeCritAmp(N,
  crit)` = `critMult(crit + qCC(N)·0.30) / critMult(crit + qCC(1)·0.30)`, `qCC(N)=1−0.9^N`; applied only
  in the AoE damage branches (`simulate` ~734/795). Single-target returns amp 1 (**no plain golden
  moves**; exact-match 16/16, KT unchanged). It credits **~75–80%** of the sim's measured amplification
  across the realistic crit range — right magnitude, right crit-direction, **never over-credits** (the
  ~20% shortfall is second-order proc-chain dynamics, kept as a conservative margin). Gear on-crit SP
  procs stay unmodeled (negligible for AoE weighting, and transient).

## Status (as of the current work)

- **Customizable timeline + debug export LANDED (07-25, user-requested — UI only, engine untouched).**
  "Unlock timeline for customization" makes the burn-timeline presses drag-editable (release snaps the
  intent to the nearest whole second); the model plan stays visible as dashed ghost bars; a second tile
  row compares the custom layout to the model (Δ% damage + the four headline metrics with deltas, live
  during the drag via memoized `simulate()`); re-locking validates with `repair()` (violations listed +
  flagged, auto-fix offered) and regenerates the activation schedule/copy-text from the
  custom plan. "Debug export" copies input + model output + custom timeline + stats/deltas/validation
  as one paste, including an `evalsched`-ready JSON block (round-trip verified against
  `tests/evalsched.mjs` — identical totals). Full internals: ARCHITECTURE "Timeline customization".
  Exact-match: 25/25 unchanged (the default render path and copy text are byte-identical without opts).
- **Crash fix (user-reported "Page Unresponsive" kills): the engine now runs in a Web Worker (latest,
  user-directed).** The finishing stage of `optimizeAsync` (top-6 polish, `basinHop` fixpoint,
  tie-break/normalizer stack) ran **synchronously on the browser main thread** — ~minutes on long
  fights (KT), which trips the browser's page-kill. Two layers of fix (ARCHITECTURE):
  (1) the finishing stage is an async IIFE with **throttled yields** (`scheduler.yield` /
  `MessageChannel`, ≤ every ~40ms of compute; `performance.now()` gates only WHEN the thread yields,
  never any computed value — determinism untouched); (2) the file is split into
  `<script id="engine-src">` (pure engine) + UI script, and `runOptimize` runs the heavy call in a
  **Blob Web Worker** built from the engine tag's own text — single-file preserved, main thread never
  computes, in-flight runs are terminated on re-run, in-page fallback if workers are unavailable.
  Worker-vs-page plans verified **byte-identical**. Same commit, display honesty (user-directed,
  RULES §3): the schedule/copy-text/press-board print, sort, and group by the **fire-time second**
  (`floor(actEff)`) instead of the intent — an opener burst with intent 0:04 firing at 5.4s now reads
  "0:05", co-rowed with a 0:05 Lust call (this also killed the "0:05 Bloodlust printed above 0:04
  Icon" row-order bug, and replaced the short-lived `snapRampIntent` intent re-snap with something
  strictly simpler).
  **Follow-up (user: "still incredibly slow, can't even copy"):** the sensitivity panel's "what if
  the kill runs longer" hint ran a SECOND full `optimizeAsync` on the main thread after every render
  — minutes of frozen-while-looking-done on long fights. Moved to a throwaway **aux worker**
  (`runOptimizeAux`; never falls back in-page). Verified: main-thread latency ~4ms while the aux
  crunches, Copy works under load. The remaining slowness axis is the **optimizer's own runtime**
  (minutes on 6-intermission fights, basinHop dominates — a known backlog item; the page now stays
  fully interactive throughout).
  **Sensitivity panel iterated three times live, then largely REMOVED (user decisions).** The
  "kill runs longer" lines went arithmetic → plan-anchored → probe-diff (re-optimize at candidate
  lengths in an aux worker, report the actual plan restructure) — and then the user cut the whole
  aux-worker analysis: **"remove the second 'alternative plans' worker altogether — not worth the
  cost."** What remains: the cheap arithmetic **banks-on** line (user-approved) + the squeak note;
  nothing computes after the results render. **The Cold Snap commentary note is also REMOVED
  entirely** (panel + copy text; the schedule's "Cold Snap → IV" rows carry the action; the
  engine's materiality logic that DECIDES the spend is untouched). If a restructure-breakpoint
  feature is ever wanted again, the probe-diff design is in git history (commit 21791d2).
- **Search parallelized across CPU cores (user: "make it faster without losing quality").**
  Profiled KT: 285.7s total, **`basinHop` teleport-polishes = 265.5s (93%)**, seed phase ~10s,
  5.7M simulate calls. Now the page spawns `min(8, cores−2)` pool workers (dumb polish servers on
  transferred MessagePorts; engine-side `poolInit`/`poolMap`) and `optimizeAsync` fans the seed
  polishes and hop teleports across them with a **first-accept-in-iteration-order** reduction —
  reproduces the sequential accept sequence exactly, so pooled ≡ sequential **byte-identical**
  (verified on 2:45 and KT: val 617033.2, identical plan; exact-match suite runs the sequential
  page path and is untouched). **Plus a polish-result cache with orchestrator-side dedupe**
  (`polishCacheFor`/`sigOf`/`teleportRep`, per-cfg WeakMap): polish() is pure, and the
  hop↔normalize fixpoint re-teleports near-identical candidates every round — repeats now cost a
  Map lookup instead of ~0.3–1s (cached entries cloned at accept so downstream passes can't
  corrupt them; both pooled and sequential paths share the cache, so tests speed up too).
  Container (2 pool workers): KT 285.7s → 201s (pool) → **134.4s** (pool+cache) → **83.9s**
  (+ a `simulate()`-level memo — the wrapper over `simulateRaw`, collect=false results only
  (plain number bags, no caller mutates them — verified), keyed `cfgSigOf(cfg)+sigOf(schedule)`
  so pool workers hit despite per-job cfg clones, bounded by wholesale clear at 120k entries;
  the hill-climb's final all-rejections round and the tie-break incumbents are the repeats).
  Scales with cores (~25–40s expected on a typical 8-core; short fights ~2s). Remaining depth if
  ever needed: parallelizing polish's inner shift ladder. The pool commit is suite-certified
  (25/25, byte-identical goldens); cache/memo commits certified the same way. **Hard product
  rule (user): NOTHING computes after the results render — no speculative or anytime refinement;
  what's shown is final.** (This is why the speculative concurrent Cold-Snap comparison was NOT
  built: its mispredict case would keep pool work running past the render.)
- **Every 2-trinket kit brute-certified (user-directed): 20/20 PASS, zero misses** — all six pairs
  from {Icon, Serpent-Coil, Skull, MQG} full-grid-bruted (`brute-grid --pair --tool`) at
  h∈{0,40,160,240} vs the real optimizer. Worst deficits −0.046/−0.051 both at **h40** (inside the
  0.15 slack): the straddle-basin soft spot is **kit-universal**, documented, priced. Record +
  new pair physics (MQG floors like IV; Skull fits-under-cap like Zerk) in RULES §16/§17.
  Haste-ladder instrument (`tools/haste-ladder.mjs`) added: full-grid brute marched 0→300 with
  automatic breakpoint bisection (≤10 rating) + continuous tool certification — the exhaustive
  version of the §16 morphology map; results folded into RULES when each run completes.
- **Honest progress display (user: "at least make the loading bar accurate").** onProgress now
  carries a **stage label**; the engine emits real within-stage fractions banded by the measured
  cost profile (Trying N starts (k/N) → Snapping to whole seconds → Basin-hop (main sweep, real
  sweep fraction) → Grooming → Re-hop & canonicalize (round r, halving bands)), and the
  **No-Cold-Snap comparison** — a genuine second full run — reports as its own labeled pass with
  an honestly RESTARTED bar (the UI resets its monotone clamp on a label change) instead of
  stalling near-done for its whole duration. The stage label rides the Run button's text.
  Display-only; the exact-match harness passes a no-op callback.
- **`basinHop` ramp-exit anchors landed** (the backlog headroom item): h160-class ramp-exit-hug basin
  CLOSED; **Kael'thas moved** to a strictly better plan (+354 robust, `IV@106/126/380`,
  `AP@120/380`, cluster mirrors) and was re-locked. h40/h50 straddle residuals (≤0.033, inside
  pressability slack) stay documented, not chased.
- Planner is deterministic, ~0.4%-accurate, with **16 sim-verified golden regression cases** (green).
- **Done this session — the wowsims harness audit AND the drop-bug fix + full re-validation** (W1 +
  W1.5). Rig rebuilt from `ade9f39` (`-tags with_db`), trust-anchored to `wowsimcli`. Overturned two old
  claims (off-GCD "collision" is a myth → drop the offsets; `SIMLOG=1` combat log exists) and corrected
  the stats protocol (seeds 11/19 are the same sample). **Headline: a real harness DROP BUG** —
  `APLActionSchedule` silently dropped an on-cooldown press (TOOLING ★), the entire Vashj "3-icons-win"
  (it deleted the 4-icon plan's terminal icon). **FIXED** (`tools/wowsims-patches/apl-schedule-strict-
  ready.patch`: gate the schedule on strict `spell.IsReady`). Re-validated all 16 — zero regressions;
  intermission goldens were badly under-executed and recovered **+18..+26** (4:00-multi/KT/Vashj); the
  Vashj 4-icon plan is vindicated on the fixed engine. Exact-match still 16/16 (model untouched).
  **Also found + now RESOLVED: AP's cadence in the sim is ~195s** (`arcane_power.go` starts the cd on
  buff-expire), but **real TBC AP is 180s cd-on-activation** (user-confirmed) — the **model was right**
  (cd180, unchanged); the sim's 195 is a wowsims quirk, so the sim is a known blind spot for multi-AP
  timing (SOURCES / TOOLING ★). **And W2a LANDED:** a coherent-cluster carry in the "Let the
  stacks build" pass now emits the ramp-aware **4:05 / 6:05** Vashj layout (icon@4:05, terminal
  icon+gem+AP@6:05, IV@6:00 stays); only Vashj moved, sim-gated new ≥ old on the fixed engine (+0.8 var0
  / +0.3 var10). So the post-ramp-exit shift (RULES §9, long "not implemented") is now real. Docs are the
  authoritative record; `index.html`/`genapl.mjs` unchanged, goldens still 16/16.
- Recent landed work: cast-rate-integral scorer; timeline redesign; spellpower-overlap forward-slide;
  **known-kill planning** (half-cast kill window); **full docs set** so `/clear` is safe;
  **Debugging-presets UI** (every golden is a live-computed preset off the single `GOLDEN_PRESETS`
  table that also feeds the exact-match suite); **sequential buff-into-Lust packing** (below); **the
  placement / containment workstream** (below — 3:20 +3.6, 5:00 +2.4, both sim-gated & re-locked).
- **Golden set recurated** (this session, user-directed): the two mislabeled plain late-Lust fights are
  now neutral `6:00 lust 4:20` / `5:45 lust 4:20` (kept as clean phase-free packing regressions); the
  **real** encounters were added — `KaelThas 7:00 lust 4:20` (early intermissions + a 6-target AoE +
  a post-Lust intermission) and `Vashj 6:30 lust 5:45` (six intermissions); the `2:40 @150 haste`
  case was **removed** (the IV-slides-out breakpoint isn't pinned yet — don't lock it).
- **Boss presets = the real phase (this session, user-directed).** Added `BOSS_PRESETS` (the 10 actual
  current-phase encounters — Hydross … Kael'thas — length/Lust/phases from the player's logs) as a
  **baked + exact-match-tested** strip ("Boss presets", accent); the abstract regression fights stay as
  "Debugging presets" (muted); the localStorage user strip was renamed "Boss presets" → **"Custom
  presets"**. The three boss encounters that were in `GOLDEN_PRESETS` under abstract names (4:00-multi,
  KaelThas, Vashj) **moved** into `BOSS_PRESETS` (renamed Al'ar / Kael'thas / Lady Vashj), no dup.
  `exact-match.mjs` now locks **both** arrays (23 cases: 10 boss + 13 debug); all reproduce the user's
  pasted plans exactly (they were generated by the tool). **Phase EP** computed over the 10 at the
  0-haste reference (`tests/phase-portfolio.json`): **SP 1.00 · Crit 0.72 · Haste ~1.38** (`docs/EP.md`);
  re-run at real gear haste before acting (haste falls as gear haste rises).

## Icon-count / SP-alignment — RESOLVED: the sim was WRONG (HARNESS DROP BUG), 4-icon plan is correct

**MECHANISM NOW PINNED (harness audit, TOOLING ★).** The artifact is not vague "resume mis-scoring" — it
is a concrete harness bug: `APLActionSchedule` **silently DROPS an on-cooldown press**. On Vashj the
icon@240 quantizes to 242.5 (the [3:30–4:00] exit ramp cast) → its 120s cd runs to 362.5 → the
**terminal icon@360 is dropped** (combat log: queued to 362.5, then no icon aura). So the golden's
"4-icon" plan was really firing **3** icons, missing the high-value 6:00-burst one — *that* is the whole
"−4.2 / drop-the-icon-wins +4.8" (deterministic, stable across independent far seeds). **With the drop
fixed (icon-track prototype) 4 icons = 1576.6 beat 3 icons = 1573.1.** The 4-icon plan is correct — as
the user and cast-counting always said — and the *fix is in the sim, not the model*.

**Old belief (overturned):** "3 icons @ 0/3/6 beats 4 icons @ 0/2/4/6, so the golden is sim-suboptimal."
Wrong: the sim was deleting the 4-icon plan's terminal icon. Do **not** re-open this as an optimizer
task. (Note the earlier "RNG-desync" hypothesis for the +4.8 was *also* wrong — far seeds proved it
stable/deterministic; it's the dropped use.) The drop was fixed + every golden re-validated (W1.5, done —
the drop was systematic, it also lost AP/IV/Zerk uses; no golden regressed, exact-match still 16/16).

- **Cast-counting settles it (the model's method; MECHANICS §3 "score by cast-counting").** Value each
  icon by `(casts it catches) × (multipliers there)`, relative to a bare-window icon:
  - **1 icon @3:00** rides IV@180 (+20% haste ⇒ more casts) **and** AP@180 (×1.30) — **and** Berserking@180
    for the first half of its window (a further +10% haste those 10s, easy to miss). ≈ **~1.5–1.6×** a bare
    icon.
  - **2 icons @2:00 + @4:00** land on bare windows (no IV/AP): ≈ 1.0× + ~0.9× (the 4:00 one a hair fewer
    casts on the post-intermission ramp) ≈ **~1.9×**.
  - **1.9 > 1.6** ⇒ two icons catch more effective ABs. The model agrees: 4-icon scores **+874** over 3-icon
    (≈ 0.39 cast, within `QTOL`). SP is **linear, not exponential** (`cast_damage = (base+SP·coef)·mult`),
    so co-locating icon+gem at 3:00 does **not** super-linearly help — no tipping.
- **So the sim's "3-icon +5.4" is bogus, and it hinges on a single artifact:** icon@4:00 posts a marginal
  **−4.2** in the sim (dropping it *raises* DPS) where cast-counting says it should be **~+5**, like the
  net-**+6.5** icon@2:00. An off-GCD, macro'd buff (fires *between* casts, never clips — MECHANICS §3)
  **cannot** be net-negative with no alignment/cooldown reason. Ruled out this session: clip (ISC is
  off-GCD/instant, wowsims source-confirmed it doesn't touch the hardcast), mana (900k avail, ~100k used),
  cooldown coupling (icon@6:00 fires either way), shared trinket CD (gem uses its own timer), and
  sub-second offset (swept .00→.15, all ≈ 1563.7). The residual is a **sim-setup bug at the intermission
  resume** (how `genapl`'s AB-gating / the runner restarts casting at `seg.end`) — the runner has no
  combat-log flag to pin it. **The model / cast-counting is the referee for intermission-exit placement,
  not the raw sim.**
- **Both prior "fix" attempts chased this artifact and were reverted** (nothing committed): (1) a generic
  "concentrate SP within QTOL" tie-break — over-fired, moved five plain-fight goldens (dropping *useful*
  cold icons worth ~+9 each); (2) a scoped `dropRampCold` "drop the exit-ramp icon" tie-break — reached the
  (wrong) 3-icon plan cleanly but was fixing the artifact. Do not resurrect either.
- **Real, minor, NOT-yet-actionable refinement (separate from the artifact; user-confirmed as the ideal).**
  There *is* a small true gain in shifting a damage/SP cluster that lands right on an intermission-**exit**
  a few seconds later so it dips into **already-built AB stacks** instead of the ramp — e.g. icon@4:00 →
  **4:05** (= 245, so its 20s window still clears the next intermission at 4:25 — do NOT push to 248),
  moving the terminal **icon+gem+AP** 6:00 → **6:05** to make cd room (**the 6:00 IV stays put**; the
  downstream absorbs the shift free), strictly raising that icon's uptime over built stacks. **Sim-checked
  this session (controlled G-vs-user, 50k):** the whole shift is **+0.6–0.7 DPS over the golden, stable
  across var0 AND var10, seeds 11/19** — small but real and consistent, so it is NOT washed out by the
  exit bug (both plans share the same resume; the shift is the only diff). The blocker is the **model**:
  it's ramp-blind (steady 3 stacks), so it can't *see* that 4:00 sits on a rebuild ramp while 4:05 doesn't,
  and can't produce the layout. Needs a **ramp-aware exit** tie-break (shift a damage/SP press off an
  intermission-exit second onto built stacks when its window still clears the next downtime). Small
  (+0.6); do not prioritize over the payoffs, but it's now a *verified* gain, not just a hypothesis.

## DONE — placement REASONING annotations (Phase 3 task 6)

**Landed.** `pressPlan` (~3271) now emits *why-here* reasons — Alignment / Flexible (leeway) /
Cooldown-timed / Cold Snap / Positioned — replacing the raw `deliberate: +N dmg` / `locked here by its
cooldown` deltas. The Flexible reason reuses the `leewayZones` interval (task 3), and the ATI "nudge onto a
proc" rider appears on flexible rows when Ashtongue is enabled. Output-only (exact-match rebuilds from
`scheduleRows`), goldens untouched. Original spec kept below for reference.

Replaced the copy-as-text / schedule tags that quoted raw damage deltas — `deliberate: +N dmg vs one press
at T`, `locked here by its cooldown` (`pressPlan`, `index.html` ~3082) — with a short **why-here reason**
per press. Those deltas don't help the reader; the reasoning does (it's the "trustworthy" goal). This is
**output-only** and the exact-match suite ignores these tags (it rebuilds the plan from `scheduleRows`,
setup+windows+times only — `tests/exact-match.mjs` ~63–78), so **it does not touch goldens**. Reason
categories, from the user's Vashj 6:30 worked example (map each press to one):
- **Cooldown-timed** — "used here so the cooldown comes back in time" (for the 3:00 / 6:00 burst). For a
  press whose second is set by its own cd feeding a later scheduled use (opener IV / AP / Zerk / Icon).
- **Alignment** — "used here to align with the other buffs [of this burst]." For a press co-located onto a
  burst it strengthens (the opener gem).
- **Count-vs-align tradeoff** — "2 unaligned uses here and @4:00 beat one at 3:00." State the spread call
  the planner resolved (the icon-count decision).
- **Flexible / earliest** — "can be pressed anytime from now to X:YZ." When a press is bound only by "be
  ready for the next use," report the slack; `X:YZ = nextScheduledUse − cd` (clamped ≥ now). Not triggered
  on Vashj, but the general case (RULES §10 earliest tie-break) should say so.
Keep the Cold-Snap `csNote` (held / spent) and the squeak note — those already read as reasons. Infer the
category **post-hoc** from the schedule + cooldown structure (co-pressed? is its cd the binding constraint
on a later use? does it have slack before its next use?). Grounding: `pressPlan` ~3082, `scheduleRows`
~2757, copy-text handler ~2819, on-page render `renderSchedule` ~2795.

## Also planned

- **RESOLVED — the "model over-values SP-count vs concentration" thesis: the bias was RAMP-BLINDNESS,
  and Phase 4·B fixed it.** The 2:15 far-Lust case re-examined on the fixed rig with the exact-ramp
  model: the model now agrees with the (old, correct-in-direction) sim — 1 aligned icon beats 2 naive
  icons (model +0.16 casts; sim +0.1% var0 / +0.2% var10) because the naive icon@0 sat on the pull ramp
  the blind model over-credited. Better still, the tool's own output — a **double-dip** (both icon+gem
  uses, opener + terminal, Lust left mostly bare) — beats BOTH by **+0.4% var10, sim-verified**. Vashj's
  4-icon side of the thesis had already resolved as a harness artifact. Case closed: SP crediting is
  correct, no tie-break needed, and the old §4 far-Lust "limitation" is retired (RULES §4).
- **Coherent intermission/AoE handling** (`RULES.md` §9): make placement/tie-break passes downtime-aware
  so a window doesn't *usually* begin in a dead zone — as a **strong default, not an invariant** (pressing
  early into downtime can be right when it's the only way to get a cooldown back for a bigger later window;
  the effective-AB count decides). Amplifies the icon tie-break above (intermission ramps make off-haste
  SP-buff windows even weaker).
  - **Half DONE — the "don't *begin* in the dead zone" half landed** (`dodgeDowntime`, this session). A
    final normalizer slides any press whose window begins inside an intermission to the exit, model-neutral;
    4:00-multi's Cold-Snap IV 3:47 → 3:49 (var0 exact wash, var10 +0.2, seeds 11/19; only mover). See RULES
    §9 / ARCHITECTURE.
  - **DONE (Phase 4·B) — the post-ramp-EXIT devaluation, solved in the PHYSICS, not a tie-break:** the
    exact discrete ramp scores the slow exit casts truthfully (damage at completions) and the press-snap
    lands exit presses on the real sparse boundaries — so a damage window on an exit ramp is docked for
    exactly the completions it misses, automatically. The regenerated Vashj golden (its damage buffs
    stepping past the exit boundaries, +0.9 effective casts) is this fix landing; the exit-delay class is
    sim-confirmed +0.39% on the fixed rig. See RULES §3.

**Done — the PLACEMENT / containment workstream (this session).** Overlap is interval **containment**,
not start-coincidence (RULES §11, MECHANICS §5 pt 5). Three surgical, sim-gated changes to `optimizeAsync`;
**only the two intended goldens moved** (14 byte-identical), each re-locked on wowsims new ≥ old at var0
**and** var10, seeds 11/19, 250k:
- **`permute` in sequential window-packing (~1948):** sweeps the *order* the haste buffs sequence across
  the window (not just biggest-first). Leading with the shorter buff keeps a tail buff's 2nd cd-tick
  before the kill. **3:20** → `Zerk@0:05` in Lust, `IV@0:15` after, `CS→IV2@3:00` (**+3.6** var10 / +10.7
  var0; golden 2651.1 reproduced exactly).
- **Cold-Snap materiality `csAddsUse` gate (~2157):** CS that only **repositions** the same IV count (vs
  the best no-CS plan) is **free** (sub-cast bar), not held behind the full "≥ one cast" bar — that was
  what vetoed the 3:20 opener. CS that genuinely **adds** an IV keeps the full bar. RULES §8.
- **`spreadLoneHaste` normalizer (~2070):** a *lone* haste use (intersecting no damage/SP buff) is
  position-independent → slides back to its earliest natural cd tick, model-neutral. **5:00** → the free
  CS IV banked at 4:25 spreads to its 3:05 natural tick, re-homing the burst-IV onto 4:05 (**+2.4** var10
  / +11.6 var0; golden 2625.1 reproduced exactly). The naive spread *loses* ~8 DPS (leaves the 4:05
  burst with no IV) — only the lone IV moves; burst-riding IVs stay pinned.
**4:00 W4** was already at its canonical spot (cluster @3:25 co-presses CS→IV+Berserking, an exact sim
tie with 3:20) — untouched, confirming the normalizer is DPS-neutral by construction. See RULES §8/§11,
MECHANICS §5 pt 5, ARCHITECTURE finishing passes.

**Done — sequential buff-into-Lust packing (the SEARCH fix).** A window-packing move in `optimizeAsync`
(last structural pass, ~1913) assembles the packed burst at each haste raid-call: damage cluster on the
window, haste buffs on sequential slots (IV @anchor, Berserking @anchor+20), sweeping which IV use lands
on the anchor; kept only on a strict robust gain with `sameCounts`. Fixed `6:00 lust 4:20` (**+8.5 DPS**)
and `5:45 lust 4:20` (**+13.9 var0 / +5.7 var10**), both sim-gated and re-locked; the 12 early-Lust
goldens and the two real boss fights were **untouched** (their bursts were already on Lust). Placing it
last meant no defensive rework of the eviction / `nulled` vetoes was needed (nothing runs after to undo
it). See `docs/ARCHITECTURE.md` and RULES §4.

**Done — theorycraft regrounded on "effective ABs" (this session).** Reframed the docs so every rule is a
*consequence* of maximizing effective ABs cast, not a hardcoded law (`CLAUDE.md` goal, `MECHANICS §4`).
Softened the over-strong absolutes the user flagged: Lust-packing is the usual *method* (§4), not "THE
rule"; the intermission invariant is a strong *default*, not a "never" (§9). And **sim-settled the
haste-on-haste question**: isolated pure-haste Berserking **inside** Lust vs **after** it scores an
identical **2367.4 DPS** (0 gear, var 0, 300k, mana-independent) — a **wash, not a synergy**; the value
of haste-on-Lust is *flux* (speeding damage/SP casts) or banking before an early kill, never the product
(RULES §7, MECHANICS §5.3). The planner already sequences correctly, so no code change — a doc/mental-model
correctness fix in service of generalisability.

**Done — model↔sim relationship reconciled (this session, user-directed).** The planner knows every
cast/buff/timing deterministically, so it computes **effective ABs cast** exactly — that count is the
**objective and the arbiter** for comparing two lines; the tool is a maximization function over it. The
sim's role is **calibration**: anchor the physics (trust-anchor), cover the count's blind spots (ramp /
mana / AoE / multi-AP timing), and verify novel/suspicious findings — **not** a routine per-golden gate.
Replaced the stale "trust the sim over the model / the sim wins / the sim is the referee" wording across
`CLAUDE.md`, `docs/TOOLING.md` (new **Methodology** section up top), and `RULES.md`. Per the user's
correction, the framing is explicit that **the sim was rarely *wrong* — we often used it improperly**
(the drop bug, cargo-cult offsets, count-changing A/Bs on nearby seeds were *our* faults); a clean
cast-count vs a contradicting sim number with no blind spot in play is a **sim-setup audit trigger**.
Also flagged the **self-confirming-oracle** risk (proactively sim the blind spots + periodically
re-anchor) and the **scorer-vs-optimizer** distinction (this settles the scorer; search-completeness is
a separate axis). Docs-only, no code/golden change.

**Done:** ~~Boss-preset UI = the golden set~~ — landed. `GOLDEN_PRESETS` drives both the UI strip and the
exact-match suite; new fights are added by editing that one array.

## Golden-review findings (from the preset walkthrough — sim-verified)

- **FIXED — off-GCD burst now co-pressed on one second (7:20 Window 6: 6:21 → 6:20).** The burst
  emitted IV at `6:20` but Icon/Gem/AP at `6:21`. Diagnosing it split the "cluster" into two cases:
  Icon at 380 vs 381 was an **exact model tie** (Δ ≈ 1e-10 — the back-to-back IV+CS→IV keeps casts
  IV-hasted throughout), but Gem/AP scored **+50 at 381** — *not* a tie. The macro-snap missed all of
  them because `isAnchored(IV@380)` false-negatives when the Cold-Snap chain lets a −1s nudge drop the
  chained IV@400, and the overlap-alignment pass then re-staggered them. **Sim resolved the +50: it is a
  pure model artifact** — full-fight wowsims has all-at-6:20 == gem/AP-at-6:21 to the decimal (2565.8
  var0, 2568.2 var10, seed 11, 250k). Fix: a final `coPressAlign` pass (runs on the returned schedule
  AND the Cold-Snap chain candidates) snaps a damage/SP press onto its nearest earlier haste second
  **within 3s** when the model cost is **≤ ⅛ cast**. The 3s window protects genuine staggers (the 3:20
  gem sits 5s off its IV; the KT Icon-onto-AP slide ~20s off Lust — both untouched, both still green),
  and the sub-cast cap rejects any real trade. Only the 7:20 golden moved; sim-gated free; re-locked.
- **FIXED — the whole placement / containment workstream landed** (3:20 free-CS opener sequencing +3.6,
  5:00 lone-IV spread +2.4, 4:00 W4 confirmed already-canonical). Overlap is interval **containment**, not
  start-coincidence: the planner now (a) treats containment-equivalent placements as ties and picks the
  consistent member (`spreadLoneHaste`), (b) spends a **free** Cold Snap to sequence/spread IVs when it
  gains-or-ties (`csAddsUse` materiality gate), (c) sequences opener haste into Lust via a haste-buff
  **order sweep** (`permute`) instead of stacking it over the floor. Generalised, not per-golden — only
  the two intended goldens moved, both sim-gated new ≥ old (var0 & var10, seeds 11/19). See the **Done**
  entry above, **RULES §8/§11**, **MECHANICS §5 pt 5**, and ARCHITECTURE finishing passes.

## Open questions / known limitations

- **SETTLED (user call, 07-24) — plan rows print the FIRE time, and that stays.** The row second is the
  cast boundary where the buff starts paying, not the press *intent* (`index.html` ~3599). Worth knowing
  when reading a plan: on `2:00 lust 0:05` the whole cluster has **intent 5.00, identical to the Lust
  pin**, but fires at **6.50** (the AB that began at 4.67 ends there; a buff pressed mid-cast cannot
  affect the cast in flight), so it prints `0:05 Bloodlust / 0:06 Icy Veins…`. That is **one macro at
  0:05**, not a deliberate stack-building delay — the gap is the in-flight cast, and it is exactly the
  information the fire time is meant to convey. Asked and answered: **do not** add a "(press 0:05)" tag
  or flip the rows to intents.
- **Model mis-valuation (documented, not patched):** the scorer ranks the *partial* pack
  (IV-in-lust-alone) above "IV out" (+935 model) though the sim calls it a −0.7 wash — it over-credits
  the damage flux through the floored IV window. It does NOT block the full pack (model ranks full >
  partial), so the search fix renders it inert; touching the floored-flux crediting risks the
  validated goldens. Revisit only if a case needs it.
- **Align-vs-twice breakpoint** should be pinned by sim per fight, not assumed (when does "two
  unaligned uses" beat "one Lust-aligned use"?).
- ~~Intermission-golden optimality re-gate~~ **DONE** (this session, fixed rig). **4:00-multi:** golden
  (icon2@186, CS→IV@229) = 2096.9 ≥ icon2@180 (2095.6) and == CS→IV@227 (exact wash — confirms
  `dodgeDowntime` is legibility-neutral). **KaelThas:** golden (280/400) = 1718.7 vs TOOL 260/396 (1718.5)
  and 280/402 (1718.2) — a 3-way tie within CRN noise (containment-equivalent icon timings), no
  regression. Both plans stand.
- **Tirisfal-2pc as a tool input — RESOLVED (user call): implemented as the `ck-t5` gear checkbox.**
  Applies ×1.2 to Arcane Blast only (damage sites + both plain-AB normalizations, so single-target plans
  AND effective-AB counts are exactly INVARIANT — verified: identical plan, identical 87.596 count on/off)
  and +20% AB mana in the per-window chip (the real set bonus raises cost too). Its main effect is
  re-pricing AoE phases (`M_eff = M/1.2`): verified at the N=3 knife-edge — the toggle flips
  cluster-on-AoE (+0.607) to cluster-on-Lust (−0.052). Default off; goldens untouched. Pooling with AP:
  ADDITIVE (resolved below).
- **AP × T5-2pc pooling — RESOLVED: ADDITIVE (user ruling).** Googled/searched: no public 2.4.3 source
  decides it; the mechanics argument (both are percent-damage aura modifiers, which SUM in the client's
  modifier pool) matches wowsims' implementation, and the user ruled "trust wowsims if unsure." The
  model's T5 toggle pools additively (`dmgMult + t5add` in `simulate`); sim gates on the T5-wearing
  reference export are faithful as-is.
- Sim harness (`runner`, gear export, wowsims source) lives in the ephemeral scratchpad — see
  `docs/TOOLING.md` for rebuild.
