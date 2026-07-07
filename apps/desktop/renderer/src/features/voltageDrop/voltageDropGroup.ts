import type {
  AssumptionEntry,
  ElektroPlanBridge,
  WarningEntry,
} from "../../bridge/types";

export type VoltageDropGroupPhaseMode = "auto" | "single-phase" | "three-phase";
export type VoltageDropGroupSystemType = "single-phase-ac-two-conductor" | "three-phase-ac-ll";
export type VoltageDropGroupConductorMaterial = "copper" | "aluminum";
export type VoltageDropGroupInstallationMethod = "A1" | "A2" | "B1" | "B2" | "C" | "D" | "E";
export type VoltageDropGroupInsulationRating = "PVC_70C" | "XLPE_EPR_90C";
export type VoltageDropGroupImpedanceMode = "simplified" | "exact-ac";

export interface VoltageDropGroupSegmentDraft {
  id: string;
  parentId?: string | null;
  title: string;
  loadPowerKW?: number | null;
  localPowerKW: number | null;
  lengthM: number | null;
  fixedSectionKey?: string | null;
  sectionMm2: number | null;
  settings: VoltageDropGroupSettingsDraft;
}

export interface VoltageDropGroupSettingsDraft {
  limitPercent: number | null;
  phaseMode: VoltageDropGroupPhaseMode;
  singlePhaseVoltageV: number | null;
  threePhaseVoltageV: number | null;
  cosPhi: number | null;
  efficiencyPercent: number | null;
  conductorMaterial: VoltageDropGroupConductorMaterial;
  installationMethod: VoltageDropGroupInstallationMethod;
  insulationRating: VoltageDropGroupInsulationRating;
  ambientTemperatureC: number | null;
  groupedCircuits: number | null;
  thirdHarmonicPercent: number | null;
  conductorTempC: number | null;
  impedanceMode: VoltageDropGroupImpedanceMode;
  reactanceOhmPerKm: number | null;
  terminalLossFactor: number | null;
}

export interface VoltageDropGroupRequestSegment {
  id?: string;
  parentId?: string | null;
  title: string;
  loadPowerKW?: number;
  localPowerKW?: number;
  lengthM: number;
  fixedSectionKey?: string;
  sectionMm2?: number;
  settings?: VoltageDropGroupSegmentRequestSettings;
}

export interface VoltageDropGroupRequestSettings {
  limitPercent?: number;
  phaseMode?: VoltageDropGroupPhaseMode;
  singlePhaseVoltageV?: number;
  threePhaseVoltageV?: number;
  cosPhi?: number;
  efficiencyPercent?: number;
  conductorMaterial?: VoltageDropGroupConductorMaterial;
  installationMethod?: VoltageDropGroupInstallationMethod;
  insulationRating?: VoltageDropGroupInsulationRating;
  ambientTemperatureC?: number;
  groupedCircuits?: number;
  thirdHarmonicPercent?: number;
  conductorTempC?: number;
  impedanceMode?: VoltageDropGroupImpedanceMode;
  reactanceOhmPerKm?: number;
  terminalLossFactor?: number;
}

export type VoltageDropGroupSegmentRequestSettings = Omit<
  VoltageDropGroupRequestSettings,
  "limitPercent" | "phaseMode" | "singlePhaseVoltageV" | "threePhaseVoltageV"
>;

export interface VoltageDropGroupRequest {
  title?: string;
  segments: VoltageDropGroupRequestSegment[];
  settings?: VoltageDropGroupRequestSettings;
}

export interface VoltageDropGroupResolvedSettings {
  limitPercent: number;
  phaseMode: VoltageDropGroupPhaseMode;
  systemType: VoltageDropGroupSystemType;
  baseVoltageV: number;
  cosPhi: number;
  efficiencyPercent: number;
  conductorMaterial: VoltageDropGroupConductorMaterial;
  installationMethod: VoltageDropGroupInstallationMethod;
  insulationRating: VoltageDropGroupInsulationRating;
  ambientTemperatureC: number;
  groupedCircuits: number;
  thirdHarmonicPercent: number;
  conductorTempC: number;
  impedanceMode: VoltageDropGroupImpedanceMode;
  reactanceOhmPerKm?: number;
  terminalLossFactor: number;
}

export interface VoltageDropGroupSegmentResult {
  readonly id?: string;
  readonly parentId?: string | null;
  readonly title: string;
  readonly order: number;
  readonly depth?: number;
  readonly childIds?: readonly string[];
  readonly pathIds?: readonly string[];
  readonly loadPowerKW?: number;
  readonly localPowerKW: number;
  readonly flowPowerKW: number;
  readonly lengthM: number;
  readonly currentA: number;
  readonly selectedSectionKey?: string;
  readonly selectedSectionAreaMm2?: number;
  readonly selectedParallelRuns?: number;
  readonly selectedSectionMm2: number;
  readonly fixedSection?: boolean;
  readonly settings?: Omit<
    VoltageDropGroupResolvedSettings,
    "limitPercent" | "phaseMode" | "systemType" | "baseVoltageV"
  >;
  readonly baseAmpacityA: number;
  readonly correctedAmpacityA: number;
  readonly segmentDeltaVVolts: number;
  readonly segmentDeltaVPercent: number;
  readonly cumulativeDeltaVPercent: number;
  readonly thermalPass: boolean;
  readonly voltageDropPass: boolean;
  readonly compliant: boolean;
}

export interface VoltageDropGroupOptimizationStep {
  readonly iteration: number;
  readonly segmentOrder: number;
  readonly segmentTitle: string;
  readonly fromSectionMm2: number;
  readonly toSectionMm2: number;
  readonly previousMaxCumulativeDeltaVPercent: number;
  readonly nextMaxCumulativeDeltaVPercent: number;
  readonly sensitivityIndex: number;
}

export interface VoltageDropGroupResultValue {
  readonly title?: string;
  readonly settings: VoltageDropGroupResolvedSettings;
  readonly totalLocalPowerKW: number;
  readonly maxCumulativeDeltaVPercent: number;
  readonly isCompliant: boolean;
  readonly segments: readonly VoltageDropGroupSegmentResult[];
  readonly optimizationSteps: readonly VoltageDropGroupOptimizationStep[];
}

export interface VoltageDropGroupResponse {
  readonly value: VoltageDropGroupResultValue;
  readonly warnings: readonly WarningEntry[];
  readonly assumptions: readonly AssumptionEntry[];
  readonly formulaVariant: string;
  readonly dataVersion: string;
  readonly engineVersion: string;
}

export interface VoltageDropGroupCalculationRecord {
  id: string;
  calculator: "voltage-drop-group";
  title?: string;
  grouping?: Record<string, unknown>;
  version: {
    contractVersion: string;
    engineVersion?: string;
    dataVersion?: string;
  };
  input: VoltageDropGroupRequest;
  output: VoltageDropGroupResponse;
}

export interface VoltageDropGroupBridge extends ElektroPlanBridge {
  readonly calc: ElektroPlanBridge["calc"] & {
    voltageDropGroup(request: VoltageDropGroupRequest): Promise<VoltageDropGroupResponse>;
  };
}

export interface VoltageDropGroupSubmission {
  request: VoltageDropGroupRequest;
}

export const VOLTAGE_DROP_GROUP_DEFAULTS = {
  limitPercent: 3,
  phaseMode: "three-phase" as const,
  singlePhaseVoltageV: 230,
  threePhaseVoltageV: 400,
  cosPhi: 0.8,
  efficiencyPercent: 100,
  conductorMaterial: "copper" as const,
  installationMethod: "C" as const,
  insulationRating: "XLPE_EPR_90C" as const,
  ambientTemperatureC: 30,
  groupedCircuits: 1,
  thirdHarmonicPercent: 0,
  conductorTempC: 70,
  impedanceMode: "simplified" as const,
  terminalLossFactor: 1.015,
} as const;

export const VOLTAGE_DROP_GROUP_DEFAULTS_SETTING_KEY = "voltageDropGroupDefaults";

export const PHASE_MODE_OPTIONS: { value: VoltageDropGroupPhaseMode; label: string }[] = [
  { value: "three-phase", label: "Üç Faz" },
  { value: "single-phase", label: "Tek Faz" },
];

export const CONDUCTOR_MATERIAL_OPTIONS: { value: VoltageDropGroupConductorMaterial; label: string }[] =
  [
    { value: "copper", label: "Bakır" },
    { value: "aluminum", label: "Alüminyum" },
  ];

export const INSTALLATION_METHOD_DESCRIPTIONS: Record<
  VoltageDropGroupInstallationMethod,
  string
> = {
  A1: "Isi yalitimli duvar icinde boruda",
  A2: "Isi yalitimli duvar icinde cok damarli kablo",
  B1: "Boru/kanal icinde tek damarli",
  B2: "Boru/kanal icinde cok damarli",
  C: "Duvar veya yuzey uzerinde",
  D: "Toprak altinda",
  E: "Havada veya serbest",
};

export const INSTALLATION_METHOD_OPTIONS: {
  value: VoltageDropGroupInstallationMethod;
  label: string;
}[] = [
  { value: "A1", label: `A1 - ${INSTALLATION_METHOD_DESCRIPTIONS.A1}` },
  { value: "A2", label: `A2 - ${INSTALLATION_METHOD_DESCRIPTIONS.A2}` },
  { value: "B1", label: `B1 - ${INSTALLATION_METHOD_DESCRIPTIONS.B1}` },
  { value: "B2", label: `B2 - ${INSTALLATION_METHOD_DESCRIPTIONS.B2}` },
  { value: "C", label: `C - ${INSTALLATION_METHOD_DESCRIPTIONS.C}` },
  { value: "D", label: `D - ${INSTALLATION_METHOD_DESCRIPTIONS.D}` },
  { value: "E", label: `E - ${INSTALLATION_METHOD_DESCRIPTIONS.E}` },
];

export const INSULATION_OPTIONS: {
  value: VoltageDropGroupInsulationRating;
  label: string;
}[] = [
  { value: "PVC_70C", label: "PVC 70°C" },
  { value: "XLPE_EPR_90C", label: "XLPE / EPR 90°C" },
];

export const IMPEDANCE_OPTIONS: { value: VoltageDropGroupImpedanceMode; label: string }[] = [
  { value: "simplified", label: "Basit" },
  { value: "exact-ac", label: "Tam AC" },
];

export function createSegmentDraft(
  index: number,
  settings: VoltageDropGroupSettingsDraft = createInitialSettings(),
): VoltageDropGroupSegmentDraft {
  return {
    id: crypto.randomUUID(),
    parentId: null,
    title: `Segment ${index}`,
    loadPowerKW: null,
    localPowerKW: null,
    lengthM: null,
    fixedSectionKey: null,
    sectionMm2: null,
    settings: { ...settings },
  };
}

export function createInitialSegments(
  settings: VoltageDropGroupSettingsDraft = createInitialSettings(),
): VoltageDropGroupSegmentDraft[] {
  return [createSegmentDraft(1, settings)];
}

export function createInitialSettings(): VoltageDropGroupSettingsDraft {
  return {
    limitPercent: VOLTAGE_DROP_GROUP_DEFAULTS.limitPercent,
    phaseMode: VOLTAGE_DROP_GROUP_DEFAULTS.phaseMode,
    singlePhaseVoltageV: VOLTAGE_DROP_GROUP_DEFAULTS.singlePhaseVoltageV,
    threePhaseVoltageV: VOLTAGE_DROP_GROUP_DEFAULTS.threePhaseVoltageV,
    cosPhi: VOLTAGE_DROP_GROUP_DEFAULTS.cosPhi,
    efficiencyPercent: VOLTAGE_DROP_GROUP_DEFAULTS.efficiencyPercent,
    conductorMaterial: VOLTAGE_DROP_GROUP_DEFAULTS.conductorMaterial,
    installationMethod: VOLTAGE_DROP_GROUP_DEFAULTS.installationMethod,
    insulationRating: VOLTAGE_DROP_GROUP_DEFAULTS.insulationRating,
    ambientTemperatureC: VOLTAGE_DROP_GROUP_DEFAULTS.ambientTemperatureC,
    groupedCircuits: VOLTAGE_DROP_GROUP_DEFAULTS.groupedCircuits,
    thirdHarmonicPercent: VOLTAGE_DROP_GROUP_DEFAULTS.thirdHarmonicPercent,
    conductorTempC: VOLTAGE_DROP_GROUP_DEFAULTS.conductorTempC,
    impedanceMode: VOLTAGE_DROP_GROUP_DEFAULTS.impedanceMode,
    reactanceOhmPerKm: null,
    terminalLossFactor: VOLTAGE_DROP_GROUP_DEFAULTS.terminalLossFactor,
  };
}

export function mergeVoltageDropGroupDefaults(value: unknown): VoltageDropGroupSettingsDraft {
  const defaults = createInitialSettings();
  if (value === null || typeof value !== "object") {
    return defaults;
  }

  const incoming = value as Partial<VoltageDropGroupSettingsDraft>;
  return {
    ...defaults,
    ...incoming,
    phaseMode:
      incoming.phaseMode === "single-phase" || incoming.phaseMode === "three-phase"
        ? incoming.phaseMode
        : defaults.phaseMode,
  };
}

export function formatVoltageDropSectionLabel(
  segment: VoltageDropGroupSegmentResult,
): string {
  const sectionArea = segment.selectedSectionAreaMm2 ?? segment.selectedSectionMm2;
  const runs = segment.selectedParallelRuns ?? 1;
  const sectionText = runs > 1 ? `${runs}x${sectionArea} mm2` : `${sectionArea} mm2`;
  return segment.fixedSection ? `Manual: ${sectionText}` : `Otomatik: ${sectionText}`;
}

function isFinitePositive(value: number | null): value is number {
  return value !== null && Number.isFinite(value) && value > 0;
}

function isFiniteNumber(value: number | null): value is number {
  return value !== null && Number.isFinite(value);
}

function isValidCosPhi(value: number | null): value is number {
  return value !== null && Number.isFinite(value) && value > 0 && value <= 1;
}

function isValidEfficiency(value: number | null): value is number {
  return value !== null && Number.isFinite(value) && value > 0 && value <= 100;
}

export function buildVoltageDropGroupSubmission(state: {
  title: string;
  segments: VoltageDropGroupSegmentDraft[];
  settings: VoltageDropGroupSettingsDraft;
}): VoltageDropGroupSubmission | null {
  const title = state.title.trim();
  const segments = state.segments.map((segment, index) => ({
    id: segment.id.trim(),
    parentId: segment.parentId ?? null,
    title: segment.title.trim(),
    loadPowerKW: segment.loadPowerKW,
    localPowerKW: segment.localPowerKW,
    lengthM: segment.lengthM,
    fixedSectionKey: segment.fixedSectionKey?.trim() || undefined,
    sectionMm2: segment.sectionMm2,
    settings: segment.settings,
    fallbackTitle: `Segment ${index + 1}`,
  }));

  if (segments.length === 0) {
    return null;
  }

  if (
    !isFinitePositive(state.settings.limitPercent) ||
    !isFinitePositive(state.settings.singlePhaseVoltageV) ||
    !isFinitePositive(state.settings.threePhaseVoltageV) ||
    !isValidCosPhi(state.settings.cosPhi) ||
    !isValidEfficiency(state.settings.efficiencyPercent) ||
    !Number.isInteger(state.settings.groupedCircuits ?? NaN) ||
    !isFinitePositive(state.settings.groupedCircuits) ||
    !isFiniteNumber(state.settings.thirdHarmonicPercent) ||
    state.settings.thirdHarmonicPercent < 0 ||
    !isFiniteNumber(state.settings.conductorTempC) ||
    !isFiniteNumber(state.settings.ambientTemperatureC) ||
    !isFinitePositive(state.settings.terminalLossFactor)
  ) {
    return null;
  }

  const requestSegments: VoltageDropGroupRequestSegment[] = [];
  for (const [index, segment] of segments.entries()) {
    const resolvedLoadPowerKW = segment.loadPowerKW ?? segment.localPowerKW;

    if (!segment.id) {
      return null;
    }
    if (!segment.title) {
      return null;
    }
    if (!isFinitePositive(resolvedLoadPowerKW) || !isFinitePositive(segment.lengthM)) {
      return null;
    }
    if (segment.sectionMm2 !== null && !isFinitePositive(segment.sectionMm2)) {
      return null;
    }

    requestSegments.push({
      id: segment.id,
      parentId: segment.parentId,
      title: segment.title || segment.fallbackTitle,
      loadPowerKW: resolvedLoadPowerKW,
      localPowerKW: resolvedLoadPowerKW,
      lengthM: segment.lengthM,
      ...(segment.fixedSectionKey === undefined ? {} : { fixedSectionKey: segment.fixedSectionKey }),
      ...(segment.sectionMm2 === null ? {} : { sectionMm2: segment.sectionMm2 }),
      settings: buildSegmentSettingsRequest(segment.settings),
    });
  }

  const settings: VoltageDropGroupRequestSettings = {};

  if (state.settings.limitPercent !== VOLTAGE_DROP_GROUP_DEFAULTS.limitPercent) {
    settings.limitPercent = state.settings.limitPercent;
  }
  if (state.settings.phaseMode !== VOLTAGE_DROP_GROUP_DEFAULTS.phaseMode) {
    settings.phaseMode = state.settings.phaseMode;
  }
  if (state.settings.singlePhaseVoltageV !== VOLTAGE_DROP_GROUP_DEFAULTS.singlePhaseVoltageV) {
    settings.singlePhaseVoltageV = state.settings.singlePhaseVoltageV;
  }
  if (state.settings.threePhaseVoltageV !== VOLTAGE_DROP_GROUP_DEFAULTS.threePhaseVoltageV) {
    settings.threePhaseVoltageV = state.settings.threePhaseVoltageV;
  }
  if (state.settings.cosPhi !== VOLTAGE_DROP_GROUP_DEFAULTS.cosPhi) {
    settings.cosPhi = state.settings.cosPhi;
  }
  if (state.settings.efficiencyPercent !== VOLTAGE_DROP_GROUP_DEFAULTS.efficiencyPercent) {
    settings.efficiencyPercent = state.settings.efficiencyPercent;
  }
  if (state.settings.conductorMaterial !== VOLTAGE_DROP_GROUP_DEFAULTS.conductorMaterial) {
    settings.conductorMaterial = state.settings.conductorMaterial;
  }
  if (state.settings.installationMethod !== VOLTAGE_DROP_GROUP_DEFAULTS.installationMethod) {
    settings.installationMethod = state.settings.installationMethod;
  }
  if (state.settings.insulationRating !== VOLTAGE_DROP_GROUP_DEFAULTS.insulationRating) {
    settings.insulationRating = state.settings.insulationRating;
  }
  if (state.settings.ambientTemperatureC !== VOLTAGE_DROP_GROUP_DEFAULTS.ambientTemperatureC) {
    settings.ambientTemperatureC = state.settings.ambientTemperatureC;
  }
  if (state.settings.groupedCircuits !== VOLTAGE_DROP_GROUP_DEFAULTS.groupedCircuits) {
    settings.groupedCircuits = state.settings.groupedCircuits;
  }
  if (state.settings.thirdHarmonicPercent !== VOLTAGE_DROP_GROUP_DEFAULTS.thirdHarmonicPercent) {
    settings.thirdHarmonicPercent = state.settings.thirdHarmonicPercent;
  }
  if (state.settings.conductorTempC !== VOLTAGE_DROP_GROUP_DEFAULTS.conductorTempC) {
    settings.conductorTempC = state.settings.conductorTempC;
  }
  if (state.settings.impedanceMode !== VOLTAGE_DROP_GROUP_DEFAULTS.impedanceMode) {
    settings.impedanceMode = state.settings.impedanceMode;
  }
  if (state.settings.impedanceMode === "exact-ac") {
    if (!isFinitePositive(state.settings.reactanceOhmPerKm)) {
      return null;
    }
    settings.reactanceOhmPerKm = state.settings.reactanceOhmPerKm;
  }
  if (state.settings.terminalLossFactor !== VOLTAGE_DROP_GROUP_DEFAULTS.terminalLossFactor) {
    settings.terminalLossFactor = state.settings.terminalLossFactor;
  }

  return {
    request: {
      ...(title === "" ? {} : { title }),
      segments: requestSegments,
      ...(Object.keys(settings).length > 0 ? { settings } : {}),
    },
  };
}

function buildSegmentSettingsRequest(
  settings: VoltageDropGroupSettingsDraft,
): VoltageDropGroupSegmentRequestSettings {
  return {
    cosPhi: settings.cosPhi ?? VOLTAGE_DROP_GROUP_DEFAULTS.cosPhi,
    efficiencyPercent:
      settings.efficiencyPercent ?? VOLTAGE_DROP_GROUP_DEFAULTS.efficiencyPercent,
    conductorMaterial: settings.conductorMaterial,
    installationMethod: settings.installationMethod,
    insulationRating: settings.insulationRating,
    ambientTemperatureC:
      settings.ambientTemperatureC ?? VOLTAGE_DROP_GROUP_DEFAULTS.ambientTemperatureC,
    groupedCircuits: settings.groupedCircuits ?? VOLTAGE_DROP_GROUP_DEFAULTS.groupedCircuits,
    thirdHarmonicPercent:
      settings.thirdHarmonicPercent ?? VOLTAGE_DROP_GROUP_DEFAULTS.thirdHarmonicPercent,
    conductorTempC: settings.conductorTempC ?? VOLTAGE_DROP_GROUP_DEFAULTS.conductorTempC,
    impedanceMode: settings.impedanceMode,
    ...(settings.impedanceMode === "exact-ac" && settings.reactanceOhmPerKm !== null
      ? { reactanceOhmPerKm: settings.reactanceOhmPerKm }
      : {}),
    terminalLossFactor:
      settings.terminalLossFactor ?? VOLTAGE_DROP_GROUP_DEFAULTS.terminalLossFactor,
  };
}
