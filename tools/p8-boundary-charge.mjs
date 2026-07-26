// PHASE8 §22 — price the per-window CONTINUOUS-vs-DISCRETE boundary charge on the B2 pair, and
// re-run §13.8's sign test with the ANCHORED lattice instead of the flat frac(D/Δ). No sims.
//
// WHY THIS INSTRUMENT EXISTS. §13.8 computed the quantization charge from the closed form
// `frac(D/Δ) × premium` and concluded the whole family is ANTI-B2 (h40 +0.064 %, h70 −0.001 %, so
// the correction widens B2 from 0.38 to 0.445 pp). §21.5 then showed that closed form is the WRONG
// SHAPE: the same press priced against its own anchored lattice moves 0.11 pp depending on whether
// the partner window is flush (IV@202) or offset 2 s (IV@200). So §13.8's sign verdict was reached
// with a ruler §21.5 invalidated, and the sign has to be re-read before the charge is implemented.
//
// THE KEY IDENTITY THIS EXPLOITS: simulate()'s `casts` board is ALREADY the anchored lattice — the
// same board loop that sets press-snap boundaries. So for one window w,
//     dModel(w) = robust(with w) − robust(without w)      ← the continuous rate integral's credit
//     dQuant(w) = boardDmg(with w) − boardDmg(without w)  ← the discrete anchored board's credit
//     charge(w) = dModel(w) − dQuant(w)
// needs no closed form and no reconstruction of scoreStart: the anchoring is inherited from the
// board. This is exactly the quantity §21.5 measured for MQG@202 (+0.1505 A / +0.2610 B), so that
// pair is the instrument's REPRODUCTION TEST — it must come back before any new number is believed.
//
// ⚠ Charges are measured by single-window toggling and are NOT additive: §21.5's F3 left 0.0724 pp
// unexplained on a two-term decomposition. Sums below are reported as such, never as a proof.
import path from 'path';
import { fileURLToPath } from 'url';
import { loadEngine } from './engine-node.mjs';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const api = loadEngine(path.join(REPO, 'index.html'));
const { simulate, BUFFS } = api;

const kit = ['icyVeins', 'isc', 'mqg', 'arcanePower', 'berserking', 'bloodlust'];
const en = {}; for (const k in BUFFS) en[k] = kit.includes(k);
// R=70 is the B2 target gear: BOTH plans are scored here (§13.8's convention).
const cfg = {
  T: 229, hasteRating: 70, sp: 1450, critPct: 38, enabled: en,
  fixed: { bloodlust: [162] }, warnings: [], coldSnap: true, segments: null, t5two: true,
};

// The B2 pair (PHASE8 §2/§13.8). h40 front-loads haste (Zerk@0+IV@0+MQG@9+IV@20, Icon@29);
// h70 front-loads damage (AP@4 with Icon@4) and saves MQG@202 onto IV@202.
const PLANS = {
  h40: { bloodlust: [162], arcanePower: [8, 188], berserking: [0, 188], icyVeins: [0, 20, 200], isc: [29, 183], mqg: [9] },
  h70: { bloodlust: [162], arcanePower: [4, 192], berserking: [6, 192], icyVeins: [0, 20, 202], isc: [4, 182], mqg: [202] },
};

const rob = s => simulate(s, cfg).robust;
const boardDmg = s => simulate(s, cfg, true).casts.reduce((a, c) => a + c.dmg, 0);
const starts = s => simulate(s, cfg, true).casts.map(c => c.t);

// ★★ THE CLEANLINESS TEST — which windows this instrument can actually price.
// Toggling a VALUE window rescales damage without touching a single cast time, so the anchored
// lattice is bit-identical with and without it and `dModel − dQuant` isolates that window's own
// boundary exactly. Toggling a HASTE window RE-LATTICES the whole fight (h40: mqg 180→177 casts,
// berserking 180→179, icyVeins 180→171), so its `dQuant` also absorbs the FIGHT-END quantization
// at T — a boundary that has nothing to do with the window. Haste rows are therefore measured and
// printed but explicitly NOT load-bearing; the verdict below reads the value half only.
const latticeClean = (s, key) => {
  const a = starts(s), b = starts({ ...s, [key]: [] });
  return a.length === b.length && a.every((x, i) => Math.abs(x - b[i]) < 1e-9);
};

// bloodlust is cfg-fixed (a raid external, not a press the plan owns) — never toggled.
const OWNED = ['icyVeins', 'isc', 'mqg', 'arcanePower', 'berserking'];
const kindOf = k => BUFFS[k].kind;
// RULES §3b-note: value buffs (+SP, ×dmg) are read at cast COMPLETION ⇒ model OVER-credits.
// haste buffs (×speed, +rating) are read at cast START and frozen ⇒ model UNDER-credits.
const classOf = k => (kindOf(k) === 'dmg' || kindOf(k) === 'sp') ? 'value' : 'haste';

function chargeTable(planKey) {
  const s = PLANS[planKey];
  const base = rob(s);
  const pp = d => 100 * d / base;
  const rows = [];
  for (const key of OWNED) {
    if (!s[key] || !s[key].length) continue;
    const without = { ...s, [key]: [] };
    const dModel = base - rob(without);
    const dQuant = boardDmg(s) - boardDmg(without);
    rows.push({
      key, cls: classOf(key), kind: kindOf(key), presses: s[key].join(','),
      dModel: pp(dModel), dQuant: pp(dQuant), charge: pp(dModel - dQuant),
      clean: latticeClean(s, key),
    });
  }
  return { base, rows };
}

console.log('=== PHASE8 §22 — anchored per-window continuous-vs-discrete charge, B2 pair @ R=70');
console.log('charge = dModel(continuous integral) − dQuant(anchored discrete board), pp of that plan\n');

const out = {};
for (const p of ['h40', 'h70']) {
  const { base, rows } = chargeTable(p);
  console.log(`--- plan ${p}  (robust base ${base.toFixed(1)})`);
  console.log('  window        kind    class   presses            dModel      dQuant      charge  lattice');
  let L = 0, U = 0;
  for (const r of rows) {
    console.log(`  ${r.key.padEnd(13)} ${r.kind.padEnd(7)} ${r.cls.padEnd(7)} ${r.presses.padEnd(18)} ` +
                `${r.dModel.toFixed(4).padStart(9)} ${r.dQuant.toFixed(4).padStart(11)} ${r.charge.toFixed(4).padStart(11)}` +
                `  ${r.clean ? 'clean' : 'MOVED'}`);
    if (r.cls === 'value') L += r.charge; else U += r.charge;
    // The class↔cleanliness correspondence is an assumption, not a coincidence — assert it, so a
    // future engine change that makes an SP buff move the lattice cannot slip through silently.
    if ((r.cls === 'value') !== r.clean) {
      console.error(`INSTRUMENT ERROR: ${r.key} is class=${r.cls} but lattice ${r.clean ? 'clean' : 'MOVED'} — ` +
                    `the value/haste split no longer matches the cleanliness split.`);
      process.exit(4);
    }
  }
  out[p] = { L, U, net: L - U };
  console.log(`  Σ value (L, CLEAN) = ${L.toFixed(4)} pp   ·   Σ haste (U, confounded) = ${U.toFixed(4)} pp\n`);
}

// ── The sign test (§13.8's, re-run with the anchored ruler) ────────────────────────────────────
// Quantization says S(p) = M(p) − L(p) + U(p). The correction's effect on the B2 differential is
//        Δ = [L−U](h40) − [L−U](h70).
// Observed (§2, T=229): the model reads h40 0.380 pp LOWER than the sim. For the charge to CLOSE
// B2 it must raise h40 relative to h70 ⇒ Δ must be NEGATIVE. §13.8's flat-frac ruler read +0.065.
// The verdict reads the CLEAN (value) half only — see latticeClean above for why the haste rows
// cannot carry it. §13.8's comparable number is its own value column: h40 0.140 − h70 0.104.
const dL = out.h40.L - out.h70.L;
console.log('=== SIGN TEST vs §13.8 (the §20 trap) — value windows only, the half this ruler can price');
console.log(`  flat-frac ruler (§13.8):  L(h40) +0.1400   L(h70) +0.1040   ΔL = +0.0360 pp  → ANTI-B2`);
console.log(`  anchored ruler (§22):     L(h40) ${out.h40.L >= 0 ? '+' : ''}${out.h40.L.toFixed(4)}   ` +
            `L(h70) ${out.h70.L >= 0 ? '+' : ''}${out.h70.L.toFixed(4)}   ΔL = ${dL >= 0 ? '+' : ''}${dL.toFixed(4)} pp`);
console.log(`  B2 observed gap (model−sim, T=229): −0.380 pp   ⇒ the charge must be NEGATIVE to close it.`);
console.log(dL < 0
  ? `  ★ SIGN FLIPS: the anchored value charge is PRO-B2 (ΔL=${dL.toFixed(4)}). §13.8's retirement of\n` +
    `    the family rested on the flat ruler §21.5 invalidated. Implementation is unblocked on\n` +
    `    SIGN — it still owes a sim gate, which this session cannot run (no rig; PHASE8 §22).`
  : `  ✗ SIGN HOLDS, AND WORSENS: the anchored value charge is still ANTI-B2 (ΔL=${dL.toFixed(4)} ≥ 0),\n` +
    `    ${(dL / 0.036).toFixed(1)}× the flat ruler's +0.0360. Re-shaping the ruler did NOT rescue the family:\n` +
    `    §13.8's verdict SURVIVES §21.5's invalidation of its closed form. Implementing the charge\n` +
    `    would WIDEN B2, so it must not land as a B2 fix. The §20 tension is unresolved.`);

// ── Reproduction test: §21.5's C-BE for MQG@202 must come back ─────────────────────────────────
// Same two contexts and trinket sets p8-round10.mjs used. If these drift, the instrument is wrong
// and nothing above is believable.
console.log('\n=== REPRODUCTION TEST — §21.5 C-BE (MQG@202), must read A +0.1505 / B +0.2610');
const REST = {
  A: { bloodlust: [162], arcanePower: [8, 188], berserking: [0, 188], icyVeins: [0, 20, 200] },
  B: { bloodlust: [162], arcanePower: [4, 192], berserking: [6, 192], icyVeins: [0, 20, 202] },
};
const S3 = { isc: [4, 182], mqg: [202] };
let reproOk = true;
const EXPECT = { A: 0.1505, B: 0.2610 };
for (const ctx of ['A', 'B']) {
  const withM = { ...REST[ctx], ...S3 }, noM = { ...REST[ctx], ...S3, mqg: [] };
  const b = rob({ ...REST[ctx], isc: [29, 183], mqg: [9] });
  const cbe = 100 * ((rob(withM) - rob(noM)) - (boardDmg(withM) - boardDmg(noM))) / b;
  const ok = Math.abs(cbe - EXPECT[ctx]) < 0.005;
  if (!ok) reproOk = false;
  console.log(`  ctx ${ctx}: C-BE = ${cbe.toFixed(4)} pp  (expect ${EXPECT[ctx]})  ${ok ? '✓' : '✗ DRIFT'}`);
}
console.log(reproOk
  ? '  ✓ instrument reproduces §21.5 — the charge numbers above are on the same ruler.'
  : '  ✗ REPRODUCTION FAILED — do not believe the sign test above; the engine or the\n' +
    '    normalizer moved relative to round 10.');
process.exit(reproOk ? 0 : 3);
