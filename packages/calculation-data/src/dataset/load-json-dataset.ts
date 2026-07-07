import type { DatasetMetadata, DatasetWithMetadata } from "./types.js";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function assertMetadataString(
  metadata: Record<string, unknown>,
  key: keyof DatasetMetadata,
  context: string,
): void {
  if (typeof metadata[key] !== "string" || metadata[key].trim().length === 0) {
    throw new Error(`Invalid dataset metadata '${key}' in ${context}.`);
  }
}

export function assertDatasetMetadata(
  metadata: unknown,
  context: string,
): asserts metadata is DatasetMetadata {
  if (!isRecord(metadata)) {
    throw new Error(`Dataset metadata must be an object in ${context}.`);
  }

  assertMetadataString(metadata, "id", context);
  assertMetadataString(metadata, "standard", context);
  assertMetadataString(metadata, "revision", context);
  assertMetadataString(metadata, "source", context);
  assertMetadataString(metadata, "validFrom", context);
  assertMetadataString(metadata, "notes", context);
}

function deepFreeze<T>(value: T): Readonly<T> {
  if (Array.isArray(value)) {
    for (const item of value) {
      deepFreeze(item);
    }
  } else if (isRecord(value)) {
    for (const nestedValue of Object.values(value)) {
      deepFreeze(nestedValue);
    }
  }

  return Object.freeze(value);
}

export function loadJsonDataset<T extends DatasetWithMetadata>(
  dataset: T,
  context: string,
): Readonly<T> {
  if (!isRecord(dataset)) {
    throw new Error(`Dataset must be an object in ${context}.`);
  }

  assertDatasetMetadata(dataset.metadata, context);
  return deepFreeze(dataset);
}
