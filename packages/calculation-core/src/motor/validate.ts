import {
  getMotorTableEntryByKW,
  isVoltageAvailable,
  type MotorTableEntry,
} from "@elektroplan/calculation-data";

import {
  assertInRange,
  assertOneOf,
  assertPositive,
} from "../common/validation/guards.js";
import type { FormulaModeInput, MotorCurrentInput, TableModeInput } from "./types.js";

export function validateMotorCurrentInput(input: MotorCurrentInput): void {
  if (input.mode === "formula") {
    validateFormulaModeInput(input);
    return;
  }

  validateTableModeInput(input);
}

export function validateFormulaModeInput(input: FormulaModeInput): void {
  assertOneOf(input.phase, [1, 3] as const, "phase");

  if (input.P_out === undefined) {
    throw new RangeError("P_out is required in formula mode.");
  }

  if (input.voltage === undefined) {
    throw new RangeError("voltage is required in formula mode.");
  }

  if (input.cosPhi === undefined) {
    throw new RangeError("cosPhi is required in formula mode.");
  }

  if (input.efficiencyPercent === undefined) {
    throw new RangeError("efficiencyPercent is required in formula mode.");
  }

  assertPositive(input.P_out, "P_out");
  assertPositive(input.voltage, "voltage");
  assertPositive(input.cosPhi, "cosPhi");
  assertPositive(input.efficiencyPercent, "efficiencyPercent");
  assertInRange(input.cosPhi, 0, 1, "cosPhi");
  assertInRange(input.efficiencyPercent, 1, 100, "efficiencyPercent");

  if (input.phase === 3) {
    if (input.voltageMode === undefined) {
      throw new RangeError("voltageMode is required when phase is 3.");
    }

    assertOneOf(input.voltageMode, ["LL", "LN"] as const, "voltageMode");
  }
}

export function validateTableModeInput(input: TableModeInput): MotorTableEntry {
  const entry = getMotorTableEntryByKW(input.kW);

  if (entry === undefined) {
    throw new RangeError(`No exact motor table row found for ${input.kW} kW.`);
  }

  if (!isVoltageAvailable(entry, input.voltage)) {
    throw new RangeError(
      `Motor table row ${input.kW} kW does not provide a ${input.voltage} V current.`,
    );
  }

  return entry;
}
