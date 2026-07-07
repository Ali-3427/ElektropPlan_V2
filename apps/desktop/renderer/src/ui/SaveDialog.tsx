import { useEffect, useMemo, useState } from "react";

import type { CalculationRecord } from "../bridge/types";
import { getLastGroup, setLastGroup } from "../features/projects/lastGroupStore";
import { useProjectMutations } from "../features/projects/projectMutations";
import { useProjectsData } from "../features/projects/useProjectsData";
import { Button } from "./Button";
import { Field } from "./Field";
import styles from "./SaveDialog.module.css";

interface SaveDialogProps {
  record: CalculationRecord;
  onClose: () => void;
}

const NONE = "__none__";
const NEW = "__new__";

export function SaveDialog({ record, onClose }: SaveDialogProps) {
  const { projects } = useProjectsData();
  const mutations = useProjectMutations();

  const [selectedProjectId, setSelectedProjectId] = useState<string>(NONE);
  const [selectedGroupId, setSelectedGroupId] = useState<string>(NONE);
  const [newProjectTitle, setNewProjectTitle] = useState("");
  const [newGroupTitle, setNewGroupTitle] = useState("");
  const [quantity, setQuantity] = useState<number>(Math.max(1, record.grouping?.quantity ?? 1));
  const [error, setError] = useState<string | null>(null);

  const currentGroupId = record.grouping?.groupId;
  const currentProjectId = useMemo(() => {
    for (const project of projects) {
      if (project.groups.some((group) => group.group.id === currentGroupId)) {
        return project.project.id;
      }
    }
    return NONE;
  }, [currentGroupId, projects]);

  const activeProject =
    projects.find((project) => project.project.id === selectedProjectId) ?? null;

  useEffect(() => {
    if (selectedProjectId === NONE && currentProjectId !== NONE) {
      setSelectedProjectId(currentProjectId);
      return;
    }

    const firstProject = projects[0];
    if (selectedProjectId === NONE && firstProject) {
      setSelectedProjectId(firstProject.project.id);
    }
  }, [currentProjectId, projects, selectedProjectId]);

  useEffect(() => {
    if (!activeProject) {
      setSelectedGroupId(NONE);
      return;
    }

    if (selectedGroupId === NEW) {
      return;
    }

    if (
      currentGroupId &&
      activeProject.groups.some((group) => group.group.id === currentGroupId)
    ) {
      setSelectedGroupId(currentGroupId);
      return;
    }

    if (activeProject.groups.some((group) => group.group.id === selectedGroupId)) {
      return;
    }

    if (record.calculator === "voltage-drop-group") {
      setSelectedGroupId(NONE);
      return;
    }

    const lastGroupId = getLastGroup(activeProject.project.id);
    if (lastGroupId && activeProject.groups.some((group) => group.group.id === lastGroupId)) {
      setSelectedGroupId(lastGroupId);
      return;
    }

    setSelectedGroupId(activeProject.groups[0]?.group.id ?? NONE);
  }, [activeProject, currentGroupId, selectedGroupId, record.calculator]);

  async function handleSave() {
    try {
      setError(null);

      let projectId = selectedProjectId;
      if (selectedProjectId === NEW) {
        const title = newProjectTitle.trim();
        if (!title) {
          setError("Yeni proje adi girin.");
          return;
        }

        const createdProject = await mutations.createProject(title);
        projectId = createdProject.id;
      }

      let groupId: string | undefined;
      if (selectedGroupId === NEW) {
        const title = newGroupTitle.trim();
        if (!title) {
          setError("Yeni grup adi girin.");
          return;
        }

        if (projectId === NONE) {
          setError("Once proje secin.");
          return;
        }

        const createdGroup = await mutations.createGroup({
          projectId,
          title,
        });
        groupId = createdGroup.id;
      } else if (selectedGroupId !== NONE) {
        groupId = selectedGroupId;
      }

      if (
        !groupId &&
        record.calculator === "voltage-drop-group" &&
        projectId !== NONE
      ) {
        const createdGroup = await mutations.createGroup({
          projectId,
          title: record.title?.trim() || "Gerilim dusumu grubu",
        });
        groupId = createdGroup.id;
      }

      const currentGrouping = record.grouping ?? {};
      const { quantity: _previousQuantity, ...restGrouping } = currentGrouping;

      const { createdAt: _createdAt, updatedAt: _updatedAt, ...cleanRecord } = record as
        CalculationRecord & { createdAt?: unknown; updatedAt?: unknown };

      await mutations.saveRecord({
        ...cleanRecord,
        grouping: {
          ...restGrouping,
          ...(groupId ? { groupId } : {}),
          ...(quantity > 1 ? { quantity } : {}),
        },
      });

      if (projectId !== NONE && groupId) {
        setLastGroup(projectId, groupId);
      }

      onClose();
    } catch (mutationError) {
      setError(
        mutationError instanceof Error ? mutationError.message : "Kayit sirasinda hata olustu.",
      );
    }
  }

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.dialog} onClick={(event) => event.stopPropagation()}>
        <h3 className={styles.dialogTitle}>Hesabi kaydet</h3>

        <div className={styles.body}>
          <Field label="Proje">
            <select
              className={styles.select}
              value={selectedProjectId}
              onChange={(event) => setSelectedProjectId(event.target.value)}
            >
              <option value={NONE}>Proje secme</option>
              {projects.map((project) => (
                <option key={project.project.id} value={project.project.id}>
                  {project.project.title}
                </option>
              ))}
              <option value={NEW}>+ Yeni proje</option>
            </select>
          </Field>

          {selectedProjectId === NEW ? (
            <Field label="Yeni proje adi">
              <input
                className={styles.input}
                type="text"
                value={newProjectTitle}
                onChange={(event) => setNewProjectTitle(event.target.value)}
                placeholder="Orn. Fabrika revizyonu"
                autoFocus
              />
            </Field>
          ) : null}

          <Field label="Grup">
            <select
              className={styles.select}
              disabled={selectedProjectId === NONE}
              value={selectedGroupId}
              onChange={(event) => setSelectedGroupId(event.target.value)}
            >
              <option value={NONE}>Grup secme</option>
              {(activeProject?.groups ?? []).map((group) => (
                <option key={group.group.id} value={group.group.id}>
                  {group.group.title}
                </option>
              ))}
              <option value={NEW}>+ Yeni grup</option>
            </select>
          </Field>

          {selectedGroupId === NEW ? (
            <Field label="Yeni grup adi">
              <input
                className={styles.input}
                type="text"
                value={newGroupTitle}
                onChange={(event) => setNewGroupTitle(event.target.value)}
                placeholder="Orn. Kat 1 panolar"
              />
            </Field>
          ) : null}

          <Field label="Adet">
            <input
              className={styles.input}
              min={1}
              step={1}
              type="number"
              value={quantity}
              onChange={(event) =>
                setQuantity(Math.max(1, Math.trunc(Number(event.target.value) || 1)))
              }
            />
          </Field>

          {error ? <div className={styles.error}>{error}</div> : null}
        </div>

        <div className={styles.actions}>
          <Button variant="secondary" onClick={onClose}>
            Iptal
          </Button>
          <Button
            variant="primary"
            loading={mutations.isPending}
            onClick={() => void handleSave()}
          >
            Kaydet
          </Button>
        </div>
      </div>
    </div>
  );
}
