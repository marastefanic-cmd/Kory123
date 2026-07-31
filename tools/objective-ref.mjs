// INDEPENDENT REFERENCE for the objective, written from docs/MECHANICS.md + ESTABLISHED-FACTS.md
// rather than from index.html. If the engine and this disagree, one of them is wrong — and because
// this shares no code with the engine, agreement is real evidence rather than a tautology.
import { loadEngine, cfgFor } from './engine-node.mjs';
const HTML = (process.argv.find(a => a.startsWith('--html=')) || '').split('=')[1]
          || new URL('../index.html', import.meta.url).pathname;
const api = loadEngine(HTML);
const G = api.GAME, B = api.BUFFS;
const msq = x => Math.round(x * 1000) / 1000;

// ── the reference, built only from the documented laws ────────────────────────────────────────────
function refScore(plan, kase) {
  const T = kase.T, sp0 = kase.gear.sp, crit = kase.gear.crit / 100, h = kase.gear.haste || 0;
  const t5 = !!kase.t5two;
  const critF = 1 + crit * (G.CRIT_MULT - 1);
  const segAt = t => (kase.phases || []).find(p => t >= p.from && t < p.to) || null;

  // buff state at t, from press windows (RULES §7a composition law)
  const state = t => {
    let rating = h, mult = 1, dmgMult = 1, sp = sp0, bl = false, pi = false;
    for (const k of Object.keys(plan)) {
      const def = B[k]; if (!def) continue;
      for (const p of plan[k]) {
        if (t < p || t >= p + def.dur) continue;
        if (k === 'powerInfusion') pi = true;
        else if (def.kind === 'mult') { mult *= def.value; if (k === 'bloodlust') bl = true; }
        else if (def.kind === 'rating') rating += def.value;
        else if (def.kind === 'dmg') dmgMult *= def.value;
        else if (def.kind === 'sp') sp += def.value;
      }
    }
    if (pi && !bl) mult *= B.powerInfusion.value;
    return { m: mult * (1 + rating / (G.HASTE_RATING_PER_PCT * 100)), dmgMult, sp };
  };
  const rateAt = t => {
    const sg = segAt(t);
    if (sg && sg.type === 'intermission') return 0;          // no casting at all
    const { m, dmgMult, sp } = state(t);
    const gcd = msq(Math.max(G.GCD_FLOOR, G.GCD_BASE / m));
    if (sg && sg.type === 'aoe') {
      const N = sg.targets;
      const d = (G.AE.AVG_BASE_DMG + G.AE.COEF * sp) * N * critF * dmgMult * api.aoeCritAmp(N, crit);
      return d / gcd;                                         // Arcane Explosion is instant ⇒ GCD-bound
    }
    let d = (G.AB.AVG_BASE_DMG + G.AB.COEF * sp) * critF * (dmgMult + (t5 ? 0.2 : 0));
    if (sg && sg.type === 'burn') d *= sg.mult;
    const int = Math.max(msq((G.AB.BASE_CAST - G.AB.STACK_CAST_REDUCTION * G.AB.MAX_STACKS) / m), gcd);
    return d / int;
  };
  // exact piecewise integration: breakpoints are every window edge + phase edge
  const E = new Set([0, T]);
  for (const k of Object.keys(plan)) for (const p of plan[k]) {
    if (p > 0 && p < T) E.add(p);
    const e = p + B[k].dur; if (e > 0 && e < T) E.add(e);
  }
  for (const p of kase.phases || []) { if (p.from > 0 && p.from < T) E.add(p.from); if (p.to > 0 && p.to < T) E.add(p.to); }
  const es = [...E].sort((a, b) => a - b);
  let total = 0;
  for (let i = 0; i < es.length - 1; i++) total += rateAt((es[i] + es[i + 1]) / 2) * (es[i + 1] - es[i]);

  /* The opener toll (ESTABLISHED-FACTS §1.2, MODEL-DEFECTS §9a F1): how much longer each ramp cast takes
     than a steady cast at the SAME haste, in units of steady casts. Identically 1.332 for every m ≤ 1.5
     — below the floor the 1/m cancels top and bottom, which is §8q's ramp-neutrality — and collapsing
     above it as the floor pins the steady interval while the ramp casts keep shortening.
     ⚠ The SPREAD window `sumC` stays UNHASTED (the engine's `NOMINAL`); only the LUMP is m-dependent.
     Mixing those up is what §8q rejected. */
  const m0 = state(0).m;
  const G1 = msq(Math.max(G.GCD_FLOOR, G.GCD_BASE / m0));
  let sumC = 0, toll = 0;
  for (let k = 0; k < G.AB.MAX_STACKS; k++) {
    sumC += G.AB.BASE_CAST - G.AB.STACK_CAST_REDUCTION * k;
    toll += (Math.max(msq((G.AB.BASE_CAST - G.AB.STACK_CAST_REDUCTION * k) / m0), G1) - G1) / G1;
  }
  // spread over [0, ΣC_k] as a negative rate scaled by the local damage
  let tollDmg = 0;
  const te = [...new Set([0, sumC, ...es.filter(x => x > 0 && x < sumC)])].sort((a, b) => a - b);
  for (let i = 0; i < te.length - 1; i++) {
    const mid = (te[i] + te[i + 1]) / 2, { dmgMult, sp } = state(mid);
    const d = (G.AB.AVG_BASE_DMG + G.AB.COEF * sp) * critF * (dmgMult + (t5 ? 0.2 : 0));
    tollDmg += (toll / sumC) * d * (te[i + 1] - te[i]);
  }
  return (total - tollDmg) / ((G.AB.AVG_BASE_DMG + G.AB.COEF * sp0) * critF * (t5 ? 1.2 : 1));
}

// ── compare ───────────────────────────────────────────────────────────────────────────────────────
let bad = 0;
/* \u26a0 `cfgFor` DROPS `t5two` \u2014 a KNOWN gap, not a new find. `tests/cfg-contract.mjs` grades it and
   names it ("it drops `t5two` AND `boundaryCharge`, 2 of the 10 fields the engine's memo signature
   reads"), deliberately in reporting mode until PHASE11 \u00a72 converges the six cfg constructors.
   `tools/engine-node.mjs` is in PHASE10's frozen import closure, so the fix waits for the freeze to
   lift; here we re-attach the field by hand.
   \u2605 Worth recording: cfg-contract grades this one WARN because "the source gear leaves it at its
   default, so the omission is inert TODAY". This file is the first caller to actually set it, so the
   WARN became a real wrong answer on contact \u2014 the engine read 201.668 against the reference's
   201.168, exactly a no-Tirisfal mage scored against a Tirisfal reference. That is the failure mode
   cfg-contract predicted, arriving on schedule. */
const cmp = (label, plan, kase) => {
  const cfg = { ...cfgFor(api, { name: 'x', ...kase }), t5two: !!kase.t5two };
  const eng = api.rankScore(api.repair(JSON.parse(JSON.stringify(plan)), cfg), cfg) / api.plainCastOf(cfg);
  const ref = refScore(plan, kase);
  const ok = Math.abs(ref - eng) < 1e-6;
  if (!ok) bad++;
  console.log(`  ${ok ? '\u2713' : '\u26d4'} ${label.padEnd(44)} ref ${ref.toFixed(6).padStart(11)}   engine ${eng.toFixed(6).padStart(11)}   \u0394 ${(ref - eng).toFixed(6)}`);
};

/* ═ PART 1 — WHERE THE TWO MUST AGREE EXACTLY ═════════════════════════════════════════════════════
   Single target and burn phases are pure window geometry over the master law, so an independent
   transcription of MECHANICS + ESTABLISHED-FACTS has to land on the same number to the 6th decimal.
   Any \u0394 here is a genuine disagreement between the engine and the documented algebra, and one of the
   two is wrong. ⚠ This is the half that makes the file evidence rather than a probe: without it the
   Part-2 table below is just two unvalidated implementations differing. */
{
  const gear = { sp: 1387, crit: 38, haste: 0 };
  const K = ['icyVeins', 'isc', 'scb', 'arcanePower', 'berserking', 'bloodlust'];
  cmp('empty 120 s fight', {}, { T: 120, gear, kit: [] });
  cmp('empty 300 s fight', {}, { T: 300, gear, kit: [] });
  cmp('empty 300 s, h=400', {}, { T: 300, gear: { ...gear, haste: 400 }, kit: [] });
  cmp('Icy Veins alone, interior', { icyVeins: [60] }, { T: 300, gear, kit: K });
  cmp('the whole kit on the pull', { icyVeins: [5], isc: [5], scb: [5], arcanePower: [5], berserking: [5], bloodlust: [5] },
      { T: 300, gear, kit: K });
  cmp('kit split across two bursts', { icyVeins: [5, 190], isc: [5, 190], scb: [5, 190], arcanePower: [5, 190], berserking: [190], bloodlust: [5] },
      { T: 300, gear, kit: K });
  cmp('Tirisfal 2pc on (AB \u00d71.2, additive with AP)', { arcanePower: [50] },
      { T: 300, gear, kit: K, t5two: true });
  cmp('one burn phase \u00d72', { icyVeins: [100] },
      { T: 300, gear, kit: K, phases: [{ from: 100, to: 130, type: 'burn', mult: 2, targets: 0 }] });
  cmp('burn phase, kit stacked into it', { icyVeins: [100], isc: [100], scb: [100], arcanePower: [100] },
      { T: 300, gear, kit: K, phases: [{ from: 100, to: 130, type: 'burn', mult: 2, targets: 0 }] });
}

/* ═ PART 2 — WHERE THEY MUST DIFFER, AND THE DIFFERENCE IS THE RE-RAMP ═══════════════════════════
   The reference deliberately models NO re-ramp after a phase: it integrates a 3-stack rate throughout.
   The engine charges the Arcane Blast debuff's rebuild. So the \u0394 column below is a direct readout of
   *where the engine decides the debuff expired*, isolated from everything else.
   ★ The two types are offset by exactly one cast interval, and that is CORRECT: an AoE phase spends its
   final GCD on an Arcane Explosion, so the first Arcane Blast cannot start until that GCD expires,
   while an intermission leaves nothing running and resumes at the wall. Gated in `law-check`. */
console.log('\nphase length \u2192 re-ramp toll the engine charges (reference charges none)\n');
console.log('   len    intermission        aoe        (AB debuff is ' + G.AB.DEBUFF_DUR + ' s)');
for (const L of [1, 2, 3, 4, 4.5, 5, 5.5, 6, 6.5, 7, 8, 10, 15, 30]) {
  const out = [];
  for (const type of ['intermission', 'aoe']) {
    const kase = { T: 300, gear: { sp: 1387, crit: 38, haste: 0 }, kit: [],
      phases: [{ from: 100, to: 100 + L, type, mult: 1, targets: 6 }] };
    const cfg = { ...cfgFor(api, { name: 'x', ...kase }), t5two: !!kase.t5two };
    const eng = api.rankScore(api.repair({}, cfg), cfg) / api.plainCastOf(cfg);
    out.push(refScore({}, kase) - eng);
  }
  console.log('  ' + String(L).padStart(4), out.map(v => v.toFixed(6).padStart(12)).join(' '));
}
console.log('\n  full ramp toll = 1.332 casts. A jump from 0 to 1.332 marks where the model decides');
console.log('  the Arcane Blast debuff has expired and the stacks must be rebuilt.');

console.log(bad ? `\n\u26d4 ${bad} case(s) where an INDEPENDENT transcription of the docs disagrees with the engine.`
                : '\n\u2713 the engine reproduces an independent transcription of the documented laws exactly.');
process.exit(bad ? 1 : 0);
