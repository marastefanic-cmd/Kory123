#!/bin/bash
# Phase-6 boss-shape cross-val: run the haste-adaptation cross-val on a boss preset's REAL fight shape
# (T, Lust time, intermission/AoE phases from window.BOSS_PRESETS) instead of a class-drawn fight.
# Tests whether the planner adapts correctly to a specific PHASE STRUCTURE, not just a fight length.
#   bash tools/xval-boss.sh                       # default set: Vashj + Al'ar + KT × 2 representative kits
#   BOSSES="Lady Vashj" KITS="mqg,skull" bash tools/xval-boss.sh
# Vashj & Al'ar are intermission-only → sim cleanly. KT has an AoE phase simmed as DOWNTIME (genapl has
# no Arcane-Explosion emission) → its numbers EXCLUDE AoE damage and xval.mjs flags the run.
set -u
REPO=/home/user/Kory123
SP=/tmp/claude-0/-home-user-Kory123/e436da46-89c3-50bc-bce2-5b6be890f704/scratchpad
export CHROMIUM=${CHROMIUM:-/opt/pw-browsers/chromium}
export RUNNER=${RUNNER:-$SP/wowsims/runner-ap180}
export EXPORT_BASE=${EXPORT_BASE:-$SP/arcane-wowsims-import.json}
export ITER=${ITER:-6000}
XVDIR=${XVDIR:-$SP/xvcamp}; mkdir -p "$XVDIR"
# Two structural kit classes: SP-trinket present (isc,scb) and SP-trinket absent / haste-heavy (mqg,skull).
KITS=${KITS:-"mqg,skull isc,scb"}
# Default bosses: the three the user named. IFS='|' so multi-word names survive.
BOSSES=${BOSSES:-"Lady Vashj|Al'ar|Kael'thas Sunstrider"}
IFS='|' read -ra BLIST <<< "$BOSSES"
for boss in "${BLIST[@]}"; do
  btag=$(echo "$boss" | tr -cd 'A-Za-z')
  for kit in $KITS; do
    ktag=$(echo "$kit" | tr ',' '-')
    hs=$(python3 -c "import json;print(','.join(map(str,json.load(open('$REPO/tools/xval-haste-sets.json'))['$kit'])))")
    seed=$(( 5000 + $(echo "$boss$kit" | cksum | cut -d' ' -f1) % 4000 ))
    out="$XVDIR/boss-${btag}-${ktag}.txt"
    KIT="$kit" BOSS="$boss" HASTES="$hs" SCRATCH="$SP/xv-boss-${btag}-${ktag}" \
      node "$REPO/tools/xval.mjs" "$seed" > "$out" 2>&1
    grep -E "^XVAL-DONE" "$out" || echo "XVAL-FAIL boss-${btag}-${ktag} (see $out)"
  done
done
echo "BOSS-DONE"
