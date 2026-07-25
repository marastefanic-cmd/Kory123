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

> **⚠ AMENDED by §4.15 — "almost everywhere" is measured at 20%.** A static call-site census puts the
> full quadruple at **8 of 41 `repair` sites**, with **14 bare** (schedule only). The fusion is still the
> big one, but it must emit its extra outputs **opt-in**, not unconditionally, or it pays new cost at a
> third of its own sites. §4.1's `sigOf` sub-claim survives intact.

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

> **⚠ CORRECTED — read §4.12 before acting on this section.** All three of its claims are wrong as
> written: "at least three sites" (there are **twelve**), "exact" (true here, but only by a five-step
> structural argument this section does not give), and "~20× cheaper" (**backwards** — measured
> **2.9× slower**). The half that survives is the *hoist*, not the swap. Kept in place unedited because
> §4.12 is a correction of this text and quotes it.

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

> **⚠ AMENDED by §4.14 — that dependency is a preference, not a block.** §4.9(A) is an engine edit, so
> reading this as a prerequisite made the census wait on the acceptance freeze. It doesn't have to:
> **§4.14** instruments a *copy* of the engine source in a blank second page (the same trick the shipped
> Blob worker already uses), so the census runs against today's frozen `index.html` without modifying it.
> Land §4.9(A) because five copies of one accept path is a defect, not because the census needs it.

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

> **⚠ AMENDED — items 1 and 2 are superseded; the revised ladder is in §4.13.** Item 1 (§4.3's swap) is
> **rejected on measurement**; item 2 (a cheaper hand-rolled `sigOf`) is **superseded** by the native
> encoder. Items 3–5 stand as written.

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

### 4.10 The §4.9 patch, written out (line anchors RE-VERIFIED 07-25 against `index.html`)

*(§4.9 says what to collapse; this is the code, so the landing is mechanical the moment the engine unfreezes.
Anchors confirmed by re-read: accept sites **1149, 1155, 1165, 1186, 1207**; block-shift twins **1179–1181**
and **1258–1260**; `polish()` spans **1137–1216**; `teleportRep` **1256–1263**. The three non-conforming
accept sites are **1341, 1354, 2816** — 1341/1354 read a `cache.get(sig).val` rather than simulating, so they
share the `> x + 1e-7` rule and nothing else. Leave them alone.)*

**(A) One accept path.** Insert at the top of `polish()`, after `let s = seed, val = simulate(s, cfg).robust;`:

```js
  // ONE accept path for every move family: clone → mutate → repair → simulate → strict-improve.
  // A mutator returning false VETOES before repair/simulate (the joint move's moved<2 rule).
  const tryMove = mutate => {
    const cand = cloneS(s);
    if (mutate(cand) === false) return false;
    const rep = repair(cand, cfg);
    const v = simulate(rep, cfg).robust;
    if (v > val + 1e-7) { s = rep; val = v; return true; }
    return false;
  };
```

Then each family becomes its mutator, keeping its own `break` target:

| site | now | after |
|---|---|---|
| 1145–1149 | single-use shift | `if (tryMove(c => { c[key][i] += d; })) { improved = true; break; }` |
| 1150–1156 | suffix shift | `if (i < s[key].length - 1 && tryMove(c => { for (let j = i; j < c[key].length; j++) c[key][j] += d; })) { improved = true; break; }` |
| 1161–1165 | add-a-use | `if (tryMove(c => { c[key].push(extra); })) { improved = true; break; }` |
| 1177–1186 | joint window move | `if (tryMove(c => shiftBlock(c, cfg, X, d) >= 2)) { improved = true; break outerW; }` |
| 1202–1207 | escape/drop-one | `if (tryMove(c => { c[key][j] += d; c[key].splice(i, 1); })) { improved = true; break outer; }` |

**Why byte-identical, argued not assumed.** (i) Every mutator performs the *same statements in the same order*
on the same freshly-cloned object — no float expression is rewritten, only relocated. (ii) `cloneS(s)` moves
from the call site into the helper, but `s` is unchanged between the old clone point and the old mutate point
in all five, so the cloned bits are identical. (iii) The veto returns **before** `repair`/`simulate`, exactly
where the old `continue` sat, so the *sequence of `simulate` calls* is unchanged — which matters because the
memo's `CAP` eviction is call-order-dependent (eviction can only force a recompute, never change a value, but
keeping the sequence identical means we don't even need that argument). (iv) `improved = true` stays at the
call site rather than inside the helper, so the suffix-shift's guard (`i < s[key].length - 1`) still
short-circuits before any clone.

⚠ **One thing that is NOT free:** the helper creates an arrow closure per candidate — ~22 per `(key, i)` in the
SHIFTS loop. That is allocation in the hottest loop in the file, i.e. the same class of cost §4.4/H3 is trying
to *remove*. Predicted to be noise next to `cloneS + repair + simulate` (µs vs. ns), but the landing gate is
**25/25 AND a wall-time re-measure**; if it regresses, hoist the five mutators to module scope taking
`(c, ctx)` instead of closing over `key/i/d`. Do not land it on the census argument alone.

**(B) One block-shift.** New top-level function next to `teleportRep`:

```js
// Press-windows are magnets: a cluster at one press second moves as a block or not at all.
// Shared by polish()'s joint window move and basinHop's teleport. Returns how many uses moved.
function shiftBlock(cand, cfg, X, delta) {
  let moved = 0;
  for (const key in cand) {
    if (cfg.fixed[key]) continue;
    for (let i = 0; i < cand[key].length; i++) if (Math.round(cand[key][i]) === X) { cand[key][i] += delta; moved++; }
  }
  return moved;
}
```

`teleportRep`'s body collapses to `const cand = cloneS(baseS); shiftBlock(cand, cfg, pr.X, pr.A - pr.X); return repair(cand, cfg);`.
The one arithmetic difference is that `pr.A - pr.X` is now evaluated **once** instead of per matching use —
identical by IEEE determinism (both operands are plain numbers, unchanged across the loop). The `moved < 2`
guard stays at polish's call site as `>= 2` inside the mutator, per §4.9(B).

**Landing order within §4.9:** (B) first — it is 8 lines, touches two call sites, and cannot interact with the
accept path. Then (A). Re-run `cd tests && CHROMIUM=/opt/pw-browsers/chromium node exact-match.mjs` after
each, separately, so a failure names its own cause.

### 4.11 ⚠ THE SCOPE GUARD on §4.9(A) — **there are TWO accept tolerances, and only one is an epsilon**
Static census of `index.html` (lexical, free — the *dynamic* counts §4.7 wants still need the instrumented
run): **63 `simulate(` call sites and 42 `repair(` sites**. The accept-shaped ones split into two families
that look alike and are semantically opposite:

| family | tolerance | sites | meaning |
|---|---|---|---|
| **strict-improve** | `1e-7` | 10 literals — polish's **5** (`1149,1155,1165,1186,1207`), plus `1341`, `1354`, `1393`, `2795`, `2816` | a floating-point epsilon: *any* real improvement is accepted |
| **material-improve** | `QTOL` | 13 sites (`1700,1715,1804,1832,1892,1916,1964,1986,2049,2094,2171`, …) | `const QTOL = castVal` (`index.html:1536`) — **one whole cast's expected damage** |

`castVal` is `(AVG_BASE_DMG + COEF·sp)·(1 + crit·(CRIT_MULT−1))·(t5two ? 1.2 : 1)` — for the campaign's
`sp≈1450` that is a *four-figure damage number*, i.e. `QTOL` is roughly **10 orders of magnitude** larger
than `1e-7`. It is not a sloppier epsilon; it is a deliberate materiality bar, the encoding of "a MATERIAL
improvement … outranks aesthetics" (`:1714`) and the reason a cosmetic reshuffle can't outrank a real cast.

**Therefore: `tryMove` (§4.10) must NEVER be applied to a `QTOL` site.** Folding them in would silently
replace a whole-cast materiality bar with a float epsilon, and every aesthetic tie in `fired`/`isAnchored`/
`nulledIn` would start winning against the layout the pass exists to protect. That is a **plan-changing**
edit wearing a refactor's clothes — the exact failure the byte-identical constraint is meant to catch, and
it would be caught (goldens would move), but it would cost a debugging session to attribute.

§4.10's scope — polish's five `1e-7` sites and nothing else — was already right. This section records the
*reason*, so a later reader who greps "13 accept-shaped sites, dedup them all" stops here instead.

Also out of scope, and why (they share the `1e-7` epsilon but not the shape):
- **`1341` / `1354`** — reduce over a *cache of pre-scored candidates* against `bestV`/`bestS`; there is no
  clone→mutate→repair→simulate chain to hoist, and `1341` reads `cache.get(sigs[k]).val` rather than scoring.
- **`1393`** — `optimizeCore`'s final best-of accumulator, carrying `csNote`/`squeakNote` through the accept.
- **`2795`** — a *stability assertion* (`hop2.val <= simulate(s,cfg).robust + 1e-7`), not an accept at all.
- **`2816`** — accepts `p.s` from a precomputed list into `s`/`val`/`again2`, a different state triple.

*Caveat on the census itself:* the per-function attribution is **lexical** — each call site is charged to the
nearest preceding `function`/`const … = (` declaration, so call sites inside nested arrows are charged to the
inner helper (`fired @2112`, `nulledIn @2291`, `canonicalWindowOrder @2730`) rather than the enclosing pass.
It bounds *where the code is*, not *how often it runs*. §4.7's instrumented run remains the only thing that
can rank passes by actual cost, and it still needs its CPU gap.

### 4.12 The §4.3 patch, written out — and §4.3's premise CORRECTED

*(§4.3 sits at the top of §4.8's landing ladder: "sig comparison is exact and ~20× cheaper. Pure win, tiny
blast radius. Good first landing." Writing it out as a landable patch meant checking its claims first. **Both
were unproven, and one is false.** A patch survives — but for a different reason, in two separable halves,
with a different site list, and with the half §4.3 actually proposed rejected.)*

#### 4.12.1 What §4.3 got wrong

**"At least three sites."** There are **twelve** schedule-equality comparison sites, in two shapes (anchors
re-verified 07-25 against `index.html`):

| shape | comparison sites | the invariant operand's stringify |
|---|---|---|
| **A** — already hoisted | `1697`, `1801`, `1889`, `1907` | `const curSig` at `1683`, `1784`, `1883` |
| **B** — both operands stringified in-loop | `1951`, `1961`, `1983`, `2037`, `2092`, `2169`, `2533`, `2767` | *not hoisted* |

Two further `JSON.stringify` uses are **not** in scope and must be left alone: `:649` (`simMemoCfgSig` — a
*cfg* key, not a schedule) and `:4036` (`lsSet` — serialization, not a comparison). *(A working note during
this pass said "14 sites"; that counted the three hoisted `curSig` **declarations** as if they were
comparisons. Twelve is the number.)*

**"Exact" — false as a general statement.** `sigOf` (`:1276-1281`) does `Object.keys(s).sort()`;
`JSON.stringify` preserves **insertion order**. Two schedules with identical key→values maps but different key
insertion order are **equal under `sigOf` and unequal under `JSON.stringify`**. That is not hypothetical here:
`repair` (`:1018`) rebuilds its output object with the shared-lockout trinket group FIRST — fixed group keys at
`:1033`, movable group keys at `:1061` — and only then the remaining keys in the input's own order (`:1063`).
`repair` demonstrably reorders keys, so the two predicates are interchangeable only if **both operands' key
orders always agree**. §4.3 asserted that; it did not establish it.

**"~20× cheaper" — never measured, and it has the sign backwards.** §3.2's own bench already put `sigOf` at
**1.158 µs/call**, so a signature is not free, and the swap replaces *two* `JSON.stringify` calls with *two*
`sigOf` calls. Measured properly in §4.12.7: **2.9× slower.**

#### 4.12.2 The two halves

Separating them matters because their risk profiles are opposites.

**(A) Hoist the loop-invariant operand — Shape B becomes Shape A.** Semantics untouched: the same predicate on
the same values, just not recomputing a string that cannot have changed. Byte-identical *by construction*, no
probe needed. This is the free half.

**(B) Swap the predicate — `JSON.stringify` → `sigOf`.** This changes what "equal" means, and is only
byte-identical if key orders always agree. This is the half §4.3 assumed away.

#### 4.12.3 (A) is worth much less than the site count suggests — the per-site redundancy audit

A hoist only pays when the operand is invariant across a loop that runs **many** times. Reading each Shape B
site's enclosing loop:

| site | enclosing candidate loop | iterations | invariant operand | verdict |
|---|---|---|---|---|
| `1951` `isAnchored` | called from `for (const key in s) … forEach` (`1970-1973`) | **keys × uses, per cluster, inside a `while` fixpoint** | `s` | ★ **the real win** |
| `2533` | `for (let li …)` inside the alternatives nest | many | `base` (never reassigned) | ★ real |
| `1983` | `for (const anchor of uniq)` | ≈ #uniq | `s` | worthwhile |
| `2169` | `for (const to of targets)` | 2 × #phases5 | `s` | worthwhile |
| `1961` | `for (const target of distinct)` | small | `s` | marginal |
| `2037` | `for (const [from,to] of [[b,a],[a,b]])` | **2** | `s` | negligible |
| `2092` | `for (const tighten of [false,true])` | **2** | `s` | negligible |
| `2767` | **no inner candidate loop** — one evaluation per `(fk, ft)` | **1** | `sx` | **not a redundancy site** |

So "seven sites paying a redundant stringify" is really **two sites that matter, two more worth taking, and
four that are noise** — and `2767` is not a redundancy site at all. `2767` is also the one site whose operand
is reassigned *without* breaking its loop (`sx = rep` at `:2771`), so a naive hoist there would be wrong as
well as pointless. **Leave `2767` alone.**

Safety of the hoist at the other seven: at `1961`, `1983`, `2037`, `2092`, `2169` the incumbent `s` is
reassigned **only** on an accept that immediately `break`s the loop being hoisted out of (`:1964`, `:1986`,
`:2066` after the loop, `:2096`, `:2173`), so the hoisted string is never stale. At `2533` the operand is
`base`, which the nest never writes. At `1951` the caller's `for (const key in s)` block only *gathers* into
`near` — it does not touch `s`. (Shape A's `1883` `curSig` serving two loops is safe for the same reason: the
only assignment between them, `:1894`, `break`s the enclosing `groups` loop.)

#### 4.12.4 (B): the swap IS exact here — by a proof §4.3 never gave

The general statement is false; the statement *at these sites* is provable.

1. **`repair` preserves the key set exactly.** Group keys are always emitted (`:1033`, `:1061`), and the tail
   loop assigns `out[key] = times` unconditionally at `:1093` — a key whose uses are all dropped still emits
   `[]`. No key is added or removed.
2. **`repair`'s output key order is a pure function of (input key order, `cfg.fixed`)**, namely
   `R(x) = [G_fixed] ++ [G_movable] ++ [x's remaining keys, in x's order]`, where `G` is
   `OFF_TRINKETS ∩ keys(x)` in `OFF_TRINKETS` order (`:618`).
3. **Therefore `R` is order-idempotent**: `R(R(x)) = R(x)`. `R(x)` already begins with `G_fixed ++ G_movable`,
   and its remaining keys are `x`'s remaining keys in `x`'s order, so re-applying `R` reproduces it exactly.
4. **Every schedule in circulation is a `repair` output.** All three seed constructors return one —
   `naiveSchedule` `:1104`, `randomSchedule` `:1109`, `packedSchedule` — and every incumbent assignment in the
   pass stack is `s = rep` for some `rep = repair(...)`. `cloneS` (`:1097`) is `for (const k in s)`, so it
   preserves key order.
5. **Mutators change values, never keys** — `c[key][i] += d`, `c[key].push(extra)`, `c[key].splice(i,1)` (a
   *use*, not a key).

Chaining these: at every site one operand is `repair(cloneS(incumbent))` and the other is the incumbent
itself, which is already `R`-ordered — so by (3) both have **identical key order**, and `sigOf`'s sort is a
no-op difference. The encoding is also injective on this domain: buff keys are identifiers containing neither
`:` nor `;`, and press times are finite numbers, so `k + ":" + times.join(",") + ";"` cannot alias.

That is a construction argument, so it can have a hole. The empirical backstop is §4.12.6 — and the proof is
reused, for a much larger win, in §4.13.

#### 4.12.5 The asymmetry that decides how much the proof is worth

If the two predicates ever disagreed, the direction would matter, and not symmetrically:

- **`JSONdiff / SIGsame`** (same map, different key order) — at the eleven `if (equal) continue;` sites this
  makes the engine **skip a candidate it evaluates today**. A real move disappears; the plan can move. This is
  the dangerous direction.
- **`JSONsame / SIGdiff`** — impossible for finite values given §4.12.4(5), and *benign* at the `continue`
  sites anyway (an identical schedule re-scores identically and cannot clear `+1e-7`) — **except at `2533`,
  which is a `!==` guarding `tieRep = rep`. There a spurious "different" would install a canonical tie the
  engine does not install today.** So `2533` is the one site where both directions are plan-changing, which is
  reason enough to keep it in the probe rather than reason it away.

#### 4.12.6 The probe — proving it instead of asserting it

`$SP/p9/mkprobe.mjs` builds an instrumented copy of `index.html` in which every one of the twelve sites calls

```js
function EQ(site, a, b) {
  const j = JSON.stringify(a) === JSON.stringify(b);
  const g = sigOf(a) === sigOf(b);
  window.__EQ.n++;
  if (j !== g) { /* count by site AND direction, keep the first example */ }
  return j; // behaviour UNCHANGED: the probe run emits the real engine's plans
}
```

Returning the **JSON** answer is the point: the instrumented build is behaviourally the shipped engine, so the
same run doubles as its own positive control — the 25 emitted plans must still match `tests/golden.json`. Per
the 07-25 false-pass lesson the builder asserts an expected hit count for **every** rewrite and then rejects
any un-instrumented `JSON.stringify` equality line it does not recognise, and the runner exits **2** on
pageerror, on zero presets, or on zero recorded EQ calls — a probe that patches nothing and then reports "0
disagreements" is exactly the defect class this project spent 07-25 removing.

**Result — the whole corpus, one run** (`$SP/p9/run-eqprobe.mjs`, ~16 min wall, 8:17 renderer CPU):

```
POSITIVE CONTROL (probe emits the real plans): 25 passed, 0 failed  of 25
EQ-PROBE: 228685 schedule-equality tests, 0 where sigOf disagreed with JSON.stringify
```

228,685 tests, zero disagreements, in either direction, at any of the twelve sites. Together with §4.12.4 that
is as settled as this project gets: the proof says *why*, the corpus says *and it holds where we actually go*.

**★ And then the probe failed its own negative control.** "0 disagreements" is only evidence if the counter
*can* fire, so `$SP/p9/negctl.mjs` feeds `EQ` the exact pathology the swap risks — `a = {icyVeins:[10,200],
mqg:[30]}` against a `b` holding the same map built in the opposite key order — and requires it to be counted,
in the right direction, at the right site; then feeds it two agreeing pairs and requires it *not* to count
them. It found a real bug: the direction label's ternary was inverted (`j ? ':JSONdiff/SIGsame' : …`, where
`j` true means JSON said *same*), so every disagreement would have been filed under the opposite name — and
the dangerous direction above is precisely what you would read off that label. Fixed, rebuilt, re-run:
`NEG-CTL PASS`.

The corpus verdict survives untouched — `__EQ.dis` increments *before* the label is computed and was 0, so no
label was ever emitted — but that is luck, not design. **This is a first-person instance of the very defect
class the 07-25 sweep removed from 14 tools** (DIARY: *"dry-run against known-nonempty data is not enough —
the instrument must also be run against known-BAD data and required to fail"*), committed by the same hand
that wrote the lesson down, days later, while deliberately trying to obey it. The rule it earns: **a negative
control is not optional even for a 30-line probe.** It costs minutes, against a 16-minute corpus run whose
output you would otherwise simply believe.

#### 4.12.7 The bench — what an equality test actually costs

`$SP/p9/bench-eq.mjs`, in the real page, on §3.2's schedule population, with `K = 16` candidates per invariant
operand so the hoist is charged the way the code would actually run it:

```
schedule-equality predicates — 2,000 tests/rep, K=16 candidates per invariant operand

  J2  stringify BOTH        (Shape B today)    0.879 µs/test   1.00× vs J2
  J1  invariant hoisted     (§4.12 A)          0.510 µs/test   1.72× vs J2
  S2  sigOf === sigOf       (§4.12 B)          2.580 µs/test   0.34× vs J2
  S1  sigOf, hoisted        (A+B)              1.580 µs/test   0.56× vs J2

single-key encoders (the memo keys, 1.98M/solve):
  E_json JSON.stringify(s)  (native)           0.483 µs/call   2.90× vs sigOf
  E_sig  sigOf(s)           (today's key)      1.400 µs/call   1.00× vs sigOf
  E_c    variant C          (§3.2 hand-roll)   0.802 µs/call   1.74× vs sigOf

predicate disagreements on this population: 0 / 2000
reference: repair 2.250 µs/call — one equality test is 39.1% of one repair
```

Three things fall out, and the middle one kills half the patch.

1. **The hoist is real: 1.72×**, and at 39.1% of a `repair` an equality test is not noise inside its own loop
   body.
2. **★ The swap is 2.9× SLOWER, not "~20× cheaper".** `sigOf` is a JS loop building a string through
   `Object.keys().sort()` and `Array.join`; `JSON.stringify` on a small plain object of number arrays is
   native serialization. Betting against the engine's own C++ was the error — an intuition ("a compact
   hand-rolled encoding must beat a general-purpose serializer") written into a plan doc as if it were a
   measurement.
3. **The bench's own first draft measured nothing.** Its "hoisted" variant stringified *both* operands per
   test — identical work to J2 — and duly reported `1.01×`, which would have produced a confident "not worth
   it" verdict about a transform it was not testing. Same defect class as the label bug; third instance in one
   section. It is recorded in that file's header comment so the mistake stays visible.

#### 4.12.8 Landing decision

**Land (A). Reject (B). Strike §4.3 from the top of the ladder.**

- **(A) hoist the invariant operand** at the four sites where the enclosing loop is long — **`1951`, `2533`,
  `1983`, `2169`** (§4.12.3). Byte-identical by construction, 1.72× on the test, no probe needed. `1961` is
  optional (take it for uniformity, expect nothing); **`2037` and `2092` are noise — skip them**; **`2767` is
  neither redundant nor safe — leave it exactly as it is.**
- **(B) the sig-swap: REJECTED on measurement.** It is *exact* here (§4.12.4 plus 228,685 tests), which is
  worth knowing and is exactly what §4.13 spends — but at 2.9× slower there is no reason to spend that
  exactness on the comparison sites.
- Gate: exact-match 25/25. (A) hoists a pure computation whose operand cannot change inside the loop, so a
  *failing* suite means the hoist was placed wrong, never that a plan legitimately moved.

**What §4.3 cost, and the rule it earns.** §4.3 was three sentences and it was wrong three ways: the site
count (3 → 12), the exactness claim (asserted; actually needs a five-step structural argument), and the cost
claim (20× cheaper → 2.9× slower). It sat at the top of the landing ladder as "trivial, exact, good first
landing" — and taken at its word it would have made the engine **slower** while changing the predicate at
twelve sites on the strength of an unexamined assumption. **A perf claim written without a measurement is not
a plan item; it is a hypothesis, and it belongs in the hypothesis table (§3.x) with a verdict column, not in
the ladder.**

### 4.13 ★★ The finding that came out of the bench: `JSON.stringify` is a CHEAPER memo key than `sigOf`

§4.12.7's point 2 is much bigger than the patch that produced it. `sigOf` is not primarily a comparison
helper — it is **the memo key**, and §3.1 counted **1,984,160 calls per solve**.

`sigOf` has exactly three usages in the file:

- `:1276` — the definition;
- `:654` — the sim memo, `const key = cfgSigOf(cfg) + "|" + sigOf(schedule);`
- `:1351` — basinHop's candidate cache, `const sg = sigOf(rep); … cache.set(sg, p)`, read at `:1341`.

At **0.483 vs 1.400 µs/call** the native encoder saves ~0.92 µs on each of 1.98M calls ≈ **1.8 s of CPU per
solve** — an order of magnitude more than §4.12 itself — and it *also* beats §3.2's fastest hand-rolled
candidate (variant C, 0.802 µs) by 1.66×. That **retires §4.8's old item 2**: the answer to "cheaper `sigOf`
encode" is not a better hand-roll, it is **delete the hand-roll and call the native one**.

**Correctness.** A memo key must be *injective* (two different schedules must never collide) and *canonical*
(two equivalent schedules must produce one key, or the memo just misses). `sigOf`'s sort buys canonicality —
and §4.12.4's R-order proof shows the sort is a **no-op** on every schedule that reaches these two call sites
(all are `repair` outputs or `cloneS` of one; `R` is order-idempotent), which the 228,685-test probe confirms
empirically at the comparison sites.

**And the failure mode is the good one.** If the proof has a hole and two key orders *did* diverge,
`JSON.stringify` yields two keys for one schedule: a memo **miss** → a recompute → the same value. Slower,
never wrong. (Contrast the injectivity half, where a collision *would* return a wrong score — which is why
§4.12.4's injectivity argument is the load-bearing one and canonicality is merely a performance concern.)
Identical argument for basinHop's cache: a miss re-scores.

**Landing.** New ladder item 1 below. Keep `sigOf` defined — §4.7's census and any future debugging want a
stable order-canonical form — but stop calling it on the hot path.

#### 4.13.1 The revised landing order (supersedes §4.8's items 1–2)

> **⚠ AMENDED by §4.16.** Two items land *ahead* of everything below, and they change item 5's shape:
> **(0a) extract the `admit` helper** — the legality prefix written longhand at 9 sites, byte-identical
> by construction, worth landing on legibility alone; **(0b) hoist `counts(base)`/`clipOf(base)`** out of
> the candidate loops, which completes a hoist the code already performs for `simulate` at the same
> scope. After 0a, item 5's "every call site must be converted" becomes **one** call site.

1. **§4.13 native `JSON.stringify` as the memo key** — replaces `sigOf` at `:654` and `:1351`. Biggest
   measured win per line changed (≈1.8 s CPU/solve); miss-not-corruption failure mode.
2. **§4.12(A) hoist the loop-invariant operand** at `1951`, `2533`, `1983`, `2169` — byte-identical by
   construction, 1.72× on the equality test.
3. §4.2 per-cfg memo + §3.3 generational eviction — behaviour-preserving by the eviction argument. *(Composes
   with item 1: after it, the key is one native string with no `"|"` concat and no cfg prefix.)*
4. §4.4 hot-loop allocation — needs a read-the-diff proof, not just a green suite.
5. §4.1 the repair/sig/counts/clip fusion — biggest win, widest blast radius, do it last. *(Item 1 lowers its
   payoff slightly: the walk it deletes is now a 0.483 µs native call, not a 1.400 µs JS loop. §4.15/§4.16
   narrow it further: emit the extra outputs **opt-in**, and land it behind §4.16's `admit` so there is one
   consumer that uses all of them rather than 41 sites of which 14 want none.)*

Dropped from the old ladder: **§4.3's sig-swap** (rejected, §4.12.8) and **§3.2/H1's hand-rolled encoder**
(superseded by item 1). §4.9's two dedups still land ahead of all of this as §4.7's enablers, and §4.7's
census still runs in a CPU gap rather than in this order. Gate at **every** step: `cd tests && CHROMIUM=/opt/pw-browsers/chromium node exact-match.mjs`
= 25/25, plus a wall-time re-measure so each step's real win is recorded next to its predicted one.

### 4.14 ★ The census does NOT need the engine to unfreeze — instrument a COPY of the source

§4.7 reads as blocked. It says *"Do §4.9(A) first"*, §4.9(A) is an edit to `polish()`, and the engine is
frozen until the acceptance round closes — so the one measurement that could answer *"which steps do the
same thing"* looks gated behind the thing it was supposed to inform. **It isn't, and the proof is already
in the file.**

**The mechanism.** `index.html:3280-3283` builds the optimizer worker *from the engine tag's own text* —
`document.getElementById('engine-src').textContent` → Blob → `Worker`. That is a standing, shipped proof
that the engine block **runs standalone from its source string**, with no DOM and no UI script. A census
tool can therefore do exactly what the worker does, with one extra step in the middle:

```
page A: goto file://index.html          → read engine-src textContent, and BOSS_PRESETS /
                                          GOLDEN_PRESETS / GOLDEN_DEFAULTS off window
node:   textual insertion of counters   → instrumented source (index.html NEVER written)
page B: about:blank + addScriptTag      → run the corpus against the instrumented engine
```

`index.html` is read, never modified; the freeze is respected in the strict sense (the shipped artifact is
byte-identical) rather than the loose one.

**Why a blank second page and not a re-eval over the loaded engine.** §3.1's monkeypatch works because a
top-level `function` declaration in a classic script becomes a property of the global object, so reassigning
it intercepts the engine's own internal calls. That trick has a hard ceiling, and it is the reason §3.1 could
only count *named top-level functions* and could never see inside `polish()`: the engine block also has
**fifteen top-level `const`/`let` declarations**, which are script-scoped rather than global properties, and
re-declaring one in a second classic script throws `SyntaxError: Identifier … has already been declared`.
A fresh page has no prior declarations, so the instrumented copy is the *only* copy and every internal call
site — including the five accept paths buried inside `polish()` — is the instrumented one.

Corollary worth writing down because it is easy to trip over: `BOSS_PRESETS`, `GOLDEN_PRESETS` and
`GOLDEN_DEFAULTS` live in the **UI** script (`:4125-4190`), not the engine, so page B does not get them by
construction. They must be read off page A's `window` and passed in **as data**. A census that quietly built
its own fight table instead would be measuring a corpus nobody has agreed on.

**★ The failure mode this instrument has, and the guard it therefore requires.** A textual instrument fails by
**not matching its anchor** — the insertion is silently skipped, that pass is never counted, and the census
reports **zero firings**. Zero firings is precisely the verdict that *retires a pass*. That is §19.11's shape
exactly: a conclusion whose entire evidence is an absence, reached by an instrument whose commonest bug
produces the same absence. Two guards are mandatory, and neither is optional politeness:

1. **Every insertion asserts its anchor matched exactly once.** `split(anchor).length - 1 !== 1` ⇒ print which
   anchor and `exit 2`. Not "warn and continue" — the whole value of the run is destroyed by one silent skip,
   and `exit 2` is this project's "could not grade".
2. **A positive control per counter.** Before any pass is called redundant, a counter *known* to be non-zero
   (`polish` entries, `repair` calls) must actually be non-zero on the same run. A census whose controls are
   all zero is measuring a page that never ran, and must refuse to grade rather than report a clean sweep.

**★ And the trust basis: the instrumented engine must still emit the same plans.** Before a single count is
believed, run a sample of the goldens through page B and compare the emitted plan text to page A's
uninstrumented output. If they differ, the census describes a *different optimizer* and every number in it is
about code we do not ship. This is cheap — the tool already holds both pages — and it is the only thing that
makes the counts mean anything. (It is also a second, independent check on guard 1: an insertion that landed
in the wrong place is far more likely to change a plan than to keep it.)

**What this changes in the plan.** §4.7's census moves out from behind the engine freeze and behind §4.9(A):
it can run in any CPU gap between acceptance rounds, on today's shipped engine, and its output is what tells
us whether §4.9's merges are safe rather than the other way round. §4.9(A) is still worth landing on its own
merits — five character-identical copies of one accept path is a defect regardless of what the census says —
it is simply **no longer a prerequisite**, so the dependency §4.7 records ("do §4.9(A) first") is downgraded
from *blocking* to *nice, because instrumenting one site beats instrumenting five*.

**Unchanged:** the census is hours of CPU on 4 cores and still **must not overlap an acceptance round**
(§4.7). The freeze was never the binding constraint — the box is.

### 4.15 ★ The static call-site census — and it CORRECTS §4.1's "almost everywhere"

`tools/pass-sites.mjs` (static; reads text, never runs the engine, so it costs no CPU and is safe to
run while an acceptance round saturates the box). It answers the question §4.1 answered in prose:
*how many sites does the fusion have to convert, and what does each of them actually want?*

```
node tools/pass-sites.mjs [--sites]
```

Result on `index.html` (engine block = lines 565–2943):

```
PASS-SITES repairSites=41 fullQuadruple=8 anyGuard=27 bare=14 shapes=7
```

| shape (which walks follow the `repair` within 8 lines) | sites |
|---|---|
| **bare** — none of the three guards | **14** |
| `counts`+`clip`+`simulate` — the full quadruple | **8** |
| `simulate` only | 7 |
| `counts`+`simulate` | 5 |
| `clip`+`simulate` | 5 |
| `counts` only · `counts`+`clip` | 1 · 1 |

**§4.1 says *"The pass stack's inner loop is, almost everywhere, this shape"* — at the site level that
is wrong.** The full quadruple is **8 of 41 sites, 20%**, and a **third of all sites (14) are bare**:
they call `repair` and consume only the schedule. So the fusion must **not** be all-or-nothing. A
`repair` that unconditionally emits `{s, sig, counts, clip}` would compute three outputs that 14 sites
throw away and that another 19 only partially use — paying new cost to remove old cost, on a third of
its own call sites. The shape that survives the census is an **opt-in output mask** (or a caller-provided
scratch record that the caller only reads the fields it wants), which is a strictly larger design than
§4.1 sketched.

**⚠ What this census does NOT say — and the distinction is the whole point.** A site count sizes the
**conversion work**; it does not size the **win**. §3.1's runtime census puts `repair` at **2.02M calls**,
and one bare site inside the hottest loop outweighs all eight quadruple sites if they sit in cold
branches. **Static tells you how many places you must not get wrong; only §4.7's runtime pass-firing
census tells you which of them are worth touching.** Neither replaces the other, and the landing order
in §4.13.1 must be driven by the runtime one.

Two sub-claims of §4.1 **survive** the census:
- *"no separate `sigOf` walk at all — 1.98M walks deleted"*. `sigOf` has only **3 textual occurrences**
  in the engine block (its definition included), so those ~2M walks come from it being called **inside
  `simulate`**, not from a spray of call sites. Fusing it into `repair` therefore needs `simulate` to
  accept a precomputed sig — exactly the overload §4.1 proposes — and the site conversion for this half
  is genuinely small.
- The `cloneS`/`repair` pairing. Static counts **42 `cloneS` vs 41 `repair`** sites; §4.5's runtime
  numbers are **2.08M vs 2.02M**. Two independent directions agree on a ~1:1 ratio, which is *consistent*
  with the clone-then-repair pairing §4.5 hypothesizes — though it does not prove the calls are pairwise
  matched, which remains a runtime question.

**Instrument note (it is the reason the numbers above are not the first ones this tool printed).** The
first draft counted **42** sites and 64 `simulate` occurrences. `index.html:2248` is a *comment* —
"…without this, `repair()` would move only the cooldown-bound icon…" — and the 8-line classification
window was reading commented-out guards as live ones. This file carries its theorycraft **inline by
design**, so its prose mentions `repair`, `simulate` and `clipOf` constantly; a census that cannot tell
comment from code over-counts in both directions at once. Fixed by stripping line comments before every
test, and — per the 07-25 ledger, *"hit-count assertions prove the instrument ran; only a negative
control proves it discriminates"* — the fix is backed by a **built-in self-test** on a fixture carrying
exactly that pathology (a comment naming `repair()`, a live site whose only `sameCounts` is commented
out). Running the tool with the stripping disabled makes the self-test fire and the tool **exit 2**, so
the discrimination is demonstrated rather than asserted. Exit contract as elsewhere: **0 = censused,
2 = could not census**; zero sites, a missing engine block, or a `repair` definition outside the block
are all hard errors, because "0 sites to convert" is a result this file cannot legitimately produce.

### 4.16 ★★ The admissibility triple — the *"fewer steps that do the same thing"* answer, found

§4.15 counted the sites. Reading them is what pays: the passes are **not** twelve different candidate
loops. They are twelve different *accept ladders* sitting behind **one legality prefix, written out
longhand every time**:

```js
const rep = repair(cand, cfg);
if (!sameCounts(counts(BASE), counts(rep))) continue;   // the move kept every use
if (clipOf(rep) > clipOf(BASE) + 1e-9) continue;        // and clipped no more past the kill
```

Verbatim — same calls, same order, same `1e-9` — at **5 sites** (`index.html:2208, 2391, 2527, 2576,
2627`), differing in **nothing but the name of the base variable** (`s` / `base` / `sx`). A 6th
(`:2766`) is the same triple behind a `JSON.stringify` no-op check; a 7th (`:2306`) folds the clip test
into a combined condition; two more use the counts half alone. Nine sites, one idea.

**The idea itself is right and is theorycraft** — a candidate is admissible iff it preserves the use
counts and does not clip more past the kill; the passes then differ in what they do with an admissible
candidate, and *that* difference is the model. §4.6's refusal to delete a pass is untouched. What is
duplicated is the sentence, not the rule.

```js
// one helper, nine callers
const admit = (cand, base, cfg) => {
  const rep = repair(cand, cfg);
  if (!sameCounts(counts(base), counts(rep))) return null;
  if (clipOf(rep) > clipOf(base) + 1e-9) return null;
  return rep;
};
// at the call site:  const rep = admit(cand, s, cfg); if (!rep) continue;
```

Byte-identical **by construction**: same three calls, same order, same short-circuit, same epsilon —
the transform moves text, not arithmetic. (Which is a claim the suite must still *prove*, per the
standing rule; "by construction" earns it a cheap proof, not an exemption from one.)

#### The larger win is hiding inside it: **two of the prefix's walks are loop-invariant**

The prefix costs five walks per candidate — `repair`, `counts(rep)`, `counts(base)`, `clipOf(rep)`,
`clipOf(base)` — and **`counts(base)` and `clipOf(base)` do not depend on the candidate.** They are
recomputed for every candidate in loops that are two and three deep (`:2527` sits inside `for order` ×
`for li` × the slot build).

Audited per site rather than assumed: at `:2208`, `:2391` and `:2527` the base (`s`, `base`) is assigned
only **after** the candidate loop ends; at `:2576` and `:2627` the base (`sx`) is assigned only in the
accept branch, which `break`s the inner loop and then the outer one, returning to an enclosing loop that
restarts the scan. So the base is invariant for the entire scan at all five.

**And the code already knows this.** Both `sx` sites open their scan with

```js
const r0 = simulate(sx, cfg).robust;      // hoisted — invariant across the candidate loop
```

hoisting the *most expensive* invariant walk out by hand, then recomputing the two cheap ones inside.
This is not a speculative transform; it **completes a hoist the author already started, in the same
function, at the same scope**. That makes it the safest item in this document — and unlike §4.3's
rejected swap it *deletes* work rather than trading one encoding for another, so it cannot come back
measured-slower.

#### This supersedes §4.1's landing plan

§4.1 proposes a `repair` that emits `{s, sig, counts, clip}` and warns that "every call site must be
converted" — 41 of them, of which §4.15 showed a third want none of it. Through `admit` there is
**exactly one call site to convert**: the helper. The fused `repair` then has a single consumer, and
that consumer uses **all** of its outputs, which is precisely the waste §4.15 objected to. The ordering
that falls out:

1. **`admit` extraction** — pure text motion, 9 sites → 1 helper, byte-identical by construction.
2. **Hoist `counts(base)`/`clipOf(base)`** out of the candidate loops — now a change to one signature
   (`admit(cand, baseCounts, baseClip, cfg)`) instead of nine call sites.
3. **Fuse the walk into `repair`** (§4.1) — behind the one helper, opt-in outputs, all consumed.

Each step is independently landable, independently revertible, and gated by the same exact-match 25/25.
**Still owed, and not to be skipped:** §4.7's *runtime* census, because everything above is a static
argument about where the work is written, not a measurement of where it is spent. Step 1 is worth
landing on legibility alone; steps 2 and 3 must show a profile delta before they are called wins.
