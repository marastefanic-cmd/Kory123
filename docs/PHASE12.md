# PHASE 12 — MAKE THE OBJECTIVE EXACT (▶ TOP PRIORITY, user-directed 2026-07-27)

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
   **Gate, and it needs no sim:** `robust` == the tapered cast sum to float precision, on every plan in
   the corpus. `tools/self-consistency.mjs` already measures exactly this and currently reports the
   0.2114 % median; it must go to ~0.
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
(the plan cache keys on its bytes). Written against `docs/archive/11-phase10-gearb-baseline.md` §8 and `docs/PHASE11.md` §1/§8.

---

## 1. USER CALLS — each with the evidence to answer it in one minute

> Rule for this section: state the question, the measurement that bears on it, and the cost of each
> answer. **Do not answer them here.** (`docs/PHASE11.md` §8 is the other list; these are additive.)

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

`docs/PHASE11.md` §8 lists the platform-phase user calls (module split boundaries, product routes).
They are unchanged by tonight's work; **do not decide them here**. §1.1 above is additive to them.

### 1.3 ⚖ Does the PASS criterion get restated in terms of the ripple floor?

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
| 3.7 | Interior-wall contribution to the ripple floor is unpriced at any boss length/kit but the one measured | open — ACCEPTANCE "coverage gaps"; boss cells priced at ±0.1251, interiors not |
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

## 6.1 ⛔ THE TERMINAL-CAST FAMILY IS CLOSED — in BOTH its forms

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

1. **Do not re-attempt the terminal-cast term.** Closed in both forms, on 285 columns, with the
   falsifier firing at ~2× the repair rate (§6.1).
2. **Do not trust "low-haste" as the debt's name.** The directional bias is at `simH > 200` (§6.2).
3. **The next measurement is more high-haste columns, not another term** (§6.3).
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

⇒ **the sim's buff starts at the first cast boundary STRICTLY AFTER the press; the model uses the raw
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

**The empirical rule:** wowsims' `schedule` action fires its inner action at the first APL evaluation
— i.e. the first cast boundary — **strictly after** the scheduled time. Boundaries at h=0 are
`… 9.5, 11.0, 12.5`:

```
schedule 9.6  -> fires 11.000     schedule 10 -> fires 11.000     schedule 11.0 -> fires 12.500
```

So to land a press ON boundary `B`, the schedule value must lie in `[prevBoundary(B), B)` — **a value
exactly equal to `B` overshoots by a full cast.**

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

⇒ **Fixing `STACK_CAST_REDUCTION: 1/3 → 334 ms` is now a PREREQUISITE for the demonstration, not an
optional follow-up.** Order: land the constant, re-run `scorer-duel`, and only then consider goldens.

### 6.11e ⛔ WHAT IS TRUE OF THE REPO RIGHT NOW — read this before running exact-match

- `tests/exact-match.mjs` **WILL FAIL**, on every case. Plans moved by design (41.1 % of pooled-argmax
  cells; 16 of 16 QUICK sweep cases) and **the goldens were deliberately NOT re-recorded**, because
  §0.4 licenses that only on a demonstration that has not been obtained. This is a known, intended,
  documented state — not a regression, and not something to fix with `--update`.
- ⛔ **Do NOT run `exact-match --update` to make it green.** That would freeze an objective whose
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

### 6.14c ▶ WHAT REMAINS: `HELD` = 18, and it is the cooldown chain

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
