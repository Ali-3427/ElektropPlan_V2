# calculation-data — Code Quality Findings (scan only)

> **Status: documentation only.** This is a scan report from `code-simplifier`, not an executed fix. No code in `packages/calculation-data` has been changed as a result of this document (except deleting the stray `dist-old/` build artifact, done separately as routine cleanup, not a code fix). Fixes will be planned and executed in a later session, on a dedicated branch, one task at a time.

**Scope:** `packages/calculation-data/src` — IEC 60364-5-52 reference datasets and accessors: `iec/ampacity`, `iec/grouping-factors`, `iec/harmonic-factors`, `iec/temperature-factors`, `iec/protection-catalog`, `iec/cable-ruler`, `iec/motor-ruler`, `iec/installation-methods`, `dataset/materials`, `profiles/voltage-drop-limits`, `profiles/default-assumptions`. Consumed by `packages/calculation-core`.

---

## High impact — duplication & shared-helper opportunities

### F1 — Metadata-validation logic copy-pasted across 5 dataset modules

Every `dataset.ts` re-declares `REQUIRED_STANDARD`/`REQUIRED_REVISION`/`REQUIRED_VALID_FROM` and an identical `standard !== ... || revision !== ... || validFrom !== ...` check:
- `iec/ampacity/dataset.ts:20-49` (`assertRequiredMetadata`)
- `iec/grouping-factors/dataset.ts:10-39`
- `iec/harmonic-factors/dataset.ts:11-54`
- `iec/temperature-factors/dataset.ts:8-22`
- `iec/protection-catalog/dataset.ts:17-114`

Fix: one `assertReferenceMetadata(dataset, { standard, revision, validFrom }, label)` in `dataset/load-json-dataset.ts`. Note `protection-catalog` uses a different standard (`"project-seed-catalog"`) — the helper needs that as a parameter, not a constant.

### F2 — "Strictly ascending" guard duplicated

`ampacity/dataset.ts:86-91`, `grouping-factors/dataset.ts:23-25`, `temperature-factors/dataset.ts:43-48` all reimplement the same ascending-order check. Candidate: shared `assertAscending(values, label)`.

### F3 — "Columns match locked schema" guard duplicated

`cable-ruler/dataset.ts:85-92`, `motor-ruler/dataset.ts:57-64`, `protection-catalog/dataset.ts:21-35` repeat the same length-plus-index-equality check.

---

## Medium — inconsistent conventions

### F4 — Divergent "not found" / validation semantics across accessors

- Most return `undefined` on miss: `getAmpacity`, `getGroupingFactor`, `getTempFactor`, `getMotorTableEntryByKW`, `getProfileById`.
- `getDefaultProfile` (`voltage-drop-limits/accessors.ts:8-15`) **throws** instead.
- `lookupProtectionDevice` returns `[]`.
- `getHarmonicFactor` mixes both: throws on negative input (line 36-38) and on null factor (53-55), but returns `undefined` on no-match.
- Input validation is uneven too: `lookupProtectionDevice`/`getHarmonicFactor` validate args; `getGroupingFactor`/`getTempFactor`/`getAmpacity` silently accept NaN/negative input.

Worth standardizing once a decision is made on which convention is canonical (throw vs `undefined` vs `[]`).

### F5 — Inconsistent "data version" string format

- `getCableRulerDataVersion` → `` `${id}:${revision}` `` (`cable-ruler/accessors.ts:8-10`)
- `getVoltageDropDataVersion` → bare `metadata.revision` (`voltage-drop-limits/accessors.ts:23-25`)
- `getMaterialSeed` → bare `metadata.revision`

Same concept, three shapes. Pick one format.

---

## Medium — data/code coupling smells

### F6 — Hardcoded row/profile counts in `.ts` that must track the JSON by hand

- `CABLE_RULER_EXPECTED_ROW_COUNT = 18` (`cable-ruler/dataset.ts:12`)
- `MOTOR_TABLE_EXPECTED_ROW_COUNT = 23` (`motor-ruler/dataset.ts:12`)
- `EXPECTED_PROFILE_COUNT = 4` (`voltage-drop-limits/dataset.ts:13`)

Editing a JSON row without updating the constant silently breaks the build. Consider a `metadata.expectedRowCount` field instead, or dropping the guard in favor of the ascending/schema checks (F2/F3) doing the real validation.

### F7 — `DATASET_PATH` literal duplicated per module as the validation "context" string

Could derive from `metadata.id` instead of repeating the path string.

---

## Low — dead code / clutter

- **F8** — `packages/calculation-data/dist-old/` (~120 stale build artifacts) — already deleted as routine cleanup (untracked, same category as the earlier apps/desktop dist-old cleanup).
- **F9** — `VOLTAGE_DROP_LIMITS_DATASET_STATUS` (`voltage-drop-limits/index.ts`, marked "backward-compat"), `DEFAULT_ASSUMPTIONS_DATASET_STATUS` placeholder (`profiles/default-assumptions/index.ts`), and `getVoltageDropDataVersion` are exported but not consumed anywhere outside the package (only `getCableRulerDataVersion` is used by `calculation-core`).
- **F10** — Stray `scripts/build-materials-seed.d.ts` sitting beside `build-materials-seed.mjs`.

---

## Note (not a bug)

`getAmpacity` returning `null` (vs `undefined`) is **intentional** — `AmpacityValue = number | null` (`ampacity/types.ts:7`) distinguishes "method not permitted" from "unknown size". Correct as-is; worth a code comment since F4 groups it with the other accessors at first glance.

---

## Suggested order for the work phase (not started yet)

1. **F1** — the metadata-validation helper; touches the most files, do first so later fixes build on the shared helper instead of duplicating it further.
2. **F2, F3** — mechanical consolidation, low risk, natural follow-on to F1.
3. **F4** — needs a design decision (canonical not-found convention) before touching accessor call sites in `calculation-core`.
4. **F5, F6, F7, F9, F10** — low-risk cleanup, safe to batch.

**Verify commands:**
- `pnpm --filter @elektroplan/calculation-data typecheck`
- `pnpm --filter @elektroplan/calculation-data test` (also see `packages/calculation-data/tests/*.mjs` runners)
