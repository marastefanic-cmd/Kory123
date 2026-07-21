# RULES.md — the theorycraft the planner encodes

Living record of the TBC Arcane cooldown rules, each with its **sim evidence** (wowsims, fixed kill,
common random numbers, high iters). The model in `index.html` is an ~0.4%-accurate proxy for these;
when model and sim disagree on a sub-cast call, **the sim wins**. Update this file when a rule is
added, refined, or overturned.

## 1. The scoring law: cast-rate integral

Damage = `∫ castDamage(t) / interval(t) dt`. A cast's *damage* is (for Arcane Blast) independent of
AB stacks — only cast **time** and mana scale with stacks. Haste enters only through `interval`.
A damage/spellpower buff earns its multiplier against the base-damage **flux** flowing through its
window, and flux is higher where casts are faster — so a spellpower buff is worth more overlapping a
haste window, automatically. This single law is behind every overlay rule below.

## 2. The GCD floor — "only the below-cap haste is efficient"

3-stack AB: base cast 1.5s; `interval = max(1.5 / hasteMult, 1.0s)`. The 1.0s GCD floor is reached at
**+50% total haste**. Haste past the floor is **wasted** (interval pinned at 1.0). Multiplicative
stacking: `(1+ratingHaste) × 1.30 Lust × 1.20 IcyVeins × 1.10 Berserking …`.
- Lust alone = +30% (1.15s, unfloored). Lust+IV = +56% (floored → 1.0s, ~3.8% of IV wasted).
  Lust+Berserking = +43% (1.05s, unfloored, fully efficient).

## 3. Ramp is irrelevant for haste, relevant for damage/spellpower

A pure-haste buff is ~position-independent: it "banks" the extra fractional casts to the end, so
moving Berserking around a steady window gives the same total (proved: Berserking@0 = @50 = @100 in
isolation). A **damage/SP** buff is NOT position-independent — it wants **post-ramp, max-stack, fast
casts**, so it should sit on the fastest part of the window. (The opener/post-intermission ramp is
modeled as steady-state 3 stacks; modeling it explicitly was tried and made things worse.)

## 4. Buff-into-Lust packing — THE central alignment rule *(sim-verified this project)*

**Pack every buff into the Lust/damage window: spellpower (Icon, gem), Arcane Power, and haste — the
haste buffs SEQUENTIALLY so they don't overcap the floor.** Where Lust sits on the timeline is
irrelevant by itself; what matters is total buff-seconds landing on the fast, damage-buffed casts.
- 2:15 fight (Lust @0:25): IV@0:25 + Berserking@0:45 (both inside the 40s Lust, sequential) beats
  IV-parked-outside by **+47 DPS**.
- KaelThas 6:00 (Lust @4:20): IV@4:20–4:40 **then** Berserking@4:41–4:51 (both in Lust) beats the old
  "Berserking-in-Lust, IV out @3:20" by **+8.5 DPS**.
- Swapping *which single* haste buff is in Lust is a wash (KaelThas IV-in-lust-alone = −0.7). The win
  is getting the **second** haste buff in too — sequentially, because a haste buff *overlapping* the
  already-floored IV window is worth exactly 0.
- **Align-vs-twice breakpoint:** only pull a cooldown into Lust if it doesn't cost that cooldown its
  **second use**. If aligning would drop a use, keep the two uses instead — but *only* when the
  sim says two-unaligned > one-aligned. This breakpoint should be pinned by sim per fight, not
  assumed. (Model caveat: the model ranks the fully-packed layout highest — a **search** problem to
  reach it — but mis-ranks the *partial* pack, IV-in-lust-alone, above "IV out"; so any packing logic
  must produce the FULL pack, not stop half-way.)

## 5. Icy Veins slides out of Lust as haste gear grows

At ~0 haste, IV belongs in Lust (packed, per #4). As passive haste rating rises, Lust alone
approaches the floor, so Lust+IV wastes more and more — past a breakpoint (~150+ rating in testing)
IV is worth more **outside** Lust, and the whole opener can prefer the pull. No hard breakpoint to
hardcode — it emerges from the floor math; verify with the sim at the target gear.

## 6. Spellpower × Arcane Power is multiplicative

Icon's +155 SP is multiplied by Arcane Power's +30% — so a spellpower buff wants to land **on** the
AP window, not merely on a haste window. Real but small (KaelThas/KT: +0.3–0.9 DPS, clean across
seeds). Matters when the AP cluster is *staggered* off the pinned Lust (KT: Lust @4:20, AP @4:45) —
the spellpower buff should slide onto AP, which a pinned-only snap misses. Forward-slide only (an
already-early buff has nothing better behind it).

## 7. Haste-on-haste overlap is a wash-to-loss (NOT a synergy)

Two pure-haste buffs, overlap vs separate, at 0 gear haste: `overlap − separate ∝ (headroom − (h_a+h_b))`,
where **headroom** = the *additive* haste that reaches the +50% floor = 0.5 at 0 gear (derivation in
`docs/MECHANICS.md` §5.3). The threshold compares the buffs' **additive** percentages against that
headroom — it is **not** their multiplicative product and **not** their combined haste: Lust×IV =
`×1.56` = **+56%, genuinely over the floor** (haste never adds).
- Below headroom (sum < 50%, e.g. Lust+Berserking = 30+10, `m=1.43`): overlap wins by a hair.
- At headroom (Lust+IV: 30+20 = 50, `m=1.56`): **exact wash** — the multiplicative gain is exactly
  cancelled by the ~4% the `×1.56` overlap spills past the floor.
- Above, or with any gear haste (headroom shrinks to `1.5/g − 1`): separate wins.

So the reason to put haste in Lust is **never** haste-stacking synergy — it's to make the *damage/SP*
casts faster and to bank the value before an early kill. (A wowsims "+37 DPS" for Lust+IV overlap at
one fixed fight length turned out to be a boundary artifact — it vanished under randomized kill time.)

## 8. Known-kill planning + Cold Snap

- **Plan for the known kill; react live.** The continuous integral credits the final partial cast by
  its fraction, so the model accounts for the kill honestly on its own. A broad kill-time-variance
  hedge only drags the tail off its clean spot for a sub-cast gain you'd never execute, so the kill
  window is kept to a **half-cast** (smooths the exact-second boundary, doesn't distort placement).
  Reacting to an early death (pop cooldowns sooner) is the player's live job. Result: terminal bursts
  align to end **at** the kill (e.g. KT: last IV+Icon at 6:40, ending at 7:00).
- **Cold Snap** resets Icy Veins (480s cd) — the only way two IVs sit <180s apart. Burning it
  mid-fight must beat the best natural-cooldown plan by ≥ ~one effective cast, else it's held. A
  clipped final IV (back up before the boss dies) is free damage and is pressed.

## 9. Intermissions & AoE

- Intermissions score **zero** (boss untargetable — no casts, no damage), but cooldowns and buff
  durations keep ticking, so the planner holds cooldowns to recover across downtime.
- **Invariant (to enforce coherently):** a buff window must not *begin* inside an intermission — a
  press whose window would start in the dead zone belongs at the exit or held to the next real burst.
  Placement/tie-break passes must be downtime-aware (a Cold-Snap IV after an intermission should land
  on the clean post-ramp burst, not 1s inside the dead zone).
- **AoE** phases score linearly in `targets` off the Arcane **Explosion** base (392 + 0.214·SP,
  instant, GCD-bound), NOT off Arcane Blast — so an N-target AoE is N× an AE cast, and the
  double-IV-over-AoE call on KT hinges on that AE-vs-AB weighting (a modeling assumption plain-AB
  sims can't fully verify — flag it).

## 10. Determinism / tie-breaks

On genuine ties the planner prefers: completes-before-kill → anchored (pull / raid call / co-press /
buff-ending / cooldown-ready) → joins an existing press row → overlays the most other buff windows →
real expected damage → fewest floored casts → earliest. Leftover pure haste (nothing left to overlay)
goes to the **earliest** efficient (non-floored) second. This makes one setup ⇒ one exact schedule.
Caveat found this project: the tie tolerance is one full cast (`QTOL = castVal`), so a *real* sub-cast
win (e.g. the +8.5 packed KaelThas ≈ 0.6 cast in model currency) sits inside the "tie" band and can
be traded away by aesthetics — packing wins must be **defended** (window-aware eviction/veto passes).
