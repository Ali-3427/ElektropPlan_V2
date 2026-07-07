import { createRequire } from "node:module";

import { applyMigrations } from "./migrations.js";
import { SqliteStorageRepositories } from "./repositories.js";
import type {
  SqliteDatabaseConstructor,
  StorageDatabaseOptions,
  StorageRepositories,
} from "./types.js";

export interface StorageDatabase {
  close(): void;
  readonly filename: string;
  readonly repositories: StorageRepositories;
}

const require = createRequire(import.meta.url);

function resolveSqliteConstructor(
  sqlite: SqliteDatabaseConstructor | undefined,
): SqliteDatabaseConstructor {
  if (sqlite) {
    return sqlite;
  }

  return require("better-sqlite3") as SqliteDatabaseConstructor;
}

class SqliteStorageDatabase implements StorageDatabase {
  public readonly filename: string;
  public readonly repositories: StorageRepositories;

  public constructor(filename: string, sqlite: SqliteDatabaseConstructor) {
    this.filename = filename;

    const database = new sqlite(filename);
    applyMigrations(database);

    this.repositories = new SqliteStorageRepositories(database);
    this.#database = database;
  }

  readonly #database: InstanceType<SqliteDatabaseConstructor>;

  public close(): void {
    this.#database.close();
  }
}

export function openStorageDatabase(options: StorageDatabaseOptions): StorageDatabase {
  return new SqliteStorageDatabase(
    options.filename,
    resolveSqliteConstructor(options.sqlite),
  );
}
