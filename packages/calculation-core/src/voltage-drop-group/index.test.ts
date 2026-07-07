import { calculateVoltageDropGroup } from "./index.js";

describe("calculateVoltageDropGroup", () => {
  it("normalizes legacy linear segments into a root-to-chain tree", () => {
    const result = calculateVoltageDropGroup({
      segments: [
        { title: "Root", localPowerKW: 3, lengthM: 30 },
        { title: "Tail", localPowerKW: 1, lengthM: 20 },
      ],
      settings: {
        limitPercent: 10,
        phaseMode: "three-phase",
      },
    });

    expect(result.value.segments).toHaveLength(2);
    expect(result.value.segments[0]?.flowPowerKW).toBeCloseTo(4, 12);
    expect(result.value.segments[1]?.flowPowerKW).toBeCloseTo(1, 12);
    expect(result.value.segments[1]?.cumulativeDeltaVPercent).toBeGreaterThan(
      result.value.segments[0]!.cumulativeDeltaVPercent,
    );
  });

  it("accepts explicit tree topology and keeps sibling drops independent by path", () => {
    const result = calculateVoltageDropGroup({
      segments: [
        {
          id: "main",
          parentId: null,
          title: "Main",
          loadPowerKW: 0,
          localPowerKW: 0,
          lengthM: 10,
          fixedSectionKey: "95",
        },
        {
          id: "a",
          parentId: "main",
          title: "A",
          loadPowerKW: 8,
          localPowerKW: 8,
          lengthM: 20,
          fixedSectionKey: "95",
        },
        {
          id: "b",
          parentId: "main",
          title: "B",
          loadPowerKW: 3,
          localPowerKW: 3,
          lengthM: 20,
          fixedSectionKey: "95",
        },
      ],
      settings: { limitPercent: 20, phaseMode: "three-phase" },
    } as unknown as Parameters<typeof calculateVoltageDropGroup>[0]);

    const main = result.value.segments.find((segment) => segment.id === "main")!;
    const a = result.value.segments.find((segment) => segment.id === "a")!;
    const b = result.value.segments.find((segment) => segment.id === "b")!;

    expect(main.flowPowerKW).toBeCloseTo(11, 12);
    expect(a.flowPowerKW).toBeCloseTo(8, 12);
    expect(b.flowPowerKW).toBeCloseTo(3, 12);
    expect(a.cumulativeDeltaVPercent).toBeCloseTo(
      main.segmentDeltaVPercent + a.segmentDeltaVPercent,
      12,
    );
    expect(b.cumulativeDeltaVPercent).toBeCloseTo(
      main.segmentDeltaVPercent + b.segmentDeltaVPercent,
      12,
    );
  });

  it("defaults to three phase and keeps legacy compatibility fields", () => {
    const result = calculateVoltageDropGroup({
      segments: [{ title: "Segment 1", localPowerKW: 1, lengthM: 10 }],
    });

    expect(result.value.settings.phaseMode).toBe("three-phase");
    expect(result.value.settings.systemType).toBe("three-phase-ac-ll");
    expect(result.value.settings.baseVoltageV).toBe(400);
    expect(result.value.segments[0]?.selectedSectionMm2).toBeGreaterThan(0);
    expect(Array.isArray(result.value.optimizationSteps)).toBe(true);
  });

  it("rejects empty and invalid segment inputs", () => {
    expect(() => calculateVoltageDropGroup({ segments: [] })).toThrow(
      "segments must contain at least one segment.",
    );
    expect(() =>
      calculateVoltageDropGroup({ segments: [{ title: "S1", localPowerKW: -1, lengthM: 10 }] }),
    ).toThrow("segments[0].loadPowerKW/localPowerKW must be zero or positive.");
    expect(() =>
      calculateVoltageDropGroup({ segments: [{ title: "S1", localPowerKW: 1, lengthM: 0 }] }),
    ).toThrow("segments[0].lengthM must be positive.");
  });

  it("propagates the exact tree no-solution voltage-drop error through the group wrapper", () => {
    expect(() =>
      calculateVoltageDropGroup({
        segments: [{ title: "Main", localPowerKW: 10, lengthM: 5000 }],
        settings: {
          phaseMode: "three-phase",
          limitPercent: 0.01,
          conductorMaterial: "copper",
          installationMethod: "D",
          efficiencyPercent: 100,
          cosPhi: 0.8,
        },
      }),
    ).toThrow(
      new RangeError("No cable cross-section satisfies the voltage-drop limit for this tree."),
    );
  });

  it("rejects unknown installationMethod codes instead of coercing", () => {
    expect(() =>
      calculateVoltageDropGroup({
        segments: [{ title: "Main", localPowerKW: 5, lengthM: 50 }],
        settings: {
          phaseMode: "three-phase",
          installationMethod: "Z9",
        },
      } as unknown as Parameters<typeof calculateVoltageDropGroup>[0]),
    ).toThrow(new RangeError("unknown installationMethod: Z9"));
  });

  it("rejects mixed explicit topology when non-root parentId is missing", () => {
    expect(() =>
      calculateVoltageDropGroup({
        segments: [
          {
            id: "root",
            parentId: null,
            title: "Root",
            loadPowerKW: 2,
            localPowerKW: 2,
            lengthM: 20,
          },
          {
            id: "child",
            title: "Child",
            loadPowerKW: 1,
            localPowerKW: 1,
            lengthM: 10,
          },
        ],
      } as unknown as Parameters<typeof calculateVoltageDropGroup>[0]),
    ).toThrow(
      new RangeError("segments[1].parentId is required when explicit tree topology is used."),
    );
  });
});
