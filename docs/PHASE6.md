# PHASE 6 — Haste-adaptation cross-validation & the open soft spots

**Status:** IN FLIGHT — **campaign BLOCKED on a measurement anomaly (§4.7).** Phases 4 (search
robustness) and 5 (AoE) are CLOSED; the six-kit ladder campaign (RULES §16) certified the search
against exhaustive enumeration across every trinket pair and the full haste range. Phase 6 asks the
next question: **does the planner's haste-ADAPTATION hold up in the real sim, end to end, on random
fights it has never seen — and where are the remaining cracks?** The instrument, granularity, and
fight-classes are built and validated, and several harness bugs were found+fixed — but the sim
currently produces a **physically-impossible result** (a fixed rotation losing a cast as haste rises,
§4.7), so **no cross-val verdict is trustworthy until that measurement is fixed.** This pass's job is
to make the data correct and record it; the next pass decides model changes. **Start at §4.7.**

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
   - **(a) Haste-monotonicity — a strict invariant, used as a DATA-QUALITY canary.** With ∞ mana,
     more haste ⇒ ≥ casts ⇒ ≥ damage; haste is *never* harmful, so a fixed plan's row MUST be
     non-decreasing. Any observed dip is therefore **not physics and not the model — it is a broken
     measurement** (§4.7: the sim currently fits *fewer* casts at higher haste, an impossible result).
     The harness reports the worst dip's magnitude as the per-table **noise floor** — but until §4.7
     is fixed, a nonzero floor means the whole table is suspect, not merely imprecise.
   - **(b) Diagonal dominance — the model test.** In every column, does the native (diagonal) plan
     sim ≥ every plan borrowed from another haste? The harness reports **CLEAN** (native is the max
     in every column) or **DEFICIT X%** (a borrowed plan out-simmed the native somewhere, by X% at
     the named cell). No tolerance is applied in the label — but a deficit **below that table's
     monotonicity noise floor (a) is not trustworthy** (it can't be told apart from quantization).
     A deficit *above* the floor is a real signal. Deciding what to do about a real one is the NEXT
     pass.

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
(Regenerate with the snippet in `scratchpad/haste-sets.json`'s builder if the ladders change.)

### Fight-length classes (user-directed; 2-min = skull/scb/isc, 3-min = IV/AP/Zerk, 5-min = mqg; CS→IV grants IV +1)
| class | rule | length band (s) |
|-------|------|------|
| short | each CD once | 75–115 |
| medium | 2-min ×2, 3-min ×1 | 150–195 |
| medlong | both 2- and 3-min ×2 | 205–255 |
| long | 2-min ×3, 3-min ×2 | 265–375 |
| xl | 3-min ×3 (mqg ×2) | 385–460 |

### Sim protocol locked in (do NOT deviate — each cost us a real bug once)
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

**Two grids were run. Read the caveats — the coarse grid predates the fixes/labeling.**

**(i) Coarse 5-point grid (0/100/200/300/400), earlier "no >6 DPS deficit" labeling — pre-quantization-finding.** All seven kits showed the native plan winning its column with the
now-familiar fall-off away from the diagonal. Treat as *encouraging but not authoritative* (loose
label; the short-fight ones are inside the §4.7 quantization floor):

| seed | fight | kit | note |
|------|-------|-----|------|
| 20260723 | 3:10 | mqg+skull | reference matrix below |
| 7 | 1:33 | mqg+skull | SHORT — inside quantization floor, discount |
| 5 | 5:18 | isc+skull | long — meaningful |
| 9 | 2:35 | isc+mqg | medium |
| 2 | 5:33 | scb+skull | long — meaningful (scb fix §4.6) |
| 3 | 5:28 | isc+scb | long — meaningful (scb fix §4.6) |
| 8 | 2:21 | scb+mqg | medium (scb fix §4.6) |

**(ii) Breakpoint-straddle grid + CLEAN/DEFICIT labeling + fight-classes — the REAL campaign: NOT
YET RUN.** Blocked on the §4.7 metric decision (short/medium fights are quantization-limited, so
their DEFICIT labels aren't trustworthy as-is). The harness (`tools/xval.mjs`), the per-kit haste
sets (§1), and the fight classes are all ready; launch once the metric question is resolved. Fill
this table then, one row per (kit × fight-class × boss-preset), with the fight length shown so each
row's noise floor is visible.

Reference matrix (seed 20260723, coarse grid), for the *shape* a healthy result has — native bold,
penalty grows with distance from the diagonal in both directions (this shape is real; the sub-1%
magnitudes on this 3:10 fight are partly quantization):

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

0. **Quantization floor (§4.7) — check FIRST.** Is the deficit smaller than this table's monotonicity
   dip (the noise floor the harness prints)? On a short/medium fight that floor is ~1–3%. If the
   deficit is under it, it is **not trustworthy** — it's indistinguishable from the fixed-length DPS
   cutoff artifact. Only deficits ABOVE the floor are real signal. (This is the change that made the
   earlier 0.62% short-fight "deficit" a non-finding.)
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

**§4.7 is a MEASUREMENT-CORRECTNESS BLOCKER — start there.** §4.6 is a harness bug found+fixed this
pass. The rest (§4.1–4.4) are pre-existing "the tool sits a hair under the true optimum / we lack
ground truth" gaps — known, priced, model-level, deferred. §4.8 is the Phase-7 Ashtongue defer.

### 4.1 The h≈40 straddle-basin slack (kit-universal)
Around 30–70 gear rating, in every trinket kit, the tool's plan sits up to **0.14 eff casts under**
the enumerated grid optimum (worst: isc+skull h25 −0.140, isc+scb h30/h40 straddle band). The
optimum here is an IV pushed *part-way* into Lust, trading GCD overcap against damage-cluster
coupling — a lone-track mid-gap basin that no current `basinHop` anchor reaches (anchors are press
seconds, cd-ticks, kill, ramp exits; this basin is none of those). Inside the 0.15 pressability slack
= monotonicity EPS, so it never trips a gate, but it's the one place the search is demonstrably
sub-optimal. **Fix candidate:** add a "half-into-Lust" straddle anchor for IV (Lust.start +
{5,10,15}) to basinHop's anchor set, gated on it not regressing the 25 goldens. Cheap to try.

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
_Empty until §4.7 is resolved and the campaign runs. A confirmed diagonal deficit (exceeds its
table's noise floor AND survives the §3 triage) goes here with: seed, fight, kit, the haste it fails
at, the misplaced track, and the band edge the model got wrong._ Nothing recorded yet — the coarse
runs in §2(i) are not authoritative and the real campaign (§2(ii)) is blocked on §4.7.

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

### 4.7 ★ CRITICAL OPEN ANOMALY — the sim fits FEWER casts at higher haste (measurement is WRONG; block the campaign on this)
Haste-monotonicity is a **hard invariant**: with ∞ mana, on a FIXED-length fight with a FIXED
rotation, more haste ⇒ each cast is ≤ as long ⇒ **≥ casts fit ⇒ ≥ damage**. Worst case equal (the
extra haste didn't buy a cast). It can **never decrease.** The sim violates this:

**Smoking gun (pure AB spam, var0, dur80, deterministic single iter, ∞ mana):**
| haste | AB casts | total AB dmg | last cast completes |
|---|---|---|---|
| **130** | **53** | 202398 | 79.93s |
| **140** | **52** | 197681 | 79.00s |

More haste (140 > 130) fits **one FEWER cast** and does **less** damage — implied per-cast spacing
1.519s at h140 vs 1.508s at h130, i.e. the sim's AB casts are *slower at higher haste* around here.
That is physically impossible for a correct measurement, so **the data is not yet trustworthy** — my
earlier "fixed-length DPS quantization" note was wrong (quantization gives a flat step, never a
*decrease* / a *lost cast*). This is the anomaly, unexplained.

Candidate causes to test NEXT pass (do not assume): cast-time / GCD **rounding to a discrete tick**
that a small haste bump pushes across a boundary the wrong way; a real-TBC haste-breakpoint rounding
mechanic (which normally makes a monotone staircase, not a decrease — so a decrease would still be
suspect); the opener-ramp (0→3 stack) cast-time interaction with the fixed end; or a `--haste`
bonusStats injection quirk. Also observed and relevant: **`--seed 7/42/99` gave byte-identical DPS**
→ `--seed` does not vary the sample (deterministic per config), so this is not statistical noise —
it's a reproducible, deterministic wrong-direction result.

**This BLOCKS the campaign.** Until a fixed-rotation haste sweep is verified strictly non-decreasing
(cast count and total damage), diagonal-dominance deficits cannot be trusted — a "deficit" could be
this same lost-cast artifact rather than a model mis-adaptation. **First task of the next pass:
resolve this** (fix the measurement, or switch to a metric that is provably monotone in haste — e.g.
total damage over a fixed CAST COUNT rather than a fixed fight length, or the model's own effective-AB
count), then gather the campaign.

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
- **`tools/xval.mjs`** — the cross-val instrument (this phase). `node tools/xval.mjs <seed>`.
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

## 7. Next-pass task list (in order)
1. **Resolve §4.7 (BLOCKER).** Verify a fixed-rotation, ∞-mana haste sweep is strictly non-decreasing
   in cast count AND total damage. Find why the sim currently loses a cast (h130=53 → h140=52).
   Likely: switch the cross-val metric to something provably monotone in haste — total damage over a
   fixed CAST COUNT, or the model's own effective-AB count — rather than DPS over a fixed fight length.
   Do NOT proceed until a monotone sweep is demonstrated.
2. **Run the campaign** (§2(ii)): 6 kits × 5 fight-classes + Vashj / Kael'thas / Al'ar boss shapes, on
   the per-kit breakpoint grids (§1), ∞ mana, honest CLEAN/DEFICIT labeling. Boss shapes need `xval.mjs`
   extended to load a preset's T/Lust/segments (it currently builds `segments:null`).
3. **Triage every real deficit** (§3) → record confirmed model mis-adaptations in §4.5.
4. **Adversarial pass**: an agent tries to refute the campaign's clean-diagonal claims against the raw
   matrices before anything is called certified.
5. **Phase 7**: fold in Ashtongue (§4.8).

## 8. Guardrails (do not regress)
- **Determinism:** one setup ⇒ one plan. No `Date.now`/`Math.random` outside the seeded PRNG. The
  pool/cache/memo speedups are all purity-preserving — keep them so.
- **Exact-match 25/25** at every commit that touches the engine (`cd tests && node exact-match.mjs`).
- **Sim protocol:** ∞ mana (§4.4 trap), the AP-180 runner, trinket indices 12/13 (§1). Sim-gate novel
  findings against a pre-registered model prediction; run an **adversarial refutation pass** before
  locking anything into RULES.
- **Never leak identity/model ids** into `index.html` or any pushed artifact. Discord handle only.
