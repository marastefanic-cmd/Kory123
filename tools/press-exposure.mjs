// PRESS-TRANSCRIPTION EXPOSURE — how many of the corpus's presses does the sim fire at the WRONG cast?
//
//   node tools/press-exposure.mjs [--index /tmp/index-round.html]      # NO SIM. Pure arithmetic.
//
// This is PHASE12 §6.7's "measurement 1", and it is the number that decides whether the corpus needs
// re-gathering. It runs on data already committed: the round's cached plans, re-scored by the engine.
//
// ── THE ARITHMETIC ────────────────────────────────────────────────────────────────────────────────
// The model applies a press to the FIRST CAST whose start is ≥ `actEff` (that is what the discrete
// walk in `simulate()` does: the press event fires at a cast boundary, and the buff is in `active` for
// that cast onward). Call that boundary B — the press's INTENDED fire.
//
// `sim/planspec.mjs` transcribed the press as `Math.floor(actEff)`. wowsims' `APLActionSchedule.
// IsReady` is `sim.CurrentTime >= timing`, so the press fires at the first boundary whose time reaches
// the scheduled value. Flooring moves the scheduled value BACK, and it can move it back past a
// boundary — so the sim fires the press a whole cast EARLY:
//
//     actEff 9.7, boundaries … 9.498  10.998 …   ->  floor = 9  ->  sim fires 9.498, model uses 10.998
//
// and when the floored value lands ON a boundary the sim can just as easily fire it a whole cast LATE,
// because the sim's lattice is offset from the model's by a few ms (`tools/lattice-drift.mjs`: wowsims
// takes 334 ms per Arcane Blast stack, the model 1/3 s, and wowsims rounds every cast to the ms).
// Those cases are counted separately as FRAGILE: which cast they land on is decided by a rounding
// error, not by the plan.
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadEngine, ALL_BUFFS } from './engine-node.mjs';
import { REF } from './reference-gear.mjs';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const argv = process.argv.slice(2);
const flag = (n, d) => { const i = argv.indexOf(`--${n}`); return i < 0 ? d : argv[i + 1]; };
const IDX = flag('index', '/tmp/index-round.html');

const api = loadEngine(IDX);
const EID = crypto.createHash('sha1').update(fs.readFileSync(IDX)).digest('hex').slice(0, 12);
const planOf = cfg => {
  const k = 'plan-' + crypto.createHash('sha1').update(JSON.stringify({ cfg, engine: EID, restarts: 14 })).digest('hex').slice(0, 24);
  const f = path.join(REPO, '.xval-cache', k + '.json');
  return fs.existsSync(f) ? JSON.parse(fs.readFileSync(f, 'utf8')).s : null;
};

// The largest lattice offset measured between the model's cast grid and wowsims' (tools/lattice-drift,
// 300 s bare stream): 0.080 s. A floored value within this of a boundary is a coin flip.
const LATTICE = 0.08;

let presses = 0, early = 0, fragile = 0, exact = 0, plans = 0, tables = 0;
const earlyBy = [];
const dir = path.join(REPO, 'tools/xval-results');
for (const f of fs.readdirSync(dir).filter(x => x.endsWith('.txt')).sort()) {
  const txt = fs.readFileSync(path.join(dir, f), 'utf8');
  const d = txt.match(/^XVAL-DONE .*/m); if (!d) continue;
  const kv = Object.fromEntries([...d[0].matchAll(/(\w+)=(\S+)/g)].map(x => [x[1], x[2]]));
  if (String(kv.class).startsWith('BOSS:')) continue;
  const L = txt.split('\n'), hi = L.findIndex(l => l.startsWith('plan\\sim')); if (hi < 0) continue;
  const H = L[hi].trim().split(/\s+/).slice(1).map(Number);
  const kit = ['icyVeins', ...kv.kit.split('+'), 'arcanePower', 'berserking', 'bloodlust'];
  const en = {}; for (const k of ALL_BUFFS) en[k] = kit.includes(k);
  const mk = h => ({ T: +kv.T, hasteRating: h, ...REF, enabled: en, fixed: { bloodlust: [+kv.lust] }, warnings: [], coldSnap: true, segments: null });
  const champ = {}; let ok = true;
  for (const h of H) { const s = planOf(mk(h)); if (!s) { ok = false; break; } champ[h] = s; }
  if (!ok) continue;
  tables++;
  for (const simH of H) {
    const cfg = mk(simH);
    for (const ph of H) {
      const r = api.simulate(champ[ph], cfg, true);
      const B = r.casts.map(c => c.t);
      plans++;
      for (const times of Object.values(r.actEff || {})) {
        for (const a of times) {
          presses++;
          const want = B.findIndex(t => t >= a - 1e-9);       // the cast the MODEL buffs
          const s = Math.floor(a);
          const got = B.findIndex(t => t >= s - 1e-9);        // the cast the SIM buffs today
          if (want < 0 || got < 0) { exact++; continue; }     // press past the last cast: no effect either way
          const near = B.some(t => Math.abs(t - s) <= LATTICE);
          if (got !== want) { early++; earlyBy.push(want - got); }
          else if (near) fragile++;
          else exact++;
        }
      }
    }
  }
}

const pct = n => (100 * n / presses).toFixed(1) + '%';
console.log(`PRESS-TRANSCRIPTION EXPOSURE — ${tables} tables, ${plans} plan-scorings, ${presses} presses. NO SIM.\n`);
console.log(`  fired at the cast the model intended        ${String(exact).padStart(6)}   ${pct(exact)}`);
console.log(`  fired at a DIFFERENT cast (floor overshot)  ${String(early).padStart(6)}   ${pct(early)}`);
console.log(`  landed on a boundary — decided by ~ms fuzz  ${String(fragile).padStart(6)}   ${pct(fragile)}   (FRAGILE)`);
if (earlyBy.length) {
  const hist = {};
  for (const k of earlyBy) hist[k] = (hist[k] || 0) + 1;
  console.log(`\n  how many casts early, when it is wrong:`);
  for (const k of Object.keys(hist).sort((a, b) => a - b)) console.log(`     ${k} cast(s) early: ${hist[k]}`);
}
console.log(`\n  ⇒ ${pct(early + fragile)} of the corpus's presses are transcribed to a cast the model did not choose,`);
console.log(`     or to one picked by a rounding error. Both arms of a duel are affected, so it does NOT`);
console.log(`     cancel: which arm loses a cast depends on where ITS presses fall in the lattice.`);
