#!/bin/bash
# Phase-6 campaign: all six trinket kits × five fight-length classes, max 2 kits concurrent (keeps
# 2 chromium + 2 runners on a 4-core box without OOM/thrash). Full matrices tee to $XVDIR; summary
# lines to the campaign log. Kits run their own breakpoint haste sets (tools/xval-haste-sets.json).
set -u
REPO=/home/user/Kory123
KITS="mqg,skull isc,scb isc,skull isc,mqg scb,skull scb,mqg"
MAXJOBS=${MAXJOBS:-2}
export ITER=${ITER:-6000}
for KIT in $KITS; do
  while [ "$(jobs -rp | wc -l)" -ge "$MAXJOBS" ]; do wait -n; done
  echo "== launching kit $KIT =="
  bash "$REPO/tools/xval-kit.sh" "$KIT" &
done
wait
echo "CAMPAIGN-DONE"
