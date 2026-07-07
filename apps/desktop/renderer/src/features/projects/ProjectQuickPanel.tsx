import { useEffect, useMemo, useState } from "react";

import { formatAmp, formatNumberTr } from "../../i18n/format";
import { useProjectMutations } from "./projectMutations";
import {
  CALCULATOR_LABELS,
  getRecordDisplayTitle,
  getRecordMotorPowerKW,
  type ProjectGroupView,
  useProjectsData,
} from "./useProjectsData";
import { useRecordAssignments } from "./useRecordAssignments";
import { useCollapsibleGroups } from "./useCollapsibleGroups";
import { useGroupDrafts } from "./useGroupDrafts";
import { InlineCreateForm } from "./components/InlineCreateForm";
import { ManualCurrentForm } from "./components/ManualCurrentForm";
import { AssignMaterialPopover } from "./AssignMaterialPopover";
import { getBridge } from "../../bridge/client";
import { useQueryClient } from "@tanstack/react-query";
import styles from "./ProjectQuickPanel.module.css";

interface ProjectQuickPanelProps {
  readonly collapsed: boolean;
  readonly onToggle: () => void;
}

export function ProjectQuickPanel({
  collapsed,
  onToggle,
}: ProjectQuickPanelProps) {
  const { error, isError, isLoading, projects } = useProjectsData({
    enableCableSuggestions: !collapsed,
  });
  const mutations = useProjectMutations();
  const qc = useQueryClient();
  const { isExpanded, toggle } = useCollapsibleGroups(
    "elektroplan.quickPanel.expandedGroups",
  );
  const { drafts, actions, actionError } = useGroupDrafts(mutations);
  const { projectDraft, groupDraft, duplicateDrafts, manualDrafts } = drafts;

  const [activeProjectId, setActiveProjectId] = useState<string | null>(null);
  const [quantityDrafts, setQuantityDrafts] = useState<Record<string, string>>({});
  const [assignPopover, setAssignPopover] = useState<{
    recordId: string;
    anchorRect: DOMRect;
  } | null>(null);

  const activeProject =
    projects.find((project) => project.project.id === activeProjectId) ?? projects[0] ?? null;

  const allRecordIds = useMemo(() => {
    if (!activeProject) return [];
    return activeProject.groups.flatMap((g) => g.records.map((r) => r.record.id));
  }, [activeProject]);

  const assignmentsQuery = useRecordAssignments(allRecordIds);
  const assignmentsByRecord = useMemo(() => {
    const map: Record<string, NonNullable<typeof assignmentsQuery.data>[number][]> = {};
    for (const asg of assignmentsQuery.data ?? []) {
      if (!map[asg.recordId]) map[asg.recordId] = [];
      map[asg.recordId]!.push(asg);
    }
    return map;
  }, [assignmentsQuery.data]);

  useEffect(() => {
    if (projects.length === 0) {
      setActiveProjectId(null);
      return;
    }

    if (!activeProjectId || !projects.some((project) => project.project.id === activeProjectId)) {
      const firstProject = projects[0];
      if (firstProject) {
        setActiveProjectId(firstProject.project.id);
      }
    }
  }, [activeProjectId, projects]);

  function commitQuantity(group: ProjectGroupView, recordId: string) {
    const recordView = group.records.find((record) => record.record.id === recordId);
    if (!recordView) {
      return;
    }

    const parsedQuantity = parseQuantityValue(
      quantityDrafts[recordId],
      Math.max(1, recordView.quantity),
    );

    setQuantityDrafts((current) => {
      if (!(recordId in current)) {
        return current;
      }
      const next = { ...current };
      delete next[recordId];
      return next;
    });

    if (parsedQuantity === recordView.quantity) {
      return;
    }

    actions.runAction(async () => {
      await mutations.updateRecordQuantity({
        record: recordView.record,
        quantity: parsedQuantity,
      });
    }, "Adet güncellenemedi.");
  }

  return (
    <aside
      className={styles.panel}
      data-collapsed={collapsed ? "true" : "false"}
      aria-label="Hizli proje paneli"
    >
      <div className={styles.rail}>
        <button
          type="button"
          className={styles.toggle}
          onClick={onToggle}
          aria-label={collapsed ? "Paneli ac" : "Paneli kapat"}
          title={collapsed ? "Paneli ac" : "Paneli kapat"}
        >
          {collapsed ? "<" : ">"}
        </button>
        <div className={styles.railSummary}>
          <span className={styles.railCount}>{projects.length}</span>
          <span className={styles.railLabel}>PRJ</span>
        </div>
      </div>

      <div className={styles.content}>
        <div className={styles.header}>
          <div>
            <div className={styles.kicker}>Hizli panel</div>
            <h2 className={styles.title}>Projeler</h2>
          </div>
          <button
            type="button"
            className={styles.actionBtn}
            onClick={() => actions.setProjectDraft(projectDraft === null ? "" : null)}
            disabled={mutations.isPending}
          >
            {projectDraft === null ? "Yeni proje" : "Iptal"}
          </button>
        </div>

        {projectDraft !== null ? (
          <InlineCreateForm
            value={projectDraft}
            onChange={actions.setProjectDraft}
            onSubmit={() => actions.submitCreateProject(setActiveProjectId)}
            onCancel={() => actions.setProjectDraft(null)}
            placeholder="Proje adi"
            disabled={mutations.isPending}
            classNames={{ form: styles.inlineForm, input: styles.inlineInput }}
            renderSubmit={({ onClick, disabled }) => (
              <button type="button" className={styles.primaryBtn} onClick={onClick} disabled={disabled}>
                Olustur
              </button>
            )}
          />
        ) : null}

        {isLoading ? (
          <p className={styles.note}>Yukleniyor...</p>
        ) : isError ? (
          <p className={styles.error}>{error ?? "Projeler yuklenemedi."}</p>
        ) : projects.length === 0 ? (
          <div className={styles.emptyState}>
            <p className={styles.note}>Proje yok.</p>
            <button
              type="button"
              className={styles.primaryBtn}
              onClick={() => actions.setProjectDraft(projectDraft === null ? "" : null)}
              disabled={mutations.isPending}
            >
              Proje ekle
            </button>
          </div>
        ) : (
          <>
            <label className={styles.field}>
              <span className={styles.label}>Proje</span>
              <select
                className={styles.select}
                value={activeProject?.project.id ?? ""}
                onChange={(event) => setActiveProjectId(event.target.value || null)}
                disabled={mutations.isPending}
              >
                {projects.map((project) => (
                  <option key={project.project.id} value={project.project.id}>
                    {project.project.title}
                  </option>
                ))}
              </select>
            </label>

            <div className={styles.subHeader}>
              <span className={styles.sectionTitle}>Gruplar</span>
              <button
                type="button"
                className={styles.actionBtn}
                onClick={() => actions.setGroupDraft(groupDraft === null ? "" : null)}
                disabled={!activeProject || mutations.isPending}
              >
                {groupDraft === null ? "Yeni grup" : "Iptal"}
              </button>
            </div>

            {groupDraft !== null ? (
              <InlineCreateForm
                value={groupDraft}
                onChange={actions.setGroupDraft}
                onSubmit={() => actions.submitCreateGroup(activeProject)}
                onCancel={() => actions.setGroupDraft(null)}
                placeholder="Grup adi"
                disabled={mutations.isPending}
                classNames={{ form: styles.inlineForm, input: styles.inlineInput }}
                renderSubmit={({ onClick, disabled }) => (
                  <button type="button" className={styles.primaryBtn} onClick={onClick} disabled={disabled}>
                    Olustur
                  </button>
                )}
              />
            ) : null}

            {actionError ? <p className={styles.error}>{actionError}</p> : null}

            <div className={styles.groupList}>
              {(activeProject?.groups ?? []).length === 0 ? (
                <p className={styles.note}>Bu projede grup yok.</p>
              ) : (
                activeProject?.groups.map((group) => (
                  <section key={group.group.id} className={styles.groupCard}>
                    <div className={styles.groupHeader}>
                      <button
                        type="button"
                        className={styles.groupHeading}
                        onClick={() => toggle(group.group.id)}
                        aria-expanded={isExpanded(group.group.id)}
                      >
                        <span
                          className={styles.chevron}
                          data-expanded={isExpanded(group.group.id) ? "true" : "false"}
                          aria-hidden="true"
                        >
                          ›
                        </span>
                        <span className={styles.groupHeadingText}>
                          <h3 className={styles.groupTitle}>{group.group.title}</h3>
                          <span className={styles.groupMeta}>
                            <span>{group.records.length} kayit</span>
                            <strong>{formatAmp(group.totalCurrentA, 2)} toplam</strong>
                          </span>
                        </span>
                      </button>
                      <div className={styles.groupActions}>
                      <button
                        type="button"
                        className={styles.linkBtn}
                        onClick={() =>
                          group.group.id in duplicateDrafts
                            ? actions.closeDuplicateDraft(group.group.id)
                            : actions.openDuplicateDraft(group)
                        }
                        disabled={mutations.isPending}
                      >
                        {group.group.id in duplicateDrafts ? "Iptal" : "Kopyala"}
                      </button>
                      <button
                        type="button"
                        className={styles.linkBtn}
                        onClick={() =>
                          group.group.id in manualDrafts
                            ? actions.closeManualDraft(group.group.id)
                            : actions.openManualDraft(group.group.id)
                        }
                        disabled={mutations.isPending}
                      >
                        {group.group.id in manualDrafts ? "Iptal" : "+ Manuel akim"}
                      </button>
                      </div>
                    </div>

                    {isExpanded(group.group.id) ? (
                    <>
                    {group.group.id in duplicateDrafts ? (
                      <InlineCreateForm
                        value={duplicateDrafts[group.group.id] ?? ""}
                        onChange={(value) => actions.setDuplicateDraft(group.group.id, value)}
                        onSubmit={() => actions.submitDuplicateGroup(group)}
                        onCancel={() => actions.closeDuplicateDraft(group.group.id)}
                        placeholder="Kopya adi"
                        disabled={mutations.isPending}
                        classNames={{ form: styles.inlineForm, input: styles.inlineInput }}
                        renderSubmit={({ onClick, disabled }) => (
                          <button
                            type="button"
                            className={styles.primaryBtn}
                            onClick={onClick}
                            disabled={disabled}
                          >
                            Kopyala
                          </button>
                        )}
                      />
                    ) : null}

                    {group.group.id in manualDrafts ? (
                      <ManualCurrentForm
                        value={manualDrafts[group.group.id]!}
                        onChange={(patch) => actions.updateManualDraft(group.group.id, patch)}
                        onSubmit={() => actions.submitManualCurrent(group)}
                        onCancel={() => actions.closeManualDraft(group.group.id)}
                        disabled={mutations.isPending}
                        classNames={{ form: styles.inlineForm, input: styles.inlineInput }}
                        currentAField={{ type: "number", min: 0, step: "any", inputMode: "decimal" }}
                        quantityField={{ type: "number", min: 1, step: 1, inputMode: "numeric" }}
                        renderSubmit={({ onClick, disabled }) => (
                          <button
                            type="button"
                            className={styles.primaryBtn}
                            onClick={onClick}
                            disabled={disabled}
                          >
                            Ekle
                          </button>
                        )}
                      />
                    ) : null}

                    <div className={styles.cableBlock}>
                      <div className={styles.cableRow}>
                        <span className={styles.cableAmbient}>Toprak</span>
                        <span>{formatCableSuggestion(group.cableSuggestion?.toprak_20C ?? null)}</span>
                      </div>
                      <div className={styles.cableRow}>
                        <span className={styles.cableAmbient}>Hava</span>
                        <span>{formatCableSuggestion(group.cableSuggestion?.hava_30C ?? null)}</span>
                      </div>
                    </div>

                    <div className={styles.recordList}>
                      {group.records.length === 0 ? (
                        <p className={styles.note}>Kayit yok.</p>
                      ) : (
                        group.records.map((recordView) => {
                          const draftValue =
                            quantityDrafts[recordView.record.id] ?? String(recordView.quantity);
                          const motorPowerKW = getRecordMotorPowerKW(recordView.record);

                          return (
                            <article key={recordView.record.id} className={styles.recordCard}>
                              <div className={styles.recordTop}>
                                <span className={styles.badge}>
                                  {CALCULATOR_LABELS[recordView.record.calculator]}
                                </span>
                                <span className={styles.recordTotal}>
                                  {formatAmp(recordView.totalCurrentA, 2)}
                                </span>
                                {recordView.record.calculator === "manual-current" ? (
                                  <button
                                    type="button"
                                    className={styles.assignRemove}
                                    onClick={() =>
                                      actions.runAction(async () => {
                                        await mutations.deleteRecord(recordView.record.id);
                                      }, "Kayıt silinemedi.")
                                    }
                                    disabled={mutations.isPending}
                                    aria-label="Sil"
                                  >
                                    ×
                                  </button>
                                ) : null}
                              </div>
                              <div className={styles.recordTitle}>
                                {getRecordDisplayTitle(recordView.record)}
                              </div>
                              <div className={styles.recordMeta}>
                                <span>
                                  Birim {formatAmp(recordView.unitCurrentA, 2)}
                                  {motorPowerKW === null
                                    ? ""
                                    : ` / ${formatNumberTr(motorPowerKW, 2)} kW`}
                                </span>
                                <label className={styles.quantityField}>
                                  <span>Adet</span>
                                  <input
                                    className={styles.quantityInput}
                                    type="number"
                                    min={1}
                                    step={1}
                                    inputMode="numeric"
                                    value={draftValue}
                                    onChange={(event) =>
                                      setQuantityDrafts((current) => ({
                                        ...current,
                                        [recordView.record.id]: event.target.value,
                                      }))
                                    }
                                    onBlur={() => commitQuantity(group, recordView.record.id)}
                                    onKeyDown={(event) => {
                                      if (event.key === "Enter") {
                                        event.currentTarget.blur();
                                      }

                                      if (event.key === "Escape") {
                                        setQuantityDrafts((current) => {
                                          if (!(recordView.record.id in current)) {
                                            return current;
                                          }
                                          const next = { ...current };
                                          delete next[recordView.record.id];
                                          return next;
                                        });
                                      }
                                    }}
                                    disabled={mutations.isPending}
                                  />
                                </label>
                              </div>
                              <div className={styles.assignBlock}>
                                <div className={styles.assignHeader}>
                                  <span>
                                    Malzemeler (
                                    {(assignmentsByRecord[recordView.record.id] ?? []).length})
                                  </span>
                                  <button
                                    type="button"
                                    className={styles.linkBtn}
                                    onClick={(e) => {
                                      const rect = e.currentTarget.getBoundingClientRect();
                                      setAssignPopover({
                                        recordId: recordView.record.id,
                                        anchorRect: rect,
                                      });
                                    }}
                                  >
                                    + Malzeme
                                  </button>
                                </div>
                                {(assignmentsByRecord[recordView.record.id] ?? []).length >
                                  0 && (
                                  <ul className={styles.assignList}>
                                    {(assignmentsByRecord[recordView.record.id] ?? []).map(
                                      (asg) => (
                                        <li key={asg.id} className={styles.assignRow}>
                                          <span className={styles.assignName}>
                                            {asg.snapshotName}
                                          </span>
                                          <span className={styles.assignQty}>
                                            {asg.quantity}
                                            {asg.unit ? ` ${asg.unit}` : "×"}
                                          </span>
                                          <button
                                            type="button"
                                            className={styles.assignRemove}
                                            onClick={async () => {
                                              await getBridge().assignments.delete(asg.id);
                                              await qc.invalidateQueries({
                                                queryKey: ["assignments"],
                                              });
                                            }}
                                            aria-label="Sil"
                                          >
                                            ×
                                          </button>
                                        </li>
                                      ),
                                    )}
                                  </ul>
                                )}
                              </div>
                            </article>
                          );
                        })
                      )}
                    </div>
                    </>
                    ) : null}
                  </section>
                ))
              )}
            </div>
          </>
        )}
      </div>
      {assignPopover && (
        <AssignMaterialPopover
          recordId={assignPopover.recordId}
          anchorRect={assignPopover.anchorRect}
          onClose={() => {
            setAssignPopover(null);
            void qc.invalidateQueries({ queryKey: ["assignments"] });
          }}
        />
      )}
    </aside>
  );
}

function parseQuantityValue(value: string | undefined, fallback: number): number {
  if (value === undefined || value.trim() === "") {
    return fallback;
  }
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }
  return Math.max(1, Math.trunc(parsed));
}

function formatCableSuggestion(
  suggestion: { label: string; ampacityA: number; standardHintMm2?: 2.5 | 4 } | null,
) {
  if (!suggestion) {
    return "-";
  }

  const standardHint =
    suggestion.standardHintMm2 !== undefined
      ? ` | std ${formatNumberTr(suggestion.standardHintMm2, 1)} mm2`
      : "";

  return `${suggestion.label} mm2 (${formatAmp(suggestion.ampacityA, 0)})${standardHint}`;
}
