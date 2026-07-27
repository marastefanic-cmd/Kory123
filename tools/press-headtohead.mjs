// OLD vs NEW TRANSCRIPTION, graded against real combat logs. The evidence for PHASE12 step 2.
//
//   RUNNER=… node tools/press-headtohead.mjs [--n 12] [--index /tmp/index-round.html]
//
// `tools/press-exposure.mjs` counts the exposure with arithmetic alone. This runs the sim and asks the
// only question that settles it: **does each press land on the cast the model scored it on?** It sims
// the retired `Math.floor(actEff)` convention beside the current one on the same cached plans, and
// splits every failure the way `tools/press-verify.mjs` does:
//
//   · TRANSCRIPTION — the schedule value could never have reached the target cast (past it, or before
//     the previous one). This repo's bug, and the thing step 2 exists to remove.
//   · HELD — the schedule value sat properly inside the right interval and the sim declined anyway,
//     because `APLActionSchedule.IsReady` also gates on `innerSpell.IsReady`. Downstream of the
//     model/sim cast-lattice drift, not of the transcription.
//   · LATTICE — the two grids are more than half an interval apart at that press, so no value derived
//     from the model's grid could have been safe. Same root cause; also not the transcription.
//
// ⚠ Only kits the bench character WEARS are run: a scheduled press of an unequipped trinket is a
// bit-identical no-op in wowsims (PHASE12 §2.1), so it would grade as a clean pass while measuring
// nothing.
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { loadEngine, ALL_BUFFS } from './engine-node.mjs';
import { REF } from './reference-gear.mjs';
import { planToSpec } from '../sim/planspec.mjs';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const RUNNER = process.env.RUNNER || '/tmp/wowsims-build/tbc-new/runner-ap180';
if (!fs.existsSync(RUNNER)) { console.error(`ERROR: no RUNNER at ${RUNNER}`); process.exit(2); }
const argv = process.argv.slice(2);
const flag = (n, d) => { const i = argv.indexOf(`--${n}`); return i < 0 ? d : argv[i + 1]; };
const IDX = flag('index', '/tmp/index-round.html');
const N = +flag('n', '12');

const api = loadEngine(IDX);
const EID = crypto.createHash('sha1').update(fs.readFileSync(IDX)).digest('hex').slice(0, 12);
const planOf = cfg => {
  const k = 'plan-' + crypto.createHash('sha1').update(JSON.stringify({ cfg, engine: EID, restarts: 14 })).digest('hex').slice(0, 24);
  const f = path.join(REPO, '.xval-cache', k + '.json');
  return fs.existsSync(f) ? JSON.parse(fs.readFileSync(f, 'utf8')).s : null;
};

// The RETIRED convention, reproduced here and nowhere else — it is the control arm, so it has to
// survive in exactly one place rather than be remembered.
function flooredSpec(optR, best, BUFFS) {
  const eff = optR.actEff || {};
  const at = k => (eff[k] || []).slice().sort((a, b) => a - b).map(Math.floor);
  const KEY = { icyVeins: 'IV', arcanePower: 'AP', berserking: 'Zerk', bloodlust: 'BL',
                isc: 'Icon', scb: 'Gem', skull: 'Skull', mqg: 'MQG' };
  const NOP = { ati: 1, drums: 1, powerInfusion: 1 };
  const spec = { _prestack: 0 };
  for (const k of Object.keys(best.s || {})) {
    if (NOP[k] || k === 'icyVeins' || !KEY[k]) continue;
    const t = at(k); if (t.length) spec[KEY[k]] = t;
  }
  const ivs = at('icyVeins');
  if (ivs.length) {
    const iv = [], cs = []; let cd = -1e9;
    for (const t of ivs) { if (t < cd - 1e-6) cs.push(t); iv.push(t); cd = t + BUFFS.icyVeins.cd; }
    spec.IV = iv; if (cs.length) spec.CS = cs;
  }
  return spec;
}

function grade(spec, A, cfg) {
  const args = [path.join(REPO, 'tools/press-verify.mjs'), '--spec', JSON.stringify(spec),
    '--fire', JSON.stringify(A.fire), '--cast', JSON.stringify(A.cast), '--json',
    '--run', '--dur', String(cfg.T), '--haste', String(cfg.hasteRating)];
  let out = '';
  try { out = execFileSync(process.execPath, args, { env: { ...process.env, RUNNER }, encoding: 'utf8', maxBuffer: 1 << 28 }); }
  catch (e) { out = e.stdout || ''; }
  const i = out.indexOf('{');
  if (i < 0) { console.error('ERROR: press-verify produced no JSON — cannot grade'); process.exit(2); }
  const j = JSON.parse(out.slice(i));
  const offs = j.rows.filter(r => r.off !== null).map(r => Math.abs(r.off));
  return { bad: j.mistimed, held: j.held, lat: j.lattice, dropped: j.dropped,
           presses: j.rows.filter(r => r.intent !== null).length,
           drift: offs.length ? Math.max(...offs) : 0 };
}

const tot = { oldBad: 0, oldHeld: 0, oldLat: 0, newBad: 0, newHeld: 0, newLat: 0, presses: 0, drift: 0 };
let plans = 0;
const dir = path.join(REPO, 'tools/xval-results');
outer:
for (const f of fs.readdirSync(dir).filter(x => x.endsWith('.txt')).sort()) {
  const txt = fs.readFileSync(path.join(dir, f), 'utf8'); const d = txt.match(/^XVAL-DONE .*/m); if (!d) continue;
  const kv = Object.fromEntries([...d[0].matchAll(/(\w+)=(\S+)/g)].map(x => [x[1], x[2]]));
  if (String(kv.class).startsWith('BOSS:')) continue;
  if (kv.kit !== 'isc+scb') continue;                     // the bench character's own trinkets
  const L = txt.split('\n'), hi = L.findIndex(l => l.startsWith('plan\\sim')); if (hi < 0) continue;
  const H = L[hi].trim().split(/\s+/).slice(1).map(Number);
  const kit = ['icyVeins', ...kv.kit.split('+'), 'arcanePower', 'berserking', 'bloodlust'];
  const en = {}; for (const k of ALL_BUFFS) en[k] = kit.includes(k);
  for (const h of H) {
    const cfg = { T: +kv.T, hasteRating: h, ...REF, enabled: en, fixed: { bloodlust: [+kv.lust] }, warnings: [], coldSnap: true, segments: null };
    const s = planOf(cfg); if (!s) continue;
    const optR = api.simulate(s, cfg, true);
    const A = planToSpec({ cfg, best: { s }, optR }, api.BUFFS);
    const o = grade(flooredSpec(optR, { s }, api.BUFFS), A, cfg);
    const n = grade(A.spec, A, cfg);
    tot.oldBad += o.bad; tot.oldHeld += o.held; tot.oldLat += o.lat;
    tot.newBad += n.bad; tot.newHeld += n.held; tot.newLat += n.lat;
    tot.presses += n.presses; tot.drift = Math.max(tot.drift, n.drift);
    console.log(`  T=${String(kv.T).padStart(3)} h=${String(h).padStart(3)} lust=${String(kv.lust).padStart(3)}  ` +
      `${String(n.presses).padStart(2)} presses   OLD bad ${o.bad} held ${o.held} lat ${o.lat}   ` +
      `NEW bad ${n.bad} held ${n.held} lat ${n.lat}`);
    if (++plans >= N) break outer;
  }
}

const pct = v => (100 * v / tot.presses).toFixed(2) + '%';
console.log(`\nHEAD TO HEAD — ${plans} plans, ${tot.presses} presses, graded on the cast each press buffed\n`);
console.log(`  retired  floor(actEff)   TRANSCRIPTION failures: ${String(tot.oldBad).padStart(4)}  (${pct(tot.oldBad)})   held ${tot.oldHeld}  lattice ${tot.oldLat}`);
console.log(`  current  schedule value  TRANSCRIPTION failures: ${String(tot.newBad).padStart(4)}  (${pct(tot.newBad)})   held ${tot.newHeld}  lattice ${tot.newLat}`);
console.log(`\n  worst model-vs-sim clock gap seen on a press: ${tot.drift.toFixed(3)}s`);
console.log('  (HELD is the sim\'s own cooldown gate firing on the wrong side of a drifted boundary —');
console.log('   the 334 ms / (1/3) s Arcane Blast cast-time mismatch, which no transcription can reach.)');
process.exit(tot.newBad ? 1 : 0);
