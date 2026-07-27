# docs/archive — deleted phase-plan docs, recovered chronologically

The project's early phases were planned in a single `docs/PLAN.md` that was **rewritten and deleted at
each phase close** (the old "delete PLAN.md once the change lands" workflow). Those plans were lost from
the working tree but live in git history; they're recovered here so the road taken stays **findable**
without spelunking git. Each file is the plan **as written** (intent + rationale at the time) — a
historical snapshot, possibly later revised or reversed. For *outcomes* and *what we got wrong*, read
`docs/DIARY.md`; for the phases still in flight, the top-level `docs/PHASE*.md`.

**Append-only. Do not prune.** When a phase closes, archive its plan doc here (see the policy in
`CLAUDE.md`) rather than deleting it.

`00-genesis.md` is different from the rest: it's a **narrative reconstructed from git history** (not a
recovered artifact), covering the very beginning — the first idea, the first working tool, and the day-1
→ day-3 iteration *before any plan doc existed* — plus a **findings / living-doc evolution timeline** (a
durable summary of what the pruned-to-current living docs learned and overturned over time). Read it
first for the origin story; then `01`–`06` are the recovered per-phase plans.

| # | file | date | phase / workstream | outcome (see DIARY) |
|---|------|------|--------------------|---------------------|
| 00 | `00-genesis.md` | 2026-07-19→21 | origin story + findings timeline (reconstructed from git) | the model everything is built on |
| 01 | `01-placement-containment.md` | 2026-07-21 | placement/containment search fix | landed (3:20 +3.6, 5:00 +2.4) |
| 02 | `02-harness-audit-ramp-SP.md` | 2026-07-21 | wowsims harness audit + ramp-aware SP valuation | landed; found the APLActionSchedule drop bug + AP-180 quirk |
| 03 | `03-finite-mana-REJECTED.md` | 2026-07-22 | proactive finite-mana planner (beta MODE) | **REJECTED** (user) — layout-first; mana chip is the UX ceiling |
| 04 | `04-phase3-raidbuffs-procs.md` | 2026-07-22 | Phase 3 — raid buffs/procs, mana & haste helpers | landed (Drums, PI, Ashtongue, mana chip); leeway bands later rejected |
| 05 | `05-phase4-exact-ramp-robustness.md` | 2026-07-22 | Phase 4 — exact discrete ramp + search robustness | landed; haste-monotonicity certified 0 violations, 25/25 |
| 06 | `06-phase5-aoe.md` | 2026-07-23 | Phase 5 — crack AoE phases | landed (burn ×M(N) + exit-re-ramp + SP-dilution, RULES §9) |
| 07 | `07-phase6-xval-run.md` | 2026-07-23→24 | Phase 6 — haste-adaptation cross-validation (build + first run) | instrument built, measurement fixed (cold open), 36 tables gathered; deficits handed to Phase 7 |

`07` is not a recovered plan like `01`–`06` — it is the phase's own **run doc**, moved here intact when
Phase 7 took over the fixing. It is cited throughout the living docs as **"PHASE6 §x"**; the section
numbers are unchanged, so those citations still resolve. Its still-live content was promoted before the
move: the instrument inventory → `docs/ACCEPTANCE.md`, the rig rebuild → `docs/TOOLING.md`, the
never-prepull rule → `CLAUDE.md`/`TOOLING`/`RULES`.

## `08-phase7-xval-fixes.md` — Phase 7: fix the cross-val deficits (closed 2026-07-27)

The "fix" phase behind Phase 6's measurement. Diagnostic mandate **discharged** (§5.16–§5.18), the
AoE-window press-snap fix **landed** (§5.19–§5.20), the `emit=fire` transcription convention landed
(§5.22), and rounds 6–7 gathered and certified (§5.23–§5.24). Cited across the living docs as
**"PHASE7 §x"**; section numbers unchanged, so those citations still resolve.
⚠ **Gear-A denominated.** Its residual — the two length-persistent kit-columns — was inherited by
Phase 10, which re-measured it on gear B and found the persistence list reproduces **cell for cell**
(PHASE10 §8.22). The reasoning is durable; the numbers are not.

## `09-phase8-b2.md` — Phase 8: the B2 model-vs-sim ranking error (closed 2026-07-26)

Reserved as the highest-effort model work and closed with a **negative result**: the per-window
boundary charge was implemented, audited, gated, **failed its sign gate on 6 of 7 fight lengths**, and
ships **OFF** — changing no plan the tool has ever produced. Its lasting contributions are THE FLOOR
LAW (§11–§13), the two harness input errors it found (`t5two`, effective SP ≈1450 — now
`tools/reference-gear.mjs`), and eight settled findings in §26.1 that must not be re-opened.
⚠ **Gear-A denominated, and B2 itself is NOT solved.** Its target moved ~0.39 pp and changed sign on
gear B (BENCH §3e) before any of it was re-measured.

_(Phase 9 is still in flight at `docs/PHASE9.md`; archive it here when it closes.)_
