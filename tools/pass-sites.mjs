// Static call-site census of the engine's candidate-evaluation shape.
//
//   node tools/pass-sites.mjs [--sites]
//
// PHASE9 §4.1 names the biggest refactor in the file — fuse the four walks that every candidate
// evaluation performs (`repair` → `sameCounts(counts…)` → `clipOf` → `simulate`, with `sigOf` inside
// the last) into ONE walk that `repair` emits as it goes.  It then sizes its own blast radius in
// prose: *"every call site must be converted"*.  That is a hand-wave standing where a number belongs,
// and PHASE8 §19.14's lesson is exactly this shape — before a claim carries a plan, find the script
// that produced it.  This is that script.
//
// It is STATIC — it reads text and never runs the engine, so it costs no CPU and is safe to run while
// an acceptance round is saturating the box.  It therefore reports what the code *says*, not what it
// *executes*; §4.7's runtime pass-firing census is the complementary instrument and neither replaces
// the other.  A site listed here may be cold; a hot path is never absent from here.
//
// ★ THE FALSE-PASS SHAPE.  A census's headline is a COUNT, and the degenerate count is zero — which is
// also what a wrong path, a renamed function, or a mis-scoped engine block produces, and "0 sites to
// convert" reads as "nothing to do".  So: engine block not found is exit 2; zero `repair` call sites is
// exit 2; and the whole-file count is reported ALONGSIDE the engine-block count with the difference
// listed by line, so a scoping error shows up as a visible discrepancy instead of a quiet undercount.
//
// Exit codes follow the project contract: 0 = censused cleanly · 2 = could not census.  Exit 1 is
// unused on purpose — a site count is an observation, not a grade.
import fs from 'fs';

const SHOW_SITES = process.argv.includes('--sites');
const FILE = 'index.html';
if (!fs.existsSync(FILE)) { console.error(`ERROR: ${FILE} not found (run from the repo root)`); process.exit(2); }
const src = fs.readFileSync(FILE, 'utf8');

// ── scope to the engine block ────────────────────────────────────────────────────────────────────
// The UI script calls the engine too; counting both together would inflate the refactor's size with
// sites that are not on the candidate loop at all.
const open = src.indexOf('<script id="engine-src">');
if (open < 0) { console.error('ERROR: <script id="engine-src"> not found — the engine block moved or was renamed.'); process.exit(2); }
const bodyStart = src.indexOf('>', open) + 1;
const close = src.indexOf('</script>', bodyStart);
if (close < 0) { console.error('ERROR: engine block has no closing </script>.'); process.exit(2); }
const engineFirstLine = src.slice(0, bodyStart).split('\n').length;   // 1-indexed line of the block's first line
const engineLines = src.slice(bodyStart, close).split('\n');
const fileLines = src.split('\n');

// Anchor assertion: the scoping is only meaningful if the definition itself is inside the block.
const defCount = engineLines.filter(l => /function repair\s*\(/.test(l)).length;
if (defCount !== 1) {
  console.error(`ERROR: expected exactly 1 \`function repair(\` inside the engine block, found ${defCount}.`);
  console.error('  (the block boundaries are wrong, or repair moved — every count below would be mis-scoped.)');
  process.exit(2);
}

// ── find the candidate-evaluation sites ──────────────────────────────────────────────────────────
// The guards a site applies are what decides whether the fused `repair` can serve it: a site that
// wants {sig, counts, clip} takes the whole fusion, one that wants only the schedule takes none of it.
const WINDOW = 8;                                     // lines after the call to scan for its guards
const PROBES = [
  ['counts',   /\bsameCounts\s*\(|\bcounts\s*\(/],
  ['clip',     /\bclipOf\s*\(/],
  ['simulate', /\bsimulate\s*\(/],
  ['sig',      /\bsigOf\s*\(/],
];

// ★ COMMENTS ARE NOT CODE, and this file is heavily commented BY DESIGN — the passes carry their
// theorycraft inline, so the prose mentions `repair()`, `simulate()` and `clipOf` constantly.  The
// first draft of this census counted `index.html:2248` — a comment reading "…without this, repair()
// would move only the cooldown-bound icon…" — as a call site, and would have let any comment in the
// 8-line window classify a site by a walk it never performs.  Both directions inflate.  Strip line
// comments before every test.  (`(?<!:)` so a `https://` in a string is not mistaken for one.)
const decomment = l => l.replace(/(?<!:)\/\/.*$/, '');

function census(lines, lineOffset) {
  const sites = [];
  for (let i = 0; i < lines.length; i++) {
    const l = decomment(lines[i]);
    if (/^\s*[*]/.test(lines[i])) continue;           // inside a block comment
    if (/function repair\s*\(/.test(l)) continue;     // the definition, not a call
    if (!/\brepair\s*\(/.test(l)) continue;
    const ctx = lines.slice(i + 1, i + 1 + WINDOW).map(decomment).join('\n');
    const has = {};
    for (const [name, re] of PROBES) has[name] = re.test(ctx) || re.test(l.slice(l.indexOf('repair(') + 7));
    sites.push({ line: i + lineOffset, text: lines[i].trim(), has });
  }
  return sites;
}

// ── self-test: prove the comment stripping DISCRIMINATES, not merely that it runs ────────────────
// DIARY 07-25: "hit-count assertions prove the instrument ran; only a negative control proves it
// discriminates."  The fixture below is the exact pathology the first draft got wrong.
{
  const fx = [
    '        // — it doesn\'t ramp). Without this, repair() would move only the cooldown-bound icon',
    '        const rep = repair(cand, cfg);',
    '        // if (!sameCounts(counts(base), counts(rep))) continue;   // an OLD guard, commented out',
    '        const rr = simulate(rep, cfg);',
    '        const other = repair(cand2, cfg);',
    '        if (clipOf(other) > 0) return;',
  ];
  const got = census(fx, 1);
  const fail = [];
  if (got.length !== 2) fail.push(`expected 2 call sites (the comment on line 1 is NOT one), got ${got.length}`);
  if (got[0] && got[0].has.counts) fail.push('site 1 must NOT be credited with `counts` — that guard is commented out');
  if (got[0] && !got[0].has.simulate) fail.push('site 1 must be credited with `simulate` — it is live code');
  if (got[1] && !got[1].has.clip) fail.push('site 2 must be credited with `clip`');
  if (fail.length) {
    console.error('ERROR: self-test failed — the census cannot tell comments from code:');
    for (const f of fail) console.error(`  - ${f}`);
    process.exit(2);
  }
}

const eng = census(engineLines, engineFirstLine);
const all = census(fileLines, 1);
if (!eng.length) {
  console.error('ERROR: zero `repair(` call sites inside the engine block.');
  console.error('  (zero is a MISREAD — "nothing to convert" is not a result this file can produce.)');
  process.exit(2);
}

// ── classify ─────────────────────────────────────────────────────────────────────────────────────
const label = s => {
  const w = ['counts', 'clip', 'simulate', 'sig'].filter(k => s.has[k]);
  return w.length ? w.join('+') : 'bare';
};
const byShape = new Map();
for (const s of eng) {
  const k = label(s);
  if (!byShape.has(k)) byShape.set(k, []);
  byShape.get(k).push(s);
}

console.log(`pass-sites census of ${FILE}  (engine block: lines ${engineFirstLine}–${engineFirstLine + engineLines.length - 1})\n`);
console.log(`\`repair(\` call sites — engine block: ${eng.length}   whole file: ${all.length}`);
const engSet = new Set(eng.map(s => s.line));
const outside = all.filter(s => !engSet.has(s.line));
if (outside.length) {
  console.log(`  ${outside.length} outside the engine block (UI side, NOT part of the candidate loop):`);
  for (const s of outside) console.log(`    ${FILE}:${s.line}`);
}

console.log(`\nshape (which of the four walks the site performs within ${WINDOW} lines):`);
const shapes = [...byShape.entries()].sort((a, b) => b[1].length - a[1].length);
for (const [k, v] of shapes) {
  console.log(`  ${String(v.length).padStart(2)}×  ${k}`);
  if (SHOW_SITES) for (const s of v) console.log(`        ${FILE}:${s.line}  ${s.text.slice(0, 96)}`);
}

const full = eng.filter(s => s.has.counts && s.has.clip && s.has.simulate).length;
const anyGuard = eng.filter(s => s.has.counts || s.has.clip || s.has.simulate).length;

// The other three walks stand on their own too — a fused `repair` only helps where they FOLLOW one.
const count = re => engineLines.filter(l => re.test(decomment(l)) && !/^\s*[*]/.test(l)).length;
console.log(`\nthe other three walks, total occurrences in the engine block:`);
console.log(`  sigOf      ${count(/\bsigOf\s*\(/)}   (definition included)`);
console.log(`  clipOf     ${count(/\bclipOf\s*\(/)}`);
console.log(`  sameCounts ${count(/\bsameCounts\s*\(/)}`);
console.log(`  simulate   ${count(/\bsimulate\s*\(/)}`);
console.log(`  cloneS     ${count(/\bcloneS\s*\(/)}`);

console.log(`\nPASS-SITES repairSites=${eng.length} fullQuadruple=${full} anyGuard=${anyGuard} ` +
            `bare=${eng.length - anyGuard} shapes=${byShape.size}`);
process.exit(0);
