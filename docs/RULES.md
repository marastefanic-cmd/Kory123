# RULES.md — the theorycraft the planner encodes

Living record of the TBC Arcane cooldown rules, each with its **sim evidence** (wowsims, fixed kill,
common random numbers, high iters). The model in `index.html` is an ~0.4%-accurate proxy for these;
when model and sim disagree on a sub-cast call, **the sim wins**. Update this file when a rule is
added, refined, or overturned.

**Read every rule below as a *method*, not a law.** There is exactly one thing to maximize — the
**effective ABs cast** (`docs/MECHANICS.md §4`: each cast scored by its multiplier vs a plain AB,
summed over the fight). "Pack into Lust", "sequence haste", "put SP on fast casts", "don't open a
window in downtime" are all heuristics that *usually* maximize that number; each has cases where the
count (or the sim) says break it. Prefer the general statement; treat "always/never" as shorthand for
"almost always/never, confirm with the sim", not an invariant. Getting this framing right is what keeps
the planner **generalisable** to future gear/haste/trinkets rather than tuned to today's fights.

## 1. The scoring law: effective ABs cast

`effectiveABs = ∫ [castDamage(t)/plainAB] / interval(t) dt`. A cast's *damage* is (for Arcane Blast)
independent of AB stacks — only cast **time** and mana scale with stacks. Haste enters only through
`interval` (how many casts fit); a damage/spellpower buff raises what each cast is worth. A damage/SP
buff earns its multiplier against the base-damage **flux** flowing through its window, and flux is
higher where casts are faster — so a spellpower buff is worth more overlapping a haste window,
automatically. This single quantity is behind every rule below; they are its consequences, not axioms.

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

## 4. Buff-into-Lust packing — the usual method for maximizing effective ABs *(sim-verified this project)*

Lust is nothing special in the model — it's just a **hardcoded stretch of extra haste** the fight hands
you. Because it makes casts faster, it's *usually* the best place to concentrate the damage/SP cooldowns
(more flux → more effective ABs) and to spend haste (kept under the floor). So the common-case method:
**pack the damage buffs (Icon, gem, Arcane Power) onto the Lust window and lay the haste buffs
SEQUENTIALLY across it (IV floors the window, Berserking on the unfloored tail) so neither overcaps the
GCD floor.** This is a *consequence* of maximizing effective ABs (§1), not a law — where Lust sits, and
whether aligning to it beats spending a cooldown elsewhere (e.g. to get it back for a bigger later
window), is decided by the count/sim per fight. What matters is buff-seconds landing on the fast,
damage-buffed casts — Lust is the usual vehicle, not the objective.
- Late-Lust fights (Lust @4:20, 0 gear): pull the 3rd IV **onto** Lust @4:20 (floors the window so the
  damage cluster rides its fastest casts) **then** Berserking @4:40 on the unfloored Lust tail. Beats
  the old "Berserking-in-Lust, IV parked outside" layout by **+8.5 DPS** on the 6:00 test fight and
  **+13.9 (var0) / +5.7 (var10) DPS** on the 5:45 test fight (wowsims, 150–250k iters, seeds 11/19,
  collision-offset; both stable var0↔var10). These two plain fights are the locked packing regression.
- Swapping *which single* haste buff is in Lust is a wash (IV-in-lust-alone ≈ −0.7). The win is getting
  the **second** haste buff in too — sequentially, because a haste buff *overlapping* the already-
  floored IV window is worth exactly 0 (verified: Berserking @4:20 **on top of** IV @4:20 = wash/loss).
- **Implemented** (the search fix): a sequential window-packing move in `optimizeAsync` (runs last so
  no later pass re-floors the sequenced tail buff) assembles the packed burst at each haste raid-call —
  damage cluster on the window start, haste buffs on sequential slots (biggest-haste-first at the
  anchor, the next at anchor+dur). See `docs/ARCHITECTURE.md`.
- **Align-vs-twice breakpoint:** only pull a cooldown into Lust if it doesn't cost that cooldown its
  **second use**. If aligning would drop a use, keep the two uses instead — but *only* when the
  sim says two-unaligned > one-aligned. The packing move enforces this automatically via `sameCounts`
  (a pack that would drop a use is rejected). (Model caveat: the model ranks the fully-packed layout
  highest — a **search** problem to reach it — but mis-ranks the *partial* pack, IV-in-lust-alone,
  above "IV out"; so any packing logic must produce the FULL pack, not stop half-way.)
- **Known limitation — far-Lust with a bare window (e.g. 2:15, Lust @0:25).** When *nothing* sits on a
  late-early Lust, packing the burst onto it forces Icon's cooldown-second past the kill, so `sameCounts`
  blocks the whole move and the plan stays burst-at-pull (sim ≈ **−34 to −50 DPS** vs packed). Reaching
  it needs a *damage-use-sacrifice* pack (drop Icon's 2nd use to align the 1st onto Lust) — a more
  aggressive move than the haste-only packing above. Not yet implemented.

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

## 7. Haste-on-haste: a wash in isolation, a loss over the floor — not a synergy

Two pure-haste buffs, overlapped vs sequenced (0 gear haste). The multiplicative arithmetic is real
(`1.30 · 1.10 = 1.43`), but it buys **no extra effective ABs from the product itself** — below the
floor a pure-haste buff is *position-independent* (it banks the same fractional casts wherever it
lands, §3). **Sim-confirmed:** Berserking **inside** Lust vs **after** it (both unfloored, no damage
buffs) score an identical **2367.4 DPS** at 0 gear (var 0, 300k iters, same at mana 300k and 5M — not a
mana artifact). So overlap is a **wash**, not a hair-win.
- What overlap can *cost* is the **GCD floor:** the excess of `(h_a + h_b)` past **headroom** (the
  additive haste reaching the floor = `1.5/g − 1`, i.e. 0.5 at 0 gear) spills into the pinned 1.0s
  interval and is wasted. Lust+IV (30+20 = 50) sits exactly at headroom → the ~4% spillage exactly
  cancels the gain (still a wash). Above headroom, or with any gear haste (headroom shrinks), overlap
  **loses**. (Compare additive percentages to headroom, not the multiplicative product: Lust×IV = ×1.56
  is +56%, already over — haste never adds.)

So the reason to put haste on Lust is **flux** (speeding the *damage/SP* casts, §1/§6) or banking value
before an early kill — *not* a haste-stacking synergy, which doesn't exist. And the reason to **sequence**
two haste buffs (rather than overlap) is to keep each under the floor, not to chase a product. (A wowsims
"+37 DPS" for Lust+IV overlap at one fixed length was a boundary artifact — it vanished under randomized
kill. If a specific fight ever shows a real overlap gain, trust the sim and record it here.)

## 8. Known-kill planning + Cold Snap

- **Plan for the known kill; react live.** The continuous integral credits the final partial cast by
  its fraction, so the model accounts for the kill honestly on its own. A broad kill-time-variance
  hedge only drags the tail off its clean spot for a sub-cast gain you'd never execute, so the kill
  window is kept to a **half-cast** (smooths the exact-second boundary, doesn't distort placement).
  Reacting to an early death (pop cooldowns sooner) is the player's live job. Result: terminal bursts
  align to end **at** the kill (e.g. KT: last IV+Icon at 6:40, ending at 7:00).
- **Cold Snap** = "**once per fight, one Icy Veins ignores its cooldown**." Mechanically it resets IV's
  480s cd, but the simplest correct model is: exactly one extra IV per fight, and because there's no way
  to reset again, the *cheated* IV must be the one that skips the cooldown (schedule the cheat **before**
  the extra IV). It's the only way two IVs sit <180s apart. Burning it must beat the best
  natural-cooldown plan by ≥ ~one effective cast, else hold it; a clipped final IV (back up before the
  boss dies) is free damage and is pressed.

## 9. Intermissions & AoE

- Intermissions score **zero** (boss untargetable — no casts, no damage), but cooldowns and buff
  durations keep ticking, so the planner holds cooldowns to recover across downtime.
- **Strong default (not an invariant):** a buff window that *begins* inside an intermission usually
  wastes its early seconds, so a press whose window would start in the dead zone *usually* belongs at
  the exit or held to the next real burst — and placement/tie-break passes should be downtime-aware (a
  Cold-Snap IV after an intermission should land on the clean post-ramp burst, not 1s inside the dead
  zone). But it's a default, not a law: pressing a cooldown *earlier* (even into downtime) can win if
  that's the only way to get it **back off cooldown in time** for a bigger later window. The effective-
  AB count decides; don't hardcode "never fire in downtime".
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
