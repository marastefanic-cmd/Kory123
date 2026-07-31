# RULES.md — the theorycraft the planner encodes

> ## ⚠ BASELINE NOTICE — every sim MAGNITUDE below is **gear-A** denominated
>
> Read this doc on two levels, because the 2026-07-26 gear A → gear B re-export
> (`docs/BENCH.md` §1) hits exactly one of them.
>
> - **The MECHANISM of every rule survives, unconditionally.** The GCD floor, the discrete ramp,
>   buff-into-Lust packing, SP-on-fast-casts, the AoE modifier — these are statements about TBC's
>   physics and about the scoring law in §1. Gear does not change them, and none of them is on trial.
> - **Every sim FIGURE attached to a rule is a gear-A measurement** (`+0.39%`, `+61 DPS var0`,
>   `−0.66%`, `0.0439 pp`, the §12 crossover brackets, the §-ACCEPTANCE floor statistics …). They were
>   all gathered before 07-26, on the archived character
>   (`tools/xval-results-archive/gearA-pre-20260726/`), most of them with `--var 0`/`var10` on the
>   native rig rather than today's measured `--var 0.5` + never-press control. **BENCH §1's rule is
>   absolute: do not compare a gear-B number to one of these.** They are not wrong; they are about a
>   character that is no longer the reference.
>
> **What this does and does not license.** A rule stays in force — it is the theorycraft the planner
> encodes, and re-measuring 40-odd deltas is not a prerequisite for believing the GCD floor. What is
> *not* licensed is quoting one of these figures as a current target, a current tolerance, or the
> other side of a gear-B comparison. When a rule's magnitude actually matters to a decision,
> **re-measure it** — `node tools/bench.mjs --preset X --vs naive` is ~10 s from the repo alone — and
> record the gear-B figure beside the gear-A one rather than overwriting it.
>
> Crossover *thresholds* (§12's `~264`, `~139`, `~77`) deserve their own caution: they are functions of
> the character's haste and SP, so they are the figures **most** likely to have moved, and the ones a
> future phase should re-derive first. The §-ACCEPTANCE resolution-floor statistics are superseded
> wholesale by the gear-B round (`docs/ACCEPTANCE.md`).

Living record of the TBC Arcane cooldown rules, each with the **evidence** it was checked against. The
one quantity to maximize is **effective ABs cast** (§1 / `MECHANICS §4`) — a **deterministic per-cast
sum** the planner has everything it needs to compute exactly.

> ## ✅ AND SINCE 07-27 EVENING HEAD **DOES** COMPUTE IT EXACTLY (`docs/archive/13-phase12-exact-objective.md` §6.10 + §9)
> `simulate()` accumulates the per-cast sum and returns it as `total`/`totalEarly`/`robust` — now one
> and the same number. Each cast is credited `dmg × min(1, (nextCut − start)/duration)`: the
> **boundary credit** (§8), one rule at every **cut**: the fight end, an intermission start (the cast
> **cannot land**) and an **AoE phase start** (the cast lands, but you would **cancel** it for Arcane
> Explosion — a policy cut, §9). ⛔ **A burn edge is not a cut** — you would not cancel there; it is a
> *value* boundary. Standing gate, no sim: `node tools/self-consistency.mjs` reads `0.00e+0` over 3000
> scorings.
>
> ⛔ **This banner used to say the opposite, and the warning it carried still applies to the EVIDENCE
> below.** Until 07-27 `simulate()` computed the sum in its walk and then **ranked on a continuous rate
> integral instead**, differing by a **median 0.2114 % of score** (max 1.4263 %). ⇒ **any rule below
> resting on a model margin under ~0.5 % was decided by a number that was not single-valued, and the
> boundary-credit landing then moved plans on top of that** (`plan-sweep` 11/16 cases,
> `tools/blast-radius.mjs` 102/285 cells = 35.8 %). The rules' *mechanisms* stand; their thin model
> margins are due a re-check, and none has had one yet.

The **sim's primary job is to FALSIFY THE SEARCH**: with an exact objective, ranking two plans is
arithmetic and cannot be wrong, so a sim preferring a plan the tool did not emit means **the search
missed it** — and each such disagreement is a *pattern to generalize into a rule*, which is how this
file grows. Secondarily the sim **anchors the physics** (~0.4 % absolute agreement), **covers genuine
blind spots** (mana, AoE weighting) and **builds user trust** via the in-page benchmark. The sim
evidence cited under each rule is that calibration, not a routine per-line referee. When a clean
cast-count and a sim number disagree with **no blind spot in play**, audit the sim *setup* before
either — the press-fire offset of PHASE12 §6.7 is the newest cautionary tale. Update this file when a
rule is added, refined, or overturned.

**Read every rule below as a *method*, not a law.** There is exactly one thing to maximize — the
**effective ABs cast** (`docs/MECHANICS.md §4`: each cast scored by its multiplier vs a plain AB,
summed over the fight). "Pack into Lust", "sequence haste", "put SP on fast casts", "don't open a
window in downtime" are all heuristics that *usually* maximize that number; each has cases where the
count (or the sim) says break it. Prefer the general statement; treat "always/never" as shorthand for
"almost always/never, confirm with the sim", not an invariant. Getting this framing right is what keeps
the planner **generalisable** to future gear/haste/trinkets rather than tuned to today's fights.

## 1. The scoring law: effective ABs cast

`effectiveABs = Σ_casts [castDamage_i / plainAB] × credit_i`, over the casts the plan actually makes.
⛔ **This line used to read `= ∫ [castDamage(t)/plainAB] / interval(t) dt`** — the rate integral. That
form is kept in MECHANICS §4 **for the derivation**, but it is retired as the *evaluation*: it is the
continuum limit (the expectation over a uniformly random cast phase) while a given plan's phase is
determined, and the two differ by a **median 0.2114 % of score** against ranking margins of ~0.005–0.07 %
(PHASE12 §6.10). Ranking is a **sum over casts**, and `simulate()` has computed exactly that since 07-27.

`credit_i = min(1, (nextCut − start_i)/duration_i)` is the **boundary credit** (PHASE12 §9, user ruling
07-27): full value for a cast the plan keeps, the fitting fraction for one that straddles a **cut** —
the fight end, an intermission start (**cannot land**) or an **AoE phase start** (lands, but you
**cancel** it to spam Arcane Explosion). ⛔ A **burn** edge is **not** a cut: the cast lands and you
would not cancel it. Three boundaries, two cuts, two different reasons — §9. See §8 for what it replaced.

A cast's *damage* is (for Arcane Blast)
independent of AB stacks — only cast **time** and mana scale with stacks. Haste enters only through
`interval` (how many casts fit); a damage/spellpower buff raises what each cast is worth. A damage/SP
buff earns its multiplier against the base-damage **flux** flowing through its window, and flux is
higher where casts are faster — so a spellpower buff is worth more overlapping a haste window,
automatically. This single quantity is behind every rule below; they are its consequences, not axioms.

## 2. The GCD floor — "only the below-cap haste is efficient"

3-stack AB: base cast 1.5s; `interval = max(1.5 / hasteMult, 1.0s)`. The 1.0s GCD floor is reached at
**+50% total haste**. Haste past the floor is **wasted** (interval pinned at 1.0). Multiplicative
stacking: `(1+ratingHaste) × 1.30 Lust × 1.20 IcyVeins × 1.10 Berserking …`.
- Lust alone = +30% (1.15s, unfloored). Lust+IV = +56% (floored → 1.0s, ~3.8% of IV wasted).
  Lust+Berserking = +43% (1.05s, unfloored, fully efficient).
- **★ The floor's location is CERTIFIED against the sim** (PHASE8 §14.6, 07-25) — not merely read off
  `core/constants.go:13` (`GCDMin = 1s`). Three two-buff sets cross `m = 1.5` at three *different* gear
  ratings — IV+MQG at **R=64.25**, IV+Zerk at **215.05**, MQG+Zerk at **243.45** (from
  `R* = 1577·(1.5/mult − 1) − rating_add`) — and each was bracketed to a single rating point. In all three
  the sim's marginal slope turns over inside the **same** point the model's does, while the three singles
  (which never cross anywhere on the grid) kink nowhere. The cast and the GCD clamp *together* because a
  3-stack AB is `2.5 − 3×⅓ = 1.5 s` = `GCD_BASE` exactly, which is why one crossing governs both.
- **★★ A haste buff pinned AT the floor buys the same casts as one that isn't — measured directly, in
  whole casts** (PHASE8 §18.6, 07-25). Same fight (`T=300`, gear haste 70), one 20 s `MQG` window moved
  between a **solo** parking spot and a **stacked** one on `IV@202`. The stacked window runs at *exactly*
  **1.000 s per cast for twenty seconds** (unfloored `IV × MQG × gear = 1.5157` ⇒ `1.5/1.5157 = 0.9896 s`,
  so **~1.05 % of the stacked haste is clipped**); the solo window runs at **1.195 s**, nothing clipped.
  The sim's census is symmetric to the cast: **solo `MQG` +3 casts, stacked `MQG` +3 casts, fight total
  230 = 230**, and `AP`'s 15 s value window covers **15 cast starts in both arms** — §RULES-4's floor law
  holding even when **Δ itself** is manipulated. This is the strongest form yet of "haste stacked on an
  already-floored window is worth ~0" (§16). ⚠ **The scorer does not fully honour it**: `simulate()` clamps
  the interval correctly (`index.html:819-822`, `:903-904`) but still books **+1 net cast** for the stacked
  press. Open, unpatched, tracked in PHASE8 §18.6 — no scorer change lands mid-acceptance-round.

## 3. Ramp is irrelevant for haste, relevant for damage/spellpower

A pure-haste buff is ~position-independent: it "banks" the extra fractional casts to the end, so
moving Berserking around a steady window gives the same total (proved: Berserking@0 = @50 = @100 in
isolation). A **damage/SP** buff is NOT position-independent — it wants **post-ramp, max-stack, fast
casts**, so it should sit on the fastest part of the window.
- **The ramp is now modeled EXACTLY** (landed this project; an earlier per-cast ramp model was dropped for
  over-crediting — the difference is this one never touches the interval/count valuation). The mage opens
  **cold (0 stacks, no prestack** — a start-intermission expresses a delayed opener**)** and re-ramps after
  every AB gap ≥ 8s. **★ Because the model opens cold, EVERY sim compared to it must open cold too — never
  prepull (`genapl _prestack:0`). A prepull's fixed −2.3s time is haste-blind and makes a sim haste sweep
  non-monotone (TOOLING ★★★, PHASE6 §4.7).** The first 3 casts run at their true lengths and are scored **discretely** — each cast's
  damage lands around its **completion**; since PHASE12 §6.10 EVERY cast is scored that way, ramp or
  steady, by the per-cast sum. (The ±½ GCD jitter smoothing and "the integral covers everything else"
  describe the RETIRED integral, which now feeds only the `integral` diagnostic.) Haste placement-independence is preserved *exactly* (verified
  0.0000% pre-vs-post-Lust, h0–200): haste shortens the ramp but never changes its cast count.
- **Press-snap during ramps (sim-log-verified).** A press landing mid-ramp-cast fires at that cast's real
  END — the "/cast Buff /cast AB" macro can only land on a boundary, and during a ramp the boundaries are
  SPARSE and locked to the ramp start (no phase freedom): intent 0:05 in a cold opener fires at **6.5**.
  At steady state boundaries are dense and phase-uniform, so the phase-averaged effective start is the
  press moment (unchanged). Consequence, sim-confirmed **+2.4–2.8%**: with Lust at 0:07, pressing the
  burst at **0:05** (fires 6.5) beats pressing at 0:07 (fires 8.0) — the planner now emits the earlier
  press on its own.
  - **The plan displays FIRE times (user-directed).** Every intent second inside one ramp cast fires at
    the same boundary, so the whole band is score-identical — and printing the intent (`slideEarliest`
    canonicalizes to the band's *earliest* member) read as ramp-blind ("0:04 press Icon/AP/gem" for a
    burst firing at 5.4s). The activation schedule and copy-text now print, sort, and group by
    the **effective fire time floored to the second** ("activated 0:05", co-rowed with a 0:05 Lust
    call): pressing at the printed second is exact, since any press inside the band fires at the same
    boundary. Intents stay internal (cooldown math).
- **Damage buffs step off the ramp (sim-confirmed on the fixed rig).** A damage window covering slow ramp
  casts hits fewer completions, so: at an intermission exit, haste at the exit + damage delayed past the
  re-ramp = **+0.39%**; at a bare (no-Lust) pull, the cluster delayed past the IV-compressed ramp =
  **+0.10–0.17%**; and a SPLIT is optimal when window lengths differ — 20s Icon covers the whole ramp
  from 0:00 while 15s gem/AP + Berserking step to the ramp's last boundary (**+0.44%**, the Vashj-class
  opener). Haste buffs stay put (position-independent). All of this now emerges from the score — no rule
  is hardcoded.
  - **IV@0 on an early-Lust pull is ramp COMPRESSION, not waste (user-challenged, engine head-to-head,
    2:45 h0 Lust@0:05).** The intuition "IV at the pull gains nothing (position-independence) and costs
    Icon's IV-overlap tail" prices only two of the three currencies. IV@0 runs the ramp casts ×1.2 →
    the cluster's snap boundary arrives at **5.42 instead of 6.5** — ~1.1s of extra steady-state fight
    time, all of it under the full burst; and at h0 IV-inside-Lust is nearly free (Lust×IV 1.56 vs cap
    1.5 — the in-Lust marginal cast gain ≈ the solo gain, which is WHY IV-in-Lust wins at h0, §5/§7).
    Numbers: tool plan (IV@0) **133.106** eff ABs · IV riding the cluster instead (full Icon×IV overlap,
    natural ramp) **132.950** (−0.16 — the Icon-tail gain is real but smaller than the compression) ·
    IV fully out of Lust at 0:45 **131.894** (−1.2) · terminal window kill-anchored instead of on its
    cd-tick **133.083** (−0.02, a genuine tie the kill-variance taper breaks toward the EARLY, banked
    press — §8).
- **Why haste is position-independent (the exact statement).** A haste buff `×h` for duration `D` saves
  `D·(h−1)` of base cast-time **wherever it sits** — whatever casts fall in the window, their total base
  cast-time is exactly what fills `D` at the hastened rate, so the ramp's slower casts don't change the
  bookkeeping. It converts to the same extra casts anywhere **below the GCD floor**. Confirmed three ways:
  the ramp-aware toy counter, and the **real sim** — IV@pull vs IV@mid = **equal** at h0/h400, and
  **IV pre-Lust ≡ IV post-Lust to 0.00%** once both are interior (100s/140s fights, `tools/explore.mjs`
  cross-check). Above the floor the pull gains only via floor headroom (its ramp casts sit further from
  the cap).
- **★ RAMP COVERAGE IS FLOOR-SLACK RECOVERY, AND THE MODEL PAYS IT CORRECTLY — the old "model gap"
  reading is WITHDRAWN.** The bullet above ("haste is position-independent") is exact **only** floor-free;
  the model's credit for a haste window covering the opening ramp is *exactly* the floor slack it recovers,
  which is the whole of the physics. Two regimes, `tools/ramp-marginal.mjs` (pre-registered decision rule
  in its header; `T=100`, AT ∈ {0,5,10,20,30,40}, AT=20 as the interior baseline):
  - **Floor-free (no Lust) ⇒ EXACTLY 0.0000 pp, all 6 legs** (IV/MQG/Zerk × R∈{40,70}), with
    *bit-identical* `robust` values (e.g. `156409.113097` six times for IV@R=40). **This is right**, by
    algebra: coverage `= 3 + (Dh + T − Rb − D)/c` and interior `= 3 + (Dh − Rb + T − D)/c` are the same
    expression (both 68.000 casts at `T=100`). Whatever casts fall in the window, their total *base*
    cast-time is exactly what fills `D` at the hastened rate.
  - **Floor binding (Lust@0) ⇒ the model PAYS**: **+0.3298** (IV R=40) · **+0.3455** (MQG R=40) ·
    **+0.4063** (IV R=70) · **+0.4077** (MQG R=70) pp, monotone in the wasted slack (0.062 → 0.086 s/cast).
  - **The within-regime control that nails the mechanism:** **Berserking under the same Lust reads exactly
    0.0000** at both hastes — its steady cast is 1.023 s (R=40) / 1.004 s (R=70), i.e. the floor does *not*
    bind. Same Lust, same ramp, weaker haste buff ⇒ zero. Nothing but floor slack is in play.
  - **Independent cross-check:** a from-scratch hand derivation predicted **+0.27 casts** for IV+Lust@R=40
    (m=1.599: coverage 89.99 vs interior 89.72); +0.3298 pp on ~89.7 casts = **+0.296 casts**. Agrees.
  ⇒ **`index.html:919-931`'s design-intent comment is correct as written** (it describes the floor-free
  case, and the board loop at `:797-822` applies window haste to the ramp's cast durations, so the floored
  case is paid automatically). **There is no axiom to fix and no patch is queued.**
  **What of the sim's +0.079 pp, then?** PHASE8 §15.5 F5's sweep (`var 3.0`, 20k iters) measured
  `resid@AT=0 − resid@AT=10` at **+0.094 / +0.098 / +0.040** (R=40) and **+0.092 / +0.088 / +0.061** (R=70),
  6/6 positive, mean **+0.079 pp** — but it was **single-buff, therefore floor-free** (IV at R=40:
  m = 1.0254×1.20 = 1.230 ⇒ steady 1.219 s, 0.219 s of slack), the regime where **0.000 is the correct
  answer**. So the sim's premium is a residual (0.054 casts on 68) with **no identified mechanism**. Per
  CLAUDE.md that is a **sim-setup audit trigger, not a model bug**, and PHASE8 §7 forbids encoding a sim
  lattice artifact into `index.html`. Note the effect is ramp-**coverage**, not being-early: `AT=5` shows no
  bonus, because the ramp ends at 6.34 s (R=40) / 6.22 s (R=70) and a press at 5 snaps to the next cast
  boundary, already past it. It is **not** B2's mechanism either.
- **Sim-setup caveat (a trap, not a model gap).** In a *fixed-duration* sim, a haste buff jammed against
  the fight **end** (e.g. IV@1:00 in a strict 1:20 fight) shows a spurious ~1.4% loss vs pull, because the
  sim doesn't credit the truncated tail casts proportionally. The **model is right** to score pre≈post as
  a tie (it *does* credit the tail proportionally — via the boundary credit since 07-27, via the
  kill-window integral before that; the conclusion is unchanged and now exact); the gap is a sim-setup artifact
  (cf. the Vashj drop bug, `docs/TOOLING.md`). Verified: extend the fight so the buff is interior → the gap
  vanishes to 0.00%. (AB damage is **stack-independent** — re-confirmed at source, `arcane_blast.go:55/58`
  — so this is pure cast-count, not a stack-damage effect.)

### 3b. Press-execution physics in the SCORER *(Phase 7 — the cross-val's scorer-gap fixes, each sim-gated by a minimal pair)*

> ## ⚠ SUPERSEDED IN ITS MECHANISM BY PHASE12 §6.11 (2026-07-27) — the LAW is unchanged, the term is
>
> The law below — *a buff affects the cast stream only from a cast boundary* — is right and still
> governs. What changed is that the model no longer has to **price** it as an expected slip: since the
> objective became the per-cast sum, the walk applies each buff from the boundary it truly fires on and
> runs it for its **full duration** from there, so a window ending flush against a hard edge loses its
> clamped tail *exactly* rather than in expectation. `scoreStart = press + ½·interval` survives only in
> the retired `integral` diagnostic.
>
> ⛔ **AND THE WALK USED TO GET THE OTHER END WRONG.** It applied the buff from the boundary but expired
> it at `press + duration`, so every mid-cast window was SHORT by the slip — one whole cast in the
> measured case (`tools/window-span.mjs`: Icy Veins at 9.6 covered 15 casts, wowsims 16). Fixed 07-27.
> A window runs its full length from the fire; **raid externals are the exception and start when
> CALLED** (item 2 below), because someone else presses them.
>
> ★ **AND THE COOLDOWN CHAIN ANCHORS ON THE FIRE TOO (PHASE12 §6.14c, 07-27).** The same "a self-press
> cannot fire while a cast is in flight" law governs *when the next use becomes legal*: wowsims starts
> a cooldown when the ability goes off, not when the schedule asked for it. The scorer's per-cooldown
> chain now records `auraAt` — the boundary the press snapped forward to — in `lastFire` (it was
> `lastEff`, the press moment), so a chained second use can no longer be scheduled earlier than the sim
> could ever execute it. Measured: **HELD press failures 18 → 1 of 196.** For a raid external
> `auraAt === eff`, so the "starts when CALLED" convention falls out of the same line.

Three terms landed together, all expressing one law: **a buff affects the cast STREAM only from a cast
boundary, and the model must price that wherever it is not phase-averageable.**

1. **Expected press-snap slippage** (`scoreStart = press + ½·local interval` for a mid-cast steady press).
   Interior windows are slip-invariant (what the start loses the end regains — the phase-average argument,
   still valid there); a window sequenced to end FLUSH against a hard edge (intermission wall, the kill)
   has its slipped tail CLAMPED — a pure loss the intent-time scoring forgave. **Sim:** Al'ar minimal pair
   — a stagger ending flush at the 3:28 wall model-TIED the packed layout yet simmed **−0.66% at every
   kill-variance**; the term now charges it (model −975) and the optimizer rejects it. Ramp presses
   (sparse boundaries, exact snap) and idle/gap presses slip 0. Displayed times unchanged (fire-time
   convention) — pressing at the printed second fires at the same boundary.
2. **Raid externals snap to the board lattice.** Bloodlust/PI/Drums *auras* land at the call second
   (someone else presses), but the stream only accelerates from the **next cast boundary** — the in-flight
   cast keeps its speed, and near the pull the lattice is deterministic (locked to the ramp), so the call's
   phase is NOT averageable. **Sim (Void Reaver):** pressing IV 2s earlier compressed the ramp and
   re-phased the lattice so a 1.248s cast ran 9.94→11.19 across the Lust@10 call — stranding 1.19s of Lust
   the call-time model silently credited (−0.18% for the "better-compressed" plan). The scorer now starts
   an external's scored window at the board-lattice boundary after the call.
3. **A ramp cast's damage snapshots its buff state at cast START** (its damage *time* stays at the
   completion — Phase 4's rule, unchanged). Sampling the state across the completion had credited every
   press-snapped ramp-exit window with ~half of the cast it fired *after*; the in-flight cast never
   benefits. **Sim (isc+scb T=98 h140):** the model preferred the co-pressed-at-ramp-exit cluster over
   cluster-on-Lust by +0.12 casts while the sim said **−0.40%**; with the snapshot fix the model ranks it
   −0.11 — agreement.
   **⚠ Mechanism correction (Phase 8 round 2):** the *fix* is right, the stated mechanism is not. wowsims
   applies a buff at **cast COMPLETION** (`sim/core/cast.go:216/258/338/356`), not at cast start. The two
   agree at a window's **front** edge only because the press is boundary-snapped — "completion of the cast
   in progress" *is* the next cast's start. They **disagree at the BACK edge**: on the completion rule the
   cast in flight when the aura fades is unbuffed, so a start-snapshot model over-credits a window's last
   partial cast by `frac(D/Δ) × premium`. See §3b-note and PHASE8 §5/§5b.
   **✗ DELIBERATELY NOT IMPLEMENTED — and as of 07-26 that is a VERDICT, not a backlog item
   (PHASE8 §22).** The charge was re-priced against the *anchored* lattice (the shape §21.5 showed
   the flat `frac(D/Δ)` gets wrong) and it is **still anti-B2, 4.3× more so**: `ΔL` goes
   `+0.036 pp` (flat, §13.8) → **`+0.156 pp`** (anchored), where B2 needs a *negative* charge to
   close its `−0.380 pp`. The physics below is source-verified and unchanged; what is falsified is
   that charging it improves the model's RANKING. Do not implement it as a B2 fix. Instrument:
   `tools/p8-boundary-charge.mjs`.

**§3b-note — the phase-average argument (1) is CONDITIONAL on a uniform press phase.** "Interior windows
are slip-invariant" holds because over a uniform press phase `E[casts in window] = D/Δ`. That is **true for
a human**: TBC on-use trinkets and Arcane Power are off the GCD and can be pressed mid-cast, so a real mage
draws from the whole phase distribution. It is **false for the sim**, which can only press at a cast
boundary and therefore always realises φ=0 — the *minimum* of that distribution, covering exactly
`floor(D_eff/Δ_inside)` casts (**THE FLOOR LAW**; PHASE8 §5 established it, §11/§13 pre-registered and
confirmed it to one rating point with a mechanism proof; TOOLING ★).
So the model was written for the player and the sim samples one corner of the player's options: **expect the
model to read `frac(D/Δ) × premium` high against any sim A/B of a damage/SP window** (≈+0.036pp measured on
a clean single-buff marginal) before calling that gap a model bug.

> ⛔ **THAT EXPECTATION IS RETIRED FOR SELF-PRESSED WINDOWS (07-27, PHASE12 §6.11).** The objective is a
> per-cast sum that reads a **value** buff at the cast's **COMPLETION**, over `(start, end]` — the sim's
> own rule (`tools/credit-check.mjs` is the gate). A self-press fires on a cast boundary, so the model
> now covers exactly `floor(D_eff/Δ)` casts too: **there is no `frac(D/Δ)` over-credit left in the
> number that ranks.** It survives only in the retired `integral` diagnostic.
> ⚠ **Two things still stand.** (a) The FLOOR LAW itself — the *sim's* behaviour, and the whole reason
> the completion rule is right — is untouched and is still how you read a sim number (TOOLING ★).
> (b) The residue applies to windows that open **mid-cast**, i.e. raid externals, where `start` is the
> call rather than a boundary. Power Infusion is a **damage multiplier** pressed by someone else, so it
> is exactly that case; Lust/Drums are haste and take the START rule instead.

**The law's general form — ONE WINDOW, TWO SAMPLING RULES (PHASE8 §13; this CORRECTS the earlier "haste
buffs are exempt" wording).** `D_eff` is the window's true aura duration and `Δ_inside` the cast interval
**in force inside it**; which way the partial cast at the back edge rounds depends on **when wowsims reads
the buff**:

| class | read at | casts covered | model's bias — ⛔ **as of 07-27, HISTORICAL** |
|---|---|---|---|
| **value** (`+SP`, `×dmg`) | cast **COMPLETION** — a cast in flight at fade is unbuffed | `floor(D_eff / Δ)` | ~~**over**-credits `frac(n)`~~ → **0** for a self-press |
| **haste** (`×speed`, `+rating`) | cast **START**, then frozen — a cast begun a tick before fade runs fast throughout | `ceil (D_eff / Δ_buffed)` | ~~**under**-credits `ceil(n) − n`~~ → **0** for a self-press |

⛔ **The "model's bias" column is the bias of the RETIRED integral, not of HEAD.** Since PHASE12 §6.11
the per-cast walk implements **both** rules of this table directly — haste frozen at the cast's start,
value read at its completion over `(start, end]` — so for a boundary-snapped self-press the model covers
the same casts wowsims does and the bias is zero. **The two read-at rules themselves are the crown jewel
here and are unchanged**; what is retired is the idea that the model *approximates* them. Residual bias
survives only where a window opens mid-cast (raid externals — Power Infusion is the value case).

Both step at the same integer crossings, so step *locations* never distinguish them; the *level* does
(PHASE8 §13.7: per-sampling-rule fits the sim to 0.0439 pp mean, against 0.1114 raw and 0.0946/0.1373 for
either single rule forced on both classes). `D_eff` is not always the tooltip duration — **SCB's is
`15.010 s`**, because it is a *proc* off the Mana Emerald and its aura lands 10 ms after the cast boundary,
which is enough to move its step a rating point off AP's.

**Haste buffs are NOT exempt.** That belief came from only ever measuring them at `--var 0`, where the
**fight-end quantizer exactly compensates the window's**, so the two cancel and the window looks flat.
Jitter the fight (`--var 3.0` > one cast interval) and the end-quantizer phase-averages away, exposing the
window: IV steps at `R≈98.6` and `R≈196.9`, Zerk at `R≈143.4`, while MQG — same `D=20`, smaller bonus, no
integer crossed — correctly does not. **Practical consequence for the harness:** a haste-window A/B is only
quantization-free at `var=0`, and only because two errors cancel there; never read a `var=0` haste marginal
as evidence about window coverage. Charging the back-edge fraction is a live candidate refinement,
**not implemented** (it moves the B2 deficit the wrong way — PHASE8 §8 — so it would need its own physics
justification and sim gate).

**The IV@0 "ramp compression" bullet above is TEMPERED by (2):** the compression is real (ramp casts do
run faster — sim-verified cast lengths), but pressing IV earlier re-phases the post-ramp lattice, and what
compression gains, a stranded near-pull raid call takes back. Decomposed at Al'ar (Lust@6): IV@0-vs-@5
alone = **sim wash** (2106.9 vs 2107.1); at Void Reaver (Lust@10), chasing compression = **−0.18%**. The
old "+0.16 eff casts for IV@0" figure was an engine head-to-head, never sim-gated — treat compression as
a tie-breaker at best; the optimizer now weighs it against the call-phase cost on its own.

## 4. Buff-into-Lust packing — the usual method for maximizing effective ABs *(sim-verified this project)*

Lust is nothing special in the model — it's just a **hardcoded stretch of extra haste** the fight hands
you. Because it makes casts faster, it's *usually* the best place to concentrate the damage/SP cooldowns
(more flux → more effective ABs) and to spend haste (kept under the floor). So the common-case method:
**pack the damage buffs (Icon, gem, Arcane Power) onto the Lust window and lay the haste buffs
SEQUENTIALLY across it (IV floors the window, Berserking on the unfloored tail) so neither overcaps the
GCD floor.** This is a *consequence* of maximizing effective ABs (§1), not a law — where Lust sits, and
whether aligning to it beats spending a cooldown elsewhere (e.g. to get it back for a bigger later
window), is decided by the count/sim per fight. What matters is buff-seconds landing on the fast,
damage-buffed casts — Lust is the usual vehicle, not the objective.
- Late-Lust fights (Lust @4:20, 0 gear): pull the 3rd IV **onto** Lust @4:20 (floors the window so the
  damage cluster rides its fastest casts) **then** Berserking @4:40 on the unfloored Lust tail. Beats
  the old "Berserking-in-Lust, IV parked outside" layout by **+8.5 DPS** on the 6:00 test fight and
  **+13.9 (var0) / +5.7 (var10) DPS** on the 5:45 test fight (wowsims, 150–250k iters, seeds 11/19,
  collision-offset; both stable var0↔var10). These two plain fights are the locked packing regression.
- Swapping *which single* haste buff is in Lust is a wash (IV-in-lust-alone ≈ −0.7). The win is getting
  the **second** haste buff in too — sequentially, because a haste buff *overlapping* the already-
  floored IV window is worth exactly 0 (verified: Berserking @4:20 **on top of** IV @4:20 = wash/loss).
- **Implemented** (the search fix): a sequential window-packing move in `optimizeAsync` (runs last so
  no later pass re-floors the sequenced tail buff) assembles the packed burst at each haste raid-call —
  damage cluster on the window start, haste buffs on sequential slots (biggest-haste-first at the
  anchor, the next at anchor+dur). See `docs/ARCHITECTURE.md`.
- **Align-vs-twice breakpoint:** only pull a cooldown into Lust if it doesn't cost that cooldown its
  **second use**. If aligning would drop a use, keep the two uses instead — but *only* when the
  sim says two-unaligned > one-aligned. The packing move enforces this automatically via `sameCounts`
  (a pack that would drop a use is rejected). (Model caveat: the model ranks the fully-packed layout
  highest — a **search** problem to reach it — but mis-ranks the *partial* pack, IV-in-lust-alone,
  above "IV out"; so any packing logic must produce the FULL pack, not stop half-way.)
- **RESOLVED — the far-Lust "limitation" was a drop-bug-rig artifact (2:15, Lust @0:25).** The old note
  claimed packing the burst onto a far Lust beats burst-at-pull by ~34–50 DPS and the tool couldn't reach
  it. Re-examined on the FIXED rig with the exact-ramp model: the tool's **double-dip** plan (both
  Icon+gem uses — opener + terminal — IV split 0/CS-115, AP+Zerk on the opener, Lust left mostly bare)
  **beats** the one-aligned-on-Lust pack by **+0.4% var10** (and one-aligned beats naive two-icons by
  +0.1–0.2% — model and sim now agree on that ordering too, see the §7-era icon-count history in
  ROADMAP). Nothing to implement: the current optimizer emits the winning plan on its own.

### 4b. THE CHAIN LAW — a kit-limited fight's winning layout is a chain of *group seconds* spaced by the kit's OWN cooldowns *(Phase 9 §5.13; structural, model-derived)*

§4 says *where* to concentrate cooldowns when the fight hands you a Lust. This says what the whole
layout looks like when the fight is long enough that cooldowns come back but too short to spend them
freely — the **kit-limited** regime, which is most real fights. Two claims, both falling out of §1:

1. **The presses collapse onto a handful of shared seconds ("group seconds"), and the spacing between
   those seconds is drawn from the enabled cooldowns' own periods** — not from the fight clock, not
   from the Lust timer. On `5:40 lust 0:05` with `isc+scb+AP+IV+zerk` the winner is
   `5 —(+120, the trinket cd)→ 125 —(+180, the IV/zerk cd)→ 305`, and every track presses at every
   group second it is **up** for. This is §11 (containment) applied transitively: if buff A wants to
   contain buff B, and B's next use is one B-cooldown later, then A's next use wants to be there too.
   Cold Snap buys Icy Veins **one extra** press inside such a chain (the 120 gap is < IV's 180).
2. **★ A long-cooldown track may DECLINE a use it could legally take, in order to stay stacked.** On
   that same fight Berserking (cd 180) *skips the opening group* and presses `125, 305` — giving up the
   `5` use — and `isc/scb` skip the `245` use they were entitled to. A greedy "press it the moment it's
   up" line advances on the *shortest* cd and lands its third group at 245 instead of 305: that layout
   scores **582553.499 vs the winner's 582688.621 (−135.1)**. Availability is not an argument for
   pressing; **stacking is worth more than a use** whenever the declined use would land outside every
   other track's window.

**Why this is in the rules and not just in the optimizer.** Every seed the search had built a track on
*its own* cadence (naive/packed/pinned/kill-anchored), so a stacked chain that declines an available use
was **unreachable** — verified exhaustively: from a non-chain entrant, the basin hop gains **+0.000**
even when handed every anchor `0..T−1` (2712 pairs / 1769 polishes). The chain is now generated directly
as a seed class (`groupSeeds`, `docs/ARCHITECTURE.md`), which is why it is worth stating as
theorycraft: *given a kit and a fight length, you can write the candidate layout down by hand from the
cooldown arithmetic alone.*

### 4c. ★★★ THE PACKING LAW — haste windows go BACK TO BACK, and the whole train moves together *(07-30, MODEL-DEFECTS §8s; brute-force verified)*

§4 packs *value* onto haste. This says what the **haste** windows do to each other, and it is the rule
two shipped plans were violating on 07-30.

Under the GCD cap a second haste buff **inside** the first is worth much less than beside it — §7's
thresholds, and at high multiplier the cap eats it entirely. So when total haste already sits at or
near the floor, the optimum **abuts** the haste windows rather than overlapping them:

```
2:00 · 1387 SP · 38 % crit · Lust 0:05      Icy Veins [7,27] · Berserking [27,37] · Cold-Snap IV [37,57]
```

Two consequences, and the second is the one that bites:

1. **The cost of a one-second overlap is a full second of the weaker buff's marginal value** — here
   0.0867 casts, `ESTABLISHED-FACTS` §5.1's Berserking-in-Bloodlust figure. It is not a rounding
   effect; it is the largest term in the neighbourhood.
2. **★ Therefore the layout is a rigid TRAIN, and every single-coordinate move off it is downhill.**
   Slide Icy Veins alone and it eats into Berserking; slide Berserking alone and it runs into the
   second Icy Veins. Measured on the case above: **zero** improving 1-coordinate moves, **zero**
   improving 2-coordinate moves, and six improving 3-coordinate moves. A coordinate descent — at any
   effort — cannot leave a packed train. This is the same structural fact as §4b's chain law, one
   level down: there, presses collapse onto shared seconds; here, *windows* collapse onto shared edges.

⚠ **The train's own position is then set by the VALUE alignment, and that is what sends it to 3 stacks.**
Given the packing, the remaining freedom is where the whole train starts, and the answer is the second
the value cluster wants — the first whole second with 3 Arcane Blast stacks and Lust up (0:07 at
Lust 0:05) — because Icy Veins' 20 s window then coincides exactly with Icon's, and haste × value
multiply (§6). On the 2:00 case that alignment is worth 0.0058 casts over starting the train at 0:05,
which is small but 2.9× the tie band and reproducible by enumeration.

⚠ **A burn-in for whoever reads this next:** the *scorer* had this right all along. Both failures were
the SEARCH not reaching a layout its own objective preferred. When a plan looks wrong, brute-force the
cell before touching `simulate()` — §8s and §8m were both search defects that a scoring "fix" would
have made permanently worse.

## 5. Icy Veins slides out of Lust as haste gear grows *(now REALIZED in the search, sim-verified)*

At ~0 haste, IV belongs in Lust (packed, per #4). This isn't received mage-forum wisdom taken on faith —
it's **verified in this project from first principles**: brute-enumeration (`tools/explore.mjs` `iv-icon`,
h0: IV-in-Lust 65.294 > IV-pre 65.122 effective ABs) and the sim (IV@5-in-Lust beats IV@0 by +0.07% on the
1:40 opener, prestack 0), and the *reason* is the flux coupling — the damage buffs sit in Lust, and IV
flooring those casts makes each damage-buffed second worth more. As passive haste rating rises, Lust alone
approaches the floor, so Lust+IV wastes more and more — past a breakpoint (**~15 rating** in the isolated
IV+Icon case; pushed to **~80** when Arcane Power joins the Lust cluster, because the SP payout rewards
overcapping a little — RULES §16) IV is worth more **outside** Lust while the **damage cluster stays ON
Lust** (its fastest casts). No hard breakpoint to hardcode — it emerges from the floor math.
- **Realized (this session).** The sequential window-packing pass (RULES §4, ARCHITECTURE) now generates
  **exit** candidates — the damage cluster on the Lust anchor, the haste buffs sequenced/stacked **just
  past** the window (`exitSeq` / `exitStack`) — alongside the usual pack-into-the-window layout. Kept only
  on a strict robust gain, so it's inert at h0 (IV-in-Lust wins; goldens byte-identical, exact-match
  23/23) and self-selects above the breakpoint. Before this, the opener could get glued off-Lust at high
  gear haste (cluster following IV off the fast casts) — a search miss the scorer already ranked below
  cluster-on-Lust.
- **Sim-verified:** cluster-on-Lust + IV-off beats cluster-glued-off-Lust by **+61 DPS var0 / +54 var10**
  at h250 and **+53 / +55** at h200 (250k, seed 11 — both variances agree, so it's the real flux gain of
  putting the damage buffs on Lust's fast casts, not a fixed-length boundary artifact). The physics is
  anchored: rating trinkets + gear haste run the SAME `(1+rating/1577)·∏%buffs` / GCD-floor path
  trust-anchored at h0.
- **Consistent across the WHOLE gear-haste range now** (h50…h300, 4:00 fight: opener cluster on Lust at
  every level). The last hold-out — a narrow ~h200 band where the exit layout needs Cold Snap and the
  CS-materiality gate mis-vetoed it as "adds a use" — was **fixed** by measuring adds-use by **value not
  count** (§8, last bullet). No per-haste rule; it falls out of the floor math + the CS gate.
  ⇒ ⛔ **AND THE GATE ITSELF IS NOW GONE (user ruling 07-28)** — `bar = TIE_TOL`, so Cold Snap is spent
  for *any* gain and there is no longer an adds-use question to get wrong. The mis-veto this bullet
  describes cannot recur, and the value-vs-count refinement that fixed it is deleted along with the
  thing it was refining. The ruling: *"the cooldown will be ready for the next boss, always"* — an
  8-minute reset is not scarce inside one pull. ARCHITECTURE carries the deletion list.

## 5b. ★ AT THE GCD FLOOR, ICY VEINS PLACEMENT IS RATE-NEUTRAL — and the tie is broken by
##      DISCRETE CAST PLACEMENT, not by the rate

**A user argument on 07-28, and the arithmetic is exactly right:** *"at h=0 IV by itself is irrelevant
if it sits inside lust or outside of it — the loss by the 'over the GCD cap' is equal to the bonus
gained by multiplicating the haste effects."*

Verified to float precision at h = 0 (`interval = max(1.0, 1.5/m)`, 3-stack cast 1.498):

| window | mult | interval | rate |
|---|---|---|---|
| bare | 1.00 | 1.5000 | 0.6667/s |
| Lust | 1.30 | 1.1538 | 0.8667/s |
| Icy Veins | 1.20 | 1.2500 | 0.8000/s |
| **IV + Lust** | 1.56 | **1.0000** | 1.0000/s ← **GCD-FLOORED** |
| Zerk + Lust | 1.43 | 1.0490 | 0.9533/s |
| IV + Zerk + Lust | 1.716 | **1.0000** | 1.0000/s ← floored, so **Zerk on IV+Lust buys ZERO** |

20 s of Icy Veins buys **2.6667 casts inside Lust and 2.6667 casts outside it** — equal to 1e-9. The
floor gives back precisely what the multiplication wins. Berserking is **not** neutral (10 s buys
0.8667 casts inside Lust vs 0.6667 outside), and Berserking stacked on an already-floored IV+Lust
window buys **nothing at all**.

⇒ **Two consequences that ARE rules.** (a) Since IV placement is free, the real question is which haste
window the *damage* cluster (SP + Arcane Power) sits on, and **IV+Lust at 1.0000/s beats Zerk+Lust at
0.9533/s** — the model already puts the cluster there. (b) Never stack Berserking onto a floored
IV+Lust window.

### ⚠ …AND THE PLAN THAT LOOKS LIKE IT CONTRADICTS THIS IS ~86 % AN ARTIFACT

Carried further, the argument says Berserking should sit **fully inside** Lust. The tool emits it at
`0:41` — 6 s of 10 inside a Lust that ends at `0:47` — and scores that **+0.211 %** over fully-inside.
A partial overlap winning is a **non-monotonicity**, and the user called it: *"if it's better to not
overlay them then it should be AFTER lust… but if you genuinely somehow come to the conclusion that
overlaying just half of berserking is better, then that smells."* It does, and it was.

**Every one of 41 580 legal layouts fits EXACTLY 80 casts.** Berserking's position changes the cast
count by nothing at all. The whole spread is where the 80th cast lands. So the +0.211 % is not
Berserking's haste doing anything — and the cast board says what it actually is:

```
cast 59   Zerk@37 → starts 68.889, interval 1.5000   (Icy Veins 2 has expired)
          Zerk@41 → starts 68.862, interval 1.2500   (Icy Veins 2 still running)
```

**Berserking was being used as an indirect LEVER on the Cold-Snap Icy Veins fire time.** Moving Zerk
from 37 to 41 delays the cast boundary that IV2 snaps to (48.889 → 49.204), sliding its 20 s window
later and catching one more hasted cast. Pull that lever *directly* — let IV2 move too — and the gap
**collapses from 0.211 % to 0.029 %**.

**What survives is real but negligible.** The residual 0.029 % is persistent (no sign flip over
T = 92…108 s) and the sim confirms it independently (**+0.6 DPS ±0.05 over 5 seeds**). But it is
**below the tool's own tie band** (`BENCH.tieBandPct = 0.05 %`) — the sim panel would print *"too close
to call"* for it. So the planner spends a structurally odd layout to capture a margin it would itself
refuse to call.

⇒ **Two rules, and one open question.**
1. When a rate argument and the emitted plan disagree, **read the cast board before believing either**.
   Here the rate argument was wrong about the mechanism *and* the plan was right for a reason that had
   nothing to do with the cooldown being discussed.
2. **Suspect any preference that is non-monotone in an overlap fraction.** Monotone-in-overlap is what
   physics produces; a peak at partial overlap means some *other* coordinate is being moved by proxy.
   That is a general-purpose smell test and it worked first time.
3. ✅ **DECIDED 2026-07-28 — user ruling, "yes, absolutely".** Layouts whose entire difference is
   terminal-cast phase, and which fall inside the tie band, ARE treated as ties and broken toward the
   structurally sensible layout. `structuralSnap` in `index.html` implements it, with three guards that
   are the whole safety argument:
   · **cast count must be unchanged** — if a move gains or loses a cast it is not phase, it is damage;
   · **`robust ≥ val − 0.05 %`** — the band is the tool's own `BENCH.tieBandPct`, the margin below which
     its sim panel prints *"too close to call"*;
   · **press rows must not increase** — the structural win may not be paid for in legibility.
   It runs LAST, on the winning layout only, so it can never influence which search arm wins and never
   compounds with any other tolerance.

   **Measured (16-case quick tier):** 9 layouts moved, **every one inside the band, worst −0.050 %**,
   legibility unchanged-to-better (+6 clustering, 0 change in lone rows). What it buys is exactly what
   was asked for — Berserking pulled **fully inside Bloodlust** on Solarian (36→35), Morogrim (36→35),
   Lurker (39→37) and Void Reaver (42→40), and stray presses aligned onto an already-occupied second.

   ⚠⚠ **`search-miss` WILL report those cells as regressions, and that is correct.** This is the one
   place in the engine allowed to return a plan it scored lower. Do not silence it, do not widen the
   band, and do not confuse it with the **retired** legibility budget — that was a *whole cast*
   (~0.77 %, 15× wider) and it bought co-pressing rather than robustness.

⚠ Related, from the same exchange: the cluster printed at `0:06` against a Lust pinned at `0:07` is not
a mistake. Brute force over 13 725 legal layouts scores cluster ∈ {6, 7, 8} **identically** — value
buffs are read at cast completion, so the same casts are covered either way.

## 6. Spellpower × Arcane Power is multiplicative

Icon's +155 SP is multiplied by Arcane Power's +30% — so a spellpower buff wants to land **on** the
AP window, not merely on a haste window. Real but small (KaelThas/KT: +0.3–0.9 DPS, clean across
seeds). Matters when the AP cluster is *staggered* off the pinned Lust (KT: Lust @4:20, AP @4:45) —
the spellpower buff should slide onto AP, which a pinned-only snap misses. Forward-slide only (an
already-early buff has nothing better behind it).
- **SP buffs never compete with each other.** SP is additive (`base + coef·(sp+Δ₁+Δ₂)`), so a second
  SP buff dilutes nothing — Icon+gem BOTH on the fastest window beats any split at every haste level
  (measured: both-fast 52.018 vs best split 51.662 at h0, +0.36 casts; same ordering at h150/h300).
  Concentrate every SP buff on the single highest-flux window; only cooldown spacing ever separates
  them. **Budget asterisk (user-flagged): the gem is a 3-charge resource (Mana Emerald, `trackRule`),
  Icon is only cd-limited** — per-window they still never compete, but on a long fight gem's three
  uses are a budget to spend on the three best windows while Icon can ride every 2-minute tick. The
  planner's `maxUses` handles this; when reading a plan, a "missing" gem on some window is the budget,
  not a mistake.

### 7a. ★★★★ FLAT HASTE **RATING** DOES NOT STACK WITH ITSELF — the three composition cases *(user, 07-30; measured)*

§7 below is written entirely for **multiplicative** haste (Icy Veins ×1.20, Bloodlust ×1.30, Berserking
×1.10, Power Infusion ×1.20), and its "haste buffs MULTIPLY" is true only of those. Flat **haste rating**
(Skull of Gul'dan +175, Mind Quickening Gem +330, Drums +80) composes differently, because the engine —
and the game — put every rating into ONE bracket:

```
m = (Π multiplicative effects) × (1 + Σ rating / (HASTE_RATING_PER_PCT × 100))
```

Below the GCD floor `rate = m/G`, so for two buffs of duration `D`, stacked vs held apart:

```
gain from stacking = D · (A − 1)(B − 1) / G
```

and the whole question is what `A` and `B` are:

| pair | A, B | (A−1)(B−1) | predicted | **measured** |
|---|---|---|---|---|
| **mult × mult** — IV ×1.20 · Zerk ×1.10 | 1.20, 1.10 | 0.0200 | +0.133 | **+0.138** |
| **mult × rating** — IV ×1.20 · Skull +175 | 1.20, 1.111 | 0.0222 | +0.2959 | **+0.2963** |
| **rating × rating** — Skull +175 · MQG +330 | *one bracket* | **0** | **0** | **−0.000000** |

★ **Two flat-rating buffs are EXACTLY neutral to stack**, and it is not a near-miss: their ratings add
into a single `(1 + h₁ + h₂)` rather than forming `(1+h₁)(1+h₂)`, so the cross term that makes stacking
pay does not exist. `(1+h₁+h₂) + 1 = (1+h₁) + (1+h₂)` identically.
⇒ **Skull and MQG may be placed wherever else wants them** — kill-window, cooldown chain, a value
cluster — at zero cost to each other. That is a real planning freedom, and it is the reason the
`Skull + MQG` layouts spread out (`|S| = 5`) where the `Icon + Gem` ones cluster.
⇒ Conversely a rating buff DOES want to ride a multiplicative one (`h(a−1)` per second, the largest of
the three gains here), which is the correct reading of "trinket into Lust".

⚠ **All three flip sign at the cap**, which is §7's real subject. Measured with Bloodlust already up
(m = 1.30, so the floor bites): mult × mult **−0.665**, mult × rating **−1.481**, rating × rating
**−0.063**. The rating × rating case is *still* the least sensitive — near-neutral below the cap and
least punished above it.

⛔ Do not restate §7 as "haste-on-haste is multiplicative" without this qualifier. It was stated that
way once, on 07-30, and the user corrected it: *"just multiplicative haste no? gotta differentiate
between flat haste bonus and multiplicative."*

### 7a-ii ★★★ THE MIXED PAIR IS THE MOST POSITION-SENSITIVE OF THE THREE — and under Bloodlust you ALWAYS split *(user, 07-30)*

*"Temporary flat × temporary multiplicative — would you want to stack those or no?"* It has the biggest
upside of the three pairs **and** the biggest downside, so it is the one worth thinking about. Per
second, what the SECOND buff adds (Icy Veins ×1.20 · Skull of Gul'dan +175, both 20 s):

| already up | m | Skull ALONE | Skull ON TOP OF IV | verdict over 20 s |
|---|---|---|---|---|
| nothing, 0 gear haste | 1.000 | 0.07407 | **0.08889** | **STACK** +0.296 casts |
| 200 gear haste | 1.127 | 0.08341 | **0.09829** | **STACK** +0.298 casts |
| 400 gear haste | 1.254 | **0.09308** | 0.00000 | **SPLIT** −1.862 casts |
| **Bloodlust** | 1.300 | **0.09591** | 0.00000 | **SPLIT** −1.918 casts |
| Bloodlust + 200 gear haste | 1.465 | **0.02344** | 0.00000 | **SPLIT** −0.469 casts |
| Bloodlust + Power Infusion | 1.560 | 0.00000 | 0.00000 | neutral — everything is floored |

★★ **Under Bloodlust the crossover is ZERO haste rating: split at any gear.** `1.30 × 1.20 = 1.56` is
already past the GCD floor at 1.5, so a rating trinket layered on Lust + Icy Veins is worth **exactly
nothing** — while the same trinket on Lust *alone* (1.30 → 1.444, still under the floor) is worth
0.0959 casts/s. That is the case that matters in practice, because Lust is when you burst.

**With no raid buffs the crossover is ~228 haste rating** (cap-touch for `1.20 × 1.111 = 1.3332` is
`(1.5/1.3332 − 1)·1577 ≈ 197`, then ~31 rating of grace while the premium outruns the overcap waste —
the same shape as §7's IV+Berserking 264). ⇒ **the mixed pair crosses EARLIER than mult × mult**, because
+175 rating (×1.111) is a bigger bump than Berserking's ×1.10 and reaches the floor sooner.

✅ **The planner already does this correctly, and it is a good check that the rule is live.** On
2:00 · Lust 0:05 with `IV + Icon + Gem + Skull`, it emits Skull at **0:34** — deliberately clear of the
Lust + Icy-Veins region (where the trinket is worth zero), covering `[34,45]` under Lust alone and
`[45,54]` under Icy Veins + Berserking *after* Lust has dropped. Both halves sit under the floor with
headroom; neither is the capped region. ⚠ It only does this since MODEL-DEFECTS §8w — before that fix
the descent ratcheted Skull back to 0:29, and the gradient it was throwing away is exactly the
0.0013 casts/s this table prices.

## 7. Haste-on-haste IS a multiplicative synergy below the floor — the floor decides when to split
*(REWRITTEN — the old "wash" version was a fixed-rig artifact; see the correction note at the end.)*

Below the GCD floor, cast rate ∝ the multiplier `m(t)`, and haste buffs MULTIPLY (`1.2 × 1.1 = 1.32`).
So a haste buff riding another is worth **the host's multiplier times** its solo value — the same flux
law that makes damage buffs want fast windows applies to haste itself. Berserking inside Icy Veins is
worth ×1.2 its outside value; inside Lust, ×1.3. Verified exactly, model AND sim (fixed rig, var10):
Zerk-in-IV beats Zerk-outside by **+0.13 casts / +0.37%**; Zerk-in-Lust beats Zerk-after-Lust by
**+0.20 casts (model +0.42%, sim +0.6%)** — the pure `10·(1.43−1.30)/1.5 − 10·0.10/1.5` arithmetic.
Stacking position is otherwise free (pull-stack ≡ interior-stack to 0.0000, §3).
- **Why model +0.42% vs sim +0.6% (user asked — decomposed exactly):** the sim runs var10, and a LATE
  buff window (Zerk@45 on a 60s fight, draws 50–70) is CLIPPED on short draws while an early one never
  is. Re-run at T=80 var10 where the @45 slot can't clip: sim = **+0.3%** = the model's fixed-kill
  number exactly (+0.2 casts / ~63; SE ≈ 0.008%, noise ruled out). So model = fixed-kill effect;
  sim-var10 adds a real "late windows carry kill-variance risk" premium the model does **not** price
  BY DESIGN — a broad kill hedge is the player's live call (§8). ⛔ This line used to say the model
  prices it "inside its half-cast kill window"; that window is **retired** (PHASE12 §9). The model's
  only boundary hedge is now the **one-sided credit on the straddling cast itself**, which is narrower
  still (one cast duration, not ±0.5 s of plan-wide taper), so the caveat below is *more* binding, not
  less. When
  sim-gating, match the question: use fights long enough that no window clips, or expect the late-slot
  penalty on top of the model's number.

**The IV+Berserking playbook** (isolated pair, 1:00 fight, brute-enumerated over 0–789 rating —
`tools/explore.mjs iv-zerk-solo`):
- **0–215 rating: STACK.** The ×1.2 premium is free — the stacked ×1.32 stays under the floor
  (cap-touch = `(1.5/1.32 − 1)·1577 ≈ 215`).
- **215–~264: STILL STACK.** The answer to "split the moment you touch the cap?" is **no — a bit
  after**: the growing overcap waste has to eat the whole 20% premium first. Model crossover at
  1-rating resolution: **264**. Flat-world algebra says 243; the extra ~21 is the opener ramp's floor
  headroom (the slow ramp casts absorb overcap — which is also why, near the crossover, stacking **on
  the pull** beats an interior stack: Zk@0 48.669 > Zk@10 48.609 at h240).
- **~264–~700: SPREAD.** Waste exceeds premium; the spread advantage peaks ~+0.55 casts around 574
  (where solo-Berserking itself nears its cap) and shrinks after.
- **~700+: STACK ON THE PULL (academic).** Everything is floored except the three slow ramp casts —
  the last place haste still buys anything — so both buffs pile onto the opener ramp. Unreachable
  in-game; the exact-ramp model produces it automatically.
- **Sim precision (fixed rig, var10, 300k):** the sim confirms the far sides (stack +0.2% at 200,
  spread −0.2% at 320) and brackets the crossover in **[200, 290]** — the knife-edge deltas
  (<0.15%) sit at the sim's noise/quantization floor, so treat the model's 264 as **±~25**. Same for
  every crossover below: the model pins the integer, the sim certifies the band.

**The Lust+Berserking band** (same sweep with Lust pinned): premium flat at **+0.20 casts** until
cap-touch **~77** (`1.5/1.43`), then decays; crossover **~139** (sim: stack +0.6% at 60, +0.3% at
120, tie at 160, spread at 200 — model's 139 inside the sim tie-band). So Zerk rides Lust from 0 to
~139 rating — well past cap-touch.

**Rating buffs obey the same premium law** (Drums +80 rating · 30s, in-Lust vs out): a rating buff
under a multiplier is worth ×(multiplier) its solo value, and the algebra transfers exactly —
cap-touch at `242.7 − 80 ≈ 163` gear rating (measured: IN wins through 160, OUT by 200). Two RATING
buffs (Drums+Skull) have **no mutual synergy** — rating is additive — so they still each chase the
multiplier windows, never each other.

**No partial overlaps — ever.** Value is linear in overlap seconds within a regime, so the optimum is
bang-bang: fully stacked or fully spread (measured at h240: full 48.669 > any partial 48.60–48.61 >
disjoint 48.595). Never park a haste buff half-in.

**The pure-haste trio (Lust + IV + Zerk, no damage buffs) — who takes the Lust slot?**
- **0 gear: BOTH, sequentially, IV first over the opener ramp** (seqIn 50.367 > all): IV's ×1.56
  overcap is absorbed by the slow ramp casts, and Zerk's ×1.43 fits the remaining headroom. This
  re-derives §4's sequential packing from pure cast-count — no damage-buff flux needed.
- **Any real gear haste (≥~50): the SMALLER buff keeps Lust, IV exits** (zkIn wins 50–250): Zerk
  ×1.1 still fits under Lust's shrinking headroom, IV ×1.2 doesn't. **General law: fill a haste
  window with the largest haste buff that still fits under the cap.** (With damage buffs present the
  flux coupling §16 holds IV in Lust much longer — pure haste is the floor-only limit.)

**⚠ Every crossover above is the PURE-haste limit — damage/SP buffs on the stacked window STRETCH the
stack band (user-flagged; the §16 coupling from the haste side).** Stacked extra casts are PREMIUM
casts (they carry the window's damage multiplier); spread extra casts are plain. Measured (IV+Zerk
split point, 2-rating resolution): pure **264** → +Icon on the window **280** → +Icon+AP **332** →
+Icon+AP+gem **348**. So in a real burst the stack holds ~+84 rating longer than the isolated-pair
number — always read this section's crossovers as lower bounds whenever the damage cluster rides the
stacked window.
- **Sim-verified (fixed rig, var10 300k, brackets around each crossover):** sign agreement at 7/8
  points, and the coupling's monotone growth confirmed — the stack-side premium rises with the kit in
  BOTH columns (model +0.32/+0.43/+0.54/+0.56% vs sim +0.2/+0.3/+0.6/+0.7% for pure/+Icon/+AP/+gem).
  At the two extreme points (h=400/415, beyond reachable gear) the sim holds the stack even longer
  than the model (tie instead of clear spread) — the documented GCD-lattice divergence zone, erring
  in the direction that strengthens the rule.

**Why Lust+IV still sequences (§4/§5 unchanged):** Lust×IV = 1.56 is over the 1.5 cap at ZERO gear
haste — at exactly h0 the premium and the waste cancel to a wash (IV-in-Lust = IV-out = 2.67 casts,
the old §4 "swap is a wash" data point), and any gear haste tips it to a loss. So the sequencing rule
survives, but its justification changes: not "no synergy exists" but "the synergy is real and the
overcap waste beats it from rating ~0 for THIS pair." The general rule: **stack two haste buffs while
`passive × (A·B)` is under the cap plus a margin; the margin is where the smaller buff's premium
(`(A−1)` × its solo value) equals the overcap waste** — for IV×Zerk that margin is ~48 rating past
cap-touch.

**Correction note (methodology).** The old §7 claimed "a wash in isolation — not a synergy," citing
Berserking-in-Lust vs after at an identical 2367.4 DPS (var 0, 300k). Two different schedules scoring
byte-identical DPS is the signature of the `APLActionSchedule` drop bug (both Zerk presses eaten —
TOOLING), and var 0's fixed-end quantization masks sub-cast differences anyway (our re-test: var0
shows ~0%, var10 shows the real +0.6%). Yet another old-rig casualty — always cross-check var0 ↔ var10
on the patched runner.

## 7b. ★★★ PREPULL **ACTIVATION** — legal, occasionally worth it, and much narrower than it looks *(user, 07-30)*

*"We still never precast Arcane Blast, but there's actually no harm in activating an item before the
fight and having the cooldown start ticking just a little sooner."* Correct, and it is a genuinely
different thing from the prepull the model bans: **RULES §3 / the cold-open rule is about CASTING**, and
that stays — a prepull cast is haste-blind and makes a haste sweep non-monotone. Pressing a trinket at
`−x` costs no cast and breaks nothing.

**The algebra.** Pressing use `k` at `−x` instead of `0`:
- use `k` loses the **tail** of its window, `[dur−x, dur]`, and gains `[−x, 0]`, which is prepull and
  therefore worth zero;
- use `k+1` becomes available `x` seconds earlier.

```
net = value(x s gained at use k+1) − value(x s lost from the tail of use k)
```

**The conditions** — and ⛔ **the first version of this section got condition 2 badly wrong; the user
corrected it: *"this is too shallow of a thinking."*** It read *"use `k+1` must be cooldown-limited"*,
which is false, and the correction is the whole substance of the rule:

1. **The tail must already be dead.** Free only if `[dur−x, dur]` falls inside an intermission or past
   the kill. Otherwise you are paying full price for it.
2. **★★ SOME LATER USE MUST BE COOLDOWN-LIMITED — not necessarily the next one.** Cooldown-limitation
   is **transitive down the chain**, and a use with slack is a **CONDUIT, not a blocker**: it can slide
   earlier at zero cost and hand the whole `x` seconds to the use behind it. *"The over-next use might
   be cooldown-limited, while the second use is free to move with nothing to gain or lose, but it would
   allow the next one to align better."*
   ⇒ the real test is: **does any downstream use want to be earlier, and is the total cost of sliding
   every use between here and there less than what it gains?**
   ★ Measured on Kael'thas, which is where the shallow version went wrong: Icon #2 at **120, 122 and
   125 all score `275.204056` — bit-identical**. That is a 5-second free-slide conduit sitting in plain
   sight, and the shallow rule looked at the same plan and called Icon "not cooldown-limited" because
   the *gaps* had slack. The slack was the point.
3. **★ The use that gains must be TRUNCATED at its far end.** An untruncated 20 s window slid 5 s
   earlier is still 20 s of the same value. Sliding only *adds* anything where the far end was being cut
   off — by the kill, or by a wall.
4. **★★ …OR IT FREES A SHARED CONSTRAINT, which is a second mechanism entirely** (user, same
   correction: *"or free up the hands of other cooldowns"*). Trinkets share a **20 s on-use lockout**
   (§17), so moving Icon 5 s earlier moves the earliest legal Skull/MQG press 5 s earlier too — a gain
   that appears on a **different track** and that none of conditions 1–3 mentions. Any shared resource
   does this; the lockout is simply the one this kit has.

⚠ **CONSEQUENCE: this is not reliably decidable by hand.** Conditions 2 and 4 both reach arbitrarily far
down the plan and across tracks, so "is a prepull worth it here" is a question about the whole layout,
not about one window. That is an argument for MODELLING it rather than ruling on it case by case — see
the implementation note below.

**Measured, in the shape where all three hold** (T=250, Icon cd 120, chain `0:07 → 2:07 → 4:07` with
the third window cut at the kill):

```
chain 7 / 127 / 247    193.346582 casts
chain 2 / 122 / 242    193.420645 casts     +0.074064   ← 37× the tie band
```

⚠ **KAEL'THAS 7:00 — the fight that prompted the rule, and the verdict is now UNDECIDED rather than
zero.** Pressing Icon at −5 s is genuinely free on the cost side (the 0:15 intermission truncates the
window anyway, so usable uptime is 15 s either way). The first analysis then declared the benefit zero
because Icon's uses sit 125 / 135 / 136 s apart against a 120 s cooldown — "every one placed by choice".
**That reasoning is retired by the corrected condition 2:** the slack means those uses are conduits, so
the question is whether anything downstream — including on another track via the trinket lockout — wants
those 5 seconds. Answering it needs the negative-press-time model, which does not exist yet.

⚠ **NOT IMPLEMENTED, and the corrected rule makes that matter more.** The model has no negative press
times: `repair` clamps to `t ≥ 0` and the search never proposes one. Building it means allowing
`t ∈ (−dur, 0)` for player-pressed tracks (never `≤ −dur`, which wastes the whole window — the user's
own bound), truncating the window at `t = 0`, and chaining the cooldown from the press. The engine
already does all three of those things in every other respect, so the change is mostly search-space.
⇒ Because conditions 2 and 4 are non-local, **a case-by-case hand ruling is not reliable** — which turns
this from "a narrow optimisation we could add" into "the only way to answer the question at all".

★ **Verified worth having.** A user-built 2:15 fight (Lust 1:35, intermission 0:15–0:20) satisfies every
condition at once: Icon `[0,20]` with a dead `[15,20]` tail, uses exactly 120 s apart, and use #2's
window `[120,140]` cut by the 135 s kill. The 5 s prepull is worth **+0.323591 casts — 162× the tie
band**.

## 8. Known-kill planning + Cold Snap

> ## ★★★★ THE MECHANISM OF THIS SECTION WAS REPLACED 2026-07-27 (PHASE12 §9, user ruling)
>
> **What this section used to say, and it is RETIRED:** the model hedged a wobbly kill with a
> **symmetric half-cast kill window** — `KILL_WINDOW = 0.5`, a linear taper over `[T−0.5, T+0.5]` — and
> `robust` (the ranking currency) was the rate integral weighted by it. Two things were wrong with it.
> A cast completing **exactly at T** was paid only **0.5**, because a symmetric window says the boss is
> already dead half the time; and the window was **only about the kill**, so a cast completing inside an
> **intermission** was paid in full (measured: starts `89.616`, wall at `90`, completes `91.114`,
> credited `2242.1` — now `frac 0.2563`, `credited 574.8`).
>
> **What replaces it — one uniform rule at every boundary:**
> ```
> credit = min(1, (nextCut − castStart) / castDuration)     ← multiplies that cast's own value
> ```
> A **cut** is a boundary you would not carry a cast across: the fight end `T`, an **intermission start**
> (the cast **cannot land**) and an **AoE phase start** (it lands, but you **cancel** it for Arcane
> Explosion — §9). ⛔ **A BURN edge is not a cut**: the cast lands and you would not cancel it, so it is
> a *value* question under the snapshot rule. (The AoE edge has flipped **twice** — shipped as a cut,
> removed on physics, restored on policy — §9 carries the reasoning.) ⚠ An **instant** cast takes credit
> **1**, not 0.
>
> ★ **It is still a hedge — the overrun it assumes still averages half a cast; it is just drawn
> ONE-SIDED (the fight never ends early) instead of symmetrically.**
> Algebraically it is a window whose width is the cast's own duration: for a cut `~ U[C, C+W]`,
> credit `= (C + W − completion)/W`, and `W = duration` gives exactly `(C − start)/duration`. It reads
> *"the fight lasts at least T, and at most one more cast"* — which is where the retired `0.5` came
> from in the first place, a **symmetric** window where a one-sided one belongs. Both forms verified to
> give `0.730702` on the same cast (PHASE12 §9.2). And the second ruling generalized it: an intermission
> does not land on the same second every pull either, so modelling *it* as exact is the identical
> mistake.
>
> **The reasoning below that SURVIVES unchanged:** plan for the known kill and react live; a *broad*
> kill-variance hedge (var10-style, ±10 s) is still deliberately not priced, because it drags the tail
> off its clean spot for a sub-cast gain you would never execute. **What does not survive:** anything
> keyed to `KILL_WINDOW`, to the symmetric taper, or to "the model integrates the continuum limit" —
> including the tail-lattice-ripple derivation below, which is now a **historical** result (see its own
> banner).
>
> **Blast radius when it landed:** `plan-sweep` moved **11 of 16** cases; `tools/blast-radius.mjs`
> **102 of 285** cells (35.8 %); `tools/self-consistency.mjs` still reads `0.00e+0` over 3000 scorings
> — ⚠ and that zero is *not* proof of a correct lattice: see PHASE13 §2.5, where it held through a
> whole Arcane Blast being banked inside an intermission. The tool's **structural** check is the one
> that catches that class, and it reads 0 violations.

- **Plan for the known kill; react live.** The scorer credits the final partial cast by exactly the
  fraction of it that fits before the kill, so the model accounts for the kill honestly on its own —
  and a cast that *completes* at `T` is paid in **full** (it used to be paid `0.5`). A broad
  kill-time-variance hedge is still not priced: it only drags the tail off its clean spot for a
  sub-cast gain you'd never execute.
  Reacting to an early death (pop cooldowns sooner) is the player's live job. Result: terminal bursts
  align to end **at** the kill (e.g. KT: last IV+Icon at 6:40, ending at 7:00).
> ### ⛔⛔ EVERYTHING FROM HERE TO THE END OF §8 IS **HISTORICAL** (voided 2026-07-27, PHASE12 §9)
>
> The tail-lattice-ripple derivation below rests on **two premises that are both gone**: that the model
> computes the **continuum limit** of the sim's tapered cast sum (it now sums per cast — §6.10), and
> that the model's taper and `--var 0.5` share a **width** `W = 2·KW = 1.0 s` (there is no `KILL_WINDOW`
> in the objective any more — the one-sided credit window is the *cast's own duration*, which varies
> with haste and stacks). ⇒ **`ripple = 1 − W/c` is no longer the model-vs-sim residual**, and no number
> below may be quoted as the current instrument's resolution floor. `tools/ripple-audit.mjs` prices the
> **old** scorer; it is a reader of the archived corpus, not of the shipping model.
>
> **What is kept and why:** every measurement, family split, currency retraction and bootstrap here is
> the append-only record of a closed investigation, and its *lessons* are permanently valid — most of
> all consequences 4/5 ("the deficit hides half the disagreement"; "three currencies gave three
> orderings, so do not target a family") and the ★★★ lesson at the very end (*matching an objective's
> width is not matching the objective — derive the residual*). That lesson now applies to a **new** open
> question — ~~the model hedges the boundary **analytically** (partial credit) while the sim hedges it
> **numerically** (averaging over `T ± 0.5`), and reconciling those two smoothings is open~~
> ✅ **CLOSED 07-27, PHASE13 §2.4:** the sim's window is now DERIVED from the model's
> (`duration = T + d/2, variation = d/2` ⇒ `U[T, T+d]`, the same one-sided window the credit rule is),
> measured 7.8x tighter across a cast boundary. Whatever replaces the floor must still be re-derived
> against the credit rule, not inherited from here.

- **★★★ THE TAIL-LATTICE RIPPLE — the model's integral and the sim's cast count differ by a bounded
  sawtooth, and that difference is a RESOLUTION FLOOR on every cross-val cell** (`tools/lattice-ripple.mjs`).
  ⚠ *Historical — see the banner immediately above; the derivation's premises no longer hold.*
  The sim's expected damage under a uniform kill in `[T−KW, T+KW]` is *exactly*
  `Σ_i dmg_i · clamp((T + KW − tc_i)/W, 0, 1)` with `W = 2·KW = 1.0 s`; the model computed its
  **continuum limit** (the rate integral). The taper **width** matched
  (the then-current `KILL_WINDOW = 0.5` ≡ xval's `--var 0.5`); the **kind** did not — and sum-vs-integral
  was the *entire* residual. Its peak-to-peak, derived and verified numerically to 4 decimals, is
  > **`ripple = 1 − W/c` casts**, where `c` = the **tail** cast period.
  **Exactly 0 at the GCD floor** (`c = W = 1.0 s`, where the taper spans a whole cast period and smears the
  lattice perfectly) and growing as the tail slows: `c=1.023 → 0.0225` · `1.219 → 0.1796` ·
  `1.463 → 0.3164` · `1.600 → 0.3750` casts. A **fixed** number of casts over a fight of `N` casts ⇒ the
  **percentage scales as 1/N**, so the artifact is **low-haste-only and short-fight-only** — exactly the
  signature of the acceptance test's residual deficit family. Two consequences:
  1. **A cell can show a real sim deficit with a flawless model.** Demonstrated on the round-5 worst non-KT
     cell (§ ACCEPTANCE): the disputed 0.36 % is *which side of the kill window the last cast falls on*.
  2. **`diagWorst` is positively biased by construction** — it is a `max` over ~10 rival rows of a
     *two-signed* ripple, each row carrying an independent tail phase, so its expectation is **positive even
     for a perfect model**: Monte-Carlo (20k, seeded) gives `+0.037/+0.065 %` at R=1 and `+0.094/+0.165 %`
     at R=10 (at `c=1.219 / 1.463`, n=81 casts). ⇒ On short/low-haste tables at this taper width,
     *"no length-persistent diagonal deficit"* **is not reachable by construction**, and a residual below the
     ripple floor is not evidence of a model defect.
  3. **Priced across the WHOLE corpus, it accounts for 80 % of the acceptance failure — and proves a
     SECOND mechanism exists** (`tools/ripple-audit.mjs`, all 135 round-5 deficit columns, 07-25). Every
     column was already measured at `--var 0.5`, so the floor is pure arithmetic on the model's own cast
     list — no sim needed: `ripplePct = 100·(1 − W/c)/Nt`, with `c` = the **kill-edge** period (`last.interval`
     — *not* a min/mean over the last few casts: the taper is only 1.0 s wide, so only casts completing in
     `[T−0.5, T+0.5]` can contribute) and `Nt = robust/dmg_tail` (the fight total in **tail-cast
     equivalents**, since the tail cast is unbuffed and a raw cast count would overstate the floor).
     Result: **97/121 = 80.2 % of decided columns sit INSIDE the floor** (14 INDETERMINATE — verdict flips
     with the ambiguous edge period, held out of both buckets), median deficit **0.035 %** vs median floor
     **0.134 %** = the typical column is **3.8× below the ruler**. Spearman `ρ(floor, deficit) = +0.118`:
     positive, but weak ⇒ the floor is a **ceiling, not an explanation**. Out-of-sample confirmation: the
     worst non-KT cell saturates its own ceiling to **0.002 pp** (`isc+skull short T=99 @40`: deficit
     0.362 % vs floor 0.360 %) — a number the closed form was never fitted to. And the bound is **not
     vacuous**: 24 columns EXCEED it, of which **9 are `FLOOR-TAIL` — kill-edge period at/near the GCD
     floor, so the ripple is provably ~0 (exactly 0.000 % for three of them)**. That family's shape is the
     **mirror image** of the ripple-explained one — sim-haste median **240** (min 70), T median **395**
     (min 218), versus **110 / 218** for the explained cells. **One mechanism cannot be behind both.**
  4. **★★★ MEASURE THE DISAGREEMENT IN THE JOINT CURRENCY, NOT THE SIM DEFICIT — the deficit hides half of
     it and MIS-RANKS the targets** (`tools/ambient-gap.mjs`, 07-25). A cross-val column reports one number,
     `pct` = how much the rival beat the model's pick *in the sim*. But the model also had an opinion, by
     `dModel` = how much it preferred its own pick, re-scored at the **common** haste. The two rankings are
     apart by the **sum**, and that sum — `joint = dModel + pct` — is what a fix has to close. It changes the
     answer: ranked by `pct` the over-floor families put **FLOOR-TAIL first**; ranked by `joint` it comes
     **last of the four** — `inside` **0.081 pp** · FLOOR-TAIL **0.106 (1.30×)** · KT-AoE **0.236 (2.90×)** ·
     SATURATED **0.268 (3.29×)** · RESIDUAL **0.274 (3.37×)**. FLOOR-TAIL looked sharp only because its own
     ripple floor is ~0.022 pp, **6× below `inside`'s 0.139** — no ruler was covering an otherwise ordinary
     gap. ⇒ **A target list built on the masked quantity is a mis-ordered target list.** Corollary: the
     ambient `joint` of ~0.08 pp is mostly `dModel` — measured directly, the **median `dModel` inside the
     floor is 0.040 pp**, i.e. the model is routinely ~0.04 pp more confident than the sim confirms,
     *everywhere*. ⚠ An earlier version of this line said **~0.06 pp**, obtained by subtracting `inside`'s
     median `pct` (0.025) from its median `joint` (0.081): **medians do not subtract.** Corrected 07-25 by
     measuring the term itself. See also RULES §2 — the floor's *location* is sim-certified to one rating
     point, so a floored cell's residual was never likely to be the haste formula.
     ⚠ **This consequence's *ranking* is superseded by consequence 5** — `joint` is itself a defective
     currency, and no family ordering from this corpus survives. What stands here is that `pct` alone hides
     half the disagreement, and that FLOOR-TAIL's #1-by-`pct` was a small-ceiling artifact.
  5. **★★★ DO NOT TARGET A FAMILY — THREE CURRENCIES GAVE THREE ORDERINGS, AND THE CORPUS CANNOT RANK THEM
     AT ALL** (`tools/unexplained-gap.mjs`, 07-25). Consequence 4's `joint` adds an **unbounded** term
     (`dModel` is model-vs-model — no sim, so no lattice and no artifact budget) to a **bounded** one (`pct`,
     capped by `ripplePct`), and family ceilings differ **9×** (FLOOR-TAIL 0.022 pp vs SATURATED 0.189), so a
     cross-family `joint` comparison largely compares **ceilings**. Subtract the budget from the term that
     *has* one: `unexplained = dModel + max(0, pct − ripplePct)` — a lower bound on the model's valuation
     error. The ordering then changes for the **third** time (medians, pp; bootstrap = P(this family is worst)):

     | family | by `pct` | by `joint` | by `unexplained` | P(worst) |
     |---|---|---|---|---|
     | RESIDUAL | 1st (0.260) | 1st (0.274) | 3rd (0.105) | 15.5 % |
     | KT-AoE | 2nd (0.210) | 3rd (0.236) | **1st (0.159)** | 60.8 % |
     | SATURATED | 3rd (0.193) | 2nd (0.268) | **last (0.037)** | 9.2 % |
     | FLOOR-TAIL | 4th (0.074) | 4th (0.106) | 2nd (0.105) | 14.5 % |
     **Not one family holds its rank.** A seeded 20 000-resample bootstrap of the 135 columns settles why: the
     nominal worst tops only **60.8 %** of resamples and three of four families each take first place a
     non-trivial share of the time. ⇒ **the ~0.1 pp between-family differences are the same size as the
     instrument's own per-cell ceiling (corpus median 0.134 pp), so no currency could have ranked them** — the
     instrument-dependence is a property of the **data**, not of the formulas. Two claims this retracts:
     **SATURATED is VINDICATED** (0.037 pp = **0.92× ambient**, mean rank 4.03 of 5 — the *least* anomalous
     family; `joint` flattered its defect precisely because SATURATED is *defined* by having its `pct` nearly
     covered by its own large ceiling), and **FLOOR-TAIL's "least anomalous of the four" is withdrawn as a
     superlative** — it returns to 2nd at 2.63× ambient once its near-zero ceiling excuses none of its
     deficit. What stands is the *measurement* (its ceiling is 6× below `inside`'s), never a rank.
     ⇒ **Aggregate re-ranking of this corpus is exhausted. Target a cell with a fresh sim, or get more
     columns — do not invent a fourth currency.**
  6. **★★★ THE CORPUS IS TWO INSTRUMENTS, AND THE BOSS ONE HAS A ±0.13 pp CHANNEL THAT WAS NEVER PRICED —
     SO 6 OF THE 9 BOSS DEFICITS ARE NOT DEFICITS** (`tools/cell-band.mjs`, 07-25; PHASE7 §5.17). Measured,
     on the top over-floor cell, by replaying it across independent sim seeds and across a **nested deepening
     of the wall-jitter wash**:
     - **Seed noise is negligible — 0.006 pp** (5 far seeds, sd 0.0058, 95 % ±0.0052, sign 5/5). That is
       **60×** below the cell's deficit and **23×** below the corpus median ceiling. ⇒ `xval.mjs`'s
       single-seed design is **VINDICATED for count-preserving cells**; the absent seed error bar costs ~0.
       (Count-**changing** pairs desync CRN and are not covered by this.)
     - **Wall-parity noise is NOT negligible — the per-variant sd is 0.1427 pp**, so at `xval.mjs`'s
       **N=5** wall-jitter variants every **boss** cell carries a standard error of **±0.0638 pp (95 %:
       ±0.1251)** — **12× the seed band** and the same size as boss cells' median ripple ceiling (0.1024).
       `ripplePct` prices **one** wall (the tail); a boss cell has **seven**, six interior and unpriced. A
       **class** cell genuinely has one — `downtime`/`aoeWins` are populated **only inside `if (BOSS)`**
       (`xval.mjs:139-163`) — so class floors are complete and their 15 over-floor cells stand.
       ⇒ **the boss over-floor family is 3 cells, not 9** (all `isc+scb / KT / T=420`, at sim-haste 95/195/245).
     - **Deeper washing does not dissolve the survivor.** Prefix means at N=1/3/5/9/17/25/33 =
       0.632/0.407/0.363/0.334/0.374/0.374/0.365 — flat after N=5, with the tail-only ceiling **11 SEM**
       away. **The wash is saturated in the MEAN and under-sampled only in the VARIANCE.**
     - **The variant spread is BIMODAL, and the mode gap is exactly one cast** (LOW n=26 → +0.293 pp; HIGH
       n=7 → +0.634 pp; separation **3375 damage**). That is PHASE8's FLOOR LAW showing up on a boss shape as
       a **discrete parity mode**, not as smooth noise — and it is a **variance** channel, not a cause: the
       parity-free LOW mode alone is **3.4× the cell's ceiling**. `pct` sign held **33/33** geometries.
     - **⚠ `xval.mjs` gives the UN-jittered geometry 20 % weight.** `VARIANTS[0]` is δ=0 by construction, and
       at this cell v0 sits in the HIGH parity mode — so the corpus cell reads **0.3627 where the same
       5-variant draw without v0 reads 0.2953** (+0.067 pp of bias from one hardcoded vector). Variant 0 gets
       a fifth of the weight on precisely the geometry the wash exists to smear. Recorded, **not** acted on:
       changing it moves every boss cell in the committed corpus.
     - **Deepen a wash with MORE VARIANTS, never a wider δ.** KT's walls 94 and 105 are 11 s apart, so
       `2·WJ ≥ 11` can reorder them and sim a geometrically impossible fight (`cell-band.mjs` guards this).
  This is the **tail** face of the same integer-vs-continuum law whose **interior-boundary** face is PHASE8's
  FLOOR LAW (a value window covers exactly `floor(D/Δ)` casts in the sim).
  **⚠ The fix is NOT to discretize the scorer.** Swapping the integral for the sim's own sum flips the
  disputed cell toward the sim (−0.0062 % → +0.6046 % vs the sim's +0.3617 %) — and is a **worse predictor
  across the whole 11-row column** (`r = 0.7910` / RMSE 0.2948 vs the integral's `r = 0.9337` / RMSE 0.2431),
  with large two-signed errors (+0.669, +0.469, −0.241 pp). Discretization adds **variance**; it does not
  remove **bias**. That independently re-derives `index.html:875-877`: a per-cast sum **was** the old model
  and its quantization produced the phantom "press 2 s before Lust" gains. The integral stays.
- **Where Cold Snap's extra IV goes — COUNT-maximal chain first, then flux** *(mapped with the certified
  tool across T=100–430, Lust@5)*. The mechanics that make this dangerous to over-generalize
  (user-flagged): **the CS-IV press RESTARTS the 180s cadence from wherever it lands**, so the whole
  subsequent chain shifts with it — uses run `0, t_CS, t_CS+180, t_CS+360…`. The achievable count is a
  property of the entire chain geometry, not a local check: the maximum-count chain on a long fight can
  FORCE CS early (the minimum span for n uses with CS is `20 + (n−2)·180`, i.e. CS at prev+20 compressing
  the chain — 4 uses need ≥380s). So the hierarchy is:
  1. **Choose among count-MAXIMAL chains only — as the DEFAULT, not an absolute** (user-flagged). The
     count-vs-alignment trade is priced by the count itself: a naked extra window is worth ~2.7 casts at
     0 gear, which dwarfs flux fractions — but that value DECAYS with passive haste (a bare IV window's
     marginal casts shrink toward the §16 394 cap), so at high gear, forfeiting a weak naked third use
     for a well-aligned second can win. E.g. on a 3:40 fight the chains 0/20(CS)/200, 0/180/200(CS), and
     the 2-use 60/120(CS) sacrifice are all candidates — the model prices them per fight and gear (§4's
     align-vs-twice breakpoint generalized); the `polish` drop-and-relocate move expresses the sacrifice.
  2. **Within the count-maximal chains, chase flux**: the CS-IV rides whichever damage window the natural
     cadence leaves uncovered — the second Icon+gem cluster at its exact tick (T=180/340: CS-IV@126 =
     Icon's 6+120), the Lust tail (T=260: CS at the 120-cluster would push the third IV past the kill, so
     CS takes the Lust tail and all three survive), or the kill-anchored terminal cluster.
  Order of the composition: use-count (§4 align-vs-twice) → flux (§1) → premium bands (§7).
- **Cold Snap** = "**once per fight, one Icy Veins ignores its cooldown**." Mechanically it resets IV's
  480s cd, but the simplest correct model is: exactly one extra IV per fight, and because there's no way
  to reset again, the *cheated* IV must be the one that skips the cooldown (schedule the cheat **before**
  the extra IV). It's the only way two IVs sit <180s apart. A clipped final IV (back up before the boss
  dies) is free damage and is pressed.
- **Materiality has two regimes — "adds a use" vs "just repositions" (sim-verified this project).** When
  Cold Snap lets you fit an **extra** IV (more IVs than the fight fits on natural cd), burning it must
  beat the best natural-cd plan by ≥ ~one effective cast, else hold it (the extra IV is the scarce thing
  you're spending on). But when the fight fits the **same** number of IVs either way, Cold Snap adds no
  scarce use — it only **repositions** the IVs you already have — so it's **free**, gated by nothing more
  than a sub-cast sliver. Two free-reposition wins the full-cast bar used to veto:
  - **3:20 opener (+3.6):** the natural plan triple-stacks IV+Zerk over the +50% floor at the pull
    (×1.72). Spending the free CS frees IV1 off 0:00 so the opener **sequences into Lust** — `Zerk@0:05`
    inside Lust (unfloored ×1.43), `IV@0:15` after it, `CS→IV2@3:00` — same 2-IV count as natural, but
    the haste no longer overcaps the floor (wowsims var10 2654.7 vs 2651.1, var0 +10.7, seeds 11/19).
  - **5:00 spread (+2.4):** see §11 — the free CS's IV rides the 4:05 burst while the banked IV spreads
    to its 3:05 natural tick.
- **"Adds a use" is measured by VALUE, not by IV count (this session — the high-gear-haste fix).** The two
  regimes are distinguished by *how much the extra IV is worth*, not just whether the count rose. At high
  gear haste the CS-champion can carry an **incidental** extra IV parked on the near-floored Lust window
  (worth ~0 — the window is already at the GCD floor, §5), while CS's *real* job is to slide a **different**
  IV fully OFF Lust so the damage cluster keeps Lust's fast casts. Counting IVs mis-reads that as
  "adds a use" → applies the full-cast bar → vetoes the whole layout back to the glued no-CS plan (cluster
  dragged off Lust). Fix: trim the champion to the no-CS IV count by dropping its **least-valuable** IV; if
  that costs **< one cast**, the extra IV is incidental and CS is really **repositioning** — the sub-cast
  regime — so keep it. **h200 4:00 opener:** 3-IV CS champ (476318) vs glued no-CS (475101); the extra IV
  on floored Lust is worth ~+44, so the +1173 is repositioning → keep cluster-on-Lust. **Sim-verified
  +53 DPS var0 / +55 var10** (h200, 250k) — both variances agree. Exact-match 23/23 (h0 goldens unaffected:
  there the exit layout doesn't win, so the trim never fires). This is what makes RULES §5 work at *every*
  gear-haste level, not just where the exit IV happens to land ≥180s from the terminal.

## 11. Overlap is interval CONTAINMENT, not start-coincidence (placement) *(sim-verified this project)*

Two buffs fully overlap whenever the shorter's window is **contained** in the longer's — which holds for
a whole **range** of start-seconds, not one. So many placements are **DPS-equivalent**, and the planner
must pick the **consistent** member of that equivalence class, not an arbitrary one (a consequence of the
scoring law §1 — joint value depends on window **intersection**, MECHANICS §5 pt 5; this used to be
attributed to "the cast-rate integral" — which ⛔ is NOT retired; it ranks again since §8h (07-30). The consequence is identical under the
per-cast sum). Two concrete
forms, both sim-verified:
- **Position-independent haste spreads to natural cd ticks.** A haste buff whose window overlaps **no**
  damage/SP buff is position-independent (§3): it banks the same fractional casts wherever it sits, so
  parking it late past a free natural cd tick is an arbitrary member of a tie. Slide such a **lone** use
  back onto its earliest natural tick; leave the uses that ride a damage burst pinned (moving those off
  the burst *changes* the overlap — a different quality). **5:00:** the free Cold-Snap IV banked at 4:25
  (lone, right after the 4:05 burst-IV) spreads to its **3:05 natural tick**, which re-homes the
  burst-IV assignment onto **4:05** — model tie, wowsims **+2.4** (var10 2627.5 vs 2625.1; var0 +11.6;
  seeds 11/19). The naive spreads *lose* ~8 DPS (`[5,185,205]`/`[5,185,265]` leave the 4:05 burst with
  **no** IV) — the burst must keep its IV; only the **lone** IV moves.
- **Damage/SP cluster inside a longer haste span is a tie across its containment range.** A 20s Icon over
  a 40s IV+CS→IV span scores the same wherever it starts inside it (**4:00 W4: 3:20 == 3:25**, exact sim
  tie 2693.2). Canonical member by priority: **co-press a haste anchor → natural cd tick → earliest**
  (4:00 already emits 3:25, co-pressing CS→IV+Berserking — so it's untouched). A deliberate stagger that
  sits **outside** the containment range (the KT Icon-onto-AP slide ~20s off Lust, §6) genuinely changes
  overlap and stays.

The through-line: **duration is a factor; "aligned" ≠ "same start-second."** With 3+ buffs of differing
durations the contained region shrinks to the **intersection** of the constraints, but the rule holds.

## 9. Intermissions & AoE

> ### ★★★★ TWO AoE FACTS DERIVED 2026-07-30, and the second corrects a standing claim
> **(a) At 3 stacks an AoE phase changes only the DAMAGE, never the RATE.** Arcane Explosion is instant,
> so its interval is the bare GCD; Arcane Blast at 3 stacks is `max(msq(1.498/m), gcd)` and the cast
> term can never win — below `m = 1.5` the GCD is larger, above it both sit on the floor. They are
> **identical at every haste**. ⇒ there is no "AoE is more GCD-bound" effect, and no rate-based reason
> to prefer a haste cooldown inside or outside an AoE window.
> **(b) Crit does NOT cancel once an AoE phase exists.** `aoeCritAmp` (Clearcasting → Arcane Potency)
> is crit-dependent and *falls* as base crit rises, so more crit makes an AoE phase **relatively less**
> valuable — AE/AB at N=6 goes 2.6290 → 2.5600 across 0–60 %. ⚠ The SCORE depends on crit; the emitted
> PLAN did not change on the cases tested. Full derivation + gates: `docs/ESTABLISHED-FACTS.md` §9.


- Intermissions score **zero** (boss untargetable — no casts, no damage), but cooldowns and buff
  durations keep ticking, so the planner holds cooldowns to recover across downtime.
- **★★★ A WALL IS A CUT, AND SO IS AN AoE PHASE START — BUT NOT FOR THE SAME REASON. A BURN EDGE IS
  NOT A CUT AT ALL.** The boundary credit `min(1, (nextCut − castStart)/castDuration)` applies at an
  **intermission start** and at an **AoE phase start** exactly as it applies at the fight end, and
  nowhere else. There are **three** kinds of boundary, **two** of them cuts, for **two different
  reasons**, and keeping the reasons apart is the whole rule:

  | boundary | does the cast LAND? | would you CANCEL it? | cut? | the reason |
  |---|---|---|---|---|
  | **intermission start** | **NO** — the boss is untargetable | n/a | ✅ **cut** | **physics** |
  | **AoE phase start** | **YES**, for full Arcane Blast damage | **YES** — adds are up, AE is worth several ABs | ✅ **cut** | **policy** |
  | **burn edge** | yes | **NO** — you keep casting Arcane Blast | ⛔ **not a cut** | a *value* boundary (snapshot rule) |

  **Why the AoE start is a cut, in full (user ruling, 07-27).** The physics first, and it **stands**:
  the boss is **targetable** throughout an AoE phase, and an Arcane Blast started at **59.000** with the
  phase opening at **60.000** completes at **60.498** and **LANDS, for full Arcane Blast damage** —
  1886.4 in the sim, a 25 %-resist roll off a ~2577 typical hit. **This is NOT the intermission case.**
  What makes it a cut is what the **player** does: adds are up, Arcane Explosion is worth several times
  an Arcane Blast, so you **CANCEL** the Blast and start spamming AE. A cancelled cast is worth **zero**.
  And the phase does not arrive on the same second every pull, so with the wall at `W ~ U[W, W+d]` the
  credit `frac` is exactly `P(the wall has not arrived by completion)`: the branch where it arrives first
  is the cancelled cast, and the expectation is `frac × dmg`. **Same one-sided window as the kill and
  the intermission** — one rule, three cuts.
  ⇒ **Because the cast is CANCELLED and not merely re-priced, the AE lattice starts AT THE WALL**, not at
  the Blast's natural end. Verified: a Blast starting **58.998** against a wall at **60.000** is credited
  **66.9 %** = `(60 − 58.998)/1.498`, and the first Arcane Explosion fires at exactly **60.000**.
  Crediting partially *without* truncating would be the worst of both — **paying less and gaining
  nothing**.
  **Contrast, and it is the cleanest way to remember the rule:** at a **burn** edge you keep casting
  Arcane Blast anyway, so **there is nothing to cancel**.

  ⚠ **THIS QUESTION HAS FLIPPED TWICE IN ONE DAY. Do not read the history as noise — the reasoning is
  the payload.**
  1. **Shipped as a cut** (07-27, PHASE12 §9), on the reasoning that *the spell changes there, so the
     cast in flight does not land as what it started as*.
  2. **Removed on PHYSICS**, hours later: the sim measurement above showed the Blast **does** land, so
     that stated reasoning was false and docking the cast looked like paying less than the game pays.
  3. **Restored on POLICY**, same day, by user ruling — with a **different** argument. The cast landing
     was never the question; *what the player would do with it* was.
  ★ **The measurement in step 2 is still TRUE. It is simply not what decides the question.** Physics
  answers *"does the cast land"*; this boundary is settled by *"would you cancel it"*, and **no sim
  measurement can answer that**.

  ⚠⚠ **A DELIBERATE, PRICED DIVERGENCE FROM THE SIM — STANDING AND EXPECTED, NOT A BUG.** wowsims' APL
  has no way to cancel a cast: it will finish the Blast and land it. So `tools/model-audit.mjs` **WILL**
  report a gap at an AoE wall, and any duel across one carries it. **Do not "fix" it back.** It is the
  one place the model deliberately models a **player decision the harness cannot express** — see
  `docs/TOOLING.md` (model-audit) and `docs/PHASE13.md` §1/§2.2.

  ⚠ *(A footnote worth keeping from step 2: the probe that first said the cast did **not** land had a
  regex requiring `Crit|Hit for` while the log read `Hit (25% Resist) for` — the third parse bug of that
  family in one session. TOOLING's log-format list carries it. The corrected probe is what produced the
  1886.4 above.)*
  ⚠⚠ **And Arcane Explosion is INSTANT (`cast = 0`), so its credit is 1, not 0.** A divide-by-zero
  guard returning 0 credited **all 27 AE casts of a Kael'thas plan at exactly nothing** — 368,018
  against 524,173, a **42 % error on the corpus's only AoE fight**. As `dur → 0`,
  `min(1, (cut − t)/dur) → 1`: an instant cast cannot be *partially* interrupted. **Guard against NaN,
  not against the answer.** ⚠ Neither defect was reachable by any existing gate — `self-consistency`
  compares the objective against itself and read `0.00e+0` throughout, and `exact-match` locks in
  whatever the search emits, so both would have become the goldens.
  ⛔ **This fixes a real defect:**
  the old credit test only ever asked `completion <= T`, so a cast completing *inside* an intermission
  was paid in **FULL**. Measured: starts `89.616`, wall at `90`, completes `91.114` — was `2242.1`, now
  `frac 0.2563` / `credited 574.8`. The user's ruling behind it: an intermission does not land on the
  same second every pull, so treating it as exact is the same mistake the symmetric kill window made.
  ⚠ A **BURN edge is NOT a cut** — the cast lands *and you would not cancel it*, so a burn multiplier is
  a **value** question governed by the snapshot rule (haste at cast start, value at cast completion).
  Do not "fix" that by adding burn edges to the cut lattice — and note that the *landing* argument is
  not what excludes it (the AoE start lands too, and is a cut); **"nothing to cancel"** is.
- **Strong default (not an invariant):** a buff window that *begins* inside an intermission usually
  wastes its early seconds, so a press whose window would start in the dead zone *usually* belongs at
  the exit or held to the next real burst — and placement/tie-break passes should be downtime-aware (a
  Cold-Snap IV after an intermission should land on the clean post-ramp burst, not 1s inside the dead
  zone). But it's a default, not a law: pressing a cooldown *earlier* (even into downtime) can win if
  that's the only way to get it **back off cooldown in time** for a bigger later window. The effective-
  AB count decides; don't hardcode "never fire in downtime".
  - **Enforced (the `dodgeDowntime` normalizer, ARCHITECTURE).** The groom loop's downtime-slide runs
    before the Cold-Snap chain and the spread/tick normalizers, so those late passes could still leave a
    press whose window *begins* in a dead zone. A final normalizer slides any such press to the
    intermission **exit** — its dead early seconds score zero wherever it sits, so the slide is
    **model-neutral** and it reads as "press on the pull of the next phase." **4:00 multi-intermission:**
    the Cold-Snap IV at 3:47 (2s inside the [3:28–3:49] dead zone) → **3:49** (wowsims var0 exact wash
    2079.1 = 2079.1; the live window 3:49–4:00 is identical, so DPS-neutral, legibility-positive). This
    is only the "don't *begin* in the dead zone" half of the default. The other half — a press whose
    window opens right at an **exit** should dip a few seconds later onto **already-built AB stacks**
    rather than the ramp (icon@4:00 → 4:05, shifting the terminal cluster 6:00 → 6:05) — is now
    **IMPLEMENTED**: a coherent-cluster carry in the "Let the stacks build" pass (ARCHITECTURE). When
    sliding a damage/SP press off a ramp forces a later same-track use past its cooldown, it carries that
    use's whole **co-pressed damage/SP cluster** (icon+gem+AP move together; the burst's haste, e.g.
    IV@6:00, stays put — haste doesn't ramp). Without the carry `repair()` moved only the cd-bound icon
    and orphaned gem/AP — a split the kill-aware model rejects, which is why the shift never emerged. On
    the **fixed engine** (drop bug patched) Vashj emits **4:05 / 6:05** and it sim-verifies **new ≥ old**
    (245/365 vs 240/360: +0.8 var0 / +0.3 var10, stable across far seeds); only Vashj moves. (Note: the
    once-suspected "Vashj wants 3 icons because an exit icon is worth less" was the **dropped-terminal
    artifact** — the 4-icon plan's *own* 6:00 icon was deleted by the harness, not out-valued; with the
    drop fixed 4 icons beat 3. The 4-icon plan stands; the 4:05/6:05 refinement rides on top of it.)
- **AoE — CRACKED (Phase 5): an AoE phase IS a burn-phase modifier `M(N)` on unchanged interval
  physics, plus two structural corrections (SP dilution; the exit re-ramp).** Method: full-5s-grid
  enumeration (`tools/brute-grid.mjs --aoe`, two fight shapes — AoE overlapping Lust's back half and AoE
  disjoint after Lust — × N∈{2,3,4,6,10} × h∈{0,150,250}) against a **burn ×M(N) control** (`--burn`,
  amp folded); every novel class sim-gated on the fixed rig. Layouts coincide with the control at 21/24
  points; the divergences are exactly the two corrections below. Internal consistency: with no buff
  inside the window the AoE and control fights score **identical to the 3rd decimal** (the M(N) folding
  is exact by construction).
  - **The window's worth is `M(N) = [(392+0.214·sp)·N·amp(N,crit)] / (720+0.714·sp)`** — the per-cast
    AE/AB ratio with the Potency amp folded (at sp 1387 / crit 38: M(2)=0.82, M(3)=1.25, M(4)=1.68,
    M(6)=2.58, M(10)=4.43). The interval side is NOTHING new: AE = `max(1.0, 1.5/m)` = 3-stack AB, so
    every §2/§7 haste band applies unchanged on an AoE window — **sim-verified**: combat-log intervals
    1.25 / 1.136 under IV / IV×Zerk (multiplicative stacking, not additive), IV marginal **+5.66% vs
    model +5.71%**, Zerk stack-beats-spread **+0.24% vs model +0.30%** (var10; at var0 exact fight
    lengths the uniform GCD stream quantizes whole casts and stack==spread ties EXACTLY — an AE-specific
    fixed-length trap, TOOLING).
  - **Placement = the same flux law (§1) with M(N) as the window multiplier.** The damage cluster chases
    the AoE window when `M(N) ×` its cast rate beats the alternative window's flux: co-resident with
    Lust it moves at **M(N) > 1** (N*≈2.5 — N=2 evacuates the window, N=3 moves), against a disjoint h0
    Lust at **M(N) > 1.30** (N*≈3.2 — N=3 stays, N=4 moves). Below threshold a weak AoE (N=2, M=0.82) is
    a **dead zone the burst dodges** (the plain-fight layout squeezed into the non-AoE time). Both
    thresholds were predicted from flux BEFORE enumerating; the N=3 grid runs confirmed both directions.
    ★ **An AoE phase is a CONSTRAINT you declare, never an election the planner makes** — so below the
    crossover (`M(1) = 0.40`, `M(2) = 0.82` at sp 1387 / crit 38) a declared phase scores **strictly
    worse than not declaring one**, and that is the model correctly pricing the cost of the constraint.
    ⚠ **The Tirisfal 2pc lifts Arcane Blast by +20 % and Arcane Explosion by nothing** (`index.html`
    `:1475`, `isAoe ? 0 : t5add`), so switching it on divides the whole `M` column by 1.2 —
    `0.34 / 0.68 / 1.04 / 1.40` — which leaves the crossover in the same bracket but puts **N = 3 within
    4 % of a wash**. Read that as: the set bonus makes marginal AoE meaningfully worse, and N = 3 stops
    being a comfortable call. ⛔ Do
    **not** "fix" it with a per-cast `max(AE, AB)`: it would overrule what the user typed and delete the
    dead-zone dodge these very thresholds are built on. Gated: `law-check` §9c pins both the crossover
    bracket and the forced-stream semantics. Full disposition in MODEL-DEFECTS "Not defects".
    **Sim gate** (count-preserving cluster A/Bs, 100k, var0 AND var10 agree): cluster marginal on the
    N-target stream vs the Lust'd AB stream = **0.85 / 1.15 / 1.77** at N=3/4/6 — the sign flips exactly
    at the predicted threshold.
  - **Correction 1 — SP buffs lag one N-step.** Icon/gem price the window at the DILUTED
    `M_sp(N) = (0.214/0.714)·N·amp ≈ 0.30·N·amp` (AE's per-target SP coefficient vs AB's 0.714), not
    M(N). At N=4 h0 Icon's AoE value ties floored-Lust to the 4th decimal (0.0648 vs 0.0647 AB/s) and
    the exact grid winner is a **bridge** (Icon straddling the Lust→AoE boundary); from N=6 it follows
    the cluster cleanly. The burn control glues Icon to the window at N=4 — this is the main placement
    divergence from a pure modifier, confined to the knife-edge band.
  - **Correction 2 — the exit re-ramp.** An AoE run ≥ 8s drops the AB debuff, so the seconds after the
    window are ramp-devalued: coverage **retreats into the window** (windows end AT the AoE end, not
    past it — the AoE grid pulls IV/Zerk inward where the burn control keeps them straddling out).
    Sim (same-stream CRN, 150k): Icon covering the AoE window exactly beats hanging 5s into the exit
    ramp by **+0.497% vs model +0.501%**. KT's golden already expresses this: its CS-IV@2:05 ends
    exactly at the window end (2:25).
  - **Correction 3 — CONFIRMED (07-25): a press inside an AoE phase FIRES LATE, and a window that ends
    flush with the phase wall LOSES ITS LAST CAST. Never place a value window so that `press + dur`
    lands within ~1 cast-interval of the AoE phase end — sit it a second earlier and it is free.**
    (PHASE7 §5.18; ledger `tools/duel-walk.mjs` — the instrument that produced the 102.6 % closure below,
    rebuilt and committed 07-27 after its scratchpad original was lost; predictive sweep
    `tools/cell-band.mjs`. This was §5.17's
    Correction-3 *candidate*; the "model packs against the window END, sim wants it 10 s earlier" framing
    is **RETIRED** — the model's press-time curve is *flat* across the window interior and spikes only at
    the wall.) The mechanism, on `isc+scb / KT / T=420 / sim@195`, model champion P=130 vs rival P=120:
    - **The AE lattice inside an AoE phase is hard-anchored to the phase START** (first AE at exactly
      `phaseStart`, then `+Δ`, Δ = `max(1.0, 1.5/m)`), and the APL stops casting AE at the phase end.
      A window therefore covers `floor(·)` **lattice points**, not seconds — PHASE8's FLOOR LAW on an
      AoE phase.
      ★ **This is also what the model now does** — the AoE-start cut truncates the straddling Blast and
      restarts the AE lattice **at the wall** (verified: Blast at 58.998, wall at 60.000 → first AE at
      exactly 60.000; see the cut block above). ⚠ **But do not read it as agreement on the straddling
      cast**: the sim has no cancel action, so when a Blast is genuinely in flight across the wall it
      **finishes and lands** before the AE stream begins, while the model pays that Blast only `frac` and
      starts AE at the wall regardless. This measurement was taken where that case did not arise. The
      lattice anchors agree; the **straddling cast is the priced divergence** — PHASE13 §2.2.
    - **A press fires ~0.5–0.6 s after its intent** (cast latency / GCD boundary). Interior slip is
      **self-cancelling** — what the start loses the end regains — but slip at a **hard edge is clamped**.
      Native's AP intent 130 fires **130.58** and runs to **145.58**; the phase ends at **145.00**; the
      lattice point after 144.02 is 145.13, past the wall. Native's 15 s window covers only **14.42 s of
      in-phase lattice** ⇒ **one fewer AE cast**. Borrowed's [120.57, 135.57] is interior and loses
      nothing. **One-sided ⇒ a ranking error.**
    - **Assumption-free ledger** (aura-state walk of both combat logs, damage pooled per state so crit
      cancels): both plans cast **37 AE**; exactly **one** moves from `Icon+IV` (7785) to
      `AP+Gem+Icon+IV` (10780) = **+2995 damage** vs measured **2919 ± 35** ⇒ **102.6 % closure.**
    - **The model's matching artifact:** its score is flat to the decimal for P ∈ {125..129} (correct
      translation invariance) then spikes **+368.4 damage at exactly P = 130 = phaseEnd − dur**. Proven an
      artifact by moving the phase end: at E = 146/147/150 the P129/P130 scores are **bit-equal**; at
      E = 143/144 flush is **−1539.8** worse. It is also non-additive (AP alone −29, Gem alone −68, Zerk
      alone 0, all three **+368**). Model cusp **368** + sim lost cast **2995** = **3363 damage =
      0.347 pp** = exactly the observed sign flip (model prefers native by 0.0536; sim prefers borrowed
      by 0.2930).
    - **Pre-registered predictive sweep, all three falsifiers fail to fire.** Sim pct vs native(130):
      P126 **+0.2926** · P127 **+0.2943** · P128 **+0.3019** · P129 **+0.2960** · P131 **−0.3053** ·
      P132 **−0.4664**. The interior is flat to within 0.0093 pp (< 2 SEM), the 129→130 step is
      **370 SEM** and **98.5 % of exactly one `AP+Gem+Icon+IV` cast**, and all five wall-jitter variants
      put the cliff at the same P (sd 0.0018) ⇒ the snap is **δ-invariant**, as a phase-start-anchored
      lattice requires. **The model's argmax is the sim's argmin of the flat top.**
    - **Consistent with, not contradicting, Correction 2.** C2 ("windows end AT the AoE end, not past
      it") was verified *flush vs 5 s past* and is still right — hanging out is worse. C3 prices the
      **other side** of flush, which C2 never tested: flush itself is one cast short of a second earlier.
      Read together: **end the window inside the phase, one cast-interval clear of the wall.**
    - **Root cause in `index.html`** (two guards, each independently disabling the correct treatment):
      **`:855` `prevCastRamp = !isAoe && …`** switches off the deterministic snap at `:773` — whose own
      comment justifies snapping where "boundaries are sparse and DETERMINISTIC, locked to the ramp
      start, no phase freedom", which is *exactly* an AoE lattice; and **`:820` `cast: 0`** makes `:853`
      yield `prevCastEnd === t`, so `:785`'s expected-slip fallback is unreachable inside AoE. The
      model's cadence is already right (model Δ 1.1128 vs sim 1.1124 s; Zerk boundary 130.59 vs 130.58)
      — the missing piece is the **snap**, not the lattice.
    - **★ FIXED IN THE MODEL (07-25).** Neither guard was touched — flipping `:855`/`:820` would have
      dragged the ramp bookkeeping and the AE step function with it. Instead the event-firing branch
      gained an explicit AoE case, plus a per-segment **anchoring test**: an AoE phase's lattice is
      EXACT iff the phase's first cast boundary *is* the phase start (`aoeExact`), which holds when it
      follows an intermission (`:736` jumps `t` to `seg.end`) or the pull. When exact, a press snaps
      deterministically (`eff = t`, the sparse-boundary case the `:773` comment already argues for);
      when not — an AoE after a **burn** phase inherits the AB stream's arbitrary phase — it falls back
      to the phase-averaged `slip = prevInterval / 2`, the only defensible treatment there. So the fix
      is scoped by the *same* determinism criterion §3b.1 uses, not by segment type alone.
    - **What it bought** (KT/420/haste195, `isc+scb`, Icon held at 125, press-time curve relative to
      P=129; sim column parity-free where marked):

      | P | pre-fix | post-fix | sim |
      |---|---|---|---|
      | 120 | −0.0672 | −0.0728 | −0.0809* |
      | 124 | −0.0156 | −0.0000 | — |
      | 125–129 | 0.0000 | 0.0000 | ~0 |
      | **130** | **+0.0460** ✗ | **−0.0221** ✓ | −0.2960 |
      | 131 | −0.1254 | −0.3112 | −0.6013 |
      | 132 | −0.3765 | −0.4905 | −0.7624 |

      **Every cell moved toward the sim** — this is a mechanism, not a point tune — and the DUEL sign
      flips: `borrowed − native` goes **−0.0536 pp (prefers native, wrong) → +0.0081 pp (prefers
      borrowed)**, matching the sim's **+0.2930**. Magnitudes still undershoot (P130 at 7.5 %, P131 52 %,
      P132 64 % of the sim's), the expected signature of a continuous term approximating a discrete
      reality; the residual is the **known PHASE8 back-edge over-credit** (§3b.3's mechanism note), which
      is exactly the term that is deliberately unimplemented. **Blast radius is provably one preset** —
      KT is the corpus's only case with an `aoe` phase — confirmed by `plan-diff` over the 16 sub-200 s
      cases: `compared=16 changed=0` (IDENTICAL).
    - **★ Gated at the GOLDEN'S OWN config too — and there it is a WASH, not a win.** The table above is
      measured at **haste 195**; the KT golden runs at **haste 0** (`GOLDEN_DEFAULTS`), so those numbers
      do **not** transfer and the landing owed a second duel at the config the golden actually locks.
      The fix moves KT's plan (fire times) `AP 125,385 → 130,381` · `Gem 125,265,385 → 130,260,381` ·
      `Zerk 125,385 → 130,381`; Icon and IV are unchanged, `casts=200` both. Head-to-head, 5 independent
      base seeds × 9 wall-jitter variants, 6000 iter (90 sims):

      | | model | sim |
      |---|---|---|
      | haste **195** (the motivating cell) | ranking error fixed | **+0.2930 pp** |
      | haste **0** (the golden) | **+0.058 pp** (+259.5 robust = +0.116 effective casts) | **−0.0067 pp** ± 0.0047 (95 % on the mean), per-seed [−0.0127, 0.0000], **0/5 seeds positive** |

      So at the golden the sim mildly prefers the **old** layout — resolvably (the paired duel's SEM is
      much tighter than a cell's absolute band) but **physically negligibly**: −0.0067 pp of 2102.9 DPS
      is **−0.14 DPS ≈ 1/75 of one cast**, and ~19× inside the ±0.1251 pp boss-cell band. The model
      over-claims by ~0.065 pp, which is the same **PHASE8 back-edge over-credit** the h195 undershoot
      pointed at. **Verdict: LAND** — a mechanism that flips a real 0.29 pp ranking error where it was
      built, at the cost of a sub-noise trade at one other config, beats leaving a known-wrong term in.
      ⚠ The lesson generalises: **a fix measured at one haste MUST be re-duelled at the config of any
      golden it moves** — the AE lattice pitch Δ = `max(1.0, 1.5/m)` is haste-dependent, so whether a
      window's tail clips the phase wall changes with gear (Δ ≈ 1.11 s at h195-with-IV vs 1.25 s at
      h0-with-IV). Wall-clipping conclusions are **not** haste-portable.
    - ⚠ **Open, deliberately unfixed:** a raid **external** (Lust/PI/Drums) called *inside* an AoE phase
      still takes the `:747`-branch under-slip (`prevCastEnd === t` inside AoE ⇒ no slip at all). No
      corpus case calls one there; fix it if one ever does.
    - Corroboration that the AoE channel and the ±1-cast **parity** channel are separable: ablate the
      window (same presses, walls, geometries, seed) and the two plans are statistically identical
      (**−0.0063 ± 0.0048 pp**) with the residual inside its own ripple ceiling; the parity mode is the
      same 7 of 33 geometries with and without AoE, worth 3375 vs 3428 damage — an ordinary **AB** cast,
      not an AE cast.
    - **Corollary (cluster coherence).** Holding Icon at 125 while the cluster moves to 120 costs
      **0.08 pp** (P120 parity-free +0.2151 vs the +0.29 plateau) — ordinary Correction 1, ~4 casts bought
      without Icon — and P=120 is then the **only** arm where the parity mode fires. Move the SP press
      **with** the damage cluster and it returns to the plateau (+0.2930).
  - **Haste migrates EARLIER than damage.** A bare AoE window is the max-floor-headroom window, so
    leftover haste (IV/Zerk) takes it from **M(N) > 1** even while the damage cluster still holds Lust
    (grid: disjoint shape at N=3 — CS-IV + Zerk on the window, cluster on Lust). §5's "largest buff that
    fits under the cap" law, replayed. **CS-IV chases the AoE window** at every N≥4 (the KT pattern
    reproduced ab initio by the grid).
  - **Double-IV-over-AoE re-certified on the fixed rig** (KT's load-bearing call): the CS-IV over the
    6-target window's back half = **+10.0%** of the whole 40s window (both far seeds; model +9.09%,
    sim ≥ model) ≈ **6.7 plain-AB casts** — a landslide vs ~2.7 for the same IV on single-target. The
    1:45 cluster is the N=6 cluster-threshold case (1.77× the Lust marginal). KT's plan is unchanged
    (exact-match 25/25).
  - **Gear input — Tirisfal 2pc is now a kit toggle (user-directed; `ck-t5` checkbox).** T5-2pc =
    +20% Arcane Blast damage (and +20% AB mana — the chip includes it), so with it on, every threshold
    above shifts ×1.2 (`M_eff = M/1.2`). **Pooling with AP: ADDITIVE — RESOLVED** (user ruling: no
    public 2.4.3 source decides it → trust wowsims; both effects are percent-damage aura modifiers that
    SUM in the client's pool, which is exactly wowsims' implementation). So AB under AP+T5 = ×1.5, AP's
    relative premium on a T5'd AB dilutes to ×1.25 (full ×1.30 on AE — T5 doesn't touch AE). Verified
    behavior: single-target PLANS are stable (identical on the reference fight; the effective count
    honestly drops ~0.9 for the AP dilution), and the N=3 knife-edge still tips (cluster-on-AoE +0.607
    → −0.052 with T5). KT robust either way (M_eff(6) = 2.15, past every band).
  - **Super-linearity — modeled (unchanged).** AoE is super-linear in the sim (**+8.6% per-target at
    6 tgt, crit 38%**, falling as crit rises); talent-isolation pins it **entirely on Clearcasting →
    Arcane Potency** (Arcane Concentration procs **per hit**, so more targets ⇒ more Clearcasting ⇒
    Potency's +30% crit on more casts; gear on-crit SP procs add ~0). Credited via `aoeCritAmp(N,crit)`
    on AoE damage only (~75–80% of measured, conservative; single-target untouched). Crit thus does not
    fully cancel for AoE (MECHANICS §4).

## 10. Determinism / tie-breaks

On genuine ties the planner prefers: completes-before-kill → anchored (pull / raid call / co-press /
buff-ending / cooldown-ready) → joins an existing press row → overlays the most other buff windows →
real expected damage → fewest floored casts → earliest. Leftover pure haste (nothing left to overlay)
goes to the **earliest** efficient (non-floored) second. This makes one setup ⇒ one exact schedule.
Caveat found this project: the tie tolerance is one full cast (`QTOL = castVal`), so a *real* sub-cast
win (e.g. the +8.5 packed KaelThas ≈ 0.6 cast in model currency) sits inside the "tie" band and can
be traded away by aesthetics — packing wins must be **defended** (window-aware eviction/veto passes).

**`slideEarliest` — earliest-possible canonicalization (this project, user-directed).** The search + align
passes could leave a press (or a whole co-pressed burst) LATER than the earliest spot that scores the same
— the opener Icon/AP/Berserking cluster sitting 10s into Lust when the pull ties, a Cold-Snap Icy Veins
parked mid-fight when it ties all the way back to where it first fits. A final normalizer pulls each mobile
press **second** (co-pressed rows move together, and *only* when **every** member can follow — a cd-bound
Cold-Snap IV that can't move keeps its burst intact, no split) as early as it still ties within a hair
(`robust ≥ r0 − 0.5`, sameCounts, no worse clip). Purely model-neutral → the effective-AB count is
unchanged; it just makes the plan "press it at the first moment it's as good." **Gated OFF for
intermission fights:** after a downtime gap the stacks rebuild, so a press pulled to the exit lands on the
RAMP, which the steady-state scorer (§3, the damage integral uses `MAX_STACKS`) calls a tie but the sim
does **not** — Vashj's 4:05/6:05 ramp-aware layout is sim-verified over 4:00/6:00, so those are left to the
ramp-aware search + `dodgeDowntime`. In a plain fight the only ramp is the pull, which is negligible
(§ MECHANICS, ~0 casts) and where pressing everything together is exactly what's wanted. Runs before
`dodgeDowntime`. Moved 7 plain goldens earlier (model-neutral; DPS identical, timings earlier).

**`canonicalWindowOrder` — same-shape fights must render same-shape plans (this project, user-reported).**
The tie-break list above resolves *where* a press goes; it does not resolve the **order of score-tied
blocks inside a raid-called haste window**. After the Phase 7 scorer recalibration some fights emitted
`lone-haste filler → burst cluster → CS chain` while identically-shaped fights emitted
`burst cluster → filler → CS chain`. Both are exact ties — the user confirmed the DPS wash — but the
**inconsistency is the defect**: a planner that renders the same situation two ways can't be read at a
glance. The rule, and the order the engine now always resolves to: **anchor the burst cluster first
inside the window** (the day-1 doctrine — get the damage/SP presses onto the fastest casts), *then* the
lone haste filler, *then* the Cold-Snap chain. Realized by a final canonicalizer at the three
`resolve(...)` sites, gated to `robust ≥ r0 − castVal/1000` — a float-noise epsilon, so it is **exact
ties only** and can never trade a real cast for looks. Two related findings, both dearly bought:
- **It must run LAST, not inside `normalize`.** Inside the hop↔normalize fixpoint the downstream passes
  re-drift the rotated layout and re-converge on the old shape — that placement *lost* 0.0136 casts.
- **The split is load-bearing, the order is not.** On the Hydross case, pushing Berserking outside Lust
  entirely costs a real −0.20 casts; only its position *relative to the cluster* is free.

## 12. Mana & the conserve rotation — the real gearing weights *(sim-computed this project)*

The planner is **infinite-mana / layout-first** by design (§ nothing here changes that — mana never feeds
back into the layout optimizer). But real Arcane play is **mana-bound**: pure AB-spam OOMs hard (420s,
real mana: **945 DPS** vs 2264 infinite). So you **conserve** — AB-spam the burn windows (Lust/cooldowns),
**Frostbolt filler** below a mana threshold, Evocate in the deep — spending the budget *to the margin*.
This is a separate sim **reading** (`tools/genconserve.mjs` + `tests/ep-finite.mjs`), not a tool feature;
it exists to get the **gearing** stat weights the infinite-mana layout EP can't see (`docs/EP.md`).
- **Value of mana ≈ 2.2 dmg/mana** at the conserve margin (the AB-over-Frostbolt substitution: Frostbolt
  is coef 0.814, cost 272, ≈ mana-neutral with JoW+regen, so it fills gaps almost for free). This makes
  the regen stats real: **MP5 ≈ 0.66, Spirit ≈ 0.54** EP (Spirit lifted by Innervate's 5×), while the raw
  **mana pool ≈ 0** (the reservoir cycles; it only scales Mana-Tide/Evocation).
- **Haste is NOT the weak stat for a conserving mage.** The "haste ≈ 0.4–0.6, mana kills it" folklore is
  the **OOM-then-idle** rotation (pure-spam haste EP **0.03**). Because Frostbolt keeps the mage casting,
  haste stays **≈ 0.96** at real mana (vs 1.44 infinite) — it deflates by only ⅓. Cross-validated: the
  conserve rotation and the export's **own native wowsims rotation agree** (0.96 vs 1.00). In **absolute**
  DPS/rating haste is highest on **short** fights (time-limited) — the EP *ratio* only inverts because SP
  scales even harder there. Intermissions push haste down (less casting) and regen up (bank-and-burst).
- **Intellect ≈ co-#1 with SP** (finite ≈ 1.08): throughput (`0.29·SP_EP + 0.317·crit_EP`, Mind Mastery +
  int→crit, validated at infinite mana = 0.56) **plus** its mana value (int→pool + `√int` spirit regen).
- **Real-gearing order: SP ≈ Int > Haste > Crit > MP5 > Spirit ≫ Mana.** Full derivation, the infinite-vs-
  finite table, the analytic cross-check, and the mana-economy the sim models (JoW / Mana Tide / Innervate
  / Vampiric-Touch +250 mp5 / Evocation / gem — **all from wowsims on the real export**, not reimplemented)
  are in `docs/EP.md` + `docs/TOOLING.md`; locked numbers in `tests/finite-weights.json`. **A schedule-only
  conserve APL must include `autocastOtherCooldowns`** or it silently drops Innervate + Mana Tide (−6% DPS,
  starved weights) — see TOOLING ★.

## 13. Raid-haste externals: Drums & Power Infusion *(model sim-source-verified this project)*

The raid-controlled haste calls the mage plans **around** (pinnable; RAID_PINNABLE). Both are haste, both
ride damage bursts for flux (§4/§6), both obey the GCD floor (§2) — but they enter the haste product
differently, and that difference is **source-verified against wowsims**, not assumed:
- **Drums of Battle = +80 haste RATING, 30s, 2-min Tinnitus.** Rating, so it's **additive** into the same
  `(1 + rating/1577)` pool as gear/MQG/Skull — the exact path trust-anchored at h0 (ROADMAP gear-haste).
  It **stacks with everything**. Tinnitus = its own 120s `cd` (spacing enforced by `repair`/`sepFilter`).
- **Power Infusion = ×1.20 haste MULT, 15s — does NOT stack with Bloodlust (BL wins while both up).**
  This is real TBC, confirmed in the wowsims source: BL (`multiplyCastSpeedEffect 1.3`) and PI
  (`multiplyCastSpeedEffect 1.2`) both register in the **same `"MultiplyCastSpeed"` ExclusiveCategory**;
  within a category only the **highest-priority** effect is active (`sim/core/exclusive_effect.go`), so PI
  (1.2) is suppressed whenever BL (1.3) is up and takes over the instant BL ends. **Icy Veins is different**
  — it uses `.AttachMultiplyCastSpeed(1.2)` (a *direct* multiplier, not the exclusive wrapper), so IV
  **does** stack with BL. The model matches exactly: `if (piActive && !blActive) mult *= 1.20`
  (`simulate` ~746/821), IV/Berserking multiply unconditionally. Verified instant-by-instant (PI ⊂ BL adds
  **0**; PI partly past BL gains only the non-overlap tail).
  - **Placement corollaries (enumerated):** PI fully inside Lust loses its ENTIRE value (measured: 2.0
    casts — it is dead, not merely non-stacking), so PI always dodges Lust outright. And PI obeys the §7
    premium law with IV: PI×IV = ×1.44, cap-touch at **~66** rating, stack until **~135**, separate after
    — the same band structure as every other haste pair.
- **Placement is the planner's** (unpinned Drums/PI are scheduled like any cooldown). Confirmed optimal, not
  just legal: at the opener PI@0 rides the AP burst even though its 180cd forces it to overlap BL for a few
  seconds (dropping it loses ~1.6k; the overlap is intrinsic to also catching the next AP burst); when the
  cd allows, PI lands **just after** BL (5:00 case: PI@0:45). Drums rides bursts for flux even when
  near-floored (beats a bare-window Drums), and sequences off the floor at high gear haste. Locked as
  exact-match cases **"3:20 lust 0:05 drums"** and **"3:20 lust 0:05 PI"**. No blind spot is in play on a
  plain single-target fight, so the model's cast-count is the arbiter (MECHANICS §3) — a fresh end-to-end
  APL sim wasn't required to certify these (the physics is anchored by the rating trust-anchor + the PI
  source read above).

## 14. Ashtongue Talisman (passive proc: fold into the haste, don't schedule it) *(decided this project; the leeway-zone UI half is DEAD — see the end of the section)*

The Ashtongue Talisman of Insight (145 haste rating, 5s, ~50% on a spell crit) is modeled as **steady-state
proc-uptime folded into every window's haste** (`simulate` `atiOn`, ~662) — real DPS, in the effective-AB
count and setup comparison. It is **not** given a scheduled press: the scorer averages the proc into a
constant haste bump, so there is nothing to align a press *against* in the model, and you can't pool a proc.
Excluding it from *scoring* was also rejected (biases the effective-AB count + every setup comparison by a
real, always-present contribution).

**What the tool surfaces instead is LEEWAY (user-directed).** Many presses are *freely movable across an
interval for the same effective-AB result* — the position-independent ones (§3): a lone haste/utility press
bounded only by its own cooldown feeding a later use, not riding a damage burst. For those, the timeline
draws a **dotted band over the movable interval — "press anywhere here"** (`leewayZones`, ARCHITECTURE;
computed by scanning the press across its feasible range and taking the maximal contiguous sub-interval whose
robust score ties the champion within `QTOL`). **No proc verdict is computed:** aligning such a press with a
live Ashtongue proc (or any moment the player likes) inside the band is **never anti-synergous** — every
position in the band already scores identically, so overlapping a proc is at worst neutral (a floored proc is
wasted, not a loss) and at best free upside. **This depiction half of the section is DEAD (user decision,
final): the leeway bands and reasoning tags were permanently rejected** — a plateau tie for one press is
conditional on every other press staying put, so "press anywhere here" over-promises; `leewayZones()` is
deleted from `index.html`. The MODELING half above (fold the proc into scored haste, never schedule it)
stands unchanged.

**The haste trend does NOT average the proc in (user-directed).** Because the proc is random, the timeline
curve and the schedule's peak-haste / AB-cast / at-GCD-floor readouts use the **deterministic** haste (gear +
on-use buffs only — `multNoAti`/`capDn`/`castDn` off the cast list, display-only; scoring is unchanged). ATI
shows only via its own uptime lane and a **second GCD-floor line, "cap if Ashtongue"** (§15). It stays folded
into the *scored* effective-AB count exactly as before — this is a display change, not a scoring one.

## 15. Haste breakpoints — the GCD floor and the Frostbolt filler soft cap *(marked on the timeline)*

Haste levels the timeline marks as horizontal reference lines on the (deterministic) haste curve
(informational — none change the score):
- **AB GCD floor = +50% haste** (the orange "GCD cap" line). A 3-stack Arcane Blast is a 1.5s cast; at
  ×1.5 haste it hits the 1.0s GCD floor, so **above +50% extra haste buys no more AB casts** during that
  window (it only helps by riding a damage buff for flux, or below the floor). This is why a haste buff
  stacked onto an already-floored window is worth ~0 (§2, §5, §7).
- **GCD cap if Ashtongue aligns = +50% − 145/15.77 ≈ +40.8%** (the "cap if Ashtongue" line, only when ATI is
  enabled). A live 145-rating proc adds ≈+9.2% haste, so 3-stack AB reaches the 1.0s floor at that much lower
  *base* (deterministic) haste. Between this line and the +50% cap you are floored **only while a proc is
  up**; above +50%, always. Since the curve is now proc-free (§14), this line is how the proc's cap effect is
  shown without smearing its average into the trend.
- **Frostbolt filler soft cap = +25% *passive* haste** (the cyan "4× FB" line, ≈**394 gear rating** =
  25 × 15.77). With Improved Frostbolt 5/5 a Frostbolt is a 2.5s cast; at +25% it casts in **2.0s**, so
  **four Frostbolts exactly fill the 8s Arcane Blast debuff** — the conserve-filler cadence goes from 3
  Frostbolts to 4 between AB refreshes (Arcane's well-known passive-haste soft cap; verified vs Icy-Veins /
  general TBC theory and SOURCES' Frostbolt row). Read your **trough** (no-cooldown, gear-only) haste
  against this line: above it, your filler is a Frostbolt tighter. The planner never casts Frostbolt — this
  is a gearing/conserve reference, consistent with the layout-first, mana-out-of-the-model design.

## 16. Placement structure & the GCD-cap thresholds *(exploration harness, `tools/explore.mjs`)*

`tools/explore.mjs` brute-scores **every** placement of a tiny buff set over a gear-haste sweep (no search
— the winner is exact by construction) and reports where the winning layout flips. Run it to *see* the
rules of §3/§5/§7 fall out, and to flag which winners lean on the ramp-blind assumption (`--sim` cross-checks
those). What it confirms:
- **The decomposition (structure, not a clean separation).** Damage buffs (Icon, AP, gem) have **no haste
  breakpoint** — they always chase the highest-cast-rate window. **Haste buffs carry all the breakpoints**
  (floor-avoidance: leave Lust once stacking overcaps). Verified: in `iv-icon`, Icon is ALWAYS in-Lust
  across the whole sweep; only IV flips.
- **⚠ But SP buffs SHIFT the haste breakpoints — the decomposition is coupled, not independent.** A haste
  buff can be worth **overcapping a little** if doing so speeds an SP/damage buff's window enough that the
  SP payout beats the wasted haste. Measured: adding Arcane Power in-Lust pushed IV's exit-Lust breakpoint
  from **~15 → ~80 rating** (`iv-icon` vs `iv-icon-ap`). So "place haste first, damage greedy after" is a
  *heuristic*, not a proof — the haste placement must account for the SP payout it enables. This coupling is
  the crux of what makes the search (Phase 4·C) non-trivial.
- **The GCD-cap thresholds** (cap = +50% haste, 15.77 rating/%), the meaningful sweep points:
  - **243 rating** — Lust alone caps (`passive·1.30 ≥ 1.50`). Beyond here IV *must* leave Lust (in-Lust IV is
    100% wasted). The actual exit breakpoint is **far earlier** (~15 on the reference gear); 243 is the latest
    it can possibly be.
  - **394 rating** — the IV *window* also caps (`passive·1.20 ≥ 1.50`). Icon becomes **indifferent between the
    Lust window and the IV window** (both capped) — but **not outside both**. IV *outside* Lust still gains
    (it lifts a bare window to the cap); IV is only wasted *inside* Lust. (Also the Frostbolt 4× soft cap, §15.)
  - **789 rating** — passive alone caps (`passive ≥ 1.50`). Everything is floored; all placement is irrelevant
    beyond "use Icon at all." **Sweeping past 789 is useless** — the harness caps there.

**The layout morphology across haste** *(user-predicted, brute-force-mapped: T=80, Lust@20, six tracks,
staged exhaustive enumeration per haste point at coarse + fine resolution; the tool matched the brute
optimum at 17/19 points — the two gaps, h40 −0.033 and h50 −0.019 casts, both sit on the straddle-
transition plateau edge, inside the designed 0.15 pressability slack)*:
- **h0–50: the classic pack.** CS-IV floors Lust's first half, the damage cluster rides it, Zerk
  sequences onto the tail. IV straddles out at 40–50.
- **~55: IV fully exits** (brackets Lust: pre [0,20] + post [60,80]) and **Berserking carries the Lust
  burst window** with the cluster — the user's predicted first transition.
- **~125–225: the PORTABLE BURST WINDOW** (the unpredicted one). Once `IV×Zerk×passive` rivals Lust
  alone, the self-buffs manufacture their own fast window OUTSIDE Lust and the whole damage cluster
  rides it — the fight is fast from 0:10 to 1:00 instead of only inside Lust. Zerk∩Lust = 0: the user's
  predicted second transition, except the damage leaves with it. **Sim-verified at h160: portable beats
  cluster-on-Lust by +1.2% var0 / +0.6% var10** — a real, novel layout class, not a model artifact.
  - **The window is a BRIDGE, and it has a mirror twin (user-constructed, full-grid-certified).** The
    payoff cluster straddles a Lust edge: 10s on the IV×Zerk stack (beats Lust) + the remainder on Lust
    (beats bare IV) — expressible at Lust's FRONT edge (cluster@~5–10 off IV₁+Zerk, then into Lust) or
    its BACK edge (Icon@50, gem/AP@55, IV₂+Zerk@60 — the user's construction). The two are
    second-for-second identical in multiplier profile and TIE EXACTLY in the model at every haste
    (sim: dead tie var0, front +0.1% var10 — the usual banking tilt; press the early one on an
    uncertain kill).
  - **Full-grid certification** (`tools/brute-grid.mjs`: the complete 5s grid, ~7.9M cells/haste, no
    staging — runs in <1 min): at **h220 the bridge twins ARE the exact global optimum** (83.381,
    nothing above them). At **h160 the true optimum hugs the ramp exit** — cluster@5, one more fast
    cast, **+0.026** over both bridges — a placement the staged brute AND the tool both missed (a
    descent valley between 10 and 5; inside the 0.15 pressability slack; CLOSED since by the
    basinHop ramp-exit anchors — the tool now returns 80.659 > the grid's 80.618). Lesson:
    staged/local refinement can sit 0.02–0.03 casts off the enumerated optimum; the full grid is
    cheap at this fight size — use it when exactness matters.
  - **The exhaustive haste ladder (user-directed; `tools/haste-ladder.mjs`).** The full grid
    marched h=0→300 (27 points after bisection), tool-certified at every rung — **zero misses
    beyond the 0.15 slack** (worst: −0.091 at h40, −0.077 at h300, both in straddle/plateau
    bands). The enumerated morphology of the standard kit (T=80, Lust@20; layouts
    [IV, Icon, gem, AP, Zerk]):
    · **h0**: IV brackets the back ([35,55]), cluster on the back bridge (40–45), Zerk@20 in Lust.
    · **~h10**: IV1 jumps to the PULL ([0,45]) — pull + Lust-end bracketing begins.
    · **~h30–70**: IV2 slides 45→55 — the STRADDLE band (the priced soft spot lives here).
    · **~h80–120**: the CLASSIC PACK crystallizes — IV [0,60], cluster+Zerk co-pressed on Lust's
      start (20–25).
    · **~h130–170**: the cluster abandons Lust for the RAMP EXIT (@5) — the h160 discovery is a
      whole band, not a point.
    · **~h180–190**: the BACK BRIDGE (Icon@50, gem/AP@55, Zerk@60 on IV2) — the user's
      construction is the enumerated optimum of this band.
    · **~h200–220**: front-side burst (@10).
    · **~h230+**: the cluster RETURNS to Lust (@20) and **Zerk retires to the pull** (@0) — the
      endgame; stable through h300. (Adjacent bands often tie within ~0.01 casts — the "changes"
      at h120/h260/h270 are plateau wobbles between damage-twins, not new physics; the seven bands
      above are the real structure.)
    **Sim-gated (pre-registered predictions, AP-180 rig, paired seeds, --mana ∞, var0+var10):**
    ramp-hug@h150 model +0.28% → sim var10 **+0.47%**, re-certified Phase 7 at the model-matched
    metric: var0.5 **+0.37%** ≈ the recalibrated model's +0.25 casts (var0 −0.08%, the documented fixed-length
    quantization trap — var10 is the protocol read); back-bridge@h185 model +0.61% → var10
    **+0.69%**; endgame-Zerk-to-pull@h250 model +0.97% → var10 **+0.96%** (agreement to 0.01%).
    All three counterintuitive band claims CONFIRMED. Cautionary tale renewed: the first gate run
    omitted `--mana 100000000` and returned −4% "refutations" — on real mana an 80s h150 full burn
    is dry by 0:25 (34 ABs instead of 64) and the arms OOM differently. The model is layout-first
    by design; sim gates MUST run infinite mana or they measure mana, not layout.
  - **The six-kit law set (all six trinket-pair ladders, step 10 / bisect 5, ~260 rungs —
    adversarially verified against the raw JSONs by an independent agent pass; evidence in
    `tools/ladders/`). Two of the six drafted laws needed surgery — the corrections are the point:**
    · **L1 skeleton (CONFIRMED, strengthened):** from h≥10 in every kit, IV1 sits at exactly 0,
      IV2 is only ever straddle or exit-at-60, and the straddle→exit transition is strictly
      monotone (never returns once exited).
    · **L2 breakpoint ordering (CORRECTED):** IV2 exits Lust at h80 (isc+scb) / h55 (isc+skull,
      isc+mqg) / h20 (scb+skull, scb+mqg) / h15 (skull+mqg). My drafted mechanism ("haste stacked
      on Lust advances the breakpoint") was WRONG — identical-haste kits break at 55 vs 20. The
      data supports a two-factor story: **kits whose SP trinket shares the lockout break far later
      (isc: 80/55/55) than kits whose SP trinket is free or absent (20/20/15)**; on-use haste is
      second-order within each group.
    · **L3 MQG (CONFIRMED, stronger than claimed):** MQG is pressed at **exactly t=0 in every
      recorded co-optimal of every rung** of both MQG kits — not "avoids Lust", but "always the
      pull, period" (the +330 flooring buff takes the ramp and pre-Lust, full stop).
    · **L4 ramp-hug band (REFUTED as universal):** five kits have one; **isc+mqg has none** — and
      the cause is mechanical: MQG@0 holds the lockout, forbidding Icon before t=20, so the
      cluster can never sit on the ramp. Corrected law: every kit EXCEPT those whose SP trinket is
      lockout-bound to a pull-pressed MQG.
    · **L5 endgame (CONFIRMED):** by h240 every kit has Berserking out of the burst (pull or late);
      most kits much earlier (isc+mqg h125, scb+mqg h90). Endpoint is kit-dependent (late vs pull).
    · **L6 lockout (CONFIRMED, exact):** lockout trinket pairs are separated by exactly 20s in
      every co-optimal ever recorded; Serpent-Coil co-presses with its partner at 31–43 of each
      ladder's rungs (it's the no-lockout exception that proves the rule).
    · **Extras the draft missed:** AP rides the SP trinket within 5s at essentially every rung
      (two isc+skull exceptions); ties are pervasive (top-1 claims are really "some co-optimal");
      Skull runs a three-act arc (Lust → pull → late) in all three skull kits; and the tool's
      constant +0.15–0.21 over the grid in three kits proves the **5s grid itself isn't converged
      there** (off-grid presses at t=2–4/59 win) — the tool out-resolves the certifier. All six pairs
    from {Icon, Serpent-Coil, Skull, MQG} — including the shared-lockout pairs — full-grid-bruted
    at h∈{0, 40, 160, 240} (T=80, Lust@20) against the real optimizer: **20/20 PASS, zero misses.**
    Most points are exact grid-matches or tool > grid (up to +0.211 — the 1s search out-resolving
    the 5s grid); the only deficits, **−0.046 (isc+skull) and −0.051 (isc+mqg), both at h40**, sit
    inside the pressability slack and confirm the **h40 straddle-basin band is kit-universal** —
    the known, priced soft spot (an IV part-way into Lust trading overcap for cluster coupling),
    not an Icon+gem quirk. New physics confirmed on the way: MQG (+330) behaves as a *flooring*
    buff like IV (overcaps Lust → exits early); Skull (+175) fits under Lust's cap at low gear
    haste like Berserking (§7 fits-under-the-cap law), then exits at its §17 crossover.
- **~225+ (just before Lust self-floors at 243): the cluster returns to Lust** (its window value catches
  the self-made one as it nears the floor — pure flux, no help needed), Zerk retires to the pull ramp
  (the last uncapped casts), IV keeps bracketing. Every step is the same three laws composing: flux, the
  §7 premium bands, floor-avoidance.

## 17. Shared trinket lockout: SP trinket first, haste trinket second — until the haste trinket exits

Skull of Gul'dan (+175 rating, 20s) and Icon (+155 SP, 20s) share the on-use lockout (`OFF_TRINKETS`):
using one locks the other for the buff's duration, forcing a SEQUENCE on any burst. Enumerated over
gear haste (Lust@0 40s + IV@0, T=60):
- **0–~100 rating: Icon first, Skull second** — the SP trinket takes the FLOORED first half (flux, §1:
  its value scales with cast rate, and haste on an already-floored window would be wasted anyway), the
  haste trinket takes the unfloored second half where its rating still buys casts. The lockout's forced
  ordering happens to be exactly what the physics wants.
- **~100–150: Skull exits Lust** (its +175 rating overcaps Lust's headroom — cap-touch at `242.7 − 175
  ≈ 68` gear rating plus the §7 premium margin) → Icon on Lust, Skull post-Lust.
- **≥~200: Icon drifts to the later Lust half** (both halves near-floored; margins are hair-thin ties).
The general form: **the SP trinket always owns the fastest window; the haste trinket claims the best
window it doesn't overcap, sliding out of Lust as gear grows** — §5's IV rule replayed through a lockout.

---

## 10. ★ THE PARTIAL-CREDIT RULE AND THE EXACT-PRESS RULE ARE ONE CHOICE, NOT TWO

**User observation, 07-31:** *"We previously simulated the casts and credited unfinished casts partially
based on how much of that cast finished. It would essentially be the same thing if we just allowed to
also do that same thing, ie cancel casting and credit partially, to trigger cooldown at exactly the
moment we wanted to… though I think the algebra math of the integral says the same thing well enough."*

⛔ **Read this as a statement about the MODEL, not about play.** It is not a claim that a player cancels
casts to time cooldowns, and the in-game press/fire question is settled elsewhere and repeatedly — do not
re-open it here. The point is about how the tool accounts for **buff overlay**, which is the only thing
the objective is actually measuring.

**The content, and it is a unifying observation worth keeping.** The scorer has two devices that look
independent and are the same modelling choice:

| device | where | what it says |
|---|---|---|
| fractional credit at a cut | `min(1, (nextCut − castStart)/castDuration)` | a cast is not an atom; it is an interval that can be part-counted |
| a window starting at the exact press instant | `scoreStart = geoStart(e)`, pure window geometry (§8l) | a press is not snapped to a lattice point; it is an instant |

Both are the statement **"the model does not resolve sub-cast position — it integrates."** Once the first
is accepted, the second follows for free rather than needing a separate justification, which is exactly
what the user's *"the algebra math of the integral says the same thing well enough"* asserts. It is right.

★ **Why it matters for what this tool is for.** It makes **alignment a continuous cost/benefit**, not a
discrete one: the value of overlapping two windows is `seconds × Δrate × premium` — algebra you can
differentiate — rather than a count of casts gained or lost, which would be a lattice search with
plateaus and cliffs at every cast boundary. That is the whole reason §7a's composition table exists as
closed forms, why §4c's packing law can be stated at all, and why *"A beats B"* is arithmetic.
⛔ **Do not reconcile the two devices by adding machinery** — no cancel mechanic, and no fire-time snap
(the retired approach, CLAUDE.md rule 2). They are not in tension; they are the same premise stated
twice, and each earlier attempt to "fix" one against the other re-introduced the cast lattice into a
ranking objective §8l deliberately made lattice-free.
