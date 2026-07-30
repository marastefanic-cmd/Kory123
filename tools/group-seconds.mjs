// DOES THE PLAN COLLAPSE ONTO A FEW DERIVABLE SECONDS? — and does it still, off h=0 and off one kit?
//
//   node tools/group-seconds.mjs                         # the default sweep
//   node tools/group-seconds.mjs --haste=0,150,300,450   # pick the haste ladder
//   node tools/group-seconds.mjs --T=120 --lust=5
//
// ── WHAT THIS IS FOR ─────────────────────────────────────────────────────────────────────────────
// `docs/PHASE13.md` §3 wants to replace the descent with a CONSTRUCTIVE enumeration: derive the few
// seconds a press could sensibly sit on, then enumerate assignments. Two claims have to hold for that
// to be worth building, and both were measured on 2026-07-30 at **one haste level with one kit**:
//
//   (A) the plan COLLAPSES — all seven declared layouts put 6–8 presses on **≤3 distinct seconds**.
//   (B) those seconds are DERIVABLE — every one of them is in
//         G = {pull, raid calls, intermission exits} ∪ {anchor + time-to-3-stacks}
//             closed under {+dur(k), +cd(k)} for the ENABLED kit.
//       T6's [7,27,37] is `3-stack`, `+IV dur`, `+Zerk dur`. T2's [20,140] is `Lust call`,
//       `+trinket cd`. Nothing there is intuition; it is arithmetic on the kit.
//
// ⚠⚠ THE USER'S OBJECTION IS THE WHOLE REASON THIS FILE EXISTS: *"well this trinket combination for
// this haste level right. It's gonna be very different."* Correct. So:
//   · **G is derived per setup** — it reads each ENABLED buff's own duration and cooldown, so swapping
//     trinkets changes the lattice with them. That part is gear-agnostic by construction.
//   · **The anchor is NOT a constant.** Three Arcane Blast stacks land at 6.498 s unbuffed, 4.998 s
//     under Bloodlust, 4.165 s under Bloodlust + Icy Veins, 3.513 s under Bloodlust + IV at 300 haste.
//     And it is SELF-REFERENTIAL: the anchor depends on which haste buffs are up, which depends on
//     where you press them. Rather than iterate a fixed point, G seeds the ramp at every multiplier
//     the kit can plausibly be under — the union is small and cheap.
//   · **(A) is the fragile claim, and this file exists to break it.** `docs/RULES.md` §5 says the
//     layout SPREADS as gear haste grows (Icy Veins slides out of Lust), so a rising |S| at high haste
//     is the EXPECTED failure, not a surprise. Read a rising |S| as information about the enumeration's
//     cost, not as a bug.
//
// ⛔ This asserts nothing and gates nothing. It is a measurement that decides whether PHASE13 §3 is
// cheap or expensive. Do not wire it into CI.
import { loadEngine, cfgFor, ALL_BUFFS } from './engine-node.mjs';

const args = process.argv.slice(2);
const listArg = (n, d) => { const a = args.find(x => x.startsWith(`--${n}=`)); return a ? a.split('=')[1].split(',').map(Number) : d; };
const numArg = (n, d) => { const a = args.find(x => x.startsWith(`--${n}=`)); return a ? +a.split('=')[1] : d; };

const api = loadEngine(new URL('../index.html', import.meta.url).pathname);
const G = api.GAME, B = api.BUFFS;
const msq = x => Math.round(x * 1000) / 1000;

// Time until 3 Arcane Blast stacks are LIVE, at a prevailing haste multiplier m.
const rampAt = m => { let t = 0;
  for (let k = 0; k < G.AB.MAX_STACKS; k++)
    t += Math.max(msq((G.AB.BASE_CAST - G.AB.STACK_CAST_REDUCTION * k) / m), msq(Math.max(G.GCD_FLOOR, G.GCD_BASE / m)));
  return t; };

/* THE GENERATOR. Everything here is read off `cfg` — no constant is specific to a kit or a gear set. */
function groupSeconds(cfg) {
  const tracks = ALL_BUFFS.filter(k => cfg.enabled[k] && !cfg.fixed[k] && B[k].kind !== 'proc');
  const base = 1 + (cfg.hasteRating || 0) / ((G.HASTE_PER_PCT || 15.77) * 100);
  // every multiplier the kit can plausibly be under while the opener runs — the self-reference, taken
  // as a union instead of a fixed point (cheaper, and it cannot miss the true one).
  const mults = new Set([base]);
  for (const k of [...tracks, ...Object.keys(cfg.fixed || {})])
    if (B[k] && B[k].kind === 'mult') { for (const m of [...mults]) mults.add(m * B[k].value); }

  const anchors = new Set([0]);
  for (const ts of Object.values(cfg.fixed || {})) for (const t of ts) anchors.add(Math.round(t));
  for (const seg of cfg.segments || []) if (seg.type !== 'normal') anchors.add(Math.round(seg.end));

  const out = new Set();
  for (const a of anchors) { out.add(a); for (const m of mults) out.add(Math.ceil(a + rampAt(m) - 1e-9)); }
  for (const g of [...out]) for (const k of tracks) { out.add(g + B[k].dur); out.add(g + B[k].cd); }
  for (const k of tracks) out.add(Math.max(0, cfg.T - B[k].dur));
  return new Set([...out].filter(t => t >= 0 && t <= cfg.T - 1));
}

const KITS = {
  'IV+Icon+Gem+AP+Zerk': ['icyVeins', 'isc', 'scb', 'arcanePower', 'berserking', 'bloodlust'],
  'IV+Skull+MQG+AP':     ['icyVeins', 'skull', 'mqg', 'arcanePower', 'bloodlust'],
  'IV+Icon+AP (no gem)': ['icyVeins', 'isc', 'arcanePower', 'bloodlust'],
};
const HASTE = listArg('haste', [0, 150, 300, 450]);
const T = numArg('T', 120), LUST = numArg('lust', 5);

console.log(`# GROUP SECONDS — does the plan collapse, and is the collapse DERIVABLE?`);
console.log(`#   fight ${Math.floor(T / 60)}:${String(T % 60).padStart(2, '0')} · Lust ${LUST} · 1387 SP · 38 % crit\n`);
console.log('  kit                    haste   presses  |S|  press seconds                    in G?');
console.log('  ' + '-'.repeat(96));

const tally = {};
for (const [kitName, kit] of Object.entries(KITS)) {
  for (const h of HASTE) {
    const cfg = cfgFor(api, { name: 'probe', T, pins: { bloodlust: [LUST] }, kit, gear: { haste: h, sp: 1387, crit: 38 } });
    const best = await api.optimizeAsync(cfg, undefined, () => {});
    const presses = [];
    for (const k of Object.keys(best.s)) for (const t of best.s[k]) presses.push(Math.round(t));
    const S = [...new Set(presses)].sort((a, b) => a - b);
    const Gs = groupSeconds(cfg);
    const outside = S.filter(t => !Gs.has(t));
    tally[S.length] = (tally[S.length] || 0) + 1;
    console.log(`  ${kitName.padEnd(22)} ${String(h).padStart(4)}   ${String(presses.length).padStart(6)}  ${String(S.length).padStart(3)}  ` +
      `[${S.join(', ')}]`.padEnd(32) + `  ${outside.length ? '⛔ ' + outside.join(',') + ' NOT derivable' : '✓ all ' + Gs.size + ' derivable'}`);
  }
}
const keys = Object.keys(tally).map(Number).sort((a, b) => a - b);
console.log(`\n  |S| distribution: ${keys.map(k => `${k}→${tally[k]}`).join('  ')}`);
console.log(`  max |S| = ${Math.max(...keys)}   ${Math.max(...keys) <= 3
  ? '— the ≤3 collapse HOLDS across this sweep'
  : '— ⚠ the ≤3 collapse is BROKEN here; PHASE13 §3 must size its enumeration for the larger |S|'}`);
