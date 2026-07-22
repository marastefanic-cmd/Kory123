# ARCHITECTURE.md — `index.html` internals

One self-contained file (~3500 lines): a DOM-free JS **engine** (through ~line 935), the
**optimizer**, then the **DOM/UI**. Line numbers drift as the file is edited — treat them as
signposts, re-grep if they're off. Everything below is in `index.html` unless noted.

## Constants (~547–583)
`GAME`: `AB {BASE_CAST 2.5, STACK_CAST_REDUCTION 1/3, MAX_STACKS 3, AVG_BASE_DMG 720, COEF 2.5/3.5}`,
`AE {AVG_BASE_DMG 392, COEF 0.214}` (Arcane Explosion, AoE), `GCD_BASE 1.5`, `GCD_FLOOR 1.0`,
`HASTE_RATING_PER_PCT 15.77`, `CRIT_MULT 1.8175`, `COLD_SNAP_CD 480`. `TALENTS {arcaneConcentration 5,
arcanePotency 3}` + `aoeCritAmp(N, crit)` (just after `GAME`): the AoE-only Clearcasting→Arcane Potency
crit amplification (per-hit Arcane Concentration ⇒ target-scaled Potency crit; applied only to AoE
damage in `simulate`, single-target returns 1 — sim-validated, RULES §9). `BUFFS` (~560–572): each buff's
`kind` (`mult` haste-multiplier, `rating` haste-rating, `dmg` damage-mult, `sp` spellpower, `proc`),
`value`, `dur`, `cd`. `KILL_WINDOW = 0.5` (inside `simulate`, ~631) — half-cast kill smoothing.

## `simulate(schedule, cfg, collect)` — the scorer (~634–934)
Returns `{total, totalEarly, robust, castCount, gcdCappedTime, casts, actEff, dps}`.
- A discrete cast loop builds the press board / activation times (does NOT accumulate damage);
  intermissions fast-forward (`t = seg.end`). **Ramp-aware (RULES §3):** stacks open at 0 (no prestack)
  and re-ramp after every ≥8s AB gap (`lastCastStart` + `DEBUFF_DUR`; AE casts neither build nor
  refresh); ramp casts run at true lengths and are recorded to `boardRamp`. **Press-snap:** an
  activation landing mid-ramp-cast fires at that cast's real end (`prevCastRamp`/`prevCastEnd`);
  steady-state presses keep the phase-averaged intent time. Externals (BL/PI/Drums) always land at
  intent (someone else presses them).
- **Damage = cast-rate integral + discrete ramp casts** (~853–934): `rateAt(t)` = `dmg2 /
  intervalAt(multDn2)` integrated over piecewise-constant breakpoints (buff-window edges, phase edges,
  T±KW, ramp-span edges) — but each `boardRamp` span is EXCLUDED from the integral and scored as its
  discrete cast instead: damage sampled around the completion, jitter-smoothed ±½ GCD (`rampCastDmg`,
  no knife-edges). `scanAt` (~817) is the shared deterministic buff-state scan; `intervalAt` applies
  the **GCD floor** `max(cast/m, 1.0)` statelessly. `total` counts ≤ T; `robust` tapers the last
  half-cast — the optimizer maximizes `robust`.
- AoE segments: `dmg` uses AE base × `targets` × `aoeCritAmp`, interval = GCD only.

## `repair(schedule, cfg)` — feasibility projector (~949–1027)
Legalizes any raw schedule: per-track cooldown spacing (`trackRule`), `maxUses` cap, `lastFor = T−1`
cutoff, **Icy Veins + Cold Snap chaining** (~888–901 — the only way two IVs sit <180s apart; a use
inside cd is allowed only if Cold Snap is ready, then burns it), and the OFF_TRINKETS shared lockout
(skull/mqg/isc). Called after **every** candidate move — this is what makes "packing would cost a 2nd
use" fail automatically (via `sameCounts`).

## `optimizeAsync(cfg, starts, onProgress)` — the search (~1177+)
Multi-start, then a stack of finishing passes run once. Fixed-seed PRNG ⇒ deterministic.
- **Seeds** (~1180–1225): all-at-0, backward-packed, phase-anchored (`seg.start` / intermission
  `seg.end`), **pinned-raid-call anchored** (stacks every track on each Lust/Drums/PI second), and a
  **kill-anchored seed** (each track's last use as late as it fully runs, siblings packed backward by
  cd — the terminal-burst basin forward-packing can't reach).
- **`polish`** hill-climb (~1068): `SHIFTS` ±1..±90 incl. ±3/±6 (ramp-boundary hops) and ±30/±60,
  per-index + suffix-shift + add-a-use + a **joint window move** (all uses sharing a press second shift
  as one block — co-pressed clusters cross valleys together) + a drop-one/relocate escape.
- **`basinHop`** (~1155, runs on the champion after the top-6 integer snaps): window-teleport
  self-consistency guard — re-bases each press-window block on every other window's anchor + the kill
  anchor, re-polishes, keeps strict improvements, to fixpoint. This is what guarantees "never worse
  than a plan reachable from the search's own anchors" (the Phase-4 misses all fell to it).
- Tie-break helpers (local closures): `anchored` ~1087, `overlapOf` ~1103, `joinsRow` ~1116,
  `counts`/`sameCounts` ~1122/1123, `clipOf` ~1126. `castVal`/`QTOL` ~1077/1078 (tie tolerance = one
  cast).
- **`challengePass`** (~1132, called 3×): re-anchors each track's cadence at pull / raid calls /
  phase edges; offers the last use onto other buffs' seconds; IV/Cold-Snap end-chains. Guards robust.
- **Groom loop** ×3 (~1208): Pass 1 haste-actives local search (±45, `nulled`/floored tie-break,
  ~1215–1280) · Pass 2 damage/SP cluster move (~1286–1401) · Pass 3 ±8 ensemble (~1406–1462) · macro
  snap · legibility merges (has a hard `nulled` veto ~1598) · downtime slide to `seg.end` (~1610).
- **Finishing passes:** wasted-haste relocation (evicts a marginal-≤`castVal*0.1` haste
  use — the "Berserking-in-Lust eviction") · **ramp-hold / "Let the stacks build"** — slides a
  damage/SP press stuck on the opener or a post-intermission-exit ramp out past the ramp on a model
  tie (RULES §9). *(Since Phase 4·B the scorer prices the ramp itself, so stepping damage off a ramp is
  a strict score win the ordinary passes find on their own — this tie-gated pass is now a mostly-inert
  belt-and-suspenders normalizer.)* Now includes a **coherent-cluster carry**: when that slide forces a *later* same-track
  use past its cooldown, it shifts that use's whole co-pressed damage/SP cluster together (icon+gem+AP
  move; the burst's haste like IV stays put) so the terminal burst doesn't split — this is what lets
  Vashj emit the sim-verified **4:05 / 6:05** layout (before, `repair()` orphaned gem/AP and the model
  rejected the split). · earliest-on-ties (~1786, hard
  `nulled` veto ~1816) · snap-to-pinned (~1832) · **overlap-alignment for damage/SP** (~1861–1904,
  slides a spellpower/damage press forward onto a staggered damage cluster) · **sequential window-
  packing** (~1913, see below) · **`coPressAlign`** → **`spreadLoneHaste`** → **`dodgeDowntime`** (final
  normalizers, applied in that order) · squeak note · Cold-Snap materiality recursion (~2150).
- **`coPressAlign(s0)`** (~2028, applied at the main resolve AND both Cold-Snap resolves so the plan is
  aligned whichever path built it). Snaps a damage/SP press onto its nearest **earlier haste** second
  **within 3s** when the model cost is **≤ `castVal/8`** — pulls a macro'd burst onto one press when the
  model carries only a sub-cast (often artifactual) preference for a 1s-late spot. The 3s window and
  sub-cast cap protect deliberate staggers (3:20 gem 5s off IV; KT Icon-onto-AP ~20s off Lust). See
  `docs/ROADMAP.md` golden-review findings (7:20 W6, sim-gated).
- **`spreadLoneHaste(s0)`** (~2070, the RULES §11 placement normalizer, applied at the same three resolve
  points as `coPressAlign`, right after it). A haste use whose window intersects **no** damage/SP buff is
  a *lone* use — position-independent (MECHANICS §3/§5 pt 5), so banking it late past a free natural cd
  tick is an arbitrary member of a tie. It slides each lone use back onto its **earliest free natural cd
  tick** (`uses[0]+k·cd`), leaving burst-riding uses pinned. Model-neutral gate (`robust ≥ r0−0.5`, an
  exact tie by position-independence) + `sameCounts` + no worse `clipOf`. On **5:00** this pulls the
  Cold-Snap IV banked at 4:25 onto its 3:05 natural tick, re-homing the burst-IV onto 4:05 (sim +2.4).
  Kept separate from `coPressAlign` (different concern: haste→tick spreading vs damage→haste snapping).
- **`dodgeDowntime(s0)`** (~2107, the RULES §9 downtime normalizer, applied outermost at the same three
  resolve points). The groom loop's downtime-slide (~1618) runs before the Cold-Snap chain and the two
  normalizers above, so those late passes can still leave a press whose window *begins* inside an
  intermission. This slides each such press to the intermission **exit** (`seg.end`). Its dead early
  seconds score zero wherever it sits, so a `robust ≥ r0−0.5` + `sameCounts` gate keeps it honest — and
  it deliberately has **no `clipOf` guard** (sliding to the exit ends the window later, so `clipOf` rises,
  but the *live* portion is unchanged — the clip is the wrong metric here). On **4:00 multi-intermission**
  the Cold-Snap IV at 3:47 (2s inside [3:28–3:49]) → 3:49 (var0 exact wash). Only the "don't *begin* in
  downtime" half of RULES §9; the post-ramp-exit devaluation (Vashj) is still open.
- **`slideEarliest(s0)`** (between `spreadLoneHaste` and `dodgeDowntime`, RULES §10): earliest-possible
  canonicalization. Pulls each mobile press **second** (co-pressed rows move together, and only when
  **every** member can follow — a cd-bound Cold-Snap IV that can't move keeps its burst intact, no split)
  as early as it still ties (`robust ≥ r0−0.5`, sameCounts, no worse clip). Model-neutral. **Returns `s0`
  unchanged for intermission fights** (the exit ramp is a scorer blind spot the sim disagrees with — Vashj
  4:05). Fixes the opener cluster sitting off the pull and Cold-Snap IVs parked mid-fight; moved 7 plain
  goldens earlier (same DPS).
- **Sequential window-packing** (~1975, the RULES §4/§5 move — LANDED). Runs as the last structural pass
  (nothing after it can re-floor the sequenced tail buff, so no defensive rework of the eviction /
  `nulled` vetoes was needed). For each raid-called **haste** buff (kind `mult`/`rating` — a damage/
  burn anchor doesn't floor, so it's skipped), it assembles the burst at the anchor `A`: the damage
  cluster's nearest use → `A`, and the planner haste buffs on slots whose **origin** is one of three
  **modes** (`~2010`):
  - **`packIn`** — haste sequenced from `A` **into** the window (the usual RULES §4 pack: a flooring buff
    floors the window so the damage cluster rides its fastest casts; tail buffs on the unfloored remainder,
    a buff spilling past the window is dropped).
  - **`exitSeq` / `exitStack`** — haste sequenced from **`A + win`** (just PAST the window), the RULES §5
    "IV slides out of Lust as gear haste grows" layout: once passive rating pushes Lust itself near the GCD
    floor, a haste buff on Lust overcaps (worth ~0) while the damage cluster still wants Lust's fast casts.
    `exitSeq` sequences the exiting haste on the tail (each buff unfloored, but a later cd-tick can clip the
    kill); `exitStack` overlaps them all at the window end (a wash off the floor, RULES §7, but keeps every
    buff's cd-tick as EARLY as possible so a 2nd use survives before the kill — the high-haste opener).
  It sweeps the mode, which *use* of the lead haste buff lands on the origin (front-load vs bank), **and —
  via `permute` (~2010) — the ORDER** the haste buffs sequence. Biggest-first floors `packIn` for the
  damage cluster (the usual best); leading with a **shorter** buff pushes the flooring buff later, keeping
  a tail buff's 2nd cd-tick before the kill — the **3:20** opener (`Zerk@0:05` in Lust, `IV@0:15` after,
  `CS→IV2@3:00`, +3.6) needs the Zerk-lead order. Permutation bounded to ≤4 keys (else biggest-first only).
  Every candidate kept on strict robust gain + `sameCounts` + no worse `clipOf`, so the exit modes are
  **inert at h0** (IV-in-Lust wins → goldens byte-identical) and **self-select above the gear-haste
  breakpoint** (sim-verified +2% at h250; RULES §5). Known residual: a narrow ~h200 band whose exit layout
  needs Cold Snap that `repair()` un-spaces (ROADMAP).
- **Cold-Snap materiality** (~2229) distinguishes two regimes (RULES §8). `csAddsUse` starts as "the CS
  champ has **more** IVs than the best no-CS plan"; when CS genuinely **adds** a use the full "≥ one cast"
  bar applies (`bar = castVal`); when it only **repositions** the same IV count (or the chain ends the
  fight) it's a **free** move gated by a sub-cast sliver (`bar = castVal/8`). This is what lets 3:20 spend
  the free CS to sequence the opener (+3.6, same 2-IV count) instead of vetoing it.
  - **Adds-use is now measured by VALUE, not count (~2267).** A count-only test mis-fires at high gear
    haste: the CS champ can carry an **incidental** extra IV parked on the near-floored Lust (worth ~0)
    while CS's real job is sliding a *different* IV OFF Lust so the damage cluster keeps the fast casts
    (RULES §5). Before scoring the bar, the gate trims the champ to the no-CS count by dropping its
    **least-valuable** IV (try each removal, keep the highest re-`simulate`d `robust`); if the champ loses
    **< `castVal`**, the extra IV is incidental → `csAddsUse = false` → sub-cast bar → keep the
    cluster-on-Lust champ instead of vetoing it back to the glued no-CS `bestN`. This closed the last
    high-haste hold-out (~h200, sim-verified +53 DPS); h0 goldens never trim (exit layout doesn't win
    there), so exact-match stays 23/23.

## Inputs → `cfg` (`readCfg`, buff rows)
- **Only raid calls are pinnable.** `RAID_PINNABLE = {bloodlust, drums, powerInfusion}` (the "Raid
  externals" group). `buildBuffList` renders a pin control **only** for those keys; every mage-managed
  cooldown (IV / AP / gem / Berserking / Icon / on-use haste trinkets) is the planner's to schedule, so
  it has no pin UI. `readCfg` mirrors the same set — it only reads `state.times[key]` into `cfg.fixed`
  for a `RAID_PINNABLE` key, so a stale mage-cooldown time in a saved/custom preset is ignored. The
  optimizer still treats any `cfg.fixed[key]` as an immovable anchor (unchanged), and presets only ever
  pin `bloodlust`, so goldens are untouched.

## Phases & rendering
- `buildSegments(rows, T)` (~2191): turns phase rows into `{start,end,type,mult,targets}` segments;
  types `normal | intermission | burn | aoe`. Consumed by `simulate` and the renderer.
- `renderTimeline(run)` (~2573): one inline SVG (fluid `width:100%`, no page horizontal scroll) —
  **deterministic** haste step-curve (`multNoAti` — no averaged Ashtongue proc, RULES §14) + area fill,
  three reference lines (**+50% GCD cap**, **"cap if Ashtongue" ≈ +40.8%** when ATI on, **+25% "4× FB"**
  filler soft cap — RULES §15), phase bands (intermission hatched, AoE/burn tinted with ×N badges),
  buff-uptime lanes with press ticks, **plus dashed "press anywhere here" leeway bands** (`run.leeway`,
  from `leewayZones` — RULES §14). `scheduleRows`/`renderSchedule` build the window table (peak-haste /
  AB-cast / floor also read the deterministic `multNoAti`/`castDn`/`capDn`); `btn-copy` emits the
  canonical copy-as-text plan the tests compare.
- `leewayZones(run)` (just before `renderTimeline`): per mobile press, the maximal contiguous interval
  whose robust score TIES the current placement (move the use by VALUE over the whole fight, scan ±1s until
  it drops; `repair` + sameCounts + relocation guards decide feasibility, so a Cold-Snap Icy Veins is
  handled — not skipped). Since `slideEarliest` (RULES §10) already sits each press at its earliest tie, the
  band naturally extends rightward ("you can delay to X"). Position-independent presses get a wide interval;
  burst-riders collapse to nothing. Computed once in `render` → `run.leeway`, drawn by the timeline and the
  Flexible reasoning tag. Output-only — not in the golden canonicalization.
- **Per-window target mana** (`scheduleRows`, ~2939): each window carries `w.mana` = the AB-spam spend
  over its burst span (`GAME.AB.MANA_FLAT 195 × (1 + 0.75·stacks) + 30% under AP`, per-cast real stacks,
  AoE casts excluded — SOURCES). Shown as the blue `.manatag` chip with a net-of-regen tooltip. Pure
  read over the existing cast list; **mana never feeds the optimizer** (layout-first). Display-only.
- **Placement-reasoning tags** (`pressPlan`, ~3271): a *why-here* reason on a press row **only when it's
  non-obvious** — **Flexible** (a `run.leeway` interval → "press anytime X–Y", + the ATI-proc nudge),
  **Cooldown-timed** ("pressed now so it's back for X", next use ~one cd later), **Cold Snap**
  (`a.coldSnap`), and the boundary note "buffs land on your next AB" for a deferred pinned-row press.
  Anything implied by the schedule (a cluster presses together; an untagged press goes at the time shown)
  gets **no tag** — the earlier "first burst / grouped burst / positioned" tags were dropped as noise.
  Feeds the schedule `.whytag` + copy-text. Output-only (exact-match rebuilds from `scheduleRows`), goldens
  untouched.

## Presets & tests — two baked strips, both the fight table
`index.html` defines **two** baked preset arrays + `GOLDEN_DEFAULTS` (near the localStorage-preset
section, tail of the file) and exposes them on `window`:
- **`BOSS_PRESETS`** — the real current-phase raid encounters (Hydross … Kael'thas), boss-named, with
  the actual fight length / Lust timing / phases from the pulls.
- **`GOLDEN_PRESETS`** — the abstract regression fights (short-length variants, `6:00/5:45` packing,
  `3:20/5:00` containment) that exercise engine edge cases the bosses don't.
Both use the same shape (`{name, T, pins}` + optional `gear`/`kit`/`intermission`/`phases`) and load
**input side only** (no auto-run). Three UI strips: **`#boss-strip`** "Boss presets" (accent) and
**`#golden-strip`** "Debugging presets" (muted) render the two baked arrays via `renderBakedPresets(arr,
hostId)` → `goldenToState(p)` → `applyState(...)`; **`#preset-strip`** "Custom presets" is the
localStorage user-saved strip (was "Boss presets"). The user presses "Find optimal overlay" to
**compute** the plan — presets store setup, never a precomputed answer.
- **Tests (`tests/`):** `exact-match.mjs` reads **both** `window.BOSS_PRESETS` and
  `window.GOLDEN_PRESETS` (+ `GOLDEN_DEFAULTS`) headless, runs each through `optimizeAsync`,
  canonicalizes the plan (setup header + windows + per-press times + Cold-Snap markers, minus cosmetic
  peak-haste/price tags), diffs vs `golden.json` (23 cases: 10 boss + 13 debug). `--update` regenerates.

So "what you click in the tool" and "what the suite locks" are still the same lists — a confirmed
preset (boss or debug) is the exact-match test.
