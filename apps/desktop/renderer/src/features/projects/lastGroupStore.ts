const STORAGE_KEY = "elektroplan.lastGroupByProject";

function readMap(): Record<string, string> {
  if (typeof window === "undefined") {
    return {};
  }
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return {};
    }
    const parsed = JSON.parse(raw) as unknown;
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      const result: Record<string, string> = {};
      for (const [key, value] of Object.entries(parsed as Record<string, unknown>)) {
        if (typeof value === "string") {
          result[key] = value;
        }
      }
      return result;
    }
  } catch {
    // Best-effort: ignore corrupt storage.
  }
  return {};
}

/** Last group a record was saved into, per project. */
export function getLastGroup(projectId: string): string | undefined {
  if (!projectId) {
    return undefined;
  }
  return readMap()[projectId];
}

export function setLastGroup(projectId: string, groupId: string): void {
  if (!projectId || !groupId) {
    return;
  }
  try {
    const map = readMap();
    map[projectId] = groupId;
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
  } catch {
    // Persistence is best-effort.
  }
}
