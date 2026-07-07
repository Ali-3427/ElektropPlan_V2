# Çok Segmentli Gerilim Düşümü Grubu Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Mevcut Gerilim Düşümü sayfasını çok segmentli, kaskat çalışan "Gerilim düşümü grubu" hesabına dönüştürmek ve bu sonucu projelere ayrı hesap tipi olarak kaydedebilmek.

**Architecture:** Yeni `voltage-drop-group` hesap tipi eklenecek. Hesap motoru `packages/calculation-core` içinde saf fonksiyon olacak; kontratlar `packages/contracts`, IPC servisleri `apps/desktop/main`, UI ve proje detayları `apps/desktop/renderer` tarafında genişletilecek. Eski tekil `voltage-drop` hesap tipi veri uyumluluğu için korunacak.

**Tech Stack:** TypeScript, Zod, Vitest, React/Vite, Electron IPC, TanStack Query, mevcut `@elektroplan/calculation-data` IEC veri erişimleri.

---

## Scope And Defaults

- Mevcut `/#/voltage-drop` sayfası segment-first akışa dönüştürülecek.
- Topoloji ilk sürümde sıralı radyal hat olacak: Segment 1 kaynak tarafı, son segment uç taraf.
- Kullanıcı temel akışta yalnızca grup adı, segment adı, kW ve metre girerek hesap yapabilecek.
- Gelişmiş ayarlar preset dolu gelecek; kullanıcı isterse değiştirebilecek.
- Varsayılan gerilim düşümü limiti `%3` olacak.
- Sonuç projelere `calculator: "voltage-drop-group"` olarak kaydedilecek ve `Gerilim düşümü grubu` etiketiyle görünecek.

---

## Task 1: Calculation Core Type And Defaults

**Files:**
- Create: `packages/calculation-core/src/voltage-drop-group/types.ts`
- Create: `packages/calculation-core/src/voltage-drop-group/defaults.ts`
- Create: `packages/calculation-core/src/voltage-drop-group/index.ts`
- Modify: `packages/calculation-core/src/index.ts`

- [x] **Step 1: Define input/output types**

Create `types.ts` with these public types:

```ts
import type {
  AmpacityMaterial,
  InstallationMethodCode,
  InsulationRating,
} from "@elektroplan/calculation-data";

import type { CalculationResult } from "../common/types/result.js";
import type { VoltageDropImpedanceMode } from "../voltage-drop/index.js";

export type VoltageDropGroupPhaseMode = "auto" | "single-phase" | "three-phase";
export type VoltageDropGroupSystemType = "single-phase-ac-two-conductor" | "three-phase-ac-ll";

export interface VoltageDropGroupSegmentInput {
  id?: string;
  title: string;
  localPowerKW: number;
  lengthM: number;
}

export interface VoltageDropGroupSettingsInput {
  limitPercent?: number;
  phaseMode?: VoltageDropGroupPhaseMode;
  singlePhaseVoltageV?: number;
  threePhaseVoltageV?: number;
  cosPhi?: number;
  efficiencyPercent?: number;
  conductorMaterial?: AmpacityMaterial;
  installationMethod?: InstallationMethodCode;
  insulationRating?: InsulationRating;
  ambientTemperatureC?: number;
  groupedCircuits?: number;
  thirdHarmonicPercent?: number;
  conductorTempC?: number;
  impedanceMode?: VoltageDropImpedanceMode;
  reactanceOhmPerKm?: number;
  terminalLossFactor?: number;
}

export interface VoltageDropGroupInput {
  title?: string;
  segments: VoltageDropGroupSegmentInput[];
  settings?: VoltageDropGroupSettingsInput;
}

export interface VoltageDropGroupResolvedSettings {
  limitPercent: number;
  phaseMode: VoltageDropGroupPhaseMode;
  systemType: VoltageDropGroupSystemType;
  baseVoltageV: number;
  cosPhi: number;
  efficiencyPercent: number;
  conductorMaterial: AmpacityMaterial;
  installationMethod: InstallationMethodCode;
  insulationRating: InsulationRating;
  ambientTemperatureC: number;
  groupedCircuits: number;
  thirdHarmonicPercent: number;
  conductorTempC: number;
  impedanceMode: VoltageDropImpedanceMode;
  reactanceOhmPerKm?: number;
  terminalLossFactor: number;
}

export interface VoltageDropGroupSegmentOutput {
  id?: string;
  title: string;
  order: number;
  localPowerKW: number;
  flowPowerKW: number;
  lengthM: number;
  currentA: number;
  selectedSectionMm2: number;
  baseAmpacityA: number;
  correctedAmpacityA: number;
  segmentDeltaVVolts: number;
  segmentDeltaVPercent: number;
  cumulativeDeltaVPercent: number;
  thermalPass: boolean;
  voltageDropPass: boolean;
  compliant: boolean;
}

export interface VoltageDropGroupOptimizationStep {
  iteration: number;
  segmentOrder: number;
  segmentTitle: string;
  fromSectionMm2: number;
  toSectionMm2: number;
  previousMaxCumulativeDeltaVPercent: number;
  nextMaxCumulativeDeltaVPercent: number;
  sensitivityIndex: number;
}

export interface VoltageDropGroupOutput {
  title?: string;
  settings: VoltageDropGroupResolvedSettings;
  totalLocalPowerKW: number;
  maxCumulativeDeltaVPercent: number;
  isCompliant: boolean;
  segments: VoltageDropGroupSegmentOutput[];
  optimizationSteps: VoltageDropGroupOptimizationStep[];
}

export type VoltageDropGroupResult = CalculationResult<VoltageDropGroupOutput>;
```

- [x] **Step 2: Define defaults**

Create `defaults.ts`:

```ts
import type { VoltageDropGroupResolvedSettings, VoltageDropGroupSettingsInput } from "./types.js";

export const VOLTAGE_DROP_GROUP_DATA_VERSION = "voltage-drop-group-radial-v1";

export const DEFAULT_VOLTAGE_DROP_GROUP_SETTINGS = {
  limitPercent: 3,
  phaseMode: "auto",
  singlePhaseVoltageV: 230,
  threePhaseVoltageV: 400,
  cosPhi: 0.8,
  efficiencyPercent: 100,
  conductorMaterial: "copper",
  installationMethod: "C",
  insulationRating: "XLPE_EPR_90C",
  ambientTemperatureC: 30,
  groupedCircuits: 1,
  thirdHarmonicPercent: 0,
  conductorTempC: 70,
  impedanceMode: "simplified",
  terminalLossFactor: 1.015,
} as const;

export function resolveVoltageDropGroupSettings(
  settings: VoltageDropGroupSettingsInput | undefined,
  totalLocalPowerKW: number,
): VoltageDropGroupResolvedSettings {
  const merged = {
    ...DEFAULT_VOLTAGE_DROP_GROUP_SETTINGS,
    ...(settings ?? {}),
  };
  const systemType =
    merged.phaseMode === "three-phase" || (merged.phaseMode === "auto" && totalLocalPowerKW > 5)
      ? "three-phase-ac-ll"
      : "single-phase-ac-two-conductor";

  return {
    limitPercent: merged.limitPercent,
    phaseMode: merged.phaseMode,
    systemType,
    baseVoltageV:
      systemType === "three-phase-ac-ll" ? merged.threePhaseVoltageV : merged.singlePhaseVoltageV,
    cosPhi: merged.cosPhi,
    efficiencyPercent: merged.efficiencyPercent,
    conductorMaterial: merged.conductorMaterial,
    installationMethod: merged.installationMethod,
    insulationRating: merged.insulationRating,
    ambientTemperatureC: merged.ambientTemperatureC,
    groupedCircuits: merged.groupedCircuits,
    thirdHarmonicPercent: merged.thirdHarmonicPercent,
    conductorTempC: merged.conductorTempC,
    impedanceMode: merged.impedanceMode,
    ...(merged.reactanceOhmPerKm === undefined ? {} : { reactanceOhmPerKm: merged.reactanceOhmPerKm }),
    terminalLossFactor: merged.terminalLossFactor,
  };
}
```

- [x] **Step 3: Export from module and package root**

Create `index.ts` as the public module entry. For now, export types and defaults; Task 3 will add `calculateVoltageDropGroup`.

Modify `packages/calculation-core/src/index.ts` to export the new module.

- [x] **Step 4: Typecheck**

Run:

```bash
pnpm --filter @elektroplan/calculation-core typecheck
```

Expected: PASS.

---

## Task 2: Calculation Core Tests

**Files:**
- Create: `packages/calculation-core/src/voltage-drop-group/index.test.ts`

- [x] **Step 1: Write failing tests**

Create tests before implementation:

```ts
import { calculateVoltageDropGroup } from "./index.js";

describe("calculateVoltageDropGroup", () => {
  it("calculates the two-segment radial example within the default 3 percent limit", () => {
    const result = calculateVoltageDropGroup({
      title: "A grubu",
      segments: [
        { title: "Segment 1", localPowerKW: 1, lengthM: 20 },
        { title: "Segment 2", localPowerKW: 3, lengthM: 30 },
      ],
    });

    expect(result.value.settings.limitPercent).toBe(3);
    expect(result.value.settings.systemType).toBe("single-phase-ac-two-conductor");
    expect(result.value.totalLocalPowerKW).toBeCloseTo(4, 12);
    expect(result.value.isCompliant).toBe(true);
    expect(result.value.maxCumulativeDeltaVPercent).toBeLessThanOrEqual(3);
    expect(result.value.segments).toHaveLength(2);
    expect(result.value.segments[0]?.flowPowerKW).toBeCloseTo(4, 12);
    expect(result.value.segments[1]?.flowPowerKW).toBeCloseTo(3, 12);
  });

  it("uses three phase automatically above 5 kW total power", () => {
    const result = calculateVoltageDropGroup({
      segments: [{ title: "Ana hat", localPowerKW: 6, lengthM: 25 }],
    });

    expect(result.value.settings.systemType).toBe("three-phase-ac-ll");
    expect(result.value.settings.baseVoltageV).toBe(400);
  });

  it("does not reduce selected sections when the limit becomes stricter", () => {
    const relaxed = calculateVoltageDropGroup({
      segments: [
        { title: "Segment 1", localPowerKW: 1, lengthM: 20 },
        { title: "Segment 2", localPowerKW: 3, lengthM: 30 },
      ],
      settings: { limitPercent: 3 },
    });
    const strict = calculateVoltageDropGroup({
      segments: [
        { title: "Segment 1", localPowerKW: 1, lengthM: 20 },
        { title: "Segment 2", localPowerKW: 3, lengthM: 30 },
      ],
      settings: { limitPercent: 1.5 },
    });

    for (const [index, strictSegment] of strict.value.segments.entries()) {
      expect(strictSegment.selectedSectionMm2).toBeGreaterThanOrEqual(
        relaxed.value.segments[index]!.selectedSectionMm2,
      );
    }
  });

  it("rejects empty and invalid segment inputs", () => {
    expect(() => calculateVoltageDropGroup({ segments: [] })).toThrow("segments must contain at least one segment.");
    expect(() =>
      calculateVoltageDropGroup({ segments: [{ title: "S1", localPowerKW: 0, lengthM: 10 }] }),
    ).toThrow("segments[0].localPowerKW must be positive.");
    expect(() =>
      calculateVoltageDropGroup({ segments: [{ title: "S1", localPowerKW: 1, lengthM: 0 }] }),
    ).toThrow("segments[0].lengthM must be positive.");
  });
});
```

- [x] **Step 2: Run test and confirm failure**

Run:

```bash
pnpm --filter @elektroplan/calculation-core test -- --run voltage-drop-group
```

Expected: FAIL because `calculateVoltageDropGroup` is not implemented.

---

## Task 3: Calculation Algorithm

**Files:**
- Create: `packages/calculation-core/src/voltage-drop-group/algorithm.ts`
- Modify: `packages/calculation-core/src/voltage-drop-group/index.ts`
- Modify if needed: `packages/calculation-core/src/cable/correction-factors.ts`

- [x] **Step 1: Implement validation**

Validation rules:

- `segments.length >= 1`
- Segment title must be non-empty after trim.
- `localPowerKW > 0`
- `lengthM > 0`
- `limitPercent > 0`
- `0 < cosPhi <= 1`
- `0 < efficiencyPercent <= 100`
- `groupedCircuits` must be a positive integer.
- `terminalLossFactor > 0`

- [x] **Step 2: Implement backward sweep**

From last segment to first:

```ts
flowPowerKW[i] = segments.slice(i).reduce((sum, segment) => sum + segment.localPowerKW, 0);
```

Use one pass from right to left to avoid repeated work.

- [x] **Step 3: Implement current calculation**

Use resolved settings:

```ts
const efficiency = settings.efficiencyPercent / 100;
const currentA =
  settings.systemType === "three-phase-ac-ll"
    ? (flowPowerKW * 1000) / (SQRT3 * settings.baseVoltageV * settings.cosPhi * efficiency)
    : (flowPowerKW * 1000) / (settings.baseVoltageV * settings.cosPhi * efficiency);
```

- [x] **Step 4: Implement ampacity lookup**

Three phase:

- Use `getAmpacity({ material, crossSectionMm2, method })`.
- Apply `kT`, `kG`, `kH`, and extra factor `1`.

Single phase:

- Add local 2-loaded copper/aluminum ampacity table in `algorithm.ts` for sections present in `getStandardCrossSections(material)`.
- Source values must be copied from `docs/plans/Gerilim_dusumu_arastırma_raporu.md` or `Plan/IEC_60364_5_52_DATA_REFERENCE.md`.
- Use only method `C` exactly in v1 if authoritative 2-loaded values for every method are not available.
- If single phase uses a method without 2-loaded data, throw:

```text
Single-phase voltage-drop group sizing currently supports installation method C only.
```

- [x] **Step 5: Select initial section**

For each segment, scan `getStandardCrossSections(settings.conductorMaterial)` ascending. Select the first section with `correctedAmpacityA >= currentA`.

If none found, throw:

```text
No cable cross-section satisfies thermal current for segment '<title>'.
```

- [x] **Step 6: Implement forward sweep**

For each segment, call existing `calculateVoltageDrop`:

```ts
calculateVoltageDrop({
  mode: "current",
  systemType: settings.systemType,
  impedanceMode: settings.impedanceMode,
  conductorMaterial: settings.conductorMaterial,
  lengthM: segment.lengthM,
  sectionMm2,
  baseVoltageV: settings.baseVoltageV,
  currentA,
  cosPhi: settings.cosPhi,
  conductorTempC: settings.conductorTempC,
  ...(settings.reactanceOhmPerKm === undefined ? {} : { reactanceOhmPerKm: settings.reactanceOhmPerKm }),
});
```

Apply terminal factor:

```ts
segmentDeltaVPercent = vd.value.deltaVPercent * settings.terminalLossFactor;
segmentDeltaVVolts = vd.value.deltaVVolts * settings.terminalLossFactor;
```

Cumulative percent is running sum from source to downstream.

- [x] **Step 7: Implement sensitivity optimization loop**

Loop constraints:

- Max iterations: `segments.length * standardSections.length`.
- Find the first or worst node where `cumulativeDeltaVPercent > limitPercent`. Prefer worst node by highest excess.
- Candidate segments are all segments with `order <= failingNode.order`.
- Candidate must have a next standard section.
- Calculate current and next segment VD percent, with terminal factor.
- Sensitivity:

```ts
const sensitivityIndex =
  (currentDeltaPercent - nextDeltaPercent) / ((nextSection - currentSection) * lengthM);
```

- Upgrade the candidate with highest `sensitivityIndex`.
- Recompute all segment outputs after every upgrade.
- If no candidate can be upgraded and still non-compliant, throw:

```text
No cable cross-section satisfies the voltage-drop limit for this segment group.
```

- [x] **Step 8: Return CalculationResult**

Return:

- `warnings: []`
- `assumptions`: one entry for every preset not explicitly provided in `settings`
- `formulaVariant: "voltage-drop-group-radial-v1"`
- `dataVersion: VOLTAGE_DROP_GROUP_DATA_VERSION`
- `engineVersion: ENGINE_VERSION`

- [x] **Step 9: Export public function**

`index.ts` must export:

```ts
export { calculateVoltageDropGroup } from "./algorithm.js";
export type { ... } from "./types.js";
```

- [x] **Step 10: Run calculation tests**

Run:

```bash
pnpm --filter @elektroplan/calculation-core test -- --run voltage-drop-group
pnpm --filter @elektroplan/calculation-core test
```

Expected: PASS.

---

## Task 4: Contracts

**Files:**
- Modify: `packages/contracts/src/schemas.ts`
- Modify: `packages/contracts/src/schema.test.ts`

- [x] **Step 1: Add failing contract tests**

Add tests for:

- Minimal request with two segments parses.
- Full advanced settings request parses.
- Record with `calculator: "voltage-drop-group"` parses.
- Existing `voltage-drop` record still parses.

- [x] **Step 2: Extend calculator kind**

Change:

```ts
export const calculatorKindSchema = z.enum([
  "motor",
  "voltage-drop",
  "voltage-drop-group",
  "cable",
  "protection",
]);
```

- [x] **Step 3: Add request schemas**

Add:

```ts
export const voltageDropGroupPhaseModeSchema = z.enum(["auto", "single-phase", "three-phase"]);
export const voltageDropGroupSystemTypeSchema = z.enum([
  "single-phase-ac-two-conductor",
  "three-phase-ac-ll",
]);

export const voltageDropGroupSegmentRequestSchema = z
  .object({
    id: z.string().min(1).optional(),
    title: z.string().min(1),
    localPowerKW: z.number(),
    lengthM: z.number(),
  })
  .strict();

export const voltageDropGroupSettingsRequestSchema = z
  .object({
    limitPercent: z.number().optional(),
    phaseMode: voltageDropGroupPhaseModeSchema.optional(),
    singlePhaseVoltageV: z.number().optional(),
    threePhaseVoltageV: z.number().optional(),
    cosPhi: z.number().optional(),
    efficiencyPercent: z.number().optional(),
    conductorMaterial: ampacityMaterialSchema.optional(),
    installationMethod: installationMethodSchema.optional(),
    insulationRating: insulationRatingSchema.optional(),
    ambientTemperatureC: z.number().optional(),
    groupedCircuits: z.number().optional(),
    thirdHarmonicPercent: z.number().optional(),
    conductorTempC: z.number().optional(),
    impedanceMode: voltageDropImpedanceModeSchema.optional(),
    reactanceOhmPerKm: z.number().optional(),
    terminalLossFactor: z.number().optional(),
  })
  .strict();

export const voltageDropGroupRequestSchema = z
  .object({
    title: z.string().min(1).optional(),
    segments: z.array(voltageDropGroupSegmentRequestSchema),
    settings: voltageDropGroupSettingsRequestSchema.optional(),
  })
  .strict();
```

- [x] **Step 4: Add response schemas**

Mirror the core output shape. Use `createCalculationResultSchema(voltageDropGroupOutputSchema)`.

- [x] **Step 5: Add record schema**

Add:

```ts
export const voltageDropGroupCalculationRecordSchema = recordBaseSchema.extend({
  calculator: z.literal("voltage-drop-group"),
  input: voltageDropGroupRequestSchema,
  output: voltageDropGroupResponseSchema,
});
```

Add it to `calculationRecordSchema`.

- [x] **Step 6: Export inferred types**

Export `VoltageDropGroupRequest`, `VoltageDropGroupOutput`, `VoltageDropGroupResponse`.

- [x] **Step 7: Run tests**

Run:

```bash
pnpm --filter @elektroplan/contracts test -- --run schema.test
pnpm --filter @elektroplan/contracts typecheck
```

Expected: PASS.

---

## Task 5: Electron Main, Preload, Bridge

**Files:**
- Modify: `apps/desktop/main/src/services/calculate-service.ts`
- Modify: `apps/desktop/main/src/ipc/channels.ts`
- Modify: `apps/desktop/main/src/ipc/register.ts`
- Modify: `apps/desktop/preload/src/index.ts`
- Modify: `apps/desktop/renderer/src/bridge/types.ts`

- [x] **Step 1: Add service method**

In `calculate-service.ts`, import:

```ts
calculateVoltageDropGroup,
type VoltageDropGroupInput,
type VoltageDropGroupResult,
```

Import `voltageDropGroupRequestSchema` and `VoltageDropGroupRequest` from contracts.

Add to `CalculateService`:

```ts
runVoltageDropGroup(request: unknown): VoltageDropGroupResult;
```

Implement:

```ts
runVoltageDropGroup(request: unknown): VoltageDropGroupResult {
  const parsed: VoltageDropGroupRequest = voltageDropGroupRequestSchema.parse(request);
  return calculateVoltageDropGroup(stripUndefined(parsed) as VoltageDropGroupInput);
}
```

- [x] **Step 2: Add IPC channel**

Add a channel constant for voltage drop group matching existing naming conventions.

- [x] **Step 3: Register IPC handler**

Wire the new channel to `calculateService.runVoltageDropGroup`.

- [x] **Step 4: Expose preload API**

Add:

```ts
voltageDropGroup(request: VoltageDropGroupRequest): Promise<VoltageDropGroupResponse>;
```

under `window.elektroPlan.calc`.

- [x] **Step 5: Extend renderer bridge local types**

In `bridge/types.ts`:

- Add all request/output interfaces.
- Extend `CalculatorKind`.
- Add `VoltageDropGroupCalculationRecord`.
- Add it to `CalculationRecord`.
- Add `calc.voltageDropGroup`.

- [x] **Step 6: Verify**

Run:

```bash
pnpm --filter @elektroplan/desktop-main typecheck
pnpm --filter @elektroplan/desktop-preload typecheck
pnpm --filter @elektroplan/desktop-renderer typecheck
```

Expected: PASS.

---

## Task 6: Renderer Voltage Drop Page

**Files:**
- Modify: `apps/desktop/renderer/src/features/voltageDrop/VoltageDropPage.tsx`
- Modify: `apps/desktop/renderer/src/features/voltageDrop/VoltageDropPage.module.css`

- [x] **Step 1: Replace page state with group state**

Use these state fields:

```ts
const [title, setTitle] = useState("A grubu");
const [segments, setSegments] = useState([
  { id: crypto.randomUUID(), title: "Segment 1", localPowerKW: null, lengthM: null },
]);
const [advancedOpen, setAdvancedOpen] = useState(false);
const [settings, setSettings] = useState({
  limitPercent: 3,
  phaseMode: "auto",
  singlePhaseVoltageV: 230,
  threePhaseVoltageV: 400,
  cosPhi: 0.8,
  efficiencyPercent: 100,
  conductorMaterial: "copper",
  installationMethod: "C",
  ambientTemperatureC: 30,
  groupedCircuits: 1,
  thirdHarmonicPercent: 0,
  conductorTempC: 70,
  impedanceMode: "simplified",
  reactanceOhmPerKm: null,
  terminalLossFactor: 1.015,
});
```

- [x] **Step 2: Build request helper**

Create `buildVoltageDropGroupSubmission()` that:

- Rejects empty title.
- Requires at least one segment.
- Requires each segment `localPowerKW > 0` and `lengthM > 0`.
- Converts nullable UI values to omitted settings when the user clears advanced fields.
- Returns `VoltageDropGroupRequest | null`.

- [x] **Step 3: Implement left panel**

Left panel must contain:

- Group name.
- Segment rows with title, kW, length.
- Add segment button.
- Delete segment button disabled when only one segment remains.
- Advanced settings toggle.

- [x] **Step 4: Implement advanced panel**

Fields:

- Limit %
- Phase mode
- Single phase voltage
- Three phase voltage
- cosPhi
- Efficiency %
- Conductor material
- Installation method
- Ambient temperature
- Grouped circuits
- Third harmonic %
- Conductor temperature
- Impedance mode
- Reactance only when exact AC
- Terminal loss factor

- [x] **Step 5: Implement calculate action**

Call:

```ts
const res = await getBridge().calc.voltageDropGroup(submission);
```

Set `result` and `lastRequest`.

- [x] **Step 6: Implement right result panel**

Before result:

- Show compact empty state text inside the right panel: `Segmentleri girip hesaplayın.`

After result:

- Summary:
  - system type
  - total local kW
  - limit %
  - max cumulative VD %
  - compliant state
- Segment table:
  - order
  - title
  - local kW
  - flow kW
  - length
  - current A
  - selected section mm2
  - corrected ampacity A
  - segment VD %
  - cumulative VD %
  - status

- [x] **Step 7: Save record**

Create record:

```ts
{
  id: crypto.randomUUID(),
  calculator: "voltage-drop-group",
  title: result.value.title ?? title,
  version: {
    contractVersion: "1",
    engineVersion: result.engineVersion,
    dataVersion: result.dataVersion,
  },
  input: lastRequest,
  output: result,
}
```

Use existing `SaveDialog`.

- [x] **Step 8: Responsive CSS**

CSS requirements:

- Desktop: two columns, left input panel and right result group.
- Mobile: single column.
- Segment rows must not overflow.
- Result table must horizontally scroll in its own container if narrow.
- Do not nest decorative cards inside cards.

- [x] **Step 9: Verify renderer**

Run:

```bash
pnpm --filter @elektroplan/desktop-renderer typecheck
```

Expected: PASS.

---

## Task 7: Projects Integration

**Files:**
- Modify: `apps/desktop/renderer/src/features/projects/useProjectsData.ts`
- Modify: `apps/desktop/renderer/src/features/projects/RecordDetail.tsx`
- Modify if needed: `apps/desktop/renderer/src/features/projects/ProjectsPage.tsx`

- [x] **Step 1: Add calculator label**

In `CALCULATOR_LABELS`:

```ts
"voltage-drop-group": "Gerilim düşümü grubu",
```

- [x] **Step 2: Keep group current totals motor-only**

Do not add voltage-drop-group records to `getRecordUnitCurrentA`. They are design calculations, not motor loads in project current totals.

- [x] **Step 3: Add display title support**

`getRecordDisplayTitle` already prefers `record.title`; verify no special change is needed.

- [x] **Step 4: Add record detail rows**

In `RecordDetail.tsx`, add branch:

```tsx
{record.calculator === "voltage-drop-group" ? <VoltageDropGroupRows record={record} /> : null}
```

Display:

- Total power.
- System type.
- Limit.
- Max cumulative VD.
- Compliance.
- Segment table.

- [x] **Step 5: Add record card metadata if needed**

If `ProjectsPage.tsx` has calculator-specific metadata, show:

- Segment count.
- Max cumulative VD.

- [x] **Step 6: Verify**

Run:

```bash
pnpm --filter @elektroplan/desktop-renderer typecheck
```

Expected: PASS.

---

## Task 8: Export Compatibility

**Files:**
- Modify only if compile/test fails:
  - `packages/exporters/src/shared.ts`
  - `packages/exporters/src/json.ts`
  - `packages/exporters/src/excel.ts`
  - `packages/exporters/src/pdf.ts`

- [x] **Step 1: Build exporters**

Run:

```bash
pnpm --filter @elektroplan/exporters build
```

- [x] **Step 2: Fix union handling if needed**

If exhaustive switches fail, add `voltage-drop-group` handling.

Minimum acceptable behavior:

- JSON export includes the record unchanged.
- Excel/PDF do not crash.
- Specialized layout is optional for this feature.

- [x] **Step 3: Verify**

Run:

```bash
pnpm --filter @elektroplan/exporters test
pnpm --filter @elektroplan/exporters build
```

Expected: PASS.

---

## Task 9: E2E Coverage

**Files:**
- Modify: `tests/e2e/src/voltageDrop.spec.ts`
- Modify if helper selectors are needed: `tests/e2e/src/fixtures.ts`

- [x] **Step 1: Replace old voltage drop assumptions tests**

The page is no longer a blank manual single-line calculator. Update tests to the new segment UI.

- [x] **Step 2: Add happy path test**

Test flow:

1. Navigate to `/#/voltage-drop`.
2. Enter group title `A grubu`.
3. Segment 1: title `Segment 1`, kW `1`, m `20`.
4. Add segment.
5. Segment 2: title `Segment 2`, kW `3`, m `30`.
6. Calculate.
7. Assert `Gerilim düşümü grubu sonucu` or equivalent result title is visible.
8. Assert `Segment 1`, `Segment 2`, selected section, max cumulative VD are visible.
9. Assert compliant state is visible.

- [x] **Step 3: Add save-to-project test**

Continue from happy path:

1. Click save.
2. Create/select project.
3. Create/select group.
4. Save.
5. Navigate to projects.
6. Assert record badge `Gerilim düşümü grubu`.
7. Open record detail.
8. Assert segment table appears.

- [ ] **Step 4: Run E2E**

Run:

```bash
pnpm --filter @elektroplan/e2e test -- voltageDrop.spec.ts
```

Expected: PASS.

---

## Task 10: Full Verification

- [x] **Step 1: Run package tests**

```bash
pnpm --filter @elektroplan/calculation-core test
pnpm --filter @elektroplan/contracts test
pnpm --filter @elektroplan/desktop-main test
```

- [ ] **Step 2: Run workspace checks**

```bash
pnpm -w typecheck
pnpm -w lint
pnpm -w test
```

> Note: workspace-wide `turbo` checks could not be completed from this environment because the package-manager binary could not be resolved when invoked through `npm.cmd`. Package-level checks for the touched packages passed.

- [ ] **Step 3: Run E2E when desktop environment is available**

```bash
pnpm --filter @elektroplan/e2e test
```

- [ ] **Step 4: Manual acceptance**

Manual check in app:

- Gerilim Düşümü page opens as segment-first.
- User creates `A grubu`.
- User enters `Segment 1`, `1 kW`, `20 m`.
- User adds `Segment 2`, `3 kW`, `30 m`.
- Calculate returns per-segment and cumulative results.
- Each segment shows selected cable section and compliance.
- Result saves to project.
- Projects page shows `Gerilim düşümü grubu`.
- Old motor, cable, protection and existing `voltage-drop` records still open.

---

## Implementation Notes

- Keep `voltage-drop` as a valid old calculator kind. Do not migrate old records.
- Do not compute this feature in the renderer. Renderer only builds request and displays response.
- Do not use existing `calculateCableSizing` for the group algorithm because it currently rejects single phase.
- Keep the optimization deterministic. If two sensitivity indexes tie, choose the lower segment order first.
- Keep all calculations in core covered by tests before UI wiring.
- Do not introduce database migrations unless storage rejects the new `calculator` enum. Current storage uses JSON contracts, so schema-level changes should be enough.
