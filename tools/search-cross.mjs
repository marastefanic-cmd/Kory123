// SEARCH-CROSS — the optimizer must never be beaten by BORROWING A NEIGHBOUR'S ANSWER.
//
//   node tools/search-cross.mjs              # report · exit 0
//   node tools/search-cross.mjs --strict     # exit 1 on any confirmed miss
//
// ── WHY THIS, AND NOT BRUTE FORCE ────────────────────────────────────────────────────────────────
// `tools/search-audit.mjs` asks "is this plan beaten in its own NEIGHBOURHOOD" and its own output warns
// that is local optimality only — "a press 120 s from where the descent put it (§8j) is outside every
// bounded neighbourhood". Every search miss this project has actually suffered was NON-local:
//   · §8j the search could not reach the declared layouts at all
//   · §8s a train of abutting windows could not slide
//   · §9d a Cold Snap could not be RE-SITED — `[-8,172,192,372]` was a true local optimum, every
//     single-press neighbour worse, and 0.42 casts (~210× TIE_CASTS) short of the answer
// so the one gate we had was structurally blind to the entire defect class.
//
// ★ AND T11 IS THE PROOF THAT CROSS-SEEDING SEES THEM. T11 (6:30, Bloodlust pinned 0:10) declares
// essentially T10's layout (6:30, no Bloodlust). The user found it BY HAND. Transplanting T10's plan
// into T11's config and repairing it would have produced the declared answer immediately — a
// one-second check against a defect that took a day to name.
//
// ⛔ Brute force is not the alternative. §8y enumerated 1,582,581 layouts for a **2:00** fight; a 6:30
// fight with six cooldowns is larger by many orders of magnitude, so a sweep covers a vanishing
// fraction AND cannot tell you what it missed. Cross-seeding costs one solve per cell plus N² cheap
// rescores — no re-solve, just `repair` + `simulate` — and every hit is a CONSTRUCTIVE witness: it
// hands you the better layout, not just the news that one exists.
//
// ── THE GRID ────────────────────────────────────────────────────────────────────────────────────
// Cells differ by ONE parameter at a time (fight length, or where the raid calls Bloodlust), because
// that is what makes a transplant meaningful: neighbouring fights should have neighbouring answers, and
// a plan that is good at T=380 is a serious candidate at T=390. A donor plan is repaired into the host's
// config, so anything cooldown-illegal there is legalized before it is scored — a transplant can only
// win by being genuinely better under the host's own rules.
import { loadEngine, cfgFor } from './engine-node.mjs';

const HTML = (process.argv.find(a => a.startsWith('--html=')) || '').split('=')[1]
          || new URL('../index.html', import.meta.url).pathname;
const STRICT = process.argv.includes('--strict');
const api = loadEngine(HTML);
const G = api.GAME;

const GEAR = { haste: 0, sp: 1611.8875, crit: 50.76538949275363, coldSnap: true };
const KIT = ['icyVeins', 'isc', 'scb', 'arcanePower', 'berserking', 'bloodlust'];
const TIE = 0.002;

// One parameter moves per row. Lengths bracket the 120 s / 180 s realignment beat; the Lust column is
// what exposed §9d, since a pinned call changes which chain origins exist.
const CELLS = [];
for (const T of [330, 360, 380, 390, 420, 450]) {
  CELLS.push({ T, lust: null });
  for (const lust of [5, 10, 60]) CELLS.push({ T, lust });
}

const cfgOf = c => ({
  ...cfgFor(api, { name: 'x', T: c.T, pins: c.lust === null ? {} : { bloodlust: [c.lust] },
                   gear: GEAR, kit: c.lust === null ? KIT.filter(k => k !== 'bloodlust') : KIT }),
  t5two: true,
});
const one = cfg => (G.AB.AVG_BASE_DMG + G.AB.COEF * cfg.sp) *
  (1 + Math.min(1, cfg.critPct / 100) * (G.CRIT_MULT - 1)) * (cfg.t5two ? 1.2 : 1);
const score = (s, cfg) => api.simulate(api.repair(JSON.parse(JSON.stringify(s)), cfg), cfg, true).robust / one(cfg);
const label = c => `T=${c.T}${c.lust === null ? ' no-lust' : ' lust@' + c.lust}`;

console.log('# SEARCH-CROSS — can any cell be beaten by a neighbour\'s plan?\n');
console.log(`  grid: ${CELLS.length} cells · solving…`);
const solved = [];
for (const c of CELLS) {
  const cfg = cfgOf(c);
  const best = (await api.optimizeAsync(cfg, 14, () => {})).s;
  solved.push({ c, cfg, s: best, own: score(best, cfg) });
  process.stdout.write('.');
}
console.log('\n');

/* A transplant must clear the host's own score by more than the tie band. Below the band the two are
   indistinguishable to the objective and the tie-break is entitled to prefer either (§9c), so flagging
   there would produce noise, not defects. */
const misses = [];
for (const host of solved) {
  let bestDonor = null;
  for (const donor of solved) {
    if (donor === host) continue;
    const v = score(donor.s, host.cfg);
    if (v > host.own + TIE && (!bestDonor || v > bestDonor.v)) bestDonor = { donor, v };
  }
  if (bestDonor) misses.push({ host, ...bestDonor });
}

misses.sort((a, b) => (b.v - b.host.own) - (a.v - a.host.own));
for (const m of misses) {
  console.log(`  ⛔ ${label(m.host.c).padEnd(20)} own ${m.host.own.toFixed(4)}  <  ${m.v.toFixed(4)} ` +
              `from ${label(m.donor.c)}   +${(m.v - m.host.own).toFixed(4)} casts (${Math.round((m.v - m.host.own) / TIE)}× band)`);
  const rep = api.repair(JSON.parse(JSON.stringify(m.donor.s)), m.host.cfg);
  for (const k of Object.keys(rep).sort()) if (JSON.stringify(rep[k]) !== JSON.stringify(m.host.s[k]))
    console.log(`        ${k.padEnd(12)} own [${m.host.s[k]}]   better [${rep[k]}]`);
}

console.log(`\nSEARCH-CROSS cells=${solved.length} misses=${misses.length}`);
if (!misses.length) console.log('✓ no cell is beaten by any neighbour\'s plan — the search is stable across the grid.');
else console.log('⇒ each line above is a CONSTRUCTIVE witness: the "better" layout is a legal plan the\n' +
                 '  optimizer did not find. Lock the confirmed ones as declared tests, then fix the SEARCH.');
process.exit(STRICT && misses.length ? 1 : 0);
