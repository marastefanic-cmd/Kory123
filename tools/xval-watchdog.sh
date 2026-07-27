#!/bin/bash
# Keep a cross-val round alive across session boundaries.
#
#   setsid nohup bash tools/xval-watchdog.sh boss > /tmp/watchdog.log 2>&1 < /dev/null &
#
# ── WHY THIS EXISTS (07-26, and it cost ~10 hours) ────────────────────────────────────────────────
# The round was launched with `nohup … &` from an agent shell. That is NOT enough: the process stayed
# in the session's process group, so when the session's shell went away the whole campaign went with
# it — mid-shard, at 18:59 — and the CHECKPOINT LOOP died alongside it. Nothing was watching, because
# the only liveness signal anyone had was "tables are appearing", and tables appearing slowly is
# indistinguishable from tables not appearing at all when a boss cell legitimately takes an hour.
# The stall was found ~10 hours later, by a human asking an unrelated question.
#
# Two fixes, and this file is the second:
#   1. `setsid` — detach into a new session so the campaign outlives the shell that started it.
#   2. this watchdog — because (1) only helps if nothing else kills it, and a silent stall is
#      indistinguishable from slow progress. It re-launches the campaign whenever no campaign is
#      running and the round is incomplete, and it says so in its log every time.
#
# It is SAFE to run alongside a live campaign: `run_cell`'s writer lock (added the same day) makes a
# duplicate refuse the cell rather than truncate its output file, and `SKIP_EXISTING=1` means a
# relaunch only ever picks up what is missing.
set -u
REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO"
WHAT=${1:-all}
NEED=${NEED:-36}
INTERVAL=${INTERVAL:-120}
export ITER=${ITER:-6000}
JOBS=${JOBS:-4}

while true; do
  n=$(grep -l "^XVAL-DONE" tools/xval-results/*.txt 2>/dev/null | wc -l)
  if [ "$n" -ge "$NEED" ]; then
    echo "$(date +%H:%M) ROUND COMPLETE — $n/$NEED tables. Watchdog exiting."
    exit 0
  fi
  if ! pgrep -f "xval-bench-campaign.sh" > /dev/null 2>&1; then
    echo "$(date +%H:%M) ⚠ no campaign running and only $n/$NEED tables — relaunching (WHAT=$WHAT)"
    setsid nohup env WHAT="$WHAT" ITER="$ITER" JOBS="$JOBS" SKIP_EXISTING=1 \
      bash "$REPO/tools/xval-bench-campaign.sh" >> /tmp/xval-campaign-restart.log 2>&1 < /dev/null &
    sleep 30
  fi
  # The checkpoint loop is the round's durability; it died with the campaign last time.
  if ! pgrep -f "xval-checkpoint.sh" > /dev/null 2>&1; then
    echo "$(date +%H:%M) ⚠ checkpoint loop is not running — relaunching"
    setsid nohup bash "$REPO/tools/xval-checkpoint.sh" 900 720 >> /tmp/xval-checkpoint-restart.log 2>&1 < /dev/null &
  fi
  sleep "$INTERVAL"
done
