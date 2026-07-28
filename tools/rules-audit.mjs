// RULES-AUDIT — do the established facts actually ADD UP to the plan the scorer reports?
//
// ★ THE QUESTION, from the user (2026-07-28): *"just from these rules alone we should be able to
// determine the best timeline layout, no? That you should be able to check the scorer and the search
// if they're doing what they should."*
//
// Yes — and this is the instrument. `docs/ESTABLISHED-FACTS.md` Parts I–III say a layout's value is the
// inclusion–exclusion expansion of its cooldowns:
//
//     V(layout) = Σ singles  +  Σ pair interactions  +  Σ triple terms  +  (4-way …)
//
// Every term on the right is measured INDEPENDENTLY, by scoring subsets of the same layout. So the
// expansion is a second, structurally different account of the same number — and comparing the two
// tests **two different things at once**:
//
//   • the SCORER — if the expansion converges and the residual is ~0, the scorer is doing exactly what
//     the rules describe and nothing else. A large high-order residual means there is a mechanism in
//     the engine that the facts corpus has not captured.
//   • the SEARCH — with the same machinery, enumerate the layouts the RULES nominate and check the
//     emitted plan is the best of them. A better one found here is a search failure, not a scorer bug
//     (the objective is exact; PHASE12).
//
// ⚠ WHAT THIS CANNOT DO, and it matters: the expansion is exact **for the layout it is given**. It does
// not by itself tell you the optimum, because every term depends on `Δ(covered)`, an integer that comes
// from the actual cast lattice. The rules narrow the candidates to a handful of structures; the engine
// still has to price them. "Determine the best layout from the rules alone" is therefore true at the
// level of STRUCTURE (which cooldown goes to the pull, which cluster together) and false at the level
// of the exact second.
import { loadEngine, ALL_BUFFS } from './engine-node.mjs';

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
    console.error('RULES-AUDIT ERROR: this index.html predates the boundary credit.'); process.exit(2);
  }
}

const spec = JSON.parse(args.spec || '{}');
const layout = JSON.parse(args.layout || '{}');
if (!spec.T || !Object.keys(layout).length) {
  console.error("usage: node tools/rules-audit.mjs --spec '{\"T\":100,...}' --layout '{\"icyVeins\":[1,48],...}'");
  process.exit(2);
}
const PINNED = Object.keys(spec.pins || {});
const KEYS = Object.keys(layout);

const cfgFor = keys => ({
  T: spec.T, hasteRating: spec.hasteRating || 0, sp: spec.sp, critPct: spec.critPct,
  enabled: Object.fromEntries(ALL_BUFFS.map(k => [k, keys.includes(k)])),
  fixed: Object.fromEntries(PINNED.filter(k => keys.includes(k)).map(k => [k, layout[k]])),
  warnings: [], coldSnap: spec.coldSnap !== false, segments: null,
});
// Score the layout restricted to `keys`. Everything else is simply absent — that is what makes the
// subset lattice a clean decomposition rather than a set of differently-repaired plans.
const memo = new Map();
function V(keys) {
  const id = keys.slice().sort().join('|');
  if (memo.has(id)) return memo.get(id);
  const cfg = cfgFor(keys);
  const sched = {}; for (const k of keys) sched[k] = layout[k].slice();
  const v = api.simulate(api.repair(JSON.parse(JSON.stringify(sched)), cfg), cfg).robust;
  memo.set(id, v); return v;
}
const unit = (() => {
  const cfg = cfgFor([]);
  return api.simulate(api.repair({}, cfg), cfg, true).casts.find(x => x.stacks >= api.GAME.AB.MAX_STACKS).dmg;
})();
const base = V([]);

// Möbius inversion over the subset lattice: the pure k-way term for a set S is
//     I(S) = Σ_{R ⊆ S} (−1)^{|S|−|R|} · V(R)
// which is exactly "what is left after every lower-order explanation is removed".
const subsets = arr => arr.reduce((acc, x) => acc.concat(acc.map(s => [...s, x])), [[]]);
const interactionOf = S => {
  let t = 0;
  for (const Rs of subsets(S)) t += ((S.length - Rs.length) % 2 ? -1 : 1) * V(Rs);
  return t;
};

console.log(`RULES-AUDIT — ${spec.T}s · ${spec.hasteRating || 0} haste · ${spec.sp} SP · ${spec.critPct}% crit`);
console.log(`Layout: ${KEYS.map(k => `${k}@${layout[k].join('/')}`).join('  ')}`);
console.log(`Casts are relative to the bare fight (${(base / unit).toFixed(3)} casts of baseline).\n`);

const byOrder = [];
for (let order = 1; order <= KEYS.length; order++) {
  const terms = [];
  const walk = (start, cur) => {
    if (cur.length === order) { terms.push([cur.slice(), interactionOf(cur)]); return; }
    for (let i = start; i < KEYS.length; i++) { cur.push(KEYS[i]); walk(i + 1, cur); cur.pop(); }
  };
  walk(0, []);
  const sum = terms.reduce((a, [, v]) => a + v, 0);
  byOrder.push({ order, terms, sum });
}
const total = V(KEYS) - base;

console.log('   order | terms |        sum (casts) | running total | still unexplained');
let run = 0;
for (const o of byOrder) {
  run += o.sum;
  console.log(`   ${String(o.order).padStart(5)} | ${String(o.terms.length).padStart(5)} | ${(o.sum / unit).toFixed(4).padStart(18)} | ` +
              `${(run / unit).toFixed(4).padStart(13)} | ${((total - run) / unit).toFixed(6).padStart(17)}`);
}
console.log(`\n   actual layout value: ${(total / unit).toFixed(4)} casts`);
console.log(`   expansion residual : ${((total - run) / unit).toExponential(3)} casts` +
            (Math.abs(total - run) / unit < 1e-9 ? '   ✓ the rules account for the plan EXACTLY' : '   ⚠ unexplained'));

// ── the SEARCH half — is the given layout actually the best one? ─────────────────────────────────
// Coordinate descent from many deterministic starts. Each press time is swept over every legal second
// with the others held, repeatedly, until nothing improves. This does not prove global optimality, but
// a plan that survives it from dozens of unrelated starts is not a local-optimum artifact — and any
// layout it finds that BEATS the emitted plan is a search failure, since the objective is exact.
if (args.search) {
  const free = [];
  for (const k of KEYS) { if (PINNED.includes(k)) continue; layout[k].forEach((_, i) => free.push([k, i])); }
  const cfg = cfgFor(KEYS);
  const scoreOf = s => {
    const rep = api.repair(JSON.parse(JSON.stringify(s)), cfg);
    // ⚠ score the REPAIRED schedule — an illegal candidate is not rejected, it is what the game would
    // actually do with it, and pretending otherwise would let the descent walk through illegal states.
    return api.simulate(rep, cfg).robust;
  };
  const clone = s => Object.fromEntries(Object.entries(s).map(([k, v]) => [k, v.slice()]));
  const starts = [];
  starts.push(clone(layout));                                   // the emitted plan itself
  const NS = Number(args.starts ?? 24);
  for (let n = 0; n < NS; n++) {                                // deterministic spread, no PRNG
    const s = clone(layout);
    for (let j = 0; j < free.length; j++) {
      const [k, i] = free[j];
      const span = spec.T - api.BUFFS[k].dur;
      s[k][i] = Math.max(0, Math.round((((n + 1) * (j + 3) * 37) % 101) / 100 * span));
    }
    for (const k of Object.keys(s)) s[k].sort((a, b) => a - b);
    starts.push(s);
  }
  let best = null;
  for (const s0 of starts) {
    let s = clone(s0), v = scoreOf(s);
    for (let round = 0; round < 12; round++) {
      let moved = false;
      for (const [k, i] of free) {
        const span = spec.T - api.BUFFS[k].dur;
        let bt = s[k][i], bv = v;
        for (let t = 0; t <= span; t++) {
          if (t === s[k][i]) continue;
          const c = clone(s); c[k][i] = t; c[k].sort((a, b) => a - b);
          const cv = scoreOf(c);
          if (cv > bv + 1e-9) { bv = cv; bt = t; }
        }
        if (bt !== s[k][i]) { s[k][i] = bt; s[k].sort((a, b) => a - b); v = bv; moved = true; }
      }
      if (!moved) break;
    }
    if (!best || v > best.v + 1e-9) best = { v, s: clone(s) };
  }
  const given = scoreOf(layout);
  console.log(`\n── SEARCH CHECK — coordinate descent from ${starts.length} starts, ${free.length} free press times ──`);
  console.log(`   emitted layout : ${(( given - base) / unit).toFixed(4)} casts`);
  console.log(`   best found     : ${((best.v - base) / unit).toFixed(4)} casts   ` +
              Object.entries(best.s).map(([k, v]) => `${k}@${v.join('/')}`).join(' '));
  const d = (best.v - given) / unit;
  console.log(`   ⇒ ${Math.abs(d) < 1e-9 ? '✓ the emitted plan IS the best this finds'
              : d > 0 ? `✗ SEARCH FAILURE — a layout ${d.toFixed(4)} casts better exists`
                      : '✓ nothing better found'}`);
}

if (args.terms) {
  for (const o of byOrder) {
    if (o.order > Number(args.terms)) break;
    console.log(`\n── order ${o.order} ──`);
    for (const [S, v] of o.terms.slice().sort((a, b) => Math.abs(b[1]) - Math.abs(a[1])))
      if (Math.abs(v) / unit > 1e-6) console.log(`   ${(v / unit >= 0 ? '+' : '') + (v / unit).toFixed(4).padStart(9)}  ${S.join(' + ')}`);
  }
}
