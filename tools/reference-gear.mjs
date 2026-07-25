// THE REFERENCE GEAR — one source of truth for every harness that compares the model to wowsims.
//
// WHY THIS FILE EXISTS.  The model cfg a harness builds must describe THE GEAR THE SIM ACTUALLY RUNS,
// which is the reference export.  It did not: `sp: 1387` and no `t5two` were written out by hand in
// five tools, in six spellings of one formula — including a bare `2241` in `xval-model.mjs` and a
// hardcoded `(720 + (2.5/3.5)*1387) * (1 + 0.38*0.8175)` in two others.  Two of those spellings were
// wrong about the gear (PHASE8 §6/§7), and nothing could have told you: a cfg that omits `t5two` is
// read as `cfg.t5two ? 1.2 : 1` → `false`, so a missing key is a SILENT 20% mis-valuation of the whole
// AB stream, exactly the silent-key-drop shape that `genapl`'s kit lookup had (DIARY 07-25).
//
// THE TWO CORRECTIONS, and their provenance (PHASE8 §6, §7):
//   t5two  the export wears Tirisfal 2pc (items 30206/30196/30207).  The engine prices AP additively
//          with the T5 bonus (×1.25 on a T5'd AB stream, not ×1.30) and multiplies every AB by 1.2
//          — index.html applies `t5add` to the AB sites (831, 899) and correctly NOT to the AE sites
//          (829, 898).  The engine was always right; the harness simply never said `t5two`.
//   sp     the export wears Tirisfal 4pc (SpellID 37444, +70 SP on crit).  The combat log states it
//          outright: every AB `[DEBUG]` line reads `SP: 1386.2` (proc down) or `SP: 1456.2` (proc up),
//          at 88–94% uptime ⇒ effective SP ≈ 1386 + 0.9·70 ≈ 1450.  Uptime has NO haste trend (§7).
//
// ★ SPREAD IT, DON'T COPY IT.  Build cfgs as `{ T, hasteRating: h, ...REF, enabled, ... }`.  Naming
// the fields individually is how the drift happened: `sp` is conspicuous and `t5two` is not, so a
// hand-written cfg loses the invisible one and keeps printing plausible numbers.  Spreading makes
// forgetting a field impossible rather than merely unlikely.
//
// ⚠ NOT for `index.html` and NOT for `tests/`.  Neither correction is a model change (§7): the SP
// figure is a property of THIS EXPORT's gear and the T5 bonus is a property of THIS EXPORT's set, so
// both belong in the harness and in expectations.  `index.html`'s `GOLDEN_DEFAULTS.gear` is the frozen
// fixture the 25 goldens are pinned to, and `tests/monotonicity.mjs` asserts a property that must hold
// at ANY gear — neither is compared against a sim, and neither should import this.

export const REF = Object.freeze({ sp: 1450, critPct: 38, t5two: true });

// The plain-cast normalizer, evaluated IN PAGE SCOPE (it reads the engine's own `GAME` table rather
// than re-typing 720 / 2.5÷3.5 / 0.8175).  Mirrors index.html's `plainCast`; pass it straight to
// `page.evaluate(plainCastInPage, REF)`.  Calling it in Node throws on `GAME` — loudly, by design.
//
// ★ THIS IS NOT DISPLAY-ONLY.  `haste-ladder.mjs` and `brute-grid.mjs` grade a search MISS on
// `toolEff − gridEff < −0.15`, a DIFFERENCE of two plain-normalized numbers.  Give the cfg its ×1.2
// and not the normalizer and every `eff` inflates by exactly 1.2 — which silently narrows that band to
// 0.125 true effective casts, and is 30× larger than the correction's real effect (≈ −0.6%).
export const plainCastInPage = (R) =>
  (GAME.AB.AVG_BASE_DMG + GAME.AB.COEF * R.sp) * (1 + (R.critPct / 100) * (GAME.CRIT_MULT - 1)) * (R.t5two ? 1.2 : 1);
