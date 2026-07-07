import {
  lookupProtectionDevice,
  PROTECTION_DEVICE_FAMILIES,
} from "@elektroplan/calculation-data";

import { recommendProtectionDevices } from "./index.js";

describe("recommendProtectionDevices", () => {
  it("returns recommendation candidates derived from the calculation-data lookup", () => {
    const query = {
      minimumNominalCurrentA: 16,
      families: ["MCB"] as const,
      poles: 3,
      voltageV: 400,
      limit: 2,
    };

    const expected = lookupProtectionDevice(query);
    const result = recommendProtectionDevices(query);

    expect(result).toHaveLength(expected.length);
    expect(result.map((candidate) => candidate.id)).toEqual(
      expected.map((device) => device.id),
    );
    expect(result).toEqual(
      expected.map((device) => ({
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
      })),
    );
  });

  it("preserves an empty recommendation set when no devices match", () => {
    expect(
      recommendProtectionDevices({
        minimumNominalCurrentA: 9999,
        families: ["MCB"],
      }),
    ).toEqual([]);
  });

  it("exposes the supported protection families for caller-side selection filters", () => {
    expect(PROTECTION_DEVICE_FAMILIES).toEqual(["MCB", "MCCB", "RCD", "RCBO"]);
  });
});
