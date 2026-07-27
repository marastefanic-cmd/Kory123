#!/usr/bin/env bash
# BUILD THE NATIVE wowsims RUNNER — the rig every `RUNNER=…` gate in this repo wants.
#
#   bash tools/build-runner.sh                # builds into /tmp/wowsims-build (the repo's convention)
#   WORK=~/wowsims bash tools/build-runner.sh  # anywhere else
#
# Then:  RUNNER=$WORK/tbc-new/runner-ap180 node tests/sim-request.mjs
#
# ── WHY THIS FILE EXISTS ─────────────────────────────────────────────────────────────────────────
# Fourteen tools default `RUNNER` to `/tmp/wowsims-build/tbc-new/runner-ap180`. That path was a
# CONVENTION carried only in a session scratch script — so it worked on exactly one machine, and on
# every other one those tools silently took their no-runner branch. Committing the script that
# creates the path is what turns the default from a machine fact into a reproducible one.
#
# ⚠ You do NOT need this for the shipped wasm. `tools/bench.mjs`, `tests/sim-duel.mjs` and the
# website's button all run the committed `sim/sim.wasm` with zero setup — see CLAUDE.md's ★★ and
# `docs/BENCH.md` §5. The native runner buys two things the wasm cannot: `--dumpreq` (which is what
# `tests/sim-request.mjs` compares the page's request against) and `SIMLOG=1` combat logs (which is
# what `model-audit`, `window-span`, `credit-check` and `snapshot-rule` read cast by cast).
#
# ★★ THE PIN AND THE PATCHES ARE THE POINT. `ade9f39cc` of **wowsims/tbc-new** — the LIVE repo behind
# https://www.wowsims.com/tbc/, NOT the archived 2021 `wowsims/tbc`. It declares Go module
# `github.com/wowsims/tbc`, so deriving the URL from an import lands on the dead repo; read the URL,
# never derive it (CLAUDE.md ★, `bash tools/upstream-drift.sh`). Both patches are asserted below
# rather than assumed: an unpatched runner is a *plausible* runner that answers a different question,
# and this project has already lost an afternoon to one.
#
# Requires: git, go (1.21+), protoc.
set -euo pipefail

REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
WORK="${WORK:-/tmp/wowsims-build}"
PIN="${PIN:-ade9f39cc}"

for bin in git go protoc; do
  command -v "$bin" >/dev/null 2>&1 || { echo "FAIL: '$bin' is not on PATH — see docs/TOOLING.md 'Building the runner'"; exit 2; }
done

mkdir -p "$WORK"; cd "$WORK"
# ⚠ tbc-NEW. The archived repo builds and produces plausible, wrong numbers (it predates APLs).
[ -d tbc-new ] || git clone --quiet https://github.com/wowsims/tbc-new.git tbc-new
cd tbc-new
git checkout --quiet "$PIN"
git checkout --quiet -- . 2>/dev/null || true

echo "== patches =="
git apply -p0 "$REPO/tools/wowsims-patches/ap-cd-at-cast.patch"
git apply     "$REPO/tools/wowsims-patches/apl-schedule-strict-ready.patch"
# Assert, don't assume: `git apply` can succeed on the wrong file and a half-patched runner is the
# most expensive kind of "it ran".
[ "$(grep -c innerSpell sim/core/apl_actions_timing.go)" = "3" ] || { echo "FAIL: apl-schedule-strict-ready did not apply"; exit 2; }
[ "$(grep -c 'CD.Use' sim/mage/arcane_power.go)" = "0" ]         || { echo "FAIL: ap-cd-at-cast did not apply"; exit 2; }

echo "== protoc-gen-go =="
export PATH="$PATH:$(go env GOPATH)/bin"
go install google.golang.org/protobuf/cmd/protoc-gen-go@v1.36.10

echo "== protoc =="
protoc -I=./proto --go_out=./sim/core ./proto/*.proto

echo "== runner =="
mkdir -p cmd/runner && cp "$REPO/tools/wowsims-patches/runner-main.go" cmd/runner/main.go
go build -tags with_db -o runner-ap180 ./cmd/runner
go build -tags with_db -o wowsimcli    ./cmd/wowsimcli
ls -la runner-ap180 wowsimcli
echo
echo "BUILD-OK  →  RUNNER=$WORK/tbc-new/runner-ap180"
echo "Check it:     RUNNER=$WORK/tbc-new/runner-ap180 node tests/sim-request.mjs"
