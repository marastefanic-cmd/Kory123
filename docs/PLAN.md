# PLAN.md — finite-mana / conserve-rotation model (beta), for real stat weights

**Status: next phase (post-/clear). The infinite-mana layout model is DONE and stays the default —
this is a SEPARATE, opt-in engine, not a patch to it.** Read `CLAUDE.md` → `docs/MECHANICS.md` →
`docs/RULES.md` → `docs/EP.md` (esp. "The model's layout EP is an INFINITE-MANA ceiling") → this file →
`docs/TOOLING.md`. Baseline: `cd tests && CHROMIUM=/opt/pw-browsers/chromium node exact-match.mjs`
(expect 23/23 — the infinite-mana engine is untouched by this work).

## Context — why

The current model is **infinite-mana / layout-first** (deliberate, `docs/EP.md`): it maximizes the
cooldown *layout* assuming you can chain-cast. That makes its stat weights an **infinite-mana ceiling**,
and the mana constraint moves the real weights **two ways it can't see** (same coin):
- **Haste is deflated** — when mana binds, `casts = mana_budget / mana_per_cast` (haste-independent);
  haste only pays in the time-limited burn windows. Real Arcane haste ≈ **0.4–0.6**, not the ~1.4 the
  model reports (sim anchors: 0.35 real-mana-OOM ↔ 1.38 infinite; matches generalised Arcane wisdom).
- **Mana/regen stats are inflated** — a mana-managed mage (conserves with Frostbolt filler to never OOM
  = at the mana margin) gets ~**1.5 dmg/mana** (AB-vs-Frostbolt gap), so mp5/spirit/int-pool are real,
  not ~0.

**Goal:** a finite-mana model behind a big input toggle ("infinite mana" default / "finite mana (beta)")
that models the **conserve rotation** and computes the **value of mana** → the *real* gearing stat
weights (turn the `docs/EP.md` guesstimates — Int 0.6–0.9, Crit 0.7–0.85, Haste 0.4–0.6, mp5/spirit
positive — into computed numbers), and optionally an interactive conserve plan.

## Researched mechanics (wowsims `ade9f39`, already pulled — see SOURCES/EP)
- **Frostbolt** (`frostbolt.go`): coef **0.814** (>AB 0.714), base 600–647 (~623), **330 flat mana**,
  **3.0s** cast (→2.5 w/ Imp Frostbolt), **cast-time-limited** (haste pure gain, no GCD floor).
- **Arcane Blast** (`arcane_blast.go`/`arcane_charge.go`): FlatCost **195** × per-stack power-cost
  increase (+75%/stack), fast 1.5s at 3 stacks, GCD-floored under haste. Damage stack-independent.
- **Mana regen**: `SpiritRegenRateCasting += 0.1·ArcaneMeditation` (spirit regen *while casting*), + mp5,
  **Evocation** (`evocation.go`), **Mana-Emerald** gems (`mana_gems.go`); base regen `Spirit·√Int·0.009327`.
- **Intellect** (throughput + mana): Mind Mastery **0.25 SP/int** (5/5), Arcane Mind **×1.15** int (5/5),
  int→crit **0.0125%/int**, int→mana pool. (`talents.go`, `mana.go`.)
- **Conserve rotation** (the user's play): burns (Lust/cooldowns) = AB-spam regardless of mana; filler =
  hold the 3-stack AB debuff with periodic fast ABs + Frostbolt filler to fit the mana budget; Evocate
  in downtime; gems/pots. The burn/conserve switch is **mana-budget driven**.

## Options (decide at kickoff)
- **(A) Full finite-mana engine in the tool** — a mana budget over the timeline + burn/conserve/Evocate
  scheduling *coupled* with cooldown placement (a stateful optimization; effectively a second engine).
  Biggest; only if an interactive in-tool conserve planner is wanted. Behind the beta toggle; the
  infinite-mana path stays default and untouched.
- **(B) Leverage wowsims for the numbers (RECOMMENDED for stat weights).** Build a conserve-rotation APL
  (extend `genapl.mjs` → Frostbolt + a mana/stack-threshold conserve, or use wowsims' native Arcane APL
  with our cooldown schedule pinned), run wowsims' **StatWeights** (or finite-difference the `runner`
  with `--sp/--crit/--haste` + the mana stats) at **real mana**. This uses the sim's validated mana model
  — no reimplementation — and yields real haste/int/mp5/spirit/mana EP. Cross-check vs the corrected
  `docs/EP.md` guesstimates (haste ≈0.5, etc.).
- **(C) Light marginal mana-value calc (analytic).** value-of-mana = the AB-vs-Frostbolt damage/mana gap;
  deflate the infinite-mana haste EP by the mana-limited fight fraction; credit regen stats by (mana
  provided)×(value of mana). Gives corrected weights without a full engine — a good self-contained tool
  feature and a check on (B).

**Lean:** (B) for the authoritative gearing weights + (C) as the analytic cross-check; (A) only if the
user wants the interactive conserve planner. **Never let mana feed back into the infinite-mana layout
model** (layout-first principle, `docs/EP.md`).

## Files
- `tools/genapl.mjs` → a conserve variant (Frostbolt id 27072-era rank + AB-stack/mana threshold), or a
  new `tools/genconserve.mjs`. Runner: a StatWeights mode or reuse the `--sp/--crit/--haste` + add mana
  bonusStats for finite-diff.
- `index.html` **only if (A)**: an "infinite / finite (beta)" toggle + the finite engine, strictly
  parallel to the current scorer (exact-match must stay 23/23 on the infinite path).
- Docs: `docs/EP.md` (replace the real-play guesstimates with computed weights), `docs/TOOLING.md`
  (conserve-APL harness), `docs/RULES.md` (a mana/conserve section), `docs/SOURCES.md` (Frostbolt +
  regen constants), `docs/ROADMAP.md`. Delete this `PLAN.md` when it lands, folding lasting bits into
  ROADMAP.

## Verification
- The conserve-APL sim reproduces the **mana-managed** weights: haste **~0.4–0.6** (not ~1.4), Int
  **0.6–0.9**, Crit ~0.7–0.85, mp5/spirit **positive** — and cross-checks the analytic marginal calc (C).
- **The infinite-mana engine is untouched**: `exact-match.mjs` 23/23, all Boss/Debugging plans identical
  (finite mana is a separate path; it must not move a single golden).
- Trust-anchor the conserve APL (build → sim → sane DPS/mana curve; it should conserve, not OOM, and not
  pure-AB-spam) before trusting its weights.

## Constraints
- Branch `claude/wow-arcane-cooldown-optimizer-vbm3as`; configured author/trailers; no identity/model-id
  in `index.html`; determinism preserved; keep the infinite-mana layout the default; docs current in the
  same commit.
