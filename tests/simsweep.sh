#!/usr/bin/env bash
# Sim-sweep helper: feed it a set of named APL specs (one per line: NAME<TAB>JSON),
# it runs tools/genapl.mjs + the wowsims runner for each and prints a DPS table.
# The runner binary + gear export live in the (ephemeral) session scratchpad — see
# docs/TOOLING.md — so point at them via env vars (no hardcoded session paths):
#
#   RUNNER=/path/to/runner GEAR=/path/to/gear.json ./simsweep.sh <dur> <var> <iter> <seed> <specfile>
#
# Optional: MANA (default 900000), HASTE (default 0). Column 5 of the runner TSV is mean DPS.
set -euo pipefail
RUNNER="${RUNNER:?set RUNNER=/path/to/wowsims/runner (rebuilt in the scratchpad — see docs/TOOLING.md)}"
GEAR="${GEAR:?set GEAR=/path/to/individual-gear-export.json (user-provided — see docs/TOOLING.md)}"
REPO="$(cd "$(dirname "$0")/.." && pwd)"
DUR="${1:?dur}"; VAR="${2:?var}"; ITER="${3:?iter}"; SEED="${4:?seed}"; SPEC="${5:?specfile}"
MANA="${MANA:-900000}"; HASTE="${HASTE:-0}"
TMP="$(mktemp -d)"; trap 'rm -rf "$TMP"' EXIT
printf '%-28s %10s\n' "PLAN" "meanDPS"
while IFS=$'\t' read -r name json; do
  [ -z "$name" ] && continue
  node "$REPO/tools/genapl.mjs" "$json" "$TMP/a.apl.json" >/dev/null
  line=$("$RUNNER" --export "$GEAR" --apl "$TMP/a.apl.json" --dur "$DUR" --var "$VAR" --iter "$ITER" \
    --seed "$SEED" --mana "$MANA" --haste "$HASTE" --tag "$name" --quiet 2>/dev/null)
  printf '%-28s %10s\n' "$name" "$(printf '%s' "$line" | awk '{print $5}')"
done < "$SPEC"
