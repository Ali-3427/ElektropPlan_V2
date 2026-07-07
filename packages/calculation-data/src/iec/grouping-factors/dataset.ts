import groupingFactorsJson from "./data.json" with { type: "json" };

import { loadJsonDataset } from "../../dataset/load-json-dataset.js";
import type {
  GroupingFactorDataset,
  GroupingFactorEntry,
} from "./types.js";

const DATASET_PATH = "packages/calculation-data/src/iec/grouping-factors/data.json";
const REQUIRED_STANDARD = "IEC 60364-5-52";
const REQUIRED_REVISION = "v1";
const REQUIRED_VALID_FROM = "2026-04-19";

function assertGroupingFactorEntry(
  entry: GroupingFactorEntry,
  index: number,
  previousCircuits: number | undefined,
): number {
  if (typeof entry.circuits !== "number" || typeof entry.factor !== "number") {
    throw new Error(`Grouping factor entry ${index} is invalid.`);
  }

  if (previousCircuits !== undefined && entry.circuits <= previousCircuits) {
    throw new Error(`Grouping factor entries must be strictly ascending.`);
  }

  return entry.circuits;
}

function assertGroupingFactorDataset(
  dataset: Readonly<GroupingFactorDataset>,
): Readonly<GroupingFactorDataset> {
  if (
    dataset.metadata.standard !== REQUIRED_STANDARD ||
    dataset.metadata.revision !== REQUIRED_REVISION ||
    dataset.metadata.validFrom !== REQUIRED_VALID_FROM
  ) {
    throw new Error(`Grouping factor dataset metadata does not match the authoritative reference.`);
  }

  if (!Array.isArray(dataset.entries) || dataset.entries.length === 0) {
    throw new Error(`Grouping factor dataset must contain entries.`);
  }

  let previousCircuits: number | undefined;
  for (const [index, entry] of dataset.entries.entries()) {
    previousCircuits = assertGroupingFactorEntry(
      entry,
      index,
      previousCircuits,
    );
  }

  return dataset;
}

export const groupingFactorDataset = assertGroupingFactorDataset(
  loadJsonDataset(groupingFactorsJson as GroupingFactorDataset, DATASET_PATH),
);
