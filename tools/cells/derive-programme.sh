#!/bin/bash
# ── TEST DERIVATION, AT THE STATS THE PAGE ACTUALLY SOLVES AT (§9z) ─────────────────────────────
# ⛔ `--crit` here is EFFECTIVE crit, the engine's unit. The page's crit box is your UNBUFFED sheet
# value and `buffedStats` adds Arcane Impact (+6) before the engine sees it, so a cell meant to be
# read at "type 38" must be enumerated at 44 — and `--t5two`, because the page defaults Tirisfal on.
# Measured: with Ashtongue in the kit, getting this wrong changes the layout COMPLETELY
# (icyVeins[0,65]/cluster@15 at 38/off vs icyVeins[65,90]/cluster@25 at 44/on). Without Ashtongue the
# two agree, because crit cancels — which is why it stayed invisible until the proc model landed.
# `tools/candidates-inject.mjs` converts back to typed values by reading the talent out of index.html.
#
# ── TEST DERIVATION, RE-CUT UNDER THE 08-05 ENGINE ───────────────────────────────────────────────
# ⛔ A NEW --out FILE, deliberately. `lattice-brute --out` SKIPS cells already present, so appending
# to the old one would silently keep gradings made under three superseded comparators (§9u/§9w/§9x)
# and a superseded move set (§9y). Everything here is graded by the engine as it stands today.
#
# ORDER IS BY PRACTICAL VALUE, user 08-05: *"with Phase 3 dropping I will want to switch in Ashtongue
# and Skull and pair it probably with SCB and drop icon for it. So the tests that are worth the most
# practically speaking would be Ashtongue + SCB and Skull + SCB."* Those go first, so a kill part-way
# through still leaves the cells that matter most. Breadth follows, per the coverage doctrine
# (CLAUDE.md): a kit nobody plays still pins a piece of the logic.
# ⚠ Every kit carries at most TWO of {mqg, isc, scb, skull, ati} — the equip cap (§9t).
cd /home/user/Kory123
SP=/tmp/claude-0/-home-user-Kory123/748f90bc-756f-501a-a357-d8ad35b82fc7/scratchpad
OUT=$SP/derive4.jsonl
LOG=$SP/derive4.log
lb() { local n=$1; shift; echo "=== $n ===" >> $LOG
       node tools/lattice-brute.mjs --jobs=4 --top=16 --out=$OUT "$@" >> $LOG 2>&1
       echo "  [done $n]" >> $LOG; }

# ── A. THE TWO PHASE-3 PRACTICAL KITS — the ones the user says they will actually play ───────────
lb A1-ati+gem-l20      --T=120 --lust=20 --sp=1387 --crit=44 --t5two --ati --kit=icyVeins,scb,arcanePower,berserking
lb A2-skull+gem-l20    --T=120 --lust=20 --sp=1387 --crit=44 --t5two --kit=icyVeins,scb,skull,arcanePower,berserking
lb A3-ati+gem-l5       --T=120 --lust=5  --sp=1387 --crit=44 --t5two --ati --kit=icyVeins,scb,arcanePower,berserking
lb A4-skull+gem-l5     --T=120 --lust=5  --sp=1387 --crit=44 --t5two --kit=icyVeins,scb,skull,arcanePower,berserking
# Phase-3 gear is faster and stronger than the default — one rung at raised haste + SP + crit
lb A5-ati+gem-p3gear   --T=120 --lust=20 --sp=1600 --crit=51 --t5two --haste=200 --ati --kit=icyVeins,scb,arcanePower,berserking
lb A6-skull+gem-p3gear --T=120 --lust=20 --sp=1600 --crit=51 --t5two --haste=200 --kit=icyVeins,scb,skull,arcanePower,berserking
# the 3:00 shape for both — length is the dimension the ladder covers, but these two kits deserve it
lb A7-ati+gem-T180     --T=180 --lust=20 --sp=1387 --crit=44 --t5two --ati --kit=icyVeins,scb,arcanePower,berserking
lb A8-skull+gem-T180   --T=180 --lust=20 --sp=1387 --crit=44 --t5two --kit=icyVeins,scb,skull,arcanePower,berserking

# ── B. THE OTHER LEGAL TRINKET PAIRINGS — coverage doctrine, not play value ──────────────────────
lb B1-icon+skull       --T=120 --lust=20 --sp=1387 --crit=44 --t5two --step=10 --kit=icyVeins,isc,skull,arcanePower,berserking
lb B2-icon+mqg         --T=120 --lust=20 --sp=1387 --crit=44 --t5two --step=10 --kit=icyVeins,isc,mqg,arcanePower,berserking
lb B3-skull+mqg        --T=120 --lust=20 --sp=1387 --crit=44 --t5two --step=10 --kit=icyVeins,skull,mqg,arcanePower,berserking
lb B4-ati+icon         --T=120 --lust=20 --sp=1387 --crit=44 --t5two --ati --kit=icyVeins,isc,arcanePower,berserking
# raid externals on the covered kit — drums and PI are party/raid, not trinket slots
lb B5-drums+icon+gem   --T=120 --lust=20 --sp=1387 --crit=44 --t5two --step=10 --kit=icyVeins,isc,scb,drums,arcanePower,berserking
lb B6-pi+icon+gem      --T=120 --lust=20 --sp=1387 --crit=44 --t5two --step=10 --kit=icyVeins,isc,scb,powerInfusion,arcanePower,berserking

# ── C. SPELLPOWER, then LUST TIMING / LENGTH (the ladder re-cut) ─────────────────────────────────
lb C1-sp1900           --T=120 --lust=20 --sp=1900 --crit=44 --t5two
lb C2-sp700-l5         --T=120 --lust=5  --sp=700  --crit=44 --t5two
lb C3-T140-l40         --T=140 --lust=40 --sp=1387 --crit=44 --t5two --step=10
lb C4-T180-nolust      --T=180             --sp=1387 --crit=44 --t5two --step=10
lb C5-T160-l60         --T=160 --lust=60 --sp=1387 --crit=44 --t5two --step=10
for T in 140 160 180 200; do
  for L in 5 20 40; do
    lb "L-T${T}-lust${L}" --T=$T --lust=$L --sp=1387 --crit=44 --t5two --step=10
  done
done

# ── D. HIGH HASTE — LAST, because these are the 200M-layout cells (~30 min each) ─────────────────
lb D1-h300             --T=120 --lust=20 --sp=1387 --crit=44 --t5two --haste=300
lb D2-h500             --T=120 --lust=20 --sp=1387 --crit=44 --t5two --haste=500
echo "DERIVE4 DONE" >> $LOG
