// Build the wowsims `RaidSimRequest` for a gear-agnostic model duel.
//
// It does NOT hand-assemble the request. It patches `model-ref-request.json`, which is the runner's
// OWN `--dumpreq` output for `model-ref.json` — so the request the PAGE sends into the WASM sim is
// byte-for-byte the request the TERMINAL runner builds, minus the fields a duel varies (rotation,
// duration, targets, iterations, seed, injected stats). Hand-assembling it was tried first and got the
// raid proto wrong (`debuffs` lives inside `raid`, a party carries `buffs` not `bonuses`) — exactly
// the class of silent mismatch that would make the button verify something else entirely.
// `tests/sim-request.mjs` regenerates the template from the export and fails if the two drift.
//
// ── WHY GEAR-AGNOSTIC ─────────────────────────────────────────────────────────────────────────────
// The planner asks for four numbers (spell damage, crit, haste rating, fight length) and deliberately
// knows nothing else about your character, so the verification runs on a FIXED synthetic mage —
// `model-ref.json`: no gear, no consumes, no raid buffs, standard Arcane raid talents — with your
// three stats injected as flat bonuses on top. Consequences, and they matter:
//
//   • The ABSOLUTE DPS is not your DPS and is not meant to be. Only the A-vs-B DIFFERENCE is
//     meaningful, and that is the only thing the UI reports.
//   • Both arms run the identical character and the identical seed (common random numbers), so the
//     paired difference is far better resolved than either absolute number (TOOLING).
//   • Spell hit is pinned at the 16% cap in the reference character's bonusStats (202 rating at
//     12.615/1%, vs a level-73 target). A 1% miss floor is irreducible in this engine; it cancels.
//   • Mana is effectively infinite (`MANA_INJECT`), matching the model's infinite-mana assumption.
//   • Duration variation is 0.5s — the model's kill-window WIDTH (RULES §8). Never 0: `--var 0`
//     quantizes to integer casts and has faked a result twice (TOOLING ★★).
//   • The APL opens COLD (`_prestack: 0`, genapl's default). Never prepull in a model-compared sim.

export const STAT = { intellect: 3, spellDamage: 5, spellHit: 12, spellCrit: 13, spellHaste: 14, spirit: 16, mana: 34, mp5: 35 };
export const CRIT_RATING_PER_PCT = 22.08;      // wowsims TBC SpellCritRatingPerCritChance
export const HASTE_RATING_PER_PCT = 15.76923;  // wowsims SpellHasteRatingPerHastePercent (model: 15.77)
export const HIT_RATING_PER_PCT = 12.615385;   // wowsims SpellHitRatingPerHitPercent
export const HIT_CAP_PCT = 16;                 // vs level 73 (17% base miss, 1% irreducible floor)
export const MANA_INJECT = 1e8;                // "infinite" — the model does not simulate mana
export const DEFAULT_VAR = 0.5;
export const DEFAULT_SEED = 11;

const clone = o => JSON.parse(JSON.stringify(o));

// template: the parsed model-ref-request.json (callers load it; node via import assertion, the page
// via fetch, so this module stays environment-free).
// opts: { sp, critPct, hasteRating, T, iterations, seed, variation, targets, apl }
export function buildRequest(template, opts) {
  const req = clone(template);
  const player = req.raid.parties[0].players[0];

  // stat injection — mirrors runner-main.go's `bonusStats[idx] += flag`, on top of the reference
  // character's own hit-cap entry.
  const stats = player.bonusStats.stats;
  while (stats.length <= STAT.mp5) stats.push(0);
  const add = (idx, v) => { if (v) stats[idx] += v; };
  add(STAT.spellDamage, opts.sp || 0);
  add(STAT.spellHaste, opts.hasteRating || 0);
  add(STAT.spellCrit, (opts.critPct || 0) * CRIT_RATING_PER_PCT);
  add(STAT.mana, MANA_INJECT);

  if (opts.apl) {
    player.rotation.type = "TypeAPL";
    player.rotation.prepullActions = opts.apl.prepullActions || [];
    player.rotation.priorityList = opts.apl.priorityList || [];
  }

  req.encounter.duration = opts.T;
  req.encounter.durationVariation = opts.variation === undefined ? DEFAULT_VAR : opts.variation;
  // AoE: duplicate target[0] to N (runner-main.go --targets). Arcane Blast is single-target, so the
  // extra dummies are inert outside the Arcane Explosion windows.
  if (opts.targets > 1) {
    const base = req.encounter.targets[0];
    req.encounter.targets = [base];
    while (req.encounter.targets.length < opts.targets) req.encounter.targets.push(clone(base));
  }

  req.simOptions.iterations = opts.iterations;
  req.simOptions.randomSeed = String(opts.seed === undefined ? DEFAULT_SEED : opts.seed);
  return req;
}

// Mean DPS out of a RaidSimResult (protojson) — the same field the runner reads for its TSV.
export function dpsOf(result) {
  const p = result?.raidMetrics?.parties?.[0]?.players?.[0];
  if (!p || !p.dps) return null;
  return { avg: +p.dps.avg, stdev: +p.dps.stdev || 0 };
}
