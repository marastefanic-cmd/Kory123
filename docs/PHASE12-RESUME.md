# PHASE 12 — RESUME HERE (checkpoint, 2026-07-27)

**This is the clear checkpoint.** The tree is green, the objective is settled, and the next piece of
work is named below. Read `docs/PHASE12.md` §0 (the charter) and §9 (what just landed) for depth.
Delete this file when the phase closes.

## 1. ✅ THE SUITE IS GREEN — that is new, and it is the point

`exact-match` reads **25 passed, 0 failed**. It had been red *on purpose* since the objective work
(plans moved by design and the goldens were deliberately not re-recorded). They are re-recorded now,
against a scorer that is settled rather than provisional, and they reproduce.

```
exact-match          25 passed, 0 failed          self-consistency   0.00e+0 / 2755 scorings
window-span  pass    credit-check  pass           snapshot-rule      pass
wall-credit  pass    sim-duel      pass           sim-request        9/9 (native runner)
press-headtohead     HELD 18 → 1 of 196 presses
```

## 2. What the objective IS now, in one place

For every Arcane Blast the walk knows haste, stacks (⇒ cast time), which buffs apply, and crit — so
`dmg` is exact, and the objective is that sum. On top of it, **one boundary rule at every cut**:

```
credit = min(1, (nextCut − castStart) / castDuration)      × that cast's own value
```

A **cut** is the fight end, an intermission start, or either edge of an AoE phase. A **burn** edge is
not — the boss is targetable and the spell is the same, so a burn multiplier is a *value* question
under the snapshot rule, not a *landing* question.

★ It is a **one-sided window whose width is the cast's own duration**, not a smoothing fudge: for
`cut ~ U[C, C+d]`, `(C+d−completion)/d = (C−start)/d`. A cast completing exactly at a cut earns a
**full** cast. The retired symmetric taper paid it 0.5, which is where that number came from.

⇒ `total`, `robust` and `totalEarly` are now **one number**. The board carries `frac` and `credited`;
`dmg` stays the cast's full damage.

Cooldowns chain from the **fire** moment (`auraAt`), not the press — the model can no longer emit a
plan the sim declines to execute.

## 3. ▶▶ THE NEXT ACTION — the AoE edge, decided on its own merits

The AoE phase boundary currently inherits the intermission's treatment: a cast straddling into an AoE
phase is docked. **That is the one part of the rule that was never argued for.** The boss *is*
targetable during an AoE phase — an Arcane Blast completing inside one lands, for full damage; you
would simply rather have been casting Arcane Explosion. So the question is not "does it land" but
"what should you have been casting", which is a different question with a different answer.

Decide it deliberately. `docs/PHASE12.md` §9.5 has the framing; `tools/wall-credit.mjs` is the gate to
extend once it is decided.

## 4. The open question this created, stated so nobody trips on it

**`sim/benchmark.mjs`'s `variation: 0.5` is no longer matched to anything in the model.** It used to
be justified as "the model's kill-window WIDTH" — that constant is gone. It stays at 0.5 on its own
measured evidence (`tools/var-decision.mjs`), as the **sim's** way of not parking its fight end on a
discontinuity.

So model and sim now smooth the same problem by different means: the model analytically (partial
credit), the sim numerically (averaging over T ± 0.5). Reconciling their two answers is **open**.

⛔ **Do not "fix" it by flipping `variation` to 0.** That reintroduces a measured failure: at var 0,
when two arms differ in terminal cast rate the effect swings −32.8 → −0.9 → −31.8 DPS across 0.1 s of
fight length. The route the user named is the one to build: at a fixed T the sim's completed-cast set
is deterministic and `model-audit` already requires the model to predict the log **cast for cast**, so
both sides agree on the straddling cast's start and duration — the partial credit is then a
deterministic function of numbers they already share, and needs **no extra sim run**.

## 5. ⛔ `docs/ACCEPTANCE.md` still has no current reading

Its gear-B verdict (36/36 tables, invariant A passes, B2 fails at 142/345) was gathered against the
pre-PHASE12 scorer and is void as a **model** verdict. The tables stay — they are the append-only
record and the evidence trail. Re-gathering is now mostly arithmetic, not sim time: `xval-model.mjs`
re-optimises and cross-scores at every haste with no sim at all.

## 6. Loose ends, none blocking

- **`tools/model-audit.mjs` on multi-use fights** — was 17 of 23 failing before the chain fix; not
  re-run at scale since. Re-run it: it is the standing bar and the chain fix is exactly what it was
  measuring.
- **Retired instruments, now labelled** — `tail-phase-probe` exits 2 (its `robust − totalEarly` is
  identically 0 now); `p8-round10`'s F3 degeneracy guard reports permanently vacuous.
- **`lattice-ripple` / `ripple-audit`** still say "the model computes the CONTINUUM LIMIT of the same
  taper — the widths match". False now; and `ripple-audit` already fails its own P3/P5 self-checks
  (archive/11 §8.30), so it needs re-deciding, not just re-wording.
- **The printed press second** is wrong on 1.8 % of presses (§6.13) — presentation, explicitly after
  the model per user ruling.
- **PHASE11** (CI bring-up, the module split) is still demoted behind this.

## 7. What is safe to touch again

The `index.html` freeze is **lifted** — no round is gathering, and master is merged in (the UI branch
landed here, verified plan-neutral by `plan-sweep` before the scorer change went in). The import
closure that mattered during a round (PHASE12 §1.1e) is only frozen *while a round gathers*.
