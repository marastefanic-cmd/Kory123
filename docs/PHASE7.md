# PHASE 7 — Fix the cross-val deficits (make the acceptance test PASS)

**Status:** IN FLIGHT — diagnostic COMPLETE (§5 run ledger below), fixes landing. **Round 5 is gathered
and read (§5.15): the target list is TWO kit-columns** (`isc-mqg h40`, `isc-skull h20`), not the 34
failing tables the banner names — and the corrected reference gear moved 35.9% of the plans while moving
the verdict not at all, so the B failure is not a gear artifact. Phase 6 gathered the
data and proved the measurement correct; Phase 7 **dives into the results and fixes the root causes** so
that the next run of `docs/ACCEPTANCE.md` passes fully. This is the "fix" phase the user scoped: *not*
accept the basin — kill it. **Read §5 first for what is already established this run.**

Read first: `docs/ACCEPTANCE.md` (the test + pass criterion), `docs/archive/07-phase6-xval-run.md` §2.1/§3/§4.1/§4.2/§4.5
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

> **⚠ SUPERSEDED at round 5 (§5.15b) — read that first.** The snapshot below, and
> `xval-verify.mjs`'s "length-robust … Phase-7 targets" list, are **not** length-persistence tests: they
> mean "this borrowed win appears in a long or xl table", which for a 0.02%-scale near-tie is a coin flip
> that happened to land on a long fight. The real target list is the **2 kit-columns** the unrigged
> consistent-alternative test names (`tools/xval-persist.mjs`): `isc-mqg h40` and `isc-skull h20`. The
> *bar* is still every column; the *work list* is those two.

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

### 5.11 REGRESSION (user-reported) — **RESOLVED.** Equal-DPS layouts got UGLIER after the recalibration
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

**§5.11 concrete case (measured, reproducible — use as the fix's acceptance example):** Hydross preset
(T=100, Lust@7 pinned), 0 haste rating, kit isc+scb, CS on. The emitted plan orders Lust as
**Zerk@8 → cluster@18 (IV/Icon/SCB/AP) → CS-IV@39**; the ordering used on other fights (and the natural
read) is **cluster@8 → Zerk@28 → CS-IV@38**. Scored with the engine (`scratchpad/hydross-zerk.mjs`
pattern): **87.4509 vs 87.4509 effective ABs — an EXACT tie**, so the flip is pure tie-resolution.
(Contrast: pushing Zerk outside Lust entirely costs a real −0.20 casts — the SPLIT is load-bearing,
the ORDER is not.) Principle for the fix: among score-tied orderings, resolve **consistently across
fights** — burst cluster first inside Lust (the day-1 "anchor burst early" doctrine), THEN the lone
haste filler, then the CS chain. Consistency is the aesthetic: same-shape fights must render
same-shape plans.

**ROOT CAUSE of the *inconsistency* (the part that actually needed explaining — user follow-up).** The
user's real objection was not ugliness but that *near-identical setups disagreed with each other for no
reason*: `2:00 lust 0:05` rendered `LUST → cluster → Zerk@0:26 → CS-IV@0:36` while Hydross (T=100, the
same shape — too short to fit a second use of anything) rendered `Zerk → cluster → CS-IV`. The reason is
**plateau path-dependence, and it is a real class of bug, not an aesthetic quibble**:
- On a fight where every buff window lies wholly inside the fight, does not clip, and gates nothing else,
  the objective is **exactly flat** over permutations of the presses within the haste window — the two
  Hydross layouts score `196077.764863` to the last bit. The optimizer is maximizing a function that
  genuinely **does not care**, so it returns *whichever point the search last touched*.
- Which pass last touched it varies with T, the pin second, and the multi-start seeds — so two fights of
  the same shape can exit from different passes and land on different rotations of the same plateau.
  The historic legibility stack existed but ran **early**, so every pass added later (press-snap
  slippage, external lattice snap, CS-chain family, drop-one escape) could and did emit after it and
  undo it. **Nothing preferred Zerk-first on Hydross** — it was simply where that fight's search
  happened to stop.
- The general lesson (worth keeping beyond this fix): *a maximizer alone does not define an output on a
  plateau.* Wherever the objective is flat, the answer is decided by search history unless something
  **downstream of every pass** picks a canonical representative. That is exactly what
  `canonicalWindowOrder` is — and why it had to run last (see "Placement was the whole difficulty").

**Post-fix cross-fight consistency check (all 25 goldens, lust-window act order).** Every short fight
now renders the same shape — `LUST → IV/Icon/SCB/AP` (or the cluster just ahead of a later Lust pin),
with Zerk as a lone filler ~20s later and CS-IV after it. The four plans that still show Zerk *inside*
the cluster (`3:20 lust 0:05` ±drums/PI, `Al'ar`) are **not** the same shape: they are long enough for a
second full burst window, so Zerk is co-pressed into burst #1 by design rather than held as a filler.
Consistent, and consistently *explainable* — which was the ask.

#### 5.11 FIX (landed) — `canonicalWindowOrder`, a resolve-time exact-tie canonicalizer
Two changes, both gated to **exact ties or strict gains** (a golden may move only if the effective-AB
count does not decrease):
1. **`canonicalWindowOrder(s0)`** (`index.html` ~2730), applied at all three `resolve(...)` sites
   **after** `normalize` — the last thing that touches a plan. Inside a pinned haste window it blocks
   the mage's presses (≤3s apart = one block), finds the burst cluster (first block with both a
   damage/SP and a haste buff) and, when everything ahead of it is a lone-haste filler, rotates the
   cluster to the front and re-sequences the fillers after it. Gate: `repair`-legal + `sameCounts` +
   no worse `clipOf` + `robust ≥ r0 − castVal/1000` (≈0.001 casts — float noise, so **exact ties only**).
2. **A second anchor base in the sequential window-packing pass** (`A2` = the incumbent's own
   boundary-snapped span start) plus **canonical-tie adoption** at `TIE_EPS = castVal/1000`. The raw
   window second `A` is often *not* a legal press boundary during the opener ramp, so the canonical
   packed form was simply unreachable from `A` alone.

**Placement was the whole difficulty.** Run INSIDE `normalize`, the fix *lost* 0.0136 casts on Hydross:
the hop↔normalize fixpoint's downstream passes re-drift the rotated layout and re-converge on the old
shape. Run last, at `resolve`, it lands on the exact tie.

**Evidence (both engines scored with the same untouched `simulate()`, so directly comparable):**

| case | pre-fix | post-fix | verdict |
|---|---|---|---|
| Hydross the Unstable | `robust=196077.764863` · `isc[18] iv[18,39] ap[18] scb[18] zerk[8]` | `robust=196077.764863` · `isc[8] iv[8,39] ap[8] scb[8] zerk[28]` | **bit-exact tie**, now cluster-first — the layout the user identified as the cross-fight norm |
| 4:00 lust 0:05 | `robust=428242.674625` (eff 190.996641) | `robust=428257.758448` (eff 191.003368) | **strict +15.08 damage = +0.0067 eff ABs** (the `A2` anchor) |

Those are the only two goldens that move; the other 23 are byte-identical. `A2` is therefore
**load-bearing, not redundant** — it is a real search win, not a cosmetic one.

### 5.12 ROUND-3 RESULTS (COMPLETE — all 36 tables: pooling ON, var0.5, jitter v2, KT AoE valued)
The full acceptance campaign on the post-fix engine, all tables committed to `tools/xval-results/`
(round-2 snapshotted to `tools/xval-results-archive/phase7-round2/`). Ledger =
`node tools/xval-collect.mjs tools/xval-results`; invariants recomputed by `tools/xval-verify.mjs`.

| | Phase 6 (var10, prepull-era protocol) | Round 3 (pooling ON, var0.5, wj2, AE) |
|---|---|---|
| monoDip | 0.00% everywhere | **0.0000% everywhere** (recomputed) |
| borrowed-win columns | 167 | **145** (median width **0.042%**, mean 0.081%) |
| worst column | 0.77% (2.68% KT-artifact) | **0.40%** (KT now ordinary: worst 0.39%) |
| columns ≥0.3% / ≥0.2% / ≥0.1% | — / — / — (not tracked) | **9 / 17 / 35** |
| CLEAN tables | 1/36 | 2/36 |

Facts, no grading (the bar remains ZERO columns — invariant B still FAILS):
- The ≥0.3% head is 9 columns; the known **B2 family** tops it (isc+mqg medlong @70 = 0.40%, medium
  @110 = 0.38% — the pull-anchored-haste scorer gap, PHASE8's charge). KT's former 2.68% artifact is
  gone (AE valued): its worst column is 0.39%, in-family.
- The tail is hair-width: median 0.042% — half the 145 columns are sub-0.05% wobbles at the
  measurement's quantization scale. Eliminating them is a DESIGN task (length-independent metric or
  sim-side by-construction guarantee), not a per-column chase — per the §5.9 ruling they stay counted
  as violations until then.
- Model-side B1 held by construction throughout (pooling ON for every emitted plan).

### 5.13 ROUND-4 DELTA ATTRIBUTION — what §5.11 actually moved (COMPLETE, all 36 tables)
Round 4 re-runs the whole campaign on the post-§5.11 engine, **on the same 36 seeds as round 3**, so
the pair isolates that one engine change. Before reading its headline, the honest question is **which
tables the tie-break canonicalizer touched at all** — a legibility change is *supposed* to be
score-neutral, so most tables should come back unchanged, and any that move should move only where a
tie existed. Measured (strip the runner's `^\d{4}/\d{2}/\d{2}` timestamp lines, then diff content):

| | round 3 | round 4 | delta |
|---|---|---|---|
| tables with **identical content** | — | **29 / 36** | 7 moved |
| borrowed-win columns | 145 | **142** | **−3** |
| worst column | 0.40% `isc-mqg-medlong @sim70` | **0.40%, same cell, same DPS pair** (2787.5 > 2776.5) | **0.00** |
| monoDip | 0.0000% | 0.0000% | — |
| CLEAN tables | 2/36 | 2/36 | — |
| median / mean width | 0.042% / 0.081% | 0.044% / 0.081% | — |
| columns ≥0.3% / ≥0.2% / ≥0.1% | 9 / 17 / 35 | 9 / 17 / **34** | −0 / −0 / −1 |

The full −3 localizes to the 7 moved tables (25 columns in r4 vs 28 in r3), and every movement is
tie-scale:

| moved table | r3 cols / worst | r4 cols / worst |
|---|---|---|
| `boss-LadyVashj-isc-scb` | 5 / 0.06% | 3 / 0.11% |
| `boss-LadyVashj-mqg-skull` | 4 / 0.15% | 4 / 0.07% |
| `isc-skull-xl` | 5 / 0.08% | 4 / 0.08% |
| `scb-mqg-short` | 3 / 0.07% | 3 / **0.03%** |
| `isc-scb-long` · `isc-skull-long` · `scb-skull-short` | 5 / 0.05% · 5 / 0.21% · 1 / 0.02% | unchanged counts and worsts |

**The mechanism, shown rather than asserted.** Every moved table changed at **`h0` only**, and the
diff is the canonicalizer's signature — the cluster snapping to the front of its window and the
fillers re-sequencing behind it:

| table | round 3 `plan@h0` | round 4 `plan@h0` | model eff |
|---|---|---|---|
| `isc-skull-long` | `AP[22,240] Zerk[22,263] Skull[22,143,263] IV[22,240,263] CS[263]` | `AP[20,240] Zerk[20,260] Skull[20,140,260] IV[20,240,260] CS[260]` | 228.795 → 228.787 |
| `scb-mqg-short` | `AP[27] Zerk[17] Gem[27] MQG[57] IV[27,57]` | `AP[17] Zerk[37] Gem[17] MQG[57] IV[17,57]` | 75.88 → **75.88 exactly** |

Three readings, and the third is the one that matters:
1. **§5.11 behaved as designed.** 29/36 tables are content-identical — the canonicalizer moved a plan
   only where a tie existed to resolve, which is the whole claim of a resolve-time tie-break.
2. **It is NOT a fix, and must not be booked as one.** The 7 movements are mixed-signed (Vashj-isc-scb
   *loses 2 columns while its worst rises 0.05 pp*; Vashj-mqg-skull holds 4 columns while its worst
   falls 0.08 pp; scb-mqg-short's worst more than halves). Net −3 columns out of 145 is tie-resolution
   landing where it lands, not the deficit shrinking. A legibility change that *improved* the invariant
   would in fact be suspicious.
3. **★ The deficit head is untouched, and now demonstrably so.** `isc-mqg-medlong` is in the
   **content-identical** set — same plans, same matrix, same 0.40% at `@sim70` down to the DPS pair.
   B2 is therefore provably invariant to the tie-break, which removes tie-ordering from its suspect
   list at zero extra cost and leaves PHASE8's charge exactly where round 8 left it. (PHASE8 §19.6
   reached the same conclusion by argument; this is the empirical confirmation.)

**A loose thread this comparison pulled, followed up in §5.14:** `isc-skull-long@h0` lost **0.008 eff
casts** of model score across the change. §5.11's adoption gate is `castVal/1000` ≈ 0.001 casts, so an
0.008 move cannot come from the canonicalizer's own gate — which is what sent §5.14 looking, and what
it found is not about §5.11 at all.

*Instrument note:* this comparison was only trustworthy because both instruments were repaired first —
the collector was silently reading **zero** tables and reporting `PASS ✓` (DIARY 07-25). The two now
cross-agree exactly on all headline numbers, which is the check that licenses the tables above.

### 5.14 THE `val` / EMITTED-PLAN MISMATCH — the tool reports a score for a plan it does not ship

**What §5.13's loose thread turned out to be.** Chasing why `isc-skull-long@h0` moved 0.008 eff casts
across a change whose adoption gate is `castVal/1000` ≈ 0.001 casts led away from §5.11 entirely and
into `optimizeAsync`'s resolve. The finding:

> **`optimizeAsync` can return `{val, s}` where `simulate(s).robust ≠ val`.** All three resolve sites
> carry `val` across a transform of `s` that is never re-scored. The number the tool reports is the
> score of a *pre-transform* plan; the plan it emits is the *post-transform* one.

**The three sites** (`index.html`):

| line | path | transform applied after the last scoring | `val` carried from |
|---|---|---|---|
| `:2919` | Cold Snap A | `canonicalWindowOrder(normalize(bestN.s))` | `bestN.val` |
| `:2921` | Cold Snap B | `canonicalWindowOrder(normalize(champ.s))` | `champ.val` (spread) |
| `:2928` | plain | `canonicalWindowOrder(best.s)` only | `best.val` |

`canonicalWindowOrder` is **not** the culprit — it re-anchors every iteration and gates each swap at
`simulate(rep) ≥ r0 − castVal/1000` (`:2770-2771`), so it can only leak ~0.001 casts. The leak is
`normalize()` (`:2785`) = `dodgeDowntime ∘ slideEarliest ∘ spreadLoneHaste ∘ coPressAlign`, which runs
**after** the last `simulate` on the two Cold-Snap paths. `coPressAlign` alone carries a *designed*
pressability trade of up to `castVal/8` = 0.125 eff casts (`:2780`) — legitimate as a plan choice,
but it is spent silently and the reported `val` never learns about it. Four stacked transforms is
also why the observed worst exceeds any single one's bar.

Note the fixpoint at `:2792-2796` **does** re-score (`const v2 = simulate(s2, cfg).robust; s = s2; val = v2;`).
So the machinery to do this correctly already exists in the same function — the resolve sites simply
don't use it.

#### Prevalence (measured, all 25 shipped presets)

Instrument mirrors `tests/exact-match.mjs:52-63` cfg construction exactly; fails loud on pageerror, on
any preset erroring, and on zero graded rows (see the instrument note below — this mattered).

| preset | `val` | `simulate(emitted s)` | Δ eff casts | CS path |
|---|---|---|---|---|
| Al'ar | 334916.588 | 334572.764 | **−0.1533** | yes |
| 2:40 lust 0:07 | 290605.822 | 290556.321 | −0.0221 | yes |
| 3:20 lust 0:05 | 360731.659 | 360808.825 | +0.0344 | yes |
| 3:20 lust 0:05 drums | 367042.610 | 367117.990 | +0.0336 | yes |

**4 / 25 presets drift; worst over-report 0.153 eff casts; every one of them on a Cold-Snap resolve
path** — exactly the two sites where `normalize()` runs after the last scoring, and none on the plain
`:2928` path where only the tightly-gated canonicalizer runs. The root cause is confirmed by the
prevalence pattern, not just by reading the code.

The drift is **bidirectional** (2 over, 2 under), which rules out "a systematic constant to subtract"
and confirms it is whatever the transform happened to trade on that plan.

#### What it does and does not bear on

- **It does NOT corrupt the acceptance rounds.** `tools/xval.mjs` takes `.s` (the emitted plan) and
  re-scores it itself — `champ[h] = (await optimizeAsync(...)).s` at `:121`, then `simulate(champ[h], cfg)`
  at `:125-126`. Both the pooling choice and the reported `eff` are computed from the emitted plan.
  Rounds 1–4 are unaffected. **This is a negative result and is load-bearing** — it is why §5.13's
  attribution and the round-4 record stand as written.
- **It DOES corrupt the number the user reads.** The displayed effective-AB count is the project's
  stated arbiter for comparing two lines (`CLAUDE.md`), and on ~16% of shipped presets it is the score
  of a slightly different plan than the one on screen.
- **It DID enable a false pass in `brute-grid --tool`.** That certification returned `best.val` and
  compared it to a `simulate`-computed grid optimum under a **0.15** pressability band — the same order
  as the 0.153 worst over-report, so a genuine search miss up to ~0.30 could print
  `PASS (within pressability slack)`. **Fixed** (`tools/brute-grid.mjs`): it now grades
  `simulate(best.s, cfg).robust`, making both sides apples-to-apples.
- **It does NOT bear on invariant B — now SETTLED, not merely expected.** A plan selected on an inflated
  `val` and then emitted in a slightly worse normalized form would be precisely the "native loses to a
  borrowed plan" signature. But the `:2918` branch comparison (`bestN.val >= champ.val - bar`) happens
  *before* the transforms, so recomputing `val` afterwards changes only the reported number, not the
  emitted plan. **Verified:** with the fix applied the exact-match suite is **25/25, zero goldens moved**
  — every emitted plan is byte-identical. **This is not a B fix; do not book it as one.** B remains open
  and is Phase 8's target.

#### Decision — APPLIED

The fix re-scores after the transform at all three sites (`index.html:2919 / :2921 / :2928`), reusing
the pattern the fixpoint at `:2792-2796` already used correctly. `csNote.delta` deliberately stays on
the pre-transform values: it records the margin the branch was **decided** on, which is a different
question from what the emitted plan scores.

Gate: **exact-match 25/25, zero goldens moved** — confirming this is a reporting fix, not a plan change.
Confirmation sweep: the prevalence instrument re-run against the fixed engine reports **0/25 presets
where reported `val` != `simulate(returned plan)`, worst over-report 0.0000** (was 4/25, worst 0.1533).

*Instrument note (the class again).* The first version of the prevalence sweep called a function that
did not exist; all 25 presets threw, and the summary still printed **"0/25 presets where reported val
!= simulate"** — a confident CLEAN over **zero graded rows**. It was caught only because the per-preset
error lines were printed alongside. This is the 07-25 audit's own lesson reproduced first-person, in a
throwaway script, by the person who had just written the lesson down: *an instrument whose failure mode
is a PASS must be dry-run against known-nonempty data before its verdict is believed.*

### 5.15 ROUND-5 RESULTS — the corrected gear, and the collapse of the target list from 34 tables to 2 columns

Round 5 = all 36 tables re-gathered on the **corrected reference gear** (`tools/reference-gear.mjs`:
`t5two` + effective `sp: 1450`; PHASE8 §6/§7/§20), same 36 seeds as rounds 3–4, everything else per the
locked protocol. Round 4 archived to `tools/xval-results-archive/phase7-round4/`.

**Headline (recomputed by `xval-verify.mjs`, cross-checked by `xval-collect.mjs` — they agree):**
`monoDip = 0.0000%` on all 36 · **135** borrowed-win columns across 34/36 tables · worst **0.38%**
(`boss-KT-isc-scb @sim95`, `plan@165` 2238.5 > native 2230.1) · median 0.035% mean 0.069% · ≥0.3%: 3,
≥0.2%: 12, ≥0.1%: 30 · CLEAN 2/36 (`isc+scb medlong`, `isc+scb xl`).

#### (a) The repricing moved a third of the plans and NONE of the verdict

`node tools/xval-round-diff.mjs tools/xval-results-archive/phase7-round4 tools/xval-results`:

```
ROUND-DIFF tables=36 compared=36 errored=0 tablesWithPlanChange=34 planCells=124/345 deficitTables=34→34
verdict flips: none
```

**124 of 345 plan cells changed (35.9%)** on a −0.4…−1.1% `eff` level shift (KT −6.1…−6.8%) — the
round-diff's REPRICING signature, exactly as its own header predicts. And the verdict is unmoved:
`deficitTables 34→34`, zero flips, `monoDip` 0.00% on both sides.

Three conclusions, all load-bearing:
1. **★★★ The B failure is NOT a reference-gear artifact.** The obvious remaining suspicion after PHASE8
   §20 — "the model side was optimizing for a mage the sim does not run, of course it loses columns" — is
   dead. Correct the gear and the same 34 tables fail by the same widths.
2. **Invariant A was already clean at round 4.** Round 5 confirms monotonicity *survives* the corrected
   gear; it did not fix anything.
3. **★★ Per-table widths wander both ways under a pure repricing** — 12 improved, 8 worsened, 16
   unchanged, net 0.42 pp over 36 tables — including `scb-skull-short` 0.02%→**0.23%** and
   `scb-mqg-short` 0.03%→**0.21%**. A table can go from essentially-clean to among-the-worst **with no
   model change at all**, so the round-over-round headline drift (142→135 columns, 0.40%→0.38% worst) is
   mostly repricing and must **not** be read as convergence. This is the same trap TOOLING names under
   *"DUEL what changed"*, one level up: it applies to whole rounds, not just cells.

PHASE8 §20.2's pre-flight ("rank-neutral; the plans will not move") is therefore **withdrawn** — it was
one fight family at four hastes; this is 36 fights at 7–11 hastes each. The *decision* to correct the
gear stands regardless: a harness must describe the mage the sim runs.

#### (b) ★★★ The target list is 2 columns, not 34 tables — and the old §1 snapshot is superseded

The banner's `B FAILS on 34/36` cannot steer this phase: it is an **existence** test over ~90 near-ties
per table, and the diagonal's own median winning margin is **0.003%**, below the harness's ~0.02%
CRN/10k resolution. At the observed 39.1% per-column borrowed-win rate an existence test over ~10
columns must return DEFICIT ~99.3% of the time. The full argument, with the positive counterpart (pure
noise would give ~99.8% borrowed-win columns, not 39.1% — so the diagonal genuinely dominates), lives in
ACCEPTANCE → *"What the B BANNER can and cannot tell you"*.

The test this phase's target list should have been built on is instead: **does one specific rival layout
beat native at MOST fight lengths?** — the only shape a real `(kit, haste)` adaptation defect can take.
Unrigged over all 57 kit-columns, no magnitude or distance filter (`node tools/xval-persist.mjs`):

```
best rival wins 5 of the lengths :   1 columns ★
best rival wins 4 of the lengths :   1 columns ★
best rival wins 3 of the lengths :  10 columns
best rival wins 2 of the lengths :  20 columns
best rival wins 1 of the lengths :  16 columns
best rival wins 0 of the lengths :   9 columns

isc-mqg   h40  <- rival plan@h70   wins 5/5  margins% [0.094, 0.007, 0.260, 0.101, 0.073]
isc-skull h20  <- rival plan@h100  wins 4/5  margins% [0.087, 0.007, 0.066, 0.011]
```

**THE PHASE-7 TARGET LIST IS THOSE TWO COLUMNS.** §1's snapshot table (12 long/xl loci) and
`xval-verify.mjs`'s "length-robust (long/xl, non-KT) deficits — Phase-7 targets" list (11 tables) are
both **superseded**: neither is a length-*persistence* test — they mean "appears in a long or xl table",
which for a near-tie is a coin flip that happened to land on a long fight. Both surviving columns are
low-haste (h40, h20), consistent with the recorded low-haste micro-placement slack (DIARY open debts).

⚠ **Both still need a magnitude-vs-resolution judgement before either is called a defect**: each has at
least one length at 0.007%, well inside the ±0.02% ruler. ~~Diagnose them with
`tools/diagnose-deficit.mjs` (SEARCH-MISS vs SCORER-GAP) before designing anything.~~ **That instruction
is superseded by §5.16** — on pooled results the SEARCH-MISS bucket is arithmetically empty, so the
partition cannot route the work. §5.16 is the diagnosis that was actually possible, and what it found.

#### (c) The rigged-sieve correction — recorded so it is not repeated

Before the test above, a three-filter sieve was built (persistence ≥4/5 **AND** borrower ≥2 grid steps
**AND** magnitude ≥0.10%), thresholds chosen **after** looking at round 5. It named four columns
(`isc-skull h130` 0.279%, `scb-skull h90` 0.229%, `isc-mqg h20` 0.133%, `isc-mqg h110` 0.101%) — and the
two tests **disagree completely**. All four sieve survivors fail the unrigged test (best 3/5, magnitudes
inconsistent by 20×: `isc-skull h130`'s rival h185 gives 0.009% / 0.014% / 0.279%), and **both unrigged
survivors were rejected by the sieve** (`isc-mqg h40` by the distance filter at maxDist 1; `isc-skull
h20` by the magnitude filter at 0.087%). Nothing from the sieve is recorded as a finding.
**Lesson: a sieve whose thresholds you chose after seeing the data is not evidence; the threshold-free
test that names the only physically possible shape of the defect is.**

### 5.16 DIAGNOSING THE 135 — the SEARCH-MISS/SCORER-GAP partition is DEGENERATE, and what the columns actually are

Run on round 5 (`CHROMIUM=… node tools/diagnose-deficit.mjs tools/xval-results --json dd5.json`):

```
SEARCH-MISS (model prefers B):                                 0
SEARCH-MISS(other) (model prefers a 3rd candidate over native): 0
SCORER-GAP (model prefers native; sim disagrees):             135
```

#### (a) ⚠⚠⚠ That partition is TAUTOLOGICAL — §2's decisive diagnostic no longer decides anything

`0 / 0 / 135` reads like a strong positive result about optimizer completeness. It is not a result at
all. `tools/xval.mjs:176-190` turns **cross-haste pooling on by default** (`const POOL = POOL_ENV !==
'0'`) and its own comment states the consequence: *"no borrowed plan can out-score the native."* The
emitted native plan **is** the model-argmax over the union of all cross-haste champions, so
`model(B,H) ≤ model(N,H)` holds **by construction** and every borrowed-win column is *forced* into
SCORER-GAP. Confirmed in the dossiers: `modelMargin > 0` in **0 of 135**, and `modelBest === modelN` in
all 135. This is just B1 restated (ACCEPTANCE), not evidence about the search.

**★★★ P7.3 invalidated P7.2's instrument, and nothing said so.** Pooling was landed (§5.10) as the
mechanism that makes B1 hold by construction — which is exactly the property that empties one side of
the partition this phase's §2 was built on. Same defect shape as the B banner: *a test that cannot fail
measures nothing.* Measuring the SEARCH side again requires a `POOL=0` round (the env switch exists
precisely "to MEASURE what pooling fixed"); a ⚠ banner now leads `tools/diagnose-deficit.mjs`.

#### (b) What the 135 columns ARE (the part of the tool that still measures something)

The model margin and the track diff are still real, and they say the population is **near-tie retimings,
not structural alternatives**:

| property | round 5, over all 135 |
|---|---|
| identical press COUNT on every track (pure retiming) | **132 / 135** — only 3 change structure |
| model margin `\|Δ\|/N` | median **0.035%** · p75 0.064% · p90 0.162% · max 0.376% |
| exact model ties (`modelMargin == 0`) | **14** |
| model margin ≤ 0.02% (at/below CRN resolution) | **58 / 135** |
| sim% ÷ model% (per column, where both nonzero) | median **1.18** |
| all presses within ±2s | 14 / 135 |
| uniform whole-plan translation | 16 / 135 (8 of them moving ≥2 presses) |

⚠ **"Retiming" does not mean "small".** The per-row worst single-press shift has median **24s** and runs
to 360s, and the median row moves **6** presses. What is near-degenerate is the *score*, not the layout:
these are visibly different plans that the model prices within a whisker of each other.

**The load-bearing number is 58/135.** In those columns the model's own margin is at or below the
harness's ±0.02% resolution — i.e. **the model does not have an opinion to be wrong about**. Their sim
margins are not all small either (median 0.025%, but 11 at ≥0.10% and 4 at ≥0.20%, worst **0.362%**). No
search fix can address a column where the scorer is indifferent; the whole 58 is a **resolution** problem
in the objective, which is a metric-design question, not a ranking bug. The other 77 columns do carry a
real model preference (median sim 0.040%) and are the ones a scorer term could in principle fix.

#### (c) ★★ The largest non-KT deficit in the round is an 8-second shift of ONE track that the model calls a dead tie

`isc-skull short T=99 lust=49 @sim40 ← plan@70`, **sim 0.362%** (the worst non-KT column in round 5),
model `87.8336` vs `87.8282` = **0.006%**, and the *entire* difference is:

```
IV: [8,28] vs [0,20]        CS: [28] vs [20]
```

Icon and Skull are byte-identical on both plans. So on a 99s cold-open fight the sim pays **0.36%** for
opening Icy Veins at **0** instead of **8** — and the model prices the two layouts 0.006% apart.

**That is the signature of a debt already on the books:** *"Haste covering the opening ramp is
under-credited by ~+0.079 pp"* (DIARY open debts; PHASE8 §15.5 F5; RULES §3) — the model pays ramp
overlap **exactly 0.000** by design (`index.html:926-928`), so it has no reason to pull the opening haste
window onto the ramp, and the sim rewards doing it. The magnitude fits the direction of the scaling too:
the debt was sized at ≈0.03 pp on a 229s fight, and the ramp is a far larger fraction of a **99s** fight.
It is also a **low-haste, short-fight** cell, which is where the recorded low-haste slack lives.

**A corpus-wide check of the same asymmetry, and it is a LEAD, not a finding.** Over all 135 columns,
per-press direction is dead flat — haste presses moved earlier by the sim-preferred plan **247 vs 238**
(z≈0.4), value presses **163 vs 146** (z≈1.0), i.e. no global "earlier is better" bias. But restricted to
the **first** haste window of the fight, the sim-preferred plan opens it **earlier in 33 rows vs later in
18** (z≈2.1, p≈0.04); the sharper form (rival opens a haste window at t=0 where native does not) is
**18 vs 10**, z≈1.5, **not** significant.

⚠ **That is one test at p≈0.04, framed after seeing the striking cell — exactly the post-hoc sieve §5.15c
was written to forbid, so it is recorded as a lead and nothing is concluded from it.** The escape from the
post-hoc trap is a **pre-registered** prediction, and it is available: the ramp term is a *known* defect
with a *known* sign and an *existing* measurement instrument (the §15.5 F5 position sweep). Patch the ramp
credit, and the prediction to declare in advance is that the flipping cells are the ones whose diff is an
opening-haste-window placement — with the flat per-press population unmoved. If patching it moves a
different population, the mechanism is wrong. ⚠ The patch is a **scorer** change: it moves goldens, so it
lands after the round closes, gated by exact-match + the duel (`tools/plan-duel.mjs`) on every moved cell.

> #### ⛔ §5.16c RESOLVED — 07-25: the pre-registered ramp-patch test above is VOID, and the cell is an INSTRUMENT ARTIFACT
>
> *(Appended, not rewritten — this doc is the historical record. The paragraphs above state what was
> believed on the evidence then; this states what the follow-up probes found. Read them in order.)*
>
> **The ramp mechanism is falsified twice over, so there is no patch to run the test on.**
> 1. `tools/ramp-marginal.mjs` (pre-registered decision rule in its header) shows the model's ramp-coverage
>    credit is **exactly floor-slack recovery**: **0.0000 pp floor-free**, which the algebra proves is the
>    *correct* answer (coverage `3 + (Dh + T − Rb − D)/c` ≡ interior `3 + (Dh − Rb + T − D)/c`), and
>    **+0.3298/+0.3455/+0.4063/+0.4077 pp** for IV/MQG at R=40/70 once Lust drives the steady cast into the
>    1.0 s floor — with **Berserking under the same Lust at exactly 0.0000** as the within-regime control
>    (its steady cast, 1.023/1.004 s, never crosses the floor). PHASE8 §15.5 F5's flat reading came from a
>    **single-buff, therefore floor-free** sweep, where 0.000 is right. ⇒ **`index.html:919-931` is correct
>    as written**; the sim's +0.079 pp is a residual with no identified mechanism (a *sim-setup audit
>    trigger* per CLAUDE.md, not a model bug — PHASE8 §7 forbids encoding it).
> 2. **This specific cell has no ramp physics in it.** Both layouts are **floor-free at the opening** (IV
>    alone at R=40 ⇒ m=1.2304, steady cast 1.219 s, 0.219 s slack), so the model's 0.006% is *correct*.
>
> **What the 0.362% actually is: the tail-lattice ripple** (RULES §8, `tools/lattice-ripple.mjs`). The sim's
> expected damage under a uniform kill in `[T−KW, T+KW]` is a **sum over integer casts**; the model computes
> its **continuum limit**. Same taper width (`KILL_WINDOW = 0.5` ≡ `--var 0.5`), different kind — residual
> `1 − W/c` casts, **exactly 0 at the GCD floor**, `0.3164` at this fight's tail rate `c = 1.4629 s`.
> Evaluating the sim's own formula on the model's own cast list (no wowsims run needed):
> **continuous −0.0062%** (reproducing this section's 0.006% to the digit — the instrument is validated) vs
> **discrete +0.6046%** — a **sign flip** — against wowsims' **+0.3617%**. The diagnostics name it:
> native's last cast completes at **99.6216 s, past `T+KW = 99.5`, weight 0 — wholly wasted**; the rival's at
> **99.3041 s** (weight 0.196) and it fits one more. It is the razor-edge whole-cast parity trap `xval.mjs`
> documents for `var=0`, surviving at `var=0.5` because the taper (1.0 s) is **narrower** than the tail cast
> period (1.463 s).
>
> **⚠ Do NOT read that as "discretize the scorer."** The full-column control (all 11 rows at sim-haste 40)
> shows the discrete sum picks the sim's argmax (row 70) where the integral picks 40 — fixing the disputed
> ranking — while being a **worse predictor across the column**: `r = 0.7910` / RMSE 0.2948 vs the integral's
> `r = 0.9337` / RMSE 0.2431, with two-signed errors up to +0.669 pp. Discretization adds variance without
> removing bias, which independently re-derives `index.html:875-877` (the per-cast sum *was* the old model
> and produced the phantom "press 2 s before Lust" gains). **The integral stays.**
>
> **Consequences for this phase.** (i) The §5.16c pre-registered test cannot be run and is retired
> unresolved-by-void, not failed. (ii) The corpus-wide LEAD above (first haste window earlier, 33 vs 18,
> z≈2.1) **loses its proposed mechanism** and drops back to an unexplained correlation — it must not be
> cited as ramp evidence. (iii) The (d) caveat *"it may be the (c) ramp mechanism wearing a different hat"*
> is void for the same reason. (iv) `diagWorst` itself is **positively biased for a perfect model**
> (`+0.094…+0.165%` at R=10, n=81) because it maxes a two-signed ripple over ~10 rival rows — which merges
> with §5.16b's 58/135 resolution finding into one conclusion: **on short/low-haste tables the ruler, not the
> model, is the binding constraint.** The criterion restatement is a user call (ACCEPTANCE, coverage gaps).

#### (d) The two persistent columns, at track level

`tools/diagnose-deficit.mjs` dossiers only the **best** borrower per column, while `xval-persist.mjs`
follows **one specific** rival across lengths — so the persistent pair is only partly covered here (3 of
`isc-mqg h40`'s 5 lengths, 1 of `isc-skull h20`'s 4; at the other lengths plan@70/plan@100 still beat
native but some *other* plan beat it by more).

| column | native vs rival (differing tracks only) | sim% | model Δ |
|---|---|---|---|
| `isc-mqg` medlong `@sim40 ← plan@70` | `AP[8,188]→[5,185]` `Zerk[0,188]→[5,185]` `Icon[29,183]→[5,182]` `MQG[9]→[25]` `IV[0,20,200]→[5,25,205]` `CS[20]→[25]` | 0.260 | −0.027 |
| `isc-mqg` long `@sim40 ← plan@70` | `AP[5,187]→[4,260]` `Zerk[5,251]→[20,260]` `Icon[5,131,251]→[20,140,260]` `MQG[187]→[0]` `IV[5,187,251]→[0,20,260]` `CS[251]→[20]` | 0.094 | −0.005 |
| `isc-mqg` xl `@sim40 ← plan@70` | every track **+1s** except `MQG[8,378]→[9,384]` and `IV[9,198,378,423]→[10,204,384,424]` | 0.073 | −0.107 |
| `isc-skull` short `@sim20 ← plan@100` | `Zerk[59]→[49]` `Skull[69]→[0]` `IV[7,39]→[0,20]` `CS[39]→[20]` | 0.066 | −0.279 |

Two of the four (medlong, and `isc-skull` short) share one contrast: **native places the on-use
damage/SP trinket OFF the haste stack** (`Icon@29` against haste at 0/8/9/20; `Skull@69` against
`IV[7,39]`/`Zerk@59`) **and the sim's preferred rival stacks it ON** (`Icon@5` with `AP/Zerk/IV@5`;
`Skull@0` with `IV@0`). The other two do not — `long` is an MQG placement swap, and `xl` is close to a
whole-plan **+1s translation** that the sim prefers by 0.073% while the model prefers native by 0.031%.
⚠ Do **not** promote the trinket-stacking reading to a rule on 2 of 4 rows; it is listed because it is
the only repeated contrast, and because `isc-skull` short's rival also pulls `IV` to 0 — i.e. it may be
the (c) ramp mechanism wearing a different hat rather than an independent stacking rule.

---

### ⛔ §5.16d — THE 135 PRICED CORPUS-WIDE: 80% below the ruler, and the residual is 9 CELLS (07-25)

*(Appended after §5.16c. Instrument: `tools/ripple-audit.mjs`. No sim runs — see below for why that is
legitimate rather than a shortcut.)*

§5.16c closed the disputed cell by deriving the **tail-lattice ripple** (`1 − W/c` casts peak-to-peak,
RULES §8). This section extends it from **one cell to all 135** round-5 deficit columns, which converts the
acceptance failure from a population to be attacked cell-by-cell into a **9-cell target list**.

**Why it needs no sim.** Every round-5 column was measured at `--var 0.5` — precisely the taper width the
closed form assumes — so the floor is *arithmetic on the model's own cast list*:

> `ripplePct = 100 · (1 − W/c) / Nt`, `W = 1.0 s`, `c` = the **kill-edge** cast period (`last.interval`),
> `Nt = robust / dmg_tail` = the fight total expressed in **tail-cast equivalents**.

`Nt` is not a raw cast count on purpose: the tail cast is unbuffed, so dividing by casts would credit the
fight with buffed casts it does not have at the edge and would **overstate** the floor.

**Five predictions were pre-registered in the tool's header before the first run** (P1 coverage ≥70% ·
P2 `ρ(floor, deficit) > 0` · P3 the Kael'thas-420 family must EXCEED the bound or the bound is meaningless ·
P4 a **vacuity guard** — `BOUND UNINFORMATIVE` if >95% inside AND median floor >3× median deficit ·
P5 an arithmetic self-check that median floor falls monotonically short→xl). **All five pass:**

```
RIPPLE-AUDIT-DONE priced=135 inside=97 over=24 indet=14 unpriced=0 rho=0.118 mono=1 vacuous=0
P5 median floor by class:  short 0.282  medium 0.183  medlong 0.112  long 0.101  xl 0.078  (%)
```

| bucket | n | reading |
|---|---|---|
| **inside the floor** | **97 / 121 decided = 80.2%** | deficit is under the instrument's own resolution |
| INDETERMINATE | 14 | verdict flips with the ambiguous kill-edge period; held out of **both** buckets |
| **over the floor** | **24** | the gradeable set — and what makes the bound non-vacuous |

Median deficit **0.035%** vs median floor **0.134%**: the typical column is **3.8× below the ruler**. But
`ρ = +0.118` is *weak*, so the honest reading is that the floor is a **ceiling, not an explanation** — it
bounds the artifact budget, it does not predict which cells spend it. Out-of-sample support the derivation
was never fitted to: §5.16c's cell **saturates its own ceiling to 0.002 pp** (0.362% vs 0.360%).

**The 24 split four ways, and only one way is evidence about the scorer:**

- **KT-AoE (6)** — Kael'thas 420 s, including the two worst columns overall (0.377% / 0.363%). Carries its
  own AoE and wall-parity channels ⇒ **no scorer inference**; it is what makes the bound discriminating (P3).
- **SATURATED (5)** — over by **<0.03 pp**, sitting *on* their ceiling. Confirmatory, not a defect signal:
  the amplitude is peak-to-peak and `diagWorst` is a `max` over ~10 rivals, which selects for the worst
  tail phase.
- **RESIDUAL (4)** — genuinely over with a slow tail (`c` = 1.20–1.50 s): `isc+skull long 293 @130`
  (0.279 / 0.114) · `isc+mqg medlong 229 @40` (0.260 / 0.170) · `mqg+skull long 283 @0` (0.193 / 0.151) ·
  `isc+skull xl 417 @70` (0.080 / 0.049).
- **★ FLOOR-TAIL (9) — THE SHARP TARGET, and a genuinely NEW partition.** Kill-edge period at/near the GCD
  floor ⇒ **the ripple is provably ~0, exactly 0.000% for three of them**, against deficits of
  0.040–0.166%. And the family's *shape* is the **mirror image** of the ripple-explained one: sim-haste
  median **240** (min 70) and T median **395** (min 218), versus **110 / 218** for the explained cells
  (computed and printed by the tool, not asserted). **One mechanism cannot be behind both.**

| FLOOR-TAIL cell | deficit % | floor % | `c` (s) | `Nt` |
|---|---|---|---|---|
| **`mqg+skull` xl T=395 @265** ← *cleanest in the whole ledger* | **0.090** | **0.000** | 1.000 | 351 |
| `scb+skull` medlong 218 @260 | 0.166 | 0.034 | 1.073 | — |
| `isc+skull` xl 417 @155 | 0.129 | 0.009 | 1.034 | — |
| `scb+skull` long 366 @240 | 0.088 | 0.029 | 1.080 | — |
| `mqg+skull` Vashj 390 @295 | 0.074 | 0.022 | 1.051 | — |
| `mqg+skull` xl 395 @70 | 0.066 | 0.030 | 1.082 | — |
| `isc+skull` xl 417 @130 | 0.049 | 0.013 | 1.047 | — |
| `mqg+skull` Vashj 390 @235 | 0.048 | 0.036 | 1.082~ | — |
| `isc+skull` xl 417 @260 | 0.040 | 0.000 | 1.000 | — |

**Next step is `mqg+skull xl T=395 @265`**: floor *exactly* zero, and **not a boss row** — no wall and no
AoE phase — so **no artifact channel is available to explain it away.** Every other family above has one.

**⚠ Two errors made inside this audit, both caught by the pre-registered checks rather than by review.**
(1) The 28 cells whose tails were not a constant regime were first priced with `c` = **min over the last 3
casts**, reasoned as *conservative* (smaller `c` ⇒ smaller floor). The P5 monotonicity check **flipped to
FAIL** and a low-haste cell landed in FLOOR-TAIL where it is physically nonsense: the ripple is set by the
lattice spacing **at the kill edge**, the taper is only 1.0 s wide, and a `min` reaches back into a
*different buff regime*. Fixed to `last.interval`, `min` retained as a sensitivity read, and any cell whose
verdict flips between the two reported **INDETERMINATE**. *Being conservative about the NUMBER while being
wrong about the DERIVATION is not conservative.* (2) The first FLOOR-TAIL write-up **asserted** a
"high-haste/long-fight" shape with a low-haste cell visible in its own printed list; fixed by making the
tool compute and print both families' distributions.

**⚠ What "inside the floor" does and does not license.** It says the deficit is **unmeasurable at this
taper width** — *not* that the model is right there. It is emphatically **not** a licence to discretize the
scorer (§5.16c's column control, RULES §8's ⚠ clause). And restating the acceptance criterion as *"deficit
below the ripple floor"* rather than *"no deficit"* is a **user call**, filed in ACCEPTANCE's coverage gaps
— note that widening `KILL_WINDOW` to shrink the floor would change the **objective itself**.

### ⛔ §5.16e — FLOOR-TAIL WORKED: two hypotheses falsified, and the TARGET LIST WAS MIS-ORDERED (07-25)

§5.16d handed the round-5 residual down to **9 cells** — the `FLOOR-TAIL` family, whose ripple floor is
provably ~0 because `c → 1.000` ⇒ `W/c → 1`. This section works it. **Both pre-registered hypotheses were
falsified, and the more useful result is that the family was never the right target.** No `index.html`
change; `tools/` + `docs/` only.

**Instruments** (each stage `--json`-dumps for the next, so pricing and scoring each exist exactly once):

```
node tools/xval-collect.mjs tools/xval-results --json /tmp/targets.json
node tools/ripple-audit.mjs  /tmp/targets.json --json /tmp/priced.json
node tools/floor-plateau.mjs /tmp/priced.json  --json /tmp/scored.json
node tools/ambient-gap.mjs   /tmp/scored.json
```

#### The stratification that motivated it (measurement, and it stands)

Stratifying the 135 priced rows by kill-edge period: floored (`c ≤ 1.10`) n=12 median deficit **0.066 %** vs
slow (`c > 1.10`) n=123 median **0.033 %** — unconditionally only z=1.41, **p=0.16, not significant**. But
**haste is a NEGATIVE confounder**: inside the slow stratum, `simH ≥ 200` median **0.020 %** vs `simH < 200`
median **0.041 %** (z=−2.30, **p=0.021**) — which is just the ripple's own 1/N. Controlling for it therefore
*strengthens* the floor effect: within `simH ≥ 155`, floored n=10 median **0.074 %** vs slow n=48 median
**0.018 %** (z=2.29, **p=0.022**); same sign at ≥200 (p=0.034) and ≥230 (p=0.026). ⚠ Those three cutoffs
overlap heavily — that is **one** test at p≈0.02–0.03, not three.

⚠ **A tempting reading was killed on the way in.** All 9 FLOOR-TAIL cells contain `skull`, against a corpus
base rate of 51.9 % (naive p=2.7e-3). But `skull` is **Skull of Gul'dan — `kind:"rating"`, +175 haste**
(`index.html:608`), so its rating is *what floors the edge*: the family is near-tautologically skull-heavy.
The discriminating check: **off the floor, skull cells have if anything a SMALLER deficit than non-skull ones
(0.031 % vs 0.036 %, n=59/64).** Confounder, not cause — the operative variable is the floor.
★ *Lesson: check the buff table before reasoning about a kit.* The first pass of this analysis assumed
`skull` was a **spell-power** trinket and built an entire story about stacking SP into AP's ×1.30 window.
Reading `index.html:608` inverted it — `mqg+skull` is haste+haste, and at h=265 `IV(1.20)·(1+(265+175)/1577)
= 1.535` ⇒ `1.5/1.535 = 0.977` ⇒ clamped to 1.000, exactly the `c = 1.000~` the audit had printed.

#### H_PLATEAU — FALSIFIED (`tools/floor-plateau.mjs`, verdict=VALUATION)

RULES §2 certifies the floor's **location** against the sim to one rating point (§PHASE8 round 4 F1), so the
suspect was never the formula — it was what the formula does to the **search**:

> `H_PLATEAU`: past the floor the rate integral is exactly **flat** in surplus haste, so the model is
> **indifferent** among placements differing only in surplus haste. The sim is not: at Δ=1.0 s its cast
> lattice is a **staircase**. Where the model has a plateau the sim has steps, so the model lands on an
> arbitrary plateau point (chosen by the legibility/canonical tie-breaks, which are **not** a maximization)
> while the sim has a best step. Predicts a deficit that is small, one-sided, and concentrated at the floor.

Pre-registered **P1**: median |model Δ| must be **SMALLER** in the floored stratum. Observed the opposite —
**0.0543 % floored vs 0.0325 % slow** (z=1.29, p=0.20) — so **P3 FALSIFIER fired**. The model is not
indifferent at the floor; its own margin there is *comparable to the sim deficit it is supposed to be blind
to*. Indifference is contradicted cell by cell, which does not depend on the between-stratum p-value.

- **P4 SELF-CHECK PASS** — floored cells really are floored: time at the GCD cap **15.6 % vs 5.7 %**
  (z=2.67, **p=0.0076**). So `c = last.interval` is not picking up one lucky last cast, and the
  stratification above is a real measurement.
- **P2** — model prefers native **12/12**. ⚠ This is a **validity check, not evidence**: `dModel ≥ 0` holds
  **by construction** (native *is* the model's argmax at that haste), so only a search miss can flip it.
  Zero misses ⇒ pooling did its job. Only the **magnitude** carries content, and that is what P1/P3 tested.
- **The obvious replacement candidate died on sign.** A mis-sized floor-slack/ramp credit
  (`index.html:919-931`) is worth **+0.33…+0.41 pp** when the floor binds — big enough that a ~15 % error in
  it *would be* these deficits. But `Spearman(capFrac, deficit) = −0.135` over all 135: more time at the cap
  ⇒ *smaller* deficit. Disfavoured before it was pursued. (Post-hoc, so hypothesis-generating only — but a
  wrong-signed lead is refused either way.)

#### H_AMBIENT — ALSO FALSIFIED, and this is where the real finding is (`tools/ambient-gap.mjs`)

`floor-plateau` produced one post-hoc reading worth a proper test: the **joint** disagreement was nearly flat
across strata. The sim reports `pct` (rival beat the model's pick), but the model also had an opinion,
`dModel` (how much it preferred its own pick, re-scored at the **common** haste). The rankings are apart by
the **sum**, and `joint = dModel + pct` is what a fix must close.

> `H_AMBIENT`: the joint disagreement is a roughly **constant corpus-wide scale** (~0.1 pp) and the ripple
> floor governs only how much of it is **masked**. Then FLOOR-TAIL is not a family at all — it is the corner
> where `W/c → 1` removes the ruler and an ordinary gap becomes visible.

| label | n | med joint pp | med sim deficit pp | med floor pp | vs `inside` |
|---|---|---|---|---|---|
| inside | 111 | 0.0814 | 0.0250 | 0.1386 | 1.00× |
| **FLOOR-TAIL** | 9 | **0.1061** | 0.0740 | **0.0221** | **1.30×** |
| KT-AoE | 6 | 0.2364 | 0.2100 | 0.0865 | 2.90× |
| SATURATED | 5 | 0.2677 | 0.1930 | 0.1894 | 3.29× |
| RESIDUAL | 4 | 0.2744 | 0.2600 | 0.1510 | 3.37× |

`AMBIENT-GAP-DONE verdict=AMBIENT-DEAD n=135 rhoJoint=0.187 rhoPct=0.118 a1=1 a2=0 a3=0 spread=3.37`

**A1 PASS** (ρ(joint, floor) = 0.187 < 0.20) · **A2 FAIL** (spread **3.37×** > 2.0) ⇒ **A4 fired, H_AMBIENT
is dead**: the post-ripple residual is **not** homogeneous, so at least one localized mechanism remains.
**A3 FAIL** on the point estimate (needed ρ(pct,floor) > ρ(joint,floor); got 0.118 vs 0.187) — ⚠ but those
are two rank correlations on the *same* 135 rows differing by 0.07; that is not a distinguishable difference
and A3 should be read as **undecided**, not as a result.

**★★★ The finding: it is NOT FLOOR-TAIL that breaks homogeneity.** The band is broken by **KT-AoE (2.90×),
SATURATED (3.29×), RESIDUAL (3.37×)**, while **FLOOR-TAIL sits at 1.30× — inside the band, the closest of
the four over-floor families to ambient.** It only *looked* like the sharp target because its own floor is
0.022 pp, **6× below `inside`'s 0.139**: ranking by the **masked** quantity mis-ordered the target list.
⇒ **Retarget to the 15 cells of KT-AoE + SATURATED + RESIDUAL.** And ⚠ `SATURATED` needs re-deriving: it is
*defined* as "<0.03 pp over the ceiling", and its "confirmatory, not a defect" reading (§5.16d) was inferred
from that definition — in the joint currency it is the **second-worst family**.

Second corollary, corpus-wide: the ambient joint gap of ~0.081 pp is mostly `dModel` (median `pct` inside the
floor is only 0.025 pp) ⇒ **the model is routinely ~0.06 pp more confident than the sim confirms,
everywhere.** That is the instrument's own noise floor in the joint currency, and it is the scale every
remaining family must be judged against.

#### ⚠ Errors made in this section

1. **An assumption was smuggled into a verdict string.** `ambient-gap`'s A4 falsifier text, as first written,
   said a failure would mean *"the floored corner carries extra disagreement"* — because FLOOR-TAIL was the
   family under investigation. A4 fired and the blame lay **elsewhere**. Leaving it would have planted a
   false claim inside a committed tool. Fixed by making the report **compute** which labels break the band
   (and naming FLOOR-TAIL's position explicitly when it does not), with the correction dated in-file. The
   **test** is unchanged. ★ *Lesson: pre-registration must fix the test, not narrate the expected
   explanation.*
2. **The `skull`-trinket premise** (above) — assumed SP, is haste. Caught by reading `index.html:608` before
   it reached a doc, but it had already shaped a paragraph of analysis.

#### ⚠ What this does and does not license

Nothing here localizes anything to a line of the engine, and **no `index.html` change is licensed** by any
of it. `H_PLATEAU`'s death removes the tie-break story; it is **not** a licence to add a sim-shaped
quantization term to the scorer — §5.16c's column control already refused that (r 0.7910 vs 0.9337). And the
acceptance-criterion restatement (*"deficit below the ripple floor"* vs *"no deficit"*) remains a **user
call**, filed in ACCEPTANCE's coverage gaps.
