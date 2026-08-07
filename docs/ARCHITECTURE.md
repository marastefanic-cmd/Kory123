# ARCHITECTURE.md — `index.html` internals

One self-contained file (**5,726 lines** — re-grepped 07-27 after the EPS landing; the long-standing "~3600" was 38 % low,
and PHASE11 §1.2 F14 records line-number rot as a project-wide class), in **two script blocks**:
`<script id="engine-src">` — the pure, DOM-free **engine + optimizer** (constants →
`optimizeAsync`) — and a second `<script>` with the **DOM/UI**. The engine runs **twice**: on the
page (cheap one-off `simulate()`/`scheduleRows()` for rendering, and the headless test suites
`page.evaluate` it directly) and inside a **Blob Web Worker** built from the engine tag's own
`textContent` (`runOptimize`, in the UI block — the heavy `optimizeAsync` run happens there, so the
main thread never computes; byte-identical code ⇒ byte-identical plans, worker-vs-page verified). A
run already in flight is terminated before a new one starts (no stale-result races); if Worker/Blob
construction ever fails, `runOptimize` falls back to the in-page engine, which stays alive via the
throttled yields. **The search is also parallelized across CPU cores** (`attachPool` / engine-side
`poolInit`/`poolMap`): the page builds `min(8, cores−2)` "pool" workers (dumb polish servers) from
the same engine source and hands the main worker one MessagePort per pool worker; `optimizeAsync`
fans its two dominant costs — the seed polishes and `basinHop`'s teleport evaluations (~93% of a
285s KT run, measured) — across them with a **first-accept-in-iteration-order** reduction that
reproduces the sequential search step for step, so pooled and sequential paths return
**byte-identical plans** (verified; tests run the page's sequential path, `POOL` stays null there).
A **polish-result cache** (`polishCacheFor` — per-cfg WeakMap, keyed by `sigOf(repairedSchedule)`,
shared by both paths) dedupes the repeats: teleports are repaired orchestrator-side (`teleportRep`,
~2µs) so identical legalized candidates — rampant within a sweep and across the fixpoint's rounds —
pay for one polish, not many; polish is pure, so cache hits are bit-equal to recomputation, and
accepted entries are **cloned** before becoming the champion so downstream passes can't mutate the
cache. Measured: KT 285.7s → 201s (pool alone, 2 workers) → **134.4s** (pool + cache).
Nothing runs after the results render — the old post-render "what if the kill runs longer"
re-optimization (aux worker) is REMOVED (user decision: not worth the background CPU). Line
numbers drift as the file is edited — treat them as signposts, re-grep if they're off. Everything
below is in `index.html` unless noted.

> ⚠ **THE LINE NUMBERS IN THIS FILE ARE `~APPROXIMATE` AND THEY DRIFT.** Re-grepped in one pass on
> 2026-07-27; before that pass the optimizer/render half was off by **600–1600 lines** while still
> carrying a "re-grepped" stamp, which is worse than carrying no number. **Search for the SYMBOL, not
> the line** — every anchor below names one. If you re-grep, do the whole file or drop the stamp.

## Constants (`EPS` ~857, `GAME` ~859–877; re-grepped 07-27 after the EPS landing)
`GAME`: `AB {BASE_CAST 2.5, STACK_CAST_REDUCTION 0.334, MAX_STACKS 3, AVG_BASE_DMG 720, COEF 2.5/3.5}`
(⚠ **0.334, not `1/3`** — it was `1/3` until 07-27; wowsims uses `time.Millisecond * -334` and rounds
every cast to the millisecond, so the model does both now — MECHANICS §1.1, PHASE12 §6.14),
`AE {AVG_BASE_DMG 392, COEF 0.214}` (Arcane Explosion, AoE), `GCD_BASE 1.5`, `GCD_FLOOR 1.0`,
`HASTE_RATING_PER_PCT 15.77`, `CRIT_MULT 1.8175`, `COLD_SNAP_CD 480`. `TALENTS {arcaneConcentration 5,
arcanePotency 3}` + `aoeCritAmp(N, crit)` (just after `GAME`): the AoE-only Clearcasting→Arcane Potency
crit amplification (per-hit Arcane Concentration ⇒ target-scaled Potency crit; applied only to AoE
damage in `simulate`, single-target returns 1 — sim-validated, RULES §9). `BUFFS` (~880–892): each buff's
`kind` (`mult` haste-multiplier, `rating` haste-rating, `dmg` damage-mult, `sp` spellpower, `proc`),
`value`, `dur`, `cd`.
⛔ **`KILL_WINDOW = 0.5` is RETIRED FROM THE OBJECTIVE (07-27, PHASE12 §9).** It used to be a module-ish
constant inside `simulate` described here as "half-cast kill smoothing"; the symmetric taper it drove is
gone. A **local `const KW = 0.5`** survives (`~1436`) feeding **only** the `integral` diagnostic's
breakpoints and weights. Nothing that ranks reads it. See the boundary-credit block below.

## `simulate(schedule, cfg, collect)` — the scorer (`simulate` ~960, `simulateRaw` ~978–1650)
Returns `{total, totalEarly, robust, integral, integralTotal, castCount, gcdCappedTime, casts, actEff, dps}`.
⚠ **`total`, `totalEarly` and `robust` are now the SAME NUMBER** — all three accumulate `dmg × frac`
(below). They are kept as three fields, and three accumulators, purely so every existing consumer keeps
reading a field that still exists; do not "simplify" one of them away without auditing the callers.

> ### ★★★★★ THE RATE INTEGRAL RANKS; THE PER-CAST SUM IS REPORTED — ⚠ CORRECTED 07-30 (§8h)
> ⛔⛔ **THIS BLOCK SAID "THE OBJECTIVE IS THE PER-CAST SUM" AND THAT IS OVERTURNED.** Measured against
> `docs/ESTABLISHED-FACTS.md`'s closed forms, the sum ranked *Berserking with nothing up* (0.7250)
> ABOVE *Berserking inside Bloodlust* (0.7203) against laws of 0.667 and 0.867 — a ~0.15-cast
> inversion, because moving a haste window re-prices the whole downstream lattice. The integral hits
> all three law values to four decimals.
> ⇒ **`rankScore()` returns `integral`.** `total`/`totalEarly`/`robust` are still accumulated in the
> board walk, one term per Arcane Blast (`dmg × frac`, `frac` being the boundary credit in the next
> block), on **every** call rather than only when `collect` is set — but they are now the number the UI
> REPORTS, not the number anything ranks on. Both are returned on purpose so the gap stays measurable.
> ★ **And the objective is a PAIR:** integral first (on the IDEAL, unquantised form, separated by float
> discrimination and NOT by `TIE_CASTS`), then the SHAPE decides:
> `snaps → wastedPre → offGrid → invalid → valueSecs → the earliest press vector`
> (`rankPair`/`planBetter`/`planShape`). A search with no tie-break wanders inside a plateau, which is
> what the 07-28 revert punished. Statement of record: **RULES §17**.
> ⚠ Three things about the shape half are easy to get wrong and each cost a red test on 08-05:
>   · `distinct` (fewest press moments) is **ABOLISHED** (§9s) — this line used to name it first.
>     Reinstating it is a measured dead end (§9v): same 16/17, red relocated to T8.
>   · `offGrid`'s lattice is **plan-dependent** (§9w): `shapeCtxOf(cfg, s)` computes the ramp-end anchor
>     at the haste the PLAN actually runs at the pull, because a prepull haste buff really does move a
>     fight's structural seconds.
>   · `valueSecs` counts only `sp`/`dmg` tracks (§9x): value buffs multiply so they want one second,
>     haste buffs must not overlap so counting them pushes the wrong way.
> ★★ And naming the canonical member is not the same as REACHING it — see `plateauCanon` below.
> **Standing gates, no sim:** `node tools/self-consistency.mjs` must read `0.00e+0` **and 0 structural
> violations**; `node tools/law-check.mjs` must reproduce the closed forms and CATCH its `--self-test`.
> ⚠ The first alone is not enough — it compares two accounts that read the same board, and printed a
> clean zero straight through seven defects. **The closed forms are the only thing that leaves the
> model**, and with the simulator retired they are the ONLY scorer check that does.
>
> ⛔ Two approaches that ARE retired — see CLAUDE.md before touching either: **expiring a buff window at
> `press + duration`** (short by the press slip — one whole cast in the measured case) and **the
> symmetric kill taper** (below). ⚠ "Ranking on the rate integral" used to be listed here as a third;
> it is not retired, it is the objective.

> ### ★★★★ BOUNDARY CREDIT — ONE RULE AT EVERY CUT (PHASE12 §9, user rulings 07-27; `~1019–1087` the rule + lattice, `~1320–1362` the credit, `~1391–1400` the AoE truncation; `~839–857` the shared `EPS`)
> ```
> credit = min(1, (nextCut − castStart) / castDuration)      ← multiplies that cast's own value
> ```
> A **cut** is a boundary a cast is not carried across — the fight end `T`, an **intermission start**
> (boss untargetable: the cast **cannot land**) and an **AoE phase start** (it lands, but the player
> **cancels** it to spam Arcane Explosion). **Three boundaries, two cuts, two different reasons: the
> intermission is PHYSICS, the AoE start is POLICY.** ⛔ A **BURN edge is NOT a cut** — the cast lands
> *and you would not cancel it*, so it is a **value** question under the snapshot rule. The predicate is
> `cutsAt(sg)` (`sg.type === "intermission" || sg.type === "aoe"`), deliberately the only thing that
> builds the lattice, and only segment **STARTS** enter it: the *far* edge of an intermission is not a
> cut (no cast can start inside one, so nothing is in flight across it) and neither is an AoE exit (you
> simply resume Arcane Blast, with nothing to cancel).
> ★ **The AoE start truncates as well as credits** (`AOE_CUTS`, `~1400`): because the cast is
> **cancelled** rather than re-priced, the Arcane Explosion lattice restarts **at the wall**, not at the
> Blast's natural end — `prevCastEnd = min(prevCastEnd, cutT); t = cutT`. Verified: a Blast starting
> `58.998` against a wall at `60.000` is credited **66.9 %** = `(60 − 58.998)/1.498` and the first AE
> fires at exactly `60.000`. Crediting partially without truncating would pay less and gain nothing.
> An intermission needs no such branch — the walk jumps over it at the top of the loop.
> ⚠ **The AoE edge flipped TWICE on 07-27** — shipped as a cut, **removed on physics** (the sim showed an
> AB started at 59.000 against an AoE opening at 60.000 completes at 60.498 and **lands** for full AB
> damage), then **restored on policy** by user ruling. The physics measurement is still true and it is
> not what decides it; RULES §9 carries the full reasoning.
> ⚠⚠ **Expected consequence:** wowsims' APL cannot cancel a cast, so any sim comparison would show a
> gap at an AoE wall. That is a priced divergence, not a bug — and with `model-audit` deleted alongside
> the sim, nothing measures it any more (an accepted loss, recorded in CLAUDE.md).
> ⚠⚠ **`dur === 0` ⇒ frac = 1, not 0.** Arcane Explosion is instant; a divide-by-zero guard returning 0
> credited every AE at nothing (Kael'thas 368,018 vs 524,173, a 42 % error). `min(1, (cut−t)/dur) → 1`
> as `dur → 0`. Guard against NaN, not against the answer.
>
> ★ **It is not a smoothing heuristic.** It is algebraically a **one-sided** window whose width is the
> cast's own duration: for a cut `~ U[C, C+W]`, credit `= (C + W − completion)/W`, and `W = duration`
> gives exactly `(C − start)/duration`. It reads *"the fight lasts at least `T`, and at most one more
> cast."* Both forms verified to give `0.730702` on the same cast (PHASE12 §9.2).
>
> ⛔ **What it retired.** The symmetric taper over `[T−KW, T+KW]` paid a cast completing **exactly at T**
> only **0.5**, because a symmetric window says the boss is already dead half the time. Under the ruling
> such a cast earns a **FULL** cast. `total` (hard cut at T — a staircase measured jumping a whole
> ~1.5-cast step as T crossed a completion boundary), `robust` (the taper) and `totalEarly` (banked at
> `T−KW`) collapse into one number because there is nothing left for them to disagree about.
>
> ⛔ **And it subsumed a real defect:** the old credit test only asked `tcC <= cfg.T`, so a cast
> completing *inside an intermission* was paid in **FULL**. Measured case: starts `89.616`, wall at
> `90`, completes `91.114` — was fully credited `2242.1`, now reads `frac 0.2563`, `credited 574.8`.
>
> ### ★★★★ ONE EPSILON, AND EVERY CLOCK COMPARISON IN THE WALK USES IT (`const EPS = 1e-9`, PHASE13 §2.5)
> The walk's clock is a **running float sum** of millisecond-quantized cast intervals, so a boundary the
> fight geometry puts at `90.000` arrives as `89.999999999999972`. Whether a comparison against that
> clock carries an epsilon is therefore **behaviour, not style** — and for a while only some of them did:
> `nextCut` had one and the segment advance did not, so at an intermission wall the walk failed to jump
> while the lattice skipped past — **a whole Arcane Blast banked at `frac = 1.0` completing 1.5 s inside
> an intermission** (0.99 % Lurker / 1.47 % Solarian of fight score). Separately the press loop's
> `e.ts > t` had none, so a press at `184.00` missed the boundary stored as `183.99999999999994` and
> slipped a whole cast — while `sim/planspec.mjs` (`starts[i] >= fire - EPS`) transcribed it to the
> *other* cast, i.e. **the model and its own transcriber disagreed about which cast a buff covered.**
> `EPS` is not a tuned tolerance: wowsims rounds every cast and GCD to the **millisecond**, so nothing
> real hides below ~1e-6 s. The search passes further down keep bare `1e-9` literals on purpose — they
> compare *scores* and *plan times*, not this clock.
>
> **Blast radius when boundary credit landed:** `plan-sweep` moved **11 of 16** cases;
> `tools/blast-radius.mjs` **102 of 285** cells (35.8 %). **When `EPS` landed:** 4 of 16 cases,
> all 4 better under the current scorer, 0 regressions (`search-miss`).
> ⚠ `tools/self-consistency.mjs` read `0.00e+0` through **both** of the epsilon defects — its two checks
> both derive from the same `c.t`, so a defect in *which casts exist* makes them agree. It now carries a
> third, **structural** check (no cast may begin inside an intermission; the credit must not change when
> re-derived at millisecond resolution) plus a wall-on-lattice corpus arm that constructs the
> coincidence rather than waiting for it. That check reads **167 violations** on the pre-fix engine and
> **0** after.
`simulate` is now a **memo wrapper** over `simulateRaw` (the actual scorer): collect=false results
(plain number bags; no caller mutates them — verified) are cached keyed by
`cfgSigOf(cfg) + sigOf(schedule)` (string key, so pool workers hit despite receiving cfg as a
structured clone per job), bounded by a wholesale clear at 120k entries. Purity ⇒ hits are
bit-equal to recomputation; collect=true always computes fresh.
- A discrete cast loop builds the cast list / activation times (does NOT accumulate damage);
  intermissions fast-forward (`t = seg.end`). **Ramp-aware (RULES §3):** stacks open at 0 (no prestack)
  and re-ramp after every ≥8s AB gap (`lastCastStart` + `DEBUFF_DUR`; AE casts neither build nor
  refresh); ramp casts run at true lengths and are recorded to `boardRamp`. **Press-snap:** an
  activation landing mid-ramp-cast fires at that cast's real end (`prevCastRamp`/`prevCastEnd`).
  **Press-execution scoring (RULES §3b, Phase 7):** every activation carries a `scoreStart` alongside
  its fire/display time — a mid-cast steady press slips `+½·prevInterval` (expected wait to the next
  boundary; interior windows invariant, edge-flush windows charged), and an external (BL/PI/Drums —
  aura lands at the call, someone else presses) snaps its scored window to the next board-lattice
  boundary (the in-flight cast keeps its speed). `scanAt`/`bpS`/`rampCastDmg` read `scoreStart`;
  legality/cadence/display keep the fire time.
  ⚠ **`scoreStart` feeds the RANKING integral** (⛔ this said "the retired integral" — the integral ranks again since §8h, 07-30). The objective uses `start = auraAt` — the
  moment the ability truly fires (`max(eff, prevCastEnd)` for a self-press, `eff` for a raid external)
  — and the window runs its FULL duration from there. Expiring from the press instead made every
  mid-cast window short by the slip (PHASE12 §6.11); `tools/window-span.mjs` was the gate — deleted
  with the sim, the rule standing on what it measured.
  ★ **The cooldown CHAIN anchors on the FIRE moment too (PHASE12 §6.14c, 07-27).** `lastFire[key]` (was
  `lastEff`) holds `auraAt` — where the previous use of that cooldown actually went off, i.e. the cast
  boundary the press snapped forward to — because that is when wowsims starts the cooldown. Chaining
  from the *press* let a second use be scheduled earlier than the sim could ever execute it. Measured:
  **HELD press failures 18 → 1 of 196.** For a raid external `auraAt === eff` by construction, so the
  "starts when CALLED" convention is preserved by the same line rather than by a special case.
- **THE OBJECTIVE = the per-cast sum** (in the board walk, above): each cast contributes
  `dmg × frac`, with `frac = min(1, (nextCut(t) − t)/dur)` — the boundary credit block above —
  and `total`/`totalEarly`/`robust` all return exactly that same number.
  ⚠ `frac` is computed **outside** the accumulate guard and recorded on the board **on purpose**: the
  standing gate recomputes the objective independently from `casts[]`, so if the board carried full
  `dmg` while the accumulator applied `frac`, the two accounts would differ by exactly the boundary
  credit and the gate would report a gap that is not a bug. The `dur > 1e-9` guard refuses a degenerate
  zero-length cast rather than emitting `NaN` (a `NaN` reads as "not a regression" in every ranking
  comparison — this repo's worst failure mode).
- **The `casts` board** (`collect` only) carries, per cast: `t, interval, cast, gcd, mult, dmg, stacks,`
  **`frac`, `credited`** `, capped, pUp, ae, multNoAti, capDn, castDn, gcdDn, sp, dmgMult`.
  ★ `dmg` stays the cast's **FULL** damage — it is what the cast is worth, and it is what the deleted
  `tools/model-audit.mjs` compared against the sim's own damage line. `frac` is the boundary credit it earned and
  `credited = dmg × frac` is the product the objective summed. **Anything recomputing the objective
  from this board must use `credited`, not `dmg`.**
- **★ THE RANKING — the cast-rate integral** (this bullet said "RETIRED, kept only as a diagnostic"
  until 08-03, which had been false since §8h on 07-30: `rankScore` reads `simulate().integral`, so
  the integral RANKS and the per-cast sum above is the REPORTED number). It reads `rateAt(t)` =
  `dmg2 / intervalAt(multDn2)` integrated over piecewise-constant breakpoints (buff-window
  `scoreStart` edges, phase edges, T/T+KWD, toll-window and ramp-span edges), integrating straight
  through the ramp at the steady rate with the opener charged as the m-independent toll (`tollWins`,
  §8q/§9a). `scanAt` is the shared deterministic buff-state scan; `intervalAt` applies the **GCD
  floor** `max(cast/m, 1.0)` statelessly, millisecond-quantised (`msqI`; identity under
  `cfg._ideal`, the §9l tie-detection twin). `cfg.boundaryCharge` THROWS (defined against a retired
  arbiter). `rampCastDmg`/`rampCasts` in this region are dead code (filed).
- **The Ashtongue account, both halves (08-03 — ESTABLISHED-FACTS §12, RULES §14):** the WALK carries
  the exact discrete law — `atiHist` (a bounded completion history with per-cast `atiProcQ`, aged by
  counterfactual up-lattice age + `atiDead` intermission time) yields `pUp` per cast, blended into
  `interval`/`tcVal`/`dur` with the floor inside each branch. The INTEGRAND carries the renewal
  steady state (`atiParamsAt` → `P = 1−(1−q)^n`, rate `1/(aP+b(1−P))` in `rateAt`) plus the
  engagement transient AND the window memory threaded through the breakpoint loop (`atiSlice` +
  `atiSt.strata`, 08-04: an age ν advanced in closed form per slice, with state edges folding the
  outgoing attempts into strata that drain out of the 5s window — gaps ride the same list as procless
  strata). Everything is gated on `cfg.enabled.ati` — ati-off paths are byte-identical (plan-diff
  IDENTICAL, 21/21).
  **★ Two corrections landed 08-05 (§10c / ESTABLISHED-FACTS §12.3a), both closed-form:** the decay
  carries `atiCRho` = `ln ρ/(ρ−1)`, the factor that makes `∫₀^K c_ρ·P0·ρ^u du` identically equal the
  attempt SUM `Σ_{k<K} P0·ρ^k` the process actually runs (⚠ a rate device — it exceeds 1 near ν=0, and
  `atiSlice`'s Newton bracket is derived from the segment endpoints rather than assumed `[len/b,
  len/a]` because of it); and **ν no longer nets against the opener toll** — inside a ramp cast ν
  advances at `1/iv` (`nuRate`, its own closed-form slice integral on the linear ν clock), because ν is
  a physical attempt counter and the toll is a *scoring* device spread over an m-independent window.
  Removing the coupling also removed an operator-splitting artifact worth 0.017 casts that made the
  result depend on the slice grid.
- AoE segments: `dmg` uses AE base × `targets` × `aoeCritAmp`, interval = GCD only.

> ### ★★★★ THE FINISHING TAIL IS MONOTONE, AND ITS BUDGET IS A TIE-BREAK (user ruling 07-28)
> `finishLineFloored` (~3700) runs `finishLine` **twice** — once at `QTOL = castVal` (loose: lets a
> pass tunnel through a worse *intermediate* out of a local optimum) and once at `QTOL = castVal/1000`
> (tight: free moves only) — and returns the better, with the **entrant** as a third arm flooring both.
> Ties go to the plan with fewer **press rows** (`pressRows`, distinct `Math.floor(t)` seconds), which
> is the ruling in one line: *damage first, legibility only where damage cannot tell the difference.*
> ⛔ `QTOL` used to be `castVal` — a whole Arcane Blast — spendable by every groom/snap/merge pass on
> "a pressable line", and nothing compared the tail's output to its input, so the losses compounded and
> never came back (the stale high-water mark `val = Math.max(val, pick.v)`). Measured: `1:40` emitted a
> plan 127.2 below one the search had already FOUND.
> ⚠⚠ **The floor must WRAP the call.** The Cold-Snap materiality block `return`s out of `finishLine`
> from inside a callback, so a floor above the final `return` is skipped on exactly the fights whose
> tail rearranges most — measured `3:20 drums` −70.3 when it was inlined.
> ⚠ `castVal`/`TIE_TOL` are hoisted OUT of `finishLine` so the wrapper can name them.
> Blast radius: 11 of 25 plans better, 7 tie, **0 regressions**; legibility −8 press rows / −7 lone
> seconds / +6 clustering; all three recorded witnesses reached. Gates: `tools/search-miss.mjs` (the
> objective) beside `tools/legibility.mjs` (the display) — never one without the other.

## `repair(schedule, cfg)` — feasibility projector (~1661–1740; re-grepped 07-27)
Legalizes any raw schedule: per-track cooldown spacing (`trackRule`), `maxUses` cap, `lastFor = T−1`
cutoff, **Icy Veins + Cold Snap chaining** (~1700–1720 — the only way two IVs sit <180s apart; a use
inside cd is allowed only if Cold Snap is ready, then burns it), and the OFF_TRINKETS shared lockout
(skull/mqg/isc). Called after **every** candidate move — this is what makes "packing would cost a 2nd
use" fail automatically (via `sameCounts`).

## ★★★ `phaseFinish` — the D1 re-rank, and it is the LAST thing that touches a plan (07-28)
Both of `optimizeAsync`'s exits go through `phaseFinish(best, cfg)`. It is a bounded **multi-start
coordinate descent under `phaseScore`** — the per-cast sum averaged over one full lattice period of the
cast stream's phase against the raid's wall clock. Rationale, evidence and limits:
`docs/MODEL-DEFECTS.md` D1 §0 and §8e. In one line: `simulate()` is exact, but the *fight it is handed*
is over-specified — a Bloodlust call is known to the second, and the point ranking returns four
different Berserking placements across one 1.5 s cast interval of that same instruction.

- `phaseScore(s, cfg, N=PHASE_N=12)` — mean of `simulate` over `N` shifts. Engine `t=0` **is** the first
  cast, so "lattice δ later" = every press, pin, segment and `T` moved δ **earlier** (`phaseShift`).
  ⚠ The opposite randomiser — presses against a fixed lattice — is a thing the player controls and
  measures nothing; it scored 0/4 on the ground-truth corpus.
- `phaseRerank(s, cfg)` — **ten move classes**, iterated to a FIXED POINT (24-round runaway cap, not
  a 3-round budget — a cap of 3 was measured short once the structural times went in):
  1. whole-plan slide (±8 s)  2. per-track slide (±8 s)
  3. **co-pressed cluster slide** — tracks grouped by the SECOND they are pressed at, slid per-press
     (MODEL-DEFECTS §8m). Reaches T2/T3, which no single-coordinate step can: every one is downhill
     because it splits the cluster, and AP ×1.30 × the gem's +225 SP is a cross term.
  3c. **abutting-window train slide** — presses grouped by shared window EDGE (one window's end lands
     exactly on another's start), slid per-press (§8s). Reaches T6/T7. The two graphs are kept
     SEPARATE on purpose; merging lets a cluster be swallowed by a train it abuts.
  4. per-press move (±12 s) plus the **structural candidate times** — every window edge, cooldown
     return and raid call already in the plan, which is how a press reaches a time 20-120 s away (§8j).
  3d. **cooldown-chain closure** (§8y, user-ratified 07-31) — a slide whose chain push `repair` itself
     legalizes, accepted only count-preserving. ⛔ Runs LAST of the per-round classes; run earlier it
     rerouted a basin by 0.18 casts (greedy descent is not monotone in its move set).
  5. **band-structure re-anchor** (§9h→§9k) — the whole C/D-family rewrite (value on the call, IV at
     call−g / window end, Berserking on IV's tail), proposed ONLY at the older classes' joint fixed
     point (`!moved`). Reaches T13.
  6. **chain-dragged cluster** (§9o, 08-04) — for a single-press slide whose `repair` closure MOVES
     other presses, offer each co-pressed partner of a dragged press riding the same slide (each
     alone, then all together). Also gated on `!moved`, after class 5, so every cell where its
     candidates are refused is byte-identical by construction. Closes the h400 · 3:00 kit-sweep
     misses: three coordinates coupled through repair legality AND the value cross term at once,
     invisible to 3d (chain, no partner) and to class 3 (cluster, no chain).
  7. **suffix slide** (§9y, 08-05) — for each distinct press SECOND in the plan, slide every press at
     or after it. A strict generalisation of class 1 (the suffix from the earliest press), gated on
     `!moved` and running LAST. Closes the kit matrix's `gem+skull · h200 · 2:40 interm` miss
     (+0.028848 casts): after a phase long enough to drop the AB debuff the fight RE-RAMPS, haste is
     ramp-neutral through it and value does less work, so everything parked on the wall wants to sit
     after the ramp — together. A THIRD coupling: not the cluster's cross term (§8m) and not the
     packing law (§8s). Its three presses share neither a second nor a window edge, so classes 3 and
     3c cannot bring the last one along; every single step is downhill and every pair downhill-or-flat.
  8. **proc-chain re-anchor** (§10d, 08-06) — Ashtongue only, gated on `atiOn && !moved`, LAST. The
     §19 carry-over as a whole-structure proposal: iv#0 on the pinned window's end, iv#1 one window
     plus one proc duration later, value singles and Berserking pressed to END at `e + ATI.dur`.
     Closes a five-coordinate rewrite whose every partial move is downhill (−0.03…−0.64 around a
     +0.010 target). With the proc off it never fires — proc-less cells byte-identical by construction.
  ⚠ **Single-press moves alone are provably not enough**, and neither are single-press plus clusters.
  Three of the project's four largest misses were coupled coordinates that every 1-D and 2-D step
  refused. A candidate `repair` had to relegalize is refused, so a plan is never scored as one layout
  and adopted as another.
- `plateauCanon(s, cfg)` — ★★★ **08-05 (§9u), and it is NOT a descent.** Runs last, on the descent's
  winner, and answers a different question: *which member of this plateau is canonical?* A candidate
  enters its frontier only if its **ideal** score equals the root's to within `ifloor` (float
  discrimination — ⛔ never `TIE_CASTS`, which would re-admit §8w's drift), so it cannot move the score
  at all; within that confinement it runs a **beam** (`CANON_W = 12` wide, `CANON_D = 5` deep, 12 000
  candidates max) over the same move classes above and returns the `planBetter`-best node it saw.
  ⚠ **Why a beam and not another descent.** Measured on T7: the plateau is CONNECTED but not MONOTONE —
  every route from the member the descent reaches to the canonical one passes through a member that is
  shape-WORSE, so a strict-improvement pass is stuck by construction and no neighbourhood size, seed
  class or effort setting can help. (Three attempts that assumed otherwise are recorded and reverted in
  §9u.) Because it is **comparator-monotone** it cannot reroute a basin: a cell whose plateau
  neighbours are all refused comes out byte-identical. Cost: `planBetter` never reads `score`, so the
  filter skips `rankScore`'s PHASE_N samples — one `simulate` per candidate, and the 17-case suite went
  6m → 7m31s.
- `phaseStarts(winner, cfg)` — the point winner plus the same structural seeds the main search uses
  (naive, packed, pin-stacked, kill-anchored). One start left an outlier at 1 of 5 pins.
- `best.val` stays in **point** units so the pooling comparison, `plan-diff` and the UI readout keep
  meaning what they meant; only the *choice* of plan comes from the phase mean.
- Off switch: `cfg.phaseRank === false`. Cost: **+8 %** wall clock (T=180: 13.1 → 14.2 s).
- ⛔ It cannot live in `structuralSnap`: that pass refuses cast-count changes by design and the correct
  move is precisely such a change. It is not in the *search* either — the phase term only decides
  between finalists, so an N× score inside the search buys nothing.

## `optimizeAsync` = cross-haste pooling wrapper over `optimizeCore` (B1 dominance by construction)
`optimizeAsync(cfg, starts, onProgress)` is a thin `async` wrapper (Phase 7): it runs `optimizeCore`
at `cfg.hasteRating`, and — **only when `cfg.poolHastes` is a non-empty array** — forms the fixed
candidate set `C = { champ(h) = optimizeCore(h) : h ∈ poolHastes ∪ {H} }` and returns
`argmax_{P∈C} simulate(P at H).robust`. Because every haste's emitted plan is a member of the *same*
set C, `score(emit(Hj) at H) ≤ max_C at H = emit(H)` — no borrowed-haste plan can out-score the native
(model-side **invariant B1**, ACCEPTANCE). Three correctness rules the implementation MUST keep (each
cost a debugging round): candidates are scored **raw** (never re-polished at H — a re-polished plan is
outside C and leaks the guarantee); pool solves use the **same `starts`** as the base (so `champ(H)` is
one object whether computed as base or as a neighbor); and the baseline is anchored to
`simulate(base.s)` not `base.val` (the Cold-Snap path returns a normalize()-d schedule whose `.val`
predates the normalize). Recursion is guarded by `_noPool` (neighbor solves and the internal no-Cold-
Snap comparison call `optimizeCore` directly). **Default (no `poolHastes`) returns the plain core solve**
— ⚠ *"goldens/UI byte-identical, exact-match 25/25 unchanged"* was true of the pooling wrapper alone and
is **false since 07-28**: both exits now pass through `phaseFinish` above, which moves 13 of 16 swept
plans. Cost = `|poolHastes|`× solves; the caller
picks the grid. The cross-val (`tools/xval.mjs`) computes each `champ(h)` **once** and takes the argmax
per column (identical result, deduplicated — `POOL=0` env restores the raw per-haste search to measure
what pooling fixed). Design validated on committed round-2 data: pooling closes model-side B1 **22→0**.

### `optimizeCore(cfg, starts, onProgress)` — the search (~2016+; re-grepped 07-27)
Multi-start, then a stack of finishing passes run once. Fixed-seed PRNG ⇒ deterministic.
- **The whole finishing stage runs inside an `async` IIFE with throttled yields** (crash fix — on long
  fights it used to block the browser main thread for minutes, tripping the "Page Unresponsive" kill).
  A `tick()` helper (top of the IIFE) yields via `scheduler.yield()`/`MessageChannel` (dodging the 4ms
  nested-`setTimeout` clamp) at most every ~40ms of compute; `breathe()` wraps it with progress-bar
  creep and is awaited at every heavy loop boundary (`challengePass` rounds, groom sweeps, per-use
  scans, `basinHop` teleports, the four normalizers). `performance.now()` gates ONLY when the thread
  yields — no computed value reads it, so one-setup-⇒-one-schedule is untouched. `basinHop`,
  `challengePass`, `coPressAlign`, `spreadLoneHaste`, `slideEarliest`, `dodgeDowntime` are `async` for
  this reason alone; their logic is unchanged.
- **Seeds** (`optimizeAsync` ~2065, seed list ~2089, in this order): all-at-0 (`naiveSchedule`), backward-packed
  (`packedSchedule`), phase-anchored (`seg.start` / intermission `seg.end`, capped at `starts + 8`),
  **pinned-raid-call anchored** (stacks every track on each Lust/Drums/PI second, first 4), a
  **kill-anchored seed** (each track's last use as late as it fully runs, siblings packed backward by
  cd — the terminal-burst basin forward-packing can't reach), then **random fill to `starts`**, then
  **`groupSeeds`** (below) appended as pure EXTRAS past `starts`, tagged from `grpStart`. ⚠ The order
  is load-bearing (PHASE9 §5.16): group seeds used to be pushed *before* the fill and counted toward
  `starts`, silently evicting one random start per chain seed — an additive seed class must never
  remove entrants, and three of round 6's search regressions traced to exactly that.
- **`groupSeeds(cfg)`** (~1134, Phase 9 §5.14 — the RULES §4b **chain law** made reachable): builds
  *chain* entrants — `origin × gap-chain × which long-cd track skips group 1`. Origins are `{0} ∪
  round(fixed press seconds)` (first 3); a chain is a DFS over the **enabled cooldown periods**
  themselves (`5 —+120→ 125 —+180→ 305`), **maximal chains only** (a prefix gives every track strictly
  fewer uses ⇒ dominated), depth ≤ 6, ≤ 24 chains. Each track then presses at every group second it is
  legally up for; Cold Snap grants Icy Veins **one** early repeat inside the chain; the `skip` variants
  let one long-cd track **decline the opening group** to keep its remaining uses stacked (linear in
  tracks, not `2^n`). Deduped by `sigOf` after `repair`. **≤ 40 candidates, ~88 ms across all 25 cases**
  — and no score cut: pre-ranking candidates by raw `simulate()` is measurably self-defeating (the
  polish-best sat at raw rank 13/40 and 12/12; a top-3 cut loses 8087.794 corpus-wide). Every other seed
  class places a track on *its own* cadence, so a stacked chain that declines an available use is
  unreachable from all of them — from a non-chain entrant `basinHop` gains **+0.000** even with every
  anchor `0..T−1`.
- **`polish`** hill-climb (~1826, `SHIFTS` ~1825): `SHIFTS` ±1..±90 incl. ±3/±6 (ramp-boundary hops) and ±30/±60,
  per-index + suffix-shift + add-a-use + a **joint window move** (all uses sharing a press second shift
  as one block — co-pressed clusters cross valleys together) + a drop-one/relocate escape.
- **`basinHop`** (~1974, runs after the integer snaps — which snap the top-6 **non-group** results
  exactly as pre-groupSeeds, PLUS any group entrant above that bar, tracked separately as `bestGrp`):
  window-teleport self-consistency guard — re-bases each press-window block on every other window's
  anchor, each track's natural next cd-tick, every **ramp-exit boundary** (the first full-stack cast
  after each cold start, read from the champion's own board — the h160-class descent-valley basin
  sits exactly there, one fast cast off any 5s-grid anchor) + the kill anchor, re-polishes, keeps
  strict improvements, to fixpoint. This is what guarantees "never worse than a plan reachable from
  the search's own anchors" (the Phase-4 misses all fell to it). ★ **Two-arm hop + two-arm TAIL when
  a group entrant snap-leads** (PHASE9 §5.16/§5.17): both arms are hopped, and the whole finishing
  stack below is a callable **`finishLine(entrant)`** run once per arm — the FINAL values decide
  (hop-exit selection measurably loses tails in both directions; a +5.85 hop win's tail lost −14).
  Primary = the old-rule carry, ties keep it; the no-Cold-Snap comparison solve inside the tail is
  arm-independent and memoized (`bestNMemo`), so the second arm costs groom passes, not a full solve.
- Tie-break helpers (local closures): `anchored` ~2266, `overlapOf` ~2282, `joinsRow` ~2295,
  `counts`/`sameCounts` ~2305/2310, `clipOf` ~2317. `castVal`/`QTOL` ~2256/2257 (tie tolerance = one
  cast).
- **`challengePass`** (~2323, called 3×): re-anchors each track's cadence at pull / raid calls /
  phase edges; offers the last use onto other buffs' seconds; IV/Cold-Snap end-chains. Guards robust.
- **Groom loop** ×3 (~1714, with an **early exit** — Phase 9 §5.12: rounds ≥1 are the same
  deterministic function of `s` (each opens with `challengePass()`; only round 0 skips it) and `val` is
  non-decreasing, so a no-op round ⇒ every remaining round is a no-op. `if (groom >= 1 && unchanged)
  break;` — plan-neutral on all 25; −10.1% CPU measured alone, −8.5% netted with `groupSeeds`, §5.14):
  Pass 1 haste-actives local search (±45, `nulled`/floored tie-break,
  ~1215–1280) · Pass 2 damage/SP cluster move (~1286–1401) · Pass 3 ±8 ensemble (~1406–1462) · macro
  snap · legibility merges (has a hard `nulled` veto ~1598) · downtime slide to `seg.end` (~1610).
- **Drop-one-use escape** (after the fixpoint, before the CS gate — Phase 7): offers each single-use
  drop per unfixed track, polishes (survivors re-align), keeps strict improvements, iterates to a
  bounded fixpoint with a re-hop — the RULES §4 align-vs-twice *sacrifice* side (one AP aligned on the
  cluster can beat two spread), unreachable by the count-preserving drop-and-relocate ladder.
- **CS chain-geometry candidates** (inside the Cold-Snap gate — Phase 7): the end-chain offering is
  generalized to the full slot family (CS compressing the pair at each slot j, at both the same count
  and count+1, plus the kill-anchored end pair), and every chain candidate is **polished** (raw chains
  lose without co-adapting the other tracks — probe-proven on the mqg+skull xl end-chain).
- **Finishing passes:** wasted-haste relocation (evicts a marginal-≤`castVal*0.1` haste
  use — the "Berserking-in-Lust eviction") · **ramp-hold / "Let the stacks build"** — slides a
  damage/SP press stuck on the opener or a post-intermission-exit ramp out past the ramp on a model
  tie (RULES §9). *(Since Phase 4·B the scorer prices the ramp itself, so stepping damage off a ramp is
  a strict score win the ordinary passes find on their own — this tie-gated pass is now a mostly-inert
  belt-and-suspenders normalizer.)* Now includes a **coherent-cluster carry**: when that slide forces a *later* same-track
  use past its cooldown, it shifts that use's whole co-pressed damage/SP cluster together (icon+gem+AP
  move; the burst's haste like IV stays put) so the terminal burst doesn't split — this is what lets
  Vashj emit the sim-verified **4:05 / 6:05** layout (before, `repair()` orphaned gem/AP and the model
  rejected the split). · earliest-on-ties (~1786, hard
  `nulled` veto ~1816) · snap-to-pinned (~1832) · **overlap-alignment for damage/SP** (~1861–1904,
  slides a spellpower/damage press forward onto a staggered damage cluster) · **sequential window-
  packing** (~1913, see below) · **`coPressAlign`** (~3296) → **`spreadLoneHaste`** (~3338) → **`dodgeDowntime`** (~3386) (final
  normalizers, applied in that order) · squeak note · Cold-Snap materiality recursion (~2150).
- **`coPressAlign(s0)`** (~2028, applied at the main resolve AND both Cold-Snap resolves so the plan is
  aligned whichever path built it). Snaps a damage/SP press onto its nearest **earlier haste** second
  **within 3s** when the model cost is **≤ `castVal/8`** — pulls a macro'd burst onto one press when the
  model carries only a sub-cast (often artifactual) preference for a 1s-late spot. The 3s window and
  sub-cast cap protect deliberate staggers (3:20 gem 5s off IV; KT Icon-onto-AP ~20s off Lust). See
  `docs/ROADMAP.md` golden-review findings (7:20 W6, sim-gated).
- **`spreadLoneHaste(s0)`** (~2070, the RULES §11 placement normalizer, applied at the same three resolve
  points as `coPressAlign`, right after it). A haste use whose window intersects **no** damage/SP buff is
  a *lone* use — position-independent (MECHANICS §3/§5 pt 5), so banking it late past a free natural cd
  tick is an arbitrary member of a tie. It slides each lone use back onto its **earliest free natural cd
  tick** (`uses[0]+k·cd`), leaving burst-riding uses pinned. Model-neutral gate (`robust ≥ r0−0.5`, an
  exact tie by position-independence) + `sameCounts` + no worse `clipOf`. On **5:00** this pulls the
  Cold-Snap IV banked at 4:25 onto its 3:05 natural tick, re-homing the burst-IV onto 4:05 (sim +2.4).
  Kept separate from `coPressAlign` (different concern: haste→tick spreading vs damage→haste snapping).
- **`dodgeDowntime(s0)`** (~2107, the RULES §9 downtime normalizer, applied outermost at the same three
  resolve points). The groom loop's downtime-slide (~1618) runs before the Cold-Snap chain and the two
  normalizers above, so those late passes can still leave a press whose window *begins* inside an
  intermission. This slides each such press to the intermission **exit** (`seg.end`). Its dead early
  seconds score zero wherever it sits, so a `robust ≥ r0−0.5` + `sameCounts` gate keeps it honest — and
  it deliberately has **no `clipOf` guard** (sliding to the exit ends the window later, so `clipOf` rises,
  but the *live* portion is unchanged — the clip is the wrong metric here). On **4:00 multi-intermission**
  the Cold-Snap IV at 3:47 (2s inside [3:28–3:49]) → 3:49 (var0 exact wash). Only the "don't *begin* in
  downtime" half of RULES §9; the post-ramp-exit devaluation (Vashj) is still open.
- **`slideEarliest(s0)`** (between `spreadLoneHaste` and `dodgeDowntime`, RULES §10): earliest-possible
  canonicalization. Pulls each mobile press **second** (co-pressed rows move together, and only when
  **every** member can follow — a cd-bound Cold-Snap IV that can't move keeps its burst intact, no split)
  as early as it still ties (`robust ≥ r0−0.5`, sameCounts, no worse clip). Model-neutral. **Returns `s0`
  unchanged for intermission fights** (the exit ramp is a scorer blind spot the sim disagrees with — Vashj
  4:05). Fixes the opener cluster sitting off the pull and Cold-Snap IVs parked mid-fight; moved 7 plain
  goldens earlier (same DPS).
- **`canonicalWindowOrder(s0)`** (~2730, the §5.11 legibility canonicalizer — applied at all THREE
  `resolve(...)` sites *after* `normalize`, i.e. it is the LAST thing that touches a plan). Inside each
  **pinned haste window** (a `cfg.fixed` buff of kind `mult`/`rating` — in practice Bloodlust) it groups
  the mage's presses into **blocks** (presses within 3s of each other are one block), finds the **burst
  cluster** (the first block carrying both a damage/SP buff and a haste buff), and — when the only blocks
  ahead of it are **lone-haste fillers** — rotates the arrangement so the **cluster leads** and the
  fillers sequence after it (each filler placed at `cluster.start + leadDur`, then chained by its own
  duration). Same window occupancy, opposite order. Gated hard: `repair`-legal, `sameCounts`, no worse
  `clipOf`, and `robust ≥ r0 − castVal/1000` (≈0.001 casts — a float-noise epsilon, i.e. **exact ties
  only**), so it can never trade DPS for looks.
  - **Why it lives at `resolve`, not inside `normalize`:** placed inside the normalize fixpoint it cost
    **0.0136 effective casts** on Hydross — the downstream passes re-drift the rotated layout and the
    hop↔normalize fixpoint re-converges on the old shape. Run last, Hydross lands on the exact tie
    (`robust=196077.764863`, bit-identical) with the cluster-first reading.
  - **What it fixes (§5.11):** post-recalibration some fights emitted `Zerk@8 → cluster@18 → CS-IV@39`
    while identically-shaped fights emitted `cluster → filler → CS chain`. Both score the same; the
    inconsistency was the bug. Consistency across fights *is* the aesthetic (RULES: anchor the burst
    early, then the lone haste filler, then the Cold-Snap chain).
- **Displayed times are FIRE times, not intents (user-directed — RULES §3).** During the opener cold
  ramp the press boundaries are sparse, so every intent second inside one ramp cast fires at that
  cast's END — a whole band of intents is exactly equivalent, and `slideEarliest` canonicalizes the
  tie to its *earliest* member.
  ⛔ **THE DISPLAY NO LONGER SHOWS FIRE TIMES — user decision 07-30** (*"with our model the trinket and
  the stat changes should apply the moment it's pressed"*). The schedule table, copy-text and
  activation schedule print `a.sec = Math.floor(PRESS time)` via `shownTimes`; `actEff` no longer feeds
  any display. The fire-time convention this paragraph used to describe is what made a press intent of
  0:05 render as "0:06" and visibly split a cluster the optimizer had deliberately co-pressed. It is
  the display catching up with the model: the ranking objective has been pure window geometry over
  PRESS times since §8l, and the cooldown chain it reads has been press-chained since §8r. Scoped to the opener ramp only (post-intermission presses stay on the phase exit,
  `dodgeDowntime`'s legible anchor). Runs OUTSIDE the fixpoint so it can't ping-pong with
  `slideEarliest`.
- **Sequential window-packing** (~1975, the RULES §4/§5 move — LANDED). Runs as the last structural pass
  (nothing after it can re-floor the sequenced tail buff, so no defensive rework of the eviction /
  `nulled` vetoes was needed). For each raid-called **haste** buff (kind `mult`/`rating` — a damage/
  burn anchor doesn't floor, so it's skipped), it assembles the burst at the anchor `A`: the damage
  cluster's nearest use → `A`, and the planner haste buffs on slots whose **origin** is one of three
  **modes** (`~2010`):
  - **`packIn`** — haste sequenced from `A` **into** the window (the usual RULES §4 pack: a flooring buff
    floors the window so the damage cluster rides its fastest casts; tail buffs on the unfloored remainder,
    a buff spilling past the window is dropped).
  - **`exitSeq` / `exitStack`** — haste sequenced from **`A + win`** (just PAST the window), the RULES §5
    "IV slides out of Lust as gear haste grows" layout: once passive rating pushes Lust itself near the GCD
    floor, a haste buff on Lust overcaps (worth ~0) while the damage cluster still wants Lust's fast casts.
    `exitSeq` sequences the exiting haste on the tail (each buff unfloored, but a later cd-tick can clip the
    kill); `exitStack` overlaps them all at the window end (a wash off the floor, RULES §7, but keeps every
    buff's cd-tick as EARLY as possible so a 2nd use survives before the kill — the high-haste opener).
  It sweeps the mode, which *use* of the lead haste buff lands on the origin (front-load vs bank), **and —
  via `permute` (~2010) — the ORDER** the haste buffs sequence. Biggest-first floors `packIn` for the
  damage cluster (the usual best); leading with a **shorter** buff pushes the flooring buff later, keeping
  a tail buff's 2nd cd-tick before the kill — the **3:20** opener (`Zerk@0:05` in Lust, `IV@0:15` after,
  `CS→IV2@3:00`, +3.6) needs the Zerk-lead order. Permutation bounded to ≤4 keys (else biggest-first only).
  Every candidate kept on strict robust gain + `sameCounts` + no worse `clipOf`, so the exit modes are
  **inert at h0** (IV-in-Lust wins → goldens byte-identical) and **self-select above the gear-haste
  breakpoint** (sim-verified +2% at h250; RULES §5). Known residual: a narrow ~h200 band whose exit layout
  needs Cold Snap that `repair()` un-spaces (ROADMAP).
  - **Two anchor bases (`A` and `A2`, ~2490).** The raw window second `A` is not always a legal press
    boundary: during the opener ramp the casts are long, so an `A`-anchored candidate fires off-boundary
    and scores *worse* than the incumbent (Hydross: `A=7` costs −0.09 casts vs the incumbent's snapped
    `8`). The pass therefore also sweeps `A2` = the incumbent's **own** boundary-snapped span start (the
    earliest planner press inside the window), so the packed forms are reachable from geometry the
    engine has already proven legal. Not merely cosmetic: `A2` is a **strict** win on `4:00 lust 0:05`
    (+15.08 damage = +0.0067 effective casts).
  - **Canonical-tie adoption (§5.11, ~2530).** Alongside the strict-gain winner the pass remembers the
    **canonical** packed form (`packIn`, biggest-first) when it lands within `TIE_EPS = castVal/1000` of
    the incumbent. With no strict winner the tie form is adopted, so equal-score fights render the same
    shape. `TIE_EPS` sits far below any deliberate sub-cast preference (the `castVal/8` class) and far
    above float noise — the 3:20 shorter-buff-leads order is a *strict* win and is untouched.
- **Cold-Snap materiality — ⛔ THE GATE IS GONE (user ruling 07-28).** `bar = TIE_TOL`: Cold Snap is
  spent whenever it gains **anything at all**. The user's words: *"There's no reason to not use cold
  snap for an extra IV. The cooldown will be ready for the next boss, always. As long as using Coldsnap
  gains you anything at all, either getting in more Icy veins uptime, or just repositioning it to a
  better spot, it needs to be used."* Cold Snap is not scarce on the timescale that matters — its
  8-minute cooldown outlives the pull and there is nothing after the kill to save it for, so the old
  *"a mid-fight reset must be worth a full cast"* bar was pricing a resource whose only alternative use
  is *never*. It was also the last place the search would knowingly emit a plan it had itself scored
  lower.
  - **What went with it.** Deciding *which* bar applied cost three pieces of machinery, all deleted:
    `endChain` (is the last CS window clipped by the kill), `csAddsUse` (does CS raise the IV **count**),
    and the `bestTrim` loop — a `simulate(repair(…))` **per Icy Veins use**, trimming the champ to the
    no-CS count by dropping its least-valuable IV to ask whether the extra IV was worth a cast on its
    own. That value-not-count refinement was a real fix for a real mis-veto (the ~h200 hold-out, RULES
    §8); one tie tolerance now subsumes the whole question.
  - **Blast radius: 0 better · 1 tie · 0 regressions** over the 25 shipped presets — the bar was never
    binding on this corpus, which is *why* it survived so long. It is removed for correctness, not for
    a number. Sweep cost fell ~6 % (451 s vs 479 s) with the trim loop gone.
  - ⚠ **Cold Snap's own semantics are unchanged and are worth restating**, because they are what makes
    the ruling correct: `repair()` allows an Icy Veins press that lands while IV is on cooldown *if*
    Cold Snap is available, then **restarts the 180 s cadence from that press** — i.e. *"once per fight
    you can activate Icy Veins even if it's on cooldown, but doing so resets its cooldown back to 3
    minutes."* `prevEnd` still forbids overlapping IV windows.

## Inputs → `cfg` (`readCfg`, buff rows)
- **`ck-t5` — Tirisfal 2-piece gear checkbox** → `cfg.t5two`: ×1.2 on Arcane Blast damage only (a `t5`
  factor in `simulate`'s two AB damage sites + both plain-AB normalizations, so single-target output is
  exactly invariant; its whole effect is the AoE exchange rate — RULES §9) and +20% AB mana in the
  per-window chip. Default off; presets don't touch it.
- **Only raid calls are pinnable.** `RAID_PINNABLE = {bloodlust, drums, powerInfusion}` (the "Raid
  externals" group). `buildBuffList` renders a pin control **only** for those keys; every mage-managed
  cooldown (IV / AP / gem / Berserking / Icon / on-use haste trinkets) is the planner's to schedule, so
  it has no pin UI. `readCfg` mirrors the same set — it only reads `state.times[key]` into `cfg.fixed`
  for a `RAID_PINNABLE` key, so a stale mage-cooldown time in a saved/custom preset is ignored. The
  optimizer still treats any `cfg.fixed[key]` as an immovable anchor (unchanged), and presets only ever
  pin `bloodlust`, so goldens are untouched.
- **Trinkets are listed in content order, under tier headers.** `TRINKET_TIERS` (next to `BUFFS`) is
  the presentational source of truth — `Pre-TBC` (MQG) → `Phase 1` (Icon) → `Phase 2` (Serpent-Coil)
  → `Phase 3` (Skull, Ashtongue) — and `TRINKETS` is derived from it (`flatMap`), so the flat key
  list and the displayed order can never drift apart. `buildBuffList` emits a `.tsec` rule before the
  first row of each tier. **Purely cosmetic**: the tiers feed nothing in the model, `OFF_TRINKETS`
  and the 2-slot cap are unaffected, and `state.enabled` is keyed by name, so reordering changes no
  plan (exact-match 25/25 unchanged). Each `BUFFS[k].src` names the *source* only — the phase is the
  header's job now, so don't reintroduce "Phase N" into `src`.

## Phases & rendering
- `buildSegments(rows, T)` (~4792): turns phase rows into `{start,end,type,mult,targets}` segments;
  types `normal | intermission | burn | aoe`. Consumed by `simulate` and the renderer.
- `renderTimeline(run)` (~5464): one inline SVG (fluid `width:100%`, no page horizontal scroll) —
  **deterministic** haste step-curve (`multNoAti` — no averaged Ashtongue proc, RULES §14) + area fill,
  three reference lines (the **GCD cap**, **"cap if Ashtongue" ≈ +40.8%** when ATI on, **+25% "4× FB"**
  filler soft cap — RULES §15), phase bands (intermission hatched, AoE/burn tinted with ×N badges),
  buff-uptime lanes with press ticks.
  **The GCD-cap line is STEPPED over the Arcane Blast ramp** (08-02): it reads the cast board
  (`optR.casts`) and draws the per-cast conversion ceiling — +150 / +116.6 / +83.2 % while a 0/1/2-stack
  Blast's CAST binds, settling at +50 % once the 3-stack GCD binds — so every re-ramp (opener, post-gap,
  and the 3→1 mid-cast-lapse resume, which starts at +116.6) shows its drops; AoE casts and no-cast gaps
  stay at +50 %. ⚠ The step series is built **before** the y-scale and `maxPct` includes its peak
  (fix 08-03): `y()` clamps at `maxPct`, and with a haste-only scale every ramp level above it flattened
  into one chart-top plateau — the user saw a single drop. Display only; nothing scores off it.
  **The chart is self-describing — there is NO legend paragraph** (deleted 2026-07-26, user decision).
  Everything the old `#viz-note` legend spelled out now lives on the drawing: a `SPELL HASTE — gear
  X% + cooldowns` caption in the gutter above the curve panel, a gutter label **and** an
  explanatory `<title>` on every reference line (label and line carry the same tip, so hovering
  either works), in-place captions on the phase bands, and a per-bar `<title>`. `#viz-note` survives
  as a **contextual hint only** — it is `hidden` unless `opts.ghost` (says the dashed outlines are
  the planner's timings) or `opts.editing` (the drag instruction) is in play, which is exactly the
  two things a static drawing cannot say for itself. Do not restore a legend: a legend has to be
  re-read forever, a caption is read once. `scheduleRows`/`renderSchedule` build the **activation schedule**
  (peak-haste / AB-cast / floor also read the deterministic `multNoAti`/`castDn`/`capDn`); rows print, sort,
  and group by the **fire-time second** `a.sec` (see the display bullet in the optimizer section); `btn-copy` emits the
  canonical copy-as-text plan the tests compare (`exact-match.mjs` mirrors the same `a.sec` convention). (The dashed leeway bands that used to overlay the lanes
  are **permanently rejected** — user decision, RULES §14; `leewayZones()` is deleted.)
- **Per-window target mana** (`scheduleRows`, ~4394): each window carries `w.mana` = the AB-spam spend
  over its burst span (`GAME.AB.MANA_FLAT 195 × (1 + 0.75·stacks) + 30% under AP`, per-cast real stacks,
  AoE casts excluded — SOURCES). Shown as the blue `.manatag` chip with a net-of-regen tooltip. Pure
  read over the existing cast list; **mana never feeds the optimizer** (layout-first). Display-only.
- **`renderSchedule(run)`** (~4467): the activation schedule is a **press board**, not a table — inside
  each window card (header = window index, first press second, peak haste / AB cast / at-GCD-floor, mana
  chip) it emits **one `.prow` per press SECOND**, with every co-pressed activation clustered as
  icon+code `.ptile`s plus a names line (`buffEffect` renders the old third column, "+30% haste for 40s").
  Rationale: repeated timestamps in the old one-row-per-buff table read as separate actions when they are
  one macro. The live **Pressboard** section (play/stop/reset clock, next-up banner, timeline playhead) and
  its `pressPlan`/`follow*` machinery are **DELETED** (2026-07-26 UI rework) — the schedule now carries that
  layout. Placement-reasoning tags and leeway bands stay **permanently rejected** (user decision — a plateau
  tie for one press is conditional on every other press staying put; RULES §14); the old inference logic
  lives only in git history. Do not restore.
- **`renderAssumptions()`** (~5256): the "Model assumptions" footer — **static** (no `run` argument), so it
  renders at page load and the masthead's `#btn-assump` link always has a scroll target. Sectioned by
  subject with per-claim `sim-verified` / `law-checked` / `beta` / `not modeled` verdict chips; the
  `beta` chips match `BETA_KEYS` — **Power Infusion only since 08-03**: Ashtongue and Drums were
  de-beta'd when they gained closed-form law coverage (law-check's ATI/Drums blocks) and, for the
  proc, the `tools/ati-mc.mjs` process-simulation gate. Keep it in sync with RULES/MECHANICS —
  it is the user-facing statement of the model.

## Timeline customization — unlock → drag → lock → validate (+ debug export)
UI-only module (after the copy handler, ~4843 `planToSpecInline`); the engine block is untouched and the model's run is
never mutated — `lastRun` stays the optimizer's output, the hand-edited intent schedule lives in
`CUSTOM.s`, and `activeRun()` = the locked custom run if one exists, else `lastRun` (what `btn-copy`
reads). A fresh "Find optimal overlay" run calls `customReset()`.
- **The toolbar is one vocabulary, ordered as the workflow.** Left to right: `Customize` /
  `Revert` → a segmented `Check in benchmark sim` + `?` → a quiet `Debug export`, separated by
  `.vdiv` rules so the row reads as *adjust → prove → take away* rather than five equal choices.
  All of them are `.tbtn` (icon + `<span class="lab">`), with weight encoding rank: exactly one
  `.primary` (the sim), `.quiet` for utilities, `.armed` for the held edit mode. Two consequences
  for the JS: label swaps must go through **`btnLabel(btn, text)`** (writing `textContent` would
  delete the inline SVG icon — `copyToClipboard` and the sim's busy states both do), and the
  customize button's label/icon/tooltip are set in one place, **`setEditBtn(editing)`**, which names
  the action that *leaves* the current mode ("Customize" ⇄ "Lock & validate").
- **Unlock** (`#btn-edit` → `enterEdit`): clones `best.s`, re-renders the timeline via
  `renderTimeline(run, opts)` — the new optional second arg: `opts.ghost` draws the MODEL plan as
  dashed outline bars in every lane (always shown while a custom timeline exists), `opts.editing`
  wraps each planner press in a draggable `<g class="pressg">`, `opts.illegal` flags presses. No
  opts ⇒ byte-identical to the old render. The activation schedule dims (`.stale`) until lock.
- **Drag** (`attachDrag`): pointer-events on the SVG; the bar follows the pointer, a bubble shows the
  whole second the press will snap to, and **release locks the intent to the nearest full second**
  (the search's own granularity; clamped to `[0, T−1]`). Bars render at the **press** times
  (`shownTimes`) — see the display ruling above; the drag handle therefore needs no intent/fire
  pairing, because the bar's position IS the intent. Pinned raid calls
  (`cfg.fixed`) get no `pressg` — not editable, exactly the keys `repair()` would reset anyway.
- **Live comparison** (`renderCustomTiles`): a second tile row — custom-vs-model Δ% damage headline +
  the four headline metrics (gain vs no-cooldowns / vs mashing / effective casts / GCD-floor time),
  each with a delta chip vs the model (`tileStats` computes both in `renderTiles`' exact units).
  Updates in realtime during a drag: rAF-throttled `simulate()` at the snapped second (memoized —
  a revisited second is a cache hit), full refresh on release.
- **Lock** (`tryLock`): the validator IS `repair()` — `validateCustom` diffs the schedule against
  `repair(CUSTOM.s, cfg)`; legal ⇔ fixpoint. Legal → the activation schedule and
  copy-text regenerate from the custom plan (`CUSTOM.run`, `isCustom: true`; copy-text gains a
  "CUSTOM timeline" marker line). Illegal → lock refused: per-press violations listed in `#edit-msg`
  (moved/dropped, with the earliest legal time), offending bars flagged, and an **auto-fix** button
  adopts `repair()`'s nearest-legal times. Locking an unchanged schedule reverts to pristine;
  `#btn-revert` discards the customization outright.
- **Debug export** (`#btn-debug` → `debugExportText`): one clipboard payload for pasting into a
  debugging session — human-readable input header + model plan text/stats + custom plan text/stats
  + deltas + validation state, then a machine block: `{input, model, custom, evalsched}` with intent
  schedules, fire times, totals, and baseline/naive references. The `evalsched` object is **directly
  runnable** as `node tests/evalsched.mjs '<json>'` (round-trip verified: identical totals), and the
  notes point at the TOOLING sim workflow (`genapl`, `_prestack:0`) for "sim my custom timeline".

## Presets & tests — two baked strips, both the fight table
`index.html` defines **two** baked preset arrays + `GOLDEN_DEFAULTS` (near the localStorage-preset
section, tail of the file) and exposes them on `window`:
- **`BOSS_PRESETS`** — the real current-phase raid encounters (Hydross … Kael'thas), boss-named, with
  the actual fight length / Lust timing / phases from the pulls.
- **`GOLDEN_PRESETS`** — the abstract regression fights (short-length variants, `6:00/5:45` packing,
  `3:20/5:00` containment) that exercise engine edge cases the bosses don't.
Both use the same shape (`{name, T, pins}` + optional `gear`/`kit`/`intermission`/`phases`) and load
**input side only** (no auto-run). Three UI strips: **`#boss-strip`** "Boss presets" (accent) and
**`#golden-strip`** "Debugging presets" (muted) render the two baked arrays via `renderBakedPresets(arr,
hostId)` → `goldenToState(p)` → `applyState(...)`; **`#preset-strip`** "Custom presets" is the
localStorage user-saved strip (was "Boss presets"). The user presses "Find optimal overlay" to
**compute** the plan — presets store setup, never a precomputed answer.
- **Tests (`tests/`):** ⛔ **`exact-match.mjs` + `golden.json` are DELETED (07-28, user decision).** The
  suite is now `tests/anchors.mjs` — **seventeen** cases (T1–T17), the layouts the user declared
  exactly, built from their own cfg rather than from the preset arrays. So the presets no longer
  double as the test corpus; the Reference-fights strip IS the test list (user decision 07-30). Plan
  stability is `tools/plan-sweep.mjs` + `tools/plan-diff.mjs` (Δscore per cell with a regression
  verdict, ~1 min — and since 08-04 also CI's `plan-stability` job against the merge-base), and the
  one thing that loop cannot see is the render path — it runs the DOM-free engine.
