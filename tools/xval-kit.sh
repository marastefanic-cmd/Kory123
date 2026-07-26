#!/bin/bash
# ╔══════════════════════════════════════════════════════════════════════════════════════════════╗
# ║ ⚠ REPRODUCTION-ONLY — THIS IS A GEAR-A INSTRUMENT. DO NOT GATHER A NEW ROUND WITH IT.        ║
# ╚══════════════════════════════════════════════════════════════════════════════════════════════╝
#
# This tool belongs to the pre-2026-07-26 rig and is kept so the ARCHIVED gear-A corpus
# (`tools/xval-results-archive/gearA-pre-20260726/`) stays reproducible. It is NOT the current
# instrument, and a table it produces must never be compared to, pooled with, or diffed against a
# gear-B table (BENCH §1 — B2's sim preference moved ~0.39 pp AND CHANGED SIGN across the two).
#
# What replaced it, and why the replacement is not a like-for-like swap:
#   · CURRENT DRIVER   `tools/xval-bench.mjs` + `tools/xval-bench-campaign.sh` (proven equivalent to
#                      `tools/xval.mjs`, PHASE10 §8.9), driven by `tools/xval-round-pipeline.sh`.
#   · ENGINE           the committed `sim/sim.wasm` — no clone, no protoc, no `go build`, and no
#                      `RUNNER`/`EXPORT_BASE` to resolve out of a session scratchpad that may be gone.
#   · CHARACTER        `tools/bench/export.json`, committed and frozen — not a private export.
#   · PROTOCOL         `--var 0.5` by measurement (`tools/var-decision.mjs`), difference-in-differences
#                      against a never-press control, and every reading STAMPED (`char=`, `emit=`,
#                      `iter=`, `seeds=`, `wasm=`) so a later reader can classify it without trusting
#                      a directory name.
#
# ⚠ It also predates `sim/planspec.mjs`'s `REQUIRES_EQUIPPED` guard, so it will happily schedule a
# press of an UNWORN trinket — a bit-identical no-op in wowsims that reads as a small honest number
# rather than an error (PHASE12 §2.1). That is the single most likely way an old table lies.
#
# If you are here to gather data: stop, and use the current driver. If you are here to reproduce an
# archived table: carry on, and read that directory's README first.
# Phase-6 campaign driver: run the haste-adaptation cross-val for ONE trinket kit across all five
# fight-length classes, using that kit's breakpoint-straddle haste set. Full matrices are teed to
# $XVDIR/<kit>-<class>.txt; a one-line summary per class is printed (that's what an agent reports).
#   bash tools/xval-kit.sh mqg,skull
#
# Exit-code contract (shared with tools/xval.mjs): 0 = every class produced a matrix · 2 = at least
# one did not.  Exit 1 is unused ON PURPOSE: `diag=DEFICIT` is an OBSERVATION, not a failure — xval.mjs
# is a data-gathering pass that draws no conclusions — so deficits are counted into the banner but
# never change the exit status.
set -u
if [ "$#" -lt 1 ] || [ -z "${1:-}" ]; then
  echo "ERROR: usage: bash tools/xval-kit.sh <kit>   (e.g. mqg,skull)" >&2; exit 2
fi
KIT="$1"
source "$(dirname "${BASH_SOURCE[0]}")/xval-env.sh"   # REPO/SP/CHROMIUM/RUNNER/EXPORT_BASE + preflight
xval_preflight
# ★★★ P7.15 transcription convention — see the block in tools/xval-boss.sh. `fire` (default) sims the
# plan the tool PRINTS; `intent` reproduces pre-07-25 rounds. Stamped on every XVAL-DONE line.
export EMIT=${EMIT:-fire}
XVDIR=${XVDIR:-$SP/xvcamp}; mkdir -p "$XVDIR"
# This lookup used to run UNCHECKED.  A kit missing from the JSON raises KeyError, python3 exits
# non-zero, and `$(...)` swallows that into HASTES="" — which the old xval.mjs read as "unset" and
# silently graded on the COARSE 0/100/200/300/400 default, missing every breakpoint this kit exists
# to straddle.  xval.mjs now rejects HASTES="", but catch it HERE too so the error names the kit.
if ! HASTES=$(python3 -c "import json,sys;d=json.load(open(sys.argv[1]));print(','.join(map(str,d[sys.argv[2]])))" "$REPO/tools/xval-haste-sets.json" "$KIT" 2>&1); then
  echo "ERROR: no haste set for kit \"$KIT\" in tools/xval-haste-sets.json" >&2
  echo "  python3 said: $HASTES" >&2
  exit 2
fi
if [ -z "$HASTES" ]; then
  echo "ERROR: haste set for kit \"$KIT\" is EMPTY — refusing to fall back to the coarse default grid." >&2; exit 2
fi
KTAG=$(echo "$KIT" | tr ',' '-')
i=0; nok=0; ndef=0; nfail=0
for cls in short medium medlong long xl; do
  seed=$(( 1000 + $(echo "$KIT" | cksum | cut -d' ' -f1) % 9000 + i ))
  out="$XVDIR/${KTAG}-${cls}.txt"
  KIT="$KIT" TCLASS="$cls" HASTES="$HASTES" SCRATCH="$SP/xv-${KTAG}-${cls}" \
    node "$REPO/tools/xval.mjs" "$seed" > "$out" 2>&1
  rc=$?
  # Detection used to be grep-only and the exit code was consulted NOWHERE — so a class that could
  # not be graded still let the unconditional `KIT-DONE` banner print with status 0, and a caller
  # (xval-campaign.sh, or an agent reading the log) saw a completed kit.  Grade on rc AND the line.
  line=$(grep -E "^XVAL-DONE" "$out" | tail -1)
  if [ "$rc" -ne 0 ] || [ -z "$line" ]; then
    nfail=$((nfail+1))
    echo "XVAL-FAIL ${KTAG}-${cls} rc=$rc (see $out)"
    tail -3 "$out" >&2
  else
    echo "$line"
    case "$line" in *diag=DEFICIT*) ndef=$((ndef+1)) ;; *) nok=$((nok+1)) ;; esac
  fi
  i=$((i+1))
done
if [ "$nfail" -gt 0 ]; then
  echo "KIT-INCOMPLETE $KTAG clean=$nok deficit=$ndef failed=$nfail"; exit 2
fi
echo "KIT-DONE $KTAG clean=$nok deficit=$ndef failed=0"
