// INTERNAL CONSISTENCY — no sim anywhere. THE STANDING SCORER GATE.
//
// The model computes the same fight two ways:
//   (1) the DISCRETE cast walk: for each Arcane Blast it already knows haste, stacks (=> cast time),
//       AP on/off, SP buffs, crit -> `casts[i].dmg`, times the BOUNDARY CREDIT that cast earned.
//   (2) the RATE INTEGRAL over breakpoint spans.
// Until 2026-07-27 (2) was `robust` — what ranked every plan — and the two differed by a **median
// 0.2114 % of score, max 1.4263 %** over 2755 plan-scorings, against a corpus whose entire deficit
// range is 0.004–0.380 % and whose ranking margins are ~0.005–0.07 %. The model disagreed with itself
// by ~30x the effect it was being asked to resolve.
//
// ── ⚠ THE CREDIT RULE CHANGED (PHASE12 §9, user ruling 07-27) — AND SO DID THIS FILE ─────────────
// `KILL_WINDOW` and the SYMMETRIC kill taper are RETIRED from the objective. This tool used to
// recompute arm (1) with its own copy of that taper — `KW=0.5`, `min(1,max(0,(T+KW-tc)/(2*KW)))`,
// read at the cast's COMPLETION. That copy is gone. The one uniform rule is now, per cast:
//
//     credit = min(1, (nextCut - castStart) / castDuration)          ← NO taper, read at the START
//
// a one-sided window whose width is the cast's own duration, applied identically at every cut (the
// fight end T, an intermission start, either edge of an AoE phase). A cast completing exactly at T
// now earns a FULL cast where the retired taper paid it 0.5. Recomputing with the old taper here
// would report a permanent nonzero gap that is not a bug — the loudest possible false alarm.
//
// ── WHAT THIS GRADES, AND WHY IT IS NOT CIRCULAR ─────────────────────────────────────────────────
// `robust` is now the per-cast credited sum, so "robust vs the cast sum" could be made trivially zero
// by construction. It is not, and keeping it that way is the entire value of this file:
//   · `robust` is accumulated INSIDE the board walk on every call (the optimizer scores with
//     `collect` off), and is read here EXACTLY ONCE, as the graded quantity.
//   · the number checked against it is rebuilt from the `casts` array out of `t`, `cast` and `dmg`
//     only. ⛔ It deliberately does NOT read the board's `credited` field, and does NOT read its
//     `frac` field either — both are written by the same statement that feeds the accumulator, so
//     summing them would grade the scorer against itself and print 0.00e+0 no matter what broke.
//     The credit fraction is re-derived here from the cast's own start and duration.
// So a zero says the thing that RANKS and the board the tool SHOWS are the same quantity — the exact
// invariant that was broken, and the exact one a future refactor would break again.
//
// `frac`/`credited` ARE read, but only for the secondary agreement counter below, which is a
// different question (does the board report the credit the walk applied?) and never the verdict.
//
// ⚠ SCOPE: this corpus is `segments: null` by construction (`mk` below, and BOSS tables are skipped),
// so the ONLY cut is `cfg.T` and re-deriving the credit needs no cut lattice. The assertion at the
// scoring site refuses a segmented cfg rather than silently crediting against the wrong cut.
//
// The old gap is still printed, from the returned `integral`. ⚠ Read it as "the RETIRED rate integral
// vs the LIVE objective" — it now folds in the credit-rule change as well as discrete-vs-continuous,
// so it is no longer the clean 0.2114 % measurement that opened the phase. Diagnostic, never a verdict.
import crypto from 'node:crypto'; import fs from 'node:fs'; import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadEngine, ALL_BUFFS } from '/home/user/Kory123/tools/engine-node.mjs';
import { REF, plainCastInPage } from '/home/user/Kory123/tools/reference-gear.mjs';
// ⚠ TWO index.html's, on purpose. `IDX` is the ROUND BLOB: the plan cache keys on its sha1, so it is
// the only file whose plans can be looked up. `ENGINE` is the engine those plans are SCORED with, and
// it defaults to the working tree — otherwise this gate would measure the very engine it is meant to
// check the change against. Plans are inputs here; the scorer is the thing under test.
const REPO=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
// ⚠ `IDX` is the ROUND BLOB — the file the plan cache keys on, so it is what looks plans UP. It is
// NOT the scorer under test (that is `ENGINE`, below). It used to default to `/tmp/index-round.html`,
// a session scratch file, so the project's headline gate — the one CLAUDE.md says to run after ANY
// change to `simulate()` — died on a raw `node:fs` stack trace in any fresh container. A standing
// gate that only runs on one machine is not a standing gate. Fall back to the repo's own index.html
// and SAY SO, because a silent fallback would quietly change which cached plans are found.
const ROUND=process.env.ROUND_INDEX;
let IDX=ROUND||path.join(REPO,'index.html');
if(!fs.existsSync(IDX)){console.error(`ERROR: ROUND_INDEX=${IDX} does not exist.`);process.exit(2);}
if(!ROUND)console.error('note: no ROUND_INDEX set — keying the plan cache on the repo\'s own index.html.\n' +
  '      Cached plans from a different engine will simply not be found, so the corpus may be smaller.');
const ENGINE=process.env.ENGINE||path.join(REPO,'index.html');
const api=loadEngine(ENGINE);
const PLAIN=new Function('GAME','R',`return (${plainCastInPage.toString()})(R);`)(api.GAME,REF);
const EID=crypto.createHash('sha1').update(fs.readFileSync(IDX)).digest('hex').slice(0,12);
// The boundary credit, RE-DERIVED (not read off the board). `c.t` is the cast's start and `c.cast`
// its duration, both raw board fields; with one cut at T this is `min(1,(T-start)/duration)`. The
// `>1e-9` guard mirrors the engine's refusal to emit NaN on a degenerate zero-length cast.
const creditOf=(c,T)=>c.cast>1e-9?Math.min(1,Math.max(0,(T-c.t)/c.cast)):0;
const planOf=cfg=>{const k='plan-'+crypto.createHash('sha1').update(JSON.stringify({cfg,engine:EID,restarts:14})).digest('hex').slice(0,24);
  const f=path.join(REPO,'.xval-cache',k+'.json'); return fs.existsSync(f)?JSON.parse(fs.readFileSync(f,'utf8')).s:null;};
const dir=path.join(REPO,'tools/xval-results'); const gaps=[]; let n=0;
let boardFracBad=0, boardCreditBad=0;   // secondary: does the board REPORT what the walk applied?
for(const f of fs.readdirSync(dir).filter(x=>x.endsWith('.txt')).sort()){
  const txt=fs.readFileSync(path.join(dir,f),'utf8'); const d=txt.match(/^XVAL-DONE .*/m); if(!d) continue;
  const kv=Object.fromEntries([...d[0].matchAll(/(\w+)=(\S+)/g)].map(x=>[x[1],x[2]]));
  if(String(kv.class).startsWith('BOSS:')) continue;
  const L=txt.split('\n'), hi=L.findIndex(l=>l.startsWith('plan\\sim')); if(hi<0) continue;
  const H=L[hi].trim().split(/\s+/).slice(1).map(Number);
  const kit=['icyVeins',...kv.kit.split('+'),'arcanePower','berserking','bloodlust'];
  const en={}; for(const k of ALL_BUFFS) en[k]=kit.includes(k);
  const mk=h=>({T:+kv.T,hasteRating:h,...REF,enabled:en,fixed:{bloodlust:[+kv.lust]},warnings:[],coldSnap:true,segments:null});
  const champ={}; let ok=true; for(const h of H){const s=planOf(mk(h)); if(!s){ok=false;break;} champ[h]=s;}
  if(!ok) continue;
  for(const simH of H){ const cfg=mk(simH);
    if(cfg.segments) throw new Error('self-consistency: cfg carries segments, so T is not the only cut and '+
      'creditOf() would credit against the wrong boundary. This corpus is meant to be segments:null.');
    for(const ph of H){
      const r=api.simulate(champ[ph],cfg,true);
      const counted=r.casts.reduce((a,x)=>a+x.dmg*creditOf(x,cfg.T),0);
      // Secondary, NOT the verdict: the board's own `frac`/`credited` against the re-derivation.
      for(const x of r.casts){ const f=creditOf(x,cfg.T);
        if(Math.abs((x.frac??NaN)-f)>1e-12) boardFracBad++;
        if(Math.abs((x.credited??NaN)-x.dmg*f)>1e-9) boardCreditBad++; }
      gaps.push({gapEff:(r.robust-counted)/PLAIN, gapPct:100*(r.robust-counted)/r.robust,
                 oldEff:((r.integral??r.robust)-counted)/PLAIN, oldPct:100*((r.integral??r.robust)-counted)/r.robust});
      n++;
    }
  }
}
const g=gaps.map(x=>x.gapEff).sort((a,b)=>a-b), p=gaps.map(x=>Math.abs(x.gapPct)).sort((a,b)=>a-b);
const og=gaps.map(x=>x.oldEff).sort((a,b)=>a-b), op=gaps.map(x=>Math.abs(x.oldPct)).sort((a,b)=>a-b);
const med=v=>v.length%2?v[(v.length-1)/2]:(v[v.length/2-1]+v[v.length/2])/2;
// ⛔ ZERO SCORINGS IS NOT A PASS. Without a matching ROUND_INDEX the plan cache is keyed on a
// different engine hash and nothing is found — the gate then had NO data and crashed on an empty
// array, which at least was loud. Refuse explicitly instead: "the model agrees with itself" over an
// empty set is the single most reassuring wrong answer this repo knows how to produce, and it has
// shipped that shape three times (xval-collect, xval-verify, the wrapper banners).
if(!n){console.error('ERROR: 0 plan-scorings — the plan cache holds nothing for this engine hash.\n' +
  '       Point ROUND_INDEX at the index.html the cached plans were solved with, or re-solve.\n' +
  '       Refusing to report a verdict over an empty set.');process.exit(2);}
console.log(`INTERNAL CONSISTENCY of the model with itself — ${n} plan-scorings, NO SIM`);
console.log(`  plans from ${IDX}  ·  scored by ${ENGINE}\n`);
console.log(`  ★ THE GATE — robust(what RANKS) - creditedCastSum(re-derived from the board):`);
console.log(`     min ${g[0].toExponential(2)}   median ${med(g).toExponential(2)}   max ${g[g.length-1].toExponential(2)}   (effective ABs)`);
console.log(`     |gap| as a % of score:  median ${med(p).toExponential(2)}%   max ${p[p.length-1].toExponential(2)}%`);
const PASS = p[p.length-1] < 1e-9;
console.log(`     ${PASS ? '✓ PASS — one objective, to float precision' : '✗ FAIL — the model still disagrees with itself'}\n`);
console.log(`  (secondary) the board REPORTS the credit the walk applied:  frac mismatches ${boardFracBad}   credited mismatches ${boardCreditBad}` +
            `   ${boardFracBad||boardCreditBad ? '✗ the casts board is lying about its own credit' : '✓'}\n`);
console.log(`  (diagnostic) the RETIRED rate integral - creditedCastSum. ⚠ NOT the phase's clean 0.2114 %:`);
console.log(`  it now mixes discrete-vs-continuous WITH the retired-taper-vs-boundary-credit change.`);
console.log(`     min ${og[0].toFixed(3)}   median ${med(og).toFixed(3)}   max ${og[og.length-1].toFixed(3)}   spread ${(og[og.length-1]-og[0]).toFixed(3)} eff ABs`);
console.log(`     |gap| as a % of score:  median ${med(op).toFixed(4)}%   p90 ${op[Math.floor(0.9*op.length)].toFixed(4)}%   max ${op[op.length-1].toFixed(4)}%`);
console.log(`\n  For scale, the corpus's ENTIRE deficit range is 0.004%-0.380%,`);
console.log(`  and the model's own margins in the deficit columns are ~0.005%-0.07%.`);
// ⚠ The exit code covers the secondary too. A board that misreports its own `frac`/`credited` is
// broken even when the accumulator happens to be right, and printing that while exiting 0 is exactly
// the "loud output, quiet pass" failure this repo keeps catching.
process.exit(PASS && !boardFracBad && !boardCreditBad ? 0 : 1);
