import { useRef, useState } from "react";
import type { MaterialCategory } from "../../bridge/types";
import styles from "./CategoryTree.module.css";

interface CategoryTreeProps {
  categories: readonly MaterialCategory[];
  materialsCountByCategory: Record<string, number>;
  totalCount: number;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  onCreate: (title: string) => void;
  onRenameRequest: (category: MaterialCategory) => void;
  onDeleteRequest: (category: MaterialCategory) => void;
}

export function CategoryTree({
  categories,
  materialsCountByCategory,
  totalCount,
  selectedId,
  onSelect,
  onCreate,
  onRenameRequest,
  onDeleteRequest,
}: CategoryTreeProps) {
  const [adding, setAdding] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  function handleAddSubmit(e: React.FormEvent) {
    e.preventDefault();
    const title = newTitle.trim();
    if (title) {
      onCreate(title);
      setNewTitle("");
      setAdding(false);
    }
  }

  function handleAddCancel() {
    setNewTitle("");
    setAdding(false);
  }

  return (
    <div className={styles.tree}>
      <ul className={styles.list}>
        <li>
          <button
            type="button"
            className={`${styles.item} ${selectedId === null ? styles.active : ""}`}
            onClick={() => onSelect(null)}
          >
            <span className={styles.label}>Tümü</span>
            <span className={styles.badge}>{totalCount}</span>
          </button>
        </li>
        {categories.map((cat) => (
          <li key={cat.id} className={styles.catRow}>
            <button
              type="button"
              className={`${styles.item} ${selectedId === cat.id ? styles.active : ""}`}
              onClick={() => onSelect(cat.id)}
              title={cat.title}
            >
              <span className={styles.label}>{cat.title}</span>
              <span className={styles.badge}>
                {materialsCountByCategory[cat.id] ?? 0}
              </span>
            </button>
            <div className={styles.catActions}>
              <button
                type="button"
                className={styles.catActionBtn}
                title="Yeniden adlandır"
                onClick={(e) => { e.stopPropagation(); onRenameRequest(cat); }}
              >
                ✎
              </button>
              <button
                type="button"
                className={`${styles.catActionBtn} ${styles.catDeleteBtn}`}
                title="Sil"
                onClick={(e) => { e.stopPropagation(); onDeleteRequest(cat); }}
              >
                ✕
              </button>
            </div>
          </li>
        ))}
      </ul>
      <div className={styles.footer}>
        {adding ? (
          <form onSubmit={handleAddSubmit} className={styles.addForm}>
            <input
              ref={inputRef}
              autoFocus
              className={styles.addInput}
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              placeholder="Kategori adı"
              onKeyDown={(e) => {
                if (e.key === "Escape") handleAddCancel();
              }}
            />
            <button type="submit" className={styles.addConfirm} disabled={!newTitle.trim()}>
              Ekle
            </button>
            <button type="button" className={styles.addCancel} onClick={handleAddCancel}>
              İptal
            </button>
          </form>
        ) : (
          <button
            type="button"
            className={styles.addBtn}
            onClick={() => setAdding(true)}
          >
            + Kategori
          </button>
        )}
      </div>
    </div>
  );
}
