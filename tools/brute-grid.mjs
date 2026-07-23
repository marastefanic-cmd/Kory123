// FULL 5s-grid exhaustive brute — NO staging, NO local refinement, the real global optimum of the
// enumerated space. Default fight T=80, Lust@20 [20,60]; tracks IV1, IV2 (CS), Icon, gem, AP, Zerk —
// each independently over {0,5,...,T-5}; every cell repair()-legalized. ~7.9M cells per haste point,
// split across worker pages by IV-pair slices; runs in UNDER A MINUTE per haste point (simulate+repair
// is ~11μs at T=80). Reports the top-5 DISTINCT repaired layouts per haste — the whole plateau, not one
// winner. This is the instrument that caught the staged brute's descent-valley miss (h160 cluster@5,
// +0.026 over the bridge twins) and certified the bridge plateau as the exact h220 optimum. RULES §16.
//
// Phase 5: an optional AoE or burn window turns the enumerated fight into a phase fight (RULES §9) —
// same grid, same tracks, the segment just reshapes the scoring surface. `--burn` with mult = M(N)
// (AE-vs-AB per-cast ratio, aoeCritAmp folded) is the "AoE as a pure phase modifier" control for the
// morphology comparison.
//
//   node tools/brute-grid.mjs                        # plain fight, default haste points
//   node tools/brute-grid.mjs 100 150 200            # plain fight, custom haste points
//   node tools/brute-grid.mjs --aoe 40,60,6 0 150    # AoE window [40,60] × 6 targets
//   node tools/brute-grid.mjs --burn 40,60,2.51 0    # burn window [40,60] × mult (the modifier control)
//   node tools/brute-grid.mjs --T 100 --lust 30 ...  # reshape the base fight
import { createRequire } from 'module';
import path from 'path';
import { fileURLToPath } from 'url';
const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const { chromium } = createRequire(path.join(REPO, 'tests', 'package.json'))('playwright-core');

const WORKERS = 6;
let T = 80, LUST = 20, segSpec = null;
const argH = [];
{
  const av = process.argv.slice(2);
  for (let i = 0; i < av.length; i++) {
    if (av[i] === '--T') T = +av[++i];
    else if (av[i] === '--lust') LUST = +av[++i];
    else if (av[i] === '--aoe') { const [a, b, n] = av[++i].split(',').map(Number); segSpec = { type: 'aoe', from: a, to: b, targets: n, mult: 1 }; }
    else if (av[i] === '--burn') { const [a, b, m] = av[++i].split(',').map(Number); segSpec = { type: 'burn', from: a, to: b, targets: 0, mult: m }; }
    else if (Number.isFinite(+av[i])) argH.push(+av[i]);
  }
}
const HASTES = argH.length ? argH : [160, 220];
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM || '/opt/pw-browsers/chromium' });

const G = []; for (let t = 0; t <= T - 5; t += 5) G.push(t);
const pairs = []; for (const a of G) for (const b of G) if (b > a) pairs.push([a, b]);

async function newWorker() {
  const p = await browser.newPage();
  p.on('pageerror', e => { console.error('PAGEERROR', String(e)); process.exit(2); });
  await p.goto('file://' + path.join(REPO, 'index.html'));
  return p;
}
const workers = await Promise.all(Array.from({ length: WORKERS }, newWorker));

const segLabel = segSpec ? (segSpec.type === 'aoe' ? `, AoE [${segSpec.from},${segSpec.to}]×${segSpec.targets}` : `, Burn [${segSpec.from},${segSpec.to}]×${segSpec.mult}`) : '';
for (const h of HASTES) {
  const t0 = Date.now();
  const slices = Array.from({ length: WORKERS }, (_, w) => pairs.filter((_, i) => i % WORKERS === w));
  const results = await Promise.all(workers.map((p, w) => p.evaluate(({ h, myPairs, G, T, LUST, segSpec }) => {
    const keys = ["icyVeins", "isc", "scb", "arcanePower", "berserking", "bloodlust"];
    const en = {}; for (const k in BUFFS) en[k] = keys.includes(k);
    const segments = segSpec ? buildSegments([segSpec], T) : null;
    const cfg = { T, hasteRating: h, sp: 1387, critPct: 38, enabled: en, fixed: { bloodlust: [LUST] }, warnings: [], coldSnap: true, segments };
    const top = []; // keep top-40 raw cells; dedupe by repaired layout later
    for (const [iv1, iv2] of myPairs) {
      for (const ic of G) for (const gm of G) for (const ap of G) for (const zk of G) {
        const s = { bloodlust: [LUST], icyVeins: [iv1, iv2], isc: [ic], scb: [gm], arcanePower: [ap], berserking: [zk] };
        const rep = repair(s, cfg);
        const v = simulate(rep, cfg, false).robust;
        if (top.length < 40 || v > top[top.length - 1].v) {
          top.push({ v, key: JSON.stringify([rep.icyVeins, rep.isc, rep.scb, rep.arcanePower, rep.berserking]) });
          top.sort((a, b) => b.v - a.v);
          if (top.length > 40) top.pop();
        }
      }
    }
    return top;
  }, { h, myPairs: slices[workers.indexOf(p)], G, T, LUST, segSpec })));
  // merge + dedupe by repaired layout
  const seen = new Map();
  for (const t of results.flat()) if (!seen.has(t.key) || seen.get(t.key) < t.v) seen.set(t.key, t.v);
  const merged = [...seen.entries()].map(([key, v]) => ({ key, v })).sort((a, b) => b.v - a.v);
  const plain = (720 + (2.5 / 3.5) * 1387) * (1 + 0.38 * 0.8175); // same formula as in-page (≈2242.2)
  console.log(`\n=== h=${h} (T=${T}, Lust@${LUST}${segLabel}; full 5s grid, ${(pairs.length * Math.pow(G.length, 4) / 1e6).toFixed(1)}M cells, ${((Date.now() - t0) / 60000).toFixed(1)} min) ===`);
  for (const m of merged.slice(0, 5)) console.log(`  eff=${(m.v / plain).toFixed(3)}  [IV,Icon,gem,AP,Zerk]=${m.key}`);
}
await browser.close();
