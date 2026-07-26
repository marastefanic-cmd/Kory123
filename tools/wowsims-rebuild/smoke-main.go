// Smoke test: prove archived wowsims/tbc can sim an Arcane mage from a fresh clone,
// and that a cooldown press can be SCHEDULED via MajorCooldown.ShouldActivate
// (the mechanism that replaces the lost fork's APL scheduling).
package main

import (
	"fmt"

	"github.com/wowsims/tbc/sim"
	"github.com/wowsims/tbc/sim/core"
	"github.com/wowsims/tbc/sim/core/proto"
	"github.com/wowsims/tbc/sim/mage"
)

func init() { sim.RegisterAll() }

func max3(a, b, c float64) float64 { m := a; if b > m { m = b }; if c > m { m = c }; return m }
func min3(a, b, c float64) float64 { m := a; if b < m { m = b }; if c < m { m = c }; return m }

var apTimes = []float64{}

func main() {
	player := &proto.Player{
		Name:      "arcane",
		Race:      proto.Race_RaceGnome,
		Class:     proto.Class_ClassMage,
		Equipment: mage.P1FireGear,
		Spec:      mage.PlayerOptionsArcane,
		Consumes:  &proto.Consumes{},
		Buffs:     &proto.IndividualBuffs{},
		Cooldowns: &proto.Cooldowns{Cooldowns: []*proto.Cooldown{
			// SCHEDULED PRESSES — the native TBC mechanism that replaces the lost fork's APL.
			{Id: &proto.ActionID{RawId: &proto.ActionID_SpellId{SpellId: 12042}}, Timings: apTimes}, // Arcane Power
		}},
	}
	req := &proto.RaidSimRequest{
		Raid: &proto.Raid{
			Parties: []*proto.Party{{Players: []*proto.Player{player}}},
		},
		Encounter: &proto.Encounter{
			Duration: 180,
			Targets:  []*proto.Target{{Level: 73, MobType: proto.MobType_MobTypeDemon}},
		},
		SimOptions: &proto.SimOptions{Iterations: 200, RandomSeed: 1, IsTest: true},
	}
	run := func(times []float64, label string) float64 {
		player.Cooldowns.Cooldowns[0].Timings = times
		res := core.RunRaidSim(req)
		if res.ErrorResult != "" {
			fmt.Println("SIM ERROR:", res.ErrorResult)
			return 0
		}
		d := res.RaidMetrics.Parties[0].Players[0].Dps.Avg
		fmt.Printf("  %-28s dps=%.2f\n", label, d)
		return d
	}
	fmt.Println("SCHEDULED-PRESS TEST (Arcane Power, SpellID 12042):")
	a := run([]float64{0}, "AP@0 (+180 auto)")
	b := run([]float64{90}, "AP@90")
	c := run([]float64{0, 90}, "AP@0,90")
	if a != b || a != c {
		fmt.Printf("SCHEDULING HONORED — press times change the result (spread %.2f dps)\n", max3(a,b,c)-min3(a,b,c))
	} else {
		fmt.Println("✗ timings appear ignored — all three runs identical")
	}
}
