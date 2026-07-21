# PLAN.md — harness drop-bug FIXED; next: AP-cd + intermission re-gate, then the ramp shift

**Status: W1 audit DONE. W1.5 drop-bug FIX landed + all goldens re-validated.** Two follow-ups the fix
surfaced remain (below). Findings live in `docs/TOOLING.md` (authoritative harness reference, ★ section)
and `docs/ROADMAP.md`.

**Start here (fresh context):** `CLAUDE.md` → `docs/MECHANICS.md` → `docs/RULES.md` → this file →
`docs/TOOLING.md` (esp. the ★ "KNOWN HARNESS BUG" section — the drop bug, its fix, and the AP-cd
discovery) → `docs/ARCHITECTURE.md`. Baseline: `cd tests && CHROMIUM=/opt/pw-browsers/chromium node
exact-match.mjs` (16/16 — model untouched). Rebuild the runner from the **patched** wowsims source
(apply `tools/wowsims-patches/apl-schedule-strict-ready.patch`, then `go build -tags with_db`).

## DONE — W1 audit (see TOOLING for detail)
Trust anchor (runner==`wowsimcli`), off-GCD "collision" is a myth (drop the offsets), `SIMLOG=1` combat
log exists, external buffs off-GCD single-application, stats protocol (seeds 11/19 = same sample), buffs
snapshot at cast completion (between casts).

## DONE — W1.5: the harness DROP BUG, fixed + re-validated
- **Bug:** `APLActionSchedule` silently dropped an on-cooldown press (fired ~0.15s early via
  `CanCastOrQueue`, advanced its timing index, lost the queued off-GCD cast). Systematic on back-to-back
  cooldowns; worst at intermission exits.
- **Fix (LANDED):** `tools/wowsims-patches/apl-schedule-strict-ready.patch` — the schedule now gates on
  STRICT `spell.IsReady` (no queue tolerance); a colliding press waits and fires when its cd clears,
  never dropped. `genapl` unchanged; trust anchor preserved (plain rotation identical).
- **Re-validated (all 16, fixed vs orig):** zero regressions. Plain +0.0..+0.8; intermission goldens
  recovered big — 4:00-multi **+18**, KaelThas **+22**, Vashj **+26** (they were badly under-executed).
  Vashj 4-icon plan VINDICATED on the fixed engine (1594.3 > 3-icon 1587.2). Exact-match still 16/16.

## FOLLOW-UP A (open questions the fix surfaced): AP-cd source + intermission re-gate
- **AP-cd discrepancy (needs a real TBC source — do NOT guess).** The sim intentionally models AP's cd
  from buff-END (195s = 15+180, `arcane_power.go` `OnExpire`); SOURCES claims `cd180` "verified". Neither
  is settleable from here. **Don't change `BUFFS.arcanePower.cd`** until a definitive TBC source resolves
  it. Impact on current goldens is low (AP is a common factor in the gating A/Bs; infeasible 2nd uses
  often land at the kill). See TOOLING. If it turns out 195, reconcile the model; if 180, treat the sim
  as an unreliable referee for multi-AP timing (like AoE).
- **Re-gate the intermission goldens (lower priority — plans validated no-regression).** Their sim
  baselines jumped +18..+26 on the fixed engine, but the reval showed no regressions and the Vashj plan
  is vindicated (4-icon > 3-icon). Spot-check KT / 4:00-multi plans vs their documented alternatives on
  the fixed rig to confirm they're still *best* (plans are unchanged — exact-match green either way).

## W2 — Ramp-aware SP-buff shift (245/365) — 2a DONE
- **2a — coherent-cluster carry — LANDED.** The "Let the stacks build" pass (`index.html` ~1766) now,
  when sliding a damage/SP press off a ramp forces a later same-track use past its cooldown, carries that
  use's whole co-pressed damage/SP cluster with it (icon+gem+AP together; the burst's haste like IV@6:00
  stays put). Vashj now emits **4:05 / 6:05**; **only Vashj moves** (other 15 byte-identical), sim-gated
  new ≥ old on the FIXED engine (+0.8 var0 / +0.3 var10, stable across far seeds), golden re-locked.
  Model stays deterministic and ramp-blind — this is a pure model-tie nudge, no scorer change, no phantom.
- **2b — deterministic ramp in the scorer** — NOT needed (2a suffices for the known case). If a future
  case needs it: haste-decoupled ramp deficit to avoid the reverted phantom-opener incentive (`2c0387d`).

## Still open (not blocking)
- **AP-cd** (Follow-up A above): the sim's 195s vs the model's 180s — needs a definitive TBC source; low
  golden impact. Note the Vashj 6:05 cluster includes AP@365, which the sim doesn't actually fire (AP's
  195s cd → only 0/196 fire); it's moot (AP@360 didn't fire either), a common factor — but if AP-cd is
  ever set to 195 in the model, re-check that the model still wants the cluster at 365.
- **Re-gate the other intermission goldens** (KT / 4:00-multi) on the fixed engine vs their alternatives
  (plans validated no-regression; not yet checked for *optimality* on the fixed rig).

## Verification / constraints
- Fixed harness fires every planned cooldown use (no drops), buffs between casts; exact-match 16/16.
- Branch `claude/wow-arcane-cooldown-optimizer-vbm3as`; configured author/trailers; no identity/model-id
  leaks in `index.html`; determinism preserved; docs current in the same commit.
