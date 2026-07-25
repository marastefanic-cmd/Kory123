#!/bin/bash
# Phase-6 campaign: all six trinket kits × five fight-length classes, max 2 kits concurrent (keeps
# 2 chromium + 2 runners on a 4-core box without OOM/thrash). Full matrices tee to $XVDIR; summary
# lines to the campaign log. Kits run their own breakpoint haste sets (tools/xval-haste-sets.json).
#
# Exit-code contract (shared with tools/xval.mjs): 0 = every kit completed all five classes ·
# 2 = at least one kit did not.  A `diag=DEFICIT` is an observation, not a failure (see xval-kit.sh).
set -u
REPO=/home/user/Kory123
# Overridable (as in xval-boss.sh) so a subset can be re-run without editing the file.
KITS=${KITS:-"mqg,skull isc,scb isc,skull isc,mqg scb,skull scb,mqg"}
MAXJOBS=${MAXJOBS:-2}
export ITER=${ITER:-6000}
launched=0; reaped=0; nfail=0
# `wait -n` returns the finishing job's exit status, so reap through a helper that COUNTS failures.
# The old loop threw that status away and ended on a bare `wait`, then printed CAMPAIGN-DONE with
# status 0 no matter how many kits had died — the same false pass as xval-kit.sh, one level up.
# Reaping exactly `launched` times (rather than draining on `jobs -rp`, which only lists RUNNING
# jobs) guarantees every child's status is actually observed.
reap() { if wait -n; then :; else nfail=$((nfail+1)); fi; reaped=$((reaped+1)); }
for KIT in $KITS; do
  while [ $((launched - reaped)) -ge "$MAXJOBS" ]; do reap; done
  echo "== launching kit $KIT =="
  bash "$REPO/tools/xval-kit.sh" "$KIT" &
  launched=$((launched+1))
done
while [ "$reaped" -lt "$launched" ]; do reap; done
if [ "$nfail" -gt 0 ]; then
  echo "CAMPAIGN-INCOMPLETE kits=$launched failed=$nfail — the failing kits printed KIT-INCOMPLETE above"; exit 2
fi
echo "CAMPAIGN-DONE kits=$launched failed=0"
