import { useEffect, useMemo, useState } from "react";
import { formatAmp, formatNumberTr, formatPercent } from "../../i18n/format";
import { Button } from "../../ui/Button";
import { EmptyState } from "../../ui/EmptyState";
import { ErrorBanner } from "../../ui/ErrorBanner";
import { Spinner } from "../../ui/Spinner";
import { usePersistentPageState } from "../shared/usePersistentPageState";
import { RecordDetail } from "./RecordDetail";
import { useCollapsibleGroups } from "./useCollapsibleGroups";
import { useGroupDrafts } from "./useGroupDrafts";
import { InlineCreateForm } from "./components/InlineCreateForm";
import { ManualCurrentForm } from "./components/ManualCurrentForm";
import { useProjectMutations } from "./projectMutations";
import {
  CALCULATOR_LABELS,
  getRecordDisplayTitle,
  getVoltageDropGroupSummary,
  type GroupCableSuggestionEntry,
  useProjectsData,
} from "./useProjectsData";
import styles from "./ProjectsPage.module.css";

const EMPTY_ID = "";

interface ProjectsPageState {
  readonly activeProjectId: string;
  readonly activeGroupId: string;
  readonly activeRecordId: string;
  readonly projectDraft: string | null;
  readonly groupDraft: string | null;
  readonly duplicateDrafts: Record<string, string>;
}

function createDefaultProjectsPageState(): ProjectsPageState {
  return {
    activeProjectId: EMPTY_ID,
    activeGroupId: EMPTY_ID,
    activeRecordId: EMPTY_ID,
    projectDraft: null,
    groupDraft: null,
    duplicateDrafts: {},
  };
}

export function ProjectsPage() {
  const { projects, isLoading, isError, error } = useProjectsData();
  const mutations = useProjectMutations();
  const { isExpanded, toggle } = useCollapsibleGroups(
    "elektroplan.projects.expandedGroups",
  );

  const [pageState, setPageState] = usePersistentPageState<ProjectsPageState>({
    key: "elektroplan.page.projects",
    version: 1,
    defaultValue: () => createDefaultProjectsPageState(),
  });
  const [activeProjectId, setActiveProjectId] = useState<string>(pageState.activeProjectId);
  const [activeGroupId, setActiveGroupId] = useState<string>(pageState.activeGroupId);
  const [activeRecordId, setActiveRecordId] = useState<string>(pageState.activeRecordId);

  const { drafts, actions } = useGroupDrafts(mutations, {
    projectDraft: pageState.projectDraft,
    groupDraft: pageState.groupDraft,
    duplicateDrafts: pageState.duplicateDrafts,
  });
  const { projectDraft, groupDraft, duplicateDrafts, manualDrafts, actionError } = drafts;

  const activeProject =
    projects.find((project) => project.project.id === activeProjectId) ?? projects[0] ?? null;

  const activeGroup =
    activeProject?.groups.find((group) => group.group.id === activeGroupId) ??
    activeProject?.groups[0] ??
    null;

  const activeRecord =
    activeGroup?.records.find((item) => item.record.id === activeRecordId) ??
    activeGroup?.records[0] ??
    null;

  const projectCards = useMemo(
    () =>
      projects.map((project) => ({
        id: project.project.id,
        title: project.project.title,
        groupCount: project.groupCount,
        recordCount: project.recordCount,
        totalCurrentA: project.totalCurrentA,
      })),
    [projects],
  );

  useEffect(() => {
    setPageState({
      activeProjectId,
      activeGroupId,
      activeRecordId,
      projectDraft,
      groupDraft,
      duplicateDrafts,
    });
  }, [
    activeGroupId,
    activeProjectId,
    activeRecordId,
    duplicateDrafts,
    groupDraft,
    projectDraft,
    setPageState,
  ]);

  useEffect(() => {
    if (isLoading) {
      return;
    }

    const resolvedProjectId = activeProject?.project.id ?? EMPTY_ID;
    if (resolvedProjectId !== activeProjectId) {
      setActiveProjectId(resolvedProjectId);
    }
  }, [activeProject?.project.id, activeProjectId, isLoading]);

  useEffect(() => {
    if (isLoading) {
      return;
    }

    const resolvedGroupId = activeGroup?.group.id ?? EMPTY_ID;
    if (resolvedGroupId !== activeGroupId) {
      setActiveGroupId(resolvedGroupId);
    }
  }, [activeGroup?.group.id, activeGroupId, isLoading]);

  useEffect(() => {
    if (isLoading) {
      return;
    }

    const resolvedRecordId = activeRecord?.record.id ?? EMPTY_ID;
    if (resolvedRecordId !== activeRecordId) {
      setActiveRecordId(resolvedRecordId);
    }
  }, [activeRecord?.record.id, activeRecordId, isLoading]);

  async function handleDeleteProject(projectId: string, title: string) {
    if (!confirm(`"${title}" projesi ve alt grupları silinsin mi?`)) {
      return;
    }

    actions.runAction(async () => {
      await mutations.deleteProject(projectId);
      if (activeProjectId === projectId) {
        setActiveProjectId(EMPTY_ID);
        setActiveGroupId(EMPTY_ID);
        setActiveRecordId(EMPTY_ID);
      }
    }, "Proje silinemedi.");
  }

  async function handleDeleteGroup(groupId: string, title: string) {
    if (!confirm(`"${title}" grubu ve kayıtları silinsin mi?`)) {
      return;
    }

    actions.runAction(async () => {
      await mutations.deleteGroup(groupId);
      if (activeGroupId === groupId) {
        setActiveGroupId(EMPTY_ID);
        setActiveRecordId(EMPTY_ID);
      }
    }, "Grup silinemedi.");
  }

  async function handleDeleteRecord(recordId: string) {
    if (!confirm("Bu kayıt silinsin mi?")) {
      return;
    }

    actions.runAction(async () => {
      await mutations.deleteRecord(recordId);
      if (activeRecordId === recordId) {
        setActiveRecordId(EMPTY_ID);
      }
    }, "Kayıt silinemedi.");
  }

  async function handleQuantityChange(recordId: string, quantity: number) {
    const record = activeGroup?.records.find((item) => item.record.id === recordId)?.record;
    if (!record) {
      return;
    }

    actions.runAction(async () => {
      await mutations.updateRecordQuantity({ record, quantity });
    }, "Adet güncellenemedi.");
  }

  if (isLoading) {
    return (
      <div className={styles.center}>
        <Spinner />
      </div>
    );
  }

  if (isError) {
    return <ErrorBanner message={error ?? "Projeler yüklenemedi."} />;
  }

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.heading}>Projeler</h1>
          <p className={styles.subheading}>Proje, grup ve kayıt akışını tek ekrandan yönetin.</p>
        </div>

        <Button
          variant="primary"
          onClick={() => {
            actions.setProjectDraft(projectDraft === null ? "" : null);
            actions.clearActionError();
          }}
        >
          Yeni proje
        </Button>
      </div>

      {actionError ? <ErrorBanner message={actionError} /> : null}

      <div className={styles.layout}>
        <aside className={styles.projectsPanel}>
          <div className={styles.panelHeader}>
            <span className={styles.panelTitle}>Projeler</span>
            <span className={styles.panelMeta}>{projectCards.length} adet</span>
          </div>

          {projectDraft !== null ? (
            <InlineCreateForm
              value={projectDraft}
              onChange={actions.setProjectDraft}
              onSubmit={() =>
                actions.submitCreateProject((projectId) => {
                  setActiveProjectId(projectId);
                  actions.setGroupDraft("");
                })
              }
              onCancel={() => actions.setProjectDraft(null)}
              placeholder="Örn. AVM panolar"
              disabled={mutations.isCreatingProject}
              classNames={{ form: styles.inlineForm, input: styles.input, actions: styles.formActions }}
              renderSubmit={({ onClick, disabled }) => (
                <Button variant="primary" loading={mutations.isCreatingProject} disabled={disabled} onClick={onClick}>
                  Kaydet
                </Button>
              )}
              renderCancel={({ onClick }) => (
                <Button variant="secondary" onClick={onClick}>
                  Vazgeç
                </Button>
              )}
            />
          ) : null}

          {projectCards.length === 0 ? (
            <EmptyState message="Henüz proje yok." hint="İlk projeyi oluşturup gruplamayı başlatın." />
          ) : (
            <div className={styles.projectList}>
              {projectCards.map((project) => {
                const isActive = project.id === activeProject?.project.id;

                return (
                  <button
                    key={project.id}
                    type="button"
                    className={`${styles.projectCard} ${isActive ? styles.projectCardActive : ""}`}
                    onClick={() => {
                      setActiveProjectId(project.id);
                      actions.setGroupDraft(null);
                    }}
                  >
                    <div className={styles.projectCardTop}>
                      <span className={styles.projectCardTitle}>{project.title}</span>
                      <span className={styles.projectPill}>{project.groupCount} grup</span>
                    </div>
                    <div className={styles.projectCardMeta}>
                      <span>{project.recordCount} kayıt</span>
                      <span>{formatAmp(project.totalCurrentA, 2)}</span>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </aside>

        <section className={styles.groupsPanel}>
          {activeProject ? (
            <>
              <div className={styles.panelHeader}>
                <div>
                  <span className={styles.panelTitle}>{activeProject.project.title}</span>
                  <div className={styles.panelMeta}>
                    {activeProject.groupCount} grup • {activeProject.recordCount} kayıt • {formatAmp(activeProject.totalCurrentA, 2)}
                  </div>
                </div>

                <div className={styles.projectActions}>
                  <Button
                    variant="secondary"
                    onClick={() => {
                      actions.setGroupDraft(groupDraft === null ? "" : null);
                      actions.clearActionError();
                    }}
                  >
                    Yeni grup
                  </Button>
                  <Button
                    variant="danger"
                    loading={mutations.isDeletingProject}
                    onClick={() => void handleDeleteProject(activeProject.project.id, activeProject.project.title)}
                  >
                    Projeyi sil
                  </Button>
                </div>
              </div>

              {groupDraft !== null ? (
                <InlineCreateForm
                  value={groupDraft}
                  onChange={actions.setGroupDraft}
                  onSubmit={() => actions.submitCreateGroup(activeProject, (groupId) => setActiveGroupId(groupId))}
                  onCancel={() => actions.setGroupDraft(null)}
                  placeholder="Örn. Kat 1"
                  disabled={mutations.isCreatingGroup}
                  classNames={{ form: styles.inlineForm, input: styles.input, actions: styles.formActions }}
                  renderSubmit={({ onClick, disabled }) => (
                    <Button variant="primary" loading={mutations.isCreatingGroup} disabled={disabled} onClick={onClick}>
                      Oluştur
                    </Button>
                  )}
                  renderCancel={({ onClick }) => (
                    <Button variant="secondary" onClick={onClick}>
                      Vazgeç
                    </Button>
                  )}
                />
              ) : null}

              {activeProject.groups.length === 0 ? (
                <EmptyState message="Bu projede grup yok." hint="Önce grup oluşturup hesapları oraya kaydedin." />
              ) : (
                <div className={styles.groupList}>
                  {activeProject.groups.map((groupView) => {
                    const isActive = groupView.group.id === activeGroup?.group.id;

                    return (
                      <article
                        key={groupView.group.id}
                        className={`${styles.groupCard} ${isActive ? styles.groupCardActive : ""}`}
                      >
                        <div className={styles.groupHeader}>
                          <button
                            type="button"
                            className={styles.groupSummary}
                            aria-expanded={isExpanded(groupView.group.id)}
                            onClick={() => {
                              setActiveGroupId(groupView.group.id);
                              toggle(groupView.group.id);
                            }}
                          >
                            <div className={styles.groupTitleRow}>
                              <span
                                className={styles.chevron}
                                data-expanded={isExpanded(groupView.group.id) ? "true" : "false"}
                                aria-hidden="true"
                              >
                                ›
                              </span>
                              <span className={styles.groupTitle}>{groupView.group.title}</span>
                              <span className={styles.groupBadge}>{groupView.recordCount} kayıt</span>
                            </div>
                            <div className={styles.groupMeta}>
                              <span>Toplam akım: {formatAmp(groupView.totalCurrentA, 2)}</span>
                              <span>
                                {groupView.cableSuggestionLoading
                                  ? "Kablo önerisi hesaplanıyor"
                                  : formatCableSummary(groupView.cableSuggestion?.hava_30C)}
                              </span>
                            </div>
                          </button>

                          <div className={styles.groupActions}>
                            <Button
                              variant="secondary"
                              loading={mutations.isDuplicatingGroup}
                              onClick={() =>
                                actions.submitDuplicateGroup(
                                  groupView,
                                  (newGroupId) => setActiveGroupId(newGroupId),
                                  `${groupView.group.title} kopya`,
                                )
                              }
                            >
                              Kopyala
                            </Button>
                            <Button
                              variant="danger"
                              loading={mutations.isDeletingGroup}
                              onClick={() => void handleDeleteGroup(groupView.group.id, groupView.group.title)}
                            >
                              Sil
                            </Button>
                          </div>
                        </div>

                        {isExpanded(groupView.group.id) ? (
                        <>
                        <div className={styles.duplicateRow}>
                          <input
                            className={styles.input}
                            type="text"
                            value={duplicateDrafts[groupView.group.id] ?? ""}
                            onChange={(event) =>
                              actions.setDuplicateDraft(groupView.group.id, event.target.value)
                            }
                            placeholder={`${groupView.group.title} kopya`}
                          />
                        </div>

                        <div className={styles.duplicateRow}>
                          <Button
                            variant="secondary"
                            onClick={() => {
                              if (groupView.group.id in manualDrafts) {
                                actions.closeManualDraft(groupView.group.id);
                              } else {
                                actions.openManualDraft(groupView.group.id, { quantity: "1" });
                              }
                              actions.clearActionError();
                            }}
                          >
                            + Manuel akım
                          </Button>
                        </div>

                        {groupView.group.id in manualDrafts ? (
                          <ManualCurrentForm
                            value={manualDrafts[groupView.group.id]!}
                            onChange={(patch) => actions.updateManualDraft(groupView.group.id, patch)}
                            onSubmit={() => actions.submitManualCurrent(groupView)}
                            onCancel={() => actions.closeManualDraft(groupView.group.id)}
                            disabled={mutations.isCreatingManualCurrent}
                            classNames={{ form: styles.inlineForm, input: styles.input, actions: styles.formActions }}
                            renderSubmit={({ onClick, disabled }) => (
                              <Button
                                variant="primary"
                                loading={mutations.isCreatingManualCurrent}
                                disabled={disabled}
                                onClick={onClick}
                              >
                                Ekle
                              </Button>
                            )}
                            renderCancel={({ onClick }) => (
                              <Button variant="secondary" onClick={onClick}>
                                Vazgeç
                              </Button>
                            )}
                          />
                        ) : null}

                        <div className={styles.cableGrid}>
                          <CableSuggestionCard
                            title="Toprak 20°C"
                            suggestion={groupView.cableSuggestion?.toprak_20C ?? null}
                            loading={groupView.cableSuggestionLoading}
                          />
                          <CableSuggestionCard
                            title="Hava 30°C"
                            suggestion={groupView.cableSuggestion?.hava_30C ?? null}
                            loading={groupView.cableSuggestionLoading}
                          />
                        </div>

                        {groupView.cableSuggestionError ? (
                          <div className={styles.cableError}>{groupView.cableSuggestionError}</div>
                        ) : null}

                        {groupView.records.length === 0 ? (
                          <div className={styles.emptyGroup}>Bu grupta kayıt yok.</div>
                        ) : (
                          <div className={styles.recordList}>
                            {groupView.records.map((item) => {
                              const isSelected = item.record.id === activeRecord?.record.id;

                              return (
                                <button
                                  key={item.record.id}
                                  type="button"
                                  className={`${styles.recordCard} ${isSelected ? styles.recordCardActive : ""}`}
                                  onClick={() => {
                                    setActiveGroupId(groupView.group.id);
                                    setActiveRecordId(item.record.id);
                                  }}
                                >
                                  <div className={styles.recordTop}>
                                    <span className={styles.recordBadge}>{CALCULATOR_LABELS[item.record.calculator]}</span>
                                    <span className={styles.recordQuantity}>Adet {item.quantity}</span>
                                  </div>
                                  <div className={styles.recordTitle}>{getRecordDisplayTitle(item.record)}</div>
                                  <div className={styles.recordMeta}>
                                    {(() => {
                                      const voltageDropGroupSummary = getVoltageDropGroupSummary(item.record);

                                      if (voltageDropGroupSummary) {
                                        return (
                                          <>
                                            <span>{voltageDropGroupSummary.segmentCount} segment</span>
                                            <span>
                                              Toplam {formatNumberTr(voltageDropGroupSummary.totalLocalPowerKW, 2)} kW
                                            </span>
                                            <span>
                                              Maks {formatPercent(voltageDropGroupSummary.maxCumulativeDeltaVPercent, 2)}
                                            </span>
                                            <span>
                                              {voltageDropGroupSummary.isCompliant ? "Uygun" : "Limit aşımı"}
                                            </span>
                                          </>
                                        );
                                      }

                                      return (
                                        <>
                                          <span>Birim {formatAmp(item.unitCurrentA, 2)}</span>
                                          <span>Toplam {formatAmp(item.totalCurrentA, 2)}</span>
                                        </>
                                      );
                                    })()}
                                  </div>
                                </button>
                              );
                            })}
                          </div>
                        )}
                        </>
                        ) : null}
                      </article>
                    );
                  })}
                </div>
              )}
            </>
          ) : (
            <EmptyState message="Proje seçin." hint="Soldan bir proje seçin veya yeni proje oluşturun." />
          )}
        </section>

        <aside className={styles.detailPanel}>
          {activeRecord ? (
            <RecordDetail
              record={activeRecord.record}
              quantity={activeRecord.quantity}
              onQuantityChange={(quantity) => void handleQuantityChange(activeRecord.record.id, quantity)}
              onDelete={() => void handleDeleteRecord(activeRecord.record.id)}
            />
          ) : (
            <EmptyState message="Kayıt seçin." hint="Sağ panelde detay görmek için bir hesap seçin." />
          )}
        </aside>
      </div>
    </div>
  );
}

function CableSuggestionCard({
  title,
  suggestion,
  loading,
}: {
  title: string;
  suggestion: GroupCableSuggestionEntry | null;
  loading: boolean;
}) {
  return (
    <div className={styles.cableCard}>
      <div className={styles.cableTitle}>{title}</div>
      <div className={styles.cableValue}>
        {loading ? "Hesaplanıyor..." : suggestion ? `${suggestion.label} mm²` : "Öneri yok"}
      </div>
      <div className={styles.cableMeta}>
        {loading || !suggestion ? "—" : `${formatAmp(suggestion.ampacityA, 0)} taşıma`}
      </div>
      {suggestion?.standardHintMm2 !== undefined ? (
        <div className={styles.cableHint}>
          Standart: {formatNumberTr(suggestion.standardHintMm2, 1)} mm²
        </div>
      ) : null}
    </div>
  );
}

function formatCableSummary(suggestion: GroupCableSuggestionEntry | null | undefined) {
  if (!suggestion) {
    return "Kablo önerisi yok";
  }

  return `${suggestion.label} mm² / ${formatAmp(suggestion.ampacityA, 0)}`;
}
