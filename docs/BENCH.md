# BENCH.md — the gear-agnostic, RNG-minimal sim bench

**Status: DESIGN + baseline change, 2026-07-26. Supersedes the ad-hoc "reference export" convention.**

## 0. Why this exists

The question the tool answers is **"where do I press the actives?"** — not "which trinket is better".
So every sim arm we compare must differ **only** in press timing. Two things violated that:

1. **Trinket passives ride along with their actives.** Swapping `isc`→`skull` changes +SP/+haste
   *passively*, so an isc-vs-skull table conflates "the active is better placed" with "the passive is
   bigger". The corpus was organised per trinket-set, which hides this *within* a table but makes
   **cross-set** numbers uninterpretable.
2. **Gear RNG that has nothing to do with press timing** — the Tirisfal 4pc `+70 SP on crit`
   (`SpellID 37444`) proc, and (coming) Ashtongue. These add variance we then have to average away
   with more iterations, for no modelling benefit.

## 1. ★ THE BASELINE CHANGED — old results are archived, not deleted

The reference character was re-exported 2026-07-26 and **is not the character the existing corpus was
gathered on** (gems and wand changed at minimum). Absolute DPS, the trust anchor, and every
model-vs-sim delta are therefore on a **new baseline**.

- **Gear A** (all rounds up to and including round 7) → `tools/xval-results-archive/gearA-pre-20260726/`
  (36 tables, moved intact). Everything written about them — PHASE7 §5.23/§5.24, PHASE8 §2/§13.8/§22–§26,
  ACCEPTANCE — **remains valid about gear A** and must not be silently re-read as being about gear B.
- **Gear B** (this export) → `tools/bench/export.json`, and `tools/xval-results/` starts empty.
- ⚠ **Do not compare a gear-B number to a gear-A number.** Any table mixing them is void. When the
  first gear-B round lands, restate the acceptance ledger from scratch rather than diffing it against
  round 7.

### 1.1 Policy reversal: the export IS committed now

`docs/archive/07` §6.3 said *"the gear export is user data (NOT in repo) … never commit an export."*
**That policy is hereby reversed**, because it is exactly what made the rig unreproducible when the
container recycled: the patches and runner were committed, the input was not, so nothing in the repo
could produce a number. The export contains **no personal identifiers** (`"name": "Player"`, no realm,
no account) — it is a gear/talent/buff configuration, i.e. an *experimental parameter*, and parameters
belong in version control. It is at `tools/bench/export.json`.

## 2. The design — two normalisations, in order of preference

### 2.1 ★ PRIMARY: difference-in-differences (self-calibrating, no item data needed)

For each arm, sim **the same gear twice** — once with the planned presses, once with a **never-press**
control — and report the arm's value as the *difference*:

```
value(arm) = DPS(arm, planned presses) − DPS(arm, no presses)
```

Everything passive — trinket stats, gems, enchants, the wand, buffs, the 4pc's flat contribution —
appears in **both** terms and cancels **exactly**. What survives is only what the actives did.

- **No item database knowledge required**, so it stays correct when gear changes, which is precisely
  the failure this section exists to prevent.
- Works unchanged for any future trinket, including ones we have not modelled.
- Costs 2× the sims. With CRN pairing (same seed both arms) the control is cheap and very low-variance.
- ⚠ The control must be **never-press, not "press at 0"** — a press at 0 is still a press and still
  perturbs the lattice.

### 2.2 SECONDARY: explicit passive normalisation via `bonusStats`

When a single *absolute* comparable number is wanted across trinket sets, equip each arm's trinkets
(the active requires the item equipped — there is no way around that) and inject compensating
**`bonusStats`** so every arm's passive totals are identical.

- The mechanism exists: `player.bonusStats.stats[]` in the export, and the runner already exposes
  `--sp --crit --haste --int --spirit --mp5` (and documents `--crit` as accepting **negative** values
  "to suppress crit"), so subtraction is supported.
- Cost: it needs each trinket's passive stat block, i.e. item-DB knowledge that goes stale.
- **Use §2.1 unless you specifically need cross-set absolutes.**

## 3. RNG removal — what is safe, and the one that is NOT

| source | action | note |
|---|---|---|
| fight-length variation | **`--var 0`** | already standard for gates |
| Tirisfal 4pc `+70 SP on crit` (37444) | **replace with flat SP** — drop the 4pc, inject `+70 × uptime ≈ +63` via `bonusStats` | PHASE8 §7 already treats it as *effective SP ≈1450* on the model side; this makes the sim agree deterministically instead of in expectation |
| Ashtongue (ATI) | **keep excluded**, and when it is finally modelled, flatten it the same way | already out of the xval kits (a random proc needing separate treatment) |
| base-damage roll, partial resist, hit roll | **leave** | zero-mean and CRN-paired; they cancel in an A/B |
| **crit rate** | ⚠ **DO NOT ZERO** | **recorded trap (DIARY 07-25).** Crit cancels on single target but **not** through `aoeCritAmp(N, crit)` — Clearcasting→Arcane Potency takes N proc rolls per AE cast and its magnitude *falls as crit rises* — so zeroing crit **reweights `M(N)` in exactly the AoE regime the surviving deficits live in.** Keep crit at its real value. |

**The rule:** flatten a random source when it is a *stat* the presses do not interact with; keep it
when it is *coupled to the mechanic under test*. Crit is coupled (via AoE); the 4pc SP proc is not.

## 3b. ★ What the export actually contributes — fixed vs varied vs ignored

An export carries far more than gear. Classifying every part of it is what makes bench mode
well-defined (user-directed, 07-26):

| part of the export | treatment | why |
|---|---|---|
| **equipment** (items/gems/enchants) | **FIXED** — one committed file | the thing §2 normalises across arms |
| **talents** `2500052300030150330125--053500031003001` | ★ **HARDLOCKED** — always correct, never varied | mirrored to `tools/bench/talents.txt` so a drifted export cannot silently change them; the model's coefficients (Arcane Potency, Arcane Meditation 3/3, the AB stack reduction) are derived assuming exactly this build |
| **rotation / priorityList / valueVariables** | ★ **IGNORED — deliberately stripped** | *this is the thing the tool computes.* `runner-main.go` replaces it wholesale via `--apl`, so whatever the export carries is dead weight at best and a silent confound at worst. The committed bench export keeps a **one-line AB-spam placeholder** so the file is still a valid standalone request. **Never gate on the export's own rotation.** |
| **damage/stat raid settings** — Kings, Wrath of Air, elixirs, food, Misery, Curse of Elements, `isbUptime` | **FROZEN** (not ignored) | they set the **operating point** — the SP/crit/haste at which a plan is optimal. They cancel as a *difference* under §2.1, but they decide *which* layout wins, so they are part of the configuration, not noise |
| **mana raid settings** — Shadow-Priest DPS, Innervate, Mana Tide, Mana Spring, Blessing of Wisdom, JoW, potions, gems | ✅ **GENUINELY IGNORABLE** — each measured at **Δ = 0.00 DPS** (§3c.1) | the model is **infinite-mana** and the bench injects `--mana`, so nothing mana-side can bind. ⚠ but **Intellect is damage-side** (int → crit): the guardian elixir stays |
| **encounter duration / variation** | **OVERRIDDEN** per run (`--dur`, `--var 0`) | fight shape is an input to the planner, not a property of the character |

★ **The raid-settings question answers itself under §2.1.** It does not matter whether raid buffs are
"handled" — it matters only that they are **identical in both terms of the difference**. Any setting
that is constant across the two arms cancels *exactly* in `DPS(presses) − DPS(no presses)`. So the
rule is not *ignore them*, it is **freeze them**: one committed export, never edited per-arm. That
disposes of consumables, debuffs, party buffs and `isbUptime` in one stroke, with no judgement calls.

✅ **Bloodlust — the one candidate exception, TESTED AND CLEARED (07-26).** The worry was that
`raidBuffs.bloodlust: true` might auto-apply a Lust *on top of* the one `genapl.mjs` schedules as an
explicit APL press (`spellId 2825, tag -1`) — a double-Lust or mistimed-Lust confound that would
**not** cancel in §2.1, because it is coupled to the press timing under test. Measured directly, no
APL Lust press in either arm, `--var 0 --iter 3000 --seed 1`:

| `raidBuffs.bloodlust` | DPS |
|---|---|
| `true` | **1146.1** |
| `false` | **1146.1** |

**Bit-identical ⇒ the raid buff does not auto-apply.** It only makes Lust *castable*, which is
exactly why the emitted APL press is what places it. So Lust timing is fully under harness control
and needs no special handling — but **re-run this two-line check if the export is ever re-taken**,
since it is a property of the export's settings, not a law.

### 3c ✅ The mana raid-settings are inert under the infinite-mana bench — MEASURED (07-26)

User question: how are Shadow-Priest DPS, Innervate, shaman totems, paladin buffs, raid consumables
and potions handled? **Answer: the mana half needs no handling at all, and that is measured, not
assumed.** Stripping *every* mana-side setting (Shadow-Priest 1000 DPS ⇒ +250 mp5, Innervate, Mana
Tide, Mana Spring, Blessing of Wisdom, Judgement of Wisdom) under `--mana 1000000`:

| arm | DPS | σ |
|---|---|---|
| mana settings ON | 2144.2 | 80.2 |
| mana settings OFF | 2146.4 | 78.9 |

Δ = **2.2 DPS = 0.10 %**, against a standard error of ≈ `80/√3000 ≈ 1.5` ⇒ **≈1.5 SE, inside noise.**
(It is not *bit*-identical only because removing buffs shifts RNG consumption and desyncs the shared
stream — the documented CRN behaviour, DIARY 07-24 — not because anything real changed.)

⚠ **This holds ONLY because mana is made non-binding.** The same export at default mana runs
**1146.1 DPS**; with `--mana 1e6` it runs **2144.2** — **+87 %**. Mana is the single largest
constraint in the untreated sim, so **`--mana` is not an optimisation, it is what makes the sim
answer the model's question.** A bench run that forgets it is not measuring the infinite-mana
planner at all.

⇒ **Do not spend effort tuning mana raid-settings.** Freeze the damage/stat ones; the mana ones are
inert. If a finite-mana study is ever wanted (`docs/EP.md` option B), that is a *different* bench and
must re-enable them deliberately — including `autocastOtherCooldowns`, without which Innervate and
Mana Tide are silently suppressed (−6 % DPS, TOOLING ★).

## 3c. The raid-SUPPORT settings, measured (07-26)

"Settings" here means the raid-support block — Shadow-Priest DPS, Innervate, shaman totems, paladin
blessings, consumables, potions. They split into two classes, and only one is ignorable.

### 3c.1 ✅ Mana-side support is INERT under the bench's infinite-mana condition

Dropped one at a time, `--dur 145 --var 0 --iter 25000 --mana 500000`, all **Δ = 0.00 DPS**:

`manaSpringTotem` · `manaTideTotems` · `blessingOfWisdom` · `shadowPriestDps` (Vampiric Touch
+250 mp5) · `innervates` · `potId` (Super Mana Potion) · `scrollSpi` · `judgementOfWisdom`

This is the expected result and now it is a *measured* one: the model is infinite-mana by
construction and the bench injects `--mana`, so nothing regen- or restoration-side can bind. **These
may be left in or taken out freely.**

⚠ **Intellect is NOT mana-side for a mage** — it gives **spell crit** as well as mana pool. So the
guardian elixir (`32067`, +30 int/+30 spirit) is **damage-side** and must be frozen, even though it
looks like a mana consumable. Judge a setting by *what stat it grants*, not by what it is *for*.

### 3c.2 ✗ Damage/stat support is NOT ignorable — freeze it

Same probe, dropping **Improved Seal of the Crusader**: **−40.4 DPS (−1.9 %)**. That is ~35× the
noise floor and ~5× the deficits this project chases. Kings, Wrath of Air, Arcane Brilliance, Misery,
Curse of Elements, `isbUptime`, the battle elixir, food and the weapon imbue are all in this class.

They cancel as a *difference* under §2.1, so they do not corrupt a press-timing A/B — but they set
the **operating point** (the SP/crit/haste at which a layout is optimal), and the optimal layout is a
function of that point. So the rule is **freeze, don't ignore**: one committed export, never edited
per-arm.

### 3c.3 ★★ THE SEED TRAP — this invalidated the first two versions of the result above

**wowsims seeds per-iteration, so nearby seeds share nearly all their iterations.** At 25 000 iters,
seeds 1/2/3 draw iteration streams `1..25000`, `2..25001`, `3..25002` — **99.99 % identical**. A
"repeat it with three seeds" robustness check using 1, 2, 3 is therefore **one sample, not three**,
and it reports a spuriously *stable* number.

That is exactly what happened here. The first run of §3c.1 read a delta of **+1.20 DPS reproduced
identically across seeds 1, 2, 3** — which reads as a clean deterministic effect and was nearly
written up as "mana support costs 1.2 DPS". Re-run with **widely separated seeds
(1 / 500 000 / 1 000 000 / 1 500 000)** the same comparison gives **+1.20, −0.50, +0.50, −1.00** —
mean ≈ 0, sign flipping. **Noise.**

**Rules, now standing:**
- **Separate seeds by ≫ iteration count** (use `1`, `500000`, `1000000`, …) whenever seeds are meant
  to be independent samples. Adjacent seeds are a false-agreement generator.
- **Identical results across "different" seeds is a red flag, not a confirmation.** Real independent
  samples at σ≈80/√25000 should wobble by ~±0.5 DPS; if they do not, the samples are not independent.
- CRN pairing (deliberately reusing one seed across two arms) is still correct and still wanted —
  the trap is only in treating *nearby* seeds as *independent*.

## 3d. ✅ GEAR-B TRUST ANCHOR — CERTIFIED 07-26 (runner == wowsimcli to the decimal)

The rebuilt rig was cross-checked against the upstream canonical CLI on a **byte-identical request**
(`runner --dumpreq` writes the built `RaidSimRequest`; `wowsimcli sim --infile` consumes exactly it),
gear-B export, `--dur 145 --var 0 --iter 10000 --seed 1`:

| | DPS avg | stdev | max |
|---|---|---|---|
| `runner-ap180` (ours, patched) | 1146.9 | 86.1 | 1586.3 |
| `wowsimcli` (upstream) | 1146.9094876137967 | 86.13208492668227 | 1586.2720464676802 |

**Exact to every printed digit.** This is the anchor TOOLING calls for (*"runner == wowsimcli to the
decimal"*) and it certifies three things at once: the clone is the right source, the two patches did
not disturb the baseline physics, and the gear-B export loads identically through both paths.

Both binaries are reproducible from the repo:
```
git clone https://github.com/wowsims/tbc-new.git && cd tbc-new && git checkout ade9f39
git apply  <repo>/tools/wowsims-patches/apl-schedule-strict-ready.patch
patch -p0 < <repo>/tools/wowsims-patches/ap-cd-at-cast.patch
protoc -I=./proto --go_out=./sim/core ./proto/*.proto     # needs protoc-gen-go@v1.36.10
mkdir -p cmd/runner && cp <repo>/tools/wowsims-patches/runner-main.go cmd/runner/main.go
go build -tags with_db -o runner-ap180 ./cmd/runner
go build -tags with_db -o wowsimcli    ./cmd/wowsimcli
```
⚠ Re-run this anchor **before any gating session**, and **again whenever the export is re-taken** —
it is the cheapest possible check that the rig is the one the numbers were gathered on.

## 4. What this does NOT fix

- Hit rating / miss floor: there is a hard **1 % miss floor** no hit rating clears (DIARY 07-24), so
  hit is never fully removable. It is a flat `×(1−m)` on single target, cancels in an A/B, and is
  therefore harmless — **do not spend effort on it.**
- The model's own objective is unchanged: **effective ABs cast** stays the arbiter (`CLAUDE.md`,
  `MECHANICS.md §4`). Bench mode changes what the *sim* measures, never what the model maximises.

## 4b. ✅ TRUST ANCHOR CERTIFIED ON GEAR B — runner ≡ wowsimcli, exactly (07-26)

The documented gate (*"do this once per fresh session"*) is passed, and by a wider margin than the
recorded ~0.4 %. Same request both sides (`runner --dumpreq` → `wowsimcli sim --infile`), gear B,
`--dur 145 --var 0 --iter 10000 --seed 1`:

| | avg DPS | stdev | max |
|---|---|---|---|
| `runner-ap180` (ours) | 1146.9 | 86.1 | 1586.3 |
| `wowsimcli` (upstream) | 1146.9094876137967 | 86.13208492668227 | 1586.2720464676802 |

**Identical to full float precision** — not "within 0.4 %". That certifies something narrower and
more useful than absolute realism: **our runner adds no distortion of its own.** It is a faithful
wrapper around the same `core.RunRaidSimConcurrent` the upstream CLI drives, so any model-vs-sim
disagreement is attributable to the model or the harness *inputs*, never to the binary.

Both binaries are built from the same `wowsims/tbc-new` @ `ade9f39` tree (+ our two patches for the
runner). ⚠ Re-run this whenever the tree, the patches, or the export change — it is the check that
would catch a stale binary, the failure that once cost this project a day of gates.

## 4c. Gear-B model parameters — SP is UNCHANGED; crit/haste still owed (07-26)

`reference-gear.mjs` holds gear A's `{sp: 1450, critPct: 38, t5two: true}`. Re-derived on gear B by
the PHASE8 §7 method (`SIMLOG=1` combat log, read the `SP:` field per AB cast):

| | gear A (recorded) | **gear B (measured)** |
|---|---|---|
| base SP (4pc down) | 1386.2 | **1386.2 — identical** |
| 4pc up | 1456.2 (+70) | 1456.2 (+70) |
| 4pc uptime | 88–94 % | **82.1 %** (n = 95, **±3.9 % 1 SE**) |
| effective SP | ≈1450 | **≈1444 ± 3** |

★ **The gem/wand change was SP-NEUTRAL** — base SP is bit-identical across the two exports, so it
moved crit/haste/hit instead. Effective SP differs by ≈0.4 %, which is **inside the uptime
uncertainty**, so `sp: 1450` is not yet demonstrably wrong; do not change it on this evidence alone.

⚠ **Two caveats on the uptime number, both structural:**
1. **wowsims logs only the FIRST iteration** — `--iter 30` still yields one fight's worth (95 casts).
   The `±3.9 %` cannot be reduced by asking for more iterations; it needs repeated single-iteration
   runs at different seeds, aggregated.
2. Measured under `--mana 1e6`. Mana does not touch the proc, but the *cast count* differs from a
   mana-bound fight, and uptime is per-cast — so quote it only for the infinite-mana bench.

### Haste — ✅ CONFIRMED 0, read straight off the log's cast times

The log prints `Cast Time` per cast. The opener reads **exactly `2.5s` at 0 stacks** and **`2.166s`
at 1 stack** — i.e. the unhasted AB base (2.5) and one stack of the 0.333 s/stack reduction
(2.5 − 0.333 = 2.167). Any gear haste would scale both down. ⇒ **gear-B haste rating = 0**, matching
`GOLDEN_DEFAULTS.haste: 0`. No probe needed; this one is exact.

### Crit — ≈38 %, consistent with gear A (and a correction to my own first reading)

**First attempt was wrong and is corrected here.** Counting bare `Crit`/`Hit` substrings across the
whole log gave **56.4 %**, which I attributed to Arcane Potency inflation. The real cause was
simpler and entirely mine: that grep swept **every line and every spell** — stat-change lines, other
spells, threat text — not Arcane Blast outcomes. Filtering to actual AB damage lines
(`{SpellID: 30451} … Hit for` / `Crit for`):

| | count |
|---|---|
| AB casts | 84 |
| Hit | 52 |
| **Crit** | **32** |
| **effective AB crit** | **38.1 %** (binomial 1 SE = **5.3 %**) |

⇒ **consistent with `critPct: 38`**, the gear-A value already in `reference-gear.mjs`. At n = 84 the
band is wide (±5.3 % at 1 SE cannot separate 38 from 34 or 42), so this is *"no evidence of change"*,
**not** *"proven identical"* — the same one-iteration logging limit as the SP uptime above.

★ **Provisional conclusion: gear B is model-equivalent to gear A.** All three parameters —
base SP **1386.2 identical**, haste **0 exactly**, crit **38.1 % ± 5.3 %** — are unchanged within
measurement. The gem/wand swap appears to have moved **hit**, or stats the model does not read.
⇒ `reference-gear.mjs` may stand as-is. **Tighten the crit band before relying on that** (repeated
single-iteration runs at varied seeds, or a `--crit` finite-difference), and treat it as an
assumption until then.

⚠ **This does NOT un-archive the gear-A corpus.** Model-equivalence of the *inputs* is not
equivalence of the *sim outputs* — absolute DPS and the trust anchor are still gear-B numbers, and
any hit-rating change moves them. Gear-A tables stay in `xval-results-archive/`.

## 5. Standing requirement

**A fresh container must be able to produce a number from the repo alone.** That now holds:
`wowsims/tbc-new` @ `ade9f39` + `tools/wowsims-patches/*` + `tools/bench/export.json`. If any future
change breaks that chain, fix the chain — do not work around it in a scratchpad.
