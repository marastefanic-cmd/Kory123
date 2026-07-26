# DEPLOYMENT.md — how the planner ships to the web

The planner is hosted as a **free static site on Netlify**. This doc is the living
record of how deployment works and the development discipline it implies.

## The one rule

**`master` is the live site.** Netlify watches the `master` branch and
**auto-redeploys on every push/merge** to it (live in ~30–60s). There is no manual
deploy step.

Therefore: **never develop directly on `master`.** Any change — engine, UI, docs —
is made on a **branch off `master`**, then merged back via PR. Merging to `master`
*is* shipping. This keeps the live site from ever showing half-finished work, and
keeps the exact-match suite as the gate before anything reaches users.

```
git checkout master && git pull        # start from the live state
git checkout -b <feature-branch>        # branch off
# ...develop, run tests (see CLAUDE.md "How to run the tests")...
# open a PR into master, review, merge  → Netlify auto-deploys master
```

## What is (and isn't) published

Config lives in [`netlify.toml`](../netlify.toml) at the repo root.

- **Published:** `index.html` **plus the optional sim verifier's assets** — `sim/sim.wasm`,
  `sim/wasm_exec.js`, `sim/duel-worker.js`, `sim/simreq.mjs`, `sim/planspec.mjs`,
  `sim/benchmark.mjs`, `sim/model-ref-request.json` and `tools/genapl-core.mjs`. The build copies exactly those into
  `./dist` and Netlify serves `./dist` (see `netlify.toml` for the current command).
  - `tools/genapl-core.mjs` deliberately keeps its repo-relative path in `dist/` so the page's
    `import("./tools/genapl-core.mjs")` resolves identically locally and deployed. It is the SAME
    module the terminal sim harness drives — that is the point (`sim/README.md`).
  - The sim assets are fetched **lazily, on first press of "Check in the benchmark sim"**. A visitor who never
    presses it downloads `index.html` and nothing more, so the tool's cold-start cost is unchanged.
  - `sim/sim.wasm` is ~22 MB and needs `Content-Type: application/wasm` (set in `netlify.toml`) or
    `WebAssembly.instantiateStreaming` refuses it; Netlify compresses it to ~4 MB on the wire and it
    is served `immutable`.
  - **The wasm is committed, not built at deploy time** — the bytes users run are the audited bytes,
    and a deploy can't break because upstream moved. Rebuild with `bash sim/build-wasm.sh`.
- **NOT published:** `docs/`, `tools/`, `tests/`, `README.md`, `CLAUDE.md`. They stay
  in the repo but are never served — they're internal dev notes, not for public
  browsing. (If you add a new file that *should* be public, it must be copied into
  `dist/` by the build command — adding it to the repo root is not enough.)

`index.html` stays at the repo root (the tests load `../index.html`); `dist/` is a
throwaway build artifact and is git-ignored.

## Response headers

`netlify.toml` sets defense-in-depth headers on every response: `X-Content-Type-Options:
nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy: no-referrer`, and a locked-down
`Permissions-Policy`. These are hygiene — the page loads zero external resources and
stores no data.

**No `Content-Security-Policy` is set, on purpose.** The optimizer runs in a Web
Worker the app builds from an inline **Blob URL**; a strict CSP would block that and
break the tool, and there's no external network surface to protect. If a CSP is ever
added, it must be tested against the worker path first (it needs at least
`worker-src blob:` and `script-src 'unsafe-inline' blob:`).

## Anonymity (a project requirement)

The live site must not identify the author (see CLAUDE.md "Working conventions"):

- **No identity in `index.html`** — no real name, email, username, repo name, session
  id, or model id. The user's Discord handle is the only acceptable attribution. Scan
  before shipping.
- **Neutral Netlify site name** — the URL is `<site-name>.netlify.app`; pick a neutral
  `<site-name>` (e.g. `arcane-burn-planner`) so the URL carries no handle.
- **The GitHub repo can stay private** — Netlify still deploys it, and visitors only
  ever see the Netlify URL. The GitHub username is never exposed to site visitors.

## First-time Netlify setup (done once, in the Netlify dashboard)

1. **Add new site → Import an existing project → Deploy with GitHub**, pick this repo.
2. Settings auto-fill from `netlify.toml`: branch `master`, build
   `mkdir -p dist && cp index.html dist/index.html`, publish `dist`. Confirm and **Deploy**.
3. **Site configuration → Change site name** → a neutral name.

## Rollback

Netlify keeps a deploy history per commit. To revert the live site, open **Deploys** in
the Netlify dashboard and **Publish** a previous deploy — or push a revert commit to
`master` (which redeploys forward). Both work; the dashboard rollback is instant.

## Local preview

No server needed — just open `index.html` in a browser (that's the whole app). To
preview exactly what Netlify serves, run the build command and open `dist/index.html`.
