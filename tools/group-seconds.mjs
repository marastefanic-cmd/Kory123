// DOES THE PLAN COLLAPSE ONTO A FEW DERIVABLE SECONDS? — and does it still, off h=0 and off one kit?
//
//   node tools/group-seconds.mjs                         # the default sweep
//   node tools/group-seconds.mjs --haste=0,150,300,450   # pick the haste ladder
//   node tools/group-seconds.mjs --T=120 --lust=5
//
// ── WHAT THIS IS FOR ─────────────────────────────────────────────────────────────────────────────
// `docs/archive/18-phase13-post-exact-objective.md` §3 wants to replace the descent with a CONSTRUCTIVE enumeration: derive the few
// seconds a press could sensibly sit on, then enumerate assignments. Two claims have to hold for that
// to be worth building, and both were measured on 2026-07-30 at **one haste level with one kit**:
//
//   (A) the plan COLLAPSES — all seven declared layouts put 6–8 presses on **≤3 distinct seconds**.
//   (B) those seconds are DERIVABLE — every one of them is in
//         G = {pull, raid calls, intermission exits} ∪ {anchor + time-to-3-stacks}
//             closed under {+dur(k), +cd(k)} for the ENABLED kit.
//       T6's [7,27,37] is `3-stack`, `+IV dur`, `+Zerk dur`. T2's [20,140] is `Lust call`,
//       `+trinket cd`. Nothing there is intuition; it is arithmetic on the kit.
//
// ⚠⚠ THE USER'S OBJECTION IS THE WHOLE REASON THIS FILE EXISTS: *"well this trinket combination for
// this haste level right. It's gonna be very different."* Correct. So:
//   · **G is derived per setup** — it reads each ENABLED buff's own duration and cooldown, so swapping
//     trinkets changes the lattice with them. That part is gear-agnostic by construction.
//   · **The anchor IS a constant, and that was measured rather than assumed** — see `TOLL_WINDOW`
//     below. The obvious guess (the hasted 3-stack time) moves from 7 down to 5 across the haste
//     ladder and is the WRONG quantity; the value cluster waits for the end of the m-independent
//     opener-toll window, which sits at 0:07 at every haste. The first version of this file guessed,
//     and 0:07 was the only second it could not derive at any haste above 0.
//   · **(A) is the fragile claim, and this file exists to break it.** `docs/RULES.md` §5 says the
//     layout SPREADS as gear haste grows (Icy Veins slides out of Lust), so a rising |S| at high haste
//     is the EXPECTED failure, not a surprise. Read a rising |S| as information about the enumeration's
//     cost, not as a bug.
//
// ⛔ This asserts nothing and gates nothing. It is a measurement that decides whether PHASE13 §3 is
// cheap or expensive. Do not wire it into CI.
import { loadEngine, cfgFor, ALL_BUFFS } from './engine-node.mjs';

const args = process.argv.slice(2);
const listArg = (n, d) => { const a = args.find(x => x.startsWith(`--${n}=`)); return a ? a.split('=')[1].split(',').map(Number) : d; };
const numArg = (n, d) => { const a = args.find(x => x.startsWith(`--${n}=`)); return a ? +a.split('=')[1] : d; };

const api = loadEngine(new URL('../index.html', import.meta.url).pathname);
const G = api.GAME, B = api.BUFFS;
const msq = x => Math.round(x * 1000) / 1000;

/* ★★★★ THE OPENER ANCHOR IS `ΣC_k` UNHASTED, AND IT DOES NOT MOVE WITH HASTE. Measured 07-30, and it
   corrects the first version of this file, which used the hasted 3-stack time and was wrong.

   Two different quantities were being conflated, and only one of them is the anchor:
     · when 3 Arcane Blast stacks are physically LIVE — 6.498 s at h=0, 5.459 s at 300 haste,
       4.707 s at 600. This genuinely moves with haste. It is NOT what the value cluster waits for.
     · the end of the OPENER TOLL WINDOW — `Σ(BASE_CAST − STACK_CAST_REDUCTION·k)` over the ramp,
       taken UNHASTED. §8q made the toll a fixed `Σ(C_k − G)/G` spread over exactly this window,
       precisely so that haste is ramp-neutral (ESTABLISHED-FACTS §1.2). A value window overlapping it
       pays a share of the toll; one starting after it pays none. **That is what makes the cluster
       wait**, and because the window is m-independent by construction, so is the anchor.

   Measured by sliding the value cluster and taking the argmax, 2:00 · Lust 0:05, standard kit:

       haste     3 stacks live at        best cluster second
         0        6.498 s → 7                    7
       150        5.934 s → 6                    7
       300        5.459 s → 6                    7
       450        5.055 s → 6                    7
       600        4.707 s → 5                    7

   ⇒ the anchor is `ceil(ΣC_k unhasted) = 7`, flat across the whole ladder, while the "3 stacks" time
   walks from 7 down to 5. Using the latter made this generator miss 0:07 at every haste above 0 — one
   wrong second, in every kit, and it was the ONLY thing it could not derive. */
const TOLL_WINDOW = (() => { let v = 0;
  for (let k = 0; k < G.AB.MAX_STACKS; k++) v += G.AB.BASE_CAST - G.AB.STACK_CAST_REDUCTION * k;
  return v; })();

/* THE GENERATOR. Everything here is read off `cfg` — no constant is specific to a kit or a gear set. */
function groupSeconds(cfg) {
  // Presses the PLANNER chooses. Used for `T - dur` (the latest a cooldown still runs in full).
  const tracks = ALL_BUFFS.filter(k => cfg.enabled[k] && !cfg.fixed[k] && B[k].kind !== 'proc');
  /* ⚠ HOPS COME FROM EVERY ENABLED BUFF, **INCLUDING THE PINNED ONES**, and excluding them was a bug.
     A pinned raid call's press time is not the planner's to choose, but its WINDOW EDGE is every bit
     as structural as an on-use's: 0:45 on a Lust-0:05 fight is `Lust call + Lust duration`, i.e. the
     second the raid haste falls off, and it is exactly where a plan re-anchors. With Bloodlust left
     out of the hop set this generator could not reach 45, and therefore not 65 or 75 either — three
     "NOT derivable" seconds that were entirely its own doing. */
  const hoppers = ALL_BUFFS.filter(k => cfg.enabled[k] && B[k].kind !== 'proc');
  const anchors = new Set([0]);
  for (const ts of Object.values(cfg.fixed || {})) for (const t of ts) anchors.add(Math.round(t));
  for (const seg of cfg.segments || []) if (seg.type !== 'normal') anchors.add(Math.round(seg.end));

  const out = new Set();
  // ★ No multiplier union and no fixed point: the toll window is m-independent, so the anchor is too.
  for (const a of anchors) { out.add(a); out.add(Math.ceil(a + TOLL_WINDOW - 1e-9)); }
  /* ⚠ TWO ROUNDS OF CLOSURE, NOT ONE — measured 07-30, and one round was a bug in this file rather
     than a fact about the game. The chain law (RULES §4b) is TRANSITIVE: if A wants to contain B and
     B's next use is one B-cooldown later, A wants to be there too. Concretely, the standard kit's
     0:37 is `3-stack(7) + IV dur(20) = 27`, then `+ Berserking dur(10) = 37` — TWO hops. With one
     round this generator reported 37 as "not derivable" and appeared to refute its own premise. */
  /* ROUNDS = 3, and the count is not arbitrary: it is how many hops the longest observed chain needs.
     `75 = 5 (Lust call) + 40 (Lust dur) + 20 (IV dur) + 10 (Berserking dur)` is THREE. The chain law
     is transitive, so the right bound is "as many hops as there are presses to chain"; 3 covers every
     layout measured so far and the set stays small (tens of seconds, not hundreds). */
  for (let round = 0; round < 3; round++)
    for (const g of [...out]) for (const k of hoppers) {
      if (g + B[k].dur <= cfg.T - 1) out.add(g + B[k].dur);
      if (g + B[k].cd  <= cfg.T - 1) out.add(g + B[k].cd);
    }
  for (const k of tracks) out.add(Math.max(0, cfg.T - B[k].dur));
  return new Set([...out].filter(t => t >= 0 && t <= cfg.T - 1));
}

const KITS = {
  'IV+Icon+Gem+AP+Zerk': ['icyVeins', 'isc', 'scb', 'arcanePower', 'berserking', 'bloodlust'],
  'IV+Skull+MQG+AP':     ['icyVeins', 'skull', 'mqg', 'arcanePower', 'bloodlust'],
  'IV+Icon+AP (no gem)': ['icyVeins', 'isc', 'arcanePower', 'bloodlust'],
};
const HASTE = listArg('haste', [0, 150, 300, 450]);
const T = numArg('T', 120), LUST = numArg('lust', 5);

console.log(`# GROUP SECONDS — does the plan collapse, and is the collapse DERIVABLE?`);
console.log(`#   fight ${Math.floor(T / 60)}:${String(T % 60).padStart(2, '0')} · Lust ${LUST} · 1387 SP · 38 % crit\n`);
console.log('  kit                    haste   presses  |S|  press seconds                    in G?');
console.log('  ' + '-'.repeat(96));

const tally = {};
for (const [kitName, kit] of Object.entries(KITS)) {
  for (const h of HASTE) {
    const cfg = cfgFor(api, { name: 'probe', T, pins: { bloodlust: [LUST] }, kit, gear: { haste: h, sp: 1387, crit: 38 } });
    const best = await api.optimizeAsync(cfg, undefined, () => {});
    /* ⚠ PLANNER-CONTROLLED PRESSES ONLY — the pinned raid call is an INPUT, not a decision the
       enumeration makes, and counting it inflates |S| by one whenever Lust does not happen to land on
       the value cluster's second. The first version of this file counted it while the hand-count that
       produced the "≤3" claim did not, so the two disagreed for a reason that had nothing to do with
       haste or kit: T6's planner presses are {7,27,37} = 3, but {5,7,27,37} = 4 with Lust included. */
    const presses = [];
    for (const k of Object.keys(best.s)) { if (cfg.fixed && cfg.fixed[k]) continue;
      for (const t of best.s[k]) presses.push(Math.round(t)); }
    const S = [...new Set(presses)].sort((a, b) => a - b);
    const Gs = groupSeconds(cfg);
    const outside = S.filter(t => !Gs.has(t));
    tally[S.length] = (tally[S.length] || 0) + 1;
    /* ★ A SECOND OUTSIDE `G` HAS TWO POSSIBLE CAUSES AND THEY POINT IN OPPOSITE DIRECTIONS:
         · the generator is incomplete   → G needs another rule, and the enumeration would MISS the argmax
         · the SEARCH settled off-lattice → the emitted plan is not the argmax, and G may be fine
       Telling them apart needs no extra machinery: if the plan is not even a local optimum, the second
       cause is live and the first is unproven. So probe it here rather than reporting an ambiguous ⛔. */
    let localOpt = null;
    if (outside.length && api.rankPair && api.planBetter) {
      const rep = x => api.repair(JSON.parse(JSON.stringify(x)), cfg);
      const basePair = api.rankPair(rep(best.s), cfg);
      const coords = [];
      for (const k of Object.keys(best.s).sort()) { if (cfg.fixed && cfg.fixed[k]) continue;
        best.s[k].forEach((_, i) => coords.push([k, i])); }
      const D = [-3, -2, -1, 1, 2, 3];
      let beat = false;
      const walk = (start, depth, acc) => {
        if (beat) return;
        if (acc.length) {
          const cand = JSON.parse(JSON.stringify(best.s));
          let ok = true;
          for (const [ci, d] of acc) { const [k, i] = coords[ci]; const t = Math.round(cand[k][i]) + d;
            if (t < 0 || t > cfg.T - 1) { ok = false; break; } cand[k][i] = t; }
          if (ok) { const r = rep(cand);
            if (JSON.stringify(r) === JSON.stringify(cand) && api.planBetter(api.rankPair(r, cfg), basePair)) beat = true; }
        }
        if (depth === 3) return;
        for (let c = start; c < coords.length; c++) for (const d of D) walk(c + 1, depth + 1, [...acc, [c, d]]);
      };
      walk(0, 0, []);
      localOpt = !beat;
    }
    const verdict = !outside.length ? `✓ all ${Gs.size} derivable`
      : `⛔ ${outside.join(',')} outside G` + (localOpt === false ? ' — but the plan is NOT a local optimum (SEARCH, not G)'
                                            : localOpt === true ? ' — plan IS a local optimum, so G is genuinely incomplete' : '');
    console.log(`  ${kitName.padEnd(22)} ${String(h).padStart(4)}   ${String(presses.length).padStart(6)}  ${String(S.length).padStart(3)}  ` +
      `[${S.join(', ')}]`.padEnd(28) + `  ${verdict}`);
  }
}
const keys = Object.keys(tally).map(Number).sort((a, b) => a - b);
console.log(`\n  |S| distribution: ${keys.map(k => `${k}→${tally[k]}`).join('  ')}`);
console.log(`  max |S| = ${Math.max(...keys)}   ${Math.max(...keys) <= 3
  ? '— the ≤3 collapse HOLDS across this sweep'
  : '— ⚠ the ≤3 collapse is BROKEN here; PHASE13 §3 must size its enumeration for the larger |S|'}`);
