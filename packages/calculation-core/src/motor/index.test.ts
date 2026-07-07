import { getMotorTableEntries } from "@elektroplan/calculation-data";

import { SQRT3 } from "../common/constants/index.js";
import {
  calculateMotorCurrent,
  calcApparentPower,
  calcInputPower,
} from "./index.js";
import { selectCableSectionFromRuler } from "../cable/ruler.js";

describe("calculateMotorCurrent formula mode", () => {
  it("computes single-phase motor current from the locked formula", () => {
    const result = calculateMotorCurrent({
      mode: "formula",
      phase: 1,
      P_out: 2.2,
      voltage: 220,
      cosPhi: 0.84,
      efficiencyPercent: 81,
    });

    expect(result.formulaVariant).toBe("single-phase");
    expect(result.value).toMatchObject({
      mode: "formula",
      phase: 1,
      P_out: 2.2,
      voltage: 220,
      cosPhi: 0.84,
      efficiencyPercent: 81,
    });
    if (result.value.mode !== "formula") {
      throw new Error("Expected formula mode output.");
    }

    expect(result.value.currentA).toBeCloseTo((1000 * 2.2) / (220 * 0.81 * 0.84), 12);
    expect(result.value.inputPowerKW).toBeCloseTo(calcInputPower(2.2, 0.81), 12);
    expect(result.value.apparentPowerKVA).toBeCloseTo(
      calcApparentPower(calcInputPower(2.2, 0.81), 0.84),
      12,
    );
  });

  it("computes three-phase LL motor current from the locked formula", () => {
    const result = calculateMotorCurrent({
      mode: "formula",
      phase: 3,
      voltageMode: "LL",
      P_out: 15,
      voltage: 380,
      cosPhi: 0.86,
      efficiencyPercent: 87,
    });

    expect(result.formulaVariant).toBe("three-phase-LL");
    expect(result.value.currentA).toBeCloseTo(
      (1000 * 15) / (SQRT3 * 380 * 0.87 * 0.86),
      12,
    );
  });

  it("computes three-phase LN motor current from the locked formula", () => {
    const result = calculateMotorCurrent({
      mode: "formula",
      phase: 3,
      voltageMode: "LN",
      P_out: 15,
      voltage: 380 / SQRT3,
      cosPhi: 0.86,
      efficiencyPercent: 87,
    });

    expect(result.formulaVariant).toBe("three-phase-LN");
    expect(result.value.currentA).toBeCloseTo(
      (1000 * 15) / (3 * (380 / SQRT3) * 0.87 * 0.86),
      12,
    );
  });

  it("keeps LL and LN voltage paths equivalent when V_LL = sqrt(3) * V_LN", () => {
    const llResult = calculateMotorCurrent({
      mode: "formula",
      phase: 3,
      voltageMode: "LL",
      P_out: 30,
      voltage: 400,
      cosPhi: 0.89,
      efficiencyPercent: 91,
    });
    const lnResult = calculateMotorCurrent({
      mode: "formula",
      phase: 3,
      voltageMode: "LN",
      P_out: 30,
      voltage: 400 / SQRT3,
      cosPhi: 0.89,
      efficiencyPercent: 91,
    });

    expect(llResult.value.currentA).toBeCloseTo(lnResult.value.currentA, 12);
  });

  it.each([
    {
      label: "missing P_out",
      input: {
        mode: "formula" as const,
        phase: 1 as const,
        voltage: 220,
        cosPhi: 0.8,
        efficiencyPercent: 75,
      },
      message: "P_out is required in formula mode.",
    },
    {
      label: "missing voltage",
      input: {
        mode: "formula" as const,
        phase: 1 as const,
        P_out: 1.1,
        cosPhi: 0.8,
        efficiencyPercent: 75,
      },
      message: "voltage is required in formula mode.",
    },
    {
      label: "missing cosPhi",
      input: {
        mode: "formula" as const,
        phase: 1 as const,
        P_out: 1.1,
        voltage: 220,
        efficiencyPercent: 75,
      },
      message: "cosPhi is required in formula mode.",
    },
    {
      label: "missing efficiencyPercent",
      input: {
        mode: "formula" as const,
        phase: 1 as const,
        P_out: 1.1,
        voltage: 220,
        cosPhi: 0.8,
      },
      message: "efficiencyPercent is required in formula mode.",
    },
    {
      label: "phase 3 without voltageMode",
      input: {
        mode: "formula" as const,
        phase: 3 as const,
        P_out: 7.5,
        voltage: 380,
        cosPhi: 0.86,
        efficiencyPercent: 85,
      },
      message: "voltageMode is required when phase is 3.",
    },
    {
      label: "non-positive P_out",
      input: {
        mode: "formula" as const,
        phase: 1 as const,
        P_out: 0,
        voltage: 220,
        cosPhi: 0.8,
        efficiencyPercent: 75,
      },
      message: "P_out must be a positive number.",
    },
    {
      label: "cosPhi above 1",
      input: {
        mode: "formula" as const,
        phase: 1 as const,
        P_out: 1.1,
        voltage: 220,
        cosPhi: 1.01,
        efficiencyPercent: 75,
      },
      message: "cosPhi must be between 0 and 1.",
    },
    {
      label: "fractional efficiency percent",
      input: {
        mode: "formula" as const,
        phase: 1 as const,
        P_out: 1.1,
        voltage: 220,
        cosPhi: 0.8,
        efficiencyPercent: 0.85,
      },
      message: "efficiencyPercent must be between 1 and 100.",
    },
    {
      label: "efficiencyPercent above 100",
      input: {
        mode: "formula" as const,
        phase: 1 as const,
        P_out: 1.1,
        voltage: 220,
        cosPhi: 0.8,
        efficiencyPercent: 101,
      },
      message: "efficiencyPercent must be between 1 and 100.",
    },
  ])("rejects $label under the mandatory-input policy", ({ input, message }) => {
    expect(() => calculateMotorCurrent(input)).toThrow(message);
  });
});

describe("calculateMotorCurrent table mode", () => {
  it("returns exact table values for all motor rows and available voltages", () => {
    for (const entry of getMotorTableEntries()) {
      const result220 = calculateMotorCurrent({
        mode: "table",
        kW: entry.kW,
        voltage: 220,
      });

      expect(result220.formulaVariant).toBe("table-mode-220V");
      expect(result220.assumptions).toEqual([
        {
          field: "source",
          usedValue: "table",
          source: "estimated",
        },
      ]);
      expect(result220.value).toEqual({
        mode: "table",
        kW: entry.kW,
        PS: entry.PS,
        cosPhi: entry.cosPhi,
        efficiencyPercent: entry.efficiencyPercent,
        currentA: entry.currentA_220V,
        cableSpec: entry.cableSpec,
      });

      if (entry.currentA_380V !== null) {
        const result380 = calculateMotorCurrent({
          mode: "table",
          kW: entry.kW,
          voltage: 380,
        });

        expect(result380.formulaVariant).toBe("table-mode-380V");
        expect(result380.value).toEqual({
          mode: "table",
          kW: entry.kW,
          PS: entry.PS,
          cosPhi: entry.cosPhi,
          efficiencyPercent: entry.efficiencyPercent,
          currentA: entry.currentA_380V,
          cableSpec: entry.cableSpec,
        });
      }
    }
  });

  it("rejects 380 V for rows where the table value is null", () => {
    const entriesWithout380 = getMotorTableEntries().filter(
      (entry) => entry.currentA_380V === null,
    );

    expect(entriesWithout380).toHaveLength(3);

    for (const entry of entriesWithout380) {
      expect(() =>
        calculateMotorCurrent({
          mode: "table",
          kW: entry.kW,
          voltage: 380,
        }),
      ).toThrow(`Motor table row ${entry.kW} kW does not provide a 380 V current.`);
    }
  });

  it("rejects kW values that do not exactly exist in the table", () => {
    expect(() =>
      calculateMotorCurrent({
        mode: "table",
        kW: 0.5,
        voltage: 220,
      }),
    ).toThrow("No exact motor table row found for 0.5 kW.");
  });
});

describe("calculateMotorCurrent formula suggestion", () => {
  it("suggests 1.5 mm2 in air for a roughly 15.8 A three-phase motor", () => {
    const result = calculateMotorCurrent({
      mode: "formula",
      phase: 3,
      P_out: 7.5,
      voltage: 380,
      cosPhi: 0.85,
      efficiencyPercent: 85,
      voltageMode: "LL",
    });

    expect(result.value.mode).toBe("formula");
    if (result.value.mode !== "formula") {
      throw new Error("Expected formula mode output.");
    }

    expect(result.value.suggestedCableSection).toEqual({
      sectionMm2: 1.5,
      label: "1,5",
      ambient: "hava_30C",
      ampacityA: 24,
      standardHintMm2: 2.5,
    });
  });

  it("adds 2.5 hint when currentA < 25 and ruler section <= 4", () => {
    const result = calculateMotorCurrent({
      mode: "formula",
      phase: 3,
      P_out: 0.55,
      voltage: 380,
      cosPhi: 0.75,
      efficiencyPercent: 70,
      voltageMode: "LL",
    });

    expect(result.value.mode).toBe("formula");
    if (result.value.mode !== "formula") {
      throw new Error("Expected formula mode output.");
    }

    expect(result.value.suggestedCableSection?.standardHintMm2).toBe(2.5);
  });

  it("adds 4 hint when currentA >= 25 and ruler section <= 4", () => {
    const result = calculateMotorCurrent({
      mode: "formula",
      phase: 3,
      P_out: 15,
      voltage: 380,
      cosPhi: 0.85,
      efficiencyPercent: 90,
      voltageMode: "LL",
    });

    expect(result.value.mode).toBe("formula");
    if (result.value.mode !== "formula") {
      throw new Error("Expected formula mode output.");
    }

    expect(result.value.suggestedCableSection?.standardHintMm2).toBe(4);
  });

  it("omits hint when normal ruler section > 4", () => {
    const result = calculateMotorCurrent({
      mode: "formula",
      phase: 3,
      P_out: 185,
      voltage: 380,
      cosPhi: 0.85,
      efficiencyPercent: 92,
      voltageMode: "LL",
    });

    expect(result.value.mode).toBe("formula");
    if (result.value.mode !== "formula") {
      throw new Error("Expected formula mode output.");
    }

    expect(result.value.suggestedCableSection?.sectionMm2).toBeGreaterThan(4);
    expect(result.value.suggestedCableSection?.standardHintMm2).toBeUndefined();
  });

  it("omits suggestion when the formula current exceeds the ruler range", () => {
    const result = calculateMotorCurrent({
      mode: "formula",
      phase: 3,
      P_out: 600,
      voltage: 380,
      cosPhi: 0.85,
      efficiencyPercent: 85,
      voltageMode: "LL",
    });

    expect(result.value.mode).toBe("formula");
    if (result.value.mode !== "formula") {
      throw new Error("Expected formula mode output.");
    }

    expect(result.value.suggestedCableSection).toBeUndefined();
  });

  it("documents the direct selector overflow boundary", () => {
    expect(() =>
      selectCableSectionFromRuler({
        designCurrentA: 600,
        ambient: "hava_30C",
      }),
    ).toThrow();
  });
});
