# ROADMAP.md — status, current work, open questions

## Resuming after a context clear (start here)

> # ✅✅ THE SCORER IS CLOSED (07-31). NEXT SESSION IS THE **SEARCH**.
> User instruction: *"When I wake up I want to work on the search function and never come back to the
> scoring function."* Everything the four audits found in the integral is fixed and gated:
> MODEL-DEFECTS **§9a F1–F4 + the debuff anchor**, all landed with `PLAN-DIFF IDENTICAL`.
> The scorer now has **eight** blocking gates — `anchors`, `law-check` (+self-test), `self-consistency`,
> `toll-audit --strict`, `objective-ref`, `constants-cited` (+self-test), `search-audit`, and since
> 08-03 `ati-mc` (+self-test — the Ashtongue renewal law against a seeded simulation of the proc
> process).
> ✅ *Search work landed 08-04:* **§9o is CLOSED** — `phaseRerank` move class 6 (the chain-dragged
> cluster) composes the repair-chain push with the co-pressed partners it would split; kit-sweep
> `search-audit --k=3` reads **72/72** (was 69/72), 68 cells byte-identical, the four changed all
> improved, anchors 17/17, preset sweep IDENTICAL. MODEL-DEFECTS §9o has the decomposition.
> ⛔ **What is deliberately NOT closed, and is NOT the scorer:**
> · **§9b** — Presence of Mind is unmodelled (0.667–1.004 casts/use). ✅ *The other §9b half landed
>   08-03 (§9n):* the Ashtongue channel of the Potency +3 pp now feeds the proc rate (`atiProcQ`),
>   with the whole ATI model rebuilt as the exact renewal law — crit-driven, haste-feedback-exact,
>   engagement-transient-aware (ESTABLISHED-FACTS §12, RULES §14). The damage side stays normalised
>   away, correctly. PoM remains: an allocation problem, i.e. **search work**.
> · `buildSegments` resolves overlapping phases by "last row wins entirely" with no validation, so the
>   same fight scores 202.40 or 212.00 (4.7 %) depending on **data-entry order**. A UI/validation bug.
> · `killMode:"oneSided"` books +1.71 casts of phantom Arcane Explosion after the boss dies (latent at
>   the default), and RULES §9 Correction 3's AoE press-snap has gone inert (it lives on `eff`; the
>   ranking reads `scoreStart`) — **that one is a search-path item and belongs to next session.**
> · `rampCasts`/`rampCastDmg` is dead code in the hottest function.
>
> ---
>
> # ▶▶ USER-REQUESTED, ASKED FOR 07-31 — ANSWER "WHAT'S NEXT?" WITH THIS FIRST
>
> Two test-derivation programmes the user asked for by name. Both are about **growing the declared
> ground truth**, which is the scarcest thing the project has: there are eight declared layouts, all at
> `h = 0`, and nothing declares a correct answer above it.
>
> ## A. The LENGTH LADDER — simple fights, no intermissions, Lust swept
> *"derive more tests with simple fights at different lengths. 2:20, 2:40, 3:00, 3:20… with no
> intermissions and lust at different times."*
> A clean grid: `T ∈ {2:20, 2:40, 3:00, 3:20, …}` × Lust call time, no phases, default gear. What makes
> it worth doing is that the existing eight are **scattered** — two at 1000 SP / 25 % crit, five at the
> default gear, lengths 1:15 to 3:00, chosen because they were reported as bugs. A ladder is
> *systematic*: it says how the layout **moves** with length and with the Lust call, which is a claim no
> single case can make, and it is exactly where a search defect shows up as a kink in an otherwise
> smooth family.
> ⛔ **The tool cannot declare its own tests** — that is what killed `exact-match`. The workflow is:
> brute-force each cell's argmax, present it to the user with **the tie plateau alongside it**, and let
> the user rule. Reporting the plateau is not optional: §8y's precedent is that a declared layout may be
> revised *only* when the disagreement sits inside the tie band, so a ruling made without seeing the
> plateau cannot invoke that precedent later.
> ⚠ Do this **after** MODEL-DEFECTS §9a lands, or do it knowing the answers may move: F1 alone re-prices
> haste over a cold ramp by 0.14–1.33 casts, and the opening cluster is what these cells are about.
>
> ## B. The 12:20 ALIGNMENT STUDY — spam on cooldown, or hold for alignment?
> *"a hard bruteforced 12:20 fight to see the buffs aligned and their cooldowns coming back at the same
> time naturally and if it's better to spam them on cooldown or keep the shorter ones for alignment, and
> if that changes with lust at different times."*
> ★ **12:20 is a well-chosen length and the arithmetic says why** — record this so nobody "simplifies"
> it to a round number. The kit has two cooldown families, **120 s** (Icon, gem) and **180 s** (Icy
> Veins, Arcane Power, Berserking), which re-align only at `lcm(120, 180) = 360 s`. 740 s is **2.06
> alignment cycles**, so the fight contains the phenomenon twice and cannot be explained by a single
> lucky coincidence. Uses available: Icon **7**, Arcane Power **5**, Berserking **5**, Icy Veins **5 + 1
> Cold Snap = 6**, gem **3** (charge-limited, not cooldown-limited — the only member that is), and
> **Bloodlust twice**, since its 600 s cooldown fits inside 740 s. That second Lust is a structural
> feature of this length, not a detail.
> ⇒ the real question underneath: the 120 s family drifts out of phase with the 180 s family after every
> use, so "on cooldown" and "aligned" genuinely diverge, and the gem being charge-limited means it is the
> one member with a free choice of *which* alignments to attend.
> ⚠ **A free-coordinate brute force is hopeless here and starting one would waste a session.** §8y
> enumerated 1,582,581 layouts for a **2:00** fight with far fewer uses; this space is larger by many
> orders of magnitude. It needs structure — enumerate *cluster patterns* (which uses co-press) rather
> than free press seconds, or solve on a coarse lattice and refine. Design the enumeration before
> running anything.
> ⚠ Same dependency as A: §9a's F1/F4 both re-price ramps, and a 12:20 fight has many of them.
>
> ---
>
> # ▶ THE LIVE PLAN IS `docs/PHASE13.md` — start there
>
> ## ✅ CLEARED 07-31 — the T6 call was made, and move class 3d is SHIPPED
> T6 was **revised** to the objective's answer (`AP/Icon/gem/IV @0:15 · IV @0:35 · Berserking @0:05`)
> and `index.html` now carries the cooldown-chain closure, placed LAST in the move order (that position
> is load-bearing — see MODEL-DEFECTS §8y §1c). It repairs a **0.114-cast** miss the user found by hand
> on a 7:00 Kael'thas fight and the last kit-matrix SCORE miss.
> ⚠ The precedent is deliberately narrow: a declared layout may be revised only when the disagreement
> is **inside the tie band**, where the scorer never had the power to separate the two. Editing a test
> because the tool disagrees on DAMAGE remains forbidden.
>
> ## ✅ THE SCORER IS CLOSED OUT (07-31) — every named defect is fixed, characterised, or unfalsifiable
> · **§8o CLOSED** — the dead-time inconsistency was fixed by §8q the same day and nobody re-checked.
>   Verified on §8o's own case: 26 samples at 0.1 s across the ramp boundary, every Δ identical to
>   1e-9, and the ramp sweep monotone with the argmax at 3 stacks (§8o had argmax@0, ±0.14 zigzag).
> · **§8r CHARACTERISED** — statement 1 is implemented EXACTLY (haste residual 0.000000 with a matched
>   control), its value half holds (Icon −0.103, AP −0.400, both correctly preferring to be clear of
>   the ramp). Statement 2 stays a **user call**: adopting it breaks the declared layouts.
> · **§8n** stays unfalsifiable — sim-denominated, and the sim is gone (§8x).
> · **5 ungated behaviours gated**: prepull credit, Power Infusion's Bloodlust exclusivity (both
>   directions), Tirisfal × Arcane Power additivity, intermission cost. Prepull had been shipping since
>   07-30 with nothing asserting it.
> · **The circularity is closed at the numbers**: all 14 `GAME` constants trace to a source outside the
>   model, gated by `tools/constants-cited.mjs` with a redaction control.
> ⇒ `law-check` **17 → 30 lines**, negative control catching 10. anchors 8/8, self-consistency
> 0.00e+0 / 0 structural, PLAN-DIFF IDENTICAL throughout — every one of these was a GATE addition, not
> a model change.
> ⚠ What remains is **not** scorer work: §8v (reachability on tied plateaus) is search, and the
> modelling LIMITS — infinite mana, hit at cap, Arcane-Blast-only, expectation-not-variance — are
> stated choices rather than defects.
>
> ## ▶▶ THEN: PASSIVE GEAR HASTE. The groundwork is in `ESTABLISHED-FACTS` §10.
> Every declared layout is **h = 0** and nothing in the repo declares a correct plan above it. §10 now
> carries the DERIVATIVES needed to change that — how each combination reacts to added haste, crit and
> SP (`node tools/facts-volatility.mjs --md` regenerates). The three that shape the work: haste buffs
> **converge** at ~600 gear haste (past the floor a buff is worth the remaining distance to the cap,
> not its own size — so *which* haste cooldown stops mattering, only *when*); Bloodlust **peaks at
> ~200** and falls after; and every pair inverts from stack to split at a **different** gear level.
> ⇒ the natural next step is to declare layouts at one or two non-zero haste levels and lock them.
>
> ## ⛔⛔ 2026-07-30 — TWO USER DECISIONS RESHAPED THE PROJECT. READ THESE FIRST.
> **1. The simulator is RETIRED.** *"I actually want you to retire the simming, it's doing more harm
> than good. I think we have the function/equation locked down and from now on we're better off on our
> own."* `sim/`, `tools/bench.mjs`, `genapl*`, the whole `xval-*` cross-validation family, the sim
> tests, two of CI's three jobs and the in-page "Check in benchmark sim" button are **deleted**; the
> four sim docs are archived as `docs/archive/14`–`17`, bannered. `docs/PHASE13.md` opens with the list
> of items this VOIDS. Ground truth is now `docs/ESTABLISHED-FACTS.md`'s closed forms
> (`tools/law-check.mjs`), the scorer's self-agreement (`tools/self-consistency.mjs`), and the **seven**
> declared layouts (`tests/anchors.mjs`). ⚠ Genuinely lost: mana and AoE weighting are now unmeasured.
> **2. Displayed plan times are PRESS times, not fire times.** *"With our model the trinket and the stat
> changes should apply the moment it's pressed."* The old display rendered a 0:05 intent as "0:06" and
> visibly split clusters the optimizer had deliberately co-pressed.
>
> ## ✅ `8 of 8` — and the two newest tests came in as BUG REPORTS
> T6 (`2:00 lust 0:05`) and T7 (`1:15 lust 0:05 · interm 0:50–0:55`) were plans the user said were
> wrong. They were: the emitted layouts sat **0.0058** and **0.1022 casts** below the brute-force
> argmax. Both were SEARCH misses (MODEL-DEFECTS §8s) — the optimum packs haste windows back to back,
> and every 1-D and 2-D move off a packed train is downhill, so `phaseRerank` gained a train slide.
> ★ The method that found them is the one that replaced the sim: **enumerate the cell's neighbourhood
> and compare.** It is exact, instant, and says *by how much*.
> ## ✅ PHASE 12 — MAKE THE OBJECTIVE EXACT — is **CLOSED 2026-07-27** and archived at `docs/archive/13-phase12-exact-objective.md`.
>
> ## ✅ THE OBJECTIVE IS EXACT, AND THE TREE IS GREEN
> ⛔ **CORRECTED 07-30 (§8h): `simulate()` ranks on the rate INTEGRAL; the per-cast sum is reported only.**
> The line below is kept because the gate reading it quotes is still the standing one. Gate `tools/self-consistency.mjs` reads
> `0.00e+0` over **3000 generated scorings (460 699 casts, 0.78 s, no cache)** with **0 structural
> violations**. **Four scoring defects and one transcription defect** were fixed
> (PHASE12 §6.9 transcription · §6.10 the integral · §6.11 press-anchored windows · §6.12 the single
> snapshot rule · §8→§9 the boundary), the **cast lattice was closed** (§6.14: `STACK_CAST_REDUCTION
> 1/3 → 334 ms` **plus** millisecond rounding), and the cooldown chain now anchors on the **fire**
> (§6.14c). ✅ **`exact-match` reads 25 passed, 0 failed** — the goldens were re-recorded under §9 on
> `plan-rescore` evidence (15 of 16 better, 1 plateau, **0 regressions**).
> ⛔ **A stale line to recognise if you meet it in an archived doc:** *"`exact-match` is RED on purpose
> — do not `--update` it"* was true for a few hours on 07-27 and is **false now**. The standing rule is
> unchanged: goldens are re-recorded only after each changed plan is shown to improve the objective.
>
> ### ✅ ALSO LANDED 07-27 — THE BOUNDARY MODEL WENT DETERMINISTIC (PHASE12 §9, **user ruling**)
> `KILL_WINDOW = 0.5` and the symmetric kill taper are **RETIRED FROM THE OBJECTIVE** (a local
> `KW = 0.5` survives feeding only the `integral` diagnostic). One uniform rule now applies at every
> boundary: **`credit = min(1, (nextCut − castStart) / castDuration)`**, multiplying that cast's own
> value, where a **cut** is a boundary you would not carry a cast across: the fight end, an
> **intermission start** and an **AoE phase start**. ⛔ **A burn edge is NOT a cut.**
> ★ **Three boundaries, two cuts, TWO DIFFERENT REASONS** — intermission = the cast **cannot land**
> (physics); AoE start = it **lands but you cancel it** for Arcane Explosion (policy); burn edge = it
> lands and you would **not** cancel (a *value* boundary).
> ⚠ **The AoE edge flipped TWICE on 07-27 and the reasoning is the record.** It shipped as a cut
> (PHASE12 §9), was **removed on physics** in commit `6cfaeec` — the sim showed an AB started at 59.000
> against an AoE opening at 60.000 completes at 60.498 and **lands for full AB damage**, so docking it
> looked like paying less than the game pays — and was then **RESTORED on policy** by user ruling the
> same day: the Blast does land, but adds are up and Arcane Explosion is worth several ABs, so the player
> **cancels**, and a cancelled cast is worth zero. The measurement is still true; it is simply not what
> decides the question. Because the cast is *cancelled* rather than re-priced, the **AE lattice restarts
> at the wall** (verified: Blast at 58.998 vs a wall at 60.000 → 66.9 % credit, first AE at exactly
> 60.000). ⚠⚠ It buys a **standing, expected divergence from the sim** — wowsims cannot cancel a cast,
> so `model-audit` will show a gap at an AoE wall and that gap is not a bug (RULES §9, TOOLING).
> ⚠⚠ Commit `6cfaeec` also fixed a 42 % error on
> Kael'thas: Arcane Explosion is **instant**, so `dur = 0`, and a divide-by-zero guard returning `0`
> credited **every AE at nothing** — the limit is `1`. **Guard against NaN, not against the answer**, and
> note that **no existing gate could reach either defect** (`self-consistency` compares the objective
> against itself; `exact-match` locks in whatever the search emits). ⇒ **That gap was closed 07-27**
> after it let two more defects through: `self-consistency` now generates its own corpus (the old one
> lived in a `.gitignore`d cache keyed on the page's sha1, so it graded **nothing** the moment
> `simulate()` was edited) and carries a **structural** check that grades the board against the
> millisecond lattice rather than against the accumulator — PHASE13 §2.5. A cast completing exactly at `T` now earns a **full** cast
> (it earned 0.5 under the taper), and a cast completing inside an intermission is no longer paid in
> full (measured: starts 89.616, wall 90 — was `2242.1`, now `frac 0.2563` / `credited 574.8`).
> `total`, `robust` and `totalEarly` are now the **same number**; the per-cast board gains `frac` and
> `credited`. Separately, cooldown chaining now anchors on the **fire** moment (`auraAt`, via
> `lastFire`) rather than the press: **HELD press failures 18 → 1 of 196**.
> **Blast radius:** `plan-sweep` **11 of 16** cases moved plans; `tools/blast-radius.mjs` **102 of 285**
> cells (35.8 %). Docs updated: RULES §1/§8/§9, ARCHITECTURE, MECHANICS §4, ACCEPTANCE, TOOLING, BENCH,
> GEAR-AGNOSTIC.
> ✅ **`sim/benchmark.mjs`'s kill window is now DERIVED from the model's** (closed 07-27, PHASE13 §2.4,
> on the user's proposal). The model's credit rule *is* a one-sided window `U[T, T+d]` with `d` the
> terminal cast's own duration, so the sim gets that window: `duration = T + d/2, variation = d/2` via
> `killWindow(hasteRating)` / `encounterFor(T, hasteRating)`, the single definition both the wasm and
> the native path read. The retired flat `0.5` was not merely unjustified but **wrong** — 33 % too
> narrow at zero haste (half a 3-stack Blast is 0.749 s) and never moved with gear. Measured
> (`tools/window-match.mjs`, sweeping T across one cast interval): model/sim ratio spread **0.0208 %
> derived vs 0.1627 % flat — 7.8× tighter**, and monotone instead of wobbling. ⛔ Still **not** to be
> "fixed" by setting `--var 0`.
>
> ▶ **NEXT: `docs/PHASE13.md`.** Its §1 — the **AoE edge** — is ✅ **decided and landed** (as a cut, on
> policy — see above), so **no open item changes numbers the tool prints**. §2 re-measures what Phase 12
> voided
> (ACCEPTANCE, `model-audit` at scale, `scorer-duel` now that its prerequisite landed), §3 is the
> search-optimality programme, §4 the gear-agnostic enforcement, §5 the inherited platform track.
> ~~`STACK_CAST_REDUCTION: 1/3 → 334 ms`~~ ✅ **landed** (PHASE12 §6.14).
>
> *The original charter text is kept below for its reasoning.*
>
> **The model disagrees with itself by more than the entire effect the project has been chasing.**
> Effective ABs cast is a **deterministic per-cast sum** — per cast we know haste, stacks (hence cast
> time), AP on/off (×1.30), the SP buffs (normalizable), and crit as a constant that cancels. Nothing
> needs approximating. `simulate()` computed exactly that in its discrete cast walk and then **ranked on
> a continuous rate integral instead.** Over 2755 plan-scorings, no sim: the two differed by a **median
> 0.2114 % of score, max 1.4263 %**, against a corpus whose deficits are 0.004–0.380 % and whose
> ranking margins are ~0.005–0.07 %.
>
> ⇒ **Everything downstream was provisional until this was fixed** — the 142 B2 columns, the persistence
> work list, the B2 debt, every falsified scorer term. They are measurements of a quantity that is not
> single-valued at their own scale.
>
> **And the sim's role is now stated correctly: it exists to FALSIFY THE SEARCH.** With an exact
> objective, ranking two plans is arithmetic and cannot be wrong — so when the sim prefers a plan the
> tool did not emit, **the search failed to find it.** The cross-val corpus is a brute-force explorer of
> regions the search never visits; each disagreement is a *pattern to generalize into a rule or a seed
> class*, not a scorer to re-tune. Secondary: anchor the physics, cover genuine blind spots, build user
> trust via the in-page benchmark button.
>
> **Order:** (1) score the per-cast sum — gate `robust == the per-cast sum` to float precision, no sim
> (⛔ the original wording was *"`robust == tapered cast sum`"*; the taper it named was itself retired
> later the same day — PHASE12 §9, the boundary-credit block above)
> needed; (2) ✅ **DONE 07-27** — the press-fire offset (§6.9); (3) re-gather and *then* hunt search
> bugs. ⚠ Step 1 moves plans and re-records goldens — that is the point, not a regression.
>
> ### ✅ Step 2 landed 07-27 — and it opened a MODEL commit that must run alone
> Transcription failures **7.14 % → 0.00 %** on real combat logs (`tools/press-headtohead.mjs`), with
> the engine block **byte-identical** (`sha1 7c08324250500f61`) so no plan moved and no golden was
> re-recorded. The gate PHASE12 §6.7 found missing now exists: `tests/press-fire.mjs`.
>
> ⛔ **§6.7's mechanism is retired by §6.9a.** It was never "the schedule fires strictly after" —
> `APLActionSchedule.IsReady` is `>=`, and a schedule 1 ns below the boundary also fires late.
> **wowsims takes 334 ms per Arcane Blast stack where the model takes 1/3 s**, so the boundary a combat
> log prints as `11.00` is really `10.998`, and `10.998 >= 11.000` is false.
>
> ~~▶ **NEXT COMMIT, and it rides alone: `STACK_CAST_REDUCTION: 1/3` → 334 ms.**~~ ✅ **LANDED —
> PHASE12 §6.14**, and it was **two** changes, not one: the constant *and* millisecond rounding of every
> cast and GCD, of which the rounding dominates (Arcane Blast is GCD-bound in steady state, so the stack
> constant never enters the interval — it matters for the **ramp** and for **completion** times, which
> is where the value snapshot reads). Bare-stream drift 0.080 s → **0.005 s**; LATTICE-class press
> failures 8 → **0**; then the cooldown-chain fix took HELD 18 → **1** (§6.14c).
> Evidence: `docs/MECHANICS.md` §1.1, `docs/SOURCES.md`, PHASE12 §6.9d/§6.14.
>
> ~~Demoted until this lands: PHASE11's platform work, the gear-agnostic re-gather, the boss band's
> remaining 7 columns.~~ **All three are now live work in `docs/PHASE13.md`** — the platform track at
> §5 (PHASE 11 closed without starting it), the re-gather at §2.1 (and it is mostly arithmetic now,
> `tools/xval-model.mjs`, no sim).

### ✅ CLOSED: PHASE 10 — re-baseline acceptance on GEAR B (`docs/archive/11-phase10-gearb-baseline.md`; 07-26 → 07-27)

> ## ⛔ ROUND 1 IS COMPLETE AND GRADED — AND **VOID AS A MODEL VERDICT** (07-27)
> ⛔ This block used to read *"…and it is a REAL reading now … the project's 'are we done' verdict is
> defined again."* **Withdrawn.** Round 1 was gathered against the pre-PHASE12 scorer — the rate
> integral, the press-anchored buff windows and chain, and the symmetric kill taper — all three of
> which were replaced on 07-27. The credit rule alone moved plans in **11 of 16** `plan-sweep` cases
> and **102 of 285** `blast-radius` cells (35.8 %), so the round graded plans the current engine may no
> longer emit. **ACCEPTANCE has no current reading until a re-gather** (see its top banner).
> The tables stand as the append-only record and the evidence trail.
> `tools/xval-results/` holds 36/36 tables under **one protocol on one engine**
> (`char=bench-gearB · engine=native:runner-ap180 · var 0.5 · emit=fire · iter 6000 · pool=1`),
> certified by `tools/xval-stamp-audit.mjs` (exit 0).
>
> | | |
> |---|---|
> | invariant A | **PASSES** — `monoDip = 0.0000%` on all 36 |
> | invariant B1 | holds by construction (pooling) |
> | invariant B2 | **FAILS** — 142 borrowed-win columns of 345, across 33/36 tables (bar = zero) |
> | worst | **0.380 %** `isc-mqg medlong @sim40 ← plan@70` — B2's own cell |
> | persistence | **3 columns** of 57, reproducing gear A's first two **cell for cell** |
>
> **The debts, re-priced (PHASE10 §8.31):** **B2 SURVIVES** — banded **+0.368 ± 0.020 pp, 5/5 seeds,
> REAL**, so its ≈0.43 pp target stands at **≈0.38–0.41 pp** and §5's closure test fails emphatically.
> The **low-haste basin REPRODUCES** but is misnamed — a third persistent column sits at h130, and the
> family is **two columns of one-terminal-cast blindness + one sub-resolution value column** (§8.25).
> The **KT/AoE cells DO NOT REPRODUCE**, discharging PHASE7 §5.19's standing prediction: gear A's three
> `isc+scb` KT survivors now read 0.07 %, 0.05 % and *not a borrowed win at all*.
>
> ⚠ **Two instrument findings the next phase inherits.** (1) `ripple-audit` **fails two of its own
> pre-registered self-checks** (P5 monotonicity, P3 KT discrimination), so **no ripple decomposition is
> quotable on this round** — and its `mono=0` stamp means FAILURE while the adjacent `vacuous=0` means
> success, which is why §8.22 recorded a failing check as clean. (2) *"wasm == native"* has always meant
> **within 0.05 DPS**, not bit-identity: the re-gather moved six published summary figures, one of them
> a **verdict flip** (`scb-mqg-medlong` DEFICIT → CLEAN) off a ~1e-6 relative difference (§8.27).
>
> **The freeze is LIFTED.** `index.html` and the rest of the import closure are editable again.

### ▶ SUPERSEDED — the in-flight text below is kept for its reasoning (started 07-26)

> ## ★★★ DIRECTION CHANGE, 07-26 — THE PROJECT IS GOING GEAR-AGNOSTIC. READ `docs/GEAR-AGNOSTIC.md`.
> User decision: all simming and verification moves to a character defined **only** by the planner's
> declared inputs. **The round below is the LAST one gathered on the exported gear-B character** — it
> finishes as-is (it is ~50 CPU-hours in and killing it leaves ACCEPTANCE with nothing), is archived
> as the final geared round, and is then kept as a *control* rather than as the acceptance reading:
> it is what makes "do scheduling conclusions transfer across stat distributions?" answerable.
> Implementation is gated on 36/36 — `sim/simreq.mjs` and `tools/xval-bench.mjs` are frozen exactly as
> `index.html` is (the campaign spawns `xval-bench` per cell and it imports `simreq`).
>
> ## ✅ SUPERSEDED — the round is COMPLETE and the handoff doc is gone.
> `docs/PHASE10-RESUME.md` was absorbed into `docs/archive/11-phase10-gearb-baseline.md` §9 when the
> phase closed; the paragraph below described the round while it gathered and is kept only for its
> operational reasoning. **The freeze it describes is LIFTED.**
> ⚠ **THE FREEZE IS THE WHOLE IMPORT CLOSURE, not just `index.html`** (found 07-27, PHASE12 §1.1e):
> the plan cache keys on `index.html`'s bytes **alone**, so editing anything else `xval-bench.mjs`
> imports changes plans while the key stays put. Also frozen: `tools/engine-node.mjs`,
> `tools/genapl-core.mjs`, `tools/reference-gear.mjs`, `sim/planspec.mjs`, `sim/benchmark.mjs`.
> Everything outside the closure — `tools/bench.mjs`, `tests/`, `docs/` — is editable mid-round.

**Read this before resuming any model work.** The reference character was re-exported on 07-26 and the
entire gear-A corpus archived, so **ACCEPTANCE has no current reading**, and every open debt below —
B2 ≈0.445pp, the low-haste basin, the KT/AoE cells — is denominated in a currency that no longer
exists. ⚠ **The "B2 moved ~0.39pp and changed sign" claim that used to end this paragraph was
RETRACTED 07-27** (BENCH §3e) — it does not reproduce, and B2's cell reads `+0.389 %` on gear B against
`+0.360 %` on gear A, so its ≈0.445pp target **stands** at ≈0.43 pp. The rest of the paragraph is
unaffected: the other debts are still un-denominated, because *nobody has re-measured them*, which is
a different claim from *they moved*.

**Where it stands (execution log: `docs/archive/11-phase10-gearb-baseline.md` §8).**
- ✅ **The §4.1 shakedown PASSED** 4/4 cells on all four gate conditions (§8.1).
- ✅ **The instrument is fully certified** (§8.8): shipped wasm **==** native runner; `sim-request`
  anti-drift gate **9/9**; gear-B trust anchor **runner ≡ wowsimcli to every printed digit**,
  reproducing BENCH §3d exactly from a rig rebuilt in a container that never saw the original; and
  `exact-match` **25/25**. ⚠ §1.3's "the ceremony is gone" is true as *convenience*, **not** as
  availability — `protoc` installs, the clone and Go proxy are reachable, and the full rig rebuilds in
  ~4 minutes. It is still the only way to run the anti-drift gate or regenerate a `--dumpreq` template.
- ⚠ **§4.2 as written had no executable path** (§8.3): `bench.mjs` is a two-arm duel and the
  acceptance test *is* an N×N matrix. Closed by **`tools/xval-bench.mjs`** — `xval.mjs`'s protocol on
  `bench.mjs`'s engine, every link imported not reimplemented, reproducing `bench.mjs` to the decimal
  on a shared cell, driven by **`tools/xval-bench-campaign.sh`** (+ `tools/xval-checkpoint.sh`, which
  commits and pushes completed tables so hours of compute survive a container reclaim). All 36 seeds
  redraw the **gear-A fights exactly**, so the holdout sample is unchanged and only the baseline is new.
- ✅ ~~🔄 **Round 1 is gathering**~~ **ROUND 1 IS COMPLETE — 36/36, gathered and graded 07-27** into
  `tools/xval-results/` at `ITER=6000 · var 0.5 · seed 11 · mana 1e8 · cold open · emit=fire ·
  pooling ON · WJITTER=2 on boss tables`, all stamped (§8.6) and certified by
  `tools/xval-stamp-audit.mjs`. ⚠ **And then voided as a MODEL verdict by PHASE 12** — it graded the
  pre-exact-objective scorer. It stands as the append-only record; the re-gather is
  `docs/PHASE13.md` §2.1.
- ★★★ **The audit's biggest finding is NOT about acceptance (§8.7): the SHIPPED in-page sim is blind
  to Bloodlust and every trinket.** `sim/model-ref.json` wears nothing and sets
  `raidBuffs.bloodlust: false`, and wowsims treats a press of an unworn on-use as a **bit-identical
  no-op**. Two plans differing *only* in where the Icon goes (74 s apart) read **exactly 0.000 DPS**;
  Lust moved 55 s, likewise **0.000**. Fixed-character controls read **+0.756 %** and **+1.290 %**. So
  the button answers *"too close to call"* to the two most consequential questions the tool answers.
  Guard landed (`bench.mjs` refuses such a duel; `--kit a,b` equips a pair); ~~**the fix needs
  `index.html` and waits for the round**~~ — **the round is done and the freeze is LIFTED**, so the
  `index.html` half is unblocked (§8.5's mechanism, kept because the next round needs it again: the
  plan cache keys on `index.html`'s bytes, so an edit mid-round assembles a matrix from two engines —
  and the freeze is really the whole **import closure**, which `docs/PHASE13.md` §4.1 makes
  tool-enforced). ⚠ It must also confront a structural limit: wowsims has
  **two** trinket slots and the planner offers **four** on-use trinkets, so a kit naming three can
  never be fully equipped and the UI has to *say so*.

### ✅ CLOSED: PHASE 11 — the platform phase (`docs/archive/12-phase11-platform.md`; 07-26 → 07-27)

**The single-file convention is retired (user decision, 07-26)** and that stands. Phase 11 closed
having delivered **two of its three tracks**, and never started the third:

- ✅ **The findings ledger is DISCHARGED, 8 of 8.** Six were fixed in passing (`bench --targets` *and*
  its refusal to sim an `_aoe` spec without one; `duel-worker.js` un-memoizing a rejected boot;
  `immutable` dropped from the unhashed wasm; `plan-duel`'s retired intent transcription;
  `census-build`'s line anchors → **content** anchors; `evalsched`'s missing `t5two`). The last two
  both lived in `index.html` — *"not a coincidence: they are in the one file the split exists to break
  up"* — and landed the day PHASE 10's freeze lifted, proved plan-neutral by the engine block being
  **byte-identical** (`sha1 7c08324250500f61`), not by assertion.
- ✅ **The §1.4 doc sweep landed** (all six items).
- ✅ **CI bring-up LANDED.** ⛔ The old line here — *"verified: no `.github/` exists"* — is **false**:
  `.github/workflows/ci.yml` runs three jobs (`fast` = sim-request §0 invariants + a negative control,
  sim-duel wasm smoke, bench smoke; `page` = page-vs-terminal request equality in Chromium with a
  seeded-break negative control; `plans` = `exact-match`, 25 cases).
- ⛔ **The module split itself NEVER STARTED**, and neither did the perf ladder or the product routes.

⇒ **All of that carries forward to `docs/PHASE13.md` §5**, and the **eight user calls carry forward
verbatim** at §6 (file:// fate, build-or-no-build, precomputed preset plans, comparison/EP features,
wasm-in-git, research mode, COOP/COEP). ⚠ The reclaim ladder needs a **fresh CPU baseline and
content re-anchoring** before any rung is priced — its numbers and its `index.html` line anchors were
both taken against the pre-PHASE12 scorer, and the walk that dominates the profile is exactly the code
that changed.

### 0. THE 07-26 SESSION'S RECORD (historical — read §▶ above for what is live)

> **⚠ RETITLED 2026-07-27.** This block used to be headed *"FRESHEST STATE … the sim rig is GONE and
> is the next task"*. Both halves are now false: Phase 8 is **closed and archived**
> (`docs/archive/09-phase8-b2.md`), and **the rig is not gone** — `apt-get install protobuf-compiler`
> plus BENCH §3d's recipe rebuilds it in **~4 minutes**, done on 07-27, and it reproduced BENCH §3d's
> recorded trust anchor exactly (PHASE10 §8.8). Read §1.3 of PHASE10 as *"you no longer NEED the rig
> to get a number"*, never as *"the rig is unavailable"* — the second reading is what lets a template
> drift uncaught. The entries below are kept as the session's record; they are accurate about 07-26.

**Read this first — it supersedes the round-6/7 block below on what to do next.**

- 🎨 **UI ROUND 2 LANDED (07-26, user-directed; engine untouched, exact-match 25/25 bit-identical).**
  Three user calls, all presentation:
  **(1) The timeline legend is DELETED.** The `#viz-note` paragraph ("White line your cast speed…
  ····· +25% Frostbolt breakpoint … ▨ intermission · ■ AoE · ■ burn") is gone on the grounds that a
  chart needing a paragraph to be read is a chart that isn't finished. Everything it said moved onto
  the drawing: a `SPELL HASTE — gear X% + cooldowns` caption in the gutter above the curve, a
  `<title>` on **both** the gutter label and the line for every reference line (so hovering either
  explains it), phase bands already captioned in place, per-bar hover titles. `#viz-note` survives
  only as a contextual hint — hidden unless there are ghost bars to explain or you are mid-drag,
  which is the residue a static drawing genuinely can't carry. **Do not restore a legend.**
  **(2) The timeline toolbar is now a sequence, not a row of five equals.** `Customize` / `Revert` │
  segmented `Check in benchmark sim` + `?` │ quiet `Debug export` — left to right *is* the workflow
  (adjust → prove → take away), with exactly one filled button because exactly one is the thing to do
  next. One `.tbtn` vocabulary (icon + `.lab` span; `.primary`/`.quiet`/`.armed` encode rank) now
  covers `Copy as text` and the sim-help dialog too. Verbose mode labels shrank to the action
  ("Unlock timeline for customization" → **Customize**, "Lock timeline & validate" → **Lock &
  validate**, "Revert to model plan" → **Revert**) with the explanation moved to the tooltip.
  **(3) Trinkets are grouped by the content they drop from** — `Pre-TBC` (MQG) → `Phase 1` (Icon) →
  `Phase 2` (Serpent-Coil) → `Phase 3` (Skull, Ashtongue) — so the list doubles as a progression
  ladder and you find yours by where you raid instead of by name. `TRINKET_TIERS` is the single
  source and `TRINKETS` derives from it, so display order and key list can't drift.
  Two traps worth remembering: `copyToClipboard` used to write `btn.textContent`, which now **erases
  the inline SVG icon** — every label swap goes through `btnLabel()`; and `TRINKETS` reordering is
  only safe because `state.enabled` is keyed by name (goldens confirm: 25/25 byte-identical).
  Record: ARCHITECTURE (`renderTimeline`, trinket-tier bullet, toolbar bullet), DIARY 07-26.
- 🎨 **UI REWORK LANDED (07-26, user-directed; engine untouched, exact-match 25/25 bit-identical).**
  For first-time legibility on the published site: the live **Pressboard is deleted** (board, clock,
  play/stop/reset, next-up banner, timeline playhead, `follow`/`pressPlan` code) and the **activation
  schedule adopted its visuals** — one line per press *second* with co-pressed activations clustered as
  icon tiles, inside window cards carrying peak haste / AB cast / mana. Copy-as-text (the golden) is
  byte-identical. The **model assumptions** were re-verified claim-by-claim against the engine — **one
  was stale and wrong** (it still said the AB stack ramp was *not* modeled, contradicting Phase 4 and
  RULES §3; the trinket-lockout bullet also omitted the Icon) — and are now sectioned, verdict-chipped
  (`sim-verified` / `beta` / `not modeled`), rendered at page load, and reachable from a masthead
  button. **Beta badges** mark Ashtongue / Drums / Power Infusion (user call: source-verified physics,
  placement never sim-certified end-to-end). Masthead shortened and retitled "WoW Anniversary cooldown
  optimizer for Arcane mages"; phase-editor dropdown no longer overlays its label and its trailing
  number field states its unit (`× damage`, `targets`). Record: DIARY 07-26 + its ledger row;
  ARCHITECTURE `renderSchedule`/`renderAssumptions`.
- 🔗 **THE SIM LINK WAS WRONG; THE SIM WAS NOT (07-26, user-spotted).** The page cited
  `wowsims.github.io/tbc` — the ARCHIVED 2021 pre-APL sim — while the engine has always been
  `wowsims/tbc-new` (`wowsims.com/tbc`). Links fixed; the two-repos table is now in TOOLING, SOURCES,
  BENCH §4d, sim/README and CLAUDE.md. New guard: **`bash tools/upstream-drift.sh`** reports the
  distance from our pin and filters upstream commits to the paths that could move an arcane cast
  stream. **Checked: 21 commits behind, all inert** — the one mage-side change (#422 Mana Gem MCD)
  leaves the APL-castable gem spell untouched and adds an auto-cast our APLs never emit. The pin
  stays deliberate; moving it means a new baseline for every recorded number (BENCH §1).
- 🧪 **THE BENCH IS NOW A TOOL — `tools/bench.mjs` (07-26, user-directed).** `docs/BENCH.md` had
  declared the gear-agnostic bench the standing practice hours earlier but **nothing implemented it**
  (all 15 sim-capable tools still resolved `RUNNER`+`EXPORT_BASE` from a scratchpad). Now:
  `node tools/bench.mjs --preset "2:00 lust 0:05" --vs naive` → **~10s, cold, from the repo alone**,
  because it runs the committed `sim/sim.wasm`. Implements BENCH §2.1 (never-press control), prints a
  **seed band on the paired difference** and the **model's Δ beside the sim's** with a sign-agreement
  check, and **forces the model cfg to the simmed character** (spreads `REF` — the first version
  reproduced PHASE8 §6/§7's two-different-mages defect and mispriced a duel 1.434% → 1.314%).
  Same backbone as the website button; `tests/sim-request.mjs` now gates BOTH committed characters.
  ✅ **The `--var` conflict is SETTLED (07-26, measured):** `tools/var-decision.mjs` decides for
  **0.5**. At var 0 the effect size of a real difference swings a whole cast (−32.8 → −0.9 → −31.8 DPS)
  for a 0.1s change in the kill second whenever the arms differ in terminal cast rate, and var 0 is
  **not** quieter (seed band 0.06/0.40 vs 0.04/0.25) — a fixed duration sits *on* the discontinuity.
  It cancels only when both arms truncate identically, which is why the convention survived. BENCH §3
  and TOOLING ★★ now carry the numbers.
  ✅ **Drums/PI exclusion re-diagnosed:** not a genapl gap — upstream never flags those spells
  `SpellFlagAPL`, so no APL can press them, and the attempt is a **silent** no-op (bit-identical DPS).
  Patchable via a third wowsims patch if the default kit ever needs to verify whole.
- 🔬 **THE SIM SHIPS IN THE PAGE (07-26, user-directed; engine untouched, exact-match 25/25).**
  A **"Check in the benchmark sim"** button runs the real wowsims engine as WASM in the browser and duels the
  model plan against your hand-edited timeline (or against "mash on cooldown" when there isn't one).
  **Not a second implementation** — `planspec` → `genapl-core` → `simreq` → `sim.wasm`, every link
  shared with the terminal harness, and `tests/sim-duel.mjs` asserts the shipped wasm equals the
  native runner to the printed decimal. **Gear-agnostic**: fixed synthetic mage, the user's SP/crit/
  haste injected, hit-capped, infinite mana, cold open, `var 0.5` — absolute DPS is meaningless and
  the UI says so, only the paired same-seed difference is reported. Refuses Burn phases (no encounter
  knob) and names Drums/PI/Ashtongue as dropped (no genapl press). ~10s for both arms at 10k
  iterations. **Follow-up same day (two user calls):** the button is renamed **"Check in the benchmark
  sim"** and carries a **"?"** dialog spelling out that it is NOT a sim of the user's gear (plus how to
  read the gap, and what it can't see); and every protocol constant now lives ONCE in
  `sim/benchmark.mjs` — imported by the page, `tools/plan-duel.mjs` and both tests, with
  `runnerFlags()` generating the native command line — backed by `tests/sim-request.mjs`, which asserts
  the page's request equals the runner's field-for-field, plus protocol invariants (because sharing a
  constant proves agreement, never correctness). Record: `sim/README.md`, TOOLING ★ section, DIARY 07-26.
  ✅ **The search-miss alarm LANDED (07-26).** Lock a hand-edited timeline that is **legal** and scores
  higher than the optimizer's own output **under `robust`** (⛔ the parenthetical here used to be
  *"not `total` — the tiles' headline is at-kill damage, and beating that while losing `robust` is the
  objective working"*. **Moot since 07-27:** `total`, `totalEarly` and `robust` are the SAME number
  now — PHASE12 §9 — so no plan can beat one while losing another. The alarm's logic is unchanged; it
  simply no longer has two currencies to choose between), and the page says
  so loudly, in effective casts, and asks for the Debug export — which now carries the sim
  transcription and a ready-to-run `tools/bench.mjs` command. This is `plan-duel.mjs`'s confession
  rule in the UI: no repricing can manufacture that direction, so it is gradeable with no sim at all.
  **Still open:** ~~a Drums press needs an upstream `SpellFlagAPL` patch (see below)~~ — **formally
  closed 08-03 as MOOT**: the sim is retired, so the patch has no engine to land in; Drums' standing
  coverage is law-check's Drums block + kit-sweep's `drums+icon+gem` cells (RULES §13). A multi-seed
  error bar in the page would double the ~10s wall clock, so the fixed tie band stays for now.
- 📝 **COPY AUDIT of everything the user reads (07-26, user-directed; engine untouched, exact-match
  25/25).** `index.html` + `README.md` verified claim-by-claim against the engine. **README carried the
  same disproven ramp claim in three places**, two deleted features (press price tags, clipped-press
  value tags), a superseded press-timing description, and **IV-crossover numbers that do not reproduce**
  ("~100 rating" ×3 and "~150–200" ×1; re-measured: **~15** for IV+Icon, ~80 with AP in the cluster,
  never-in-Lust with a full opener kit — RULES §5 had this right all along). Page side: plain-language
  rewrite with tooltips on the result tiles and the timeline legend, "Debugging presets" → "Reference
  fights" collapsed behind a `<details>`, and a **"Show the numbers behind each claim"** toggle that
  hides the technically-true-but-irrelevant mechanism by default. **Two missing statements added**: the
  search is multi-start local + polish (**a very good plan, not a proven-optimal one**, with
  ACCEPTANCE's residual behind the fold) and the output is deterministic/reproducible. DIARY 07-26 +
  its second ledger row.

- ✗ **THE BOUNDARY CHARGE MUST NOT BE IMPLEMENTED (PHASE8 §22; 07-26).** The Phase-8 finale was
  "implement the per-window continuous-vs-discrete charge". It is **falsified on sign**: re-priced
  against the *anchored* lattice (the shape §21.5 proved the flat `frac(D/Δ)` gets wrong), the value
  charge is **still anti-B2 and 4.3× worse** — `ΔL` `+0.036 pp` (flat, §13.8) → **`+0.156 pp`**
  (anchored), where B2 needs a **negative** charge to close its `−0.380 pp`. §13.8's retirement of
  the lattice-quantization family therefore **survives** §21.5's invalidation of its ruler, and B2's
  residual target stays **≈0.445 pp**. The trap, stated plainly: **C-BE dominating the ASYMMETRY
  (§21.5) says nothing about its sign in the LEVELS** — §21.4's "collapses to implementing one term"
  was an invalid inference. Instrument: `tools/p8-boundary-charge.mjs` (sim-free; reproduces §21.5's
  C-BE to 4 dp as a built-in gate, and asserts the value/haste cleanliness split it depends on).
  `index.html` is **untouched** — no golden risk, exact-match still 25/25.
- ✅ **THE RIG REBUILDS FROM THE DOCUMENTED RECIPE — nothing was lost (TOOLING, verified 07-26).**
  Executed end to end in a fresh container: `wowsims/tbc-new` @ `ade9f39` + `tools/wowsims-patches/*`
  → `runner-ap180`, 18 MB, provenance checks passing (`innerSpell`=3, `CD.Use`=0). ⚠ **The repo is
  `wowsims/tbc-new`, NOT `wowsims/tbc`** — it declares module `github.com/wowsims/tbc`, so deriving
  the URL from the runner's imports lands on the archived pre-APL repo and wastes a lot of time.
  Two steps the recipe omitted are now written down: `sim/core/proto` must be generated with
  `protoc` (plugin **v1.36.10**, matching the repo), and `cmd/runner/` must be created from
  `tools/wowsims-patches/runner-main.go`. **The only thing not in the repo is the gear export, and
  that is deliberate** (user data). Ask the owner for it.
- ✅✅ **PHASE 8'S CHARTER IS DISCHARGED (PHASE8 §26) — with a NEGATIVE result.** The phase narrowed
  to one deliverable, "implement the per-window boundary charge", and that is done: implemented,
  audited, gated, **sign gate FAILED (6/7 lengths worse)**, shipped OFF. Eight findings are now
  SETTLED and must not be re-opened — see the §26.1 table. ⚠ **B2 itself is NOT solved**: the
  residual target stands at **≈0.445 pp**, now constrained to a **U-shaped length profile** with
  **0.16–0.91 pp of quantization headwind** against it. That is the SUCCESSOR question, not Phase
  8's remainder — and it is **sim-gated**, so it cannot start until the rig is restored (§22.6).
- ✅ **THE CHARGE IS IMPLEMENTED AND GATED — AND IT SHIPS OFF (PHASE8 §25).** The finale was executed,
  not just proxied: `cfg.boundaryCharge` (default OFF) prices each value window from the board's own
  anchored lattice (`nModel` continuous cast-equivalents − `nSim` completions inside the window) ×
  premium. **The §20 sign gate FAILS on the real scorer: 6 of 7 fight lengths WORSE**, and it
  overshoots at short fights — T=40 goes `−0.197 → +0.467`, flipping sign and growing. Three
  independent measurements now agree (§22 proxy@229, §23 proxy across length, §25 the real scorer).
  Gates green for the OFF path: `plan-diff SCORE-AUDIT scorerMoved=0`, `PLAN-DIFF IDENTICAL`,
  exact-match **25/25**. No golden churn, so the "sim-verified better" gate never engages.
  ⚠ **Do not turn it on** without a sim gate justifying it on fidelity grounds other than B2 ranking.
  ★ **And COMPLETING the family does not rescue it (§25.5a):** the goal's "+0.15/+0.26 pp" sizing
  came from a HASTE window (`MQG@202`), so the coded charge is half the term — but combining the
  anchored `L` with §13.8's measured `U` gives **Δnet = +0.186 pp**, *more* anti-B2 than value-only
  (+0.156). `ΔU` is **−0.030** where it would need to exceed **+0.156** to flip. **No version of the
  family — value, haste or both, flat or anchored — closes B2.** Tool: `tools/p8-family-net.mjs`.
- ★★ **A cfg field that changes a score MUST be in `cfgSigOf` (PHASE9 §5.19).** The first §25 gate
  run read ON≡OFF at all 7 lengths — the charge was never computed, because `SIM_MEMO` served the
  OFF entry. Silent, no error, looked like a clean null. Fixed; guard proposed in PHASE9 §4.
- ★ **B2's bias is U-SHAPED IN FIGHT LENGTH, and §22 holds at every length (PHASE8 §23; sim-free).**
  `model − sim` = **−0.197** pp at T=40, mean **−0.116** across T=70..205, **−0.397** at T=229 — both
  ENDS ≈2–3× the middle, and 7/7 negative on the *corrected* harness (so §2's sign test is not a
  harness artifact). Constraint on any candidate: a terminal-only mechanism cannot explain T=40
  (where none of h70's late presses exist yet) and an opener-only one cannot explain T=229 — it
  needs **two terms, or one that scales with how much of the fight is ramp-or-kill vs steady**.
  The obvious ramp story (start-vs-completion divergence ∝ cast length, maximal in the 2.5–4.7 s
  ramp where h70 spends `AP@4`+`isc@4`) was **tested and falsified on sign**: `ΔL` is `+0.912` pp at
  T=40 against a `−0.197` pp bias. ⇒ **§22's verdict is not a T=229 artifact** — the quantization
  family points wrong at every length and is *strongest* in the pure-opener cell. Instrument:
  `tools/p8-b2-length.mjs` (anchored to §13.8's recorded −0.037, exit 3 on drift).
- ✅ **F3's 0.0724 pp residual is CLOSED as a lead (PHASE8 §24; sim-free).** Not a third mechanism —
  the additive test that produced it is **ill-posed**. Re-estimating C-BE with the cascade applied
  moves ΔC-BE `0.1105 → 0.0311` (interaction = −0.0794 pp, **1.10× the residual**), so the two terms
  are not independent and the 0.05 pp bar can be neither met nor missed meaningfully. ⚠ Note the
  sign: applying it makes the decomposition explain *less* (22.6 %, residual grows to 0.152), so it
  **does not absorb** the residual — it retires it as uninterpretable. F1/F2/F4 are basis-robust and
  C-BE's dominance is unaffected. Instrument: `tools/p8-f3-additivity.mjs`.
- **Consequently the goal's item 2 is BLOCKED, not skipped.** The two persistence columns
  (`isc-mqg h40` 5/5, `isc-skull h20` 4/5) and KT `mqg+skull` 0.31 % were to be re-diagnosed *after*
  the charge landed. The charge is not landing, so they revert to their prior status — same physics
  family, still open, now with the charge explicitly ruled out as their explanation too.

### 0b. Rounds 5–7 (gear A) — SUPERSEDED, and the detail lives in the append-only record

> **⚠ PRUNED 2026-07-27.** This section carried ~490 lines of round-5/6/7 narrative. Every number in
> it was **gear A**, which `docs/BENCH.md` §1 archived and gear-B round 1 has now re-measured — so as a
> *living* doc it described a state that no longer exists, which is the failure CLAUDE.md's
> prune-the-living-docs rule names. **Nothing was lost:** the full record is append-only in
> `docs/archive/08-phase7-xval-fixes.md` §5.15–§5.24, `docs/archive/09-phase8-b2.md`, and `docs/DIARY.md`.

**What those rounds established, in one paragraph.** Rounds 5–7 gathered all 36 cross-val tables on
gear A, first under `emit=intent` and finally under `emit=fire` (the plan the tool actually prints).
Invariant A held throughout (`monoDip = 0.00%`). Invariant B failed on the bar, and the residual
narrowed to **two length-persistent kit-columns** — `isc-mqg h40` and `isc-skull h20` — found by the
threshold-free consistent-alternative test, not by the `B FAILS on 34/36` banner, which is an
existence test over ~90 near-ties per table and cannot discriminate. Two engine fixes landed
(the AoE press-snap, `groupSeeds`), and the corrected harness gear moved 35.9 % of the plans while
moving **no** verdict — killing the "it is a reference-gear artifact" explanation.

★ **Phase 10 has now re-measured this on gear B, and the answer is the load-bearing one:** the
persistence work list **reproduces cell for cell** (PHASE10 §8.22), so the debt is a property of the
**model**, not of gear A — and §8.23–§8.25 diagnose its two large columns as **one terminal cast** the
objective integrates away, which the model scores as a 0.014 % tie against the sim's ~13σ.

### 0c. How to resume

1. Read `CLAUDE.md` → `docs/MECHANICS.md` → `docs/RULES.md` → this file, then `docs/ARCHITECTURE.md`
   (line ranges drift) and `docs/TOOLING.md` before touching code.
2. **Phases 10, 11 and 12 are all CLOSED and archived** (`docs/archive/11-…`, `12-…`, `13-…`) and
   **no import-closure freeze is in effect** — `index.html` is editable. ⛔ **`docs/ACCEPTANCE.md` has
   NO CURRENT READING**: its gear-B round 1 verdict (invariant A passes, B2 fails, NOT PASSING) was
   gathered against the scorer PHASE 12 replaced and is void as a model reading. The tables stand as
   the evidence trail.
3. **`docs/PHASE13.md` is the live plan and the only one.** §1 (the AoE edge) is **decided and
   landed** — an AoE phase **start IS a cut, by policy** (the Blast lands, but you cancel it for Arcane
   Explosion); it flipped twice in one day, so read §1 before touching the cut lattice, and note it
   prices a **deliberate divergence** from the sim at an AoE wall.
   Nothing open changes the tool's printed numbers; §2 re-measures what Phase 12 voided;
   §3 is the search-optimality programme — and **§3.1 has one concrete known search miss already on the
   board** (`1:40 lust 0:05`, 0.065 %, the basin not entered at any restart depth,
   `tests/search-witnesses.json`); §4 the gear-agnostic enforcement; §5 the platform track inherited
   from Phase 11.
## The goal, and the payoffs it unlocks

**The planner is the goal** (see `CLAUDE.md`): a trustworthy, *generalisable* tool that maximizes the
**effective ABs cast** (`MECHANICS §4`) for any setup and reports that number. Every heuristic (Lust
packing, haste sequencing, downtime avoidance) is a *consequence* of that objective, not a hardcoded
rule — keeping that framing is what makes it generalise to future phases/trinkets/gear/haste.

Payoffs the same engine then unlocks (secondary — the planner's correctness comes first):
1. **Haste-agnostic ideal APL** — emit a cooldown plan that adapts per gear set (the tool already
   re-optimizes per input; this is the live/conditional-APL form).
2. **Setup comparison — NO dedicated feature needed** (user-directed). Run each setup; compare on the
   **absolute** at-kill damage (or the wowsims DPS of each setup's optimal APL), **not** the
   effective-casts count — effective-casts is normalized to *each setup's own* plain AB (it divides out
   flat SP/crit to isolate scheduling), so it's the right *within*-setup objective but hides raw SP/crit
   throughput *across* setups.
3. **EP / stat weights — DONE as two lightweight cross-checking routes** (user-directed; no bespoke
   calculator). The EP is closed-form partials of the effective-damage integral (**model route**,
   `tests/ep-model.mjs`) AND a finite-difference of wowsims on the planner's optimal schedule (**sim
   route**, `tests/ep-sim.sh` + `runner --sp/--crit/--haste`). **Validated** on `6:00 lust 4:20`: crit EP
   **0.697 vs 0.687** (~1.5%), haste EP **1.43–1.47 vs 1.51** (~5%, model lower by the deliberate
   ramp-blindness; the re-opt value moves toward the sim — this setup is on a haste breakpoint). Full
   derivation, envelope-theorem argument, and caveats in **`docs/EP.md`**. **Portfolio EP over a fight
   set** (`tests/portfolio-ep.mjs`): runs the model route over N fights at your real gear and aggregates
   by the **summed weighted absolute derivatives, normalized to SP once** (NOT averaged per-fight EPs —
   that mis-weights short fights). Awaiting the user's 10 phase-fight inputs to produce the phase EP.

## Phase 3 — raid buffs, procs, pinning *(COMPLETE; record kept)*

> **⚠ CORRECTED 2026-07-27.** This heading read *"in flight — `docs/PLAN.md`"*. `docs/PLAN.md` does
> not exist (CLAUDE.md: *absent = no plan in flight*) and Phase 3 finished long ago — its plan is
> archived at `docs/archive/04-phase3-raidbuffs-procs.md`. The task list below is the completion
> record, not outstanding work.

- **Task 1 — remove mage-managed-cooldown pinning: DONE.** Only the raid calls (Bloodlust, Drums, Power
  Infusion — `RAID_PINNABLE`) expose a pin control now; every mage cooldown (IV/AP/gem/Zerk/Icon/haste
  trinkets) is the planner's to schedule. `buildBuffList` + `readCfg` both gate on the set (stale
  mage-cooldown times in a saved preset are ignored). Optimizer unchanged, presets pin only bloodlust →
  exact-match unaffected. See ARCHITECTURE "Inputs" note.
- **Task 2 — test + tighten Drums + Power Infusion: DONE (verify + lock; no tighten needed — the model
  was already correct).** Verified deterministically (PI ⊂ BL adds 0 haste, PI-past-BL gains only the tail,
  Drums additive) and at the optimizer level (Tinnitus ≥120s spacing, burst-riding for flux, off-floor
  sequencing at high haste; PI@0's intrinsic BL overlap and Drums-on-near-floored-opener both **proven
  optimal** vs alternatives, not search misses). **The one uncertain mechanic — PI not stacking with BL —
  is sim-source-verified** (wowsims `"MultiplyCastSpeed"` ExclusiveCategory, BL prio 1.3 > PI 1.2; IV uses
  the direct `.AttachMultiplyCastSpeed` so it still stacks). Locked 2 Debugging goldens (`3:20 … drums`,
  `3:20 … PI`); exact-match **25/25** (23 existing byte-identical). No fresh end-to-end APL sim — no blind
  spot on a plain fight, physics anchored (RULES §13, SOURCES, TOOLING).
- **Task 3 — Ashtongue model → LEEWAY ZONES (user-refined): in progress.** Kept ATI **passive** (steady-state
  proc-uptime folded into window haste — real DPS; excluding from scoring rejected). No scheduled press / no
> ⛔⛔ **BUILT, THEN PERMANENTLY REJECTED — kept only as the record of a decision, not as a description
> of the code.** `leewayZones()` and `pressPlan()` no longer exist in `index.html`: the leeway bands and
> the reasoning tags were cut for good by user decision (see "UI: leeway bands + reasoning tags
> PERMANENTLY REJECTED" above, and PHASE13 §9), and the Pressboard rework deleted `pressPlan` with the
> live board. ⚠ The present/past tense below is the tense these entries were WRITTEN in and is
> preserved deliberately — do not read "Landed"/"Building" as a claim about the current tree, and do
> not go looking for either symbol.

  proc verdict: the scorer averages the proc, and within a true free-leeway interval aligning a press with a
  proc is **never anti-synergous** (user's call), so the honest depiction is just the interval. **Building:**
  `leewayZones` computes, per mobile press, the maximal contiguous interval where moving it ties the champion
  within `QTOL` (position-independent presses only — §3); the timeline draws a **dotted "press anywhere here"
  band** over it; the action-plan Flexible/earliest tag (task 6) reports the same interval. Narrow/sub-cast
  ties are not drawn (§10 tie-break ≠ free leeway). RULES §14. Output-only (timeline + tags) → exact-match
  unaffected.
- **Task 4 — per-window "target mana": DONE.** Each schedule window shows a blue `~N.Nk mana` chip =
  the AB-spam spend over its burst span (195 base × (1 + 0.75·stacks) + 30% under AP, per-cast real
  stacks; AoE casts excluded — SOURCES/wowsims). Tooltip gives casts, the ≈100/s casting-regen offset,
  the net pool-drop to bank, and the gem/Evocation note when it exceeds a pool. Pure read over the
  existing cast list; **mana never feeds the optimizer.** Display-only → exact-match 25/25. ARCHITECTURE.
- **Task 5 — haste breakpoints on the timeline: DONE.** The haste curve now marks two reference lines:
  the existing **+50% GCD cap** (3-stack AB hits the 1.0s floor) and a new **+25% "4× FB"** line — the
  Frostbolt filler soft cap (≈394 gear rating): at +25% passive haste a 2.5s Frostbolt casts in 2.0s, so
  4 fill the 8s AB debuff (filler 3→4). Verified vs Icy-Veins TBC theory + the project's Frostbolt/AB-debuff
  sources (RULES §15, SOURCES). Informational only (the planner never casts Frostbolt) → exact-match 25/25.
- **Task 6 — placement-reasoning action-plan tags: DONE.** `pressPlan` no longer quotes raw damage deltas
  (`deliberate: +N dmg` / `locked here by its cooldown`); every press row now carries a *why-here* reason
  inferred structurally — **Alignment** (press with the raid call / first burst on the Lust window),
  **Flexible** (a `run.leeway` interval → "press anytime X–Y", + the ATI nudge when enabled),
  **Cooldown-timed** (next use ~exactly one cd later), **Cold Snap** (extra IV window), else **Positioned**
  (no slack). Verified across fights (opener, on-Lust-window, CS chains, flexible gem, cooldown-cycled
  bursts). Output-only → exact-match 25/25.
- **Follow-up (user-directed): the haste trend is now proc-free.** The timeline curve + the schedule's
  peak-haste / AB-cast / at-GCD-floor readouts use the **deterministic** haste (`multNoAti`/`capDn`/`castDn`
  — no averaged Ashtongue), and a **second GCD-floor line "cap if Ashtongue"** (≈+40.8%) shows where a live
  proc reaches the cap. ATI stays in the *scored* effective-AB count; this is display-only (RULES §14/§15,
  ARCHITECTURE). exact-match 25/25.
- **Phase 3 is complete** (all 6 tasks + the proc-free-trend follow-up).

## Phase 5 — AoE phases cracked *(COMPLETE — verdict: burn ×M(N) + two corrections; RULES §9)*

The question: is an AoE phase fully a per-cast damage modifier on the phase, or does it change
placement structure? Settled the Phase-4 way — full-5s-grid enumeration (`brute-grid --aoe/--burn`,
two shapes × N∈{2,3,4,6,10} × h∈{0,150,250}) against a burn-×M(N) control, novel classes sim-gated on
the fixed rig. **Verdict: AoE = burn × `M(N)` + exit-re-ramp + SP-dilution** — layouts coincide with
the control at 21/24 points; the divergences ARE the two corrections. All in RULES §9; the scorer was
already exact (no engine change; exact-match 25/25 untouched, KT plan unchanged).
- **Thresholds (h0 reference):** cluster chases the window at M(N)>1 vs co-resident Lust (N*≈2.5),
  M(N)>1.30 vs disjoint Lust (N*≈3.2); SP buffs lag one N-step (`M_sp ≈ 0.30·N·amp`, knife-edge bridge
  at N=4); haste migrates from M(N)>1 (bare window = floor headroom). Flux-predicted BEFORE the grid;
  N=3 confirmed both directions.
- **Gates (all green):** cluster marginal AE-vs-Lust 0.85/1.15/1.77 at N=3/4/6 (var0≡var10); exit-ramp
  retreat +0.497% vs model +0.501% (same-stream CRN); KT double-IV +10.0% both far seeds (model +9.09%);
  AE interval physics multiplicative (log: 1.25/1.136), IV +5.66% vs 5.71%, Zerk stack +0.24% vs +0.30%
  under var10 (var0 = exact-tie quantization trap, TOOLING).
- **Discovery — Tirisfal 2pc ×1.2 on AB + AP additivity in wowsims** (TOOLING ★, SOURCES): per-cast
  anchor decomposed to the digit; thresholds shift ×1.2 on T5 gear (no class flips; KT robust). Two
  open user calls below.
- KT re-certified: the 1:45 cluster (N=6 threshold case) + double-IV-over-AoE both re-gated with
  `--targets` isolation on the fixed rig; the old "standing model assumption" caveat is CLOSED.

## Phase 4 — understand the optimum, then make the search find it *(COMPLETE — monotonicity certified 0 violations)*

Ran as **A → measure → B → C** (the plan that lived in `docs/PLAN.md`):
- **A · exploration harness** (`tools/explore.mjs`) — **DONE.** Brute-scores every placement of a small buff
  set over a gear-haste sweep (no search → exact optimum), the oracle + rule-finder for the rest. Reproduced
  the theorycraft autonomously (RULES §16) and pinned the coupling: **damage buffs place greedily, haste
  buffs carry the breakpoints — but SP buffs SHIFT those breakpoints** (AP moved IV's exit-Lust from
  ~15→~80 rating). Cap thresholds nailed: 243 / 394 / 789.
- **measure — DONE.** The real ramp gaps: (i) damage buffs on a ramp (model tied, sim docked ≤0.4%), and
  (ii) press timing during ramps (sparse deterministic boundaries — phase-averaging invalid there). Haste
  placement stays ramp-indifferent (theorem + sim, 0.00%).
- **B — LANDED, compromise-less** (user-directed). The exact discrete ramp: cold 0-stack opener + post-gap
  re-ramps, true cast lengths on the board (single source of truth), ramp casts scored discretely at their
  completions (jitter-smoothed), press-snap to real ramp boundaries, integral everywhere else. Haste
  indifference preserved exactly; fixed-layout haste sweep still 0 drops. Full physics battery vs the sim in
  RULES §3. **Harness had to be fixed to gate it**: `ap-cd-at-cast.patch` (real AP-180 in the sim) + the
  runner-provenance trap — see TOOLING; two "refutations" turned out to be harness contamination.
- **C — DONE, certified.** `basinHop` (window-teleport self-consistency guard: the champion's window
  blocks re-based on each other's anchors, each track's natural next cd-tick, and the kill anchor,
  re-polished; iterated with the canonicalizers to a **fixpoint** so the returned plan is basin-stable
  AND canonical), a joint window-move in `polish` (co-pressed clusters cross valleys together), a
  kill-anchored seed, a denser shift ladder (±3/±6 ramp-boundary hops, ±30/±60), top-6 final snaps.
  **`tests/monotonicity.mjs`: 0 violations** across both reference fights, haste 0–150 — and the original
  70→71 bug case now yields the identical stable layout with rising effective casts. The test's tolerance
  is the DESIGNED pressability slack (0.15 effective casts = coPressAlign's castVal/8 "execution beats
  microtiming" trade, which varies with haste); the underlying objective is monotone to float precision.
  Two rounds of golden triage under the strengthening search: first 19 improvements / 0 misses, then the
  fixpoint found deeper basins on 18 more (all strict robust gains) — goldens locked at that final level
  (exact-match 25/25). The search never returns worse than any earlier tool version's plan on any preset.
  **Certified against exhaustive enumeration** (user-directed): on the simplest full-fledged fight (T=80,
  Lust@20, six tracks incl. CS-chain, ~131k-cell staged brute force to 1s resolution) the tool's output
  equals the brute optimum **byte-for-byte** (74.118 eff casts; IV@0 → CS-IV@20 + full cluster@20, Zerk@40
  sequential). Without AP the optimum is a two-layout mirror TIE (damage on either Lust half); AP breaks
  the symmetry toward early, and the sim tilts the same way under kill variance (+0.3% var10) — so the
  earliest-canonical choice (`slideEarliest`) is also the sim-preferred one.
  Search cost: ~20–40s per plan headless (basinHop dominates) — optimize later if the UI feels it.
  **Headroom follow-up (backlog, landed):** `basinHop` gained **ramp-exit anchors** (the first full-stack
  cast after each cold start, read off the champion's own board) — the h160-class "hug the ramp exit"
  descent-valley miss is CLOSED (tool 80.659 > the 5s-grid brute's 80.618: the 1s polish around the exact
  exit out-resolves the grid). Remaining known residuals: the h40/h50 **straddle basins** (IV part-way
  into Lust trading overcap for cluster coupling — a lone-track mid-gap basin no anchor reaches),
  ≤0.033 casts, inside the pressability slack; chase only if a real fight ever lands on that edge.

**UI: leeway bands + reasoning tags PERMANENTLY REJECTED (user decision, post-certification).** A plateau
tie for one press is conditional on every other press staying put — moving it shifts other optima — so
"press anywhere from here to here" over-promises and was cut for good; `leewayZones()` deleted from
`index.html` (git history has it; do not restore). Also decided: NO in-tool exact mode (brute-grid is a
research instrument — generalize its findings into rules); NO finite-mana model (unreliable inputs — the
ramp-aware per-window mana-cost chip on the infinite-mana plan is the ceiling of mana UX). The
haste-graph reference lines stay. **Next: Phase 5 — crack AoE phases (docs/PLAN.md).**

## Done — gear-haste + haste-trinket correctness (this session, user-directed)

The user redirected off the in-tool finite-mana idea (dropped) to **verify the planner is correct with
passive gear haste and haste-rating trinkets, and improve it where it isn't.** Findings + the one change:

- **Physics is anchored at non-zero gear haste.** Rating trinkets (Drums 80 / Skull 175 / MQG 330 / ATI
  145-proc) and passive `hasteRating` share **one** path — additive in the `(1 + rating/1577)` factor,
  then × the %-haste buffs (Lust/IV/Berserking), floored by `intervalOf` — the **same formula
  trust-anchored at h0** (runner plain-AB h0 = 2264.9/944.4, exact). So trinket + gear haste is correct by
  construction; a `--haste N` sweep confirms the interval/floor scale as expected.
- **Haste trinkets place correctly.** The model **avoids** stacking MQG/Skull on the floored opener Lust
  (MQG-in-Lust −9.6k vs the model plan) and instead rides MQG on the **2nd damage burst** (speeding its
  SCB/AP casts — flux, MECHANICS §5 pt 2), beating a lone bare-window MQG (+2.4k). No trinket-placement bug.
- **FIX 1 — the "IV slides out of Lust as gear haste grows" layout now EMERGES** (RULES §5, long
  documented as theory, not realized in the search). As passive rating pushes Lust itself near the GCD
  floor, a haste buff stacked ON Lust overcaps (worth ~0) while the DAMAGE cluster still wants Lust's fast
  casts — so the win is **cluster-on-Lust, IV sequenced/stacked just past it.** The sequential
  window-packing pass now generates two **exit** modes (haste after the window: `exitSeq` sequenced on the
  tail, `exitStack` overlapped at the window end to keep each buff's 2nd cd-tick before the kill) in
  addition to the usual `packIn`. Kept only on a strict robust gain, so **inert at h0** (IV-in-Lust wins →
  goldens byte-identical, exact-match **23/23**) and self-selecting above the breakpoint — no per-haste
  rule. Improves the whole high-haste range in model score, monotonic (only adds candidates).
- **FIX 2 — CS materiality by VALUE not COUNT (what closed the last hold-out, the ~h200 band).** At high
  gear haste the CS-champion carries an **incidental** extra IV parked on the near-floored Lust (worth ~0)
  while CS's real job is to slide a *different* IV fully OFF Lust — but the gate counted IVs, saw the count
  rise, applied the full "adds a use" bar, and vetoed the whole cluster-on-Lust layout back to the glued
  no-CS plan. Fix: trim the champ to the no-CS IV count by dropping its **least-valuable** IV; if that
  costs **< a cast**, the extra IV is incidental → CS is really **repositioning** (sub-cast regime) → keep
  it (RULES §8 last bullet, ARCHITECTURE CS-materiality). **Result: cluster-on-Lust is now consistent at
  EVERY gear-haste level** (h50…h300, 4:00: opener isc@5 throughout; no h200 island). **Sim-verified:
  cluster-on-Lust vs glued = +61/+54 DPS at h250, +53/+55 at h200** (var0/var10, 250k — both agree).
  Exact-match **23/23** (h0 goldens unaffected — the trim only fires where the exit layout wins). See
  RULES §5/§8, ARCHITECTURE (packing modes + CS-materiality value gate).

## Done — finite-mana / conserve-rotation stat weights (this session, user-requested)

The real **gearing** stat weights, computed (options **B + C** of the deleted `docs/PLAN.md`; the
infinite-mana layout engine stays default and untouched — exact-match **23/23**). We did **not** build the
in-tool second engine (option A) — the plan gated it on wanting an interactive conserve planner, which
wasn't requested; the deliverable is the *numbers*, cross-validated, + the harness + docs.
- **Harness:** `tools/genconserve.mjs` (conserve APL — AB-spam in burn windows, Frostbolt filler below a
  mana threshold, Evocation, and **`autocastOtherCooldowns`** so Innervate + Mana Tide actually fire), the
  runner extended with **`--int/--spirit/--mp5`** (`tools/wowsims-patches/runner-main.go`),
  `tests/ep-finite.mjs` (sim finite-difference, option B), `tests/mana-value.mjs` (analytic value-of-mana,
  option C), `tests/finite-weights.json` (locked numbers).
- **Result (300s single-target, SP=1):** **SP 1.00 · Int 1.08 · Haste 0.96 · Crit 0.79 · MP5 0.66 ·
  Spirit 0.54 · Mana ~0** — vs the infinite ceiling on the *same* schedule (Haste 1.44, MP5/Spirit **0**,
  Int 0.56). **Order: SP ≈ Int > Haste > Crit > MP5 > Spirit ≫ Mana** (`docs/EP.md`, RULES §12).
- **The headline correction:** haste is **not** the weak stat for a *conserving* mage — the "0.4–0.6"
  folklore is the **OOM-idle** rotation (pure-spam haste EP **0.03**); with Frostbolt filler the mage never
  idles and haste stays **≈ 0.96**. Cross-validated three ways: the conserve rotation and the export's
  **own native wowsims rotation agree** (haste 0.96 vs 1.00; DPS 1916 vs 1969, −2.7%), and the analytic
  value-of-mana (**~2.2 dmg/mana**) brackets MP5. Fight-length: haste EP 0.80→0.96→1.02 (145/300/420s) in
  EP terms, but **absolute** DPS/rating is highest on short fights; intermissions push haste ↓, regen ↑.
- **The mana economy is the SIM's, not reimplemented** (option B's whole point): JoW, Mana Tide, Innervate
  (5× spirit), Evocation, Vampiric-Touch (+250 mp5), regen — all fire on the player's real export
  (verified in the combat log). The one gotcha: a schedule-only APL suppresses the external mana CDs unless
  it includes `autocastOtherCooldowns` (−6% DPS if missing; TOOLING ★). **Mana never feeds back into the
  infinite-mana layout optimizer** (the layout-first principle holds; this is a sim *reading*).

## Done — AoE crit-proc amplification (Clearcasting → Arcane Potency)

The runner can now value AoE (`--targets N` + `tools/genae.mjs` AE-spam; `--crit` to sweep crit — see
TOOLING). Findings, all sim-measured on the fixed rig:
- The model's AE scoring **core is exact** (base 392 / coef 0.214 / instant-GCD-bound / linear per-target
  / AP ×1.30, matching `arcane_explosion.go`).
- 6-target AE is **super-linear** — **+8.6% per-target at crit 38%** (and it *falls* as crit rises: +11%
  @10% crit → +7.7% @55%). **Talent-isolation (zero Arcane Concentration/Potency) makes it VANISH**
  (gear on-crit SP procs — Tirisfal 4pc etc. — add ~0), so the effect is **entirely Clearcasting →
  Arcane Potency**, which is **always-present and gear-agnostic** (depends only on crit × N × fixed
  talent ranks). Arcane Concentration procs **per hit** (`talents.go`), 3/3 Potency = **+30% crit**
  (sim-confirmed via the combat log), so more targets ⇒ more Clearcasting ⇒ Potency up on more casts.
- **Implemented** (`index.html`): `TALENTS = {arcaneConcentration:5, arcanePotency:3}` + `aoeCritAmp(N,
  crit)` = `critMult(crit + qCC(N)·0.30) / critMult(crit + qCC(1)·0.30)`, `qCC(N)=1−0.9^N`; applied only
  in the AoE damage branches (`simulate` ~734/795). Single-target returns amp 1 (**no plain golden
  moves**; exact-match 16/16, KT unchanged). It credits **~75–80%** of the sim's measured amplification
  across the realistic crit range — right magnitude, right crit-direction, **never over-credits** (the
  ~20% shortfall is second-order proc-chain dynamics, kept as a conservative margin). Gear on-crit SP
  procs stay unmodeled (negligible for AoE weighting, and transient).

## Status (as of the current work)

- **Customizable timeline + debug export LANDED (07-25, user-requested — UI only, engine untouched).**
  "Customize" (labelled "Unlock timeline for customization" until the 07-26 toolbar pass) makes the burn-timeline presses drag-editable (release snaps the
  intent to the nearest whole second); the model plan stays visible as dashed ghost bars; a second tile
  row compares the custom layout to the model (Δ% damage + the four headline metrics with deltas, live
  during the drag via memoized `simulate()`); re-locking validates with `repair()` (violations listed +
  flagged, auto-fix offered) and regenerates the activation schedule/copy-text from the
  custom plan. "Debug export" copies input + model output + custom timeline + stats/deltas/validation
  as one paste, including an `evalsched`-ready JSON block (round-trip verified against
  `tests/evalsched.mjs` — identical totals). Full internals: ARCHITECTURE "Timeline customization".
  Exact-match: 25/25 unchanged (the default render path and copy text are byte-identical without opts).
- **Crash fix (user-reported "Page Unresponsive" kills): the engine now runs in a Web Worker (latest,
  user-directed).** The finishing stage of `optimizeAsync` (top-6 polish, `basinHop` fixpoint,
  tie-break/normalizer stack) ran **synchronously on the browser main thread** — ~minutes on long
  fights (KT), which trips the browser's page-kill. Two layers of fix (ARCHITECTURE):
  (1) the finishing stage is an async IIFE with **throttled yields** (`scheduler.yield` /
  `MessageChannel`, ≤ every ~40ms of compute; `performance.now()` gates only WHEN the thread yields,
  never any computed value — determinism untouched); (2) the file is split into
  `<script id="engine-src">` (pure engine) + UI script, and `runOptimize` runs the heavy call in a
  **Blob Web Worker** built from the engine tag's own text — single-file preserved, main thread never
  computes, in-flight runs are terminated on re-run, in-page fallback if workers are unavailable.
  Worker-vs-page plans verified **byte-identical**. Same commit, display honesty (user-directed,
  RULES §3): the schedule/copy-text/press-board print, sort, and group by the **fire-time second**
  (`floor(actEff)`) instead of the intent — an opener burst with intent 0:04 firing at 5.4s now reads
  "0:05", co-rowed with a 0:05 Lust call (this also killed the "0:05 Bloodlust printed above 0:04
  Icon" row-order bug, and replaced the short-lived `snapRampIntent` intent re-snap with something
  strictly simpler).
  **Follow-up (user: "still incredibly slow, can't even copy"):** the sensitivity panel's "what if
  the kill runs longer" hint ran a SECOND full `optimizeAsync` on the main thread after every render
  — minutes of frozen-while-looking-done on long fights. Moved to a throwaway **aux worker**
  (`runOptimizeAux`; never falls back in-page). Verified: main-thread latency ~4ms while the aux
  crunches, Copy works under load. The remaining slowness axis is the **optimizer's own runtime**
  (minutes on 6-intermission fights, basinHop dominates — a known backlog item; the page now stays
  fully interactive throughout).
  **Sensitivity panel iterated three times live, then largely REMOVED (user decisions).** The
  "kill runs longer" lines went arithmetic → plan-anchored → probe-diff (re-optimize at candidate
  lengths in an aux worker, report the actual plan restructure) — and then the user cut the whole
  aux-worker analysis: **"remove the second 'alternative plans' worker altogether — not worth the
  cost."** What remains: the cheap arithmetic **banks-on** line (user-approved) + the squeak note;
  nothing computes after the results render. **The Cold Snap commentary note is also REMOVED
  entirely** (panel + copy text; the schedule's "Cold Snap → IV" rows carry the action; the
  engine's materiality logic that DECIDES the spend is untouched). If a restructure-breakpoint
  feature is ever wanted again, the probe-diff design is in git history (commit 21791d2).
- **Search parallelized across CPU cores (user: "make it faster without losing quality").**
  Profiled KT: 285.7s total, **`basinHop` teleport-polishes = 265.5s (93%)**, seed phase ~10s,
  5.7M simulate calls. Now the page spawns `min(8, cores−2)` pool workers (dumb polish servers on
  transferred MessagePorts; engine-side `poolInit`/`poolMap`) and `optimizeAsync` fans the seed
  polishes and hop teleports across them with a **first-accept-in-iteration-order** reduction —
  reproduces the sequential accept sequence exactly, so pooled ≡ sequential **byte-identical**
  (verified on 2:45 and KT: val 617033.2, identical plan; exact-match suite runs the sequential
  page path and is untouched). **Plus a polish-result cache with orchestrator-side dedupe**
  (`polishCacheFor`/`sigOf`/`teleportRep`, per-cfg WeakMap): polish() is pure, and the
  hop↔normalize fixpoint re-teleports near-identical candidates every round — repeats now cost a
  Map lookup instead of ~0.3–1s (cached entries cloned at accept so downstream passes can't
  corrupt them; both pooled and sequential paths share the cache, so tests speed up too).
  Container (2 pool workers): KT 285.7s → 201s (pool) → **134.4s** (pool+cache) → **83.9s**
  (+ a `simulate()`-level memo — the wrapper over `simulateRaw`, collect=false results only
  (plain number bags, no caller mutates them — verified), keyed `cfgSigOf(cfg)+sigOf(schedule)`
  so pool workers hit despite per-job cfg clones, bounded by wholesale clear at 120k entries;
  the hill-climb's final all-rejections round and the tie-break incumbents are the repeats).
  Scales with cores (~25–40s expected on a typical 8-core; short fights ~2s). Remaining depth if
  ever needed: parallelizing polish's inner shift ladder. The pool commit is suite-certified
  (25/25, byte-identical goldens); cache/memo commits certified the same way. **Hard product
  rule (user): NOTHING computes after the results render — no speculative or anytime refinement;
  what's shown is final.** (This is why the speculative concurrent Cold-Snap comparison was NOT
  built: its mispredict case would keep pool work running past the render.)
- **Every 2-trinket kit brute-certified (user-directed): 20/20 PASS, zero misses** — all six pairs
  from {Icon, Serpent-Coil, Skull, MQG} full-grid-bruted (`brute-grid --pair --tool`) at
  h∈{0,40,160,240} vs the real optimizer. Worst deficits −0.046/−0.051 both at **h40** (inside the
  0.15 slack): the straddle-basin soft spot is **kit-universal**, documented, priced. Record +
  new pair physics (MQG floors like IV; Skull fits-under-cap like Zerk) in RULES §16/§17.
  Haste-ladder instrument (`tools/haste-ladder.mjs`) added: full-grid brute marched 0→300 with
  automatic breakpoint bisection (≤10 rating) + continuous tool certification — the exhaustive
  version of the §16 morphology map; results folded into RULES when each run completes.
- **Honest progress display (user: "at least make the loading bar accurate").** onProgress now
  carries a **stage label**; the engine emits real within-stage fractions banded by the measured
  cost profile (Trying N starts (k/N) → Snapping to whole seconds → Basin-hop (main sweep, real
  sweep fraction) → Grooming → Re-hop & canonicalize (round r, halving bands)), and the
  **No-Cold-Snap comparison** — a genuine second full run — reports as its own labeled pass with
  an honestly RESTARTED bar (the UI resets its monotone clamp on a label change) instead of
  stalling near-done for its whole duration. The stage label rides the Run button's text.
  Display-only; the exact-match harness passes a no-op callback.
- **`basinHop` ramp-exit anchors landed** (the backlog headroom item): h160-class ramp-exit-hug basin
  CLOSED; **Kael'thas moved** to a strictly better plan (+354 robust, `IV@106/126/380`,
  `AP@120/380`, cluster mirrors) and was re-locked. h40/h50 straddle residuals (≤0.033, inside
  pressability slack) stay documented, not chased.
- Planner is deterministic, ~0.4%-accurate, with **16 sim-verified golden regression cases** (green).
- **Done this session — the wowsims harness audit AND the drop-bug fix + full re-validation** (W1 +
  W1.5). Rig rebuilt from `ade9f39` (`-tags with_db`), trust-anchored to `wowsimcli`. Overturned two old
  claims (off-GCD "collision" is a myth → drop the offsets; `SIMLOG=1` combat log exists) and corrected
  the stats protocol (seeds 11/19 are the same sample). **Headline: a real harness DROP BUG** —
  `APLActionSchedule` silently dropped an on-cooldown press (TOOLING ★), the entire Vashj "3-icons-win"
  (it deleted the 4-icon plan's terminal icon). **FIXED** (`tools/wowsims-patches/apl-schedule-strict-
  ready.patch`: gate the schedule on strict `spell.IsReady`). Re-validated all 16 — zero regressions;
  intermission goldens were badly under-executed and recovered **+18..+26** (4:00-multi/KT/Vashj); the
  Vashj 4-icon plan is vindicated on the fixed engine. Exact-match still 16/16 (model untouched).
  **Also found + now RESOLVED: AP's cadence in the sim is ~195s** (`arcane_power.go` starts the cd on
  buff-expire), but **real TBC AP is 180s cd-on-activation** (user-confirmed) — the **model was right**
  (cd180, unchanged); the sim's 195 is a wowsims quirk, so the sim is a known blind spot for multi-AP
  timing (SOURCES / TOOLING ★). **And W2a LANDED:** a coherent-cluster carry in the "Let the
  stacks build" pass now emits the ramp-aware **4:05 / 6:05** Vashj layout (icon@4:05, terminal
  icon+gem+AP@6:05, IV@6:00 stays); only Vashj moved, sim-gated new ≥ old on the fixed engine (+0.8 var0
  / +0.3 var10). So the post-ramp-exit shift (RULES §9, long "not implemented") is now real. Docs are the
  authoritative record; `index.html`/`genapl.mjs` unchanged, goldens still 16/16.
- Recent landed work: cast-rate-integral scorer; timeline redesign; spellpower-overlap forward-slide;
  **known-kill planning** (then a half-cast kill window — ⛔ retired 07-27 for the boundary credit,
  PHASE12 §9 / RULES §8); **full docs set** so `/clear` is safe;
  **Debugging-presets UI** (every golden is a live-computed preset off the single `GOLDEN_PRESETS`
  table that also feeds the exact-match suite); **sequential buff-into-Lust packing** (below); **the
  placement / containment workstream** (below — 3:20 +3.6, 5:00 +2.4, both sim-gated & re-locked).
- **Golden set recurated** (this session, user-directed): the two mislabeled plain late-Lust fights are
  now neutral `6:00 lust 4:20` / `5:45 lust 4:20` (kept as clean phase-free packing regressions); the
  **real** encounters were added — `KaelThas 7:00 lust 4:20` (early intermissions + a 6-target AoE +
  a post-Lust intermission) and `Vashj 6:30 lust 5:45` (six intermissions); the `2:40 @150 haste`
  case was **removed** (the IV-slides-out breakpoint isn't pinned yet — don't lock it).
- **Boss presets = the real phase (this session, user-directed).** Added `BOSS_PRESETS` (the 10 actual
  current-phase encounters — Hydross … Kael'thas — length/Lust/phases from the player's logs) as a
  **baked + exact-match-tested** strip ("Boss presets", accent); the abstract regression fights stay as
  "Debugging presets" (muted); the localStorage user strip was renamed "Boss presets" → **"Custom
  presets"**. The three boss encounters that were in `GOLDEN_PRESETS` under abstract names (4:00-multi,
  KaelThas, Vashj) **moved** into `BOSS_PRESETS` (renamed Al'ar / Kael'thas / Lady Vashj), no dup.
  `exact-match.mjs` now locks **both** arrays (23 cases: 10 boss + 13 debug); all reproduce the user's
  pasted plans exactly (they were generated by the tool). **Phase EP** computed over the 10 at the
  0-haste reference (`tests/phase-portfolio.json`): **SP 1.00 · Crit 0.72 · Haste ~1.38** (`docs/EP.md`);
  re-run at real gear haste before acting (haste falls as gear haste rises).

## Icon-count / SP-alignment — RESOLVED: the sim was WRONG (HARNESS DROP BUG), 4-icon plan is correct

**MECHANISM NOW PINNED (harness audit, TOOLING ★).** The artifact is not vague "resume mis-scoring" — it
is a concrete harness bug: `APLActionSchedule` **silently DROPS an on-cooldown press**. On Vashj the
icon@240 quantizes to 242.5 (the [3:30–4:00] exit ramp cast) → its 120s cd runs to 362.5 → the
**terminal icon@360 is dropped** (combat log: queued to 362.5, then no icon aura). So the golden's
"4-icon" plan was really firing **3** icons, missing the high-value 6:00-burst one — *that* is the whole
"−4.2 / drop-the-icon-wins +4.8" (deterministic, stable across independent far seeds). **With the drop
fixed (icon-track prototype) 4 icons = 1576.6 beat 3 icons = 1573.1.** The 4-icon plan is correct — as
the user and cast-counting always said — and the *fix is in the sim, not the model*.

**Old belief (overturned):** "3 icons @ 0/3/6 beats 4 icons @ 0/2/4/6, so the golden is sim-suboptimal."
Wrong: the sim was deleting the 4-icon plan's terminal icon. Do **not** re-open this as an optimizer
task. (Note the earlier "RNG-desync" hypothesis for the +4.8 was *also* wrong — far seeds proved it
stable/deterministic; it's the dropped use.) The drop was fixed + every golden re-validated (W1.5, done —
the drop was systematic, it also lost AP/IV/Zerk uses; no golden regressed, exact-match still 16/16).

- **Cast-counting settles it (the model's method; MECHANICS §3 "score by cast-counting").** Value each
  icon by `(casts it catches) × (multipliers there)`, relative to a bare-window icon:
  - **1 icon @3:00** rides IV@180 (+20% haste ⇒ more casts) **and** AP@180 (×1.30) — **and** Berserking@180
    for the first half of its window (a further +10% haste those 10s, easy to miss). ≈ **~1.5–1.6×** a bare
    icon.
  - **2 icons @2:00 + @4:00** land on bare windows (no IV/AP): ≈ 1.0× + ~0.9× (the 4:00 one a hair fewer
    casts on the post-intermission ramp) ≈ **~1.9×**.
  - **1.9 > 1.6** ⇒ two icons catch more effective ABs. The model agrees: 4-icon scores **+874** over 3-icon
    (≈ 0.39 cast, within `QTOL`). SP is **linear, not exponential** (`cast_damage = (base+SP·coef)·mult`),
    so co-locating icon+gem at 3:00 does **not** super-linearly help — no tipping.
- **So the sim's "3-icon +5.4" is bogus, and it hinges on a single artifact:** icon@4:00 posts a marginal
  **−4.2** in the sim (dropping it *raises* DPS) where cast-counting says it should be **~+5**, like the
  net-**+6.5** icon@2:00. An off-GCD, macro'd buff (fires *between* casts, never clips — MECHANICS §3)
  **cannot** be net-negative with no alignment/cooldown reason. Ruled out this session: clip (ISC is
  off-GCD/instant, wowsims source-confirmed it doesn't touch the hardcast), mana (900k avail, ~100k used),
  cooldown coupling (icon@6:00 fires either way), shared trinket CD (gem uses its own timer), and
  sub-second offset (swept .00→.15, all ≈ 1563.7). The residual is a **sim-setup bug at the intermission
  resume** (how `genapl`'s AB-gating / the runner restarts casting at `seg.end`) — the runner has no
  combat-log flag to pin it. **The model / cast-counting is the referee for intermission-exit placement,
  not the raw sim.**
- **Both prior "fix" attempts chased this artifact and were reverted** (nothing committed): (1) a generic
  "concentrate SP within QTOL" tie-break — over-fired, moved five plain-fight goldens (dropping *useful*
  cold icons worth ~+9 each); (2) a scoped `dropRampCold` "drop the exit-ramp icon" tie-break — reached the
  (wrong) 3-icon plan cleanly but was fixing the artifact. Do not resurrect either.
- **Real, minor, NOT-yet-actionable refinement (separate from the artifact; user-confirmed as the ideal).**
  There *is* a small true gain in shifting a damage/SP cluster that lands right on an intermission-**exit**
  a few seconds later so it dips into **already-built AB stacks** instead of the ramp — e.g. icon@4:00 →
  **4:05** (= 245, so its 20s window still clears the next intermission at 4:25 — do NOT push to 248),
  moving the terminal **icon+gem+AP** 6:00 → **6:05** to make cd room (**the 6:00 IV stays put**; the
  downstream absorbs the shift free), strictly raising that icon's uptime over built stacks. **Sim-checked
  this session (controlled G-vs-user, 50k):** the whole shift is **+0.6–0.7 DPS over the golden, stable
  across var0 AND var10, seeds 11/19** — small but real and consistent, so it is NOT washed out by the
  exit bug (both plans share the same resume; the shift is the only diff). The blocker is the **model**:
  it's ramp-blind (steady 3 stacks), so it can't *see* that 4:00 sits on a rebuild ramp while 4:05 doesn't,
  and can't produce the layout. Needs a **ramp-aware exit** tie-break (shift a damage/SP press off an
  intermission-exit second onto built stacks when its window still clears the next downtime). Small
  (+0.6); do not prioritize over the payoffs, but it's now a *verified* gain, not just a hypothesis.

## DONE — placement REASONING annotations (Phase 3 task 6)

> ⛔⛔ **BUILT, THEN PERMANENTLY REJECTED — kept only as the record of a decision, not as a description
> of the code.** `leewayZones()` and `pressPlan()` no longer exist in `index.html`: the leeway bands and
> the reasoning tags were cut for good by user decision (see "UI: leeway bands + reasoning tags
> PERMANENTLY REJECTED" above, and PHASE13 §9), and the Pressboard rework deleted `pressPlan` with the
> live board. ⚠ The present/past tense below is the tense these entries were WRITTEN in and is
> preserved deliberately — do not read "Landed"/"Building" as a claim about the current tree, and do
> not go looking for either symbol.

**Landed.** `pressPlan` (~3271) now emits *why-here* reasons — Alignment / Flexible (leeway) /
Cooldown-timed / Cold Snap / Positioned — replacing the raw `deliberate: +N dmg` / `locked here by its
cooldown` deltas. The Flexible reason reuses the `leewayZones` interval (task 3), and the ATI "nudge onto a
proc" rider appears on flexible rows when Ashtongue is enabled. Output-only (exact-match rebuilds from
`scheduleRows`), goldens untouched. Original spec kept below for reference.

Replaced the copy-as-text / schedule tags that quoted raw damage deltas — `deliberate: +N dmg vs one press
at T`, `locked here by its cooldown` (`pressPlan`, `index.html` ~3082) — with a short **why-here reason**
per press. Those deltas don't help the reader; the reasoning does (it's the "trustworthy" goal). This is
**output-only** and the exact-match suite ignores these tags (it rebuilds the plan from `scheduleRows`,
setup+windows+times only — `tests/exact-match.mjs` ~63–78), so **it does not touch goldens**. Reason
categories, from the user's Vashj 6:30 worked example (map each press to one):
- **Cooldown-timed** — "used here so the cooldown comes back in time" (for the 3:00 / 6:00 burst). For a
  press whose second is set by its own cd feeding a later scheduled use (opener IV / AP / Zerk / Icon).
- **Alignment** — "used here to align with the other buffs [of this burst]." For a press co-located onto a
  burst it strengthens (the opener gem).
- **Count-vs-align tradeoff** — "2 unaligned uses here and @4:00 beat one at 3:00." State the spread call
  the planner resolved (the icon-count decision).
- **Flexible / earliest** — "can be pressed anytime from now to X:YZ." When a press is bound only by "be
  ready for the next use," report the slack; `X:YZ = nextScheduledUse − cd` (clamped ≥ now). Not triggered
  on Vashj, but the general case (RULES §10 earliest tie-break) should say so.
Keep the Cold-Snap `csNote` (held / spent) and the squeak note — those already read as reasons. Infer the
category **post-hoc** from the schedule + cooldown structure (co-pressed? is its cd the binding constraint
on a later use? does it have slack before its next use?). Grounding: `pressPlan` ~3082, `scheduleRows`
~2757, copy-text handler ~2819, on-page render `renderSchedule` ~2795.

## Also planned

- **RESOLVED — the "model over-values SP-count vs concentration" thesis: the bias was RAMP-BLINDNESS,
  and Phase 4·B fixed it.** The 2:15 far-Lust case re-examined on the fixed rig with the exact-ramp
  model: the model now agrees with the (old, correct-in-direction) sim — 1 aligned icon beats 2 naive
  icons (model +0.16 casts; sim +0.1% var0 / +0.2% var10) because the naive icon@0 sat on the pull ramp
  the blind model over-credited. Better still, the tool's own output — a **double-dip** (both icon+gem
  uses, opener + terminal, Lust left mostly bare) — beats BOTH by **+0.4% var10, sim-verified**. Vashj's
  4-icon side of the thesis had already resolved as a harness artifact. Case closed: SP crediting is
  correct, no tie-break needed, and the old §4 far-Lust "limitation" is retired (RULES §4).
- **Coherent intermission/AoE handling** (`RULES.md` §9): make placement/tie-break passes downtime-aware
  so a window doesn't *usually* begin in a dead zone — as a **strong default, not an invariant** (pressing
  early into downtime can be right when it's the only way to get a cooldown back for a bigger later window;
  the effective-AB count decides). Amplifies the icon tie-break above (intermission ramps make off-haste
  SP-buff windows even weaker).
  - **Half DONE — the "don't *begin* in the dead zone" half landed** (`dodgeDowntime`, this session). A
    final normalizer slides any press whose window begins inside an intermission to the exit, model-neutral;
    4:00-multi's Cold-Snap IV 3:47 → 3:49 (var0 exact wash, var10 +0.2, seeds 11/19; only mover). See RULES
    §9 / ARCHITECTURE.
  - **DONE (Phase 4·B) — the post-ramp-EXIT devaluation, solved in the PHYSICS, not a tie-break:** the
    exact discrete ramp scores the slow exit casts truthfully (damage at completions) and the press-snap
    lands exit presses on the real sparse boundaries — so a damage window on an exit ramp is docked for
    exactly the completions it misses, automatically. The regenerated Vashj golden (its damage buffs
    stepping past the exit boundaries, +0.9 effective casts) is this fix landing; the exit-delay class is
    sim-confirmed +0.39% on the fixed rig. See RULES §3.

**Done — the PLACEMENT / containment workstream (this session).** Overlap is interval **containment**,
not start-coincidence (RULES §11, MECHANICS §5 pt 5). Three surgical, sim-gated changes to `optimizeAsync`;
**only the two intended goldens moved** (14 byte-identical), each re-locked on wowsims new ≥ old at var0
**and** var10, seeds 11/19, 250k:
- **`permute` in sequential window-packing (~1948):** sweeps the *order* the haste buffs sequence across
  the window (not just biggest-first). Leading with the shorter buff keeps a tail buff's 2nd cd-tick
  before the kill. **3:20** → `Zerk@0:05` in Lust, `IV@0:15` after, `CS→IV2@3:00` (**+3.6** var10 / +10.7
  var0; golden 2651.1 reproduced exactly).
- **Cold-Snap materiality `csAddsUse` gate (~2157):** CS that only **repositions** the same IV count (vs
  the best no-CS plan) is **free** (sub-cast bar), not held behind the full "≥ one cast" bar — that was
  what vetoed the 3:20 opener. CS that genuinely **adds** an IV keeps the full bar. RULES §8.
- **`spreadLoneHaste` normalizer (~2070):** a *lone* haste use (intersecting no damage/SP buff) is
  position-independent → slides back to its earliest natural cd tick, model-neutral. **5:00** → the free
  CS IV banked at 4:25 spreads to its 3:05 natural tick, re-homing the burst-IV onto 4:05 (**+2.4** var10
  / +11.6 var0; golden 2625.1 reproduced exactly). The naive spread *loses* ~8 DPS (leaves the 4:05
  burst with no IV) — only the lone IV moves; burst-riding IVs stay pinned.
**4:00 W4** was already at its canonical spot (cluster @3:25 co-presses CS→IV+Berserking, an exact sim
tie with 3:20) — untouched, confirming the normalizer is DPS-neutral by construction. See RULES §8/§11,
MECHANICS §5 pt 5, ARCHITECTURE finishing passes.

**Done — sequential buff-into-Lust packing (the SEARCH fix).** A window-packing move in `optimizeAsync`
(last structural pass, ~1913) assembles the packed burst at each haste raid-call: damage cluster on the
window, haste buffs on sequential slots (IV @anchor, Berserking @anchor+20), sweeping which IV use lands
on the anchor; kept only on a strict robust gain with `sameCounts`. Fixed `6:00 lust 4:20` (**+8.5 DPS**)
and `5:45 lust 4:20` (**+13.9 var0 / +5.7 var10**), both sim-gated and re-locked; the 12 early-Lust
goldens and the two real boss fights were **untouched** (their bursts were already on Lust). Placing it
last meant no defensive rework of the eviction / `nulled` vetoes was needed (nothing runs after to undo
it). See `docs/ARCHITECTURE.md` and RULES §4.

**Done — theorycraft regrounded on "effective ABs" (this session).** Reframed the docs so every rule is a
*consequence* of maximizing effective ABs cast, not a hardcoded law (`CLAUDE.md` goal, `MECHANICS §4`).
Softened the over-strong absolutes the user flagged: Lust-packing is the usual *method* (§4), not "THE
rule"; the intermission invariant is a strong *default*, not a "never" (§9). And **sim-settled the
haste-on-haste question**: isolated pure-haste Berserking **inside** Lust vs **after** it scores an
identical **2367.4 DPS** (0 gear, var 0, 300k, mana-independent) — a **wash, not a synergy**; the value
of haste-on-Lust is *flux* (speeding damage/SP casts) or banking before an early kill, never the product
(RULES §7, MECHANICS §5.3). The planner already sequences correctly, so no code change — a doc/mental-model
correctness fix in service of generalisability.

**Done — model↔sim relationship reconciled (this session, user-directed).** The planner knows every
cast/buff/timing deterministically, so it computes **effective ABs cast** exactly — that count is the
**objective and the arbiter** for comparing two lines; the tool is a maximization function over it. The
sim's role is **calibration**: anchor the physics (trust-anchor), cover the count's blind spots (ramp /
mana / AoE / multi-AP timing), and verify novel/suspicious findings — **not** a routine per-golden gate.
Replaced the stale "trust the sim over the model / the sim wins / the sim is the referee" wording across
`CLAUDE.md`, `docs/TOOLING.md` (new **Methodology** section up top), and `RULES.md`. Per the user's
correction, the framing is explicit that **the sim was rarely *wrong* — we often used it improperly**
(the drop bug, cargo-cult offsets, count-changing A/Bs on nearby seeds were *our* faults); a clean
cast-count vs a contradicting sim number with no blind spot in play is a **sim-setup audit trigger**.
Also flagged the **self-confirming-oracle** risk (proactively sim the blind spots + periodically
re-anchor) and the **scorer-vs-optimizer** distinction (this settles the scorer; search-completeness is
a separate axis). Docs-only, no code/golden change.

**Done:** ~~Boss-preset UI = the golden set~~ — landed. `GOLDEN_PRESETS` drives both the UI strip and the
exact-match suite; new fights are added by editing that one array.

## Golden-review findings (from the preset walkthrough — sim-verified)

- **FIXED — off-GCD burst now co-pressed on one second (7:20 Window 6: 6:21 → 6:20).** The burst
  emitted IV at `6:20` but Icon/Gem/AP at `6:21`. Diagnosing it split the "cluster" into two cases:
  Icon at 380 vs 381 was an **exact model tie** (Δ ≈ 1e-10 — the back-to-back IV+CS→IV keeps casts
  IV-hasted throughout), but Gem/AP scored **+50 at 381** — *not* a tie. The macro-snap missed all of
  them because `isAnchored(IV@380)` false-negatives when the Cold-Snap chain lets a −1s nudge drop the
  chained IV@400, and the overlap-alignment pass then re-staggered them. **Sim resolved the +50: it is a
  pure model artifact** — full-fight wowsims has all-at-6:20 == gem/AP-at-6:21 to the decimal (2565.8
  var0, 2568.2 var10, seed 11, 250k). Fix: a final `coPressAlign` pass (runs on the returned schedule
  AND the Cold-Snap chain candidates) snaps a damage/SP press onto its nearest earlier haste second
  **within 3s** when the model cost is **≤ ⅛ cast**. The 3s window protects genuine staggers (the 3:20
  gem sits 5s off its IV; the KT Icon-onto-AP slide ~20s off Lust — both untouched, both still green),
  and the sub-cast cap rejects any real trade. Only the 7:20 golden moved; sim-gated free; re-locked.
- **FIXED — the whole placement / containment workstream landed** (3:20 free-CS opener sequencing +3.6,
  5:00 lone-IV spread +2.4, 4:00 W4 confirmed already-canonical). Overlap is interval **containment**, not
  start-coincidence: the planner now (a) treats containment-equivalent placements as ties and picks the
  consistent member (`spreadLoneHaste`), (b) spends a **free** Cold Snap to sequence/spread IVs when it
  gains-or-ties (`csAddsUse` materiality gate), (c) sequences opener haste into Lust via a haste-buff
  **order sweep** (`permute`) instead of stacking it over the floor. Generalised, not per-golden — only
  the two intended goldens moved, both sim-gated new ≥ old (var0 & var10, seeds 11/19). See the **Done**
  entry above, **RULES §8/§11**, **MECHANICS §5 pt 5**, and ARCHITECTURE finishing passes.

## Open questions / known limitations

- **SETTLED (user call, 07-24) — plan rows print the FIRE time, and that stays.** The row second is the
  cast boundary where the buff starts paying, not the press *intent*. Worth knowing
  when reading a plan: on `2:00 lust 0:05` the whole cluster has **intent 5.00, identical to the Lust
  pin**, but fires at **6.50** (the AB that began at 4.67 ends there; a buff pressed mid-cast cannot
  affect the cast in flight), so it prints `0:05 Bloodlust / 0:06 Icy Veins…`. That is **one macro at
  0:05**, not a deliberate stack-building delay — the gap is the in-flight cast, and it is exactly the
  information the fire time is meant to convey. Asked and answered: **do not** add a "(press 0:05)" tag
  or flip the rows to intents.
  > ⚠ **AND THE ROWS DO NOT ACTUALLY PRINT THE FIRE TIME — 1.8 % of the time they print the wrong
  > second (PHASE12 §6.13, measured over 285 plans / 3060 presses).** What is printed is
  > `floor(actEff)` — the floor of the **press** moment — while the fire moment is `auraAt`, the
  > boundary *after* it. When flooring walks back **past a cast boundary** the two disagree and
  > pressing the printed second fires a whole cast early, buffing a window the model never costed
  > (`isc+mqg T=281 h=230`: model fires 26.58, the plan prints **25**, pressing 25 fires 25.49 —
  > correct answer **26**). ⇒ **The ruling above is right and the implementation does not yet meet it.**
  > The fix is to print **`floor(auraAt)`**, as its **own field** rather than by redefining `actEff`
  > under its other callers; a correct whole second always exists (cast intervals are ≥ the 1 s GCD
  > floor, so **0** presses are unfixable). Deliberately queued **after** the model per user ruling —
  > `docs/PHASE13.md` §7.
- **Model mis-valuation (documented, not patched):** the scorer ranks the *partial* pack
  (IV-in-lust-alone) above "IV out" (+935 model) though the sim calls it a −0.7 wash — it over-credits
  the damage flux through the floored IV window. It does NOT block the full pack (model ranks full >
  partial), so the search fix renders it inert; touching the floored-flux crediting risks the
  validated goldens. Revisit only if a case needs it.
- **Align-vs-twice breakpoint** should be pinned by sim per fight, not assumed (when does "two
  unaligned uses" beat "one Lust-aligned use"?).
- ~~Intermission-golden optimality re-gate~~ **DONE** (this session, fixed rig). **4:00-multi:** golden
  (icon2@186, CS→IV@229) = 2096.9 ≥ icon2@180 (2095.6) and == CS→IV@227 (exact wash — confirms
  `dodgeDowntime` is legibility-neutral). **KaelThas:** golden (280/400) = 1718.7 vs TOOL 260/396 (1718.5)
  and 280/402 (1718.2) — a 3-way tie within CRN noise (containment-equivalent icon timings), no
  regression. Both plans stand.
- **Tirisfal-2pc as a tool input — RESOLVED (user call): implemented as the `ck-t5` gear checkbox.**
  Applies ×1.2 to Arcane Blast only (damage sites + both plain-AB normalizations, so single-target plans
  AND effective-AB counts are exactly INVARIANT — verified: identical plan, identical 87.596 count on/off)
  and +20% AB mana in the per-window chip (the real set bonus raises cost too). Its main effect is
  re-pricing AoE phases (`M_eff = M/1.2`): verified at the N=3 knife-edge — the toggle flips
  cluster-on-AoE (+0.607) to cluster-on-Lust (−0.052). Default off; goldens untouched. Pooling with AP:
  ADDITIVE (resolved below).
- **AP × T5-2pc pooling — RESOLVED: ADDITIVE (user ruling).** Googled/searched: no public 2.4.3 source
  decides it; the mechanics argument (both are percent-damage aura modifiers, which SUM in the client's
  modifier pool) matches wowsims' implementation, and the user ruled "trust wowsims if unsure." The
  model's T5 toggle pools additively (`dmgMult + t5add` in `simulate`); sim gates on the T5-wearing
  reference export are faithful as-is.
- Sim harness (`runner`, gear export, wowsims source) lives in the ephemeral scratchpad — see
  `docs/TOOLING.md` for rebuild.
