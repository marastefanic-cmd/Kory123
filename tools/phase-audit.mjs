// PHASE AUDIT — how much of a ranking is decided by an input the user cannot specify.
//
// ★ WHAT THIS MEASURES, AND WHY IT IS NOT "the scorer is wrong".
// The per-cast sum is EXACT. Given the same fight it reproduces wowsims' Arcane Blast count to
// **0.002 casts** across a nine-layout sweep (`--mode duel`, and the table in MODEL-DEFECTS D1).
// Nothing below disputes that. The problem is one layer up: the fight the planner is handed is
// **over-specified**.
//
// A planner input like "the shaman Bloodlusts at 0:20" is known to the second and no further. But
// Bloodlust's window runs `[call, call + 40]`, and the useful part of it starts at your next cast
// boundary — so 20.000 and 20.415 are two different fights, differing by up to **0.21 casts**. That
// is larger than the Berserking × Bloodlust interaction (+0.2056 casts, ESTABLISHED-FACTS P4) the
// plan is supposed to be resolving. Slide the call across one cast interval and today's ranking
// flips Berserking from OUTSIDE Bloodlust to INSIDE it — on 100 ms of an input nobody controls.
//
// ⇒ The quantity a planner may rank on has to be **invariant to the phase of the player's cast
// stream against the raid's clock**. That phase is set by pull reaction, latency, and every
// non-Arcane-Blast global; after a minute of casting it is uniform over one interval. There is no
// free parameter here — the averaging width is one full lattice period, which is what makes the
// average a phase average at all.
//
// ⚠⚠ THE RANDOMISER IS THE WHOLE POINT AND IT IS EASY TO GET BACKWARDS. An earlier attempt averaged
// over PRESS offsets — moving each press against a fixed lattice — and scored 0/4 on the ground-truth
// corpus. That is the wrong unknown: a player DOES control when they press relative to their own
// casting (they press between casts). What they do not control is where their cast stream sits
// relative to the raid's clock. So the lattice slides and the WALL EVENTS stay:
//
//     engine t=0 IS the first cast, so "lattice δ later" == every wall event and T, δ EARLIER.
//
// Modes:
//   anchor  (default)  slide one wall event across a cast interval; print each ranking's answer
//   pair               score two named layouts under both rankings
//   sweep              one press swept, point vs phase-mean, side by side
//
//   node tools/phase-audit.mjs
//   node tools/phase-audit.mjs --mode sweep --press berserking --from 35 --to 65
import { loadEngine, ALL_BUFFS } from './engine-node.mjs';
import path from 'path';
import { fileURLToPath } from 'url';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const argv = process.argv.slice(2);
const arg = (k, d) => {
  const i = argv.indexOf('--' + k);
  if (i >= 0 && argv[i + 1] !== undefined && !argv[i + 1].startsWith('--')) return argv[i + 1];
  const e = argv.find(a => a.startsWith(`--${k}=`));
  return e ? e.slice(k.length + 3) : d;
};
const die = m => { console.error('phase-audit: ' + m); process.exit(2); };

const api = loadEngine(path.join(REPO, 'index.html'));
// FALSE-PASS GUARD: this tool's whole claim is about the post-PHASE12 objective. An engine without
// per-cast `frac` is the retired one and every number below would be meaningless.
{
  const c = { T: 30, hasteRating: 0, sp: 1000, critPct: 25, enabled: {}, fixed: {}, warnings: [], coldSnap: true, segments: null };
  const probe = api.simulate(api.repair({}, c), c, true);
  if (!probe.casts || probe.casts[0].frac === undefined)
    die('this index.html predates the boundary-credit board (casts[].frac). Refusing to print.');
}

const MODE   = arg('mode', 'anchor');
const T      = +arg('T', 120);
const SP     = +arg('sp', 1000);
const CRIT   = +arg('crit', 25);
const HASTE  = +arg('haste', 0);
const N      = +arg('n', 48);
// One full lattice period at the fight's SLOWEST rate — the bare interval. Faster segments have
// shorter periods, so a bare-interval sweep covers every one of them at least once. Read from the
// engine's own constants; never re-typed (reference-gear doctrine).
const PERIOD = Math.max(api.GAME.GCD_FLOOR, api.GAME.GCD_BASE / (1 + HASTE / (api.GAME.HASTE_RATING_PER_PCT * 100)));
if (!Number.isFinite(PERIOD) || PERIOD <= 0) die('could not derive the lattice period from GAME — the constants table moved.');

const KIT = (arg('kit', 'icyVeins,isc,scb,arcanePower,berserking,bloodlust')).split(',');
const cfgFor = (sched, TT) => ({
  T: TT, hasteRating: HASTE, sp: SP, critPct: CRIT,
  enabled: Object.fromEntries(ALL_BUFFS.map(k => [k, KIT.includes(k)])),
  fixed: sched.bloodlust ? { bloodlust: sched.bloodlust } : {},
  warnings: [], coldSnap: true, segments: null,
});
const board = (sched, TT) => {
  const cfg = cfgFor(sched, TT);
  return api.simulate(api.repair(JSON.parse(JSON.stringify(sched)), cfg), cfg, true);
};
const point = (sched, TT, casts) => {
  const r = board(sched, TT);
  return casts ? r.casts.reduce((a, c) => a + (c.frac ?? 1), 0) : r.robust;
};
// The slide. A press already at the pull stays at the pull — you cannot react before the pull.
const slide = (s, d) => Object.fromEntries(Object.entries(s).map(([k, v]) => [k, v.map(x => Math.max(0, x - d))]));
const phaseMean = (sched, TT, casts) => {
  let a = 0;
  for (let i = 0; i < N; i++) {
    const d = i * PERIOD / N;
    // + d/PERIOD re-adds the casting time the slide took off the front, in cast units, so the mean is
    // comparable to a point score. It is the SAME constant for every layout, so it cancels in any
    // comparison — it is here only to keep the printed number readable.
    a += point(slide(sched, d), TT - d, casts) + (casts ? d / PERIOD : 0);
  }
  return a / N;
};

// ── mode: anchor ─────────────────────────────────────────────────────────────────────────────────
// Slide ONE wall event across a cast interval and print where each ranking puts a press.
if (MODE === 'anchor') {
  const WALL   = arg('wall', 'bloodlust');
  const WALL_T = +arg('wall-at', 20);
  const PRESS  = arg('press', 'berserking');
  const ZS     = (arg('candidates', '35,40,45,50,53,55,57,60,65')).split(',').map(Number);
  const INSIDE = +arg('inside-through', 50);   // for the ✓/✗ annotation only — never used to rank

  console.log(`\n  ${PRESS} placement, as a function of when the raid is assumed to ${WALL}.`);
  console.log(`  ${WALL_T.toFixed(3)} … ${(WALL_T + PERIOD).toFixed(3)} is ONE cast interval of the SAME instruction:`);
  console.log(`  "${WALL} at ${Math.floor(WALL_T / 60)}:${String(Math.round(WALL_T % 60)).padStart(2, '0')}". A ranking fit to be an answer must not move across it.\n`);

  for (const mode of ['POINT (what the tool ranks on today)', `PHASE-MEAN (${N} samples over one ${PERIOD.toFixed(3)} s period)`]) {
    const isPoint = mode.startsWith('POINT');
    console.log(`  ── ${mode} ──`);
    console.log('  ' + WALL.padEnd(9) + '|' + ZS.map(z => String(z).padStart(9)).join('') + ' | picks');
    const picks = new Set();
    for (let k = 0; k <= 4; k++) {
      const at = WALL_T + k * PERIOD / 4;
      const vals = ZS.map(z => {
        const s = { [WALL]: [at], icyVeins: [0, at], [PRESS]: [z] };
        if (PRESS === WALL) die('--press and --wall must differ');
        return isPoint ? point(s, T, true) : phaseMean(s, T, true);
      });
      const mx = Math.max(...vals), bi = vals.indexOf(mx);
      picks.add(ZS[bi]);
      console.log(`  ${at.toFixed(3).padStart(9)}|` + vals.map(v => (v - mx).toFixed(4).padStart(9)).join('') +
                  ` | @${ZS[bi]} ${ZS[bi] <= INSIDE ? 'INSIDE ✓' : 'OUTSIDE ✗'}`);
    }
    console.log(`  ⇒ ${picks.size === 1 ? `STABLE — one answer (@${[...picks][0]}) across the whole interval`
                                        : `UNSTABLE — ${picks.size} different answers (@${[...picks].join(', @')}) across 1 cast interval`}\n`);
  }
  process.exit(0);
}

// ── mode: sweep ──────────────────────────────────────────────────────────────────────────────────
if (MODE === 'sweep') {
  const PRESS = arg('press', 'berserking');
  const BL    = +arg('bl', 20);
  const from = +arg('from', 35), to = +arg('to', 65), step = +arg('step', 5);
  console.log(`\n  ${PRESS} sweep · T=${T} · ${SP} SP · ${CRIT}% crit · ${HASTE} haste · Lust@${BL}\n`);
  console.log('  press | point Σfrac | phase-mean | Δ point | Δ phase-mean');
  const rows = [];
  for (let z = from; z <= to + 1e-9; z += step) {
    const s = { bloodlust: [BL], icyVeins: [0, BL], [PRESS]: [z] };
    rows.push({ z, pt: point(s, T, true), ph: phaseMean(s, T, true) });
  }
  const bp = Math.max(...rows.map(r => r.pt)), bh = Math.max(...rows.map(r => r.ph));
  for (const r of rows)
    console.log(`  ${String(r.z).padStart(5)} | ${r.pt.toFixed(4).padStart(11)} | ${r.ph.toFixed(4).padStart(10)} | ${(r.pt - bp).toFixed(4).padStart(7)} | ${(r.ph - bh).toFixed(4).padStart(12)}`);
  console.log(`\n  point argmax @${rows.find(r => r.pt === bp).z}   phase-mean argmax @${rows.find(r => r.ph === bh).z}`);
  process.exit(0);
}

// ── mode: pair ───────────────────────────────────────────────────────────────────────────────────
if (MODE === 'pair') {
  const A = JSON.parse(arg('a') || die('--mode pair needs --a and --b (JSON schedules)'));
  const B = JSON.parse(arg('b') || die('--mode pair needs --a and --b (JSON schedules)'));
  const pa = point(A, T), pb = point(B, T);
  const ma = phaseMean(A, T), mb = phaseMean(B, T);
  const one = pa / point(A, T, true);
  console.log(`\n  POINT       A ${pa.toFixed(1)}  B ${pb.toFixed(1)}   Δ ${(pa - pb).toFixed(1)}  (${((pa - pb) / one).toFixed(4)} casts)  → ${pa > pb ? 'A' : 'B'}`);
  console.log(`  PHASE-MEAN  A ${ma.toFixed(1)}  B ${mb.toFixed(1)}   Δ ${(ma - mb).toFixed(1)}  (${((ma - mb) / one).toFixed(4)} casts)  → ${ma > mb ? 'A' : 'B'}\n`);
  process.exit(0);
}

die(`unknown --mode ${MODE} (anchor | sweep | pair)`);
