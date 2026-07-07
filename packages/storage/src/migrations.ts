import type { Database as SqliteDatabase } from "better-sqlite3";

export interface Migration {
  id: number;
  name: string;
  /** When true, the migration manages its own transaction(s); the runner will NOT wrap it. */
  managesOwnTransaction?: boolean;
  up(database: SqliteDatabase): void;
}

const migrations: Migration[] = [
  {
    id: 1,
    name: "p1_initial_schema",
    up(database) {
      database.exec(`
        CREATE TABLE IF NOT EXISTS schema_migrations (
          id INTEGER PRIMARY KEY,
          name TEXT NOT NULL,
          applied_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS groups (
          id TEXT PRIMARY KEY,
          title TEXT NOT NULL,
          parent_group_id TEXT NULL REFERENCES groups(id) ON DELETE SET NULL,
          order_value INTEGER NULL,
          tags_json TEXT NULL,
          version_contract TEXT NOT NULL,
          version_engine TEXT NULL,
          version_data TEXT NULL,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS records (
          id TEXT PRIMARY KEY,
          calculator TEXT NOT NULL,
          title TEXT NULL,
          grouping_group_id TEXT NULL REFERENCES groups(id) ON DELETE SET NULL,
          grouping_group_path_json TEXT NULL,
          grouping_group_title TEXT NULL,
          grouping_order_value INTEGER NULL,
          grouping_quantity INTEGER NULL,
          grouping_tags_json TEXT NULL,
          input_json TEXT NOT NULL,
          output_json TEXT NOT NULL,
          version_contract TEXT NOT NULL,
          version_engine TEXT NULL,
          version_data TEXT NULL,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS settings (
          key TEXT PRIMARY KEY,
          value_json TEXT NOT NULL,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        );

        CREATE INDEX IF NOT EXISTS idx_groups_parent_group_id ON groups(parent_group_id);
        CREATE INDEX IF NOT EXISTS idx_groups_order_value ON groups(order_value, title, id);
        CREATE INDEX IF NOT EXISTS idx_records_grouping_group_id ON records(grouping_group_id);
        CREATE INDEX IF NOT EXISTS idx_records_calculator ON records(calculator);
        CREATE INDEX IF NOT EXISTS idx_records_updated_at ON records(updated_at DESC, id);
      `);
    },
  },
  {
    id: 2,
    name: "p2_grouping_quantity",
    up(database) {
      try {
        database.exec(`
          ALTER TABLE records
          ADD COLUMN grouping_quantity INTEGER NULL;
        `);
      } catch (error) {
        if (
          !(error instanceof Error) ||
          !error.message.includes("duplicate column name: grouping_quantity")
        ) {
          throw error;
        }
      }
    },
  },
  {
    id: 3,
    name: "p3_materials_schema",
    up(database) {
      database.exec(`
        CREATE TABLE IF NOT EXISTS material_categories (
          id TEXT PRIMARY KEY,
          title TEXT NOT NULL,
          order_value INTEGER NULL,
          icon_key TEXT NULL,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS materials (
          id TEXT PRIMARY KEY,
          category_id TEXT NOT NULL REFERENCES material_categories(id) ON DELETE RESTRICT,
          name TEXT NOT NULL,
          order_value INTEGER NULL,
          brand TEXT NULL,
          model_code TEXT NULL,
          unit TEXT NULL,
          unit_price REAL NULL,
          stock_qty INTEGER NULL,
          notes TEXT NULL,
          attributes_json TEXT NULL,
          source TEXT NOT NULL DEFAULT 'user',
          seed_data_version TEXT NULL,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS material_assignments (
          id TEXT PRIMARY KEY,
          record_id TEXT NOT NULL REFERENCES records(id) ON DELETE CASCADE,
          material_id TEXT NULL REFERENCES materials(id) ON DELETE SET NULL,
          quantity REAL NOT NULL DEFAULT 1,
          unit TEXT NULL,
          snapshot_name TEXT NOT NULL,
          snapshot_category_id TEXT NOT NULL,
          snapshot_category_title TEXT NOT NULL,
          snapshot_brand TEXT NULL,
          snapshot_model_code TEXT NULL,
          snapshot_unit_price REAL NULL,
          snapshot_attributes_json TEXT NULL,
          order_value INTEGER NULL,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        );

        CREATE INDEX IF NOT EXISTS idx_materials_category ON materials(category_id);
        CREATE INDEX IF NOT EXISTS idx_materials_name ON materials(name);
        CREATE INDEX IF NOT EXISTS idx_assignments_record ON material_assignments(record_id);
        CREATE INDEX IF NOT EXISTS idx_assignments_material ON material_assignments(material_id);
      `);
    },
  },
  {
    id: 4,
    name: "p4_cascade_delete_groups_records",
    managesOwnTransaction: true,
    up(database) {
      // PRAGMA foreign_keys cannot change inside a transaction; ensure it is OFF
      // (outside any transaction) before we BEGIN, so dropping `records` does not
      // cascade-delete `material_assignments` rows.
      database.exec("PRAGMA foreign_keys = OFF;");
      try {
        database.exec("BEGIN;");

        // --- Rebuild groups with parent_group_id ON DELETE CASCADE ---
        database.exec(`
          CREATE TABLE groups_new (
            id TEXT PRIMARY KEY,
            title TEXT NOT NULL,
            parent_group_id TEXT NULL REFERENCES groups(id) ON DELETE CASCADE,
            order_value INTEGER NULL,
            tags_json TEXT NULL,
            version_contract TEXT NOT NULL,
            version_engine TEXT NULL,
            version_data TEXT NULL,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL
          );
          INSERT INTO groups_new SELECT
            id, title, parent_group_id, order_value, tags_json,
            version_contract, version_engine, version_data, created_at, updated_at
          FROM groups;
          DROP TABLE groups;
          ALTER TABLE groups_new RENAME TO groups;

          CREATE INDEX IF NOT EXISTS idx_groups_parent_group_id ON groups(parent_group_id);
          CREATE INDEX IF NOT EXISTS idx_groups_order_value ON groups(order_value, title, id);
        `);

        // --- Rebuild records with grouping_group_id ON DELETE CASCADE ---
        database.exec(`
          CREATE TABLE records_new (
            id TEXT PRIMARY KEY,
            calculator TEXT NOT NULL,
            title TEXT NULL,
            grouping_group_id TEXT NULL REFERENCES groups(id) ON DELETE CASCADE,
            grouping_group_path_json TEXT NULL,
            grouping_group_title TEXT NULL,
            grouping_order_value INTEGER NULL,
            grouping_quantity INTEGER NULL,
            grouping_tags_json TEXT NULL,
            input_json TEXT NOT NULL,
            output_json TEXT NOT NULL,
            version_contract TEXT NOT NULL,
            version_engine TEXT NULL,
            version_data TEXT NULL,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL
          );
          INSERT INTO records_new SELECT
            id, calculator, title, grouping_group_id, grouping_group_path_json,
            grouping_group_title, grouping_order_value, grouping_quantity, grouping_tags_json,
            input_json, output_json, version_contract, version_engine, version_data,
            created_at, updated_at
          FROM records;
          DROP TABLE records;
          ALTER TABLE records_new RENAME TO records;

          CREATE INDEX IF NOT EXISTS idx_records_grouping_group_id ON records(grouping_group_id);
          CREATE INDEX IF NOT EXISTS idx_records_calculator ON records(calculator);
          CREATE INDEX IF NOT EXISTS idx_records_updated_at ON records(updated_at DESC, id);
        `);

        // material_assignments.record_id already has ON DELETE CASCADE (migration 3) —
        // chain complete. FK enforcement was OFF during the drops above, so no rows
        // were cascade-deleted; verify nothing was left dangling before committing.
        const violations = database.prepare("PRAGMA foreign_key_check;").all();
        if (violations.length > 0) {
          throw new Error(
            `Migration p4_cascade_delete_groups_records left dangling foreign keys: ${JSON.stringify(violations)}`,
          );
        }

        database.exec("COMMIT;");
      } catch (error) {
        database.exec("ROLLBACK;");
        throw error;
      } finally {
        database.exec("PRAGMA foreign_keys = ON;");
      }
    },
  },
];

export function applyMigrations(database: SqliteDatabase): void {
  database.exec("PRAGMA foreign_keys = ON;");
  database.exec("PRAGMA journal_mode = WAL;");

  database.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      id INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      applied_at TEXT NOT NULL
    );
  `);

  const appliedIds = new Set<number>(
    database
      .prepare("SELECT id FROM schema_migrations ORDER BY id ASC")
      .all()
      .map((row) => (row as { id: number }).id),
  );

  const insertMigration = database.prepare(
    "INSERT INTO schema_migrations (id, name, applied_at) VALUES (@id, @name, @applied_at)",
  );

  const recordMigration = (migration: Migration) =>
    insertMigration.run({
      applied_at: new Date().toISOString(),
      id: migration.id,
      name: migration.name,
    });

  const runWrapped = database.transaction((migration: Migration) => {
    migration.up(database);
    recordMigration(migration);
  });

  for (const migration of migrations) {
    if (appliedIds.has(migration.id)) continue;

    if (migration.managesOwnTransaction) {
      migration.up(database);
      recordMigration(migration);
    } else {
      runWrapped(migration);
    }
  }
}
