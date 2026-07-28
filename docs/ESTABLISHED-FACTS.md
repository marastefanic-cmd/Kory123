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

The **haste multiplier** of a state is

    m  =  m_p · Π vᵢ · (1 + Σ rⱼ / RTG)          m_p = 1 + h / RTG

multiplicative buffs `vᵢ` (Bloodlust ×1.3, Icy Veins ×1.2, Berserking ×1.1, Power Infusion ×1.2),
rating buffs `rⱼ` (Mind Quickening Gem +330, Skull of Gul'dan +175) folded into one additive pool with
passive rating. **Rating adds, multipliers multiply.** That asymmetry is the source of half the rules
below.

---

# 1. THE MASTER LAW — cast rate

    rate(m)  =  min( 1/F , m/G )  =  min( 1 , m/1.5 )        casts per second

That is the whole steady-state model. `C₃ < G` always, so Arcane Blast is **GCD-bound at every haste**
and the cast time never enters the rate — only the GCD does. Everything else in this file is arithmetic
on this one expression.

*Verified: engine integral matches at h = 0, 200, 400, 600, 788.5, 900 (exact, once the opener term in
§1.2 is accounted for).*

## 1.1 The cap

`rate` stops rising when `m = G/F = 1.5`.

    bare GCD cap:  m_p = 1.5  ⇒  h = 788.5 rating

Above it, **every further haste point is worth exactly zero** — not "less", zero. This is a hard corner,
not a taper.

## 1.2 The opener costs exactly **1.332 casts**, at every haste

The first three Arcane Blasts of any cold start run at 0, 1 and 2 debuff stacks:
`C_k = 2.5 − k × 0.334` = 2.500 / 2.166 / 1.832 s. Their intervals are `max(C_k/m, max(F, G/m))`.

    opener deficit  =  ( Σₖ C_k − 3G ) / G  =  (6.498 − 4.5) / 1.5  =  1.332 casts

★ **`m` cancels.** While every ramp cast is longer than the GCD — true up to `m = 1.832`, i.e. h ≈ 1312,
far beyond any gear — the opener costs the same 1.332 casts no matter how much haste you have.
*Verified: the engine's integral sits a constant 0.00444 casts/s under the steady-state law at h = 0,
200, 400 and 600, which over T = 300 s is 1.332 casts — the same number at every haste.*

⇒ **Haste cannot compress the opener.** A haste cooldown pressed at the pull buys nothing from the ramp;
it buys only what it covers *after* the ramp. This is why the model opens cold and why a prepull
silently corrupts a haste comparison (RULES §3, TOOLING ★★★).

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

⇒ **The opportunity cost of overcapping is total.** There is no partial credit above the corner. This
is the single most important fact for gearing and for cooldown placement alike.

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

## 5.2 Icy Veins × Bloodlust — **exactly 0.000 at h = 0**, negative everywhere above

`v₁ v₂ = 1.56 > 1.5`: the pair is overcapped *before you have any gear at all*, so the capped branch
applies from h = 0 — and `v₁ + v₂ − 1 = 1.5` puts h = 0 **precisely on the sign-flip threshold**:

    I(h=0) = 20 · [ 1 − 1 · 1.5 / 1.5 ] = 0 exactly

| passive haste | interaction |
|---|---|
| **0** | **0.000 — a genuine, exact tie** |
| 50 | −0.634 |
| 100 | −1.268 |

⇒ **At h = 0 it is exactly irrelevant whether Icy Veins overlaps Bloodlust.** The multiplicative bonus
and the GCD overcap cancel to the digit. At any gear haste at all, **separate them** — and the cost of
not doing so grows fast (−1.27 casts by h = 100).

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
5. **Never buy haste above `m = 1.5`.** Not "diminishing" — zero (§1.1, §1.3).
6. **The opener is a fixed 1.332-cast toll no cooldown can reduce** (§1.2).

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
