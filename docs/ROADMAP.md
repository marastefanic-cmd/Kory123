# ROADMAP.md — the live plan

**As of 2026-08-04 the slate is clean: every previously-open item is DONE or REVOKED with its
reasoning recorded.** The road that got here is `docs/archive/19-roadmap-record-through-0804.md`
(this file's full predecessor, append-only) and `docs/DIARY.md`. What remains open is exactly two
kinds of thing: **rulings only the user can make** (§2) and **standing registers** (§3–§5) that
describe accepted limits and decided questions so nobody re-opens them by accident.

## §1 Where the tool stands

- **Scorer:** exact (the integral-plus-tie-break pair), CLOSED by user ruling, and gated eight ways
  with negative controls — `anchors` (17/17), `law-check`, `constants-cited`, `self-consistency`
  (+structural), `toll-audit --strict`, `objective-ref`, `ati-mc`, `cfg-contract --strict`.
- **Search:** every known miss is closed — `search-audit --k=3` reads **72/72** on the kit × haste
  matrix, all three recorded witnesses are reached, and the 08-04 ladder run found the emitted plan
  on the best-known answer in 11 of 12 fresh cells (the 12th is in the decision package, +0.0025).
  A pass is LOCAL optimality; the search is a bounded heuristic **by doctrine** (*"the scoring part
  has to be perfectible, the search part does not"*), and the gate set is what surfaces the day that
  stops being good enough.
- **CI:** three blocking jobs — the tests + closed forms, the search audit, and `plan-stability`
  (A/B vs merge-base) — plus `pool-equiv` (the page's pooled path == the tested sequential path).
  Every job carries a negative control.
- **Product:** deployed on Netlify from `master`, `index.html` alone; URL-shareable setups +
  last-setup autosave shipped 08-04. Overlapping phase rows resolve order-independently and warn.

## §2 ▶▶ AWAITING YOUR RULINGS — `docs/DECISION-PACKAGES.md`

The two test-derivation programmes you asked for by name (07-31) are **executed**; what they cannot
do is declare their own tests — that is the line that killed `exact-match`. The package doc holds:

- **A. The length ladder** — 12 cells (2:20–3:20 × Lust 0:05/0:20/0:40, default gear), each with a
  candidate layout, its tie plateau (the §8y precedent requires you to have seen it), and its
  certification (beats the complete anchor-and-chain family; audit-fixed-point). Ruling a cell
  declares it as a new anchor (the strip and `tests/anchors.mjs` move in lockstep, as always).
  ⚠ Also queued for a ruling there: no declared layout anywhere runs with **Ashtongue enabled**.
- **B. The 12:20 alignment study** — spam-on-cooldown vs hold-for-alignment vs gem-on-the-Lusts,
  scored exactly at three Lust timings, plus the tool's own (much better) free answer. The study's
  verdict and its honest limits are in the package.

## §3 The ACCEPTED-LIMITS register (each entry documented at its source; none is open work)

- **Infinite mana** (standing user decision) — and its newly-filed cost: long-fight haste-window
  *margins* are overstated (orderings are right, 28/29); unmeasurable post-sim. MODEL-DEFECTS §9n
  addendum.
- **Mean, not variance** — the tool reports an expectation (MECHANICS §0's honest cost).
- **AoE weighting and mana are unmeasured** since the sim retirement — the one real loss, accepted.
- **The T8 kill-flush mispricing family** (§9i/§9j/§9m) — ~0.13 casts on one geometry; every fix
  architecture measured-refuted; `t8-cell` stays pinned red as the documented blind spot.
- **The flush clamp** (RULES §9 C3) — ~0.04 casts worst case, kept out of emitted plans by the
  earliest tie-break.
- **§9e** (inner passes climb `robust`) — a recorded contingency, fully masked by the gates; a gate
  going red for it is the trigger, §9e-b's measurements are the map.
- **§8n** — permanently unfalsifiable (§8x); never reopen expecting resolution.
- **Above-h=0 ground truth is thin by design** — declared only on the 2:00 ladder (T12–T17,
  SP-pinned); everywhere else "not beaten locally" is the strongest claim made.

## §4 Decisions taken 08-04 under the clean-the-slate delegation (any one is reversible by a sentence)

- **Module split of `index.html`: REVOKED (allowed, not planned).** The copies-drift disease it
  targeted is now *gated* instead — `engine-node.mjs` is the one extraction point, `cfg-contract
  --strict` blocks CI, `pool-equiv` imports the engine's own `polish` — and the deploy model
  (single file, no build) is the product. The single-file *convention* stays retired: split the day
  a real need appears, under the byte-identical gate archived in PHASE11 §2.
- **Perf ladder + typed-array interior: REVOKED until a real slowness report.** No current latency
  complaint; the recorded prices are stale twice over (Phase 12 rewrote the walk; 08-04 removed
  ~20 % dead work). The rungs live in archive (PHASE9 §4, PHASE13 §5.3–§5.4) with the standing rule:
  fresh baseline first, wall-clock compares only within a same-session pair.
- **Product routes:** URL-share + autosave ✅ SHIPPED. Offline service-worker (single cached file
  already; niche), mobile/input pass (unscoped; on demand), static APL export (exports to the
  instrument this project retired), research mode (the §9 fence: enumeration is research, don't
  ship it), precomputed preset plans (a second definition of truth needing a freshness gate;
  solves are seconds in a worker): **all REVOKED**.
- **The seven PHASE11/13 user calls: resolved to the status quo.** No-build stays; `file://`
  double-click stays (the call dissolves with the split revoked); every render stays solver-fresh;
  no setup-comparison view and no EP route (both standing rulings, simply no longer carried as open
  questions — the absolute-damage currency note survives in CLAUDE.md for whoever ever builds one);
  research mode not shipped; COOP/COEP not adopted (instant cancellation already comes from worker
  termination). The wasm call was void.
- **The constructive-enumeration BUILD: REVOKED.** Its purpose is served by instruments that exist —
  `tools/brute-cell.mjs` (now graded on the objective pair, plateau-reporting, gear-parameterized)
  plus `search-audit`/`plan-stability` as the regression net — and the ladder programme ran to
  completion on exactly those. A general pruned enumerator would be built for cells too big to scan,
  and the one such request (12:20) was answered by strategy-family enumeration instead.
- **PoM is a RULE, not a track** (RULES §18); **the low-N AoE cut stands** (a declared `aoe` phase
  MEANS "I switch at this wall"); **§8r resolves to statement 1** (the declared layouts embody it);
  **§8v resolves to the emitted member** (bit-exact tie; the comparator's own order prefers it).

## §5 Standing traps (carried from PHASE13 §8 — the working method)

"Pure addition" isn't — argue the floor for anything that adds candidates, workers, or caches ·
golden-corpus green ≠ off-corpus safe · a second definition of anything needs a freshness gate in
the same commit · every new CI job needs a negative control before its green is believed · cache
keys must cover the engine hash + the FULL cfg signature · never derive the wowsims URL from the Go
module path · wall-clock numbers compare only within a same-session pair · and the one earned four
times over: **an instrument that flatters or blinds itself — read a tool's OUTPUT, not its verdict
line, and give every instrument a control that must fail.**

## §6 Doc map

`CLAUDE.md` (orientation) · `MECHANICS.md` (the physics; §0 is the canonical scorer statement) ·
`RULES.md` (theorycraft, incl. §18 PoM) · `ESTABLISHED-FACTS.md` + `law-check` (ground truth) ·
`MODEL-DEFECTS.md` (the defect ledger — everything ✅/⚖️; §3 above indexes the accepted limits) ·
`ARCHITECTURE.md` (internals) · `EP.md` (stat weights) · `SOURCES.md` (provenance) ·
`DEPLOYMENT.md` (shipping) · `DECISION-PACKAGES.md` (§2's rulings) · `DIARY.md` (append-only
history) · `docs/archive/` 00–19 (the road, indexed by its README).
