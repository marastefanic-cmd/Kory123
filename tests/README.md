# `tests/` — what is actually asserted

The blocking gate set (all in CI, several with negative controls that must FAIL before their green is
believed), and it is worth being blunt about which is which, because they fail for different reasons
and are fixed in different places:

| | asserts | needs |
|---|---|---|
| `node tests/anchors.mjs` | **WHICH LAYOUT IS RIGHT** — the layouts the user declared (seventeen, T1–T17) | bare node |
| `node tools/law-check.mjs` (± `--self-test`) | the SCORER against `docs/ESTABLISHED-FACTS.md`'s closed forms | bare node |
| `node tools/constants-cited.mjs` (± `--self-test`) | every `GAME` constant traces to a source OUTSIDE the model — the anti-circularity link | bare node |
| `node tools/self-consistency.mjs` | the SCORER against itself, and the board against the physics | bare node |
| `node tools/toll-audit.mjs --strict` | the opener toll against its closed form, at every haste and ramp entry stack | bare node |
| `node tools/objective-ref.mjs` | the engine against an INDEPENDENT transcription of the documented laws | bare node |
| `node tools/ati-mc.mjs` (± `--self-test`) | the one STOCHASTIC mechanic (the Ashtongue proc) against a direct seeded simulation of its own process (ESTABLISHED-FACTS §12) | bare node |
| `node tests/cfg-contract.mjs --strict` | every cfg constructor emits the engine's full memo-signature field set | bare node |
| `node tools/plan-sweep.mjs …` + `node tools/search-audit.mjs …` (± `--self-test`) | **the SEARCH** — that each emitted plan is a k-coordinate local optimum | bare node |
| CI's `plan-stability` job (plan-sweep A/B vs merge-base + `plan-diff --allow-change`) | no scorer-pinned regression and no backwards tie-break rides a change in unnoticed | bare node + git history |
| `node tools/pool-equiv.mjs` (± `--self-test`) | the page's POOLED solve path returns byte-identical plans to the sequential path every test above runs | bare node |

Nothing here needs a browser, a Go toolchain, a simulator, or a network.

★ **`search-audit` closes the widest hole.** Every scorer gate is blind to a search miss: `anchors`
covers seventeen declared cells, `law-check` stays correctly green (the scorer is right; the
descent just never visited the answer), and `self-consistency` cannot see the search at all. All three
defects that shipped wrong plans in this project's worst week were search misses, and one was found
because the **user** read a plan and said it looked wrong. `search-audit` asks the objective directly.

The planner is **deterministic** — fixed PRNG, an exact objective, no `Date.now()` — so one setup
produces exactly one schedule, which is what lets `anchors` compare press times rather than tolerances.
A tolerance test silently passes when a press drifts to an equally-good alternate spot; an exact test
tells you the layout moved.

---

## ⛔ What used to be here, and why it is gone

**The goldens (07-28, user decision.)** `exact-match.mjs` + `golden.json`, `layout-rules.mjs`,
`monotonicity.mjs`. A golden locks whatever the optimizer said the day it was recorded — it asserts
**stability**, never correctness, and this repo re-recorded its goldens twice in one month to
accommodate objective changes. A test rewritten whenever it disagrees is not a test. `anchors.mjs`'s
header carries the full argument per file.

**The sim gates (07-30, user decision.)** `sim-duel.mjs`, `sim-request.mjs`, `page-equiv.mjs`,
`press-fire.mjs`, `ep-finite.mjs`, `mana-value.mjs`, `ep-sim.sh`, `simsweep.sh` — deleted along with
`sim/`, `tools/bench.mjs`, the `genapl*` harness and the whole `xval-*` cross-validation family:
*"I actually want you to retire the simming, it's doing more harm than good. I think we have the
function/equation locked down and from now on we're better off on our own."*
Their reasoning is archived, bannered, in `docs/archive/14`–`17`.

⚠ **Deleting the sim did not delete the HARNESS-INTEGRITY category, and it must not.** Four of the five
gates in that category happened to be sim gates; `tools/self-consistency.mjs` is the survivor and it is
the one that matters most, because a scorer that contradicts itself is the failure mode that hides
longest. This repo has shipped **two** gates whose failure mode was a PASS (PHASE11 B7 and B8), which is
why every remaining gate that can carry a negative control does: `law-check --self-test` seeds a real
3.6 % error and must be CAUGHT.

---

## Dev scopes (not tests — they assert nothing)

```
node tests/probe.mjs '[{"name":"anything","T":120,"pins":{"bloodlust":[5]}}]'
node tests/plan.mjs  '[{"name":"anything","T":120,"pins":{"bloodlust":[5]}}]'
node tests/evalsched.mjs '{"case":{...},"scheds":{"a":{...},"b":{...}}}'
```

`probe` dumps the raw schedule the optimizer chose; `plan` dumps the copy-as-text plan a user would
read; `evalsched` scores explicit hand-built layouts so you can compare two of them under the model.

★ **`probe` and `plan` open the real page, and that is now the ONLY check on the render path.**
`tools/plan-sweep.mjs` runs the DOM-free engine, so it never touches `renderTimeline`, `scheduleRows`
or `planText`. On 07-30 that path shipped a real defect no headless gate could see: the plan printed
FIRE times, so a press intent of 0:05 displayed as "0:06" and visibly split a cluster the optimizer had
deliberately co-pressed.

⚠⚠ **They go through `page-open.mjs`, over HTTP, and the reason is a trap worth naming.** Both scopes
used `file://`, where the page loads, every function is defined, `#btn-run` clicks — **and nothing
happens, with no error at all**. Chromium will not start a Blob-URL Web Worker on an opaque origin, and
the optimizer runs in exactly such a worker. Use `page-open.mjs`; do not reintroduce `file://`.

They need `playwright-core` (`npm install` in this directory) — the only dependency in the repo, and it
is for the render path, not for any gate. `page-open.mjs` finds a browser under
`$PLAYWRIGHT_BROWSERS_PATH` by itself; override with `CHROMIUM=/path/to/chrome`.

## EP (stat weights)

`ep-model.mjs` and `portfolio-ep.mjs` compute the **layout** stat weights by finite-differencing the
planner's own objective, frozen and re-optimized. ⚠ Their finite-mana counterparts (`ep-finite.mjs`,
`ep-sim.sh`) were wowsims finite-diff and are deleted with the sim — but **`finite-weights.json`
stays**: it is the LOCKED record of the last finite-mana gathering, and `docs/EP.md` cites it as the
authoritative numbers for the gearing half. `docs/EP.md` says which half survives as a re-runnable
instrument (the layout half only).

## Data files

`search-witnesses.json` — recorded search misses, consumed by `tools/search-witnesses.mjs`; a witness
going green closes a KNOWN hole and is not a claim of optimality. `phase-portfolio.json` — the
recorded phase-EP portfolio reading ROADMAP cites (gathered at the 0-haste reference; its own caveat
says re-run at real gear haste before acting on it).

## `cfg-contract.mjs`

Asserts that every hand-retyped `cfg` constructor in the repo still emits what the engine reads. It
exists because this project keeps paying for copies that drift — the root cause `docs/archive/12` states
once: **code that cannot be imported gets copied, and copies drift.**
