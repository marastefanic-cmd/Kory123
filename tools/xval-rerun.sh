#!/bin/bash
# PHASE 7 acceptance re-run driver: the full campaign (6 kits × 5 classes) + the boss set, on the
# recalibrated engine and the model-matched metric (VAR=0.5 default; WJITTER=2 on boss tables; AoE
# valued). After each kit/boss batch completes, its tables are copied into tools/xval-results/ and
# committed+pushed — durable checkpoints, restart-safe (already-committed tables are skipped unless
# FORCE=1).
#   bash tools/xval-rerun.sh
#
# Exit-code contract (shared with tools/xval.mjs): 0 = every kit and the boss set completed AND every
# checkpoint reached the remote · 2 = something did not.  A `diag=DEFICIT` is an observation, not a
# failure (see xval-kit.sh) — this driver gathers data, it does not grade the model.
set -u
REPO=/home/user/Kory123
SP=/tmp/claude-0/-home-user-Kory123/e436da46-89c3-50bc-bce2-5b6be890f704/scratchpad
export CHROMIUM=${CHROMIUM:-/opt/pw-browsers/chromium}
export RUNNER=${RUNNER:-$SP/wowsims/runner-ap180}
export EXPORT_BASE=${EXPORT_BASE:-$SP/arcane-wowsims-import.json}
export ITER=${ITER:-6000}
export XVDIR=${XVDIR:-$SP/xvcamp7}
BRANCH=${BRANCH:-claude/wow-arcane-cooldown-optimizer-vbm3as}
mkdir -p "$XVDIR"
RES=$REPO/tools/xval-results
mkdir -p "$RES"
NFAIL=0

ckpt () {  # copy any new/changed tables into the repo and commit+push
  local changed=0
  for f in "$XVDIR"/*.txt; do
    [ -e "$f" ] || continue
    if ! cmp -s "$f" "$RES/$(basename "$f")" 2>/dev/null; then
      if cp "$f" "$RES/"; then changed=1; else echo "ERROR: could not copy $f into $RES" >&2; NFAIL=$((NFAIL+1)); fi
    fi
  done
  [ "$changed" = 1 ] || return 0
  git -C "$REPO" add tools/xval-results || { echo "ERROR: git add failed ($1)" >&2; NFAIL=$((NFAIL+1)); return 0; }
  # `commit || true` swallowed a real commit failure along with the benign "nothing to commit", so
  # ask FIRST whether anything is staged and then REQUIRE the commit to succeed.
  if git -C "$REPO" diff --cached --quiet -- tools/xval-results; then
    echo "   ckpt($1): nothing new to commit"
  elif ! git -C "$REPO" commit -q -m "xval-results: PHASE7 re-run checkpoint ($1)"; then
    echo "ERROR: git commit failed ($1) — tables are in $RES but NOT committed" >&2; NFAIL=$((NFAIL+1)); return 0
  fi
  # ★ The one that mattered most: `push || true` meant a checkpoint could fail to reach the remote
  # and this driver still called it "durable".  The scratchpad is ephemeral and these tables are the
  # acceptance evidence, so a push that does not land must be LOUD.  Retry per the git convention.
  local d=2 i
  for i in 1 2 3 4 5; do
    if git -C "$REPO" push -q -u origin "$BRANCH"; then return 0; fi
    [ "$i" = 5 ] && break
    echo "   ckpt($1): push failed, retrying in ${d}s ($i/4)" >&2; sleep "$d"; d=$((d*2))
  done
  echo "ERROR: git push failed after 5 attempts ($1) — the checkpoint is COMMITTED LOCALLY ONLY, not durable" >&2
  NFAIL=$((NFAIL+1))
}

# kits run in PAIRS (2-concurrent, like the original campaign — keeps 2 chromium + runners busy on
# a 4-core box), checkpointing after each pair
for PAIR_ in "mqg,skull isc,scb" "isc,skull isc,mqg" "scb,skull scb,mqg"; do
  PIDS=""
  for KIT in $PAIR_; do
    KTAG=$(echo "$KIT" | tr ',' '-')
    # The skip probe used to check only the two ENDPOINT classes (short, xl). A kit whose middle
    # classes had failed therefore looked complete and was skipped forever, leaving the re-run
    # permanently short of three tables with nothing in the log saying so. Require all five.
    have=1
    for cls in short medium medlong long xl; do
      grep -q "var=0.5" "$RES/$KTAG-$cls.txt" 2>/dev/null || { have=0; break; }
    done
    if [ "${FORCE:-0}" != 1 ] && [ "$have" = 1 ]; then
      echo "== kit $KIT already re-run (all five var=0.5 tables present) — skipping"; continue
    fi
    echo "== launching kit $KIT =="
    bash "$REPO/tools/xval-kit.sh" "$KIT" &
    PIDS="$PIDS $!"
  done
  # `wait $PIDS` returns the status of the LAST pid ONLY — a first kit that died was invisible, and
  # the status was not consulted anyway.  Wait on each pid separately and count.
  for p in $PIDS; do
    if ! wait "$p"; then echo "ERROR: a kit in pair [$PAIR_] failed (pid $p) — see its KIT-INCOMPLETE line above" >&2; NFAIL=$((NFAIL+1)); fi
  done
  ckpt "$(echo "$PAIR_" | tr ' ,' '--')"
done
echo "== bosses =="
if ! bash "$REPO/tools/xval-boss.sh"; then
  echo "ERROR: the boss set did not complete — see its BOSS-INCOMPLETE line above" >&2; NFAIL=$((NFAIL+1))
fi
ckpt bosses
if [ "$NFAIL" -gt 0 ]; then
  echo "RERUN-INCOMPLETE failures=$NFAIL — the tables below are PARTIAL; do not read an acceptance verdict off them"
  node "$REPO/tools/xval-collect.mjs" "$RES"
  exit 2
fi
echo "RERUN-DONE failures=0"
node "$REPO/tools/xval-collect.mjs" "$RES"
