import type { CalculationResult } from "../common/types/result.js";
import type { MotorPhase } from "../motor/types.js";

export interface MotorDerivedOutputsInput {
  P_out?: number;
  phase: MotorPhase;
  voltage?: number;
  cosPhi?: number;
  efficiencyPercent?: number;
  polesOrRpm?: number;
  frequency?: number;
}

export interface MotorDerivedOutputsValue {
  phase: MotorPhase;
  voltage: number;
  cosPhi: number;
  efficiencyPercent: number;
  P_out: number;
  frequency: number;
  inputPowerKW: number;
  apparentPowerKVA: number;
  currentA: number;
  poles: number;
  polesSource: "user" | "estimated";
  synchronousSpeedRpm: number;
  operatingSpeedRpm: number | null;
  slipRatio: number | null;
  slipPercent: number | null;
  synchronousTorqueNm: number;
  shaftTorqueNm: number | null;
}

export type MotorDerivedOutputsResult = CalculationResult<MotorDerivedOutputsValue>;
