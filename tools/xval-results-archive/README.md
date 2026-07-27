# `xval-results-archive/` — the round index

`tools/xval-results/` always holds **the current round**. When a round is superseded it is snapshotted
here, append-only, and never edited again. This file is the index: what each directory is, which
instrument produced it, and what may legitimately be compared to what.

> ## ★ THE ONE RULE
> **Never compare, pool, or diff a gear-B reading against a gear-A one** (`docs/BENCH.md` §1). This is
> not a precaution: B2's sim preference moved **~0.39 pp and changed sign** between the two baselines
> (BENCH §3e), which is larger than most effects this corpus was built to resolve. Every directory
> below except the in-flight round is **gear A**.

## The rounds, oldest first

| directory | round | instrument / protocol | stamps on `XVAL-DONE` | notes |
|---|---|---|---|---|
| `phase6/` | 1st full acceptance run (07-23) | `tools/xval.mjs` + `xval-campaign.sh`, native runner, var10, rigid walls, KT AoE simmed as **downtime**, engine @ `1543e0d` | `seed kit class T lust monoDip diag diagWorst` | the PHASE7 §5.8 baseline: 167 borrowed-win columns / 35 of 36 tables |
| `phase7-round2/` | 2 | same as phase6 | same | **no README of its own** — the only round without one |
| `phase7-round3/` | 3 | after §5.11 legibility canonicalization; `var=0.5`, wall-jitter (`wj=2`) appears | `+ var wj` | |
| `phase7-round4/` | 4 | last round on the **OLD harness gear** — model side planned without `t5two`, at `sp:1387`, a mage the sim never ran | `+ var wj` | kept as the before-half of the `reference-gear.mjs` correction pair |
| `phase7-round5/` | 5 | corrected gear (`t5two`, effective `sp≈1450`); last round on **`emit=intent`** | `+ var wj`, **no `emit=`** | absence of `emit=` is the rule for classifying a stale table |
| `phase7-round6/` | 6 | `EMIT=fire` (P7.15) + P7.14 AoE press-snap fix + PHASE9 `groupSeeds` | `+ emit artifact cache` | |
| `gearA-pre-20260726/` | **7 — the final gear-A round** | same instrument as round 6 | `+ emit artifact cache` | **the whole pre-07-26 corpus.** Everything ACCEPTANCE, PHASE7 and PHASE8 assert rests here |

## ⚠ Round 7 is not an independent gather — 26 of its 36 tables ARE round 6's files

Measured 07-26 (`diff -rq gearA-pre-20260726 phase7-round6`): **10 tables differ, 26 are
byte-identical.** That is consistent with the campaign's `SKIP_EXISTING=1` design — a targeted
re-gather of the cells a change could move, reusing the rest — and it is not in itself a defect.

But it changes how round 7 may be read, in two ways a casual reader will get wrong:

- **"Round 6 → round 7 moved X" is measurable on 10 tables and vacuous on the other 26.** A
  round-over-round diff that reports "26 tables unchanged" is reporting *that they were not re-run*,
  not that the change was neutral on them.
- **Any statistic pooled over round 7's 36 tables mixes two gather times.** For a stamp-identical
  instrument that is usually harmless; it is *not* harmless for anything sensitive to sim RNG draw or
  to a code change that landed between the two gathers.

Which 10 differ: `boss-KaelthasSunstrider-mqg-skull`, `isc-mqg-medlong`, `isc-mqg-xl`, `isc-skull-xl`,
`mqg-skull-long`, `mqg-skull-medlong`, `scb-mqg-medium`, `scb-skull-medium`, `scb-skull-medlong`,
`scb-skull-xl`. (`phase6` → `phase7-round2` by contrast differ in **32** of 36 — a real re-gather.)

## Reading a table

- **`monoDip`** must be `0.00%` — the cold-open invariant (more haste never sims worse for a *fixed*
  plan). Nonzero means a prepull crept back in or a new harness bug: stop and fix, do not gather.
- **`diag`** = `CLEAN` (the native/diagonal plan wins every column) or `DEFICIT X%` (a plan optimized
  for a different haste out-simmed the native somewhere). Weigh by **fight length**, not by monoDip.
- **`char=`** (gear-B rounds only) is what lets a later reader tell the baselines apart without
  trusting a directory name. Gear-A tables carry no `char=`; that absence *is* the classification.
- **Boss cells are a 5-variant wall-jitter mean; class cells are single-variant.** The corpus is two
  instruments with different noise, and any statistic pooling them inherits that
  (`tools/xval-boss.sh` header; per-variant sd **0.1427 pp** vs seed sd **0.0058 pp**).

## Reproducing an archived table

The gear-A instruments (`tools/xval.mjs`, `xval-campaign.sh`, `xval-kit.sh`, `xval-boss.sh`) are kept
**reproduction-only** and carry a banner saying so. They need a native `RUNNER` and an `EXPORT_BASE`.
Do **not** gather a new round with them — the current driver is `tools/xval-bench.mjs` +
`tools/xval-bench-campaign.sh`, driven by `tools/xval-round-pipeline.sh`.

⚠ They also predate `sim/planspec.mjs`'s `REQUIRES_EQUIPPED` guard, so they will schedule a press of an
**unworn** trinket — a bit-identical no-op in wowsims that reads as a small honest number rather than
an error. Kits naming `skull` or `mqg` against a two-trinket-slot character are exactly that
configuration. **Whether any archived table is affected has not been checked** (`docs/archive/13-phase12-exact-objective.md`
§2.1, §3.2); check before leaning on a gear-A figure again.
