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

## `10-phase9-performance.md` — Phase 9: optimizer CPU/latency under a byte-identical-plans gate (closed 2026-07-27)

Triggered by *"the tool has gotten a bit slow again"*. Measure-first throughout: a baseline CPU
profile, a call census, a hypothesis table with verdicts, and a refactor catalogue landed
cheapest-and-safest-first. **Four changes landed** (groom early exit, `groupSeeds`, `finishLine`, the
`JSON.stringify` memo key at −14 % CPU) and one was **reverted on a pre-registered rule after measuring
null** — the rung's most useful result. **§5 is the larger contribution and is still live guidance:**
the fast iteration gate (`plan-sweep` + `plan-diff` + `plan-duel`) that replaced "re-run everything
after every edit", cited from CLAUDE.md, `tests/`, and the tools themselves. Cited as **"PHASE9 §x"**;
section numbers unchanged, so those citations still resolve.
⚠ **Closed, not finished.** The unfinished §4 reclaim rungs are inherited by `docs/PHASE11.md` §3.1,
which already claimed them by name — two docs listing the same next step was the drift the archiving
removes. Every rung is blocked on the `index.html` freeze while a cross-val round gathers.

## `11-phase10-gearb-baseline.md` — Phase 10: re-establish the acceptance baseline on GEAR B (closed 2026-07-27)

The phase that existed because the project had **no acceptance reading at all**: the reference
character was re-exported on 07-26 and the whole gear-A corpus archived, so every model-vs-sim number
was denominated in a currency that no longer existed. Round 1 gathered **36 cells (30 class + 6 boss)**
over ~50 CPU-hours and closes **36/36 under one protocol on one engine**, certified by a provenance
gate (`xval-stamp-audit.mjs`) that did not exist when the phase began.

**Verdict: invariant A PASSES (`monoDip = 0.0000%` on all 36); B2 FAILS** — 142 borrowed-win columns
of 345 across 33/36 tables, worst 0.380 %. **ACCEPTANCE NOT PASSING**, on a bar of zero.
★ **The central model result:** the threshold-free persistence test names 3 of 57 kit-columns and its
first two are gear A's entire work list **cell for cell** — so the low-haste basin is a property of
the **model**, not the reference gear — and §8.23/§8.25 diagnose it as **one terminal cast** that the
objective scores as a 0.014 % tie against a sim emphatic at ~13σ (discretizing the scorer is already
falsified). **Debts re-priced (§8.31):** B2 **survives** (banded +0.368 ± 0.020 pp, 5/5 seeds, REAL);
the basin **reproduces** but is misnamed twice over; the KT/AoE cells **do not reproduce**, which
discharges PHASE7 §5.19's standing prediction. Cited as **"PHASE10 §x"**; section numbers unchanged.

⚠ **Two instrument findings it hands on, both found by reading a tool's output rather than its summary
line.** `ripple-audit` **fails two of its own pre-registered self-checks** (P3, P5) — so no ripple
decomposition is quotable on that round — and stamps `mono=0` for FAILURE beside a `vacuous=0` that
means success. And *"the shipped wasm == the native runner"* has always meant **within 0.05 DPS**, not
bit-identity: re-gathering 30 tables on the runner moved six published figures, one of them a
**verdict flip** off a ~1e-6 relative difference. Its §9 absorbs the `PHASE10-RESUME.md` handoff doc,
including the resolved TRINKETS-reorder question and the merge order for the unmerged UI branch.

_(In flight: `docs/PHASE11.md` — the platform phase, its §1.1 findings ledger now fully discharged;
`docs/PHASE12.md` — the next phase's raw material. Archive each here when it closes.)_
