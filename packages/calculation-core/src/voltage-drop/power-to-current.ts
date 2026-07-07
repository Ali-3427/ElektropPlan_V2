import { SQRT3 } from "../common/constants/index.js";
import type { VoltageDropInput, VoltageDropSystemType } from "./types.js";

function calcSinglePhaseCurrentFromPower(
  powerKW: number,
  baseVoltageV: number,
  cosPhi: number,
): number {
  return (1000 * powerKW) / (baseVoltageV * cosPhi);
}

function calcDCCurrentFromPower(
  powerKW: number,
  baseVoltageV: number,
): number {
  return (1000 * powerKW) / baseVoltageV;
}

function calcThreePhaseLineLineCurrentFromPower(
  powerKW: number,
  baseVoltageV: number,
  cosPhi: number,
): number {
  return (1000 * powerKW) / (SQRT3 * baseVoltageV * cosPhi);
}

function calcThreePhaseLineNeutralCurrentFromPower(
  powerKW: number,
  baseVoltageV: number,
  cosPhi: number,
): number {
  return (1000 * powerKW) / (3 * baseVoltageV * cosPhi);
}

export function calculateCurrentFromPower(
  systemType: VoltageDropSystemType,
  powerKW: number,
  baseVoltageV: number,
  cosPhi?: number,
): number {
  if (systemType === "dc-two-conductor") {
    return calcDCCurrentFromPower(powerKW, baseVoltageV);
  }

  if (cosPhi === undefined) {
    throw new RangeError("cosPhi is required for AC power mode.");
  }

  if (systemType === "single-phase-ac-two-conductor") {
    return calcSinglePhaseCurrentFromPower(powerKW, baseVoltageV, cosPhi);
  }

  if (systemType === "three-phase-ac-ll") {
    return calcThreePhaseLineLineCurrentFromPower(powerKW, baseVoltageV, cosPhi);
  }

  return calcThreePhaseLineNeutralCurrentFromPower(powerKW, baseVoltageV, cosPhi);
}

export function deriveCurrentForVoltageDrop(input: VoltageDropInput): number {
  if (input.mode === "current") {
    return input.currentA;
  }

  return calculateCurrentFromPower(
    input.systemType,
    input.powerKW,
    input.baseVoltageV,
    input.cosPhi,
  );
}
