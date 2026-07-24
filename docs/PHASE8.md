# PHASE 8 — the B2 scorer-gap family (reserved for the highest-effort model)

**Status:** OPEN. Round-1 investigation done (07-24): the phase's original *canonical decomposition was
disproved* (a harness bug, see §1), the "emergent joint interaction" theory built on it is **withdrawn**,
and six candidate mechanisms are now ruled out with evidence (§3). What survives is a small, **systematic,
single-signed** model-vs-sim ranking error. §4 reframes how to measure it; §5 is the remaining task list.

Phase 7 fixed everything cheaper: three press-execution scorer terms (RULES §3b), two search passes, the
metric (var0.5 + wall-jitter), the KT AoE harness, and — the big one — **cross-haste pooling, which makes
model-side invariant B1 hold BY CONSTRUCTION** (ARCHITECTURE; scb+mqg medlong deficit 0.20% → **0.01%**).
What remains is a residual pooling CANNOT touch, because the model itself mis-ranks the two layouts.

## The representative target
**isc+mqg medlong, T=229, Lust@162, gear haste 70.** Two plans (fire times):

| | BL | AP | Zerk | Icon | MQG | IV | CS |
|---|---|---|---|---|---|---|---|
| **h40** (borrowed; the sim's winner) | 162 | 8, 188 | 0, 188 | 29, 183 | 9 | 0, 20, 200 | 20 |
| **h70** (native; the model's pick) | 162 | 4, 192 | 6, 192 | 4, 182 | 202 | 0, 20, 202 | 20 |

Shape: **h40 front-loads haste** (Zerk@0 + IV@0 + MQG@9 + IV@20) and takes its damage/SP later (Icon@29);
**h70 front-loads damage** (AP@4 stacked with Icon@4) and saves haste for the kill (MQG@202 on IV@202).

**The error:** sim (CRN seed 11, 20k iters, var-robust) says h40 wins by **+0.360%**; the model says
**−0.02%** (it prefers h70). Ranking error ≈ **0.38pp**, and it is single-signed across every fight length.

## §1 — ⚠ THE ORIGINAL DECOMPOSITION WAS INVALID (harness bug, not physics)
The prior version of this doc claimed: *"Moving ONLY MQG@202→@9 captures the whole deficit: sim +0.461%."*
**That measurement never placed MQG at 9.** The h70 layout presses Icon@4, and wowsims puts every on-use
offensive trinket on a **shared category-1141 lockout whose duration is the trinket's own buff duration**
(`sim/common/shared/shared_utils.go`, `SharedCD: {Timer: sharedTimer, Duration: config.Duration}` = 20s).
So MQG was locked out until 25.18 and the APL fired it at the next cast boundary. Combat log (`SIMLOG=1`,
the exact spec `{"Icon":[4,182],"MQG":[9],...}`):

```
[ 5.18] Casting {ItemID: 29370}   <- Icon, requested @4
[25.18] Aura faded: {ItemID: 29370}
[25.64] Casting {ItemID: 19339}   <- MQG, requested @9, ACTUALLY FIRED @25.64
```

**The sim silently RETIMES an illegal schedule instead of rejecting it**, so the run "succeeds" and prints
a plausible number for a plan you never tested. The +0.461% was MQG@25.64-vs-@202, not @9-vs-@202.
Everything built on it — including the "emergent joint interaction of stacked-on-IV × terminal-cluster ×
near-kill" theory in §3 of the old doc — is **withdrawn**. (Gotcha recorded in TOOLING; ledger row in DIARY.)

Both *real* plans are legal and fire within ~1s of request (verified the same way): h40 MQG@9.06 →
Icon@29.07 (9+20=29 clears by 0.01s); h70 Icon@5.18 → MQG@202.13. **Always log-verify a hand-built
trinket schedule before trusting its delta.**

## §2 — What the deficit actually is
**A near-cancellation of two large opposing components.** Sim advantage of the h40 plan by fight length
(same CRN pair, var-robust):

| T | 40 | 70 | 100 | 140 | 180 | 205 | 229 |
|---|---|---|---|---|---|---|---|
| sim %(h40−h70) | **+7.850** | +5.666 | +4.217 | +3.116 | +2.435 | +2.387 | **+0.360** |
| model − sim (pp) | −0.316 | −0.093 | −0.098 | −0.059 | −0.208 | −0.084 | −0.380 |

h40's haste-loaded opener is worth ~+2.4pp all the way out; h70's last-24s MQG+IV@202 burst claws back
almost exactly as much by T=229. **The 0.36pp headline is the residue of two ~2.4pp terms**, which is why
every isolated probe "looks clean" — the signal is being measured where it is smallest.

**The model tracks the sim within 0.06–0.38pp at every length but is negative 7/7** (sign test p≈0.008).
That is a *systematic differential bias*, not noise: the model under-credits the haste-front-loaded plan
(or over-credits the damage-front-loaded one) by ~0.1–0.3pp at every duration.

## §3 — Ruled out (each with its evidence)
1. **Terminal-cast phase quantization** — PARTIAL, not the answer. `--var` sweep: 0 → +0.667%, 0.5 →
   +0.411%, 0.75 → +0.339%, 1.5 → +0.364%, 3.0 → +0.360%. It plateaus once the window exceeds one cast
   interval (1.436s), so quantization is worth ~0.30pp and **0.36pp survives full averaging**.
   (Also proved mid-fight phase-lock survives `--var`: only the fight's END is smeared.)
2. **Damage magnitudes / window membership** — CLEAN. Applying the model's damage formula at the *sim's*
   cast times reproduces +0.737%; window-membership counts match the sim **exactly** for h40 (29 AP,
   15 AP+Icon) and are +1 on both for h70.
3. **Boundary straddle** — CLEAN. AP press-time sweep 190→194 at var=3.0 is a staircase with ~0.01% steps;
   a cast lost at a window's front is regained at its back.
4. **GCD floor** — CLEAN. Sim min gaps 0.910/0.700 but only 2/1 occurrences (the known entry transient);
   the model floors at 1.000.
5. **`KILL_WINDOW` width mismatch** — CLEAN. The model returns −0.02% at KW ∈ {0.5, 0.75, 1.5, 3.0}
   (patched in-page, no repo edit). The scorer is *already* fully phase-averaged at the tail; the model's
   linear taper is exactly `P(duration ≥ t)` for a uniform kill. A genuine 0.38pp error survives.
6. **Press latency asymmetry** — WRONG SIGN. The sim fires a press at the next cast boundary, so h70's
   opener buffs (AP@4, Icon@4) land 1.18s late while h40's land ~0.06s late. But a later press in the
   opener starts on a *higher AB stack* (faster casts), which **favours h70** — the opposite of the
   deficit. Press lag makes the gap harder to explain, not easier.
7. **Tirisfal-2pc omission in the harness** — REAL BUG, but ~0.02pp here (see §6). Not the cause.

## §4 — How to measure it next (the conditioning fix)
**Stop measuring at T=229.** The full-fight delta is catastrophic cancellation: a 0.36pp answer built from
two ~2.4pp components, so a 4% relative bias in either term *is* the whole answer. **Measure at T=40**,
where the same layout question shows a **+7.850%** signal and the model's error is 0.316pp — a ~4%
relative error on a well-conditioned quantity, with the same sign as every other length.

The T=40 question is clean and small: *given a cold open, is haste-first (Zerk+IV+MQG) or damage-first
(AP+Icon) worth more over the ramp?* The sim says haste-first by 7.85%; the model says 7.53%. Find the
missing ~4% there, then confirm it closes the 0.38pp at T=229 as a consequence.

## §5 — Remaining task list
- **Re-run the isolation battery at T=40** with the conditioning fix, using **log-verified legal**
  schedules only (§1) and `cfg.t5two: true` (§6).
- **Interrogate the ramp × haste interaction.** All six ruled-out mechanisms were steady-state; the one
  regime both plans differ in most, and the one where the signal is largest, is the **opening ramp**
  (0 stacks → 3 stacks). The model's `rampCastDmg(ts, tc)` / `rampSpans` machinery is the prime suspect:
  does front-loaded haste compress the ramp *more* than the model's discrete ramp credits?
- Only then consider a core-integral term — high-risk, can move the 25 goldens, one hypothesis at a time
  and sim-gated exactly like the Phase-7 §3b terms.

## §6 — Harness calibration gap found in this round (fix in the NEXT xval round)
`tools/xval.mjs:111` and `tools/xval-model.mjs:53` build the model cfg **without `t5two`**, but the
reference export wears **Tirisfal 2pc** (items 30206/30196/30207 = Cowl/Robes/Leggings). Consequences:
the model scores AP's premium as ×1.30 where the sim's additive pooling gives ×1.25 on a T5'd AB stream
(TOOLING ★), and it under-weights the whole AB stream ×1.2 relative to AE.

**Measured impact is small for AB-only fights** — both plans press AP twice, so the change is nearly
rank-preserving: the B2 delta moves −0.02% → −0.04% with `t5two:true`. Round 4 stays meaningful (the shift
is an order of magnitude under the 0.3% deficit threshold). **The engine is correct** — `index.html` applies
`t5add` to the AB sites only (831, 899) and correctly *not* to the AE sites (829, 898). This is purely a
harness-side omission. **Do not fix mid-round** (it would change what a half-gathered acceptance run
measures); add `t5two: true` to both cfg builders at the start of the next round, and re-baseline.

## Guardrails (unchanged)
Determinism; exact-match 25/25; a golden may move ONLY if its effective-AB count improves AND it
sim-verifies (var0.5 CRN); B1 must stay clean by construction (pooling); monoDip=0. The full acceptance
re-run (var0.5 + wall-jitter, pooling ON) is the thorough gate — run it after any core-integral change.
