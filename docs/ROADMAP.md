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

## The goal, and the payoffs it unlocks

**The planner is the goal** (see `CLAUDE.md`): a trustworthy, *generalisable* tool that maximizes the
**effective ABs cast** (`MECHANICS §4`) for any setup and reports that number. Every heuristic (Lust
packing, haste sequencing, downtime avoidance) is a *consequence* of that objective, not a hardcoded
rule — keeping that framing is what makes it generalise to future phases/trinkets/gear/haste.

Payoffs the same engine then unlocks (secondary — the planner's correctness comes first):
1. **Haste-agnostic ideal APL** — emit a cooldown plan that adapts per gear set.
2. **Setup comparison** — plan each setup with its *own* ideal cooldown usage, then compare
   effective-AB totals to decide which trinkets/gear to bring.
3. **EP / stat-weight calculator** — finite-difference where each `gear ± Δstat` is re-optimized with
   its own ideal plan (base gear → planner → forced-schedule APL via `tools/genapl.mjs` → sim → DPS;
   then `gear+Δ` → re-run planner → new APL → sim → `Δdps/Δstat`). Corrects wowsims' `statweight.go`,
   which freezes the rotation across perturbations (dragging haste's EP down).

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

## Current top task — Icon-count / SP-alignment (a sub-cast TIE-BREAK, handle carefully)

A spellpower buff wants the **fast** casts (RULES §3/§6), so fewer icons all on haste windows can beat
more icons half on no-haste casts. **Sim-proven on Vashj 6:30:** 3 icons @ 0:00/3:00/6:00 (each on an IV
window) beats the planner's 4 icons @ 0:00/2:00/4:00/6:00 by **+5.4 DPS** (wowsims 250k, var0 **and**
var10, seeds 11/19 identical). So the current `Vashj 6:30` golden is at a **sim-suboptimal** 4-icon plan.
- **Diagnosed (`tests/evalsched.mjs` + controlled sims): this is a sub-cast TIE, not a scorer bug.**
  1. The scorer's SP valuation is **sound in general** — on a *plain* fight a marginal icon is worth
     +10.7 DPS on an IV window vs +9.2 off it, ratio **1.16**, matching the model's predicted 1.20. No
     global over-valuation. And plain 6:30 (no intermissions) still has the sim preferring 3-icon by only
     **+1.5 DPS** (0.06%) — *within* the model's ~0.4% accuracy.
  2. The model scores 4-icon higher by **+874**, but `QTOL` (one cast) ≈ **2242** — so the model treats
     3-icon and 4-icon as a **tie**, lands on 4-icon inside the tie band, and the sim's preference is a
     genuine *sub-cast* refinement (exactly the RULES §10 caveat).
- **So the fix is a conservative TIE-BREAK, not a scorer change:** among plans the model can't tell apart
  (within QTOL), prefer the one that concentrates SP-buff windows on the fastest (haste/AP) casts over the
  one that maximizes SP-buff *count*. Do NOT hack the SP-flux crediting — the plain-fight test shows it's
  sound, and changing it trades the planner's *generalisability* (the actual goal) for a sub-cast win on
  one fight. Sim-gate EVERY golden; a tie-break that shifts a validated plan for < the sim margin is a
  regression. If it proves too destabilizing for a sub-cast payoff, documenting it and moving on is fine.

## Also planned

- **Far-Lust damage-use-sacrifice pack** (RULES §4 known limitation): when nothing sits on a late-early
  Lust (e.g. 2:15 @0:25), packing the burst on costs Icon its cd-second, so `sameCounts` blocks it and
  the plan stays burst-at-pull (**−34 to −50 DPS** vs packed). Needs a pack variant that *drops* a
  damage-buff use to align the first onto Lust. Add 2:15 as a golden once it lands.
- **Coherent intermission/AoE handling** (`RULES.md` §9): make placement/tie-break passes downtime-aware
  so a window doesn't *usually* begin in a dead zone — as a **strong default, not an invariant** (pressing
  early into downtime can be right when it's the only way to get a cooldown back for a bigger later window;
  the effective-AB count decides). Amplifies the icon tie-break above (intermission ramps make off-haste
  SP-buff windows even weaker).

**Done — sequential buff-into-Lust packing (the SEARCH fix).** A window-packing move in `optimizeAsync`
(last structural pass, ~1913) assembles the packed burst at each haste raid-call: damage cluster on the
window, haste buffs on sequential slots (IV @anchor, Berserking @anchor+20), sweeping which IV use lands
on the anchor; kept only on a strict robust gain with `sameCounts`. Fixed `6:00 lust 4:20` (**+8.5 DPS**)
and `5:45 lust 4:20` (**+13.9 var0 / +5.7 var10**), both sim-gated and re-locked; the 12 early-Lust
goldens and the two real boss fights were **untouched** (their bursts were already on Lust). Placing it
last meant no defensive rework of the eviction / `nulled` vetoes was needed (nothing runs after to undo
it). See `docs/ARCHITECTURE.md` and RULES §4.

**Done — theorycraft regrounded on "effective ABs" (this session).** Reframed the docs so every rule is a
*consequence* of maximizing effective ABs cast, not a hardcoded law (`CLAUDE.md` goal, `MECHANICS §4`).
Softened the over-strong absolutes the user flagged: Lust-packing is the usual *method* (§4), not "THE
rule"; the intermission invariant is a strong *default*, not a "never" (§9). And **sim-settled the
haste-on-haste question**: isolated pure-haste Berserking **inside** Lust vs **after** it scores an
identical **2367.4 DPS** (0 gear, var 0, 300k, mana-independent) — a **wash, not a synergy**; the value
of haste-on-Lust is *flux* (speeding damage/SP casts) or banking before an early kill, never the product
(RULES §7, MECHANICS §5.3). The planner already sequences correctly, so no code change — a doc/mental-model
correctness fix in service of generalisability.

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
