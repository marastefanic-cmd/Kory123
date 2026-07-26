#!/bin/bash
# Round driver (2 of 3): bank the boss half's SOLVES ahead of time, so the boss campaign is sim-bound.
#
#   bash tools/xval-boss-presolve.sh
#
# Why it is a separate pass. A boss cell's cost is dominated by the SOLVE, not the sim — a Kael'thas
# solve is ~280 s × 11 hastes × 2 tables — and solving is CPU-bound while simming is too. Running the
# solves alongside the *class* campaign (which is already 3-wide) uses the fourth core for the work
# that would otherwise serialise in front of every boss table. `xval-round-pipeline.sh` waits on this
# script by process name before it starts the boss phase; `xval-boss-warm.sh` picks the core up
# afterwards to warm sim caches.
#
# ⚠ The solve cache (`.xval-cache/`) is GITIGNORED and not durable — a reclaimed container re-solves
# everything this banked. Completed tables survive in git; banked solves do not.
#
# ⚠ Seeds are derived from boss+kit via `cksum`, which is stable across machines, so a re-run
# pre-solves exactly the cells the campaign will ask for. Change the derivation and the pre-solve
# silently warms the wrong cells — the campaign then re-solves from scratch with no error.
#
# ⚠ `xval-round-pipeline.sh` matches this script BY FILENAME (`PRESOLVE_PAT`). Renaming this file
# without updating that default removes the barrier silently — which is exactly the bug the promoted
# `/tmp` copies shipped with (see that script's header).
set -u
REPO=${REPO:-/home/user/Kory123}
cd "$REPO"
hs() { python3 -c "import json,sys;d=json.load(open('tools/xval-haste-sets.json'));print(','.join(map(str,d[sys.argv[1]])))" "$1"; }
for boss in "Lady Vashj" "Al'ar" "Kael'thas Sunstrider"; do
  for kit in "mqg,skull" "isc,scb"; do
    tag=$(echo "$boss" | tr -cd 'A-Za-z')-$(echo "$kit" | tr ',' '-')
    seed=$(( 5000 + $(echo "$boss$kit" | cksum | cut -d' ' -f1) % 4000 ))
    echo "== solving $tag (seed $seed) $(date +%H:%M)"
    KIT="$kit" HASTES="$(hs "$kit")" BOSS="$boss" SOLVE_ONLY=1 \
      node tools/xval-bench.mjs "$seed" 2>&1 | grep -E "solved|cache|SOLVE-ONLY"
  done
done
echo "BOSS-SOLVES-DONE $(date +%H:%M)"
