# TOOLING.md — the wowsims sim harness (how to verify a plan)

The planner's model is a proxy; the **ground truth is wowsims** (the TBC combat sim). Every golden and
every non-obvious rule in `docs/RULES.md` was verified by forcing a cooldown schedule into wowsims and
reading the DPS. This file documents that workflow, the **trust anchor** that certifies it, and the
traps. It was rewritten after a full end-to-end harness audit (see the audit summary at the bottom).

## Pieces

- **`tools/genapl.mjs`** (in this repo, durable): builds a wowsims `APLRotation` JSON that spams Arcane
  Blast and fires each cooldown at **fixed scheduled times** (`APLActionSchedule`). Example:
  `node tools/genapl.mjs '{"IV":[105,125,396],"AP":[105,285],"Icon":[0,125,260,396],"Gem":[105,285,405],"Zerk":[105,285],"CS":[124],"BL":[260]}' out.apl.json`.
  Keys: `IV AP CS Zerk BL Icon Gem`. Supports `_intermission:[a,z]` / `_intermissions:[[a,z],…]` (AB
  gated off during downtime) and `_prestack:N` (prepull AB casts to seed the opener stack). Spell/item
  IDs in the file header.
- **`runner`** (NOT in repo — ~16MB compiled Go binary): a headless single-player sim built from the
  **wowsims TBC-with-APL source** (`wowsims/tbc-new`, module `github.com/wowsims/tbc`, pinned at commit
  **`ade9f39`**). `cmd/runner/main.go` reads an individual gear export, applies an optional `--apl`
  override, injects flat mana/haste via `bonusStats`, builds a `RaidSimRequest` via
  `core.SinglePlayerRaidProto`, and runs `core.RunRaidSimConcurrent`. Flags: `--export --apl --dur --var
  --iter --seed --mana --haste --tag --quiet --dumpreq`. Output TSV: `tag  dur  var  iter  meanDPS
  stdev  maxDPS  avgFightSec` — **column 5 is mean DPS**.
- **Gear export** (NOT in repo — user-provided): the player's wowsims individual-export JSON. Point
  `--export` at it; don't hardcode its path in committed files (user data). The canonical export used
  for this project's goldens is a full, realistic Arcane raid setup (Wrath of Air, Totem of Wrath,
  Misery, Curse of Elements, Improved Shadow Bolt, JoW, Kings/Wisdom; kit = IV, Icon, Serpent-Coil gem,
  Arcane Power, Berserking, Bloodlust).
- **wowsims-tbc source + `runner`** live in the **session scratchpad** (ephemeral — cleared with the
  container, though it survives `/clear` within a session). Only `tools/genapl.mjs` persists in the repo.

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
decimal** (plain-AB mana-0 = 944.4 == 944.4; mana-900k = 2264.9 == 2264.9, incl. stdev). So absolute
numbers are trustworthy, not just A/B deltas. Re-run this whenever the runner or source changes.

## The combat log — `SIMLOG=1`

`SIMLOG=1 runner … 2>log.txt` runs **1 iteration in Debug mode** and prints the full per-event combat
log to stderr: every `[t] Casting {SpellID}` (with Cast Time / GCD / Effective Time), `Completed cast`,
`Aura gained/faded`, mana, damage. This is the tool for pinning *why* a schedule scores as it does —
when a press actually fires, whether it's off-GCD, when a cooldown is ready. (Earlier notes wrongly
claimed the runner had no combat-log flag.)

## Running a clean comparison

```
node tools/genapl.mjs '<specA>' A.apl.json
runner --export gear.json --apl A.apl.json --dur 420 --var 0 --iter 150000 --seed 11 --mana 900000 --tag A --quiet
# repeat for specB; compare column 5.
```
- `--var 0` = fixed kill (lowest noise for A/B). `--mana 900000` ≈ infinite (isolate the overlay from
  mana — verified the mage never OOMs at these levels, so mana is not the binding constraint). `--haste
  N` tests gear breakpoints.
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
the current export (it lacks `player.buffs.powerInfusions` / `partyBuffs.drums`); no current golden uses
them. To sim a Drums/PI fight, enable those in the export first.

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
- **`--var 0` vs `--var 10`:** `--var` randomizes ONLY the kill time; intermissions are fixed. var0 is
  the lowest-noise fixed-length A/B; re-check under var10 to kill **fixed-length boundary artifacts** (a
  real effect survives both; var10 is a genuinely different sample, so var0-and-var10 agreement is a
  real cross-check — unlike seeds 11/19). var10 does **not** clear an intermission-boundary effect
  (intermissions stay fixed).

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

**Separate discovery — AP's cooldown is 195s, not 180 (model↔sim mismatch).** `sim/mage/arcane_power.go`
starts AP's 180s cd in the aura's `OnExpire` (`CD.Use` at buff-END), so AP's real cadence is 15+180 =
**195s**. The model uses cd 180, so it plans AP every 180s — infeasible in the sim (the 2nd use fires
~195, a 3rd near a 360s mark is often past the kill). This is NOT the drop bug (it survives the patch);
it affects any plan using AP <195s apart (Vashj, etc.). Whether TBC AP is truly 195 (a "cd starts on
buff-fade" quirk) or 180 is a SOURCES question — the sim (referee) says 195. **Flag: decide whether to
set the model's `BUFFS.arcanePower.cd` to 195, and re-gate the intermission goldens, as the immediate
follow-up** (bigger than the +0.8 ramp shift).

## Traps that remain

- **Cold-Snap IV** — model it as "once per fight, one IV ignores its cooldown." Schedule `CS` slightly
  before the cheated IV (the runner resets IV mid-schedule); since there's no second reset, the CS→IV
  must be the IV that breaks the 180s cd. Otherwise ignore the fine timing — it's one bonus IV.
- **Fixed-length boundary artifacts.** At an exact fight length, whose cast train ends flush at the
  buzzer swings ±1 cast. Re-check any suspiciously large fixed-length gap under `--var 10`.
- **AoE isn't modeled by AB-spam.** The runner casts Arcane Blast; it can't value a real 6-target AoE
  phase. Calls hinging on AoE weighting (KT double-IV-over-AoE) are model assumptions the sim can't
  confirm — flag them.

## Verifying a golden change

After an intentional model/optimizer change: rebuild (`-tags with_db`), run `tests/exact-match.mjs`,
and for **every** golden whose plan moved, sim new-vs-old with the SAME seed, `--var 0`, ≥150k, and
confirm under `--var 10` too; if the change adds/removes a press, add a far-seed replicate. Accept only
if new ≥ old. Then `node exact-match.mjs --update` and eyeball the diff. The model is the search
heuristic; the sim is the referee.
