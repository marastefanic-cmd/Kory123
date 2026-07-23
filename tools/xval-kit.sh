#!/bin/bash
# Phase-6 campaign driver: run the haste-adaptation cross-val for ONE trinket kit across all five
# fight-length classes, using that kit's breakpoint-straddle haste set. Full matrices are teed to
# $XVDIR/<kit>-<class>.txt; a one-line summary per class is printed (that's what an agent reports).
#   bash tools/xval-kit.sh mqg,skull
set -u
KIT="$1"
REPO=/home/user/Kory123
SP=/tmp/claude-0/-home-user-Kory123/e436da46-89c3-50bc-bce2-5b6be890f704/scratchpad
export CHROMIUM=${CHROMIUM:-/opt/pw-browsers/chromium}
export RUNNER=${RUNNER:-$SP/wowsims/runner-ap180}
export EXPORT_BASE=${EXPORT_BASE:-$SP/arcane-wowsims-import.json}
XVDIR=${XVDIR:-$SP/xvcamp}; mkdir -p "$XVDIR"
HASTES=$(python3 -c "import json;print(','.join(map(str,json.load(open('$REPO/tools/xval-haste-sets.json'))['$KIT'])))")
KTAG=$(echo "$KIT" | tr ',' '-')
i=0
for cls in short medium medlong long xl; do
  seed=$(( 1000 + $(echo "$KIT" | cksum | cut -d' ' -f1) % 9000 + i ))
  out="$XVDIR/${KTAG}-${cls}.txt"
  KIT="$KIT" TCLASS="$cls" HASTES="$HASTES" SCRATCH="$SP/xv-${KTAG}-${cls}" \
    node "$REPO/tools/xval.mjs" "$seed" > "$out" 2>&1
  grep -E "^XVAL-DONE" "$out" || echo "XVAL-FAIL ${KTAG}-${cls} (see $out)"
  i=$((i+1))
done
echo "KIT-DONE $KTAG"
