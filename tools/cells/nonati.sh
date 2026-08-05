#!/bin/bash
# THE NON-ASHTONGUE CELLS, cheap ones first — user asked to see these while the 217M-layout
# skull+gem cell grinds. All at the page's EFFECTIVE stats (crit 44 = typed 38 + Arcane Impact,
# Tirisfal on), step 10 so each is ~7M layouts rather than ~218M.
# The kit is the user's own Phase-2 pick: *"In phase 2 it's undoubtedly strongest to run Icon + SCB"*.
cd /home/user/Kory123
SP=/tmp/claude-0/-home-user-Kory123/748f90bc-756f-501a-a357-d8ad35b82fc7/scratchpad
OUT=$SP/derive4.jsonl
LOG=$SP/nonati.log
lb() { local n=$1; shift; echo "=== $n ===" >> $LOG
       node tools/lattice-brute.mjs --jobs=4 --top=16 --out=$OUT "$@" >> $LOG 2>&1
       echo "  [done $n]" >> $LOG; }
# icon+gem (the current best-in-slot pair) across length x Lust timing
for T in 120 140 160 180; do
  for L in 5 20 40; do
    lb "N-T${T}-lust${L}" --T=$T --lust=$L --sp=1387 --crit=44 --t5two --step=10
  done
done
# the other legal trinket pairings, same fight
lb N-icon+skull   --T=120 --lust=20 --sp=1387 --crit=44 --t5two --step=10 --kit=icyVeins,isc,skull,arcanePower,berserking
lb N-skull+mqg    --T=120 --lust=20 --sp=1387 --crit=44 --t5two --step=10 --kit=icyVeins,skull,mqg,arcanePower,berserking
lb N-icon+mqg     --T=120 --lust=20 --sp=1387 --crit=44 --t5two --step=10 --kit=icyVeins,isc,mqg,arcanePower,berserking
lb N-drums        --T=120 --lust=20 --sp=1387 --crit=44 --t5two --step=10 --kit=icyVeins,isc,scb,drums,arcanePower,berserking
lb N-pi           --T=120 --lust=20 --sp=1387 --crit=44 --t5two --step=10 --kit=icyVeins,isc,scb,powerInfusion,arcanePower,berserking
echo "NONATI DONE" >> $LOG
