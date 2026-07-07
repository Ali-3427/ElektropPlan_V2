import type {
  AmpacityMaterial,
  HarmonicSizingCurrentBasis,
  InsulationRating,
} from "@elektroplan/calculation-data";

import type { CalculationResult } from "../common/types/result.js";
import type {
  VoltageDropCurrentModeInput,
  VoltageDropResult,
  VoltageDropSystemType,
} from "../voltage-drop/index.js";
import type { PreliminaryCableEstimate } from "./preliminary-estimate.js";

export const CABLE_INSTALLATION_METHODS = [
  "A1",
  "A2",
  "B1",
  "B2",
  "C",
  "D",
  "E",
] as const;

export type CableInstallationMethod = (typeof CABLE_INSTALLATION_METHODS)[number];
export type CablePhase = 1 | 3;

export interface CableVoltageDropInput
  extends Omit<
    VoltageDropCurrentModeInput,
    "mode" | "currentA" | "sectionMm2" | "conductorMaterial"
  > {
  systemType:
    | Extract<VoltageDropSystemType, "single-phase-ac-two-conductor">
    | Extract<VoltageDropSystemType, "three-phase-ac-ll" | "three-phase-ac-ln">;
}

export interface CableSizingInput {
  designCurrentA: number;
  phase: CablePhase;
  conductorMaterial: AmpacityMaterial;
  installationMethod: CableInstallationMethod;
  insulationRating: InsulationRating;
  ambientTemperatureC: number;
  groupedCircuits: number;
  thirdHarmonicPercent: number;
  voltageDropLimitPercent: number;
  voltageDrop: CableVoltageDropInput;
  extraCorrectionFactor?: number;
}

export interface CandidateStep {
  sectionMm2: number;
  baseAmpacityA: number | null;
  correctedAmpacityA: number | null;
  thermalPass: boolean;
  vdPass: boolean;
  accepted: boolean;
  vdResult: VoltageDropResult;
}

export interface CableSizingOutput {
  selectedSectionMm2: number;
  baseAmpacityA: number;
  correctedAmpacityA: number;
  designCurrentA: number;
  sizingCurrentA: number;
  loadedConductors: number;
  harmonicSizingBasis: HarmonicSizingCurrentBasis;
  kT: number;
  kG: number;
  kH: number;
  kTotal: number;
  izRequiredA: number;
  voltageDropLimitPercent: number;
  preliminaryEstimate: PreliminaryCableEstimate;
  vdResult: VoltageDropResult;
  candidateTrace: CandidateStep[];
}

export type CableSizingResult = CalculationResult<CableSizingOutput>;
