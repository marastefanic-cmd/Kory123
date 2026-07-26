# Rebuilding the sim rig from PUBLIC source (verified 07-26)

The old rig was a **fork** of `wowsims/tbc` with the modern APL core back-ported in; it lived in an
ephemeral scratchpad and died with its container (TOOLING). **You do not need that fork.** Everything
the harness requires exists in the public archived repo, and this directory proves it end to end.

## Build (≈2 min, fresh container)

```sh
git clone --depth 1 https://github.com/wowsims/tbc.git      # HEAD 7a2613fd (archived 2026-07-24)
cd tbc
apt-get install -y protobuf-compiler                        # protoc 3.21.12
GOBIN=/usr/local/bin go install google.golang.org/protobuf/cmd/protoc-gen-go@v1.28.0
protoc -I=./proto --go_out=./sim/core ./proto/*.proto       # sim/core/proto is GENERATED, not committed
mkdir -p cmd/smoke && cp <this dir>/smoke-main.go cmd/smoke/main.go
go build -o smoke ./cmd/smoke && ./smoke
```

Expected output (deterministic, `RandomSeed: 1`, 200 iterations, 180 s):

```
SCHEDULED-PRESS TEST (Arcane Power, SpellID 12042):
  AP@0 (+180 auto)             dps=585.47
  AP@90                        dps=567.74
  AP@0,90                      dps=585.47
SCHEDULING HONORED — press times change the result (spread 17.73 dps)
```

## The four things this establishes

1. **The base builds from public source.** No fork, no `ade9f39` (which exists in no public wowsims
   repo — see TOOLING for the three-way proof).
2. **`sim/core/proto` is generated.** A bare clone does not compile until `protoc` runs. That single
   missing step is why a naive rebuild looks impossible.
3. **The item DB is committed as Go source** — `sim/core/items/all_items.go`, 1.9 MB, ~4513 entries.
   No `db.bin`, no `-tags with_db`, no DB generation. The most-feared blocker does not exist here.
4. **★★ SCHEDULED PRESSES ARE NATIVE.** `proto.Cooldowns{ Cooldown{ Id, Timings []float64 } }` on the
   Player, consumed by `sim/core/major_cooldown.go` (`GetTimings`). `Timings` is *exactly* the
   press-time list `tools/genapl.mjs` already emits. **So the APL back-port was never necessary** —
   and neither is `apl-schedule-strict-ready.patch`, which existed only to fix an APL drop-bug.

## What is still owed

- **Port `wowsims-patches/runner-main.go`** to this API: drop `-apl` / `proto.APLRotation`
  (nonexistent here) and set `player.Cooldowns` from the press list instead. Also re-check
  `proto.UnitStats` (the bonus-stat injection path) against this older proto.
- **Re-target `ap-cd-at-cast.patch`** — there is no `sim/mage/arcane_power.go`; Arcane Power is
  `registerArcanePowerCD()` at `sim/mage/talents.go:211` (`SpellID: 12042`). The patch's purpose is
  unchanged: stop the aura's `OnExpire` re-setting the CD, restoring the true 180 s cadence.
- **⚠ THE REFERENCE GEAR EXPORT IS LOST AND CANNOT BE REBUILT.** `export.json` died with the same
  scratchpad. `tools/reference-gear.mjs` keeps only derived parameters (`t5two`, effective
  `sp ≈ 1450`) and the Tirisfal item IDs — not the gear list the sim consumes. This smoke test uses
  the repo's own `mage.P1FireGear` preset, which is **not** the reference gear. Until the export is
  supplied, any re-certified trust anchor is a NEW baseline and historical corpus numbers are not
  directly comparable to it. **This is data, not code — ask the owner.**
