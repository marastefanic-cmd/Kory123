// DEFICIT FIX — go at a diagonal-deficit column and try to actually CLOSE it.
//
//   node tools/deficit-fix.mjs --index /tmp/index-round.html --top 6 [--restarts 56]
//
// ── WHAT A "FIX" CAN EVEN BE HERE, stated before anything runs ───────────────────────────────────
// Cross-haste pooling makes B1 hold BY CONSTRUCTION: the plan emitted at H is the argmax over the
// champion set {champ(h)} scored at H, so no borrowed plan can out-SCORE it. A sim-side deficit is
// therefore one of exactly three things, and they need different fixes:
//
//   (A) SEARCH MISS vs the TRUE optimum. Pooling guarantees the argmax over 7-11 champions — NOT
//       global optimality. If a deeper search at H finds a plan the model scores ABOVE its own
//       champion, the search was under-converged and the fix costs no scorer change at all.
//       ⚠ Nobody has tested this. ACCEPTANCE's "a sim-side violation can only be a scorer
//       mis-ranking or measurement structure" is true of the CHAMPION SET and has been read as if it
//       were true of the optimum. This tool tests the reading.
//   (B) SCORER MIS-RANKING. The search is converged and the model simply prices the pair wrong.
//       Then the deficit is only closable by changing the objective — and for the terminal-cast
//       family that is now CLOSED in both forms (PHASE12 §6.1).
//   (C) MEASUREMENT STRUCTURE. Must be demonstrated, not assumed (ACCEPTANCE B2).
//
// This tool separates (A) from (B) with the MODEL ONLY — no sim, so it is cheap and deterministic.
//
// ── THE TEST, per column ─────────────────────────────────────────────────────────────────────────
//   champ    = the round's cached 14-restart champion at H            (what the tool emitted)
//   pooled   = argmax over all champions scored at H                  (what the tool actually shows)
//   deep     = a fresh search at H with `--restarts` (default 4x)     (is the search converged?)
//   borrowed = the plan the SIM preferred at H                        (the target to beat)
//
//   If model(deep) > model(pooled) by more than the engine's own drift tolerance, the column is (A):
//   the search left value on the table, and a better plan exists that the objective ALREADY prefers.
//   That is a fix requiring no scorer change, and it must then be SIM-DUELLED against `borrowed`
//   before it is believed (the model must not arbitrate its own change — plan-duel's circularity
//   rule).
//
// PRE-REGISTERED (before the first run):
//   P1  determinism: re-running the SAME restart count reproduces the cached champion bit-for-bit.
//       If it does not, the seeded PRNG is not doing its job and nothing below means anything.
//   P2  the (A)/(B) split is reported per column with the model margin, never aggregated into a
//       single verdict — ACCEPTANCE is explicit that aggregates hide per-cell regressions.
//   P3  ★ a deep search that finds NOTHING is the informative outcome, not a failed run: it
//       promotes the column to (B) and therefore to "closed by PHASE12 §6.1 unless a new mechanism
//       is proposed". Report it as a result, never as a null.
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadEngine, ALL_BUFFS } from './engine-node.mjs';
import { REF } from './reference-gear.mjs';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const die = m => { console.error('ERROR: ' + m); process.exit(2); };
const argv = process.argv.slice(2);
const arg = (k, d) => { const i = argv.indexOf('--' + k); return i >= 0 && argv[i + 1] !== undefined ? argv[i + 1] : d; };
const INDEX = path.resolve(arg('index', path.join(REPO, 'index.html')));
const TOP = +arg('top', 6);
const DEEP = +arg('restarts', 56);
const TARGETS = arg('targets', '/tmp/grade/targets.json');
if (!fs.existsSync(INDEX)) die(`--index ${INDEX} missing`);
if (!fs.existsSync(TARGETS)) die(`--targets ${TARGETS} missing`);

const api = loadEngine(INDEX);
const EID = crypto.createHash('sha1').update(fs.readFileSync(INDEX)).digest('hex').slice(0, 12);
const CACHE = path.join(REPO, '.xval-cache');
const planOf = cfg => {
  const k = 'plan-' + crypto.createHash('sha1').update(JSON.stringify({ cfg, engine: EID, restarts: 14 })).digest('hex').slice(0, 24);
  const f = path.join(CACHE, k + '.json');
  return fs.existsSync(f) ? JSON.parse(fs.readFileSync(f, 'utf8')).s : null;
};

const targets = JSON.parse(fs.readFileSync(TARGETS, 'utf8'))
  .filter(x => !/boss/i.test(x.class)).sort((a, b) => b.pct - a.pct).slice(0, TOP);
if (!targets.length) die('no class deficit columns in the targets file.');

// the haste grid per file, from the round's own tables
const grids = {};
for (const f of fs.readdirSync(path.join(REPO, 'tools/xval-results')).filter(x => x.endsWith('.txt'))) {
  const h = fs.readFileSync(path.join(REPO, 'tools/xval-results', f), 'utf8').split('\n').find(l => l.startsWith('plan\\sim'));
  if (h) grids[f] = h.trim().split(/\s+/).slice(1).map(Number);
}

console.log(`DEFICIT FIX — ${targets.length} worst class columns · deep search = ${DEEP} restarts (round used 14) · engine ${EID}\n`);
const out = [];
for (const c of targets) {
  const H = grids[c.file];
  if (!H) { console.log(`  ${c.file}: no haste grid — skipped, NOT counted as clean`); continue; }
  const kit = ['icyVeins', ...c.kit.split('+'), 'arcanePower', 'berserking', 'bloodlust'];
  const en = {}; for (const k of ALL_BUFFS) en[k] = kit.includes(k);
  const mk = h => ({ T: c.T, hasteRating: h, ...REF, enabled: en, fixed: { bloodlust: [c.lust] }, warnings: [], coldSnap: true, segments: null });
  const cfg = mk(c.simH);

  const champ = {};
  let miss = false;
  for (const h of H) { const s = planOf(mk(h)); if (!s) { miss = true; break; } champ[h] = s; }
  if (miss) { console.log(`  ${c.kit} ${c.class} @${c.simH}: plan cache miss — skipped, NOT counted as clean`); continue; }

  // what the tool actually emits at H (pooled argmax) and what the sim preferred
  let pooledH = c.simH, pooledV = api.simulate(champ[c.simH], cfg).robust;
  for (const h of H) { const v = api.simulate(champ[h], cfg).robust; if (v > pooledV + 1e-7) { pooledV = v; pooledH = h; } }
  const borrowedV = api.simulate(champ[c.borrowedH], cfg).robust;

  // P1 determinism control, then the deep search
  const repro = (await api.optimizeAsync(cfg, 14, () => {})).s;
  const reproV = api.simulate(repro, cfg).robust;
  const det = Math.abs(reproV - api.simulate(champ[c.simH], cfg).robust) < 1e-9;

  const t0 = Date.now();
  const deep = await api.optimizeAsync(cfg, DEEP, () => {});
  const deepV = api.simulate(deep.s, cfg).robust;
  const secs = ((Date.now() - t0) / 1000).toFixed(0);

  const gainPct = 100 * (deepV - pooledV) / pooledV;
  const verdict = gainPct > 1e-6 ? 'A: SEARCH MISS' : 'B: converged -> scorer';
  out.push({ c, pooledH, pooledV, borrowedV, deepV, gainPct, verdict, det, secs, deepS: deep.s });
  console.log(`  ${String(c.pct.toFixed(3)).padStart(6)}%  ${c.kit.padEnd(10)} ${c.class.padEnd(8)} T=${String(c.T).padEnd(4)} @sim${String(c.simH).padEnd(4)} <- plan@${String(c.borrowedH).padEnd(4)}`);
  console.log(`           model: pooled(plan@${pooledH})=${pooledV.toFixed(4)}  borrowed=${borrowedV.toFixed(4)}  (model margin ${(100 * (pooledV - borrowedV) / pooledV).toFixed(4)}%)`);
  console.log(`           deep(${DEEP})=${deepV.toFixed(4)}  gain ${gainPct >= 0 ? '+' : ''}${gainPct.toFixed(4)}%  [${secs}s]  determinism ${det ? 'OK' : '**FAIL**'}   => ${verdict}\n`);
}
if (!out.length) die('no columns graded — nothing to report. (Zero data is an error, never a pass.)');
const A = out.filter(o => o.verdict.startsWith('A'));
console.log('='.repeat(96));
console.log(`SEARCH MISSES (A): ${A.length}/${out.length}   CONVERGED (B): ${out.length - A.length}/${out.length}`);
if (A.length) {
  console.log(`\n★ ${A.length} column(s) have a plan the model's OWN objective prefers over what it emitted.`);
  console.log('  That is a fix with no scorer change — but the model must not arbitrate it: SIM-DUEL each');
  console.log('  new plan against the borrowed plan before believing it (plan-duel circularity rule).');
  for (const o of A) console.log(`    ${o.c.kit} ${o.c.class} T=${o.c.T} @${o.c.simH}: +${o.gainPct.toFixed(4)}%  ${JSON.stringify(o.deepS)}`);
} else {
  console.log('\n⇒ Every column tested is CONVERGED: the search is not leaving value on the table, so these');
  console.log('  are scorer mis-rankings (B). For the terminal-cast family that route is closed');
  console.log('  (PHASE12 §6.1) — a NEW mechanism has to be proposed before any of them can move.');
}
if (out.some(o => !o.det)) console.log('\n**DETERMINISM FAILED on at least one column — treat every number above as suspect.**');
