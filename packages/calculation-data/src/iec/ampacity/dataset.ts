import aluminumAmpacityJson from "./aluminum-xlpe-90c-3loaded.json" with {
  type: "json",
};
import copperAmpacityJson from "./copper-xlpe-90c-3loaded.json" with {
  type: "json",
};

import { loadJsonDataset } from "../../dataset/load-json-dataset.js";
import {
  INSTALLATION_METHOD_CODES,
  type InstallationMethodCode,
} from "../installation-methods/types.js";
import {
  AMPACITY_MATERIALS,
  type AmpacityDataset,
  type AmpacityEntry,
  type AmpacityMaterial,
} from "./types.js";

const REQUIRED_STANDARD = "IEC 60364-5-52";
const REQUIRED_REVISION = "v1";
const REQUIRED_VALID_FROM = "2026-04-19";

const AMPACITY_DATASET_PATHS: Record<AmpacityMaterial, string> = {
  copper:
    "packages/calculation-data/src/iec/ampacity/copper-xlpe-90c-3loaded.json",
  aluminum:
    "packages/calculation-data/src/iec/ampacity/aluminum-xlpe-90c-3loaded.json",
};

function assertRequiredMetadata(dataset: Readonly<AmpacityDataset>): void {
  if (dataset.metadata.standard !== REQUIRED_STANDARD) {
    throw new Error(
      `Ampacity dataset '${dataset.metadata.id}' must declare standard '${REQUIRED_STANDARD}'.`,
    );
  }

  if (dataset.metadata.revision !== REQUIRED_REVISION) {
    throw new Error(
      `Ampacity dataset '${dataset.metadata.id}' must declare revision '${REQUIRED_REVISION}'.`,
    );
  }

  if (dataset.metadata.validFrom !== REQUIRED_VALID_FROM) {
    throw new Error(
      `Ampacity dataset '${dataset.metadata.id}' must declare validFrom '${REQUIRED_VALID_FROM}'.`,
    );
  }
}

function assertMethodValues(
  methods: unknown,
  index: number,
): asserts methods is Record<InstallationMethodCode, number | null> {
  if (typeof methods !== "object" || methods === null) {
    throw new Error(`Ampacity entry ${index} methods must be an object.`);
  }

  const candidate = methods as Record<string, unknown>;

  for (const method of INSTALLATION_METHOD_CODES) {
    const value = candidate[method];
    if (value !== null && typeof value !== "number") {
      throw new Error(
        `Ampacity entry ${index} has invalid '${method}' value: expected number or null.`,
      );
    }
  }
}

function assertAmpacityEntry(
  entry: unknown,
  index: number,
  previousCrossSection: number | undefined,
): number {
  if (typeof entry !== "object" || entry === null) {
    throw new Error(`Ampacity entry ${index} must be an object.`);
  }

  const candidate = entry as Record<string, unknown>;

  if (typeof candidate.crossSectionMm2 !== "number") {
    throw new Error(`Ampacity entry ${index} has invalid 'crossSectionMm2'.`);
  }

  if (
    previousCrossSection !== undefined &&
    candidate.crossSectionMm2 <= previousCrossSection
  ) {
    throw new Error(`Ampacity entries must be strictly ascending.`);
  }

  assertMethodValues(candidate.methods, index);
  return candidate.crossSectionMm2;
}

function assertAmpacityDataset(
  dataset: Readonly<AmpacityDataset>,
): Readonly<AmpacityDataset> {
  assertRequiredMetadata(dataset);

  if (!(AMPACITY_MATERIALS as readonly string[]).includes(dataset.material)) {
    throw new Error(`Ampacity dataset '${dataset.metadata.id}' has invalid material.`);
  }

  if (dataset.conductorCount !== 3) {
    throw new Error(`Ampacity dataset '${dataset.metadata.id}' must model 3 loaded conductors.`);
  }

  if (dataset.system !== "three-phase") {
    throw new Error(`Ampacity dataset '${dataset.metadata.id}' must model a three-phase system.`);
  }

  if (dataset.insulation !== "XLPE/EPR" || dataset.insulationTemperatureC !== 90) {
    throw new Error(
      `Ampacity dataset '${dataset.metadata.id}' must model XLPE/EPR insulation at 90C.`,
    );
  }

  if (dataset.referenceAmbientAirC !== 30 || dataset.referenceGroundC !== 20) {
    throw new Error(
      `Ampacity dataset '${dataset.metadata.id}' must use 30C air / 20C ground references.`,
    );
  }

  if (!Array.isArray(dataset.entries) || dataset.entries.length === 0) {
    throw new Error(`Ampacity dataset '${dataset.metadata.id}' must contain entries.`);
  }

  let previousCrossSection: number | undefined;
  for (const [index, entry] of dataset.entries.entries()) {
    previousCrossSection = assertAmpacityEntry(
      entry,
      index,
      previousCrossSection,
    );
  }

  return dataset;
}

function loadAmpacityDataset(
  material: AmpacityMaterial,
  rawDataset: AmpacityDataset,
): Readonly<AmpacityDataset> {
  const dataset = loadJsonDataset(rawDataset, AMPACITY_DATASET_PATHS[material]);

  if (dataset.material !== material) {
    throw new Error(
      `Ampacity dataset '${dataset.metadata.id}' material mismatch: expected '${material}'.`,
    );
  }

  return assertAmpacityDataset(dataset);
}

export const ampacityDatasets: Readonly<Record<AmpacityMaterial, Readonly<AmpacityDataset>>> =
  Object.freeze({
    copper: loadAmpacityDataset("copper", copperAmpacityJson as AmpacityDataset),
    aluminum: loadAmpacityDataset(
      "aluminum",
      aluminumAmpacityJson as AmpacityDataset,
    ),
  });

export const standardCrossSectionsByMaterial: Readonly<
  Record<AmpacityMaterial, readonly number[]>
> = Object.freeze({
  copper: Object.freeze(
    ampacityDatasets.copper.entries.map((entry: AmpacityEntry) => entry.crossSectionMm2),
  ),
  aluminum: Object.freeze(
    ampacityDatasets.aluminum.entries.map((entry: AmpacityEntry) => entry.crossSectionMm2),
  ),
});
