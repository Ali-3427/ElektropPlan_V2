import { randomUUID } from "node:crypto";

import {
  calculationGroupSchema,
  calculationRecordSchema,
  type CalculationGroup,
  type CalculationRecord,
} from "@elektroplan/contracts";
import type {
  PersistedCalculationGroup,
  PersistedCalculationRecord,
  StorageRepositories,
} from "@elektroplan/storage";

export interface ListRecordsOptions {
  readonly groupId?: string;
}

export interface RecordsService {
  listRecords(options?: ListRecordsOptions): readonly PersistedCalculationRecord[];
  getRecord(id: string): PersistedCalculationRecord | null;
  saveRecord(record: unknown): PersistedCalculationRecord;
  deleteRecord(id: string): boolean;
  listGroups(): readonly PersistedCalculationGroup[];
  saveGroup(group: unknown): PersistedCalculationGroup;
  duplicateGroup(sourceGroupId: string, newTitle: string): PersistedCalculationGroup;
  deleteGroup(id: string): boolean;
}

function cloneGroupingForDuplicate(
  sourceRecord: PersistedCalculationRecord,
  duplicatedGroup: PersistedCalculationGroup,
): CalculationRecord["grouping"] {
  const clonedGrouping = sourceRecord.grouping
    ? structuredClone(sourceRecord.grouping)
    : {};

  const groupPath =
    clonedGrouping.groupPath && clonedGrouping.groupPath.length > 0
      ? [
          ...clonedGrouping.groupPath.slice(0, clonedGrouping.groupPath.length - 1),
          duplicatedGroup.title,
        ]
      : clonedGrouping.groupPath;

  return {
    ...clonedGrouping,
    groupId: duplicatedGroup.id,
    ...(clonedGrouping.groupTitle !== undefined
      ? { groupTitle: duplicatedGroup.title }
      : {}),
    ...(groupPath !== undefined ? { groupPath } : {}),
  };
}

export function createRecordsService(
  repos: Pick<StorageRepositories, "groups" | "records" | "transaction">,
): RecordsService {
  const { groups, records, transaction } = repos;

  return {
    listRecords(options) {
      if (options?.groupId !== undefined) {
        return records.list({ groupId: options.groupId });
      }
      return records.list();
    },
    getRecord(id: string) {
      if (typeof id !== "string" || id.length === 0) {
        throw new TypeError("Record id must be a non-empty string.");
      }
      return records.getById(id);
    },
    saveRecord(record: unknown) {
      const parsed: CalculationRecord = calculationRecordSchema.parse(record);
      return records.upsert(parsed);
    },
    deleteRecord(id: string) {
      if (typeof id !== "string" || id.length === 0) {
        throw new TypeError("Record id must be a non-empty string.");
      }
      return records.delete(id);
    },
    listGroups() {
      return groups.list();
    },
    saveGroup(group: unknown) {
      const parsed: CalculationGroup = calculationGroupSchema.parse(group);
      return groups.upsert(parsed);
    },
    duplicateGroup(sourceGroupId: string, newTitle: string) {
      if (typeof sourceGroupId !== "string" || sourceGroupId.length === 0) {
        throw new TypeError("sourceGroupId must be a non-empty string.");
      }
      if (typeof newTitle !== "string" || newTitle.trim().length === 0) {
        throw new TypeError("newTitle must be a non-empty string.");
      }

      const sourceGroup = groups.getById(sourceGroupId);
      if (sourceGroup === null) {
        throw new RangeError(`Group '${sourceGroupId}' not found.`);
      }

      return transaction(() => {
        const duplicatedGroupId = randomUUID();
        const {
          createdAt: _createdAt,
          updatedAt: _updatedAt,
          ...groupWithoutTimestamps
        } = sourceGroup;
        const sanitizedTags = groupWithoutTimestamps.tags?.filter((tag) => tag !== "project");
        const duplicatedGroup = groups.upsert(
          calculationGroupSchema.parse({
            ...groupWithoutTimestamps,
            id: duplicatedGroupId,
            title: newTitle.trim(),
            ...(sanitizedTags && sanitizedTags.length > 0
              ? { tags: sanitizedTags }
              : { tags: undefined }),
          }),
        );

        for (const sourceRecord of records.list({ groupId: sourceGroupId })) {
          const {
            createdAt: _recordCreatedAt,
            updatedAt: _recordUpdatedAt,
            ...recordWithoutTimestamps
          } = sourceRecord;

          records.upsert(
            calculationRecordSchema.parse({
              ...recordWithoutTimestamps,
              grouping: cloneGroupingForDuplicate(sourceRecord, duplicatedGroup),
              id: randomUUID(),
            }),
          );
        }

        return duplicatedGroup;
      });
    },
    deleteGroup(id: string) {
      if (typeof id !== "string" || id.length === 0) {
        throw new TypeError("Group id must be a non-empty string.");
      }
      return groups.delete(id);
    },
  };
}
