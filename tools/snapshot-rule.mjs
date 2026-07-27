// WHEN DOES A BUFF APPLY TO A CAST — at the cast's START, or at its COMPLETION?
//
//   RUNNER=… node tools/snapshot-rule.mjs
//
// ── WHY IT MATTERS ────────────────────────────────────────────────────────────────────────────────
// The model's board walk decides a cast's damage and speed ONCE, at the cast's start, from whichever
// buff windows are active then. That is one rule for both kinds of buff, and wowsims uses two:
//
//   · HASTE   — the cast's speed is fixed when it BEGINS. A haste buff landing mid-cast does not
//               shorten the cast in flight; a haste buff FADING mid-cast does not lengthen it.
//   · VALUE   — +SP and damage multipliers are read at cast COMPLETION, unconditionally. A cast that
//               began unbuffed and completes inside the window gets the value; a cast that began
//               inside the window and completes after it fades does NOT.
//
// `index.html`'s scorer already carries that claim in a comment ("re-confirmed on the KT log in both
// directions"), and it is exactly the kind of load-bearing fact that should not live only in prose —
// PHASE12 has now cost the project two scoring bugs that a two-line probe would have caught. So this
// is the probe. It is deliberately built as a FADE test, because a fade is the only case where the two
// rules give different answers and the schedule action can still place the press.
//
// ── THE EXPERIMENT ────────────────────────────────────────────────────────────────────────────────
// Press a buff so its window ENDS strictly inside a cast. Then read that cast's own `[DEBUG] SP:` and
// its duration out of the combat log:
//   value read at COMPLETION  =>  the straddling cast shows BASE SP (it lost the buff mid-flight)
//   value read at START       =>  the straddling cast shows BUFFED SP
//   haste fixed at START      =>  the straddling cast keeps the FAST duration
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { build } from './genapl-core.mjs';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const RUNNER = process.env.RUNNER || '/tmp/wowsims-build/tbc-new/runner-ap180';
if (!fs.existsSync(RUNNER)) { console.error(`ERROR: no RUNNER at ${RUNNER}`); process.exit(2); }

// One run, returning the player's Arcane Blast stream: start, completion, the SP the sim used, and
// the aura gain/fade times of the spec's buff.
function run(spec, tag, auraRx) {
  const apl = `/tmp/snap-${tag}.json`, log = apl + '.log';
  fs.writeFileSync(apl, JSON.stringify(build(spec)));
  try {
    execFileSync(RUNNER, ['--export', path.join(REPO, 'tools/bench/export.json'), '--apl', apl,
      '--dur', '60', '--var', '0', '--iter', '1', '--seed', '11', '--mana', '100000000',
      '--haste', '0', '--quiet'],
      { env: { ...process.env, SIMLOG: '1' }, maxBuffer: 1 << 28,
        stdio: ['ignore', fs.openSync(log, 'w'), fs.openSync(log, 'a')] });
  } catch { /* the log is the instrument */ }
  const txt = fs.readFileSync(log, 'utf8');
  const starts = [...txt.matchAll(/\[\s*([0-9.]+)\]\s*\[Player[^\]]*\] Casting \{SpellID: 30451\}[^\n]*Cast Time = ([0-9.]+)s/g)]
    .map(m => ({ t: +m[1], cast: +m[2] }));
  const dmg = [...txt.matchAll(/\[\s*([0-9.]+)\][^\n]*\{SpellID: 30451\} \[DEBUG\][^\n]*SP: ([0-9.]+)/g)]
    .map(m => ({ tc: +m[1], sp: +m[2] }));
  const gain = [...txt.matchAll(auraRx.gain)].map(m => +m[1]);
  const fade = [...txt.matchAll(auraRx.fade)].map(m => +m[1]);
  return { starts, dmg, gain: gain.filter(x => x > 0.05)[0], fade: fade.filter(x => x > 0.05)[0] };
}

const ICON = { gain: /\[\s*([0-9.]+)\][^\n]*Aura gained: \{ItemID: 29370/g,
               fade: /\[\s*([0-9.]+)\][^\n]*Aura faded: \{ItemID: 29370/g };
const ZERK = { gain: /\[\s*([0-9.]+)\][^\n]*Aura gained: \{SpellID: 20554/g,
               fade: /\[\s*([0-9.]+)\][^\n]*Aura faded: \{SpellID: 20554/g };

// ── TEST 1 — a VALUE buff (Icon of the Silver Crescent, +SP) fading mid-cast ─────────────────────
// Icon runs 20 s. Scheduling it to fire on the 11.00 boundary puts the fade at ~31.00, which at h=0
// lands strictly inside the cast that started ~30.50 — the straddling cast this test is about.
console.log('# TEST 1 — a VALUE buff (+SP) fading mid-cast: is SP read at START or at COMPLETION?\n');
{
  const base = run({ _prestack: 0 }, 'base-sp', ICON);
  const r = run({ _prestack: 0, Icon: [10.5] }, 'icon', ICON);
  const baseSp = base.dmg.length ? base.dmg[base.dmg.length - 1].sp : null;
  console.log(`  Icon aura: gained ${r.gain?.toFixed(2)}  faded ${r.fade?.toFixed(2)}   (unbuffed SP ≈ ${baseSp})`);
  const straddler = r.starts.find(s => r.fade !== undefined && s.t < r.fade - 1e-9 && s.t + s.cast > r.fade + 1e-9);
  if (!straddler) { console.log('  (no cast straddles the fade — adjust the press time)'); }
  else {
    const d = r.dmg.find(x => Math.abs(x.tc - (straddler.t + straddler.cast)) < 0.06);
    console.log(`  the straddling cast: starts ${straddler.t.toFixed(2)} (INSIDE the window), completes ` +
      `${(straddler.t + straddler.cast).toFixed(2)} (AFTER the fade)`);
    console.log(`  its SP: ${d ? d.sp : '?'}`);
    if (d) console.log(`  ⇒ ${Math.abs(d.sp - baseSp) < 1 ? '★ VALUE IS READ AT COMPLETION' : 'value is read at START'}` +
      ` — it ${Math.abs(d.sp - baseSp) < 1 ? 'LOST' : 'KEPT'} the buff it started under`);
  }
  // ── the FRONT edge pins the inequality: is a cast COMPLETING exactly on the gain credited? ──
  // It decides whether the model should test `completion >= start` or `completion > start`, and the
  // two differ by one cast's premium on every single window in every plan.
  console.log('\n  the casts around each edge (start -> completion : SP the sim used):');
  for (const label of ['gain', 'fade']) {
    const edge = r[label]; if (edge === undefined) continue;
    console.log(`    ${label} @ ${edge.toFixed(2)}`);
    for (const st of r.starts) {
      const tc = st.t + st.cast;
      if (tc < edge - 3.2 || tc > edge + 3.2) continue;
      const d = r.dmg.find(x => Math.abs(x.tc - tc) < 0.06);
      const mark = Math.abs(tc - edge) < 0.06 ? '  <- completes ON the edge' : '';
      console.log(`      ${st.t.toFixed(2)} -> ${tc.toFixed(2)} : SP ${d ? d.sp : '?'}${mark}`);
    }
  }
}

// ── TEST 2 — a HASTE buff (Berserking) fading mid-cast ──────────────────────────────────────────
console.log('\n# TEST 2 — a HASTE buff fading mid-cast: is cast speed fixed at START?\n');
{
  const r = run({ _prestack: 0, Zerk: [10.5] }, 'zerk', ZERK);
  console.log(`  Zerk aura: gained ${r.gain?.toFixed(2)}  faded ${r.fade?.toFixed(2)}`);
  const straddler = r.starts.find(s => r.fade !== undefined && s.t < r.fade - 1e-9 && s.t + s.cast > r.fade + 1e-9);
  const after = r.starts.find(s => r.fade !== undefined && s.t >= r.fade - 1e-9);
  if (straddler) {
    console.log(`  the straddling cast: starts ${straddler.t.toFixed(2)} (buffed), cast time ${straddler.cast}s`);
    if (after) console.log(`  the next cast:       starts ${after.t.toFixed(2)} (unbuffed), cast time ${after.cast}s`);
    console.log(`  ⇒ ${after && straddler.cast < after.cast - 1e-9
      ? '★ SPEED IS FIXED AT CAST START — the in-flight cast kept the faster time'
      : 'speed was re-evaluated mid-cast'}`);
  } else console.log('  (no cast straddles the fade)');
}

console.log('\n  ⇒ If the two answers differ, ONE rule for both kinds of buff is wrong, and the model');
console.log('    applies exactly one rule (everything is decided at the cast\'s start).');
