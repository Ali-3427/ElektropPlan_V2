import { buildVoltageDropTreeGraph } from "./graph.js";
import { calculateVoltageDropTree } from "./index.js";
import { optimizeVoltageDropTree } from "./optimizer.js";
import type { VoltageDropTreeSegmentInput } from "./types.js";

describe("buildVoltageDropTreeGraph", () => {
  it("builds deterministic root-first depth-first order and derived maps", () => {
    const segments: readonly VoltageDropTreeSegmentInput[] = [
      { id: "main", parentId: null, title: "Main", loadPowerKW: 0, lengthM: 10 },
      { id: "a", parentId: "main", title: "A", loadPowerKW: 2, lengthM: 10 },
      { id: "b", parentId: "main", title: "B", loadPowerKW: 5, lengthM: 10 },
      { id: "a1", parentId: "a", title: "A1", loadPowerKW: 10, lengthM: 10 },
    ];

    const graph = buildVoltageDropTreeGraph(segments);

    expect(graph.rootId).toBe("main");
    expect(graph.orderedIds).toEqual(["main", "a", "a1", "b"]);
    expect(graph.childIdsById.get("main")).toEqual(["a", "b"]);
    expect(graph.childIdsById.get("a")).toEqual(["a1"]);
    expect(graph.pathIdsById.get("a1")).toEqual(["main", "a", "a1"]);
    expect(graph.pathIdsById.get("b")).toEqual(["main", "b"]);
    expect(graph.flowPowerById.get("main")).toBe(17);
    expect(graph.flowPowerById.get("a")).toBe(12);
    expect(graph.flowPowerById.get("b")).toBe(5);
  });

  it("throws on duplicate ids", () => {
    expect(() =>
      buildVoltageDropTreeGraph([
        { id: "main", parentId: null, title: "Main", loadPowerKW: 1, lengthM: 1 },
        { id: "main", parentId: null, title: "Main 2", loadPowerKW: 1, lengthM: 1 },
      ]),
    ).toThrow(new RangeError("segments must have unique ids."));
  });

  it("throws when there are multiple root segments", () => {
    expect(() =>
      buildVoltageDropTreeGraph([
        { id: "main", parentId: null, title: "Main", loadPowerKW: 1, lengthM: 1 },
        { id: "otherRoot", parentId: null, title: "Other", loadPowerKW: 1, lengthM: 1 },
      ]),
    ).toThrow(new RangeError("segments must contain exactly one root segment."));
  });

  it("throws when there is no root segment", () => {
    expect(() =>
      buildVoltageDropTreeGraph([
        { id: "a", parentId: "b", title: "A", loadPowerKW: 1, lengthM: 1 },
        { id: "b", parentId: "a", title: "B", loadPowerKW: 1, lengthM: 1 },
      ]),
    ).toThrow(new RangeError("segments must contain exactly one root segment."));
  });

  it("throws for disconnected cycle components", () => {
    expect(() =>
      buildVoltageDropTreeGraph([
        { id: "main", parentId: null, title: "Main", loadPowerKW: 1, lengthM: 1 },
        { id: "a", parentId: "b", title: "A", loadPowerKW: 1, lengthM: 1 },
        { id: "b", parentId: "a", title: "B", loadPowerKW: 1, lengthM: 1 },
      ]),
    ).toThrow(new RangeError("all segments must be reachable from the root segment."));
  });

  it("throws when not all segments are reachable from root", () => {
    expect(() =>
      buildVoltageDropTreeGraph([
        { id: "main", parentId: null, title: "Main", loadPowerKW: 1, lengthM: 1 },
        { id: "a", parentId: "main", title: "A", loadPowerKW: 1, lengthM: 1 },
        { id: "x", parentId: "y", title: "X", loadPowerKW: 1, lengthM: 1 },
        { id: "y", parentId: "x", title: "Y", loadPowerKW: 1, lengthM: 1 },
      ]),
    ).toThrow(new RangeError("all segments must be reachable from the root segment."));
  });

  it("throws when a non-root parent id does not exist", () => {
    expect(() =>
      buildVoltageDropTreeGraph([
        { id: "main", parentId: null, title: "Main", loadPowerKW: 1, lengthM: 1 },
        { id: "a", parentId: "missing", title: "A", loadPowerKW: 1, lengthM: 1 },
      ]),
    ).toThrow(new RangeError("each non-root segment parentId must reference an existing segment id."));
  });

  it("preserves sibling input order and deterministic DFS for each input ordering", () => {
    const firstOrder: readonly VoltageDropTreeSegmentInput[] = [
      { id: "main", parentId: null, title: "Main", loadPowerKW: 0, lengthM: 1 },
      { id: "a", parentId: "main", title: "A", loadPowerKW: 1, lengthM: 1 },
      { id: "b", parentId: "main", title: "B", loadPowerKW: 1, lengthM: 1 },
      { id: "a1", parentId: "a", title: "A1", loadPowerKW: 1, lengthM: 1 },
    ];
    const secondOrder: readonly VoltageDropTreeSegmentInput[] = [
      { id: "main", parentId: null, title: "Main", loadPowerKW: 0, lengthM: 1 },
      { id: "b", parentId: "main", title: "B", loadPowerKW: 1, lengthM: 1 },
      { id: "a", parentId: "main", title: "A", loadPowerKW: 1, lengthM: 1 },
      { id: "a1", parentId: "a", title: "A1", loadPowerKW: 1, lengthM: 1 },
    ];

    const firstGraph = buildVoltageDropTreeGraph(firstOrder);
    const secondGraph = buildVoltageDropTreeGraph(secondOrder);

    expect(firstGraph.childIdsById.get("main")).toEqual(["a", "b"]);
    expect(firstGraph.orderedIds).toEqual(["main", "a", "a1", "b"]);
    expect(secondGraph.childIdsById.get("main")).toEqual(["b", "a"]);
    expect(secondGraph.orderedIds).toEqual(["main", "b", "a", "a1"]);
  });
});

describe("calculateVoltageDropTree", () => {
  it("computes downstream flow and cumulative drop by segment path only", () => {
    const result = calculateVoltageDropTree({
      segments: [
        { id: "main", parentId: null, title: "Main", loadPowerKW: 0, lengthM: 10, fixedSectionKey: "50" },
        { id: "a", parentId: "main", title: "A", loadPowerKW: 10, lengthM: 10, fixedSectionKey: "50" },
        { id: "b", parentId: "main", title: "B", loadPowerKW: 5, lengthM: 10, fixedSectionKey: "50" },
        { id: "a1", parentId: "a", title: "A1", loadPowerKW: 2, lengthM: 10, fixedSectionKey: "50" },
      ],
      settings: {
        baseVoltageV: 400,
        voltageType: "three",
        cosPhi: 0.8,
        limitPercent: 30,
        conductor: "copper",
        installation: "overhead",
      },
    });

    const byId = new Map(result.value.segments.map((segment) => [segment.id, segment] as const));
    const main = byId.get("main")!;
    const a = byId.get("a")!;
    const b = byId.get("b")!;
    const a1 = byId.get("a1")!;

    expect(main.flowPowerKW).toBeCloseTo(17, 12);
    expect(a.flowPowerKW).toBeCloseTo(12, 12);
    expect(b.flowPowerKW).toBeCloseTo(5, 12);
    expect(a1.flowPowerKW).toBeCloseTo(2, 12);
    expect(b.cumulativeDeltaVPercent).toBeCloseTo(
      main.segmentDeltaVPercent + b.segmentDeltaVPercent,
      12,
    );
    expect(a1.cumulativeDeltaVPercent).toBeCloseTo(
      main.segmentDeltaVPercent + a.segmentDeltaVPercent + a1.segmentDeltaVPercent,
      12,
    );
  });

  it("uses cosPhi in current but keeps legacy simplified drop independent from cosPhi", () => {
    const cosPhiOne = calculateVoltageDropTree({
      segments: [
        {
          id: "root",
          parentId: null,
          title: "Main",
          loadPowerKW: 10,
          lengthM: 100,
          fixedSectionKey: "300",
        },
      ],
      settings: {
        baseVoltageV: 400,
        voltageType: "three",
        cosPhi: 1,
        efficiencyPercent: 100,
        limitPercent: 30,
        conductor: "copper",
        installation: "underground",
      },
    });

    const cosPhiHalf = calculateVoltageDropTree({
      segments: [
        {
          id: "root",
          parentId: null,
          title: "Main",
          loadPowerKW: 10,
          lengthM: 100,
          fixedSectionKey: "300",
        },
      ],
      settings: {
        baseVoltageV: 400,
        voltageType: "three",
        cosPhi: 0.5,
        efficiencyPercent: 100,
        limitPercent: 30,
        conductor: "copper",
        installation: "underground",
      },
    });

    const segmentOne = cosPhiOne.value.segments[0]!;
    const segmentHalf = cosPhiHalf.value.segments[0]!;
    expect(segmentHalf.currentA).toBeCloseTo(segmentOne.currentA * 2, 10);
    expect(segmentHalf.segmentDeltaVPercent).toBeCloseTo(segmentOne.segmentDeltaVPercent, 12);
  });

  it("throws exact tree no-solution error when voltage-drop limit cannot be satisfied", () => {
    expect(() =>
      calculateVoltageDropTree({
        segments: [
          {
            id: "root",
            parentId: null,
            title: "Main",
            loadPowerKW: 10,
            lengthM: 5000,
          },
        ],
        settings: {
          baseVoltageV: 400,
          voltageType: "three",
          cosPhi: 0.8,
          efficiencyPercent: 100,
          limitPercent: 0.01,
          conductor: "copper",
          installation: "underground",
        },
      }),
    ).toThrow(
      new RangeError("No cable cross-section satisfies the voltage-drop limit for this tree."),
    );
  });

  it("throws same no-solution error when failing-path segments are fixed and cannot be upsized", () => {
    expect(() =>
      calculateVoltageDropTree({
        segments: [
          {
            id: "root",
            parentId: null,
            title: "Main",
            loadPowerKW: 5,
            lengthM: 500,
            fixedSectionKey: "1.5",
          },
          {
            id: "leaf",
            parentId: "root",
            title: "Leaf",
            loadPowerKW: 5,
            lengthM: 500,
            fixedSectionKey: "1.5",
          },
        ],
        settings: {
          baseVoltageV: 400,
          voltageType: "three",
          cosPhi: 0.8,
          efficiencyPercent: 100,
          limitPercent: 0.1,
          conductor: "copper",
          installation: "overhead",
        },
      }),
    ).toThrow(
      new RangeError("No cable cross-section satisfies the voltage-drop limit for this tree."),
    );
  });

  it("throws invariant error when candidate flow power is unexpectedly missing during sensitivity scoring", () => {
    let flowReadCount = 0;
    const flowPowerById = {
      get(key: string): number | undefined {
        if (key !== "root") {
          return undefined;
        }
        flowReadCount += 1;
        return flowReadCount <= 2 ? 10 : undefined;
      },
    } as unknown as ReadonlyMap<string, number>;

    expect(() =>
      optimizeVoltageDropTree({
        graph: {
          rootId: "root",
          segmentsById: new Map([
            [
              "root",
              {
                id: "root",
                parentId: null,
                title: "Root",
                loadPowerKW: 10,
                lengthM: 5000,
              },
            ],
          ]),
          childIdsById: new Map([["root", []]]),
          pathIdsById: new Map([["root", ["root"]]]),
          flowPowerById,
          orderedIds: ["root"],
        },
        settings: {
          limitPercent: 0.01,
          baseVoltageV: 400,
          cosPhi: 0.8,
          efficiencyPercent: 100,
          conductor: "copper",
          installation: "overhead",
          temperatureC: 30,
          groupedCircuits: 1,
          voltageType: "three",
        },
      }),
    ).toThrow(new Error("missing flow power for candidate segment 'root'."));
  });
});
