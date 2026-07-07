import { getStandardCrossSections } from "@elektroplan/calculation-data";

import { calculateCableSizing } from "./index.js";
import type { CableSizingInput } from "./types.js";

function createBaseInput(): CableSizingInput {
  return {
    designCurrentA: 60,
    phase: 3,
    conductorMaterial: "copper",
    installationMethod: "C",
    insulationRating: "XLPE_EPR_90C",
    ambientTemperatureC: 30,
    groupedCircuits: 1,
    thirdHarmonicPercent: 0,
    voltageDropLimitPercent: 5,
    voltageDrop: {
      systemType: "three-phase-ac-ll",
      impedanceMode: "exact-ac",
      lengthM: 25,
      baseVoltageV: 400,
      cosPhi: 0.9,
    },
  };
}

describe("calculateCableSizing", () => {
  it("upsizes when the thermally valid section fails the voltage-drop gate", () => {
    const result = calculateCableSizing({
      ...createBaseInput(),
      voltageDrop: {
        ...createBaseInput().voltageDrop,
        lengthM: 150,
      },
    });

    expect(result.value.selectedSectionMm2).toBe(16);

    const section10 = result.value.candidateTrace.find(
      (candidate) => candidate.sectionMm2 === 10,
    );
    const section16 = result.value.candidateTrace.find(
      (candidate) => candidate.sectionMm2 === 16,
    );

    expect(section10).toMatchObject({
      sectionMm2: 10,
      thermalPass: true,
      vdPass: false,
      accepted: false,
    });
    expect(section16).toMatchObject({
      sectionMm2: 16,
      thermalPass: true,
      vdPass: true,
      accepted: true,
    });
  });

  it("is monotone non-decreasing in Ib", () => {
    const sections = [40, 60, 100].map((designCurrentA) =>
      calculateCableSizing({
        ...createBaseInput(),
        designCurrentA,
      }).value.selectedSectionMm2,
    );
    const [first, second, third] = sections;

    expect(first).toBeLessThanOrEqual(second as number);
    expect(second).toBeLessThanOrEqual(third as number);
  });

  it("is monotone non-increasing as kTotal improves", () => {
    const conservative = calculateCableSizing({
      ...createBaseInput(),
      groupedCircuits: 6,
      ambientTemperatureC: 50,
      thirdHarmonicPercent: 20,
    });
    const favorable = calculateCableSizing(createBaseInput());

    expect(conservative.value.kTotal).toBeLessThan(favorable.value.kTotal);
    expect(conservative.value.selectedSectionMm2).toBeGreaterThanOrEqual(
      favorable.value.selectedSectionMm2,
    );
  });

  it("never returns the preliminary I/J estimate as the final selection", () => {
    const result = calculateCableSizing({
      ...createBaseInput(),
      designCurrentA: 70,
    });

    expect(result.value.preliminaryEstimate.kind).toBe("preliminary-j-hint");
    expect(result.value.preliminaryEstimate.estimatedSectionMm2).toBe(17.5);
    expect(result.value.selectedSectionMm2).toBe(10);
    expect(result.value.selectedSectionMm2).not.toBe(
      result.value.preliminaryEstimate.estimatedSectionMm2,
    );
    expect(getStandardCrossSections("copper")).toContain(result.value.selectedSectionMm2);
  });

  it("rejects invalid installation method codes", () => {
    expect(() =>
      calculateCableSizing({
        ...createBaseInput(),
        installationMethod: "Z9" as never,
      }),
    ).toThrow("installationMethod must be one of: A1, A2, B1, B2, C, D, E.");
  });

  it("keeps single-phase in the API but rejects it with an explicit dataset support error", () => {
    expect(() =>
      calculateCableSizing({
        ...createBaseInput(),
        phase: 1,
        voltageDrop: {
          ...createBaseInput().voltageDrop,
          systemType: "single-phase-ac-two-conductor",
          baseVoltageV: 230,
        },
      }),
    ).toThrow(
      "Single-phase cable sizing is not yet supported because the authoritative ampacity dataset only covers 3 loaded conductors.",
    );
  });
});
