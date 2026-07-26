set -u
cd /home/user/Kory123
echo "== processes (excluding this script) =="
ps -eo pid,cmd --no-headers | grep -vE "status\.sh|grep" | grep -E "xval-bench|boss-solves|chain|checkpoint|xargs" | sed 's/\(.\{78\}\).*/\1/' || echo "  (none)"
echo "== tables =="
echo "  complete: $(grep -lE '^XVAL-DONE' tools/xval-results/*.txt 2>/dev/null | wc -l) / 36"
echo "  partial : $(for f in tools/xval-results/*.txt; do grep -q '^XVAL-DONE' "$f" 2>/dev/null || echo x; done | wc -l)"
echo "== cache =="
echo "  plans: $(ls .xval-cache 2>/dev/null | grep -c '^plan-')   sims: $(ls .xval-cache 2>/dev/null | grep -c '^dps-')"
