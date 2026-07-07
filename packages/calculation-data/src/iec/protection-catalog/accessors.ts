import { protectionCatalogDataset } from "./dataset.js";
import type {
  ProtectionCatalogEntry,
  ProtectionDeviceLookupQuery,
} from "./types.js";

function compareEntries(
  left: ProtectionCatalogEntry,
  right: ProtectionCatalogEntry,
): number {
  return (
    left.nominalCurrentA - right.nominalCurrentA ||
    left.poles - right.poles ||
    left.voltageV - right.voltageV ||
    left.id.localeCompare(right.id)
  );
}

export function lookupProtectionDevice(
  query: Readonly<ProtectionDeviceLookupQuery>,
): readonly ProtectionCatalogEntry[] {
  if (
    typeof query.minimumNominalCurrentA !== "number" ||
    query.minimumNominalCurrentA <= 0
  ) {
    throw new Error(`lookupProtectionDevice requires a positive minimumNominalCurrentA.`);
  }

  if (
    query.limit !== undefined &&
    (!Number.isInteger(query.limit) || query.limit <= 0)
  ) {
    throw new Error(`lookupProtectionDevice limit must be a positive integer when provided.`);
  }

  const familyFilter = query.families !== undefined
    ? new Set(query.families)
    : null;

  const matches = protectionCatalogDataset.entries.filter((entry) => {
    if (entry.nominalCurrentA < query.minimumNominalCurrentA) {
      return false;
    }

    if (familyFilter !== null && !familyFilter.has(entry.family)) {
      return false;
    }

    if (query.poles !== undefined && entry.poles !== query.poles) {
      return false;
    }

    if (query.voltageV !== undefined && entry.voltageV !== query.voltageV) {
      return false;
    }

    if (query.curve !== undefined && entry.curve !== query.curve) {
      return false;
    }

    if (
      query.residualCurrentMa !== undefined &&
      entry.residualCurrentMa !== query.residualCurrentMa
    ) {
      return false;
    }

    return true;
  });

  matches.sort(compareEntries);
  return query.limit === undefined ? matches : matches.slice(0, query.limit);
}
