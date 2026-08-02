// HASTE-BANDS — score a set of hand-declared layouts at EVERY passive haste rating and find the
// breakpoints where the winner changes.
//
//   node tools/haste-bands.mjs
//
// User-declared layouts for a 2:00 fight, Bloodlust pinned 0:20, buffed gear. The premise (user, 08-02):
// *"I don't expect that it will ever become something weird with rising haste, it will always follow a
// natural pattern, I just don't know when which will happen."* So enumerate the pattern's members and
// let the algebra say where each one owns.
//
// ⛔ SCORED ON `.integral`, THE RANKING QUANTITY — never `.robust` (MODEL-DEFECTS §9e/§9f: reading the
// per-cast sum instead produced two confidently-reported, entirely fictional findings on 08-01).
import { loadEngine, ALL_BUFFS } from './engine-node.mjs';

const api = loadEngine(new URL('../index.html', import.meta.url).pathname);
const KIT = ['icyVeins', 'isc', 'scb', 'arcanePower', 'berserking', 'bloodlust'];
const enabled = {}; for (const k of ALL_BUFFS) enabled[k] = KIT.includes(k);
/* ★★ `--sp=` — BECAUSE HALF THESE BOUNDARIES ARE GEAR-DEPENDENT AND HALF ARE NOT. User question,
   08-02: does more base spellpower move the breakpoints earlier? It does, and the mechanism is
   `s = COEF·ΔSP / (BASE + COEF·SP)` — more base SP shrinks what Icon and the gem are RELATIVELY worth,
   so the premium for parking a haste buff on top of them shrinks too and "save the haste where it
   converts" wins sooner. Measured across 700 → 2200 SP the ladder compresses ~20–25 % at every rung:

     base SP    A→D   D→C   C→B   B→E   E→H   H→G
        700      18    35    77   131   302   721
       1217      16    31    69   128   298   721
       2200      14    27    63   123   293   721

   ⇒ ★ THE LADDER HAS TWO KINDS OF BOUNDARY, and only one generalises:
     · ALIGNMENT boundaries (A→D→C→B→E→H) trade haste against SP buffs, so they are GEAR-DEPENDENT.
       Any test pinning one of these must pin SP with it, or it is true only at the gear it was measured
       at.
     · CAP boundaries (H→G) are set by the GCD floor deciding whether Berserking converts anything in
       the ramp. No SP term enters, and it does not move ONE POINT across a 3× SP range. Safe as a rule.
   ⛔ Do not quote an alignment rung as a haste threshold without its spellpower. */
const SP = +((process.argv.find(a => a.startsWith('--sp=')) || '').split('=')[1]) || 1217.3875;
const cfgAt = h => ({ T: 120, hasteRating: h, sp: SP, critPct: 37.39038949275363,
  coldSnap: true, t5two: true, enabled, fixed: { bloodlust: [20] }, warnings: [], segments: null });

const L = [
  ['A  IV@0 · CS-IV+cluster in Lust · Zerk@40',
   { icyVeins: [0, 20], isc: [20], scb: [20], arcanePower: [20], berserking: [40], bloodlust: [20] }],
  ['B  IV@0 · whole cluster+Zerk in Lust · CS-IV@60',
   { icyVeins: [0, 60], isc: [20], scb: [20], arcanePower: [20], berserking: [20], bloodlust: [20] }],
  ['C  IV@5 · cluster@20 · Zerk@25 · CS-IV@60',
   { icyVeins: [5, 60], isc: [20], scb: [20], arcanePower: [20], berserking: [25], bloodlust: [20] }],
  ['D  IV@10 · cluster@20 · Zerk@30 · CS-IV@60',
   { icyVeins: [10, 60], isc: [20], scb: [20], arcanePower: [20], berserking: [30], bloodlust: [20] }],
  ['E  IV@0 · cluster+Zerk@10 (ahead of Lust) · CS-IV@60',
   { icyVeins: [0, 60], isc: [10], scb: [10], arcanePower: [10], berserking: [10], bloodlust: [20] }],
  ['F  IV@0 · Lust alone · CS-IV+cluster @50-60',
   { icyVeins: [0, 50], isc: [50], scb: [55], arcanePower: [55], berserking: [60], bloodlust: [20] }],
  ['G  IV+Zerk@0 into the ramp · cluster@7 · CS-IV@60',
   { icyVeins: [0, 60], berserking: [0], isc: [7], scb: [7], arcanePower: [7], bloodlust: [20] }],
  /* H — user, 08-02: *"as soon as passive haste is high enough where IV + passive haste is enough to
     hit the GCD cap"*, Berserking inside that window converts nothing, so it is exiled to its own
     late window rather than stacked. Same opener as G; the only difference is Zerk 0:00 → 1:20. */
  ['H  IV@0 · cluster@7 · Zerk exiled to 1:20 · CS-IV@60',
   { icyVeins: [0, 60], isc: [7], scb: [7], arcanePower: [7], berserking: [80], bloodlust: [20] }],
];

const HMAX = +((process.argv.find(a => a.startsWith('--hmax=')) || '').split('=')[1]) || 1200;
const sc = (s, cfg) => api.simulate(JSON.parse(JSON.stringify(s)), cfg, true).integral / api.plainCastOf(cfg);

// legality: `repair` must not rewrite a declared layout, or we are not scoring what was declared
console.log(`# HASTE-BANDS — 2:00, Bloodlust pinned 0:20, sp=${SP} · scored on \`.integral\`\n`);
for (const [name, s] of L) {
  const r = api.repair(JSON.parse(JSON.stringify(s)), cfgAt(0));
  const bad = Object.keys(s).filter(k => JSON.stringify(s[k]) !== JSON.stringify(r[k]));
  if (bad.length) console.log(`  ⚠ ${name.slice(0, 2)} is REWRITTEN by repair: ` +
    bad.map(k => `${k} [${s[k]}]→[${r[k]}]`).join('  ') + '  (scored as declared anyway)');
}

let prev = null;
const bands = [];
for (let h = 0; h <= HMAX; h++) {
  const cfg = cfgAt(h);
  let best = null;
  for (let i = 0; i < L.length; i++) {
    const v = sc(L[i][1], cfg);
    if (!best || v > best.v + 1e-12) best = { i, v };
  }
  if (prev === null || best.i !== prev) { bands.push({ from: h, i: best.i, v: best.v }); prev = best.i; }
  if (bands.length) bands[bands.length - 1].to = h;
}

console.log('\n  haste band        winner');
for (const b of bands) {
  const cfg = cfgAt(b.from);
  const all = L.map(([n, s]) => ({ n, v: sc(s, cfg) })).sort((a, z) => z.v - a.v);
  const gap = all[0].v - all[1].v;
  console.log(`  ${String(b.from).padStart(4)}–${String(b.to).padEnd(4)}  ${L[b.i][0]}`);
  console.log(`               at h=${b.from}: ${all[0].v.toFixed(4)} casts, ahead of ${all[1].n.slice(0, 1)} by ` +
              `${gap.toFixed(4)}${gap < 0.002 ? '  ⚠ INSIDE the 0.002 tie band — tie-break decides, not the score' : ''}`);
}
console.log(`\nHASTE-BANDS layouts=${L.length} swept h=0…${HMAX} breakpoints=${bands.length - 1}`);
