# PHASE 12 — the next phase's raw material

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
