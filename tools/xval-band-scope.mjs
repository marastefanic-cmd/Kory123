// THE BAND'S SCOPE, AS A FILTER — PHASE10 §8.18's pre-registered rule, applied mechanically.
//
//   node tools/xval-collect.mjs  tools/xval-results --json /tmp/grade/targets.json
//   node tools/ripple-audit.mjs  /tmp/grade/targets.json --json /tmp/grade/ripple.json
//   node tools/xval-persist.mjs  tools/xval-results > /tmp/grade/persist.txt
//   node tools/xval-band-scope.mjs /tmp/grade/targets.json /tmp/grade/ripple.json \
//        /tmp/grade/persist.txt /tmp/grade/targets-scoped.json
//   node tools/xval-band.mjs /tmp/grade/targets-scoped.json
//
// ── WHY THIS EXISTS ──────────────────────────────────────────────────────────────────────────────
// §8.18 fixed the band's scope BEFORE the widths were visible, precisely so the selection could not
// be made while looking at the data (ACCEPTANCE §6: "a sieve whose thresholds you chose after seeing
// the data is not evidence"). But `xval-band.mjs` takes the collector's WHOLE target array and offers
// only `--top N` — so applying the pre-registered scope meant hand-picking rows, which is exactly the
// step the pre-registration was supposed to remove. This does it from the two instruments' own output
// instead, so the rule is executed rather than remembered.
//
// THE SCOPE, verbatim from §8.18 — the UNION of:
//   1. every column `tools/xval-persist.mjs` names (a rival winning at all-but-at-most-one length),
//      "graded however wide they are, including the ones sitting at 0.007 %"; and
//   2. every column `tools/ripple-audit.mjs` puts `over the floor` or `INDETERMINATE`.
// Everything else is `inside the floor` and non-persistent: the ruler is already coarser than the
// deficit, so a band cannot change any verdict they support.
//
// ⚠ NOT BANDED IS NOT ABSORBED. §5's "no silent caps" and §8.18's closing paragraph both require the
// ungraded count to be PUBLISHED, never folded into a total — so this prints the excluded count and
// the reason each column was excluded, and writes them to `<out>.excluded.json` rather than dropping
// them on the floor.
import fs from 'node:fs';

const die = m => { console.error('ERROR: ' + m); process.exit(2); };
const [targetsPath, ripplePath, persistPath, outPath] = process.argv.slice(2);
if (!targetsPath || !ripplePath || !persistPath || !outPath)
  die('usage: xval-band-scope.mjs <targets.json> <ripple.json> <persist.txt> <out.json>');
for (const p of [targetsPath, ripplePath, persistPath])
  if (!fs.existsSync(p)) die(`${p} does not exist — run the grading chain first.`);

const targets = JSON.parse(fs.readFileSync(targetsPath, 'utf8'));
const ripple = JSON.parse(fs.readFileSync(ripplePath, 'utf8'));
if (!Array.isArray(targets)) die(`${targetsPath} is not the collector's target array.`);
if (!Array.isArray(ripple)) die(`${ripplePath} is not ripple-audit's row array (pass it --json).`);
// A scope computed over nothing is the false-pass shape every instrument here was hardened against.
if (targets.length === 0) die('zero target columns — nothing to scope. (If invariant B held, say so; do not band an empty set.)');
if (ripple.length === 0) die('ripple.json has zero priced rows — the scope would degenerate to the persist list alone.');

// ── set 2: over-floor ∪ INDETERMINATE, keyed on the cell's own locus ─────────────────────────────
// ripple-audit carries the collector's fields through (`{...cell, ...p}`), so kit/class/T/simH match.
const cellKey = r => `${r.kit}|${r.class}|${r.T}|${r.simH}`;
const rippleIn = new Map();
for (const r of ripple) {
  if (r.indet) rippleIn.set(cellKey(r), 'INDETERMINATE');
  else if (!r.inside) rippleIn.set(cellKey(r), 'over-floor');
}

// ── set 1: every kit-column xval-persist names ───────────────────────────────────────────────────
// Its hit lines carry the kit and the haste column, e.g. "isc-mqg h40  <- rival plan@h70  wins 5/5".
// A column is a (kit, sim-haste) pair — NOT a single table — so it selects that column at every
// length, which is what "persistent" means and what the band has to re-measure.
const persistTxt = fs.readFileSync(persistPath, 'utf8');
const persistCols = new Set();
for (const line of persistTxt.split('\n')) {
  const m = line.match(/^\s*([a-z0-9]+[-+][a-z0-9]+)\s+h(\d+)\b/i);
  if (m) persistCols.add(`${m[1].replace('-', '+')}|${+m[2]}`);
}
// The parse is load-bearing, so it must announce a miss rather than silently scope to set 2 alone.
// Cross-checked against xval-persist's OWN count line, so a format change fails loudly instead of
// quietly narrowing the scope to set 2 — the "instrument that can report PASS on no data" shape.
// (A genuine `: 0` is legitimate and must not trip this.)
const claimsHits = /CONSISTENT \(loses <=1 length\) BETTER RIVAL:\s*(\d+)/i.exec(persistTxt);
if (!claimsHits)
  die(`could not find xval-persist's count line in ${persistPath} — its format changed, so the scope ` +
      'would silently drop set 1. Fix the parse, do not proceed.');
if (persistCols.size !== +claimsHits[1])
  die(`xval-persist reports ${claimsHits[1]} persistent column(s) but ${persistCols.size} parsed out of ` +
      `${persistPath}. The scope must match the instrument exactly; fix the parse, do not proceed.`);

const why = t => {
  const reasons = [];
  if (persistCols.has(`${t.kit}|${t.simH}`)) reasons.push('persistent');
  const r = rippleIn.get(cellKey(t));
  if (r) reasons.push(r);
  return reasons;
};

const kept = [], dropped = [];
for (const t of targets) {
  const reasons = why(t);
  (reasons.length ? kept : dropped).push(reasons.length ? { ...t, _scope: reasons.join('+') } : t);
}

fs.writeFileSync(outPath, JSON.stringify(kept, null, 1));
fs.writeFileSync(outPath + '.excluded.json', JSON.stringify(dropped, null, 1));

const tally = {};
for (const k of kept) tally[k._scope] = (tally[k._scope] || 0) + 1;
console.log(`BAND SCOPE (PHASE10 §8.18, pre-registered before the widths were visible)`);
console.log(`  persist columns named : ${persistCols.size}   ${[...persistCols].join(' ')}`);
console.log(`  ripple over-floor     : ${[...rippleIn.values()].filter(v => v === 'over-floor').length}`);
console.log(`  ripple INDETERMINATE  : ${[...rippleIn.values()].filter(v => v === 'INDETERMINATE').length}`);
console.log(`\n  IN SCOPE  ${kept.length}/${targets.length} columns -> ${outPath}`);
for (const [k, v] of Object.entries(tally).sort((a, b) => b[1] - a[1])) console.log(`     ${String(v).padStart(4)}  ${k}`);
console.log(`\n  NOT BANDED ${dropped.length}/${targets.length} — inside the floor AND non-persistent.`);
console.log(`  ⚠ Not banded is NOT passed. The bar is zero borrowed-win columns (ACCEPTANCE B2,`);
console.log(`    user-directed); these are columns this instrument cannot resolve at this taper`);
console.log(`    width, published as ungraded. Loci: ${outPath}.excluded.json`);
