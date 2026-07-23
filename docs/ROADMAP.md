# ROADMAP.md — status, current work, open questions

## Resuming after a context clear (start here)

1. Read `CLAUDE.md` (auto-loaded) → `docs/MECHANICS.md` → `docs/RULES.md` → this file, then
   `docs/ARCHITECTURE.md` (line ranges) and `docs/TOOLING.md` (how to sim-verify) before touching code.
2. **No plan in flight — Phase 5 landed** (`docs/PLAN.md` deleted; see "Phase 5 — AoE phases cracked"
   below for the verdict, thresholds, and gates; Phase 4's record is below it). Earlier history: Phase 3
   = raid-buff/proc tightening + **deterministic mana & haste helpers**, all shipped without touching the
   scorer/optimizer core (exact-match **25/25**): only-raid-pinnable cooldowns, Drums/PI verified +
   sim-source-anchored, Ashtongue → free-leeway "press anywhere" zones, per-window target-mana chip, the
   4×-Frostbolt haste breakpoint on the timeline, and why-here action-plan reasons. The heavy **in-tool
   finite-mana *mode* stays DROPPED** — the finite-mana *stat weights* (`docs/EP.md`) already answer the
   mana question. The **infinite-mana planner is the product**; keep it that way. Also done earlier: verified
   the tool is correct across gear haste (physics trust-anchored at non-zero rating; the "IV slides out of
   Lust" layout, RULES §5, now EMERGES from the packing pass and sim-verifies **+2%** at h250) and that
   haste trinkets place correctly (MQG/Skull avoid the floored Lust, ride a damage burst for flux). See the
   **Done — gear-haste** entry below. Already done and behind all this: the harness audit (W1), drop-bug
   fix (W1.5), ramp-aware SP shift (W2a → Vashj **4:05/6:05**), AP-cd
   **resolved** (real TBC AP = 180s cd-on-activation; sim's 195s is a wowsims quirk — a known blind spot
   for multi-AP timing; SOURCES / TOOLING ★), the **AoE Potency amplification** (modeled + sim-validated),
   **EP** two-route cross-check + `portfolio-ep`, the **Boss presets** (10 real encounters, tested), and
   the **finite-mana stat weights** (`docs/EP.md`: SP≈Int>Haste 0.96>Crit>MP5>Spirit≫Mana — haste is NOT
   folklore-weak). Findings are the authoritative
   reference in `docs/TOOLING.md` — read its **Methodology** section (model = objective/arbiter, sim =
   calibration) and the ★ drop-bug + stats protocol. The intermission re-gate is **done** (KT +
   4:00-multi both re-confirmed ≥ their alternatives on the fixed rig — see Status). The **AoE crit-proc
   amplification** (Clearcasting → Arcane Potency) is now **modeled** (below). **The finite-mana /
   conserve-rotation stat weights are now DONE** (`docs/PLAN.md` deleted; below + `docs/EP.md`): the real
   gearing weights are **computed** via a wowsims finite-difference on a conserve rotation — **SP ≈ Int >
   Haste > Crit > MP5 > Spirit ≫ Mana**. The infinite-mana layout EP is a ceiling; the mana constraint
   **inflates the regen stats** (MP5 0→0.66, Spirit 0→0.54) and **deflates haste, but only to ≈ 0.96**
   (not the folklore 0.4–0.6 — that's the OOM-idle rotation; a Frostbolt-conserving mage never idles).
   **No plan in flight.** **The model / cast-counting was RIGHT on Vashj; the sim was wrong because of the
   drop bug — fix the sim, don't distrust the model.**
3. Baseline check: `cd tests && CHROMIUM=/opt/pw-browsers/chromium node exact-match.mjs` (expect 25/25).
4. The sim harness (`runner` binary, gear export, `wowsims/tbc-new` source) persists in the session
   **scratchpad** and survives `/clear` *within the same session* — check it's there before rebuilding
   (`docs/TOOLING.md`); only a brand-new session needs a rebuild. Sim-gate every golden that moves.
5. Constraints (also in `CLAUDE.md`): commit to branch `claude/wow-arcane-cooldown-optimizer-vbm3as`
   with the configured author/trailers; never leak identity or a model id into `index.html` or any
   pushed artifact; no PR unless asked; keep determinism; keep these docs current in the same commit.

## The goal, and the payoffs it unlocks

**The planner is the goal** (see `CLAUDE.md`): a trustworthy, *generalisable* tool that maximizes the
**effective ABs cast** (`MECHANICS §4`) for any setup and reports that number. Every heuristic (Lust
packing, haste sequencing, downtime avoidance) is a *consequence* of that objective, not a hardcoded
rule — keeping that framing is what makes it generalise to future phases/trinkets/gear/haste.

Payoffs the same engine then unlocks (secondary — the planner's correctness comes first):
1. **Haste-agnostic ideal APL** — emit a cooldown plan that adapts per gear set (the tool already
   re-optimizes per input; this is the live/conditional-APL form).
2. **Setup comparison — NO dedicated feature needed** (user-directed). Run each setup; compare on the
   **absolute** at-kill damage (or the wowsims DPS of each setup's optimal APL), **not** the
   effective-casts count — effective-casts is normalized to *each setup's own* plain AB (it divides out
   flat SP/crit to isolate scheduling), so it's the right *within*-setup objective but hides raw SP/crit
   throughput *across* setups.
3. **EP / stat weights — DONE as two lightweight cross-checking routes** (user-directed; no bespoke
   calculator). The EP is closed-form partials of the effective-damage integral (**model route**,
   `tests/ep-model.mjs`) AND a finite-difference of wowsims on the planner's optimal schedule (**sim
   route**, `tests/ep-sim.sh` + `runner --sp/--crit/--haste`). **Validated** on `6:00 lust 4:20`: crit EP
   **0.697 vs 0.687** (~1.5%), haste EP **1.43–1.47 vs 1.51** (~5%, model lower by the deliberate
   ramp-blindness; the re-opt value moves toward the sim — this setup is on a haste breakpoint). Full
   derivation, envelope-theorem argument, and caveats in **`docs/EP.md`**. **Portfolio EP over a fight
   set** (`tests/portfolio-ep.mjs`): runs the model route over N fights at your real gear and aggregates
   by the **summed weighted absolute derivatives, normalized to SP once** (NOT averaged per-fight EPs —
   that mis-weights short fights). Awaiting the user's 10 phase-fight inputs to produce the phase EP.

## Phase 3 progress (in flight — `docs/PLAN.md`)

- **Task 1 — remove mage-managed-cooldown pinning: DONE.** Only the raid calls (Bloodlust, Drums, Power
  Infusion — `RAID_PINNABLE`) expose a pin control now; every mage cooldown (IV/AP/gem/Zerk/Icon/haste
  trinkets) is the planner's to schedule. `buildBuffList` + `readCfg` both gate on the set (stale
  mage-cooldown times in a saved preset are ignored). Optimizer unchanged, presets pin only bloodlust →
  exact-match unaffected. See ARCHITECTURE "Inputs" note.
- **Task 2 — test + tighten Drums + Power Infusion: DONE (verify + lock; no tighten needed — the model
  was already correct).** Verified deterministically (PI ⊂ BL adds 0 haste, PI-past-BL gains only the tail,
  Drums additive) and at the optimizer level (Tinnitus ≥120s spacing, burst-riding for flux, off-floor
  sequencing at high haste; PI@0's intrinsic BL overlap and Drums-on-near-floored-opener both **proven
  optimal** vs alternatives, not search misses). **The one uncertain mechanic — PI not stacking with BL —
  is sim-source-verified** (wowsims `"MultiplyCastSpeed"` ExclusiveCategory, BL prio 1.3 > PI 1.2; IV uses
  the direct `.AttachMultiplyCastSpeed` so it still stacks). Locked 2 Debugging goldens (`3:20 … drums`,
  `3:20 … PI`); exact-match **25/25** (23 existing byte-identical). No fresh end-to-end APL sim — no blind
  spot on a plain fight, physics anchored (RULES §13, SOURCES, TOOLING).
- **Task 3 — Ashtongue model → LEEWAY ZONES (user-refined): in progress.** Kept ATI **passive** (steady-state
  proc-uptime folded into window haste — real DPS; excluding from scoring rejected). No scheduled press / no
  proc verdict: the scorer averages the proc, and within a true free-leeway interval aligning a press with a
  proc is **never anti-synergous** (user's call), so the honest depiction is just the interval. **Building:**
  `leewayZones` computes, per mobile press, the maximal contiguous interval where moving it ties the champion
  within `QTOL` (position-independent presses only — §3); the timeline draws a **dotted "press anywhere here"
  band** over it; the action-plan Flexible/earliest tag (task 6) reports the same interval. Narrow/sub-cast
  ties are not drawn (§10 tie-break ≠ free leeway). RULES §14. Output-only (timeline + tags) → exact-match
  unaffected.
- **Task 4 — per-window "target mana": DONE.** Each schedule window shows a blue `~N.Nk mana` chip =
  the AB-spam spend over its burst span (195 base × (1 + 0.75·stacks) + 30% under AP, per-cast real
  stacks; AoE casts excluded — SOURCES/wowsims). Tooltip gives casts, the ≈100/s casting-regen offset,
  the net pool-drop to bank, and the gem/Evocation note when it exceeds a pool. Pure read over the
  existing cast list; **mana never feeds the optimizer.** Display-only → exact-match 25/25. ARCHITECTURE.
- **Task 5 — haste breakpoints on the timeline: DONE.** The haste curve now marks two reference lines:
  the existing **+50% GCD cap** (3-stack AB hits the 1.0s floor) and a new **+25% "4× FB"** line — the
  Frostbolt filler soft cap (≈394 gear rating): at +25% passive haste a 2.5s Frostbolt casts in 2.0s, so
  4 fill the 8s AB debuff (filler 3→4). Verified vs Icy-Veins TBC theory + the project's Frostbolt/AB-debuff
  sources (RULES §15, SOURCES). Informational only (the planner never casts Frostbolt) → exact-match 25/25.
- **Task 6 — placement-reasoning action-plan tags: DONE.** `pressPlan` no longer quotes raw damage deltas
  (`deliberate: +N dmg` / `locked here by its cooldown`); every press row now carries a *why-here* reason
  inferred structurally — **Alignment** (press with the raid call / first burst on the Lust window),
  **Flexible** (a `run.leeway` interval → "press anytime X–Y", + the ATI nudge when enabled),
  **Cooldown-timed** (next use ~exactly one cd later), **Cold Snap** (extra IV window), else **Positioned**
  (no slack). Verified across fights (opener, on-Lust-window, CS chains, flexible gem, cooldown-cycled
  bursts). Output-only → exact-match 25/25.
- **Follow-up (user-directed): the haste trend is now proc-free.** The timeline curve + the schedule's
  peak-haste / AB-cast / at-GCD-floor readouts use the **deterministic** haste (`multNoAti`/`capDn`/`castDn`
  — no averaged Ashtongue), and a **second GCD-floor line "cap if Ashtongue"** (≈+40.8%) shows where a live
  proc reaches the cap. ATI stays in the *scored* effective-AB count; this is display-only (RULES §14/§15,
  ARCHITECTURE). exact-match 25/25.
- **Phase 3 is complete** (all 6 tasks + the proc-free-trend follow-up).

## Phase 5 — AoE phases cracked *(COMPLETE — verdict: burn ×M(N) + two corrections; RULES §9)*

The question: is an AoE phase fully a per-cast damage modifier on the phase, or does it change
placement structure? Settled the Phase-4 way — full-5s-grid enumeration (`brute-grid --aoe/--burn`,
two shapes × N∈{2,3,4,6,10} × h∈{0,150,250}) against a burn-×M(N) control, novel classes sim-gated on
the fixed rig. **Verdict: AoE = burn × `M(N)` + exit-re-ramp + SP-dilution** — layouts coincide with
the control at 21/24 points; the divergences ARE the two corrections. All in RULES §9; the scorer was
already exact (no engine change; exact-match 25/25 untouched, KT plan unchanged).
- **Thresholds (h0 reference):** cluster chases the window at M(N)>1 vs co-resident Lust (N*≈2.5),
  M(N)>1.30 vs disjoint Lust (N*≈3.2); SP buffs lag one N-step (`M_sp ≈ 0.30·N·amp`, knife-edge bridge
  at N=4); haste migrates from M(N)>1 (bare window = floor headroom). Flux-predicted BEFORE the grid;
  N=3 confirmed both directions.
- **Gates (all green):** cluster marginal AE-vs-Lust 0.85/1.15/1.77 at N=3/4/6 (var0≡var10); exit-ramp
  retreat +0.497% vs model +0.501% (same-stream CRN); KT double-IV +10.0% both far seeds (model +9.09%);
  AE interval physics multiplicative (log: 1.25/1.136), IV +5.66% vs 5.71%, Zerk stack +0.24% vs +0.30%
  under var10 (var0 = exact-tie quantization trap, TOOLING).
- **Discovery — Tirisfal 2pc ×1.2 on AB + AP additivity in wowsims** (TOOLING ★, SOURCES): per-cast
  anchor decomposed to the digit; thresholds shift ×1.2 on T5 gear (no class flips; KT robust). Two
  open user calls below.
- KT re-certified: the 1:45 cluster (N=6 threshold case) + double-IV-over-AoE both re-gated with
  `--targets` isolation on the fixed rig; the old "standing model assumption" caveat is CLOSED.

## Phase 4 — understand the optimum, then make the search find it *(COMPLETE — monotonicity certified 0 violations)*

Ran as **A → measure → B → C** (the plan that lived in `docs/PLAN.md`):
- **A · exploration harness** (`tools/explore.mjs`) — **DONE.** Brute-scores every placement of a small buff
  set over a gear-haste sweep (no search → exact optimum), the oracle + rule-finder for the rest. Reproduced
  the theorycraft autonomously (RULES §16) and pinned the coupling: **damage buffs place greedily, haste
  buffs carry the breakpoints — but SP buffs SHIFT those breakpoints** (AP moved IV's exit-Lust from
  ~15→~80 rating). Cap thresholds nailed: 243 / 394 / 789.
- **measure — DONE.** The real ramp gaps: (i) damage buffs on a ramp (model tied, sim docked ≤0.4%), and
  (ii) press timing during ramps (sparse deterministic boundaries — phase-averaging invalid there). Haste
  placement stays ramp-indifferent (theorem + sim, 0.00%).
- **B — LANDED, compromise-less** (user-directed). The exact discrete ramp: cold 0-stack opener + post-gap
  re-ramps, true cast lengths on the board (single source of truth), ramp casts scored discretely at their
  completions (jitter-smoothed), press-snap to real ramp boundaries, integral everywhere else. Haste
  indifference preserved exactly; fixed-layout haste sweep still 0 drops. Full physics battery vs the sim in
  RULES §3. **Harness had to be fixed to gate it**: `ap-cd-at-cast.patch` (real AP-180 in the sim) + the
  runner-provenance trap — see TOOLING; two "refutations" turned out to be harness contamination.
- **C — DONE, certified.** `basinHop` (window-teleport self-consistency guard: the champion's window
  blocks re-based on each other's anchors, each track's natural next cd-tick, and the kill anchor,
  re-polished; iterated with the canonicalizers to a **fixpoint** so the returned plan is basin-stable
  AND canonical), a joint window-move in `polish` (co-pressed clusters cross valleys together), a
  kill-anchored seed, a denser shift ladder (±3/±6 ramp-boundary hops, ±30/±60), top-6 final snaps.
  **`tests/monotonicity.mjs`: 0 violations** across both reference fights, haste 0–150 — and the original
  70→71 bug case now yields the identical stable layout with rising effective casts. The test's tolerance
  is the DESIGNED pressability slack (0.15 effective casts = coPressAlign's castVal/8 "execution beats
  microtiming" trade, which varies with haste); the underlying objective is monotone to float precision.
  Two rounds of golden triage under the strengthening search: first 19 improvements / 0 misses, then the
  fixpoint found deeper basins on 18 more (all strict robust gains) — goldens locked at that final level
  (exact-match 25/25). The search never returns worse than any earlier tool version's plan on any preset.
  **Certified against exhaustive enumeration** (user-directed): on the simplest full-fledged fight (T=80,
  Lust@20, six tracks incl. CS-chain, ~131k-cell staged brute force to 1s resolution) the tool's output
  equals the brute optimum **byte-for-byte** (74.118 eff casts; IV@0 → CS-IV@20 + full cluster@20, Zerk@40
  sequential). Without AP the optimum is a two-layout mirror TIE (damage on either Lust half); AP breaks
  the symmetry toward early, and the sim tilts the same way under kill variance (+0.3% var10) — so the
  earliest-canonical choice (`slideEarliest`) is also the sim-preferred one.
  Search cost: ~20–40s per plan headless (basinHop dominates) — optimize later if the UI feels it.
  **Headroom follow-up (backlog, landed):** `basinHop` gained **ramp-exit anchors** (the first full-stack
  cast after each cold start, read off the champion's own board) — the h160-class "hug the ramp exit"
  descent-valley miss is CLOSED (tool 80.659 > the 5s-grid brute's 80.618: the 1s polish around the exact
  exit out-resolves the grid). Remaining known residuals: the h40/h50 **straddle basins** (IV part-way
  into Lust trading overcap for cluster coupling — a lone-track mid-gap basin no anchor reaches),
  ≤0.033 casts, inside the pressability slack; chase only if a real fight ever lands on that edge.

**UI: leeway bands + reasoning tags PERMANENTLY REJECTED (user decision, post-certification).** A plateau
tie for one press is conditional on every other press staying put — moving it shifts other optima — so
"press anywhere from here to here" over-promises and was cut for good; `leewayZones()` deleted from
`index.html` (git history has it; do not restore). Also decided: NO in-tool exact mode (brute-grid is a
research instrument — generalize its findings into rules); NO finite-mana model (unreliable inputs — the
ramp-aware per-window mana-cost chip on the infinite-mana plan is the ceiling of mana UX). The
haste-graph reference lines stay. **Next: Phase 5 — crack AoE phases (docs/PLAN.md).**

## Done — gear-haste + haste-trinket correctness (this session, user-directed)

The user redirected off the in-tool finite-mana idea (dropped) to **verify the planner is correct with
passive gear haste and haste-rating trinkets, and improve it where it isn't.** Findings + the one change:

- **Physics is anchored at non-zero gear haste.** Rating trinkets (Drums 80 / Skull 175 / MQG 330 / ATI
  145-proc) and passive `hasteRating` share **one** path — additive in the `(1 + rating/1577)` factor,
  then × the %-haste buffs (Lust/IV/Berserking), floored by `intervalOf` — the **same formula
  trust-anchored at h0** (runner plain-AB h0 = 2264.9/944.4, exact). So trinket + gear haste is correct by
  construction; a `--haste N` sweep confirms the interval/floor scale as expected.
- **Haste trinkets place correctly.** The model **avoids** stacking MQG/Skull on the floored opener Lust
  (MQG-in-Lust −9.6k vs the model plan) and instead rides MQG on the **2nd damage burst** (speeding its
  SCB/AP casts — flux, MECHANICS §5 pt 2), beating a lone bare-window MQG (+2.4k). No trinket-placement bug.
- **FIX 1 — the "IV slides out of Lust as gear haste grows" layout now EMERGES** (RULES §5, long
  documented as theory, not realized in the search). As passive rating pushes Lust itself near the GCD
  floor, a haste buff stacked ON Lust overcaps (worth ~0) while the DAMAGE cluster still wants Lust's fast
  casts — so the win is **cluster-on-Lust, IV sequenced/stacked just past it.** The sequential
  window-packing pass now generates two **exit** modes (haste after the window: `exitSeq` sequenced on the
  tail, `exitStack` overlapped at the window end to keep each buff's 2nd cd-tick before the kill) in
  addition to the usual `packIn`. Kept only on a strict robust gain, so **inert at h0** (IV-in-Lust wins →
  goldens byte-identical, exact-match **23/23**) and self-selecting above the breakpoint — no per-haste
  rule. Improves the whole high-haste range in model score, monotonic (only adds candidates).
- **FIX 2 — CS materiality by VALUE not COUNT (what closed the last hold-out, the ~h200 band).** At high
  gear haste the CS-champion carries an **incidental** extra IV parked on the near-floored Lust (worth ~0)
  while CS's real job is to slide a *different* IV fully OFF Lust — but the gate counted IVs, saw the count
  rise, applied the full "adds a use" bar, and vetoed the whole cluster-on-Lust layout back to the glued
  no-CS plan. Fix: trim the champ to the no-CS IV count by dropping its **least-valuable** IV; if that
  costs **< a cast**, the extra IV is incidental → CS is really **repositioning** (sub-cast regime) → keep
  it (RULES §8 last bullet, ARCHITECTURE CS-materiality). **Result: cluster-on-Lust is now consistent at
  EVERY gear-haste level** (h50…h300, 4:00: opener isc@5 throughout; no h200 island). **Sim-verified:
  cluster-on-Lust vs glued = +61/+54 DPS at h250, +53/+55 at h200** (var0/var10, 250k — both agree).
  Exact-match **23/23** (h0 goldens unaffected — the trim only fires where the exit layout wins). See
  RULES §5/§8, ARCHITECTURE (packing modes + CS-materiality value gate).

## Done — finite-mana / conserve-rotation stat weights (this session, user-requested)

The real **gearing** stat weights, computed (options **B + C** of the deleted `docs/PLAN.md`; the
infinite-mana layout engine stays default and untouched — exact-match **23/23**). We did **not** build the
in-tool second engine (option A) — the plan gated it on wanting an interactive conserve planner, which
wasn't requested; the deliverable is the *numbers*, cross-validated, + the harness + docs.
- **Harness:** `tools/genconserve.mjs` (conserve APL — AB-spam in burn windows, Frostbolt filler below a
  mana threshold, Evocation, and **`autocastOtherCooldowns`** so Innervate + Mana Tide actually fire), the
  runner extended with **`--int/--spirit/--mp5`** (`tools/wowsims-patches/runner-main.go`),
  `tests/ep-finite.mjs` (sim finite-difference, option B), `tests/mana-value.mjs` (analytic value-of-mana,
  option C), `tests/finite-weights.json` (locked numbers).
- **Result (300s single-target, SP=1):** **SP 1.00 · Int 1.08 · Haste 0.96 · Crit 0.79 · MP5 0.66 ·
  Spirit 0.54 · Mana ~0** — vs the infinite ceiling on the *same* schedule (Haste 1.44, MP5/Spirit **0**,
  Int 0.56). **Order: SP ≈ Int > Haste > Crit > MP5 > Spirit ≫ Mana** (`docs/EP.md`, RULES §12).
- **The headline correction:** haste is **not** the weak stat for a *conserving* mage — the "0.4–0.6"
  folklore is the **OOM-idle** rotation (pure-spam haste EP **0.03**); with Frostbolt filler the mage never
  idles and haste stays **≈ 0.96**. Cross-validated three ways: the conserve rotation and the export's
  **own native wowsims rotation agree** (haste 0.96 vs 1.00; DPS 1916 vs 1969, −2.7%), and the analytic
  value-of-mana (**~2.2 dmg/mana**) brackets MP5. Fight-length: haste EP 0.80→0.96→1.02 (145/300/420s) in
  EP terms, but **absolute** DPS/rating is highest on short fights; intermissions push haste ↓, regen ↑.
- **The mana economy is the SIM's, not reimplemented** (option B's whole point): JoW, Mana Tide, Innervate
  (5× spirit), Evocation, Vampiric-Touch (+250 mp5), regen — all fire on the player's real export
  (verified in the combat log). The one gotcha: a schedule-only APL suppresses the external mana CDs unless
  it includes `autocastOtherCooldowns` (−6% DPS if missing; TOOLING ★). **Mana never feeds back into the
  infinite-mana layout optimizer** (the layout-first principle holds; this is a sim *reading*).

## Done — AoE crit-proc amplification (Clearcasting → Arcane Potency)

The runner can now value AoE (`--targets N` + `tools/genae.mjs` AE-spam; `--crit` to sweep crit — see
TOOLING). Findings, all sim-measured on the fixed rig:
- The model's AE scoring **core is exact** (base 392 / coef 0.214 / instant-GCD-bound / linear per-target
  / AP ×1.30, matching `arcane_explosion.go`).
- 6-target AE is **super-linear** — **+8.6% per-target at crit 38%** (and it *falls* as crit rises: +11%
  @10% crit → +7.7% @55%). **Talent-isolation (zero Arcane Concentration/Potency) makes it VANISH**
  (gear on-crit SP procs — Tirisfal 4pc etc. — add ~0), so the effect is **entirely Clearcasting →
  Arcane Potency**, which is **always-present and gear-agnostic** (depends only on crit × N × fixed
  talent ranks). Arcane Concentration procs **per hit** (`talents.go`), 3/3 Potency = **+30% crit**
  (sim-confirmed via the combat log), so more targets ⇒ more Clearcasting ⇒ Potency up on more casts.
- **Implemented** (`index.html`): `TALENTS = {arcaneConcentration:5, arcanePotency:3}` + `aoeCritAmp(N,
  crit)` = `critMult(crit + qCC(N)·0.30) / critMult(crit + qCC(1)·0.30)`, `qCC(N)=1−0.9^N`; applied only
  in the AoE damage branches (`simulate` ~734/795). Single-target returns amp 1 (**no plain golden
  moves**; exact-match 16/16, KT unchanged). It credits **~75–80%** of the sim's measured amplification
  across the realistic crit range — right magnitude, right crit-direction, **never over-credits** (the
  ~20% shortfall is second-order proc-chain dynamics, kept as a conservative margin). Gear on-crit SP
  procs stay unmodeled (negligible for AoE weighting, and transient).

## Status (as of the current work)

- **Crash fix (user-reported "Page Unresponsive" kills): the engine now runs in a Web Worker (latest,
  user-directed).** The finishing stage of `optimizeAsync` (top-6 polish, `basinHop` fixpoint,
  tie-break/normalizer stack) ran **synchronously on the browser main thread** — ~minutes on long
  fights (KT), which trips the browser's page-kill. Two layers of fix (ARCHITECTURE):
  (1) the finishing stage is an async IIFE with **throttled yields** (`scheduler.yield` /
  `MessageChannel`, ≤ every ~40ms of compute; `performance.now()` gates only WHEN the thread yields,
  never any computed value — determinism untouched); (2) the file is split into
  `<script id="engine-src">` (pure engine) + UI script, and `runOptimize` runs the heavy call in a
  **Blob Web Worker** built from the engine tag's own text — single-file preserved, main thread never
  computes, in-flight runs are terminated on re-run, in-page fallback if workers are unavailable.
  Worker-vs-page plans verified **byte-identical**. Same commit, display honesty (user-directed,
  RULES §3): the schedule/copy-text/press-board print, sort, and group by the **fire-time second**
  (`floor(actEff)`) instead of the intent — an opener burst with intent 0:04 firing at 5.4s now reads
  "0:05", co-rowed with a 0:05 Lust call (this also killed the "0:05 Bloodlust printed above 0:04
  Icon" row-order bug, and replaced the short-lived `snapRampIntent` intent re-snap with something
  strictly simpler).
  **Follow-up (user: "still incredibly slow, can't even copy"):** the sensitivity panel's "what if
  the kill runs longer" hint ran a SECOND full `optimizeAsync` on the main thread after every render
  — minutes of frozen-while-looking-done on long fights. Moved to a throwaway **aux worker**
  (`runOptimizeAux`; never falls back in-page). Verified: main-thread latency ~4ms while the aux
  crunches, Copy works under load. The remaining slowness axis is the **optimizer's own runtime**
  (minutes on 6-intermission fights, basinHop dominates — a known backlog item; the page now stays
  fully interactive throughout).
  **Sensitivity panel iterated three times live, then largely REMOVED (user decisions).** The
  "kill runs longer" lines went arithmetic → plan-anchored → probe-diff (re-optimize at candidate
  lengths in an aux worker, report the actual plan restructure) — and then the user cut the whole
  aux-worker analysis: **"remove the second 'alternative plans' worker altogether — not worth the
  cost."** What remains: the cheap arithmetic **banks-on** line (user-approved) + the squeak note;
  nothing computes after the results render. **The Cold Snap commentary note is also REMOVED
  entirely** (panel + copy text; the schedule's "Cold Snap → IV" rows carry the action; the
  engine's materiality logic that DECIDES the spend is untouched). If a restructure-breakpoint
  feature is ever wanted again, the probe-diff design is in git history (commit 21791d2).
- **Search parallelized across CPU cores (user: "make it faster without losing quality").**
  Profiled KT: 285.7s total, **`basinHop` teleport-polishes = 265.5s (93%)**, seed phase ~10s,
  5.7M simulate calls. Now the page spawns `min(8, cores−2)` pool workers (dumb polish servers on
  transferred MessagePorts; engine-side `poolInit`/`poolMap`) and `optimizeAsync` fans the seed
  polishes and hop teleports across them with a **first-accept-in-iteration-order** reduction —
  reproduces the sequential accept sequence exactly, so pooled ≡ sequential **byte-identical**
  (verified on 2:45 and KT: val 617033.2, identical plan; exact-match suite runs the sequential
  page path and is untouched). **Plus a polish-result cache with orchestrator-side dedupe**
  (`polishCacheFor`/`sigOf`/`teleportRep`, per-cfg WeakMap): polish() is pure, and the
  hop↔normalize fixpoint re-teleports near-identical candidates every round — repeats now cost a
  Map lookup instead of ~0.3–1s (cached entries cloned at accept so downstream passes can't
  corrupt them; both pooled and sequential paths share the cache, so tests speed up too).
  Container (2 pool workers): KT 285.7s → 201s (pool) → **134.4s** (pool+cache) → **83.9s**
  (+ a `simulate()`-level memo — the wrapper over `simulateRaw`, collect=false results only
  (plain number bags, no caller mutates them — verified), keyed `cfgSigOf(cfg)+sigOf(schedule)`
  so pool workers hit despite per-job cfg clones, bounded by wholesale clear at 120k entries;
  the hill-climb's final all-rejections round and the tie-break incumbents are the repeats).
  Scales with cores (~25–40s expected on a typical 8-core; short fights ~2s). Remaining depth if
  ever needed: parallelizing polish's inner shift ladder. The pool commit is suite-certified
  (25/25, byte-identical goldens); cache/memo commits certified the same way. **Hard product
  rule (user): NOTHING computes after the results render — no speculative or anytime refinement;
  what's shown is final.** (This is why the speculative concurrent Cold-Snap comparison was NOT
  built: its mispredict case would keep pool work running past the render.)
- **Honest progress display (user: "at least make the loading bar accurate").** onProgress now
  carries a **stage label**; the engine emits real within-stage fractions banded by the measured
  cost profile (Trying N starts (k/N) → Snapping to whole seconds → Basin-hop (main sweep, real
  sweep fraction) → Grooming → Re-hop & canonicalize (round r, halving bands)), and the
  **No-Cold-Snap comparison** — a genuine second full run — reports as its own labeled pass with
  an honestly RESTARTED bar (the UI resets its monotone clamp on a label change) instead of
  stalling near-done for its whole duration. The stage label rides the Run button's text.
  Display-only; the exact-match harness passes a no-op callback.
- **`basinHop` ramp-exit anchors landed** (the backlog headroom item): h160-class ramp-exit-hug basin
  CLOSED; **Kael'thas moved** to a strictly better plan (+354 robust, `IV@106/126/380`,
  `AP@120/380`, cluster mirrors) and was re-locked. h40/h50 straddle residuals (≤0.033, inside
  pressability slack) stay documented, not chased.
- Planner is deterministic, ~0.4%-accurate, with **16 sim-verified golden regression cases** (green).
- **Done this session — the wowsims harness audit AND the drop-bug fix + full re-validation** (W1 +
  W1.5). Rig rebuilt from `ade9f39` (`-tags with_db`), trust-anchored to `wowsimcli`. Overturned two old
  claims (off-GCD "collision" is a myth → drop the offsets; `SIMLOG=1` combat log exists) and corrected
  the stats protocol (seeds 11/19 are the same sample). **Headline: a real harness DROP BUG** —
  `APLActionSchedule` silently dropped an on-cooldown press (TOOLING ★), the entire Vashj "3-icons-win"
  (it deleted the 4-icon plan's terminal icon). **FIXED** (`tools/wowsims-patches/apl-schedule-strict-
  ready.patch`: gate the schedule on strict `spell.IsReady`). Re-validated all 16 — zero regressions;
  intermission goldens were badly under-executed and recovered **+18..+26** (4:00-multi/KT/Vashj); the
  Vashj 4-icon plan is vindicated on the fixed engine. Exact-match still 16/16 (model untouched).
  **Also found + now RESOLVED: AP's cadence in the sim is ~195s** (`arcane_power.go` starts the cd on
  buff-expire), but **real TBC AP is 180s cd-on-activation** (user-confirmed) — the **model was right**
  (cd180, unchanged); the sim's 195 is a wowsims quirk, so the sim is a known blind spot for multi-AP
  timing (SOURCES / TOOLING ★). **And W2a LANDED:** a coherent-cluster carry in the "Let the
  stacks build" pass now emits the ramp-aware **4:05 / 6:05** Vashj layout (icon@4:05, terminal
  icon+gem+AP@6:05, IV@6:00 stays); only Vashj moved, sim-gated new ≥ old on the fixed engine (+0.8 var0
  / +0.3 var10). So the post-ramp-exit shift (RULES §9, long "not implemented") is now real. Docs are the
  authoritative record; `index.html`/`genapl.mjs` unchanged, goldens still 16/16.
- Recent landed work: cast-rate-integral scorer; timeline redesign; spellpower-overlap forward-slide;
  **known-kill planning** (half-cast kill window); **full docs set** so `/clear` is safe;
  **Debugging-presets UI** (every golden is a live-computed preset off the single `GOLDEN_PRESETS`
  table that also feeds the exact-match suite); **sequential buff-into-Lust packing** (below); **the
  placement / containment workstream** (below — 3:20 +3.6, 5:00 +2.4, both sim-gated & re-locked).
- **Golden set recurated** (this session, user-directed): the two mislabeled plain late-Lust fights are
  now neutral `6:00 lust 4:20` / `5:45 lust 4:20` (kept as clean phase-free packing regressions); the
  **real** encounters were added — `KaelThas 7:00 lust 4:20` (early intermissions + a 6-target AoE +
  a post-Lust intermission) and `Vashj 6:30 lust 5:45` (six intermissions); the `2:40 @150 haste`
  case was **removed** (the IV-slides-out breakpoint isn't pinned yet — don't lock it).
- **Boss presets = the real phase (this session, user-directed).** Added `BOSS_PRESETS` (the 10 actual
  current-phase encounters — Hydross … Kael'thas — length/Lust/phases from the player's logs) as a
  **baked + exact-match-tested** strip ("Boss presets", accent); the abstract regression fights stay as
  "Debugging presets" (muted); the localStorage user strip was renamed "Boss presets" → **"Custom
  presets"**. The three boss encounters that were in `GOLDEN_PRESETS` under abstract names (4:00-multi,
  KaelThas, Vashj) **moved** into `BOSS_PRESETS` (renamed Al'ar / Kael'thas / Lady Vashj), no dup.
  `exact-match.mjs` now locks **both** arrays (23 cases: 10 boss + 13 debug); all reproduce the user's
  pasted plans exactly (they were generated by the tool). **Phase EP** computed over the 10 at the
  0-haste reference (`tests/phase-portfolio.json`): **SP 1.00 · Crit 0.72 · Haste ~1.38** (`docs/EP.md`);
  re-run at real gear haste before acting (haste falls as gear haste rises).

## Icon-count / SP-alignment — RESOLVED: the sim was WRONG (HARNESS DROP BUG), 4-icon plan is correct

**MECHANISM NOW PINNED (harness audit, TOOLING ★).** The artifact is not vague "resume mis-scoring" — it
is a concrete harness bug: `APLActionSchedule` **silently DROPS an on-cooldown press**. On Vashj the
icon@240 quantizes to 242.5 (the [3:30–4:00] exit ramp cast) → its 120s cd runs to 362.5 → the
**terminal icon@360 is dropped** (combat log: queued to 362.5, then no icon aura). So the golden's
"4-icon" plan was really firing **3** icons, missing the high-value 6:00-burst one — *that* is the whole
"−4.2 / drop-the-icon-wins +4.8" (deterministic, stable across independent far seeds). **With the drop
fixed (icon-track prototype) 4 icons = 1576.6 beat 3 icons = 1573.1.** The 4-icon plan is correct — as
the user and cast-counting always said — and the *fix is in the sim, not the model*.

**Old belief (overturned):** "3 icons @ 0/3/6 beats 4 icons @ 0/2/4/6, so the golden is sim-suboptimal."
Wrong: the sim was deleting the 4-icon plan's terminal icon. Do **not** re-open this as an optimizer
task. (Note the earlier "RNG-desync" hypothesis for the +4.8 was *also* wrong — far seeds proved it
stable/deterministic; it's the dropped use.) The drop was fixed + every golden re-validated (W1.5, done —
the drop was systematic, it also lost AP/IV/Zerk uses; no golden regressed, exact-match still 16/16).

- **Cast-counting settles it (the model's method; MECHANICS §3 "score by cast-counting").** Value each
  icon by `(casts it catches) × (multipliers there)`, relative to a bare-window icon:
  - **1 icon @3:00** rides IV@180 (+20% haste ⇒ more casts) **and** AP@180 (×1.30) — **and** Berserking@180
    for the first half of its window (a further +10% haste those 10s, easy to miss). ≈ **~1.5–1.6×** a bare
    icon.
  - **2 icons @2:00 + @4:00** land on bare windows (no IV/AP): ≈ 1.0× + ~0.9× (the 4:00 one a hair fewer
    casts on the post-intermission ramp) ≈ **~1.9×**.
  - **1.9 > 1.6** ⇒ two icons catch more effective ABs. The model agrees: 4-icon scores **+874** over 3-icon
    (≈ 0.39 cast, within `QTOL`). SP is **linear, not exponential** (`cast_damage = (base+SP·coef)·mult`),
    so co-locating icon+gem at 3:00 does **not** super-linearly help — no tipping.
- **So the sim's "3-icon +5.4" is bogus, and it hinges on a single artifact:** icon@4:00 posts a marginal
  **−4.2** in the sim (dropping it *raises* DPS) where cast-counting says it should be **~+5**, like the
  net-**+6.5** icon@2:00. An off-GCD, macro'd buff (fires *between* casts, never clips — MECHANICS §3)
  **cannot** be net-negative with no alignment/cooldown reason. Ruled out this session: clip (ISC is
  off-GCD/instant, wowsims source-confirmed it doesn't touch the hardcast), mana (900k avail, ~100k used),
  cooldown coupling (icon@6:00 fires either way), shared trinket CD (gem uses its own timer), and
  sub-second offset (swept .00→.15, all ≈ 1563.7). The residual is a **sim-setup bug at the intermission
  resume** (how `genapl`'s AB-gating / the runner restarts casting at `seg.end`) — the runner has no
  combat-log flag to pin it. **The model / cast-counting is the referee for intermission-exit placement,
  not the raw sim.**
- **Both prior "fix" attempts chased this artifact and were reverted** (nothing committed): (1) a generic
  "concentrate SP within QTOL" tie-break — over-fired, moved five plain-fight goldens (dropping *useful*
  cold icons worth ~+9 each); (2) a scoped `dropRampCold` "drop the exit-ramp icon" tie-break — reached the
  (wrong) 3-icon plan cleanly but was fixing the artifact. Do not resurrect either.
- **Real, minor, NOT-yet-actionable refinement (separate from the artifact; user-confirmed as the ideal).**
  There *is* a small true gain in shifting a damage/SP cluster that lands right on an intermission-**exit**
  a few seconds later so it dips into **already-built AB stacks** instead of the ramp — e.g. icon@4:00 →
  **4:05** (= 245, so its 20s window still clears the next intermission at 4:25 — do NOT push to 248),
  moving the terminal **icon+gem+AP** 6:00 → **6:05** to make cd room (**the 6:00 IV stays put**; the
  downstream absorbs the shift free), strictly raising that icon's uptime over built stacks. **Sim-checked
  this session (controlled G-vs-user, 50k):** the whole shift is **+0.6–0.7 DPS over the golden, stable
  across var0 AND var10, seeds 11/19** — small but real and consistent, so it is NOT washed out by the
  exit bug (both plans share the same resume; the shift is the only diff). The blocker is the **model**:
  it's ramp-blind (steady 3 stacks), so it can't *see* that 4:00 sits on a rebuild ramp while 4:05 doesn't,
  and can't produce the layout. Needs a **ramp-aware exit** tie-break (shift a damage/SP press off an
  intermission-exit second onto built stacks when its window still clears the next downtime). Small
  (+0.6); do not prioritize over the payoffs, but it's now a *verified* gain, not just a hypothesis.

## DONE — placement REASONING annotations (Phase 3 task 6)

**Landed.** `pressPlan` (~3271) now emits *why-here* reasons — Alignment / Flexible (leeway) /
Cooldown-timed / Cold Snap / Positioned — replacing the raw `deliberate: +N dmg` / `locked here by its
cooldown` deltas. The Flexible reason reuses the `leewayZones` interval (task 3), and the ATI "nudge onto a
proc" rider appears on flexible rows when Ashtongue is enabled. Output-only (exact-match rebuilds from
`scheduleRows`), goldens untouched. Original spec kept below for reference.

Replaced the copy-as-text / schedule tags that quoted raw damage deltas — `deliberate: +N dmg vs one press
at T`, `locked here by its cooldown` (`pressPlan`, `index.html` ~3082) — with a short **why-here reason**
per press. Those deltas don't help the reader; the reasoning does (it's the "trustworthy" goal). This is
**output-only** and the exact-match suite ignores these tags (it rebuilds the plan from `scheduleRows`,
setup+windows+times only — `tests/exact-match.mjs` ~63–78), so **it does not touch goldens**. Reason
categories, from the user's Vashj 6:30 worked example (map each press to one):
- **Cooldown-timed** — "used here so the cooldown comes back in time" (for the 3:00 / 6:00 burst). For a
  press whose second is set by its own cd feeding a later scheduled use (opener IV / AP / Zerk / Icon).
- **Alignment** — "used here to align with the other buffs [of this burst]." For a press co-located onto a
  burst it strengthens (the opener gem).
- **Count-vs-align tradeoff** — "2 unaligned uses here and @4:00 beat one at 3:00." State the spread call
  the planner resolved (the icon-count decision).
- **Flexible / earliest** — "can be pressed anytime from now to X:YZ." When a press is bound only by "be
  ready for the next use," report the slack; `X:YZ = nextScheduledUse − cd` (clamped ≥ now). Not triggered
  on Vashj, but the general case (RULES §10 earliest tie-break) should say so.
Keep the Cold-Snap `csNote` (held / spent) and the squeak note — those already read as reasons. Infer the
category **post-hoc** from the schedule + cooldown structure (co-pressed? is its cd the binding constraint
on a later use? does it have slack before its next use?). Grounding: `pressPlan` ~3082, `scheduleRows`
~2757, copy-text handler ~2819, on-page render `renderSchedule` ~2795.

## Also planned

- **RESOLVED — the "model over-values SP-count vs concentration" thesis: the bias was RAMP-BLINDNESS,
  and Phase 4·B fixed it.** The 2:15 far-Lust case re-examined on the fixed rig with the exact-ramp
  model: the model now agrees with the (old, correct-in-direction) sim — 1 aligned icon beats 2 naive
  icons (model +0.16 casts; sim +0.1% var0 / +0.2% var10) because the naive icon@0 sat on the pull ramp
  the blind model over-credited. Better still, the tool's own output — a **double-dip** (both icon+gem
  uses, opener + terminal, Lust left mostly bare) — beats BOTH by **+0.4% var10, sim-verified**. Vashj's
  4-icon side of the thesis had already resolved as a harness artifact. Case closed: SP crediting is
  correct, no tie-break needed, and the old §4 far-Lust "limitation" is retired (RULES §4).
- **Coherent intermission/AoE handling** (`RULES.md` §9): make placement/tie-break passes downtime-aware
  so a window doesn't *usually* begin in a dead zone — as a **strong default, not an invariant** (pressing
  early into downtime can be right when it's the only way to get a cooldown back for a bigger later window;
  the effective-AB count decides). Amplifies the icon tie-break above (intermission ramps make off-haste
  SP-buff windows even weaker).
  - **Half DONE — the "don't *begin* in the dead zone" half landed** (`dodgeDowntime`, this session). A
    final normalizer slides any press whose window begins inside an intermission to the exit, model-neutral;
    4:00-multi's Cold-Snap IV 3:47 → 3:49 (var0 exact wash, var10 +0.2, seeds 11/19; only mover). See RULES
    §9 / ARCHITECTURE.
  - **DONE (Phase 4·B) — the post-ramp-EXIT devaluation, solved in the PHYSICS, not a tie-break:** the
    exact discrete ramp scores the slow exit casts truthfully (damage at completions) and the press-snap
    lands exit presses on the real sparse boundaries — so a damage window on an exit ramp is docked for
    exactly the completions it misses, automatically. The regenerated Vashj golden (its damage buffs
    stepping past the exit boundaries, +0.9 effective casts) is this fix landing; the exit-delay class is
    sim-confirmed +0.39% on the fixed rig. See RULES §3.

**Done — the PLACEMENT / containment workstream (this session).** Overlap is interval **containment**,
not start-coincidence (RULES §11, MECHANICS §5 pt 5). Three surgical, sim-gated changes to `optimizeAsync`;
**only the two intended goldens moved** (14 byte-identical), each re-locked on wowsims new ≥ old at var0
**and** var10, seeds 11/19, 250k:
- **`permute` in sequential window-packing (~1948):** sweeps the *order* the haste buffs sequence across
  the window (not just biggest-first). Leading with the shorter buff keeps a tail buff's 2nd cd-tick
  before the kill. **3:20** → `Zerk@0:05` in Lust, `IV@0:15` after, `CS→IV2@3:00` (**+3.6** var10 / +10.7
  var0; golden 2651.1 reproduced exactly).
- **Cold-Snap materiality `csAddsUse` gate (~2157):** CS that only **repositions** the same IV count (vs
  the best no-CS plan) is **free** (sub-cast bar), not held behind the full "≥ one cast" bar — that was
  what vetoed the 3:20 opener. CS that genuinely **adds** an IV keeps the full bar. RULES §8.
- **`spreadLoneHaste` normalizer (~2070):** a *lone* haste use (intersecting no damage/SP buff) is
  position-independent → slides back to its earliest natural cd tick, model-neutral. **5:00** → the free
  CS IV banked at 4:25 spreads to its 3:05 natural tick, re-homing the burst-IV onto 4:05 (**+2.4** var10
  / +11.6 var0; golden 2625.1 reproduced exactly). The naive spread *loses* ~8 DPS (leaves the 4:05
  burst with no IV) — only the lone IV moves; burst-riding IVs stay pinned.
**4:00 W4** was already at its canonical spot (cluster @3:25 co-presses CS→IV+Berserking, an exact sim
tie with 3:20) — untouched, confirming the normalizer is DPS-neutral by construction. See RULES §8/§11,
MECHANICS §5 pt 5, ARCHITECTURE finishing passes.

**Done — sequential buff-into-Lust packing (the SEARCH fix).** A window-packing move in `optimizeAsync`
(last structural pass, ~1913) assembles the packed burst at each haste raid-call: damage cluster on the
window, haste buffs on sequential slots (IV @anchor, Berserking @anchor+20), sweeping which IV use lands
on the anchor; kept only on a strict robust gain with `sameCounts`. Fixed `6:00 lust 4:20` (**+8.5 DPS**)
and `5:45 lust 4:20` (**+13.9 var0 / +5.7 var10**), both sim-gated and re-locked; the 12 early-Lust
goldens and the two real boss fights were **untouched** (their bursts were already on Lust). Placing it
last meant no defensive rework of the eviction / `nulled` vetoes was needed (nothing runs after to undo
it). See `docs/ARCHITECTURE.md` and RULES §4.

**Done — theorycraft regrounded on "effective ABs" (this session).** Reframed the docs so every rule is a
*consequence* of maximizing effective ABs cast, not a hardcoded law (`CLAUDE.md` goal, `MECHANICS §4`).
Softened the over-strong absolutes the user flagged: Lust-packing is the usual *method* (§4), not "THE
rule"; the intermission invariant is a strong *default*, not a "never" (§9). And **sim-settled the
haste-on-haste question**: isolated pure-haste Berserking **inside** Lust vs **after** it scores an
identical **2367.4 DPS** (0 gear, var 0, 300k, mana-independent) — a **wash, not a synergy**; the value
of haste-on-Lust is *flux* (speeding damage/SP casts) or banking before an early kill, never the product
(RULES §7, MECHANICS §5.3). The planner already sequences correctly, so no code change — a doc/mental-model
correctness fix in service of generalisability.

**Done — model↔sim relationship reconciled (this session, user-directed).** The planner knows every
cast/buff/timing deterministically, so it computes **effective ABs cast** exactly — that count is the
**objective and the arbiter** for comparing two lines; the tool is a maximization function over it. The
sim's role is **calibration**: anchor the physics (trust-anchor), cover the count's blind spots (ramp /
mana / AoE / multi-AP timing), and verify novel/suspicious findings — **not** a routine per-golden gate.
Replaced the stale "trust the sim over the model / the sim wins / the sim is the referee" wording across
`CLAUDE.md`, `docs/TOOLING.md` (new **Methodology** section up top), and `RULES.md`. Per the user's
correction, the framing is explicit that **the sim was rarely *wrong* — we often used it improperly**
(the drop bug, cargo-cult offsets, count-changing A/Bs on nearby seeds were *our* faults); a clean
cast-count vs a contradicting sim number with no blind spot in play is a **sim-setup audit trigger**.
Also flagged the **self-confirming-oracle** risk (proactively sim the blind spots + periodically
re-anchor) and the **scorer-vs-optimizer** distinction (this settles the scorer; search-completeness is
a separate axis). Docs-only, no code/golden change.

**Done:** ~~Boss-preset UI = the golden set~~ — landed. `GOLDEN_PRESETS` drives both the UI strip and the
exact-match suite; new fights are added by editing that one array.

## Golden-review findings (from the preset walkthrough — sim-verified)

- **FIXED — off-GCD burst now co-pressed on one second (7:20 Window 6: 6:21 → 6:20).** The burst
  emitted IV at `6:20` but Icon/Gem/AP at `6:21`. Diagnosing it split the "cluster" into two cases:
  Icon at 380 vs 381 was an **exact model tie** (Δ ≈ 1e-10 — the back-to-back IV+CS→IV keeps casts
  IV-hasted throughout), but Gem/AP scored **+50 at 381** — *not* a tie. The macro-snap missed all of
  them because `isAnchored(IV@380)` false-negatives when the Cold-Snap chain lets a −1s nudge drop the
  chained IV@400, and the overlap-alignment pass then re-staggered them. **Sim resolved the +50: it is a
  pure model artifact** — full-fight wowsims has all-at-6:20 == gem/AP-at-6:21 to the decimal (2565.8
  var0, 2568.2 var10, seed 11, 250k). Fix: a final `coPressAlign` pass (runs on the returned schedule
  AND the Cold-Snap chain candidates) snaps a damage/SP press onto its nearest earlier haste second
  **within 3s** when the model cost is **≤ ⅛ cast**. The 3s window protects genuine staggers (the 3:20
  gem sits 5s off its IV; the KT Icon-onto-AP slide ~20s off Lust — both untouched, both still green),
  and the sub-cast cap rejects any real trade. Only the 7:20 golden moved; sim-gated free; re-locked.
- **FIXED — the whole placement / containment workstream landed** (3:20 free-CS opener sequencing +3.6,
  5:00 lone-IV spread +2.4, 4:00 W4 confirmed already-canonical). Overlap is interval **containment**, not
  start-coincidence: the planner now (a) treats containment-equivalent placements as ties and picks the
  consistent member (`spreadLoneHaste`), (b) spends a **free** Cold Snap to sequence/spread IVs when it
  gains-or-ties (`csAddsUse` materiality gate), (c) sequences opener haste into Lust via a haste-buff
  **order sweep** (`permute`) instead of stacking it over the floor. Generalised, not per-golden — only
  the two intended goldens moved, both sim-gated new ≥ old (var0 & var10, seeds 11/19). See the **Done**
  entry above, **RULES §8/§11**, **MECHANICS §5 pt 5**, and ARCHITECTURE finishing passes.

## Open questions / known limitations

- **Model mis-valuation (documented, not patched):** the scorer ranks the *partial* pack
  (IV-in-lust-alone) above "IV out" (+935 model) though the sim calls it a −0.7 wash — it over-credits
  the damage flux through the floored IV window. It does NOT block the full pack (model ranks full >
  partial), so the search fix renders it inert; touching the floored-flux crediting risks the
  validated goldens. Revisit only if a case needs it.
- **Align-vs-twice breakpoint** should be pinned by sim per fight, not assumed (when does "two
  unaligned uses" beat "one Lust-aligned use"?).
- ~~Intermission-golden optimality re-gate~~ **DONE** (this session, fixed rig). **4:00-multi:** golden
  (icon2@186, CS→IV@229) = 2096.9 ≥ icon2@180 (2095.6) and == CS→IV@227 (exact wash — confirms
  `dodgeDowntime` is legibility-neutral). **KaelThas:** golden (280/400) = 1718.7 vs TOOL 260/396 (1718.5)
  and 280/402 (1718.2) — a 3-way tie within CRN noise (containment-equivalent icon timings), no
  regression. Both plans stand.
- **Tirisfal-2pc as a tool input — RESOLVED (user call): implemented as the `ck-t5` gear checkbox.**
  Applies ×1.2 to Arcane Blast only (damage sites + both plain-AB normalizations, so single-target plans
  AND effective-AB counts are exactly INVARIANT — verified: identical plan, identical 87.596 count on/off)
  and +20% AB mana in the per-window chip (the real set bonus raises cost too). Its main effect is
  re-pricing AoE phases (`M_eff = M/1.2`): verified at the N=3 knife-edge — the toggle flips
  cluster-on-AoE (+0.607) to cluster-on-Lust (−0.052). Default off; goldens untouched. Pooling with AP:
  ADDITIVE (resolved below).
- **AP × T5-2pc pooling — RESOLVED: ADDITIVE (user ruling).** Googled/searched: no public 2.4.3 source
  decides it; the mechanics argument (both are percent-damage aura modifiers, which SUM in the client's
  modifier pool) matches wowsims' implementation, and the user ruled "trust wowsims if unsure." The
  model's T5 toggle pools additively (`dmgMult + t5add` in `simulate`); sim gates on the T5-wearing
  reference export are faithful as-is.
- Sim harness (`runner`, gear export, wowsims source) lives in the ephemeral scratchpad — see
  `docs/TOOLING.md` for rebuild.
