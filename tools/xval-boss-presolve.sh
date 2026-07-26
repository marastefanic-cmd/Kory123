set -u
REPO=/home/user/Kory123
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
