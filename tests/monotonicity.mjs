// Haste-monotonicity invariant (user-stated, mathematically exact).
//
// With infinite mana, adding spell haste can only RAISE (or, at the GCD floor, hold) the number of
// effective Arcane Blasts cast — you can always replay the identical layout at the higher haste and every
// cast is at least as fast. So over a haste sweep of the SAME fight, the optimizer's effective-cast count
// must be non-decreasing. Two checks, both of which must hold:
//   (a) monotonic:      eff(h) >= eff(h_prev)               — more haste is never worse
//   (b) no missed win:  eff(h) >= eff(prevPlan re-scored @h) — the search didn't miss a plan we already had
// A failure of (b) is a pure SEARCH MISS (the tool found a worse local optimum than one it could trivially
// reach). A failure of (a) is the same thing surfacing as a raw regression. This is a search-quality guard,
// separate from exact-match (which pins exact schedules). See docs/ROADMAP.md.
//
//   node monotonicity.mjs                 # sweep the reference setups, report violations
//   node monotonicity.mjs --step 1        # finer haste step (default 5), catches 70->71-type misses
import { chromium } from 'playwright-core';
import path from 'path';
import { fileURLToPath } from 'url';

const __dir = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(__dir, '..');
const stepArg = process.argv.indexOf('--step');
const STEP = stepArg >= 0 ? +process.argv[stepArg + 1] : 5;
const HMAX = 150;
// Tolerance = the planner's DESIGNED pressability slack, not float noise. The underlying objective is
// monotone in haste (a theorem), and the search is basin-stable (basinHop fixpoint) — but the returned
// plan deliberately trades up to ~castVal/8 of expected damage for a pressable line (coPressAlign,
// "execution beats microtiming"), and that trade's size varies with haste. So the RETURNED plans may
// wobble by up to ~1/8 cast across a haste step without any search miss being present. Anything beyond
// this slack is a real miss.
const EPS = 0.15; // effective casts — coPressAlign's castVal/8 + integer-snap rounding headroom

// Reference fights to sweep (name → {T, pins, kit?}). Plain fights only — the ramp near an intermission
// exit is a documented scorer blind spot (RULES §10), so monotonicity there is checked by the sim, not here.
const CASES = [
  { name: '1:40 lust 0:07', T: 100, pins: { bloodlust: [7] } },
  { name: '4:00 lust 0:05', T: 240, pins: { bloodlust: [5] } },
];

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM || '/opt/pw-browsers/chromium' });
const page = await browser.newPage();
let perr = null;
page.on('pageerror', e => (perr = String(e)));
await page.goto('file://' + path.join(REPO, 'index.html'));
if (perr) { console.error('PAGEERROR loading index.html:', perr); await browser.close(); process.exit(2); }

let violations = 0;
for (const c of CASES) {
  const rows = await page.evaluate(async ({ c, STEP, HMAX }) => {
    const kit = c.kit || ['icyVeins', 'isc', 'scb', 'arcanePower', 'berserking', 'bloodlust'];
    const enabled = {}; for (const k in BUFFS) enabled[k] = kit.includes(k);
    // Deliberately NOT `tools/reference-gear.mjs`'s REF: that module describes THE GEAR THE SIM RUNS,
    // and exists so a model-vs-sim harness cannot describe a different mage than the one being simmed.
    // This file sims nothing.  It asserts a PROPERTY — more haste never scores less — that must hold at
    // ANY gear, so its gear is an arbitrary fixture and pinning it here is the point, not drift.
    const mkcfg = h => ({ T: c.T, hasteRating: h, sp: 1387, critPct: 38, enabled, fixed: c.pins || {}, warnings: [], coldSnap: true, segments: null });
    // ★ `(g.t5two ? 1.2 : 1)` — this was the ONE copy of the plain-cast normaliser missing that
    // factor (index.html:2185 and :4104, tools/reference-gear.mjs:42, tools/explore.mjs:127 and
    // tools/sp-sensitivity.mjs:160 all carry it). Added 07-27. It is NUMERICALLY INERT TODAY, and
    // that is exactly why it was invisible: this fixture never sets `t5two`, so the factor is 1 and
    // `eff` is unchanged to the last bit. The bug was latent — the moment anyone gave this fixture
    // T5 2pc, the cfg would get its ×1.2 and the normaliser would not, inflating every `eff` by 1.2
    // while EPS stayed at 0.15 effective casts. That silently narrows the miss band to 0.125 true
    // casts, the same shape as the drift `reference-gear.mjs` was written to end. Keep them matched.
    const plain = h => { const g = mkcfg(h); return (GAME.AB.AVG_BASE_DMG + GAME.AB.COEF * g.sp) * (1 + (g.critPct / 100) * (GAME.CRIT_MULT - 1)) * (g.t5two ? 1.2 : 1); };
    const out = []; let prevS = null;
    for (let h = 0; h <= HMAX; h += STEP) {
      const b = await optimizeAsync(mkcfg(h), 14, () => {});
      const eff = simulate(b.s, mkcfg(h), true).total / plain(h);
      const prevEff = prevS ? simulate(prevS, mkcfg(h), true).total / plain(h) : null;
      out.push({ h, eff, prevEff });
      prevS = b.s;
    }
    return out;
  }, { c, STEP, HMAX });
  if (perr) { console.error('PAGEERROR on', c.name, ':', perr); await browser.close(); process.exit(2); }

  console.log(`\n### ${c.name}`);
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i], p = i > 0 ? rows[i - 1] : null;
    const mono = p && r.eff < p.eff - EPS;
    const miss = r.prevEff != null && r.eff < r.prevEff - EPS;
    if (mono || miss) {
      violations++;
      console.log(`  ⚠ h=${r.h}: eff=${r.eff.toFixed(3)}` +
        (mono ? ` < prev-haste ${p.eff.toFixed(3)} (NON-MONOTONIC)` : '') +
        (miss ? ` < prev-plan@${r.h} ${r.prevEff.toFixed(3)} (SEARCH MISS, −${(r.prevEff - r.eff).toFixed(3)} casts)` : ''));
    }
  }
}
await browser.close();
console.log(`\n${violations} monotonicity violation(s) across ${CASES.length} fights, haste 0–${HMAX} step ${STEP}`);
process.exit(violations ? 1 : 0);
