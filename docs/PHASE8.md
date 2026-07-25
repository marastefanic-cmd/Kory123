# PHASE 8 — the B2 scorer-gap family (reserved for the highest-effort model)

**Status:** OPEN. **Round 1** (07-24): the phase's original *canonical decomposition was disproved* (a
harness bug, §1), the "emergent joint interaction" theory built on it is **withdrawn**, and six candidate
mechanisms are ruled out with evidence (§3). **Round 2** (07-24): §4's proposed conditioning fix
(*"measure at T=40"*) is itself **disproved** (§4), and the round switched to **single-buff steady-state
marginals swept across haste** — which produced the phase's first hard result, **THE FLOOR LAW** (§5,
10/10 with a mechanism proof), a two-correction error decomposition that **zeroes the mean model-vs-sim
bias** (§7), and a surviving haste-correlated residual whose **sign is wrong for B2** (§8) — a genuine
falsification: B2 is *not* a single-buff SP-valuation error. §9 records the leads closed this round; §10 is
the task list for round 3. **Round 3** (07-24/25, §11–§13): the floor law **survives in a corrected, more
general form** — one window, **two sampling rules** (value buffs read at cast completion ⇒ `floor`, haste
buffs read at cast start and frozen ⇒ `ceil`), which halves the model-vs-sim residual and kills the
"haste buffs are exempt" claim (§13.1/§13.7). But applied to the B2 pair the whole lattice-quantization
family has the **wrong sign**, so **B2's residual target RISES from 0.38 pp to 0.445 pp** (§13.8) — and
§12's earlier "correct direction" verdict was a sign error of mine, banner-corrected in place. The round's
closing result (§13.9): the signed residual is **positive on every buff at every haste** (a 0.369 pp
*level*, which cancels in B2 because both plans carry identical window multiplicities) with **no haste
slope on any leg that clears its own noise** — the most generous scaling reaches 0.048 pp against 0.445.
**B2 is excluded from per-buff valuation entirely; it is a layout property** (window×window or
window×kill). **Round 4** (07-25, §14): the **stacked-haste / GCD-floor** probe, pre-registered before it
ran. **F1 PASSES** — three crossed sets cross the floor at three different ratings and the sim's marginal
kinks inside the same single rating point the model does in all three, so `Δ = max(1.5/m, 1.0)` binding at
`m ≥ 1.5` is now **certified against the sim** and the floor leaves the suspect list. **F3 FAILS** —
`ΔI(IV+MQG+Zerk) = −0.259 ± 0.032 pp`, negative at 13/13 ratings, where B2 needs it positive; retired
same-day per pre-registration, and worth only −0.114 pp to B2 (wrong way). F4 explains it: `ΔI` decomposes
identically to `resid(S) − Σ resid(singles)`, so §13.9's per-buff under-credit simply **fails to stack** —
it is a **per-window** constant (ratio ≈ ⅓ for three buffs, no R-trend) and therefore cancels in B2 for the
same multiplicity reason §13.9's level did. **Window×window is out; window × kill is the sole survivor**,
and it is the one every probe so far is structurally blind to (all have measured steady-state fights that
never end). §15 must pre-register it. **Round 5** (07-25, §15): the **position sweep** (window × kill),
pre-registered. **F2 passes exactly** — the model's haste marginal is flat in press position to
**0.0000 pp**, so `index.html:926-928` really does implement the position-independence axiom to the last
digit. **F4 FAILS**, `Σ = −0.063 pp` (R=40) / `−0.109 pp` (R=70) where B2 needs positive; retired same-day,
the fifth firing of that clause. With per-buff valuation excluded (§13.9), window×window retired (§14.6)
and now window×kill retired, **B2 has no candidate expressible in a single-buff fight at all** — F3's
pre-registered consequence, so the phase switches instrument class to the **two-plan differential** (§16).
One real finding did come out of it: **★ haste covering the opening ramp is under-credited by ~+0.079 pp**
(6/6 haste legs, both hastes) — the model pays it exactly 0.000, and this is a genuine defect of the
hardcoded axiom. It is not B2: the only ramp-coverage *difference* between the two plans is `Zerk@0` vs
`Zerk@6` on a ramp `IV@0` already covers in both, worth 0.009–0.027 pp against 0.445.
**Round 6** (07-25, §16): the **two-plan differential** — stop decomposing, walk the five-press path between
the two real layouts in both directions. **G1 reproduces §1's headline to four digits** (sim +0.3602%, model
legacy −0.0204%), and then **★★ G3 FIRES**: one move — `M34`, the **trinket pair** (`Icon 29,183→4,182` +
`MQG 9→202`) — carries **−0.325 pp of the −0.396 pp endpoint gap, 82% of B2**, same-signed in both
directions, against a −0.02…−0.06 pp background on the other three moves. The model **over-values the late
trinket cluster** (`Icon@182` + `MQG@202` stacked on `IV@202` in the last 27 s) relative to the early one
(`MQG@9` + `Icon@29`). G4 finds a real but small joint residue (0.063 pp, 16%); G5 says every move is
context-asymmetric but only M34's sign is stable. **The tension that explains five quiet rounds:** §15.5
priced `Icon` at *exactly* 0.000 and `MQG` at ≤0.053 pp **alone** — the defect is not in either buff's
valuation but in the two moving **as a pair**. Two structural by-products: wowsims' shared category-1141
lockout makes **every single-trinket intermediate illegal in both directions** (so M3/M4 are inseparable),
and **drift magnitude is not a sufficient legality test** — two of the four illegal plans were retimed by
only 2.0–2.1 s, under one cast interval. §17 pre-registers the split of `M34` into single presses.
**Round 7** (07-25, §17): the split, walked through a **parked** `MQG@100` so every intermediate clears the
lockout. **★★★ B2 IS ONE PRESS.** H1 passes decisively (path additivity to **0.0007 / 0.0003 pp**, ~70× under
the bar), **H3 exonerates `Icon`** (moving it alone costs **+0.0044 / +0.0027 pp**, confirming §15.5's exact
0.000 survives context), and **H2 fires on the pre-registered step P3** — `MQG 100 → 202`, arriving on
`IV@202` — worth **−0.2106 pp (ctx A) / −0.4068 pp (ctx B)**, i.e. **53–103 % of the whole −0.396 pp gap**,
with H4 showing P3 carries essentially all of the context asymmetry (0.196 pp of it, vs 0.05 and 0.002 for
the other steps). Stated plainly: moving `MQG` off a solo parking spot onto `IV` at the end of the fight, the
**model pays +0.26…+0.36 % and the sim pays ≈ 0**. Legacy inputs agree throughout. A third structural
by-product, now a standing gate: H5's a-priori check passed on all 8 plans, but the **cast-phase cascade**
still slid `IV#3` by 1.00 s across ctx-A's P3 — *"hold the rest fixed" is a property of the request, not the
execution* — and it is ctx **B** (controls still to 0.10 s) that carries the **larger** residual, which is
what rules the confound out rather than merely bounding it. §18 pre-registers the 2×2 that separates P3's two
conflated causes — **the stack** (two haste multipliers composing) vs **the kill** (a haste window with no
runway left to cash its saved time) — now legal at last because `Icon` can be switched off.

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

## §12 — the value-window floor loss on the B2 plans  ⚠ **VERDICT CORRECTED BY §13.8 — SIGN ERROR**

> **⚠ READ §13.8 FIRST.** This section's *table is correct and still used*; its **conclusion was wrong**.
> It claimed the floor correction "pushes B2 the correct direction, ~9.5% of the magnitude." It does not —
> I read `swing = L(h40) − L(h70) = +0.036` as *"the sim favours h40 by 0.036"* when `L` is the amount the
> **sim fails to deliver**, so a larger `L(h40)` means the sim rates h40 **lower**. The term is
> **anti-B2**. Kept in place, uncorrected in body, because the arithmetic below is the input §13.8 uses.

§8 falsified the **residual** as a B2 mechanism. It never asked what the **floor correction itself** does to
the ranking. The two do point *opposite* ways as a matter of magnitude-vs-ambient-rate — that part survives.

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

~~**Predicted sim bias favouring h40 = 0.036 pp.** The observed model-vs-sim gap is **0.38 pp**. So the floor
law explains **~9.5%** of B2 — the sign is right, the magnitude is an order of magnitude short.~~
**↑ WRONG (see the banner and §13.8).** `L(h40) = 0.140% > L(h70) = 0.104%` is the sim delivering **less**
of what the model credited *for h40*, so the sim rates h40 **lower** — the term is **anti**-B2 by 0.036 pp.
The one clause that survives unharmed: **B2 is not the floor law wearing a disguise.**

**The h40 `isc@29` row is the striking one.** `D/Δ = 20.000` *exactly*: at that press the local haste makes
Δ = 1.000s and a 20s window fits twenty whole casts with nothing left over. h40's Icon window is a
**perfect-fit** window and loses **nothing** to the press lattice — which is precisely why h40's total loss
is only modestly larger than h70's despite carrying the deeper AP fractions. Had the optimizer been *aware*
of the lattice it would presumably hunt for exactly this, and the coincidence is a hint that a floor-aware
scorer would change *which* presses it likes, not just their scores. Not a change to make on this evidence
(§5b: it must be justified on its own physics), but it is the strongest argument yet that §5b is worth the
risk.

**What this does and does not overturn.** §8 stands exactly as written — the *residual*, post-correction,
still has the wrong sign, and "the model misprices SP under haste" is still retired. ~~§12 adds that the
*correction it was measured on top of* is itself a small pro-h40 term.~~ **Corrected:** the correction is a
small **anti**-h40 term, i.e. it points the *same* way as the residual, not the opposite way. Both are real;
neither is B2; and together they make B2 slightly **harder**, not easier — §13.8.

## §13 — ★★★ ROUND 3'S VERDICT: the floor law SURVIVES, in a corrected and **more general** form

The sim leg of §11 is fired and analysed. Three of the four pre-registered falsifiers behaved as the law
required; the fourth **fired**, and chasing it down produced a *stronger* law and a live B2 lead. Nothing
here changes `index.html` — these are facts about the harness and about what the count should *expect* the
sim to say, not about the plan the tool emits.

### 13.1 The corrected law — **one window, two sampling rules**

> A buff window of duration `D_eff` covers, with `Δ_inside` = the cast interval **in force inside it**:
>
> | buff class | wowsims samples it at | casts covered |
> |---|---|---|
> | **value** (`+SP`, `×dmg`) | cast **COMPLETION** (`cast.go:216/258/338/356`) | `floor(D_eff / Δ)` |
> | **haste** (`×speed`, `+rating`) | cast **START** (`cast.go:138`, frozen into `Hardcast.Expires` at `:187`) | `ceil (D_eff / Δ_buffed)` |
>
> Both step at the same integer crossings of `D_eff/Δ_inside` — which is exactly why §13.2's step
> locations all landed while the *count* for the haste class was still wrong. See §13.7 for the
> measurement that separates them.

Two things get corrected here, at different times:

1. Round 2's **"haste buffs are exempt"** is falsified — they step, and where the closed form says
   (§13.2/§13.5). The exemption was an artifact of only ever measuring them at `--var 0` (§13.4).
2. The **`floor` for the haste class** — which is how I first wrote this section — is *also* wrong, and
   for a reason that is visible in the source rather than inferable from step locations. A value modifier
   is read when the cast lands, so a cast in flight at fade is unbuffed → `floor`. **Cast time is computed
   at cast start and frozen** (`spell.CurCast.CastTime = ApplyCastSpeedForSpell(…)`, then
   `Hardcast{Expires: sim.CurrentTime + spell.CurCast.CastTime}`), so a cast *begun* one tick before fade
   runs fast for its **whole** duration → `ceil`. **The sign of the model's bias is opposite between the
   two classes**, which is the whole reason §13.8 had to be computed.

Closed form, unchanged: `Δ(R) = 1.5/(1+R/1577)`, step at `R = 1577·(1.5n/D − 1)`. (That same `:138` line
carries the `.Round(time.Millisecond)` behind §13.6's quantization.)

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
fixed `T` and the two quantizers cancel; isolate the kill boundary without a haste window and there is
nothing to cancel against.

**Lead status after §13.8: DEMOTED, not dead.** The magnitude has now been measured the way §12 measured the
value-window loss, and it comes out **anti-B2 by 0.030 pp** — the cancellation is real and the mechanism is
real, but on these two plans it *widens* the gap. What survives as a live lead is the narrower claim: the
`var=0` cancellation proves the model and the sim disagree about **where a haste window's benefit lands in
time** (inside the window vs at the kill), and that is a genuine timing-of-value disagreement no single-axis
probe can see. It is the *shape* of B2 without being its *magnitude*.

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

### 13.7 ★ Which count? `floor` vs `ceil`, scored on all six buffs × thirteen hastes

Step locations cannot distinguish `floor(n)` from `ceil(n)` — both step at the same integer crossings, with
the same step height. What distinguishes them is the **level**: `floor` predicts the sim comes in *below*
the model everywhere, `ceil` *above*. Scored as mean `|sim − prediction|` in pp
(`scratchpad/p8/countform.mjs`; sim marginals from `r3/r3sweep.txt`, value legs at `var=0`, haste legs at
`var=3.0`; SCB carries §13.3's `D_eff = 15.010`):

| leg | class | n range | raw model | `×floor/n` | `×ceil/n` | rule for its class |
|---|---|---|---|---|---|---|
| Icon | value | 13.3–15.9 | 0.0407 | **0.0156** | 0.0748 | floor → 0.0156 |
| AP | value | 10.0–11.9 | 0.1465 | **0.0274** | 0.2996 | floor → 0.0274 |
| SCB | value | 10.0–11.9 | 0.0622 | 0.0779 | *0.0510* | floor → 0.0779 ⚠ |
| IV | haste | 16.0–19.0 | 0.1744 | 0.2854 | **0.0703** | ceil → 0.0703 |
| MQG | haste | 16.1–18.7 | 0.1615 | 0.2786 | **0.0504** | ceil → 0.0504 |
| Zerk | haste | 7.3–8.7 | 0.0833 | 0.1392 | **0.0217** | ceil → 0.0217 |

| pooled | raw | one rule for both: floor | one rule for both: ceil | ★ per sampling rule |
|---|---|---|---|---|
| value | 0.0831 | **0.0403** | 0.1418 | |
| haste | 0.1397 | 0.2344 | **0.0475** | |
| **all** | 0.1114 | 0.1373 | 0.0946 | **0.0439** |

**Per-sampling-rule beats the raw model by 2.5× and beats either single rule applied to both classes.** The
margins are not marginal: forcing `floor` on the haste class is 5× worse than `ceil` on IV and MQG. A
buff-by-buff vote agrees — 37 of 39 haste points sit closer to `ceil`, and *both* exceptions are at hastes
where `n` is an exact integer, where `ceil(n) == floor(n)` and the two hypotheses are the same number.

⚠ **The one leg the rule loses is SCB** (`floor` 0.0779 vs `ceil` 0.0510), and it is the leg whose `D_eff`
is least certain — the 10 ms offset of §13.3 is measured to log granularity, and with `n ≈ 11.00` an error
of a few ms moves the floor by a whole cast. Its measured 156→157 step (`+0.147 pp`) is also *larger* than
one floor step should give (`≈0.127`). Recorded as an open wrinkle; it does not move §13.8, where SCB is
absent from both plans.

### 13.8 ★★ The B2 accounting, both classes — quantization is **anti-B2**, and B2's target rises to 0.445 pp

With opposite-signed biases per class, only the net matters. Computed on the actual B2 plans, with each
window's `Δ` and `Δ_buffed` read off that plan's own cast stream so overlaps (IV under Lust, Zerk under AP)
are exact (`scratchpad/p8/hastefrac.mjs`):

| plan | value over-credit `L` | haste under-credit `U` | net model bias `L − U` |
|---|---|---|---|
| h40 | 0.140% | 0.075% | **+0.064%** |
| h70 | 0.104% | 0.105% | **−0.001%** |

Writing `S` for the sim's score and `M` for the model's, quantization says `S(p) = M(p) − L(p) + U(p)`, so

```
[M(h40) − M(h70)] − [S(h40) − S(h70)]  =  (+0.064) − (−0.001)  =  +0.065 pp
```

**Quantization predicts the model should read h40 0.065 pp HIGHER than the sim.** Observed (§2): the model
reads h40 **0.38 pp LOWER** (`sim +0.360%` vs `model −0.02%`). So the whole lattice-quantization family —
*both* sampling rules, value and haste — has the **wrong sign**, and removing it does not shrink B2 but
**enlarges** it:

> **B2's residual target is 0.445 pp, not 0.38 pp.**

Two consequences worth carrying forward:

- **The family is retired as a B2 candidate, not just the value half.** §12 retired the residual and
  (wrongly) promoted the correction; §13.4 promoted the haste half; both are now closed the same way. The
  remaining mechanism must be worth ~0.445 pp *on its own*, with two ~0.03 pp headwinds against it.
- **h70's net bias is ≈ 0 by cancellation** (`0.104` vs `0.105`), while h40's is `+0.064`. That is not
  designed — nothing in the optimizer knows about the lattice — but it is the second time (after §12's
  `isc@29` perfect-fit window) that the *high-haste* plan lands lattice-neutral and the low-haste one does
  not. If a §5b-style lattice-aware scorer is ever built, this is the pattern it would be exploiting, and
  the direction it would push presses.

### 13.9 ★★ The SIGNED residual vs haste — **B2 is not in per-buff valuation at all**

§13.7 scored *magnitudes* to pick the count form. With the form settled, the leftover is the interesting
object: `residual = sim − prediction`, **signed**, per buff, across all thirteen hastes. This is exactly the
"single-buff steady-state marginals across haste" battery §4 asked for — round 3's sweep already *is* that
data; it just needed the right prediction subtracted from it (`scratchpad/p8/resid.mjs`).

**Why the sign and the slope, not the level.** B2's signature is a mispricing that **grows with haste** —
that is what makes the model prefer h70 where the sim prefers h40. A per-buff error that is flat in haste
cannot produce it. And in B2's case that is not a soft argument but an exact cancellation: **the two B2
plans carry identical buff-window multiplicities** (AP ×2, Zerk ×2, Icon ×2, MQG ×1, IV ×3, Lust ×1 — see
the plans in §13.8). Any per-window valuation error that does not depend on haste appears the same number
of times in both and **cancels exactly** in `h40 − h70`. Only the haste *derivative* survives.

Residual in pp of total DPS; `+` = the sim beats the model.

```
              0     40     70     78     79    120    150    157    158    197    198    240    300
Icon  value+ 0.012+ 0.001+ 0.006+ 0.016+ 0.016+ 0.007+ 0.011+ 0.016-0.000+ 0.096+ 0.011+ 0.010+ 0.002
AP    value+ 0.027+ 0.009+ 0.019+ 0.041+ 0.042+ 0.028+ 0.035+ 0.049+ 0.003+ 0.035+ 0.037+ 0.027+ 0.005
SCB   value+ 0.069+ 0.087+ 0.122+ 0.111+ 0.116+ 0.061+ 0.060+ 0.093+ 0.078+ 0.093+ 0.093+ 0.019+ 0.010
IV    haste+ 0.036+ 0.017+ 0.032+ 0.033+ 0.042+ 0.029+ 0.048+ 0.050+ 0.049+ 0.333+ 0.109+ 0.043+ 0.093
MQG   haste+ 0.041+ 0.013+ 0.044+ 0.030+ 0.037+ 0.034+ 0.054+ 0.024+ 0.008+ 0.118+ 0.122+ 0.085+ 0.046
Zerk  haste+ 0.018-0.000-0.010+ 0.021+ 0.003+ 0.020+ 0.032-0.031-0.027+ 0.038+ 0.039+ 0.041+ 0.001
```

| leg | class | mean pp | sd pp | slope pp/300R | trend/noise | slope w/o R=197 | trend/noise |
|---|---|---|---|---|---|---|---|
| Icon | value | 0.0156 | 0.0246 | +0.0143 | 0.58 | −0.0040 | 0.70 |
| AP | value | 0.0274 | 0.0146 | −0.0067 | 0.46 | −0.0088 | 0.58 |
| SCB | value | 0.0779 | 0.0342 | −0.0764 | 2.24 | −0.0835 | 2.36 |
| IV | haste | 0.0703 | 0.0828 | +0.1224 | 1.48 | +0.0658 | 2.49 |
| MQG | haste | 0.0504 | 0.0362 | +0.0618 | 1.71 | +0.0487 | 1.56 |
| Zerk | haste | 0.0111 | 0.0243 | +0.0161 | 0.66 | +0.0103 | 0.43 |

**Every residual is positive.** After the corrected count, the sim still beats the model on *every* buff at
*every* haste, by +0.011 to +0.078 pp per window. Summed with B2's multiplicities that is a **0.369 pp
level** the model gives away on a full layout — a real number, and a decent share of the ~0.4% absolute
model-vs-sim agreement we quote. But it is a *level*: identical in both plans, so it contributes **exactly
zero** to B2. (It is, however, the right place to look if the *absolute* agreement is ever tightened.)

**No leg has a haste trend worth anything.** The largest `trend/noise` in the raw fit is SCB's 2.24 — and
SCB's slope is **negative**, the wrong direction, and SCB is absent from both B2 plans. IV (1.48) and MQG
(1.71) are the only positive-sloping legs and both sit inside ~2σ. Scaling every slope by its B2 press
count — taking all six at face value, including the ones deep inside noise, and letting them all stack in
whichever direction they happen to point:

```
layout slope  = 0.476 pp / 300R   →  over B2's 30-rating gap:  0.0476 pp     (target 0.445 → ×9 short)
   w/o R=197  = 0.241 pp / 300R   →  over B2's 30-rating gap:  0.0241 pp     (            → ×18 short)
```

> **VERDICT: B2 does not live in any single buff's valuation.** The most generous upper bound this battery
> permits is ~0.05 pp against a 0.445 pp target — an order of magnitude short, and that is *before* noting
> that the slopes do not survive their own error bars. Whatever B2 is, it is a property of the **layout**:
> an interaction between windows, or between windows and the kill boundary, that a single-buff fight with
> no overlap and no meaningful end effect cannot express. This is consistent with §10's finding that every
> *isolated* decomposition reports CLEAN, and it converts that from a frustration into a positive result —
> the isolation batteries are not failing to find B2, they are **excluding** it from their domain.

**The R=197 caveat.** That column is a visible cross-leg outlier (IV +0.333, MQG +0.118, Icon +0.096). It is
not a mechanism: §13.6 measured the ms-quantization step at ≈196.9, so at R=197 the analytic `Δ(R)` and the
sim's `.Round(time.Millisecond)` cast time straddle a crossing and disagree by a hair — an instrument
artifact of the prediction, not of the sim. It is included above unmodified, and the "w/o R=197" columns
show the verdict does not depend on it (dropping it *halves* the layout slope). Worth knowing that IV's
trend is the one that firms up when it is dropped (`trend/noise` 1.48 → 2.49, on a slope of +0.066 pp/300R):
that is a small real haste-dependence in IV's valuation, ~7× too small for B2 but the only survivor here,
and the natural first candidate if a per-buff term is ever revisited.

**What this rules in.** With per-buff valuation excluded and the whole quantization family retired (§13.8),
the surviving B2 candidates are all *joint*: window–window interaction (the ramp seen through overlapping
haste and damage buffs), and window–boundary interaction (how a haste window's compressed time interacts
with the kill). Round 4's remaining item — the `rampCastDmg` / `rampSpans` × haste interrogation — is
squarely in that space and is now the next probe, not one of several.

## §14 — ROUND 4, PRE-REGISTERED: the **stacked-haste / GCD-floor** probe (window × window)

*Written and committed before the sim ran. §13.9 said B2 is a layout property; this is the first probe
whose domain actually contains one.*

### 14.1 The structural gap round 3 left

Every round-3 leg pressed **one** buff. Write `m` for the cast-speed multiplier; the AB interval is
`max(1.5/m, 1.0)` — at 3 stacks the cast time (`2.5 − 3×⅓ = 1.5 s`) and the GCD base are the *same
number*, so both clamp together and **the floor binds at exactly `m ≥ 1.5`**. Model (`index.html:902`
`intervalAt`, `GCD_FLOOR: 1.0`) and sim (`core/constants.go:13` `GCDMin = 1s`) agree on the constant.

The largest `m` any single buff reaches anywhere in the round-3 grid is **1.428** (IV at R=300). So:

> **No round-3 measurement ever touched the GCD floor.** The whole battery lives in the regime where
> haste is linear, and is structurally incapable of saying anything about the regime where it is not.

### 14.2 Why this is B2's regime specifically

At the target's gear (R=70), the two B2 plans sit on opposite sides of that line:

| | its distinguishing haste cluster | `m` | interval | floor? |
|---|---|---|---|---|
| **h40** (the sim's winner) | opener: **IV@0 + Zerk@0 + MQG@9** | **1.655** | 1.000 s | deep in it |
| **h70** (the model's pick) | kill: **IV@202 + MQG@202** | **1.504** | 1.000 s | *barely* over |

h40's opener is a triple stack **43% past** the floor; h70's kill cluster clears it by **0.3%**. A
mispricing of floor-bound haste is therefore (a) invisible to every single-buff probe by construction,
(b) differential between exactly these two plans, and (c) a *window × window* effect — the shape §13.9's
exclusion left standing. It also lands on the one hard-coded modelling assumption in the ramp block
(`index.html:926`): *"haste shortens a span but never changes its cast COUNT … so haste gains nothing
from covering the ramp."* That is a statement about the linear regime. h40 presses its stack **into the
opener ramp**, where casts are `(2.5 − ⅓·stacks)/m` and the floor does **not** bind, while the steady
state right after it is pinned at 1.0 s. Whether the two sides of that hand-off agree is untested.

### 14.3 The design — crossed on the floor crossing

Same rig as round 3 (T=100, press at t=30, cold open, infinite mana, CRN seed 11, 20k iters), but the leg
is a **set** of haste buffs pressed together. Each set crosses `m = 1.5` at a rating computed from
`R* = 1577·(1.5/mult − 1) − rating_add` (`scratchpad/p8/floorcross.mjs`):

| set | mult | +rating | floor crosses at R | in a 0–300 grid |
|---|---|---|---|---|
| IV | 1.20 | 0 | 394.3 | never floors |
| MQG | 1.00 | 330 | 458.5 | never floors |
| Zerk | 1.10 | 0 | 573.5 | never floors |
| **IV+MQG** | 1.20 | 330 | **64.3** | ✔ bracket 64/65 |
| **IV+Zerk** | 1.32 | 0 | **215.1** | ✔ bracket 215/216 |
| **MQG+Zerk** | 1.10 | 330 | **243.5** | ✔ bracket 243/244 |
| **IV+MQG+Zerk** | 1.32 | 330 | −115.0 | **floored everywhere** |

Grid: `0 40 64 65 70 120 180 215 216 243 244 280 300`. This is **crossed** in round 3's sense — at 64→65
only IV+MQG changes regime, at 215→216 only IV+Zerk, at 243→244 only MQG+Zerk, the three singles never,
and the triple never (it is already floored at R=0). No set is "the one that steps," so a shared artifact
cannot fake the pattern. Both `--var 0` and `--var 3.0` are run, per §13's dichotomy.

### 14.4 The quantity

Marginals `marg(S,R) = 100·(dps_S − dps_base)/dps_base` for model and sim, then the **interaction**

```
I(S)  = marg(S) − Σ_{k ∈ S} marg({k})          ΔI(S) = I_sim(S) − I_model(S)
```

Singles are already measured (round 3), so only the four sets are new. `I` is the part of a stacked
window that is *not* the sum of its parts — the first quantity in this phase that a single-buff fight
cannot express. `ΔI` is the model's error in pricing it.

### 14.5 Pre-registered falsifiers

Recorded now so the result cannot be read after the fact (§12's sign error is the reason this list exists):

- **F1 — kink location.** Both model and sim must kink at the bracketed rating, to the point. A kink
  anywhere else in *either* means the floor itself is mis-modelled, which is a finding regardless of B2.
- **F2 — exclusion.** If `|ΔI(S)| < 0.05 pp` for all four sets, window×window haste interaction is
  **excluded** exactly as per-buff valuation was, and B2 must be **window × kill**.
- **F3 — the sign.** B2 needs the model to *under*-rate h40, whose signature is the always-floored triple.
  So B2 requires **`ΔI(IV+MQG+Zerk) > 0`**. If it is negative, this joins §8, §13.4 and §13.8 in the
  wrong-signed pile and is retired the same day — no reinterpretation.
- **F4 — floor vs composition.** If `ΔI` is large but **flat in R** (no kink at the crossing), the
  mechanism is not the floor but plain multi-buff composition (multiplicative-vs-additive haste stacking),
  which is a simpler and more serious bug. Distinguishable only because the grid brackets the crossings.

**Harness checks before reading anything** (the §1 and §13.3 lessons): confirm from `SIMLOG=1` that all
buffs in a set gain their aura at the **same** timestamp. MQG is the only trinket in any set, so the
category-1141 shared lockout that invalidated §1 cannot bite — but verify it, do not assume it.

### 14.6 VERDICT — F1 **passes**, F3 **fails**: window×window is retired, wrong-signed

Ran as pre-registered (`r4sweep.sh` → `r4/r4sweep.txt`, `r4model.mjs`, `r4stat.mjs`; T=100 s, press@30 s,
iter=20000, seed=11, cold open, infinite mana). Harness check first: `SIMLOG=1` on the triple shows
`[30.63]` for `{SpellID: 12472}` (IV), `{ItemID: 19339}` + `Gained {"SpellHasteRating": 330.000}` (MQG)
and `{SpellID: 20554, Tag: 1}` (Zerk) — one timestamp, all off-GCD, MQG the only trinket. Clean.

**★ F1 — PASS. The GCD floor is exactly where the model puts it.** Marginal slope per rating point, sim
vs model, across each pre-registered one-point bracket:

| set | crossing R | bracket | sim before → after | model before → after |
|---|---|---|---|---|
| IV+MQG | 64.25 | 64→65 | −0.0073 → **−0.0212** | −0.0032 → **−0.0179** |
| IV+Zerk | 215.05 | 215→216 | +0.0039 → **−0.0083** | −0.0001 → **−0.0074** |
| MQG+Zerk | 243.45 | 243→244 | +0.0028 → **−0.0102** | −0.0022 → **−0.0082** |

Three independent crossings, three different ratings, and in every one the sim's marginal turns over
inside the same single rating point the model does — and the singles, which never cross, show no such
kink anywhere. `Δ(R) = max(1.5/m, 1.0)` with the floor binding at `m ≥ 1.5` is **certified against the
sim**, not merely inferred from `constants.go`. This is the round's durable result: it is a *confirmation*,
so it also removes the floor from the suspect list for good.

**F2 — live (a real interaction residual exists), but F3 kills it.** `ΔI = I_sim − I_model` over the grid:

| set | mean ΔI pp | se | t | slope pp/300R | negative at | F3 |
|---|---|---|---|---|---|---|
| IV+MQG | **−0.166** | 0.034 | −5.0 | −0.253 | 12 / 13 | FAIL |
| IV+Zerk | +0.009 | 0.026 | +0.3 | −0.198 | 7 / 13 | (null) |
| MQG+Zerk | −0.003 | 0.034 | −0.1 | −0.045 | 6 / 13 | (null) |
| **IV+MQG+Zerk** | **−0.259** | 0.032 | **−8.1** | −0.212 | **13 / 13** | **FAIL** |

The triple's `ΔI` is negative at **every one of the 13 ratings**, t = −8.1 — not noise, and not the sign
B2 needs. §14.5 pre-registered this exact outcome as terminal: *"If it is negative, this joins §8, §13.4
and §13.8 in the wrong-signed pile and is retired the same day — no reinterpretation."* Retired.

Direct B2 arithmetic, for the record: h40's line stacks the triple, h70's kill cluster is the IV+MQG pair,
so the B2-relevant error is `ΔI(triple)@R=40 − ΔI(IV+MQG)@R=70 = −0.246 − (−0.132) = **−0.114 pp**`.
Correcting it moves h40 **down** relative to h70 by 0.114 pp, against a target of **+0.445 pp**. Wrong
direction *and* a quarter of the magnitude.

**★★ F4 — the mechanism, and why it is the same thing §13.9 found.** `ΔI` is level-dominated (mean −0.259
vs slope −0.212 pp over the *whole* 300-rating span) and there is no kink in it at the crossings, so per
F4 this is composition, not the floor. Decomposing it settles what kind:

| R | 0 | 40 | 64 | 65 | 70 | 120 | 180 | 215 | 216 | 243 | 244 | 280 | 300 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| resid(triple) | .234 | .133 | .086 | .097 | .080 | .110 | .142 | .146 | .141 | .150 | .160 | .099 | .094 |
| Σ resid(singles) | .420 | .379 | .183 | .171 | .252 | .482 | .312 | .511 | .515 | .545 | .526 | .307 | .441 |
| ratio | .56 | .35 | .47 | .56 | .32 | .23 | .45 | .29 | .27 | .27 | .31 | .32 | .21 |

`ΔI ≡ resid(S) − Σ resid(singles)` identically, so the negative `ΔI` is not a new effect at all: it is
**§13.9's per-buff under-credit failing to stack.** Each buff alone carries ~+0.1 pp of unexplained sim
upside; three of them sharing one window carry ~+0.1 pp *total*, not +0.3 (ratio ≈ ⅓, no trend in R).

That is the mechanistic close of §13.9's open question. The residual is **per-window, not per-buff** — one
window's worth of edge effect (aura-application ms, the boundary cast) regardless of how many buffs are
inside it. And a per-window constant **cancels between two plans with the same window count**, which is
exactly what B2's two plans have (§13.8: AP×2, Zerk×2, Icon×2, MQG×1, IV×3, Lust×1 in both). §13.9 said
B2 is not in per-buff valuation; §14 says it is not in per-*window* valuation either, stacked or not.

**Where this leaves B2.** Of the two joint candidates §13.9 left standing, window×window is now retired.
**Window × kill is the sole survivor** — and it is the one the isolation batteries structurally cannot
reach, because every probe so far has measured a *steady-state* fight where nothing ends. B2's h40 and
h70 plans differ in *where the fight stops relative to the last window*, and every quantity this phase has
measured is blind to that by construction. §15 must pre-register it: vary `T` against a fixed press
schedule so the terminal window is clipped by a controlled amount, and read `∂(model−sim)/∂(clip)`.

**Methodology gotcha found (now in TOOLING).** The sweep ran `--var 0` and `--var 3.0`. The `--var 0` half
is **unusable for marginal measurement** and was discarded: with zero jitter every iteration is the same
fight, so DPS quantizes to integer cast counts — R=64 and R=65 return byte-identical base DPS, IV and MQG
return byte-identical marginals at four ratings, and Berserking's 10 s window measures **+0.03 pp** (i.e.
*zero* extra casts) at five of thirteen ratings. That is the count law's `ceil` sampling at maximum
exposure — *true*, but far below the resolution of the sub-cast quantity being measured. `--var 3.0`
dithers the cast phase and recovers the expectation. All numbers above are the var=3.0 half.

## §15 — ROUND 5, PRE-REGISTERED: the **position sweep** (window × kill)

### 15.1 The blind spot, stated exactly

Rounds 3 and 4 measured **one press position** — `AT = 30` in a `T = 100 s` fight — and swept haste, buff
class, and buff stacking around it. Every one of those quantities is a property of the window *in
isolation from the fight's end*. So the phase has never asked the one question B2 is shaped like:

> **does the model's error depend on WHERE in the fight the window sits?**

That is the last structural axis, and B2 is exactly a position difference. Restating the two plans by shape
rather than by press list: **h40 is front-haste / back-damage** (Zerk@0, IV@0, MQG@9, IV@20, then Icon@29),
**h70 is front-damage / back-haste** (AP@4 + Icon@4 together, then MQG@202 on IV@202). Same buffs, same
multiplicities (§13.8) — only their **positions** differ. The sim prefers front-haste; the model prefers
back-haste. Every isolation battery run so far is blind to this by construction, which is precisely why
they all came back CLEAN.

The model is not neutral here — it **hardcodes** position-independence for haste. `index.html:926-928`:
*"haste shortens a span but never changes its cast COUNT, and the span hands off to the integral exactly —
so haste gains nothing from covering the ramp."* RULES §3 states the same as a rule (*"Berserking@0 = @50 =
@100 in isolation"*). If that axiom is even slightly wrong at the kill boundary or on the ramp, B2 follows
directly. This round tests the axiom instead of assuming it.

### 15.2 The design — sweep the press position, hold everything else

`T = 100 s`, cold open, infinite mana, `iter = 20000`, `seed = 11`, **`--var 3.0`** (§14.6: `--var 0` is
unusable for marginals). One buff per leg, pressed once at `AT`:

```
AT   ∈ { 0, 5, 10, 20, 30, 40, 50, 60, 70, 78, 84, 88 }
buff ∈ { IV, MQG, Zerk }   (haste)   ∪   { Icon, AP }   (value — the controls)
R    ∈ { 40, 70 }          (B2's own two gear-haste levels, not a generic grid)
```

The tail of the `AT` grid is chosen so each duration class crosses into **clipping** on the grid: `T − D`
is **80** for the `D = 20` buffs (IV, MQG, Icon), **85** for `D = 15` (AP), **90** for `D = 10` (Zerk). So
78/84/88 straddle all three onsets, and clipping is measured rather than assumed.

Base DPS depends only on `(R)` — `T` is fixed — so it is one run per haste, not one per position.

### 15.3 The quantity

```
resid(buff, AT, R) = marg_sim(buff, AT, R) − marg_model(buff, AT, R)
```

and the finding is **`∂resid/∂AT`**. Note this is deliberately *not* "does haste have a position gradient"
— both model and sim may legitimately have one (the ramp is slower, so a haste window laid on it converts
to fewer extra casts: `extra = (D/c)·(m_b − m_0)` with `c` larger on the ramp). What matters is whether the
**model's error** moves with position. Every prior round measured `resid` at a single `AT` and can say
nothing about its slope.

### 15.4 Pre-registered falsifiers

- **F1 — resolution control.** In the clip region (`AT > T − D`) `marg` must fall steeply for **both** model
  and sim — a window that only half fits is worth about half. If it does not, the sweep is not varying what
  it claims to and nothing below is readable.
- **F2 — the axiom check.** Model haste `marg` must be flat in `AT` to **< 0.02 pp** over the interior range
  `10 ≤ AT ≤ T − D`. This verifies `index.html:926-928` actually does what its comment claims. A model-side
  gradient here is a finding on its own, independent of B2.
- **F3 — exclusion.** If `|resid(AT) − resid(30)| < 0.05 pp` for every buff across the interior range, then
  **window × kill is excluded too** — and since §13.9 excluded per-buff valuation and §14.6 retired
  window×window, B2 would have **no surviving candidate expressible in a single-buff fight at all**. That is
  not a dead end but an instrument verdict: the phase would have to switch to a **two-plan differential**
  instrument (§16) that measures the h40/h70 pair directly rather than decomposing it.
- **F4 — the sign.** B2 needs the model to under-rate front-haste / back-damage. Formally it requires
  ```
  [resid_haste(early) − resid_haste(late)] + [resid_value(late) − resid_value(early)]  >  0
  ```
  If that combination is negative, this joins §8, §13.4, §13.8 and §14.6 in the wrong-signed pile and is
  retired the same day — no reinterpretation. (Fifth time this clause is written; it has fired four times.)
- **F5 — the ramp confound.** `AT ∈ {0, 5}` overlaps the 3-cast opening ramp, where the physics genuinely
  differs for both sides. The **F4 verdict is read from the post-ramp range only** (`AT ≥ 10`) so the ramp
  cannot fake it; the ramp points are reported separately, as their own datum.

Magnitude scale: B2's positions differ by ~190 s within a 229 s fight, against a 100 s probe, so scaling to
B2 is done with the **actual press positions of the two plans**, never by extrapolating a per-second slope.

### 15.5 VERDICT — the axiom **holds exactly**; F4 is **wrong-signed** (retired); one new right-signed datum: **haste on the ramp**

Run: `r5sweep.sh` (sim: 5 legs × 12 positions × 2 hastes + 2 bases) and `r5model.mjs` (model: the *same*
presses through `simulate`), `T = 100`, cold open, infinite mana, `iter = 20000`, `seed = 11`, `--var 3.0`.

Harness pre-verified in the combat log first, per the §1/§13.3 lesson — a press that does not fire when
requested has faked a result in this phase twice already: `IV@0` gains `[0.00]` fades `[20.00]`; `IV@88`
gains `[88.07]` fades `[100.00]` (**cut by the kill** — clipping is measured, not assumed); `Zerk@88` gains
`[88.07]` fades `[98.07]` (still interior, exactly as the grid intends).

**F1 — PASS, 8/8.** Both sides lose the same large amount when the window is pushed past its clip onset,
so the sweep does vary what it claims to:

| R | leg | clip onset | move | sim Δmarg | model Δmarg |
|---|---|---|---|---|---|
| 40 | IV | 80 | 78→88 | −1.799 | −1.781 |
| 40 | MQG | 80 | 78→88 | −1.817 | −1.817 |
| 40 | Icon | 80 | 78→88 | −0.522 | −0.562 |
| 40 | AP | 85 | 84→88 | −0.656 | −0.945 |
| 70 | IV | 80 | 78→88 | −1.729 | −1.778 |
| 70 | MQG | 80 | 78→88 | −1.738 | −1.781 |
| 70 | Icon | 80 | 78→88 | −0.486 | −0.560 |
| 70 | AP | 85 | 84→88 | −0.591 | −0.942 |

**F2 — PASS, and the axiom is *exact*.** The model's haste marginal over the whole interior range has a
spread of **0.0000 pp** — IV, MQG and Zerk, at both hastes, all twelve interior positions. `index.html:926-928`
does precisely what its comment claims: haste is credited as position-independent to the last digit. (The
value legs are not expected to be flat and aren't: AP moves 0.0068 / 0.0061 pp, which is press-snap, not a
gradient.) So the axiom under test is **real**, not an approximation the code drifted away from — and
therefore any sim-side position dependence in a haste marginal shows up undiluted in `resid`.

**F3 — the interior is excluded. Both "live" flags are clip-boundary snap, not a gradient.**
`max |resid(AT) − resid(30)|` over the interior, and the same with the single grid point adjacent to each
buff's clip onset dropped:

| R | leg | interior | max dev (all) | max dev (drop boundary pt) |
|---|---|---|---|---|
| 40 | IV | 10..78 | 0.054 | **0.018** |
| 40 | MQG | 10..78 | 0.053 | **0.018** |
| 40 | Zerk | 10..88 | 0.045 | 0.009 |
| 40 | Icon | 10..78 | 0.000 | 0.000 |
| 40 | AP | 10..84 | **0.279** | **0.004** |
| 70 | IV | 10..78 | 0.035 | 0.035 |
| 70 | MQG | 10..78 | 0.026 | 0.026 |
| 70 | Zerk | 10..88 | 0.022 | 0.013 |
| 70 | Icon | 10..78 | 0.000 | 0.000 |
| 70 | AP | 10..84 | **0.222** | **0.004** |

AP's 0.279/0.222 is *entirely* `AT = 84` — one cast short of its 85 s clip onset, where the window ends
~1 s before the kill and the last completion snaps across the boundary in the sim but not in the model.
Same story for IV/MQG at `AT = 78`. Away from that last-second band the model's error is flat in position
to **≤ 0.035 pp** (≤ 0.018 at R = 40). **Both B2 plans leave a tail** — h40's last window closes at 220
(`IV@200`), h70's at 222 (`IV@202`), i.e. 9 s and 7 s before the 229 s kill — so neither plan sits in the
band where this artifact lives. It cannot be B2's mechanism.

**F4 — WRONG SIGN at both hastes. Window × kill is RETIRED.** The pre-registered combination
`[resid_haste(early) − resid_haste(late)] + [resid_value(late) − resid_value(early)]`, read from the
post-ramp interior only (`early = 10`, `late = 70`) so the ramp cannot fake it:

| R | haste early−late (IV / MQG / Zerk) | value late−early (Icon / AP) | Σ |
|---|---|---|---|
| 40 | −0.031  −0.031  +0.004 | −0.000  −0.004 | **−0.063 pp** |
| 70 | −0.053  −0.039  −0.018 | +0.000  +0.000 | **−0.109 pp** |

B2 needs this **positive**. It is negative at both hastes, and *more* negative at B2's own gear haste. Per
§15.4's clause — *"retired the same day, no reinterpretation"* — window × kill joins §8, §13.4, §13.8 and
§14.6 in the wrong-signed pile. That clause has now fired **five times out of five**.

**F5 — ★ the ramp datum: right-signed, genuinely new, and far too small.** Reported separately exactly as
pre-registered, because `AT ∈ {0, 5}` is different physics for both sides. `resid@0 − resid@10`:

| R | IV | MQG | Zerk | Icon | AP |
|---|---|---|---|---|---|
| 40 | **+0.094** | **+0.098** | **+0.040** | +0.027 | −0.279 |
| 70 | **+0.092** | **+0.088** | **+0.061** | +0.027 | +0.085 |

The three haste legs are **6/6 positive, mean +0.079 pp** — the sim pays a haste window ~0.08 pp *more*
when it covers the opening ramp, and the model, by F2's exactly-verified axiom, pays it **+0.000**. That is
a direct, measured contradiction of `index.html:926-928` in the one place the axiom was always weakest: on
the ramp the cast interval is *not* the steady-state one, so shortening it does change the count. `AT = 5`
shows no bonus because the ramp ends at 6.34 s (R=40) / 6.22 s (R=70) and a press at 5 snaps to the *next*
cast boundary — already past it; the effect is genuinely ramp-**coverage**, not merely being-early. The
value legs are inconsistent between hastes (AP −0.279 vs +0.085) and must not be leaned on.

**But it does not pay B2, and the first scaling of it was wrong.** The helper first scaled this as *"h40
stacks two haste buffs on the ramp"* — that is incorrect and is corrected here: **h70 presses `IV@0` too**
(§ target table). The only ramp-coverage *difference* between the two plans is one press: **h40 `Zerk@0`
vs h70 `Zerk@6`** — and Zerk@6 fires after the ramp ends (5.2 s with IV@0 already up). So the differential
is one Zerk, on a ramp another window already covers:

```
solo Zerk ramp bonus (R=70)              +0.061 pp   (T = 100)
× 229/100 fight-length dilution          +0.027 pp   ← maximally optimistic
× §14.6 per-window saturation (≈ ⅓)      +0.009 pp   ← consistent with round 4
                                  target  +0.445 pp
```

**16–50× short.** It is the phase's first right-signed structural finding since round 2, and it is a real
model defect worth recording — but it is not B2.

**Structural consequence — F3's clause fires anyway.** Per-buff valuation is excluded (§13.9), window ×
window is retired wrong-signed (§14.6), window × kill is retired wrong-signed (this round). Those were the
three axes along which a **single-buff fight** can differ. **B2 therefore has no surviving candidate
expressible as a single-buff marginal**, which is an instrument verdict, not a dead end: the phase must
stop decomposing and measure the h40/h70 pair **directly**, as §15.4's F3 pre-registered. See §16.

**Carried into RULES:** the ramp datum is the live model defect this round produced. It is *not* patched
here — a scorer change while an acceptance round is gathering is forbidden, and a +0.08 pp haste-on-ramp
credit would move goldens. It is recorded as a known, measured under-credit with its magnitude.

## §16 — ROUND 6, PRE-REGISTERED: the **two-plan differential** (stop decomposing; walk the path)

### 16.1 Why the instrument class must change

Every round so far has asked *"what does the model get wrong about a buff?"* and answered it in a fight
containing **one** buff. Three rounds of that have excluded all three axes such a fight can vary (§15.5).
The remaining possibility is that the error is not a property of any buff but of **this pair of layouts** —
in which case no single-buff experiment can ever see it, however many are run. That is a falsifiable claim
and this round tests it by measuring the two real plans and the path between them.

### 16.2 The design — a five-move path, walked in both directions

The two plans differ in exactly five presses (§ target table). Enumerate the moves h40 → h70:

| # | move | what it is |
|---|---|---|
| M1 | `AP 8→4, 188→192` | damage window pulled forward / pushed back |
| M2 | `Zerk 0→6, 188→192` | **the ramp-coverage differential** (§15.5 F5) |
| M3 | `Icon 29→4, 183→182` | SP off the haste burst, onto the opener |
| M4 | `MQG 9→202` | **the big one** — a haste trinket moved 193 s |
| M5 | `IV 200→202` | 2 s nudge (control: should be ~0) |

Two passes, all on the full B2 fight (`T = 229`, `Lust@162`, gear haste 70, `isc+mqg`, CS@20 in both):

- **forward** — start from h40, apply one move at a time, everything else held at h40;
- **backward** — start from h70, apply the *inverse* of one move at a time, everything else held at h70.

Each intermediate plan is scored in the sim (`seed 11`, `iter 20000`, `--var 3.0`) and in the model
(`simulate` with the same fixed presses). The quantity is, per move,

```
Δresid(M) = [sim(plan+M) − sim(plan)] − [model(plan+M) − model(plan)]      (in pp of base)
```

Cost: 12 sim runs and 12 model evaluations. Cheap — this should have been round 4.

### 16.3 Pre-registered falsifiers

- **G1 — reproduction control.** The two endpoints must reproduce the known gap in *this* harness: sim
  h40 − h70 ≈ **+0.360%**, model ≈ **−0.02%**. If they don't, the instrument is mis-built and nothing below
  is readable. (This is the §1 bug's descendant and is non-negotiable.)
- **G2 — press verification, mandatory.** Every intermediate plan's combat log is checked: each requested
  press gains its aura within 1.5 s of the request, no press is silently dropped (trinket category 1141),
  no window is retimed. A plan that does not fire as requested is **discarded, not interpreted**. Twice
  burned (§1, §13.3).
- **G3 — localization.** If some single move carries `|Δresid| ≥ 0.15 pp`, the phase has, for the first
  time, a **named culprit**, and round 7 is that move's mechanism. Prior (stated now, before the run):
  **M4** — it is the only move large enough to matter and the only one that crosses the Lust window.
- **G4 — additivity.** Compare `Σ Δresid(M1..M5)` against the endpoint gap. If they agree within 0.05 pp
  the error is **localized and additive** (and G3 names it). If `Σ` is much smaller, the error is
  **genuinely joint across moves** — which would be the first *positive* evidence for a joint effect in
  this phase, as opposed to round 1's withdrawn version, and would be established by measurement rather
  than assumed.
- **G5 — order symmetry.** Any move whose forward and backward `Δresid` differ by more than 0.05 pp marks
  where the interaction lives; that pair (move × context) is round 7's target. If forward and backward
  agree everywhere **and** G4 says additive **and** no move clears G3's 0.15 pp, the verdict is **diffuse**:
  the gap is an accumulation of many ~0.05 pp under-credits (consistent with §13.9's per-buff level, §14.6's
  per-window saturation constant, and §15.5's ramp bonus), and the phase turns from mechanism-hunting to
  **global calibration** — which is a different, and much less satisfying, kind of answer, but a real one.

### 16.4 What this round cannot do

It cannot find a mechanism the two plans don't differ in. If G4 says additive and G3 names M4, the *reason*
M4 is mispriced still needs its own round. §16 buys **localization**, not explanation — but after three
rounds of blind exclusion, localization is the thing worth buying.

### 16.5 VERDICT — ★★ **G3 FIRES.** One move carries 82% of B2: the **trinket pair**

Run: `r6diff.sh` (sim: 14 plans, `T=229`, `--haste 70`, `--var 3.0`, `iter=20000`, `seed=11`, cold open,
infinite mana) · `r6verify.mjs` (G2) · `r6model.mjs` (model: the *same* presses through `simulate`, at both
the corrected inputs `sp=1450 t5two=on` and the legacy `sp=1387` for continuity) · `r6stat.mjs` (reduction).

**G1 — PASS, exactly.** sim `h40 − h70 = +0.3602 %` (pre-registered +0.360); model legacy `−0.0204 %`
(pre-registered −0.02). The instrument reproduces §1's headline to four digits, so everything below is
readable. With the corrected inputs the model reads `−0.0370 %`, i.e. the endpoint residual is
**−0.3959 pp** (legacy −0.3792 pp) — the number the moves must sum to.

**G2 — the four single-trinket moves are PHYSICALLY UNAVAILABLE, and this was known before any DPS was read.**
The a-priori shared-lockout check (any two on-use trinket presses ≥ 20 s apart) rejects all four:

| plan | trinket layout | verdict | what the log then did |
|---|---|---|---|
| `F_M3` | Icon@4 → MQG@9 | gap 5 s | MQG fired **@25.71** (+16.71 s) |
| `B_M4` | Icon@4 → MQG@9 | gap 5 s | MQG fired **@25.64** (+16.64 s) |
| `B_M3` | Icon@183 → MQG@202 | gap 19 s | MQG fired **@204.13** (+2.13 s) |
| `F_M4` | Icon@183 → MQG@202 | gap 19 s | MQG fired **@204.00** (+2.00 s) |

So **M3 and M4 are not separable at all**: with Icon and MQG both on the 20 s category-1141 timer, *every*
single-trinket intermediate between the two plans is illegal in *both* directions. They can only be walked
jointly, as **M34**. That is a structural fact about the layout pair, not a measurement failure.

> ★★ **METHODOLOGICAL UPGRADE — drift magnitude is NOT a sufficient legality test.** §1's lesson was
> "log-verify the press." Necessary, not sufficient: `B_M3` and `F_M4` were retimed by only **2.13 s / 2.00 s**,
> *less than one unbuffed cast interval at gear haste 70* (2.5 / 1.0444 = **2.394 s**), and would have passed
> a naive "fired within a cast" eyeball. Only the structural check caught them. **Run the a-priori legality
> check first; use the log to confirm it, not to replace it.**

Three *legal* plans exceed the pre-registered 1.5 s tolerance, all on the same press — `AP@188`
(h40 → 189.51, `F_M5` → 189.51, `F_M34` → 189.75). This is neither snap nor retime but a **cooldown chain**,
and it is fully determined: h40 asks for AP at 8 and 188 — *exactly* the 180 s cooldown apart — the first
press boundary-snaps to **9.06**, so AP is not ready until 189.06 and the next cast boundary is 189.51.
It is deterministic, identical in both legs' inputs, and it lands on **h40**, the plan the sim already
prefers, so it cannot manufacture B2's sign. It is nevertheless a real model gap and is carried to RULES:
**the model schedules two presses exactly one cooldown apart; the sim cannot execute that**, because the
first press always fires late.

**G3 — ★★ FIRES. `M34` carries −0.325 pp of the −0.396 pp endpoint gap: 82% of B2, in one move.**
All deltas in the `h40 → h70` direction, `Δresid = d_sim − d_model` in pp (primary inputs):

| move | what | d_sim (fwd) | d_model (fwd) | **Δresid (fwd)** | d_sim (bwd) | d_model (bwd) | **Δresid (bwd)** | mean |
|---|---|---|---|---|---|---|---|---|
| M1 | AP 8,188→4,192 | −0.158 | −0.146 | −0.012 | −0.032 | +0.051 | −0.083 | −0.047 |
| M2 | Zerk 0,188→6,192 | −0.366 | −0.422 | +0.056 | +0.007 | +0.112 | −0.104 | −0.024 |
| M5 | IV 200→202 | +0.011 | +0.014 | −0.003 | +0.032 | +0.155 | −0.122 | −0.063 |
| **M34** | **Icon 29,183→4,182 + MQG 9→202** | **−0.377** | **−0.126** | **−0.251** | **+0.032** | **+0.431** | **−0.399** | **−0.325** |

(legacy inputs give the same picture: M34 −0.313 pp of a −0.379 pp gap.) The three non-trinket moves sit at
−0.02 … −0.06 pp — the diffuse background this phase has been measuring for five rounds. M34 is 5–13× larger
and **same-signed in both directions**. The pre-registered G3 prior named **M4 (MQG 9→202)**; the lockout
forces Icon along for the ride, but the prior was right about where to look.

**The direction of the error, stated plainly:** *the model over-values the late trinket cluster*
(`Icon@182` + `MQG@202` stacked on `IV@202`, inside the last 27 s) *relative to the early one*
(`MQG@9` + `Icon@29`). Forward, the sim charges 0.377% to move the trinkets late and the model charges only
0.126%; backward, the sim pays ~0.03% for the late cluster and the model pays 0.431%.

**G4 — non-additive, but only just.** `Σ Δresid{M1,M2,M34,M5} = −0.459 pp` vs endpoint `−0.396 pp`;
`|diff| = 0.063 pp`, over the 0.05 pp threshold. So there **is** a genuine joint residue — the first
*positive* evidence for one in this phase, as §16.3 required it to be established by measurement — but it is
**16% of the gap**. The error is 84% localized.

**G5 — asymmetric everywhere** (0.07 – 0.16 pp forward-vs-backward, all four moves). Context modulates every
move's magnitude; only M34's **sign** is stable. That is what a real interaction looks like, and it is why
the §16.3 "diffuse" branch does **not** fire.

**★ The finding, and its tension with round 5.** §15.5 measured `Icon`'s solo residual as **exactly 0.000 at
every position, at both hastes**, and `MQG`'s as ≤ 0.053 pp (all of it clip-boundary snap). Each trinket,
priced **alone**, is exact. The same two trinkets, moved **together inside this plan**, carry **0.33 pp**.
Those two statements are both true and they are the phase's answer to why five rounds of single-buff probing
found nothing: **the defect is not in either buff's valuation — it is in what happens when they move as a
pair.** That is now localized to two named presses and is cheap to split further. See §17.

**Instrument caveat, recorded not resolved.** The model's displayed plan times are fire times **floored to
whole seconds**, and the harness feeds those floored integers back to the sim, which re-snaps them to its own
cast boundaries. The floor is therefore mostly absorbed — except where it crosses a boundary, giving a
±1-boundary uncertainty per press. It applies to both plans and has applied since §1, but it is an unquantified
term at roughly the scale of the diffuse background (~0.05 pp) and should be measured before any calibration
is fitted to numbers that small.

## §17 — ROUND 7, PRE-REGISTERED: split `M34` into single presses (the legal three-step path)

### 17.1 The question
`M34` moves **both** trinkets. §16.5 shows the pair carries 0.33 pp; it cannot say whether that is MQG, Icon,
or the two together. The shared 20 s lockout blocks the direct single-move split — but not a **three-step
path through a parked position**, because a trinket parked mid-fight is legal against both endpoints.

### 17.2 The design — park MQG at 100 s
Trinket sub-layout only; the rest of the plan is held fixed. Steps, `h40-trinkets → h70-trinkets`:

| step | trinket layout after | gaps | what moves |
|---|---|---|---|
| — | `Icon 29,183 · MQG 9` | 20, 154 | (h40 endpoint) |
| **P1** | `Icon 29,183 · MQG 100` | 71, 83 | **MQG leaves the opener** |
| **P2** | `Icon 4,182 · MQG 100` | 96, 82 | **Icon alone relocates** |
| **P3** | `Icon 4,182 · MQG 202` | 178, 20 | **MQG arrives on `IV@202` at the kill** |

Every intermediate clears the 20 s lockout with margin. Run the path in **both rest-contexts** — everything
non-trinket held at h40, and everything non-trinket held at h70 — so the path's endpoints are exactly the
four plans §16 already measured (`h40`/`F_M34` and `B_M34`/`h70`). **Cost: 4 new sim runs + 4 model
evaluations** (the two intermediates × two contexts); the endpoints are reused.

### 17.3 Pre-registered falsifiers
- **H1 — path additivity.** `Σ Δresid(P1,P2,P3)` must equal `Δresid(M34)` in the *same* context within
  0.05 pp. If it does not, the parked position at 100 s is not neutral and the split is not a split.
- **H2 — localization.** Which step clears `|Δresid| ≥ 0.15 pp`? **Prior, stated now: P3** — the only step
  that stacks a haste trinket onto another haste window (`IV@202`) inside the last 27 s of the fight.
- **H3 — the Icon control.** P2 moves **only Icon**. §15.5 measured Icon's solo residual at exactly 0.000
  everywhere. If P2 also reads ≈ 0, Icon is exonerated and the culprit is a single press, `MQG`. If P2 is
  large, then §15.5's Icon result does not survive context — and the "solo = exact" reading that this whole
  phase has leaned on is itself in question, which would be the more important finding of the two.
- **H4 — context sensitivity.** The same step's `Δresid` in the h40-rest vs the h70-rest context. G5 already
  says context is worth 0.07–0.16 pp; H4 says *which step* is carrying it.
- **H5 — press verification, mandatory, in the §16.5 order.** A-priori structural legality check **first**,
  combat log second. A plan that does not fire as requested is discarded, not interpreted.

### 17.4 What this round cannot do
It cannot explain *why* the surviving press is mispriced — that is round 8. It converts "the trinket pair"
into "this one press", which is the last decomposition step available before the question becomes mechanistic.

### 17.5 VERDICT — ★★★ **B2 is ONE PRESS.** H1 passes, H2 fires on P3, H3 **exonerates Icon**

All four pre-registered falsifiers resolved, both input configs agree, and the pre-registered priors on H2
and H3 were both correct. Instruments: `$SP/p8/r7path.sh` (sim leg, 8 plans) · `r7model.mjs` (model leg) ·
`r7stat.mjs` (reduction) · `r6verify.mjs` (H5). `T=229 · haste 70 · Lust@162 · CS@20 · var 3.0 · 20 000 iter
· seed 11 · cold open · infinite mana`.

**The path, primary inputs (`sp=1450`, `t5two` on).** Δresid = `d_sim − d_model`, both in %.

| step | what moves | ctx | `d_sim` | `d_model` | **Δresid** |
|---|---|---|---|---|---|
| P1 | `MQG 9 → 100` (leaves the opener) | A | −0.5850 | −0.5399 | −0.0450 |
| P2 | `Icon 29,183 → 4,182` (**Icon alone**) | A | +0.1588 | +0.1544 | **+0.0044** |
| P3 | `MQG 100 → 202` (arrives on `IV@202`) | A | +0.0505 | +0.2610 | **−0.2106** |
| P1 | `MQG 9 → 100` | B | −0.0973 | −0.1030 | +0.0057 |
| P2 | `Icon 29,183 → 4,182` (**Icon alone**) | B | +0.1767 | +0.1740 | **+0.0027** |
| P3 | `MQG 100 → 202` | B | −0.0468 | +0.3600 | **−0.4068** |

- **H1 — path additivity: PASSES, and not marginally.** ctx A `Σ = −0.2512` vs endpoint `−0.2505`
  (|diff| **0.0007 pp**); ctx B `Σ = −0.3983` vs `−0.3986` (|diff| **0.0003 pp**). Both are ~70× under the
  0.05 pp bar. The parked position at 100 s is neutral: the split is a real split, and the endpoints
  reproduce §16.5's `M34` exactly. Legacy inputs (`sp=1387`, `t5two` off) agree: 0.0010 / 0.0002 pp.
- **H2 — localization: FIRES on P3, as pre-registered.** P3 is the only step clearing 0.15 pp, in both
  contexts and both input configs (primary −0.2106 / −0.4068; legacy −0.2120 / −0.4241). Against the
  −0.396 pp endpoint gap, **P3 alone is 53 % (ctx A) to 103 % (ctx B) of B2.**
- **H3 — the Icon control: PASSES. Icon is EXONERATED.** P2 moves only Icon and reads **+0.0044 / +0.0027 pp**
  — an order of magnitude under the bar, and consistent with §15.5's "Icon solo = exactly 0.000". §15.5
  survives context. The alternative branch (that the whole phase's "solo = exact" reading was wrong) does
  not fire.
- **H4 — context sensitivity: P3 carries all of it.** |A − B| per step: P1 **0.0508**, P2 **0.0017**,
  P3 **0.1962** pp. G5's "context is worth 0.07–0.16 pp" is localized to the same press.

**★ The finding, stated as sharply as the data allows.** Moving `MQG` from a solo mid-fight parking spot
onto `IV@202` in the last 27 s, the **model pays +0.26 to +0.36 %** and the **sim pays ≈ 0** (+0.05 % / −0.05 %,
i.e. inside its own 0.0036 % resolution × the run-to-run spread). B2 is not a diffuse accumulation, not an
emergent joint interaction, and not the Icon: **the model over-values one press — `MQG` stacked onto `IV` at
the end of the fight — by 0.21–0.41 pp.**

**★★ A confound, and the reason ctx B is the leg to trust.** H5's a-priori structural check passed on all 8
plans (Icon/MQG never within 20 s ⇒ no category-1141 retime). But the *log* check shows the **cast-phase
cascade** moving presses we asked to hold fixed — a trinket move perturbs every downstream boundary-snapped
press:

| ctx | plan | `IV#3` fires | `AP#2` fires |
|---|---|---|---|
| A | S0 / S1 / S2 / S3 | 200.76 / 202.00 / 202.00 / **201.00** | 189.51 / 189.65 / 189.65 / 189.75 |
| B | S0 / S1 / S2 / S3 | 202.12 / 202.03 / 202.03 / **202.13** | 192.07 / 192.99 / 192.99 / 193.10 |

Across ctx-A's P3 the third Icy Veins slides **1.00 s** — a 20 %-haste window moving by nearly half a cast,
while we claim "only MQG moved". Across ctx-B's P3 it moves **0.10 s**. So **ctx B's P3 is the clean
measurement — and it is the *larger* of the two (−0.4068 vs −0.2106)**, which is what rules the confound out
as the cause rather than merely bounding it. (The `AP@188 → 189.5–189.8` drift is round 6's cooldown chain:
`AP@8` snaps to 9.06, so `AP#2` cannot fire before 189.06. It is present in every ctx-A plan and differences
out.) Generalized: **"hold the rest fixed" is a property of the request, not of the execution** — round 8
gates on it explicitly (H5b below).

**A non-finding, recorded so it is not re-derived.** Deterministic AB cast counts from the `--var 0 --iter 1`
legality logs are 181 (AS0) and **180 for all seven other plans** — i.e. the P3 arms sit in the same integer
bucket. This is *not* evidence that the sim gains no casts from `MQG@202`: `--var 0` quantizes to integer
casts (★★ §11), which is exactly why the measurement runs at `--var 3.0`. The counts are reported here only
to document that AS0's outlier +0.585 % P1 drop in ctx A is a whole-cast step change, not a smooth marginal.

## §18 — ROUND 8, PRE-REGISTERED: **is it the stack, or is it the kill?** (the 2×2 that §14 could not run)

### 18.1 The question
`P3` moves `MQG` from `100` to `202` and conflates exactly two causes:

- **(a) the stack** — at 202 `MQG` lands on `IV@202`, so two haste multipliers compose. The model composes
  them multiplicatively and prices the marginal cast rate accordingly.
- **(b) the kill** — 202 is 27 s from the end of a 229 s fight, so the time the buff saves has almost no
  runway left in which to be converted into a completed cast.

Every earlier round hit this wall because `Icon`'s 20 s category-1141 lockout pinned `MQG` out of most
positions. **H3 has now exonerated `Icon` — so round 8 turns it OFF**, `MQG` becomes the only on-use trinket,
the lockout constraint disappears entirely, and the crossed design §14 wanted becomes legal.

### 18.2 The design — cross {stacked, solo} × {mid-fight, at the kill}
Rest-context **B only** (the clean leg): `BL@162 · AP@4,192 · Zerk@6,192 · IV@0,20,202 · CS@20`, `Icon`
**disabled**, gear haste 70. `MQG` is the only thing that moves. Two fight lengths, because `IV`'s 180 s
cooldown (`IV@0,20` + Cold Snap ⇒ `IV#3` no earlier than 200) makes "stacked **and** at the kill" reachable
only at `T=229`, and "stacked **and** mid-fight" reachable only by extending the fight:

| arm | `T` | `MQG` | cell | runway after the buff |
|---|---|---|---|---|
| **A0** | 229 | 100 | reference — solo, mid | 109 s |
| **A1** | 229 | 202 | **stacked (`IV`) × kill** — reproduces P3 | 7 s |
| **A2** | 229 | 170 | **stacked (`BL` 162–202) × mid** | 39 s |
| **C0** | 300 | 100 | reference — solo, mid | 180 s |
| **C1** | 300 | 202 | **stacked (`IV`) × mid** — same press, 78 s of runway | 78 s |
| **C2** | 300 | 272 | **solo × kill** | 8 s |

Six sim runs, six model evaluations. `MQG`'s 300 s cooldown means one press in every arm; no arm can gain a
second use of anything at `T=300` (`IV` 202+180, `AP` 192+180, `Zerk` 192+180 all exceed 300), so the
schedules are directly comparable within a length.

### 18.3 The quantity
The four contrasts, each `Δresid = d_sim − d_model` against its own-length reference:

- **K1** `A0→A1` — stacked × kill. **Must reproduce ≈ −0.41 pp**, or the instrument is not measuring §17's P3.
- **K2** `A0→A2` — stacked × mid (on `BL`, the bigger multiplier).
- **K3** `C0→C1` — **the decisive contrast**: the *identical press position* as A1, with 78 s of runway.
- **K4** `C0→C2` — solo × kill.

### 18.4 Pre-registered falsifiers
- **J1 — the stacking hypothesis.** `|K3| ≥ 0.15` and `|K2| ≥ 0.15` and `|K4| < 0.05`. Reading: the model
  mis-composes two overlapping haste multipliers; fight position is irrelevant. Fix lands in the cast-rate
  integral's buff composition.
- **J2 — the kill-proximity hypothesis.** `|K4| ≥ 0.15` and `|K2| < 0.05` and `|K3| < 0.05`. Reading: the
  model over-credits a haste window that has no runway left to cash its saved time into a completed cast —
  a **tail-truncation** gap. Fix lands in how the integral terminates at `T`.
- **J3 — both, additively.** `K1 ≈ K2 + K4` within 0.05 pp with both terms ≥ 0.10 pp.
- **J4 — neither / interaction.** K1 reproduces but K2, K3, K4 are all < 0.10 pp. Then the defect needs
  *both* conditions simultaneously and round 9 must probe the joint cell directly rather than its margins.
- **H5b — the cascade gate (new, from §17.5).** For every contrast, the fire times of all **non-`MQG`**
  presses must move by **< 0.30 s** between the two arms. A contrast that violates it is reported as
  *contaminated* and does not carry a verdict. This is the a-priori-legality lesson extended: structural
  legality is necessary, not sufficient — the log must also show the *controls* held still.

### 18.5 What this round cannot do
It cannot localize the fix inside `simulate()` — it partitions the defect into "buff composition" vs
"fight-end termination", which are different code paths and different fixes. It also cannot rule out that
the same defect exists at other haste levels; B2 is a haste-70 case and the fix must be re-validated across
the acceptance grid before it lands.

## Guardrails (unchanged)
Determinism; exact-match 25/25; a golden may move ONLY if its effective-AB count improves AND it
sim-verifies (var0.5 CRN); B1 must stay clean by construction (pooling); monoDip=0. The full acceptance
re-run (var0.5 + wall-jitter, pooling ON) is the thorough gate — run it after any core-integral change.
