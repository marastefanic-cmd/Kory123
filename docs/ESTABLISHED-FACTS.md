# ESTABLISHED FACTS — the exact laws

Every statement in this file is a **closed form**, derived from the mechanics in `docs/MECHANICS.md`
and **verified against the engine's rate integral** to the digit. There are no sampled tables here and
no "measured max at h=…" verdicts. If a number is in this file it is exact, or it is labelled.

⚠ **This file was rewritten 07-28.** The previous version reported values measured on the *per-cast sum
at one lattice phase*, which carries a **±0.2-cast** phase term — the same size as the interactions it
was reporting. Against this file's own closed forms the sum was off by up to **0.2385 casts**; the
integral is off by **0.0000** (`docs/MODEL-DEFECTS.md` §8f). The laws never moved. The measurements
did, so they are gone. The old tables are in git history if a provenance question ever needs them.

**Reproduce anything here:**

    node tools/facts-ladder.mjs --score=integral        # singles + threshold fits
    node tools/facts-pair.mjs --score=integral --a=X --b=Y

⛔ **Never quote a `--score=point` number as a fact.** It is a realisation at one cast-lattice phase,
and the phase is not a property of the game.

---

# 0. Constants

All read from `GAME` in `index.html` — never re-typed into a tool (reference-gear doctrine).

| symbol | value | meaning |
|---|---|---|
| `G` | 1.5 s | base global cooldown |
| `F` | 1.0 s | GCD floor |
| `C₃` | 1.498 s | 3-stack Arcane Blast cast time = `2.5 − 3 × 0.334` |
| `RTG` | 1577 | haste rating for +100 % (15.77 per 1 %) |
| `COEF` | 2.5/3.5 = 0.714286 | Arcane Blast spell-power coefficient |
| `BASE` | 720 | average Arcane Blast base damage |

## 0.0 Every cooldown, and its onset threshold

| cooldown | kind | value | dur | cd | onset threshold alone |
|---|---|---|---|---|---|
| Bloodlust | ×haste | 1.30 | 40 | 600 | **242.6** |
| Icy Veins | ×haste | 1.20 | 20 | 180 | **394.3** |
| Power Infusion | ×haste | 1.20 | 15 | 180 | **394.3** |
| Berserking | ×haste | 1.10 | 10 | 180 | **573.5** |
| Mind Quickening Gem | +rating | 330 | 20 | 300 | **458.5** |
| Skull of Gul'dan | +rating | 175 | 20 | 120 | **613.5** |
| Drums of Battle | +rating | 80 | 30 | 120 | **708.5** |
| Arcane Power | ×damage | 1.30 | 15 | 180 | — (no cap) |
| Serpent-Coil Braid | +SP | 225 | 15 | 120 | — (no cap) |
| Icon of the Silver Crescent | +SP | 155 | 20 | 120 | — (no cap) |

★ **Icy Veins and Power Infusion are the same object.** Both are ×1.20, so every law and every pair
interaction is identical between them — verified across the whole matrix in §5.5. Their only
differences are duration and who presses them. This is the spell-agnostic law made visible: *it never
matters which spell supplies an effect, only by how much.*

The **haste multiplier** of a state is

    m  =  m_p · Π vᵢ · (1 + Σ rⱼ / RTG)          m_p = 1 + h / RTG

multiplicative buffs `vᵢ` (Bloodlust ×1.3, Icy Veins ×1.2, Berserking ×1.1, Power Infusion ×1.2),
rating buffs `rⱼ` (Mind Quickening Gem +330, Skull of Gul'dan +175) folded into one additive pool with
passive rating. **Rating adds, multipliers multiply.** That asymmetry is the source of half the rules
below.

## 0.1 ★★★★ IT IS ONE EQUATION

Everything in this file is a partial derivative of a single expression. There is no second model.

    V(plan)  =  ∫₀ᵀ  rate( m(t) ) · w( t )  dt

    rate(m)  =  min( 1/F , m/G )                                   casts per second
    m(t)     =  ( 1 + [ h + Σ active rating ] / RTG ) · Π active haste multipliers
    w(t)     =  ( 1 + Σ active ΔSP · COEF / (BASE + COEF·SP) ) · Π active damage multipliers

`m` is *how many* casts; `w` is *what each is worth*; the plan chooses which buffs are simultaneously
active at each `t`. **Change one variable and watch.** Every "rule" below is that experiment written
down — move a press, and the only thing that changes is which terms are inside the same `t`.

★ Two structural facts follow immediately, and they are the whole reason the planner is hard:

1. **`rate` and `w` factorise.** Haste effects only enter `m`, value effects only enter `w`. So the
   interaction of any set of cooldowns is (haste part) × (value part), computed independently.
2. **`rate` is `min(...)`, and `min` is the only non-linear thing anywhere in the model.** Below the
   cap every interaction is a plain product of fractional gains and is therefore **positive**. The GCD
   corner is the *sole* source of conflict, opportunity cost, and negative interaction in this entire
   system.

⇒ **If nothing capped, the optimal plan would be trivial: overlap everything.** The scheduling problem
exists because of one `min`.

## 0.2 ★★★ IT ALREADY IS A DPS INTEGRAL, AND THE RAMP IS ALREADY PROGRESSIVE (user, 07-28)

*"Better yet if it could be a function of dps that scales with haste, spell power and crit and the ramp
is modelled into the function progressively, instead of just summing. Or is that already how it works
by nature?"* — **it is already how it works, on all three counts.**

* `rate(m(t)) · w(t)` **is** instantaneous DPS in cast-equivalents. `V` is its time integral. Haste
  enters through `m`, spell power through `w`.
* **Crit is a pure scalar and factors straight out.** Ratio `V(38 % crit) / V(25 % crit)` measured across
  four structurally different plans at two haste levels: **1.088240789 at every one**, matching
  `(1 + 0.38(CM−1)) / (1 + 0.25(CM−1))` to nine decimals. ⇒ crit changes the absolute number and **no
  decision** — which is why no threshold anywhere in this file mentions it.
* **The ramp is not "summed instead of integrated" — the two are the same number.** Over one cast's own
  interval, `∫ (1/interval) dt = 1` exactly. So the three discrete ramp casts *are* the integral of a
  stack-aware rate over those spans, not a patch on top of it. Verified against pure geometry
  (`Σ max(C_k/m, i)/i − 3`) with no per-cast bookkeeping at all:

  | h | 0 | 400 | 900 | 1200 |
  |---|---|---|---|---|
  | geometry | 1.33200 | 1.33200 | 1.13700 | 0.69008 |
  | engine | 1.33200 | 1.33177 | 1.13700 | 0.69000 |

  The engine writes it as a discrete span only because `rateAt` is not stack-aware; making it so would
  delete the special case and change no value.

⚠ **But do NOT smear the value side to match.** A cast's damage lands at its **completion** (the
snapshot rule), so a value window's edge falling mid-cast must credit that cast 0 or 1 — not a
fraction. Smearing it is exactly the over-payment `boundaryCharge` exists to correct. ⇒ the right form
is **integrate the rate, discretise the value**, which is what the engine does.

---

# 1. THE MASTER LAW — cast rate

    rate(m)  =  min( 1/F , m/G )  =  min( 1 , m/1.5 )        casts per second

That is the whole steady-state model. `C₃ < G` always, so Arcane Blast is **GCD-bound at every haste**
and the cast time never enters the rate — only the GCD does. Everything else in this file is arithmetic
on this one expression.

*Verified: engine integral matches at h = 0, 200, 400, 600, 788.5, 900 (exact, once the opener term in
§1.2 is accounted for).*

## 1.1 THERE ARE TWO CAPS, AND ONLY THE SECOND ONE IS REALLY ZERO

⚠ **Corrected 07-28 (user).** An earlier draft of this section said a haste point above 788.5 is worth
*exactly zero*. That is wrong, and the reason is exactly the one the user gave: **haste still shortens
any cast longer than the GCD**, and this rotation has three of them — the 0-, 1- and 2-stack Arcane
Blasts at 2.500 / 2.166 / 1.832 s.

| | condition | h | what it stops |
|---|---|---|---|
| **steady-state cap** | `m = G/F = 1.5` | **788.5** | the sustained cast rate freezes |
| **true cap** | `m = C₀/F = 2.5` | **2366** | even the 0-stack cast hits the floor; *now* haste does nothing |

Between the two, a haste point still buys **ramp compression**:

    above the steady cap:   d(casts)/dh  =  Σ_{k : C_k/m > F}  C_k / m²  /  RTG      per COLD START

| h | worth per rating point |
|---|---|
| 788.5 | 1.831e-3 casts **per opener** |
| 1000 | 1.543e-3 |
| 1400 | 8.303e-4 |
| 1800 | 6.452e-4 |
| ≥ 2366 | **0 — and now it really is zero** |

Against `T/2365.5 = 0.1268` casts per point below the cap on a 5:00 fight, that is **~70× smaller** —
which is why "treat 788.5 as the cap" is the right *practical* rule, and why it is still not the exact
statement. It also scales with the number of **cold starts**: a fight with intermissions re-ramps, and
each re-ramp pays the toll again and each is compressible.

*Verified against the engine at h = 0, 400, 788.5, 900, 1200, 1600, 2000, 2365.5, 2600 — closed form
matches the integral to ≤2e-3 casts at every point, including the exact zero at 2365.5.*

## 1.2 The opener costs exactly **1.332 casts**, at every haste

The first three Arcane Blasts of any cold start run at 0, 1 and 2 debuff stacks:
`C_k = 2.5 − k × 0.334` = 2.500 / 2.166 / 1.832 s. Their intervals are `max(C_k/m, max(F, G/m))`.

    opener deficit  =  ( Σₖ C_k − 3G ) / G  =  (6.498 − 4.5) / 1.5  =  1.332 casts

★ **`m` cancels — below the steady-state cap.** There `i = G/m` and every ramp interval is `C_k/m`, so
`m` divides out of the ratio entirely: the opener costs the same **1.332 casts** at h = 0 and at
h = 788.5, and no haste cooldown can change that.

⚠ **Above the cap it does NOT cancel**, because `i` is pinned at `F` while the ramp casts keep
shrinking (§1.1). The general form is

    opener deficit(m)  =  [ Σₖ max(C_k/m, i) − 3i ] / i          i = max(F, G/m)

| h | 0 … 788.5 | 900 | 1200 | 1600 | 2000 | ≥2366 |
|---|---|---|---|---|---|---|
| deficit (casts) | **1.3320** | 1.1370 | 0.6901 | 0.3161 | 0.1022 | **0.0000** |

*Engine integral reproduces every cell to ≤2e-3 casts.*

## 1.2e ★★★★ THE OPENER ANCHOR IS `ceil(ΣC_k)` UNHASTED — **0:07, at every haste** (07-30)

The value cluster waits for the opener, and *which* opener quantity it waits for is not the obvious one.
Two things get conflated:

| quantity | h=0 | 300 haste | 600 haste | moves with haste? |
|---|---|---|---|---|
| when 3 Arcane Blast stacks are physically LIVE | 6.498 s | 5.459 s | 4.707 s | **yes** |
| the end of the **opener-toll window**, `ΣC_k` UNHASTED | 6.498 s | 6.498 s | 6.498 s | **no** |

They coincide at h=0 — which is why one hid behind the other for a whole session — and diverge as soon
as you put haste on. **The second one is the anchor.** §1.2b's ramp-neutrality is *built* by spreading a
fixed toll `Σ(C_k − G)/G` over exactly that unhasted window; a value window overlapping it pays a share
of the toll, one starting after it pays none. That is the entire reason the cluster waits, and because
the window is m-independent by construction, so is the second it waits for.

> ### ⚠ CORRECTED 07-31 (MODEL-DEFECTS §9a F1) — the WINDOW is unhasted; the LUMP is not, above the floor
> The paragraph above is right about the **window** and was read as a claim about the **lump** too, and
> the engine implemented it that way — charging a flat `1.332` at every haste. That contradicts §1.2's
> own table two pages up (`1.332 / 1.137 / 0.690 / 0.316`), which the engine's board walk tracked while
> the ranking integral did not. The general form is
>
>     toll(m) = [ Σₖ max(C_k/m, i(m)) − 3·i(m) ] / i(m),      i(m) = max(FLOOR, G/m)
>
> ★ **and it SUBSUMES the fixed toll rather than overturning it.** Below the GCD floor
> `max(C_k/m, i) = C_k/m` and `i = G/m`, so the `1/m` cancels top and bottom and every rung is
> haste-invariant — §1.2b's ramp-neutrality *is* the sub-floor regime. Above the floor `i` pins at 1.0 s
> while the ramp casts keep shortening, so the toll collapses and **ramp-neutrality inverts at exactly
> `m·v = 1.5`, which is §1.2b's own stated threshold** — the doc predicted this and the engine did not do
> it. ⚠ Reachable at zero gear haste: `Bloodlust ×1.30 × Icy Veins ×1.20 = 1.56`.
> ⇒ the spreading window stays `ΣC_k` UNHASTED, exactly as above; only the lump moves. Mixing those two
> up is what §8q rejected and it is still rejected. Gated: `tools/toll-audit.mjs` (12 rows) and
> `law-check`'s `§8r` pair, which now asserts neutrality *below* the threshold and the inversion *above*
> it — measured `+0.16602` against a closed form of `tollLaw(1.3) − tollLaw(1.56)`.

**Measured by sliding the value cluster and taking the argmax** — 2:00 · Lust 0:05 · 1387 SP · 38 % crit,
kit IV + Icon + Gem + AP + Berserking:

```
haste     3 stacks live at        best cluster second
   0       6.498 s → ceil 7               7
 150       5.934 s → ceil 6               7
 300       5.459 s → ceil 6               7
 450       5.055 s → ceil 6               7
 600       4.707 s → ceil 5               7
```

⇒ **`anchor = max(raid call, ceil(ΣC_k))` and `ceil(ΣC_k) = 7`.** It reproduces every declared layout:
T1/T2 wait to 0:20 because the Lust call is later; T3–T7 all cluster at 0:07.

⚠ At 300 haste, pressing the cluster at 0:06 instead of 0:07 costs **0.0517 casts** — a real, measurable
price for 0.498 s of overlap with the toll window, not a rounding artifact. Pressing at 0:08 or 0:09 is
**exactly tied** (Δ = 0.000000), so 0:07 is the *earliest* member of a tied plateau and the tie-break
picks it.

⛔ **Do not "improve" this by computing the hasted ramp.** That was tried first, in
`tools/group-seconds.mjs`, and 0:07 became the single second the generator could not derive — at every
haste above zero, in every kit. The wrong quantity is the more physical-sounding one.

## 1.2a ⚠ DO NOT CLUMP IT — the three ramp casts are not interchangeable

**Corrected 07-28 (user).** "1.332 casts" is the right *total* and the wrong *granularity*. The engine
has always scored the ramp cast by cast (`boardRamp` — each with its own start and completion); this
document was the thing lumping them. Per cast:

    d_k  =  max(C_k/m, i) / i  −  1                  i = max(F, G/m)

| | cast 1 (0 stacks) | cast 2 (1 stack) | cast 3 (2 stacks) | total |
|---|---|---|---|---|
| cast time | 2.500 / m | 2.166 / m | 1.832 / m | |
| **deficit, h ≤ 788.5** | **0.6667** | **0.4440** | **0.2213** | 1.3320 |
| h = 1200 | 0.4197 | 0.2300 | 0.0404 | 0.6901 |
| h = 1600 | 0.2410 | 0.0752 | 0.0000 | 0.3161 |

★ **Cast one is half the whole toll**, and `m` cancels in each term separately below the cap — so the
*shape* is fixed too, not just the sum. This is what decides partial coverage: a buff that starts after
cast 1 pays only `0.4440 + 0.2213 = 0.665`, not 1.332. It is also why haste above the cap drains the
deficit from the back (cast 3 reaches the floor first).

## 1.2c ★★★ SHORT WINDOWS AND RE-RAMPS — when waiting for stacks stops paying

**Raised by the user 07-28**, and it is the case where §1.2's aggregate would mislead: after an
intermission you ramp again, and the burn window may be too short to wait.

Waiting `w` seconds for the stacks **saves** the deficits you skip (`Σ d_k · s`) and **costs** whatever
the buff loses off its far end if it no longer fits. Both scale with `s` — so **`s` cancels and the
break-even is a pure timing question, identical for Icon, Serpent-Coil and Arcane Power.** Algebraically
the cost of waiting past cast `k` is `Σ C_j / G` against a saving of `Σ (C_j − G)/G`, which is smaller by
exactly `k` — so once the buff is truncated at all, waiting always loses.

    ⇒  wait for the stacks  ⟺  rampLength + D  ≤  window remaining

Icon (20 s) at h = 0, where `rampLength = 6.498`, so the crossover is at **26.5 s**:

| window | 10 | 15 | 20 | 24 | **26.5** | 30 | 40 |
|---|---|---|---|---|---|---|---|
| wait − press-now (casts) | −0.232 | −0.232 | −0.232 | −0.026 | **+0.103** | +0.103 | +0.103 |
| fits after the ramp? | no | no | no | no | **yes** | yes | yes |

⇒ **A short post-intermission burn wants its value buffs pressed immediately**, and the penalty for
getting this backwards is bigger than the prize for getting it right (−0.232 against +0.103). Note it
is the *buff* that is time-constrained, not the ramp: the same rule with a 15 s Serpent-Coil moves the
crossover to 21.5 s.

## 1.2b ★★★★ RAMP-NEUTRALITY — and it inverts at the buff's own threshold

⚠ **Corrected 07-28 (user).** An earlier draft said *"haste cannot compress the opener; a haste cooldown
pressed at the pull buys nothing from the ramp."* Both halves are wrong. Haste **does** compress the
ramp — the casts are `C_k/m`. What is true is subtler, and it is the user's own formulation: *"it should
come out equal whether you pop Icy Veins before the first cast or the second or the third, as it will
then just have longer remaining duration for the shorter already-stacked casts."*

**That is exactly right, and it is exact.** Write the gain of a buff `v`, duration `D`, pressed at the
pull, where `R_x = ΣC_k / x` is the ramp's wall-clock length under multiplier `x`:

    gain = D·[rate(m·v) − rate(m)]  −  R_{mv}·rate(m·v)  +  R_m·rate(m)

While **both** rates are in the linear regime, `R_{mv}·rate(m·v) = (S/mv)(mv/G) = S/G = R_m·rate(m)` —
**the two ramp terms cancel identically**, leaving the plain steady-state value. The compression the
buff buys on the ramp is worth exactly what the ramp's zero cast-yield costs it.

    ⇒ RAMP-NEUTRAL exactly while  m·v ≤ 1.5  — which is the buff's OWN onset threshold (§2.1).

Icy Veins (×1.20, onset **394.3**), pull vs deep steady, engine integral:

| h | m·v | at the pull | deep steady | difference |
|---|---|---|---|---|
| 0 | 1.2000 | 2.666667 | 2.666667 | **−0.000000** |
| 200 | 1.3522 | 3.004711 | 3.004862 | −0.000150 |
| 380 | 1.4892 | 3.308575 | 3.309237 | −0.000662 |
| **394.3** | **1.5000** | 3.333520 | 3.332911 | **+0.000610** |
| 400 | 1.5044 | 3.296483 | 3.284718 | **+0.011765** |
| 500 | 1.5805 | 2.660472 | 2.439231 | **+0.221242** |

★ **One threshold, two meanings.** The same `m·v = 1.5` that decides whether a buff converts in full
also decides whether its placement relative to the opener matters at all. Below it, press Icy Veins
before cast 1, 2, 3 or at 0:60 — **identical to within 7e-4 casts**. Above it, the pull is strictly
better, and by two orders of magnitude more (0.0118 at h = 400, 0.221 at h = 500).

### ✅ SOLVED — it is MILLISECOND QUANTISATION of the cast grid; the closed form is the continuum

*User: "since it's deterministic algebra, isn't this a symptom that we've forgotten a factor somewhere?
Or is it a rounding error? Or is it really better because of the multiplication effect?"*

Read straight off the engine's board at h = 380 — every interval lands on a 1 ms grid:

| | ramp cast starts |
|---|---|
| continuum (closed form) | 0 · 2.014563 · 3.759981 · **5.236252** |
| **engine, no Icy Veins** | 0 · 2.015000 · 3.760000 · **5.236000** |
| continuum, hasted | 0 · 1.678803 · 3.133317 · **4.363544** |
| **engine, Icy Veins @0** | 0 · 1.679000 · 3.134000 · **4.364000** |

The model rounds cast times to the millisecond because **wowsims does** (`.Round(time.Millisecond)` on
every cast) and so does the 2.4.3 client. The two configurations round in **opposite directions**:

| case | ramp-end Δt vs continuum | × its rate | closed form − engine, measured |
|---|---|---|---|
| no Icy Veins | **−2.524e-4 s** (lands short) | +2.088e-4 casts | **−2.088e-4** ✓ |
| Icy Veins @ 0 | **+4.563e-4 s** (lands long) | −4.530e-4 casts | **+4.530e-4** ✓ |
| | | **sum 6.618e-4** | residual **6.618e-4** ✓ |

**Four significant figures, both signs, no free parameter.** The ramp lands 0.25 ms early in one
configuration and 0.46 ms late in the other; the steady stream then starts that much earlier or later
and carries the difference for the rest of the fight.

⇒ **All three candidate explanations were partly right, and the third one loses:**
* *a forgotten factor* — **yes, in the closed form**: it describes the **continuum**, the engine is on a
  **millisecond grid**. Neither is wrong; they are different models, by 1 ms.
* *a rounding error* — **yes, but a deliberate, physical one**, not float slop. My earlier "not
  rounding" tested *float precision* (2.8e-14) and never tested the quantisation. Wrong test.
* *really better because of the multiplication effect* — **no.** The direction is set by which way the
  grid happens to fall, and it **flips sign** between the two cases.

**The bound is now exact rather than empirical:** ≤ 3 ramp casts × 0.5 ms × rate ≤ **1.5e-3 casts**, and
it appears **only** where two configurations have different ramp lengths. Any two placements sharing a
ramp agree to **1e-13** (measured). ⇒ `d_k` and ramp-neutrality are **exactly** exact in the continuum;
the engine adds ≤1.5e-3 casts of the same quantisation the game itself has.

### (superseded) the earlier framing — kept because the wrong test is the instructive part

*User: "since it's deterministic algebra, isn't this a symptom that we've forgotten to include a factor
somewhere? Or is it a rounding error? Or is it really better because of the multiplication effect?"* —
**the first one.** Not rounding, not a multiplication benefit. Swept finely, the shape gives it away:

Icy Veins press time vs value, h = 380 (bare ramp cast starts 0.0000 / 2.0146 / 3.7600 / 5.2363):

| press at | value | |
|---|---|---|
| **exactly 0.000** | 3.308575 | catches ramp cast 1 |
| 0.25 … 2.00 | 3.308410 | misses cast 1, wastes its remainder |
| **2.25 and every value after** | **3.309237** | = deep steady, to **1e-13** |

★ **Neutrality is EXACT — to machine precision — for any press from ramp cast 2 onward.** The entire
residual lives in **ramp cast one**, and nowhere else. That is a three-order-of-magnitude narrowing of
where to look.

Two of the three levels are already correct physics: a press at 0.25 misses cast 1 (haste is snapshot
at cast start) and forfeits the remainder of the longest cast in the fight — the 8.3e-4 dip is that,
and it is right. The unexplained part is only that **pressing at exactly 0.000, which catches
everything, still lands 6.6e-4 below deep steady.**

⇒ **And the closed form is not innocent either.** Working the same case by hand — ramp under the buff
`R_v = 4.36350 s`, without it `R_1 = 5.23620 s`, remainder at the respective steady rates — gives
**−4.6e-5**, not zero. So `R_{mv}·rate(m·v) = S/G = R_m·rate(m)` is an *approximate* cancellation, and
"exactly neutral" was my overstatement, not just the engine's residue. The engine and the hand
derivation disagree by ~6e-4 and **both** disagree with zero.

⛔ Two dismissals are ruled out by measurement, not argument:
* **Not rounding.** Five deep-steady placements agree to **2.8e-14** and a sub-interval sweep to
  **8.5e-14**. The arithmetic is exact to float precision; a 6.6e-4 is 10¹⁰ times that.
* **Not haste × haste.** One haste buff in the experiment; passive haste is the state, not a placeable
  effect, so there is nothing to multiply against.

⇒ **Open, and the right kind of open: a named missing term with a one-line reproduction**
(`node tools/facts-ladder.mjs --score=integral`, or the sweep above), bounded at 7e-4 casts — 0.05 % of
one cast, ~300× below the effect it sits inside. The law "a haste cooldown is ramp-neutral below its own
onset threshold" is safe to plan on; the word **exactly** is not, until the first-cast term is found.

### (superseded) the earlier framing of this residual

*User question, 07-28: "How can there be a difference here? Shouldn't it be neutral?"* The algebra says
exactly zero: `R_{mv}·rate(m·v) = S/G = R_m·rate(m)` cancels identically while both rates are linear.
The engine says −0.000150 at h = 200 and −0.000662 at h = 380.

**It is not instrument noise.** Measured floor: five deep-steady placements of Icy Veins (60 … 140 s)
agree to **2.8e-14** — machine epsilon — and a sub-interval sweep across one full cast interval agrees
to **8.5e-14**. So the scoring of a window in steady state is exact to float precision, and the residual
is specific to a window that *starts on the ramp*.

**It is not haste × haste.** There is only one haste buff in this experiment. Passive haste is the
state, not a placeable effect, so there is nothing for Icy Veins to multiply against.

What is known: it is monotone in `h`, grows toward the threshold, is **negative** below it (the pull is
slightly *worse*) and flips sign at it. Magnitude ≤ 7e-4 casts — 0.05 % of one cast, ~300× smaller than
the effect it sits inside, and far below anything a plan turns on. ⇒ **The neutrality law stands as
stated; this is a known unexplained residual at its edge, not a competing effect.** Most likely
suspects, both unverified: the engine's expected press-snap slip differing between a ramp interval and
a steady one, and the discrete ramp casts' completions interacting with the window edge.

⛔ It was briefly labelled "press-snap noise" in this file. That was wrong — the floor measurement above
rules noise out, and a real 7e-4 deserves an open flag rather than a dismissal.

### And above the steady cap the pull is the ONLY place it is worth anything

Once `m ≥ 1.5` the steady stream is floored, so a haste cooldown converts **nothing** there — but the
ramp casts are still above the floor and still compressible (§1.1). Icy Veins, engine integral:

| h | before cast 1 | cast 2 | cast 3 | cast 4 / steady |
|---|---|---|---|---|
| 900 | **0.662** | 0.396 | 0.166 | **0.000** |
| 1400 | **0.367** | 0.000 | 0.000 | 0.000 |

⇒ **The placement rule for the pull completely inverts across the threshold.** Below it the opener is
irrelevant; above the steady cap the opener is the *entire* remaining value of every haste cooldown you
own — and each intermission re-ramp is another one.

⛔ **None of this licenses a prepull.** A prepull removes ramp casts from the fight rather than
compressing them, its −2.3 s is haste-blind, and it makes a sim haste sweep non-monotone. The model
opens cold (RULES §3, TOOLING ★★★).

## 1.2d ★★★★ AN INTERMISSION LONGER THAN 8 s IS A NEW MINI-FIGHT — with the cooldowns still ticking

**User rule, 07-28, and the threshold is not a heuristic — it is `GAME.AB.DEBUFF_DUR = 8 s` exactly.**
Arcane Blast's own debuff carries the stacks; go 8 s without casting one and it falls off, so you come
back at 0 stacks and pay the whole opener again.

Verified — intermission at t = 80, h = 0, first cast after the gap:

| gap length | stacks on the first cast after | its interval | cold starts in the fight |
|---|---|---|---|
| 4 / 6 / 7 / **7.9** s | **3** | 1.5000 | 1 |
| **8.0** / 8.1 / 10 / 20 s | **0** | **2.5000** | **2** |

**Sharp at 8.000.** And crossing it costs exactly the opener toll: gap 7.9 s → 8.0 s, downtime-corrected,
is **−1.3320 casts** — §1.2's number to the digit.

### ★★★ THERE ARE THREE OUTCOMES, NOT TWO — the mid-cast lapse (user, 07-28; engine FIXED the same day)

The debuff is applied on **completion** and expires `DEBUFF_DUR` after the previous cast's **start**. So
with `G` = the start→start gap and `ct` = the resuming cast's own length, there is a band between "fine"
and "full re-ramp" that the engine ignored for the whole project:

| | condition | what happens |
|---|---|---|
| refreshed | `G ≤ 8 − ct` | nothing. 3 stacks throughout. |
| **mid-cast lapse** | **`8 − ct < G < 8`** | the cast **begins** with the stacks, so it keeps the fast cast time (snapshot rule) — but the old debuff **lapses while it is in flight**, so its own completion lands a **fresh** stack. The **next** cast has **1**, not 3. |
| cold | `G ≥ 8` | 0 stacks. Full re-ramp, full 1.332 toll. |

**The band's width IS the cast time, so it SHRINKS with haste** — exactly as the user put it (*"anywhere
between 8 and 8 − current casting time"*):

| h | 3-stack cast | band in `G` | width |
|---|---|---|---|
| 0 | 1.4980 | **(6.502, 8)** | 1.4980 |
| 200 | 1.3294 | (6.671, 8) | 1.3294 |
| 400 | 1.1949 | (6.805, 8) | 1.1949 |
| 788.5 (cap) | 0.9987 | (7.001, 8) | 0.9987 |

**Cost inside the band = `d₁ + d₂` = 0.4440 + 0.2213 = 0.6653 casts** — §1.2a's ladder minus the 0-stack
cast you legitimately skip. Half the full toll, for a gap that looks harmless.

⛔ **The engine reported `[3,3,3]` where the game gives `[3,1,2]` and charged zero.** Fixed 07-28: the
walk now resolves all three cases (`lapsedMidCast` in `simulateRaw`). `plan-diff` **IDENTICAL** over the
swept corpus — **no preset has a gap in the band** (the corpus's downtimes are 5, 15, 40, 40, 54, 135 and
155 s), so this is pure correctness with zero plan movement. It will bite the first encounter with a
~7-second movement or AoE phase.

⚠ **Same rule for an AoE phase**, and for the same reason: Arcane Explosion neither builds nor refreshes
the Arcane Blast debuff, so an AoE window is a gap in the AB stream and its exit goes through the
identical three-way branch.

⇒ **Below `8 − ct` a gap is just downtime.** It costs its own seconds and nothing else; the stacks
survive, so the stream resumes at full speed. No re-ramp, no toll.

⇒ **At or above 8 s, everything in §1.2–§1.2c applies again, from scratch:**
1. a fresh **1.332-cast** toll, front-loaded `0.6667 / 0.4440 / 0.2213` per cast (§1.2a);
2. the value buffs are ramp-averse again by `1.332 · s` — **0.40 casts for Arcane Power** (§5.6b);
3. the wait-or-press-now decision is live again, and it is the *truncated* form that usually binds
   because a post-intermission burn window is short: **wait one more cast iff the buff still fits
   afterwards**, and once it does not, each further cast of waiting costs a flat `s` (§5.7);
4. haste cooldowns are ramp-**neutral** across the new ramp below their own onset threshold and
   ramp-**preferring** above it (§1.2b) — and **above the steady cap the new opener is the only place
   they pay anything at all** (§1.1). A fight with three re-ramps has three of those.

⚠⚠ **BUT IT IS NOT A FRESH FIGHT IN THE ONE WAY THAT MATTERS MOST: the cooldowns kept ticking.** The
downtime spends cooldown time and buys nothing. So the second mini-fight is planned against
*availability*, not against a fresh budget — Bloodlust (600 s) will not be back, Icy Veins (180 s) and
Arcane Power (180 s) may or may not be, Icon and Serpent-Coil (120 s) usually are. **A long
intermission is therefore strictly worse than the same seconds of uptime**, by its own length *plus*
1.332 casts *plus* whatever cooldown time it wasted — three separate costs, and only the first is
obvious.

### ⛔ AND "HOLD IT FOR THE EXIT TO COVER THE NEW RAMP" IS WRONG — corrected 07-28 (user)

That was this file's advice for a few hours and the user killed it with one line: *"the ramp doesn't
really matter for haste until ridiculously high passive haste numbers."* Right — §1.2b — and worse, a
**value** buff does not merely not-care, it is ramp-**averse** (§5.6b). *Nothing* wants to cover a ramp.

Measured. `T = 200`, intermission `80–100`, h = 0; 3 stacks return at `t = 106.498`. Value in casts
above never pressing:

| press at | Icy Veins (20 s, haste) | Icon (20 s, +SP) | Arcane Power (15 s, ×dmg) |
|---|---|---|---|
| whole window fits before the wall | 2.5667 (**−0.100**) | 0.9906 (**−0.039**) | 2.8500 (**−0.150**) |
| 2 s before the wall | 0.1667 (−2.500) | 0.0643 (−0.965) | 0.2500 (−2.750) |
| 0.1 s before the wall | **0.0000 (−2.667)** | 0.0772 (−0.952) | **0.0000 (−3.000)** |
| at the exit (covering the ramp) | 2.6667 (**best, tied**) | 0.8878 (**−0.141**) | 2.4504 (**−0.550**) |
| once 3 stacks are back | 2.6667 (**best, tied**) | **1.0292 (best)** | **3.0000 (best)** |

★★★ Three things fall out, and only the first was in the earlier advice:

1. **The dominant cost is a window expiring into the empty room, and it is just the wasted seconds.**
   Icy Veins pressed 0.1 s before the wall is worth **0.0000** against 2.6667 — the entire cooldown
   thrown away. This is the real reason to hold, and it has nothing to do with ramps.
2. **A window that fits ENTIRELY before the wall is nearly as good as the best placement after it** —
   −0.100 / −0.039 / −0.150 casts. So *do not* hold reflexively: if the whole window fits in the
   remaining uptime, spend it there and start the cooldown ticking sooner.
3. ⛔ **Pressing at the EXIT is the worst of the sensible options for a value buff** — worse than
   pressing it before the intermission at all (Icon 0.8878 vs 0.9906; Arcane Power 2.4504 vs 2.8500),
   because the exit is precisely where the ramp is. For a **haste** cooldown the exit and
   post-stacks are **exactly tied**, which is §1.2b's ramp-neutrality reappearing on the far side of an
   intermission.

### ★★★★ AND THE WHOLE SECTION IS SECOND-ORDER — the hierarchy, corrected 07-28 (user)

*"All of these only matter if it actually gets you an extra use of the cooldown, right? Otherwise just
normal rules apply. The shorter fights we have shouldn't really be influenced by this."* — **both halves
measured, both hold, and together they demote everything above.**

**1. An intermission NEVER costs a use. Cooldowns tick through downtime.** Legal use counts computed
with and against the gap on every preset in the corpus that has one:

| preset | T | downtime | ≥8 s | legal uses with gap vs without |
|---|---|---|---|---|
| The Lurker Below | 160 | 40 s | yes | **identical** |
| Leotheras the Blind | 135 | 15 s | yes | **identical** |
| Lady Vashj | 390 | 155 s | yes | **identical** |
| Al'ar | 240 | 54 s | yes | **identical** |
| High Astromancer Solarian | 75 | 5 s | no | **identical** |
| Kael'thas Sunstrider | 420 | 135 s | yes | **identical** |
| 2:40 lust 0:07 intermission 1:30–2:10 | 160 | 40 s | yes | **identical** |

**7 of 7.** So the downtime constrains *where* a window may go and never *how many* you get.

**2. On our short fights there is nothing to decide.** Legal uses by fight length, standard kit:

| T | 100 | 120 | 140 – 180 | 200 | 300 | 440 |
|---|---|---|---|---|---|---|
| Icy Veins / AP / Berserking | 1 | 1 | 1 | 2 | 2 | 3 |
| Icon / Serpent-Coil | 1 | 1 | **2** | 2 | 3 | 4 / 3 |

At **T ≤ 120 every cooldown has exactly one use**, so there is no hold-versus-spend question at all —
you place the single window where it is worth most and stop. The first thing to gain a second use is
Icon/Gem at T ≈ 140.

⇒ **THE HIERARCHY.** An intermission ≥ 8 s does exactly **one** new thing: it adds a **cold start**, with
its own 1.332-cast toll and its own ramp rules on the far side (§1.2a–§1.2c). That is the whole of it.

Everything else in this section is the **normal placement rules** (§4, §5) applied to a stretch of fight
that happens to contain zero casts. *"Do not let a window expire into the empty room"* is not an
intermission rule — it is *"put the window where the casts are"*, and the empty room simply has none.
⇒ **Do not carry a separate intermission playbook.** Carry the normal rules, plus: **count the cold
starts, and pay 1.332 casts for each.**

## 1.3 What one point of haste rating is worth

    d(rate)/dh  =  1 / (G · RTG)  =  1 / 2365.5  =  4.2274e-4  casts/s per point       (m < 1.5)
                =  0                                                                    (m ≥ 1.5)

Over a fight of `T` seconds: **`T / 2365.5` casts per rating point.**

| fight | per haste rating point |
|---|---|
| 1:00 | 0.0254 casts |
| 2:00 | 0.0507 |
| 3:00 | 0.0761 |
| 5:00 | 0.1268 |

**Under an active multiplier `v` (itself uncapped) a passive point is worth `v ×` that** — `rate = m_p·v/G`,
so the derivative carries `v`. A haste rating point is 30 % more valuable inside Bloodlust, and worth
nothing at all once `m_p·v ≥ 1.5`.

⇒ **The opportunity cost of overcapping is ~70:1, not infinite** (§1.1). For every practical purpose
inside a fight it is total — a haste cooldown that pushes you past `m = 1.5` converts *nothing* at
steady state, and only the ramp remains. That is the single most important fact for cooldown placement,
and the one nuance is that it is a **per-opener** residue rather than a per-second one.

---

# 2. ONE HASTE BUFF

A buff of multiplier `v` and duration `D`, on top of a state whose multiplier is `m`:

    Δcasts  =  D · [ rate(m·v) − rate(m) ]

*Verified exact, 12/12 cells: Bloodlust / Icy Veins / Berserking × h = 0, 200, 400, 600.*

## 2.1 Its two thresholds

| | condition | meaning |
|---|---|---|
| **onset of waste** | `m · v = 1.5` | below this the buff converts in full |
| **worth zero** | `m = 1.5` | the state is already capped; the buff does nothing |

For a buff used **alone** on passive haste, the onset threshold is

    multiplier buff:  h = (1.5/v − 1) · RTG            rating buff:  h = 788.5 − r

| cooldown | | onset threshold |
|---|---|---|
| Bloodlust | ×1.30 | **242.6** |
| Icy Veins | ×1.20 | **394.3** |
| Mind Quickening Gem | +330 | **458.5** |
| Berserking | ×1.10 | **573.5** |
| Skull of Gul'dan | +175 | **613.5** |

*All five reproduced by `facts-ladder --score=integral` with rms fit `0.0000` casts, and each beats a
±50-rating shifted threshold.*

## 2.2 The tent, and how much of a buff is thrown away

Between its onset threshold and the cap the buff is **partially** wasted:

    wasted fraction  =  1 − (1.5 − m) / ( m · (v − 1) )              for  m < 1.5 ≤ m·v

⚠ **Touching the cap does NOT waste the whole buff — only the part above it.** A buff that overcaps
still delivers everything up to `m = 1.5`. Example, Berserking at h = 600: `m = 1.38047`, delivered
`10 × (1 − 0.92031) = 0.797` casts against an uncapped `0.920` ⇒ **13.4 % wasted, 86.6 % kept.**
*(Engine integral at that cell: 0.79687.)*

So the value of a haste cooldown as passive haste rises is a **tent**: flat (rating buffs) or rising
(multiplier buffs) up to its threshold, then falling linearly to exactly zero at h = 788.5.

---

# 3. ONE VALUE BUFF

A value buff does not change how many casts you get — it changes what each is worth. Write its
per-cast fractional gain as `s`:

    +SP buff:            s  =  COEF · ΔSP / ( BASE + COEF · SP_passive )
    damage multiplier:   s  =  v − 1

    Δcasts-equivalent  =  n · s        n = casts covered = D · rate(m)

*Verified exact at SP_passive = 0, 700, 1000, 1387, 2000.*

## 3.1 ★ A temporary +SP buff is diluted by passive spell power

`s` falls as `SP_passive` rises — the same +155 SP is a smaller *fraction* of a bigger hit:

| passive SP | Icon of the Silver Crescent (+155) | Serpent-Coil Braid (+225) |
|---|---|---|
| 0 | **15.377 %** | 22.32 % |
| 700 | **9.075 %** | 13.17 % |
| 1000 | **7.719 %** | 11.21 % |
| 1387 | **6.472 %** | 9.39 % |
| 2000 | **5.153 %** | 7.48 % |

*(Icon's column verified against the engine at all five rows; Serpent-Coil follows from the same
formula.)*

⇒ **Everything a +SP trinket is worth — including every alignment bonus it earns by sitting inside a
haste window — shrinks with your gear.** Icon loses 16 % of its value going from 1000 to 1387 passive
SP, and a rule that says "always put Icon inside Bloodlust" is quietly a rule about *your* spell power.

A **damage multiplier** (Arcane Power ×1.3) is immune: `s = 0.30` at every gear level.

---

# 4. PAIRS — the composition table

The interaction is the excess over adding the two effects separately:
`I = V(A∪B) − V(A) − V(B) + V(∅)`. It does not matter **which** spell supplies an effect, only **by how
much** — everything below is written in `v`, `r`, `s` only.

| pair | interaction over the overlap |
|---|---|
| **sp × sp** | **exactly 0** — spell power adds, so `s₁₊₂ = s₁ + s₂` identically |
| **dmg × sp** | `n · d · s` |
| **dmg × dmg** | `n · d₁ · d₂` |
| **haste × value** | `D · [ rate(m·v) − rate(m) ] · s` |
| **haste × haste** | `D · [ rate(m·v₁·v₂) + rate(m) − rate(m·v₁) − rate(m·v₂) ]` |

*All verified: sp×sp reads `0.00000` casts at 1000 and 1387 SP; dmg×sp and haste×value exact at both
(e.g. AP × Icon at 1000 SP: formula 0.23157, engine 0.23157).*

**haste × value in words:** the extra casts the haste buff buys inside the overlap, each worth `s`
extra. That is why a +SP window wants to sit where casts are fastest — and why the size of that want
falls with your passive spell power (§3.1).

## 4.1 haste × haste has two regimes and two thresholds

Expanding `rate` in each regime:

    while  m·v₁·v₂ ≤ 1.5   (nothing capped):      I = D · m · (v₁−1)(v₂−1) / G          ≥ 0, always
    once   m·v₁·v₂ > 1.5   (the pair overcaps):   I = D · [ 1/F − m·(v₁+v₂−1) / G ]

so there are **two** distinct thresholds and a live band between them:

| threshold | condition | what happens |
|---|---|---|
| **overcap onset** | `m · v₁ · v₂ = 1.5` | the pair starts wasting; the bonus stops growing |
| **sign flip** | `m · (v₁ + v₂ − 1) = 1.5` | the bonus reaches **zero** and goes negative above |

⚠ **Do not conflate them.** Between the two the pair still helps, just less. Below the first it helps in
full.

## 4.2 ★★★★ THE CORNER IS THE ONLY SOURCE OF CONFLICT — and it has a sharp exception

From §0.1: `min` is the only non-linearity. Two consequences, and the second one caught me out:

**Below the cap** every interaction is a plain product of fractional gains. Therefore:

* effects that compose **multiplicatively** (haste ×v, damage ×v) always interact **positively**;
* effects that share an **additive pool** — two +SP buffs, or two +haste-**rating** buffs — interact
  **exactly zero, at every order**;
* so the interaction lattice is *sparse*: only subsets whose members are all multiplicative matter.

*Verified: `mqg × skull = 1.1e-16`, `mqg × drums = 0`, `skull × drums = 0`, and the order-3
`mqg × skull × drums = −2.2e-16`.*

### ⚠ "If haste × haste is multiplicative, how can that be zero?" (user, 07-28)

**Because only *half* the haste family is multiplicative — and the user's own guess is the answer: some
buffs add flat rating, some are true multipliers.** From §0:

    m  =  ( 1 + [ h + Σ rating ] / RTG )  ·  Π multipliers
             └──────── ONE additive pool ────────┘   └── these multiply ──┘

* **rating × rating** — both sit inside the *same linear* bracket, and the second difference of a linear
  function is **identically zero**. Mind Quickening Gem, Skull of Gul'dan and Drums of Battle therefore
  have **no interaction with each other, ever** (below the cap). Not a small number — structurally zero.
* **multiplier × multiplier** — `v₁v₂ ≠ v₁ + v₂ − 1`, so a genuine cross-term. *This* is the family the
  phrase "haste × haste is multiplicative" is about: Bloodlust, Icy Veins, Power Infusion, Berserking.
* **rating × multiplier** — the bracket and the product **are** multiplied, so there is a cross-term
  here too. At h = 0: `MQG × Bloodlust = −0.00617`, `Skull × Bloodlust = +0.02219` — non-zero, and of
  **opposite sign**, because MQG is large enough to overcap with Lust at zero gear and Skull is not.

⇒ **"Haste stacks multiplicatively" is a statement about the four multipliers only.** Rating is a pool:
additive with itself, multiplicative with the multipliers. That one asymmetry generates the wall of
zeros in the matrix, the `sp × sp = 0` law (spell power is a pool for exactly the same reason), and the
sign flip between the MQG and Skull columns.

⛔ **The sparsity law holds ONLY below the cap, and I published it once without that clause.** `min` is
not multilinear, so once the corner is active it manufactures interactions between effects that have no
business interacting:

| set | h=0 | why |
|---|---|---|
| `mqg × skull` | 0 | one pool, uncapped (`m = 1.320`) |
| `mqg × skull × drums` | −2.2e-16 | one pool, still uncapped (`m = 1.371`) |
| **`mqg × skull × bloodlust`** | **−0.0962** | same pool — but ×1.3 pushes `m` to 1.716, **over the corner** |

⇒ **Every negative number anywhere in this file is the corner.** Nothing else in the model can produce
one. "Opportunity cost", "clipping", "wasted buff", "the pair fights itself" are all one phenomenon.

---

# 5. THE NAMED PAIRS — exact numbers

## 5.1 Berserking × Bloodlust — **+0.2000 casts at h = 0**

`v₁ v₂ = 1.43 < 1.5`, so at h = 0 nothing is clipped and the whole multiplicative cross-term lands:

    I = 10 · 1 · (0.3)(0.1) / 1.5 = 0.2000 casts

| passive haste | interaction |
|---|---|
| 0 | **+0.200** |
| 50 | +0.206 ← peak, just under the overcap onset |
| **77.2** | overcap onset (`m · 1.43 = 1.5`) |
| 100 | +0.075 |
| **112.6** | **sign flip** (`m · 1.40 = 1.5`) |
| 150 | −0.221 |
| 200 | −0.517 |

⇒ **Below h ≈ 113, Berserking belongs inside Bloodlust. Above it, outside.** *(Formula vs engine
integral: agrees to ≤0.005 casts at every row.)*

### ⚠⚠ …AND THAT NUMBER ASSUMES NOTHING ELSE IS IN THE WINDOW (user, 07-28)

**Yes — and it applies to every threshold in this file.** They are all conditions on `m`, the **full**
multiplier of the state; the tabulated *rating* values are what you get solving them with `m = m_p`
alone. Put anything else in the window and `m` rises, so the flip arrives **earlier**:

    flip:  m_p · Π v_other · (v₁ + v₂ − 1) = 1.5        other RATING buffs fold into h, not the product

Berserking × Bloodlust, re-solved and engine-verified:

| also active in that window | flip haste | interaction at h = 0 |
|---|---|---|
| *(nothing)* | **112.6** | +0.02000 |
| Drums of Battle (+80) | **32.6** | +0.01932 |
| Skull of Gul'dan (+175) | **negative at h = 0 — never overlap** | −0.03691 |
| Mind Quickening Gem (+330) | **negative — never overlap** | −0.08062 |
| Icy Veins **or** Power Infusion (×1.2) | **negative — never overlap** | −0.08000 |

★ So *"Berserking inside Bloodlust below h ≈ 113"* is a statement about a Lust window with **nothing
else in it**. Add Icy Veins and Berserking belongs outside at *any* gear level — the three-way product
`1.3 × 1.2 × 1.1 = 1.716` is **14 % over the floor before you own a single point of haste.**

⇒ **The same caveat governs §5.2, §5.3, §5.6 and the whole matrix: those are TWO-BODY numbers.** For a
real window, substitute the full `m` and re-solve — one line of arithmetic, and it always moves the
answer the same way.

## 5.2 Icy Veins × Bloodlust — **exactly 0.000 at h = 0**, negative everywhere above

`v₁ v₂ = 1.56 > 1.5`: the pair is overcapped *before you have any gear at all*, so the capped branch
applies from h = 0 — and `v₁ + v₂ − 1 = 1.5` puts h = 0 **precisely on the sign-flip threshold**:

    I(h=0) = 20 · [ 1 − 1 · 1.5 / 1.5 ] = 0 exactly

| passive haste | interaction |
|---|---|
| **0** | **0.000 — a genuine, exact tie** |
| 50 | −0.634 |
| 100 | −1.268 |

⇒ **At h = 0 the haste side is exactly indifferent to whether Icy Veins overlaps Bloodlust.** The
multiplicative bonus and the GCD overcap cancel to the digit. Above h = 0 the haste side turns against
it fast (−1.27 casts by h = 100).

### ★★★ …AND "IRRELEVANT" IS THE WRONG CONCLUSION AT h = 0 — IT IS FREE, THEREFORE DO IT (user, 07-28)

*"Overlapping them at h=0 costs nothing, therefore it's good to do to max out the potential value of any
other multiplicative SP / AP buff, and it becomes a question of when it stops being worth it as passive
haste rises."* — **correct, and it is the sharper reading.** A zero cost is not a reason to be
indifferent; it is a reason to take the side-effect for free. And the side-effect is that **the
overlapped window is the fastest window in the fight**:

| window at h = 0 | `m` | rate (casts/s) |
|---|---|---|
| Bloodlust alone | 1.30 | 0.86667 |
| Icy Veins alone | 1.20 | 0.80000 |
| **Icy Veins + Bloodlust** | 1.56 → **capped** | **1.00000** |

By `haste × value` (§4) that is exactly where Icon, Serpent-Coil and Arcane Power want to be. A value
buff of duration `D_v` inside the overlap rather than inside Lust alone gains
`D_v · [rate(1.56m) − rate(1.30m)] · s`. At h = 0 with Icon (20 s, `s` = 7.719 %):
`20 × 0.13333 × 0.07719` = **+0.206 casts, bought for a haste-side cost of exactly zero.**

### When it stops paying — closed form, engine-verified

While the overlap is capped and Lust alone is not (`rate(1.56m) = 1`, `rate(1.3m) = 1.3m/G`):

    cost(h) = D_IV · (m − 1)                 gain(h) = D_v · (1 − 1.3·m/G) · s

    ⇒  h* = RTG · (D_v/D_IV) · 0.13333 · s  /  ( 1 + (D_v/D_IV) · 0.86667 · s )

| value buff(s) in the window | `s` | **h\*** |
|---|---|---|
| Icon alone (20 s) | 0.0772 | **15.2** |
| Serpent-Coil alone (15 s) | 0.1121 | **16.5** |
| Icon + Serpent-Coil (SP adds) | 0.1892 | **34.2** |
| Icon + Serpent-Coil + Arcane Power | 0.5460 | **77.9** |

*(Arcane Power is 15 s against Icy Veins' 20 s, so treat 77.9 as an upper bound — the row assumes full
coverage.)*

⇒ **The honest rule is two-sided, and it is NOT "always separate them":**
* **at h ≈ 0 with the value cluster in that window — overlap.** The haste side is free and the value
  side pays up to ~0.2 casts.
* **above `h*` (15 with one trinket, ~78 with the whole cluster) — separate them.** The haste cost is
  now real and grows about 10× faster than the value gain shrinks.
* the **more value** you stack there, the longer overlapping survives; the **more passive spell power**
  you have, the shorter, because `s` dilutes (§3.1).

★ This is the cleanest example of the whole framework: two haste cooldowns, one pairing worth +0.200
and the other worth 0.000, at the same haste, for one reason — 1.43 is under the floor and 1.56 is over
it.

## 5.3 Icy Veins × Berserking

`v₁ v₂ = 1.32`. Overcap onset `m = 1.5/1.32` ⇒ **h = 215.0**; sign flip `m = 1.5/1.30` ⇒ **h = 242.6**.
At h = 0: `I = 10 · (0.2)(0.1)/1.5 = +0.133` casts.

## 5.4 ★ Above h = 242.6, any haste cooldown used inside Bloodlust is worth exactly zero

`m_p · 1.3 ≥ 1.5` at h ≥ 242.6, so the state is already capped for the whole Bloodlust window and
`rate(m·v) = rate(m) = 1/F`. This is §2's cap applied to the state *including* Lust — it is not a
separate rule, and it is why every geared placement question answers "outside Lust".

## 5.5 THE FULL HASTE×HASTE MATRIX

Interaction **per second of overlap**, exact from `rate(m) = min(1/F, m/G)`:

**h = 0**

| | Lust | IcyV | PowInf | Zerk | MQG | Skull | Drums |
|---|---|---|---|---|---|---|---|
| **Bloodlust** | · | **0.00000** | **0.00000** | +0.02000 | −0.00617 | +0.02219 | +0.01015 |
| **Icy Veins** | 0.00000 | · | +0.02667 | +0.01333 | +0.02790 | +0.01480 | +0.00676 |
| **Power Infusion** | 0.00000 | +0.02667 | · | +0.01333 | +0.02790 | +0.01480 | +0.00676 |
| **Berserking** | +0.02000 | +0.01333 | +0.01333 | · | +0.01395 | +0.00740 | +0.00338 |
| **MQG** | −0.00617 | +0.02790 | +0.02790 | +0.01395 | · | **0** | **0** |
| **Skull** | +0.02219 | +0.01480 | +0.01480 | +0.00740 | **0** | · | **0** |
| **Drums** | +0.01015 | +0.00676 | +0.00676 | +0.00338 | **0** | **0** | · |

**h = 300** — the same matrix, almost entirely inverted:

| | Lust | IcyV | PowInf | Zerk | MQG | Skull | Drums |
|---|---|---|---|---|---|---|---|
| **Bloodlust** | · | −0.15870 | −0.15870 | −0.07935 | −0.13951 | −0.07398 | −0.03382 |
| **Icy Veins** | −0.15870 | · | −0.11089 | −0.03154 | −0.09169 | −0.02617 | +0.00676 |
| **Berserking** | −0.07935 | −0.03154 | −0.03154 | · | −0.01234 | +0.00740 | +0.00338 |
| **MQG** | −0.13951 | −0.09169 | −0.09169 | −0.01234 | · | −0.00698 | **0** |
| **Drums** | −0.03382 | +0.00676 | +0.00676 | +0.00338 | **0** | **0** | · |

## 5.6 ⇒ THE ONE TABLE TO PLAN FROM — sign-flip haste per pair

**Below this rating, overlap the pair. Above it, separate them.** (Multiplier pairs:
`h* = (1.5/(v₁+v₂−1) − 1)·RTG`.)

| | Lust | IcyV | PowInf | Zerk | MQG | Skull | Drums |
|---|---|---|---|---|---|---|---|
| **Bloodlust** | · | **0** | **0** | **112.6** | **never** | 108.0 | 181.1 |
| **Icy Veins** | 0 | · | 112.6 | 242.6 | 119.2 | 248.4 | 327.6 |
| **Power Infusion** | 0 | 112.6 | · | 242.6 | 119.2 | 248.4 | 327.6 |
| **Berserking** | 112.6 | 242.6 | 242.6 | · | 273.5 | 414.4 | 500.7 |
| **MQG** | never | 119.2 | 119.2 | 273.5 | · | always | always |
| **Skull** | 108.0 | 248.4 | 248.4 | 414.4 | always | · | always |
| **Drums** | 181.1 | 327.6 | 327.6 | 500.7 | always | always | · |

*"never" = negative already at h = 0 (MQG + Bloodlust overcaps with no gear at all). "always" =
identically 0, so it never matters — the rating-pool block.*

### The patterns, and they are the payoff

1. **Read the matrix by strength.** The stronger the pair, the earlier it flips. Bloodlust flips with
   *everything* first; Berserking — the weakest multiplier — flips last with everything and is the most
   stackable cooldown you own.
2. **Icy Veins and Power Infusion have identical rows**, to the digit, in all three tables. Same ×1.20,
   same object (§0.0).
3. **The rating-pool block is a wall of zeros** and stays zero at every haste until the corner reaches
   it. Drums / Skull / MQG never care about each other.
4. **`242.6` appears three times**: as Bloodlust's own onset threshold, and as the flip haste of
   Berserking×IcyVeins and Berserking×PowerInfusion. Not a coincidence — `1.2 + 1.1 − 1 = 1.3`.
5. **The whole matrix goes negative between h = 0 and h = 300.** Low-gear planning is "stack it all";
   geared planning is "spread it all". There is no third regime, and the transition rating for any pair
   is one table lookup.

## 5.6b RAMP PREFERENCE FOR THE WHOLE KIT — (post-ramp − pull), casts

Positive = wants the stacks built first. Passive SP 1000.

| cooldown | h=0 | h=200 | h=400 | h=600 | h=900 | law |
|---|---|---|---|---|---|---|
| **Arcane Power** ×1.3 dmg | **+0.3996** | +0.3997 | +0.3995 | +0.3996 | +0.3411 | `1.332 · s`, `s = 0.30` |
| **Serpent-Coil** +225 SP | **+0.1493** | +0.1493 | +0.1492 | +0.1492 | +0.1274 | `1.332 · s` |
| **Icon** +155 SP | **+0.1028** | +0.1028 | +0.1028 | +0.1028 | +0.0878 | `1.332 · s` |
| Bloodlust ×1.3 [242.6] | 0 | 0 | −0.345 | −0.711 | −0.852 | 0, then pull |
| Icy Veins ×1.2 [394.3] | 0 | 0 | −0.012 | −0.409 | −0.662 | 0, then pull |
| Power Infusion ×1.2 [394.3] | 0 | 0 | −0.012 | −0.409 | −0.662 | identical to Icy Veins |
| MQG +330 [458.5] | 0 | 0 | 0 | −0.245 | −0.486 | 0, then pull |
| Berserking ×1.1 [573.5] | 0 | 0 | 0 | −0.054 | −0.376 | 0, then pull |
| Skull +175 [613.5] | 0 | 0 | 0 | 0 | −0.273 | 0, then pull |
| Drums +80 [708.5] | 0 | 0 | 0 | 0 | −0.129 | 0, then pull |

★ **Two clean families, and no exceptions.**
* **Value buffs are ramp-averse by exactly `1.332 · s`, at every haste below the cap** — the opener
  deficit priced per cast. `s` does not depend on `h`, so neither does the aversion. **Arcane Power is
  the most ramp-averse cooldown you own, at 0.40 casts** — nearly four Icons.
* **Haste buffs are exactly ramp-NEUTRAL below their own onset threshold and pull-preferring above it**
  (§1.2b). Every one of the seven turns at its own bracketed number. There is no other pattern to find.

⇒ **The split haste of any (haste × value) pair sits just above the HASTE buff's own onset threshold** —
measured: Bloodlust 242.6 → splits ~250; Icy Veins 394.3 → 402–427; Power Infusion 394.3 → 427–494;
MQG 458.5 → 461–472; Berserking 573.5 → 593–629; Skull 613.5 → 617–618; Drums 708.5 → 710–711.
**Seven for seven.** How far above depends on how much overlap the split gives up, which scales with `s`
— the second-order spell-power effect of §5.7.

⚠ **Why those are ranges and not single numbers.** Near the crossing the margin is ~0.01 casts and
non-monotone in `h` (Bloodlust × Icon reads +0.0108 at h = 10, −0.0008 at h = 200, +0.1417 at h = 300),
so a bisection on *sign* reports crossings that are structure, not the crossing — it initially gave
"Bloodlust splits at h = 4" and "Drums at h = 4", both artifacts of that. The **law** — just above the
haste buff's own onset threshold — is exact and is what this file quotes.
⚠ That local non-monotonicity is the same unexplained ramp-edge residual as §1.2b's, one order larger
because two windows are involved. Open, small, flagged.

## 5.7 ★★★ WORKED EXAMPLE — Icy Veins + Icon, and when the pair splits

This is the whole framework answering one real question, and every step is a line above.

**Both are 20 s, so they overlap perfectly; `haste × value` is positive, so they want to be together.
The question is only WHERE.**

### Together — and after the stacks, not at the pull

Icy Veins is **ramp-neutral** below its threshold (§1.2b): it does not care. Icon does. A **value buff
is ramp-AVERSE**, and by exactly the amount §1.2 already priced — it pays per *cast*, and the ramp
yields **1.332 fewer casts** than the same seconds at steady state:

    cost of putting a value buff on the opener  =  1.332 · s

| passive SP | predicted `1.332 · s` | engine: post-ramp − pull |
|---|---|---|
| 700 | 0.1209 | **0.12088** |
| 1000 | 0.1028 | **0.10282** |
| 1387 | 0.0862 | **0.08620** |
| 2000 | 0.0686 | **0.06864** |

⇒ **The pair goes after the ramp — and the reason is Icon, not Icy Veins.**

### ⚠ …but "after the ramp" is THREE decisions, not one (user, 07-28)

`1.332 · s` is the cost of covering the **whole** ramp. The toll is paid per cast (§1.2a), so waiting is
granular — and **the first cast you wait for is worth as much as the other two together**:

| press the value buff | ramp deficit still paid | Icon (`s`=7.719 %) | Arcane Power (`s`=30 %) | recovered |
|---|---|---|---|---|
| before cast 1 | `d₀+d₁+d₂` = 1.3320 | 0.1028 casts | 0.3996 | 0 % |
| **after cast 1** (1 stack) | `d₁+d₂` = 0.6653 | 0.0514 | 0.1996 | **50.0 %** |
| **after cast 2** (2 stacks) | `d₂` = 0.2213 | 0.0171 | 0.0664 | **83.4 %** |
| after cast 3 (3 stacks) | 0 | 0 | 0 | 100 % |

★ **Waiting one cast recovers half the penalty; two recover five sixths.** So the intermission case is
not "wait 6.5 s or don't" — if a post-intermission burn can spare one cast, take it and you have banked
half the prize. Each further cast is worth ~⅓ less than the last, exactly as `d_k = (C_k − G)/G` says.

### And in the truncated case, waiting costs exactly `k · s`

Sharpening §1.2c with the per-cast form: if the buff **is** truncated by the window, waiting `k` casts
saves `Σ_{j<k} d_j · s` and costs `Σ_{j<k} C_j / G · s`, and the two differ by exactly

    cost − saving  =  k · s          casts

— one `s` per cast waited, with **no dependence on haste, on which casts, or on the buff's duration.**
So the decision is a clean per-cast ladder: **wait one more cast iff the buff still fits afterwards.**
The moment it does not, each further cast of hesitation costs a flat `s` — and for Arcane Power that is
**0.30 casts per cast waited**, the most expensive hesitation in the kit.

### At high haste Icy Veins leaves for the pull, and the pair splits

Above **394.3** (Icy Veins' own onset threshold) ramp-neutrality ends and the pull starts paying
(§1.2b). Splitting costs the overlap you give up, which is worth `haste × value ∝ s`. So:

    split when   IV's pull-gain (a pure haste quantity)   >   lost overlap × s

| passive SP | `s` (Icon per cast) | **split haste** |
|---|---|---|
| 700 | 9.075 % | **429.7** |
| 1000 | 7.719 % | **425.1** |
| 1387 | 6.472 % | **420.4** |
| 2000 | 5.153 % | **415.2** |
| 2600 | 4.296 % | **412.2** |

★ **The higher your passive spell power, the SOONER the pair splits** — monotone, and the mechanism is
§3.1: more passive SP dilutes `s`, so the overlap you are protecting is worth less, so a smaller
haste-side gain is enough to break it.

⇒ **Three regimes for this pair, and the boundaries are computable, not measured:**

| | | |
|---|---|---|
| `h < 394.3` | Icy Veins is ramp-neutral | **together, after the ramp** |
| `394.3 < h < split` | the pull pays, but not enough to buy out the overlap | **together, after the ramp** |
| `h > split` (412–430) | it does | **Icy Veins to the pull, Icon stays** |

⚠ **Honest magnitude:** the split band is narrow (~394 → ~425) and the spell-power sensitivity inside it
is modest — 17.5 rating across a 700 → 2600 SP swing. The *direction* is exact and the *size* is a
second-order effect. Do not build a gearing rule on the 17.5.

---

# 6. TRIPLES AND BEYOND — nothing new is needed

The interaction of any set `S` is Möbius inversion over its subsets:

    I(S) = Σ_{R ⊆ S} (−1)^{|S|−|R|} · V(R)

and every term is one of §4's five forms. `tools/rules-audit.mjs` checks the expansion closes to
`0.000e+0`. **There is no triple-specific law**: Icy Veins + Icon + Arcane Power is `haste×sp`,
`haste×dmg`, `dmg×sp` and one third-order term, all already given.

---

# 7. WHAT THIS MEANS FOR A PLAN

Consequences, each traceable to a line above. None is an axiom.

1. **Stack value buffs where casts are fastest** (§4 haste×value) — and expect that pull to weaken as
   your spell power grows (§3.1).
2. **Stack haste buffs only while their product stays under 1.5** (§4.1). Berserking + Bloodlust
   qualifies at low gear; Icy Veins + Bloodlust never does.
3. **Two +SP buffs neither help nor hurt each other** (§4, sp×sp = 0). Put them wherever the *haste*
   argument wants them; there is no pairing bonus to chase.
4. **Damage multipliers pair with everything** (`n·d·s`, `n·d₁·d₂`), and unlike +SP their `s` does not
   dilute with gear — so Arcane Power's alignment argument is gear-independent.
5. **Haste above `m = 1.5` buys only ramp compression** — ~70× less per point, and only once per cold
   start (§1.1). It reaches true zero at `m = 2.5`, h = 2366. Treat 788.5 as the cap for planning; know
   that the exact statement is the two-cap one.
6. **The opener is a fixed 1.332-cast toll below the cap** (§1.2), and a haste cooldown is
   **ramp-neutral** there — pressing it before cast 1 or at 0:60 is identical (§1.2b). Above the buff's
   own onset threshold that inverts, and above the steady cap the opener is the *only* place a haste
   cooldown is worth anything at all.
7. **A gap in the Arcane Blast stream has THREE outcomes, not two** (§1.2d): below `8 − ct` nothing
   happens; in the band `(8 − ct, 8)` the resuming cast is fast but the next one drops to **1 stack**,
   costing **0.6653 casts**; at or above 8 s it is a full cold start. The band's width is the cast time,
   so it shrinks with haste. Then: **a cold start adds 1.332 casts and nothing else** (§1.2d): the Arcane Blast debuff drops
   at exactly `DEBUFF_DUR`, so pay 1.332 casts and re-apply rules 1–6 on the far side. Below 8 s it is
   only downtime and nothing resets. ⛔ **It never costs a use** — cooldowns tick through downtime
   (7 of 7 presets, identical counts) — so there is no separate intermission playbook. **Count the cold
   starts; everything else is rules 1–6.** And at `T ≤ 120` every cooldown has exactly one use, so
   there is nothing to trade at all.

---

# 8. WHAT IS **NOT** IN THIS FILE, AND WHY

* **"Best placement at haste h" columns.** They are argmaxes, and the old ones were argmaxes over cells
  whose noise was the size of the effect (peak-value haste moved by up to 140 rating between scores —
  Berserking 430 → 570). Compute one when you need it, from §1–§6, and state the objective you used.
* **Mana.** The planner is infinite-mana by user decision (`docs/PLAN.md`, permanently rejected list).
* **Crit.** A constant multiplier on every cast; it cancels out of every ratio here. It changes what a
  cast is worth, never which plan is best.
* **The sim's numbers.** wowsims is a *realisation at one lattice phase*; these are expectations. A
  disagreement of order 0.2 casts is **predicted**, not a defect (`docs/TOOLING.md`). Use the sim to
  anchor the physics, never to arbitrate a sub-cast margin.

# 9. TWO CAVEATS ON THE ARITHMETIC BEHIND THIS FILE

1. **The engine's integral still carries two uncorrected edge terms** — a haste window's leading and
   trailing snapshot edges, worth `i_out/(2·i_in) − ½` and `½ − i_in/(2·i_out)` casts and nearly
   cancelling (`docs/MODEL-DEFECTS.md` §8f). They shift *levels* by up to 0.34 casts on a wide sweep.
   Every closed form above was checked against the integral **and** derived independently from §1, so
   the laws do not depend on them — but a value re-measured after those corrections may move.
2. **Two engine/formula gaps are known and are not law errors**: a self-pressed window's start snaps to
   the next cast boundary, so a pair's *overlap* can differ from its nominal duration by up to one
   interval (this is the ≤0.005-cast residual in §5.1); and at very high haste a ramp cast can reach
   the GCD floor, retiring §1.2's `m`-cancellation above h ≈ 1312 — beyond any gear.

---

# §9 — ARCANE EXPLOSION AND AoE PHASES *(derived 2026-07-30; never checked before)*

## 9.1 ★★★★ AT 3 STACKS, AN AoE PHASE CHANGES ONLY THE DAMAGE — NEVER THE RATE

Arcane Explosion is **instant** (`cast = 0`), so its interval is purely the GCD. Arcane Blast at three
stacks is `max(msq(1.498/m), gcd)` — and the cast term **can never win**:

- below `m = 1.5` the GCD is the larger of the two, because `1.5/m > 1.498/m`;
- above it both sit on the `1.0 s` floor.

```
   m      AB interval   AE interval
 1.000      1.5000        1.5000
 1.200      1.2500        1.2500
 1.430      1.0490        1.0490
 1.560      1.0000        1.0000
 2.000      1.0000        1.0000        identical at every m
```

⇒ **Haste is worth exactly the same inside an AoE phase as outside it**, and the entire value of the
phase is the damage multiple. That kills a whole class of reasoning before it starts: there is no
"AoE is more GCD-bound" effect to model, and no reason to prefer a haste cooldown in or out of an AoE
window *on rate grounds*. Gate: `law-check` → *AoE: AB and AE intervals identical*.

## 9.2 ★★★ CRIT DOES **NOT** CANCEL ONCE AN AoE PHASE EXISTS — and the project claimed it did

`crit is a constant factor and cancels` (CLAUDE.md, MECHANICS §4) is true **single target**: it
multiplies every Arcane Blast equally and divides out of the normalisation against a plain cast. An
Arcane Explosion carries an **extra** crit-dependent term — `aoeCritAmp`, the Clearcasting → Arcane
Potency amplification — which rises with the target count and **falls as base crit rises**, because
Potency has less headroom to add when you are already critting often.

```
 crit %   amp N=1   amp N=4   amp N=6   amp N=10   AE/AB at N=6
    0     1.00000   1.05838   1.08823   1.13197      2.6290
   38     1.00000   1.04480   1.06770   1.10127      2.5794
   60     1.00000   1.03948   1.05966   1.08925      2.5600
```

⇒ **More crit makes an AoE phase relatively LESS valuable** — a 2.6 % swing in the AE/AB ratio across
0–60 %. The direction is counter-intuitive and worth holding onto.

⚠ **Score-invariance and plan-invariance are different claims, and only one of them fails.** The SCORE
depends on crit whenever an AoE phase exists. On the cases tested the emitted PLAN did not change at
10 / 38 / 60 % crit, with or without an AoE phase. So *"crit cancels"* is safe as a statement about
which layout wins, and wrong as a statement about the number. ⛔ It matters for **EP**: crit has a
nonzero stat weight on an AoE fight beyond the plain crit multiplier, and `docs/EP.md` does not price
that.

---

## 9.3 ★★★ THE TIRISFAL 2-PIECE MOVES THE AoE THRESHOLDS — and Arcane Power partly repays it

*(User-flagged 07-30: "it also interacts with the Tirisfal regalia bonus where it's not as worth if
that one is active." Verified — and the second half below was not on anyone's list.)*

Tirisfal Regalia (T5) 2pc is **+20% Arcane Blast damage, AB only — an Arcane Explosion gets nothing**
(`docs/SOURCES.md`, wowsims `mage/items.go` set 649, `ClassMask MageSpellArcaneBlast`). Effective ABs
are normalised against a **plain Arcane Blast**, so turning the set on grows the DENOMINATOR by ×1.2
while leaving every AE numerator untouched:

```
 AE/AB ratio, N = 6, 1387 SP, 38 % crit
   Tirisfal OFF, no AP      2.5794          Tirisfal OFF, under AP   2.5794
   Tirisfal ON,  no AP      2.1495          Tirisfal ON,  under AP   2.2355
```

⇒ **An AoE phase is worth exactly `1/1.2` as much with the set on** — −16.67 %, and it is exactly
1/1.2 because nothing else in the ratio moves. Every break-even target count in RULES §9 scales the
same way: `M_eff = M/1.2`.

### ★ …EXCEPT INSIDE AN ARCANE POWER WINDOW, WHERE THE PENALTY IS ONLY −13.33 %

Arcane Power and the 2-piece land in **one additive percent-damage pool** on an Arcane Blast
(`dmgMult + t5add`, SOURCES "Arcane Power × Tirisfal-2pc stacking" — wowsims `core/spell_mod.go`), so
with the set on AP raises an AB by only `1.5/1.2 = ×1.25`. On an Arcane Explosion there is no
`t5add` to pool with, so AP is the full **×1.30**. The 4 % difference works in AoE's favour:

```
  AP is worth on an AB    on an AE     ⇒ AE/AB inside AP
    Tirisfal OFF   ×1.3000   ×1.3000       unchanged  (ratio 1.0000)
    Tirisfal ON    ×1.2500   ×1.3000       +4.00 %    ⇒ penalty −16.67 % → −13.33 %
```

⇒ **With the set on, Arcane Power is a relatively BETTER thing to have up during an AoE phase than
during single-target burn** — the opposite of the plain reading, and it comes entirely from the
additive pool. ⚠ This is one of the few places the additive-vs-multiplicative ruling changes a
*decision* rather than a number, so if that ruling is ever revisited (SOURCES marks it *"verified in
wowsims; RESOLVED as ADDITIVE"* under the user's trust-wowsims rule), this is the line that moves.

⚠ **Talent ranks are an INPUT to all of this**: `TALENTS = {arcaneConcentration: 5, arcanePotency: 3}`.
Potency at 3 ranks (+30 %) is the Anniversary tree; the original 2.4.3 tree caps it at 2 ranks
(+20 %), which would cut the §9.2 amplification by **1.4 % at N=4, 2.1 % at N=6, 3.1 % at N=10**.
SOURCES marks 3/3 verified against wowsims and sim measurement, so it stands — but it is a
**server-version assumption**, not a law, and it is the one input in this file that a different
realm could invalidate.

---

# §10 — STAT VOLATILITY: THE DERIVATIVES *(generated by `tools/facts-volatility.mjs`, 07-30)*

Everything above records what a buff is worth **at a point** — h = 0, 1000 or 1387 SP; every declared
test in `tests/anchors.mjs` is at h = 0 too. That is correct as ground truth and useless as
preparation. What follows is how fast each thing **moves**, which is what the passive-gear-haste work
needs. Regenerate with `node tools/facts-volatility.mjs --md`; nothing here is measured off a plan, so
none of it can drift with the search.

**A haste buff decays as gear haste rises, and dies at the cap.** Value of the buff's own
window, in casts per second of uptime:

| gear haste | m | Icy Veins ×1.20 | Berserking ×1.10 | Bloodlust ×1.30 | Skull +175 | MQG +330 |
|---|---|---|---|---|---|---|
|    0 | 1.000 | 0.13333 | 0.06647 | 0.19988 | 0.07407 | 0.13978 |
|  100 | 1.063 | 0.14235 | 0.07131 | 0.21294 | 0.07868 | 0.14892 |
|  200 | 1.127 | 0.15040 | 0.07513 | 0.22525 | 0.08341 | 0.15695 |
|  300 | 1.190 | 0.15873 | 0.07895 | 0.20635 | 0.08818 | 0.16604 |
|  400 | 1.254 | 0.16458 | 0.08370 | 0.16458 | 0.09308 | 0.16458 |
|  500 | 1.317 | 0.12204 | 0.08822 | 0.12204 | 0.09765 | 0.12204 |
|  600 | 1.380 | 0.08004 | 0.08004 | 0.08004 | 0.08004 | 0.08004 |
|  789 | 1.500 | 0.00000 | 0.00000 | 0.00000 | 0.00000 | 0.00000 |

★ The **788.5** figure in §1.1 is where `rate` reaches the floor unbuffed; past it a haste buff is
worth exactly **0**, not "less". Every column goes to zero together, because they all cap at the same
`m = 1.5` — the cap is a property of the GCD, not of the buff.
★★ **AND THEY CONVERGE LONG BEFORE THEY DIE.** At 600 gear haste every column reads **0.08004** —
Berserking ×1.10 and MQG +330 are worth the SAME. Once a buff carries you past the floor, its value
is no longer its own size but the remaining distance to the cap, which every buff shares. ⇒ at high
gear haste, *which* haste cooldown you press stops mattering; only *when* does.
★★★ Bloodlust PEAKS at ~200 gear haste (0.22525) and falls after — the biggest multiplier is the
first to overshoot.


**Pair cross terms: stack or split?** Gain from overlapping the two windows rather than holding
them apart, per second of overlap. Negative means SPLIT.

| gear haste | IV ×1.20 · Zerk ×1.10 | IV ×1.20 · Skull +175 | IV ×1.20 · MQG +330 | Skull +175 · MQG +330 | Lust ×1.30 · Zerk ×1.10 |
|---|---|---|---|---|---|
|    0 | +0.01381 | +0.01481 | +0.02733 | -0.00024 | +0.02027 |
|  100 | +0.01308 | +0.01543 | +0.00002 | +0.00001 | +0.00703 |
|  200 | +0.01522 | +0.01488 | -0.05866 | +0.00039 | -0.05169 |
|  300 | -0.03133 | -0.04056 | -0.11842 | -0.04788 | -0.07895 |
|  400 | -0.08370 | -0.09308 | -0.16458 | -0.09308 | -0.08370 |
|  500 | -0.08822 | -0.09765 | -0.12204 | -0.09765 | -0.08822 |

★ **`rating × rating` is zero BELOW the cap** — two ratings land in ONE bracket `(1 + h₁ + h₂)`, so
the cross term `(A−1)(B−1)` that makes stacking pay does not exist (RULES §7a). The ±0.0004 wobble in
those rows is millisecond quantisation, not signal. ⚠ It is **not** zero above the cap: from ~300 gear
haste it joins the others at strongly negative, because stacking two buffs that each already reach the
floor wastes one of them outright.
★★ **Every pair inverts, and they invert at DIFFERENT gear levels** — MQG-paired ones flip first
(between 0 and 100 rating), the ×1.20/×1.10 pairs hold out to ~200. The bigger the two buffs, the
sooner stacking them stops paying.


**A +SP buff is diluted by your own passive spell power.** Value fraction
`s = COEF·ΔSP / (BASE + COEF·SP)` — what one cast under the buff is worth above a plain cast:

| passive SP | Icon +155 | gem +225 | both | AP ×1.30 (for scale) |
|---|---|---|---|---|
|  800 | 0.08573 | 0.12445 | 0.21018 | 0.30000 |
| 1000 | 0.07719 | 0.11205 | 0.18924 | 0.30000 |
| 1200 | 0.07020 | 0.10190 | 0.17210 | 0.30000 |
| 1387 | 0.06472 | 0.09395 | 0.15866 | 0.30000 |
| 1600 | 0.05943 | 0.08627 | 0.14571 | 0.30000 |
| 1800 | 0.05520 | 0.08013 | 0.13533 | 0.30000 |
| 2000 | 0.05153 | 0.07480 | 0.12633 | 0.30000 |

★ Icon loses **~40 %** of its value between 800 and 2000 passive SP while Arcane Power loses
nothing — a damage MULTIPLIER cannot be diluted. That is the whole reason AP outranks the trinkets
as gear improves, and it is a fact about your gear, not about the fight.


**Crit cancels — EXCEPT in an AoE phase.** Single target it multiplies every Arcane Blast
equally and divides out of the normalisation. An Arcane Explosion carries the extra
Clearcasting → Arcane Potency amplification, which is crit-dependent:

| crit % | amp N=1 | amp N=4 | amp N=6 | amp N=10 | AE/AB at N=6 |
|---|---|---|---|---|---|
|   0 | 1.00000 | 1.05838 | 1.08823 | 1.13197 | 2.6290 |
|  20 | 1.00000 | 1.05035 | 1.07608 | 1.11381 | 2.5997 |
|  38 | 1.00000 | 1.04480 | 1.06770 | 1.10127 | 2.5794 |
|  50 | 1.00000 | 1.04173 | 1.06306 | 1.09434 | 2.5683 |
|  60 | 1.00000 | 1.03948 | 1.05966 | 1.08925 | 2.5600 |

★ More crit makes an AoE phase **relatively less** valuable (2.6290 → 2.5600 across 0–60 % at
N = 6, a 2.6 % swing), because Arcane Potency has less headroom to add when base crit is already
high. ⚠ The score therefore depends on crit whenever an AoE phase exists — but on the cases tested
the emitted PLAN did not change, so "crit cancels" is safe as a plan-invariance claim and wrong as a
score-invariance one.

---

---

# §11 — THE NORMALIZATION ITSELF: what "effective ABs cast" IS *(verified + gated 07-30)*

*(User question: "verify the effective ABs cast is getting calculated correctly.")*

The engine computes exactly the framing the project states — `rateAt` is literally
`dmg(t) / interval(t)`, *"the damage a spell would deal right now, divided by the time it would take
to cast right now"* — integrated over the fight and divided by one plain Arcane Blast. The premise
that makes it work is cited, not assumed: **Arcane Blast damage is stack-independent** in 2.4.3 (only
cost and cast time scale per stack — SOURCES, wowsims `arcane_blast.go` + `arcane_charge.go`), so the
stack count moves the **denominator only**. That is why it is the one quantity modelled dynamically.

**The empty fight has a closed form with no free parameters**, and it is now a `law-check` line:

```
  effective ABs (no buffs) = T · rate(m) − toll        toll = Σ_k (C_k − G)/G  at m = 1  = 1.332
```

| check | reads |
|---|---|
| a plain cast is worth exactly 1 | 1.00000 |
| empty 120 s / 300 s fight, h = 0 | 78.66800 / 198.66800 |
| empty 300 s at h = 200 / 400 / 600 | 224.06244 / 249.29457 / 274.65696 |

★ **THE TOLL IS THE SAME 1.332 AT EVERY HASTE, AND THAT IS THE ASSERTION THAT MATTERS.** Recomputing
it at *hasted* cast times is the obvious derivation — it is what I reached for first — and it is
precisely what §8q rejects: a haste-shrinking toll makes compression pay and sends Icy Veins back to
the pull. Nothing gated that until now. The three haste lines also fail under `law-check --self-test`
(9 lines catch the seeded break, up from 6), so they are not decoration.
It is invariant to SP and crit as well, to float precision — both divide out of the normalisation,
which is the property that makes effective-casts the right currency *within* a setup and the wrong one
*across* setups (CLAUDE.md).

---

## §11.1 EXPECTED DAMAGE AND DPS — the readout, and what it is honestly for *(added 07-31)*

`simulate().integral` **is absolute expected damage already** — dividing it by `plainCastOf(cfg)` is
the only thing that turns it into effective casts. So the readout needed no new physics, just the
multiplication back:

```
  expected damage = effective casts × plainCastOf(cfg)          e.g. 198.668 × 2242.1 = 445,443
  expected DPS    = expected damage / T
```

**It exists because effective casts CANNOT compare two gear setups**, and the user stated the gap
exactly: *"if I omegamax passive haste I will essentially cast 200 arcane blasts, but if it's better to
cast 150 with bigger spellpower equipped I can't ever know."* Effective casts is normalised to each
setup's own Arcane Blast — it divides flat SP and crit out **on purpose**, which is what isolates
scheduling within a setup and blinds it across setups (CLAUDE.md payoff 2). Multiplying back restores
the comparison. ⇒ **consistency between setups is the entire claim; matching a damage meter is not.**

### ⚠ THE ABSOLUTE LEVEL IS ~4.9 % LOW, DELIBERATELY, AND IT COSTS THE COMPARISON NOTHING

Going absolute un-cancels constant per-cast factors the ratio was free to ignore. Two are real and
were **measured, built, and then reverted** on 07-31 by user direction (*"I don't want the tool to
change or consider it in any ways whatsoever"*):

| omitted factor | size at 38 % crit | why it was absent |
|---|---|---|
| Arcane Instability 3/3, +3 % spell damage | ×1.03000 | never modelled — a constant, so it cancels |
| single-target Clearcasting → Arcane Potency | ×1.01871 | `aoeCritAmp` normalises to N = 1, dividing it out |
| **combined** | **×1.04927** | |

A constant multiplier applied to every setup **cancels out of every comparison between setups**, which
is the only thing this number is for — so adding it would change no decision. It would also import
`arcaneInstability` as a constant with **no `docs/SOURCES.md` row**, since the instrument that could
have confirmed it is retired. ⇒ left out, recorded here, and one edit away if the number is ever wanted
to match a log instead of another setup.

⚠ Three further assumptions bite only once the number is absolute, and are NOT corrections that could
be applied: **infinite mana** (a long fight would really go OOM), **hit hardset at cap**, and **Arcane
Blast only** — no filler, no free Arcane Missiles off a Clearcasting proc. And `GAME.CRIT_MULT = 1.8175`
bakes in a Chaotic Skyfire Diamond meta gem, an assumption that was free while it cancelled.

### ✅ AND ONE DIVERGENCE THIS EXPOSED — RESOLVED THE SAME DAY, BY USER DIRECTIVE

Every headline number on the page read `r.total`, the **per-cast board sum**, while the tool RANKS on
the integral (§8h). They differ by **~0.31 casts (0.14 % at T=300, 0.32 % at T=120)**, so the page was
quoting a gain, a margin and a cast count the optimizer is **not the argmax of** — and the tooltip
claimed outright to be *"the single number the planner maximizes"*, which stopped being true on 07-30.
⇒ User directive: *"then the effective casts should also read the integral."* All of them now do —
`gain`, `vsNaive`, `effCasts`, the custom-vs-model delta, and the Debug export's `vsModelPct`.

⚠ **AND THE FIX FOUND A SECOND COPY.** `renderTiles` and the custom-timeline panel kept **two hand-kept
copies** of the same four formulas; switching only the visible one would have left the custom panel
reading `total` and silently disagreeing with the tiles beside it. Both now call `tileStats`, the one
definition. That is the third re-typed-formula bug this repo has paid for in two days (the other two:
the plain-cast normalizer, four copies, and `anchors`' re-typed `one`). **Formula duplication is this
codebase's most reliable defect generator** — when a quantity is redefined, every copy is a site that
silently keeps the old meaning.

Measured effect on the page (Morogrim 2:45), plans **byte-identical** (`PLAN-DIFF IDENTICAL` 15/15,
anchors 8/8, law-check green — nothing here feeds the search):

```
                          before (total)   after (integral)
  gain vs no cooldowns        +22.3 %          +22.4 %
  vs mashing on cooldown       +1.7 %           +1.4 %     ← the largest move, as expected:
  effective casts             132.9            133.0          it is a ratio of two DIFFERENT plans
  expected damage             297.9k           298.2k
  expected DPS                1,805            1,807
```
