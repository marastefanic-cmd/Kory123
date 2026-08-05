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
  ⚠ Enumerated at EFFECTIVE stats (crit 44 = typed 38 + Arcane Impact, Tirisfal on) so that loading the
  row in the page reproduces it — see MODEL-DEFECTS §9z.
- `derive-programme.sh` — the full programme, Phase-3 practical kits first, then breadth, then the
  200M-layout haste cells. Resumable: re-running skips what is already in the `--out` file.
- `nonati.sh` — the cheap non-Ashtongue subset, which is what produced most of `derive-0805.jsonl`.
