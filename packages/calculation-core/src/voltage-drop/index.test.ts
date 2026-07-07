import {
  SQRT3,
  X_AC_FALLBACK_OHM_PER_KM,
} from "../common/constants/index.js";
import {
  calcDCTwoConductorVoltageDrop,
  calcR20,
  calcRTheta,
  calcSinPhi,
  calcSinglePhaseACTwoConductorVoltageDrop,
  calcThreePhaseACLineLineVoltageDrop,
  calcThreePhaseACLineNeutralVoltageDrop,
  calculateCurrentFromPower,
  calculateVoltageDrop,
} from "./index.js";

describe("voltage-drop locked formulas", () => {
  it("computes the single-phase AC two-conductor formula exactly", () => {
    const sinPhi = calcSinPhi(0.8);
    expect(
      calcSinglePhaseACTwoConductorVoltageDrop(25, 60, 1.1, 0.08, 0.8, sinPhi),
    ).toBeCloseTo(2 * 25 * (60 / 1000) * (1.1 * 0.8 + 0.08 * sinPhi), 12);
  });

  it("computes the DC two-conductor formula exactly", () => {
    expect(calcDCTwoConductorVoltageDrop(40, 35, 1.5)).toBeCloseTo(
      2 * 40 * (35 / 1000) * 1.5,
      12,
    );
  });

  it("computes the three-phase AC LL formula exactly", () => {
    const sinPhi = calcSinPhi(0.85);
    expect(
      calcThreePhaseACLineLineVoltageDrop(55, 120, 0.72, 0.08, 0.85, sinPhi),
    ).toBeCloseTo(
      SQRT3 * 55 * (120 / 1000) * (0.72 * 0.85 + 0.08 * sinPhi),
      12,
    );
  });

  it("computes the three-phase AC LN formula exactly", () => {
    const sinPhi = calcSinPhi(0.85);
    expect(
      calcThreePhaseACLineNeutralVoltageDrop(55, 120, 0.72, 0.08, 0.85, sinPhi),
    ).toBeCloseTo(55 * (120 / 1000) * (0.72 * 0.85 + 0.08 * sinPhi), 12);
  });
});

describe("voltage-drop helpers", () => {
  it("computes resistance at 20 C and corrected resistance at theta", () => {
    const r20 = calcR20(0.01724, 10);
    expect(r20).toBeCloseTo(1.724, 12);
    expect(calcRTheta(r20, 0.00393, 70)).toBeCloseTo(r20 * (1 + 0.00393 * 50), 12);
  });

  it("guards sinPhi against small floating point negatives", () => {
    expect(calcSinPhi(1)).toBe(0);
    expect(calcSinPhi(1.0000000000000002)).toBe(0);
  });

  it("converts power mode to current with locked system-specific adapters", () => {
    expect(calculateCurrentFromPower("dc-two-conductor", 4.8, 240)).toBeCloseTo(20, 12);
    expect(
      calculateCurrentFromPower("single-phase-ac-two-conductor", 4.8, 240, 0.8),
    ).toBeCloseTo(25, 12);
    expect(calculateCurrentFromPower("three-phase-ac-ll", 15, 400, 0.9)).toBeCloseTo(
      (1000 * 15) / (SQRT3 * 400 * 0.9),
      12,
    );
    expect(
      calculateCurrentFromPower("three-phase-ac-ln", 15, 400 / SQRT3, 0.9),
    ).toBeCloseTo((1000 * 15) / (3 * (400 / SQRT3) * 0.9), 12);
  });
});

describe("calculateVoltageDrop", () => {
  it("uses X = 0 in simplified mode", () => {
    const result = calculateVoltageDrop({
      mode: "current",
      systemType: "single-phase-ac-two-conductor",
      impedanceMode: "simplified",
      conductorMaterial: "copper",
      lengthM: 50,
      sectionMm2: 16,
      baseVoltageV: 230,
      currentA: 30,
      cosPhi: 0.8,
      reactanceOhmPerKm: 0.3,
    });

    expect(result.assumptions).toEqual([]);
    expect(result.value.reactanceOhmPerKm).toBe(0);
    expect(result.value.deltaVVolts).toBeCloseTo(
      2 * 30 * (50 / 1000) * (calcR20(0.01724, 16) * 0.8),
      12,
    );
  });

  it("falls back to the AC reactance constant and records an estimated assumption", () => {
    const result = calculateVoltageDrop({
      mode: "current",
      systemType: "three-phase-ac-ll",
      impedanceMode: "exact-ac",
      conductorMaterial: "copper",
      lengthM: 80,
      sectionMm2: 25,
      baseVoltageV: 400,
      currentA: 45,
      cosPhi: 0.88,
    });

    expect(result.assumptions).toEqual([
      {
        field: "reactanceOhmPerKm",
        usedValue: X_AC_FALLBACK_OHM_PER_KM,
        source: "estimated",
      },
    ]);
    expect(result.value.reactanceOhmPerKm).toBe(X_AC_FALLBACK_OHM_PER_KM);
  });

  it("divides resistance and reactance by the number of parallel conductors", () => {
    const single = calculateVoltageDrop({
      mode: "current",
      systemType: "three-phase-ac-ll",
      impedanceMode: "exact-ac",
      conductorMaterial: "aluminum",
      lengthM: 100,
      sectionMm2: 50,
      baseVoltageV: 400,
      currentA: 120,
      cosPhi: 0.9,
      reactanceOhmPerKm: 0.09,
      parallelConductors: 1,
    });
    const parallel = calculateVoltageDrop({
      mode: "current",
      systemType: "three-phase-ac-ll",
      impedanceMode: "exact-ac",
      conductorMaterial: "aluminum",
      lengthM: 100,
      sectionMm2: 50,
      baseVoltageV: 400,
      currentA: 120,
      cosPhi: 0.9,
      reactanceOhmPerKm: 0.09,
      parallelConductors: 2,
    });

    expect(parallel.value.resistanceOhmPerKm).toBeCloseTo(
      single.value.resistanceOhmPerKm / 2,
      12,
    );
    expect(parallel.value.reactanceOhmPerKm).toBeCloseTo(
      single.value.reactanceOhmPerKm / 2,
      12,
    );
    expect(parallel.value.deltaVVolts).toBeCloseTo(single.value.deltaVVolts / 2, 12);
  });

  it("applies temperature correction only when conductorTempC is provided", () => {
    const withoutTemp = calculateVoltageDrop({
      mode: "current",
      systemType: "dc-two-conductor",
      impedanceMode: "simplified",
      conductorMaterial: "copper",
      lengthM: 40,
      sectionMm2: 10,
      baseVoltageV: 110,
      currentA: 50,
    });
    const withTemp = calculateVoltageDrop({
      mode: "current",
      systemType: "dc-two-conductor",
      impedanceMode: "simplified",
      conductorMaterial: "copper",
      lengthM: 40,
      sectionMm2: 10,
      baseVoltageV: 110,
      currentA: 50,
      conductorTempC: 70,
    });

    expect(withoutTemp.value.resistanceOhmPerKm).toBeCloseTo(withoutTemp.value.resistance20OhmPerKm, 12);
    expect(withTemp.value.resistanceOhmPerKm).toBeGreaterThan(withTemp.value.resistance20OhmPerKm);
  });

  it("supports power mode through the current adapter", () => {
    const result = calculateVoltageDrop({
      mode: "power",
      systemType: "single-phase-ac-two-conductor",
      impedanceMode: "simplified",
      conductorMaterial: "copper",
      lengthM: 25,
      sectionMm2: 6,
      baseVoltageV: 230,
      powerKW: 4.6,
      cosPhi: 0.8,
    });

    expect(result.value.currentA).toBeCloseTo(25, 12);
  });

  it("accepts cosPhi = 1 for AC systems", () => {
    const result = calculateVoltageDrop({
      mode: "current",
      systemType: "single-phase-ac-two-conductor",
      impedanceMode: "exact-ac",
      conductorMaterial: "copper",
      lengthM: 20,
      sectionMm2: 6,
      baseVoltageV: 230,
      currentA: 16,
      cosPhi: 1,
      reactanceOhmPerKm: 0.08,
    });

    expect(result.value.cosPhi).toBe(1);
    expect(result.value.sinPhi).toBe(0);
  });

  it("rejects cosPhi <= 0 for AC systems", () => {
    expect(() =>
      calculateVoltageDrop({
        mode: "current",
        systemType: "single-phase-ac-two-conductor",
        impedanceMode: "exact-ac",
        conductorMaterial: "copper",
        lengthM: 20,
        sectionMm2: 6,
        baseVoltageV: 230,
        currentA: 16,
        cosPhi: 0,
        reactanceOhmPerKm: 0.08,
      }),
    ).toThrow("cosPhi must be greater than 0 and at most 1 for AC voltage-drop calculations.");
  });

  it("keeps three-phase LL and LN invariant when V_LL = sqrt(3) * V_LN", () => {
    const common = {
      mode: "current" as const,
      impedanceMode: "exact-ac" as const,
      conductorMaterial: "copper" as const,
      lengthM: 120,
      sectionMm2: 35,
      currentA: 95,
      cosPhi: 0.87,
      reactanceOhmPerKm: 0.08,
    };
    const ll = calculateVoltageDrop({
      ...common,
      systemType: "three-phase-ac-ll",
      baseVoltageV: 400,
    });
    const ln = calculateVoltageDrop({
      ...common,
      systemType: "three-phase-ac-ln",
      baseVoltageV: 400 / SQRT3,
    });

    expect(ln.value.deltaVVolts).toBeCloseTo(ll.value.deltaVVolts / SQRT3, 12);
    expect(ln.value.deltaVPercent).toBeCloseTo(ll.value.deltaVPercent, 12);
  });
});

describe("voltage-drop property-style invariants", () => {
  const baseInput = {
    mode: "current" as const,
    systemType: "three-phase-ac-ll" as const,
    impedanceMode: "exact-ac" as const,
    conductorMaterial: "copper" as const,
    baseVoltageV: 400,
    cosPhi: 0.9,
    reactanceOhmPerKm: 0.08,
  };

  it("is monotone decreasing in section S", () => {
    const sections = [10, 16, 25, 35, 50, 70];
    let previous: number | undefined;

    for (const sectionMm2 of sections) {
      const deltaVVolts = calculateVoltageDrop({
        ...baseInput,
        currentA: 80,
        lengthM: 120,
        sectionMm2,
      }).value.deltaVVolts;

      if (previous !== undefined) {
        expect(deltaVVolts).toBeLessThan(previous);
      }

      previous = deltaVVolts;
    }
  });

  it("is monotone increasing in length L", () => {
    const lengths = [10, 25, 50, 90, 140];
    let previous = 0;

    for (const lengthM of lengths) {
      const deltaVVolts = calculateVoltageDrop({
        ...baseInput,
        currentA: 80,
        lengthM,
        sectionMm2: 25,
      }).value.deltaVVolts;

      expect(deltaVVolts).toBeGreaterThan(previous);
      previous = deltaVVolts;
    }
  });

  it("is monotone increasing in current I", () => {
    const currents = [15, 30, 55, 80, 120];
    let previous = 0;

    for (const currentA of currents) {
      const deltaVVolts = calculateVoltageDrop({
        ...baseInput,
        currentA,
        lengthM: 100,
        sectionMm2: 25,
      }).value.deltaVVolts;

      expect(deltaVVolts).toBeGreaterThan(previous);
      previous = deltaVVolts;
    }
  });
});
