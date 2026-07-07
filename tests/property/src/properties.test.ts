import * as fc from "fast-check";
import { describe, it, expect } from "vitest";
import {
  calculateVoltageDrop,
  calculateCableSizing,
  calcThreePhaseACLineLineVoltageDrop,
  calcThreePhaseACLineNeutralVoltageDrop,
  calcSinPhi,
  calcR20,
  calcRTheta,
  RHO_COPPER_20,
  ALPHA_COPPER_20,
  SQRT3,
} from "@elektroplan/calculation-core";
import { getStandardCrossSections } from "@elektroplan/calculation-data";

// ─── Shared arbitraries ───────────────────────────────────────────────────────

const STANDARD_SECTIONS = [
  1.5, 2.5, 4, 6, 10, 16, 25, 35, 50, 70, 95, 120,
] as const;

const sectionArb = fc.oneof(
  ...STANDARD_SECTIONS.map((s) => fc.constant(s)),
);

const lengthArb = fc.float({ min: Math.fround(1), max: Math.fround(5000), noNaN: true, noDefaultInfinity: true });
const currentArb = fc.float({ min: Math.fround(0.1), max: Math.fround(2000), noNaN: true, noDefaultInfinity: true });
const voltageArb = fc.float({ min: Math.fround(100), max: Math.fround(1000), noNaN: true, noDefaultInfinity: true });
const cosPhiArb = fc.float({ min: Math.fround(0.5), max: Math.fround(1.0), noNaN: true, noDefaultInfinity: true });

function makeVdInput(
  sectionMm2: number,
  lengthM: number,
  currentA: number,
  baseVoltageV: number,
  cosPhi: number,
) {
  return {
    systemType: "single-phase-ac-two-conductor" as const,
    impedanceMode: "simplified" as const,
    mode: "current" as const,
    conductorMaterial: "copper" as const,
    sectionMm2,
    lengthM,
    currentA,
    baseVoltageV,
    cosPhi,
  };
}

// ─── 1. VD monotonicity in section size ───────────────────────────────────────

describe("VD monotonicity in section size", () => {
  it("∀ S1 < S2 ⇒ VD(S1) ≥ VD(S2)", () => {
    fc.assert(
      fc.property(
        fc.tuple(sectionArb, sectionArb).filter(([a, b]) => a < b),
        lengthArb,
        currentArb,
        voltageArb,
        cosPhiArb,
        ([s1, s2], length, current, voltage, cosPhi) => {
          const vd1 = calculateVoltageDrop(
            makeVdInput(s1, length, current, voltage, cosPhi),
          ).value.deltaVVolts;
          const vd2 = calculateVoltageDrop(
            makeVdInput(s2, length, current, voltage, cosPhi),
          ).value.deltaVVolts;
          expect(vd1).toBeGreaterThanOrEqual(vd2 - 1e-9);
        },
      ),
      { numRuns: 1000 },
    );
  });
});

// ─── 2. VD monotonicity in current ────────────────────────────────────────────

describe("VD monotonicity in current", () => {
  it("∀ I1 < I2 ⇒ VD(I1) ≤ VD(I2)", () => {
    fc.assert(
      fc.property(
        fc.tuple(currentArb, currentArb).filter(([a, b]) => a < b),
        sectionArb,
        lengthArb,
        voltageArb,
        cosPhiArb,
        ([i1, i2], section, length, voltage, cosPhi) => {
          const vd1 = calculateVoltageDrop(
            makeVdInput(section, length, i1, voltage, cosPhi),
          ).value.deltaVVolts;
          const vd2 = calculateVoltageDrop(
            makeVdInput(section, length, i2, voltage, cosPhi),
          ).value.deltaVVolts;
          expect(vd1).toBeLessThanOrEqual(vd2 + 1e-9);
        },
      ),
      { numRuns: 1000 },
    );
  });
});

// ─── 3. VD determinism ────────────────────────────────────────────────────────

describe("VD determinism", () => {
  it("calculate(x) === calculate(x)", () => {
    fc.assert(
      fc.property(
        sectionArb,
        lengthArb,
        currentArb,
        voltageArb,
        cosPhiArb,
        (section, length, current, voltage, cosPhi) => {
          const input = makeVdInput(section, length, current, voltage, cosPhi);
          const r1 = calculateVoltageDrop(input).value.deltaVVolts;
          const r2 = calculateVoltageDrop(input).value.deltaVVolts;
          expect(r1).toBe(r2);
        },
      ),
      { numRuns: 1000 },
    );
  });
});

// ─── 4. Balanced 3-phase invariant: ΔV_LN = ΔV_LL / √3 ─────────────────────

describe("Balanced 3-phase invariant", () => {
  it("∀ valid 3ph input ⇒ ΔV_LN = ΔV_LL / √3", () => {
    fc.assert(
      fc.property(
        currentArb,
        lengthArb,
        sectionArb,
        cosPhiArb,
        (currentA, lengthM, sectionMm2, cosPhi) => {
          const sinPhi = calcSinPhi(cosPhi);
          const r20 = calcR20(RHO_COPPER_20, sectionMm2);
          // simplified: X = 0
          const reactance = 0;

          const deltaVLL = calcThreePhaseACLineLineVoltageDrop(
            currentA,
            lengthM,
            r20,
            reactance,
            cosPhi,
            sinPhi,
          );
          const deltaVLN = calcThreePhaseACLineNeutralVoltageDrop(
            currentA,
            lengthM,
            r20,
            reactance,
            cosPhi,
            sinPhi,
          );

          // ΔV_LL = √3 · ΔV_LN
          expect(Math.abs(deltaVLN * SQRT3 - deltaVLL)).toBeLessThan(1e-9);
        },
      ),
      { numRuns: 1000 },
    );
  });
});

// ─── 8. VD length monotonicity ────────────────────────────────────────────────
// (listed as #8 in spec; implemented here before cable tests for logical grouping)

describe("VD length monotonicity", () => {
  it("∀ L1 < L2 ⇒ VD(L1) ≤ VD(L2)", () => {
    fc.assert(
      fc.property(
        fc.tuple(lengthArb, lengthArb).filter(([a, b]) => a < b),
        sectionArb,
        currentArb,
        voltageArb,
        cosPhiArb,
        ([l1, l2], section, current, voltage, cosPhi) => {
          const vd1 = calculateVoltageDrop(
            makeVdInput(section, l1, current, voltage, cosPhi),
          ).value.deltaVVolts;
          const vd2 = calculateVoltageDrop(
            makeVdInput(section, l2, current, voltage, cosPhi),
          ).value.deltaVVolts;
          expect(vd1).toBeLessThanOrEqual(vd2 + 1e-9);
        },
      ),
      { numRuns: 1000 },
    );
  });
});

// ─── Cable test helpers ───────────────────────────────────────────────────────

function makeBaseCableInput(
  designCurrentA: number,
  ambientTemperatureC: number,
  extraCorrectionFactor?: number,
) {
  return {
    designCurrentA,
    phase: 3 as const,
    conductorMaterial: "copper" as const,
    installationMethod: "C" as const,
    insulationRating: "XLPE_EPR_90C" as const,
    ambientTemperatureC,
    groupedCircuits: 1,
    thirdHarmonicPercent: 0,
    voltageDropLimitPercent: 5,
    voltageDrop: {
      systemType: "three-phase-ac-ll" as const,
      impedanceMode: "simplified" as const,
      baseVoltageV: 400,
      lengthM: 20,
      cosPhi: 0.9,
    },
    ...(extraCorrectionFactor !== undefined ? { extraCorrectionFactor } : {}),
  };
}

// ─── 5. Cable monotonicity in Ib ─────────────────────────────────────────────

describe("Cable monotonicity in Ib", () => {
  it("∀ Ib1 < Ib2 ⇒ selectedSection(Ib1) ≤ selectedSection(Ib2)", () => {
    fc.assert(
      fc.property(
        fc
          .tuple(
            fc.float({ min: Math.fround(1), max: Math.fround(200), noNaN: true, noDefaultInfinity: true }),
            fc.float({ min: Math.fround(1), max: Math.fround(200), noNaN: true, noDefaultInfinity: true }),
          )
          .filter(([a, b]) => a < b),
        ([ib1, ib2]) => {
          let result1: number;
          let result2: number;

          try {
            result1 = calculateCableSizing(makeBaseCableInput(ib1, 30)).value
              .selectedSectionMm2;
          } catch {
            // No section satisfies constraints — not a property violation
            return;
          }

          try {
            result2 = calculateCableSizing(makeBaseCableInput(ib2, 30)).value
              .selectedSectionMm2;
          } catch {
            // ib2 > ib1 might not converge when ib1 did — that's fine
            return;
          }

          expect(result1).toBeLessThanOrEqual(result2);
        },
      ),
      { numRuns: 1000 },
    );
  });
});

// ─── 6. Cable monotonicity in kTotal (via ambientTemperatureC) ───────────────

describe("Cable monotonicity in kTotal", () => {
  it("higher ambient temperature (worse kTotal) requires ≥ cable section", () => {
    fc.assert(
      fc.property(
        // temp1 < temp2 → kT1 > kT2 → kTotal1 > kTotal2 → section1 ≤ section2
        fc
          .tuple(
            fc.float({ min: Math.fround(25), max: Math.fround(55), noNaN: true, noDefaultInfinity: true }),
            fc.float({ min: Math.fround(25), max: Math.fround(55), noNaN: true, noDefaultInfinity: true }),
          )
          .filter(([a, b]) => Math.abs(a - b) > 0.01),
        fc.float({ min: Math.fround(10), max: Math.fround(100), noNaN: true, noDefaultInfinity: true }),
        ([t1Raw, t2Raw], ib) => {
          // Ensure t1 < t2 (better → worse ambient)
          const [t1, t2] = t1Raw < t2Raw ? [t1Raw, t2Raw] : [t2Raw, t1Raw];

          let section1: number;
          let section2: number;

          try {
            section1 = calculateCableSizing(makeBaseCableInput(ib, t1)).value
              .selectedSectionMm2;
          } catch {
            return;
          }

          try {
            section2 = calculateCableSizing(makeBaseCableInput(ib, t2)).value
              .selectedSectionMm2;
          } catch {
            // Higher temp may not converge while lower temp did — valid
            return;
          }

          // t2 > t1 → worse kTotal → needs bigger or equal section
          expect(section1).toBeLessThanOrEqual(section2);
        },
      ),
      { numRuns: 1000 },
    );
  });
});

// ─── 7. Cable never-return-J (result in standard cross-sections) ──────────────

describe("Cable result always a standard cross-section", () => {
  it("∀ valid cable input ⇒ selectedSectionMm2 ∈ standard cross-sections", () => {
    const standardSections = getStandardCrossSections("copper");

    fc.assert(
      fc.property(
        fc.float({ min: Math.fround(1), max: Math.fround(150), noNaN: true, noDefaultInfinity: true }),
        fc.float({ min: Math.fround(25), max: Math.fround(50), noNaN: true, noDefaultInfinity: true }),
        (ib, ambientTemp) => {
          let selectedSection: number;

          try {
            selectedSection = calculateCableSizing(
              makeBaseCableInput(ib, ambientTemp),
            ).value.selectedSectionMm2;
          } catch {
            return;
          }

          expect(standardSections).toContain(selectedSection);
        },
      ),
      { numRuns: 1000 },
    );
  });
});
