// IF YOU PRESS AT THE SECOND THE PLAN PRINTS, DO YOU GET THE WINDOW THE PLAN SCORED?
//
//   node tools/display-second.mjs        # NO SIM. Pure arithmetic on the cached corpus plans.
//
// ── THE CONTRACT THE PAGE STATES ─────────────────────────────────────────────────────────────────
// index.html's assumptions panel makes two promises about every printed press time:
//   1. "The times in the plan are when the buff is actually up … the plan already accounts for this
//      and prints the real moment."
//   2. "Press at the second shown."
// and the model's own playstyle assumption is the macro: "/cast Berserking /cast Arcane Blast", so a
// press hit mid-cast "takes effect as that cast ends".
//
// Under the macro, pressing at second S gives you the buff at `nextBoundary(S)`. So promise 2 is kept
// only if `nextBoundary(printed) == auraAt`, the boundary the model scored the window from.
//
// The printed second is `floor(actEff)`, and `actEff` is the PRESS MOMENT, not the boundary. Flooring
// walks backwards, and if it walks back past a cast boundary the macro fires a whole cast EARLY —
// the player gets a different window from the one the tool costed. This counts how often that happens.
//
// ⇒ THE FIX, IF IT IS COMMON: print the largest whole second S with no cast boundary in (S, auraAt].
// One always exists, because cast intervals are ≥ the 1 s GCD floor and any half-open real interval of
// length ≥ 1 contains an integer. So the display CAN always name a pressable second that lands the
// scored window — it just has to be derived from the boundary, not from the press moment.
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadEngine, ALL_BUFFS } from './engine-node.mjs';
import { REF } from './reference-gear.mjs';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
// ⚠ …and the ROUND BLOB must EXIST. This defaulted to `/tmp/index-round.html`, a session scratch
// file nothing in the repo creates: on a clean checkout the tool died on a raw `node:fs` stack trace,
// and against a stale blob it found 0 cached plans and reported over an empty set. Fall back to the
// repo's own index.html and SAY SO, exactly as the five sibling tools already do — a silent fallback
// would quietly change which plans are found, which is the same defect one level down.
const ROUND = process.env.ROUND_INDEX || path.join(REPO, 'index.html');
if (!fs.existsSync(ROUND)) { console.error(`ERROR: round blob ${ROUND} does not exist.`); process.exit(2); }
if (!process.env.ROUND_INDEX) console.error('note: no ROUND_INDEX set — keying the plan cache on the repo\'s own index.html.\n' +
  '      Cached plans from a different engine will simply not be found, so the corpus may be smaller.');
const api = loadEngine(process.env.ENGINE || path.join(REPO, 'index.html'));
const EID = crypto.createHash('sha1').update(fs.readFileSync(ROUND)).digest('hex').slice(0, 12);
const planOf = cfg => {
  const k = 'plan-' + crypto.createHash('sha1').update(JSON.stringify({ cfg, engine: EID, restarts: 14 })).digest('hex').slice(0, 24);
  const f = path.join(REPO, '.xval-cache', k + '.json');
  return fs.existsSync(f) ? JSON.parse(fs.readFileSync(f, 'utf8')).s : null;
};

let presses = 0, early = 0, exact = 0, unfixable = 0, plans = 0;
const examples = [];
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
  for (const h of H) {
    const cfg = { T: +kv.T, hasteRating: h, ...REF, enabled: en, fixed: { bloodlust: [+kv.lust] }, warnings: [], coldSnap: true, segments: null };
    const s = planOf(cfg); if (!s) continue;
    const r = api.simulate(s, cfg, true);
    const starts = r.casts.map(c => c.t);
    plans++;
    for (const [key, times] of Object.entries(r.actEff || {})) {
      // Raid externals are pressed by someone else at the called second — no macro, nothing to grade.
      if (key === 'bloodlust' || key === 'powerInfusion' || key === 'drums') continue;
      for (const eff of times) {
        presses++;
        // what the model scored the window from: the macro fires as the cast in flight ends
        let prevEnd = 0;
        for (let i = 0; i < starts.length; i++) if (starts[i] <= eff + 1e-9) prevEnd = starts[i];
        let auraAt = eff;
        for (const st of starts) if (st >= eff - 1e-9) { auraAt = st; break; }
        const shown = Math.floor(eff);
        // pressing at `shown` under the macro gives the buff at the first boundary ≥ shown
        let got = shown;
        for (const st of starts) if (st >= shown - 1e-9) { got = st; break; }
        if (Math.abs(got - auraAt) < 1e-6) { exact++; continue; }
        early++;
        // is a correct whole second available at all?
        let prevB = -Infinity;
        for (const st of starts) if (st < auraAt - 1e-9) prevB = st; else break;
        const best = Math.floor(auraAt);
        if (!(best > prevB + 1e-9 && best <= auraAt + 1e-9)) unfixable++;
        if (examples.length < 8) examples.push(
          `${kv.kit} T=${kv.T} h=${h}  ${key}: model fires ${auraAt.toFixed(2)}, plan prints ${shown}, ` +
          `pressing ${shown} fires ${got.toFixed(2)}  (a correct second is ${best})`);
      }
    }
  }
}

// ⛔ ZERO PRESSES IS NOT A PASS. Without a matching ROUND_INDEX the plan cache is keyed on a
// different engine hash and nothing is found — this then printed `0 / NaN%` and the cheerful verdict
// "so the display can always be made correct" while exiting 0, i.e. the strongest possible conclusion
// drawn from no data at all. It is this repo's most expensive recurring failure shape; refuse.
if (!presses) {
  console.error('ERROR: 0 presses — the plan cache holds nothing for this engine hash.\n' +
    '       Point ROUND_INDEX at the index.html the cached plans were solved with, or re-solve.\n' +
    '       Refusing to report a verdict over an empty set.');
  process.exit(2);
}
const pct = n => (100 * n / presses).toFixed(1) + '%';
console.log(`DISPLAYED PRESS SECOND vs THE WINDOW THE MODEL SCORED — ${plans} plans, ${presses} presses. NO SIM.\n`);
console.log(`  pressing the printed second lands the scored window   ${String(exact).padStart(6)}   ${pct(exact)}`);
console.log(`  it fires a cast EARLY — a different window than costed ${String(early).padStart(6)}   ${pct(early)}`);
if (examples.length) {
  console.log('\n  examples:');
  for (const e of examples) console.log('   ' + e);
}
console.log(`\n  whole seconds that CANNOT name the scored window: ${unfixable}` +
  (unfixable ? '  ⚠ the display grid is too coarse here' : '  — so the display can always be made correct'));
