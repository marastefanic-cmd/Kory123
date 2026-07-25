#!/bin/bash
# Phase-6 boss-shape cross-val: run the haste-adaptation cross-val on a boss preset's REAL fight shape
# (T, Lust time, intermission/AoE phases from window.BOSS_PRESETS) instead of a class-drawn fight.
# Tests whether the planner adapts correctly to a specific PHASE STRUCTURE, not just a fight length.
#   bash tools/xval-boss.sh                       # default set: Vashj + Al'ar + KT × 2 representative kits
#   BOSSES="Lady Vashj" KITS="mqg,skull" bash tools/xval-boss.sh
# Vashj & Al'ar are intermission-only. KT has an AoE phase, and since task #53 genapl EMITS Arcane
# Explosion in it — xval.mjs passes `--targets <N>` and the banner reads "AoE phase VALUED". (This
# header used to claim the AoE window was simmed as downtime with AoE damage excluded; that has been
# false since #53 landed. Logs older than that carry the old banner — resolve a log basename to its
# NEWEST copy before drawing any conclusion from it.)
#
# ⚠ ITER=6000 HERE vs 10000 IN xval.mjs — AND boss cells are a 5-VARIANT MEAN.  A boss matrix cell is
# the mean over `1 + 2*WJITTER` wall-jitter variants (xval.mjs:233-245), which only engages when BOSS
# is set and the preset has walls; class cells are a single variant at ITER=10000.  So the corpus is
# TWO INSTRUMENTS with different noise, and reproducing a boss cell by hand needs the same 5 variants
# (tools/cell-band.mjs replays them). Any statistic that pools boss and class cells inherits this.
#
# Exit-code contract (shared with tools/xval.mjs): 0 = every boss×kit cell produced a matrix ·
# 2 = at least one did not.  A `diag=DEFICIT` is an observation, not a failure (see xval-kit.sh).
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
nok=0; ndef=0; nfail=0
for boss in "${BLIST[@]}"; do
  btag=$(echo "$boss" | tr -cd 'A-Za-z')
  for kit in $KITS; do
    ktag=$(echo "$kit" | tr ',' '-')
    # Unchecked before: a KeyError here left hs="" and the cell was graded on the coarse default
    # grid instead of this kit's breakpoint straddle — with nothing in the log to say so.
    if ! hs=$(python3 -c "import json,sys;d=json.load(open(sys.argv[1]));print(','.join(map(str,d[sys.argv[2]])))" "$REPO/tools/xval-haste-sets.json" "$kit" 2>&1); then
      echo "ERROR: no haste set for kit \"$kit\" in tools/xval-haste-sets.json" >&2
      echo "  python3 said: $hs" >&2
      exit 2
    fi
    if [ -z "$hs" ]; then
      echo "ERROR: haste set for kit \"$kit\" is EMPTY — refusing to fall back to the coarse default grid." >&2; exit 2
    fi
    seed=$(( 5000 + $(echo "$boss$kit" | cksum | cut -d' ' -f1) % 4000 ))
    out="$XVDIR/boss-${btag}-${ktag}.txt"
    KIT="$kit" BOSS="$boss" HASTES="$hs" SCRATCH="$SP/xv-boss-${btag}-${ktag}" \
      node "$REPO/tools/xval.mjs" "$seed" > "$out" 2>&1
    rc=$?
    # rc was consulted nowhere and `BOSS-DONE` printed unconditionally, so a boss whose preset failed
    # to resolve (or whose page threw) left the run looking complete.  Grade on rc AND the line.
    line=$(grep -E "^XVAL-DONE" "$out" | tail -1)
    if [ "$rc" -ne 0 ] || [ -z "$line" ]; then
      nfail=$((nfail+1))
      echo "XVAL-FAIL boss-${btag}-${ktag} rc=$rc (see $out)"
      tail -3 "$out" >&2
    else
      echo "$line"
      case "$line" in *diag=DEFICIT*) ndef=$((ndef+1)) ;; *) nok=$((nok+1)) ;; esac
    fi
  done
done
if [ "$nfail" -gt 0 ]; then
  echo "BOSS-INCOMPLETE clean=$nok deficit=$ndef failed=$nfail"; exit 2
fi
echo "BOSS-DONE clean=$nok deficit=$ndef failed=0"
