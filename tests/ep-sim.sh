#!/usr/bin/env bash
# Sim-route EP: finite-difference the wowsims runner with a FROZEN forced-schedule APL,
# ±Δ per stat, normalised to SP=1.0. This is the "Route B" cross-check for the model-route
# EP (tests/ep-model.mjs). Uses common random numbers (same --seed) so the paired diff is
# low-noise. See docs/EP.md.
#
#   RUNNER=/path/to/runner GEAR=/path/to/gear.json ./ep-sim.sh '<genapl-spec-json>' [dur] [iter] [delta]
#
# The spec is the SAME JSON genapl.mjs takes (the tool's optimal schedule for the setup).
set -euo pipefail
RUNNER="${RUNNER:?set RUNNER=/path/to/wowsims/runner}"
GEAR="${GEAR:?set GEAR=/path/to/individual-gear-export.json}"
REPO="$(cd "$(dirname "$0")/.." && pwd)"
SPEC="${1:?genapl spec JSON}"; DUR="${2:-360}"; ITER="${3:-40000}"; D="${4:-100}"
MANA="${MANA:-900000}"; SEED="${SEED:-11}"
TMP="$(mktemp -d)"; trap 'rm -rf "$TMP"' EXIT
node "$REPO/tools/genapl.mjs" "$SPEC" "$TMP/ep.apl.json" >/dev/null
run(){ "$RUNNER" --export "$GEAR" --apl "$TMP/ep.apl.json" --dur "$DUR" --var 0 --iter "$ITER" \
  --seed "$SEED" --mana "$MANA" --tag x --quiet "$@" 2>/dev/null | awk '{print $5}'; }
spP=$(run --sp  "$D"); spM=$(run --sp  "-$D")
crP=$(run --crit "$D"); crM=$(run --crit "-$D")
haP=$(run --haste "$D"); haM=$(run --haste "-$D")
awk -v spP="$spP" -v spM="$spM" -v crP="$crP" -v crM="$crM" -v haP="$haP" -v haM="$haM" -v D="$D" 'BEGIN{
  dsp=(spP-spM)/(2*D); dcr=(crP-crM)/(2*D); dha=(haP-haM)/(2*D);
  printf "Sim route (frozen APL, delta=%d rating/SP, CRN):\n", D;
  printf "  dDPS/dSP=%.4f  dDPS/dCrit=%.4f  dDPS/dHaste=%.4f\n", dsp, dcr, dha;
  printf "  EP (SP=1.000):  Crit=%.3f   Haste=%.3f\n", dcr/dsp, dha/dsp;
}'
