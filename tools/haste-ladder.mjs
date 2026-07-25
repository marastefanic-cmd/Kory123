// HASTE LADDER over the full 5s-grid brute (RULES §16's instrument, marched across gear haste):
// at each haste point, enumerate EVERY 5s-grid permutation of all six tracks (IV1, IV2/CS, Icon,
// gem, AP, Zerk; Lust pinned) — the exact global optimum of the enumerated space — plus the real
// optimizer for continuous certification. Then locate the BREAKPOINTS: haste values where the
// grid-optimal layout structurally changes, refined by bisection to ≤10 rating.
//
//   node tools/haste-ladder.mjs                 # ladder 0..300 step 20, bisect transitions
//   node tools/haste-ladder.mjs --max 400 --step 25
//   node tools/haste-ladder.mjs --pair skull,mqg  # ladder a different 2-trinket kit
//
// Output: per-point top-3 layouts + tool check; a transition table; JSON dump for the write-up.
import { createRequire } from 'module';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const { chromium } = createRequire(path.join(REPO, 'tests', 'package.json'))('playwright-core');

const WORKERS = 6;
let T = 80, LUST = 20, PAIR = ['isc', 'scb'], MAX = 300, STEP = 20, OUT = null, BISECT = 10;
{
  const av = process.argv.slice(2);
  // A silently-ignored flag is a false pass here: `--max` with a bad value gives MAX=NaN, the
  // ladder loop `h <= NaN` never runs, and the tool-certification verdict then prints
  // "no misses ... (0 haste points)" — a PASS over an empty set.  Reject rather than default.
  const num = (flag, raw) => {
    const v = +raw;
    if (raw === undefined || raw.startsWith('--') || !Number.isFinite(v)) {
      console.error(`ERROR: ${flag} needs a numeric value (got ${raw === undefined ? '<nothing>' : `"${raw}"`}).`);
      process.exit(2);
    }
    return v;
  };
  for (let i = 0; i < av.length; i++) {
    if (av[i] === '--T') T = num('--T', av[++i]);
    else if (av[i] === '--lust') LUST = num('--lust', av[++i]);
    else if (av[i] === '--pair') {
      const raw = av[++i];
      if (raw === undefined || raw.startsWith('--')) { console.error('ERROR: --pair needs two comma-separated trinket keys, e.g. --pair isc,scb'); process.exit(2); }
      PAIR = raw.split(',');
      if (PAIR.length !== 2) { console.error(`ERROR: --pair needs exactly two keys (got ${PAIR.length}: "${raw}").`); process.exit(2); }
    }
    else if (av[i] === '--max') MAX = num('--max', av[++i]);
    else if (av[i] === '--step') STEP = num('--step', av[++i]);
    else if (av[i] === '--bisect') BISECT = num('--bisect', av[++i]);
    else if (av[i] === '--out') {
      OUT = av[++i];
      if (OUT === undefined || OUT.startsWith('--')) { console.error('ERROR: --out needs a path.'); process.exit(2); }
    }
    else { console.error(`ERROR: unknown argument "${av[i]}".  Supported: --T --lust --pair --max --step --bisect --out`); process.exit(2); }
  }
  if (STEP <= 0) { console.error(`ERROR: --step must be > 0 (got ${STEP}) — the ladder would never advance.`); process.exit(2); }
  if (MAX < 0) { console.error(`ERROR: --max must be >= 0 (got ${MAX}).`); process.exit(2); }
  if (T <= 5) { console.error(`ERROR: --T must be > 5 (got ${T}) — the brute grid would be empty.`); process.exit(2); }
}
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM || '/opt/pw-browsers/chromium' });
const G = []; for (let t = 0; t <= T - 5; t += 5) G.push(t);
const ivPairs = []; for (const a of G) for (const b of G) if (b > a) ivPairs.push([a, b]);

async function newWorker() {
  const p = await browser.newPage();
  p.on('pageerror', e => { console.error('PAGEERROR', String(e)); process.exit(2); });
  await p.goto('file://' + path.join(REPO, 'index.html'));
  return p;
}
const workers = await Promise.all(Array.from({ length: WORKERS }, newWorker));
// An unknown trinket key is not an error anywhere downstream: `en[k]` never turns it on and
// simulateRaw skips schedule keys it does not know, so the whole enumeration axis silently
// contributes nothing and a ONE-trinket optimum gets reported as `pair=isc+sbc`.
{
  const bad = await workers[0].evaluate(keys => keys.filter(k => !(k in BUFFS)), PAIR);
  if (bad.length) {
    const known = await workers[0].evaluate(() => Object.keys(BUFFS).join(' '));
    console.error(`ERROR: --pair has unknown trinket key(s): ${bad.join(', ')}`);
    console.error(`known BUFFS keys: ${known}`);
    await browser.close();
    process.exit(2);
  }
}
const plain = (720 + (2.5 / 3.5) * 1387) * (1 + 0.38 * 0.8175);

async function bruteAt(h) {
  const slices = Array.from({ length: WORKERS }, (_, w) => ivPairs.filter((_, i) => i % WORKERS === w));
  const results = await Promise.all(workers.map((p, w) => p.evaluate(({ h, myPairs, G, T, LUST, PAIR }) => {
    const [tA, tB] = PAIR;
    const keys = ["icyVeins", tA, tB, "arcanePower", "berserking", "bloodlust"];
    const en = {}; for (const k in BUFFS) en[k] = keys.includes(k);
    const cfg = { T, hasteRating: h, sp: 1387, critPct: 38, enabled: en, fixed: { bloodlust: [LUST] }, warnings: [], coldSnap: true, segments: null };
    const sim = typeof simulateRaw !== 'undefined' ? simulateRaw : simulate;
    const top = [];
    for (const [iv1, iv2] of myPairs) {
      for (const ta of G) for (const tb of G) for (const ap of G) for (const zk of G) {
        const s = { bloodlust: [LUST], icyVeins: [iv1, iv2], [tA]: [ta], [tB]: [tb], arcanePower: [ap], berserking: [zk] };
        const rep = repair(s, cfg);
        const v = sim(rep, cfg, false).robust;
        if (top.length < 12 || v > top[top.length - 1].v) {
          top.push({ v, key: JSON.stringify([rep.icyVeins, rep[tA], rep[tB], rep.arcanePower, rep.berserking]) });
          top.sort((a, b) => b.v - a.v);
          if (top.length > 12) top.pop();
        }
      }
    }
    return top;
  }, { h, myPairs: slices[workers.indexOf(p)], G, T, LUST, PAIR })));
  const seen = new Map();
  for (const t of results.flat()) if (!seen.has(t.key) || seen.get(t.key) < t.v) seen.set(t.key, t.v);
  const merged = [...seen.entries()].map(([key, v]) => ({ key, v })).sort((a, b) => b.v - a.v);
  const tool = await workers[0].evaluate(async ({ h, T, LUST, PAIR }) => {
    const keys = ["icyVeins", PAIR[0], PAIR[1], "arcanePower", "berserking", "bloodlust"];
    const en = {}; for (const k in BUFFS) en[k] = keys.includes(k);
    const cfg = { T, hasteRating: h, sp: 1387, critPct: 38, enabled: en, fixed: { bloodlust: [LUST] }, warnings: [], coldSnap: true, segments: null };
    const best = await optimizeAsync(cfg, 14, () => {});
    // ★ Grade the plan the tool EMITS, not the score it reports.  The 0.15 "pressability slack"
    // band below is the same width as the val/emitted-plan drift that used to leak through
    // `optimizeAsync` (worst 0.153 eff casts, PHASE7 §5.14) — so a real miss could hide inside the
    // band while the reported val looked fine.  The engine now re-scores before resolving, which
    // makes these equal; scoring `best.s` explicitly means this instrument no longer DEPENDS on
    // that, and it matches what brute-grid --tool was fixed to do.
    return { v: simulate(best.s, cfg).robust, s: JSON.stringify(best.s) };
  }, { h, T, LUST, PAIR });
  return { h, top: merged.slice(0, 3).map(m => ({ eff: +(m.v / plain).toFixed(3), key: m.key })),
    toolEff: +(tool.v / plain).toFixed(3), toolPlan: tool.s };
}

const points = new Map(); // h -> result
async function at(h) {
  h = Math.round(h);
  if (!points.has(h)) {
    const t0 = Date.now();
    const r = await bruteAt(h);
    points.set(h, r);
    const d = r.toolEff - r.top[0].eff;
    console.log(`h=${String(h).padStart(3)}  grid=${r.top[0].eff.toFixed(3)}  tool=${r.toolEff.toFixed(3)} (Δ${d >= 0 ? '+' : ''}${d.toFixed(3)}${d < -0.15 ? ' MISS' : ''})  top1=${r.top[0].key}  (${((Date.now() - t0) / 60000).toFixed(1)}m)`);
  }
  return points.get(h);
}

// base ladder
for (let h = 0; h <= MAX; h += STEP) await at(h);
// bisect every adjacent pair whose top-1 layout differs, down to ≤10 rating
const differs = (a, b) => a.top[0].key !== b.top[0].key;
let frontier = [];
const hs0 = [...points.keys()].sort((a, b) => a - b);
for (let i = 0; i + 1 < hs0.length; i++) if (differs(points.get(hs0[i]), points.get(hs0[i + 1]))) frontier.push([hs0[i], hs0[i + 1]]);
while (frontier.length) {
  const next = [];
  for (const [a, b] of frontier) {
    if (b - a <= BISECT) continue;
    const m = Math.round((a + b) / 2 / 5) * 5;
    if (m === a || m === b) continue;
    const rm = await at(m);
    if (differs(points.get(a), rm)) next.push([a, m]);
    if (differs(rm, points.get(b))) next.push([m, b]);
  }
  frontier = next;
}
// report
const hs = [...points.keys()].sort((a, b) => a - b);
if (hs.length === 0) {
  console.error(`ERROR: the ladder is EMPTY (MAX=${MAX}, STEP=${STEP}) — nothing was certified.`);
  await browser.close();
  process.exit(2);
}
console.log(`\n═══ LADDER SUMMARY (T=${T}, Lust@${LUST}, pair=${PAIR.join('+')}) ═══`);
let prev = null;
for (const h of hs) {
  const r = points.get(h);
  const mark = prev && differs(points.get(prev), r) ? '  ◄ LAYOUT CHANGES' : '';
  console.log(`h=${String(h).padStart(3)}  eff=${r.top[0].eff.toFixed(3)}  ${r.top[0].key}${mark}`);
  prev = h;
}
const misses = hs.filter(h => points.get(h).toolEff - points.get(h).top[0].eff < -0.15);
console.log(misses.length ? `\nTOOL MISSES at h=${misses.join(',')}` : `\nTOOL: no misses beyond the 0.15 pressability slack at any point (${hs.length} haste points)`);
if (OUT) fs.writeFileSync(OUT, JSON.stringify([...points.values()].sort((a, b) => a.h - b.h), null, 1));
await browser.close();
// 0 = certified clean · 1 = the optimizer missed the brute optimum somewhere · 2 = could not certify.
process.exit(misses.length ? 1 : 0);
