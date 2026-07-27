# TOOLING.md — the wowsims sim harness (how to verify a plan)

This file documents the wowsims workflow, the **trust anchor** that certifies it, the statistical
protocol, and the traps. It was rewritten after a full end-to-end harness audit (see the ★ section and
the audit summary). **Read the methodology below first — it says what the sim is *for*.**

## ★★★ HARD RULE — THE MODEL OPENS COLD. NEVER PREPULL IN A MODEL-COMPARED SIM. ★★★

The model opens **cold** — 0 Arcane Blast stacks at the first cast, no prestack (RULES §3, MECHANICS).
So **every sim compared to the model MUST open cold too**: `genapl` defaults `_prestack:0`; do NOT
set `_prestack>0` for any comparison. A prepull cast is scheduled at a **fixed wall-time (−2.3s)** that
does NOT scale with haste, so at higher haste it finishes early and mistimes the opener ramp — this
made a fixed-rotation, ∞-mana haste sweep **LOSE a cast as haste rose** (h130=53 → h140=52), a
physically-impossible result that silently corrupts any haste comparison (docs/archive/07-phase6-xval-run.md §4.7). If a
fixed rotation ever sims non-monotone in haste, **check for a prepull first.** The only legitimate
`_prestack>0` use is a deliberate ramp-isolation experiment that is NOT compared to the model.

## ★ THE VERIFICATION NOW SHIPS IN THE PAGE (07-26) — same chain, one button

`index.html` has a **"Check in the benchmark sim"** button that runs the real wowsims engine *in the browser*
(WebAssembly) and duels two layouts head-to-head. It is **not** a second implementation — every link
of the chain is the harness's own code:

```
plan → sim/planspec.mjs → tools/genapl-core.mjs → sim/simreq.mjs → sim/sim.wasm
```

- `genapl-core.mjs` is `genapl.mjs`'s pure core, split out so the CLI and the page import the SAME
  builder (the split is proven output-identical).
- `planspec.mjs` is the **transcription convention** — FIRE times, floored, Cold-Snap split,
  `_intermissions`/`_aoe`, `_prestack: 0` — i.e. `xval.mjs`'s `toSpec`, in a file both can use.
- `simreq.mjs` patches `sim/model-ref-request.json`, which **is the runner's own `--dumpreq` output**,
  so the page's request is the runner's request minus the fields a duel varies.
- `sim.wasm` is the patched build at `ade9f39` (both patches; `bash sim/build-wasm.sh` rebuilds it).
- **`sim/benchmark.mjs` is THE duel protocol** — variation 0.5, infinite mana, 10k iterations, seed 11,
  the tie band, the rating conversions, cold open. `tools/plan-duel.mjs` imports it too, and
  `runnerFlags()` generates the native command line from it, so `--var 0.5` is never retyped.
  ★ If you write a new sim instrument, import BENCH; do not copy its numbers.
  ⛔ **`variation: 0.5` KEPT ITS VALUE AND LOST ITS OLD JUSTIFICATION (07-27, PHASE12 §9).** It used to
  be documented as mirroring *"the model's kill-window WIDTH"* (`KILL_WINDOW = 0.5`). **That constant no
  longer exists in the objective** — the model is deterministic at `T` and credits a straddling cast its
  fitting fraction — so there is nothing on the model side to mirror. The value stands **solely** on
  `tools/var-decision.mjs` / BENCH §3, evidence that never depended on the model: it is the **SIM's own**
  smoothing, the way the sim avoids parking its fight end on a discontinuity the model no longer has.
  ⚠ **OPEN QUESTION (PHASE12 §9.4):** model and sim now smooth the same problem by different means —
  **analytic partial credit vs numerical averaging** — and reconciling the two answers is unresolved.
  Do not "fix" it by flipping `variation` to 0; that reintroduces the measured failure in BENCH §3.
  (This also discharges PHASE11 §1.2 F9's "aligned by prose only" pairing for this constant: there is
  no longer a pair.)

**Two gates, both negative-controlled.** `tests/sim-request.mjs` asserts (a) the protocol *invariants*
(var ≠ 0, cold open, seed spacing — sharing a constant cannot make it correct), (b) that
`model-ref-request.json` is a fresh `--dumpreq` of `model-ref.json`, and (c) that the request the PAGE
builds equals the one the NATIVE runner builds across plain / geared / Cold-Snap / intermission / AoE /
odd-stat cases. Semantic comparison: protojson's `EmitUnpopulated` defaults equal a missing field, a
non-default present on one side only does not.

**The equality that licenses all of it:** `tests/sim-duel.mjs` runs the shipped wasm and the native
`runner` on identical inputs and asserts agreement — measured **1351.5 vs 1351.5** and **1345.6 vs
1345.6** DPS at 10k iterations, despite the wasm using `RunRaidSim` and the runner
`RunRaidSimConcurrent`. Re-run it after any rebuild; a drift there invalidates the button.

**Gear-agnostic reference character** (`sim/model-ref.json`): no gear, no consumes, no raid buffs,
standard Arcane talents, spell hit pinned at the 16% cap, infinite mana, cold open, `var 0.5`. The
user's SP / crit / haste rating are injected as flat bonuses — the four inputs the planner already
collects. **Absolute DPS is therefore meaningless and the UI says so; only the paired difference (same
seed, common random numbers) is reported.** Full rationale and the known gaps: `sim/README.md`.

**What it cannot do, and refuses rather than fakes:** Drums / Power Infusion / Ashtongue have no
genapl press (both arms run without them, and the UI names what it dropped); Burn phases have no
encounter knob at all, so the button declines.

## ★ THE AGENT-FACING BENCH: `tools/bench.mjs` (07-26) — start here, it needs no rig

Before building a runner or hand-rolling an experiment, try:

```
node tools/bench.mjs --preset "2:00 lust 0:05" --vs naive      # ~10s, cold, from the repo alone
```

It solves the plan with the real engine, transcribes it, sims it against a **never-press control**
(BENCH.md §2.1's difference-in-differences), and prints the sim Δ with a seed band **next to the
model's Δ**, flagging a sign disagreement as a finding. It runs the **committed `sim/sim.wasm`**, so
there is no clone / protoc / go build / scratchpad probe and no `RUNNER`+`EXPORT_BASE` to resolve —
which is what phases 6–8 spent real time re-establishing every session. It is also the SAME chain the
website's button runs (§ below), so an agent's number and a user's number cannot drift apart.
Full contract, the two characters, and why the model cfg is forced to match the simmed character:
`docs/BENCH.md` §6.

The native runner is still needed for exactly one thing: `tests/sim-request.mjs`, the gate that proves
the wasm path and the native path agree. Build it per "Building the runner" below when you need to
re-certify, not to run an experiment.

## Methodology — the model is the objective, the sim calibrates it

The planner already knows, deterministically, every cast, every buff window, and every timing in a
plan — so it **can** compute **effective ABs cast** (`docs/MECHANICS.md §4`) exactly, and that count is
the arbiter for comparing two lines. The tool is, by construction, a maximization function over that
number; ranking lines is *its* job.

> ✅ **AND SINCE 2026-07-27 EVENING IT DOES.** `robust` IS the per-cast sum; standing gate
> `node tools/self-consistency.mjs` must read `0.00e+0` (PHASE12 §6.10). ⛔ It ranked on a rate integral
> that differed by a median **0.2114 %** of score until then — do not restore that, and do not tune a
> scorer term against the integral (§6.1–§6.3 record four terms falsified that way).
> ★ **`total`, `totalEarly` and `robust` are now the same number**, each cast credited
> `dmg × min(1, (nextCut − start)/duration)` — the **boundary credit** at every cut (fight end,
> intermission start, either AoE edge; a burn edge is not a cut). PHASE12 §9 / RULES §8.
>
> ⚠ **Two calibration debts are still open and they bound what the SIM can settle.** (a) wowsims takes 334 ms
> per Arcane Blast stack where the model takes 1/3 s, so **26 of 196 presses** still miss the cast the
> model scored them on (§6.9d). Until that constant is fixed, **no sim-vs-model disagreement smaller
> than ~0.1 % is attributable** — the referee mis-executes ~13 % of presses.
> (b) The model now hedges the fight boundary **analytically** (partial credit on the straddling cast)
> while the sim still hedges it **numerically** (`--var 0.5`, averaging over `T ± 0.5`). The two are no
> longer the same question and **no residual between them has been derived** — the old `1 − W/c`
> tail-lattice floor priced the *retired* scorer and does not transfer. OPEN: PHASE12 §9.4.

**The sim's role, in priority order — and the FIRST one is the point of the whole cross-val corpus:**

1. **★★★ FALSIFY THE SEARCH'S CLAIM TO OPTIMALITY — this is what the sim is FOR.** With an exact
   objective, the model's ranking of two plans is a matter of arithmetic and cannot be wrong. So when
   the sim says a plan the tool did *not* emit is better, and the exact count agrees once you compute
   it, **the search failed to find it.** The sim is the instrument that reveals search failures — it
   brute-forces regions the search never visits, and every disagreement is a lead pointing at a
   *pattern the search is missing*, which is then generalized into a rule or a seed class. **A
   sim/model disagreement is a SEARCH bug report, not a scorer arbitration.**
2. **Anchor the physics.** Certify the formulas/constants the count is built on — the trust anchor
   (runner == `wowsimcli` to the decimal, below) and any constant that changes. Get the equation right
   *once*, then trust the count.
3. **Cover the count's blind spots** (ramp, mana, AoE, or a *mechanic* disagreement like the AP
   195-vs-180 cd, ★ below). Where a blind spot is in play the sim is ground truth; where it isn't, the
   count is. ⚠ Several historical "blind spots" were really the accounting gap in §6.8.
4. **Build user trust** — the in-page "Check in the benchmark sim" button. A user's verification and a
   Phase-10 measurement are the same code path by construction, which is what makes the tool's claims
   checkable by the person relying on them.
5. **Verify a suspicious or novel finding** before trusting or locking it.

**The sim is not a routine per-golden gate.** Re-simming every plan on every change is slow and, worse,
invites treating a raw sim delta as ground truth even when a clean cast-count already settles the line.

**A caveat the audit earned (the user's correction): the sim was rarely *wrong* — we were often using it
improperly.** The Vashj "3-icons-win", the "off-GCD collision", the "−4.2 exit icon" were all **our
harness/usage faults** (the drop bug ★, cargo-cult offsets, a count-changing A/B measured on nearby
seeds), not the sim lying. So when the sim contradicts a clean cast-count with **no blind spot in play**,
that is a **sim-setup audit trigger** — open the `SIMLOG=1` combat log and find the usage fault — *not*
evidence the model is wrong. Distrust our *setup* before distrusting either the model or the sim.

### ★★ Scope the verification to what CHANGED — and DUEL what did (user's correction, 07-25)

"The sim is not a routine per-golden gate" says what *not* to do. This says what to do instead, and it
has two halves. The first is cost, the second is correctness — and the second is the one we were getting
wrong.

**1. Verification cost scales with CHANGED CELLS, not with corpus size.** If a change leaves a setup's
plan bit-identical, the sim's old verdict for that cell is still valid — the sim did not change, the
plan did not change, so the number cannot have changed. Re-simming it buys nothing. So the loop is:
sweep the model over the corpus (model-only, no sim — seconds), diff the plans, and **the changed set
IS the work list.** A rule that moves four cells costs four cells of sim time, not a corpus.
The caveat is the user's own and it is the important one: *unless the sim changed.* A harness edit
(§20.1's `t5two`, the effective-SP fix, a runner rebuild) invalidates **every** cached verdict,
changed plan or not — see the repricing trap below.

**2. ★★★ When a plan DOES change, sim OLD plan vs NEW plan head-to-head at that cell.** Do not read
the aggregate. This is the correction that matters: a round's table-level invariants — `monoDip`,
`diagWorst`, the CLEAN/DEFICIT verdict — **can all hold or improve while a specific cell got worse.**
They are summaries, and a summary is exactly the wrong instrument for "did I break this one spot."
The only thing that answers it is the duel: both plans, same harness, same seed, side by side.

This indicts something already on the books. PHASE8 §20.5 reports **50 of 184 cells changed plan**
across the round-5 re-baseline with *no verdict flips, `deficitTables` 16→16, `monoDip` 0.00%
everywhere* — and concludes "read no acceptance signal off the sign or the magnitude of these moves."
That conclusion was right about the *available* columns and wrong to stop there: the right signal
exists, it just has to be computed, and 50 duels is tractable.

**⚠ The repricing trap — a duel CANNOT be done by subtracting two rounds' tables.** Round-4 and
round-5 sim scores are not comparable to each other; §20.6 identified the uniform −0.4…−1.1% `eff`
band as a REPRICING caused by two harness *input* fixes. Both plans must be **re-simmed under one
current harness**. That is a new instrument, not a column you can read off existing output.

**★★★ ONE LEVEL UP — the same trap eats ROUND-OVER-ROUND HEADLINES, and it has now been measured.**
Half 2 says a table summary cannot answer "did I break this cell." The identical argument applies to a
whole round's headline versus the previous round's: **a round-level number is a summary too.** Round
4→5 is the proof. It was a **pure harness repricing** — `tools/reference-gear.mjs` gaining `t5two` and
effective `sp: 1450`, **zero model change** — and `xval-round-diff` measures it as **124 of 345
`(haste → plan)` cells moved (35.9%)** across 34/36 tables, with `deficitTables 34→34` and **zero
verdict flips**. Worse, per-table widths wandered **both ways**: 12 improved, 8 worsened, 16 unchanged
(net 0.42 pp over 36 tables), including `scb-skull-short` 0.02%→**0.23%** and `scb-mqg-short`
0.03%→**0.21%**. A table can go from essentially-clean to among-the-worst with **no model change at
all**. Therefore the tidy-looking series *borrowed-win columns `167 → 145 → 142 → 135`, mean width
`0.160% → 0.081% → 0.081% → 0.069%`* is **not convergence evidence** — most of that drift is
repricing. Two rules follow: **(a)** compare a round only to a round gathered under the **same
harness**; **(b)** a harness edit invalidates the *rankings* too, not just the absolute scores, so
"rank-neutral, the plans won't move" is a claim that must be **measured on the full grid**, never
inferred from one fight family (PHASE8 §20.2's pre-flight made exactly that inference and is
**withdrawn**).

**★★★ And the per-table CLEAN/DEFICIT banner is an EXISTENCE TEST at a near-perfect tie — it grades,
but it cannot prioritize.** Invariant B as implemented asks "does *any* rival beat native in *any*
column": ~10 columns × ~9 rivals ≈ **90 comparisons per table**, each decided at a margin whose
*median when the diagonal wins* is **0.003%** — an order of magnitude under the harness's own
CRN/10k-iteration resolution (~0.02%). At the observed 39.1% per-column borrowed-win rate, an
existence test over ~10 columns returns DEFICIT with probability `1 − 0.609¹⁰ ≈ 99.3%`. **The banner
would read `B FAILS` for a converged model and a broken one alike**, so it must never be used to steer
work. The bar stays (zero borrowed-win columns, user-directed); the **work list** comes from
`node tools/xval-persist.mjs`, which asks the structural question instead — *is there ONE rival layout
that beats native at essentially every fight length?* — and needs no tuned thresholds. It names **2
columns** where the banner fails 34 tables. Full derivation: ACCEPTANCE "What the B BANNER can and
cannot tell you"; the corrections are in DIARY (07-25).

**⚠⚠ The same trap on the MODEL side, and it is easier to fall into.** The rule generalises past the
sim: **never compare a freshly-computed score against a RECORDED one.** A shipped plan does not carry
`simulate()`'s maximum for its own layout — it carries the *legibility trade* grooming paid for it
(the `castVal/8` slack on a non-use-adding Cold Snap, `EPS = 0.5`, `coPressAlign`'s designed
pressability give-back). So `polish(repair(shipped))` scores **higher** than the number the sweep
recorded for that same plan, on a large fraction of cases, with **no change to anything**. Any probe
that enumerates a candidate family, polishes each candidate, and asks *"did it beat the shipped
score?"* is therefore crediting the family with polish's own repricing. The honest baseline is the
shipped plan pushed through **the identical treatment the candidates get** — `basePolish`, not
`shipped`. This bit a real probe in PHASE9 §5.13 (hypothesis 6): 7 of 25 rows read "★ BEATS shipped"
and **5 of them were the baseline out-scoring itself**. Stated as a habit: *if two numbers in one
comparison were produced by different code paths, the comparison is not a measurement.*

**⚠ The coverage hole, stated honestly.** A plan-diff finds the cells a rule *did* move. It can never
find a cell the rule *should* have moved and didn't — the false-pass direction, this repo's tracked
defect class. That population is not invisible, though: it is exactly the standing-DEFICIT cells,
which are already enumerated per round. So the honest coverage claim is **changed cells → duel them;
unchanged deficit cells → still deficits, still on the list** — and neither set is silently dropped.

**Guard against the self-confirming oracle.** If the model is the arbiter and the sim only ever confirms
it, we can drift. Two habits keep it honest: **proactively sim the known blind spots** (ramp, mana, AoE,
multi-AP timing) rather than waiting for a golden to look wrong, and **periodically re-anchor** — re-run
the trust anchor and a couple of representative goldens end-to-end.

**★★★ 3. A DUEL IS ONLY A DUEL IF THE SIM EXECUTES THE PLAN THE TOOL PRINTS — the intent-vs-fire trap
(07-25, twice in one session).** `optimizeAsync().s` holds **press intents**. The tool's rows, the
goldens, and `exact-match` all speak **fire times** (`simulate(s, cfg, true).actEff`). The two differ
whenever a press lands inside — or just before — an intermission: the model defers it to the phase
resume (`simulate()` walks `t` to `seg.end`), the sim fires it at the next real cast boundary, still
inside the untargetable downtime. Two distinct failures came out of this in one afternoon:

- **As a harness bug.** `tools/xval.mjs:194` transcribes `toSpec(best.s)` — raw intents — into genapl,
  so **the whole cross-val corpus sims schedules the tool would never print.** Priced on one KT plan at
  haste 0: the *identical* plan reads **−1.5432 %** under the intent transcription and **−0.0104 %**
  under fire times, because a `93` IV intent (fire time `105`) burns ~12 s of Icy Veins inside the
  94–105 intermission. **That artifact is 5–10× the deficits the acceptance campaign is chasing.**
  Tracked as P7.15 (PHASE7 §5.21); ⚠ **do not flip the convention silently** — cross-round comparability
  depends on it being constant, so a switch owes a written justification, an `ACCEPTANCE.md`
  announcement, and a re-gather of the affected tables.
- **As a phantom determinism violation.** Comparing a bare-node `best.s` (`icyVeins:[93,113,381]`)
  against a browser-rendered plan (`[105,125,381]`) looks like the engine going non-deterministic — the
  one failure that would invalidate exact-match wholesale. It was neither: scoring both under one engine
  gave the *same* `robust = 617296.6744`. **Adjudicate, don't infer** — the cost of the check was one
  30-line script, the cost of believing it was ~40 min.

**Habit:** before any comparison involving a schedule, ask *which convention is each side in?* If one
side came from `best.s` and the other from a rendered plan, convert first — otherwise it is not a
measurement, in exactly the sense of the "different code paths" rule above.

**✅ RESOLVED 07-25 (P7.15, PHASE7 §5.22) — `EMIT=fire` is now the default, and the artifact priced out
SMALL.** Two things had to be separated before any of it made sense:

| | what happens | is it a bug? |
|---|---|---|
| **CLIP** | press is in targetable time, the buff **tail** runs into a wall | **NO — correctly priced.** `simulate()` accrues no cast rate inside an intermission, so the model already charged it. KT opens `Icon@0` against a wall at 0:15 in *every* plan. |
| **ARTIFACT** | the **press time itself** is inside an intermission | **YES** — the model scored the buff from the resume, the sim starts it mid-downtime. |

The first scan reported "123 s of buff spent while untargetable" and read as a catastrophe. **92 % of it
was legitimate clipping.** On the banked round-7 corpus (60 plans): ARTIFACT **2 plans (3 %), 10.0 s** —
and because `EMIT=fire` **floors**, sub-second slip is a *no-op* (only **18/60** specs change at all).
**The 3 surviving over-floor deficit cells are not among the 18** — bit-identical under both
conventions — so the acceptance deficits are model signal, not harness fiction.

**★ The sign was INVERTED from the prediction, and the mechanism generalizes.** Intent was expected to
*deflate* those plans (buff burned in downtime); the duel says it **inflated** them by ~0.26 %.
`MQG@100` deferred to `105` gains 5 s at the front, but the 300 s cooldown pushes the second press
`400 → 405` against a fight that ends at **420** — the gain is repaid with interest at the truncated
tail. **Consequence to remember: an inflated plan in a BORROWED column can manufacture a phantom
deficit.** The original framing only worried about cells looking *worse*; over-valuation is the second,
independent reason the convention had to be fixed.

**★★ 4. A duel measured at one haste does NOT transfer to another config.** The AE lattice pitch
Δ = `max(1.0, 1.5/m)` is haste-dependent, so *whether a value window's tail clips a phase wall* changes
with gear (≈1.11 s at h195-with-IV vs 1.25 s at h0-with-IV). The P7.14 fix reads **+0.2930 pp** at
haste 195 and **−0.0067 ± 0.0047 pp** at haste 0 — same fix, same fight, opposite sign, both correct.
So when a change moves a **golden**, re-duel at that golden's own `GOLDEN_DEFAULTS` config; borrowing
the derivation cell's numbers is the same class of error as reading an aggregate for a cell.

**★★★ 5. THE IDENTITY FILTER RUNS FIRST — before pricing an effect, check whether the input differs at
all (07-25).** This is lesson 1 ("verification cost scales with CHANGED CELLS") generalized from plan
*outputs* to **every** input of every instrument, and it was being applied to only half the pipeline.

The demonstration is P7.15's own tooling. Three instruments were built to price the transcription
artifact; the one that actually settled it asked *"do the emitted specs even change?"* — 30 seconds to
write, instant to run, decisive answer (**18/60 change; none of the deficit cells**). It was built
**third**. The two expensive arms measured how much an effect was worth on a population that was 70 %
identity.

**Habit:** for any A-vs-B question, compute the *changed set* first, with the cheapest possible
comparison, and let it define the work. `plan-diff` already does this for plans. It applies equally to
specs, gear, harness config, and goldens.

**The concrete payoff — `DPS_CACHE`, a lossless content-addressed sim cache (`tools/xval.mjs`).** The
sim is deterministic given `(spec, gear, haste, T, iterations, seed, targets, runner)`; verified, not
assumed — three runs of one APL at `iter=2000`, seed 11 gave **2152.4 / 2152.4 / 2152.4**. So a
re-gather can key every sim on exactly that tuple and pay only for the cells whose spec actually moved —
**across rounds, not just within one.** On P7.15's numbers that is ~70 % of a boss round for free, with
*identical* numbers rather than approximated ones.
- `DPS_CACHE=<dir>` overrides the location (default `$TMPDIR/arcane-dps-cache`); `DPS_CACHE=0` disables.
- **`DPS_CACHE_VERIFY=1` re-sims every cached entry and exits 2 on any mismatch.** The determinism
  assumption is load-bearing, so it stays *auditable* rather than merely believed. Run it after any
  runner rebuild.
- `runSim()` is the **only** path to the runner, so the cache cannot be bypassed and the NaN trap applies
  to cached and fresh alike. The key includes the runner's `path:size:mtime` and a hash of the gear
  export's *content*, so a rebuilt runner or an edited export invalidates the cache automatically —
  the repricing trap in lesson 1 is handled by construction, not by remembering.
- `XVAL-DONE` stamps `cache=<hits>/<total>`. That is **provenance, not a performance stat**: it says how
  much of this round was replayed, so a suspiciously-cheap round is visible in its own log.

**★★★ 6. THE HARNESS AND THE MODEL SHARE `simulate()` — a standing CORRELATED-ERROR risk (07-25).**
`xval.mjs` computes the fire times it feeds the sim using the same function whose correctness the duel
is meant to certify. **If `simulate()` is wrong, the model and the transcription are wrong identically,
the sim agrees, and the round reports CLEAN.** This is not hypothetical — it has already happened once,
as the Vashj phase-drop bug (model and sim wrong the *same* way, `diag=CLEAN`).

⚠ **`EMIT=fire` INCREASES this coupling**, because the harness input now routes through `simulate()`
where it previously bypassed it. That is still the right call — a duel must execute the plan the tool
prints — but it converts an incidental risk into a structural one, so it earns a check that does not
share the suspect code.

**The check: the ARTIFACT GUARD (`tools/xval.mjs`, after the plans are emitted).** It reads **only the
emitted spec** — the literal JSON genapl consumes, including the `_intermissions` table that came
straight off the boss preset — and asks one arithmetic question: *does any press land inside a window
where the boss is untargetable?* No engine, no `simulate()`, no shared state. Under `EMIT=fire` the
answer **must be zero**, because `simulate()` walks its clock to `seg.end` before firing
(`index.html:737`). A nonzero count is a `simulate()`-independent alarm: either that walk is not
happening or the emission path lost it. It **reports rather than gates** (under `EMIT=intent` a nonzero
count is *expected* — it is the P7.15 artifact itself), and `artifact=N` is stamped on `XVAL-DONE` so the
count lands in the round's permanent record instead of on a screen someone happened to be watching.

**Generalization:** any time an instrument computes its own input with the code under test, write down
what an *independent* recomputation of that input would be, and run it. It is usually arithmetic on a
table both sides already agree on.

**★★★ 7. THE ACCEPTANCE TEST IS PURELY RELATIVE — it cannot see UNIFORM error (07-25).** The cross-val
asks exactly one question: *does the plan optimized at haste H beat every borrowed plan when simmed at
H?* That detects **misallocation across haste**. It is blind, by construction, to every cell sitting the
same distance below the true optimum — the diagonal would come back perfectly CLEAN. The sim trust
anchor (~0.4 % agreement) certifies the **physics**, not the **search**, so a systematic search weakness
— the optimizer consistently missing one *kind* of layout — is invisible to the entire campaign.

**The absolute anchor already exists: `tools/brute-grid.mjs --tool`.** Full 5 s-grid exhaustive
enumeration (7.9M cells, ~0.6 min/haste point) versus the real optimizer on the same fight. In-tool
"exact mode" is permanently rejected as a *product* feature; that rejection never applied to using
enumeration as a **research check**, and this is the gap it fills.

**First run of it as a standing anchor (07-25, T=80, Lust@20) — 9/9 PASS:**

| fight | h0 | h195 | h300 |
|---|---|---|---|
| plain, `isc+scb` | **PASS** +0.000 | **PASS** +0.000 | **PASS** −0.010 |
| plain, `mqg+skull` | **PASS** −0.062 | **PASS** +0.031 | **PASS** +0.000 |
| **AoE [40,60]×6**, `isc+scb` | **PASS** −0.018 | **PASS** +0.000 | **PASS** +0.000 |

The tool searches at 1 s resolution and the grid at 5 s, so `tool ≥ grid` is the pass condition and a
small negative Δ inside the 0.15 pressability band is expected. **Six of the nine are exact ties with the
exhaustive optimum and the worst is −0.062**, i.e. the search is not leaving anything on the table on a
fight this instrument can enumerate — **including an AoE-window fight**, which is the regime P7.14 and
the surviving deficits live in and the one where a systematic search weakness was most plausible. **Run this after any optimizer/pass-order
change** — it is the only instrument in the project that answers "is the search near the actual best
plan," and it costs a minute.

⚠ **Its coverage is real but narrow**: T=80, a 5 s lattice, 6 tracked cooldowns, one Lust pin. It cannot
certify a 7-minute boss fight. Treat a PASS as "the search is not systematically broken on a fight this
instrument can enumerate", not as "the search is optimal."

**Scorer vs optimizer — two separate axes.** This settles the *scorer*: the effective-ABs count is the
objective and the arbiter. It says nothing about the *optimizer's* search-completeness — whether the
passes actually *find* the count-maximizing plan is a different question (the packing/containment work
was all search, not scoring). Don't conflate "the count is right" with "the search reached it."
Lesson 7 above is the instrument for the second axis; lessons 1–4 are the first.

## Pieces

- **`tools/genapl.mjs`** (in this repo, durable): builds a wowsims `APLRotation` JSON that spams Arcane
  Blast and fires each cooldown at **fixed scheduled times** (`APLActionSchedule`). Example:
  `node tools/genapl.mjs '{"IV":[105,125,396],"AP":[105,285],"Icon":[0,125,260,396],"Gem":[105,285,405],"Zerk":[105,285],"CS":[124],"BL":[260]}' out.apl.json`.
  Keys: `IV AP CS Zerk BL Icon Gem Skull MQG`. Supports `_intermission:[a,z]` / `_intermissions:[[a,z],…]`
  (AB gated off during downtime) and `_prestack:N` (prepull AB casts). **`_prestack` DEFAULTS TO 0
  (COLD OPEN) — the model never prepulls; see the ★★★ HARD RULE at the top of this file. Do not set
  it >0 for a model comparison.** Spell/item IDs in the file header. **This is the INFINITE-mana
  harness** (AB-spam forever) — pair it with
  `--mana 900000` for layout work. **★ Forgetting `--mana` silently turns a layout gate into a mana
  test** (burned us in the band-gate audit: −4% phantom "refutations"; at h150 an 80s burn is dry by
  0:25, 34 ABs instead of 64, and A/B arms OOM differently). If a layout A/B disagrees with the model
  by >1%, check `--mana` FIRST.
- **`tools/genconserve.mjs`** (durable): the **FINITE-mana / conserve** harness (for the real gearing
  stat weights, `docs/EP.md`). Same cooldown-schedule interface as `genapl`, but the *filler* is
  mana-managed: **Arcane Blast while burning** (Bloodlust/Arcane-Power/Icy-Veins aura up, or a
  `_burnWindows:[[a,z]]`) **or above a `_conserve` mana-% threshold; else Frostbolt** (27072 — cheap,
  ≈ mana-neutral with JoW+regen); **Evocation** below `_evo`; and — **critically** — an
  `autocastOtherCooldowns` action that fires the **external** mana CDs the APL would otherwise suppress
  (Innervate, Mana Tide). Robust to the threshold (DPS flat across `_conserve` 0.2–0.6). Trust-anchored:
  its DPS is within **2.7%** of the export's own native wowsims Arcane rotation. `_noEvo`/`_noAutocast`
  toggle those off. See the **finite-mana harness** section below.
  **★ Fixed 07-25 (the 07-25 false-pass sweep, task #59).** `_noAutocast` was **read** by `build` but
  **missing from the known-key set**, so the unknown-key guard rejected the one key this very bullet
  documents — `unknown spec key(s) _noAutocast`, no APL at all. A guard that *over*-rejects is the same
  defect class as one that under-rejects; it fails loudly, which is why it was never chased. Two more
  closed alongside, both mirroring `genapl.mjs`: a **missing or empty CLI spec** fell through to a silent
  **exit 0 having written nothing**, leaving a **stale outfile** for the runner to sim under the new
  experiment's name (demonstrated on the pre-fix file); and non-finite press times formatted straight
  through `` `${t}s` `` into the schedule string. Behaviour-neutral — **6/6 byte-identical** emissions vs
  the pre-fix file across specs covering every key.
- **`runner`** (NOT in repo — ~16MB compiled Go binary): a headless single-player sim built from the
  **wowsims TBC-with-APL source** (`wowsims/tbc-new`, module `github.com/wowsims/tbc`, pinned at commit
  **`ade9f39`**). `cmd/runner/main.go` reads an individual gear export, applies an optional `--apl`
  override, injects flat mana/haste via `bonusStats`, builds a `RaidSimRequest` via
  `core.SinglePlayerRaidProto`, and runs `core.RunRaidSimConcurrent`. Flags: `--export --apl --dur --var
  --iter --seed --mana --haste --tag --quiet --dumpreq --targets --crit --sp --int --spirit --mp5`. (Added
  this project: `--targets N` duplicates the encounter target for AoE; `--crit`/`--sp` inject
  SpellCritRating / SpellDamage; **`--int`/`--spirit`/`--mp5` inject Intellect / Spirit / MP5** via
  bonusStats — for AoE isolation and EP finite-differences incl. the **finite-mana** stat weights,
  `docs/EP.md`.) **The full `cmd/runner/main.go` is saved at `tools/wowsims-patches/runner-main.go`** — it
  is entirely our own harness file (not upstream), so a fresh container restores the runner from it +
  `apl-schedule-strict-ready.patch`, then `go build -tags with_db`.
  Output TSV: `tag  dur  var  iter  meanDPS
  stdev  maxDPS  avgFightSec` — **column 5 is mean DPS**.
- **Gear export** — ⚠ **this bullet's "NOT in repo — user-provided" framing is RETIRED (07-26).** Two
  reversals landed on top of it, in this order: `BENCH.md` §1.1 **committed** the export
  (`tools/bench/export.json` — it holds no personal identifiers, and an unreproducible rig was the
  worse problem), and then `GEAR-AGNOSTIC.md` retired *having* an export at all — the reference
  character is now defined by the planner's own declared inputs (`sim/model-ref.json`). **Do not go
  looking for a user gear file; do not commit a new one.** The committed export survives only as the
  denominator of the last geared round (PHASE12 §1.1e archives it under a name that says so).
  For the record, the character it describes is a full, realistic Arcane raid setup (Wrath of Air,
  Totem of Wrath, Misery, Curse of Elements, Improved Shadow Bolt, JoW, Kings/Wisdom; kit = IV, Icon,
  Serpent-Coil gem, Arcane Power, Berserking, Bloodlust).
- **wowsims-tbc source + the native `runner`** are **ephemeral** — they live wherever you cloned and
  built them (cleared with the container) and are rebuilt in ~4 min by the recipe below. ⚠ The old
  claim that "only `tools/genapl.mjs` persists in the repo" is **false at HEAD**: the whole `sim/`
  subsystem is committed, including **`sim/sim.wasm`** — the same engine, compiled — so
  `node tools/bench.mjs …` produces a number **from the repo alone**, with no clone and no build.
  The native runner is a ~6× *speed* option for bulk gathering (PHASE12 §2.1b), not a prerequisite.
- **`tools/explore.mjs`** (durable): the **exploration harness** — brute-scores every placement of a small
  buff set on the model over a gear-haste sweep, reports winners + breakpoints, and flags ramp-sensitive
  winners. `--sim` cross-checks the flagged winners against the runner (needs `RUNNER=… GEAR=…`), building
  the schedules through `genapl` and comparing the model's ordering to the sim's. It's the measuring
  instrument for Phase 4 (find the true optimum without a search; measure model-vs-sim ranking gaps). See
  RULES §16.
  - **Sim-setup gotcha it surfaced:** a *fixed-duration* APL that jams a haste buff against the fight **end**
    shows a spurious loss vs an interior placement (the sim drops the truncated tail casts; the model credits
    them proportionally). When cross-checking placement, keep the buff **interior** (lengthen `--dur`) or the
    fight-end masquerades as a real placement effect. Verified: IV pre-Lust ≡ post-Lust to 0.00% once interior.
- **`tools/lattice-ripple.mjs`** ⛔ **— HISTORICAL as of 07-27, like `ripple-audit` above.** It derives
  the **tail-lattice ripple** — the sum-vs-integral residual between the sim's expected damage and the
  model's **rate integral** — and neither side of that comparison is HEAD any more (§6.10 retired the
  integral, §9 retired the taper the widths were matched on). RULES §8 carries the banner. Its
  *section 3* control ("do not discretize the scorer") is the part still worth reading, because it is
  about method, not about the retired constant. (durable, **no sim needed**) Three argv-selectable sections: `ripple` (the `1 − W/c` table, verified to 4 decimals, with
  the `c = 1.000 → exactly 0` sanity check), `cell` (re-scores one disputed cross-val cell under both
  scorers), `column` (**the do-not-discretize control** — all 11 plan rows of one column, continuous vs
  discrete vs sim, `r` and RMSE). Default `all`. **Read section 3 before believing section 2:** the single
  cell makes the discrete sum look like a fix; the column shows it is a worse predictor.
- **`tools/ripple-audit.mjs`** ⛔ **— HISTORICAL as of 07-27.** It prices the ripple floor `1 − W/c`,
  whose derivation assumes the model integrates the **continuum limit** of a symmetric taper of width
  `W = 2·KILL_WINDOW = 1.0 s`. **Neither premise holds** (PHASE12 §6.10 retired the integral, §9 retired
  the taper), so the tool is now a reader of the **archived** corpus, not a ruler for the shipping
  model. Its design lessons below stay first-rate; its numbers do not transfer. (durable, **no sim needed**): prices **every** cross-val deficit column
  against that ripple floor, so a residual can be compared to the instrument's own resolution before it is
  called a model defect. Two commands:
  ```
  node tools/xval-collect.mjs tools/xval-results --json /tmp/targets.json
  node tools/ripple-audit.mjs /tmp/targets.json
  ```
  It is pure **arithmetic on the model's own cast list** — legitimate only because every round-5 column was
  measured at `--var 0.5`, i.e. at the taper width the closed form assumes. Reports
  `ripplePct = 100·(1 − W/c)/Nt` per column, `inside`/`over` buckets, an **INDETERMINATE** bucket for cells
  whose verdict flips with the ambiguous kill-edge period (no false pass in *either* direction), Spearman
  ρ(floor, deficit), and an over-floor family split. Two design notes worth copying into future probes:
  - **Five predictions are PRE-REGISTERED in the file header, written before the first run** — including a
    **vacuity guard** (`BOUND UNINFORMATIVE` if >95% of columns sit inside AND the median floor exceeds 3×
    the median deficit — *an upper bound that everything satisfies is not evidence*), a **discrimination**
    requirement (the Kael'thas-420 family, which carries its own AoE + wall-parity channels, must EXCEED
    the bound), and an **arithmetic self-check** (median floor must fall monotonically short→xl, since
    `Nt` grows with fight length). The guard's second clause did trip; only the 80.2% coverage kept the
    result informative.
  - **`c` is the KILL-EDGE period (`last.interval`), not a min/mean over the last few casts.** A first cut
    used min-over-last-3 as a "conservative" (smaller-`c` ⇒ smaller-floor) bound; it broke the monotonicity
    self-check and mislabelled a low-haste cell. The taper is only `W = 1.0 s` wide, so only casts
    completing in `[T−0.5, T+0.5]` can contribute, and a min can reach back into a different buff regime.
    *Being conservative about the NUMBER while being wrong about the DERIVATION is not conservative.*
  - ⚠ **Boss rows carry a second wall-parity channel**, so their floor is a *lower* bound on the artifact
    budget — never read a boss cell's "over the floor" as scorer evidence on its own.
  - `--json out.json` dumps the priced rows so follow-up probes **stratify one pricing implementation**
    instead of re-deriving it. Both probes below read it.
- **`tools/floor-plateau.mjs`** + **`tools/ambient-gap.mjs`** + **`tools/unexplained-gap.mjs`** (durable,
  **no sim needed**): the three pre-registered probes that worked the over-floor residual — and, in the end,
  established that it **cannot be worked in aggregate at all**. Chain (each stage `--json`-dumps for the next,
  so the pricing and the scoring each exist **once**):
  ```
  node tools/xval-collect.mjs tools/xval-results --json /tmp/targets.json
  node tools/ripple-audit.mjs   /tmp/targets.json --json /tmp/priced.json
  node tools/floor-plateau.mjs  /tmp/priced.json  --json /tmp/scored.json
  node tools/ambient-gap.mjs    /tmp/scored.json
  node tools/unexplained-gap.mjs /tmp/scored.json
  ```
  `floor-plateau` re-scores **both** plans of a column at the **common** haste through one identical call and
  asks whether the model is *indifferent* where the GCD floor binds (H_PLATEAU — a tie-break failure) or
  *confidently wrong* (a valuation error); `ambient-gap` asks whether the post-ripple residual is one
  homogeneous scale or a localized defect; `unexplained-gap` corrects `ambient-gap`'s currency and then
  bootstraps the ranking it produces. All three hypotheses were **falsified** — see RULES §8 consequences 4–5
  and PHASE7 §5.16e–f. Six lessons worth copying:
  - **★★★ BOOTSTRAP A RANKING BEFORE YOU TARGET FROM IT.** Three successive currencies (`pct`, `joint`,
    `unexplained`) produced **three different orderings** of the same four families, and each time the natural
    move was to declare the new top the target. The measurement that settled it was a **seeded 20 000-resample
    bootstrap** of the 135 columns: the nominal worst family tops only **60.8 %** of them. The between-family
    differences (~0.1 pp) are the size of the instrument's own per-cell ceiling (corpus median 0.134 pp) — the
    ranking was **noise-dominated**, so no currency could ever have ordered it, and the instrument-dependence
    was a property of the **data**, not of the formulas. Two rounds of re-ranking were the wrong kind of work.
    Cost of the check: ~20 lines and one second. Run it *first* next time.
  - **★★ SUBTRACT AN ARTIFACT BUDGET ONLY FROM THE TERM THAT HAS ONE.** `joint = dModel + pct` adds a
    **ripple-bounded** term to an **unbounded** one (`dModel` is model-vs-model — no sim, so no lattice), and
    family ceilings differ **9×**. Comparing that sum across families largely compares **ceilings**, which is
    how it promoted SATURATED — the family *defined* by having its `pct` covered by a large ceiling — to
    second-worst and got its label wrongly flagged for re-derivation. The corrected form is
    `unexplained = dModel + max(0, pct − ripplePct)`.
  - **★★ MEASURE A TERM, DON'T SUBTRACT TWO MEDIANS.** "The model is ~0.06 pp over-confident everywhere" came
    from `median(joint) − median(pct)` = 0.0814 − 0.0250. **Medians are not additive.** Measured directly,
    `median(dModel)` inside the floor is **0.0398 pp** — the claim survived, the number was inflated ~40 %.
  - ⚠ **A RATIO SPREAD IS A DEFECTIVE CRITERION NEAR ZERO.** `unexplained`'s max/min across labels *rose*
    (3.37× → 4.34×) while **every** family's absolute gap fell (top −42 %) — the ratio grew only because the
    minimum fell further (−55 %). One term's spread is literally *infinite* (a median of exactly 0.0000 by
    construction). Pre-register an **absolute** threshold when the quantities can approach zero.
  - **★★★ MEASURE IN THE JOINT CURRENCY** (what survives of consequence 4). `pct` (the sim deficit) is only
    half the disagreement; the model's own margin `dModel` is the other half. Ranking by `pct` alone put
    FLOOR-TAIL first purely because its ceiling is 6× smaller than ambient — an ordinary gap with no ruler
    over it. That specific correction stands; the *ranking* built on it did not.
  - ⚠ **`dModel ≥ 0` is BY CONSTRUCTION** — the native plan *is* the model's own argmax at that haste, so only
    a search miss can flip its sign. A "the model prefers native 12/12" line is therefore a **validity check**
    (pooling removed the search misses), never evidence about magnitudes. Only the magnitude carries content.
  - ⚠ **Do not put an assumption in a verdict string.** `ambient-gap`'s A4 falsifier text, as first written,
    asserted that a failure would mean *the floored corner* carried extra disagreement — because that was the
    family under investigation. A4 fired and the blame lay elsewhere entirely. The clause is now corrected
    in-file with the reason, and the report **computes** which labels break the band. Pre-registration must
    fix the **test**, not narrate the expected explanation.

- **`tools/cell-band.mjs`** (durable, **needs the sim**): puts an **error bar on ONE cross-val cell** — the
  unit `unexplained-gap`'s bootstrap proved is the only one this corpus can resolve. It replays a cell
  *exactly* as `xval.mjs` computes it (the boss's walls, `WJ=2`, the **mean over wall-jitter variants**, iter
  6000, `--var 0.5`, `--targets N`) for two plans at one sim haste, across a list of sim **base seeds**
  (`--seeds`) **and** an arbitrary **number of wall-jitter variants** (`--variants N`). The
  `mulb`/`VARIANTS`/`shiftSpec` block is copied **verbatim** from `xval.mjs:239-257` so the replay cannot
  drift from the thing it replays. `--seeds2` runs a second group and prints `sd(group1)/sd(group2)` (that is
  how the contiguous-seed defect below was measured); `--prefix 1,3,5,9,17,33` prints the **prefix-mean
  convergence** of the wash (the variants are **nested** — `mulb(9000+v)` — so the corpus's 5 are a prefix of
  any deeper set, and one deep run yields the whole curve); `--dump` writes the raw per-variant cell.
  ```
  RUNNER=/path/to/runner-ap180 EXPORT=tools/bench/export.json node tools/cell-band.mjs \
    --a "$(cat A.spec.json)" --labelA native --b "$(cat B.spec.json)" --labelB borrowd \
    --walls 15,42,69,94,105,160,306 --dur 420 --haste 195 --targets 6 \
    --iter 6000 --seeds 11,100011,200011,300011,400011 --variants 33 --prefix 1,3,5,9,17,25,33
  ```
  What it measured on the first cell it was pointed at (PHASE7 §5.17, RULES §8 consequence 6) — all four are
  reusable facts about **the harness**, not about that cell:
  - **★★★ A BOSS CELL IS A 5-VARIANT MEAN, AND REPRODUCING ONE BY HAND NEEDS ALL 5.** `xval.mjs:233-245`
    engages the wall-jitter wash only `if (process.env.BOSS && wallList.length)`; a boss cell is then the mean
    over `1 + 2*WJITTER = 5` variants at **ITER=6000** (`xval-boss.sh`), while a **class** cell is **1 variant
    at ITER=10000**. **The corpus is TWO INSTRUMENTS with different noise, and any statistic that pools boss
    and class cells inherits that.** An earlier hand-reproduction landed 2371.7 vs the log's 2371.4 and cost
    hours of hunting for a missing input; the missing input was the mean. With the 5 variants replayed it
    reproduces **exactly** (2371.4 / 2380.0 / 0.3627 vs 0.3626).
  - **★★★ THE VARIANT COUNT, NOT THE SEED, IS THE BOSS CELL'S ERROR BAR.** Seed noise: sd **0.0058 pp**.
    Wall-jitter noise: per-variant sd **0.1427 pp**, i.e. **±0.0638 pp (1σ) at N=5** — **12× larger**, and the
    size of boss cells' median ripple ceiling. `ripplePct` prices **one** wall (the tail); a boss cell has
    **seven**. Class cells genuinely have one (`downtime`/`aoeWins` are populated **only inside `if (BOSS)`**),
    so their floor is complete. Grade a boss cell against the **variant** band; a class cell against ripple.
  - **★★ THE WASH SATURATES IN THE MEAN AT N=5 BUT NOT IN THE VARIANCE** — prefix means are flat from N=5 to
    N=33 while the SEM falls 0.068 → 0.025. So deepening the wash buys **precision**, never a different
    answer. And the spread is **bimodal**, gap = **one cast** (3375 damage): the FLOOR LAW below shows up on a
    walled fight as a **discrete parity mode**. Split the variants by mode before quoting a mean — the
    parity-free subset is the number with content.
  - **⚠ `VARIANTS[0]` IS δ=0 BY CONSTRUCTION, SO THE UN-JITTERED GEOMETRY CARRIES 20 % OF EVERY BOSS CELL.**
    At the measured cell v0 lands in the *parity* mode, so the cell reads **0.3627 where the same draw without
    v0 reads 0.2953** — +0.067 pp from one hardcoded vector, on the one geometry the wash exists to smear.
    Recorded, not changed: it moves every boss cell in the committed corpus.
  - **⚠ DEEPEN A WASH WITH MORE VARIANTS, NEVER A WIDER δ.** KT's walls 94 and 105 are 11 s apart, so
    `2·WJ ≥ 11` can put them **out of order** and sim a geometrically impossible fight. `cell-band.mjs` has a
    hard wall-order guard that dies rather than run one; `xval.mjs` never needed it (WJ is fixed at 2).

## ★★★ THE TWO wowsims — AND WE USE THE NEW ONE (read before citing, linking or cloning)

| repo | deployed at | status | our use |
|---|---|---|---|
| **`wowsims/tbc-new`** | **https://www.wowsims.com/tbc/** | **live, maintained** | ✅ **this is what we build, pin, patch and link** |
| `wowsims/tbc` | https://wowsims.github.io/tbc/ | **ARCHIVED** — original TBC Classic (2021), pre-APL; the page itself now says *"This sim is outdated!"* | ❌ never |

★ **The trap is that `tbc-new` declares Go module `github.com/wowsims/tbc`.** Deriving a URL from the
import path lands on the ARCHIVED repo, which has neither our pinned commit nor either patch target.
It has cost this project a full detour once already. **Read the URL, don't derive it.**

⚠ **The same trap in its OTHER form: the LINK, not the clone.** On 07-26 the shipped page linked to
`wowsims.github.io/tbc` in two places — the engine was always `tbc-new`, but a user reasonably read the
link as "this whole project is built on the dead sim". A wrong citation costs credibility exactly as
much as a wrong dependency. **Any user-facing mention of the simulator points at
`https://www.wowsims.com/tbc/`.**

**Are we behind upstream, and does it matter?** One command:
```
bash tools/upstream-drift.sh
```
It reports the commit distance from our pin and filters the changes to the paths that could move an
arcane mage's cast stream. Being pinned is deliberate — a moving sim under a calibrated model would
make every recorded number unreproducible — so the goal is an *informed* pin, not a current one.

## Building the runner (do this once per fresh session)

> ### ✅ VERIFIED WORKING 07-26 — the recipe below is correct; here are the two undocumented steps
> A full rebuild was executed from a fresh container. **Nothing about the rig was lost.** `ade9f39`
> is present in **`wowsims/tbc-new`** (`ade9f39cc`, *"Merge pull request #421 from
> wowsims/fix/armor-reduction"*), both patches apply cleanly, `assets/database/*.bin` **are
> committed** in that repo, and the provenance checks in `docs/archive/07` pass exactly as written
> (`grep -c innerSpell sim/core/apl_actions_timing.go` = **3**; `grep -c 'CD.Use'
> sim/mage/arcane_power.go` = **0**). The runner builds to an 18 MB binary.
>
> ⚠ **THE REPO IS `wowsims/tbc-new`, NOT `wowsims/tbc`.** It declares Go module
> `github.com/wowsims/tbc`, so inferring the clone URL from `runner-main.go`'s imports leads to the
> WRONG repo — the archived `wowsims/tbc`, which is the legacy pre-APL sim and contains neither
> `ade9f39` nor either patch target. That inference cost a full detour; the URL is written here and
> in `SOURCES.md` for exactly this reason. **Read it, don't derive it.**
>
> **Two steps the recipe omits, both needed on a bare clone:**
> 1. `sim/core/proto/*.pb.go` is **generated, not committed** — the build fails with
>    *"no required module provides package github.com/wowsims/tbc/sim/core/proto"* until you run:
>    ```
>    apt-get install -y protobuf-compiler
>    GOBIN=/usr/local/bin go install google.golang.org/protobuf/cmd/protoc-gen-go@v1.36.10
>    protoc -I=./proto --go_out=./sim/core ./proto/*.proto        # makefile:210
>    ```
>    ★ Match the plugin to the repo's `google.golang.org/protobuf` version (**v1.36.10** at
>    `ade9f39`) — an older plugin emits code the newer runtime rejects.
> 2. `cmd/runner/` does not exist upstream; create it and copy
>    `tools/wowsims-patches/runner-main.go` to `cmd/runner/main.go` before building.
>
> **The character is in the repo now — do NOT go hunting for a user export.** This block used to say
> the gear export was the one irreplaceable input and to ask the owner for it. Both halves are dead:
> `BENCH.md` §1.1 committed it (`tools/bench/export.json`), and `GEAR-AGNOSTIC.md` then retired the
> whole idea of an exported character in favour of `sim/model-ref.json`, whose stats are *injected*
> from the planner's declared inputs. **A rebuilt runner needs no external file.**
>
> #### The export search, done exhaustively 07-26 — kept only so nobody repeats it
> ⚠ **Historical.** At the time, the gear-A export was genuinely nowhere (never committed, by the
> since-reversed policy): not in the working tree (only model-side `sp`/`crit`/`haste`/`coldSnap`
> parameters), not at any commit on any branch, and not in `tools/xval-results/` (which records plans
> and sim output, not the character). That search is *finished* and its conclusion — "reconstruct, or
> re-export" — was acted on: the re-export **is** gear B. Do not run the search again.
>
> **What was preserved about the gear-A character** (enough to rebuild an *equivalent*, not the
> original): Tirisfal T5 2pc set 649 items **30206/30196/30207** (+20 % AB damage), 4pc `SpellID 37444`
> (+70 SP on crit, 88–94 % uptime ⇒ effective **SP ≈ 1450**), Icon of the Silver Crescent **29370**,
> `critPct 38`, measured casting regen ≈ **104 mana/s**, Vampiric Touch **+250 mp5** — see
> `SOURCES.md` and PHASE8 §6/§7.
>
> ⚠ **The warning this block ended on came true, and is the reason `GEAR-AGNOSTIC.md` exists:** a
> re-exported character *is* a new baseline, so the trust anchor and every corpus number moved with it
> (BENCH §1). The lesson is now enforced structurally rather than by caution — `char=` stamps every
> table, and the reference character is code, not a file that can be re-exported.

```
git clone https://github.com/wowsims/tbc-new.git && cd tbc-new && git checkout ade9f39
go build -tags with_db -o runner ./cmd/runner
```

- **`-tags with_db` is REQUIRED.** `sim/core/database_load.go` is `//go:build with_db`; without the tag
  the item database is **empty** and any real gear export dies with `SIM ERROR: No item with id: NNNNN`.
- The DB assets (`assets/database/db.bin`, `leftover_db.bin`, embedded via `//go:embed`) are **generated,
  not committed** at `ade9f39`. A brand-new clone must regenerate them with the DB tooling before
  `-tags with_db` will link; the scratchpad clone already has them.
- Sanity after building: a clean rebuild is byte-identical run-to-run and reproduces the baseline DPS.

### ★★ Where the drivers FIND the runner — `tools/xval-env.sh` (07-25)

`xval-kit.sh` / `xval-boss.sh` / `xval-rerun.sh` each used to hardcode the same absolute scratchpad
path, and that path **contains a session id**. Two defects in one line:

1. **It leaks a session identifier into a committed, shareable artifact** — the thing CLAUDE.md's
   identity rule names explicitly. (`tools/ladders/verify{,2,3}.mjs` had the same line, pointing at
   scratchpad copies of ladder JSONs **that are committed right beside those scripts**; they now read
   their own directory, and all three still run.)
2. **It rots silently.** A reclaimed container gets a fresh session dir. `set -u` does *not* catch
   this — the variables **are** set, just to a dead path — so a campaign fails minutes in, with a
   confusing error, instead of in the first second.

All three drivers now `source tools/xval-env.sh` and call `xval_preflight`. Resolution is
**override > discover > loud exit 2**, and the discovery probes by **content, not mtime**: at the time
this was written the box held **five** sibling scratchpads from earlier sessions and exactly **one**
had the runner in it, so "take the newest scratchpad" — the obvious repair — would have picked wrong.

```
bash tools/xval-boss.sh                          # discovers SP automatically
SP=/path/to/scratchpad bash tools/xval-boss.sh   # or point it explicitly
RUNNER=... EXPORT_BASE=... bash tools/xval-kit.sh mqg,skull
```

⚠ **RETIRED PATH (07-26) — the drivers above are the pre-`bench.mjs` generation.** `xval-kit.sh` /
`xval-boss.sh` / `xval-campaign.sh` / `xval-rerun.sh` still resolve `RUNNER` + `EXPORT_BASE` and are
kept for reproducing an archived round; **the current round driver is
`tools/xval-bench-campaign.sh` → `tools/xval-bench.mjs`**, which needs neither (it runs the committed
`sim/sim.wasm`, and takes `RUNNER=` only as a ~6× speed option). The old `EXPORT_BASE`-is-user-data
rule is **reversed** — the export is committed at `tools/bench/export.json` (BENCH §1.1), and is itself
retired as a baseline by `GEAR-AGNOSTIC.md`. What still holds on the retired path: a missing
`RUNNER`/`EXPORT_BASE` is an exit-2 **setup failure**, never a `diag=DEFICIT` observation.

## Trust anchor — certify the runner reproduces canonical wowsims

The runner is a thin CLI over the same `sim/core` the wowsims web UI uses. To prove it faithfully
reproduces canonical wowsims (not just internally consistent):

```
runner --export gear.json --apl plainAB.apl.json --dur 420 --var 0 --iter 50000 --seed 11 \
       --mana 900000 --dumpreq req.json           # our runner's DPS + the exact RaidSimRequest it built
wowsimcli sim --infile req.json                    # upstream canonical CLI on the SAME request
# extract raidMetrics.parties[0].players[0].dps.avg — must equal the runner's column-5 DPS
```

`--dumpreq` writes the built `RaidSimRequest` as protojson; `wowsimcli` (`go build -tags with_db -o
wowsimcli ./cmd/wowsimcli`) is the upstream tool the web backend uses. **Verified: identical to the
decimal** (plain-AB mana-0 = 944.4 == 944.4; mana-900k = 2264.9 == 2264.9, incl. stdev; re-anchored
2026-07-24 on the current export: 2248.8 == 2248.8 with stdev 47.2 == 47.2). The IDENTITY is the
anchor, not the absolute number — it shifts with export revisions. So absolute numbers are
trustworthy, not just A/B deltas. Re-run this whenever the runner or source changes.

## The combat log — `SIMLOG=1`

`SIMLOG=1 runner … 2>log.txt` runs **1 iteration in Debug mode** and prints the full per-event combat
log to stderr: every `[t] Casting {SpellID}` (with Cast Time / GCD / Effective Time), `Completed cast`,
`Aura gained/faded`, mana, damage. This is the tool for pinning *why* a schedule scores as it does —
when a press actually fires, whether it's off-GCD, when a cooldown is ready. (Earlier notes wrongly
claimed the runner had no combat-log flag.)

⚠ **The log prints NUMERIC IDs ONLY** — `{SpellID: 12042}`, `{ItemID: 29370}`, never a name. Grepping
for "Arcane Power" returns nothing and reads as "the buff never fired." Resolve IDs from the plan's own
`*.apl.json`; the ones this project uses:

| | ID | | ID |
|---|---|---|---|
| Cold Snap | `S11958` | Bloodlust | `S2825` (tag −1) |
| Icy Veins | `S12472` | Arcane Power | `S12042` |
| Berserking | `S20554` (tag 1) | Arcane Explosion | `S27082` |
| Icon of the Silver Crescent | `I29370` | Mana Emerald (the "Gem" press) | `I22044` |
| …whose **+225 SP bracer proc** (SCB) is the aura that actually matters | `S37445` | Clearcasting / AB stack aura | `S12536` / `S36032` |

### ★★ DECOMPOSE A DUEL BY WALKING THE LOG — the cheapest instrument in the project (07-25)

When two plans differ in the sim and you want to know *why*, **do not run more sims**. Take the two
`SIMLOG=1` logs you already captured for the legality check and walk the `Aura gained` / `Aura faded`
stream, labelling each damaging cast with the **set of buffs up at its cast moment**; then pool observed
damage **per aura state across both logs** and read the ledger as
`Σ_states (count_B − count_A) × pooled_dmg_per_cast`.

Two properties make this strong: pooling across both plans cancels **crit variance** (the states are
identical, only the counts differ), and it needs **no assumption** about coefficients, amp curves or
stacking order — it is pure observed damage. On P7.14 (PHASE7 §5.18, RULES §9 Correction 3) it closed a
0.29 pp deficit to **102.6 %** at **zero additional sim cost**, after five sim campaigns had been
pre-registered to attack the same question.

**★ The implementation is `tools/duel-walk.mjs`** (committed 07-27). ⚠ It previously lived only at
`$SP/aoewin/walk.mjs` — gone with the scratchpad — and was rebuilt from this description (PHASE12 §3.6).

```
node tools/duel-walk.mjs --log-a A.log --log-b B.log [--json] [--watch-all]
RUNNER=…/runner-ap180 node tools/duel-walk.mjs --spec-a '{…}' --spec-b '{…}' \
     --T 229 --haste 70 --kit isc,mqg          # runs both arms and walks them
```

It excludes from the state label anything already up at **t = 0** (raid buffs, equip auras — they are in
every state and carry no information, and an equipped trinket's t=0 `ItemID` aura would otherwise read as
a press), plus five **high-churn or inert** auras: the AB stack, Clearcasting, the Tirisfal 4pc and
Serpent-Coil SP procs, and **Sated (57724)** — that last one is not churn but a permanent marker with no
combat effect, and leaving it in splits "before Lust" from "after Lust ended", which are exactly the
casts pooling most needs to merge.

### ⚠⚠ THE POOLED LEDGER'S ASSUMPTION IS NOT ALWAYS TRUE — measured 07-27, and it is why there are TWO

*"Pooling cancels crit variance because the states are identical and only the counts differ"* silently
assumes the casts that **migrate** between states are interchangeable with that state's other casts.
That held on P7.14 — 37 near-identical Arcane Explosions inside one AoE window — and it is **false in
general**: an Arcane Blast's damage depends on its stack and on where in the ramp it sits, so "the
average no-buff cast" is polluted by cheap opener casts that a migrating mid-fight cast is nothing like.
Two controls, both run on the committed tool:

| duel | pooled ledger | paired ledger |
|---|---|---|
| `Icon@6` vs **no Icon at all** (12 casts migrate) | right shape, **187 % closure** — 1.9× too big | **100.0 %** |
| `Icon@6` vs `Icon@80` (counts identical, *different casts* in the window) | **every Δ is 0 — completely blind** | **100.0 %**, showing both 12-cast migrations |

So `duel-walk` prints a **second, exact ledger** whenever both arms cast the same *number* of times —
the common case under CRN with one seed and no haste change. Then cast `i` is the same cast in both
fights, at nearly the same second and stack, and `Σ_i (dmg_B[i] − dmg_A[i])` grouped by the state
**transition** that cast made needs no pooling assumption at all. It closes to 100.0 % by construction.
Rows whose two sides are the **same** state are the instrument's own noise floor — a cast that changed
value without changing which buffs were up. ★ **If those rows dominate, the duel is not decided by buff
placement**, and on the B2 pair at one iteration they do (+2378 of noise against a −1675 measured Δ),
which is the honest reason a near-cancellation needs a seed campaign rather than a log walk.

Other controls: a log walked **against itself** produces an empty ledger in both halves; an empty log,
a NUL-bearing log, and a log with no `[Player (#N)]` events each exit **2**.

Corollary: **capture `SIMLOG=1` for both arms of every duel as a matter of course.** The legality gate
is the cheap excuse to obtain the expensive-looking data.

## ★ THE REFERENCE GEAR — one module, spread, never re-typed

A model-vs-sim harness is only measuring anything if the **model cfg describes the gear the sim actually
runs** — i.e. the reference export. **`tools/reference-gear.mjs` is the single source of truth for that**, and
every harness that builds a cfg for comparison imports it:

```js
import { REF, plainCastInPage } from './reference-gear.mjs';
const plain = await page.evaluate(plainCastInPage, REF);          // page scope: reads the engine's own GAME
const cfg   = { T, hasteRating: h, ...REF, enabled: en, /* … */ };  // ★ SPREAD it — never name the fields
```

`REF = { sp: 1450, critPct: 38, t5two: true }` — the export wears **Tirisfal 2pc** (AP prices additively with
the T5 bonus, and every AB carries ×1.2) and **Tirisfal 4pc** (+70 SP on crit at 88–94% uptime ⇒ effective SP
≈ 1450, not the nameplate 1387). Provenance and the measurement: PHASE8 §6, §7, §20.

- **★ Spread it, don't name the fields.** `cfg.t5two ? 1.2 : 1` reads a *missing* key as `false`, so a
  hand-written cfg that forgets it is a silent 20% mis-valuation of the whole AB stream that still prints
  plausible numbers — `genapl`'s silent-key-drop shape (DIARY 07-25). Spreading makes forgetting *impossible*
  rather than merely unlikely. This is why the correction was a **module**, not two added fields: the gear had
  drifted into **seven hand-written spellings across five tools**, including a bare literal `2241`.
- **★ `plain` must come from the same object as the cfg.** `eff = robust/plain` is a ratio, so where `eff` is
  only displayed the normalizer cancels — but `haste-ladder.mjs` and `brute-grid.mjs --tool` grade a search
  MISS on `toolEff − gridEff < −0.15`, a **difference** of two normalized numbers. A cfg with ×1.2 and a
  `plain` without it inflates every `eff` by exactly 1.2, narrowing that band to 0.125 true casts and reading
  as a 20% model improvement — 30× the correction's real effect (≈ −0.6%).
- **★★ Thread it into EVERY `page.evaluate` that builds a cfg, and verify by RUNNING.** `{...undefined}` is
  silently legal in JS, so omitting `REF` from one evaluate argument does not throw — it strips the gear and
  yields `NaN`, and every `NaN` comparison being false sends the verdict wherever the ladder happens to fall
  (PASS in `haste-ladder`, MISS in `brute-grid`). `node --check` and a `grep REF` both missed exactly this;
  a 20-second smoke run found it. Both certifiers now exit 2 rather than grade a non-finite score.
- **⚠ NOT for `index.html`, NOT for `tests/`.** Neither correction is a model change (PHASE8 §7): the SP figure
  is a property of *this export's* gear and the T5 bonus of *this export's* set. `index.html`'s
  `GOLDEN_DEFAULTS.gear` is the frozen fixture the 25 goldens are pinned to, and `tests/monotonicity.mjs`
  asserts a property that must hold at **any** gear. Neither is sim-compared; neither imports this.

## Running a clean comparison

```
node tools/genapl.mjs '<specA>' A.apl.json
runner --export gear.json --apl A.apl.json --dur 420 --var 0.5 --iter 30000 --seed 11 --mana 100000000 --tag A --quiet
# repeat for specB; compare column 5.
```
- **`--var 0.5` is the default read.** ⛔ This used to read *"it matches the scorer's kill-window
  **width** — but only the width; there is a derivable `1 − W/c`-cast residual"*. **Retired 07-27**
  (PHASE12 §9): the scorer has no kill window to match a width with, so there is no derived residual
  either — see the metric bullets below. It is the default because `tools/var-decision.mjs` measured it
  the better estimator (BENCH §3), full stop.
  `--var 0` is still useful for count-preserving CRN A/Bs (lowest pairing noise) but MUST be confirmed
  at var0.5 (var0's whole-cast parity flipped the §16 h150 gate's sign once). `--mana 100000000` =
  infinite (isolate the overlay from mana). `--haste N` tests gear breakpoints.
- **Iterations: 10–60k is plenty** (single iterations spread ±2%, σ≈50–65 DPS; the mean converges to
  ~0.02% by 10k; 250k was always wasteful). More iterations CANNOT shrink a persistent disagreement —
  the stubborn ones are deterministic structure (cast-boundary parity, wall phase), which only metric
  design (var0.5, wall-jitter) addresses.
- **Use the SAME `--seed` for A and B** — common random numbers (below) make the paired diff low-noise.

## Off-GCD co-fire — there is NO "collision" (the old #1 trap was a myth)

All on-use cooldowns (IV, AP, Icon, gem, Berserking, Bloodlust) are **off the GCD**. The APL executor
(`sim/core/apl.go:445`, `DoNextAction`) **loops, executing every ready action per rotation pass** until
none remain — so any number of off-GCD presses scheduled at the same second all fire together.
- **Verified two ways:** (1) combat log — six cooldowns co-scheduled at t=60 all fire at the same
  boundary (t=61.20), each `GCD=0`, none dropped; (2) DPS — co-scheduling all six at the identical
  integer second is **identical to the decimal** (2773.1) vs the old fractional-offset scheme across
  seeds. **The sub-second offsets were inert; do not use them.** (Any past symptom "fixed" by offsets —
  the −6.7 KT, the +37 — was a boundary/other artifact misattributed to a collision that doesn't exist.
  Goldens gated "with offsets" remain valid because offset-vs-none is an exact wash.)

## GCD-boundary quantization (real; document it)

A scheduled press at time `S` fires at the **completion of the cast in progress at `S`** = the first
cast boundary `≥ S` (off-GCD, so it doesn't delay that cast). Jitter ≤ ~1 cast; near an intermission
exit the first post-downtime cast is a slow 2.5s ramp cast, so an exit-press can land up to ~2.5s late.
A press *also* cannot fire while its own cooldown is still running — a press scheduled inside its
cooldown fires when the cd clears (which may be a later boundary). These two facts drive the
intermission-resume behavior below.

## ★★ `--var 0` QUANTIZES TO INTEGER CASTS — never measure a marginal with it *(now MEASURED, 07-26)*

**Settled with a pre-registered experiment** (`tools/var-decision.mjs`, BENCH §3): mean casts is flat
across **1.5 s** of fight length then jumps **+0.97 casts in a single 0.1 s step** (step concentration
19× vs 1.5× at var 0.5). The decisive consequence: when two arms differ in **terminal cast rate** — a
haste window over the kill vs interior, i.e. RULES §8's most routine call — the measured effect swings
**−32.8 → −0.9 → −31.8 DPS** across 0.1 s of fight length (worst step **31.4 DPS vs 3.3** at var 0.5).
And `--var 0` is **not** quieter: seed band **0.06/0.40** vs **0.04/0.25** DPS — it is *worse on its own
claim*, because a fixed duration parks the fight end exactly on the discontinuity.

★ **The nuance that let `--var 0` survive:** the quantization **cancels** in a paired difference
whenever both arms truncate identically (measured: two such pairs tied to the decimal). So a var-0
result is not automatically wrong — it is unfalsifiable without checking whether the arms share a
terminal lattice, which is a worse property than being simply wrong.

**Use `--var 3.0` for any buff-marginal or A/B measurement. `--var 0` is not "the clean deterministic
answer", it is a resolution failure**, and it has now faked a result twice (PHASE8 §13's "haste buffs are
exempt from the floor law", and half of §14's round-4 table).

With zero jitter every one of your 20 000 iterations is the **same fight**, so the reported DPS is
`(integer cast count × avg damage)/T` — a **staircase**, not a smooth function. Symptoms straight out of
the §14 sweep, all at `--var 0`, `iter=20000`, `seed=11`:

- **R=64 and R=65 return byte-identical base DPS** (2287.9 both) — 1 rating point of real haste, zero
  measured effect.
- **IV and MQG return byte-identical marginals** at R=40/64/65/70 (+3.0249, +3.0421, +3.0421, +4.4442) —
  two different buffs, because they happen to buy the same integer number of casts.
- **Berserking's 10 s window measures +0.03 pp** at five of thirteen ratings — i.e. *zero* extra casts.

None of that is a bug: it is the count law's `ceil` sampling at maximum exposure, and it is the **true**
answer for one phase-locked fight. It is simply orders of magnitude coarser than the sub-cast quantity a
marginal measures. `--var 3.0` dithers the cast phase across iterations and recovers the expectation.

Rule of thumb: **if the quantity you want is smaller than one cast, you must jitter.** Reserve `--var 0`
for reproducing a specific timeline in the combat log, never for a number you intend to compare.

## ★ THE SIM CANNOT PRESS MID-CAST — a value window covers exactly `floor(D/Δ)` casts

The direct consequence of the section above, and it bites **every** damage/SP window you A/B. A value
window of duration `D` boosts **`floor(D/Δ)` casts in the sim**, never the fractional `D/Δ` a *rate
integral* credits. ⚠ **The second half of that sentence used to read "…the model's rate integral
credits", and that is no longer HEAD (07-27).** The objective is a per-cast sum and it reads a value
buff at the cast's **COMPLETION** over `(start, end]` — the sim's own rule (CLAUDE.md's ★ snapshot rule;
gate `tools/credit-check.mjs`), so the model now counts the same casts rather than a fraction. `D/Δ`
survives only in the retired `integral` diagnostic. **The section's physics is unchanged and still the
reference for reading a sim number**; what changed is that the model is no longer the party on the
fractional side of it. Two facts compose: wowsims applies the modifier at **cast COMPLETION** (`applyEffects`,
`sim/core/cast.go:216/258/338/356`), and the APL can only press at a **cast boundary** — so the first
boosted completion is a full `Δ` after the press and the window really spans `[gain+Δ, gain+D]`.

**Verified 10/10** (Icon +155 SP / 20s at t=30, T=100, cold open, CRN seed 11, haste 0→300): predicted floor
== CRN-counted boosted casts at every point, **including both integer crossings** — h78→h82 straddles
`D/Δ` = 13.993/14.027 inside a 4-rating-point window, and h160→h200 straddles 14.686/15.024. Mechanism
confirmed independently: `firstBoostedCast − auraGain` == `Δ` at all ten hastes (1.500 … 1.260). Full table
in PHASE8 §5.

- **Haste buffs are EXEMPT.** Their value is time-compression, which does not expire with the window — it
  rolls to the fight END where `--var` handles the fraction. Never apply this to MQG/IV/Zerk/Lust.
- **Expect a SAWTOOTH, not a curve.** A sim haste sweep of a fixed value window jumps at each integer
  crossing of `D/Δ` and decays between. A model that credits `D/Δ` is **flat** (`(D/Δ)/(T/Δ) = D/T`). A
  sweep that looks non-monotone here is *correct*, unlike the prepull artifact (★★★ below).
- **It is a harness expressiveness limit first, a model bug second.** Real TBC on-use trinkets and Arcane
  Power are **off the GCD and pressable mid-cast**, so a human draws from the whole press phase, for which
  `E[casts] = D/Δ` is unbiased. The sim can only realise φ=0 — the *minimum* of that distribution. Budget
  the model to read `frac(D/Δ) × premium` high against the sim (~+0.036pp on the probe above) before calling
  a gap a bug.

**Two counting traps** (both cost a re-run to find):
- **Never count boosted casts by timestamp membership in `(gain, fade]`.** It double-counts both edges and
  returns floor+1 in 9/10 cases. **Count by CRN damage-difference**: for a count-preserving buff (SP/damage)
  the paired base and buffed runs are cast-for-cast aligned, so the casts whose damage *differs* ARE exactly
  the boosted set.
- **Never take `Δ` from the combat log.** Timestamps quantize to 0.01s, which cannot resolve an integer
  crossing (h78 and h82 both read a median gap of 1.4300 — h82's true `D/Δ` is 14.027 and gets misclassified
  as floor 13). Regressing over the steady train fails differently: one anomalous gap (h200 has a lone 2.66s
  against a modal 1.33 × 61) drags the fit. **Use the analytic interval `Δ(R) = 1.5/(1 + R/1577)`** — valid
  because the R=0 log gives Δ = exactly 1.5000, i.e. the reference export's base spell haste is **0%**.

## External buffs (Bloodlust / PI / Drums) — off-GCD, single application

`raidBuffs.bloodlust=true` **registers** the off-GCD `registerBloodlustCD` cooldown (spell 2825) — that
registration is what makes 2825 castable by the APL; the APL `schedule→castSpell{2825,-1}` **triggers**
it. They are the **same single Lust**, not two. Verified in the combat log: Bloodlust aura gained
exactly **once**, no stray autocast, **no mage GCD spent** (the AB train is uninterrupted). Power
Infusion (10060/-1) and Drums (35476/-1) are the same off-GCD-MCD shape but are **not registered** in
the current export (it lacks `player.buffs.powerInfusions` / `partyBuffs.drums`). To run an end-to-end
Drums/PI sim, enable those in the export first.

**Two model-side goldens now DO use them** (`3:20 lust 0:05 drums` / `... PI`), locked without a fresh
end-to-end sim on purpose: their physics is already **anchored** — Drums is +80 haste *rating*, additive
into the same `(1+rating/1577)` pool the gear-haste trust-anchor certified at h0 (Drums 80 is named there),
and the one genuinely uncertain bit, **PI-not-stacking-with-BL, is verified straight from the wowsims
source** (BL & PI share the `"MultiplyCastSpeed"` ExclusiveCategory, highest-priority wins — SOURCES /
RULES §13), which is a stronger anchor than a ~100-DPS-noise A/B. A plain single-target Drums/PI fight has
**no blind spot** (no ramp/mana/AoE/multi-AP), so the model's cast-count is the arbiter (methodology, top of
this file). Re-run an actual APL sim only if a Drums/PI case ever lands on a blind spot (e.g. an
intermission-exit or AoE phase).

## ★★ Should we sim NAKED / hit-capped / no-crit / no-damage-roll to make the numbers cleaner? (07-25)

A user question worth a standing answer, because four of the five ideas in it are safe-but-not-worth-it,
one is an outright **trap**, and the question surfaces **one real gap** that had not been named.

**The framing that decides all of it: the sim has TWO jobs, and they want opposite things.**
1. **Physics trust anchor** — certify the formulas and constants the effective-AB count is built on
   (~0.4 % absolute agreement with `wowsimcli`). This job needs the sim to be an *independent* model of
   TBC. Every stochastic element stripped out moves it closer to being *our own model*, and a reference
   that has been simplified toward the thing it is checking has stopped being a reference.
2. **Layout duelist** — rank plan A vs plan B. This job only needs *differences*, so variance reduction
   is pure profit here.

So the general rule: **never strip the trust-anchor runs; a reduced-variance config would be legitimate
for duels only, and only after proving it preserves ranking.** Now the specifics.

| idea | bias on RANKING | verdict |
|---|---|---|
| **Sim naked** (trinkets only) | changes the operating point, does **not** remove it | ✗ **No — and it would be less general, not more.** See below. |
| **Force 100 % hit** (kill the irreducible 1 % miss) | **none** — a miss costs a cast and deals 0, so it is a flat `×(1−m)` on *every* layout equally | ✓ safe, ✗ not worth it (see "what it would buy") |
| **Average spell damage, no min-max roll** | **none** — zero-mean noise | ✓ safe, ✗ not worth it |
| **0 % crit** | **⚠ NOT NEUTRAL — this one is a real trap** | ✗ **No.** |
| **Fewer iterations off the back of the above** | — | ✗ the saving is already banked elsewhere |

**★★★ Why 0 % crit is a trap.** Crit *is* a constant multiplier on a single-target fight, which is why
`MECHANICS §4` says it cancels. But it does **not** cancel on an AoE phase: `aoeCritAmp(N, crit)` models
Clearcasting→Arcane Potency, where an N-target AE cast takes N proc rolls and the resulting +30 % crit
lands on the next cast. Its magnitude is **crit-dependent** (+8.6 %/target at 6 targets, crit 38 %, and
it *falls as crit rises*). Zeroing crit therefore changes `M(N)`, which changes the AoE-vs-single-target
weighting — i.e. it changes the ranking in **exactly the regime P7.14 and the surviving deficits live
in.** A "consistency" simplification that silently reweights the contested case is worse than the noise
it removes.

**★ Why naked does not generalize.** Gear is not a contaminant here; it is the *operating point*. It
enters through haste (which sets the cast lattice the windows land on) and spell power (which sets what
an additive +SP buff is worth *relative* to a haste buff). Going naked does not delete that dependence —
it moves it to a low-haste, low-SP point **no real player occupies**, and it is still exactly one point.
Lesson 4 (a duel does not transfer across configs) applies to naked as much as to geared. Generality
comes from **sweeping the axis**, not from picking a different single value on it. Also worth noting
the practical objection the question raised itself: naked is not hit-capped, so it would add variance
while claiming to remove it.

**✅ THE REAL GAP THE QUESTION FOUND: we sweep HASTE but never SP.** The cross-val sweeps haste
exhaustively — that is the entire acceptance campaign. Spell power is held at one value (`REF.sp`, one
gear set). But an **additive** +SP buff (Icon, Skull) is worth relatively *less* the higher base SP is,
while a **multiplicative** haste buff is not — so the SP/haste trade the planner is constantly making is
evaluated at exactly one point on an axis that provably tilts it. Nothing in the record says whether a
plan optimal at `REF.sp` stays optimal at, say, ±300 SP. **Tracked as a new task (SP-axis cross-val);
this is the generalisation instrument the "sim naked" instinct was reaching for, and the correct form of
it.**

**What the variance ideas would actually buy — and why it is less than it looks.** The largest variance
reduction available to a paired comparison is **common random numbers**, and we already have it: every
duel arm runs the same fixed seed, so the *difference* is far better resolved than either absolute DPS.
That is also why the thin-looking noise floor (boss band ±0.1251 pp against 0.2–0.4 pp deficits) is not
worth chasing — it is the *absolute* band, and the comparisons that matter are paired. On top of that,
the wall-clock argument for fewer iterations was **answered losslessly by `DPS_CACHE`** (lesson 5):
~70 % of a re-gather now costs zero sims with *identical* numbers, which is strictly better than the same
saving bought by degrading the physics. **Conclusion: keep the sim honest, keep the seed paired, cache
the repeats.**

## Statistical protocol (read this — the old "seeds 11/19" habit was wrong)

### What the seed actually drives — the RNG-consumer inventory (read before trusting a paired A/B)
The long-standing working belief was "the seed just moves crit and SP-proc rolls." **That is wrong, and
the error matters** — it is why CRN pairing is fragile and why count-changing A/Bs desync. Enumerated
from source (`tbc-new` @ `ade9f39`; every line re-verified before being written here):

- **One shared stream, not per-callsite streams.** `Simulation.RandomFloat(label)` returns
  `sim.rand` — the `label` argument only splits into per-callsite streams **when `sim.isTest`**
  (`sim/core/sim.go:230-246`). In production every consumer draws from a single interleaved SplitMix64
  (`sim/core/rand.go:36-73`). **Consequence: adding or removing ANY RNG consumer reshuffles every
  downstream draw** — that is the mechanism behind the count-preserving rule below, and it is much
  broader than "crit rolls move."
- **Per single-target AB cast the stream is consumed in this order:** ① **base-damage roll** — AB damage
  IS rolled, `CalcAndRollDamageRange(sim, 668, 772)` (`sim/mage/arcane_blast.go:36`); ② **partial
  resist** (`spell_resistances.go:38`) — drawn *even on a miss*; ③ **hit roll**
  (`spell_result.go:260`) — always; ④ **crit roll** (`spell_result.go:273`) — only if it landed;
  ⑤ **Arcane Concentration** (`mage/talents.go:170`) — 0.02×rank per landed hit; ⑥ any proc trigger not
  blocked by an ICD (`aura_helpers.go:128/176/203`). So **five to six draws per cast**, of which crit is
  one.
- **The hit cap does not remove the miss.** `SpellChanceToMiss` floors at `math.Max(0.01, 1-hitChance)`
  (`spell_result.go:257`) — a hard **1% miss floor** no amount of hit rating clears, and the roll is
  consumed every cast regardless.
- **Partial resists are live** against the default level-73 target (`levelBasedResist` = 0.02×3 = 0.06 →
  ~13.7% of casts eat a 25/50/75% partial). AB/AE are neither binary nor resist-ignoring.
- **Fight duration is itself a draw.** `sim.Duration += RandomFloat("sim duration")·2V − V`
  (`sim/core/sim.go:405-409`), default `durationVariation = 5` in the UI (`ui/core/encounter.ts:14,176`)
  — often the single largest variance source in a DPS number. `--var` sets `V`; **our protocol pins it to
  0.5** so the sim answers the model's question (below).
- **No player-side reaction jitter.** The `randomizeReactionTime` branch (`sim/core/gcd.go:90-92`) is
  dead — all six callers pass `false`; the *boss* does get timing jitter (`target.go:249`,
  `attack.go:981`), which perturbs the shared stream. **APL evaluation consumes zero RNG** (no draws in
  `apl*.go` / `cast.go` / `spell_queueing.go`) — a scheduled press never "rolls" to fire.
- **AoE:** Arcane Explosion rolls its base damage **once per cast** (377–407) and reuses it for all
  targets (`arcane_explosion.go:32`, `CalcAndDealAoeDamage`); only hit/crit/resist are per-target.
  Arcane Missiles is flat 265/tick, no damage roll.
- **Seeding is a full reset, per iteration.** `reseedRands(i)` sets `rseed = RandomSeed + i` and
  re-seeds SplitMix state outright (`sim.go:248-251`, `rand.go:58-61`) — iteration *i* is entirely
  determined by its seed and nothing carries across iterations. ⚠ With `RandomSeed == 0` iteration 0
  falls back to `time.Now().UnixNano()` → **never run with seed 0**.
- **Concurrency is safe by construction:** `sim_concurrent.go:39-47` offsets each split's starting seed
  so the *multiset* of per-iteration seeds is thread-count independent. (Float summation order can still
  differ; the upstream determinism test is disabled — `_sim_concurrent_test.go` — so exact cross-thread
  float equality is unverified. Treat last-digit disagreement across `-j` as expected, not a bug.)

**So: the seed drives base damage, partial resist, the floored 1% miss, crit, Clearcasting, proc rolls,
boss timing AND the fight length — all interleaved on one stream.** Two consequences we already rely on:
CRN pairing is *powerful* (it cancels all of that at once) and *brittle* (any press-count change desyncs
all of it, not just the crit sequence).

- **Determinism / CRN:** per-iteration RNG seed = `baseSeed + iterationIndex` (`sim_concurrent.go`;
  concurrency is split so it never affects results). Same seed+plan ⇒ byte-identical. For an **A/B
  comparison use the SAME seed** — A and B then share the per-iteration RNG and the paired diff cancels
  *the whole inventory above* (damage roll, resist, miss, crit, procs, and the drawn fight length), not
  just crit noise — which is why a real +0.6 DPS is resolvable under ~100-DPS per-run stdev.
- **Nearby seeds are NOT independent replicates.** Because seeds are contiguous, `--seed 11` and
  `--seed 19` at 150k iters share ~all iterations (they differ by 8 of 150000). Verified: seed 11 ==
  seed 19 to the decimal incl. max; far seeds (100000, 10⁶) give genuinely different draws. **For an
  independent replicate, separate base seeds by ≥ iterCount** (e.g., 11 and 10_000_000), or just report
  single-run **SEM = stdev/√iter** (≈0.3 DPS at 150k).
- **★★★ AND THE COST OF GETTING THAT WRONG IS NOW MEASURED: a contiguous-seed band is EXACTLY ZERO, which
  PASSES EVERY DELTA (07-25, P7.13-S3).** The rule above was stated from the mechanism; `tools/cell-band.mjs`
  put a number on it at a real cross-val cell (KT/T=420/@195, iter 6000, two plans 10 s apart). Seeds
  **12,13,14,15 reproduced seed 11 to the printed decimal on both plans** ⇒ `sd = 0.0000 pp`, band
  `±0.0000`; the same cell with far seeds (`11,100011,200011,300011,400011`) gave `sd = 0.0058 pp`. Ratio:
  ∞. **`tools/plan-duel.mjs` defaulted to `11,12,13,14,15` and tests `|mean| > band`, so it declared every
  nonzero delta significant** — a false-PASS in the one instrument whose whole job is arbitration. Fixed:
  defaults are spaced by 10⁵ and a **hard guard dies if `min seed gap < iter`**. Audited: no committed
  verdict rests on the old band (every `plan-duel` control in the docs is sim-free). Two standing lessons:
  (1) when a band comes out at or near zero, **suspect the design before believing the result** — a zero
  band is not precision, it is a broken replicate; (2) put the guard **in the tool**, not in the doc — this
  bullet had said the right thing for weeks while the code shipped the wrong default.
- **★★ Seed noise is NOT the dominant noise on a boss cell — wall-jitter variant noise is, by 12×.** Same
  cell: sd across independent seeds **0.0058 pp**, sd across wall-jitter geometries **0.1427 pp** (33
  variants) ⇒ SEM(N=5) ±0.0638, 95 % **±0.1251**. A cross-val boss cell is a *5-variant mean*, so its error
  bar comes from the variant draw, not the seed, and adding seeds buys almost nothing. **Grade a boss cell
  against the variant band; grade a class cell (1 variant) against the ripple floor.** Details and the
  bimodal one-cast structure of that spread: `tools/cell-band.mjs` in Pieces, PHASE7 §5.17, RULES §8.
- **Count-preserving vs count-changing (the key rule).** A comparison that keeps the **same set of
  presses** (e.g., shift a cluster 240→245) keeps A and B on the SAME RNG stream → clean CRN pairing →
  sub-DPS effects resolve. A comparison that **adds/removes a press** shifts the PRNG stream from that
  point on → A and B desync → the paired diff reverts to full noise, so nearby seeds "agree" on a
  desynced sample and mislead. Measure count-changing questions (e.g. 3-vs-4 icons) with
  **far-separated-seed replicates + large N**, never a single nearby-seed pair.
- **`--var 0` vs `--var 10` vs `--var 0.5` — and "MODEL-MATCHED" is RETIRED as the reason (Phase 7 →
  07-27).** `--var V` draws the
  kill uniformly in [T−V, T+V]; intermissions stay fixed. ⛔ This bullet used to justify `--var 0.5` by
  *"the scorer's `robust` objective is a `KILL_WINDOW = 0.5s` linear taper over [T−0.5, T+0.5], the
  **same window width** the sim draws at `--var 0.5` — so var 0.5 is the closest question the sim can
  be asked."* **The taper is gone** (PHASE12 §9, user ruling): the model is deterministic at `T` and
  credits a straddling cast `min(1, (T − start)/duration)`, a **one-sided** window of the cast's own
  duration. So there is no width to match, and `--var 0.5` now rests **entirely** on
  `tools/var-decision.mjs` (BENCH §3) — which is the stronger footing, since that evidence never
  depended on the model. It remains the cross-val/acceptance metric.
  ⚠ **What this OPENS:** the model smooths the boundary analytically, the sim numerically, and no
  residual between the two has been derived (PHASE12 §9.4). var0 is the razor-edge whole-cast-parity trap (measured: the
  §16 h150 ramp-hug pair flips −0.08% → +0.37% from var0 to var0.5 — the var0 read was a stranded whole
  cast, the var0.5 read matches the model's +0.25 casts to 0.01%). var10 asks a *different* question —
  ±10s kill hedging the model deliberately does not price (RULES §8) — and adds a late-window premium
  (measured on 15 cross-val columns: var10 deltas shrink 2–4× at var0.5). Use var0 only for
  count-preserving CRN A/Bs where its low noise helps, and confirm at var0.5; gate model preferences at
  var0.5. No kill-variance setting clears an **intermission-wall** effect (walls stay fixed) — that
  needs wall-jitter, below.
- **★★★ "MODEL-MATCHED" MATCHES THE WIDTH, NOT THE KIND — var 0.5 has a RESIDUAL, and it is derivable
  (07-25).** ⛔ **HISTORICAL as of 07-27 — the numbers below price the RETIRED scorer.** Both premises
  are gone: the model no longer integrates a continuum limit (§6.10) and there is no `KILL_WINDOW`
  (§9). `1 − W/c` prices nothing about HEAD; **no replacement floor has been derived**, and the general
  lesson at the bottom of this bullet is exactly the warning against assuming one transfers.
  The bullet above used to say var 0.5 asks *exactly* the model's question. That word is
  **withdrawn.** The sim sums over its **integer cast lattice**, `f(T) = Σ_i clamp((T + KW − tc_i)/W, 0,
  1)` with `W = 2·KW = 1.0s`; the model integrated that sum's **continuum limit**, `g(T) = ((T − KW) +
  W/2)/c`. The difference is a sawtooth in the tail phase with **peak-to-peak = `1 − W/c` casts** —
  verified numerically to 4 decimals by `tools/lattice-ripple.mjs ripple`: `c=1.000 → 0.0000` (exactly
  zero at the GCD floor, the built-in sanity check: at `c = W` the taper smears the lattice perfectly) ·
  `1.023 → 0.0225` · `1.219 → 0.1796` · `1.463 → 0.3164` · `1.600 → 0.3750`. Consequences for how you
  read a sim number:
  - **The razor-edge parity trap is NOT confined to var0.** It shrinks by `1 − W/c` but survives at
    var 0.5 whenever the **tail cast period exceeds the 1.0s taper** — i.e. at every haste below the
    floor. Demonstrated at `c = 1.463 s`: 0.316 casts of two-signed slack, enough to flip the sign of a
    0.006% model gap (`tools/lattice-ripple.mjs cell` → continuous −0.0062%, discrete +0.6046%, wowsims
    +0.3617%). A var0.5 read is a *gate*, not an oracle, on short low-haste fights.
  - **It is fixed casts, so it scales as 1/N** — negligible on a 420s fight, material on a 99s one. Any
    residual disagreement whose signature is "short **and** low-haste" should be priced against
    `1 − W/c` **before** it is called a model defect. This is the **tail** face of the same
    integer-vs-continuum law whose **interior-boundary** face is PHASE8's FLOOR LAW.
  - ⚠ **The fix is NOT to discretize the scorer.** Summing the sim's own formula over the model's own
    cast lattice does pick the sim's argmax on the cell that motivated it, but across all 11 rows of
    that column it is a **worse** predictor of the sim on both metrics (r 0.7910 vs 0.9337, RMSE 0.2948
    vs 0.2431 pp) — see RULES §8 and `index.html:875-877`. Run
    `node tools/lattice-ripple.mjs` (default `all`) and read **section 3** before believing section 2.
  - **Lesson (DIARY):** matching an objective's *width* is not matching the objective. When two scorers
    are declared equivalent, **derive the residual**; don't check that the parameters agree.
- **Wall-jitter (boss tables — `xval.mjs` `WJITTER`, default 2) — INDEPENDENT per-wall shifts, and why.**
  Within a wall-bounded segment the cast train is phase-locked to the exit (the re-ramp), so a plan
  realizes haste value only in **whole casts** before the next wall — a deterministic per-segment
  cast-parity worth up to ~±½ cast per segment that NO kill-variance can smooth. Dug to ground on the
  Vashj 0.64% pair (minimal 2-wall reproduction, per-interval log verification): the sim's cadence
  matches the model's floored/unfloored intervals EXACTLY; only the whole-cast truncation at walls
  differs (stacked window: model +1.65 casts, sim +1.04; split: model +1.48, sim +1.54). The model's
  continuous fractional credit is the CORRECT expectation for real fights, whose transition times vary
  run to run — ★ **and since 07-27 that credit is EXPLICIT rather than incidental**: a wall is a **cut**,
  so the cast straddling it earns `min(1, (wall − start)/duration)` (PHASE12 §9). Under the old scorer a
  cast completing *inside* an intermission was paid in **full**, so this bullet's reasoning was right
  about the goal and wrong about HEAD. The user's ruling rests on the same argument stated here — a wall
  does not land on the same second every pull —
  so the measurement must still vary **segment lengths**: each wall gets its own seeded shift
  δ_i ∈ [−WJ,+WJ], presses shift with the wall that starts their segment, seam-coincident window edges
  move together (KT downtime→AoE). ★ A RIGID translation (one δ for walls+presses — the first design)
  preserves every segment's internal parity and washes NOTHING — do not regress to it.
- **var10 penalizes LATE windows near the end — decide which question you're asking.** A buff window
  inside the last `var` seconds gets clipped on short draws, so var10's A/B adds a real "late-slot
  kill-variance premium" on top of the fixed-kill effect (measured: Zerk-in-Lust vs after = +0.6% at
  T=60 var10 but exactly the model's +0.3% at T=80 var10 where nothing clips — RULES §7). ⛔ This used
  to end *"the model prices only a half-cast of kill variance BY DESIGN"*. **The half-cast window is
  retired** (PHASE12 §9); the model prices **no** plan-wide kill variance at all — its only boundary
  hedge is the one-sided credit on the straddling cast, which is narrower still. The practical advice
  is therefore *more* binding, not less: when gating a model preference,
  either use a fight long enough that no compared window sits in the variance zone, or expect the sim
  to exceed the model by the clip premium.

### Can a sim number be trusted? — the per-question ledger
"Is the sim trustworthy" has no single answer; it depends on which question you asked it. Current state
(all four rows below were **not** true earlier in the project — each was fixed, and the fix is named):

| question you ask the sim | trustworthy? | why / what fixed it |
|---|---|---|
| **absolute DPS of one plan** | ✅ ~0.4% abs vs `wowsimcli` | the trust-anchor procedure ("Trust anchor", above) — re-certify per fresh session |
| **A vs B, same press count** | ✅ sub-DPS resolvable | CRN pairing cancels the whole RNG inventory; use one seed, `--var 0.5`. ⚠ *statistically* resolvable ≠ *structurally* comparable: the sim's terminal cast lattice is still two-signed slack a short low-haste fight can hide a sub-0.1% gap in. ⛔ The old size for that slack — `1 − W/c` casts, 0.32 at c=1.463 — priced the **retired** scorer (PHASE12 §9) and **no replacement has been derived**, so treat the caution as qualitative until one is |
| **A vs B, different press count** | ⚠️ noise-limited | the streams desync (shared-stream rule) — needs far-separated seeds + large N, never a nearby-seed pair |
| **an intermission / wall-bounded plan** | ✅ *since* the `APLActionSchedule` fix | the schedule silently DROPPED on-cooldown presses (next section) — every pre-patch intermission number was garbage. Requires the patched runner (`RUNNER PROVENANCE`) **and** wall-jitter v2, because fixed walls phase-lock cast parity |
| **an AoE phase** | ✅ *since* Phase 5 | `--targets N` + `_aoe` emission in `genapl` (AE was previously simmed as downtime). AE constants verified exact vs `arcane_explosion.go`; KT's 2.68% AoE artifact went to 0.39% (ordinary) once AoE was actually valued |

**Iteration count is NOT the lever people reach for.** 10–60k is plenty (SEM ≈ 0.3 DPS at 150k); the mean
is converged to ~0.02% by 10k. The campaign uses `ITER=6000` per cell *because* the residual disagreements
we chase are **deterministic structure, not sampling noise** — cast-boundary parity, wall phase, kill
quantization. Those do not shrink with N at any rate; they are addressed by **metric design** (var0.5,
wall-jitter v2) or by accepting them as measurement structure. **If a disagreement survives 10k, adding a
zero to the iterations is wasted CPU — audit the setup instead** (the four cautionary tales: the Vashj
drop bug, the stale unpatched runner, the AP-195 quirk, the prepull cast-loss).

## ★ KNOWN HARNESS BUG — `APLActionSchedule` silently DROPS an on-cooldown press

**This is the audit's headline finding. It distorted intermission theorycraft; now FIXED (patch below).**
The AB-gate/resume *ramp* is faithful (AB gates off during downtime, the gap scores zero, cooldowns
tick through, casting resumes with a correct fresh-stack 2.5s cast). The bug is in how `genapl` fires
the cooldowns: `APLActionSchedule` (`sim/core/apl_actions_timing.go`) advances its timing index the
moment `innerAction.IsReady` returns true — and `castSpell.IsReady` returns true ~0.15s *early* (a
cast-queue tolerance). So when a scheduled press lands while its own cooldown is still up, the schedule
"fires" (queues the cast + consumes the timing) but the queued off-GCD cast is then lost behind the
in-progress hardcast → **the use vanishes entirely**, not just slips late.

This bites whenever same-track presses are ~exactly a cooldown apart and one drifts (quantization runs
each press's cd from its *late* fire-time, so drift accumulates). **Worked example (Vashj icon,
cd 120, scheduled 0/120/240/360):** icon@240 quantizes to 242.5 (the 2.5s ramp cast at the [3:30–4:00]
exit) → cd ready 362.5 → the **terminal icon@360 is DROPPED** (combat log: `Queueing up {29370} to cast
at 362.505`, then no icon aura ever appears). So the golden's "4-icon" plan was really firing **3**
icons, missing the high-value 6:00-burst one — which is exactly why "drop the exit icon" measured
**+4.8** (stable across independent far seeds: not noise, a deterministic dropped-use). **It is NOT
Vashj-specific:** the same run also drops AP@360, and several IV/Zerk uses — the schedule harness has
been **systematically under-executing back-to-back cooldowns**, so any sim-gating that involved a
press landing on its own cd may be distorted (flag every intermission golden for re-check once fixed).

**THE FIX (LANDED) — `tools/wowsims-patches/apl-schedule-strict-ready.patch`.** Root cause:
`APLActionCastSpell.IsReady` uses `spell.CanCastOrQueue` (queue-tolerant → true ~0.15s early). Patch:
`APLActionSchedule` now remembers its inner castSpell's `spell` and adds `(innerSpell == nil ||
innerSpell.IsReady(sim))` — STRICT `BothTimersReady`, no queue tolerance — to its `IsReady`. A press
that collides with its own (drifted) cooldown now WAITS and fires when the cd truly clears, never
dropping and never consuming the timing early. `genapl` is unchanged (still `schedule`); rebuild the
runner from the patched source (`go build -tags with_db`). Buffs apply strictly **between casts**
(snapshot at completion — the 242.50 cast used pre-icon SP 1386, the next 1541), and the patch keeps
that (it only gates *when* a press fires, not what it hits).

**Re-validated (all 16 goldens, fixed vs orig engine, var0 100k):** ZERO regressions. Plain goldens
+0.0..+0.8 (fix inert, or recovers one collided press). Intermission goldens were badly drop-distorted →
big faithful recoveries: **4:00-multi +18.0, KaelThas +22.2, Vashj +25.8**. So the old schedule harness
was systematically under-executing every intermission plan. Goldens' PLANS are unchanged (exact-match
16/16) but their sim *baselines* jumped, so **any intermission conclusion previously sim-gated on the
buggy harness should be re-checked** on the fixed rig. On the fixed engine the Vashj **4-icon plan is
vindicated** (1594.3 > 3-icon 1587.2, +7.1 var0 / +6.9 var10) — the "3-icons-win" was 100% the dropped
terminal. The 4:05/6:05 shift survives but small (**+0.8 var0 / +0.3 var10**, stable across far seeds).

**AP's cooldown is 180s — and the harness is now PATCHED to match (`tools/wowsims-patches/ap-cd-at-cast.patch`).**
Upstream `sim/mage/arcane_power.go` re-set AP's 180s cd in the aura's `OnExpire` (`CD.Use` at buff-END),
making the sim's cadence 15+180 = **195s**. **The user (domain authority) confirmed real TBC AP is a
standard 3-min cooldown starting on activation — 180s** — the model was always right
(`BUFFS.arcanePower.cd = 180`). The patch deletes the `OnExpire` re-set (core already consumes the cd at
cast via `triggerCooldown`), so the patched runner fires AP on the true 180s cadence — verified
(`AP@[0,180]` both fire). **This closed the "multi-AP timing" blind spot**: the sim is now a valid referee
for AP cadence. Cautionary tale: before the patch, a layout whose 2nd AP sat exactly 180s after the 1st
was silently penalized ~1% in gates (the press dropped/slid) — it manufactured a fake "refutation" of a
correct model preference (the haste-first opener) until the contamination was found.

## ★ SHARED TRINKET LOCKOUT — the sim silently RETIMES an illegal schedule, it never rejects it

**Same family as the bug above, and it invalidated a whole phase's headline decomposition.** Every
on-use *offensive* trinket (Icon, MQG, Skull — `OFF_TRINKETS` in `index.html:618`) shares wowsims'
spell-category-1141 timer via `GetOffensiveTrinketCD()`, and the lockout's length is **the trinket's own
buff duration**: `sim/common/shared/shared_utils.go` → `SharedCD: {Timer: sharedTimer, Duration:
config.Duration}` = **20s** for all three. So two on-use trinkets pressed <20s apart is an *illegal*
schedule.

**The trap: the sim does not error.** It queues the second press until the shared timer clears and fires
it at the next cast boundary, then prints a perfectly plausible DPS number **for a plan you never tested**.
Verified with `SIMLOG=1` on the exact spec `{"Icon":[4,182],"MQG":[9],…}`:

```
[ 5.18] Casting {ItemID: 29370}   <- Icon, requested @4  (+1.18s press lag)
[25.18] Aura faded: {ItemID: 29370}
[25.64] Casting {ItemID: 19339}   <- MQG, requested @9, ACTUALLY FIRED @25.64
```

Cautionary tale: PHASE8's canonical decomposition ("moving ONLY MQG@202→@9 captures the whole deficit,
sim +0.461%") actually measured **MQG@25.64**, and the "emergent joint interaction" theory built on it
had to be withdrawn (PHASE8 §1; DIARY). **Before trusting any hand-built trinket delta, log-verify the
fire times** — `SIMLOG=1 … 2>&1 >/dev/null | grep -E "Casting \{ItemID: (19339|29370|32483)\}"` — and
check every on-use pair is ≥20s apart. The optimizer's `repair()` enforces this, so plans that come out
of the tool are legal; **hand-written probe specs are the exposure.**

Press lag is real but modest and boundary-driven: a press fires at the next cast boundary, so it lands
~0.05–0.1s late inside a fast hasted window and up to ~1.2s late during the cold opener ramp (2.5s casts).

### ★★ Verifying a hand-built spec — the order matters, and drift magnitude is NOT a legality test

The natural check ("did anything fire far from where I asked?") **is not sufficient**, and PHASE8 §16.5
proved it on live data. Of the four illegal plans that round, two were retimed by only **2.13 s and 2.00 s**
— *less than one unbuffed cast interval at gear haste 70* (`2.5 / 1.0444 = 2.394 s`). A drift threshold
loose enough to accept honest press lag is automatically loose enough to accept a lockout retime.

**Run the checks in this order:**

1. **A-priori structural legality, before any sim run.** Every on-use trinket pair ≥ 20 s apart; no two
   presses of the same cooldown closer than its cooldown. A spec that fails here is *discarded*, never
   measured and never interpreted.
2. **Combat-log fire times, to confirm step 1 — not to replace it.**
3. **★ The cascade gate, for differential probes.** When a probe claims "only X moved", check the fire
   times of the **controls** too. A press moving perturbs every downstream boundary-snapped press: in
   PHASE8 §17.5 a pure trinket move slid the third Icy Veins by **1.00 s** in one rest-context (and only
   0.10 s in the other). *"Hold the rest fixed" is a property of the request, not of the execution.*
   Require controls to move < 0.30 s between the two arms, or report the contrast as contaminated.

**★ The cooldown chain — two presses exactly one cooldown apart cannot execute.** Press lag compounds
forward: request `AP@[8, 188]` (exactly 180 s apart) and the first press boundary-snaps to **9.06**, so AP
is not ready until 189.06 and the second fires at the next boundary, **189.51**. This is deterministic, not
noise, and it is why "an exact-cooldown-apart pair" is a structurally different plan in the sim than in the
model. Leave ≥ 2 s of slack in a hand-built spec, or expect the second press late by one boundary.

**Log-format facts (all verified, all easy to get wrong):**
- Player lines carry a source prefix: `[  5.18] [Player (#1)] Casting {SpellID: 12042} (Cost = …)`. A grep
  without the prefix also matches pet/raid lines.
- **Bloodlust has no `Casting` line at all** — it is applied *to* the player, so it appears only as
  `Aura gained: {SpellID: 2825, Tag: -1}`. **Cold Snap has no aura** — only a `Casting` line. A press
  verifier must union both event kinds and dedupe (the two events of one press land < 0.05 s apart).
- Match **exact** id strings (`SpellID: 12472`, not `12472`) *and* guard the trailing digit (`2825` is a
  prefix of `28250`), or the match silently lands in the `t=0` raid-buff block. Matching the **whole
  brace group** including the closing `}` makes that guard automatic.
- On-use **trinkets log by ItemID**, not by the spell they grant: `Casting {ItemID: 29370}`.
- ⚠ An equipped trinket can also emit `Aura gained: {ItemID: …}` at **t = 0** — that is the *equip*, not
  a press. (Serpent-Coil does; Icon does not.) So auras must only be consulted for an ActionID that
  produced **no** cast events at all, or a fully-dropped trinket press reads as "fired at 0.00".

**★ The reference implementation is `tools/press-verify.mjs`** (committed 07-27). ⚠ It previously lived
only at `$SP/p8/r6verify.mjs` — a session-scratchpad path that no longer exists — with the facts above
as its only surviving documentation; the tool was rebuilt from them (PHASE12 §3.6).

```
node tools/press-verify.mjs --spec '{"IV":[8,39],"AP":[8],"BL":[7],"Icon":[8]}' --log /tmp/pv.log
RUNNER=…/runner-ap180 node tools/press-verify.mjs --spec '{…}' --run --dur 60 --haste 0   # runs it too
```

Per intended press it prints **sched · fired · expected · off · via**, and exits `1` if any press never
fired **or fired on the wrong cast** (see the `--cast` block below).
It does **not retype a single spell id**: each key's ActionID is read back out of `tools/genapl-core.mjs`
by building a one-key APL, so the two can never drift. Controlled in both directions before being
believed — a healthy 8-press plan → exit 0 with every press matched; **two negatives that reproduce the
real failures**: a second `IV` inside its 180 s cooldown → `DROPPED` (the `APLActionSchedule` drop bug ★)
and an `MQG` press on a character wearing isc+scb → `DROPPED` (the unworn-trinket no-op, PHASE12 §2.1);
plus the fact-4 case (a Gem press past the fight end reads `DROPPED` + `UNCLAIMED`, *not* a 0.00 fire),
a synthetic log carrying only `SpellID: 124720` and a *pet* `12472` (both refused), and **twelve**
setup negatives — no spec, bad JSON, unknown key, no presses, missing/empty/NUL log, `--run` without
`RUNNER`, mutually exclusive flags — each required to exit **2**. ★ **An empty log exits 2, never
"all presses fired"**: the project has shipped that exact false pass three times (`xval-collect`,
`xval-verify`, the wrapper banners).

**★ RUNNER PROVENANCE — one true binary.** The canonical runner is built from the scratchpad `wowsims`
clone (`ade9f39` + `apl-schedule-strict-ready.patch` + `ap-cd-at-cast.patch`):
`go build -tags with_db -o runner-ap180 ./cmd/runner`. A stale pre-patch binary once sat at the
scratchpad root and **poisoned a whole day of gates** (every drop-bug distortion re-introduced). Before
ANY gating session: rebuild or verify the binary is the patched one (check
`grep -c innerSpell sim/core/apl_actions_timing.go` = 3 and no `CD.Use` in `arcane_power.go`).

### ★★★ AND SINCE 07-27 IT GRADES *WHEN*, NOT JUST *WHETHER* — `--fire` / `--cast`

PHASE12 §6.7: *"no gate in this repo covers press-fire timing — which is exactly why it survived this
long."* What survived was `sim/planspec.mjs` emitting `Math.floor(actEff)`, which put **7.14 % of
presses on a cast the model never chose** (`tools/press-headtohead.mjs`, real logs). It is 0.00 % now,
and this is the gate that keeps it there:

```
node tools/press-verify.mjs --spec '{…}' --fire '{…}' --cast '{…}' --run --dur 300 --haste 0
node tests/press-fire.mjs                       # part A only — no sim, no browser
RUNNER=…/runner-ap180 node tests/press-fire.mjs # + part B, graded on real logs
```

`planToSpec` returns `fire` (expected fire times) and `cast` (the cast index each press must buff)
beside the spec; pass them straight through.

**★ GRADE ON THE CAST, NOT ON THE CLOCK.** The model's cast grid and wowsims' are **not the same
grid** — wowsims takes **334 ms** per Arcane Blast stack (`sim/mage/arcane_charge.go:17`) where the
model takes 1/3 s, and rounds every cast to the millisecond. A bare stream drifts 0.080 s over 300 s
(`tools/lattice-drift.mjs`); a plan with haste buffs in it reaches **~0.35 s by t=200**. So a press can
land on exactly the right cast with its wall-clock time a third of a second off, and a clock-tolerance
verdict calls that a failure and sends you hunting a bug that is not there. `--cast` reads the sim's
OWN cast stream out of the log and is drift-proof; `--fire`'s `off` column becomes a *measurement of
the lattice*, which is worth reading on its own.

⚠ **The log lies to two decimal places.** The boundary it prints as `11.00` is `10.998`. That 2 ms is
the whole of the "a scheduled press fires a full cast late" mystery: `APLActionSchedule.IsReady` is
`>=` (not strict), and `10.998 >= 11.000` is false. Anyone reading a boundary off the log and
scheduling that number will be bitten. Instruments: `tools/press-ns-probe.mjs` (falsifies the
nanosecond theory), `tools/press-threshold-probe.mjs` (bisects the real threshold: `B − 0.002`),
`tools/lattice-drift.mjs` (the drift vs haste and fight length), `tools/press-exposure.mjs` (the
corpus exposure, no sim).

**Two failure classes press-verify reports but does NOT count against you**, because no transcription
can reach them — both are the 334 ms mismatch:
- **HELD** — the schedule value sat inside the right interval and the sim declined anyway
  (`IsReady` also gates on `innerSpell.IsReady`: a cooldown coming up a hair after the sim's boundary).
- **LATTICE** — the two grids are more than half an interval apart there, which is the entire budget a
  value derived from the model's grid can have.

**Scheduled presses fire at APL decision points — during a ramp that is the NEXT SLOW-CAST BOUNDARY.**
Sim-log-verified: with a cold opener, presses scheduled at 5 land at **6.5** (the 0→3 ramp's cast
boundaries are 2.5/4.667/6.5 — sparse and locked to the pull, no phase freedom). The model now matches
this exactly (the press-snap rule, RULES §3). Related artifact: **externals (Bloodlust/PI/Drums) routed
through the mage's APL also land at the boundary** — but in the real game the *shaman* presses at the
call time, so the model keeps externals at intent time. When an opener gate disagrees with the model by
~0.1-0.3%, check whether the sim's late-landing BL (its Lust window sliding ~1.5s later into the fight)
accounts for it before blaming the model.

## Traps that remain

- **Cold-Snap IV** — model it as "once per fight, one IV ignores its cooldown." Schedule `CS` slightly
  before the cheated IV (the runner resets IV mid-schedule); since there's no second reset, the CS→IV
  must be the IV that breaks the 180s cd. Otherwise ignore the fine timing — it's one bonus IV.
- **Fixed-length boundary artifacts.** At an exact fight length, whose cast train ends flush at the
  buzzer swings ±1 cast. Re-check any suspiciously large fixed-length gap under `--var 10`.
- **AoE — the runner CAN value it now (`--targets N`).** See the AoE section below. A full-fight sim
  still can't switch target-count mid-fight (encounters are fixed-N), so an AoE *phase* is valued in
  **isolation** (short fight, N targets, AE-spam); a full boss sim treats an AoE window as 1-target AB
  (a common factor that cancels when the varied presses are outside the AoE window — how the KT re-gate
  stayed valid).

## Evaluating AoE phases (`--targets N` + AE-spam)

Two additions let the runner value an Arcane-Explosion AoE phase (the model's `type:"aoe"` segment):
- **`runner --targets N`** duplicates `encounter.targets[0]` to N mobs (config protos are read-only, so
  the pointer is shared; each becomes its own Unit). `0` = keep the export's count.
- **`tools/genae.mjs`** (repo, durable) builds an **Arcane Explosion (27082) spam** APL, same cooldown-
  schedule interface as `genapl.mjs` (now incl. `CS`). `_abAfter: T` switches AE → plain AB at `T`
  (the AoE-phase EXIT: AE never applies the AB debuff, so the handoff re-ramps — the Phase 5 exit-ramp
  gate). Run a short isolation fight (e.g. `--dur 40 --targets 6`).

**Validated, model vs sim:** the model's AE constants are **exact** — base roll 377–407 (avg 392),
`BonusCoefficient` 0.214, instant + GCD-bound, `DamageMultiplier 1`, full per-target damage
(`arcane_explosion.go`, spell 27082). Sim spot-checks: AP over AoE = **×1.30** (measured +30% on the AE
stream), IV over AoE ≈ ×1.18–1.20 (haste, unfloored; var10 marginal +5.66% vs model +5.71% on a 20s/70s
window). Phase 5 re-anchored the **per-cast ratio** at N=2/6/10 (AE-spam vs prestacked AB-spam, same
seed): sim **0.709 / 2.255 / 3.873** vs model M(N) 0.819 / 2.579 / 4.434 — a **constant ×~0.87**, fully
decomposed below (Tirisfal 2pc ×1.2 on the AB side, ÷1.2 → residual +2–4% = the conservatively-credited
amp + export-vs-input SP/crit calibration). The old "≈2.25×" quote is the same number with the T5 factor
baked in. KT's **double-IV-over-AoE** re-gated directly: 2nd IV over the 6t window's back half = +10.0%
of the 40s window, both far seeds (model +9.09%).

**★ Tirisfal-2pc + Arcane-Power additivity (Phase 5 sim-audit finding — the sim was right, our
CONSTANTS were incomplete).** The reference export wears **T5 Tirisfal 2pc = +20% Arcane Blast damage**
(`sim/mage/items.go`, set 649) — combat-log per-hit AB/AE ratio 2.99 vs 2.52 expected without it (and
solving the per-hit data gives SP≈1414 ≈ the 1387 input; without T5 you'd need an absurd SP≈6050). AND
it pools **additively** with Arcane Power — both are `SpellMod_DamageDone_Flat` (`arcane_power.go`,
`spell_mod.go`): AB under AP+T5 = ×(1+0.2+0.3) = 1.5, not 1.2×1.3. Measured with count-preserving CRN
pairs: AP marginal = **+25% relative on the T5'd AB stream** (141.7 DPS vs 141.2 predicted-additive,
161+ predicted-multiplicative) but the full **+30% on the AE stream** (369 vs 378 predicted — AE has no
T5 mod). Consequences: on T5 gear the AoE placement thresholds shift ×1.2 (RULES §9 caveat — no class
flips, KT robust), and sim gates on THIS export under-credit AP marginals vs the model by ~1/6 (bake
that into expectations before calling a gap a bug). Whether real 2.4.3 stacks these multiplicatively is
an **open user-authority question** (ROADMAP) — like AP-195, don't assume the sim's pooling is the game.

**⚠ The xval harness does not set `cfg.t5two` (found 07-24, fix at the START of the next round).**
`tools/xval.mjs:111` and `tools/xval-model.mjs:53` build the model cfg without it, while the reference
export wears T5 (items **30206/30196/30207** = Cowl/Robes/Leggings of Tirisfal). So the whole Phase 6/7/8
campaign has scored a **no-T5 model against a T5-wearing sim**: AP's premium read as ×1.30 where the sim
gives ×1.25, and the AB stream under-weighted ×1.2 relative to AE. **The engine is CORRECT** — `index.html`
applies `t5add` to the AB damage sites (831, 899) and correctly *not* to the AE sites (829, 898); this is
purely a harness omission. **Measured impact is small on AB-only fights** (every plan presses AP the same
number of times, so it is nearly rank-preserving): the B2 target's delta moves −0.02% → −0.04%, an order
of magnitude under the 0.3% deficit threshold, so gathered rounds stay meaningful. Do **not** flip it
mid-round (it changes what a half-gathered acceptance run measures); add `t5two: true` to both cfg
builders between rounds and re-baseline. Expect the largest effect on **AoE columns** (KT), where the
AB-vs-AE ratio moves a full ×1.2 — the ×1.2 threshold shift already noted above.

**⚠ The export's EFFECTIVE spell power is ≈1450, not the 1387 the harness passes the model** (found 07-24,
same fix window as `t5two`). The export also wears **Tirisfal 4pc** — `SpellID: 37444`, **+70 SpellDamage on
crit** — and the combat log states it outright: every AB `[DEBUG]` line reads either `SP: 1386.2` (proc down)
or `SP: 1456.2` (proc up), an exact +70. Measured **uptime 88–94%**, and — checked explicitly — **flat in
haste** (more casts ⇒ more crits does *not* raise it; the hypothesis that it would was tested and
disproved). So `effSP ≈ 1386 + 0.9·70 ≈ 1449`. Effect on model-vs-sim: an SP-window marginal is worth ~2.4%
less on a 1450 base than a 1387 base — a **flat** shrink, not haste-dependent. Combined with the floor law
(★ above) this takes the mean model-vs-sim bias on a clean single-buff marginal from **+0.0895 pp to
+0.0084 pp** (PHASE8 §7): once the harness is described correctly, the model's SP valuation is unbiased.
Set `sp: 1450` alongside `t5two: true` in both cfg builders, between rounds.

**AE fixed-length quantization (a var0 trap, worse than on AB streams).** A uniform instant stream fits
a WHOLE number of GCDs into a fixed fight: at `--dur 60` var0, Zerk-in-IV vs Zerk-outside on the 6t
window tie **byte-identically** (both +1 cast; the continuous +0.14-cast stack premium never
materializes a 45th cast), and the IV marginal reads +2 casts where the integral says +2.67. Re-run
haste A/Bs on AE streams under **var10** (or a longer non-resonant dur): there IV = +5.66% and the §7
stack premium +0.24% emerge at 28σ. Damage/SP A/Bs are immune (same cast stream both sides).

**Super-linearity — measured, isolated, and now modeled.** 6-target AE is **+8.6% per-target** above
linear at crit 38% (×1.024 @2t, ×1.086 @6t, ×1.119 @10t; and it **falls as crit rises** — +11% @10% crit,
+7.7% @55%, once the artificial `--crit -1500` floor point is excluded). **Talent-isolation nails the
cause:** zero Arcane Concentration/Potency in the export and the super-linearity **vanishes** (`--crit`
sweep + a talent-zeroed export: NOTAL amp6 ≈ 1.00), so it is **entirely Clearcasting → Arcane Potency** —
gear on-crit SP procs (Tirisfal 4pc etc.) add ~0. Mechanism: Arcane Concentration procs **per hit**
(`talents.go`), 3/3 Potency = **+30% crit** (combat-log-confirmed) on the next cast, so more targets ⇒
more Clearcasting ⇒ more Potency-boosted casts. Because it depends only on **crit × N × fixed talents**
(no gear), the planner models it — `aoeCritAmp(N,crit)` (`index.html` `TALENTS`), crediting **~75–80%** of
the measured effect (conservative; right crit-direction; single-target untouched, exact-match 16/16). New
runner flag used here: **`--crit R`** adds SpellCritRating via bonusStats (negative to suppress crit).

## The finite-mana / conserve harness (real gearing stat weights)

The infinite-mana harness (`genapl` + `--mana 900000`) gives the **layout** EP; the **gearing** EP needs
a mana-managed rotation at **real mana** (`docs/EP.md`). Pieces: `tools/genconserve.mjs` (the conserve
APL), `tests/ep-finite.mjs` (the sim finite-difference), `tests/mana-value.mjs` (the analytic value-of-
mana cross-check), `tests/finite-weights.json` (the locked numbers). Reproduce:
`node tests/ep-finite.mjs --dur 300 --iter 45000 --seed 11 --inf` (add `--native` to finite-difference
the export's OWN wowsims rotation as a cross-check; `--dur 145/420` for fight-length).

**★ TRAP — the APL silently SUPPRESSES external mana cooldowns unless you add `autocastOtherCooldowns`.**
Innervate and Mana Tide are auto-managed `CooldownTypeMana` MCDs (`registerInnervateCD`/
`registerManaTideTotemCD`, `sim/core/buffs.go`). In APL mode wowsims **removes MCDs referenced by the
APL** from the autocast set and fires the rest **only via** an `autocastOtherCooldowns` action — so a
schedule-only APL fires *none* of the un-referenced ones. **Without it the mage loses Innervate + Mana
Tide entirely (−6% DPS, 1806→1916 at 300s) and its stat weights are biased toward mana-starvation.**
`genconserve` includes the action; it is safe because APL-referenced CDs (our scheduled IV/AP/Icon/Gem/
Zerk/Evocation) are excluded, so nothing double-fires (verified: exact scheduled fire-counts unchanged).
Confirm any new mana harness fires them: `grep 29166` (Innervate) `16190` (Mana Tide) in a `SIMLOG` log.

**The sim already models the whole raid mana economy on the export — do NOT reimplement it.** Verified
firing on the reference export: regen ticks (`OtherID:2` — mana-spring mp5 + **Shadow-Priest/Vampiric-
Touch = +250 mp5** permanent (`ShadowPriestDPSManaAura` = `dps·0.25`) + `spirit·√int·0.009327·0.30`-
casting), **JoW** (27164, 74/hit), **Mana Tide** (16190, `0.06·MaxMana`/tick×4 at ~40s), **Innervate**
(29166 — `ForceFullSpiritRegen` + `SpiritRegenMultiplier×5` for 20s), **Evocation** (12051, `0.15·MaxMana`
×4), **Mana-Emerald gem** (22044). Armor is **Molten** (crit), not Mage (regen) — the player's real
choice. This is why option **(B)** (leverage wowsims) beats reimplementing: the validated engine already
does innervate/manatide/VT/JoW/evocation/regen correctly, on the player's real raid setup.

**Findings (sim finite-difference, cross-validated 3 ways).** Real gearing weights (300s, SP=1):
**SP 1.00 · Int 1.08 · Haste 0.96 · Crit 0.79 · MP5 0.66 · Spirit 0.54 · Mana ~0** — vs the infinite
ceiling on the *same* schedule (Haste 1.44, MP5/Spirit **exactly 0**, Int 0.56). The **conserve rotation
and the native wowsims rotation agree** (haste 0.96 vs 1.00), and the analytic value-of-mana (~2.2
dmg/mana) brackets MP5 — so this is not a harness artifact. **The "haste is weak for Arcane" folklore is
about the OOM-idle rotation** (pure-spam haste EP **0.03**); a Frostbolt-conserving mage keeps haste ≈
0.96 (never idles). Full table + fight-length + intermission numbers: `docs/EP.md`, `finite-weights.json`.
This is a mana **blind-spot** finding (the count is mana-blind) so the sim is ground truth here; it does
**not** touch the planner (the infinite-mana engine stays default; exact-match 23/23).

## Verifying a golden change

After an intentional model/optimizer change: rebuild (`-tags with_db`), run `tests/exact-match.mjs`,
and for every golden whose plan moved, first read off the **effective-ABs count** — that's the arbiter
for whether the new line is better. **Sim-verify** the move when a blind spot is in play (a ramp/
intermission-exit shift, an AoE or multi-AP-timing call) or the finding is novel/suspicious: new-vs-old
with the SAME seed, `--var 0`, ≥150k, confirm under `--var 10` too; if the change adds/removes a press,
add a far-seed replicate (nearby seeds share the sample — see the statistical protocol). Accept only if
the count improves and any sim check is new ≥ old. Then `node exact-match.mjs --update` and eyeball the
diff. **The count is the objective and the arbiter; the sim calibrates it and covers its blind spots
(the methodology at the top).**
