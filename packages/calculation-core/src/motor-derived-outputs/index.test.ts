import { SQRT3 } from "../common/constants/index.js";
import {
  calcMotorApparentPower,
  calcMotorInputPower,
  calculateMotorDerivedOutputs,
} from "./index.js";

describe("calculateMotorDerivedOutputs", () => {
  it("computes synchronous speed and torque when poles are provided directly", () => {
    const result = calculateMotorDerivedOutputs({
      P_out: 2.2,
      phase: 1,
      voltage: 220,
      cosPhi: 0.84,
      efficiencyPercent: 81,
      polesOrRpm: 4,
      frequency: 50,
    });

    expect(result.formulaVariant).toBe("single-phase-poles");
    expect(result.assumptions).toEqual([]);
    expect(result.value.poles).toBe(4);
    expect(result.value.polesSource).toBe("user");
    expect(result.value.synchronousSpeedRpm).toBe(1500);
    expect(result.value.operatingSpeedRpm).toBeNull();
    expect(result.value.slipRatio).toBeNull();
    expect(result.value.slipPercent).toBeNull();
    expect(result.value.shaftTorqueNm).toBeNull();
    expect(result.value.currentA).toBeCloseTo((1000 * 2.2) / (220 * 0.81 * 0.84), 12);
    expect(result.value.inputPowerKW).toBeCloseTo(calcMotorInputPower(2.2, 81), 12);
    expect(result.value.apparentPowerKVA).toBeCloseTo(
      calcMotorApparentPower(calcMotorInputPower(2.2, 81), 0.84),
      12,
    );
    expect(result.value.synchronousTorqueNm).toBeCloseTo((9550 * 2.2) / 1500, 12);
  });

  it("infers pole count and slip when rated rpm is provided", () => {
    const result = calculateMotorDerivedOutputs({
      P_out: 15,
      phase: 3,
      voltage: 400,
      cosPhi: 0.86,
      efficiencyPercent: 87,
      polesOrRpm: 1450,
      frequency: 50,
    });

    expect(result.formulaVariant).toBe("three-phase-rpm");
    expect(result.assumptions).toEqual([
      {
        field: "poles",
        usedValue: 4,
        source: "estimated",
      },
    ]);
    expect(result.value.poles).toBe(4);
    expect(result.value.polesSource).toBe("estimated");
    expect(result.value.synchronousSpeedRpm).toBe(1500);
    expect(result.value.operatingSpeedRpm).toBe(1450);
    expect(result.value.slipRatio).toBeCloseTo((1500 - 1450) / 1500, 12);
    expect(result.value.slipPercent).toBeCloseTo(((1500 - 1450) / 1500) * 100, 12);
    expect(result.value.currentA).toBeCloseTo(
      (1000 * 15) / (SQRT3 * 400 * 0.87 * 0.86),
      12,
    );
    expect(result.value.shaftTorqueNm).toBeCloseTo((9550 * 15) / 1450, 12);
  });

  it.each([
    {
      label: "missing P_out",
      input: {
        phase: 1 as const,
        voltage: 220,
        cosPhi: 0.8,
        efficiencyPercent: 75,
        polesOrRpm: 4,
        frequency: 50,
      },
      message: "P_out is required.",
    },
    {
      label: "missing voltage",
      input: {
        P_out: 1.1,
        phase: 1 as const,
        cosPhi: 0.8,
        efficiencyPercent: 75,
        polesOrRpm: 4,
        frequency: 50,
      },
      message: "voltage is required.",
    },
    {
      label: "missing cosPhi",
      input: {
        P_out: 1.1,
        phase: 1 as const,
        voltage: 220,
        efficiencyPercent: 75,
        polesOrRpm: 4,
        frequency: 50,
      },
      message: "cosPhi is required.",
    },
    {
      label: "missing efficiencyPercent",
      input: {
        P_out: 1.1,
        phase: 1 as const,
        voltage: 220,
        cosPhi: 0.8,
        polesOrRpm: 4,
        frequency: 50,
      },
      message: "efficiencyPercent is required.",
    },
    {
      label: "missing polesOrRpm",
      input: {
        P_out: 1.1,
        phase: 1 as const,
        voltage: 220,
        cosPhi: 0.8,
        efficiencyPercent: 75,
        frequency: 50,
      },
      message: "polesOrRpm is required.",
    },
    {
      label: "missing frequency",
      input: {
        P_out: 1.1,
        phase: 1 as const,
        voltage: 220,
        cosPhi: 0.8,
        efficiencyPercent: 75,
        polesOrRpm: 4,
      },
      message: "frequency is required.",
    },
    {
      label: "invalid phase",
      input: {
        P_out: 1.1,
        phase: 2 as 1,
        voltage: 220,
        cosPhi: 0.8,
        efficiencyPercent: 75,
        polesOrRpm: 4,
        frequency: 50,
      },
      message: "phase must be one of: 1, 3.",
    },
    {
      label: "cosPhi above 1",
      input: {
        P_out: 1.1,
        phase: 1 as const,
        voltage: 220,
        cosPhi: 1.01,
        efficiencyPercent: 75,
        polesOrRpm: 4,
        frequency: 50,
      },
      message: "cosPhi must be between 0 and 1.",
    },
    {
      label: "ratio-like efficiencyPercent",
      input: {
        P_out: 1.1,
        phase: 1 as const,
        voltage: 220,
        cosPhi: 0.8,
        efficiencyPercent: 0.85,
        polesOrRpm: 4,
        frequency: 50,
      },
      message: "efficiencyPercent must be between 1 and 100.",
    },
    {
      label: "efficiencyPercent above 100",
      input: {
        P_out: 1.1,
        phase: 1 as const,
        voltage: 220,
        cosPhi: 0.8,
        efficiencyPercent: 101,
        polesOrRpm: 4,
        frequency: 50,
      },
      message: "efficiencyPercent must be between 1 and 100.",
    },
    {
      label: "unresolvable rpm",
      input: {
        P_out: 1.1,
        phase: 3 as const,
        voltage: 400,
        cosPhi: 0.8,
        efficiencyPercent: 75,
        polesOrRpm: 4000,
        frequency: 50,
      },
      message: "polesOrRpm=4000 cannot be resolved to a valid pole count at 50 Hz.",
    },
  ])("rejects $label under the mandatory-input policy", ({ input, message }) => {
    expect(() => calculateMotorDerivedOutputs(input)).toThrow(message);
  });
});
