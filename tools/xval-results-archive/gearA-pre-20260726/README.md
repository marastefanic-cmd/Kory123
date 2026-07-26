# GEAR A — the whole pre-2026-07-26 cross-validation corpus (ARCHIVED, do not compare forward)

36 tables. This is **every acceptance/cross-val number the project produced up to and including
round 7**, moved here intact on 2026-07-26 when the reference character was re-exported
(`docs/BENCH.md` §1). Nothing here is wrong; it is simply **about a character that is no longer the
reference, measured with an instrument that has since changed**.

## Why it was archived

| | gear A (this directory) | gear B (current) |
|---|---|---|
| character | the pre-07-26 export | `tools/bench/export.json` — committed, frozen (BENCH §1.1 reversed the "never commit an export" policy) |
| gems / wand | the old set | changed; **base SP is bit-identical**, crit ≈38% and haste 0 both confirmed (BENCH §4c) |
| `--var` | `0` on many gates | **0.5, settled by measurement** (BENCH §3, `tools/var-decision.mjs`) |
| normalisation | raw DPS | **difference-in-differences** vs a never-press control (BENCH §2.1) |
| rig | native runner + a private export found in a session scratchpad | `tools/bench.mjs` + the committed `sim/sim.wasm` — no rig at all |

★ **BENCH §1's rule is absolute: do not compare a gear-B number to a gear-A number. Any table mixing
them is void.** This is not a precaution — B2's sim preference moved **~0.39 pp and changed sign**
between the two (BENCH §3e), which is larger than most of the effects the corpus was built to resolve.

## What rests on these tables (and is therefore awaiting re-measurement)

- **`docs/ACCEPTANCE.md`'s "NOT PASSING (B)"** — 135 borrowed-win columns across 34/36 tables, median
  0.035 %, worst 0.38 %. That is the project's own "are we done" verdict, and it is a **gear-A**
  verdict.
- **`docs/PHASE8.md`'s B2 ≈ 0.445 pp** residual, its U-shaped length profile, and every candidate
  mechanism scored against it.
- **`docs/PHASE7.md`'s** deficit diagnoses and the low-haste basin debt.

None of those are withdrawn — they are **un-denominated**: true of gear A, unknown on gear B until
Phase 10 restates them.

## What is permanently valid regardless of baseline

The *reasoning*. Every trap, correction and mechanism recorded alongside these tables — the drop bug,
the prepull non-monotonicity, the `t5two`/effective-SP harness errors, the seed-spacing trap, the
wall-jitter-vs-seed error-bar finding, the repricing trap — is about how to run the instrument, not
about which character it ran on. Those carry forward unchanged.

## If you need a number from here

Read it as **"gear A, pre-07-26 protocol, <round>"** and say so wherever you quote it. Re-gathering on
gear B is `docs/PHASE10.md`; until it lands, this directory is the only place the project has an
acceptance measurement at all — which is exactly why it must not be mistaken for a current one.
