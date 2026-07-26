#!/bin/bash
# Round driver (1 of 3): drive a whole 36-table cross-val round unattended, class half then boss half.
#
#   bash tools/xval-round-pipeline.sh          # resumable — re-runs only what is missing
#
# Shape of a round, and why the two halves are sequenced rather than merged: the class half is
# solve-and-sim bound and runs 3-wide; the boss half is SIM-bound only, because
# `xval-boss-presolve.sh` (driver 2 of 3) banks the expensive solves in parallel with the class half.
# So this waits for that pre-solve pass to finish before starting the boss campaign at 4-wide.
# Meanwhile `xval-boss-warm.sh` (driver 3 of 3) warms boss sim caches on the freed core.
#
# ⚠ RESUMABILITY IS THE WHOLE DESIGN. `SKIP_EXISTING=1` means an interrupted round is restarted with
# this same command, not repaired by hand. Completed *tables* survive in git; `.xval-cache/` does not
# (gitignored), so a reclaimed container re-solves and re-sims whatever had not finished.
#
# ⚠ THE PROMOTION BUG THIS HEADER RECORDS. This script ran from `/tmp` for a whole 50-CPU-hour round
# before being promoted, and the promoted copy still carried BOTH of its scratchpad-isms:
#   · a hardcoded `SP=/tmp/claude-0/.../<session uuid>/scratchpad` (dead in any later session), and
#   · a wait-loop matching the process name `boss-solves.sh` — the /tmp FILENAME. The repo's copy is
#     `xval-boss-presolve.sh`, so the promoted pipeline waited for a process that could never appear,
#     fell straight through, and would have started the boss campaign before ANY pre-solve was banked.
# Promoting a driver makes it durable; it does not make it reproducible. Both are fixed below, and
# the wait is now bounded so a name drift can never silently skip the barrier again.
set -u
REPO=${REPO:-/home/user/Kory123}
cd "$REPO"
ITER=${ITER:-6000}
CLASS_JOBS=${CLASS_JOBS:-3}
BOSS_JOBS=${BOSS_JOBS:-4}
PRESOLVE_PAT=${PRESOLVE_PAT:-xval-boss-presolve.sh}
WAIT_MAX=${WAIT_MAX:-14400}

echo "=== CLASS PHASE (SKIP_EXISTING) $(date +%H:%M) ==="
SKIP_EXISTING=1 WHAT=class ITER="$ITER" JOBS="$CLASS_JOBS" bash tools/xval-bench-campaign.sh
echo "class rc=$? $(date +%H:%M)"

# Barrier: the boss campaign is only sim-bound if the pre-solves are banked. Note the [x] bracket —
# a bare pattern matches the grep itself. If the pre-solve pass was never started, this falls through
# immediately and says so, rather than pretending it waited.
#
# ⚠ This match is by COMMAND-LINE SUBSTRING, so any process merely *mentioning* the script name — a
# `bash -c` wrapper, an agent harness's `eval` line, an editor — counts as "still running". Measured
# while controlling this barrier both directions on 07-26: a sibling shell holding the string in its
# argv produced a false positive that outlived the process it was testing.
# That direction is the SAFE one and is why it is left alone: a false positive makes the barrier wait
# longer than necessary, bounded by WAIT_MAX. The direction that costs a round is the false NEGATIVE
# — skipping the barrier and starting the boss campaign with no solves banked — which is exactly what
# the /tmp name drift caused. Keep any future change to this check biased the same way.
echo "=== waiting for boss pre-solves ($PRESOLVE_PAT) $(date +%H:%M) ==="
pat="[${PRESOLVE_PAT:0:1}]${PRESOLVE_PAT:1}"
if ! ps -eo cmd --no-headers | grep -q "$pat"; then
  echo "NOTE: no $PRESOLVE_PAT running — either it already finished, or it was never started."
fi
waited=0
while ps -eo cmd --no-headers | grep -q "$pat"; do
  sleep 60; waited=$((waited + 60))
  if [ "$waited" -ge "$WAIT_MAX" ]; then
    echo "WARN: pre-solves still running after ${WAIT_MAX}s — starting the boss phase anyway" >&2; break
  fi
done

echo "=== BOSS PHASE $(date +%H:%M) ==="
SKIP_EXISTING=1 WHAT=boss ITER="$ITER" JOBS="$BOSS_JOBS" bash tools/xval-bench-campaign.sh
echo "boss rc=$? $(date +%H:%M)"
echo "ROUND-PIPELINE-DONE $(date +%H:%M) complete=$(grep -lE '^XVAL-DONE' tools/xval-results/*.txt 2>/dev/null | wc -l)/36"
