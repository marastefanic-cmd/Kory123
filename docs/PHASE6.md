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
| xl | 3-min ×3 (mqg ×2) | 385–460 |

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

### 2.1 Campaign results — LIVE / PARTIAL (regenerate with `node tools/xval-collect.mjs tools/xval-results`)
**Status: 9/30 fight-class tables committed to `tools/xval-results/` + boss runs pending.** Completed
tables are flushed to that durable dir as they land (the scratchpad is ephemeral), so this ledger is
never ahead of what's on disk. Headline: **monoDip = 0.00% on every table** (the §1(a) cold-open
invariant holds — measurement is correct). All diagonal deficits are **sub-1%**. The two completed
kits show **different** deficit signatures — do NOT summarize them as one "shrinks with length" trend:

| kit | class | T | band | monoDip | diag deficit | deficit cell (borrowed plan > native) |
|-----|-------|---|------|---------|--------------|----------------------------------------|
| mqg+skull | short   | 110 | short   | 0.00% | 0.22% | @sim70: plan@100 > native@70 |
| mqg+skull | medium  | 178 | medium  | 0.00% | 0.16% | @sim30: plan@70 > native@30 |
| mqg+skull | medlong | 226 | medlong | 0.00% | 0.19% | @sim70: plan@0 > native@70 |
| mqg+skull | long    | 283 | long    | 0.00% | 0.38% | @sim70: plan@100 > native@70 |
| mqg+skull | xl      | 395 | xl      | 0.00% | 0.32% | @sim30: plan@70 > native@30 |
| isc+scb   | short   | 98  | short   | 0.00% | 0.55% | @sim140: plan@245 > native@140 |
| isc+scb   | medium  | 184 | medium  | 0.00% | 0.77% | @sim20: plan@0 > native@20 |
| isc+scb   | medlong | 220 | medlong | 0.00% | **CLEAN** | — |
| isc+scb   | long    | 300 | long    | 0.00% | 0.05% | @sim20: plan@0 > native@20 |

**Two distinct signatures (the reason this matters):**
- **mqg+skull → the §4.1 low-haste basin, sim-confirmed.** EVERY deficit — at all five lengths — lands
  at **sim-haste 30 or 70**, won by a plan built for a *neighboring higher* haste. That is exactly the
  documented **§4.1 "h≈40 straddle-basin slack"** (30–70 rating, the IV-part-way-into-Lust basin no
  `basinHop` anchor reaches). It does **NOT** shrink with fight length (long 0.38%, xl 0.32%), which
  *rules out* pure boundary quantization and *rules in* §4.1: the tool's h30–70 plan is genuinely a
  hair (~0.2–0.4% DPS) under optimal, and a neighbor-haste plan happens to sit closer to the true
  optimum there. **This is not a new finding — it's the sim end-to-end confirmation of a known,
  priced, fix-candidate'd model slack.** Next-pass triage: confirm the winning borrowed plan differs
  from native only in the IV-into-Lust straddle; if so, §4.1's "half-into-Lust anchor" fix addresses it.
- **isc+scb → mostly clean.** medlong CLEAN, long 0.05% (one cast at h20, ≈ noise). The short/medium
  deficits (0.55% @h140, 0.77% @h20) are on short fights and inside the plan-to-plan quantization band
  (§3.0) — UNCONFIRMED; the h140 short one (a plan built for h245 winning) is the odd one out and gets
  explicit triage next pass.

_Remaining: isc+scb xl, the four other kits (isc+skull started — short 0.43%), and the boss shapes.
This table + a per-kit rollup finalize when the campaign completes; the raw matrices are the record._

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
persistent deficit found so far is the known §4.1 basin, sim-confirmed, not new). §4.1–4.4 are
pre-existing "the tool sits a hair under the true optimum / we lack ground truth" gaps — known,
priced, model-level, deferred. §4.8 is the Phase-7 Ashtongue defer.

### 4.1 The h≈40 straddle-basin slack (kit-universal)
Around 30–70 gear rating, in every trinket kit, the tool's plan sits up to **0.14 eff casts under**
the enumerated grid optimum (worst: isc+skull h25 −0.140, isc+scb h30/h40 straddle band). The
optimum here is an IV pushed *part-way* into Lust, trading GCD overcap against damage-cluster
coupling — a lone-track mid-gap basin that no current `basinHop` anchor reaches (anchors are press
seconds, cd-ticks, kill, ramp exits; this basin is none of those). Inside the 0.15 pressability slack
= monotonicity EPS, so it never trips a gate, but it's the one place the search is demonstrably
sub-optimal. **Fix candidate:** add a "half-into-Lust" straddle anchor for IV (Lust.start +
{5,10,15}) to basinHop's anchor set, gated on it not regressing the 25 goldens. Cheap to try.
**Sim-confirmed end-to-end (Phase-6 campaign, §2.1):** the `mqg+skull` cross-val shows a diagonal
deficit at **every** fight length, always at **sim-haste 30–70**, won by a neighbor-higher-haste plan
— worth **~0.2–0.4% DPS**, and length-independent (so not boundary quantization). That is this basin
manifesting in the real sim, not just in the eff-cast count vs the brute grid. It raises the priority
of the half-into-Lust anchor fix (still deferred to a fix pass; this pass only gathers).

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
misplaced track, and the RULES §16 band edge the model put on the wrong side._ **Nothing NEW confirmed
yet, but the campaign has sim-confirmed an EXISTING finding:** every `mqg+skull` deficit (all five
lengths, §2.1) localizes to **sim-haste 30–70** with a neighbor-higher-haste plan winning, and does
**not** shrink with length (long 0.38%, xl 0.32%) — which is the end-to-end sim signature of the
already-documented **§4.1 low-haste straddle basin**, not a new mis-adaptation. Do NOT count it here as
a fresh Phase-6 finding; its home and fix candidate are §4.1. (Correction to an earlier provisional
read: the deficits do NOT uniformly "shrink with length" — that held for `isc+scb` but not for
`mqg+skull`, whose §4.1-basin deficit is length-independent.) The `isc+scb` short/medium deficits
(0.55% @h140, 0.77% @h20) remain sub-1% short-fight, UNCONFIRMED (§3.0) pending triage.

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
and gathering — the live short/medium deficits (0.16–0.77%) are exactly in the quantization band and
shrink with length, consistent with no model mis-adaptation (provisional; confirm via the collector
rollup + adversarial pass). NOTE: weigh short-fight deficits
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

**In progress / remaining:**
1. **Finish the campaign** (`xval-campaign.sh`, running 2-concurrent) — 6 kits × 5 classes; then the
   three boss shapes (`BOSS="Lady Vashj"|"Al'ar"|"Kael'thas Sunstrider" node tools/xval.mjs <seed>`).
   Commit the raw matrices to `tools/xval-results/`.
2. **Assemble the ledger** (§2.1) from `xval-collect.mjs`; confirm every `monoDip≈0`.
3. **Triage the trustworthy deficits** (§3; long/XL or length-persistent only) → §4.5. Provisional
   read: deficits are sub-1% and shrink with length ⇒ likely all boundary quantization, no model
   mis-adaptation — CONFIRM, don't assume.
4. **Adversarial pass**: an agent tries to refute the "clean diagonal" claim against the raw matrices.
5. **KT AoE**: to sim KT's AoE phase properly, genapl needs Arcane-Explosion emission during AoE
   windows (currently simmed as downtime — KT numbers exclude AoE damage). Small addition; do before
   trusting KT.
6. **(Optional, next pass) length-independent metric** — total damage over a fixed cast count, or the
   model's effective-AB count — would erase the short-fight quantization caveat entirely (§3.0).
7. **Phase 7**: fold in Ashtongue (§4.8).

## 8. Guardrails (do not regress)
- **Determinism:** one setup ⇒ one plan. No `Date.now`/`Math.random` outside the seeded PRNG. The
  pool/cache/memo speedups are all purity-preserving — keep them so.
- **Exact-match 25/25** at every commit that touches the engine (`cd tests && node exact-match.mjs`).
- **Sim protocol:** ∞ mana (§4.4 trap), the AP-180 runner, trinket indices 12/13 (§1). Sim-gate novel
  findings against a pre-registered model prediction; run an **adversarial refutation pass** before
  locking anything into RULES.
- **Never leak identity/model ids** into `index.html` or any pushed artifact. Discord handle only.
