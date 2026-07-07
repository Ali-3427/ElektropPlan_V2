import type {
  CalculationGroup,
  CalculationRecord,
  Material,
  MaterialAssignment,
  MaterialCategory,
} from "@elektroplan/contracts";

import {
  calculationGroupSchema,
  calculationRecordSchema,
  materialAssignmentSchema,
  materialCategorySchema,
  materialSchema,
} from "./contracts.js";
import type {
  JsonValue,
  PersistedCalculationGroup,
  PersistedCalculationRecord,
  PersistedMaterial,
  PersistedMaterialAssignment,
  PersistedMaterialCategory,
  StorageSetting,
} from "./types.js";

export interface GroupRow {
  created_at: string;
  id: string;
  order_value: number | null;
  parent_group_id: string | null;
  tags_json: string | null;
  title: string;
  updated_at: string;
  version_contract: string;
  version_data: string | null;
  version_engine: string | null;
}

export interface RecordRow {
  calculator: CalculationRecord["calculator"];
  created_at: string;
  grouping_group_id: string | null;
  grouping_group_path_json: string | null;
  grouping_group_title: string | null;
  grouping_order_value: number | null;
  grouping_quantity: number | null;
  grouping_tags_json: string | null;
  id: string;
  input_json: string;
  output_json: string;
  title: string | null;
  updated_at: string;
  version_contract: string;
  version_data: string | null;
  version_engine: string | null;
}

export interface SettingRow {
  created_at: string;
  key: string;
  updated_at: string;
  value_json: string;
}

export interface MaterialCategoryRow {
  created_at: string;
  icon_key: string | null;
  id: string;
  order_value: number | null;
  title: string;
  updated_at: string;
}

export interface MaterialRow {
  attributes_json: string | null;
  brand: string | null;
  category_id: string;
  created_at: string;
  id: string;
  model_code: string | null;
  name: string;
  notes: string | null;
  order_value: number | null;
  seed_data_version: string | null;
  source: Material["source"];
  stock_qty: number | null;
  unit: Material["unit"] | null;
  unit_price: number | null;
  updated_at: string;
}

export interface MaterialAssignmentRow {
  created_at: string;
  id: string;
  material_id: string | null;
  order_value: number | null;
  quantity: number;
  record_id: string;
  snapshot_attributes_json: string | null;
  snapshot_brand: string | null;
  snapshot_category_id: string;
  snapshot_category_title: string;
  snapshot_model_code: string | null;
  snapshot_name: string;
  snapshot_unit_price: number | null;
  unit: MaterialAssignment["unit"] | null;
  updated_at: string;
}

function parseOptionalJson<TValue>(raw: string | null): TValue | undefined {
  if (raw === null) {
    return undefined;
  }

  return JSON.parse(raw) as TValue;
}

export function serializeJson(value: JsonValue): string {
  return JSON.stringify(value);
}

export function deserializeGroup(row: GroupRow): PersistedCalculationGroup {
  return {
    ...calculationGroupSchema.parse({
      id: row.id,
      order: row.order_value ?? undefined,
      parentGroupId: row.parent_group_id ?? undefined,
      tags: parseOptionalJson<string[]>(row.tags_json),
      title: row.title,
      version: {
        contractVersion: row.version_contract,
        dataVersion: row.version_data ?? undefined,
        engineVersion: row.version_engine ?? undefined,
      },
    }),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function serializeGroup(group: CalculationGroup, timestamp: string): GroupRow {
  const parsed = calculationGroupSchema.parse(group);

  return {
    created_at: timestamp,
    id: parsed.id,
    order_value: parsed.order ?? null,
    parent_group_id: parsed.parentGroupId ?? null,
    tags_json: parsed.tags ? serializeJson(parsed.tags) : null,
    title: parsed.title,
    updated_at: timestamp,
    version_contract: parsed.version.contractVersion,
    version_data: parsed.version.dataVersion ?? null,
    version_engine: parsed.version.engineVersion ?? null,
  };
}

export function deserializeRecord(row: RecordRow): PersistedCalculationRecord {
  return {
    ...calculationRecordSchema.parse({
      calculator: row.calculator,
      grouping:
        row.grouping_group_id !== null ||
        row.grouping_group_path_json !== null ||
        row.grouping_group_title !== null ||
        row.grouping_order_value !== null ||
        row.grouping_quantity !== null ||
        row.grouping_tags_json !== null
          ? {
              groupId: row.grouping_group_id ?? undefined,
              groupPath: parseOptionalJson<string[]>(row.grouping_group_path_json),
              groupTitle: row.grouping_group_title ?? undefined,
              order: row.grouping_order_value ?? undefined,
              quantity: row.grouping_quantity ?? undefined,
              tags: parseOptionalJson<string[]>(row.grouping_tags_json),
            }
          : undefined,
      id: row.id,
      input: JSON.parse(row.input_json),
      output: JSON.parse(row.output_json),
      title: row.title ?? undefined,
      version: {
        contractVersion: row.version_contract,
        dataVersion: row.version_data ?? undefined,
        engineVersion: row.version_engine ?? undefined,
      },
    }),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function serializeRecord(record: CalculationRecord, timestamp: string): RecordRow {
  const parsed = calculationRecordSchema.parse(record);

  return {
    calculator: parsed.calculator,
    created_at: timestamp,
    grouping_group_id: parsed.grouping?.groupId ?? null,
    grouping_group_path_json: parsed.grouping?.groupPath ? serializeJson(parsed.grouping.groupPath) : null,
    grouping_group_title: parsed.grouping?.groupTitle ?? null,
    grouping_order_value: parsed.grouping?.order ?? null,
    grouping_quantity: parsed.grouping?.quantity ?? null,
    grouping_tags_json: parsed.grouping?.tags ? serializeJson(parsed.grouping.tags) : null,
    id: parsed.id,
    input_json: serializeJson(parsed.input as JsonValue),
    output_json: serializeJson(parsed.output as JsonValue),
    title: parsed.title ?? null,
    updated_at: timestamp,
    version_contract: parsed.version.contractVersion,
    version_data: parsed.version.dataVersion ?? null,
    version_engine: parsed.version.engineVersion ?? null,
  };
}

export function deserializeSetting<TValue extends JsonValue>(row: SettingRow): StorageSetting<TValue> {
  return {
    createdAt: row.created_at,
    key: row.key,
    updatedAt: row.updated_at,
    value: JSON.parse(row.value_json) as TValue,
  };
}

export function deserializeMaterialCategory(row: MaterialCategoryRow): PersistedMaterialCategory {
  return {
    ...materialCategorySchema.parse({
      iconKey: row.icon_key ?? undefined,
      id: row.id,
      orderValue: row.order_value ?? undefined,
      title: row.title,
    }),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function serializeMaterialCategory(
  category: MaterialCategory,
  timestamp: string,
): MaterialCategoryRow {
  const parsed = materialCategorySchema.parse(category);

  return {
    created_at: timestamp,
    icon_key: parsed.iconKey ?? null,
    id: parsed.id,
    order_value: parsed.orderValue ?? null,
    title: parsed.title,
    updated_at: timestamp,
  };
}

export function deserializeMaterial(row: MaterialRow): PersistedMaterial {
  return {
    ...materialSchema.parse({
      attributes: parseOptionalJson<Material["attributes"]>(row.attributes_json),
      brand: row.brand ?? undefined,
      categoryId: row.category_id,
      id: row.id,
      modelCode: row.model_code ?? undefined,
      name: row.name,
      notes: row.notes ?? undefined,
      orderValue: row.order_value ?? undefined,
      seedDataVersion: row.seed_data_version ?? undefined,
      source: row.source,
      stockQty: row.stock_qty ?? undefined,
      unit: row.unit ?? undefined,
      unitPrice: row.unit_price ?? undefined,
    }),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function serializeMaterial(material: Material, timestamp: string): MaterialRow {
  const parsed = materialSchema.parse(material);

  return {
    attributes_json: parsed.attributes ? serializeJson(parsed.attributes as JsonValue) : null,
    brand: parsed.brand ?? null,
    category_id: parsed.categoryId,
    created_at: timestamp,
    id: parsed.id,
    model_code: parsed.modelCode ?? null,
    name: parsed.name,
    notes: parsed.notes ?? null,
    order_value: parsed.orderValue ?? null,
    seed_data_version: parsed.seedDataVersion ?? null,
    source: parsed.source,
    stock_qty: parsed.stockQty ?? null,
    unit: parsed.unit ?? null,
    unit_price: parsed.unitPrice ?? null,
    updated_at: timestamp,
  };
}

export function deserializeMaterialAssignment(
  row: MaterialAssignmentRow,
): PersistedMaterialAssignment {
  return {
    ...materialAssignmentSchema.parse({
      id: row.id,
      materialId: row.material_id,
      orderValue: row.order_value ?? undefined,
      quantity: row.quantity,
      recordId: row.record_id,
      snapshotAttributes: parseOptionalJson<Record<string, unknown>>(row.snapshot_attributes_json),
      snapshotBrand: row.snapshot_brand ?? undefined,
      snapshotCategoryId: row.snapshot_category_id,
      snapshotCategoryTitle: row.snapshot_category_title,
      snapshotModelCode: row.snapshot_model_code ?? undefined,
      snapshotName: row.snapshot_name,
      snapshotUnitPrice: row.snapshot_unit_price ?? undefined,
      unit: row.unit ?? undefined,
    }),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function serializeMaterialAssignment(
  assignment: MaterialAssignment,
  timestamp: string,
): MaterialAssignmentRow {
  const parsed = materialAssignmentSchema.parse(assignment);

  return {
    created_at: timestamp,
    id: parsed.id,
    material_id: parsed.materialId,
    order_value: parsed.orderValue ?? null,
    quantity: parsed.quantity,
    record_id: parsed.recordId,
    snapshot_attributes_json: parsed.snapshotAttributes
      ? serializeJson(parsed.snapshotAttributes as JsonValue)
      : null,
    snapshot_brand: parsed.snapshotBrand ?? null,
    snapshot_category_id: parsed.snapshotCategoryId,
    snapshot_category_title: parsed.snapshotCategoryTitle,
    snapshot_model_code: parsed.snapshotModelCode ?? null,
    snapshot_name: parsed.snapshotName,
    snapshot_unit_price: parsed.snapshotUnitPrice ?? null,
    unit: parsed.unit ?? null,
    updated_at: timestamp,
  };
}
