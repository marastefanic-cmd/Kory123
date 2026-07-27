# CLAUDE.md — Arcane Burn Planner

Read this first. It orients you on the project; the `docs/` files hold the details.

## What this repo is

A **TBC 2.4.3 Arcane-mage cooldown-overlay planner**: `index.html` (open it in a browser — no build,
no deps). The app is still ONE self-contained file **today, but that convention is RETIRED by
decision** — `docs/PHASE11.md` §2 splits it, gated on plans staying byte-identical. Treat
"single-file" as a fact about HEAD, not a constraint to defend. Alongside it sits an **optional** in-page
sim verifier (`sim/`) that lazily loads the real wowsims engine as WebAssembly when the user presses
"Check in the benchmark sim" — a visitor who never presses it downloads exactly `index.html` and
nothing else. **`sim/benchmark.mjs` is the single definition of the duel protocol**, imported by the
page AND by `tools/plan-duel.mjs`/the tests; never retype a protocol constant into a new instrument.

You enter a fight (length, Bloodlust
timing, intermission/AoE phases) and it computes the **optimal moment to press each on-use
cooldown** (Icy Veins, Arcane Power, Icon of the Silver Crescent, Serpent-Coil gem, Berserking),
plus a burn timeline, a per-window activation schedule, and a copy-as-text plan. Alongside it:
`tests/` — a **deterministic exact-match regression suite** (the planner seeds from a fixed PRNG,
so one setup ⇒ exactly one schedule), each case sim-verified against wowsims.

## The end goal (why this exists)

**The planner itself is the goal** — a tool that, given what you know and control going into a fight
(fight shape, raid buffs, gear, trinkets, haste level), lays out how to press every on-use cooldown to
**maximize the "effective ABs cast"** and reports that number so you can trust it and act on it. It must
be **trustworthy and generalisable** — correct across *future* phases, trinkets, gear, and spell-haste
levels, not tuned to today's cases.

- **The one maximizable quantity is "effective ABs cast per fight."** An Arcane Blast's *damage* is
  stack-independent, so score each cast by its **multiplier relative to a plain AB** — AP makes a cast
  ≈ ×1.30, spell power adds its coefficient, etc. — and sum that over the fight (a haste buff raises how
  *many* casts you fit; a damage/SP buff raises what each is *worth*). Crit is a constant factor and
  cancels. Every rule below (Lust alignment, haste sequencing, SP-on-fast-casts) is a **consequence** of
  maximizing this single number — none is an axiom. See `docs/MECHANICS.md`.

Additional payoffs the same engine unlocks (nice-to-haves, not the point):
- A **haste-agnostic ideal APL** (cooldown usage that adapts to gear).
- **Setup comparison** — with each setup planned by its *own* ideal cooldown usage, compare them on
  **absolute at-kill damage** (or each setup's optimal-APL sim DPS) to decide *which trinkets/gear to
  bring* to a fight. ⚠ **NOT on the effective-AB count** — this line used to say exactly that, and it
  contradicted the user-directed ruling in ROADMAP payoff 2 / EP.md. Effective-casts is normalized to
  *each setup's own* plain AB: it divides out flat SP and crit precisely so it can isolate scheduling,
  which makes it the right objective **within** a setup and a blind one **across** setups, where raw
  SP/crit throughput is most of what you are trying to measure. The distinction is the whole reason
  the two currencies exist; do not collapse them (PHASE11 §1.4 item 3).
- An **EP / stat-weight calculator** that re-optimizes the plan at each `stat±Δ` (correcting wowsims'
  frozen-rotation EP bias, which undervalues haste once a fixed rotation stops using it well).

## How to run the tests

```
cd tests && npm install && CHROMIUM=/opt/pw-browsers/chromium node exact-match.mjs
```
Loads the real `index.html` headless, reads the fight tables from the page (`window.BOSS_PRESETS` — the
real phase encounters — and `window.GOLDEN_PRESETS` — the abstract **Debugging presets**), runs every
one through the actual optimizer, compares the copy-as-text plan to `golden.json` (25 cases). `--update`
regenerates goldens (do this ONLY after an intentional change, and only when each changed plan improves
the effective-ABs count — sim-verified when a blind spot is in play, per the methodology in
`docs/TOOLING.md`). The two preset arrays are defined once in `index.html` (`BOSS_PRESETS` +
`GOLDEN_PRESETS`) and drive both the UI (the "Boss presets" / "Reference fights" strips) and the suite,
so a preset you confirm in the tool **is** the locked test.

### The sim gates (added 07-26 — they need no rig)

```
node tests/sim-duel.mjs                      # the shipped wasm runs; prints a duel
RUNNER=/path/to/runner node tests/sim-duel.mjs      # + asserts wasm == native runner
RUNNER=/path/to/runner node tests/sim-request.mjs   # protocol invariants + page == terminal request
```
`sim-duel` works from the repo alone (it loads the committed `sim/sim.wasm`). `sim-request` is the
**anti-drift gate** and needs a native runner — it asserts the protocol *values* (var ≠ 0, cold open,
seed spacing…), that both committed characters' request templates are fresh `--dumpreq`s, and that the
request the **website** builds equals the one the **runner** builds, field for field. It **skips
loudly** without `RUNNER` rather than passing quietly. Run it after touching anything under `sim/`,
`tools/genapl-core.mjs`, or a character export.

**⚠ The 9m07s figure below is `exact-match`'s, not `sim-request`'s** (PHASE9 §5.1) — it sits here
because the *plan* gate is the one you would otherwise reach for on every edit. **That gate takes
9m07s, so it is not the every-edit loop.** For that, sweep the same corpus in **bare
node** (the engine is DOM-free — it already runs in a Web Worker) and diff the two runs at full float
precision — **~33s for 16 of 25 cases, ~16× faster**:
```
node tools/plan-sweep.mjs index.html A.json 3 --max-t=200   # before the change
node tools/plan-sweep.mjs index.html B.json 3 --max-t=200   # after
node tools/plan-diff.mjs A.json B.json
```
It needs no golden to maintain and prints the **changed-cell work list**. Then run exact-match before
committing an engine change (it also covers the render path, which the sweep never touches). Full
rationale, measurements, and both instrument controls: `docs/PHASE9.md §5`.

**And when a changed cell needs the SIM, that is one command and no setup:**
```
node tools/bench.mjs --preset "2:00 lust 0:05" --vs naive     # ~10s, cold, from the repo alone
```
It solves with the real engine, transcribes the plan, sims it against a never-press control, and
prints the sim Δ (with a seed band) **beside the model's Δ**, flagging a sign disagreement. Same
backbone as the website's button — `docs/BENCH.md §6`.

⚠ **Scope the verification to what CHANGED — and DUEL what did.** If a plan is bit-identical and the sim
is unchanged, don't re-test it. But if a plan **did** change, sim it head-to-head against its *previous*
layout at that cell — `monoDip`/`diagWorst`/CLEAN-vs-DEFICIT are **aggregates** and can hold or improve
while one cell regressed (`docs/TOOLING.md`).

## `index.html` at a glance

Two script blocks: `<script id="engine-src">` — the pure DOM-free engine + optimizer — then the
DOM/UI script. The UI runs the heavy optimization in a **Blob Web Worker** built from the engine
tag's own text (`runOptimize`; single-file preserved, main thread never computes), fanned across a
**pool of polish-server workers** sized to the machine's cores with a first-accept-in-order
reduction — pooled and sequential paths return **byte-identical plans** — while the page keeps its
engine copy for cheap scoring and the headless tests (which run the sequential path). Core pieces:
`simulate()` (the cast-rate-integral scorer) · `repair()` (legalizes a schedule: cooldowns, Cold
Snap, use caps) · `optimizeAsync()` (multi-start search + a stack of finishing passes) ·
`renderTimeline()` (the SVG burn chart). Displayed plan times are **fire times** (floored seconds),
not press intents. Full internals + current line ranges in `docs/ARCHITECTURE.md`.

## The rules that make it correct

The planner encodes hard-won, **sim-verified** TBC theorycraft (the GCD floor, buff-into-Lust
packing, when Icy Veins slides out of Lust with gear, Cold-Snap materiality, known-kill planning,
etc.). These are the crown jewels and are easy to get subtly wrong — **read `docs/RULES.md` before
changing the model or the passes**, and keep it updated as the living theorycraft record.

## Working conventions

- **Never leak identity or model identifiers** into `index.html` or anything the user shares
  publicly (it's a shareable artifact): no real names, emails, usernames, repo names, session ids,
  or model ids. The user's Discord handle is the only acceptable attribution.
- **★ There are TWO wowsims and we use the NEW one.** `wowsims/tbc-new` → deployed at
  **https://www.wowsims.com/tbc/** — this is what we build, pin (`ade9f39cc`), patch and **link**.
  `wowsims/tbc` → `wowsims.github.io/tbc` is **ARCHIVED** (2021, pre-APL) and its own page says so.
  The trap: `tbc-new` declares Go module `github.com/wowsims/tbc`, so deriving the URL from an import
  lands on the dead repo — and on 07-26 the shipped page *linked* to the dead one for the same reason.
  Read the URL, never derive it; check drift with `bash tools/upstream-drift.sh`. Details: TOOLING.
- **Determinism is a feature.** Any change must keep one-setup-⇒-one-schedule, or the exact-match
  tests become meaningless. Don't add `Date.now()`/`Math.random()` outside the seeded PRNG.
- **The model is the objective; the sim calibrates it.** The one number to maximize is **effective
  ABs cast** (`docs/MECHANICS.md §4`), and the planner computes it deterministically from the casts,
  buff windows, and timing it already knows — so **that count is the arbiter for comparing two lines.**
  The tool is, by construction, a maximization function over it. The sim's role is narrower: (1)
  **anchor the physics** — certify the formulas/constants the count is built on (trust-anchor to
  `wowsimcli`, ~0.4% absolute agreement); (2) cover the count's **blind spots** — mana and AoE-phase
  weighting (the stack ramp and AP-timing were blind spots but are CLOSED: the ramp is modeled exactly
  in the count — RULES §3 — and the harness's AP cadence is patched to real-TBC 180s — TOOLING); (3)
  **verify a suspicious or novel finding** before it's locked. It is **not** a routine per-golden gate.
  When a clean cast-count and a sim number disagree with **no blind spot in play**, that's a **sim-setup
  audit trigger**, not a model bug — the sim is rarely *wrong*, we've usually *used it wrong* (the Vashj
  drop bug, the stale unpatched runner, the AP-195 quirk, and the **prepull** cast-loss are the
  cautionary tales). See the methodology in `docs/TOOLING.md`.
- **★ The model opens COLD — never prepull in a model-compared sim.** `genapl _prestack:0` (default).
  A prepull's fixed −2.3s time is haste-blind and makes a sim haste sweep non-monotone (more haste
  → fewer casts), which is physically impossible and silently corrupts any haste comparison. Rule
  lives in TOOLING (★★★), RULES §3, and PHASE6 §4.7.
- Commit to the designated feature branch provided at session start; follow the session's configured
  commit author/trailers; don't open a PR unless asked.
- **`master` is the live site.** The tool is deployed as a free static site on Netlify that
  **auto-redeploys on every push/merge to `master`**. So never develop on `master` — branch off it,
  develop, and merge back via PR (merging *is* shipping). **`index.html` plus the eight lazily-loaded
  sim files** are published (`netlify.toml`'s build command — the old "only `index.html`" was already
  false in fact); `docs/`,
  `tools/`, `tests/`, and the `.md` files are not. Full workflow, headers, and anonymity rules:
  `docs/DEPLOYMENT.md`.

## Keep this documentation alive (do this, every session)

These files are the project's memory across context clears — they are only useful if kept **current**.
Treat maintaining them as part of the work, not an afterthought:

- **Update in the same commit as the change.** If you add/refine/overturn a rule → edit
  `docs/RULES.md` (with its sim evidence). If you change the model or pass order → `docs/ARCHITECTURE.md`
  (re-grep the line ranges; they drift). If work lands or priorities move → `docs/ROADMAP.md`. If the
  sim workflow changes → `docs/TOOLING.md`. If the goal or conventions shift → this file.
- **Add or remove docs as the project evolves** — when a new subsystem appears (e.g. the EP
  calculator), give it its own `docs/*.md` and link it below; delete or merge docs that go stale. The
  file list below is not fixed.
- **Prune, don't just append — BUT only the LIVING docs.** When a rule is overturned or a task
  finishes, edit/remove the old text in `RULES.md`/`ARCHITECTURE.md`/`MECHANICS.md`/`EP.md`/`ROADMAP.md`
  so they never describe a state that no longer exists. Stale living docs are worse than none.
- **The HISTORICAL record is append-only — never prune it.** `docs/DIARY.md` (the what/why/when +
  the "believed→disproved" corrections ledger), the `PHASE*.md` phase docs, and `docs/archive/` (the
  recovered per-phase plans) are the project's memory of the road taken. When a phase closes, **archive
  its plan doc into `docs/archive/` (chronological, numbered) — do NOT delete it** — and add its arc +
  any corrections to `DIARY.md`. This reverses the old "delete PLAN.md once it lands" habit (which lost
  Phases 1–5 to git history; they've been recovered into `docs/archive/`).
- Before a big change, re-read the relevant doc; after it, leave the docs describing reality.

## Pointers
- `docs/DEPLOYMENT.md` — how the tool ships: free Netlify static site, **auto-deploys from `master`**,
  branch-off-and-merge workflow, what's published (only `index.html`), headers, and anonymity rules.
- `docs/MECHANICS.md` — **read first.** The verified game formulas (haste, cast time, damage per cast,
  the cast-rate DPS equation) that everything else is derived from.
- `docs/RULES.md` — the theorycraft rules, each with its sim evidence (derived from MECHANICS.md).
- `docs/ARCHITECTURE.md` — `index.html` internals and the optimizer pass order.
- `docs/TOOLING.md` — the wowsims sim harness (how to verify a plan) and its gotchas.
- `docs/GEAR-AGNOSTIC.md` — ★★★ **READ BEFORE ANY SIM WORK. The single source of truth for how this
  project sims.** User decision 07-26: every simulation — the website button *and* the internal
  model-verification corpus — runs on a character defined **only** by the planner's declared inputs
  (SP, crit, passive haste, hit hardset at cap, the T5-2pc checkbox). No exported gear file, ever
  again, because a corpus denominated in one can be voided by re-exporting it — which is exactly what
  happened on 07-26. Where it disagrees with an older doc, **it wins and the older doc is the
  remnant.** It also carries the measured trinket passive/active split, the wasm-vs-native-runner
  numbers, and the freeze rules that gate the implementation.
- `docs/BENCH.md` — ⚠ **superseded in part by GEAR-AGNOSTIC.md (see its banner)** —
  **the standing sim practice**, and `tools/bench.mjs`, the tool that implements it.
  **Reach for `node tools/bench.mjs --preset X --vs naive` before building any rig**: it runs the
  committed `sim/sim.wasm` (no clone, no protoc, no `go build`, no `RUNNER`/`EXPORT_BASE`), prints the
  sim Δ with a seed band next to the model's Δ, and shares its whole backbone with the website's
  verification button — so one change moves both fronts.
- `sim/README.md` — the **in-page** sim verifier: the shared chain (`planspec` → `genapl-core` →
  `simreq` → `sim.wasm`), the gear-agnostic reference character, the wasm-equals-native proof, and the
  rebuild recipe. The terminal harness and the button are ONE code path by construction.
- `docs/ROADMAP.md` — status, current work, and open questions.
- `docs/ACCEPTANCE.md` — **the standing completion test** (⚠ its status block is **gear A**; no gear-B reading exists yet — PHASE10). The holdout haste-adaptation cross-val the
  model must pass FULLY before it's called complete (monoDip=0 everywhere + no length-persistent
  diagonal deficit). Re-run after every fix/upgrade phase. Currently NOT passing (a low-haste slack).
- `docs/DIARY.md` — **append-only history** of how the tool evolved: the phase arc + the
  believed→disproved corrections ledger. Read to avoid re-litigating settled mistakes.
- `docs/archive/` — closed-phase docs, chronological with a README index (`01`–`06` = the per-phase
  plans recovered from the deleted `PLAN.md`; `07-phase6-xval-run.md` = the Phase-6 cross-val run doc,
  cited throughout as *PHASE6 §x*). Historical snapshots; **archive a phase doc the moment its phase
  closes** so the living `docs/` folder only ever shows work that is actually in flight.
- `docs/PHASE7.md` — ⚠ **gear-A denominated (see its banner)** — **the plan to FIX the cross-val deficits so the acceptance test
  passes.** Diagnose each length-robust deficit as SEARCH-MISS vs SCORER-GAP, then fix at the root.
  (§5.11 legibility canonicalization is DONE; §5.12 round-3 gathered; the residual B2 family → PHASE8.)
- `docs/PHASE8.md` — ⚠ **gear-A denominated (see its banner)** — the B2 model-vs-sim ranking error (the old "emergent joint interaction" framing is
  **withdrawn** — it rested on a press the sim silently retimed). Round 2 established **THE FLOOR LAW**
  (a value window covers exactly `floor(D/Δ)` casts in the sim; haste buffs exempt) and two harness input
  errors (`t5two`, effective SP ≈1450), which together zero the mean bias — and **falsified** the
  SP-under-haste candidate on sign. Reserved as the highest-effort model work.
- `docs/PHASE10.md` — ▶ **IN EXECUTION. Round 1 is GATHERING — read `docs/PHASE10-RESUME.md` first**
  (60-second state + exact next actions). Re-establishes the acceptance baseline on gear B; every
  gear-A number is archived, so ACCEPTANCE still has **no reading** until 36/36.
  ⚠⚠ **While it gathers, `index.html`, `sim/simreq.mjs` and `tools/xval-bench.mjs` are FROZEN**
  (GEAR-AGNOSTIC §6.2) — the campaign spawns a fresh `xval-bench.mjs` per cell and the plan cache keys
  on `index.html`'s bytes, so an edit assembles the matrix from two instruments.
  Its §8 is the execution log. Landed so far: the shakedown PASSED; the instrument is certified
  (wasm == native runner · anti-drift 9/9 · anchor ≡ `wowsimcli` · exact-match 25/25); **§4.2 had no
  executable path** (`bench.mjs` is a duel, the test is a matrix) so `tools/xval-bench.mjs` was built
  and *proven* equivalent to `xval.mjs`; and the audit found the **shipped in-page sim was blind to
  Bloodlust and every trinket** (§8.7, half-fixed in §8.12 — Bloodlust `0.000 → +165.5 DPS`).
  ★ The 30 class tables are in: invariant A **passes** (`monoDip = 0.0000%`), and the persistence work
  list **reproduces gear A's cell for cell** (§8.22) — so the low-haste basin is *not* a gear artifact.
  §8.23 diagnoses its worst cell: **two local optima and one terminal cast**, which the model scores as
  a 0.014 % tie while the sim is emphatic at ~13σ. ⚠ Discretizing the scorer is already falsified.
- `docs/PHASE11.md` — **PLANNED (parallel track): the platform phase — the single-file convention is
  RETIRED (user decision 07-26).** Its §1 is the 07-26 audit's findings ledger — **8 confirmed bugs,
  fix first** (worst: the Debug-export "reproduce" command silently mis-reproduces AoE duels; one
  transient failure bricks the sim button until reload; unhashed `sim/sim.wasm` served `immutable`) —
  then CI bring-up (none exists), the module split under a plan-sweep-IDENTICAL gate, the PHASE9 §4
  reclaim ladder, and lazily-loaded product routes (URL-shareable setups first). §8 lists the user
  calls it needs. No scorer/search change is in scope; PHASE10 stays the next MODEL phase.
- `docs/PHASE9.md` — **performance / refactor notes** (CPU + latency, under a byte-identical-plans
  constraint). Measure-first: baseline profile, call census, hypothesis table with verdicts, and the
  refactor catalogue (redundant walks, fusable steps) with a cheapest-and-safest-first landing order.
  **§5 is the phase's larger contribution: the FAST ITERATION GATE** (`plan-sweep` + `plan-diff` +
  `plan-duel`) that replaced "re-run everything after every edit" — read it before designing any
  verification. Two changes LANDED 07-25: the groom early exit and the `groupSeeds` class (§5.12–§5.14),
  together −8.5% CPU with all 25 plans bit-identical.
- `docs/PLAN.md` — the current executable plan, when one is in flight; **absent = no plan in flight**
  (create it before a big multi-step change, delete it once that change lands, folding anything lasting
  into ROADMAP). **No plan in flight. Phase 5 (AoE phases) is COMPLETE** — verdict: an AoE phase is a
  burn ×M(N) modifier + exit-re-ramp + SP-dilution, thresholds and sim gates in RULES §9, record in
  ROADMAP (incl. the Tirisfal-2pc/AP-additivity discovery, whose two user calls are **both RESOLVED** —
  Tirisfal is the `ck-t5` checkbox, AP is additive per "trust wowsims"). Phase 4 is
  COMPLETE (exact discrete ramp + press-snap, basin-stable search, monotonicity certified 0 violations;
  record in ROADMAP). **Permanently REJECTED (user decisions — do not revisit):** the leeway "press anywhere"
  bands and reasoning-tag UI (a plateau tie is conditional on everything else staying put, so the bands
  over-promise; logic deleted from `index.html`); an in-tool "exact mode" (the brute-grid instrument is
  for RESEARCH — generalize its findings into rules, don't ship enumeration); the finite-mana model (too
  many unreliable inputs — the per-window mana-cost chip on the infinite-mana plan is the ceiling of
  mana UX, and it is ramp-aware via the casts board). The haste-graph reference lines stay.
- `docs/SOURCES.md` — where WoW facts come from (TBC is a solved game — look up + cite, don't
  re-derive) and the verified-facts ledger of the constants the model uses.
- `docs/EP.md` — stat weights **two contexts**: the infinite-mana **layout** EP (closed-form model
  partials + wowsims finite-diff on the optimal APL, envelope-theorem argument) AND the finite-mana
  **gearing** EP (wowsims finite-diff on a conserve rotation — the real weights: SP ≈ Int > Haste > Crit >
  MP5 > Spirit ≫ Mana).
