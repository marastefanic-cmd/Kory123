# PHASE 12 — MAKE THE OBJECTIVE EXACT (▶ TOP PRIORITY, user-directed 2026-07-27)

**Status: CLOSED 2026-07-27, archived.** The charter is **DISCHARGED**: `simulate()` ranks on the
deterministic per-cast sum of effective Arcane Blasts. **Four scoring defects and one transcription
defect** were found and fixed, and the cast lattice was closed:

| # | defect | where | gate that now holds it |
|---|---|---|---|
| 1 | ranking on the **rate integral** instead of the model's own per-cast sum (median 0.2114 % of score, max 1.4263 %, against ranking margins of ~0.005–0.07 %) | §6.8 → §6.10 | `tools/self-consistency.mjs` **0.00e+0** / 2755 scorings |
| 2 | buff windows **expired from the PRESS**, so every mid-cast press got a short window | §6.11 | `tools/window-span.mjs` |
| 3 | **one snapshot rule** where the game uses two — haste at cast START, value at cast COMPLETION, over `(start, end]` | §6.12 | `tools/snapshot-rule.mjs` · `tools/credit-check.mjs` |
| 4 | a **symmetric kill taper** and a wall paid in FULL — replaced by one boundary credit at every cut, `min(1, (nextCut − start)/duration)` (user ruling) | §8 → §9 | `tools/wall-credit.mjs` |
| T | the press **transcription**: `floor(actEff)` put 7.14 % of presses on a cast the model never chose | §6.9 | `tests/press-fire.mjs` |
| L | the **cast lattice**: `STACK_CAST_REDUCTION 1/3 → 334 ms` **and** millisecond rounding of every cast/GCD, as wowsims does | §6.14 | `tools/lattice-drift.mjs`, LATTICE press failures 8 → **0** |
| C | cooldowns **chained from the press** rather than the fire, so the model could emit a plan the sim declined to execute | §6.14c | `tools/press-headtohead.mjs`, HELD **18 → 1** of 196 |

**The tree is green:** `exact-match` **25 passed, 0 failed** (goldens re-recorded), `self-consistency`
**0.00e+0**, `window-span` · `credit-check` · `snapshot-rule` · `wall-credit` · `sim-duel` pass,
`sim-request` **9/9** on the native runner.

⚠ **CLOSED, NOT FINISHED — two things it opened and did not do.** (a) **§7's proof programme** — the
objective is now an exact sum and the decision variable per press is an *integer* (which cast it fires
on), which makes exact enumeration and branch-and-bound well-posed for the first time; none of it is
built. (b) **The acceptance re-gather** — every verdict in `docs/ACCEPTANCE.md` was gathered against
the scorer this phase replaced and is void as a model reading; re-gathering is now mostly arithmetic
(`tools/xval-model.mjs`, no sim). Both carry forward to **`docs/PHASE13.md`**, together with the AoE
edge decision this phase deliberately left open (§9.5 sub-decision 2) — ✅ **which was itself decided
hours after this doc was archived, and then decided AGAIN the other way the same day.** The net result
**agrees with the way this phase shipped it — an AoE phase START is a cut — but for a completely
different reason.** This phase's reason (*"the spell changes, so the cast in flight does not land as
what it started as"*) was **falsified by the sim**: the boss is targetable and the Blast lands. The
reason that governs is **POLICY**: the Blast lands, but adds are up and Arcane Explosion is worth
several Arcane Blasts, so the player **cancels** it — which also means the AE lattice restarts **at the
wall**, something this phase's version did not do. ⚠ **Do not read this doc's shipped behaviour as
vindicated; read `docs/RULES.md` §9 / `docs/PHASE13.md` §1 for the reasoning that actually holds, and
for the deliberate sim divergence it prices.** Chasing the question also exposed a 42 % error this phase
had shipped (instant casts credited at zero), reachable by none of its gates. Both are annotated at §9's
landing block.

Cited across the living docs as **"PHASE12 §x"**; section numbers are unchanged, so those citations
still resolve. ⚠ **One citation was always wrong and is being corrected as this doc lands:** several
places cite *"PHASE12 §3"* for the **cooldown-chain fix**. §3 is the **debts table**; the chain fix is
**§6.14c**. (§3.6/§3.7/§3.8 *are* debts-table rows and those citations are correct.)

> ## ⛔ READ FIRST — SIX BLOCKS IN THIS DOC WERE LIVE INSTRUCTIONS AND ARE NOW FALSE
>
> This doc was written **during** the work, so its early sections instruct against a repo state that
> the later sections destroyed. Each is bannered in place; the index is here so a reader who lands
> mid-document is warned before acting:
>
> | § | what it says | why it is false now |
> |---|---|---|
> | **§6.11e** | *"`exact-match` WILL FAIL on every case … ⛔ Do NOT run `--update`"* | ⛔ **the most dangerous stale line in the repo** — the suite is **25/0 green** and the goldens were re-recorded under §9 |
> | **§8.1** | a cast completing exactly at `T` is paid **0.5** | it is paid a **FULL** cast (§9) |
> | **§8.3** | the fix is *"`dmg = 0` … Not partial credit"* | superseded by §9's fraction; **as written it would re-introduce the defect** |
> | **§1.3** | the ripple-floor framing (continuum limit, `1 − W/c` sawtooth, "`KILL_WINDOW` is part of the objective") | every premise is gone; debt **§3.7** depends on it |
> | **§6.1 / §6.4 1–3** | the terminal-cast family is closed; *"do not re-attempt"* | measured with the **retired rate integral** as arbiter |
> | **§6.6 / §6.7** | *"the sim's buff starts at the first cast boundary strictly after the press"* | falsified by **§6.9a** — `IsReady` is `>=`; it was a lattice mismatch |
>
> Also stale and bannered in place: **§0.3 step 1**'s *"`robust` == the tapered cast sum"* (no taper
> exists), **§6.11d**'s *"334 ms is a PREREQUISITE"* (it landed, §6.14), **§6.14c**'s
> *"WHAT REMAINS: HELD = 18"* (landed, 18 → 1), and **§6.16b**'s *"model-audit 17 of 23"* (measured
> before the chain fix that was its own diagnosed cause).
>
> ★ **What survives, and it is most of the document:** every mechanism, every measurement of a defect
> *as it existed*, every falsified candidate, and — above all — §6's four recorded instances of an
> **instrument flattering or blinding itself** (§6.1's summary line contradicting its own sweep table,
> §6.9's classifier laundering the defect it was built to catch, §6.11c's tie rule turning `+0.00` vs
> `−0.00` into a verdict, §6.14b's three tools defaulting `--index` to the round blob and reporting a
> byte-identical "no change" across two consecutive fixes). Those are the phase's durable lesson.

## §0 THE CHARTER

**Make `simulate()` rank on the quantity the project is defined around: the deterministic per-cast sum
of effective Arcane Blasts. Then use the sim for what it is actually for — falsifying the search.**

### §0.1 Why this is above everything else

For each Arcane Blast the model already knows the haste and the stack count (hence the cast time),
whether Arcane Power is up (×1.30), which spell-power buffs apply (normalizable against a plain cast),
and the crit rate (a constant factor that cancels). **The objective is a sum. There is nothing to
approximate.** `simulate()` computes precisely that in its discrete cast walk (`index.html:1086`) — and
then ranks on a **continuous rate integral** instead (`:1248-1263`).

**Measured, 2755 plan-scorings, no sim (`tools/self-consistency.mjs`, §6.8):**

| | |
|---|---|
| integral − tapered cast sum | median **+0.432** eff ABs · range **−0.757 … +1.656** |
| as % of score | median **0.2114 %** · p90 **0.5646 %** · max **1.4263 %** |
| corpus's entire deficit range | 0.004 % – 0.380 % |
| the model's own ranking margins | ~0.005 % – 0.07 % |

⇒ **The model disagrees with itself by ~3× the largest effect it is asked to resolve**, and the gap is
plan-dependent so it does not cancel in a comparison — **it IS the near-tie.** Everything downstream is
provisional until this is fixed: the 142 B2 columns, the persistence work list, the B2 debt, and every
scorer term falsified in §6.1–§6.3 (all were tuned against a number that is not single-valued).

### §0.2 The sim's role, stated correctly at last

**The sim exists to FALSIFY THE SEARCH.** With an exact objective, ranking two plans is arithmetic and
cannot be wrong. So when the sim prefers a plan the tool did not emit — and the exact count agrees once
computed — **the search failed to find it.** The cross-val corpus is a brute-force explorer of regions
the search never visits; each disagreement is a **pattern to generalize into a rule or a seed class**,
which is how the model improves. It is *not* a scorer to re-tune, and a sim/model disagreement is a
**search bug report**.

Secondary, in order: **anchor the physics** (trust anchor to `wowsimcli`); **cover genuine blind spots**
(mana, AoE weighting); **build user trust** via the in-page benchmark button — the same code path as the
internal corpus, which is what makes the tool's claims checkable by the person relying on them; and
**verify a novel finding** before locking it.

### §0.3 The order of work

1. **Score the per-cast sum.** Keep the integral only if it earns its place as a *search-smoothing*
   device — never as the arbiter.
   **Gate, and it needs no sim:** ~~`robust` == the **tapered** cast sum~~ ⛔ **the word "tapered" is
   stale — THERE IS NO TAPER.** The symmetric kill taper it names (`KILL_WINDOW = 0.5`) was retired by
   user ruling later the same day (§9); each cast now carries a **boundary credit**
   `min(1, (nextCut − castStart)/castDuration)` at every cut, which is a one-sided window of the cast's
   own width, not a taper. The gate as it actually stands: **`robust` == the per-cast sum, recomputed
   independently from the `casts` board, to float precision, on every plan in the corpus.**
   `tools/self-consistency.mjs` measures exactly this; it reported the 0.2114 % median when this was
   written and reads **`0.00e+0`** now.
2. **Fix the press-fire offset** (§6.7). Every press fires **1.0–1.5 s later in the sim than the plan
   asks**, off-GCD trinkets included — so it is our transcription, not game mechanics. Until fixed, no
   sim number is a valid reference. Add the missing gate: `press-verify.mjs` extended to assert
   *fire time == intended time*, wired into `tests/`.
3. **Re-gather, then hunt search bugs.** Only now is *"the search did not find the optimum"* a
   well-posed question. ⚠ `tools/deficit-fix.mjs` found **0/4 search misses at 3× restarts** — but that
   was the search optimising the **integral**, so it must be re-run against the corrected objective.

### §0.4 THE BLAST RADIUS IS MEASURED, NOT GUESSED — 47.7 % of plans move

`tools/blast-radius.mjs`, class stratum, **no sim**: over the 285 pooled-argmax cells, switching the
arbiter from the integral to the tapered per-cast sum changes the **emitted plan in 136 of them —
47.7 %**. Not a tail-case correction: **nearly half the tool's output moves.**

```
isc+mqg long   T=281 @h110:  integral picks plan@70   ->  cast-sum picks plan@230
isc+mqg medium T=176 @h70:   integral picks plan@20   ->  cast-sum picks plan@110
isc+mqg medlong T=229 @h140: integral picks plan@140  ->  cast-sum picks plan@110
… 133 more
```

Two things follow, and they pull in opposite directions — **hold both**:

- **It confirms the finding is material.** A 0.21 % median accounting gap moving half the argmaxes is
  exactly what §6.8 predicts when the ranking margins are ~0.005–0.07 %. The near-ties really were
  being decided by the accounting method.
- **⚠ It means "the cast sum is correct" is now load-bearing for half the product**, and that claim is
  currently supported by *derivation* (it is what the docs define) and by *self-consistency*, **not by
  measurement against ground truth** — because the only ground truth available, the sim, fires every
  press 1.0–1.5 s late (§6.7). ⇒ **Fix §6.7 FIRST or in parallel, and do not re-record goldens against
  a scorer whose superiority has not been demonstrated.** Deriving it is not the same as showing it.

### §0.5 Expected blast radius — this is the point, not a regression

Changing the arbiter changes the argmax. Plans will move and `exact-match` goldens will need
re-recording, under the standing rule (only after each changed plan is shown to improve the objective).
This is the largest-blast-radius change the project has considered and the first aimed at the actual
defect rather than its symptoms.

⚠ **Do not do steps 1 and 2 in one commit.** They move numbers in different directions and a combined
change cannot be attributed.

---


**This is not a summary.** It is (a) the working memory for whoever picks the project up next, and
(b) the crash-recovery record for this session if its context clears. Everything here is either a
**debt**, a **user call with the evidence already gathered**, an **instrument that proved too
coarse**, or **something gear B revealed that gear A hid**.

Status when this file was opened: **round 1 gathering at 30/36**, `index.html` frozen until 36/36
(the plan cache keys on its bytes). Written against `docs/archive/11-phase10-gearb-baseline.md` §8 and `docs/archive/12-phase11-platform.md` §1/§8.

---

## 1. USER CALLS — each with the evidence to answer it in one minute

> Rule for this section: state the question, the measurement that bears on it, and the cost of each
> answer. **Do not answer them here.** (`docs/archive/12-phase11-platform.md` §8 is the other list; these are additive.)

### 1.1 ✅ DECIDED BY THE USER, 2026-07-26 — the corpus MOVES to the gear-agnostic character

> **The ruling, in the user's own framing:** *"I want to get rid of it and move towards the gear
> agnostic approach, as that's then more generalisable and applicable for all players regardless of
> gear. If needed we can then add things into the input."* And on sequencing: *"you can finish this
> round as it is, and then just make super duper sure that this is the last run using that setup and
> from then on we move towards the gear agnostic simming even internally."*
>
> **So:** round 1 completes on `tools/bench/export.json` and is **THE LAST geared round**. Every
> gather after it is gear-agnostic. Gear-specific factors, if they turn out to be needed, come back
> as **inputs to the model** rather than as a baked-in character.
>
> This section is kept in full below because the *evidence* is still what a future reader needs; it
> is no longer an open question. **The remaining work is enforcement — see §1.1e.**

**The question as it was posed.** The user's stated intent is a gear-agnostic benchmark "so we never
have to deal with this problem again" — *this problem* being the gear A → gear B re-export, which
cost the project its entire acceptance baseline (BENCH §1). ⚠ *This sentence used to add "and moved
B2's target ~0.39 pp and changed its sign"; that was **retracted 07-27** (BENCH §3e) — it does not
reproduce. The ruling is unaffected: it was made about **reproducibility**, not about any one target.*

**The finding: the corpus is NOT gear-agnostic, and nothing says so out loud.** There are two
characters, and the split is not where a reader would guess:

| consumer | character | request template | gear-agnostic? |
|---|---|---|---|
| the **website button** | `sim/model-ref.json` | `sim/model-ref-request.json` | **yes** — synthetic, stats injected |
| `tools/bench.mjs --char bench` (default) | `tools/bench/export.json` | `tools/bench/export-request.json` | no |
| **the 36-table round** (`tools/xval-bench.mjs`) | `tools/bench/export.json` | `tools/bench/export-request.json` — **hardcoded at `:251`** | **no** |

`tools/xval-bench.mjs:251` reads the geared template with **no flag to switch it**. So the round in
flight is denominated in a character that can be re-exported — which is the precise mechanism that
voided the gear-A corpus. `sim/README.md` does state that the character is "deliberately *not*
shared", but it frames that as the page-vs-harness split; it does not warn that it is also what makes
the corpus re-baseline-able.

**What each answer costs.**
- **Switch to `model-ref`** ⇒ the 30/36 tables in flight are on the wrong character and the round
  restarts (~50 CPU-hours). Buys: the corpus never needs re-baselining again, and a corpus cell
  becomes reproducible by a *user* pressing the button — which has never been true.
- **Keep `bench/export.json`** ⇒ round 1 completes as gathered. Costs: the next gear change repeats
  07-26. Mitigation short of a switch: the `char=` stamp already on every `XVAL-DONE` line, plus
  freezing the export (already done — BENCH §1.1 reversed the never-commit-an-export policy).

**Measured 07-26 — the speed claim, since it changes what a re-gather costs.** The user expected
gear-agnostic simming to be "a million times quicker". It is quicker, but the honest figure is
**~1.4×**, not orders of magnitude — one arm, 10k iters, `--no-control`, same spec/fight, two repeats
each on a saturated box:

```
geared        (tools/bench/export.json)   11975 ms · 10595 ms
gear-agnostic (sim/model-ref.json)         7708 ms ·  7896 ms
```

Consistent in direction across both repeats. On a 36-table round that is roughly **15 of ~50 CPU-hours**
— worth having, and worth *not* overselling: the solve half of a cell is unchanged, so the round does
not get 10× cheaper.

⚠ **That 1.4× answers a narrower question than the one asked, and the distinction matters.** The user
clarified they meant the *ceremony*, not the per-arm throughput: "we also made the simming much
quicker by being able to … use an internal tool for it rather than having to always set it up."
**On that question the honest figure really is orders of magnitude**, and PHASE10 §1.3 already
measured it: producing a number used to mean clone wowsims → `apt-get install protobuf-compiler` →
`go build` → hunt a private gear export out of a session scratchpad that may have been reclaimed;
it now means `node tools/bench.mjs --preset X --vs naive`, ~10 s, from the repo alone. Minutes-to-hours
and a working toolchain, down to one command. **Time-to-a-number collapsed; per-iteration cost did
not.** Both are true, they are different axes, and only the first is what "a million times quicker"
was about. Do not quote the 1.4× as a rebuttal to it.

**⚠ The honest counter-argument, which the user should hear before deciding.** `model-ref` does not
escape having an operating point — it injects SP/crit/haste, so it *has* one; what changes is that
the operating point is **declared in code** rather than exported from a gear file, so it cannot drift
silently. What is genuinely given up is what BENCH §1 argues the geared export is *for*: realistic
passives, set bonuses and hit — i.e. the stat distribution at which a layout is actually optimal.
**Whether scheduling conclusions transfer across stat distributions is an open empirical question
this project has never tested.** It is also cheaply testable, and that test should probably precede
the decision: solve one fight family on both characters and compare the argmax plan at each haste. If
the plans agree, the switch is nearly free; if they diverge, the geared export is load-bearing and
the answer is "keep it, and stamp harder".

⚠ **The decision does not make that test unnecessary — it makes it the FIRST piece of gear-agnostic
work.** "Do scheduling conclusions transfer across stat distributions?" is now the question that
decides whether the new corpus is measuring the same thing the old one did. Run it early: solve one
fight family on both characters, compare the argmax plan at each haste. Agreement means the switch
was free; divergence means the geared operating point was load-bearing and the model needs the gear
factors back **as inputs** (which is exactly the escape hatch the user reserved).

### 1.1e ★ ENFORCEMENT — "make super duper sure this is the last geared run"

The user asked for a guarantee, not an intention. A note in a doc is not one. What is needed, in order:

1. **⚠⚠ `tools/xval-bench.mjs` IS AS FROZEN AS `index.html` UNTIL 36/36 — this was not obvious and is
   worth stating loudly.** The campaign spawns a *fresh copy* of that file per cell
   (`xval-bench-campaign.sh` → `node tools/xval-bench.mjs <seed>`), so editing it mid-round changes
   the instrument between cells and assembles the matrix from two of them — the identical failure the
   `index.html` freeze exists to prevent, one file over. **Do not add the guard below until the round
   reads 36/36.** (The `index.html` freeze is documented in three places; this one was in none.)

   **★ AND THE FREEZE IS WIDER THAN ANY LIST SAYS — it is the whole IMPORT CLOSURE (found 07-27).**
   The plan cache keys on `index.html`'s bytes **alone** (`xval-bench.mjs:179` —
   `ENGINE_ID = sha1(index.html)`), so every *other* file `xval-bench.mjs` imports can be edited
   mid-round and the cache will keep serving plans computed by the old code under an unchanged key.
   The damage is silent and partial: only the cells gathered after the edit are affected, and nothing
   in the table says which. Beyond the three files usually named, the closure is
   **`tools/engine-node.mjs`** (it *builds* the engine), **`tools/genapl-core.mjs`**,
   **`tools/reference-gear.mjs`**, **`sim/planspec.mjs`** and **`sim/benchmark.mjs`**.
   This was found by trying to fix PHASE11 §1.1 B6 the "proper" way — unifying `cfgFor()` — which
   would have edited `engine-node.mjs` mid-round for a change that looks obviously inert.
   **Two fixes, and the second is the real one:** (a) list the closure wherever the freeze is stated;
   (b) **fold the closure's hashes into `ENGINE_ID`**, so a mid-round edit *misses* the cache and
   re-solves rather than silently mixing instruments — a freeze that a tool enforces beats a freeze
   that a doc requests.
2. **Then make the geared path opt-in, not default.** `tools/xval-bench.mjs:251` hardcodes
   `tools/bench/export-request.json`. Replace with a `CHAR=` selector defaulting to **`model-ref`**,
   and have the geared path require an explicit `CHAR=bench` *plus* a printed banner naming
   PHASE12 §1.1. A future session must have to *choose* the retired baseline, and be told it is retired.
3. **Stamp it.** `char=` already rides every `XVAL-DONE` line — that is what lets a later reader
   classify a table without trusting a directory name. Keep it, and make `xval-verify.mjs` refuse to
   pool tables whose `char=` values differ. Round 1 is `char=bench`; everything after is not, and a
   mixed directory must be a hard error rather than a silent average.
4. **Archive round 1 under a name that says what it is** — e.g. `gearB-final-geared-<date>/` — with a
   README saying it is the last of its kind and why. `gearA-pre-20260726/` is the precedent.

### 1.2 Inherited from PHASE11 §8 — not restated here

`docs/archive/12-phase11-platform.md` §8 lists the platform-phase user calls (module split boundaries, product routes).
They are unchanged by tonight's work; **do not decide them here**. §1.1 above is additive to them.

### 1.3 ~~⚖ Does the PASS criterion get restated in terms of the ripple floor?~~ ⛔ THE WHOLE QUESTION IS VOID

> # ⛔ EVERY PREMISE OF THIS SECTION WAS DESTROYED BY §6.10 AND §9 — DO NOT DECIDE IT AS POSED
>
> The question below is *"should the acceptance bar be relaxed to the ripple floor?"*, and it is built
> on three claims that were all true when it was written and are all false now:
>
> | premise as written | status |
> |---|---|
> | *"the model **integrates the continuum limit**"* | ⛔ **gone.** `simulate()` ranks on a discrete per-cast sum (§6.10). There is no continuum limit left to be offset from the sim's integer casts. |
> | *"leaving a `1 − W/c` **sawtooth**"* | ⛔ **gone.** The sawtooth *was* the mismatch between a continuous taper of width `W` and integer casts of period `c`. Both terms of it were retired. |
> | *"`KILL_WINDOW` **is** the half-cast hedge of RULES §8 — it is part of the objective"* | ⛔ **gone.** `KILL_WINDOW` was retired from the objective entirely (§9); a local `KW = 0.5` survives feeding only the `integral` diagnostic. |
>
> ⇒ **The "positive-biased resolution floor" this section asks the bar to be relaxed to is not a
> quantity the current model produces.** `diagWorst`'s expectation for a flawless model may still be
> positive for other reasons — a `max` over ~10 rival rows of a two-signed quantity is biased upward on
> its own — but that is a *different* argument and it has not been made. **Do not restate the criterion
> on this section's evidence; do not quote its `+0.094…+0.165 %` floor or its 80.2 % figure.**
>
> ⚠ **The decision itself is still un-made and is inherited by `docs/PHASE13.md`** — but it must be
> **re-posed** against the exact objective before it is answered, not answered as written. And the
> instrument it names is doubly unusable: `tools/ripple-audit.mjs` **fails two of its own
> pre-registered self-checks** (P3, P5 — archive/11 §8.30), so no ripple decomposition was quotable
> even on the round this section was written about.
>
> ⚠ **Debt §3.7 depends on this section and inherits the same void** — see its row in §3.
>
> ★ **What survives:** the *trade-off framing* in the table below — a hard-zero bar carries information
> only if it is reachable, and a tolerance in the criterion is what Phase 7 deliberately removed. That
> tension is real and is what a future ruling has to resolve. Only the physics under it changed.
>
> *The section as written, kept because the archive is append-only:*

**Moved here 07-27 from `docs/ACCEPTANCE.md`'s "Known coverage gaps" list, where it had sat as an
un-owned "user call and is NOT being made unilaterally" — a decision with nobody's name on it.** The
evidence is complete; only the ruling is missing.

**The question.** ACCEPTANCE's bar is *zero* invariant-B deficits. But the metric has a
**positive-biased resolution floor**: the sim counts integer casts under the kill taper while the model
integrates the continuum limit, leaving a `1 − W/c` sawtooth (RULES §8, `tools/lattice-ripple.mjs`).
`diagWorst` takes a `max` over ~10 rival rows of that two-signed quantity, so **its expectation is
positive for a flawless model** — `+0.094…+0.165%` at R=10 on an 81-cast fight. So `diagWorst = 0` is
**not reachable by construction** on short/low-haste tables, which is exactly where the residual
deficits live.

**Should the criterion become "deficit below the ripple floor for the table's tail rate"?**

| answer | what it buys | what it costs |
|---|---|---|
| **restate** | the bar becomes *achievable*; work stops chasing cells under the ruler (gear A: **80.2%** of determinate columns were inside the floor) | a tolerance enters the criterion, which Phase 7's amendment deliberately removed ("the guarantee is BY CONSTRUCTION, not a tolerance") |
| **keep "zero"** | the criterion stays a hard invariant | the test can never pass on short/low-haste tables *even if the model is perfect*, so "NOT PASSING" stops carrying information |

⚠ **The tempting third option is a trap and is already ruled out:** widening the taper toward the tail
cast period would shrink the floor, but `KILL_WINDOW` **is** the half-cast hedge of RULES §8 — it is
part of the objective, not part of the ruler. Do not fix the instrument by moving the goal.

⚠ **Do not decide this off gear-A numbers.** The 80.2% figure and the floor/deficit medians
(0.134% vs 0.035%) are gear A. `tools/ripple-audit.mjs` reprices the whole corpus arithmetically with
**no sim run**, so the gear-B version of this table is one command once the round lands — get it first.

---

## 2. WHAT GEAR B (and the 07-26 instrument) REVEALED THAT GEAR A HID

### 2.1 ★ The website's benchmark sim was scoring most of a plan as ZERO — and the tiles hid it

**How it surfaced.** The user screenshotted the live page: the *tile* read **`vs mashing +1.6%`**
while the *sim panel* under it read **`Model plan wins by +0.43%`** — the model and its own verifier
disagreeing by 3.8× on the same pair.

**Diagnosed by bisecting the character, not the model** (`--var 0.5`, 10k iters, seed 11, the
1:40 / Lust 0:07 / 1387 SP / 38% crit / isc+scb setup the user quoted):

```
screenshot                         model 1760.3  mash 1752.7  delta +0.43%

HEAD (trinkets on, lust on)        model 2099.4  mash 2062.4  delta 1.79%
trinkets STRIPPED, lust on         model 1970.8  mash 1948.9  delta 1.13%
trinkets on, lust OFF              model 1867.7  mash 1855.0  delta 0.69%
trinkets STRIPPED, lust OFF        model 1760.3  mash 1752.7  delta 0.43%   ← exact on all three
```

The screenshot is the **pre-PHASE10-§8.7 benchmark mage**, where the Icon press, the Gem press *and*
the Bloodlust press were each bit-identical no-ops. The sim could not see most of what the plan was
doing, so it scored the plan against mash as very nearly a tie. **PHASE10 §8.7 already fixed this on
this branch** — at HEAD the same setup reads model **+1.63%** vs sim **+1.79%**, which agree.

**The lasting lesson, and it is not "we fixed a bug".** A silent no-op does not read as an error; it
reads as *a small honest number*. The 0.43% looked exactly like a modest model-over-confidence
finding — which is the shape of the entire B2 investigation. Two guards now exist against it
(`planspec.mjs`'s `REQUIRES_EQUIPPED` refusing an unworn press, and `UNTRANSCRIBABLE` reporting
drops), and both postdate the gear-A corpus.

⚠ **Open question this raises about the archived corpus, worth one hour before trusting any gear-A
figure again:** the gear-A rounds ran before `REQUIRES_EQUIPPED` existed. Kits naming `skull` or
`mqg` against a two-slot character are exactly the configuration where a press silently does nothing.
Whether any gear-A table pressed an unworn trinket is *checkable* — the archived tables carry their
kits — and nobody has checked. If some did, the affected gear-A deficits were measured against a plan
the sim never actually executed.

### 2.1b ★★ THE NATIVE RUNNER IS ~6× FASTER THAN THE SHIPPED WASM — measured, and it changes the plan

**Raised by the user:** *"Can't we clone the wowsims repo (or the parts we need) and run the
simulations locally? Wouldn't that be bajillion times quicker? More under our control?"*

**First, a clarification the docs should make louder: the sim ALREADY runs locally.** `sim/sim.wasm`
executes in-process — no network, no service, nothing remote. So the question is not local-vs-remote,
it is **native Go binary vs WebAssembly**. That one has a real answer:

```
iters   wasm(ms)  native(ms)  speedup   wasmDPS    nativeDPS   |delta|
10000       4882         787     6.20x    2099.38     2099.40    0.0183
40000      16574        2885     5.74x    2099.25     2099.20    0.0478
```

Same spec, same protocol, same seed; the native runner is `runner-ap180` built from `tbc-new` at the
pinned `ade9f39cc`. **~6× faster, and it agrees to 0.02–0.05 DPS** — inside the 0.05 tolerance
`tests/sim-duel.mjs` already uses to assert wasm ≡ native.

**Why this was not already the default, and why that reasoning is still right.** The wasm was chosen
for *zero setup* (PHASE10 §1.3, BENCH §5's standing requirement: "a fresh container must be able to
produce a number from the repo alone") and because it is **what the page runs** — so an agent's
finding and a user's finding are the same measurement. Both remain true and neither is negotiable.

**So the answer is BOTH, with the equality gate as the bridge — not a replacement:**

| use | engine | why |
|---|---|---|
| the website button | **wasm** | it is the browser; nothing else can run there |
| any single check, any fresh container, CI | **wasm** | zero setup beats 6× on a 10 s job |
| **bulk corpus gathering** (a 36-table round) | **native runner** | 6× on the sim half is hours |
| proving they are interchangeable | `tests/sim-duel.mjs` with `RUNNER` | already asserts equality to the printed decimal |

⚠ **Scope the win honestly: it is 6× on the SIM half only.** A round's cost splits between *solving*
(the planner, in node — untouched by this) and *simming*. The boss half was ~29 of ~38 CPU-hours in
**pre-solves**, so those cells barely move; class cells are sim-heavier and move a lot. Do not budget
a re-gather at "50 → 8 hours".

**Directly actionable for the gear-agnostic re-gather (§1.1).** That round has to be gathered anyway;
gathering it on the native runner is the cheapest version of it. The toolchain is not hypothetical
here — Go 1.24.7 and protoc are installed, `tbc-new` is cloned at the pin, and `runner-ap180` is
**already built**. ⚠ But it lives in `/tmp/wowsims-build/`, so it dies with the container: treat the
~4-minute rebuild (BENCH §3d) as part of round setup, not as a thing that exists.

**Bonus, banked while measuring this:** with `RUNNER` set, `tests/sim-request.mjs` runs **9/9** —
including the two halves that skip without it, and both template-freshness checks. The full
anti-drift gate is green at HEAD.

### 2.2 The page and the terminal are the same mechanism — now MEASURED, not argued

Driving the page's own arm-A path in Chromium (over http; `file://` blocks both the module imports
and the Worker) against `tools/bench.mjs --char model-ref` on one setup:

```
page      spec {"_prestack":0,"Icon":[8],"BL":[7],"AP":[8],"Gem":[8],"Zerk":[28],"IV":[8,39],"CS":[39]}
          protocol {iterations:10000, seed:11, variation:0.5}     arm-A DPS 2099.381726802044
terminal  same spec, same protocol                                arm-A DPS 2099.4
```

**Why this is worth keeping (see §4.1):** `tests/sim-request.mjs` §1+§2 — the page-vs-terminal
request comparison — **SKIPS without a native `RUNNER`**. So on a bare container (and in any CI that
does not build Go) the strongest standing claim in `sim/README.md` is *unexercised*. The probe above
closes that gap using only the committed wasm.

---

## 3. DEBTS CREATED OR LEFT OPEN TONIGHT

| # | debt | state |
|---|---|---|
| 3.1 | Corpus character is the geared export, not gear-agnostic | **user call — §1.1** |
| 3.2 | Did any gear-A table press an unworn trinket? | **unchecked** — §2.1 |
| 3.3 | `tests/sim-request.mjs` §1+§2 unexercised without a native runner | probe exists (§2.2); promote per §4.1 |
| 3.4 | `RULES.md` figures are gear-A; banner added, **none re-measured** | banner landed 07-26 |
| 3.5 | §12 crossover thresholds (`~264`, `~139`, `~77`) are haste/SP functions | most likely to have moved; re-derive first |
| 3.6 | The two SIMLOG log-walking instruments exist only as prose + dead scratchpad paths | **CLOSED 07-27** — promoted to `tools/press-verify.mjs` and `tools/duel-walk.mjs`; see §3.6 note |
| 3.7 | ~~Interior-wall contribution to the ripple floor is unpriced at any boss length/kit but the one measured~~ ⛔ **VOID AS POSED — it inherits §1.3's dead premises.** There is no `1 − W/c` sawtooth to price the interior walls' contribution *to*: the model no longer integrates a continuum limit and `KILL_WINDOW` is gone (§6.10, §9). What is *not* void is the underlying observation — a boss fight has **seven** walls where the ripple floor priced only the tail one — but under the exact objective every wall is now a **cut** carrying its own deterministic boundary credit (§9), so the question is no longer "how much floor do interior walls add" but "does the credit at each cut match the sim, cast for cast". Re-pose before re-opening | ~~open~~ **void as posed**; re-pose in `docs/PHASE13.md` |
| 3.8 | **Ashtongue** (random on-crit proc) is outside every kit — needs a stochastic treatment | open, and **un-owned since Phase 7 closed without it**; RULES §14 folds it into passive haste, which is the *modelling* answer, not the *cross-val* one |

**§3.6 note.** `docs/TOOLING.md`'s "★★ DECOMPOSE A DUEL BY WALKING THE LOG" calls log-walking *the
cheapest instrument in the project* — and both implementations it pointed at (`$SP/p8/r6verify.mjs` for
presses, `$SP/aoewin/walk.mjs` for the aura-state decomposition) were **session scratchpad paths that no
longer exist anywhere**. The method descriptions and the log-format facts were written out in prose
beside them (the `[Player (#1)]` source prefix, Bloodlust having no `Casting` line, Cold Snap having no
aura, trinkets logging by ItemID, exact brace-group matching), so both were rebuilt from the doc rather
than lost. ★ Rebuilding the second one **found a flaw in the documented method** — the pooled ledger's
sampling assumption — and the tool now ships an exact paired ledger alongside it (DIARY 07-27).
⚠ **The general lesson for anything else filed as "the reference implementation is `$SP/…`": treat that
as UNIMPLEMENTED.** Two out of two such pointers were dead.

---

## 4. INSTRUMENTS THAT PROVED TOO COARSE (or absent)

### 4.1 `tests/sim-request.mjs` skips its two most important checks on a bare container
See §2.2. The page-vs-terminal equivalence is the claim `sim/README.md` rests on, and it is the one
a fresh container cannot check. **A wasm-only equivalence test belongs in `tests/`** and is the
natural first CI gate (goal step 7): it needs no Go toolchain, runs in ~10 s, and it is the only
gate that covers the page's *own* `opts` assembly at `index.html:4666`, which is not shared code.

### 4.2 `exact-match` is blind to the TRINKETS reorder by construction
Already recorded in `docs/archive/11-phase10-gearb-baseline.md` §9.3 and **not re-derived here** — but it belongs on this list
because it is the cleanest example of a green gate that is *not evidence*: `tests/exact-match.mjs:47`
declares its own `ALL_BUFFS` and never calls `applyState`, so the reorder's real blast radius
(`applyState`'s two-slot clamp at `index.html:5114`) is invisible to it. 25/25 is expected and proves
nothing about ordering.

---

## 5. CORRECTIONS TO BELIEFS HELD AT THE START OF THIS SESSION

- **"`/tmp/run-round.sh` and `/tmp/chain-bossshards.sh` drove a 50-CPU-hour round and exist in no
  repo."** — **False as of this session.** All three drivers are tracked and **byte-identical** to
  their `/tmp` copies: `tools/xval-round-pipeline.sh`, `tools/xval-boss-warm.sh`,
  `tools/xval-boss-presolve.sh`. The container-reclaim risk they represented is closed.
  ⚠ Residual: they carry a **hardcoded session-scratchpad `SP=` path**, so `xval-boss-warm.sh`'s
  wait-loop polls a log that a *future* session will never create and would hang forever. Fixed
  separately; noted here because "promoted" and "reproducible" are not the same property.

---

# §6 — MINING THE ROUND-1 CORPUS FOR THE MODEL'S FAILURE MODE (2026-07-27)

**User challenge, and it reframed the work:** *"all of this is ultimately supposed to lead to the
model itself improving… This massive testing ground is just supposed to give you data through which
you can browse and see where the model is failing."* Correct. A graded round is an input, not an
output. This section is what the 285 class columns say when interrogated as a dataset about the
scorer, rather than filed as a verdict.

**Instruments:** `tools/tail-phase-probe.mjs`, `tools/floor-overcap-probe.mjs`. Both read the
round's committed tables plus the plan cache (`.xval-cache/`, which stores the raw engine schedule
`{s}`), so they re-score with the **model only** — no sim, no re-optimization. ⚠ Both take
`--index` and **assert plan-cache HITS**, dying if any miss: the cache keys on `sha1(index.html)`,
which changed when PHASE11 §1.1's UI fixes landed, so probing must be pointed at the blob the round
used (`git show <pre-fix>:index.html`). A miss would silently probe a different engine's plans.

## 6.1 ~~⛔ THE TERMINAL-CAST FAMILY IS CLOSED — in BOTH its forms~~ ⚠ THE VERDICT IS WITHDRAWN

> # ⚠ THE CLOSURE VERDICT DOES NOT SURVIVE — IT WAS MEASURED WITH THE RETIRED ARBITER
>
> Everything in this section is scored against **`robust` as the rate integral**: the "tail-corrected"
> arm replaces the integral *only inside the kill window*, and P2/P3/P4 grade both arms by correlation
> with sim DPS. §6.8, written later the same day, established that **the integral disagreed with the
> model's own per-cast sum by a median 0.2114 % of score against ranking margins of ~0.005–0.07 %** —
> so the baseline this experiment measured its candidate against was **not single-valued at the scale
> of the effect**. §6.8's own summary says so explicitly: *"§6.1 (terminal-cast term, net −39) … all
> were terms tuned against a quantity that is not single-valued at the scale of the effect."*
>
> ⛔ **And the ground truth was equally compromised:** §6.9 measured that the referee fired **7.14 % of
> presses on a cast the model never chose**, with a further 25.2 % on a boundary decided by
> milliseconds of lattice drift. §6.11d states the consequence in as many words — *"a referee that
> mis-executes ~13 % of presses cannot resolve a margin of ~0.01 %."*
>
> ⇒ **Neither side of the P2/P4 comparison was trustworthy.** *"The terminal-cast family is closed"* is
> **unproven**, not established — the identical retraction §6.8 issued against §6.5a.
>
> ★ **The mechanism finding survives and is worth more than the verdict:** **P1 is emphatic** — the two
> accounts of the tail differ by a median **0.1490 %** of `robust`, ~7× the CRN resolution — and
> archive/11 §8.25 hand-counted the cast in two independent cells from SIMLOG. The phenomenon is real.
> What is unproven is whether the model's *predicted* tail phase is accurate enough to act on, because
> the timing errors that would have decided it were only found afterwards (§6.9, §6.14).
>
> ⚠ **Note the term is also partly MOOT, not merely unproven.** The whole construction was *"replace
> the integral inside `[T−KW, T+KW]`"*, and both the integral and `KILL_WINDOW` are retired (§6.10,
> §9). Under the exact objective the terminal cast is **already** priced deterministically, by the
> boundary credit. Re-opening this means re-posing it, not re-running it.
>
> ★ **The instrument defect recorded at the end of this section is DURABLE and is one of the phase's
> four self-blinding instruments** — the verdict line branched on `bestNet > 0` alone and printed ✅
> while the bar was `net > 0 AND broken ≤ 5 %`. Keep that lesson whatever happens to the verdict.
>
> *The section as written, kept because the archive is append-only:*

This was the standing **#1 model target**: archive/11 §8.23 diagnosed the worst persistent cell as
*one terminal cast the model cannot see*, §8.25 confirmed the mechanism is **shared** by the second
big column (176→177 and 233→234 casts, margins at ≈⅔ of the cast fraction in both), and §8.23 ended
*"design a term… that captures the terminal-cast effect **without** replacing the integral."*

**The structural fact that makes it look easy.** `simulate()` already carries two accounts of the
same fight: a **discrete board walk** (`casts`, `index.html:1086` — every cast, its start and its
damage) that scoring never reads, and the **continuous rate integral** (`:1248-1263`) that `robust`
is built from. In the interior the taper is 1 and cast phase is irrelevant; inside `[T−KW, T+KW]`
the taper is *changing*, so the integral credits the **expectation over a uniformly-random cast
phase** while a given plan's phase is **determined**. Replacing the integral **only inside that
window** is strictly weaker than the already-falsified full discretization.

**It was tested, pre-registered, on all 285 class columns. It fails.**

| prediction | result |
|---|---|
| **P1** mechanism present (accounts differ by >0.02 %) | **PASS** — median \|tailDiscrete − tailIntegral\| = **0.1490 %** of `robust`, ~7× the CRN resolution |
| **P2** predicts better (mean Pearson r vs sim DPS) | ⛔ **FAIL** — integral **0.9721** → tail-corrected **0.9026**; worse in **256/285** columns |
| **P3** repairs disagreements | 36/130 (27.7 %) |
| **P4 ★ FALSIFIER** must not break agreements | ⛔ **FIRES** — breaks **75/155 (48.4 %)**, ≈ a coin flip |
| net argmax | **−39** (36 repaired − 75 broken) |

**And the tie-break form fails too.** If the discrete tail is too noisy to *score* with, the weaker
claim is to use it only where the integral has no opinion — ACCEPTANCE's own *"where the model's
margin is below the ruler, the model has no opinion to be wrong about"*. Swept over ε:

```
 eps %   repaired/dis  broken/agree   net
 0.000      0/130         0/155       +0
 0.010     18/130        15/155       +3     <- best
 0.020     21/130        21/155       +0
 0.050     28/130        33/155       -5
 0.100     30/130        50/155      -20
 1.000     36/130        75/155      -39
```

Best net is **+3 over 285 columns** — indistinguishable from zero — and at that ε it still breaks
**9.7 %** of agreements against a pre-registered bar of ≤5 %. **P6's bar is met at no ε.**

⚠ **A defect in my own instrument, recorded because it is this repo's signature failure shape.** The
first verdict line branched on `bestNet > 0` alone and printed **✅ P6**, while P6's bar was
`net > 0 **AND** broken ≤ 5 %`. The sweep's own `✓` column was empty on every row — the tool had the
right answer in its table and the wrong one in its summary. Fixed; the verdict now grades the whole
bar. *(Sibling of archive/11 §8.30's `mono=0`: the summary line disagreeing with the detail above it.)*

★★ **CONSEQUENCE, and it is the most useful thing this session produced: the model's tail PHASE is
unusable at any threshold.** The phenomenon is real — P1 is emphatic, and §8.25 hand-counted the cast
in two independent cells — but the model's *predicted* phase is not accurate enough to act on. Its
board walk blends cast times by proc probability and cannot know the sim's realized lattice. **So the
whole "make the objective see the terminal cast" family is closed**, and §8.23's ☞ next step should
not be attempted again in either form. What is NOT closed: a term that makes the objective *hedge*
against tail phase rather than *predict* it (prefer layouts whose value does not hinge on which side
of the kill edge a cast lands). That is a different hypothesis and has not been tested.

## 6.2 ★★★ THE "LOW-HASTE BASIN" DIRECTIONAL FRAMING IS WRONG — the confound inverts it

The deficits are **directional**: across 112 class deficit columns the sim prefers a plan built for
**higher** haste in 74 (66.1 %, z = 3.40). Split by haste that looked decisive — `simH≤70` gave
33 higher vs 11 lower, **z = 3.32** — which reads as textbook confirmation of the low-haste basin.

⛔ **It is an artifact of grid position, and controlling for it REVERSES the picture.** At the lowest
haste in a kit's grid *every* rival is higher, so "borrows from higher" is partly forced. Against the
correct null — a borrowed win comes from a uniformly random rival, so
`E[higher] = (#higher rivals)/(#rivals)` per column:

| bucket | n | observed higher | expected | z |
|---|---|---|---|---|
| all | 112 | 74 | 61.5 | **+2.85** (significant) |
| `simH ≤ 70` | 44 | 33 | 36.5 | **−1.44** ← the effect *vanishes*, and if anything inverts |
| `70 < simH ≤ 200` | 34 | 22 | 17.1 | +1.72 |
| **`simH > 200`** | 34 | **19** | **7.9** | **+4.78 ★** |

★ **The directional excess lives at HIGH haste, not low.** This does not contradict the persistence
work list — those cells (`isc-mqg h40`, `isc-skull h20`) genuinely are low-haste. It says the docs
have been **conflating two different facts**: *where the length-persistent cells are* (low haste) and
*where the model's ranking is systematically biased* (high haste, `simH > 200`). Only the first has
ever been measured before, and the debt was named after it.

⇒ **The "low-haste (≤70) micro-placement slack" is now misnamed a THIRD time** (archive/11 §8.31
already renamed it twice: a third persistent column sits mid-grid at h130, and the family splits into
two terminal-cast columns plus one value column). Whatever the debt is, *"low-haste"* is not a
property it reliably has.

## 6.3 ⚠ GCD-FLOOR OVERCAP — a lead with the right sign, NOT established

The obvious mechanism for a high-haste directional bias: at `simH > 200` the GCD floor binds, so a
plan built for even higher haste spreads its haste buffs instead of stacking them. Hypothesis: **the
model buys haste the floor eats and does not charge itself for it.** Measured with `gcdCappedTime`
(which `simulate()` already returns), pre-registered, native-vs-the-sim's-pick:

| | n | mean Δ`gcdCapped` (native − borrowed) | t |
|---|---|---|---|
| **P1** all disagreement columns | 160 | **+1.175 s** | 1.71 |
| **P2** `simH ≤ 70` | 59 | +0.542 s | 0.60 |
| **P2** `70 < simH ≤ 200` | 55 | +0.818 s | 0.81 |
| **P2** `simH > 200` | 46 | **+2.413 s** | 1.41 |

**The sign is right and the concentration is where §6.2 predicts — and nothing reaches significance.**
P1 misses (1.71 < 2), P2 misses (1.41 < 2). Welch contrast against a matched control gives
`simH > 200`: Δ = +4.210 s, **t = 1.88** — still short.

⚠ **The one significant cell is unpredicted, opposite-signed, and does not survive multiplicity:**
`simH ≤ 70` contrast Δ = −4.374 s, t = −2.21. Four buckets at α = 0.05 expect ~0.2 false positives;
Bonferroni needs |t| > 2.5. **Do not report it as a finding.**

⚠ **And the first control was VACUOUS** — the same defect as PHASE8 §21.5's F3. It compared
`gcdCapped(native) − gcdCapped(sim's pick)` on **agreement** columns, where native *is* the sim's
pick, so it read exactly `0.000, t=NaN` **by construction**. Replaced with native vs the sim's
**second**-ranked plan, so both arms are "native vs a plan the sim ranked below it".

⇒ **Verdict: underpowered, not falsified.** The corpus has 46 high-haste disagreement columns and the
effect needs roughly 4× that for |t| > 2. Two ways forward, in cost order: (a) extend the haste grids
upward on the kits that already reach 400 — cheap, and it targets exactly the bucket carrying the
signal; (b) a targeted duel on the largest `Δ gcdCapped` cells. **Do not build a floor-charge term on
this evidence.**

## 6.4 What a future session should take from §6

> ⛔ **ITEMS 1–3 ARE WITHDRAWN — every one of them is a measurement taken through the retired arbiter.**
> All three were computed with `robust` = the rate integral, against a sim referee that mis-fired ~13 %
> of its presses (§6.8, §6.9, §6.11d). ⚠ **Item 1 is the one that matters, because it is an
> INSTRUCTION**: *"do not re-attempt the terminal-cast term"* now rests on a falsified premise, and a
> future session must not treat it as a standing prohibition. The honest statement is *"untested against
> the exact objective, and probably moot — the boundary credit already prices the terminal cast
> deterministically (§9)."* Item 2's directional finding and item 3's power calculation are likewise
> un-replicated: they would have to be re-derived from a re-gathered corpus, which does not exist.
> **Item 4 stands, unqualified, and is the section's real payload.**
>
> *The list as written, kept because the archive is append-only:*

1. ~~**Do not re-attempt the terminal-cast term.** Closed in both forms, on 285 columns, with the
   falsifier firing at ~2× the repair rate (§6.1).~~ ⛔ withdrawn — see §6.1's banner.
2. ~~**Do not trust "low-haste" as the debt's name.** The directional bias is at `simH > 200` (§6.2).~~
   ⛔ withdrawn as a *measurement*; the naming caution itself is harmless and archive/11 §8.31 reached
   it independently.
3. ~~**The next measurement is more high-haste columns, not another term** (§6.3).~~ ⛔ withdrawn — the
   underpowered effect it would extend was measured against the retired arbiter.
4. ★ **The general lesson, and it cost two probes in one session to learn twice:** every one of these
   findings changed sign or died under a control — grid position inverted §6.2, a vacuous control hid
   §6.3's real null, and my own summary line contradicted my own sweep table in §6.1. **The corpus is
   large enough that a plausible pattern is always available; only the control decides.**

## 6.5 ★★★ THE REAL DEFECT IS CAST-TIMING FIDELITY — the model does not know where its casts are

**User challenge, and it is the one that cracked this open:** *"if a different output of the model
squeezes in an extra cast at the same h=0, isn't that model better? Shouldn't that be the case in our
'effective casts'?"* — plus the reminder that **wowsims offers logs** and they are a debugging tool.
Following both produced the session's most important result and **corrected a claim of my own.**

### The search is exonerated, definitively

`tools/deficit-fix.mjs` separates *(A) search miss vs the true optimum* from *(B) scorer
mis-ranking* — a distinction nobody had tested, because "B1 holds by construction" only guarantees
the argmax over the **champion set**, not global optimality. On the 4 worst class columns, at **3×**
the round's restart count:

```
isc+mqg  medlong @40   deep(42) gain +0.0000%   determinism OK   B: converged
isc+skull short  @40   deep(42) gain +0.0000%   determinism OK   B: converged
isc+skull long   @130  deep(42) gain -0.0028%   determinism OK   B: converged
isc+scb  short   @165  deep(42) gain +0.0000%   determinism OK   B: converged
```

**0/4 search misses.** Identical to four decimals; one column is slightly *worse* with more restarts,
which is what a converged search on a rugged landscape looks like. ⇒ **These are scorer
mis-rankings and nothing else.** The (A) loophole is closed.

### ⚠ CORRECTION TO MY OWN CLAIM, EARLIER THE SAME SESSION

Answering the h=0 question I printed the **model's** board-walk cast count for
`isc+scb long T=300 @h0` — 216 for `plan@0` vs 217 for `plan@20` — and presented it as the
terminal-cast mechanism. **That was the wrong source.** Run against the sim's own log
(`tools/cast-fidelity.mjs`, native runner, `SIMLOG=1`, 1 iteration, seed 11, `--var 0`; the shipped
export already wears Icon + Serpent-Coil, and **both are SP trinkets so neither perturbs cast
timing**):

| | model board | **wowsims log** | |
|---|---|---|---|
| `plan@0` | 216 | **217** | the model **undercounts by one** |
| `plan@20` | 217 | **217** | correct |

**The sim casts 217 in BOTH arms — the counts are equal** — and it still prefers `plan@20` by
0.1235 %. So this cell is **not** a terminal-cast cell at all; it is a cast-**value** difference. The
model's "+1 for the rival" was an artifact of its own timing error.
*(§8.25's counts are unaffected — those were taken from SIMLOG. Mine were not.)*

### The measurement underneath it

| plan | mean \|sim − model\| cast-start drift | max |
|---|---|---|
| `plan@0` | **0.362 s** | **0.963 s** |
| `plan@20` (equal counts ⇒ cleanly aligned, no insertion skew) | **0.206 s** | 0.253 s |

**The model's cast stream is offset from the sim's by ~0.2–0.36 s on average and by up to 0.963 s —
nearly a whole GCD.** The `plan@20` row is the trustworthy one: equal counts mean index-to-index
alignment is exact, so its 0.206 s mean is a *systematic offset*, not comparison noise.

★★★ **That single number explains every negative result in §6.1–§6.3 at once:**

- **§6.1** — the tail-phase correction breaks 48 % of the columns it touches because it tapers casts
  placed at the wrong *times*. Tapering is exquisitely time-sensitive; the input is ±0.2–0.96 s.
- **6.5a below** — the fully-discrete "counted" objective ranks worse than the integral because it is
  counting a **drifted** stream.
- **The dead ties themselves** — the integral is, in effect, doing *variance reduction on the model's
  own timing error*. It scores worse than a cast sum would on a perfect stream, and better than one on
  this stream. That is why it wins on aggregate while losing on individual cells.

### 6.5a The documented objective, implemented literally, is a WORSE ranker

CLAUDE.md and MECHANICS §4 define the objective as **a sum over casts** of each cast's multiplier.
`simulate()` implements a **rate integral**. Scored apples-to-apples — same kill-window taper on both,
so the only difference is discrete-vs-continuous — over all 285 class columns
(`tools/counted-vs-integrated.mjs`):

| account | mean Pearson r vs sim DPS | argmax |
|---|---|---|
| **INTEGRATED** (`robust`, what ranks today) | **0.9721** | — |
| **COUNTED** (the documented objective) | **0.9279** | repairs 39/130, **breaks 60/155**, net **−21** |

Worse in **235 of 285** columns. ⇒ **the implementation deviates from the stated objective, and the
deviation is an improvement** — but only *because the cast stream is inaccurate*. This is not evidence
that the documented objective is wrong; it is evidence that it cannot be computed yet.

### ⇒ THE TARGET, and it is the first one today that is not already falsified

**Reduce cast-timing drift against SIMLOG.** Not a new scorer term — every scorer term tried this
session failed, and §6.5 says why: they are all built on a stream that is up to a GCD out of place.
Get the drift under ~0.05 s and the discrete effective-ABs count becomes computable **as documented**,
which closes the family properly instead of patching around it.

It is also the first target with an **obvious, cheap, sim-free-to-iterate gate**: per-cast start drift
vs a SIMLOG capture, which `tools/cast-fidelity.mjs` already measures. Candidate sources to bisect,
none yet tested: press-time snapping, the discrete ramp's cast lengths, GCD/latency rounding, and how
buff windows are anchored relative to cast boundaries.

⚠ **Do not assume it is one cause.** `plan@0` drifts 0.362 s and `plan@20` 0.206 s on the *same fight
and the same character* — so at least part of it is plan-dependent, which a single global offset
correction would not fix.

## 6.6 ★★★ THE DRIFT IS DIAGNOSED — every press is scored ~1.0–1.5 s EARLIER than it can happen

> ## ⛔ THE MECHANISM §6.6 AND §6.7 INFER IS FALSIFIED — read §6.9a before acting on either
> Both sections conclude with the same empirical rule: *"the sim's buff starts at the first cast
> boundary **strictly after** the press."* **The observations are correct and the rule is the right
> consequence; the cause is wrong**, and §6.9a falsified it by direct measurement:
> - `APLActionSchedule.IsReady` is **`sim.CurrentTime >= timings[i]`** — a `>=`, not a `>`
>   (`sim/core/apl_actions_timing.go:155`). There is no strictness to exploit.
> - A schedule value **1 ns below** the boundary's own truncated value *also* fires a full cast late
>   (`tools/press-ns-probe.mjs`), which no float-truncation story explains either.
>
> **The real cause is a LATTICE MISMATCH:** wowsims takes **334 ms** per Arcane Blast stack where the
> model took **1/3 s**, and rounds every cast to the millisecond — so the boundary a combat log prints
> as `11.00` is really **`10.998`**, and `10.998 >= 11.000` is honestly false. The log prints two
> decimals, which is why the 2 ms was invisible to every reader of these two sections.
>
> ⚠ **Why the distinction is load-bearing rather than pedantic:** a fix built on "strictly after" —
> shave an epsilon, subtract a nanosecond — bets on the **sign of a rounding error**, and that sign
> **flips with haste** (`tools/lattice-drift.mjs`: +0.080 s at h=80, −0.061 s at h=300). It would have
> worked at one haste and silently failed at another. The fix that shipped instead clamps the schedule
> value into `[prevBoundary + SLACK, targetBoundary − SLACK]` (§6.9c), and the constant itself was
> corrected in §6.14.
>
> ★ **Everything measured in these two sections stands** — the bare cast stream being exact, the
> per-cooldown drift table, the uniform +1 s window translation, the off-GCD-behaves-like-on-GCD test
> that correctly picked "transcription artifact" over "model defect", and §6.7's ☞ three next
> measurements (all three were done). Only the *why* changed.

**User challenge:** *"why is there a drift? Isn't it just deterministic math and additions of cast
times? We can calculate the cast time at any haste level, deterministically, based on stacks and
haste."* **Exactly right — and that is what made the bisect possible.** The answer is that the
arithmetic is correct and is being evaluated at **a time the press can never occur**.

### Step 1 — the bare cast stream is EXACT (so the ramp/GCD/stack model is not the problem)

`tools/drift-bisect.mjs`, no cooldowns at all, 60 s:

| | model | sim | drift |
|---|---|---|---|
| h=0 | 39 casts, intervals `2.500 2.167 1.833 1.500 1.500…` | 39 casts, `2.500 2.170 1.830 1.500…` | mean **0.0001 s** |
| h=200 | 44 casts | 44 casts | mean **0.0050 s** |

Residual is the log's own 2–3 dp printing. **The opening ramp and the steady interval are exact.**

### Step 2 — three cooldowns are exact, two drift, and both diverge at EXPIRY

One cooldown at a time, pressed at t=10, h=0:

| cooldown | mean drift | max | first divergence |
|---|---|---|---|
| Icy Veins · Arcane Power · Icon | **0.0001 s** | 0.0033 s | none |
| **Bloodlust** (40 s) | 0.0455 s | **0.3408 s** | cast 41, `t≈51.7` — i.e. at the buff's END |
| **Berserking** (10 s) | 0.0886 s | 0.1355 s | cast 14, `t≈21.9` — likewise |

### Step 3 — the cause: a UNIFORM +1 s window offset

| | model window | sim window | offset |
|---|---|---|---|
| Berserking (10 s) | [10.000, 20.000] | [11.000, 21.000] | **+1.000 s** on BOTH edges |
| Bloodlust (40 s) | [10.000, 50.000] | [11.000, 51.000] | **+1.000 s** |
| Icy Veins (20 s) | [10.000, 30.000] | [11.000, 31.000] | **+1.000 s** |

Durations match exactly; the whole window is translated. IV/AP/Icon show no *cast* drift only because
their shifted window happened to contain the same casts — the offset is there for them too.

### Step 4 — the rule, from a press-position sweep (`tools/press-offset-probe.mjs`)

Boundaries at h=0 are `… 9.5, 11.0, 12.5, 14.0`:

```
press 9.6  -> model actEff 9.600   sim aura 11.000   offset 1.400s
press 10   -> model actEff 10.000  sim aura 11.000   offset 1.000s
press 11.0 -> model actEff 11.000  sim aura 12.500   offset 1.500s   <- ON a boundary, still a full cast late
press 11.1 -> model actEff 11.100  sim aura 12.500   offset 1.400s
press 12.5 -> model actEff 12.500  sim aura 14.000   offset 1.500s
```

⇒ ~~**the sim's buff starts at the first cast boundary STRICTLY AFTER the press**~~ ⛔ **wrong cause —
`IsReady` is `>=`; it is a 2 ms lattice mismatch, §6.9a**; **the model uses the raw
press time verbatim.** Every cooldown window the model scores therefore begins **1.0–1.5 s earlier
than achievable at h=0**, and the size of the error depends on where the press falls in the cast
lattice — which is precisely why the drift is **plan-dependent** (§6.5: 0.362 s vs 0.206 s on the same
fight and character).

★★ **This subsumes §6.5 and probably §6.1–§6.3.** It is not noise and not a modelling approximation —
it is a systematic, deterministic, per-press bias in the direction of *optimism*, inherited by every
score, every comparison and every deficit column in the corpus.

### ⚠ WHAT IS NOT YET SETTLED, AND IT HAS TWO OPPOSITE FIXES

Press at **exactly** 11.0 → aura at 12.5 is a **full extra cast**, not merely "finish the cast in
progress". Two readings, not separated:

- **(i) MODEL DEFECT.** Real presses cannot land mid-cast for GCD abilities, so the model should
  **snap press fire times to the cast lattice**. Fix lives in `simulate()`/`actEff`, and it would
  change plans (so: `exact-match`, `plan-diff`, and a duel at every moved cell).
- **(ii) TRANSCRIPTION ARTIFACT.** On-use trinkets are **off-GCD** and usable mid-cast in real play;
  if `genapl`'s APL structure defers a press by a whole cast that the game would not, the *sim* is
  the pessimistic one and the fix is in the APL, not the model.

**Separating them is the next measurement**, and it is cheap: compare a GCD ability (Berserking, Icy
Veins) against an off-GCD on-use trinket (Icon, MQG) in the same sweep. If the trinket also waits a
full cast, that is an APL artifact; if it fires mid-cast, the model is wrong for GCD abilities only.
⛔ **Do not "fix" either side before that test** — a snap applied on top of an APL artifact would
double-count the delay.

## 6.7 ⚠⚠ THE OFFSET IS A HARNESS ARTIFACT, NOT A MODEL DEFECT — and it may implicate the whole corpus

> ⛔ **VERDICT RIGHT, MECHANISM WRONG — see §6.6's banner and §6.9a.** "Transcription artifact, not
> model defect" is **correct** and the separating test that establishes it is sound. But the *"wowsims'
> `schedule` action fires at the first evaluation **strictly after** the scheduled time"* rule below is
> falsified: `IsReady` is `>=`, and the real cause is that the sim's boundary sits **2 ms earlier than
> the log prints it**, because wowsims takes 334 ms per Arcane Blast stack where the model took 1/3 s.
> ⚠ **The derived instruction is therefore also wrong:** *"to land a press ON boundary `B`, the
> schedule value must lie in `[prevBoundary(B), B)`"* would have you shave an epsilon — and the sign of
> the error it is compensating **flips with haste**. What shipped clamps into
> `[prevBoundary + SLACK, targetBoundary − SLACK]`, both edges (§6.9c).
> ★ **§6.7's ☞ three next measurements were all carried out**: (1) the exposure count → §6.9b, 7.14 %
> mis-fired plus 25.2 % fragile; (2) the transcription fix + re-duel → §6.9c, 7.14 % → 0.00 %;
> (3) the missing gate → `tests/press-fire.mjs`, §6.9e. And §6.7's ★ closing lesson — *four scorer
> terms were designed and falsified before anyone checked whether the presses fired when asked* — is
> the phase's most reusable sentence.

§6.6 left two readings with opposite fixes. **The separating test is done and it picks the second.**

**The test:** compare an ON-GCD ability against an OFF-GCD on-use trinket. An on-use trinket is
usable mid-cast in real play, so if it *also* waits a full cast the delay cannot be game mechanics.

```
Zerk  ON-GCD    press 10 -> aura 11.000 (+1.000)   |   press 11 -> aura 12.500 (+1.500)
IV    ON-GCD    press 10 -> aura 11.000 (+1.000)   |   press 11 -> aura 12.500 (+1.500)
Icon  OFF-GCD   press 10 -> aura 11.000 (+1.000)   |   press 11 -> aura 12.500 (+1.500)   <- IDENTICAL
```

**The off-GCD trinket behaves exactly like the GCD abilities.** ⇒ **transcription artifact.**

**And it is not a priority-list bug.** Every press is pushed *ahead* of the Arcane Blast action
(`tools/genapl-core.mjs:68-76`), Cold Snap first. The presses have top priority and still land late.

~~**The empirical rule:** wowsims' `schedule` action fires its inner action at the first APL evaluation
— i.e. the first cast boundary — **strictly after** the scheduled time.~~ ⛔ **FALSIFIED, §6.9a** — the
observations are right, the rule is not: `IsReady` is `>=` and the sim's boundary is 2 ms earlier than
the log prints. Boundaries at h=0 are `… 9.5, 11.0, 12.5` *as printed*:

```
schedule 9.6  -> fires 11.000     schedule 10 -> fires 11.000     schedule 11.0 -> fires 12.500
```

~~So to land a press ON boundary `B`, the schedule value must lie in `[prevBoundary(B), B)`~~ ⛔ **do
not implement this** — it compensates a rounding error whose sign flips with haste. The shipped rule
clamps into `[prevBoundary + SLACK, targetBoundary − SLACK]`, `SLACK = min(0.5 s, interval/2)`, both
edges (§6.9c). It remains true that **a value exactly equal to `B` overshoots by a full cast.**

### ⚠ Why this may implicate the corpus, and why that is NOT yet a claim

`sim/planspec.mjs` transcribes press times as **`Math.floor(actEff)`** — integer seconds. Flooring
usually moves a press *earlier*, which lands it correctly. **But when `actEff` is already an integer
that happens to be a cast boundary, flooring is a no-op and the press fires a full cast late.** How
often that occurs across the corpus is **unmeasured**, and it is the first thing to measure.

⛔ **What must NOT be concluded yet.** It is tempting to read this as *"the deficits are a harness
artifact, the model was right all along"*. That is **not established**, for three reasons:
1. The offset applies to **both arms** of every duel, so it substantially cancels; what survives is
   only the *plan-dependent* residue (§6.5: 0.362 s vs 0.206 s on the same fight).
2. The corpus's `artifact=0` guard passes on every table — it checks a different failure mode
   (`EMIT` convention), so it neither confirms nor refutes this.
3. `tests/sim-request.mjs` asserts the *request* is well-formed, not that a scheduled press fires
   when asked. **No gate in this repo covers press-fire timing** — which is exactly why it survived
   this long.

### ☞ The next three measurements, in order and all cheap

1. **Count the exposure.** Over the round's 345 plan rows, how many transcribed press times land on a
   cast boundary (⇒ a full-cast overshoot) versus strictly inside an interval (⇒ correct)? Pure
   arithmetic on data already committed — no sim.
2. **Fix the transcription and re-duel one cell.** Schedule at `actEff − ε` (or the interval's lower
   edge) so the press fires when intended, then re-run the worst deficit column. If the deficit moves
   materially, the corpus needs re-gathering; if it does not, the artifact is real but immaterial.
3. **Add the missing gate.** `press-verify.mjs` already walks a SIMLOG for press events; extend it to
   assert *fire time == intended time* and wire it into `tests/`, so this class cannot return.

★ **The lesson, and it is the project's own rule arriving from a new direction:** *"when a clean
cast-count and a sim number disagree with no blind spot in play, that is a SIM-SETUP AUDIT TRIGGER,
not a model bug — the sim is rarely wrong, we have usually used it wrong."* Four scorer terms were
designed and falsified this session before anyone checked whether the presses fired when asked.

## 6.8 ★★★★ THE MODEL DISAGREES WITH ITSELF BY MORE THAN THE ENTIRE EFFECT WE ARE CHASING

**User, and it is the correct architectural read:** *"The model's evaluation HAS to be deterministic
and correct… For each individual Arcane blast we know the haste and stacks (i.e. the cast time), we
know if Arcane Power is active (×1.3), we know if any spellpower buffs are active (normalize what that
cast is worth vs unbuffed), we know the crit rate. The final number is the effective Arcane Blast
casts. The mistakes I can see is the search not finding the global optimum of that number — but the
math has to be solid."*

**The math is not solid.** `tools/self-consistency.mjs`, **2755 plan-scorings, NO SIM anywhere** — the
model scored against itself:

| quantity | value |
|---|---|
| `robust` (rate integral, what RANKS) − tapered discrete cast sum | median **+0.432** eff ABs · range **−0.757 … +1.656** |
| the same, as % of score | median **0.2114 %** · p90 **0.5646 %** · **max 1.4263 %** |
| the corpus's ENTIRE deficit range, for scale | **0.004 % – 0.380 %** |
| the model's OWN margins in the deficit columns | **~0.005 % – 0.07 %** |

★★★ **The model's disagreement with itself is ~3× the largest deficit in the corpus and ~30× the
margins it uses to rank plans.** And the gap is **not a constant offset** — it swings across 2.413
effective ABs — so it does **not** cancel when two plans are compared. **It IS the near-tie.**

`simulate()` computes the same fight two ways: a **discrete cast walk** (`casts`, `index.html:1086`)
that already carries exactly the per-cast information the user enumerates, and a **continuous rate
integral** (`:1248-1263`) that is what `robust` returns and what every ranking uses. The integral is
the *expectation over cast phase*; the cast walk is the *realized value for this plan*. **For ranking
two specific plans the realized value is the correct one**, and it is the one CLAUDE.md and
MECHANICS §4 define the objective to be.

### This retro-explains every negative result in §6.1–§6.5, and invalidates one of my own conclusions

- **§6.1** (terminal-cast term, net −39) · **§6.3** (floor overcap, t=1.71) · the tie-break (+3 of
  285): all were terms tuned against a quantity that is not single-valued at the scale of the effect.
- ⛔ **§6.5a is WITHDRAWN as evidence.** It concluded *"the documented objective, implemented
  literally, is a WORSE ranker (r 0.9279 vs 0.9721)"*. That comparison is void twice over: the two
  accounts differ by a median 0.21 % (this section), and the sim it was scored against fires every
  press 1.0–1.5 s late (§6.7). **Neither side of that comparison was trustworthy.** The claim that the
  integral beats the cast sum is **unproven**, not established.

### ⇒ THE ORDER OF WORK, and it is not what this session assumed

1. **Make the objective ONE thing.** Score the discrete per-cast sum — deterministic, exactly as the
   docs define it and as the user describes. The integral, if kept at all, is a search-smoothing
   device and must never be the arbiter. **Gate: `robust` == tapered cast sum to float precision.**
2. **Fix the harness press timing** (§6.7) so the sim is a valid reference again.
3. **Only then hunt search bugs** — *"the search not finding the global optimum of that number"* is
   the right bug class, and it becomes a well-posed question the moment the number is single-valued.
   ⚠ Note `tools/deficit-fix.mjs` already found **0/4 search misses at 3× restarts** — but that was
   the search optimising the *integral*. Against a corrected objective it must be re-run.

⚠ **Expect plans to move, and treat that as the point rather than as a regression.** Changing the
arbiter changes the argmax; `exact-match` goldens will need re-recording under the normal rule (only
after each changed plan is shown to improve the objective, sim-verified where a blind spot is in
play). This is the largest-blast-radius change the project has considered, and it is also the first
one aimed at the actual defect.

## 6.9 ✅ STEP 2 IS DONE — and the cause was NOT what §6.6/§6.7 recorded

**Landed 2026-07-27.** §0.3 step 2 ("fix the press-fire offset, add the missing gate") is closed. The
transcription defect it names is **measured at 7.14 % of presses and eliminated to 0.00 %**, gated, and
the *actual* mechanism is now known — it is not the one §6.6/§6.7 wrote down, and the difference is
load-bearing.

### 6.9a ⛔ "It fires at the first boundary STRICTLY AFTER" is the right consequence, wrong cause

§6.7 inferred a semantic rule from five press-position probes. Two mechanisms could produce it, and
**both are falsified by direct measurement**:

| candidate | verdict |
|---|---|
| the schedule action is genuinely strict | ⛔ **no** — `APLActionSchedule.IsReady` is `sim.CurrentTime >= timings[i]` (`sim/core/apl_actions_timing.go:155`) |
| a 1 ns float-truncation shortfall in `DurationFromSeconds` | ⛔ **no** — `tools/press-ns-probe.mjs`: a schedule 1 ns *below* the boundary's own truncated value **also** fires a full cast late |

**The real cause, bisected to 1e-7 s (`tools/press-threshold-probe.mjs`): the sim's cast boundary is
not where the combat log says it is.** The largest schedule value that still fires on the boundary the
log prints as `11.00` is **10.998** — the same 2 ms at every boundary, on-GCD and off-GCD alike:

```
  Zerk (on-GCD)   B=11.00   largest S firing on B = 10.998000   B-S = 0.002000
  Icon (off-GCD)  B=12.50   largest S firing on B = 12.498000   B-S = 0.002000
```

And 2 ms is exactly what the two cast-time models differ by:

```
  wowsims  sim/mage/arcane_charge.go:17   castTimeReduction := time.Millisecond * -334
  model    index.html GAME.AB             STACK_CAST_REDUCTION: 1/3        (333.333… ms)
```

wowsims also `.Round(time.Millisecond)`s every cast (`sim/core/cast.go:137-138`). The log confirms it
directly — `Cast Time = 2.166s / 1.832s / 1.498s`, never 2.167/1.833/1.5 — so the ramp ends
`2.500+2.166+1.832 = 6.498`, and every boundary after it carries that −2 ms forward. **The log prints
2 decimals, so `10.998` reads as `11.00` and the whole thing is invisible to a reader.** `IsReady` then
compares `10.998 >= 11.000`, fails honestly, and defers the press a full cast.

⇒ **It is a LATTICE MISMATCH, not a scheduling rule.** That matters because a fix built on "strictly
after" (shave an epsilon, or subtract a nanosecond) would be betting on the sign of a rounding error —
and the sign **flips with haste** (`tools/lattice-drift.mjs`: +0.080 s at h=80, −0.061 s at h=300).

### 6.9b The exposure, and it is not small

`tools/press-exposure.mjs` — 30 tables, 2755 plan-scorings, **32416 presses, no sim**:

| | |
|---|---|
| fired at the cast the model intended | 23761 · 73.3 % |
| fired at a **different** cast (floor overshot a boundary) | 496 · **1.5 %** |
| landed **on** a boundary — which cast got buffed decided by ~ms of drift | 8159 · **25.2 %** (FRAGILE) |

The retired convention was `Math.floor(actEff)`, justified in `planspec.mjs`'s own header as *"a press
at floor(F) ≤ F snaps to the same boundary"*. **That is false whenever F is not itself a boundary**,
and it lost casts in *both* directions: flooring `actEff 9.7` to `9` fires the press at the 9.5
boundary the model never buffed, a full cast early.

### 6.9c The fix, and the head-to-head that settles it

`sim/planspec.mjs` now emits a **schedule value**, not a press time: the model's fire time **clamped
into `[prevBoundary + SLACK, targetBoundary − SLACK]`**, with `SLACK = min(0.5 s, interval/2)`. Both
edges matter — the drift's sign flips with haste — and a press in a downtime gap sits near neither, so
it is still emitted verbatim. `planToSpec` now also returns `fire` (expected fire times) and `cast`
(the cast index each press must buff).

**`tools/press-headtohead.mjs`, 14 plans, 196 presses, real combat logs, both conventions on the same
cached plans:**

| convention | transcription failures | held | lattice |
|---|---|---|---|
| retired `floor(actEff)` | **14 · 7.14 %** | 12 | 4 |
| current schedule value | **0 · 0.00 %** | 18 | 8 |

★ **The engine block is byte-identical across this commit (`sha1 7c08324250500f61`), so no plan moved
and no golden was re-recorded.** Proven by hash, not asserted.

### 6.9d ⚠ THE RESIDUAL IS REAL, AND IT IS THE CAST-TIME CONSTANT

26 of 196 presses still do not land where the model scored them, and **none of them is a transcription
defect**. `tools/press-verify.mjs` splits them on a criterion it can check:

- **HELD** (18) — the schedule value *did* sit inside the right interval and the sim declined anyway.
  `APLActionSchedule.IsReady` also gates on `innerSpell.IsReady`, so a cooldown coming up just after
  the sim's boundary — while the model's grid puts that boundary on the *other* side of the expiry —
  defers the press a whole cast. Every one observed is a second, cooldown-chained use.
- **LATTICE** (8) — the two grids are more than **half an interval** apart at that press (measured
  0.626 s at `T=300 h=165 t≈245`, against a 1.09 s interval). Half an interval is the entire budget any
  schedule value has, because the value is derived from the model's grid. Past that line no rule works.

⇒ **Fixing `STACK_CAST_REDUCTION: 1/3` → 334 ms is the next commit**, and it is a MODEL change: it
moves cast times, so it moves the lattice, so it moves plans and goldens. It must not ride along with
either step 1 or step 2.

⚠ **A classifier warning worth keeping.** The first version of this split asked whether the model's
*fire time* was past the sim's boundary — true for any press near a boundary once the grids drift — and
it duly reported the retired convention's own 14 failures as unfixable. **A classifier that launders
the defect it was built to catch is worse than no classifier.** The criterion has to be about the
schedule value, which is the only thing this repo controls.

### 6.9e The gate that did not exist

`tests/press-fire.mjs`. **Part A** (no sim, no browser) asserts, per press on every shipped preset,
that the schedule value survives 0.30 s of lattice drift in either direction — a floor set by
measurement, deliberately below the 0.5 s planspec budgets so it is a contract and not a restatement.
**Part B** (needs `RUNNER`) grades real combat logs through `press-verify --cast` and **skips loudly**
without a runner, the `sim-request.mjs` contract. `tests/page-equiv.mjs` additionally now checks the
Debug export's private `planToSpecInline` against the module — the third copy of the transcription,
which drifted once before (PHASE11 §1.1 B1).

★ **`--cast` grades the CAST, not the clock.** The grids drift ~0.35 s by t=200 on a buffed plan, so a
press can land on exactly the right cast with its wall-clock time a third of a second off. A
clock-tolerance verdict calls that a failure and sends the next reader hunting a bug that is not there.


## 6.10 ✅ STEP 1 LANDED — the objective is exact, and the demonstration it needs is NOT yet in

**2026-07-27.** `simulate()` now ranks on the deterministic per-cast sum. The gate is green and the
blast radius is measured; the *superiority* claim §0.4 demands is a separate question and §6.11 is where
it goes.

### 6.10a The change

The board walk already knew, per Arcane Blast, the haste and the stack count (hence the cast time),
whether Arcane Power was up, which spell-power buffs applied, and the crit factor — `dmg` **is** the
answer. It now accumulates `dmg x taper(completion)` on every call (not only when `collect` is set: the
optimizer scores with `collect` off, and an objective cannot depend on whether someone asked for a
board), and that sum is what `total` / `totalEarly` / `robust` return.

The rate integral is **kept** and returned as `integral` / `integralTotal`, so the gap stays
measurable. It must never be the arbiter again.

### 6.10b The gate, and why it is not circular

`tools/self-consistency.mjs`, 2755 plan-scorings, no sim:

```
  ★ THE GATE — robust(what RANKS) - taperedCastSum(the board the tool SHOWS):
     min 0.00e+0   median 0.00e+0   max 0.00e+0   (effective ABs)
     ✓ PASS — one objective, to float precision
```

`robust` is now the cast sum, so this could be zero by construction. It is not: `robust` is accumulated
**inside** the board walk, while the number checked against it is recomputed **independently** from the
`casts` array the walk reports. Zero says the thing that RANKS and the board the tool SHOWS are the same
quantity — the invariant that was broken, and the one a refactor would break again.

⚠ The tool grew `ENGINE=` / `ROUND_INDEX=`: the plan cache keys on the round blob's sha1, so plans must
come from it, but the SCORER under test is the working tree. Scoring the round blob with itself is the
control, and it still reports the old **median 0.2114 %, max 1.4263 %** — the gate can fail, which is
the only reason its passing means anything.

### 6.10c Blast radius, re-measured against the new engine

| | |
|---|---|
| pooled-argmax cells where the emitted plan changes | **117 of 285 — 41.1 %** |
| presets whose plan changes at all (`plan-sweep`, 16 QUICK cases) | **16 of 16** |

⚠ `tools/blast-radius.mjs` had to be taught to read the integral from `r.integral`. Left reading
`r.robust` it would have compared the new scorer **against itself** and reported a blast radius of zero
— the most reassuring possible wrong answer.

### 6.10d ⛔ THE DEMONSTRATION FAILED AT FIRST ASKING — and that is how bug 2 was found

`tools/scorer-duel.mjs` (built for this): for every cell where the two accounts pick a different plan,
duel those two plans in the sim at that cell's own fight and character, with the now-correct press
transcription. Whichever the sim scores higher is the better plan.

**First run, 20 cells, 3 seeds: cast-sum 11, integral 9, mean Δ −0.10 DPS.** A coin flip.

Per §0.4 that is a REFUSAL to re-record goldens, not a rounding error — and it was the right refusal,
because the cause turned out to be a second scoring bug that only became load-bearing once step 1
landed. See §6.11. **No golden was re-recorded on this evidence.**

## 6.11 ★★★ BUG 2 — THE DISCRETE WALK GAVE EVERY MID-CAST PRESS A SHORT WINDOW

Found by asking why §6.10d's demonstration came out a coin flip. It is a **second scoring bug**, it had
been in the walk all along, and it became load-bearing the moment step 1 made the walk the arbiter.

### 6.11a The defect

The walk applies a fired buff from the first cast boundary at or after the press — correct, a self-press
cannot go off while a cast is in flight — and then expired it at **`press + duration`**. So a press
landing mid-cast got a window SHORTER than the buff actually is, by the press slip.

`tools/window-span.mjs`, Icy Veins (20 s) at h=0, model against wowsims:

```
  press   model: buffed casts   sim: buffed casts   model window       sim aura window
  9.6                     15                  16   11.00–28.50        11.00–29.75     <- one cast short
```

Harmless while the rate integral was the arbiter: the integral scored from `scoreStart = eff + slip` for
a **full** duration, which is the phase-average of *"starts at the next boundary, then runs its whole
length"* — the correct semantics. The walk's version was start-late-end-on-time, i.e. a systematic
under-credit of every mid-cast press.

### 6.11b The fix, and the one case it must NOT touch

The aura starts when the ability actually fires:

- **self-press** → `max(eff, prevCastEnd)` — it cannot fire while a cast is in flight;
- **raid EXTERNAL** (Bloodlust / PI / Drums) → `eff`, unchanged. Someone else presses these, so they
  land when CALLED whatever this mage is casting. Expiring them from a cast boundary would over-credit
  them by up to a full interval, which is the same bug wearing the other sign.

After the fix all six probe offsets match wowsims exactly, including 9.6 → 16 casts, 11.00–29.75.

### 6.11c ⛔ AND THE DEMONSTRATION IS STILL NOT IN — 6 / 8 / 10

Re-running §6.10d's duel on the fixed engine (24 cells, 3 seeds, `tools/scorer-duel.mjs`):

| tie rule | cast-sum | integral | ties | mean Δ |
|---|---|---|---|---|
| seed band only (**wrong** — see below) | 14 | 10 | 0 | +0.28 DPS |
| **0.25 DPS resolution floor** | **6** | **8** | **10** | +0.28 DPS |

⚠ **THE FIRST ROW IS AN INSTRUMENT ERROR AND IT FLATTERED THE RESULT.** With common random numbers the
seed band collapses to ±0.00 on essentially every cell, so *"tie if |Δ| ≤ band"* declared a WINNER for
`+0.00` against `−0.00`. It turned rounding into a verdict and moved the headline from 6–8 to 14–10.
This is §6.5a's exact failure mode, reached from a new direction, in a tool whose own header warns
about §6.5a. **A tie rule needs a resolution floor, not just a noise band.**

**Verdict: INCONCLUSIVE, not "the integral is better".** The mean is positive (+0.28 DPS) and the
win/loss count is negative; at n=24 neither resolves.

### 6.11d ⇒ THE DEMONSTRATION IS BLOCKED, AND ON A KNOWN CAUSE

The referee is still miscalibrated. §6.9d measured that **26 of 196 presses** do not land on the cast the
model scored them on, purely from the 334 ms / (1/3) s Arcane Blast cast-time mismatch (HELD + LATTICE)
— and no transcription can reach those. A referee that mis-executes ~13 % of presses cannot resolve a
margin of ~0.01 %.

⇒ ~~**Fixing `STACK_CAST_REDUCTION: 1/3 → 334 ms` is now a PREREQUISITE for the demonstration**~~
✅ **IT LANDED — §6.14.** And the fix was **two** changes, not one: the constant *and* millisecond
rounding of every cast and GCD (`sim/core/cast.go:137-138`), of which **(2) dominates and (1) alone
moved the bare lattice by exactly nothing** (Arcane Blast is GCD-bound in steady state). Bare-stream
drift went 0.080 s → **0.005 s**, the log's own printing floor, and LATTICE-class press failures went
8 → **0**. ⇒ **The prerequisite is discharged; `scorer-duel` has not been re-run against it.** That
re-run is inherited by `docs/PHASE13.md` — it is the demonstration §0.4 asked for and it is still not
in. Order as stated: land the constant *(done)*, re-run `scorer-duel`, and only then consider goldens
— noting the goldens were subsequently re-recorded under §9 on `plan-rescore` evidence instead
(15 of 16 better, 0 regressions).

### 6.11e ~~⛔ WHAT IS TRUE OF THE REPO RIGHT NOW — read this before running exact-match~~

> # ⛔⛔ THIS SECTION IS FALSE AND IS THE MOST DANGEROUS STALE LINE THE REPO HAS CARRIED
> **`exact-match` reads 25 passed, 0 failed.** The goldens **were** re-recorded, later the same day,
> when §9's boundary-credit ruling landed together with §6.14c's cooldown-chain fix — see §9's landing
> block for the gate table. The red state described below lasted a few hours and is **over**.
>
> ⚠ **Read the instruction, not the reasoning.** *"`exact-match` is red on purpose, do not `--update`
> it"* was correct **only while §0.4's demonstration was outstanding**. A future session that finds a
> red suite must not cite this block as licence to leave it red, and must not cite it as licence to
> `--update` either: **the standing rule is unchanged** — goldens are re-recorded only after each
> changed plan is shown to improve the objective (`tools/plan-rescore.mjs` did that here: 15 of 16
> better, 1 plateau, **0 regressions**).
>
> *The block as written, kept because the archive is append-only:*

- ~~`tests/exact-match.mjs` **WILL FAIL**, on every case.~~ Plans moved by design (41.1 % of pooled-argmax
  cells; 16 of 16 QUICK sweep cases) and **the goldens were deliberately NOT re-recorded**, because
  §0.4 licenses that only on a demonstration that has not been obtained. This is a known, intended,
  documented state — not a regression, and not something to fix with `--update`.
- ~~⛔ **Do NOT run `exact-match --update` to make it green.**~~ That would freeze an objective whose
  superiority is unproven into the project's own definition of correct, and destroy the only record of
  what the retired scorer emitted.

## 6.12 ★★★ BUG 3 — ONE SNAPSHOT RULE WHERE THE GAME USES TWO

**User challenge, and it is the correct mechanical read:** *"since we know when the casts begin and end,
can't we also treat it properly and start the buffs in between casts like the sim does? And treat the
cast based on if it began in the buff window or outside of it — that's how the real game does it."*

Half right, and the wrong half is the valuable one. **There are two rules, not one**, and the board walk
applied the start rule to both.

### 6.12a The measurement (`tools/snapshot-rule.mjs`, h=0, native runner)

Press a buff so its window ends *inside* a cast, then read that cast's own `[DEBUG] SP:` and duration:

```
  HASTE  Berserking faded 21.00
         the cast that started 20.55 ran 1.362s (buffed);  the next, from 21.91, ran 1.498s
         ⇒ ★ SPEED IS FIXED AT CAST START — an in-flight cast keeps its speed

  VALUE  Icon of the Silver Crescent (+225 SP), aura 11.00–31.00
          9.50 -> 11.00 : SP 1386.2   <- completes ON the gain, does NOT get it
         11.00 -> 12.50 : SP 1611.2
         29.00 -> 30.50 : SP 1611.2
         30.50 -> 32.00 : SP 1456.2   <- STARTED inside the window and still LOST it
         ⇒ ★ VALUE IS READ AT CAST COMPLETION
```

**The window is `(start, end]`** — open on the left, closed on the right. Both edges are measured: a cast
completing exactly on the gain is not paid (above), and one completing exactly on the fade **is**
(`credit-check` Gem@20 — the sim paid the 33.50→35.00 cast against a window ending at 35.00). One
ordering explains both: **damage resolving at instant X settles BEFORE the aura events at X.**

### 6.12b ⚠ WHY IT SURVIVED — the two old defects CANCELLED

On a press landing MID-CAST the pre-fix engine agreed with the sim exactly. It had two errors that
undid each other: the window ended one cast early (§6.11) *and* the test point was one cast early. The
discriminating case is a press landing **ON a cast boundary**, where the window is right and only the
test point is wrong:

| engine | Icon@11 (on a boundary) | Icon@10.5 (mid-cast) |
|---|---|---|
| pre-fix | model paid **14**, sim paid 13 — over by the 30.50 cast | 13 / 13 ✔ (the errors cancelled) |
| fixed | **13 / 13 ✔** | 13 / 13 ✔ |

★ **A gate that only ran the mid-cast case would have passed on the broken engine.** `credit-check`
therefore names its press times and says why in the file.

### 6.12c The fix

The scan splits in two. Haste (`mult`, `rating`, Power Infusion) is read at the cast's **start** and
sets the cast time; value (`dmg`, `sp`) is then read at the **completion** that haste implies. No
circularity — completion depends on haste, not the reverse — and no lookahead is needed, because a
press that has not fired yet in the walk fires at the next boundary, which is at or after this
completion, and the left-hand test is strict.

### 6.12d ⛔ The reason it was "deliberately unimplemented" is VOID

`index.html` carried this as a known refinement, declined because *"charging it moves the B2 deficit the
wrong way, so it needs its own physics justification and sim gate"* (RULES 3b.3). **B2 was measured
against a scorer that disagreed with itself by ~30× the margins it was resolving** (§6.8). A defect kept
because a measurement *taken through another defect* disliked the fix is not justified at all — it is
the same masking pattern as §6.11, for the third time in one phase.

⇒ Both halves it asked for now exist: the **physics justification** is §6.12a, measured in both
directions on both kinds of buff; the **sim gate** is `tools/credit-check.mjs`, controlled in the
negative direction against the pre-fix engine.

## 6.13 ⚠ THE PRINTED PRESS SECOND IS WRONG ON 1.8 % OF PRESSES — and it is always fixable

**User, correcting me:** *"Make the model fire them like wowsims does, that's how it is in game. We even
say so in the model assumptions, that it's macroed onto the next available cast."*

**Correct, and my §6.12-era framing of off-GCD trinkets as a defect is WITHDRAWN.** `index.html`'s
assumptions panel states the playstyle outright — *"macro'd into your spam ('/cast Berserking /cast
Arcane Blast'), so they fire between casts … if you hit the macro mid-cast it takes effect as that cast
ends"* — and `auraAt = max(eff, prevCastEnd)` implements exactly that, for on-GCD and off-GCD alike.
Under the macro there is no such thing as an instant off-GCD press, so there is nothing to fix.

### 6.13a But the same panel makes two promises that cannot both hold

> *"The times in the plan are when the buff is actually up … **Press at the second shown.**"*

The printed second is `floor(actEff)`, and `actEff` is the **press moment**; the buff is up at the
**boundary after it**. Under the macro, pressing at second `S` gives the buff at `nextBoundary(S)` — so
promise 2 holds only if `nextBoundary(floor(actEff)) == auraAt`. Flooring walks backwards, and when it
walks back **past a cast boundary** the macro fires a whole cast early.

### 6.13b Measured — `tools/display-second.mjs`, 285 plans, 3060 presses, no sim

| | |
|---|---|
| pressing the printed second lands the window the model scored | 3005 · **98.2 %** |
| it fires a cast EARLY — a different window than was costed | 55 · **1.8 %** |
| presses for which NO whole second can name the scored window | **0** |

```
isc+mqg T=281 h=230  icyVeins: model fires 26.58, plan prints 25, pressing 25 fires 25.49  (correct: 26)
isc+mqg T=229 h=70   arcanePower: model fires 187.32, plan prints 186, pressing 186 fires 186.22 (correct: 187)
```

### 6.13c ⇒ The fix — ⚠ PRESENTATION, and it comes AFTER the model

**User, setting the order:** *"the model itself and the calculations and correct activations come
first. We then just round the shown number in the timeline and activation schedule to be human
readable, but that's secondary. First we get the model to work, then we can figure out how to present
the findings."*

⇒ **This is a PRESENTATION task, and it is deliberately not queued behind the model work — it is
queued AFTER it.** Nothing here affects the scorer, the search, or which plan is chosen; it changes
only which second the plan prints. It is written up now so it is a task rather than a rediscovery, and
it should be picked up when the model is settled, together with the rest of how findings are shown.

**Print `floor(auraAt)`, not `floor(actEff)`.** A correct whole second always exists: cast intervals are
≥ the 1 s GCD floor, and any half-open real interval of length ≥ 1 contains an integer — which is why
the "unfixable" count above is 0, not a lucky 0.

⚠ It is **display-only** — the scorer and the search are untouched — but `actEff` is read by the
transcription, the timeline, and the custom-plan editor as well as by the printed plan, so the change
should introduce the boundary as its own field rather than redefine `actEff` underneath its other
callers. **Not done in this phase**; specified here so it is a task, not a rediscovery.

★ This is the human-facing twin of §6.9's transcription bug: the same "flooring walks back past a
boundary" error, found in the number handed to the *player* instead of the one handed to the sim.

## 7. THE SEARCH — can the global optimum be PROVEN, and how?

**User:** *"Then we can move onto improving the search function… Can we ever find and prove that we
found the global optimum? Is the global optimum somehow calculatable, or is brute force the only way?"*

### 7.1 The structural fact that makes this tractable

**The objective is piecewise-constant in the press times.** A press time enters the score only through
the cast boundary it snaps to (`auraAt`), and the window then covers a determined set of casts. Moving
a press *within* the interval between two boundaries changes the score by exactly zero.

⇒ **The decision variable per press is an integer — which cast it fires on.** Not a real number. The
problem is finite and combinatorial, and the continuous search the tool runs today is exploring a space
far larger than the one that actually exists.

### 7.2 There is no closed form, and brute force alone is not the answer either

No formula hands you the argmax: haste windows change *which casts exist*, and overlapping value
windows interact multiplicatively, so the placements are coupled. And naive enumeration is hopeless —
~200 casts × ~10–15 presses is ~10³⁴.

But three things collapse it hard:
1. **Cooldown spacing.** Uses of one cooldown are ≥ its cd apart; Icy Veins in a 300 s fight admits at
   most 2 uses, and the second is ≥ 180 s after the first. Pairs, not squares.
2. **Dominance.** A press whose window lies wholly in downtime, or wholly past the kill, is dominated.
3. **An admissible upper bound.** Because the objective is now an EXACT sum, the remaining contribution
   can be bounded optimistically — give every unplaced cooldown its best conceivable window, ignoring
   conflicts. That over-estimates, so pruning against a good incumbent is sound.

### 7.3 ⇒ The route to a PROOF, cheapest rung first

1. **Exact enumeration on the cast lattice, small instances first** (short fights, 2–3 cooldowns).
   Feasible today, **no sim**, and it yields the strongest possible statement: *for this fight, this IS
   the global optimum.* It also certifies the heuristic on those cells.
2. **Branch and bound** with the §7.2 bound, to push provable optimality to realistic fight lengths.
   How far it scales is an empirical question — measure before promising.
3. **Generalize every disagreement.** Wherever enumeration or B&B beats the heuristic, the fix is a rule
   or a seed class, not a re-tuned scorer (§0.2). With an exact objective this entire programme is
   arithmetic — the sim is not in the loop at all.

⚠ **"Proven optimal" is PER-INSTANCE, not once and for all.** You prove it for a given fight/gear/kit.
Across the whole input space you rely on the heuristic plus a certified corpus — which is exactly what
`docs/ACCEPTANCE.md` is for, and why its re-gather is now cheap.

## 6.14 ✅ THE CAST LATTICE IS CLOSED — and what is left is a FOURTH instance of the same confusion

### 6.14a The fix, and the part of it that mattered

Two differences from wowsims, and **both** had to go:

1. `STACK_CAST_REDUCTION: 1/3` → **334 ms** (`sim/mage/arcane_charge.go:17`).
2. **Round every cast and every GCD to the millisecond**, as `sim/core/cast.go:137-138` does.

⚠ **(2) dominates, and (1) alone moved the bare lattice by exactly NOTHING.** In steady state Arcane
Blast is **GCD-bound** — the 3-stack cast is 1.498 s, under the 1.5 s GCD at every haste — so the
interval comes from `max(1.0, 1.5/m)` and the stack constant never enters it. It still matters for the
**ramp** and for **cast completion times**, which is where the value-snapshot rule reads.

| | before | after |
|---|---|---|
| bare-stream drift, 300 s, worst | 0.080 s | **0.005 s** (the log's own 2-dp printing floor) |
| LATTICE-class press failures (of 196) | 8 | **0** |
| worst model-vs-sim clock gap on a press | 2.887 s | 2.000 s |

### 6.14b ⚠⚠ AND THE INSTRUMENT WAS BLIND — THREE TIMES

`tools/lattice-drift.mjs` defaulted `--index` to the **round blob**, so it loaded the OLD engine and
reported a byte-identical `0.080 s` across **two consecutive cast-timing fixes**. That reads as "the fix
did nothing", and it sent me theorising twice instead of measuring. `press-headtohead.mjs` and
`press-exposure.mjs` had the identical defect.

★ **The rule this earns:** a tool that takes both a *plan source* and an *engine* must keep them
separate, and the engine must default to the WORKING TREE. `ROUND_INDEX` is the blob the plan cache
keys on; `ENGINE` is the code under test. All five affected tools now split them. This is the third
distinct way an instrument has flattered or blinded itself in one phase — see also §6.9's classifier and
§6.11c's tie rule.

⚠ It also broke `credit-check`, which had **hardcoded** press times hand-calibrated to the old lattice:
when the grid moved 2 ms, `press: 11` was no longer on a boundary and the two arms silently stopped
being the same experiment. It now reads the boundary off the model's own grid and transcribes the sim
side through `planToSpec` — **a gate must not carry its own copy of the geometry it is checking.**

### 6.14c ~~▶ WHAT REMAINS: `HELD` = 18~~ → ✅ LANDED — the cooldown chain now anchors on the FIRE

> ✅ **FIXED 07-27, and this section is the canonical write-up of that fix** — `lastFire[key] = auraAt`
> replaces `lastEff[key] = eff`, so a cooldown's next legal use is measured from the moment the ability
> actually fired, exactly as wowsims does. **Measured: `HELD` 18 → 1 of 196 presses**
> (`tools/press-headtohead.mjs`). It landed together with §9's boundary credit, on explicit user
> direction that the two are one coherent statement about what the objective evaluates and where.
>
> ⚠ **CITATION NOTE — this section is the target of a repo-wide broken anchor.** Several places cite
> *"PHASE12 §3"* for the cooldown-chain fix. **§3 is the debts table; the fix is §6.14c** (here).
> `docs/RULES.md`, `docs/ARCHITECTURE.md` and `docs/ACCEPTANCE.md` were corrected when this doc was
> archived; the two occurrences in `index.html` are the file owner's to fix.

`LATTICE` went to 0; `HELD` did not move. Different mechanism, and it is the **fourth** appearance of
press-moment-vs-fire-moment:

- the model chains a cooldown from `lastEff[key] = eff`, the **press moment**;
- wowsims starts the cooldown when the spell is actually **cast**, at the fire boundary `auraAt ≥ eff`.

So a press the model legalises at `eff + cd` is still on cooldown in the sim until `auraAt + cd`, and
`APLActionSchedule.IsReady`'s `innerSpell.IsReady` gate defers it a whole cast.

⇒ **The model can emit a plan the sim cannot execute.** This is a LEGALITY rule (`repair`), not a
scoring one, so it does not touch the objective — but it is the next thing to fix, and the fix is the
same one applied three times already: chain from the moment the ability fires, not from the moment it
was pressed.

## 6.15 ★ "16 OF 16 PLANS CHANGED" OVERSTATES IT — the plan moves far more than the score does

**User:** *"I expect the very simple fights to not change that much, no? Or do you mean just the
effective casts calculation in them?"*

Right on the value, and the distinction is exactly the one to draw — **two different things changed, and
they are different sizes.**

### 6.15a The READOUT — same plan, reported count drops ~0.5–0.9 casts

Scoring the *identical* plan with the old engine and the new one (`total`, in effective ABs at T):

```
  Hydross the Unstable    87.451 -> 86.918   -0.533
  2:00 lust 0:05         100.784 ->  99.918  -0.867
  2:40 lust 0:05         129.674 -> 129.080  -0.594
```

Honest re-accounting, not a loss: `total` now counts casts that **complete** by the kill, where the rate
integral credited the straddling cast fractionally. A cast still in flight when the boss dies did not
happen.

### 6.15b The PLAN — better everywhere, by a little, with no regressions

Both plan sets rescored by the **same** (current) engine, so the numbers are comparable
(`tools/plan-rescore.mjs`):

| | |
|---|---|
| new plan better | **15 of 16** |
| plateau (\|Δ\| < 0.001 casts) | 1 |
| ⛔ new plan WORSE than the old one | **0** |
| range of the gain | +0.061 … +0.703 effective ABs |

Zero regressions is the load-bearing line: a cell where the OLD engine's plan outscores the NEW
engine's own output, under the new engine's own scorer, would be a **search** failure with nothing to do
with the scorer change. There are none.

### 6.15c ⇒ AND THAT REFRAMES THE BLAST RADIUS

`plan-diff` says 16 of 16 changed. `tools/plan-shift.mjs` says how far, over 142 presses:

```
  identical press time              29.6%
  moved ≤ 1 s (same plan, nudged)   26.1%
  moved 1–5 s                       24.6%
  moved > 5 s                       19.7%      max 91 s
  presses added/removed outright        0
```

**No press was added or dropped anywhere** — every plan keeps its shape: the same cooldowns, the same
clustering into Lust, the same second wave. And the biggest move is the tell: `2:40 lust 0:05` shifts a
press by **91 s** and gains **+0.061 effective ABs**, a sixteenth of a cast. **The objective is nearly
flat across that band, so the argmax hops around a plateau.**

★ **The plan moves far more than the score does, and on the simple fights almost all of the visible
churn is plateau-hopping rather than a changed decision.** "16 of 16 changed" is true and misleading;
quote §6.15b's Δ alongside it, or a reader will price a re-placement as a rewrite.

⚠ This is also why `exact-match` being red is not itself informative here — an exact-match diff cannot
tell a 91 s plateau hop from a real re-decision, and neither can `plan-diff`. That is what
`plan-rescore` and `plan-shift` are for.

## 6.16 ★★★ THE END-TO-END AUDIT — the model predicts the log press by press, until a cooldown recurs

**User, setting the standard:** *"you can run a sim, then check that simulation's logs and see if the
activation and duration and everything check out … the model should be able to predict the logs press by
press down to the milliseconds."*

That is the right bar and it is now an instrument: `tools/model-audit.mjs`. It takes a plan the tool
actually emits, runs it, and compares **everything the model claims, cast for cast** — the cast count,
every cast's start, every cast's cast time, the spell power each cast used, and the damage multiplier
each cast got. Only the base-damage RNG roll and crit are excluded (crit cancels out of effective ABs by
construction; the multiplier is recovered as `AfterAttackerMods / BaseDamage`, which divides the roll
out).

### 6.16a On a single-use fight it holds exactly

```
PASS  2:00 lust 0:05  (T=120)
      casts: model 94 · sim 94
      per-cast mismatches — start 0 · cast time 0 · spell power 0 · damage mult 0   (of 94)
       i   model t / sim t     model cast / sim   buff SP m/sim      buff mult m/sim
       2     3.888     3.89     1.527   1.527       0.0      0.0     1.000   1.000
       3     5.415     5.42     0.960   0.960     380.0    380.0     1.250   1.250
```

Cast times to the millisecond, buff SP exact (380 = Icon 155 + gem 225), buff multiplier exact.

### 6.16b ~~⛔ And on multi-use fights it does NOT — 17 of 23~~ ⚠ MEASURED BEFORE ITS OWN DIAGNOSED CAUSE WAS FIXED

> ⚠ **THE 17-of-23 FIGURE IS STALE — DO NOT QUOTE IT AS THE MODEL'S CURRENT STANDING.** This section
> ends by naming its own cause: the cooldown chain anchored on the **press** rather than the **fire**,
> §6.14c's `HELD` class, *"independently reproduced and now priced"*. **That fix landed** (`lastFire`),
> and `press-headtohead` measured its direct effect as **HELD 18 → 1 of 196 presses**. The audit was
> **not re-run at scale afterwards**, so the failure count is a measurement of an engine that no longer
> exists — and its diagnosis predicts it should now be much smaller.
>
> ⇒ **Re-running `tools/model-audit.mjs` at scale is inherited by `docs/PHASE13.md`.** It is the
> standing bar the user set (*"the model should be able to predict the logs press by press down to the
> milliseconds"*), and the chain fix is exactly what it was measuring.
>
> ★ **What survives unchanged and is the section's value:** the *diagnostic method* — the magnitudes
> name the cause. SP off by exactly **155** (one Icon) and the multiplier by exactly **0.25** (one
> Arcane Power) is a whole window on the wrong casts, not rounding; and the fights that fail are
> precisely the ones with a **second** use of a cooldown. §6.16c's two harness errors and §6.16d's
> Go-`Duration.String()` unit trap are likewise durable.

Every **cast count** still matches (314/314 on the 7:20). What breaks is placement, and the magnitudes
name the cause. `4:00 lust 0:05`:

```
      per-cast mismatches — start 25 · cast time 3 · spell power 173 · damage mult 1   (of 177)
      worst deviation     — start 0.6650s · cast 0.2500s · SP 155.0 · mult 0.2499
```

**SP off by exactly 155 (one Icon) and the multiplier by exactly 0.25 (one Arcane Power)** — a whole
window on the wrong casts, not rounding. The fights that pass are the short ones with a single use of
each cooldown; the fights that fail all have a **second** use.

⇒ That is §6.14c's `HELD` class, independently reproduced and now priced: the model chains a cooldown
from the **press moment** (`lastEff = eff`), wowsims from when the spell is actually **cast**
(`auraAt ≥ eff`). The second use therefore lands a cast later in the sim, and because some of those
cooldowns are haste buffs the whole downstream lattice shifts with it — 0.665 s by t≈240.

### 6.16c ⚠ Two harness errors this audit had to clear first, both previously recorded

1. **The model must describe the character the sim runs.** Built from the preset's gear while the sim
   ran the bench export, the model had `t5two: false` against a character wearing Tirisfal 2pc, so every
   multiplier looked wrong and Arcane Power appeared to be **×1.25 in the sim against ×1.30 in the
   model**. Both artefacts. Spreading `REF` fixes it — this is PHASE8 §6/§7's defect exactly, and
   `tools/reference-gear.mjs` exists to prevent it.
   ★ The ×1.25 was real but not a discrepancy: `SpellMod_DamageDone_Flat .3` adds into a bucket that
   already holds the 2pc's 1.2, so `1.5 / 1.2 = 1.25` — which is precisely what the model's
   `dmgMult + t5add` (1.30 + 0.20 = 1.50) already encodes.
2. **Compare buff DELTAS, not absolutes.** The model's `sp` is its declared spell power and its
   `dmgMult` is normalised to 1.0; the sim reports real SP and a multiplier containing talents and set
   bonuses. Raw, the comparison measures gear calibration and drowns the question being asked.

### 6.16d ⚠ A log-format fact for TOOLING's list

Durations are Go's `Duration.String()`, so **the unit changes with the magnitude**: `Cast Time = 2.083s`
but `Cast Time = 960ms, GCD = 1s` once the value drops below a second. A regex anchored on `([0-9.]+)s`
matched 72 of 94 casts and dropped **exactly the fast ones** — the casts a haste audit is most about.

---

## 8. ⚠ THE INTERMISSION WALL IS PAID IN FULL — a fourth scoring defect, found 2026-07-27

**Raised by the user as a proposal:** *"we still want the scorer to accredit unfinished casts partially
to what they would have been worth — a cast under AP would have been worth 1.3, cut off halfway before
the intermission/fight end we'd count 1.3 × 0.5."* Probing it (`tools/wall-credit.mjs`) found the model
is wrong at one of those two boundaries and already right at the other — and wrong in the direction
nobody would guess.

### 8.1 ~~The two boundaries are different problems~~ ⛔ THE PREMISE WAS OVERTURNED HOURS LATER (§9)

> ⛔ **THE TABLE BELOW IS SUPERSEDED IN EVERY COLUMN — read §9 first.** The user's ruling (§9.0) and
> then their correction (§9.5) collapsed this two-problem framing into **one rule at every cut**:
> - *"is the time known?"* — **no, at either boundary.** *"even the intermissions can happen a little
>   sooner or later"* — assuming the wall is exact is the identical mistake §8 correctly identified
>   about `T`, made one boundary over.
> - *"correct credit"* — **the same fraction at both**: `min(1, (nextCut − castStart) / castDuration)`.
> - ⛔ **"a cast completing exactly at T is paid 0.5" is FALSE.** That was the **symmetric** taper
>   `U[T−W, T+W]`, which is retired. The rule is a **one-sided** window whose width is the cast's own
>   duration, so a cast completing exactly at `T` is paid a **FULL** cast.
>
> ★ **What survives from §8, and it is the reason the section exists:** the *measured defect* in §8.2
> (the model paid FULL price for a cast completing inside an intermission) is real and was the trigger
> for the whole ruling. Only the prescribed correction changed.
>
> *The table as written, kept because the archive is append-only:*

| | the KILL | an INTERMISSION wall |
|---|---|---|
| ~~is the time known?~~ | **no** — nobody knows the second the boss dies | ~~**yes** — a scheduled second~~ ⛔ no |
| ~~correct credit~~ | `dmg × P(alive at completion)` — fractional | ~~**zero** — the boss cannot be hit~~ ⛔ the same fraction |
| ~~status~~ | ~~✅ already implemented: `robust`'s kill taper (`index.html:1183`), uniform over `T ± KILL_WINDOW`, so a cast completing exactly at T is paid 0.5~~ ⛔ retired — it is paid a FULL cast | ⛔ **the model pays FULL price** — the real, measured defect (§8.2) |

★ **At the kill, the fraction depends on WHEN THE CAST COMPLETES — never on how far through it the
boundary cut.** A 0.75 s cast and a 2.5 s cast that both complete at `T + 0.3` are worth exactly the
same; the boss's survival does not care how long you had been channelling. **So the proposal's
arithmetic is right and its mechanism is not**: an AP cast completing at T is already scored
`1.3 × 0.5 = 0.65`, arrived at as a probability rather than as cast progress. Crediting *progress*
would pay for damage that never lands and bias the search toward parking casts against the edge.

### 8.2 The defect: measured

`2:40 lust 0:07 intermission 1:30-2:10`, wall at 90:

```
cast starts 89.616  ·  completes 91.114  ·  1.114 s inside the untargetable window  ·  credited 2242.1
```

The walk advances a cast at a time and reads its segment at the cast's **START** (`index.html:994`);
the credit test at `:1183-1184` only asks `tcC <= cfg.T`. **Nothing asks whether the cast COMPLETED
into downtime.**

★ **And the correct rule is already written in this file, one function over:** `dmgOf` at
`index.html:1327` — `if (nonAB(segAt(tc))) return 0;  // completes into downtime/AoE — no AB damage`.
That is the exact shape of every scoring defect this phase has found: **the rule exists and the path
that RANKS does not take it.** (§6.10's integral, §6.11's press-time windows, §6.11's single snapshot
rule, and now this.) The lesson has been paid for four times: when a scoring question has an answer
somewhere in the engine, check that the *scorer* is the code asking it.

### 8.3 ~~The fix, and what it is not~~ ⛔ THIS PRESCRIPTION WAS NOT THE FIX — DO NOT IMPLEMENT IT

> ⛔ **IMPLEMENTING THE LINE BELOW WOULD RE-INTRODUCE THE DEFECT IT IS AIMED AT, WEARING THE OTHER
> SIGN.** `dmg = 0` for a cast completing into an intermission is a **hard staircase**, and it is
> exactly what §9 rejected: the wall is *not* known exactly (*"even the intermissions can happen a
> little sooner or later"*), so a cast that completes before the wall actually falls **does** land.
> What shipped is the fraction — `min(1, (nextCut − castStart) / castDuration)` — applied uniformly at
> the fight end, at an intermission start, ~~and at either edge of an AoE phase~~ (⚠ **the AoE START is
> a cut and the AoE EXIT is not — and the start's *reason* changed twice the same day: removed on
> physics, restored on policy. See §9's landing block**). Measured on the exhibit
> cast (`2:40 lust 0:07 intermission 1:30-2:10`, starts 89.616 against a wall at 90.000, worth 2242.1):
> full price **before**, `frac 0.2563 → 574.8` **now**, and `dmg = 0` would have paid **zero**.
>
> ★ **Its own §8.2 already contained the refutation** — it named the reason this section rejected
> partial credit (*"a wall is known exactly, so there is no distribution to integrate"*) as the single
> assumption, and that assumption is the one the user overturned.
>
> ⚠ **The paragraph immediately below it, however, is DURABLE and still binding:** *"do not fold in the
> smoothing argument"* — a scoring term is never priced at something other than the cast's damage in
> order to smooth the search. §9's fraction is admissible precisely because it is a **probability**
> (`P(the cut has not happened at completion)`), not a smoothing fudge; §6.1–§6.3 record four terms
> falsified for taking the other route.
>
> *The prescription as written, kept because the archive is append-only:*

~~`dmg = 0` when the completion lands in an intermission. **Not partial credit** — a wall is known
exactly, so there is no distribution to integrate and nothing to smear.~~ It is a scoring change, so
plans move and it **rides alone** (§0.3).

⚠ **Do not fold in the smoothing argument.** Fractional credit *would* smooth the objective, and
`index.html:1440`'s note already warns that the exact sum lost the integral's smoothing and that a
degraded SEARCH is where that would show. That is a real concern and it is **not** a licence to price
a cast at something other than its damage — §6.1–§6.3 record four terms falsified for exactly that
reason. If a wall genuinely needs smoothing, the principled route is the kill's: give the wall its own
**uncertainty window** (an HP-triggered phase change really is uncertain) and credit
`P(not yet walled at completion)`. Same mechanism, physically motivated, and fractional for a reason.

⚠ **Adjacent, NOT settled:** a cast starting in a normal segment and completing inside an **AoE** phase.
`dmgOf`'s `nonAB` covers `aoe` too, but the boss IS targetable there — the cast lands, it just lands
during AoE. Decide that deliberately rather than inheriting it from this fix.

---

## 9. ★★★ ✅ LANDED 2026-07-27 — THE BOUNDARY MODEL IS DETERMINISTIC (proportional partial credit)

> ### THE LANDING, WITH ITS GATES
> Landed together with §3's cooldown-chain fix, **deliberately not "riding alone"** — user direction:
> the two are one coherent statement about what the objective evaluates and where, and splitting them
> would have re-recorded the goldens twice for no added attribution (the sweep already names the moved
> cells).
>
> | gate | result |
> |---|---|
> | `tests/exact-match.mjs` | **25 passed, 0 failed** — goldens re-recorded; the suite had been red *on purpose* since the objective work and is green again |
> | `tools/self-consistency.mjs` | **0.00e+0** over 2755 plan-scorings |
> | `tools/wall-credit.mjs` | rewritten from probe into **regression gate**; passes |
> | `window-span` · `credit-check` · `snapshot-rule` | pass |
> | `tests/sim-duel.mjs` · `tests/sim-request.mjs` | pass · **9/9** with the native runner |
> | `tools/press-headtohead.mjs` | **HELD 18 → 1** of 196 presses — the chain fix, measured |
> | `plan-sweep` / `blast-radius` | **11 of 16** plans moved · **102/285 cells (35.8 %)** |
>
> ★ The exhibit cast is the cleanest single proof: `2:40 lust 0:07 intermission 1:30-2:10`, a cast
> starting **89.616** against a wall at **90.000**, worth 2242.1. It used to be paid in **full**. It is
> now paid **frac 0.2563 → 574.8**.
>
> ⚠ **`self-consistency` and `blast-radius` recompute the credit from the board's raw `t`/`cast`, NOT
> from the new `frac` field.** Reading `frac` would grade the accumulator against the statement that
> writes it — the gate's entire value is that it is a second, independent account.
>
> ⚠ ~~**What did NOT land, and is the next thing to decide:**~~ ✅ **DECIDED HOURS LATER — AND THEN
> DECIDED AGAIN, THE OTHER WAY, THE SAME DAY (07-27). Read all three steps; the reasoning is the
> payload.**
> 1. **As shipped here**, the AoE edge was treated as a cut and an Arcane Blast completing inside an AoE
>    phase was **docked** — on the reasoning *"the spell changes there, so the cast in flight does not
>    land as what it started as."*
> 2. **Removed on PHYSICS (commit `6cfaeec`)**, because that reasoning is **false**: the boss is
>    targetable throughout an AoE phase and the cast lands. Measured: an AB started at **59.000** against
>    an AoE phase opening at **60.000** completes at **60.498** and **lands for full Arcane Blast damage**
>    (1886.4, a 25 %-resist roll off a ~2577 typical hit).
> 3. **RESTORED on POLICY (user ruling, same day) — and that is where it stands.** The Blast lands, but
>    adds are up and Arcane Explosion is worth several Arcane Blasts, so the player **CANCELS** it; a
>    cancelled cast is worth zero, and with the wall `~ U[W, W+d]` the credit is exactly `P(the wall has
>    not arrived by completion)`. ★ **Because the cast is cancelled and not merely re-priced, the AE
>    lattice restarts AT THE WALL** — verified: a Blast starting 58.998 against a wall at 60.000 is
>    credited 66.9 % and the first AE fires at exactly 60.000. **This phase's version did not truncate**,
>    so today's behaviour is not what shipped here even though the verdict word matches.
> ⛔ **A BURN edge is still not a cut** — the cast lands *and you would not cancel it*.
> ★ **The lesson:** the measurement in step 2 is **true** and it is **not what decides the question** —
> the question was never *"does the cast land"* but *"what would the player do"*, and no sim can answer
> that. ⚠⚠ It also prices a **deliberate divergence from the sim** (wowsims cannot cancel a cast, so
> `model-audit` shows an expected gap at an AoE wall). Live text: RULES §9 / PHASE13 §1.
>
> ⚠⚠ **And chasing it found a 42 % error this phase had shipped:** Arcane Explosion is **INSTANT**
> (`cast = 0`), so the boundary credit's divide-by-zero guard — written to avoid a NaN — returned
> `frac = 0` and credited **every AE cast at exactly nothing**. Kael'thas scored **368,018 instead of
> 524,173**. The limit is not a matter of taste: as `dur → 0`, `min(1, (cut − t)/dur) → 1`. **Guard
> against NaN, not against the answer.**
> ⛔ **Neither defect was reachable by any gate this phase built.** `self-consistency` compares the
> objective against itself and read `0.00e+0` throughout; `exact-match` locks in whatever the search
> emits, so both would simply have **become the goldens**. That is this phase's real unfinished
> business, and it is `docs/PHASE13.md` §1/§8's.

---

### 9.0 The ruling as it was posed (kept — the reasoning is the record)

> **The ruling, in the user's own words:** *"I want a cast completing exactly at T to be accredited
> exactly a full cast... if the last full cast ends 0.613 s before T, and that next Arcane Blast would
> take 1.37 s and be worth 1.14 casts, I want the model to add (0.613/1.37)×1.14."* And on scope and
> cost: *"same for casts before intermissions/AoE phases... given this deterministic approach we don't
> need variance to the fight length. I understand that the sim can't do that and we'd have to account
> for that in setting up the sim and comparing the results from it, but common sense and the fact that
> the sim has logs should be enough to be computable."*

**This supersedes §8's conclusion about the fight end.** §8 argued the kill taper was already correct
because it is the sim's expectation at `--var 0.5`. That argument assumed an uncertain T, which is the
thing being ruled out. §8's *intermission* finding (the model pays FULL price for a cast completing
into downtime — `index.html:1183-1184` never asks) stands and is still a defect; the ruling changes what
it should be corrected **to**.

### 9.1 Everything it needs is already on the board — confirmed

At the moment the straddling cast starts, the walk knows its haste (passive × temporary) and its stack
count, hence `cast`; and it knows the SP and damage multipliers, hence `dmg`. Both are already recorded
per cast (`index.html:1187-1202`). **No new physics, no new inputs.**

### 9.2 ★ It is not a heuristic — it is a ONE-SIDED kill window whose width is the cast's own length

Worth writing down because it turns "a smoothing convenience" into a stated model, and because it
explains *exactly* where the current 0.5 comes from:

```
one-sided window, T_actual ~ U[T, T+W]:   credit = (T + W − tc)/W ,  tc = ts + d
set W = d:                                       = (T + d − ts − d)/d = (T − ts)/d   ← the ruling, exactly
```

Verified numerically (`ts = 199.167, d = 1.140, T = 200`): the proposal and the one-sided window with
`W = d` both give **0.730702**. So the ruling reads as: *"the fight lasts at least T, and at most one
more cast."*

| model of T | credit for a cast completing exactly at T |
|---|---|
| symmetric `U[T−W, T+W]` — **what ships today** | **0.5** (half the time the boss is already dead) |
| one-sided `U[T, T+d]` — **the ruling** | **1.0** |
| hard known T | 1.0, and 0 for the straddler — a staircase |

### 9.3 Measured: it does what it is meant to, and the term is large

One fixed layout, T swept in 0.2 s steps (`3:20`-shaped, haste 150):

| | behaviour across T |
|---|---|
| hard cutoff | **staircase** — 166.461 → 167.968 → 169.474, flat between, jumping a whole ~1.5-cast step |
| the ruling | **linear**, +0.264 eff casts per 0.2 s of T — the staircase is gone entirely |
| today's `robust` | also linear, +0.301 per 0.2 s, offset ~0.8 casts below |

Tail credit reaches **1.44 effective casts** and swings **1.32 (0.789 % of score)** across a 2 s T
range. ⚠ For scale, the cross-val margins this objective is asked to resolve are **median 0.035 %,
p90 0.159 %** — the boundary term is 5–20× them, so this is not a rounding decision.

### 9.4 The consequences, stated once so nobody rediscovers them

1. **`KILL_WINDOW` and the `total`/`robust` split collapse.** With T deterministic there is one number.
2. **`--var 0.5` stops being the matched protocol.** ⚠ TOOLING ★★ bans `--var 0` because it *"quantizes
   DPS to (integer casts × avg damage)/T and has faked a result twice"* — that ban is about comparing
   **DPS**, and it does not survive the change of comparison method below. Re-state it, do not delete it.
3. **★ The user's proposed comparison route is not only possible, it is CHEAPER than what we do now.**
   At a fixed T the sim's completed-cast set is deterministic, and `tools/model-audit.mjs` already
   requires the model to predict the log **cast for cast** (94/94 on single-use fights). If that holds,
   both sides agree on the straddling cast's start and duration, so the partial credit is a
   deterministic function of numbers the two already share — **it needs no extra sim run at all.**
   Model-vs-sim verification becomes *identity*, not a statistical DPS comparison. That is a strictly
   stronger bar and a strictly cheaper one.
4. **The acceptance corpus is voided again** — but §6 already says it has no current reading, so the
   marginal cost is only the re-gather, which §5 says is now mostly arithmetic.

### 9.5 ~~The one place the two boundaries are NOT the same~~ → ⛔ WITHDRAWN, same error twice

**This section argued** that the fight-end story (*"the cast would have completed if the fight ran on"*)
has no analogue at an intermission, because the boss returns afterwards and nothing completes the lost
cast — so crediting `frac × value` there would pay for damage that exists in no continuation.

**The user's correction, 07-27:** *"nono, all of the same. even the intermissions can happen a little
sooner or later. That's not a given that they will happen at the exact same time so modelling wise it
shouldn't treat it as such."*

⇒ **The objection assumed the wall time is known exactly — which is the identical mistake §8 made about
T**, one boundary over, after the first one had already been corrected. If the wall lands at
`W_actual ≥ W`, then a cast completing before `W_actual` *does* land, the continuation exists, and the
one-sided window applies verbatim with the wall in place of T. Nothing distinguishes the two.

★ **So the rule is ONE rule, and the implementation is one helper**: for every cast,

```
credit = min(1, (nextBoundary − ts) / d) × value ,   nextBoundary = min(T, next intermission start)
                              ⚠ this line originally also read ", next AoE start". It was removed
                                 07-27 (commit 6cfaeec, on the physics) and then RESTORED the same
                                 day on the user's POLICY ruling — an AoE start IS a cut because the
                                 player cancels the Blast, and it also TRUNCATES the AE lattice to the
                                 wall. Net: the ", next AoE start" clause is back. See §9's landing
                                 block, and RULES §9 for the reasoning that governs.
```

That is simpler than what ships today, and it **subsumes §8's defect for free** — today a cast
straddling into an intermission is paid in FULL (measured: starts 89.616, wall at 90, completes 91.114,
credited 2242.1). The fix is not `dmg = 0`; it is the fraction, like everywhere else.

**Two sub-decisions that remain, both small, neither a reason to delay:**

1. **One-sided or symmetric at a wall?** The kill is one-sided by construction — a fight lasts *at
   least* T. A wall that can come *"sooner or later"* is symmetric, and a symmetric window pays **0.5**
   at the nominal instant where a one-sided one pays **1.0**. The ruling's formula `(W − ts)/d` is the
   one-sided form. Recommend following the kill's convention (one-sided, full credit at the nominal
   boundary) so there is a single rule; note it as a stated choice rather than letting the helper
   decide it silently.
2. ~~**AoE walls are still a third case, for a reason that is not about timing.**~~ ✅ **DECIDED 07-27,
   TWICE — and the item's HEADLINE turned out to be right: an AoE wall IS its own case, for a reason
   that is not about timing.** The road there: commit `6cfaeec` first removed the AoE edge from the cut
   lattice **on the physics** (this section's own observation — the boss is targetable, so the cast
   lands; measured, an AB started at 59.000 with an AoE phase opening at 60.000 completes at 60.498 and
   **lands for full AB damage**). Hours later the user **restored it on POLICY**: the Blast lands, but
   adds are up and Arcane Explosion is worth several Arcane Blasts, so the player **cancels** it — a
   cancelled cast is worth zero, and the AE lattice therefore restarts **at the wall**. ★ **So this
   section's *observation* was right, its *conclusion* was wrong, and the correction that overturned the
   conclusion was itself corrected** — because the deciding question is *"what would the player do"*,
   which physics cannot answer. `dmgOf`'s `nonAB` zeroing *was* wrong independently of all of it,
   exactly as this item suspected. See §9's landing block for the full three-step correction, and for
   the 42 % instant-cast defect the same investigation exposed. Live text: RULES §9 / PHASE13 §1.
   *The item as written, kept because the archive is append-only:* The boss is
   **targetable** during an AoE phase, so an Arcane Blast completing inside one is not lost at all — it
   lands, for full AB damage; you would simply rather have been casting Arcane Explosion. ⚠ Today
   `dmgOf` (`index.html:1327`) zeroes it via `nonAB`, which covers `aoe` as well as `intermission`, and
   that looks wrong independently of this ruling. Decide it on its own merits.

### 9.6 Landing order

Scoring change ⇒ plans move ⇒ **it rides alone** (§0.3), and it queues **behind the cooldown chain**
(~~§3~~ → **§6.14c**; §3 is the debts table — this is the origin of the repo-wide broken anchor),
because a legality bug and a scoring change must not move plans in the same commit — ⚠ **and in the
event they LANDED TOGETHER**, on explicit user direction (see §9's landing block: the two are one
coherent statement about what the objective evaluates and where, and splitting them would have
re-recorded the goldens twice for no added attribution). Gates:
`self-consistency` back to `0.00e+0` (the board must carry the same partial credit the ranking number
does), `model-audit` unchanged, and goldens re-recorded only per §0.4.
