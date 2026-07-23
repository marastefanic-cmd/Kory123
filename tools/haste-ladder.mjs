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
let T = 80, LUST = 20, PAIR = ['isc', 'scb'], MAX = 300, STEP = 20, OUT = null;
{
  const av = process.argv.slice(2);
  for (let i = 0; i < av.length; i++) {
    if (av[i] === '--T') T = +av[++i];
    else if (av[i] === '--lust') LUST = +av[++i];
    else if (av[i] === '--pair') PAIR = av[++i].split(',');
    else if (av[i] === '--max') MAX = +av[++i];
    else if (av[i] === '--step') STEP = +av[++i];
    else if (av[i] === '--out') OUT = av[++i];
  }
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
    return { v: best.val, s: JSON.stringify(best.s) };
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
    if (b - a <= 10) continue;
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
