import { useEffect, useMemo, useState } from "react";
import type { Material, MaterialCategory } from "../../bridge/types";
import { CategoryTree } from "./CategoryTree";
import { MaterialEditDialog } from "./MaterialEditDialog";
import { MaterialsTable } from "./MaterialsTable";
import { ImportExcelDialog } from "./ImportExcelDialog";
import { BulkEditDialog } from "./BulkEditDialog";
import { useCategories, useMaterials } from "./useMaterialsData";
import { useMaterialMutations } from "./materialMutations";
import { useDebouncedValue } from "./useDebouncedValue";
import { usePersistentPageState } from "../shared/usePersistentPageState";
import styles from "./MaterialsPage.module.css";

interface MaterialsPageState {
  readonly selectedCategoryId: string | null;
  readonly searchRaw: string;
  readonly selectedIds: readonly string[];
}

function createDefaultMaterialsPageState(): MaterialsPageState {
  return {
    selectedCategoryId: null,
    searchRaw: "",
    selectedIds: [],
  };
}

export function MaterialsPage() {
  const [pageState, setPageState] = usePersistentPageState<MaterialsPageState>({
    key: "elektroplan.page.materials",
    version: 1,
    defaultValue: () => createDefaultMaterialsPageState(),
  });
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(
    pageState.selectedCategoryId,
  );
  const [searchRaw, setSearchRaw] = useState(pageState.searchRaw);
  const search = useDebouncedValue(searchRaw, 200);
  const [editTarget, setEditTarget] = useState<Material | null | "new">(null);
  const [showImport, setShowImport] = useState(false);
  const [selectedIds, setSelectedIds] = useState<ReadonlySet<string>>(
    () => new Set(pageState.selectedIds),
  );
  const [showBulkEdit, setShowBulkEdit] = useState(false);

  const filter = useMemo(() => {
    const f: { categoryId?: string; search?: string } = {};
    if (search) {
      f.search = search;
    } else if (selectedCategoryId) {
      f.categoryId = selectedCategoryId;
    }
    return f;
  }, [selectedCategoryId, search]);

  const categoriesQuery = useCategories();
  const materialsQuery = useMaterials(filter);
  const mutations = useMaterialMutations();

  const categories = categoriesQuery.data ?? [];
  const materialsRaw = materialsQuery.data ?? [];
  const materials = useMemo(() => {
    const collator = new Intl.Collator("tr", { sensitivity: "base", numeric: true });
    return [...materialsRaw].sort((a, b) => collator.compare(a.name, b.name));
  }, [materialsRaw]);

  const materialsCountByCategory = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const m of materials) {
      counts[m.categoryId] = (counts[m.categoryId] ?? 0) + 1;
    }
    return counts;
  }, [materials]);

  useEffect(() => {
    setPageState({
      selectedCategoryId,
      searchRaw,
      selectedIds: [...selectedIds],
    });
  }, [searchRaw, selectedCategoryId, selectedIds, setPageState]);

  useEffect(() => {
    if (!categoriesQuery.data) {
      return;
    }

    if (
      selectedCategoryId !== null &&
      !categories.some((category) => category.id === selectedCategoryId)
    ) {
      setSelectedCategoryId(null);
    }
  }, [categories, categoriesQuery.data, selectedCategoryId]);

  useEffect(() => {
    if (!materialsQuery.data) {
      return;
    }

    const materialIds = new Set(materialsRaw.map((material) => material.id));
    const nextIds = [...selectedIds].filter((id) => materialIds.has(id));
    if (nextIds.length !== selectedIds.size) {
      setSelectedIds(new Set(nextIds));
    }
  }, [materialsQuery.data, materialsRaw, selectedIds]);

  function handleCategorySelect(id: string | null) {
    setSelectedCategoryId(id);
    setSearchRaw("");
    setSelectedIds(new Set());
  }

  function toggleSelect(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleSelectAll() {
    setSelectedIds((prev) => {
      if (materials.every((m) => prev.has(m.id)) && materials.length > 0) {
        return new Set();
      }
      return new Set(materials.map((m) => m.id));
    });
  }

  const selectedMaterials = useMemo(
    () => materials.filter((m) => selectedIds.has(m.id)),
    [materials, selectedIds],
  );

  async function handleCreateCategory(title: string) {
    const { slugify } = await import("./slugify");
    const id = slugify(title);
    await mutations.upsertCategory.mutateAsync({ id, title });
  }

  function handleRenameRequest(cat: MaterialCategory) {
    const newTitle = prompt("Yeni kategori adı:", cat.title);
    if (newTitle && newTitle.trim() && newTitle.trim() !== cat.title) {
      mutations.upsertCategory.mutate({ ...cat, title: newTitle.trim() });
    }
  }

  function handleDeleteCategory(cat: MaterialCategory) {
    if (confirm(`"${cat.title}" kategorisi silinsin mi?`)) {
      mutations.deleteCategory.mutate(cat.id);
      if (selectedCategoryId === cat.id) setSelectedCategoryId(null);
    }
  }

  function handleDeleteMaterial(mat: Material) {
    const confirmed = confirm(
      `"${mat.name}" silinsin mi?\n\nBu malzeme kayıtlara atanmışsa, atamalar katalog bağlantısı olmadan kalır (snapshot korunur).`,
    );
    if (confirmed) {
      mutations.deleteMaterial.mutate(mat.id);
    }
  }

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h1 className={styles.title}>Malzemeler</h1>
        <div className={styles.headerActions}>
          {selectedIds.size > 0 ? (
            <>
              <span style={{ fontSize: "0.875rem", color: "var(--color-text-muted)" }}>
                {selectedIds.size} seçili
              </span>
              <button
                type="button"
                className={styles.btnPrimary}
                onClick={() => setShowBulkEdit(true)}
              >
                Toplu Düzenle
              </button>
              <button
                type="button"
                className={styles.btnSecondary}
                onClick={() => setSelectedIds(new Set())}
              >
                Temizle
              </button>
            </>
          ) : (
            <>
              <input
                type="search"
                className={styles.searchInput}
                placeholder="Ad, marka veya model ara…"
                value={searchRaw}
                onChange={(e) => setSearchRaw(e.target.value)}
              />
              <button
                type="button"
                className={styles.btnSecondary}
                onClick={() => setShowImport(true)}
              >
                İçe Aktar
              </button>
              <button
                type="button"
                className={styles.btnPrimary}
                onClick={() => setEditTarget("new")}
              >
                + Yeni Malzeme
              </button>
            </>
          )}
        </div>
      </div>
      <div className={styles.body}>
        <CategoryTree
          categories={categories}
          materialsCountByCategory={materialsCountByCategory}
          totalCount={materials.length}
          selectedId={search ? null : selectedCategoryId}
          onSelect={handleCategorySelect}
          onCreate={handleCreateCategory}
          onRenameRequest={handleRenameRequest}
          onDeleteRequest={handleDeleteCategory}
        />
        <div className={styles.tableWrapper}>
          <MaterialsTable
            materials={materials}
            selectedIds={selectedIds}
            onToggleSelect={toggleSelect}
            onToggleSelectAll={toggleSelectAll}
            onEdit={(mat) => setEditTarget(mat)}
            onDelete={handleDeleteMaterial}
          />
        </div>
      </div>
      {editTarget !== null && (
        <MaterialEditDialog
          existing={editTarget === "new" ? undefined : editTarget}
          categories={categories}
          onClose={() => setEditTarget(null)}
          onSaved={() => setEditTarget(null)}
        />
      )}
      {showImport && (
        <ImportExcelDialog onClose={() => setShowImport(false)} />
      )}
      {showBulkEdit && selectedMaterials.length > 0 && (
        <BulkEditDialog
          selected={selectedMaterials}
          categories={categories}
          onClose={() => setShowBulkEdit(false)}
          onSaved={() => {
            setShowBulkEdit(false);
            setSelectedIds(new Set());
          }}
        />
      )}
    </div>
  );
}
