# PHASE 7 — Fix the cross-val deficits (make the acceptance test PASS)

**Status:** IN FLIGHT — diagnostic COMPLETE (§5 run ledger below), fixes landing. Phase 6 gathered the
data and proved the measurement correct; Phase 7 **dives into the results and fixes the root causes** so
that the next run of `docs/ACCEPTANCE.md` passes fully. This is the "fix" phase the user scoped: *not*
accept the basin — kill it. **Read §5 first for what is already established this run.**

Read first: `docs/ACCEPTANCE.md` (the test + pass criterion), `docs/PHASE6.md` §2.1/§3/§4.1/§4.2/§4.5
(the results + triage method), `docs/DIARY.md` (what we already got wrong — don't repeat it),
`docs/RULES.md` §16 (the haste-morphology band map), `docs/ARCHITECTURE.md` (the optimizer pass order).

---

## 0. Definition of DONE (the only thing that counts)
`docs/ACCEPTANCE.md` passes FULLY on a fresh full run:
1. **Invariant A** — `monoDip = 0.00%` on every table (already holds; must not regress).
2. **Invariant B — ZERO diagonal deficits.** The native plan wins every column of every table — the same
   hard bar as monotonicity, no deficit excused by fight length or magnitude. (If fixed-length DPS
   quantization leaves an irreducible residual, part of this phase is *designing it away* — a
   length-independent metric or a by-construction dominance guarantee — so the invariant can hold cleanly.)
3. **KT included** — once genapl emits Arcane-Explosion, KT sims with its AoE valued and joins the pass.

And the standing guardrails hold at every commit: **exact-match 25/25**, **determinism** (one setup ⇒
one plan; no new RNG), **cold open / ∞ mana** protocol unchanged.

---

## 1. The target set — ALL diagonal deficits (the goal is zero, not a hand-picked subset)
The target is **every** diagonal-dominance violation, not a graded subset — Phase 6 deliberately did
NOT pre-classify them (some grow with length, some shrink; that distinction is for THIS phase to
establish and act on, not to assume). Get the authoritative, un-graded list from:
`node tools/xval-verify.mjs` (all 167 borrowed-win columns across 36 tables) and
`node tools/xval-collect.mjs tools/xval-results` (worst cell + locus per table).

The **long/xl deficits are a sensible place to START** (one per kit, all the shape "a plan built for a
*neighbor* haste out-sims the native"), because a violation that survives a long fight is least likely to
be pure measurement noise — but starting there is a *sequencing* choice, not a decision that the others
don't count. Snapshot for orientation (regenerate with the tools above; don't treat as the final scope):

| kit | fight | sim-haste | borrowed wins | deficit | | kit | fight | sim-haste | borrowed wins | deficit |
|-----|-------|-----------|---------------|---------|-|-----|-------|-----------|---------------|---------|
| mqg+skull | long | 70 | plan@100 | 0.38% | | isc+scb | xl | 20 | plan@400 | 0.17% |
| mqg+skull | xl | 30 | plan@70 | 0.32% | | scb+mqg | long | 0 | plan@105 | 0.12% |
| scb+skull | long | 90 | plan@210 | 0.30% | | isc+skull | long | 40 | plan@70 | 0.12% |
| scb+mqg | xl | 0 | plan@105 | 0.29% | | isc+skull | xl | 130 | plan@100 | 0.09% |
| isc+mqg | xl | 230 | plan@260 | 0.23% | | isc+scb | long | 20 | plan@0 | 0.05% |
| isc+mqg | long | 110 | plan@0 | 0.21% | | scb+skull | xl | 240 | plan@260 | 0.19% |

Loci span **low-haste (≤70)** — the §4.1 straddle-basin region — and **mid/high (≥90)**, concentrated in
the SP-trinket-free kits (§4.2 "no ground truth above ~h150"). Which loci share a mechanism is for the
diagnostic (§2) to establish, not to presume here. Also fix the collector so no violation stays hidden
(§3c) and re-check the short/medium deficits under the same diagnostic — they are targets too.

---

## 2. The DECISIVE diagnostic — run this on EVERY target FIRST (before designing any fix)
Every target is "borrowed plan B out-SIMS native plan N at haste H." The fix depends entirely on **why**,
and there are exactly two possibilities. Distinguish them with one cheap test:

> **Score B with the MODEL at haste H, and compare to N's model score at H.**

- **Case SEARCH-MISS — `model(B,H) > model(N,H)`.** The model *agrees* B is better at H, but the optimizer
  didn't find it. The search failed, not the scorer. **Cheap, low-risk fix** (expand the candidate set so
  the search reaches B's basin). This is the *expected* case for most targets (the model is sim-anchored
  to ~0.4%, so a 0.05–0.38% sim gap is usually a search miss, not a scorer error).
- **Case SCORER-GAP — `model(B,H) ≤ model(N,H)` but B out-sims N.** The model *prefers* N, so the search
  did its job; the **effective-AB scorer mis-ranks these two layouts.** Deeper fix (find the scorer term
  responsible, recalibrate it against the sim, update RULES). Higher-risk (can move the 25 goldens).

**Instrument:** a small `tools/diagnose-deficit.mjs` — given a kit/fight/haste and the two plan specs,
load `index.html` headless, call the engine's scorer on both at H, print `model(B,H)` vs `model(N,H)` and
the track-level diff. Output one **deficit dossier** per target: `{kit, fight, H, N-spec, B-spec,
model(N), model(B), verdict: SEARCH-MISS|SCORER-GAP, differing-track, RULES§16-band-edge}`. Deterministic,
no sim needed (it's the model's own scorer). This partitions all 12 targets in minutes and tells us
exactly how much is cheap vs deep.

---

## 3. Fixes by case

### 3a. SEARCH-MISS fixes (expected majority) — make the per-haste search reach neighbor-haste layouts
The failure: at haste H the search settles in one basin; the layout that a neighbor haste H′ finds (and
which sims/scores better at H) sits in a basin no current anchor seeds *at H*. Two complementary fixes,
cheapest first:

1. **Widen `basinHop`'s anchor set with the structural layouts the deficits point to** (haste-independent,
   so they're reachable at every H):
   - The **§4.1 half-into-Lust IV straddle** (`Lust.start + {5,10,15}`) — the named low-haste basin.
   - **Raw-cadence anchors** — fire each on-use at its exact cd cadence (`0, cd, 2·cd, …`) as a candidate,
     since several winners (mqg+skull xl: Skull 0/120/240 vs native 0/142/262) are just the round-cadence
     layout the delayed native missed.
   - **Off-grid high-haste ramp-snaps** for the §4.2 mid/high targets (AP/Skull at t≈2–4 ramp-exit) that
     the 5s grid can't express — the scb/isc+mqg high-haste winners live here.
   Gate: each new anchor must not regress the 25 goldens and must actually shrink ≥1 target's deficit.

2. **Cross-haste candidate pooling (the structural guarantee, if anchors alone don't close it).** As a
   finishing pass, after solving at H, also solve at the neighboring RULES §16 band-representative hastes,
   **re-score all candidates at H by the model, keep the best.** This makes diagonal dominance hold *by
   construction* at the model-score level — a borrowed plan can never out-score the native because the
   native's search *considered it*. Cost = a few extra bounded solves per output; affordable at current
   speed (pooled workers, ~2s short fights) and gated behind the finishing stage. Determinism preserved
   (fixed neighbor set, seeded PRNG). This is the belt-and-suspenders option; prefer (1) if it suffices.

### 3b. SCORER-GAP fixes (only for targets the diagnostic flags as such) — recalibrate the mis-ranking term
If `model(N,H) ≥ model(B,H)` yet B out-sims N, the effective-AB count is wrong about these two layouts.
Method: isolate the single track that differs (from the dossier), build the minimal N-vs-B pair, sim both
(cold open, ∞ mana, var10, CRN) to get the true ranking, and find which scorer term (ramp credit, buff-
window overlap, GCD-floor phase-average §4.3, SP-dilution) is mis-valuing it. Fix the term, re-derive the
affected RULES entry with its sim evidence, and **re-gate the 25 goldens** (some may legitimately move —
`--update` ONLY if the effective-AB count improves, sim-verified per the methodology). Highest-risk work;
do last, one term at a time.

### 3c. Test-tooling fixes (not model fixes, but needed for a full pass)
- **KT AoE emission** — teach `tools/genapl.mjs` to cast Arcane-Explosion during AoE windows (spell 27082;
  the model already scores AoE, RULES §9). Then KT sims with AoE valued and its 1.06%/2.68% "deficit"
  (currently the exclusion) can be re-evaluated as a real number. Needed before KT can pass.
- **Collector full-column reporting** (PHASE6 §7) — `xval-collect.mjs`/`xval.mjs` should report EVERY
  borrowed-plan-wins column per table and flag the length-robust ones, so no length-robust secondary
  deficit hides behind a small worst-cell (the adversary found ~78 hidden columns). Do this early — it
  sharpens the target list for §1.

---

## 4. Sequence (each step gated; stop and re-plan if a gate fails)
1. **Collector full-column upgrade** (§3c) + reconcile with the full-set adversary → the definitive target list.
2. **Build `diagnose-deficit.mjs`** and run it on all targets → the dossiers → the SEARCH-MISS / SCORER-GAP split.
3. **SEARCH-MISS fixes** (§3a.1 anchors first). After each anchor: `exact-match 25/25`, monotonicity 0
   violations, then **re-run the affected kits' cross-val** and confirm the target deficits shrink toward
   CLEAN. Iterate until the search-miss targets are gone.
4. **Cross-haste pooling** (§3a.2) only if anchors leave residual search-miss deficits.
5. **SCORER-GAP fixes** (§3b) for the (hopefully few) remaining targets — one term at a time, re-gated.
6. **KT AoE emission** (§3c) → re-sim KT → include in the pass.
7. **Full acceptance re-run** (`xval-campaign.sh` + `xval-boss.sh` + collector) → confirm invariant A still
   0 everywhere AND invariant B clean on all long/xl. **Re-run the adversarial refutation pass** on the new
   matrices. Update `ACCEPTANCE.md` status → PASSING (or record what still resists, with evidence).
8. **Docs:** fold each fix into RULES (with sim evidence), ARCHITECTURE (pass order), DIARY (the arc + any
   new believed→disproved entries), and archive this PHASE7.md when it closes.

---

## 5. Guardrails & risks (do not regress)
- **Determinism is sacred.** Every fix (anchors, pooling) must keep one-setup-⇒-one-plan. No `Date.now`/
  `Math.random` outside the seeded PRNG. The exact-match suite is the tripwire.
- **The 25 goldens are the floor.** SEARCH-MISS fixes should leave them byte-identical (they only add
  candidates the search can reject). SCORER-GAP fixes may move them — allowed ONLY if the effective-AB
  count improves and it's sim-verified; never to "make a deficit go away."
- **Don't trade monotonicity for dominance.** Re-check `monoDip = 0` after every change; a scorer edit
  could reintroduce a haste non-monotonicity. Invariant A is non-negotiable.
- **The deficits are ~0.1–0.4%.** They sit near the sim's ~0.4% calibration floor, so a "fix" that only
  moves a number within noise isn't a fix — require the target to reach CLEAN (or provable quantization),
  re-verified on a fresh sim run, not just a smaller number.
- **Risk: cross-haste pooling cost.** Multiple solves per output could slow the UI. Bound the neighbor set;
  keep it in the finishing stage; profile before shipping. If too slow, fall back to anchors-only.
- **Risk: a SCORER-GAP with no clean term.** If a deficit is a genuine scorer blind spot with no isolable
  term, it may need a new RULES entry and a scorer feature — scope it as its own mini-phase, don't force it.

## 6. Open questions to resolve during the phase
- Are the mid/high-haste (§4.2) targets SEARCH-MISS (off-grid presses the anchors will reach) or a real
  high-haste scorer gap? The diagnostic answers this — it decides whether §4.2 needs a scorer fix or just
  richer anchors.
- Does cross-haste pooling change any of the 25 goldens? (It shouldn't — it only adds rejectable candidates
  — but verify.)
- After KT gets AoE emission, is its deficit real or does it also go CLEAN? (Only measurable post-§3c.)

---

## 5. RUN LEDGER (2026-07-24) — what this run has established so far

Rig: the surviving scratchpad rig re-certified (runner-ap180 == wowsimcli to the decimal, 2248.8/47.2 —
the 2264.9 in TOOLING was an earlier export revision; the identity check is the anchor, not the number).

### 5.1 The diagnostic (§2) ran on ALL 167 columns — the partition
- **19 SEARCH-MISS** (model itself prefers the borrowed/3rd layout): incl. the worst non-KT case
  (isc+scb medium 0.77% — the plateau plan; model prefers the h0 layout at h20 by +0.127 casts) and
  mqg+skull medlong (+0.334). Mechanisms heterogeneous; dominant family = **Cold-Snap chain geometry**
  (8 of 19), plus drop-a-use-to-align, off-grid kill anchors, plateau micro-shifts.
- **26 KT columns invalid-premise** (model margins −2..−10 casts = the AoE value the sim couldn't see).
- **~120 residual** (model prefers native ≤0.5 casts; var10 sim disagrees ≤0.5%).

### 5.2 Search: probes + fixes landed
- **Pooling probe:** polish(repair(neighbor-haste champion)) at H closes **19/19** probed misses when
  the right neighbor is used; fixed N(H)={H±60} closes 15/19 (band-edge basins are narrow — the 4
  escapes need either the in-pipeline transforms or a denser neighbor set). Full solve times headless:
  short ~0.6s · medium ~1-3s · long ~5-25s · xl 60-140s (pooling cost driver — pool workers can
  parallelize neighbor solves in the UI later).
- **LANDED in `optimizeAsync`:** (1) the CS-gate chain candidates are now the FULL slot-geometry family
  (reposition + adds-one + kill-anchored end pair) and each is **polished** (raw candidates lose without
  co-adaptation — probe-proven); (2) a **drop-one-use escape** pass (align-vs-twice sacrifice side),
  iterated to fixpoint with a re-hop. Cross-haste pooling NOT yet wired (decide neighbor set after the
  scorer stabilizes — pooling amplifies scorer phantoms).

### 5.3 Scorer: one term landed, several isolated
- **LANDED — expected press-snap slippage** (`simulate` firing block, `scoreStart = eff + slip`,
  slip = ½·prevInterval for a mid-cast steady press; ramp/gap/external presses slip 0; display/legality
  keep fire-time convention). The §4.3 phase blind spot, closed where it bites: a window sequenced to end
  flush against a wall/kill loses the clamped slip for real (Al'ar minimal pair: model tie → sim −0.66%;
  with the term the model now charges −975 and rejects the stagger). Re-diagnosis: 21 residual columns
  flip to model-agrees-with-sim; margins shrink on most others; **the term is right but not sufficient.**
- **Al'ar wall parity ISOLATED (measurement, not scorer):** plan@160-vs-plan@190 differ by a 1s cluster
  shift yet sim 0.59% apart at EVERY var (0/0.5/10) — the cast-train phase at FIXED intermission walls
  clips a whole cast differently per plan. No kill-variance setting smooths walls; a phase-averaged model
  can never see it. → needs a **wall-jitter measurement** (average over small deterministic wall-time
  shifts on boss tables) or stays an irreducible ±1-cast noise band on wall fights.
- **Opener phantom ISOLATED:** the model prefers the IV@0+Zerk@18 opener over IV@5+Zerk@0 by +0.26..0.58
  casts; sim (var0.5, CRN, decomposed arm-by-arm) says they are EQUAL (and Zerk@18-alone-with-IV@5 is a
  real −0.45% the model does see). The over-credit sits in the ramp-exit/co-press interaction: on the
  isc+scb T=98 pair the model over-credits the all-co-pressed-at-ramp-exit variant (N vs X1) by ~+0.58
  casts vs sim ≈0. NOT yet root-caused — next term to isolate.
- **Ramp-hug RE-CERTIFIED (metric matters):** the §16 h150 T=80 claim survives var0.5 (+0.366% ≈ the
  model's +0.25 casts — excellent agreement; the old var0 −0.08% is the whole-cast parity trap). BUT the
  isc+scb short T=98 @140 fight genuinely prefers cluster-on-Lust (+0.42..0.48% at every var) — the
  model's hug preference there is the ramp-exit co-press phantom above, NOT a generic ramp-hug error.

### 5.4 Measurement (the metric decision, per ACCEPTANCE's pre-authorized redesign)
- `--var V` = uniform kill in [T−V, T+V]; the model's `robust` (KILL_WINDOW=0.5s linear taper) is
  **exactly** expected damage under var **0.5** — the model-matched metric. var10 asks a different
  question (±10s kill hedging the model deliberately does not price, RULES §8) and manufactures a
  late-window premium: probe on 15 residual columns shows var10 deltas shrink 2-4× at var0.5, BUT
  13/15 persist ⇒ they were never pure metric artifacts. **Decision: the acceptance harness moves to
  var0.5** (xval VAR env landed; flip the default when the campaign re-runs) **+ wall-jitter for boss
  tables** (design pending).
- Sim iteration/statistics (user question, answered with live data): single iterations spread ±2%
  (σ≈47-65 DPS); means converge by 10k (SEM≈0.02%); the stubborn deficits are METRIC-independent
  deterministic structure, not sampling noise — more iterations cannot shrink them, only metric design.

### 5.5 KT harness gap CLOSED (§3c)
`genapl` `_aoe` windows cast Arcane Explosion (27082); `xval` BOSS mode emits them + `--targets N`
(AB is single-target so the extra dummies are inert outside the window — the AE window is valued at
exactly the model's M(N) physics). Sim-verified: AE 105→145 hits 6 targets, AB resumes at the exit;
KT-shape smoke +69% vs the old downtime read. KT re-runs with the campaign.

### 5.6 Status of the open items (updated as they close)
- ✅ **Ramp-exit co-press phantom root-caused + fixed**: `rampCastDmg` sampled the buff STATE across the
  completion — a press-snapped ramp-exit window was credited ~half the cast it fired after; state now
  snapshots at cast START (damage time stays at completion — Phase 4's rule). T=98 pair flips to
  sim-agreement. RULES §3b.3.
- ✅ **External lattice snap** (RULES §3b.2) — closes the VR/compression phantom.
- ✅ **Wall-jitter implemented** (`xval.mjs` WJITTER=2; the Al'ar parity pair now sims identical) +
  **var0.5 default** (the model-matched metric).
- ✅ **Golden triage (all 25)**: model(new) ≥ model(old) everywhere; sim net strongly positive
  (Hydross +0.37%, Lurker +0.48%, 2:40-int +0.48%, 2:20 +0.26%, Al'ar +0.14%; locked structures
  byte-preserved: Vashj 0.000, KT +0.014, 6:00/5:45 ≈0; worst residual 3:20 −0.145% = parity envelope).
  Goldens regenerated (`--update`) and locked.
- ✅ **xval-model.mjs** committed (model-side dominance instrument, no sim needed).
- **Deferred to the NEXT round (recorded, not dropped):** cross-haste pooling wiring (closes 19/19
  probed misses; costs 2-3× solve time — wire after this round's campaign says what still misses);
  the Al'ar opener residual (+0.17 casts model-vs-sim-tie, sub-slack); the isc+skull straddle-credit
  and scb+skull count-trade margins (≤0.2% at the corrected metric — re-measure in the campaign first).
- **IN FLIGHT: the full acceptance re-run** (`tools/xval-rerun.sh` — new engine, var0.5, wall-jitter,
  KT AoE valued; per-kit durable checkpoint commits), then collector + adversarial verification.

### 5.7 The Vashj 0.64% — dug to ground (user-directed): per-segment cast parity, measurement redesigned
The @235←265 column decomposed (arms A–F, jittered var0.5): the differing choice is which wall-exit
hosts the Cold-Snap IV and whether Skull stacks on it. The model's arm pattern was exact (A==F, C==E)
and the sim's disagreed — minimal 2-wall reproduction + per-interval log verification found WHY:
**the sim's cadence matches the model's intervals EXACTLY (floored 1.0s under the stack, 1.09 under
IV, ramps 1.65/1.44/1.21) — the only difference is that a wall-bounded segment realizes haste in
WHOLE casts.** The fractional credit truncates at the wall: stacked-window marginal model +1.65 casts
vs sim +1.04; split +1.48 vs +1.54 (units: the export's measured 3378 dmg/cast — beware the model's
2241 constant when converting). So the model is RIGHT in expectation (real transition times vary);
the deficit is deterministic measurement structure. TWO harness corrections came out of the dig:
(1) the first wall-jitter (rigid translation) washes NOTHING — parity is per-segment (DIARY entry);
(2) jitter v2 = independent per-wall seeded shifts, presses tracking their segment's wall,
seam-coupled edges. Boss tables re-running under v2. No scorer change — by design (the §8
plan-for-the-known-kill philosophy extends to walls: don't razor-time segment parities).

### 5.8 ROUND-2 RESULTS (fight-class complete; bosses re-running under jitter v2)
Apples-to-apples on the 30 fight-class tables (same fights, same kits):
| | Phase 6 (var10) | Phase 7 round 2 (var0.5) |
|---|---|---|
| borrowed-win columns | 127 | 125 (median width **0.047%** — mostly hair-ties) |
| mean / worst | 0.160% / **0.77%** | **0.075% / 0.40%** |
| columns ≥0.3% / ≥0.2% / ≥0.1% | 19 / 40 / 73 | **5 / 11 / 28** |
| monoDip | 0.00% everywhere | 0.00% everywhere |
Model-side residual search-misses: 14, ALL with model margins ≤0.084 casts (inside the 0.15
pressability slack — the pooling-class wobbles, as predicted in §5.6).

**The residual ≥0.3% family (5 columns) is REAL and characterized** (next round's §3b targets):
robust to var width (isc+mqg medlong @70: +0.38% at var0.5 / +0.33% at var1.5 AND var3 — not
kill-window parity), model near-ties (−0.005..−0.07 casts; one −0.34), and a shared shape: the sim
prefers EARLIER/pull-anchored on-use haste in context (MQG@pull ×2 — the ladder L3 law — IV-chain@pull,
cluster-on-Lust@165). NOT a broken invariant: lone-MQG early-vs-late on a plain fight sims
BYTE-IDENTICAL (position-independence exact); the preference is contextual (double-IV opener /
Icon / Lust coupling). Candidate suspects for next round: the §5.3 recalibration's interaction with
self-press haste near the opener, or a §16-band coupling the scorer under-weights.

### 5.9 Loop engineering (user-directed) — the standing fix→verify loop for the next rounds
User rulings folded into ACCEPTANCE: **monoDip stays forever** (free — computed from the matrix the
campaign already sims); **no accepted tolerance floor** — the guarantee moves to construction:
- **B1 (model level, every commit, no sim):** cross-haste pooling makes native ≥ every borrowed
  candidate BY CONSTRUCTION; `diagnose-deficit`/`xval-model` verify in minutes. Pooling is therefore
  the NEXT ROUND'S CENTERPIECE (measured: closes 19/19 probed misses; cost 2–3× solve — engineer it
  on the worker pool / reduced-depth neighbor solves).
- **B2 (sim level):** every borrowed win = mandatory investigation → scorer bug (minimal-pair method)
  or demonstrated-then-fixed measurement structure. Distribution always published.
- **Loop cadence:** inner (per fix, ~30–60 min): minimal-pair gate → exact-match → diagnose-deficit
  margins. Middle (per batch): affected-kit `xval-kit.sh` + `xval-model` fast classes. Outer (per
  phase): the full campaign once. Retired as information-free: per-fix full campaigns, zero-bar
  DEFICIT *counts* (report distributions), plateau-interior column labels, and any pre-v2-protocol
  numbers.
Current round-2 open items for that loop: the 5 var-robust ≥0.3% columns (§5.8 — the contextual
pull-anchored-haste family), the 14 sub-slack model wobbles (pooling closes), boss tables under
jitter-v2 (running).

### 5.10 Cross-haste pooling — B1 dominance BY CONSTRUCTION (the ACCEPTANCE amendment, implemented)
The user's requirement — "the model should guarantee whatever it found is at worst equal to the
alternatives" — is now a structural property, not a search-quality hope. `optimizeAsync` gained
`cfg.poolHastes`: it emits, at haste H, the argmax over the fixed champion set {champ(h)} scored at H
(ARCHITECTURE). Every cross-val column emits a member of that shared set, so no borrowed plan can
out-SCORE the native (model-side B1). Default off → goldens byte-identical (exact-match 25/25).
- **Design validated on committed round-2 data** (`scratchpad/pool-design.mjs`): model-side B1
  violations vs neighbor width — W0 22, W30 9, W60 6, W90 2, W120 1, **W=ALL 0**. Pooling over the
  full straddle set closes it completely (lower bound — the real mechanism ties or beats this).
- **Mechanism verified end-to-end** (`scratchpad/pool-verify.mjs`, engine `poolHastes`): scb+skull
  short **1 → 0** B1 violations; the guarantee held only after THREE correctness fixes (raw-score not
  re-polish; equal `starts` for pool solves; baseline anchored to `simulate(base.s)` — the Cold-Snap
  normalize()/val mismatch). All three are documented invariants in ARCHITECTURE.
- **Scope:** pooling fixes SEARCH misses (B1). It does NOT touch the ~5 var-robust ≥0.3% SCORER-GAP
  columns (§5.8, model prefers native yet sim disagrees — the pull-anchored-haste family); those are
  the B2 scorer work reserved for the high-effort next phase.
- **Next:** run the full campaign with pooling ON (`xval.mjs` default; `POOL=0` to measure the delta),
  then B2 investigation of the residual family.

### 5.11 REGRESSION (user-reported, open): equal-DPS layouts got UGLIER after the recalibration
The bf34f56 golden regeneration (scorer recalibration §5.3 + new search passes) left some fights with
**equal-score but less legible layouts** — the historic tie-break/legibility stack (co-press beats
earliest, grouped presses, overlay preference, quarter-cast legibility tolerance — the day-1 "beauty"
machinery) is evidently no longer the FINAL word among score-ties after the new passes. Not a DPS bug
(user-confirmed equal); a product regression all the same — legibility is a feature here.
**Decision (user): fix LATER, within this phase's close — not mid-campaign.** Do it AFTER the running
round-3 (its B1/B2 verdicts don't depend on tie aesthetics) and BEFORE the FINAL acceptance re-run, so
the shipped engine and the acceptance record match. Fix outline:
1. Audit the pass order: where do the new passes (press-snap slippage, external lattice snap, CS chain
   family, drop-one escape) emit relative to the tie-break stack? Restore legibility as the LAST pass
   over equal-score candidates (within the established tolerance). Goldens will move aesthetically —
   regenerate under the standing gate (count must not decrease; spot-sim ties).
2. Pooling tie rule (for when `poolHastes` ships ON anywhere user-facing): adopt a borrowed champion
   ONLY on strict score improvement (> EPS); on ties keep the native plan. B1 (native ≥ borrowed) is
   preserved by construction — a tie kept is still dominance — and native plans carry the legibility
   tie-breaks.
3. Re-run exact-match + the affected goldens' sims, then the final acceptance campaign.
