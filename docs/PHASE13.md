# PHASE 13 — the open work, after the objective was made exact

**Status: OPEN (written 2026-07-27).** This is the project's only in-flight plan doc. It promotes
`docs/PHASE12-RESUME.md` (deleted) and inherits the un-started work of Phases 11 and 12, which are now
archived at `docs/archive/12-phase11-platform.md` and `docs/archive/13-phase12-exact-objective.md`.

**Everything in this file is genuinely open.** Nothing here is a finished item kept for its reasoning —
that is what the archive is for. Each item states, in one line, **why it is open**. If you close one,
delete it from this file and record the arc in `docs/DIARY.md`.

## §0 Where the tree stands — the state this phase starts from

The objective is **exact**: for every Arcane Blast the walk knows haste, stacks (⇒ cast time), which
buffs apply and crit, so `dmg` is exact and the objective is that sum, with **one boundary rule at
every cut**:

```
credit = min(1, (nextCut − castStart) / castDuration)      × that cast's own value
```

A **cut** is the fight end, an intermission start, or either edge of an AoE phase. A **burn** edge is
not — the boss is targetable and the spell is the same, so a burn multiplier is a *value* question
under the snapshot rule, not a *landing* question. `total`, `robust` and `totalEarly` are **one
number**; the board carries `frac` and `credited`. Cooldowns chain from the **fire** moment (`auraAt`),
not the press, so the model can no longer emit a plan the sim declines to execute.

```
exact-match          25 passed, 0 failed          self-consistency   0.00e+0 / 2755 scorings
window-span  pass    credit-check  pass           snapshot-rule      pass
wall-credit  pass    sim-duel      pass           sim-request        9/9 (native runner)
press-headtohead     HELD 18 → 1 of 196 presses
```

**No freeze is in effect.** `index.html` and the whole import closure are editable; the closure freeze
applies only *while a cross-val round gathers* (§4.1).

---

## §1 ▶ THE AoE EDGE — the one open item that changes numbers the tool prints

> ## ⏳ DECISION IN FLIGHT WITH THE USER — leave this section for them to fill.
>
> **Do not decide it, and do not implement either answer, until this section says otherwise.**

**Why it is open:** an Arcane Blast completing inside an AoE phase is currently **docked as if the boss
were untargetable** — the AoE edge inherited the intermission's treatment when the boundary credit
landed, and that inheritance was never argued for. The boss **is** targetable during an AoE phase: the
cast lands, for full Arcane Blast damage. You would simply rather have been casting Arcane Explosion.
So the question is not *"does it land"* but *"what should you have been casting"* — a different
question with a different answer.

Framing and prior art: archived PHASE12 §9.5 sub-decision 2, and §8.3's closing ⚠. The engine site is
`dmgOf`'s `nonAB`, which covers `aoe` as well as `intermission`. `tools/wall-credit.mjs` is the gate to
extend once it is decided.

★ **This is the only item in this file that moves numbers the tool prints to a user.** Everything else
is measurement, enforcement, platform or research.

*(User: your ruling goes here.)*

---

## §2 THE MODEL'S STANDING BAR — re-measure what PHASE 12 voided

### 2.1 Re-gather `docs/ACCEPTANCE.md`

**Why it is open:** ACCEPTANCE has **no current reading**. Every round in it was gathered against the
scorer PHASE 12 replaced — the rate integral, press-anchored buff windows, one snapshot rule, the
symmetric kill taper, a press-anchored cooldown chain — so its verdicts (invariant A passes, B2 fails
at 142/345, worst 0.380 %) grade an engine that no longer exists. The tables stay: they are the
append-only record and the evidence trail. **Their verdicts must not be cited as the model's status.**

★ **It is now mostly arithmetic, not sim time.** `tools/xval-model.mjs` re-optimises at every haste and
cross-scores every plan at every haste **with no sim at all**. It was built as *"the by-construction
half"*, subordinate to the sim; with an exact objective it is the primary instrument. ⚠ It tests the
**search**, not the physics — a sim-less sweep confirms the model against itself and cannot catch a
wrong constant. That is what the sim is still for; it is how the 334 ms cast-time mismatch was caught.

⚠ **Re-pose the PASS criterion before grading, do not re-answer it as written.** The "restate the bar
in terms of the ripple floor?" question (archived PHASE12 §1.3) is **void as posed** — all three of its
premises (the model integrates the continuum limit; a `1 − W/c` sawtooth; `KILL_WINDOW` is part of the
objective) were destroyed by the exact objective. The *trade-off* it names is still real: a hard-zero
bar carries information only if it is reachable, and a tolerance is what Phase 7 deliberately removed.

### 2.2 Re-run `tools/model-audit.mjs` at scale

**Why it is open:** it read **17 of 23 failing** on multi-use fights, and it was **not re-run after the
fix it had itself diagnosed**. The cause it named — cooldowns chained from the press rather than the
fire — landed, and `press-headtohead` measured HELD **18 → 1 of 196**. So the standing figure is a
measurement of a superseded engine, and its own diagnosis predicts it should now be much smaller.

This is the bar the user set: *"the model should be able to predict the logs press by press down to the
milliseconds."* It holds **exactly** on single-use fights (94/94 casts, cast times to the millisecond,
buff SP and damage multiplier exact). Multi-use is the open half.

### 2.3 Re-run `tools/scorer-duel.mjs` — its prerequisite landed

**Why it is open:** §0.4's demonstration — *show the exact objective beats the retired integral in the
sim, cell by cell* — has never been obtained. It was run twice and came out a coin flip both times, and
the second time the cause was named: the referee mis-executed ~13 % of its presses on the cast-time
mismatch, and *"a referee that mis-executes ~13 % of presses cannot resolve a margin of ~0.01 %."*
**That prerequisite is discharged** (`STACK_CAST_REDUCTION → 334 ms` plus millisecond rounding;
LATTICE-class press failures 8 → 0, bare-stream drift 0.080 s → 0.005 s). The duel has not been re-run
against it.

⚠ **Two instrument rules this tool has already earned, do not lose them.** (a) A tie rule needs a
**resolution floor**, not just a seed band — under common random numbers the band collapses to ±0.00
and *"tie if |Δ| ≤ band"* turns `+0.00` vs `−0.00` into a verdict. (b) A tool taking both a *plan
source* and an *engine* must keep them separate, and the **engine must default to the working tree**;
three tools defaulted `--index` to the round blob and reported a byte-identical "no change" across two
consecutive fixes.

⚠ The goldens have since been re-recorded on `plan-rescore` evidence instead (15 of 16 better, 1
plateau, **0 regressions**, all under the new engine's own scorer). The duel is therefore no longer
gating the goldens — it is the **independent** check that the exact objective is the better ranker.

### 2.4 The model↔sim boundary reconciliation

**Why it is open:** `sim/benchmark.mjs`'s **`variation: 0.5` is no longer matched to anything in the
model.** It used to be justified as *"the model's kill-window WIDTH"*; that constant is gone. It keeps
its value on its own measured evidence (`tools/var-decision.mjs`) as the **sim's** way of not parking
its fight end on a discontinuity. So model and sim now smooth the same problem by different means — the
model **analytically** (proportional partial credit), the sim **numerically** (averaging over T ± 0.5)
— and nobody has reconciled the two answers.

⛔ **Do not "fix" it by flipping `variation` to 0.** That reintroduces a measured failure: at var 0,
when two arms differ in terminal cast rate, the effect swings **−32.8 → −0.9 → −31.8 DPS across 0.1 s
of fight length**. (TOOLING's ★★ ban on `--var 0` is about comparing **DPS**; it must be *re-stated*
for the new comparison method, not deleted.)

★ **The route the user named is the one to build, and it needs no extra sim run.** At a fixed `T` the
sim's completed-cast set is deterministic, and `model-audit` already requires the model to predict the
log **cast for cast** — so both sides agree on the straddling cast's start and duration, and the
partial credit is a deterministic function of numbers they already share. Model-vs-sim verification
becomes **identity**, not a statistical DPS comparison: a strictly stronger bar and a strictly cheaper
one. It is blocked on §2.2 (multi-use fights must audit clean first).

---

## §3 THE SEARCH-OPTIMALITY PROGRAMME (archived PHASE12 §7)

**Why it is open:** with an exact objective, *"the search did not find the optimum"* is a well-posed
question for the first time — and none of the programme is built. The sim's job is to **falsify the
search**, not arbitrate the scorer; every model-vs-sim disagreement is now a **search bug report**.

★ **The structural fact that makes it tractable:** the objective is **piecewise-constant in the press
times**. A press enters the score only through the cast boundary it snaps to (`auraAt`), and the window
then covers a determined set of casts — moving a press *within* an interval changes the score by
exactly zero. ⇒ **the decision variable per press is an integer: which cast it fires on.** The
continuous search the tool runs today explores a space far larger than the one that exists.

Cheapest rung first:

1. **Exact enumeration on the cast lattice, small instances first** (short fights, 2–3 cooldowns).
   Feasible today, **no sim**, and it yields the strongest possible statement: *for this fight, this IS
   the global optimum.* It also certifies the heuristic on those cells.
2. **Branch and bound** with an admissible upper bound — because the objective is an exact sum, the
   remaining contribution can be bounded optimistically (give every unplaced cooldown its best
   conceivable window, ignoring conflicts), so pruning against a good incumbent is sound. Cooldown
   spacing collapses the space further (Icy Veins admits ≤2 uses in 300 s, ≥180 s apart — pairs, not
   squares), as does dominance (a window wholly in downtime or wholly past the kill). How far it scales
   is empirical — **measure before promising**.
3. **Generalize every disagreement.** Wherever enumeration or B&B beats the heuristic, the fix is a
   **rule or a seed class**, not a re-tuned scorer. This entire programme is arithmetic; the sim is not
   in the loop at all.

⚠ **"Proven optimal" is PER-INSTANCE, not once and for all.** You prove it for a given fight/gear/kit;
across the input space you rely on the heuristic plus a certified corpus — which is what
`docs/ACCEPTANCE.md` is for, and why §2.1's re-gather being cheap matters.

⚠ Re-run `tools/deficit-fix.mjs` before concluding anything about search misses: its **0/4 misses at 3×
restarts** was the search optimising the **integral**.

---

## §4 ENFORCEMENT — make "the last geared run" a guarantee, not an intention

Inherited from archived PHASE12 §1.1e. The user asked for a guarantee; a note in a doc is not one.
Item 1a (list the closure wherever the freeze is stated) is done; **1b and 2–4 are open.**

### 4.1 ★ Fold the import closure's hashes into `ENGINE_ID` — the one that matters

**Why it is open:** the plan cache keys on **`index.html`'s bytes alone** (`xval-bench.mjs:179`,
`ENGINE_ID = sha1(index.html)`). Every *other* file `xval-bench.mjs` imports can be edited mid-round
and the cache will keep serving plans computed by the old code **under an unchanged key** — silently,
and only for the cells gathered after the edit, with nothing in the table saying which. The closure is
`tools/engine-node.mjs` (it *builds* the engine), `tools/genapl-core.mjs`, `tools/reference-gear.mjs`,
`sim/planspec.mjs`, `sim/simreq.mjs`, `sim/benchmark.mjs`, plus `tools/xval-bench.mjs` itself (the
campaign spawns a fresh copy per cell).

⇒ Hash the closure into `ENGINE_ID` so a mid-round edit **misses** the cache and re-solves rather than
silently mixing instruments. **A freeze a tool enforces beats a freeze a doc requests** — and this was
found by trying to make a change that looks obviously inert. Land it **before** §2.1's re-gather, which
will need the freeze again.

### 4.2 Make the geared path opt-in, not default

**Why it is open:** `tools/xval-bench.mjs:251` still hardcodes `tools/bench/export-request.json`, with
no flag to switch it. Replace with a `CHAR=` selector defaulting to **`model-ref`**, and make the
geared path require an explicit `CHAR=bench` *plus* a printed banner naming the retirement. A future
session must have to **choose** the retired baseline, and be told it is retired.

### 4.3 Stamp it, and refuse to pool across stamps

**Why it is open:** `char=` already rides every `XVAL-DONE` line — that is what lets a later reader
classify a table without trusting a directory name. Make `xval-verify.mjs` **refuse** to pool tables
whose `char=` values differ. Round 1 is `char=bench`; everything after is not, and a mixed directory
must be a hard error rather than a silent average.

### 4.4 Archive round 1 under a name that says what it is

**Why it is open:** the last geared round still sits in `tools/xval-results/` under a neutral name.
Move it to e.g. `gearB-final-geared-<date>/` with a README saying it is the last of its kind and why.
`gearA-pre-20260726/` is the precedent.

---

## §5 THE PLATFORM TRACK — inherited from PHASE 11, which closed without starting it

PHASE 11's findings ledger discharged 8/8 and CI came up; **the split and everything behind it never
started.** Scope is unchanged: **no scorer term, no search pass, no protocol constant** — plans stay
byte-identical except where a bug fix is itself the change.

### 5.1 The module split (archived PHASE11 §2)

**Why it is open:** never started. The single-file convention is **retired by user decision**, and four
distinct mechanisms currently re-extract code from `index.html` (the DOM-tag → Blob worker scrape; the
three-marker string slice + `new Function` in `tools/engine-node.mjs`; Playwright page-eval in 13
loaders; `tools/census-build.mjs`'s probes) feeding ~30 consumer files. Root cause, stated once: **code
that cannot be imported gets copied, and copies drift** — PHASE11 §1.2's twelve surviving fragilities
are all instances.

Target shape, the migration invariant, and the consumer-by-consumer table are in archived PHASE11
§2.1–§2.4. **The gate is non-negotiable:** the split commit moves **text, not behavior** — `plan-sweep`
A/B pre/post → `plan-diff` **IDENTICAL** (25/25, SCORE-AUDIT scorer-pinned), then `exact-match` 25/25.
No perf edit rides the split commit.

⚠ Blocked on user calls §6.1 (`file://` fate) and §6.2 (toolchain).

### 5.2 Converge the six preset→cfg copies onto ONE `cfgFor()` — and fix `cfgFor` in the same move

**Why it is open:** the preset→cfg constructor is retyped in at least six places, and measuring every
copy against the engine's own declared field set (`simMemoCfgSig`) shows **`tools/engine-node.mjs`'s
`cfgFor` drops `t5two` **and** `boundaryCharge`** — 2 of the 10 required fields. ⇒ **converging the six
copies onto `cfgFor` unchanged would turn one copy's bug into every copy's bug.** Concretely: `cfgFor`
cannot express the reference gear the entire acceptance corpus is measured on.

Both omissions are inert *today* (`GOLDEN_DEFAULTS.gear` sets neither; `boundaryCharge` is off by user
decision), which is precisely why nothing caught them — the engine reads `cfg.t5two ? 1.2 : 1`, so an
absent key and an explicit `false` are indistinguishable. That is the "score a no-T5 mage against a T5
sim" bug class with no failing test available to express it.

`tests/cfg-contract.mjs` reports it today and `--strict` turns it into an exit-1 gate. **Strict is OFF
by default and must stay off until this lands** (a permanently-red gate is one nobody reads); **turn
`--strict` on in CI as the last step of the convergence** — it is the check that proves the convergence
fixed the thing it was for.

### 5.3 The reclaim ladder (archived PHASE11 §3.1 / PHASE9 §4)

**Why it is open:** never started; it was blocked on the `index.html` freeze for its whole life, and the
freeze is now lifted. Rungs, cheapest-and-safest first: hoist `counts(base)`/`clipOf(base)` out of the
candidate loops via `admit`'s signature → **per-cfg memo with two-generation eviction** (kills the
`cfgSigOf` prefix concat on ~2M lookups and the wholesale `SIM_MEMO.clear()`s) → stringify hoists at
the remaining both-operands-in-loop sites → hot-loop allocation (`stepFor`/`scanAt` fresh objects, the
per-`simulate` breakpoint Set→spread→sort) → **five-walk fusion** (repair:simulate:sig ≈ 1:1:1 at
~29.3M walks each — the largest catalogued win, cheap to land behind `admit`'s single call site).

⚠⚠ **IT NEEDS A FRESH CPU BASELINE AND FRESH ANCHORS BEFORE ANY RUNG IS PRICED.** Both the starting
point ("≈ pre-§5.12 CPU +2–4 %") and the estimate ("plausibly −20–30 % combined") were measured against
the **pre-PHASE12 scorer**, and the walk that dominates the profile is exactly the code that changed.
Every `index.html` line anchor in PHASE11 §3.1 is dead; re-anchor by **content**. And PHASE9 §5.14's
rule stands: wall-clock numbers compare only within a same-session pair.

Per step: T0 sweep gate + wall-time re-measure + **pre-registered revert**. Search-touching changes gate
on the **full 25**, never the quick tier. ⛔ Do not re-propose the falsified list (PHASE9 §4.12.7
sigOf-equality, §5.10 starts-cut, §5.13 plateau/nudge/anchor-widening, §5.14 top-K raw cut, §3.6 H5) —
all recorded with verdicts.

### 5.4 The engine's interior, and the one multiplicative candidate

**Why it is open:** the typed-array / struct-of-arrays interior for `simulateRaw` (preallocated
module-scope scratch replacing per-call object graphs — where the 41.5 % self-time + 5.3 % GC live,
10–25 % plausible) was never attempted. And PHASE9 §5.6's biggest question is still open: solve cost is
~exponential in press count (×1.35–2 per slot; 5 cases = 73 % of corpus CPU) — **is that factor
irreducible, or an artifact of re-exploring settled prefixes?**

⚠ **The prefix/span-reuse shapes PHASE11 §3.3 proposed were written for the RATE INTEGRAL and must be
re-derived.** "Span-contribution reuse keyed on active-window state" is a statement about integrating a
rate between breakpoints; the arbiter is now a per-cast sum whose terms depend on each cast's
*completion* and on a boundary credit coupling the tail of the walk to `T` and every cut. The one
durable constraint survives: **only same-values-in-same-order summation qualifies** — any re-partition
flips 1e-7 accepts and is the falsified-by-construction branch. Gate: full sweep + SCORE-AUDIT + duels;
`changed > 0` = fail.

⛔ **Planner-to-WASM stays rejected**: non-correctly-rounded `Math.pow`/libm means no bit-identical
promise; it would be a deliberate re-golden major version, a project decision rather than a perf item.

### 5.5 What CI still owes

**Why it is open:** CI exists (`.github/workflows/ci.yml` — `fast`, `page`, `plans`) but three jobs from
the original scope are not in it: the **`plan-sweep` A/B-vs-merge-base + `plan-diff`** job (catches
unintended plan movement *and* scorer-pinned score regressions — the gate hole PHASE9 §5.15 closed by
hand), the **cached native-runner build** keyed on `pin+patches-hash+go-version` that would make the
full anti-drift matrix CI-able, and the **pooled-vs-sequential byte-equality** assertion that would turn
F11's *"verified"* claim into a standing gate. ⚠ Every new job needs a **negative control** before its
green is believed — two of the three existing jobs carry one, which is the only reason they are
evidence.

### 5.6 Product routes (archived PHASE11 §4)

**Why it is open:** none exist. Every one is a **lazily-loaded route** — a visitor who never opens it
downloads nothing for it. In the order PHASE11 §7 sets: **URL-shareable setups + last-setup autosave**
first (the biggest pure-UX win; today there is zero URL state and a mid-raid refresh loses the fight
being planned, while `snapshotState()` is already the serializer and determinism makes a link a
*reproducible plan*), then offline/service worker, the mobile + input pass, the multi-seed error band in
the sim button, and static APL export. The remaining four (research mode, setup comparison, EP route,
the Drums/PI upstream patch) are gated on §6's user calls.

---

## §6 USER CALLS — carried VERBATIM from archived PHASE11 §8. These are DECISIONS, not work.

> **Do not answer these in the course of doing other work.** They are reproduced word for word so that
> nothing is lost in paraphrase; each is still unanswered.

1. **file:// double-click**: accept "local preview = tiny static server" (clean modules), or keep
   double-click via build-time inlining (committed artifact + freshness gate)?
2. **Toolchain**: stay no-build (recommended start) — and is a later esbuild/minify step wanted at
   all?
3. **Precomputed preset plans**: accept shipping golden-derived plans as data (instant presets)
   under the anti-drift gate, or keep every render solver-fresh?
4. **Setup-comparison view**: reopen the "no dedicated feature" ruling? (Absolute-damage currency
   per the existing ruling if yes.)
5. **EP route in the tool**: reopen "two lightweight routes, no bespoke calculator"?
6. **On the first wasm rebuild**: keep the wasm in git (+~4–5 MB pack per rebuild) or move to
   release-asset + committed sha256?
7. **Research mode**: wanted at all, and if so its cell-budget/UX guardrails.
8. **COOP/COEP**: accept the (no-op today) embedding restriction to get instant cancellation?

⚠ Call 4 additionally needs the **currency** kept straight: setups compare on **absolute at-kill
damage**, never on the effective-AB count — effective-casts normalizes to each setup's own plain AB,
which is what makes it right *within* a setup and blind *across* setups.

---

## §7 NICE-TO-HAVES — real, small, and not blocking anything

- **The printed press second is wrong on 1.8 % of presses.** *Why open:* explicitly deferred by user
  ruling — *"the model itself and the calculations and correct activations come first… we then just
  round the shown number to be human readable, but that's secondary."* The plan prints
  `floor(actEff)` — the **press** moment — while the assumptions panel promises *"press at the second
  shown"* and the buff is up at the **boundary after** it; when flooring walks back past a cast
  boundary the macro fires a whole cast early. Measured: 3005/3060 presses correct, **55 wrong**, and
  **0** presses for which no whole second can name the scored window. Fix: print **`floor(auraAt)`**,
  introduced as its **own field** rather than by redefining `actEff` under its other callers (the
  transcription, the timeline and the custom-plan editor all read it). Display-only; touches neither
  scorer nor search. Archived PHASE12 §6.13.
- **The stat-distribution transfer test.** *Why open:* it is the **first** piece of gear-agnostic work
  and it has never been run. *"Do scheduling conclusions transfer across stat distributions?"* decides
  whether the new corpus measures the same thing the old one did. Cheap: solve one fight family on
  both characters and compare the argmax plan at each haste. **Agreement** ⇒ the switch was free;
  **divergence** ⇒ the geared operating point was load-bearing and the gear factors come back **as
  model inputs**, which is exactly the escape hatch the user reserved.
- **Ashtongue Talisman of Insight.** *Why open:* a random on-crit proc, outside every cross-val kit,
  needing a stochastic treatment — and **un-owned since Phase 7 closed without it**. RULES §14 folds it
  into passive haste, which is the *modelling* answer, not the *cross-val* one.
- **`tools/lattice-ripple.mjs` / `tools/ripple-audit.mjs` need RE-DECIDING, not re-wording.** *Why
  open:* both still describe the model as computing *"the CONTINUUM LIMIT of the same taper — the
  widths match"*, which is false at every word since the objective went exact. ⚠ **Do not simply
  reword them:** `ripple-audit` already **fails two of its own pre-registered self-checks** (P3, P5 —
  archive/11 §8.30), so no ripple decomposition was quotable even on the round it was built for, and
  its `mono=0` stamp means **FAILURE** beside a `vacuous=0` that means success. Decide whether either
  tool still has a question to answer; retire them if not.
- **Retired instruments now labelled, no action needed unless they mislead:** `tail-phase-probe` exits
  2 (its `robust − totalEarly` is identically 0), and `p8-round10`'s F3 degeneracy guard reports
  permanently vacuous.
- **`tools/xval-round-pipeline.sh` and friends carry a hardcoded session-scratchpad `SP=` path**, so
  `xval-boss-warm.sh`'s wait-loop polls a log a future session will never create and would hang
  forever. *Why open:* "promoted into the repo" and "reproducible" are not the same property.

---

## §8 TRAPS — carried from archived PHASE11 §9, all still live

- **"Pure addition" isn't.** `groupSeeds` regressed 7 off-corpus cells through three winner-take-all
  narrows; anything that adds candidates, workers or cache layers must argue its floor.
- **Golden-corpus green ≠ off-corpus safe** — plan-identity on 25 cells was structurally unable to see
  PHASE9 §5.15; the sweep + SCORE-AUDIT + duels regime exists for exactly the split/perf commits.
- **A second definition of anything** (plans-as-data, inlined build artifacts) **needs a freshness gate
  in the same commit** — the `sim-request` template check is the house pattern.
- **Silent-pass gates**: PHASE11's B7/B8 were both gates whose failure mode was a **pass**. Every new
  CI job needs a negative control — a deliberately-broken input that must fail — before its green is
  believed.
- **Cache keys must cover the inputs.** The solve cache and any memo added in §5.3 must key on engine
  hash + **full** cfg signature. §4.1 is the same lesson one level up.
- **Two wowsims**: never derive the upstream URL from the Go module path; the pin moves only as a
  deliberate re-baseline.
- **Wall-clock numbers compare only within a same-session pair** — every perf step re-measures its own
  baseline.
- **The campaign coupling**: until the split lands, `index.html` edits and running sim campaigns share
  one file — respect the freeze window whenever a round gathers (§4.1 is the fix that makes the freeze
  enforceable).
- ★ **And the one this project earned four times in a single phase: an instrument that flatters or
  blinds itself.** A summary line that disagrees with its own table; a classifier that launders the
  defect it was built to catch; a tie rule with a noise band but no resolution floor; a tool whose
  engine defaulted to a stale blob. **Read a tool's output, not its verdict line**, and give every new
  instrument a control that must fail.

---

## §9 OUT OF SCOPE — standing rejections, do not revisit

The leeway "press anywhere" bands and reasoning-tag UI; an in-tool "exact mode" (the brute-grid
instrument is for **research** — generalize its findings into rules, don't ship enumeration, which is
also the fence around §3); the finite-mana model (the per-window mana-cost chip is the ceiling of mana
UX); the boundary charge ON; any computation after the results render; any prepull in a model-compared
sim; legend/Pressboard resurrections. The haste-graph reference lines stay.

⛔ And the three retired scoring approaches must never return: ranking on the **rate integral**;
expiring a buff window from the **press** time; **one snapshot rule** for both kinds of buff. Their
evidence is archived PHASE12 §6.10, §6.11 and §6.12; their gates are `tools/self-consistency.mjs`,
`tools/window-span.mjs`, and `tools/snapshot-rule.mjs` + `tools/credit-check.mjs`.
