# PHASE 6 — Haste-adaptation cross-validation & the open soft spots

**Status:** IN FLIGHT — measurement FIXED (§4.7 ✅), campaign now running. Phases 4 (search
robustness) and 5 (AoE) are CLOSED; the six-kit ladder campaign (RULES §16) certified the search
against exhaustive enumeration across every trinket pair and the full haste range. Phase 6 asks the
next question: **does the planner's haste-ADAPTATION hold up in the real sim, end to end, on random
fights it has never seen — and where are the remaining cracks?** The instrument, granularity, and
fight-classes are built and validated; several harness bugs were found+fixed — the last and biggest
being that the sim was **prepulling while the model opens cold** (§4.7), which caused a
physically-impossible cast-loss and is now fixed (cold open ⇒ strict haste-monotonicity restored).
Data is now trustworthy; gathering the campaign (§2(ii)) and recording deficits without hot-fixing —
the NEXT pass decides model changes.

Read `CLAUDE.md` → `docs/MECHANICS.md` → `docs/RULES.md` (esp. §16) → `docs/TOOLING.md` (the sim
methodology + the ★ mana trap) before touching anything here.

---

## 1. What this phase is testing (the cross-validation experiment)

The planner claims to *re-optimize the layout as gear haste changes* — the ladders proved it finds
the model's global optimum at every haste, but that's a statement about the **model**. Phase 6 asks
the **sim** whether the model adapted *correctly*: is the plan the tool builds for haste H actually
the best plan at H when you run it in wowsims, or would a plan built for a different haste beat it?

The instrument is a **holdout cross-validation matrix** (`tools/xval.mjs`):

1. Seed-draw a random fight: length (by fight-CLASS, see below), Bloodlust time, and 2 of {Icon,
   Serpent-Coil, Skull, MQG}. Deterministic mulberry32 from the seed, so every run is reproducible.
2. Optimize a plan at each haste in a **kit-specific, breakpoint-straddling haste set** (see
   "Granularity" below) — NOT a fixed 0/100/200/300/400 grid.
3. Sim **every plan at every haste** → an N×N DPS matrix. Rows = the haste a plan was optimized FOR;
   columns = the haste it's SIMMED at. The **diagonal** is each plan run at its native haste.
4. Two readings:
   - **(a) Haste-monotonicity — a strict invariant, used as a REGRESSION CANARY.** With ∞ mana, more
     haste ⇒ ≥ casts ⇒ ≥ damage; haste is *never* harmful, so a fixed plan's row MUST be non-decreasing.
     Since the cold-open fix (§4.7) this holds: the harness reports **monoDip ≈ 0.00%** on every table.
     A nonzero monoDip now means a REGRESSION (a prepull crept back in, or a new harness bug) — stop
     and fix it, don't gather. It is NOT a noise floor for the diagonal (that noise is plan-to-plan,
     see §3.0).
   - **(b) Diagonal dominance — the model test.** In every column, does the native (diagonal) plan
     sim ≥ every plan borrowed from another haste? The harness reports **CLEAN** (native is the max
     in every column) or **DEFICIT X%** (a borrowed plan out-simmed the native somewhere, by X% at
     the named cell). No tolerance is applied in the label. **Trustworthiness depends on fight length,
     not the monotonicity dip** (which is ~0): on a short/medium fight, plan-to-plan boundary
     quantization is worth up to ~0.5–1%, so a sub-1% deficit there is UNCONFIRMED until re-checked
     (§3.0); a long/XL-fight deficit, or one that persists as the fight lengthens, is real signal.
     Deciding what to do about a real one is the NEXT pass.

Run it: `CHROMIUM=… RUNNER=…/runner-ap180 EXPORT_BASE=…/export.json [KIT=a,b TCLASS=short
HASTES=0,30,…] node tools/xval.mjs <seed>`. Prints the matrix and an `XVAL-DONE … monoDip=…%
diag=CLEAN|DEFICIT diagWorst=…%` line. **This pass = gather correct, clearly-labeled data; the next
pass decides what to fix.**

### Granularity — the haste set (user-directed)
The informative haste points are **not** a uniform grid; they **straddle each kit's layout
breakpoints** (from the RULES §16 ladders), because band interiors give identical plans (trivial
ties) and the breakpoints are the only place a mis-adaptation shows. Rule: `{0, 400}` endpoints ∪
`{breakpoint−15, breakpoint+15}` for each merged breakpoint (breakpoints within 40 collapsed —
plateau-twin wobbles aren't real transitions), then dedup any two points within 20 (keep the
breakpoint-straddle, drop the round anchor). ~7–11 points per kit:
| kit | haste set |
|-----|-----------|
| mqg+skull | 0,30,70,100,160,190,235,265,295,400 |
| isc+scb   | 0,20,65,95,140,165,195,215,245,400 |
| isc+skull | 0,20,40,70,100,130,155,185,230,260,400 |
| isc+mqg   | 0,20,40,70,110,140,230,260,305,400 |
| scb+skull | 0,30,60,90,210,240,260,290,400 |
| scb+mqg   | 0,20,75,105,235,265,400 |
(The committed source of truth is `tools/xval-haste-sets.json`; the campaign driver `xval-kit.sh`
reads a kit's set from it and passes it to `xval.mjs` via `HASTES=…`. `xval.mjs` on its own defaults to
the coarse `0,100,200,300,400`. Regenerate the JSON from the RULES §16 ladder breakpoints if the
ladders change.)

### Fight-length classes (user-directed; 2-min = skull/scb/isc, 3-min = IV/AP/Zerk, 5-min = mqg; CS→IV grants IV +1)
| class | rule | length band (s) |
|-------|------|------|
| short | each CD once | 75–115 |
| medium | 2-min ×2, 3-min ×1 | 150–195 |
| medlong | both 2- and 3-min ×2 | 205–255 |
| long | 2-min ×3, 3-min ×2 | 265–375 |
| xl | 2-min ×4, 3-min ×3 (IV ×4 w/ CS), mqg ×2 | 385–460 |

**Every class exercises the swapped 2-min trinket on-uses** — that IS the subject of a trinket
cross-val, so no class drops them; on the longer fights they fire the MOST. Verified in the xl plans:
isc+scb T=435 fires `Icon [0,120,240,414]` (×4) + `Gem` (×3); mqg+skull T=395 fires `Skull
[0,120,240,375]` (×4) + `MQG` (×2) — the 2-min on-uses out-number the 3-min cooldowns there. (mqg is
the lone 5-min cd, so it caps at ×2 on xl; the "3-min ×3" only ever means IV/AP/Zerk.)

### Sim protocol locked in (do NOT deviate — each cost us a real bug once)
- **COLD OPEN — `_prestack:0`, NEVER prepull.** ★★★ The model opens cold (0 stacks, RULES §3). A
  prepull cast (genapl's old default) is fixed at −2.3s wall-time, doesn't scale with haste, and
  broke haste-monotonicity (§4.7). `xval.mjs` forces `_prestack:0`; genapl now defaults to it. Do not
  reintroduce a prepull in any model-compared sim.
- **`--mana 100000000` (infinite).** ★ The model is layout-first; mana is excluded by design. A gate
  without infinite mana measures MANA, not layout (see §4.4 and the −4% phantom in TOOLING). This is
  the single most important flag.
- **`--var 10`** (not var0). var0 is a razor-edge tie trap (a flip on a whole-cast boundary); var10
  softens that. **BUT** var does NOT fix the short-fight quantization floor (§4.7 — it's length, not
  variance, that shrinks it), and more variance can itself blur a diagonal comparison (user caution).
  So var10 is the current choice, not a settled one — revisit alongside the §4.7 metric decision.
- **Paired `--seed 11`** across every cell → common-random-numbers. Note (§4.7): varying `--seed`
  appears not to vary the sample here, so cross-cell spread is deterministic quantization, not
  statistical noise — which is *good* (reproducible) but means "add iterations to beat noise" won't
  shrink the floor; only a better metric or a longer fight will.
- **`--iter 10000`.** Deterministic-enough per config that 10k is plenty; do NOT use 250k (wasteful).
- The AP-180 patched runner (`runner-ap180`), not stock wowsims (AP cadence quirk, TOOLING ★).
- **Trinket swap:** the gear export wears Icon+Serpent-Coil; `xval.mjs` swaps equipment array
  **indices 12/13** (0-indexed) to the drawn pair's item IDs. ★ Those indices are the wowsims proto
  `ItemSlotTrinket1=12`/`ItemSlotTrinket2=13` — i.e. **in-game trinket slots 13/14** (1-indexed);
  the array is 0-based and positional, so 12/13 is correct (verified against `common.pb.go`, the
  export's own equipped trinkets at 12/13, and the on-use auras firing). Item IDs: Icon **29370**,
  Serpent-Coil Braid **30720** (the equipped trinket; its +225 SP fires when a Mana Emerald, itemId
  **22044**, is cast — see §4.6), Skull **32483**, MQG **19339**. `genapl.mjs` now emits Skull/MQG schedules. Passive trinket stats
  differ from the model's fixed sp=1387 — this is fine: SP is a flat multiplier that can't change
  layout ranking (RULES §6), and within a column every plan uses the identical character, so it
  cancels. Only `--haste` (which reshapes layouts) is swept, exactly as the model intends.

---

## 2. Results ledger

**The real campaign** = breakpoint-straddle haste grids (§1) × the five fight-classes × six kits (30
tables) + the three boss shapes × the kits, all **cold-open, ∞ mana, var10** on the fixed rig. Each
`tools/xval.mjs` run writes a full N×N DPS matrix to `tools/xval-results/<kit>-<class>.txt` (committed
— the scratchpad is ephemeral) and an `XVAL-DONE` summary line. `tools/xval-collect.mjs <dir>`
assembles the ledger below.

**How to read a row.** `monoDip` must be ~0.00% (the §1(a) regression canary — nonzero ⇒ a prepull or
new harness bug, stop and fix). `diag` is CLEAN (native wins every column) or DEFICIT X% (a borrowed
plan beat native, by X%). **Trust a deficit by fight length (§3.0), not by monoDip:** short/medium
< ~1% = UNCONFIRMED (plan-to-plan boundary quantization); long/XL, or a deficit that grows with
length, = REAL. A confirmed real deficit graduates to §4.5.

### 2.1 Campaign results — COMPLETE (36 tables). Regenerate the row-by-row table with `node tools/xval-collect.mjs tools/xval-results`
**Status: all 30 fight-class tables (6 kits × 5 classes) + 6 boss tables (Vashj/Al'ar/KT × {mqg+skull,
isc+scb}) committed to `tools/xval-results/`.** The per-row table is mechanically regenerated by the
collector (not frozen here — run it). What IS recorded here is the **headline + the interpretation that
needs judgment.** _(Verification note: the 18-table run used an LLM adversary; the full-set re-run agent
was orphaned by a container restart, so the arithmetic invariants were instead recomputed **inline and
deterministically** over all 36 grids — `scratchpad/verify36.mjs`. Results below are that recompute, and
they CONFIRM the reported numbers with zero mismatches.)_

**Headline (36/36) — independently recomputed from the raw grids:**
- **monoDip = 0.0000% on EVERY table** — invariant A holds everywhere; every row of all 36 grids was
  re-checked cell-by-cell for a downward step and **none exists**. NOTE: *necessary, not sufficient* —
  it proves haste is never harmful (the §4.7 prepull regression is gone), NOT that absolute DPS is
  calibrated. A regression canary, not a proof of correctness.
- **Every fight-class (non-boss) deficit is sub-1%** — worst **0.77%** (isc+scb medium); every reported
  `diagWorst` matches the inline recompute with **zero mismatches**. 1 table CLEAN, 29 sub-1% DEFICIT.
- **Boss shapes:** Vashj (0.36–0.56%) and Al'ar (0.28–0.59%) are sub-1% and clean intermission-only sims.
  **KT is 1.06% / 2.68% — EXCLUDED from the model-quality verdict:** KT's AoE window (105–145s, 6 targets)
  is simmed as **downtime** (genapl has no Arcane-Explosion), so the model optimized *valuing* an AoE
  burst the sim can't reward — a **known harness limitation (§7), not a model bug.** The KT deficit is
  plan@400 winning a fight the sim under-values; do not read it as a haste-adaptation failure. (Fix =
  add AE emission, §7, then re-run KT.)
- **Deficit loci (by worst cell, all 36):** 19 at **low passive haste (≤70)**, 16 at mid/high — the
  higher mid/high count vs the 18-table cut comes from the scb-kit high-haste deficits (§4.2 region)
  and the boss tables.

**Recorded observations — DATA for the fix phase, NOT a grading of which deficits matter.** Diagonal
dominance is a property that should hold on EVERY table; every one of these deficits is a violation, and
none is dismissed here as "fine." The following are neutral facts about WHERE the violations land and how
they behave — for PHASE7 to diagnose. Deciding which are model errors vs measurement artifacts, the
patterns behind them, and where the fixes belong is the **fix phase's job, not graded here.**
- **Mechanism (spot-checked, several cases):** the differing track varies case to case — late IV/Skull
  cluster spacing (mqg+skull long), AP timing (isc+mqg medium), Zerk/Lust alignment (isc+skull medlong),
  whole-layout swaps (isc+mqg long @110); IV/Cold-Snap sequencing recurs most. Recorded as-is; not a
  single confirmed cause, not attributed to §4.1.
- **Length behaviour, per kit (raw worst-deficit by length, no verdict attached):**
  `mqg+skull` 0.22 / 0.16 / 0.19 / 0.38 / 0.32 (short→xl); `isc+scb` 0.77 / — / CLEAN / 0.05 / 0.17;
  `isc+mqg` gone-by-long at low haste (its long/xl deficits are at mid/high haste). Some grow with
  length, some shrink/reverse. **What that implies (quantization vs model error) is for the fix phase**;
  it is a fact here, not a filter.
- **Worst fight-class deficit** is `isc+scb` medium 0.77%; the raw grid shows the tool emits one plan
  across haste 20–245 there and both endpoint plans (@0, @400) out-sim it. Recorded structure, not a
  severity call.
- **The single-worst-cell summary undercounts.** The inline recompute finds **167 borrowed-plan-wins
  columns across the 36 tables** behind the 35 reported worst-cells (long/xl tables carry 2–7 each). The
  collector must report the FULL deficit-column set, not just the worst (§7) — so no violation hides.
- **Plateau caveat.** Where the tool emits one byte-identical plan across most of a kit's haste band
  (isc+scb medium: sim20–245 identical; medlong: sim0–245 identical), the cross-val is barely testing
  *adaptation* there — only the plateau vs the two differing endpoints. A CLEAN plateau ≠ verified fine
  adaptation.
- **NEW from the full set — the SP-trinket-free kits (`scb+skull`, `scb+mqg`) add mid/HIGH-haste
  deficits** at h210–290 (e.g. scb+skull short @h290 0.31%, medium @h210 0.17%, xl @h240 0.19%; scb+mqg
  medium @h235 0.09%), a neighbor-haste plan (@260/265) beating native. This is the **§4.2 region** (we
  lack exhaustive ground truth above ~h150 for these kits because the 5s grid can't express the off-grid
  optimum). Whether these are a real high-haste adaptation gap or grid/quantization noise is next-pass
  triage — flagged, not concluded. (scb+skull long @h90 0.30% is the one that isn't short-fight-only.)

**Bottom line (data-complete, invariants independently re-verified):** invariant A (monoDip=0) holds on
all 36 — recomputed cell-by-cell. **Invariant B (diagonal dominance) currently FAILS: 35/36 tables carry
≥1 deficit (167 borrowed-win columns; worst non-KT 0.77%).** Diagonal dominance should hold on every
table, like monotonicity — every deficit is a violation, and this pass does NOT rank them by importance
or pre-classify them as quantization vs model error. KT carries a measurement caveat (its AoE window is
simmed as downtime, so its number isn't comparable until genapl emits AE — a tooling gap to fix, not a
reason to dismiss it). The model **does not pass** `docs/ACCEPTANCE.md`; **diagnosing the patterns and
eliminating ALL the deficits is the fix phase (PHASE7).** The raw matrices under `tools/xval-results/`
are the record; `node tools/xval-verify.mjs` recomputes the invariants; the collector output is the
authoritative row-by-row table.

### 2.2 Earlier COARSE 5-point runs (0/100/200/300/400) — superseded, kept only as sanity context
Pre-cold-open-fix, pre-breakpoint-grid, loose "no >6 DPS deficit" labeling. NOT authoritative (they
prepulled, and short ones are quantization-limited); do not cite as results. All seven showed native
winning its column with the expected fall-off. Reference shape (seed 20260723, mqg+skull, 3:10) —
native bold on the diagonal, penalty growing with distance from it both ways:

```
plan\sim     0      100      200      300      400
  0       2723.1  2863.0  2984.9  3085.6  3174.1
100       2720.7  2875.9  2994.5  3107.7  3197.3
200       2710.5  2874.8  3014.8  3116.2  3207.9
300       2700.6  2869.6  3002.1  3143.8  3255.6
400       2693.1  2857.7  2994.1  3137.0  3261.1
```

---

## 3. If a diagonal DEFICIT shows up — how to read it

A DEFICIT means: at some sim-haste H, a plan optimized for a *different* haste out-simmed the native
plan. Before believing it's a model bug, rule out the usual suspects in this order (the methodology's
"sim is rarely wrong, we usually used it wrong"):

0. **Boundary quantization (§4.7) — check FIRST, and note the floor is NOT the monotonicity dip.**
   Since the cold-open fix the same-plan monotonicity dip is ~0.00%, so it is NOT a useful noise
   yardstick anymore. The residual noise on a diagonal comparison is **plan-to-plan** boundary
   quantization: two DIFFERENT plans at the same haste have different cast timings, so the fixed
   fight-end cuts a different partial cast from each — worth up to ~0.5–1% on a short fight, shrinking
   with fight length. This is NOT measured by the (now-zero) monotonicity dip. To decide if a
   short/medium-fight deficit is real: **re-measure it robustly** — bump `--iter`, and/or check
   whether the same kit's deficit persists or *grows* on a LONG fight (real model mis-adaptation
   persists; boundary quantization shrinks toward zero as the fight lengthens). Treat a sub-~1%
   short-fight deficit as **unconfirmed** until that check; long/XL-fight deficits are trustworthy
   as-is. (A future harness change to a length-independent metric — total damage over a fixed cast
   count, or the model's effective-AB count — would remove this caveat; §4.7.)
1. **Mana.** Re-confirm `--mana 100000000` actually applied (grep the log for OOM / regen-wait). This
   has bitten us twice.
2. **Fixed-length tail artifact.** A plan with a buff jammed against the kill sims low because the sim
   drops truncated tail casts. If the "winning" borrowed plan just has its terminal burst land a hair
   earlier, it's the var trap — re-check at var10 and confirm the LIVE portion, not the clipped one.
3. **Cold-Snap mapping.** `xval.mjs` marks an IV inside the 180s cd as a CS use and emits a `CS`
   schedule. If the plan has 3 IVs but the APL only fired 2, the CS didn't reset — check the combat
   log for the Cold Snap cast and the second IV aura.
4. **Only then**, if it survives all four: it's a genuine **model mis-adaptation** — the model built
   the wrong layout for that haste. THIS is a Phase-6 finding. Localize it: which track is misplaced?
   Compare the native plan's layout to the winning borrowed plan's, map it to the RULES §16 band
   structure, and figure out which band edge the model put on the wrong side. Document it in §4, don't
   hot-fix — the fix probably belongs in the scorer or a search anchor and needs its own gate.

---

## 4. Findings & open items

**§4.6 and §4.7 are harness bugs FOUND + FIXED this pass** (scb equip; the prepull cast-loss — the big
one). §4.5 collects confirmed NEW model mis-adaptations from the campaign (none yet — the one
persistent deficits found so far are sub-1% low-haste micro-placement gaps in the §4.1 *region* but of
heterogeneous mechanism — not yet attributed to any specific known finding, and not new mis-adaptations
either; triage pending, §4.5). §4.1–4.4 are pre-existing "the tool sits a hair under the true optimum /
we lack ground truth" gaps — known, priced, model-level, deferred. §4.8 is the Phase-7 Ashtongue defer.

### 4.1 The h≈40 straddle-basin slack (kit-universal)
Around 30–70 gear rating, in every trinket kit, the tool's plan sits up to **0.14 eff casts under**
the enumerated grid optimum (worst: isc+skull h25 −0.140, isc+scb h30/h40 straddle band). The
optimum here is an IV pushed *part-way* into Lust, trading GCD overcap against damage-cluster
coupling — a lone-track mid-gap basin that no current `basinHop` anchor reaches (anchors are press
seconds, cd-ticks, kill, ramp exits; this basin is none of those). Inside the 0.15 pressability slack
= monotonicity EPS, so it never trips a gate, but it's the one place the search is demonstrably
sub-optimal. **Fix candidate:** add a "half-into-Lust" straddle anchor for IV (Lust.start +
{5,10,15}) to basinHop's anchor set, gated on it not regressing the 25 goldens. Cheap to try.
**Sim relationship (Phase-6 campaign, §2.1) — RELATED but do NOT claim "sim-confirmed §4.1":** the
cross-val shows sub-1% diagonal deficits clustered at **low passive haste (≤70)** across kits and
lengths, length-independent (so not pure boundary quantization) — the same *region* as this basin.
BUT spot-checking the actual native-vs-borrowed plan diffs (§2.1/§4.5) shows the mechanism is
**heterogeneous** (late IV/Skull cluster spacing, AP timing, Zerk/Lust alignment — not specifically
"IV part-way into Lust" in the cases checked). So the sim corroborates §4.1's *general* claim ("the
search is a hair sub-optimal at low haste") but has **not** isolated this specific IV-into-Lust
mechanism as the cause. Next-pass triage: for each low-haste deficit, check whether the winning plan
differs from native in the IV-into-Lust straddle (⇒ §4.1, and the half-into-Lust anchor fixes it) or
in some other track (⇒ a broader low-haste search gap). This pass only gathers + localizes.

### 4.2 The 5s-grid isn't converged at high haste (no ground truth there)
In the three kits where the SP trinket is free/absent (scb+skull, scb+mqg, skull+mqg), the tool sims
**+0.15 to +0.21 casts ABOVE** the grid's top-1 at high haste — because the true optimum uses
off-grid presses (AP at t=2–4 ramp-snap, Skull at t=59) the 5s grid can't express. This is GOOD for
the tool but means the brute is no longer a valid certifier in that regime — we currently have **no
exhaustive ground truth above ~h150 for those kits**. **Fix candidate:** a 1s-resolution brute in a
narrowed window around the grid optimum (not full 1s enumeration — 8M×5^4 is too big), or an analytic
optimum from the closed-form cast-rate integral. Needed before any high-haste claim for those kits
can be called "certified" rather than "tool ≥ coarse grid."

### 4.3 The press-boundary phase blind spot (~0.1%)
The scorer phase-averages the sub-GCD press-to-boundary offset at steady state (deliberately — it's a
uniform fraction of a GCD set by opener/latency). Near a ramp exit the boundaries are sparse and this
averaging is slightly wrong; worth ~0.1% and it's why ramp-adjacent gates read cleaner at var10 than
var0. Documented, accepted; only worth revisiting if a diagonal violation localizes to a ramp-exit press.

### 4.4 Mana is out of the objective (by design — user decision)
The planner is layout-first; the per-window mana chip is the mana UX ceiling. The OOM detour (RULES
§16 gate audit) is the standing reminder: at h150 an 80s full burn is dry by 0:25 (34 ABs vs 64). Not
a bug — a scope boundary. If a future phase wants mana-aware *layout*, it's a large piece (the whole
finite-mana model was explicitly rejected before) and needs its own design, not a patch here.

### 4.5 (placeholder) Model mis-adaptations from the cross-val sweep
_A CONFIRMED diagonal deficit — one that survives the §3 triage AND is trustworthy by length (§3.0:
long/XL, or persists/grows with fight length; not a sub-1% short-fight quantization artifact) — goes
here with: seed, fight, kit, the sim-haste it fails at, the borrowed plan that beat native, the
misplaced track, and the RULES §16 band edge the model put on the wrong side._

**This pass records the violations; it does NOT rank or classify them.** Every diagonal deficit is a
violation of a property that should hold everywhere (like monotonicity) — the fix phase (PHASE7) decides
the patterns, which are model errors vs measurement artifacts, and where the fixes belong. Two earlier
reads of mine were too strong and are walked back (DIARY ledger): (1) these are NOT "the §4.1 basin,
sim-confirmed" — the differing track is heterogeneous; (2) NOT "length-persistent across kits."

**The data for the fix phase (un-triaged):**
- The full deficit set is `node tools/xval-collect.mjs tools/xval-results` (all 36 tables, worst cell +
  locus) and `node tools/xval-verify.mjs` (every borrowed-win column, all 167). Neither grades severity.
- Raw facts already gathered, offered without a verdict: the differing tracks seen in spot-checks (late
  IV/Skull spacing, AP timing, Zerk/Lust alignment, whole-layout swaps; IV/Cold-Snap sequencing recurs);
  the per-kit length behaviour (some deficits grow with length, some shrink/reverse — §2.1); the plateau
  structure on `isc+scb` medium (one plan spans haste 20–245); and the 167 hidden borrowed-win columns.
- **For the fix phase, not decided here:** whether "grows with length" ⇒ model error and "reverses" ⇒
  quantization; whether the plateau needs a finer breakpoint; whether the mechanism is §4.1 or broader;
  and the target = **zero diagonal deficits** (make invariant B provably hold), not "the important ones."

### 4.6 Harness bug (FIXED) — scb needs the Serpent-Coil TRINKET equipped, not the Mana Emerald
The cross-val's first scb runs crashed the sim: `SIM ERROR: No item with id: 22044`. Root cause was
a mis-mapping in `xval.mjs`, NOT a model or genapl bug — and the mechanism is worth writing down
because scb is genuinely different from the other three:
- **scb ("Serpent-Coil") is not a straightforward on-use trinket.** The equipped item is
  **Serpent-Coil Braid (30720)**, a trinket whose effect is a proc: *casting a Mana Gem* grants the
  **"Mana Surge"** aura (+225 SpellDamage, 15s; wowsims `sim/mage/items.go` `NewItemEffect(30720)`,
  `ClassSpellMask MageSpellManaGem`, `CallbackOnCastComplete`). The model's "scb" on-use = pop a Mana
  Emerald while wearing SCB. That's why scb is **not** in `OFF_TRINKETS` (line ~618) — it doesn't
  compete for the on-use GCD/lockout the way Icon/Skull/MQG do; its cd is the mana gem's (~120s) and
  its charges are the gem's (3).
- **genapl was already correct:** its `Gem` key fires `itemId 22044` = the Mana Emerald cast, which
  triggers the SCB proc. The bug was only that `xval.mjs` tried to EQUIP 22044 (a consumable, absent
  from the item DB) in a trinket slot. Fix: equip **30720** (the trinket), keep firing 22044 (the gem).
- **Verified:** the +225 SP Mana Surge fires under BOTH `--mana ∞` and `--mana 900000` (the gem casts
  even at full pool). All draws are ≤333s ⇒ ≤3 scb uses ⇒ within the 3-charge budget.
- **Latent implication to check later (not this phase):** past scb sim cross-checks used the same
  genapl `Gem`=22044 against exports that DID wear SCB (30720), so those fired correctly — but any
  scb sim run against an export NOT wearing 30720 would have silently no-op'd the buff. And a real
  open question: **does the model's OFF_TRINKETS correctly exclude scb?** In wowsims, Icon (29370) and
  the Serpent-Coil-boosted mana gem do NOT share the on-use lockout (SCB is a passive proc + a mana
  gem cast, off-GCD), so the model's exclusion looks right — but this deserves an explicit sim gate
  (fire Icon and the gem in the same second; confirm both buffs land) before it's called certified.

---

### 4.7 ✅ RESOLVED — the measurement was PREPULLING; the model opens COLD. Fixed.
Haste-monotonicity is a **hard invariant**: ∞ mana + fixed rotation ⇒ more haste ⇒ each cast is ≤ as
long ⇒ **≥ casts ⇒ ≥ damage**, never a decrease. The sim was violating it (pure AB spam, var0,
dur80: **h130 = 53 casts, h140 = 52** — a lost cast at higher haste).

**Root cause: the sim was PREPULLING, and the model NEVER prepulls.** `genapl` defaulted to one
prepull Arcane Blast scheduled at a **fixed wall-time (−2.3s)** that does not scale with haste — so at
higher haste it finishes early and mistimes the whole opener ramp (measured: h140's first cast
*intervals* [2.3, 1.99, 1.68] were **longer** than h130's [2.0, 1.69, 1.39], and it took an extra cast
to reach steady state). That opener corruption is what lost the cast. The model opens **COLD** (0
stacks, RULES §3 — no prestack), so the sim must too.

**Fix:** `genapl` now defaults `_prestack = 0` (cold open) with a ★★★ hard-note header, and `xval.mjs`
sets `_prestack:0` explicitly. **Verified:** cold-open pure-AB DPS is now **strictly non-decreasing**
across h100–200 (2324.5 → 2325.3 → 2365.9 → … → 2452.4, every step up), and the mqg+skull short combo
reports **monoDip = 0.00%**. The residual ±1 cast-*count* flicker at a boundary (h150→h160) is a cast
landing on the fight-end line; it contributes ~0 to DPS (the metric the cross-val uses), which stays
monotone. **DO NOT prepull in any model-compared sim — see the genapl header and §1.**

Consequence: the SAME-plan monotonicity floor is now ~0, so a nonzero monoDip is a clean regression
signal. This does **not** mean every diagonal deficit is real: a *diagonal* comparison is between
DIFFERENT plans at the same haste, so short fights still carry plan-to-plan boundary quantization (up
to ~0.5–1%) that the same-plan floor does not capture (§3.0). So a sub-1% short/medium deficit stays
UNCONFIRMED; long/XL deficits, or ones that grow with length, are the real signal. Campaign UNBLOCKED
and gathering — the live deficits are all sub-1%, but they do NOT all vanish with length: a low-haste
(≤70) cluster persists onto long/XL fights (§2.1/§4.5), so it is a real tiny search-slack, not pure
quantization (mechanism heterogeneous, triage next pass). NOTE: weigh short-fight deficits
against fight length.

### 4.8 (Phase 7) Ashtongue Talisman of Insight is NOT in the cross-val kits
The cross-val covers the six pairs of {Icon, Serpent-Coil, Skull, MQG} only. **Ashtongue (`ati`, the
random 145-rating/5s on-crit proc) is excluded** — deliberately deferred to Phase 7. It's a *random
proc*, not an on-use, so it needs a different treatment (its haste is stochastic; the model already
carries a deterministic-average `ati` haste curve, RULES §14, which would itself need sim-validation).
Fold it in when Phase 7 opens; note it also interacts with the trinket lockout differently (it's a
passive proc, so it can coexist with an on-use trinket).

## 5. Instruments (where they are, how to run)

All durable in the repo; the sim rig lives in the **session scratchpad** (ephemeral — rebuild per
fresh session, see §6).

- **`index.html`** — the product. Engine in `<script id="engine-src">`, pooled Blob workers, the
  optimizer. Tests drive the sequential in-page path.
- **`tools/xval.mjs`** — the cross-val instrument (this phase). `node tools/xval.mjs <seed>`. Env:
  `KIT=a,b` (explicit kit; else seed-drawn), `TCLASS=short|medium|medlong|long|xl` (fight class),
  `HASTES=…` (the haste set; defaults to the coarse `0,100,200,300,400`), `BOSS="Lady Vashj"|…` (load
  a preset's T/Lust/segments instead of a class-drawn fight), `ITER`, `SCRATCH`. Forces cold open
  (`_prestack:0`) and ∞ mana. Prints the N×N matrix + an `XVAL-DONE … monoDip diag diagWorst` line.
- **`tools/xval-haste-sets.json`** — the committed per-kit breakpoint-straddle haste sets (the §1
  granularity table, source of truth). Read by `xval-kit.sh`.
- **`tools/xval-kit.sh`** — campaign driver for ONE kit across all five fight-classes, using that
  kit's set from the JSON above. `bash tools/xval-kit.sh mqg,skull`. Tees full matrices to
  `$XVDIR/<kit>-<class>.txt`, seeds each class deterministically (`1000 + cksum(kit)%9000 + classIdx`).
- **`tools/xval-campaign.sh`** — runs all six kits (`xval-kit.sh` each), 2-concurrent, `ITER=6000`.
  The whole fight-class campaign in one command.
- **`tools/xval-boss.sh`** — the boss-shape cross-val: each boss preset's real T/Lust/phases (via
  `xval.mjs` BOSS mode) × representative kits. Default set = Vashj + Al'ar + KT × {mqg,skull; isc,scb}.
  Vashj/Al'ar sim cleanly (intermission-only); KT's AoE phase is simmed as downtime (flagged).
- **`tools/xval-collect.mjs`** — reads a directory of `xval` outputs → the §2.1 CLEAN/DEFICIT ledger
  markdown (`node tools/xval-collect.mjs tools/xval-results`); asserts every `monoDip ≈ 0`.
- **`tools/xval-verify.mjs`** — the deterministic, committed **invariant recompute** (the arithmetic half
  of the adversarial check, restart-proof unlike an LLM agent). Parses every matrix and independently
  verifies monoDip (invariant A) and diagonal dominance (invariant B — worst deficit + ALL borrowed-win
  columns), cross-checking each file's reported `diagWorst`. `node tools/xval-verify.mjs`.
- **`tools/brute-grid.mjs`** — full 5s-grid exhaustive brute. `--pair a,b` (any 2 trinkets), `--tool`
  (also run the optimizer + print tool-vs-grid), `--aoe`/`--burn` (Phase 5). ~7.9M cells/haste, <1min.
- **`tools/haste-ladder.mjs`** — the brute marched across haste with breakpoint bisection.
  `--pair a,b --step N --bisect M --out file.json`. Produced the RULES §16 band maps.
- **`tools/ladder-analyze.mjs`** — deterministic band-table extraction + cross-pair alignment from
  ladder JSONs. `node tools/ladder-analyze.mjs tools/ladders/*.json`.
- **`tools/ladders/*.json`** — the committed six-pair ladder evidence + the verify scripts.
- **`tools/explore.mjs`** — the original exploration harness (placement brute over a haste sweep,
  `--sim` cross-check).
- **`tools/genapl.mjs`** — model-plan → wowsims APLRotation JSON. Keys IV/AP/CS/Zerk/BL/Icon/Gem +
  now Skull/MQG. This is what turns a schedule into something the runner can sim.
- **The sim rig** — `runner-ap180` (built from `tools/wowsims-patches/runner-main.go` +
  `apl-schedule-strict-ready.patch` + `ap-cd-at-cast.patch`, wowsims @ ade9f39, `-tags with_db`).
  Provenance checks: `arcane_power.go` has NO `CD.Use` in the OnExpire; the schedule action gates on
  strict `spell.IsReady`. See TOOLING.

## 6. Reproducing from a fresh session (the rig is ephemeral)
1. Clone wowsims `tbc-new` @ `ade9f39` into the scratchpad; drop in `tools/wowsims-patches/*` (the
   runner main + the two patches); `go build -tags with_db -o runner-ap180 ./cmd/runner`.
2. Trust-anchor: a bare-rotation run reproduces the baseline DPS to the decimal (TOOLING §trust).
3. The gear export is user data (NOT in repo). `xval.mjs` trinket-swaps a copy; never commit an export.

## 7. Task list — status
**Done this pass:** §4.7 measurement fix (cold open); §4.6 scb fix; breakpoint haste grids +
fight-classes; `xval.mjs` BOSS mode (loads a preset's T/Lust/segments — Vashj/Al'ar sim cleanly,
KT's AoE window is simmed as downtime with a flag, §4.8-adjacent limitation); campaign drivers
(`xval-kit.sh`, `xval-campaign.sh`, `xval-collect.mjs`).

**Also done this pass (data-gathering COMPLETE):** the full campaign — all 30 fight-class tables + 6
boss tables — is committed to `tools/xval-results/` (monoDip=0.00% on all 36); the §2.1 ledger is
assembled; the diary/acceptance/archive docs are stood up (`docs/DIARY.md`, `docs/ACCEPTANCE.md`,
`docs/archive/`). This pass's remit (gather correct, clearly-labeled data) is DONE.

**Remaining (mostly NEXT / fix pass):**
1. ✅ Campaign + boss runs committed; ✅ ledger assembled (§2.1); ✅ monoDip=0 confirmed on all 36.
2. **[FIX PASS] Triage the trustworthy deficits** (§3; long/XL or length-persistent only) → §4.5. Finding
   (adversary-refined): the real one is **`mqg+skull`'s low-haste slack** (grows onto long/XL — not
   quantization; heterogeneous mechanism, IV/CS sequencing recurs); `isc+scb`/`isc+mqg` low-haste
   deficits reverse/vanish with length (quantization). Also chase `isc+scb` xl's hidden length-robust
   deficit (plan@65 wins mid-haste columns). Classify each differing track; route to §4.1 or a new finding.
3. **Adversarial pass — 18-table DONE, full-set (36) IN FLIGHT.** The first agent recomputed every cell
   and refuted two overstatements (the "length-persistent across kits" generalization and the
   `isc+scb`-medium "low-haste" label); confirmed monoDip=0 and sub-1% everywhere. Folded into §2.1/§4.5.
   The full 36-table re-run is running now (verifies the 12 new fight-class + 6 boss tables, incl. the
   KT-exclusion soundness); reconcile §2.1's "bottom line" verdict when it returns.
4. ✅ **[DONE in PHASE7] Collector full-column upgrade** — `xval-collect.mjs` reports every
   borrowed-win column + length-robust loci (+`--json` target export); reconciles with
   `xval-verify.mjs` (167 columns).
5. ✅ **[DONE in PHASE7] KT AoE** — genapl `_aoe` windows cast Arcane Explosion; xval BOSS mode passes
   `--targets N`; sim-verified (AE ×6 targets inside the window, AB re-ramps at the exit).
6. ✅ **[DONE in PHASE7] The metric** — var0.5 (the model-matched kill window) + wall-jitter on boss
   tables; see TOOLING/ACCEPTANCE and PHASE7 §5.4.
7. **Phase 7**: fold in Ashtongue (§4.8).

## 8. Guardrails (do not regress)
- **Determinism:** one setup ⇒ one plan. No `Date.now`/`Math.random` outside the seeded PRNG. The
  pool/cache/memo speedups are all purity-preserving — keep them so.
- **Exact-match 25/25** at every commit that touches the engine (`cd tests && node exact-match.mjs`).
- **Sim protocol:** ∞ mana (§4.4 trap), the AP-180 runner, trinket indices 12/13 (§1). Sim-gate novel
  findings against a pre-registered model prediction; run an **adversarial refutation pass** before
  locking anything into RULES.
- **Never leak identity/model ids** into `index.html` or any pushed artifact. Discord handle only.
