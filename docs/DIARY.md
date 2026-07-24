# DIARY — how the Arcane Burn Planner evolved (and where it was wrong)

**This file is append-only history. Do NOT prune it.** The living docs (`RULES.md`, `ARCHITECTURE.md`,
`MECHANICS.md`, `EP.md`) are kept current-to-reality and *are* pruned; the **phase docs** (`PHASE*.md`)
and this diary are the project's **memory of the road taken** — including turns that were later reversed.
A future agent should be able to read this and know *what we tried, when, why we thought it right at the
time, and what disproved it* — so settled mistakes are not re-litigated from scratch.

Dates are commit dates (`git log --date=short`). This is a curated narrative, not the raw log — regenerate
the raw arc anytime with `git log --reverse --pretty=format:'%ad %s' --date=short`.

> **On the open items below:** a documented gap here (e.g. the low-haste basin) is **not** an accepted
> state — it is a *recorded debt to be fixed in a later phase*. See `docs/ACCEPTANCE.md` for the standing
> test the model must pass fully before it is called complete.

---

## The arc, by phase

> **The very beginning** — the first idea, the first working tool (commit `7f6713c`), and the day-1→3
> iteration before any plan doc existed — plus a **findings / living-doc evolution timeline**, is
> reconstructed in `docs/archive/00-genesis.md`. This section is the high-level arc; read 00-genesis for
> the origin narrative.

### Phase 1 — the planner exists (2026-07-19)
Built the single-file `index.html`: enter a fight (length, Lust, phases), get the optimal press time for
each on-use cooldown + a burn timeline + copy-as-text plan. Boss presets, a fight-phase editor, pinnable
buffs, real spell icons. Heavy early iteration on **tie-breaks** (how to rank equal-score plans: anchor
burst early, prefer overlaid/grouped presses, snap clusters). Adversarial review pass. The objective was
surfaced as **"effective casts."**

### Phase 2 — a real scoring model + sim validation (2026-07-20)
Threw out ad-hoc scoring and rebuilt it as a **continuous cast-rate integral** (`simulate()`), the model
that still stands. Validated end-to-end against a **headless wowsims build**. Added the **exact-match
regression suite** (`tests/`, deterministic — one setup ⇒ one plan). Redesigned the burn timeline.

### Phase 3 — theorycraft docs + placement + raid buffs (2026-07-21 → 07-22)
Created the `docs/` set (CLAUDE.md, MECHANICS, SOURCES, RULES). Landed the **buff-into-Lust sequential
packing** search fix and the **containment-overlap** placement rule. Ran a **rigorous wowsims harness
audit** (found the APLActionSchedule drop bug; flagged then resolved the AP-cooldown discrepancy).
Modelled **AoE crit-proc amplification** (Clearcasting → Arcane Potency). Built the **EP stat-weight**
calculator two ways (closed-form model partials + wowsims finite-diff). P3 proper: raid-buff/proc
tightening (Drums, Power Infusion), Ashtongue, per-window mana chip.

### Phase 4 — the ramp, exactly + search robustness (2026-07-22 → 07-23)
Replaced the approximate ramp with an **exact discrete stack ramp**, and made the search **basin-stable**
(hop-normalize fixpoint, cd-tick anchors). **Certified haste-monotonicity: 0 violations, 25/25 goldens.**

### Phase 4.5 — brute-force certification + the haste ladders (2026-07-23)
Built `brute-grid.mjs` (full 5s-grid exhaustive) and `haste-ladder.mjs` (brute marched across gear haste
with breakpoint bisection). Certified the search against exhaustive enumeration across **all six trinket
pairs and the full haste range** (~260 rungs, zero misses). Extracted the **haste-morphology band map**
(RULES §16) and a six-kit "law set," **adversarially corrected** (two drafted laws refuted/fixed).

### Phase 5 — AoE phases cracked (2026-07-23)
Verdict: an AoE phase is a **burn ×M(N) modifier + exit-re-ramp + SP-dilution** (RULES §9), thresholds
sim-gated. COMPLETE.

### Phase 5.5 — the app got heavy; make it fast + honest (2026-07-23)
The single-file app was crashing the browser on long fights. Moved the engine into a **Blob Web Worker**,
then a **worker pool** (byte-identical plans), added a **polish cache** + **simulate() memo** (KT 285s →
84s), an **honest labeled progress bar**, and switched displayed times to **actual fire times**.

### Phase 6 — haste-adaptation cross-validation (2026-07-23 → in flight)
The question: does the planner's *re-optimization as gear-haste changes* hold up in the real sim, end to
end, on random fights it's never seen? Instrument: a **holdout cross-validation matrix** (`xval.mjs`) —
optimize a plan at each haste, sim every plan at every haste, check (a) **haste-monotonicity** (a fixed
plan never sims worse with more haste) and (b) **diagonal dominance** (the plan built for haste H wins its
own column). This became a **standing acceptance test** — see `docs/ACCEPTANCE.md`. Status: measurement
fixed (cold open), campaign gathering, one open debt (a low-haste micro-placement slack) recorded for the
next (fix) phase. Full detail in `docs/PHASE6.md`.

---

## The corrections ledger — what we believed, and what disproved it

The most valuable part of this diary. Each entry: the belief, why we held it, what overturned it, and
where the corrected truth now lives. **Do not silently re-open these** — if you think one is wrong again,
add a *new* entry rather than deleting the old.

| when | we believed… | …until | corrected truth lives in |
|------|--------------|--------|--------------------------|
| 07-19 | Model AB at a **steady 3 stacks** — drop the opener ramp as second-order. | The ramp materially changes opener/post-intermission value; sim disagreed with the flat model. | Rebuilt as the cast-rate integral (07-20) then the **exact discrete ramp** (Phase 4). RULES §3. |
| 07-19→22 | Various **tie-break / "press-anywhere" leeway bands + reasoning tags** would help the user. | A plateau tie is conditional on everything else staying put, so the bands over-promise. **User decision: rejected.** | Deleted from `index.html`; CLAUDE.md "permanently REJECTED" list. |
| 07-21 | The **Vashj icon-count** mismatch (tool plays 4 icons, sim implied fewer) was a model valuation bug. | Audited the sim setup: the **sim was wrong** (a drop bug), the 4-icon model plan was correct. | RULES / PHASE notes; the "sim is rarely wrong, we usually used it wrong" methodology (CLAUDE.md). |
| 07-21 | The APLActionSchedule harness **reliably fired** scheduled presses. | It **dropped on-cooldown presses** — a real harness bug. | `apl-schedule-strict-ready.patch`; TOOLING. |
| 07-21 | AP's cooldown in the sim is **195s** (a real discrepancy vs the 180s source). | It's a **wowsims quirk** (cd measured from buff-end); real TBC is 180s cd-on-activation. | The AP-180 patched runner; TOOLING ★. |
| 07-21 | On the 3:20 fight, **free Cold Snap sequencing was "a wash."** | Re-scored: it's **+3.6 effective casts**, not a wash. | RULES §8 (CS spending rule). |
| 07-22 | A **finite-mana layout model** was worth building (beta MODE, toggle). | Too many unreliable inputs; it doesn't change *layout* ranking. **User decision: rejected**, layout-first. | The per-window mana chip is the mana-UX ceiling; EP.md; CLAUDE.md REJECTED list. |
| 07-23 | The sim's **haste non-monotonicity** (h130=53 casts, h140=52) was **real TBC GCD-floor physics.** | It was the harness **PREPULLING** (a fixed −2.3s cast that doesn't scale with haste) while the model opens COLD. | Cold open (`_prestack:0`); PHASE6 §4.7; the ★★★ never-prepull rule in TOOLING/RULES/CLAUDE. |
| 07-23 | `xval.mjs` should **equip the Mana Emerald (22044)** for the scb kit. | 22044 is a *consumable* — equip the **Serpent-Coil Braid trinket (30720)**, *cast* 22044 to proc it. | PHASE6 §4.6. |
| 07-23 | "deficits **shrink with fight length** ⇒ all boundary quantization, no model error." | True for isc+scb, **false for mqg+skull** (its low-haste deficit is length-independent). | PHASE6 §2.1/§4.5. |
| 07-23 | The low-haste cross-val deficits **are the §4.1 IV-into-Lust basin, sim-confirmed.** | Spot-checking native-vs-borrowed plan diffs showed a **heterogeneous** mechanism (late-cluster spacing, AP timing, Zerk/Lust alignment) — broader than §4.1's specific basin. | PHASE6 §2.1/§4.1/§4.5 (walked back same day). |
| 07-23 | The low-haste deficits are **length-persistent (not boundary quantization)** across kits. | An adversarial re-check of the raw grids showed this is **mqg+skull-ONLY**: `isc+scb` *reverses to CLEAN* medium→medlong (the quantization fingerprint), `isc+mqg`'s low-haste deficit is gone by the long fight. The universal claim was cherry-picked from one kit. | PHASE6 §2.1/§4.5. |
| 07-23 | The campaign's worst deficit (`isc+scb` medium, 0.77%) is a **low-haste (sim20) micro-placement** slack. | Adversary: the tool emits ONE plateau plan across haste 20–245 and **both** endpoint plans beat it (plan@400 wins all 10 columns) — a **whole-band plateau** suboptimality, not a low-haste nudge. | PHASE6 §2.1/§4.5. |

---

## Open debts (recorded, to be FIXED in a later phase — not accepted)
- **The low-haste (≤70) micro-placement slack** (~0.1–0.6% DPS, multi-mechanism). The model sits a hair
  under the sim optimum at low gear haste. §4.1 names one component (the IV-into-Lust straddle basin no
  `basinHop` anchor reaches, fix candidate = a half-into-Lust anchor); the cross-val shows the slack is
  broader. **This is a debt to fix, not a state to accept** (user-directed). PHASE6 §4.1/§4.5.
- **No exhaustive ground truth above ~h150** for the SP-trinket-free kits (the 5s grid can't express the
  off-grid optimum). PHASE6 §4.2.
- **KT AoE simmed as downtime** — genapl needs Arcane-Explosion emission to value KT's AoE window. PHASE6 §7.
- **Ashtongue** is out of the cross-val kits (a random proc, needs different treatment). Phase 7. PHASE6 §4.8.

## The planned road ahead (as understood at 07-23)
Per user: **next phase = FIX** the recorded debts (starting with the low-haste basin), **then** likely
**upgrades**, **then another round of the acceptance test** (`docs/ACCEPTANCE.md`), and repeat. Each round
appends here; the phase docs are kept as the detailed per-round record.
