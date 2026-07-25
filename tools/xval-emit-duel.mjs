// P7.15 (duel arm) — price the TRANSCRIPTION CONVENTION in the sim's own currency.
//
// The other two arms measure the artifact geometrically: `xval-spec-downtime.mjs` reads a banked
// spec and counts buff-seconds spent inside an intermission; `xval-retro-transcribe.mjs` replays the
// spec through the engine and reports where each press really fires. Neither says what the flip is
// WORTH — and the acceptance tables are graded in DPS, not seconds.
//
// This arm sims the SAME banked plan twice, changing ONLY the convention:
//   intent = the spec as banked (`Math.round` of the optimizer's press intents — pre-07-25 xval)
//   fire   = `Math.floor(simulate(s, cfg, true).actEff)` — the times the tool PRINTS (EMIT=fire)
// Same gear, same seed, same iterations, same 5-variant wall jitter as the boss instrument, simmed
// at the plan's OWN haste. The delta is the harness artifact, in DPS.
//
// ⚠ This is a DUEL, not a re-gather: it does NOT re-optimize. It answers "what would the banked
// table have read had it been transcribed correctly", holding the plan fixed. A real re-gather also
// lets the optimizer move, and can differ. Per the HASTE-PORTABILITY LAW a delta measured at one
// haste says nothing about another, so every haste of interest is simmed explicitly.
//
// Usage:  node tools/xval-emit-duel.mjs <banked boss-*.txt> [haste,haste,…]
// Env:    RUNNER, EXPORT_BASE (required) · ITER=6000 · VAR=0.5 · WJITTER=2 · SCRATCH · HTML
// Exit:   0 = duelled · 2 = could not duel (the repo's exit-code contract).
import fs from 'fs';
import os from 'os';
import path from 'path';
import { execFileSync } from 'child_process';
import { fileURLToPath } from 'url';
import { loadEngine, ALL_BUFFS } from './engine-node.mjs';
import { REF } from './reference-gear.mjs';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const api = loadEngine(process.env.HTML || path.join(REPO, 'index.html'));
const { simulate, buildSegments, BUFFS } = api;

const FILE = process.argv[2];
if (!FILE || !fs.existsSync(FILE)) { console.error('usage: node tools/xval-emit-duel.mjs <boss-*.txt> [hastes]'); process.exit(2); }
const RUNNER = process.env.RUNNER, EXPORT_BASE = process.env.EXPORT_BASE;
for (const [n, p] of [['RUNNER', RUNNER], ['EXPORT_BASE', EXPORT_BASE]]) {
  if (!p) { console.error(`ERROR: ${n} is unset.`); process.exit(2); }
  if (!fs.existsSync(p)) { console.error(`ERROR: ${n}="${p}" does not exist (the scratchpad is ephemeral — rebuild it).`); process.exit(2); }
}
const ITER = process.env.ITER || '6000', VAR = process.env.VAR || '0.5';
const WJ = process.env.WJITTER === undefined || process.env.WJITTER === '' ? 2 : +process.env.WJITTER;
if (!Number.isFinite(WJ) || WJ < 0) { console.error(`ERROR: WJITTER must be a non-negative number.`); process.exit(2); }
const SCRATCH = process.env.SCRATCH || fs.mkdtempSync(path.join(os.tmpdir(), 'emitduel-'));
fs.mkdirSync(SCRATCH, { recursive: true });

const K = { IV: 'icyVeins', AP: 'arcanePower', Zerk: 'berserking', Icon: 'isc', Gem: 'scb', Skull: 'skull', MQG: 'mqg', BL: 'bloodlust' };
const TMETA = { isc: { item: 29370, key: 'Icon' }, scb: { item: 30720, key: 'Gem' }, skull: { item: 32483, key: 'Skull' }, mqg: { item: 19339, key: 'MQG' } };
const byName = {}; for (const c of api.cases.slice(0, api.nBoss)) byName[c.name] = c;
const NAMETAG = {}; for (const n of Object.keys(byName)) NAMETAG[n.replace(/[^A-Za-z]/g, '')] = n;

const base = path.basename(FILE);
const m0 = /^boss-([A-Za-z]+)-([a-z]+)-([a-z]+)\.txt$/.exec(base);
if (!m0) { console.error(`ERROR: ${base} does not match boss-<Boss>-<kit>-<kit>.txt.`); process.exit(2); }
const boss = NAMETAG[m0[1]];
if (!boss) { console.error(`ERROR: boss tag "${m0[1]}" matches no BOSS_PRESET.`); process.exit(2); }
const PAIR = [m0[2], m0[3]];
const p = byName[boss];
const fightT = p.T, lust = (p.pins && p.pins.bloodlust && p.pins.bloodlust[0]) || 0;
const rawPhases = p.phases || (p.intermission ? [{ type: 'intermission', from: p.intermission[0], to: p.intermission[1] }] : []);
const segments = rawPhases.length ? buildSegments(rawPhases.map(ph => ({ from: ph.from, to: ph.to, type: ph.type, mult: ph.mult || 1, targets: ph.targets || 0 })), fightT) : null;
const downtime = rawPhases.filter(ph => ph.type === 'intermission').map(ph => [ph.from, ph.to]);
const aoeWins = rawPhases.filter(ph => ph.type === 'aoe').map(ph => [ph.from, ph.to]);
const aoeTargets = Math.max(0, ...rawPhases.filter(ph => ph.type === 'aoe').map(ph => ph.targets || 0));
const kit = ['icyVeins', PAIR[0], PAIR[1], 'arcanePower', 'berserking', 'bloodlust'];
const en = {}; for (const k of ALL_BUFFS) en[k] = kit.includes(k);

// the trinket-swapped export, xval.mjs:126-129 verbatim
const exp = JSON.parse(fs.readFileSync(EXPORT_BASE, 'utf8'));
exp.player.equipment.items[12] = { id: TMETA[PAIR[0]].item };
exp.player.equipment.items[13] = { id: TMETA[PAIR[1]].item };
const EXPORT = path.join(SCRATCH, 'export.json');
fs.writeFileSync(EXPORT, JSON.stringify(exp));

// the boss instrument's 5-variant wall-jitter wash, xval.mjs:264-281 verbatim — a duel run under a
// DIFFERENT wash is not comparable to the table it is meant to correct.
const walls = [...downtime, ...aoeWins].map(w => w[0]).sort((a, b) => a - b);
const mulb = seed => () => { seed |= 0; seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const VARIANTS = [walls.map(() => 0)];
for (let v = 1; v <= 2 * WJ; v++) { const rnd = mulb(9000 + v); VARIANTS.push(walls.map(() => Math.round((rnd() * 2 - 1) * WJ))); }
const shiftSpec = (spec, ds) => {
  if (!ds.some(d => d)) return spec;
  const s = JSON.parse(JSON.stringify(spec));
  const shiftOf = t => { let d = 0; for (let i = 0; i < walls.length; i++) if (t >= walls[i]) d = ds[i]; return d; };
  for (const k in s) {
    if (k === '_intermissions' || k === '_aoe') s[k] = s[k].map(([a, z]) => { const i = walls.indexOf(a); const j = walls.indexOf(z); return [a + (i >= 0 ? ds[i] : 0), z + (j >= 0 ? ds[j] : (i >= 0 ? ds[i] : 0))]; });
    else if (Array.isArray(s[k])) s[k] = s[k].map(t => t + shiftOf(t));
  }
  return s;
};

const simDps = (spec, h, tag) => {
  let acc = 0;
  for (let vi = 0; vi < VARIANTS.length; vi++) {
    const ap = path.join(SCRATCH, `${tag}_${h}_v${vi}.apl.json`);
    execFileSync('node', [path.join(REPO, 'tools/genapl.mjs'), JSON.stringify(shiftSpec(spec, VARIANTS[vi])), ap]);
    const args = ['--export', EXPORT, '--apl', ap, '--dur', String(fightT), '--var', VAR, '--iter', ITER, '--seed', '11', '--mana', '100000000', '--haste', String(h), '--quiet', '--tag', 'm'];
    if (aoeTargets) args.push('--targets', String(aoeTargets));
    const dps = parseFloat(execFileSync(RUNNER, args, { encoding: 'utf8' }).trim().split(/\s+/)[4]);
    // xval.mjs's ★ lesson: a NaN here would average into `acc` and print a confident number.
    if (!Number.isFinite(dps)) { console.error(`ERROR: could not parse DPS for ${tag}@${h} variant ${vi}.`); process.exit(2); }
    acc += dps;
  }
  return acc / VARIANTS.length;
};

// intent spec → fire spec: rebuild the schedule, ask the engine where it fires, floor. CS is
// re-derived from the FIRED IV list exactly as toSpec does (an IV inside IV's own cooldown is the
// Cold-Snap-granted one), because a snapped IV can cross the cooldown boundary the intent didn't.
const toFire = (spec, h) => {
  const s = {};
  for (const gk of Object.keys(K)) if (spec[gk]) s[K[gk]] = spec[gk].slice();
  const cfg = { T: fightT, hasteRating: h, ...REF, enabled: en, fixed: { bloodlust: [lust] }, warnings: [], coldSnap: true, segments };
  const eff = simulate(s, cfg, true).actEff || {};
  const at = gk => (eff[K[gk]] || []).slice().sort((a, b) => a - b).map(Math.floor);
  const out = { _prestack: 0, BL: at('BL') };
  for (const gk of ['AP', 'Zerk', 'Icon', 'Gem', 'Skull', 'MQG']) if (spec[gk]) out[gk] = at(gk);
  const ivOut = [], csOut = []; let cd = -1e9;
  for (const t of at('IV')) { if (t < cd - 1e-6) csOut.push(t); ivOut.push(t); cd = t + BUFFS.icyVeins.cd; }
  if (ivOut.length) out.IV = ivOut;
  if (csOut.length) out.CS = csOut;
  if (downtime.length) out._intermissions = downtime;
  if (aoeWins.length) out._aoe = aoeWins;
  return out;
};

const txt = fs.readFileSync(FILE, 'utf8');
const specs = {};
for (const m of txt.matchAll(/plan@h(-?\d+):\s*eff=([\d.]+)\s*(\{.*\})/g)) specs[+m[1]] = JSON.parse(m[3]);
const want = process.argv[3] ? process.argv[3].split(',').map(Number) : Object.keys(specs).map(Number).sort((a, b) => a - b);
for (const h of want) if (!specs[h]) { console.error(`ERROR: ${base} has no plan@h${h} (has ${Object.keys(specs).join(',')}).`); process.exit(2); }

console.log(`P7.15 EMIT DUEL — ${boss} / ${PAIR.join('+')} / T=${fightT} / iter=${ITER} var=${VAR} wj=${WJ} (${VARIANTS.length} variants) targets=${aoeTargets || 'n/a'}`);
console.log(`same banked plan, two transcriptions: intent (pre-07-25) vs fire (EMIT=fire, the plan the tool prints)\n`);
console.log('haste   intent DPS    fire DPS      Δ DPS     Δ%    presses moved');
const deltas = [];
for (const h of want) {
  const iSpec = specs[h], fSpec = toFire(iSpec, h);
  const moved = [];
  for (const gk of Object.keys(K)) {
    const a = (iSpec[gk] || []), b = (fSpec[gk] || []);
    for (let i = 0; i < Math.min(a.length, b.length); i++) if (a[i] !== b[i]) moved.push(`${gk}${a[i]}→${b[i]}`);
    if (a.length !== b.length) moved.push(`${gk} count ${a.length}→${b.length}`);
  }
  const di = simDps(iSpec, h, 'intent'), df = simDps(fSpec, h, 'fire');
  const d = df - di, pct = 100 * d / di;
  deltas.push(pct);
  console.log(`${String(h).padStart(4)}  ${di.toFixed(1).padStart(10)}  ${df.toFixed(1).padStart(10)}  ${d.toFixed(1).padStart(9)}  ${pct.toFixed(3).padStart(7)}%  ${moved.length ? moved.join(' ') : '(none — identical spec)'}`);
}
const mean = deltas.reduce((a, b) => a + b, 0) / deltas.length;
console.log(`\nEMIT-DUEL-DONE boss=${m0[1]} kit=${PAIR.join('+')} n=${deltas.length} meanΔ=${mean.toFixed(3)}% worst=${Math.min(...deltas).toFixed(3)}% best=${Math.max(...deltas).toFixed(3)}%`);
