// PHASE8 §25.5a — does COMPLETING the lattice-quantization family rescue its sign against B2?
// Combines this phase's ANCHORED value half (§22) with §13.8's measured haste half (the only U
// measurement that exists) — no haste implementation needed, and none is sound (§25.5).
// Pure arithmetic over two recorded tables; no engine load, no sim.
// §13.8 measured the haste half with the flat ruler: U(h40)=0.075, U(h70)=0.105 (% of plan).
// Quantization says S = M - L + U, so the correction's effect on the B2 differential is
//   Delta = [L-U](h40) - [L-U](h70).  Negative = closes B2. §13.8 flat: +0.065.
const L={h40:+0.0214,h70:-0.1346};   // PHASE8 §22, anchored ruler
const U={h40:+0.075, h70:+0.105 };   // PHASE8 §13.8, flat ruler (the only measurement that exists)
const net=p=>L[p]-U[p];
console.log('              L(anchored)   U(§13.8)     net = L-U');
for(const p of ['h40','h70'])
  console.log(`  ${p}:        ${L[p].toFixed(4).padStart(9)}  ${U[p].toFixed(4).padStart(9)}   ${net(p).toFixed(4).padStart(9)}`);
const d=net('h40')-net('h70');
console.log(`\n  Delta(net) = ${d>=0?'+':''}${d.toFixed(4)} pp     (flat-ruler equivalent, §13.8: +0.0650)`);
console.log(`  B2 needs a NEGATIVE Delta to close its -0.380 pp gap.`);
console.log(d<0?'  ★ COMPLETE FAMILY FLIPS — the haste half rescues it.'
              :`  ✗ COMPLETE FAMILY IS STILL ANTI-B2 (+${d.toFixed(4)}). U would have to exceed`);
if(d>=0){
  // how big would U's differential have to be to flip the sign?
  const need=L.h40-L.h70;                     // Delta = (L40-L70) - (U40-U70) < 0  =>  U40-U70 > L40-L70
  console.log(`    dU = U(h40)-U(h70) > dL = ${need.toFixed(4)} pp to flip. Measured dU = ${(U.h40-U.h70).toFixed(4)} pp`);
  console.log(`    — i.e. the haste half is the WRONG SIGN too (dU is negative), so it makes the`);
  console.log(`      differential WORSE, not better. The family cannot be rescued by completing it.`);
}
