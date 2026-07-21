# ARCHITECTURE.md — `index.html` internals

One self-contained file (~3091 lines): a DOM-free JS **engine** (through ~line 819), the
**optimizer**, then the **DOM/UI**. Line numbers drift as the file is edited — treat them as
signposts, re-grep if they're off. Everything below is in `index.html` unless noted.

## Constants (~547–583)
`GAME`: `AB {BASE_CAST 2.5, STACK_CAST_REDUCTION 1/3, MAX_STACKS 3, AVG_BASE_DMG 720, COEF 2.5/3.5}`,
`AE {AVG_BASE_DMG 392, COEF 0.214}` (Arcane Explosion, AoE), `GCD_BASE 1.5`, `GCD_FLOOR 1.0`,
`HASTE_RATING_PER_PCT 15.77`, `CRIT_MULT 1.8175`, `COLD_SNAP_CD 480`. `BUFFS` (~560–572): each buff's
`kind` (`mult` haste-multiplier, `rating` haste-rating, `dmg` damage-mult, `sp` spellpower, `proc`),
`value`, `dur`, `cd`. `KILL_WINDOW = 0.5` (inside `simulate`, ~631) — half-cast kill smoothing.

## `simulate(schedule, cfg, collect)` — the scorer (~586–819)
Returns `{total, totalEarly, robust, castCount, gcdCappedTime, casts, actEff, dps}`.
- A discrete cast loop builds the press board / activation times (does NOT accumulate damage);
  intermissions fast-forward (`t = seg.end`).
- **Damage is a separate cast-rate integral** (~795–817): `rateAt(t)` = `dmg2 / intervalOf(multDn2)`
  integrated over piecewise-constant breakpoints (buff-window edges, phase edges, T±KW). `intervalOf`
  (~777) applies the **GCD floor** `max(1.5/m, 1.0)`; it's stateless (recomputed per breakpoint, so a
  floored sub-window never contaminates a later one). `total` counts casts ≤ T; `robust` tapers casts
  in the last half-cast by P(alive) — the optimizer maximizes `robust`.
- AoE segments: `dmg` uses AE base × `targets`, interval = GCD only.

## `repair(schedule, cfg)` — feasibility projector (~838–916)
Legalizes any raw schedule: per-track cooldown spacing (`trackRule`), `maxUses` cap, `lastFor = T−1`
cutoff, **Icy Veins + Cold Snap chaining** (~888–901 — the only way two IVs sit <180s apart; a use
inside cd is allowed only if Cold Snap is ready, then burns it), and the OFF_TRINKETS shared lockout
(skull/mqg/isc). Called after **every** candidate move — this is what makes "packing would cost a 2nd
use" fail automatically (via `sameCounts`).

## `optimizeAsync(cfg, starts, onProgress)` — the search (~1012–1958)
Multi-start, then a stack of finishing passes run once. Fixed-seed PRNG ⇒ deterministic.
- **Seeds** (~1019–1049): all-at-0, backward-packed, phase-anchored (`seg.start` / intermission
  `seg.end`), and **pinned-raid-call anchored** (stacks every track on each Lust/Drums/PI second —
  the one place different haste tracks start co-located; local search then pulls the floored one out).
- **`polish`** hill-climb (~955–1013): `SHIFTS` ±90, per-index + suffix-shift + add-a-use + a
  drop-one/relocate escape. **No cross-key joint move** — this is the gap that blocks sequential
  haste-packing.
- Tie-break helpers (local closures): `anchored` ~1087, `overlapOf` ~1103, `joinsRow` ~1116,
  `counts`/`sameCounts` ~1122/1123, `clipOf` ~1126. `castVal`/`QTOL` ~1077/1078 (tie tolerance = one
  cast).
- **`challengePass`** (~1132, called 3×): re-anchors each track's cadence at pull / raid calls /
  phase edges; offers the last use onto other buffs' seconds; IV/Cold-Snap end-chains. Guards robust.
- **Groom loop** ×3 (~1208): Pass 1 haste-actives local search (±45, `nulled`/floored tie-break,
  ~1215–1280) · Pass 2 damage/SP cluster move (~1286–1401) · Pass 3 ±8 ensemble (~1406–1462) · macro
  snap · legibility merges (has a hard `nulled` veto ~1598) · downtime slide to `seg.end` (~1610).
- **Finishing passes:** wasted-haste relocation (~1719–1752, evicts a marginal-≤`castVal*0.1` haste
  use — the "Berserking-in-Lust eviction") · ramp-hold (~1753) · earliest-on-ties (~1786, hard
  `nulled` veto ~1816) · snap-to-pinned (~1832) · **overlap-alignment for damage/SP** (~1861–1904,
  slides a spellpower/damage press forward onto a staggered damage cluster) · squeak note ·
  Cold-Snap materiality recursion (~1915).
- **Known blockers to sequential haste-packing** (the current top optimizer task): no joint
  "pull A onto burst while re-homing B" move; the eviction + `nulled` vetoes actively undo a packed
  second haste buff; the packed win is sub-cast so tie-breaks can trade it away. See
  `docs/ROADMAP.md`.

## Phases & rendering
- `buildSegments(rows, T)` (~1932): turns phase rows into `{start,end,type,mult,targets}` segments;
  types `normal | intermission | burn | aoe`. Consumed by `simulate` and the renderer.
- `renderTimeline(run)` (~2314): one inline SVG (fluid `width:100%`, no page horizontal scroll) —
  haste step-curve + area fill, dashed GCD-cap line, phase bands (intermission hatched, AoE/burn
  tinted with ×N badges), buff-uptime lanes with press ticks. `scheduleRows`/`renderSchedule` build
  the window table; `btn-copy` emits the canonical copy-as-text plan the tests compare.

## Presets & tests — one shared fight table
`index.html` defines `GOLDEN_PRESETS` + `GOLDEN_DEFAULTS` (near the localStorage-preset section, tail
of the file) and exposes them on `window`. This single array is the canonical fight list:
- **UI:** the `#golden-strip` "Debugging presets" chips render from it; clicking one calls
  `goldenToState(p)` → `applyState(...)` (loads inputs only) → `btn-run` (the optimizer **computes**
  the plan live). Presets store setup, never a precomputed answer.
- **Tests (`tests/`):** `exact-match.mjs` loads `index.html` headless (playwright-core), reads
  `window.GOLDEN_PRESETS`/`GOLDEN_DEFAULTS` from the page (there is **no** `cases.json`), runs each
  through `optimizeAsync`, canonicalizes the plan (setup header + windows + per-press times +
  Cold-Snap markers, minus cosmetic peak-haste/price tags), diffs vs `golden.json`. `--update`
  regenerates. Supports `intermission`/`aoe`/`burn` phases. A preset entry is `{name, T, pins}` with
  optional `gear`/`kit`/`intermission`/`phases` overrides.

So "what you click in the tool" and "what the suite locks" are literally the same list — a confirmed
preset is the exact-match test.
