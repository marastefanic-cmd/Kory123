// JITTER — is a plan's advantage EXECUTABLE, or is it exact-timing luck?
//
// ★ THE QUESTION THIS EXISTS TO ANSWER, from the user (2026-07-28):
//   "those are lucky artifacts right, clipping the haste buffs etc.? … the fights, the lust activation,
//    the movement etc, are not executable to the millisecond, so the hypothetical perfect clipping is
//    not realistic, what is realistic is following an established logical set of rules."
//
// The scorer answers "which plan is worth more if executed exactly." That is the right question for a
// robot and the wrong one for a raider. A plan whose margin comes from landing a press on one specific
// cast boundary is worth nothing if the boundary moves — and it moves for free, every pull: latency,
// a step out of the fire, the shaman calling Lust a beat late, a resisted cast.
//
// So this tool re-scores each plan as an EXPECTATION over execution error, and reports both numbers.
// A plan that wins exactly and loses under jitter was never really winning.
//
// Three jitter models, because they are different failure modes and a plan can survive one and not
// another:
//   common     every player press shifts together by δ — "I started my opener late"
//   independent each player press shifts on its own — "I was mid-cast / mid-move on that one"
//   call       the pinned raid call moves — "the shaman Lusted when he Lusted"
//
// ⚠ REPAIR IS LEFT ON, deliberately. When a jittered press lands somewhere illegal the game does not
// refuse it, it just happens later — `repair` is the model of exactly that, so a plan that only stays
// legal at its nominal times SHOULD be charged for it here.
//
// Determinism: the offsets are a fixed lattice, never sampled. Same inputs ⇒ same numbers, per the
// project's standing rule against `Math.random` outside the seeded PRNG.
import { loadEngine, ALL_BUFFS } from './engine-node.mjs';

// Accept both `--key=value` and `--key value`. The JSON payloads here are long enough that a human
// will reach for the spaced form, and silently parsing `--spec` as a boolean flag (leaving the JSON as
// a stray positional) prints the usage line and looks like a typo in the JSON.
const args = (() => {
  const out = {}, argv = process.argv.slice(2);
  for (let i = 0; i < argv.length; i++) {
    const m = argv[i].match(/^--([^=]+)(?:=([\s\S]*))?$/);
    if (!m) continue;
    if (m[2] !== undefined) out[m[1]] = m[2];
    else if (argv[i + 1] !== undefined && !argv[i + 1].startsWith('--')) out[m[1]] = argv[++i];
    else out[m[1]] = true;
  }
  return out;
})();
const api = loadEngine(args.html || 'index.html');
{
  const p = { T: 30, hasteRating: 0, sp: 1000, critPct: 25, enabled: {}, fixed: {}, warnings: [], coldSnap: false, segments: null };
  const r = api.simulate(api.repair({}, p), p, true);
  if (!r.casts.length || r.casts[0].frac === undefined) {
    console.error('JITTER ERROR: this index.html predates the boundary credit (casts[].frac absent).');
    process.exit(2);
  }
}

const spec = JSON.parse(args.spec || '{}');       // { T, hasteRating, sp, critPct, coldSnap, kit, pins }
const plans = JSON.parse(args.plans || '{}');     // { name: schedule }
if (!spec.T || !Object.keys(plans).length) {
  console.error('usage: node tools/jitter.mjs --spec \'{"T":100,...}\' --plans \'{"model":{...},"custom":{...}}\'');
  process.exit(2);
}
const AMP  = Number(args.amp ?? 1.0);             // jitter half-width in seconds
const STEP = Number(args.step ?? 0.25);
const PINNED = Object.keys(spec.pins || {});

const cfgFor = pins => ({
  T: spec.T, hasteRating: spec.hasteRating || 0, sp: spec.sp, critPct: spec.critPct,
  enabled: Object.fromEntries(ALL_BUFFS.map(k => [k, (spec.kit || []).includes(k)])),
  fixed: pins, warnings: [], coldSnap: spec.coldSnap !== false, segments: null,
});
const score = (sched, pins) => {
  const cfg = cfgFor(pins);
  return api.simulate(api.repair(JSON.parse(JSON.stringify(sched)), cfg), cfg).robust;
};
const unit = (() => {
  const cfg = cfgFor({});
  return api.simulate(api.repair({}, cfg), cfg, true).casts.find(x => x.stacks >= api.GAME.AB.MAX_STACKS).dmg;
})();

const offsets = []; for (let d = -AMP; d <= AMP + 1e-9; d += STEP) offsets.push(+d.toFixed(4));
const clampT = t => Math.max(0, Math.min(spec.T - 1, +t.toFixed(4)));
// A player press is one the mage makes; a pinned raid call is somebody else's and jitters separately.
const playerKeys = s => Object.keys(s).filter(k => !PINNED.includes(k));

function nominal(name) {
  const s = plans[name];
  const pins = {}; for (const k of PINNED) if (s[k]) pins[k] = s[k];
  return score(s, pins);
}
// mean over a jitter model, plus the worst single outcome (a plan can have a fine mean and a cliff)
function underJitter(name, mode) {
  const s = plans[name], keys = playerKeys(s);
  const vals = [];
  const evalWith = (shifted, pinShift) => {
    const pins = {}; for (const k of PINNED) if (s[k]) pins[k] = s[k].map(t => clampT(t + pinShift));
    const sched = { ...shifted };
    for (const k of PINNED) if (s[k]) sched[k] = pins[k];
    vals.push(score(sched, pins));
  };
  if (mode === 'common') {
    for (const d of offsets) {
      const sh = {}; for (const k of keys) sh[k] = s[k].map(t => clampT(t + d));
      evalWith(sh, 0);
    }
  } else if (mode === 'call') {
    for (const d of offsets) {
      const sh = {}; for (const k of keys) sh[k] = s[k].slice();
      evalWith(sh, d);
    }
  } else {                                   // independent: full product over the press list
    const flat = [];
    for (const k of keys) s[k].forEach((t, i) => flat.push([k, i]));
    const total = Math.pow(offsets.length, flat.length);
    if (total > 400000) { console.error(`JITTER ERROR: independent grid is ${total} cells — raise --step.`); process.exit(2); }
    for (let n = 0; n < total; n++) {
      const sh = {}; for (const k of keys) sh[k] = s[k].slice();
      let m = n;
      for (const [k, i] of flat) { sh[k][i] = clampT(s[k][i] + offsets[m % offsets.length]); m = Math.floor(m / offsets.length); }
      evalWith(sh, 0);
    }
  }
  const mean = vals.reduce((a, b) => a + b, 0) / vals.length;
  return { mean, min: Math.min(...vals), max: Math.max(...vals), n: vals.length };
}

const names = Object.keys(plans);
console.log(`JITTER — ${spec.T}s · ${spec.hasteRating || 0} haste · ${spec.sp} SP · ${spec.critPct}% crit` +
            (PINNED.length ? ` · pinned: ${PINNED.join(', ')}` : ''));
console.log(`Jitter ±${AMP}s in ${STEP}s steps. Values in effective casts; Δ is against the first plan.\n`);
const base = {};
for (const mode of ['exact', 'common', 'call', 'independent']) {
  console.log(`── ${mode === 'exact' ? 'EXACT — every press lands on its nominal second' :
                    mode === 'common' ? 'COMMON — the whole opener shifts together' :
                    mode === 'call' ? 'CALL — the pinned raid call moves, the player does not' :
                    'INDEPENDENT — every press wanders on its own'} ──`);
  for (const n of names) {
    const r = mode === 'exact' ? { mean: nominal(n), min: NaN, max: NaN, n: 1 } : underJitter(n, mode);
    if (n === names[0]) base[mode] = r.mean;
    const d = (r.mean - base[mode]) / unit;
    console.log(`   ${n.padEnd(10)} ${(r.mean / unit).toFixed(4).padStart(9)} casts` +
                (Number.isFinite(r.min) ? `   worst ${(r.min / unit).toFixed(4)}  best ${(r.max / unit).toFixed(4)}  (${r.n} cells)` : '                                        ') +
                `   ${n === names[0] ? '—' : (d >= 0 ? '+' : '') + d.toFixed(4) + ' casts'}`);
  }
  console.log('');
}
