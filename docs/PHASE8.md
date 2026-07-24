# PHASE 8 — the B2 scorer-gap family (reserved for the highest-effort model)

**Status:** OPEN. **Round 1** (07-24): the phase's original *canonical decomposition was disproved* (a
harness bug, §1), the "emergent joint interaction" theory built on it is **withdrawn**, and six candidate
mechanisms are ruled out with evidence (§3). **Round 2** (07-24): §4's proposed conditioning fix
(*"measure at T=40"*) is itself **disproved** (§4), and the round switched to **single-buff steady-state
marginals swept across haste** — which produced the phase's first hard result, **THE FLOOR LAW** (§5,
10/10 with a mechanism proof), a two-correction error decomposition that **zeroes the mean model-vs-sim
bias** (§7), and a surviving haste-correlated residual whose **sign is wrong for B2** (§8) — a genuine
falsification: B2 is *not* a single-buff SP-valuation error. §9 records the leads closed this round; §10 is
the task list for round 3.

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

## §4 — ⚠ THE "MEASURE AT T=40" CONDITIONING FIX IS ALSO WRONG (round-2 correction)
The round-1 version of this section said: *"Stop measuring at T=229 … **Measure at T=40**, where the same
layout question shows a **+7.850%** signal."* The **diagnosis** (§2's catastrophic cancellation) stands.
The **prescription** does not.

**Truncating the fight changes the question.** The h70 plan presses `MQG@202` and `IV@202`; at T=40 those
presses never fire at all. So the T=40 delta is not *"haste-first vs damage-first over the ramp"* — it is
**h40's full kit vs h70's kit minus its second trinket use**, a cooldown-*presence* comparison. That is why
the signal is 20× larger: it is measuring a missing trinket, not a layout. Every length in §2's table below
~205 is contaminated the same way, monotonically less so as T grows — which fully explains the smooth decay
from +7.850% to +0.360% without any physics. **A truncated fight is a different plan, not the same plan
measured better.**

**The conditioning fix that actually works: single-buff steady-state marginals.** Base = pure AB spam;
variant = base + **exactly one** buff pressed at t=30 in a T=100 fight (window fully interior — no ramp
overlap, no kill-taper interaction, no cooldown-presence confound), CRN-paired, and **swept across haste**.
The signal is ~1.3% — small in absolute terms but it is the *whole* quantity, not a residue of two large
terms, so a 4% relative model error shows up as a 4% relative error. It also isolates one physics term at a
time and makes the haste dependence directly readable. This is what round 2 ran; §5 and §7 are its output.
(Probes: `scratchpad/p8/{iso-model,floorsweep,frac,calib,counts,times}.mjs`.)

## §5 — ★★★ THE FLOOR LAW (round 2's hard result)
**A value-multiplier buff window of duration `D` covers exactly `floor(D/Δ)` casts in the sim.** The model's
rate integral credits the fractional `D/Δ`. Over-credit = `frac(D/Δ) × premium`, always ≥ 0.

**Measurement.** Icon of the Silver Crescent (+155 SP, 20s) pressed at t=30, T=100, cold open, CRN seed 11,
haste swept 0→300 rating. Boosted casts counted by **CRN damage-difference** (§9), Δ computed analytically
as `Δ(R) = 1.5/(1+R/1577)` (§9):

| haste R | Δ | D/Δ | **floor** | **CRN-boosted** | sim % | model % | err pp |
|---|---|---|---|---|---|---|---|
| 0 | 1.50000 | 13.3333 | 13 | **13** | 1.401 | 1.321 | −0.080 |
| 40 | 1.46289 | 13.6715 | 13 | **13** | 1.284 | 1.320 | +0.036 |
| 70 | 1.43625 | 13.9252 | 13 | **13** | 1.228 | 1.320 | +0.092 |
| 78 | 1.42931 | 13.9928 | 13 | **13** | 1.229 | 1.320 | +0.091 |
| 82 | 1.42586 | 14.0266 | 14 | **14** | 1.303 | 1.319 | +0.016 |
| 120 | 1.39393 | 14.3479 | 14 | **14** | 1.236 | 1.319 | +0.083 |
| 160 | 1.36183 | 14.6861 | 14 | **14** | 1.123 | 1.318 | +0.195 |
| 200 | 1.33118 | 15.0243 | 15 | **15** | 1.211 | 1.318 | +0.107 |
| 240 | 1.30187 | 15.3625 | 15 | **15** | 1.170 | 1.318 | +0.147 |
| 300 | 1.26026 | 15.8698 | 15 | **15** | 1.108 | 1.316 | +0.208 |

**10/10, and both integer crossings are captured** — h78→h82 straddles 13.993/14.027 inside a *4-rating-point*
window, and h160→h200 straddles 14.686/15.024. The sim column **sawtooths** (it jumps at each crossing and
decays between); the model column is **flat** (1.321→1.316) because `(D/Δ)/(T/Δ) = D/T` is haste-independent.
That shape difference *is* the error.

**Mechanism proof (not a fit).** Two facts compose:
1. wowsims applies a damage/SP modifier at **cast COMPLETION** (`applyEffects`, `sim/core/cast.go:216/258/
   338/356`) — not at cast start, not pro-rata.
2. The APL can only press at a **cast boundary** (φ=0, TOOLING "GCD-boundary quantization"), so the first
   buffed *completion* is a full Δ after the press.

Prediction: `firstBoostedCast − auraGain == Δ` exactly, at every haste. Measured lag: **1.500, 1.460, 1.440,
1.430, 1.420, 1.390, 1.360, 1.320, 1.300, 1.260** — Δ at every point (log quantization is 0.01s). The window
therefore spans `[gain+Δ, gain+D]`, holding `floor(D/Δ)` completions.

**★ Haste buffs are EXEMPT.** A haste buff's value is time-compression, which does not expire with the
window — it rolls forward to the fight END, where `--var` / the model's kill taper handle the fraction. Only
**value multipliers** (SP, damage) are floored. Do not apply this correction to MQG/IV/Zerk/Lust.

**Is it a model bug?** *Not necessarily — it is first a harness expressiveness limit.* `index.html:764`
justifies fractional credit with a phase-average argument: over a uniform press phase, `E[casts in window]
= D/Δ`, unbiased. That is **correct for a human** — TBC on-use trinkets and Arcane Power are off-GCD and can
be pressed mid-cast, so a real mage draws from the full phase distribution. The **sim is boundary-locked**:
it can only ever realise φ=0, the *minimum* of that distribution. So the model describes the player and the
sim describes one corner of the player's options. **The honest statement: the model over-credits a value
window by `frac(D/Δ) × premium` relative to the sim, and by `≈ ½ × premium/(D/Δ)` less than that relative to
a real mid-cast presser.** Quantified on this probe the boundary-lock alone is worth **≈ +0.036pp**
(the h40 row, where `frac` is smallest). This upgrades §3.1 ("terminal-cast phase quantization — PARTIAL")
from a tail effect to a law that applies to **every** value window, not just the terminal one.

## §5b — Consequence for RULES §3b.3
RULES §3b.3 states *"a ramp cast's damage snapshots its buff state at cast START."* The **fix it prescribes
is correct** (a press-snapped window must not credit the in-flight cast it fired after), but the stated
**mechanism is wrong**: wowsims snapshots at cast *completion* (§5, source-checked). The two agree at the
front edge precisely because the press is boundary-snapped — "completion of the cast in progress" *is* the
start of the next one. They **disagree at the back edge**: on the completion rule the cast in flight when
the aura fades is *not* buffed, so a start-snapshot model over-credits the window's last partial cast. That
back-edge over-credit is exactly the `frac(D/Δ)` term above, arriving from the other direction — a candidate
refinement, **not yet implemented** (see §10).

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

## §7 — Error decomposition: two corrections ZERO the mean bias
Same probe as §5 (Icon marginal, 10 haste points). Applying the two known harness-side corrections in turn:

| model correction | mean err | RMS | corr(haste, residual) |
|---|---|---|---|
| raw (as shipped) | **+0.0895 pp** | 0.1208 | +0.839 |
| + floor law (×`floor(D/Δ)`/(D/Δ)) | +0.0414 pp | 0.0878 | +0.916 |
| + floor + **effective SP 1450** | **+0.0084 pp** | 0.0781 | +0.913 |

**Effective SP is ≈1450, not the harness's 1387.** The export wears **Tirisfal 4pc** (`SpellID: 37444`,
+70 SpellDamage on crit), and the combat log states it outright — every AB `[DEBUG]` line reads either
`SP: 1386.2` (proc down) or `SP: 1456.2` (proc up), an exact +70. Measured uptime is **88–94%** ⇒
`effSP ≈ 1386 + 0.9·70 ≈ 1449`. A +155 SP window is worth ~2.4% less on a 1450 base than on a 1387 base,
a **flat** shrink. (⚠ *Disproved sub-hypothesis*: I predicted uptime would **rise with haste** — more casts
⇒ more crits ⇒ more procs — and that this would explain the haste-growing residual. It does not: the
measured uptime has **no haste trend**. Recorded rather than quietly dropped; DIARY ledger.)

Together the two corrections take the mean bias from +0.0895 pp to **+0.0084 pp** — i.e. **the model's
single-buff SP valuation is unbiased once the harness is described correctly.** Neither correction belongs
in `index.html`: the floor law is a property of the *sim's* press lattice (§5) and the SP figure is a
property of *this export's* gear. Both belong in the harness and in expectations.

## §8 — ✗ The surviving residual has the WRONG SIGN for B2 (falsification)
A strongly haste-correlated residual survives all corrections (r ≈ +0.91), spanning **−0.147 pp at h0 to
+0.103 pp at h300**. Positive at high haste means: **the model over-credits an SP window as the ambient cast
rate rises.**

Now apply that to the B2 pair (§ target table). The h40 plan puts **Icon@29 riding MQG+IV** — i.e. its SP
window sits at the fight's *highest* effective haste. The h70 plan puts **Icon@4 bare**. So correcting this
residual would **lower h40's model score** and make the model prefer h70 *more*.

**B2 would get wider, not narrower.** The one hard number round 2 produced about the model's SP valuation
therefore **cannot** be the B2 mechanism — it pushes the wrong way. This retires "the model misprices SP
under haste" from the candidate list and is the round's most useful negative result.

⚠ **Scope:** this falsifies the **residual**, i.e. what is left *after* the floor correction. The floor
correction itself points the **other** way and is a (small) genuine pro-h40 term — see **§12**.

## §9 — Leads CLOSED this round (do not re-open)
**The "model fits more casts than the sim" denominator lead — CLOSED, it is a counting convention.**
Model base cast counts read +1 at low haste and *+2* at high haste versus the sim, a denominator effect with
exactly the residual's shape. It is an artifact of how each side counts:

| haste | model `castCount` | sim **completions** | sim Hit\|Crit lines | Miss |
|---|---|---|---|---|
| 0 | 66 | 65 | 65 | 0 |
| 40 | 68 | 67 | 67 | 0 |
| 70 / 78 / 82 | 69 | 68 | 68 | 0 |
| 120 | 71 | 70 | 69 | **1** |
| 160 | 73 | 72 | 71 | **1** |
| 200 | 74 | 73 | 72 | **1** |
| 240 | 76 | 75 | 74 | **1** |
| 300 | 79 | 78 | 77 | **1** |

- **`model = sim completions + 1` at EVERY haste, exactly.** `index.html:834` counts casts that **START**
  before `T` (`if (t < cfg.T) castCount++`); the combat log shows **COMPLETIONS**. One cast is always in
  flight at the kill ⇒ a constant, haste-independent +1. (h300: model's last start 99.98; sim's last
  completion 99.96, then `Casting …` at 99.96 that never completes.)
- **The apparent haste-growing "+2" was my own regex.** wowsims enforces a hard **1% miss floor** no hit
  rating clears (DIARY row 129); a miss logs as `Miss`, not `Hit`/`Crit`, so a Hit|Crit-only count drops it.
  At ~70+ casts the CRN stream's first miss lands, and exactly 1 miss appears from h120 up.
- **No score impact either way:** `castCount` is board/UI only — the score is the `rateAt` integral over
  `[0,T]`. The convention difference cannot corrupt a ranking.

## §10 — Task list for round 3
- **Fix the harness first, between rounds** (§6 and §7): `t5two: true` **and** `sp: 1450` at
  `tools/xval.mjs:111` / `tools/xval-model.mjs:53`, then re-baseline. Rank-neutrality already checked on the
  B2 pair — shipped −0.020, +t5two −0.040, +t5two+effSP −0.037, effSP only −0.017; **all pick h70**, so no
  gathered round is invalidated (the sim says h40 by +0.360%).
- **Re-run the isolation battery as single-buff steady-state marginals** (§4's real conditioning fix), not
  at a truncated T. Use **log-verified legal** schedules only (§1) and the corrected cfg.
- **Sweep the OTHER buffs across haste** the way §5 swept Icon — now upgraded from "should sawtooth" to a
  **pre-registered, crossed, one-rating-point prediction**. See §11; the rig is built and ready to fire.
- **Interrogate the ramp × haste interaction** — still the least-probed regime, and the one both B2 plans
  differ in most. Prime suspect remains `rampCastDmg(ts, tc)` / `rampSpans`.
- **Consider the §5b back-edge refinement** (charge a value window its unfinished last cast) — but note
  §8: it moves B2 the wrong way, so it must be justified on its own physics, not as a B2 fix. High-risk,
  can move the 25 goldens; one hypothesis at a time, sim-gated like the Phase-7 §3b terms.

## §11 — ★ ROUND 3'S PRE-REGISTERED TEST (prediction recorded before the sim ran; **verdict in §13**)

Round 2 established the floor law by *measuring* ten hastes and finding the floor. That is strong, but it
is still a fit: the law was read off the same data it explains. §11 removes that objection. The law
predicts **where** the sawtooth steps, in closed form, from the window duration alone — so the step
locations can be written down first and the sim asked to agree.

    Δ(R) = 1.5/(1 + R/1577)          (export base spell haste = 0%: the R=0 log gives exactly 1.5000)
    D/Δ  = (D/1.5)·(1 + R/1577)      ⇒   step to floor n at   R = 1577·(1.5n/D − 1)

In the 0–300 rating range that gives, for the buffs we can press in isolation:

| buff | D | kind | predicted step locations |
|---|---|---|---|
| **Icon** (29370, +155 SP) | 20s | value/sp | **R = 78.85, 197.1** (and 315.4, out of range) |
| **SCB** (22044 w/ 30720 worn, +225 SP) | 15s | value/sp | **R = 157.7** |
| **Arcane Power** (12042, ×1.30 dmg) | 15s | value/dmg | **R = 157.7** |
| Icy Veins (12472) | 20s | haste | **none** — exempt |
| MQG (19339) | 20s | haste | **none** — exempt |
| Berserking (20554) | 10s | haste | **none** — exempt |

**The design is CROSSED, and that is the point.** Neither buff is "the one that steps":

- at **R = 78 → 79**, Icon must jump (**+0.091 pp**) and AP must not;
- at **R = 157 → 158**, AP must jump (**+0.345 pp**), SCB must jump (**+0.126 pp**), and Icon must not;
- at **R = 197 → 198**, Icon must jump again (**+0.085 pp**) and AP/SCB must not.

Each bracket is **one rating point wide** — as sharp as the instrument goes. A step that lands on a
predicted integer, and *only* on the predicted integer, cannot be a curve fit.

Four falsifiers, each killing a different clause:

1. **AP fails to jump at 157→158, or jumps elsewhere** → the floor law is wrong for ×dmg buffs.
2. **AP and SCB (same D=15, different kind) do not jump TOGETHER** → the sawtooth follows the *buff*, not
   the *window*; the whole "floor(D/Δ)" framing is mis-stated.
3. **Icon jumps at 157→158, or fails to jump at 78→79 and 197→198** → *D* is not what sets the step.
4. **Any of IV / MQG / Zerk steps at any of the three locations** → §5's haste exemption is overturned,
   which would be the most consequential outcome of the round (it would mean the model over-credits
   *every* haste window too, not just value windows).

Falsifier 4 is a **genuine** null, not a freebie: at 78→79 and 197→198 the D=20 window floor *does* change
(13→14, 14→15) for IV and MQG as well — the mechanism is present and available to fire. The exemption
claims it doesn't matter there because a haste buff's value is time-compression that rolls to the fight
**end**, not damage credited **inside** the window.

**★ Why the two classes need different `--var`, and why that is not a fudge.** A **value** buff does not
change cast timing at all — base and buffed runs have byte-identical cast boundaries, so the marginal is a
pure damage ratio and the fight end cancels *exactly*; `--var 0` is correct and adds no confound. A
**haste** buff *does* change timing, so base and buffed end the fight mid-cast at different phases, and at
`--var 0` that terminal partial cast is a **second quantizer — at the fight end** — which would masquerade
as a window step. `--var` must exceed one cast interval (>1.5s) to phase-average it. The haste legs are
therefore run at **both** var 0 and var 3.0, so the difference is measured rather than assumed.

**Retrospective check (already passing).** Round 2's measured Icon transitions were 13→14 somewhere in
(78, 82] and 14→15 somewhere in (160, 200]. The closed form says 78.85 and 197.1 — both inside the
observed brackets, with no free parameter. §11 tightens those brackets from 4 and 40 rating points to
**one**.

**Rig (built, fired, analysed — see §13):** `scratchpad/p8/r3model.mjs` computes and prints the
prediction above (model leg only — run it again to reproduce the table); `scratchpad/p8/r3sweep.sh` runs
the sim leg — nine single-buff legs pressed at t=30 in a T=100 cold-open infinite-mana fight, over the
grid `0 40 70 78 79 120 150 157 158 197 198 240 300`, with the SCB leg on a 30720-equipped export
(`tools/xval.mjs:59` — the Mana Emerald only grants +225 SP while the braid is worn). Raw output at
`scratchpad/p8/r3/r3sweep.txt`. It was held back on a *believed* CPU conflict with the acceptance round;
timing one runner call at **0.716 s** (⇒ ~4 min for the whole sweep) dissolved that — measure, don't assume.

## §12 — ★ THE FLOOR LAW *IS* A B2 MECHANISM — right direction, ~9.5% of the magnitude
§8 falsified the **residual** as a B2 mechanism. It never asked what the **floor correction itself** does to
the ranking, and the two point *opposite* ways. Worth separating, because the answer is the first mechanism
found that pushes B2 the **correct** direction.

Why they differ: the residual grows with the *ambient* cast rate, so it punishes h40's Icon-riding-MQG+IV.
The floor loss is `frac(D/Δ) × premium` — it is **largest when Δ is large**, i.e. at *low* haste, so it
punishes h70's **bare** windows. Same two windows, opposite sign.

Computed on the actual B2 plans (`scratchpad/p8/frac.mjs`; per-window Δ from each press's local buff state,
premium = the buff's per-cast multiplier over a plain AB):

| plan | buff | press | Δ | D/Δ | frac | prem% | lost ABs |
|---|---|---|---|---|---|---|---|
| h40 | arcanePower | 8 | 1.088 | 13.786 | 0.786 | 25 | 0.1965 |
| h40 | arcanePower | 188 | 1.105 | 13.577 | 0.577 | 25 | 0.1443 |
| h40 | isc | 29 | **1.000** | **20.000** | **0** | 6.47 | **0** |
| h40 | isc | 183 | 1.105 | 18.103 | 0.103 | 6.47 | 0.0066 |
| h70 | arcanePower | 4 | 1.463 | 10.254 | 0.254 | 25 | 0.0635 |
| h70 | arcanePower | 192 | 1.105 | 13.577 | 0.577 | 25 | 0.1443 |
| h70 | isc | 4 | 1.463 | 13.672 | 0.672 | 6.47 | 0.0435 |
| h70 | isc | 182 | 1.105 | 18.103 | 0.103 | 6.47 | 0.0066 |

| plan | totalDmg | sim under-credit | % of total |
|---|---|---|---|
| h40 | 510732 | 713 | **0.140%** |
| h70 | 511298 | 529 | **0.104%** |

**Predicted sim bias favouring h40 = 0.036 pp.** The observed model-vs-sim gap is **0.38 pp**. So the floor
law explains **~9.5%** of B2 — the sign is right, the magnitude is an order of magnitude short. B2 is not the
floor law wearing a disguise.

**The h40 `isc@29` row is the striking one.** `D/Δ = 20.000` *exactly*: at that press the local haste makes
Δ = 1.000s and a 20s window fits twenty whole casts with nothing left over. h40's Icon window is a
**perfect-fit** window and loses **nothing** to the press lattice — which is precisely why h40's total loss
is only modestly larger than h70's despite carrying the deeper AP fractions. Had the optimizer been *aware*
of the lattice it would presumably hunt for exactly this, and the coincidence is a hint that a floor-aware
scorer would change *which* presses it likes, not just their scores. Not a change to make on this evidence
(§5b: it must be justified on its own physics), but it is the strongest argument yet that §5b is worth the
risk.

**What this does and does not overturn.** §8 stands exactly as written — the *residual*, post-correction,
still has the wrong sign, and "the model misprices SP under haste" is still retired. §12 adds that the
*correction it was measured on top of* is itself a small pro-h40 term. Both are real; neither is B2.

## §13 — ★★★ ROUND 3'S VERDICT: the floor law SURVIVES, in a corrected and **more general** form

The sim leg of §11 is fired and analysed. Three of the four pre-registered falsifiers behaved as the law
required; the fourth **fired**, and chasing it down produced a *stronger* law and a live B2 lead. Nothing
here changes `index.html` — these are facts about the harness and about what the count should *expect* the
sim to say, not about the plan the tool emits.

### 13.1 The corrected law

> **A buff window of duration `D` covers exactly `floor(D_eff / Δ_inside)` casts**, where `Δ_inside` is the
> cast interval **in force inside the window** and `D_eff` is the window's true aura duration.
> For a **value** buff `Δ_inside = Δ` (the buff does not move the cast boundaries).
> For a **haste** buff `Δ_inside = Δ_buffed` (it does).

Round 2's wording — "value buffs floor, **haste buffs are exempt**" — is **falsified**. The exemption was an
artifact of having only ever measured haste buffs at `--var 0`; see §13.4. The `Δ_inside` form subsumes
round 2 exactly (for value buffs it *is* round 2) and predicts three further step locations that round 2
could not, all of which were then observed out of sample.

Closed form, unchanged: `Δ(R) = 1.5/(1+R/1577)`, step to floor `n` at `R = 1577·(1.5n/D − 1)`.

### 13.2 Scorecard against the four pre-registered falsifiers

| # | pre-registered falsifier | verdict |
|---|---|---|
| 1 | *AP fails to jump at 157→158, or jumps elsewhere* | **SURVIVES.** AP flat at 155/156/157 (`+3.5224 / +3.5224 / +3.5226`), jumps to `+3.8220` at 158. Predicted `+0.345 pp`, observed `+0.2994 pp`. |
| 2 | *AP and SCB (same D=15, different kind) do not jump together* | **FIRES — then resolved by measurement.** SCB steps at 156→157, AP at 157→158. Cause in §13.3. The clause is dead *as literally worded*; the law survives in the `D_eff` form. |
| 3 | *Icon jumps at 157→158, or fails to jump at 78→79 and 197→198* | **SURVIVES on physics.** Icon jumps at 78→79 (`+0.0915` vs predicted `+0.091`), does **not** jump at 157→158, and jumps at 196→197 (`+0.0853` vs predicted `+0.085`). The `197|198` bracket was simply the wrong *pair* — ms quantization puts the step at ≈196.9, so both grid points sit post-step. A refinement sweep at 194–198 found it. |
| 4 | *any of IV/MQG/Zerk shows a step* | **FIRES.** IV shows a deterministic `+0.23 pp` step at exactly 196→197 (at `--var 3.0`), precisely where `20000/Δ_IV` crosses 18 (`17.9902 → 18.0058`). MQG, same `D=20` but a smaller haste bonus, correctly does **not** (`17.7799 → 17.7885`, no integer crossed). |

Falsifier 4 firing *while MQG stayed flat at the same D* is what makes it a law rather than noise: the law
predicted **which** of two same-duration haste buffs would step, and was right.

### 13.3 ★ The 10 ms aura tell — why SCB steps one rating point before AP

Falsifier 2 was resolved by reading the combat log (`SIMLOG=1`), not by fitting. At R=157 every on-use
gains its aura at exactly the cast boundary `[30.46]` — Icon (`ItemID: 29370`), AP (`SpellID: 12042`),
IV (`12472`), MQG (`ItemID: 19339`), Zerk (`20554 Tag 1`). **SCB (`SpellID: 37445`) alone gains at
`[30.47]`** — one 10 ms tick later, because it is a **proc off the Mana Emerald use**, not a direct
on-use aura. So `D_eff(SCB) = 15.010 s` against `15.000 s` for AP, and at R=157:

```
15000/Δ = 10.9968  → floor 10        15010/Δ = 11.0041  → floor 11
```

**The 10 ms *is* the step.** Predicted SCB step `156.6` ⇒ bracket `(156, 157]`; observed
`156=+1.3446 → 157=+1.4913`. Exact hit. Two hypotheses were killed first and are worth recording: *different
gear ⇒ different base haste* (dead — the two exports' base staircases are identical in shape) and *the Mana
Emerald consumes a GCD ⇒ a **shorter** effective window* (dead — wrong sign).

### 13.4 ★ The `var=0` / `var>0` dichotomy — and the B2 lead

Confirmed four times: **value** buffs step identically at `var=0` and `var=3.0`; **haste** buffs step
**only** at `var>0` and are flat at `var=0`.

```
Icon var=0 : 194=+1.209 195=+1.209 196=+1.209 197=+1.294 198=+1.294
Icon var=3.0 194=+1.212 195=+1.212 196=+1.211 197=+1.295 198=+1.295
IV   var=0 : 194=+4.168 195=+4.168 196=+4.168 197=+4.167 198=+4.167   ← flat through its own step
IV   var=3.0 194=+4.178 195=+4.184 196=+4.169 197=+4.405 198=+4.405   ← steps
MQG  var=3.0 194=+3.959 195=+3.960 196=+3.949 197=+3.951 198=+3.950   ← no integer crossed, no step
```

The reading: **at `var=0` the fight-end quantizer exactly compensates the window floor.** A haste window
that loses a fractional cast inside itself hands that time back at the kill, where a fixed `T` re-floors it;
the two floors cancel. Jitter the fight length past one cast interval and the end-quantizer phase-averages
away, leaving the window floor exposed. Round 2 measured haste buffs only at `var=0` and therefore saw the
sum, not the terms.

**This is a haste × kill-boundary interaction — i.e. exactly the shape B2 is defined to be** ("the emergent
joint haste×damage×kill interaction that every isolated decomposition reports CLEAN"). It is the first
mechanism found that is *invisible to every single-axis decomposition by construction*: isolate haste at
fixed `T` and the two floors cancel; isolate the kill boundary without a haste window and there is nothing
to cancel against. **Lead status: live, highest-priority.** Do not act on it in the engine yet — it needs a
magnitude, measured the way §12 measured the value-window loss.

### 13.5 Out-of-sample confirmations (locations not in the round-3 grid)

| buff | predicted step | observed | |
|---|---|---|---|
| IV (2nd step) | `R = 98.6` | `(98, 99]` — var=3.0: `98=+4.119 → 99=+4.353` | exact hit |
| Zerk | `R = 143.4` | `(144, 145]` — var=3.0: `144=+1.034 → 145=+1.168` | **one rating point late** |

Zerk's miss is ≈0.1% in the assumed `×1.10` multiplier or a sub-ms aura detail of the same family as §13.3
— it is a constant, not the law's *form*. Left open; it does not affect anything downstream.

### 13.6 The measured-Δ table (the instrument)

The log states cast time outright — `Casting {SpellID: 30451} (… Cast Time = 2.274s, GCD = 1.364s …)` —
which is a far better instrument than differencing timestamps. Two byproducts:

- **AB's 3-stack cast time *is* the GCD.** AB ramps `2.274 → 1.970 → … → 1.364 s`, and at 3 stacks cast
  time == GCD. This is *why* `Δ(0) = 1.5 s` exactly: it is AB at 3 stacks, not gear haste.
- **wowsims quantizes cast time to whole milliseconds** — independently evidenced by IV ≡ MQG byte-identical
  DPS at several hastes and by R=197 ≡ R=198 across all nine legs. This is what defeated the `197|198`
  bracket and is now a standing caution: **a one-rating-point bracket is only as sharp as the ms grid.**

```
R= 78: Δ=1429.062 ms  20000/Δ=13.9952   |  R= 79: Δ=1427.969 ms  20000/Δ=14.0059
R=157: Δ=1364.030 ms  15000/Δ=10.9968   |  R=158: Δ=1362.941 ms  15000/Δ=11.0056
R=196: Δ=1334.058 ms  20000/Δ=14.9919   |  R=197: Δ=1332.899 ms  20000/Δ=15.0049
```

Also settled in passing: **`--seed` IS wired** (seeds 99/12345 give 2461.3/2461.7 against 2461.2 for
11/12/13); the apparent seed-invariance in earlier rounds was one-decimal DPS output granularity, not a
dead flag. The IV `var=3.0` jump was checked against that: identical across four seeds and still `+0.228 pp`
at 200k iterations.

## Guardrails (unchanged)
Determinism; exact-match 25/25; a golden may move ONLY if its effective-AB count improves AND it
sim-verifies (var0.5 CRN); B1 must stay clean by construction (pooling); monoDip=0. The full acceptance
re-run (var0.5 + wall-jitter, pooling ON) is the thorough gate — run it after any core-integral change.
