# CLAUDE.md — Arcane Burn Planner

Read this first. It orients you on the project; the `docs/` files hold the details.

## What this repo is

A single-file, self-contained **TBC 2.4.3 Arcane-mage cooldown-overlay planner**:
`index.html` (open it in a browser — no build, no deps). You enter a fight (length, Bloodlust
timing, intermission/AoE phases) and it computes the **optimal moment to press each on-use
cooldown** (Icy Veins, Arcane Power, Icon of the Silver Crescent, Serpent-Coil gem, Berserking),
plus a burn timeline, a per-window activation schedule, and a copy-as-text plan. Alongside it:
`tests/` — a **deterministic exact-match regression suite** (the planner seeds from a fixed PRNG,
so one setup ⇒ exactly one schedule), each case sim-verified against wowsims.

## The end goal (why this exists)

Three phases, biggest payoff last (see `docs/ROADMAP.md`):
1. **Perfect the planner** so its cooldown plan is optimal at *any* gear/haste level.
2. Use it to generate a **haste-agnostic ideal APL** (cooldown usage that adapts to gear).
3. Build an **EP / stat-weight calculator** that compares gear sets *each with its own ideal APL* —
   correcting wowsims' bias (its EP freezes the rotation across `stat±Δ`, so haste is undervalued
   once the fixed rotation stops using it well).

The planner must be trustworthy before it can drive (2) and (3).

## How to run the tests

```
cd tests && CHROMIUM=/opt/pw-browsers/chromium node exact-match.mjs
```
Loads the real `index.html` headless, reads the fight table from the page (`window.GOLDEN_PRESETS` —
the same **Debugging presets** the tool shows), runs every one through the actual optimizer, compares
the copy-as-text plan to `golden.json`. `--update` regenerates goldens (do this ONLY after an
intentional change, and only when each changed plan sim-verifies ≥ the old — see `docs/TOOLING.md`).
The preset list is defined once in `index.html` (`GOLDEN_PRESETS`) and drives both the UI and the
suite, so a preset you confirm in the tool **is** the locked test.

## `index.html` at a glance

Pure-JS engine (DOM-free through ~line 819), then the optimizer, then DOM/UI. Core pieces:
`simulate()` (the cast-rate-integral scorer) · `repair()` (legalizes a schedule: cooldowns, Cold
Snap, use caps) · `optimizeAsync()` (multi-start search + a stack of finishing passes) ·
`renderTimeline()` (the SVG burn chart). Full internals + current line ranges in
`docs/ARCHITECTURE.md`.

## The rules that make it correct

The planner encodes hard-won, **sim-verified** TBC theorycraft (the GCD floor, buff-into-Lust
packing, when Icy Veins slides out of Lust with gear, Cold-Snap materiality, known-kill planning,
etc.). These are the crown jewels and are easy to get subtly wrong — **read `docs/RULES.md` before
changing the model or the passes**, and keep it updated as the living theorycraft record.

## Working conventions

- **Never leak identity or model identifiers** into `index.html` or anything the user shares
  publicly (it's a shareable artifact): no real names, emails, usernames, repo names, session ids,
  or model ids. The user's Discord handle is the only acceptable attribution.
- **Determinism is a feature.** Any change must keep one-setup-⇒-one-schedule, or the exact-match
  tests become meaningless. Don't add `Date.now()`/`Math.random()` outside the seeded PRNG.
- **Sim before you freeze.** A golden only changes when wowsims (fixed kill, common random numbers,
  ≥100k iters) confirms the new plan ≥ the old. The model is ~0.4%-accurate; trust the sim over the
  model on sub-cast calls. See the collision-offset trap in `docs/TOOLING.md`.
- Commit to the designated feature branch provided at session start; follow the session's configured
  commit author/trailers; don't open a PR unless asked.

## Keep this documentation alive (do this, every session)

These files are the project's memory across context clears — they are only useful if kept **current**.
Treat maintaining them as part of the work, not an afterthought:

- **Update in the same commit as the change.** If you add/refine/overturn a rule → edit
  `docs/RULES.md` (with its sim evidence). If you change the model or pass order → `docs/ARCHITECTURE.md`
  (re-grep the line ranges; they drift). If work lands or priorities move → `docs/ROADMAP.md`. If the
  sim workflow changes → `docs/TOOLING.md`. If the goal or conventions shift → this file.
- **Add or remove docs as the project evolves** — when a new subsystem appears (e.g. the EP
  calculator), give it its own `docs/*.md` and link it below; delete or merge docs that go stale. The
  file list below is not fixed.
- **Prune, don't just append.** When a rule is overturned or a task finishes, edit/remove the old
  text so the docs never describe a state that no longer exists. Stale docs are worse than none.
- Before a big change, re-read the relevant doc; after it, leave the docs describing reality.

## Pointers
- `docs/MECHANICS.md` — **read first.** The verified game formulas (haste, cast time, damage per cast,
  the cast-rate DPS equation) that everything else is derived from.
- `docs/RULES.md` — the theorycraft rules, each with its sim evidence (derived from MECHANICS.md).
- `docs/ARCHITECTURE.md` — `index.html` internals and the optimizer pass order.
- `docs/TOOLING.md` — the wowsims sim harness (how to verify a plan) and its gotchas.
- `docs/ROADMAP.md` — status, current work, and open questions.
- `docs/SOURCES.md` — where WoW facts come from (TBC is a solved game — look up + cite, don't
  re-derive) and the verified-facts ledger of the constants the model uses.
