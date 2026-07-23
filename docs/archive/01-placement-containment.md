<!-- ARCHIVED phase plan — recovered from git history. Source: docs/PLAN.md @ 707bb54
     2026-07-21 — docs: add PLAN.md — executable plan for the placement workstream
     Historical snapshot of the plan AS WRITTEN (intent + rationale at the time); later
     phases may have revised or reversed it. Outcomes & corrections: docs/DIARY.md. -->

# PLAN.md — next phase: the placement workstream

**Status: NOT STARTED.** This is the executable plan for the immediate next phase, established by the
user's golden audit. The sim evidence lives in `docs/ROADMAP.md` → "Golden-review findings"; this file
is the *how*. Per `CLAUDE.md` ("prune, don't append"), **fold the done parts into ROADMAP/RULES and
delete this file once the workstream lands.**

Read first: `MECHANICS.md` (the cast-rate integral), `RULES.md` (§2 floor, §3 ramp/position, §4 packing,
§7 haste-on-haste), `ARCHITECTURE.md` (pass order + line ranges — re-grep, they drift), `TOOLING.md`
(how to sim-gate). Baseline before touching code: `cd tests && CHROMIUM=/opt/pw-browsers/chromium node
exact-match.mjs` → expect **16/16**.

## The one root

The planner places and compares overlays by **start-second coincidence**, but overlap is **interval
containment**. A shorter buff fully overlaps a longer one for a *range* of starts (a `d`-second buff
inside a `D`-second window is contained for any start in `[Wstart, Wend−d]`), so many placements are
**DPS-equivalent** — yet the planner banks IVs back-to-back at the terminal, stacks opener haste over
the +50% floor, and pins clusters to one second, picking an arbitrary (sometimes worse) member of that
equivalence class. Making the comparison duration-aware yields **both** real gains **and** consistent,
repeatable output. This is a **placement / tie-break** fix — the scorer's SP/haste crediting is sound
(plain-fight tests, RULES/ROADMAP); do **not** hack it.

Sim evidence (wowsims, paired seeds 11/19, var10 unless noted; collision-offset the bundled presses):
- **3:20** — opener `Lust×IV×Zerk = ×1.72 = +72%` overcaps the floor. `Zerk@0:05 + IV@0:15 + CS→IV2@3:00`
  scores **+3.6** over the triple-stack golden.
- **5:00** — spreading IVs to natural cd ticks (`IV2@3:05 + CS→IV@4:05`, rest stays) vs banking them
  back-to-back at the terminal = **+2.4** (IV is ~position-independent, RULES §3 — spreading is
  neutral-to-better and cleaner).
- **4:00 W4** — damage cluster at `3:20` vs `3:25` is an **exact tie** (a 20s Icon over a 40s IV+CS→IV
  span is identical wherever it starts inside it).
- **7:20 W6** — already fixed by `coPressAlign` (the special case that seeded this generalization).

## Part 1 — Containment-overlap normalization  *(consistency; neutral-to-positive)*

Generalize the existing `coPressAlign` finishing pass (today: snaps a damage/SP press onto the nearest
*earlier haste* second within 3s at ≤ `castVal/8` cost) into a principled containment normalizer:

- For each non-pinned buff, compute its **same-quality window**: the maximal interval around its current
  spot over which the buff-state that matters to it (its overlapping haste multiplier / AP / floor
  status) is constant — i.e. the range of starts that keep it containment-equivalent.
- Slide it to the **canonical member** of that range, in priority: co-press the window's haste anchor
  (macro reality) → natural cd tick → earliest. Tie-checked on `robust` within a sub-cast epsilon;
  **sim-gate confirms it's actually free.**
- Keep `coPressAlign`'s guards: the sub-cast cap and the protection of *deliberate* staggers that sit
  **outside** the equivalence range (the 3:20 gem 5s off its IV; the KT Icon-onto-AP slide ~20s off
  Lust genuinely change overlap and must stay). Consider absorbing `coPressAlign` into this pass rather
  than stacking another.
- Code anchors: tie-break helpers `overlapOf`/`anchored`/`joinsRow`/`clipOf` (~1103–1126) and the final
  `coPressAlign` region (~1998). Re-grep.
- **Gate:** 4:00 W4 emits the canonical spot; every golden holds in sim (var10) — this part should be
  DPS-neutral by construction, so any golden it moves must sim within noise.

## Part 2 — Free-Cold-Snap sequencing & spreading  *(real DPS)*

When Cold Snap is available and **not required for the IV count** (a "free" reset — the fight already
fits its IVs on natural cooldown), offer candidates that use it to place IVs *optimally* instead of
leaving them pinned by the terminal constraint:

- **(2a) Spread** banked IVs to their natural cd ticks when neutral-or-better (5:00: `IV2@3:05` natural
  + `CS→IV` on the terminal burst). Accept on `robust ≥ old` (position-independent haste ⇒ this is the
  containment idea applied to whole IVs).
- **(2b) Sequence the opener**: use `CS→IV2` to free the terminal-constrained `IV1` off `0:00` so the
  opener haste **sequences into Lust** (3:20: `Zerk@0:05` inside Lust, `IV@0:15` after it) instead of
  triple-stacking over the floor. Accept on **strict** `robust` gain.
- Implementation: extend the sequential-packing pass (~1920) and/or the Cold-Snap-materiality logic
  (~2040) to generate these CS-decoupled candidates; every candidate `repair`ed, `sameCounts`, clip
  never worse. This is the packing pass finally learning "spend a free CS to sequence," which it can't
  do today.
- **Gate:** 3:20 → the `+3.6` layout; 5:00 → the `+2.4` layout; each sim **≥** old (var0 **and** var10,
  paired seeds); no other golden regresses.

## Validation (non-negotiable)

- For **every** golden whose plan moves: `tools/genapl.mjs` → `runner`, **var0 and var10**, paired seeds
  11 & 19, ≥250k iters, collision offsets (see `TOOLING.md`). Accept the move **only if new ≥ old**.
  Then `exact-match.mjs --update` and eyeball the diff.
- Expected movers: **3:20, 4:00, 5:00**, plus any same-pattern fight (opener haste-stacking / IV
  banking) the change reaches — each stands or falls on its own sim, not by assumption.
- Keep **determinism** (fixed PRNG — no `Date.now`/`Math.random` outside the seed). One setup ⇒ one
  schedule, or the exact-match suite is meaningless.

## Definition of done

- The planner emits the sim-proven layouts: 3:20 (+3.6), 5:00 (+2.4), and the 4:00 W4 canonical spot.
- All goldens green; every one that moved is re-locked on sim evidence (new ≥ old).
- Docs: add the **containment rule** to `RULES.md` (as a consequence of the cast-rate integral — joint
  value depends on window *intersection*, not start-seconds); update `ARCHITECTURE.md` (the new/absorbed
  pass); update `ROADMAP.md` status; **delete this `PLAN.md`** (fold anything lasting into ROADMAP).

## After this — secondary fronts (stay in ROADMAP, do NOT scope-creep here)

- **Icon-count / SP-alignment** tie-break (Vashj 6:30: 3 icons on IV windows beats 4 by +5.4; a sub-cast
  tie the placement heuristic should break — related to Part 1).
- **Intermission / AoE** downtime-aware placement (strong default: no window *begins* in downtime).
- Then the payoffs (`ROADMAP` "goal"): haste-agnostic ideal APL → setup comparison → EP calculator.

## Workflow constraints (from CLAUDE.md)

Branch `claude/wow-arcane-cooldown-optimizer-vbm3as`; commit with the configured author/trailers; never
leak identity or a model id into `index.html` or any pushed artifact; no PR unless asked; **sim before
you freeze** any golden; keep the docs alive in the same commit as the change.
