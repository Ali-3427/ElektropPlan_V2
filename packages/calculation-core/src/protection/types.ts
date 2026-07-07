/**
 * Scope guard for M1.P6: this module is recommendation-only.
 * Do not add sizing gates, cable-sizing integration, or pass/fail enforcement here.
 */

import type {
  ProtectionCatalogEntry,
  ProtectionDeviceLookupQuery,
} from "@elektroplan/calculation-data";

export interface ProtectionRecommendationQuery
  extends ProtectionDeviceLookupQuery {}

export interface ProtectionDeviceRatings {
  nominalCurrentA: number;
  breakingCapacityKa: number | null;
  residualCurrentMa: number | null;
  voltageV: number;
  poles: number;
}

export interface ProtectionDeviceCandidate {
  id: string;
  family: ProtectionCatalogEntry["family"];
  curve: ProtectionCatalogEntry["curve"];
  ratings: ProtectionDeviceRatings;
  sourceNote: string;
  device: ProtectionCatalogEntry;
}
