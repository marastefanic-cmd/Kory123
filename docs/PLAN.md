# PLAN.md — Phase 3: raid-buff/proc tightening + deterministic mana & haste helpers

**Status: planned (user-directed).** The heavy in-tool finite-mana *planner* is **dropped** — the
finite-mana *stat weights* already answered the mana question (`docs/EP.md`), and the user wants mana
handled the tool's way: **deterministic hints from math we already have, not a second rotation engine.**
Gear-haste/trinket coverage is done (parallel work; ROADMAP). Start: `CLAUDE.md` → `docs/RULES.md` →
`docs/ARCHITECTURE.md` → this file. Baseline: `cd tests && CHROMIUM=/opt/pw-browsers/chromium node
exact-match.mjs` (**23/23 — keep it green throughout**). **Do NOT touch the infinite-mana scorer/optimizer
core** (`simulate` ~586, `optimizeAsync` ~1012); Phase 3 is UI + already-modeled buffs + informational
overlays.

## Tasks

### 1. Remove pinning on the mage-managed cooldowns (quick, first) — ✅ DONE
IV / AP / Icon / gem / Berserking / Cold Snap are the tool's to schedule — pinning them fights the
optimizer and is the untested "lock 2+ timings" edge case. **Only the raid-controlled buffs (Bloodlust,
Drums, Power Infusion) stay pinnable.** Drop the per-time input UI for the mage-managed cooldowns; keep
`fixed`/pins only for the raid buffs. Presets don't pin mage cooldowns, so goldens are unaffected — verify
exact-match 23/23 after. (Also removes a class of inputs we never validated.)

### 2. Test + tighten Drums + Power Infusion — ✅ DONE (verify + lock; no tighten needed)
Both are raid **haste** buffs already in `BUFFS` but under-exercised. Drums = **+80 haste rating, 30s,
2-min Tinnitus**; Power Infusion = **×1.20 haste mult, 15s, does NOT stack with Bloodlust** (BL wins while
both up — already coded, `simulate` ~712). Plan:
- Pin Drums / PI at varied times — alone, into Lust, staggered off it — and confirm the packing/sequencing
  holds: Drums sequences like any haste buff (kept off the GCD floor), PI's non-stack-with-BL is honored,
  both ride damage bursts for flux. Sim-gate a handful (fixed kill, CRN, the drop-fixed rig).
- Poke the wonky cases: **PI overlapping BL** (should contribute 0 haste there), **Drums Tinnitus 2-min
  spacing**, **two haste buffs colliding on the floor** (sequential, not overlapped). Tighten anything off.
- Add 1–2 Drums/PI cases to the exact-match suite once confirmed.

### 3. Ashtongue Talisman — decide the model — ✅ DONE (→ free-leeway zones)
**Decided (user-refined): keep ATI passively scored; depict LEEWAY, don't schedule the proc.** Not option
(a) or (b) as written — the better synthesis: `leewayZones` finds each press's maximal contiguous interval
that ties its placement (position-independent presses, §3), the timeline draws a dotted **"press anywhere
here"** band over it, and aligning a live proc inside the band is never anti-synergous so no verdict is
computed. Verified byte-flat inside / drop-or-infeasible outside. RULES §14. The action-plan Flexible/earliest
tag reporting the same interval is folded into task 6. (Original spec below, superseded.)
Currently steady-state proc-uptime for *scoring* (`simulate` `atiOn`, ~715/797) — fine for the DPS number,
but it doesn't tell you *when to react*. It's a **145-haste, 5s proc on spell crit**; in-game you pool it
into windows. Two deliverables to choose from (spec both, pick with the user):
- **(a) Leeway rule (preferred, in-nature-of-the-tool):** several presses already carry timing slack (RULES
  §10 earliest-tie). Annotate those as **"wait for an ATI proc until X:XX; if none, press anyway"** — a
  bounded, deterministic rule (worst case = press at X) that captures react-to-proc without RNG in the plan.
- **(b) Exclude + tips:** drop ATI from the model, add a short "pool procs into IV/AP windows" note.

### 4. Mana tooltip — "target mana here" (deterministic, no engine)
For each cooldown **burst window**, we already know the AB mana cost (195·1.75^stacks) and the cast rate,
so compute **"enter this window with ≥ N mana to AB-spam it clean"** and show it as a per-window tooltip /
schedule annotation. That's the conserve *target* the player manages to — no rotation optimizer, no mana
sim. Constants in `docs/SOURCES.md`; pure function over the existing schedule + `buildSegments`.

### 5. Haste breakpoints on the timeline
Mark the meaningful haste breakpoints on the haste curve: the **GCD-floor** points (where extra haste
stops buying AB casts) and the **Frostbolt-in-conserve** breakpoint (fit 4 Frostbolts in the 8s AB-debuff
window ⇒ Frostbolt ≤ 2.0s ⇒ ~+25% haste ≈ **~394 rating before raid buffs** — LOOK UP / verify the exact
number and any others). Informational ticks/labels on `renderTimeline`, no scorer effect.

### 6. Placement-reasoning tags in the action plan (output-layer, was ROADMAP "Planned refinement")
`pressPlan` (`index.html` ~3176) still tags mobile presses with the **raw damage delta** —
`deliberate: +N dmg vs one press at T` (~3229) and `locked here by its cooldown` (~3225). Those deltas
don't help the reader; the *reasoning* does (it's the "trustworthy" goal). Replace them with a short
**why-here reason** per press, inferred **post-hoc** from the schedule + cooldown structure:
- **Cooldown-timed** — "used here so the cooldown comes back in time" (press whose second is set by its
  own cd feeding a later scheduled use: opener IV / AP / Zerk / Icon).
- **Alignment** — "used here to align with the other buffs of this burst" (a press co-located onto a
  burst it strengthens, e.g. the opener gem).
- **Count-vs-align tradeoff** — "2 unaligned uses here and @4:00 beat one at 3:00" (state the spread call
  the planner resolved — the icon-count decision).
- **Flexible / earliest** — "can be pressed anytime from now to X:YZ" where `X:YZ = nextScheduledUse − cd`
  (clamped ≥ now) — the RULES §10 earliest-tie slack. **This dovetails with task 3(a)** (the Ashtongue
  leeway rule annotates the same slack windows) and **task 4** (the mana tooltip hangs off these rows).
Keep the Cold-Snap `csNote` and the clip/boundary notes — those already read as reasons.
**Output-only, exact-match-safe** (the suite rebuilds from `scheduleRows`, not `pressPlan` tags —
`tests/exact-match.mjs` ~63–78), so goldens are untouched; verify 23/23 anyway.

## Verification
- exact-match **23/23** after every task (the scorer/optimizer core is untouched; removing mage-pinning
  and adding overlays must not move a golden).
- Drums/PI cases sim-gate ≥ their alternatives on the fixed rig; the non-stack-with-BL and floor-sequencing
  behave. Mana-tooltip numbers cross-check against the finite-mana harness (`tests/ep-finite.mjs`
  mana curve) on a reference fight. Haste-breakpoint ratings verified against a source.
- Determinism preserved; no identity/model-id in `index.html`.

## Notes
- This is deliberately the *light* mana approach the user asked for — targets + breakpoints the player
  executes against, not a scheduled conserve rotation. The heavy planner / full finite-mana mode stays
  **dropped**; the infinite-mana planner is the product.
- Branch `claude/wow-arcane-cooldown-optimizer-vbm3as`; configured author/trailers; docs current in the
  same commit; delete this PLAN.md when Phase 3 lands, folding lasting bits into ROADMAP.
