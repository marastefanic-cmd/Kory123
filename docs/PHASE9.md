# PHASE 9 — Optimizer performance (CPU / latency) with ZERO plan drift

**Trigger (user, 2026-07-24):** *"the tool has gotten a bit slow again and takes a lot of CPU, see any
performance improvements without regressions? perhaps a refactor in the future?"*

**The hard constraint.** Determinism is a feature (CLAUDE.md): one setup ⇒ one schedule. So a perf
change is only allowed if **every emitted plan stays byte-identical**. The exact-match suite (25 cases)
is the gate, and it is a *sufficient* one for any change that is pure-refactor by construction; for any
change that touches float arithmetic order, the gate is the suite PLUS an argument that the arithmetic
is unchanged, not merely "the tests still pass".

Method (user-directed): **notes → hypothesis → test → prove or disprove.** Every hypothesis below
carries its measurement and a verdict. No hypothesis is acted on before it is measured.

---

## §1 Baseline measurement

`tools/profile-opt.mjs` (new) loads the real `index.html` headless, runs `optimizeAsync` on a
representative case with a CDP CPU profile attached (200µs sampling), and prints wall time + self-time
by function. This is the **sequential in-page path** — the same code the pooled workers run, one copy —
so it measures CPU cost per worker, which is what "takes a lot of CPU" means.

**Case `long`** — T=375, haste 150, sp 1387, crit 38, full kit (IV/Icon/gem/AP/Zerk/MQG/Lust),
Lust pinned 0:10, Cold Snap on, no segments. Heaviest ordinary single-target UI case.

```
case=long  wall=31.49s  val=714496.544061  memoSize=1707
--- CPU self-time (top, of 100392 samples) ---
 41.5%  simulateRaw       12.3%  sigOf          10.6%  repair
  6.4%  simulate (memo)    5.3%  GC             4.8%  stepFor
  4.1%  scanAt             3.8%  polish         2.2%  rampCastDmg
  1.5%  cloneS             0.8%  intervalAt     0.7%/0.5%  (anon)/rateAt
```

Reading it: **~19% of all CPU is memo bookkeeping** (`sigOf` 12.3 + the `simulate` wrapper 6.4), not
simulation. `stepFor` shows 4.8% *self* time — a closure re-created every cast iteration. GC at 5.3%
says allocation pressure is real, not incidental.

---

## §2 Hypotheses

| # | Hypothesis | Predicted win | Risk to plans | Verdict |
|---|-----------|---------------|---------------|---------|
| H1 | `sigOf` is 12.3% because it does `Object.keys().sort()` + per-track `join(",")` + rope concat on **every** `simulate()` call. A cheaper exact encoding cuts most of it. | ~8-10% | none (pure fn, same string) | *pending* |
| H2 | The memo's **wholesale `clear()` at CAP** throws away a high hit rate; `memoSize=1707` after a run that made millions of calls proves it cleared repeatedly. A generational (hot/cold) cache recovers the hits at O(1) and bounded memory. | ? (depends on clear count) | none (eviction only ⇒ recompute) | *pending* |
| H3 | `stepFor` (4.8% self) and `scanAt` (4.1%) allocate a **closure and/or a fresh result object per cast / per breakpoint**; hoisting them out of the loops cuts both self time and the 5.3% GC. | ~5-8% | must not reorder float ops | *pending* |
| H4 | `repair` (10.6%) is called on candidates that are **already legal** (it is idempotent); a cheap legality pre-check would skip the work. | ? | none if the check is exact | *pending* |
| H5 | The pass stack re-scores the **same incumbent** many times across passes; the memo already absorbs this (hence the high hit rate), so there is no separate algorithmic win here. | ~0 | — | *pending* |

---

## §3 Evidence

### 3.1 Call census (`scratchpad/instrument.mjs` — monkeypatched counters, case `long`)

Top-level `function` declarations in a classic script become properties of the global object, so
reassigning `window.sigOf` / `window.simulateRaw` / `window.repair` / `window.cloneS` intercepts the
engine's own **internal** call sites. Purely additive — engine behaviour untouched.

```
sigOf calls   : 1,984,160
memo get/hit  : 1,981,692 / 1,379,985   (hit rate 69.64%)
memo set      :   601,707   clears: 5   final size: 1,707
simulateRaw   :   616,718   (of which collect=true: 15,011)
repair calls  : 2,019,660   cloneS calls: 2,079,763
```

**One solve does ~2.0M repairs, ~2.0M signature builds and ~0.6M real simulations.** The ratio is the
headline: for every schedule actually simulated, the engine repairs and signs it ~3.3×.

### 3.2 H1 — **CONFIRMED.** `sigOf` is pure string-building cost

`scratchpad/bench-sig.mjs`, 120,000 calls per variant on a realistic schedule population, in-page:

| variant | µs/call | vs current | exact? |
|---|---|---|---|
| **A** current (`Object.keys().sort()` + `join(",")`) | **1.158** | — | — |
| B drop the `sort()` | 0.79 | 1.5× | **NO** — 2000/2000 sigs change under key reorder; canonicality lost ⇒ hit-rate loss |
| C manual number encode (no `join`) | **0.503** | **2.3×** | yes |
| D positional (fixed `BUFFS` order, index instead of name) | 0.671 | 1.7× | yes, **0 collisions** on 2000 schedules |

`Map.get` itself costs **0.011 µs** — 100× less than building the key. So the memo's entire overhead is
key *construction*, not lookup. At 1.98M calls, variant C's saving alone is ~1.3 s/solve of the ~31 s.

**Corollary (not in the original hypothesis list):** the key is `cfgSigOf(cfg) + "|" + sigOf(schedule)`.
`cfgSigOf` has an identity fast path so it is cheap to *fetch* — but it is a `JSON.stringify` of the
whole cfg (T, gear, `enabled`, `fixed`, **`segments`**), i.e. a long constant prefix that is
**re-concatenated onto every one of the 1.98M keys** and then re-hashed by `Map`. A **per-cfg memo**
(`WeakMap<cfg, Map<sig, result>>`) deletes the prefix, the concat and the `cfgSigOf` call in one move,
and makes eviction naturally per-cfg. This is strictly better than optimizing the concat.

### 3.3 H2 — **PARTIALLY MEASURED.** The wholesale `clear()` does throw work away

Hit rate 69.64%, but **5 wholesale clears** and 601,707 sets against a final size of 1,707: essentially
every cached entry computed during the run was eventually discarded. What is *not* yet measured is the
ceiling — how many of the 601,707 misses are **pure eviction loss** (a key that had been computed
before and thrown away) versus genuinely new schedules. `scratchpad/instrument2.mjs` answers it by
counting DISTINCT keys touched; if distinct ≪ misses, a generational cache recovers the difference.

Intended replacement (same memory bound as today if `CAP` is halved, strictly better hit behaviour —
and still deterministic, because eviction can only cause *recomputation*, never a different value):

```js
let r = SIM_MEMO.get(key);
if (r === undefined) {
  r = SIM_MEMO_COLD.get(key);                    // second chance before recomputing
  if (r === undefined) r = simulateRaw(schedule, cfg, collect);
  if (SIM_MEMO.size >= SIM_MEMO_CAP) { SIM_MEMO_COLD = SIM_MEMO; SIM_MEMO = new Map(); }
  SIM_MEMO.set(key, r);
}
```

### 3.4 H3 — **IDENTIFIED IN CODE** (not yet benchmarked)

`stepFor` (~818) is a **closure re-created inside the per-cast `while` loop**, and it returns a fresh
object literal `{cast, gcd, interval, capped}` up to twice per cast — order 10² casts × 0.6M simulations
≈ 10⁸ short-lived objects per solve. That is both its 4.8% self time and most of the 5.3% GC. `scanAt`
(~880) has the same shape (`{multDn2, mult2, dmg2, aoe}` per call, consumed immediately by `rateAt` /
`rampCastDmg` — a shared scratch object is safe). The breakpoint integral builds a `Set`, spreads and
sorts it per `simulate`, and allocates a closure per breakpoint in
`rampSpans.some(([ra, rb]) => mid > ra && mid < rb)`.

**Constraint:** these are float-arithmetic sites. Hoisting must not reorder any operation — the rewrite
has to be expression-for-expression identical, with the objects replaced by scratch/locals. The
exact-match suite is necessary but not sufficient here; the diff must be read as a proof.

### 3.5 H4 — **SIZED.** `repair` is 10.6% over 2.02M calls

`repair` (1018-1096) always allocates `out = {}` and rebuilds every track, and it is **idempotent** —
so the very common `repair(repair(x))` shape does full work for nothing. See §4.1: the better fix is not
a fast path but **fusion**.

### 3.6 H5 — pass-stack re-scoring

The 69.64% hit rate is the evidence that the memo already absorbs repeated incumbent scoring. No
separate algorithmic win expected; **not a target**.

---

## §4 Refactor notes — redundant steps, and steps that should be one step

*(User-directed, 2026-07-24: "note things that can be refactored, steps in the model's calculations that
are redundant, steps that can be combined together into a single and/or more efficient one." These are
NOTES — design candidates, each still owing a measurement and a byte-identical proof before it lands.)*

### 4.1 ★ The big one: **five walks over the same schedule per candidate**

The pass stack's inner loop is, almost everywhere, this shape:

```js
const rep = repair(cand, cfg);                        // walk 1 — rebuilds every track
if (!sameCounts(counts(base), counts(rep))) continue; // walk 2 — counts per track
if (clipOf(rep) > clipOf(base) + 1e-9) continue;      // walk 3 — clip per track
const rr = simulate(rep, cfg);                        // walk 4 — sigOf inside; walk 5 — simulateRaw
```

Four of those five walks traverse the *same* small object and are each O(tracks × uses). `repair`
already visits every use in order — it can **emit the signature, the counts and the clip as it goes**,
at essentially zero marginal cost, and return them alongside the schedule. That single change subsumes
H1 (no separate `sigOf` walk at all — 1.98M walks deleted, not merely made 2.3× cheaper), most of H4
(the redundant rebuild is amortized instead of skipped), and the `counts`/`clipOf` walks.

Shape: `repair` returns (or fills a caller-provided scratch record) `{s, sig, counts, clip}`; `simulate`
gains an overload that accepts a precomputed `sig`. **Risk: this is the widest-blast-radius change in
the file** — every call site must be converted, and any missed site silently falls back to the slow
path (correct, just slower), which is the *good* failure mode. Do it LAST, after the local wins, and
only with the suite green at each step.

### 4.2 Per-cfg memo instead of a concatenated key

Per §3.2: `WeakMap<cfg, Map<sig, result>>`. Deletes the `cfgSigOf` call, the `"|"` concat and the long
constant prefix from 1.98M lookups, shortens the hashed key by ~5×, and makes the generational eviction
of §3.3 per-cfg (so a neighbour-solve cfg cannot evict the main solve's hot set). Composes with 4.1 —
after fusion the key is simply the sig `repair` already produced.

### 4.3 `JSON.stringify` used as an equality test

At least three sites compare schedules with `JSON.stringify(a) !== JSON.stringify(b)` (the §5.11
canonical-tie branch, the `canonicalWindowOrder` no-op check). Both operands already have — or can
cheaply have — a signature; **sig comparison is exact and ~20× cheaper**. Pure win, tiny blast radius.
Good first landing.

### 4.4 Allocation in the hot loops (H3)

`stepFor` → a top-level function writing into a reusable scratch record (or inlined: only `interval` and
`capped` are consumed at the call site). `scanAt` → shared scratch. Breakpoint set → build the sorted
array once per (cfg, schedule) rather than per simulate; hoist the `rampSpans` predicate out of the
per-breakpoint closure. Expression-for-expression identical arithmetic is mandatory.

### 4.5 `cloneS` at 2.08M calls

Slightly *more* clones than repairs, so a clone is happening outside `repair` too — many candidates are
cloned, mutated in one or two slots, then repaired (which rebuilds everything anyway). A `withUse(s, key,
i, t)` copy-on-write helper that shares untouched track arrays would cut most of it, but only if callers
never mutate a shared array in place — **audit required before this is even a candidate.** Lower
priority than 4.1-4.4.

### 4.6 Explicitly NOT a target

- **Deleting a pass because it *looks* redundant.** The passes are the theorycraft; a pass that fires
  rarely is not a pass that fires uselessly (the escape/drop-one move exists for essentially one AoE
  geometry). What *is* in scope is the measured version of the same question — see §4.7.
- **`breathe()` cadence / worker-pool sizing.** Already tuned; the profile shows the cost is in the
  engine, not the scheduling around it.
- **Cross-haste pooling.** Ruled out as a cause of UI slowness: `cfg.poolHastes` is set **only** by the
  cross-val harness, never from the UI.

### 4.7 ★ The pass-firing census — the disciplined way to answer *"fewer steps that do the same thing"*

*(The user's ask is explicitly "grouping the rules and steps of the model into fewer steps that do the same
thing, getting rid of the redundant steps." §4.6 refuses the **guess**; this is the **measurement** that
makes the same question answerable without touching a plan.)*

**The provable form of the question.** A pass P is redundant **iff its input is already a fixpoint of P on
every case we can produce.** That is not a judgement call — it is a counter. And when it holds, deleting or
merging P is byte-identical *by construction*, so the exact-match suite is a sufficient gate.

**Do §4.9(A) first.** The accept path this instrument hooks currently exists in *five identical copies*;
collapsing them to one turns "instrument every accept site consistently" from a five-way opportunity for
error into a one-line change.

**Instrument (additive only, same monkeypatch trick as §3.1):** for each pass record
1. **entries** — how often it runs;
2. **firings** — how often it changes the incumbent at all (`val` or `s`);
3. **surviving firings** — how often that change is still present in the **emitted** plan.

(3) is the one that matters. A pass that fires and is then undone by a later pass is doing *negative* work;
a pass with zero **surviving** firings across the whole corpus is a merge candidate. Corpus = the 25
goldens **plus** the xval fight-class grid, so a pass isn't retired on the strength of the presets alone.

**Three structural suspicions already visible statically** (read-only, no run needed — each becomes a number
the moment the census exists):

- **`polish()` is a 40-round fixpoint over THREE move families** (single-use shift ladder → joint window
  move → escape/drop-one; `index.html:1137-1270`). Families 2 and 3 are already guarded to run only "once
  ordinary moves dry up", which is a hand-written subsumption rule. Record the **last round at which each
  family fired**: if nothing fires past round *k* on any case, the bound of 40 is generous by a measurable
  margin, and the per-round re-entry cost (a full `cloneS → repair → simulate` per candidate) is the most
  expensive thing in the profile.
- **Two nested fixpoints over overlapping pass sets.** The grooming block "grooms three times" (~1664)
  *and* there is a separate "final hop ↔ normalize fixpoint" (~2777, `Re-hop & canonicalize (round N)`).
  If the outer loop converges in one round on every case, rounds 2–3 are pure cost. If it *doesn't*, that
  is more interesting than the perf win — it means the pass order isn't confluent, which is worth knowing
  for its own sake.
- **`repair` is idempotent and applied at least twice per surviving candidate** — once inside every
  candidate evaluation and again on each `resolve(...)` path. §4.1's fusion makes the repeat nearly free;
  the census says whether it can simply be dropped at the resolve sites instead.

**Cost + scheduling.** This is a full instrumented run of the corpus — hours of CPU on 4 cores, and it
**must not overlap an acceptance round** (both saturate the box, and an acceptance round in flight also
freezes the engine). Run it in the gap after a round lands, before the next one starts.

**The trap to avoid.** Do not convert "fires on 1/25 goldens" into "delete it". The bar is **zero
surviving firings on the whole corpus**, and even then the merge must reproduce the pass's effect rather
than remove it — the point is *fewer steps doing the same thing*, not fewer things done.

### 4.8 Landing order (cheapest/safest first)

1. §4.3 sig-vs-`JSON.stringify` equality — trivial, exact.
2. §3.2/H1 cheaper `sigOf` encode (variant C or D) — pure function, same string ⇒ same behaviour.
3. §4.2 per-cfg memo + §3.3 generational eviction — behaviour-preserving by the eviction argument.
4. §4.4 hot-loop allocation — needs a read-the-diff proof, not just a green suite.
5. §4.1 the repair/sig/counts/clip fusion — biggest win, widest blast radius, do it last.

Gate at **every** step: `cd tests && CHROMIUM=/opt/pw-browsers/chromium node exact-match.mjs` = 25/25,
plus a wall-time re-measure so each step's real win is recorded next to its predicted one.

§4.7's census is deliberately **not** in this ladder. It gates a different class of change — *merging or
retiring* a pass rather than making the existing passes cheaper — and unlike 4.1–4.4 it is a measurement
first, so it can (and should) run in the CPU gap between acceptance rounds, independent of this order.

### 4.9 ★ The two dedups that need no measurement at all

§4.7 needs hours of CPU because it asks whether a pass does anything. These two ask nothing about
behaviour — they are *the same code written more than once*, findable by reading, and collapsing them is
byte-identical by inspection rather than by argument. They are the literal reading of "fewer steps that do
the same thing", and both are **enablers for §4.7**, so they land first.

**(A) `polish()` contains FIVE copies of one accept path.** Lines **1149, 1155, 1165, 1186, 1207** are
character-for-character identical bar the `break` label:

```js
if (v > val + 1e-7) { s = rep; val = v; improved = true; break /* outerW | outer */; }
```

and each is preceded by the same four-line preamble — `cloneS(s)` → mutate → `repair` → `simulate(...).robust`.
The three "move families" (single-use shift ladder; suffix shift; add-a-use; joint window move;
escape/drop-one) differ **only in the mutator**. One `tryMove(mutate) → bool` helper closing over
`(s, val, cfg)` collapses all five into a single accept path with the same order, the same `1e-7` epsilon,
and the same first-improvement-wins semantics.

Why this is the *first* thing to do rather than a tidy-up: **§4.7's instrument becomes a one-line change
instead of five.** Counting entries/firings/surviving-firings per move family means touching the accept
path — with five copies that is five chances to instrument one of them subtly differently and get a census
that is wrong in exactly the way that matters. (Three further accept sites — **1354, 1393, 2816** — share
the same `> x + 1e-7` rule but not the same surrounding shape; note them, do not force them into the same
helper.)

**(B) The block-shift primitive is written twice.** `polish()`'s joint window move (**1179–1181**) and
`teleportRep` (**1258–1260**) are the same loop:

```js
for (const key in cand) { if (cfg.fixed[key]) continue;
  for (let i = 0; i < cand[key].length; i++) if (Math.round(cand[key][i]) === X) cand[key][i] += delta; }
```

They differ only in how `delta` is expressed — polish shifts by a relative `d ∈ SHIFTS`, `teleportRep`
shifts to an absolute anchor (`delta = A − X`) — and in that polish counts how many uses moved. One
`shiftBlock(cand, cfg, X, delta) → moved` serves both. **Keep the `moved < 2` guard at polish's call
site**: it is a real rule ("lone uses are the per-key loop's job"), not shared plumbing, and folding it
into the helper would silently change what `teleportRep` legalizes.

This one matters beyond line count: the joint window move and the basin-hop teleport are *the same
physical idea* — press-windows are magnets, and a cluster has to move as a block or not at all — expressed
twice. Sharing the primitive makes that identity visible in the code, which is the point of the exercise;
the perf win (one fewer duplicated walk) is incidental.

Both are gated the same way as everything else: exact-match 25/25. Unlike 4.1–4.5 neither changes what is
computed, so a *failing* suite after either one means the refactor was wrong, never that the plans moved
legitimately — there is no `--update` branch here.
