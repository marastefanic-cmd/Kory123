// THE END-TO-END AUDIT — does the model's entire cast-by-cast account match a real combat log?
//
//   RUNNER=… node tools/model-audit.mjs [--preset "2:00 lust 0:05"] [--all] [--show 12]
//
// ── WHY THIS, WHEN THERE ARE ALREADY FOUR GATES ──────────────────────────────────────────────────
// `window-span`, `credit-check`, `press-fire` and `lattice-drift` each check ONE thing on a
// purpose-built one-press fight. Every scoring bug this phase found was invisible to some of them and
// visible to none until it was looked for specifically — and two of them CANCELLED, so a narrow probe
// passed on a broken engine. This is the wide check: take a plan the tool actually emits, run it, and
// compare **everything the model claims, cast for cast**.
//
// ── WHAT IS CHECKABLE, AND WHAT IS NOT ───────────────────────────────────────────────────────────
// Deterministic and therefore checked, per Arcane Blast:
//   · the cast COUNT
//   · each cast's START time                     — the lattice
//   · each cast's CAST TIME                      — the haste snapshot (fixed at cast start)
//   · the SPELL POWER the cast used              — the value snapshot (read at cast completion)
//   · the DAMAGE MULTIPLIER the cast got         — Arcane Power, Tirisfal 2pc
//
// NOT checkable and deliberately not compared: the per-cast base-damage ROLL (668–772, a real RNG draw
// even at `--var 0`) and crit (a constant factor that cancels out of "effective ABs" by construction —
// CLAUDE.md's objective). The multiplier is recovered as `AfterAttackerMods / BaseDamage`, which
// divides the roll out.
//
// ⚠ ONE KNOWN, LOGGED DIFFERENCE IS SUBTRACTED, NOT IGNORED: the bench character wears Tirisfal 4pc,
// whose +70 SP proc (`SpellID: 37444`) the model does not schedule — it is a proc, and RULES §14 says
// procs are counted, never planned. Its windows are read out of the log and removed from the sim's SP
// before comparing, so the audit tests the model's own claims rather than punishing it for a proc it
// deliberately does not model. Anything else that differs is a real disagreement.
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { loadEngine, cfgFor } from './engine-node.mjs';
import { REF } from './reference-gear.mjs';
import { planToSpec } from '../sim/planspec.mjs';
import { build } from './genapl-core.mjs';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const RUNNER = process.env.RUNNER || '/tmp/wowsims-build/tbc-new/runner-ap180';
const argv = process.argv.slice(2);
const flag = (n, d) => { const i = argv.indexOf(`--${n}`); return i < 0 ? d : argv[i + 1]; };
const has = n => argv.includes(`--${n}`);
if (!fs.existsSync(RUNNER)) {
  console.log('# model-audit — SKIPPED LOUDLY: no RUNNER.');
  console.log('  The committed sim/sim.wasm exposes no combat log, and this audit IS a log walk.');
  console.log('  Re-run with RUNNER=<path to runner-ap180> (docs/TOOLING.md "Building the runner").');
  process.exit(0);
}
const api = loadEngine(process.env.ENGINE || path.join(REPO, 'index.html'));
const SHOW = +flag('show', '10');
const T5_PROC_SP = 70;     // Tirisfal 4pc, SpellID 37444 — logged, and subtracted (see header)

const picked = has('all') ? api.cases
  : api.cases.filter(c => c.name === flag('preset', '2:00 lust 0:05'));
if (!picked.length) { console.error(`no such preset — try --all or one of:\n  ${api.cases.map(c => c.name).join('\n  ')}`); process.exit(2); }

let failures = 0, audited = 0;
for (const kase of picked) {
  // ★★ THE MODEL MUST DESCRIBE THE CHARACTER THE SIM RUNS. `cfgFor` gives the PRESET's gear; the sim
  // below runs `tools/bench/export.json`. Spreading REF moves the model onto that character, exactly
  // as `tools/bench.mjs` does — reference-gear.mjs's whole reason for existing.
  // ⚠ Skipping this is not a small error and it is not hypothetical: it is PHASE8 §6/§7's recorded
  // defect, and it cost this audit an hour. Without REF the model ran with `t5two: false` against a
  // character wearing Tirisfal 2pc, so every cast's damage multiplier looked wrong by exactly the 2pc,
  // and Arcane Power looked like ×1.25 in the sim against the model's ×1.30. Both were artefacts.
  const cfg = { ...cfgFor(api, kase), ...REF };
  const best = await api.optimizeAsync(cfg, 3, () => {});
  const optR = api.simulate(best.s, cfg, true);
  const A = planToSpec({ cfg, best, optR }, api.BUFFS);
  if (A.burn) { console.log(`  SKIP  ${kase.name} — burn phase, not simmable`); continue; }
  if (A.skipped.length) { console.log(`  SKIP  ${kase.name} — untranscribable: ${A.skipped.join(', ')}`); continue; }

  const apl = `/tmp/audit-${kase.name.replace(/\W+/g, '_')}.json`, log = apl + '.log';
  fs.writeFileSync(apl, JSON.stringify(build(A.spec)));
  const args = ['--export', path.join(REPO, 'tools/bench/export.json'), '--apl', apl,
    '--dur', String(cfg.T), '--var', '0', '--iter', '1', '--seed', '11',
    '--mana', '100000000', '--haste', String(cfg.hasteRating), '--quiet'];
  if (A.targets) args.push('--targets', String(A.targets));
  try {
    execFileSync(RUNNER, args, { env: { ...process.env, SIMLOG: '1' }, maxBuffer: 1 << 28,
      stdio: ['ignore', fs.openSync(log, 'w'), fs.openSync(log, 'a')] });
  } catch { /* the log is the instrument */ }
  const txt = fs.readFileSync(log, 'utf8');

  // ── the sim's own account ──────────────────────────────────────────────────────────────────────
  // ⚠ LOG-FORMAT FACT (add it to TOOLING's list): durations are Go's `Duration.String()`, so the UNIT
  // CHANGES with the magnitude — `Cast Time = 2.083s` but `Cast Time = 960ms, GCD = 1s` once the value
  // drops under a second. A regex anchored on `([0-9.]+)s` silently matches only the slow casts: on a
  // Lust plan it found 72 of 94 and dropped exactly the fast ones, i.e. the casts a haste audit is
  // most about. Parse the unit.
  const dur = (v, u) => +v * (u === 'ms' ? 0.001 : 1);
  const casts = [...txt.matchAll(/\[\s*([0-9.]+)\]\s*\[Player[^\]]*\] Casting \{SpellID: 30451\}[^\n]*Cast Time = ([0-9.]+)(ms|s)[,)]/g)]
    .map(m => ({ t: +m[1], cast: dur(m[2], m[3]) }));
  const dbg = [...txt.matchAll(/\[\s*([0-9.]+)\][^\n]*\{SpellID: 30451\} \[DEBUG\][^\n]*SP: ([0-9.]+),\s*BaseDamage:([0-9.]+),\s*AfterAttackerMods:([0-9.]+)/g)]
    .map(m => ({ tc: +m[1], sp: +m[2], base: +m[3], after: +m[4] }));
  // the Tirisfal 4pc proc windows, so its +70 SP can be removed
  const gains = [...txt.matchAll(/\[\s*([0-9.]+)\][^\n]*Gained \{"SpellDamage": 70\.000,\} from \{SpellID: 37444\}/g)].map(m => +m[1]);
  const fades = [...txt.matchAll(/\[\s*([0-9.]+)\][^\n]*Aura faded: \{SpellID: 37444\}/g)].map(m => +m[1]);
  const procUp = t => { let n = 0; for (const g of gains) if (g <= t + 1e-9) n++; for (const f of fades) if (f <= t + 1e-9) n--; return n > 0; };

  if (!casts.length || !dbg.length) { console.error(`ERROR: ${kase.name}: no AB casts parsed from ${log}`); process.exit(2); }

  // ── compare, cast for cast ─────────────────────────────────────────────────────────────────────
  // ⚠ COMPARE BUFF DELTAS, NOT ABSOLUTES. The model's `sp` is its declared spell power and `dmgMult`
  // is normalised so 1.0 = no cooldowns; the sim reports the character's real SP and a multiplier that
  // already contains talents and set bonuses. Comparing those raw measures the GEAR CALIBRATION, which
  // is a different question and drowns the one being asked. Each side is therefore referred to its own
  // unbuffed baseline, so what is graded is exactly the model's buff accounting.
  const M = optR.casts.filter(c => !c.ae);
  const baseMult = Math.min(...dbg.filter(x => x.base > 0).map(x => x.after / x.base));
  const baseSp = Math.min(...dbg.map(x => x.sp - (procUp(x.tc) ? T5_PROC_SP : 0)));
  const n = Math.min(M.length, casts.length);
  let badT = 0, badCast = 0, badSp = 0, badMult = 0;
  let wT = 0, wC = 0, wS = 0, wM = 0;
  const rows = [];
  for (let i = 0; i < n; i++) {
    const m = M[i], s = casts[i];
    const d = dbg.find(x => Math.abs(x.tc - (s.t + s.cast)) < 0.06) || dbg[i];
    // each side's BUFF contribution, referred to its own unbuffed baseline
    const simSp = d ? d.sp - (procUp(d.tc) ? T5_PROC_SP : 0) - baseSp : null;
    const simMult = d && d.base > 0 ? (d.after / d.base) / baseMult : null;
    const mSp = m.sp - cfg.sp, mMult = m.dmgMult / (cfg.t5two ? 1.2 : 1);
    const dt = Math.abs(s.t - m.t), dc = Math.abs(s.cast - m.castDn);
    const ds = simSp === null ? 0 : Math.abs(simSp - mSp);
    const dm = simMult === null ? 0 : Math.abs(simMult - mMult);
    // the log prints 2 dp for times and 1 dp for SP, so those are the resolution floors
    if (dt > 0.011) badT++;
    if (dc > 0.0011) badCast++;
    if (ds > 0.15) badSp++;
    if (dm > 0.002) badMult++;
    if (dt > wT) wT = dt; if (dc > wC) wC = dc; if (ds > wS) wS = ds; if (dm > wM) wM = dm;
    if (rows.length < SHOW) rows.push({ i, m, s, simSp, simMult, mSp, mMult, dt, dc, ds, dm });
  }

  // ⚠ REPORT THE MAGNITUDE, NOT JUST A COUNT AGAINST A THRESHOLD. A count says "17 of 314 casts
  // disagree" whether the disagreement is 12 ms of accumulated rounding or a whole cast — and those
  // need completely different responses. The worst deviation per column is the number that tells you
  // which.
  const countOk = M.length === casts.length;
  const ok = countOk && !badT && !badCast && !badSp && !badMult;
  if (!ok) failures++;
  audited++;
  console.log(`\n${ok ? 'PASS' : 'FAIL'}  ${kase.name}  (T=${cfg.T}, ${cfg.hasteRating} haste)`);
  console.log(`      casts: model ${M.length} · sim ${casts.length}${countOk ? '' : '   ⛔ COUNT DIFFERS'}`);
  console.log(`      per-cast mismatches — start ${badT} · cast time ${badCast} · spell power ${badSp} · damage mult ${badMult}   (of ${n})`);
  console.log(`      worst deviation     — start ${wT.toFixed(4)}s · cast ${wC.toFixed(4)}s · SP ${wS.toFixed(1)} · mult ${wM.toFixed(4)}`);
  if (rows.length) {
    console.log('      i   model t / sim t     model cast / sim   buff SP m/sim      buff mult m/sim');
    for (const r of rows) console.log(
      `      ${String(r.i).padStart(2)}  ${r.m.t.toFixed(3).padStart(8)} ${r.s.t.toFixed(2).padStart(8)}   ` +
      `${r.m.castDn.toFixed(3).padStart(7)} ${r.s.cast.toFixed(3).padStart(7)}   ` +
      `${r.mSp.toFixed(1).padStart(7)} ${(r.simSp === null ? NaN : r.simSp).toFixed(1).padStart(8)}   ` +
      `${r.mMult.toFixed(3).padStart(7)} ${(r.simMult === null ? NaN : r.simMult).toFixed(3).padStart(7)}`);
  }
}

console.log('');
if (failures) {
  console.log(`✗ ${failures} of ${audited} audited fight(s) disagree with the sim.`);
  console.log('  Read the column that failed: START is the cast lattice (MECHANICS §1.1), CAST TIME is');
  console.log('  the haste snapshot, SPELL POWER and DAMAGE MULT are the value snapshot read at cast');
  console.log('  COMPLETION (PHASE12 §6.12). Those are three different fixes — do not guess which.');
  process.exit(1);
}
console.log(`✓ ${audited} fight(s): the model's cast count, cast lattice, cast times, spell power and`);
console.log('  damage multipliers all match wowsims cast for cast.');
process.exit(0);
