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
# Phase-6 campaign: all six trinket kits × five fight-length classes, max 2 kits concurrent (keeps
# 2 chromium + 2 runners on a 4-core box without OOM/thrash). Full matrices tee to $XVDIR; summary
# lines to the campaign log. Kits run their own breakpoint haste sets (tools/xval-haste-sets.json).
#
# Exit-code contract (shared with tools/xval.mjs): 0 = every kit completed all five classes ·
# 2 = at least one kit did not.  A `diag=DEFICIT` is an observation, not a failure (see xval-kit.sh).
set -u
REPO=/home/user/Kory123
# Overridable (as in xval-boss.sh) so a subset can be re-run without editing the file.
KITS=${KITS:-"mqg,skull isc,scb isc,skull isc,mqg scb,skull scb,mqg"}
MAXJOBS=${MAXJOBS:-2}
export ITER=${ITER:-6000}
launched=0; reaped=0; nfail=0
# `wait -n` returns the finishing job's exit status, so reap through a helper that COUNTS failures.
# The old loop threw that status away and ended on a bare `wait`, then printed CAMPAIGN-DONE with
# status 0 no matter how many kits had died — the same false pass as xval-kit.sh, one level up.
# Reaping exactly `launched` times (rather than draining on `jobs -rp`, which only lists RUNNING
# jobs) guarantees every child's status is actually observed.
reap() { if wait -n; then :; else nfail=$((nfail+1)); fi; reaped=$((reaped+1)); }
for KIT in $KITS; do
  while [ $((launched - reaped)) -ge "$MAXJOBS" ]; do reap; done
  echo "== launching kit $KIT =="
  bash "$REPO/tools/xval-kit.sh" "$KIT" &
  launched=$((launched+1))
done
while [ "$reaped" -lt "$launched" ]; do reap; done
if [ "$nfail" -gt 0 ]; then
  echo "CAMPAIGN-INCOMPLETE kits=$launched failed=$nfail — the failing kits printed KIT-INCOMPLETE above"; exit 2
fi
echo "CAMPAIGN-DONE kits=$launched failed=0"
