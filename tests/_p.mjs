import { loadEngine, ALL_BUFFS } from '../tools/engine-node.mjs';
const api = loadEngine(new URL('../index.html', import.meta.url).pathname);
const KIT = ['icyVeins','isc','scb','arcanePower','berserking','bloodlust'];
const mk = (T, noSlip) => () => ({ T, hasteRating:0, sp:1000, critPct:25,
  enabled: Object.fromEntries(ALL_BUFFS.map(k=>[k, KIT.includes(k)])),
  fixed:{ bloodlust:[20] }, warnings:[], coldSnap:true, segments:null, _noSlip:noSlip });
const one = (api.GAME.AB.AVG_BASE_DMG + api.GAME.AB.COEF*1000)*(1+0.25*(api.GAME.CRIT_MULT-1));
const I = (s,f) => { const c=f(); return api.simulate(api.repair(JSON.parse(JSON.stringify(s)),c),c,true).integral/one; };
const T1 = { icyVeins:[0,20], isc:[20], scb:[20], arcanePower:[20], bloodlust:[20] };
for (const noSlip of [false, true]) {
  console.log(`\n══ _noSlip = ${noSlip} ══`);
  const f1 = mk(120,noSlip), f2 = mk(180,noSlip);
  process.stdout.write('  T1 zerk 39..44 :');
  for (let t=39;t<=44;t++) process.stdout.write(` ${I({...T1,berserking:[t]},f1).toFixed(5)}`);
  const base = t => ({ icyVeins:[t,140], isc:[t,140], scb:[t,140], arcanePower:[t], bloodlust:[20], berserking:[140] });
  process.stdout.write('\n  T2 cluster 20..25 (zerk@140) :');
  for (let t=20;t<=25;t++) process.stdout.write(` ${I(base(t),f2).toFixed(5)}`);
  const T2 = base(20);
  console.log(`\n  T2 declared (zerk@140) ${I(T2,f2).toFixed(5)}  vs Berserking moved into Lust @41 ${I({...T2,berserking:[41]},f2).toFixed(5)}`);
}
