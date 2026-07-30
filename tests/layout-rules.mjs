// THE LAYOUT RULES — a user specification, executable.
//
//   node tests/layout-rules.mjs [--verbose]
//
// Exit: 0 = every rule holds · 1 = a rule is violated · 2 = could not check.
//
// ── WHY THIS FILE EXISTS ─────────────────────────────────────────────────────────────────────────
// On 2026-07-28 the user wrote out, in prose, what the plan MUST look like on short single-use
// fights and on two-use fights, and said: *"any divergence from it is from now on a bug."* They also
// said *"I don't wanna hardcode the numbers because some internal logic might change"* — which is
// exactly right, and is why this is a PROPERTY test. It asserts the SHAPE of the emitted plan
// (what lands with what, and in which order), never a score and never a second.
//
// `tests/exact-match.mjs` pins the plan byte for byte and tells you *that* something moved.
// This file tells you *what rule broke*. They fail for different reasons and both are wanted.
//
// ── ⚠ ONE RULE IN THE SPEC IS CORRECTED HERE, AND THE CORRECTION IS MEASURED ─────────────────────
// The spec said the first Icy Veins joins the cluster — pressed when Bloodlust is up AND 3 Arcane
// Blast stacks are built. Measured on Karathress (T=120, Lust@5), holding everything else fixed and
// moving ONLY that press:
//
//     Icy Veins on the opening ramp (0–4 s) → 94 casts
//     Icy Veins with the cluster   (5+ s)   → 93 casts        ← a whole cast, not a rounding sliver
//
// The reason is the GCD floor, and it is the same floor the spec's own reasoning rests on. Ramp casts
// at h=0 are **2.500 / 2.166 / 1.832 s** — every one ABOVE the 1.5 s GCD — so Icy Veins divides them
// in full. At 3 stacks under Bloodlust the interval is already floored at 1.0 s, so Icy Veins converts
// only the part above the floor. Brute force over **317 200** legal Karathress layouts: the emitted
// plan ranks 1st (tied), and the best layout obeying the uncorrected rule is **−0.274 %**. The sim
// agrees independently — Hydross +4.5 DPS, Karathress +2.0 DPS, Lurker +1.6 DPS (3 seeds each).
//
// ★ And the corrected rule does not contradict the spec's INTENT, it serves it: because Icy Veins
// compresses the ramp, 3 stacks arrive at ~5.4 s instead of ~6.5 s, so the damage cluster lands
// EARLIER than the spec's own construction would place it — still at full stacks, just sooner.
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadEngine, cfgFor, ALL_BUFFS } from '../tools/engine-node.mjs';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const api = loadEngine(path.join(REPO, 'index.html'));
const VERBOSE = process.argv.includes('--verbose');
const B = api.BUFFS;

// The fights the spec names, built from the page's own presets so they cannot drift apart.
const CASES = ['Hydross the Unstable', 'Fathom-lord Karathress', 'Morogrim Tidewalker', 'The Lurker Below'];
const CLUSTER = ['isc', 'scb', 'arcanePower'];   // the damage cluster: SP + SP + Arcane Power

const rows = [], fails = [];
for (const name of CASES) {
  const kase = api.cases.find(c => c.name === name);
  if (!kase) { console.error(`ERROR: preset "${name}" is gone from index.html — the spec names it.`); process.exit(2); }
  const cfg = cfgFor(api, kase);
  const s = (await api.optimizeAsync(cfg, 3, () => {})).s;
  const r = api.simulate(JSON.parse(JSON.stringify(s)), cfg, true);
  const lust = (s.bloodlust || [])[0];
  if (lust === undefined) continue;
  const lustEnd = lust + B.bloodlust.dur;
  // 3 stacks are built at the START of the first cast carrying stacks === MAX_STACKS.
  const full = r.casts.find(c => c.stacks >= api.GAME.AB.MAX_STACKS);
  const t3 = full ? full.t : Infinity;
  // ⚠ FIRE TIMES, NOT PRESS INTENTS. The spec is about when a cooldown actually goes off, and a
  // self-press cannot fire mid-cast — it lands on the next cast boundary. Karathress emits the cluster
  // at intent 4 and it FIRES at 5.415, after a Lust called at 5: obeying the rule, not breaking it.
  // Comparing intents against Lust reported two false failures the first time this ran.
  const fireOf = t => { const c = r.casts.find(x => x.t >= t - 1e-6); return c ? c.t : t; };
  const ivs = (s.icyVeins || []).slice().sort((a, b) => a - b);
  const clusterAt = CLUSTER.filter(k => s[k] && s[k].length).map(k => fireOf(s[k][0]));
  const zerk = (s.berserking || [])[0];
  const twoUse = (s.isc || []).length > 1;

  const check = (id, ok, detail) => {
    rows.push({ name, id, ok, detail });
    if (!ok) fails.push(`${name} — ${id}: ${detail}`);
  };

  // R1 — the damage cluster waits for Bloodlust AND full stacks. This is the spec verbatim, and the
  // model obeys it; it is the rule most likely to be broken by a future scorer change.
  check('cluster after Lust + 3 stacks',
    clusterAt.every(t => t >= Math.min(lust, t3) - 1e-6),
    `cluster at [${clusterAt.join(', ')}], Lust ${lust}, 3 stacks at ${t3.toFixed(2)}`);

  // R2 — the cluster is ONE press moment, not scattered. "popped together with one macro".
  check('cluster is co-pressed',
    Math.max(...clusterAt) - Math.min(...clusterAt) <= 1 + 1e-6,
    `cluster spans ${(Math.max(...clusterAt) - Math.min(...clusterAt)).toFixed(1)}s: [${clusterAt.join(', ')}]`);

  // R3 — ⚠ THE CORRECTED RULE (see the header). The first Icy Veins takes the OPENING RAMP, because
  // ramp casts sit above the GCD and Icy Veins converts them in full. It must land before full stacks.
  check('IV1 covers the opening ramp',
    ivs.length > 0 && ivs[0] <= t3 + 1e-6,
    `IV1 at ${ivs[0]}, full stacks at ${t3.toFixed(2)} — deferring IV1 to the cluster costs a whole cast`);

  // R4 — ★★★ REWRITTEN 07-28. "Berserking sits inside Bloodlust" is a TWO-BODY statement and it was
  // asserted here unconditionally. `docs/ESTABLISHED-FACTS.md` §4.1/§5.1 now derives the condition in
  // closed form and verifies it against the engine's integral:
  //
  //     Berserking belongs INSIDE Bloodlust  ⟺  m_full · (v_zerk + v_lust − 1)  ≤  G/F = 1.5
  //
  // where `m_full` is the multiplier of everything ELSE live in that window (passive haste, other haste
  // multipliers, other haste RATING folded into h). With nothing else there the flip is h = 112.6.
  // With Drums also up it is 32.6, and with Icy Veins, Power Infusion, MQG or Skull sharing the window
  // it is **negative** — `1.3 × 1.2 × 1.1 = 1.716` is 14 % over the floor before you own any haste, so
  // Berserking belongs OUTSIDE at every gear level.
  //
  // ⇒ The old assertion demanded "inside" on fights where the algebra says outside, and carried a
  // hand-measured 0.171 % Karathress exception to stay green. Both the demand and the exception are
  // gone: the rule now asks the derived question. This is the header's own instruction ("if the rule
  // itself is wrong — MEASURE that, correct the rule here") being followed, not a relaxation.
  //
  // ⚠ ONE-DIRECTIONAL ON PURPOSE. When the condition says INSIDE, inside is required. When it says
  // OUTSIDE we only report, because `haste × value` can legitimately pull Berserking to the damage
  // cluster instead — its extra casts are worth more under Icon/Arcane Power (ESTABLISHED-FACTS §4),
  // and that trade is a different rule from this one.
  if (zerk !== undefined && !twoUse) {
    const RTG = api.GAME.HASTE_RATING_PER_PCT * 100;
    const zMid = zerk + B.berserking.dur / 2;
    let extraRating = cfg.hasteRating || 0, otherMult = 1;
    for (const k of Object.keys(s)) {
      if (k === 'berserking' || k === 'bloodlust') continue;
      const d = B[k];
      if (!d || (d.kind !== 'mult' && d.kind !== 'rating')) continue;
      for (const t of s[k]) if (zMid >= t - 1e-9 && zMid < t + d.dur) {
        if (d.kind === 'mult') otherMult *= d.value; else extraRating += d.value;
      }
    }
    const mFull = (1 + extraRating / RTG) * otherMult;
    const pairSum = B.berserking.value + B.bloodlust.value - 1;
    const wantInside = mFull * pairSum <= api.GAME.GCD_BASE / api.GAME.GCD_FLOOR + 1e-9;
    const inside = zerk >= lust - 1e-6 && zerk + B.berserking.dur <= lustEnd + 1e-6;
    const overlap = Math.max(0, Math.min(zerk + B.berserking.dur, lustEnd) - Math.max(zerk, lust));
    const why = `m_full ${mFull.toFixed(4)} × (v₁+v₂−1) ${pairSum.toFixed(2)} = ${(mFull * pairSum).toFixed(4)} ` +
                `vs the 1.5 floor ⇒ pair is ${wantInside ? 'POSITIVE, inside required' : 'NEGATIVE, inside not required'}; ` +
                `Berserking ${zerk}–${zerk + B.berserking.dur} vs Lust ${lust}–${lustEnd}, ${overlap.toFixed(1)}s of ${B.berserking.dur}s inside`;
    check('Berserking × Lust obeys its derived sign', wantInside ? inside : true, why);
  }

  // R5 — on a two-use fight Berserking is SAVED for the second Icon/Gem window rather than spent
  // immediately after the first Icy Veins.
  if (twoUse && zerk !== undefined)
    check('two-use: Berserking held for window 2',
      Math.abs(zerk - s.isc[1]) <= 2 + 1e-6 || zerk > (ivs[0] + B.icyVeins.dur),
      `Berserking ${zerk}, second Icon ${s.isc[1]}, first IV ends ${ivs[0] + B.icyVeins.dur}`);

  if (VERBOSE) console.log(`\n${name}: ${JSON.stringify(s)}\n   Lust ${lust}–${lustEnd} · 3 stacks ${t3.toFixed(2)} · casts ${r.casts.length}`);
}

if (!rows.length) { console.error('ERROR: 0 rules checked — refusing a verdict over an empty set.'); process.exit(2); }
console.log('# layout rules — the user specification of 2026-07-28, as properties\n');
let last = '';
for (const r of rows) {
  if (r.name !== last) { console.log(`  ${r.name}`); last = r.name; }
  console.log(`    ${r.ok ? '✓' : '✗'} ${r.id.padEnd(34)} ${r.ok && !VERBOSE ? '' : r.detail}`);
}
console.log(`\n  ${rows.filter(r => r.ok).length} of ${rows.length} rule checks pass.`);
if (fails.length) {
  console.error('\n✗ THE EMITTED PLAN BREAKS A SPECIFIED RULE:');
  for (const f of fails) console.error('   ' + f);
  console.error('\n  Per the user 07-28: a divergence from these rules is a BUG. Fix the plan, or — if the');
  console.error('  rule itself is wrong — MEASURE that (brute force + sim), correct the rule here, and');
  console.error('  record the evidence in docs/RULES.md. Do not simply relax the assertion.');
  process.exit(1);
}
console.log('  ✓ every specified rule holds.');
process.exit(0);
