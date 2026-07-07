import type { CalculationResult } from "../common/types/result.js";

export type VoltageDropSystemType =
  | "single-phase-ac-two-conductor"
  | "dc-two-conductor"
  | "three-phase-ac-ll"
  | "three-phase-ac-ln";

export type VoltageDropImpedanceMode = "simplified" | "exact-ac";
export type VoltageDropLoadMode = "current" | "power";
export type ConductorMaterial = "copper" | "aluminum";

interface VoltageDropInputBase {
  systemType: VoltageDropSystemType;
  impedanceMode: VoltageDropImpedanceMode;
  conductorMaterial: ConductorMaterial;
  lengthM: number;
  sectionMm2: number;
  baseVoltageV: number;
  parallelConductors?: number;
  conductorTempC?: number;
  reactanceOhmPerKm?: number;
}

export interface VoltageDropCurrentModeInput extends VoltageDropInputBase {
  mode: "current";
  currentA: number;
  cosPhi?: number;
}

export interface VoltageDropPowerModeInput extends VoltageDropInputBase {
  mode: "power";
  powerKW: number;
  cosPhi?: number;
}

export type VoltageDropInput =
  | VoltageDropCurrentModeInput
  | VoltageDropPowerModeInput;

export interface VoltageDropOutput {
  mode: VoltageDropLoadMode;
  systemType: VoltageDropSystemType;
  impedanceMode: VoltageDropImpedanceMode;
  conductorMaterial: ConductorMaterial;
  lengthM: number;
  sectionMm2: number;
  baseVoltageV: number;
  currentA: number;
  cosPhi?: number;
  sinPhi?: number;
  parallelConductors: number;
  conductorTempC?: number;
  resistance20OhmPerKm: number;
  resistanceOhmPerKm: number;
  reactanceOhmPerKm: number;
  deltaVVolts: number;
  deltaVPercent: number;
}

export type VoltageDropResult = CalculationResult<VoltageDropOutput>;
