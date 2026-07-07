import { useState } from "react";
import { useProjectMutations } from "./projectMutations";
import type { ProjectGroupView, ProjectView } from "./useProjectsData";

export interface ManualCurrentDraft {
  readonly label: string;
  readonly currentA: string;
  readonly quantity: string;
}

function createEmptyManualCurrentDraft(): ManualCurrentDraft {
  return { label: "", currentA: "", quantity: "" };
}

export interface GroupDraftsState {
  /** Project-name draft; `null` means the create-project form is closed. */
  readonly projectDraft: string | null;
  /** Group-name draft; `null` means the create-group form is closed. */
  readonly groupDraft: string | null;
  /** Per-group duplicate-title drafts; presence of a key means the form is open. */
  readonly duplicateDrafts: Readonly<Record<string, string>>;
  /** Per-group manual-current drafts; presence of a key means the form is open. */
  readonly manualDrafts: Readonly<Record<string, ManualCurrentDraft>>;
  /** Latest action error, if any. */
  readonly actionError: string | null;
}

export interface GroupDraftsActions {
  setProjectDraft(value: string | null): void;
  setGroupDraft(value: string | null): void;
  openDuplicateDraft(group: ProjectGroupView, defaultTitle?: string): void;
  closeDuplicateDraft(groupId: string): void;
  setDuplicateDraft(groupId: string, value: string): void;
  openManualDraft(groupId: string, defaults?: Partial<ManualCurrentDraft>): void;
  closeManualDraft(groupId: string): void;
  updateManualDraft(groupId: string, patch: Partial<ManualCurrentDraft>): void;
  submitCreateProject(onCreated?: (projectId: string) => void): void;
  submitCreateGroup(activeProject: ProjectView | null, onCreated?: (groupId: string) => void): void;
  /**
   * `fallbackTitle` is used when the draft is empty (ProjectsPage submits
   * immediately from the header button without requiring typed input).
   */
  submitDuplicateGroup(
    group: ProjectGroupView,
    onDuplicated?: (newGroupId: string) => void,
    fallbackTitle?: string,
  ): void;
  submitManualCurrent(group: ProjectGroupView, onSubmitted?: () => void): void;
  /** Generic error-wrapped action runner for callers with bespoke mutations (e.g. delete, quantity edit). */
  runAction(action: () => Promise<unknown>, fallbackMessage?: string): void;
  clearActionError(): void;
}

export interface UseGroupDraftsResult {
  readonly drafts: GroupDraftsState;
  readonly actions: GroupDraftsActions;
  readonly actionError: string | null;
}

export interface UseGroupDraftsInitial {
  readonly projectDraft?: string | null;
  readonly groupDraft?: string | null;
  readonly duplicateDrafts?: Readonly<Record<string, string>>;
}

/**
 * Shared draft-state + submit logic for the project/group creation and
 * manual-current workflow used by both `ProjectsPage` and `ProjectQuickPanel`.
 *
 * Validation rules mirror the original `ProjectQuickPanel.submitManualCurrent`:
 * `currentA` must be finite and > 0; `quantity` is optional and, when present
 * and valid, truncated to an integer.
 *
 * `initial` seeds the project/group/duplicate drafts on first render only
 * (e.g. from a caller's own persisted page state); it is not re-applied on
 * subsequent renders.
 */
export function useGroupDrafts(
  mutations: ReturnType<typeof useProjectMutations>,
  initial?: UseGroupDraftsInitial,
): UseGroupDraftsResult {
  const [projectDraft, setProjectDraft] = useState<string | null>(initial?.projectDraft ?? null);
  const [groupDraft, setGroupDraft] = useState<string | null>(initial?.groupDraft ?? null);
  const [duplicateDrafts, setDuplicateDrafts] = useState<Record<string, string>>(
    initial?.duplicateDrafts ? { ...initial.duplicateDrafts } : {},
  );
  const [manualDrafts, setManualDrafts] = useState<Record<string, ManualCurrentDraft>>({});
  const [actionError, setActionError] = useState<string | null>(null);

  async function runAction(action: () => Promise<unknown>, fallbackMessage: string) {
    try {
      setActionError(null);
      await action();
    } catch (actionFailure) {
      setActionError(actionFailure instanceof Error ? actionFailure.message : fallbackMessage);
    }
  }

  function openDuplicateDraft(group: ProjectGroupView, defaultTitle?: string) {
    setDuplicateDrafts((current) => ({
      ...current,
      [group.group.id]: defaultTitle ?? `${group.group.title} Kopya`,
    }));
  }

  function closeDuplicateDraft(groupId: string) {
    setDuplicateDrafts((current) => {
      if (!(groupId in current)) {
        return current;
      }
      const next = { ...current };
      delete next[groupId];
      return next;
    });
  }

  function setDuplicateDraft(groupId: string, value: string) {
    setDuplicateDrafts((current) => ({ ...current, [groupId]: value }));
  }

  function openManualDraft(groupId: string, defaults?: Partial<ManualCurrentDraft>) {
    setManualDrafts((current) => ({
      ...current,
      [groupId]: current[groupId] ?? { ...createEmptyManualCurrentDraft(), ...defaults },
    }));
  }

  function closeManualDraft(groupId: string) {
    setManualDrafts((current) => {
      if (!(groupId in current)) {
        return current;
      }
      const next = { ...current };
      delete next[groupId];
      return next;
    });
  }

  function updateManualDraft(groupId: string, patch: Partial<ManualCurrentDraft>) {
    setManualDrafts((current) => ({
      ...current,
      [groupId]: { ...(current[groupId] ?? createEmptyManualCurrentDraft()), ...patch },
    }));
  }

  function submitCreateProject(onCreated?: (projectId: string) => void) {
    const title = (projectDraft ?? "").trim();
    if (!title) {
      return;
    }

    void runAction(async () => {
      const project = await mutations.createProject(title);
      setProjectDraft(null);
      onCreated?.(project.id);
    }, "Proje oluşturulamadı.");
  }

  function submitCreateGroup(activeProject: ProjectView | null, onCreated?: (groupId: string) => void) {
    if (!activeProject) {
      return;
    }
    const title = (groupDraft ?? "").trim();
    if (!title) {
      return;
    }

    void runAction(async () => {
      const group = await mutations.createGroup({
        projectId: activeProject.project.id,
        title,
      });
      setGroupDraft(null);
      onCreated?.(group.id);
    }, "Grup oluşturulamadı.");
  }

  function submitDuplicateGroup(
    group: ProjectGroupView,
    onDuplicated?: (newGroupId: string) => void,
    fallbackTitle?: string,
  ) {
    const draftTitle = (duplicateDrafts[group.group.id] ?? "").trim();
    const title = draftTitle || (fallbackTitle ?? "").trim();
    if (!title) {
      return;
    }

    void runAction(async () => {
      const duplicatedGroup = await mutations.duplicateGroup({
        sourceGroupId: group.group.id,
        newTitle: title,
      });
      closeDuplicateDraft(group.group.id);
      onDuplicated?.(duplicatedGroup.id);
    }, "Grup kopyalanamadı.");
  }

  function submitManualCurrent(group: ProjectGroupView, onSubmitted?: () => void) {
    const draft = manualDrafts[group.group.id];
    if (!draft) {
      return;
    }
    const currentA = Number(draft.currentA);
    if (!Number.isFinite(currentA) || currentA <= 0) {
      return;
    }
    const rawQuantity = Number(draft.quantity);
    const quantity = Number.isFinite(rawQuantity) && rawQuantity > 0 ? Math.trunc(rawQuantity) : undefined;

    void runAction(async () => {
      await mutations.createManualCurrent({
        groupId: group.group.id,
        label: draft.label,
        currentA,
        ...(quantity !== undefined ? { quantity } : {}),
      });
      closeManualDraft(group.group.id);
      onSubmitted?.();
    }, "Manuel akım eklenemedi.");
  }

  function clearActionError() {
    setActionError(null);
  }

  function runActionPublic(action: () => Promise<unknown>, fallbackMessage?: string) {
    void runAction(action, fallbackMessage ?? "İşlem tamamlanamadı.");
  }

  return {
    drafts: {
      projectDraft,
      groupDraft,
      duplicateDrafts,
      manualDrafts,
      actionError,
    },
    actions: {
      setProjectDraft,
      setGroupDraft,
      openDuplicateDraft,
      closeDuplicateDraft,
      setDuplicateDraft,
      openManualDraft,
      closeManualDraft,
      updateManualDraft,
      submitCreateProject,
      submitCreateGroup,
      submitDuplicateGroup,
      submitManualCurrent,
      runAction: runActionPublic,
      clearActionError,
    },
    actionError,
  };
}
