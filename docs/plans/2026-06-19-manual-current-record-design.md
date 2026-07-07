# Design: Manual Current Record (`manual-current`)

Date: 2026-06-19

## Problem

Group total current sums only `motor` records (see
`getRecordUnitCurrentA` in `useProjectsData.ts`). In large panel calculations
some outgoing feeds are breaker-only (no motor/kW calc), so their current can't
be added to the group total — the user has to sum them by hand.

## Goal

Let the user add manual ampere line-items directly into a group. Each manual
entry contributes to the group's total current (and therefore to the group cable
suggestion, which is driven by `group.totalCurrentA`).

## Decisions

- **Approach A — new calculator record type** `manual-current` (reuses the
  existing record card / delete / quantity / cable-suggest infrastructure).
- **Multiple labeled rows** per group: each row has `label`, `currentA`,
  `quantity`.
- **Entry points:** both the Quick Panel and the Projects page (per-group inline
  form). Manual rows render as record cards in the group's record list.
- **Editable:** ampere/label of an existing row are editable in the Projects-page
  detail panel (`RecordDetail`), plus quantity and delete.
- **YAGNI:** no phase/voltage selection. The ampere is treated as a raw line
  current and summed the same way motor currents already are.

## Data model — `packages/contracts/src/schemas.ts`

- Add `"manual-current"` to `calculatorKindSchema`.
- `manualCurrentRequestSchema = z.object({ currentA: z.number().finite().nonnegative(), label: z.string().min(1).optional() }).strict()`.
- `manualCurrentResponseSchema = z.object({ value: z.object({ currentA: z.number() }).strict() }).strict()`
  (no engine fields — there is no calculation, so no `engineVersion`).
- `manualCurrentCalculationRecordSchema = recordBaseSchema.extend({ calculator: z.literal("manual-current"), input: manualCurrentRequestSchema, output: manualCurrentResponseSchema })`.
- Add it to the `calculationRecordSchema` discriminated union.
- `contractVersion` stays `"1"` — adding a union member is backward compatible;
  existing data still validates, no migration.
- Add a fixture to `packages/contracts/src/schema.test.ts`.

`records-service.saveRecord` already validates via `calculationRecordSchema.parse`,
so no service code change is needed.

## Bridge types — `apps/desktop/renderer/src/bridge/types.ts`

- Add `"manual-current"` to `CalculatorKind`.
- `ManualCurrentRequest { currentA: number; label?: string }`,
  `ManualCurrentResponse { value: { currentA: number } }`.
- `ManualCurrentCalculationRecord` interface; add to the `CalculationRecord`
  union.

## Aggregation — `useProjectsData.ts`

- `getRecordUnitCurrentA`: return `output.value.currentA` for **both** `motor`
  and `manual-current`. All other calculators stay `0`.
- `CALCULATOR_LABELS["manual-current"] = "Manuel akım"`.
- `getRecordDisplayTitle`: for `manual-current`, fall back to `input.label`.
- `getRecordMotorPowerKW` returns `null` for `manual-current` (already true for
  non-motor).

## Mutations — `apps/desktop/renderer/src/features/projects/projectMutations.ts`

- `createManualCurrent({ groupId, label, currentA, quantity })`: builds a record
  with `crypto.randomUUID()`, `calculator: "manual-current"`, `title = label`,
  `grouping: { groupId, ...(quantity>1?{quantity}:{}) }`,
  `version: { contractVersion: "1" }`,
  `input: { currentA, ...(label?{label}:{}) }`,
  `output: { value: { currentA } }`. Saves via bridge, invalidates project
  queries.
- `updateManualCurrent({ record, label, currentA })`: rewrites input/output/title
  and saves.
- Delete and quantity reuse existing `deleteRecord` / `updateRecordQuantity`.

## UI

- **Quick Panel + Projects page**: each group gets a "+ Manuel akım" toggle that
  reveals an inline form (label + ampere + quantity → add). Manual rows appear in
  the existing per-group record list as cards badged "Manuel akım", with a delete
  affordance.
- **RecordDetail** (Projects page right column): when a `manual-current` record is
  selected, show editable label + ampere fields with a save button, plus the
  existing quantity and delete controls.

## Verification

No test runner in the repo (`test` is a no-op). Verify with:
- `tsc --noEmit` for main, preload, renderer.
- Electron diagnostic harness with a mock bridge: add a manual-current record and
  confirm the group total and cable suggestion increase, the card renders with the
  "Manuel akım" badge and label, and edit/delete work.
