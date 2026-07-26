# ARCHITECTURE.md — `index.html` internals

One self-contained file (~3600 lines), now in **two script blocks**:
`<script id="engine-src">` — the pure, DOM-free **engine + optimizer** (constants →
`optimizeAsync`) — and a second `<script>` with the **DOM/UI**. The engine runs **twice**: on the
page (cheap one-off `simulate()`/`scheduleRows()` for rendering, and the headless test suites
`page.evaluate` it directly) and inside a **Blob Web Worker** built from the engine tag's own
`textContent` (`runOptimize`, in the UI block — the heavy `optimizeAsync` run happens there, so the
main thread never computes; byte-identical code ⇒ byte-identical plans, worker-vs-page verified). A
run already in flight is terminated before a new one starts (no stale-result races); if Worker/Blob
construction ever fails, `runOptimize` falls back to the in-page engine, which stays alive via the
throttled yields. **The search is also parallelized across CPU cores** (`attachPool` / engine-side
`poolInit`/`poolMap`): the page builds `min(8, cores−2)` "pool" workers (dumb polish servers) from
the same engine source and hands the main worker one MessagePort per pool worker; `optimizeAsync`
fans its two dominant costs — the seed polishes and `basinHop`'s teleport evaluations (~93% of a
285s KT run, measured) — across them with a **first-accept-in-iteration-order** reduction that
reproduces the sequential search step for step, so pooled and sequential paths return
**byte-identical plans** (verified; tests run the page's sequential path, `POOL` stays null there).
A **polish-result cache** (`polishCacheFor` — per-cfg WeakMap, keyed by `sigOf(repairedSchedule)`,
shared by both paths) dedupes the repeats: teleports are repaired orchestrator-side (`teleportRep`,
~2µs) so identical legalized candidates — rampant within a sweep and across the fixpoint's rounds —
pay for one polish, not many; polish is pure, so cache hits are bit-equal to recomputation, and
accepted entries are **cloned** before becoming the champion so downstream passes can't mutate the
cache. Measured: KT 285.7s → 201s (pool alone, 2 workers) → **134.4s** (pool + cache).
Nothing runs after the results render — the old post-render "what if the kill runs longer"
re-optimization (aux worker) is REMOVED (user decision: not worth the background CPU). Line
numbers drift as the file is edited — treat them as signposts, re-grep if they're off. Everything
below is in `index.html` unless noted.

## Constants (~547–583)
`GAME`: `AB {BASE_CAST 2.5, STACK_CAST_REDUCTION 1/3, MAX_STACKS 3, AVG_BASE_DMG 720, COEF 2.5/3.5}`,
`AE {AVG_BASE_DMG 392, COEF 0.214}` (Arcane Explosion, AoE), `GCD_BASE 1.5`, `GCD_FLOOR 1.0`,
`HASTE_RATING_PER_PCT 15.77`, `CRIT_MULT 1.8175`, `COLD_SNAP_CD 480`. `TALENTS {arcaneConcentration 5,
arcanePotency 3}` + `aoeCritAmp(N, crit)` (just after `GAME`): the AoE-only Clearcasting→Arcane Potency
crit amplification (per-hit Arcane Concentration ⇒ target-scaled Potency crit; applied only to AoE
damage in `simulate`, single-target returns 1 — sim-validated, RULES §9). `BUFFS` (~560–572): each buff's
`kind` (`mult` haste-multiplier, `rating` haste-rating, `dmg` damage-mult, `sp` spellpower, `proc`),
`value`, `dur`, `cd`. `KILL_WINDOW = 0.5` (inside `simulate`, ~631) — half-cast kill smoothing.

## `simulate(schedule, cfg, collect)` — the scorer (~660–990)
Returns `{total, totalEarly, robust, castCount, gcdCappedTime, casts, actEff, dps}`.
`simulate` is now a **memo wrapper** over `simulateRaw` (the actual scorer): collect=false results
(plain number bags; no caller mutates them — verified) are cached keyed by
`cfgSigOf(cfg) + sigOf(schedule)` (string key, so pool workers hit despite receiving cfg as a
structured clone per job), bounded by a wholesale clear at 120k entries. Purity ⇒ hits are
bit-equal to recomputation; collect=true always computes fresh.
- A discrete cast loop builds the press board / activation times (does NOT accumulate damage);
  intermissions fast-forward (`t = seg.end`). **Ramp-aware (RULES §3):** stacks open at 0 (no prestack)
  and re-ramp after every ≥8s AB gap (`lastCastStart` + `DEBUFF_DUR`; AE casts neither build nor
  refresh); ramp casts run at true lengths and are recorded to `boardRamp`. **Press-snap:** an
  activation landing mid-ramp-cast fires at that cast's real end (`prevCastRamp`/`prevCastEnd`).
  **Press-execution scoring (RULES §3b, Phase 7):** every activation carries a `scoreStart` alongside
  its fire/display time — a mid-cast steady press slips `+½·prevInterval` (expected wait to the next
  boundary; interior windows invariant, edge-flush windows charged), and an external (BL/PI/Drums —
  aura lands at the call, someone else presses) snaps its scored window to the next board-lattice
  boundary (the in-flight cast keeps its speed). `scanAt`/`bpS`/`rampCastDmg` read `scoreStart`;
  legality/cadence/display keep the fire time.
- **Damage = cast-rate integral + discrete ramp casts** (~853–934): `rateAt(t)` = `dmg2 /
  intervalAt(multDn2)` integrated over piecewise-constant breakpoints (buff-window edges, phase edges,
  T±KW, ramp-span edges) — but each `boardRamp` span is EXCLUDED from the integral and scored as its
  discrete cast instead: `rampCastDmg(ts, tc)` — buff/SP **state** jitter-averaged ±½ GCD around the
  cast **START** `ts` (RULES §3b.3; ⚠ the *fix* is right, its old *mechanism* is not — wowsims reads a
  value buff at cast **completion**, so start-sampling is exact at a window's front edge and
  over-credits its back edge by `frac(D/Δ)×premium`, the known unimplemented PHASE8 term), damage
  **time** (kill taper, wall/AoE gating) at the completion `tc` (Phase 4's rule). `scanAt` (~817) is the shared deterministic buff-state scan; `intervalAt` applies
  the **GCD floor** `max(cast/m, 1.0)` statelessly. `total` counts ≤ T; `robust` tapers the last
  half-cast — the optimizer maximizes `robust`.
- AoE segments: `dmg` uses AE base × `targets` × `aoeCritAmp`, interval = GCD only.

## `repair(schedule, cfg)` — feasibility projector (~949–1027)
Legalizes any raw schedule: per-track cooldown spacing (`trackRule`), `maxUses` cap, `lastFor = T−1`
cutoff, **Icy Veins + Cold Snap chaining** (~888–901 — the only way two IVs sit <180s apart; a use
inside cd is allowed only if Cold Snap is ready, then burns it), and the OFF_TRINKETS shared lockout
(skull/mqg/isc). Called after **every** candidate move — this is what makes "packing would cost a 2nd
use" fail automatically (via `sameCounts`).

## `optimizeAsync` = cross-haste pooling wrapper over `optimizeCore` (B1 dominance by construction)
`optimizeAsync(cfg, starts, onProgress)` is a thin `async` wrapper (Phase 7): it runs `optimizeCore`
at `cfg.hasteRating`, and — **only when `cfg.poolHastes` is a non-empty array** — forms the fixed
candidate set `C = { champ(h) = optimizeCore(h) : h ∈ poolHastes ∪ {H} }` and returns
`argmax_{P∈C} simulate(P at H).robust`. Because every haste's emitted plan is a member of the *same*
set C, `score(emit(Hj) at H) ≤ max_C at H = emit(H)` — no borrowed-haste plan can out-score the native
(model-side **invariant B1**, ACCEPTANCE). Three correctness rules the implementation MUST keep (each
cost a debugging round): candidates are scored **raw** (never re-polished at H — a re-polished plan is
outside C and leaks the guarantee); pool solves use the **same `starts`** as the base (so `champ(H)` is
one object whether computed as base or as a neighbor); and the baseline is anchored to
`simulate(base.s)` not `base.val` (the Cold-Snap path returns a normalize()-d schedule whose `.val`
predates the normalize). Recursion is guarded by `_noPool` (neighbor solves and the internal no-Cold-
Snap comparison call `optimizeCore` directly). **Default (no `poolHastes`) returns the plain core solve
— goldens/UI byte-identical, exact-match 25/25 unchanged.** Cost = `|poolHastes|`× solves; the caller
picks the grid. The cross-val (`tools/xval.mjs`) computes each `champ(h)` **once** and takes the argmax
per column (identical result, deduplicated — `POOL=0` env restores the raw per-haste search to measure
what pooling fixed). Design validated on committed round-2 data: pooling closes model-side B1 **22→0**.

### `optimizeCore(cfg, starts, onProgress)` — the search (~1224+)
Multi-start, then a stack of finishing passes run once. Fixed-seed PRNG ⇒ deterministic.
- **The whole finishing stage runs inside an `async` IIFE with throttled yields** (crash fix — on long
  fights it used to block the browser main thread for minutes, tripping the "Page Unresponsive" kill).
  A `tick()` helper (top of the IIFE) yields via `scheduler.yield()`/`MessageChannel` (dodging the 4ms
  nested-`setTimeout` clamp) at most every ~40ms of compute; `breathe()` wraps it with progress-bar
  creep and is awaited at every heavy loop boundary (`challengePass` rounds, groom sweeps, per-use
  scans, `basinHop` teleports, the four normalizers). `performance.now()` gates ONLY when the thread
  yields — no computed value reads it, so one-setup-⇒-one-schedule is untouched. `basinHop`,
  `challengePass`, `coPressAlign`, `spreadLoneHaste`, `slideEarliest`, `dodgeDowntime` are `async` for
  this reason alone; their logic is unchanged.
- **Seeds** (~1446–1491, in this order): all-at-0 (`naiveSchedule`), backward-packed
  (`packedSchedule`), phase-anchored (`seg.start` / intermission `seg.end`, capped at `starts + 8`),
  **pinned-raid-call anchored** (stacks every track on each Lust/Drums/PI second, first 4), a
  **kill-anchored seed** (each track's last use as late as it fully runs, siblings packed backward by
  cd — the terminal-burst basin forward-packing can't reach), then **random fill to `starts`**, then
  **`groupSeeds`** (below) appended as pure EXTRAS past `starts`, tagged from `grpStart`. ⚠ The order
  is load-bearing (PHASE9 §5.16): group seeds used to be pushed *before* the fill and counted toward
  `starts`, silently evicting one random start per chain seed — an additive seed class must never
  remove entrants, and three of round 6's search regressions traced to exactly that.
- **`groupSeeds(cfg)`** (~1134, Phase 9 §5.14 — the RULES §4b **chain law** made reachable): builds
  *chain* entrants — `origin × gap-chain × which long-cd track skips group 1`. Origins are `{0} ∪
  round(fixed press seconds)` (first 3); a chain is a DFS over the **enabled cooldown periods**
  themselves (`5 —+120→ 125 —+180→ 305`), **maximal chains only** (a prefix gives every track strictly
  fewer uses ⇒ dominated), depth ≤ 6, ≤ 24 chains. Each track then presses at every group second it is
  legally up for; Cold Snap grants Icy Veins **one** early repeat inside the chain; the `skip` variants
  let one long-cd track **decline the opening group** to keep its remaining uses stacked (linear in
  tracks, not `2^n`). Deduped by `sigOf` after `repair`. **≤ 40 candidates, ~88 ms across all 25 cases**
  — and no score cut: pre-ranking candidates by raw `simulate()` is measurably self-defeating (the
  polish-best sat at raw rank 13/40 and 12/12; a top-3 cut loses 8087.794 corpus-wide). Every other seed
  class places a track on *its own* cadence, so a stacked chain that declines an available use is
  unreachable from all of them — from a non-chain entrant `basinHop` gains **+0.000** even with every
  anchor `0..T−1`.
- **`polish`** hill-climb (~1068): `SHIFTS` ±1..±90 incl. ±3/±6 (ramp-boundary hops) and ±30/±60,
  per-index + suffix-shift + add-a-use + a **joint window move** (all uses sharing a press second shift
  as one block — co-pressed clusters cross valleys together) + a drop-one/relocate escape.
- **`basinHop`** (~1170, runs after the integer snaps — which snap the top-6 **non-group** results
  exactly as pre-groupSeeds, PLUS any group entrant above that bar, tracked separately as `bestGrp`):
  window-teleport self-consistency guard — re-bases each press-window block on every other window's
  anchor, each track's natural next cd-tick, every **ramp-exit boundary** (the first full-stack cast
  after each cold start, read from the champion's own board — the h160-class descent-valley basin
  sits exactly there, one fast cast off any 5s-grid anchor) + the kill anchor, re-polishes, keeps
  strict improvements, to fixpoint. This is what guarantees "never worse than a plan reachable from
  the search's own anchors" (the Phase-4 misses all fell to it). ★ **Two-arm hop + two-arm TAIL when
  a group entrant snap-leads** (PHASE9 §5.16/§5.17): both arms are hopped, and the whole finishing
  stack below is a callable **`finishLine(entrant)`** run once per arm — the FINAL values decide
  (hop-exit selection measurably loses tails in both directions; a +5.85 hop win's tail lost −14).
  Primary = the old-rule carry, ties keep it; the no-Cold-Snap comparison solve inside the tail is
  arm-independent and memoized (`bestNMemo`), so the second arm costs groom passes, not a full solve.
- Tie-break helpers (local closures): `anchored` ~1087, `overlapOf` ~1103, `joinsRow` ~1116,
  `counts`/`sameCounts` ~1122/1123, `clipOf` ~1126. `castVal`/`QTOL` ~1077/1078 (tie tolerance = one
  cast).
- **`challengePass`** (~1132, called 3×): re-anchors each track's cadence at pull / raid calls /
  phase edges; offers the last use onto other buffs' seconds; IV/Cold-Snap end-chains. Guards robust.
- **Groom loop** ×3 (~1714, with an **early exit** — Phase 9 §5.12: rounds ≥1 are the same
  deterministic function of `s` (each opens with `challengePass()`; only round 0 skips it) and `val` is
  non-decreasing, so a no-op round ⇒ every remaining round is a no-op. `if (groom >= 1 && unchanged)
  break;` — plan-neutral on all 25; −10.1% CPU measured alone, −8.5% netted with `groupSeeds`, §5.14):
  Pass 1 haste-actives local search (±45, `nulled`/floored tie-break,
  ~1215–1280) · Pass 2 damage/SP cluster move (~1286–1401) · Pass 3 ±8 ensemble (~1406–1462) · macro
  snap · legibility merges (has a hard `nulled` veto ~1598) · downtime slide to `seg.end` (~1610).
- **Drop-one-use escape** (after the fixpoint, before the CS gate — Phase 7): offers each single-use
  drop per unfixed track, polishes (survivors re-align), keeps strict improvements, iterates to a
  bounded fixpoint with a re-hop — the RULES §4 align-vs-twice *sacrifice* side (one AP aligned on the
  cluster can beat two spread), unreachable by the count-preserving drop-and-relocate ladder.
- **CS chain-geometry candidates** (inside the Cold-Snap gate — Phase 7): the end-chain offering is
  generalized to the full slot family (CS compressing the pair at each slot j, at both the same count
  and count+1, plus the kill-anchored end pair), and every chain candidate is **polished** (raw chains
  lose without co-adapting the other tracks — probe-proven on the mqg+skull xl end-chain).
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
- **`canonicalWindowOrder(s0)`** (~2730, the §5.11 legibility canonicalizer — applied at all THREE
  `resolve(...)` sites *after* `normalize`, i.e. it is the LAST thing that touches a plan). Inside each
  **pinned haste window** (a `cfg.fixed` buff of kind `mult`/`rating` — in practice Bloodlust) it groups
  the mage's presses into **blocks** (presses within 3s of each other are one block), finds the **burst
  cluster** (the first block carrying both a damage/SP buff and a haste buff), and — when the only blocks
  ahead of it are **lone-haste fillers** — rotates the arrangement so the **cluster leads** and the
  fillers sequence after it (each filler placed at `cluster.start + leadDur`, then chained by its own
  duration). Same window occupancy, opposite order. Gated hard: `repair`-legal, `sameCounts`, no worse
  `clipOf`, and `robust ≥ r0 − castVal/1000` (≈0.001 casts — a float-noise epsilon, i.e. **exact ties
  only**), so it can never trade DPS for looks.
  - **Why it lives at `resolve`, not inside `normalize`:** placed inside the normalize fixpoint it cost
    **0.0136 effective casts** on Hydross — the downstream passes re-drift the rotated layout and the
    hop↔normalize fixpoint re-converges on the old shape. Run last, Hydross lands on the exact tie
    (`robust=196077.764863`, bit-identical) with the cluster-first reading.
  - **What it fixes (§5.11):** post-recalibration some fights emitted `Zerk@8 → cluster@18 → CS-IV@39`
    while identically-shaped fights emitted `cluster → filler → CS chain`. Both score the same; the
    inconsistency was the bug. Consistency across fights *is* the aesthetic (RULES: anchor the burst
    early, then the lone haste filler, then the Cold-Snap chain).
- **Displayed times are FIRE times, not intents (user-directed — RULES §3).** During the opener cold
  ramp the press boundaries are sparse, so every intent second inside one ramp cast fires at that
  cast's END — a whole band of intents is exactly equivalent, and `slideEarliest` canonicalizes the
  tie to its *earliest* member ("0:04" for a burst that fires at 5.4s — reads as ramp-blind, which
  the engine is not). Rather than re-canonicalizing intents, the schedule table, copy-text, and
  press board all print (and sort/group by) `a.sec = Math.floor(effective fire time)` from `actEff`
  (`scheduleRows`); the intent stays internal. Pressing at the printed second is exact — any press
  inside the band fires at the same boundary. Scoped to the opener ramp only (post-intermission presses stay on the phase exit,
  `dodgeDowntime`'s legible anchor). Runs OUTSIDE the fixpoint so it can't ping-pong with
  `slideEarliest`.
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
  - **Two anchor bases (`A` and `A2`, ~2490).** The raw window second `A` is not always a legal press
    boundary: during the opener ramp the casts are long, so an `A`-anchored candidate fires off-boundary
    and scores *worse* than the incumbent (Hydross: `A=7` costs −0.09 casts vs the incumbent's snapped
    `8`). The pass therefore also sweeps `A2` = the incumbent's **own** boundary-snapped span start (the
    earliest planner press inside the window), so the packed forms are reachable from geometry the
    engine has already proven legal. Not merely cosmetic: `A2` is a **strict** win on `4:00 lust 0:05`
    (+15.08 damage = +0.0067 effective casts).
  - **Canonical-tie adoption (§5.11, ~2530).** Alongside the strict-gain winner the pass remembers the
    **canonical** packed form (`packIn`, biggest-first) when it lands within `TIE_EPS = castVal/1000` of
    the incumbent. With no strict winner the tie form is adopted, so equal-score fights render the same
    shape. `TIE_EPS` sits far below any deliberate sub-cast preference (the `castVal/8` class) and far
    above float noise — the 3:20 shorter-buff-leads order is a *strict* win and is untouched.
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
- **`ck-t5` — Tirisfal 2-piece gear checkbox** → `cfg.t5two`: ×1.2 on Arcane Blast damage only (a `t5`
  factor in `simulate`'s two AB damage sites + both plain-AB normalizations, so single-target output is
  exactly invariant; its whole effect is the AoE exchange rate — RULES §9) and +20% AB mana in the
  per-window chip. Default off; presets don't touch it.
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
  buff-uptime lanes with press ticks. `scheduleRows`/`renderSchedule` build the window table (peak-haste /
  AB-cast / floor also read the deterministic `multNoAti`/`castDn`/`capDn`); rows print, sort, and group by
  the **fire-time second** `a.sec` (see the display bullet in the optimizer section); `btn-copy` emits the
  canonical copy-as-text plan the tests compare (`exact-match.mjs` mirrors the same `a.sec` convention). (The dashed leeway bands that used to overlay the lanes
  are **permanently rejected** — user decision, RULES §14; `leewayZones()` is deleted.)
- **Per-window target mana** (`scheduleRows`, ~2939): each window carries `w.mana` = the AB-spam spend
  over its burst span (`GAME.AB.MANA_FLAT 195 × (1 + 0.75·stacks) + 30% under AP`, per-cast real stacks,
  AoE casts excluded — SOURCES). Shown as the blue `.manatag` chip with a net-of-regen tooltip. Pure
  read over the existing cast list; **mana never feeds the optimizer** (layout-first). Display-only.
- **`pressPlan(run)`** (~3423): builds the press board rows only (one row per macro press moment,
  co-pressed items grouped). The placement-reasoning tags and leeway bands it used to emit are
  **permanently rejected** (user decision — a plateau tie for one press is conditional on every other
  press staying put; RULES §14); rows carry no `.tag`, and the old inference logic lives only in git
  history. Do not restore.

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
  peak-haste/price tags), diffs vs `golden.json` (25 cases: 10 boss + 15 debug). `--update` regenerates.

So "what you click in the tool" and "what the suite locks" are still the same lists — a confirmed
preset (boss or debug) is the exact-match test.
