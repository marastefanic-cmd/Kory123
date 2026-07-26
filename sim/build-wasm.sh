#!/usr/bin/env bash
# Rebuild sim/sim.wasm — the wowsims engine the in-page "Check in the benchmark sim" button runs.
#
# The artifact is COMMITTED (≈22 MB, ≈4 MB over the wire once Netlify compresses it) rather than
# built at deploy time, deliberately: the bytes users run are then the exact bytes that were audited
# here, and a deploy can never break because upstream moved. Rebuild only when a patch, the pinned
# commit, or the Go toolchain changes — then re-run tests/sim-duel.mjs with RUNNER set, which is what
# proves the shipped wasm still equals the native rig.
#
# Usage:  bash sim/build-wasm.sh [workdir]        (default workdir: a temp dir)
set -euo pipefail

REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
WORK="${1:-$(mktemp -d)}"
PIN=ade9f39cc                       # wowsims/tbc-new — see docs/TOOLING.md "Building the runner"
SRC="$WORK/tbc-new"

echo "── clone (pinned) ────────────────────────────────────────────"
# ⚠ THE REPO IS wowsims/tbc-new, NOT wowsims/tbc. tbc-new declares Go module github.com/wowsims/tbc,
# so inferring the URL from the imports leads to the archived pre-APL repo, which has neither the
# pinned commit nor either patch target. Read it, don't derive it (TOOLING).
[ -d "$SRC" ] || git clone --quiet https://github.com/wowsims/tbc-new.git "$SRC"
cd "$SRC"
git checkout --quiet "$PIN"

echo "── patches ───────────────────────────────────────────────────"
# ap-cd-at-cast: real TBC starts Arcane Power's 180s cooldown at CAST; upstream re-sets it at aura
#   END (cast+195). Without it the sim runs a 195s AP cadence and disagrees with the model on
#   every fight long enough for a second Arcane Power.
# apl-schedule-strict-ready: the schedule action consumed a timing while the queued off-GCD cast was
#   dropped, silently deleting presses from a scheduled plan (the "drop bug" — it once made a
#   terminal Icon look worth −4.2 DPS).
git apply -p0 "$REPO/tools/wowsims-patches/ap-cd-at-cast.patch"
git apply "$REPO/tools/wowsims-patches/apl-schedule-strict-ready.patch"

# Provenance gate — the patches must be present, and this is how you know a rebuilt artifact is the
# audited one rather than a stock wowsims build that will quietly disagree with the model.
[ "$(grep -c innerSpell sim/core/apl_actions_timing.go)" = "3" ] || { echo "FAIL: apl-schedule patch not applied"; exit 2; }
[ "$(grep -c 'CD.Use' sim/mage/arcane_power.go)" = "0" ]        || { echo "FAIL: ap-cd patch not applied"; exit 2; }

echo "── protobufs (generated, not committed upstream) ─────────────"
# Match the plugin to the repo's google.golang.org/protobuf version (v1.36.10 at this pin) — an older
# plugin emits code the newer runtime rejects.
command -v protoc >/dev/null || { echo "need protoc (apt-get install -y protobuf-compiler)"; exit 2; }
command -v protoc-gen-go >/dev/null || GOBIN=/usr/local/bin go install google.golang.org/protobuf/cmd/protoc-gen-go@v1.36.10
protoc -I=./proto --go_out=./sim/core ./proto/*.proto

echo "── build wasm ────────────────────────────────────────────────"
# sim/wasm/main.go is UPSTREAM's own entry point (it is how wowsims.github.io runs in a browser); we
# only use its raidSimJson(requestJSON) export. -tags with_db embeds assets/database/*.bin, so the
# artifact is self-contained — no item database to fetch at runtime.
GOOS=js GOARCH=wasm go build -tags with_db -o "$REPO/sim/sim.wasm" ./sim/wasm
cp "$(go env GOROOT)/lib/wasm/wasm_exec.js" "$REPO/sim/wasm_exec.js"   # MUST match the building toolchain

echo
echo "wrote $REPO/sim/sim.wasm  ($(du -h "$REPO/sim/sim.wasm" | cut -f1), go $(go env GOVERSION))"
echo "NEXT: RUNNER=/path/to/runner node tests/sim-duel.mjs   # asserts shipped wasm == native rig"
