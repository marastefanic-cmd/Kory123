#!/bin/bash
# Wait for the boss half to reach 36 tables, then re-gather the 30 CLASS tables on the SAME engine so
# the round is protocol-uniform, then grade it.
#
#   setsid nohup env RUNNER=/path/to/runner bash tools/xval-finish-round.sh > /tmp/finish.log 2>&1 < /dev/null &
#
# WHY the class re-run: 30 class tables were gathered on the wasm and the boss half on the native
# runner (PHASE10 §8.26). `tools/xval-stamp-audit.mjs` requires ONE protocol across a round and checks
# `engine`, so a mixed round is a hard failure — correctly. Proving the two engines bit-identical
# licenses choosing one for a whole round; it does not license mixing them inside one.
# ⚠ Content is provably unchanged (§8.26 re-ran a completed class table and got a bit-identical
# matrix); this re-run buys the uniform STAMP, honestly, rather than editing one by hand.
set -u
REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO"
: "${RUNNER:?set RUNNER=/path/to/runner-ap180 — the point is to match the boss half's engine}"
[ -x "$RUNNER" ] || { echo "RUNNER=$RUNNER is not executable"; exit 2; }

echo "$(date +%H:%M) waiting for the boss half to reach 36 tables…"
while [ "$(grep -l '^XVAL-DONE' tools/xval-results/*.txt 2>/dev/null | wc -l)" -lt 36 ]; do sleep 120; done
echo "$(date +%H:%M) 36/36 reached — re-gathering the 30 class tables on $(basename "$RUNNER")"

# NO SKIP_EXISTING: they must be re-emitted so their stamp changes. The watchdog is told to stand down
# first, or it will see "no campaign" during the handover and start a competing boss run.
rm -f /tmp/xval-watchdog.lock
for p in $(pgrep -f 'xval-watchdog' 2>/dev/null); do kill "$p" 2>/dev/null || true; done
sleep 5
WHAT=class ITER=6000 JOBS=4 bash tools/xval-bench-campaign.sh
echo "$(date +%H:%M) class re-gather done — grading"
OUT=/tmp/grade bash tools/xval-grade.sh
echo "GRADE-EXIT=$?"
