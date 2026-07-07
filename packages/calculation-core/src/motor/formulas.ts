import { SQRT3 } from "../common/constants/index.js";
import type { FormulaModeOutput, MotorVoltageMode } from "./types.js";

export function calcInputPower(
  outputPowerKW: number,
  efficiency: number,
): number {
  return outputPowerKW / efficiency;
}

export function calcApparentPower(
  inputPowerKW: number,
  cosPhi: number,
): number {
  return inputPowerKW / cosPhi;
}

export function calcSinglePhaseCurrent(
  outputPowerKW: number,
  voltage: number,
  efficiency: number,
  cosPhi: number,
): number {
  return (1000 * outputPowerKW) / (voltage * efficiency * cosPhi);
}

export function calcThreePhaseLineLineCurrent(
  outputPowerKW: number,
  lineToLineVoltage: number,
  efficiency: number,
  cosPhi: number,
): number {
  return (1000 * outputPowerKW) / (SQRT3 * lineToLineVoltage * efficiency * cosPhi);
}

export function calcThreePhaseLineNeutralCurrent(
  outputPowerKW: number,
  lineToNeutralVoltage: number,
  efficiency: number,
  cosPhi: number,
): number {
  return (1000 * outputPowerKW) / (3 * lineToNeutralVoltage * efficiency * cosPhi);
}

export function calculateMotorFormula(input: {
  phase: 1 | 3;
  P_out: number;
  voltage: number;
  cosPhi: number;
  efficiencyPercent: number;
  voltageMode?: MotorVoltageMode;
}): { value: FormulaModeOutput; formulaVariant: string } {
  const efficiency = input.efficiencyPercent / 100;
  const inputPowerKW = calcInputPower(input.P_out, efficiency);
  const apparentPowerKVA = calcApparentPower(inputPowerKW, input.cosPhi);

  if (input.phase === 1) {
    return {
      formulaVariant: "single-phase",
      value: {
        mode: "formula",
        phase: 1,
        voltage: input.voltage,
        P_out: input.P_out,
        cosPhi: input.cosPhi,
        efficiencyPercent: input.efficiencyPercent,
        inputPowerKW,
        apparentPowerKVA,
        currentA: calcSinglePhaseCurrent(
          input.P_out,
          input.voltage,
          efficiency,
          input.cosPhi,
        ),
      },
    };
  }

  if (input.voltageMode === "LL") {
    return {
      formulaVariant: "three-phase-LL",
      value: {
        mode: "formula",
        phase: 3,
        voltage: input.voltage,
        voltageMode: "LL",
        P_out: input.P_out,
        cosPhi: input.cosPhi,
        efficiencyPercent: input.efficiencyPercent,
        inputPowerKW,
        apparentPowerKVA,
        currentA: calcThreePhaseLineLineCurrent(
          input.P_out,
          input.voltage,
          efficiency,
          input.cosPhi,
        ),
      },
    };
  }

  return {
    formulaVariant: "three-phase-LN",
    value: {
      mode: "formula",
      phase: 3,
      voltage: input.voltage,
      voltageMode: "LN",
      P_out: input.P_out,
      cosPhi: input.cosPhi,
      efficiencyPercent: input.efficiencyPercent,
      inputPowerKW,
      apparentPowerKVA,
      currentA: calcThreePhaseLineNeutralCurrent(
        input.P_out,
        input.voltage,
        efficiency,
        input.cosPhi,
      ),
    },
  };
}
