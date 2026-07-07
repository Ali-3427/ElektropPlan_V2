import harmonicFactorsJson from "./data.json" with { type: "json" };

import { loadJsonDataset } from "../../dataset/load-json-dataset.js";
import type {
  HarmonicFactorDataset,
  HarmonicFactorEntry,
  HarmonicFactorRange,
} from "./types.js";

const DATASET_PATH = "packages/calculation-data/src/iec/harmonic-factors/data.json";
const REQUIRED_STANDARD = "IEC 60364-5-52";
const REQUIRED_REVISION = "v1";
const REQUIRED_VALID_FROM = "2026-04-19";

function assertRange(range: HarmonicFactorRange, index: number): void {
  if (
    typeof range.minPercent !== "number" ||
    (range.maxPercent !== null && typeof range.maxPercent !== "number") ||
    typeof range.minInclusive !== "boolean" ||
    typeof range.maxInclusive !== "boolean"
  ) {
    throw new Error(`Harmonic factor entry ${index} has an invalid range.`);
  }
}

function assertEntry(entry: HarmonicFactorEntry, index: number): void {
  assertRange(entry.range, index);

  if (entry.phaseFactor !== null && typeof entry.phaseFactor !== "number") {
    throw new Error(`Harmonic factor entry ${index} has invalid phaseFactor.`);
  }

  if (entry.neutralFactor !== null && typeof entry.neutralFactor !== "number") {
    throw new Error(`Harmonic factor entry ${index} has invalid neutralFactor.`);
  }

  if (
    entry.sizingCurrentBasis !== "phase" &&
    entry.sizingCurrentBasis !== "neutral"
  ) {
    throw new Error(`Harmonic factor entry ${index} has invalid sizingCurrentBasis.`);
  }
}

function assertHarmonicFactorDataset(
  dataset: Readonly<HarmonicFactorDataset>,
): Readonly<HarmonicFactorDataset> {
  if (
    dataset.metadata.standard !== REQUIRED_STANDARD ||
    dataset.metadata.revision !== REQUIRED_REVISION ||
    dataset.metadata.validFrom !== REQUIRED_VALID_FROM
  ) {
    throw new Error(`Harmonic factor dataset metadata does not match the authoritative reference.`);
  }

  if (!Array.isArray(dataset.entries) || dataset.entries.length === 0) {
    throw new Error(`Harmonic factor dataset must contain entries.`);
  }

  dataset.entries.forEach(assertEntry);
  return dataset;
}

export const harmonicFactorDataset = assertHarmonicFactorDataset(
  loadJsonDataset(harmonicFactorsJson as HarmonicFactorDataset, DATASET_PATH),
);
