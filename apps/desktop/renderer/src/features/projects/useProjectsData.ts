import { useMemo } from "react";
import { useQueries, useQuery } from "@tanstack/react-query";
import { PROJECT_MARKER_TAG, isProjectGroup } from "../../bridge/types";
import type { CalculationGroup, CalculationRecord } from "../../bridge/types";
import { getBridge, isBridgeAvailable } from "../../bridge/client";
import { queryKeys } from "../../query/keys";

export const CALCULATOR_LABELS: Record<CalculationRecord["calculator"], string> = {
  "voltage-drop-group": "Gerilim düşümü grubu",
  motor: "Motor Akımı",
  "voltage-drop": "Gerilim düşümü",
  cable: "Kablo kesiti",
  protection: "Koruma cihazı",
  "manual-current": "Manuel akım",
};

export interface GroupCableSuggestionEntry {
  readonly sectionMm2: number;
  readonly label: string;
  readonly ampacityA: number;
  readonly standardHintMm2?: 2.5 | 4;
}

export interface GroupCableSuggestionResult {
  readonly toprak_20C: GroupCableSuggestionEntry | null;
  readonly hava_30C: GroupCableSuggestionEntry | null;
}

export interface ProjectRecordView {
  readonly record: CalculationRecord;
  readonly quantity: number;
  readonly unitCurrentA: number;
  readonly totalCurrentA: number;
}

export interface VoltageDropGroupSummary {
  readonly segmentCount: number;
  readonly totalLocalPowerKW: number;
  readonly maxCumulativeDeltaVPercent: number;
  readonly isCompliant: boolean;
}

export interface ProjectGroupView {
  readonly group: CalculationGroup;
  readonly records: readonly ProjectRecordView[];
  readonly recordCount: number;
  readonly totalCurrentA: number;
  readonly cableSuggestion: GroupCableSuggestionResult | null;
  readonly cableSuggestionLoading: boolean;
  readonly cableSuggestionError: string | null;
}

export interface ProjectView {
  readonly project: CalculationGroup;
  readonly groups: readonly ProjectGroupView[];
  readonly groupCount: number;
  readonly recordCount: number;
  readonly totalCurrentA: number;
}

export interface UseProjectsDataOptions {
  readonly enableCableSuggestions?: boolean;
}

function sortGroups(groups: readonly CalculationGroup[]): CalculationGroup[] {
  return [...groups].sort((left, right) => {
    const orderDelta = (left.order ?? Number.MAX_SAFE_INTEGER) - (right.order ?? Number.MAX_SAFE_INTEGER);
    if (orderDelta !== 0) {
      return orderDelta;
    }

    return left.title.localeCompare(right.title, "tr");
  });
}

export function getRecordQuantity(record: CalculationRecord): number {
  return Math.max(1, record.grouping?.quantity ?? 1);
}

export function getRecordUnitCurrentA(record: CalculationRecord): number {
  if (record.calculator !== "motor" && record.calculator !== "manual-current") {
    // Only load-bearing records (motor, manual-current) count toward group current
    // totals; voltage-drop-group and other design records must not affect them.
    return 0;
  }

  const currentA = record.output.value.currentA;
  return typeof currentA === "number" && Number.isFinite(currentA) ? currentA : 0;
}

export function getRecordMotorPowerKW(record: CalculationRecord): number | null {
  if (record.calculator !== "motor") {
    return null;
  }

  const powerKW =
    record.output.value.mode === "formula" ? record.output.value.P_out : record.output.value.kW;
  return typeof powerKW === "number" && Number.isFinite(powerKW) ? powerKW : null;
}

export function getVoltageDropGroupSummary(record: CalculationRecord): VoltageDropGroupSummary | null {
  if (record.calculator !== "voltage-drop-group") {
    return null;
  }

  const output = record.output.value;
  return {
    segmentCount: output.segments.length,
    totalLocalPowerKW: output.totalLocalPowerKW,
    maxCumulativeDeltaVPercent: output.maxCumulativeDeltaVPercent,
    isCompliant: output.isCompliant,
  };
}

export function getRecordDisplayTitle(record: CalculationRecord): string {
  if (record.title?.trim()) {
    return record.title.trim();
  }

  if (record.calculator === "manual-current" && record.input.label?.trim()) {
    return record.input.label.trim();
  }

  return CALCULATOR_LABELS[record.calculator] ?? record.calculator;
}

export function useProjectsData(options?: UseProjectsDataOptions) {
  const enableCableSuggestions = options?.enableCableSuggestions ?? true;
  const groupsQuery = useQuery({
    queryKey: queryKeys.groups,
    queryFn: () => getBridge().groups.list(),
    enabled: isBridgeAvailable(),
  });

  const recordsQuery = useQuery({
    queryKey: queryKeys.records(),
    queryFn: () => getBridge().records.list({}),
    enabled: isBridgeAvailable(),
  });

  const rawGroups = groupsQuery.data ?? [];
  const rawRecords = recordsQuery.data ?? [];

  const baseProjects = useMemo(() => {
    const recordsByGroupId = new Map<string, CalculationRecord[]>();

    for (const record of rawRecords) {
      const groupId = record.grouping?.groupId;
      if (!groupId) {
        continue;
      }

      const bucket = recordsByGroupId.get(groupId) ?? [];
      bucket.push(record);
      recordsByGroupId.set(groupId, bucket);
    }

    return sortGroups(rawGroups.filter((group) => isProjectGroup(group))).map((project) => {
      const groups = sortGroups(rawGroups.filter((group) => group.parentGroupId === project.id)).map((group) => {
        const records = (recordsByGroupId.get(group.id) ?? []).map((record) => {
          const quantity = getRecordQuantity(record);
          const unitCurrentA = getRecordUnitCurrentA(record);
          return {
            record,
            quantity,
            unitCurrentA,
            totalCurrentA: unitCurrentA * quantity,
          } satisfies ProjectRecordView;
        });

        const totalCurrentA = records.reduce((sum, item) => sum + item.totalCurrentA, 0);

        return {
          group,
          records,
          recordCount: records.length,
          totalCurrentA,
        };
      });

      return {
        project,
        groups,
        groupCount: groups.length,
        recordCount: groups.reduce((sum, group) => sum + group.recordCount, 0),
        totalCurrentA: groups.reduce((sum, group) => sum + group.totalCurrentA, 0),
      };
    });
  }, [rawGroups, rawRecords]);

  const flatGroups = useMemo(
    () =>
      baseProjects.flatMap((project) =>
        project.groups.map((group) => ({
          projectId: project.project.id,
          groupId: group.group.id,
          totalCurrentA: group.totalCurrentA,
        })),
      ),
    [baseProjects],
  );

  const calcBridge = isBridgeAvailable() ? getBridge().calc : null;

  const cableSuggestionQueries = useQueries({
    queries: flatGroups.map((group) => ({
      queryKey: [
        "group-cable-suggest",
        group.groupId,
        Math.round(group.totalCurrentA * 100),
      ] as const,
      queryFn: () => calcBridge?.groupCableSuggest(group.totalCurrentA) ?? Promise.resolve(null),
      enabled:
        enableCableSuggestions &&
        isBridgeAvailable() &&
        group.totalCurrentA > 0,
      staleTime: 60_000,
    })),
  });

  const queryIndexByGroupId = useMemo(
    () => new Map(flatGroups.map((group, index) => [group.groupId, index])),
    [flatGroups],
  );

  const projects = useMemo(
    () =>
      baseProjects.map((project) => ({
        ...project,
        groups: project.groups.map((group) => {
          const queryIndex = queryIndexByGroupId.get(group.group.id);
          const cableQuery = queryIndex === undefined ? null : cableSuggestionQueries[queryIndex] ?? null;

          return {
            ...group,
            cableSuggestion: cableQuery?.data ?? null,
            cableSuggestionLoading: cableQuery?.isLoading ?? false,
            cableSuggestionError: cableQuery?.error instanceof Error ? cableQuery.error.message : null,
          } satisfies ProjectGroupView;
        }),
      })),
    [baseProjects, cableSuggestionQueries, queryIndexByGroupId],
  );

  return {
    projects,
    rawGroups,
    rawRecords,
    isLoading: groupsQuery.isLoading || recordsQuery.isLoading,
    isError: groupsQuery.isError || recordsQuery.isError,
    error:
      (groupsQuery.error instanceof Error ? groupsQuery.error.message : null) ??
      (recordsQuery.error instanceof Error ? recordsQuery.error.message : null),
    projectMarkerTag: PROJECT_MARKER_TAG,
  };
}

export { PROJECT_MARKER_TAG, isProjectGroup };
