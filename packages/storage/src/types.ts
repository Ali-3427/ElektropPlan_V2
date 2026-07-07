import type BetterSqlite3 from "better-sqlite3";
import type { ZodType } from "zod";

import type {
  CalculationGroup,
  CalculationRecord,
  CalculationsExport,
  Material,
  MaterialAssignment,
  MaterialCategory,
} from "@elektroplan/contracts";

export type SqliteDatabaseConstructor = typeof BetterSqlite3;

export interface StorageDatabaseOptions {
  filename: string;
  sqlite?: SqliteDatabaseConstructor;
}

export interface TimestampedEntity {
  createdAt: string;
  updatedAt: string;
}

export type PersistedCalculationGroup = CalculationGroup & TimestampedEntity;
export type PersistedCalculationRecord = CalculationRecord & TimestampedEntity;
export type PersistedMaterial = Material & TimestampedEntity;
export type PersistedMaterialAssignment = MaterialAssignment & TimestampedEntity;
export type PersistedMaterialCategory = MaterialCategory & TimestampedEntity;

export interface StorageSetting<TValue = JsonValue> extends TimestampedEntity {
  key: string;
  value: TValue;
}

export type GroupUpsertInput = CalculationGroup;

export type RecordUpsertInput = CalculationRecord;
export type MaterialUpsertInput = Material;
export type MaterialAssignmentUpsertInput = MaterialAssignment;
export type MaterialCategoryUpsertInput = MaterialCategory;

export interface SettingsRepository {
  delete(key: string): boolean;
  get<TValue extends JsonValue = JsonValue>(
    key: string,
    schema?: ZodType<TValue>,
  ): StorageSetting<TValue> | null;
  list(): StorageSetting[];
  set<TValue extends JsonValue>(key: string, value: TValue): StorageSetting<TValue>;
}

export interface GroupsRepository {
  delete(id: string): boolean;
  getById(id: string): PersistedCalculationGroup | null;
  list(): PersistedCalculationGroup[];
  upsert(group: GroupUpsertInput): PersistedCalculationGroup;
}

export interface RecordsRepository {
  delete(id: string): boolean;
  getById(id: string): PersistedCalculationRecord | null;
  list(options?: { groupId?: string }): PersistedCalculationRecord[];
  upsert(record: RecordUpsertInput): PersistedCalculationRecord;
}

export interface MaterialCategoriesRepository {
  delete(id: string): boolean;
  getById(id: string): PersistedMaterialCategory | null;
  list(): PersistedMaterialCategory[];
  upsert(category: MaterialCategoryUpsertInput): PersistedMaterialCategory;
}

export interface MaterialsRepository {
  delete(id: string): boolean;
  getById(id: string): PersistedMaterial | null;
  list(options?: {
    categoryId?: string;
    search?: string;
    source?: Material["source"];
  }): PersistedMaterial[];
  upsert(material: MaterialUpsertInput): PersistedMaterial;
}

export interface MaterialAssignmentsRepository {
  delete(id: string): boolean;
  listForRecords(recordIds: string[]): PersistedMaterialAssignment[];
  upsert(assignment: MaterialAssignmentUpsertInput): PersistedMaterialAssignment;
}

export interface StorageRepositories {
  assignments: MaterialAssignmentsRepository;
  exportSnapshot(version: CalculationsExport["version"]): CalculationsExport;
  groups: GroupsRepository;
  materials: MaterialsRepository;
  materialCategories: MaterialCategoriesRepository;
  records: RecordsRepository;
  settings: SettingsRepository;
  transaction<T>(fn: () => T): T;
}

export type JsonPrimitive = boolean | null | number | string;
export type JsonValue = JsonPrimitive | JsonValue[] | { [key: string]: JsonValue };
