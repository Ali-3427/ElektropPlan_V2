# Cable Cross-Section Ruler + Motor Cable Suggestion Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a "Cetvel" (ruler) mode to the Cable calculator that returns cable cross-section (mm²) from an ampacity lookup table, make it the default mode, and surface a suggested cross-section in the Motor Formula result.

**Architecture:**
1. Import `Plan/kablo kesiti değerleri.json` as a locked dataset into `@elektroplan/calculation-data` with metadata + row validation (same pattern as `standard-motors.json`).
2. Add a pure `selectCableSectionFromRuler(currentA, column)` function in `@elektroplan/calculation-core` that returns the first row whose ampacity >= designCurrent.
3. Extend contracts with a new `cableRulerRequest` / `cableRulerResponse` and add an optional `suggestedSectionMm2` field to the motor formula output.
4. Wire through IPC (`calc:cable-ruler` + `data:cable-ruler-table`) and preload.
5. Replace Cable page with a two-tab layout (default "Cetvel", secondary "Detaylı"); add suggested-section row to Motor FormulaMode result panel.

**Tech Stack:** TypeScript (strict), Zod contracts, Vitest, React + Vite renderer, Electron IPC, pnpm+turbo monorepo.

---

## Pre-flight

### Task 0: Baseline verification

**Step 1:** Confirm monorepo builds and tests pass before touching anything.

Run: `pnpm -w install`
Run: `pnpm -w -r build`
Run: `pnpm -w -r test`

Expected: all green. If red, stop and surface failures — do not proceed.

---

## Phase 1: Dataset

### Task 1: Lock cable ruler JSON into calculation-data

**Files:**
- Create: `packages/calculation-data/src/iec/cable-ruler/standard-cable-ruler.json`
- Create: `packages/calculation-data/src/iec/cable-ruler/types.ts`
- Create: `packages/calculation-data/src/iec/cable-ruler/dataset.ts`
- Create: `packages/calculation-data/src/iec/cable-ruler/accessors.ts`
- Create: `packages/calculation-data/src/iec/cable-ruler/index.ts`
- Modify: `packages/calculation-data/src/iec/index.ts` (add `export * from "./cable-ruler/index.js";`)
- Reference source: `Plan/kablo kesiti değerleri.json`

**Step 1: Create JSON dataset with metadata wrapper**

Copy entries from `Plan/kablo kesiti değerleri.json` into a wrapped structure:

```json
{
  "metadata": {
    "id": "cable-ruler-standard-v1",
    "standard": "ElektroPlan Cable Ruler (nominal section vs. ampacity)",
    "revision": "v1",
    "source": "Plan/kablo kesiti değerleri.json",
    "validFrom": "2026-04-21",
    "notes": "18 rows. null ampacity preserved. Do NOT interpolate. '*' suffix in nominal_kesit_mm2 marks sub-1.5 mm² sections reserved for control."
  },
  "columns": [
    "nominal_kesit_mm2",
    "dis_cap_mm",
    "net_agirlik_kg_km",
    "sevk_uzunlugu_m",
    "dc_direnc_ohm_km_20C",
    "akim_toprak_20C_A",
    "akim_hava_30C_A"
  ],
  "entries": [ ... all 18 rows verbatim ... ]
}
```

**Step 2: Define types**

```ts
// types.ts
import type { DatasetWithMetadata } from "../../dataset/types.js";

export type CableRulerAmbient = "toprak_20C" | "hava_30C";

export interface CableRulerEntry {
  /** Nominal kesit label (e.g. "0,5*", "1,5", "240"). Sub-1.5 mm² rows are suffixed "*" for control use. */
  nominal_kesit_mm2: string;
  /** Parsed numeric value of nominal_kesit_mm2 with the "*" stripped and "," → "." */
  sectionMm2: number;
  dis_cap_mm: number;
  net_agirlik_kg_km: number;
  sevk_uzunlugu_m: number;
  dc_direnc_ohm_km_20C: number;
  akim_toprak_20C_A: number | null;
  akim_hava_30C_A: number | null;
}

export const CABLE_RULER_COLUMNS = [
  "nominal_kesit_mm2",
  "dis_cap_mm",
  "net_agirlik_kg_km",
  "sevk_uzunlugu_m",
  "dc_direnc_ohm_km_20C",
  "akim_toprak_20C_A",
  "akim_hava_30C_A",
] as const;

export type CableRulerColumn = (typeof CABLE_RULER_COLUMNS)[number];

export interface CableRulerDataset extends DatasetWithMetadata {
  columns: readonly CableRulerColumn[];
  entries: readonly CableRulerEntry[];
}
```

**Step 3: Write failing dataset test**

Create `packages/calculation-data/src/iec/cable-ruler/index.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { cableRulerDataset, getCableRulerEntries } from "./index.js";

describe("cable ruler dataset", () => {
  it("exposes metadata id 'cable-ruler-standard-v1'", () => {
    expect(cableRulerDataset.metadata.id).toBe("cable-ruler-standard-v1");
  });

  it("loads exactly 18 entries", () => {
    expect(getCableRulerEntries()).toHaveLength(18);
  });

  it("parses '1,5' label into numeric sectionMm2 1.5", () => {
    const row = getCableRulerEntries().find((e) => e.nominal_kesit_mm2 === "1,5");
    expect(row?.sectionMm2).toBe(1.5);
  });

  it("parses '0,5*' label into numeric sectionMm2 0.5", () => {
    const row = getCableRulerEntries().find((e) => e.nominal_kesit_mm2 === "0,5*");
    expect(row?.sectionMm2).toBe(0.5);
  });

  it("preserves null for missing toprak ampacity at '0,5*'", () => {
    const row = getCableRulerEntries().find((e) => e.nominal_kesit_mm2 === "0,5*");
    expect(row?.akim_toprak_20C_A).toBeNull();
  });
});
```

Run: `pnpm -C packages/calculation-data exec vitest run src/iec/cable-ruler`
Expected: FAIL (modules do not exist yet).

**Step 4: Implement dataset loader with strict validation**

`dataset.ts`:

```ts
import rulerJson from "./standard-cable-ruler.json" with { type: "json" };

import { loadJsonDataset } from "../../dataset/load-json-dataset.js";
import {
  CABLE_RULER_COLUMNS,
  type CableRulerDataset,
  type CableRulerEntry,
} from "./types.js";

const CABLE_RULER_DATASET_PATH =
  "packages/calculation-data/src/iec/cable-ruler/standard-cable-ruler.json";
const CABLE_RULER_EXPECTED_ROW_COUNT = 18;

function parseSectionLabel(label: string): number {
  const cleaned = label.replace("*", "").replace(",", ".").trim();
  const parsed = Number(cleaned);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error(`Invalid cable ruler section label: '${label}'.`);
  }
  return parsed;
}

function assertEntry(raw: unknown, index: number): asserts raw is Omit<CableRulerEntry, "sectionMm2"> {
  if (typeof raw !== "object" || raw === null) {
    throw new Error(`Cable ruler entry ${index} must be an object.`);
  }
  const c = raw as Record<string, unknown>;
  if (typeof c.nominal_kesit_mm2 !== "string") {
    throw new Error(`Cable ruler entry ${index} has invalid 'nominal_kesit_mm2'.`);
  }
  for (const f of ["dis_cap_mm", "net_agirlik_kg_km", "sevk_uzunlugu_m", "dc_direnc_ohm_km_20C", "akim_hava_30C_A"] as const) {
    if (typeof c[f] !== "number") {
      throw new Error(`Cable ruler entry ${index} has invalid '${f}'.`);
    }
  }
  if (c.akim_toprak_20C_A !== null && typeof c.akim_toprak_20C_A !== "number") {
    throw new Error(`Cable ruler entry ${index} has invalid 'akim_toprak_20C_A'.`);
  }
}

function buildEntries(rawEntries: readonly unknown[]): readonly CableRulerEntry[] {
  return rawEntries.map((raw, index) => {
    assertEntry(raw, index);
    return { ...raw, sectionMm2: parseSectionLabel(raw.nominal_kesit_mm2) };
  });
}

function assertDataset(dataset: CableRulerDataset): CableRulerDataset {
  if (!Array.isArray(dataset.columns)
    || dataset.columns.length !== CABLE_RULER_COLUMNS.length
    || dataset.columns.some((c, i) => c !== CABLE_RULER_COLUMNS[i])) {
    throw new Error(`Cable ruler columns do not match the locked plan in ${CABLE_RULER_DATASET_PATH}.`);
  }
  if (!Array.isArray(dataset.entries) || dataset.entries.length !== CABLE_RULER_EXPECTED_ROW_COUNT) {
    throw new Error(`Cable ruler row count must be ${CABLE_RULER_EXPECTED_ROW_COUNT} in ${CABLE_RULER_DATASET_PATH}.`);
  }
  return dataset;
}

const rawLoaded = loadJsonDataset(rulerJson as Omit<CableRulerDataset, "entries"> & { entries: readonly unknown[] }, CABLE_RULER_DATASET_PATH);

export const cableRulerDataset: CableRulerDataset = Object.freeze({
  metadata: rawLoaded.metadata,
  columns: rawLoaded.columns as readonly typeof CABLE_RULER_COLUMNS[number][],
  entries: Object.freeze(buildEntries(rawLoaded.entries)),
});
assertDataset(cableRulerDataset);
```

`accessors.ts`:

```ts
import { cableRulerDataset } from "./dataset.js";
import type { CableRulerAmbient, CableRulerEntry } from "./types.js";

export function getCableRulerEntries(): readonly CableRulerEntry[] {
  return cableRulerDataset.entries;
}

export function getCableRulerDataVersion(): string {
  return `${cableRulerDataset.metadata.id}:${cableRulerDataset.metadata.revision}`;
}

export function getAmpacityForAmbient(
  entry: CableRulerEntry,
  ambient: CableRulerAmbient,
): number | null {
  return ambient === "toprak_20C" ? entry.akim_toprak_20C_A : entry.akim_hava_30C_A;
}
```

`index.ts`:

```ts
export {
  getCableRulerEntries,
  getCableRulerDataVersion,
  getAmpacityForAmbient,
} from "./accessors.js";
export { cableRulerDataset } from "./dataset.js";
export type {
  CableRulerAmbient,
  CableRulerColumn,
  CableRulerDataset,
  CableRulerEntry,
} from "./types.js";
export { CABLE_RULER_COLUMNS } from "./types.js";
```

**Step 5: Add barrel export**

Edit `packages/calculation-data/src/iec/index.ts` — append:

```ts
export * from "./cable-ruler/index.js";
```

**Step 6: Run the test and confirm it passes**

Run: `pnpm -C packages/calculation-data exec vitest run src/iec/cable-ruler`
Expected: PASS (5 tests).

**Step 7: Run full build + existing IEC dataset verifier**

Run: `pnpm -C packages/calculation-data build`
Run: `node packages/calculation-data/tests/run-iec-datasets.mjs`
Expected: no errors; verifier still lists existing datasets. If the verifier enumerates datasets, extend it to include the ruler — inspect it first, follow the existing pattern.

**Step 8: Commit**

```bash
git add packages/calculation-data/src/iec/cable-ruler packages/calculation-data/src/iec/index.ts
git commit -m "feat(data): lock cable ruler dataset (kablo kesiti değerleri)"
```

---

## Phase 2: Calculation core selector

### Task 2: Pure cable section selector

**Files:**
- Create: `packages/calculation-core/src/cable/ruler.ts`
- Create: `packages/calculation-core/src/cable/ruler.test.ts`
- Modify: `packages/calculation-core/src/cable/index.ts` (re-export)
- Modify: `packages/calculation-core/src/index.ts` (re-export)

**Step 1: Write failing tests**

`ruler.ts` should expose a pure function that picks the smallest standard section whose ampacity for the chosen ambient column is >= design current, skipping rows where that column is `null`.

```ts
// ruler.test.ts
import { describe, expect, it } from "vitest";
import { selectCableSectionFromRuler } from "./ruler.js";

describe("selectCableSectionFromRuler", () => {
  it("returns the smallest section where akim_hava_30C_A >= 20 A", () => {
    const res = selectCableSectionFromRuler({ designCurrentA: 20, ambient: "hava_30C" });
    expect(res.selected.nominal_kesit_mm2).toBe("1*");
    expect(res.selected.sectionMm2).toBe(1);
    expect(res.selectedAmpacityA).toBe(20);
  });

  it("picks 1,5 mm² for 24 A in hava", () => {
    const res = selectCableSectionFromRuler({ designCurrentA: 24, ambient: "hava_30C" });
    expect(res.selected.sectionMm2).toBe(1.5);
  });

  it("picks 2,5 mm² for 21 A in hava (next step up past 20)", () => {
    const res = selectCableSectionFromRuler({ designCurrentA: 21, ambient: "hava_30C" });
    expect(res.selected.sectionMm2).toBe(2.5);
  });

  it("skips rows with null toprak ampacity and picks the first numeric hit", () => {
    const res = selectCableSectionFromRuler({ designCurrentA: 10, ambient: "toprak_20C" });
    expect(res.selected.sectionMm2).toBe(1);
    expect(res.selectedAmpacityA).toBe(11);
  });

  it("throws when no row satisfies the current (toprak capped at 235 A)", () => {
    expect(() => selectCableSectionFromRuler({ designCurrentA: 500, ambient: "toprak_20C" }))
      .toThrow(/no cable ruler row/i);
  });

  it("rejects non-positive current", () => {
    expect(() => selectCableSectionFromRuler({ designCurrentA: 0, ambient: "hava_30C" }))
      .toThrow(/positive/i);
  });
});
```

Run: `pnpm -C packages/calculation-core exec vitest run src/cable/ruler`
Expected: FAIL (module missing).

**Step 2: Implement**

```ts
// ruler.ts
import {
  getAmpacityForAmbient,
  getCableRulerDataVersion,
  getCableRulerEntries,
  type CableRulerEntry,
} from "@elektroplan/calculation-data";

export type CableRulerAmbient = "toprak_20C" | "hava_30C";

export interface CableRulerSelectionInput {
  designCurrentA: number;
  ambient: CableRulerAmbient;
}

export interface CableRulerSelection {
  selected: CableRulerEntry;
  selectedAmpacityA: number;
  dataVersion: string;
}

export function selectCableSectionFromRuler(
  input: CableRulerSelectionInput,
): CableRulerSelection {
  if (!Number.isFinite(input.designCurrentA) || input.designCurrentA <= 0) {
    throw new RangeError("designCurrentA must be a positive finite number.");
  }

  const entries = getCableRulerEntries();
  const sorted = [...entries].sort((a, b) => a.sectionMm2 - b.sectionMm2);

  for (const entry of sorted) {
    const ampacity = getAmpacityForAmbient(entry, input.ambient);
    if (ampacity !== null && ampacity >= input.designCurrentA) {
      return {
        selected: entry,
        selectedAmpacityA: ampacity,
        dataVersion: getCableRulerDataVersion(),
      };
    }
  }

  throw new RangeError(
    `No cable ruler row supports ${input.designCurrentA} A at ambient '${input.ambient}'.`,
  );
}
```

**Step 3: Re-export**

Append to `packages/calculation-core/src/cable/index.ts`:
```ts
export { selectCableSectionFromRuler } from "./ruler.js";
export type {
  CableRulerAmbient,
  CableRulerSelection,
  CableRulerSelectionInput,
} from "./ruler.js";
```

Append to `packages/calculation-core/src/index.ts` the same two exports (mirrors existing cable re-exports near line 22–39).

**Step 4: Run tests**

Run: `pnpm -C packages/calculation-core exec vitest run src/cable/ruler`
Expected: PASS (6 tests).

Run: `pnpm -C packages/calculation-core exec vitest run`
Expected: existing suite still green.

**Step 5: Commit**

```bash
git add packages/calculation-core/src/cable/ruler.ts packages/calculation-core/src/cable/ruler.test.ts packages/calculation-core/src/cable/index.ts packages/calculation-core/src/index.ts
git commit -m "feat(core): add cable ruler section selector"
```

---

## Phase 3: Contracts

### Task 3: Add cable-ruler schemas + motor suggestion field

**Files:**
- Modify: `packages/contracts/src/schemas.ts`
- Modify: `packages/contracts/src/schema.test.ts`
- Modify: `packages/contracts/src/index.ts` (if new types need to be exported — check it first)

**Step 1: Inspect existing exports**

Run: `sed -n '1,40p' packages/contracts/src/index.ts`
(Use Read, not sed — this is illustrative.) Note what is re-exported so the new types land in the barrel alongside `MotorRequest`.

**Step 2: Write failing schema tests**

Append to `schema.test.ts`:

```ts
describe("cable ruler schemas", () => {
  it("accepts a valid cable-ruler request", () => {
    expect(() =>
      cableRulerRequestSchema.parse({ designCurrentA: 24, ambient: "hava_30C" }),
    ).not.toThrow();
  });

  it("rejects unknown ambient", () => {
    expect(() =>
      cableRulerRequestSchema.parse({ designCurrentA: 24, ambient: "havasız" }),
    ).toThrow();
  });

  it("accepts response with null toprak ampacity at sub-1.5 rows", () => {
    expect(() =>
      cableRulerResponseSchema.parse({
        value: {
          mode: "ruler",
          designCurrentA: 20,
          ambient: "hava_30C",
          selected: {
            nominal_kesit_mm2: "1*",
            sectionMm2: 1,
            dis_cap_mm: 2.5,
            net_agirlik_kg_km: 14,
            sevk_uzunlugu_m: 100,
            dc_direnc_ohm_km_20C: 19.5,
            akim_toprak_20C_A: 11,
            akim_hava_30C_A: 20,
          },
          selectedAmpacityA: 20,
        },
        warnings: [],
        assumptions: [],
        engineVersion: "test",
        dataVersion: "test",
      }),
    ).not.toThrow();
  });
});

describe("motor formula output w/ suggested cable section", () => {
  it("accepts an optional suggestedCableSection block", () => {
    expect(() =>
      motorFormulaOutputSchema.parse({
        mode: "formula",
        phase: 3,
        voltage: 380,
        cosPhi: 0.85,
        efficiencyPercent: 85,
        P_out: 7.5,
        inputPowerKW: 8.82,
        apparentPowerKVA: 10.38,
        currentA: 15.8,
        suggestedCableSection: {
          sectionMm2: 1.5,
          label: "1,5",
          ambient: "hava_30C",
          ampacityA: 24,
        },
      }),
    ).not.toThrow();
  });

  it("still accepts a motor formula output without the suggestion (backward compat)", () => {
    expect(() =>
      motorFormulaOutputSchema.parse({
        mode: "formula", phase: 1, voltage: 220, cosPhi: 0.8,
        efficiencyPercent: 80, P_out: 1, inputPowerKW: 1.25,
        apparentPowerKVA: 1.56, currentA: 7.1,
      }),
    ).not.toThrow();
  });
});
```

Ensure these symbols are imported at the top of `schema.test.ts`: `cableRulerRequestSchema`, `cableRulerResponseSchema`, `motorFormulaOutputSchema`.

Run: `pnpm -C packages/contracts exec vitest run`
Expected: new tests FAIL (schemas not yet defined).

**Step 3: Add schemas**

Insert the following into `schemas.ts` near the other cable schemas (after `cableResponseSchema` at line 259):

```ts
export const cableRulerAmbientSchema = z.enum(["toprak_20C", "hava_30C"]);

export const cableRulerRequestSchema = z
  .object({
    designCurrentA: z.number().positive(),
    ambient: cableRulerAmbientSchema,
  })
  .strict();

export const cableRulerEntrySchema = z
  .object({
    nominal_kesit_mm2: z.string(),
    sectionMm2: z.number().positive(),
    dis_cap_mm: z.number(),
    net_agirlik_kg_km: z.number(),
    sevk_uzunlugu_m: z.number(),
    dc_direnc_ohm_km_20C: z.number(),
    akim_toprak_20C_A: z.number().nullable(),
    akim_hava_30C_A: z.number().nullable(),
  })
  .strict();

export const cableRulerOutputSchema = z
  .object({
    mode: z.literal("ruler"),
    designCurrentA: z.number().positive(),
    ambient: cableRulerAmbientSchema,
    selected: cableRulerEntrySchema,
    selectedAmpacityA: z.number().positive(),
  })
  .strict();

export const cableRulerResponseSchema = createCalculationResultSchema(cableRulerOutputSchema);

export type CableRulerAmbient = z.infer<typeof cableRulerAmbientSchema>;
export type CableRulerRequest = z.infer<typeof cableRulerRequestSchema>;
export type CableRulerEntryDto = z.infer<typeof cableRulerEntrySchema>;
export type CableRulerOutput = z.infer<typeof cableRulerOutputSchema>;
export type CableRulerResponse = z.infer<typeof cableRulerResponseSchema>;
```

Patch `motorFormulaOutputSchema` (line 80–93) to add an optional suggestion:

```ts
export const motorSuggestedCableSectionSchema = z
  .object({
    sectionMm2: z.number().positive(),
    label: z.string(),
    ambient: cableRulerAmbientSchema,
    ampacityA: z.number().positive(),
  })
  .strict();

export const motorFormulaOutputSchema = z
  .object({
    mode: z.literal("formula"),
    phase: motorPhaseSchema,
    voltage: z.number(),
    cosPhi: z.number(),
    efficiencyPercent: z.number(),
    P_out: z.number(),
    inputPowerKW: z.number(),
    apparentPowerKVA: z.number(),
    currentA: z.number(),
    voltageMode: motorVoltageModeSchema.optional(),
    suggestedCableSection: motorSuggestedCableSectionSchema.optional(),
  })
  .strict();
```

Note: `cableRulerAmbientSchema` is referenced by both the motor suggestion and the ruler request — define it once, above the motor schema, so ordering compiles. Move the ambient enum declaration above line 80.

Also export `MotorSuggestedCableSection` type:

```ts
export type MotorSuggestedCableSection = z.infer<typeof motorSuggestedCableSectionSchema>;
```

**Step 4: Ensure barrel export**

Open `packages/contracts/src/index.ts`. If it does `export * from "./schemas.js";` you are done. If it re-exports individually, add the new symbols.

**Step 5: Run contracts tests**

Run: `pnpm -C packages/contracts exec vitest run`
Expected: PASS including new tests.

Run: `pnpm -C packages/contracts build`
Expected: no TS errors.

**Step 6: Commit**

```bash
git add packages/contracts/src/schemas.ts packages/contracts/src/schema.test.ts packages/contracts/src/index.ts
git commit -m "feat(contracts): add cable ruler schemas and motor suggested cable section"
```

---

## Phase 4: Motor integration (suggested section)

### Task 4: Compute suggestion after motor formula

**Files:**
- Modify: `packages/calculation-core/src/motor/formulas.ts` (only if needed — check first)
- Modify: `packages/calculation-core/src/motor/index.ts`
- Modify: `packages/calculation-core/src/motor/index.test.ts` (add suggestion test)

**Design note:** Suggestion default = `ambient: "hava_30C"`. If no ruler row satisfies the current (e.g. >528 A), the suggestion is simply omitted; do not throw. This matches the "optional" contract.

**Step 1: Failing test**

Append to `packages/calculation-core/src/motor/index.test.ts`:

```ts
describe("calculateMotorCurrent formula suggestion", () => {
  it("suggests '1,5' mm² (24 A hava) for a ~16 A 3-phase motor", () => {
    const res = calculateMotorCurrent({
      mode: "formula", phase: 3, P_out: 7.5, voltage: 380,
      cosPhi: 0.85, efficiencyPercent: 85, voltageMode: "LL",
    });
    expect(res.value.mode).toBe("formula");
    if (res.value.mode === "formula") {
      expect(res.value.suggestedCableSection?.sectionMm2).toBe(1.5);
      expect(res.value.suggestedCableSection?.ambient).toBe("hava_30C");
    }
  });

  it("omits suggestion for an overflow (fabricated >528 A) case via a direct selector test", () => {
    // just document behaviour — use selectCableSectionFromRuler directly for the boundary
    expect(() => selectCableSectionFromRuler({ designCurrentA: 600, ambient: "hava_30C" })).toThrow();
  });
});
```

Run: `pnpm -C packages/calculation-core exec vitest run src/motor`
Expected: FAIL.

**Step 2: Wire the suggestion into `calculateMotorCurrent` (formula branch only)**

Edit `packages/calculation-core/src/motor/index.ts`. After `calculateMotorFormula(...)` returns `result`, synthesise the suggestion:

```ts
import { selectCableSectionFromRuler } from "../cable/ruler.js";

// …inside calculateMotorCurrent, formula branch, after computing `result`:
let suggestedCableSection: FormulaModeOutput["suggestedCableSection"];
try {
  const selection = selectCableSectionFromRuler({
    designCurrentA: result.value.currentA,
    ambient: "hava_30C",
  });
  suggestedCableSection = {
    sectionMm2: selection.selected.sectionMm2,
    label: selection.selected.nominal_kesit_mm2,
    ambient: "hava_30C",
    ampacityA: selection.selectedAmpacityA,
  };
} catch {
  suggestedCableSection = undefined;
}

return {
  ...result,
  value: { ...result.value, ...(suggestedCableSection ? { suggestedCableSection } : {}) },
  warnings: [],
  assumptions: [],
  dataVersion: FORMULA_MODE_DATA_VERSION,
  engineVersion: ENGINE_VERSION,
};
```

**Step 3: Extend internal type `FormulaModeOutput`**

In `packages/calculation-core/src/motor/types.ts` add an optional field:

```ts
suggestedCableSection?: {
  sectionMm2: number;
  label: string;
  ambient: "hava_30C" | "toprak_20C";
  ampacityA: number;
};
```

**Step 4: Re-run tests**

Run: `pnpm -C packages/calculation-core exec vitest run`
Expected: all green including the two new motor tests.

**Step 5: Commit**

```bash
git add packages/calculation-core/src/motor/index.ts packages/calculation-core/src/motor/types.ts packages/calculation-core/src/motor/index.test.ts
git commit -m "feat(core): suggest cable section in motor formula result"
```

---

## Phase 5: Desktop IPC wiring

### Task 5: Service + channels + preload for cable ruler

**Files:**
- Modify: `apps/desktop/main/src/services/calculate-service.ts`
- Modify: `apps/desktop/main/src/ipc/channels.ts`
- Modify: `apps/desktop/main/src/ipc/register.ts`
- Modify: `apps/desktop/preload/src/index.ts`
- Modify: `apps/desktop/renderer/src/bridge/types.ts`
- Modify: `apps/desktop/renderer/src/query/keys.ts`

**Step 1: Add channel ids**

In `channels.ts` add:
```ts
CalcCableRuler: "calc:cable-ruler",
DataCableRulerTable: "data:cable-ruler-table",
```

Mirror the same two entries in `preload/src/index.ts` `CHANNELS` object.

**Step 2: Service methods**

In `calculate-service.ts`:

```ts
import {
  calculateCableSizing,
  calculateMotorCurrent,
  calculateVoltageDrop,
  recommendProtectionDevices,
  selectCableSectionFromRuler,
} from "@elektroplan/calculation-core";
import {
  // …existing imports…
  getCableRulerEntries,
  getCableRulerDataVersion,
  type CableRulerEntry,
} from "@elektroplan/calculation-data";
import {
  // …existing…
  cableRulerRequestSchema,
  type CableRulerRequest,
  type CableRulerResponse,
} from "@elektroplan/contracts";
import { ENGINE_VERSION } from "@elektroplan/calculation-core";
```

Add to the interface and impl:

```ts
runCableRuler(request: unknown): CableRulerResponse;
listCableRulerEntries(): readonly CableRulerEntry[];
```

```ts
runCableRuler(request: unknown): CableRulerResponse {
  const parsed: CableRulerRequest = cableRulerRequestSchema.parse(request);
  const selection = selectCableSectionFromRuler(parsed);
  return {
    value: {
      mode: "ruler",
      designCurrentA: parsed.designCurrentA,
      ambient: parsed.ambient,
      selected: selection.selected,
      selectedAmpacityA: selection.selectedAmpacityA,
    },
    warnings: [],
    assumptions: [],
    engineVersion: ENGINE_VERSION,
    dataVersion: selection.dataVersion,
  };
},
listCableRulerEntries(): readonly CableRulerEntry[] {
  return getCableRulerEntries();
},
```

**Step 3: Register handlers**

In `register.ts`, add handlers near the existing `CalcCable` and `DataMotorTable` registrations:

```ts
ipcMain.handle(
  IPC_CHANNELS.CalcCableRuler,
  wrap((_event, payload) => services.calculate.runCableRuler(payload)),
);
ipcMain.handle(
  IPC_CHANNELS.DataCableRulerTable,
  wrap(() => services.calculate.listCableRulerEntries()),
);
```

**Step 4: Preload bridge**

In `apps/desktop/preload/src/index.ts`:

- Add to `calc` group: `cableRuler(request: CableRulerRequest): Promise<CableRulerResponse>;`
- Add to `data` group: `cableRulerTable(): Promise<readonly unknown[]>;`
- Wire impls: `cableRuler: (req) => invoke(CHANNELS.CalcCableRuler, req)` and `cableRulerTable: () => invoke(CHANNELS.DataCableRulerTable)`
- Add `CableRulerRequest`, `CableRulerResponse` to the imports from `@elektroplan/contracts`.

**Step 5: Renderer bridge types**

Edit `apps/desktop/renderer/src/bridge/types.ts`:

- Add imports (or extend local mirror) for `CableRulerRequest`, `CableRulerResponse`, `CableRulerEntryDto`, `CableRulerAmbient`.
- Extend `ElektroPlanBridge.calc` with `cableRuler(request: CableRulerRequest): Promise<CableRulerResponse>;`.
- Extend `ElektroPlanBridge.data` with `cableRulerTable(): Promise<readonly CableRulerEntryDto[]>;`.

**Step 6: Query key**

Edit `apps/desktop/renderer/src/query/keys.ts`:

```ts
cableRulerTable: ["cable-ruler-table"] as const,
```

**Step 7: Verify**

Run: `pnpm -w -r build`
Expected: all packages compile.

Run: `pnpm -w -r test`
Expected: all green. Renderer has no new tests yet; that is fine.

**Step 8: Commit**

```bash
git add apps/desktop
git commit -m "feat(desktop): expose cable ruler via IPC + preload + renderer bridge"
```

---

## Phase 6: Renderer — Cable page mode switcher

### Task 6: Split CablePage into tabs (Cetvel default + Detaylı)

**Design:** Mirror `MotorPage.tsx`. Parent `CablePage` holds the mode state; children are `CableRulerMode` (new) and `CableDetailedMode` (the existing CablePage body extracted verbatim).

**Files:**
- Create: `apps/desktop/renderer/src/features/cable/CableRulerMode.tsx`
- Create: `apps/desktop/renderer/src/features/cable/CableRulerMode.module.css`
- Create: `apps/desktop/renderer/src/features/cable/CableDetailedMode.tsx` (extracted existing body)
- Create: `apps/desktop/renderer/src/features/cable/CableDetailedMode.module.css` (move current styles)
- Modify: `apps/desktop/renderer/src/features/cable/CablePage.tsx` (becomes a thin shell like MotorPage)
- Modify: `apps/desktop/renderer/src/features/cable/CablePage.module.css` (adopt tab styles from MotorPage.module.css — copy-paste)

**Step 1: Extract detailed mode verbatim**

- Copy all current `CablePage.tsx` body (the existing detailed form + voltage drop) into `CableDetailedMode.tsx` as a `CableDetailedMode` component. Preserve all state, queries, handlers. Rename file imports to keep relative paths valid.
- Move `CablePage.module.css` styles that are form-specific into `CableDetailedMode.module.css`; retain page-level (heading/tabs) styles in the shell.

**Step 2: Build ruler mode (simple form)**

Minimum UI:
- Input: "Tasarım Akımı (A)" (required, positive number)
- Select: "Ortam" with options `{ value: "hava_30C", label: "Hava (30 °C)" }`, `{ value: "toprak_20C", label: "Toprak (20 °C)" }` — default `hava_30C`.
- Button: "Hesapla"
- Result panel: `Seçilen Kesit` (highlight), `Ampasite (A)`, `DC Direnç (Ω/km)`, `Dış Çap (mm)`, `Net Ağırlık (kg/km)`, plus "Seçim Kaynağı: `{nominal_kesit_mm2}` etiketi (data `{dataVersion}`)".
- Handle the no-match case: catch the IPC error and render `<ErrorBanner>` with "Bu akım için ruler aralığında kesit yok." (instead of crashing).

Use `getBridge().calc.cableRuler({ designCurrentA, ambient })`.

**Step 3: Replace CablePage with a tab shell**

```tsx
// CablePage.tsx
import { useState } from "react";
import { CableRulerMode } from "./CableRulerMode";
import { CableDetailedMode } from "./CableDetailedMode";
import styles from "./CablePage.module.css";

type CableMode = "ruler" | "detailed";

export function CablePage() {
  const [mode, setMode] = useState<CableMode>("ruler"); // default = cetvel

  return (
    <div className={styles.page}>
      <h1 className={styles.heading}>Kablo Kesiti Seçimi</h1>
      <div className={styles.tabs}>
        <button type="button"
          className={`${styles.tab} ${mode === "ruler" ? styles.active : ""}`}
          onClick={() => setMode("ruler")}>Cetvel Modu</button>
        <button type="button"
          className={`${styles.tab} ${mode === "detailed" ? styles.active : ""}`}
          onClick={() => setMode("detailed")}>Detaylı Hesap</button>
      </div>
      {mode === "ruler" ? <CableRulerMode /> : <CableDetailedMode />}
    </div>
  );
}
```

**Step 4: Run the desktop app manually (dev only)**

Run: `pnpm -C apps/desktop dev` (or whatever the desktop package exposes — inspect `apps/desktop/package.json` first; do NOT guess).
Navigate to the cable page. Verify:
- Default tab is "Cetvel Modu"
- Entering `24` A with ambient "hava_30C" → result shows "1,5 mm²" selected, 24 A ampacity.
- Entering `10` A toprak → result shows "1*" (1 mm²), 11 A ampacity.
- Switching to "Detaylı Hesap" still runs the full IEC algorithm (regression check).

Expected: all three behaviours observed.

**Step 5: Commit**

```bash
git add apps/desktop/renderer/src/features/cable
git commit -m "feat(renderer): cable page cetvel mode default + detailed secondary"
```

---

## Phase 7: Renderer — Motor formula suggestion row

### Task 7: Show "Önerilen Kablo Kesiti" in Motor FormulaMode

**Files:**
- Modify: `apps/desktop/renderer/src/features/motor/FormulaMode.tsx`

**Step 1: Render the row**

Inside the `result.value.mode === "formula"` branch, after the existing `ResultRow`s, render conditionally:

```tsx
{result.value.suggestedCableSection && (
  <ResultRow
    label="Önerilen Kablo Kesiti"
    value={`${result.value.suggestedCableSection.label} mm² (${formatAmp(result.value.suggestedCableSection.ampacityA, 0)} hava 30 °C)`}
  />
)}
```

Make sure the renderer's `MotorResponse` type picks up the new optional field through the bridge (it will, because the bridge type mirrors `@elektroplan/contracts`).

**Step 2: Manual verification in dev app**

- Motor formula: 3-phase, 380 V LL, cosφ 0.85, η 85 %, P_out 7.5 kW → current ~15.8 A → suggestion "1,5" (24 A hava 30 °C).
- Motor formula with an absurd P_out producing >600 A → suggestion row not rendered (no crash).

**Step 3: Commit**

```bash
git add apps/desktop/renderer/src/features/motor/FormulaMode.tsx
git commit -m "feat(renderer): show suggested cable section on motor formula result"
```

---

## Phase 8: Final verification

### Task 8: Full monorepo green + smoke

**Step 1:** Run the entire test matrix.

Run: `pnpm -w -r build`
Run: `pnpm -w -r test`
Run: `pnpm -w lint` (if defined — inspect `package.json` first; skip only if absent)

**Step 2:** Walk through docs/plans/IEC_60364_5_52_DATA_REFERENCE.md to confirm nothing in this plan contradicts the locked IEC dataset section. The new ruler dataset lives alongside, not replacing, the IEC ampacity tables used by the detailed mode.

**Step 3:** Final commit if any doc updates are required, then summarise changes for the user.

---

## Skills / References

- `packages/calculation-data/src/iec/motor-ruler/` — pattern to follow for dataset loader + accessors + validation.
- `apps/desktop/renderer/src/features/motor/MotorPage.tsx` + `TableMode.tsx` — exact tab/mode pattern to mirror in `CablePage`.
- `apps/desktop/main/src/services/calculate-service.ts` — pattern for IPC service methods.
- `Plan/IEC_60364_5_52_DATA_REFERENCE.md` — for context on why the ruler coexists with, not supersedes, the detailed algorithm.

## Out of scope (explicitly)

- No interpolation between rows. Exact ampacity >= designCurrent lookup only.
- No temperature / grouping / harmonic correction in ruler mode — if the user needs those, they switch to "Detaylı Hesap".
- No changes to motor table mode (`TableMode.tsx`) or its `cableSpec` string; the `standard-motors.json` `cableSpec` column remains authoritative for the motor table view.
- No persistence changes — ruler results flow through existing `save`/`records` only if a future task wires a new calculator kind. Not in this plan.
