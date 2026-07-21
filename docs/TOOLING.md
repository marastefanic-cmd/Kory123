# TOOLING.md — the wowsims sim harness (how to verify a plan)

The planner's model is a proxy; the **ground truth is wowsims** (the TBC combat sim). Every golden
and every non-obvious rule in `docs/RULES.md` was verified by forcing a cooldown schedule into
wowsims and reading the DPS. This file documents that workflow and its traps.

## Pieces

- **`tools/genapl.mjs`** (in this repo, durable): builds a wowsims `APLRotation` JSON that spams
  Arcane Blast and fires each cooldown at **fixed scheduled times** (via `APLActionSchedule`). Input
  is a spec of press-time arrays; e.g.
  `node tools/genapl.mjs '{"IV":[105,125,396],"AP":[105,285],"Icon":[0,125,260,396],"Gem":[105,285,405],"Zerk":[105,285],"CS":[124],"BL":[260]}' out.apl.json`.
  Keys: `IV AP CS Zerk BL Icon Gem` (Icon = Icon of the Silver Crescent trinket, Gem = Serpent-Coil
  mana-gem use). Supports `_intermission:[a,z]` / `_intermissions:[[a,z],…]` (AB gated off during
  downtime) and `_prestack:N` (prepull AB casts to remove the opener ramp). Spell/item IDs are in the
  file header.
- **`runner`** (NOT in repo — an ~18MB compiled Go binary): a headless sim built from the **wowsims
  TBC source with APL support — the `wowsims/tbc-new` repo** (Go module `github.com/wowsims/tbc`; the
  APL/`APLActionSchedule` machinery lives under `sim/core/`). The `runner` is a small `main` that
  reads an individual gear export, applies an optional `--apl` rotation override, and prints one TSV
  result line. (In this environment the repo is fetched through the configured git proxy; clone
  `wowsims/tbc-new` from wherever it's hosted for you.) Flags: `--export <gear.json> --apl <a.apl>
  --dur <sec> --var <sec> --iter <N> --seed <n> --mana <flat> --haste <rating> --tag <label> --quiet`.
  Output TSV columns: `tag  dur  var  iter  meanDPS  stdev  col7  time` — **column 5 is mean DPS**.
- **Gear export** (NOT in repo — user-provided): the player's wowsims individual-export JSON
  (Character → Settings → export). Point `--export` at it. Don't hardcode its path in committed files
  (it's user data).
- **wowsims-tbc source** + `runner` currently live in the **session scratchpad**, which is
  **ephemeral** (cleared with the container). After a fresh session, rebuild `runner` from the source
  and re-obtain the gear export; `tools/genapl.mjs` is the only piece that persists in the repo.

## Running a clean comparison

```
node tools/genapl.mjs '<specA>' A.apl.json && ./runner --export gear.json --apl A.apl.json \
  --dur 420 --var 0 --iter 250000 --seed 11 --mana 900000 --haste 0 --tag A --quiet
# repeat for specB; compare column 5. Use ≥2 seeds; a real effect is stable across seeds.
```
- `--var 0` = fixed kill (lowest noise for A/B). `--mana 900000` ≈ infinite (isolate the overlay
  decision from mana). `--haste 150` etc. tests gear breakpoints. Common `--seed` = paired,
  low-noise diffs.
- A sub-DPS effect (~0.3–1 DPS) needs ≥250k iters and multiple seeds; if it's identical across seeds
  it's real, if it swings it's noise/boundary.

## Traps (learned the hard way)

- **Off-GCD scheduling collision — the big one.** If two off-GCD abilities (e.g. Icy Veins + Icon)
  are scheduled at the *identical* integer second, the engine drops/defers one — a **~6 DPS harness
  artifact that does not exist in game** (in game you macro them together and both fire). When
  comparing plans, **offset bundled off-GCD presses by distinct fractions of a second** (e.g. IV .0,
  BL .05, AP .15, Gem .30, Icon .45, Zerk .60, CS −.2) so nothing shares a tick. The offset represents
  "all buffs up together," NOT staggered play. Symptoms this hid: a phantom −6.7 on a KT plan; a
  fixed-length "+37" that was pure boundary luck (vanished under `--var 10`).
- **Fixed-length boundary artifacts.** At an exact fight length, whose cast train ends flush at the
  buzzer can swing ±1 cast. If an A/B gap looks suspiciously large at one length, re-check under
  `--var 10` (randomized kill) — a real effect survives, a boundary artifact collapses.
- **Cold-Snap IV** — treat it simply as "once per fight, one IV ignores the cooldown." In the APL,
  schedule `CS` slightly before the cheated IV (the runner resets IV mid-schedule); since there's no
  second reset, the CS→IV must be the IV that breaks the 180s cd. You can otherwise ignore the fine
  timing — it's just one bonus IV.
- **AoE isn't modeled by AB-spam.** The runner casts Arcane Blast; it can't value a real 6-target
  AoE phase. Calls that hinge on AoE weighting (KT double-IV-over-AoE) are model assumptions the sim
  can't confirm — flag them, don't claim sim proof.

## Verifying a golden change

After an intentional model/optimizer change: rebuild, run `tests/exact-match.mjs`, and for **every**
golden whose plan moved, sim new-vs-old (collision-offset, `--var 0`, common seed, ≥100k) and accept
the change **only if new ≥ old**. Then `node exact-match.mjs --update` and eyeball the diff. The model
is the search heuristic; the sim is the referee.
