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

  > **⚠ CORRECTED by §4.17 — these two are not the same shape, and only one is a suspicion.** The final
  > hop ↔ normalize fixpoint (`:2786-2798`) **already early-exits** (`if (stable) break;`), so its rounds
  > 2–3 are not pure cost and never were. The groom loop (`:1667-1740`) has **no** groom-level break in
  > its 72-line body. The suspicion collapses onto that one loop — and §4.17 shows the fix needs no census
  > at all: rounds 1 and 2 are the *same function*, so a no-op round 1 provably implies a no-op round 2.
- **`repair` is idempotent and applied at least twice per surviving candidate** — once inside every
  candidate evaluation and again on each `resolve(...)` path. §4.1's fusion makes the repeat nearly free;
  the census says whether it can simply be dropped at the resolve sites instead.

**Cost + scheduling.** This is a full instrumented run of the corpus — hours of CPU on 4 cores, and it
**must not overlap an acceptance round** (both saturate the box, and an acceptance round in flight also
freezes the engine). Run it in the gap after a round lands, before the next one starts.

> **⚠ AMENDED by §4.17 — that price is for the RETIREMENT half only.** Proving a pass redundant is a
> universal claim (∀ cases: zero surviving firings) and costs the whole corpus. Proving one **not**
> redundant is existential (∃ one case: one surviving firing) and costs **one instrumented case**. Since
> §4.6 already expects most passes to be non-redundant, run the cheap elimination pass first and spend
> the CPU gap only on whatever survives it. The existential half is also **immune to §4.14's false-pass
> defect** — its evidence is a presence, and a broken instrument cannot manufacture a presence.

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

> **⚠ AMENDED by §4.16, §4.17, §4.18, §4.19 and §4.20.** Five items land *ahead* of everything below, and
> one of them changes item 5's shape. All five are provable before they are measured — none may be booked
> as a speedup until a profile says so. **§4.19 is the exception and therefore does *not* join them:** it is a
> predicted speedup, so it goes in the numbered ladder below as **item 1b**.
>
> - **(0a) extract the `admit` helper** (§4.16, patch written out in **§4.21**) — the legality prefix
>   written longhand at **7** convertible sites (⚠ **not 9** — §4.21 Class D: `:2347` and `:2666` omit the
>   clip guard *deliberately* and must keep their longhand line), byte-identical by construction, worth
>   landing on legibility alone. After it, item 5's "every call site must be converted" becomes **one**
>   call site. §4.21's Class C site (`:2306`) is a **reordering**, not text motion — it lands as its own
>   step, with its own measurement, and its sign is unknown in both directions.
> - **(0b) hoist `counts(base)`/`clipOf(base)`** (§4.16) out of the candidate loops — completes a hoist
>   the code already performs for `simulate` at the same scope.
> - **(0c) give the groom loop the early exit its sibling already has** (§4.17) — byte-identical by the
>   `f1 = f2` purity argument; a small, honestly-bounded win (one `challengePass` + one dry sweep).
> - **(0d) band the unbudgeted tail** (§4.18) — display-only, plan-neutral by inspection, and **not a
>   speedup at all**: it makes the drop-one-use escape visible so it can be profiled and so the bar
>   stops reading as a hang at 96%.
> - **(0e) revoke the blob URL and close the stale pool ports** (§4.20) — **UI script only**, so
>   plan-neutral by *construction* (the headless suite never executes it). Nearly free; fixes a
>   141.5 KiB-per-interruption Blob leak and an unbounded `MessagePort` accumulation. The third
>   lifecycle cost — abandoned in-flight `polish` jobs — is **recorded, not fixed**.

1. **§4.13 native `JSON.stringify` as the memo key** — replaces `sigOf` at `:654` and `:1351`. Biggest
   measured win per line changed (≈1.8 s CPU/solve); miss-not-corruption failure mode.
1b. **§4.19 pool the three unpooled candidate loops** (`:1502`, `:2815`, `:2882`) behind one `polishAll`
   helper, and rename `cfg._noPool` → `_noHastePool`. Placed here because it touches the same
   polish/cache path as item 1, so the two are measured in sequence rather than interleaved with unrelated
   work. Correctness argument is the one already shipped and verified for `basinHop`; two of the three
   loops are strictly easier than it (running maxima, no break, zero discarded work). **Predicted speedup
   ⇒ must show a wall-time delta or be recorded as a legibility change.**
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

> **⚠ AMENDED by §4.17.** "Hours on 4 cores" prices the *retirement* run. The **elimination** run — which
> only ever concludes "this pass fired, keep it" — costs one case, and needs neither of the two guards
> above, because a presence-shaped verdict cannot be produced by a silently-skipped insertion. The guards
> gate the retirement run. The box stops being the binding constraint for everything except that.

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

> **⚠ CORRECTED by §4.21.** Nine sites share the *shape*; only **seven** share the *rule*. Writing the patch
> out found that the two counts-only sites (`:2347`, `:2666`) omit the clip guard **deliberately** — at
> `:2666` the file says so outright (*"`clipOf` would wrongly veto a pure wash"*) — so converting them would
> add a rejection and change the plan. "Nine sites, one idea" is right about the idea and wrong about the
> blast radius. Read §4.21 before touching any of them.

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

1. **`admit` extraction** — pure text motion, **7** sites → 1 helper, byte-identical by construction
   (⚠ §4.21: 7, not 9 — and `:2306` is a separate reordering step).
2. **Hoist `counts(base)`/`clipOf(base)`** out of the candidate loops — now a change to one signature
   (`admit(cand, baseCounts, baseClip, cfg)`) instead of nine call sites.
3. **Fuse the walk into `repair`** (§4.1) — behind the one helper, opt-in outputs, all consumed.

Each step is independently landable, independently revertible, and gated by the same exact-match 25/25.
**Still owed, and not to be skipped:** §4.7's *runtime* census, because everything above is a static
argument about where the work is written, not a measurement of where it is spent. Step 1 is worth
landing on legibility alone; steps 2 and 3 must show a profile delta before they are called wins.

### 4.17 ★★ The census is CHEAP in the direction it usually resolves — and §4.7's suspicion 2 is half wrong

§4.7 and §4.14 both close on the same sentence: the census is *"hours of CPU on 4 cores"* and *"must not
overlap an acceptance round — the freeze was never the binding constraint, the box is."* That is true of
**one half** of the instrument, and the halves have wildly different prices. Pricing the whole thing at the
expensive half is why it has sat unrun through every CPU gap this phase has had.

#### The asymmetry

§4.7 defines redundancy as *"a pass P is redundant iff its input is already a fixpoint of P on every case we
can produce"* — a **universal** claim, and universals are expensive. But its **negation is existential**, and
existentials are nearly free:

| verdict | logical form | evidence | corpus needed | cost |
|---|---|---|---|---|
| P is **redundant** (retire/merge it) | ∀ cases: zero surviving firings | an **absence** | the whole corpus | hours |
| P is **not** redundant (keep it) | ∃ one case: one surviving firing | a **presence** | **one case that fires** | seconds |

And the *expected* answer for most passes is "not redundant" — §4.6 already argues the pass overlap is
deliberate, several routes into the same basin. So the elimination pass resolves most of the suspicion list
at the price of a single instrumented case, and the expensive run is owed only for whatever **survives**
it. That inverts §4.7's scheduling advice: don't wait for the CPU gap to start — **spend the gap only on the
survivors**, and thin the list today.

#### ★ And the cheap half is structurally immune to the defect that makes the expensive half dangerous

This is the part worth keeping. §4.14 mandates two guards (anchor-match assertions, positive controls)
for one reason: **the retirement verdict and the instrument's commonest bug produce the same output —
zero.** A silently-skipped textual insertion reads as "this pass never fired", which reads as "delete it".
That is §19.11's shape, and it is why the census needs a trust apparatus at all.

The existential half **cannot** have that failure. Its verdict is *"here is the case, the round, and the
firing"* — a **presence**. An insertion that failed to match its anchor produces no firing, so a broken
instrument cannot manufacture a keep; it can only fail to find one, which leaves the pass on the list where
it already was. The cheap direction is therefore not merely cheaper, it is **safe to trust before the guards
are built**, whereas no number in the expensive direction may be believed until they are.

(The guards are still mandatory — but they gate the *retirement* run, not the elimination run, and that
ordering means the instrument can produce useful output on its first day instead of its last.)

#### §4.7's suspicion 2, checked against the code: the two "nested fixpoints" are not the same shape

§4.7 groups them: *"the grooming block grooms three times (~1664) and there is a separate final hop ↔
normalize fixpoint (~2777). If the outer loop converges in one round on every case, rounds 2–3 are pure
cost."* Read against today's file, that is true of one and **false of the other**:

- **The final hop ↔ normalize fixpoint (`index.html:2786-2798`) already early-exits.** It computes
  `stable = hop2.val <= simulate(s, cfg).robust + 1e-7` and `if (stable) break;`. Rounds 2–3 run *only*
  when round 1's hop actually improved. They are not pure cost and never were.
- **The groom loop (`index.html:1667-1740`) does not.** `for (let groom = 0; groom < 3; groom++)` runs
  three times unconditionally — there is no groom-level `break` anywhere in its 72-line body.

So the suspicion collapses onto exactly one loop, and the fix does not need the census at all: **give the
groom loop the early exit its sibling already has, 1100 lines away.**

#### Why that exit is byte-identical — and it is an argument, not a hope

The rounds are not all the same function. Round 0 runs the sweeps; rounds 1 and 2 run
`await challengePass()` **first** (`if (groom > 0) await challengePass();`) and then the same sweeps. So

```
f0 = sweeps                       (round 0)
f1 = f2 = challengePass ∘ sweeps  (rounds 1 and 2 — identical functions)
```

If `f1(s) = s`, then `f2(s) = f1(s) = s`, and skipping round 2 changes nothing — **provided rounds 1 and 2
are pure in `s`**. Checked rather than assumed: the groom body declares every name it uses
(`sweep, key, kind, dur, cand, rep, r0, curSig, …` — 27 of them, all loop-local), and `challengePass`
allocates its own state per call (`const anchors = new Set([0]);` `:1591`, `const rowSecs = new Set();`
`:1625` — both **inside** the arrow function, re-created on each invocation). The only cross-round state is
the polish memo, which by definition returns the same value for the same input.

Note the boundary carefully: **round 0 → 1 is not eligible** (different functions — round 1 adds
`challengePass`), so a no-op round 0 proves nothing about round 1. Only 1 → 2 collapses. The guard is
therefore `if (groom >= 1 && unchanged) break;`, with `unchanged` a `JSON.stringify(s)` compare taken
across the round (§4.13: the native encoder is the cheaper key).

#### ⚠ Sizing it honestly — the win is smaller than "a whole groom round"

The obvious claim is "this saves a third of the grooming". It does not, because **the inner sweep loop
already self-terminates**: `for (let sweep = 0, sweptMoved = true; sweep < 8 && sweptMoved; sweep++)`. A
groom round that changes nothing runs **one** dry sweep, not eight, and then falls out. So the actual saving
of the skipped round is:

> one `challengePass()` + one dry sweep pass (every unfixed buff key × every use, `repair` + `simulate` per
> candidate) + one `JSON.stringify` paid on the rounds that *do* fire.

Real, but bounded — and **how often round 1 is a no-op is unmeasured**, which is precisely the cheap half of
the census described above. This is the same discipline §4.15 and §4.16 landed under: a static reading sizes
the *work*, never the *win*. Land it for the structural reason (a loop that cannot terminate early while its
sibling can is an inconsistency, not a design), gate it on exact-match 25/25 — where the purity argument
above is what makes a green suite *meaningful* rather than lucky — and only call it a speedup once a profile
says so.

#### Landing-ladder placement

Between §4.16's step 1 and step 2: it is smaller than the `admit` extraction, independent of it, and shares
its property of being provable before it is measured. It does **not** unblock or replace §4.7's census — it
*removes one of the three things the census was going to be asked*.

### 4.18 ★★ The file contains a hand-written cost model — and it stops 4% before the end

§1 measured where the time goes. But `optimizeCore` **already carries a second, independent cost model**,
written by hand and never checked against §1: the progress bands. The comment that installs them says so
outright (`index.html:1450`):

> *"honest progress (user-directed): labeled stages with real within-stage fractions, banded by the
> **MEASURED cost profile** (seeds ~4%, hop dominates, fixpoint rounds mostly cache-served) … truthful,
> instead of a bar stalled at 97% for a second run as long as the first."*

Two models of the same program, built from different evidence, is a free cross-check. Taking it produces
three findings, all verified statically.

#### (1) The bar's stage model ends at `:2792`, and the optimizer does not

There are exactly **three** `setStage` calls and **two** `stageFrac` sites in the whole file:

| band | stage | `index.html` |
|---|---|---|
| 0.00 → 0.10 | seed phase — `starts = 14` polishes | `:1456`/`:1464` (raw `onProgress`) |
| 0.14 → 0.72 | `Basin-hop (main sweep)` | `:1521` |
| 0.72 → 0.82 | `Grooming (ties & legibility)` | `:1525` |
| 0.82 → 0.96 | `Re-hop & canonicalize (round 1-3)` | `:2791` |
| — | **everything after** | *nothing* |

`awk 'NR>2792 && /setStage|stageFrac/'` returns **zero lines**. Every stage past the hop↔normalize fixpoint
reports nothing at all.

#### (2) The bands top out at 0.96, not the 0.98 the comment claims

`:2787` documents *"round 1 [0.82,0.91], round 2 [0.91,0.955], round 3 [0.955,0.98]"*. The formula two
lines below is `0.82 + 0.16 * (1 - 0.5^fx)`, which gives:

```
round 1: [0.8200, 0.9000]      round 2: [0.9000, 0.9400]      round 3: [0.9400, 0.9600]
```

The comment's numbers are not its own formula's (0.98 is the halving's *limit*, reached only as `fx → ∞`;
three rounds get to 0.96). So the unreported tail is **4% of the bar**, not 2%.

#### (3) The unbudgeted tail is not a rounding error — it is a `polish`-per-candidate loop

What runs in that 4%, before `best = { s, val }` is even assigned:

- **The drop-one-use escape** (`:2799-2827`). For every unfixed track with ≥2 uses, for every use index:
  `cloneS` → `repair` → **a full `polish()`**. On any strict improvement it breaks out and runs a **full
  `basinHop` + `normalize`**, then iterates — up to **4 rounds** (`while (again2 && guard2++ < 4)`).
- **The Cold-Snap chain search** (`:2882`), another `polish` per chain candidate, inside the `.then` of the
  recursive `optimizeCore` at `:2848`.

The sizing writes itself against the bands that *do* exist:

> The seed phase runs **14** polishes and is given **10%** of the bar.
> The drop-one-use escape runs **one polish per single-use drop candidate** — on a full kit that is already
> ~15 in a single round — plus up to **4 `basinHop`s**, and is given **0%**.
> A `basinHop` is the unit the bar prices at **58%**.

**⚠ Sized honestly, it is bimodal, and the common case is the cheap one.** `again2` is set only on a strict
improvement (`p.val > val + 1e-7`) and `break`s immediately, so when no drop wins — the usual outcome — the
escape costs **one round of ~15 polishes and no `basinHop`**: roughly the seed phase's whole workload, in a
band worth nothing. The expensive mode (an improvement found ⇒ a full hop, up to 4×) is exactly the mode
where the user is left staring at 96%.

#### What the cross-check actually says

The hand-written model names three stages — *"seeds ~4%, hop dominates, fixpoint rounds mostly
cache-served"* — and **omits the tail entirely**. So the "MEASURED cost profile" it was calibrated from
never measured the tail, and §1's `wall=31.49s` on case `long` contains time that the file's own cost
narrative does not account for. That is worth knowing before §4.7's census is designed: **a census whose
stage list is taken from the progress bands would inherit the same blind spot.**

It is also the precise pathology the comment was written to prevent. "A bar stalled at 97% for a second run
as long as the first" was fixed for the Cold-Snap comparison (it restarts the bar with its own label,
`:2848`) and reintroduced by the drop-one-use escape, which was added later and never given a band.

#### The fix is plan-neutral by inspection, and it is NOT a speedup

`setStage` and `stageFrac` (`:1514-1515`) only write `prog`/`stage.label` and call `onProgress`. No computed
value, comparison, or ordering anywhere reads them — they are display state, and in the headless suite
`onProgress` is inert. So re-banding is **provably plan-neutral**, the same class as §4.16's step 1: gated
by exact-match 25/25, but byte-identical by construction rather than by luck.

Sketch: compress the three fixpoint rounds into `[0.82, 0.90]`, give the drop-one-use escape `[0.90, 0.96]`
with a per-round `stageFrac(guard2 / 4)` and its own label, and leave `0.96 → 1.0` for the razor variant and
finalisation. The Cold-Snap comparison keeps its restarted bar.

**Do not book this as a performance win.** It makes nothing faster; it makes the slow part *visible*. It
earns its place in this phase for two reasons: task #57's report ("the tool has gotten slow again") is a
*perception* claim as much as a CPU one, and a bar that reaches 96% and then sits through a
polish-per-candidate loop is indistinguishable from a hang — and because you cannot profile a stage you
have not named.

#### Tie-back to §4.17

The escape's *existence* is not in question — §4.17's cheap existential test is already answered, in the
comment at `:2799`: it fires on `isc+scb` ("one AP on the Lust cluster beats two spread"), which is a
surviving firing and therefore a **keep**. The open question was never whether it does something; it is
what it **costs**, and that is a number nobody has, because the one instrument that would have shown it —
the progress bar — stops just before it starts.

### 4.19 ★★ The worker pool covers two of the five candidate loops — and the split tracks *history*, not independence

§4.18 asked what runs in the unbudgeted tail and found a `polish`-per-candidate loop. This section asks a
different question of the same code — *which loops run on the pool?* — and the two answers land on the same
twelve lines. That agreement is the cross-check working; the finding below is independent of it and larger.

#### The census

`poolMap` is called at exactly **two** sites:

| site | loop | reduction |
|---|---|---|
| `index.html:1456` | seed phase (`starts = 14` polishes) | argmax over independent results |
| `index.html:1336` | `basinHop`'s teleport sweep | first-accept-in-iteration-order |

`polish(` appears at **seven** sites. Two are the sequential fallbacks for the pooled loops above
(`:1353`, `:1461`), one is the pool worker's own body (`:3302`). The remaining **three are
polish-per-candidate loops that never touch the pool**:

| site | loop | candidates | reduction | discarded work if pooled |
|---|---|---|---|---|
| `:1502` | snap-to-whole-seconds | `results.slice(0, 6)` — **6, always** | running max, **no break** | **none** |
| `:2815` | drop-one-use escape | Σ over unfixed tracks with ≥2 uses of `\|uses\|`, × up to 4 rounds | first-accept, then `break` out of *both* loops | everything past the accepted candidate |
| `:2882` | Cold-Snap chain search | `chains` (2 base + per-slot compressions at two counts + kill-anchored pair) | running max, **no break** | **none** |

**`POOL` is live at all three.** The proof needs no instrumentation: the escape at `:2822` calls `basinHop`,
which uses `POOL`, in the same scope, three lines below its own sequential polish loop.

#### The sharpest form of it: `:1502` is twelve lines below `:1456`

The seed loop is pooled and carries the reason in its comment — *"each seed's polish is independent, so the
pool runs them all at once (order of `results` is by seed index either way — identical to the sequential
loop)"*. The snap loop sits in the **same function, the same async runner, with `POOL` in scope**, and is a
*purer* instance of the identical shape: six independent polishes, a running max, no data dependence
between iterations at all. It was not pooled.

So the pooled/unpooled split does not track independence, difficulty, or cost. It tracks **which loops
existed when the pool was written**. That is the same disease §4.16 found one level down — there, one
legality prefix written longhand at nine sites; here, one *candidate-evaluation loop* written at five, two
of which learned about the pool and three of which did not.

#### Each unpooled reduction is *simpler* than the one already shipped

The pool's correctness argument is already written, already shipped, and already verified (`:1225-1231`):
*"the pool changes only WHERE a candidate is polished, never which candidate is accepted next. Pooled and
sequential paths therefore return byte-identical plans (verified)."* `poolMap` keeps results **in item
order** by construction (`:1247`, and its comment says the reduction depends on it). Against that:

- **`:1502` and `:2882` are strictly easier than `:1336`.** Both are running maxima with strict `>` and no
  `break`, so *every* candidate is polished either way — there is no accept-order dependence to preserve
  and **zero discarded work**. Item-ordered results + the same running max = the same bits, for the same
  reason the seed loop above is already pooled.
- **`:2815` is basinHop's shape, minus the restart.** An acceptance `break`s the inner loop and then
  `if (again2) break` exits the outer one, so the scan **ends** at the first accept. One fan-out over all
  `(key, di)` pairs of the current `s` followed by first-accept-in-order is therefore exact — `basinHop`'s
  `i += j + 1` restart loop is not even needed. Its waste-on-accept is the same trade the shipped comment
  already prices as small, and doubly so here: an acceptance requires a strict improvement from *removing*
  a use.

#### ⚠ `cfg._noPool` is NOT the worker pool — and it reads exactly like it is

`_noPool` is checked at **one** site, `:1379`, inside `optimizeAsync`, where it disables the **cross-haste**
pooling (`cfg.poolHastes` — the PHASE7 straddle guarantee). Both places that set it (`:1390`, `:2848`) are
recursive `optimizeCore` calls that must not recurse into haste pooling. It has nothing to do with `POOL`,
which is gated only at `:1316` and `:1455`.

This matters because a reader arriving at the Cold-Snap comparison sees
`optimizeCore({ ...cfg, coldSnap: false, _noPool: true }, …)` immediately above the unpooled chain search
and concludes the CS path deliberately runs off-pool. **It does not.** Rename to `_noHastePool` as part of
this work; a name that mis-answers the exact question this section asks is a defect in its own right.

#### Sizing — honestly, and with the inference flagged

**The static half is checkable.** Unpooled polishes per solve: **6** (snap, always) **+** `|chains|` (CS,
whenever Cold Snap was consumed) **+** the escape's scan (≥1 round, always, whenever any unfixed track has
≥2 uses). At the file's own price for a polish — *"(~0.3–1 s)"*, `:1344` — that is **on the order of 8–30 s
of strictly sequential polish per solve**, against §1's `wall=31.49 s` on case `long`.

**The Amdahl half is an inference and must be labelled one.** The `~93%` figure at `:1227` is a
**pre-pool** measurement, and the composition of the remaining 7% was never measured. *If* the 93% divides
cleanly across `N = max(1, min(8, cores − 2))` workers, post-pool wall ≈ `0.07 + 0.93/N` of the pre-pool
run, so the sequential remainder is promoted to:

| N | cores | remainder share of new wall clock |
|---|---|---|
| 2 | 4 (this box) | 13% |
| 6 | 8 | 31% |
| 8 | 10+ | 38% |

with a hard ceiling of **14.3×** however many workers are added. This is also the shape of task #57's
report: the fast path got faster, so the slow path is what you now feel.

**Do not quote the 31% as measured.** What is measured is that three independent loops run sequentially;
what is inferred is how much of the wall clock they now own. §4.7's runtime census is what turns the second
into a number — the same caveat §4.16 and §4.18 close on, unchanged.

#### An open question for that census, not a claim

None of the three unpooled sites consult `polishCacheFor(cfg)` — only `basinHop` does (`:1315`). The snap
pass polishes rounded top-6 candidates and the escape polishes drop-variants that a later hop may re-teleport
into; whether those ever repeat is **unknown**, and a hit rate is exactly the sort of number the census
produces and inspection cannot. Recorded as a question.

#### The refactor

One helper, one place where the pool decision is made — the same shape as §4.16's `admit`:

```js
// results in ITEM order, pooled or not; each caller keeps its own reduce
const polishAll = async (cands, cfg) => POOL
  ? await poolMap(cands, s => ({ kind: "polish", cfg, s }))
  : cands.map(s => polish(s, cfg));
```

Five call sites collapse onto it; `:1455`'s `if (POOL)` / `else` fork disappears; the three unpooled loops
become fan-out + their existing reduce, unchanged.

**Landing.** Unlike §4.13.1's items 0a–0d, this **is** a predicted speedup, so it does not get to be booked
on inspection: it lands after the freeze, gated at exact-match **25/25** *and* a wall-time re-measure, and
if the re-measure does not move, it is a legibility change and gets recorded as one.

### 4.20 ★★ The word in task #57 is *"slow **again**"* — and three of its five named candidates resolve without a profiler

Task #57's description lists five suspects: *"simulate() inner-loop allocation, sigOf/JSON.stringify keying,
redundant fixpoint re-scoring across the pass stack, breathe() cadence, worker pool sizing."* Three of the
five have never been touched by this phase. Two of them close here — one falsified, one reframed — and the
third turns out to be about the **session**, not the solve, which is what the word *again* was pointing at
all along.

#### (a) `breathe()` cadence — **CLOSED, falsified**

`breathe` is `async`, `await`s another `async` (`tick`), and reads `performance.now()`; there are **20
`await breathe()` sites** in the engine block. That is the shape of a hot-loop tax, so the suspicion was
reasonable. It is wrong, on two independent readings:

- **Static.** Checked at six sites — `:1930`, `:2202`, `:2298`, `:2560`, `:2695`, `:2736` — and every one
  sits on an **outer** loop: a round counter (`snapRound < 6`, `round < 4`), a `(track, use)` index, a
  per-second list, a fixed-press list. **None is inside the innermost candidate loop.** At `:2202` the
  contrast is explicit: `breathe` is on the `i` loop over a track's uses, while the `for (let t = 0; t <=
  cfg.T - 1; t++)` candidate loop directly beneath it runs unbreathed. So `breathe` fires on the order of
  10²–10³ times per solve, against `repair`'s **2,019,660** (§3.1).
- **Profile.** `breathe`, `tick` and `performance.now` are all **absent** from §1's top list — from 100,392
  samples at 200 µs, in a profile that finds room for `cloneS` at 1.5% and `rateAt` at 0.5%.

The second argument is an **absence**, and §19.11 is exactly the warning against those. It is admissible
here only because the first argument is a presence: the static nesting explains *why* the profile is silent,
so the two agree for a reason rather than by coincidence. **CLOSED-by-profile, reopenable by §4.7's census.**

#### (b) Worker pool sizing — **reframed: one of the two reserved cores is reserved for a blocked thread**

`:3323`: `const n = Math.max(1, Math.min(8, (navigator.hardwareConcurrency || 4) - 2));`, with the comment
*"leave headroom for the orchestrating worker and the UI thread"*.

The orchestrating worker does not need headroom **during the phase that matters**. `poolMap` is
`await Promise.all(items.map(… POOL.run(…)))` — port round-trips — so while a fan-out is in flight the
orchestrator's thread is idle by construction, and the UI thread is animating a progress bar. On a 4-core
box that is `n = 2`: **2 of 4 cores busy during the 93% phase.** `− 1` would make it 3 of 4.

**This is a knob to SWEEP, not to argue.** `hardwareConcurrency` reports *logical* cores, so `− 1`
oversubscribes a hyperthreaded 2-physical machine, and browsers throttle background workers. What the static
argument buys is only a **shifted prior**: the reservation is half aimed at a thread that is provably
blocked. A secondary note for the sweep — fan-out width is bounded by candidate count, so `n > 14` cannot
help the seed phase and `n > 6` cannot help §4.19's snap pass whatever the machine has.

#### (c) ★★ The lifecycle: three accumulations, all on the **interrupted-run** path

*"Again"* is a claim about a session, not a solve, and the interactive loop is: type an input, watch a 30 s
solve, change your mind. `runOptimize` (`:3339`) handles that with
`if (engineWorker && engineWorkerBusy) { engineWorker.terminate(); engineWorker = null; }` — so **every
mid-solve input change** takes the path below.

| # | what accumulates | site | per interruption | fix |
|---|---|---|---|---|
| 1 | a `Blob` holding a full copy of the engine block | `:3314` | **141.5 KiB**, pinned for the page's lifetime | one line |
| 2 | a live, GC-rooted `MessagePort` in every pool worker | `:3297-3303` | `n` ports | small |
| 3 | abandoned in-flight `polish` jobs | `:3339` | up to `n` × ~0.3–1 s of CPU | **not fixable cheaply** |

1. **`URL.createObjectURL` is called at `:3314` and `revokeObjectURL` appears nowhere in the file.** Each
   `makeEngineWorker` mints a blob URL over `engine-src`'s text — **141.5 KiB** — and never releases it, so
   the Blob is pinned for as long as the page lives. The fix is the standard one: keep the URL, revoke it
   immediately after the `Worker` constructor returns (the worker holds its own reference to the loaded
   script).
2. Each interruption re-runs `attachPool`, which posts `n` fresh `MessagePort`s. The pool worker's handler
   loops `for (const port of e.data.ports) { port.onmessage = … }` and **never closes the ports it
   registered before**, so every pool worker gains one live port per interruption. A port with an
   `onmessage` is implicitly started and GC-rooted. This is **memory, not dispatch cost** — messages still
   go to exactly one port.
3. `terminate()` kills the orchestrator while up to `n` pool workers are **mid-`polish`**. A worker cannot
   be interrupted, so each finishes its abandoned job at the file's own price (`:1344`, *"~0.3–1 s"*) and
   posts into a dead port — burning up to `n` core-seconds *and* making the **new** run's first fan-out
   queue behind them. This is the one that is felt rather than merely held.

**Sizing, honestly.** (1) and (2) are memory and slow-burning: a hundred interruptions is ~14 MB and a few
hundred ports — real, worth fixing because it is nearly free, not because it is currently the bottleneck.
(3) is the CPU one, and it is **irreducible without a cooperative interruption check inside `polish`**: the
orchestrator's queue dies with the orchestrator, so the only stale work is the one in-flight job per port,
and nothing outside `polish` can stop it. **Record it; do not fix it.** The comment at `:3320` calls a dead
port *"harmless"*, and for correctness it is — the cost is a stutter on the next run, which is precisely
task #57's complaint.

#### Why none of this can move a plan, and why it still waits

All three sites are in the **UI script**, not the engine block — so they are plan-neutral *by construction*,
not by inspection: they do not run in the worker that computes a schedule, and the headless suite never
executes them at all.

**They still wait for the campaign.** Not because of the engine freeze — because `tools/xval-*.sh` load
`index.html` per case, so editing the file mid-round would mix two baselines inside one round, and every
line anchor in these docs would shift under a round that is still citing them. **Do not touch `index.html`
until `RERUN-DONE`.**

#### The pattern across §4.18–§4.20

Three consecutive readings of the same subsystem — the progress bands (§4.18), the pool's coverage (§4.19),
the pool's lifecycle (§4.20) — none of which needed a CPU cycle, all found by reading code that a shipped
comment had already described. **The comments describe the design as intended; a census describes it as
built.** Where the two differ is where the phase's findings have been.

### 4.21 ★★ The `admit` patch, written out — and **two of the nine sites must NOT be converted**

§4.16 established the idea and §4.13.1 put it at the head of the ladder as item **0a**, described there as
*"the legality prefix written longhand at 9 sites, byte-identical by construction"*. Writing the patch out —
site by site, against today's file — makes that description **wrong in a way that matters**: nine sites share
the prefix, but only **seven** share the *rule*. Two of them omit the clip guard **deliberately**, and folding
them into the helper would add a rejection that the pass was written to avoid.

This is the §4.15 lesson again at a smaller scale: the grep finds the *shape*, and only reading finds the
*rule*. It is also the more dangerous direction — §4.15 over-counted work, this would have shipped a
**behaviour change under a "pure text motion" label**.

#### The helper (unchanged from §4.16)

```js
// one helper, seven callers
const admit = (cand, base, cfg) => {
  const rep = repair(cand, cfg);
  if (!sameCounts(counts(base), counts(rep))) return null;
  if (clipOf(rep) > clipOf(base) + 1e-9) return null;
  return rep;
};
```

#### Class A — pure text motion, `continue`, 5 sites

`index.html:2208-2210` · `:2391-2393` · `:2527-2529` · `:2576-2578` · `:2627-2629`. Each is exactly:

```js
const rep = repair(cand, cfg);
if (!sameCounts(counts(BASE), counts(rep))) continue;
if (clipOf(rep) > clipOf(BASE) + 1e-9) continue;
```
→
```js
const rep = admit(cand, BASE, cfg);
if (!rep) continue;
```

with `BASE` = `s`, `s`, `base`, `sx`, `sx` respectively (indents 16/16/16/16/18 — the last is one level
deeper). Three lines become two at each; same calls, same order, same short-circuit, same epsilon.

#### Class B — same rule, different control flow, 2 sites

**`:2766-2769`** carries an extra no-op guard that stays at the call site:

```js
const rep = repair(cand, cfg);
if (JSON.stringify(rep) === JSON.stringify(sx)) continue;
if (!sameCounts(counts(sx), counts(rep))) continue;
if (clipOf(rep) > clipOf(sx) + 1e-9) continue;
```
→
```js
const rep = admit(cand, sx, cfg);
if (!rep || JSON.stringify(rep) === JSON.stringify(sx)) continue;
```

This **reorders** the stringify check after the counts/clip checks. Unobservable: all three are pure
predicates whose only effect is `continue`, nothing between them mutates, and `repair(cand, cfg)` is still the
first call in both spellings. *(The stringify itself is item 2's target, §4.12(A) — orthogonal, and this
patch must not pre-empt it.)*

**`:2702-2704`** ends the scan instead of skipping the candidate, and pre-builds its candidate via `shift(d)`:

```js
const rep = repair(shift(d), cfg);
// Feasibility is monotone in d (pulling earlier only adds constraints), so break on it:
if (!sameCounts(counts(sx), counts(rep)) || clipOf(rep) > clipOf(sx) + 1e-9) break;
```
→
```js
const rep = admit(shift(d), sx, cfg);
// Feasibility is monotone in d (pulling earlier only adds constraints), so break on it:
if (!rep) break;
```

The comment is load-bearing (it justifies `break` over `continue`) and stays put.

#### Class C — a REORDERING, not text motion: 1 site, and its sign is unknown

**`:2306-2310`** splits the prefix around a `simulate`:

```js
const rep = repair(cand, cfg);
if (!sameCounts(counts(s), counts(rep))) continue;
if (!(rep[key] || []).some(x => Math.abs(x - t) < 0.5)) continue;
const rr = simulate(rep, cfg);
if (rr.robust < r0.robust - 0.5 || rr.totalEarly < r0.totalEarly - 0.5 || clipOf(rep) > clipOf(s) + 1e-9) continue;
```

Converting it hoists `clipOf` **ahead of `simulate`**. The plan is unaffected — every path involved is a pure
`continue` and the intervening guard is one too — but this is *not* "byte-identical by construction", and the
performance sign is **genuinely unknown in both directions**:

- it **saves** a `simulate` on every candidate that fails clip, and
- it **costs** a `clipOf` on every candidate that currently never reaches the third term, because `clipOf` sits
  **last in a `||` chain** and is short-circuited away whenever either robust gate already rejects.

Which dominates is a rejection-rate question, i.e. a measurement. **Land it as its own step, after 0a, with
its own suite run and its own wall-time delta** — and revert it on a null result rather than keeping it for
tidiness, because it makes the guard order at that site disagree with the other seven.

#### Class D — ⚠ DO NOT CONVERT: 2 sites where the missing clip guard is the point

**`:2666`** (`dodgeDowntime`) and **`:2347`** (the fixed-window snap) use `sameCounts` with **no clip test
anywhere in the loop**. At `:2666` the omission is documented, in the file, as deliberate:

> *"Model-neutral gate + sameCounts. **No clip guard: sliding to the exit ends the window later (more
> past-kill seconds) but the LIVE portion is unchanged — `clipOf` would wrongly veto a pure wash.**"*

That is theorycraft, not an oversight: this pass slides a press whose window *begins* inside an intermission
out to the intermission exit. The dead seconds are dead wherever the window sits, so the move is a wash in
score and a win in legibility — and `clipOf`, which counts past-kill seconds without asking whether they were
ever live, reads that wash as a regression. Feed `:2666` through `admit` and the pass stops firing on exactly
the case it was written for (the 4:00 multi-intermission Cold-Snap IV at 3:47 → 3:49, named in the comment).

**So item 0a's blast radius is 7 sites, not 9**, and the two survivors must keep their longhand `sameCounts`
line. Do **not** add an `admitCounts` variant for them: two callers with different remaining guards is not a
duplication, and a second near-identical helper would re-create at the helper layer exactly the confusion this
item is removing.

**⚠ And note what the suite would and would not have caught.** `:2666` only fires when `cfg.segments` contains
an intermission, so the 25 goldens catch a wrong conversion **only if a golden exercises that pass** — likely,
given the boss presets, but "likely" is the wrong confidence for a guard. The conversion was ruled out by
*reading*, which is the durable reason; **before landing 0a, confirm the goldens actually cover `dodgeDowntime`
and the `:2347` snap**, so the gate is known-live rather than assumed-live. (Same defect class as §4.14's:
an instrument whose failure mode is a pass.)

#### ★ A model question this turned up — not a performance one

`:2666` documents why it has no clip guard. **`:2347` does not.** Its comment explains only the *strict*-gain
policy (*"ONLY strict robust gains — so a press that genuinely wants to be off it … stays"*), and says nothing
about clipping. Two sibling passes, same prefix, same omission, one justified and one silent. Either `:2347`'s
omission is deliberate for a reason nobody wrote down, or it is a genuine gap — a press can be snapped onto a
fixed window at the cost of clipping further past the kill, and only the +0.5 robust margin stands against it.

**This is a RULES question, not a §4 question**, and it is the second time the perf census has produced one.
It must not ride along with a refactor: if `:2347` wants a clip guard, that is a **model change**, gated by the
sim and by moved goldens, and it belongs in Phase 7's ledger. Recorded here only because this is where it was
found. **Do not "fix" it while landing 0a.**

---

## §5 The iteration gate — why the loop was slow, and the three-tier instrument that replaces it

*Opened 07-25 on the user's challenge: "aren't you wasting a lot of time doing too few changes between
running the full simulation of everything? Can't you come up with a much much much quicker test…"
Answered by measuring rather than defending — and the defence lost.*

### §5.1 The measurement: the only per-change gate is not fast, and has three holes

`tests/exact-match.mjs` was the per-change confidence check for seven phases. Measured:

| property | measured | consequence |
|---|---|---|
| wall time | **9m07s** (`real 9m7.355s`, 25 passed) | not a gate you put behind every edit |
| parallelism | **none** — 25 cases sequentially in one chromium page | ~4 cores idle on a 4-core box |
| comparison unit | the **copy-as-text plan of FIRE times, floored to seconds** | a derived, floorable quantity — not the schedule the optimizer chose (see the correction below) |
| comparison depth | **final state only** | ⚠ a mid-pipeline accept-decision change that later passes wash out goes green on all 25 and bites on case 26 |

The depth row is a **false-pass hole** — this repo's tracked defect class, an instrument whose failure
mode is a PASS. It is not hypothetical: ladder item 0a (the `admit` extraction) is exactly a mid-pipeline
change, and §4.21 already found one of its nine sites would have altered behaviour.

> **⚠ SELF-CORRECTION — the "sub-second press shift" hole, as first written here, DOES NOT EXIST.**
> This section originally claimed exact-match could miss a sub-second schedule shift inside the same
> floor bucket. Measuring instead of asserting killed it: **all 273 press times across all 25 baked
> cases are integers** (0 non-integer, by the sweep's own legality audit). Flooring cannot lose a press
> time that is already whole. Same instrument error as §4.15/§4.21 — reasoning from the *shape* of the
> code (a `Math.floor` is present) instead of the *values* flowing through it — caught this time before
> it reached a living doc.
>
> **What is actually true, and is the real argument for the differ:** exact-match compares **fire
> times** — presses snapped to cast boundaries, a *derived* quantity that genuinely can be fractional,
> which is why it is floored at all. The differ compares **`best.s`, the press schedule the optimizer
> actually chose.** Those are different quantities, and the schedule is the upstream one: identical
> schedules always render identical fire times, so the differ is **at least as sensitive**, and strictly
> more sensitive wherever the fire-time floor absorbs a press change. **Whether such an absorbing case
> exists in the current corpus is UNMEASURED** — the differ can see it, and no instance has been caught
> in the wild. Claim no more than that.

Note also what exact-match is *not*, and was never meant to be: it is a **regression** test against
frozen goldens. It answers "did I change any plan?" — never "is the plan right?" Conflating those is how
the loop ended up with only two speeds.

### §5.2 The engine runs in BARE NODE — the gate does not need a browser

Confirmed empirically, and it is the finding that unlocks everything else. Host-global census of the
extracted `<script id="engine-src">` block: `document 0 · navigator 0 · requestAnimationFrame 0 · Worker
0 · window 95 (assignment only) · performance.now 4 · setTimeout 2 · MessageChannel 1`. The engine is
DOM-free **by construction** — it already runs inside a Web Worker — so every global it touches exists
in node 22. It loads and optimizes in plain node: **`load=4ms`**, first case `optimize=1998ms`.

Two extraction facts, both learned the hard way (each cost one failed probe):
- **`buildSegments` is at `index.html:2960` — in the UI script, NOT the engine block.** So is the whole
  preset table (`GOLDEN_DEFAULTS`/`GOLDEN_PRESETS`/`BOSS_PRESETS`, `:4125–4190`) and `window.__run`
  (`:3400`). A node loader must extract those regions *separately* from the engine block.
- **`counts`/`clipOf` are NOT top-level** — they are nested inside a function at `engine.js:1016-1020`.
  `BUFFS` (`:39`), `optimizeAsync`, `simulate`, `repair` are top-level. An epilogue that over-requests
  names fails the whole evaluation with a bare `X is not defined`.

⚠ **Gotcha — node will not EXIT.** `breathe()`'s `MessageChannel` (`engine.js:915-928`, the 40ms budget
that dodges the 4ms nested-timer clamp) keeps node's event loop ref'd forever. A child must
`process.exit(0)` deliberately after flushing. Left unhandled, the gate **hangs**, which reads as "slow
gate" — the same false signal as one that passes wrongly.
  - **★ Its disguise, measured 07-25 (cost: ~30 min).** An ad-hoc probe that omits the exit AND pipes
    through `| tail -n` presents as a *totally silent hang*: `tail` buffers to EOF, EOF never comes, so
    the output file stays 0 bytes while the process sits at **0% CPU**. That combination is diagnostic —
    a genuinely slow solve burns CPU; **zero CPU + zero output = finished, un-exited, tail-buffered.**
    Confirm by sampling `utime` in `/proc/<pid>/stat` twice 20s apart; if it does not advance, the work is
    already done and only the exit is missing. Write results to a **file** and exit, as `plan-sweep.mjs`
    and `census-run.mjs` do — never `| tail` a breathe()-using probe.

### §5.3 The three tiers

The loop had two speeds (9 minutes, or hours) and needed three.

**Tier 0 — plan sweep + full-precision differ (seconds–minutes, every change).**
`tools/plan-sweep.mjs` runs every baked preset through `optimizeAsync` in bare node, fanned across child
processes (round-robin index assignment, *not* contiguous blocks — case cost grows with `T` and the
presets are `T`-ordered, so contiguous slices hand one child every long fight and idle the rest).
`tools/plan-diff.mjs` then compares two sweeps on **`best.s` at float precision** — the schedule the
optimizer *chose*, upstream of the fire-time snap the goldens compare. It needs **no golden to
maintain** (it diffs A vs B) and it compares **by name, not index**, so an inserted preset cannot
silently shift every later comparison. It tags a changed cell `SUB-SEC` when the floored text is
identical — a live **detector** for the §5.1 hole, not evidence that the hole is open. The sweep also
carries a **legality audit** per plan (fractional/negative times, cooldown violations with Icy Veins
exempt for Cold Snap, the 20s trinket lockout) — orthogonal to a diff, because it catches an illegal
plan when there is no B at all.

```
node tools/plan-sweep.mjs index.html A.json [jobs] [--max-t=200]   # before the change
node tools/plan-sweep.mjs index.html B.json [jobs] [--max-t=200]   # after
node tools/plan-diff.mjs A.json B.json [--allow-change]
```
Exit codes — sweep: `0` swept clean · `1` a plan is ILLEGAL · `2` could not sweep. Differ: `0`
identical (or changed with `--allow-change`, none score-worse under a proven-identical scorer) · `1` a
plan changed, **or a SEARCH REGRESSION — scorer pinned + `ΔScore<0`, which fails even under
`--allow-change`** (the §5.15 rule, ported here 07-25: the differ proves scorer identity on the
unchanged cells — byte-identical plan ⇒ byte-identical score — and then grades changed cells on the
sign; if the scorer *moved* it is a repricing, the sign split is printed but not graded) · `2` could
not compare (an error cell or a corpus mismatch — *could-not-grade beats every other verdict*). `tools/engine-node.mjs` is
the shared loader: it extracts the engine block, `buildSegments`, and the preset arrays out of
`index.html` and evaluates them in one `new Function`, asserting every extraction (a silently-missing
preset array would make the gate grade **fewer** cases and still report success).

**Measured (3 jobs, on a 4-core box also running the xval campaign — so these are pessimistic):**

| sweep | cases | wall | CPU |
|---|---|---|---|
| full corpus | 25/25 | **239.3s** | 651s |
| `--max-t=200` (QUICK) | 16/25 | **33.2s** | 81s |
| `tests/exact-match.mjs` for reference | 25/25 | **547s** | ~547s (1 core) |

**The quick tier is ~16× faster than exact-match** and still covers 16 setups including the
intermission case, Power Infusion, Drums, and 8 boss presets. That is the "much much quicker test."

**Both controls were run, because a differ that only ever says IDENTICAL is the defect class itself:**
- *Positive* — the same engine swept twice at **different job counts** (3 vs 2), which changes the
  round-robin partitioning entirely: `PLAN-DIFF IDENTICAL`, 16/16, exit 0. This also **re-certifies
  determinism as independent of process layout**, which the browser path never tested.
- *Negative* — a seeded perturbation on a scratch copy (`isc.dur 20→18`): **8 of 16 cases changed**,
  exit 1, duel work list emitted. The differ fires.

**Tier 1 — `tests/exact-match.mjs` (~9 min today, parallelisable to ~2–3 min).** Keeps its role as the
*golden* regression gate. The 25 cases are independent, so fanning them across processes is a **harness**
change only — no engine change, no determinism risk. Run before a commit, not before every edit.

**Tier 2 — the xval acceptance round (hours, once per campaign).** The "are we done yet" measurement.
Explicitly **not** a per-change gate; see `docs/ACCEPTANCE.md` for what a PASS does and does not prove
(sampled, grid-limited, table-level).

### §5.4 ★★ Between the tiers: the DUEL — verification scoped to what changed

The user's correction, in full in `docs/TOOLING.md` → *Scope the verification to what CHANGED*. The two
halves, because they land differently here:

1. **Cost.** A cell whose plan is bit-identical needs no re-sim — the sim didn't change, the plan didn't
   change, the verdict can't have. So Tier 0's changed set **is** the sim work list, and verification
   cost scales with the change, not the corpus.
2. **★ Correctness — the half we had wrong.** A changed cell is **not** verified by "the table still
   passes." `monoDip`, `diagWorst` and the CLEAN/DEFICIT verdict are *aggregates*, and an aggregate can
   hold or improve while one cell regressed. Each moved cell needs **old plan vs new plan, simmed
   head-to-head under one harness.**

⚠ Two constraints on building that duel: it **cannot** be done by subtracting two rounds' tables
(§20.6's repricing makes round-4 and round-5 scores incomparable — both plans must be re-simmed under
one current harness), and a plan-diff can only find cells a rule *did* move, never one it *should* have
moved and didn't. The latter population is the standing-DEFICIT list, already enumerated per round.

### §5.5 Immediate consequence for the landing ladder

Ladder item 0a (§4.13.1) claims *byte-identical by construction*. Under §5.1 that claim was previously
checkable only by floored text on a final state — the two holes that a mid-pipeline refactor slips
through. It should now land against **Tier 0 first** (full-precision, sub-second-sensitive), with Tier 1
as confirmation. §4.21's confirm-the-coverage precondition still stands on top of that, because neither
tier proves a pass was *exercised* — that is what §4.7's owed runtime census answers.

### §5.6 ★★ Fallout for the perf work itself: cost is ~EXPONENTIAL IN PRESS COUNT, not in T

The sweep's per-case timings are the first clean cost profile the project has, because bare node gives
one process per case with no browser noise. The shape is stark (full corpus, 3 jobs):

| presses in the solved plan | median solve | example |
|---|---|---|
| 7 | 2.0s | `1:40 lust 0:05` (T=100) |
| 9 | 3.7s | `2:40 lust 0:05` (T=160) |
| 12 | 28.6s | `4:00 lust 0:05` (T=240) |
| 14 | 53.4s | `5:45 lust 4:20` (T=345) |
| 15 | 115.0s | Kael'thas (T=420) |
| 18 | 168.7s | `7:20 lust 0:05` (T=440) |

**The driver is the number of activations that FIT, not fight length.** Each additional press multiplies
solve cost by roughly **1.35–2×** — the combinatorial signature of a neighbourhood search over a
schedule space that grows with every press slot. `T` only matters through how many presses it admits,
which is why `3:20` (11 presses, T=200) solves in 3.8s while `4:00` (12 presses, T=240) takes 28.6s.
`T` alone cannot explain that; a press slot opening can.

Two consequences, one for the gate and one for the phase:

1. **The cost is savagely concentrated.** The 5 longest cases are **73% of all CPU** (474s of 651s); the
   15 cheapest are **8%** (52s). And a single case — `7:20 lust 0:05` at 168.7s — sets an **Amdahl floor
   the full sweep can never beat no matter how many cores.** That is *why* the quick tier exists, and
   why the tier boundary is drawn at `T`: it is the cheapest available proxy for press count.
2. **★ It relocates the perf target.** §1–§4 hunt constant factors (redundant walks, fusable steps,
   `JSON.stringify` keying). Those are real and worth landing, but this says the *headline* cost is
   **structural** — a search whose work grows multiplicatively per press slot. A 20% constant-factor win
   on a 168.7s case is 34s; taking one multiplicative step out of the long-fight search is worth far
   more. **This does not invalidate the §4 catalogue** (§4.13.1's ladder still lands cheapest-first, and
   every item is still gated byte-identical) — it adds a target the catalogue does not currently have,
   and it says where to look once the cheap items are in: **why does an extra press slot cost 1.35–2×,
   and is that factor irreducible or an artifact of re-exploring settled prefixes?** Open question,
   deliberately not answered here.

### §5.7 Tier 1 LANDED — exact-match parallelised (547s → 270–337s)

The 25 cases are independent, so the only reason the gate was sequential was that nobody had made it
otherwise. `tests/exact-match.mjs` now fans them across `JOBS` browser pages (default `cores-1`,
`JOBS=1` forces the old path). **Harness-only — the engine is untouched, so there is no determinism
risk in the change itself.** Measured on the 4-core box while the xval campaign held 2 cores:
**547s → 270.3s and 337.2s across two runs at `JOBS=3`** (~1.6–2.0×; the spread is campaign
contention, not variance in the suite).

Same round-robin slicing as the sweep, and for the same reason (§5.6): case cost tracks press count
and the presets are `T`-ordered, so contiguous blocks hand one page every long fight.

**Two invariants that parallelism could silently break, and how each is held:**
1. **Output order must not depend on completion order.** Results are keyed by name and re-emitted in
   `spec.cases` order. Without this, `--update` would write `golden.json` in whatever order the pages
   happened to finish — and `JSON.stringify` preserves insertion order, so *the golden would churn on
   job count alone*. Verified separately: `golden.json`'s 25 keys are already in preset order, so a
   future `--update` writes byte-identical ordering.
2. **A case that could not be produced is not a case that agrees.** Any throw or `pageerror` becomes an
   ERROR and the run exits **2 (could not grade)** before anything reads `results` as if it covered the
   corpus.

**Both controls run.**
- *Positive* — `JOBS=3` scores **25/25 PASS against a golden produced by the sequential runner**. That
  is the byte-identical proof, and it is stronger than re-running `JOBS=1` would have been.
- *Negative* — `INDEX=` (new) points the suite at a scratch copy; one with `optimizeAsync` throwing for
  `T > 200` produced **9 ERROR cases, exit 2, in 30.3s** — and critically did *not* print "16 passed",
  which is exactly the false-pass mode (the 16 short cases genuinely did pass).

⚠ **One guard was written unreachable and had to be repointed.** The first draft refused to write a
short golden — but every omitted case already pushes an error, and errors exit 2 first, so that branch
could never execute. A guard that cannot fire is not protection, it is the *appearance* of protection.
It is now a **partition** check (`PARTITION HOLE`): `slices` is a computed round-robin cover, and if a
future edit to it dropped an index, no case would error and the corpus would silently shrink — the
failure mode being a PASS. That is a real risk; the original was not. Repointing it also removed a
latent crash (a missing `got` would have hit `got.split` in the FAIL branch).

**Remaining honest limit:** exact-match is still a **final-state** comparison (§5.1). Parallelising it
made it faster, not deeper — a refactor that changes a mid-pipeline accept decision which later passes
wash out still goes green on all 25. Ladder item 0a is exactly such a change.

### §5.8 The §4.7 RUNTIME census — RUN, on all 25 cases

§4.7 was owed a measurement and §4.21 was owed a coverage check. Both are now numbers. The census ran
against an instrumented **copy** of `index.html` (§4.14's trick — the repo's engine stayed frozen for the
xval campaign), and **plan-neutrality was proven before the counts were read**: a full sweep of
`census.html` vs `index.html` printed `PLAN-DIFF IDENTICAL` on 16/16 cases, so the probes measure the
shipping optimizer and not a perturbed one.

| key | total | cases firing |
|---|---|---|
| `call.repair` | 29,392,572 | 25/25 |
| `call.simulate` | 29,325,903 | 25/25 |
| `call.sigOf` | 29,178,232 | 25/25 |
| `groom.r0.CHANGED` / `.noop` | 50 / 0 | — |
| `groom.r1.CHANGED` / `.noop` | 28 / 22 | — |
| `groom.r2.CHANGED` / `.noop` | 1 / 49 | — |
| `dodgeDowntime.enter` / `.cand` / `.FIRE` | 164 / 4 / 4 | FIRE in **1/25** |
| `apSnap.cand` / `.FIRE` | 101 / 1 | FIRE in **1/25** |

#### (1) §4.7's groom early exit is empirically sound — and smaller than it looks

The groom loop is entered **exactly twice per case, on all 25** (50 round-0 entries, no exceptions), so
"three grooms" is really two, uniformly. Round 1 no-ops **44%** of the time (22 of 50) and round 2 no-ops
**98%** of the time (49 of 50).

The proposed guard is `if (groom >= 1 && unchanged) break;`. It would fire in **19 of 25 cases**.

**The soundness test §4.17's f1=f2 purity argument needed:** does any execution show *round 1 no-op →
round 2 change*? If one did, the argument would be dead — a no-op round would not imply a converged
schedule. The single round-2 change in the whole corpus is in `5:00 lust 0:05`, and that case has
`r1noop=0` — **both** its executions changed in round 1. So across 25 cases / 50 executions, **no
execution anywhere exhibits the falsifying pattern.** That is not a proof (it is 50 samples of a
universal claim), but it is the first empirical test the argument has faced and it passed cleanly.

**⚠ Size it honestly.** The guard captures **22 of the 49 wasted round-2 executions**, not all of them.
You may skip round 2 because round 1 *was* a no-op — never because round 2 *will* be one. The other 27
wasted rounds follow a round-1 change and are unreachable by this guard. §4.17's "smaller than a whole
groom round" caveat is now a fraction: **~45% of the waste, not 98%.**

#### (2) §4.21's coverage precondition: CONFIRMED, but far thinner than "likely"

§4.21 asked, before landing item 0a, that the goldens be shown to actually exercise the two Class-D sites
rather than assumed to. They do — barely:

- **`dodgeDowntime` (`:2666`)** — 164 entries, but only **4 candidates survive `sameCounts`, and all 4
  fire**, in **one case** (Al'ar). The corpus therefore never exercises this site's *rejection* paths at
  all: every candidate that reaches the gate is accepted. A conversion that broke the gate's reject
  behaviour would go green on all 25.
- **`apSnap` (`:2347`)** — 101 candidates, **1 firing**, in **one case** (`3:20 lust 0:05 drums`).

So each Class-D site is protected by **exactly one golden**. §4.21 wrote "likely, given the boss presets,
but 'likely' is the wrong confidence for a guard" — the measurement says the instinct was right and the
margin is one case per site. The decision not to convert them stands on **reading the code**, which was
always the durable reason; the suite is a thin second line, not a first one.

#### (3) §4.1's fusion premise, as a number

Across the 25 cases the three hot calls run at **repair : simulate : sigOf ≈ 29.39M : 29.33M : 29.18M ≈
1 : 1 : 1**. §4.15 corrected §4.1's "almost everywhere" claim about *call sites*; this is the *dynamic*
counterpart and it confirms the fusion premise at runtime — these three walk the same schedule in
lockstep, so fusing them removes two of every three walks rather than shaving a fraction of one.

Concentration matches §5.6 exactly (cost is exponential in press count):

```
7:20 lust 0:05          6.98M : 6.98M : 6.97M   168.9s
6:00 lust 4:20          3.76M : 3.75M : 3.75M    86.4s
Kael'thas Sunstrider    3.65M : 3.65M : 3.64M   111.3s
5:45 lust 4:20          2.27M : 2.27M : 2.26M    56.6s
Lady Vashj              2.25M : 2.24M : 2.23M    52.2s
```

One case is **6.98M repair calls in 168.9s** — 24% of the corpus's repair traffic in a single fight.

#### Reproducing it — the census is now a tool, not a one-off

`tools/census-build.mjs` (injector) + `tools/census-run.mjs` (fork-based runner):

```
node tools/census-build.mjs index.html /tmp/census.html
node tools/plan-sweep.mjs index.html   A.json 3 --max-t=200
node tools/plan-sweep.mjs /tmp/census.html B.json 3 --max-t=200
node tools/plan-diff.mjs A.json B.json          # MUST print PLAN-DIFF IDENTICAL
node tools/census-run.mjs /tmp/census.html census.json
```

**Anchoring is by LINE NUMBER, deliberately.** `dodgeDowntime`'s accept line is *not* unique in
`index.html` — it appears twice — so a text-substitution build would silently instrument the wrong site
and produce a plausible-looking census of the wrong pass. Each probe carries the source line it expects;
on a mismatch the builder searches the file and, when the text is uniquely findable, **prints the new
line number** so re-anchoring is one edit. It writes no output file on failure.

**Both controls run on the builder itself.**
- *Positive* — rebuilding from today's `index.html` produces a file **byte-identical (`cmp`) to the
  `census.html` the numbers above came from**. That is a stronger reproduction proof than re-deriving
  the counts, which could agree by coincidence of a compensating error.
- *Negative* — a one-line shift of `index.html` gives `CENSUS-BUILD ERROR: anchor 565 … it is now at
  line 566`, **exit 2, no file written**; and pointing `census-run.mjs` at an *uninstrumented* file exits
  2 with *"the probes are not present"* rather than reporting a corpus of zeroes. Zero counts are the
  false-pass mode here — an empty census reads exactly like *"none of these passes ever fire, delete
  them all."*

---

### §5.9 ★★ The DUEL is BUILT — and the control that nearly shipped a confident lie

`tools/plan-duel.mjs` (commit `93680a9`) implements §5.4. `plan-diff.mjs` says **which** cells moved;
the duel says **whether each move was an upgrade**, cell by cell, because `monoDip`/`diagWorst`/
CLEAN-vs-DEFICIT are aggregates that can hold or improve while one cell regressed.

```
node tools/plan-diff.mjs A.json B.json                                   # which cells moved
node tools/plan-duel.mjs --old A.json --new B.json \
     --old-html index.html --new-html variant.html [--sim]               # was each move an upgrade?
```

**It never subtracts two sweeps' recorded scores** (the §20.6 repricing trap): both schedules are
re-scored under one engine at a time. And it **measures** whether the scorer moved — *does each engine
price the same schedule identically?* — rather than trusting the caller to declare it.

#### The two asymmetries that let it grade without a sim

A tool that refuses whenever the scorer moves is nearly useless, since most real edits touch pricing.
Two asymmetries rescue most cells for free:

**(A) THE CONFESSION RULE — circularity has a DIRECTION.** `newEngine(new) > newEngine(old)` is true by
construction and proves nothing: the search maximized that very objective. But `newEngine(new) <
newEngine(old)` — the new engine ranking the **old** plan higher — is a *confession*. The search was
free to keep the old layout and score better under its own currency, and didn't. No repricing can
manufacture that sign. That is a **SEARCH-MISS** in the Phase-7 sense, gradeable with zero sim runs.

> Note the direction it can move a verdict: **CANNOT-GRADE → FAILURE, never → pass.** Per the standing
> false-pass doctrine, a refinement that can only get *stricter* cannot introduce the defect class we
> actually fear. That is why it was safe to add at all.

**(B) THE FEASIBLE-SET GUARD — and it is the reason (A) doesn't lie.** Every model verdict benchmarks
against `newEngine(old plan)`. That number is meaningless if the new build could not legally *emit* the
old plan. Measured, not assumed: repair the old plan under the **new** build and check the score
survives. It is tested **first**, ahead of everything else.

#### ⚠ C4 — the control that earned guard (B), and the general lesson

Guard (B) was **not** in the first implementation, and the tool looked fine: C1–C3 all passed. C4 broke
it. Change `isc.cd` 120→180 — a **pure constraint change** — and:

- `simulate()`'s pricing of any given schedule is **bit-identical**, so `scorerMoved` reads **FALSE**;
- the tool therefore took its most confident branch and reported **9 cells as "★ REGRESSION — the search
  got WORSE under an UNCHANGED objective."**

Every one of those was false. The old `isc:[5,127]` is 122 s apart and simply **illegal** at `cd:180`;
repair drops the second use and the score falls 2437.8. `newOnOld` was crediting the new engine with an
ISC use its own rules forbid. The search never regressed — **the feasible set shrank.** With (B): 10
honest CANNOT-GRADEs, 0 false accusations.

> ★★ **The generalisable lesson: `scorerMoved` and "are these two plans comparable" are DIFFERENT
> QUESTIONS.** The pricing function and the feasible set can move independently, and a constraint-only
> edit moves the second while leaving the first provably untouched. Any future comparison instrument
> that checks only "did the score function change?" inherits this exact false-accusation mode. This one
> is a false *failure* rather than a false pass, so it is the milder half of the defect class — but a
> confident, precise, cell-named regression report would have sent us hunting a search bug that does
> not exist.

#### The controls (re-run all four after any edit to the verdict chain)

| # | perturbation | expected | got |
|---|---|---|---|
| C1 | none (index.html vs its census copy) | no changed cells, exit 0 | ✔ |
| C2 | PRNG seed 1337→4242 | — | 0 of 16 changed (became a finding, §5.10) |
| C2b | `starts` 14→1 | — | 0 of 16 changed (became a finding, §5.10) |
| C3 | `isc.dur` 20→18 (**pricing**) | scorerMoved, refuse or confess | 8 changed: 5 ★REGRESSION (confession), 3 refused; exit 2 |
| C4 | `isc.cd` 120→180 (**constraint**) | refuse — plans not comparable | 10 CANNOT-GRADE, 0 false accusations; exit 2 |

C3's three refusals are each a distinct situation, and the tool now names which: one cell is
**indifferent** (Δ +0.000 across two visibly different plans — the new engine cannot rank them), two
**prefer the new plan**, i.e. exactly the direction that proves nothing.

#### A side benefit worth keeping: the duel doubles as a SEARCH-QUALITY probe

C3 produced **5 confessions out of 8 changed cells**. Read that back: perturb any model constant,
re-optimize, and every confession is a cell where the search demonstrably left value on the table *under
its own objective* — it could have retained the old layout and scored higher. That is a **cheap, sim-free
measurement of search quality**, which is precisely Phase-7's SEARCH-MISS question and Phase-9's *"can we
cut search work without losing quality?"* question. Cost: one sweep (~27 s on the QUICK tier).

### §5.10 ★★ Two invariance leads — RAISED on the fast tier, then KILLED by the full corpus

C2 and C2b were meant to be controls. Both produced **zero plan changes on the 16 QUICK cases**, which
looked like two findings about the optimizer:

1. **PRNG-seed invariance.** `mulberry32(1337)` → `mulberry32(4242)`: 0 of 16 plans changed.
2. **Restart invariance.** Clamping `starts` 14 → 1 — dropping 13 of 14 random restarts — gave
   `PLAN-DIFF IDENTICAL`, 0 of 16 changed, and cut CPU **75 s → 61 s (~19 %)**.

Both were verified live rather than assumed, because a perturbation that silently fails to apply produces
exactly this result: `rand()` has **exactly one consumer** (`index.html:1108`, the restart-seeding line),
`starts` **exactly one** (`if (seeds.length >= starts + 8) break;`), and the shifted constant was
confirmed present in the *loaded* file. The reading was that the finishing-pass stack, not the random
restarts, determines the plan — making `starts` ~19 % of CPU buying nothing, the cheapest item on the
ladder.

**Both were flagged do-not-act-on pending the full 25, and the full 25 killed both.**

| perturbation | QUICK 16 | FULL 25 | verdict |
|---|---|---|---|
| `starts` 14→1 | 0 changed | **2 changed** — 1 ★REGRESSION (−233.09), 1 TIE | **REJECTED as a perf cut** |
| seed 1337→4242 | 0 changed | **2 changed** — both ★REGRESSION (−233.09, −52.82) | restarts are load-bearing |

CPU on the full corpus: 695 s → 583 s (16 %). **That 16 % is buying real search quality, on exactly the
cases that cost the most.** Both duels report `scorerMoved = false` — a search parameter is not a pricing
one — so the model arbitrates directly and no sim was needed. (It also retroactively licenses
`plan-diff`'s raw `Δscore` subtraction *in this specific case*: the currencies provably match.)

#### ★★ THE INSTRUMENT LESSON — a fast gate's blind spot is CORRELATED with what makes it fast

This is the generalisable half, and it is a standing hazard for the whole three-tier scheme:

> **§5.6 established that solve cost is ~exponential in press count.** So the QUICK tier is cheap
> *precisely because* its cases have few presses and a small search space — which is *precisely* the
> regime where the search is easiest and random restarts are least needed. The QUICK tier is therefore
> the **systematically wrong place to test a search-quality change**: it is not a random sample of the
> corpus, it is the sub-population selected for being easy. The fast gate's blind spot is not incidental
> to its speed; it is the *same property*.

The tier stays — it caught real changes in C3/C4 and it is the right instrument for a **pricing** or
**refactor** change, where cost and coverage are uncorrelated. But **any change to the SEARCH (starts,
seeds, anchors, basin hops, accept tolerances, iteration caps) must be gated on the full 25**, because
the QUICK tier's silence on such a change is uninformative by construction. Cost of doing it right:
~360 s wall at 2 jobs.

#### ★ A fragility this exposed, worth its own follow-up: `5:40 lust 0:05` rides ONE lucky restart

The −233.090261 regression at `5:40 lust 0:05` is **bit-identical under both perturbations**, and both
land on the **same** inferior plan:

```
good (default) : isc/icyVeins/scb [5,127,307]  arcanePower [5,307]     — everything aligned
both variants  : isc [4,190,310]  icyVeins [0,190,310]  scb [4,195,315] arcanePower [4,195]
```

The obvious reading — *"with 14 restarts at seed 1337 one particular draw finds the aligned
`[5,127,307]` basin, so the fix is a basin-hop anchor at that layout"* — was written here and is
**WRONG on both halves. It is retracted; §5.11 has the measured cause.** Kept visible rather than
deleted, because the *shape* of the error is the lesson: a per-cell symptom ("this cell is fragile
to restart draws") was read as a per-cell cause ("one draw finds a basin the others miss"), and the
inference skipped the four passes that stand between a restart draw and the emitted plan. The
sensitivity was real; the mechanism was invented. **A change in output under a perturbation localises
the symptom, never the mechanism** — to localise a mechanism you have to open the pipeline and watch
each stage, which is what §5.11 does.

What survives: this cell IS a **SEARCH-MISS waiting to happen**, and it is a ready-made test case.

Secondary: `7:20 lust 0:05`'s −52.82 is a uniform −1 s slide (5→4, 22→20, 1→0, 125→124) — near-plateau
micro-placement, consistent with the known low-haste placement slack, not a basin miss.

Also noted: `6:00 lust 4:20` changed under `starts=1` at **Δ +0.000** with the whole burn block shifted a
uniform +6 s. PHASE7 §5.11's legibility canonicalization normalizes score-ties *within one run's candidate set*;
a different restart count yields a different candidate set and so a different plateau representative.
Expected, not a canonicalization bug — but it means **plan-diff will report tie-only churn on any
search-parameter change**, and `subSecOnly` will not filter it.
---

### §5.11 ★★★ THE ENTRANT PLATEAU — the measured cause of the `5:40` fragility, and a corpus-wide defect

§5.10's closing note guessed. This section opened the pipeline. **The guess was wrong in the most
instructive way: the aligned layout is not found by a lucky restart, because it is not found by ANY
restart.** It is manufactured downstream — and which downstream pass gets to manufacture it is decided
by a coin flip on a score plateau.

#### The three probes, and what each ruled out

`$SP/basin-probe.mjs` reconstructs `optimizeCore`'s 14-seed list verbatim (`index.html:1400–1445` —
naive, packed, phase-anchored, pin-anchored ≤4, kill-anchored, then `randomSchedule` to `starts`) and
reports where each seed's `polish()` lands. On `5:40 lust 0:05`:

```
best seed basin : [11] rand12  581657.995      13 distinct basins of 14
top 6 span      : 19 points
seeds reaching the good (582662-family) layout : 0 of 14
```

**Zero.** So "one lucky draw finds the aligned basin" is false at the seed stage — no draw finds it. The
+233 must be created *after* the seed phase, by the snap or by `basinHop`.

`$SP/basin-stages.mjs` runs step 2 (snap top-6 to whole seconds, re-`polish`) and then step 3
(`basinHop` from **every** top-6 entrant separately, so the question is *which entrants CAN reach it*,
not *did this run happen to*). Printed at full precision, step 2 is the whole story:

```
[11] rand12   seedVal=581657.99506929773  snapVal=581647.29654275777   ← LOSES on `>`, by 1.2e-7
[ 5] rand6    seedVal=581653.93419693795  snapVal=581647.29654275789
[13] rand14   seedVal=581646.13510873041  snapVal=581647.29654275789
[10] rand11   seedVal=581645.46925073268  snapVal=581647.29654275789
[ 6] rand7    seedVal=581643.02195561840  snapVal=581647.29654275789
[ 0] naive    seedVal=581639.23500505951  snapVal=581639.23500505951
```

**Four of six snapped candidates are bit-identical**, from visibly different layouts. Step 3 then values
those tied layouts as far apart as the plan is worth arguing about:

```
[ 5] rand6  → 582662.018      [ 6] rand7  → 582662.018
[13] rand14 → 582455.531      [10] rand11 → 581789.158      spread 872.860
```

> **The defect, stated once.** The snap to whole seconds is a **many-to-one map on score**. Once it has
> run, "the best snapped candidate" is no longer determined by the snapped scores — they are equal — it
> is determined by the **sort order of a PRE-snap score the snap has already erased**. `basinHop`, the
> only pass that can tell these layouts apart, runs *after* the pick. **The pass that chooses the entrant
> cannot see the difference; the pass that can see it does not get to choose.**

Note also what `[11] rand12` shows: it *led* the pre-snap ranking by 4 points and lands 1.2e-7 *below*
the plateau after snapping, so a strict `>` discards it. The winning seed and the winning entrant are
not the same thing, and the pre-snap ranking carries no information about which entrant hops best.

#### How general is it — 9 of 25 cases, 2 of them biting

`$SP/tie-census.mjs` runs only the cheap prefix (seeds → polish → snap → re-polish) on all 25 and
reports the plateau width at the max. **9/25 pick `basinHop`'s entrant off a plateau of ≥2 DISTINCT
layouts:** Hydross(2), Fathom-lord Karathress(2), Lady Vashj(2), High Astromancer Solarian(3),
Kael'thas Sunstrider(2), `2:00 lust 0:05`(2), `2:20 lust 0:05`(2), `2:40 lust 0:07`(2),
`5:40 lust 0:05`(4). Two more (`4:00 lust 0:05`, `5:00 lust 0:05`) sit at margin **5.8208e-11** — coin
flips that today's exact `===` comparison merely *fails to notice*.

A plateau is only a **defect** if the tied layouts hop to *different* values. `$SP/tie-spread.mjs` pays
for that (forks 2 lanes, longest-first, hops every tied entrant on the 9 flagged cases):

| case | T | entrants | post-hop spread | verdict |
|---|---|---|---|---|
| `5:40 lust 0:05` | 340 | 4 | **872.860 (0.1498%)** | ⚠ BITES |
| Kael'thas Sunstrider | 420 | 3 | **380.235 (0.0616%)** | ⚠ BITES |
| the other 7 | 75–390 | 2–4 | 0.000 | harmless |

**2 of 9 bite — and they are the two most expensive cases in the corpus.** That is not a coincidence:
more presses ⇒ more near-equivalent layouts ⇒ wider plateaus ⇒ more room for the hop to diverge. The
defect concentrates exactly where plan value is highest and where §5.6's cost curve makes verification
most expensive.

Kael'thas is the starkest evidence, because it removes any doubt that the entrant difference is
*material*:

```
[13] rand14      berserking[106,286]  → hop output == hop input   (basinHop found NOTHING)
[ 5] phase@105   berserking[105,285]  → +380.235
```

**A ONE-SECOND offset in the entrant is the difference between `basinHop` finding +380 and finding
nothing at all.** Mechanism (`index.html:1296–1312`): every teleport anchor is derived from *the current
champion's own presses* (`anchors.add(Math.round(t))`, plus `t + BUFFS[k].cd` on a 5 s grid, plus
max-stack boundaries off `bestS`'s cast board). And `teleportRep` moves every press at second `X`
**together**. So a fully-aligned layout is exactly one teleport away — *if the anchor exists*. Shift one
press by one second and the anchor set no longer contains the second that would align it, and the hop is
blind. **`basinHop`'s reach is entrant-dependent by construction**; the plateau hands it the entrant at
random.

#### ★★ The tolerance needs no judgement call — ten orders of magnitude of empty space

The obvious objection to "hop the whole plateau" is that "tied" needs a tolerance, and a tolerance is a
tuned constant, and a tuned constant is a place for a bug to hide. **Measured, it isn't.** Margins from
the plateau max to the first non-tied candidate, across all 25:

```
4:00 lust 0:05      5.8208e-11        Morogrim Tidewalker      1.7467
5:00 lust 0:05      5.8208e-11        Hydross the Unstable     9.9671
5:40 lust 0:05      1.1642e-10        …  Lady Vashj         2037.7
                                         3:20 lust 0:05     2698.3
```

A margin in this corpus is either **≤1.2e-10** (one number computed two ways) or **≥1.7467**. Ten orders
of magnitude of empty space, and nothing anywhere near a threshold placed between them. So
`tol = 1e-9 * |val|` is **float-noise detection, not tuning** — it cannot silently reclassify a real
score difference as a tie, because no real score difference in this corpus is within nine orders of
magnitude of it.

#### The fix

Collect **every** snapped candidate (not just the `>` winner), then hop the whole score plateau and let
the pass that can see the difference choose. Three design points, all aimed at not manufacturing churn:

- **`best` is hopped FIRST and improvements must be STRICT (`>`).** A plateau whose members all hop to
  the same value therefore keeps **exactly** the plan it has today, byte for byte. Only a plateau that
  actually changes the outcome moves — which the §5.10 rule (a search change must be gated on the full
  25 and every changed cell dueled) then has to price.
- **`sigOf`-dedup before hopping.** Kael'thas produces two identical `phase@105` seeds; an identical
  layout must not be hopped twice. (It cost 0.0 s to find out, purely because `POLISH_CACHES` made the
  duplicate free — see the caveat below.)
- **Iterate in the existing rank order**, not a canonical signature order, to keep churn minimal.

**Cost:** the most expensive pass now runs once per plateau member on 9 of 25 cases — estimated ≈ +85 s
on a 625 s base (**≈ +13.6%**).

#### ★★★ THEN IT WAS RUN — and the plateau is real but very nearly INERT

Built as `$SP/plateau.html` and measured against pristine, case by case. **On both cases where the
post-hop spread bites, the emitted plan is BIT-IDENTICAL:**

| case | post-hop spread (§ above) | pristine final | plateau-fix final | Δ |
|---|---|---|---|---|
| `5:40 lust 0:05` | 872.860 | 582688.620970 | 582688.620970 | **0** |
| Kael'thas Sunstrider | 380.235 | 617037.203958 | 617037.203958 | **0** |
| `5:00 lust 0:05` | (near-tie 5.8e-11) | 521998.552858 | 521998.552858 | **0** |
| `4:00 lust 0:05` | (near-tie 5.8e-11) | 428257.758448 | **428271.474882** | **+13.716** |

The other 7 flagged cases are inert *by construction* (spread 0.000 ⇒ every entrant hops to the same
value ⇒ `best`-first + strict `>` keeps `best`'s own hop).

> **★★★ THE RESULT THAT MATTERS, and it upgrades caution 1 below from a warning to a measured law:
> THE DOWNSTREAM PASS STACK ABSORBS THE ENTIRE POST-HOP SPREAD.** An 872-point and a 380-point
> difference at the `basinHop` boundary both wash out completely by the time a plan is emitted. The
> groom / tie-break / finishing passes are doing far more work than the entrant choice, and they
> converge visibly different entrants onto the same final plan.

**So a mid-pipeline measurement is not evidence about the output.** The plateau is genuinely there, the
spread is genuinely large, the mechanism (§ above, KT's one-second Berserking) is genuinely proven — and
**none of it reaches the user.** This is the same defect class as §5.7's unreachable guard, rotated:
there, a guard that could not fire; here, a *finding* that could not surface. **Measuring a real
difference at an internal boundary and reporting it as a defect is an inference the pipeline has to
license, and this one didn't.**

And note where the single gain actually came from: `4:00`'s plateau was **not an exact tie** — its margin
is 5.8208e-11, so today's `===` comparison already separates those candidates. The +13.716 is bought by
the **tolerance**, not by hopping the exact-tie plateau. The one measured benefit and the headline
mechanism are unrelated.

**Verdict — NOT LANDED as written.** ≈ +13.6% CPU for +13.716 points on 1 of 25 cases, with the stated
justification (the 872/380 spreads) measured to have no effect on output. If the tolerance-only gain is
worth pursuing it should be pursued as its own change, priced on its own evidence, and gated on the full
25 per §5.10. `$SP/plateau.html` is kept as the reproduction.

#### ★★ Two further hypotheses, both FALSIFIED — the `5:40` seed fragility is still unexplained

1. **"The plateau fix makes `5:40` seed-robust."** No. Under `mulberry32(4242)` the fix yields
   **582455.530709** — the identical −233.090 regression §5.10 measured on pristine. At that seed the
   *entire plateau* tops out 233 below: the good entrant is not in the candidate set to be hopped, so
   hopping all of it changes nothing. **The plateau explains which tied entrant wins; it does not explain
   why the winning layout exists at one seed and not another.**
2. **"A whole seed CLASS is missing — align-everything-on-Lust-then-chain."** The good layout is
   `isc/icyVeins/scb [5,127,307] + arcanePower [5,307]`, which *looks* like a nameable deterministic
   construction absent from the seed list (naive, packed, phase-, pin-, kill-anchored, random). Built it
   explicitly (`$SP/align-seed.mjs`) at both plausible origins and hopped each:
   `align@0 → 582553.499`, `align@5 → 582455.531`. **Neither reaches 582662.** The tell is in the
   number: a clean cd-chain from the Lust second gives `[5,125,245]`, and the good plan is
   **`[5,127,307]`** — a +2 s offset and a *skipped* use. That is a cast-boundary/ramp artifact, not an
   alignment rule, so no tidy seed construction reaches it.

**Standing:** `5:40 lust 0:05` remains a genuine SEARCH-MISS. Three candidate explanations were tried
and killed here (lucky-restart basin, entrant plateau, missing align seed); a fourth, fifth and sixth are
killed in **§5.13**, which also *localises* the manufacture to a single pass. It stays on the Phase-7
ledger as an open SEARCH-MISS, and it is still the corpus's best test case for one.

#### ★ Two carried cautions

1. **Post-hop values are NOT final, so a better hop is not a better plan.** The pristine goldens are
   Kael'thas 617037.204 — **7.26 BELOW** its best post-hop 617044.459 (downstream passes gave some
   back) — and `5:40` 582688.621 — **26.6 ABOVE** its post-hop 582662.018 (downstream passes improved
   it). **Now measured, not merely suspected:** the whole 872/380 post-hop spread washes out. **A higher
   post-hop value is not a lead, it is noise, unless it survives to the emitted plan.**
2. **A flaw in my own probe, recorded rather than hidden.** `basin-stages.mjs` reused ONE `cfg` object
   across all six hops, and `POLISH_CACHES` is a `WeakMap` keyed by the `cfg` **object** that persists
   across `basinHop` calls — so the hops shared one cache. Because `polish()` is pure, a cache hit
   returns identical bits: **correctness unaffected, TIMINGS contaminated** (one hop reported 1.2 s,
   another 0.0 s). The values above are trustworthy; the per-hop seconds in that probe's output are not.

---

### §5.12 ★★ The groom early exit — MEASURED on the full 25: plan-neutral, −10.1% CPU

Ladder item **0c** (§4.17(1), sized empirically in §5.8(1)): give the groom loop the early exit its
sibling fixpoint 1100 lines away already has —

```js
if (groom >= 1 && unchanged) break;      // unchanged = JSON.stringify(s) compare across the round
```

#### The structural argument, which is stronger than the census

§5.8(1) tested this empirically: across 25 cases / 50 groom executions, **no execution anywhere exhibits
the falsifying pattern** (round 1 no-op → round 2 change). That is 50 samples of a universal claim, not a
proof. The proof is structural:

> **Rounds ≥1 are the SAME deterministic function of `s`.** Each begins with `await challengePass()`
> (`if (groom > 0) await challengePass();`) and then runs the same sweeps; **round 0 is the only one that
> skips it.** So if round N≥1 returned `s` unchanged, round N+1 starts from a bit-identical state and
> must reproduce it. The guard's `groom >= 1` is not a safety margin — it is exactly the condition under
> which the two rounds are the same function.

**The one audit hole, and it is closed.** The argument holds only if no state *outside* `s` carries
across a round in a way that could loosen a later accept. Of the 8 `val =` assignment sites inside the
groom window, **7 are `Math.max(...)`** — monotone by construction. The single bare assignment
(`val = pick.v`, `index.html:1894`) is guarded by `rr3.robust > val + QTOL` and coupled to
`s = pick.rep`, so it fires **only when it raises `val`, and only together with the `s` that earned it.**
`val` is therefore non-decreasing across the loop, and a no-op round leaves it — like `s` — untouched.

#### The gate: full 25, both instruments

```
PLAN-DIFF compared=25 changed=0 … PLAN-DIFF IDENTICAL
DUEL: NO CHANGED CELLS
```

Note this is the case where the **QUICK tier would have been legitimate** — the guard is a control-flow
skip, not a search change, so §5.10's exponential-cost/blind-spot correlation does not apply. The full 25
was run anyway because it doubles as the perf measurement.

| run | wall (2 jobs) | CPU |
|---|---|---|
| pristine full-25 | 362.7 s | 695.1 s |
| groom early exit | 333.8 s | **625.1 s (−10.1%)** |

Where it comes from — and it is exactly where §5.6 predicts:

| case | Δ CPU |
|---|---|
| `7:20 lust 0:05` | **−23.5 s (−12.8%)** |
| Kael'thas Sunstrider | **−15.1 s (−12.5%)** |
| `5:45 lust 4:20` | −7.3 s |
| `5:00 lust 0:05` | −6.5 s |
| `4:00 lust 0:05` | −4.8 s |

**Two cases give up 38.6 s of the 70 s.** The apparent +8–11% on the shortest cases is ≤0.6 s absolute —
scheduler jitter, and their plans are bit-identical, so there is nothing there to explain.

**Status: ready to land, blocked only on the round-5 cross-val campaign releasing `index.html`.** Gate on
exact-match 25/25 at commit (it also covers the render path, which the sweep never touches).

#### ★ Footnote: this is the item the plateau experiment was going to spend

§5.11 estimated the plateau fix at ≈ +13.6% CPU — *i.e. it would have consumed this entire saving*, and
it was provisionally accepted on the grounds that correctness outranks speed. It then measured out as
+13.716 points on 1 of 25 cases. **Had the two landed together the net would have been ~0% CPU change for
~0 plan change, and the ledger would have shown a "correctness fix" paying for itself.** Both were
measured separately and independently, which is the only reason either verdict is legible.

---

### §5.13 ★★★ The `5:40` miss, LOCALISED — a stage trace beats another guess

§5.11 closed with three killed hypotheses and no mechanism. Every one of them was a **guess about
search dynamics** checked by a perturbation, which is exactly the error §5.10's retraction warns about:
*a perturbation localises the SYMPTOM, never the MECHANISM.* So this round stopped guessing and
**instrumented the pipeline** instead.

#### The instrument

`$SP/mkstage.py` rewrites a scratch copy of `index.html` (the repo file was frozen for the round-5
campaign) to call a `__STG(label, s, cfg)` helper that appends `{label, robust, layout}` to a global
log. Injection sites: each of the 6 snap candidates · post-main-hop · post-groom · each re-hop round's
entrant · **each of `normalize`'s four components separately** (`coPressAlign` → `spreadLoneHaste` →
`slideEarliest` → `dodgeDowntime`) · post-drop-one-use · both Cold-Snap branch outcomes · pre- and
post-final-canonicalization. It also makes the PRNG seed overridable (`globalThis.__SEED`, default
1337 ⇒ byte-identical), so the good and bad runs are the same binary. `$SP/stage-run.mjs` runs one
case and prints the trace with per-step deltas. Cost: ~7 min/case — but it answers in one run what
three perturbation experiments failed to answer at all.

#### What it showed

The good plan is **not** produced by the main basin hop. It is produced by **`rehop#1`** — the *second*
round of the re-hop↔canonicalize fixpoint at `:2785`:

| stage | seed 1337 | seed 4242 |
|---|---|---|
| `01 post-mainhop` | *(cluster family)* | 582455.531 `IV[0,190,310] isc[5,190,310] scb[5,195,315]` |
| `02 post-groom` | 582528.82 (after −963.7 groom dip) | 581493.57 (−961.96 groom dip) |
| `03 rehop#0` | `IV[0,126,306] isc[4,126,306] scb[4,126,306] AP[4,306] zerk[126,306]` | walks straight back to the pre-groom layout |
| `03 rehop#1` | **582688.621 `[5,127,307]` — +159.800** | identical ⇒ `stable=true` ⇒ **break after 2 rounds** |

Two facts fall straight out, neither of which any perturbation could have produced:

1. **The groom dips the plan by ~960 points at BOTH seeds, and the re-hop pays it straight back.**
   That is a ~960-point round trip per case, every case — and at 4242 the hop returns *the exact
   pre-groom layout*, so the entire round trip was wasted work. (Do not act on this yet: it is a CPU
   observation from a 2-case trace, not a measured saving. Filed as a §6 candidate, not a ladder item.)
2. **The winner is one `teleportRep`-width move from `rehop#0`'s output at 1337** — `{4,126,306}`
   shifted +1 to `{5,127,307}`, plus IV's opener `0 → 5`. At 4242 the entrant is the `190/310` family
   instead, from which no anchor reaches `[5,127,307]`, and round 1 already reports `stable` so the
   loop **exits after two rounds instead of three.** The good plan needs a third round the bad seed
   never gets.

#### And the winner is a genuine fixed point, not a fluke

`$SP/cs-align.mjs` §A: `repair([5,127,307]…) = 582688.621` and `polish` of it = **the same value**. The
layout is a stable polish basin that the search simply never *visits*. This kills the last "it's a
scoring artifact" reading and confirms the miss is purely one of **reach**.

#### Three more hypotheses, all FALSIFIED

4. **"The Cold-Snap press should slide onto a co-press second."** Decoding the winner:
   `icyVeins[5,127,307]` is IV at Lust, **Cold-Snap→IV at 127**, natural IV at 307 — and 5→127 is
   **122 s**, i.e. the CS press is deferred onto the 120 s trinket beat (`isc`/`scb` pressed at 5 return
   at 125). `cs-align.mjs` §B built that family from the seed-4242 champion — 33 candidates, every CS
   press slid onto every co-press second, with and without dragging the stack along. **Best = the
   champion itself, −233.090.** Cause of failure, and it is instructive: the champion opens
   `icyVeins[0,…]` while the winner opens `icyVeins[5,…]`. **Sliding one press cannot repair a wrong
   *first* press** — the family was anchored on the wrong origin.
5. **"A LOCKSTEP-STACK seed class is missing."** The winner presses the whole kit together on three
   group seconds, and its *second* gap is **180** (IV's cd) not 120 — `isc`/`scb` deliberately **skip a
   use they could have taken** to stay stacked. That is nameable: greedy co-press groups, each firing
   when the short-cd tracks come up, Cold Snap freeing IV once. Built it (`$SP/stack-seed.mjs`),
   polished and hopped: **582553.499, −135.122.** Same basin the naive per-track-cd align-chain reached.
   The construction is right in spirit and still misses.
6. **"The Cold-Snap CHAIN FAMILY in the code is too narrow."** This one is a claim about the *source*,
   not about search luck, which is why it was worth running over the whole corpus. `optimizeCore` builds
   its Cold-Snap candidates as `ch[i<j] = i·cd ; ch[j] = ch[j-1] + dur ; ch[i>j] = ch[j] + (i−j)·cd` —
   the Cold-Snap press is always taken **ASAP** after the previous Icy Veins window (`+dur`), or the
   chain is natural (`+cd`). But a Cold-Snap-freed Icy Veins is on **no cooldown at all**: its press
   second is *free*, and `+dur` is one choice out of many. The winner spends it **122 s late**. So:
   widen the family by one parameter — for every origin `o` and every co-press second `c`, IV = natural
   chain from `o`, truncated before `c`, then `c`, then re-anchored from `c`; offered twice, with the
   rest of the kit left alone and with it dragged onto the group seconds. 26–236 candidates per case,
   polish-only, all 25 cases (`$SP/cs-free.mjs`). **Two** cases in the corpus gain anything at all, both
   trivially: `3:20 lust 0:05 drums` **+38.8** (0.011 %) via `o0/cs@179+stack` and `Al'ar` **+8.1**
   (0.0024 %) via `o1/cs@203`. Rejected on cost alone — ~0.005 % for 78–236 extra polishes per case is
   the wrong direction for a phase whose subject is CPU — and rejected again on its motivating case,
   below.

   **⚠ Its `5:40` row read "+0.000 across 78 candidates", and that row was VACUOUS.** `cs-free.mjs`
   derives its origins and co-press seconds from **the case's own baseline plan**, and `5:40`'s baseline
   in `fullPristine.json` **is the winner** (the sweep runs the seed-1337 default, which finds it). The
   family was generated *from the target*: a tie was the only outcome the test could produce. It could
   not have failed, so it did not measure anything. Recording it as a falsification was the same species
   of error as the repricing trap below — a comparison whose two sides were not independent.

   The real question — can the widened family reach `[5,127,307]` **from the 4242 entrant** — is
   answered separately, and negatively, for a sharper reason than (4)'s. That entrant presses
   `icyVeins[0,190,310] isc[4,190,310] scb[4,195,315] arcanePower[4,195] berserking[20,200]
   bloodlust[5]`; the arithmetic co-press set `{t, t+cd, t+dur}` over those presses has its nearest
   members to the winner's key second at **124** (`isc[4] + 120`) and **125** (`basinHop`'s 5 s grid
   snap of that same tick). **127 is not a co-press second at all** — it is 125 pushed +2 by
   cast-boundary snapping downstream. And the 124/125 family was already measured in `cs-align.mjs`:
   **582400.409**, with polish dragging IV's opener back to 189. The family misses because the second it
   needs is not in its alphabet — which is a fact about the **anchor grid**, and feeds (L2) below.

##### ⚠ …and hypothesis 6's first table was WRONG, in this repo's own named way

The first run of `cs-free.mjs` reported **7 of 25 "★ BEATS shipped"** and I nearly wrote it up that way.
It was the **REPRICING TRAP** (TOOLING; DIARY 07-25) — reappearing on the *model* side, inside my own
instrument, one section after I quoted the rule. The probe compared `polish(repair(candidate))` against
the score the sweep **recorded** for the shipped plan. But a shipped plan does not carry `simulate()`'s
maximum for its own layout: it carries the **legibility trade grooming paid for it** (`castVal/8`,
`EPS = 0.5`, `coPressAlign`'s pressability give-back). Re-polishing strips that trade, so
`polish(repair(shipped))` out-scores the recorded number **with nothing changed at all** — on **7 of 25**
cases here, by up to +344. Five of the seven "wins" were therefore the baseline out-scoring *itself*,
and they were tagged `via (shipped)` right there in the output, which is what gave it away. Against the
honest baseline — the shipped plan pushed through the **identical** treatment the candidates get — the
count is **2**, and both are noise-scale.

**The rule, generalised past the sim:** *never compare a freshly-computed score against a recorded one;
if two numbers in one comparison came out of different code paths, the comparison is not a measurement.*
The trap is easy to re-enter because the contaminated column is the **flattering** one — it manufactures
wins, so nothing about the output looks broken. Written into `TOOLING.md` next to the sim-side statement.

#### Where this leaves it — and the discipline note

Six mechanisms killed; **do not re-litigate any of them.** But the miss is no longer unexplained in the
way §5.11 left it: it is now known to live in the **re-hop fixpoint's reach**, not in the seeds, not in
the snap, not in the plateau, and not in the scorer. Two leads were opened. **(L1) is now dead too.**

##### (L1) The `stable` early-exit — FALSIFIED, and the round budget was never the constraint

The lead: `stable` tests whether the **hop** improved, but `normalize` runs *after* the test, so a round
that moves the plan only via canonicalization is graded stable and ends the loop. At 4242 round 1
reports stable and the loop exits after two rounds; at 1337 the *third* round is where +159.8 lands.

Tested at the cheapest possible scale, on **scratch copies** of `index.html` (`$SP/mkL1.py`), before any
corpus sweep — single case, 14 starts, ~30 s each in bare node (`$SP/l1-probe.mjs`):

| variant | change |
|---|---|
| `L1base` | unmodified engine + the `globalThis.__SEED` override only |
| `L1fix`  | `stable` becomes a **real layout fixpoint**: `sigOf(s2) === sigOf(s)` |
| `L1r6`   | round budget **3 → 6** |

**Both controls run, because a probe whose failure mode is a PASS needs both.**

| seed | control asserts | `L1base` | `L1fix` | `L1r6` |
|---|---|---|---|---|
| 1337 | must reach 582688.621 | **582688.620970** | **582688.620970** | **582688.620970** |
| 4242 | must reproduce 582455.531 | **582455.530709** | **582455.530709** | **582455.530709** |

Positive control passes: neither variant *loses* the good plan where it is currently found (all three
return `icyVeins[5,127,307]` at 1337). Negative control passes: `L1base` reproduces the miss exactly.
And the verdict is unambiguous — at 4242 all three return **byte-identical layouts**
(`icyVeins[0,190,310] isc[4,190,310] scb[4,195,315] arcanePower[4,195] berserking[20,200]`), −233.090.

**More rounds and a stricter stability test change nothing at all** — not the value, not one press
second. `stable` firing early is a real observation about the *test*, but the loop had genuinely
converged: it was not being cut short, it had nowhere left to go. (L1) is dead. **Do not re-litigate it.**

##### (L2a) The anchor alphabet — FALSIFIED by giving the hop EVERY anchor there is

Reading `basinHop` (`index.html:1285-1360`) first sharpened (L2) into a specific, appealing defect:
anchors are entrant-derived — each press second `t`, each natural next tick `t + cd` **snapped to a 5 s
grid** (`grid = x => Math.round(x/5)*5`, `:1297`), each max-stack onset off the cast board, and `T − 1`.
The tick that matters is `isc[4] + 120 = 124`, which the grid rounds to **125**, while the winner's
second is **127**. Obvious fix, and a rule rather than a hand-fitted anchor: *snap next-tick anchors to
cast boundaries instead of the grid.*

**It is wrong, and one probe killed it before a line of engine code was written** (`$SP/l2-reach.mjs`).
Rather than argue about which anchors are missing, hand the hop **the entire alphabet** — every second
`0 … T−1` — from the stuck 4242 plan:

| anchor set from the stuck plan | value | vs stuck | polishes | secs |
|---|---|---|---|---|
| real anchors (**NEG control**) | 582455.530709 | +0.000 | 66 | 5 |
| + 127 | 582455.530709 | +0.000 | 73 | 5 |
| + 5, 127, 307 | 582455.530709 | +0.000 | 78 | 6 |
| **FULL alphabet `0..T−1`** | **582455.530709** | **+0.000** | **1769** | 89 |

**Zero.** 2712 pairs, 1769 polishes, and the best single group-move ties. (Controls: the stuck plan
repairs to exactly 582455.530709 and the winner polishes to exactly 582688.620970, a confirmed fixed
point.) Note also that `teleportRep` (`:1260`) is a **group** move — every non-fixed press at second `X`
shifts together — so this is not a one-press-at-a-time limitation either. The stuck plan is a **strict
local optimum over the complete single-move neighbourhood**. No anchor rule of any kind can help, and
cast-boundary snapping would have been pure wasted work. **(L2a) is dead — do not re-litigate it.**

##### ⇒ The real defect: a MISSING SEED CLASS. Located, and the existing machinery does the rest.

If no move reaches the basin, the basin has to be **entered**. Decoding the winner *structurally*
instead of numerically shows it is not exotic at all — its press seconds are a chain whose gaps come
from the kit's own cooldowns:

```
5 --(+120, the trinket cd)--> 125 --(+180, IV/zerk cd)--> 305        (polish then finds the +2 → 127/307)
```

and every track presses at every group second it is **up** for, with Cold Snap buying Icy Veins one
extra, and a haste track allowed to **skip the opening group**:

```
IV  5, 125 (CS: 120 < 180), 305     isc/scb  5, 125, 305  ← SKIPPING the 245 use they could have taken
AP  5, (185 is not a group second), 305        zerk  (skips group 1) 125, 305
```

That is **not** what hypothesis (e)'s LOCKSTEP-STACK seed built: (e) advanced greedily on the *shortest*
cd, so its third group landed at 245 (582553.499). The winner deliberately **skips a use to stay
stacked**. So the seed class is `origin × gap-chain-drawn-from-the-enabled-cd-set × which haste tracks
skip group 1` — 80 candidates here, **no hand-fitted seconds**: 125 and 305 fall out of cooldown
arithmetic (`$SP/l2-seed.mjs`).

| | value | vs stuck | vs winner |
|---|---|---|---|
| stuck seed-4242 plan | 582455.530709 | — | −233.090 |
| hypothesis (e) LOCKSTEP-STACK | 582553.499 | +97.97 | −135.122 |
| **group-second seed, polish only** | **582662.017896** | **+206.487** | −26.603 |
| **… then `basinHop`, REAL unmodified anchors** | **582688.620970** | **+233.090** | **+0.000 ← WINNER** |

The seed lands the structure exactly — `berserking[127,307]` already correct — and misses only by the
whole group sitting at 125/305 instead of 127/307, which `polish` cannot fix because it moves one press
at a time. **`basinHop` then closes it with its own existing anchors in 3 rounds / 66 polishes / 5 s.**
Adding the full alphabet to *that* hop changes nothing either — it is not anchor-starved, it never was.

A `GROUP NUDGE` operator (shift every press at a second by ±1/±2/±3 **together**) was also built and is
**not needed**: +16.929 alone, never reaches. No new operator, no anchor change, no extra rounds —
**one missing seed class.**

**So the `5:40` miss is fully diagnosed**, by elimination with each alternative independently falsified:
anchors fine, rounds fine, scorer fine, operator set fine. What remains is to add the group-second seed
to `optimizeCore`'s start set. That is a SEARCH change, so §5.10 binds in full — **`plan-sweep` on all
25, `plan-diff`, and a DUEL on every changed cell**, never the quick tier. (Also worth noting for the
legibility pass: openers 5, 6 and 7 all score **582688.620970** exactly — the winner sits on a tie
plateau, so canonicalization picks the representative.)

**The methodological point, which outranks the finding.** Three perturbation experiments over two
sessions produced three wrong mechanisms and zero localisation. One stage trace produced the exact pass,
the exact round, and the exact entrant — and cost less than any one of them. **When the question is
"which step does X", instrument the steps. Perturbing the input and reading the output can only ever
tell you that something is sensitive, never what.**

---

### §5.14 ★★★ `groupSeeds` — the fix LANDED, and the instrument lesson that came with it

§5.13 root-caused the `5:40 lust 0:05` search-miss to **a missing seed class**. This section is the
landing: what shipped, how it was bounded, what was measured and rejected along the way, and — the part
worth more than the fix — **why the corpus differ said IDENTICAL and that was the correct result.**

#### What shipped

`groupSeeds(cfg)` (`index.html`, immediately above `mulberry32`), one line into `optimizeCore`'s seed
list between the kill-anchored seed and the random fill. It builds the RULES §4b **chain** entrants
directly:

```
origin × gap-chain-drawn-from-the-enabled-cd-set × which long-cd track skips group 1
```

- **origins** = `{0} ∪ round(fixed press seconds)`, first 3 — no hand-fitted seconds anywhere.
- **chains** = DFS over the *enabled cooldown periods themselves* (`5 —+120→ 125 —+180→ 305`),
  **maximal only** (a prefix hands every track strictly fewer uses ⇒ dominated), depth ≤ 6, ≤ 24 chains.
- each track presses at every group second it is legally up for; **Cold Snap grants Icy Veins exactly one
  early repeat** inside the chain.
- **skip variants** = `[null, ...longs]`, `longs = tracks whose cd exceeds the shortest enabled cd` —
  **linear in tracks, not `2^n`**. This is the clause hypothesis (e) got wrong: the winner *declines a
  use it could have taken*, to stay stacked.
- deduped by `sigOf` after `repair`.

#### Bounding it — the cost was never the question, but it was asked anyway

| | |
|---|---|
| worst family size on the corpus | **40** (`7:20 lust 0:05`) |
| total generation cost, all 25 cases | **88 ms** |
| cases producing 0 chains (fight too short) | Hydross · Karathress · Solarian · `1:40` · `2:00` |
| representative sizes | KT 20 · Vashj 16 · Al'ar 16 · `5:40` 24 · lust-4:20 cases 12 |

#### ★★ The top-K score cut was BUILT, MEASURED, and REJECTED

The obvious economy is to pre-score the family with `simulate()` and polish only the best K. It was
measured (`$SP/l3-rank.mjs`, full-family polish on all 25, 33.1 s) and it is **self-defeating**:

| case | candidates | raw rank of the polish-best | loss at top-3 |
|---|---|---|---|
| `7:20 lust 0:05` | 40 | **13** | 1057.640 |
| `6:00 lust 4:20` | 12 | **12** (dead last) | 917.094 |
| `5:45 lust 4:20` | 12 | **12** (dead last) | 917.094 |
| Lady Vashj | 16 | 7 | 2718.557 |
| **corpus total** | | | **top1 −24814.300 · top3 −8087.794** |

> **★★ A SEED'S RAW SCORE IS NOT A PROXY FOR ITS BASIN.** These seeds exist precisely because the good
> layout is *unreachable by local moves* — so ranking them by the local objective they are there to
> escape selects against the ones that work. The generator is cheap; the polish is the expense; and the
> cheap thing cannot be used to budget the expensive one. **Ship the full family.**

#### The gate — full 25, both tiers (a SEARCH change, so §5.10 binds: never the quick tier alone)

```
QUICK (--max-t=200, 16 cases)  PLAN-DIFF compared=16 changed=0 … IDENTICAL
FULL  (25 cases)               PLAN-DIFF compared=25 changed=0 subSecOnly=0 onlyA=0 onlyB=0 errors=0
                               PLAN-DIFF IDENTICAL          (0 illegal, 0 errors, both sweeps)
```

**DUEL: not required — 0 changed cells**, so there was nothing to grade head-to-head.

#### ★★★ A PLAN-NEUTRAL DIFF IS NOT AN INERT CHANGE — the instrument lesson

The 25-case differ came back **byte-identical**, which on any other change in this phase would have read
as *"landed nothing."* It is not, and the reason is structural: **the corpus sweep holds the PRNG seed
fixed at 1337**, and §5.10 already established that at 1337 `5:40` finds the winner **by luck** — "ONE
lucky restart out of 14." A robustness fix restores the winner on the seeds where luck ran out; on the
seed where it didn't, the output is unchanged **by definition**.

> ★★★ **CHOOSE THE INSTRUMENT BY THE AXIS THE CHANGE ACTS ON.** `plan-diff` varies *the case* and holds
> *the seed*. A fix whose whole content is "stop depending on the seed" is invisible to it — not weakly
> visible, **structurally invisible**. Running it was still right (it proves the 24 other cases did not
> move), but reading it as the verdict would have thrown away a working fix as a no-op.

The instrument that *can* see it varies the seed. `$SP/l1-probe.mjs` on `5:40 lust 0:05`, six seeds,
base (`index.html` at HEAD) vs group:

| seed | base | group | Δ |
|---|---|---|---|
| 1337 (default) | 582688.620970 ✓ | 582688.620970 ✓ | +0.000 |
| 4242 | 582455.530709 ✗ | **582688.620970 ✓** | **+233.090** |
| 7 | 582688.620970 ✓ | 582688.620970 ✓ | +0.000 |
| 99 | 582455.530709 ✗ | **582688.620970 ✓** | **+233.090** |
| 2024 | 582678.947125 ✗ | **582688.620970 ✓** | +9.674 |
| 31337 | 582455.530709 ✗ | **582688.620970 ✓** | **+233.090** |

**2 of 6 → 6 of 6**, the identical layout every time
(`arcanePower[5,307] berserking[127,307] bloodlust[5] icyVeins[5,127,307] isc[5,127,307] scb[5,127,307]`),
and *faster* on the seeds it fixes (19–22 s vs 31–52 s) — the good entrant reaches its fixpoint in fewer
hop rounds than the bad one spends failing to escape.

**Regression control on the same axis** (a fix that only ever *adds* seeds still has to be shown not to
move anything else): `5:00 lust 0:05`, `4:00 lust 0:05`, `5:45 lust 4:20` × seeds {1337, 4242, 99} —
**every cell bit-identical** between base and group (521998.552858 / 428257.758448 / 589246.601154).
**Zero regressions.**

#### What this closes

Open debt (a) `5:40 lust 0:05` — **CLOSED.** Eight mechanisms were proposed for it across two sessions;
seven were falsified, the eighth (reachability) named the real one. RULES §4b now carries the
theorycraft, so the next kit-limited miss can be written down by hand from cooldown arithmetic before
any search is run.


#### The INTERACTION gate — the one thing neither change had been tested for

Both landings were measured **against pristine, separately** (§5.12 groom, §5.14 `groupSeeds`) and never
against *each other*. That is a real gap: `groupSeeds` adds entrants, the groom exit changes when a round
stops improving them, and "each is plan-neutral alone" does not imply "both are plan-neutral together."
So after landing both into `index.html`, the pair was swept back-to-back against `git show HEAD:index.html`
on **idle cores**:

```
PRISTINE (HEAD)                    SWEEP OK cases=25/25 jobs=3 wall=228.7s cpu=635s errors=0 illegal=0
COMBINED (groom exit+groupSeeds)   SWEEP OK cases=25/25 jobs=3 wall=216.5s cpu=581s errors=0 illegal=0
PLAN-DIFF compared=25 changed=0 subSecOnly=0 onlyA=0 onlyB=0 errors=0
PLAN-DIFF IDENTICAL
```

**Net: −8.5% CPU, −5.3% wall, 25/25 plans bit-identical.** Less than the groom exit's −10.1% alone, and
that is the expected sign: `groupSeeds` *buys* robustness with up to 40 extra polishes on the longest
case, so the combined figure is the groom saving minus the seed cost. Both are worth having; the ledger
should show them netted, not each claiming its own headline.

> **★ ABSOLUTE CPU IS NOT COMPARABLE ACROSS SWEEPS — only the within-pair delta is.** The same pristine
> engine measures **695.1 s at `jobs=2` (§5.12, contended) and 635 s at `jobs=3` (here, idle)**. Nothing
> changed in the file; the number moved 9%. Every perf claim in this phase is therefore stated as a
> delta against a baseline swept **in the same session, at the same `jobs`, under the same load** — a
> figure lifted out of one table and compared to a figure in another is meaningless.

### 4.22 Incidental datum from P7.14: `simulate()` memoizes, and the memo is already load-bearing

> **§ number corrected 07-25 — this was appended as a second "4.21" and collided with the `admit`
> patch section at line 1407, which a dozen cross-references point to by number.** Nothing else in the
> document referenced *this* one, so the later section moved. Append-only means the text stays, not that
> a numbering mistake has to stay with it.

Surfaced by accident while instrumenting the engine for the AoE press-snap fix (PHASE7 §5.19). A trace
split printed nonsense — `integral d = −742070` — at one press time whose **snapped schedule duplicated
its neighbour's**; the memo returned the cached result and the injected trace hooks never ran. `robust`
was correct throughout; only the instrumentation was fooled.

Two things worth carrying into this phase:
- **The memo already fires on genuine duplicates produced by the search**, not just on repeated
  re-scoring of one candidate. Any §4.2/§4.13 change to the key must therefore preserve *collision
  behaviour*, not merely be faster to build.
- **Instrumentation that hooks inside `simulate()` is silently memo-shadowed.** A census or trace that
  counts per-call work will under-count by the hit rate. Instrument at the memo *wrapper* (or clear it)
  when the question is "how much work happens", and inside when the question is "what does one
  simulation do".

### §5.15 ★★★ THE −8.5% CPU LANDING IS NOT PLAN-NEUTRAL OFF-CORPUS — 3 search regressions, found by the acceptance round, invisible to every gate we had (07-25)

§5.12 (groom early exit) and §5.14 (`groupSeeds`) landed together on the strength of one sentence:
**`PLAN-DIFF compared=25 changed=0` — 25/25 bit-identical, −8.5% CPU.** §5.14 even wrote down the
caveat that the sweep "holds the PRNG seed fixed and is structurally blind to a robustness fix, so
plans on *other* fights may move". It did not draw the consequence: *if a plan moves, nothing we run
checks which way it moved.*

The PHASE7 round-6 re-gather is the first corpus these two changes have met that is not the goldens.
On its first 10 class tables (100 `(haste → plan)` cells, round 5 vs round 6):

```
EFF-AUDIT unchangedSpecs=82 scorerMoved=0 movedSpecs=18 → worse=3 better=0 tie=15
```

| cell | round 5 eff | round 6 eff | Δ |
|---|---|---|---|
| `mqg-skull-medlong` @h265 | 204.883 | 204.812 | **−0.0347 %** |
| `mqg-skull-medlong` @h160 | 195.754 | 195.742 | −0.0061 % |
| `mqg-skull-long` @h100 | 233.225 | 233.218 | −0.0030 % |

**`better=0`.** Eighteen plans moved; fifteen were exact ties, three got worse, and *not one got
better*. That is the signature of a search that lost ground, not one that traded around.

#### Why this is airtight without a single sim

`eff` is the **model's own** effective-AB score — the quantity the optimizer maximizes. So the
inference needs only one premise: that the two rounds share a scorer. The audit **proves** it rather
than assuming it — **82 cells whose spec is byte-identical score byte-identically**, to the last digit
(`scorerMoved=0`). With the scorer pinned, every eff delta is attributable to the search alone, and a
*lower* eff means round 6's optimizer rejected a layout that round 5's had found and that its own
objective prefers. No sim, no noise band, no judgement call.

The h265 cell shows it is not a rounding wobble either — the plan genuinely restructured:

```
A  eff=204.883  AP:[3,183]  MQG:[60]   Skull:[40,178]
B  eff=204.812  AP:[4,205]  MQG:[140]  Skull:[40,160]
```

while h0/h30 on the same table moved `AP:[3,183]→[4,184]` at **identical eff to six figures** — a real
tie-break sitting right next to a real regression, in the same table. The per-table eff *range* column
prints `-0.035%..+0.000%` for both together, which is exactly why the range was not enough.

#### The gate hole, stated precisely

- `exact-match` compares **final rendered plans**. Bit-identical ⇒ silent.
- `plan-sweep`/`plan-diff` compare `best.s` and *do* carry a `Δscore` per changed cell — but the file
  says outright that it "does NOT answer *is the new plan better*", and nothing grades on the sign.
- On the goldens both changes produced `changed=0`, so `Δscore` was **never populated at all**. The
  one field that would have caught this was structurally guaranteed to be empty on the only corpus it
  was run against.

**The missing rule: for a change that touches only the SEARCH, the model's own objective must be
non-decreasing at every cell.** `Δscore < 0` is then a defect by definition, not an observation.
That check costs nothing — both instruments already have both numbers.

#### Landed here

`tools/xval-round-diff.mjs` gains the **EFF-AUDIT** block: scorer-identity proof + moved-plan split by
sign + the named regression list. Exit stays **0** — the file's exit contract is quoted in
`tools/xval-results/README.md` and callers grade on it, so this is made loud, not fatal.

**Open (deliberately not decided here):**
1. ✅ **DECIDED (07-25): yes — `worse>0` under a pinned scorer is exit 1**, with `--observe` restoring
   the old observation-only exit for a round pair *known* to trade eff deliberately (the §5.11-style
   epsilon canonicalization is the named case). The user was asked per this item's instruction and
   deferred ("no idea"), so default-fatal + explicit opt-out was chosen to match plan-diff's new rule:
   a proven regression must not ride a green exit into an acceptance round, and the escape hatch
   exists in the tool rather than being improvised later. Contract updated in the file header and
   `tools/xval-results/README.md`, same commit. ⚠ Running the audit over all **30** round-6 class
   tables (vs the 10 the table above had) reads `movedSpecs=52 → worse=7 better=5 tie=40` — the
   regression list for attribution is **seven cells**, and the "not one got better" sentence above
   describes the first-10 snapshot only (5 cells did improve once the full class half landed; each
   `worse` cell remains individually provable regardless).
2. ✅ **LANDED (07-25): `plan-diff` has the rule** — the `SCORE-AUDIT` block. It proves scorer
   identity the same way EFF-AUDIT does (a cell whose plan is byte-identical must score
   byte-identically; determinism guarantees it under a shared scorer), then splits changed cells by
   `ΔScore` sign. **Scorer pinned + `ΔScore<0` = `PLAN-DIFF FAIL — search regression`, exit 1 even
   under `--allow-change`** — that flag admits movement, not regression. If the scorer moved it
   prints the repricing warning and does not grade the sign (per-cell duel territory); if *zero*
   cells are unchanged, identity is unprovable and it says so instead of grading. Old sweep JSONs
   without a `score` field are counted `unscored`, never graded. Contract updated in §5.3 and the
   file header. (plan-diff's exit-1-on-change default was never the published-observation contract
   that makes the same question hard for `xval-round-diff`, so this one did not need a user call.)
3. **Attribution is still owed**: groom-exit vs `groupSeeds` vs their interaction. Cheap and sim-free —
   re-optimize `mqg+skull` medlong (T=226, lust=0) @h265 against `git show <pre-landing>:index.html`,
   one variable at a time. **Needs idle cores; do not run it against the live acceptance campaign.**

#### What it does NOT invalidate

Round 6 remains the `emit=fire` re-baseline the acceptance docs demand, and the acceptance test was
already failing, so this is not a verdict round. But **the final verdict must not be read off an engine
carrying a known search regression** — fix and attribute first. Sizing it honestly: 3 of 100 class
cells, worst 0.035 % — small, one-directional, and the deficit it inflates (`mqg-skull-medlong`
0.09 % → 0.12 %) is nowhere near the zero-deficit bar that is actually blocking acceptance.

**★ The instrument lesson, and it is the same one §4.15/§4.21 taught in a different costume:** a gate
that reports an *absence* ("0 plans changed") certifies nothing about the cases it never produced. Both
landings were gated on plan-**identity**, which is strictly stronger than score-non-decrease *where it
holds* — and says exactly nothing where it does not. The stronger check bought the weaker one's
coverage for free on 25 cases and zero coverage everywhere else.
### §5.16 ★★★ ATTRIBUTION AND FIX — the §5.15 regressions are GROUPSEEDS ALONE, through three eviction/winner-take-all sites; the groom exit is exonerated (07-25)

§5.15 owed an attribution: groom early exit (§5.12) vs `groupSeeds` (§5.14) vs interaction, and by
the time it ran the list had grown from 3 regressed cells to **7** (the full-30-table EFF-AUDIT:
`movedSpecs=52 → worse=7 better=5 tie=40`). The instrument is a bare-node reproduction of
`xval.mjs`'s exact champion-search + cross-haste pooling (`attr-cell.mjs`, scratchpad; engine-node
`loadEngine` + the engine's own `GAME` for the plain normalizer), validated by reproducing the
committed round-6 `mqg-skull-medlong` table **bit-for-bit** — all 10 effs AND all 10 emitted
fire-time specs — before any variant was graded.

**Single-variable isolation, worst table (`mqg-skull-medlong`, cells @h160 −0.0061% and @h265
−0.0347%):** four engine variants built off HEAD by removing one landing at a time.

| variant | @h160 | @h265 | reads as |
|---|---|---|---|
| base (both changes removed) | 195.754 | 204.883 | = round 5, bit-for-bit |
| groom-exit only | 195.754 | 204.883 | = round 5 — **groom exonerated** |
| groupSeeds only | 195.742 | 204.812 | = round 6 — **the whole regression** |
| full (= HEAD) | 195.742 | 204.812 | = round 6 |

The same isolation at `isc-mqg-medlong @h20` (the smallest cell, −0.0005%) reads identically:
base = groom = r5, seeds = r6. **Every attributed cell is GROUPSEEDS ALONE; the groom early exit
has zero confirmed casualties**, consistent with §5.12's determinism argument. (The base variant
matching round 5 bit-for-bit on full tables also re-confirms P7.14 is inert on class fights.)

#### The mechanism is not one bug but THREE — all the same shape: an ADDITIVE seed class wired
#### through EXCLUSIVE selection points

`groupSeeds` was designed as pure addition ("a missing seed class"). The pipeline it was added to
has three winner-take-all narrows, and at each one an added entrant can EVICT the entrant that was
going to win:

1. **The seed fill** (`for (gs of groupSeeds) seeds.push(gs); while (seeds.length < starts)
   seeds.push(randomSchedule(...))`) — group seeds count TOWARD `starts`, so once the structured
   count passes 14 the random starts are silently displaced (the h265 trace: `n=14` with 10 group
   seeds present ⇒ every random start gone, and one of those randoms found the winner). Note the
   PRNG stream itself is safe (`rand` is drawn per random actually pushed), the COUNT was the bug.
2. **The snap stage's top-6 cut** (`results.sort(); slice(0, 6)` with `best = null` — the final is
   rebuilt EXCLUSIVELY from the six snapped candidates) — a group entrant with a high raw val
   crowds a base entrant out of the six, and §5.14's own headline ("a seed's raw score is not a
   proxy for its basin", polish-best at raw rank 13/40) says exactly why that displacement loses.
3. **Winner-take-all into `basinHop`** — measured at h160: the group entrant out-snaps the base
   winner by **+34** (536986 vs 536952), its basin is a dead end (hop gains **+0**), the displaced
   base winner's basin climbs **+3594** (to 540547). A 0.006% raw lead traded for a 0.66% final
   loss.

#### The fix (LANDED): additive seeds get additive plumbing

Three edits, each restoring "adding entrants never removes entrants":

- **Fill first, append after.** Randoms fill to `starts` BEFORE the group seeds are appended, and
  the group range is tagged (`grpStart`). The pre-landing entrant population is a superset floor.
- **The six base snaps stay; group snaps ADD.** `topBase = top-6 of non-group` (the pre-landing
  cut, exactly), plus every group entrant above that bar as EXTRA snap candidates, tracked as a
  separate `bestGrp`.
- **Hop both; the base hop is a STRICT-improvement override.** When the group entrant led at the
  snap (i.e. when the old single-winner rule would have carried it), BOTH lines are hopped and the
  old selection stands unless the base hop strictly beats it. ⇒ the engine differs from the landed
  one exactly where the base basin provably wins (h160: +3560), and nowhere else; §5.14's `5:40`
  win is preserved (its group entrant strictly wins). The first cut of this rule broke ties toward
  the BASE line and promptly lost a legitimate round-6 gain (`scb-skull-xl @h260`, +0.005) — the
  probe showed the two hops meeting at **exactly** 1059624.234589852 on two different layouts, the
  tail lottery deciding. Ties are real; the tie must carry the old selection or the fix
  manufactures the very regression class it closes.

**Validation (model-side, all 6 affected tables re-swept end to end — 60 cells):** the fix is
**≥ round 6 at every cell**, ≥ round 5 at 59/60, all 7 regressions healed to round-5 values
except the documented h20 hair, and BOTH round-6 improvements kept (`scb-skull-xl @h260` via the
tie rule — the cell the first-cut tie-to-base rule lost; `isc-skull-xl @h260` via a strict group
win). Unmoved cells reproduce both rounds exactly — no new churn.

**The golden gate (full 25, jobs=3, same session):** `PLAN-DIFF compared=25 changed=1` —
24 goldens bit-identical, scorer pinned on all 24 (`SCORE-AUDIT … scorerMoved=0 → worse=0
better=1 tie=0`), and the ONE change is **Kael'thas at Δscore +17.79, strictly better on the
model's own objective**: the terminal cluster re-parks 381→396 with the third trinket uses
260→265 — a placement the evicted entrants could never offer. Golden re-recorded on the
arbiter rule (a search-only change under a proven-pinned scorer is graded by the model's own
count; the +0.006-cast delta is ~20× below the sim's ±0.125 pp boss band, so a sim duel cannot
resolve it either way — the §5.20 sub-noise precedent).

**The CPU price, measured honestly (same session, same jobs):** sweep A (landed engine) 638 s
CPU / 273.8 s wall → sweep B (fix) **743 s CPU (+16.5 %) / 284.9 s wall (+4 %)**. The −8.5 %
§5.12+§5.14 win is given back and slightly more (net ≈ +6.6 % vs the pre-landing baseline):
the restored random polishes plus the occasional second hop are the cost of the monotonicity.
Reclaim candidates stay open in §4 (the admissibility triple §4.16, the `admit` patch §4.21) —
and the tail-refactor remedy below would double as a reclaim site.

#### ⚠ The residual: the finishing tail is ONE MORE winner-take-all, deliberately not fixed tonight

Two measured cells, one in each direction, same root: after the hop, the finishing stack
(challengePass/groom/marginal-relocation/CS-comparison) runs on ONE line, and its outcome is not
monotone in its entry value.
- `isc-mqg-medlong @h20` (−0.001 eff vs r5): the group line legitimately leads at hop-exit (+101),
  both lines would gain ~+1500 in the tail, and the BASE line's tail run ends **+2.77 higher** —
  the winner-take-all inverts. The two final layouts differ by a joint 1 s shift of the terminal
  co-press cluster (`AP/Zerk@187, Icon@182` vs `@188/183`), a move no existing pass can make (each
  track moves alone; a co-pressed cluster only moves together).
- `scb-skull-xl @h260` (+0.005 eff, the direction round 6 got LUCKY): hop-exit exact tie, the
  group line's tail run wins. fix3b keeps this by the tie rule; nothing guarantees the next such
  cell falls the kept way.

Two specified remedies, filed for follow-up with the h20+h260 pair as the ready-made two-sided
test (the same way §5.10 filed the 5:40 basin anchor that became §5.14):
- **The airtight one:** extract the finishing tail into a callable `finishLine(entrant)` and run
  it on BOTH lines when the group leads at hop-exit, comparing FINAL vals. This is a genuine
  Phase-9 refactor (the tail is ~700 lines ending in the Cold-Snap branch's own nested resolves)
  and doubles tail CPU exactly when `grpLeads`, which the traces say is common on kit-limited
  fights — measure before landing. It also serves §4's "fewer steps that do the same thing":
  a callable tail is testable in isolation.
- **The cheap one that may moot it:** a **cluster-shift move class** (shift a whole co-press
  cluster ±N seconds as one move) in the groom alphabet — the missing move the h20 fixpoint gap
  demonstrates, and plausibly useful beyond this cell.

Until one lands, the acceptance verdict carries the note: the engine is ≥ round 6 at every
measured cell and ≥ round 5 at 6 of the 7 attributed cells, with a −0.001-eff known hair at
`isc-mqg-medlong @h20` vs the superseded round-5 engine.
### §5.17 ★★ THE TAIL LOTTERY CLOSED — `finishLine(entrant)`: the finishing stack runs per hop arm and the FINAL values decide (07-26)

§5.16 landed with a filed residual: the finishing stack (challengePass / groom / marginal-relocation /
CS-comparison) ran on ONE line chosen at hop-exit, and its outcome is not monotone in its entry value.
The round-7 identity filter promptly produced the third instance — `isc-mqg-xl @h20`, where round 6 rode
the group line on a **1e-10 float-dust snap lead**, the landed rule correctly preferred the base hop
(**+5.85**), and the group line's tail would have finished **+14 higher**. Three measured instances,
both directions, every hop-exit selection rule provably loses some tails ⇒ the filed remedy became due.

**The refactor.** The tail (from `let s/val` through the Cold-Snap comparison to the final
canonicalization, ~1,400 lines) is now a callable `finishLine(entrant)` — its body byte-unchanged (the
inner `best` deliberately shadows the outer champion), its five exits converted from `resolve(...)` to
`return`. The two-arm hop keeps both outputs (primary = the old-rule carry, for byte-stability at
ties); the driver runs `finishLine` on the primary, then on the alt arm when its layout differs
(`sigOf`), and keeps the strictly-better FINAL:

- the no-Cold-Snap comparison solve inside the tail is **arm-independent and memoized**
  (`bestNMemo`) — the second arm's tail costs groom passes, not a second full solve;
- ties keep the primary line, so cells where the arms' finals tie emit exactly what the
  single-arm engine emitted.

**Guarantee, now end-to-end:** final ≥ tail(pre-groupSeeds pipeline's line) AND ≥ tail(single-winner
pipeline's line) at every cell, by construction — the §5.16 statement without the tail asterisk.

**Validation.**
- The four lottery tables re-swept end-to-end: `isc-mqg-medlong` **ALL cells ≥ max(r5, r6) — the §5.16
  h20 hair (−0.001) HEALS** (the base arm's tail wins, as the §5.16 trace predicted: 509401.7 vs
  509398.9); `mqg-skull-medlong` heals hold (h160/h265); `scb-skull-xl` both cells at max (h240 heal +
  h260 tie-kept).
- **Golden gate: `PLAN-DIFF compared=25 changed=0 — IDENTICAL`,** scorer pinned on all 25. The refactor
  is invisible on the golden corpus; exact-match needs no re-record.
- CPU (clean same-session jobs=3 A/B, full 25): landed 738.9 s → finishLine **816.0 s (+10.4 %)**,
  wall 280.4 → 296.5 s (+5.7 %). Cumulative with §5.16's +16.5 %, the engine now runs ≈ **+18 % vs
  the pre-§5.12 baseline** — the two correctness landings have fully consumed the phase's CPU win,
  and §4's reclaim catalogue (admissibility triple §4.16, `admit` patch §4.21, and the arm-dedup
  ideas this refactor enables) is now genuinely loaded.

**⚠ The one residual, named and bounded — and structurally DIFFERENT from the three it closes:**
`isc-mqg-xl @h20` reads 346.228 = round 5, −0.005 eff (−0.0014 %) vs round 6's 346.233. Both engines
carry the SAME line into the tail here; the divergence is inside the Cold-Snap comparison, whose
chain-candidate family derives from the **recursive no-CS sub-solve** (`chains` are built from
`bestN.s.icyVeins`), and THAT solve differs between engines (round 6's ran with the evicted-random
seed pool). This is not a selection defect of the current engine — it is a difference between two
engines' sub-solves feeding a candidate generator. Chasing bit-dominance over every historical
engine's recursive internals relocates the coin flip one level deeper each time (seed → snap → hop →
tail → sub-solve chains) at vanishing stakes; the chase stops here. The cell is the **named
`--observe` trade for the round-7 diff** (≥ round 5, sub-band vs round 6, spec re-simmed honestly in
the round-7 ledger), and any future work on it starts from the chain-offer union idea (offer the
chain family from BOTH the champ's own IV row and `bestN`'s), not from another selection rule.

### §5.18 Notes gathered while running the §22 boundary-charge instrument (07-26, measure-only)

Not landed — recorded per the phase's measure-first rule. Three came out of PHASE8 §22's tooling and
one out of the §21.5 erratum; all are CPU/redundancy items, none changes a plan.

1. **`boardDmg` materializes a 180-element array to compute one scalar.** Both §21.5's and §22's
   instruments do `simulate(s, cfg, true).casts.reduce((a,c) => a + c.dmg, 0)` — the `collect` path
   allocates a per-cast record (14 fields) purely so the caller can sum one of them. The board loop
   already has `dmg` in hand at `index.html:899`. A `cfg.wantBoardSum` accumulator (sum inline, skip
   the array) removes an allocation proportional to cast count from every scoring call that wants
   the discrete total. **Only worth it if a board sum ever enters the engine** — today it is
   tools-only, so this is a note, not a task.
2. **★ If a per-window charge is ever implemented, it needs NO extra pass.** The board loop already
   walks every cast in start order and every window's `scoreStart`/`dur` is known before it runs, so
   the charge can be accumulated inline — the naive shape (a second walk per window, i.e.
   `O(casts × windows)`) is avoidable by construction. Worth writing down now because §22 leaves the
   charge un-implemented: whoever revisits it should not pay a second walk for it. (§22 itself
   measures the charge by *toggling* — `2 × windows` full `simulate()` calls — which is fine for an
   instrument and would be absurd in the scorer.)
3. **The kill taper is computed even when it provably cannot bite.** `robust` differs from `total`
   only via the `[T−KW, T+KW]` reweight, `KW = 0.5` (`index.html:764`); at the §21.5/§22 config the
   two come back **bit-identical** (the erratum's finding). The integral still evaluates
   `Math.min(1, Math.max(0, (cfg.T + KW − mid) / (2*KW)))` per breakpoint span regardless. A
   precomputed "does any breakpoint fall in the taper band" flag would skip the clamp arithmetic on
   the majority of spans. Micro — measure before touching; listed for the §4 catalogue.
4. **Cleanliness is a cheap invariant worth keeping.** §22's instrument asserts that a window's
   class (value vs haste) matches whether toggling it leaves the cast lattice bit-identical, and
   exits non-zero otherwise. That assertion is ~3 lines and would catch a whole class of future
   engine change (an SP buff that starts moving cast times) that no golden would flag, because the
   goldens only see the final plan. Pattern to copy into other instruments: **assert the property
   your measurement DEPENDS on, not just the measurement.**

### §5.19 ★★ The `cfgSigOf` memo trap — a scoring cfg field that isn't in the signature is a SILENT no-op (07-26)

Found while implementing PHASE8 §25's boundary charge. `simulate()` memoizes on
`cfgSigOf(cfg) + "|" + sigOf(schedule)`, and `cfgSigOf` enumerates scoring inputs **by hand**:
`T, hasteRating, sp, critPct, coldSnap, t5two, enabled, fixed, segments`. A new field
(`boundaryCharge`) that changes the score but is **not** in that list makes the `ON` call hit the
`OFF` cache entry and return it.

**The first gate run therefore read ON and OFF as bit-identical at all 7 fight lengths** — a perfect
null result, no error, no warning. The charge was not zero; it was never computed. That is the most
believable kind of wrong answer, and it is the same family as the round-4 collector that passed on
zero data and §21.5's vacuous F3: **an instrument whose failure mode looks like a clean measurement.**

- Fixed by adding the field, with the rule written at the function: *every cfg field that can change
  a score must appear in the signature.*
- ★★ **AND IT BIT A SECOND TIME, IN THE SAME SESSION.** The first fix stored
  `cfg.boundaryCharge ? 1 : 0` — which collapses `"value"`, `"haste"` and `true` onto one key, so a
  three-variant comparison returned **three identical columns** (PHASE8 §25.4). ⇒ the rule is not
  "remember to add your field", it is **"the signature must preserve the field's DISTINCTIONS"** —
  a boolean cast of a multi-valued field is itself a collision, and it fails exactly as silently as
  omitting the field. Store the value (`cfg.boundaryCharge || 0`), not a truthiness flag.
- ⚠ **The trap is structural, not a one-off.** The list is hand-maintained and nothing checks it
  against the fields `simulateRaw` actually reads. A cheap guard for the §4 catalogue: in a debug
  build, `Proxy`-wrap `cfg` inside `simulateRaw`, collect the keys actually read, and assert they
  are a subset of the signature's key list. That converts a silent staleness bug into a loud one.
- **Performance note (why the memo exists at all, so nobody "fixes" this by removing it):** the
  identity fast path (`simMemoCfg === cfg`) means the signature is rebuilt only when the cfg object
  changes, which in a normal run is once. The cost of the extra field is one array slot. There is no
  CPU argument for keeping the signature narrow — only the correctness argument for keeping it wide.

### §5.20 The §25 charge path double-scans (recorded at write time, costs nothing today)

`simulateRaw`'s integral loop calls `rateAt(mid, segB)`, which calls `scanAt(mid, segB)` internally;
the PHASE8 §25 charge block then calls `scanAt(mid, segB)` **again** for the same `mid` to read
`sp2`/`dmgMult2`/`multDn2`. Two identical state scans per breakpoint span.

- **Zero cost in production**: the block is inside `if (bcOn)` and `boundaryCharge` ships OFF and
  unreferenced (PHASE8 §26.3), so the second scan never runs.
- **But it is the exact shape §4 exists to remove** — the same walk done twice because two callers
  each wanted a different field of one result. The fix is `rateAt` returning (or accepting) the
  scan it already computed, so the span is scanned once and both consumers read the same object.
- Filed rather than fixed because fixing it now would touch the hot loop to speed up a path that is
  disabled — the wrong trade under this phase's own measure-first rule. **Do it as part of enabling
  the charge, if that ever happens; do not do it before.**

### §5.21 ★ LANDED — §4.13's `JSON.stringify` memo key: **−14 % CPU**, plans byte-identical (07-26)

The first item off the §4 reclaim ladder, and the first repayment of the ≈+18 % CPU that §5.16
(`groupSeeds`) and §5.17 (`finishLine`) spent on correctness.

**Change:** two sites, both memos, `sigOf` → `JSON.stringify`:
- `simulate()`'s memo key — `cfgSigOf(cfg) + "|" + JSON.stringify(schedule)`
- `basinHop`'s candidate cache — `const sg = JSON.stringify(rep)`

**⚠ NOT swapped: the `seen` dedup at the candidate-build site** (`repair(s,cfg)` → `seen.has(sg)`).
§4.13 named only the two memo sites and the distinction is load-bearing: at a **memo**, a key-order
divergence causes a MISS ⇒ recompute ⇒ same value (slower, never wrong). At the **dedup**, a miss
admits a duplicate candidate instead of skipping it — the candidate array changes and **the plan can
change**. Same function, same call shape, opposite safety. `sigOf` stays defined and still serves
that site, `:1515`'s `reps.map(sigOf)`, and the two UI comparisons.

**Measured** (`plan-sweep`, 16 cases, jobs=3, two samples each):

| build | CPU | |
|---|---|---|
| baseline | 78 s, 72 s | mean 75 s |
| `JSON.stringify` | 66 s, 63 s | **mean 64.5 s — −14 %** |

**Gates:** `PLAN-DIFF IDENTICAL`, `SCORE-AUDIT scorerMoved=0 movedCells=0`; exact-match **25/25**
(suite wall 247 s vs ~390 s on the same box earlier this session — the win shows up there too).

**Next on the ladder:** §4.13.1's (0a) `admit` helper extraction (byte-identical by construction,
worth landing on legibility alone, and it collapses item 5's "every call site must be converted"
to one), then (0b) the `counts(base)`/`clipOf(base)` hoists.

### §5.22 LANDED — §4.13.1 item 0a: the `admit` helper, **5 sites** (not 7, not 9) (07-26)

Class A only: the 5 loops whose prefix is *verbatim* `repair` → `sameCounts` → `clipOf`, all four
lines identical but for the base variable (`s`, `s`, `base`, `sx`, `sx`). Three lines → two at each.
Byte-identical by construction; `PLAN-DIFF IDENTICAL`, exact-match **25/25**.

★ **The site count has now been corrected TWICE, in the same direction each time.** §4.16 said 9;
§4.21 read them and said 7 (two omit the clip guard deliberately); reading them again against
today's file says **5** convertible, because the file drifted after §4.21 was written and there are
now **three** non-convertible sites, not two:

| site | shape | verdict |
|---|---|---|
| ×5 | `repair` → `sameCounts` → `clipOf`, verbatim | ✅ converted |
| ×2 | `sameCounts` → `some(x => …)` → `simulate` → combined guard | ✗ §4.21 Class C — converting hoists `clipOf` ahead of `simulate`; sign unknown both ways |
| ×1 | `sameCounts` → `simulate(rep,cfg).robust >= r0 - 0.5` | ✗ different rule entirely |
| ×1 | `JSON.stringify` guard first, then the prefix | ⏸ §4.21 Class B — a reorder, deferred |
| ×1 | `sameCounts \|\| clipOf` inline, then `break` | ⏸ §4.21 Class B — deferred |

**The standing lesson, now three-for-three: the grep finds the SHAPE, only reading finds the RULE** —
and every recount has moved the number *down*. A "pure text motion" patch sized from a grep would
have shipped a behaviour change at three sites under a no-op label. Classify by reading each site's
actual following lines, never by the line numbers in a doc — they drift.

**✅ Class B LANDED too (same day).** Both sites converted, `PLAN-DIFF IDENTICAL`, exact-match
**25/25** — so §4.21's "unobservable reorder" argument holds empirically, not just on paper:
- the `JSON.stringify`-guard site → `if (!rep || JSON.stringify(rep) === JSON.stringify(sx)) continue;`
  (the stringify check moves *after* counts/clip; all three are pure predicates whose only effect is
  `continue`, nothing between them mutates, and `repair` is still the first call in both spellings);
- the `break` site → `const rep = admit(shift(d), sx);` … `if (!rep) break;`, with the
  *"Feasibility is monotone in d …"* comment kept verbatim at its original position — it justifies
  `break` over `continue` and would be nonsense anywhere else. **7 of 10 sites now use the helper.**

**Remaining on this rung:** §4.21 Class C — 1 site, and deliberately NOT folded in: converting it
hoists `clipOf` ahead of `simulate`, which *saves* a `simulate` on every clip-failing candidate but
*costs* a `clipOf` on every candidate the current `||` short-circuits away. Which dominates is a
rejection-rate question, so it lands as its own step with its own wall-time delta, and is **reverted
on a null result** rather than kept for tidiness — keeping it would make that site's guard order
disagree with the other seven for no measured gain. Then (0b) the `counts`/`clipOf` hoists, then the
§4.1 five-walk fusion — for which item 0a has collapsed "every call site must be converted" to **one**.
