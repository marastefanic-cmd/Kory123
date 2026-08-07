// Dump the canonical copy-as-text plan (the exact string the exact-match suite
// locks) for arbitrary fight configs — for verifying a plan before locking it.
//   node plan.mjs '[{name,T,pins,gear,kit,intermission,phases}, ...]'
import { openPage } from './page-open.mjs';
const CASES = JSON.parse(process.argv[2] || '[]');
// the canonical list, imported — a hand-retyped copy here is the drift pattern §5.7 catalogued
import { ALL_BUFFS } from '../tools/engine-node.mjs';

// ⚠ Over HTTP, never file:// — a Blob Web Worker cannot start on an opaque origin, so the
// optimizer silently never runs. See tests/page-open.mjs.
const { page, errors, close } = await openPage();
const perrOf = () => (errors.length ? errors[0] : null);
const defaults = await page.evaluate(() => ({ gear: window.GOLDEN_DEFAULTS.gear, kit: window.GOLDEN_DEFAULTS.kit }));

for (const c of CASES) {
  const gear = { ...defaults.gear, ...(c.gear || {}) };
  const kit = c.kit || defaults.kit;
  const text = await page.evaluate(async ({ c, gear, kit, ALL_BUFFS }) => {
    const enabled = {};
    for (const k of ALL_BUFFS) enabled[k] = kit.includes(k);
    let segments = null;
    if (c.phases) segments = buildSegments(c.phases.map(p => ({ from: p.from, to: p.to, type: p.type, mult: p.mult || 1, targets: p.targets || 0 })), c.T);
    else if (c.intermission) segments = buildSegments([{ from: c.intermission[0], to: c.intermission[1], type: 'intermission', mult: 1, targets: 0 }], c.T);
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
  const perr = perrOf();
  if (perr) { console.error('PAGEERROR on', c.name, ':', perr); await close(); process.exit(2); }
  console.log(`\n########## ${c.name} ##########\n${text}`);
}
await close();
