# Projects Workspace, Right Quick Panel & Cable Section Hints Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace the flat "Geçmiş & Gruplar" tab with a two-level **Projects → Groups → Records** workspace (with motor count per record, per-group totals, group duplication, and a domain-friendly detail view instead of raw JSON). Add a collapsible right-side **Quick Project Panel** for fast project/group management. Extend cable section suggestions with a standard-section hint (2.5 mm² < 25 A, 4 mm² ≥ 25 A) in the motor calculator, and compute group-level cable section suggestions for both earth (toprak_20C) and air (hava_30C) ambients using the group's total current.

**Architecture:**

1. **Projects model reuses existing `CalculationGroup`:**
   - A **Project** is a `CalculationGroup` with `parentGroupId === undefined` (top-level) **and** `tags` containing the marker string `"project"`.
   - A **Group** (Turkish: "grup") inside a project is a `CalculationGroup` with `parentGroupId = <project.id>`.
   - A **Record** (hesap) belongs to a group via `grouping.groupId = <group.id>`.
   - **No new tables, no migrations.** Current schema already supports the hierarchy (`parent_group_id` column, `tags_json` column exist). Marker tag `"project"` is the discriminator. This is a deliberate choice to keep the storage contract stable.

2. **Record quantity (motor count):** Add optional `quantity?: number` (integer ≥ 1, default 1) to `groupingMetadataSchema`. This extends an existing object, so every stored record without `quantity` is treated as `quantity = 1`. `currentA` per unit stays untouched in the record output; the renderer computes `totalCurrentA = unitCurrentA * quantity`.

3. **Group total current (renderer-computed):** The Project page iterates its groups, iterates each group's records, sums `unitCurrentA(record) * (grouping.quantity ?? 1)` to produce `groupTotalCurrentA`. A small helper `getRecordUnitCurrentA(record)` centralises extraction per calculator kind (currently only `motor` — formula + table — contributes current; `cable`/`voltage-drop`/`protection` contribute 0 toward the motor-count total, but their records are still listed).

4. **Group duplication:** New service method `duplicateGroup(sourceGroupId, newTitle)` deep-copies the group + every record belonging to it, generating fresh `crypto.randomUUID()` ids, preserving `parentGroupId`, `tags`, `quantity`, inputs, outputs.

5. **Right Quick Panel:** New component `<ProjectQuickPanel/>` mounted in `Layout`, right side, collapsible via toggle button. It exposes: create project, rename/delete project, create group in active project, duplicate group, edit record quantity, view group totals. State backed by TanStack Query against the same `queryKeys.groups` / `queryKeys.records()`.

6. **Cable section standard hint (motor):** New pure helper `buildStandardSectionHint(currentA, rulerSelectedSectionMm2)` returns `{ standardHintMm2: 2.5 | 4 } | null`. Rule (strict): `null` when `rulerSelectedSectionMm2 > 4`; else `{ standardHintMm2: 2.5 }` when `currentA < 25`; else `{ standardHintMm2: 4 }`. Wire into `motorSuggestedCableSectionSchema` as optional `standardHintMm2`.

7. **Group-level cable suggestion (both ambients):** New pure helper `suggestGroupCableSections(groupTotalCurrentA)` returns `{ toprak_20C: CableRulerSuggestion, hava_30C: CableRulerSuggestion }` where each suggestion includes `{ sectionMm2, label, ampacityA, standardHintMm2? }`. Used by the Projects page to display cable recommendation under each group.

**Tech Stack:** TypeScript (strict), Zod contracts, Vitest, React + Vite renderer, TanStack Query, Electron IPC, pnpm+turbo monorepo, better-sqlite3 storage.

---

## Pre-flight

### Task 0: Baseline verification

**Files:** (none)

**Step 1:** Ensure clean tree and green build.

Run: `pnpm -w install`
Run: `pnpm -w -r build`
Run: `pnpm -w -r test`

Expected: all green. If red, stop and fix before proceeding.

---

## Phase 1: Contracts — `quantity`, `standardHintMm2`, `projectMarkerTag`

### Task 1: Extend `groupingMetadataSchema` with optional `quantity`

**Files:**
- Modify: `packages/contracts/src/schemas.ts:361-369` (`groupingMetadataSchema`)
- Test: `packages/contracts/src/schema.test.ts`

**Step 1: Write the failing test**

Append to `packages/contracts/src/schema.test.ts`:

```ts
describe("groupingMetadataSchema quantity", () => {
  it("accepts a positive integer quantity", () => {
    const parsed = groupingMetadataSchema.parse({ groupId: "g1", quantity: 3 });
    expect(parsed.quantity).toBe(3);
  });
  it("defaults to undefined when omitted", () => {
    const parsed = groupingMetadataSchema.parse({ groupId: "g1" });
    expect(parsed.quantity).toBeUndefined();
  });
  it("rejects non-integer quantity", () => {
    expect(() => groupingMetadataSchema.parse({ groupId: "g1", quantity: 1.5 })).toThrow();
  });
  it("rejects quantity < 1", () => {
    expect(() => groupingMetadataSchema.parse({ groupId: "g1", quantity: 0 })).toThrow();
  });
});
```

Ensure the import `groupingMetadataSchema` already exists at top of the test file; if not, add it.

**Step 2: Run test to verify it fails**

Run: `pnpm --filter @elektroplan/contracts test -- --run schema.test`
Expected: FAIL — `quantity` rejected.

**Step 3: Implement**

In `packages/contracts/src/schemas.ts` update `groupingMetadataSchema`:

```ts
export const groupingMetadataSchema = z
  .object({
    groupId: z.string().min(1).optional(),
    groupPath: z.array(z.string().min(1)).optional(),
    groupTitle: z.string().min(1).optional(),
    order: z.number().int().optional(),
    tags: z.array(z.string().min(1)).optional(),
    quantity: z.number().int().min(1).optional(),
  })
  .strict();
```

**Step 4: Run test to verify it passes**

Run: `pnpm --filter @elektroplan/contracts test -- --run schema.test`
Expected: PASS.

**Step 5: Commit**

```bash
git add packages/contracts/src/schemas.ts packages/contracts/src/schema.test.ts
git commit -m "feat(contracts): add optional quantity to groupingMetadata"
```

---

### Task 2: Extend `motorSuggestedCableSectionSchema` with optional `standardHintMm2`

**Files:**
- Modify: `packages/contracts/src/schemas.ts:81-88` (`motorSuggestedCableSectionSchema`)
- Test: `packages/contracts/src/schema.test.ts`

**Step 1: Write the failing test**

Append:

```ts
describe("motorSuggestedCableSectionSchema standardHintMm2", () => {
  const base = {
    sectionMm2: 2.5,
    label: "2,5",
    ambient: "hava_30C" as const,
    ampacityA: 26,
  };
  it("accepts 2.5", () => {
    expect(motorSuggestedCableSectionSchema.parse({ ...base, standardHintMm2: 2.5 }).standardHintMm2).toBe(2.5);
  });
  it("accepts 4", () => {
    expect(motorSuggestedCableSectionSchema.parse({ ...base, standardHintMm2: 4 }).standardHintMm2).toBe(4);
  });
  it("rejects other numbers", () => {
    expect(() => motorSuggestedCableSectionSchema.parse({ ...base, standardHintMm2: 6 })).toThrow();
  });
  it("accepts omitted", () => {
    expect(motorSuggestedCableSectionSchema.parse(base).standardHintMm2).toBeUndefined();
  });
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm --filter @elektroplan/contracts test -- --run schema.test`
Expected: FAIL.

**Step 3: Implement**

```ts
export const motorSuggestedCableSectionSchema = z
  .object({
    sectionMm2: z.number().positive(),
    label: z.string(),
    ambient: cableRulerAmbientSchema,
    ampacityA: z.number().positive(),
    standardHintMm2: z.union([z.literal(2.5), z.literal(4)]).optional(),
  })
  .strict();
```

**Step 4: Run test to verify it passes**

Run: `pnpm --filter @elektroplan/contracts test -- --run schema.test`
Expected: PASS.

**Step 5: Build contracts**

Run: `pnpm --filter @elektroplan/contracts build`
Expected: tsc succeeds.

**Step 6: Commit**

```bash
git add packages/contracts/src/schemas.ts packages/contracts/src/schema.test.ts
git commit -m "feat(contracts): add optional standardHintMm2 to motorSuggestedCableSection"
```

---

### Task 3: Define `PROJECT_MARKER_TAG` constant

**Files:**
- Create: `packages/contracts/src/project-marker.ts`
- Modify: `packages/contracts/src/index.ts`
- Test: `packages/contracts/src/schema.test.ts`

**Step 1: Write the failing test**

Append:

```ts
import { PROJECT_MARKER_TAG, isProjectGroup, isProjectChildGroup } from "./project-marker";

describe("project marker", () => {
  it("constant equals 'project'", () => {
    expect(PROJECT_MARKER_TAG).toBe("project");
  });
  it("detects project by marker tag + no parent", () => {
    expect(isProjectGroup({ id: "p", title: "X", tags: ["project"], version: { contractVersion: "1" } })).toBe(true);
    expect(isProjectGroup({ id: "p", title: "X", version: { contractVersion: "1" } })).toBe(false);
  });
  it("detects child group by parentGroupId", () => {
    expect(isProjectChildGroup({ id: "g", title: "G", parentGroupId: "p", version: { contractVersion: "1" } })).toBe(true);
    expect(isProjectChildGroup({ id: "g", title: "G", version: { contractVersion: "1" } })).toBe(false);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm --filter @elektroplan/contracts test -- --run schema.test`
Expected: FAIL — module not found.

**Step 3: Implement**

Create `packages/contracts/src/project-marker.ts`:

```ts
import type { CalculationGroup } from "./schemas";

export const PROJECT_MARKER_TAG = "project" as const;

export function isProjectGroup(group: CalculationGroup): boolean {
  if (group.parentGroupId !== undefined) return false;
  return group.tags?.includes(PROJECT_MARKER_TAG) === true;
}

export function isProjectChildGroup(group: CalculationGroup): boolean {
  return typeof group.parentGroupId === "string" && group.parentGroupId.length > 0;
}
```

In `packages/contracts/src/index.ts` add:

```ts
export { PROJECT_MARKER_TAG, isProjectGroup, isProjectChildGroup } from "./project-marker";
```

**Step 4: Run test to verify it passes**

Run: `pnpm --filter @elektroplan/contracts test -- --run schema.test`
Expected: PASS.

**Step 5: Build contracts**

Run: `pnpm --filter @elektroplan/contracts build`

**Step 6: Commit**

```bash
git add packages/contracts/src/project-marker.ts packages/contracts/src/index.ts packages/contracts/src/schema.test.ts
git commit -m "feat(contracts): add PROJECT_MARKER_TAG + project/child helpers"
```

---

## Phase 2: Calculation Core — Standard Section Hint + Group Cable Suggestion

### Task 4: Pure `buildStandardSectionHint` helper

**Files:**
- Create: `packages/calculation-core/src/cable/standard-section-hint.ts`
- Create: `packages/calculation-core/src/cable/standard-section-hint.test.ts`
- Modify: `packages/calculation-core/src/cable/index.ts` (re-export)

**Step 1: Write the failing test**

Create `packages/calculation-core/src/cable/standard-section-hint.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { buildStandardSectionHint } from "./standard-section-hint";

describe("buildStandardSectionHint", () => {
  it("returns 2.5 when currentA < 25 and rulerSection <= 4", () => {
    expect(buildStandardSectionHint({ currentA: 24.9, rulerSectionMm2: 2.5 })).toEqual({ standardHintMm2: 2.5 });
  });
  it("returns 4 when currentA >= 25 and rulerSection <= 4", () => {
    expect(buildStandardSectionHint({ currentA: 25, rulerSectionMm2: 4 })).toEqual({ standardHintMm2: 4 });
    expect(buildStandardSectionHint({ currentA: 60, rulerSectionMm2: 4 })).toEqual({ standardHintMm2: 4 });
  });
  it("returns null when ruler section > 4", () => {
    expect(buildStandardSectionHint({ currentA: 80, rulerSectionMm2: 6 })).toBeNull();
    expect(buildStandardSectionHint({ currentA: 300, rulerSectionMm2: 95 })).toBeNull();
  });
  it("returns null when inputs are not finite positive", () => {
    expect(buildStandardSectionHint({ currentA: 0, rulerSectionMm2: 2.5 })).toBeNull();
    expect(buildStandardSectionHint({ currentA: NaN, rulerSectionMm2: 2.5 })).toBeNull();
  });
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm --filter @elektroplan/calculation-core test -- --run standard-section-hint`
Expected: FAIL — module not found.

**Step 3: Implement**

Create `packages/calculation-core/src/cable/standard-section-hint.ts`:

```ts
export interface StandardSectionHintInput {
  currentA: number;
  rulerSectionMm2: number;
}

export interface StandardSectionHint {
  standardHintMm2: 2.5 | 4;
}

export function buildStandardSectionHint(input: StandardSectionHintInput): StandardSectionHint | null {
  const { currentA, rulerSectionMm2 } = input;
  if (!Number.isFinite(currentA) || currentA <= 0) return null;
  if (!Number.isFinite(rulerSectionMm2) || rulerSectionMm2 <= 0) return null;
  if (rulerSectionMm2 > 4) return null;
  return { standardHintMm2: currentA < 25 ? 2.5 : 4 };
}
```

In `packages/calculation-core/src/cable/index.ts` append:

```ts
export { buildStandardSectionHint } from "./standard-section-hint.js";
export type { StandardSectionHintInput, StandardSectionHint } from "./standard-section-hint.js";
```

**Step 4: Run test to verify it passes**

Run: `pnpm --filter @elektroplan/calculation-core test -- --run standard-section-hint`
Expected: PASS.

**Step 5: Commit**

```bash
git add packages/calculation-core/src/cable/standard-section-hint.ts packages/calculation-core/src/cable/standard-section-hint.test.ts packages/calculation-core/src/cable/index.ts
git commit -m "feat(calc-core): add buildStandardSectionHint helper"
```

---

### Task 5: Wire hint into motor formula output

**Files:**
- Modify: `packages/calculation-core/src/motor/index.ts:48-73`
- Modify: `packages/calculation-core/src/motor/index.test.ts`

**Step 1: Write the failing test**

Append to `packages/calculation-core/src/motor/index.test.ts`:

```ts
describe("formula mode — standardHintMm2", () => {
  it("adds 2.5 hint when currentA < 25 and ruler section <= 4", () => {
    const r = calculateMotorCurrent({
      mode: "formula",
      phase: 3,
      P_out: 0.55,
      voltage: 380,
      cosPhi: 0.75,
      efficiencyPercent: 70,
      voltageMode: "LL",
    });
    if (r.value.mode !== "formula") throw new Error("wrong mode");
    expect(r.value.suggestedCableSection?.standardHintMm2).toBe(2.5);
  });

  it("adds 4 hint when currentA >= 25 and ruler section <= 4", () => {
    const r = calculateMotorCurrent({
      mode: "formula",
      phase: 3,
      P_out: 15,
      voltage: 380,
      cosPhi: 0.85,
      efficiencyPercent: 90,
      voltageMode: "LL",
    });
    if (r.value.mode !== "formula") throw new Error("wrong mode");
    expect(r.value.suggestedCableSection?.standardHintMm2).toBe(4);
  });

  it("omits hint when normal ruler section > 4", () => {
    const r = calculateMotorCurrent({
      mode: "formula",
      phase: 3,
      P_out: 37,
      voltage: 380,
      cosPhi: 0.85,
      efficiencyPercent: 92,
      voltageMode: "LL",
    });
    if (r.value.mode !== "formula") throw new Error("wrong mode");
    expect(r.value.suggestedCableSection?.sectionMm2).toBeGreaterThan(4);
    expect(r.value.suggestedCableSection?.standardHintMm2).toBeUndefined();
  });
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm --filter @elektroplan/calculation-core test -- --run motor`
Expected: FAIL.

**Step 3: Implement**

In `packages/calculation-core/src/motor/index.ts` replace the `suggestedCableSection` assignment block (around lines 58-73):

```ts
import { buildStandardSectionHint } from "../cable/standard-section-hint.js";
// ...

if (suggestedEntry !== undefined) {
  const ampacity = getAmpacityForAmbient(suggestedEntry, "hava_30C");
  if (ampacity === null) {
    throw new RangeError("Motor cable suggestion requires an air ampacity.");
  }
  const hint = buildStandardSectionHint({
    currentA: result.value.currentA,
    rulerSectionMm2: suggestedEntry.sectionMm2,
  });
  suggestedCableSection = {
    sectionMm2: suggestedEntry.sectionMm2,
    label: suggestedEntry.nominal_kesit_mm2,
    ambient: "hava_30C" as const,
    ampacityA: ampacity,
    ...(hint ? { standardHintMm2: hint.standardHintMm2 } : {}),
  };
}
```

**Step 4: Run test to verify it passes**

Run: `pnpm --filter @elektroplan/calculation-core test -- --run motor`
Expected: PASS.

**Step 5: Build**

Run: `pnpm --filter @elektroplan/calculation-core build`

**Step 6: Commit**

```bash
git add packages/calculation-core/src/motor/index.ts packages/calculation-core/src/motor/index.test.ts
git commit -m "feat(calc-core): surface standardHintMm2 on motor formula suggestion"
```

---

### Task 6: Group-level dual-ambient cable suggestion helper

**Files:**
- Create: `packages/calculation-core/src/cable/group-cable-suggestion.ts`
- Create: `packages/calculation-core/src/cable/group-cable-suggestion.test.ts`
- Modify: `packages/calculation-core/src/cable/index.ts`

**Step 1: Write the failing test**

Create `group-cable-suggestion.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { suggestGroupCableSections } from "./group-cable-suggestion";

describe("suggestGroupCableSections", () => {
  it("returns entries for both ambients", () => {
    const r = suggestGroupCableSections({ groupTotalCurrentA: 30 });
    expect(r.toprak_20C.sectionMm2).toBeGreaterThan(0);
    expect(r.hava_30C.sectionMm2).toBeGreaterThan(0);
    expect(r.toprak_20C.ampacityA).toBeGreaterThanOrEqual(30);
    expect(r.hava_30C.ampacityA).toBeGreaterThanOrEqual(30);
  });

  it("includes standardHintMm2 = 2.5 when currentA < 25 and rulerSection <= 4", () => {
    const r = suggestGroupCableSections({ groupTotalCurrentA: 10 });
    expect(r.hava_30C.standardHintMm2).toBe(2.5);
    expect(r.toprak_20C.standardHintMm2).toBe(2.5);
  });

  it("includes standardHintMm2 = 4 when currentA >= 25 and rulerSection <= 4", () => {
    const r = suggestGroupCableSections({ groupTotalCurrentA: 28 });
    for (const amb of ["toprak_20C", "hava_30C"] as const) {
      if (r[amb].sectionMm2 <= 4) {
        expect(r[amb].standardHintMm2).toBe(4);
      }
    }
  });

  it("omits standardHintMm2 when ruler section > 4", () => {
    const r = suggestGroupCableSections({ groupTotalCurrentA: 120 });
    expect(r.hava_30C.sectionMm2).toBeGreaterThan(4);
    expect(r.hava_30C.standardHintMm2).toBeUndefined();
  });

  it("returns null ambients when currentA is 0", () => {
    const r = suggestGroupCableSections({ groupTotalCurrentA: 0 });
    expect(r.toprak_20C).toBeNull();
    expect(r.hava_30C).toBeNull();
  });
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm --filter @elektroplan/calculation-core test -- --run group-cable-suggestion`
Expected: FAIL.

**Step 3: Implement**

Create `packages/calculation-core/src/cable/group-cable-suggestion.ts`:

```ts
import {
  getAmpacityForAmbient,
  getCableRulerEntries,
} from "@elektroplan/calculation-data";
import type { CableRulerAmbient } from "./ruler.js";
import { buildStandardSectionHint } from "./standard-section-hint.js";

export interface GroupCableSuggestionInput {
  groupTotalCurrentA: number;
}

export interface GroupCableSuggestionEntry {
  sectionMm2: number;
  label: string;
  ambient: CableRulerAmbient;
  ampacityA: number;
  standardHintMm2?: 2.5 | 4;
}

export interface GroupCableSuggestionResult {
  toprak_20C: GroupCableSuggestionEntry | null;
  hava_30C: GroupCableSuggestionEntry | null;
}

function selectFor(ambient: CableRulerAmbient, currentA: number): GroupCableSuggestionEntry | null {
  if (!Number.isFinite(currentA) || currentA <= 0) return null;
  const sorted = [...getCableRulerEntries()]
    .filter((e) => e.sectionMm2 >= 1.5)
    .sort((a, b) => a.sectionMm2 - b.sectionMm2);
  const entry = sorted.find((e) => {
    const amp = getAmpacityForAmbient(e, ambient);
    return amp !== null && amp >= currentA;
  });
  if (!entry) return null;
  const amp = getAmpacityForAmbient(entry, ambient);
  if (amp === null) return null;
  const hint = buildStandardSectionHint({ currentA, rulerSectionMm2: entry.sectionMm2 });
  return {
    sectionMm2: entry.sectionMm2,
    label: entry.nominal_kesit_mm2,
    ambient,
    ampacityA: amp,
    ...(hint ? { standardHintMm2: hint.standardHintMm2 } : {}),
  };
}

export function suggestGroupCableSections(input: GroupCableSuggestionInput): GroupCableSuggestionResult {
  return {
    toprak_20C: selectFor("toprak_20C", input.groupTotalCurrentA),
    hava_30C: selectFor("hava_30C", input.groupTotalCurrentA),
  };
}
```

Add to `packages/calculation-core/src/cable/index.ts`:

```ts
export { suggestGroupCableSections } from "./group-cable-suggestion.js";
export type {
  GroupCableSuggestionInput,
  GroupCableSuggestionEntry,
  GroupCableSuggestionResult,
} from "./group-cable-suggestion.js";
```

**Step 4: Run test to verify it passes**

Run: `pnpm --filter @elektroplan/calculation-core test -- --run group-cable-suggestion`
Expected: PASS.

**Step 5: Build**

Run: `pnpm --filter @elektroplan/calculation-core build`

**Step 6: Commit**

```bash
git add packages/calculation-core/src/cable/group-cable-suggestion.ts packages/calculation-core/src/cable/group-cable-suggestion.test.ts packages/calculation-core/src/cable/index.ts
git commit -m "feat(calc-core): add suggestGroupCableSections for dual-ambient group totals"
```

---

## Phase 3: Storage/Service — Group Duplication

### Task 7: `RecordsService.duplicateGroup` method

**Files:**
- Modify: `apps/desktop/main/src/services/records-service.ts`
- Create: `apps/desktop/main/src/services/records-service.test.ts` (if absent; otherwise extend existing suite)

**Step 1: Write the failing test**

Check existing tests with `pnpm --filter @elektroplan/desktop-main test`. If no test file exists for the service, create a minimal test using in-memory sqlite:

```ts
import { describe, expect, it } from "vitest";
import Database from "better-sqlite3";
import { applyMigrations, SqliteStorageRepositories } from "@elektroplan/storage";
import { createRecordsService } from "./records-service";

function makeService() {
  const db = new Database(":memory:");
  applyMigrations(db);
  const repos = new SqliteStorageRepositories(db);
  return { service: createRecordsService(repos.records, repos.groups), repos };
}

describe("duplicateGroup", () => {
  it("deep copies a group and its records with fresh ids", () => {
    const { service } = makeService();
    service.saveGroup({ id: "p", title: "Proj", tags: ["project"], version: { contractVersion: "1" } });
    service.saveGroup({ id: "g", title: "G1", parentGroupId: "p", version: { contractVersion: "1" } });
    service.saveRecord({
      id: "r1",
      calculator: "motor",
      grouping: { groupId: "g", quantity: 2 },
      version: { contractVersion: "1" },
      input: { mode: "table", kW: 0.55, voltage: 380 },
      output: {
        value: { mode: "table", kW: 0.55, PS: 0.75, cosPhi: 0.75, efficiencyPercent: 69, currentA: 1.6, cableSpec: "4 x 2,5" },
        warnings: [], assumptions: [], formulaVariant: "table-mode-380V",
        dataVersion: "motor-ruler-standard-v1:v1", engineVersion: "1.0.0",
      },
    });

    const dup = service.duplicateGroup("g", "G1 (kopya)");
    expect(dup.id).not.toBe("g");
    expect(dup.title).toBe("G1 (kopya)");
    expect(dup.parentGroupId).toBe("p");

    const recs = service.listRecords({ groupId: dup.id });
    expect(recs).toHaveLength(1);
    expect(recs[0].id).not.toBe("r1");
    expect(recs[0].grouping?.groupId).toBe(dup.id);
    expect(recs[0].grouping?.quantity).toBe(2);
    expect(recs[0].output.value).toMatchObject({ currentA: 1.6 });
  });

  it("throws on unknown group id", () => {
    const { service } = makeService();
    expect(() => service.duplicateGroup("missing", "X")).toThrow();
  });
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm --filter @elektroplan/desktop-main test -- --run records-service`
Expected: FAIL — method missing.

**Step 3: Implement**

Extend the service interface + factory in `apps/desktop/main/src/services/records-service.ts`:

```ts
export interface RecordsService {
  // ...existing methods...
  duplicateGroup(sourceGroupId: string, newTitle: string): PersistedCalculationGroup;
}

export function createRecordsService(
  records: RecordsRepository,
  groups: GroupsRepository,
): RecordsService {
  return {
    // ...existing...
    duplicateGroup(sourceGroupId, newTitle) {
      if (typeof sourceGroupId !== "string" || sourceGroupId.length === 0) {
        throw new TypeError("sourceGroupId must be a non-empty string.");
      }
      if (typeof newTitle !== "string" || newTitle.trim().length === 0) {
        throw new TypeError("newTitle must be a non-empty string.");
      }
      const source = groups.getById(sourceGroupId);
      if (!source) throw new RangeError(`Group '${sourceGroupId}' not found.`);

      const newGroupId = crypto.randomUUID();
      const { createdAt: _c, updatedAt: _u, ...rest } = source;
      const copiedGroup = calculationGroupSchema.parse({
        ...rest,
        id: newGroupId,
        title: newTitle.trim(),
      });
      groups.upsert(copiedGroup);

      const sourceRecords = records.list({ groupId: sourceGroupId });
      for (const rec of sourceRecords) {
        const { createdAt: _rc, updatedAt: _ru, ...recRest } = rec;
        const cloned = calculationRecordSchema.parse({
          ...recRest,
          id: crypto.randomUUID(),
          grouping: { ...(recRest.grouping ?? {}), groupId: newGroupId },
        });
        records.upsert(cloned);
      }

      const stored = groups.getById(newGroupId);
      if (!stored) throw new Error("Failed to persist duplicated group.");
      return stored;
    },
  };
}
```

Add `import { randomUUID } from "node:crypto";` and replace `crypto.randomUUID()` with `randomUUID()` if node globals are not available in this build; otherwise keep `crypto.randomUUID()` (available in Node 19+). Confirm by checking `apps/desktop/main/package.json` node engines before choosing.

**Step 4: Run test to verify it passes**

Run: `pnpm --filter @elektroplan/desktop-main test -- --run records-service`
Expected: PASS.

**Step 5: Commit**

```bash
git add apps/desktop/main/src/services/records-service.ts apps/desktop/main/src/services/records-service.test.ts
git commit -m "feat(desktop-main): RecordsService.duplicateGroup deep-copies group + records"
```

---

### Task 8: IPC channel `groups:duplicate`

**Files:**
- Modify: `apps/desktop/main/src/ipc/channels.ts:1-27`
- Modify: `apps/desktop/main/src/ipc/register.ts`
- Modify: `apps/desktop/preload/src/<main preload file>`
- Modify: `apps/desktop/renderer/src/bridge/types.ts:413-417` (`groups` block)

**Step 1: Discover preload file**

Run: `ls apps/desktop/preload/src`
Read the single preload bridge file it surfaces; use its established pattern for `groups.list` / `groups.save` / `groups.delete` to add `groups.duplicate`.

**Step 2: Add channel constant**

In `channels.ts`:

```ts
GroupsDuplicate: "groups:duplicate",
```

**Step 3: Register handler**

In `register.ts`, alongside existing `GroupsSave` handler, add:

```ts
ipcMain.handle(IPC_CHANNELS.GroupsDuplicate, (_event, payload: { sourceGroupId: string; newTitle: string }) => {
  return envelopeOk(services.records.duplicateGroup(payload.sourceGroupId, payload.newTitle));
});
```

Follow the exact envelope/error-wrapping pattern used by `GroupsSave` — do not invent a new one.

**Step 4: Preload**

Add a `duplicate(sourceGroupId, newTitle)` method inside the exposed `groups` object mirroring `save`.

**Step 5: Renderer bridge types**

In `apps/desktop/renderer/src/bridge/types.ts`, extend the `groups` block:

```ts
readonly groups: Readonly<{
  list(): Promise<readonly CalculationGroup[]>;
  save(group: CalculationGroup): Promise<CalculationGroup>;
  delete(id: string): Promise<boolean>;
  duplicate(sourceGroupId: string, newTitle: string): Promise<CalculationGroup>;
}>;
```

**Step 6: Build whole desktop app**

Run: `pnpm --filter @elektroplan/desktop-main build`
Run: `pnpm --filter @elektroplan/desktop-preload build`
Expected: both succeed.

**Step 7: Commit**

```bash
git add apps/desktop/main/src/ipc/channels.ts apps/desktop/main/src/ipc/register.ts apps/desktop/preload/src apps/desktop/renderer/src/bridge/types.ts
git commit -m "feat(ipc): expose groups:duplicate through IPC + preload + bridge types"
```

---

## Phase 4: Renderer — Rename Route & Feature Dir

### Task 9: Rename `/history` → `/projects`

**Files:**
- Move: `apps/desktop/renderer/src/features/history/` → `apps/desktop/renderer/src/features/projects/`
- Rename inside: `HistoryPage.tsx` → `ProjectsPage.tsx`, `HistoryPage.module.css` → `ProjectsPage.module.css` (these will be fully rewritten next tasks; rename now to reduce diff noise)
- Modify: `apps/desktop/renderer/src/router.tsx:4,15`
- Modify: `apps/desktop/renderer/src/ui/Layout.tsx:10`

**Step 1:** Git move files (keeps history):

```bash
git mv apps/desktop/renderer/src/features/history apps/desktop/renderer/src/features/projects
git mv apps/desktop/renderer/src/features/projects/HistoryPage.tsx apps/desktop/renderer/src/features/projects/ProjectsPage.tsx
git mv apps/desktop/renderer/src/features/projects/HistoryPage.module.css apps/desktop/renderer/src/features/projects/ProjectsPage.module.css
```

**Step 2:** Rename the React component export from `HistoryPage` → `ProjectsPage` inside the `.tsx`. Update the CSS import path to `./ProjectsPage.module.css`.

**Step 3:** Update router:

```tsx
import { ProjectsPage } from "./features/projects/ProjectsPage";
// ...
<Route path="/projects" element={<ProjectsPage />} />
```

Remove old `/history` route entirely (no backwards-compatibility redirect — user directive: no compat shims).

**Step 4:** Update `Layout.tsx` NAV entry:

```ts
{ to: "/projects", label: "Projeler" },
```

**Step 5:** Type-check.

Run: `pnpm --filter @elektroplan/desktop-renderer build`
Expected: build succeeds; no stale `HistoryPage` references.

**Step 6: Commit**

```bash
git commit -m "refactor(renderer): rename History tab and route to Projects"
```

---

## Phase 5: Renderer — Projects Page Rewrite

### Task 10: `useProjectsData` hook

**Files:**
- Create: `apps/desktop/renderer/src/features/projects/useProjectsData.ts`

**Step 1:** Extract grouping + totaling logic into a reusable hook so both the Projects page and the Quick Panel consume the same derived state.

```ts
import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { isProjectGroup, PROJECT_MARKER_TAG } from "@elektroplan/contracts";
import type { CalculationGroup, CalculationRecord } from "../../bridge/types";
import { getBridge, isBridgeAvailable } from "../../bridge/client";
import { queryKeys } from "../../query/keys";

export interface ProjectGroupView {
  group: CalculationGroup;
  records: readonly CalculationRecord[];
  unitCurrentA: number[];
  totalCurrentA: number;
}

export interface ProjectView {
  project: CalculationGroup;
  groups: ProjectGroupView[];
}

function getRecordUnitCurrentA(rec: CalculationRecord): number {
  if (rec.calculator !== "motor") return 0;
  const v = rec.output.value;
  return typeof v.currentA === "number" ? v.currentA : 0;
}

export function useProjectsData() {
  const groupsQuery = useQuery({
    queryKey: queryKeys.groups,
    queryFn: () => getBridge().groups.list(),
    enabled: isBridgeAvailable(),
  });

  const recordsQuery = useQuery({
    queryKey: queryKeys.records(),
    queryFn: () => getBridge().records.list({}),
    enabled: isBridgeAvailable(),
  });

  const projects: ProjectView[] = useMemo(() => {
    const allGroups = groupsQuery.data ?? [];
    const allRecords = recordsQuery.data ?? [];
    const projectGroups = allGroups.filter(isProjectGroup);
    return projectGroups.map((p) => {
      const childGroups = allGroups.filter((g) => g.parentGroupId === p.id);
      const groupViews: ProjectGroupView[] = childGroups.map((g) => {
        const recs = allRecords.filter((r) => r.grouping?.groupId === g.id);
        const unitCurrents = recs.map(getRecordUnitCurrentA);
        const totalCurrentA = recs.reduce((sum, r) => {
          const q = r.grouping?.quantity ?? 1;
          return sum + getRecordUnitCurrentA(r) * q;
        }, 0);
        return { group: g, records: recs, unitCurrentA: unitCurrents, totalCurrentA };
      });
      return { project: p, groups: groupViews };
    });
  }, [groupsQuery.data, recordsQuery.data]);

  return {
    projects,
    isLoading: groupsQuery.isLoading || recordsQuery.isLoading,
    isError: groupsQuery.isError || recordsQuery.isError,
    rawGroups: groupsQuery.data ?? [],
    rawRecords: recordsQuery.data ?? [],
    projectMarkerTag: PROJECT_MARKER_TAG,
  };
}

export { getRecordUnitCurrentA };
```

**Step 2:** Type-check.

Run: `pnpm --filter @elektroplan/desktop-renderer build`

**Step 3: Commit**

```bash
git add apps/desktop/renderer/src/features/projects/useProjectsData.ts
git commit -m "feat(projects): add useProjectsData hook for hierarchical view"
```

---

### Task 11: Domain-friendly record detail renderer

**Files:**
- Create: `apps/desktop/renderer/src/features/projects/RecordDetail.tsx`
- Create: `apps/desktop/renderer/src/features/projects/RecordDetail.module.css`

**Step 1:** Replace the old JSON-dump `<pre>` blocks with labelled Turkish rows per calculator kind. Example for `motor` table mode reproducing the user's screenshot (kW, gerilim, cosφ, verim, per-unit A, adet, toplam A, kablo spec):

```tsx
import type { CalculationRecord } from "../../bridge/types";
import { formatAmp, formatNumberTr } from "../../i18n/format";
import styles from "./RecordDetail.module.css";

interface Props {
  record: CalculationRecord;
  quantity: number;
  onQuantityChange: (q: number) => void;
  onDelete: () => void;
}

export function RecordDetail({ record, quantity, onQuantityChange, onDelete }: Props) {
  return (
    <div className={styles.detail}>
      <div className={styles.rows}>
        <Row label="Hesap Türü" value={CALC_LABEL[record.calculator] ?? record.calculator} />
        {record.calculator === "motor" && <MotorRows rec={record} />}
        {record.calculator === "cable" && <CableRows rec={record} />}
        {/* voltage-drop, protection similar */}
        <Row label="Adet">
          <input
            type="number"
            min={1}
            step={1}
            value={quantity}
            onChange={(e) => onQuantityChange(Math.max(1, Number(e.target.value) || 1))}
            className={styles.qtyInput}
          />
        </Row>
        {record.calculator === "motor" && (
          <Row
            label="Toplam Akım"
            value={formatAmp(getUnitCurrentA(record) * quantity, 2)}
            highlight
          />
        )}
      </div>
      <button type="button" className={styles.deleteBtn} onClick={onDelete}>Sil</button>
    </div>
  );
}
```

Implement `MotorRows` (formula & table discriminated), `CableRows`, `VoltageDropRows`, `ProtectionRows`. Use existing `formatAmp`/`formatNumberTr` for units. Re-use `CALC_LABELS` constant from the original `HistoryPage`.

**Step 2:** Type-check.

Run: `pnpm --filter @elektroplan/desktop-renderer build`

**Step 3: Commit**

```bash
git add apps/desktop/renderer/src/features/projects/RecordDetail.tsx apps/desktop/renderer/src/features/projects/RecordDetail.module.css
git commit -m "feat(projects): domain record detail replaces raw JSON dump"
```

---

### Task 12: ProjectsPage rewrite — Project → Group → Record hierarchy

**Files:**
- Rewrite: `apps/desktop/renderer/src/features/projects/ProjectsPage.tsx`
- Rewrite: `apps/desktop/renderer/src/features/projects/ProjectsPage.module.css`

**Step 1:** The new page layout (three-column):
- **Left:** project list with `+` button; clicking a project expands its groups inline.
- **Middle:** active project's groups (cards); each card shows title, record count, group total current, copy/delete actions, and the group's cable suggestion (both ambients, via `suggestGroupCableSections`).
- **Right:** selected record's `<RecordDetail/>`.

**Step 2:** State:
```ts
const [activeProjectId, setActiveProjectId] = useState<string | null>(null);
const [activeGroupId, setActiveGroupId] = useState<string | null>(null);
const [activeRecord, setActiveRecord] = useState<CalculationRecord | null>(null);
```

**Step 3:** Mutations (TanStack Query):
- `createProject(title)` → `groups.save({ id: uuid, title, tags: [PROJECT_MARKER_TAG], version: { contractVersion: "1" } })`
- `createGroup(projectId, title)` → `groups.save({ id: uuid, title, parentGroupId: projectId, version: { contractVersion: "1" } })`
- `duplicateGroup(groupId, title)` → `groups.duplicate(groupId, title)`
- `deleteProject(id)` → delete project **and** all child groups **and** their records (sequentially; no cascade in DB because `ON DELETE SET NULL`). Ask user to confirm. Invalidate both query keys.
- `deleteGroup(id)` → delete group + child records; confirm.
- `updateRecordQuantity(rec, q)` → `records.save({ ...rec, grouping: { ...rec.grouping, quantity: q } })`

**Step 4:** Group card cable suggestion — since `suggestGroupCableSections` is a pure node-land function in `@elektroplan/calculation-core`, it is **not** callable from renderer directly. Add a new IPC `calc:group-cable-suggest` channel + handler in the same commit:

- `apps/desktop/main/src/ipc/channels.ts`: `CalcGroupCableSuggest: "calc:group-cable-suggest"`.
- `register.ts`: handler calls `suggestGroupCableSections({ groupTotalCurrentA })` and returns envelope.
- Preload: expose `calc.groupCableSuggest(groupTotalCurrentA)`.
- Bridge types: add to `calc` block.

Then in the Projects page use:

```ts
const cableSuggestQuery = useQuery({
  queryKey: ["group-cable", g.group.id, g.totalCurrentA],
  queryFn: () => getBridge().calc.groupCableSuggest(g.totalCurrentA),
  enabled: g.totalCurrentA > 0,
});
```

**Step 5:** Render cable suggestion block inside each group card:

```tsx
{cableSuggestQuery.data && (
  <div className={styles.cableBlock}>
    <div>Toprak (20°C): {formatCableSuggestion(cableSuggestQuery.data.toprak_20C)}</div>
    <div>Hava (30°C): {formatCableSuggestion(cableSuggestQuery.data.hava_30C)}</div>
  </div>
)}
```

where `formatCableSuggestion(e)` returns `${e.label} mm² (${formatAmp(e.ampacityA, 0)})` plus, if `e.standardHintMm2` defined, a second line `+ ${e.standardHintMm2} mm² önerilir`.

**Step 6:** Type-check + manual smoke test.

Run: `pnpm --filter @elektroplan/desktop-renderer build`
Run (manual): `pnpm --filter @elektroplan/desktop dev` — open app, create project, add group, save a motor calc into it, change quantity, verify group total and cable suggestion match.

**Step 7: Commit**

```bash
git add apps/desktop/renderer/src/features/projects/ProjectsPage.tsx apps/desktop/renderer/src/features/projects/ProjectsPage.module.css apps/desktop/main/src/ipc/channels.ts apps/desktop/main/src/ipc/register.ts apps/desktop/preload/src apps/desktop/renderer/src/bridge/types.ts
git commit -m "feat(projects): hierarchical Projects page with quantity, totals, group cable suggestion"
```

---

### Task 13: Update SaveDialog to target project→group hierarchy

**Files:**
- Modify: `apps/desktop/renderer/src/ui/SaveDialog.tsx:1-128`

**Step 1:** Replace the single-level group dropdown with a two-step selector: **Project** then **Group**. Options:

- Project `<select>` showing all `isProjectGroup` entries; "+ Yeni proje" creates one inline.
- Group `<select>` showing `parentGroupId === selectedProjectId`; "+ Yeni grup" creates one inline.
- Record `grouping.groupId` = selected group's id (**not** project id — projects do not hold records directly).

Also add an optional `Adet` number input (default 1) that flows into `grouping.quantity`.

**Step 2:** Type-check.

Run: `pnpm --filter @elektroplan/desktop-renderer build`

**Step 3: Commit**

```bash
git add apps/desktop/renderer/src/ui/SaveDialog.tsx
git commit -m "feat(save-dialog): project→group hierarchical target + quantity field"
```

---

## Phase 6: Renderer — Right-Side Quick Project Panel

### Task 14: `<ProjectQuickPanel/>` component

**Files:**
- Create: `apps/desktop/renderer/src/features/projects/ProjectQuickPanel.tsx`
- Create: `apps/desktop/renderer/src/features/projects/ProjectQuickPanel.module.css`
- Modify: `apps/desktop/renderer/src/ui/Layout.tsx`
- Modify: `apps/desktop/renderer/src/ui/Layout.module.css`

**Step 1:** Panel shape:
- Fixed to `right: 0`, full viewport height, width ~320 px when open, 40 px rail when closed.
- Toggle button (chevron ‹/›) at the rail's top edge.
- Content: project `<select>`, inside it list groups with inline edit of quantity per record, copy-group button, add-group button, shows group totals + cable suggestion (re-using the IPC query from Task 12).

**Step 2:** Implement using `useProjectsData` + the same mutations as Task 12. Do **not** duplicate mutation logic — extract shared mutations into `apps/desktop/renderer/src/features/projects/projectMutations.ts` during Task 12 refactor if Task 12 did not already extract them.

**Step 3:** Mount in `Layout.tsx`:

```tsx
<div className={styles.shell}>
  <aside className={styles.sidebar}>...</aside>
  <main className={styles.main}><Outlet /></main>
  <ProjectQuickPanel />
</div>
```

Update `Layout.module.css` `.shell` to grid-template-columns `sidebar main quickPanel` with the quick panel column collapsing to 40 px when `[data-collapsed="true"]`.

**Step 4:** Persist collapsed state in `localStorage` (`elektroplan.quickPanel.collapsed`) so reopening the app restores it.

**Step 5:** Type-check + manual smoke test.

Run: `pnpm --filter @elektroplan/desktop-renderer build`
Run (manual): `pnpm --filter @elektroplan/desktop dev` — toggle panel, create project, change record quantity, confirm totals in both Projects page and Quick Panel stay in sync (they must — same query cache).

**Step 6: Commit**

```bash
git add apps/desktop/renderer/src/features/projects/ProjectQuickPanel.tsx apps/desktop/renderer/src/features/projects/ProjectQuickPanel.module.css apps/desktop/renderer/src/ui/Layout.tsx apps/desktop/renderer/src/ui/Layout.module.css
git commit -m "feat(quick-panel): collapsible right-side project controls"
```

---

## Phase 7: Renderer — Motor result card cable hint

### Task 15: Render `standardHintMm2` under motor formula result

**Files:**
- Modify: `apps/desktop/renderer/src/features/motor/FormulaMode.tsx:205-211`

**Step 1: Implement**

Replace the `suggestedCableSection` row block with:

```tsx
{result.value.suggestedCableSection && (
  <>
    <ResultRow
      label="Önerilen Kablo Kesiti"
      value={`${result.value.suggestedCableSection.label} mm² (${formatAmp(result.value.suggestedCableSection.ampacityA, 0)} hava 30 °C)`}
    />
    {result.value.suggestedCableSection.standardHintMm2 !== undefined && (
      <ResultRow
        label="Standart Kesit Önerisi"
        value={`${formatNumberTr(result.value.suggestedCableSection.standardHintMm2, 1)} mm² önerilir`}
      />
    )}
  </>
)}
```

**Step 2:** Type-check + manual smoke test.

Run: `pnpm --filter @elektroplan/desktop-renderer build`
Run (manual): dev app → motor formula → 0.55 kW / 380 V / 0.75 / 70 → expect both rows, hint = 2.5 mm². Then 15 kW / 380 V / 0.85 / 90 → hint = 4 mm². Then 37 kW scenario → no hint row.

**Step 3: Commit**

```bash
git add apps/desktop/renderer/src/features/motor/FormulaMode.tsx
git commit -m "feat(motor): show standard section hint under suggested cable"
```

---

## Phase 8: Verification & Wrap-up

### Task 16: Full matrix build + worked examples

**Step 1:** Run the whole pipeline.

Run: `pnpm -w -r build`
Run: `pnpm -w -r test`
Run: `pnpm --filter @elektroplan/desktop dev` (manual smoke)

**Manual checklist:**
- [ ] `/projects` route loads; old `/history` not in nav.
- [ ] Create project "Test Proje" → appears in Quick Panel and Projects page.
- [ ] Create group "G1" inside project → appears under project only.
- [ ] Save a 0.55 kW table motor calc into G1 with quantity 1 → detail view shows friendly rows (not raw JSON), matches screenshot-equivalent fields.
- [ ] Change quantity to 3 → group total current = 1.6 A × 3 = 4.8 A.
- [ ] Group card shows cable suggestion for toprak & hava, both with `2.5 mm² önerilir` standard hint.
- [ ] Add a 15 kW motor → hint becomes `4 mm²`.
- [ ] Duplicate group "G1" → new group with fresh id, same records (new ids), quantities preserved.
- [ ] Motor formula 0.55 kW formula-mode output → both "Önerilen Kablo Kesiti" and "Standart Kesit Önerisi (2,5 mm²)" rows visible.
- [ ] Motor formula 37 kW output → only "Önerilen Kablo Kesiti" row (ruler section > 4), no hint row.
- [ ] Quick Panel collapse state persists after reload.

**Step 2:** If anything fails, stop and fix root cause — do **not** mask with conditional rendering.

**Step 3: Commit docs if any were updated**

```bash
git add docs
git commit -m "docs: record manual-verification results for projects + cable hints"
```

---

## Execution notes

- **DRY:** `useProjectsData` + `projectMutations` are shared by Projects page and Quick Panel — do not duplicate.
- **YAGNI:** No migrations, no new DB tables, no "legacy compat" for `/history`. Projects live in the existing `groups` table via `tags:["project"]`.
- **TDD:** Every calculation-core and contracts change is test-first; IPC/renderer changes are behaviour-verified by manual smoke since there is no renderer test harness.
- **Commits:** after every green task, as shown.

---

