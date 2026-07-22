package main

import (
	"encoding/json"
	"flag"
	"fmt"
	"os"

	"github.com/wowsims/tbc/sim"
	"github.com/wowsims/tbc/sim/core"
	"github.com/wowsims/tbc/sim/core/proto"
	"google.golang.org/protobuf/encoding/protojson"
)

func init() { sim.RegisterAll() }

// raw shape of the user's wowsims individual export
type exportShape struct {
	RaidBuffs  json.RawMessage `json:"raidBuffs"`
	Debuffs    json.RawMessage `json:"debuffs"`
	PartyBuffs json.RawMessage `json:"partyBuffs"`
	Player     json.RawMessage `json:"player"`
	Encounter  json.RawMessage `json:"encounter"`
}

func main() {
	exportPath := flag.String("export", "", "user's wowsims individual export json")
	aplPath := flag.String("apl", "", "optional APLRotation json to replace player.rotation")
	dur := flag.Float64("dur", -1, "encounter duration seconds (override; <0 keeps export)")
	varn := flag.Float64("var", -1, "encounter duration variation seconds (override; <0 keeps export)")
	iter := flag.Int("iter", 10000, "iterations")
	seed := flag.Int64("seed", 1, "random seed")
	tag := flag.String("tag", "", "label for output line")
	mana := flag.Float64("mana", 0, "extra flat Mana added via bonusStats (0=none; big=~infinite)")
	haste := flag.Float64("haste", 0, "extra SpellHasteRating added via bonusStats")
	critr := flag.Float64("crit", 0, "extra SpellCritRating added via bonusStats (negative to suppress crit; ~22.08/1%)")
	spd := flag.Float64("sp", 0, "extra SpellDamage (spell power) added via bonusStats")
	intel := flag.Float64("int", 0, "extra Intellect added via bonusStats (finite-mana EP)")
	spirit := flag.Float64("spirit", 0, "extra Spirit added via bonusStats (finite-mana EP)")
	mp5 := flag.Float64("mp5", 0, "extra MP5 added via bonusStats (finite-mana EP)")
	quiet := flag.Bool("quiet", false, "only print the TSV result line")
	dumpreq := flag.String("dumpreq", "", "write the built RaidSimRequest as protojson to this path (audit trust-anchor), then continue")
	targets := flag.Int("targets", 0, "override target count for AoE (duplicate target[0] to N; 0=keep export)")
	flag.Parse()

	data, err := os.ReadFile(*exportPath)
	if err != nil {
		panic(err)
	}
	var ex exportShape
	if err := json.Unmarshal(data, &ex); err != nil {
		panic(err)
	}

	opt := protojson.UnmarshalOptions{DiscardUnknown: true}
	player := &proto.Player{}
	raidBuffs := &proto.RaidBuffs{}
	partyBuffs := &proto.PartyBuffs{}
	debuffs := &proto.Debuffs{}
	enc := &proto.Encounter{}
	if len(ex.Player) > 0 {
		if err := opt.Unmarshal(ex.Player, player); err != nil {
			panic("player: " + err.Error())
		}
	}
	if len(ex.RaidBuffs) > 0 {
		opt.Unmarshal(ex.RaidBuffs, raidBuffs)
	}
	if len(ex.PartyBuffs) > 0 {
		opt.Unmarshal(ex.PartyBuffs, partyBuffs)
	}
	if len(ex.Debuffs) > 0 {
		opt.Unmarshal(ex.Debuffs, debuffs)
	}
	if len(ex.Encounter) > 0 {
		if err := opt.Unmarshal(ex.Encounter, enc); err != nil {
			panic("encounter: " + err.Error())
		}
	}

	// optional APL override
	if *aplPath != "" {
		arot := &proto.APLRotation{}
		ad, err := os.ReadFile(*aplPath)
		if err != nil {
			panic(err)
		}
		if err := opt.Unmarshal(ad, arot); err != nil {
			panic("apl: " + err.Error())
		}
		if player.Rotation == nil {
			player.Rotation = &proto.APLRotation{}
		}
		player.Rotation.Type = proto.APLRotation_TypeAPL
		player.Rotation.PrepullActions = arot.PrepullActions
		player.Rotation.PriorityList = arot.PriorityList
		if arot.ValueVariables != nil {
			player.Rotation.ValueVariables = arot.ValueVariables
		}
		if arot.Groups != nil {
			player.Rotation.Groups = arot.Groups
		}
	}

	// inject flat mana / haste rating via bonusStats (Mana=34, SpellHasteRating=14)
	ensureStats := func(n int) {
		if player.BonusStats == nil {
			player.BonusStats = &proto.UnitStats{}
		}
		for len(player.BonusStats.Stats) <= n {
			player.BonusStats.Stats = append(player.BonusStats.Stats, 0)
		}
	}
	if *mana > 0 {
		ensureStats(34)
		player.BonusStats.Stats[34] += *mana
	}
	if *haste != 0 {
		ensureStats(14)
		player.BonusStats.Stats[14] += *haste
	}
	if *critr != 0 {
		ensureStats(13)
		player.BonusStats.Stats[13] += *critr
	}
	if *spd != 0 {
		ensureStats(5)
		player.BonusStats.Stats[5] += *spd
	}
	if *intel != 0 {
		ensureStats(3)
		player.BonusStats.Stats[3] += *intel
	}
	if *spirit != 0 {
		ensureStats(16)
		player.BonusStats.Stats[16] += *spirit
	}
	if *mp5 != 0 {
		ensureStats(35)
		player.BonusStats.Stats[35] += *mp5
	}

	if *dur >= 0 {
		enc.Duration = *dur
	}
	if *varn >= 0 {
		enc.DurationVariation = *varn
	}
	// AoE: duplicate target[0] up to N targets so Arcane Explosion (CalcAndDealAoeDamage)
	// hits N mobs. Config protos are read-only input; sharing the pointer is safe (the sim
	// builds a separate Unit per entry). Lets the harness value an AoE phase in isolation.
	if *targets > 0 {
		if len(enc.Targets) == 0 {
			panic("--targets set but encounter has no target[0] to duplicate")
		}
		base := enc.Targets[0]
		enc.Targets = enc.Targets[:1]
		for len(enc.Targets) < *targets {
			enc.Targets = append(enc.Targets, base)
		}
	}

	req := &proto.RaidSimRequest{
		Raid:      core.SinglePlayerRaidProto(player, partyBuffs, raidBuffs, debuffs),
		Encounter: enc,
		SimOptions: &proto.SimOptions{
			Iterations: int32(*iter),
			IsTest:     false,
			Debug:      false,
			RandomSeed: *seed,
		},
	}

	if *dumpreq != "" {
		out, merr := protojson.MarshalOptions{EmitUnpopulated: true, Multiline: true}.Marshal(req)
		if merr != nil {
			panic("dumpreq marshal: " + merr.Error())
		}
		if werr := os.WriteFile(*dumpreq, out, 0644); werr != nil {
			panic("dumpreq write: " + werr.Error())
		}
	}

	logMode := os.Getenv("SIMLOG") == "1"
	var res *proto.RaidSimResult
	if logMode {
		req.SimOptions.Iterations = 1
		req.SimOptions.Debug = true
		res = core.RunRaidSim(req)
		fmt.Fprintln(os.Stderr, res.Logs)
	} else {
		res = core.RunRaidSimConcurrent(req)
	}
	if res.Error != nil {
		fmt.Fprintln(os.Stderr, "SIM ERROR:", res.Error.Message)
		os.Exit(1)
	}
	pm := res.RaidMetrics.Parties[0].Players[0]
	dps := pm.Dps
	// TSV: tag  dur  var  iter  dpsAvg  dpsStdev  dpsMax  avgDuration
	fmt.Printf("%s\t%.0f\t%.0f\t%d\t%.1f\t%.1f\t%.1f\t%.2f\n",
		*tag, enc.Duration, enc.DurationVariation, *iter,
		dps.Avg, dps.Stdev, dps.Max, res.AvgIterationDuration)
	if !*quiet {
		fmt.Fprintf(os.Stderr, "[%s] dur=%.0f±%.0f iters=%d  DPS=%.1f (±%.1f)  avgFight=%.2fs\n",
			*tag, enc.Duration, enc.DurationVariation, *iter, dps.Avg, dps.Stdev, res.AvgIterationDuration)
	}
}
