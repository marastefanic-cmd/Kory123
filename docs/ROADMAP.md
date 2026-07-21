# ROADMAP.md — status, current work, open questions

## Resuming after a context clear (start here)

1. Read `CLAUDE.md` (auto-loaded) → `docs/MECHANICS.md` → `docs/RULES.md` → this file, then
   `docs/ARCHITECTURE.md` (line ranges) and `docs/TOOLING.md` (how to sim-verify) before touching code.
2. **Next task = "Current top task" below.** Sequential buff-into-Lust packing **LANDED** (see Done);
   the open front is now the **Icon-count / SP-alignment** call (sim-proven, below) and the
   intermission invariant.
3. Baseline check: `cd tests && CHROMIUM=/opt/pw-browsers/chromium node exact-match.mjs` (expect 16/16).
4. The sim harness (`runner` binary, gear export, `wowsims/tbc-new` source) persists in the session
   **scratchpad** and survives `/clear` *within the same session* — check it's there before rebuilding
   (`docs/TOOLING.md`); only a brand-new session needs a rebuild. Sim-gate every golden that moves.
5. Constraints (also in `CLAUDE.md`): commit to branch `claude/wow-arcane-cooldown-optimizer-vbm3as`
   with the configured author/trailers; never leak identity or a model id into `index.html` or any
   pushed artifact; no PR unless asked; keep determinism; keep these docs current in the same commit.

## The three-phase arc

1. **Perfect the planner** (in progress) — its cooldown plan must be optimal at *any* gear/haste.
2. **Haste-agnostic ideal APL** — use the planner to emit a cooldown plan that adapts per gear set.
3. **EP / stat-weight calculator** — finite-difference stat weights where each `gear ± Δstat` is
   re-optimized with its *own* ideal plan, so haste isn't undervalued. Method: base gear → planner →
   forced-schedule APL (`tools/genapl.mjs`) → sim → base DPS; then `gear+Δ` → **re-run the planner** →
   new APL → sim → `Δdps/Δstat`, normalized to spell power. This corrects wowsims' `statweight.go`,
   which finite-differences with the **rotation frozen** across perturbations (so a fixed suboptimal
   cooldown plan drags haste's EP down). Phase 1 must be trustworthy first.

## Status (as of the current work)

- Planner is deterministic, ~0.4%-accurate, with **16 sim-verified golden regression cases** (green).
- Recent landed work: cast-rate-integral scorer; timeline redesign; spellpower-overlap forward-slide;
  **known-kill planning** (half-cast kill window); **full docs set** so `/clear` is safe;
  **Debugging-presets UI** (every golden is a live-computed preset off the single `GOLDEN_PRESETS`
  table that also feeds the exact-match suite); **sequential buff-into-Lust packing** (below).
- **Golden set recurated** (this session, user-directed): the two mislabeled plain late-Lust fights are
  now neutral `6:00 lust 4:20` / `5:45 lust 4:20` (kept as clean phase-free packing regressions); the
  **real** encounters were added — `KaelThas 7:00 lust 4:20` (early intermissions + a 6-target AoE +
  a post-Lust intermission) and `Vashj 6:30 lust 5:45` (six intermissions); the `2:40 @150 haste`
  case was **removed** (the IV-slides-out breakpoint isn't pinned yet — don't lock it).

## Current top task — Icon-count / SP-alignment (a SEARCH fix, sim-proven)

The planner presses Icon on **cooldown** (max uptime), but a spellpower buff wants the **fast** casts
(RULES §3): fewer icons all on haste windows can beat more icons half on no-haste casts. **Sim-proven
on Vashj 6:30:** 3 icons @ 0:00/3:00/6:00 (each on an IV window) beats the planner's 4 icons @
0:00/2:00/4:00/6:00 by **+5.4 DPS** (wowsims 250k, var0 **and** var10, seeds 11/19 identical, intermissions
modeled). So the current `Vashj 6:30` golden is locked at a **known-suboptimal** 4-icon plan.
- **Diagnosed: this is a VALUATION issue, not a search miss** (`tests/evalsched.mjs`). The model scores
  the 4-icon plan **higher** (robust 443442 vs 442568, **+874**) — the exact opposite of the sim. It
  over-credits the two extra icons' SP-seconds on the no-haste windows (it counts casts-caught, blind to
  the fact those casts are slow / low-value relative to an IV-window icon). So the optimizer *correctly*
  produces 4 for its scorer; fixing it means devaluing off-haste SP-flux in the scorer — the "floored-
  flux crediting" the Open-questions section flags as risky to touch (it can shift the validated
  goldens). Do it carefully, sim-gate EVERY golden, and don't rush it into the same pass as a search fix.

## Also planned

- **Far-Lust damage-use-sacrifice pack** (RULES §4 known limitation): when nothing sits on a late-early
  Lust (e.g. 2:15 @0:25), packing the burst on costs Icon its cd-second, so `sameCounts` blocks it and
  the plan stays burst-at-pull (**−34 to −50 DPS** vs packed). Needs a pack variant that *drops* a
  damage-buff use to align the first onto Lust. Add 2:15 as a golden once it lands.
- **Coherent intermission/AoE handling** (`RULES.md` §9): enforce "no buff window begins in downtime"
  as an invariant (in `repair`) + make tie-break passes downtime-aware.

**Done — sequential buff-into-Lust packing (the SEARCH fix).** A window-packing move in `optimizeAsync`
(last structural pass, ~1913) assembles the packed burst at each haste raid-call: damage cluster on the
window, haste buffs on sequential slots (IV @anchor, Berserking @anchor+20), sweeping which IV use lands
on the anchor; kept only on a strict robust gain with `sameCounts`. Fixed `6:00 lust 4:20` (**+8.5 DPS**)
and `5:45 lust 4:20` (**+13.9 var0 / +5.7 var10**), both sim-gated and re-locked; the 12 early-Lust
goldens and the two real boss fights were **untouched** (their bursts were already on Lust). Placing it
last meant no defensive rework of the eviction / `nulled` vetoes was needed (nothing runs after to undo
it). See `docs/ARCHITECTURE.md` and RULES §4.

**Done:** ~~Boss-preset UI = the golden set~~ — landed. `GOLDEN_PRESETS` drives both the UI strip and the
exact-match suite; new fights are added by editing that one array.

## Golden-review findings (from the preset walkthrough — sim-verified)

- **BUG — off-GCD damage cluster not co-pressed with its window anchor (fix this).** On 7:20, Window 6
  emits Icon/Gem/AP at `6:21` while IV is at `6:20` (raw intents 381 vs 380). Scoring the cluster at
  380 vs 381 is an **exact model tie** (Δ ≈ 1e-10 — under the back-to-back IV+CS→IV the casts are
  IV-hasted throughout, so the 1s shift is worth nothing). The tie-break is supposed to pull a tied
  cluster onto the anchor (it does in that plan's Window 4 at `200`) but leaves this one at 381. Fix:
  when a bundled off-GCD damage press ties, snap it to the window's IV/anchor second — **but only for
  un-annotated ties**; a *deliberate* stagger that claims a real gain (e.g. the 3:20 Window-2 gem at
  `3:05`, "+565 dmg") must stay. This will re-lock the 7:20 golden (6:21 → 6:20), a free correction.
- **3:20 free-Cold-Snap is correctly unused (no change).** Reviewed the idea "spend the free CS to
  decouple IV2 so IV1 can leave 0:00." Sim (var 10, paired seeds 11/19, 200k): IV1@0:00 = 2651.2,
  IV1@0:10+CS = 2651.1 (**tie**), IV1@0:05+CS = 2645.3 (**−6**). The IV1@0:10 "+12.8" seen at fixed
  length (`var 0`) was a **boundary artifact** — it collapsed under randomized kill. Two lessons
  reaffirmed: (1) IV1@0:00 beats IV1@0:05-fully-in-Lust by ~6 because its first 5s sit *before* Lust,
  unfloored (the floor rule, §RULES 2/7); (2) always confirm a fixed-length gap under `--var 10`. So
  CS has no material use on a short 2-IV fight; the current golden stands.

## Open questions / known limitations

- **Model mis-valuation (documented, not patched):** the scorer ranks the *partial* pack
  (IV-in-lust-alone) above "IV out" (+935 model) though the sim calls it a −0.7 wash — it over-credits
  the damage flux through the floored IV window. It does NOT block the full pack (model ranks full >
  partial), so the search fix renders it inert; touching the floored-flux crediting risks the
  validated goldens. Revisit only if a case needs it.
- **Align-vs-twice breakpoint** should be pinned by sim per fight, not assumed (when does "two
  unaligned uses" beat "one Lust-aligned use"?).
- **KT AoE valuation** (double-IV over the 6-target phase) rests on Arcane-Explosion-vs-Blast
  weighting that plain-AB sims can't confirm — a standing model assumption.
- Sim harness (`runner`, gear export, wowsims source) lives in the ephemeral scratchpad — see
  `docs/TOOLING.md` for rebuild.
