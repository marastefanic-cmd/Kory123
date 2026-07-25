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
// ⚠ ANCHORS ARE LINE NUMBERS, and line numbers drift. Each probe carries the exact source
// line it expects; on a mismatch the tool searches the file, and if the text is uniquely
// findable it PRINTS THE NEW LINE NUMBER so re-anchoring is one edit. Line-anchoring is
// deliberate: `dodgeDowntime`'s accept line is NOT unique in the file (it appears twice),
// so a text-substitution build would silently instrument the wrong site — the failure mode
// being a plausible-looking census.
import fs from 'node:fs';

const SRC = process.argv[2], OUT = process.argv[3];
const die = m => { console.error('CENSUS-BUILD ERROR: ' + m); process.exit(2); };
if (!SRC || !OUT) die('usage: node census-build.mjs <index.html> <out.html>');

const PREAMBLE = [
  `const __C = (globalThis.__CENSUS = globalThis.__CENSUS || {});`,
  `const __hit = k => { __C[k] = (__C[k] || 0) + 1; };`,
  `globalThis.__censusReset = () => { for (const k in __C) delete __C[k]; };`,
];

// Each probe: { line, expect, mode, make }.
//   mode 'append' — expect the line verbatim, emit make(line) in its place.
//   mode 'after'  — expect the line verbatim, emit it unchanged then the extra lines.
const PROBES = [
  { line: 565, expect: `<script id="engine-src">`, mode: 'after', extra: PREAMBLE },

  { line: 652,  expect: `function simulate(schedule, cfg, collect) {`, mode: 'append',
    make: l => l + ` __hit('call.simulate');` },
  { line: 1018, expect: `function repair(schedule, cfg) {`, mode: 'append',
    make: l => l + ` __hit('call.repair');` },
  { line: 1276, expect: `function sigOf(s) {`, mode: 'append',
    make: l => l + ` __hit('call.sigOf');` },

  // §4.7 suspicion 2 / §4.17: is a groom round a no-op? Snapshot in, compare out.
  { line: 1667, expect: `for (let groom = 0; groom < 3; groom++) {`, mode: 'append',
    make: l => l + ` const __g0 = JSON.stringify(s);` },
  { line: 2101, expect: `}`, mode: 'after',
    extra: [`__hit('groom.r' + groom + (JSON.stringify(s) !== __g0 ? '.CHANGED' : '.noop'));`] },

  // §4.21 coverage precondition — the two Class-D sites that must NOT be converted by
  // ladder item 0a. The census exists to say whether the goldens exercise them at all.
  { line: 2350, expect: `if (rr > simulate(s, cfg).robust + 0.5) { s = rep; val = Math.max(val, rr); apMoved = true; break; }`,
    mode: 'append', make: l => `${indent(l)}__hit('apSnap.cand');\n` + l.replace('{ s = rep;', `{ __hit('apSnap.FIRE'); s = rep;`) },
  { line: 2649, expect: `async function dodgeDowntime(s0) {`, mode: 'append',
    make: l => l + ` __hit('dodgeDowntime.enter');` },
  { line: 2667, expect: `if (simulate(rep, cfg).robust >= r0 - 0.5) { sx = rep; moved = true; break; }`,
    mode: 'append', make: l => `${indent(l)}__hit('dodgeDowntime.cand');\n` + l.replace('{ sx = rep;', `{ __hit('dodgeDowntime.FIRE'); sx = rep;`) },
];

function indent(l) { return l.slice(0, l.length - l.trimStart().length); }

const lines = fs.readFileSync(SRC, 'utf8').split('\n');
const out = lines.slice();

for (const p of PROBES) {
  const got = lines[p.line - 1];
  if (got === undefined || got.trim() !== p.expect.trim()) {
    const hits = lines.map((l, i) => (l.trim() === p.expect.trim() ? i + 1 : 0)).filter(Boolean);
    const where = hits.length === 1 ? `it is now at line ${hits[0]} — re-anchor this probe.`
      : hits.length ? `found at lines ${hits.join(', ')} — NOT unique, pick the right one by reading.`
      : `not found anywhere — the code changed shape, not just position.`;
    die(`anchor ${p.line} expected\n    ${p.expect}\n  but found\n    ${got === undefined ? '(past end of file)' : got.trim()}\n  ${where}`);
  }
  // A probe applied twice would double-count; a probe applied to an already-probed line
  // would nest. Both are caught by writing into a slice of the ORIGINAL and asserting
  // this slot is still pristine.
  if (out[p.line - 1] !== got) die(`anchor ${p.line} was already rewritten by another probe — the probe table overlaps itself.`);
  out[p.line - 1] = p.mode === 'after'
    ? got + '\n' + p.extra.map(x => indent(got) + x).join('\n')
    : p.make(got);
}

fs.writeFileSync(OUT, out.join('\n'));
const added = out.join('\n').split('\n').length - lines.length;
console.log(`census build OK — ${PROBES.length} probes, +${added} lines\n  ${SRC} → ${OUT}`);
console.log(`\n⚠ PROVE PLAN-NEUTRALITY BEFORE READING COUNTS:\n` +
  `  node tools/plan-sweep.mjs ${SRC} A.json 3 --max-t=200\n` +
  `  node tools/plan-sweep.mjs ${OUT} B.json 3 --max-t=200\n` +
  `  node tools/plan-diff.mjs A.json B.json     # must print PLAN-DIFF IDENTICAL`);
process.exit(0);
