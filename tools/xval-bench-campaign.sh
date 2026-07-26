#!/bin/bash
# THE GEAR-B ACCEPTANCE ROUND — 36 tables, one protocol, from the repo alone (docs/PHASE10.md §4.2).
#
#   bash tools/xval-bench-campaign.sh                 # everything: 30 class tables + 6 boss tables
#   WHAT=class bash tools/xval-bench-campaign.sh      # just the 30 class tables
#   WHAT=boss  bash tools/xval-bench-campaign.sh      # just the 6 boss tables
#   JOBS=4 ITER=6000 XVDIR=tools/xval-results bash tools/xval-bench-campaign.sh
#   SKIP_EXISTING=1 bash tools/xval-bench-campaign.sh        # RESUME after a container reclaim
#
# ★ RESUMING. A round is ~14 CPU-hours of class tables plus ~38 of boss tables, so it WILL outlive
# something. `SKIP_EXISTING=1` skips any cell whose file already carries an `XVAL-DONE` line (checked:
# it skips exactly the complete ones and re-runs the rest), and `tools/xval-checkpoint.sh` commits and
# pushes completed tables while the campaign runs — so restore the repo, re-run with SKIP_EXISTING=1,
# and only the unfinished cells cost anything. ⚠ The content-addressed caches live in `.xval-cache/`,
# which is gitignored and therefore NOT durable: a resumed cell re-solves and re-sims from scratch.
#
# Replaces xval-campaign.sh + xval-kit.sh + xval-boss.sh for the bench era. Those three drove
# `tools/xval.mjs`, which needs RUNNER + EXPORT_BASE (a native rig built per session); this drives
# `tools/xval-bench.mjs`, which runs the committed `sim/sim.wasm`. They are kept, not deleted: they
# are the only way to reproduce an archived gear-A round.
#
# ★ THE SEEDS ARE THE OLD ONES ON PURPOSE. `1000 + cksum(kit)%9000 + classIdx` and
# `5000 + cksum(boss+kit)%4000` are xval-kit.sh's and xval-boss.sh's formulas verbatim, so every cell
# draws the SAME fight (T, Lust, kit) the gear-A corpus was gathered on. The holdout SAMPLE is
# therefore unchanged and only the BASELINE is new — which is what makes this a re-measurement rather
# than a different experiment. ⚠ It does NOT license diffing a gear-B number against a gear-A one
# (BENCH §1): same fight, different character.
#
# ★ ONE PROTOCOL, STAMPED ON EVERY TABLE. ITER, var, seed, mana, emit, targets, the wasm hash and the
# character all land on each XVAL-DONE line (PHASE10 §3). The round-5/round-6 `emit=` confusion is the
# recorded cost of a table that did not say how it was gathered.
#
# Exit-code contract (shared with every instrument here): 0 = every cell produced a matrix ·
# 2 = at least one did not. Exit 1 is unused ON PURPOSE — `diag=DEFICIT` is an OBSERVATION, not a
# failure; this script GATHERS and grades nothing about the model.
set -u
REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
XVDIR=${XVDIR:-$REPO/tools/xval-results}
JOBS=${JOBS:-4}
export ITER=${ITER:-6000}
WHAT=${WHAT:-all}
mkdir -p "$XVDIR"

HS_JSON="$REPO/tools/xval-haste-sets.json"
[ -f "$HS_JSON" ] || { echo "ERROR: $HS_JSON missing." >&2; exit 2; }

# kit → its breakpoint-straddle haste set. Unchecked, a KeyError leaves this empty and xval-bench
# would grade on a grid that never sampled the kit's breakpoints — i.e. report a verdict about
# adaptation for a kit whose adaptation was never tested. Fail here, naming the kit.
hastes_for() {
  local kit="$1" hs
  if ! hs=$(python3 -c "import json,sys;d=json.load(open(sys.argv[1]));print(','.join(map(str,d[sys.argv[2]])))" "$HS_JSON" "$kit" 2>&1); then
    echo "ERROR: no haste set for kit \"$kit\" in $HS_JSON — python3 said: $hs" >&2; return 2
  fi
  [ -n "$hs" ] || { echo "ERROR: haste set for kit \"$kit\" is EMPTY — refusing the coarse default grid." >&2; return 2; }
  printf '%s' "$hs"
}

# Build the job list first, so a bad kit name fails before anything runs for hours.
JOBFILE=$(mktemp)
trap 'rm -f "$JOBFILE"' EXIT
KITS=${KITS:-"mqg,skull isc,scb isc,skull isc,mqg scb,skull scb,mqg"}
if [ "$WHAT" = all ] || [ "$WHAT" = class ]; then
  for kit in $KITS; do
    hs=$(hastes_for "$kit") || exit 2
    ktag=${kit//,/-}
    i=0
    for cls in short medium medlong long xl; do
      seed=$(( 1000 + $(echo "$kit" | cksum | cut -d' ' -f1) % 9000 + i ))
      printf '%s\t%s\t%s\t%s\t%s\t%s\n' "$ktag-$cls" "$kit" "$hs" "$seed" "$cls" "" >> "$JOBFILE"
      i=$((i+1))
    done
  done
fi
if [ "$WHAT" = all ] || [ "$WHAT" = boss ]; then
  BOSSES=${BOSSES:-"Lady Vashj|Al'ar|Kael'thas Sunstrider"}
  BKITS=${BKITS:-"mqg,skull isc,scb"}
  IFS='|' read -ra BLIST <<< "$BOSSES"
  for boss in "${BLIST[@]}"; do
    btag=$(echo "$boss" | tr -cd 'A-Za-z')
    for kit in $BKITS; do
      hs=$(hastes_for "$kit") || exit 2
      ktag=${kit//,/-}
      seed=$(( 5000 + $(echo "$boss$kit" | cksum | cut -d' ' -f1) % 4000 ))
      printf '%s\t%s\t%s\t%s\t%s\t%s\n' "boss-$btag-$ktag" "$kit" "$hs" "$seed" "" "$boss" >> "$JOBFILE"
    done
  done
fi
NJOBS=$(wc -l < "$JOBFILE")
[ "$NJOBS" -gt 0 ] || { echo "ERROR: WHAT=\"$WHAT\" produced no jobs (known: all|class|boss)." >&2; exit 2; }
echo "== $NJOBS cells, $JOBS at a time, ITER=$ITER → $XVDIR =="

# ── the boss pre-pass: solve, then shard, so a 2-table phase still fills the box ──────────────────
# There are only 6 boss cells (2 per boss) and each is 100 cells × 5 wall-jitter variants — the KT
# pair alone is ~30 CPU-hours. Running them table-per-core leaves half the box idle for the longest
# job of the round. So: cache every plan first (SOLVE_ONLY), then fan the SIMS of each table across
# $JOBS shards, then let the real run assemble the matrix out of a warm cache. Lossless — both caches
# are content-addressed on the engine/wasm bytes (tools/xval-bench.mjs).
prepass() {
  local phase="$1"
  echo "== boss pre-pass: $phase =="
  # ⚠ DO NOT re-split these records with `while IFS=$'\t' read`. Tab is IFS *whitespace*, so bash
  # collapses a run of tabs into ONE delimiter and drops leading/trailing ones — the empty `TCLASS`
  # field of a boss row then disappears and every field after it shifts left, putting the boss name
  # in `cls` and leaving `boss` EMPTY. The `[ -n "$boss" ]` filter below then matched nothing, the
  # pre-pass built an empty job list, and the campaign carried on at half utilisation with no error
  # anywhere — this repo's dominant failure mode (a wrapper that runs and does nothing) in a new hat.
  # awk with an explicit -F'\t' does not collapse; it is also how the filter is written above.
  if [ "$phase" = solve ]; then
    awk -F'\t' -v OFS='\t' '$6 != "" { print $1,$2,$3,$4,$5,$6,"solve" }' "$JOBFILE" > "$JOBFILE.$phase"
  else
    awk -F'\t' -v OFS='\t' -v J="$JOBS" '$6 != "" { for (k = 0; k < J; k++) print $1,$2,$3,$4,$5,$6,k"/"J }' "$JOBFILE" > "$JOBFILE.$phase"
  fi
  local n; n=$(wc -l < "$JOBFILE.$phase")
  echo "   ($n pre-pass job(s))"
  # Reaching here with zero jobs means the caller SAW boss rows (that is the only way in) but the
  # generator produced none — i.e. the shift bug above, or one like it. Never a silent skip.
  [ "$n" -gt 0 ] || { rm -f "$JOBFILE.$phase"; echo "ERROR: boss pre-pass ($phase) generated 0 jobs from a job list that contains boss cells." >&2; return 2; }
  tr '\t\n' '\0\0' < "$JOBFILE.$phase" | xargs -0 -r -n7 -P "$JOBS" bash -c 'run_prepass "$@"' _
  local rc=$?
  rm -f "$JOBFILE.$phase"
  [ "$rc" -eq 0 ] || { echo "ERROR: boss pre-pass ($phase) had a failing cell — see above." >&2; return 2; }
}
run_prepass() {
  local name="$1" kit="$2" hs="$3" seed="$4" cls="$5" boss="$6" mode="$7"
  local env_solve="" env_shard=""
  if [ "$mode" = solve ]; then env_solve=1; else env_shard="$mode"; fi
  KIT="$kit" HASTES="$hs" TCLASS="$cls" BOSS="$boss" SOLVE_ONLY="$env_solve" SHARD="$env_shard" \
    node "$REPO/tools/xval-bench.mjs" "$seed" > "$XVDIR/$name.pre.log" 2>&1
  local rc=$?
  if [ "$rc" -ne 0 ]; then echo "PREPASS-FAIL $name mode=$mode rc=$rc"; tail -3 "$XVDIR/$name.pre.log" >&2; return 1; fi
  tail -1 "$XVDIR/$name.pre.log"
  return 0
}
export -f run_prepass

# One cell. Grades on rc AND on the presence of an XVAL-DONE line: a run that died mid-matrix still
# leaves a plausible-looking file, and every wrapper in this repo has had the bug of believing it.
run_cell() {
  local name="$1" kit="$2" hs="$3" seed="$4" cls="$5" boss="$6"
  local out="$XVDIR/$name.txt"
  if [ -n "${SKIP_EXISTING:-}" ] && grep -q "^XVAL-DONE" "$out" 2>/dev/null; then
    echo "SKIP $name (already complete)"; return 0
  fi
  KIT="$kit" HASTES="$hs" TCLASS="$cls" BOSS="$boss" \
    node "$REPO/tools/xval-bench.mjs" "$seed" > "$out" 2>"$out.err"
  local rc=$? line
  line=$(grep -E "^XVAL-DONE" "$out" | tail -1)
  if [ "$rc" -ne 0 ] || [ -z "$line" ]; then
    echo "XVAL-FAIL $name rc=$rc (see $out, $out.err)"
    tail -3 "$out.err" >&2
    return 1
  fi
  rm -f "$out.err"
  echo "$line"
  return 0
}
export -f run_cell
export REPO XVDIR JOBS

# Boss cells first, through the pre-pass, so their sims are already in the cache when the real run
# reaches them. Class cells need no pre-pass: there are 30 of them, so `xargs -P` fills the box.
if awk -F'\t' '$6 != ""' "$JOBFILE" | grep -q . && [ -z "${NO_PREPASS:-}" ]; then
  prepass solve  || exit 2
  prepass shard  || exit 2
fi

# `xargs -P` returns 123 if ANY invocation exited non-zero — which is exactly the status the old
# wrappers threw away (`wait $PIDS` returns only the LAST pid's status, so a first-kit death was
# invisible). ⚠ BOTH separators become NUL: converting only tabs would glue the last field of one
# record to the first field of the next across the newline, silently shifting every argument by one
# — and `TCLASS`/`BOSS` are legitimately EMPTY fields, which `-0` preserves and `-d '\n'` would not
# survive as reliably. Verified on a fixture with an empty middle field.
tr '\t\n' '\0\0' < "$JOBFILE" | xargs -0 -r -n6 -P "$JOBS" bash -c 'run_cell "$@"' _
rc=$?

NDONE=$(grep -l "^XVAL-DONE" "$XVDIR"/*.txt 2>/dev/null | wc -l)
NDEF=$(grep -h "^XVAL-DONE" "$XVDIR"/*.txt 2>/dev/null | grep -c "diag=DEFICIT")
if [ "$rc" -ne 0 ]; then
  echo "CAMPAIGN-INCOMPLETE cells=$NJOBS complete=$NDONE deficit=$NDEF — at least one cell failed above"; exit 2
fi
echo "CAMPAIGN-DONE cells=$NJOBS complete=$NDONE deficit=$NDEF clean=$((NDONE-NDEF)) failed=0"
# ⚠ A complete DIRECTORY is not a complete ROUND. A round is 36 tables; neither xval-collect.mjs nor
# xval-verify.mjs can know that 20 is not all of them (tools/xval-results/README.md). Say it here.
[ "$NDONE" -eq 36 ] || echo "⚠ $NDONE tables in $XVDIR — a ROUND IS 36. Do not read a verdict off a partial directory."
