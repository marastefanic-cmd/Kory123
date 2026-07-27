// DOES BASE SPELL POWER CHANGE HOW MUCH HASTE IT IS WORTH WASTING? — no sim, pure model arithmetic.
//
//   node tools/sp-sensitivity.mjs [--presets "3:20 lust 0:05,5:00 lust 0:05"] [--restarts 2]
//                                 [--sp 800,1400,2000,2400]
//
// ── THE QUESTION ──────────────────────────────────────────────────────────────────────────────────
// A temporary +SP buff is worth, per cast it covers, a multiplier over a plain Arcane Blast of
//
//     premium(Δ) = COEF·Δ / (AVG_BASE_DMG + COEF·SP_base)
//
// The numerator is fixed by the trinket; the denominator grows with your gear. So the premium FALLS as
// base spell power rises — Icon's +155 is worth 8.57 % per cast at 800 SP and 4.55 % at 2400.
// (The T5-2pc ×1.2 is in BOTH the cast and the normaliser, so it cancels: the table is t5two-free.)
//
// Against that sits the cost of stacking haste cooldowns together: once the GCD binds, extra haste
// buys no casts at all, and a cast forgone is worth **1.0 by definition** — effective ABs are
// normalised to a plain cast, so the cost side does not shrink with gear while the benefit side does.
//
// ⇒ Prediction: **as base SP rises, packing haste under the spell-power window should get less
// attractive** — fewer casts bought at the price of wasted haste.
//
// ⚠ And the sharper corollary, which is the more useful half: Arcane Power is ×1.30 whatever your SP,
// and so are the haste buffs. Only the FLAT +SP trinkets lose relative value with gear. So the
// prediction is not "SP matters less" but "SP trinkets lose ground TO the multipliers".
//
// ── WHY THIS IS MEASURED RATHER THAN ASSERTED ────────────────────────────────────────────────────
// The model has no RULE for any of it — CLAUDE.md's doctrine is that Lust alignment, haste sequencing
// and SP-on-fast-casts are CONSEQUENCES of maximising one number, never axioms. So the question is not
// "is the theory right" but "does the model, which was never told, behave this way". This is that test.
//
// ⚠⚠ `eff` IS NOT COMPARABLE DOWN A COLUMN. Effective ABs normalise to a plain cast *at that row's own
// SP*, so the denominator moves with the row. The LAYOUT and the two structural counters are the
// evidence; `eff` is printed only to show the solve happened.
//
// ── THE METRIC, AND THE ONE THAT WAS TRIED FIRST AND FAILED ──────────────────────────────────────
// ⛔ `gcdCappedTime / T` looks like the obvious proxy for "haste is being wasted" and is USELESS here:
// it SATURATES. A 3-stack Arcane Blast is 2.5 − 3×0.334 = 1.498 s, already fractionally under the
// 1.5 s GCD, so the GCD binds ~95 % of a fight at ZERO haste rating. Measured on `1:40 lust 0:05`:
// 94.73 % at every one of six SP levels — a flat line that says nothing. A proxy has to be able to
// MOVE before it can be read, and this one was chosen because it was already on the detail object.
//
// So the metric is two direct counters off the per-cast board:
//   · `wasteSec` — Σ max(0, gcd − cast): literal seconds of cast-time speed thrown away because the
//     GCD bound instead. This is exactly the quantity the question is about, and it is continuous.
//   · `spCasts`  — casts whose recorded `sp` exceeds base, i.e. covered by a temporary +SP buff.
// Packing harder means MORE `spCasts` bought with MORE `wasteSec`. If the prediction holds, both fall
// as base SP rises.
//
// ── WHAT IT ACTUALLY MEASURED, 2026-07-27 — the direction is right and the magnitude is small ────
// ⚠ Read this before quoting the tool: the model is mid-repair (PHASE12 — the cooldown chain is still
// press-moment, not fire-moment), so these are readings on TODAY's engine, not settled facts.
//
//   `2:00 lust 0:05`, haste 250, kit isc+mqg, SP 800 -> 2400:
//     wasteSec 0.51 -> 0.49 s   (-0.02)   ★ packs LESS at high SP — the predicted direction
//     and the layout DE-STACKS: the Zerk+MQG haste cluster moves 84/85 -> 63/65 while the second
//     Icy Veins moves 65 -> 84, i.e. the haste burst separates from the buff stack as SP rises.
//
// But the effect is SMALL, and three configurations found nothing at all:
//   `4:00`/`5:00` at haste 0, default kit   wasteSec 0.90 / 0.98 s, FLAT at all six SP levels
//   `4:00` at haste 250, default kit        wasteSec 3.12 s,        FLAT
//   `4:00` at haste 250, kit isc+mqg        wasteSec 3.14 s,        FLAT
//
// ★ The reason is the corollary above, and it is the more useful finding: **the packing is driven by
// ARCANE POWER, not by the SP trinkets.** AP is x1.30 at every gear level, so the dominant reason to
// stack does not weaken as base SP rises — the SP premium halving from 8.57% to 4.55% is a change to a
// secondary term. Expect base SP to nudge these layouts, never to overturn them.
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadEngine, cfgFor } from './engine-node.mjs';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const argv = process.argv.slice(2);
const flag = (n, d) => { const i = argv.indexOf(`--${n}`); return i < 0 ? d : argv[i + 1]; };
const api = loadEngine(process.env.ENGINE || path.join(REPO, 'index.html'));
const NAMES = flag('presets', '3:20 lust 0:05').split(',').map(s => s.trim()).filter(Boolean);
const RESTARTS = +flag('restarts', '2');
const SPS = flag('sp', '800,1100,1400,1700,2000,2400').split(',').map(Number);
if (SPS.some(s => !Number.isFinite(s) || s <= 0)) { console.error('--sp must be positive numbers'); process.exit(2); }
// ★ `--haste` MATTERS MORE THAN THE PRESET, and the first run of this tool did not have it.
// At haste rating 0 the model wastes ~1 s in a 4–5 minute fight (measured: 0.90 s over 240 s, 0.98 s
// over 300 s, flat at every SP) — so the trade the tool exists to study is DORMANT and base SP cannot
// move a decision nobody is making. Overcapping only becomes a live option once the GCD binds hard,
// i.e. at real gear haste. Sweep SP at 0 AND at ~250 before drawing any conclusion.
const HASTE = flag('haste', null) === null ? null : +flag('haste');
if (HASTE !== null && (!Number.isFinite(HASTE) || HASTE < 0)) { console.error('--haste must be >= 0'); process.exit(2); }
// ★★ AND `--kit` MATTERS MORE THAN EITHER, which is the trap this tool walked into twice.
// The preset default kit is `icyVeins, isc, scb, arcanePower, berserking, bloodlust` — **two SP
// trinkets and NO haste trinket.** There is nothing to overcap WITH, so "waste haste to pack the SP
// window" is not a choice the fight offers, and a flat result says nothing about the hypothesis.
// To put the trade on the table you need a haste trinket beside an SP one: `--kit
// icyVeins,arcanePower,berserking,bloodlust,isc,mqg` (MQG is +330 haste for 20 s).
const KIT = flag('kit', null);
const KEYS = KIT === null ? null : KIT.split(',').map(s => s.trim()).filter(Boolean);
if (KEYS) {
  const bad = KEYS.filter(k => !api.BUFFS[k]);
  if (bad.length) { console.error(`unknown buff key(s): ${bad.join(', ')} — known: ${Object.keys(api.BUFFS).join(', ')}`); process.exit(2); }
}

const g = api.GAME;
const premium = (delta, sp) => g.AB.COEF * delta / (g.AB.AVG_BASE_DMG + g.AB.COEF * sp);

console.log(`# SP sensitivity — ${RESTARTS} restarts · haste rating ${HASTE === null ? "(preset default)" : HASTE}` +
            ` · kit ${KEYS ? KEYS.join("+") : "(preset default)"} · NO SIM\n`);
if (!KEYS || !KEYS.some(k => (api.BUFFS[k] || {}).haste || /mqg|skull/.test(k)))
  console.log(`  ⚠ NO HASTE TRINKET IN THE KIT — there is nothing to overcap with, so a flat\n` +
              `    wasteSec column is expected and is NOT evidence about the hypothesis. See --kit.\n`);
console.log('  per-cast premium of a temporary SP buff, by base spell power (t5two cancels):');
console.log(`     base SP   plain AB   Icon +${api.BUFFS.isc.value}   gem +${api.BUFFS.scb.value}      AP`);
for (const sp of SPS)
  console.log(`     ${String(sp).padStart(7)}   ${(g.AB.AVG_BASE_DMG + g.AB.COEF * sp).toFixed(0).padStart(8)}   ` +
    `${(100 * premium(api.BUFFS.isc.value, sp)).toFixed(2).padStart(8)}%   ${(100 * premium(api.BUFFS.scb.value, sp)).toFixed(2).padStart(7)}%   ` +
    `${((api.BUFFS.arcanePower.value - 1) * 100).toFixed(2).padStart(6)}%  ← SP-invariant`);

let moved = 0;
for (const NAME of NAMES) {
  const kase = api.cases.find(c => c.name === NAME);
  if (!kase) { console.error(`\nno preset "${NAME}" — skipping`); continue; }
  console.log(`\n## "${NAME}"   (eff is NOT comparable down the column — see the header)`);
  console.log('     base SP   wasteSec   spCasts/casts   eff     plan');
  const rows = [];
  for (const sp of SPS) {
    const cfg = { ...cfgFor(api, KEYS ? { ...kase, kit: KEYS } : kase), sp,
                  ...(HASTE === null ? {} : { hasteRating: HASTE }) };
    const best = await api.optimizeAsync(cfg, RESTARTS, () => {});
    const r = api.simulate(best.s, cfg, true);
    const crit = Math.min(1, Math.max(0, cfg.critPct / 100));
    const plain = (g.AB.AVG_BASE_DMG + g.AB.COEF * cfg.sp) * (1 + crit * (g.CRIT_MULT - 1)) * (cfg.t5two ? 1.2 : 1);
    const board = r.casts || [];
    const wasteSec = board.reduce((s, c) => s + Math.max(0, (c.gcd || 0) - (c.cast || 0)), 0);
    const spCasts = board.filter(c => c.sp > cfg.sp + 1e-6).length;
    // ⚠ Print EVERY enabled track, not a hardcoded four. The first version printed IV/AP/isc/scb
    // only, so a run with `--kit …,mqg` could not show where MQG went — the exact track the kit was
    // chosen to expose. A readout that cannot display the variable under test is not a readout.
    const at = k => ((r.actEff || {})[k] || []).map(x => +x.toFixed(0));
    const plan = Object.keys(cfg.enabled).filter(k => cfg.enabled[k] && at(k).length)
      .map(k => `${k} ${JSON.stringify(at(k))}`).join(' ');
    rows.push({ sp, wasteSec, spCasts, casts: board.length, plan });
    console.log(`     ${String(sp).padStart(7)}   ${wasteSec.toFixed(2).padStart(8)}   ` +
      `${String(spCasts).padStart(5)}/${String(board.length).padEnd(5)}   ${(r.total / plain).toFixed(1).padStart(5)}   ${plan}`);
  }
  const a = rows[0], z = rows[rows.length - 1];
  const dWaste = z.wasteSec - a.wasteSec, dSp = z.spCasts - a.spCasts;
  const distinct = new Set(rows.map(r => r.plan)).size;
  console.log(`\n     Δ across the SP range:  wasteSec ${dWaste >= 0 ? '+' : ''}${dWaste.toFixed(2)} s · ` +
    `spCasts ${dSp >= 0 ? '+' : ''}${dSp} · distinct layouts ${distinct}/${rows.length}`);
  if (distinct === 1) {
    console.log('     ⚠ ONE LAYOUT AT EVERY SP — this preset has no packing decision to make, so it');
    console.log('       cannot answer the question either way. Not evidence for the prediction, and');
    console.log('       not against it. Pick a fight where the SP trinkets can sit away from the stack.');
  } else {
    moved++;
    console.log(`     ${dWaste < -0.01 || dSp < 0 ? '★ packs LESS at high SP — the predicted direction'
      : dWaste > 0.01 || dSp > 0 ? '⚠ packs MORE at high SP — the prediction is WRONG here, investigate'
      : '≈ layout moves but neither counter does — the change is elsewhere in the plan'}`);
  }
}
if (!moved) {
  console.log('\n⛔ NO PRESET IN THIS RUN HAD A PACKING DECISION. The run is VACUOUS — it is not a null');
  console.log('   result, it is no result. Re-run with longer fights or a kit whose SP trinkets have a');
  console.log('   second use (120 s cooldowns) so placement is actually a choice.');
  process.exit(2);
}
