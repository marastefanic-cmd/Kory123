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

**The score is a continuous cast-rate integral** — the single law behind every overlay rule below.
Damage is `∫ castDamage(t) / interval(t) dt` over the fight: at each instant the Arcane Blast interval
comes from the haste active then (clamped at the 1.0s GCD floor), and the cast's damage comes from the
spellpower/damage buffs active then. Two consequences fall out for free, and hold at **every** gear
level with no per-haste tuning:

- **Overcap isn't counted.** Haste past the floor can't shrink the interval, so it adds nothing — only
  the below-floor part of a haste buff is "efficient". As passive gear haste rises the floor gets closer,
  an in-Lust Icy Veins wins less and less, and the optimum slides Icy Veins *out* of Lust on its own —
  the same reasoning that later moves Berserking, then eventually everything, without a single hard-coded
  haste breakpoint. (Verified against the sim: on a 2:40 fight the first Icy Veins is inside Lust at 0
  gear haste and jumps to *after* Lust by ~100 rating.) A haste buff dropped onto casts that are already
  at the floor (Berserking inside a Lust+Icy Veins opener) is genuinely worthless — the sim confirms its
  marginal is zero, not merely small — which is why the planner is free to relocate it (below). Note the
  position of a *working* haste buff is otherwise irrelevant in isolation: Berserking alone sims
  identically at 0:00, 0:50 or 1:40 (its 10s of +10% haste is the same block of extra casts wherever it
  lands) — what makes one spot beat another in a real rotation is only whether its extra casts fall under
  a damage buff, or shove other casts out of one.
- **A damage buff earns its multiplier against the base-damage _flux_ through its window**, and flux is
  higher where casts are faster. So overlapping Arcane Power / Icon / gem with a haste window (Lust, Icy
  Veins) is worth strictly more — more of the *stronger* casts happen under them. That is why the burst
  wants to live inside Lust, and why a haste buff wants to sit under the damage buffs (and vice-versa).

This replaced a per-cast *sum*, which quantised each buff window to a whole number of casts and so
couldn't see sub-cast alignment — the source of phantom "press 2s early" gains and lust-position-
dependent placement. Buff windows start at the **press moment** (a self-buff macro applies to the same
press's Arcane Blast); which cast boundary you actually land on is a sub-GCD fraction set by opener
timing and latency, so the phase-averaged start the integral wants is the press itself.

On top of the score: multi-start local search over activation times — single shifts, block shifts, and
re-adding dropped uses, with a deterministic repair pass that enforces cooldowns, Cold Snap resets,
trinket lockout, Tinnitus, and Sated. Raid-called times (Bloodlust / Drums / PI) are anchors the search
never moves. A final pass **relocates any haste buff whose marginal damage is zero** — Berserking parked
in a Lust+Icy Veins opener is fully floor-absorbed, so it moves to the first spot where its haste
actually does work; the test removes the use and re-scores, so it never touches Icy Veins itself (which
*is* the flooring) or a use already earning its keep. Full durations are preferred — a press slides
earlier whenever that covers the same casts and completes before the kill — but a cooldown that comes
back before the boss dies is **always pressed**: a final window clipped by the kill is free damage (a
second Icon at 2:00 on a 2:10 kill runs 10 of its 20 seconds and still beats holding it, and the score
weighs "suboptimally twice vs optimally once" the other way when the numbers say so). The schedule tags
every clipped press with its real uptime and value. Baselines shown: no cooldowns, and "mash everything
on cooldown".

Ties break toward the natural, overlaid line. When placements sit within one expected cast of each
other, the planner prefers: a window that completes before the kill, then a press anchored to
something you can see (the pull, a raid call, a co-press, a buff ending, a cooldown lighting back
up), then one that **joins an existing press row**, then the one that **overlays the most other buff
windows** (compared coarsely — a few raw seconds of overlap is fake precision), then real expected
damage, with floor-dead avoidance breaking exact value ties — stacked windows keep their value when
the fight drifts a few seconds off last week's timing; perfectly-tiled ones don't. On plain fights
the presses then snap to a 5-second grid phased by the raid calls. The plan is built for the **known
kill time**: the continuous integral credits the final partial cast by its fraction, so the end of the
fight is accounted for honestly without a broad ±variance hedge — which would only drag the terminal
burst a few seconds off its clean spot for a sub-cast gain you'd never execute. So the output is the
sturdy, logical line: damage/spellpower buffs snapped to fully cover their cluster, and the terminal
Icy Veins + Icon aligned to **end at the kill**. Reacting to a boss that dies early is your live job
(pop the burst sooner), not something baked into the plan. The Pressboard shows **press moments** (one
row = one macro press); when the buffs land on the next cast boundary, the row says so in words.

**Leftover haste goes to the earliest efficient spot.** Once every damage cooldown is spent, a haste
buff with nothing left to overlay is pure haste — position-independent, so the score is flat across
every legal spot (Berserking sims the same at 0:25, 0:45 or 1:40). Rather than leave that to search
luck, the planner pulls each such press to the **earliest** second that ties the score, stays efficient
(no extra floored casts — never into a Lust+Icy Veins floor), and is legal. That's deterministic and
drift-safe: a cooldown you *could* fire at 0:25 shouldn't wait until 1:40, where an early kill wastes
it. A press that sits in a real burst (a spellpower buff within a GCD) is left where the alignment put
it. Because the output is now deterministic, a given setup produces one exact schedule — the copyable
plan carries its full setup (gear, enabled trinkets/cooldowns, pinned raid-call times) so it reproduces
byte-for-byte.

**Spellpower/damage buffs slide *forward* onto the richest overlap.** A spellpower buff (Icon, the
Serpent-Coil gem) earns its bonus against the damage flux in its window, and that flux is highest
where a damage *multiplier* already sits — Icon's +155 SP is multiplied by Arcane Power's +30%. The
snap-to-pinned step only offers the *pinned* haste window (Bloodlust) as a magnet, so when the damage
cooldown cluster is staggered a few seconds off the pin — Kael'Thas fires Bloodlust at 4:20 but Arcane
Power/Berserking land at 4:45 — the richer spot is a *non-pinned* second the earlier passes never try,
and the Icon gets parked on the pin. A final pass slides each damage/SP press *later* (dragging its
own later uses forward to stay cooldown-legal) onto that cluster, keeping only strict gains with no
extra clip. It's a small edge — measured at +0.3 DPS on Kael and +0.9 on the 4:00 multi-intermission,
common-random-numbers clean across seeds — but it's free, so the planner takes it. (Forward only: an
already-early buff has nothing better behind it, and a backward wiggle would just drift one onto the
opener ramp for a phantom gain.)

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
2. **Overlap your damage cooldowns with your haste windows.** A damage cooldown (Arcane Power +30% dmg,
   Icon / Serpent-Coil gem +spellpower) is worth its multiplier times *every cast that happens under it*
   — so it wants to sit where casts are fastest, which is under Lust (and Icy Veins). More haste there =
   more of the *stronger* casts. One use of each wants to be inside Lust; Icy Veins wants it too.
   - **Corollary — haste buffs are free to move, so move them onto the damage buffs.** A haste buff's
     value doesn't depend on *where* it lands (Berserking alone sims the same at 0:00, 0:50 or 1:40 — its
     block of extra casts is the same wherever it is). So the only thing that decides its spot is what
     *else* is running: put it where it overlaps the damage cooldowns (its extra casts get multiplied),
     never where it's already floored (Lust+Icy Veins → the GCD floor → a haste buff on top does
     nothing) and never where its shifted cast train knocks casts out of a later damage window.
   - **But let the stacks build first.** Arcane Blast ramps 0→3 stacks over your first ~3 casts, and
     those low-stack casts are *slow*. A damage cooldown fired during that ramp catches fewer casts than
     one fired a few seconds later on full-speed casts. So the opener burst waits ~5s for stacks (and for
     Lust) rather than firing at the pull — measured on a late-Lust pull, holding the pull burst's damage
     cooldowns to ~0:05 is worth **+4 DPS** over firing them at 0:00. (The ramp is *irrelevant* to a haste
     buff — fast-then-short and slow-then-long are the same total casting — which is why only the damage
     side of the burst cares about it.)
3. **But never drop or clip a use just to force the overlap.** On long fights you can't align every
   cooldown with a single Lust window without wasting uses. Roll them on cooldown instead; the ones
   that come off cooldown near the Lust call land in it on their own. Sacrificing a whole use to align
   one loses more than the overlay gains (measured: on a 7:00 Kael pull, three naked Arcane Powers beat
   two with one Lust-aligned).
4. **Lust at the pull → Icy Veins leaves Lust as you gear up, and the planner does it for you.** This
   used to be a hand-tuned rule; it now falls straight out of the overcap math above, at every gear level:
   - **At ~0 haste:** the whole burst opens *inside* Lust (a few seconds in, once stacks are up). Your
     unbuffed cast is slow, so Lust+Icy Veins together barely reach the floor — Icy Veins is mostly
     *efficient* there — and stacking it on Lust buys more of the Arcane-Power/Icon/gem-buffed casts.
   - **As gear haste rises (~100+ rating in the sim):** Lust alone starts driving the cast into the GCD
     floor, so Icy Veins on top of Lust is increasingly *overcapped* and wasted. Past the crossover the
     planner slides **Icy Veins out of the Lust window on its own** (the damage cooldowns stay in Lust —
     they still want the fast casts — while Icy Veins moves to where its haste isn't thrown away). No
     breakpoint is coded; the integral just stops counting the overcapped part. Verified: on a 2:40 fight
     the first Icy Veins is inside Lust at 0 haste and out past Lust by ~100 rating.
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
Kael late-Lust case).

The scoring model was later rebuilt as a **continuous cast-rate integral** (see *The optimizer*) after
the sim disagreed with the old per-cast sum on buff *alignment*: the sum quantised each window to a
whole number of casts, so aligning Icy Veins/Berserking with the damage cooldowns (worth ~0.3% in the
sim) came out as a numerical tie and the planner sometimes pressed the opener 2s early or parked
Berserking in a floored Lust window. The integral scores alignment directly and reproduces every case
the sim was used to check — opener inside Lust at 0 haste and out past Lust by ~100 rating, the second
Icy Veins landing with the post-intermission window, Berserking held out of the floored opener onto a
working spot — with the correct *direction* everywhere and the correct magnitude except where the
opening ramp matters. **The ramp is deliberately still left out**, and the sim says that's right for the
part that used to destabilise the search: a haste buff's value is position-independent (Berserking alone
sims identically at 0:00 / 0:50 / 1:40 — fast-then-short ramp equals slow-then-long), so nothing is lost
by ignoring the ramp for haste. The one place the ramp does bite is a *damage* cooldown fired during the
opener's low-stack casts; the sim measures that at ~+4 DPS for holding a late-Lust pull burst to ~0:05
instead of 0:00, and it is captured as a Bloodlust-overlay rule (let the stacks build) rather than
sim-fitted into the score — a full ramp model over-credits pull-time bursts and destabilises the
long-fight search, which is why it stays out.
