// TBC runner, rebuilt against PUBLIC archived wowsims/tbc (HEAD 7a2613fd).
// Replaces the lost fork's APL-based scheduling with the sim's OWN native mechanism:
// player.Cooldowns = { Cooldown{ Id: SpellID, Timings: []float64 } }.
//
// ⚠ STAT INDICES ARE TYPED, NOT NUMERIC. The previous runner hardcoded MODERN wowsims indices
// (haste=14, mana=34, mp5=35, crit=13, spirit=16). In THIS proto they are haste=16, mana=24,
// mp5=13, crit=15, spirit=4 — so those literals would have injected the wrong stat silently.
// Using proto.Stat_* constants makes that class of bug impossible.
package main

import (
	"encoding/json"
	"flag"
	"fmt"
	"os"

	"github.com/wowsims/tbc/sim"
	"github.com/wowsims/tbc/sim/core"
	"github.com/wowsims/tbc/sim/core/proto"
	"github.com/wowsims/tbc/sim/mage"
)

func init() { sim.RegisterAll() }

func main() {
	cdsPath := flag.String("cds", "", `press schedule json: {"12042":[8,188],"33697":[4,182]}`)
	dur := flag.Float64("dur", 180, "encounter duration seconds")
	varn := flag.Float64("var", 0, "encounter duration variation seconds")
	iter := flag.Int("iter", 1000, "iterations")
	seed := flag.Int64("seed", 1, "random seed")
	tag := flag.String("tag", "", "label for the output line")
	haste := flag.Float64("haste", 0, "extra SpellHasteRating")
	critr := flag.Float64("crit", 0, "extra SpellCritRating")
	spd := flag.Float64("sp", 0, "extra SpellPower")
	mana := flag.Float64("mana", 0, "extra flat Mana (big = ~infinite)")
	targets := flag.Int("targets", 1, "target count (AoE)")
	flag.Parse()

	player := &proto.Player{
		Name: "arcane", Race: proto.Race_RaceGnome, Class: proto.Class_ClassMage,
		Equipment: mage.P1FireGear, Spec: mage.PlayerOptionsArcane,
		Consumes: &proto.Consumes{}, Buffs: &proto.IndividualBuffs{},
	}

	bonus := make([]float64, 42)
	add := func(s proto.Stat, v float64) {
		if v != 0 {
			bonus[int(s)] += v
		}
	}
	add(proto.Stat_StatSpellHaste, *haste)
	add(proto.Stat_StatSpellCrit, *critr)
	add(proto.Stat_StatSpellPower, *spd)
	add(proto.Stat_StatMana, *mana)
	player.BonusStats = bonus

	if *cdsPath != "" {
		raw, err := os.ReadFile(*cdsPath)
		if err != nil {
			panic(err)
		}
		var sched map[string][]float64
		if err := json.Unmarshal(raw, &sched); err != nil {
			panic("cds: " + err.Error())
		}
		cds := &proto.Cooldowns{}
		for idStr, times := range sched {
			var id int32
			if _, err := fmt.Sscanf(idStr, "%d", &id); err != nil {
				panic("cds key not a spell id: " + idStr)
			}
			cds.Cooldowns = append(cds.Cooldowns, &proto.Cooldown{
				Id:      &proto.ActionID{RawId: &proto.ActionID_SpellId{SpellId: id}},
				Timings: times,
			})
		}
		player.Cooldowns = cds
	}

	tgts := make([]*proto.Target, 0, *targets)
	for i := 0; i < *targets; i++ {
		tgts = append(tgts, &proto.Target{Level: 73, MobType: proto.MobType_MobTypeDemon})
	}
	req := &proto.RaidSimRequest{
		Raid:       &proto.Raid{Parties: []*proto.Party{{Players: []*proto.Player{player}}}},
		Encounter:  &proto.Encounter{Duration: *dur, DurationVariation: *varn, Targets: tgts},
		SimOptions: &proto.SimOptions{Iterations: int32(*iter), RandomSeed: *seed, IsTest: true},
	}
	res := core.RunRaidSim(req)
	if res.ErrorResult != "" {
		fmt.Println("SIM ERROR:", res.ErrorResult)
		os.Exit(1)
	}
	d := res.RaidMetrics.Parties[0].Players[0].Dps
	fmt.Printf("%s\tdps=%.4f\tstdev=%.4f\titer=%d\tdur=%.1f\tvar=%.1f\n", *tag, d.Avg, d.Stdev, *iter, *dur, *varn)
}
