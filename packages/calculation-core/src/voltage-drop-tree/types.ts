export type LegacyConductor = "copper" | "aluminum";
export type LegacyInstallation = "overhead" | "underground";
export type LegacyVoltageType = "single" | "three";

export interface LegacySectionOption {
  readonly key: string;
  readonly label: string;
  readonly areaMm2: number;
  readonly singleRunAreaMm2: number;
  readonly parallelRuns: number;
}

export interface VoltageDropTreeSettingsInput {
  readonly limitPercent?: number;
  readonly baseVoltageV?: number;
  readonly cosPhi?: number;
  readonly efficiencyPercent?: number;
  readonly conductor?: LegacyConductor;
  readonly installation?: LegacyInstallation;
  readonly temperatureC?: number;
  readonly groupedCircuits?: number;
  readonly voltageType?: LegacyVoltageType;
}

export interface VoltageDropTreeSegmentSettingsInput {
  readonly cosPhi?: number;
  readonly efficiencyPercent?: number;
  readonly conductor?: LegacyConductor;
  readonly installation?: LegacyInstallation;
  readonly temperatureC?: number;
  readonly groupedCircuits?: number;
  readonly voltageType?: LegacyVoltageType;
}

export interface VoltageDropTreeSegmentInput {
  readonly id: string;
  readonly parentId: string | null;
  readonly title: string;
  readonly loadPowerKW: number;
  readonly lengthM: number;
  readonly fixedSectionKey?: string;
  readonly settings?: VoltageDropTreeSegmentSettingsInput;
}

export interface VoltageDropTreeSegmentOutput {
  readonly id: string;
  readonly parentId: string | null;
  readonly title: string;
  readonly depth: number;
  readonly childIds: readonly string[];
  readonly pathIds: readonly string[];
  readonly loadPowerKW: number;
  readonly flowPowerKW: number;
  readonly lengthM: number;
  readonly currentA: number;
  readonly selectedSectionKey: string;
  readonly selectedSectionAreaMm2: number;
  readonly selectedParallelRuns: number;
  readonly fixedSection: boolean;
  readonly baseAmpacityA: number;
  readonly correctedAmpacityA: number;
  readonly segmentDeltaVPercent: number;
  readonly cumulativeDeltaVPercent: number;
  readonly thermalPass: boolean;
  readonly voltageDropPass: boolean;
  readonly compliant: boolean;
}

export interface VoltageDropTreeResolvedSettings {
  readonly limitPercent: number;
  readonly baseVoltageV: number;
  readonly cosPhi: number;
  readonly efficiencyPercent: number;
  readonly conductor: LegacyConductor;
  readonly installation: LegacyInstallation;
  readonly temperatureC: number;
  readonly groupedCircuits: number;
  readonly voltageType: LegacyVoltageType;
}

export interface VoltageDropTreeInput {
  readonly title?: string;
  readonly settings?: VoltageDropTreeSettingsInput;
  readonly segments: readonly VoltageDropTreeSegmentInput[];
}

export interface VoltageDropTreeOutput {
  readonly title?: string;
  readonly settings: VoltageDropTreeResolvedSettings;
  readonly segments: readonly VoltageDropTreeSegmentOutput[];
  readonly rootSegmentIds: readonly string[];
  readonly totalLoadPowerKW: number;
  readonly maxCumulativeDeltaVPercent: number;
  readonly totalVoltageDropOk: boolean;
  readonly isCompliant: boolean;
}
