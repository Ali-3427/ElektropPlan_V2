import { assertInRange, assertOneOf, assertPositive } from "../common/validation/guards.js";
import type { MotorDerivedOutputsInput } from "./types.js";

export function validateMotorDerivedOutputsInput(input: MotorDerivedOutputsInput): void {
  assertOneOf(input.phase, [1, 3] as const, "phase");

  if (input.P_out === undefined) {
    throw new RangeError("P_out is required.");
  }

  if (input.voltage === undefined) {
    throw new RangeError("voltage is required.");
  }

  if (input.cosPhi === undefined) {
    throw new RangeError("cosPhi is required.");
  }

  if (input.efficiencyPercent === undefined) {
    throw new RangeError("efficiencyPercent is required.");
  }

  if (input.polesOrRpm === undefined) {
    throw new RangeError("polesOrRpm is required.");
  }

  if (input.frequency === undefined) {
    throw new RangeError("frequency is required.");
  }

  assertPositive(input.P_out, "P_out");
  assertPositive(input.voltage, "voltage");
  assertPositive(input.cosPhi, "cosPhi");
  assertPositive(input.efficiencyPercent, "efficiencyPercent");
  assertPositive(input.polesOrRpm, "polesOrRpm");
  assertPositive(input.frequency, "frequency");
  assertInRange(input.cosPhi, 0, 1, "cosPhi");
  assertInRange(input.efficiencyPercent, 1, 100, "efficiencyPercent");
}
