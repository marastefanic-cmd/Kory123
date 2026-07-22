# SOURCES.md — where WoW facts come from, and the verified-facts ledger

TBC (2.4.3 / "Anniversary") is a heavily-analyzed, essentially *solved* game. This tool does **not**
re-derive mechanics — it assembles **known, sourced facts** into a timeline you can execute. So:
when you need a number or a mechanic, **look it up, cross-check it, and record it here with its
source** rather than reasoning it out from scratch. Un-sourced "it's probably X" is how subtle
errors get baked into the model.

## Where to look (in rough priority for this project)

1. **The sim we validate against — `wowsims/tbc-new` source** (Go module `github.com/wowsims/tbc`,
   spell/rotation code under `sim/`). This is the *operational* source of truth: if the tool's model
   and wowsims disagree, wowsims wins, so a formula "as wowsims implements it" is the one to match.
   Read the actual Go (e.g. `sim/mage/arcane_blast.go`, `sim/core/cast.go`, `sim/core/stats/…`) for
   exact coefficients, haste conversion, GCD, and buff values.
2. **Wowhead — TBC Classic database** (`wowhead.com`, TBC Classic mode / `tbc.wowhead.com`). Spell and
   item tooltips, spell/item **IDs**, durations, cooldowns, proc chances. Good for "what does this
   trinket do / what's its itemId."
3. **Warcraft Wiki** (`warcraft.wiki.gg`) and the older **Wowpedia** — game-mechanics formulas: spell
   power coefficients (the `castTime / 3.5` direct-damage rule), haste rating conversion, GCD floor,
   crit damage bonus, combat rating tables. Prefer TBC-era pages.
4. **Community theorycraft** — the wowsims Discord (linked from the wowsims site) for sim-mechanics
   questions; archived **Elitist Jerks** TBC threads (via the Wayback Machine) for the original
   caster theorycraft; class Discords / `/r/classicwow` for current consensus. Treat forum posts as
   leads to verify against sources 1–3, not as citations themselves.
5. **In-game tooltips / a character export** — for the player's actual gear values and talented
   numbers; the wowsims individual-export JSON already encodes the character.
6. **The player's own raid logs** — the `BOSS_PRESETS` (fight length, Lust timing, intermission/AoE
   phases) and the gear baseline are modeled from the player's actual current-phase pulls:
   `fresh.warcraftlogs.com/character/eu/spineshatter/pinkstructor` (a JS app — not machine-scraped;
   the per-fight inputs are transcribed by the user). Keep this out of the shareable `index.html`
   (identity hygiene); it belongs only in these internal docs.

**Verification rule of thumb:** a fact is "verified" when it agrees across **wowsims source + one of
{Wowhead, Warcraft Wiki}**. If a value only appears in one place, or a forum, mark it `unverified`
below and flag it in code review.

## Verified-facts ledger (the constants the model relies on)

Cross-check these against the sources above whenever they're touched; update the status honestly.
(Values as used in `index.html` `GAME`/`BUFFS`.)

| Fact | Value | Source(s) | Status |
|---|---|---|---|
| Haste rating → % (lvl 70) | 15.77 rating = 1% | combat-rating table (Warcraft Wiki) + wowsims stats | verified |
| GCD | 1.5s base, floored **1.0s** | Warcraft Wiki (GCD) + wowsims `core/cast.go` | verified |
| Direct-damage SP coefficient | `castTime / 3.5` (AB 2.5s → 2.5/3.5 ≈ 0.714) | Warcraft Wiki (spell coefficients) + wowsims mage | verified |
| Arcane Blast | −1/3s cast per stack, max 3; +75% mana/stack; 8s debuff | Wowhead (AB, spell 30451) + wowsims `arcane_blast.go` | verified |
| Bloodlust / Icy Veins / Berserking | ×1.30 40s / ×1.20 20s cd180 / ×1.10 10s cd180 | Wowhead + wowsims | verified |
| Arcane Power | +30% dmg (and +30% cost), 15s, **cd 180 from activation** | Wowhead (spell 12042) + user-confirmed | **verified** — real TBC AP is a standard 3-min cooldown that starts **on activation** (180s cadence). The model's cd180 is correct. wowsims' `arcane_power.go` deliberately starts the cd in the aura's `OnExpire` (effective ~195s) — that is a **wowsims quirk, not real TBC**, so the sim is an unreliable referee for multi-AP *timing* (a known blind spot, like AoE). See TOOLING ★. |
| Icon of the Silver Crescent | +155 SP, 20s, cd120 (itemId 29370) | Wowhead item 29370 | verified |
| Serpent-Coil Braid + mana-gem | +225 SP 15s on gem use; ≤3 gem charges | Wowhead (SCB set + Mana Emerald) | verified |
| Cold Snap | resets Icy Veins; cd 480s | Wowhead + wowsims | verified |
| Crit damage multiplier | `CRIT_MULT = 1.8175` (avg crit factor incl. base 1.5× + Arcane "Spell Power" talent + Chaotic Skyfire meta) | needs exact composition confirmed vs wowsims mage crit calc | **verify** |
| Arcane Explosion (AoE) base | 392 (roll 377–407) + 0.214·SP, instant, GCD-bound, linear per-target | wowsims `arcane_explosion.go` (spell 27082) — exact | **verified** — base roll 377–407 (avg **392**) and `BonusCoefficient` **0.214** match the source to the digit; `GCDDefault` (GCD-bound), `CalcAndDealAoeDamage` = full damage to each target (linear in N), `DamageMultiplier 1`. Sim-cross-checked via the `--targets N` runner flag (see TOOLING). |
| Intellect → stats (Arcane) | Mind Mastery 0.05·rank SP/int (5/5 = **0.25 SP/int**); Arcane Mind ×(1+0.03·rank) int (5/5 = **+15%**); int→crit **0.0125%/int** (mage); int→mana pool + √Int in spirit regen | wowsims `mage/talents.go` (`MindMastery` `AddStatDependency`, `ArcaneMind` `MultiplyStat`), `core/mana.go` (`CritPerIntMaxLevel[Mage]=0.0125`, regen `Spirit·√Int·0.009327`) | **verified** — so **intellect is throughput for Arcane, not sustain**: `int EP ≈ 0.29·SP_EP + 0.317·crit_EP` (+ small mana). Used in `docs/EP.md` stat-weight guesstimates. |
| AoE crit-proc amplification (Clearcasting→Arcane Potency) | effective crit rises with target count | wowsims `mage/talents.go` + sim measurement | **verified + modeled** — Arcane Concentration procs **per hit** (`OnSpellHitDealt`, 2%·rank), so an N-target AE cast gets N proc rolls → Clearcasting uptime, hence Arcane Potency's **+30% crit** (3/3, sim-confirmed) on the next cast, scales with N. Measured **+8.6%/target at 6 tgt, crit 38%** (falls as crit rises). **Talent-isolation proves it's ENTIRELY this** (zero the talents → super-linearity gone; gear on-crit SP procs like Tirisfal 4pc add ~0). Modeled via `aoeCritAmp(N,crit)` (`index.html` `TALENTS`), ~75–80% credited (conservative). Gear procs left unmodeled (negligible + transient). |

When you add a rule to `docs/RULES.md`, add its underlying numbers here with a source. When you
confirm or correct a `verify` row, update its status and cite where you checked.

## Note

Keep this file honest and current (see the "keep the docs alive" directive in `CLAUDE.md`). It's fine
— encouraged — to spend time googling and reading the sim source to nail a fact; the point is that
the *result* lands here with a citation so it never has to be re-litigated.
