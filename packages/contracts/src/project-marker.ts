import type { CalculationGroup } from "./schemas.js";

export const PROJECT_MARKER_TAG = "project" as const;

export function isProjectGroup(group: CalculationGroup): boolean {
  if (group.parentGroupId !== undefined) {
    return false;
  }

  return group.tags?.includes(PROJECT_MARKER_TAG) === true;
}

export function isProjectChildGroup(group: CalculationGroup): boolean {
  return typeof group.parentGroupId === "string" && group.parentGroupId.length > 0;
}
