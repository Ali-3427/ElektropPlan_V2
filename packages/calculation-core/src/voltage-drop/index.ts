import {
  ALPHA_ALUMINUM_20,
  ALPHA_COPPER_20,
  RHO_ALUMINUM_20,
  RHO_COPPER_20,
  X_AC_FALLBACK_OHM_PER_KM,
} from "../common/constants/index.js";
import type { AssumptionEntry } from "../common/types/result.js";
import { assertInRange, assertOneOf, assertPositive } from "../common/validation/guards.js";
import {
  calcDCTwoConductorVoltageDrop,
  calcSinglePhaseACTwoConductorVoltageDrop,
  calcThreePhaseACLineLineVoltageDrop,
  calcThreePhaseACLineNeutralVoltageDrop,
} from "./formulas.js";
import { deriveCurrentForVoltageDrop } from "./power-to-current.js";
import { calcR20, calcRTheta } from "./resistance.js";
import { calcSinPhi } from "./sinphi.js";
import { ENGINE_VERSION } from "../version.js";
import type {
  ConductorMaterial,
  VoltageDropInput,
  VoltageDropOutput,
  VoltageDropResult,
  VoltageDropSystemType,
} from "./types.js";
const DATA_VERSION = "voltage-drop-formula-v1";

const SYSTEM_TYPES: VoltageDropSystemType[] = [
  "single-phase-ac-two-conductor",
  "dc-two-conductor",
  "three-phase-ac-ll",
  "three-phase-ac-ln",
];

const IMPEDANCE_MODES = ["simplified", "exact-ac"] as const;
const LOAD_MODES = ["current", "power"] as const;
const CONDUCTOR_MATERIALS: ConductorMaterial[] = ["copper", "aluminum"];

function getConductorConstants(material: ConductorMaterial): {
  resistivityOhmMm2PerM: number;
  alpha20: number;
} {
  if (material === "copper") {
    return {
      resistivityOhmMm2PerM: RHO_COPPER_20,
      alpha20: ALPHA_COPPER_20,
    };
  }

  return {
    resistivityOhmMm2PerM: RHO_ALUMINUM_20,
    alpha20: ALPHA_ALUMINUM_20,
  };
}

function isACSystem(systemType: VoltageDropSystemType): boolean {
  return systemType !== "dc-two-conductor";
}

function requireACCosPhi(input: VoltageDropInput): number {
  if (input.cosPhi === undefined) {
    throw new RangeError("cosPhi is required for AC voltage-drop calculations.");
  }

  if (!Number.isFinite(input.cosPhi) || input.cosPhi <= 0 || input.cosPhi > 1) {
    throw new RangeError(
      "cosPhi must be greater than 0 and at most 1 for AC voltage-drop calculations.",
    );
  }

  return input.cosPhi;
}

function validateVoltageDropInput(input: VoltageDropInput): void {
  assertOneOf(input.systemType, SYSTEM_TYPES, "systemType");
  assertOneOf(input.impedanceMode, IMPEDANCE_MODES, "impedanceMode");
  assertOneOf(input.mode, LOAD_MODES, "mode");
  assertOneOf(input.conductorMaterial, CONDUCTOR_MATERIALS, "conductorMaterial");

  assertPositive(input.lengthM, "lengthM");
  assertPositive(input.sectionMm2, "sectionMm2");
  assertPositive(input.baseVoltageV, "baseVoltageV");

  if (input.parallelConductors !== undefined) {
    assertPositive(input.parallelConductors, "parallelConductors");
  }

  if (input.reactanceOhmPerKm !== undefined) {
    assertPositive(input.reactanceOhmPerKm, "reactanceOhmPerKm");
  }

  if (input.conductorTempC !== undefined && !Number.isFinite(input.conductorTempC)) {
    throw new RangeError("conductorTempC must be a finite number.");
  }

  if (input.mode === "current") {
    assertPositive(input.currentA, "currentA");
  } else {
    assertPositive(input.powerKW, "powerKW");
  }

  if (isACSystem(input.systemType)) {
    requireACCosPhi(input);
  }
}

function resolveReactance(input: VoltageDropInput): {
  reactanceOhmPerKm: number;
  assumptions: AssumptionEntry[];
} {
  if (!isACSystem(input.systemType) || input.impedanceMode === "simplified") {
    return {
      reactanceOhmPerKm: 0,
      assumptions: [],
    };
  }

  if (input.reactanceOhmPerKm !== undefined) {
    return {
      reactanceOhmPerKm: input.reactanceOhmPerKm,
      assumptions: [],
    };
  }

  return {
    reactanceOhmPerKm: X_AC_FALLBACK_OHM_PER_KM,
    assumptions: [
      {
        field: "reactanceOhmPerKm",
        usedValue: X_AC_FALLBACK_OHM_PER_KM,
        source: "estimated",
      },
    ],
  };
}

function calculateVoltageDropBySystem(
  systemType: VoltageDropSystemType,
  currentA: number,
  lengthM: number,
  resistanceOhmPerKm: number,
  reactanceOhmPerKm: number,
  cosPhi?: number,
  sinPhi?: number,
): number {
  if (systemType === "single-phase-ac-two-conductor") {
    return calcSinglePhaseACTwoConductorVoltageDrop(
      currentA,
      lengthM,
      resistanceOhmPerKm,
      reactanceOhmPerKm,
      cosPhi ?? 0,
      sinPhi ?? 0,
    );
  }

  if (systemType === "dc-two-conductor") {
    return calcDCTwoConductorVoltageDrop(currentA, lengthM, resistanceOhmPerKm);
  }

  if (systemType === "three-phase-ac-ll") {
    return calcThreePhaseACLineLineVoltageDrop(
      currentA,
      lengthM,
      resistanceOhmPerKm,
      reactanceOhmPerKm,
      cosPhi ?? 0,
      sinPhi ?? 0,
    );
  }

  return calcThreePhaseACLineNeutralVoltageDrop(
    currentA,
    lengthM,
    resistanceOhmPerKm,
    reactanceOhmPerKm,
    cosPhi ?? 0,
    sinPhi ?? 0,
  );
}

export function calculateVoltageDrop(input: VoltageDropInput): VoltageDropResult {
  validateVoltageDropInput(input);

  const parallelConductors = input.parallelConductors ?? 1;
  const { resistivityOhmMm2PerM, alpha20 } = getConductorConstants(input.conductorMaterial);
  const resistance20OhmPerKm = calcR20(resistivityOhmMm2PerM, input.sectionMm2);
  const resistanceOhmPerKm =
    (input.conductorTempC === undefined
      ? resistance20OhmPerKm
      : calcRTheta(resistance20OhmPerKm, alpha20, input.conductorTempC)) /
    parallelConductors;

  const { reactanceOhmPerKm: baseReactanceOhmPerKm, assumptions } = resolveReactance(input);
  const reactanceOhmPerKm = baseReactanceOhmPerKm / parallelConductors;
  const currentA = deriveCurrentForVoltageDrop(input);
  const cosPhi = isACSystem(input.systemType) ? requireACCosPhi(input) : undefined;
  const sinPhi = cosPhi === undefined ? undefined : calcSinPhi(cosPhi);
  const deltaVVolts = calculateVoltageDropBySystem(
    input.systemType,
    currentA,
    input.lengthM,
    resistanceOhmPerKm,
    reactanceOhmPerKm,
    cosPhi,
    sinPhi,
  );

  const value: VoltageDropOutput = {
    mode: input.mode,
    systemType: input.systemType,
    impedanceMode: input.impedanceMode,
    conductorMaterial: input.conductorMaterial,
    lengthM: input.lengthM,
    sectionMm2: input.sectionMm2,
    baseVoltageV: input.baseVoltageV,
    currentA,
    parallelConductors,
    resistance20OhmPerKm,
    resistanceOhmPerKm,
    reactanceOhmPerKm,
    deltaVVolts,
    deltaVPercent: (100 * deltaVVolts) / input.baseVoltageV,
    ...(cosPhi === undefined ? {} : { cosPhi }),
    ...(sinPhi === undefined ? {} : { sinPhi }),
    ...(input.conductorTempC === undefined
      ? {}
      : { conductorTempC: input.conductorTempC }),
  };

  return {
    value,
    warnings: [],
    assumptions,
    formulaVariant: input.systemType,
    dataVersion: DATA_VERSION,
    engineVersion: ENGINE_VERSION,
  };
}

export type {
  ConductorMaterial,
  VoltageDropCurrentModeInput,
  VoltageDropImpedanceMode,
  VoltageDropInput,
  VoltageDropLoadMode,
  VoltageDropOutput,
  VoltageDropPowerModeInput,
  VoltageDropResult,
  VoltageDropSystemType,
} from "./types.js";
export { calcR20, calcRTheta } from "./resistance.js";
export {
  calcDCTwoConductorVoltageDrop,
  calcSinglePhaseACTwoConductorVoltageDrop,
  calcThreePhaseACLineLineVoltageDrop,
  calcThreePhaseACLineNeutralVoltageDrop,
} from "./formulas.js";
export { calcSinPhi } from "./sinphi.js";
export { calculateCurrentFromPower, deriveCurrentForVoltageDrop } from "./power-to-current.js";
