<!-- ARCHIVED origin narrative — reconstructed from git history (not a recovered artifact).
     Covers the very beginning (first commit 7f6713c, 2026-07-19) through the first formal plan
     (archive/01, 2026-07-21), i.e. the era BEFORE any PLAN.md existed. Plus a findings /
     living-doc evolution timeline. High-level arc + corrections: docs/DIARY.md. -->

# 00 — Genesis: how the Arcane Burn Planner began (2026-07-19 → 07-21)

The numbered plan docs (`01`–`06`) start at the first *big* workstream (07-21). This chapter
reconstructs what came before them — the first idea, the first working tool, and the two days of rapid
iteration that produced the model everything else is built on — from the commit history.

## The first idea (what it was going for)
From the very first commit's README, the vision was already whole and has never really changed:

> *"A single-file web app for TBC Anniversary-realm Arcane mages that finds the optimal way to **overlay
> your on-use / proc haste and spell-power cooldowns over a fight**, and gives you a **second-screen
> schedule to follow during the pull.**"*

The design commitments visible on day one still hold today: **single-file `index.html`, no build, no
network**; the user enters **gear haste + fight length + which cooldowns they have**; the tool returns a
**burn timeline + an activation schedule + a follow-along mode**. And the physics were pinned from the
start — 15.77 rating = 1% haste, `castTime = base/(1+haste)`, rating pooled additively then multiplied by
each %-speed buff, the **1.0s GCD floor at +50% haste**, and Arcane Blast's 3-stack debuff making 3-stack
AB GCD-locked past the floor. The whole project since has been about getting the *optimization over* that
physics right, not the physics themselves.

## The first implementation (7f6713c, 07-19)
1005 lines of single-file HTML + a 72-line README. A working planner: enter the fight, check your
cooldowns, "Find optimal overlay," get a timeline + schedule + a live "cap sheet" + a follow mode with a
playhead and next-up countdown. It was **theory-only** — it scored plans by a hand-rolled model with no
external validation yet (the sim didn't enter the story until day 2).

## Day 1 — rapid iteration (07-19, ~45 commits)
A single long day of building outward and fighting the hard part: **how to rank plans that score equally.**
- **Breadth first:** added ISC/MQG/Power Infusion, a full-duration rule, follow mode, a cap sheet; boss
  presets for the "weekly logs → plan" workflow; the Chaotic Skyfire Diamond crit multiplier (182%);
  grouped cooldowns (your spells / trinkets / raid externals); pinnable buff times; a fight-phase editor
  behind a "Complicated fight" toggle.
- **The tie-break saga (the day's real theme):** "push damage actives late among equal plans" → "anchor
  burst early, un-park nullified haste" → "iterate tie-break passes to a fixed point" → "co-press beats
  earliest" → "overlay-preference tie-breaks." Ranking equal-score plans *legibly and robustly* was the
  first genuinely hard problem, and it churned all day.
- **A conceptual milestone:** *"Surface the objective as effective casts."* The idea that the one thing to
  maximize is **effective ABs cast** — which is still the project's north star — was named here.
- **The boundary-press model:** *"activations fire at real press opportunities"* — presses land on cast
  boundaries, not arbitrary times. A foundational modeling decision.
- **A foreshadowed mistake:** the day ended with *"Model Arcane Blast at steady 3 stacks (drop the ramp)"*
  — treating the opener ramp as second-order. Day 2 and Phase 4 both had to undo this (DIARY corrections).

## Day 2 — the pivot: meet the sim, rebuild the model (07-20, ~9 commits)
The most important day. The tool stopped being theory-only:
1. **"Validate the overlay engine end-to-end against a headless wowsims build"** — first contact with the
   real sim. This is the moment the project got a ground truth.
2. **"Rebuild the scoring model as a continuous cast-rate integral"** — the hand-rolled scorer was thrown
   out and replaced by `simulate()`, the cast-rate-integral model that is *still the engine today*.
3. **"Hold the opener/post-intermission burst for the stack ramp"** — the ramp, dropped on day 1, came
   back (the first reversal). Later made exact in Phase 4.
4. **"Add exact-match regression suite"** — determinism became a *tested* feature: one setup ⇒ one plan,
   locked by golden comparison. Everything after this is gated by it.
5. The burn-timeline redesign (responsive, distinct phases, haste chart).

## Day 3 — grounding in docs + theorycraft (07-21, into the first plan)
- **"Plan for the known kill: drop the variance hedge to a half-cast"** — the objective evolved from
  *expected damage under ±3s kill-time uncertainty* (day 1–2) to **known-kill planning**. A real shift in
  what the tool optimizes for.
- **The docs were born:** `CLAUDE.md` + `docs/` (then `MECHANICS.md`, `SOURCES.md`, `RULES.md`) — the
  "look up + cite, don't re-derive; the count is the objective, the sim calibrates" methodology.
- **"Debugging-presets UI: every golden is a live-computed preset"** — the test set and the UI became one.
- **"Optimizer: sequential buff-into-Lust packing (the search fix)"** — the first major search improvement.
- This flowed straight into the first *formal* plan — the placement/containment workstream
  (`archive/01`) — where the numbered record picks up.

From here the story is the numbered plans (`01`–`06`) and `docs/DIARY.md`'s phase arc.

---

## Findings & living-doc evolution timeline
The living docs (`RULES.md`, `MECHANICS.md`, `ARCHITECTURE.md`, `EP.md`) are kept pruned-to-current, so
their *history* would otherwise vanish. This is the durable summary of what was discovered, established,
or overturned over time — the evolution of the model's knowledge. (Overturned beliefs also appear in the
`DIARY.md` corrections ledger; this table is the fuller "what we learned, when" record.)

| when | finding / change to the model's knowledge | where it lives now |
|------|-------------------------------------------|--------------------|
| 07-19 | Core physics pinned: 15.77 rating/%, `base/(1+haste)`, additive-rating-then-multiplicative-buffs, 1.0s GCD floor at +50%, AB 3-stack GCD-lock. | MECHANICS.md |
| 07-19 | Objective named: **effective ABs cast** is the one maximizable quantity. | MECHANICS.md §4, CLAUDE.md |
| 07-19 | Boundary-press model: activations fire on cast boundaries. | ARCHITECTURE (fire-time display) |
| 07-20 | **Scoring = continuous cast-rate integral** (`simulate()`) — the engine's core, sim-validated. | ARCHITECTURE, MECHANICS |
| 07-20 | The **opener stack ramp matters** (reversed the day-1 "drop the ramp"). | RULES §3 |
| 07-20 | Determinism is a tested feature (exact-match suite). | CLAUDE.md, tests/ |
| 07-21 | Known-kill planning replaces the ±3s variance hedge. | RULES |
| 07-21 | Sequential **buff-into-Lust packing** search fix. | ARCHITECTURE (optimizer) |
| 07-21 | Harness audit: the **APLActionSchedule drop bug** (fixed) + **AP shows 195s in sim, real TBC is 180s** (a wowsims quirk). | TOOLING ★ |
| 07-21 | Ramp-aware **SP-buff shift** onto staggered damage clusters (Vashj 4:05/6:05). | RULES |
| 07-22 | **AoE crit-proc amplification** (Clearcasting → Arcane Potency) modeled + sim-validated. | RULES §9, MECHANICS |
| 07-22 | **EP stat weights**, two independent routes (closed-form partials + wowsims finite-diff), cross-checked. | EP.md |
| 07-22 | Finite-mana layout model **rejected**; layout-first confirmed. Real gearing weights: SP≈Int>Haste>Crit>MP5>Spirit≫Mana. | EP.md, CLAUDE.md |
| 07-23 | **Exact discrete ramp** + basin-stable search; haste-monotonicity certified 0 violations. | RULES §3, ARCHITECTURE |
| 07-23 | Stacking-rule family: **haste-on-haste is multiplicative synergy** (floor decides the split); **SP buffs stretch the haste-stack band** (+84 rating measured). | RULES §7 |
| 07-23 | **Haste-morphology band map** (7 bands h0–300) + CS spending rule (count-maximal chain) + trinket lockout. | RULES §16, §8, §17 |
| 07-23 | Brute-force certification: the search matches exhaustive enumeration across all 6 trinket pairs + the full haste range (~260 rungs, 0 misses). | RULES §16 |
| 07-23 | **AoE phase = burn ×M(N) + exit-re-ramp + SP-dilution** (Phase 5). | RULES §9 |
| 07-23 | Engine → Web Worker + pool + caches (crash fix + speed); displayed times are fire times. | ARCHITECTURE |
| 07-23 | **The model opens COLD — never prepull** (the Phase-6 measurement fix; a prepull is haste-blind and breaks monotonicity). | RULES §3, TOOLING ★★★, CLAUDE.md |
| 07-23 | Cross-val (Phase 6): monoDip=0 everywhere; a set of sub-1% length-robust low/high-haste deficits remain — the acceptance test is OPEN. | PHASE6.md, ACCEPTANCE.md |

_Append to this table as the living docs gain or overturn findings; it is the archive's memory of the
model's evolving knowledge._
