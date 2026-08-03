// T8-CELL — the sim-settled ranking assertion the integral currently FAILS (MODEL-DEFECTS §9i).
//
//   node tools/t8-cell.mjs             # report · exit 0
//   node tools/t8-cell.mjs --strict    # exit 1 while the integral still ranks the challenger first
//
// ── WHY THIS FILE EXISTS, WRITTEN BEFORE THE FIX ─────────────────────────────────────────────────
// 08-02: a wowsims duel (retired tooling, rev 69f02dd, benchmark.mjs protocol) settled the one cell
// where the ranking integral and the per-cast board give OPPOSITE verdicts at 47× the tie band:
//
//     DECLARED (test T8)   isc[-5,115] scb[0,120] zerk[0]  IV[95,115] AP[120] BL[95]
//     CHALLENGER           isc[-5,115] scb[0,120] zerk[95] IV[20,115] AP[120] BL[95]
//
//     sim: DECLARED +4.2–4.3 DPS (+0.22 %) at 62–200σ · every seed · ≈ +0.20 effective casts
//     board (robust): DECLARED +0.2006 · phase-averaged over wall jitter: DECLARED +0.036
//     integral (the RANKING): CHALLENGER +0.0933  ← the wrong sign this file pins
//
// The integral is ~0.13 casts off the phase-averaged truth here (65× TIE_CASTS). §8f validated the
// integral on plain fights, so the missing term involves this cell's structure (interior intermission,
// kill-flush Lust, a capped window inside it, value flush with the kill) — isolation in §9i.
// ⚠ Success for any integral fix is BOTH lines green — flipping T8 by breaking the phase-averaged
// board agreement would be trading one wrong account for another. law-check must stay green beside it.
import { loadEngine, ALL_BUFFS } from './engine-node.mjs';

const HTML = (process.argv.find(a => a.startsWith('--html=')) || '').split('=')[1]
          || new URL('../index.html', import.meta.url).pathname;
const STRICT = process.argv.includes('--strict');
const api = loadEngine(HTML);
const G = api.GAME;

const KIT = ['icyVeins', 'isc', 'scb', 'arcanePower', 'berserking', 'bloodlust'];
const enabled = {}; for (const k of ALL_BUFFS) enabled[k] = KIT.includes(k);
const cfgAt = d => ({ T: 135, hasteRating: 0, sp: 1387, critPct: 38, coldSnap: true, t5two: false,
  enabled, fixed: { bloodlust: [95] }, warnings: [],
  segments: api.buildSegments([{ from: 15 + d, to: 20 + d, type: 'intermission', mult: 1, targets: 0 }], 135) });
const one = (G.AB.AVG_BASE_DMG + G.AB.COEF * 1387) * (1 + 0.38 * (G.CRIT_MULT - 1));

const DEC = { isc: [-5, 115], scb: [0, 120], berserking: [0], icyVeins: [95, 115], arcanePower: [120], bloodlust: [95] };
// the challenger's exit press rides the exit when the wall is jittered (the fixed-20 version measures
// a dead-zone head-loss confound, not phase — §9i records the mistake)
const CHL = d => ({ isc: [-5, 115], scb: [0, 120], berserking: [95], icyVeins: [20 + d, 115], arcanePower: [120], bloodlust: [95] });

let bad = 0;
console.log('# T8-CELL — the integral against the sim-settled verdict (MODEL-DEFECTS §9i)\n');
{
  const cfg = cfgAt(0);
  const f = s => api.simulate(api.repair(JSON.parse(JSON.stringify(s)), cfg), cfg, true).integral / one;
  const d = f(DEC), c = f(CHL(0));
  const ok = d >= c - 1e-9;
  if (!ok) bad++;
  console.log(`  ${ok ? '✓' : '⛔'} integral ranks DECLARED ≥ challenger   declared ${d.toFixed(6)}  challenger ${c.toFixed(6)}  Δ ${(d - c).toFixed(6)}`);
  console.log(`        sim ground truth: declared by ≈ +0.20 casts (62σ) · phase-averaged board: +0.036`);
}
{
  // the constraint a fix must NOT break: the phase-averaged board keeps preferring declared
  let s1 = 0, n = 0;
  for (let d = 0; d <= 1.45001; d += 0.05) {
    const cfg = cfgAt(d);
    const f = s => api.simulate(api.repair(JSON.parse(JSON.stringify(s)), cfg), cfg, true).robust / one;
    s1 += f(DEC) - f(CHL(d)); n++;
  }
  const ok = s1 / n > 0;
  if (!ok) bad++;
  console.log(`  ${ok ? '✓' : '⛔'} phase-averaged BOARD prefers declared   mean Δ ${(s1 / n).toFixed(4)} over ${n} wall phases`);
}
console.log(bad ? '\n⛔ the ranking integral still contradicts the sim on this cell — §9i is open.'
                : '\n✓ the integral agrees with the sim-settled verdict, and the board still concurs.');
if (!STRICT) console.log('(Reporting mode. --strict exits 1; flip it on in CI when the §9i fix lands.)');
process.exit(STRICT && bad ? 1 : 0);
