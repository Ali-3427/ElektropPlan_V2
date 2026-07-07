import type {
  JsonValue,
  SettingsRepository,
  StorageSetting,
} from "@elektroplan/storage";

export interface SettingsService {
  getSetting(key: string): StorageSetting | null;
  setSetting(key: string, value: JsonValue): StorageSetting;
  listSettings(): readonly StorageSetting[];
  deleteSetting(key: string): boolean;
}

function assertKey(key: unknown): asserts key is string {
  if (typeof key !== "string" || key.length === 0) {
    throw new TypeError("Setting key must be a non-empty string.");
  }
}

export function createSettingsService(
  repository: SettingsRepository,
): SettingsService {
  return {
    getSetting(key) {
      assertKey(key);
      return repository.get(key);
    },
    setSetting(key, value) {
      assertKey(key);
      return repository.set(key, value);
    },
    listSettings() {
      return repository.list();
    },
    deleteSetting(key) {
      assertKey(key);
      return repository.delete(key);
    },
  };
}
