import { createRequire } from "node:module";

import { openStorageDatabase, type StorageDatabase } from "@elektroplan/storage";

import {
  createCalculateService,
  type CalculateService,
} from "./calculate-service.js";
import {
  createExportService,
  type ExportService,
} from "./export-service.js";
import {
  createRecordsService,
  type RecordsService,
} from "./records-service.js";
import {
  createSettingsService,
  type SettingsService,
} from "./settings-service.js";
import {
  createMaterialsService,
  type MaterialsService,
} from "./materials-service.js";

export interface CreateServicesOptions {
  readonly databasePath: string;
}

export interface AppServices {
  readonly calculate: CalculateService;
  readonly records: RecordsService;
  readonly settings: SettingsService;
  readonly export: ExportService;
  readonly materials: MaterialsService;
  readonly storage: StorageDatabase;
  close(): void;
}

const require = createRequire(import.meta.url);
const sqlite = require("better-sqlite3") as NonNullable<
  Parameters<typeof openStorageDatabase>[0]["sqlite"]
>;

export function createServices(options: CreateServicesOptions): AppServices {
  const storage = openStorageDatabase({
    filename: options.databasePath,
    sqlite,
  });

  return {
    calculate: createCalculateService(),
    records: createRecordsService(
      storage.repositories.records,
      storage.repositories.groups,
    ),
    settings: createSettingsService(storage.repositories.settings),
    export: createExportService(),
    materials: createMaterialsService(storage.repositories),
    storage,
    close(): void {
      storage.close();
    },
  };
}

export type { CalculateService } from "./calculate-service.js";
export type { RecordsService } from "./records-service.js";
export type { SettingsService } from "./settings-service.js";
export type { ExportService, ExportResult } from "./export-service.js";
export type { MaterialsService } from "./materials-service.js";
