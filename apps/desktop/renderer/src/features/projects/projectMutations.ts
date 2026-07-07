import { useMutation, useQueryClient } from "@tanstack/react-query";
import { PROJECT_MARKER_TAG } from "../../bridge/types";
import type {
  CalculationGroup,
  CalculationRecord,
  ManualCurrentCalculationRecord,
} from "../../bridge/types";
import { getBridge } from "../../bridge/client";
import { queryKeys } from "../../query/keys";

function buildVersion() {
  return { contractVersion: "1" };
}

async function invalidateProjectsQueries(queryClient: ReturnType<typeof useQueryClient>) {
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: queryKeys.groups }),
    queryClient.invalidateQueries({ queryKey: queryKeys.records() }),
  ]);
}

function stripPersistenceTimestamps<T extends object>(item: T): T {
  const { createdAt: _createdAt, updatedAt: _updatedAt, ...rest } = item as T & {
    createdAt?: unknown;
    updatedAt?: unknown;
  };
  return rest as T;
}

function buildGroupingWithQuantity(record: CalculationRecord, quantity: number) {
  const currentGrouping = record.grouping ?? {};
  const { quantity: _previousQuantity, ...restGrouping } = currentGrouping;

  return {
    ...restGrouping,
    ...(record.grouping?.groupId ? { groupId: record.grouping.groupId } : {}),
    ...(quantity > 1 ? { quantity } : {}),
  };
}

export function useProjectMutations() {
  const queryClient = useQueryClient();

  const createProjectMutation = useMutation({
    mutationFn: async (title: string) => {
      const group: CalculationGroup = {
        id: crypto.randomUUID(),
        title: title.trim(),
        tags: [PROJECT_MARKER_TAG],
        version: buildVersion(),
      };

      return getBridge().groups.save(group);
    },
    onSuccess: async () => {
      await invalidateProjectsQueries(queryClient);
    },
  });

  const createGroupMutation = useMutation({
    mutationFn: async ({ projectId, title }: { projectId: string; title: string }) => {
      const group: CalculationGroup = {
        id: crypto.randomUUID(),
        title: title.trim(),
        parentGroupId: projectId,
        version: buildVersion(),
      };

      return getBridge().groups.save(group);
    },
    onSuccess: async () => {
      await invalidateProjectsQueries(queryClient);
    },
  });

  const duplicateGroupMutation = useMutation({
    mutationFn: ({ sourceGroupId, newTitle }: { sourceGroupId: string; newTitle: string }) =>
      getBridge().groups.duplicate(sourceGroupId, newTitle.trim()),
    onSuccess: async () => {
      await invalidateProjectsQueries(queryClient);
    },
  });

  const deleteProjectMutation = useMutation({
    mutationFn: async (projectId: string) => getBridge().groups.delete(projectId),
    onSuccess: async () => {
      await Promise.all([
        invalidateProjectsQueries(queryClient),
        queryClient.invalidateQueries({ queryKey: ["assignments"] }),
      ]);
    },
  });

  const deleteGroupMutation = useMutation({
    mutationFn: async (groupId: string) => getBridge().groups.delete(groupId),
    onSuccess: async () => {
      await Promise.all([
        invalidateProjectsQueries(queryClient),
        queryClient.invalidateQueries({ queryKey: ["assignments"] }),
      ]);
    },
  });

  const deleteRecordMutation = useMutation({
    mutationFn: async (recordId: string) => getBridge().records.delete(recordId),
    onSuccess: async () => {
      await Promise.all([
        invalidateProjectsQueries(queryClient),
        queryClient.invalidateQueries({ queryKey: ["assignments"] }),
      ]);
    },
  });

  const updateRecordQuantityMutation = useMutation({
    mutationFn: async ({ record, quantity }: { record: CalculationRecord; quantity: number }) => {
      const cleanRecord = stripPersistenceTimestamps(record);
      return getBridge().records.save({
        ...cleanRecord,
        grouping: buildGroupingWithQuantity(record, quantity),
      });
    },
    onSuccess: async () => {
      await invalidateProjectsQueries(queryClient);
    },
  });

  const saveRecordMutation = useMutation({
    mutationFn: async (record: CalculationRecord) =>
      getBridge().records.save(stripPersistenceTimestamps(record)),
    onSuccess: async () => {
      await invalidateProjectsQueries(queryClient);
    },
  });

  const createManualCurrentMutation = useMutation({
    mutationFn: async ({
      groupId,
      label,
      currentA,
      quantity,
    }: { groupId: string; label?: string; currentA: number; quantity?: number }) => {
      const record: ManualCurrentCalculationRecord = {
        id: crypto.randomUUID(),
        calculator: "manual-current",
        ...(label?.trim() ? { title: label.trim() } : {}),
        grouping: { groupId, ...(quantity && quantity > 1 ? { quantity } : {}) },
        version: buildVersion(),
        input: { currentA, ...(label?.trim() ? { label: label.trim() } : {}) },
        output: { value: { currentA } },
      };
      return getBridge().records.save(record);
    },
    onSuccess: async () => {
      await invalidateProjectsQueries(queryClient);
    },
  });

  const updateManualCurrentMutation = useMutation({
    mutationFn: async ({
      record,
      label,
      currentA,
    }: { record: ManualCurrentCalculationRecord; label?: string; currentA: number }) => {
      const clean = stripPersistenceTimestamps(record);
      const updated: ManualCurrentCalculationRecord = {
        ...clean,
        calculator: "manual-current",
        ...(label?.trim() ? { title: label.trim() } : {}),
        input: { currentA, ...(label?.trim() ? { label: label.trim() } : {}) },
        output: { value: { currentA } },
      };
      return getBridge().records.save(updated);
    },
    onSuccess: async () => {
      await invalidateProjectsQueries(queryClient);
    },
  });

  return {
    createProject: createProjectMutation.mutateAsync,
    createGroup: createGroupMutation.mutateAsync,
    duplicateGroup: duplicateGroupMutation.mutateAsync,
    deleteProject: deleteProjectMutation.mutateAsync,
    deleteGroup: deleteGroupMutation.mutateAsync,
    deleteRecord: deleteRecordMutation.mutateAsync,
    saveRecord: saveRecordMutation.mutateAsync,
    updateRecordQuantity: updateRecordQuantityMutation.mutateAsync,
    createManualCurrent: createManualCurrentMutation.mutateAsync,
    updateManualCurrent: updateManualCurrentMutation.mutateAsync,
    isCreatingProject: createProjectMutation.isPending,
    isCreatingGroup: createGroupMutation.isPending,
    isDuplicatingGroup: duplicateGroupMutation.isPending,
    isDeletingProject: deleteProjectMutation.isPending,
    isDeletingGroup: deleteGroupMutation.isPending,
    isDeletingRecord: deleteRecordMutation.isPending,
    isSavingRecord: saveRecordMutation.isPending,
    isUpdatingRecordQuantity: updateRecordQuantityMutation.isPending,
    isCreatingManualCurrent: createManualCurrentMutation.isPending,
    isPending:
      createProjectMutation.isPending ||
      createGroupMutation.isPending ||
      duplicateGroupMutation.isPending ||
      deleteProjectMutation.isPending ||
      deleteGroupMutation.isPending ||
      deleteRecordMutation.isPending ||
      saveRecordMutation.isPending ||
      updateRecordQuantityMutation.isPending ||
      createManualCurrentMutation.isPending ||
      updateManualCurrentMutation.isPending,
  };
}
