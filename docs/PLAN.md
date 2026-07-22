# PLAN.md — the proactive mana planner (finite-mana MODE, beta toggle)

**Status: next phase.** The finite-mana *stat weights* landed (option B/C — `genconserve.mjs`,
`ep-finite.mjs`, `docs/EP.md`); this is the remaining, user-requested piece: an **in-tool finite-mana
mode** that inputs the raid mana sources and **schedules the conserve rotation** so every cooldown burst
is fuelled and you end near-empty. Start: `CLAUDE.md` → `docs/EP.md` (finite-mana section) → `docs/RULES.md`
→ this file → `docs/ARCHITECTURE.md` → `docs/TOOLING.md`. Baseline: `cd tests && CHROMIUM=/opt/pw-browsers/chromium
node exact-match.mjs` (**23/23 — the infinite-mana engine must stay byte-identical throughout**).

## Hard constraint (user, restated)
**Do NOT touch the working infinite-mana engine.** `simulate` (~586), `optimizeAsync` (~1012),
`renderTimeline` (~2573) and every golden stay **identical** — exact-match 23/23 the whole way. Finite
mana is a **strictly-additive, toggle-gated module**: a big **"Infinite mana (default) / Finite mana
(beta)"** switch in the input section, and **only when Finite is on** do the mana-source inputs (Innervate,
Mana Tide, pot, gem, Evocation, regen, Shadow-Priest) appear and the conserve-placement run. Infinite is
the default; mana **never feeds back into the layout optimizer** (layout-first, `docs/EP.md`).

## Context — what it is
Reframe mana as a **budget over the timeline**: maximise damage s.t. *cumulative spend ≤ cumulative income
at every second*, with the **cooldown-layout burst windows force-fed AB-spam** and **Frostbolt conserve
placed only in the lowest-value seconds** — banking before a burst so it's full, ending ~empty (leftover
mana at the kill = lost damage). Most players conserve *reactively* at OOM; this schedules it *ahead*. The
layout (which cooldown where) is unchanged — it comes from the existing engine; finite mode only decides
**where the Frostbolt filler goes and when to pop the mana cooldowns.**

## The three source types (drives the input design)
- **Levers the planner chooses** (decision vars, not inputs): the AB-vs-Frostbolt mix, and — optionally —
  Evocation / gem / pot *timing* (the planner can suggest, or the user pins them).
- **Pinned externals** (deterministic once pinned, exactly like Bloodlust): **Innervate**, **Mana Tide**,
  **pot**, **Evocation**, **gem charges**, **Shadow-Priest/Vampiric-Touch** uptime. Constants already in
  `docs/SOURCES.md` (JoW 74/hit · Mana Tide 6%/tick×4 · Innervate ×5 spirit 20s · Evocation 15%×4 · VT
  +dps·0.25 mp5 · gem). Add them as pinnable rows next to the existing raid-call pins.
- **Genuinely RNG** (Clearcasting free casts, crit-procs): **averages out** — ~30±5 free casts / ~300-cast
  fight ⇒ **~2–3% budget variance**, smallest on the long fights where planning matters most. So plan the
  **expected** income + a **safety margin**, and the player **reacts to the real mana bar** — the same
  known-kill-plus-react contract the cooldown planner already uses (`RULES §8`). Not false precision.

## Build (phased; each phase keeps exact-match 23/23)
1. **Toggle + finite inputs (UI + state).** Add the mode switch + a finite-only input block (mana pool,
   mp5, spirit, while-casting-regen %, JoW on/off, Mana Tide / Innervate / pot / Evocation / gem / VT as
   pins). Gate visibility + state on the toggle. `applyState`/`readState`/preset shape extend but the
   infinite path ignores them. No scorer change.
2. **Mana-income curve (deterministic JS model).** A pure function `manaIncome(t)` / cumulative `M(t)`
   from the inputs over `buildSegments` (regen while casting incl. the Arcane-Meditation throttle + √int,
   JoW per cast, Mana-Tide ticks, Innervate window, Evocation, gem, pot, VT mp5). Constants from SOURCES;
   AB stacked cost (195·1.75^stacks) and Frostbolt (~272 eff.) as the sinks. This is the model the tool
   owns; the **sim (`genconserve`/`ep-finite`) is its validation oracle**, never a runtime dep.
3. **Budget optimiser → conserve schedule.** Given the layout's burst windows (from the existing engine)
   + `M(t)`: allocate AB vs Frostbolt to maximise damage s.t. running mana ≥ margin at all t, bursts
   force-fed AB, end ~empty. Greedy/LP: total deficit ⇒ #casts to convert to Frostbolt ⇒ place them in
   the lowest-value seconds (no cooldowns, lowest flux), pulling conserve *before* a burst when the running
   constraint needs banking. Deterministic ⇒ one input → one conserve plan (keep exact-match's determinism
   ethos). Optionally suggest Evocation/pot/gem seconds if left unpinned.
4. **Output + viz.** In finite mode only: conserve stretches on the timeline (a Frostbolt band), a mana
   curve overlaid (with the margin), an "end at ~X mana" readout, and conserve/pot/gem/Evocation callouts
   appended to the copy-as-text plan. Infinite mode's output is unchanged.
5. **Validate + docs.** Cross-check the tool's `M(t)` + conserve DPS against the sim harness on 2–3 real
   fights (tool vs `genconserve` within noise); confirm the conserve placement matches hand-analysis;
   `exact-match` 23/23. Update `docs/ARCHITECTURE.md` (the finite module), `docs/RULES.md` (a mana/conserve
   section), `docs/EP.md`, `docs/ROADMAP.md`. Delete this PLAN.md when it lands.

## Verification
- **Infinite engine byte-identical:** exact-match 23/23; every Boss/Debugging plan unchanged; the toggle
  defaults to infinite and infinite output is diff-free.
- **Finite model grounded:** the tool's predicted DPS + mana trajectory on a reference conserve fight
  matches the sim (`genconserve` + the runner mana economy) within ~few %; the value-of-mana implied by
  the tool ≈ the sim's ~2.2 dmg/mana (`mana-value.mjs`).
- **Determinism preserved** (finite path has no `Date.now`/`Math.random`); the conserve plan is one-input-
  ⇒-one-output like the cooldown plan.

## Constraints
- Branch `claude/wow-arcane-cooldown-optimizer-vbm3as`; configured author/trailers; no identity/model-id in
  `index.html`; infinite-mana layout stays the default + untouched; finite mode is separate + opt-in; mana
  never feeds the layout optimizer; docs current in the same commit.
