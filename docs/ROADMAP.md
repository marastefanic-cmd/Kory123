# ROADMAP.md — status, current work, open questions

## Resuming after a context clear (start here)

1. Read `CLAUDE.md` (auto-loaded) → `docs/MECHANICS.md` → `docs/RULES.md` → this file, then
   `docs/ARCHITECTURE.md` (line ranges) and `docs/TOOLING.md` (how to sim-verify) before touching code.
2. **Next task = one of the SECONDARY FRONTS** (the placement workstream **LANDED** — see the Done entry
   below). Open fronts, in rough priority: the **Icon-count / SP-alignment** sub-cast tie-break (Vashj
   6:30, top task below); **coherent intermission/AoE** downtime-aware placement (RULES §9); then the
   payoffs (haste-agnostic APL → setup comparison → EP calculator, "the goal" section). Each stands or
   falls on its own sim — sim-gate every golden that moves.
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
  table that also feeds the exact-match suite); **sequential buff-into-Lust packing** (below); **the
  placement / containment workstream** (below — 3:20 +3.6, 5:00 +2.4, both sim-gated & re-locked).
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

- **Root cause behind BOTH the 2:15 far-Lust and the Vashj icon calls: the model over-values SP-buff
  *count/uptime* vs *concentration*.** It prefers more SP-buff uses (more casts caught) over fewer uses
  concentrated on the fastest AP+floored casts, where the sim says concentration wins. Nailed down this
  session with controlled sims:
  - 2:15 (Lust @0:25): sim says packed **1 icon on floored Lust+IV** beats **2 icons off-Lust** by
    **+17–50 DPS** — and it holds **with a prestack** (opener at 3 stacks), so it is **not** the ramp;
    the model still ranks burst@0 higher by **+1416** (it credits A's 2nd, non-AP icon's raw casts). So
    a `sameCounts`-relaxing "damage-use-sacrifice pack" would **not** reach it — the model gates it out.
  - Vashj 6:30: same shape (4 icons vs 3-on-IV), +5.4 DPS, model +874 the other way.
  - The per-icon marginal valuation is **sound** (plain-fight test, 1.16 vs 1.20), so the bias is subtle
    — in how the model combines *multiple* uses over floored / AP-overlapped windows. Fixing it is a
    careful **scorer-accuracy** investigation (understand the mechanism first; sim-gate every golden);
    both cases sit **within QTOL**, so it's a model-tie the alignment heuristic should break, not a place
    to hack the SP crediting blind. Only then add 2:15 as a golden. Do NOT rush.
- **Coherent intermission/AoE handling** (`RULES.md` §9): make placement/tie-break passes downtime-aware
  so a window doesn't *usually* begin in a dead zone — as a **strong default, not an invariant** (pressing
  early into downtime can be right when it's the only way to get a cooldown back for a bigger later window;
  the effective-AB count decides). Amplifies the icon tie-break above (intermission ramps make off-haste
  SP-buff windows even weaker).

**Done — the PLACEMENT / containment workstream (this session).** Overlap is interval **containment**,
not start-coincidence (RULES §11, MECHANICS §5 pt 5). Three surgical, sim-gated changes to `optimizeAsync`;
**only the two intended goldens moved** (14 byte-identical), each re-locked on wowsims new ≥ old at var0
**and** var10, seeds 11/19, 250k:
- **`permute` in sequential window-packing (~1948):** sweeps the *order* the haste buffs sequence across
  the window (not just biggest-first). Leading with the shorter buff keeps a tail buff's 2nd cd-tick
  before the kill. **3:20** → `Zerk@0:05` in Lust, `IV@0:15` after, `CS→IV2@3:00` (**+3.6** var10 / +10.7
  var0; golden 2651.1 reproduced exactly).
- **Cold-Snap materiality `csAddsUse` gate (~2157):** CS that only **repositions** the same IV count (vs
  the best no-CS plan) is **free** (sub-cast bar), not held behind the full "≥ one cast" bar — that was
  what vetoed the 3:20 opener. CS that genuinely **adds** an IV keeps the full bar. RULES §8.
- **`spreadLoneHaste` normalizer (~2070):** a *lone* haste use (intersecting no damage/SP buff) is
  position-independent → slides back to its earliest natural cd tick, model-neutral. **5:00** → the free
  CS IV banked at 4:25 spreads to its 3:05 natural tick, re-homing the burst-IV onto 4:05 (**+2.4** var10
  / +11.6 var0; golden 2625.1 reproduced exactly). The naive spread *loses* ~8 DPS (leaves the 4:05
  burst with no IV) — only the lone IV moves; burst-riding IVs stay pinned.
**4:00 W4** was already at its canonical spot (cluster @3:25 co-presses CS→IV+Berserking, an exact sim
tie with 3:20) — untouched, confirming the normalizer is DPS-neutral by construction. See RULES §8/§11,
MECHANICS §5 pt 5, ARCHITECTURE finishing passes.

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

- **FIXED — off-GCD burst now co-pressed on one second (7:20 Window 6: 6:21 → 6:20).** The burst
  emitted IV at `6:20` but Icon/Gem/AP at `6:21`. Diagnosing it split the "cluster" into two cases:
  Icon at 380 vs 381 was an **exact model tie** (Δ ≈ 1e-10 — the back-to-back IV+CS→IV keeps casts
  IV-hasted throughout), but Gem/AP scored **+50 at 381** — *not* a tie. The macro-snap missed all of
  them because `isAnchored(IV@380)` false-negatives when the Cold-Snap chain lets a −1s nudge drop the
  chained IV@400, and the overlap-alignment pass then re-staggered them. **Sim resolved the +50: it is a
  pure model artifact** — full-fight wowsims has all-at-6:20 == gem/AP-at-6:21 to the decimal (2565.8
  var0, 2568.2 var10, seed 11, 250k). Fix: a final `coPressAlign` pass (runs on the returned schedule
  AND the Cold-Snap chain candidates) snaps a damage/SP press onto its nearest earlier haste second
  **within 3s** when the model cost is **≤ ⅛ cast**. The 3s window protects genuine staggers (the 3:20
  gem sits 5s off its IV; the KT Icon-onto-AP slide ~20s off Lust — both untouched, both still green),
  and the sub-cast cap rejects any real trade. Only the 7:20 golden moved; sim-gated free; re-locked.
- **FIXED — the whole placement / containment workstream landed** (3:20 free-CS opener sequencing +3.6,
  5:00 lone-IV spread +2.4, 4:00 W4 confirmed already-canonical). Overlap is interval **containment**, not
  start-coincidence: the planner now (a) treats containment-equivalent placements as ties and picks the
  consistent member (`spreadLoneHaste`), (b) spends a **free** Cold Snap to sequence/spread IVs when it
  gains-or-ties (`csAddsUse` materiality gate), (c) sequences opener haste into Lust via a haste-buff
  **order sweep** (`permute`) instead of stacking it over the floor. Generalised, not per-golden — only
  the two intended goldens moved, both sim-gated new ≥ old (var0 & var10, seeds 11/19). See the **Done**
  entry above, **RULES §8/§11**, **MECHANICS §5 pt 5**, and ARCHITECTURE finishing passes.

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
