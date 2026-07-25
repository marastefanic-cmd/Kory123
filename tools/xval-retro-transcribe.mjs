// P7.15 (retro arm) — take the specs a REAL gathered round actually fed the sim and ask the CURRENT
// engine where each of those presses would FIRE.
//
// The expensive arm (`tools/xval-transcribe-audit.mjs`) re-derives plans with `optimizeAsync` — ~100s
// per cell, hours for the corpus. This one costs milliseconds, because an xval boss `.txt` already
// prints the emitted spec (`plan@hN: eff=… {json}`): rebuild that spec as a schedule, run
// `simulate(s, cfg, true)` once, and read `actEff`. The delta spec→actEff is exactly the
// transcription artifact, measured on the plans the acceptance tables were actually built from.
//
// ⚠ TWO LIMITS, both structural, both stated rather than hidden:
//  1. The banked spec is ALREADY ROUNDED (toSpec did `Math.round`), so the input carries up to ±0.5 s
//     of quantization. Divergences below ~0.5 s are therefore not resolvable here; the ones that
//     matter (a press deferred to a phase wall, or snapped onto an AoE lattice) are seconds wide.
//  2. It replays through the CURRENT engine. Against a round gathered BEFORE an engine change this
//     answers "where would these presses fire under today's rules?" — which is the question that
//     matters when deciding whether a landed snap change invalidates a banked table — but it is NOT
//     a reconstruction of what that round's engine did.
//
// Usage:  node tools/xval-retro-transcribe.mjs <dir-or-file> [more…]
// Env:    HTML (default index.html)
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { loadEngine, ALL_BUFFS } from './engine-node.mjs';
import { REF } from './reference-gear.mjs';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const api = loadEngine(process.env.HTML || path.join(REPO, 'index.html'));
const { simulate, buildSegments, BUFFS } = api;

const args = process.argv.slice(2);
if (!args.length) { console.error('usage: node tools/xval-retro-transcribe.mjs <dir|file> …'); process.exit(2); }
const files = [];
for (const a of args) {
  if (!fs.existsSync(a)) { console.error(`ERROR: ${a} does not exist.`); process.exit(2); }
  if (fs.statSync(a).isDirectory()) for (const f of fs.readdirSync(a)) { if (/^boss-.*\.txt$/.test(f)) files.push(path.join(a, f)); }
  else files.push(a);
}
if (!files.length) { console.error('ERROR: no boss-*.txt found — refusing to report a clean sweep of zero files.'); process.exit(2); }

// genapl action name → engine buff key. CS is a reset, not a buff: it has no window of its own, and
// the IV it grants is already in the IV list, so it is not audited as a press.
const K = { IV: 'icyVeins', AP: 'arcanePower', Zerk: 'berserking', Icon: 'isc', Gem: 'scb', Skull: 'skull', MQG: 'mqg', BL: 'bloodlust' };
// The boss preset supplies T, the phase table and the Lust pin — the spec only carries wall times.
const byName = {}; for (const c of api.cases.slice(0, api.nBoss)) byName[c.name] = c;
const NAMETAG = {}; for (const n of Object.keys(byName)) NAMETAG[n.replace(/[^A-Za-z]/g, '')] = n;

const ovl = (a, b, wins) => { let s = 0; for (const [f, t] of wins) s += Math.max(0, Math.min(b, t) - Math.max(a, f)); return s; };

const rows = [];
for (const f of files.sort()) {
  const base = path.basename(f);
  const m0 = /^boss-([A-Za-z]+)-([a-z]+)-([a-z]+)\.txt$/.exec(base);
  if (!m0) { console.error(`WARN: ${base} does not match boss-<Boss>-<kit>-<kit>.txt — skipped.`); continue; }
  const boss = NAMETAG[m0[1]];
  if (!boss) { console.error(`ERROR: ${base} names boss tag "${m0[1]}", which matches no BOSS_PRESET — a renamed preset would silently drop this file.`); process.exit(2); }
  const PAIR = [m0[2], m0[3]];
  const p = byName[boss];
  const fightT = p.T, lust = (p.pins && p.pins.bloodlust && p.pins.bloodlust[0]) || 0;
  const rawPhases = p.phases || (p.intermission ? [{ type: 'intermission', from: p.intermission[0], to: p.intermission[1] }] : []);
  const segments = rawPhases.length ? buildSegments(rawPhases.map(ph => ({ from: ph.from, to: ph.to, type: ph.type, mult: ph.mult || 1, targets: ph.targets || 0 })), fightT) : null;
  const downtime = rawPhases.filter(ph => ph.type === 'intermission').map(ph => [ph.from, ph.to]);
  const kit = ['icyVeins', PAIR[0], PAIR[1], 'arcanePower', 'berserking', 'bloodlust'];
  const en = {}; for (const k of ALL_BUFFS) en[k] = kit.includes(k);

  const txt = fs.readFileSync(f, 'utf8');
  const re = /plan@h(-?\d+):\s*eff=([\d.]+)\s*(\{.*\})/g;
  let m, seen = 0;
  while ((m = re.exec(txt))) {
    seen++;
    const H = +m[1], spec = JSON.parse(m[3]);
    const s = {};
    for (const gk of Object.keys(K)) if (spec[gk]) s[K[gk]] = spec[gk].slice();
    const cfg = { T: fightT, hasteRating: H, ...REF, enabled: en, fixed: { bloodlust: [lust] }, warnings: [], coldSnap: true, segments };
    const eff = simulate(s, cfg, true).actEff || {};
    const div = [];
    let burn = 0;
    for (const gk of Object.keys(K)) {
      if (!spec[gk]) continue;
      const ints = spec[gk].slice().sort((a, b) => a - b);
      const fires = (eff[K[gk]] || []).slice().sort((a, b) => a - b);
      for (let i = 0; i < ints.length; i++) {
        if (i >= fires.length) { div.push(`${gk}@${ints[i]} NEVER FIRES`); continue; }
        const d = fires[i] - ints[i];
        if (Math.abs(d) <= 0.5) continue;
        const dur = BUFFS[K[gk]].dur;
        // What the sim loses vs what the model scored: downtime inside the sim's window minus
        // downtime inside the model's. Positive = buff-seconds the model never charged.
        const b = ovl(ints[i], ints[i] + dur, downtime) - ovl(fires[i], fires[i] + dur, downtime);
        burn += Math.max(0, b);
        div.push(`${gk}@${ints[i]}→${fires[i].toFixed(2)} (+${d.toFixed(2)}s)${b > 0.05 ? ` BURN ${b.toFixed(1)}s` : ''}`);
      }
    }
    rows.push({ tag: `${m0[1]}-${PAIR.join('-')}`, H, nDiv: div.length, burn, div });
  }
  if (!seen) console.error(`WARN: ${base} contained no plan@ lines — format changed?`);
}

const nPlans = rows.length;
const withDiv = rows.filter(r => r.nDiv > 0);
const withBurn = rows.filter(r => r.burn > 0.5);
console.log(`P7.15 RETRO ARM — banked specs replayed through the CURRENT engine (${files.length} file(s), ${nPlans} plans)`);
console.log(`plans with ≥1 press that fires >0.5s from its emitted time: ${withDiv.length} (${(100 * withDiv.length / Math.max(1, nPlans)).toFixed(0)}%)`);
console.log(`plans where that costs downtime buff the model never charged: ${withBurn.length} (${(100 * withBurn.length / Math.max(1, nPlans)).toFixed(0)}%), ${rows.reduce((a, r) => a + r.burn, 0).toFixed(1)}s total`);
console.log('');
for (const r of withDiv.sort((a, b) => b.burn - a.burn || b.nDiv - a.nDiv)) {
  console.log(`  ${r.tag.padEnd(28)} h${String(r.H).padStart(3)}  burn ${r.burn.toFixed(1).padStart(4)}s  ${r.div.join(' · ')}`);
}
if (!withDiv.length) console.log('  (none — every emitted press fires within 0.5s of its stated time under the current engine)');
