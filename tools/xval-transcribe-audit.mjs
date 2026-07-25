// P7.15 — price the xval TRANSCRIPTION artifact, corpus-wide, with NO sim.
//
// `tools/xval.mjs` emits its genapl spec from `best.s` — the optimizer's raw PRESS INTENTS,
// rounded (`toSpec`, xval.mjs:166). But the plan the TOOL displays, and the windows the MODEL
// scores, are FIRE times: `simulate(s, cfg, true).actEff` — the intent snapped forward to the
// next cast boundary (steady-state slip, `prevCastRamp`, and since P7.14 the AoE-lattice snap).
// The map intent→fire is many-to-one, so an intent parked inside an intermission is transcribed
// into the sim as a press DURING downtime, while the model scored it firing at the wall.
//
// That is a HARNESS-FIDELITY question, not a model question, so it is answered WITHOUT the sim:
// this sweep re-runs xval's exact optimize + cross-haste pooling in bare node and, per emitted
// press, reports
//   spec  = Math.round(intent)          — what genapl is told to press
//   fire  = actEff[key][i]              — when the model believes it fires
//   burn  = downtime seconds inside [spec, spec+dur) MINUS inside [fire, fire+dur)
// `burn` is the headline: buff-seconds the SIM spends with the boss untargetable that the MODEL
// never charged. AoE-window overlap is NOT counted as burn (the sim is casting Arcane Explosion
// there — the time is used, just differently valued), and is reported separately.
//
// Usage:  node tools/xval-transcribe-audit.mjs [--json out.json]
// Env:    HTML (default index.html)
// Exit:   0 = swept · 2 = could not sweep (the repo's exit-code contract).
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { loadEngine, ALL_BUFFS } from './engine-node.mjs';
import { REF } from './reference-gear.mjs';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const HTML = process.env.HTML || path.join(REPO, 'index.html');
const jsonAt = process.argv.indexOf('--json');
const JSON_OUT = jsonAt > 0 ? process.argv[jsonAt + 1] : null;

const api = loadEngine(HTML);
const { optimizeAsync, simulate, buildSegments, BUFFS } = api;

// The boss corpus and kit list are xval-boss.sh's, verbatim — this audit prices the cells the
// acceptance campaign actually gathered, so any deviation here would price the wrong table.
// (BOSSES/KITS/HASTES are overridable ONLY to smoke-test the instrument; a real sweep runs the
// defaults, which are xval-boss.sh's corpus verbatim — the header prints what was actually swept.)
const BOSSES = (process.env.BOSSES || "Lady Vashj|Al'ar|Kael'thas Sunstrider").split('|');
const KITS = (process.env.KITS || "mqg,skull isc,scb").split(/\s+/).map(k => k.split(','));
const HASTE_SETS = JSON.parse(fs.readFileSync(path.join(REPO, 'tools', 'xval-haste-sets.json'), 'utf8'));

const byName = {};
for (const c of api.cases.slice(0, api.nBoss)) byName[c.name] = c;
for (const b of BOSSES) if (!byName[b]) { console.error(`ERROR: boss preset not found: ${b}`); process.exit(2); }

const ovl = (a, b, wins) => { let s = 0; for (const [f, t] of wins) s += Math.max(0, Math.min(b, t) - Math.max(a, f)); return s; };
const fmtT = x => `${Math.floor(x / 60)}:${String(Math.round(x) % 60).padStart(2, '0')}`;

const rows = [];
for (const boss of BOSSES) {
  const p = byName[boss];
  const fightT = p.T, lust = (p.pins && p.pins.bloodlust && p.pins.bloodlust[0]) || 0;
  const rawPhases = p.phases || (p.intermission ? [{ type: "intermission", from: p.intermission[0], to: p.intermission[1] }] : []);
  const segments = rawPhases.length
    ? buildSegments(rawPhases.map(ph => ({ from: ph.from, to: ph.to, type: ph.type, mult: ph.mult || 1, targets: ph.targets || 0 })), fightT)
    : null;
  const downtime = rawPhases.filter(ph => ph.type === 'intermission').map(ph => [ph.from, ph.to]);
  const aoeWins = rawPhases.filter(ph => ph.type === 'aoe').map(ph => [ph.from, ph.to]);

  for (const PAIR of KITS) {
    const key = PAIR.join(',');
    const HASTES = process.env.HASTES ? process.env.HASTES.split(',').map(Number) : HASTE_SETS[key];
    if (!Array.isArray(HASTES) || !HASTES.length) { console.error(`ERROR: no haste set for kit "${key}"`); process.exit(2); }
    const kit = ["icyVeins", PAIR[0], PAIR[1], "arcanePower", "berserking", "bloodlust"];
    const en = {}; for (const k of ALL_BUFFS) en[k] = kit.includes(k);
    const mkCfg = h => ({ T: fightT, hasteRating: h, ...REF, enabled: en, fixed: { bloodlust: [lust] }, warnings: [], coldSnap: true, segments });

    // xval's cross-haste pooling, replicated exactly — the audited spec must be the one xval emits.
    const champ = {};
    for (const h of HASTES) champ[h] = (await optimizeAsync(mkCfg(h), 14, () => {})).s;
    for (const H of HASTES) {
      const cfg = mkCfg(H);
      let bestH = champ[H], bestV = simulate(champ[H], cfg).robust;
      for (const h of HASTES) { if (h === H) continue; const v = simulate(champ[h], cfg).robust; if (v > bestV + 1e-7) { bestV = v; bestH = champ[h]; } }
      const eff = simulate(bestH, cfg, true).actEff || {};

      const presses = [];
      for (const k of Object.keys(BUFFS)) {
        if (!en[k] || !bestH[k] || !bestH[k].length) continue;
        const ints = bestH[k].slice().sort((a, b) => a - b);
        const fires = (eff[k] || []).slice().sort((a, b) => a - b);
        for (let i = 0; i < ints.length; i++) {
          const spec = Math.round(ints[i]);
          const fire = i < fires.length ? fires[i] : null;   // null = repair legalized it away
          const dur = BUFFS[k].dur;
          presses.push({
            key: k, intent: ints[i], spec, fire,
            dropped: fire === null,
            burn: fire === null ? 0 : ovl(spec, spec + dur, downtime) - ovl(fire, fire + dur, downtime),
            aoeShift: fire === null ? 0 : ovl(spec, spec + dur, aoeWins) - ovl(fire, fire + dur, aoeWins),
          });
        }
      }
      const div = presses.filter(x => !x.dropped && Math.abs(x.fire - x.spec) > 0.5);
      const burn = presses.reduce((a, x) => a + Math.max(0, x.burn), 0);
      const aoeShift = presses.reduce((a, x) => a + Math.abs(x.aoeShift), 0);
      rows.push({ boss, kit: key, H, nPress: presses.length, nDiv: div.length,
                  gap: +div.reduce((a, x) => a + (x.fire - x.spec), 0).toFixed(2),
                  burn: +burn.toFixed(2), aoeShift: +aoeShift.toFixed(2),
                  dropped: presses.filter(x => x.dropped).length,
                  detail: div.map(x => `${x.key}@${x.spec}→${x.fire.toFixed(1)}${x.burn > 0.05 ? ` [burn ${x.burn.toFixed(1)}s]` : ''}`) });
    }
  }
}

// ── report ──
console.log(`P7.15 TRANSCRIPTION AUDIT — ${rows.length} cells (${BOSSES.length} bosses × ${KITS.length} kits × haste sets)`);
console.log(`gear: sp=${REF.sp} crit=${REF.critPct} t5two=${REF.t5two}   spec=Math.round(intent) as xval emits · fire=simulate(...,true).actEff`);
console.log('');
console.log('boss                  kit         haste  press  div    gap(s)  BURN(s)  aoeShift  dropped');
for (const r of rows) {
  const flag = r.burn > 0.5 ? ' ***' : (r.nDiv ? ' *' : '');
  console.log(`${r.boss.padEnd(21)} ${r.kit.padEnd(11)} ${String(r.H).padStart(4)}  ${String(r.nPress).padStart(5)}  ${String(r.nDiv).padStart(3)}  ${r.gap.toFixed(2).padStart(7)}  ${r.burn.toFixed(2).padStart(7)}  ${r.aoeShift.toFixed(2).padStart(8)}  ${String(r.dropped).padStart(7)}${flag}`);
}
const nCells = rows.length;
const cellsDiv = rows.filter(r => r.nDiv > 0).length;
const cellsBurn = rows.filter(r => r.burn > 0.5).length;
const totPress = rows.reduce((a, r) => a + r.nPress, 0);
const totDiv = rows.reduce((a, r) => a + r.nDiv, 0);
console.log('');
console.log(`SUMMARY  cells=${nCells}  cells with ≥1 mis-transcribed press: ${cellsDiv} (${(100 * cellsDiv / nCells).toFixed(0)}%)  cells with >0.5s downtime BURN: ${cellsBurn} (${(100 * cellsBurn / nCells).toFixed(0)}%)`);
console.log(`         presses=${totPress}  mis-transcribed=${totDiv} (${(100 * totDiv / totPress).toFixed(1)}%)  max burn=${Math.max(...rows.map(r => r.burn)).toFixed(2)}s  mean burn=${(rows.reduce((a, r) => a + r.burn, 0) / nCells).toFixed(3)}s`);
console.log('');
console.log('WORST CELLS BY BURN:');
for (const r of rows.slice().sort((a, b) => b.burn - a.burn).slice(0, 12)) {
  if (r.burn <= 0) break;
  console.log(`  ${r.boss} / ${r.kit} / h${r.H}: burn ${r.burn.toFixed(2)}s over ${r.nDiv} press(es) — ${r.detail.join(' · ')}`);
}
if (JSON_OUT) { fs.writeFileSync(JSON_OUT, JSON.stringify(rows, null, 1)); console.log(`\nwrote ${JSON_OUT}`); }
