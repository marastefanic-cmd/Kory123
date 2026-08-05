# PLAN.md — the plan in flight (created 2026-08-05, for the overnight run)

> **Read `CLAUDE.md` first, then this.** This file exists only while a multi-step change is in flight;
> delete it when the change lands, folding anything lasting into `docs/ROADMAP.md`.

## Where things stand at the handoff

- **`tests/anchors.mjs` reads 17/17.** Three reds closed on 08-05, each a different kind of defect:
  `plateauCanon` (§9u), the plan-dependent ramp anchor (§9w), `valueSecs` (§9x). A fourth fix, the
  suffix slide (§9y), closed a pre-existing kit-matrix miss.
- **Every gate is green**: `law-check`, `self-consistency` (0.00e+0, 0 structural), `constants-cited`,
  `cfg-contract --strict`, `ati-mc`, `pool-equiv`, `search-audit --k=3` (21/21 presets, 72/72 kits),
  `plan-diff` IDENTICAL over the 21-cell corpus.
- **The declared-tests strip is hidden from the UI** (user decision, §10b). `GOLDEN_PRESETS` stays as
  DATA — every stability gate sweeps it. A brute-forced cell landing on an already-declared fight is
  marked *"supersedes Tn"* in the candidates strip.
- **The candidates strip is live** and carries brute-forced lines for the user to rule on.
- Branch `claude/nuggets-after-ashtongue`, everything committed and pushed. Nothing is merged to
  `master` yet — merging IS shipping (Netlify auto-deploys), so that is the user's call.

## ⛔ READ THIS BEFORE TOUCHING THE ASHTONGUE MODEL

**MODEL-DEFECTS §10a was filed and RETRACTED on 08-05, by me, within two hours.** I claimed
`n = ceil(DUR/a)` was a quantisation artifact, built a "smoothed" phase-averaged variant, measured a
0.128-cast swing, and on that basis rewrote a correct rule and withheld a candidate from the user.
`tools/ati-mc.mjs` — sitting in CI the whole time — fails the smoothed build at 4 of 9 points including
steady rates the shipped model matches to five decimals.

`ceil` is **exact**: the window is anchored AT a cast on a regular lattice, so attempt `k` is inside it
iff `k·a < DUR` and the count is deterministic. There is no phase to average over. (A phase-average IS
right for the edge memory, §9m, where the wall is placed independently of the casts — same formula,
adjacent problem, opposite answer.)

⇒ **Do not re-open that. The scratch build is `scratchpad/smooth.html` and it is WRONG.**

## THE GOAL: the ATI transient carries a small one-directional bias

This is what survived the retraction, and it is properly founded — it comes from the project's own
external check rather than from reasoning about the code.

`node tools/ati-mc.mjs` on the shipped engine (the numbers to beat):

```
STEADY   (exact — leave it alone)
  h=0 crit=25          0.69304   mc 0.69302
  h=0 crit=50.765      0.70921   mc 0.70923
  h=300 crit=40        0.83554   mc 0.83556
  h=900 crit=40        1.00000   mc 1.00000

FULL FIGHT                                        engine − mc
  T=120 h=0 crit=50.765   83.64633  mc  83.56559   +0.081
  T=180 h=0 crit=25      123.32405  mc 123.27731   +0.047

WINDOWED (proc memory crossing haste edges)
  lust@30 T=120 crit=50.765  92.38623  mc  92.30680   +0.079
  lust@60 T=150 crit=38     112.53080  mc 112.45841   +0.072
```

**The steady state is exact and all four non-steady checks are biased the SAME direction.** A
one-directional residual is not noise. The steady form being exact localises it: the bias is in the
**transient** — `atiAdvance` / the strata / `atiFold`, the machinery that threads proc memory across a
haste edge and through the opening ramp.

### How to work it

1. **Reproduce and localise before changing anything.** Split the residual: is it the opening ramp
   (`nu` threading from a cold start) or the haste-edge crossings (strata drain)? The `lust@*` rows
   have both; a no-Lust fight has only the ramp. Build the cheapest probe that separates them.
2. **Derive, do not tune.** Every term in this model is closed-form (ESTABLISHED-FACTS §12). If a
   correction cannot be written as algebra over `GAME`, it is not the fix.
3. **`ati-mc` is the acceptance test, and it must be run BEFORE the docs.** That is the §10a lesson:
   an internal re-measurement can only show two models differ, never which is right.
4. **Then the corpus**: anchors 17/17, `law-check`, `self-consistency`, `plan-sweep`+`plan-diff` for
   blast radius, `search-audit --k=3`, `pool-equiv`.
5. ⚠ If it moves plans, every ATI-bearing candidate must be re-cut and re-injected
   (`tools/candidates-inject.mjs`) before the user rules on any of them.
6. **If it does not land, revert and record.** Phase 9's precedent: a change measured null was reverted
   on a pre-registered rule, and the measurement kept. That is a good outcome, not a failed night.

### Also queued, smaller, both well-specified

- **A user-found search miss.** On `2:00 · Lust 0:20 · gem+ati` the tool emits `cluster@0:25`; the
  enumeration says `cluster@0:45`, worth **+0.0095 casts** (4.75× the tie band). The scorer already
  prefers the better layout, so this is a search defect with a known target — the §8j/§9y family. Fix it
  in the move classes, never in `simulate()`.
- **`tools/brute-vs-search.mjs`** over the accumulating cells in
  `scratchpad/derive4.jsonl`. It separates SCORE misses from CANONICALISATION misses and has found two
  real defects already. Run it as cells land.

## Background work that survives a context clear

★ **The cells that already exist are COMMITTED at `tools/cells/`** — `derive-0805.jsonl` (12 cells,
cut on the current engine), plus the two scripts that produced them and a README. They are in the repo
rather than the scratchpad because some are 200M-layout half-hour sweeps and a container reclaim would
otherwise cost a night. Re-inject with
`node tools/candidates-inject.mjs tools/cells/derive-0805.jsonl`.

Enumerations may still be running in the scratchpad and appending to its own `derive4.jsonl`:

- `nonati.sh` — icon+gem across 2:00–3:00 × Lust 0:05/0:20/0:40, plus the other legal trinket pairings.
- A `skull+gem` cell (217M layouts) is **SIGSTOPped**; resume with `kill -CONT` or just re-run it.
- `derive3.sh` holds the full programme (Phase-3 kits first, then breadth, then the big haste cells).

⚠ Everything in `derive4.jsonl` is graded by the engine AS IT WAS WHEN THE CELL RAN. `lattice-brute`
imports the comparator at run time and **skips cells already present in its `--out` file**, so after any
engine change point it at a NEW file rather than appending. `docs/DECISION-PACKAGES.md` carries the same
banner for the older packages, which are all stale for exactly this reason.

## The standing constraint on all of it

The user rules; the tool never declares its own tests. A candidate is a line plus its tie plateau plus
whether the search reproduces it — the ruling is theirs. Where the search does NOT reproduce an
enumerated line, that is a defect to fix, not a question to ask.
