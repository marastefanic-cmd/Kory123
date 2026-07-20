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
  The planner models AB at a steady 3 stacks: the opening/post-gap ramp is measured to be worth zero
  extra casts below ~400 haste rating (and one quantized cast only far past the floor), and every plan
  pays it equally — so modeling it would only add phantom "triple-stack the pull" behavior without
  changing which overlay wins.
- **Wording matters**: "increases casting speed by X%" divides cast time by (1+X) — that's Icy Veins,
  Bloodlust, Berserking, Power Infusion. Haste-*rating* effects (Drums, Skull, MQG, Ashtongue) go into
  the additive rating pool instead. Flat reductions (AB's own debuff) come off the base cast before haste.

## The cooldowns

| Cooldown | Effect | Duration | Cooldown | Notes |
|---|---|---|---|---|
| Bloodlust | +30% cast speed | 40s | 10 min (Sated) | **Anniversary: raid-wide + Sated** — one per 10 min of a pull, resets on boss kill |
| Icy Veins | +20% cast speed | 20s | 3 min | off-GCD; multiplicative |
| Cold Snap | resets Icy Veins | — | 8 min | off-GCD, instant second IV |
| Power Infusion | +20% cast speed | 15s | 3 min | priest external; **does not stack with Bloodlust** (original 2.4.0 rule) |
| Berserking (Troll) | +10% cast speed at full HP | 10s | 3 min | the "10% version" — scales to 30% only when badly hurt |
| Drums of Battle | +80 haste rating | 30s | 2 min | party-wide; **Tinnitus** (TBC-Classic rule, kept on Anniversary): one drum buff per 2 min |
| Skull of Gul'dan | +175 haste rating | 20s | 2 min | BT (Illidan), Phase 3; shares offensive-trinket lockout |
| Mind Quickening Gem | +330 haste rating | 20s | 5 min | Azuregos (Classic world boss); shares offensive-trinket lockout with Skull |
| Ashtongue Talisman of Insight | 145 haste rating proc | 5s | none | 50% on spell crit, **no ICD**; per-cast up-probability from the last 5s of real casts, floor applied per proc state |
| Arcane Power | +30% damage, +30% mana cost | 15s | 3 min | no shared CD with PoM/trinkets in TBC (that's WotLK) |
| Serpent-Coil Braid | +225 spell dmg on Mana Gem use (+25% gem mana) | 15s | 2 min (gem) | SSC (Morogrim), Phase 2 — passive trinket, gem is off-GCD |
| Icon of the Silver Crescent | +155 spell dmg | 20s | 2 min | badge trinket; shares offensive-trinket lockout |

Offensive-trinket lockout: activating Skull, MQG, or Icon locks the others for the **used buff's
duration** (20s), while the used trinket takes its own full cooldown.

## The optimizer

Cast-by-cast simulation of AB spam (stacking debuff, hasted GCD with floor, buff snapshots at cast
start) scored over the whole fight. Activations fire only at real press opportunities — with the pull,
macroed into the next cast (the "/cast Buff /cast Arcane Blast" spam press), or freely while not
casting (intermissions); a planned time that lands mid-cast fires at the next cast boundary, and
cooldowns run from the actual press moments, which is what the schedule displays. On top of that,
multi-start local search over activation times: single shifts,
block shifts, and re-adding dropped uses, with a deterministic repair pass that enforces cooldowns,
Cold Snap resets, trinket lockout, Tinnitus, and Sated. Raid-called times (Bloodlust / Drums / PI) are
anchors the search never moves. Full durations are preferred — the sim slides a press earlier whenever
that covers the same casts and completes before the kill — but a cooldown that comes back before the
boss dies is **always pressed**: a final window clipped by the kill is free damage (a second Icon at
2:00 on a 2:10 kill runs 10 of its 20 seconds and still beats holding it, and the sim also weighs
"suboptimally twice vs optimally once" the other way when the numbers say so). The schedule tags every
clipped press with its real uptime and value. Baselines shown: no cooldowns, and "mash everything on
cooldown".

Ties break toward the natural, overlaid line. When placements sit within one expected cast of each
other, the planner prefers: a window that completes before the kill, then a press anchored to
something you can see (the pull, a raid call, a co-press, a buff ending, a cooldown lighting back
up), then one that **joins an existing press row**, then the one that **overlays the most other buff
windows** (compared coarsely — a few raw seconds of overlap is fake precision), then real expected
damage, with floor-dead avoidance breaking exact value ties — stacked windows keep their value when
the fight drifts a few seconds off last week's timing; perfectly-tiled ones don't. On plain fights
the presses then snap to a 5-second grid phased by the raid calls. The only guarded currency in these
trades is **expected damage under kill-time uncertainty**: per-second thresholds cliff by a whole cast
when the cast train slides across a wire, so a razor-timed variant that sims higher at exactly the
entered kill time is reported as a note ("only pays if the boss dies on schedule") instead of
dictating the plan. The Pressboard shows **press moments** (one row = one macro press); when the
buffs land on the next cast boundary, the row says so in words.

Three trust rules keep the plan readable: **Cold Snap materiality** — burning Cold Snap mid-fight must
beat the best natural-cooldown plan by at least one effective cast, or the planner holds it and says
so — with one exception: a reset whose extra Icy Veins is a **final clipped window** is spent for any
real gain (a ready cooldown near the kill is free damage); and **press price tags** — any activation
deliberately offset from a neighboring press is tagged with what a single merged press would cost
(e.g. "+133 dmg vs one press at 0:05"), so a scattered-looking second is always either justified with
a number or merged away.

Reproduces the community-consensus behaviors on its own: Icy Veins inside Bloodlust at 0 gear haste
and shifted out past ~150–200 rating; no mid-fight BL+IV+Berserking triple-stack; the Serpent-Coil
gem window paired with Arcane Power, twice on fights long enough to fit both windows fully.

## Bloodlust overlay rules (how to layer cooldowns in the raid)

These are the practical rules behind the schedule, each **verified against a headless wowsims build**
(see Validation). They tell you what to do when the fight drifts off the planned timing, and — the part
the schedule can't fully show — where Bloodlust actually goes on the bosses that pop it late.

1. **Use every cooldown on cooldown.** Before the next boss they're all back off cooldown, so there's
   no reason to "save" one for a better moment — a use you skip is damage you don't get. A window
   clipped by the kill is still free damage.
2. **Overlap your damage cooldowns with Bloodlust.** Arcane Power (+30% dmg) and the spellpower actives
   (Icon, Serpent-Coil gem) gain value from Lust's extra haste — more casts happen under them — so one
   use of each wants to sit inside the Lust window. Icy Veins wants it too.
3. **But never drop or clip a use just to force the overlap.** On long fights you can't align every
   cooldown with a single Lust window without wasting uses. Roll them on cooldown instead; the ones
   that come off cooldown near the Lust call land in it on their own. Sacrificing a whole use to align
   one loses more than the overlay gains (measured: on a 7:00 Kael pull, three naked Arcane Powers beat
   two with one Lust-aligned).
4. **Lust at the pull → the opener flips with your gear (this one surprised us).**
   - **At ~0 haste:** open the burst *inside* Lust. Your unbuffed cast is slow, so Lust's haste is
     pure extra casts under Arcane Power / Icon / gem — opening in Lust sims **+~0.9%** over opening
     at the pull.
   - **Once geared (~150+ haste rating):** open the burst *at the pull*, not in Lust. Lust alone now
     drives your cast into the GCD floor, so stacking Icy Veins on top of it is wasted — Icy Veins is
     worth far more before Lust, and the whole burst wants to stay together at the pull. Opening in
     Lust here sims **−2%**. The sim confirmed the crossover between 0 and ~150 rating; the planner is
     tuned to the geared side (opens at the pull) and is only ~0.9% conservative at exactly 0 haste.
   - The other wrinkle is a **breakpoint kill** where a pull-time press unlocks a full second use a
     Lust opener would clip (e.g. Icon at 0:00 on a ~2:20 kill fits two full windows). Whether that
     wins is a per-fight coin-flip the planner weighs.
5. **Late Lust (Vashj ~5:45, Kael ~4:20): same rules, and Cold Snap is your lever.** Everything rolls
   on cooldown from the pull (not wasted just because Lust is minutes away); whatever comes off cooldown
   around the Lust call drops into it. Spend **Cold Snap** to put a bonus Icy Veins into the Lust window,
   and keep a Serpent-Coil gem charge and an Arcane Power for it if the cooldown timing lines up.

Not modeled: mana (you manage gems/potions/Evocation), the conserve rotation between windows
(changes absolute DPS, not which overlay wins). Ashtongue procs are handled as a per-cast
up-probability driven by the simulation's own cast history — validated against Monte-Carlo rollouts.

## Kill-time breakpoints

Fight lengths where a cooldown gains one more full-duration use (the app surfaces the ones near
your entered length as a sensitivity note, with the measured upside):

| Unlock | Fight length |
|---|---|
| 2nd Mana Gem (Serpent-Coil) | 2:15 |
| 2nd Icon / Skull | 2:20 (first press at 0:00 sharp) |
| 2nd Drums | 2:30 |
| 2nd Berserking | 3:10 |
| 2nd Arcane Power | 3:15 (~+2% overlay gain) |
| 3rd Icy Veins (Cold Snap spent early) | 3:40 |
| 3rd Mana Gem | 4:15 |
| 3rd Icon / Skull | 4:20 |
| 3rd Drums | 4:30 |
| 3rd Berserking | 6:10 |
| 3rd Arcane Power | 6:15 |

Verified by a 60s–600s optimizer sweep across three loadouts: every use appears at exactly its
theoretical minimum length, total damage is monotone in fight length, and all schedules pass the
cooldown/lockout/full-duration invariants. The same cooldown math powers the in-app sensitivity
notes ("if the kill runs to 2:20, a 2nd Icon fits").

## Validation

The engine reproduces the Mage-discord cast-time table exactly (3-stack AB, gear rating 0):
`lust+iv+drums → 0.915s`, `lust+mqg → 0.954s`, `lust+skull+ash → 0.959s`, `iv+mqg → 1.034s`,
`lust → 1.154s`, `no mods → 1.500s / 789 to cap` — including the "HR to cap" column
(−141, −87, −77, −61 …). The in-app **cap sheet** regenerates this table live from your enabled
buffs and gear rating.

Game data cross-checked against both [wowsims/tbc](https://github.com/wowsims/tbc) and the
Anniversary-era [wowsims/tbc-new](https://github.com/wowsims/tbc-new) source (which natively encodes
the rules this app models: the 2-min Tinnitus drum debuff (TBC-Classic era, retained), the 10-min
Sated gate on Bloodlust (Anniversary), Bloodlust/Power-Infusion haste non-stacking (original 2.4.0), the offensive-trinket shared lockout equal to
the used buff's duration, and Ashtongue Talisman at 145 haste), plus Wowhead TBC tooltips and the
community cast-time reference table.

**End-to-end against the real sim.** The overlay choices were checked not just for data but for
*outcome*, by building `wowsims/tbc-new` into a headless CLI and running each planned schedule through
the actual sim engine on this loadout (10k–200k iterations, common random numbers so the mean
difference has a sub-0.1-DPS error bar). Isolating the overlay decision (pure Arcane-Blast spam, mana
removed) the planner's schedule sims **highest** at every length: it beats "mash on cooldown" by
2–3.5%, and its non-obvious calls each pay real damage — Cold Snap's extra Icy Veins is worth +0.5 to
+3.6%, and *holding* Arcane Power to align with the final Icy Veins window (rather than firing it on
cooldown) is worth +1.5% at 5:00. A 160-schedule perturbation search around the planner's output ranks
it in the top few of ~150 at every length and Bloodlust position — nothing beats it by more than
~0.4%, and that residual is diffuse cast-boundary noise, not a structural miss (rank 1 of 101 on the
Kael late-Lust case). The steady-state-3-stack model was confirmed correct here: adding an explicit
opening ramp *lowered* agreement with the sim and destabilised the long-fight search, because opener
haste buffs compress the ramp and the optimizer over-credits a pull-time burst — the reason the ramp
is left out. The one sim-flagged refinement, the early-Lust opener, is captured as a Bloodlust-overlay
rule above rather than sim-fitted into the score (it is haste- and length-dependent, so a fixed
correction would be wrong at other gear levels).
