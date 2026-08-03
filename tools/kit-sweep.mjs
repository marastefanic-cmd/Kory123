// SWEEP THE KIT × HASTE MATRIX — the space `plan-sweep` does not cover.
//
//   node tools/kit-sweep.mjs /tmp/kits.json [jobs]
//   node tools/search-audit.mjs /tmp/kits.json --k=3        # then audit it, same as a preset sweep
//
// Exit: 0 = swept clean · 1 = a plan is ILLEGAL · 2 = could not sweep.
//
// ── WHY THIS EXISTS ──────────────────────────────────────────────────────────────────────────────
// `tests/anchors.mjs` (8 cells), `tools/plan-sweep.mjs` (17 presets) and therefore
// `tools/search-audit.mjs` ALL run ONE kit: `icyVeins + isc + scb + arcanePower + berserking +
// bloodlust`. Skull of Gul'dan, Mind Quickening Gem, Drums and Power Infusion were **never solved for
// by any gate**, and on 2026-07-30 the very first probe outside the covered kit found a search miss of
// **4× the tie band on a single coordinate** (MODEL-DEFECTS §8w — the banded-comparator ratchet).
//
// ★ AND THAT WAS NOT LUCK. §7a explains why the uncovered gear is where defects hide: a flat haste
// RATING buff riding a multiplier is worth `h·(a−1)` per second — Skull's +175 makes each one-second
// step ~0.0013 casts, *inside* `TIE_CASTS` — whereas the covered kit's multiplicative buffs step at
// ~0.0867 casts/s, 65× the band. Anything whose failure mode needs a shallow gradient is invisible on
// the kit the suite happens to run.
//
// ⛔ THE MATRIX IS NOT A TEST LIST AND MUST NOT BECOME ONE. `GOLDEN_PRESETS` is the eight layouts the
// user declared, by explicit decision; these cells assert no layout is *right*. They exist so
// `search-audit` can ask a much weaker but much broader question — "is this plan beaten by a small
// move?" — over gear the declared tests do not reach.
//
// ⚠ Emits cells carrying their own `setup`, not a preset name. Same lesson as the witness file: a cell
// is a fact about a FIGHT, not a row in a table, and a name-keyed cell is one rename from void
// (`tools/search-witnesses.mjs` spent days exiting 2 for exactly that reason).
import fs from 'node:fs';
import { loadEngine, cfgFor } from './engine-node.mjs';

const die = m => { console.error('KIT-SWEEP ERROR: ' + m); process.exit(2); };
const OUT = process.argv[2];
if (!OUT) die('usage: node kit-sweep.mjs <out.json> [--html=path]');
/* ⚠ --html lets this sweep an ALTERNATIVE engine, which is the only way to measure what a candidate
   move class changes across the kit matrix (`plan-sweep` has taken an html path since it was written,
   for the same A-vs-B reason; this file hardcoded `../index.html` and so could only ever describe HEAD).
   Used to price move class 3d against MODEL-DEFECTS §8y's open user call. */
const HTML = (process.argv.find(a => a.startsWith('--html=')) || '').split('=')[1]
          || new URL('../index.html', import.meta.url).pathname;
const api = loadEngine(HTML);

// The kits. Each names something the covered kit cannot express.
const KITS = {
  'icon+gem':        ['icyVeins', 'isc', 'scb', 'arcanePower', 'berserking', 'bloodlust'], // the covered one, as a control
  'icon+skull':      ['icyVeins', 'isc', 'skull', 'arcanePower', 'berserking', 'bloodlust'],
  'icon+mqg':        ['icyVeins', 'isc', 'mqg', 'arcanePower', 'berserking', 'bloodlust'],
  'skull+mqg':       ['icyVeins', 'skull', 'mqg', 'arcanePower', 'berserking', 'bloodlust'],
  'icon+gem+skull':  ['icyVeins', 'isc', 'scb', 'skull', 'arcanePower', 'berserking', 'bloodlust'],
  'drums+icon+gem':  ['icyVeins', 'isc', 'scb', 'drums', 'arcanePower', 'berserking', 'bloodlust'],
  'pi+icon+gem':     ['icyVeins', 'isc', 'scb', 'powerInfusion', 'arcanePower', 'berserking', 'bloodlust'],
  // ati is never a press (kind "proc"), but it CHANGES the landscape every press is placed on: the
  // proc's renewal-law haste (ESTABLISHED-FACTS §12) shifts local rates and the GCD-cap margin, so
  // the argmax can move. Added 08-03 with the exact model, so search-audit sweeps at least one
  // proc-on kit. (Cells at crit 38 via the shape's own gear — the proc is crit-driven.)
  'ati+icon+gem':    ['icyVeins', 'isc', 'scb', 'ati', 'arcanePower', 'berserking', 'bloodlust'],
};
/* ⚠ HASTE LADDER — 0 / 200 / 400 is chosen against the CROSSOVERS, not spaced for tidiness. RULES §7
   puts the IV+Berserking stack/split crossover at ~264 rating and §7a-ii puts the IV+Skull one at
   ~228, so 200 sits below both and 400 above both: the ladder straddles the point where the GCD cap
   changes the right answer. A ladder that stayed on one side of it would sweep more cells and test
   less. */
const HASTE = [0, 200, 400];
const SHAPES = [
  { tag: '2:00 lust 0:05', T: 120, pins: { bloodlust: [5] } },
  { tag: '3:00 lust 0:20', T: 180, pins: { bloodlust: [20] } },
  { tag: '2:40 lust 0:07 interm', T: 160, pins: { bloodlust: [7] },
    phases: [{ from: 90, to: 130, type: 'intermission' }] },
];

// Legality audit, same predicate plan-sweep uses — an ILLEGAL plan is a failure regardless of scoring.
function illegal(s, cfg, BUFFS) {
  const p = [];
  for (const k in s) {
    for (const t of s[k]) {
      if (Math.abs(t - Math.round(t)) > 1e-9) p.push(`${k}@${t} fractional`);
      /* ⚠ A NEGATIVE PRESS IS LEGAL NOW — prepull activation, RULES §7b (07-30). This read
         `t < -1e-9` and flagged every prepull as an illegal plan, which is the predicate being older
         than the feature rather than the plan being wrong. The real bound is the same one `repair`
         enforces: strictly greater than `-dur`, because at `-dur` the whole window is spent before the
         pull. On the whole-second grid that is `-(dur - 1)`. */
      if (t < -(BUFFS[k].dur - 1) - 1e-9) p.push(`${k}@${t} deeper than -(dur-1): the whole window is prepull`);
    }
    if (k !== 'icyVeins') for (let i = 1; i < s[k].length; i++)
      if (s[k][i] - s[k][i - 1] < BUFFS[k].cd - 1e-6) p.push(`${k} cd violation ${s[k][i - 1]}->${s[k][i]}`);
  }
  const tr = ['skull', 'mqg', 'isc'].flatMap(k => (s[k] || []).map(t => ({ t, k }))).sort((a, b) => a.t - b.t);
  for (let i = 1; i < tr.length; i++)
    if (tr[i].t - tr[i - 1].t < 20 - 1e-6) p.push(`trinket lockout ${tr[i - 1].k}@${tr[i - 1].t}->${tr[i].k}@${tr[i].t}`);
  return p;
}

const cells = [];
let bad = 0;
const total = Object.keys(KITS).length * HASTE.length * SHAPES.length;
let n = 0;
for (const [kitName, kit] of Object.entries(KITS)) {
  for (const h of HASTE) {
    for (const shape of SHAPES) {
      const setup = { T: shape.T, pins: shape.pins, kit, gear: { haste: h, sp: 1387, crit: 38 },
                      ...(shape.phases ? { phases: shape.phases } : {}) };
      const name = `${kitName} · h${h} · ${shape.tag}`;
      const t0 = Date.now();
      try {
        const cfg = cfgFor(api, { name, ...setup });
        const best = await api.optimizeAsync(cfg, undefined, () => {});
        const bandOf = api.TIE_CASTS !== undefined && api.plainCastOf ? api.TIE_CASTS * api.plainCastOf(cfg) : undefined;
        const cell = {
          name, T: shape.T, setup, ms: Date.now() - t0,
          score: api.rankScore(best.s, cfg), band: bandOf,
          distinct: api.planShape ? api.planShape(best.s).distinct : undefined,
          s: best.s, bad: illegal(best.s, cfg, api.BUFFS),
        };
        if (cell.bad.length) { bad++; console.error(`  ⛔ ILLEGAL ${name}: ${cell.bad.join('; ')}`); }
        cells.push(cell);
      } catch (e) {
        cells.push({ name, T: shape.T, setup, error: String((e && e.stack) || e) });
        console.error(`  ⛔ ERROR ${name}: ${String(e && e.message || e)}`);
      }
      n++;
      process.stdout.write(`\r  [${String(n).padStart(2)}/${total}] ${name.padEnd(42)}`);
    }
  }
}
process.stdout.write('\r' + ' '.repeat(70) + '\r');

// FALSE-PASS GUARD: one cell per matrix point, or the sweep did not cover what it claims to.
if (cells.length !== total) die(`expected ${total} cells, produced ${cells.length}`);
const errs = cells.filter(c => c.error).length;
fs.writeFileSync(OUT, JSON.stringify({ kits: Object.keys(KITS), haste: HASTE, shapes: SHAPES.map(s => s.tag), cells }, null, 1));
console.log(`KIT-SWEEP OK engine=${HTML.split('/').pop()} cells=${cells.length} kits=${Object.keys(KITS).length} haste=[${HASTE}] shapes=${SHAPES.length} errors=${errs} illegal=${bad} → ${OUT}`);
if (errs) process.exit(2);
process.exit(bad ? 1 : 0);
