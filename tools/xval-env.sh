#!/bin/bash
# Shared environment resolution for the xval drivers. SOURCED, never executed:
#   source "$(dirname "${BASH_SOURCE[0]}")/xval-env.sh"
# by tools/xval-kit.sh, tools/xval-boss.sh, tools/xval-rerun.sh.
#
# ★★ WHY THIS FILE EXISTS (07-25). The three drivers each hardcoded the same absolute scratchpad path,
# and that path contains a SESSION ID. Wrong twice over:
#
#   1. It bakes a session identifier into a committed, shareable artifact. CLAUDE.md's identity rule
#      names session ids explicitly.
#   2. It rots SILENTLY. A reclaimed container gets a fresh session dir; the old one may still exist
#      but be empty. `set -u` does not catch this — the variables ARE set, just to a dead path — so the
#      run fails late and confusingly, after minutes of setup, instead of in the first second.
#
# And the obvious repair ("just take the newest scratchpad") is ALSO wrong: at the time this was
# written the box held FIVE sibling scratchpads from earlier sessions and exactly ONE had the sim
# runner in it. So the probe is by CONTENT, not by mtime — mtime only orders the candidates.
#
# Resolution order for every variable: explicit env override > discovered > loud failure.

REPO=${REPO:-/home/user/Kory123}

# SP — the session scratchpad holding the sim runner + the gear export. Both are USER DATA / build
# output that must never be committed, which is why they live outside the repo and must be found.
if [ -z "${SP:-}" ]; then
  SP=$(ls -dt /tmp/claude-*/*/*/scratchpad 2>/dev/null | while read -r d; do
         if [ -x "$d/wowsims/runner-ap180" ]; then echo "$d"; break; fi
       done)
fi

export SP REPO   # exported so child processes and later `$SP/...` uses see the resolved value
export CHROMIUM=${CHROMIUM:-/opt/pw-browsers/chromium}
export RUNNER=${RUNNER:-${SP:-}/wowsims/runner-ap180}
export EXPORT_BASE=${EXPORT_BASE:-${SP:-}/arcane-wowsims-import.json}

# Fail in the first second, naming the exact variable to set. Exit 2 matches the drivers' shared
# contract (0 = every cell produced a matrix · 2 = at least one did not); a missing runner is
# emphatically the second kind, not a `diag=DEFICIT` observation.
xval_preflight() {
  local bad=0
  if [ -z "${SP:-}" ]; then
    echo "ERROR: no scratchpad found containing wowsims/runner-ap180." >&2
    echo "       Looked under /tmp/claude-*/*/*/scratchpad (newest first)." >&2
    bad=1
  fi
  if [ ! -x "${RUNNER:-}" ]; then
    echo "ERROR: sim runner missing or not executable: RUNNER=${RUNNER:-<unset>}" >&2
    echo "       Build it per docs/TOOLING.md (it is the AP-180-patched wowsimcli, not stock)." >&2
    bad=1
  fi
  if [ ! -r "${EXPORT_BASE:-}" ]; then
    echo "ERROR: gear export missing or unreadable: EXPORT_BASE=${EXPORT_BASE:-<unset>}" >&2
    echo "       This is USER DATA and is never committed — re-export from the in-game addon." >&2
    bad=1
  fi
  if [ "$bad" != 0 ]; then
    echo "  Fix: SP=/path/to/scratchpad bash tools/<driver>.sh   (or set RUNNER/EXPORT_BASE directly)" >&2
    exit 2
  fi
}
