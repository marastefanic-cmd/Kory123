# PHASE 10 — re-establish the acceptance baseline on gear B, with the new instrument

**Status: PLANNED (2026-07-26). Not started — no gear-B table exists yet.**

## 0. The one-sentence charter

**Re-measure `docs/ACCEPTANCE.md` from scratch on gear B using `tools/bench.mjs`, and restate every
open debt in the new currency — because right now the project has no acceptance reading at all.**

## 1. Why this, and why before anything else

Three facts, and together they leave only one sensible next move.

1. **Every model-vs-sim number the project owns is on a baseline that no longer exists.** BENCH §1
   archived the whole gear-A corpus and cleared `tools/xval-results/`. ACCEPTANCE's "NOT PASSING (B)",
   its 135 borrowed-win columns, its 0.38 % worst case, PHASE8's B2 ≈ 0.445 pp, PHASE7's low-haste
   basin debt — all gear A, all un-denominated until re-measured.
2. **The target is known to have moved.** BENCH §3e measured B2's sim preference shifting **~0.39 pp
   and changing sign** on gear B. Any Phase-8 work started today would aim at a number that is not
   there. That is the strongest argument against "just finish Phase 8": you cannot finish a chase
   whose quarry has moved and not been re-sighted.
3. **It finally costs almost nothing.** The gear-A campaigns were expensive mostly in *ceremony* —
   clone wowsims, install protoc, `go build`, then hunt a private gear export out of a session
   scratchpad that may have been reclaimed. All of that is gone: `tools/bench.mjs` runs the committed
   `sim/sim.wasm` and produces a duel in ~10 s from the repo alone.

There is also a quieter reason. The gear-A rounds each carried a *different* protocol (emit=intent vs
fire, var 0 vs 0.5, changing seed policy), which is why comparing rounds needed its own instrument.
Round 1 on gear B is the first chance to gather a whole corpus under **one settled protocol**, stamped.

## 2. What is different this time — the instrument, stated once

| | gear-A rounds | Phase 10 |
|---|---|---|
| engine | native `runner` built per session | **committed `sim/sim.wasm`** (patched, `ade9f39cc`); asserted equal to the native runner to the printed decimal by `tests/sim-duel.mjs` |
| setup | clone + protoc + `go build` + find the export | **none** |
| driver | `tools/xval.mjs` + shell wrappers resolving `RUNNER`/`EXPORT_BASE` | **`tools/bench.mjs`** (also `--json` for collection) |
| character | a private export in a scratchpad | **`tools/bench/export.json`, committed and frozen** |
| model cfg | hand-written per tool — the PHASE8 §6/§7 defect | **forced to the simmed character** (`…REF` spread), structurally |
| `--var` | 0 on many gates, by convention | **0.5, by measurement** (`tools/var-decision.mjs`) |
| normalisation | raw DPS | **difference-in-differences** vs a never-press control (BENCH §2.1) |
| protocol constants | typed into each tool | **`sim/benchmark.mjs`**, imported everywhere, asserted by `tests/sim-request.mjs` |

★ The website's "Check in the benchmark sim" button runs this same chain. A Phase-10 finding and a
user's finding are therefore the same measurement, which has never been true before.

## 3. ⚠ The traps this phase must not walk into

- **★ The instrument is NEW and lightly exercised.** `bench.mjs` and the in-repo wasm have run a
  handful of duels and the gates — not a corpus. A systematic flaw would show up as *coherent
  weirdness across many cells*, not as noise. **Before grading anything, re-run 3–4 gear-A cells whose
  answers are known** and check the shapes are recognisable (not the values — the baseline changed).
  If they are not, the tool is on trial, not the model.
- **Never diff a gear-B cell against a gear-A cell.** BENCH §1. The archive README says the same.
- **A partial directory is not a result.** 36 tables or no verdict.
- **Stamp everything** — `emit=`, `var=`, `iter=`, seeds, tool version. The round-5/round-6 `emit=`
  confusion is the recorded case of what an unstamped table costs.
- **Do not let the model arbitrate its own change** (`plan-duel.mjs`'s circularity rule). If the
  scorer moves during the phase, the sim is the only arbiter for the cells it touched.
- **Watch the seed spacing.** Base seeds closer than `iterations` share iterations and the band
  collapses to ~0, which passes every delta. `tests/sim-request.mjs` asserts this for `BENCH.seeds`;
  any ad-hoc seed list needs the same check.

## 4. The loop

1. **Shakedown — start here, before any gathering.** Four cells, ~1 minute total:

   ```
   node tools/bench.mjs --preset "2:00 lust 0:05"  --vs naive --iter 4000
   node tools/bench.mjs --preset "5:00 lust 0:05"  --vs naive --iter 4000
   node tools/bench.mjs --preset "2:40 lust 0:07 intermission 1:30-2:10" --vs naive --iter 4000
   node tools/bench.mjs --preset "Kael'thas Sunstrider" --vs naive --iter 4000   # the AoE cell
   ```

   Gate — **all four must hold, and none of them is about the DPS values** (the baseline changed, so
   the values are *supposed* to be new):
   - the model plan beats mash-on-cooldown in every one, by a plausible margin (a few tenths to a few
     percent), and `MODEL` and `SIM` **agree in sign**;
   - the never-press control is identical across the two arms of a cell (same character, same fight) —
     if it is not, the control is picking up something it should not;
   - no NaN, no `errorResult`, and **no `skipped` entry beyond the known Drums / PI / Ashtongue set**
     — a silent omission here is the failure mode `planspec.mjs` exists to prevent;
   - the intermission and AoE cells transcribe (`_intermissions` / `_aoe` present in the emitted spec,
     targets > 1 on the AoE one).

   If any of that is off, **stop**: the phase becomes tool debugging (§3, first bullet), and the
   36-table campaign waits. Cross-check with `RUNNER=… node tests/sim-duel.mjs` and
   `RUNNER=… node tests/sim-request.mjs` before suspecting the model.
2. **Gather round 1** — the 36 tables, `tools/bench.mjs --json`, one protocol, all stamped, into
   `tools/xval-results/`.
3. **Verify invariants** — `xval-verify.mjs` + `xval-collect.mjs` must agree on every headline number,
   as they did on gear A.
4. **Restate the ledger from scratch.** BENCH §1 forbids diffing against round 7, so ACCEPTANCE gets a
   **new** status block: monoDip, the borrowed-win count and distribution, the diagonal deficit — as
   first measurements, not as deltas.
5. **Re-price the open debts** — B2, the low-haste basin, the KT/AoE cells — in gear-B numbers, and
   *close any that no longer reproduce*. A debt that does not survive re-measurement was a property of
   the old baseline.
6. **Decide the next phase from the new table**, not from the old one.

## 5. Pre-registered gradings (write these down before looking)

- **PASS** = `monoDip = 0` on all 36 tables **and** no length-persistent diagonal deficit — the
  standing ACCEPTANCE definition, unchanged. It is the *measurement* that is new, not the bar.
- **A deficit counts as real** only if it survives at ≥3 seeds with |Δ| > 1σ of the paired band. The
  gear-A corpus learned this the hard way: wall-jitter variance (per-variant sd 0.1427 pp) dwarfed
  seed variance (0.0058 pp), so a single-variant reading looked far more precise than it was.
- **B2 is considered CLOSED by this phase** if the gear-B corpus shows no residual of the same shape
  above the noise band. It is *not* closed by a sign change alone — BENCH §3e is an observation, and
  an observation that flips a sign is a reason to re-measure, not a resolution.
- **If the shakedown fails**, the phase stops and becomes a tool-debugging phase. Say so loudly rather
  than gathering 36 tables with a suspect instrument.

## 6. Exit criteria

Phase 10 is done when: `tools/xval-results/` holds a complete, stamped gear-B round; ACCEPTANCE
carries a gear-B status block written as a first measurement; every open debt in ROADMAP is either
re-priced in gear-B terms or explicitly closed as not-reproducing; and DIARY records the arc plus any
belief the re-measurement overturned.

## 7. Cheap wins that can ride along

- **The Drums `SpellFlagAPL` patch** (a third `tools/wowsims-patches/` entry). Today the default kit
  ships with Drums enabled and the verification silently excludes it — for the *user*, that is the
  cooldown they may most want checked. It needs a trust-anchor re-certification (BENCH §3d), which
  this phase is already set up to do. Details of why it is needed: `sim/planspec.mjs` header.
- **A multi-seed band in the page.** The website currently uses a fixed ±0.05 % tie band; the terminal
  bench already computes a real paired band. Doubling the ~10 s wall clock buys an honest error bar.
