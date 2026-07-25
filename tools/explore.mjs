// ═══════════════ exploration harness ═══════════════
// Brute-enumerate a SMALL cooldown-placement problem, sweep gear haste, and let the rules fall out.
//
// Why this exists: the planner's optimizer is a search — it can MISS the true optimum (docs/PLAN.md).
// This harness sidesteps the search entirely: for a tiny buff set it scores EVERY placement on the
// model directly, so the winner is exact by construction. Sweeping gear haste exposes the breakpoints
// (where the winning layout flips) and, because damage buffs turn out to have none while haste buffs
// carry them all, the emergent ruleset. It also flags "ramp-sensitive" winners — cells whose score
// leans on the model's steady-state (ramp-blind) assumption — so we know exactly which findings need a
// sim cross-check before we trust them (that check is `--sim`, and it drives the P4.measure gate).
//
//   node explore.mjs                    # run every scenario, model only
//   node explore.mjs iv-icon            # one scenario by name
//   node explore.mjs --grid             # also print the full score grid per haste
//   node explore.mjs --sim              # cross-check ramp-sensitive winners in wowsims
//                                       #   (needs RUNNER=/path/to/runner GEAR=/path/to/export.json)
import { execFileSync } from 'child_process';
import { createRequire } from 'module';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { fileURLToPath } from 'url';

const __dir = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(__dir, '..');
// playwright-core lives under tests/node_modules (the repo's only install, symlinked into the
// ephemeral scratchpad — see tests/.gitignore). Resolve it from there so this tool needs no
// node_modules of its own and nothing ephemeral gets committed.
const { chromium } = createRequire(path.join(REPO, 'tests', 'package.json'))('playwright-core');
const argv = process.argv.slice(2);
const SHOW_GRID = argv.includes('--grid');
const DO_SIM = argv.includes('--sim');
const only = argv.find(a => !a.startsWith('--'));

// A "ramp-sensitive" placement puts a buff inside the opening stack ramp (~the first 3 AB casts, ≈7s at
// no haste). There the model's flat-3-stacks scoring differs from reality: it UNDER-credits a haste buff
// (the real ramp casts are slower, so they have GCD-floor headroom the model doesn't see) and OVER-credits
// a damage buff (the model pushes steady-state cast-flux through a window that is really still ramping up).
const RAMP_T = 7;

// ── scenarios: fixed raid pins + placeable mage cooldowns, each over a candidate-time grid ──
// Times are seconds. Keep sets small — every candidate combination is scored, so this is a product.
const SP = 1387, CRIT = 38;
const SCENARIOS = [
  {
    // Cap thresholds (GCD cap = +50% haste, 15.77 rating/%), which set the meaningful sweep points:
    //   243 = Lust alone caps (passive·1.30 ≥ 1.50) → IV must leave Lust by here (in-Lust IV fully wasted)
    //   394 = IV window also caps (passive·1.20 ≥ 1.50) → Icon indifferent between the Lust window and the
    //         IV window (both capped); IV OUTSIDE Lust still gains (lifts a bare window to the cap). IV is
    //         only wasted INSIDE Lust — never "wasted everywhere".
    //   789 = passive alone caps (passive ≥ 1.50)   → all placement irrelevant; sweeping past 789 is useless
    name: 'iv-icon',
    desc: "1:20, Lust@0:20. One Icy Veins (haste) + one Icon (SP). The user's clean 9-cell case.",
    T: 80, pins: { bloodlust: [20] },
    place: [{ key: 'icyVeins', at: [0, 20, 40, 60] }, { key: 'isc', at: [0, 20, 40, 60] }],
    haste: [0, 5, 10, 15, 20, 100, 200, 243, 300, 394, 600, 789],
  },
  {
    name: 'iv-icon-ap',
    desc: '1:20, Lust@0:20. Add Arcane Power (dmg). Does AP always chase the highest-haste window?',
    T: 80, pins: { bloodlust: [20] },
    place: [{ key: 'icyVeins', at: [0, 20, 60] }, { key: 'isc', at: [0, 20, 60] }, { key: 'arcanePower', at: [0, 20, 60] }],
    haste: [0, 10, 20, 40, 80, 150, 250],
  },
  {
    // The B-gate test: put Lust at the PULL so the fast window overlaps the opening ramp, then place a
    // pure damage buff (Icon). The model is ramp-blind (flat 3 stacks), so it scores Icon@0 (over the ramp)
    // and Icon@20 (past it) identically — a TIE. The sim has the real ramp (slower opening casts), so it
    // should prefer Icon@20. The SIZE of that model-tie-vs-sim-preference gap decides whether B is worth it:
    // small (<~0.3%) → the ramp-blindness never mis-ranks in practice → skip B.
    name: 'icon-ramp',
    desc: 'Lust@0:00 (pull IS the fast window). Over-credit test: does the ramp-blind model wrongly tie a damage buff over the ramp with one past it?',
    T: 80, pins: { bloodlust: [0] },
    place: [{ key: 'isc', at: [0, 20, 40] }],
    haste: [0, 100, 200],
  },
  {
    name: 'iv-zerk',
    desc: '1:20, Lust@0:20. Two haste buffs (IV 20s + Berserking 10s). How do they share the GCD floor?',
    T: 80, pins: { bloodlust: [20] },
    place: [{ key: 'icyVeins', at: [0, 20, 60] }, { key: 'berserking', at: [0, 10, 20, 30, 60, 70] }],
    haste: [0, 20, 40, 80, 150, 250],
  },
  {
    // Haste-on-haste in ISOLATION (RULES §7): stacking is a real multiplicative synergy below the floor
    // (Zerk inside IV is worth ×1.2 its outside value — sim-verified +0.37% var10). Watch the winner:
    // STACK through cap-touch (stacked ×1.32 caps at ~215) until ~263 (the premium absorbs the early
    // overcap waste), SPREAD ~263–700, then stack-on-the-pull-ramp at unreachable haste (only the slow
    // ramp casts stay under the floor).
    name: 'iv-zerk-solo',
    desc: '1:00, NO Lust, no damage buffs. IV + Berserking alone: stack vs spread across the floor.',
    T: 60, pins: {},
    place: [{ key: 'icyVeins', at: [0, 10, 20, 30, 40] }, { key: 'berserking', at: [0, 10, 20, 30, 40, 50] }],
    haste: [0, 100, 200, 215, 240, 263, 280, 394, 574, 700, 789],
  },
];

// ── model scoring (in-page) ──
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM || '/opt/pw-browsers/chromium' });
const page = await browser.newPage();
let perr = null; page.on('pageerror', e => (perr = String(e)));
await page.goto('file://' + path.join(REPO, 'index.html'));
if (perr) { console.error('PAGEERROR loading index.html:', perr); await browser.close(); process.exit(2); }

const KIND = await page.evaluate(() => Object.fromEntries(Object.keys(BUFFS).map(k => [k, BUFFS[k].kind])));
const isHaste = k => KIND[k] === 'mult' || KIND[k] === 'rating';

function combos(place) { // cartesian product of each buff's candidate times → [{key:time,...}, ...]
  let acc = [{}];
  for (const p of place) {
    const next = [];
    for (const a of acc) for (const t of p.at) next.push({ ...a, [p.key]: t });
    acc = next;
  }
  return acc;
}
const comboKey = (place, c) => place.map(p => `${p.key}@${c[p.key]}`).join(' ');

async function scoreScenario(sc) {
  const cs = combos(sc.place);
  const rows = await page.evaluate(({ sc, cs, SP, CRIT }) => {
    const keys = [...Object.keys(sc.pins), ...sc.place.map(p => p.key)];
    const enabled = {}; for (const k in BUFFS) enabled[k] = keys.includes(k);
    const mkcfg = h => ({ T: sc.T, hasteRating: h, sp: SP, critPct: CRIT, enabled, fixed: sc.pins, warnings: [], coldSnap: false, segments: null });
    const plain = h => { const g = mkcfg(h); return (GAME.AB.AVG_BASE_DMG + GAME.AB.COEF * g.sp) * (1 + (g.critPct / 100) * (GAME.CRIT_MULT - 1)); };
    const out = [];
    for (const h of sc.haste) {
      const cfg = mkcfg(h), p = plain(h);
      const scores = cs.map(c => {
        const sched = {}; for (const k in sc.pins) sched[k] = sc.pins[k].slice();
        for (const pl of sc.place) sched[pl.key] = [c[pl.key]];
        return simulate(sched, cfg, false).total / p;
      });
      out.push({ h, scores });
    }
    return out;
  }, { sc, cs, SP, CRIT });
  return { cs, rows };
}

// ── report ──
function reportScenario(sc, cs, rows) {
  console.log(`\n${'═'.repeat(96)}\n▶ ${sc.name}\n  ${sc.desc}\n`);
  let prevWin = null;
  const flagged = []; // ramp-sensitive winners to sim-check
  for (const { h, scores } of rows) {
    let bi = 0; for (let i = 1; i < scores.length; i++) if (scores[i] > scores[bi] + 1e-9) bi = i;
    let wi = 0; for (let i = 1; i < scores.length; i++) if (scores[i] < scores[wi] - 1e-9) wi = i;
    const win = comboKey(sc.place, cs[bi]);
    const bp = prevWin !== null && win !== prevWin ? '  ← BREAKPOINT' : '';
    const spread = scores[bi] - scores[wi];
    console.log(`  haste ${String(h).padStart(3)}   winner: ${win.padEnd(46)} ${scores[bi].toFixed(3)}   (spread ${spread.toFixed(3)})${bp}`);
    // ramp flag: any winning buff placed inside the opening ramp
    const rampBuffs = sc.place.filter(p => cs[bi][p.key] < RAMP_T);
    if (rampBuffs.length) {
      for (const p of rampBuffs) {
        const dir = isHaste(p.key) ? 'under-credit (floor headroom)' : 'OVER-credit (ramp flux deficit)';
        flagged.push({ h, win, key: p.key, at: cs[bi][p.key], dir, combo: cs[bi] });
      }
    }
    if (SHOW_GRID) printGrid(sc, cs, scores, bi);
    prevWin = win;
  }
  // per-buff: is its winning slot constant across the whole sweep? (⇒ a no-breakpoint rule)
  console.log('');
  for (const p of sc.place) {
    const wins = rows.map(({ scores }) => { let bi = 0; for (let i = 1; i < scores.length; i++) if (scores[i] > scores[bi] + 1e-9) bi = i; return cs[bi][p.key]; });
    const uniq = [...new Set(wins)];
    const tag = isHaste(p.key) ? '(haste)' : '(damage)';
    console.log(`  ${p.key.padEnd(12)} ${tag.padEnd(9)} winning slot across haste: ${uniq.length === 1 ? `ALWAYS @${uniq[0]}  → no breakpoint` : `flips ${JSON.stringify(wins)}`}`);
  }
  if (flagged.length) {
    console.log(`\n  ⚑ ramp-sensitive winners (need sim cross-check): ${flagged.length}`);
    const seen = new Set();
    for (const f of flagged) { const k = `${f.key}@${f.at}`; if (seen.has(k)) continue; seen.add(k); console.log(`     ${f.key}@${f.at} — ${f.dir}`); }
  }
  return flagged;
}

function printGrid(sc, cs, scores, bi) {
  if (sc.place.length !== 2) { // only 2-D grids print nicely
    return;
  }
  const [A, B] = sc.place;
  let head = '           ' + B.at.map(t => `${B.key}@${t}`.padStart(11)).join('');
  console.log('    ' + head);
  for (const ta of A.at) {
    let row = `    ${(A.key + '@' + ta).padEnd(11)}`;
    for (const tb of B.at) { const idx = cs.findIndex(c => c[A.key] === ta && c[B.key] === tb); const mark = idx === bi ? '*' : ' '; row += `${scores[idx].toFixed(3)}${mark} `.padStart(11); }
    console.log(row);
  }
}

// ── optional sim cross-check of ramp-sensitive winners ──
// For each ramp-sensitive winner, test the exact claim the model is making: that the flagged buff belongs
// in the ramp. Build the model's best RIVAL that moves that one buff OUT of the ramp, sim both (real ramp,
// real procs), and check the ORDERING agrees. A DISAGREE is a ranking error the ramp-blind scorer caused —
// exactly the signal the P4.measure gate needs to decide whether B (de-ramp-blinding) is worth doing.
function simCrossCheck(sc, cs, rows, flagged) {
  const RUNNER = process.env.RUNNER, GEAR = process.env.GEAR;
  if (!RUNNER || !GEAR) { console.log(`\n  [--sim] set RUNNER=/path/to/runner GEAR=/path/to/export.json to cross-check`); return; }
  const genapl = path.join(REPO, 'tools', 'genapl.mjs');
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'explore-sim-'));
  const APLKEY = { icyVeins: 'IV', arcanePower: 'AP', isc: 'Icon', scb: 'Gem', berserking: 'Zerk', bloodlust: 'BL' };
  const specOf = combo => {
    const s = {};
    for (const k in sc.pins) if (APLKEY[k]) s[APLKEY[k]] = sc.pins[k].slice();
    for (const p of sc.place) s[APLKEY[p.key]] = [combo[p.key]];
    return s;
  };
  const simDPS = (spec, h) => {
    const aplPath = path.join(tmp, 'a.apl.json');
    execFileSync('node', [genapl, JSON.stringify(spec), aplPath], { stdio: ['ignore', 'ignore', 'inherit'] });
    const line = execFileSync(RUNNER, ['--export', GEAR, '--apl', aplPath, '--dur', String(sc.T), '--var', '0', '--iter', '30000', '--seed', '7', '--mana', '100000000', '--haste', String(h), '--tag', 't', '--quiet'], { encoding: 'utf8' });
    const dps = parseFloat(line.trim().split(/\s+/)[4]); // col 5 = meanDPS (simsweep.sh convention)
    // Same unvalidated parse that was xval.mjs's worst defect. Here an unparseable line makes `ds`
    // NaN, and since every NaN comparison is false the verdict falls through to "‼ DISAGREE (real
    // ranking flip)" — a false ALARM rather than a false pass, but it corrupts the P4.measure gate
    // just the same, and this gate is the one that decides whether de-ramp-blinding is worth doing.
    if (!Number.isFinite(dps)) {
      console.error(`ERROR: could not parse DPS (whitespace field 5) from runner output at haste ${h}.`);
      console.error(`  last line was: ${JSON.stringify(line.trim().split('\n').pop() || '')}`);
      process.exit(2);
    }
    return dps;
  };
  const scoresAt = h => rows.find(r => r.h === h).scores;
  const idxOf = combo => cs.findIndex(c => sc.place.every(p => c[p.key] === combo[p.key]));
  // one check per (flagged buff, haste): winner vs best rival with that buff pulled out of the ramp
  const seen = new Set();
  const checks = [];
  for (const f of flagged) {
    const k = `${f.key}@${f.h}`; if (seen.has(k)) continue; seen.add(k);
    const scores = scoresAt(f.h);
    const bi = idxOf(f.combo);
    let ri = -1; // best-scoring combo identical to winner except the flagged buff moved to a non-ramp slot
    for (let i = 0; i < cs.length; i++) {
      const c = cs[i];
      if (c[f.key] < RAMP_T) continue;                                   // rival must move the buff OUT of the ramp
      if (!sc.place.every(p => p.key === f.key || p.key !== f.key && c[p.key] === f.combo[p.key])) continue; // hold others fixed
      if (ri < 0 || scores[i] > scores[ri]) ri = i;
    }
    if (ri >= 0) checks.push({ f, bi, ri, scores });
  }
  // Classify honestly. The sim floor here is ~0.05% (30k iters, var 0), so anything under SIM_EPS is a
  // tie in the sim; MODEL_EPS is well below one effective cast. The revealing category is MODEL-BLIND:
  // the model calls it a tie but the sim has a real preference — a ramp-blindness ranking gap.
  const MODEL_EPS = 0.01, SIM_EPS = 0.3; // eff-casts, percent
  console.log(`\n  [--sim] ramp cross-check — winner vs best "buff out of ramp" rival (real ramp + procs):`);
  for (const { f, bi, ri, scores } of checks) {
    const wd = simDPS(specOf(cs[bi]), f.h), rd = simDPS(specOf(cs[ri]), f.h);
    const dm = scores[bi] - scores[ri];            // model: winner(ramp) − rival(out)
    const ds = (wd - rd) / rd * 100;               // sim %:  ramp − out
    const modelTie = Math.abs(dm) <= MODEL_EPS, simTie = Math.abs(ds) <= SIM_EPS;
    let verdict;
    if (modelTie && simTie) verdict = 'TIE (both agree ~equal)';
    else if (modelTie && !simTie) verdict = `⚑ MODEL-BLIND — model ties, sim prefers @${ds > 0 ? f.combo[f.key] : cs[ri][f.key]} by ${Math.abs(ds).toFixed(2)}%`;
    else verdict = Math.sign(dm) === Math.sign(ds) ? 'AGREE' : '‼ DISAGREE (real ranking flip)';
    console.log(`     haste ${String(f.h).padStart(3)} ${f.key}: @${f.combo[f.key]}(ramp) vs @${cs[ri][f.key]}(out)  Δmodel ${dm >= 0 ? '+' : ''}${dm.toFixed(3)}  Δsim ${ds >= 0 ? '+' : ''}${ds.toFixed(2)}%  →  ${verdict}`);
  }
  fs.rmSync(tmp, { recursive: true, force: true });
}

let scenarios = SCENARIOS;
if (only) { scenarios = SCENARIOS.filter(s => s.name === only); if (!scenarios.length) { console.error(`no scenario "${only}"; have: ${SCENARIOS.map(s => s.name).join(', ')}`); process.exit(2); } }
for (const sc of scenarios) {
  const { cs, rows } = await scoreScenario(sc);
  if (perr) { console.error('PAGEERROR on', sc.name, ':', perr); await browser.close(); process.exit(2); }
  const flagged = reportScenario(sc, cs, rows);
  if (DO_SIM) simCrossCheck(sc, cs, rows, flagged);
}
await browser.close();
