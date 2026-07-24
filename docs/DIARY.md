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
next (fix) phase. Full detail in `docs/archive/07-phase6-xval-run.md`.

### Phase 7 — FIX the cross-val deficits (2026-07-24 → in flight)
Phase 6 measured; Phase 7 fixes. Each length-robust deficit was first **partitioned** (SEARCH-MISS vs
SCORER-GAP, `tools/diagnose-deficit.mjs`) and then fixed at its root rather than tuned away. The search
misses closed via polished Cold-Snap chain candidates, a drop-one escape pass, and — the structural
answer — **cross-haste pooling**, which makes model-side diagonal dominance (B1) hold *by construction*.
The scorer earned three new real terms (expected-slippage on wall/kill-flush windows, the external
lattice snap, ramp-cast state sampled at cast START). What remains is the B2 family: an emergent
**joint** haste×damage×kill interaction that is CLEAN in every isolated decomposition — handed to
Phase 8. Closing item **§5.11** was a *product* regression, not a DPS one: after the scorer
recalibration some fights rendered equal-score layouts in an order other fights don't use. Fixed with a
resolve-time exact-tie canonicalizer (`canonicalWindowOrder`) — see the ledger row below for what that
cost to learn. Full detail in `docs/PHASE7.md`.

### Phase 8 — the B2 scorer-gap family (2026-07-24 → in flight)
Inherited from Phase 7 as *"an emergent joint haste×damage×kill interaction."* **Round 1 demolished its own
premise**: the decomposition that produced it never placed MQG where it claimed — wowsims silently RETIMED
the press onto a shared trinket lockout and printed a plausible number for a plan never run. The joint
theory was withdrawn, six mechanisms ruled out, and the deficit re-characterised as **catastrophic
cancellation** (two ~2.4pp opposing terms leaving 0.36pp). **Round 2 then demolished round 1's proposed
fix** — measuring at T=40 silently drops a trinket use from one of the two plans, making it a
cooldown-*presence* comparison — and replaced it with **single-buff steady-state marginals swept across
haste**. That instrument immediately paid: **THE FLOOR LAW** (a value window covers exactly `floor(D/Δ)`
casts in the sim; 10/10 with a source-level mechanism proof, both integer crossings captured), a second
harness input error (effective SP ≈1450, not 1387), and — together — a **zeroed mean model-vs-sim bias**
(+0.0895 → +0.0084 pp). The round's most useful output is a **negative** one: the surviving residual's sign
is *wrong* for B2, so "the model misprices SP under haste" is retired as a candidate, and a plausible
denominator lead ("the model fits more casts") closed as a pure start-vs-completion counting convention.
The phase's own guiding lesson is now explicit: **every measurement here has had to be audited as hard as
the model it was auditing.** Detail in `docs/PHASE8.md`.

### Phase 9 — performance, with zero plan drift (2026-07-24 → notes)
User: *"the tool has gotten a bit slow again and takes a lot of CPU."* Opened as a **measure-first**
phase under a hard determinism constraint (every emitted plan must stay byte-identical; exact-match 25
is the gate). Baseline CDP profile + a call census established the shape before any code moved: one
long solve does ~2.0M `repair`s and ~2.0M signature builds against only ~0.6M real simulations, and
~19% of all CPU is **memo bookkeeping rather than simulation**. The structural finding is that the
inner loop walks the same small schedule **five times** (repair · counts · clip · sigOf · simulate)
where one fused walk would do. Notes, hypotheses and landing order in `docs/PHASE9.md`; nothing landed
yet.

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
| 07-24 | Steady-state **press-to-boundary phase-averaging is value-neutral** (§4.3, "documented, accepted, ~0.1%"). | It is neutral only for INTERIOR windows; a window sequenced to end **flush against a wall or the kill** loses the clamped slippage for real (Al'ar stagger: model tie, sim **−0.66% at every kill-variance**). | RULES §3b.1 (expected-slippage term); PHASE7 §5.3. |
| 07-24 | **Raid externals act from their call second** in the scorer. | The aura lands at the call, but the STREAM only accelerates from the next cast boundary (in-flight cast keeps speed) — and near the pull the lattice is deterministic, so the call's phase is not averageable (VR: compressed ramp stranded 1.19s of Lust@10, −0.18%). | RULES §3b.2 (external lattice snap). |
| 07-24 | **IV@0 ramp compression is worth ~+0.16 eff casts** (engine head-to-head, RULES §3). | Never sim-gated; decomposed at Al'ar/VR the sim says compression ≈ **wash** — the re-phased lattice strands the near-pull raid call by what compression gains. | RULES §3b (compression tempered); the engine now weighs both. |
| 07-24 | **Ramp-cast damage samples its buff state around the COMPLETION** (Phase 4). | The completion choice was right for damage *time*, wrong for *state*: a press-snapped ramp-exit window was credited ~half of the cast it fired after; sim/game snapshot at cast START (T=98 h140 pair: model +0.12 vs sim −0.40% → agreement after the fix). | RULES §3b.3; `rampCastDmg(ts, tc)`. |
| 07-24 | **var10 is the cross-val metric** (var0 is the trap, var10 the protocol read). | var10 asks a question the model deliberately doesn't answer (±10s kill hedging → late-window premium, deltas 2–4× inflated); the scorer's `robust` is EXACTLY expected damage under a uniform kill in **T±0.5s** → var0.5 is the model-matched read (the §16 h150 ramp-hug gate flips −0.08%→+0.37% var0→var0.5, matching the model to 0.01%). Fixed **walls** need their own treatment: wall-jitter averaging (no kill-variance smooths wall parity). | TOOLING (metric bullets); ACCEPTANCE protocol; xval `VAR`/`WJITTER`. |
| 07-24 | The cross-val's sub-1% deficits are mostly **quantization to be measured away**. | The §2 diagnostic partitioned all 167: **19 real search misses** (CS-chain geometries, drop-a-use alignment — closed by polished chain candidates + a drop-one pass; every probed miss is also reachable from a neighbor-haste champion), 26 KT measurement-caveat (closed by AE emission), and a small set of REAL scorer terms (above) under the metric artifacts. | PHASE7 §5; tools/diagnose-deficit.mjs. |
| 07-24 | Search misses need per-target anchor surgery (§3a.1) to reach neighbor-haste basins. | A general **cross-haste pooling** wrapper (`optimizeAsync cfg.poolHastes`: emit argmax over the fixed champion set scored at H) makes model-side B1 hold **by construction** — no per-target anchors needed. Design analysis: B1 22→0. End-to-end: scb+mqg medlong 0.20%→**0.01%**. Three correctness invariants earned by debugging (raw-score not re-polish; equal pool `starts`; baseline anchored to `simulate(base.s)` past the Cold-Snap normalize/val mismatch). | ARCHITECTURE (pooling); PHASE7 §5.10; ACCEPTANCE B1. |
| 07-24 | The residual ≥0.3% deficits (e.g. isc+mqg medlong MQG@202-vs-@9, sim +0.46%) are a single crackable scorer term. | Each candidate mechanism is CLEAN in isolation (haste-over-damage 0.000; haste-on-IV model & sim agree; lone-haste early-vs-late a wash both). The deficit is an **emergent joint interaction** (MQG stacked on IV + on the terminal cluster + near the kill, simultaneously) — no single term. Reserved for the highest-effort next phase. | PHASE8 (scoped); `scratchpad/{posindep,iso2,clincher}.mjs`. |
| 07-24 | A legibility canonicalizer belongs **inside `normalize`** (that's where the other placement normalizers live). | Placed there it *lost* 0.0136 eff casts on Hydross: `normalize` runs inside the hop↔normalize fixpoint, whose downstream passes re-drift the rotated layout and re-converge on the old shape. Moved to the three `resolve(...)` sites — the LAST thing to touch a plan — it lands the exact tie (`robust=196077.764863`, bit-identical) with the cluster-first reading. Corollary found the same day: the canonical packed form was **unreachable** from the raw window second `A` (not a legal press boundary during the opener ramp), so the packing pass needed the incumbent's own snapped span start `A2` as a second anchor — which turned out to be a **strict** +0.0067-cast win on `4:00 lust 0:05`, not just a cosmetic reach. | ARCHITECTURE (`canonicalWindowOrder`, packing-pass anchors); PHASE7 §5.11. |
| 07-24 | The tool's CPU cost is dominated by **simulation** (it's a simulator). | Profile + call census: `simulateRaw` is 41.5%, but **~19% is memo bookkeeping** (`sigOf` 12.3% + the wrapper 6.4%) and `repair` another 10.6% — and `Map.get` costs 0.011 µs against 1.158 µs to *build* each key, so the memo's whole overhead is key construction. One solve repairs and signs each schedule ~3.3× per actual simulation. The win is in the plumbing, not the physics. | PHASE9 §1/§3. |
| 07-24 | The sim **seed drives crit rolls and SP-trinket procs** — that's what CRN pairing cancels. | A source enumeration (`tbc-new` @ `ade9f39`, every line re-verified) found **one shared SplitMix64 stream** in production — `RandomFloat(label)` ignores `label` unless `sim.isTest` — consumed **5–6× per AB cast**: a **base-damage roll** (AB is 668–772, not flat), a partial resist (drawn even on a miss; ~13.7% land partials vs the lvl-73 target), a hit roll under a hard **1% miss floor** no hit rating clears, the crit roll, Arcane Concentration, then procs. **The drawn fight length rides the same stream** (`sim.Duration += RandomFloat("sim duration")…`) and is often the largest single variance source. So CRN cancels far more than crit — and *any* press-count change desyncs all of it, which is the real mechanism behind the count-preserving rule. Also: APL evaluation consumes **zero** RNG; player reaction-time jitter is dead code; AoE rolls base damage **once per cast** and shares it across targets. ⚠ `RandomSeed == 0` falls back to wall-clock — never seed 0. | TOOLING "RNG-consumer inventory" + the per-question trust ledger; SOURCES (AB base roll). |
| 07-24 | **Rigid wall-jitter** (shift walls + post-wall presses by one common δ) washes wall parity. | It is a pure TRANSLATION — every segment's internal cast-parity vs its own bounding walls is preserved exactly, so it washes nothing (Vashj still 0.64% under it). The parity is per-SEGMENT whole-cast truncation (proven by a 2-wall minimal pair with per-interval log verification: sim cadence == model cadence exactly; stacked window model +1.65 vs sim +1.04 casts, split +1.48 vs +1.54). The wash must vary SEGMENT LENGTHS: independent per-wall seeded δ_i, presses tracking their segment's wall. The model's continuous credit is the right real-world expectation — no scorer change. | TOOLING wall-jitter bullet (★); xval.mjs jitter v2; PHASE7 §5. |
| 07-24 | The B2 deficit reduces to ONE placement: **moving only MQG@202→@9 captures it, sim +0.461%** — and since each candidate mechanism is clean in isolation, it must be an **emergent joint haste×damage×kill interaction**. | **The measurement never placed MQG at 9.** The h70 layout presses Icon@4, and every on-use offensive trinket shares a category-1141 lockout whose duration is the trinket's own **20s buff** (`shared_utils.go`: `SharedCD.Duration = config.Duration`) — so the sim **silently RETIMED** MQG to **25.64** and printed a plausible number for a plan never tested (`SIMLOG=1` log in TOOLING). The +0.461% was @25.64-vs-@202. The joint-interaction theory built on it is **withdrawn**. | TOOLING ★ (shared trinket lockout); PHASE8 §1. |
| 07-24 | The B2 residual is a ~0.36pp scorer term to be found at the representative target (T=229). | It is **catastrophic cancellation**: the h40 plan is **+7.850%** at T=40 decaying monotonically to **+0.360%** at T=229 — two ~2.4pp opposing components (haste-loaded opener vs h70's last-24s MQG+IV burst). A 4% relative bias in either term *is* the whole answer, which is why every isolated probe "reports clean" — the signal was being measured where it is smallest. **Measure at T=40 instead** (7.85% signal, 0.316pp error, same sign). Also newly ruled out with evidence: `KILL_WINDOW` width (model KW-invariant), GCD floor, boundary straddle, window membership, and press-latency asymmetry (**wrong sign** — a later opener press starts on a higher AB stack, favouring h70). | PHASE8 §2–§4. |
| 07-24 | The model over-credits **Arcane Power by 2.374pp** (implied sim multiplier 1.2407 vs the model's 1.30) — a scorer bug. | Already-known physics + a **mis-configured probe**: Tirisfal 2pc (+20% AB) pools **additively** with AP, so AP is ×1.25 on a T5'd AB stream (SOURCES; TOOLING ★, Phase 5), and an additive base of 1.2465 reproduces the measurement exactly. My probe cfgs simply never set `cfg.t5two`. **The engine is correct** (`t5add` on the AB sites 831/899, correctly absent from the AE sites 829/898). But the same omission is in the **harness** — `xval.mjs:111` / `xval-model.mjs:53` build cfg without `t5two` while the export wears T5 (items 30206/30196/30207) — so the campaign has scored a no-T5 model against a T5 sim. Impact is small on AB-only fights (nearly rank-preserving: B2 delta −0.02%→−0.04%), so gathered rounds stay valid; fix **between** rounds, not mid-round. | TOOLING (⚠ xval `t5two`); PHASE8 §6. |
| 07-24 | The B2 conditioning fix is to **measure at T=40**, where the same layout question shows a +7.850% signal instead of 0.360%. | **Truncating the fight changes the question.** The h70 plan presses `MQG@202`/`IV@202`; at T=40 they never fire, so the delta is h40's full kit vs **h70's kit minus a trinket use** — a cooldown-*presence* comparison, not a layout one. That confound (monotonically weaker as T grows) fully explains the smooth +7.850%→+0.360% decay with no physics. The real conditioning fix is **single-buff steady-state marginals swept across haste** (one buff at t=30, T=100, window fully interior, CRN-paired): the ~1.3% signal is the *whole* quantity rather than a residue of two ~2.4pp terms. | PHASE8 §4 (the round-1 §4 is now the disproof). |
| 07-24 | A value-multiplier window's worth is the model's fractional `D/Δ` casts — the press-phase average makes it unbiased. | **THE FLOOR LAW:** in the sim it is **exactly `floor(D/Δ)`**, verified **10/10** across haste 0→300 *including both integer crossings* (h78→h82 straddles 13.993/14.027 in a 4-rating-point window; h160→h200 straddles 14.686/15.024). Mechanism proved, not fitted: wowsims applies the modifier at **cast COMPLETION** (`sim/core/cast.go:216/258/338/356`) and the APL can only press at a **cast boundary**, so `firstBoostedCast − auraGain == Δ` at all ten hastes (1.500…1.260). The phase-average argument is **conditional on a uniform press phase** — true for a human (off-GCD trinkets/AP are pressable mid-cast), false for the boundary-locked sim, which realises only φ=0, the *minimum*. So it is a harness expressiveness limit first (~+0.036pp), a candidate back-edge model refinement second. **Haste buffs are EXEMPT** (compression rolls to the fight end). Two counting traps found the hard way: timestamp membership in `(gain, fade]` double-counts both edges (floor+1 in 9/10) — count by **CRN damage-difference**; and log-derived Δ quantizes to 0.01s so it cannot resolve a crossing — use analytic `Δ(R)=1.5/(1+R/1577)` (valid: the R=0 log gives exactly 1.5000, so the export's base spell haste is 0%). | TOOLING ★ ("the sim cannot press mid-cast"); PHASE8 §5; RULES §3b-note. |
| 07-24 | RULES §3b.3's mechanism: *"the sim (and game) snapshot a cast's buff state at cast START."* | The **fix** is right, the **mechanism** is wrong — wowsims snapshots at cast **completion**. They coincide at a window's front edge only because the press is boundary-snapped ("completion of the cast in progress" *is* the next cast's start); they **disagree at the back edge**, where a start-snapshot model over-credits the window's unfinished last cast by `frac(D/Δ)×premium`. | RULES §3b.3 (mechanism correction); PHASE8 §5b. |
| 07-24 | Tirisfal-4pc uptime **rises with haste** (more casts ⇒ more crits ⇒ more +70 SP procs), explaining the haste-growing model-vs-sim residual. | **Measured and disproved:** uptime is **88–94% with no haste trend**. The correction is a *flat* one — effective SP ≈ **1450**, not the harness's 1387 (the log states it outright: every AB `[DEBUG]` line reads `SP: 1386.2` or `SP: 1456.2`, an exact +70 from `SpellID: 37444`). A second harness input error alongside `t5two`; fix both between rounds. With floor-law + effSP the mean model-vs-sim bias on a clean single-buff marginal goes **+0.0895 pp → +0.0084 pp** — the model's SP valuation is unbiased once the harness is described correctly. | TOOLING (⚠ effective SP ≈1450); PHASE8 §7. |
| 07-24 | The surviving haste-correlated residual (r≈+0.91, −0.147pp@h0 → +0.103pp@h300) is the B2 mechanism. | **Wrong sign — a falsification.** Positive at high haste means the model *over*-credits an SP window as ambient cast rate rises. In the B2 pair h40 puts **Icon@29 riding MQG+IV** (highest effective haste) while h70 puts **Icon@4 bare** — so correcting it would *lower* h40 and make the model prefer h70 **more**, widening B2. "The model misprices SP under haste" is retired as a B2 candidate. | PHASE8 §8. |
| 07-24 | The model **fits more casts than the sim** (+1 low haste, **+2** high haste) — a denominator effect with exactly the residual's shape. | **A counting convention, closed.** `model == sim completions + 1` at **every** haste, exactly: `index.html:834` counts casts that **START** before `T`, the combat log shows **COMPLETIONS**, and one cast is always in flight at the kill. The apparent haste-growing "+2" was my own regex — wowsims enforces a hard **1% miss floor**, a miss logs as `Miss` not `Hit`/`Crit`, and exactly 1 miss appears from h120 up (~70+ casts). **No score impact**: `castCount` is board/UI only; scoring is the `rateAt` integral. | PHASE8 §9. |

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
- **The xval harness has TWO wrong model inputs.** (a) It omits `cfg.t5two` while the reference export
  wears Tirisfal 2pc — small on AB-only columns (nearly rank-preserving), largest on AoE/KT columns
  (AB-vs-AE ratio off ×1.2). (b) It passes `sp: 1387` where the export's **effective** SP is ≈**1450**
  (Tirisfal 4pc, `SpellID: 37444`, +70 on crit at 88–94% flat-in-haste uptime). Set `t5two: true` **and**
  `sp: 1450` at `xval.mjs:111` + `xval-model.mjs:53` at the START of the next round and re-baseline —
  **never mid-round.** Rank-neutrality on the B2 pair already checked (all variants pick h70), so gathered
  rounds stay valid. PHASE8 §6/§7; TOOLING.

## The planned road ahead (as understood at 07-23)
Per user: **next phase = FIX** the recorded debts (starting with the low-haste basin), **then** likely
**upgrades**, **then another round of the acceptance test** (`docs/ACCEPTANCE.md`), and repeat. Each round
appends here; the phase docs are kept as the detailed per-round record.
