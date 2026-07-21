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

## FOLLOW-UP A (do first — bigger than the ramp shift): AP-cd + intermission re-gate
- **AP's real cadence is 195s, not 180** (`arcane_power.go` starts the 180s cd in the aura `OnExpire`,
  = 15+180). The model's `BUFFS.arcanePower.cd = 180` plans AP infeasibly (every 180s). **Decide:** set
  the model's AP cd to 195 (match the referee) after a SOURCES check of TBC AP behavior; then re-optimize
  and re-gate the multi-AP goldens. (If TBC is genuinely 180, flag the sim instead — but the sim is the
  referee, so default to 195.)
- **Re-gate the intermission goldens** (Vashj/KT/4:00-multi/2:40-inter) on the FIXED engine: their old
  sim-gating ran on the drop-buggy harness (baselines off by +18..+26), so re-confirm each plan is still
  optimal vs its alternatives on the fixed rig; re-lock any that move. Plans are unchanged (exact-match
  green) — this checks whether they're still *best*, now that the sim executes them faithfully.

## W2 — Ramp-aware SP-buff shift (245/365) — CONFIRMED but sequence AFTER Follow-up A
The 4:05/6:05 shift is real on the fixed engine but **small: +0.8 var0 / +0.3 var10** (stable across far
seeds). Because the model's intermission scoring is only trustworthy AFTER Follow-up A (AP-cd fixed,
baselines re-gated), and because generic ramp/SP-concentration tie-breaks have over-fired and been
reverted twice (ROADMAP), build W2a on the corrected foundation, not before it.
- **2a — coherent-candidate tie-break.** The "Let the stacks build" pass (`index.html` ~1777) already
  slides icon@240→245 on a model tie, but `repair()` then cd-pushes the terminal icon@360→365 while gem
  stays at 360 — a split cluster the kill-aware model rejects. Fix: carry the terminal use's co-pressed
  damage/SP cluster (gem) with it so 6:05 stays coherent; accept only when the shifted window still
  clears the next intermission. Sim-gate on the fixed rig; only Vashj should move; re-lock it to 245/365.
- **2b — deterministic ramp in the scorer** — only if 2a insufficient; haste-decoupled to avoid the
  reverted phantom-opener incentive (`2c0387d`). Defer unless needed.

## Verification / constraints
- Fixed harness fires every planned cooldown use (no drops), buffs between casts; exact-match 16/16.
- Branch `claude/wow-arcane-cooldown-optimizer-vbm3as`; configured author/trailers; no identity/model-id
  leaks in `index.html`; determinism preserved; docs current in the same commit.
