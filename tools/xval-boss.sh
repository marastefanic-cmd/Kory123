#!/bin/bash
# ╔══════════════════════════════════════════════════════════════════════════════════════════════╗
# ║ ⚠ REPRODUCTION-ONLY — THIS IS A GEAR-A INSTRUMENT. DO NOT GATHER A NEW ROUND WITH IT.        ║
# ╚══════════════════════════════════════════════════════════════════════════════════════════════╝
#
# This tool belongs to the pre-2026-07-26 rig and is kept so the ARCHIVED gear-A corpus
# (`tools/xval-results-archive/gearA-pre-20260726/`) stays reproducible. It is NOT the current
# instrument, and a table it produces must never be compared to, pooled with, or diffed against a
# gear-B table (BENCH §1 — B2's sim preference moved ~0.39 pp AND CHANGED SIGN across the two).
#
# What replaced it, and why the replacement is not a like-for-like swap:
#   · CURRENT DRIVER   `tools/xval-bench.mjs` + `tools/xval-bench-campaign.sh` (proven equivalent to
#                      `tools/xval.mjs`, PHASE10 §8.9), driven by `tools/xval-round-pipeline.sh`.
#   · ENGINE           the committed `sim/sim.wasm` — no clone, no protoc, no `go build`, and no
#                      `RUNNER`/`EXPORT_BASE` to resolve out of a session scratchpad that may be gone.
#   · CHARACTER        `tools/bench/export.json`, committed and frozen — not a private export.
#   · PROTOCOL         `--var 0.5` by measurement (`tools/var-decision.mjs`), difference-in-differences
#                      against a never-press control, and every reading STAMPED (`char=`, `emit=`,
#                      `iter=`, `seeds=`, `wasm=`) so a later reader can classify it without trusting
#                      a directory name.
#
# ⚠ It also predates `sim/planspec.mjs`'s `REQUIRES_EQUIPPED` guard, so it will happily schedule a
# press of an UNWORN trinket — a bit-identical no-op in wowsims that reads as a small honest number
# rather than an error (PHASE12 §2.1). That is the single most likely way an old table lies.
#
# If you are here to gather data: stop, and use the current driver. If you are here to reproduce an
# archived table: carry on, and read that directory's README first.
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
source "$(dirname "${BASH_SOURCE[0]}")/xval-env.sh"   # REPO/SP/CHROMIUM/RUNNER/EXPORT_BASE + preflight
xval_preflight
export ITER=${ITER:-6000}
# ★★★ P7.15 transcription convention, PINNED here so a boss round can never inherit a stray value from
# the calling shell: `fire` = the times the tool PRINTS (default since 07-25) · `intent` = the raw press
# intents every round BEFORE 07-25 was gathered with. Rounds under the two conventions are NOT
# comparable cell-for-cell — the marker is stamped on each XVAL-DONE line (`emit=…`) so a log says
# which it is; a log with no `emit=` predates the switch and is `intent`. See ACCEPTANCE, PHASE7 §5.21.
export EMIT=${EMIT:-fire}
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
