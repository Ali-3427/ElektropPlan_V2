import { ENGINE_VERSION } from "@elektroplan/calculation-core";
import { dialog, type IpcMain, type IpcMainInvokeEvent } from "electron";

import type { AppServices } from "../services/index.js";
import { IPC_CHANNELS, type IpcEnvelope } from "./channels.js";

type Handler = (
  event: IpcMainInvokeEvent,
  payload: unknown,
) => Promise<unknown> | unknown;

function toError(err: unknown): { code: string; message: string } {
  if (err instanceof Error) {
    return { code: err.name || "Error", message: err.message };
  }
  return { code: "UnknownError", message: String(err) };
}

function wrap(handler: Handler): Handler {
  return async (event, payload) => {
    try {
      const value = await handler(event, payload);
      const envelope: IpcEnvelope<unknown> = { ok: true, value };
      return envelope;
    } catch (err) {
      const envelope: IpcEnvelope<never> = { ok: false, error: toError(err) };
      return envelope;
    }
  };
}

function assertOptionalGroupId(payload: unknown): string | undefined {
  if (payload === undefined || payload === null) {
    return undefined;
  }
  if (typeof payload === "object") {
    const candidate = (payload as { groupId?: unknown }).groupId;
    if (candidate === undefined) {
      return undefined;
    }
    if (typeof candidate !== "string" || candidate.length === 0) {
      throw new TypeError("groupId must be a non-empty string.");
    }
    return candidate;
  }
  throw new TypeError("records:list payload must be an object or undefined.");
}

function assertIdPayload(payload: unknown): string {
  if (typeof payload === "string") {
    if (payload.length === 0) {
      throw new TypeError("id must be a non-empty string.");
    }
    return payload;
  }
  if (typeof payload === "object" && payload !== null) {
    const candidate = (payload as { id?: unknown }).id;
    if (typeof candidate !== "string" || candidate.length === 0) {
      throw new TypeError("Payload must include a non-empty `id` string.");
    }
    return candidate;
  }
  throw new TypeError("Payload must be a string id or { id } object.");
}

function assertKeyPayload(payload: unknown): string {
  if (typeof payload === "string") {
    if (payload.length === 0) {
      throw new TypeError("key must be a non-empty string.");
    }
    return payload;
  }
  if (typeof payload === "object" && payload !== null) {
    const candidate = (payload as { key?: unknown }).key;
    if (typeof candidate !== "string" || candidate.length === 0) {
      throw new TypeError("Payload must include a non-empty `key` string.");
    }
    return candidate;
  }
  throw new TypeError("Payload must be a string key or { key } object.");
}

function assertSettingSetPayload(payload: unknown): {
  key: string;
  value: unknown;
} {
  if (typeof payload !== "object" || payload === null) {
    throw new TypeError("settings:set payload must be an object.");
  }
  const { key, value } = payload as { key?: unknown; value?: unknown };
  if (typeof key !== "string" || key.length === 0) {
    throw new TypeError("settings:set payload must include a non-empty `key`.");
  }
  if (value === undefined) {
    throw new TypeError("settings:set payload must include a `value`.");
  }
  return { key, value };
}

function assertDuplicateGroupPayload(payload: unknown): {
  newTitle: string;
  sourceGroupId: string;
} {
  if (typeof payload !== "object" || payload === null) {
    throw new TypeError("groups:duplicate payload must be an object.");
  }

  const { newTitle, sourceGroupId } = payload as {
    newTitle?: unknown;
    sourceGroupId?: unknown;
  };

  if (typeof sourceGroupId !== "string" || sourceGroupId.length === 0) {
    throw new TypeError(
      "groups:duplicate payload must include a non-empty `sourceGroupId`.",
    );
  }

  if (typeof newTitle !== "string" || newTitle.trim().length === 0) {
    throw new TypeError(
      "groups:duplicate payload must include a non-empty `newTitle`.",
    );
  }

  return { newTitle, sourceGroupId };
}

function assertGroupTotalCurrentPayload(payload: unknown): number {
  if (typeof payload === "number" && Number.isFinite(payload)) {
    return payload;
  }

  if (typeof payload === "object" && payload !== null) {
    const candidate = (payload as { groupTotalCurrentA?: unknown }).groupTotalCurrentA;
    if (typeof candidate === "number" && Number.isFinite(candidate)) {
      return candidate;
    }
  }

  throw new TypeError(
    "calc:group-cable-suggest payload must include a finite `groupTotalCurrentA` number.",
  );
}

export function registerIpcHandlers(
  ipcMain: IpcMain,
  services: AppServices,
): void {
  ipcMain.handle(
    IPC_CHANNELS.CalcMotor,
    wrap((_event, payload) => services.calculate.runMotor(payload)),
  );
  ipcMain.handle(
    IPC_CHANNELS.CalcVoltageDrop,
    wrap((_event, payload) => services.calculate.runVoltageDrop(payload)),
  );
  ipcMain.handle(
    IPC_CHANNELS.CalcCable,
    wrap((_event, payload) => services.calculate.runCable(payload)),
  );
  ipcMain.handle(
    IPC_CHANNELS.CalcCableRuler,
    wrap((_event, payload) => services.calculate.runCableRuler(payload)),
  );
  ipcMain.handle(
    IPC_CHANNELS.CalcGroupCableSuggest,
    wrap((_event, payload) =>
      services.calculate.runGroupCableSuggest(assertGroupTotalCurrentPayload(payload)),
    ),
  );
  ipcMain.handle(
    IPC_CHANNELS.CalcProtection,
    wrap((_event, payload) => services.calculate.runProtection(payload)),
  );

  ipcMain.handle(
    IPC_CHANNELS.DataMotorTable,
    wrap(() => services.calculate.listMotorTableEntries()),
  );
  ipcMain.handle(
    IPC_CHANNELS.DataCableRulerTable,
    wrap(() => services.calculate.listCableRulerEntries()),
  );
  ipcMain.handle(
    IPC_CHANNELS.DataVoltageDropProfiles,
    wrap(() => services.calculate.listVoltageDropProfiles()),
  );
  ipcMain.handle(
    IPC_CHANNELS.DataDefaultVoltageDropProfile,
    wrap(() => services.calculate.getDefaultVoltageDropProfile()),
  );
  ipcMain.handle(
    IPC_CHANNELS.DataInstallationMethods,
    wrap(() => services.calculate.getInstallationMethods()),
  );

  ipcMain.handle(
    IPC_CHANNELS.RecordsList,
    wrap((_event, payload) =>
      services.records.listRecords(
        assertOptionalGroupId(payload) === undefined
          ? undefined
          : { groupId: assertOptionalGroupId(payload)! },
      ),
    ),
  );
  ipcMain.handle(
    IPC_CHANNELS.RecordsGet,
    wrap((_event, payload) => services.records.getRecord(assertIdPayload(payload))),
  );
  ipcMain.handle(
    IPC_CHANNELS.RecordsSave,
    wrap((_event, payload) => services.records.saveRecord(payload)),
  );
  ipcMain.handle(
    IPC_CHANNELS.RecordsDelete,
    wrap((_event, payload) =>
      services.records.deleteRecord(assertIdPayload(payload)),
    ),
  );

  ipcMain.handle(
    IPC_CHANNELS.GroupsList,
    wrap(() => services.records.listGroups()),
  );
  ipcMain.handle(
    IPC_CHANNELS.GroupsSave,
    wrap((_event, payload) => services.records.saveGroup(payload)),
  );
  ipcMain.handle(
    IPC_CHANNELS.GroupsDelete,
    wrap((_event, payload) =>
      services.records.deleteGroup(assertIdPayload(payload)),
    ),
  );
  ipcMain.handle(
    IPC_CHANNELS.GroupsDuplicate,
    wrap((_event, payload) => {
      const { newTitle, sourceGroupId } = assertDuplicateGroupPayload(payload);
      return services.records.duplicateGroup(sourceGroupId, newTitle);
    }),
  );

  ipcMain.handle(
    IPC_CHANNELS.ExportJson,
    wrap((_event, payload) => services.export.exportJson(payload)),
  );
  ipcMain.handle(
    IPC_CHANNELS.ExportExcel,
    wrap((_event, payload) => services.export.exportExcel(payload)),
  );
  ipcMain.handle(
    IPC_CHANNELS.ExportPdf,
    wrap((_event, payload) => services.export.exportPdf(payload)),
  );

  ipcMain.handle(
    IPC_CHANNELS.SettingsGet,
    wrap((_event, payload) => services.settings.getSetting(assertKeyPayload(payload))),
  );
  ipcMain.handle(
    IPC_CHANNELS.SettingsSet,
    wrap((_event, payload) => {
      const { key, value } = assertSettingSetPayload(payload);
      return services.settings.setSetting(key, value as never);
    }),
  );
  ipcMain.handle(
    IPC_CHANNELS.SettingsList,
    wrap(() => services.settings.listSettings()),
  );
  ipcMain.handle(
    IPC_CHANNELS.SettingsDelete,
    wrap((_event, payload) =>
      services.settings.deleteSetting(assertKeyPayload(payload)),
    ),
  );

  ipcMain.handle(
    IPC_CHANNELS.AppEngineVersion,
    wrap(() => ENGINE_VERSION),
  );

  ipcMain.handle(
    IPC_CHANNELS.MaterialsListCategories,
    wrap(() => services.materials.listCategories()),
  );
  ipcMain.handle(
    IPC_CHANNELS.MaterialsUpsertCategory,
    wrap((_event, payload) => services.materials.upsertCategory(payload)),
  );
  ipcMain.handle(
    IPC_CHANNELS.MaterialsDeleteCategory,
    wrap((_event, payload) => services.materials.deleteCategory(payload)),
  );
  ipcMain.handle(
    IPC_CHANNELS.MaterialsList,
    wrap((_event, payload) => services.materials.listMaterials(payload)),
  );
  ipcMain.handle(
    IPC_CHANNELS.MaterialsUpsert,
    wrap((_event, payload) => services.materials.upsertMaterial(payload)),
  );
  ipcMain.handle(
    IPC_CHANNELS.MaterialsDelete,
    wrap((_event, payload) => services.materials.deleteMaterial(payload)),
  );
  ipcMain.handle(
    IPC_CHANNELS.MaterialsImportExcel,
    wrap((_event, payload) => services.materials.importExcel(payload)),
  );
  ipcMain.handle(
    IPC_CHANNELS.MaterialsPickExcel,
    wrap(async () => {
      const result = await dialog.showOpenDialog({
        properties: ["openFile"],
        filters: [{ name: "Excel", extensions: ["xlsx"] }],
      });
      return result.canceled ? null : (result.filePaths[0] ?? null);
    }),
  );
  ipcMain.handle(
    IPC_CHANNELS.AssignmentsListForRecords,
    wrap((_event, payload) =>
      services.materials.listAssignments(
        (payload as { recordIds: string[] }).recordIds,
      ),
    ),
  );
  ipcMain.handle(
    IPC_CHANNELS.AssignmentsUpsert,
    wrap((_event, payload) => services.materials.upsertAssignment(payload)),
  );
  ipcMain.handle(
    IPC_CHANNELS.AssignmentsDelete,
    wrap((_event, payload) => services.materials.deleteAssignment(payload)),
  );
}
