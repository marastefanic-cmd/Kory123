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

Each entry is `{ name, T, pins }`, optionally with `gear`/`kit` overrides (e.g. the
`@150 haste rating` case), an `intermission: [from, to]`, or a full
`phases: [{type,from,to}]` list. `pins` are the fixed raid-call times in seconds
(Bloodlust / Drums / PI). A preset carries only the **input setup** — clicking it
loads those inputs and the tool computes the plan live; the golden is just the
frozen output that live result must reproduce.

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
