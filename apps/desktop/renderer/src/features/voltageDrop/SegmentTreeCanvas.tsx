import { useEffect, useMemo, useRef, useState } from "react";

import { formatNumberTr, formatPercent } from "../../i18n/format";
import type { VoltageDropTreeSegmentDraft } from "./treeModel";
import {
  formatVoltageDropSectionLabel,
  type VoltageDropGroupSegmentResult,
} from "./voltageDropGroup";
import styles from "./SegmentTreeCanvas.module.css";

const NODE_WIDTH = 180;
const NODE_HEIGHT = 72;
const HORIZONTAL_GAP = 96;
const VERTICAL_GAP = 34;
const VIEW_PADDING = 48;
const MIN_SCALE = 0.4;
const MAX_SCALE = 2.4;

interface SegmentTreeCanvasProps {
  segments: VoltageDropTreeSegmentDraft[];
  resultSegments?: readonly VoltageDropGroupSegmentResult[] | null;
  selectedSegmentId: string | null;
  onSelectSegment: (id: string) => void;
  onAddChild: (parentId: string) => void;
  onFitView?: () => void;
}

interface LayoutNode {
  id: string;
  x: number;
  y: number;
  depth: number;
}

interface LayoutEdge {
  parentId: string;
  childId: string;
  path: string;
}

interface TreeLayout {
  nodes: LayoutNode[];
  edges: LayoutEdge[];
  viewX: number;
  viewY: number;
  viewWidth: number;
  viewHeight: number;
}

export function computeTreeLayout(segments: VoltageDropTreeSegmentDraft[]): TreeLayout {
  if (segments.length === 0) {
    return {
      nodes: [],
      edges: [],
      viewX: -VIEW_PADDING,
      viewY: -VIEW_PADDING,
      viewWidth: NODE_WIDTH + VIEW_PADDING * 2,
      viewHeight: NODE_HEIGHT + VIEW_PADDING * 2,
    };
  }

  const byId = new Map(segments.map((segment) => [segment.id, segment]));
  const childrenByParent = new Map<string, string[]>();
  for (const segment of segments) {
    if (!segment.parentId || !byId.has(segment.parentId)) {
      continue;
    }
    const next = childrenByParent.get(segment.parentId) ?? [];
    next.push(segment.id);
    childrenByParent.set(segment.parentId, next);
  }

  const roots = segments
    .filter((segment) => !segment.parentId || !byId.has(segment.parentId))
    .map((segment) => segment.id);
  const traversalRoots = roots.length > 0 ? roots : segments.map((segment) => segment.id);

  const depthById = new Map<string, number>();
  const queue = roots.map((id) => ({ id, depth: 0 }));
  while (queue.length > 0) {
    const current = queue.shift();
    if (!current || depthById.has(current.id)) {
      continue;
    }
    depthById.set(current.id, current.depth);
    const children = childrenByParent.get(current.id) ?? [];
    for (const childId of children) {
      queue.push({ id: childId, depth: current.depth + 1 });
    }
  }

  const leaves: string[] = [];
  const leafVisitState = new Map<string, "visiting" | "done">();
  function visitForLeaves(id: string) {
    const state = leafVisitState.get(id);
    if (state === "done") {
      return;
    }
    if (state === "visiting") {
      // Cycle detected: treat current node as a terminal fallback.
      leaves.push(id);
      leafVisitState.set(id, "done");
      return;
    }

    leafVisitState.set(id, "visiting");
    const children = childrenByParent.get(id) ?? [];
    if (children.length === 0) {
      leaves.push(id);
      leafVisitState.set(id, "done");
      return;
    }

    for (const childId of children) {
      visitForLeaves(childId);
    }
    leafVisitState.set(id, "done");
  }

  for (const rootId of traversalRoots) {
    visitForLeaves(rootId);
  }

  const centerYById = new Map<string, number>();
  const leafStep = NODE_HEIGHT + VERTICAL_GAP;
  for (const [index, leafId] of leaves.entries()) {
    centerYById.set(leafId, index * leafStep + NODE_HEIGHT / 2);
  }

  const centerVisitState = new Map<string, "visiting" | "done">();
  function resolveCenterY(id: string): number {
    const existing = centerYById.get(id);
    if (existing !== undefined) {
      return existing;
    }

    const state = centerVisitState.get(id);
    if (state === "visiting") {
      // Cycle detected: fallback to deterministic base center.
      const fallback = NODE_HEIGHT / 2;
      centerYById.set(id, fallback);
      return fallback;
    }
    if (state === "done") {
      return centerYById.get(id) ?? NODE_HEIGHT / 2;
    }

    centerVisitState.set(id, "visiting");

    const children = childrenByParent.get(id) ?? [];
    if (children.length === 0) {
      const fallback = NODE_HEIGHT / 2;
      centerYById.set(id, fallback);
      centerVisitState.set(id, "done");
      return fallback;
    }

    let sum = 0;
    let count = 0;
    for (const childId of children) {
      const childY = resolveCenterY(childId);
      if (Number.isFinite(childY)) {
        sum += childY;
        count += 1;
      }
    }
    const avg = count > 0 ? sum / count : NODE_HEIGHT / 2;
    centerYById.set(id, avg);
    centerVisitState.set(id, "done");
    return avg;
  }

  for (const rootId of traversalRoots) {
    resolveCenterY(rootId);
  }

  const nodes: LayoutNode[] = segments.map((segment) => {
    const depth = depthById.get(segment.id) ?? 0;
    const centerY = centerYById.get(segment.id) ?? NODE_HEIGHT / 2;
    return {
      id: segment.id,
      depth,
      x: depth * (NODE_WIDTH + HORIZONTAL_GAP),
      y: centerY - NODE_HEIGHT / 2,
    };
  });

  const minY = Math.min(...nodes.map((node) => node.y));
  const normalizedNodes = nodes.map((node) => ({ ...node, y: node.y - minY }));
  const nodeById = new Map(normalizedNodes.map((node) => [node.id, node]));

  const edges: LayoutEdge[] = [];
  for (const segment of segments) {
    if (!segment.parentId) {
      continue;
    }
    const parent = nodeById.get(segment.parentId);
    const child = nodeById.get(segment.id);
    if (!parent || !child) {
      continue;
    }
    const startX = parent.x + NODE_WIDTH;
    const startY = parent.y + NODE_HEIGHT / 2;
    const endX = child.x;
    const endY = child.y + NODE_HEIGHT / 2;
    const dx = Math.max(endX - startX, 0);
    const curve = dx * 0.42;
    const path = `M ${startX} ${startY} C ${startX + curve} ${startY}, ${endX - curve} ${endY}, ${endX} ${endY}`;
    edges.push({
      parentId: segment.parentId,
      childId: segment.id,
      path,
    });
  }

  const maxX = Math.max(...normalizedNodes.map((node) => node.x + NODE_WIDTH));
  const maxY = Math.max(...normalizedNodes.map((node) => node.y + NODE_HEIGHT));

  return {
    nodes: normalizedNodes,
    edges,
    viewX: -VIEW_PADDING,
    viewY: -VIEW_PADDING,
    viewWidth: maxX + VIEW_PADDING * 2,
    viewHeight: maxY + VIEW_PADDING * 2,
  };
}

function clampScale(value: number): number {
  return Math.max(MIN_SCALE, Math.min(MAX_SCALE, value));
}

function ellipsis(text: string, maxLen: number): string {
  if (text.length <= maxLen) {
    return text;
  }
  return `${text.slice(0, Math.max(0, maxLen - 3)).trimEnd()}...`;
}

function getNodeState(
  segmentId: string,
  resultById: Map<string, VoltageDropGroupSegmentResult>,
): "ok" | "warn" | "bad" | "missing" {
  const result = resultById.get(segmentId);
  if (!result) {
    return "missing";
  }
  if (result.compliant) {
    return "ok";
  }
  if (!result.thermalPass && !result.voltageDropPass) {
    return "bad";
  }
  return "warn";
}

export function SegmentTreeCanvas({
  segments,
  resultSegments,
  selectedSegmentId,
  onSelectSegment,
  onAddChild,
  onFitView,
}: SegmentTreeCanvasProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [scale, setScale] = useState(1);
  const [containerSize, setContainerSize] = useState({ width: 0, height: 0 });

  const layout = useMemo(() => computeTreeLayout(segments), [segments]);
  const nodeById = useMemo(() => new Map(segments.map((segment) => [segment.id, segment])), [segments]);
  const resultById = useMemo(() => {
    const next = new Map<string, VoltageDropGroupSegmentResult>();
    if (!resultSegments) {
      return next;
    }

    for (const resultSegment of resultSegments) {
      if (resultSegment.id) {
        next.set(resultSegment.id, resultSegment);
      }
    }
    return next;
  }, [resultSegments]);

  useEffect(() => {
    const element = containerRef.current;
    if (!element) {
      return;
    }

    const update = () => {
      setContainerSize({
        width: element.clientWidth,
        height: element.clientHeight,
      });
    };

    update();
    const observer = new ResizeObserver(update);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  const fitView = () => {
    const width = containerSize.width;
    const height = containerSize.height;
    if (width <= 0 || height <= 0) {
      return;
    }
    const fitScale = Math.min(width / layout.viewWidth, height / layout.viewHeight);
    setScale(clampScale(fitScale));
    onFitView?.();
  };

  useEffect(() => {
    if (segments.length === 0 || containerSize.width <= 0 || containerSize.height <= 0) {
      return;
    }
    const fitScale = Math.min(
      containerSize.width / layout.viewWidth,
      containerSize.height / layout.viewHeight,
    );
    setScale(clampScale(fitScale));
  }, [containerSize.height, containerSize.width, layout.viewHeight, layout.viewWidth, segments.length]);

  const scaledWidth = layout.viewWidth / scale;
  const scaledHeight = layout.viewHeight / scale;
  const viewX = layout.viewX + (layout.viewWidth - scaledWidth) / 2;
  const viewY = layout.viewY + (layout.viewHeight - scaledHeight) / 2;
  const svgViewBox = `${viewX} ${viewY} ${scaledWidth} ${scaledHeight}`;
  const selectedId = selectedSegmentId ?? segments[0]?.id ?? null;
  const canvasHeight = Math.max(360, Math.min(900, layout.viewHeight + 40));

  return (
    <div className={styles.root}>
      <div className={styles.controls} role="group" aria-label="Segment agi araclari">
        <button
          type="button"
          className={styles.controlButton}
          onClick={() => setScale((current) => clampScale(current * 1.15))}
          aria-label="Yakinlastir"
          title="Yakinlastir"
        >
          +
        </button>
        <button
          type="button"
          className={styles.controlButton}
          onClick={() => setScale((current) => clampScale(current / 1.15))}
          aria-label="Uzaklastir"
          title="Uzaklastir"
        >
          -
        </button>
        <button
          type="button"
          className={styles.controlButtonWide}
          onClick={fitView}
        >
          Sigdir
        </button>
        <button
          type="button"
          className={styles.controlButtonWide}
          onClick={() => {
            if (selectedId) {
              onAddChild(selectedId);
            }
          }}
          disabled={!selectedId}
        >
          Alt segment
        </button>
      </div>

      <div className={styles.canvas} ref={containerRef} style={{ minHeight: canvasHeight }}>
        <svg className={styles.svg} viewBox={svgViewBox} role="img" aria-label="Segment agaci">
          <g className={styles.edgeLayer}>
            {layout.edges.map((edge) => (
              <path key={`${edge.parentId}-${edge.childId}`} d={edge.path} className={styles.edge} />
            ))}
          </g>

          <g className={styles.nodeLayer}>
            {layout.nodes.map((node) => {
              const segment = nodeById.get(node.id);
              if (!segment) {
                return null;
              }
              const resultSegment = resultById.get(node.id);
              const nodeState = getNodeState(node.id, resultById);
              const isSelected = selectedId === node.id;
              const stateClass =
                nodeState === "ok"
                  ? styles.nodeOk
                  : nodeState === "warn"
                    ? styles.nodeWarn
                    : nodeState === "bad"
                      ? styles.nodeBad
                      : styles.nodeMissing;

              const title = ellipsis(segment.title.trim() || "Isimsiz segment", 26);
              const kW = formatNumberTr(segment.loadPowerKW, 2);
              const length = formatNumberTr(segment.lengthM, 1);
              const baseLine = ellipsis(`${kW} kW / ${length} m`, 30);
              const sectionLine = resultSegment
                ? ellipsis(formatVoltageDropSectionLabel(resultSegment), 30)
                : "Sonuc yok";
              const dropLine = resultSegment
                ? ellipsis(`Kumulatif DV ${formatPercent(resultSegment.cumulativeDeltaVPercent, 2)}`, 30)
                : "";

              return (
                <g
                  key={node.id}
                  transform={`translate(${node.x}, ${node.y})`}
                  className={`${styles.nodeGroup} ${stateClass} ${isSelected ? styles.nodeSelected : ""}`}
                  onClick={() => onSelectSegment(node.id)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      onSelectSegment(node.id);
                    }
                  }}
                  role="button"
                  tabIndex={0}
                  aria-label={`${segment.title} segmenti`}
                  aria-pressed={isSelected}
                >
                  <rect x={0} y={0} width={NODE_WIDTH} height={NODE_HEIGHT} rx={12} className={styles.nodeRect} />
                  <text x={12} y={22} className={styles.nodeTitle}>
                    {title}
                  </text>
                  <text x={12} y={40} className={styles.nodeMeta}>
                    {baseLine}
                  </text>
                  <text x={12} y={56} className={styles.nodeMeta}>
                    {sectionLine}
                  </text>
                  {dropLine ? (
                    <text x={12} y={68} className={styles.nodeMetaSmall}>
                      {dropLine}
                    </text>
                  ) : null}
                </g>
              );
            })}
          </g>
        </svg>
      </div>
    </div>
  );
}
