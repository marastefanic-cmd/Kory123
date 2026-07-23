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

**The planner itself is the goal** — a tool that, given what you know and control going into a fight
(fight shape, raid buffs, gear, trinkets, haste level), lays out how to press every on-use cooldown to
**maximize the "effective ABs cast"** and reports that number so you can trust it and act on it. It must
be **trustworthy and generalisable** — correct across *future* phases, trinkets, gear, and spell-haste
levels, not tuned to today's cases.

- **The one maximizable quantity is "effective ABs cast per fight."** An Arcane Blast's *damage* is
  stack-independent, so score each cast by its **multiplier relative to a plain AB** — AP makes a cast
  ≈ ×1.30, spell power adds its coefficient, etc. — and sum that over the fight (a haste buff raises how
  *many* casts you fit; a damage/SP buff raises what each is *worth*). Crit is a constant factor and
  cancels. Every rule below (Lust alignment, haste sequencing, SP-on-fast-casts) is a **consequence** of
  maximizing this single number — none is an axiom. See `docs/MECHANICS.md`.

Additional payoffs the same engine unlocks (nice-to-haves, not the point):
- A **haste-agnostic ideal APL** (cooldown usage that adapts to gear).
- **Setup comparison** — with each setup planned by its *own* ideal cooldown usage, compare their
  effective-AB output to decide *which trinkets/gear to bring* to a fight.
- An **EP / stat-weight calculator** that re-optimizes the plan at each `stat±Δ` (correcting wowsims'
  frozen-rotation EP bias, which undervalues haste once a fixed rotation stops using it well).

## How to run the tests

```
cd tests && CHROMIUM=/opt/pw-browsers/chromium node exact-match.mjs
```
Loads the real `index.html` headless, reads the fight tables from the page (`window.BOSS_PRESETS` — the
real phase encounters — and `window.GOLDEN_PRESETS` — the abstract **Debugging presets**), runs every
one through the actual optimizer, compares the copy-as-text plan to `golden.json` (23 cases). `--update`
regenerates goldens (do this ONLY after an intentional change, and only when each changed plan improves
the effective-ABs count — sim-verified when a blind spot is in play, per the methodology in
`docs/TOOLING.md`). The two preset arrays are defined once in `index.html` (`BOSS_PRESETS` +
`GOLDEN_PRESETS`) and drive both the UI (the "Boss presets" / "Debugging presets" strips) and the suite,
so a preset you confirm in the tool **is** the locked test.

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
- **The model is the objective; the sim calibrates it.** The one number to maximize is **effective
  ABs cast** (`docs/MECHANICS.md §4`), and the planner computes it deterministically from the casts,
  buff windows, and timing it already knows — so **that count is the arbiter for comparing two lines.**
  The tool is, by construction, a maximization function over it. The sim's role is narrower: (1)
  **anchor the physics** — certify the formulas/constants the count is built on (trust-anchor to
  `wowsimcli`, ~0.4% absolute agreement); (2) cover the count's **blind spots** — mana and AoE-phase
  weighting (the stack ramp and AP-timing were blind spots but are CLOSED: the ramp is modeled exactly
  in the count — RULES §3 — and the harness's AP cadence is patched to real-TBC 180s — TOOLING); (3)
  **verify a suspicious or novel finding** before it's locked. It is **not** a routine per-golden gate.
  When a clean cast-count and a sim number disagree with **no blind spot in play**, that's a **sim-setup
  audit trigger**, not a model bug — the sim is rarely *wrong*, we've usually *used it wrong* (the Vashj
  drop bug, the stale unpatched runner, and the AP-195 quirk are the cautionary tales). See the
  methodology in `docs/TOOLING.md`.
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
- `docs/PLAN.md` — the current executable plan, when one is in flight; **absent = no plan in flight**
  (create it before a big multi-step change, delete it once that change lands, folding anything lasting
  into ROADMAP). **Current plan: Phase 5 — cracking AoE phases** (see PLAN.md). Phase 4 is COMPLETE
  (exact discrete ramp + press-snap, basin-stable search, monotonicity certified 0 violations; record in
  ROADMAP). **Permanently REJECTED (user decisions — do not revisit):** the leeway "press anywhere"
  bands and reasoning-tag UI (a plateau tie is conditional on everything else staying put, so the bands
  over-promise; logic deleted from `index.html`); an in-tool "exact mode" (the brute-grid instrument is
  for RESEARCH — generalize its findings into rules, don't ship enumeration); the finite-mana model (too
  many unreliable inputs — the per-window mana-cost chip on the infinite-mana plan is the ceiling of
  mana UX, and it is ramp-aware via the casts board). The haste-graph reference lines stay.
- `docs/SOURCES.md` — where WoW facts come from (TBC is a solved game — look up + cite, don't
  re-derive) and the verified-facts ledger of the constants the model uses.
- `docs/EP.md` — stat weights **two contexts**: the infinite-mana **layout** EP (closed-form model
  partials + wowsims finite-diff on the optimal APL, envelope-theorem argument) AND the finite-mana
  **gearing** EP (wowsims finite-diff on a conserve rotation — the real weights: SP ≈ Int > Haste > Crit >
  MP5 > Spirit ≫ Mana).
