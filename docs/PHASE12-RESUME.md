# PHASE 12 — RESUME HERE (handoff, 2026-07-27)

**Read `docs/PHASE12.md` §0 (the charter) and §6 (the evidence). This file is the 60-second state and
the exact next actions.** Delete it when the phase closes.

## 1. State right now

- **Phase 10 is CLOSED.** Round 1 is 36/36 on one protocol/one engine, graded, archived at
  `docs/archive/11-phase10-gearb-baseline.md`. `docs/ACCEPTANCE.md` carries the gear-B block.
  **Verdict: invariant A passes, B2 fails, ACCEPTANCE NOT PASSING** — but read its top banner: the
  *attribution* of that failure is void (below), even though the measurements stand.
- **No freeze is in effect.** `index.html` and the whole import closure are editable.
- **Everything is committed and pushed** to `claude/phase10-gearb-baseline-y6gx8w`. Working tree clean.

## 2. ★★★★ THE FINDING THAT REORDERED EVERYTHING

**The model disagrees with itself by more than the effect the project has been chasing.**
`robust` — which decides every ranking — is a continuous **rate integral**. The model's own
**discrete cast walk** computes the documented objective exactly (per cast: haste, stacks ⇒ cast time,
AP ×1.30, SP buffs normalized, crit constant). Measured over **2755 plan-scorings, no sim**
(`tools/self-consistency.mjs`): the two differ by a **median 0.2114 % of score, max 1.4263 %**.
The corpus's deficits are **0.004–0.380 %**; its ranking margins **~0.005–0.07 %**.

⇒ every B2 column, the persistence list, the B2 debt, and the four scorer terms falsified in §6.1–§6.3
are measurements of a quantity that is **not single-valued at their own scale**.

**And the sim's role is corrected:** with an exact objective, ranking two plans is arithmetic and
cannot be wrong — so a sim preferring a plan the tool did not emit means **the SEARCH missed it**. The
corpus is a brute-force explorer of regions the search never visits; each disagreement is a *pattern to
generalize into a rule or a seed class*. That is how the model improves.

## 3. The next actions, in order

### Step 1 — make the objective exact  ⚠ do NOT combine with step 2 in one commit
Score the tapered per-cast sum. Keep the integral only if it earns its place as a *search-smoothing*
device, never as the arbiter.
```
node tools/self-consistency.mjs        # the gate. Needs NO sim. Currently median 0.2114%; must go to ~0
node tools/blast-radius.mjs            # 136/285 = 47.7% of emitted plans change. Re-run to confirm
```
⚠ **`tools/blast-radius.mjs` and `tools/self-consistency.mjs` take `--index /tmp/index-round.html`** —
they read the round's plan cache, which keys on `sha1(index.html)`. Regenerate that blob with
`git show <a commit before the 07-27 UI fixes>:index.html > /tmp/index-round.html`, or they will die
naming the cache miss (they refuse to probe a different engine's plans).

### Step 2 — fix the press-fire offset  ✅ **DONE 2026-07-27 — see §6.9**
Transcription failures **7.14 % → 0.00 %** on real combat logs (`tools/press-headtohead.mjs`), engine
block byte-identical (`sha1 7c08324250500f61`) so no plan moved and no golden was re-recorded. The gate
that never existed is `tests/press-fire.mjs` (part A no-sim, part B skips loudly without `RUNNER`).

⛔ **§6.7's mechanism was WRONG and §6.9a retires it.** It is not "the schedule fires strictly after" —
`APLActionSchedule.IsReady` is `>=`, and a schedule 1 ns below the boundary also fires late. The sim's
boundary simply **is not where the log says**: wowsims takes **334 ms** per Arcane Blast stack where the
model takes 1/3 s, so the boundary printed as `11.00` is `10.998`, and `10.998 >= 11.000` is false.

▶ **The residual, and it is the next commit:** 26 of 196 presses still miss, none of them a
transcription defect (`HELD` = the sim's own cooldown gate on a drifted boundary; `LATTICE` = the grids
>½ interval apart). **Fix `STACK_CAST_REDUCTION: 1/3` → 334 ms.** That is a MODEL change — it moves
cast times, the lattice, plans and goldens — so it rides alone, with neither step 1 nor step 2.

### Step 3 — re-gather, then hunt search bugs
Only now is *"the search did not find the optimum"* well-posed. ⚠ `tools/deficit-fix.mjs` found
**0/4 search misses at 3× restarts** — but that was the search optimising the **integral**; re-run it.

## 4. ⚠ THE TRAP TO AVOID, stated plainly

**"The cast sum is correct" is currently supported by DERIVATION and SELF-CONSISTENCY, not by
measurement against ground truth** — because the only ground truth, the sim, is itself mis-transcribing
presses. And the change moves **47.7 %** of plans. ⇒ **do not re-record `exact-match` goldens against a
scorer whose superiority has not been demonstrated.** Fix step 2 first (or in parallel), then show the
exact scorer beats the integral on a *correct* sim, and only then re-record.

⛔ My own §6.5a conclusion — "the documented objective implemented literally is a WORSE ranker
(r 0.9279 vs 0.9721)" — is **WITHDRAWN**, void twice over (the two accounts differ by 0.21 %, and the
sim reference fires presses late). Do not cite it in either direction.

## 5. Loose ends, all resumable and none blocking

- **7 of 8 boss band columns ungraded.** `tools/xval-results/band-scope/` has the targets and a README
  with the resume command; the 1 that ran came back **REAL** (+0.348 ± 0.045, 5/5).
- **98 columns published as not-banded** — explicitly *not* passed (`band-scope/*.excluded.json`).
- **`ripple-audit` fails its own P3/P5 self-checks** (archive/11 §8.30) — no ripple decomposition is
  quotable until repaired. Note its `mono=0` stamp means FAILURE while the adjacent `vacuous=0` means
  success.
- **The unmerged UI branch** `origin/claude/webapp-optimization-brainstorm-unpipp` — merge order and
  the resolved TRINKETS-reorder analysis are in archive/11 §9.3.
- **GEAR-AGNOSTIC §3.3** is unblocked; round 1 was by decision the *last geared round*.

## 6. Instruments built this session (do not re-derive)

| tool | what it answers |
|---|---|
| `tools/self-consistency.mjs` | **the step-1 gate** — integral vs per-cast sum, no sim |
| `tools/blast-radius.mjs` | how many emitted plans a scorer change moves |
| `tools/cast-fidelity.mjs` | model cast stream vs a wowsims SIMLOG |
| `tools/drift-bisect.mjs` | isolates drift: bare stream vs per-cooldown |
| `tools/press-offset-probe.mjs` | the press-fire rule, by press position |
| `tools/deficit-fix.mjs` | search miss vs scorer mis-ranking, per column |
| `tools/tail-phase-probe.mjs` | the falsified terminal-cast term (both forms) |
| `tools/counted-vs-integrated.mjs` | ⚠ its verdict is withdrawn — see §4 |
| `tools/xval-band-scope.mjs` | §8.18's pre-registered band scope, executed |
