# PHASE 10 — RESUME HERE (handoff, 2026-07-26 17:51)

**Read `docs/PHASE10.md` §8 for the full execution log. This file is the 60-second version and the
exact next actions.** Delete it when the phase closes.

## 1. State right now

- **Round 1 is GATHERING.** 10 of 36 tables complete in `tools/xval-results/`, `monoDip = 0.00%` on
  every one. Tables are committed and pushed as they land by `tools/xval-checkpoint.sh`.
- **It runs unattended.** `tools/xval-round-pipeline.sh` drives class → (wait for boss pre-solves) →
  boss. Roughly **12 hours** of compute remain, dominated by the two Kael'thas tables (~29 of the
  ~38 boss CPU-hours, because a 420 s fight with 6 targets sims ~9× slower).
- **It is resumable.** `SKIP_EXISTING=1 bash tools/xval-bench-campaign.sh` re-runs only what is
  missing. ⚠ The caches (`.xval-cache/`) are gitignored and **not** durable — a reclaimed container
  re-solves and re-sims whatever was not finished, but every completed *table* survives in git.

```
bash tools/xval-status.sh          # processes · tables complete · cache size
```

## 2. ⚠ Two rules that were live while gathering

- **DO NOT TOUCH `index.html`.** The plan cache keys on its bytes, so an edit mid-round makes the
  campaign assemble a matrix from two engines. This blocks three known pieces of work (§4 below).
  Once the round is complete this rule lifts.
- **DO NOT `pkill -f` from an interactive shell** — it matches the shell issuing it, which dies while
  the target survives (PHASE10 §8.17). Do process work from a script file, e.g. `tools/xval-status.sh`.

## 3. The next actions, in order

1. **Wait for 36 tables**, then grade — the chain is validated end to end on real data:
   ```
   node tools/xval-stamp-audit.mjs tools/xval-results # RUN FIRST — is this ONE round, ONE protocol?
   node tools/xval-verify.mjs  tools/xval-results     # independent invariant recompute, exit 0/1/2
   node tools/xval-collect.mjs tools/xval-results     # ledger + width distribution + plateau breadth
   node tools/xval-persist.mjs tools/xval-results     # length-persistence prioritizer
   node tools/xval-collect.mjs tools/xval-results --json /tmp/targets.json
   node tools/ripple-audit.mjs /tmp/targets.json      # price each deficit against the ruler's own floor
   node tools/xval-band.mjs    /tmp/targets.json      # §5's grading rule: real at ≥3 seeds?
   ```
   ⚠ **36 tables or no verdict** — a partial directory is not a result.
   ⚠ **The band's SCOPE is pre-registered in §8.18** (persistence hits ∪ over-floor/INDETERMINATE
   cells; everything else counted-but-not-banded). Banding the whole ledger is 6–10 CPU-hours, so the
   selection had to be fixed *before* the widths were visible — do not re-choose it after reading them.
2. **Restate `docs/ACCEPTANCE.md`** with a gear-B status block written as a **first measurement, never
   a delta** against round 5/7 (BENCH §1 forbids the comparison). It must carry: the protocol stamp ·
   invariant A · B1-by-construction · B2's column count, distribution and CLEAN count · **plateau
   breadth** (new — see §5) · the persistence work list · the band grading · the verdict.
3. **Re-price the open debts** in gear-B terms and close any that do not reproduce: **B2**, the
   **low-haste (≤70) micro-placement slack**, the **KT/AoE cells**. (The resolution-floor criterion
   question, the missing ground truth above ~h150, and Ashtongue's exclusion are structural and carry
   over unchanged.)
4. **Then decide the next phase from the new table, not the old one.**

## 4. Blocked on `index.html` — unblocks the moment the round is done

- **§8.7's remaining half.** The page must equip the user's **actual** kit and *report* what it could
  not. ⚠ `index.html`'s UI default kit is `bloodlust/icyVeins/drums/skull/arcanePower/scb` — **Skull
  on, Icon off** — so a first-time user still presses a trinket the sim cannot see (§8.12a). And
  wowsims has **two** trinket slots against the planner's **four** on-use trinkets, so a kit naming
  three can never be fully equipped: that limit has to be shown, not hidden.
- **Stale copy in the product.** The "?" dialog and the block at `index.html:4589` still say *"no
  gear, no buffs"*, which §8.12 made false — the benchmark mage now wears isc+scb with Bloodlust
  castable.
- **PHASE9 §4 CPU reclaim** (~+18% vs pre-§5.12). Landing order is written out in PHASE9 §4.13.1;
  every step must keep plans byte-identical (exact-match 25/25 + `plan-diff` SCORE-AUDIT).

## 5. What this phase already changed, that a reader should not re-derive

- `tools/xval-bench.mjs` + `tools/xval-bench-campaign.sh` — the matrix driver §4.2 needed and did not
  have, **proven** equivalent to `tools/xval.mjs` (§8.9).
- `tools/xval-band.mjs` — §5's ≥3-seed grading rule, controlled in both directions.
- `tools/xval-collect.mjs` — now reports **plateau breadth**, which immediately showed the only CLEAN
  table in the partial round is the one emitting 2 distinct plans across 10 haste points.
- `sim/planspec.mjs` `REQUIRES_EQUIPPED` + `tools/bench.mjs --kit` — a press of an unworn trinket is a
  bit-identical **no-op** in wowsims, and that is now refused rather than silently simmed (§8.7).
- `sim/model-ref.json` — the website's benchmark mage wears its trinkets and can be Lusted. Bloodlust
  went from **exactly 0.000 to +165.5 DPS**.
- The native rig **is** buildable here in ~4 minutes (`apt-get install protobuf-compiler`, then
  BENCH §3d's recipe). §1.3's "the ceremony is gone" is true as convenience, **not** as availability.

## 6. Certification already banked (do not re-run unless something changes)

| gate | result |
|---|---|
| `tests/sim-duel.mjs` with `RUNNER` | shipped wasm **==** native runner |
| `tests/sim-request.mjs` | **9/9**, including both template-freshness checks |
| gear-B trust anchor | runner ≡ `wowsimcli` to every printed digit, reproducing BENCH §3d exactly |
| `tests/exact-match.mjs` | **25 passed, 0 failed** |
