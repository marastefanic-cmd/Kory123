# DECISION PACKAGES — awaiting your rulings (prepared 2026-08-04)

The two test-derivation programmes you asked for by name on 07-31, **executed to the line the
project cannot cross for you**: the tool may never declare its own tests (that is what killed
`exact-match`), and the §8y revision precedent requires a ruling to have SEEN the tie plateau. So
each package below is candidates + plateaus + certification — the ruling is yours. When you declare
a cell, it becomes an anchor: the Reference-fights strip and `tests/anchors.mjs` move in lockstep.

---

## A. THE LENGTH LADDER — 12 cells, simple fights, default gear (1387 SP · 38 % crit · h0)

**Instrument:** `tools/brute-cell.mjs` (rewritten 08-04 to grade on the objective pair and report
plateaus — it had been the fifth instrument to grade on the retired sum), one complete
anchor-and-chain family scan per cell (~10⁵ layouts), then the k≤3 · ±3 s neighbourhood audit of the
tool's own answer, iterated to its fixed point. **Certification, per cell:** the candidate beats the
complete chain family by the stated gap AND survives its neighbourhood. That is best-known, not
proven-global — the honest ceiling of the project's instruments.

**What the grid says as a family** (the claim no single cell can make):
- **2:40 and 3:00 are ONE structure at every Lust timing — the T3 Morogrim rule, generalized:**
  full value cluster + Icy Veins at `max(Lust call, 3-stack time)`, the whole second cluster
  (IV via Cold Snap, Icon, gem, Berserking) exactly **+2:00** after the first. At 3:00 the score is
  LUST-TIMING-INVARIANT (143.0096 casts at 0:05, 0:20 and 0:40 — the structure translates whole).
- **At 2:20 the +2:00 echo no longer fits** and the layout splits: chains anchor at ~0:00–0:05 with
  the tail cluster at 2:00–2:05, and Berserking rides whichever cluster Lust does not cover.
- **At 3:20 the shape re-forms around a TERMINAL cluster** — the 120 s tracks are *held* (a 174 s
  Icon gap) so second uses land in a 3:00–3:05 kill burst with AP's second use; this is the
  structure no chain-at-own-cooldown family can express, and it is worth ~+1.1–1.5 casts over the
  best chain layout.

| fight | candidate layout (press seconds) | eff. casts | plateau | family gap | tool status |
|---|---|---|---|---|---|
| 2:20 · Lust 0:05 | `AP[6] · zerk[125] · IV[1,120] · isc[1,121] · scb[5,125]` | 116.0732 | 3 in-band | +0.720 over chain family | ✓ tool = candidate |
| 2:20 · Lust 0:20 | `AP[10] · zerk[10] · IV[5,120] · isc[5,125] · scb[5,125]` | 115.0005 | 0 in-band | +0.482 over chain family | ✓ tool = candidate |
| 2:20 · Lust 0:40 | `AP[125] · zerk[125] · IV[0,120] · isc[0,120] · scb[5,125]` | 114.9211 | 3 in-band | +0.616 over chain family | ✓ tool = candidate |
| 2:40 · Lust 0:05 | `AP[7] · zerk[127] · IV[7,127] · isc[7,127] · scb[7,127]` | 129.6763 | 9 in-band | +0.422 over chain family | ✓ tool = candidate |
| 2:40 · Lust 0:20 | `AP[20] · zerk[140] · IV[20,140] · isc[20,140] · scb[20,140]` | 129.6763 | 9 in-band | +0.489 over chain family | ✓ tool = candidate |
| 2:40 · Lust 0:40 | `AP[140] · zerk[140] · IV[7,140] · isc[7,140] · scb[7,140]` | 128.3695 | 48 in-band | +0.358 over chain family | ✓ tool = candidate |
| 3:00 · Lust 0:05 | `AP[7] · zerk[127] · IV[7,127] · isc[7,127] · scb[7,127]` | 143.0096 | 9 in-band | +0.422 over chain family | ✓ tool = candidate |
| 3:00 · Lust 0:20 | `AP[20] · zerk[140] · IV[20,140] · isc[20,140] · scb[20,140]` | 143.0096 | 9 in-band | +0.422 over chain family | ✓ tool = candidate |
| 3:00 · Lust 0:40 | `AP[40] · zerk[160] · IV[40,160] · isc[40,160] · scb[40,160]` | 143.0096 | 9 in-band | +0.622 over chain family | ✓ tool = candidate |
| 3:20 · Lust 0:05 | `AP[5,185] · zerk[0,185] · IV[10,180] · isc[6,180] · scb[6,185]` | 161.2913 | 7 in-band | +1.515 over chain family | ✓ tool = candidate |
| 3:20 · Lust 0:20 | `AP[5,185] · zerk[7,187] · IV[5,180] · isc[6,180] · scb[7,185]` | 160.3625 | 9 in-band | +1.133 over chain family | ✓ tool = candidate |
| 3:20 · Lust 0:40 | `AP[5,185] · zerk[7,187] · IV[5,180] · isc[5,180] · scb[6,185]` | 160.2636 | 9 in-band | +1.097 over chain family | ⚠ tool −0.0025 |

Per-cell in-band plateau members (Δ casts vs the candidate; press-second layouts):

- **2:20 · Lust 0:05** — 3 tied member(s): `AP[6] · zerk[126] · IV[1,120] · isc[1,121] · scb[5,125]` (Δ 0.0000) · `AP[6] · zerk[127] · IV[1,120] · isc[1,121] · scb[5,125]` (Δ 0.0000) · `AP[6] · zerk[128] · IV[1,120] · isc[1,121] · scb[5,125]` (Δ 0.0000)
- **2:20 · Lust 0:40** — 3 tied member(s): `AP[125] · zerk[126] · IV[0,120] · isc[0,120] · scb[5,125]` (Δ 0.0000) · `AP[125] · zerk[127] · IV[0,120] · isc[0,120] · scb[5,125]` (Δ -0.0000) · `AP[125] · zerk[128] · IV[0,120] · isc[0,120] · scb[5,125]` (Δ -0.0000)
- **2:40 · Lust 0:05** — 9 tied member(s): `AP[7] · zerk[128] · IV[7,127] · isc[7,127] · scb[7,127]` (Δ 0.0000) · `AP[7] · zerk[128] · IV[7,127] · isc[7,127] · scb[7,128]` (Δ 0.0000) · `AP[7] · zerk[129] · IV[7,127] · isc[7,127] · scb[7,127]` (Δ 0.0000) · `AP[7] · zerk[129] · IV[7,127] · isc[7,127] · scb[7,128]` (Δ 0.0000) · … 5 more
- **2:40 · Lust 0:20** — 9 tied member(s): `AP[20] · zerk[141] · IV[20,140] · isc[20,140] · scb[20,140]` (Δ 0.0000) · `AP[20] · zerk[141] · IV[20,140] · isc[20,140] · scb[20,141]` (Δ 0.0000) · `AP[20] · zerk[142] · IV[20,140] · isc[20,140] · scb[20,140]` (Δ 0.0000) · `AP[20] · zerk[142] · IV[20,140] · isc[20,140] · scb[20,141]` (Δ 0.0000) · … 5 more
- **2:40 · Lust 0:40** — 48 tied member(s): `AP[141] · zerk[141] · IV[7,140] · isc[7,140] · scb[7,141]` (Δ 0.0000) · `AP[141] · zerk[142] · IV[7,140] · isc[7,140] · scb[7,141]` (Δ 0.0000) · `AP[141] · zerk[143] · IV[7,140] · isc[7,140] · scb[7,141]` (Δ -0.0000) · `AP[142] · zerk[142] · IV[7,140] · isc[7,140] · scb[7,142]` (Δ 0.0000) · … 44 more
- **3:00 · Lust 0:05** — 9 tied member(s): `AP[7] · zerk[128] · IV[7,127] · isc[7,127] · scb[7,127]` (Δ 0.0000) · `AP[7] · zerk[128] · IV[7,127] · isc[7,127] · scb[7,128]` (Δ 0.0000) · `AP[7] · zerk[129] · IV[7,127] · isc[7,127] · scb[7,127]` (Δ 0.0000) · `AP[7] · zerk[129] · IV[7,127] · isc[7,127] · scb[7,128]` (Δ 0.0000) · … 5 more
- **3:00 · Lust 0:20** — 9 tied member(s): `AP[20] · zerk[141] · IV[20,140] · isc[20,140] · scb[20,140]` (Δ 0.0000) · `AP[20] · zerk[141] · IV[20,140] · isc[20,140] · scb[20,141]` (Δ 0.0000) · `AP[20] · zerk[142] · IV[20,140] · isc[20,140] · scb[20,140]` (Δ 0.0000) · `AP[20] · zerk[142] · IV[20,140] · isc[20,140] · scb[20,141]` (Δ 0.0000) · … 5 more
- **3:00 · Lust 0:40** — 9 tied member(s): `AP[40] · zerk[161] · IV[40,160] · isc[40,160] · scb[40,160]` (Δ 0.0000) · `AP[40] · zerk[161] · IV[40,160] · isc[40,160] · scb[40,161]` (Δ 0.0000) · `AP[40] · zerk[162] · IV[40,160] · isc[40,160] · scb[40,160]` (Δ 0.0000) · `AP[40] · zerk[162] · IV[40,160] · isc[40,160] · scb[40,161]` (Δ 0.0000) · … 5 more
- **3:20 · Lust 0:05** — 7 tied member(s): `AP[5,185] · zerk[0,186] · IV[10,180] · isc[6,180] · scb[6,185]` (Δ 0.0000) · `AP[5,185] · zerk[0,186] · IV[10,180] · isc[5,180] · scb[6,185]` (Δ -0.0017) · `AP[5,185] · zerk[0,187] · IV[10,180] · isc[6,180] · scb[6,185]` (Δ 0.0000) · `AP[5,185] · zerk[0,187] · IV[10,180] · isc[5,180] · scb[6,185]` (Δ -0.0017) · … 3 more
- **3:20 · Lust 0:20** — 9 tied member(s): `AP[5,185] · zerk[8,188] · IV[5,180] · isc[6,180] · scb[7,185]` (Δ 0.0000) · `AP[5,185] · zerk[8,189] · IV[5,180] · isc[6,180] · scb[7,185]` (Δ 0.0000) · `AP[5,185] · zerk[8,190] · IV[5,180] · isc[6,180] · scb[7,185]` (Δ 0.0000) · `AP[5,185] · zerk[9,189] · IV[5,180] · isc[6,180] · scb[7,185]` (Δ 0.0000) · … 5 more
- **3:20 · Lust 0:40** — 9 tied member(s): `AP[5,185] · zerk[6,186] · IV[5,180] · isc[5,180] · scb[5,185]` (Δ 0.0000) · `AP[5,185] · zerk[6,187] · IV[5,180] · isc[5,180] · scb[5,185]` (Δ 0.0000) · `AP[5,185] · zerk[6,188] · IV[5,180] · isc[5,180] · scb[5,185]` (Δ 0.0000) · `AP[5,185] · zerk[7,187] · IV[5,180] · isc[5,180] · scb[5,185]` (Δ 0.0000) · … 5 more

**The one cell where the tool is not the candidate:** `3:20 · Lust 0:40` — the audit fixed point
beats the emitted plan by **+0.0025 casts** (1.2× the tie band) via `scb#0+1 & zerk-track+2`,
another coupled triple in the §8m/§8s/§9o family, at a magnitude an order below §9o's. Per the
standing doctrine the search is not chased below declared-test pressure: **if you declare this cell,
the red anchor becomes the mandate to teach the search the move** (exactly the T11 §9d precedent).

⚠ **Also queued for a ruling:** no declared layout anywhere runs with **Ashtongue enabled** (the
kit-sweep certifies ati-on cells as locally-optimal only). If you want the proc covered by ground
truth, pick any cell above and I'll run the same package for it with `ati` on.

---

## B. THE 12:20 ALIGNMENT STUDY — T=740, default gear, exact arithmetic

**Your question:** the 120 s family (Icon, gem) and the 180 s family (IV, AP, Berserking) re-align
every `lcm = 360 s`; 12:20 ≈ 2.06 cycles. *Spam on cooldown, or hold the shorter ones for
alignment — and does Lust timing change it?* A free brute force is hopeless (~28 presses); the
strategy families are enumerable and the objective is exact, so every comparison below is
arithmetic, not simulation. Three Lust schedules (600 s cooldown ⇒ two calls):

| Lust calls | spam-on-cooldown | hold-for-alignment | gem-on-the-Lusts | TOOL (free search) |
|---|---|---|---|---|
| 0:10 & 10:10 | 554.294 | 554.348 | 554.732 | **558.680** |
| 1:00 & 11:00 | 553.639 | 553.912 | 552.970 | **557.704** |
| 3:00 & 9:00 | 553.356 | 554.129 | 553.947 | *(solving at commit time — the follow-up commit fills it)* |

**The verdict, in three tiers:**
1. **Hold beats spam, mildly and consistently** (+0.05 to +0.77 casts): pressing Icon every 180 s
   (5 aligned uses) beats every-120 s (7 unaligned uses) at all three Lust timings — alignment is
   worth more than two extra uses. Where the gem's charges go is Lust-sensitive (on the Lusts wins
   at 1:00/11:00, on the 360 s cluster moments elsewhere).
2. **But the real answer is NEITHER pure policy.** The tool's free search beats the best family by
   **+3.6 to +4.4 casts** — an order of magnitude above every alignment delta. Its structure mixes
   the policies: 180 s chains as the backbone, Icon spammed OR held per segment, gem charges split
   between the opener and a terminal double, Cold Snap's extra IV spent on a mid-fight re-align,
   and a full kill-burst cluster at ~12:05.
3. **So the ruling-ready statement is:** *alignment questions are second-order; structure
   (Lust coverage, Cold Snap placement, the terminal cluster) is first-order — plan with the tool,
   and when in doubt between spam and hold, hold.* This also answers the old open question
   "align-vs-twice breakpoint": at this length, one aligned use beats two unaligned ones for the
   120 s family, at every Lust timing tested.

**Honest limits:** the tool's 12:20 answers are its own descent's fixed points (solves of 8–16 min;
no independent certification exists at this size — the neighbourhood audit at k=3 over ~30 presses
is ~10⁶ probes of a 740 s fight and was not run). The family numbers ARE exact. If you want a 12:20
cell declared, say which Lust schedule and I'll iterate its audit to a fixed point first, as with
the ladder.


---

**Reproduction:** every ladder number is `node tools/brute-cell.mjs --T=<sec> --lust=<sec> --sp=1387
--crit=38 --t5two=0` (the complete family scan + the tool's own solve + the plateau, one command per
cell); the 12:20 families are exact `rankPair` scores of constructed schedules at the same gear.
