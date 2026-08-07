// GRID INVARIANCE — the score must not depend on the SLICE GRID it was integrated on.
//
//   node tools/grid-invariance.mjs                 # the invariant, over the ATI-on and ATI-off paths
//   node tools/grid-invariance.mjs --self-test     # a boundary that DOES change things; must be SEEN
//   node tools/grid-invariance.mjs --html=other.html
//
// Exit: 0 = invariant holds · 1 = the grid moved the score · 2 = could not run.
//
// ── WHY THIS EXISTS (added 08-05 with MODEL-DEFECTS §10c) ────────────────────────────────────────
// `simulate()`'s integral is a sum over piecewise-constant slices whose breakpoints come from window
// edges, phase boundaries, ramp casts and the kill window. Adding a breakpoint that changes NO buff
// state must therefore change NO score: the slices either side integrate the same integrand over the
// same interval. That is not decoration — "one setup ⇒ one schedule" is the project's determinism
// convention, and a scorer that answers differently depending on where the slices happen to fall
// makes `plan-diff`, the anchors and every tie-break comparison mean less than they claim.
//
// ⛔ IT WAS FALSE UNTIL 08-05, ON THE ASHTONGUE PATH, AND NOTHING LOOKED. The ν advance ran
// `ν += made; ν −= tollR·len` — operator splitting, with the opener toll landing at each slice's END
// — so subdividing a toll slice changed the answer by up to **5.5e-3 casts**, two and a half times
// the tie band. §10c decoupled ν from the toll (ν is a physical attempt counter; the toll is a
// scoring device), which removed the splitting along with the bias it was part of. No gate in the
// repo varies the grid, so nothing was ever going to catch it. This is that gate.
//
// THE PROBE: a `burn` phase at `mult: 1`. `buildSegments` emits its edges as real segment boundaries,
// which land in `bpS`, but a burn at multiplier 1 changes no damage, no haste, no target count and no
// cut (RULES §9: a burn edge is NOT a cut). So it is a pure grid perturbation.
//
// ⚠ NEGATIVE CONTROL, and it is the load-bearing half: a gate that reads "no change" is exactly what
// a probe that cannot see anything reads too. `--self-test` runs the same comparison with `mult: 1.1`
// — a boundary that genuinely changes the fight — and requires it to be SEEN.
import { loadEngine, cfgFor } from './engine-node.mjs';

const SELFTEST = process.argv.includes('--self-test');
const HTML = (process.argv.find(a => a.startsWith('--html=')) || '').split('=')[1]
          || new URL('../index.html', import.meta.url).pathname;
const api = loadEngine(HTML);
if (!api.plainCastOf) { console.error('GRID-INVARIANCE ERROR: engine exports no plainCastOf.'); process.exit(2); }

// float noise only: the slice sum re-associates, so bit-identity is not the claim. 1e-9 casts is
// ~5e-7 of the tie band and ~4 orders below the defect this gate exists to catch.
const TOL = 1e-9;
const MULT = SELFTEST ? 1.1 : 1;

/* The cuts straddle the opener (ramp casts end 2.500 / 4.617 / 6.377 at h=0, the toll window at
   6.498) because that is where the ν advance and the toll window overlap — the region the §10c
   splitting lived in — plus two in the fight's interior as a control on the ordinary path. */
const CUTS = [1, 1.7, 3.3, 5, 6.2, 6.45, 30, 71.25];

const SETUPS = [
  { tag: 'ATI only              ', kit: ['ati'], T: 120, gear: { sp: 1000, crit: 50.765, haste: 0 } },
  { tag: 'ATI, low crit         ', kit: ['ati'], T: 180, gear: { sp: 1000, crit: 25, haste: 0 } },
  { tag: 'ATI + Lust pinned 0:20', kit: ['ati', 'bloodlust'], T: 120, gear: { sp: 1387, crit: 44, haste: 0, t5two: true },
    pins: { bloodlust: [20] } },
  { tag: 'ATI + the full cluster', kit: ['ati', 'scb', 'icyVeins', 'arcanePower', 'berserking', 'bloodlust'],
    T: 120, gear: { sp: 1387, crit: 44, haste: 0, t5two: true },
    pins: { bloodlust: [20], icyVeins: [65, 90], scb: [45], arcanePower: [45], berserking: [45] } },
  // the ATI-OFF path, as a control: it has no ν, so it was never exposed — and must stay that way
  { tag: 'no ATI (control)      ', kit: ['isc', 'icyVeins', 'arcanePower', 'berserking', 'bloodlust'],
    T: 120, gear: { sp: 1387, crit: 44, haste: 0 }, pins: { bloodlust: [20], icyVeins: [5], isc: [20], arcanePower: [20], berserking: [20] } },
  { tag: 'ATI across an interm  ', kit: ['ati'], T: 160, gear: { sp: 1000, crit: 44, haste: 0 },
    interm: [90, 130] },
];

const score = (s, extra) => {
  const c = cfgFor(api, { T: s.T, kit: [...s.kit], gear: s.gear, pins: s.pins || {},
    phases: [...(s.interm ? [{ from: s.interm[0], to: s.interm[1], type: 'intermission' }] : []),
             ...(extra ? [extra] : [])] });
  return api.simulate(s.pins || {}, c, true).integral / api.plainCastOf(c);
};

console.log(`# GRID-INVARIANCE — a no-op breakpoint must not move the score${SELFTEST ? '  (SELF-TEST: mult 1.1, must be SEEN)' : ''}\n`);
let bad = 0, seen = 0, worst = 0, worstTag = '';
for (const s of SETUPS) {
  const ref = score(s, null);
  let mx = 0;
  for (const cut of CUTS) {
    if (cut + 0.4 >= s.T) continue;
    if (s.interm && cut + 0.4 > s.interm[0] && cut < s.interm[1]) continue;   // don't perturb inside a gap
    const d = Math.abs(score(s, { from: cut, to: cut + 0.4, type: 'burn', mult: MULT }) - ref);
    if (d > mx) mx = d;
  }
  const ok = SELFTEST ? mx > TOL : mx <= TOL;
  if (SELFTEST) { if (mx > TOL) seen++; } else if (!ok) bad++;
  if (mx > worst) { worst = mx; worstTag = s.tag.trim(); }
  console.log(`  ${ok ? '✓' : '⛔'} ${s.tag}  T=${String(s.T).padEnd(4)} max |Δ| ${mx.toExponential(2)} casts`);
}

if (SELFTEST) {
  console.log(`\n${seen === SETUPS.length
    ? `SELF-TEST PASS — a REAL boundary was seen on all ${seen} setups, so the zero above is a measurement.`
    : `SELF-TEST FAIL — only ${seen}/${SETUPS.length} setups noticed a mult-1.1 phase. The probe is blind; its zero asserts nothing.`}`);
  process.exit(seen === SETUPS.length ? 0 : 1);
}
console.log(`\nworst ${worst.toExponential(2)} casts (${worstTag}), tolerance ${TOL.toExponential(0)}`);
console.log(bad
  ? `⛔ ${bad} setup(s) move when the slice grid changes — the score depends on where the breakpoints fell.`
  : '✓ the score is independent of the slice grid (MODEL-DEFECTS §10c).');
process.exit(bad ? 1 : 0);
