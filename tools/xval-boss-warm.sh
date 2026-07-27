#!/bin/bash
# Round driver (3 of 3): warm the boss SIM caches on the core the pre-solve pass just freed.
#
# Ordering, and why it exists: `xval-boss-presolve.sh` banks the expensive non-sim half (a KT solve is
# ~280 s × 11 hastes × 2 tables). When it ends, that core would otherwise sit idle while the class
# campaign finishes on the other three — so this keeps it busy pre-warming the boss sim caches
# cheapest-first, which is also the order that makes the most tables ready soonest if it is interrupted.
#
# ⚠ THE CACHES ARE NOT DURABLE. `.xval-cache/` is gitignored, so a reclaimed container re-solves and
# re-sims whatever this had banked. Completed *tables* survive in git; warmed caches do not.
#
# ⚠ REPRODUCIBILITY, THE BUG THIS HEADER EXISTS TO RECORD. This script and its two siblings were
# written in a session scratchpad and ran from `/tmp` for a whole 50-CPU-hour round before being
# promoted. The promoted copy carried a HARDCODED scratchpad path (`SP=/tmp/claude-0/.../<session
# uuid>/scratchpad`), so in any *later* session the wait-loop below polled a log that would never be
# created and the script hung forever. Promoting a driver into the repo makes it DURABLE; it does not
# make it REPRODUCIBLE. `WAIT_LOG` is overridable and the wait now also ends when the pre-solve
# PROCESS is gone, so a missing log can no longer wedge it.
set -u
REPO=${REPO:-/home/user/Kory123}
cd "$REPO"
# Where xval-boss-presolve.sh's output is being teed, if anywhere. Default to the current session's
# scratchpad when the harness exports one; otherwise the process check below carries the wait alone.
WAIT_LOG=${WAIT_LOG:-${SP:-/nonexistent}/boss-solves.log}
WAIT_MAX=${WAIT_MAX:-7200}          # hard ceiling (s) so this can never wedge a round

waited=0
while :; do
  grep -q "BOSS-SOLVES-DONE\|^EXIT=" "$WAIT_LOG" 2>/dev/null && { echo "pre-solves done (log marker)"; break; }
  # The log is optional; the process is authoritative. Note the [b] bracket — a bare pattern matches
  # the grep itself. (Related trap, PHASE10 §8.17: never `pkill -f` from an interactive shell.)
  if ! ps -eo cmd --no-headers | grep -q "[x]val-boss-presolve.sh"; then
    echo "pre-solves done (process gone)"; break
  fi
  sleep 60; waited=$((waited + 60))
  if [ "$waited" -ge "$WAIT_MAX" ]; then
    echo "WARN: waited ${WAIT_MAX}s for the pre-solve pass; proceeding anyway" >&2; break
  fi
done

echo "warming boss sim caches on the freed core $(date +%H:%M)"
hs() { python3 -c "import json,sys;d=json.load(open('tools/xval-haste-sets.json'));print(','.join(map(str,d[sys.argv[1]])))" "$1"; }
# Cheapest first (no AoE), so the most tables are ready soonest if this gets interrupted.
for spec in "Lady Vashj|mqg,skull" "Lady Vashj|isc,scb" "Al'ar|mqg,skull" "Al'ar|isc,scb" "Kael'thas Sunstrider|mqg,skull" "Kael'thas Sunstrider|isc,scb"; do
  boss="${spec%%|*}"; kit="${spec##*|}"
  # Seed derived from boss+kit so a re-run warms the SAME cells (cksum is stable across machines).
  seed=$(( 5000 + $(echo "$boss$kit" | cksum | cut -d' ' -f1) % 4000 ))
  echo "== warming $boss / $kit (seed $seed) $(date +%H:%M)"
  KIT="$kit" HASTES="$(hs "$kit")" BOSS="$boss" ITER=6000 SHARD=0/1 \
    nice -n 12 node tools/xval-bench.mjs "$seed" 2>&1 | grep -E "SHARD-DONE|ERROR"
done
echo "BOSS-WARM-DONE $(date +%H:%M)"
