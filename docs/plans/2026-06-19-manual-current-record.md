# Manual Current Record Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a `manual-current` calculation record so users can enter labeled ampere line-items directly into a group; these contribute to the group total current and cable suggestion.

**Architecture:** New member of the existing `calculationRecordSchema` discriminated union. Aggregation in `useProjectsData` counts it like `motor`. Per-group inline add form in both the Quick Panel and Projects page; edit in `RecordDetail`. No new IPC, no service change (`saveRecord` already validates via the schema).

**Tech Stack:** TypeScript, Zod (contracts), React + @tanstack/react-query (renderer), Electron.

Design: `docs/plans/2026-06-19-manual-current-record-design.md`.

---

### Task 1: Contracts schema + test

**Files:**
- Modify: `packages/contracts/src/schemas.ts`
- Modify: `packages/contracts/src/schema.test.ts`

**Step 1: Write the failing test** — add to `schema.test.ts` (after the existing motor record fixture):

```ts
calculationRecordSchema.parse({
  id: "manual-1",
  calculator: "manual-current",
  title: "Priz hattı F3",
  grouping: { groupId: "g1", quantity: 2 },
  version: { contractVersion: "1" },
  input: { currentA: 16, label: "Priz hattı F3" },
  output: { value: { currentA: 16 } },
});
```

**Step 2: Run, verify it fails**

Run: `cd packages/contracts && npm test`
Expected: FAIL (Zod: invalid `calculator` enum / no matching union member).

**Step 3: Implement schema** in `schemas.ts`:

- Add `"manual-current"` to `calculatorKindSchema` enum.
- Before `calculationRecordSchema`, add:

```ts
export const manualCurrentRequestSchema = z
  .object({
    currentA: z.number().finite().nonnegative(),
    label: z.string().min(1).optional(),
  })
  .strict();

export const manualCurrentResponseSchema = z
  .object({
    value: z.object({ currentA: z.number() }).strict(),
  })
  .strict();

export const manualCurrentCalculationRecordSchema = recordBaseSchema.extend({
  calculator: z.literal("manual-current"),
  input: manualCurrentRequestSchema,
  output: manualCurrentResponseSchema,
});
```

- Add `manualCurrentCalculationRecordSchema` to the `calculationRecordSchema` union array.

**Step 4: Run, verify it passes**

Run: `cd packages/contracts && npm test`
Expected: PASS.

**Step 5: Commit**

```bash
git add packages/contracts/src/schemas.ts packages/contracts/src/schema.test.ts
git commit -m "feat(contracts): add manual-current calculation record"
```

---

### Task 2: Bridge types (renderer)

**Files:**
- Modify: `apps/desktop/renderer/src/bridge/types.ts`

**Step 1: Implement** — add `"manual-current"` to `CalculatorKind`; add interfaces and union member:

```ts
export interface ManualCurrentRequest {
  currentA: number;
  label?: string;
}
export interface ManualCurrentResponse {
  value: { currentA: number };
}
export interface ManualCurrentCalculationRecord {
  id: string;
  calculator: "manual-current";
  title?: string;
  grouping?: GroupingMetadata;
  version: RecordVersion;
  input: ManualCurrentRequest;
  output: ManualCurrentResponse;
}
```

Add `| ManualCurrentCalculationRecord` to the `CalculationRecord` union.

**Step 2: Verify**

Run: `cd apps/desktop/renderer && npx tsc --noEmit`
Expected: EXIT 0 (other files not yet using it).

**Step 3: Commit**

```bash
git add apps/desktop/renderer/src/bridge/types.ts
git commit -m "feat(renderer): manual-current bridge types"
```

---

### Task 3: Aggregation + labels (`useProjectsData.ts`)

**Files:**
- Modify: `apps/desktop/renderer/src/features/projects/useProjectsData.ts`

**Step 1: Implement**

- `CALCULATOR_LABELS`: add `"manual-current": "Manuel akım"`.
- `getRecordUnitCurrentA`: change the guard so `motor` **and** `manual-current`
  return `output.value.currentA`:

```ts
export function getRecordUnitCurrentA(record: CalculationRecord): number {
  if (record.calculator !== "motor" && record.calculator !== "manual-current") {
    return 0;
  }
  const currentA = record.output.value.currentA;
  return typeof currentA === "number" && Number.isFinite(currentA) ? currentA : 0;
}
```

- `getRecordDisplayTitle`: before the label fallback, for `manual-current` return
  `record.input.label?.trim()` when present.

**Step 2: Verify**

Run: `cd apps/desktop/renderer && npx tsc --noEmit`
Expected: EXIT 0.

**Step 3: Commit**

```bash
git add apps/desktop/renderer/src/features/projects/useProjectsData.ts
git commit -m "feat(renderer): count manual-current in group totals"
```

---

### Task 4: Mutations (`projectMutations.ts`)

**Files:**
- Modify: `apps/desktop/renderer/src/features/projects/projectMutations.ts`

**Step 1: Implement** — add two mutations and expose them:

```ts
const createManualCurrentMutation = useMutation({
  mutationFn: async ({
    groupId, label, currentA, quantity,
  }: { groupId: string; label?: string; currentA: number; quantity?: number }) => {
    const record: CalculationRecord = {
      id: crypto.randomUUID(),
      calculator: "manual-current",
      ...(label?.trim() ? { title: label.trim() } : {}),
      grouping: { groupId, ...(quantity && quantity > 1 ? { quantity } : {}) },
      version: buildVersion(),
      input: { currentA, ...(label?.trim() ? { label: label.trim() } : {}) },
      output: { value: { currentA } },
    };
    return getBridge().records.save(record);
  },
  onSuccess: async () => { await invalidateProjectsQueries(queryClient); },
});

const updateManualCurrentMutation = useMutation({
  mutationFn: async ({
    record, label, currentA,
  }: { record: CalculationRecord; label?: string; currentA: number }) => {
    const clean = stripPersistenceTimestamps(record);
    return getBridge().records.save({
      ...clean,
      ...(label?.trim() ? { title: label.trim() } : {}),
      input: { currentA, ...(label?.trim() ? { label: label.trim() } : {}) },
      output: { value: { currentA } },
    });
  },
  onSuccess: async () => { await invalidateProjectsQueries(queryClient); },
});
```

Add to the returned object: `createManualCurrent: createManualCurrentMutation.mutateAsync`, `updateManualCurrent: updateManualCurrentMutation.mutateAsync`, `isCreatingManualCurrent: createManualCurrentMutation.isPending`, and include both `.isPending` flags in the aggregate `isPending`.

**Step 2: Verify**

Run: `cd apps/desktop/renderer && npx tsc --noEmit`
Expected: EXIT 0.

**Step 3: Commit**

```bash
git add apps/desktop/renderer/src/features/projects/projectMutations.ts
git commit -m "feat(renderer): manual-current create/update mutations"
```

---

### Task 5: Quick Panel UI

**Files:**
- Modify: `apps/desktop/renderer/src/features/projects/ProjectQuickPanel.tsx`
- Modify: `apps/desktop/renderer/src/features/projects/ProjectQuickPanel.module.css`

**Step 1: Implement**

- Add state: `const [manualDrafts, setManualDrafts] = useState<Record<string, { label: string; currentA: string; qty: string }>>({});`
  keyed by groupId; a per-group "+ Manuel akım" toggle button (mirrors the Kopyala
  pattern) that seeds/clears the draft.
- Inline form (shown when a draft exists for the group): label text input, ampere
  number input, quantity number input, "Ekle" button → on submit call
  `mutations.createManualCurrent({ groupId, label, currentA: Number(currentA), quantity: Number(qty) })`
  inside `runAction`, then clear that group's draft. Disable "Ekle" when
  `Number(currentA)` is not a finite number `> 0`.
- The new records already render in the existing record list. For
  `manual-current` cards add a small delete button (calls
  `getBridge().records.delete(id)` + invalidate, same pattern as the assignment
  remove button) so quick deletion works.

**Step 2: Verify**

Run: `cd apps/desktop/renderer && npx tsc --noEmit`
Expected: EXIT 0.

**Step 3: Commit**

```bash
git add apps/desktop/renderer/src/features/projects/ProjectQuickPanel.tsx apps/desktop/renderer/src/features/projects/ProjectQuickPanel.module.css
git commit -m "feat(renderer): add manual-current entry to quick panel"
```

---

### Task 6: Projects page UI

**Files:**
- Modify: `apps/desktop/renderer/src/features/projects/ProjectsPage.tsx`
- Modify: `apps/desktop/renderer/src/features/projects/ProjectsPage.module.css`

**Step 1: Implement**

- Add `manualDrafts` state (same shape as Task 5) and `showManualForm` per group,
  or reuse a single record `Record<groupId, draft>`.
- In each group body (inside the `isExpanded` region, near the duplicate row) add a
  "+ Manuel akım" toggle + inline form (label + ampere + quantity + "Ekle") calling
  `mutations.createManualCurrent`. Set `actionError` on failure.
- Manual rows render as record cards already; selecting one opens `RecordDetail`
  (Task 7).

**Step 2: Verify**

Run: `cd apps/desktop/renderer && npx tsc --noEmit`
Expected: EXIT 0.

**Step 3: Commit**

```bash
git add apps/desktop/renderer/src/features/projects/ProjectsPage.tsx apps/desktop/renderer/src/features/projects/ProjectsPage.module.css
git commit -m "feat(renderer): add manual-current entry to projects page"
```

---

### Task 7: RecordDetail edit panel

**Files:**
- Modify: `apps/desktop/renderer/src/features/projects/RecordDetail.tsx`

**Step 1: Implement** — add a `manual-current` branch: editable label + ampere
inputs seeded from `record.input`, a "Kaydet" button calling
`mutations.updateManualCurrent({ record, label, currentA })`, plus the existing
quantity and delete controls. (If `RecordDetail` does not already receive
`mutations`, pass it via props or call `useProjectMutations()` inside.)

**Step 2: Verify**

Run: `cd apps/desktop/renderer && npx tsc --noEmit`
Expected: EXIT 0.

**Step 3: Commit**

```bash
git add apps/desktop/renderer/src/features/projects/RecordDetail.tsx
git commit -m "feat(renderer): edit manual-current in record detail"
```

---

### Task 8: Build + runtime verification

**Files:**
- Temporary: `apps/desktop/diag-manual.cjs`, `apps/desktop/diag-mock-preload.cjs`

**Step 1: Typecheck everything**

Run: `cd apps/desktop && (cd main && npx tsc --noEmit) && (cd preload && npx tsc --noEmit) && (cd renderer && npx tsc --noEmit)`
Expected: all EXIT 0.

**Step 2: Build renderer**

Run: `cd apps/desktop/renderer && npx vite build`
Expected: built, EXIT 0.

**Step 3: Runtime diag** — mock preload exposes a group with one motor record
(currentA 10) plus one `manual-current` record (currentA 16, qty 2). Load built
renderer, go to `#/projects`, expand the group, and assert:
- group total reflects `10 + 16*2 = 42` A,
- a card with the "Manuel akım" badge and the label is visible,
- the cable-suggestion query was called with the larger total.
Also exercise the add form via DOM and confirm a new card appears.

Expected: assertions pass, no console errors. Remove the diag files afterward.

**Step 4: Commit (only if diag files were added then removed — nothing to commit). Otherwise skip.**

---

## Notes
- DRY: reuse `deleteRecord` / `updateRecordQuantity`; do not add manual-specific
  delete/quantity mutations.
- YAGNI: no phase/voltage modeling; ampere is a raw line current.
- No IPC or `records-service` changes — `saveRecord` validates via the schema.
- Repackaging to a new installer is a separate, user-triggered step (not part of
  this plan).
