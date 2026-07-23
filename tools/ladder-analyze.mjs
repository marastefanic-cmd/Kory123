// Cross-pair ladder analysis: ingest haste-ladder JSON dumps, compress each into its BAND TABLE
// (contiguous haste runs sharing a top-1 layout, with plateau-tie awareness), and align the bands
// across trinket pairs so kit-universal structure separates from kit-specific behavior.
//
//   node tools/ladder-analyze.mjs scratch/ladder-*.json
//
// Band compression rule: a new band starts when the top-1 layout changes AND the previous band's
// top-1 is no longer within TIE_EPS of the new rung's top-3 (a layout that stays on the podium
// merely lost a plateau wobble — same physics, not a transition). Tool deltas are carried per band.
import fs from 'fs';

const TIE_EPS = 0.02; // eff casts — twins within this are one plateau
const files = process.argv.slice(2);
if (!files.length) { console.error('usage: node tools/ladder-analyze.mjs ladder-*.json'); process.exit(1); }

const classify = (key, pairName) => {
  // key = JSON of [IV[], tA[], tB[], AP[], Zerk[]] — derive a coarse layout CLASS for alignment
  const [iv, tA, tB, ap, zk] = JSON.parse(key);
  const LUST0 = 20, LUST1 = 60; // ladder fights are T=80, Lust@20
  const cluster = [...tA, ...tB, ...ap]; // damage/SP presses
  const cMid = cluster.reduce((s, x) => s + x, 0) / cluster.length;
  const inLust = t => t >= LUST0 - 2 && t < LUST1 - 2;
  const cls = [];
  cls.push(iv[0] <= 5 ? 'IV1@pull' : inLust(iv[0]) ? 'IV1@lust' : 'IV1@back');
  cls.push(iv[1] >= LUST1 - 2 ? 'IV2@exit' : inLust(iv[1]) ? 'IV2@straddle' : 'IV2@mid');
  cls.push(cMid < 15 ? 'cluster@ramp' : cMid < 35 ? 'cluster@lustStart' : cMid < 50 ? 'cluster@mid' : 'cluster@backBridge');
  cls.push(zk[0] <= 5 ? 'zerk@pull' : inLust(zk[0]) ? 'zerk@lust' : 'zerk@late');
  return cls.join(' · ');
};

const all = {};
for (const f of files) {
  const rows = JSON.parse(fs.readFileSync(f, 'utf8')).sort((a, b) => a.h - b.h);
  const name = f.replace(/^.*ladder-/, '').replace(/\.json$/, '');
  const bands = [];
  for (const r of rows) {
    const cls = classify(r.top[0].key, name);
    const prev = bands[bands.length - 1];
    // plateau-aware: does the previous band's representative layout still sit within TIE_EPS of
    // this rung's optimum (i.e., present in top-3 within the eps)?
    const prevStillTies = prev && r.top.some(t => t.key === prev.key && r.top[0].eff - t.eff <= TIE_EPS);
    if (prev && (cls === prev.cls || prevStillTies)) {
      prev.to = r.h;
      prev.worstDelta = Math.min(prev.worstDelta, +(r.toolEff - r.top[0].eff).toFixed(3));
      if (cls === prev.cls) prev.key = r.top[0].key; // track the drifting representative
    } else {
      bands.push({ from: r.h, to: r.h, cls, key: r.top[0].key, eff: r.top[0].eff,
        worstDelta: +(r.toolEff - r.top[0].eff).toFixed(3) });
    }
  }
  all[name] = bands;
}

for (const [name, bands] of Object.entries(all)) {
  console.log(`\n═══ ${name} ═══`);
  for (const b of bands) {
    console.log(`  h ${String(b.from).padStart(3)}–${String(b.to).padEnd(3)}  ${b.cls}` +
      `  (worst toolΔ ${b.worstDelta >= 0 ? '+' : ''}${b.worstDelta.toFixed(3)})  e.g. ${b.key}`);
  }
}

// cross-pair alignment: which layout classes appear in every pair, and where their edges sit
console.log(`\n═══ CROSS-PAIR: band-class presence (class → pair: range) ═══`);
const byCls = {};
for (const [name, bands] of Object.entries(all)) for (const b of bands) {
  (byCls[b.cls] = byCls[b.cls] || []).push(`${name}:${b.from}–${b.to}`);
}
for (const [cls, where] of Object.entries(byCls).sort((a, b) => b[1].length - a[1].length)) {
  console.log(`  [${where.length}/${Object.keys(all).length} pairs] ${cls}\n      ${where.join('  ')}`);
}
const worst = Object.entries(all).flatMap(([n, bs]) => bs.map(b => ({ n, ...b }))).sort((a, b) => a.worstDelta - b.worstDelta)[0];
console.log(`\nWorst tool delta anywhere: ${worst.worstDelta.toFixed(3)} (${worst.n}, h ${worst.from}–${worst.to})`);
