# PHASE11.md — the platform phase: the single-file convention is retired

**Status: PLANNED (written 07-26), not started.** Nothing in `index.html`, `sim/`, `tools/` or
`tests/` has changed for this phase yet — this doc is the record of the 07-26 brainstorm +
repo-wide audit that scoped it, and the charter for executing it. All `file:line` anchors are
against the 07-26 HEAD and **will drift** (that rot is itself finding F14 below).

**Relationship to Phase 10:** parallel track, not a successor. PHASE10 (re-baseline acceptance on
gear B) remains **the next model phase**; Phase 11 touches no scorer term, no search pass, no
protocol constant, and must leave every plan **byte-identical** except where a §1 bug fix is
itself the change (each such fix is plan-neutral by construction — they live in tools/UI/deploy,
not in the engine). The two phases can interleave; §7 sequencing says how without tripping the
freeze-window rule (never edit `index.html` while a campaign reads it — PHASE9 §4.20's lesson).

## §0 The mandate

User directive (07-26): *the "it's just a single html file" convention is retired — we deployed
the app and can have a full web app. Brainstorm better/faster/both, and mark any
bugs/inefficiencies caused by "single html doing everything" at the start of Phase 11.*

Until this doc, **no document acknowledged the retirement** — the written record's position was
"the app is one file; the sim verifier is an optional satellite" (CLAUDE.md, README:6,
ARCHITECTURE:3, `index.html:3775`'s own comment, archive/00's "still hold today"), while
`netlify.toml` already publishes **nine files** (`index.html` + 8 sim/tool assets). This doc is
the retirement's paper trail; the doc sweep is work item §7.0.

What "retired" does **not** mean: determinism (one setup ⇒ one schedule), anonymity (now enforced
**per published file**, not per `index.html`), `master` = live site, the sim methodology (model is
the objective, sim calibrates), and every user rejection in CLAUDE.md/ROADMAP all stand — §6.

## §1 ★ THE FINDINGS LEDGER — mark these first (the mandate's own words)

Everything below was found by the 07-26 audit and **verified against HEAD in-session** (the
load-bearing rows re-checked line-by-line). The unifying root cause, stated once: **code that
cannot be imported gets copied, and copies drift.** Four distinct mechanisms currently re-extract
code from `index.html` (the DOM-tag → Blob worker scrape at `:3808`; the three-marker string
slice + `new Function` in `tools/engine-node.mjs:27-55`; Playwright page-eval in 13 loaders; the
hardcoded line-number patcher in `tools/census-build.mjs`), feeding ~30 consumer files.

### §1.1 Confirmed bugs (fix these before or with the split; each is plan-neutral)

- **B1 · The Debug export's "reproduce" command mis-reproduces AoE duels — silent wrong number.**
  `planToSpecInline` (`index.html:4573-4599`, the acknowledged copy of `sim/planspec.mjs` that
  exists only because a classic script can't import) drops the `targets` field its module twin
  returns (`planspec.mjs:83-96`); the emitted command (`index.html:4665`) carries no target count;
  and `tools/bench.mjs` has **no `--targets` flag** — in `--spec-a` mode `targets` stays 0
  (`bench.mjs:122`; only the `--preset` branch sets it, `:142`), though the plumbing below it
  supports targets (`:172`, `runnerFlags` `benchmark.mjs:101`). The page **button** is correct
  (module `planToSpec` + `targets: Math.max(A.targets, B.targets)`, `index.html:4752,4763`) — so
  for Kael'thas (the corpus's only AoE fight, `targets: 6`) the button and its own paste-ready
  reproduction run **different duels**, AE valued at one-sixth in the reproduction. This is the
  exact silent-divergence class `tests/sim-request.mjs` exists to kill; it lives in the one seam
  the gate can't reach (F5). Fix: add `--targets` to bench + compute targets inline (tactical), or
  delete the inline copy by importing `planspec.mjs` (the split does this for free — §2).
- **B2 · One transient failure bricks the sim button until reload.** `sim/duel-worker.js:11-14`
  caches `ready` forever — a rejected boot (e.g. one flaky `sim.wasm` fetch on raid-night wifi)
  is cached rejection, permanently; the page never terminates/recreates the cached per-arm worker
  (`index.html:4719-4720`), so every later duel re-throws. Plus listener leaks in `simRun`: one
  un-fired `{once:true}` error listener accumulates per successful call, and an error-path exit
  leaves `onMsg` attached (`index.html:4722-4728`). Fix: reset `ready` on rejection, evict the
  worker on failure, symmetric listener cleanup.
- **B3 · `immutable` caching on the unhashed wasm = stale physics after the first rebuild.**
  `netlify.toml` serves `/sim/sim.wasm` with `max-age=31536000, immutable`, but the file is
  committed and rebuilt **in place** (`bash sim/build-wasm.sh`, DEPLOYMENT). After any rebuild
  (e.g. the planned Drums/PI patch, PHASE10 §7), returning visitors keep the year-cached old
  engine while the *uncached* `sim/wasm_exec.js` — which "must match the Go version that built
  sim.wasm" (`netlify.toml:7`) — updates immediately: a version-skew pair that breaks the button
  only for returning users. Latent today (wasm untouched since ship); bites on the first rebuild.
  Fix: content-hash the published filenames in the build command (§2.4), or drop `immutable`.
- **B4 · `tools/plan-duel.mjs` still transcribes the retired INTENT convention.** Its private
  `toSpec` (`:144-163`) emits `best.s` press intents with `Math.round`; the canonical convention
  since P7.15 is **fire times floored** via `actEff` (`planspec.mjs:8-14`; `xval.mjs` EMIT=fire
  default) — the very mis-transcription that cost −1.5% on a KT plan. The header's "mirrors
  tools/xval.mjs" (`:134`) predates xval's fix. The arbitration tool can therefore duel plans the
  tool never prints. (Its protocol *values* do come from BENCH — `:209-210` — but the flag *shape*
  is hand-assembled at `:208-212` instead of `runnerFlags()`, the exact pattern
  `benchmark.mjs:13-14` forbids.) Fix: transcribe from a stored/recomputed `actEff` and call
  `runnerFlags()`.
- **B5 · `tools/census-build.mjs` is dead against HEAD.** Ran it: exit 2, "anchor 565 expected
  `<script id="engine-src">` … it is now at line 836" — all 8 hardcoded line anchors drifted
  (loud by design, but the runtime-census instrument is unusable until hand-re-anchored). The
  structural cause is the monolith: any CSS/markup edit above the engine tag renumbers everything.
  Fix: re-anchor now; the split retires the failure mode (probes anchor into a small stable file).
- **B6 · `tests/evalsched.mjs`'s cfg lacks `t5two` — a live drift instance, acknowledged in-page.**
  `index.html:4669` literally warns: "Tirisfal-2pc is ON here but evalsched.mjs's harness cfg has
  no t5 field". The preset→cfg constructor is retyped in **at least six places** (`goldenToState`
  `index.html:5353+`, `engine-node.mjs:70-81`, `tests/{evalsched,exact-match,plan,probe}`), and
  one has already fallen behind the engine's cfg schema — the §20-family bug class (score a no-T5
  mage against a T5 sim) reborn model-side. Fix: one exported `cfgFor()` (§2).
- **B7 · `tests/sim-duel.mjs:48`'s main-guard fails as a pass.** `import.meta.url ===
  `file://${process.argv[1]}`` — any path needing percent-encoding makes the comparison silently
  false and the wasm self-check **exits 0 having asserted nothing** (a gate whose failure mode is
  a pass). `tools/genapl.mjs:12` already does it right (`pathToFileURL`). One-line fix.
- **B8 · `tests/sim-request.mjs` skips its runner-free checks too.** The `RUNNER` gate
  (`:40-44`, `process.exit(0)`) sits *above* §0's protocol invariants (`:86-109`), which import
  only `BENCH` and need no runner — so without a runner even the always-runnable assertions never
  run. Fix: hoist §0 above the gate; it becomes CI-able for free (§3.5).

### §1.2 Fragilities — the copies-drift class (the split's real justification)

| # | What | Evidence | Failure mode |
|---|---|---|---|
| F1 | `braceBlock` is a brace counter, not a parser, used to slice `buildSegments` out of the UI script (which is pure but sits *outside* the engine tag — the boundary is drawn wrong) | `engine-node.mjs:12-22,35-38`; `index.html:3437` | a `}` in a string/comment silently truncates the function; the `>100 chars` guard is the only net |
| F2 | Preset extraction is declaration-order-dependent (`const GOLDEN_DEFAULTS = {` → `window.GOLDEN_DEFAULTS =` markers; boss table captured only because its assignment happens to come last) | `engine-node.mjs:41-44`; `index.html:5286-5351` | natural reordering drops `BOSS_PRESETS`; caught only by `nBoss>0` |
| F3 | The 11-key cooldown list is retyped ~8× (`LANE_ORDER` + `ALL_BUFFS` copies in engine-node + 6 tests) and its **order feeds the golden text sort** | `index.html:888`; `exact-match.mjs:47,79`; `engine-node.mjs:67`; tests/* | a 12th buff would be silently ignored by every harness — silent corpus shrink |
| F4 | The copy-as-text convention exists twice: `planText` vs exact-match's in-test re-assembly ("minus the cosmetic tags") | `index.html:4242-4266`; `exact-match.mjs:64-82` | a format change decouples "the preset you confirm IS the locked test" with no alarm |
| F5 | The anti-drift gate cannot reach the page's inline glue (classic scripts have no importable surface) — it proves module==runner, never page==runner | `sim-request.mjs:155-159` vs `index.html:4741-4773` | B1 lived exactly there |
| F6 | Trinket item IDs retyped: `TMETA` in plan-duel + xval vs `IDS` in genapl-core; SCB's wear-item 30720 exists **only** in the copies | `plan-duel.mjs:137-138`; `genapl-core.mjs:24-34` | an ID fix lands in one place |
| F7 | wasm boot ritual ×3, unequal: bench's copy checks `out.errorResult`, sim-duel's doesn't | `duel-worker.js:13-32`; `bench.mjs:95-109`; `sim-duel.mjs:33-41` | a bootstrap fix lands in one of three |
| F8 | Upstream pin `ade9f39cc` in two executable places | `build-wasm.sh:15`; `upstream-drift.sh:29` | a pin move can half-land |
| F9 | Cross-boundary constants aligned by prose only: model `KILL_WINDOW = 0.5` vs `BENCH.variation: 0.5` ("the model's kill-window WIDTH"); `GAME.HASTE_RATING_PER_PCT: 15.77` vs `hasteRatingPerPct: 15.76923` (same number, documented — `benchmark.mjs:74`) | `index.html:1006`; `benchmark.mjs:33-39,76` | a deliberate change to one silently strands the other |
| F10 | Pool workers have no `onerror` and `poolMap`'s `Promise.all` has no timeout — a pool worker dying mid-`polish` freezes the run at the progress bar with no console evidence | `index.html:3814-3828` (only the main orchestrator gets handlers, `:3837-3843`); engine `poolMap` `:1673-1677` | silent hang |
| F11 | **The shipped pooled path is un-gated**: exact-match runs the sequential path (POOL=null headless), node tools too — the "byte-identical pooled ≡ sequential" claim (`index.html:1656` "(verified)") rests on a one-time manual check while the pool is what every real user runs | CLAUDE.md test section; `exact-match.mjs` | a pooled-only divergence would ship invisibly |
| F12 | `plan-sweep`'s engine access is the F1/F2 extraction — the fast gate itself stands on the string slice | `plan-sweep.mjs:27,55` | the every-edit loop inherits every extraction failure mode |
| F13 | UI-presentational data ships inside the "pure" engine into every worker and node tool (`BUFFS.*.color: "var(--c-…)"`, `TRINKET_TIERS` labels), and the UI string-slices the CSS var back out | `index.html:874-898`; `colorOf` `:3853` | engine/UI can't be reasoned about separately; workers carry dead UI strings |
| F14 | Line-number cross-references rot project-wide (ARCHITECTURE "~3600 lines" vs 5,411; `xval.mjs:55` cites `index.html:717` for KILL_WINDOW, actual 1006; PHASE9 cites `:3314` for `createObjectURL`, actual 3808) | verified instances | docs mislead precisely when they're needed; CLAUDE.md institutionalizes the cost ("re-grep the line ranges") |

### §1.3 Inefficiencies

- **I1 · The engine is parsed (2+n)× per session, uncacheable.** Page copy + main Blob worker +
  ≤8 pool workers each parse their own 160,540-byte copy from a unique `blob:` URL — no HTTP
  cache, no V8 code cache, ~1.4 MB of duplicated source on an 8-core box, re-minted on every
  mid-solve re-run (`index.html:3789-3826`).
- **I2 · Known, documented, unfixed lifecycle leaks** (PHASE9 §4.20): `revokeObjectURL` appears
  **nowhere** (grep: 0 hits) — ~141.5 KiB Blob pinned per interruption; dead pool `MessagePort`s
  accumulate; abandoned in-flight polish jobs burn n×~1 s and queue the next run behind them (the
  *felt* "slow again"). The fix batch was filed as §4.13.1 item 0e and never landed.
- **I3 · One cache unit.** Any one-line UI tweak re-ships all 352 KB (119.5 KB gz) — engine 45.6%,
  UI 41.2% (of which 23 KB is base64 icon JPEG, ~incompressible, plus 12.4 KB static assumptions
  prose), CSS 9%. First paint needs none of the engine; interactivity currently waits on all of it.
- **I4 · Main-thread work that belongs elsewhere:** the naive arm is re-simulated on the main
  thread on every sim-button press (`index.html:4750`) though `lastRun.naiveR` exists (`:3868`);
  run-click does three engine calls on the main thread before the worker starts (`:3866-3868`).
- **I5 · Per-event forced layout:** tooltip mousemove does write→read (`offsetWidth`,
  `getBoundingClientRect`)→write every event (`:4108-4123`); same pattern inside pointermove
  drags (`:4505-4527`); `colorOf` re-runs `getComputedStyle` per lane per render (`:3853`).
- **I6 · Every keystroke in the setup panel runs two `querySelectorAll`s** and marks presets dirty
  even when typing in a not-yet-committed pin-entry box (`:5392-5396` vs `:3550`).
- **I7 · The browser tax on gates.** exact-match costs 270–337 s (parallelized; 9m07s sequential)
  because engine+presets are reachable only through a live page; the whole PHASE9 §5 instrument
  stack exists to tunnel around the HTML. (Correction the docs need: **the 9m07s figure is
  exact-match's**, PHASE9 §5.1 — CLAUDE.md's sim-gates paragraph places it so it reads as
  sim-request's, and `plan-sweep.mjs:4-6` still says "sequential in one chromium page".)
- **I8 · Header gaps:** `/sim/*.mjs`, `/tools/*.mjs` ship Content-Type but no Cache-Control
  (every sim click revalidates five modules); `index.html` relies on Netlify's implicit default.
- **I9 · Micro/dead weight:** `.card` CSS rules match nothing (`index.html:124-130,150`);
  `.stamp` references undefined `--ink-3` (fallback masks it); `fmtT` ×3 with divergent rounding
  (benign today — press times are integers); `breathe()`'s MessageChannel refs node's event loop
  so every node tool must hard `process.exit(0)` (`bench.mjs:224-228`).

### §1.4 Stale-doc ledger (sweep in §7.0, same commit as this doc's landing or right after)

1. Single-file assertions now false-by-decision: CLAUDE.md ("still ONE self-contained file"; and
   "Only `index.html` is published" — already false in fact, netlify publishes 9 files),
   README:6, ARCHITECTURE:3 ("~3600 lines"), `index.html:3775` comment ("single-file constraint
   preserved"), archive/00 "still hold today" (**annotate, don't prune** — append-only record).
2. CLAUDE.md still lists Phase 5's "two open user calls" (Tirisfal-2pc / AP-additivity) — both
   RESOLVED in ROADMAP (`ck-t5` checkbox; additive per "trust wowsims").
3. Setup-comparison currency contradiction: MECHANICS §4 + CLAUDE.md say compare effective-ABs;
   the user-directed ruling (ROADMAP payoff 2, EP.md) is **absolute at-kill damage** (eff-casts
   normalizes away flat SP/crit). Reconcile before any comparison feature ships (§4.3).
4. The 9m07s attribution + stale `plan-sweep.mjs` header (I7).
5. `sim/README.md:22` + `planspec.mjs:4-6` overstate sharing ("mirrors xval's toSpec" / "shared
   verbatim by the terminal harness") — xval and plan-duel carry private copies, one divergent (B4).
6. BENCH §4c section header still says gear-B crit/haste "still owed" while its body records them.

## §2 The platform track — the split

### §2.1 Target shape

`index.html` (thin markup) + `styles.css` + `engine.mjs` (pure: today's `:836-3420` **plus**
`buildSegments`, minus UI-only fields) + `data.mjs` (GAME/BUFFS mechanics, presets — the corpus)
+ `theme.mjs`/CSS-side table (colors, tier labels — F13's UI half) + `ui.mjs` +
`engine-worker.mjs` (real file: main + pool flavors) + the existing `sim/` chain unchanged.
Consumers after the split:

| Today | After |
|---|---|
| Blob-from-tag workers (`:3808`) | `new Worker("engine-worker.mjs")` — HTTP-cached, code-cached, parse-once; Blob path kept only as `file://` fallback if the user wants it (§8.1) |
| `engine-node.mjs` loadEngine (F1/F2 slicing) | `import { optimizeAsync, simulate, … } from "../engine.mjs"` — braceBlock and all markers **deleted**; `plan-duel`'s two-engines-in-one-process trick preserved via `import(url#cachebust)` or worker isolation |
| exact-match scraping `window.*PRESETS` | imports `data.mjs` for the corpus; keeps the page for what only it can test — the **render path** |
| `planToSpecInline` (B1) | deleted; the debug export imports `sim/planspec.mjs` (it's lazy-loadable at export time too) |
| 6× preset→cfg copies (B6), 8× key lists (F3), `planText` twin (F4) | one exported `cfgFor()` / `LANE_ORDER` / `planText(run,{cosmetic})` |
| sim-request proving module==runner (F5) | the page glue becomes importable and enters the gate's matrix: page==module==runner |
| census line anchors (B5) | probes target small stable files / exported symbols |

### §2.2 The migration invariant (non-negotiable)

The split commit moves **text, not behavior**: the engine source is byte-identical modulo the
module wrapper. Gate: `plan-sweep` A/B pre/post → `plan-diff` **IDENTICAL** (25/25, SCORE-AUDIT
scorer-pinned), then `exact-match` 25/25 — the same regime PHASE9 used for −8.5%. No perf edit,
however tempting, rides the split commit (the §5.15 lesson: "pure addition" wasn't).

### §2.3 Build or no build (user call §8.1)

Recommendation: **no-build native ES modules** first — it keeps the project's no-toolchain ethos,
Netlify serves files as-is, and every consumer above works. Cost: the core planner stops working
from `file://` double-click (module CORS); local preview becomes `python3 -m http.server` (or any
static server), which DEPLOYMENT already half-accommodates for `dist/`. If double-click must
survive, the halfway house is build-time inlining (modules are the source; the netlify command
splices them into the shipped page; a freshness gate — same pattern as `sim-request`'s template
check — keeps the committed artifact honest). esbuild/minification is an *optional later* step,
justified only by measured wire-size wins; it adds the first real toolchain + reproducibility
surface and is not needed for any §1 fix.

### §2.4 Headers/CSP once the Blob is gone

Worker-from-file removes the stated blocker (`netlify.toml:29-36`): add
`Content-Security-Policy: default-src 'self'; script-src 'self'; worker-src 'self'; img-src 'self' data:; style-src 'self'`
(exact policy to be tested against both workers + wasm — `'wasm-unsafe-eval'` likely needed for
`instantiateStreaming`). Content-hash published assets in the build command and give everything
long immutable caching (fixes B3 properly); explicit `max-age=0, must-revalidate` on the HTML.
COOP/COEP is **not** part of this batch — see §3.4.

## §3 The faster track

### §3.1 The reclaim ladder (PHASE9 §4, already argued — finish it in order)

Post-§5.21/§5.22 the engine sits ≈ pre-§5.12 CPU +2–4% with the correctness wins banked. The
catalogued remainder, cheapest-and-safest first: **(0b)** hoist `counts(base)`/`clipOf(base)` out
of candidate loops via `admit`'s signature (`index.html:2044-2049`) → **per-cfg memo + two-
generation eviction** (kills the `cfgSigOf` prefix concat on ~2M lookups + the 5 wholesale
`SIM_MEMO.clear()`s at cap 120k, `:943,947`) → **§4.12(A) stringify hoists** at the five
remaining both-operands-in-loop sites → **§4.4 hot-loop allocation** (`stepFor`/`scanAt` fresh
objects, the per-`simulate` breakpoint Set→spread→sort, `:1130-1135,1196-1217,1303-1314`) →
**§4.1/§4.16 five-walk fusion** (repair:simulate:sig ≈ 1:1:1 at ~29.3M walks each — the largest
catalogued win, now cheap to land behind `admit`'s single call site). Plausibly **−20–30%
combined**. Every step: T0 sweep gate + wall-time re-measure + pre-registered revert (the §5.22
Class-C template); §5.10's law — search-touching changes gate on the **full 25**, never the quick
tier. Do **not** re-propose the falsified list (PHASE9 §4.12.7 sigOf-equality, §5.10 starts-cut,
§5.13 plateau/nudge/anchor-widening, §5.14 top-K raw cut, §3.6 H5, …) — it's all recorded with
verdicts.

### §3.2 Zero-risk latency wins (the user-felt ones)

- **Solve cache**: `{engineHash+cfgSig → finished plan}` in worker memory (+ optional
  localStorage). A hit replays a stored solve — *definitionally* one-setup-⇒-one-schedule;
  toggling an input back and forth becomes 0 s. ⚠ The tempting stronger version — **warm-starting
  the search from the previous plan — is FORBIDDEN**: output would depend on edit history, which
  violates determinism. (A clearly-labeled instant *preview* later replaced by the canonical
  solve is the acceptable middle if ever wanted.)
- **Precomputed preset plans**: the 25 preset solves are frozen in `tests/golden.json` already —
  ship them as data so clicking a preset (the landing flow) renders instantly, optimizer runs
  only on modification. Needs its own anti-drift gate (baked table == suite output, regenerated
  only via the `--update` flow in the same commit) — without that it's a second definition of
  the plan, which is the disease this phase exists to cure.
- **Worker-from-file** (§2): parse-once + code cache; kills I1.
- **The §4.20 lifecycle batch** (I2) + progress re-band of the silent 96–100% tail (PHASE9 §4.18)
  + the pool-size `cores−2 → cores−1` **sweep** (a knob to measure, not argue).
- **I4/I5/I6 micro-fixes**: reuse `naiveR` (or compute the collect variant in the worker), cache
  rects on pointerdown, snapshot theme colors per render, scope the dirty-marker.

### §3.3 The engine's insides (bigger, still byte-identical-provable)

- **Typed-array / struct-of-arrays interior for `simulateRaw`** — preallocated module-scope
  scratch (events, active windows, breakpoints) replacing per-call object graphs. IEEE doubles
  are identical in typed arrays; the hazards are operation order (keep every expression and the
  for-in R-order walk identical) and hole semantics. This is where the 41.5% self-time + 5.3% GC
  live; **10–25%** plausible. Land function-by-function under the sweep gate.
- **★ The structural lever — prefix/span reuse in the scorer.** PHASE9 §5.6 left the phase's
  biggest question deliberately open: solve cost is ~exponential in press count (×1.35–2 per
  slot; 5 cases = 73% of corpus CPU) — "is that factor irreducible or an artifact of re-exploring
  settled prefixes?" Two shapes *can* be bit-identical: board-state snapshots keyed on the event
  prefix up to the first differing press, and span-contribution reuse keyed on active-window
  state — **only** same-values-in-same-order summation qualifies (any re-partition flips 1e-7
  accepts and is the falsified-by-construction branch). High effort, research-grade, the only
  multiplicative candidate on the table. Gate: full sweep + SCORE-AUDIT + duels; `changed>0` = fail.
- **Planner-to-WASM: rejected for this phase.** Non-correctly-rounded `Math.pow`/libm means no
  bit-identical promise; it would be a deliberate re-golden major version (new goldens, full sim
  re-anchor) — a project decision, not a perf item. C4+C5 above deliver most of the win inside V8.

### §3.4 COOP/COEP + SharedArrayBuffer — for *cancellation*, not throughput

Jobs cost 0.3–1 s; postMessage costs µs — SAB buys ~nothing on dispatch, and the Go wasm sim is
single-threaded anyway. The real payoff is §4.20's "irreducible" leak: a shared `Int32Array`
generation flag checked between polish passes lets **abandoned** jobs die in ms instead of
burning n×~1 s behind the next run. Determinism: zero — the flag only affects work whose results
are already discarded. Needs COOP/COEP headers (+`CORP` on the lazy sim assets), feature-detect
`crossOriginIsolated`, fall back to today's behavior. Do it after §2.4, as its own measured step.

### §3.5 Test & CI speed (there is no CI today — verified, no `.github/` exists)

Runner-less GitHub Actions, all viable from the repo alone: **exact-match** on PR (install
Chromium, pin it; ~5–7 min), **sim-duel** wasm smoke (~1 min) — after B7's fix actually asserts,
**plan-sweep A/B vs merge-base + plan-diff** (catches unintended plan movement *and* scorer-pinned
score regressions; the gate hole §5.15 closed, now automated), **bench smoke** (~1–2 min,
end-to-end engine→planspec→genapl→simreq→wasm), **sim-request §0** protocol invariants (after B8),
**upstream-drift** weekly. The full anti-drift gate becomes CI-able by caching the native runner
build keyed on `pin+patches-hash+go-version` (cold ~10–15 min, warm ~1 min). exact-match itself:
attach the worker pool inside test pages for the long cases (which **also closes F11** — run KT
pooled+sequential, assert byte-equality, making "pooled ≡ sequential" a standing gate instead of
a one-time claim), hash-gate to skip when engine+presets+UI are untouched, quick-tier on PR / full
on merge. Repo weight is a non-issue today (pack = 6.42 MiB; the 22.8 MB wasm exists in one
revision) — each rebuild adds ~4–5 MB compressed, so **on the first rebuild** (Drums/PI patch)
decide git-vs-release-asset+sha256 (§8.6); LFS's free-tier quota outage risk says not-LFS.

## §4 The better track — product features the platform unlocks

Every feature below is a **lazily-loaded route** — the generalized cold-start rule: a visitor who
never opens it downloads nothing for it (the sim button set the precedent). Model-accuracy work is
explicitly **not** here (§5).

1. **URL-shareable setups + last-setup autosave** — the biggest pure-UX win; nothing exists today
   (zero URL state; a mid-raid refresh loses the fight being planned; only manual named presets in
   localStorage). `snapshotState()` (`:5194`) is already the serializer: base64url into
   `location.hash` (~200–300 chars), decode through `applyState`'s sanitizers, version the schema
   (the presets shim at `:5211` shows one migration already happened). Determinism makes a link
   **a reproducible plan** — strictly better than the copy-text preamble for Discord sharing.
2. **Offline / service worker** — a raid tool is used on raid-night wifi. Precache the shell,
   stale-while-revalidate keyed off the existing build stamp (`:833`), optional after-first-use
   caching of the sim assets. The classic SW-staleness footgun demands an explicit update toast;
   test against Netlify's atomic deploys.
3. **Mobile + input pass**: 980-unit viewBox → ~4px labels at 375px (tick culling / min-width +
   scroll); `inputmode="numeric"` hides the colon iOS needs for `m:ss` (`:685,3550`); drag-editing
   is pointer-only (add a keyboard/stepper path); un-nest the preset-chip delete button (ARIA).
4. **Multi-seed error band in the sim button** (ROADMAP "still open"): the two arms already run in
   parallel workers; running seeds concurrently makes the real paired band ~free instead of 2×
   wall — retire the fixed ±0.05% tie band. Same worker-orchestration module as (6).
5. **Static APL export** — ROADMAP payoff 1's shippable half: `genapl-core` already converts
   plan→APL for every sim this project runs; a "download as wowsims APL" button is plumbing.
6. **In-page research mode** (batched wasm campaigns — Phase 10's natural instrument successor):
   an explicit, user-initiated mode that runs cell batches through `duel-worker` instances with
   provenance stamps and resumable results. Consistent with doctrine under three fences: it is a
   *calibration/campaign* instrument, never a per-change gate; it must not violate "nothing
   computes after the results render" (explicit mode only); every protocol constant stays imported
   from `sim/benchmark.mjs`. Surface the known wasm limits in the UI (Drums/PI unpressable,
   no Ashtongue, no burn phases, wall-jitter needed for boss-shaped cells).
7. **Setup comparison view** — ⚠ reopens a user ruling (ROADMAP payoff 2: "no dedicated feature
   needed"; compare **absolute at-kill damage**, never effective-casts). The platform changes the
   cost calculus (N solves across the pool + a table is cheap now), but shipping it needs the
   user's yes (§8.4) and the §1.4.3 doc reconciliation first.
8. **EP / stat-weight route** — ⚠ same: EP.md's ruling was "two lightweight routes, no bespoke
   calculator". The honest breakpoint-aware route (re-solve at stat±Δ) is exactly why §3's CPU
   work matters. Needs the user's yes (§8.5); layout-EP only, labeled infinite-mana; the gearing
   EP stays a sim reading that never feeds the planner.
9. **Drums/PI `SpellFlagAPL` upstream patch + Ashtongue flatten-to-uptime** — coverage items that
   de-beta the badges; each moves the sim engine ⇒ new baseline (BENCH §1), so schedule **with**
   a Phase-10 boundary, never mid-corpus; the rebuild is also B3's forcing function and the
   git-vs-release-asset decision point (§8.6).

## §5 What Phase 11 is NOT

No scorer term, no search pass, no golden regeneration (outside a §1-bug's own gate), no
protocol change. B2's crossing-location error, the low-haste columns, the acceptance-criterion
restatement — all stay PHASE10-gated model work. And the standing rejections hold: no leeway
bands, no in-tool exact mode, no finite-mana model, no boundary-charge ON, no computation after
render, no prepull, no legend/Pressboard resurrections.

## §6 Invariants carried unchanged

1. **Determinism** — one setup ⇒ one schedule; no `Date.now()`/`Math.random()` in model input;
   pooled ≡ sequential ≡ bare-node byte-identical (and F11's fix makes that a *gate*, not a claim).
2. **Anonymity per published file** — the split multiplies published surfaces; the pre-ship scan
   (no names/emails/usernames/repo/session/model ids; Discord handle only) applies to each.
3. **`master` = live site** — branch → PR → merge is shipping; only files the build copies into
   `dist/` are published; every new published file is an explicit build-command decision.
4. **Docs-alive** — same-commit doc updates; living docs pruned; DIARY/PHASE*/archive append-only.
5. **The sim methodology** — model is the objective, sim calibrates; protocol constants live once
   in `sim/benchmark.mjs`; never compare across engine baselines; gear-A/B denomination banners.
6. **Verification scoped to what changed — and duel what did**; instrument chosen by the axis the
   change acts on; perf claims need measurements; pre-registered revert rules.

## §7 Sequencing (cheapest-and-safest first, freeze-windows respected)

0. **Doc sweep** (§1.4) — same-session, no code.
1. **The §1.1 bug fixes** — each independent, plan-neutral, own gate (B1 tactical fix + B2 + B7 +
   B8 land in minutes; B3 waits for §2.4 or drops `immutable` now; B4 with a duel re-run on one
   known cell; B5 re-anchor; B6 add the field + a comment pointing at the future `cfgFor`).
2. **CI bring-up** (§3.5) — works on today's extraction; everything after lands under gates.
3. **The split** (§2) — one byte-identical restructure commit (+ CSP/headers/hashing commit).
4. **Perf**: §3.2 zero-risk batch → §3.1 ladder in order → §3.3 typed-array interior → §3.4
   COOP/COEP cancellation. Each step measured, sweep-gated.
5. **Product**: §4.1 URL state → §4.2–§4.5 → user-call items (§4.6–§4.9) as decided.
6. **Research-grade**: §3.3's prefix-reuse scorer work, only after the ladder lands (it wants the
   fused walks) and never concurrent with a Phase-10 campaign window.

Phase 10 interleaves freely: it reads `tools/bench.mjs` + `sim/` + the committed wasm, none of
which steps 3–5 touch except at declared boundaries (§4.9).

## §8 Decisions needed from the user (this phase's open calls)

1. **file:// double-click**: accept "local preview = tiny static server" (clean modules), or keep
   double-click via build-time inlining (committed artifact + freshness gate)?
2. **Toolchain**: stay no-build (recommended start) — and is a later esbuild/minify step wanted at
   all?
3. **Precomputed preset plans**: accept shipping golden-derived plans as data (instant presets)
   under the anti-drift gate, or keep every render solver-fresh?
4. **Setup-comparison view**: reopen the "no dedicated feature" ruling? (Absolute-damage currency
   per the existing ruling if yes.)
5. **EP route in the tool**: reopen "two lightweight routes, no bespoke calculator"?
6. **On the first wasm rebuild**: keep the wasm in git (+~4–5 MB pack per rebuild) or move to
   release-asset + committed sha256?
7. **Research mode**: wanted at all, and if so its cell-budget/UX guardrails.
8. **COOP/COEP**: accept the (no-op today) embedding restriction to get instant cancellation?

## §9 Traps (the history says so — DIARY / PHASE9 §5.15 / TOOLING)

- **"Pure addition" isn't.** groupSeeds regressed 7 off-corpus cells through three winner-take-all
  narrows; anything that adds candidates, workers, or cache layers must argue its floor.
- **Golden-corpus green ≠ off-corpus safe** — plan-identity on 25 cells was structurally unable to
  see §5.15; the sweep + SCORE-AUDIT + duels regime exists for exactly the split/perf commits.
- **A second definition of anything** (plans-as-data, inlined build artifacts) **needs a freshness
  gate in the same commit** — the sim-request template check is the house pattern.
- **The campaign coupling**: until the split lands, `index.html` edits and running sim campaigns
  still share one file — respect the freeze windows (ROADMAP §0b).
- **Silent-pass gates**: B7/B8 are live reminders — every new CI job needs a negative control
  (a deliberately-broken input that must fail) before its green is believed.
- **Cache keys must cover the inputs** (the `cfgSigOf` §5.19 lesson) — the solve cache and any
  memo added in §3 must key on engine hash + full cfg signature, with the Proxy guard (PHASE9 §4)
  landed alongside as the debug assert.
- **Two wowsims**: never derive the upstream URL from the Go module path; the pin moves only as a
  deliberate re-baseline.
- **Wall-clock numbers compare only within a same-session pair** (PHASE9 §5.14) — every perf step
  re-measures its own baseline.

---

# §10 — EXECUTION LOG

## 10.1 ✅ Five findings-ledger bugs landed while the gear-B round gathers (07-26)

PHASE10's round-1 campaign is mid-flight, and `tools/xval-bench.mjs` content-addresses its plan cache
on the bytes of the files it imports. That defines a **frozen set** — `index.html`,
`sim/{planspec,simreq,benchmark}.mjs`, `tools/{genapl-core,engine-node,reference-gear}.mjs`,
`sim/sim.wasm` — where an edit mid-round makes the campaign assemble a matrix from two engines
(PHASE10 §8.5). Everything else was fair game, which is exactly five of §1.1's eight bugs.

| bug | what shipped | how it was proven |
|---|---|---|
| **B7** | `pathToFileURL` on both sides of `sim-duel.mjs`'s main guard | ran the guard's own logic from a path containing a space: pre-fix `SKIPS SILENTLY → exit 0`, post-fix `runs` |
| **B8** | `sim-request.mjs`'s §0 hoisted above the `RUNNER` gate | on a scratch copy (benchmark.mjs is frozen), a prepull smuggled into `BENCH` ⇒ post-fix **exit 1** naming the ★★★ rule, pre-fix **exit 0** |
| **B4** | `plan-duel.mjs` imports `planToSpec`; argv from `runnerFlags()` | the two conventions disagree on **4 of 5** real optimized plans — intent `5` fires at `6` on AP, Icon, Gem and IV simultaneously |
| **B3** | `netlify.toml`: whole lazy sim bundle revalidates as a unit, by glob | audit derived from the build command reports **0 of 8** published files without a cache policy |
| **B5** | `census-build.mjs` re-anchored on **content**, not line numbers | `plan-sweep` × 2 → **`PLAN-DIFF IDENTICAL`** (16/16 cases, scorerMoved=0); 3 resolver controls |
| **B6** | new `tests/cfg-contract.mjs` (tactical half; the real fix is §2) | positive + negative synthetic controls; see §10.3 |

### 10.2 ★ B5 was not a drifted anchor — one probe's SUBJECT no longer exists

The ledger records B5 as "all 8 hardcoded line anchors drifted". Seven had. The eighth,
`for (let groom = 0; groom < 3; groom++) {`, **matches nothing in HEAD at all**: PHASE9 §5.12's groom
early exit rewrote it to carry its own `__groomBefore` snapshot. So re-anchoring by number — the fix
§1.1 prescribes — would have silently produced a census of a loop shape that is gone, and the
hand-injected `__g0` snapshot it pairs with is now a duplicate of shipped code.

The probe now anchors on the early-exit test and reads the engine's own `__groomBefore`. That also
retires the old table's one genuine argument for line-anchoring: it needed to find the loop's closing
`}`, the least unique line in the file. Anchors are content now, with `after: '<probe id>'` for the
one line that legitimately appears twice (`dodgeDowntime`'s accept test) — so a CSS edit above the
engine tag can no longer kill the instrument, and an ambiguous or vanished anchor is still a hard
refusal rather than a plausible census of the wrong site.

### 10.3 ★★ B6 IS WIDER THAN THE LEDGER SAYS — the shared constructor §2 wants to converge on has the same bug

§1.1 B6 names `tests/evalsched.mjs` (whose missing `t5two` `index.html` itself admits in a comment)
and prescribes: *"Fix: one exported `cfgFor()` (§2)."* But measuring every constructor against the
engine's own declared field set — `simMemoCfgSig`, which by construction lists exactly what a score
depends on — shows **`tools/engine-node.mjs`'s `cfgFor` drops the same `t5two`, plus
`boundaryCharge`**: 2 of the 10 required fields.

⇒ **Converging the six copies onto `cfgFor` unchanged would turn one copy's bug into every copy's
bug.** Stated concretely: `cfgFor` cannot express the reference gear the entire acceptance corpus is
measured on. `tools/xval-bench.mjs` gets it right only because it spreads `...REF` into a cfg of its
own rather than calling the shared constructor — i.e. the one caller that needs the field avoids the
function that would have dropped it. **§2 must fix `cfgFor` in the same move as the convergence.**

Both omissions are inert *today* (`GOLDEN_DEFAULTS.gear` sets neither, and `boundaryCharge` is off by
user decision — ROADMAP), which is precisely why nothing caught them: the engine reads
`cfg.t5two ? 1.2 : 1`, so an absent key and an explicit `false` are indistinguishable. That is the
§20-family bug — score a no-T5 mage against a T5 sim — with no failing test available to express it.

`tests/cfg-contract.mjs` now reports it, and `--strict` turns it into an exit-1 gate. Strict is
deliberately OFF by default: it cannot pass until §2 lands, and a permanently-red gate is one nobody
reads. **Turn `--strict` on in CI (§3.5) as the last step of §2** — it is the check that proves the
convergence actually fixed the thing it was for.

### 10.4 What is still blocked, and on what

- **B1** — the `tools/bench.mjs --targets` half is landable; the `planToSpecInline` half needs
  `index.html`. Deferred as a unit so the fix and its gate land together.
- **B2** — `sim/duel-worker.js`'s cached rejection is landable; the worker eviction and listener
  cleanup are in `index.html`. Same reasoning.
- **Everything in §2, §3.1, §3.3** — the frozen set, until PHASE10's round completes.
