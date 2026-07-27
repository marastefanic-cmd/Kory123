# PHASE 10 — RESUME HERE (handoff, updated 2026-07-27 04:58)

**Read `docs/PHASE10.md` §8 for the full execution log. This file is the 60-second version and the
exact next actions.** Delete it when the phase closes.

## 1. State right now

- **Round 1 is GATHERING — 30 of 36 tables** complete in `tools/xval-results/`, 0 partial,
  `monoDip = 0.00%` on every one. Tables are committed and pushed as they land by
  `tools/xval-checkpoint.sh` (900 s cycle; a table that lands between cycles shows as untracked —
  commit it by hand after checking it carries an `XVAL-DONE` line).
- ✅ **All 30 CLASS tables are done.** What remains is **the 6 boss cells only** — the long pole,
  dominated by the Kael'thas pair (~29 of the ~38 boss CPU-hours: a 420 s fight with 6 targets sims
  ~9× slower). Derive the missing list, don't trust this line — `bash tools/xval-status.sh`.
- ✅ **The boss PRE-SOLVES are banked and survived**, so the boss phase is **sim-bound only**. The
  restarted shards report `cache=100/100`, i.e. no earlier work was lost.
- **It runs unattended, and is now protected.** `tools/xval-bench-campaign.sh` (`WHAT=boss`,
  `SKIP_EXISTING=1`, `JOBS=4`) under **`tools/xval-watchdog.sh`**, both launched with `setsid`.
- **It is resumable.** `SKIP_EXISTING=1 bash tools/xval-bench-campaign.sh` re-runs only what is
  missing. ⚠ The caches (`.xval-cache/`) are gitignored and **not** durable — a reclaimed container
  re-solves and re-sims whatever was not finished (**including those banked boss pre-solves**), but
  every completed *table* survives in git.

```
bash tools/xval-status.sh          # processes · tables complete · cache size
```

### ⚠⚠ 1a. IF YOU RELAUNCH ANYTHING, USE `setsid` — this already cost 10 hours

The round **died silently at 18:59 and was found at 04:55** (PHASE10 §8.21). Cause: `nohup … &` from
an agent shell leaves the process in the session's process group, so it dies with that shell — and it
took the **checkpoint loop** with it, so durability stopped at the same instant as the thing it
protected. Nothing noticed, because the only liveness signal was "tables are appearing", and a boss
cell legitimately takes ~an hour: **slow and stopped are the same observation from outside.**

```
setsid nohup bash tools/xval-watchdog.sh boss > /tmp/xval-watchdog.log 2>&1 < /dev/null &
```

The watchdog relaunches the campaign **and** the checkpoint loop whenever neither is running and the
round is incomplete, and logs every intervention. It is safe beside a live campaign: `run_cell`'s
writer lock makes a duplicate refuse the cell rather than truncate it (§8.10).

## 2. ⚠ Two rules that were live while gathering

- **DO NOT TOUCH `index.html`.** The plan cache keys on its bytes, so an edit mid-round makes the
  campaign assemble a matrix from two engines. This blocks three known pieces of work (§4 below).
  Once the round is complete this rule lifts.
- **DO NOT `pkill -f` from an interactive shell** — it matches the shell issuing it, which dies while
  the target survives (PHASE10 §8.17). Do process work from a script file, e.g. `tools/xval-status.sh`.

## 3. The next actions, in order

1. **Wait for 36 tables**, then grade. **The chain is now ONE command** (`tools/xval-grade.sh`, added
   07-26 — PHASE10 §8.20), which runs the six tools in order and **refuses to run anything downstream
   of a nonzero stamp audit**:
   ```
   OUT=/tmp/grade bash tools/xval-grade.sh     # exit 0 clean · 1 graded-and-failing · 2 could-not-grade
   node tools/xval-band.mjs /tmp/grade/targets.json   # §5's rule: real at ≥3 seeds? — SCOPE per §8.18
   ```
   ⚠ **36 tables or no verdict** — a partial directory is not a result, and this is *enforced* now
   rather than remembered. It has to be: on the same partial directory `xval-stamp-audit` exits 2
   naming the absent cells while **`xval-verify` exits 1 with a fully-formed
   `A holds · B FAILS → ACCEPTANCE NOT PASSING` verdict** computed over whatever subset is present.
   Never quote a B-side number that did not come through the gate.
   (The individual tools still exist and take the same args; §8.20 records why the order matters.)
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

## 3b. ⚠⚠ AN UNMERGED BRANCH IS WAITING, AND IT MOVES THE ENGINE

`origin/claude/webapp-optimization-brainstorm-unpipp` carries three commits. **One is already in**
(`2dd54e6`, PHASE 11's plan — cherry-picked 07-26 because it is docs-only: CLAUDE.md, PHASE11.md,
ROADMAP.md, no `index.html`). Git will still list it as unmerged; that is the cherry-pick's new sha,
not missing content.

**The other two are NOT in, deliberately:** `e577d08` (UI: timeline legend, toolbar sequencing,
trinkets shelved by phase) and `f9cedec` (merge: ship the in-page sim + deploy config). Together they
rewrite `index.html` by **+147/−52**, which alone would void the round — `ENGINE_ID` in
`tools/xval-bench.mjs:174` hashes the **whole file**, so every one of the ~293 cached plans
invalidates and the remaining cells re-solve against a different engine than the finished ones.

★ **And it is not only a cache-invalidation problem.** The `engine-src` block itself differs
(`acf45c8a3b55` → `be3121b02a78`, +616 bytes). Most of it is presentational — `src:` loot strings, a
new `TRINKET_TIERS` grouping — but it **reorders the flat `TRINKETS` array**:

```
["skull","ati","scb","mqg","isc"]   →   ["mqg","isc","scb","skull","ati"]
```

and iteration order can move a tie-break in the search. The incoming comment asserts the tiers are
"purely presentational … TRINKETS stays the flat key list" — true of the *contents*, silent about the
*order*. ~~**Treat that as unverified until `tests/exact-match.mjs` says 25/25.**~~

**✅ RESOLVED BY READING, 07-26 — and the prescribed gate was the WRONG ONE.** Every reference to the
bare `TRINKETS` identifier, classified by script block (engine = `index.html:783–3357`):

| line | block | use | order-sensitive? |
|---|---|---|---|
| 837 | ENGINE | the definition | — |
| 840 | ENGINE | `GROUPS[1].keys` — and `GROUPS` is read **only** at `:3451`, checkbox rendering | no (UI paint order) |
| 3408 | UI | `trinketCount()` — a `.filter().length` | no |
| 3513 | UI | `TRINKETS.includes(key)` | no |
| **5114** | **UI** | **`for (const k of TRINKETS) if (enabled[k] && ++eq > 2) enabled[k] = false`** | **YES** |

**The search never reads it.** All three ordering-sensitive engine uses (`:1001`, `:1040`, `:1345`) go
through **`OFF_TRINKETS`**, whose order the incoming diff does not touch. So the tie-break worry is
unfounded — but the *reason* it is unfounded also means the gate cannot see it:

★ **`exact-match` is BLIND to this change by construction, so 25/25 would NOT have verified the claim.**
`tests/exact-match.mjs:47` declares **its own** hardcoded `ALL_BUFFS` and builds `enabled` from
`kit.includes(k)` (`:53`); it never calls `applyState`. A green suite here is a true statement about the
engine and **no statement at all** about the reorder. Pre-registered: **25/25 is expected, and is not
evidence about TRINKETS ordering.** (Still run it — it gates the other +147/−52.)

⚠ **What the reorder DOES change, which the incoming comment does not cover.** `applyState:5114` caps a
setup at wowsims' two trinket slots, and **which two survive is first-two-in-`TRINKETS`-order**:

```
legacy save {skull, scb, mqg}   old ⇒ keeps skull+scb      new ⇒ keeps mqg+scb      ← different plan, silently
```

Reachability today is **narrow but nonzero**: no shipped preset can trigger it — `GOLDEN_DEFAULTS.kit`
names exactly two trinkets (`isc`,`scb`), and `BOSS_PRESETS` carry no `kit` — so the only live path is
`:5166`, loading a **saved setup** with ≥3 trinkets, which is precisely what `:5113`'s own comment
("*sanitize old presets*") exists for. ⚠ **PHASE11 §2's URL-shareable setups would promote this from a
legacy-localStorage corner to a routine path taking third-party input** — decide the clamp's priority
order deliberately there rather than inheriting it from a presentational regroup.

**Merge order, once the round is graded and archived:**
1. Grade + archive round 1 first. A merge before that costs the round.
2. `git merge origin/claude/webapp-optimization-brainstorm-unpipp`.
3. `cd tests && CHROMIUM=/opt/pw-browsers/chromium node exact-match.mjs` — **25/25 or investigate the
   TRINKETS ordering before anything else.** If plans moved, `plan-diff` the two engines and duel
   every changed cell (TOOLING: aggregates can hold while a cell regresses).
4. `node tools/census-build.mjs index.html /tmp/c.html` — content-anchored now, but a UI diff of this
   size is exactly what would move a probe's *subject* (PHASE11 §10.2).

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

## 5b. Added since the first handoff (07-26 evening) — do not re-derive

- **`tools/xval-grade.sh`** — §3.1's chain as one command, gate-first, `rc`-graded, controlled both
  ways (PHASE10 §8.20). Use it instead of typing the six tools.
- **The TRINKETS-reorder question in §3b is CLOSED by reading** — the search never touches `TRINKETS`,
  and, more importantly, **`exact-match` is blind to the change by construction**, so 25/25 was never
  the gate it was assigned as. The real blast radius is `applyState`'s two-slot clamp. Full table and
  reasoning in §3b above; read it before merging.

## 6. Certification already banked (do not re-run unless something changes)

| gate | result |
|---|---|
| `tests/sim-duel.mjs` with `RUNNER` | shipped wasm **==** native runner |
| `tests/sim-request.mjs` | **9/9**, including both template-freshness checks |
| gear-B trust anchor | runner ≡ `wowsimcli` to every printed digit, reproducing BENCH §3d exactly |
| `tests/exact-match.mjs` | **25 passed, 0 failed** |
