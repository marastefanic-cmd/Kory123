// STAT VOLATILITY — how much each buff combination's value MOVES when you add haste / crit / SP.
//
//   node tools/facts-volatility.mjs            # the tables `docs/ESTABLISHED-FACTS.md` §6 quotes
//   node tools/facts-volatility.mjs --md       # same, as markdown ready to paste
//
// ── WHY THIS EXISTS ──────────────────────────────────────────────────────────────────────────────
// `ESTABLISHED-FACTS` records what each buff is worth AT A POINT — h = 0, 1000 or 1387 SP. Every
// declared test is at h = 0 too (`tests/anchors.mjs`). That is fine as ground truth and useless as
// preparation: the next question is passive gear haste, and for that you need the DERIVATIVES — how
// fast each combination's value decays as the GCD cap closes in, and which pairs invert.
//
// ⚠ Everything here is derived from the master law and the engine's own constants. Nothing is
// measured off a plan, so nothing here can drift with the search.
//
//     rate(m) = 1 / max( msq(GCD_BASE/m ∨ GCD_FLOOR), msq((BASE_CAST − 3·STACK_RED)/m) )
//
// ⛔ The millisecond quantisation is not cosmetic — dropping it is a 3.6 % error on a haste × haste
// pair (`law-check --self-test`). It is why several columns below step rather than curve smoothly.
import { loadEngine } from './engine-node.mjs';

const api = loadEngine(new URL('../index.html', import.meta.url).pathname);
const G = api.GAME, B = api.BUFFS;
const MD = process.argv.includes('--md');

const msq = x => Math.round(x * 1000) / 1000;
const rate = m => 1 / Math.max(msq(Math.max(G.GCD_FLOOR, G.GCD_BASE / m)),
                               msq((G.AB.BASE_CAST - G.AB.STACK_CAST_REDUCTION * G.AB.MAX_STACKS) / m));
const RPP = G.HASTE_RATING_PER_PCT * 100;            // rating for +100 % haste
const mOf = rating => 1 + rating / RPP;
const row = a => MD ? '| ' + a.join(' | ') + ' |' : '  ' + a.join('  ');
const hdr = a => { console.log(row(a)); if (MD) console.log('|' + a.map(() => '---').join('|') + '|'); };

console.log(MD ? '' : '# STAT VOLATILITY — derivatives, not point values\n');

// ── 1. what a haste BUFF is worth as passive gear haste rises ────────────────────────────────────
console.log(MD ? '\n**A haste buff decays as gear haste rises, and dies at the cap.** Value of the buff\'s own\nwindow, in casts per second of uptime:\n' : '\n1. A HASTE BUFF DECAYS AS GEAR HASTE RISES (casts per second of its own uptime)\n');
const HB = [['Icy Veins ×1.20', 1.20], ['Berserking ×1.10', 1.10], ['Bloodlust ×1.30', 1.30],
            ['Skull +175', null], ['MQG +330', null]];
hdr(['gear haste', 'm', ...HB.map(h => h[0])]);
for (const r of [0, 100, 200, 300, 400, 500, 600, 789]) {
  const m = mOf(r);
  const vals = HB.map(([n, mult]) => {
    const m2 = mult ? m * mult : m * (1 + (n.includes('175') ? 175 : 330) / RPP);
    return (rate(m2) - rate(m)).toFixed(5);
  });
  console.log(row([String(r).padStart(4), m.toFixed(3), ...vals]));
}
console.log(MD ? '\n★ The **788.5** figure in §1.1 is where `rate` reaches the floor unbuffed; past it a haste buff is\nworth exactly **0**, not "less". Every column goes to zero together, because they all cap at the same\n`m = 1.5` — the cap is a property of the GCD, not of the buff.\n★★ **AND THEY CONVERGE LONG BEFORE THEY DIE.** At 600 gear haste every column reads **0.08004** —\nBerserking ×1.10 and MQG +330 are worth the SAME. Once a buff carries you past the floor, its value\nis no longer its own size but the remaining distance to the cap, which every buff shares. ⇒ at high\ngear haste, *which* haste cooldown you press stops mattering; only *when* does.\n★★★ Bloodlust PEAKS at ~200 gear haste (0.22525) and falls after — the biggest multiplier is the\nfirst to overshoot.\n' : '\n  ★ all columns hit 0 together at m = 1.5 (gear ≈ 789) — the cap is shared, not per-buff.\n  ★★ they CONVERGE at ~600 (all 0.08004): past the floor, value = distance to the cap, not buff size.\n  ★★★ Bloodlust peaks at ~200 gear haste — the biggest multiplier overshoots first.\n');

// ── 2. the pair cross-terms and where they invert ────────────────────────────────────────────────
console.log(MD ? '\n**Pair cross terms: stack or split?** Gain from overlapping the two windows rather than holding\nthem apart, per second of overlap. Negative means SPLIT.\n' : '\n2. PAIR CROSS TERMS — gain per second of overlap (negative = split them)\n');
const PAIRS = [['IV ×1.20 · Zerk ×1.10', 1.20, 1.10, 0], ['IV ×1.20 · Skull +175', 1.20, null, 175],
               ['IV ×1.20 · MQG +330', 1.20, null, 330], ['Skull +175 · MQG +330', null, null, -1],
               ['Lust ×1.30 · Zerk ×1.10', 1.30, 1.10, 0]];
hdr(['gear haste', ...PAIRS.map(p => p[0])]);
const cross = (m, a, b, rat) => {
  const A = a ? m * a : m * (1 + 175 / RPP);
  const Bv = rat > 0 ? m * (1 + rat / RPP) : (b ? m * b : m * (1 + 330 / RPP));
  const both = rat === -1 ? m * (1 + (175 + 330) / RPP)          // two RATINGS share one bracket
             : a && b ? m * a * b
             : a ? m * a * (1 + rat / RPP) : m * (1 + (175 + 330) / RPP);
  return (rate(both) + rate(m)) - (rate(A) + rate(Bv));
};
for (const r of [0, 100, 200, 300, 400, 500]) {
  const m = mOf(r);
  console.log(row([String(r).padStart(4), ...PAIRS.map(([, a, b, rat]) => {
    const v = cross(m, a, b, rat);
    return (v >= 0 ? '+' : '') + v.toFixed(5);
  })]));
}
console.log(MD ? '\n★ **`rating × rating` is zero BELOW the cap** — two ratings land in ONE bracket `(1 + h₁ + h₂)`, so\nthe cross term `(A−1)(B−1)` that makes stacking pay does not exist (RULES §7a). The ±0.0004 wobble in\nthose rows is millisecond quantisation, not signal. ⚠ It is **not** zero above the cap: from ~300 gear\nhaste it joins the others at strongly negative, because stacking two buffs that each already reach the\nfloor wastes one of them outright.\n★★ **Every pair inverts, and they invert at DIFFERENT gear levels** — MQG-paired ones flip first\n(between 0 and 100 rating), the ×1.20/×1.10 pairs hold out to ~200. The bigger the two buffs, the\nsooner stacking them stops paying.\n' : '\n  ★ rating × rating is 0 BELOW the cap (one bracket, no cross term); NEGATIVE above it.\n  ★★ every pair inverts, at different gear levels — the bigger the pair, the sooner.\n');

// ── 3. spellpower dilution ───────────────────────────────────────────────────────────────────────
console.log(MD ? '\n**A +SP buff is diluted by your own passive spell power.** Value fraction\n`s = COEF·ΔSP / (BASE + COEF·SP)` — what one cast under the buff is worth above a plain cast:\n' : '\n3. SP DILUTION — s = COEF·ΔSP / (BASE + COEF·SP)\n');
hdr(['passive SP', 'Icon +155', 'gem +225', 'both', 'AP ×1.30 (for scale)']);
for (const sp of [800, 1000, 1200, 1387, 1600, 1800, 2000]) {
  const s = d => G.AB.COEF * d / (G.AB.AVG_BASE_DMG + G.AB.COEF * sp);
  console.log(row([String(sp).padStart(4), s(155).toFixed(5), s(225).toFixed(5), (s(155) + s(225)).toFixed(5), '0.30000']));
}
console.log(MD ? '\n★ Icon loses **~40 %** of its value between 800 and 2000 passive SP while Arcane Power loses\nnothing — a damage MULTIPLIER cannot be diluted. That is the whole reason AP outranks the trinkets\nas gear improves, and it is a fact about your gear, not about the fight.\n' : '\n  ★ a +SP buff dilutes with gear; a ×damage buff never does.\n');

// ── 4. crit ──────────────────────────────────────────────────────────────────────────────────────
console.log(MD ? '\n**Crit cancels — EXCEPT in an AoE phase.** Single target it multiplies every Arcane Blast\nequally and divides out of the normalisation. An Arcane Explosion carries the extra\nClearcasting → Arcane Potency amplification, which is crit-dependent:\n' : '\n4. CRIT — cancels single target, NOT in AoE\n');
hdr(['crit %', 'amp N=1', 'amp N=4', 'amp N=6', 'amp N=10', 'AE/AB at N=6']);
const K = (G.AE.AVG_BASE_DMG + G.AE.COEF * 1387) / (G.AB.AVG_BASE_DMG + G.AB.COEF * 1387);
for (const c of [0, 20, 38, 50, 60]) {
  console.log(row([String(c).padStart(3), ...[1, 4, 6, 10].map(N => api.aoeCritAmp(N, c / 100).toFixed(5)),
                   (K * 6 * api.aoeCritAmp(6, c / 100)).toFixed(4)]));
}
console.log(MD ? '\n★ More crit makes an AoE phase **relatively less** valuable (2.6290 → 2.5600 across 0–60 % at\nN = 6, a 2.6 % swing), because Arcane Potency has less headroom to add when base crit is already\nhigh. ⚠ The score therefore depends on crit whenever an AoE phase exists — but on the cases tested\nthe emitted PLAN did not change, so "crit cancels" is safe as a plan-invariance claim and wrong as a\nscore-invariance one.\n' : '\n  ★ more crit ⇒ AoE relatively LESS valuable; score depends on crit, plan (tested) does not.\n');
