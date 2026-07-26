set -u
SP=/tmp/claude-0/-home-user-Kory123/d5fa5928-bf15-563a-bac4-e09d7c1c290a/scratchpad
cd /home/user/Kory123
echo "=== CLASS PHASE (SKIP_EXISTING, atomic driver) $(date +%H:%M) ==="
SKIP_EXISTING=1 WHAT=class ITER=6000 JOBS=3 bash tools/xval-bench-campaign.sh
echo "class rc=$? $(date +%H:%M)"
echo "=== waiting for boss pre-solves $(date +%H:%M) ==="
while ps -eo cmd --no-headers | grep -q "[b]oss-solves.sh"; do sleep 60; done
echo "=== BOSS PHASE $(date +%H:%M) ==="
SKIP_EXISTING=1 WHAT=boss ITER=6000 JOBS=4 bash tools/xval-bench-campaign.sh
echo "boss rc=$? $(date +%H:%M)"
echo "ROUND-PIPELINE-DONE $(date +%H:%M) complete=$(grep -lE '^XVAL-DONE' tools/xval-results/*.txt | wc -l)/36"
