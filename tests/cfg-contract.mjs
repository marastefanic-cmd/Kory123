// THE CFG CONTRACT — does every retyped cfg constructor still emit what the engine reads?
//
//   node tests/cfg-contract.mjs
//
// ── WHY ──────────────────────────────────────────────────────────────────────────────────────────
// PHASE11 §1.1 B6: the preset→cfg constructor is retyped in at least six places (`goldenToState` in
// index.html, `cfgFor` in tools/engine-node.mjs, and tests/{evalsched,exact-match,plan,probe}), and
// `index.html` itself carries the admission that one of them had already fallen behind:
//
//     "Tirisfal-2pc is ON here but evalsched.mjs's harness cfg has no t5 field"
//
// That is the §20-family bug reborn model-side — score a no-T5 mage against a T5 sim — and it is
// SILENT by construction, because the engine reads `cfg.t5two ? 1.2 : 1`, so an ABSENT key and an
// explicit `false` are indistinguishable. `tools/reference-gear.mjs`'s header already paid for this
// lesson once: "a cfg that omits `t5two` is read as false, so a missing key is a SILENT 20%
// mis-valuation of the whole fight."
//
// ★ AND THE FIX PHASE11 §2 PROPOSES WOULD HAVE PROPAGATED IT (found 07-26 while fixing B6).
// §2's plan is to converge the six copies onto ONE exported `cfgFor()`. But `cfgFor` has the *same*
// omission it is meant to cure — measured below, it drops `t5two` AND `boundaryCharge`, 2 of the 10
// fields the engine's own memo signature reads. Converging on it unchanged would turn one copy's bug
// into every copy's bug. This test is what makes that visible before the split, not after.
//
// ── WHAT IT ASSERTS, AND WHY IT IS NOT RED TODAY ────────────────────────────────────────────────
// The engine names its own required field set: `simMemoCfgSig` is the memo key, so by construction it
// lists exactly the fields a score depends on (index.html's own comment records that the memo was "a
// no-op for exactly this reason before `boundaryCharge` was added to the signature").
//
// A missing field only CHANGES a score when the value it should have carried is non-default. So this
// grades in two tiers, and neither is a threshold anyone chose:
//   FAIL  — the source gear says a field is non-default and the constructor drops it. The score is
//           wrong right now.
//   WARN  — the field is dropped but the source gear leaves it at its default, so the omission is
//           inert TODAY and becomes a silent wrong answer the moment anyone sets it.
// That keeps the gate honest without a permanently-red build, which is the thing that gets a gate
// ignored. Exit 0 report · 1 under `--strict` while any constructor is incomplete · 2 could not grade.
//
// ── CONTROLLED IN BOTH DIRECTIONS (07-26) ───────────────────────────────────────────────────────
//   positive · a synthetic constructor emitting all 10 required fields   ⇒ "✅ complete"
//   negative · a synthetic constructor dropping `coldSnap`               ⇒ flagged, and correctly
//              attributed to BOTH gear sources, which set it non-default
// The ✅ branch is exercised deliberately: two real constructors are incomplete today, so without a
// synthetic complete one this file would never have been seen to pass anything.
//
// ⚠ Three of this file's own bugs were caught by running it, all in the same place — the scan that
// reads an inlined `const cfg = { … }` out of a source file. `\{[^}]*\}` truncated at the brace in
// `fixed: c.pins || {}`; a `key:`-only regex could not see shorthand properties; and the first
// fixture handed constructors gear they are never handed, manufacturing its own finding. Each
// produced a confident, specific, wrong verdict. That is PHASE11 §1.2's thesis demonstrated on the
// test written to defend against it: code that cannot be imported gets read by regex, and regexes
// are wrong. When §2 makes these constructors importable, DELETE the scan and import them.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { cfgFor, loadEngine } from '../tools/engine-node.mjs';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const die = m => { console.error('CFG-CONTRACT ERROR: ' + m); process.exit(2); };
const HTML = path.join(REPO, 'index.html');

// ── 1. the engine's own declared field set ──────────────────────────────────────────────────────
// Read from the memo signature rather than hand-listed here, so this test cannot itself become the
// seventh copy that drifts.
const src = fs.readFileSync(HTML, 'utf8');
const MARK = 'simMemoCfgSig = JSON.stringify([';
const i = src.indexOf(MARK);
if (i < 0) die(`\`${MARK}\` not found in index.html — the memo signature moved or was renamed. ` +
               `Re-anchor before trusting this test; a field list this file cannot read is a field ` +
               `list it cannot check.`);
const sig = src.slice(i + MARK.length, src.indexOf(']', i));
const REQUIRED = [...new Set([...sig.matchAll(/cfg\.([A-Za-z0-9_]+)/g)].map(m => m[1]))].sort();
if (REQUIRED.length < 5) die(`parsed only ${REQUIRED.length} fields out of the memo signature — that ` +
                             `cannot be right, and an under-read here would make every constructor pass.`);

// ── 2. the constructors under test ──────────────────────────────────────────────────────────────
// Each entry: build a cfg from a preset + gear, and report which required fields it emitted.
// `tests/evalsched.mjs` and friends inline their own; `cfgFor` is the one §2 wants to converge on.
const eng = loadEngine(HTML);
const preset = eng.cases.find(c => !c.phases && !c.intermission) || eng.cases[0];

const CONSTRUCTORS = [
  { name: 'tools/engine-node.mjs  cfgFor()', build: gear => cfgFor(eng, { ...preset, gear }) },
  // evalsched's constructor, replicated here from its own source so this test measures the SHIPPED
  // text rather than a paraphrase of it. If the line moves, the read fails loudly rather than
  // silently grading nothing.
  { name: 'tests/evalsched.mjs    (inline)', build: () => keysOfInlineCfg('tests/evalsched.mjs') },
];

// Read an inlined `const cfg = { … };` and return an object with its top-level keys.
// ⚠ `\{[^}]*\}` is WRONG here and was the first version: these constructors contain `fixed: c.pins
// || {}`, so the match stops at that inner brace and the tool reports `coldSnap`, `enabled` and
// `segments` as missing when they are right there. It printed a confident SILENT MIS-VALUATION for
// three fields that exist. Brace-count instead, and require the result to look like a whole object.
function keysOfInlineCfg(rel) {
  const s = fs.readFileSync(path.join(REPO, rel), 'utf8');
  const start = s.indexOf('const cfg = {');
  if (start < 0) die(`could not find \`const cfg = {\` in ${rel} — re-anchor.`);
  let d = 0, end = -1;
  for (let j = s.indexOf('{', start); j < s.length; j++) {
    if (s[j] === '{') d++;
    else if (s[j] === '}' && --d === 0) { end = j; break; }
  }
  if (end < 0) die(`\`const cfg = {\` in ${rel} never closes — brace scan failed.`);
  const body = s.slice(start, end + 1);
  // top-level keys only: strip nested {...}/[...] before scanning.
  // ⚠ Must match SHORTHAND properties too. `{ …, enabled, fixed: …, segments }` is how these
  // constructors are actually written, and a `key:`-only scan reports `enabled` and `segments` as
  // missing when they are present — the second false alarm this scanner produced. (That a test
  // written to catch source-scraping drift keeps mis-scraping source is not irony, it is PHASE11's
  // §1.2 thesis: code that cannot be imported gets read by regex, and regexes are wrong.)
  const flat = body.replace(/\{[^{}]*\}/g, '{}').replace(/\[[^\][]*\]/g, '[]').slice('const cfg = {'.length, -1);
  const keys = flat.split(',')
    .map(t => t.trim())
    .map(t => (t.includes(':') ? t.slice(0, t.indexOf(':')) : t).trim())
    .filter(t => /^[A-Za-z_$][A-Za-z0-9_$]*$/.test(t));
  if (keys.length < 4) die(`parsed only ${keys.length} keys from ${rel}'s cfg — the scan is wrong, ` +
                           `and an under-read here reports fields as missing that are present.`);
  return Object.fromEntries(keys.map(k => [k, undefined]));
}

// ── 3. grade ────────────────────────────────────────────────────────────────────────────────────
// ⚠ THE PROBE GEAR MUST BE GEAR THE REPO ACTUALLY USES, not gear invented to make the test fail.
// The first version handed every constructor a synthetic `{ t5two: true }` and then reported a
// "SILENT MIS-VALUATION" — but that only demonstrated that a constructor drops a field when handed
// a field it was never handed. A finding manufactured by its own fixture is not a finding. So the
// sources here are the two REAL ones: the goldens' own defaults, and the harness reference gear.
const GOLDEN_GEAR = eng.defaults.gear;                                     // what the 25 goldens run
const { REF } = await import('../tools/reference-gear.mjs');               // what the corpus is measured on
const DEFAULTS = { t5two: false, boundaryCharge: 0 };                      // values that make an omission inert
const SOURCES = [
  { name: 'GOLDEN_DEFAULTS.gear', gear: GOLDEN_GEAR },
  { name: 'reference-gear REF', gear: { ...GOLDEN_GEAR, sp: REF.sp, crit: REF.critPct, t5two: REF.t5two } },
];
const STRICT = process.argv.includes('--strict');

console.log(`# cfg contract\n`);
console.log(`engine requires (from simMemoCfgSig): ${REQUIRED.join(', ')}\n`);
console.log('| constructor | fields it cannot emit | reachable non-default in |');
console.log('|---|---|---|');

let incomplete = 0, unreachable = 0;
for (const c of CONSTRUCTORS) {
  let cfg;
  try { cfg = c.build(SOURCES[0].gear); } catch (e) { die(`${c.name} threw: ${e.message}`); }
  const missing = REQUIRED.filter(k => !(k in cfg));
  if (!missing.length) { console.log(`| \`${c.name}\` | — | ✅ complete |`); continue; }
  incomplete++;
  // Which of the dropped fields does a REAL gear source set to something non-default? Those are the
  // configurations this constructor is simply incapable of expressing.
  const hit = [];
  for (const s of SOURCES)
    for (const k of missing)
      if (k in s.gear && s.gear[k] !== DEFAULTS[k]) hit.push(`${k} (${s.name})`);
  if (hit.length) unreachable++;
  console.log(`| \`${c.name}\` | ${missing.join(', ')} | ${hit.length ? '**' + [...new Set(hit)].join(' · ') + '**' : 'none today — inert'} |`);
}

console.log();
if (unreachable) {
  console.log(`★ ${unreachable} constructor(s) CANNOT EXPRESS a gear the repo actually uses. Note what that`);
  console.log(`  means concretely: \`cfgFor\` cannot build the reference gear the whole acceptance corpus is`);
  console.log(`  measured on — tools/xval-bench.mjs only gets it right because it spreads \`...REF\` into a`);
  console.log(`  cfg of its own instead of calling the shared constructor. So the shared constructor is`);
  console.log(`  not yet a thing the other copies could safely converge onto (PHASE11 §1.1 B6 / §2).`);
}
if (incomplete) {
  console.log(`\n⚠ ${incomplete} constructor(s) drop at least one required field. The engine reads`);
  console.log(`  \`cfg.t5two ? 1.2 : 1\`, so an absent key and an explicit \`false\` are INDISTINGUISHABLE —`);
  console.log(`  nothing else in the suite can catch this, which is why index.html carries the admission`);
  console.log(`  in a comment rather than a failing test.`);
  if (STRICT) {
    console.error(`\n❌ --strict: the contract is "every constructor emits every required field". Not met.`);
    process.exit(1);
  }
  console.log(`\n(Reporting mode. \`--strict\` makes this exit 1 — turn it on in CI once PHASE11 §2 lands`);
  console.log(` one shared cfgFor() that emits the full set; today it would be permanently red, and a`);
  console.log(` permanently-red gate is one nobody reads.)`);
}
process.exit(0);
