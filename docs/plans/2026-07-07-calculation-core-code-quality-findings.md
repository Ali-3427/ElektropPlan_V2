# calculation-core — Code Quality Findings (scan only)

> **Status: documentation only.** This is a scan report from `code-simplifier`, not an executed fix. No code in `packages/calculation-core` has been changed as a result of this document. Fixes will be planned and executed in a later session, on a dedicated branch, one task at a time — do not treat this as a to-do list to run through blindly.

**Scope:** `packages/calculation-core/src` — cable sizing, motor calculations, voltage-drop (single/group/tree), protection lookup, and shared `common/` (constants, precision, types, units, validation).

**Why this matters more than usual:** this package is the actual electrical calculation engine behind the app's numbers. Several findings below are not just style — they're candidate correctness bugs that could silently produce wrong cable/current/voltage-drop results.

---

## Correctness smells (highest priority — verify before touching)

### F1 — Two conflicting conductor-resistance models

- `voltage-drop/resistance.ts` derives resistance from resistivity constants `RHO_COPPER_20 = 0.01724`, `RHO_ALUMINUM_20 = 0.02826` (`common/constants/index.ts:1-2`), and applies temperature correction via `alpha`/`conductorTempC`.
- `voltage-drop-tree/optimizer.ts:77-79` (`getConductivity`) hardcodes conductivity `56`/`35` S·m/mm² instead — implied resistivity `0.01786`/`0.02857`, which does **not** match the primary model's constants, and applies **no** temperature correction at all.
- **Risk:** the tree/optimizer engine and the primary voltage-drop engine can disagree on the same cable/run.
- **Needs a decision, not just a fix:** is `optimizer.ts`'s model an intentional legacy/simplified mode (kept for a reason), or a stale duplicate that should call the shared resistance model? Check git history / `decisions.md` / `FREEZE_CHECKLIST.md` before changing.

### F2 — Magic numbers in the legacy resistance/drop path

- `optimizer.ts:78` — the `56`/`35` conductivity constants, inline, unnamed.
- `optimizer.ts:106` (`calculateLegacyDropPercent`) — `100`/`200` multiplier, inline, unnamed.
- Fix (once F1's design question is resolved): promote to named constants in `common/constants`, matching the existing `RHO_*`/`ALPHA_*` naming style.

### F3 — 3-phase current calc ignores LN vs LL in derived-outputs

- `motor-derived-outputs/formulas.ts:14-28` (`calcDerivedCurrent`) always uses `SQRT3` for 3-phase, regardless of voltage mode.
- `motor/formulas.ts` (the other motor module) correctly branches LL vs LN for 3-phase.
- **Risk:** if a derived-outputs caller passes a line-to-neutral voltage, the computed current is wrong by a factor of √3.
- Fix: mirror `motor/formulas.ts`'s LL/LN branch in `motor-derived-outputs/formulas.ts`, or share one implementation (see F5).

### F4 — `cosPhi` validated three inconsistent ways

- `voltage-drop/index.ts:66` — rejects `cosPhi <= 0`.
- `motor/validate.ts:44,46` and `motor-derived-outputs/validate.ts:33,37` — call `assertPositive` **and** `assertInRange(..., 0, 1)` (the range check already implies positivity when min is 0, so the positive check is redundant, and the two guards can be read as slightly different intents).
- Fix: pick one canonical guard (likely `assertInRange(cosPhi, 0, 1)`, exclusive at 0) and use it everywhere `cosPhi` is validated.

---

## Duplication

### F5 — Current-from-power formula reimplemented 4×

Same `1000·P / (k·V·cosφ·η)` math, written independently in:
- `voltage-drop/power-to-current.ts`
- `motor/formulas.ts:18-43`
- `motor-derived-outputs/formulas.ts:14-28`
- `optimizer.ts:85-96`

Candidate: one shared helper in `common/`, parameterized by phase/LL-LN, that all four call. Fixing F3 as part of this consolidation avoids fixing the same bug twice.

### F6 — `calcInputPower`/`calcApparentPower` duplicated under different names

- `motor/formulas.ts:4-16` — `calcInputPower`, `calcApparentPower`.
- `motor-derived-outputs/formulas.ts:6-12` — `calcMotorInputPower`, `calcMotorApparentPower`.

Identical math, different names/signatures. Candidate for one shared implementation.

### F7 — `voltage-drop-tree` and `voltage-drop-group` parallel-implement the same concerns

- `SegmentResolvedSettings` type + segment/global settings-merge logic: `optimizer.ts:32-40,113-134` vs `voltage-drop-group/algorithm.ts:25-59`.
- Default-settings → assumptions loop: `voltage-drop-tree/index.ts:85-101` vs `algorithm.ts:309-321`.
- Segment validation: `voltage-drop-tree/index.ts:41-83` vs `algorithm.ts:61-103`.

Both modules look like they evolved in parallel rather than sharing a base. Worth a design pass on whether `tree` should be built on top of `group`'s primitives (or vice versa) rather than duplicating.

---

## Dead code / hygiene

- **F8** — Unused import `assertInRange` in `voltage-drop/index.ts:9`.
- **F9** — Unused parameter `determineLoadedConductors(_installationMethod)` in `cable/algorithm.ts:81-86` — publicly exported with a dead param.

---

## Complexity / clarity

- **F10** — `algorithm.ts:168-170` — a ternary whose two inner branches are identical: `explicitTopology ? (index === 0 ? (segment.parentId ?? null) : (segment.parentId ?? null)) : …`. Simplify to remove the redundant inner branch.
- **F11** — `optimizer.ts` is 485 lines; `selectBestCandidate` (257-366) is long, deeply nested, with many defensive `throw`s guarding "impossible" map-miss states. Candidate for extraction into smaller named steps once F1/F7 are resolved (don't restructure it twice).
- **F12** — `voltage-drop/index.ts` validates `cosPhi` twice (`validateVoltageDropInput` at line 104, then again in the main body at line 198), and `calculateVoltageDropBySystem` masks with `cosPhi ?? 0` defaults (lines 153, 168) — obscures whether `cosPhi` is actually guaranteed defined at that point.

---

## Suggested order for the work phase (not started yet)

1. **F1** — resolve the design question first (legacy-mode-by-design vs bug); everything else in the resistance/current family depends on this answer.
2. **F3** — LN/LL current bug, once F1's answer clarifies which model `motor-derived-outputs` should follow.
3. **F5 / F6** — consolidate the power→current duplication (naturally fixes F3 in one place instead of two).
4. **F2, F4, F8, F9, F10** — mechanical, low-risk cleanup, safe to batch.
5. **F7, F11, F12** — larger structural changes; do last, in isolation, with full test suite (`pnpm --filter @elektroplan/calculation-core test`) run before/after.

**Verify commands (per package):**
- `pnpm --filter @elektroplan/calculation-core typecheck`
- `pnpm --filter @elektroplan/calculation-core test`
- `tests/worked-examples` fixtures should be re-run after any F1/F3/F5 change, since those are the closest thing to a correctness oracle for this package.
