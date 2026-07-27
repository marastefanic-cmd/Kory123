// THE AURA-STATE WALK — decompose a duel into "which buff state gained casts, and what was a cast
// worth there", from combat logs you already have. NO EXTRA SIM RUNS.
//
//   node tools/duel-walk.mjs --log-a A.log --log-b B.log [--json]
//   RUNNER=…/runner-ap180 node tools/duel-walk.mjs --spec-a '{…}' --spec-b '{…}' \
//        --T 229 --haste 70 --kit isc,mqg [--targets N]
//
// ── WHY THIS IS THE CHEAPEST INSTRUMENT IN THE PROJECT ────────────────────────────────────────────
// When two plans differ in the sim and you want to know WHY, the instinct is to run more sims. Don't.
// The two `SIMLOG=1` logs captured for the legality check already contain the answer. Walk the
// `Aura gained` / `Aura faded` stream, label every damaging cast with the set of watched buffs up at
// that moment, then pool observed damage **per state across BOTH logs** and read
//
//     Δdamage  ≈  Σ_states (count_B − count_A) × pooled_damage_per_cast(state)
//
// Two properties make it strong, and both are why it beats another A/B campaign:
//   · **Crit variance cancels.** The states are identical between the arms; only the counts differ, and
//     the per-cast value is pooled over both arms' observations of that state.
//   · **It assumes nothing.** No coefficients, no amp curves, no stacking order — pure observed damage.
// On P7.14 (PHASE7 §5.18, RULES §9 Correction 3) it closed a 0.29 pp deficit to **102.6 %** at zero
// additional sim cost, after five sim campaigns had been pre-registered to attack the same question.
//
// ⚠ Until 2026-07-27 this instrument existed only as PROSE in TOOLING plus a pointer at
// `$SP/aoewin/walk.mjs` — a session-scratchpad path that no longer exists (PHASE12 §3.6, same story as
// `tools/press-verify.mjs`). Rebuilt from the method description.
//
// ── THE THREE CHOICES THIS MAKES, ALL OF WHICH CHANGE THE ANSWER ──────────────────────────────────
// 1. **The state is read at the DAMAGE event, not at cast start.** wowsims applies damage modifiers
//    when the cast completes (visible in the `[DEBUG] … SP:` line, which shows the 4pc proc arriving
//    mid-plan), so that is the moment the buff set actually priced the cast. The label only has to be
//    *consistent* between the arms for the pooling to work, but consistent-and-correct is better.
// 2. **High-churn auras are EXCLUDED from the state label by default** — the Arcane Blast stack,
//    Clearcasting, and the Tirisfal 4pc proc. They toggle every few casts and would shatter the state
//    space into singletons, which defeats pooling (a state observed once has no pooled value). They are
//    printed, not hidden, and `--watch-all` puts them back.
// 3. **Auras already up at t = 0 are excluded** — raid buffs, equip auras, permanent talents. They are
//    in every state and so carry no information, and an equipped trinket's t=0 `ItemID` aura would
//    otherwise masquerade as a press (press-verify's log-format fact 4).
//
// Exit-code contract: 0 = walked and reported · 2 = could not walk. There is no verdict to fail;
// this instrument EXPLAINS a difference, it does not grade one.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { build } from './genapl-core.mjs';
import { REQUIRES_EQUIPPED } from '../sim/planspec.mjs';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const die = (m) => { console.error(`ERROR: ${m}`); process.exit(2); };
const argv = process.argv.slice(2);
const flag = (n, d = null) => {
  const i = argv.indexOf(`--${n}`);
  if (i < 0) return d;
  const v = argv[i + 1];
  if (v === undefined || v.startsWith('--')) die(`--${n} needs a value`);
  return v;
};
const has = (n) => argv.includes(`--${n}`);

// Excluded from the state label by default — see choice 2 above.
// ⚠ `Sated` (57724) is here for a DIFFERENT reason than the rest, and it matters: it is not churn, it
// is a permanent marker with **no combat effect** that appears the moment Bloodlust is pressed and never
// fades. Left in the label it splits "before Lust" from "after Lust ended" — two states whose casts are
// mechanically identical — and those are exactly the casts pooling most needs to merge. Bloodlust's own
// 40 s window is still labelled, by its own aura (2825).
const CHURN = new Set(['{SpellID: 36032}', '{SpellID: 12536}', '{SpellID: 37444}', '{SpellID: 37445}',
  '{SpellID: 57724}']);
const CHURN_NAME = { '{SpellID: 36032}': 'Arcane Blast stack', '{SpellID: 12536}': 'Clearcasting',
  '{SpellID: 37444}': 'Tirisfal 4pc +70 SP proc', '{SpellID: 37445}': 'Serpent-Coil +225 SP proc',
  '{SpellID: 57724}': 'Sated (inert marker)' };

// ── inputs: two logs, or two specs we run ourselves ──────────────────────────────────────────────
let logA = flag('log-a'), logB = flag('log-b'), label = 'A vs B';
if (flag('spec-a') || flag('spec-b')) {
  if (logA || logB) die('pass --log-a/--log-b OR --spec-a/--spec-b, not both');
  const RUNNER = process.env.RUNNER || '';
  if (!RUNNER) die('running the arms needs RUNNER=<path to runner-ap180> — the committed sim/sim.wasm\n' +
    '       exposes no combat log. Or produce two SIMLOG=1 logs yourself and pass --log-a/--log-b.');
  if (!fs.existsSync(RUNNER)) die(`RUNNER does not exist: ${RUNNER}`);
  const T = flag('T') || die('need --T');
  const KIT = flag('kit') || die('need --kit a,b (a press of an unworn trinket is a silent no-op)');
  const byTrinket = Object.fromEntries(Object.values(REQUIRES_EQUIPPED).map(v => [v.trinket, v]));
  const pair = KIT.split(',').map(s => s.trim());
  if (pair.length !== 2 || pair.some(k => !byTrinket[k])) die(`--kit must be two of ${Object.keys(byTrinket).join(',')}`);
  const exp = JSON.parse(fs.readFileSync(path.join(REPO, 'tools/bench/export.json'), 'utf8'));
  exp.player.equipment.items[12] = { id: byTrinket[pair[0]].item };
  exp.player.equipment.items[13] = { id: byTrinket[pair[1]].item };
  const tmp = process.env.TMPDIR || '/tmp';
  const expPath = path.join(tmp, `duel-walk-${process.pid}.export.json`);
  fs.writeFileSync(expPath, JSON.stringify(exp));
  const runArm = (name, specRaw) => {
    let spec; try { spec = JSON.parse(specRaw); } catch (e) { die(`--spec-${name} is not JSON: ${e.message}`); }
    const aplPath = path.join(tmp, `duel-walk-${process.pid}.${name}.apl.json`);
    const out = path.join(tmp, `duel-walk-${process.pid}.${name}.log`);
    fs.writeFileSync(aplPath, JSON.stringify(build(spec)));
    const args = ['--export', expPath, '--apl', aplPath, '--dur', String(T), '--var', '0', '--iter', '1',
      '--seed', flag('seed', '11'), '--mana', '100000000', '--haste', flag('haste', '0'), '--quiet'];
    if (flag('targets')) args.push('--targets', flag('targets'));
    // ⚠ SIMLOG streams to STDERR. Capture both or the walk reads an empty log while it floods the term.
    try {
      execFileSync(RUNNER, args, { env: { ...process.env, SIMLOG: '1' }, encoding: 'utf8',
        maxBuffer: 1 << 28, stdio: ['ignore', fs.openSync(out, 'w'), fs.openSync(out, 'a')] });
    } catch { /* exit code is irrelevant; the log is the product */ }
    return out;
  };
  logA = runArm('a', flag('spec-a') || die('need --spec-a'));
  logB = runArm('b', flag('spec-b') || die('need --spec-b'));
  label = `${path.basename(logA)} vs ${path.basename(logB)}  (T=${T}, kit=${KIT}, haste=${flag('haste', '0')})`;
  console.log(`# ran both arms → ${logA} · ${logB}`);
}
if (!logA || !logB) die('need --log-a and --log-b (or --spec-a/--spec-b with RUNNER set)');

// ── the walk ─────────────────────────────────────────────────────────────────────────────────────
const AURA = /^\[\s*([\d.]+)\]\s+\[Player \(#\d+\)\]\s+Aura (gained|faded):\s+(\{[^}]*\})/;
const DMG = /^\[\s*([\d.]+)\]\s+\[Player \(#\d+\)\]\s+\[[^\]]+\]\s+\{[^}]*\}\s+(?:Crit|Hit) for ([\d.]+) damage/;

function walk(file) {
  let txt;
  try { txt = fs.readFileSync(file, 'utf8'); } catch (e) { die(`cannot read ${file}: ${e.message}`); }
  if (!txt.trim()) die(`${file} is empty — an empty log must never walk to "no difference"`);
  if (txt.includes('\0')) die(`${file} contains NUL bytes — truncated or concurrently written`);
  const up = new Set();          // aura ids currently up
  const atZero = new Set();      // whatever was already up when the fight began (choice 3)
  const casts = [];              // { t, dmg, state }
  let sawPlayer = false;
  for (const raw of txt.split('\n')) {
    const line = raw.trim();
    const a = AURA.exec(line);
    if (a) {
      sawPlayer = true;
      const t = parseFloat(a[1]);
      if (a[2] === 'gained') { up.add(a[3]); if (t < 0.05) atZero.add(a[3]); }
      else up.delete(a[3]);
      continue;
    }
    const d = DMG.exec(line);
    if (d) { sawPlayer = true; casts.push({ t: parseFloat(d[1]), dmg: parseFloat(d[2]), state: new Set(up) }); }
  }
  if (!sawPlayer) die(`no [Player (#N)] events in ${file} — was SIMLOG=1 set, and is this the runner's output?`);
  if (!casts.length) die(`no damage events in ${file} — nothing to decompose`);
  return { casts, atZero };
}

const A = walk(logA), B = walk(logB);
// Ignored ids are decided ONCE, over both arms, so the two are labelled identically by construction.
const ignored = new Set([...A.atZero, ...B.atZero]);
const churnSeen = new Set();
if (!has('watch-all')) for (const id of CHURN) { churnSeen.add(id); ignored.add(id); }
const key = c => [...c.state].filter(x => !ignored.has(x)).sort().join(' + ') || '(no watched buff)';

const stats = new Map();   // state → { nA, nB, sum, n }
const tally = (arm, { casts }) => {
  for (const c of casts) {
    const k = key(c);
    if (!stats.has(k)) stats.set(k, { nA: 0, nB: 0, sum: 0, n: 0 });
    const s = stats.get(k);
    s[arm === 'A' ? 'nA' : 'nB']++; s.sum += c.dmg; s.n++;
  }
};
tally('A', A); tally('B', B);

const totalA = A.casts.reduce((s, c) => s + c.dmg, 0);
const totalB = B.casts.reduce((s, c) => s + c.dmg, 0);
const measured = totalB - totalA;
const rows = [...stats.entries()].map(([state, s]) => {
  const per = s.sum / s.n;
  return { state, nA: s.nA, nB: s.nB, per, dCount: s.nB - s.nA, dDmg: (s.nB - s.nA) * per, obs: s.n };
}).sort((a, b) => Math.abs(b.dDmg) - Math.abs(a.dDmg));
const explained = rows.reduce((s, r) => s + r.dDmg, 0);
const closure = measured === 0 ? null : 100 * explained / measured;

// ── the PAIRED transition ledger ─────────────────────────────────────────────────────────────────
// ★ WHY A SECOND LEDGER EXISTS, and read this before trusting the first one.
// The pooled ledger above assumes the casts that MIGRATE between states are drawn from the same
// population as that state's other casts. That is true when a state is well-populated with
// interchangeable casts (P7.14's 37 Arcane Explosions inside one AoE window — the case the method was
// invented on) and FALSE in general: an Arcane Blast's damage depends on its stack and on the fight's
// ramp, so "the average no-buff cast" includes cheap opener casts that a migrating mid-fight cast is
// nothing like. Measured: moving Icon out of a plan entirely gives the right SHAPE (12 casts migrate
// Icon → no-buff) at ~1.9× the right SIZE.
// When both arms cast the same NUMBER of times — the common case under CRN with the same seed and no
// haste change — cast `i` is the same cast in both fights, at nearly the same second and stack. Then
// Σ_i (dmg_B[i] − dmg_A[i]), grouped by the state TRANSITION that cast made, is exact by construction
// and needs no pooling assumption at all. It closes to 100.0 % identically.
let paired = null;
if (A.casts.length === B.casts.length) {
  const m = new Map();
  for (let i = 0; i < A.casts.length; i++) {
    const from = key(A.casts[i]), to = key(B.casts[i]);
    if (from === to && Math.abs(B.casts[i].dmg - A.casts[i].dmg) < 1e-9) continue;
    const k = `${from}  →  ${to}`;
    if (!m.has(k)) m.set(k, { n: 0, d: 0 });
    const s = m.get(k); s.n++; s.d += B.casts[i].dmg - A.casts[i].dmg;
  }
  paired = [...m.entries()].map(([transition, s]) => ({ transition, casts: s.n, dDmg: s.d }))
    .sort((a, b) => Math.abs(b.dDmg) - Math.abs(a.dDmg));
}

if (has('json')) {
  console.log(JSON.stringify({ logA, logB, totalA, totalB, measured, explained, closure, rows, paired,
    ignored: [...ignored] }, null, 2));
  process.exit(0);
}
console.log(`\n# aura-state walk — ${label}`);
console.log(`  A: ${A.casts.length} damaging casts, ${totalA.toFixed(0)} damage`);
console.log(`  B: ${B.casts.length} damaging casts, ${totalB.toFixed(0)} damage`);
console.log(`  excluded from the state label: ${[...churnSeen].map(i => CHURN_NAME[i] || i).join(', ') || '(none)'}` +
  ` · plus ${[...ignored].length - churnSeen.size} aura(s) already up at t=0` +
  `${has('watch-all') ? '' : '   (--watch-all to keep the churn ones)'}\n`);
console.log('| buff state at the damage event | casts A | casts B | Δ | pooled dmg/cast | Δ damage |');
console.log('|---|---|---|---|---|---|');
for (const r of rows) {
  if (!r.dCount && Math.abs(r.dDmg) < 1e-9) continue;
  console.log(`| ${r.state} | ${r.nA} | ${r.nB} | ${r.dCount >= 0 ? '+' : ''}${r.dCount} | ` +
    `${r.per.toFixed(1)}${r.obs < 3 ? ' ⚠' : ''} | ${r.dDmg >= 0 ? '+' : ''}${r.dDmg.toFixed(0)} |`);
}
console.log('');
console.log(`  measured  Δdamage (B − A) : ${measured >= 0 ? '+' : ''}${measured.toFixed(0)}`);
console.log(`  explained by the ledger   : ${explained >= 0 ? '+' : ''}${explained.toFixed(0)}` +
  (closure === null ? '' : `   ⇒ closure ${closure.toFixed(1)} %`));
if (rows.some(r => r.dCount && r.obs < 3))
  console.log('  ⚠ a state marked ⚠ was observed fewer than 3 times across BOTH arms — its pooled\n' +
    '    per-cast value is one or two samples, so crit has not cancelled there. Treat that row as\n' +
    '    a pointer, not a quantity (--watch-all makes this worse, not better).');
if (closure !== null && (closure < 80 || closure > 120))
  console.log('  ⚠ closure is far from 100 %. Two causes, and they need different responses:\n' +
    '    (a) the migrating casts are not interchangeable with the state\'s other casts (stack/ramp\n' +
    '        position confounds the pooled value) — use the PAIRED ledger below, which is exact; or\n' +
    '    (b) a real effect that is not a change in which buffs were up at all — a cast-count change\n' +
    '        from haste, a truncated tail, an AoE phase. Compare the two cast counts above first.');

if (paired) {
  console.log('\n## PAIRED transition ledger — exact, no pooling assumption (both arms cast the same number)');
  console.log('| cast made this state transition | casts | Δ damage |');
  console.log('|---|---|---|');
  for (const p of paired) console.log(`| ${p.transition} | ${p.casts} | ${p.dDmg >= 0 ? '+' : ''}${p.dDmg.toFixed(0)} |`);
  const tot = paired.reduce((s, p) => s + p.dDmg, 0);
  console.log(`\n  paired total : ${tot >= 0 ? '+' : ''}${tot.toFixed(0)}   vs measured ${measured >= 0 ? '+' : ''}${measured.toFixed(0)}` +
    `   ⇒ closure ${measured === 0 ? 'n/a' : (100 * tot / measured).toFixed(1) + ' %'}`);
  console.log('  ⚠ A row whose two sides are the SAME state is a cast that changed VALUE without changing\n' +
    '    which buffs were up — crit noise, a different stack, or a different SP proc. Those rows are the\n' +
    '    instrument\'s own noise floor: if they dominate, the duel is not decided by buff placement.');
} else {
  console.log('\n  (no paired ledger: the arms cast different numbers of times, so cast i is not the same\n' +
    '   cast in both fights. That difference is itself the headline — read the cast counts above.)');
}
