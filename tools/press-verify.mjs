// THE PRESS VERIFIER — did the sim actually press what the spec told it to, and WHEN?
//
//   node tools/press-verify.mjs --spec '{"IV":[8,39],"AP":[8],"BL":[7],"Icon":[8]}' --log /tmp/pv.log
//   node tools/press-verify.mjs --spec-file s.json --log l.log [--json]
//   RUNNER=/path/to/runner-ap180 node tools/press-verify.mjs --spec '{…}' --run --dur 60 --haste 0
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
//   0 = every intended press fired · 1 = graded and at least one press DROPPED · 2 = could not grade.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { build, TIME_KEYS } from './genapl-core.mjs';

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

// ── match intents to events ──────────────────────────────────────────────────────────────────────
const TOL = 0.10;        // a press never fires EARLY; this only absorbs formatting/rounding
const EQUIP_T = 0.05;    // a t≈0 aura is the equip, not a press (log-format fact 4)
const rows = [];
let dropped = 0, unclaimed = 0;

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
  const intents = [...spec[key]].map(Number).sort((a, b) => a - b);
  for (const intent of intents) {
    const hit = events
      .map((e, i) => ({ ...e, i }))
      .filter(e => !used.has(e.i) && e.t >= intent - TOL)
      .filter(e => !(via === 'aura' && e.t < EQUIP_T && intent >= EQUIP_T))
      .sort((a, b) => a.t - b.t)[0];
    if (!hit) { rows.push({ key, id: g, intent, fired: null, slip: null, via }); dropped++; continue; }
    used.add(hit.i);
    rows.push({ key, id: g, intent, fired: hit.t, slip: +(hit.t - intent).toFixed(2), via });
  }
  for (let i = 0; i < events.length; i++) {
    if (used.has(i)) continue;
    // An event nobody asked for. Under a schedule-only APL this is either an off-plan self-cast or,
    // far more often, an intent matched to the WRONG event — worth seeing either way.
    rows.push({ key, id: g, intent: null, fired: events[i].t, slip: null, via });
    unclaimed++;
  }
}

// ── report ───────────────────────────────────────────────────────────────────────────────────────
if (has('json')) {
  console.log(JSON.stringify({ spec, log: logPath, rows, dropped, unclaimed }, null, 2));
} else {
  const rel = path.relative(REPO, logPath);
  console.log(`# press-verify — ${rel && !rel.startsWith('..') ? rel : logPath}`);
  console.log('key    ActionID                  intent    fired     slip   via');
  for (const r of rows.sort((a, b) => (a.fired ?? a.intent) - (b.fired ?? b.intent))) {
    const intent = r.intent === null ? '   —  ' : String(r.intent).padStart(6);
    const fired = r.fired === null ? '  DROPPED' : r.fired.toFixed(2).padStart(9);
    const slip = r.slip === null ? '      ' : (r.slip >= 0 ? '+' : '') + r.slip.toFixed(2).padStart(5);
    const tag = r.intent === null ? '  ← UNCLAIMED' : (r.fired === null ? '  ← DROPPED' : '');
    console.log(`${r.key.padEnd(6)} ${r.id.padEnd(25)} ${intent} ${fired} ${slip}   ${r.via}${tag}`);
  }
  console.log('');
  if (dropped) {
    console.log(`‼ ${dropped} intended press(es) NEVER FIRED. The three explanations, in order of`);
    console.log('  historical frequency: the APLActionSchedule drop bug (cooldown not ready at the');
    console.log('  scheduled second), a shared-trinket lockout retiming it out of range, or the');
    console.log('  trinket not being EQUIPPED (sim/planspec.mjs REQUIRES_EQUIPPED guards that one).');
  }
  if (unclaimed) console.log(`⚠ ${unclaimed} event(s) matched no intent — check the pairing above before trusting it.`);
  if (!dropped && !unclaimed) console.log('✓ every intended press fired, and nothing fired that was not intended.');
}
process.exit(dropped ? 1 : 0);
