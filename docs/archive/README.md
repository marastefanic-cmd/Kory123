# docs/archive — deleted phase-plan docs, recovered chronologically

The project's early phases were planned in a single `docs/PLAN.md` that was **rewritten and deleted at
each phase close** (the old "delete PLAN.md once the change lands" workflow). Those plans were lost from
the working tree but live in git history; they're recovered here so the road taken stays **findable**
without spelunking git. Each file is the plan **as written** (intent + rationale at the time) — a
historical snapshot, possibly later revised or reversed. For *outcomes* and *what we got wrong*, read
`docs/DIARY.md`; for the work still in flight, the top-level **`docs/ROADMAP.md`** — the live plan
since PHASE13 closed and was archived here (08-04, `18-…`).

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
⚠ **Closed, not finished.** The unfinished §4 reclaim rungs passed to `12-phase11-platform.md` §3.1,
which closed without starting them either — they went to **PHASE13 §5.3 (`18-…` here)** and were REVOKED 08-04 until a real slowness report (`docs/ROADMAP.md` §4). ⛔ If reopened, they need
a **fresh CPU baseline and content re-anchoring** before any rung is priced: Phase 12 rewrote the very
scoring walk that dominates this phase's profile, so the rungs and the method are intact and the prices
are not.

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

⛔ **And its verdict is VOID as a measurement of the model** (Phase 12, the same day): round 1 was
gathered against the rate-integral scorer, press-anchored windows, one snapshot rule and the symmetric
kill taper — all four replaced hours later. The **tables stand** as the evidence trail; the **verdict
does not**. `docs/ACCEPTANCE.md` has no current reading, and re-gathering is now mostly arithmetic.

## `12-phase11-platform.md` — Phase 11: the platform phase, the single-file convention retired (closed 2026-07-27)

Opened by a user directive — *"the 'it's just a single html file' convention is retired; brainstorm
better/faster/both, and mark any bugs caused by single-html-doing-everything"* — and its §1 is that
audit's findings ledger, with one root cause stated once: **code that cannot be imported gets copied,
and copies drift.** Four mechanisms currently re-extract the engine from `index.html`, feeding ~30
consumer files.

**Two of its three tracks landed and the third never started.** ✅ **The §1.1 ledger is DISCHARGED,
8 of 8** — six fixed in passing (including two gates whose failure mode was a *pass*, and a `bench`
flag that had to become a **refusal** because adding the flag alone would have left the failure
silent), and the last two the day PHASE 10's freeze lifted, proved plan-neutral by the engine block
being **byte-identical** rather than by assertion. ✅ **The §1.4 doc sweep landed**, all six items.
✅ **CI came up** — three jobs, two of them carrying the negative control §9 demands.
⛔ **The module split itself (§2), the perf ladder (§3) and the product routes (§4) were never
started**, and neither were the eight §8 user calls, which are still unanswered. All of it, and the
calls verbatim, was inherited by PHASE13 §5/§6 (`18-…` here) and RESOLVED to the status quo 08-04 (`docs/ROADMAP.md` §4).

⚠ **Its own header lied about it for the whole of its life** — *"PLANNED, not started; nothing in
`index.html`, `sim/`, `tools/` or `tests/` has changed"* — while all four had. That is the ledger's own
disease, and the archived doc opens with a banner saying so, so no reader re-does the work.
Cited as **"PHASE11 §x"**; section numbers unchanged. ⚠ Six blocks inside it are bannered false in
place (§3.5's "no CI exists", F9's retired constant pairing, §3.3's rate-integral-era prefix-reuse
design, §3.1's dead line anchors, §5's PHASE10 routing, §1.3's pre-rewrite figures).

## `13-phase12-exact-objective.md` — Phase 12: make the objective EXACT (closed 2026-07-27)

The phase that began when the user read the architecture correctly — *"the model's evaluation HAS to be
deterministic and correct… the mistakes I can see is the search not finding the global optimum of that
number — but the math has to be solid"* — and the math was not. `simulate()` computed the per-cast sum
in its discrete walk and then **ranked on a continuous rate integral instead**, disagreeing with itself
by a **median 0.2114 % of score** against ranking margins of ~0.005–0.07 %: ~30× the effect it was
being asked to resolve, and plan-dependent, so it did not cancel. **It *was* the near-tie.**

**Four scoring defects, one transcription defect, and the cast lattice — all closed.** The integral
retired to a diagnostic; buff windows re-anchored from the **fire** rather than the press; **two**
snapshot rules where the engine had one (haste at cast START, value at cast COMPLETION, over
`(start, end]`, both edges measured); and — on a user ruling — the symmetric kill taper replaced by
**one boundary credit at every cut**, `min(1, (nextCut − start)/duration)`, which subsumed the
"intermission wall paid in full" defect for free. Transcription went from `floor(actEff)` to a clamped
schedule value (**7.14 % → 0.00 %** failures on real logs), the lattice closed
(`STACK_CAST_REDUCTION 1/3 → 334 ms` **plus** millisecond rounding), and cooldowns began chaining from
the fire (**HELD 18 → 1 of 196**). `exact-match` **25/25**, `self-consistency` **0.00e+0**.

⚠ **Closed, not finished:** §7's search-optimality proof programme (the objective being exact makes the
per-press decision variable an **integer**, so enumeration and branch-and-bound are well-posed for the
first time) and the acceptance re-gather — both went to PHASE13 (`18-…` here) — the enumeration build was revoked 08-04 (`docs/ROADMAP.md` §4; brute-cell + the audit gates stand instead); the re-gather was voided with the sim. ⚠ The **AoE edge** it left open was
decided immediately afterwards — and then decided **again, the other way, the same day**. It was first
removed from the cut lattice **on physics** (the boss stays targetable and the Blast measurably lands),
then **restored on POLICY** by user ruling: an AoE phase **start IS a cut** because the player *cancels*
the Blast to spam Arcane Explosion, which also truncates the AE lattice to the wall — something this
phase's version never did. ⚠ So the verdict word matches what this phase shipped while the **reason and
the behaviour do not**; read `docs/RULES.md` §9 / PHASE13 §1 (`18-…` here), not this doc, for what holds.
The same correction found that **Arcane Explosion is instant**, so the boundary credit's divide-by-zero
guard had been paying every AE **nothing** — a 42 % error on the only AoE fight in the corpus, reachable
by **no existing gate**.

⚠ **Six of its blocks were live instructions that later sections falsified, and they are bannered in
place** — most dangerously §6.11e's *"`exact-match` WILL FAIL on every case; do NOT `--update`"*, true
for a few hours and false since. Its §6.6/§6.7 mechanism (*"the schedule fires strictly after"*) is
falsified by §6.9a — `IsReady` is `>=`; the sim's boundary was simply 2 ms earlier than its own log
printed it. Cited as **"PHASE12 §x"**; section numbers unchanged. ⚠ **One citation was always wrong:**
the cooldown-chain fix is **§6.14c**, not §3 (§3 is the debts table).

★ **Its durable methodological payload is §6's four instruments that flattered or blinded themselves in
a single phase:** a verdict line branching on half its own pre-registered bar while the table beside it
said otherwise; a classifier that laundered the very defect it was built to catch; a tie rule with a
noise band but no **resolution floor**, turning `+0.00` vs `−0.00` into a winner; and three tools whose
engine defaulted to a stale blob, reporting a byte-identical "no change" across two consecutive fixes.
**Read a tool's output, not its verdict line.**

---

## `14`–`17` — THE SIM DOCS, archived 2026-07-30 when the simulator was RETIRED

These four are not phase docs. They are the **living docs of a subsystem that no longer exists**, moved
here whole rather than deleted, because the project's rule is that living docs must never describe a
state that is gone while the *reasoning* is never thrown away.

| file | was | why it is here |
|---|---|---|
| `14-sim-bench-practice.md` | `docs/BENCH.md` | the standing sim practice + `tools/bench.mjs` |
| `15-sim-gear-agnostic.md` | `docs/GEAR-AGNOSTIC.md` | how the project simmed: one synthetic character from the planner's own inputs, no gear file ever again |
| `16-sim-tooling.md` | `docs/TOOLING.md` | the wowsims harness and its gotchas |
| `17-sim-acceptance-xval.md` | `docs/ACCEPTANCE.md` | the cross-val completion test |

**User decision (07-30):** *"I actually want you to retire the simming, it's doing more harm than good.
I think we have the function/equation locked down and from now on we're better off on our own."* Deleted
with them: `sim/`, `tools/bench.mjs`, `genapl*`, the runner patches, the whole `xval-*` family, the sim
tests, the in-page "Check in benchmark sim" button, and two of CI's three jobs.

⚠ **Every command in all four is dead.** They open with a banner saying so. ⚠ **`17` had NO CURRENT
READING even before this** — every round in it was gathered against a scorer Phase 12 replaced, so its
verdicts already graded an engine that did not exist.

★ **What the sim was actually for, and what replaced it.** Its stated job was *"to FALSIFY THE SEARCH,
not to arbitrate the scorer"* — and that job is now done better and instantly by **brute-forcing a
cell's neighbourhood** (§8s found a 0.1022-cast miss that way in seconds, where a sim duel would have
resolved ~0.02 casts at best against its own seed noise). Ground truth is `docs/ESTABLISHED-FACTS.md`'s
closed forms, checked by `tools/law-check.mjs`, plus the seven declared layouts. The one thing genuinely
lost is coverage of the model's blind spots — **mana and AoE weighting** — which nothing now measures;
that is a known, accepted gap, not an oversight.

## `18-phase13-post-exact-objective.md` — Phase 13: the open work after the objective went exact (closed 2026-08-04)

The last numbered phase doc, and the first to close into a world with no successor phase doc:
**everything it left open was closed out later the same day — done or revoked (`docs/ROADMAP.md` §4)**; the rulings that remain are `docs/DECISION-PACKAGES.md`'s. What closed it: §1 landed 07-27 (the
AoE-edge cut, by policy); §2/§4 voided with the sim; §3.1–§3.3 closed 07-28 (the two-regime tail +
entrant floor); **§3.9 closed 08-04 by re-measurement** (the IV-before-Lust wrong-sign preference
inverted with §8h/§8q); §5.2 closed 08-03 (`cfg-contract --strict` blocking in CI); §5.5 closed
08-04 (the `plan-stability` and `pool-equiv` CI gates, each with a negative control); §5.7 re-cut
and acted on 08-04 (the unrunnable ripple chain and the ladders orphans deleted, the `ALL_BUFFS`
copies converged, the deleted-gate citations marked). Its closure banner maps every section.
⚠ Bannered-false blocks inside: the §9 *"never rank on the rate integral"* line (overturned 07-30 —
the integral RANKS; the per-cast sum reports) and the §7 press-second item (proposes the fire-time
display the 07-30 press-time ruling overturned). Citations as **"PHASE13 §x"** resolve here;
section numbers are unchanged.

## `19-roadmap-record-through-0804.md` — the ROADMAP as it stood when the slate was cleaned (archived 2026-08-04)

The full pre-08-04 ROADMAP, verbatim under a banner: the phase histories, done-ledgers, session
narratives and every measurement they cite. Archived when the user directed *"nothing folded,
nothing unfinished — keep going until the items are either done or revoked, then archive the docs"*:
every open item in it was closed that day (the closure map is the new lean `docs/ROADMAP.md` §4 and
`docs/DIARY.md`'s 08-04 entries; the rulings that remain are `docs/DECISION-PACKAGES.md`'s).

---

_(No plan doc is in flight: **`docs/ROADMAP.md`** is the live plan — lean since 08-04. If a future
phase opens its own doc, archive it here when it closes.)_
