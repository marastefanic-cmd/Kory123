# PHASE 7 — Fix the cross-val deficits (make the acceptance test PASS)

**Status:** PLANNED (in flight). Phase 6 gathered the data and proved the measurement correct; Phase 7
**dives into the results and fixes the root causes** so that the next run of `docs/ACCEPTANCE.md` passes
fully. This is the "fix" phase the user scoped: *not* accept the basin — kill it.

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
