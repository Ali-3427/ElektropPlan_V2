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

function assertNullableNumberField(
  candidate: Record<string, unknown>,
  field: "akim_toprak_20C_A" | "akim_hava_30C_A",
  index: number,
): void {
  if (candidate[field] !== null && typeof candidate[field] !== "number") {
    throw new Error(`Cable ruler entry ${index} has invalid '${field}'.`);
  }
}

function assertCableRulerEntry(
  entry: unknown,
  index: number,
): asserts entry is Omit<CableRulerEntry, "sectionMm2"> {
  if (typeof entry !== "object" || entry === null) {
    throw new Error(`Cable ruler entry ${index} must be an object.`);
  }

  const candidate = entry as Record<string, unknown>;

  if (typeof candidate.nominal_kesit_mm2 !== "string") {
    throw new Error(`Cable ruler entry ${index} has invalid 'nominal_kesit_mm2'.`);
  }

  const requiredNumberFields = [
    "dis_cap_mm",
    "net_agirlik_kg_km",
    "sevk_uzunlugu_m",
    "dc_direnc_ohm_km_20C",
  ] as const;

  for (const field of requiredNumberFields) {
    if (typeof candidate[field] !== "number") {
      throw new Error(`Cable ruler entry ${index} has invalid '${field}'.`);
    }
  }

  assertNullableNumberField(candidate, "akim_toprak_20C_A", index);
  assertNullableNumberField(candidate, "akim_hava_30C_A", index);
}

function buildEntries(rawEntries: readonly unknown[]): readonly CableRulerEntry[] {
  return Object.freeze(
    rawEntries.map((entry, index) => {
      assertCableRulerEntry(entry, index);
      return Object.freeze({
        ...entry,
        sectionMm2: parseSectionLabel(entry.nominal_kesit_mm2),
      });
    }),
  );
}

function assertCableRulerDataset(
  dataset: Readonly<CableRulerDataset>,
): Readonly<CableRulerDataset> {
  if (!Array.isArray(dataset.columns)) {
    throw new Error(`Cable ruler columns must be an array.`);
  }

  if (
    dataset.columns.length !== CABLE_RULER_COLUMNS.length ||
    dataset.columns.some((column, index) => column !== CABLE_RULER_COLUMNS[index])
  ) {
    throw new Error(
      `Cable ruler columns do not match the locked plan in ${CABLE_RULER_DATASET_PATH}.`,
    );
  }

  if (!Array.isArray(dataset.entries)) {
    throw new Error(`Cable ruler entries must be an array.`);
  }

  if (dataset.entries.length !== CABLE_RULER_EXPECTED_ROW_COUNT) {
    throw new Error(
      `Cable ruler row count must be ${CABLE_RULER_EXPECTED_ROW_COUNT} in ${CABLE_RULER_DATASET_PATH}.`,
    );
  }

  return dataset;
}

const rawLoaded = loadJsonDataset(
  rulerJson as Omit<CableRulerDataset, "entries"> & { entries: readonly unknown[] },
  CABLE_RULER_DATASET_PATH,
);

export const cableRulerDataset = assertCableRulerDataset(
  Object.freeze({
    metadata: rawLoaded.metadata,
    columns: rawLoaded.columns as readonly (typeof CABLE_RULER_COLUMNS)[number][],
    entries: buildEntries(rawLoaded.entries),
  }),
);
