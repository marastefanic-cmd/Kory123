// Load index.html's engine block + fight table into BARE NODE — no browser.
// The engine is DOM-free by construction (it already runs inside a Web Worker), so the
// only host globals it needs are ones node 22 has: performance, setTimeout, MessageChannel.
//
// FALSE-PASS GUARD: every extraction is asserted. A silently-missing preset array or a
// buildSegments that failed to brace-match would make a gate compare FEWER cases and still
// report success — the defect class this repo tracks. Any miss is exit 2, named.
import fs from 'fs';

const need = (cond, msg) => { if (!cond) { console.error('ENGINE-LOAD ERROR: ' + msg); process.exit(2); } };

function braceBlock(src, startIdx) {
  const open = src.indexOf('{', startIdx);
  if (open < 0) return null;
  let d = 0;
  for (let i = open; i < src.length; i++) {
    const ch = src[i];
    if (ch === '{') d++;
    else if (ch === '}') { d--; if (d === 0) return src.slice(startIdx, i + 1); }
  }
  return null;
}

export function loadEngine(htmlPath) {
  const src = fs.readFileSync(htmlPath, 'utf8');

  const o = src.indexOf('<script id="engine-src">');
  need(o >= 0, '<script id="engine-src"> not found — the engine block moved or was renamed.');
  const o2 = src.indexOf('>', o) + 1;
  const cEnd = src.indexOf('</script>', o2);
  need(cEnd > o2, 'engine block has no closing </script>.');
  const eng = src.slice(o2, cEnd);
  need(eng.length > 50000, `engine block is only ${eng.length} chars — extraction looks truncated.`);

  const bsIdx = src.indexOf('function buildSegments');
  need(bsIdx >= 0, 'function buildSegments not found.');
  const bs = braceBlock(src, bsIdx);
  need(bs && bs.length > 100, 'buildSegments failed to brace-match.');

  const pStart = src.indexOf('const GOLDEN_DEFAULTS = {');
  const pEndMark = 'window.GOLDEN_DEFAULTS = GOLDEN_DEFAULTS;';
  const pEnd = src.indexOf(pEndMark);
  need(pStart >= 0 && pEnd > pStart, 'the preset block (GOLDEN_DEFAULTS … window.GOLDEN_DEFAULTS) not found.');
  const presets = src.slice(pStart, pEnd + pEndMark.length);

  const win = {};
  let api;
  try {
    // GAME is returned so node tools can compute the plain-cast normalizer from the engine's own
    // constants table (reference-gear.mjs doctrine: read GAME, never re-type 720 / 2.5÷3.5 / 0.8175).
    api = new Function('window', 'self', `${eng}\n${bs}\n${presets}\n
      return { optimizeAsync, simulate, repair, buildSegments, naiveSchedule, BUFFS, GAME,
               phaseScore, rankScore, phaseRerank, latticePeriod, PHASE_N,
               // The SECOND half of the objective pair (MODEL-DEFECTS §8h): the tie band and the
               // shape that resolves inside it. Exported so an instrument reads the engine's own
               // constant instead of retyping 0.002 — the same doctrine reference-gear.mjs applies to
               // GAME. \`typeof\` guarded because this loader is pointed at OLD index.html files too
               // (plan-sweep A-vs-B), and a bare reference would throw before anything could run.
               TIE_CASTS:   typeof TIE_CASTS   !== 'undefined' ? TIE_CASTS   : undefined,
               plainCastOf: typeof plainCastOf !== 'undefined' ? plainCastOf : undefined,
               planShape:   typeof planShape   !== 'undefined' ? planShape   : undefined,
               cases: [...window.BOSS_PRESETS, ...window.GOLDEN_PRESETS],
               nBoss: window.BOSS_PRESETS.length, nGolden: window.GOLDEN_PRESETS.length,
               defaults: window.GOLDEN_DEFAULTS };`)(win, globalThis);
  } catch (e) {
    console.error('ENGINE-LOAD ERROR: engine block threw while evaluating in node: ' + e.message);
    process.exit(2);
  }
  need(typeof api.optimizeAsync === 'function', 'optimizeAsync missing from the engine block.');
  need(typeof api.naiveSchedule === 'function', 'naiveSchedule missing from the engine block (the page\'s vs-mashing tile needs it).');
  need(Array.isArray(api.cases) && api.cases.length > 0, 'fight table came out empty.');
  need(api.nBoss > 0 && api.nGolden > 0, `preset arrays look wrong: boss=${api.nBoss} golden=${api.nGolden}`);
  return api;
}

export const ALL_BUFFS = ["ati","powerInfusion","drums","icyVeins","skull","isc","scb","arcanePower","berserking","mqg","bloodlust"];

// Build the exact cfg the UI/exact-match builds for a preset row.
export function cfgFor(api, c) {
  const d = api.defaults;
  const gear = { ...d.gear, ...(c.gear || {}) };
  const kit = c.kit || d.kit;
  const enabled = {};
  for (const k of ALL_BUFFS) enabled[k] = kit.includes(k);
  let segments = null;
  if (c.phases) segments = api.buildSegments(c.phases.map(p => ({ from: p.from, to: p.to, type: p.type, mult: p.mult || 1, targets: p.targets || 0 })), c.T);
  else if (c.intermission) segments = api.buildSegments([{ from: c.intermission[0], to: c.intermission[1], type: 'intermission', mult: 1, targets: 0 }], c.T);
  return { T: c.T, hasteRating: gear.haste || 0, sp: gear.sp, critPct: gear.crit, enabled,
           fixed: c.pins || {}, warnings: [], coldSnap: gear.coldSnap !== false, segments };
}
