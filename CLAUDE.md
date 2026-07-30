# CLAUDE.md — Arcane Burn Planner

Read this first. It orients you on the project; the `docs/` files hold the details.

## What this repo is

A **TBC 2.4.3 Arcane-mage cooldown-overlay planner**: `index.html` (open it in a browser — no build,
no deps). The app is still ONE self-contained file **today, but that convention is RETIRED by
decision** — `docs/PHASE13.md` §5.1 splits it (design in `docs/archive/12-phase11-platform.md` §2),
gated on plans staying byte-identical. Treat
"single-file" as a fact about HEAD, not a constraint to defend. Alongside it sits an **optional** in-page
sim verifier (`sim/`) that lazily loads the real wowsims engine as WebAssembly when the user presses
"Check in the benchmark sim" — a visitor who never presses it downloads exactly `index.html` and
nothing else. **`sim/benchmark.mjs` is the single definition of the duel protocol**, imported by the
page AND by `tools/plan-duel.mjs`/the tests; never retype a protocol constant into a new instrument.

You enter a fight (length, Bloodlust
timing, intermission/AoE phases) and it computes the **optimal moment to press each on-use
cooldown** (Icy Veins, Arcane Power, Icon of the Silver Crescent, Serpent-Coil gem, Berserking),
plus a burn timeline, a per-window activation schedule, and a copy-as-text plan. Alongside it:
`tests/` — **three tests** (`tests/anchors.mjs`): the three layouts the user declared exactly. The goldens
and the plan-shape suites are **deleted** (user decision 07-28, restated twice) — everything else in
`tests/` is a harness-integrity gate, not a claim about which layout is right.

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
  cancels. Every rule below (Lust alignment, haste sequencing, SP-on-fast-casts) is a **consequence** of
  maximizing this single number — none is an axiom. See `docs/MECHANICS.md`.

Additional payoffs the same engine unlocks (nice-to-haves, not the point):
- A **haste-agnostic ideal APL** (cooldown usage that adapts to gear).
- **Setup comparison** — with each setup planned by its *own* ideal cooldown usage, compare them on
  **absolute at-kill damage** (or each setup's optimal-APL sim DPS) to decide *which trinkets/gear to
  bring* to a fight. ⚠ **NOT on the effective-AB count** — this line used to say exactly that, and it
  contradicted the user-directed ruling in ROADMAP payoff 2 / EP.md. Effective-casts is normalized to
  *each setup's own* plain AB: it divides out flat SP and crit precisely so it can isolate scheduling,
  which makes it the right objective **within** a setup and a blind one **across** setups, where raw
  SP/crit throughput is most of what you are trying to measure. The distinction is the whole reason
  the two currencies exist; do not collapse them (PHASE11 §1.4 item 3).
- An **EP / stat-weight calculator** that re-optimizes the plan at each `stat±Δ` (correcting wowsims'
  frozen-rotation EP bias, which undervalues haste once a fixed rotation stops using it well).

## How to run the tests

```
node tests/anchors.mjs
```
**★ There are exactly THREE tests, and they are the three layouts the user declared exactly.** T1/T2:
2:00 and 3:00, Bloodlust pinned 0:20, h=0, 1000 SP, 25 % crit, every press time pinned, per their ruling
*"these two need to always be this way"*. T3 (added 07-30): the **Morogrim Tidewalker preset**, declared as
a RULE rather than a timetable — *"pop the first cluster (everything except Berserking) as soon as a) 3
Arcane Blast stacks are active and b) Lust is active, then exactly 2 minutes after the first cluster the
second cluster gets popped — IV (Cold Snap), Icon, Gem and Berserking"*, with Arcane Power once in the
first cluster because Lust > Berserking. Lust is pinned 0:05 and the third stack lands at 6.498 ⇒ 0:07
and 2:07. No browser, no rig, no golden file: it runs the real optimizer and compares press times.

⚠ **`2 of 3` — T1 and T2 PASS, T3 (Morogrim) is RED.** ✅ **T1/T2 went green on 07-30 and the CI job is
BLOCKING again** (`continue-on-error` removed — that
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
`T1 · 2:00 lust 0:20`, `T2 · 3:00 lust 0:20`, `T3 · Morogrim 2:45 lust 0:05`, and clicking one loads that
test's own inputs. ⚠ Five code paths defaulted to deleted names and were repointed in the same commit:
`ci.yml`'s bench smoke, `tests/page-equiv.mjs`, `tools/model-audit.mjs`, `tools/window-match.mjs`,
`tools/sp-sensitivity.mjs`. Docs still quote the old names in examples; treat a `no preset matching…`
error as a stale doc, not a broken tool.

⚠ **The harness-integrity gates STAY and are a different kind of thing** — they assert the harness is
not lying, never which plan is best: `tests/sim-request.mjs`, `tests/sim-duel.mjs`,
`tests/page-equiv.mjs`, `tests/press-fire.mjs`, `tools/self-consistency.mjs`. CI runs all of them, and
those jobs ARE blocking.

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

### The sim gates (added 07-26 — they need no rig)

```
node tests/sim-duel.mjs                      # the shipped wasm runs; prints a duel
RUNNER=/path/to/runner node tests/sim-duel.mjs      # + asserts wasm == native runner
RUNNER=/path/to/runner node tests/sim-request.mjs   # protocol invariants + page == terminal request
```
`sim-duel` works from the repo alone (it loads the committed `sim/sim.wasm`). `sim-request` is the
**anti-drift gate** and needs a native runner — it asserts the protocol *values* (var ≠ 0, cold open,
seed spacing…), that both committed characters' request templates are fresh `--dumpreq`s, and that the
request the **website** builds equals the one the **runner** builds, field for field. It **skips
loudly** without `RUNNER` rather than passing quietly. Run it after touching anything under `sim/`,
`tools/genapl-core.mjs`, or a character export.

**⚠ The `plan-sweep`/`plan-diff` loop above is now the ONLY plan-stability instrument** — the ~6-minute
`exact-match` gate it used to be paired with is deleted. That is a net gain for the every-edit loop
(~33 s for 16 of 25 cases) and one real loss: the sweep runs the DOM-free engine, so it never touches
the render path. If you change `renderTimeline`/`scheduleRows`, the sweep will not see it — open the
page.

**And when a changed cell needs the SIM, that is one command and no setup:**
```
node tools/bench.mjs --preset "2:00 lust 0:05" --vs naive     # ~10s, cold, from the repo alone
```
It solves with the real engine, transcribes the plan, sims it against a never-press control, and
prints the sim Δ (with a seed band) **beside the model's Δ**, flagging a sign disagreement. Same
backbone as the website's button — `docs/BENCH.md §6`.

⚠ **Scope the verification to what CHANGED — and DUEL what did.** If a plan is bit-identical and the sim
is unchanged, don't re-test it. But if a plan **did** change, sim it head-to-head against its *previous*
layout at that cell — `monoDip`/`diagWorst`/CLEAN-vs-DEFICIT are **aggregates** and can hold or improve
while one cell regressed (`docs/TOOLING.md`).

## `index.html` at a glance

Two script blocks: `<script id="engine-src">` — the pure DOM-free engine + optimizer — then the
DOM/UI script. The UI runs the heavy optimization in a **Blob Web Worker** built from the engine
tag's own text (`runOptimize`; single-file preserved, main thread never computes), fanned across a
**pool of polish-server workers** sized to the machine's cores with a first-accept-in-order
reduction — pooled and sequential paths return **byte-identical plans** — while the page keeps its
engine copy for cheap scoring and the headless tests (which run the sequential path). Core pieces:
`simulate()` (**the per-cast-sum scorer** — ⛔ it was the cast-rate integral until 07-27; the integral survives only as the `integral` diagnostic and must never rank again, PHASE12 §6.10) · `repair()` (legalizes a schedule: cooldowns, Cold
Snap, use caps) · `optimizeAsync()` (multi-start search + a stack of finishing passes) ·
`renderTimeline()` (the SVG burn chart). Displayed plan times are **fire times** (floored seconds),
not press intents. Full internals + current line ranges in `docs/ARCHITECTURE.md`.

## The rules that make it correct

The planner encodes hard-won, **sim-verified** TBC theorycraft (the GCD floor, buff-into-Lust
packing, when Icy Veins slides out of Lust with gear, Cold-Snap materiality, known-kill planning,
etc.). These are the crown jewels and are easy to get subtly wrong — **read `docs/RULES.md` before
changing the model or the passes**, and keep it updated as the living theorycraft record.

## Working conventions

- **Never leak identity or model identifiers** into `index.html` or anything the user shares
  publicly (it's a shareable artifact): no real names, emails, usernames, repo names, session ids,
  or model ids. The user's Discord handle is the only acceptable attribution.
- **★ There are TWO wowsims and we use the NEW one.** `wowsims/tbc-new` → deployed at
  **https://www.wowsims.com/tbc/** — this is what we build, pin (`ade9f39cc`), patch and **link**.
  `wowsims/tbc` → `wowsims.github.io/tbc` is **ARCHIVED** (2021, pre-APL) and its own page says so.
  The trap: `tbc-new` declares Go module `github.com/wowsims/tbc`, so deriving the URL from an import
  lands on the dead repo — and on 07-26 the shipped page *linked* to the dead one for the same reason.
  Read the URL, never derive it; check drift with `bash tools/upstream-drift.sh`. Details: TOOLING.
- **Determinism is a feature.** Any change must keep one-setup-⇒-one-schedule, or `plan-diff` and the
  two tests become meaningless. Don't add `Date.now()`/`Math.random()` outside the seeded PRNG.
- **★★★★ THE OBJECTIVE IS EXACT — ✅ LANDED 07-27, AND IT MUST STAY THAT WAY.**
  Effective ABs cast is a **deterministic per-cast sum**: for each Arcane Blast the model knows the
  haste and stacks (hence cast time), whether AP is up (×1.30), which SP buffs apply (normalized
  against a plain cast), and crit as a constant that cancels. **Nothing needs approximating.** That
  sum is now what `simulate()` accumulates and what `robust`/`total` return.
  **The standing gate, and it needs no sim:** `node tools/self-consistency.mjs` must read
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
     raid externals (Lust/PI/Drums) are the exception and start when CALLED. Gate:
     `tools/window-span.mjs` must match wowsims at every probe offset.
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
     the Blast and lands it. So `model-audit` **WILL** show a gap at an AoE wall, and that gap is **not a
     bug** — do not "fix" it back. It is the one place the model models a **player decision** the harness
     cannot express.
     ⚠⚠ **And an INSTANT cast takes credit 1, not 0.** Arcane Explosion has `cast = 0`; a
     divide-by-zero guard that returned `0` credited **every AE in the corpus at nothing** (Kael'thas
     368,018 vs 524,173 — a 42 % error). The limit is not a matter of taste: as `dur → 0`,
     `min(1, (cut − t)/dur) → 1`. **Guard against NaN, not against the answer.**
     The user's second ruling is why intermissions are included: **a wall does not land on the same
     second every pull either**, so modelling it as exact is the same mistake as modelling T as exact.
     ⇒ `total` / `robust` / `totalEarly` are now **one number**, and the board carries `frac` +
     `credited` so the gate can recompute the objective independently. Gate: `tools/wall-credit.mjs`.
     ⚠ **Consequence for the sim protocol, and it is ✅ SETTLED (07-27, PHASE13 §2.4):** the sim's
     kill window is now **derived from the model's**. The credit rule is algebraically the one-sided
     window `U[T, T+d]`, so `encounterFor(T, haste)` gives the sim `duration = T + d/2,
     variation = d/2` — the same window. `BENCH.variation: 0.5` survives ONLY as a legacy default and
     as the value every archived corpus was gathered at; it was never the model's width once that
     constant was deleted, and it was 33 % too narrow at zero haste besides. Measured 7.8× tighter
     model/sim tracking across a cast boundary (`tools/window-match.mjs`). ⛔ Still never `--var 0`.
  Full evidence: `docs/archive/13-phase12-exact-objective.md` §6.10 (the objective), §6.11 (the
  windows), §6.12 (the snapshot rules), §9 (the boundary credit).
- **The sim's job is to FALSIFY THE SEARCH, not to arbitrate the scorer.** With an exact objective the
  model's ranking of two plans is arithmetic and cannot be wrong — so when the sim prefers a plan the
  tool did not emit, **the search failed to find it.** That is the whole point of the cross-val corpus:
  brute-force regions the search never visits, and generalize each disagreement into a rule or a seed
  class. Secondary uses: **anchor the physics** (trust-anchor to `wowsimcli`, ~0.4 % absolute
  agreement); cover genuine **blind spots** (mana, AoE weighting); **build user trust** via the in-page
  benchmark button, which is the same code path as the internal corpus; and **verify a novel finding**
  before locking it. It is **not** a routine per-golden gate. ⚠ And the standing caution still holds —
  when a clean count and a sim number disagree, audit the *setup* first: the sim is rarely wrong, we've
  usually used it wrong (the Vashj drop bug, the stale unpatched runner, the AP-195 quirk, the
  **prepull** cast-loss, and now the **press-transcription defect** of PHASE12 §6.9 — `floor(actEff)`
  put 7.14 % of presses on a cast the model never chose. ⛔ Do **not** cite §6.7's mechanism for it:
  *"the schedule fires at the first boundary strictly after"* was **falsified by §6.9a** — wowsims'
  `IsReady` is `>=`, and the real cause was that the sim's boundary sat **2 ms earlier than its own
  combat log printed it**, because wowsims takes 334 ms per Arcane Blast stack where the model took
  1/3 s. A fix built on "strictly after" would have bet on the sign of a rounding error, and that sign
  flips with haste).
- **★ The model opens COLD — never prepull in a model-compared sim.** `genapl _prestack:0` (default).
  A prepull's fixed −2.3s time is haste-blind and makes a sim haste sweep non-monotone (more haste
  → fewer casts), which is physically impossible and silently corrupts any haste comparison. Rule
  lives in TOOLING (★★★), RULES §3, and PHASE6 §4.7.
- Commit to the designated feature branch provided at session start; follow the session's configured
  commit author/trailers; don't open a PR unless asked.
- **`master` is the live site.** The tool is deployed as a free static site on Netlify that
  **auto-redeploys on every push/merge to `master`**. So never develop on `master` — branch off it,
  develop, and merge back via PR (merging *is* shipping). **`index.html` plus the eight lazily-loaded
  sim files** are published (`netlify.toml`'s build command — the old "only `index.html`" was already
  false in fact); `docs/`,
  `tools/`, `tests/`, and the `.md` files are not. Full workflow, headers, and anonymity rules:
  `docs/DEPLOYMENT.md`.

## Keep this documentation alive (do this, every session)

These files are the project's memory across context clears — they are only useful if kept **current**.
Treat maintaining them as part of the work, not an afterthought:

- **Update in the same commit as the change.** If you add/refine/overturn a rule → edit
  `docs/RULES.md` (with its sim evidence). If you change the model or pass order → `docs/ARCHITECTURE.md`
  (re-grep the line ranges; they drift). If work lands or priorities move → `docs/ROADMAP.md`. If the
  sim workflow changes → `docs/TOOLING.md`. If the goal or conventions shift → this file.
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
  branch-off-and-merge workflow, what's published (**`index.html` + the eight lazily-loaded sim
  files** — the old "only `index.html`" was already false in fact), headers, and anonymity rules.
- `docs/MECHANICS.md` — **read first.** The verified game formulas (haste, cast time, damage per cast,
  the cast-rate DPS equation) that everything else is derived from.
- `docs/RULES.md` — the theorycraft rules, each with its sim evidence (derived from MECHANICS.md).
- `docs/ARCHITECTURE.md` — `index.html` internals and the optimizer pass order.
- `docs/TOOLING.md` — the wowsims sim harness (how to verify a plan) and its gotchas.
- `docs/GEAR-AGNOSTIC.md` — ★★★ **READ BEFORE ANY SIM WORK. The single source of truth for how this
  project sims.** User decision 07-26: every simulation — the website button *and* the internal
  model-verification corpus — runs on a character defined **only** by the planner's declared inputs
  (SP, crit, passive haste, hit hardset at cap, the T5-2pc checkbox). No exported gear file, ever
  again, because a corpus denominated in one can be voided by re-exporting it — which is exactly what
  happened on 07-26. Where it disagrees with an older doc, **it wins and the older doc is the
  remnant.** It also carries the measured trinket passive/active split, the wasm-vs-native-runner
  numbers, and the freeze rules that gate the implementation.
- `docs/BENCH.md` — ⚠ **superseded in part by GEAR-AGNOSTIC.md (see its banner)** —
  **the standing sim practice**, and `tools/bench.mjs`, the tool that implements it.
  **Reach for `node tools/bench.mjs --preset X --vs naive` before building any rig**: it runs the
  committed `sim/sim.wasm` (no clone, no protoc, no `go build`, no `RUNNER`/`EXPORT_BASE`), prints the
  sim Δ with a seed band next to the model's Δ, and shares its whole backbone with the website's
  verification button — so one change moves both fronts.
- `sim/README.md` — the **in-page** sim verifier: the shared chain (`planspec` → `genapl-core` →
  `simreq` → `sim.wasm`), the gear-agnostic reference character, the wasm-equals-native proof, and the
  rebuild recipe. The terminal harness and the button are ONE code path by construction.
- `docs/ROADMAP.md` — status, current work, and open questions.
- `docs/ACCEPTANCE.md` — **the standing completion test**: the holdout haste-adaptation cross-val the
  model must pass FULLY before it's called complete (monoDip=0 everywhere + no length-persistent
  diagonal deficit). Re-run after every fix/upgrade phase.
  ⛔ **It has NO CURRENT READING.** Every round in it — gear A *and* the 36/36 gear-B round 1 — was
  gathered against a scorer PHASE 12 replaced, so its verdicts grade an engine that no longer exists.
  The tables stay as the append-only evidence trail; **their verdicts must not be cited as the model's
  status.** ★ Re-gathering is now mostly **arithmetic** — `tools/xval-model.mjs` re-optimizes and
  cross-scores at every haste with no sim at all (`docs/PHASE13.md` §2.1). ⚠ Re-pose the PASS criterion
  before grading: the "restate the bar in terms of the ripple floor?" question is **void as posed**,
  all three of its premises having died with the rate integral.
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
