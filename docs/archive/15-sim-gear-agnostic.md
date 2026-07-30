> ⛔ **ARCHIVED 2026-07-30 — THE SIM IS RETIRED AND THIS DOC IS A HISTORICAL RECORD, NOT INSTRUCTIONS.**
> User decision: *"I actually want you to retire the simming, it's doing more harm than good. I think we
> have the function/equation locked down and from now on we're better off on our own."* `sim/`, the
> wowsims harness (`bench.mjs`, `genapl*`, the runner patches), the cross-validation machinery
> (`xval-*`), the sim tests and the in-page "Check in benchmark sim" button are **deleted from the
> repo**; the deploy publishes `index.html` alone again.
>
> ⚠ **Every command in this file is dead** — the tools it drives no longer exist. Do not follow it, and
> do not treat a `command not found` as a broken setup. It is kept because the *reasoning* is the
> project's memory: what was measured, which setups were wrong, and which mistakes the harness made
> (the Vashj drop bug, the stale runner, the AP-195 quirk, the prepull cast-loss, `--var 0`). Read it
> as evidence about a retired instrument.
>
> ⚠ **Sim measurements quoted here are not void, but they are also not the standard any more.** Ground
> truth is now `docs/ESTABLISHED-FACTS.md`'s closed forms, `tools/law-check.mjs`, and the seven
> declared layouts in `tests/anchors.mjs`. Where this file and a closed form disagree, the closed form
> wins — that ordering was already true on 07-30 before the retirement (MODEL-DEFECTS §8h).

# GEAR-AGNOSTIC.md — the definitive simming and verification baseline

> **Status: DESIGN AGREED (user decision, 2026-07-26). ✅ THE GATE IS CLEARED — implementation is
> UNBLOCKED.** ⛔ This line used to read *"Implementation is GATED on the in-flight round reaching
> 36/36"*; **that round reached 36/36 on 07-27, was graded, and is archived**
> (`docs/archive/11-phase10-gearb-baseline.md`), which §6's own step list already recorded while this
> banner did not — the two contradicted each other for a day. **No import-closure freeze is in
> effect.** The remaining work is enforcement, not permission: `docs/PHASE13.md` §4 (fold the closure
> into `ENGINE_ID`, make the geared path opt-in, refuse to pool across `char=` stamps, archive round 1
> under a name that says what it is) and §7's stat-distribution transfer test, which is the **first**
> piece of gear-agnostic work and has never been run.
> This file is the single source of truth for how the project sims; where
> it disagrees with an older doc, this file wins and the older doc is the remnant.

## 1. The decision, and the reason for it

**Every simulation this project runs — the website's benchmark button *and* the internal
model-verification corpus — runs on a character defined entirely by the planner's own declared
inputs. No exported gear file, ever again.**

The user's framing: *"I want to get rid of it and move towards the gear agnostic approach, as that's
then more generalisable and applicable for all players regardless of gear. If needed we can then add
things into the input."*

The reason is not convenience. A corpus denominated in an *exported character* is a corpus that can be
invalidated by re-exporting it — and that is not hypothetical: it already happened on 2026-07-26. The
gear A → gear B re-export voided **every acceptance and cross-val number the project owned**
(`docs/BENCH.md` §1) and archived 36 tables. A baseline that can evaporate is not a baseline. Declared
inputs cannot evaporate.

⚠ **This paragraph used to add "and moved the Phase-8 target ~0.39 pp, changing its sign". That claim
was RETRACTED 07-27** — it does not reproduce (BENCH §3e's banner). The argument does **not** depend on
it: the re-export voided the corpus because *nothing in the repo could reproduce the old character*, and
that would be true even if every target had landed in the same place. If anything the retraction
sharpens the case — the project spent a phase's worth of planning on a "moved target" that had not
moved, which is the cost of a baseline you cannot re-derive from declared inputs.

There is a second payoff the user named: it makes the tool's verification *the user's* verification.
A gear-agnostic benchmark is reproducible by anyone who types the same numbers into the page.

## 2. The inputs — the complete list

These are the only things that define the simmed character. Anything else is a bug.

| input | where it comes from | how it reaches the sim |
|---|---|---|
| **Spell damage** | user input | `bonusStats[5]` (`StatSpellDamage`) |
| **Crit %** | user input | `bonusStats[13]`, via `BENCH.critRatingPerPct` |
| **Passive spell haste rating** | user input | `bonusStats[14]` |
| **Spell hit** | **not an input — hardset to cap** | `bonusStats[12] = 202` (16 % vs a level-73 target at 12.615 rating/1 %). A 1 % miss floor is irreducible in TBC and cancels in every comparison. |
| **Tirisfal 2-pc** | the `ck-t5` checkbox | a model-side damage multiplier |
| **Which cooldowns are available** | the kit checkboxes | which on-use effects the APL may schedule |

Everything else about the character — talents, race, Mage Armor, the target's level/armour — is a
**fixed constant of the benchmark**, identical in every arm of every comparison, and therefore cancels.
They are listed in §5 so nobody has to rediscover them.

**The extension path, reserved by the user and deliberately not built yet:** *"If we ever need to, we
can add tierset effects, on-proc effects etc. into the Input table and then compute with them (and sim
with them for the benchmark sanity check)."* When that happens they become **rows in this table** —
declared inputs — never gear.

## 3. ★ THE DEFECT THIS FIXES — trinket passives are NOT gear-agnostic today

**The problem, in the user's words:** *"some of the trinkets also have passive stats allocated on
them — crit, hit, spellpower etc. — that can mess up the results. THOSE ARE ALREADY INPUTTED BY THE
USER, we only want to overlay the Active part and compare how to take those to their maximum."*

That is exactly right, and it is measurable. An on-use trinket **must be equipped** for its press to
do anything (`sim/planspec.mjs`'s `REQUIRES_EQUIPPED` — an unworn press is a bit-identical no-op). But
equipping it also brings its **passive** stats along, on top of the SP/crit the user already declared.

**⚠ Credit where it is due: `docs/BENCH.md` §0.1 already identified this**, in almost the same words —
*"Trinket passives ride along with their actives. Swapping `isc`→`skull` changes +SP/+haste passively,
so an isc-vs-skull table conflates 'the active is better placed' with 'the passive is bigger'. The
corpus was organised per trinket-set, which hides this within a table but makes cross-set numbers
uninterpretable."* BENCH's answer was the §2.1 difference-in-differences, which genuinely does cancel
passives **within** a cell. What is new here is only: (a) the **size**, measured per item and per kit;
(b) the observation in §3.1 that diff-in-diff does **not** close the model-vs-sim half of it; and
(c) a fix that removes the passives outright instead of cancelling them downstream.

**Measured 07-26, never-press on both sides so the difference is passive-only** (20k iters,
declared inputs sp 1387 / crit 38 / haste 0):

```
  (no trinkets)  1533.70    +0.00   +0.00%
  isc+skull      1595.07   +61.37   +4.00%
  scb+skull      1579.60   +45.90   +2.99%
  isc+scb        1572.03   +38.33   +2.50%
  mqg+skull      1568.14   +34.44   +2.25%
  isc+mqg        1560.63   +26.93   +1.76%
  scb+mqg        1544.91   +11.21   +0.73%

  SPREAD ACROSS KITS: 50.16 DPS (3.25%)
```

**The six trinket kits the corpus compares are at six different operating points.** A kit is supposed
to be a choice of *actives*; today it is also a silent stat gift of up to 4 %.

### 3.1 Why this is worse than a scale factor

`docs/BENCH.md` §2.1's difference-in-differences (`value = DPS(presses) − DPS(never-press)`) cancels
the passives **within a cell**, and that is real protection. It does **not** fix two things:

1. **The model and the sim are planning for different mages.** The model is told crit 38 %; the sim
   runs crit 38 % *plus* SCB's +30 crit rating. Passive stats change *which schedule is optimal*, not
   just the DPS scale — so this is the PHASE8 §6/§7 defect class exactly ("if the cfg the model scores
   does not describe the character the sim runs, the two numbers are about different mages and
   'agrees/disagrees' is noise"), re-entering through the item slot instead of the config.
2. **Cross-kit statistics pool six different characters.** Any figure computed over the whole corpus
   inherits a 3.25 % operating-point spread it does not model.

### 3.2 The authoritative passive/active split

From the wowsims item DB at the pinned `ade9f39cc` (`assets/database/db.json`) — the engine's own
numbers, not a lookup from elsewhere:

| trinket | id | **PASSIVE (equip)** | **ACTIVE (the part we want)** |
|---|---|---|---|
| Icon of the Silver Crescent | 29370 | **+43 SpellDamage** (+43 HealingPower) | +155 SpellDamage, 20 s, 120 s cd |
| Serpent-Coil Braid | 30720 | **+30 SpellCrit, +12 SpellHit** | Improved Mana Gems (Mana Emerald grants +225 SP) |
| Skull of Gul'dan | 32483 | **+55 SpellDamage, +25 SpellHit** (+55 HealingPower) | +175 SpellHaste, 20 s, 120 s cd |
| Mind Quickening Gem | 19339 | **none** | +330 SpellHaste, 20 s, 300 s cd |

**This table and the measurement above confirm each other independently, which is why both are here.**
MQG has no passive and measured exactly `+0.00`. Skull and ISC differ only in spell damage, 55 vs 43 —
a ratio of **1.279** — and their measured passive DPS is 34.44 vs 26.93, a ratio of **1.279**. The
hit passives (+12, +25) measure as nothing because the character is already hit-capped, which is what
§2 says should happen.

### 3.3 The fix

**Subtract each equipped item's passive stats from `bonusStats` when building the request**, so the
character's effective stats equal the declared inputs *whatever it is wearing*. The on-use effect is
untouched, so the actives — the only thing under study — are all that the kit changes.

`bonusStats` is additive and `sim/simreq.mjs:buildRequest` already owns the injection, so this is a
subtraction beside the existing `add()` calls, driven by a table keyed on item id.

Two properties this must have, both of which need their own negative control:

- **Idempotent under re-equipping.** Compensation is derived from what the request actually wears, not
  from a caller-supplied kit name, or a trinket swap (which `xval-bench.mjs` does per kit) desyncs it.
- **Loud when it cannot compensate.** An equipped item with no entry in the table must be a hard
  error, not a silent pass-through. An unknown trinket is the same silent-stat-gift bug wearing a new id.

**The gate that proves it works:** the §3 table, re-measured, must read `+0.00` for **every** kit —
i.e. a never-press character is bit-identical no matter which trinkets it wears. That is a sharp,
falsifiable, cheap check, and it is the acceptance test for this change.

## 4. Where the sim runs — wasm and native, and why both

The user asked whether cloning wowsims and running it locally would be faster and more controllable.
**It already runs locally** — `sim/sim.wasm` executes in-process, no network, no service. The real
question is native Go binary vs WebAssembly, and that has a measured answer:

```
iters   wasm(ms)  native(ms)  speedup   wasmDPS    nativeDPS   |delta|
10000       4882         787     6.20x    2099.38     2099.40    0.0183
40000      16574        2885     5.74x    2099.25     2099.20    0.0478
```

**~6× faster, agreeing to 0.02–0.05 DPS** — inside the tolerance `tests/sim-duel.mjs` already uses to
assert wasm ≡ native. So:

| use | engine |
|---|---|
| the website button | **wasm** — it is a browser; nothing else can run there |
| a single check, a fresh container, CI | **wasm** — zero setup beats 6× on a 10 s job |
| **bulk corpus gathering** | **native runner** — 6× on the sim half is hours per round |
| proving the two are interchangeable | `tests/sim-duel.mjs` with `RUNNER` |

⚠ The 6× applies to the **sim half only**; solving (the planner, in node) is untouched, and the boss
half of a round is solve-dominated. Do not budget a re-gather as "50 → 8 hours".

⚠ The native runner is **not** a repo artifact. Go 1.24.7, protoc, the `tbc-new` clone at the pin and a
built `runner-ap180` all exist in this container's `/tmp` and die with it. Treat the ~4-minute rebuild
(`docs/BENCH.md` §3d) as part of round setup. **`sim/sim.wasm` stays the committed default** — BENCH §5's
standing requirement ("a fresh container must produce a number from the repo alone") is not negotiable.

## 5. The fixed constants of the benchmark character

Not inputs, not gear — identical in every arm, so they cancel. Listed so they are never rediscovered
as a surprise (`sim/model-ref.json`):

- **Race Troll** — deliberate: Berserking is a troll racial and the planner schedules it. (Beast
  Slaying is inert; the target is a demon.)
- **Talents** `2500052300030150330125--053500031003001` — a fixed Arcane build.
- **Mage Armor**, **level-73 demon target**, **7700 armour**, **execute proportions 20/35 %**.
- **`raidBuffs.bloodlust = true`** — this does *not* auto-apply a Lust; it makes one **castable**.
  Without it the scheduled press is a bit-identical no-op (PHASE10 §8.7 — it was worth +165 DPS the
  button was scoring as exactly zero).
- **Mana ≈ infinite** (`BENCH.manaInject`), matching the model's infinite-mana assumption.
- **`--var 0.5`** duration variation — settled by measurement (`tools/var-decision.mjs`, BENCH §3).
  ⛔ This line used to add *"the model's kill-window width"*. **Retired 07-27** (PHASE12 §9): the
  scorer's `KILL_WINDOW` taper is gone, replaced by a one-sided boundary credit whose width is the
  cast's own duration, so there is no model constant this mirrors. `0.5` is the **sim's own** smoothing
  and stands on the measurement alone — which is the stronger footing, since that evidence never
  depended on the model. Reconciling the two smoothings is open (PHASE12 §9.4).
- **Cold open**, `_prestack: 0` — the model never prepulls.

⚠ **Talents are a fixed constant, not an input, and that is a deliberate scope boundary.** If a talent
choice ever needs to vary, it becomes a §2 input — it must not become a second character.

## 6. Sequencing — what is blocked on what

> ## ✅ STEPS 1–2 ARE DONE (2026-07-27). **THE FREEZE IS LIFTED.**
> Round 1 finished **36/36**, was graded, and is archived as
> `docs/archive/11-phase10-gearb-baseline.md`; the reading is `docs/ACCEPTANCE.md` → *"Current status
> (GEAR B, round 1)"*. **No import-closure freeze is in effect** — `index.html`, `tools/xval-bench.mjs`
> and the rest of the set below are editable again, and step 3 (§3.3) is unblocked. The two steps are
> kept below because their *reasoning* is what a future round has to re-apply.
> ⚠ **The closure freeze will be needed again for the gear-agnostic re-gather (step 4)** — and PHASE12
> §1.1e's durable fix (fold the closure's hashes into `ENGINE_ID`) is worth landing *before* it, so the
> next round's freeze is enforced by a tool rather than requested by a doc.

1. ~~**The in-flight round finishes as-is, on the geared export.**~~ **DONE.** It was ~50 CPU-hours in
   at 30/36 and killing it would have left ACCEPTANCE with literally nothing. It is **the last geared
   round**, and it is now complete and graded.
2. ~~**⚠⚠ `tools/xval-bench.mjs` AND ITS WHOLE IMPORT CLOSURE ARE FROZEN until 36/36.**~~ **LIFTED —
   the round reached 36/36 on 07-27.** The rule as it stood, because the next round needs it again: The campaign spawns a fresh copy of `xval-bench.mjs` per cell, so editing it
   mid-round assembles the matrix from two instruments. **★ And the closure is the real boundary
   (found 07-27):** `ENGINE_ID` — the plan cache's key — hashes **`index.html` alone**
   (`xval-bench.mjs:179`), so every *other* imported file can be edited and the cache will keep
   serving plans computed by the old code under an unchanged key, silently, for the cells gathered
   after the edit. The frozen set is therefore `index.html`, `tools/xval-bench.mjs`,
   **`tools/engine-node.mjs`**, `tools/genapl-core.mjs`, `tools/reference-gear.mjs`,
   `sim/planspec.mjs`, `sim/simreq.mjs`, `sim/benchmark.mjs`. ⚠ *"Provably behaviour-neutral"* is not
   the test — **in the closure** is; this was found by nearly making an obviously-inert one-field
   addition to `engine-node.mjs`. **The §3.3 fix must not land before the round completes.**
   PHASE12 §1.1e proposes the durable fix: fold the closure's hashes into `ENGINE_ID`, so a mid-round
   edit *misses* the cache instead of silently mixing instruments.
   ✅ **The freeze held, and it is now CHECKABLE that it held**: the closing audit
   (`git log --since=<round start> -- <frozen paths>`, archive/11 §8.28) names four commits and
   **`index.html` is in none of them**, so no plan in the corpus was solved by a different engine than
   any other. A freeze is only meaningful if violations are detectable.
3. **Then land §3.3**, with the §3 table re-measured to all-zero as its gate.
4. **Then re-gather** on the gear-agnostic character (native runner, per §4).
5. **Keep the geared round as a control, not as an acceptance reading.** It makes one question
   answerable that nothing else can: *do scheduling conclusions transfer across stat distributions?*
   Same fights, two characters, compare the argmax plan at each haste. Agreement means the switch cost
   nothing; divergence means the operating point was load-bearing and some gear factors belong in §2's
   input table after all. **Run this before trusting the new corpus.**

## 7. What is now a remnant

These describe the retired approach. They are **historically accurate and must not be rewritten** —
but they are no longer how the project sims, and each needs a pointer here:

- `docs/BENCH.md` §1's frozen gear-B export as *the* character — superseded by §2 above.
- `tools/reference-gear.mjs` — the geared operating point (`sp 1450`, `t5two` on). Still correct for
  reproducing the archived corpus; not the baseline.
- `tools/xval-results-archive/` — every directory is a retired baseline. Its README is the index.
- The four gear-A instruments (`tools/xval.mjs`, `xval-campaign.sh`, `xval-kit.sh`, `xval-boss.sh`) —
  already banner-marked reproduction-only.
