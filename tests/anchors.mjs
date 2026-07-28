// ANCHORS — tests that assert what a plan SHOULD be, not what it currently is.
//
// `exact-match` + `golden.json` assert **stability**: they lock in whatever the optimizer said the day
// they were recorded. This file is the other kind — each case asserts a placement that is backed by
// **two independent sources** and would still be right if the optimizer were rewritten tomorrow:
//
//   1. a rule from `docs/ESTABLISHED-FACTS.md`, measured on its own bare-fight corpus, and
//   2. a wowsims duel, which does not care what proposed the layout.
//
// ⚠ AN ANCHOR IS NOT A GOLDEN. It never asserts a whole timeline — only the one property the two
// sources agree on. Pinning the other presses would smuggle today's answers back in under a better
// name, which is the exact failure this file exists to escape.
//
// ⛔ THIS SUITE IS EXPECTED TO FAIL TODAY. A1 fails on `docs/MODEL-DEFECTS.md`'s D1: the optimizer
// books ~0.03 % of cast-lattice phase as real damage and moves Berserking out of Bloodlust to chase it,
// against a +0.2056-cast interaction saying it should stay in. Red is the correct state — the anchor is
// the target for that fix, and it should go green when D1 does.
//
//   node tests/anchors.mjs
import { loadEngine, ALL_BUFFS } from '../tools/engine-node.mjs';

const api = loadEngine(new URL('../index.html', import.meta.url).pathname);
let failures = 0, ran = 0;

const cfgFor = c => ({
  T: c.T, hasteRating: c.haste, sp: c.sp, critPct: c.crit,
  enabled: Object.fromEntries(ALL_BUFFS.map(k => [k, c.kit.includes(k)])),
  fixed: c.pins || {}, warnings: [], coldSnap: c.coldSnap !== false, segments: null,
});

// Fire times, not press intents — a press at 39 that fires at 40.4 is a press at 40.4 as far as any
// statement about buff overlap is concerned.
function fireTimes(sched, cfg) {
  const r = api.simulate(api.repair(JSON.parse(JSON.stringify(sched)), cfg), cfg, true);
  return { casts: r.casts, val: r.robust };
}

async function anchor({ name, why, sources, c, assert: check }) {
  ran++;
  const cfg = cfgFor(c);
  const out = await api.optimizeAsync(cfg, undefined, () => {});
  const sched = out.s;
  const verdict = check(sched, cfg);
  const ok = verdict === true;
  if (!ok) failures++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}`);
  console.log(`      why: ${why}`);
  console.log(`      backed by: ${sources}`);
  console.log(`      emitted: ${Object.entries(sched).map(([k, v]) => `${k}@${v.map(x => +x.toFixed(2)).join('/')}`).join('  ')}`);
  if (!ok) console.log(`      ⛔ ${verdict}`);
  console.log('');
}

// ── A1 ────────────────────────────────────────────────────────────────────────────────────────────
// Berserking (×1.10, 10 s) with Bloodlust (×1.30) is ×1.43 — UNDER the 1.5 the GCD floor needs, so
// nothing is clipped and the full multiplicative cross-term lands. ESTABLISHED-FACTS P4 measures it at
// +0.2056 casts at h=0. The sim agrees: on this exact fight, Berserking inside Lust scores 193000
// against 192665 outside it.
await anchor({
  name: 'A1 — Berserking sits inside Bloodlust at h=0',
  why: 'the pair is x1.43, under the GCD floor, so the whole multiplicative bonus lands',
  sources: 'ESTABLISHED-FACTS P4 (+0.2056 casts) · wowsims (193000 in-Lust vs 192665 out)',
  c: { T: 120, haste: 0, sp: 1000, crit: 25, coldSnap: true, pins: { bloodlust: [20] },
       kit: ['icyVeins', 'isc', 'scb', 'arcanePower', 'berserking', 'bloodlust'] },
  assert: (s, cfg) => {
    const z = s.berserking && s.berserking[0];
    if (z === undefined) return 'Berserking was not scheduled at all';
    const dur = api.BUFFS.berserking.dur, lustStart = 20, lustEnd = 20 + api.BUFFS.bloodlust.dur;
    // its whole window must lie inside Lust's
    if (z >= lustStart - 1e-9 && z + dur <= lustEnd + 1e-9) return true;
    return `Berserking fires @${z.toFixed(2)} covering ${z.toFixed(2)}-${(z + dur).toFixed(2)}, ` +
           `outside Lust's ${lustStart}-${lustEnd}. MODEL-DEFECTS D1.`;
  },
});

console.log(`${ran - failures} passed, ${failures} failed`);
if (failures) {
  console.log('\n⛔ Expected while MODEL-DEFECTS D1 is open. This suite is the target for that fix,');
  console.log('   not a regression signal — see the header.');
}
process.exit(failures ? 1 : 0);
