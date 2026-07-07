import type { CalculationResult } from "../common/types/result.js";

export type MotorPhase = 1 | 3;
export type MotorVoltageMode = "LL" | "LN";
export type MotorCurrentMode = "formula" | "table";
export type MotorTableVoltage = 220 | 380;
export type MotorSuggestedCableSectionAmbient = "hava_30C" | "toprak_20C";

export interface MotorSuggestedCableSection {
  sectionMm2: number;
  label: string;
  ambient: MotorSuggestedCableSectionAmbient;
  ampacityA: number;
  standardHintMm2?: 2.5 | 4;
}

export interface FormulaModeInput {
  mode: "formula";
  phase: MotorPhase;
  P_out?: number;
  voltage?: number;
  cosPhi?: number;
  efficiencyPercent?: number;
  voltageMode?: MotorVoltageMode;
}

export interface TableModeInput {
  mode: "table";
  kW: number;
  voltage: MotorTableVoltage;
}

export type MotorCurrentInput = FormulaModeInput | TableModeInput;

export interface FormulaModeOutput {
  mode: "formula";
  phase: MotorPhase;
  voltage: number;
  cosPhi: number;
  efficiencyPercent: number;
  P_out: number;
  inputPowerKW: number;
  apparentPowerKVA: number;
  currentA: number;
  voltageMode?: MotorVoltageMode;
  suggestedCableSection?: MotorSuggestedCableSection;
}

export interface TableModeOutput {
  mode: "table";
  kW: number;
  PS: number;
  cosPhi: number;
  efficiencyPercent: number;
  currentA: number;
  cableSpec: string;
}

export type MotorCurrentOutput = FormulaModeOutput | TableModeOutput;

export type MotorCurrentResult = CalculationResult<MotorCurrentOutput>;
