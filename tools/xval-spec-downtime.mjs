// P7.15 (cheap arm) — scan ALREADY-GATHERED xval boss outputs for presses that touch downtime,
// and separate the two very different reasons a buff window can overlap an intermission.
//
// This needs no engine and no sim: an xval boss `.txt` prints the genapl spec it fed the runner
// (`plan@hN: eff=… {json}`), and the spec carries its own `_intermissions`. genapl emits every
// cooldown as an unconditional `schedule` action — only Arcane Blast is gated on `_intermissions`
// — so a scheduled press ALWAYS fires at its stated second, downtime or not.
//
//   CLIP     — the press is in targetable time, but the buff's TAIL runs into a wall. This is a
//              real, deliberate, correctly-priced plan property: `simulate()` accrues no cast rate
//              during an intermission, so the model already charged the lost tail. NOT a bug.
//              (KT opens Icon at 0 with a wall at 0:15 in every plan — 5s clipped, on purpose.)
//   ARTIFACT — the press TIME itself is inside an intermission. `simulate()` walks its clock past
//              the wall before firing (`if (seg.type === "intermission" && t < seg.end) { t =
//              seg.end; continue; }`), so the MODEL scored this buff starting at the resume while
//              the SIM starts it mid-downtime. Pure transcription damage (P7.15).
//
// The ARTIFACT count here is a LOWER bound: an intent landing just BEFORE a wall, or one the
// AoE-lattice snap moves, is also mis-transcribed and is invisible without the engine. The full
// price needs `tools/xval-transcribe-audit.mjs`, which re-derives the fire times.
//
// Usage:  node tools/xval-spec-downtime.mjs <dir-or-file> [more…]
import fs from 'fs';
import path from 'path';

const args = process.argv.slice(2);
if (!args.length) { console.error('usage: node tools/xval-spec-downtime.mjs <dir|file> …'); process.exit(2); }

const files = [];
for (const a of args) {
  if (!fs.existsSync(a)) { console.error(`ERROR: ${a} does not exist.`); process.exit(2); }
  if (fs.statSync(a).isDirectory()) for (const f of fs.readdirSync(a)) { if (/^boss-.*\.txt$/.test(f)) files.push(path.join(a, f)); }
  else files.push(a);
}
if (!files.length) { console.error('ERROR: no boss-*.txt found — nothing to scan (refusing to report a clean sweep of zero files).'); process.exit(2); }

// Buff durations, keyed by the genapl action name toSpec() emits. CS is a RESET, not a buff — it
// grants the IV that follows, so its own press time is inert and is excluded from the burn.
const DUR = { IV: 20, AP: 15, Zerk: 10, Icon: 20, Gem: 15, Skull: 20, MQG: 20, BL: 40 };
const ovl = (a, b, wins) => { let s = 0; for (const [f, t] of wins) s += Math.max(0, Math.min(b, t) - Math.max(a, f)); return s; };

let nPlans = 0, nClipOnly = 0, nArt = 0, totClip = 0, totArt = 0;
const rows = [];
for (const f of files.sort()) {
  const txt = fs.readFileSync(f, 'utf8');
  const re = /plan@h(-?\d+):\s*eff=([\d.]+)\s*(\{.*\})/g;
  let m, seen = 0;
  while ((m = re.exec(txt))) {
    seen++; nPlans++;
    const H = +m[1], spec = JSON.parse(m[3]);
    const inter = spec._intermissions || [];
    if (!inter.length) continue;
    const clips = [], arts = [];
    let clip = 0, art = 0;
    for (const k of Object.keys(DUR)) {
      if (!spec[k]) continue;
      if (k === 'BL') continue;             // raid external — the raid calls it, not the mage
      for (const t of spec[k]) {
        const b = ovl(t, t + DUR[k], inter);
        if (b <= 0.01) continue;
        const w = inter.find(([a, z]) => t >= a && t < z);
        if (w) {
          // ARTIFACT: the model deferred this press to w[1]; price the difference between what
          // the sim gets ([t, t+dur)) and what the model scored ([w[1], w[1]+dur)).
          const d = b - ovl(w[1], w[1] + DUR[k], inter);
          arts.push(`${k}@${t} fires in downtime [${w[0]},${w[1]}) — model scored it from ${w[1]}, −${d.toFixed(0)}s`);
          art += d;
        } else { clips.push(`${k}@${t} −${b.toFixed(0)}s`); clip += b; }
      }
    }
    if (arts.length) nArt++; else if (clips.length) nClipOnly++;
    totClip += clip; totArt += art;
    if (arts.length || clips.length) rows.push({ f: path.basename(f), H, clip, art, clips, arts });
  }
  if (!seen) console.error(`WARN: ${path.basename(f)} contained no plan@ lines — format changed?`);
}

console.log(`P7.15 CHEAP ARM — emitted-spec downtime scan over ${files.length} gathered boss file(s)`);
console.log(`plans scanned: ${nPlans}`);
console.log(`  CLIP     (correctly priced, buff tail runs into a wall): ${nClipOnly} clip-only plans (${(100 * nClipOnly / Math.max(1, nPlans)).toFixed(0)}%), ${totClip.toFixed(1)}s total`);
console.log(`  ARTIFACT (press time itself inside downtime — P7.15): ${nArt} plans (${(100 * nArt / Math.max(1, nPlans)).toFixed(0)}%), ${totArt.toFixed(1)}s of buff burned that the model never charged`);
console.log('');
const art = rows.filter(r => r.arts.length).sort((a, b) => b.art - a.art);
console.log(`ARTIFACT CELLS (${art.length}):`);
for (const r of art) console.log(`  ${r.f.replace(/^boss-|\.txt$/g, '').padEnd(30)} h${String(r.H).padStart(3)}  −${r.art.toFixed(1)}s   ${r.arts.join(' · ')}`);
if (!art.length) console.log('  (none — every emitted press time is in targetable time)');
console.log('');
console.log(`CLIP CELLS (${rows.filter(r => r.clips.length).length}, informational — these are correct):`);
for (const r of rows.filter(r => r.clips.length).sort((a, b) => b.clip - a.clip).slice(0, 8)) {
  console.log(`  ${r.f.replace(/^boss-|\.txt$/g, '').padEnd(30)} h${String(r.H).padStart(3)}  −${r.clip.toFixed(1)}s   ${r.clips.join(' · ')}`);
}
