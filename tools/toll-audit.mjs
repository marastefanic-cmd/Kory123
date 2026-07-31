// TOLL AUDIT — the opener/re-ramp toll against its closed form, at every haste.
//
//   node tools/toll-audit.mjs              # report · exit 0
//   node tools/toll-audit.mjs --strict      # exit 1 while any row is wrong (turn on once §9a lands)
//
// ── WHY ──────────────────────────────────────────────────────────────────────────────────────────
// MODEL-DEFECTS §9a: three independently-briefed audits converged on the twelve lines at
// `index.html:1721-1733` + `:1788`. This file pins the two of those four defects that have a closed
// form needing no phase setup, so the fix is measurable the moment someone attempts it.
//
// ★ THE LAW (ESTABLISHED-FACTS §1.2), and why it does NOT contradict §8q:
//
//       toll(m) = [ Σ_k max(C_k/m, i(m)) − 3·i(m) ] / i(m),      i(m) = max(FLOOR, G/m)
//
// Below the GCD floor `max(C_k/m, i) = C_k/m` and `i = G/m`, so the `1/m` cancels top and bottom and
// the form is IDENTICALLY 1.332 at every m ≤ 1.5. §8q's haste-invariance IS that sub-floor regime —
// which is where §8q was measured. The general form preserves it and adds only the above-floor decay,
// so it SUBSUMES §8q rather than overturning it. ⛔ Do not read a failing row here as licence to
// recompute the toll at hasted cast times generally: that is the thing §8q rejected, and it sends Icy
// Veins back to the pull. The fix is the floor, not the haste.
//
// ⚠ REACHABLE AT ZERO GEAR HASTE — Bloodlust ×1.30 × Icy Veins ×1.20 = 1.56 > 1.5.
//
// The engine's implied toll is read as `T/i(m) − effectiveCasts` on a fight that is UNIFORM in `m` and
// a kit that is HASTE-ONLY — so effective casts are exactly the cast count and no damage-model choice
// is left to get wrong. Both of those conditions are load-bearing; see the note above the sweep.
import { loadEngine, ALL_BUFFS } from './engine-node.mjs';

const HTML = (process.argv.find(a => a.startsWith('--html=')) || '').split('=')[1]
          || new URL('../index.html', import.meta.url).pathname;
const STRICT = process.argv.includes('--strict');
const api = loadEngine(HTML);
const G = api.GAME;
const msq = x => Math.round(x * 1000) / 1000;

const cfgOf = (T, kit, fixed, haste) => ({
  T, hasteRating: haste || 0, sp: 1000, critPct: 25,
  enabled: Object.fromEntries(ALL_BUFFS.map(k => [k, kit.includes(k)])),
  fixed: fixed || {}, warnings: [], coldSnap: true, segments: null,
});

// the law
const tollLaw = m => {
  const i = msq(Math.max(G.GCD_FLOOR, G.GCD_BASE / m));
  let s = 0;
  for (let k = 0; k < G.AB.MAX_STACKS; k++) s += Math.max(msq((G.AB.BASE_CAST - G.AB.STACK_CAST_REDUCTION * k) / m), i);
  return (s - G.AB.MAX_STACKS * i) / i;
};

let bad = 0;
console.log('# TOLL AUDIT — MODEL-DEFECTS §9a F1: is the opener toll the closed form, or a flat 1.332?\n');
console.log('   haste      m      i(m)     law      engine ∫    error      reachable as');
const ROWS = [
  [0, [], 'bare pull'],
  [400, [], 'geared'],
  [788.5, [], 'the GCD cap on passive haste alone'],
  [900, [], 'high-haste gear'],
  [1200, [], 'high-haste gear'],
  [1600, [], 'high-haste gear'],
  [0, ['bloodlust'], 'Bloodlust alone (m 1.30)'],
  [0, ['bloodlust', 'icyVeins'], '\u2605 Bloodlust \u00d7 Icy Veins \u2014 an ORDINARY PULL'],
];
/* \u26a0 T = 15 s so every buff in a row covers the WHOLE fight \u2014 a fight that is not uniform in `m`
   has no single closed-form toll, and a first draft of this file read 5.17 casts on the Bloodlust row
   purely because Icy Veins expired at 20 s inside a 60 s window. Kits are HASTE-ONLY, so effective
   casts \u2261 cast count and no damage-model choice enters. `m` is composed from the buff table, never
   reverse-engineered from the realised interval (which saturates at the floor and cannot be inverted). */
const I = (s, c) => api.simulate(api.repair(JSON.parse(JSON.stringify(s)), c), c, true).integral / api.plainCastOf(c);
for (const [h, kit, why] of ROWS) {
  const T = 15;
  let m = 1 + h / (G.HASTE_RATING_PER_PCT * 100);
  for (const k of kit) m *= api.BUFFS[k].value;
  const i = msq(Math.max(G.GCD_FLOOR, G.GCD_BASE / m));
  const presses = Object.fromEntries(kit.map(k => [k, [0]]));
  const c = cfgOf(T, kit, presses, h);
  const eng = T / i - I(presses, c);
  const law = tollLaw(m), err = eng - law, ok = Math.abs(err) <= 5e-3;
  if (!ok) bad++;
  console.log(`  ${String(h).padStart(6)}  ${m.toFixed(3)}   ${i.toFixed(3)}   ${law.toFixed(4)}    ${eng.toFixed(4)}   ${(err >= 0 ? '+' : '') + err.toFixed(4)}   ${ok ? '\u2713' : '\u26d4'} ${why}`);
}

/* F4 — the per-cast cost is indexed by POSITION IN THE GROUP, not by stack count. A ramp that resumes
   mid-cast-lapse starts at 1 stack (the walk emits [3,1,2]) but is billed the 0-stack ladder. */
console.log('\n# F4: a mid-cast-lapse re-ramp resumes at 1 STACK — is it billed as one?\n');
{
  const ladder = k => (Math.max(msq(G.AB.BASE_CAST - G.AB.STACK_CAST_REDUCTION * k), G.GCD_BASE) - G.GCD_BASE) / G.GCD_BASE;
  const seq = L => {
    const c = { ...cfgOf(200, [], null, 0), segments: api.buildSegments([{ from: 99, to: 99 + L, type: 'intermission', mult: 1, targets: 0 }], 200) };
    const r = api.simulate(api.repair({}, c), c, true);
    return { score: r.integral / api.plainCastOf(c), stacks: r.casts.filter(x => x.t >= 99 + L - 1e-9).slice(0, 3).map(x => x.stacks) };
  };
  const base = seq(5).score;                       // 6.002 s gap — debuff survives, no toll
  for (const L of [6, 6.5, 7, 8]) {
    const { score, stacks } = seq(L);
    /* \u26a0 SUBTRACT THE DEAD TIME. A longer intermission removes more casting quite apart from the
       toll, and a first draft of this file booked that as over-charge \u2014 it read L=7 as wrong when
       L=7 is the one case that is RIGHT. */
    const charged = (base - score) - (L - 5) / msq(G.GCD_BASE);
    // resuming at 1 stack costs the 1- and 2-stack rungs; a cold start costs all three
    const law = stacks[0] === 3 ? ladder(1) + ladder(2) : ladder(0) + ladder(1) + ladder(2);
    const ok = Math.abs(charged - law) <= 1e-6;
    if (!ok) bad++;
    console.log(`  intermission L=${L}  exit stacks [${stacks}]  charged ${charged.toFixed(6)}   law ${law.toFixed(6)}   ` +
                `${(charged - law >= 0 ? '+' : '') + (charged - law).toFixed(6)}  ${ok ? '✓' : '⛔ over-charge'}`);
  }
  console.log(`\n  ESTABLISHED-FACTS §1.2d states the band's cost as ${(ladder(1) + ladder(2)).toFixed(4)} casts ` +
              `(the 1- and 2-stack rungs).\n  The 07-28 lapsedMidCast fix landed in the WALK and was never propagated to the TOLL.`);
}

console.log(bad
  ? `\n⛔ ${bad} row(s) disagree with the closed form — MODEL-DEFECTS §9a. F2 (AoE-priced toll) and F3\n` +
    '   (toll deleted by intermissions) need phase setups and are recorded there rather than here.'
  : '\n✓ the toll reproduces its closed form at every haste and at every ramp entry stack.');
if (!STRICT) console.log('\n(Reporting mode. --strict exits 1; turn it on in CI once §9a lands.)');
process.exit(STRICT && bad ? 1 : 0);
