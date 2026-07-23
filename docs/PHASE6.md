# PHASE 6 — Haste-adaptation cross-validation & the open soft spots

**Status:** IN FLIGHT (this doc is the handoff for whoever cracks the items in §4). Phases 4 (search
robustness) and 5 (AoE) are CLOSED; the six-kit ladder campaign (RULES §16) certified the search
against exhaustive enumeration across every trinket pair and the full haste range. Phase 6 asks the
next question: **does the planner's haste-ADAPTATION hold up in the real sim, end to end, on random
fights it has never seen — and where are the remaining cracks?**

Read `CLAUDE.md` → `docs/MECHANICS.md` → `docs/RULES.md` (esp. §16) → `docs/TOOLING.md` (the sim
methodology + the ★ mana trap) before touching anything here.

---

## 1. What this phase is testing (the cross-validation experiment)

The planner claims to *re-optimize the layout as gear haste changes* — the ladders proved it finds
the model's global optimum at every haste, but that's a statement about the **model**. Phase 6 asks
the **sim** whether the model adapted *correctly*: is the plan the tool builds for haste H actually
the best plan at H when you run it in wowsims, or would a plan built for a different haste beat it?

The instrument is a **holdout cross-validation matrix** (`tools/xval.mjs`):

1. Seed-draw a random fight: length (1:30–7:00), Bloodlust time, and 2 of {Icon, Serpent-Coil,
   Skull, MQG}. Deterministic mulberry32 from the seed, so every run is reproducible.
2. Optimize a plan at passive haste **0/100/200/300/400** (dedup identical plans).
3. Sim **every plan at every haste** → a 5×5 DPS matrix. Rows = the haste a plan was optimized FOR;
   columns = the haste it's SIMMED at. The **diagonal** is each plan run at its native haste.
4. Check two properties:
   - **(a) Monotonicity** — each row increases left→right (more passive haste ⇒ more DPS). Trivial
     physics, but a good tripwire for a broken sim setup.
   - **(b) Diagonal dominance** — in every column, the native (diagonal) plan sims ≥ every plan
     borrowed from another haste, within sim noise. **This is the real test.** If a borrowed plan
     ever beats the native one, the model mis-adapted at that haste.

Run it: `CHROMIUM=… RUNNER=…/runner-ap180 EXPORT_BASE=…/export.json node tools/xval.mjs <seed>`.
It prints the matrix and `(a)/(b) PASS|FAIL` + an `XVAL-DONE … monoOK=… diagOK=…` line.

### Sim protocol locked in (do NOT deviate — each cost us a real bug once)
- **`--mana 100000000` (infinite).** ★ The model is layout-first; mana is excluded by design. A gate
  without infinite mana measures MANA, not layout (see §4.4 and the −4% phantom in TOOLING). This is
  the single most important flag.
- **`--var 10`** (not var0). var0 is the fixed-length quantization trap: a razor-edge tie can flip on
  a whole-cast boundary. var10 smooths it. (Gate 1 in RULES §16 read −0.08% at var0, +0.47% at var10.)
- **Paired `--seed 11`** across every cell → common-random-numbers, so A/B differences aren't seed noise.
- **`--iter 10000`.** A fixed-length fight's variance is tiny; 10k resolves the ~1–60 DPS signal with
  a ~1–2 DPS mean stdev. Do NOT use 250k (wasteful) — user-directed.
- The AP-180 patched runner (`runner-ap180`), not stock wowsims (AP cadence quirk, TOOLING ★).
- **Trinket swap:** the gear export wears Icon+something; `xval.mjs` swaps equipment slots 12/13 to
  the drawn pair's item IDs (Icon 29370, Serpent-Coil-gem 22044, Skull 32483, MQG 19339) so the
  on-use effects are available. `genapl.mjs` now emits Skull/MQG schedules. Passive trinket stats
  differ from the model's fixed sp=1387 — this is fine: SP is a flat multiplier that can't change
  layout ranking (RULES §6), and within a column every plan uses the identical character, so it
  cancels. Only `--haste` (which reshapes layouts) is swept, exactly as the model intends.

---

## 2. Results ledger

| seed | fight | Lust | kit | (a) mono | (b) diagonal | notes |
|------|-------|------|-----|----------|--------------|-------|
| 20260723 | 3:10 | 1:16 | mqg+skull | PASS | PASS | reference; DPS falls off monotonically with distance from diagonal both ways |
| 7 | 1:33 | 0:03 | mqg+skull | PASS | PASS | self-contained xval.mjs validation |
| 5 | 5:18 | 3:34 | isc+skull | PASS | PASS | agent |
| 9 | 2:35 | 1:37 | isc+mqg | PASS | PASS | agent |
| 2 | 5:33 | 1:35 | scb+skull | _rerun_ | | harness bug §4.6 fixed, re-running |
| 3 | 5:28 | 0:11 | isc+scb | _rerun_ | | harness bug §4.6 fixed, re-running |
| 8 | 2:21 | 1:03 | scb+mqg | _rerun_ | | harness bug §4.6 fixed, re-running |

**4/4 non-scb kits PASS both properties** (mqg+skull ×2, isc+skull, isc+mqg). The three scb kits hit
a **harness** bug (not a model bug) — see §4.6 — now fixed and re-running.

Reference matrix (seed 20260723), for the shape a healthy result has — native bold, penalty grows
with distance from the diagonal in both directions:

```
plan\sim     0      100      200      300      400
  0       2723.1  2863.0  2984.9  3085.6  3174.1
100       2720.7  2875.9  2994.5  3107.7  3197.3
200       2710.5  2874.8  3014.8  3116.2  3207.9
300       2700.6  2869.6  3002.1  3143.8  3255.6
400       2693.1  2857.7  2994.1  3137.0  3261.1
```

---

## 3. If a diagonal violation shows up — how to read it

A FAIL on (b) means: at some sim-haste H, a plan optimized for a *different* haste out-sims the
native plan by more than noise. Before believing it's a model bug, rule out the usual suspects in
this order (the methodology's "sim is rarely wrong, we usually used it wrong"):

1. **Mana.** Re-confirm `--mana 100000000` actually applied (grep the log for OOM / regen-wait). This
   has bitten us twice.
2. **Fixed-length tail artifact.** A plan with a buff jammed against the kill sims low because the sim
   drops truncated tail casts. If the "winning" borrowed plan just has its terminal burst land a hair
   earlier, it's the var trap — re-check at var10 and confirm the LIVE portion, not the clipped one.
3. **Cold-Snap mapping.** `xval.mjs` marks an IV inside the 180s cd as a CS use and emits a `CS`
   schedule. If the plan has 3 IVs but the APL only fired 2, the CS didn't reset — check the combat
   log for the Cold Snap cast and the second IV aura.
4. **Only then**, if it survives all three: it's a genuine **model mis-adaptation** — the model built
   the wrong layout for that haste. THIS is a Phase-6 finding. Localize it: which track is misplaced?
   Compare the native plan's layout to the winning borrowed plan's, map it to the RULES §16 band
   structure, and figure out which band edge the model put on the wrong side. Document it in §4, don't
   hot-fix — the fix probably belongs in the scorer or a search anchor and needs its own gate.

---

## 4. The open soft spots (candidates to crack — DOCUMENTED, deliberately UNFIXED)

These are known, priced, and inside tolerance today, but they're where the next real improvement
lives. None is a correctness bug; each is a "the tool sits a hair under the true optimum" or "we lack
ground truth" gap.

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

### 4.5 (placeholder) Phase-6 findings from the cross-val sweep
_To be filled as the agent matrices come in. Any confirmed diagonal violation (survived the §3
triage) goes here with: seed, fight, kit, the haste it fails at, the misplaced track, and the band
edge the model got wrong._ So far: 4/4 non-scb kits PASS; scb kits re-running after the §4.6 fix.

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

## 7. Guardrails (do not regress)
- **Determinism:** one setup ⇒ one plan. No `Date.now`/`Math.random` outside the seeded PRNG. The
  pool/cache/memo speedups are all purity-preserving — keep them so.
- **Exact-match 25/25** at every commit that touches the engine (`cd tests && node exact-match.mjs`).
- **Sim-gate novel findings** (infinite mana, var10, paired seed, pre-registered model prediction) —
  and run an **adversarial refutation pass** (an agent that tries to break the claim against the raw
  data) before locking anything into RULES. Both earned their keep this session.
- **Never leak identity/model ids** into `index.html` or any pushed artifact. Discord handle only.
