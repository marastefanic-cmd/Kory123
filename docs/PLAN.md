# PLAN.md — Rigorous wowsims harness audit + ramp-aware SP-buff valuation

**Status: NOT STARTED (approved).** The executable plan for the next phase. Per `CLAUDE.md` ("prune,
don't append"), fold the done parts into ROADMAP/TOOLING/RULES and **delete this file once it lands.**

**Start here (fresh context):** read `CLAUDE.md` → `docs/MECHANICS.md` → `docs/RULES.md` → this file →
`docs/TOOLING.md` (the harness — you'll be auditing it) → `docs/ARCHITECTURE.md`. Baseline before any
change: `cd tests && CHROMIUM=/opt/pw-browsers/chromium node exact-match.mjs` (expect 16/16). The sim
harness (`runner`, gear export, `wowsims/tbc-new` source) lives in the session **scratchpad** and
survives `/clear` *within the same session* — but this plan **rebuilds `runner` from source** anyway
(commit `ade9f39`); a brand-new session rebuilds per `docs/TOOLING.md`. **Do W1 before W2** — W2 is
sim-gated on the corrected referee.

## Context

Two things surfaced reviewing the sim methodology; both are real:

1. **The genapl offsets + external-buff handling are genuinely UNCERTAIN — pin them by RUNNING the sim,
   not reading it.** We offset bundled off-GCD presses by fractional seconds to dodge a supposed "two
   off-GCD at one tick → one deferred" collision. **Two deep source traces contradicted each other**:
   one found the APL executor *loops*, firing every ready action per pass (`apl.go:445`) ⇒ no collision,
   offsets needless; the other kept a one-per-tick queue hazard ⇒ offsets needed. The "Bloodlust costs
   the mage a GCD" worry also dissolves: in our **single-player** runner (no shaman) `castSpell
   {2825,-1}` binds the **off-GCD** `registerBloodlustCD` aura (`buffs.go:1903`), not the shaman's
   on-GCD cast — so Lust already costs the mage no GCD (PI/Drums same shape). Two capable analyses
   disagreeing from static reading is the clearest signal that the harness's true behavior **must be
   settled empirically.** Also real: a schedule registers no wake-up, so a press "at 240s" fires at the
   first AB boundary **≥** 240s (GCD-quantized). The sim gates every golden — foundational.

2. **The scorer is ramp-blind, so SP buffs on the opener / intermission-exit ramp are over-valued.**
   `simulate`'s integral uses a constant 3-stack cast (`intervalOf = max(1.5/m,1.0)`, `index.html:790`),
   so an SP buff's value = SP increment × casts-in-window, and casts-in-window is over-counted during a
   stack rebuild (casts are 2.5/2.17/1.83s at 0/1/2 stacks). This is why the Vashj `icon@4:00 → 4:05`
   shift (+0.6 sim, verified) is invisible. AB *damage* is stack-independent; only cast *time* ramps.
   The **old ramp model was reverted** (`2c0387d`) for a **phantom "triple-stack the pull" haste
   incentive** — modeling the ramp made the continuous scorer credit haste for compressing it (~0 real
   casts, nonzero in the integral), destabilizing the search. Any new ramp handling must avoid that.

Intended outcome: a sim referee faithful to in-game macro play, and correct SP-buff placement near
ramps — without reintroducing the phantom.

---

## Workstream 1 — RIGOROUS wowsims harness audit & hardening  *(do FIRST — it's the referee for everything)*

The whole project sim-gates against this harness; one afternoon's probing already found three latent
faults (cargo-cult offsets, external buffs cast as the mage, GCD quantization). **Audit end-to-end to a
known-faithful, reproducible standard, fix every fault, document it as the authoritative reference,
then re-validate everything gated on it.** Each dimension: find → prove → fix → regression-guard; **RUN
the sim to confirm each claim.** Files: `tools/genapl.mjs`, scratchpad `runner` main + wowsims source
(rebuild `ade9f39`), `docs/TOOLING.md`, gear export.

- **A — Trust anchor (FIRST — grounds everything).** Reproduce the **canonical wowsims web-UI DPS** for
  a baseline config (same gear export, standard Arcane raid buffs/debuffs, plain AB rotation, no forced
  schedule) with our `runner`. Must agree within noise. If they diverge, the runner/request-builder is
  wrong — root-cause before trusting any number. The objective yardstick for "faithful."
- **B — Buff modeling.** (1) **External buffs (Bloodlust / PI / Drums) must land as off-GCD auras, no
  mage GCD.** BL already binds the off-GCD `registerBloodlustCD` (`buffs.go:1903`) — confirm empirically
  no GCD is spent. Drums (35476/-1) and PI (10060/-1) are the same off-GCD-MCD shape but **aren't
  registered today** (export lacks `partyBuffs.drums` / `player.buffs.powerInfusions`) — enable in the
  export to sim them. Two off-GCD timing paths: current `schedule→castSpell` (≤~1 GCD jitter, rides the
  `.apl`), or engine-native exact-tick `player.Cooldowns.Timings` + one `autocastOtherCooldowns` item
  (`major_cooldown.go:132`; timings ride the export). **Do NOT** add a dummy caster (`SinglePlayerRaidProto`
  can't build a multi-unit raid). (2) Verify the mage's own on-use cooldowns (IV, AP, Berserking, Icon
  29370, gem 22044, Cold Snap) are off-GCD with correct value/dur/cd and item on-use effects. (3)
  Confirm the raid buff/debuff set a real Arcane mage runs (Wrath of Air, Curse of Elements/Shadow, …)
  is present, or that the baseline is deliberate and documented.
- **C — Off-GCD co-fire & scheduling (resolve the contradiction empirically).** Rebuild `runner` from
  `ade9f39`; schedule two off-GCD cooldowns at the same second **vs** offset; compare DPS. Identical ⇒
  drop the offsets as cargo-cult; not ⇒ keep them and document the real mechanism. Either way,
  characterize **GCD-boundary quantization** (a schedule fires at the first AB boundary ≥ its time; ≤~1
  GCD jitter) at intermission exits.
- **D — Intermission resume (resolve the standing suspicion).** Pin whether `genapl`'s AB-gating /
  cast-resume at `seg.end` is faithful — the suspected source of the Vashj icon-count "−4.2" artifact
  (ROADMAP records it as an unresolved "sim-setup bug at the intermission resume"). If buggy, fix it —
  else the sim can't referee any intermission-exit placement (exactly W2's domain).
- **E — Statistical protocol (reliability).** Document the method: **paired common random numbers** (A
  and B share `--seed`; confirm the runner does CRN), the right **iterations per effect size** (~10–50k
  paired is plenty; 250k wasteful/times-out), when **`--var 0` vs `--var 10`** is valid, and how to
  separate a real delta from noise/boundary artifacts (stdev → SEM, the var0↔var10 cross-check).
- **F — Rotation & encounter faithfulness.** Confirm the AB-spam APL, prepull, `--mana` high (fair
  simplification to isolate the overlay?), and `--var`/kill handling faithfully represent "press these
  cooldowns at these times" without smuggling artifacts.

**Then:** re-run **every** sim-gated conclusion this session on the corrected + trust-anchored rig
(packing goldens 6:00/5:45, 3:20 +3.6, 5:00 +2.4, Vashj icon-count and the +0.6 exit-shift); record
which hold and which change. **Rewrite `docs/TOOLING.md`** as the authoritative harness reference (kill
the false "off-GCD collision" note; document external-buff modeling, quantization, the stats protocol,
and the trust-anchor procedure).

**Risk / expected:** the audit may unsettle currently-green goldens whose original gating was distorted
(by whatever the empirical checks turn up — offset/quantization behavior, a corrected buff/debuff
baseline, or the intermission-resume verdict). That is the point. Re-lock any legitimate change on the
corrected sim; exact-match stays the guardrail; determinism preserved.

---

## Workstream 2 — Ramp-aware SP-buff valuation  *(AFTER the harness is faithful & re-validated)*

The harness fix may shift the ramp evidence (quantization at exits), so decide on re-validated numbers.

- **2a — tie-break fix (recommended first; low risk, no scorer change).** The "Let the stacks build"
  pass (`index.html:1766-1798`) slides SP/damage presses off a ramp on a **model tie**, but moves them
  *individually*: shoving `icon@240→245` cd-cascades the terminal `icon@360→365` while leaving gem/AP at
  360 — a split cluster the kill-aware model scores worse, so it's rejected (why Vashj misses). **Fix:
  build the coherent candidate** — when sliding a press off a ramp forces a later same-track use via
  cooldown, carry that use's whole co-pressed cluster with it (or re-align via the containment
  normalizer after the shift), and accept only when the shifted window still clears the **next**
  intermission (the 245-not-248 rule). Catches Vashj +0.6 as a model-tie nudge — no scorer change, no
  phantom, minimal churn. Sim-gate (corrected rig) every golden it moves.
- **2b — deterministic ramp in the scorer (only if 2a insufficient, or when the EP calculator needs
  "buff value at each interval").** Model the ramp in the integral, engineered to avoid the phantom: a
  **haste-decoupled** ramp deficit — in `[rampStart, rampStart+~7s]` reduce the cast rate by a factor
  that does **not** scale with the haste multiplier (so haste can't be credited for compressing the
  ramp) while SP-on-ramp is correctly discounted. `rampStart` list exists (`index.html:1779-1780`);
  ramp breakpoints hook into the integral's breakpoint set (`index.html:810-812`). Higher risk (crown-
  jewel scorer, re-lock all goldens) — defer unless needed. Do **not** re-add the old per-cast-sum ramp.

---

## Verification

- **W1:** trust-anchor matches canonical wowsims DPS within noise; the co-scheduled-off-GCD A/B is run
  and the offset kept/dropped on that evidence; the intermission-resume verdict is pinned; each session
  finding re-run on the corrected rig; exact-match 16/16 (or re-locked on sim evidence); `TOOLING.md`
  matches reality.
- **W2a:** Vashj emits the 4:05 / 6:05 layout (or the tie-break nudge does); every moved golden sims ≥
  old on the corrected rig; no phantom-opener regressions ("triple-stack the pull").

## Sequencing & constraints

Harness first → re-validate → ramp 2a → 2b only on evidence. Branch
`claude/wow-arcane-cooldown-optimizer-vbm3as`; configured author/trailers; no identity/model-id leaks in
`index.html`; determinism preserved; **sim-gate on the corrected rig**; keep docs current in the same
commit (`TOOLING.md`, `RULES.md §3`, `ARCHITECTURE.md`, `ROADMAP.md`).
