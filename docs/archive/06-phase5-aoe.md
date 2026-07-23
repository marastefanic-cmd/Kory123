<!-- ARCHIVED phase plan — recovered from git history. Source: docs/PLAN.md @ ee6d066
     2026-07-23 — plan: Phase 5 executable plan — crack AoE phases (self-contained for a fresh context)
     Historical snapshot of the plan AS WRITTEN (intent + rationale at the time); later
     phases may have revised or reversed it. Outcomes & corrections: docs/DIARY.md. -->

# PLAN.md — Phase 5: crack AoE phases (or prove they're just a phase modifier)

**Status: PLANNED and user-approved — execute this top to bottom.** Written to be executable from a
fresh context: read CLAUDE.md first, then this file, then RULES §9/§16 and TOOLING as referenced.

## The question

Is an AoE phase fully captured as a **per-cast damage modifier on the phase** (Arcane Explosion spam =
same interval physics as 3-stack AB, damage × `M(N)`), or does it change PLACEMENT structure in ways the
model/rules miss? Settle it the Phase-4 way: exhaustive enumeration on small fights → generalize the
pattern → sim-gate every novel finding → solidify RULES §9. The user's framing: "understanding and
cracking AoE phases is the next part, if it can't just be computed as a modifier to the phase."

## Known facts (do NOT re-derive; sources in RULES §9, TOOLING, SOURCES)

- AE constants exact vs source (`arcane_explosion.go`, 27082): avg 392 base, coef 0.214, instant,
  GCD-bound, full per-target damage; 6-target AE cast ≈ 2.25× an AB cast.
- AE interval = `max(1.0, 1.5/m)` — IDENTICAL to 3-stack AB. The rate side of AoE is nothing new.
- Super-linearity in N modeled: `aoeCritAmp` (Clearcasting→Potency), conservative ~75–80% of measured.
- AE neither builds nor refreshes AB stacks → an AoE run ≥ 8s ends in a re-ramp (modeled exactly since
  Phase 4·B: discrete ramp casts + press-snap).
- AP over AoE ≈ ×1.30, IV over AoE ≈ ×1.18–1.20 (sim-verified); KT's double-IV-over-AoE is sim-supported.
- The model scores AoE via `simulate`'s `isAoe` branch: `dmg = (392 + 0.214·sp) · targets · critF ·
  dmgMult · aoeCritAmp(targets, crit)`; segments come from `buildSegments` (type "aoe", `targets`).

## Rig prerequisites (a fresh container may have lost the scratchpad)

1. The sim rig MUST be the fixed one: wowsims clone @ ade9f39 + `apl-schedule-strict-ready.patch` +
   `ap-cd-at-cast.patch` (both in `tools/wowsims-patches/`), runner rebuilt per TOOLING ("Building the
   runner" + "RUNNER PROVENANCE"). Verify before ANY gate: `grep -c innerSpell
   sim/core/apl_actions_timing.go` = 3 and no `CD.Use` in `sim/mage/arcane_power.go`; sanity:
   AP@[0,180] both fire.
2. The user's gear export json is user-provided (ask if missing; never commit it).
3. Headless model runs need only `index.html` + `tests/node_modules` (playwright-core symlink — see
   tests/README if the symlink is dead).

## Execution steps

### 1. Extend `tools/brute-grid.mjs` with segments
Add an optional AoE window to the enumerated fight: cfg gets
`segments: buildSegments([{from: A, to: B, type: "aoe", targets: N}], T)`. Parameterize via argv or a
small spec constant: default fight **T=80, Lust@20 [20,60], AoE [40,60] × N** (AoE overlapping Lust's
second half) and a second shape **AoE [60,80] × N** (AoE after Lust). Keep the full 5s grid (no staging
— ~11μs/cell, <1 min per point) and the top-5-distinct report (the plateau, not just the winner).

### 2. The morphology sweep
Sweep **N ∈ {2, 4, 6, 10} × haste ∈ {0, 150, 250}** on both fight shapes. Questions the output answers:
- Where does the damage cluster (Icon/gem/AP) sit as N rises — Lust, the AoE window, or a bridge?
  Find the **N-threshold** where it abandons Lust for AoE (predict first via flux: cluster moves when
  `M(N) × AoE-window rate` beats the Lust-window flux; `M(N) = [(392+0.214·sp)·N·amp(N)] /
  (720+0.714·sp)`; at sp=1387 M(6) ≈ 2.25 — so the threshold is likely BELOW N=2… verify, don't assume).
- Do the haste buffs follow the cluster (only via §7 coupling) or stay on their own logic?
- Does CS-IV chase the AoE window (§8's chase-the-uncovered-window rule generalized)?
- Zerk/IV stacking bands during AoE — same §7 crossovers or shifted (instants have no cast>gcd regime)?

### 3. The modifier verdict
Re-run the same sweeps with the AoE window replaced by a **burn phase** `mult = M(N)` (compute M(N) with
the amp folded in). If the optimal layouts coincide at every (N, haste) point → **AoE = burn × M(N) +
exit-ramp, verdict: pure modifier** and §9 collapses to one line. Where they DIVERGE, the difference IS
the finding — characterize it (expected divergence sources: the exit re-ramp ≥8s, ATI per-target procs,
`aoeCritAmp`'s crit-dependence, mana — out of scope).

### 4. Sim-gate the novel classes
Whatever new layout classes appear (cluster-on-AoE, AoE-bridges, CS-to-AoE): gate each class on the
fixed rig — `tools/genae.mjs` builds AE-spam APLs, `runner --targets N` sets the encounter. Protocol:
var0 AND var10, 150–300k iters, paired seeds, count-preserving A/Bs where possible; remember the var10
late-window clip trap and the BL-via-APL lateness (TOOLING). AE damage should also be spot-anchored once:
model M(N) vs sim per-cast ratio at N=2/6/10.

### 5. KT re-certification
Kael'thas is the only AoE boss golden and its historical gates predate the fixed rig. Re-gate its plan's
load-bearing choices (double-IV-over-AoE; the 1:45 cluster) with --targets isolation. If the model wants
a different KT plan under scrutiny, it must beat the old one in the sim (var0+var10) before --update.

### 6. Solidify + close
- RULES §9 rewritten as the verdict + the N-threshold bands + sim evidence (the Phase-4 §7/§16 style).
- ROADMAP: Phase 5 record. exact-match: expect 25/25 untouched unless KT moves (sim-gated only).
- Delete this PLAN.md when done (fold into ROADMAP). Commit per CLAUDE.md conventions (branch
  `claude/wow-arcane-cooldown-optimizer-vbm3as`, the session's trailers, no model ids in artifacts).

## Guardrails

Determinism (seeded PRNG only); scorer physics untouched unless a verified blind spot demands a change
(then Phase-4·B style: physics-first, sim-gated, haste-invariants re-verified); exact-match 25/25 at
every commit; docs updated in the same commit as the change they describe.

## Standing user decisions (do not revisit — full list in CLAUDE.md)

No leeway/reasoning UI (permanently rejected); no in-tool exact mode (brute-grid = research instrument);
mana stays layout-first (the ramp-aware per-window cost chip is the ceiling); the tool's plans are
consumed as-is — rules get generalized in docs, not new UI.
