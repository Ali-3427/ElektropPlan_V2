import profilesJson from "./profiles.json" with { type: "json" };

import { loadJsonDataset } from "../../dataset/load-json-dataset.js";
import {
  VOLTAGE_DROP_PROFILE_IDS,
  type VoltageDropProfile,
  type VoltageDropProfileId,
  type VoltageDropProfilesDataset,
} from "./types.js";

const VOLTAGE_DROP_PROFILES_DATASET_PATH =
  "packages/calculation-data/src/profiles/voltage-drop-limits/profiles.json";
const EXPECTED_PROFILE_COUNT = 4;

function isValidProfileId(value: unknown): value is VoltageDropProfileId {
  return (
    typeof value === "string" &&
    VOLTAGE_DROP_PROFILE_IDS.includes(value as VoltageDropProfileId)
  );
}

function assertProfile(
  entry: unknown,
  index: number,
): asserts entry is VoltageDropProfile {
  if (typeof entry !== "object" || entry === null) {
    throw new Error(`VD profile ${index} must be an object.`);
  }
  const candidate = entry as Record<string, unknown>;
  if (!isValidProfileId(candidate.id)) {
    throw new Error(`VD profile ${index} has invalid 'id'.`);
  }
  if (typeof candidate.titleKey !== "string") {
    throw new Error(`VD profile ${index} has invalid 'titleKey'.`);
  }
  if (typeof candidate.titleTr !== "string") {
    throw new Error(`VD profile ${index} has invalid 'titleTr'.`);
  }
  if (
    typeof candidate.limitPercent !== "number" ||
    !Number.isFinite(candidate.limitPercent) ||
    candidate.limitPercent <= 0
  ) {
    throw new Error(`VD profile ${index} has invalid 'limitPercent'.`);
  }
}

function assertDataset(
  dataset: Readonly<VoltageDropProfilesDataset>,
): Readonly<VoltageDropProfilesDataset> {
  if (!Array.isArray(dataset.profiles)) {
    throw new Error(`VD profiles must be an array.`);
  }
  if (dataset.profiles.length !== EXPECTED_PROFILE_COUNT) {
    throw new Error(
      `VD profile count must be ${EXPECTED_PROFILE_COUNT} in ${VOLTAGE_DROP_PROFILES_DATASET_PATH}.`,
    );
  }
  dataset.profiles.forEach((p, i) => assertProfile(p, i));
  if (!isValidProfileId(dataset.defaultProfileId)) {
    throw new Error(`VD profiles defaultProfileId is invalid.`);
  }
  const ids = new Set(dataset.profiles.map((p) => p.id));
  if (!ids.has(dataset.defaultProfileId)) {
    throw new Error(`VD profiles defaultProfileId not present in profiles.`);
  }
  if (ids.size !== dataset.profiles.length) {
    throw new Error(`VD profiles contain duplicate ids.`);
  }
  return dataset;
}

export const voltageDropProfilesDataset = assertDataset(
  loadJsonDataset(
    profilesJson as VoltageDropProfilesDataset,
    VOLTAGE_DROP_PROFILES_DATASET_PATH,
  ),
);
