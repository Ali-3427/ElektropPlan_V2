import type { AssumptionEntry, CalculationResult, WarningEntry } from "../common/types/result.js";
import { ENGINE_VERSION } from "../version.js";
import { buildVoltageDropTreeGraph } from "./graph.js";
import { getGroupFactorResult } from "./legacy-tables.js";
import {
  optimizeVoltageDropTree,
  type OptimizerResolvedSettings,
  type VoltageDropTreeOptimizationStep,
} from "./optimizer.js";
import type {
  VoltageDropTreeInput,
  VoltageDropTreeOutput,
  VoltageDropTreeResolvedSettings,
  VoltageDropTreeSegmentInput,
  VoltageDropTreeSettingsInput,
} from "./types.js";

export const VOLTAGE_DROP_TREE_DATA_VERSION = "voltage-drop-tree-radial-v1";

export const DEFAULT_VOLTAGE_DROP_TREE_SETTINGS = {
  limitPercent: 3,
  baseVoltageV: 400,
  cosPhi: 0.8,
  efficiencyPercent: 100,
  conductor: "copper",
  installation: "overhead",
  temperatureC: 30,
  groupedCircuits: 1,
  voltageType: "three",
} as const satisfies VoltageDropTreeResolvedSettings;

function resolveVoltageDropTreeSettings(
  input: VoltageDropTreeSettingsInput | undefined,
): VoltageDropTreeResolvedSettings {
  return {
    ...DEFAULT_VOLTAGE_DROP_TREE_SETTINGS,
    ...(input ?? {}),
  };
}

function validateTreeInput(
  input: VoltageDropTreeInput,
  settings: VoltageDropTreeResolvedSettings,
): void {
  if (input.segments.length === 0) {
    throw new RangeError("segments must contain at least one segment.");
  }

  for (const [index, segment] of input.segments.entries()) {
    if (!segment.id || segment.id.trim() === "") {
      throw new RangeError(`segments[${index}].id must be a non-empty string.`);
    }
    if (!segment.title || segment.title.trim() === "") {
      throw new RangeError(`segments[${index}].title must be a non-empty string.`);
    }
    if (!Number.isFinite(segment.loadPowerKW) || segment.loadPowerKW < 0) {
      throw new RangeError(`segments[${index}].loadPowerKW must be zero or positive.`);
    }
    if (!Number.isFinite(segment.lengthM) || segment.lengthM <= 0) {
      throw new RangeError(`segments[${index}].lengthM must be positive.`);
    }
  }

  if (!Number.isFinite(settings.limitPercent) || settings.limitPercent <= 0) {
    throw new RangeError("limitPercent must be positive.");
  }
  if (!Number.isFinite(settings.baseVoltageV) || settings.baseVoltageV <= 0) {
    throw new RangeError("baseVoltageV must be positive.");
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
}

function collectSettingAssumptions(
  settingsInput: VoltageDropTreeSettingsInput | undefined,
): AssumptionEntry[] {
  const assumptions: AssumptionEntry[] = [];
  for (const key of Object.keys(DEFAULT_VOLTAGE_DROP_TREE_SETTINGS) as Array<
    keyof typeof DEFAULT_VOLTAGE_DROP_TREE_SETTINGS
  >) {
    if (settingsInput?.[key] === undefined) {
      assumptions.push({
        field: key,
        usedValue: DEFAULT_VOLTAGE_DROP_TREE_SETTINGS[key],
        source: "default",
      });
    }
  }
  return assumptions;
}

function addGroupedCircuitWarnings(
  warnings: WarningEntry[],
  label: string,
  groupedCircuits: number,
): void {
  const groupFactor = getGroupFactorResult(groupedCircuits);
  if (!groupFactor.warning) {
    return;
  }
  warnings.push({
    code: "grouped-circuits-out-of-range",
    messageKey: "voltageDropTree.groupedCircuitsOutOfRange",
    detail: `${label}: ${groupFactor.warning}`,
  });
}

export function calculateVoltageDropTree(
  input: VoltageDropTreeInput,
): CalculationResult<VoltageDropTreeOutput> {
  return calculateVoltageDropTreeDetailed(input).result;
}

export interface VoltageDropTreeCalculationDetails {
  readonly result: CalculationResult<VoltageDropTreeOutput>;
  readonly optimizationSteps: readonly VoltageDropTreeOptimizationStep[];
}

export function calculateVoltageDropTreeDetailed(
  input: VoltageDropTreeInput,
): VoltageDropTreeCalculationDetails {
  const settings = resolveVoltageDropTreeSettings(input.settings);
  validateTreeInput(input, settings);

  const warnings: WarningEntry[] = [];
  addGroupedCircuitWarnings(warnings, "settings", settings.groupedCircuits);
  for (const segment of input.segments) {
    const groupedCircuits = segment.settings?.groupedCircuits;
    if (groupedCircuits === undefined) {
      continue;
    }
    addGroupedCircuitWarnings(warnings, `segment '${segment.id}'`, groupedCircuits);
  }

  const assumptions = collectSettingAssumptions(input.settings);
  const graph = buildVoltageDropTreeGraph(input.segments);
  const optimized = optimizeVoltageDropTree({
    graph,
    settings: settings as OptimizerResolvedSettings,
  });

  const totalLoadPowerKW = input.segments.reduce(
    (sum, segment) => sum + segment.loadPowerKW,
    0,
  );

  return {
    result: {
      value: {
        ...(input.title === undefined ? {} : { title: input.title }),
        settings,
        segments: optimized.segments.map((segment) => {
          const { settings: _settings, ...rest } = segment;
          void _settings;
          return rest;
        }),
        rootSegmentIds: [graph.rootId],
        totalLoadPowerKW,
        maxCumulativeDeltaVPercent: optimized.maxCumulativeDeltaVPercent,
        totalVoltageDropOk:
          optimized.maxCumulativeDeltaVPercent <= settings.limitPercent,
        isCompliant: optimized.isCompliant,
      },
      warnings,
      assumptions,
      formulaVariant: "voltage-drop-tree-radial-v1",
      dataVersion: VOLTAGE_DROP_TREE_DATA_VERSION,
      engineVersion: ENGINE_VERSION,
    },
    optimizationSteps: optimized.optimizationSteps,
  };
}
