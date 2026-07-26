#!/usr/bin/env bash
# Are we behind wowsims upstream, and does any of it touch US?
#
#   bash tools/upstream-drift.sh
#
# WHY THIS EXISTS (07-26). The user spotted that the page linked to `wowsims.github.io/tbc` — the
# ARCHIVED 2021 sim, which now shows a "This sim is outdated!" banner — and reasonably asked whether
# the whole project had been built on the wrong simulator. It had not: the engine has always been
# `wowsims/tbc-new` (what `wowsims.com/tbc` deploys); only a hyperlink was wrong. But answering
# "has this been impacting our progress?" took a manual investigation, and the honest answer to a
# question that important should be one command. This is that command.
#
# ★ THE TWO wowsims, AND WHICH IS WHICH — the confusion this repo keeps meeting:
#   • `wowsims/tbc-new`  → deployed at **https://www.wowsims.com/tbc/**  ← THE LIVE, MAINTAINED SIM.
#                          This is what we build, pin, patch and link. It declares Go module
#                          `github.com/wowsims/tbc`, which is exactly what makes the mistake easy.
#   • `wowsims/tbc`      → deployed at https://wowsims.github.io/tbc/    ← ARCHIVED (original TBC
#                          Classic 2021, pre-APL). Never build from it, never link to it.
#   Inferring the clone URL from the module path lands on the ARCHIVED repo. Read it, don't derive it.
#
# BEING PINNED IS CORRECT, NOT A BUG. A moving sim underneath a calibrated model would make every
# recorded number unreproducible. The pin is deliberate; what this script provides is the *informed*
# part of that choice — it filters upstream commits to the paths that could actually change an arcane
# mage's cast stream, so "we are N behind" turns into "…and here is whether any of it matters".
set -euo pipefail

REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PIN=ade9f39cc                       # keep in step with sim/build-wasm.sh and docs/TOOLING.md
UPSTREAM=https://github.com/wowsims/tbc-new.git
WORK="${1:-$(mktemp -d)}/tbc-drift"

# Paths whose behaviour can reach our numbers. Everything else upstream ships — feral debuffs, tank
# mitigation, UI, other specs — cannot move an arcane mage's DPS in an APL-driven, infinite-mana,
# single-target duel, and listing them would only train us to skim the output.
RELEVANT='^(sim/mage/|sim/core/(unit|spell|cast|apl|buffs|sim|environment|attack_table|spell_result|base_stats)|proto/)'

echo "pin:      $PIN   (the commit sim/sim.wasm and the runner are built from)"
echo "upstream: $UPSTREAM"
echo

[ -d "$WORK" ] || git clone --quiet --filter=blob:none "$UPSTREAM" "$WORK"
cd "$WORK"
git fetch --quiet origin
HEAD_SHA=$(git rev-parse --short origin/HEAD 2>/dev/null || git rev-parse --short origin/master)
BEHIND=$(git rev-list --count "$PIN"..origin/HEAD 2>/dev/null || git rev-list --count "$PIN"..origin/master)

echo "upstream HEAD: $HEAD_SHA   ·   we are $BEHIND commit(s) behind"
echo
if [ "$BEHIND" -eq 0 ]; then echo "Up to date. Nothing to assess."; exit 0; fi

echo "── files changed since the pin that could touch an arcane mage ──────────────"
CHANGED=$(git log --name-only --pretty=format: "$PIN"..origin/HEAD 2>/dev/null || git log --name-only --pretty=format: "$PIN"..origin/master)
RELEVANT_FILES=$(echo "$CHANGED" | grep -E "$RELEVANT" | sort -u || true)
if [ -z "$RELEVANT_FILES" ]; then
  echo "  (none — every upstream change since the pin is in specs/systems we do not sim)"
  echo
  echo "VERDICT: the pin is stale but INERT. No action needed."
  exit 0
fi
echo "$RELEVANT_FILES" | sed 's/^/  /'
echo
echo "── the commits behind them ──────────────────────────────────────────────────"
for f in $RELEVANT_FILES; do
  echo "  $f"
  git log --oneline "$PIN"..origin/HEAD -- "$f" 2>/dev/null | sed 's/^/    /' || \
  git log --oneline "$PIN"..origin/master -- "$f" | sed 's/^/    /'
done
echo
cat <<'NOTE'
VERDICT: read the diffs before deciding. The question is never "is there a change" but "does it move
an APL-driven, infinite-mana, single-target arcane cast stream". Judge each one against:

  · does it change cast time, haste, the GCD, or the AB debuff?           → re-baseline everything
  · does it change a cooldown WE press (IV / AP / Zerk / BL / trinkets)?   → re-baseline that cooldown
  · does it only add an AUTO-CAST MajorCooldown?                          → inert: genapl never emits
                                                                            `autocastOtherCooldowns`
  · is it another spec, a melee/tank system, or UI?                       → inert

If you do move the pin: update it here, in `sim/build-wasm.sh` and in `docs/TOOLING.md`, rebuild the
wasm, re-run `RUNNER=… node tests/sim-request.mjs` and `tests/sim-duel.mjs`, RE-CERTIFY THE TRUST
ANCHOR (BENCH §3d), and treat every recorded sim number as being on a new baseline — BENCH §1's
gear-A/gear-B rule applies to engine versions too.
NOTE
