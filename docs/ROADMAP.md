# ROADMAP.md — status, current work, open questions

## Resuming after a context clear (start here)

1. Read `CLAUDE.md` (auto-loaded) → `docs/MECHANICS.md` → `docs/RULES.md` → this file, then
   `docs/ARCHITECTURE.md` (line ranges) and `docs/TOOLING.md` (how to sim-verify) before touching code.
2. **Next task = `docs/PLAN.md` Follow-up A: resolve AP-cd (195 vs 180) + re-gate the intermission
   goldens on the fixed engine; THEN W2 (the confirmed +0.8 ramp shift).** The harness audit (W1) AND
   the drop-bug fix + full re-validation (W1.5) are **done** — findings are the authoritative reference
   in `docs/TOOLING.md` (trust-anchor = runner==`wowsimcli` to the decimal;
   the off-GCD "collision" is a **myth**, drop the offsets; external buffs off-GCD single-application;
   stats protocol with the **seeds-11/19-are-the-same-sample** correction; `SIMLOG=1` combat log
   exists). The audit's **headline finding** (TOOLING ★): `APLActionSchedule` **silently DROPS an
   on-cooldown press** — Vashj's "4-icon" golden was really firing **3** icons (terminal dropped), which
   is the entire "−4.2 / 3-icons-win"; fix the drop and 4 icons (1576.6) beat 3 (1573.1), vindicating
   the golden. So: **W1.5 = implement a clean drop-free fix (`Cooldowns.Timings`+autocast) and
   re-validate every golden** (the drop was systematic — it also lost AP/IV/Zerk uses), then **W2 only
   if the "+0.6 shift" survives the fixed rig** (it was measured while both plans dropped terminals, so
   it's suspect). Payoffs after (haste-agnostic APL → setup comparison → EP calculator). **The model /
   cast-counting was RIGHT on Vashj; the sim was wrong because of the drop bug — fix the sim, don't
   distrust the model.**
3. Baseline check: `cd tests && CHROMIUM=/opt/pw-browsers/chromium node exact-match.mjs` (expect 16/16).
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
1. **Haste-agnostic ideal APL** — emit a cooldown plan that adapts per gear set.
2. **Setup comparison** — plan each setup with its *own* ideal cooldown usage, then compare
   effective-AB totals to decide which trinkets/gear to bring.
3. **EP / stat-weight calculator** — finite-difference where each `gear ± Δstat` is re-optimized with
   its own ideal plan (base gear → planner → forced-schedule APL via `tools/genapl.mjs` → sim → DPS;
   then `gear+Δ` → re-run planner → new APL → sim → `Δdps/Δstat`). Corrects wowsims' `statweight.go`,
   which freezes the rotation across perturbations (dragging haste's EP down).

## Status (as of the current work)

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
  **Also found: AP's real cd is 195s, not 180** (`arcane_power.go` starts the cd on buff-expire) — a
  model↔sim mismatch (see PLAN Follow-up A). **And W2a LANDED:** a coherent-cluster carry in the "Let the
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
stable/deterministic; it's the dropped use.) Fixing the drop + re-validating every golden is **W1.5**
(`docs/PLAN.md`) — the drop was systematic (it also lost AP/IV/Zerk uses), so other goldens may move.

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

## Planned refinement — placement REASONING annotations (user-requested, output-layer, low-risk)

Replace the copy-as-text / schedule tags that quote raw damage deltas — `deliberate: +N dmg vs one press
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

- **The "model over-values SP-count vs concentration" thesis is now DOUBTFUL — the Vashj leg collapsed.**
  It was built on two "sim says fewer-concentrated-icons win, model says more" cases (Vashj 6:30, 2:15
  far-Lust). Vashj is now **resolved the other way**: cast-counting + the user confirm the model's 4-icon
  plan is **right** and the sim's 3-icon was a **harness artifact** (icon-count section above). So the
  pattern may not be a *model* bias at all — it may be that the **sim** mis-scores "concentrated SP"
  layouts (near intermissions/boundaries/floored windows), and the model's cast-counting is correct.
  - **Re-examine 2:15 (Lust @0:25) with the same skepticism before trusting it.** The claim: sim says
    **1 icon on floored Lust+IV** beats **2 icons off-Lust** by **+17–50 DPS**, model ranks 2-icon higher
    by **+1416**. Given Vashj, do **not** treat that sim number as ground truth — first **cast-count** it
    (1 icon on Lust+IV+AP ≈ its multiplier × casts, vs 2 bare icons' casts) and check whether the +17–50
    survives a setup audit (offsets, floored-window scheduling, prestack). If cast-counting says 2-icon,
    the model is right and 2:15 is *not* a golden-worthy suboptimality. Do NOT add 2:15 as a golden, and
    do NOT touch the SP crediting, until this is redone. (Lesson: a sim result that contradicts clean
    cast-counting is a **setup-audit trigger**, not a model bug — MECHANICS §3 corollary.)
- **Coherent intermission/AoE handling** (`RULES.md` §9): make placement/tie-break passes downtime-aware
  so a window doesn't *usually* begin in a dead zone — as a **strong default, not an invariant** (pressing
  early into downtime can be right when it's the only way to get a cooldown back for a bigger later window;
  the effective-AB count decides). Amplifies the icon tie-break above (intermission ramps make off-haste
  SP-buff windows even weaker).
  - **Half DONE — the "don't *begin* in the dead zone" half landed** (`dodgeDowntime`, this session). A
    final normalizer slides any press whose window begins inside an intermission to the exit, model-neutral;
    4:00-multi's Cold-Snap IV 3:47 → 3:49 (var0 exact wash, var10 +0.2, seeds 11/19; only mover). See RULES
    §9 / ARCHITECTURE.
  - **Still open — the post-ramp-EXIT devaluation** (the harder, delicate half): a press *at* an
    intermission exit catches slow ramp casts the steady-state model over-credits. This is the real Vashj
    icon-count fix (icon@4:00 sits on the [3:30–4:00] exit ramp). Needs a downtime-ramp-aware tie-break,
    sim-gated on every intermission golden — the generic SP-concentration tie-break is the wrong tool (it
    over-fires on plain fights; see the Icon-count section).

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
- **KT AoE valuation** (double-IV over the 6-target phase) rests on Arcane-Explosion-vs-Blast
  weighting that plain-AB sims can't confirm — a standing model assumption.
- Sim harness (`runner`, gear export, wowsims source) lives in the ephemeral scratchpad — see
  `docs/TOOLING.md` for rebuild.
