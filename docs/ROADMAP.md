# ROADMAP.md — status, current work, open questions

## Resuming after a context clear (start here)

1. Read `CLAUDE.md` (auto-loaded) → `docs/MECHANICS.md` → `docs/RULES.md` → this file, then
   `docs/ARCHITECTURE.md` (line ranges) and `docs/TOOLING.md` (how to sim-verify) before touching code.
2. **Next task = "Current top task" below: sequential buff-into-Lust packing (a search fix).** After
   that, Part 2 (intermission invariant), then Part 4 (re-verify + lock goldens, add the 2:15 fight).
3. Baseline check: `cd tests && CHROMIUM=/opt/pw-browsers/chromium node exact-match.mjs` (expect 15/15).
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

- Planner is deterministic, ~0.4%-accurate, with **15 sim-verified golden regression cases** (green).
- Recent landed work: cast-rate-integral scorer; timeline redesign (fluid, distinct phase bands,
  GCD-cap label, area-fill haste curve); spellpower-overlap forward-slide (Icon onto a staggered AP
  cluster); **known-kill planning** (kill window dropped to a half-cast — terminal bursts end at the
  kill; the player reacts to early deaths live); **full docs set** (MECHANICS/RULES/ARCHITECTURE/
  TOOLING/SOURCES/ROADMAP) so `/clear` is safe; **Debugging-presets UI** — every golden is a one-click
  preset that loads the setup and **computes** the plan live, driven off the single `GOLDEN_PRESETS`
  table in `index.html` that also feeds the exact-match suite (no more `cases.json`).

## Current top task — buff-into-Lust sequential packing (a SEARCH fix)

The rule (`docs/RULES.md` §4): pack every buff into the Lust/damage window; haste buffs
**sequentially** (IV then Berserking after IV ends, both inside Lust) so they don't overcap the floor.
Sim-verified: 2:15 **+47 DPS**, KaelThas **+8.5 DPS** over the current output. The model already ranks
the fully-packed layout **highest** — the optimizer just never *generates* it (no cross-key joint
"pull A onto the burst while re-homing B" move; `polish`/Pass-1 are local ±45–90).

Fix shape (planned): add ONE window-packing move that, per burst, pulls each available haste buff onto
the window in sequence and re-homes the displaced one, accepted on a strict robust gain with
`sameCounts` (this auto-enforces the align-vs-twice breakpoint — packing that would cost a 2nd use
fails `sameCounts`). Then **defend** it: make the eviction pass (~1719) and the `nulled` vetoes
(~1598, ~1816) window-aware so an efficiently-packed haste buff isn't treated as "dead" (the packed
win is sub-cast in the model's `QTOL` currency, so aesthetics can otherwise trade it away). Prefer to
**consolidate** redundant passes rather than stack another. Validate: 2:15 → IV@0:25 + Berserking@0:45;
KaelThas → both-in-Lust; every changed golden sims ≥ old; the −0.7 "swap-only" trap does not reappear.

## Also planned

- **Coherent intermission/AoE handling** (`RULES.md` §9): enforce "no buff window begins in downtime"
  as an invariant (in `repair`) + make tie-break passes downtime-aware. Symptom to fix: a 2nd
  (Cold-Snap) IV landing 1s inside an intermission (1:19) instead of the clean post-ramp burst (1:40).
- Add the **2:15** fight as a golden once packing lands; re-verify KaelThas/Vashj/2:15-family goldens
  (they'll legitimately change — better, sim-proven). Adding it = one entry in `GOLDEN_PRESETS`.

**Done:** ~~Boss-preset UI = the golden set~~ — landed. The `GOLDEN_PRESETS` table in `index.html`
drives both the "Debugging presets" strip and the exact-match suite; clicking a preset computes the
plan live and reproduces the golden. New fights are added by editing that one array.

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
