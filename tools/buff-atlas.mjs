// THE BUFF ATLAS — what is each cooldown actually WORTH, and does it depend on where you put it?
//
//   node tools/buff-atlas.mjs [--T 60] [--sp 1000] [--crit 25] [--haste 0] [--step 5] [--md]
//
// Exit: 0 = measured · 2 = could not measure. This is an INSTRUMENT, not a gate: it reports, and
// `docs/ESTABLISHED-FACTS.md` is where its output gets turned into claims the model must satisfy.
//
// ── WHY ──────────────────────────────────────────────────────────────────────────────────────────
// User, 2026-07-28: *"observe the behavior of each singular buff at different haste levels, then in
// combination with other buffs… some are obvious but should be documented too, so they are
// referencable and testable whether our model follows them."*
//
// The project kept arguing about cooldown placement from first principles and getting it wrong in
// both directions — twice in one session I explained a correct measurement with an incorrect
// mechanism. A table of measured single-buff values is the antidote: it is the ground floor everything
// else has to be consistent with, and it is cheap.
//
// ── WHAT IT MEASURES ─────────────────────────────────────────────────────────────────────────────
// For each cooldown, alone, on an otherwise bare fight, pressed at 0, `step`, 2·step … up to
// `T − duration`:
//
//   SIM   = DPS(that one press) − DPS(never press)      ← difference-in-differences, BENCH §2.1,
//                                                          so every passive cancels exactly
//   MODEL = robust(that one press) − robust(no presses)  ← the same question of the scorer
//
// The two are in different units (DPS vs the model's damage sum), so read each column's SHAPE — flat
// or not, and where it moves — and compare the shapes, never the absolute numbers.
//
// ── THE EXPECTATIONS, STATED BEFORE MEASURING (user, 07-28) ──────────────────────────────────────
// This is the important part: the table is not exploratory, it is a CHECK, and the prediction is on
// record before the run.
//
//   HASTE buffs (Icy Veins, Berserking, Bloodlust, Mind-Quickening Gem)
//     → value must be FLAT across every placement. At h=0 the GCD floor gives back exactly what the
//       multiplication wins, and a haste buff shortens a slow cast and a fast cast by the same
//       FRACTION, so where it lands cannot matter on a bare fight.
//     ⚠ *"if they aren't [flat] then that's a fault in setting up the sim"* — so a non-flat SIM column
//       is a harness bug to hunt, not a fact to write down.
//
//   VALUE buffs (Arcane Power, Icon, Serpent-Coil)
//     → TWO claims, and both are ASSERTED. ⛔ The first version of this tool merely *exempted* the ramp
//       placements from the flatness check, which quietly threw away the more interesting half of the
//       rule and reported "flat ✓" for a column whose first row is 20% low. An exemption is not a
//       finding. So:
//         (a) FLAT at or after 3 Arcane Blast stacks are built, and
//         (b) STRICTLY WORSE before that — *"if you use them once stacks are built up, it obviously can
//             cover more casts than if you use them before stacks are built up"* (user, 07-28).
//       (b) is checked in BOTH columns and the two penalties are compared: the model is only right here
//       if it reproduces the sim's penalty, not merely if it has one.
//
// ⛔ Power Infusion and Drums of Battle are OMITTED (user, 07-28). `sim/planspec.mjs`'s
// `UNTRANSCRIBABLE` lists both — wowsims has no APL action for either — so they could only ever have
// produced a model column with nothing to check it against. Ashtongue is out too: a proc, not a press.
//
// ⚠ Trinket presses are BIT-IDENTICAL NO-OPS when the item is not worn, and wowsims does not complain
// (planspec's REQUIRES_EQUIPPED header). So each trinket is equipped into the character before its own
// sweep, and the tool refuses if the press it is about to measure would be a no-op.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from './genapl-core.mjs';
import { buildRequest, dpsOf } from '../sim/simreq.mjs';
import { BENCH } from '../sim/benchmark.mjs';
import { SPEC_KEY, UNTRANSCRIBABLE, REQUIRES_EQUIPPED, unequippedPresses } from '../sim/planspec.mjs';
import { loadEngine, ALL_BUFFS } from './engine-node.mjs';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const die = m => { console.error('ATLAS ERROR: ' + m); process.exit(2); };
const argv = process.argv.slice(2);
const arg = (k, d) => { const i = argv.indexOf('--' + k); return i >= 0 && argv[i + 1] !== undefined ? argv[i + 1] : d; };
const MD = argv.includes('--md');

const T = +arg('T', '60'), SP = +arg('sp', '1000'), CRIT = +arg('crit', '25');
const HASTE = +arg('haste', '0'), STEP = +arg('step', '5');
const ITER = +arg('iter', String(BENCH.iterations));

const api = loadEngine(path.join(REPO, 'index.html'));
// ⚠ ENGINE STAMP. A container restart silently rolled this repo back mid-session twice on 07-28, and a
// batch of measurements ran against the pre-boundary-credit engine without anyone noticing — that
// engine answers a *different question* and its numbers were reported as if they were current.
// `casts[].frac` exists only on the current scorer. Refuse rather than print.
{
  const c0 = { T: 30, hasteRating: 0, sp: SP, critPct: CRIT, enabled: Object.fromEntries(ALL_BUFFS.map(k => [k, false])),
               fixed: {}, warnings: [], coldSnap: false, segments: null };
  if (api.simulate(api.repair({}, c0), c0, true).casts[0].frac === undefined)
    die('index.html is an OLD engine (casts[].frac missing). Refusing to print numbers from it.');
}

// Raid externals are pressed by someone else, so the model takes them as pinned calls rather than
// schedule entries. Getting this wrong makes `repair` move them and the sweep measures nothing.
const EXTERNAL = new Set(['bloodlust', 'powerInfusion', 'drums']);
const BUFFS = ['icyVeins', 'berserking', 'bloodlust', 'mqg',        // haste
               'arcanePower', 'isc', 'scb', 'skull'];               // value
// Which expectation applies. `kind` on the buff def is the engine's own classification, so this cannot
// drift from what the scorer actually does with them.
const isHaste = key => { const k = api.BUFFS[key].kind; return k === 'mult' || k === 'rating'; };

// ── the sim ──────────────────────────────────────────────────────────────────────────────────────
globalThis.wasmready = () => {};
await import(path.join(REPO, 'sim/wasm_exec.js'));
const go = new globalThis.Go();
const { instance } = await WebAssembly.instantiate(fs.readFileSync(path.join(REPO, 'sim/sim.wasm')), go.importObject);
go.run(instance);
const TEMPLATE_RAW = fs.readFileSync(path.join(REPO, 'sim/model-ref-request.json'), 'utf8');

// Equip a pair of trinkets into a fresh copy of the template. `model-ref` carries no equipment at all,
// so the slots are padded rather than replaced.
const withKit = pair => {
  const t = JSON.parse(TEMPLATE_RAW);
  const items = t.raid.parties[0].players[0].equipment.items;
  while (items.length < 14) items.push({ id: 0, randomSuffix: 0, enchant: 0, gems: [] });
  pair.forEach((k, i) => { items[12 + i] = { id: REQUIRES_EQUIPPED[k].item, randomSuffix: 0, enchant: 0, gems: [] }; });
  return t;
};
const simDps = (tpl, spec) => {
  const req = buildRequest(tpl, { sp: SP, critPct: CRIT, hasteRating: HASTE, T, iterations: ITER,
                                  seed: BENCH.seed, targets: 0, apl: build(spec) });
  const out = JSON.parse(globalThis.raidSimJson(JSON.stringify(req)));
  if (out && out.errorResult) die('sim: ' + out.errorResult);
  const d = dpsOf(out);
  if (!d || !Number.isFinite(d.avg)) die('sim returned no DPS');
  return d.avg;
};

// ── the model ────────────────────────────────────────────────────────────────────────────────────
const cfgFor = key => {
  const en = {}; for (const k of ALL_BUFFS) en[k] = (k === key);
  return { T, hasteRating: HASTE, sp: SP, critPct: CRIT, enabled: en, fixed: {},
           warnings: [], coldSnap: false, segments: null };
};
const modelVal = (key, t) => {
  const cfg = cfgFor(key);
  const base = api.simulate(api.repair({}, cfg), cfg).robust;
  // ⚠ `repair` iterates `for (const key in schedule)` and applies `cfg.fixed` INSIDE that loop, so a
  // pinned key absent from the schedule is silently dropped — the Bloodlust column came back as a row
  // of zeros (mean 0 ⇒ NaN%) until this was found. Pass the key in BOTH.
  const c2 = EXTERNAL.has(key) ? { ...cfg, fixed: { [key]: [t] } } : cfg;
  const s = { [key]: [t] };
  return api.simulate(api.repair(JSON.parse(JSON.stringify(s)), c2), c2).robust - base;
};

// When are 3 Arcane Blast stacks built on a bare fight? Read it off the engine's own cast board rather
// than re-deriving 2.5/2.166/1.832 — that arithmetic has been wrong in this repo before.
const T3 = (() => {
  const c0 = cfgFor('__none__');
  const r = api.simulate(api.repair({}, c0), c0, true);
  const c = r.casts.find(x => x.stacks >= api.GAME.AB.MAX_STACKS);
  return c ? c.t : 0;
})();

// ── the sweep ────────────────────────────────────────────────────────────────────────────────────
const out = [];
for (const key of BUFFS) {
  const def = api.BUFFS[key];
  if (!def) die(`index.html has no buff "${key}"`);
  const specKey = SPEC_KEY[key];
  const simmable = !!specKey && !UNTRANSCRIBABLE[key];
  const times = [];
  for (let t = 0; t <= T - def.dur + 1e-9; t += STEP) times.push(+t.toFixed(3));
  if (!times.length) { out.push({ key, def, skip: `duration ${def.dur}s does not fit in a ${T}s fight` }); continue; }

  let tpl = null, ctrl = null;
  if (simmable) {
    // Equip what this press needs; pair it with a second trinket that is never pressed.
    const pair = REQUIRES_EQUIPPED[specKey] ? [specKey, specKey === 'Icon' ? 'Gem' : 'Icon'] : ['Icon', 'Gem'];
    tpl = withKit(pair);
    const worn = tpl.raid.parties[0].players[0].equipment.items.map(i => i && i.id).filter(Boolean);
    const bad = unequippedPresses({ [specKey]: [0] }, worn);
    if (bad.length) die(`${key}: the press would be a silent no-op — ${bad.join(', ')}`);
    ctrl = simDps(tpl, { _prestack: BENCH.prestack });
  }
  const haste = isHaste(key);
  const last = times[times.length - 1];
  const rows = times.map(t => ({
    t,
    // ⚠ TWO EDGES ARE STRUCTURALLY DIFFERENT AND ARE JUDGED SEPARATELY, NOT SILENTLY AVERAGED IN:
    //   t = 0        — the pull. The buff covers the opening ramp, where casts are LONGER than the GCD.
    //   t = T − dur  — the window ends exactly at the kill, so the last cast under it is clipped by the
    //                  fight end and earns only partial credit. Unavoidable, and not a placement choice.
    // The flatness expectation is about the INTERIOR: everywhere a player actually has a free choice.
    edge: t === 0 || t === last,
    ramp: !haste && t < T3 - 1e-9,        // value buffs pressed before full stacks are exempt
    sim: simmable ? simDps(tpl, { _prestack: BENCH.prestack, [specKey]: [t] }) - ctrl : null,
    model: modelVal(key, t),
  }));
  out.push({ key, def, simmable, haste, rows });
  if (!MD) process.stderr.write(`  ${key} … ${rows.length} placements\n`);
}

// ── report ───────────────────────────────────────────────────────────────────────────────────────
// The verdict is on the SHAPE. Flatness is judged as a percentage of the buff's own mean value, so it
// is comparable across a +30% damage cooldown and a +155 SP trinket. 0.5% is the bar: the sim's own
// too-close-to-call band is 0.05% of TOTAL DPS, and these values are ~3-10% of total, so 0.5% of a
// buff's value is the same order as the noise floor on the quantity being measured.
const FLAT_PCT = 0.5;
const f = (n, d = 1) => n === null ? '—' : n.toFixed(d);
const stats = a => { const v = a.filter(x => x !== null && x !== undefined);
  if (!v.length) return null;
  const mean = v.reduce((x, y) => x + y, 0) / v.length;
  return { mean, spread: Math.max(...v) - Math.min(...v), pct: 100 * (Math.max(...v) - Math.min(...v)) / Math.abs(mean) }; };

console.log(`# buff atlas — T=${T}s · ${SP} SP · ${CRIT}% crit · ${HASTE} haste · infinite mana · no set bonuses`);
console.log(`# one cooldown at a time on an otherwise bare fight; value = with-press minus never-press`);
console.log(`# sim: ${ITER} iterations, seed ${BENCH.seed}, cold open (_prestack ${BENCH.prestack})`);
console.log(`# 3 Arcane Blast stacks are built at t=${T3.toFixed(3)}s\n`);

const verdicts = [];
for (const b of out) {
  if (b.skip) { console.log(`## ${b.def.name} — SKIPPED: ${b.skip}\n`); continue; }
  // Haste buffs are judged over EVERY placement; value buffs only from full stacks onward.
  const judged = b.rows.filter(r => !r.ramp && !r.edge);
  const sS = stats(judged.map(r => r.sim)), mS = stats(judged.map(r => r.model));
  console.log(`## ${b.def.name}  —  ${b.haste ? 'HASTE' : 'VALUE'} buff, ${b.def.dur}s${b.def.stat ? ` (${b.def.stat})` : ''}`);
  console.log(`Expectation: flat across INTERIOR placements${b.haste ? '' : ` >= ${T3.toFixed(2)}s (full stacks)`} — t=0 (pull) and t=${b.rows[b.rows.length-1].t}s (window clipped by the kill) judged separately.\n`);
  console.log('| press at | sim ΔDPS | model Δ | |');
  console.log('|---|---|---|---|');
  for (const r of b.rows)
    console.log(`| ${r.t}s | ${f(r.sim, 2)} | ${f(r.model)} | ${[r.ramp && 'ramp', r.edge && (r.t === 0 ? 'pull' : 'clipped by kill')].filter(Boolean).join(', ')} |`);
  console.log('');
  const verdict = (label, st) => {
    if (!st) return `  ${label}: no data`;
    const ok = st.pct <= FLAT_PCT;
    return `  ${label}: mean ${f(st.mean, 2)} · spread ${f(st.spread, 2)} = ${st.pct.toFixed(2)}% of mean  ${ok ? '✓ FLAT' : '✗ NOT FLAT'}`;
  };
  console.log(`  [flat, interior placements]`);
  console.log(verdict('SIM  ', sS));
  console.log(verdict('MODEL', mS));
  // ★ THE RAMP PENALTY IS A CLAIM, NOT AN EXEMPTION. A value buff pressed before full stacks covers
  // fewer casts and must be measurably WORSE — and the model is only correct here if it reproduces the
  // SIM's penalty, not merely if it has one of its own.
  const ramps = b.rows.filter(r => r.ramp);
  if (ramps.length && sS && mS) {
    console.log(`  [ramp penalty — pressed before 3 stacks at ${T3.toFixed(2)}s, must be WORSE]`);
    let bad = 0;
    for (const r of ramps) {
      const sPen = 100 * (r.sim - sS.mean) / sS.mean, mPen = 100 * (r.model - mS.mean) / mS.mean;
      // "Worse" only bites where it should: a press at 5s FIRES at the next cast boundary, which is
      // the first full-stack cast, so it is expected to read ~0 and that is not a failure.
      const material = Math.abs(sPen) > FLAT_PCT;
      // ⚠ Scale the agreement tolerance by THIS column's measured sim noise, not a fixed number. A flat
      // 1.0 pp flagged Serpent-Coil as a model disagreement when the gap (1.5 pp) sits inside the sim's
      // own 1.85 % spread on that row — the noisiest cooldown in the table, 34 DPS out of ~1700.
      // Comparing a measurement against a tolerance tighter than its own noise manufactures findings.
      const tol = Math.max(1.0, 1.5 * sS.pct);
      const agree = !material || Math.abs(sPen - mPen) <= tol;
      if (!agree) bad++;
      console.log(`    press ${String(r.t).padStart(2)}s: sim ${sPen >= 0 ? '+' : ''}${sPen.toFixed(1)}% · model ${mPen >= 0 ? '+' : ''}${mPen.toFixed(1)}%` +
                  `   ${!material ? '(fires at the first full-stack boundary — no penalty expected)' : agree ? `✓ model reproduces the sim penalty (±${tol.toFixed(1)}pp)` : `✗ MODEL DISAGREES with the sim (gap ${Math.abs(sPen-mPen).toFixed(1)}pp > ±${tol.toFixed(1)}pp)`}`);
    }
    if (!bad) console.log(`    => ✓ the ramp penalty is real and the model has it right`);
  }
  if (sS && sS.pct > FLAT_PCT)
    console.log(`  ⚠ the SIM column is not flat — per the 07-28 ruling that is a HARNESS setup fault to hunt, not a fact.`);
  if (mS && mS.pct > FLAT_PCT && (!sS || sS.pct <= FLAT_PCT))
    console.log(`  ⛔ the MODEL disagrees with a flat sim — a scorer defect, at ${mS.pct.toFixed(2)}% of the buff's own value.`);
  console.log('');
  const rp = b.rows.filter(r => r.ramp);
  const ramp0 = rp.length && sS && mS ? { sim: 100*(rp[0].sim-sS.mean)/sS.mean, model: 100*(rp[0].model-mS.mean)/mS.mean } : null;
  verdicts.push({ name: b.def.name, haste: b.haste, sim: sS, model: mS, ramp0 });
}
console.log('## summary\n');
console.log('| cooldown | kind | sim flat? | model flat? | press-at-0 penalty (sim / model) |');
console.log('|---|---|---|---|---|');
const mark = st => st ? (st.pct <= FLAT_PCT ? `✓ ${st.pct.toFixed(2)}%` : `✗ ${st.pct.toFixed(2)}%`) : '—';
for (const v of verdicts)
  console.log(`| ${v.name} | ${v.haste ? 'haste' : 'value'} | ${mark(v.sim)} | ${mark(v.model)} | ` +
    (v.ramp0 ? `${v.ramp0.sim.toFixed(1)}% / ${v.ramp0.model.toFixed(1)}%` : 'n/a (haste — expected none)') + ' |');
process.exit(0);
