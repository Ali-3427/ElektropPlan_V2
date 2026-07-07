import {
  buildVoltageDropGroupSubmission,
  type VoltageDropGroupSettingsDraft,
  type VoltageDropGroupSubmission,
} from "./voltageDropGroup";

export interface VoltageDropTreeSegmentDraft {
  id: string;
  parentId: string | null;
  title: string;
  loadPowerKW: number | null;
  lengthM: number | null;
  fixedSectionKey: string | null;
  settings: VoltageDropGroupSettingsDraft;
}

export type VoltageDropTreeSegmentValuePatch = Partial<
  Pick<VoltageDropTreeSegmentDraft, "title" | "loadPowerKW" | "lengthM" | "fixedSectionKey" | "settings">
>;

export function createRootSegment(
  settings: VoltageDropGroupSettingsDraft,
): VoltageDropTreeSegmentDraft {
  return {
    id: crypto.randomUUID(),
    parentId: null,
    title: "Segment 1",
    loadPowerKW: null,
    lengthM: null,
    fixedSectionKey: null,
    settings: { ...settings },
  };
}

export function createChildSegment(
  parentId: string,
  index: number,
  settings: VoltageDropGroupSettingsDraft,
): VoltageDropTreeSegmentDraft {
  return {
    id: crypto.randomUUID(),
    parentId,
    title: `Segment ${index + 1}`,
    loadPowerKW: null,
    lengthM: null,
    fixedSectionKey: null,
    settings: { ...settings },
  };
}

export function updateSegmentDraft(
  segments: VoltageDropTreeSegmentDraft[],
  id: string,
  patch: VoltageDropTreeSegmentValuePatch,
): VoltageDropTreeSegmentDraft[] {
  return segments.map((segment) =>
    segment.id === id ? { ...segment, ...patch } : segment,
  );
}

export function removeSegmentDraft(
  segments: VoltageDropTreeSegmentDraft[],
  id: string,
): VoltageDropTreeSegmentDraft[] {
  const byParent = new Map<string | null, string[]>();
  for (const segment of segments) {
    const current = byParent.get(segment.parentId) ?? [];
    current.push(segment.id);
    byParent.set(segment.parentId, current);
  }

  const idsToRemove = new Set<string>();
  const queue = [id];
  while (queue.length > 0) {
    const currentId = queue.shift();
    if (!currentId || idsToRemove.has(currentId)) {
      continue;
    }

    idsToRemove.add(currentId);
    const children = byParent.get(currentId) ?? [];
    for (const childId of children) {
      queue.push(childId);
    }
  }

  return segments.filter((segment) => !idsToRemove.has(segment.id));
}

export function reparentSegmentDraft(
  segments: VoltageDropTreeSegmentDraft[],
  id: string,
  nextParentId: string | null,
): VoltageDropTreeSegmentDraft[] {
  if (nextParentId === id) {
    return segments;
  }

  const byId = new Map(segments.map((segment) => [segment.id, segment]));
  if (!byId.has(id)) {
    return segments;
  }
  if (nextParentId !== null && !byId.has(nextParentId)) {
    return segments;
  }

  let cursor = nextParentId;
  while (cursor !== null) {
    if (cursor === id) {
      return segments;
    }
    cursor = byId.get(cursor)?.parentId ?? null;
  }

  return segments.map((segment) =>
    segment.id === id ? { ...segment, parentId: nextParentId } : segment,
  );
}

function parseSectionMm2(fixedSectionKey: string | null): number | null {
  if (fixedSectionKey === null) {
    return null;
  }

  const parsed = Number(fixedSectionKey);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return null;
  }

  return parsed;
}

export function buildVoltageDropTreeSubmission(state: {
  title: string;
  segments: VoltageDropTreeSegmentDraft[];
  settings: VoltageDropGroupSettingsDraft;
}): VoltageDropGroupSubmission | null {
  const ids = new Set(state.segments.map((segment) => segment.id));
  if (ids.size !== state.segments.length) {
    return null;
  }

  for (const segment of state.segments) {
    if (segment.parentId !== null && !ids.has(segment.parentId)) {
      return null;
    }
  }

  for (const segment of state.segments) {
    let cursor = segment.parentId;
    while (cursor !== null) {
      if (cursor === segment.id) {
        return null;
      }
      const parent = state.segments.find((entry) => entry.id === cursor);
      cursor = parent?.parentId ?? null;
    }
  }

  const mappedSegments = state.segments.map((segment) => ({
    id: segment.id,
    parentId: segment.parentId,
    title: segment.title,
    loadPowerKW: segment.loadPowerKW,
    localPowerKW: segment.loadPowerKW,
    lengthM: segment.lengthM,
    fixedSectionKey: segment.fixedSectionKey,
    sectionMm2: parseSectionMm2(segment.fixedSectionKey),
    settings: segment.settings,
  }));

  return buildVoltageDropGroupSubmission({
    title: state.title,
    segments: mappedSegments,
    settings: state.settings,
  });
}
