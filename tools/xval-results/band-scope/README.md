# The gear-B round-1 band scope, committed so the ungraded half is RESUMABLE

PHASE10 §8.18 pre-registered the band's scope — **every column `xval-persist` names ∪ every column
`ripple-audit` puts over-floor or INDETERMINATE** — before any width was visible, and
`tools/xval-band-scope.mjs` applies it mechanically so it cannot be re-chosen after the fact.

`/tmp` does not survive a container reclaim, so the scoped target files live here instead. §8.18's
own words are why: name the dropped columns *"with their loci, so the list is resumable rather than
merely honest."*

| file | contents |
|---|---|
| `targets-scoped.json` | the full pre-registered scope — **44** of the round's 142 borrowed-win columns |
| `targets-scoped.json.excluded.json` | the **98** columns deliberately NOT banded (inside the floor **and** non-persistent). ⚠ Not banded is **not** passed |
| `scoped-class.json` | the 36 class columns, descending `pct` — **graded**, results in `../BAND-class-round1.txt` (30 real · 6 not resolvable) |
| `scoped-boss.json` | the 8 boss columns, descending `pct` — **NOT graded**, this is the resumable half |

## To finish the boss half

```
node tools/xval-band.mjs tools/xval-results/band-scope/scoped-boss.json
```

**Cost:** a boss column is a 5-variant wall-jitter mean, so at the default 5 seeds it is 50 sims; the
four Kael'thas columns run ≈103 s/sim (6 targets) ⇒ **~86 min each, ~5.7 h total**. `--seeds` with
three spaced values is compliant with §5's rule (`≥3`) and roughly halves that. The file is already
in §8.18's prescribed **descending `pct`** drop order, so stopping early leaves the correct prefix.

⚠ **Read the result against a ruler that does not exist yet.** The ±0.1251 pp boss-cell noise band was
measured at **one** gear-A cell (ACCEPTANCE's archived block) and cannot be re-derived from this
round, because `ripple-audit` — the tool that prices boss cells — **fails its own KT discrimination
check** here (3/13 over floor against a bar of 7; archive/11 §8.30). Grading a boss column against a
tail-only floor was already something that tool's header called a lower bound for boss cells.

⚠ `tools/xval-band.mjs` loads `sim/sim.wasm` and has **no `RUNNER` option**, while the round was
gathered on the native runner. The two agree to **0.05 DPS, not to the bit** (archive/11 §8.27), and
the band is a *paired* difference measured wholly within one engine so systematic offsets largely
cancel — but a column whose survival turns on <0.02 pp should not be adjudicated by the band alone.
