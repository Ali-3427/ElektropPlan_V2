import type { VoltageDropTreeSegmentInput } from "./types.js";

export interface VoltageDropTreeGraph {
  readonly rootId: string;
  readonly segmentsById: ReadonlyMap<string, VoltageDropTreeSegmentInput>;
  readonly childIdsById: ReadonlyMap<string, readonly string[]>;
  readonly pathIdsById: ReadonlyMap<string, readonly string[]>;
  readonly flowPowerById: ReadonlyMap<string, number>;
  readonly orderedIds: readonly string[];
}

export function buildVoltageDropTreeGraph(
  segments: readonly VoltageDropTreeSegmentInput[],
): VoltageDropTreeGraph {
  const segmentsById = new Map<string, VoltageDropTreeSegmentInput>();
  for (const segment of segments) {
    if (segmentsById.has(segment.id)) {
      throw new RangeError("segments must have unique ids.");
    }
    segmentsById.set(segment.id, segment);
  }

  const rootSegments = segments.filter((segment) => segment.parentId === null);
  if (rootSegments.length !== 1) {
    throw new RangeError("segments must contain exactly one root segment.");
  }

  const rootId = rootSegments[0]!.id;
  const childIdsByIdMutable = new Map<string, string[]>();
  for (const segment of segments) {
    childIdsByIdMutable.set(segment.id, []);
  }
  for (const segment of segments) {
    if (segment.parentId === null) {
      continue;
    }
    const siblings = childIdsByIdMutable.get(segment.parentId);
    if (!siblings) {
      throw new RangeError("each non-root segment parentId must reference an existing segment id.");
    }
    siblings.push(segment.id);
  }

  const reachable = new Set<string>();
  const stack = [rootId];
  while (stack.length > 0) {
    const segmentId = stack.pop()!;
    if (reachable.has(segmentId)) {
      continue;
    }
    reachable.add(segmentId);
    const childIds = childIdsByIdMutable.get(segmentId) ?? [];
    for (let index = childIds.length - 1; index >= 0; index -= 1) {
      stack.push(childIds[index]!);
    }
  }

  if (reachable.size !== segments.length) {
    throw new RangeError("all segments must be reachable from the root segment.");
  }

  // Detect cycles across the validated connected tree.
  const visitState = new Map<string, 0 | 1 | 2>();
  const detectCycle = (segmentId: string): void => {
    const state = visitState.get(segmentId) ?? 0;
    if (state === 1) {
      throw new RangeError("segments must form an acyclic tree.");
    }
    if (state === 2) {
      return;
    }
    visitState.set(segmentId, 1);
    const childIds = childIdsByIdMutable.get(segmentId) ?? [];
    for (const childId of childIds) {
      detectCycle(childId);
    }
    visitState.set(segmentId, 2);
  };
  detectCycle(rootId);

  const pathIdsById = new Map<string, readonly string[]>();
  const flowPowerById = new Map<string, number>();
  const orderedIds: string[] = [];

  const walkFromRoot = (segmentId: string, parentPath: readonly string[]): number => {
    orderedIds.push(segmentId);
    const path = [...parentPath, segmentId] as const;
    pathIdsById.set(segmentId, path);

    const segment = segmentsById.get(segmentId)!;
    let flowPower = segment.loadPowerKW;
    const childIds = childIdsByIdMutable.get(segmentId) ?? [];
    for (const childId of childIds) {
      flowPower += walkFromRoot(childId, path);
    }
    flowPowerById.set(segmentId, flowPower);
    return flowPower;
  };

  walkFromRoot(rootId, []);

  const childIdsById = new Map<string, readonly string[]>();
  for (const [segmentId, childIds] of childIdsByIdMutable) {
    childIdsById.set(segmentId, childIds);
  }

  return {
    rootId,
    segmentsById,
    childIdsById,
    pathIdsById,
    flowPowerById,
    orderedIds,
  };
}
