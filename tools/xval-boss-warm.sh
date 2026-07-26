set -u
SP=/tmp/claude-0/-home-user-Kory123/d5fa5928-bf15-563a-bac4-e09d7c1c290a/scratchpad
cd /home/user/Kory123
# Wait for the pre-solve pass to end, then keep that core busy warming boss SIM caches instead of
# leaving it idle while the class campaign finishes on the other three.
while ! grep -q "BOSS-SOLVES-DONE\|^EXIT=" "$SP/boss-solves.log" 2>/dev/null; do sleep 60; done
echo "pre-solves done $(date +%H:%M) — warming boss sim caches on the freed core"
hs() { python3 -c "import json,sys;d=json.load(open('tools/xval-haste-sets.json'));print(','.join(map(str,d[sys.argv[1]])))" "$1"; }
# Cheapest first (no AoE), so the most tables are ready soonest if this gets interrupted.
for spec in "Lady Vashj|mqg,skull" "Lady Vashj|isc,scb" "Al'ar|mqg,skull" "Al'ar|isc,scb" "Kael'thas Sunstrider|mqg,skull" "Kael'thas Sunstrider|isc,scb"; do
  boss="${spec%%|*}"; kit="${spec##*|}"
  seed=$(( 5000 + $(echo "$boss$kit" | cksum | cut -d' ' -f1) % 4000 ))
  echo "== warming $boss / $kit (seed $seed) $(date +%H:%M)"
  KIT="$kit" HASTES="$(hs "$kit")" BOSS="$boss" ITER=6000 SHARD=0/1 \
    nice -n 12 node tools/xval-bench.mjs "$seed" 2>&1 | grep -E "SHARD-DONE|ERROR"
done
echo "BOSS-WARM-DONE $(date +%H:%M)"
