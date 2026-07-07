import temperatureFactorsJson from "./data.json" with { type: "json" };

import { loadJsonDataset } from "../../dataset/load-json-dataset.js";
import type { TemperatureFactorDataset, TemperatureFactorEntry } from "./types.js";

const DATASET_PATH =
  "packages/calculation-data/src/iec/temperature-factors/data.json";
const REQUIRED_STANDARD = "IEC 60364-5-52";
const REQUIRED_REVISION = "v1";
const REQUIRED_VALID_FROM = "2026-04-19";

function assertRequiredMetadata(
  dataset: Readonly<TemperatureFactorDataset>,
): void {
  if (
    dataset.metadata.standard !== REQUIRED_STANDARD ||
    dataset.metadata.revision !== REQUIRED_REVISION ||
    dataset.metadata.validFrom !== REQUIRED_VALID_FROM
  ) {
    throw new Error(`Temperature factor dataset metadata does not match the authoritative reference.`);
  }
}

function assertEntries(
  entries: readonly TemperatureFactorEntry[],
  label: string,
): void {
  let previousTemperature: number | undefined;

  for (const [index, entry] of entries.entries()) {
    if (typeof entry !== "object" || entry === null) {
      throw new Error(`Temperature factor ${label} entry ${index} must be an object.`);
    }

    if (
      typeof entry.temperatureC !== "number" ||
      typeof entry.pvc70 !== "number" ||
      typeof entry.xlpeEpr90 !== "number"
    ) {
      throw new Error(`Temperature factor ${label} entry ${index} is invalid.`);
    }

    if (
      previousTemperature !== undefined &&
      entry.temperatureC <= previousTemperature
    ) {
      throw new Error(`Temperature factor ${label} entries must be strictly ascending.`);
    }

    previousTemperature = entry.temperatureC;
  }
}

function assertTemperatureFactorDataset(
  dataset: Readonly<TemperatureFactorDataset>,
): Readonly<TemperatureFactorDataset> {
  assertRequiredMetadata(dataset);

  if (!Array.isArray(dataset.air) || !Array.isArray(dataset.underground)) {
    throw new Error(`Temperature factor dataset must expose air and underground tables.`);
  }

  assertEntries(dataset.air, "air");
  assertEntries(dataset.underground, "underground");
  return dataset;
}

export const temperatureFactorDataset = assertTemperatureFactorDataset(
  loadJsonDataset(
    temperatureFactorsJson as TemperatureFactorDataset,
    DATASET_PATH,
  ),
);
