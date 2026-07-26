// PHASE9 §4.7 / §5.8 — build an INSTRUMENTED COPY of index.html for the runtime pass census.
//
// Why a copy (§4.14): the census must not modify the shipping engine — the acceptance
// campaign loads `index.html` live, and a mid-campaign edit corrupts the round. So the
// probes are injected into a scratch file and the real engine is never touched.
//
// Why the probes are additive-only: a census that PERTURBS the optimizer measures a
// different optimizer. Every injection below is a counter bump on a path that already
// executes — no branch is added, removed, or reordered. That is an argument, not a
// guarantee, so ALWAYS prove it before reading a single count:
//
//   node tools/census-build.mjs index.html /tmp/census.html
//   node tools/plan-sweep.mjs index.html  A.json 3 --max-t=200
//   node tools/plan-sweep.mjs /tmp/census.html B.json 3 --max-t=200
//   node tools/plan-diff.mjs A.json B.json          # MUST print PLAN-DIFF IDENTICAL
//   node tools/census-run.mjs /tmp/census.html census.json
//
// Exit codes: 0 built · 2 could not build (an anchor moved). There is no exit 1 — this
// tool either produces a faithful copy or refuses to produce one.
//
// ★ ANCHORS ARE CONTENT, NOT LINE NUMBERS (rewritten 07-26, PHASE11 §1.1 B5).
//
// They used to be line numbers, and the tool was DEAD against HEAD: all 8 had drifted, because
// the monolith renumbers everything whenever any CSS or markup above the engine tag changes. The
// old header defended line-anchoring on the grounds that `dodgeDowntime`'s accept line is not
// unique (it appears twice), so a naive text substitution would instrument the wrong site — a real
// hazard, and the reason this is not just `String.replace`. But the fix for "one anchor is
// ambiguous" is to disambiguate that one anchor, not to make all eight fragile.
//
// Each probe now carries `find` (the verbatim source line) plus, where needed, `after` (resolve to
// the first occurrence strictly below another probe's resolved line). A probe that matches zero
// times, or matches more than once with no `after`, is a hard error naming the probe — so the tool
// still refuses to build a plausible-looking census, which is the property that mattered.
//
// ⚠ AND ONE PROBE WAS SEMANTICALLY STALE, not merely displaced: the old table instrumented
// `for (let groom = 0; groom < 3; groom++) {`, which no longer exists in that form. PHASE9 §5.12's
// groom early exit rewrote it to carry its own `__groomBefore` snapshot and break when a round
// changes nothing. So the census's hand-injected `__g0` snapshot is now redundant with shipped
// code, and the round-outcome probe reads the engine's own variable instead. Re-anchoring by
// number would have silently produced a census of a loop shape that is gone.
import fs from 'node:fs';

const SRC = process.argv[2], OUT = process.argv[3];
const die = m => { console.error('CENSUS-BUILD ERROR: ' + m); process.exit(2); };
if (!SRC || !OUT) die('usage: node census-build.mjs <index.html> <out.html>');

const PREAMBLE = [
  `const __C = (globalThis.__CENSUS = globalThis.__CENSUS || {});`,
  `const __hit = k => { __C[k] = (__C[k] || 0) + 1; };`,
  `globalThis.__censusReset = () => { for (const k in __C) delete __C[k]; };`,
];

// Each probe: { id, find, after?, mode, make|extra }.
//   find    — the verbatim source line (compared trimmed). Must match exactly once, unless…
//   after   — …the id of another probe, in which case the FIRST match strictly below it wins.
//   mode 'append' — emit make(line) in the line's place.
//   mode 'after'  — emit the line unchanged, then `extra`, indented to match.
//   mode 'before' — emit `extra` first, indented to match, then the line unchanged.
const PROBES = [
  { id: 'preamble', find: `<script id="engine-src">`, mode: 'after', extra: PREAMBLE },

  { id: 'simulate', find: `function simulate(schedule, cfg, collect) {`, mode: 'append',
    make: l => l + ` __hit('call.simulate');` },
  { id: 'repair', find: `function repair(schedule, cfg) {`, mode: 'append',
    make: l => l + ` __hit('call.repair');` },
  { id: 'sigOf', find: `function sigOf(s) {`, mode: 'append',
    make: l => l + ` __hit('call.sigOf');` },

  // §4.7 suspicion 2 / §4.17: is a groom round a no-op?
  // The engine now snapshots the round itself (`__groomBefore`, PHASE9 §5.12's early exit), so the
  // census reads that instead of injecting a second, identical `JSON.stringify(s)`. Anchoring on
  // the early-exit test also removes the old table's need to find the loop's closing brace — `}`
  // is the least unique line in the file and was only resolvable by absolute position.
  { id: 'groomRound', find: `if (groom >= 1 && JSON.stringify(s) === __groomBefore) break;`, mode: 'before',
    extra: [`__hit('groom.r' + groom + (JSON.stringify(s) !== __groomBefore ? '.CHANGED' : '.noop'));`] },

  // §4.21 coverage precondition — the two Class-D sites that must NOT be converted by
  // ladder item 0a. The census exists to say whether the goldens exercise them at all.
  { id: 'apSnap', find: `if (rr > simulate(s, cfg).robust + 0.5) { s = rep; val = Math.max(val, rr); apMoved = true; break; }`,
    mode: 'append', make: l => `${indent(l)}__hit('apSnap.cand');\n` + l.replace('{ s = rep;', `{ __hit('apSnap.FIRE'); s = rep;`) },
  { id: 'dodgeEnter', find: `async function dodgeDowntime(s0) {`, mode: 'append',
    make: l => l + ` __hit('dodgeDowntime.enter');` },
  // ⚠ NOT UNIQUE — this exact line also appears in an earlier pass. `after: 'dodgeEnter'` is what
  // makes content-anchoring safe here; without it the census would instrument the wrong site and
  // report a perfectly plausible number for a function it never entered.
  { id: 'dodgeCand', find: `if (simulate(rep, cfg).robust >= r0 - 0.5) { sx = rep; moved = true; break; }`,
    after: 'dodgeEnter',
    mode: 'append', make: l => `${indent(l)}__hit('dodgeDowntime.cand');\n` + l.replace('{ sx = rep;', `{ __hit('dodgeDowntime.FIRE'); sx = rep;`) },
];

function indent(l) { return l.slice(0, l.length - l.trimStart().length); }

const lines = fs.readFileSync(SRC, 'utf8').split('\n');
const out = lines.slice();

const at = {};   // probe id → resolved 1-based line

for (const p of PROBES) {
  let hits = lines.map((l, i) => (l.trim() === p.find.trim() ? i + 1 : 0)).filter(Boolean);
  if (p.after !== undefined) {
    const base = at[p.after];
    if (base === undefined) die(`probe "${p.id}" has after: "${p.after}", which is not a probe resolved before it.`);
    hits = hits.filter(h => h > base);
    if (hits.length > 1) hits = [hits[0]];   // first below the base — that IS the disambiguation
  }
  if (hits.length === 0)
    die(`probe "${p.id}" found NO line matching\n    ${p.find}\n  ` +
        `The code changed SHAPE, not just position — re-read the site before re-anchoring, because a ` +
        `probe that is merely moved and one whose subject was rewritten look identical from here.`);
  if (hits.length > 1)
    die(`probe "${p.id}" matches ${hits.length} lines (${hits.join(', ')}) and has no \`after\` to disambiguate:\n    ${p.find}\n  ` +
        `Instrumenting the wrong one produces a plausible census of the wrong site, which is exactly ` +
        `what this refusal exists to prevent. Add \`after: '<earlier probe id>'\`.`);
  const line = hits[0];
  at[p.id] = line;
  const got = lines[line - 1];
  // A probe applied twice would double-count; a probe applied to an already-probed line
  // would nest. Both are caught by writing into a slice of the ORIGINAL and asserting
  // this slot is still pristine.
  if (out[line - 1] !== got) die(`probe "${p.id}" resolved to line ${line}, already rewritten by another probe — the probe table overlaps itself.`);
  out[line - 1] =
    p.mode === 'after'  ? got + '\n' + p.extra.map(x => indent(got) + x).join('\n') :
    p.mode === 'before' ? p.extra.map(x => indent(got) + x).join('\n') + '\n' + got :
                          p.make(got);
}

fs.writeFileSync(OUT, out.join('\n'));
const added = out.join('\n').split('\n').length - lines.length;
console.log(`census build OK — ${PROBES.length} probes, +${added} lines\n  ${SRC} → ${OUT}`);
console.log(`  resolved: ` + PROBES.map(p => `${p.id}@${at[p.id]}`).join(" "));
console.log(`\n⚠ PROVE PLAN-NEUTRALITY BEFORE READING COUNTS:\n` +
  `  node tools/plan-sweep.mjs ${SRC} A.json 3 --max-t=200\n` +
  `  node tools/plan-sweep.mjs ${OUT} B.json 3 --max-t=200\n` +
  `  node tools/plan-diff.mjs A.json B.json     # must print PLAN-DIFF IDENTICAL`);
process.exit(0);
