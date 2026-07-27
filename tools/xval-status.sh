set -u
cd /home/user/Kory123
echo "== processes (excluding this script) =="
ps -eo pid,cmd --no-headers | grep -vE "status\.sh|grep" | grep -E "xval-bench|boss-solves|chain|checkpoint|xargs" | sed 's/\(.\{78\}\).*/\1/' || echo "  (none)"
echo "== tables =="
echo "  complete: $(grep -lE '^XVAL-DONE' tools/xval-results/*.txt 2>/dev/null | wc -l) / 36"
echo "  partial : $(for f in tools/xval-results/*.txt; do grep -q '^XVAL-DONE' "$f" 2>/dev/null || echo x; done | wc -l)"
echo "== cache =="
echo "  plans: $(ls .xval-cache 2>/dev/null | grep -c '^plan-')   sims: $(ls .xval-cache 2>/dev/null | grep -c '^dps-')"

# ── PROGRESS THAT CAN ACTUALLY MOVE ──────────────────────────────────────────────────────────────
# ⚠ "tables complete" is BLIND through the boss half: the campaign runs the entire 24-job shard
# pre-pass before emitting a single table, so the count sits still for ~90 minutes and then jumps.
# A progress signal that cannot move during the work it reports on is not a progress signal —
# PHASE10 §8.21's own lesson, so the live signals are cache growth and shard completions.
echo "== boss pre-pass =="
LOG=/tmp/xval-campaign-restart.log
if [ -f "$LOG" ]; then
  echo "  shard jobs done: $(grep -c 'SHARD-DONE' "$LOG")/24"
  echo "  cells touched  : $(grep 'SHARD-DONE' "$LOG" | sed 's/.*seed=\([0-9]*\).*/\1/' | sort -u | tr '\n' ' ')"
fi
# ⚠ Take the argument AFTER `xval-bench.mjs`, and require it to be digits — NOT `$NF`.
# `$NF` was the last word of the whole command line, so any wrapper that merely MENTIONS the driver
# (an agent shell, a `bash -c cd <dir> && …`) contributed its own last word as a phantom "cell".
# Observed live: `in flight : /tmp/claude-b341-cwd 5043`. A status tool that invents a cell is the
# same family as `pgrep -fc` counting its own caller — read the field you mean, not the last one.
echo "  in flight      : $(ps -eo cmd | grep '[x]val-bench.mjs' \
  | awk '{for (i = 1; i < NF; i++) if ($i ~ /xval-bench\.mjs$/ && $(i+1) ~ /^[0-9]+$/) { print $(i+1); break }}' \
  | sort -u | tr '\n' ' ')"
a=$(ls /home/user/Kory123/.xval-cache 2>/dev/null | wc -l); sleep 20
b=$(ls /home/user/Kory123/.xval-cache 2>/dev/null | wc -l)
echo "  sim rate       : $(( (b-a)*3 ))/min   (cache $a -> $b over 20s)"
[ "$((b-a))" -eq 0 ] && echo "  ⚠ ZERO sims in 20s — either every cell is a cache hit, or nothing is running"
