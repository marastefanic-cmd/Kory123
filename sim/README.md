# `sim/` — the in-page sim verifier

The **"Check in the benchmark sim"** button on the planner runs the *actual wowsims engine* in the
browser and duels two layouts head-to-head. It is the same verification this project runs in the
terminal, wired to a button — not a second implementation of it.

It is **not** a simulation of the user's character and never asks for gear; the in-page **"?"** dialog
says so in the user's own terms, and the result panel repeats it next to the number ("read the gap, not
the DPS").

## The chain

```
plan → sim/planspec.mjs → tools/genapl-core.mjs → sim/simreq.mjs → sim/sim.wasm
```

Every link is shared with the harness:

| file | what it is | also used by |
|---|---|---|
| `benchmark.mjs` | **THE duel protocol** — variation, mana, iterations, seed, tie band, rating conversions | `tools/plan-duel.mjs`, both tests |
| `planspec.mjs` | plan → genapl spec: **fire times, floored**, Cold-Snap split, phases | mirrors `tools/xval.mjs`'s `toSpec` |
| `../tools/genapl-core.mjs` | the APL builder | `tools/genapl.mjs` CLI → every sim run this project has ever done |
| `simreq.mjs` | patches `model-ref-request.json` into a `RaidSimRequest` | `tests/sim-duel.mjs` |
| `model-ref.json` | the gear-agnostic reference character (runner `--export`) | the native runner |
| `model-ref-request.json` | that character as a request — **the runner's own `--dumpreq` output** | the page |
| `sim.wasm` | patched wowsims @ `ade9f39` (both patches) | equals the native runner, asserted |
| `duel-worker.js` | runs one arm off the main thread | — |

## One protocol, two consumers — and it is checked, not trusted

`benchmark.mjs` holds every protocol setting (duration variation, infinite mana, iterations, seed, the
tie band, the rating conversions, the cold open). The page imports it; so do `tools/plan-duel.mjs`,
`tests/sim-duel.mjs` and `tests/sim-request.mjs`. `runnerFlags()` even **generates the native command
line** from the same object, so `--var 0.5` is never typed into a tool again.

What is deliberately *not* shared is the **character**: `tools/reference-gear.mjs` + a real export is
the cross-val instrument's fully-geared raid setup (and that file says outright it is not for
`index.html`), while `model-ref.json` is this benchmark's synthetic, gear-less mage. Different
questions, so they must be free to differ.

Sharing makes the two sides *likely* to agree. **`tests/sim-request.mjs` makes it checked:**

```
RUNNER=/path/to/runner node tests/sim-request.mjs
```

- **protocol invariants** — asserts the *values* themselves (variation ≠ 0, cold open, mana ≥ 1e7,
  seeds spaced ≥ iterations, hit cap 16). Sharing a constant makes both sides agree; it cannot make the
  shared value correct, so these guard the value.
- **template freshness** — regenerating `model-ref-request.json` from `model-ref.json` reproduces the
  committed file.
- **request equality** — across a matrix (plain, geared, Cold Snap, intermission, AoE, odd stats) the
  request the **page** builds equals the request the **native runner** builds, field for field.
  Comparison is semantic: protojson's `EmitUnpopulated` defaults are equal to a missing field, but a
  *non-default* present on one side only is a failure.

Both gates were negative-controlled (break one side → they fail).

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

- **Drums of Battle and Power Infusion cannot be pressed from an APL — an UPSTREAM fact, not a genapl
  gap.** wowsims only exposes a spell to an APL if it is registered with `SpellFlagAPL`.
  `registerBloodlustCD` has it (which is why Bloodlust works); `drumsSpellConfig` (35476) and
  `registerExternalConsecutiveCDApproximation` (PI, 10060) do not — they are auto-fired
  `MajorCooldown`s, so the *sim* would choose the timing, which is exactly what a press-timing duel
  must not delegate. ⚠ **The attempt fails silently**: measured 2128.9 DPS with and without the
  scheduled press, bit-identical, zero aura uptime. Both arms therefore run without them and the UI
  names what it dropped. **Patchable** — a third `tools/wowsims-patches/` entry adding the flag — at
  the cost of re-certifying the trust anchor (BENCH §3d).
- **Ashtongue Talisman** is not patchable and never will be: it is a passive proc, so there is no
  press to schedule (RULES §14).
- **Burn phases cannot be simulated at all** — "Arcane Blast damage ×N" is a model construct with no
  encounter knob behind it. The button refuses rather than compare something else.
- Intermissions and AoE phases **do** verify (`_intermissions`, `_aoe` + duplicated targets).

## Which wowsims

`sim.wasm` is built from **`wowsims/tbc-new`** @ `ade9f39cc` — the repo deployed at
**https://www.wowsims.com/tbc/**. The archived `wowsims/tbc` (`wowsims.github.io/tbc`) is the original
2021 pre-APL sim and is never used; **every link the page shows must point at `wowsims.com`**, since a
user who follows one to the dead sim will reasonably conclude the whole tool is built on it (that is
exactly how the mistake surfaced on 07-26). `bash tools/upstream-drift.sh` answers "are we behind, and
does it matter" in one command.

## Rebuilding

```
bash sim/build-wasm.sh                              # clone@pin → patch → protoc → wasm
RUNNER=/path/to/runner node tests/sim-duel.mjs      # assert shipped wasm == native rig
```

The artifact is **committed** rather than built at deploy time so the bytes users run are the bytes
that were audited, and so a deploy can't break because upstream moved. `wasm_exec.js` must come from
the same Go toolchain that built `sim.wasm` (currently go1.24.7).
