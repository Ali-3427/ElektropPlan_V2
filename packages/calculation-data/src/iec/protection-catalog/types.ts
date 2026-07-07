import type { DatasetWithMetadata } from "../../dataset/types.js";

export const PROTECTION_DEVICE_FAMILIES = [
  "MCB",
  "MCCB",
  "RCD",
  "RCBO",
] as const;

export type ProtectionDeviceFamily =
  (typeof PROTECTION_DEVICE_FAMILIES)[number];

export const PROTECTION_DEVICE_CURVES = ["B", "C", "D"] as const;

export type ProtectionDeviceCurve = (typeof PROTECTION_DEVICE_CURVES)[number];

export const PROTECTION_CATALOG_COLUMNS = [
  "id",
  "family",
  "poles",
  "nominalCurrentA",
  "breakingCapacityKa",
  "curve",
  "residualCurrentMa",
  "voltageV",
  "sourceNote",
] as const;

export type ProtectionCatalogColumn =
  (typeof PROTECTION_CATALOG_COLUMNS)[number];

export interface ProtectionCatalogEntry {
  id: string;
  family: ProtectionDeviceFamily;
  poles: number;
  nominalCurrentA: number;
  breakingCapacityKa: number | null;
  curve: ProtectionDeviceCurve | null;
  residualCurrentMa: number | null;
  voltageV: number;
  sourceNote: string;
}

export interface ProtectionCatalogDataset extends DatasetWithMetadata {
  columns: readonly ProtectionCatalogColumn[];
  entries: readonly ProtectionCatalogEntry[];
}

export interface ProtectionDeviceLookupQuery {
  minimumNominalCurrentA: number;
  families?: readonly ProtectionDeviceFamily[];
  poles?: number;
  voltageV?: number;
  curve?: ProtectionDeviceCurve;
  residualCurrentMa?: number;
  limit?: number;
}
