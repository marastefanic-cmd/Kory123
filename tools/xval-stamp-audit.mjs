// THE ROUND'S PROVENANCE GATE — is this ONE round, gathered under ONE protocol, over the RIGHT cells?
//
//   node tools/xval-stamp-audit.mjs [dir] [--expect 36]
//
// ── WHY THIS EXISTS ──────────────────────────────────────────────────────────────────────────────
// Everything it checks was already a written rule with **no instrument behind it**, which is this
// repo's dominant failure shape:
//
//   · `tools/xval-results/README.md`: "a gear-B table is identifiable by `char=bench-gearB`; THAT
//     STAMP, NOT THE DIRECTORY NAME, is what tells the two baselines apart."  Nothing read it.
//   · PHASE10 §8.5: an `index.html` edit mid-round "would assemble a matrix from two engines".  The
//     caches key on the engine bytes so the *cells* stay honest — but nothing compared the resulting
//     `wasm=`/`char=` stamps ACROSS tables, which is where a mixed round would actually show.
//   · ACCEPTANCE's round-5 certification lists "6 distinct per-kit haste grids each correctly matched
//     to its kit — none is the coarse [0,100,200,300,400] default", "all 345 plan rows carry
//     `_prestack:0`", "no NaN/undefined", "all 36 carry XVAL-DONE".  All four were done BY HAND, once.
//
// A hand check that is not an instrument is a check that happened to one round.  `xval-verify.mjs`
// recomputes the INVARIANTS from the matrices and `xval-collect.mjs` builds the ledger; neither asks
// whether the 36 files in front of it are the 36 cells of one round.  This does, and only that.
//
// ── EXIT CONTRACT (shared with every instrument here) ────────────────────────────────────────────
//   0  every check passed — the corpus is one protocol over the expected cell set
//   1  graded and FAILING — a real provenance violation (mixed protocol, wrong grid, prepull, ...)
//   2  could not grade — missing/corrupt/unparseable tables, or a partial round
//
// ⚠ A partial directory is exit 2, never exit 0.  `tools/xval-results/README.md` names this as the
// judgement no tool could make for you ("neither can know that 20 tables is not all of them") — so
// this one is told, via the expected cell set it derives from the campaign's own job-list formula.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const argv = process.argv.slice(2);
const arg = (k, d) => { const i = argv.indexOf('--' + k); return i >= 0 && argv[i + 1] !== undefined ? argv[i + 1] : d; };
const dir = argv.find((a, i) => !a.startsWith('--') && argv[i - 1] !== '--expect') || path.join(REPO, 'tools/xval-results');
const EXPECT = +arg('expect', 36);

const hard = [];      // exit 2 — cannot grade
const fail = [];      // exit 1 — graded and failing
const note = [];

// ── the expected cell set, from the campaign's OWN job-list formula ──────────────────────────────
// Mirrors tools/xval-bench-campaign.sh: 6 kits x 5 classes + 3 bosses x 2 kits.  Derived rather than
// listed so that changing the campaign's kit list makes this tool disagree loudly instead of quietly
// grading a different round than the one that was run.
// The three overrides exist so this tool can be CONTROLLED — run against a known-healthy subset that
// really is a complete cross-product — not so a failing round can be narrowed until it passes.
// `--bosses ""` means "no boss cells", which is how the positive control is built.
const KITS = arg('kits', 'mqg,skull isc,scb isc,skull isc,mqg scb,skull scb,mqg').split(' ').filter(Boolean);
const CLASSES = ['short', 'medium', 'medlong', 'long', 'xl'];
const BOSSES = arg('bosses', "Lady Vashj|Al'ar|Kael'thas Sunstrider").split('|').filter(Boolean);
const BKITS = arg('bkits', 'mqg,skull isc,scb').split(' ').filter(Boolean);
const expected = new Set();
for (const kit of KITS) for (const cls of CLASSES) expected.add(`${kit.replace(/,/g, '-')}-${cls}.txt`);
for (const boss of BOSSES) for (const kit of BKITS) expected.add(`boss-${boss.replace(/[^A-Za-z]/g, '')}-${kit.replace(/,/g, '-')}.txt`);
if (expected.size !== EXPECT) hard.push(`the derived cell set has ${expected.size} cells but --expect is ${EXPECT} — one of them is wrong.`);

if (!fs.existsSync(dir) || !fs.statSync(dir).isDirectory()) { console.error(`ERROR: ${dir} is not a directory.`); process.exit(2); }
const files = fs.readdirSync(dir).filter(f => f.endsWith('.txt')).sort();
if (files.length === 0) { console.error(`ERROR: no *.txt tables in ${dir} — zero tables is a MISREAD, not a pass.`); process.exit(2); }

const missing = [...expected].filter(f => !files.includes(f)).sort();
const unexpected = files.filter(f => !expected.has(f)).sort();
if (missing.length) hard.push(`${missing.length} expected cell(s) ABSENT: ${missing.join(', ')}`);
if (unexpected.length) hard.push(`${unexpected.length} unexpected table(s) present: ${unexpected.join(', ')} — this directory holds more than the round.`);

// ── the committed per-kit haste grids ────────────────────────────────────────────────────────────
const HS = JSON.parse(fs.readFileSync(path.join(REPO, 'tools/xval-haste-sets.json'), 'utf8'));

// ── parse ────────────────────────────────────────────────────────────────────────────────────────
// Fields that are the PROTOCOL (must be identical on every table) vs fields that legitimately vary
// per cell.  Getting this split wrong in either direction breaks the tool: a protocol field listed
// as varying can silently mix two rounds, and a per-cell field listed as protocol makes every round
// fail.  `wj` and `targets` are deliberately NOT here — they are protocol-derived but cell-shaped
// (class vs boss, AoE vs not) and are checked structurally below.
// ⚠ `engine` replaced `wasm` on 2026-07-27 (PHASE10 §8.26): a table now stamps WHICH engine ran
// it (`wasm:<sha>` or `native:<binary>:<size>`), because the round may legitimately use the
// native runner for bulk gathering (GEAR-AGNOSTIC §4). It stays in this list — uniformity is
// still required — so a round that MIXES engines is a hard failure here, exactly as a round that
// mixed `var` or `iter` would be. Proving two engines bit-identical (§8.26) licenses choosing
// one for a whole round; it does not license mixing them inside one.
const PROTOCOL = ['var', 'emit', 'iter', 'simseed', 'mana', 'char', 'engine', 'tool', 'pool'];
const seen = new Map(PROTOCOL.map(k => [k, new Map()]));   // field -> value -> [files]
const tables = [];

for (const f of files) {
  const p = path.join(dir, f);
  const raw = fs.readFileSync(p);
  // A text table has no legitimate NUL.  Two concurrent writers produce one that still PARSES
  // (PHASE10 §8.10) — so this must be checked on the bytes, before any string work.
  if (raw.includes(0)) { hard.push(`${f}: ${[...raw].filter(c => c === 0).length} NUL byte(s) — truncated by a concurrent writer; re-gather this cell.`); continue; }
  const txt = raw.toString('utf8');
  const done = txt.split('\n').filter(l => l.startsWith('XVAL-DONE'));
  if (done.length === 0) { hard.push(`${f}: no XVAL-DONE line — the cell did not finish.`); continue; }
  if (done.length > 1) { hard.push(`${f}: ${done.length} XVAL-DONE lines — more than one run wrote this file.`); continue; }
  const kv = Object.fromEntries(done[0].slice('XVAL-DONE '.length).trim().split(/\s+/).map(t => { const i = t.indexOf('='); return [t.slice(0, i), t.slice(i + 1)]; }));
  const header = txt.split('\n').find(l => /^seed=/.test(l));
  if (!header) { hard.push(`${f}: no header line — cannot read the haste grid.`); continue; }
  const hm = header.match(/haste=\[([^\]]*)\]/);
  const grid = hm ? hm[1].split(',').filter(Boolean).map(Number) : null;
  const plans = [...txt.matchAll(/^\s*plan@h(-?\d+):\s*eff=(\S+)\s+(\{.*\})\s*$/gm)]
    .map(m => ({ h: +m[1], eff: +m[2], spec: m[3] }));
  tables.push({ f, kv, grid, plans, txt });
  for (const k of PROTOCOL) {
    const v = kv[k] === undefined ? '(absent)' : kv[k];
    const m = seen.get(k); if (!m.has(v)) m.set(v, []); m.get(v).push(f);
  }
}

// ── 1. ONE PROTOCOL ──────────────────────────────────────────────────────────────────────────────
for (const k of PROTOCOL) {
  const m = seen.get(k);
  if (m.size > 1) {
    const spread = [...m.entries()].map(([v, fs_]) => `${k}=${v} (${fs_.length}: ${fs_.slice(0, 3).join(', ')}${fs_.length > 3 ? ', …' : ''})`).join('  ·  ');
    fail.push(`MIXED PROTOCOL on \`${k}\` — ${m.size} distinct values across the round: ${spread}`);
  } else if (m.has('(absent)')) {
    fail.push(`\`${k}\` is stamped on NO table — this corpus predates the PHASE10 §8.6 stamp set and cannot be identified.`);
  }
}

// ── 2. THE BASELINE IDENTITY ─────────────────────────────────────────────────────────────────────
// The README's rule, mechanised.  A gear-A table dropped into this directory would pass every
// invariant check in the repo and silently void the round (BENCH §1).
for (const t of tables) {
  if (t.kv.char !== 'bench-gearB') fail.push(`${t.f}: char=${t.kv.char ?? '(absent)'} — not the gear-B benchmark character; BENCH §1 voids any table mixing baselines.`);
  if (t.kv.emit !== 'fire') fail.push(`${t.f}: emit=${t.kv.emit ?? '(absent, ⇒ intent)'} — the corpus speaks fire times (ACCEPTANCE P7.15).`);
  if (t.kv.artifact !== '0') fail.push(`${t.f}: artifact=${t.kv.artifact ?? '(absent)'} — under emit=fire the guard must read 0 (TOOLING lesson 6).`);
}

// ── 3. CELL SHAPE — wj and targets follow from the cell, not from taste ──────────────────────────
for (const t of tables) {
  const isBoss = /^BOSS:/.test(t.kv.class || '');
  const wantWj = isBoss ? '2' : '0';
  if (t.kv.wj !== wantWj) fail.push(`${t.f}: wj=${t.kv.wj} on a ${isBoss ? 'boss' : 'class'} table (expected ${wantWj}) — a boss cell is a 5-variant wall-jitter mean and a class cell a single run; mixing them pools two instruments (ACCEPTANCE).`);
  const isKT = /KaelthasSunstrider/.test(t.kv.class || '');
  if (!isKT && t.kv.targets !== '0') fail.push(`${t.f}: targets=${t.kv.targets} on a non-AoE cell.`);
  if (isKT && t.kv.targets === '0') fail.push(`${t.f}: targets=0 on Kael'thas — the AoE phase is UNVALUED, which is the closed-at-task-#53 defect returning.`);
}

// ── 4. THE HASTE GRID IS THE KIT'S OWN ───────────────────────────────────────────────────────────
// An empty/❌ HASTES would substitute the coarse [0,100,200,300,400] default and the round would
// report a verdict about adaptation for a kit whose breakpoints were never sampled.
for (const t of tables) {
  const kit = (t.kv.kit || '').replace(/\+/g, ',');
  const want = HS[kit];
  if (!want) { fail.push(`${t.f}: kit "${kit}" has no entry in tools/xval-haste-sets.json.`); continue; }
  if (!t.grid) { fail.push(`${t.f}: no haste=[…] on the header line.`); continue; }
  if (t.grid.length !== want.length || t.grid.some((h, i) => h !== want[i]))
    fail.push(`${t.f}: haste grid [${t.grid}] ≠ the committed set for ${kit} [${want}].`);
  if (t.plans.length !== t.grid.length)
    fail.push(`${t.f}: ${t.plans.length} plan row(s) for a ${t.grid.length}-point grid.`);
}

// ── 5. COLD OPEN, AND NOTHING NON-FINITE ─────────────────────────────────────────────────────────
// ★★★ The never-prepull rule (CLAUDE.md, TOOLING, RULES §3, PHASE6 §4.7): a prepull's fixed −2.3 s is
// haste-blind and makes a haste sweep non-monotone, silently corrupting every comparison in the round.
let planRows = 0;
for (const t of tables) {
  for (const p of t.plans) {
    planRows++;
    let spec; try { spec = JSON.parse(p.spec); } catch { fail.push(`${t.f} plan@h${p.h}: spec is not JSON.`); continue; }
    if (spec._prestack !== 0) fail.push(`${t.f} plan@h${p.h}: _prestack=${spec._prestack} — a PREPULL in a model-compared round (CLAUDE.md ★★★).`);
    if (!Number.isFinite(p.eff)) fail.push(`${t.f} plan@h${p.h}: eff=${p.eff}.`);
    // ⚠ `_intermissions` and `_aoe` are arrays of PAIRS, not of press times, so a flat
    // `some(x => !isFinite(x))` reports every boss plan row as non-finite — which is what the first
    // version of this tool did, and it took the gear-A archive control to show it (157 "violations",
    // 96 of them fictional).  Flatten first.  Third instance in this phase of an instrument aimed
    // slightly wrong producing a confident verdict (PHASE10 §8.14).
    for (const [k, v] of Object.entries(spec))
      if (Array.isArray(v) && v.flat(Infinity).some(x => !Number.isFinite(x))) fail.push(`${t.f} plan@h${p.h}: non-finite press time on ${k}: ${JSON.stringify(v)}`);
  }
  if (/\b(NaN|undefined|null)\b/.test(t.txt)) fail.push(`${t.f}: contains NaN/undefined/null.`);
}

// ── report ───────────────────────────────────────────────────────────────────────────────────────
console.log(`# Round provenance audit — ${dir}`);
console.log(`\n${tables.length} table(s) parsed · ${planRows} plan row(s) · expecting ${expected.size} cells\n`);

if (tables.length) {
  console.log('| protocol field | value |');
  console.log('|---|---|');
  for (const k of PROTOCOL) {
    const m = seen.get(k);
    console.log(`| ${k} | ${m.size === 1 ? `\`${[...m.keys()][0]}\`` : `**${m.size} DISTINCT VALUES** — ${[...m.keys()].join(' / ')}`} |`);
  }
}

if (hard.length) { console.error('\n## CANNOT GRADE\n'); for (const h of hard) console.error(`- ${h}`); }
if (fail.length) { console.error('\n## PROVENANCE VIOLATIONS\n'); for (const x of fail) console.error(`- ${x}`); }
if (note.length) { console.log('\n## Notes\n'); for (const n of note) console.log(`- ${n}`); }

if (hard.length) {
  console.error(`\n⛔ COULD NOT GRADE (${hard.length} blocker(s)). A partial or mixed directory is not a result.`);
  process.exit(2);
}
if (fail.length) {
  console.error(`\n❌ PROVENANCE FAILS (${fail.length} violation(s)). Do NOT grade this corpus until each is resolved.`);
  process.exit(1);
}
console.log(`\n✅ ONE PROTOCOL, ${tables.length}/${expected.size} EXPECTED CELLS, cold open on every plan row.`);
console.log(`   This says the corpus is what it claims to be. It says NOTHING about the model — that is`);
console.log(`   xval-verify.mjs (invariants), xval-collect.mjs (ledger) and xval-band.mjs (§5's rule).`);
process.exit(0);
