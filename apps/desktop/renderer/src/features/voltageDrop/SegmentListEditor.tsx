import { formatNumberTr } from "../../i18n/format";
import type { VoltageDropTreeSegmentDraft } from "./treeModel";
import {
  formatVoltageDropSectionLabel,
  type VoltageDropGroupSegmentResult,
} from "./voltageDropGroup";
import styles from "./SegmentListEditor.module.css";

interface SegmentListEditorProps {
  readonly segments: VoltageDropTreeSegmentDraft[];
  readonly resultSegments: readonly VoltageDropGroupSegmentResult[] | null;
  readonly selectedSegmentId: string | null;
  readonly onSelectSegment: (id: string) => void;
  readonly onAddChild: (parentId: string) => void;
  readonly onRemove: (id: string) => void;
  readonly canRemove: (id: string) => boolean;
}

function resolveStatus(result: VoltageDropGroupSegmentResult | null): string {
  if (!result) return "Sonuc yok";
  if (result.compliant) return "Uygun";
  if (!result.thermalPass && !result.voltageDropPass) return "Termik + dusum";
  if (!result.thermalPass) return "Termik";
  if (!result.voltageDropPass) return "Dusum";
  return "Kontrol";
}

export function SegmentListEditor({
  segments,
  resultSegments,
  selectedSegmentId,
  onSelectSegment,
  onAddChild,
  onRemove,
  canRemove,
}: SegmentListEditorProps) {
  const titleById = new Map(segments.map((segment) => [segment.id, segment.title]));
  const resultById = new Map(
    (resultSegments ?? [])
      .filter((segment) => Boolean(segment.id))
      .map((segment) => [segment.id as string, segment]),
  );

  return (
    <div className={styles.root}>
      {segments.map((segment, index) => {
        const isSelected = selectedSegmentId === segment.id;
        const result = resultById.get(segment.id) ?? null;
        const parentTitle = segment.parentId ? titleById.get(segment.parentId) ?? "-" : "Kok";
        const sectionLabel =
          segment.fixedSectionKey === null
            ? "Otomatik"
            : `Manuel ${segment.fixedSectionKey} mm2`;

        return (
          <div
            key={segment.id}
            className={`${styles.row} ${isSelected ? styles.rowSelected : ""}`}
          >
            <button
              type="button"
              className={styles.selectButton}
              onClick={() => onSelectSegment(segment.id)}
              aria-pressed={isSelected}
              aria-label={`${segment.title || `Segment ${index + 1}`} segmentini sec`}
            >
              <span className={styles.title}>{segment.title || `Segment ${index + 1}`}</span>
              <span className={styles.meta}>Ust: {parentTitle}</span>
              <span className={styles.meta}>
                Yuk: {segment.loadPowerKW === null ? "-" : `${formatNumberTr(segment.loadPowerKW, 2)} kW`}
              </span>
              <span className={styles.meta}>
                Uzunluk: {segment.lengthM === null ? "-" : `${formatNumberTr(segment.lengthM, 1)} m`}
              </span>
              <span className={styles.meta}>
                Kesit: {result ? formatVoltageDropSectionLabel(result) : sectionLabel}
              </span>
              <span className={styles.meta}>Durum: {resolveStatus(result)}</span>
            </button>

            <div className={styles.actions}>
              <button
                type="button"
                className={styles.actionButton}
                onClick={() => onAddChild(segment.id)}
              >
                Alt segment
              </button>
              <button
                type="button"
                className={styles.actionButton}
                onClick={() => onRemove(segment.id)}
                disabled={!canRemove(segment.id)}
              >
                Sil
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
