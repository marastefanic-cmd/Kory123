# RULES.md — the theorycraft the planner encodes

Living record of the TBC Arcane cooldown rules, each with the **evidence** it was checked against. The
one quantity to maximize is **effective ABs cast** (§1 / `MECHANICS §4`), which the planner computes
deterministically — so the **cast-count is the arbiter** when comparing two lines. The **sim
calibrates** that count (anchors the physics — the model is a ~0.4%-accurate proxy — covers its blind
spots: ramp / mana / AoE / multi-AP timing, and verifies novel findings); the sim evidence cited under
each rule is exactly that calibration, not a routine per-line referee. When a clean cast-count and a
sim number disagree with **no blind spot in play**, audit the sim *setup* before either — see
`docs/TOOLING.md`. Update this file when a rule is added, refined, or overturned.

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
casts**, so it should sit on the fastest part of the window.
- **The ramp is now modeled EXACTLY** (landed this project; an earlier per-cast ramp model was dropped for
  over-crediting — the difference is this one never touches the interval/count valuation). The mage opens
  **cold (0 stacks, no prestack** — a start-intermission expresses a delayed opener**)** and re-ramps after
  every AB gap ≥ 8s. The first 3 casts run at their true lengths and are scored **discretely** — each cast's
  damage lands around its **completion** (jitter-smoothed ±½ GCD so no knife-edge enters the score); the
  cast-rate integral covers everything else. Haste placement-independence is preserved *exactly* (verified
  0.0000% pre-vs-post-Lust, h0–200): haste shortens the ramp but never changes its cast count.
- **Press-snap during ramps (sim-log-verified).** A press landing mid-ramp-cast fires at that cast's real
  END — the "/cast Buff /cast AB" macro can only land on a boundary, and during a ramp the boundaries are
  SPARSE and locked to the ramp start (no phase freedom): intent 0:05 in a cold opener fires at **6.5**.
  At steady state boundaries are dense and phase-uniform, so the phase-averaged effective start is the
  press moment (unchanged). Consequence, sim-confirmed **+2.4–2.8%**: with Lust at 0:07, pressing the
  burst at **0:05** (fires 6.5) beats pressing at 0:07 (fires 8.0) — the planner now emits the earlier
  press on its own.
- **Damage buffs step off the ramp (sim-confirmed on the fixed rig).** A damage window covering slow ramp
  casts hits fewer completions, so: at an intermission exit, haste at the exit + damage delayed past the
  re-ramp = **+0.39%**; at a bare (no-Lust) pull, the cluster delayed past the IV-compressed ramp =
  **+0.10–0.17%**; and a SPLIT is optimal when window lengths differ — 20s Icon covers the whole ramp
  from 0:00 while 15s gem/AP + Berserking step to the ramp's last boundary (**+0.44%**, the Vashj-class
  opener). Haste buffs stay put (position-independent). All of this now emerges from the score — no rule
  is hardcoded.
- **Why haste is position-independent (the exact statement).** A haste buff `×h` for duration `D` saves
  `D·(h−1)` of base cast-time **wherever it sits** — whatever casts fall in the window, their total base
  cast-time is exactly what fills `D` at the hastened rate, so the ramp's slower casts don't change the
  bookkeeping. It converts to the same extra casts anywhere **below the GCD floor**. Confirmed three ways:
  the ramp-aware toy counter, and the **real sim** — IV@pull vs IV@mid = **equal** at h0/h400, and
  **IV pre-Lust ≡ IV post-Lust to 0.00%** once both are interior (100s/140s fights, `tools/explore.mjs`
  cross-check). Above the floor the pull gains only via floor headroom (its ramp casts sit further from
  the cap).
- **Sim-setup caveat (a trap, not a model gap).** In a *fixed-duration* sim, a haste buff jammed against
  the fight **end** (e.g. IV@1:00 in a strict 1:20 fight) shows a spurious ~1.4% loss vs pull, because the
  sim doesn't credit the truncated tail casts proportionally. The **model is right** to score pre≈post as
  a tie (its kill-window integral *does* credit the tail proportionally); the gap is a sim-setup artifact
  (cf. the Vashj drop bug, `docs/TOOLING.md`). Verified: extend the fight so the buff is interior → the gap
  vanishes to 0.00%. (AB damage is **stack-independent** — re-confirmed at source, `arcane_blast.go:55/58`
  — so this is pure cast-count, not a stack-damage effect.)

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
- **RESOLVED — the far-Lust "limitation" was a drop-bug-rig artifact (2:15, Lust @0:25).** The old note
  claimed packing the burst onto a far Lust beats burst-at-pull by ~34–50 DPS and the tool couldn't reach
  it. Re-examined on the FIXED rig with the exact-ramp model: the tool's **double-dip** plan (both
  Icon+gem uses — opener + terminal — IV split 0/CS-115, AP+Zerk on the opener, Lust left mostly bare)
  **beats** the one-aligned-on-Lust pack by **+0.4% var10** (and one-aligned beats naive two-icons by
  +0.1–0.2% — model and sim now agree on that ordering too, see the §7-era icon-count history in
  ROADMAP). Nothing to implement: the current optimizer emits the winning plan on its own.

## 5. Icy Veins slides out of Lust as haste gear grows *(now REALIZED in the search, sim-verified)*

At ~0 haste, IV belongs in Lust (packed, per #4). This isn't received mage-forum wisdom taken on faith —
it's **verified in this project from first principles**: brute-enumeration (`tools/explore.mjs` `iv-icon`,
h0: IV-in-Lust 65.294 > IV-pre 65.122 effective ABs) and the sim (IV@5-in-Lust beats IV@0 by +0.07% on the
1:40 opener, prestack 0), and the *reason* is the flux coupling — the damage buffs sit in Lust, and IV
flooring those casts makes each damage-buffed second worth more. As passive haste rating rises, Lust alone
approaches the floor, so Lust+IV wastes more and more — past a breakpoint (**~15 rating** in the isolated
IV+Icon case; pushed to **~80** when Arcane Power joins the Lust cluster, because the SP payout rewards
overcapping a little — RULES §16) IV is worth more **outside** Lust while the **damage cluster stays ON
Lust** (its fastest casts). No hard breakpoint to hardcode — it emerges from the floor math.
- **Realized (this session).** The sequential window-packing pass (RULES §4, ARCHITECTURE) now generates
  **exit** candidates — the damage cluster on the Lust anchor, the haste buffs sequenced/stacked **just
  past** the window (`exitSeq` / `exitStack`) — alongside the usual pack-into-the-window layout. Kept only
  on a strict robust gain, so it's inert at h0 (IV-in-Lust wins; goldens byte-identical, exact-match
  23/23) and self-selects above the breakpoint. Before this, the opener could get glued off-Lust at high
  gear haste (cluster following IV off the fast casts) — a search miss the scorer already ranked below
  cluster-on-Lust.
- **Sim-verified:** cluster-on-Lust + IV-off beats cluster-glued-off-Lust by **+61 DPS var0 / +54 var10**
  at h250 and **+53 / +55** at h200 (250k, seed 11 — both variances agree, so it's the real flux gain of
  putting the damage buffs on Lust's fast casts, not a fixed-length boundary artifact). The physics is
  anchored: rating trinkets + gear haste run the SAME `(1+rating/1577)·∏%buffs` / GCD-floor path
  trust-anchored at h0.
- **Consistent across the WHOLE gear-haste range now** (h50…h300, 4:00 fight: opener cluster on Lust at
  every level). The last hold-out — a narrow ~h200 band where the exit layout needs Cold Snap and the
  CS-materiality gate mis-vetoed it as "adds a use" — is **fixed** by measuring adds-use by **value not
  count** (§8, last bullet). No per-haste rule; it falls out of the floor math + the value-based CS gate.

## 6. Spellpower × Arcane Power is multiplicative

Icon's +155 SP is multiplied by Arcane Power's +30% — so a spellpower buff wants to land **on** the
AP window, not merely on a haste window. Real but small (KaelThas/KT: +0.3–0.9 DPS, clean across
seeds). Matters when the AP cluster is *staggered* off the pinned Lust (KT: Lust @4:20, AP @4:45) —
the spellpower buff should slide onto AP, which a pinned-only snap misses. Forward-slide only (an
already-early buff has nothing better behind it).
- **SP buffs never compete with each other.** SP is additive (`base + coef·(sp+Δ₁+Δ₂)`), so a second
  SP buff dilutes nothing — Icon+gem BOTH on the fastest window beats any split at every haste level
  (measured: both-fast 52.018 vs best split 51.662 at h0, +0.36 casts; same ordering at h150/h300).
  Concentrate every SP buff on the single highest-flux window; only cooldown spacing ever separates
  them. **Budget asterisk (user-flagged): the gem is a 3-charge resource (Mana Emerald, `trackRule`),
  Icon is only cd-limited** — per-window they still never compete, but on a long fight gem's three
  uses are a budget to spend on the three best windows while Icon can ride every 2-minute tick. The
  planner's `maxUses` handles this; when reading a plan, a "missing" gem on some window is the budget,
  not a mistake.

## 7. Haste-on-haste IS a multiplicative synergy below the floor — the floor decides when to split
*(REWRITTEN — the old "wash" version was a fixed-rig artifact; see the correction note at the end.)*

Below the GCD floor, cast rate ∝ the multiplier `m(t)`, and haste buffs MULTIPLY (`1.2 × 1.1 = 1.32`).
So a haste buff riding another is worth **the host's multiplier times** its solo value — the same flux
law that makes damage buffs want fast windows applies to haste itself. Berserking inside Icy Veins is
worth ×1.2 its outside value; inside Lust, ×1.3. Verified exactly, model AND sim (fixed rig, var10):
Zerk-in-IV beats Zerk-outside by **+0.13 casts / +0.37%**; Zerk-in-Lust beats Zerk-after-Lust by
**+0.20 casts (model +0.42%, sim +0.6%)** — the pure `10·(1.43−1.30)/1.5 − 10·0.10/1.5` arithmetic.
Stacking position is otherwise free (pull-stack ≡ interior-stack to 0.0000, §3).
- **Why model +0.42% vs sim +0.6% (user asked — decomposed exactly):** the sim runs var10, and a LATE
  buff window (Zerk@45 on a 60s fight, draws 50–70) is CLIPPED on short draws while an early one never
  is. Re-run at T=80 var10 where the @45 slot can't clip: sim = **+0.3%** = the model's fixed-kill
  number exactly (+0.2 casts / ~63; SE ≈ 0.008%, noise ruled out). So model = fixed-kill effect;
  sim-var10 adds a real "late windows carry kill-variance risk" premium the model prices only inside
  its half-cast kill window BY DESIGN (§8 — hedging a wobbly kill is the player's live call). When
  sim-gating, match the question: use fights long enough that no window clips, or expect the late-slot
  penalty on top of the model's number.

**The IV+Berserking playbook** (isolated pair, 1:00 fight, brute-enumerated over 0–789 rating —
`tools/explore.mjs iv-zerk-solo`):
- **0–215 rating: STACK.** The ×1.2 premium is free — the stacked ×1.32 stays under the floor
  (cap-touch = `(1.5/1.32 − 1)·1577 ≈ 215`).
- **215–~264: STILL STACK.** The answer to "split the moment you touch the cap?" is **no — a bit
  after**: the growing overcap waste has to eat the whole 20% premium first. Model crossover at
  1-rating resolution: **264**. Flat-world algebra says 243; the extra ~21 is the opener ramp's floor
  headroom (the slow ramp casts absorb overcap — which is also why, near the crossover, stacking **on
  the pull** beats an interior stack: Zk@0 48.669 > Zk@10 48.609 at h240).
- **~264–~700: SPREAD.** Waste exceeds premium; the spread advantage peaks ~+0.55 casts around 574
  (where solo-Berserking itself nears its cap) and shrinks after.
- **~700+: STACK ON THE PULL (academic).** Everything is floored except the three slow ramp casts —
  the last place haste still buys anything — so both buffs pile onto the opener ramp. Unreachable
  in-game; the exact-ramp model produces it automatically.
- **Sim precision (fixed rig, var10, 300k):** the sim confirms the far sides (stack +0.2% at 200,
  spread −0.2% at 320) and brackets the crossover in **[200, 290]** — the knife-edge deltas
  (<0.15%) sit at the sim's noise/quantization floor, so treat the model's 264 as **±~25**. Same for
  every crossover below: the model pins the integer, the sim certifies the band.

**The Lust+Berserking band** (same sweep with Lust pinned): premium flat at **+0.20 casts** until
cap-touch **~77** (`1.5/1.43`), then decays; crossover **~139** (sim: stack +0.6% at 60, +0.3% at
120, tie at 160, spread at 200 — model's 139 inside the sim tie-band). So Zerk rides Lust from 0 to
~139 rating — well past cap-touch.

**Rating buffs obey the same premium law** (Drums +80 rating · 30s, in-Lust vs out): a rating buff
under a multiplier is worth ×(multiplier) its solo value, and the algebra transfers exactly —
cap-touch at `242.7 − 80 ≈ 163` gear rating (measured: IN wins through 160, OUT by 200). Two RATING
buffs (Drums+Skull) have **no mutual synergy** — rating is additive — so they still each chase the
multiplier windows, never each other.

**No partial overlaps — ever.** Value is linear in overlap seconds within a regime, so the optimum is
bang-bang: fully stacked or fully spread (measured at h240: full 48.669 > any partial 48.60–48.61 >
disjoint 48.595). Never park a haste buff half-in.

**The pure-haste trio (Lust + IV + Zerk, no damage buffs) — who takes the Lust slot?**
- **0 gear: BOTH, sequentially, IV first over the opener ramp** (seqIn 50.367 > all): IV's ×1.56
  overcap is absorbed by the slow ramp casts, and Zerk's ×1.43 fits the remaining headroom. This
  re-derives §4's sequential packing from pure cast-count — no damage-buff flux needed.
- **Any real gear haste (≥~50): the SMALLER buff keeps Lust, IV exits** (zkIn wins 50–250): Zerk
  ×1.1 still fits under Lust's shrinking headroom, IV ×1.2 doesn't. **General law: fill a haste
  window with the largest haste buff that still fits under the cap.** (With damage buffs present the
  flux coupling §16 holds IV in Lust much longer — pure haste is the floor-only limit.)

**⚠ Every crossover above is the PURE-haste limit — damage/SP buffs on the stacked window STRETCH the
stack band (user-flagged; the §16 coupling from the haste side).** Stacked extra casts are PREMIUM
casts (they carry the window's damage multiplier); spread extra casts are plain. Measured (IV+Zerk
split point, 2-rating resolution): pure **264** → +Icon on the window **280** → +Icon+AP **332** →
+Icon+AP+gem **348**. So in a real burst the stack holds ~+84 rating longer than the isolated-pair
number — always read this section's crossovers as lower bounds whenever the damage cluster rides the
stacked window.
- **Sim-verified (fixed rig, var10 300k, brackets around each crossover):** sign agreement at 7/8
  points, and the coupling's monotone growth confirmed — the stack-side premium rises with the kit in
  BOTH columns (model +0.32/+0.43/+0.54/+0.56% vs sim +0.2/+0.3/+0.6/+0.7% for pure/+Icon/+AP/+gem).
  At the two extreme points (h=400/415, beyond reachable gear) the sim holds the stack even longer
  than the model (tie instead of clear spread) — the documented GCD-lattice divergence zone, erring
  in the direction that strengthens the rule.

**Why Lust+IV still sequences (§4/§5 unchanged):** Lust×IV = 1.56 is over the 1.5 cap at ZERO gear
haste — at exactly h0 the premium and the waste cancel to a wash (IV-in-Lust = IV-out = 2.67 casts,
the old §4 "swap is a wash" data point), and any gear haste tips it to a loss. So the sequencing rule
survives, but its justification changes: not "no synergy exists" but "the synergy is real and the
overcap waste beats it from rating ~0 for THIS pair." The general rule: **stack two haste buffs while
`passive × (A·B)` is under the cap plus a margin; the margin is where the smaller buff's premium
(`(A−1)` × its solo value) equals the overcap waste** — for IV×Zerk that margin is ~48 rating past
cap-touch.

**Correction note (methodology).** The old §7 claimed "a wash in isolation — not a synergy," citing
Berserking-in-Lust vs after at an identical 2367.4 DPS (var 0, 300k). Two different schedules scoring
byte-identical DPS is the signature of the `APLActionSchedule` drop bug (both Zerk presses eaten —
TOOLING), and var 0's fixed-end quantization masks sub-cast differences anyway (our re-test: var0
shows ~0%, var10 shows the real +0.6%). Yet another old-rig casualty — always cross-check var0 ↔ var10
on the patched runner.

## 8. Known-kill planning + Cold Snap

- **Plan for the known kill; react live.** The continuous integral credits the final partial cast by
  its fraction, so the model accounts for the kill honestly on its own. A broad kill-time-variance
  hedge only drags the tail off its clean spot for a sub-cast gain you'd never execute, so the kill
  window is kept to a **half-cast** (smooths the exact-second boundary, doesn't distort placement).
  Reacting to an early death (pop cooldowns sooner) is the player's live job. Result: terminal bursts
  align to end **at** the kill (e.g. KT: last IV+Icon at 6:40, ending at 7:00).
- **Where Cold Snap's extra IV goes — it chases the uncovered damage window, COUNT-first** *(mapped with
  the certified tool across T=100–340, Lust@5)*: the CS-chained IV lands on whichever damage-buff window a
  natural-180s-cadence IV cannot cover — the second Icon+gem cluster at its exact cadence tick (T=180/340:
  CS-IV@126 = Icon's 6+120), the Lust tail, or the kill-anchored terminal cluster. The one hard constraint
  ranks above flux: **never spend CS where it costs a later use** (T=260: CS at the 120-cluster would push
  the natural third IV past the kill, so CS takes the Lust tail instead and all three IVs survive). Order
  of the composition: use-count (§4 align-vs-twice) → flux (§1) → premium bands (§7).
- **Cold Snap** = "**once per fight, one Icy Veins ignores its cooldown**." Mechanically it resets IV's
  480s cd, but the simplest correct model is: exactly one extra IV per fight, and because there's no way
  to reset again, the *cheated* IV must be the one that skips the cooldown (schedule the cheat **before**
  the extra IV). It's the only way two IVs sit <180s apart. A clipped final IV (back up before the boss
  dies) is free damage and is pressed.
- **Materiality has two regimes — "adds a use" vs "just repositions" (sim-verified this project).** When
  Cold Snap lets you fit an **extra** IV (more IVs than the fight fits on natural cd), burning it must
  beat the best natural-cd plan by ≥ ~one effective cast, else hold it (the extra IV is the scarce thing
  you're spending on). But when the fight fits the **same** number of IVs either way, Cold Snap adds no
  scarce use — it only **repositions** the IVs you already have — so it's **free**, gated by nothing more
  than a sub-cast sliver. Two free-reposition wins the full-cast bar used to veto:
  - **3:20 opener (+3.6):** the natural plan triple-stacks IV+Zerk over the +50% floor at the pull
    (×1.72). Spending the free CS frees IV1 off 0:00 so the opener **sequences into Lust** — `Zerk@0:05`
    inside Lust (unfloored ×1.43), `IV@0:15` after it, `CS→IV2@3:00` — same 2-IV count as natural, but
    the haste no longer overcaps the floor (wowsims var10 2654.7 vs 2651.1, var0 +10.7, seeds 11/19).
  - **5:00 spread (+2.4):** see §11 — the free CS's IV rides the 4:05 burst while the banked IV spreads
    to its 3:05 natural tick.
- **"Adds a use" is measured by VALUE, not by IV count (this session — the high-gear-haste fix).** The two
  regimes are distinguished by *how much the extra IV is worth*, not just whether the count rose. At high
  gear haste the CS-champion can carry an **incidental** extra IV parked on the near-floored Lust window
  (worth ~0 — the window is already at the GCD floor, §5), while CS's *real* job is to slide a **different**
  IV fully OFF Lust so the damage cluster keeps Lust's fast casts. Counting IVs mis-reads that as
  "adds a use" → applies the full-cast bar → vetoes the whole layout back to the glued no-CS plan (cluster
  dragged off Lust). Fix: trim the champion to the no-CS IV count by dropping its **least-valuable** IV; if
  that costs **< one cast**, the extra IV is incidental and CS is really **repositioning** — the sub-cast
  regime — so keep it. **h200 4:00 opener:** 3-IV CS champ (476318) vs glued no-CS (475101); the extra IV
  on floored Lust is worth ~+44, so the +1173 is repositioning → keep cluster-on-Lust. **Sim-verified
  +53 DPS var0 / +55 var10** (h200, 250k) — both variances agree. Exact-match 23/23 (h0 goldens unaffected:
  there the exit layout doesn't win, so the trim never fires). This is what makes RULES §5 work at *every*
  gear-haste level, not just where the exit IV happens to land ≥180s from the terminal.

## 11. Overlap is interval CONTAINMENT, not start-coincidence (placement) *(sim-verified this project)*

Two buffs fully overlap whenever the shorter's window is **contained** in the longer's — which holds for
a whole **range** of start-seconds, not one. So many placements are **DPS-equivalent**, and the planner
must pick the **consistent** member of that equivalence class, not an arbitrary one (a consequence of the
cast-rate integral: joint value depends on window **intersection**, MECHANICS §5 pt 5). Two concrete
forms, both sim-verified:
- **Position-independent haste spreads to natural cd ticks.** A haste buff whose window overlaps **no**
  damage/SP buff is position-independent (§3): it banks the same fractional casts wherever it sits, so
  parking it late past a free natural cd tick is an arbitrary member of a tie. Slide such a **lone** use
  back onto its earliest natural tick; leave the uses that ride a damage burst pinned (moving those off
  the burst *changes* the overlap — a different quality). **5:00:** the free Cold-Snap IV banked at 4:25
  (lone, right after the 4:05 burst-IV) spreads to its **3:05 natural tick**, which re-homes the
  burst-IV assignment onto **4:05** — model tie, wowsims **+2.4** (var10 2627.5 vs 2625.1; var0 +11.6;
  seeds 11/19). The naive spreads *lose* ~8 DPS (`[5,185,205]`/`[5,185,265]` leave the 4:05 burst with
  **no** IV) — the burst must keep its IV; only the **lone** IV moves.
- **Damage/SP cluster inside a longer haste span is a tie across its containment range.** A 20s Icon over
  a 40s IV+CS→IV span scores the same wherever it starts inside it (**4:00 W4: 3:20 == 3:25**, exact sim
  tie 2693.2). Canonical member by priority: **co-press a haste anchor → natural cd tick → earliest**
  (4:00 already emits 3:25, co-pressing CS→IV+Berserking — so it's untouched). A deliberate stagger that
  sits **outside** the containment range (the KT Icon-onto-AP slide ~20s off Lust, §6) genuinely changes
  overlap and stays.

The through-line: **duration is a factor; "aligned" ≠ "same start-second."** With 3+ buffs of differing
durations the contained region shrinks to the **intersection** of the constraints, but the rule holds.

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
  - **Enforced (the `dodgeDowntime` normalizer, ARCHITECTURE).** The groom loop's downtime-slide runs
    before the Cold-Snap chain and the spread/tick normalizers, so those late passes could still leave a
    press whose window *begins* in a dead zone. A final normalizer slides any such press to the
    intermission **exit** — its dead early seconds score zero wherever it sits, so the slide is
    **model-neutral** and it reads as "press on the pull of the next phase." **4:00 multi-intermission:**
    the Cold-Snap IV at 3:47 (2s inside the [3:28–3:49] dead zone) → **3:49** (wowsims var0 exact wash
    2079.1 = 2079.1; the live window 3:49–4:00 is identical, so DPS-neutral, legibility-positive). This
    is only the "don't *begin* in the dead zone" half of the default. The other half — a press whose
    window opens right at an **exit** should dip a few seconds later onto **already-built AB stacks**
    rather than the ramp (icon@4:00 → 4:05, shifting the terminal cluster 6:00 → 6:05) — is now
    **IMPLEMENTED**: a coherent-cluster carry in the "Let the stacks build" pass (ARCHITECTURE). When
    sliding a damage/SP press off a ramp forces a later same-track use past its cooldown, it carries that
    use's whole **co-pressed damage/SP cluster** (icon+gem+AP move together; the burst's haste, e.g.
    IV@6:00, stays put — haste doesn't ramp). Without the carry `repair()` moved only the cd-bound icon
    and orphaned gem/AP — a split the kill-aware model rejects, which is why the shift never emerged. On
    the **fixed engine** (drop bug patched) Vashj emits **4:05 / 6:05** and it sim-verifies **new ≥ old**
    (245/365 vs 240/360: +0.8 var0 / +0.3 var10, stable across far seeds); only Vashj moves. (Note: the
    once-suspected "Vashj wants 3 icons because an exit icon is worth less" was the **dropped-terminal
    artifact** — the 4-icon plan's *own* 6:00 icon was deleted by the harness, not out-valued; with the
    drop fixed 4 icons beat 3. The 4-icon plan stands; the 4:05/6:05 refinement rides on top of it.)
- **AoE** phases score linearly in `targets` off the Arcane **Explosion** base (392 + 0.214·SP,
  instant, GCD-bound), NOT off Arcane Blast — so an N-target AoE is N× an AE cast. **Now sim-verified**
  (`--targets N` AE-spam, TOOLING): the constants match `arcane_explosion.go` exactly, and a 6-target AE
  cast sims ~**2.25×** an AB cast — so **double-IV-over-AoE (KT)** is real, not an assumption (IV adds
  ~+20% casts to a window worth ~2.25×, a landslide vs the same IV on single-target). **Super-linearity —
  now modeled.** AoE is super-linear in the sim (**+8.6% per-target at 6 tgt, crit 38%**, falling as crit
  rises). A talent-isolation run pins the cause: it's **entirely Clearcasting → Arcane Potency** (zero the
  talents and it vanishes; gear on-crit SP procs add ~0). Arcane Concentration procs **per hit**, so more
  targets ⇒ more Clearcasting ⇒ Potency's +30% crit lands on more casts. This is always-present and
  gear-agnostic (crit × N × talent ranks), so the planner credits it via `aoeCritAmp(N,crit)` on the AoE
  damage only (ARCHITECTURE / `index.html` `TALENTS`) — ~75–80% of the measured effect, conservative,
  single-target untouched. Crit thus **no longer fully cancels for AoE** (MECHANICS §4). Gear on-crit SP
  procs stay unmodeled (negligible + transient).

## 10. Determinism / tie-breaks

On genuine ties the planner prefers: completes-before-kill → anchored (pull / raid call / co-press /
buff-ending / cooldown-ready) → joins an existing press row → overlays the most other buff windows →
real expected damage → fewest floored casts → earliest. Leftover pure haste (nothing left to overlay)
goes to the **earliest** efficient (non-floored) second. This makes one setup ⇒ one exact schedule.
Caveat found this project: the tie tolerance is one full cast (`QTOL = castVal`), so a *real* sub-cast
win (e.g. the +8.5 packed KaelThas ≈ 0.6 cast in model currency) sits inside the "tie" band and can
be traded away by aesthetics — packing wins must be **defended** (window-aware eviction/veto passes).

**`slideEarliest` — earliest-possible canonicalization (this project, user-directed).** The search + align
passes could leave a press (or a whole co-pressed burst) LATER than the earliest spot that scores the same
— the opener Icon/AP/Berserking cluster sitting 10s into Lust when the pull ties, a Cold-Snap Icy Veins
parked mid-fight when it ties all the way back to where it first fits. A final normalizer pulls each mobile
press **second** (co-pressed rows move together, and *only* when **every** member can follow — a cd-bound
Cold-Snap IV that can't move keeps its burst intact, no split) as early as it still ties within a hair
(`robust ≥ r0 − 0.5`, sameCounts, no worse clip). Purely model-neutral → the effective-AB count is
unchanged; it just makes the plan "press it at the first moment it's as good." **Gated OFF for
intermission fights:** after a downtime gap the stacks rebuild, so a press pulled to the exit lands on the
RAMP, which the steady-state scorer (§3, the damage integral uses `MAX_STACKS`) calls a tie but the sim
does **not** — Vashj's 4:05/6:05 ramp-aware layout is sim-verified over 4:00/6:00, so those are left to the
ramp-aware search + `dodgeDowntime`. In a plain fight the only ramp is the pull, which is negligible
(§ MECHANICS, ~0 casts) and where pressing everything together is exactly what's wanted. Runs before
`dodgeDowntime`. Moved 7 plain goldens earlier (model-neutral; DPS identical, timings earlier).

## 12. Mana & the conserve rotation — the real gearing weights *(sim-computed this project)*

The planner is **infinite-mana / layout-first** by design (§ nothing here changes that — mana never feeds
back into the layout optimizer). But real Arcane play is **mana-bound**: pure AB-spam OOMs hard (420s,
real mana: **945 DPS** vs 2264 infinite). So you **conserve** — AB-spam the burn windows (Lust/cooldowns),
**Frostbolt filler** below a mana threshold, Evocate in the deep — spending the budget *to the margin*.
This is a separate sim **reading** (`tools/genconserve.mjs` + `tests/ep-finite.mjs`), not a tool feature;
it exists to get the **gearing** stat weights the infinite-mana layout EP can't see (`docs/EP.md`).
- **Value of mana ≈ 2.2 dmg/mana** at the conserve margin (the AB-over-Frostbolt substitution: Frostbolt
  is coef 0.814, cost 272, ≈ mana-neutral with JoW+regen, so it fills gaps almost for free). This makes
  the regen stats real: **MP5 ≈ 0.66, Spirit ≈ 0.54** EP (Spirit lifted by Innervate's 5×), while the raw
  **mana pool ≈ 0** (the reservoir cycles; it only scales Mana-Tide/Evocation).
- **Haste is NOT the weak stat for a conserving mage.** The "haste ≈ 0.4–0.6, mana kills it" folklore is
  the **OOM-then-idle** rotation (pure-spam haste EP **0.03**). Because Frostbolt keeps the mage casting,
  haste stays **≈ 0.96** at real mana (vs 1.44 infinite) — it deflates by only ⅓. Cross-validated: the
  conserve rotation and the export's **own native wowsims rotation agree** (0.96 vs 1.00). In **absolute**
  DPS/rating haste is highest on **short** fights (time-limited) — the EP *ratio* only inverts because SP
  scales even harder there. Intermissions push haste down (less casting) and regen up (bank-and-burst).
- **Intellect ≈ co-#1 with SP** (finite ≈ 1.08): throughput (`0.29·SP_EP + 0.317·crit_EP`, Mind Mastery +
  int→crit, validated at infinite mana = 0.56) **plus** its mana value (int→pool + `√int` spirit regen).
- **Real-gearing order: SP ≈ Int > Haste > Crit > MP5 > Spirit ≫ Mana.** Full derivation, the infinite-vs-
  finite table, the analytic cross-check, and the mana-economy the sim models (JoW / Mana Tide / Innervate
  / Vampiric-Touch +250 mp5 / Evocation / gem — **all from wowsims on the real export**, not reimplemented)
  are in `docs/EP.md` + `docs/TOOLING.md`; locked numbers in `tests/finite-weights.json`. **A schedule-only
  conserve APL must include `autocastOtherCooldowns`** or it silently drops Innervate + Mana Tide (−6% DPS,
  starved weights) — see TOOLING ★.

## 13. Raid-haste externals: Drums & Power Infusion *(model sim-source-verified this project)*

The raid-controlled haste calls the mage plans **around** (pinnable; RAID_PINNABLE). Both are haste, both
ride damage bursts for flux (§4/§6), both obey the GCD floor (§2) — but they enter the haste product
differently, and that difference is **source-verified against wowsims**, not assumed:
- **Drums of Battle = +80 haste RATING, 30s, 2-min Tinnitus.** Rating, so it's **additive** into the same
  `(1 + rating/1577)` pool as gear/MQG/Skull — the exact path trust-anchored at h0 (ROADMAP gear-haste).
  It **stacks with everything**. Tinnitus = its own 120s `cd` (spacing enforced by `repair`/`sepFilter`).
- **Power Infusion = ×1.20 haste MULT, 15s — does NOT stack with Bloodlust (BL wins while both up).**
  This is real TBC, confirmed in the wowsims source: BL (`multiplyCastSpeedEffect 1.3`) and PI
  (`multiplyCastSpeedEffect 1.2`) both register in the **same `"MultiplyCastSpeed"` ExclusiveCategory**;
  within a category only the **highest-priority** effect is active (`sim/core/exclusive_effect.go`), so PI
  (1.2) is suppressed whenever BL (1.3) is up and takes over the instant BL ends. **Icy Veins is different**
  — it uses `.AttachMultiplyCastSpeed(1.2)` (a *direct* multiplier, not the exclusive wrapper), so IV
  **does** stack with BL. The model matches exactly: `if (piActive && !blActive) mult *= 1.20`
  (`simulate` ~746/821), IV/Berserking multiply unconditionally. Verified instant-by-instant (PI ⊂ BL adds
  **0**; PI partly past BL gains only the non-overlap tail).
  - **Placement corollaries (enumerated):** PI fully inside Lust loses its ENTIRE value (measured: 2.0
    casts — it is dead, not merely non-stacking), so PI always dodges Lust outright. And PI obeys the §7
    premium law with IV: PI×IV = ×1.44, cap-touch at **~66** rating, stack until **~135**, separate after
    — the same band structure as every other haste pair.
- **Placement is the planner's** (unpinned Drums/PI are scheduled like any cooldown). Confirmed optimal, not
  just legal: at the opener PI@0 rides the AP burst even though its 180cd forces it to overlap BL for a few
  seconds (dropping it loses ~1.6k; the overlap is intrinsic to also catching the next AP burst); when the
  cd allows, PI lands **just after** BL (5:00 case: PI@0:45). Drums rides bursts for flux even when
  near-floored (beats a bare-window Drums), and sequences off the floor at high gear haste. Locked as
  exact-match cases **"3:20 lust 0:05 drums"** and **"3:20 lust 0:05 PI"**. No blind spot is in play on a
  plain single-target fight, so the model's cast-count is the arbiter (MECHANICS §3) — a fresh end-to-end
  APL sim wasn't required to certify these (the physics is anchored by the rating trust-anchor + the PI
  source read above).

## 14. Ashtongue Talisman → leeway zones (passive proc; depict the freedom, don't schedule it) *(decided this project)*

The Ashtongue Talisman of Insight (145 haste rating, 5s, ~50% on a spell crit) is modeled as **steady-state
proc-uptime folded into every window's haste** (`simulate` `atiOn`, ~662) — real DPS, in the effective-AB
count and setup comparison. It is **not** given a scheduled press: the scorer averages the proc into a
constant haste bump, so there is nothing to align a press *against* in the model, and you can't pool a proc.
Excluding it from *scoring* was also rejected (biases the effective-AB count + every setup comparison by a
real, always-present contribution).

**What the tool surfaces instead is LEEWAY (user-directed).** Many presses are *freely movable across an
interval for the same effective-AB result* — the position-independent ones (§3): a lone haste/utility press
bounded only by its own cooldown feeding a later use, not riding a damage burst. For those, the timeline
draws a **dotted band over the movable interval — "press anywhere here"** (`leewayZones`, ARCHITECTURE;
computed by scanning the press across its feasible range and taking the maximal contiguous sub-interval whose
robust score ties the champion within `QTOL`). **No proc verdict is computed:** aligning such a press with a
live Ashtongue proc (or any moment the player likes) inside the band is **never anti-synergous** — every
position in the band already scores identically, so overlapping a proc is at worst neutral (a floored proc is
wasted, not a loss) and at best free upside. So the honest, minimal depiction is the band itself. **Narrow /
sub-cast ties are NOT drawn** — moving those costs a later alignment or a whole use (§10 is a *tie-break*, not
free leeway). This is the useful, general form of the user's "some timings have leeway" idea (react to adds,
dodges, or a proc), and it feeds the action-plan **Flexible/earliest** reasoning tag (§ ROADMAP task 6).

**The haste trend does NOT average the proc in (user-directed).** Because the proc is random, the timeline
curve and the schedule's peak-haste / AB-cast / at-GCD-floor readouts use the **deterministic** haste (gear +
on-use buffs only — `multNoAti`/`capDn`/`castDn` off the cast list, display-only; scoring is unchanged). ATI
shows only via its own uptime lane and a **second GCD-floor line, "cap if Ashtongue"** (§15). It stays folded
into the *scored* effective-AB count exactly as before — this is a display change, not a scoring one.

## 15. Haste breakpoints — the GCD floor and the Frostbolt filler soft cap *(marked on the timeline)*

Haste levels the timeline marks as horizontal reference lines on the (deterministic) haste curve
(informational — none change the score):
- **AB GCD floor = +50% haste** (the orange "GCD cap" line). A 3-stack Arcane Blast is a 1.5s cast; at
  ×1.5 haste it hits the 1.0s GCD floor, so **above +50% extra haste buys no more AB casts** during that
  window (it only helps by riding a damage buff for flux, or below the floor). This is why a haste buff
  stacked onto an already-floored window is worth ~0 (§2, §5, §7).
- **GCD cap if Ashtongue aligns = +50% − 145/15.77 ≈ +40.8%** (the "cap if Ashtongue" line, only when ATI is
  enabled). A live 145-rating proc adds ≈+9.2% haste, so 3-stack AB reaches the 1.0s floor at that much lower
  *base* (deterministic) haste. Between this line and the +50% cap you are floored **only while a proc is
  up**; above +50%, always. Since the curve is now proc-free (§14), this line is how the proc's cap effect is
  shown without smearing its average into the trend.
- **Frostbolt filler soft cap = +25% *passive* haste** (the cyan "4× FB" line, ≈**394 gear rating** =
  25 × 15.77). With Improved Frostbolt 5/5 a Frostbolt is a 2.5s cast; at +25% it casts in **2.0s**, so
  **four Frostbolts exactly fill the 8s Arcane Blast debuff** — the conserve-filler cadence goes from 3
  Frostbolts to 4 between AB refreshes (Arcane's well-known passive-haste soft cap; verified vs Icy-Veins /
  general TBC theory and SOURCES' Frostbolt row). Read your **trough** (no-cooldown, gear-only) haste
  against this line: above it, your filler is a Frostbolt tighter. The planner never casts Frostbolt — this
  is a gearing/conserve reference, consistent with the layout-first, mana-out-of-the-model design.

## 16. Placement structure & the GCD-cap thresholds *(exploration harness, `tools/explore.mjs`)*

`tools/explore.mjs` brute-scores **every** placement of a tiny buff set over a gear-haste sweep (no search
— the winner is exact by construction) and reports where the winning layout flips. Run it to *see* the
rules of §3/§5/§7 fall out, and to flag which winners lean on the ramp-blind assumption (`--sim` cross-checks
those). What it confirms:
- **The decomposition (structure, not a clean separation).** Damage buffs (Icon, AP, gem) have **no haste
  breakpoint** — they always chase the highest-cast-rate window. **Haste buffs carry all the breakpoints**
  (floor-avoidance: leave Lust once stacking overcaps). Verified: in `iv-icon`, Icon is ALWAYS in-Lust
  across the whole sweep; only IV flips.
- **⚠ But SP buffs SHIFT the haste breakpoints — the decomposition is coupled, not independent.** A haste
  buff can be worth **overcapping a little** if doing so speeds an SP/damage buff's window enough that the
  SP payout beats the wasted haste. Measured: adding Arcane Power in-Lust pushed IV's exit-Lust breakpoint
  from **~15 → ~80 rating** (`iv-icon` vs `iv-icon-ap`). So "place haste first, damage greedy after" is a
  *heuristic*, not a proof — the haste placement must account for the SP payout it enables. This coupling is
  the crux of what makes the search (Phase 4·C) non-trivial.
- **The GCD-cap thresholds** (cap = +50% haste, 15.77 rating/%), the meaningful sweep points:
  - **243 rating** — Lust alone caps (`passive·1.30 ≥ 1.50`). Beyond here IV *must* leave Lust (in-Lust IV is
    100% wasted). The actual exit breakpoint is **far earlier** (~15 on the reference gear); 243 is the latest
    it can possibly be.
  - **394 rating** — the IV *window* also caps (`passive·1.20 ≥ 1.50`). Icon becomes **indifferent between the
    Lust window and the IV window** (both capped) — but **not outside both**. IV *outside* Lust still gains
    (it lifts a bare window to the cap); IV is only wasted *inside* Lust. (Also the Frostbolt 4× soft cap, §15.)
  - **789 rating** — passive alone caps (`passive ≥ 1.50`). Everything is floored; all placement is irrelevant
    beyond "use Icon at all." **Sweeping past 789 is useless** — the harness caps there.

**The layout morphology across haste** *(user-predicted, brute-force-mapped: T=80, Lust@20, six tracks,
staged exhaustive enumeration per haste point; the tool matched the brute optimum at 9/10 points — the
one gap, h40 −0.033 casts, sits on a plateau edge inside the designed 0.15 pressability slack)*:
- **h0–40: the classic pack.** CS-IV floors Lust's first half, the damage cluster rides it, Zerk
  sequences onto the tail. IV starts straddling out at ~40.
- **~80: IV fully exits** (brackets Lust: pre [0,20] + post [60,80]) and **Berserking carries the Lust
  burst window** with the cluster — the user's predicted first transition.
- **~160–200: the PORTABLE BURST WINDOW** (the unpredicted one). Once `IV×Zerk×passive` (~1.45) rivals
  Lust alone (~1.43), the self-buffs manufacture their own fast window OUTSIDE Lust and the whole damage
  cluster rides it — the fight is fast from 0:10 to 1:00 instead of only inside Lust. Zerk∩Lust = 0: the
  user's predicted second transition, except the damage leaves with it.
- **≥243 (Lust self-floors): the cluster returns to Lust** (it needs no help anymore — pure flux), Zerk
  retires to the pull ramp (the last uncapped casts), IV keeps bracketing. Every step is the same three
  laws composing: flux, the §7 premium bands, floor-avoidance.

## 17. Shared trinket lockout: SP trinket first, haste trinket second — until the haste trinket exits

Skull of Gul'dan (+175 rating, 20s) and Icon (+155 SP, 20s) share the on-use lockout (`OFF_TRINKETS`):
using one locks the other for the buff's duration, forcing a SEQUENCE on any burst. Enumerated over
gear haste (Lust@0 40s + IV@0, T=60):
- **0–~100 rating: Icon first, Skull second** — the SP trinket takes the FLOORED first half (flux, §1:
  its value scales with cast rate, and haste on an already-floored window would be wasted anyway), the
  haste trinket takes the unfloored second half where its rating still buys casts. The lockout's forced
  ordering happens to be exactly what the physics wants.
- **~100–150: Skull exits Lust** (its +175 rating overcaps Lust's headroom — cap-touch at `242.7 − 175
  ≈ 68` gear rating plus the §7 premium margin) → Icon on Lust, Skull post-Lust.
- **≥~200: Icon drifts to the later Lust half** (both halves near-floored; margins are hair-thin ties).
The general form: **the SP trinket always owns the fastest window; the haste trinket claims the best
window it doesn't overcap, sliding out of Lust as gear grows** — §5's IV rule replayed through a lockout.
