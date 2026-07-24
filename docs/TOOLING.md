# TOOLING.md — the wowsims sim harness (how to verify a plan)

This file documents the wowsims workflow, the **trust anchor** that certifies it, the statistical
protocol, and the traps. It was rewritten after a full end-to-end harness audit (see the ★ section and
the audit summary). **Read the methodology below first — it says what the sim is *for*.**

## ★★★ HARD RULE — THE MODEL OPENS COLD. NEVER PREPULL IN A MODEL-COMPARED SIM. ★★★

The model opens **cold** — 0 Arcane Blast stacks at the first cast, no prestack (RULES §3, MECHANICS).
So **every sim compared to the model MUST open cold too**: `genapl` defaults `_prestack:0`; do NOT
set `_prestack>0` for any comparison. A prepull cast is scheduled at a **fixed wall-time (−2.3s)** that
does NOT scale with haste, so at higher haste it finishes early and mistimes the opener ramp — this
made a fixed-rotation, ∞-mana haste sweep **LOSE a cast as haste rose** (h130=53 → h140=52), a
physically-impossible result that silently corrupts any haste comparison (docs/archive/07-phase6-xval-run.md §4.7). If a
fixed rotation ever sims non-monotone in haste, **check for a prepull first.** The only legitimate
`_prestack>0` use is a deliberate ramp-isolation experiment that is NOT compared to the model.

## Methodology — the model is the objective, the sim calibrates it

The planner already knows, deterministically, every cast, every buff window, and every timing in a
plan — so it computes **effective ABs cast** (`docs/MECHANICS.md §4`) exactly, and **that count is the
arbiter for comparing two lines.** The tool is, by construction, a maximization function over that
number; ranking lines is *its* job. The sim's role is **calibration**, three specific uses:

1. **Anchor the physics.** Certify the formulas/constants the count is built on — the trust anchor
   (runner == `wowsimcli` to the decimal, below) and any constant that changes. Get the equation right
   *once*, then trust the count.
2. **Cover the count's blind spots.** The count is ramp-blind (steady 3 stacks), mana-blind, AoE-blind,
   and can disagree with the sim on a *mechanic* (the AP 195-vs-180 cd, ★ below). Where a blind spot is
   in play the sim is ground truth; where it isn't, the count is.
3. **Verify a suspicious or novel finding** before trusting or locking it — a first-time result, a
   counter-intuitive delta, a new *kind* of move.

**The sim is not a routine per-golden gate.** Re-simming every plan on every change is slow and, worse,
invites treating a raw sim delta as ground truth even when a clean cast-count already settles the line.

**A caveat the audit earned (the user's correction): the sim was rarely *wrong* — we were often using it
improperly.** The Vashj "3-icons-win", the "off-GCD collision", the "−4.2 exit icon" were all **our
harness/usage faults** (the drop bug ★, cargo-cult offsets, a count-changing A/B measured on nearby
seeds), not the sim lying. So when the sim contradicts a clean cast-count with **no blind spot in play**,
that is a **sim-setup audit trigger** — open the `SIMLOG=1` combat log and find the usage fault — *not*
evidence the model is wrong. Distrust our *setup* before distrusting either the model or the sim.

**Guard against the self-confirming oracle.** If the model is the arbiter and the sim only ever confirms
it, we can drift. Two habits keep it honest: **proactively sim the known blind spots** (ramp, mana, AoE,
multi-AP timing) rather than waiting for a golden to look wrong, and **periodically re-anchor** — re-run
the trust anchor and a couple of representative goldens end-to-end.

**Scorer vs optimizer — two separate axes.** This settles the *scorer*: the effective-ABs count is the
objective and the arbiter. It says nothing about the *optimizer's* search-completeness — whether the
passes actually *find* the count-maximizing plan is a different question (the packing/containment work
was all search, not scoring). Don't conflate "the count is right" with "the search reached it."

## Pieces

- **`tools/genapl.mjs`** (in this repo, durable): builds a wowsims `APLRotation` JSON that spams Arcane
  Blast and fires each cooldown at **fixed scheduled times** (`APLActionSchedule`). Example:
  `node tools/genapl.mjs '{"IV":[105,125,396],"AP":[105,285],"Icon":[0,125,260,396],"Gem":[105,285,405],"Zerk":[105,285],"CS":[124],"BL":[260]}' out.apl.json`.
  Keys: `IV AP CS Zerk BL Icon Gem Skull MQG`. Supports `_intermission:[a,z]` / `_intermissions:[[a,z],…]`
  (AB gated off during downtime) and `_prestack:N` (prepull AB casts). **`_prestack` DEFAULTS TO 0
  (COLD OPEN) — the model never prepulls; see the ★★★ HARD RULE at the top of this file. Do not set
  it >0 for a model comparison.** Spell/item IDs in the file header. **This is the INFINITE-mana
  harness** (AB-spam forever) — pair it with
  `--mana 900000` for layout work. **★ Forgetting `--mana` silently turns a layout gate into a mana
  test** (burned us in the band-gate audit: −4% phantom "refutations"; at h150 an 80s burn is dry by
  0:25, 34 ABs instead of 64, and A/B arms OOM differently). If a layout A/B disagrees with the model
  by >1%, check `--mana` FIRST.
- **`tools/genconserve.mjs`** (durable): the **FINITE-mana / conserve** harness (for the real gearing
  stat weights, `docs/EP.md`). Same cooldown-schedule interface as `genapl`, but the *filler* is
  mana-managed: **Arcane Blast while burning** (Bloodlust/Arcane-Power/Icy-Veins aura up, or a
  `_burnWindows:[[a,z]]`) **or above a `_conserve` mana-% threshold; else Frostbolt** (27072 — cheap,
  ≈ mana-neutral with JoW+regen); **Evocation** below `_evo`; and — **critically** — an
  `autocastOtherCooldowns` action that fires the **external** mana CDs the APL would otherwise suppress
  (Innervate, Mana Tide). Robust to the threshold (DPS flat across `_conserve` 0.2–0.6). Trust-anchored:
  its DPS is within **2.7%** of the export's own native wowsims Arcane rotation. `_noEvo`/`_noAutocast`
  toggle those off. See the **finite-mana harness** section below.
- **`runner`** (NOT in repo — ~16MB compiled Go binary): a headless single-player sim built from the
  **wowsims TBC-with-APL source** (`wowsims/tbc-new`, module `github.com/wowsims/tbc`, pinned at commit
  **`ade9f39`**). `cmd/runner/main.go` reads an individual gear export, applies an optional `--apl`
  override, injects flat mana/haste via `bonusStats`, builds a `RaidSimRequest` via
  `core.SinglePlayerRaidProto`, and runs `core.RunRaidSimConcurrent`. Flags: `--export --apl --dur --var
  --iter --seed --mana --haste --tag --quiet --dumpreq --targets --crit --sp --int --spirit --mp5`. (Added
  this project: `--targets N` duplicates the encounter target for AoE; `--crit`/`--sp` inject
  SpellCritRating / SpellDamage; **`--int`/`--spirit`/`--mp5` inject Intellect / Spirit / MP5** via
  bonusStats — for AoE isolation and EP finite-differences incl. the **finite-mana** stat weights,
  `docs/EP.md`.) **The full `cmd/runner/main.go` is saved at `tools/wowsims-patches/runner-main.go`** — it
  is entirely our own harness file (not upstream), so a fresh container restores the runner from it +
  `apl-schedule-strict-ready.patch`, then `go build -tags with_db`.
  Output TSV: `tag  dur  var  iter  meanDPS
  stdev  maxDPS  avgFightSec` — **column 5 is mean DPS**.
- **Gear export** (NOT in repo — user-provided): the player's wowsims individual-export JSON. Point
  `--export` at it; don't hardcode its path in committed files (user data). The canonical export used
  for this project's goldens is a full, realistic Arcane raid setup (Wrath of Air, Totem of Wrath,
  Misery, Curse of Elements, Improved Shadow Bolt, JoW, Kings/Wisdom; kit = IV, Icon, Serpent-Coil gem,
  Arcane Power, Berserking, Bloodlust).
- **wowsims-tbc source + `runner`** live in the **session scratchpad** (ephemeral — cleared with the
  container, though it survives `/clear` within a session). Only `tools/genapl.mjs` persists in the repo.
- **`tools/explore.mjs`** (durable): the **exploration harness** — brute-scores every placement of a small
  buff set on the model over a gear-haste sweep, reports winners + breakpoints, and flags ramp-sensitive
  winners. `--sim` cross-checks the flagged winners against the runner (needs `RUNNER=… GEAR=…`), building
  the schedules through `genapl` and comparing the model's ordering to the sim's. It's the measuring
  instrument for Phase 4 (find the true optimum without a search; measure model-vs-sim ranking gaps). See
  RULES §16.
  - **Sim-setup gotcha it surfaced:** a *fixed-duration* APL that jams a haste buff against the fight **end**
    shows a spurious loss vs an interior placement (the sim drops the truncated tail casts; the model credits
    them proportionally). When cross-checking placement, keep the buff **interior** (lengthen `--dur`) or the
    fight-end masquerades as a real placement effect. Verified: IV pre-Lust ≡ post-Lust to 0.00% once interior.

## Building the runner (do this once per fresh session)

```
cd <wowsims-tbc-clone>            # git checkout ade9f39
go build -tags with_db -o runner ./cmd/runner
```

- **`-tags with_db` is REQUIRED.** `sim/core/database_load.go` is `//go:build with_db`; without the tag
  the item database is **empty** and any real gear export dies with `SIM ERROR: No item with id: NNNNN`.
- The DB assets (`assets/database/db.bin`, `leftover_db.bin`, embedded via `//go:embed`) are **generated,
  not committed** at `ade9f39`. A brand-new clone must regenerate them with the DB tooling before
  `-tags with_db` will link; the scratchpad clone already has them.
- Sanity after building: a clean rebuild is byte-identical run-to-run and reproduces the baseline DPS.

## Trust anchor — certify the runner reproduces canonical wowsims

The runner is a thin CLI over the same `sim/core` the wowsims web UI uses. To prove it faithfully
reproduces canonical wowsims (not just internally consistent):

```
runner --export gear.json --apl plainAB.apl.json --dur 420 --var 0 --iter 50000 --seed 11 \
       --mana 900000 --dumpreq req.json           # our runner's DPS + the exact RaidSimRequest it built
wowsimcli sim --infile req.json                    # upstream canonical CLI on the SAME request
# extract raidMetrics.parties[0].players[0].dps.avg — must equal the runner's column-5 DPS
```

`--dumpreq` writes the built `RaidSimRequest` as protojson; `wowsimcli` (`go build -tags with_db -o
wowsimcli ./cmd/wowsimcli`) is the upstream tool the web backend uses. **Verified: identical to the
decimal** (plain-AB mana-0 = 944.4 == 944.4; mana-900k = 2264.9 == 2264.9, incl. stdev; re-anchored
2026-07-24 on the current export: 2248.8 == 2248.8 with stdev 47.2 == 47.2). The IDENTITY is the
anchor, not the absolute number — it shifts with export revisions. So absolute numbers are
trustworthy, not just A/B deltas. Re-run this whenever the runner or source changes.

## The combat log — `SIMLOG=1`

`SIMLOG=1 runner … 2>log.txt` runs **1 iteration in Debug mode** and prints the full per-event combat
log to stderr: every `[t] Casting {SpellID}` (with Cast Time / GCD / Effective Time), `Completed cast`,
`Aura gained/faded`, mana, damage. This is the tool for pinning *why* a schedule scores as it does —
when a press actually fires, whether it's off-GCD, when a cooldown is ready. (Earlier notes wrongly
claimed the runner had no combat-log flag.)

## Running a clean comparison

```
node tools/genapl.mjs '<specA>' A.apl.json
runner --export gear.json --apl A.apl.json --dur 420 --var 0.5 --iter 30000 --seed 11 --mana 100000000 --tag A --quiet
# repeat for specB; compare column 5.
```
- **`--var 0.5` is the default read** (the model-matched kill window — see the metric bullets below).
  `--var 0` is still useful for count-preserving CRN A/Bs (lowest pairing noise) but MUST be confirmed
  at var0.5 (var0's whole-cast parity flipped the §16 h150 gate's sign once). `--mana 100000000` =
  infinite (isolate the overlay from mana). `--haste N` tests gear breakpoints.
- **Iterations: 10–60k is plenty** (single iterations spread ±2%, σ≈50–65 DPS; the mean converges to
  ~0.02% by 10k; 250k was always wasteful). More iterations CANNOT shrink a persistent disagreement —
  the stubborn ones are deterministic structure (cast-boundary parity, wall phase), which only metric
  design (var0.5, wall-jitter) addresses.
- **Use the SAME `--seed` for A and B** — common random numbers (below) make the paired diff low-noise.

## Off-GCD co-fire — there is NO "collision" (the old #1 trap was a myth)

All on-use cooldowns (IV, AP, Icon, gem, Berserking, Bloodlust) are **off the GCD**. The APL executor
(`sim/core/apl.go:445`, `DoNextAction`) **loops, executing every ready action per rotation pass** until
none remain — so any number of off-GCD presses scheduled at the same second all fire together.
- **Verified two ways:** (1) combat log — six cooldowns co-scheduled at t=60 all fire at the same
  boundary (t=61.20), each `GCD=0`, none dropped; (2) DPS — co-scheduling all six at the identical
  integer second is **identical to the decimal** (2773.1) vs the old fractional-offset scheme across
  seeds. **The sub-second offsets were inert; do not use them.** (Any past symptom "fixed" by offsets —
  the −6.7 KT, the +37 — was a boundary/other artifact misattributed to a collision that doesn't exist.
  Goldens gated "with offsets" remain valid because offset-vs-none is an exact wash.)

## GCD-boundary quantization (real; document it)

A scheduled press at time `S` fires at the **completion of the cast in progress at `S`** = the first
cast boundary `≥ S` (off-GCD, so it doesn't delay that cast). Jitter ≤ ~1 cast; near an intermission
exit the first post-downtime cast is a slow 2.5s ramp cast, so an exit-press can land up to ~2.5s late.
A press *also* cannot fire while its own cooldown is still running — a press scheduled inside its
cooldown fires when the cd clears (which may be a later boundary). These two facts drive the
intermission-resume behavior below.

## External buffs (Bloodlust / PI / Drums) — off-GCD, single application

`raidBuffs.bloodlust=true` **registers** the off-GCD `registerBloodlustCD` cooldown (spell 2825) — that
registration is what makes 2825 castable by the APL; the APL `schedule→castSpell{2825,-1}` **triggers**
it. They are the **same single Lust**, not two. Verified in the combat log: Bloodlust aura gained
exactly **once**, no stray autocast, **no mage GCD spent** (the AB train is uninterrupted). Power
Infusion (10060/-1) and Drums (35476/-1) are the same off-GCD-MCD shape but are **not registered** in
the current export (it lacks `player.buffs.powerInfusions` / `partyBuffs.drums`). To run an end-to-end
Drums/PI sim, enable those in the export first.

**Two model-side goldens now DO use them** (`3:20 lust 0:05 drums` / `... PI`), locked without a fresh
end-to-end sim on purpose: their physics is already **anchored** — Drums is +80 haste *rating*, additive
into the same `(1+rating/1577)` pool the gear-haste trust-anchor certified at h0 (Drums 80 is named there),
and the one genuinely uncertain bit, **PI-not-stacking-with-BL, is verified straight from the wowsims
source** (BL & PI share the `"MultiplyCastSpeed"` ExclusiveCategory, highest-priority wins — SOURCES /
RULES §13), which is a stronger anchor than a ~100-DPS-noise A/B. A plain single-target Drums/PI fight has
**no blind spot** (no ramp/mana/AoE/multi-AP), so the model's cast-count is the arbiter (methodology, top of
this file). Re-run an actual APL sim only if a Drums/PI case ever lands on a blind spot (e.g. an
intermission-exit or AoE phase).

## Statistical protocol (read this — the old "seeds 11/19" habit was wrong)

- **Determinism / CRN:** per-iteration RNG seed = `baseSeed + iterationIndex` (`sim_concurrent.go`;
  concurrency is split so it never affects results). Same seed+plan ⇒ byte-identical. For an **A/B
  comparison use the SAME seed** — A and B then share the per-iteration RNG and the paired diff cancels
  crit/proc noise (this is why a real +0.6 is resolvable under ~100-DPS per-run stdev).
- **Nearby seeds are NOT independent replicates.** Because seeds are contiguous, `--seed 11` and
  `--seed 19` at 150k iters share ~all iterations (they differ by 8 of 150000). Verified: seed 11 ==
  seed 19 to the decimal incl. max; far seeds (100000, 10⁶) give genuinely different draws. **For an
  independent replicate, separate base seeds by ≥ iterCount** (e.g., 11 and 10_000_000), or just report
  single-run **SEM = stdev/√iter** (≈0.3 DPS at 150k).
- **Count-preserving vs count-changing (the key rule).** A comparison that keeps the **same set of
  presses** (e.g., shift a cluster 240→245) keeps A and B on the SAME RNG stream → clean CRN pairing →
  sub-DPS effects resolve. A comparison that **adds/removes a press** shifts the PRNG stream from that
  point on → A and B desync → the paired diff reverts to full noise, so nearby seeds "agree" on a
  desynced sample and mislead. Measure count-changing questions (e.g. 3-vs-4 icons) with
  **far-separated-seed replicates + large N**, never a single nearby-seed pair.
- **`--var 0` vs `--var 10` — and the MODEL-MATCHED read, `--var 0.5` (Phase 7).** `--var V` draws the
  kill uniformly in [T−V, T+V]; intermissions stay fixed. The scorer's `robust` objective (KILL_WINDOW =
  0.5s linear taper) is **exactly** expected damage under a uniform kill in [T−0.5, T+0.5] — so
  **var 0.5 asks the sim the same question the model answers** and is the cross-val/acceptance metric.
  var0 is the razor-edge whole-cast-parity trap (measured: the §16 h150 ramp-hug pair flips −0.08% →
  +0.37% from var0 to var0.5 — the var0 read was a stranded whole cast, the var0.5 read matches the
  model's +0.25 casts to 0.01%). var10 asks a *different* question — ±10s kill hedging the model
  deliberately does not price (RULES §8) — and adds a late-window premium (measured on 15 cross-val
  columns: var10 deltas shrink 2–4× at var0.5). Use var0 only for count-preserving CRN A/Bs where its
  low noise helps, and confirm at var0.5; gate model preferences at var0.5. No kill-variance setting
  clears an **intermission-wall** effect (walls stay fixed) — that needs wall-jitter, below.
- **Wall-jitter (boss tables — `xval.mjs` `WJITTER`, default 2) — INDEPENDENT per-wall shifts, and why.**
  Within a wall-bounded segment the cast train is phase-locked to the exit (the re-ramp), so a plan
  realizes haste value only in **whole casts** before the next wall — a deterministic per-segment
  cast-parity worth up to ~±½ cast per segment that NO kill-variance can smooth. Dug to ground on the
  Vashj 0.64% pair (minimal 2-wall reproduction, per-interval log verification): the sim's cadence
  matches the model's floored/unfloored intervals EXACTLY; only the whole-cast truncation at walls
  differs (stacked window: model +1.65 casts, sim +1.04; split: model +1.48, sim +1.54). The model's
  continuous fractional credit is the CORRECT expectation for real fights, whose transition times vary
  run to run — so the measurement must vary **segment lengths**: each wall gets its own seeded shift
  δ_i ∈ [−WJ,+WJ], presses shift with the wall that starts their segment, seam-coincident window edges
  move together (KT downtime→AoE). ★ A RIGID translation (one δ for walls+presses — the first design)
  preserves every segment's internal parity and washes NOTHING — do not regress to it.
- **var10 penalizes LATE windows near the end — decide which question you're asking.** A buff window
  inside the last `var` seconds gets clipped on short draws, so var10's A/B adds a real "late-slot
  kill-variance premium" on top of the fixed-kill effect (measured: Zerk-in-Lust vs after = +0.6% at
  T=60 var10 but exactly the model's +0.3% at T=80 var10 where nothing clips — RULES §7). The model
  prices only a half-cast of kill variance BY DESIGN (RULES §8), so when gating a model preference,
  either use a fight long enough that no compared window sits in the variance zone, or expect the sim
  to exceed the model by the clip premium.

## ★ KNOWN HARNESS BUG — `APLActionSchedule` silently DROPS an on-cooldown press

**This is the audit's headline finding. It distorted intermission theorycraft; now FIXED (patch below).**
The AB-gate/resume *ramp* is faithful (AB gates off during downtime, the gap scores zero, cooldowns
tick through, casting resumes with a correct fresh-stack 2.5s cast). The bug is in how `genapl` fires
the cooldowns: `APLActionSchedule` (`sim/core/apl_actions_timing.go`) advances its timing index the
moment `innerAction.IsReady` returns true — and `castSpell.IsReady` returns true ~0.15s *early* (a
cast-queue tolerance). So when a scheduled press lands while its own cooldown is still up, the schedule
"fires" (queues the cast + consumes the timing) but the queued off-GCD cast is then lost behind the
in-progress hardcast → **the use vanishes entirely**, not just slips late.

This bites whenever same-track presses are ~exactly a cooldown apart and one drifts (quantization runs
each press's cd from its *late* fire-time, so drift accumulates). **Worked example (Vashj icon,
cd 120, scheduled 0/120/240/360):** icon@240 quantizes to 242.5 (the 2.5s ramp cast at the [3:30–4:00]
exit) → cd ready 362.5 → the **terminal icon@360 is DROPPED** (combat log: `Queueing up {29370} to cast
at 362.505`, then no icon aura ever appears). So the golden's "4-icon" plan was really firing **3**
icons, missing the high-value 6:00-burst one — which is exactly why "drop the exit icon" measured
**+4.8** (stable across independent far seeds: not noise, a deterministic dropped-use). **It is NOT
Vashj-specific:** the same run also drops AP@360, and several IV/Zerk uses — the schedule harness has
been **systematically under-executing back-to-back cooldowns**, so any sim-gating that involved a
press landing on its own cd may be distorted (flag every intermission golden for re-check once fixed).

**THE FIX (LANDED) — `tools/wowsims-patches/apl-schedule-strict-ready.patch`.** Root cause:
`APLActionCastSpell.IsReady` uses `spell.CanCastOrQueue` (queue-tolerant → true ~0.15s early). Patch:
`APLActionSchedule` now remembers its inner castSpell's `spell` and adds `(innerSpell == nil ||
innerSpell.IsReady(sim))` — STRICT `BothTimersReady`, no queue tolerance — to its `IsReady`. A press
that collides with its own (drifted) cooldown now WAITS and fires when the cd truly clears, never
dropping and never consuming the timing early. `genapl` is unchanged (still `schedule`); rebuild the
runner from the patched source (`go build -tags with_db`). Buffs apply strictly **between casts**
(snapshot at completion — the 242.50 cast used pre-icon SP 1386, the next 1541), and the patch keeps
that (it only gates *when* a press fires, not what it hits).

**Re-validated (all 16 goldens, fixed vs orig engine, var0 100k):** ZERO regressions. Plain goldens
+0.0..+0.8 (fix inert, or recovers one collided press). Intermission goldens were badly drop-distorted →
big faithful recoveries: **4:00-multi +18.0, KaelThas +22.2, Vashj +25.8**. So the old schedule harness
was systematically under-executing every intermission plan. Goldens' PLANS are unchanged (exact-match
16/16) but their sim *baselines* jumped, so **any intermission conclusion previously sim-gated on the
buggy harness should be re-checked** on the fixed rig. On the fixed engine the Vashj **4-icon plan is
vindicated** (1594.3 > 3-icon 1587.2, +7.1 var0 / +6.9 var10) — the "3-icons-win" was 100% the dropped
terminal. The 4:05/6:05 shift survives but small (**+0.8 var0 / +0.3 var10**, stable across far seeds).

**AP's cooldown is 180s — and the harness is now PATCHED to match (`tools/wowsims-patches/ap-cd-at-cast.patch`).**
Upstream `sim/mage/arcane_power.go` re-set AP's 180s cd in the aura's `OnExpire` (`CD.Use` at buff-END),
making the sim's cadence 15+180 = **195s**. **The user (domain authority) confirmed real TBC AP is a
standard 3-min cooldown starting on activation — 180s** — the model was always right
(`BUFFS.arcanePower.cd = 180`). The patch deletes the `OnExpire` re-set (core already consumes the cd at
cast via `triggerCooldown`), so the patched runner fires AP on the true 180s cadence — verified
(`AP@[0,180]` both fire). **This closed the "multi-AP timing" blind spot**: the sim is now a valid referee
for AP cadence. Cautionary tale: before the patch, a layout whose 2nd AP sat exactly 180s after the 1st
was silently penalized ~1% in gates (the press dropped/slid) — it manufactured a fake "refutation" of a
correct model preference (the haste-first opener) until the contamination was found.

**★ RUNNER PROVENANCE — one true binary.** The canonical runner is built from the scratchpad `wowsims`
clone (`ade9f39` + `apl-schedule-strict-ready.patch` + `ap-cd-at-cast.patch`):
`go build -tags with_db -o runner-ap180 ./cmd/runner`. A stale pre-patch binary once sat at the
scratchpad root and **poisoned a whole day of gates** (every drop-bug distortion re-introduced). Before
ANY gating session: rebuild or verify the binary is the patched one (check
`grep -c innerSpell sim/core/apl_actions_timing.go` = 3 and no `CD.Use` in `arcane_power.go`).

**Scheduled presses fire at APL decision points — during a ramp that is the NEXT SLOW-CAST BOUNDARY.**
Sim-log-verified: with a cold opener, presses scheduled at 5 land at **6.5** (the 0→3 ramp's cast
boundaries are 2.5/4.667/6.5 — sparse and locked to the pull, no phase freedom). The model now matches
this exactly (the press-snap rule, RULES §3). Related artifact: **externals (Bloodlust/PI/Drums) routed
through the mage's APL also land at the boundary** — but in the real game the *shaman* presses at the
call time, so the model keeps externals at intent time. When an opener gate disagrees with the model by
~0.1-0.3%, check whether the sim's late-landing BL (its Lust window sliding ~1.5s later into the fight)
accounts for it before blaming the model.

## Traps that remain

- **Cold-Snap IV** — model it as "once per fight, one IV ignores its cooldown." Schedule `CS` slightly
  before the cheated IV (the runner resets IV mid-schedule); since there's no second reset, the CS→IV
  must be the IV that breaks the 180s cd. Otherwise ignore the fine timing — it's one bonus IV.
- **Fixed-length boundary artifacts.** At an exact fight length, whose cast train ends flush at the
  buzzer swings ±1 cast. Re-check any suspiciously large fixed-length gap under `--var 10`.
- **AoE — the runner CAN value it now (`--targets N`).** See the AoE section below. A full-fight sim
  still can't switch target-count mid-fight (encounters are fixed-N), so an AoE *phase* is valued in
  **isolation** (short fight, N targets, AE-spam); a full boss sim treats an AoE window as 1-target AB
  (a common factor that cancels when the varied presses are outside the AoE window — how the KT re-gate
  stayed valid).

## Evaluating AoE phases (`--targets N` + AE-spam)

Two additions let the runner value an Arcane-Explosion AoE phase (the model's `type:"aoe"` segment):
- **`runner --targets N`** duplicates `encounter.targets[0]` to N mobs (config protos are read-only, so
  the pointer is shared; each becomes its own Unit). `0` = keep the export's count.
- **`tools/genae.mjs`** (repo, durable) builds an **Arcane Explosion (27082) spam** APL, same cooldown-
  schedule interface as `genapl.mjs` (now incl. `CS`). `_abAfter: T` switches AE → plain AB at `T`
  (the AoE-phase EXIT: AE never applies the AB debuff, so the handoff re-ramps — the Phase 5 exit-ramp
  gate). Run a short isolation fight (e.g. `--dur 40 --targets 6`).

**Validated, model vs sim:** the model's AE constants are **exact** — base roll 377–407 (avg 392),
`BonusCoefficient` 0.214, instant + GCD-bound, `DamageMultiplier 1`, full per-target damage
(`arcane_explosion.go`, spell 27082). Sim spot-checks: AP over AoE = **×1.30** (measured +30% on the AE
stream), IV over AoE ≈ ×1.18–1.20 (haste, unfloored; var10 marginal +5.66% vs model +5.71% on a 20s/70s
window). Phase 5 re-anchored the **per-cast ratio** at N=2/6/10 (AE-spam vs prestacked AB-spam, same
seed): sim **0.709 / 2.255 / 3.873** vs model M(N) 0.819 / 2.579 / 4.434 — a **constant ×~0.87**, fully
decomposed below (Tirisfal 2pc ×1.2 on the AB side, ÷1.2 → residual +2–4% = the conservatively-credited
amp + export-vs-input SP/crit calibration). The old "≈2.25×" quote is the same number with the T5 factor
baked in. KT's **double-IV-over-AoE** re-gated directly: 2nd IV over the 6t window's back half = +10.0%
of the 40s window, both far seeds (model +9.09%).

**★ Tirisfal-2pc + Arcane-Power additivity (Phase 5 sim-audit finding — the sim was right, our
CONSTANTS were incomplete).** The reference export wears **T5 Tirisfal 2pc = +20% Arcane Blast damage**
(`sim/mage/items.go`, set 649) — combat-log per-hit AB/AE ratio 2.99 vs 2.52 expected without it (and
solving the per-hit data gives SP≈1414 ≈ the 1387 input; without T5 you'd need an absurd SP≈6050). AND
it pools **additively** with Arcane Power — both are `SpellMod_DamageDone_Flat` (`arcane_power.go`,
`spell_mod.go`): AB under AP+T5 = ×(1+0.2+0.3) = 1.5, not 1.2×1.3. Measured with count-preserving CRN
pairs: AP marginal = **+25% relative on the T5'd AB stream** (141.7 DPS vs 141.2 predicted-additive,
161+ predicted-multiplicative) but the full **+30% on the AE stream** (369 vs 378 predicted — AE has no
T5 mod). Consequences: on T5 gear the AoE placement thresholds shift ×1.2 (RULES §9 caveat — no class
flips, KT robust), and sim gates on THIS export under-credit AP marginals vs the model by ~1/6 (bake
that into expectations before calling a gap a bug). Whether real 2.4.3 stacks these multiplicatively is
an **open user-authority question** (ROADMAP) — like AP-195, don't assume the sim's pooling is the game.

**AE fixed-length quantization (a var0 trap, worse than on AB streams).** A uniform instant stream fits
a WHOLE number of GCDs into a fixed fight: at `--dur 60` var0, Zerk-in-IV vs Zerk-outside on the 6t
window tie **byte-identically** (both +1 cast; the continuous +0.14-cast stack premium never
materializes a 45th cast), and the IV marginal reads +2 casts where the integral says +2.67. Re-run
haste A/Bs on AE streams under **var10** (or a longer non-resonant dur): there IV = +5.66% and the §7
stack premium +0.24% emerge at 28σ. Damage/SP A/Bs are immune (same cast stream both sides).

**Super-linearity — measured, isolated, and now modeled.** 6-target AE is **+8.6% per-target** above
linear at crit 38% (×1.024 @2t, ×1.086 @6t, ×1.119 @10t; and it **falls as crit rises** — +11% @10% crit,
+7.7% @55%, once the artificial `--crit -1500` floor point is excluded). **Talent-isolation nails the
cause:** zero Arcane Concentration/Potency in the export and the super-linearity **vanishes** (`--crit`
sweep + a talent-zeroed export: NOTAL amp6 ≈ 1.00), so it is **entirely Clearcasting → Arcane Potency** —
gear on-crit SP procs (Tirisfal 4pc etc.) add ~0. Mechanism: Arcane Concentration procs **per hit**
(`talents.go`), 3/3 Potency = **+30% crit** (combat-log-confirmed) on the next cast, so more targets ⇒
more Clearcasting ⇒ more Potency-boosted casts. Because it depends only on **crit × N × fixed talents**
(no gear), the planner models it — `aoeCritAmp(N,crit)` (`index.html` `TALENTS`), crediting **~75–80%** of
the measured effect (conservative; right crit-direction; single-target untouched, exact-match 16/16). New
runner flag used here: **`--crit R`** adds SpellCritRating via bonusStats (negative to suppress crit).

## The finite-mana / conserve harness (real gearing stat weights)

The infinite-mana harness (`genapl` + `--mana 900000`) gives the **layout** EP; the **gearing** EP needs
a mana-managed rotation at **real mana** (`docs/EP.md`). Pieces: `tools/genconserve.mjs` (the conserve
APL), `tests/ep-finite.mjs` (the sim finite-difference), `tests/mana-value.mjs` (the analytic value-of-
mana cross-check), `tests/finite-weights.json` (the locked numbers). Reproduce:
`node tests/ep-finite.mjs --dur 300 --iter 45000 --seed 11 --inf` (add `--native` to finite-difference
the export's OWN wowsims rotation as a cross-check; `--dur 145/420` for fight-length).

**★ TRAP — the APL silently SUPPRESSES external mana cooldowns unless you add `autocastOtherCooldowns`.**
Innervate and Mana Tide are auto-managed `CooldownTypeMana` MCDs (`registerInnervateCD`/
`registerManaTideTotemCD`, `sim/core/buffs.go`). In APL mode wowsims **removes MCDs referenced by the
APL** from the autocast set and fires the rest **only via** an `autocastOtherCooldowns` action — so a
schedule-only APL fires *none* of the un-referenced ones. **Without it the mage loses Innervate + Mana
Tide entirely (−6% DPS, 1806→1916 at 300s) and its stat weights are biased toward mana-starvation.**
`genconserve` includes the action; it is safe because APL-referenced CDs (our scheduled IV/AP/Icon/Gem/
Zerk/Evocation) are excluded, so nothing double-fires (verified: exact scheduled fire-counts unchanged).
Confirm any new mana harness fires them: `grep 29166` (Innervate) `16190` (Mana Tide) in a `SIMLOG` log.

**The sim already models the whole raid mana economy on the export — do NOT reimplement it.** Verified
firing on the reference export: regen ticks (`OtherID:2` — mana-spring mp5 + **Shadow-Priest/Vampiric-
Touch = +250 mp5** permanent (`ShadowPriestDPSManaAura` = `dps·0.25`) + `spirit·√int·0.009327·0.30`-
casting), **JoW** (27164, 74/hit), **Mana Tide** (16190, `0.06·MaxMana`/tick×4 at ~40s), **Innervate**
(29166 — `ForceFullSpiritRegen` + `SpiritRegenMultiplier×5` for 20s), **Evocation** (12051, `0.15·MaxMana`
×4), **Mana-Emerald gem** (22044). Armor is **Molten** (crit), not Mage (regen) — the player's real
choice. This is why option **(B)** (leverage wowsims) beats reimplementing: the validated engine already
does innervate/manatide/VT/JoW/evocation/regen correctly, on the player's real raid setup.

**Findings (sim finite-difference, cross-validated 3 ways).** Real gearing weights (300s, SP=1):
**SP 1.00 · Int 1.08 · Haste 0.96 · Crit 0.79 · MP5 0.66 · Spirit 0.54 · Mana ~0** — vs the infinite
ceiling on the *same* schedule (Haste 1.44, MP5/Spirit **exactly 0**, Int 0.56). The **conserve rotation
and the native wowsims rotation agree** (haste 0.96 vs 1.00), and the analytic value-of-mana (~2.2
dmg/mana) brackets MP5 — so this is not a harness artifact. **The "haste is weak for Arcane" folklore is
about the OOM-idle rotation** (pure-spam haste EP **0.03**); a Frostbolt-conserving mage keeps haste ≈
0.96 (never idles). Full table + fight-length + intermission numbers: `docs/EP.md`, `finite-weights.json`.
This is a mana **blind-spot** finding (the count is mana-blind) so the sim is ground truth here; it does
**not** touch the planner (the infinite-mana engine stays default; exact-match 23/23).

## Verifying a golden change

After an intentional model/optimizer change: rebuild (`-tags with_db`), run `tests/exact-match.mjs`,
and for every golden whose plan moved, first read off the **effective-ABs count** — that's the arbiter
for whether the new line is better. **Sim-verify** the move when a blind spot is in play (a ramp/
intermission-exit shift, an AoE or multi-AP-timing call) or the finding is novel/suspicious: new-vs-old
with the SAME seed, `--var 0`, ≥150k, confirm under `--var 10` too; if the change adds/removes a press,
add a far-seed replicate (nearby seeds share the sample — see the statistical protocol). Accept only if
the count improves and any sim check is new ≥ old. Then `node exact-match.mjs --update` and eyeball the
diff. **The count is the objective and the arbiter; the sim calibrates it and covers its blind spots
(the methodology at the top).**
