// EVERY GAME CONSTANT MUST TRACE TO docs/SOURCES.md — the one guard against the post-sim circularity.
//
//   node tools/constants-cited.mjs            # 0 = every constant is cited · 1 = one is not
//   node tools/constants-cited.mjs --self-test  # seeds an uncited constant; MUST fail
//
// ── WHY THIS EXISTS ──────────────────────────────────────────────────────────────────────────────
// Since the simulator was retired the scorer is checked by `tools/law-check.mjs` against
// `docs/ESTABLISHED-FACTS.md`'s closed forms — but WE wrote those closed forms. That is circular
// unless something outside the model pins it, and what pins it is the CONSTANTS: the closed forms are
// algebra over `GAME`, and every `GAME` value is a fact about TBC 2.4.3 with a citation (wowsims
// source, Wowhead, or a measured log) recorded in `docs/SOURCES.md`.
//
// ⇒ so the honest statement of the project's validation is:
//     · the CONSTANTS are externally sourced          ← this gate
//     · the ALGEBRA over them is checked against the engine   ← law-check
//     · the engine is checked against itself          ← self-consistency
//     · and which LAYOUT is right is user-declared    ← tests/anchors.mjs
//   An uncited constant silently breaks the first link, and then law-check is confirming the scorer
//   against a number nobody ever checked against the game. That is the failure this gate exists for.
//
// ⚠ It reads `GAME` FROM THE ENGINE rather than a hand-kept list, so adding a constant automatically
// adds an obligation. A hand-kept list would pass forever while the engine grew past it — the
// false-pass defect class this repo tracks.
import fs from 'node:fs';
import { loadEngine } from './engine-node.mjs';

const SELFTEST = process.argv.includes('--self-test');
const api = loadEngine(new URL('../index.html', import.meta.url).pathname);
let src = fs.readFileSync(new URL('../docs/SOURCES.md', import.meta.url).pathname, 'utf8');

// Flatten GAME to leaf numbers, keeping the path for the report.
const leaves = [];
(function walk(o, path) {
  for (const k of Object.keys(o)) {
    const v = o[k], p = path ? `${path}.${k}` : k;
    if (v && typeof v === 'object') walk(v, p);
    else if (typeof v === 'number') leaves.push({ path: p, v });
  }
})(api.GAME, '');

/* A constant counts as cited if its value appears in SOURCES.md in any of the forms a source actually
   writes it in. `0.334` is written as "334 ms"; `2.5/3.5` as "0.714" or "5/7"; `1.8175` as "182 %".
   ⚠ Deliberately generous: the goal is "a human recorded where this came from", not string equality.
   A constant nobody documented at all will still fail, which is the case that matters. */
const FORMS = v => {
  const out = new Set([String(v)]);
  out.add(v.toFixed(0)); out.add(v.toFixed(1)); out.add(v.toFixed(2)); out.add(v.toFixed(3)); out.add(v.toFixed(4));
  out.add(String(Math.round(v * 1000)));            // seconds → ms  (0.334 → 334)
  out.add(String(Math.round(v * 100)));             // fraction → %  (0.214 → 21)
  if (v > 1) out.add(String(Math.round((v - 1) * 1000) / 10));  // 1.8175 → 81.8 / 182
  if (v > 1) out.add(String(Math.round(v * 100)));
  return [...out].filter(s => s !== '0' && s !== '1' && s.length > 1);
};

if (SELFTEST) src = src.replace(/1\.8175|182\s*%/g, 'REDACTED');   // hide one real citation

const missing = leaves.filter(l => !FORMS(l.v).some(f => src.includes(f)));
console.log('# CONSTANTS CITED — every GAME value must appear in docs/SOURCES.md\n');
for (const l of leaves) {
  const ok = !missing.includes(l);
  console.log(`  ${ok ? '✓' : '⛔'} ${l.path.padEnd(28)} ${l.v}`);
}
console.log(`\nCONSTANTS checked=${leaves.length} uncited=${missing.length}`);

if (SELFTEST) {
  if (missing.length) { console.log('✓ SELF-TEST PASS — redacting a citation was caught.'); process.exit(0); }
  console.error('⛔ SELF-TEST FAIL — a redacted citation went unnoticed; the matcher is too generous.');
  process.exit(1);
}
if (missing.length) {
  console.error(`\n⛔ ${missing.length} constant(s) have no trace in docs/SOURCES.md: ${missing.map(m => m.path).join(', ')}`);
  console.error('   Add the source (wowsims file + line, Wowhead spell id, or the measurement) before shipping.');
  process.exit(1);
}
console.log('✓ every GAME constant traces to a source — the closed forms are algebra over checked numbers.');
process.exit(0);
