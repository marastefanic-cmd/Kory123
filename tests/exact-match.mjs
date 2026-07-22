// Exact-match regression suite for the Arcane overlay planner.
//
// The optimizer is deterministic (fixed PRNG seed) and leftover haste snaps to the
// earliest efficient spot, so one setup produces exactly one schedule. This runner
// loads the real index.html in a headless browser, reads the fight table straight
// from the page (window.GOLDEN_PRESETS — the SAME "Debugging presets" the UI shows,
// so a preset you confirm in the tool IS the locked test), runs each through the
// actual optimizer, canonicalises the resulting plan (setup header + windows, exactly
// what "Copy as text" shows minus the cosmetic peak-haste/price tags), and compares
// it to a frozen golden.
//
//   node exact-match.mjs             # check every case against tests/golden.json
//   node exact-match.mjs --update    # regenerate the golden (after an INTENTIONAL change)
//
// Requires: playwright-core + a Chromium (set CHROMIUM=/path/to/chromium, or rely on
// the PLAYWRIGHT default). See tests/README.md.
import { chromium } from 'playwright-core';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dir = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(__dir, '..');
let spec; // sourced from index.html's GOLDEN_PRESETS once the page loads (see below)
const goldenPath = path.join(__dir, 'golden.json');
const update = process.argv.includes('--update');
const golden = fs.existsSync(goldenPath) ? JSON.parse(fs.readFileSync(goldenPath, 'utf8')) : {};

const ALL_BUFFS = ["ati", "powerInfusion", "drums", "icyVeins", "skull", "isc", "scb", "arcanePower", "berserking", "mqg", "bloodlust"];

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM || '/opt/pw-browsers/chromium' });
const page = await browser.newPage();
let perr = null;
page.on('pageerror', e => (perr = String(e)));
await page.goto('file://' + path.join(REPO, 'index.html'));

// Single source of truth: the fight table lives in index.html (window.GOLDEN_PRESETS),
// the same list the "Debugging presets" strip renders. Read it straight from the page.
spec = await page.evaluate(() => {
  if (!Array.isArray(window.GOLDEN_PRESETS) || !window.GOLDEN_DEFAULTS)
    throw new Error('window.GOLDEN_PRESETS / GOLDEN_DEFAULTS missing in index.html');
  // Two baked strips are locked: the real Boss presets and the abstract Debugging presets.
  return { gear: window.GOLDEN_DEFAULTS.gear, kit: window.GOLDEN_DEFAULTS.kit,
           cases: [...(window.BOSS_PRESETS || []), ...window.GOLDEN_PRESETS] };
});
if (perr) { console.error('PAGEERROR loading index.html:', perr); await browser.close(); process.exit(2); }

const results = {};
for (const c of spec.cases) {
  const gear = { ...spec.gear, ...(c.gear || {}) };
  const kit = c.kit || spec.kit;
  const plan = await page.evaluate(async ({ c, gear, kit, ALL_BUFFS }) => {
    const enabled = {};
    for (const k of ALL_BUFFS) enabled[k] = kit.includes(k);
    let segments = null;
    if (c.phases) {
      const rows = c.phases.map(p => ({ from: p.from, to: p.to, type: p.type, mult: p.mult || 1, targets: p.targets || 0 }));
      segments = buildSegments(rows, c.T);
    } else if (c.intermission) {
      segments = buildSegments([{ from: c.intermission[0], to: c.intermission[1], type: 'intermission', mult: 1, targets: 0 }], c.T);
    }
    const cfg = { T: c.T, hasteRating: gear.haste || 0, sp: gear.sp, critPct: gear.crit, enabled, fixed: c.pins || {}, warnings: [], coldSnap: gear.coldSnap !== false, segments };
    const best = await optimizeAsync(cfg, 14, () => {});
    const optR = simulate(best.s, cfg, true);
    const windows = scheduleRows({ cfg, best, optR });
    const L = [];
    L.push(`Setup: ${cfg.sp} SP · ${cfg.critPct}% crit · ${cfg.hasteRating} haste rating · Cold Snap ${cfg.coldSnap ? 'on' : 'off'}`);
    L.push(`Cooldowns: ${ALL_BUFFS.filter(k => cfg.enabled[k]).map(k => BUFFS[k].name).join(', ')}`);
    const pins = Object.entries(cfg.fixed || {}).filter(([, v]) => v && v.length).map(([k, v]) => `${BUFFS[k].name} @ ${v.map(t => fmtT(t)).join('/')}`);
    if (pins.length) L.push(`Pinned: ${pins.join('; ')}`);
    if (cfg.segments) for (const s of cfg.segments) {
      if (s.type === 'normal') continue;
      L.push(`[${s.type === 'intermission' ? 'Intermission' : s.type === 'burn' ? 'Burn x' + s.mult : 'AoE x' + s.targets} ${fmtT(s.start)}-${fmtT(s.end)}]`);
    }
    windows.forEach((w, i) => {
      const wt = Math.min(...w.acts.map(a => Math.round(a.intent)));
      L.push(`[Window ${i + 1} @ ${fmtT(wt)}]`);
      const acts = w.acts.slice().sort((a, b) => Math.round(a.intent) - Math.round(b.intent) || ALL_BUFFS.indexOf(a.k) - ALL_BUFFS.indexOf(b.k));
      for (const a of acts) L.push(`  ${fmtT(Math.round(a.intent))}  ${a.coldSnap ? 'Cold Snap -> ' : ''}${BUFFS[a.k].name}`);
    });
    return L.join('\n');
  }, { c, gear, kit, ALL_BUFFS });
  if (perr) { console.error('PAGEERROR on', c.name, ':', perr); await browser.close(); process.exit(2); }
  results[c.name] = plan;
}
await browser.close();

if (update) {
  fs.writeFileSync(goldenPath, JSON.stringify(results, null, 2) + '\n');
  console.log(`Wrote ${Object.keys(results).length} cases → ${path.relative(process.cwd(), goldenPath)}`);
  process.exit(0);
}

let pass = 0, fail = 0, missing = 0;
for (const c of spec.cases) {
  const got = results[c.name], want = golden[c.name];
  if (want === undefined) { missing++; console.log(`MISSING  ${c.name}   (run with --update to record)`); continue; }
  if (got === want) { pass++; console.log(`PASS  ${c.name}`); continue; }
  fail++;
  console.log(`\nFAIL  ${c.name}`);
  const gl = got.split('\n'), wl = want.split('\n'), n = Math.max(gl.length, wl.length);
  for (let i = 0; i < n; i++) {
    if (gl[i] === wl[i]) continue;
    if (wl[i] !== undefined) console.log(`   - ${wl[i]}`);
    if (gl[i] !== undefined) console.log(`   + ${gl[i]}`);
  }
}
console.log(`\n${pass} passed, ${fail} failed${missing ? `, ${missing} missing` : ''}`);
process.exit(fail || missing ? 1 : 0);
