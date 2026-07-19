# Arcane Burn Planner — TBC Cooldown Overlay Optimizer

A single-file web app for **TBC Anniversary-realm Arcane mages** that finds the optimal way to
overlay your on-use / proc haste and spell-power cooldowns over a fight, and gives you a
second-screen schedule to follow during the pull.

**Use it:** open `index.html` in any browser (no install, no network needed).

- Enter your **gear haste rating** and **fight length**
- Check the cooldowns you actually have; enter the raid-called times for **Bloodlust / Drums / Power Infusion** (or leave blank to let the planner place them)
- Hit **Find optimal overlay** — you get the burn timeline, an activation schedule with windows,
  a live **cap sheet**, and a **Pressboard**: one row per press (time + spell icons), with a live
  follow mode — a next-up banner counts down to each press and the row highlight tracks the fight
  (or read it as an agenda if the fight drifts off last week's timing)
- **Save the setup as a boss preset** (stored in your browser) and recall it next raid week

The intended weekly loop: sim/gem/enchant your gear in [wowsims](https://wowsims.com/tbc/), take that
set's haste rating into this tool; before each boss, pull last week's kill time and Bloodlust timing
from Warcraft Logs, load the boss preset, adjust the kill time, and follow the schedule on your second
screen. Tip: kills usually get *faster* week over week — if your gear improved, enter a slightly
shorter fight than last week's log so the final burn window isn't planned past the boss's death.

## The math (TBC 2.4.3, as on Anniversary realms)

- **15.77 haste rating = 1% spell haste** at level 70.
- `castTime = baseCastTime / (1 + haste)`. All haste **rating** adds into one pool first; the resulting
  percentage then stacks **multiplicatively** with each %-speed buff:
  `total = (1 + rating/1577) × 1.30 (Lust) × 1.20 (IV/PI) × 1.10 (Zerk)`.
- The **global cooldown** is hasted too, with a hard **1.0s floor** — reached at exactly **+50% total haste**
  (789 rating unbuffed).
- **Arcane Blast**: 2.5s base cast; each cast stacks a debuff (max 3) cutting the **base** cast by ⅓s
  (and +75% base mana). At 3 stacks the base is 1.5s — identical to the GCD — so once total haste
  passes 50%, 3-stack AB is GCD-locked at 1.0s and *extra haste adds no casts*.
  Going over the floor is still often correct: the planner simulates real casts, so it will overcap a
  window (especially under Arcane Power) when that beats staying under the line.
- **Wording matters**: "increases casting speed by X%" divides cast time by (1+X) — that's Icy Veins,
  Bloodlust, Berserking, Power Infusion. Haste-*rating* effects (Drums, Skull, MQG, Ashtongue) go into
  the additive rating pool instead. Flat reductions (AB's own debuff) come off the base cast before haste.

## The cooldowns

| Cooldown | Effect | Duration | Cooldown | Notes |
|---|---|---|---|---|
| Bloodlust | +30% cast speed | 40s | 10 min (Sated) | **Anniversary: raid-wide + Sated** — one per 10 min of a pull, resets on boss kill |
| Icy Veins | +20% cast speed | 20s | 3 min | off-GCD; multiplicative |
| Cold Snap | resets Icy Veins | — | 8 min | off-GCD, instant second IV |
| Power Infusion | +20% cast speed | 15s | 3 min | priest external; **does not stack with Bloodlust** |
| Berserking (Troll) | +10% cast speed at full HP | 10s | 3 min | the "10% version" — scales to 30% only when badly hurt |
| Drums of Battle | +80 haste rating | 30s | 2 min | party-wide; **Anniversary Tinnitus**: one drum buff per 2 min |
| Skull of Gul'dan | +175 haste rating | 20s | 2 min | BT (Illidan), Phase 3; shares offensive-trinket lockout |
| Mind Quickening Gem | +330 haste rating | 20s | 5 min | Classic Naxx trinket; shares offensive-trinket lockout with Skull |
| Ashtongue Talisman of Insight | 145 haste rating proc | 5s | none | 50% on spell crit, **no ICD**; per-cast up-probability from the last 5s of real casts, floor applied per proc state |
| Arcane Power | +30% damage, +30% mana cost | 15s | 3 min | no shared CD with PoM/trinkets in TBC (that's WotLK) |
| Serpent-Coil Braid | +225 spell dmg on Mana Gem use (+25% gem mana) | 15s | 2 min (gem) | SSC (Morogrim), Phase 2 — passive trinket, gem is off-GCD |
| Icon of the Silver Crescent | +155 spell dmg | 20s | 2 min | badge trinket; shares offensive-trinket lockout |

Offensive-trinket lockout: activating Skull, MQG, or Icon locks the others for the **used buff's
duration** (20s), while the used trinket takes its own full cooldown.

## The optimizer

Cast-by-cast simulation of AB spam (stacking debuff, hasted GCD with floor, buff snapshots at cast
start) scored over the whole fight, then multi-start local search over activation times: single shifts,
block shifts, and re-adding dropped uses, with a deterministic repair pass that enforces cooldowns,
Cold Snap resets, trinket lockout, Tinnitus, and Sated. Raid-called times (Bloodlust / Drums / PI) are
anchors the search never moves. Planner-placed buffs always **complete their full duration before the
fight ends** — no truncated windows. Baselines shown: no cooldowns, and "mash everything on cooldown".

Reproduces the community-consensus behaviors on its own: Icy Veins inside Bloodlust at 0 gear haste
and shifted out past ~150–200 rating; no mid-fight BL+IV+Berserking triple-stack (but it will
deliberately triple-stack the opener ramp, where casts are still longer than the GCD); the Serpent-Coil
gem window paired with Arcane Power, twice on fights long enough to fit both windows fully.

Not modeled: mana (you manage gems/potions/Evocation), the conserve rotation between windows
(changes absolute DPS, not which overlay wins). Ashtongue procs are handled as a per-cast
up-probability driven by the simulation's own cast history — validated against Monte-Carlo rollouts.

## Kill-time breakpoints

Fight lengths where a cooldown gains one more full-duration use (the app surfaces the ones near
your entered length as a sensitivity note, with the measured upside):

| Unlock | Fight length |
|---|---|
| 2nd Mana Gem (Serpent-Coil) | 2:15 |
| 2nd Icon / Skull / Drums | 2:30 |
| 2nd Berserking | 3:10 |
| 2nd Arcane Power | 3:15 (~+2% overlay gain) |
| 3rd Icy Veins (Cold Snap spent early) | 3:40 |
| 3rd Mana Gem | 4:15 |
| 3rd Icon / Skull / Drums | 4:30 |
| 3rd Arcane Power / Berserking | ~6:15 |

Verified by a 60s–600s optimizer sweep across three loadouts: every use appears at exactly its
theoretical minimum length, total damage is monotone in fight length, and all schedules pass the
cooldown/lockout/full-duration invariants.

## Validation

The engine reproduces the Mage-discord cast-time table exactly (3-stack AB, gear rating 0):
`lust+iv+drums → 0.915s`, `lust+mqg → 0.954s`, `lust+skull+ash → 0.959s`, `iv+mqg → 1.034s`,
`lust → 1.154s`, `no mods → 1.500s / 789 to cap` — including the "HR to cap" column
(−141, −87, −77, −61 …). The in-app **cap sheet** regenerates this table live from your enabled
buffs and gear rating.

Game data cross-checked against both [wowsims/tbc](https://github.com/wowsims/tbc) and the
Anniversary-era [wowsims/tbc-new](https://github.com/wowsims/tbc-new) source (which natively encodes
the Anniversary rules this app models: the 2-min Tinnitus drum debuff, the 10-min Sated gate on
Bloodlust, Bloodlust/Power-Infusion haste non-stacking, the offensive-trinket shared lockout equal to
the used buff's duration, and Ashtongue Talisman at 145 haste), plus Wowhead TBC tooltips and the
community cast-time reference table.
