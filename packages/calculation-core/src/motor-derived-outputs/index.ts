import type { MotorDerivedOutputsInput, MotorDerivedOutputsResult } from "./types.js";
import {
  calcDerivedCurrent,
  calcMotorApparentPower,
  calcMotorInputPower,
  calcSlipRatio,
  calcSynchronousSpeedRpm,
  calcTorqueNm,
  inferPoleCountFromRpm,
  isPoleCount,
} from "./formulas.js";
import { validateMotorDerivedOutputsInput } from "./validate.js";
import { ENGINE_VERSION } from "../version.js";
const DATA_VERSION = "motor-derived-outputs-v1";

export function calculateMotorDerivedOutputs(
  input: MotorDerivedOutputsInput,
): MotorDerivedOutputsResult {
  validateMotorDerivedOutputsInput(input);

  const {
    P_out,
    phase,
    voltage,
    cosPhi,
    efficiencyPercent,
    polesOrRpm,
    frequency,
  } = input;

  if (
    P_out === undefined ||
    voltage === undefined ||
    cosPhi === undefined ||
    efficiencyPercent === undefined ||
    polesOrRpm === undefined ||
    frequency === undefined
  ) {
    throw new RangeError("Motor derived outputs input was not fully validated.");
  }

  const polesSource = isPoleCount(polesOrRpm) ? "user" : "estimated";
  const poles =
    polesSource === "user" ? polesOrRpm : inferPoleCountFromRpm(frequency, polesOrRpm);
  const synchronousSpeedRpm = calcSynchronousSpeedRpm(frequency, poles);
  const operatingSpeedRpm = polesSource === "user" ? null : polesOrRpm;
  const slipRatio =
    operatingSpeedRpm === null ? null : calcSlipRatio(synchronousSpeedRpm, operatingSpeedRpm);
  const inputPowerKW = calcMotorInputPower(P_out, efficiencyPercent);
  const apparentPowerKVA = calcMotorApparentPower(inputPowerKW, cosPhi);
  const currentA = calcDerivedCurrent({
    P_out,
    phase,
    voltage,
    cosPhi,
    efficiencyPercent,
  });

  return {
    value: {
      phase,
      voltage,
      cosPhi,
      efficiencyPercent,
      P_out,
      frequency,
      inputPowerKW,
      apparentPowerKVA,
      currentA,
      poles,
      polesSource,
      synchronousSpeedRpm,
      operatingSpeedRpm,
      slipRatio,
      slipPercent: slipRatio === null ? null : slipRatio * 100,
      synchronousTorqueNm: calcTorqueNm(P_out, synchronousSpeedRpm),
      shaftTorqueNm: operatingSpeedRpm === null ? null : calcTorqueNm(P_out, operatingSpeedRpm),
    },
    warnings: [],
    assumptions:
      polesSource === "user"
        ? []
        : [
            {
              field: "poles",
              usedValue: poles,
              source: "estimated",
            },
          ],
    formulaVariant:
      phase === 1
        ? `single-phase-${polesSource === "user" ? "poles" : "rpm"}`
        : `three-phase-${polesSource === "user" ? "poles" : "rpm"}`,
    dataVersion: DATA_VERSION,
    engineVersion: ENGINE_VERSION,
  };
}

export type { MotorDerivedOutputsInput, MotorDerivedOutputsResult, MotorDerivedOutputsValue } from "./types.js";
export {
  calcDerivedCurrent,
  calcMotorApparentPower,
  calcMotorInputPower,
  calcSlipRatio,
  calcSynchronousSpeedRpm,
  calcTorqueNm,
  inferPoleCountFromRpm,
  isPoleCount,
} from "./formulas.js";
export { validateMotorDerivedOutputsInput } from "./validate.js";
