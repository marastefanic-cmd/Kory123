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
// ── ★★★ YOU DO NOT NEED TO BRUTE-FORCE PER SP POINT — eff(SP) IS CLOSED FORM (proved 07-27) ──────
// Read the scorer (`index.html:1165-1184`): every SP-touching term is AFFINE in `sp`, and `sp` is
// `SP_base + Δ` where Δ is the temporary buff total. Everything else — critFactor, dmgMult, t5add,
// seg.mult, seg.targets, aoeCritAmp, the kill taper — is SP-free, and **cast times never reference
// `sp` at all**, so the entire cast lattice is SP-INVARIANT. Therefore, for a FIXED schedule:
//
//     countTotal(SP) = P + Q·SP        plain(SP) = R + S·SP        eff(SP) = A + C/(BASE + COEF·SP)
//
// a Möbius function, pinned exactly by TWO evaluations. Verified numerically on a hand-built
// schedule: fit A and C from SP 900 and 2300 only, then predict SP ∈ {300…5000} — worst relative
// error **6.6e-15**, i.e. float noise.
//
// ★ The two constants are interpretable, which is the useful part:
//     A = Σ mult_i / M0   the MULTIPLIER-WEIGHTED CAST COUNT — what the plan scores at infinite SP,
//                         where temporary +SP is worth nothing. (Measured exactly 206.000 on a
//                         4:00 plan: 180 plain casts + 1.3 × 20 Arcane-Power casts.)
//     C/B                 the SP-BUFF CONTRIBUTION, decaying as 1/(720 + 0.714·SP).
//   So eff(SP) falls monotonically toward A. That IS the hypothesis at the top of this file, exactly.
//
// ★★ And comparing two schedules, the denominator is shared, so
//        eff_P(SP) − eff_Q(SP) = (A_P − A_Q) + (C_P − C_Q)/B
//   is monotone in 1/B ⇒ **AT MOST ONE CROSSOVER over the whole SP axis**, at the closed form
//        B* = −(C_P − C_Q)/(A_P − A_Q),   SP* = (B* − BASE)/COEF.
//   `--curve` prints A, C and every pairwise crossover, so a handful of solves gives the exact
//   SP-envelope instead of a sampled one.
//
// ⚠ WHAT IS *NOT* CLOSED FORM: the argmax over all conceivable schedules. The SEARCH still has to
// find candidates. But because the lattice is SP-invariant, the candidate set is the SAME at every
// SP — so one search pass that RETAINS its candidates yields the exact envelope. This is the sharp
// contrast with HASTE, which moves the lattice and genuinely does require re-solving per point.
// That asymmetry is why the acceptance corpus is an N×N *haste* matrix and there is no SP matrix.
//
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
const CURVE = argv.includes('--curve');   // report A, C and the exact crossovers (header ★★★)
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
    // A and C for THIS schedule — two extra scorings, and they give the whole SP axis (see header).
    let A = null, C = null;
    if (CURVE) {
      const ev = q => {
        const c2 = { ...cfg, sp: q };
        const B = g.AB.AVG_BASE_DMG + g.AB.COEF * q;
        const pl = B * (1 + crit * (g.CRIT_MULT - 1)) * (c2.t5two ? 1.2 : 1);
        return { e: api.simulate(best.s, c2).total / pl, B };
      };
      const q1 = ev(900), q2 = ev(2300);
      C = (q1.e - q2.e) / (1 / q1.B - 1 / q2.B);
      A = q1.e - C / q1.B;
    }
    rows.push({ sp, wasteSec, spCasts, casts: board.length, plan, A, C });
    console.log(`     ${String(sp).padStart(7)}   ${wasteSec.toFixed(2).padStart(8)}   ` +
      `${String(spCasts).padStart(5)}/${String(board.length).padEnd(5)}   ${(r.total / plain).toFixed(1).padStart(5)}   ${plan}`);
  }
  if (CURVE) {
    console.log('\n     closed form  eff(SP) = A + C/(BASE + COEF·SP)   — two scorings each, no sampling');
    console.log('     solved@SP          A            C');
    for (const r of rows) console.log(`     ${String(r.sp).padStart(9)}   ${r.A.toFixed(4).padStart(10)}   ${r.C.toFixed(1).padStart(10)}`);
    // Pairwise crossovers. Shared denominator ⇒ the difference is monotone in 1/B ⇒ at most one root.
    const seen = new Map();
    for (const r of rows) { const k = r.plan; if (!seen.has(k)) seen.set(k, r); }
    const uniq = [...seen.values()];
    if (uniq.length > 1) {
      console.log('\n     where the argmax would change (closed form, NOT sampled):');
      for (let i = 0; i < uniq.length; i++) for (let j = i + 1; j < uniq.length; j++) {
        const dA = uniq[i].A - uniq[j].A, dC = uniq[i].C - uniq[j].C;
        if (Math.abs(dA) < 1e-12) { console.log(`       @${uniq[i].sp} vs @${uniq[j].sp}: parallel (ΔA≈0) — never cross`); continue; }
        const Bs = -dC / dA, sp = (Bs - g.AB.AVG_BASE_DMG) / g.AB.COEF;
        console.log(`       @${uniq[i].sp} vs @${uniq[j].sp}: crossover at SP ${sp.toFixed(0)}` +
          `${sp < 0 || sp > 6000 ? '  (outside any real gear — one dominates everywhere)' : ''}`);
      }
    }
  }
  // ★ (A, C) IDENTITY OVERRIDES THE LAYOUT COUNT, and this is the tool's most important guard.
  // Two schedules with the same A and the same C are the SAME POINT in objective space at EVERY SP —
  // a plateau, not a decision. Counting "3 distinct layouts" and reading it as SP-responsiveness is
  // exactly the mistake the sampled sweep invites, and it is the mistake this tool made first.
  if (CURVE && rows.length > 1 && rows.every(r => Math.abs(r.A - rows[0].A) < 1e-9 && Math.abs(r.C - rows[0].C) < 1e-6)) {
    console.log('\n     ⛔ EVERY ROW HAS THE SAME (A, C) — the layouts differ on the timeline but are');
    console.log('        OBJECTIVE-IDENTICAL at every SP. Base spell power does not move this plan at');
    console.log('        all; the apparent movement is the search picking between tied arrangements.');
    console.log('        Do NOT report this as "the model responds to SP". It is a plateau.');
    continue;
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
