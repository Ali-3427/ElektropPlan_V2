import type {
  AmpacityMaterial,
  InstallationMethodCode,
  InsulationRating,
} from "@elektroplan/calculation-data";

import type { CalculationResult } from "../common/types/result.js";
import type { VoltageDropImpedanceMode } from "../voltage-drop/index.js";

export type VoltageDropGroupPhaseMode = "auto" | "single-phase" | "three-phase";
export type VoltageDropGroupSystemType = "single-phase-ac-two-conductor" | "three-phase-ac-ll";

export interface VoltageDropGroupSegmentSettingsInput {
  cosPhi?: number;
  efficiencyPercent?: number;
  conductorMaterial?: AmpacityMaterial;
  installationMethod?: InstallationMethodCode;
  insulationRating?: InsulationRating;
  ambientTemperatureC?: number;
  groupedCircuits?: number;
  thirdHarmonicPercent?: number;
  conductorTempC?: number;
  impedanceMode?: VoltageDropImpedanceMode;
  reactanceOhmPerKm?: number;
  terminalLossFactor?: number;
}

export interface VoltageDropGroupSegmentInput {
  id?: string;
  title: string;
  localPowerKW: number;
  lengthM: number;
  sectionMm2?: number;
  settings?: VoltageDropGroupSegmentSettingsInput;
}

export interface VoltageDropGroupSettingsInput {
  limitPercent?: number;
  phaseMode?: VoltageDropGroupPhaseMode;
  singlePhaseVoltageV?: number;
  threePhaseVoltageV?: number;
  cosPhi?: number;
  efficiencyPercent?: number;
  conductorMaterial?: AmpacityMaterial;
  installationMethod?: InstallationMethodCode;
  insulationRating?: InsulationRating;
  ambientTemperatureC?: number;
  groupedCircuits?: number;
  thirdHarmonicPercent?: number;
  conductorTempC?: number;
  impedanceMode?: VoltageDropImpedanceMode;
  reactanceOhmPerKm?: number;
  terminalLossFactor?: number;
}

export interface VoltageDropGroupInput {
  title?: string;
  segments: VoltageDropGroupSegmentInput[];
  settings?: VoltageDropGroupSettingsInput;
}

export interface VoltageDropGroupResolvedSettings {
  limitPercent: number;
  phaseMode: VoltageDropGroupPhaseMode;
  systemType: VoltageDropGroupSystemType;
  baseVoltageV: number;
  cosPhi: number;
  efficiencyPercent: number;
  conductorMaterial: AmpacityMaterial;
  installationMethod: InstallationMethodCode;
  insulationRating: InsulationRating;
  ambientTemperatureC: number;
  groupedCircuits: number;
  thirdHarmonicPercent: number;
  conductorTempC: number;
  impedanceMode: VoltageDropImpedanceMode;
  reactanceOhmPerKm?: number;
  terminalLossFactor: number;
}

export interface VoltageDropGroupSegmentOutput {
  id?: string;
  title: string;
  order: number;
  localPowerKW: number;
  flowPowerKW: number;
  lengthM: number;
  currentA: number;
  selectedSectionMm2: number;
  fixedSection: boolean;
  settings: Omit<
    VoltageDropGroupResolvedSettings,
    "limitPercent" | "phaseMode" | "systemType" | "baseVoltageV"
  >;
  baseAmpacityA: number;
  correctedAmpacityA: number;
  segmentDeltaVVolts: number;
  segmentDeltaVPercent: number;
  cumulativeDeltaVPercent: number;
  thermalPass: boolean;
  voltageDropPass: boolean;
  compliant: boolean;
}

export interface VoltageDropGroupOptimizationStep {
  iteration: number;
  segmentOrder: number;
  segmentTitle: string;
  fromSectionMm2: number;
  toSectionMm2: number;
  previousMaxCumulativeDeltaVPercent: number;
  nextMaxCumulativeDeltaVPercent: number;
  sensitivityIndex: number;
}

export interface VoltageDropGroupOutput {
  title?: string;
  settings: VoltageDropGroupResolvedSettings;
  totalLocalPowerKW: number;
  maxCumulativeDeltaVPercent: number;
  isCompliant: boolean;
  segments: VoltageDropGroupSegmentOutput[];
  optimizationSteps: VoltageDropGroupOptimizationStep[];
}

export type VoltageDropGroupResult = CalculationResult<VoltageDropGroupOutput>;
