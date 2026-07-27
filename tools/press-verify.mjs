// THE PRESS VERIFIER — did the sim actually press what the spec told it to, and WHEN?
//
//   node tools/press-verify.mjs --spec '{"IV":[8,39],"AP":[8],"BL":[7],"Icon":[8]}' --log /tmp/pv.log
//   node tools/press-verify.mjs --spec-file s.json --log l.log [--json]
//   RUNNER=/path/to/runner-ap180 node tools/press-verify.mjs --spec '{…}' --run --dur 60 --haste 0
//   … --fire '{"IV":[9.15,39.2],…}' [--fire-tol 0.15]     ← grades WHEN, not just WHETHER
//
// ── WHY THIS EXISTS ───────────────────────────────────────────────────────────────────────────────
// `docs/TOOLING.md` calls walking the combat log "the cheapest instrument in the project", and it is:
// every expensive mistake this project has made about the sim was a press that did not happen, or
// happened somewhere other than where the model scored it —
//
//   · the `APLActionSchedule` DROP BUG (TOOLING ★): a press whose cooldown is not ready is silently
//     skipped, so an arm sims as if that cooldown were never in the plan;
//   · the SHARED TRINKET LOCKOUT (TOOLING ★): the sim RETIMES an illegal press instead of rejecting
//     it, so two different specs can be the same experiment and duel to Δ = 0.000;
//   · an UNWORN trinket (PHASE12 §2.1): the press is a bit-identical no-op, and a no-op does not read
//     as an error — it reads as a small honest number;
//   · PRESS-SNAP (RULES §3): a press scheduled at 8 fires at the next cast boundary, 9.15 here.
//
// Every one of those is one grep away, and every one of them cost days because nobody grepped.
//
// ── ★ AND THE ONE IT DID NOT COVER UNTIL 2026-07-27: *WHEN* ───────────────────────────────────────
// Until `--fire` existed this tool graded only that a press HAPPENED. PHASE12 §6.7 put it plainly:
// "no gate in this repo covers press-fire timing — which is exactly why it survived this long". What
// survived was `sim/planspec.mjs` emitting `Math.floor(actEff)`, which put **26.7 % of the corpus's
// presses on a cast the model never chose** (`tools/press-exposure.mjs`) — 1.5 % a full cast early,
// and 25.2 % on a boundary where a millisecond of lattice offset decided the answer.
//
// `--fire` takes the expected fire times that `planToSpec` now returns beside the spec, and grades
// each press against the one it was paired with. A press that fires at the wrong cast is a FAILURE
// (exit 1), the same as one that never fired — because a duel whose arms are buffed on different
// casts is not a duel.
//
// ★ GRADE ON THE CAST, NOT ON THE CLOCK. The model's cast grid and wowsims' are not the same grid:
// wowsims takes 334 ms per Arcane Blast stack where the model takes 1/3 s, and rounds every cast to
// the millisecond (`tools/lattice-drift.mjs`). A bare stream drifts 80 ms over 300 s; a plan with
// haste buffs in it drifts ~0.35 s by t=200, because every buff re-quantizes the interval. So a press
// can land on exactly the right CAST while its wall-clock time is a third of a second off — and a
// clock-tolerance verdict would call that a failure and send the next reader hunting a bug that is
// not there.
//
// So `--cast` (the model's cast INDEX per press, which `planToSpec` returns beside the spec) is the
// verdict, and it is drift-proof: this tool reads the sim's OWN cast stream out of the log and checks
// the press landed in the interval ending at that cast. `--fire`/`--fire-tol` stay as the REPORT —
// the printed `off` column is then a measurement of the lattice, which is worth seeing. With `--fire`
// but no `--cast`, the clock tolerance is the verdict, which is the weaker grading.
//
// ⚠ Until 2026-07-27 this instrument existed only as PROSE in TOOLING plus a pointer at
// `$SP/p8/r6verify.mjs` — a session-scratchpad path that no longer exists anywhere. The log-format
// facts were written out beside that pointer, so the tool was rebuilt from the doc (PHASE12 §3.6).
//
// ── THE LOG-FORMAT FACTS (all verified against a real log; all easy to get wrong) ─────────────────
// 1. Player lines carry a SOURCE PREFIX: `[  9.15] [Player (#1)] Casting {SpellID: 12042} (…)`.
//    A grep without the prefix also matches pet and raid lines.
// 2. **Bloodlust has no `Casting` line at all** — it is applied *to* the player, so it appears only as
//    `Aura gained: {SpellID: 2825, Tag: -1}`. **Cold Snap has no aura** — only a `Casting` line.
//    So a press verifier must union both event kinds.
// 3. On-use TRINKETS log by **ItemID**, not by the spell they grant: `Casting {ItemID: 29370}`.
// 4. ⚠ An equipped trinket can also emit `Aura gained: {ItemID: …}` at **t = 0** — that is the equip,
//    not a press. Hence the rule below: auras are only consulted for an ActionID that produced *no*
//    cast events at all, and a t≈0 aura is refused unless the intent is itself t≈0.
// 5. Match the WHOLE brace group (`{SpellID: 2825, Tag: -1}`), not the bare number. `2825` is a prefix
//    of `28250`, and a bare-number match silently lands in the t=0 raid-buff block. Matching the
//    closing brace makes the trailing-digit guard automatic.
//
// ── HOW IT LEARNS THE IDs (it does not retype them) ───────────────────────────────────────────────
// CLAUDE.md: never retype a protocol constant into a new instrument. So the ActionID for each spec
// key is READ OUT OF `tools/genapl-core.mjs` by building a one-key APL and looking at what it emitted.
// If genapl's table ever changes, this tool follows it with no edit.
//
// Exit-code contract (shared with every instrument here):
//   0 = every intended press fired, and (with --fire) fired when it was supposed to
//   1 = graded and at least one press DROPPED or MISTIMED
//   2 = could not grade.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { build, TIME_KEYS, CAST_STREAM_IDS } from './genapl-core.mjs';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const die = (msg) => { console.error(`ERROR: ${msg}`); process.exit(2); };

// ── argv ─────────────────────────────────────────────────────────────────────────────────────────
const argv = process.argv.slice(2);
const flag = (name, dflt = null) => {
  const i = argv.indexOf(`--${name}`);
  if (i < 0) return dflt;
  const v = argv[i + 1];
  if (v === undefined || v.startsWith('--')) die(`--${name} needs a value`);
  return v;
};
const has = (name) => argv.includes(`--${name}`);

let specRaw = flag('spec');
const specFile = flag('spec-file');
if (specFile) {
  if (specRaw) die('pass --spec OR --spec-file, not both');
  try { specRaw = fs.readFileSync(specFile, 'utf8'); } catch (e) { die(`cannot read --spec-file: ${e.message}`); }
}
if (!specRaw) die('a spec is required: --spec \'{"IV":[8]}\' or --spec-file <f>\n' +
  '       (a missing spec used to be the silent-exit-0 failure mode of genapl.mjs — never again)');
let spec;
try { spec = JSON.parse(specRaw); } catch (e) { die(`spec is not JSON: ${e.message}`); }
if (!spec || typeof spec !== 'object' || Array.isArray(spec)) die('spec must be a JSON object');

// ── the expected fire times (optional; without them this grades WHETHER, not WHEN) ───────────────
let fireRaw = flag('fire');
const fireFile = flag('fire-file');
if (fireFile) {
  if (fireRaw) die('pass --fire OR --fire-file, not both');
  try { fireRaw = fs.readFileSync(fireFile, 'utf8'); } catch (e) { die(`cannot read --fire-file: ${e.message}`); }
}
let FIRE = null;
if (fireRaw) {
  try { FIRE = JSON.parse(fireRaw); } catch (e) { die(`--fire is not JSON: ${e.message}`); }
  if (!FIRE || typeof FIRE !== 'object' || Array.isArray(FIRE)) die('--fire must be a JSON object');
}
const FIRE_TOL = Number(flag('fire-tol', '0.15'));
if (!Number.isFinite(FIRE_TOL) || FIRE_TOL <= 0) die('--fire-tol must be a positive number of seconds');

let castRaw = flag('cast');
const castFile = flag('cast-file');
if (castFile) {
  if (castRaw) die('pass --cast OR --cast-file, not both');
  try { castRaw = fs.readFileSync(castFile, 'utf8'); } catch (e) { die(`cannot read --cast-file: ${e.message}`); }
}
let CAST = null;
if (castRaw) {
  try { CAST = JSON.parse(castRaw); } catch (e) { die(`--cast is not JSON: ${e.message}`); }
  if (!CAST || typeof CAST !== 'object' || Array.isArray(CAST)) die('--cast must be a JSON object');
}

// ── the ActionID table, LEARNED from genapl-core (never retyped) ─────────────────────────────────
// One-key build per key; find the schedule action it emitted and read its inner ActionID back out.
function actionIdFor(key) {
  let apl;
  try { apl = build({ [key]: [1] }); } catch { return null; }
  for (const entry of apl.priorityList || []) {
    const s = entry?.action?.schedule;
    if (!s) continue;
    if (String(s.schedule).trim() !== '1s') continue;
    return s.innerAction?.castSpell?.spellId ?? null;
  }
  return null;
}
// `{spellId, tag}` / `{itemId}` → the exact brace group the log prints.
function braceGroup(id) {
  if (!id) return null;
  if (id.itemId !== undefined) return `{ItemID: ${id.itemId}}`;
  if (id.spellId === undefined) return null;
  return id.tag !== undefined ? `{SpellID: ${id.spellId}, Tag: ${id.tag}}` : `{SpellID: ${id.spellId}}`;
}

const PRESS_KEYS = (TIME_KEYS || []).filter(k => Array.isArray(spec[k]) && spec[k].length);
const unknown = Object.keys(spec).filter(k => !k.startsWith('_') && !(TIME_KEYS || []).includes(k));
if (unknown.length) die(`unknown spec key(s): ${unknown.join(', ')} — known: ${(TIME_KEYS || []).join(', ')}\n` +
  '       (a dropped-in-silence unknown key is genapl.mjs\'s recorded worst defect; refused here too)');
if (!PRESS_KEYS.length) die('the spec schedules no presses — nothing to verify');
// A --fire that does not line up with the spec grades the wrong presses against each other, which is
// worse than not grading at all: it would read as a pass. Check the shape before trusting it.
if (FIRE) {
  for (const k of PRESS_KEYS) {
    if (!Array.isArray(FIRE[k])) die(`--fire has no array for spec key "${k}" — it must carry one expected fire time per scheduled press`);
    if (FIRE[k].length !== spec[k].length) die(`--fire.${k} has ${FIRE[k].length} time(s) but the spec schedules ${spec[k].length}`);
    if (FIRE[k].some(t => !Number.isFinite(Number(t)))) die(`--fire.${k} has a non-numeric time`);
  }
  const extra = Object.keys(FIRE).filter(k => !PRESS_KEYS.includes(k));
  if (extra.length) die(`--fire names key(s) the spec does not press: ${extra.join(', ')}`);
}
if (CAST) {
  for (const k of PRESS_KEYS) {
    if (!Array.isArray(CAST[k])) die(`--cast has no array for spec key "${k}"`);
    if (CAST[k].length !== spec[k].length) die(`--cast.${k} has ${CAST[k].length} entr(ies) but the spec schedules ${spec[k].length}`);
    if (CAST[k].some(v => !Number.isInteger(Number(v)))) die(`--cast.${k} must be cast INDICES (integers, −1 for "buffs no cast")`);
  }
  const extra = Object.keys(CAST).filter(k => !PRESS_KEYS.includes(k));
  if (extra.length) die(`--cast names key(s) the spec does not press: ${extra.join(', ')}`);
}

const IDS = {};
for (const k of PRESS_KEYS) {
  const g = braceGroup(actionIdFor(k));
  if (!g) die(`could not learn an ActionID for spec key "${k}" from tools/genapl-core.mjs`);
  IDS[k] = g;
}

// ── the log ──────────────────────────────────────────────────────────────────────────────────────
let logPath = flag('log');
if (has('run')) {
  if (logPath) die('pass --log OR --run, not both');
  const RUNNER = process.env.RUNNER || '';
  if (!RUNNER) die('--run needs RUNNER=<path to runner-ap180> (TOOLING "Building the runner").\n' +
    '       The committed sim/sim.wasm does not expose a combat log, so log-walking is the one\n' +
    '       instrument that still wants a native binary. Or produce a log yourself and pass --log.');
  if (!fs.existsSync(RUNNER)) die(`RUNNER does not exist: ${RUNNER}`);
  const exportPath = flag('export', path.join(REPO, 'tools/bench/export.json'));
  if (!fs.existsSync(exportPath)) die(`--export does not exist: ${exportPath}`);
  const aplPath = path.join(process.env.TMPDIR || '/tmp', `press-verify-${process.pid}.apl.json`);
  logPath = path.join(process.env.TMPDIR || '/tmp', `press-verify-${process.pid}.log`);
  fs.writeFileSync(aplPath, JSON.stringify(build(spec)));
  const args = ['--export', exportPath, '--apl', aplPath, '--dur', flag('dur', '60'),
    '--var', '0', '--iter', '1', '--seed', flag('seed', '11'),
    '--mana', '100000000', '--haste', flag('haste', '0'), '--quiet'];
  if (flag('targets')) args.push('--targets', flag('targets'));
  // ⚠ the runner streams SIMLOG to STDERR, not stdout. Capture BOTH or the count reads 0 while the
  // log floods the terminal — a real half-hour lost to this once.
  try {
    execFileSync(RUNNER, args, { env: { ...process.env, SIMLOG: '1' }, encoding: 'utf8',
      maxBuffer: 1 << 28, stdio: ['ignore', fs.openSync(logPath, 'w'), fs.openSync(logPath, 'a')] });
  } catch { /* the runner's exit code is irrelevant here; the log is what matters */ }
  console.log(`# ran ${path.basename(RUNNER)} → ${logPath}`);
}
if (!logPath) die('need --log <simlog file> (produce one with SIMLOG=1 …) or --run with RUNNER set');
let log;
try { log = fs.readFileSync(logPath, 'utf8'); } catch (e) { die(`cannot read --log: ${e.message}`); }
if (!log.trim()) die(`--log is empty: ${logPath} (an empty log must never grade as "all presses fired")`);
if (log.includes('\0')) die(`--log contains NUL bytes — truncated or concurrently written: ${logPath}`);

// `[  9.15] [Player (#1)] Casting {SpellID: 12042} (…)`  /  `… Aura gained: {SpellID: 2825, Tag: -1}`
const PLAYER = /^\[\s*([\d.]+)\]\s+\[Player \(#\d+\)\]\s+(Casting|Aura gained:)\s+(\{[^}]*\})/;
const casts = [], auras = [];
for (const line of log.split('\n')) {
  const m = PLAYER.exec(line.trim());
  if (!m) continue;
  (m[2] === 'Casting' ? casts : auras).push({ t: parseFloat(m[1]), g: m[3] });
}
if (!casts.length && !auras.length) die(
  `no [Player (#N)] events in ${logPath} — was SIMLOG=1 set, and is this the runner's own output?`);

// The SIM's OWN cast grid, read from the log — Arcane Blast plus the Arcane Explosions of an AoE
// window. This is what makes `--cast` immune to the model/sim lattice drift: the press is graded
// against the boundaries the sim actually had, not against the ones the model predicted.
const STREAM = new Set(Object.values(CAST_STREAM_IDS).map(id => `{SpellID: ${id}}`));
const simCasts = casts.filter(e => STREAM.has(e.g)).map(e => e.t).sort((a, b) => a - b);
if (CAST && !simCasts.length) die(
  '--cast was given but the log has no Arcane Blast / Arcane Explosion casts to index against.\n' +
  '       Grading a press against a cast stream that is not there would pass everything.');
const CAST_EPS = 0.005;   // the log prints 2 decimals; this is its own rounding, nothing more

// ── match intents to events ──────────────────────────────────────────────────────────────────────
const TOL = 0.10;        // a press never fires EARLY; this only absorbs formatting/rounding
const EQUIP_T = 0.05;    // a t≈0 aura is the equip, not a press (log-format fact 4)
const rows = [];
let dropped = 0, unclaimed = 0, mistimed = 0, held = 0, lattice = 0;

for (const key of PRESS_KEYS) {
  const g = IDS[key];
  let events = casts.filter(e => e.g === g);
  let via = 'cast';
  if (!events.length) {
    // Log-format fact 2: Bloodlust is applied TO the player and has no Casting line at all.
    // Only fall back when the ActionID cast NOTHING — that is what keeps fact 4's equip aura out.
    events = auras.filter(e => e.g === g);
    via = 'aura';
  }
  const used = new Set();
  // Schedule value and expected fire time travel together — sorting them apart would grade press 1
  // against press 2's deadline and call it a pass.
  const intents = spec[key]
    .map((t, i) => ({ intent: Number(t), want: FIRE ? Number(FIRE[key][i]) : null,
                      wantCast: CAST ? Number(CAST[key][i]) : null }))
    .sort((a, b) => a.intent - b.intent);
  for (const { intent, want, wantCast } of intents) {
    const hit = events
      .map((e, i) => ({ ...e, i }))
      .filter(e => !used.has(e.i) && e.t >= intent - TOL)
      .filter(e => !(via === 'aura' && e.t < EQUIP_T && intent >= EQUIP_T))
      .sort((a, b) => a.t - b.t)[0];
    if (!hit) { rows.push({ key, id: g, intent, want, fired: null, slip: null, off: null, via, bad: false, why: null, simCast: null }); dropped++; continue; }
    used.add(hit.i);
    const off = want === null ? null : +(hit.t - want).toFixed(3);
    // THE VERDICT. With --cast it is "did the press land on the cast the model buffs", read off the
    // sim's own grid. Without it, the weaker clock tolerance. A press buffs cast n if it goes off
    // after cast n−1 started and no later than cast n did.
    let bad = false, why = null;
    if (wantCast !== null && wantCast >= 0 && wantCast < simCasts.length) {
      const after = wantCast === 0 ? -Infinity : simCasts[wantCast - 1];
      bad = !(hit.t > after + CAST_EPS && hit.t <= simCasts[wantCast] + CAST_EPS);
      // ★ AND WHOSE FAULT IS IT — decided by the SCHEDULE VALUE, which is the only thing this repo
      // controls. A value at or past the sim's own cast-N boundary could never have fired on cast N;
      // one at or before cast N−1's would have fired a cast early. Either is a TRANSCRIPTION defect and
      // the gate's verdict. A value that sits properly inside the interval and STILL did not fire there
      // was held by the sim itself — `APLActionSchedule.IsReady` also requires `innerSpell.IsReady`, so
      // a cooldown that comes up a hair after the sim's boundary (while the model's grid puts that
      // boundary a hair later, on the other side of the expiry) defers the press a whole cast.
      //
      // ⚠ Do NOT collapse these. An earlier version of this classifier asked whether the model's FIRE
      // TIME was past the sim's boundary, which is true for any press near a boundary once the grids
      // drift — and it duly reported the retired `floor(actEff)` convention's own failures as
      // unfixable. A classifier that launders the defect it was built to catch is worse than none.
      if (bad) {
        const inside = intent <= simCasts[wantCast] + CAST_EPS &&
                       (wantCast === 0 || intent > simCasts[wantCast - 1] + CAST_EPS);
        // Half the sim's own interval is the entire budget any single-value rule has: the schedule is
        // derived from the MODEL's grid, so once the two grids differ by more than that, every value
        // the model can name is on the wrong side of one edge or the other. Past that line the fix is
        // the cast-time constant, not the rule.
        const span = wantCast > 0 ? simCasts[wantCast] - simCasts[wantCast - 1] : Infinity;
        why = inside ? 'held'
            : (want !== null && Math.abs(want - simCasts[wantCast]) > span / 2) ? 'lattice'
            : 'transcription';
      }
    } else if (wantCast === null && off !== null) {
      bad = Math.abs(off) > FIRE_TOL;
      if (bad) why = 'clock';
    }
    if (why === 'held') held++; else if (why === 'lattice') lattice++; else if (bad) mistimed++;
    rows.push({ key, id: g, intent, want, fired: hit.t, slip: +(hit.t - intent).toFixed(2), off, via, bad, why,
                simCast: wantCast !== null && wantCast >= 0 && wantCast < simCasts.length ? simCasts[wantCast] : null });
  }
  for (let i = 0; i < events.length; i++) {
    if (used.has(i)) continue;
    // An event nobody asked for. Under a schedule-only APL this is either an off-plan self-cast or,
    // far more often, an intent matched to the WRONG event — worth seeing either way.
    rows.push({ key, id: g, intent: null, want: null, fired: events[i].t, slip: null, off: null, via, bad: false, why: null, simCast: null });
    unclaimed++;
  }
}

// ── report ───────────────────────────────────────────────────────────────────────────────────────
if (has('json')) {
  console.log(JSON.stringify({ spec, fire: FIRE, cast: CAST, fireTol: FIRE_TOL, log: logPath, rows, dropped, unclaimed, mistimed, held, lattice }, null, 2));
} else {
  const rel = path.relative(REPO, logPath);
  console.log(`# press-verify — ${rel && !rel.startsWith('..') ? rel : logPath}`);
  console.log(`key    ActionID                  sched    fired${FIRE ? '   expected      off' : '     slip'}   via`);
  for (const r of rows.sort((a, b) => (a.fired ?? a.intent) - (b.fired ?? b.intent))) {
    const intent = r.intent === null ? '   —  ' : String(r.intent).padStart(6);
    const fired = r.fired === null ? '  DROPPED' : r.fired.toFixed(2).padStart(8);
    const mid = FIRE
      ? `${r.want === null ? '      — ' : r.want.toFixed(2).padStart(8)} ${r.off === null ? '       ' : ((r.off >= 0 ? '+' : '') + r.off.toFixed(3)).padStart(8)}`
      : (r.slip === null ? '        ' : ((r.slip >= 0 ? '+' : '') + r.slip.toFixed(2)).padStart(8));
    const tag = r.intent === null ? '  ← UNCLAIMED' : (r.fired === null ? '  ← DROPPED'
      : (r.why === 'held' ? `  ← HELD (sim's cast ${r.simCast.toFixed(2)})`
      : (r.why === 'lattice' ? `  ← LATTICE (sim's cast ${r.simCast.toFixed(2)})` : (r.bad ? '  ← WRONG CAST' : ''))));
    console.log(`${r.key.padEnd(6)} ${r.id.padEnd(25)} ${intent} ${fired} ${mid}   ${r.via}${tag}`);
  }
  if (CAST && FIRE) {
    // The `off` column is now a LATTICE measurement, not a verdict — say so, or the next reader
    // reads a third of a second of drift as a failure the verdict just told them it is not.
    const offs = rows.filter(r => r.off !== null).map(r => Math.abs(r.off));
    if (offs.length) console.log(`\n  (off = model clock − sim clock; worst ${Math.max(...offs).toFixed(3)}s. ` +
      'The verdict is the CAST, not this column — the two grids drift.)');
  }
  console.log('');
  if (dropped) {
    console.log(`‼ ${dropped} intended press(es) NEVER FIRED. The three explanations, in order of`);
    console.log('  historical frequency: the APLActionSchedule drop bug (cooldown not ready at the');
    console.log('  scheduled second), a shared-trinket lockout retiming it out of range, or the');
    console.log('  trinket not being EQUIPPED (sim/planspec.mjs REQUIRES_EQUIPPED guards that one).');
  }
  if (mistimed) {
    console.log(`‼ ${mistimed} press(es) buffed a DIFFERENT CAST than the model scored them on` +
      (CAST ? '.' : ` (fired more than ${FIRE_TOL}s away).`));
    console.log('  A duel whose arms are buffed on different casts is not a duel. Two causes, and they');
    console.log('  need different fixes: a mis-derived SCHEDULE VALUE (sim/planspec.mjs — read its');
    console.log('  header first), or a cooldown-chained press whose own earlier use landed elsewhere in');
    console.log('  the sim, so the second is gated by `spell.IsReady` rather than by the schedule.');
  }
  if (lattice) {
    console.log(`⚠ ${lattice} press(es) marked LATTICE: the model's cast grid and the sim's are more than`);
    console.log('  HALF AN INTERVAL apart at that press, which is the entire budget any schedule value has');
    console.log('  (it is derived from the model\'s grid, so past that line every value it can name is on');
    console.log('  the wrong side of one edge). Same root cause as HELD: the 334 ms / (1/3) s Arcane Blast');
    console.log('  cast-time mismatch. Not a transcription bug, not counted as a failure — and not benign.');
  }
  if (held) {
    console.log(`⚠ ${held} press(es) marked HELD: the schedule value DID sit inside the right interval,`);
    console.log('  and the sim declined to fire there anyway — `APLActionSchedule.IsReady` also gates on');
    console.log('  `innerSpell.IsReady`, so a cooldown coming up just after the sim\'s boundary defers the');
    console.log('  press a full cast. That happens when the model\'s grid puts the boundary on the other');
    console.log('  side of the expiry: the root cause is the 334 ms / (1/3) s Arcane Blast cast-time');
    console.log('  mismatch (sim/planspec.mjs header, tools/lattice-drift.mjs). NOT a transcription bug,');
    console.log('  NOT counted as a failure here, and NOT harmless — it is the constant that needs fixing.');
  }
  if (unclaimed) console.log(`⚠ ${unclaimed} event(s) matched no intent — check the pairing above before trusting it.`);
  if (!FIRE && !CAST) console.log('⚠ no --fire/--cast given: this graded only WHETHER each press fired, never WHEN.');
  else if (!CAST) console.log('⚠ no --cast given: graded on the clock, which the model/sim lattice drift can fail spuriously.');
  if (!dropped && !unclaimed && !mistimed) {
    console.log(CAST ? `✓ every intended press fired, on the cast the model scored it on${held || lattice ? ' (bar the HELD/LATTICE rows above)' : ''}.`
              : FIRE ? '✓ every intended press fired, within the clock tolerance.'
                     : '✓ every intended press fired, and nothing fired that was not intended.');
  }
}
process.exit(dropped || mistimed ? 1 : 0);
