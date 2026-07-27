# PHASE 10 — re-establish the acceptance baseline on gear B, with the new instrument

**Status: IN EXECUTION (2026-07-26). §4.1 shakedown PASSED; round 1 gathering. Execution log: §8.**

## 0. The one-sentence charter

**Re-measure `docs/ACCEPTANCE.md` from scratch on gear B using `tools/bench.mjs`, and restate every
open debt in the new currency — because right now the project has no acceptance reading at all.**

## 1. Why this, and why before anything else

Three facts, and together they leave only one sensible next move.

1. **Every model-vs-sim number the project owns is on a baseline that no longer exists.** BENCH §1
   archived the whole gear-A corpus and cleared `tools/xval-results/`. ACCEPTANCE's "NOT PASSING (B)",
   its 135 borrowed-win columns, its 0.38 % worst case, PHASE8's B2 ≈ 0.445 pp, PHASE7's low-haste
   basin debt — all gear A, all un-denominated until re-measured.
2. ~~**The target is known to have moved.**~~ ⛔ **FALSIFIED 07-27 — see BENCH §3e's retraction
   banner.** This bullet read: *"BENCH §3e measured B2's sim preference shifting ~0.39 pp and changing
   sign on gear B. Any Phase-8 work started today would aim at a number that is not there."* Re-measured
   one knob at a time, **it does not reproduce**: under the corpus protocol gear B reads `+0.389 %`
   against gear A's `+0.360 %`, the model half is `−0.037 %`, and archive/09 §13.8's ≈0.445 pp target
   **stands** at ≈0.43 pp. The quarry had not moved.
   ⚠ **Phase 10 is still right, on bullets 1 and 3.** Un-denominated is un-denominated whether or not
   a target happens to land in the same place — the point of the round is that nobody *knew*, and one
   cell re-measured by hand is not 36. But the "chase whose quarry has moved" framing was wrong, and
   this is the cautionary tale for the class: **a single off-protocol measurement (`--var 0`, and
   probably an unworn trinket) re-planned a phase.**
3. **It finally costs almost nothing.** The gear-A campaigns were expensive mostly in *ceremony* —
   clone wowsims, install protoc, `go build`, then hunt a private gear export out of a session
   scratchpad that may have been reclaimed. All of that is gone: `tools/bench.mjs` runs the committed
   `sim/sim.wasm` and produces a duel in ~10 s from the repo alone.

There is also a quieter reason. The gear-A rounds each carried a *different* protocol (emit=intent vs
fire, var 0 vs 0.5, changing seed policy), which is why comparing rounds needed its own instrument.
Round 1 on gear B is the first chance to gather a whole corpus under **one settled protocol**, stamped.

## 2. What is different this time — the instrument, stated once

| | gear-A rounds | Phase 10 |
|---|---|---|
| engine | native `runner` built per session | **committed `sim/sim.wasm`** (patched, `ade9f39cc`); asserted equal to the native runner to the printed decimal by `tests/sim-duel.mjs` |
| setup | clone + protoc + `go build` + find the export | **none** |
| driver | `tools/xval.mjs` + shell wrappers resolving `RUNNER`/`EXPORT_BASE` | **`tools/bench.mjs`** (also `--json` for collection) |
| character | a private export in a scratchpad | **`tools/bench/export.json`, committed and frozen** |
| model cfg | hand-written per tool — the PHASE8 §6/§7 defect | **forced to the simmed character** (`…REF` spread), structurally |
| `--var` | 0 on many gates, by convention | **0.5, by measurement** (`tools/var-decision.mjs`) |
| normalisation | raw DPS | **difference-in-differences** vs a never-press control (BENCH §2.1) |
| protocol constants | typed into each tool | **`sim/benchmark.mjs`**, imported everywhere, asserted by `tests/sim-request.mjs` |

★ The website's "Check in the benchmark sim" button runs this same chain. A Phase-10 finding and a
user's finding are therefore the same measurement, which has never been true before.

## 3. ⚠ The traps this phase must not walk into

- **★ The instrument is NEW and lightly exercised.** `bench.mjs` and the in-repo wasm have run a
  handful of duels and the gates — not a corpus. A systematic flaw would show up as *coherent
  weirdness across many cells*, not as noise. **Before grading anything, re-run 3–4 gear-A cells whose
  answers are known** and check the shapes are recognisable (not the values — the baseline changed).
  If they are not, the tool is on trial, not the model.
- **Never diff a gear-B cell against a gear-A cell.** BENCH §1. The archive README says the same.
- **A partial directory is not a result.** 36 tables or no verdict.
- **Stamp everything** — `emit=`, `var=`, `iter=`, seeds, tool version. The round-5/round-6 `emit=`
  confusion is the recorded case of what an unstamped table costs.
- **Do not let the model arbitrate its own change** (`plan-duel.mjs`'s circularity rule). If the
  scorer moves during the phase, the sim is the only arbiter for the cells it touched.
- **Watch the seed spacing.** Base seeds closer than `iterations` share iterations and the band
  collapses to ~0, which passes every delta. `tests/sim-request.mjs` asserts this for `BENCH.seeds`;
  any ad-hoc seed list needs the same check.

## 4. The loop

1. **Shakedown — start here, before any gathering.** Four cells, ~1 minute total:

   ```
   node tools/bench.mjs --preset "2:00 lust 0:05"  --vs naive --iter 4000
   node tools/bench.mjs --preset "5:00 lust 0:05"  --vs naive --iter 4000
   node tools/bench.mjs --preset "2:40 lust 0:07 intermission 1:30-2:10" --vs naive --iter 4000
   node tools/bench.mjs --preset "Kael'thas Sunstrider" --vs naive --iter 4000   # the AoE cell
   ```

   Gate — **all four must hold, and none of them is about the DPS values** (the baseline changed, so
   the values are *supposed* to be new):
   - the model plan beats mash-on-cooldown in every one, by a plausible margin (a few tenths to a few
     percent), and `MODEL` and `SIM` **agree in sign**;
   - the never-press control is identical across the two arms of a cell (same character, same fight) —
     if it is not, the control is picking up something it should not;
   - no NaN, no `errorResult`, and **no `skipped` entry beyond the known Drums / PI / Ashtongue set**
     — a silent omission here is the failure mode `planspec.mjs` exists to prevent;
   - the intermission and AoE cells transcribe (`_intermissions` / `_aoe` present in the emitted spec,
     targets > 1 on the AoE one).

   If any of that is off, **stop**: the phase becomes tool debugging (§3, first bullet), and the
   36-table campaign waits. Cross-check with `RUNNER=… node tests/sim-duel.mjs` and
   `RUNNER=… node tests/sim-request.mjs` before suspecting the model.
2. **Gather round 1** — the 36 tables, `tools/bench.mjs --json`, one protocol, all stamped, into
   `tools/xval-results/`.
3. **Verify invariants** — `xval-verify.mjs` + `xval-collect.mjs` must agree on every headline number,
   as they did on gear A.
4. **Restate the ledger from scratch.** BENCH §1 forbids diffing against round 7, so ACCEPTANCE gets a
   **new** status block: monoDip, the borrowed-win count and distribution, the diagonal deficit — as
   first measurements, not as deltas.
5. **Re-price the open debts** — B2, the low-haste basin, the KT/AoE cells — in gear-B numbers, and
   *close any that no longer reproduce*. A debt that does not survive re-measurement was a property of
   the old baseline.
6. **Decide the next phase from the new table**, not from the old one.

## 5. Pre-registered gradings (write these down before looking)

- **PASS** = `monoDip = 0` on all 36 tables **and** no length-persistent diagonal deficit — the
  standing ACCEPTANCE definition, unchanged. It is the *measurement* that is new, not the bar.
- **A deficit counts as real** only if it survives at ≥3 seeds with |Δ| > 1σ of the paired band. The
  gear-A corpus learned this the hard way: wall-jitter variance (per-variant sd 0.1427 pp) dwarfed
  seed variance (0.0058 pp), so a single-variant reading looked far more precise than it was.
- **B2 is considered CLOSED by this phase** if the gear-B corpus shows no residual of the same shape
  above the noise band. It is *not* closed by a sign change alone — BENCH §3e is an observation, and
  an observation that flips a sign is a reason to re-measure, not a resolution.
- **If the shakedown fails**, the phase stops and becomes a tool-debugging phase. Say so loudly rather
  than gathering 36 tables with a suspect instrument.

## 6. Exit criteria

Phase 10 is done when: `tools/xval-results/` holds a complete, stamped gear-B round; ACCEPTANCE
carries a gear-B status block written as a first measurement; every open debt in ROADMAP is either
re-priced in gear-B terms or explicitly closed as not-reproducing; and DIARY records the arc plus any
belief the re-measurement overturned.

## 7. Cheap wins that can ride along

- **The Drums `SpellFlagAPL` patch** (a third `tools/wowsims-patches/` entry). Today the default kit
  ships with Drums enabled and the verification silently excludes it — for the *user*, that is the
  cooldown they may most want checked. It needs a trust-anchor re-certification (BENCH §3d), which
  this phase is already set up to do. Details of why it is needed: `sim/planspec.mjs` header.
- **A multi-seed band in the page.** The website currently uses a fixed ±0.05 % tie band; the terminal
  bench already computes a real paired band. Doubling the ~10 s wall clock buys an honest error bar.

---

# §8 — EXECUTION LOG (2026-07-26)

## 8.1 ✅ The §4.1 shakedown PASSED — all four cells, all four gate conditions

`tools/bench.mjs --vs naive --iter 4000`, gear-B bench character, var 0.5, seed 11, never-press control:

| cell | model plan (value) | mash on cooldown | SIM Δ | MODEL Δ | sign |
|---|---|---|---|---|---|
| `2:00 lust 0:05` (T=120) | +590.5 | +539.5 | **+51.0 DPS** | +1.314 % | AGREE |
| `5:00 lust 0:05` (T=300) | +351.5 | +319.2 | **+32.3 DPS** | +1.293 % | AGREE |
| `2:40 lust 0:07 interm 1:30–2:10` (T=160) | +488.1 | +414.5 | **+73.6 DPS** | +2.896 % | AGREE |
| `Kael'thas Sunstrider` (T=420, AoE) | +359.6 | +246.6 | **+113.0 DPS** | +6.338 % | AGREE |

Against the gate, item by item — and note that **none of it is about the DPS values**, which are
supposed to be new:

- **model beats mash everywhere, by a plausible margin, model and sim agree in sign** — 4/4, margins
  1.3–6.3 %. The ordering across cells is the recognisable shape: the two plain fights sit together at
  ≈1.3 %, the walled fight is worth more (a plan that works around downtime has more to gain), and the
  AoE boss most of all.
- **the never-press control is identical across the two arms of every cell** — 2128.8 / 2163.1 /
  1574.7 / 1667.8, each printed twice. The control is picking up nothing but the character and fight.
- **no NaN, no `errorResult`, no `skipped`** — the skipped list was **empty** on all four, not merely
  within the known Drums/PI/Ashtongue set, because none of those is in the default kit these presets
  run.
- **the intermission and AoE cells transcribe.** Verified directly off the segments the transcription
  reads rather than inferred from the DPS: KT builds `aoe[105,145]×6` (⇒ `_aoe: [[105,145]]`,
  `targets = 6`) among six intermissions, and the 2:40 cell builds `intermission[90,130]`.

## 8.2 ★ The instrument audit — what the four cells could NOT have told us

§3's first trap says the instrument is new and lightly exercised, and that a systematic flaw would
show as coherent weirdness across many cells rather than as noise. Four passing duels do not test the
things a 36-table campaign actually leans on, so those were probed separately.

- ✅ **The wasm is bit-deterministic at a fixed seed.** Two identical requests returned
  `2149.4813305933517` twice, to the last digit. This is what licenses the content-addressed caches.
- ✅ **★ Trinket swapping reaches the wasm's item DB, and all four on-uses FIRE.** The campaign varies
  the kit by rewriting equipment slots 12/13 of the committed request template — and nothing had ever
  exercised that path, while a silent no-op there is precisely `sim/planspec.mjs`'s documented
  Drums/PI failure mode wearing a different hat (a whole kit simmed with its actives absent, printing
  plausible DPS). Measured, one press at t=0 against never-press: **isc +20.6 · scb +19.5 · skull
  +49.3 · mqg +81.3 DPS**, and each kit's control moves with its passives. The 22.8 MB `sim.wasm` is a
  `with_db` build, so item ids resolve inside the engine.
- ⚠ **`tests/sim-request.mjs` cannot run here** — it needs a native `RUNNER`, and `protoc` is not
  installed in this container (Go is). It skips loudly, as designed. So the *anti-drift* half of the
  gate is unexercised this session; what stands in for it is that `xval-bench.mjs` imports
  `buildRequest`/`build`/`planToSpec` rather than reimplementing them, and reproduces `bench.mjs` on a
  shared cell to the decimal (below).

## 8.3 ⚠ §4.2 AS WRITTEN HAS NO EXECUTABLE PATH — and that is the phase's first real finding

> *"Gather round 1 — the 36 tables, `tools/bench.mjs --json`."*

**`bench.mjs` cannot produce a table.** It is a two-arm duel; the acceptance test is *defined* as an
N×N plan-haste × sim-haste matrix, and `xval-collect.mjs`, `xval-verify.mjs` and `xval-persist.mjs`
all parse that matrix. The tool that does emit it, `tools/xval.mjs`, resolves `RUNNER` +
`EXPORT_BASE` — the native rig whose absence is §1.3's whole argument for doing this phase now. So
the charter and the named instrument did not meet.

Resolved by building the missing piece rather than by lowering the charter: **`tools/xval-bench.mjs`**
— `xval.mjs`'s protocol on `bench.mjs`'s engine. Every link is imported, not reimplemented (protocol
`sim/benchmark.mjs` · transcription `sim/planspec.mjs` · APL `tools/genapl-core.mjs` · request
`sim/simreq.mjs` · engine `sim/sim.wasm` · model `tools/engine-node.mjs` · gear `reference-gear.mjs`).

**Cross-checked against the tool it stands in for:** the matrix cell `plan@h0 simmed@h0` of
`isc+scb short` reads **2782.6 DPS**, and `bench.mjs --spec-a <that plan> --T 108 --haste 0` reads
**2782.6 DPS**. The two front doors are one chain, which is the property §2 claims for the round.

**Deliberately unchanged from `xval.mjs`**, because changing it would make the round mean something
else: the seeded fight draw, the length classes, cross-haste pooling, the wall-jitter wash and its
variant seeds, the `simulate()`-independent artifact guard, and the output format. ★ **All 36 seeds
reproduce the gear-A fights exactly** (`isc-mqg short` = seed 5521 ⇒ T=108, Lust@42, as archived), so
the holdout **sample** is unchanged and only the **baseline** is new. ⚠ That still does not license
diffing a gear-B number against a gear-A one (BENCH §1): same fight, different character.

## 8.4 Two instrument defects found and fixed, both of the house failure shape

- **`tools/bench.mjs --json` was not self-describing.** It emitted the protocol but not what was
  *run*: no preset name, no press times, no target count, and no identity for the two artefacts that
  decide the answer (the engine block, the wasm). §3 says stamp everything; a corpus of those objects
  could not have been read back. Now carries `tool`, `preset`, `cfg.t5two`, `protocol.targets/emit/
  prestack/mana`, each arm's emitted `spec`, and sha1s of `index.html` + `sim/sim.wasm`.
- **★ The campaign driver's pre-pass silently did nothing.** `while IFS=$'\t' read -r … cls boss`:
  tab is IFS *whitespace*, so bash collapses a run of tabs into one delimiter — the deliberately empty
  `TCLASS` field of a boss row vanished, the boss name landed in `cls`, and `boss` came out empty. The
  `[ -n "$boss" ]` filter then matched nothing, the pre-pass built an empty job list, and the campaign
  carried on at half utilisation **with no error anywhere**. This is the repo's dominant failure mode
  (a wrapper that runs and does nothing) in a new hat. Rewritten with `awk -F'\t'`, which does not
  collapse; and a pre-pass that generates zero jobs from a list containing boss cells is now a hard
  error rather than a silent skip.

## 8.5 The measured cost model — why the round is shaped the way it is

Measured on this 4-core box, not estimated:

| | cost |
|---|---|
| solve, T≈110 | ~3–5 s |
| solve, T≈230 | ~40 s |
| solve, T≈420 (`xl`) | **113–165 s** |
| solve, T=420 + AoE (KT) | **~280 s** |
| sim, T=420, single target, ITER=6000 | ~18 s |
| sim, T=420, **6 targets**, ITER=6000 | **~103 s** (≈9× — the AoE window is priced across the whole pull) |

A boss table is 100 cells × 5 wall-jitter variants = 500 sims, so **one KT table ≈ 14 CPU-hours** and
the KT pair is ~55 % of the whole round. With only two tables per boss, a table-per-core campaign
would idle half the box on the longest job of the round. Hence the two additions to `xval-bench.mjs`:
a **plan cache** and **`SHARD=k/n`** (solve once, fan the sims, assemble from a warm cache). Both are
lossless — the optimizer is deterministic by construction and the wasm is deterministic by
measurement (§8.2) — and both keys carry the **engine and wasm bytes**, so an edit to either
invalidates rather than silently mixing two engines into one matrix.

⚠ **Consequence to respect while the round is gathering: do not touch `index.html`.** The PHASE9 §4
CPU-reclaim work is exactly the kind of change that would invalidate every cached plan mid-round and
leave a matrix assembled from two engines. It waits for the round.

## 8.6 The round-1 protocol, stated once

`ITER=6000 · var 0.5 · seed 11 (CRN) · mana 1e8 · cold open (_prestack 0) · emit=fire · pooling ON ·
WJITTER=2 on boss tables · breakpoint-straddle haste sets · gear-B bench character, trinket-swapped
per kit · committed sim.wasm`. Every one of those lands on each table's `XVAL-DONE` line, which is
more than gear-A tables carried (`iter`, `simseed`, `mana`, `targets`, `char`, `wasm`, `tool` are new).

## 8.7 ★★★ THE AUDIT'S BIGGEST FINDING IS NOT ABOUT ACCEPTANCE — the SHIPPED in-page sim is blind to Bloodlust and every trinket

§8.2 established that a press of an **unequipped** trinket is a bit-identical no-op in wowsims rather
than an error. Following that where it led:

**`sim/model-ref.json` — the character the website's "Check in the benchmark sim" button runs — carries
ZERO equipment items, and `raid.buffs.bloodlust: false`.** Measured on the committed
`model-ref-request.json` (the exact file `index.html` fetches), one press at t=0 vs never-press, T=120:

| press | Δ DPS | |
|---|---|---|
| Icy Veins (spell) | **+49.269** | fires |
| Arcane Power (spell) | **+39.715** | fires |
| Berserking (spell) | **+16.100** | fires |
| **Bloodlust** (needs `raidBuffs.bloodlust` to be castable) | **+0.000** | ⚠ **silent no-op** |
| **Icon of the Silver Crescent** (trinket) | **+0.000** | ⚠ **silent no-op** |
| **Skull of Gul'dan** (trinket) | **+0.000** | ⚠ **silent no-op** |
| **Mind Quickening Gem** (trinket) | **+0.000** | ⚠ **silent no-op** |
| Serpent-Coil "Gem" | **−2.982** | ⚠ *worse than a no-op* — it casts a Mana Emerald for a GCD and, with no SCB worn, collects none of the +225 SP that is the whole point |

**The decisive test.** Two plans identical except for where one press goes, 4000 iters, same seed:

| | committed character | with isc+scb worn and bloodlust on |
|---|---|---|
| `Icon@6` vs `Icon@80` (74 s apart) | **0.000 DPS — EXACTLY ZERO** | +14.380 DPS (**+0.756 %**) |
| `Lust@5` vs `Lust@60` (55 s apart) | **0.000 DPS — EXACTLY ZERO** | +24.417 DPS (**+1.290 %**) |

So a user who moves their Icon or their Bloodlust — **the two most consequential decisions the planner
makes** — and presses the verify button gets a dead tie, which the page renders as *"too close to
call"*. Not a wrong number: a confident-looking **null on the exact question asked**. And on the
shakedown's own duel the distortion is large even when a signal does survive: `2:00 lust 0:05`,
model plan vs mash-on-cooldown, reads **+2.70 %** as shipped and **+9.93 %** with the character
fixed — the press *value* more than doubles (193.0 → 446.6 DPS) once Lust and the trinkets exist.

⚠ **Why it was invisible.** Both arms lose the same presses, so nothing looks broken: no error, no
NaN, plausible DPS, and the *sign* usually still agrees with the model (it did in all four shakedown
cells) because IV/AP/Zerk survive and carry the residual signal. It is the same silent-omission class
as Drums/PI — which `sim/planspec.mjs` reports precisely because it is silent — reached by a route
nothing was checking.

**What is now in place (the guard), and what is still owed (the fix).** `tools/bench.mjs` refuses to
run any arm whose spec presses something dead on that character, naming the item and the flag that
fixes it, and gained `--kit a,b` to equip a pair (padding a gear-less character's slots). This
*independently reproduces* the finding through a second route: `bench.mjs --preset X --char model-ref`,
a documented invocation, now errors instead of printing a meaningless duel.

**Still owed — and it needs `index.html`, so it waits for the round** (§8.5: editing `index.html`
mid-round would make the plan cache assemble a matrix from two engines):
1. equip the trinkets the user's kit actually enables, and set `raid.buffs.bloodlust`;
2. ⚠ **wowsims has TWO trinket slots and the planner offers FOUR on-use trinkets** — so a kit naming
   three or more can never be fully equipped. That is a real structural limit of the verification, and
   it must be *reported in the UI*, exactly as Drums/PI/Ashtongue already are, rather than silently
   dropped. This limit is probably why the character was gear-less in the first place; going gear-less
   made every kit equally unverifiable instead of one kit partly so.
3. `sim/model-ref.json` and `sim/model-ref-request.json` must be edited **together** so a future
   `--dumpreq` still reproduces the template, and `tests/sim-request.mjs` re-run **with a native
   `RUNNER`** before the change is trusted — that is the gate this session cannot execute (§8.2).

## 8.8 ✅ THE INSTRUMENT IS FULLY CERTIFIED — including the gate §8.2 said it could not run

§8.2 recorded `tests/sim-request.mjs` as unrunnable here (no `protoc`). **That was true of the
container, not of the recipe** — `apt-get install protobuf-compiler` supplies `protoc 3.21.12`, the
`wowsims/tbc-new` clone and `proxy.golang.org` are both reachable, and BENCH §3d's build recipe runs
end to end in about **four minutes**. So the native rig was rebuilt and every gate was executed:

| gate | result |
|---|---|
| `tests/sim-duel.mjs` **with `RUNNER`** | **PASS — shipped wasm == native runner** (`1351.5` vs `1351.5`, `1345.6` vs `1345.6`) |
| `tests/sim-request.mjs` (the anti-drift gate) | **PASS, 9/9** — protocol invariants (var≠0, cold open, infinite mana, seed spacing, hit cap); **both** committed templates are fresh `--dumpreq`s of their exports; and the page's request equals the runner's field-for-field on plain / geared / cold-snap / intermission / **AoE 4-target** / odd-stats |
| trust anchor, gear B (`runner --dumpreq` → `wowsimcli sim --infile`) | **runner `1146.9 / 86.1 / 1586.3` ≡ wowsimcli `1146.9094876137967 / 86.13208492668227 / 1586.2720464676802`** — identical to every printed digit |
| `tests/exact-match.mjs` (the model side) | **25 passed, 0 failed** |

Three things follow, and the third is the one to carry forward.

1. **The round is being gathered on a certified engine.** The wasm equals the native runner, the
   native runner equals upstream `wowsimcli` on a byte-identical request, and the model side is
   green — so a disagreement found in this round is attributable to the model or the harness inputs,
   never to the binary.
2. **★ The recipe is reproducible from the repo, in a container that never saw the original.** The
   anchor did not merely pass a self-consistency check — it reproduced **BENCH §3d's recorded gear-B
   numbers exactly**, having been rebuilt from scratch elsewhere. That is a stronger statement than
   §3d could make about itself, and it retires any lingering doubt from the 07-26 "the rig's source is
   not publicly recoverable" episode (DIARY).
3. **⚠ So §1.3 slightly overstates its case, and the correction matters.** "All of that is gone" is
   true as *convenience* — a duel is ~10 s cold vs ~4 min of setup — but **not** as availability. The
   native rig is still the only thing that can run the anti-drift gate, re-certify the anchor, or
   regenerate a `--dumpreq` template, and it is ~4 minutes away. Read §1.3 as *"you no longer need the
   rig to get a number"*, never as *"the rig is unavailable"* — the second reading is what would let a
   template drift uncaught.

★ **And this is what makes the §8.7 fix gateable.** `model-ref-request.json` currently passes the
freshness check, so the fix (equip the kit's trinkets, enable Bloodlust) can edit the export and
regenerate the template properly, then re-run `tests/sim-request.mjs` to prove the pair still agrees —
which §8.7 listed as owed and unexecutable.

## 8.9 ★★ THE NEW DRIVER IS PROVEN EQUIVALENT TO THE OLD ONE — plans byte-identical, matrix cell-for-cell

§8.3 built `xval-bench.mjs` and argued it was `xval.mjs`'s protocol on `bench.mjs`'s engine. Once the
native rig existed (§8.8) that stopped being an argument and became a measurement: **run the legacy
`tools/xval.mjs` on the same cell and compare.** Same seed, same kit, same haste set, same ITER:

```
KIT=isc,scb TCLASS=short HASTES=0,65,195 ITER=500 node tools/xval.mjs      5521   # chromium + native runner
KIT=isc,scb TCLASS=short HASTES=0,65,195 ITER=500 node tools/xval-bench.mjs 5521   # bare node + committed wasm
```

**The plans are byte-identical** — same fight draw (`T=108 Lust@42`), same `eff` to three decimals,
same specs including key order:

```
plan@h0:   eff=91.831   {"_prestack":0,"BL":[42],"AP":[54],"Zerk":[43],"Icon":[54],"Gem":[54],"IV":[0,54],"CS":[54]}
plan@h65:  eff=95.087   {"_prestack":0,"BL":[42],"AP":[42],"Zerk":[43],"Icon":[42],"Gem":[42],"IV":[0,20],"CS":[20]}
plan@h195: eff=102.187  {"_prestack":0,"BL":[42],"AP":[42],"Zerk":[1], "Icon":[42],"Gem":[42],"IV":[0,20],"CS":[20]}
```

**And the DPS matrix agrees in every cell, to the printed decimal:**

```
plan\sim        0      65     195          plan\sim        0      65     195
0          2781.4  2857.2  3008.4          0          2781.4  2857.2  3008.4
65         2758.9  2881.0  3072.0    ==    65         2758.9  2881.0  3072.0
195        2745.0  2867.7  3089.8          195        2745.0  2867.7  3089.8
   xval.mjs (native runner)                   xval-bench.mjs (committed wasm)
```

Both `monoDip=0.00% diag=CLEAN`. This certifies more than the port: the model runs in **chromium** on
one side and **bare node** on the other, so the two JS hosts agree on the optimizer to three decimals
of `eff`; and the sim is `RunRaidSimConcurrent` (4 goroutines) on one side and single-threaded
`RunRaidSim` on the other. ⇒ **A gear-B table can be read as continuous in METHOD with the archived
gear-A corpus** — same protocol, same transcription, same search — while remaining, per BENCH §1,
strictly incomparable in NUMBER.

## 8.10 ⚠ AN INCIDENT, AND THE GUARD IT BOUGHT — a corrupted table that still parsed

**My error.** While testing `SKIP_EXISTING` I pointed `XVDIR` at the **live** results directory.
`run_cell` opens its output with `>`, which **truncates** — so a file the running campaign still had
open at a high offset was cut out from under it and the kernel filled the gap with NUL bytes.

**The damage took the worst possible shape: the corrupted table STILL PARSED.**
`mqg-skull-medlong.txt` kept its header, all ten `plan@h` lines, a full 10-row matrix and a valid
`XVAL-DONE`. Every structural check passed. Only a byte-level look found **3019 NUL bytes** and two
interleaved stderr streams — timestamps running `16:45:48 → 16:45:33`, which is two writers.

**Blast radius measured, not assumed:** a per-file NUL count across the directory reads **3019 for
medlong and 0 for every other table**. The cell was re-run cleanly and diffed: every data line
matches, so the *numbers* were never wrong — only the file was dirty. The clean re-run replaces it.
⚠ *My first corruption scan was itself broken*, in the same family as everything else here: bash
`$'\0'` is an **empty string**, so `grep -c $'\0'` counted every line and made five healthy tables
look corrupt. Re-measured in node.

**Three fixes, each controlled in both directions:**
1. **A writer lock** in `run_cell` (`set -o noclobber` on a `.lock`). Verified: with a lock held the
   cell is refused **and no `.txt` is created**, so nothing is truncated.
2. **`xval-verify.mjs` and `xval-collect.mjs` now REJECT any table containing a NUL byte.** This is
   the load-bearing half — the lock removes the *cause*, but the lesson is that the *effect* passes
   every existing check, so the readers must catch it by content. Verified: two clean tables still
   grade; the same pair with 400 NULs spliced in (still containing `XVAL-DONE`) exits **2** from the
   verifier and lands in the collector's Errors section.
3. `SKIP_EXISTING` is documented as the resume path, and the lock is what makes it safe to use while
   anything else is running.

★ **The general lesson, which is this repo's oldest one in a new costume:** every guard in the
campaign checked *structure* — is there a header, ten plan rows, a matrix, an `XVAL-DONE`? Structure
survived the corruption intact. **A file can be well-formed and still not be a record of anything.**

## 8.11 ✅ The solve → shard → assemble path is proven byte-identical to a direct run

§8.5's sharding is what makes the KT pair fit on a 4-core box, and it would otherwise only be
exercised for the first time *during* the ~9-hour boss phase — where a defect would surface at the
very end. Validated up front on a small boss cell (`Lady Vashj`, `isc+scb`, 2 hastes, ITER=200):

```
SOLVE_ONLY=1  → plans cached
SHARD=0/2     → rows=1  cache=0/10      (each shard sims its own rows: 2 sim-hastes × 5 wall-jitter variants)
SHARD=1/2     → rows=1  cache=0/10
(assembly)    → cache=20/20             ← every sim a hit; the assembling process re-simulates NOTHING
```

and the assembled table **diffs byte-identical** against the same cell run directly with a *fresh*
cache directory. So sharding is a pure scheduling change: it buys wall-clock and changes no number.
The run also confirms the boss path engages what it should — `wj=2` (five wall-jitter variants) and
`targets=0` for a Vashj table, which carries intermissions but no AoE phase.

## 8.12 ✅ §8.7 HALF-FIXED — the benchmark mage now wears its trinkets and can be Lusted

The half that does **not** need `index.html` landed immediately: `sim/model-ref.json` equips the two
on-use trinkets (Icon 29370, Serpent-Coil 30720) and sets `raidBuffs.bloodlust`, and
`model-ref-request.json` was regenerated with the native runner's `--dumpreq` so the pair stays
matched. Measured on the committed character, one press vs never-press:

| | before | after |
|---|---|---|
| **Bloodlust** | **+0.000** | **+165.482** |
| Icon of the Silver Crescent | +0.000 | +15.033 |
| Serpent-Coil "Gem" | **−2.982** | +12.543 |
| Icy Veins / Arcane Power / Berserking | +49.269 / +39.715 / +16.100 | unchanged — they always fired |

And the decisive pairs, which read **exactly 0.000** before: `Icon@6` vs `Icon@80` → **+0.756 %**,
`Lust@5` vs `Lust@60` → **+1.290 %**.

**Gated, not hoped:** `tests/sim-request.mjs` passes 9/9 with the native runner **including both
template-freshness checks** — the export and its `--dumpreq` template are still a matched pair, which
is exactly the check that makes hand-editing a generated artifact safe, and exactly the check §8.7
had to list as unexecutable before §8.8 rebuilt the rig. `bench.mjs --preset X --char model-ref` — the
documented invocation the new guard had been correctly refusing — works again and reproduces the
patched-character numbers to the decimal.

⚠ **What is still owed, and why it waits.** A kit naming **Skull or MQG** is still unverifiable: two
trinket slots, four on-use trinkets. The page must equip the user's *actual* kit and **report what it
could not equip**, alongside the Drums/PI/Ashtongue line it already prints. And `index.html`'s "?"
dialog still says *"no gear, no buffs"*, which this change makes **stale** — a living doc inside the
product, which DIARY 07-26 already names as the kind that goes stale unnoticed. Both need
`index.html`, and §8.5 forbids touching it until the round stops gathering.

### 8.12a ⚠ CORRECTION TO MY OWN CLAIM — `isc+scb` is NOT what a default user runs

I first justified the fixed pair as covering "the default kit — which is every shipped preset". That
is true of **`GOLDEN_DEFAULTS.kit`** (`isc, scb`), the fixture the 25 goldens, `cfgFor` and
`bench.mjs --preset` all use. It is **not** true of the page. `index.html`'s UI default is

```
state.enabled = { bloodlust:true, icyVeins:true, drums:true, skull:true, arcanePower:true, scb:true,
                  ati:false, berserking:false, mqg:false, powerInfusion:false, isc:false }
```

— **Skull on, Icon off.** So a first-time user's plan presses **Skull**, which the fixed `isc+scb`
character still cannot see. The two "defaults" in this repo are different kits, and I conflated them.

★ **This does not argue for swapping the pair — it kills the idea of a fixed pair.** Choosing
`skull+scb` would just trade the silent no-op onto `bench.mjs --preset` and the preset path instead.
`isc+scb` stays because it keeps the *committed tooling* self-consistent (it is what
`tests/sim-request.mjs` and the preset path exercise), and because the honest fix is dynamic
equipping from the user's own kit. What this sharpens is the **motivation**: the page's own default
kit contains a trinket the verification is blind to, so the owed `index.html` work is not an edge
case for unusual kits — it is the common path.

## 8.13 ✅ The whole transcription surface swept — and one of my own readings corrected

§8.7 found two silent no-ops. That is a *class*, not two incidents, so every key `sim/planspec.mjs`
can emit was swept on **both** committed characters: press it in a context where it must move the DPS
if it works at all, against an otherwise identical control. Talents are identical on both
(`2500052300030150330125--053500031003001`, matching `tools/bench/talents.txt`).

| key | model-ref (website) | bench gear-B (the corpus) |
|---|---|---|
| Icy Veins · Arcane Power · Berserking | +24.1 · +19.4 · +8.0 | +31.7 · +21.7 · +10.3 |
| Bloodlust | +66.2 | +88.3 |
| Icon · Serpent-Coil | +6.0 · +4.5 | +8.3 · +6.4 |
| **Cold Snap** | **+52.3** | **+69.9** |
| Skull · MQG | **0.000 · 0.000** | **0.000 · 0.000** |

⇒ **Everything fires except Skull and MQG, and those are the known two-slot limit** (§8.7), not a new
defect. No third silent no-op exists on the transcription surface.

⚠ **My first Cold Snap reading said "SILENT NO-OP" and it was WRONG — the probe was.** It ran at
`T=300` with `IV:[0,30]`, and at that length the second Icy Veins *fires on its own* once its 180 s
cooldown elapses (~180 s), which is exactly what the un-reset arm's **+20.9 / +28.1 DPS** was. Cold
Snap then adds almost nothing measurable, and on one character the difference rounded to `0.000` —
the signature of a no-op, produced by a control that already contained the effect.

**The decisive design is a fight SHORTER than the cooldown being reset**, so the second use cannot
exist unless Cold Snap creates it. At `T=120`: `IV@0,60` without CS is **bit-identical** to `IV@0`
(the second IV correctly does not fire), and adding `CS@60` is worth **+52.3 / +69.9 DPS**.

★ **The lesson is the one this file keeps re-learning from a new angle: a bit-identical result is
only evidence of a no-op if the control could have shown the effect.** I found two real silent no-ops
by that signature and then manufactured a third from a bad control — which is the same shape as the
`grep -c $'\0'` mistake in §8.10, in the same session.

☞ **One behaviour banked while establishing this:** a scheduled press that is *not ready* is not
dropped — it fires when the cooldown elapses (the `IV@0,30` gain at `T=300`). Harmless for the
corpus, because `planToSpec` pairs every too-early Icy Veins with its Cold Snap press by
construction, so the sim never has to decide. Worth knowing before anyone hand-writes a spec.

## 8.14 ✅ BENCH §4c's owed crit measurement, discharged — `critPct: 38` CONFIRMED on a 6× tighter band

§4c derived gear B's model parameters and left one explicitly owed: *"Tighten the crit band before
relying on that, and treat it as an assumption until then."* Its estimate was **38.1 % ± 5.3 %** from
a single logged iteration (n = 84), and it named the method the limit requires — wowsims logs only
the **first** iteration, so more iterations buy nothing; it needs repeated **single-iteration** runs
at widely separated seeds.

Done with the rig from §8.8: 20 runs, seeds spaced 5×10⁵ (BENCH §3c.3), counting only Arcane Blast
damage lines. **Observed AB crit = 41.88 % ± 0.85 %** (n = 3362, 95 % CI 40.21–43.55).

★ **That confirms 38 rather than contradicting it**, because the two are different quantities:
`cfg.critPct` is **base** spell crit (`aoeCritAmp` adds Potency on top as `crit + qCC(n)·potencyCrit`),
while the log measures the **Potency-inclusive** rate. Predicted observed = `38 + 0.10 × 30 = 41.0 %`
against a measured `41.88 ± 0.85` — **1.0 SE**. The `+30 %` is confirmed twice over: the debug log
shows `SpellCritPercent: 30.000` on `{SpellID: 12536}`, and wowsims' `sim/mage/talents.go:120` reads
`float64(mage.Talents.ArcanePotency) * 10`, matching `index.html`'s `TALENTS.arcanePotency: 3`.

⚠ **I got this wrong first and it is worth recording**, because it is §4c's own withdrawn 56.4 % in
mirror image. My first pass compared 41.88 % straight against `critPct: 38` and printed
*"INCONSISTENT at 95 %"* — an alarm produced by comparing a Potency-**inclusive** measurement to a
Potency-**exclusive** parameter, where §4c's original error was sweeping lines that were not Arcane
Blast at all. **Before calling a measurement inconsistent with a constant, check that the constant
means what the measurement measured.** Third instance this session of an instrument aimed slightly
wrong producing a confident verdict (§8.10's `grep -c $'\0'`, §8.13's Cold Snap control, this).

**Consequence for the round in flight: none, and that is now checked rather than assumed.** Had the
crit really moved, only the AoE tables would have been at risk — on single target `critPct` is a
uniform factor that appears in both `robust` and `plain`, so `eff` and every ranking are invariant to
it. `reference-gear.mjs` is unchanged, which also means the plan cache stays valid.

## 8.15 ✗ THE DRUMS PATCH IS DEFERRED — §7 offers it as a ride-along, and it is not one

§7 lists the Drums `SpellFlagAPL` patch as a cheap win, and §8.12a strengthened the case for it: the
page's default kit is `bloodlust/icyVeins/drums/skull/arcanePower/scb`, so **Drums is on for a
first-time user** and the verification silently excludes it (honestly — the UI names it as dropped —
but excludes it nonetheless).

**The change itself is one line.** `sim/core/buffs.go:1358`, `drumsSpellConfig`:

```go
Flags: SpellFlagNoOnCastComplete,              →  Flags: SpellFlagNoOnCastComplete | SpellFlagAPL,
```

`drumsSpellConfig` is shared by the self-cast path (`registerDrumsCD`, from consumables) and the raid
external (`DrumsBuff`, `ActionID` tagged `-1`, registered as a `MajorCooldown`). The model treats
Drums as a **raid external** (`index.html`'s "Raid externals" group, alongside Bloodlust and Power
Infusion), so the APL press wanted is the tagged-`-1` one — exactly Bloodlust's shape
(`{spellId: 2825, tag: -1}`), which is why Bloodlust works and Drums does not.

**Why it is deferred anyway, and this is the load-bearing part:** *it moves the engine.* Landing it
means rebuilding `sim/sim.wasm`, which is a **protocol constant** of this round — every table stamps
`wasm=aa3005508d3b`, BENCH §4d says the pin is deliberate and moving it is "a new baseline for every
number here", and §3d's trust anchor would need re-certifying. The patch is *provably inert for the
round* (no cross-val kit contains Drums, so no gathered APL presses it), but the shipped engine would
then differ from the one the corpus was gathered on. That is precisely the mixing the stamps exist to
detect, and deliberately creating a case for them to detect is not a cheap win.

⇒ **The right moment is the START of a phase that is establishing a baseline anyway, not the end of
one that just gathered 36 tables.** It is now a ~10-minute job with the location, the mechanism and
the genapl key all written down, plus a trust-anchor re-certification that §8.8 has made routine.

## 8.16 ✅ The grading pipeline is integration-tested end to end, on real gear-B data

Every step of §4's loop 3–5 now runs against real tables rather than against expectation, so the
final analysis is not the first time any of it executes:

```
xval-bench-campaign.sh → tools/xval-results/*.txt
  → xval-verify.mjs      independent recompute + verdict (exit 0/1/2)
  → xval-collect.mjs     ledger + width distribution + plateau breadth  (--json → targets)
  → xval-persist.mjs     the length-persistence prioritizer
  → xval-band.mjs        §5's grading rule: is a column real at ≥3 seeds?
```

Run on the partial round, `verify` and `collect` agree on every headline number (the cross-check
ACCEPTANCE demands), `persist` groups the kit families correctly and excludes boss tables, and `band`
consumes the collector's own JSON without hand-editing.

**And it already answers something.** The two widest columns in the partial set both survive a
three-seed paired band — `isc+scb short @sim165 ← plan@245` at **+0.232 ± 0.090** and
`@sim195 ← plan@215` at **+0.264 ± 0.100**, 3/3 seeds each. Under §5's pre-registered rule those are
**real**, not noise. ⚠ Recorded as a *pipeline* result, **not a verdict**: this is 9 tables of 36 at
`ITER=2000`, and a round is 36 tables at the round's own iteration count.

## 8.17 ⚠ OPERATIONAL — `pkill -f` from an interactive shell kills the shell issuing it

Not a model finding, but it cost real time and it will cost it again. Stopping the campaign to move
it onto the atomic driver (§8.10's follow-up) took **five attempts**, and every failure had the same
cause: **`pkill -f <pattern>` matches the command line of the very shell running it**, because that
command line *contains the pattern*. The shell dies mid-command, the tool reports a bare
`exit code 144`, and — the part that misleads — **the intended target survives**. Twice I concluded
the campaign was stopped when nothing had been signalled at all.

Two further traps in the same family, both hit:

- **`pgrep -f X` from the command line always finds at least one match: itself.** Every "is it still
  alive?" check answered *yes* regardless of the truth, so a chain script that had in fact been
  killed was reported alive for several minutes.
- **Killing the campaign's outer `bash` leaves `xargs -P` running**, and it happily spawns the rest
  of the job list. The process tree is `bash → xargs → bash -c run_cell → node`; the driver is the
  middle one.

**The fix is mechanical: do process work from a SCRIPT FILE.** A script's own command line is
`bash /tmp/stop.sh`, which does not contain the pattern, so `pgrep`/`pkill` inside it see only real
targets. `/tmp/status.sh` and `/tmp/stopclass2.sh` in this session are the pattern; the same applies
to any future campaign management.

☞ **The one thing that made this recoverable rather than expensive:** both caches are
content-addressed on inputs, not on run identity, so every killed cell resumed from **218 cached
plans and 1213 cached sims**. Nothing computed was lost — only wall-clock, and only for the cells
that were mid-flight. That is the property to protect in any future rework of the driver.

## 8.18 ★ PRE-REGISTERED BEFORE THE ROUND LANDED — which columns get the ≥3-seed band

§5 pre-registers the **grading rule** (*real only if it survives at ≥3 seeds with |Δ| > 1σ of the
paired band*) but not the **scope**: which of the round's borrowed-win columns actually get banded.
That gap matters, because the band is the round's one remaining *sim* cost and the corpus is far too
big to band exhaustively — so the selection would otherwise be made while looking at the widths, and
ACCEPTANCE §6 is unambiguous about what that is worth (*"a sieve whose thresholds you chose after
seeing the data is not evidence"*). Written down here at **11/36 tables**, before any of the six
`isc-mqg` / `scb-*` families existed on disk.

**The measured cost, which is why a scope is needed at all.** `xval-band.mjs` re-sims both plans at
3 seeds, reproducing the cell's own geometry — so a **class** column is `3 × 2 × 1 = 6` sims and a
**boss** column is `3 × 2 × 5 = 30` (WJITTER=2's five variants). One seed of the round is `BENCH`'s
own, so ≈⅓ are cache hits. At §8.5's measured rates that is ~25–70 s for a class column, ~5 min for
a Vashj/Al'ar column, and **~34 min for a KT column** (6 targets, ≈103 s/sim). A gear-A-sized ledger
banded whole would be 6–10 CPU-hours on a box that has just spent 50.

**The scope, as a rule and not a threshold.** Band the **union** of two sets, each of which is the
output of an existing instrument rather than a number chosen here:

1. **Every column `tools/xval-persist.mjs` names** — a rival that wins at all-but-at-most-one fight
   length. ACCEPTANCE §5 argues this is the *only shape* a genuine haste-adaptation defect can take,
   so these are graded however wide they are, including the ones sitting at 0.007 %.
2. **Every column `tools/ripple-audit.mjs` puts `over the floor` or `INDETERMINATE`** — the cells a
   real model defect can still live in, plus the ones whose verdict *flips* between the two
   defensible reads of the kill-edge period. INDETERMINATE is banded deliberately: it is claimed for
   neither side, and a paired band is exactly the measurement that can claim it.

**Not banded: `inside the floor` and non-persistent.** For those the ruler is already coarser than
the deficit, so a band cannot change any verdict they support — it would only re-measure an
unmeasurable quantity more precisely-looking. Their **count is published** in the ACCEPTANCE block
alongside the banded ones; per §5's "no silent caps", a column that was not graded must be visible as
not-graded, never absorbed into a total.

**If the union still overruns the box**, band in descending round-1 `pct` and name the dropped
columns explicitly — with their loci, so the list is resumable rather than merely honest.

⚠ **What the band does NOT do: relax the bar.** ACCEPTANCE's B2 bar is **zero borrowed-win columns**,
user-directed and unchanged; `xval-band.mjs` prints that in its own footer. "Not resolvable" is a
statement about this instrument at this iteration count — it prioritizes work, it does not retire a
column. The failure mode this paragraph exists to prevent is reporting *"N real, M not resolvable"*
and quietly treating `M` as passed.

## 8.19 ✅ THE STAMPS NOW HAVE AN INSTRUMENT — `tools/xval-stamp-audit.mjs`

§8.6 stated the round-1 protocol "once" and put all of it on every `XVAL-DONE` line; `xval-results/
README.md` says the `char=bench-gearB` stamp "**not the directory name**, is what tells the two
baselines apart"; §8.5 warns that an `index.html` edit mid-round "would assemble a matrix from two
engines". **Nothing read any of it.** `xval-verify.mjs` recomputes the invariants from the matrices
and `xval-collect.mjs` builds the ledger — neither asks whether the 36 files in front of it are the
36 cells of *one* round. ACCEPTANCE's round-5 certification paragraph did exactly these checks **by
hand, once**, which makes them a property of that round rather than of the corpus.

The gate asserts, in order: the **expected cell set** (derived from the campaign's own job-list
formula); **one protocol** across `var/emit/iter/simseed/mana/char/wasm/tool/pool`; `char=bench-gearB`
+ `emit=fire` + `artifact=0` on every table; `wj`/`targets` matching each cell's shape; every table's
haste grid **equal to the committed set for its kit**; `_prestack:0` on every plan row; and no
NUL/NaN/undefined. Exit `0` / `1` / `2` on the shared contract, with **a partial directory exit 2** —
the judgement the README says no tool could make for you, reachable only because the cell set is
derived rather than counted.

**Controlled in both directions before being believed**, which is the only reason it is in the chain:

| control | expected | got |
|---|---|---|
| the five complete `mqg+skull` cells | 0 | **0** |
| mutated `wasm=` on one table | 1 | **1** — `MIXED PROTOCOL on wasm` |
| `char=bench-gearA` on one table | 1 | **1** — `MIXED PROTOCOL on char` |
| a `_prestack:1` plan row | 1 | **1** — names the ★★★ prepull rule |
| the coarse `[0,100,200,300,400]` grid | 1 | **1** — ≠ the committed set for the kit |
| `wj=2` on a class table | 1 | **1** — two instruments pooled |
| one table deleted | 2 | **2** |
| injected NUL bytes | 2 | **2** |
| `XVAL-DONE` stripped | 2 | **2** |
| **the whole archived gear-A round** (36 correctly-named tables) | 1 | **1** — the gear-B stamp set is absent |
| `[null]` press time · `[[10,null]]` nested | 1 | **1** · **1** |

★ **And the gear-A control caught a bug in the tool itself** — the fourth instance this phase of an
instrument aimed slightly wrong producing a confident verdict (§8.10's `grep -c $'\0'`, §8.13's Cold
Snap control, §8.14's Potency-inclusive crit). `_intermissions` and `_aoe` are arrays of **pairs**, so
a flat `some(x => !isFinite(x))` reported **every boss plan row** as non-finite: 157 "violations", 96
of them fictional, and the seven real ones (the absent gear-B stamps) were buried under them. Fixed by
flattening — and because that *loosens* a check, two further controls were added to prove it still
fires at both nesting depths. **A relaxed guard has to re-earn its negative control.**

## 8.20 ✅ THE CHAIN IS ONE COMMAND NOW — `tools/xval-grade.sh`, and its order is load-bearing

§3 of the handoff lists the grading chain as six commands with a ⚠ attached to the first. Running them
by hand at 24/36 showed the ⚠ is not a reminder, it is a **gate**, and that nothing enforced it:

| tool, same partial directory | exit | what it said |
|---|---|---|
| `xval-stamp-audit` | **2** | `CANNOT GRADE` — named all 12 absent cells |
| `xval-verify` | **1** | `VERDICT over 24 tables: A holds · B FAILS -> ACCEPTANCE NOT PASSING` |

That second line is a confident, quotable, **wrong** verdict off two thirds of a round — `xval-verify`
recomputes invariants from whatever matrices it is handed and never asks whether they are one round's
36 cells (§8.19). `tools/xval-grade.sh` runs the chain in order and **refuses to run anything
downstream of a nonzero stamp audit**, so "36 tables or no verdict" is mechanical rather than a rule
someone has to remember. It grades on each stage's `rc`, worst-wins (`2` dominates `1`), and prints
§8.18's pre-registered band scope as the next step instead of leaving it to recall.

⚠ **Every stage captures `rc` WITHOUT a pipeline** (`cmd > file; rc=$?`). This is not a stylistic
choice: the by-hand run that motivated the script reported `EXIT=0` for a tool that had just exited
**2**, because `$?` after `node … | tail` is *tail's* status. A pipeline there would have reported
success for every possible failure — the house false-pass shape, one level up again.

**Controlled in both directions before being believed:**

| control | expected | got |
|---|---|---|
| the real partial round (24/36), full scope | 2, nothing downstream run | **2**, `stamp-audit.txt` the only file produced |
| an exactly-complete 15-cell dir (3 finished kits × 5 classes, `--bosses ""`) | 0 from the gate, whole chain runs | **stamp-audit 0**, all six stages ran, seven output files |

★ **And the positive control failed twice first, for two different instrument reasons — both recorded
because both are traps for the next caller.** (1) The scope was first passed as a single `STAMP_ARGS`
string expanded **unquoted**; bash split it on spaces, `--kits` received only its first kit, and the
audit ran with **defaults** while *appearing* scoped — it reported the full 36-cell expectation and
exited 2, which reads as *"the control failed"* rather than *"the control was never applied."* Scope
now travels as separate variables passed as individually quoted argv words. Note also that
`xval-stamp-audit`'s parser is the **space form** (`--kits value`) — `--kits=value` is silently
ignored. (2) With the scope correctly applied it still exited 2, this time **correctly**: the expected
cell set is a **set equality**, not a subset, so the other 10 tables in the directory are *"more than
the round."* The control needs its own directory holding exactly the scoped cells.

⚠ **The scoped run is a CONTROL, not a result.** It grades 15 of 36 cells and its B-side numbers are
recorded nowhere — the first gear-B reading is the one taken at 36/36 under the full expected set.
`STAMP_KITS`/`STAMP_BOSSES`/`STAMP_BKITS` exist for that control and for auditing a deliberately
partial campaign; narrowing the expected set to whatever happens to be on disk turns the provenance
gate into a rubber stamp, which is why `STAMP_EXPECT` must be set to match and the audit hard-fails on
the size cross-check if it is not.

## 8.21 ⚠⚠ THE ROUND STALLED SILENTLY FOR ~10 HOURS — and the reason it went unnoticed is the finding

At 18:59 the campaign died mid-shard. It was found at **04:55 the next morning**, by a human asking an
unrelated question. Ten hours of a four-core box, idle.

**Cause.** The pipeline was launched with `nohup … &` from an agent shell. That is not enough: the
process stays in the session's **process group**, so when the session's shell went away the whole
campaign went with it — *and took the checkpoint loop with it*, so the durability mechanism stopped at
the same instant as the thing it was there to protect.

★ **Why nothing caught it, which is the part worth keeping.** Every liveness signal in play was
"tables are appearing". But a boss cell legitimately takes the better part of an hour, so **slow
progress and no progress are the same observation from outside.** The monitor watching the round was
watching the *output*, and the output of a dead campaign is indistinguishable from the output of a
working one until you wait longer than the longest legitimate gap — which for this corpus is longer
than anyone would wait before assuming it was fine. This is the same shape as every other finding in
this log: **a signal that cannot distinguish two states is not a signal**, whether it is a NUL-blind
structural check (§8.10), a control that already contains the effect (§8.13), or a progress metric
that cannot separate "slow" from "stopped".

**Fixes, both landed.**
1. `setsid` on launch, so the campaign outlives the shell that starts it.
2. **`tools/xval-watchdog.sh`** — because `setsid` only helps if nothing *else* kills it. It watches
   for the condition directly ("no campaign process **and** the round is incomplete") rather than for
   its symptom, relaunches the campaign and the checkpoint loop, and logs every intervention. Safe to
   run beside a live campaign: `run_cell`'s writer lock (§8.10) makes a duplicate **refuse** the cell
   rather than truncate it, and `SKIP_EXISTING=1` picks up only what is missing.

**Nothing was lost.** `.xval-cache/` survived (348 plans, 2950 sims), so the expensive boss
pre-solves were still banked and the restarted shards report `cache=100/100`. All **30 class tables**
were complete and committed before the stall; only the 6 boss cells remain.

☞ **Operational rule now standing: launch a long round with `setsid`, and start the watchdog with it.**
A round is hours of compute whose failure mode is silence.

## 8.22 ★★★ THE CLASS STRATUM IS COMPLETE — and the persistence work list REPRODUCES gear A's, cell for cell

All **30 class tables** are gathered. The boss half is still running, so **this is not the round's
verdict** (§3: 36 tables or none). But two things here are *not* partial:

- the class stratum is a complete instrument in its own right — ACCEPTANCE ★★ is explicit that boss
  and class cells are **two instruments with different noise** and must never be pooled; and
- **`xval-persist.mjs` excludes boss tables by construction** ("boss tables are one length each"), so
  with all 30 class tables in, **the persistence test is FINAL, not a preview.** It reports over all
  57 kit-columns (6 kits × their haste grids).

### The class-stratum readings

| | |
|---|---|
| **Invariant A** | **PASSES — `monoDip = 0.0000%` on all 30 tables**, and `xval-verify` cross-checks every table's own stamp ("all match") |
| **Invariant B** | **FAILS** — **112** borrowed-win columns across **27/30** tables (bar = zero). CLEAN 3/30 |
| width distribution | median **0.038 %** · mean **0.069 %** · max **0.38 %** · ≥0.3 %: 2 · ≥0.2 %: 9 · ≥0.1 %: 26 |
| plateau breadth | median **90 %** of a table's haste points carry a distinct plan · 3/30 are ≤50 % · ⚠ **2 of those are CLEAN**, so that CLEAN is partly vacuous (`isc+scb medlong` 2/10, `isc+scb xl` 3/10) |
| ripple floor | `priced=112 inside=86 over=16 indet=10` · `rho=0.289` · self-check `mono=0` · `vacuous=0` |

### ★ The finding: the persistence list is the SAME LIST

```
isc-mqg   h40  ← rival plan@h70   wins 5/5   margins% [0.070, 0.008, 0.380, 0.094, 0.071]
isc-skull h20  ← rival plan@h100  wins 4/5   margins% [0.075, 0.004, 0.059, 0.008]
isc-skull h130 ← rival plan@h230  wins 4/5   margins% [0.213, 0.018, 0.013, 0.007]
```

**The first two are gear A's entire work list, reproduced exactly** — same kit, same haste column,
same rival haste, same win count (5/5 and 4/5).

⚠ **This is NOT a violation of BENCH §1, and the distinction matters.** §1 forbids comparing a gear-B
**number** to a gear-A number, and nothing above does: the margins differ, as they must on a different
character, and no arithmetic crosses the baselines. What is being compared is **which cells a
threshold-free structural test names** — a *structural* fact with no units. That test has no magnitude
filter, no borrower-distance filter and nothing tuned after seeing the data (the post-hoc sieve that
disagreed with it is a recorded mistake, ACCEPTANCE §6), so the cells it names are not free parameters.

★★ **Consequence, and it is the phase's first real model result: the low-haste basin debt is NOT a
gear-A artifact.** It survived a character change intact. PHASE10 §1's premise was that every open
debt was "denominated in a currency that no longer exists" — for this one, the *denomination* changed
and the *cell* did not. It is a property of the model, not of the reference gear.

### ⚠ The third column, reported honestly because it cuts the other way

`isc-skull h130` is **new**, and it has history: on gear A it was one of the four survivors of the
**post-hoc sieve** that ACCEPTANCE §6 records as a methodological error, and the unrigged test
correctly **rejected** it there (best 3/5, rival `h185`). On gear B it passes at **4/5 — with a
different rival (`h230`, not `h185`)**. Two readings are open and this stratum cannot separate them:
a genuine cell that gear A's noise hid, or the 1-in-57 that a "loses ≤1 of 5 lengths" criterion admits
by chance. **It goes on the work list and is graded by `xval-band.mjs` like the other two** — it is
not promoted on the strength of having once been named by a discredited sieve.

### What is still owed before any of this is a verdict

The 6 boss tables (invariant A on them, and their contribution to B's column count and distribution),
then the band grading of the three persistence columns ∪ the over-floor cells per §8.18's
pre-registered scope.

## 8.23 ★★★ THE WORST PERSISTENT CELL, DIAGNOSED — it is ONE terminal cast, and the model cannot see it

User challenge, and it was the right one: *"how about we fix the model instead of being happy about
reproducing the same mistakes."* §8.22 confirmed the target is real and gear-independent; this is what
it actually is. Cell: `isc-mqg medlong` (T=229, Lust@162), `@sim40`, native `plan@40` vs rival
`plan@70` — the 5/5 persistence column and the corpus's worst class deficit (0.380 %).

### The two layouts

```
native  BL 162 · AP 8,188 · Zerk 0,188 · Icon 29,183 · MQG 9  · IV 0,20,200  CS 20
rival   BL 162 · AP 6,186 · Zerk 6,186 · Icon 6,182  · MQG 26 · IV 6,26,206  CS 26
```

The native fires **into the cold-open ramp** (`Zerk@0`, `IV@0`); the rival waits for `t=6` and packs
`AP+Zerk+Icon+IV` together. They also place the trinket pair in **opposite order** (`MQG→Icon` vs
`Icon→MQG`).

### It is not a mis-priced press — it is two local optima

`tools/plan-walk.mjs` (new) walks the path one track at a time, **both directions**, model beside sim:

| move | dir | model Δ% | sim Δ% | |
|---|---|---|---|---|
| AP | A→B / B→A | −0.049 / −0.055 | +0.001 / −0.016 | |
| Zerk | A→B / B→A | −0.278 / −0.152 | −0.109 / −0.461 | agree |
| IV+CS | A→B / B→A | −0.077 / −0.105 | −0.128 / −0.379 | agree |
| Icon, MQG | both | — | — | **structurally illegal alone** (below) |
| **trinket pair, atomic** | A→B / B→A | −0.252 / −0.219 | **−0.22 / −0.45** | agree |

**Every legal move from either endpoint goes downhill, in both model and sim**, and the single-track
sim moves sum to −0.236 % against a whole-pair **+0.389 %** — flatly non-additive. ⇒ the two layouts
are **separated by a barrier**; no single move "is" the gap, and there is no press to re-price.

⚠ **Icon and MQG cannot be moved independently at all.** The pair order is atomic because
`OFF_TRINKETS = [skull, mqg, isc]` share a lockout for the buff's **duration** (`index.html:1001`),
so `Icon@6` + `MQG@9` is unexecutable. **This caught a bug in the walk tool itself, and the bug is
this session's fifth instrument error** — the first version checked same-track cooldowns only, and
wowsims does not reject an illegal spec: it **retimes** the press to the first legal moment (26 s),
which happened to be exactly where the other arm already had it. Two different specs, one execution,
`Δ = +0.000` in model *and* sim across three seeds. That reads as "MQG placement does not matter
here"; it means "this row measured nothing." Fixed with a cross-track lockout check (PHASE8 §17.5:
legality is STRUCTURAL, and drift magnitude is not a legality test).

### What the sim sees and the model does not: ONE CAST

Combat logs, same seed, `--haste 40`:

```
native   176 Arcane Blasts    opener completions  1.85 3.45 4.80 5.91 7.02 …
rival    177 Arcane Blasts    opener completions  2.44 4.55 6.34 7.44 8.55 …
```

The native is genuinely **ahead early** — its ramp is buffed, and it is ~2.3 s up by cast 14 — and it
still finishes **one cast short**. It buys time in the ramp that never converts into a cast; the
rival's placement does. One cast in 176 is 0.57 %, against a measured 0.389 % gap: consistent,
because the marginal cast is an unbuffed one worth less than average.

### Why the model is silent, and what is actually left to fix

| | native | rival | |
|---|---|---|---|
| **model** | 186.225 | 186.198 | native better by **0.014 %** — a dead tie, *below the objective's own resolution* |
| **sim** | 2631.3 | 2641.3 | rival better by **0.389 %** — ~13σ |

The model does not **mis-rank** these layouts; it **cannot distinguish them**. That is the case
ACCEPTANCE already names — *"where the model's margin is below the ruler, the model has no opinion to
be wrong about, so no search fix can reach them"* (58 of 135 columns on gear A) — and it is why
cross-haste pooling cannot help: pooling guarantees `model(rival) ≤ model(native)`, and here the two
are equal to four digits.

**The mechanism is the model integrating a continuous cast rate where the sim counts integer casts.**
And the ripple audit prices exactly that: this cell reads `deficit 0.380 % · floor 0.170 % ·
excess 0.210 pp · family RESIDUAL`. So **~45 % of the gap is the documented lattice ripple** and
**0.210 pp is genuinely over the ruler** — that residual is the target, not the whole 0.380 %.

⚠ **And the obvious fix is already falsified.** "Make the scorer count integer casts" was measured on
gear A: across a full column the discrete sum is a **worse** predictor than the integral
(r 0.7910 vs 0.9337, RMSE 0.2948 vs 0.2431) with large two-signed errors. ACCEPTANCE records it as
*not a licence to discretize the scorer*. Any fix has to capture the terminal-cast effect **without**
replacing the integral — which is a real modelling problem, not a patch.

☞ **Next, in order:** (1) test whether the other two persistence columns are also *one terminal cast*
— if the family shares that mechanism it is one fix, not three; (2) only then design a term, gated by
`exact-match` 25/25 + `plan-diff SCORE-AUDIT` + a head-to-head duel at the moved cells.
⛔ **Not landable yet regardless:** the scorer lives in `index.html`, and §8.5 forbids touching it
until the round stops gathering.

## 8.24 ✅ FREEZE AUDIT — two frozen files WERE edited mid-round, and both edits are PROVEN inert

`docs/GEAR-AGNOSTIC.md` §6.2 freezes `sim/simreq.mjs` and `tools/xval-bench.mjs` for the duration of
the round, on the same reasoning as `index.html`: the campaign spawns a fresh `xval-bench.mjs` per
cell and that file imports `simreq.mjs`, so an edit between cells assembles the matrix from two
instruments. **Two commits landed while the round was gathering and touched files in that set.**
"I believe they were harmless" is not the standard here, so:

| commit | file | non-comment diff | verdict |
|---|---|---|---|
| `74c3254` | `sim/simreq.mjs` | **empty** | comment-only — the header now documents the §8.12 trinket/Lust exceptions |
| `23c201a` | `sim/planspec.mjs` | `+REQUIRES_EQUIPPED`, `+unequippedPresses` | **pure additions**; `planToSpec` — the only thing `xval-bench.mjs` imports — untouched |

⇒ **no behavioural change reached the campaign, and the round is internally consistent.** Checked with
`git show <sha> -- <file>` filtered to non-comment, non-blank changed lines, not by reading the commit
message. (`sim/model-ref.json` also changed in `74c3254`; the campaign runs on
`tools/bench/export-request.json` and never loads it.)

★ **The rule this earns:** a freeze is only meaningful if violations are *detectable*. The check is two
commands and belongs in any future round's closing checklist —
`git log --since=<round start> -- <frozen paths>`, then a non-comment diff of anything it names.

## 8.25 ★★ THE FAMILY SPLITS BY MAGNITUDE — the two big persistent cells are BOTH one terminal cast

§8.23 ended with a named next step: *is the mechanism shared, or is it three separate problems?*
Answered by counting Arcane Blasts in each arm at the length where each column's margin is largest
(native runner, `SIMLOG=1`, one iteration, seed 11, `--var 0`, the column's own sim-haste):

| column | length | T | margin % | native casts | rival casts | Δ |
|---|---|---|---|---|---|---|
| `isc-mqg @40 ← plan@70` | medlong | 229 | **0.380** | 176 | 177 | **+1** |
| `isc-skull @130 ← plan@230` | long | 293 | **0.213** | 233 | 234 | **+1** |
| `isc-skull @20 ← plan@100` | medium | 177 | 0.075 | 136 | 136 | **0** |

**The two columns that carry real magnitude are the same mechanism**, and the third is not — it has
**equal cast counts**, so its 0.075 % is a *value* difference (which casts got buffed) rather than a
*count* difference. The family is not homogeneous, but it splits cleanly along magnitude rather than
along kit or haste.

★ **The arithmetic cross-checks, which is what makes this more than a coincidence of counts.** One
cast in 176 is 0.57 % and one in 233 is 0.43 %; the measured DPS margins are 0.380 % and 0.213 %,
i.e. **≈⅔ of the cast fraction in both cases**. That is exactly what a *marginal* cast should be
worth: it is the unbuffed one at the tail, not an average cast. Two independent cells agreeing on
that ratio is a much stronger statement than either count alone.

⇒ **The target is one modelling problem, not three.** A term that lets the objective see a terminal
cast it currently integrates away would address both large persistent columns. The 0.075 % column is
a separate, much smaller question, and it sits close enough to the model's own resolution (§8.23: the
objective's margin on these pairs is ~0.014 %) that it may not be reachable at all.

⚠ **Still not landable, and still not designed.** The scorer is in `index.html`, frozen until 36/36
(§8.5, GEAR-AGNOSTIC §6.2). And the obvious implementation is already falsified — discretizing the
scorer measured *worse* across a full column on gear A (r 0.7910 vs 0.9337). What §8.23–§8.25
establish is the **target and its size**, not the fix.

## 8.26 ⚡ THE BOSS STRATUM MOVED TO THE NATIVE RUNNER — gated bit-identical, and why that respects the freeze

**The problem, measured rather than assumed.** With 30/36 in, the boss half was ~13 hours out on the
wasm. The box was *not* under-used — 4 workers at 97 % CPU, load 4.08 on 4 cores — boss cells are
simply **~5× slower per fight-second** than class cells, because a Vashj APL evaluates a **7-clause
intermission condition every GCD**. (My first read of the rate was also wrong and worth flagging: I
counted new cache *files*, which only appear on a MISS, so hits were invisible.)

**`docs/GEAR-AGNOSTIC.md` §4 legislates for exactly this** — *"bulk corpus gathering → native runner —
6× on the sim half is hours per round"* — and its caveat ("the boss half is solve-dominated") stops
applying once the `SOLVE_ONLY` pre-pass has banked the plans, which it had.

**How this respects a freeze it superficially violates.** `tools/xval-bench.mjs` is frozen mid-round
(GEAR-AGNOSTIC §6.2), and the freeze's stated purpose is that **a MATRIX must never be assembled from
two instruments**. So:

1. the **engine identity is in the DPS cache key** — a wasm-warmed entry cannot be served into a
   native matrix, which is precisely the failure the freeze names;
2. it is **stamped** `engine=native:runner-ap180:<size>` on every `XVAL-DONE`;
3. **no boss table had started**, so each runs wholly on one engine;
4. boss and class strata are **never pooled** anyway (ACCEPTANCE ★★).

**The gate was in situ, not by appeal to `sim-duel`.** A *completed* class table
(`mqg-skull-short`, all 100 cells) re-run through the native backend reproduces the committed wasm
matrix **BIT-IDENTICALLY**. The plan cache is engine-independent by construction, so the banked boss
pre-solves survived — `SOLVE-ONLY` returned instantly on restart.

### ⚠ Two process failures during the switch, both mine, both the same root cause

- **`pkill -f <pattern>` matched the shell issuing it — twice.** §8.17 already records this trap and I
  walked into it anyway, because the pattern sat in a **heredoc**, which is part of the invoking
  shell's argv. It killed the cleanup script mid-run and left the (lock-less) watchdogs alive to
  respawn everything: 2 campaigns, 13 workers, load 28. **The reliable form is to collect PIDs into a
  FILE first, then kill by PID from a script whose own argv never contains the pattern.**
- **Then my *count* of the survivors was wrong the same way.** `pgrep -fc 'xval-watchdog'` reported 4
  watchdogs because it also matched my own shell wrappers. The pipeline was in fact clean — one
  watchdog holding the lock, one campaign, four workers, one checkpoint loop — and for a few minutes
  I believed a working singleton lock had failed. Read `ps -eo pid,ppid,cmd` and look at the tree;
  do not trust a `-f` count.

**The fix that stops the first one recurring:** `tools/xval-watchdog.sh` now takes a `noclobber` PID
lock, so a second watchdog exits instead of racing. Two watchdogs is not twice the work — it is the
same work at half throughput plus constant writer-lock collisions.
