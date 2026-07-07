# UI State and Voltage Drop Workflow Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make calculator pages retain their last working state, improve the voltage-drop segment workflow, show automatic section results clearly, add installation-method explanations, and polish the main sidebar.

**Architecture:** Add one shared renderer-side localStorage helper for durable page state, then wire each page/component to it with narrow state snapshots. Keep voltage-drop calculation contracts unchanged; most voltage-drop changes are presentation and workflow changes around existing `VoltageDropGroupResponse` fields. Improve the segment tree as an optional visualization while making the segment list/inspector the primary editing workflow.

**Tech Stack:** React 18, TypeScript, Vite renderer, Electron bridge, React Router, Playwright e2e tests, existing CSS modules.

---

## Confirmed Product Decisions

- Installation methods stay as the current enum/options: `A1`, `A2`, `B1`, `B2`, `C`, `D`, `E`.
- Do not add separate `D1` or `D2` calculation values.
- Add human-readable descriptions next to the existing method codes.
- State persistence applies to all main pages, not only the voltage-drop page.
- The segment tree is optional UI. Segment add/edit must also work without opening or interacting with the tree.

## Existing Context

- Main routes are defined in `apps/desktop/renderer/src/router.tsx`.
- Shell/sidebar is in `apps/desktop/renderer/src/ui/Layout.tsx` and `apps/desktop/renderer/src/ui/Layout.module.css`.
- Voltage-drop page files:
  - `apps/desktop/renderer/src/features/voltageDrop/VoltageDropPage.tsx`
  - `apps/desktop/renderer/src/features/voltageDrop/VoltageDropPage.module.css`
  - `apps/desktop/renderer/src/features/voltageDrop/VoltageDropResults.tsx`
  - `apps/desktop/renderer/src/features/voltageDrop/VoltageDropResults.module.css`
  - `apps/desktop/renderer/src/features/voltageDrop/SegmentTreeCanvas.tsx`
  - `apps/desktop/renderer/src/features/voltageDrop/SegmentTreeCanvas.module.css`
  - `apps/desktop/renderer/src/features/voltageDrop/SegmentInspector.tsx`
  - `apps/desktop/renderer/src/features/voltageDrop/SegmentInspector.module.css`
  - `apps/desktop/renderer/src/features/voltageDrop/treeModel.ts`
  - `apps/desktop/renderer/src/features/voltageDrop/voltageDropGroup.ts`
- Existing e2e tests for the voltage-drop page are in `tests/e2e/src/voltageDrop.spec.ts`.
- Existing e2e installation method coverage is in `tests/e2e/src/cable.spec.ts`.

## File Structure

- Create `apps/desktop/renderer/src/features/shared/usePersistentPageState.ts`
  - Shared localStorage-backed React hook with schema version support and safe fallback.
- Modify `apps/desktop/renderer/src/features/voltageDrop/voltageDropGroup.ts`
  - Add installation method descriptions and reusable section label helpers.
- Modify `apps/desktop/renderer/src/features/voltageDrop/VoltageDropResults.tsx`
  - Display automatic/manual section output clearly in results.
- Modify `apps/desktop/renderer/src/features/voltageDrop/SegmentTreeCanvas.tsx`
  - Auto-fit when layout changes and expose a stable, growing SVG/canvas size.
- Modify `apps/desktop/renderer/src/features/voltageDrop/SegmentTreeCanvas.module.css`
  - Support dynamic canvas height and non-cramped tree rendering.
- Create `apps/desktop/renderer/src/features/voltageDrop/SegmentListEditor.tsx`
  - Tree-independent segment list and actions.
- Create `apps/desktop/renderer/src/features/voltageDrop/SegmentListEditor.module.css`
  - Compact list styling.
- Modify `apps/desktop/renderer/src/features/voltageDrop/SegmentInspector.tsx`
  - Keep selected segment edit form, but make it work cleanly when selection comes from the list.
- Modify `apps/desktop/renderer/src/features/voltageDrop/VoltageDropPage.tsx`
  - Persist page state, add tree visibility toggle, add list editor, update add-child flow.
- Modify `apps/desktop/renderer/src/features/voltageDrop/VoltageDropPage.module.css`
  - New responsive layout for optional tree/list/results.
- Modify main pages for persistence:
  - `apps/desktop/renderer/src/features/motor/MotorPage.tsx`
  - `apps/desktop/renderer/src/features/motor/FormulaMode.tsx`
  - `apps/desktop/renderer/src/features/motor/TableMode.tsx`
  - `apps/desktop/renderer/src/features/cable/CablePage.tsx`
  - `apps/desktop/renderer/src/features/cable/CableDetailedMode.tsx`
  - `apps/desktop/renderer/src/features/cable/CableRulerMode.tsx`
  - `apps/desktop/renderer/src/features/materials/MaterialsPage.tsx`
  - `apps/desktop/renderer/src/features/projects/ProjectsPage.tsx`
  - `apps/desktop/renderer/src/features/settings/SettingsPage.tsx`
- Modify `apps/desktop/renderer/src/ui/Layout.tsx`
  - Improve nav data and collapsed labels/tooltips.
- Modify `apps/desktop/renderer/src/ui/Layout.module.css`
  - Compact, cleaner sidebar.
- Modify tests:
  - `tests/e2e/src/voltageDrop.spec.ts`
  - `tests/e2e/src/cable.spec.ts`
  - Add `tests/e2e/src/pageState.spec.ts` for cross-page persistence coverage.

---

### Task 1: Add Shared Persistent Page State Hook

**Files:**
- Create: `apps/desktop/renderer/src/features/shared/usePersistentPageState.ts`

- [ ] **Step 1: Create the hook with versioned localStorage state**

Use this exact shape as the starting implementation:

```ts
import { useEffect, useMemo, useRef, useState, type Dispatch, type SetStateAction } from "react";

interface PersistedEnvelope<T> {
  readonly version: number;
  readonly value: T;
}

interface PersistentPageStateOptions<T> {
  readonly key: string;
  readonly version: number;
  readonly defaultValue: T | (() => T);
  readonly migrate?: (value: unknown, version: number) => T | null;
  readonly validate?: (value: unknown) => value is T;
}

function resolveDefault<T>(defaultValue: T | (() => T)): T {
  return typeof defaultValue === "function" ? (defaultValue as () => T)() : defaultValue;
}

function readStoredValue<T>(options: PersistentPageStateOptions<T>): T {
  if (typeof window === "undefined") {
    return resolveDefault(options.defaultValue);
  }

  try {
    const raw = window.localStorage.getItem(options.key);
    if (!raw) {
      return resolveDefault(options.defaultValue);
    }

    const parsed = JSON.parse(raw) as PersistedEnvelope<unknown>;
    if (parsed && typeof parsed === "object" && "version" in parsed && "value" in parsed) {
      if (parsed.version === options.version) {
        if (!options.validate || options.validate(parsed.value)) {
          return parsed.value as T;
        }
        return resolveDefault(options.defaultValue);
      }

      const migrated = options.migrate?.(parsed.value, Number(parsed.version));
      if (migrated !== null && migrated !== undefined) {
        return migrated;
      }
    }
  } catch {
    return resolveDefault(options.defaultValue);
  }

  return resolveDefault(options.defaultValue);
}

export function usePersistentPageState<T>(
  options: PersistentPageStateOptions<T>,
): [T, Dispatch<SetStateAction<T>>, () => void] {
  const stableOptions = useMemo(() => options, [options.key, options.version]);
  const [value, setValue] = useState<T>(() => readStoredValue(stableOptions));
  const hasMountedRef = useRef(false);

  useEffect(() => {
    if (!hasMountedRef.current) {
      hasMountedRef.current = true;
    }

    try {
      const envelope: PersistedEnvelope<T> = {
        version: stableOptions.version,
        value,
      };
      window.localStorage.setItem(stableOptions.key, JSON.stringify(envelope));
    } catch {
      // Storage persistence is best-effort; UI state must remain usable without it.
    }
  }, [stableOptions.key, stableOptions.version, value]);

  const reset = () => {
    const next = resolveDefault(stableOptions.defaultValue);
    setValue(next);
    try {
      window.localStorage.removeItem(stableOptions.key);
    } catch {
      // ignore storage failures
    }
  };

  return [value, setValue, reset];
}
```

- [ ] **Step 2: Run renderer typecheck**

Run:

```bash
pnpm --filter @elektroplan/desktop-renderer typecheck
```

Expected: TypeScript should pass. The hook imports `Dispatch` and `SetStateAction` as types, so no `React.Dispatch` namespace reference is needed.

---

### Task 2: Persist All Main Page Last States

**Files:**
- Modify: `apps/desktop/renderer/src/features/motor/MotorPage.tsx`
- Modify: `apps/desktop/renderer/src/features/motor/FormulaMode.tsx`
- Modify: `apps/desktop/renderer/src/features/motor/TableMode.tsx`
- Modify: `apps/desktop/renderer/src/features/cable/CablePage.tsx`
- Modify: `apps/desktop/renderer/src/features/cable/CableDetailedMode.tsx`
- Modify: `apps/desktop/renderer/src/features/cable/CableRulerMode.tsx`
- Modify: `apps/desktop/renderer/src/features/materials/MaterialsPage.tsx`
- Modify: `apps/desktop/renderer/src/features/projects/ProjectsPage.tsx`
- Modify: `apps/desktop/renderer/src/features/settings/SettingsPage.tsx`

- [ ] **Step 1: Persist tab/mode choices**

In `MotorPage.tsx`, replace the simple `useState` with the shared hook:

```ts
import { usePersistentPageState } from "../shared/usePersistentPageState";

type MotorMode = "formula" | "table";

function isMotorMode(value: unknown): value is MotorMode {
  return value === "formula" || value === "table";
}

const [mode, setMode] = usePersistentPageState<MotorMode>({
  key: "elektroplan.page.motor.mode",
  version: 1,
  defaultValue: "formula",
  validate: isMotorMode,
});
```

In `CablePage.tsx`, use the same pattern:

```ts
import { usePersistentPageState } from "../shared/usePersistentPageState";

type CableMode = "ruler" | "detailed";

function isCableMode(value: unknown): value is CableMode {
  return value === "ruler" || value === "detailed";
}

const [mode, setMode] = usePersistentPageState<CableMode>({
  key: "elektroplan.page.cable.mode",
  version: 1,
  defaultValue: "ruler",
  validate: isCableMode,
});
```

- [ ] **Step 2: Persist Motor formula inputs and result**

In `FormulaMode.tsx`, persist:

```ts
interface MotorFormulaPageState {
  readonly P_out: number | null;
  readonly voltage: 220 | 380;
  readonly cosPhi: number | null;
  readonly efficiencyPercent: number | null;
  readonly phase: MotorPhase;
  readonly voltageMode: MotorVoltageMode;
  readonly calculation: FormulaCalculationState | null;
}
```

Use key `elektroplan.page.motor.formula`, version `1`. Replace each local initializer with the persisted state fields, and write a single `useEffect` that updates the persisted state whenever these fields change. Keep `loading`, `error`, and `showSave` transient.

- [ ] **Step 3: Persist Motor table inputs and result**

In `TableMode.tsx`, persist:

```ts
interface MotorTablePageState {
  readonly selectedKw: number | null;
  readonly voltage: 220 | 380;
  readonly result: MotorResponse | null;
}
```

Use key `elektroplan.page.motor.table`, version `1`. Keep `loading`, `error`, and `showSave` transient.

- [ ] **Step 4: Persist Cable detailed inputs and result**

In `CableDetailedMode.tsx`, persist all calculator input fields, `result`, and `lastRequest`:

```ts
interface CableDetailedPageState {
  readonly designCurrentA: number | null;
  readonly phase: "1" | "3";
  readonly conductorMaterial: "copper" | "aluminum";
  readonly installationMethod: string;
  readonly ambientTemperatureC: number | null;
  readonly groupedCircuits: number | null;
  readonly thirdHarmonicPercent: number | null;
  readonly voltageDropLimitPercent: number | null;
  readonly systemType: CableVoltageDropSystemType;
  readonly impedanceMode: VoltageDropImpedanceMode;
  readonly lengthM: number | null;
  readonly baseVoltageV: number | null;
  readonly cosPhi: number | null;
  readonly parallelConductors: number | null;
  readonly conductorTempC: number | null;
  readonly reactanceOhmPerKm: number | null;
  readonly result: CableResponse | null;
  readonly lastRequest: CableRequest | null;
}
```

Use key `elektroplan.page.cable.detailed`, version `1`. Keep loading/dialog/error state transient.

- [ ] **Step 5: Persist Cable ruler state**

Open `CableRulerMode.tsx` and persist all user-selectable inputs, result, and saveable request/output if present. Use key `elektroplan.page.cable.ruler`, version `1`. Do not persist dialog visibility, loading, or errors.

- [ ] **Step 6: Persist Materials page navigation/filter state**

In `MaterialsPage.tsx`, persist:

```ts
interface MaterialsPageState {
  readonly selectedCategoryId: string | null;
  readonly searchRaw: string;
  readonly selectedIds: readonly string[];
}
```

Use key `elektroplan.page.materials`, version `1`. Convert `selectedIds` between array and `Set<string>`. Do not persist modal/dialog visibility.

- [ ] **Step 7: Persist Projects page selection and drafts**

In `ProjectsPage.tsx`, persist:

```ts
interface ProjectsPageState {
  readonly activeProjectId: string;
  readonly activeGroupId: string;
  readonly activeRecordId: string;
  readonly projectDraft: string;
  readonly groupDraft: string;
  readonly duplicateDrafts: Record<string, string>;
  readonly showProjectForm: boolean;
  readonly showGroupForm: boolean;
}
```

Use key `elektroplan.page.projects`, version `1`. Keep `actionError` transient.

- [ ] **Step 8: Persist Settings page unsaved form state**

In `SettingsPage.tsx`, persist the editable form state:

```ts
interface SettingsPageDraftState {
  readonly firmName: string;
  readonly defaultVdProfile: string;
  readonly voltageDropGroupDefaults: VoltageDropGroupSettingsDraft;
}
```

Use key `elektroplan.page.settings.draft`, version `1`. When bridge queries load saved settings, only overwrite the draft if local storage has no draft. This prevents a user from losing unsaved edits by navigating away and back.

- [ ] **Step 9: Add e2e coverage for cross-page persistence**

Add `tests/e2e/src/pageState.spec.ts` with one smoke test:

```ts
import { test, expect, inputInLabeledField } from "./fixtures.js";

test("main pages restore last local UI state after navigation", async ({ page }) => {
  await page.goto("/#/motor");
  await page.getByRole("button", { name: /Tablo Modu/i }).click();
  await page.goto("/#/cable");
  await page.getByRole("button", { name: /Detay/i }).click();
  await page.goto("/#/motor");
  await expect(page.getByRole("button", { name: /Tablo Modu/i })).toHaveClass(/active/);

  await page.goto("/#/voltage-drop");
  await inputInLabeledField(page, /Grup adi/i).fill("Kalici taslak");
  await page.goto("/#/projects");
  await page.goto("/#/voltage-drop");
  await expect(inputInLabeledField(page, /Grup adi/i)).toHaveValue("Kalici taslak");
});
```

Assert the active mode through visible page content unique to the selected mode when CSS module class names are hashed in test output.

---

### Task 3: Show Automatic Section Results Clearly

**Files:**
- Modify: `apps/desktop/renderer/src/features/voltageDrop/voltageDropGroup.ts`
- Modify: `apps/desktop/renderer/src/features/voltageDrop/VoltageDropResults.tsx`
- Modify: `apps/desktop/renderer/src/features/voltageDrop/SegmentTreeCanvas.tsx`
- Modify: `tests/e2e/src/voltageDrop.spec.ts`

- [ ] **Step 1: Add display helpers**

In `voltageDropGroup.ts`, add:

```ts
export function formatVoltageDropSectionLabel(segment: VoltageDropGroupSegmentResult): string {
  const sectionArea = segment.selectedSectionAreaMm2 ?? segment.selectedSectionMm2;
  const runs = segment.selectedParallelRuns ?? 1;
  const sectionText = runs > 1 ? `${runs}x${sectionArea} mm²` : `${sectionArea} mm²`;
  return segment.fixedSection ? `Manuel: ${sectionText}` : `Otomatik: ${sectionText}`;
}
```

If the codebase is kept ASCII-only in touched files, use `mm2` in the string instead of `mm²`, matching existing voltage-drop text.

- [ ] **Step 2: Update result table column**

In `VoltageDropResults.tsx`, import the helper and replace:

```tsx
<th scope="col">Kesit anahtari</th>
...
<td>{segment.selectedSectionKey ?? "-"}</td>
```

with:

```tsx
<th scope="col">Hesaplanan kesit</th>
...
<td>{formatVoltageDropSectionLabel(segment)}</td>
```

- [ ] **Step 3: Update tree node section line**

In `SegmentTreeCanvas.tsx`, import `formatVoltageDropSectionLabel` and replace the node line:

```ts
const sectionLine = resultSegment
  ? ellipsis(`Kesit ${formatNumberTr(resultSegment.selectedSectionMm2, 0)} mm2`, 30)
  : "Sonuc yok";
```

with:

```ts
const sectionLine = resultSegment
  ? ellipsis(formatVoltageDropSectionLabel(resultSegment), 30)
  : "Sonuc yok";
```

- [ ] **Step 4: Strengthen e2e assertion**

In `tests/e2e/src/voltageDrop.spec.ts`, change the section assertion to expect a visible automatic section:

```ts
await expect(row.locator("td").nth(5)).toHaveText(/Otomatik:\s*\d+/i);
```

---

### Task 4: Add Installation Method Descriptions

**Files:**
- Modify: `apps/desktop/renderer/src/features/voltageDrop/voltageDropGroup.ts`
- Modify: `apps/desktop/renderer/src/features/cable/CableDetailedMode.tsx`
- Modify: `apps/desktop/renderer/src/features/settings/SettingsPage.tsx`
- Modify: `apps/desktop/renderer/src/features/voltageDrop/SegmentInspector.tsx`
- Modify: `tests/e2e/src/cable.spec.ts`
- Modify: `tests/e2e/src/voltageDrop.spec.ts`

- [ ] **Step 1: Centralize descriptions**

In `voltageDropGroup.ts`, replace `INSTALLATION_METHOD_OPTIONS` with labels like:

```ts
export const INSTALLATION_METHOD_DESCRIPTIONS: Record<VoltageDropGroupInstallationMethod, string> = {
  A1: "Isi yalitimli duvar icinde boruda",
  A2: "Isi yalitimli duvar icinde cok damarli kablo",
  B1: "Boru/kanal icinde tek damarli",
  B2: "Boru/kanal icinde cok damarli",
  C: "Duvar veya yuzey uzerinde",
  D: "Toprak altinda",
  E: "Havada veya serbest",
};

export const INSTALLATION_METHOD_OPTIONS: {
  value: VoltageDropGroupInstallationMethod;
  label: string;
}[] = [
  { value: "A1", label: `A1 - ${INSTALLATION_METHOD_DESCRIPTIONS.A1}` },
  { value: "A2", label: `A2 - ${INSTALLATION_METHOD_DESCRIPTIONS.A2}` },
  { value: "B1", label: `B1 - ${INSTALLATION_METHOD_DESCRIPTIONS.B1}` },
  { value: "B2", label: `B2 - ${INSTALLATION_METHOD_DESCRIPTIONS.B2}` },
  { value: "C", label: `C - ${INSTALLATION_METHOD_DESCRIPTIONS.C}` },
  { value: "D", label: `D - ${INSTALLATION_METHOD_DESCRIPTIONS.D}` },
  { value: "E", label: `E - ${INSTALLATION_METHOD_DESCRIPTIONS.E}` },
];
```

- [ ] **Step 2: Reuse labels in cable detailed mode**

In `CableDetailedMode.tsx`, remove the local `methodDescriptions` object. Import `INSTALLATION_METHOD_DESCRIPTIONS` and build labels from it:

```ts
import { INSTALLATION_METHOD_DESCRIPTIONS } from "../voltageDrop/voltageDropGroup";

const methodOptions = methods.map((method) => ({
  value: method,
  label:
    method in INSTALLATION_METHOD_DESCRIPTIONS
      ? `${method} - ${INSTALLATION_METHOD_DESCRIPTIONS[method as keyof typeof INSTALLATION_METHOD_DESCRIPTIONS]}`
      : method,
}));
```

- [ ] **Step 3: Verify all consumers get descriptions**

The existing consumers of `INSTALLATION_METHOD_OPTIONS` should now show descriptions automatically:

- `VoltageDropPage.tsx`
- `SegmentInspector.tsx`
- `SettingsPage.tsx`

- [ ] **Step 4: Update tests without adding D1/D2**

Keep `tests/e2e/src/cable.spec.ts` value assertion unchanged for `{A1,A2,B1,B2,C,D,E}`. Add label assertions:

```ts
const labels = await Promise.all(options.map((o) => o.innerText()));
expect(labels.join(" ")).toContain("A1 -");
expect(labels.join(" ")).toContain("D - Toprak");
expect(nonEmpty.sort()).toEqual(["A1", "A2", "B1", "B2", "C", "D", "E"]);
```

---

### Task 5: Build Tree-Independent Segment List Editor

**Files:**
- Create: `apps/desktop/renderer/src/features/voltageDrop/SegmentListEditor.tsx`
- Create: `apps/desktop/renderer/src/features/voltageDrop/SegmentListEditor.module.css`
- Modify: `apps/desktop/renderer/src/features/voltageDrop/VoltageDropPage.tsx`
- Modify: `apps/desktop/renderer/src/features/voltageDrop/VoltageDropPage.module.css`
- Modify: `tests/e2e/src/voltageDrop.spec.ts`

- [ ] **Step 1: Create `SegmentListEditor.tsx`**

The component must:

- Render every segment as a compact row.
- Let the user select a segment without using the tree.
- Let the user add a child to any row.
- Let the user add a new segment under the selected segment from a top action.
- Show parent title, load, length, section mode, and status if result exists.
- Never own segment state; all changes flow through callbacks from `VoltageDropPage`.

Use this interface:

```ts
import { formatNumberTr } from "../../i18n/format";
import type { VoltageDropTreeSegmentDraft } from "./treeModel";
import type { VoltageDropGroupSegmentResult } from "./voltageDropGroup";
import styles from "./SegmentListEditor.module.css";

interface SegmentListEditorProps {
  readonly segments: VoltageDropTreeSegmentDraft[];
  readonly resultSegments: readonly VoltageDropGroupSegmentResult[] | null;
  readonly selectedSegmentId: string | null;
  readonly onSelectSegment: (id: string) => void;
  readonly onAddChild: (parentId: string) => void;
  readonly onRemove: (id: string) => void;
  readonly canRemove: (id: string) => boolean;
}
```

- [ ] **Step 2: Add list to voltage-drop page**

In `VoltageDropPage.tsx`, render the list above the inspector. The list must remain visible when the tree is hidden:

```tsx
<Card
  className={styles.segmentListArea}
  title="Segmentler"
  subtitle="Agactan bagimsiz segment secin, ekleyin veya silin."
>
  <SegmentListEditor
    segments={segments}
    resultSegments={result?.value.segments ?? null}
    selectedSegmentId={selectedSegmentId}
    onSelectSegment={setSelectedSegmentId}
    onAddChild={addChildSegment}
    onRemove={removeSegment}
    canRemove={() => segments.length > 1}
  />
</Card>
```

- [ ] **Step 3: Make the primary add action selection-aware**

Replace the root-only header action with:

```tsx
const addTargetSegmentId = selectedSegmentId ?? rootSegmentId;

<Button
  type="button"
  variant="secondary"
  disabled={!addTargetSegmentId}
  onClick={() => {
    if (addTargetSegmentId) {
      addChildSegment(addTargetSegmentId);
    }
  }}
>
  Yeni alt segment
</Button>
```

Keep a separate root action if needed, but the primary action should support a straight-line workflow where the next segment is added under the selected row.

- [ ] **Step 4: Add e2e list workflow**

In `tests/e2e/src/voltageDrop.spec.ts`, add a test that hides the tree, creates a child from the list/header, edits it through the inspector, calculates, and sees the result row.

---

### Task 6: Make Segment Tree Optional and Auto-Fitting

**Files:**
- Modify: `apps/desktop/renderer/src/features/voltageDrop/VoltageDropPage.tsx`
- Modify: `apps/desktop/renderer/src/features/voltageDrop/VoltageDropPage.module.css`
- Modify: `apps/desktop/renderer/src/features/voltageDrop/SegmentTreeCanvas.tsx`
- Modify: `apps/desktop/renderer/src/features/voltageDrop/SegmentTreeCanvas.module.css`
- Modify: `tests/e2e/src/voltageDrop.spec.ts`

- [ ] **Step 1: Add persisted tree visibility**

In the voltage-drop persisted page state from Task 7, include:

```ts
readonly treeVisible: boolean;
```

Default `treeVisible` to `true`. Add a header toggle:

```tsx
<Button
  type="button"
  variant="secondary"
  onClick={() => setTreeVisible((current) => !current)}
  aria-pressed={treeVisible}
>
  {treeVisible ? "Agaci gizle" : "Agaci goster"}
</Button>
```

- [ ] **Step 2: Conditional tree layout**

Only render the tree card when `treeVisible` is true. Add a data attribute to the layout:

```tsx
<div className={styles.layout} data-tree-visible={treeVisible ? "true" : "false"}>
```

CSS should make the list/inspector/results use the freed space when the tree is hidden.

- [ ] **Step 3: Auto-fit when tree changes**

In `SegmentTreeCanvas.tsx`, remove the one-time-only auto-fit behavior. Replace the existing `hasAutoFit` logic with an effect that recalculates on layout size changes:

```ts
useEffect(() => {
  if (segments.length === 0 || containerSize.width <= 0 || containerSize.height <= 0) {
    return;
  }
  const fitScale = Math.min(containerSize.width / layout.viewWidth, containerSize.height / layout.viewHeight);
  setScale(clampScale(fitScale));
}, [containerSize.height, containerSize.width, layout.viewHeight, layout.viewWidth, segments.length]);
```

Keep auto-fit as the default behavior and reset to auto-fit whenever a segment is added or removed. Manual zoom buttons may still change the scale until the next tree-size change.

- [ ] **Step 4: Grow tree height with content**

Compute a content-aware height:

```ts
const canvasHeight = Math.max(360, Math.min(900, layout.viewHeight + 40));
```

Apply it to the canvas wrapper:

```tsx
<div className={styles.canvas} ref={containerRef} style={{ minHeight: canvasHeight }}>
```

The canvas should not stay stuck at one cramped viewport as segment count increases.

- [ ] **Step 5: Test tree toggle and auto-fit**

Add assertions:

- Toggle hides `Segment agaci`.
- Segment list and inspector remain visible.
- Toggle shows the tree again.
- After adding at least 6 segments, the SVG remains visible and the last segment node can be selected without manual panning.

---

### Task 7: Persist Voltage-Drop Full Draft and Result

**Files:**
- Modify: `apps/desktop/renderer/src/features/voltageDrop/VoltageDropPage.tsx`
- Modify: `apps/desktop/renderer/src/features/voltageDrop/treeModel.ts`
- Modify: `tests/e2e/src/voltageDrop.spec.ts`

- [ ] **Step 1: Define persisted page state**

In `VoltageDropPage.tsx`, add:

```ts
interface VoltageDropPageState {
  readonly groupTitle: string;
  readonly segments: VoltageDropTreeSegmentDraft[];
  readonly settings: VoltageDropGroupSettingsDraft;
  readonly selectedSegmentId: string | null;
  readonly showAdvanced: boolean;
  readonly treeVisible: boolean;
  readonly result: VoltageDropGroupResponse | null;
  readonly lastRequest: VoltageDropGroupRequest | null;
}
```

Use key `elektroplan.page.voltageDrop`, version `1`.

- [ ] **Step 2: Load defaults only when no draft exists**

Current code loads global defaults from `VOLTAGE_DROP_GROUP_DEFAULTS_SETTING_KEY`. Preserve this behavior only for a fresh page state. If persisted `segments` exists, do not overwrite it with global defaults.

Implementation rule:

- Default state creates one root segment from `createInitialSettings()`.
- If localStorage contains a valid `VoltageDropPageState`, use it.
- The async settings load may update only when the draft is still untouched/fresh.

- [ ] **Step 3: Persist after every meaningful user change**

Use either the shared hook as the source of truth or a local `useEffect` that writes the snapshot. Prefer the shared hook:

```ts
const [pageState, setPageState] = usePersistentPageState<VoltageDropPageState>({
  key: "elektroplan.page.voltageDrop",
  version: 1,
  defaultValue: () => createDefaultVoltageDropPageState(),
});
```

Then derive `groupTitle`, `segments`, `settings`, `selectedSegmentId`, `showAdvanced`, `treeVisible`, `result`, and `lastRequest` from `pageState`, using small setter helpers to keep the existing code readable.

- [ ] **Step 4: Ensure save still uses last calculated request**

The `saveRecord` logic should keep using persisted/restored `result` and `lastRequest`. After navigating away and back, the user should be able to press `Kaydet` for the last calculation.

- [ ] **Step 5: E2E persistence check**

Add a test:

```ts
await page.goto("/#/voltage-drop");
await inputInLabeledField(page, /Grup adi/i).fill("Kalici gerilim dusumu");
await setSelectedSegmentValues(page, { title: "Ana besleme", kW: "5", lengthM: "50" });
await page.getByRole("button", { name: /^Hesapla$/i }).click();
await expect(page.getByText(/Hesap sonucu/i)).toBeVisible();
await page.goto("/#/motor");
await page.goto("/#/voltage-drop");
await expect(inputInLabeledField(page, /Grup adi/i)).toHaveValue("Kalici gerilim dusumu");
await expect(page.getByText(/Hesap sonucu/i)).toBeVisible();
```

---

### Task 8: Optimize Main Sidebar

**Files:**
- Modify: `apps/desktop/renderer/src/ui/Layout.tsx`
- Modify: `apps/desktop/renderer/src/ui/Layout.module.css`
- Modify: `tests/e2e/src/voltageDrop.spec.ts`

- [ ] **Step 1: Add compact nav metadata**

Change `NAV` to include short labels for collapsed mode:

```ts
const NAV = [
  { to: "/motor", label: "Motor Akimi", shortLabel: "M" },
  { to: "/cable", label: "Kablo Kesiti", shortLabel: "K" },
  { to: "/voltage-drop", label: "Gerilim Dusumu", shortLabel: "GD" },
  { to: "/projects", label: "Projeler", shortLabel: "P" },
  { to: "/materials", label: "Malzemeler", shortLabel: "ML" },
  { to: "/settings", label: "Ayarlar", shortLabel: "A" },
];
```

Render both spans:

```tsx
<span className={styles.navIcon} aria-hidden="true">{item.shortLabel}</span>
<span className={styles.navLabel}>{item.label}</span>
```

- [ ] **Step 2: Reduce sidebar footprint**

In `Layout.module.css`:

- Reduce expanded width from `240px` to `220px`.
- Keep collapsed width at `64px`.
- Reduce logo max height to about `88px` expanded and hide it cleanly collapsed.
- Make nav rows consistent: `min-block-size: 40px`, tighter padding, active indicator preserved.
- Make theme switcher compact and prevent text overflow in collapsed state.

- [ ] **Step 3: Keep existing collapse behavior**

Existing e2e checks rely on the sidebar collapse increasing main width. Preserve:

- `data-sidebar-collapsed`
- `aria-label` values `Menuyu genislet` and `Menuyu daralt`
- localStorage key `elektroplan.sidebar.collapsed`

---

### Task 9: Final Verification

**Files:**
- No new source files unless tests require small fixture helpers.

- [ ] **Step 1: Run renderer typecheck**

```bash
pnpm --filter @elektroplan/desktop-renderer typecheck
```

Expected: pass.

- [ ] **Step 2: Run renderer build**

```bash
pnpm --filter @elektroplan/desktop-renderer build
```

Expected: pass.

- [ ] **Step 3: Run core calculation tests**

```bash
pnpm --filter @elektroplan/calculation-core test
```

Expected: pass. The calculation engine should not need behavior changes for this plan.

- [ ] **Step 4: Run relevant e2e tests**

```bash
pnpm --filter @elektroplan/e2e test -- voltageDrop.spec.ts cable.spec.ts pageState.spec.ts
```

Expected: pass. When the package script does not accept file arguments, run the existing e2e command documented in `tests/e2e/package.json` and filter with Playwright grep.

- [ ] **Step 5: Manual visual checks**

Check these routes in the Electron/Vite app:

- `/#/voltage-drop`: tree visible, tree hidden, many segments, result table.
- `/#/motor`: formula and table mode restore.
- `/#/cable`: ruler and detailed mode restore.
- `/#/materials`: category/search selection restores.
- `/#/projects`: selected project/group/record restores.
- `/#/settings`: unsaved draft values restore after route navigation.

Acceptance criteria:

- Automatic voltage-drop sections show a numeric section, not only `Uygun`.
- Segment tree can be hidden and shown.
- Segment add/edit works through the list/inspector without using the tree.
- The tree auto-fits after segment count changes.
- Installation labels include descriptions but values remain `{A1,A2,B1,B2,C,D,E}`.
- Last page states survive route changes.
- Sidebar looks compact, readable, and does not reduce content space unnecessarily.

---

## Implementation Notes

- Avoid changing calculation-core contracts unless tests prove a response field is missing. Current `VoltageDropGroupSegmentResult` already contains the section fields needed for display.
- Do not persist loading spinners, transient errors, confirmation dialog visibility, or save dialog visibility.
- Keep persistence best-effort. If `localStorage` fails, the app should continue with default in-memory state.
- Do not add `D1` or `D2` values. Only improve labels for the existing `D`.
- The repository has many existing untracked/modified files. Do not revert unrelated work.
