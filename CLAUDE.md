# CLAUDE.md — Arcane Burn Planner

Read this first. It orients you on the project; the `docs/` files hold the details.

## What this repo is

A **TBC 2.4.3 Arcane-mage cooldown-overlay planner**: `index.html` (open it in a browser — no build,
no deps). The app is still ONE self-contained file **today, but that convention is RETIRED by
decision** — `docs/PHASE13.md` §5.1 splits it (design in `docs/archive/12-phase11-platform.md` §2),
gated on plans staying byte-identical. Treat
"single-file" as a fact about HEAD, not a constraint to defend.

⛔ **THE SIMULATOR IS RETIRED (user decision, 2026-07-30)** — *"I actually want you to retire the
simming, it's doing more harm than good. I think we have the function/equation locked down and from now
on we're better off on our own."* Deleted from the repo: `sim/` and the in-page "Check in benchmark sim"
button, `tools/bench.mjs`, `genapl*`, the wowsims runner patches, the whole `xval-*` cross-validation
family, the sim tests, and two of CI's three jobs. The deploy publishes **`index.html` alone** again.
⚠ Their reasoning is NOT gone — `docs/BENCH.md`, `GEAR-AGNOSTIC.md`, `TOOLING.md` and `ACCEPTANCE.md`
are archived whole as `docs/archive/14`–`17`, each bannered. Read them as evidence about a retired
instrument; **every command in them is dead**, and a `command not found` is the doc being old, not your
setup being broken.
★ **What replaced it.** The sim's stated job was *"to FALSIFY THE SEARCH, not to arbitrate the scorer"*,
and **brute-forcing a cell's neighbourhood does that job better and instantly**: §8s found a
0.1022-cast search miss in seconds, where a sim duel resolves ~0.02 casts at best against its own seed
noise. Ground truth is now `docs/ESTABLISHED-FACTS.md`'s closed forms (checked by
`tools/law-check.mjs`), the scorer's agreement with itself (`tools/self-consistency.mjs`), and the seven
declared layouts (`tests/anchors.mjs`). ⚠ **The one real loss is the model's blind spots — mana and AoE
weighting — which nothing now measures.** That is a known, accepted gap.

You enter a fight (length, Bloodlust
timing, intermission/AoE phases) and it computes the **optimal moment to press each on-use
cooldown** (Icy Veins, Arcane Power, Icon of the Silver Crescent, Serpent-Coil gem, Berserking),
plus a burn timeline, a per-window activation schedule, and a copy-as-text plan. Alongside it:
`tests/` — **eight tests** (`tests/anchors.mjs`): the eight layouts the user declared exactly. The goldens
and the plan-shape suites are **deleted** (user decision 07-28, restated twice); the sim gates are
**deleted** (07-30, above). What is left beside `anchors` are the two scorer gates —
`tools/law-check.mjs` (the scorer vs the algebra) and `tools/self-consistency.mjs` (the scorer vs
itself) — which are not claims about which layout is right.

## The end goal (why this exists)

**The planner itself is the goal** — a tool that, given what you know and control going into a fight
(fight shape, raid buffs, gear, trinkets, haste level), lays out how to press every on-use cooldown to
**maximize the "effective ABs cast"** and reports that number so you can trust it and act on it. It must
be **trustworthy and generalisable** — correct across *future* phases, trinkets, gear, and spell-haste
levels, not tuned to today's cases.

- **The one maximizable quantity is "effective ABs cast per fight."** An Arcane Blast's *damage* is
  stack-independent, so score each cast by its **multiplier relative to a plain AB** — AP makes a cast
  ≈ ×1.30, spell power adds its coefficient, etc. — and sum that over the fight (a haste buff raises how
  *many* casts you fit; a damage/SP buff raises what each is *worth*). Crit is a constant factor and
  cancels — ⚠ **single target only**: an Arcane Explosion carries the Clearcasting → Arcane Potency
  amplification, which is crit-dependent, so with an AoE phase the SCORE depends on crit (the plan, on
  the cases tested, does not). ESTABLISHED-FACTS §9.2. Every rule below (Lust alignment, haste sequencing, SP-on-fast-casts) is a **consequence** of
  maximizing this single number — none is an axiom. See `docs/MECHANICS.md`.

Additional payoffs the same engine unlocks (nice-to-haves, not the point):
- A **haste-agnostic ideal APL** (cooldown usage that adapts to gear).
- **Setup comparison** — with each setup planned by its *own* ideal cooldown usage, compare them on
  **absolute at-kill damage** to decide *which trinkets/gear to
  bring* to a fight. ⚠ **NOT on the effective-AB count** — this line used to say exactly that, and it
  contradicted the user-directed ruling in ROADMAP payoff 2 / EP.md. Effective-casts is normalized to
  *each setup's own* plain AB: it divides out flat SP and crit precisely so it can isolate scheduling,
  which makes it the right objective **within** a setup and a blind one **across** setups, where raw
  SP/crit throughput is most of what you are trying to measure. The distinction is the whole reason
  the two currencies exist; do not collapse them (PHASE11 §1.4 item 3).
- An **EP / stat-weight calculator** that re-optimizes the plan at each `stat±Δ`. ⚠ Its finite-mana
  half was wowsims finite-diff and is retired with the sim; the infinite-mana **layout** EP is
  closed-form model partials and survives (`docs/EP.md`).

## How to run the tests

```
node tests/anchors.mjs
```
**★★★★★★ THESE ARE HARD TESTS AND THEY ARE GROUND TRUTH** — user ruling 07-30: *"These have to be the
output our tool. If the search misses them the search is failing; if the scorer ranks something higher
than them, the scorer is failing."* Two failure modes, two different fixes, and `tests/anchors.mjs`
checks BOTH — press-time comparison catches the SEARCH, and `scorerBeats()` enumerates every ≤3-coordinate
move around the declared layout to catch the SCORER. ⛔ **There is no third option.** A red here is never
"the test is too strict"; editing a layout to match the tool destroys the only ground truth the project
has, which is exactly what killed `exact-match`.
⚠⚠ **AND THEY ARE ALL h = 0** — a stated limit, not an oversight (*"figuring out higher haste is
trickier"*). Above h=0 the GCD cap binds and the right answers change (RULES §5, §7, §7a-ii). **Nothing
declares a correct layout above h = 0**; `kit-sweep` + `search-audit` cover h ∈ {0,200,400} but assert
only that a plan is not beaten, never that it is right. Treat a high-haste plan as unverified.
★ **The equation, in the user's own framing:** the integral of *"the damage a spell would deal right
now, divided by the time it would take to cast right now"*. The only thing modelled dynamically is the
Arcane Blast stack count, because that is what moves the denominator; everything else is a value
overlaid on that curve at a known time. Because it is an exact integral, "A beats B" is **arithmetic** —
which is what makes the scorer failure mode above meaningful.

**★ There are exactly EIGHT tests, and they are the eight layouts the user declared exactly.** T1/T2:
2:00 and 3:00, Bloodlust pinned 0:20, h=0, 1000 SP, 25 % crit, every press time pinned, per their ruling
*"these two need to always be this way"*. T3 (added 07-30): the **Morogrim Tidewalker preset**, declared as
a RULE rather than a timetable — *"pop the first cluster (everything except Berserking) as soon as a) 3
Arcane Blast stacks are active and b) Lust is active, then exactly 2 minutes after the first cluster the
second cluster gets popped — IV (Cold Snap), Icon, Gem and Berserking"*, with Arcane Power once in the
first cluster because Lust > Berserking. Lust is pinned 0:05 and the third stack lands at 6.498 ⇒ 0:07
and 2:07. **T4–T7 (added 07-30)** run at the DEFAULT gear (1387 SP, 38 % crit): T4 `1:40 lust 0:07`,
T5 `2:40 lust 0:07 · intermission 1:30–2:10` (the only re-ramp guard), T6 `2:00 lust 0:05`,
T7 `1:15 lust 0:05 · intermission 0:50–0:55`. ★ T6/T7 arrived as **bug reports** and are pinned to a
**brute-force argmax** rather than to what the optimizer happened to say — that distinction is exactly
what got `exact-match` deleted. No browser, no rig, no golden file: it runs the real optimizer and
compares press times.

✅ **`8 of 8` AS OF 2026-07-30 — every declared layout is emitted exactly, and the CI job is
BLOCKING** (`continue-on-error` removed — that
flag's stated exit condition was *"the day anchors goes green"*). **MODEL-DEFECTS D1 IS CLOSED.** Seven
defects fell that day, §8h–§8m, and the through-line is one sentence: **the cast lattice had leaked into
the ranking objective in four separate places.**

1. **The per-cast sum mispriced a haste buff by ~0.15 casts** — it ranked *Berserking with nothing up*
   (0.7250) above *Berserking inside Bloodlust* (0.7203) against laws of 0.667 and 0.867. ⇒ **the
   integral ranks now**, and the 07-28 revert is explained not contradicted (§8h).
2. **No tie-break**, so the integral's flat plateaus were resolved arbitrarily — which is exactly what
   the 07-28 Hydross duel punished. ⇒ the objective is a **pair**: integral, then fewest distinct press
   moments → earliest → the flattened press vector.
3. **The search could not reach the answer at all** — a ±12 s per-press neighbourhood, when the declared
   Berserking is +20 s away on T1 and +120 s on T2. Worth **0.67 casts** (§8j).
4. **★ `scoreStart` is now PURE WINDOW GEOMETRY** (§8l, from the user's argument): the integral is
   `∫ rate(m(t)) dt` and `m(t)` is set by press times, durations and wall events — a cast lattice has no
   business in it. Three earlier versions each smuggled it in and each cost a measurable defect.
5. **…and so is the cooldown chain the ranking reads.** `lastFire` legalises (wowsims starts a cooldown
   at the cast, PHASE12 §6.14c — loosening that emits plans the sim cannot execute, HELD 18 of 196);
   a parallel `lastScore` chain prices. Two chains on purpose; **do not merge them**.
6. **A co-pressed cluster now slides as a unit.** The last gap was a *coupled* coordinate: on T2 the
   declared layout and the emitted one had **bit-identical** integrals (Δ = −2.8e-14) and the declared
   had 2 distinct press moments against 4 — but every single-track step toward it was downhill
   (−0.067, −0.067, −0.018) because it **split the cluster**, Arcane Power ×1.30 and the gem +225 SP
   multiplying each other. Coordinate descent cannot reach a coupled optimum at any effort; the
   simultaneous move can. The subsets are read off the plan (tracks grouped by press second), not
   guessed.
7. Plus a GCD-gap sliver containing no cast being priced (§8k) and two differently-rounded lattices.
8. **★★★ AND THE RAMP WAS THE LAST LEAK (§8q).** Found by writing the objective from scratch as an
   INDEPENDENT reference — a lattice-walking version failed `ESTABLISHED-FACTS` §5's named values
   (0.6887 for Berserking in Bloodlust against 0.867, which the sim confirms at +4.1 DPS ± 0.21), a
   no-lattice one reproduced all three and picked the declared layout. ⇒ **the opener is now a FIXED
   toll `Σ(C_k − G)/G` spread over the UNHASTED `ΣC_k`**, and both halves matter: *fixed* keeps haste
   ramp-neutral (§1.2), *spread* makes a value window overlapping the opener pay its share — which is
   what makes the cluster wait for 3 stacks. ⛔ Do not integrate the ramp region at `1/(cast's own
   span)`: the span shrinks with haste, compression pays, and Icy Veins goes back to the pull.
9. **The cluster slide moves PRESSES, not tracks.** Sliding whole tracks dragged a member's *other*
   uses along and split the cluster it was meant to leave alone. T3's last gap was coupled through
   **legality**, not score: with the gem used at 0:08 its 2-minute cooldown makes 2:07 illegal.
10. **★★★ AND THEN THE SAME DEFECT ONE DIMENSION UP (§8s).** Two more plans came back wrong the same
   day — *"why is the first IV at 0:06 not 0:07 along with the other things?"* — and both were the
   search again, not the scorer: brute force says the user's layout is the argmax, by **0.0058 casts**
   on the 2:00 case (over 373k layouts) and **0.1022 casts** on the 1:15 case, the largest miss the
   suite carries. Cause: under the GCD cap the optimum **packs haste windows back to back** (IV [5,25]
   · Berserking [25,35] · IV [35,55]), so moving any one alone overlaps its neighbour at −0.0867 casts
   per second and **every 1-D and 2-D step is downhill** — the only escape moves three coordinates at
   once. ⇒ move class 3c: link presses whose windows share an EDGE (one's end EXACTLY on another's
   start), slide each connected component. ⚠ A ±1 s tolerance was tried and makes the move useless —
   Icon's window ends one second past Berserking's press, so the cluster gets swept into the train.
   Class 3c is ADDITIVE to the cluster slide; do not merge the two graphs.

⚠ **The band is `TIE_CASTS = 0.002` casts and it is BRACKETED BY MEASUREMENT, not tuned** — 1.8× above
the measured resolution floor (two layouts provably equal by the closed forms differ by 0.001097) and
5.8× below the smallest verified law step (0.011532). ⛔ Do not raise it: at 0.0115 Berserking starts
sliding out of Bloodlust for free.

⛔ **DELETED on 07-28, not disabled** — read `tests/anchors.mjs`'s header before recreating any of them:
`exact-match.mjs` + `golden.json` (asserted stability, never correctness, and were re-recorded twice
this month to accommodate objective changes), `layout-rules.mjs` (asserted a prose paraphrase of rules
that belong in `docs/ESTABLISHED-FACTS.md` with their algebra — its R4 encoded a two-body rule as
universal and its R3 rested on a cast count later shown to be ramp-neutral), and `monotonicity.mjs`.

★ **THE UI's "Reference fights" STRIP IS NOW THE DECLARED TESTS** (user decision 07-30: *"remove the
current reference fights and add these hard tests there instead"*). `GOLDEN_PRESETS` held fifteen plain
length+Lust cases inherited from the deleted `exact-match` goldens — they asserted nothing after 07-28 and
they were the first strip a visitor saw, so the tool advertised its own scaffolding. It now holds exactly
the eight declared tests — `T1 · 2:00 lust 0:20`, `T2 · 3:00 lust 0:20`, `T3 · Morogrim 2:45 lust 0:05`,
`T4 · 1:40 lust 0:07`, `T5 · 2:40 lust 0:07 · interm 1:30-2:10`, `T6 · 2:00 lust 0:05`,
`T7 · 1:15 lust 0:05 · interm 0:50-0:55` — and clicking one loads that test's own inputs. **The strip and
`tests/anchors.mjs` must stay in lockstep**: the strip IS the test list, by user decision. ⚠ Five code paths defaulted to deleted names and were repointed in the same commit:
`ci.yml`'s bench smoke, `tests/page-equiv.mjs`, `tools/model-audit.mjs`, `tools/window-match.mjs`,
`tools/sp-sensitivity.mjs` — four of which are now DELETED with the sim; only `sp-sensitivity` remains.
Docs still quote the old names in examples; treat a `no preset matching…` error as a stale doc, not a
broken tool.

⚠ **The harness-integrity gates are a DIFFERENT KIND OF THING and the survivors stay** — they assert
the harness is not lying, never which plan is best. Four of the five were sim gates and went with it
(`sim-request`, `sim-duel`, `page-equiv`, `press-fire`); **`tools/self-consistency.mjs` remains** and CI
runs it, blocking. ⚠ Deleting the sim did NOT delete this category, and it must not be allowed to: a
self-contradicting scorer is still the failure mode that hides longest.

★★★★ **AND THE NEWEST ONE IS THE MOST USEFUL: `node tools/law-check.mjs`.** It asserts the SCORER
against `docs/ESTABLISHED-FACTS.md`'s closed forms — what 10 s of Berserking is worth in three different
company, the haste × haste cross term, kill truncation, and the invariant that a lone press slid in the
fight's interior changes **nothing**. ★ Every one of the seven defects closed on 07-30 was found by
comparing a measured number to a closed form, and **not one of them would have been caught by a plan
diff or a golden file** — the goldens had absorbed several of them for weeks. Its expectations are
*derived in the file*, never copied from a run, and it ships a negative control
(`--self-test` drops the millisecond quantisation, a 3.6 % error, and must be CAUGHT).
⚠ `self-consistency` and `law-check` answer different questions and you want both: the first asks
whether the scorer agrees with **itself**, the second whether it agrees with the **algebra**. The first
printed a clean `0.00e+0` straight through all seven defects.

⚠ **With the goldens gone, the stability question needs an instrument, and it already exists.** Use
`plan-sweep` + `plan-diff` before and after an engine change — it reports **Δscore** per cell with a
regression verdict instead of a text diff, needs no file to maintain, and runs in ~33 s:
```
node tools/plan-sweep.mjs index.html A.json 3 --max-t=200   # before
node tools/plan-sweep.mjs index.html B.json 3 --max-t=200   # after
node tools/plan-diff.mjs A.json B.json
```
Full rationale and both instrument controls: `docs/archive/10-phase9-performance.md §5`.

⚠⚠ **IT WAS GRADING AGAINST THE RETIRED OBJECTIVE UNTIL 07-30 — §8t.** `plan-sweep` recorded
`best.val`, and `optimizeAsync` sets `val = simulate().robust`, the per-cast **sum**. Since §8h the sum
is REPORTED and the **integral** ranks, so the project's only plan-stability gate was judging search
changes by the wrong number: it called three cells "SEARCH REGRESSION" when two were **+0.0058** and
**+0.0392** casts better. And even on the right number the verdict needs BOTH halves of the pair —
inside `TIE_CASTS` the integral is tied and the SHAPE decides. ⇒ the sweep now records `rankScore`
plus `band` and `distinct` (all read from the engine, never retyped), and `plan-diff` reports a banded
move as `tieBreak`, failing only when a banded move ADDS press moments. **Re-sweep both sides after
this change — an old JSON is denominated in the old number.**

### ★★★★ WHEN A PLAN LOOKS WRONG, BRUTE-FORCE THE CELL. This replaced the sim.

The sim's job was *"to FALSIFY THE SEARCH, not to arbitrate the scorer"*, and with an exact objective
the ranking of two plans is arithmetic — so a plan that looks wrong is one of exactly three things, and
**you can tell which without any simulator**:

```js
// enumerate the neighbourhood under the cell's own cfg and compare to what the tool emitted
const I = s => api.simulate(api.repair(structuredClone(s), cfg), cfg, true).integral / plainCast;
```

| the emitted plan… | it is a… | fix it in |
|---|---|---|
| scores BELOW a layout you can enumerate | **search** defect | `phaseRerank` / the seed classes |
| ties it but sits on the wrong plateau member | **tie-break** defect | `planBetter` / `planShape` |
| scores ABOVE it, and the closed form disagrees | **scoring** defect | `simulate()` — and `law-check` is already red |

★ This is strictly better than the duel it replaced: §8s enumerated 373k layouts in seconds and named a
**0.1022-cast** miss exactly, where a sim duel resolves ~0.02 casts at best against its own seed noise
and answers "which is better" rather than "by how much, and why". ⛔ Do NOT reach for a scoring change
first — §8j, §8m and §8s were all search defects, and a scorer "fix" aimed at one would have been
permanent damage.

### ★★★★ AND IT IS NOW A GATE — `tools/search-audit.mjs` (§8u)

```
node tools/plan-sweep.mjs index.html /tmp/b.json 3 --max-t=200   # ~30 s, the expensive half
node tools/search-audit.mjs /tmp/b.json --k=3                    # seconds, re-solves nothing
node tools/search-audit.mjs /tmp/b.json --k=3 --self-test        # displaces a press; must be CAUGHT
```
It does the table above **automatically, on every swept cell**: for each emitted plan it enumerates
every move of ≤k coordinates by ≤span seconds and asks whether any beats it. Reading **14 of 14 local
optima** today, and on the pre-fix engine it rediscovers both of the week's reported misses to the digit
(+0.005815 Karathress, +0.030041 Solarian) without being told they exist. CI runs it, blocking.
⚠ **`k=3` is the floor that matters.** On the 2:00 cell there were ZERO improving 1- and 2-coordinate
moves and six 3-coordinate ones — a k≤2 audit calls that plan optimal.
⚠ **A pass is LOCAL optimality only.** T2's declared Berserking is +120 s from where the descent put it
(§8j); no bounded neighbourhood at any k finds that. Global optimality needs the constructive
enumeration (`docs/PHASE13.md` §3) — this gate is that programme's regression net, not its replacement.
⛔ **It grades on the objective PAIR**, via the engine's exported `rankPair`/`planBetter`. Grading on
`rankScore` alone made it report T1 — a declared test, and the argmax — as a miss "beaten by 0.000347
casts", 5.8× inside the tie band. **Three instruments made that same mistake in one day** (§8t,
§8u): if you write a fourth, import the comparator, never re-implement it.

**⚠ The `plan-sweep`/`plan-diff` loop above is the ONLY plan-stability instrument** — `exact-match` is
deleted and so is the sim. One real loss: the sweep runs the DOM-free engine, so it never touches the
render path. If you change `renderTimeline`/`scheduleRows`, the sweep will not see it — **open the
page**, over http (a `file://` origin blocks the Blob worker the optimizer runs in, so the button
silently does nothing).

## `index.html` at a glance

Two script blocks: `<script id="engine-src">` — the pure DOM-free engine + optimizer — then the
DOM/UI script. The UI runs the heavy optimization in a **Blob Web Worker** built from the engine
tag's own text (`runOptimize`; single-file preserved, main thread never computes), fanned across a
**pool of polish-server workers** sized to the machine's cores with a first-accept-in-order
reduction — pooled and sequential paths return **byte-identical plans** — while the page keeps its
engine copy for cheap scoring and the headless tests (which run the sequential path). Core pieces:
`simulate()` (returns BOTH: `integral`, the cast-rate integral, which **RANKS**; and `robust`, the
per-cast sum, which is **REPORTED** — ⛔ they swapped roles on 07-30, §8h, and the sum must not rank
again) · `repair()` (legalizes a schedule: cooldowns, Cold Snap, use caps) · `optimizeAsync()`
(multi-start search + a stack of finishing passes) · `renderTimeline()` (the SVG burn chart).
⛔ **Displayed plan times are PRESS times** — user decision 07-30, *"with our model the trinket and the
stat changes should apply the moment it's pressed"*. This OVERTURNS the old fire-time display, which
rendered a press intent of 0:05 as "0:06" and visibly split clusters the optimizer had deliberately
co-pressed. `shownTimes` is the one accessor; `actEff` no longer feeds any display. **Exactly one
`shownTimes` is the one accessor, and with the sim retired `actEff` has **no consumer left at all** —
it stays on `simulate()`'s result as a diagnostic (when a press *would* fire on a cast boundary), not
as an input to anything. Full internals + current line ranges in `docs/ARCHITECTURE.md`.

## The rules that make it correct

The planner encodes hard-won TBC theorycraft (the GCD floor, buff-into-Lust packing, the **packing
law** — haste windows go back to back and the train moves as a unit, §4c — when Icy Veins slides out of
Lust with gear, Cold-Snap materiality, known-kill planning, etc.). These are the crown jewels and are
easy to get subtly wrong — **read `docs/RULES.md` before changing the model or the passes**, and keep it
updated as the living theorycraft record.
⚠ Many rules there are tagged *sim-verified*. That tag is now **historical provenance**: it records how
the rule was established, not an instrument you can re-run. New rules are established from
`docs/MECHANICS.md`'s formulas and checked against `docs/ESTABLISHED-FACTS.md`'s closed forms.

## Working conventions

- **Never leak identity or model identifiers** into `index.html` or anything the user shares
  publicly (it's a shareable artifact): no real names, emails, usernames, repo names, session ids,
  or model ids. The user's Discord handle is the only acceptable attribution.
- **★ THE ENGINE'S PHYSICS CONSTANTS WERE READ OUT OF WOWSIMS' SOURCE, and those citations stay.**
  `index.html` still cites `sim/core/cast.go:137-138` (both clocks round to the millisecond),
  `sim/mage/arcane_charge.go:17` (334 ms per stack, **not** 1/3 — the difference COMPOUNDS) and
  `sim/mage/talents.go`. That is **provenance for a solved game**, exactly what `docs/SOURCES.md` asks
  for, and it survives the simulator's retirement: we no longer *run* wowsims, we still *cite* what its
  source says the 2.4.3 client does. ⚠ The live site is `wowsims/tbc-new` →
  **https://www.wowsims.com/tbc/**; `wowsims/tbc` → `wowsims.github.io/tbc` is ARCHIVED (2021, pre-APL).
  The trap that caught this project once: `tbc-new` declares Go module `github.com/wowsims/tbc`, so
  deriving the URL from an import lands on the dead repo. Read the URL, never derive it.
- **Determinism is a feature.** Any change must keep one-setup-⇒-one-schedule, or `plan-diff` and the
  seven tests become meaningless. Don't add `Date.now()`/`Math.random()` outside the seeded PRNG.
- **★★★★ THE OBJECTIVE IS EXACT — ✅ LANDED 07-27, AND IT MUST STAY THAT WAY.**
  Effective ABs cast is a **deterministic per-cast sum**: for each Arcane Blast the model knows the
  haste and stacks (hence cast time), whether AP is up (×1.30), which SP buffs apply (normalized
  against a plain cast), and crit as a constant that cancels. **Nothing needs approximating.** That
  sum is now what `simulate()` accumulates and what `robust`/`total` return.
  **The standing gate:** `node tools/self-consistency.mjs` must read
  `0.00e+0` **and `0` structural violations**. Run it after ANY change to `simulate()` — it generates
  its own corpus (3000 scorings, 460k casts, 0.78 s, no cache, works from a bare clone).
  ⚠ **The `0.00e+0` alone is NOT sufficient and never was.** It compares the number that RANKS against
  a sum recomputed from the `casts` board — but *both read the same board*, so a defect in **which
  casts exist** makes them wrong identically and they agree. It printed a clean zero straight through
  two defects worth up to 1.47 % of a fight score (PHASE13 §2.5). The **structural** line is the one
  that leaves the model and asks the world: at millisecond resolution, no cast may begin inside an
  intermission, and re-deriving the credit must not change it. It reads 167 violations on the engine
  that shipped those defects and 0 after.
  ⛔ **THE TWO RETIRED APPROACHES — do not let either back in.**
  1. ~~**Ranking on the rate integral.**~~ ★★★★ **OVERTURNED 07-30 — the integral RANKS again, and the
     per-cast sum is now the REPORTED number only.** The 0.2114 % disagreement was real and is not the
     point: measured against `docs/ESTABLISHED-FACTS.md`'s closed forms, **the sum is the one that is
     wrong**, and by more than the margins it was resolving. Sliding only Berserking on T2 and asking
     what its 10 s adds:

     | Berserking placed… | law | per-cast **sum** | rate **integral** |
     |---|---|---|---|
     | inside Bloodlust, no Icy Veins | 0.867 | **0.700 / 0.720** ✗ | 0.8667 ✓ |
     | with nothing up at all | 0.667 | **0.725** ✗ | 0.6667 ✓ |
     | under Icy Veins + Icon + gem | 0.951 | 0.928 | 0.9514 ✓ |

     The sum ranked *Berserking with no buffs up* **above** *Berserking inside Bloodlust* — a ~0.15-cast
     inversion, because moving a haste window shifts the whole downstream lattice and re-prices the
     terminal cast, contaminating the marginal attribution. The integral hits all three law values to
     four decimals. **⇒ rank on the integral.** ⚠ And the 07-28 revert (Hydross −5.4 DPS, 137σ) is
     explained rather than contradicted: its two symptoms were *"the cluster stopped being co-pressed"*
     and *"the first Icy Veins left the opening ramp"*, which is what a **flat plateau** does to a search
     with no canonical member to fall to. The integral had made those layouts exactly tied and the
     search then wandered inside the tie. **The objective is a PAIR** — integral, then the tie-break
     (fewest distinct press moments, then earliest, then the flattened press vector). `index.html`'s
     `planBetter` / `rankPair`. The tie band `TIE_REL = 1e-7` is float equality, **not** a tolerance:
     true plateaus are exact and the smallest real step measured is ~2e-2 casts.
     ⛔ Still true: never *tune a scorer term* against the integral (§6.1–§6.3 falsified four that way).
  2. **Expiring a buff window from the PRESS time.** A self-press fires at the next cast boundary, so
     expiring at `press + duration` made every mid-cast window short by the slip — one whole cast in
     the measured case. Windows run their full duration from when the ability actually FIRES;
     raid externals (Lust/PI/Drums) are the exception and start when CALLED. ⚠ Its gate was
     `tools/window-span.mjs`, which probed wowsims at every offset — **deleted with the sim.** The rule
     stands on what that gate measured; nothing re-checks it now.
  3. **One snapshot rule for both kinds of buff.** ★ **HASTE is fixed at the cast's START; VALUE
     (+SP, damage multipliers) is read at the cast's COMPLETION**, over the window `(start, end]` —
     open left, closed right, both edges measured (`tools/snapshot-rule.mjs`). Deciding everything at
     the start over-paid one cast per window. Gate: `tools/credit-check.mjs`.
     ⚠ Its discriminating case is a press landing **ON a cast boundary**; on a mid-cast press the old
     defects cancelled and the broken engine passed.
  4. **Letting boundary comparisons disagree about their epsilon.** The walk's clock is a running float
     sum, so a wall the geometry puts at `90.000` arrives as `89.999999999999972`. `nextCut` carried an
     epsilon and the segment advance did not ⇒ the walk failed to jump an intermission while the lattice
     skipped past it, and **a whole Arcane Blast was banked at 100 % credit completing 1.5 s inside the
     intermission** (0.99 % Lurker / 1.47 % Solarian of fight score). The press loop's `e.ts > t` had
     none, so a press at `184.00` missed a boundary stored as `183.99999999999994` while
     `sim/planspec.mjs` transcribed it to the *other* cast. ⇒ `index.html` declares **one** `const EPS =
     1e-9` and every clock comparison in the walk names it. Not a tuned tolerance: wowsims rounds to the
     millisecond, so nothing real lives below ~1e-6 s. PHASE13 §2.5.
  4. **A SYMMETRIC kill window, and treating any boundary as an exact instant.** ✅ **Retired 07-27 by
     user ruling (PHASE12 §9).** `KILL_WINDOW = 0.5` paid a cast completing exactly at T only **0.5**,
     because `U[T−W, T+W]` says the boss is already dead half the time. One rule now applies at
     **every** cut:

     ```
     credit = min(1, (nextCut − castStart) / castDuration)      × that cast's own value
     ```

     ★ **Not a smoothing heuristic — algebraically a ONE-SIDED window whose width is the cast's own
     duration** (`U[C, C+d]` ⇒ `(C+d−completion)/d = (C−start)/d`, verified to the digit). It reads
     *"the cut happens no earlier than C, and no later than one cast after it."*
     ★★ A **cut** is a boundary you would not carry a cast across. **THREE kinds of boundary, TWO of
     them cuts, for TWO DIFFERENT REASONS** — get this asymmetry right or you will re-litigate it:
     - **Intermission start ⇒ a CUT, by PHYSICS.** The boss goes untargetable: the cast **cannot land**.
     - **AoE phase start ⇒ a CUT, by POLICY** (user ruling 07-27). The boss **stays targetable and the
       Blast does land** — but adds are up and Arcane Explosion is worth several times an Arcane Blast,
       so the player **CANCELS** the Blast and spams AE. A cancelled cast is worth **zero**. And the
       phase does not arrive on the same second every pull, so with the wall `~ U[W, W+d]`, `frac` is
       exactly `P(the wall has not arrived by completion)` — the other branch is the cancelled cast, and
       the expectation is `frac × dmg`. Same one-sided window as the kill.
       ⇒ **Because the cast is CANCELLED and not merely re-priced, the AE lattice starts AT THE WALL**,
       not at the Blast's natural end. Verified: a Blast starting **58.998** against a wall at **60.000**
       is credited **66.9 %** = `(60 − 58.998)/1.498`, and the first Arcane Explosion fires at exactly
       **60.000**. Crediting partially *without* truncating would be the worst of both — paying less and
       gaining nothing.
     - **Burn edge ⇒ NOT a cut.** The cast lands **and you would not cancel it** — at a burn edge you
       keep casting Arcane Blast anyway, so there is nothing to cancel. That contrast is the cleanest
       way to remember the whole rule. A burn edge is a **value** boundary, governed by rule 3.
     The far edge of an intermission is not a cut either — no cast can *start* inside one, so nothing is
     ever in flight across it; and leaving an AoE phase you simply resume Arcane Blast with nothing to
     cancel. Predicate: `cutsAt()`, the only thing that builds the lattice.
     ⚠ **THIS QUESTION HAS FLIPPED TWICE IN ONE DAY AND THE REASONING IS THE VALUABLE PART.** It shipped
     **as** a cut (07-27, on "the spell changes there"), was **removed on physics** hours later when the
     sim showed an Arcane Blast started at 59.000 against an AoE phase opening at 60.000 completing at
     60.498 and **landing for full Arcane Blast damage** (1886.4, a 25 %-resist roll off a ~2577 typical
     hit), and was then **restored on policy** by user ruling the same day. ★ **The physics measurement
     is still TRUE and it is not what decides the question.** The question was never *"does the cast
     land"* but *"what would the player do"* — and no sim measurement can answer that.
     ⚠⚠ **A DELIBERATE, PRICED DIVERGENCE FROM THE SIM.** wowsims' APL cannot cancel a cast: it finishes
     the Blast and lands it. So the old `model-audit` **DID** show a gap at an AoE wall, and that gap was
     **not a bug** — it is the one place the model models a **player decision** the harness could not
     express. ⚠ With the sim retired nothing measures that gap any more, and the ruling still stands on
     its own reasoning: the question was never *"does the cast land"* but *"what would the player do"*.
     ⚠⚠ **And an INSTANT cast takes credit 1, not 0.** Arcane Explosion has `cast = 0`; a
     divide-by-zero guard that returned `0` credited **every AE in the corpus at nothing** (Kael'thas
     368,018 vs 524,173 — a 42 % error). The limit is not a matter of taste: as `dur → 0`,
     `min(1, (cut − t)/dur) → 1`. **Guard against NaN, not against the answer.**
     The user's second ruling is why intermissions are included: **a wall does not land on the same
     second every pull either**, so modelling it as exact is the same mistake as modelling T as exact.
     ⇒ `total` / `robust` / `totalEarly` are now **one number**, and the board carries `frac` +
     `credited` so the gate can recompute the objective independently. Gate: `tools/wall-credit.mjs`.
     ⚠ **This had a sim-protocol consequence and it is now moot** (kept because the ALGEBRA is the
     point): the credit rule is the one-sided window `U[T, T+d]`, so the sim's encounter was derived
     from the model's as `duration = T + d/2, variation = d/2` rather than the legacy `variation: 0.5`,
     which was 33 % too narrow at zero haste. That derivation is what tells you the model's kill window
     **is the cast's own duration**, not a tuned constant — which is still true and still load-bearing.
  Full evidence: `docs/archive/13-phase12-exact-objective.md` §6.10 (the objective), §6.11 (the
  windows), §6.12 (the snapshot rules), §9 (the boundary credit).
- **★ THE MODEL OPENS COLD, and that is now a property of the MODEL rather than a sim setting.** No
  prepull, no pre-stacked Arcane Blast: the fight starts at 0 stacks and pays the 1.332-cast opener toll
  (ESTABLISHED-FACTS §1.2). It began as a sim-protocol rule (`genapl _prestack:0`) with a sharp reason —
  a prepull's fixed −2.3 s is haste-blind, which made a haste sweep non-monotone (more haste → *fewer*
  casts), physically impossible and silently corrupting. The reason outlives the instrument. RULES §3.
- ⚠ **THE OLD SIM CAUTION IS WORTH KEEPING, GENERALISED.** It read: *when a clean count and a sim number
  disagree, audit the setup first — the sim is rarely wrong, we've usually used it wrong.* Five times
  that was exactly right (the Vashj drop bug, the stale unpatched runner, the AP-195 quirk, the prepull
  cast-loss, the press-transcription defect of PHASE12 §6.9). ⇒ **When an instrument and a closed form
  disagree, suspect the instrument's SETUP before either.** That applies to `plan-sweep`, `law-check`
  and every brute-force probe you write — §8t is exactly this failure in a sim-free tool, and it
  produced three confident false regressions.
- Commit to the designated feature branch provided at session start; follow the session's configured
  commit author/trailers; don't open a PR unless asked.
- **`master` is the live site.** The tool is deployed as a free static site on Netlify that
  **auto-redeploys on every push/merge to `master`**. So never develop on `master` — branch off it,
  develop, and merge back via PR (merging *is* shipping). **`index.html` ALONE is published** — true
  again as of 07-30, the sim's eight lazily-loaded files having gone with it; `docs/`, `tools/`,
  `tests/`, and the `.md` files are not. Full workflow, headers, and anonymity rules:
  `docs/DEPLOYMENT.md`.

## Keep this documentation alive (do this, every session)

These files are the project's memory across context clears — they are only useful if kept **current**.
Treat maintaining them as part of the work, not an afterthought:

- **Update in the same commit as the change.** If you add/refine/overturn a rule → edit
  `docs/RULES.md` (with its algebra). If you change the model or pass order → `docs/ARCHITECTURE.md`
  (re-grep the line ranges; they drift). If work lands or priorities move → `docs/ROADMAP.md`. If the
  goal or conventions shift → this file.
- **Add or remove docs as the project evolves** — when a new subsystem appears (e.g. the EP
  calculator), give it its own `docs/*.md` and link it below; delete or merge docs that go stale. The
  file list below is not fixed.
- **Prune, don't just append — BUT only the LIVING docs.** When a rule is overturned or a task
  finishes, edit/remove the old text in `RULES.md`/`ARCHITECTURE.md`/`MECHANICS.md`/`EP.md`/`ROADMAP.md`
  so they never describe a state that no longer exists. Stale living docs are worse than none.
- **The HISTORICAL record is append-only — never prune it.** `docs/DIARY.md` (the what/why/when +
  the "believed→disproved" corrections ledger), the `PHASE*.md` phase docs, and `docs/archive/` (the
  recovered per-phase plans) are the project's memory of the road taken. When a phase closes, **archive
  its plan doc into `docs/archive/` (chronological, numbered) — do NOT delete it** — and add its arc +
  any corrections to `DIARY.md`. This reverses the old "delete PLAN.md once it lands" habit (which lost
  Phases 1–5 to git history; they've been recovered into `docs/archive/`).
- Before a big change, re-read the relevant doc; after it, leave the docs describing reality.

## Pointers
- `docs/DEPLOYMENT.md` — how the tool ships: free Netlify static site, **auto-deploys from `master`**,
  branch-off-and-merge workflow, what's published (**`index.html`, alone**), headers, and anonymity.
- `docs/MECHANICS.md` — **read first.** The verified game formulas (haste, cast time, damage per cast,
  the cast-rate DPS equation) that everything else is derived from.
- `docs/RULES.md` — the theorycraft rules, derived from MECHANICS.md. ⚠ The *sim-verified* tags on the
  older rules are **provenance, not a re-runnable instrument** (§4c, the packing law, is the first rule
  established without one — by enumeration).
- `docs/ARCHITECTURE.md` — `index.html` internals and the optimizer pass order.
- `docs/ESTABLISHED-FACTS.md` + `tools/law-check.mjs` — ★★★★ **THE GROUND TRUTH, now that the sim is
  gone.** Closed forms, each verified against the engine's rate integral to the digit; law-check
  asserts the scorer against them and ships a negative control.
- `docs/archive/14`–`17` — the four sim docs (`BENCH`, `GEAR-AGNOSTIC`, `TOOLING`, `ACCEPTANCE`),
  archived whole on 07-30 and bannered. **Historical evidence about a retired instrument; every command
  in them is dead.** `docs/archive/README.md` explains what replaced it and what was genuinely lost
  (mana + AoE weighting are now unmeasured).
- `docs/ROADMAP.md` — status, current work, and open questions.
- `docs/DIARY.md` — **append-only history** of how the tool evolved: the phase arc + the
  believed→disproved corrections ledger. Read to avoid re-litigating settled mistakes.
- `docs/archive/` — closed-phase docs, chronological with a README index (`01`–`06` = the per-phase
  plans recovered from the deleted `PLAN.md`; `07-phase6-xval-run.md` = the Phase-6 cross-val run doc,
  cited throughout as *PHASE6 §x*; `08`–`13` = Phases 7–12). Historical snapshots; **archive a phase
  doc the moment its phase closes** so the living `docs/` folder only ever shows work that is actually
  in flight. Section numbers are never renumbered on archiving, so every *"PHASE N §x"* citation in the
  living docs still resolves. ⚠ **A doc written *during* a phase can contain instructions its own later
  sections falsified** — the archived `13-…` carries six such blocks, each bannered where it sits.
- `docs/archive/08-phase7-xval-fixes.md` — **Phase 7, CLOSED 07-27.** ⚠ gear-A denominated. Fixed the
  cross-val deficits: diagnostic discharged, the AoE press-snap fix landed, `emit=fire` landed, rounds
  6–7 certified. Its residual (the two length-persistent kit-columns) passed to Phase 10, which
  reproduced it **cell for cell** on gear B — so it is a model property, not a gear artifact.
- `docs/archive/09-phase8-b2.md` — **Phase 8, CLOSED 07-26.** ⚠ gear-A denominated. The B2
  model-vs-sim ranking error, closed with a **negative** result: the boundary charge failed its sign
  gate and ships OFF, changing no plan. Lasting: **THE FLOOR LAW**, the two harness input errors it
  found (now `tools/reference-gear.mjs`), and §26.1's eight settled findings — do not re-open those.
  ⚠ **B2 itself is unsolved.** Its target was thought to have moved ~0.39 pp and changed sign on gear
  B; that was **retracted 07-27** (BENCH §3e) — re-measured on protocol it reads ≈0.43 pp, so the
  gear-A target essentially **stands**.
- `docs/archive/11-phase10-gearb-baseline.md` — ✅ **PHASE 10, CLOSED 07-27. The acceptance verdict is
  DEFINED again**, and `docs/ACCEPTANCE.md` → *"Current status (GEAR B, round 1)"* is the reading.
  Round 1 is **36/36 under one protocol on one engine** (`char=bench-gearB ·
  engine=native:runner-ap180 · var 0.5 · emit=fire · iter 6000 · pool=1`), certified by
  `tools/xval-stamp-audit.mjs`. **Invariant A PASSES** (`monoDip = 0.0000%` on all 36); **B2 FAILS** —
  142 borrowed-win columns of 345 across 33/36 tables, worst **0.380 %**, median 0.035 %.
  ★ **The persistence list (3 of 57 kit-columns) reproduces gear A's first two CELL FOR CELL**, so the
  low-haste basin is a property of the **model**, not the gear — and §8.23/§8.25 diagnose it as **one
  terminal cast** the objective scores as a 0.014 % tie while the sim is emphatic at ~13σ.
  ⚠ Discretizing the scorer is already falsified. **Debts re-priced (§8.31): B2 survives**
  (banded **+0.368 ± 0.020 pp, 5/5 seeds, REAL** ⇒ ≈0.38–0.41 pp, target stands); the **basin
  reproduces but is misnamed** (a third column sits at h130; the family is 2 terminal-cast columns + 1
  sub-resolution value column); the **KT/AoE cells do NOT reproduce**, discharging PHASE7 §5.19's
  standing prediction. **Two instrument findings inherited:** `ripple-audit` fails its own P3/P5
  self-checks (so no ripple decomposition is quotable on that round, and its `mono=0` stamp means
  FAILURE while the neighbouring `vacuous=0` means success), and *"wasm == native"* has always meant
  **within 0.05 DPS**, not bit-identity — the re-gather moved six published figures, one a **verdict
  flip** off a ~1e-6 relative difference (§8.27). **The import-closure freeze is LIFTED.**
- `docs/archive/12-phase11-platform.md` — **Phase 11, CLOSED 07-27.** The platform phase; the
  single-file convention is **RETIRED by user decision (07-26)** and that stands. Its §1 is the audit's
  findings ledger, root cause stated once: **code that cannot be imported gets copied, and copies
  drift.** ✅ **§1.1 DISCHARGED 8 of 8** (`bench --targets` *and its refusal*, the cached-rejection
  boot, `immutable` off the unhashed wasm, `plan-duel`'s retired intent transcription,
  `census-build`'s content anchors, `evalsched`'s `t5two`, plus the two `index.html` halves — proved
  plan-neutral by the engine block being **byte-identical**, not by assertion). ✅ **The §1.4 doc sweep
  landed. ✅ CI came up** (`.github/workflows/ci.yml`: `fast`, `page`, `plans` — two carrying negative
  controls). ⛔ **The module split, the perf ladder and the product routes were NEVER STARTED**, and
  the eight §8 user calls are unanswered — all inherited by `docs/PHASE13.md` §5/§6.
  ⚠ **Its own header claimed "not started, nothing has changed" while all four named directories had
  changed**; the archived doc opens with a banner saying so, and six blocks inside it are bannered
  false in place (its "no CI exists" line, F9's retired constant pairing, §3.3's rate-integral-era
  prefix-reuse design, §3.1's dead anchors, §5's PHASE10 routing, §1.3's pre-rewrite figures).
- `docs/archive/13-phase12-exact-objective.md` — ★★★★ **Phase 12, CLOSED 07-27 — the phase that made
  the objective exact.** `simulate()` computed the per-cast sum in its discrete walk and **ranked on a
  continuous rate integral instead**, disagreeing with itself by a **median 0.2114 % of score** against
  ranking margins of ~0.005–0.07 %: ~30× the effect it was resolving, plan-dependent, so it did not
  cancel — **it WAS the near-tie**. Four scoring defects (§6.10 the integral · §6.11 press-anchored
  windows · §6.12 one snapshot rule where the game uses two · §8→§9 the boundary), one transcription
  defect (§6.9), and the cast lattice (§6.14: `STACK_CAST_REDUCTION 1/3 → 334 ms` **plus** millisecond
  rounding) all closed; cooldowns now chain from the **fire** (§6.14c, HELD 18 → 1 of 196).
  `exact-match` **25/25**, `self-consistency` **0.00e+0**.
  ⚠ **CLOSED, NOT FINISHED** — §7's search-optimality proof programme and the acceptance re-gather are
  `docs/PHASE13.md`'s.
  ⛔ **Six of its blocks are live-sounding instructions that later sections falsified** and are
  bannered in place; the dangerous one is **§6.11e's *"`exact-match` WILL FAIL … do NOT `--update`"***,
  which was true for a few hours on 07-27 and is false now. **§6.6/§6.7's mechanism is falsified by
  §6.9a.** ⚠ Cite the cooldown-chain fix as **§6.14c**, never "§3" (§3 is the debts table).
  ★ Its durable payload is §6's **four instruments that flattered or blinded themselves in one phase** —
  read a tool's output, not its verdict line.
- `docs/PHASE13.md` — ▶▶ **THE LIVE PLAN, AND THE ONLY ONE.** Everything in it is genuinely open, each
  item with one line on why, and **nothing in it changes a number the tool prints today**. §1 (the AoE
  edge) is ✅ **decided and landed** — and it flipped **twice** in one day (shipped as a cut → removed
  on physics → **restored on policy**, which is where it stands): an AoE phase **start IS a cut**,
  because the Blast lands but you would **cancel** it for Arcane Explosion; a burn edge is not, because
  you would not. ⚠ It prices a deliberate divergence from the sim (§2.2).
  Then §2 re-measures what Phase 12 voided (ACCEPTANCE has **no current reading**; `model-audit` at
  scale; `scorer-duel` now that its prerequisite landed; the model↔sim boundary reconciliation — ⛔ not
  to be "fixed" by setting `--var 0`), §3 the search-optimality programme, §4 the gear-agnostic
  enforcement (fold the import closure into `ENGINE_ID`), §5 the platform track inherited from
  Phase 11, §6 the eight user calls **verbatim**, §7 nice-to-haves, §8 traps, §9 standing rejections.
- `docs/archive/10-phase9-performance.md` — **Phase 9, CLOSED 07-27** (performance / refactor, under a
  byte-identical-plans constraint). Measure-first: baseline profile, call census, hypothesis table with
  verdicts, refactor catalogue landed cheapest-first. Four changes landed (groom exit, `groupSeeds`,
  `finishLine`, the `JSON.stringify` memo key at −14% CPU) and one was **reverted on a pre-registered
  rule after measuring null**. **§5 is the phase's larger contribution and is STILL LIVE GUIDANCE: the
  FAST ITERATION GATE** (`plan-sweep` + `plan-diff` + `plan-duel`) that replaced "re-run everything after
  every edit" — read it before designing any verification.
  ⚠ **Closed, not finished:** the unfinished §4 reclaim rungs passed to PHASE11 §3.1, which closed
  without starting them either — they are **`docs/PHASE13.md` §5.3's now**, unblocked (no freeze is in
  effect) but needing a **fresh CPU baseline and content re-anchoring**: Phase 12 rewrote the very
  scoring walk that dominates the profile, so the rungs are intact and the prices are not.
- `docs/PLAN.md` — the current executable plan, when one is in flight; **absent = no plan in flight**
  (create it before a big multi-step change, delete it once that change lands, folding anything lasting
  into ROADMAP). **No plan in flight. Phase 5 (AoE phases) is COMPLETE** — verdict: an AoE phase is a
  burn ×M(N) modifier + exit-re-ramp + SP-dilution, thresholds and sim gates in RULES §9, record in
  ROADMAP (incl. the Tirisfal-2pc/AP-additivity discovery, whose two user calls are **both RESOLVED** —
  Tirisfal is the `ck-t5` checkbox, AP is additive per "trust wowsims"). Phase 4 is
  COMPLETE (exact discrete ramp + press-snap, basin-stable search, monotonicity certified 0 violations;
  record in ROADMAP). **Permanently REJECTED (user decisions — do not revisit):** the leeway "press anywhere"
  bands and reasoning-tag UI (a plateau tie is conditional on everything else staying put, so the bands
  over-promise; logic deleted from `index.html`); an in-tool "exact mode" (the brute-grid instrument is
  for RESEARCH — generalize its findings into rules, don't ship enumeration); the finite-mana model (too
  many unreliable inputs — the per-window mana-cost chip on the infinite-mana plan is the ceiling of
  mana UX, and it is ramp-aware via the casts board). The haste-graph reference lines stay.
- `docs/ESTABLISHED-FACTS.md` — ★★★★ **THE EXACT LAWS. Rewritten 07-28 from measured tables into closed
  forms.** Everything in it is algebra from the GCD floor, each line verified against the engine's rate
  **integral** to the digit. The whole model is one expression — `rate(m) = min(1/F, m/G)`; Arcane Blast
  is GCD-bound at every haste, so the cast time never enters. From it: the 788.5 cap and the **zero**
  (not "diminishing") value of a point above it; the fixed **1.332-cast opener toll**, which `m` cancels
  out of, so haste cannot compress the ramp; the five onset thresholds; the tent and its wasted-fraction
  formula; `s = COEF·ΔSP/(BASE + COEF·SP)` and the dilution of a +SP trinket by your own gear; the
  five-row composition table (`sp×sp = 0`, `haste×haste` with its **two** thresholds); and the named
  pairs — **Berserking × Lust = +0.2000 casts at h=0, Icy Veins × Lust = exactly 0.000**, one under the
  floor and one over it. ⛔ The old measured tables are **deleted**: they were per-cast-sum values at one
  lattice phase, off the file's own closed forms by up to **0.2385 casts** where the integral is off by
  **0.0000**. Never quote a `--score=point` number as a fact. Regenerate with
  `tools/facts-ladder.mjs --score=integral` / `tools/facts-pair.mjs --score=integral`.
- `docs/MODEL-DEFECTS.md` — where the planner fails to reproduce one of those facts, with size in
  **casts**, a reproduction, and what has already been falsified. Currently one open defect (D1: the
  model resolves sub-cast lattice phase as damage — three witnesses, 0.178–0.287 casts) plus a list of
  things that are **not** defects so they are not re-filed.
- `docs/SOURCES.md` — where WoW facts come from (TBC is a solved game — look up + cite, don't
  re-derive) and the verified-facts ledger of the constants the model uses.
- `docs/EP.md` — stat weights **two contexts**: the infinite-mana **layout** EP (closed-form model
  partials + wowsims finite-diff on the optimal APL, envelope-theorem argument) AND the finite-mana
  **gearing** EP (wowsims finite-diff on a conserve rotation — the real weights: SP ≈ Int > Haste > Crit >
  MP5 > Spirit ≫ Mana).
