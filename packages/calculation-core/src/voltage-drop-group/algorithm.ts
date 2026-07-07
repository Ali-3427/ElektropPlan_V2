import { ENGINE_VERSION } from "../version.js";
import type { InstallationMethodCode } from "@elektroplan/calculation-data";
import type { AssumptionEntry } from "../common/types/result.js";
import { calculateVoltageDropTreeDetailed } from "../voltage-drop-tree/index.js";
import {
  LEGACY_SECTION_OPTIONS,
  getSectionOption,
} from "../voltage-drop-tree/legacy-tables.js";
import type { VoltageDropTreeSegmentInput } from "../voltage-drop-tree/types.js";
import {
  DEFAULT_VOLTAGE_DROP_GROUP_SETTINGS,
  resolveVoltageDropGroupSettings,
  VOLTAGE_DROP_GROUP_DATA_VERSION,
} from "./defaults.js";
import type {
  VoltageDropGroupInput,
  VoltageDropGroupOptimizationStep,
  VoltageDropGroupResolvedSettings,
  VoltageDropGroupResult,
  VoltageDropGroupSegmentInput,
  VoltageDropGroupSegmentOutput,
  VoltageDropGroupSegmentSettingsInput,
} from "./types.js";

type SegmentResolvedSettings = Omit<
  VoltageDropGroupResolvedSettings,
  "limitPercent" | "phaseMode" | "systemType" | "baseVoltageV"
>;

type VoltageDropGroupSegmentCompatInput = VoltageDropGroupSegmentInput & {
  parentId?: string | null;
  loadPowerKW?: number;
  fixedSectionKey?: string;
};

function resolveSegmentSettings(
  groupSettings: VoltageDropGroupResolvedSettings,
  segmentSettings: VoltageDropGroupSegmentSettingsInput | undefined,
): SegmentResolvedSettings {
  const reactanceOhmPerKm =
    segmentSettings?.reactanceOhmPerKm ?? groupSettings.reactanceOhmPerKm;

  return {
    cosPhi: segmentSettings?.cosPhi ?? groupSettings.cosPhi,
    efficiencyPercent: segmentSettings?.efficiencyPercent ?? groupSettings.efficiencyPercent,
    conductorMaterial: segmentSettings?.conductorMaterial ?? groupSettings.conductorMaterial,
    installationMethod: segmentSettings?.installationMethod ?? groupSettings.installationMethod,
    insulationRating: segmentSettings?.insulationRating ?? groupSettings.insulationRating,
    ambientTemperatureC: segmentSettings?.ambientTemperatureC ?? groupSettings.ambientTemperatureC,
    groupedCircuits: segmentSettings?.groupedCircuits ?? groupSettings.groupedCircuits,
    thirdHarmonicPercent: segmentSettings?.thirdHarmonicPercent ?? groupSettings.thirdHarmonicPercent,
    conductorTempC: segmentSettings?.conductorTempC ?? groupSettings.conductorTempC,
    impedanceMode: segmentSettings?.impedanceMode ?? groupSettings.impedanceMode,
    ...(reactanceOhmPerKm === undefined
      ? {}
      : { reactanceOhmPerKm }),
    terminalLossFactor: segmentSettings?.terminalLossFactor ?? groupSettings.terminalLossFactor,
  };
}

function validateVoltageDropGroupInput(
  segments: readonly VoltageDropGroupSegmentCompatInput[],
  settings: VoltageDropGroupResolvedSettings,
): void {
  if (segments.length === 0) {
    throw new RangeError("segments must contain at least one segment.");
  }

  for (const [index, segment] of segments.entries()) {
    if (!segment.title || segment.title.trim() === "") {
      throw new RangeError(`segments[${index}].title must be a non-empty string.`);
    }

    const resolvedLoad = segment.loadPowerKW ?? segment.localPowerKW;
    if (!Number.isFinite(resolvedLoad) || resolvedLoad < 0) {
      throw new RangeError(`segments[${index}].loadPowerKW/localPowerKW must be zero or positive.`);
    }

    if (!Number.isFinite(segment.lengthM) || segment.lengthM <= 0) {
      throw new RangeError(`segments[${index}].lengthM must be positive.`);
    }
  }

  if (!Number.isFinite(settings.limitPercent) || settings.limitPercent <= 0) {
    throw new RangeError("limitPercent must be positive.");
  }
  if (!Number.isFinite(settings.cosPhi) || settings.cosPhi <= 0 || settings.cosPhi > 1) {
    throw new RangeError("cosPhi must be between 0 and 1 (exclusive of 0).");
  }
  if (
    !Number.isFinite(settings.efficiencyPercent) ||
    settings.efficiencyPercent <= 0 ||
    settings.efficiencyPercent > 100
  ) {
    throw new RangeError("efficiencyPercent must be between 0 and 100.");
  }
  if (!Number.isInteger(settings.groupedCircuits) || settings.groupedCircuits <= 0) {
    throw new RangeError("groupedCircuits must be a positive integer.");
  }
  if (!Number.isFinite(settings.terminalLossFactor) || settings.terminalLossFactor <= 0) {
    throw new RangeError("terminalLossFactor must be positive.");
  }
}

function mapInstallationMethod(method: InstallationMethodCode | string): "overhead" | "underground" {
  switch (method) {
    case "D":
      return "underground";
    case "A1":
    case "A2":
    case "B1":
    case "B2":
    case "C":
    case "E":
      return "overhead";
    default:
      throw new RangeError(`unknown installationMethod: ${method}`);
  }
}

function sectionMm2ToFixedSectionKey(sectionMm2: number): string {
  const exactSingle = LEGACY_SECTION_OPTIONS.find(
    (option) => option.parallelRuns === 1 && option.areaMm2 === sectionMm2,
  );
  if (exactSingle) {
    return exactSingle.key;
  }
  const exactArea = LEGACY_SECTION_OPTIONS.find((option) => option.areaMm2 === sectionMm2);
  if (exactArea) {
    return exactArea.key;
  }
  throw new RangeError(`unsupported sectionMm2 value for legacy mapping: ${sectionMm2}`);
}

function getSegmentId(
  segment: VoltageDropGroupSegmentCompatInput,
  index: number,
): string {
  return segment.id ?? `legacy-${index + 1}`;
}

function hasExplicitTreeTopology(
  segments: readonly VoltageDropGroupSegmentCompatInput[],
): boolean {
  return segments.some((segment) => Object.hasOwn(segment, "parentId"));
}

function normalizeGroupSegmentsToTree(
  segments: readonly VoltageDropGroupSegmentCompatInput[],
  settings: VoltageDropGroupResolvedSettings,
): readonly VoltageDropTreeSegmentInput[] {
  const explicitTopology = hasExplicitTreeTopology(segments);
  if (explicitTopology) {
    for (const [index, segment] of segments.entries()) {
      if (index === 0) {
        continue;
      }
      if (!Object.hasOwn(segment, "parentId")) {
        throw new RangeError(
          `segments[${index}].parentId is required when explicit tree topology is used.`,
        );
      }
    }
  }
  const normalizedIds = segments.map((segment, index) => getSegmentId(segment, index));

  return segments.map((segment, index) => {
    const parentId = explicitTopology
      ? (index === 0 ? (segment.parentId ?? null) : (segment.parentId ?? null))
      : (index === 0 ? null : normalizedIds[index - 1] ?? null);
    const loadPowerKW = segment.loadPowerKW ?? segment.localPowerKW;
    if (loadPowerKW === undefined) {
      throw new RangeError(`segments[${index}].loadPowerKW/localPowerKW is required.`);
    }

    const fixedSectionKey = segment.fixedSectionKey ?? (
      segment.sectionMm2 === undefined
        ? undefined
        : sectionMm2ToFixedSectionKey(segment.sectionMm2)
    );

    return {
      id: normalizedIds[index]!,
      parentId,
      title: segment.title,
      loadPowerKW,
      lengthM: segment.lengthM,
      ...(fixedSectionKey === undefined ? {} : { fixedSectionKey }),
      settings: {
        ...(segment.settings?.cosPhi === undefined ? {} : { cosPhi: segment.settings.cosPhi }),
        ...(segment.settings?.efficiencyPercent === undefined
          ? {}
          : { efficiencyPercent: segment.settings.efficiencyPercent }),
        ...(segment.settings?.conductorMaterial === undefined
          ? {}
          : { conductor: segment.settings.conductorMaterial }),
        ...(segment.settings?.installationMethod === undefined
          ? {}
          : { installation: mapInstallationMethod(segment.settings.installationMethod) }),
        ...(segment.settings?.ambientTemperatureC === undefined
          ? {}
          : { temperatureC: segment.settings.ambientTemperatureC }),
        ...(segment.settings?.groupedCircuits === undefined
          ? {}
          : { groupedCircuits: segment.settings.groupedCircuits }),
        voltageType: settings.phaseMode === "single-phase" ? "single" : "three",
      },
    };
  });
}

export function calculateVoltageDropGroup(input: VoltageDropGroupInput): VoltageDropGroupResult {
  const compatSegments = input.segments as readonly VoltageDropGroupSegmentCompatInput[];
  const totalLocalPowerKW = compatSegments.reduce((sum, segment) => {
    return sum + (segment.loadPowerKW ?? segment.localPowerKW ?? 0);
  }, 0);
  const settings = resolveVoltageDropGroupSettings(input.settings, totalLocalPowerKW);
  validateVoltageDropGroupInput(compatSegments, settings);

  const normalizedTreeSegments = normalizeGroupSegmentsToTree(compatSegments, settings);
  const segmentSettingsById = new Map<string, SegmentResolvedSettings>();
  const outputIdBySegmentId = new Map<string, string | undefined>();
  const orderBySegmentId = new Map<string, number>();
  for (const [index, segment] of compatSegments.entries()) {
    const normalizedId = getSegmentId(segment, index);
    segmentSettingsById.set(normalizedId, resolveSegmentSettings(settings, segment.settings));
    outputIdBySegmentId.set(normalizedId, segment.id);
    orderBySegmentId.set(normalizedId, index);
  }

  const treeCalculation = calculateVoltageDropTreeDetailed({
    ...(input.title === undefined ? {} : { title: input.title }),
    settings: {
      limitPercent: settings.limitPercent,
      baseVoltageV: settings.baseVoltageV,
      cosPhi: settings.cosPhi,
      efficiencyPercent: settings.efficiencyPercent,
      conductor: settings.conductorMaterial,
      installation: mapInstallationMethod(settings.installationMethod),
      temperatureC: settings.ambientTemperatureC,
      groupedCircuits: settings.groupedCircuits,
      voltageType: settings.phaseMode === "single-phase" ? "single" : "three",
    },
    segments: normalizedTreeSegments,
  });
  const treeResult = treeCalculation.result;

  const treeSegmentsById = new Map(
    treeResult.value.segments.map((segment) => [segment.id, segment] as const),
  );
  const segmentOutputs: VoltageDropGroupSegmentOutput[] = normalizedTreeSegments.map((treeInput) => {
    const treeSegment = treeSegmentsById.get(treeInput.id);
    if (!treeSegment) {
      throw new Error(`missing tree segment output for '${treeInput.id}'.`);
    }
    const order = orderBySegmentId.get(treeInput.id);
    const resolvedSegmentSettings = segmentSettingsById.get(treeInput.id);
    if (order === undefined || !resolvedSegmentSettings) {
      throw new Error(`missing segment metadata for '${treeInput.id}'.`);
    }
    const outputId = outputIdBySegmentId.get(treeInput.id);

    return {
      ...(outputId === undefined ? {} : { id: outputId }),
      title: treeSegment.title,
      order,
      localPowerKW: treeSegment.loadPowerKW,
      flowPowerKW: treeSegment.flowPowerKW,
      lengthM: treeSegment.lengthM,
      currentA: treeSegment.currentA,
      selectedSectionMm2: treeSegment.selectedSectionAreaMm2,
      fixedSection: treeSegment.fixedSection,
      settings: resolvedSegmentSettings,
      baseAmpacityA: treeSegment.baseAmpacityA,
      correctedAmpacityA: treeSegment.correctedAmpacityA,
      segmentDeltaVVolts: (treeSegment.segmentDeltaVPercent / 100) * settings.baseVoltageV,
      segmentDeltaVPercent: treeSegment.segmentDeltaVPercent,
      cumulativeDeltaVPercent: treeSegment.cumulativeDeltaVPercent,
      thermalPass: treeSegment.thermalPass,
      voltageDropPass: treeSegment.voltageDropPass,
      compliant: treeSegment.compliant,
    };
  });

  const maxCumulativeDeltaVPercent = segmentOutputs.reduce(
    (max, segment) => Math.max(max, segment.cumulativeDeltaVPercent),
    0,
  );
  const optimizationSteps: VoltageDropGroupOptimizationStep[] = treeCalculation.optimizationSteps.map(
    (step) => {
      const order = orderBySegmentId.get(step.segmentId);
      const segment = treeSegmentsById.get(step.segmentId);
      if (order === undefined || !segment) {
        throw new Error(`missing optimization metadata for '${step.segmentId}'.`);
      }
      return {
        iteration: step.iteration,
        segmentOrder: order,
        segmentTitle: segment.title,
        fromSectionMm2: getSectionOption(step.fromSectionKey).areaMm2,
        toSectionMm2: getSectionOption(step.toSectionKey).areaMm2,
        previousMaxCumulativeDeltaVPercent: step.previousMaxCumulativeDeltaVPercent,
        nextMaxCumulativeDeltaVPercent: step.nextMaxCumulativeDeltaVPercent,
        sensitivityIndex: step.sensitivityIndex,
      };
    },
  );

  const assumptions: AssumptionEntry[] = [];
  const settingsInput = input.settings ?? {};
  for (const key of Object.keys(
    DEFAULT_VOLTAGE_DROP_GROUP_SETTINGS,
  ) as Array<keyof typeof DEFAULT_VOLTAGE_DROP_GROUP_SETTINGS>) {
    if (settingsInput[key] === undefined) {
      assumptions.push({
        field: key,
        usedValue: DEFAULT_VOLTAGE_DROP_GROUP_SETTINGS[key],
        source: "default",
      });
    }
  }

  return {
    value: {
      ...(input.title === undefined ? {} : { title: input.title }),
      settings,
      totalLocalPowerKW,
      maxCumulativeDeltaVPercent,
      isCompliant: segmentOutputs.every((segment) => segment.compliant),
      segments: segmentOutputs,
      optimizationSteps,
    },
    warnings: treeResult.warnings,
    assumptions,
    formulaVariant: "voltage-drop-group-radial-v2",
    dataVersion: VOLTAGE_DROP_GROUP_DATA_VERSION,
    engineVersion: ENGINE_VERSION,
  };
}
