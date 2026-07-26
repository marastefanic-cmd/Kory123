# `sim/` — the in-page sim verifier

The **"Verify in the sim"** button on the planner runs the *actual wowsims engine* in the browser and
duels two layouts head-to-head. It is the same verification this project runs in the terminal, wired to
a button — not a second implementation of it.

## The chain

```
plan → sim/planspec.mjs → tools/genapl-core.mjs → sim/simreq.mjs → sim/sim.wasm
```

Every link is shared with the harness:

| file | what it is | also used by |
|---|---|---|
| `planspec.mjs` | plan → genapl spec: **fire times, floored**, Cold-Snap split, phases | mirrors `tools/xval.mjs`'s `toSpec` |
| `../tools/genapl-core.mjs` | the APL builder | `tools/genapl.mjs` CLI → every sim run this project has ever done |
| `simreq.mjs` | patches `model-ref-request.json` into a `RaidSimRequest` | `tests/sim-duel.mjs` |
| `model-ref.json` | the gear-agnostic reference character (runner `--export`) | the native runner |
| `model-ref-request.json` | that character as a request — **the runner's own `--dumpreq` output** | the page |
| `sim.wasm` | patched wowsims @ `ade9f39` (both patches) | equals the native runner, asserted |
| `duel-worker.js` | runs one arm off the main thread | — |

**The equality that makes this honest:** `tests/sim-duel.mjs` runs the shipped `sim.wasm` and the
native `runner` on the same inputs and asserts they agree. Measured: **1351.5 vs 1351.5** and
**1345.6 vs 1345.6** DPS at 10 000 iterations. The wasm path uses `core.RunRaidSim` (single-threaded)
and the runner uses `RunRaidSimConcurrent`, and they still land on the same number — so a result the
button prints is a result the terminal would print.

## Gear-agnostic on purpose

The planner asks for four numbers and knows nothing else about your character, so the sim runs a
**fixed synthetic mage** with those numbers injected on top:

- **no gear, no consumes, no raid buffs** — your spell damage / crit / haste rating already *are* the
  raid-buffed totals, so adding buffs would double-count them
- **standard Arcane raid talents** (`2500052300030150330125--053500031003001`) — Arcane Concentration
  and Arcane Potency are load-bearing for AoE (RULES §9)
- **spell hit pinned at the 16% cap** (202 rating at 12.615/1%, vs a level-73 target). A **1% miss
  floor is irreducible** in this engine — it cancels between arms
- **infinite mana** (`1e8`), **cold open** (`_prestack: 0`), **`durationVariation` 0.5s** = the model's
  kill-window width. Never `--var 0`: it quantizes to integer casts and has faked a result twice
- Troll (Berserking is a troll racial)

⇒ **The absolute DPS is not your DPS and is not meant to be.** Only the paired difference is
meaningful, and both arms run the identical character on the identical seed (common random numbers),
which is what makes a 0.1% difference readable at 10 000 iterations.

## Known gaps (stated in the UI, not hidden)

- **Drums of Battle, Power Infusion and Ashtongue Talisman are not transcribable.** genapl has no
  press for them (the first two are raid externals, the third is a passive proc). Both arms are
  simulated without them — symmetric, but it means a plan whose *point* is where the Drums go cannot
  be verified. The UI names whatever it dropped.
- **Burn phases cannot be simulated at all** — "Arcane Blast damage ×N" is a model construct with no
  encounter knob behind it. The button refuses rather than compare something else.
- Intermissions and AoE phases **do** verify (`_intermissions`, `_aoe` + duplicated targets).

## Rebuilding

```
bash sim/build-wasm.sh                              # clone@pin → patch → protoc → wasm
RUNNER=/path/to/runner node tests/sim-duel.mjs      # assert shipped wasm == native rig
```

The artifact is **committed** rather than built at deploy time so the bytes users run are the bytes
that were audited, and so a deploy can't break because upstream moved. `wasm_exec.js` must come from
the same Go toolchain that built `sim.wasm` (currently go1.24.7).
