#!/bin/bash
# Commit and push completed cross-val tables while a campaign is still running.
#
#   bash tools/xval-checkpoint.sh [interval_seconds] [max_minutes]
#
# WHY: a round is hours of compute and the container is ephemeral. `tools/xval-rerun.sh` learned this
# the hard way on gear A and grew the same behaviour ("detached, commits + pushes each batch itself,
# so the round lands in git with or without a live session"). This is that, for the bench driver.
#
# It only ever adds `tools/xval-results/*.txt`, so it cannot pick up unrelated work in progress, and
# it skips a table that has no `XVAL-DONE` line — a half-written file is not a result.
# ⚠ A push that quietly fails is the failure this replaces: `git push … || true` once let a
# "durable checkpoint" never reach the remote. Retried with backoff, then LOUD.
set -u
REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO"
INTERVAL=${1:-900}
MAXMIN=${2:-720}
BRANCH=$(git rev-parse --abbrev-ref HEAD)
deadline=$(( $(date +%s) + MAXMIN * 60 ))

while [ "$(date +%s)" -lt "$deadline" ]; do
  sleep "$INTERVAL"
  # Only complete tables. `git add` on a file being written would commit a truncated matrix.
  complete=$(grep -l "^XVAL-DONE" tools/xval-results/*.txt 2>/dev/null || true)
  [ -n "$complete" ] || continue
  # shellcheck disable=SC2086
  git add $complete
  git diff --cached --quiet && continue          # nothing new since the last checkpoint
  n=$(echo "$complete" | wc -l)
  git commit -q -m "xval round 1 (gear B): checkpoint — $n table(s) complete

Committed by tools/xval-checkpoint.sh while the campaign runs, so hours of
compute survive a container reclaim. Not a verdict: a round is 36 tables and
neither xval-collect.mjs nor xval-verify.mjs can know that a partial directory
is partial (tools/xval-results/README.md).

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_012PoTRfPexqEuFSKeDoGN4j" || continue
  ok=""
  for i in 1 2 3 4; do
    if git push -q -u origin "$BRANCH" 2>/dev/null; then ok=1; break; fi
    sleep $((2 ** i))
  done
  if [ -n "$ok" ]; then echo "CHECKPOINT $(date +%H:%M) — $n tables committed and pushed"
  else echo "⚠ CHECKPOINT $(date +%H:%M) — $n tables COMMITTED BUT PUSH FAILED after 4 tries"; fi
done
echo "CHECKPOINT-END $(date +%H:%M)"
