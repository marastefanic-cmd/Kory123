# Exact-match regression suite

The planner is **deterministic**: the optimizer seeds from a fixed PRNG, the
cast-rate integral scores damage without cast-boundary jitter, and leftover haste
snaps to the earliest efficient spot. So one setup produces **exactly one**
schedule — which means regressions can be caught as exact diffs, not "within
tolerance" (a tolerance test silently passes when a placement drifts to an
equally-good alternate spot; an exact test tells you the layout moved).

## Run it

```
cd tests
npm install                 # playwright-core
CHROMIUM=/path/to/chromium node exact-match.mjs
```

`CHROMIUM` should point at a Chromium/Chrome binary (the harness defaults to
`/opt/pw-browsers/chromium`). The runner loads the real `../index.html` in a
headless page, reads the fight table straight from the page
(`window.GOLDEN_PRESETS` — **the same "Debugging presets" the tool shows**), runs
every one through the actual optimizer, and compares the resulting plan to
`golden.json`.

- **All green** → no placement changed.
- **A FAIL** prints a `- expected / + got` diff for that case.

## When a case legitimately changes

After an **intentional** model change, regenerate the baseline and eyeball the
diff before committing it:

```
node exact-match.mjs --update
git diff golden.json          # read every changed line — is each move correct?
```

The golden is the frozen, sim-validated layout; `--update` should be a deliberate
act, not a reflex.

## Cases — single source of truth

There is **no** `cases.json`. The case list lives in `../index.html` as
`GOLDEN_PRESETS` (with `GOLDEN_DEFAULTS` for the shared gear/kit), which is the
*same* list the tool renders as its **Debugging presets** strip. So "what you
click in the tool" and "what this suite locks" are literally one array — a preset
you confirm in the UI **is** the test. To add or change a case, edit
`GOLDEN_PRESETS` in `index.html`.

Each entry is `{ name, T, pins }`, optionally with `gear`/`kit` overrides, an
`intermission: [from, to]`, or a full `phases: [{type,from,to,targets}]` list (e.g.
the real `KaelThas 7:00` fight — early intermissions, a 6-target AoE window, a
post-Lust intermission). `pins` are the fixed raid-call times in seconds (Bloodlust
/ Drums / PI). A preset carries only the **input setup** — clicking it loads those
inputs and the tool computes the plan live; the golden is just the frozen output
that live result must reproduce.

## Ad-hoc probes (not tests)

Two throwaway scopes drive the optimizer on *arbitrary* configs (not just the
locked presets), for eyeballing a plan before deciding to lock it:

```
node plan.mjs  '[{"name":"…","T":135,"pins":{"bloodlust":[25]}}]'   # canonical copy-as-text plan
node probe.mjs '[{"name":"…","T":135,"pins":{"bloodlust":[25]}}]'   # raw per-key press-time arrays + robust/total
```

Same case shape as `GOLDEN_PRESETS`. Use `plan.mjs` to check a plan reproduces
before adding a preset; `probe.mjs` to read the raw schedule when building a
wowsims APL to sim-verify a change.

For the sim side, `evalsched.mjs` prints the **model** score (`simulate().robust`)
of explicit schedules, and `simsweep.sh` runs a batch of named APL specs through
the wowsims runner and prints a DPS table:

```
RUNNER=/path/to/runner GEAR=/path/to/gear.json ./simsweep.sh <dur> <var> <iter> <seed> specs.tsv
```

The runner binary + gear export live in the ephemeral session scratchpad (see
`docs/TOOLING.md`), so both are passed via env vars — nothing session-specific is
committed. Each spec line is `NAME<TAB>{genapl-json}`; remember the collision
offsets (TOOLING) so bundled off-GCD presses don't share a tick.

## Stat weights (EP) — two contexts

- **Layout EP (infinite mana)** — `ep-model.mjs "<preset>"` (closed-form partials of
  the effective-damage integral, on the page) and `ep-sim.sh '<genapl-spec>'` (wowsims
  finite-diff on the optimal AB-spam schedule); `portfolio-ep.mjs` aggregates over a
  fight set. See `docs/EP.md`.
- **Gearing EP (finite mana)** — the **real** weights, on a mana-managed conserve
  rotation (`../tools/genconserve.mjs`):
  ```
  node ep-finite.mjs --dur 300 --iter 45000 --seed 11 --inf   # finite vs infinite ceiling
  node ep-finite.mjs --dur 300 --iter 18000 --seed 11 --native # x-check: export's own rotation
  node mana-value.mjs --dur 300                                 # analytic value-of-mana (option C)
  ```
  Needs `RUNNER`/`GEAR`/`MYSP` env + the runner rebuilt with `--int/--spirit/--mp5`
  (`../tools/wowsims-patches/runner-main.go`). Locked numbers: `finite-weights.json`.
  Result: **SP ≈ Int > Haste > Crit > MP5 > Spirit ≫ Mana** (`docs/EP.md`, RULES §12).

The canonical each case is compared on is the **Copy-as-text plan** — the setup
header plus the windows with per-press times and Cold Snap markers — minus the
cosmetic peak-haste line and price tags (those are annotations, not placements).

## Pair it with a DPS check

Exact-match catches *"the layout moved"*. It does **not** tell you whether the new
layout is better or worse — an equally-good alternate would still fail the exact
test, and a genuinely-worse layout would too. When a case changes, confirm the
new plan's **simulated DPS** (against `wowsims/tbc-new`, fixed kill, common random
numbers, ≥120k iters) is `>=` the old plan's before accepting the `--update`.
Together: exact-match says *what* moved, the sim says whether it *mattered*.
