import { useMemo } from "react";

import { Button } from "../../ui/Button";
import { NumberInput } from "../../ui/NumberInput";
import { Select } from "../../ui/Select";
import {
  CONDUCTOR_MATERIAL_OPTIONS,
  INSTALLATION_METHOD_OPTIONS,
  type VoltageDropGroupSettingsDraft,
} from "./voltageDropGroup";
import type {
  VoltageDropTreeSegmentDraft,
  VoltageDropTreeSegmentValuePatch,
} from "./treeModel";
import styles from "./SegmentInspector.module.css";

const SECTION_MODE_OPTIONS = [
  { value: "auto", label: "Otomatik" },
  { value: "manual", label: "Manuel" },
];

const DEFAULT_SECTION_KEYS = [
  "1.5",
  "2.5",
  "4",
  "6",
  "10",
  "16",
  "25",
  "35",
  "50",
  "70",
  "95",
  "120",
  "150",
  "185",
  "240",
  "300",
  "400",
  "500",
  "630",
];

const ROOT_PARENT_VALUE = "__root__";

interface SegmentInspectorProps {
  segment: VoltageDropTreeSegmentDraft;
  segmentIndex: number;
  segments: VoltageDropTreeSegmentDraft[];
  canRemove: boolean;
  onChange: (next: VoltageDropTreeSegmentValuePatch) => void;
  onSettingsChange: (next: Partial<VoltageDropGroupSettingsDraft>) => void;
  onReparent: (nextParentId: string) => void;
  onRemove: () => void;
}

function collectDescendantIds(
  segments: VoltageDropTreeSegmentDraft[],
  rootId: string,
): Set<string> {
  const childrenByParent = new Map<string, string[]>();
  for (const entry of segments) {
    if (!entry.parentId) {
      continue;
    }

    const bucket = childrenByParent.get(entry.parentId) ?? [];
    bucket.push(entry.id);
    childrenByParent.set(entry.parentId, bucket);
  }

  const descendants = new Set<string>();
  const queue = [...(childrenByParent.get(rootId) ?? [])];
  while (queue.length > 0) {
    const currentId = queue.shift();
    if (!currentId || descendants.has(currentId)) {
      continue;
    }

    descendants.add(currentId);
    const children = childrenByParent.get(currentId) ?? [];
    for (const childId of children) {
      queue.push(childId);
    }
  }

  return descendants;
}

export function SegmentInspector({
  segment,
  segmentIndex,
  segments,
  canRemove,
  onChange,
  onSettingsChange,
  onReparent,
  onRemove,
}: SegmentInspectorProps) {
  const isRootSegment = segment.parentId === null;
  const sectionMode = segment.fixedSectionKey === null ? "auto" : "manual";

  const parentOptions = useMemo(() => {
    const descendants = collectDescendantIds(segments, segment.id);
    const disallowedParentIds = new Set<string>([segment.id, ...descendants]);

    return segments
      .filter((candidate) => !disallowedParentIds.has(candidate.id))
      .map((candidate, index) => ({
        value: candidate.id,
        label: `${index + 1}. ${candidate.title || "Isimsiz segment"}`,
      }));
  }, [segment.id, segments]);

  const sectionKeyOptions = useMemo(() => {
    const values = new Set(DEFAULT_SECTION_KEYS);
    if (segment.fixedSectionKey) {
      values.add(segment.fixedSectionKey);
    }

    return [...values]
      .sort((left, right) => Number(left) - Number(right))
      .map((value) => ({ value, label: `${value} mm2` }));
  }, [segment.fixedSectionKey]);

  return (
    <div className={styles.root}>
      <div className={styles.header}>
        <div>
          <div className={styles.title}>Secili segment</div>
          <div className={styles.meta}>Segment #{segmentIndex + 1} uzerinde duzenleme yapiliyor.</div>
        </div>
        <Button variant="secondary" disabled={!canRemove} onClick={onRemove}>
          Seciliyi kaldir
        </Button>
      </div>

      <div className={styles.grid}>
        <label className={styles.field}>
          <span className={styles.label}>Brans adi</span>
          <input
            className={styles.textInput}
            type="text"
            value={segment.title}
            onChange={(event) => onChange({ title: event.target.value })}
            placeholder={`Segment ${segmentIndex + 1}`}
          />
        </label>

        <label className={styles.field}>
          <span className={styles.label}>Ust segment</span>
          <Select
            value={isRootSegment ? ROOT_PARENT_VALUE : segment.parentId ?? ROOT_PARENT_VALUE}
            disabled={isRootSegment}
            onChange={onReparent}
            options={
              isRootSegment
                ? [{ value: ROOT_PARENT_VALUE, label: "Kok segment (degistirilemez)" }]
                : parentOptions
            }
          />
        </label>

        <label className={styles.field}>
          <span className={styles.label}>Yuk (kW)</span>
          <NumberInput
            value={segment.loadPowerKW}
            onChange={(next) => onChange({ loadPowerKW: next })}
            placeholder="1,5"
          />
        </label>

        <label className={styles.field}>
          <span className={styles.label}>Uzunluk (m)</span>
          <NumberInput
            value={segment.lengthM}
            onChange={(next) => onChange({ lengthM: next })}
            placeholder="20"
          />
        </label>

        <label className={styles.field}>
          <span className={styles.label}>Kesit modu</span>
          <Select
            value={sectionMode}
            onChange={(next) => {
              if (next === "auto") {
                onChange({ fixedSectionKey: null });
                return;
              }

              onChange({
                fixedSectionKey: segment.fixedSectionKey ?? sectionKeyOptions[0]?.value ?? "1.5",
              });
            }}
            options={SECTION_MODE_OPTIONS}
          />
        </label>

        <label className={styles.field}>
          <span className={styles.label}>Manuel kesit anahtari</span>
          <Select
            value={segment.fixedSectionKey ?? sectionKeyOptions[0]?.value ?? "1.5"}
            disabled={segment.fixedSectionKey === null}
            onChange={(next) => onChange({ fixedSectionKey: next })}
            options={sectionKeyOptions}
          />
        </label>

        <label className={styles.field}>
          <span className={styles.label}>Iletken</span>
          <Select
            value={segment.settings.conductorMaterial}
            onChange={(next) =>
              onSettingsChange({
                conductorMaterial: next as VoltageDropGroupSettingsDraft["conductorMaterial"],
              })
            }
            options={CONDUCTOR_MATERIAL_OPTIONS}
          />
        </label>

        <label className={styles.field}>
          <span className={styles.label}>Montaj</span>
          <Select
            value={segment.settings.installationMethod}
            onChange={(next) =>
              onSettingsChange({
                installationMethod: next as VoltageDropGroupSettingsDraft["installationMethod"],
              })
            }
            options={INSTALLATION_METHOD_OPTIONS}
          />
        </label>

        <label className={styles.field}>
          <span className={styles.label}>Iletken sicakligi (C)</span>
          <NumberInput
            value={segment.settings.conductorTempC}
            onChange={(next) => onSettingsChange({ conductorTempC: next })}
            placeholder="70"
          />
        </label>

        <label className={styles.field}>
          <span className={styles.label}>Gruplanan devre</span>
          <NumberInput
            value={segment.settings.groupedCircuits}
            onChange={(next) => onSettingsChange({ groupedCircuits: next })}
            placeholder="1"
          />
        </label>

        <label className={styles.field}>
          <span className={styles.label}>cos phi</span>
          <NumberInput
            value={segment.settings.cosPhi}
            onChange={(next) => onSettingsChange({ cosPhi: next })}
            placeholder="0,85"
          />
        </label>
      </div>
    </div>
  );
}
