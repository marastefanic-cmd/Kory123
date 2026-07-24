#!/bin/bash
# PHASE 7 acceptance re-run driver: the full campaign (6 kits × 5 classes) + the boss set, on the
# recalibrated engine and the model-matched metric (VAR=0.5 default; WJITTER=2 on boss tables; AoE
# valued). After each kit/boss batch completes, its tables are copied into tools/xval-results/ and
# committed+pushed — durable checkpoints, restart-safe (already-committed tables are skipped unless
# FORCE=1).
#   bash tools/xval-rerun.sh
set -u
REPO=/home/user/Kory123
SP=/tmp/claude-0/-home-user-Kory123/e436da46-89c3-50bc-bce2-5b6be890f704/scratchpad
export CHROMIUM=${CHROMIUM:-/opt/pw-browsers/chromium}
export RUNNER=${RUNNER:-$SP/wowsims/runner-ap180}
export EXPORT_BASE=${EXPORT_BASE:-$SP/arcane-wowsims-import.json}
export ITER=${ITER:-6000}
export XVDIR=${XVDIR:-$SP/xvcamp7}
mkdir -p "$XVDIR"
RES=$REPO/tools/xval-results

ckpt () {  # copy any new/changed tables into the repo and commit+push
  local changed=0
  for f in "$XVDIR"/*.txt; do
    [ -e "$f" ] || continue
    if ! cmp -s "$f" "$RES/$(basename "$f")" 2>/dev/null; then
      cp "$f" "$RES/"; changed=1
    fi
  done
  if [ "$changed" = 1 ]; then
    git -C "$REPO" add tools/xval-results
    git -C "$REPO" commit -q -m "xval-results: PHASE7 re-run checkpoint ($1)" || true
    git -C "$REPO" push -q -u origin claude/wow-arcane-cooldown-optimizer-vbm3as || true
  fi
}

for KIT in "mqg,skull" "isc,scb" "isc,skull" "isc,mqg" "scb,skull" "scb,mqg"; do
  KTAG=$(echo "$KIT" | tr ',' '-')
  if [ "${FORCE:-0}" != 1 ] && grep -q "var=0.5" "$RES/$KTAG-short.txt" 2>/dev/null && grep -q "var=0.5" "$RES/$KTAG-xl.txt" 2>/dev/null; then
    echo "== kit $KIT already re-run (var=0.5 tables present) — skipping"; continue
  fi
  echo "== kit $KIT =="
  bash "$REPO/tools/xval-kit.sh" "$KIT"
  ckpt "$KTAG"
done
echo "== bosses =="
bash "$REPO/tools/xval-boss.sh"
ckpt bosses
echo "RERUN-DONE"
node "$REPO/tools/xval-collect.mjs" "$RES"
