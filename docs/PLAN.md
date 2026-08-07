# PLAN.md — the plan in flight (created 2026-08-05; the ATI goal landed the same night)

> **Read `CLAUDE.md` first, then this.** This file exists only while a multi-step change is in flight;
> delete it when the change lands, folding anything lasting into `docs/ROADMAP.md`.

## ✅ THE OVERNIGHT GOAL IS CLOSED — MODEL-DEFECTS §10c

The Ashtongue transient's one-directional bias was **two** closed-form defects, and both are fixed.
Per-engagement, engine − truth: **+0.080 → +0.007** (worst of 14 exact-chain cells +0.090 → +0.028),
with the steady rates untouched and `plan-diff` IDENTICAL over the 21-cell corpus.

- **Algebra:** `docs/ESTABLISHED-FACTS.md` **§12.3a**.
- **Record, including what is still open:** `docs/MODEL-DEFECTS.md` **§10c**.
- **Where it lives in the code:** `atiCRho` + `atiSlice(p, len, nuRate)` + the integral loop's ATI
  branch in `index.html`.

Three things from that night are worth carrying forward even if you never touch the proc model again:

1. **Build the chain, not more MC.** The proc process is a finite Markov chain over `(t, rem)` on the
   millisecond lattice, so `E[casts by T]` propagates exactly with no sampling error. That is what
   showed the residual **constant in T**, **deposited by t ≈ 11 s**, and **absent from the board
   walk** — none of which 200 000 MC runs could resolve. Same upgrade brute-forcing a cell was over a
   sim duel.
2. **Re-derive the integrand independently before changing it.** `scratchpad/ati-ref.mjs` reproduced
   the shipped engine to 1e-13, and every candidate was switched on and off *there* and sized against
   the chain before a line of `index.html` moved. Two of the four candidates over-corrected; they did
   not ship.
3. **A state variable is not a score.** ν was being netted against the opener toll because "toll casts
   never happened, so they rolled no procs" — a true sentence that justified the wrong arithmetic,
   because the toll is *spread* over an m-independent window for scoring reasons and the real cast
   deficit is front-loaded.

## ⛔ STILL READ THIS BEFORE TOUCHING THE ASHTONGUE MODEL

**MODEL-DEFECTS §10a was filed and RETRACTED on 08-05, by me, within two hours.** I claimed
`n = ceil(DUR/a)` was a quantisation artifact, built a "smoothed" phase-averaged variant, measured a
0.128-cast swing, and on that basis rewrote a correct rule and withheld a candidate from the user.
`tools/ati-mc.mjs` — sitting in CI the whole time — fails the smoothed build at 4 of 9 points including
steady rates the shipped model matches to five decimals.

`ceil` is **exact**: the window is anchored AT a cast on a regular lattice, so attempt `k` is inside it
iff `k·a < DUR` and the count is deterministic. There is no phase to average over. (A phase-average IS
right for the edge memory, §9m, where the wall is placed independently of the casts — same formula,
adjacent problem, opposite answer.)

⇒ **Do not re-open that.** ⚠ `scratchpad/` is a session directory and does not survive a container
reclaim; the WRONG `smooth.html` build is gone with it, and so are the §10c probes. The probes are
reproducible from §12.3a's algebra in an hour; the wrong build should not be.

## ✅ 08-06 — THE DECLARATION BATCH LANDED (see ROADMAP §1c)

T18–T26 declared under the user's ruling; the suite is 26 tests. Still pending from that programme:
- **2:20 lust 0:05 / 0:20** — re-certification at `--top=128` with `--check` pinned to the emission
  (the search beat the step-10/top-16 enumeration; T=140 step 5 is 1.19e9 layouts, past the guard).
- **3:00 lust 0:40** — enumerating.
- **The `gem+ati` cell** — blocked on §10d (search miss, −0.010) and on the §10c residuals being the
  same order as ATI plateau margins. Fix the search reach first; do not declare ATI cells until the
  scorer's residuals are below the margins being locked.

## ▶▶ WHAT IS STILL QUEUED

- **A user-found search miss.** On `2:00 · Lust 0:20 · gem+ati` the tool emits `cluster@0:25`; the
  enumeration says `cluster@0:45`, worth **+0.0095 casts** (4.75× the tie band). The scorer already
  prefers the better layout, so this is a search defect with a known target — the §8j/§9y family. Fix
  it in the move classes, never in `simulate()`.
  ⚠ **Re-measure the margin first.** That number was taken on the pre-§10c engine, and §10c moves
  every ATI-bearing score (RULES §19's ridge kept its shape but lost about a third of its magnitude).
- **`tools/brute-vs-search.mjs`** over the accumulating cells. It separates SCORE misses from
  CANONICALISATION misses and has found two real defects already. Run it as cells land.
- **The two named ATI residuals** (§10c's closing section) — ramp window shrinkage ~+0.009, strata
  drain at a haste edge ≤ ~+0.018. Not open work; a starting point if a gate ever demands it.
  ★ They are probably ONE mechanism, and it is the same left-Riemann family §10c's Finding 1 closed,
  in the drain direction: a stratum's survivor count `fit = min(cnt, budget/a_s)` is a continuum smear
  of `⌈(DUR − consumed)/a_s⌉`. The two agree when every spacing is `a` and part company exactly where
  they differ — a haste edge, and a ramp, which is where both residuals live. ⚠ The correction is not
  `c_ρ` (the drain is a cap, not a geometric decay), and nothing has been measured; that is why it is
  a lead and not a plan.

## Background work that survives a context clear

★ **The cells that already exist are COMMITTED at `tools/cells/`** — `derive-0805.jsonl` (12 cells),
plus the two scripts that produced them and a README. They are in the repo rather than the scratchpad
because some are 200M-layout half-hour sweeps and a container reclaim would otherwise cost a night.
Re-inject with `node tools/candidates-inject.mjs tools/cells/derive-0805.jsonl`.

⛔⛔ **AND EVERY ATI-BEARING CELL IN THERE IS NOW STALE — §10c CHANGED THE ENGINE THAT GRADED THEM.**
A cell is only valid for the engine that cut it (the README says so, and `docs/DECISION-PACKAGES.md`
carries the same banner). Re-cut the ATI cells before the user rules on any of them; the non-ATI cells
are unaffected, and that is not an assumption — `plan-diff` reads IDENTICAL with `scorerMoved = 0`
across the 21-cell preset corpus, which is every declared test.

⚠ `lattice-brute` imports the comparator at run time and **skips cells already present in its `--out`
file**, so after any engine change point it at a NEW file rather than appending.

## The standing constraint on all of it

The user rules; the tool never declares its own tests. A candidate is a line plus its tie plateau plus
whether the search reproduces it — the ruling is theirs. Where the search does NOT reproduce an
enumerated line, that is a defect to fix, not a question to ask.
