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
2. **The target is known to have moved.** BENCH §3e measured B2's sim preference shifting **~0.39 pp
   and changing sign** on gear B. Any Phase-8 work started today would aim at a number that is not
   there. That is the strongest argument against "just finish Phase 8": you cannot finish a chase
   whose quarry has moved and not been re-sighted.
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
