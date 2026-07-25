// PHASE9 §4.7 — the RUNTIME pass census, on an instrumented copy of index.html.
// Answers two questions the static census (tools/pass-sites.mjs) cannot:
//   1. How often is a groom round a NO-OP? (sizes §4.7's proposed early exit)
//   2. Do the 25 goldens actually EXERCISE dodgeDowntime and the AP snap? (§4.21's
//      confirm-the-coverage precondition for ladder item 0a — a pass the gate never
//      fires is a pass the gate cannot protect)
//
// Usage: node census-run.mjs <census.html> <out.json> [--max-t=N]
import { fork } from 'node:child_process';
import fs from 'node:fs';
import { loadEngine, cfgFor } from './engine-node.mjs';

const HTML = process.argv[2], OUT = process.argv[3];
const die = m => { console.error('CENSUS ERROR: ' + m); process.exit(2); };
if (!HTML || !OUT) die('usage: node census-run.mjs <census.html> <out.json> [--max-t=N]');

if (process.env.CENSUS_CHILD) {
  const api = loadEngine(HTML);
  if (typeof globalThis.__censusReset !== 'function')
    die('the probes are not present — census.html is not instrumented (a zeroed census reads as "these passes are dead").');
  const out = [];
  for (const i of JSON.parse(process.env.CENSUS_IDXS)) {
    const c = api.cases[i];
    globalThis.__censusReset();
    const t0 = Date.now();
    await api.optimizeAsync(cfgFor(api, c), 14, () => {});
    out.push({ i, name: c.name, T: c.T, ms: Date.now() - t0, counts: { ...globalThis.__CENSUS } });
    process.send({ tick: c.name });
  }
  process.send({ done: out });
  setTimeout(() => process.exit(0), 50);   // breathe()'s MessageChannel keeps the loop ref'd
} else {
  const api = loadEngine(HTML);
  const maxT = +((process.argv.find(a => a.startsWith('--max-t=')) || '').split('=')[1] || 0);
  const pick = api.cases.map((_, i) => i).filter(i => !maxT || api.cases[i].T <= maxT);
  const jobs = Math.min(3, pick.length);
  const slices = Array.from({ length: jobs }, (_, j) => pick.filter((_, k) => k % jobs === j)).filter(s => s.length);
  const cells = new Map();
  let done = 0;
  await Promise.all(slices.map(idxs => new Promise(res => {
    const ch = fork(process.argv[1], [HTML, OUT],
      { env: { ...process.env, CENSUS_CHILD: '1', CENSUS_IDXS: JSON.stringify(idxs) },
        stdio: ['ignore', 'inherit', 'inherit', 'ipc'] });
    ch.on('message', m => {
      if (m.tick) process.stderr.write(`  [${++done}/${pick.length}] ${m.tick}\n`);
      if (m.done) for (const c of m.done) cells.set(c.i, c);
    });
    ch.on('exit', code => { for (const i of idxs) if (!cells.has(i)) cells.set(i, { i, name: api.cases[i].name, error: `child exited ${code}` }); res(); });
  })));

  const all = pick.map(i => cells.get(i));
  const errs = all.filter(c => c.error);
  fs.writeFileSync(OUT, JSON.stringify({ html: HTML, cells: all }, null, 1));
  if (errs.length) { for (const e of errs) console.error(`  ERROR ${e.name}: ${e.error}`); die(`${errs.length} case(s) failed — the census does not cover the corpus.`); }

  const keys = [...new Set(all.flatMap(c => Object.keys(c.counts)))].sort();
  const tot = k => all.reduce((a, c) => a + (c.counts[k] || 0), 0);
  const casesWith = k => all.filter(c => (c.counts[k] || 0) > 0).length;

  console.log(`\nRUNTIME PASS CENSUS — ${all.length} cases\n`);
  console.log('key                          total        cases firing');
  for (const k of keys) console.log(`${k.padEnd(28)} ${String(tot(k)).padStart(10)}   ${casesWith(k)}/${all.length}`);

  console.log('\n── groom rounds (§4.7: does round 1 ever no-op?) ──');
  for (const r of [0, 1, 2]) {
    const ch = tot(`groom.r${r}.CHANGED`), no = tot(`groom.r${r}.noop`);
    console.log(`  round ${r}: CHANGED ${ch}  ·  no-op ${no}  ·  ${(100 * no / Math.max(1, ch + no)).toFixed(1)}% of entries are no-ops`);
  }
  // The proposed guard is `if (groom >= 1 && unchanged) break;`, so only round 1's no-ops
  // skip real work. Report the cases where it would fire, by name.
  const skippable = all.filter(c => (c.counts['groom.r1.noop'] || 0) > 0);
  console.log(`  the proposed exit would fire in ${skippable.length}/${all.length} cases: ${skippable.map(c => c.name).join(', ') || '(none)'}`);

  console.log('\n── gate coverage (§4.21 precondition for ladder item 0a) ──');
  for (const p of ['dodgeDowntime', 'apSnap']) {
    const f = tot(`${p}.FIRE`), n = casesWith(`${p}.FIRE`);
    console.log(`  ${p}: ${tot(p + '.cand')} candidates, ${f} FIRINGS across ${n}/${all.length} cases` +
      (f === 0 ? '   ⚠ NEVER FIRES — the goldens cannot protect a change to it' : ''));
    if (f) console.log(`     cases: ${all.filter(c => c.counts[`${p}.FIRE`]).map(c => `${c.name}(${c.counts[`${p}.FIRE`]})`).join(', ')}`);
  }
  console.log(`\n→ ${OUT}`);
  process.exit(0);
}
