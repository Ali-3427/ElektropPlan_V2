import type {
  CableRequest,
  CableResponse,
  CalculationGroup,
  CalculationRecord,
  MotorRequest,
  MotorResponse,
  ProtectionRequest,
  ProtectionResponse,
  VoltageDropRequest,
  VoltageDropResponse,
} from "@elektroplan/contracts";
import { contextBridge, ipcRenderer } from "electron";

type IpcEnvelope<TValue> =
  | { readonly ok: true; readonly value: TValue }
  | {
      readonly ok: false;
      readonly error: { readonly code: string; readonly message: string };
    };

const CHANNELS = Object.freeze({
  CalcMotor: "calc:motor",
  CalcVoltageDrop: "calc:vd",
  CalcCable: "calc:cable",
  CalcCableRuler: "calc:cable-ruler",
  CalcGroupCableSuggest: "calc:group-cable-suggest",
  CalcProtection: "calc:protection",
  DataMotorTable: "data:motor-table",
  DataCableRulerTable: "data:cable-ruler-table",
  DataVoltageDropProfiles: "data:vd-profiles",
  DataDefaultVoltageDropProfile: "data:vd-default-profile",
  DataInstallationMethods: "data:installation-methods",
  RecordsList: "records:list",
  RecordsGet: "records:get",
  RecordsSave: "records:save",
  RecordsDelete: "records:delete",
  GroupsList: "groups:list",
  GroupsSave: "groups:save",
  GroupsDelete: "groups:delete",
  GroupsDuplicate: "groups:duplicate",
  ExportJson: "export:json",
  ExportExcel: "export:excel",
  ExportPdf: "export:pdf",
  SettingsGet: "settings:get",
  SettingsSet: "settings:set",
  SettingsList: "settings:list",
  SettingsDelete: "settings:delete",
  AppEngineVersion: "app:engine-version",
  MaterialsListCategories: "materials:list-categories",
  MaterialsUpsertCategory: "materials:upsert-category",
  MaterialsDeleteCategory: "materials:delete-category",
  MaterialsList: "materials:list",
  MaterialsUpsert: "materials:upsert",
  MaterialsDelete: "materials:delete",
  MaterialsImportExcel: "materials:import-excel",
  MaterialsPickExcel: "materials:pick-excel",
  AssignmentsListForRecords: "assignments:list-for-records",
  AssignmentsUpsert: "assignments:upsert",
  AssignmentsDelete: "assignments:delete",
} as const);

async function invoke<TResult>(
  channel: string,
  payload?: unknown,
): Promise<TResult> {
  const envelope = (await ipcRenderer.invoke(
    channel,
    payload,
  )) as IpcEnvelope<TResult>;

  if (!envelope.ok) {
    const err = new Error(envelope.error.message);
    err.name = envelope.error.code;
    throw err;
  }

  return envelope.value;
}

export interface SettingRecord {
  readonly key: string;
  readonly value: unknown;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface VoltageDropProfileSummary {
  readonly id: string;
  readonly titleKey: string;
  readonly titleTr: string;
  readonly limitPercent: number;
}

export interface ExportPayloadBundle {
  readonly records?: readonly CalculationRecord[];
  readonly groups?: readonly CalculationGroup[];
  readonly resultDocument?: unknown;
}

export interface ExportPdfPayload {
  readonly presentation: unknown;
}

export type ExportResult =
  | { readonly canceled: true }
  | { readonly canceled: false; readonly path: string };

export type CableRulerAmbient = "toprak_20C" | "hava_30C";

export interface CableRulerRequest {
  readonly designCurrentA: number;
  readonly ambient: CableRulerAmbient;
}

export interface CableRulerEntryDto {
  readonly nominal_kesit_mm2: string;
  readonly sectionMm2: number;
  readonly dis_cap_mm: number;
  readonly net_agirlik_kg_km: number;
  readonly sevk_uzunlugu_m: number;
  readonly dc_direnc_ohm_km_20C: number;
  readonly akim_toprak_20C_A: number | null;
  readonly akim_hava_30C_A: number | null;
}

export interface CableRulerResponse {
  readonly value: {
    readonly mode: "ruler";
    readonly designCurrentA: number;
    readonly ambient: CableRulerAmbient;
    readonly selected: CableRulerEntryDto;
    readonly selectedAmpacityA: number;
  };
  readonly warnings: readonly [];
  readonly assumptions: readonly [];
  readonly formulaVariant: string;
  readonly engineVersion: string;
  readonly dataVersion: string;
}

export interface GroupCableSuggestionEntry {
  readonly sectionMm2: number;
  readonly label: string;
  readonly ambient: CableRulerAmbient;
  readonly ampacityA: number;
  readonly standardHintMm2?: 2.5 | 4;
}

export interface GroupCableSuggestionResult {
  readonly toprak_20C: GroupCableSuggestionEntry | null;
  readonly hava_30C: GroupCableSuggestionEntry | null;
}

export interface MaterialCategory {
  id: string; title: string; orderValue?: number; iconKey?: string;
}

export interface Material {
  id: string; categoryId: string; name: string; orderValue?: number;
  brand?: string; modelCode?: string; unit?: string; unitPrice?: number;
  stockQty?: number; notes?: string; attributes?: Record<string, unknown>;
  source: "seed" | "user"; seedDataVersion?: string;
}

export interface MaterialAssignment {
  id: string; recordId: string; materialId: string | null;
  quantity: number; unit?: string;
  snapshotName: string; snapshotCategoryId: string; snapshotCategoryTitle: string;
  snapshotBrand?: string; snapshotModelCode?: string;
  snapshotUnitPrice?: number; snapshotAttributes?: Record<string, unknown>;
  orderValue?: number;
}

export interface ImportSummary {
  categoriesAdded: number; materialsAdded: number; materialsUpdated: number; untouched: number;
}

export interface ElektroPlanBridge {
  readonly runtime: Readonly<{
    platform: string;
    versions: Readonly<{
      chrome: string;
      electron: string;
      node: string;
    }>;
  }>;
  readonly calc: Readonly<{
    motor(request: MotorRequest): Promise<MotorResponse>;
    voltageDrop(request: VoltageDropRequest): Promise<VoltageDropResponse>;
    cable(request: CableRequest): Promise<CableResponse>;
    cableRuler(request: CableRulerRequest): Promise<CableRulerResponse>;
    groupCableSuggest(groupTotalCurrentA: number): Promise<GroupCableSuggestionResult>;
    protection(request: ProtectionRequest): Promise<ProtectionResponse>;
  }>;
  readonly data: Readonly<{
    motorTable(): Promise<readonly unknown[]>;
    cableRulerTable(): Promise<readonly CableRulerEntryDto[]>;
    voltageDropProfiles(): Promise<readonly VoltageDropProfileSummary[]>;
    defaultVoltageDropProfile(): Promise<VoltageDropProfileSummary>;
    installationMethods(): Promise<readonly string[]>;
  }>;
  readonly records: Readonly<{
    list(options?: { groupId?: string }): Promise<readonly CalculationRecord[]>;
    get(id: string): Promise<CalculationRecord | null>;
    save(record: CalculationRecord): Promise<CalculationRecord>;
    delete(id: string): Promise<boolean>;
  }>;
  readonly groups: Readonly<{
    list(): Promise<readonly CalculationGroup[]>;
    save(group: CalculationGroup): Promise<CalculationGroup>;
    delete(id: string): Promise<boolean>;
    duplicate(sourceGroupId: string, newTitle: string): Promise<CalculationGroup>;
  }>;
  readonly export: Readonly<{
    json(bundle: ExportPayloadBundle): Promise<ExportResult>;
    excel(bundle: ExportPayloadBundle): Promise<ExportResult>;
    pdf(bundle: ExportPdfPayload): Promise<ExportResult>;
  }>;
  readonly settings: Readonly<{
    get(key: string): Promise<SettingRecord | null>;
    set(key: string, value: unknown): Promise<SettingRecord>;
    list(): Promise<readonly SettingRecord[]>;
    delete(key: string): Promise<boolean>;
  }>;
  readonly app: Readonly<{
    engineVersion(): Promise<string>;
  }>;
  readonly materials: Readonly<{
    listCategories(): Promise<readonly MaterialCategory[]>;
    upsertCategory(cat: MaterialCategory): Promise<MaterialCategory>;
    deleteCategory(id: string): Promise<boolean>;
    list(filter?: { categoryId?: string; search?: string }): Promise<readonly Material[]>;
    upsert(material: Material): Promise<Material>;
    delete(id: string): Promise<boolean>;
    importExcel(filePath: string, mode?: "merge"): Promise<ImportSummary>;
    pickExcel(): Promise<string | null>;
  }>;
  readonly assignments: Readonly<{
    listForRecords(recordIds: string[]): Promise<readonly MaterialAssignment[]>;
    upsert(assignment: MaterialAssignment): Promise<MaterialAssignment>;
    delete(id: string): Promise<boolean>;
  }>;
}

const bridge: ElektroPlanBridge = {
  runtime: {
    platform: process.platform,
    versions: {
      chrome: process.versions.chrome,
      electron: process.versions.electron,
      node: process.versions.node,
    },
  },
  calc: {
    motor: (request) => invoke(CHANNELS.CalcMotor, request),
    voltageDrop: (request) => invoke(CHANNELS.CalcVoltageDrop, request),
    cable: (request) => invoke(CHANNELS.CalcCable, request),
    cableRuler: (request) => invoke(CHANNELS.CalcCableRuler, request),
    groupCableSuggest: (groupTotalCurrentA) =>
      invoke(CHANNELS.CalcGroupCableSuggest, { groupTotalCurrentA }),
    protection: (request) => invoke(CHANNELS.CalcProtection, request),
  },
  data: {
    motorTable: () => invoke(CHANNELS.DataMotorTable),
    cableRulerTable: () => invoke(CHANNELS.DataCableRulerTable),
    voltageDropProfiles: () => invoke(CHANNELS.DataVoltageDropProfiles),
    defaultVoltageDropProfile: () =>
      invoke(CHANNELS.DataDefaultVoltageDropProfile),
    installationMethods: () => invoke(CHANNELS.DataInstallationMethods),
  },
  records: {
    list: (options) => invoke(CHANNELS.RecordsList, options ?? {}),
    get: (id) => invoke(CHANNELS.RecordsGet, id),
    save: (record) => invoke(CHANNELS.RecordsSave, record),
    delete: (id) => invoke(CHANNELS.RecordsDelete, id),
  },
  groups: {
    list: () => invoke(CHANNELS.GroupsList),
    save: (group) => invoke(CHANNELS.GroupsSave, group),
    delete: (id) => invoke(CHANNELS.GroupsDelete, id),
    duplicate: (sourceGroupId, newTitle) =>
      invoke(CHANNELS.GroupsDuplicate, { sourceGroupId, newTitle }),
  },
  export: {
    json: (bundle) => invoke(CHANNELS.ExportJson, bundle),
    excel: (bundle) => invoke(CHANNELS.ExportExcel, bundle),
    pdf: (bundle) => invoke(CHANNELS.ExportPdf, bundle),
  },
  settings: {
    get: (key) => invoke(CHANNELS.SettingsGet, key),
    set: (key, value) => invoke(CHANNELS.SettingsSet, { key, value }),
    list: () => invoke(CHANNELS.SettingsList),
    delete: (key) => invoke(CHANNELS.SettingsDelete, key),
  },
  app: {
    engineVersion: () => invoke(CHANNELS.AppEngineVersion),
  },
  materials: {
    listCategories: () => invoke(CHANNELS.MaterialsListCategories),
    upsertCategory: (cat) => invoke(CHANNELS.MaterialsUpsertCategory, cat),
    deleteCategory: (id) => invoke(CHANNELS.MaterialsDeleteCategory, id),
    list: (filter) => invoke(CHANNELS.MaterialsList, filter ?? {}),
    upsert: (material) => invoke(CHANNELS.MaterialsUpsert, material),
    delete: (id) => invoke(CHANNELS.MaterialsDelete, id),
    importExcel: (filePath, mode = "merge") => invoke(CHANNELS.MaterialsImportExcel, { filePath, mode }),
    pickExcel: () => invoke(CHANNELS.MaterialsPickExcel),
  },
  assignments: {
    listForRecords: (recordIds) => invoke(CHANNELS.AssignmentsListForRecords, { recordIds }),
    upsert: (assignment) => invoke(CHANNELS.AssignmentsUpsert, assignment),
    delete: (id) => invoke(CHANNELS.AssignmentsDelete, id),
  },
};

contextBridge.exposeInMainWorld("elektroPlan", bridge);

declare global {
  interface Window {
    elektroPlan: ElektroPlanBridge;
  }
}
