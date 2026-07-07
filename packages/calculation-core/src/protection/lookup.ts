/**
 * Scope guard for M1.P6: this module is recommendation-only.
 * Do not add sizing gates, cable-sizing integration, or pass/fail enforcement here.
 */

import { lookupProtectionDevice } from "@elektroplan/calculation-data";

import type {
  ProtectionDeviceCandidate,
  ProtectionRecommendationQuery,
} from "./types.js";

function toCandidate(device: ProtectionDeviceCandidate["device"]): ProtectionDeviceCandidate {
  return {
    id: device.id,
    family: device.family,
    curve: device.curve,
    ratings: {
      nominalCurrentA: device.nominalCurrentA,
      breakingCapacityKa: device.breakingCapacityKa,
      residualCurrentMa: device.residualCurrentMa,
      voltageV: device.voltageV,
      poles: device.poles,
    },
    sourceNote: device.sourceNote,
    device,
  };
}

export function recommendProtectionDevices(
  query: Readonly<ProtectionRecommendationQuery>,
): readonly ProtectionDeviceCandidate[] {
  return lookupProtectionDevice(query).map(toCandidate);
}
