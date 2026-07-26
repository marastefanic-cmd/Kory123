#!/bin/bash
# THE GRADING CHAIN, IN ORDER, WITH HONEST EXIT CODES (docs/PHASE10.md §3, §8.18-8.19).
#
#   bash tools/xval-grade.sh                          # grade tools/xval-results into a scratch dir
#   XVDIR=... OUT=... bash tools/xval-grade.sh
#
# ★ WHY THIS EXISTS, AND WHY THE ORDER IS LOAD-BEARING. The chain is six commands and the first one
# is the only one that knows whether it is looking at a ROUND. Measured on the real partial directory
# at 24/36: `xval-stamp-audit` exits 2 naming the 12 absent cells, while `xval-verify` — run on the
# same directory — prints `VERDICT over 24 tables: A holds · B FAILS -> ACCEPTANCE NOT PASSING` and
# exits 1. That is a confident, quotable, WRONG verdict off two thirds of a round: verify recomputes
# invariants from whatever matrices it is handed and never asks if they are one round's 36 cells
# (§8.19). So this script REFUSES to run anything downstream of a nonzero stamp audit. "36 tables or
# no verdict" becomes mechanical instead of a rule someone has to remember.
#
# ★ AND IT GRADES ON rc, NOT ON HAVING RUN. Every wrapper in this repo has had the bug of printing a
# completion banner over children that all failed (ACCEPTANCE "the three wrappers carried the
# false-pass class ONE LEVEL UP"; §8.10's corrupted-but-parseable table). Each stage's rc is captured
# WITHOUT a pipeline — `cmd > file; rc=$?` — because `cmd | tail` reports tail's status and would
# report success for every possible failure. That is not hypothetical: it is the bug this script was
# written immediately after making by hand.
#
# Exit-code contract, shared with every instrument here:
#   0 = every stage graded clean · 1 = graded and at least one stage FAILS · 2 = could not grade.
set -u
REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
XVDIR=${XVDIR:-$REPO/tools/xval-results}
OUT=${OUT:-${SCRATCH:-/tmp}/xval-grade}
mkdir -p "$OUT" || { echo "ERROR: cannot create OUT=$OUT" >&2; exit 2; }
[ -d "$XVDIR" ] || { echo "ERROR: XVDIR=$XVDIR is not a directory." >&2; exit 2; }

WORST=0            # 0 clean · 1 graded-and-failing · 2 could-not-grade (2 dominates 1)
note() { printf '%s\n' "$*"; }
bump() { local rc=$1; if [ "$rc" -eq 2 ] || [ "$WORST" -eq 2 ]; then WORST=2; elif [ "$rc" -eq 1 ]; then WORST=1; fi; }

# One stage. NO PIPELINE around the tool — see the header.
stage() {
  local label="$1" out="$2"; shift 2
  "$@" > "$OUT/$out" 2>&1
  local rc=$?
  note "-- $label: exit $rc  ($OUT/$out)"
  return $rc
}

note "== grading $XVDIR -> $OUT =="

# ── 1. PROVENANCE. Is this ONE round, ONE protocol, over the RIGHT cells? ──────────────────────────
# Nothing downstream can ask this, so nothing downstream runs until it passes.
# Scoping the EXPECTED CELL SET, for the positive control only. Narrowing it to whatever happens to
# be on disk would turn the provenance gate into a rubber stamp, so these are deliberately awkward:
# each is a SEPARATE variable, and STAMP_EXPECT must be set to match or the audit hard-fails on the
# size cross-check it already carries.
#   STAMP_KITS='mqg,skull isc,scb isc,skull' STAMP_BOSSES= STAMP_EXPECT=15 bash tools/xval-grade.sh
# ⚠ They are passed as individually quoted argv words. An earlier draft used one `STAMP_ARGS` string
# expanded unquoted; bash split it on spaces, `--kits` received only its first kit, and the audit ran
# with DEFAULTS while appearing to be scoped — it reported the full 36-cell expectation and exited 2,
# which read as "the control failed" rather than "the control was never applied". Note also that
# xval-stamp-audit's parser is the SPACE form (`--kits value`); `--kits=value` is silently ignored.
STAMP=()
[ -n "${STAMP_KITS+x}" ]   && STAMP+=(--kits   "$STAMP_KITS")
[ -n "${STAMP_BOSSES+x}" ] && STAMP+=(--bosses "$STAMP_BOSSES")
[ -n "${STAMP_BKITS+x}" ]  && STAMP+=(--bkits  "$STAMP_BKITS")
[ -n "${STAMP_EXPECT+x}" ] && STAMP+=(--expect "$STAMP_EXPECT")
[ ${#STAMP[@]} -gt 0 ] && note "   (scoped audit: ${STAMP[*]})"
stage "stamp-audit" stamp-audit.txt node "$REPO/tools/xval-stamp-audit.mjs" "$XVDIR" ${STAMP[@]+"${STAMP[@]}"}
rc=$?
if [ "$rc" -ne 0 ]; then
  note ""
  sed -n '/^## CANNOT GRADE/,$p;/^## /!d' "$OUT/stamp-audit.txt" 2>/dev/null | head -20
  tail -6 "$OUT/stamp-audit.txt"
  note ""
  note "⛔ REFUSING TO GRADE: the provenance gate exited $rc, so this is not one complete round."
  note "   Downstream tools were NOT run — xval-verify would have returned a confident verdict"
  note "   over whatever subset is present (PHASE10 §8.19). Finish the round, then re-run."
  exit "$rc"
fi

# ── 2. INVARIANTS, recomputed independently of the ledger ─────────────────────────────────────────
stage "verify"    verify.txt    node "$REPO/tools/xval-verify.mjs"  "$XVDIR"; bump $?
stage "collect"   collect.md    node "$REPO/tools/xval-collect.mjs" "$XVDIR"; bump $?
stage "persist"   persist.txt   node "$REPO/tools/xval-persist.mjs" "$XVDIR"; bump $?

# ── 3. THE TARGET LIST, and the ruler each deficit is priced against ──────────────────────────────
stage "collect --json" collect-json.txt node "$REPO/tools/xval-collect.mjs" "$XVDIR" --json "$OUT/targets.json"; bump $?
if [ -s "$OUT/targets.json" ]; then
  stage "ripple-audit" ripple-audit.txt node "$REPO/tools/ripple-audit.mjs" "$OUT/targets.json"; bump $?
else
  note "-- ripple-audit: SKIPPED — $OUT/targets.json is missing or empty"
  bump 2
fi

note ""
note "== next: the ≥3-seed BAND, whose SCOPE is pre-registered in PHASE10 §8.18 =="
note "   Band the UNION of: every column xval-persist names, and every cell ripple-audit puts"
note "   'over the floor' or INDETERMINATE. Do NOT re-choose that scope after reading the widths."
note "   Not-banded columns must be PUBLISHED as not-graded, never absorbed into a total."
note "     node tools/xval-band.mjs $OUT/targets.json"
note ""
case "$WORST" in
  0) note "✅ GRADED CLEAN (every stage exit 0)" ;;
  1) note "⚠ GRADED AND FAILING — at least one stage exited 1. This is a real verdict about the model." ;;
  2) note "⛔ COULD NOT GRADE — at least one stage exited 2. Fix the instrument before reading anything." ;;
esac
exit "$WORST"
