import type { Database as SqliteDatabase, Statement } from "better-sqlite3";
import type { ZodType } from "zod";

import { calculationsExportSchema } from "./contracts.js";
import {
  deserializeGroup,
  deserializeMaterial,
  deserializeMaterialAssignment,
  deserializeMaterialCategory,
  deserializeRecord,
  deserializeSetting,
  serializeGroup,
  serializeMaterial,
  serializeMaterialAssignment,
  serializeMaterialCategory,
  serializeRecord,
} from "./serialization.js";
import type {
  GroupRow,
  MaterialAssignmentRow,
  MaterialCategoryRow,
  MaterialRow,
  RecordRow,
  SettingRow,
} from "./serialization.js";
import type {
  GroupUpsertInput,
  GroupsRepository,
  JsonValue,
  MaterialAssignmentsRepository,
  MaterialAssignmentUpsertInput,
  MaterialUpsertInput,
  MaterialCategoriesRepository,
  MaterialCategoryUpsertInput,
  MaterialsRepository,
  PersistedCalculationGroup,
  PersistedMaterial,
  PersistedMaterialAssignment,
  PersistedMaterialCategory,
  PersistedCalculationRecord,
  RecordUpsertInput,
  RecordsRepository,
  SettingsRepository,
  StorageRepositories,
  StorageSetting,
} from "./types.js";

function nowIso(): string {
  return new Date().toISOString();
}

const SEARCH_LOCALES = ["und", "tr"];
const COMBINING_MARKS_PATTERN = /\p{M}+/gu;
const NUMERIC_SEPARATOR_PATTERN = /[.,]/g;

function normalizeForSearch(value: string, locale: string): string {
  const nfkd = value.normalize("NFKD");
  const stripped = nfkd.replace(COMBINING_MARKS_PATTERN, "");
  const lowered = stripped.toLocaleLowerCase(locale);
  return lowered.replace(NUMERIC_SEPARATOR_PATTERN, ",");
}

function createNormalizedVariants(value: string): string[] {
  return Array.from(new Set(SEARCH_LOCALES.map((locale) => normalizeForSearch(value, locale))));
}

function tokenize(search: string): string[] {
  return search
    .split(/\s+/)
    .map((token) => token.trim())
    .filter((token) => token.length > 0);
}

function matchesUnicodeSearch(fields: Array<string | null>, search: string): boolean {
  const tokens = tokenize(search);
  if (tokens.length === 0) {
    return true;
  }

  const fieldVariantsList = fields
    .filter((field): field is string => field !== null && field !== undefined && field !== "")
    .map((field) => createNormalizedVariants(field));

  if (fieldVariantsList.length === 0) {
    return false;
  }

  return tokens.every((token) => {
    const tokenVariants = createNormalizedVariants(token);
    return fieldVariantsList.some((fieldVariants) =>
      fieldVariants.some((field) =>
        tokenVariants.some((variant) => field.includes(variant)),
      ),
    );
  });
}

export class SqliteGroupsRepository implements GroupsRepository {
  private readonly deleteStatement: Statement<[string]>;
  private readonly selectAllStatement: Statement<[], GroupRow>;
  private readonly selectByIdStatement: Statement<[string], GroupRow>;
  private readonly upsertStatement: Statement<GroupRow>;

  public constructor(private readonly database: SqliteDatabase) {
    this.deleteStatement = database.prepare("DELETE FROM groups WHERE id = ?");
    this.selectAllStatement = database.prepare(`
      SELECT
        created_at,
        id,
        order_value,
        parent_group_id,
        tags_json,
        title,
        updated_at,
        version_contract,
        version_data,
        version_engine
      FROM groups
      ORDER BY
        COALESCE(parent_group_id, ''),
        COALESCE(order_value, 2147483647),
        title,
        id
    `);
    this.selectByIdStatement = database.prepare(`
      SELECT
        created_at,
        id,
        order_value,
        parent_group_id,
        tags_json,
        title,
        updated_at,
        version_contract,
        version_data,
        version_engine
      FROM groups
      WHERE id = ?
    `);
    this.upsertStatement = database.prepare(`
      INSERT INTO groups (
        id,
        title,
        parent_group_id,
        order_value,
        tags_json,
        version_contract,
        version_engine,
        version_data,
        created_at,
        updated_at
      )
      VALUES (
        @id,
        @title,
        @parent_group_id,
        @order_value,
        @tags_json,
        @version_contract,
        @version_engine,
        @version_data,
        @created_at,
        @updated_at
      )
      ON CONFLICT(id) DO UPDATE SET
        title = excluded.title,
        parent_group_id = excluded.parent_group_id,
        order_value = excluded.order_value,
        tags_json = excluded.tags_json,
        version_contract = excluded.version_contract,
        version_engine = excluded.version_engine,
        version_data = excluded.version_data,
        updated_at = excluded.updated_at,
        created_at = groups.created_at
    `);
  }

  public delete(id: string): boolean {
    return this.deleteStatement.run(id).changes > 0;
  }

  public getById(id: string): PersistedCalculationGroup | null {
    const row = this.selectByIdStatement.get(id);
    return row ? deserializeGroup(row) : null;
  }

  public list(): PersistedCalculationGroup[] {
    return this.selectAllStatement.all().map((row) => deserializeGroup(row));
  }

  public upsert(group: GroupUpsertInput): PersistedCalculationGroup {
    const current = this.getById(group.id);
    const timestamp = nowIso();
    const row = serializeGroup(group, timestamp);
    this.upsertStatement.run({
      ...row,
      created_at: current?.createdAt ?? row.created_at,
    });

    const stored = this.getById(group.id);
    if (stored === null) {
      throw new Error(`Failed to upsert group '${group.id}'.`);
    }

    return stored;
  }
}

export class SqliteRecordsRepository implements RecordsRepository {
  private readonly deleteStatement: Statement<[string]>;
  private readonly listAllStatement: Statement<[], RecordRow>;
  private readonly listByGroupStatement: Statement<[string], RecordRow>;
  private readonly selectByIdStatement: Statement<[string], RecordRow>;
  private readonly upsertStatement: Statement<RecordRow>;

  public constructor(private readonly database: SqliteDatabase) {
    this.deleteStatement = database.prepare("DELETE FROM records WHERE id = ?");
    this.listAllStatement = database.prepare(`
      SELECT
        calculator,
        created_at,
        grouping_group_id,
        grouping_group_path_json,
        grouping_group_title,
        grouping_order_value,
        grouping_quantity,
        grouping_tags_json,
        id,
        input_json,
        output_json,
        title,
        updated_at,
        version_contract,
        version_data,
        version_engine
      FROM records
      ORDER BY updated_at DESC, id ASC
    `);
    this.listByGroupStatement = database.prepare(`
      SELECT
        calculator,
        created_at,
        grouping_group_id,
        grouping_group_path_json,
        grouping_group_title,
        grouping_order_value,
        grouping_quantity,
        grouping_tags_json,
        id,
        input_json,
        output_json,
        title,
        updated_at,
        version_contract,
        version_data,
        version_engine
      FROM records
      WHERE grouping_group_id = ?
      ORDER BY updated_at DESC, id ASC
    `);
    this.selectByIdStatement = database.prepare(`
      SELECT
        calculator,
        created_at,
        grouping_group_id,
        grouping_group_path_json,
        grouping_group_title,
        grouping_order_value,
        grouping_quantity,
        grouping_tags_json,
        id,
        input_json,
        output_json,
        title,
        updated_at,
        version_contract,
        version_data,
        version_engine
      FROM records
      WHERE id = ?
    `);
    this.upsertStatement = database.prepare(`
      INSERT INTO records (
        id,
        calculator,
        title,
        grouping_group_id,
        grouping_group_path_json,
        grouping_group_title,
        grouping_order_value,
        grouping_quantity,
        grouping_tags_json,
        input_json,
        output_json,
        version_contract,
        version_engine,
        version_data,
        created_at,
        updated_at
      )
      VALUES (
        @id,
        @calculator,
        @title,
        @grouping_group_id,
        @grouping_group_path_json,
        @grouping_group_title,
        @grouping_order_value,
        @grouping_quantity,
        @grouping_tags_json,
        @input_json,
        @output_json,
        @version_contract,
        @version_engine,
        @version_data,
        @created_at,
        @updated_at
      )
      ON CONFLICT(id) DO UPDATE SET
        calculator = excluded.calculator,
        title = excluded.title,
        grouping_group_id = excluded.grouping_group_id,
        grouping_group_path_json = excluded.grouping_group_path_json,
        grouping_group_title = excluded.grouping_group_title,
        grouping_order_value = excluded.grouping_order_value,
        grouping_quantity = excluded.grouping_quantity,
        grouping_tags_json = excluded.grouping_tags_json,
        input_json = excluded.input_json,
        output_json = excluded.output_json,
        version_contract = excluded.version_contract,
        version_engine = excluded.version_engine,
        version_data = excluded.version_data,
        updated_at = excluded.updated_at,
        created_at = records.created_at
    `);
  }

  public delete(id: string): boolean {
    return this.deleteStatement.run(id).changes > 0;
  }

  public getById(id: string): PersistedCalculationRecord | null {
    const row = this.selectByIdStatement.get(id);
    return row ? deserializeRecord(row) : null;
  }

  public list(options?: { groupId?: string }): PersistedCalculationRecord[] {
    const rows = options?.groupId ? this.listByGroupStatement.all(options.groupId) : this.listAllStatement.all();
    return rows.map((row) => deserializeRecord(row));
  }

  public upsert(record: RecordUpsertInput): PersistedCalculationRecord {
    const current = this.getById(record.id);
    const timestamp = nowIso();
    const row = serializeRecord(record, timestamp);
    this.upsertStatement.run({
      ...row,
      created_at: current?.createdAt ?? row.created_at,
    });

    const stored = this.getById(record.id);
    if (stored === null) {
      throw new Error(`Failed to upsert record '${record.id}'.`);
    }

    return stored;
  }
}

export class SqliteMaterialCategoriesRepository implements MaterialCategoriesRepository {
  private readonly deleteStatement: Statement<[string]>;
  private readonly selectAllStatement: Statement<[], MaterialCategoryRow>;
  private readonly selectByIdStatement: Statement<[string], MaterialCategoryRow>;
  private readonly upsertStatement: Statement<MaterialCategoryRow>;

  public constructor(private readonly database: SqliteDatabase) {
    this.deleteStatement = database.prepare("DELETE FROM material_categories WHERE id = ?");
    this.selectAllStatement = database.prepare(`
      SELECT
        created_at,
        icon_key,
        id,
        order_value,
        title,
        updated_at
      FROM material_categories
      ORDER BY
        CASE WHEN order_value IS NULL THEN 1 ELSE 0 END,
        order_value ASC,
        title ASC,
        id ASC
    `);
    this.selectByIdStatement = database.prepare(`
      SELECT
        created_at,
        icon_key,
        id,
        order_value,
        title,
        updated_at
      FROM material_categories
      WHERE id = ?
    `);
    this.upsertStatement = database.prepare(`
      INSERT INTO material_categories (
        id,
        title,
        order_value,
        icon_key,
        created_at,
        updated_at
      )
      VALUES (
        @id,
        @title,
        @order_value,
        @icon_key,
        @created_at,
        @updated_at
      )
      ON CONFLICT(id) DO UPDATE SET
        title = excluded.title,
        order_value = excluded.order_value,
        icon_key = excluded.icon_key,
        updated_at = excluded.updated_at,
        created_at = material_categories.created_at
    `);
  }

  public delete(id: string): boolean {
    return this.deleteStatement.run(id).changes > 0;
  }

  public getById(id: string): PersistedMaterialCategory | null {
    const row = this.selectByIdStatement.get(id);
    return row ? deserializeMaterialCategory(row) : null;
  }

  public list(): PersistedMaterialCategory[] {
    return this.selectAllStatement.all().map((row) => deserializeMaterialCategory(row));
  }

  public upsert(category: MaterialCategoryUpsertInput): PersistedMaterialCategory {
    const current = this.getById(category.id);
    const timestamp = nowIso();
    const row = serializeMaterialCategory(category, timestamp);
    this.upsertStatement.run({
      ...row,
      created_at: current?.createdAt ?? row.created_at,
    });

    const stored = this.getById(category.id);
    if (stored === null) {
      throw new Error(`Failed to upsert material category '${category.id}'.`);
    }

    return stored;
  }
}

export class SqliteMaterialsRepository implements MaterialsRepository {
  private readonly deleteStatement: Statement<[string]>;
  private readonly selectByIdStatement: Statement<[string], MaterialRow>;
  private readonly upsertStatement: Statement<MaterialRow>;

  public constructor(private readonly database: SqliteDatabase) {
    this.deleteStatement = database.prepare("DELETE FROM materials WHERE id = ?");
    this.selectByIdStatement = database.prepare(`
      SELECT
        attributes_json,
        brand,
        category_id,
        created_at,
        id,
        model_code,
        name,
        notes,
        order_value,
        seed_data_version,
        source,
        stock_qty,
        unit,
        unit_price,
        updated_at
      FROM materials
      WHERE id = ?
    `);
    this.upsertStatement = database.prepare(`
      INSERT INTO materials (
        id,
        category_id,
        name,
        order_value,
        brand,
        model_code,
        unit,
        unit_price,
        stock_qty,
        notes,
        attributes_json,
        source,
        seed_data_version,
        created_at,
        updated_at
      )
      VALUES (
        @id,
        @category_id,
        @name,
        @order_value,
        @brand,
        @model_code,
        @unit,
        @unit_price,
        @stock_qty,
        @notes,
        @attributes_json,
        @source,
        @seed_data_version,
        @created_at,
        @updated_at
      )
      ON CONFLICT(id) DO UPDATE SET
        category_id = excluded.category_id,
        name = excluded.name,
        order_value = excluded.order_value,
        brand = excluded.brand,
        model_code = excluded.model_code,
        unit = excluded.unit,
        unit_price = excluded.unit_price,
        stock_qty = excluded.stock_qty,
        notes = excluded.notes,
        attributes_json = excluded.attributes_json,
        source = excluded.source,
        seed_data_version = excluded.seed_data_version,
        updated_at = excluded.updated_at,
        created_at = materials.created_at
    `);
  }

  public delete(id: string): boolean {
    return this.deleteStatement.run(id).changes > 0;
  }

  public getById(id: string): PersistedMaterial | null {
    const row = this.selectByIdStatement.get(id);
    return row ? deserializeMaterial(row) : null;
  }

  public list(options?: {
    categoryId?: string;
    search?: string;
    source?: PersistedMaterial["source"];
  }): PersistedMaterial[] {
    const conditions: string[] = [];
    const parameters: Record<string, string> = {};

    if (options?.categoryId) {
      conditions.push("category_id = @categoryId");
      parameters.categoryId = options.categoryId;
    }

    if (options?.source) {
      conditions.push("source = @source");
      parameters.source = options.source;
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
    const statement = this.database.prepare(`
      SELECT
        attributes_json,
        brand,
        category_id,
        created_at,
        id,
        model_code,
        name,
        notes,
        order_value,
        seed_data_version,
        source,
        stock_qty,
        unit,
        unit_price,
        updated_at
      FROM materials
      ${whereClause}
      ORDER BY
        CASE WHEN order_value IS NULL THEN 1 ELSE 0 END,
        order_value ASC,
        name ASC,
        id ASC
    `) as Statement<Record<string, string>, MaterialRow>;

    const rows = statement.all(parameters);
    const search = options?.search;
    const filteredRows = search
      ? rows.filter((row) => matchesUnicodeSearch([row.name, row.brand, row.model_code], search))
      : rows;

    return filteredRows.map((row) => deserializeMaterial(row));
  }

  public upsert(material: MaterialUpsertInput): PersistedMaterial {
    const current = this.getById(material.id);
    const timestamp = nowIso();
    const row = serializeMaterial(material, timestamp);
    this.upsertStatement.run({
      ...row,
      created_at: current?.createdAt ?? row.created_at,
    });

    const stored = this.getById(material.id);
    if (stored === null) {
      throw new Error(`Failed to upsert material '${material.id}'.`);
    }

    return stored;
  }
}

export class SqliteMaterialAssignmentsRepository implements MaterialAssignmentsRepository {
  private readonly deleteStatement: Statement<[string]>;
  private readonly selectByIdStatement: Statement<[string], MaterialAssignmentRow>;
  private readonly upsertStatement: Statement<MaterialAssignmentRow>;

  public constructor(private readonly database: SqliteDatabase) {
    this.deleteStatement = database.prepare("DELETE FROM material_assignments WHERE id = ?");
    this.selectByIdStatement = database.prepare(`
      SELECT
        created_at,
        id,
        material_id,
        order_value,
        quantity,
        record_id,
        snapshot_attributes_json,
        snapshot_brand,
        snapshot_category_id,
        snapshot_category_title,
        snapshot_model_code,
        snapshot_name,
        snapshot_unit_price,
        unit,
        updated_at
      FROM material_assignments
      WHERE id = ?
    `);
    this.upsertStatement = database.prepare(`
      INSERT INTO material_assignments (
        id,
        record_id,
        material_id,
        quantity,
        unit,
        snapshot_name,
        snapshot_category_id,
        snapshot_category_title,
        snapshot_brand,
        snapshot_model_code,
        snapshot_unit_price,
        snapshot_attributes_json,
        order_value,
        created_at,
        updated_at
      )
      VALUES (
        @id,
        @record_id,
        @material_id,
        @quantity,
        @unit,
        @snapshot_name,
        @snapshot_category_id,
        @snapshot_category_title,
        @snapshot_brand,
        @snapshot_model_code,
        @snapshot_unit_price,
        @snapshot_attributes_json,
        @order_value,
        @created_at,
        @updated_at
      )
      ON CONFLICT(id) DO UPDATE SET
        record_id = excluded.record_id,
        material_id = excluded.material_id,
        quantity = excluded.quantity,
        unit = excluded.unit,
        snapshot_name = excluded.snapshot_name,
        snapshot_category_id = excluded.snapshot_category_id,
        snapshot_category_title = excluded.snapshot_category_title,
        snapshot_brand = excluded.snapshot_brand,
        snapshot_model_code = excluded.snapshot_model_code,
        snapshot_unit_price = excluded.snapshot_unit_price,
        snapshot_attributes_json = excluded.snapshot_attributes_json,
        order_value = excluded.order_value,
        updated_at = excluded.updated_at,
        created_at = material_assignments.created_at
    `);
  }

  public delete(id: string): boolean {
    return this.deleteStatement.run(id).changes > 0;
  }

  public listForRecords(recordIds: string[]): PersistedMaterialAssignment[] {
    if (recordIds.length === 0) {
      return [];
    }

    const placeholders = recordIds.map(() => "?").join(", ");
    const statement = this.database.prepare(`
      SELECT
        created_at,
        id,
        material_id,
        order_value,
        quantity,
        record_id,
        snapshot_attributes_json,
        snapshot_brand,
        snapshot_category_id,
        snapshot_category_title,
        snapshot_model_code,
        snapshot_name,
        snapshot_unit_price,
        unit,
        updated_at
      FROM material_assignments
      WHERE record_id IN (${placeholders})
      ORDER BY
        record_id ASC,
        CASE WHEN order_value IS NULL THEN 1 ELSE 0 END,
        order_value ASC,
        created_at ASC,
        id ASC
    `) as Statement<string[], MaterialAssignmentRow>;

    return statement.all(...recordIds).map((row) => deserializeMaterialAssignment(row));
  }

  public upsert(assignment: MaterialAssignmentUpsertInput): PersistedMaterialAssignment {
    const current = this.getById(assignment.id);
    const timestamp = nowIso();
    const row = serializeMaterialAssignment(assignment, timestamp);
    this.upsertStatement.run({
      ...row,
      created_at: current?.createdAt ?? row.created_at,
    });

    const stored = this.getById(assignment.id);
    if (stored === null) {
      throw new Error(`Failed to upsert material assignment '${assignment.id}'.`);
    }

    return stored;
  }

  private getById(id: string): PersistedMaterialAssignment | null {
    const row = this.selectByIdStatement.get(id);
    return row ? deserializeMaterialAssignment(row) : null;
  }
}

export class SqliteSettingsRepository implements SettingsRepository {
  private readonly deleteStatement: Statement<[string]>;
  private readonly listStatement: Statement<[], SettingRow>;
  private readonly selectByIdStatement: Statement<[string], SettingRow>;
  private readonly upsertStatement: Statement<SettingRow>;

  public constructor(private readonly database: SqliteDatabase) {
    this.deleteStatement = database.prepare("DELETE FROM settings WHERE key = ?");
    this.listStatement = database.prepare(`
      SELECT created_at, key, updated_at, value_json
      FROM settings
      ORDER BY key ASC
    `);
    this.selectByIdStatement = database.prepare(`
      SELECT created_at, key, updated_at, value_json
      FROM settings
      WHERE key = ?
    `);
    this.upsertStatement = database.prepare(`
      INSERT INTO settings (key, value_json, created_at, updated_at)
      VALUES (@key, @value_json, @created_at, @updated_at)
      ON CONFLICT(key) DO UPDATE SET
        value_json = excluded.value_json,
        updated_at = excluded.updated_at,
        created_at = settings.created_at
    `);
  }

  public delete(key: string): boolean {
    return this.deleteStatement.run(key).changes > 0;
  }

  public get<TValue extends JsonValue = JsonValue>(
    key: string,
    schema?: ZodType<TValue>,
  ): StorageSetting<TValue> | null {
    const row = this.selectByIdStatement.get(key);
    if (!row) {
      return null;
    }

    const setting = deserializeSetting<TValue>(row);
    if (!schema) {
      return setting;
    }

    return {
      ...setting,
      value: schema.parse(setting.value),
    };
  }

  public list(): StorageSetting[] {
    return this.listStatement.all().map((row) => deserializeSetting(row));
  }

  public set<TValue extends JsonValue>(key: string, value: TValue): StorageSetting<TValue> {
    const current = this.get<TValue>(key);
    const timestamp = nowIso();

    this.upsertStatement.run({
      created_at: current?.createdAt ?? timestamp,
      key,
      updated_at: timestamp,
      value_json: JSON.stringify(value),
    });

    const stored = this.get<TValue>(key);
    if (stored === null) {
      throw new Error(`Failed to persist setting '${key}'.`);
    }

    return stored;
  }
}

export class SqliteStorageRepositories implements StorageRepositories {
  public readonly assignments: MaterialAssignmentsRepository;
  public readonly groups: GroupsRepository;
  public readonly materials: MaterialsRepository;
  public readonly materialCategories: MaterialCategoriesRepository;
  public readonly records: RecordsRepository;
  public readonly settings: SettingsRepository;

  readonly #database: SqliteDatabase;

  public constructor(database: SqliteDatabase) {
    this.#database = database;
    this.assignments = new SqliteMaterialAssignmentsRepository(database);
    this.groups = new SqliteGroupsRepository(database);
    this.materials = new SqliteMaterialsRepository(database);
    this.materialCategories = new SqliteMaterialCategoriesRepository(database);
    this.records = new SqliteRecordsRepository(database);
    this.settings = new SqliteSettingsRepository(database);
  }

  public transaction<T>(fn: () => T): T {
    return this.#database.transaction(fn)();
  }

  public exportSnapshot(version: { contractVersion: string; dataVersion?: string; engineVersion?: string }) {
    const groups = this.groups.list().map(({ createdAt: _createdAt, updatedAt: _updatedAt, ...group }) => group);
    const records = this.records
      .list()
      .map(({ createdAt: _createdAt, updatedAt: _updatedAt, ...record }) => record);
    const materialCategories = this.materialCategories
      .list()
      .map(({ createdAt: _createdAt, updatedAt: _updatedAt, ...category }) => category);
    const materials = this.materials
      .list()
      .map(({ createdAt: _createdAt, updatedAt: _updatedAt, ...material }) => material);
    const materialAssignments = this.assignments
      .listForRecords(records.map((record) => record.id))
      .map(({ createdAt: _createdAt, updatedAt: _updatedAt, ...assignment }) => assignment);

    return calculationsExportSchema.parse({
      exportedAt: nowIso(),
      groups,
      materialAssignments,
      materialCategories,
      materials,
      records,
      version,
    });
  }
}
