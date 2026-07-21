# PLAN.md — harness drop-bug fix, then re-validate, then (maybe) ramp valuation

**Status: W1 AUDIT DONE. New top-priority workstream surfaced by it — the harness DROP BUG (W1.5).**
The rigorous wowsims harness audit (old W1) is complete; its findings are folded into `docs/TOOLING.md`
(now the authoritative harness reference) and `docs/ROADMAP.md`. The audit uncovered a real harness bug
that reshapes the next steps — **fix it and re-validate before any ramp work (old W2).**

**Start here (fresh context):** `CLAUDE.md` → `docs/MECHANICS.md` → `docs/RULES.md` → this file →
`docs/TOOLING.md` (esp. the ★ "KNOWN HARNESS BUG" section — that's the whole story) → `docs/ARCHITECTURE.md`.
Baseline: `cd tests && CHROMIUM=/opt/pw-browsers/chromium node exact-match.mjs` (16/16 — the model is
untouched by all of this). Rebuild the runner per TOOLING (`go build -tags with_db`); harness lives in
the session scratchpad.

## What the audit settled (W1 — done; details in TOOLING)
- **Trust anchor ✓** runner == upstream `wowsimcli` to the decimal (2264.9) — absolute sim numbers are
  trustworthy, not just A/B deltas.
- **Off-GCD "collision" is a MYTH ✓** the sub-second offset ritual is DPS-inert (executor loops,
  `apl.go:445`); drop it. Co-scheduling at one second is safe.
- **External buffs ✓** Bloodlust (and PI/Drums shape) bind off-GCD, single application, no mage GCD;
  the export runs a full real Arcane raid set. Drums/PI aren't registered (no golden uses them).
- **Stats protocol ✓** CRN via same seed; **nearby seeds 11/19 are the SAME sample** (contiguous
  per-iter seeds) — use far-separated seeds or SEM for independent replicates; var0/var10 is a real
  cross-check. Buffs snapshot at cast completion (apply strictly between casts — faithful).
- **Combat log ✓** `SIMLOG=1` exists (old note said it didn't) — the tool that cracked the bug below.

## W1.5 — FIX THE HARNESS DROP BUG, then re-validate everything *(TOP PRIORITY — see TOOLING ★)*

**The bug:** `APLActionSchedule` (`genapl`) **silently drops** a scheduled press that lands while its
own cooldown is still up (the schedule consumes the timing on a premature cast-queue; the queued off-GCD
cast is then lost). It bites any same-track presses ~a cooldown apart where one drifts — i.e. normal
back-to-back cooldown use, worst at intermission exits. Proven: Vashj's "4-icon" golden was firing only
**3** icons (terminal 6:00 icon dropped); that artifact — not "3>4 icons" — is the whole "−4.2". With
the drop fixed (icon-track prototype), 4 icons **1576.6** beat 3 **1573.1**, vindicating the golden.

- **1.5a — implement a clean, faithful fix.** Preferred: engine-native `player.Cooldowns` `timings` +
  one `autocastOtherCooldowns` APL action (the MCD manager only advances `numUsages` on *actual*
  activation, so a colliding use fires late, never dropping). Two scratch prototypes exist and are
  **both still buggy** — root-cause them first: (i) the windowed-`SpellIsReady` conditional mis-fires
  AP at ~196s; (ii) the timings+autocast wiring dropped Gem/BL/CS (ActionID match — include tags for
  Zerk/BL) and lost late uses; (iii) an unexplained AP-at-~196 slip near the [165,180] exit shows up in
  BOTH — settle it with the combat log. Keep the between-casts snapshot (no retroactive mid-cast paint).
  Consider a **per-press kill cap** (don't fire a use that lands after the kill) as a small robustness
  guard — but NOT a blanket "fight X shorter" hedge (RULES §8 already rejected broad kill-variance
  hedging: plan the known kill, react live).
- **1.5b — re-validate ALL 16 goldens on the fixed harness.** The drop was systematic (it also dropped
  AP/IV/Zerk uses in the Vashj run), so **any** golden whose sim-gating involved a press landing on its
  own cd may have been mis-scored. Re-sim each golden's plan new(fixed)-vs-old and vs its documented
  alternative; re-lock on the fixed rig at var0 **and** var10 with far-seed replicates for any
  count-changing check. Exact-match stays the guardrail (model unchanged). Expect some goldens to move —
  that's the point; re-lock on sim evidence.

## W2 — Ramp-aware SP-buff valuation *(DEFERRED behind W1.5 — its evidence is now suspect)*

The "+0.6 for the 4:05/6:05 shift" was measured while **both** 240/360 and 245/365 were dropping their
terminal icon (3 of 4 firing), so it is **not** trustworthy. **Reconfirm on the fixed harness first:**
once both plans fire all four icons, the shift's edge may collapse toward 0 — in which case the model's
240/360 is already fine and W2 is unnecessary. Only if a real, clean ramp gain survives the fixed rig:
- **2a — coherent-candidate tie-break** (slide an SP/damage cluster off an exit onto built stacks,
  carrying its cd-linked terminal use) — no scorer change; sim-gate on the fixed rig.
- **2b — deterministic ramp in the scorer** — only if 2a insufficient; haste-decoupled ramp deficit to
  avoid the reverted phantom-opener incentive (`2c0387d`). Higher risk; defer unless needed.

## Verification / constraints
- W1.5: fixed harness fires every planned cooldown use (no drops), no drift past intent, buffs still
  between casts; all 16 goldens re-simmed and re-locked (or confirmed unchanged); exact-match 16/16.
- Branch `claude/wow-arcane-cooldown-optimizer-vbm3as`; configured author/trailers; no identity/model-id
  leaks in `index.html`; determinism preserved; keep docs current in the same commit.
