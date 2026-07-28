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
// ── STATUS 07-28 ──────────────────────────────────────────────────────────────────────────────────
// ✅ **A1 PASSES.** The D1 fix landed (`phaseFinish` in `index.html`, MODEL-DEFECTS §8e) and the
// optimizer now puts Berserking inside Bloodlust. The header note that used to sit here — "this suite
// is expected to fail, A1 is the target" — is discharged for A1.
//
// ⛔ **A2 and A3 still FAIL, and the failure has changed in kind.** They lock exact timestamps; the
// phase-ranked optimizer emits a THIRD layout (A2: Icy Veins 0:06/0:26 · cluster 0:23 · Berserking
// 0:50) which it scores ABOVE ground truth on the objective it now ranks on. So the diff no longer
// says "a press is outside its rule" — it says "not these exact seconds". Read the diff before
// concluding anything: the two mean different things, and only the first is a scoring defect.
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

// ── A2 / A3 — FULL-TIMELINE anchors ───────────────────────────────────────────────────────────────
// ★ These two lock every press time, not just one property. That is a deliberate exception to the
// header's rule and it is the user's ruling (2026-07-28): *"these two examples I sent are genuinely
// safe to lock even the timestamps on… these two need to always be this way."*
//
// It is defensible on two separate grounds, and it is worth being clear which is doing the work:
//   · the SCORE part — Bloodlust is pinned late enough (0:20) that no Arcane-Blast-stack cheese is
//     available, every cooldown's placement follows a rule in ESTABLISHED-FACTS, and wowsims prefers
//     these layouts over what the optimizer emits (Example 1: +2.0 DPS ± 0.37 over 5 seeds).
//   · the TIE-BREAK part — where a press sits on a plateau the sim cannot resolve (Berserking scores
//     193000 at @40, @45 AND @50 on Example 1), the exact second locked here is the *structural*
//     choice: cluster with the other presses, fewest distinct press moments, most robust to a press
//     landing late. That is the same ruling as MODEL-DEFECTS D2.
// ⚠ So an A2/A3 failure means one of two different things, and the diff will say which: a press
// OUTSIDE its rule (a real scoring defect) or a press on the wrong member of a plateau (a tie-break
// defect). Do not "fix" the second by loosening the anchor.
const FULL = [
  { name: 'A2 — 2:00, Lust@0:20, h=0, 1000 SP, 25% crit',
    c: { T: 120, haste: 0, sp: 1000, crit: 25, coldSnap: true, pins: { bloodlust: [20] },
         kit: ['icyVeins', 'isc', 'scb', 'arcanePower', 'berserking', 'bloodlust'] },
    want: { icyVeins: [0, 20], isc: [20], scb: [20], arcanePower: [20], bloodlust: [20], berserking: [40] } },
  { name: 'A3 — 3:00, Lust@0:20, h=0, 1000 SP, 25% crit',
    c: { T: 180, haste: 0, sp: 1000, crit: 25, coldSnap: true, pins: { bloodlust: [20] },
         kit: ['icyVeins', 'isc', 'scb', 'arcanePower', 'berserking', 'bloodlust'] },
    want: { icyVeins: [20, 140], isc: [20, 140], scb: [20, 140], arcanePower: [20], bloodlust: [20], berserking: [140] } },
];
for (const { name, c, want } of FULL) {
  ran++;
  const cfg = cfgFor(c);
  const out = await api.optimizeAsync(cfg, undefined, () => {});
  const got = out.s;
  const diffs = [];
  for (const k of Object.keys(want)) {
    const g = (got[k] || []).map(x => +x.toFixed(3)), w = want[k];
    if (g.length !== w.length || g.some((v, i) => Math.abs(v - w[i]) > 1e-6)) diffs.push(`${k}: want [${w}] got [${g}]`);
  }
  for (const k of Object.keys(got)) if (!(k in want)) diffs.push(`${k}: unexpected, got [${got[k]}]`);
  if (diffs.length) failures++;
  console.log(`${diffs.length ? 'FAIL' : 'PASS'}  ${name}`);
  console.log(`      ground truth, user-ruled 07-28; Lust pinned late so no stack cheese is available`);
  for (const d of diffs) console.log(`      ⛔ ${d}`);
  console.log('');
}

console.log(`${ran - failures} passed, ${failures} failed`);
if (failures) {
  console.log('\n⛔ Expected while MODEL-DEFECTS D1 is open. This suite is the target for that fix,');
  console.log('   not a regression signal — see the header.');
}
process.exit(failures ? 1 : 0);
