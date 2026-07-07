import protectionCatalogJson from "./data.json" with { type: "json" };

import { loadJsonDataset } from "../../dataset/load-json-dataset.js";
import type {
  ProtectionCatalogDataset,
  ProtectionCatalogEntry,
  ProtectionCatalogColumn,
} from "./types.js";
import {
  PROTECTION_CATALOG_COLUMNS,
  PROTECTION_DEVICE_CURVES,
  PROTECTION_DEVICE_FAMILIES,
} from "./types.js";

const DATASET_PATH =
  "packages/calculation-data/src/iec/protection-catalog/data.json";
const REQUIRED_STANDARD = "project-seed-catalog";
const REQUIRED_REVISION = "v1";
const REQUIRED_VALID_FROM = "2026-04-19";

function assertColumns(
  columns: readonly ProtectionCatalogColumn[],
): readonly ProtectionCatalogColumn[] {
  if (columns.length !== PROTECTION_CATALOG_COLUMNS.length) {
    throw new Error(`Protection catalog columns do not match the expected schema.`);
  }

  for (const [index, column] of PROTECTION_CATALOG_COLUMNS.entries()) {
    if (columns[index] !== column) {
      throw new Error(`Protection catalog column ${index} does not match the expected schema.`);
    }
  }

  return columns;
}

function assertEntry(
  entry: ProtectionCatalogEntry,
  index: number,
  seenIds: Set<string>,
): void {
  if (typeof entry.id !== "string" || entry.id.trim().length === 0) {
    throw new Error(`Protection catalog entry ${index} has an invalid id.`);
  }

  if (seenIds.has(entry.id)) {
    throw new Error(`Protection catalog entry ${index} has a duplicate id.`);
  }
  seenIds.add(entry.id);

  if (!PROTECTION_DEVICE_FAMILIES.includes(entry.family)) {
    throw new Error(`Protection catalog entry ${index} has an invalid family.`);
  }

  if (
    typeof entry.poles !== "number" ||
    !Number.isInteger(entry.poles) ||
    entry.poles < 1
  ) {
    throw new Error(`Protection catalog entry ${index} has an invalid poles value.`);
  }

  if (
    typeof entry.nominalCurrentA !== "number" ||
    entry.nominalCurrentA <= 0
  ) {
    throw new Error(`Protection catalog entry ${index} has an invalid nominalCurrentA.`);
  }

  if (
    entry.breakingCapacityKa !== null &&
    (typeof entry.breakingCapacityKa !== "number" ||
      entry.breakingCapacityKa <= 0)
  ) {
    throw new Error(`Protection catalog entry ${index} has an invalid breakingCapacityKa.`);
  }

  if (
    entry.curve !== null &&
    !PROTECTION_DEVICE_CURVES.includes(entry.curve)
  ) {
    throw new Error(`Protection catalog entry ${index} has an invalid curve.`);
  }

  if (
    entry.residualCurrentMa !== null &&
    (typeof entry.residualCurrentMa !== "number" ||
      entry.residualCurrentMa <= 0)
  ) {
    throw new Error(`Protection catalog entry ${index} has an invalid residualCurrentMa.`);
  }

  if (typeof entry.voltageV !== "number" || entry.voltageV <= 0) {
    throw new Error(`Protection catalog entry ${index} has an invalid voltageV.`);
  }

  if (
    typeof entry.sourceNote !== "string" ||
    entry.sourceNote.trim().length === 0
  ) {
    throw new Error(`Protection catalog entry ${index} has an invalid sourceNote.`);
  }
}

function assertProtectionCatalogDataset(
  dataset: Readonly<ProtectionCatalogDataset>,
): Readonly<ProtectionCatalogDataset> {
  if (
    dataset.metadata.standard !== REQUIRED_STANDARD ||
    dataset.metadata.revision !== REQUIRED_REVISION ||
    dataset.metadata.validFrom !== REQUIRED_VALID_FROM
  ) {
    throw new Error(`Protection catalog dataset metadata does not match the packaged dataset.`);
  }

  if (!Array.isArray(dataset.columns)) {
    throw new Error(`Protection catalog dataset must declare columns.`);
  }

  assertColumns(dataset.columns);

  if (!Array.isArray(dataset.entries) || dataset.entries.length === 0) {
    throw new Error(`Protection catalog dataset must contain entries.`);
  }

  const seenIds = new Set<string>();
  dataset.entries.forEach((entry, index) => assertEntry(entry, index, seenIds));
  return dataset;
}

export const protectionCatalogDataset = assertProtectionCatalogDataset(
  loadJsonDataset(
    protectionCatalogJson as ProtectionCatalogDataset,
    DATASET_PATH,
  ),
);
