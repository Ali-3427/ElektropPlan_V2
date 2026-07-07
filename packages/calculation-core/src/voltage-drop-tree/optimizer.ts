import { SQRT3 } from "../common/constants/index.js";
import {
  getAmpacityTable,
  getGroupFactor,
  getNextSectionOption,
  getSectionOption,
  getTemperatureFactor,
  LEGACY_SECTION_OPTIONS,
} from "./legacy-tables.js";
import type { VoltageDropTreeGraph } from "./graph.js";
import type {
  LegacyConductor,
  LegacyInstallation,
  LegacyVoltageType,
  LegacySectionOption,
  VoltageDropTreeSegmentInput,
  VoltageDropTreeSegmentOutput,
} from "./types.js";

export interface OptimizerResolvedSettings {
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

export interface SegmentResolvedSettings {
  readonly cosPhi: number;
  readonly efficiencyPercent: number;
  readonly conductor: LegacyConductor;
  readonly installation: LegacyInstallation;
  readonly temperatureC: number;
  readonly groupedCircuits: number;
  readonly voltageType: LegacyVoltageType;
}

export interface VoltageDropTreeOptimizationStep {
  readonly iteration: number;
  readonly segmentId: string;
  readonly fromSectionKey: string;
  readonly toSectionKey: string;
  readonly previousMaxCumulativeDeltaVPercent: number;
  readonly nextMaxCumulativeDeltaVPercent: number;
  readonly sensitivityIndex: number;
}

export interface OptimizerSegmentOutput extends VoltageDropTreeSegmentOutput {
  readonly settings: SegmentResolvedSettings;
}

interface SegmentComputedState {
  readonly id: string;
  readonly section: LegacySectionOption;
  readonly fixedSection: boolean;
  readonly currentA: number;
  readonly baseAmpacityA: number;
  readonly correctedAmpacityA: number;
  readonly thermalPass: boolean;
  readonly segmentDeltaVPercent: number;
  readonly cumulativeDeltaVPercent: number;
  readonly voltageDropPass: boolean;
  readonly compliant: boolean;
}

export interface VoltageDropTreeOptimizationResult {
  readonly segments: readonly OptimizerSegmentOutput[];
  readonly maxCumulativeDeltaVPercent: number;
  readonly isCompliant: boolean;
  readonly optimizationSteps: readonly VoltageDropTreeOptimizationStep[];
}

function getConductivity(conductor: LegacyConductor): 56 | 35 {
  return conductor === "copper" ? 56 : 35;
}

function getPhaseMode(voltageType: LegacyVoltageType): "single-phase" | "three-phase" {
  return voltageType === "three" ? "three-phase" : "single-phase";
}

function calculateCurrentA(
  flowPowerKW: number,
  settings: SegmentResolvedSettings,
  baseVoltageV: number,
): number {
  const efficiency = settings.efficiencyPercent / 100;
  const denominator =
    settings.voltageType === "three"
      ? SQRT3 * baseVoltageV * settings.cosPhi * efficiency
      : baseVoltageV * settings.cosPhi * efficiency;
  return (flowPowerKW * 1000) / denominator;
}

export function calculateLegacyDropPercent(input: {
  readonly phaseMode: "single-phase" | "three-phase";
  readonly powerKW: number;
  readonly lengthM: number;
  readonly voltageV: number;
  readonly conductivity: 56 | 35;
  readonly areaMm2: number;
}): number {
  const multiplier = input.phaseMode === "three-phase" ? 100 : 200;
  return (
    (multiplier * input.powerKW * 1000 * input.lengthM) /
    (input.conductivity * input.areaMm2 * input.voltageV * input.voltageV)
  );
}

function buildSegmentSettingsMap(
  graph: VoltageDropTreeGraph,
  settings: OptimizerResolvedSettings,
): ReadonlyMap<string, SegmentResolvedSettings> {
  const byId = new Map<string, SegmentResolvedSettings>();
  for (const segmentId of graph.orderedIds) {
    const segment = graph.segmentsById.get(segmentId);
    if (!segment) {
      throw new Error(`segment '${segmentId}' is missing from graph.`);
    }
    byId.set(segmentId, {
      cosPhi: segment.settings?.cosPhi ?? settings.cosPhi,
      efficiencyPercent: segment.settings?.efficiencyPercent ?? settings.efficiencyPercent,
      conductor: segment.settings?.conductor ?? settings.conductor,
      installation: segment.settings?.installation ?? settings.installation,
      temperatureC: segment.settings?.temperatureC ?? settings.temperatureC,
      groupedCircuits: segment.settings?.groupedCircuits ?? settings.groupedCircuits,
      voltageType: segment.settings?.voltageType ?? settings.voltageType,
    });
  }
  return byId;
}

function selectInitialSection(
  segment: VoltageDropTreeSegmentInput,
  segmentSettings: SegmentResolvedSettings,
  currentA: number,
): { section: LegacySectionOption; fixedSection: boolean } {
  if (segment.fixedSectionKey) {
    return {
      section: getSectionOption(segment.fixedSectionKey),
      fixedSection: true,
    };
  }

  const ampacityTable = getAmpacityTable(
    segmentSettings.conductor,
    segmentSettings.installation,
  );
  const correctedFactor =
    getTemperatureFactor(segmentSettings.temperatureC) * getGroupFactor(segmentSettings.groupedCircuits);

  for (const option of LEGACY_SECTION_OPTIONS) {
    const baseAmpacityA = ampacityTable[option.key];
    if (baseAmpacityA === undefined) {
      continue;
    }
    if (baseAmpacityA * correctedFactor >= currentA) {
      return {
        section: option,
        fixedSection: false,
      };
    }
  }

  throw new RangeError(
    `No cable cross-section satisfies thermal current for segment '${segment.title}'.`,
  );
}

function evaluateCurrentState(input: {
  graph: VoltageDropTreeGraph;
  globalSettings: OptimizerResolvedSettings;
  settingsById: ReadonlyMap<string, SegmentResolvedSettings>;
  selectedSectionById: ReadonlyMap<string, LegacySectionOption>;
  fixedSectionById: ReadonlyMap<string, boolean>;
}): {
  byId: ReadonlyMap<string, SegmentComputedState>;
  maxCumulativeDeltaVPercent: number;
  failingSegmentIds: readonly string[];
} {
  const byId = new Map<string, SegmentComputedState>();
  let maxCumulativeDeltaVPercent = 0;

  for (const segmentId of input.graph.orderedIds) {
    const segment = input.graph.segmentsById.get(segmentId);
    const flowPowerKW = input.graph.flowPowerById.get(segmentId);
    const pathIds = input.graph.pathIdsById.get(segmentId);
    const section = input.selectedSectionById.get(segmentId);
    const fixedSection = input.fixedSectionById.get(segmentId);
    const settings = input.settingsById.get(segmentId);

    if (!segment || flowPowerKW === undefined || !pathIds || !section || fixedSection === undefined || !settings) {
      throw new Error(`incomplete segment state for '${segmentId}'.`);
    }

    const currentA = calculateCurrentA(flowPowerKW, settings, input.globalSettings.baseVoltageV);
    const ampacityTable = getAmpacityTable(settings.conductor, settings.installation);
    const baseAmpacityA = ampacityTable[section.key] ?? 0;
    const correctedAmpacityA =
      baseAmpacityA * getTemperatureFactor(settings.temperatureC) * getGroupFactor(settings.groupedCircuits);
    const thermalPass = correctedAmpacityA >= currentA;
    const segmentDeltaVPercent = calculateLegacyDropPercent({
      phaseMode: getPhaseMode(settings.voltageType),
      powerKW: flowPowerKW,
      lengthM: segment.lengthM,
      voltageV: input.globalSettings.baseVoltageV,
      conductivity: getConductivity(settings.conductor),
      areaMm2: section.areaMm2,
    });

    const cumulativeDeltaVPercent = pathIds.reduce((sum, pathId) => {
      const state = byId.get(pathId);
      if (pathId === segmentId) {
        return sum + segmentDeltaVPercent;
      }
      if (!state) {
        throw new Error(`missing voltage drop for segment '${pathId}'.`);
      }
      return sum + state.segmentDeltaVPercent;
    }, 0);

    maxCumulativeDeltaVPercent = Math.max(maxCumulativeDeltaVPercent, cumulativeDeltaVPercent);
    const voltageDropPass = cumulativeDeltaVPercent <= input.globalSettings.limitPercent;
    byId.set(segmentId, {
      id: segmentId,
      section,
      fixedSection,
      currentA,
      baseAmpacityA,
      correctedAmpacityA,
      thermalPass,
      segmentDeltaVPercent,
      cumulativeDeltaVPercent,
      voltageDropPass,
      compliant: thermalPass && voltageDropPass,
    });
  }

  const failingSegmentIds = input.graph.orderedIds.filter((segmentId) => {
    const state = byId.get(segmentId);
    if (!state) {
      throw new Error(`missing state for segment '${segmentId}'.`);
    }
    return !state.voltageDropPass;
  });

  return {
    byId,
    maxCumulativeDeltaVPercent,
    failingSegmentIds,
  };
}

function selectBestCandidate(input: {
  graph: VoltageDropTreeGraph;
  globalSettings: OptimizerResolvedSettings;
  settingsById: ReadonlyMap<string, SegmentResolvedSettings>;
  fixedSectionById: ReadonlyMap<string, boolean>;
  evaluated: ReturnType<typeof evaluateCurrentState>;
}): {
  segmentId: string;
  nextSection: LegacySectionOption;
  sensitivityIndex: number;
} | null {
  if (input.evaluated.failingSegmentIds.length === 0) {
    return null;
  }

  const firstFailingId = input.evaluated.failingSegmentIds[0];
  if (!firstFailingId) {
    return null;
  }
  let failingSegmentId = firstFailingId;
  let maxExcess = -Infinity;
  for (const segmentId of input.evaluated.failingSegmentIds) {
    const state = input.evaluated.byId.get(segmentId);
    if (!state) {
      throw new Error(`missing state for segment '${segmentId}'.`);
    }
    const excess = state.cumulativeDeltaVPercent - input.globalSettings.limitPercent;
    if (excess > maxExcess) {
      maxExcess = excess;
      failingSegmentId = segmentId;
    }
  }

  const failingPath = input.graph.pathIdsById.get(failingSegmentId);
  if (!failingPath) {
    throw new Error(`missing path for failing segment '${failingSegmentId}'.`);
  }

  const failingSegments = input.evaluated.failingSegmentIds.map((segmentId) => {
    const state = input.evaluated.byId.get(segmentId);
    const pathIds = input.graph.pathIdsById.get(segmentId);
    if (!state || !pathIds) {
      throw new Error(`incomplete failing segment data for '${segmentId}'.`);
    }
    return { state, pathIds };
  });

  let best: {
    segmentId: string;
    nextSection: LegacySectionOption;
    sensitivityIndex: number;
  } | null = null;

  for (const candidateId of failingPath) {
    if (input.fixedSectionById.get(candidateId)) {
      continue;
    }
    const settings = input.settingsById.get(candidateId);
    const currentState = input.evaluated.byId.get(candidateId);
    if (!settings || !currentState) {
      throw new Error(`missing candidate state for '${candidateId}'.`);
    }

    const nextSection = getNextSectionOption(currentState.section.key, settings.conductor);
    if (!nextSection) {
      continue;
    }

    const deltaArea = nextSection.areaMm2 - currentState.section.areaMm2;
    if (deltaArea <= 0) {
      continue;
    }

    const candidateFlowPowerKW = input.graph.flowPowerById.get(candidateId);
    if (candidateFlowPowerKW === undefined) {
      throw new Error(`missing flow power for candidate segment '${candidateId}'.`);
    }
    const candidateSegment = input.graph.segmentsById.get(candidateId);
    if (!candidateSegment) {
      throw new Error(`missing segment data for candidate segment '${candidateId}'.`);
    }

    const nextDropPercent = calculateLegacyDropPercent({
      phaseMode: getPhaseMode(settings.voltageType),
      powerKW: candidateFlowPowerKW,
      lengthM: candidateSegment.lengthM,
      voltageV: input.globalSettings.baseVoltageV,
      conductivity: getConductivity(settings.conductor),
      areaMm2: nextSection.areaMm2,
    });
    const gainPerArea = (currentState.segmentDeltaVPercent - nextDropPercent) / deltaArea;
    if (!(gainPerArea > 0)) {
      continue;
    }

    const affectedFailingCount = failingSegments.filter((failing) =>
      failing.pathIds.includes(candidateId),
    ).length;
    const sensitivityIndex = gainPerArea * affectedFailingCount;
    if (!(sensitivityIndex > 0)) {
      continue;
    }

    if (!best || sensitivityIndex > best.sensitivityIndex) {
      best = { segmentId: candidateId, nextSection, sensitivityIndex };
    }
  }

  return best;
}

export function optimizeVoltageDropTree(input: {
  readonly graph: VoltageDropTreeGraph;
  readonly settings: OptimizerResolvedSettings;
}): VoltageDropTreeOptimizationResult {
  const settingsById = buildSegmentSettingsMap(input.graph, input.settings);
  const selectedSectionById = new Map<string, LegacySectionOption>();
  const fixedSectionById = new Map<string, boolean>();

  for (const segmentId of input.graph.orderedIds) {
    const segment = input.graph.segmentsById.get(segmentId);
    const flowPowerKW = input.graph.flowPowerById.get(segmentId);
    const segmentSettings = settingsById.get(segmentId);
    if (!segment || flowPowerKW === undefined || !segmentSettings) {
      throw new Error(`incomplete setup for segment '${segmentId}'.`);
    }

    const currentA = calculateCurrentA(flowPowerKW, segmentSettings, input.settings.baseVoltageV);
    const initial = selectInitialSection(segment, segmentSettings, currentA);
    selectedSectionById.set(segmentId, initial.section);
    fixedSectionById.set(segmentId, initial.fixedSection);
  }

  const optimizationSteps: VoltageDropTreeOptimizationStep[] = [];
  const maxIterations = input.graph.orderedIds.length * LEGACY_SECTION_OPTIONS.length;

  for (let iteration = 1; iteration <= maxIterations; iteration += 1) {
    const evaluated = evaluateCurrentState({
      graph: input.graph,
      globalSettings: input.settings,
      settingsById,
      selectedSectionById,
      fixedSectionById,
    });

    if (evaluated.failingSegmentIds.length === 0) {
      const segments = input.graph.orderedIds.map((segmentId) => {
        const segment = input.graph.segmentsById.get(segmentId);
        const pathIds = input.graph.pathIdsById.get(segmentId);
        const childIds = input.graph.childIdsById.get(segmentId);
        const flowPowerKW = input.graph.flowPowerById.get(segmentId);
        const state = evaluated.byId.get(segmentId);
        const settings = settingsById.get(segmentId);
        if (!segment || !pathIds || !childIds || flowPowerKW === undefined || !state || !settings) {
          throw new Error(`missing final segment data for '${segmentId}'.`);
        }
        return {
          id: segment.id,
          parentId: segment.parentId,
          title: segment.title,
          depth: pathIds.length - 1,
          childIds,
          pathIds,
          loadPowerKW: segment.loadPowerKW,
          flowPowerKW,
          lengthM: segment.lengthM,
          currentA: state.currentA,
          selectedSectionKey: state.section.key,
          selectedSectionAreaMm2: state.section.areaMm2,
          selectedParallelRuns: state.section.parallelRuns,
          fixedSection: state.fixedSection,
          baseAmpacityA: state.baseAmpacityA,
          correctedAmpacityA: state.correctedAmpacityA,
          segmentDeltaVPercent: state.segmentDeltaVPercent,
          cumulativeDeltaVPercent: state.cumulativeDeltaVPercent,
          thermalPass: state.thermalPass,
          voltageDropPass: state.voltageDropPass,
          compliant: state.compliant,
          settings,
        } satisfies OptimizerSegmentOutput;
      });

      return {
        segments,
        maxCumulativeDeltaVPercent: evaluated.maxCumulativeDeltaVPercent,
        isCompliant: segments.every((segment) => segment.compliant),
        optimizationSteps,
      };
    }

    const candidate = selectBestCandidate({
      graph: input.graph,
      globalSettings: input.settings,
      settingsById,
      fixedSectionById,
      evaluated,
    });

    if (!candidate) {
      throw new RangeError("No cable cross-section satisfies the voltage-drop limit for this tree.");
    }

    const current = selectedSectionById.get(candidate.segmentId);
    if (!current) {
      throw new Error(`missing selected section for segment '${candidate.segmentId}'.`);
    }
    selectedSectionById.set(candidate.segmentId, candidate.nextSection);

    const nextEvaluated = evaluateCurrentState({
      graph: input.graph,
      globalSettings: input.settings,
      settingsById,
      selectedSectionById,
      fixedSectionById,
    });

    optimizationSteps.push({
      iteration,
      segmentId: candidate.segmentId,
      fromSectionKey: current.key,
      toSectionKey: candidate.nextSection.key,
      previousMaxCumulativeDeltaVPercent: evaluated.maxCumulativeDeltaVPercent,
      nextMaxCumulativeDeltaVPercent: nextEvaluated.maxCumulativeDeltaVPercent,
      sensitivityIndex: candidate.sensitivityIndex,
    });
  }

  throw new RangeError("No cable cross-section satisfies the voltage-drop limit for this tree.");
}
