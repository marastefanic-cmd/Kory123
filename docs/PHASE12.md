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
