# tools/cells — brute-forced ground truth, kept because it is expensive

Each line of a `*.jsonl` here is one cell of `tools/lattice-brute.mjs`: the fight, the argmax layout it
found, the size of the exact-tie plateau around it, and how many legal grid layouts were enumerated to
get there. Some cells are 200M+ layouts and half an hour of four cores, which is the whole reason these
are committed rather than left in a scratch directory — a container reclaim would otherwise cost a night.

They feed two things:
- `node tools/candidates-inject.mjs tools/cells/<file>.jsonl` — puts the lines in the page's Candidates
  strip for the user to rule on.
- `node tools/brute-vs-search.mjs tools/cells/<file>.jsonl` — asks whether the SEARCH reproduces each
  one, which is how two search defects were found on 08-05.

## ⛔ A CELL IS GRADED BY THE ENGINE AS IT WAS WHEN THE CELL RAN

`lattice-brute` imports the comparator at run time, so a cell swept before a tie-break change can name a
plateau member the current comparator would not — and it **skips cells already present in its `--out`
file**, so appending after an engine change silently preserves the stale grading. ⇒ **after any change
to the objective or the tie-break, point it at a NEW file.** `docs/DECISION-PACKAGES.md` carries the
same banner for the older packages, which are all stale for exactly this reason.

## What is here

- `derive-0805.jsonl` — cut on the 08-05 engine (after §9u/§9w/§9x/§9y, i.e. the current tie-break).
  Mostly `icon+gem` across 2:00–3:00 × Lust 0:05/0:20/0:40, plus one `gem+ati` cell.
  ⛔ **Its `gem+ati` cell is STALE as of §10c** (the Ashtongue transient corrections, same day, later)
  — ✅ and that re-cut is DONE: `derive-0806.jsonl` is the same cell on the §10c engine (the argmax
  moved structure, exactly as §10c's re-measure predicted — MODEL-DEFECTS §10d). The rest of the file
  is unaffected and that is measured, not assumed: `plan-diff` reads IDENTICAL with `scorerMoved = 0`
  over the 21-cell preset corpus, and §10c is gated entirely on `cfg.enabled.ati`.
  ⚠ Enumerated at EFFECTIVE stats (crit 44 = typed 38 + Arcane Impact, Tirisfal on) so that loading the
  row in the page reproduces it — see MODEL-DEFECTS §9z. (Every later file inherits this convention.)
- `declared-0806.jsonl` — the ARCHIVE behind the brute-declared batch T18–T29: the twelve
  2:00–3:00 × Lust grid cells exactly as enumerated/certified on the 08-06 engine (incl. the
  `--top=128 --check` re-certifications of the two 2:20 cells). Frozen with the declaration; a future
  engine change does not stale a declared test (anchors carries the lock), it stales *candidates*.
- `derive-0806.jsonl` — the §10c-engine re-cut of the `gem+ati` cell (see above). ⛔ **CHAIN-REFUSED
  08-07, like every ATI cell so far** (`tools/ati-chain.mjs` — MODEL-DEFECTS §10e): the integrand's
  edge-compounding artifact spans ±0.07 casts across this cell's layouts and flips the Berserking
  placement against §4c, so the emission is a truth-loser by 0.011 and **ATI cells are candidates,
  not tests**, until the §10e lead closes. The enumeration itself stays valid as a record of the
  ENGINE's argmax; what it cannot certify is correctness.
- `derive-0807.jsonl` — the remaining programme, cut 08-07 on the final engine (scorer unchanged
  since §10c; move classes 8–9 are search-only, so gradings survive them): the Phase-3 practical
  kits (skull+gem, ati+gem variants), the coverage kits, the 3:20 ladder, SP rungs, and the
  high-haste cells. Committed progressively while the programme runs — a container reclaim must not
  cost the night.
- `derive-programme.sh` — the full programme, Phase-3 practical kits first, then breadth, then the
  200M-layout haste cells. Resumable: re-running skips what is already in the `--out` file.
  ⚠ Its A7/A8 lines predate the 4e8 raw-regime guard — at T=180 run them `--step=10` (the 08-07 run
  did; T28/T29's certification precedent covers the coarser grid).
- `nonati.sh` — the cheap non-Ashtongue subset, which is what produced most of `derive-0805.jsonl`.
