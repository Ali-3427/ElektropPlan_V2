import type { Material } from "../../bridge/types";
import styles from "./MaterialsTable.module.css";

interface MaterialsTableProps {
  materials: readonly Material[];
  selectedIds: ReadonlySet<string>;
  onToggleSelect: (id: string) => void;
  onToggleSelectAll: () => void;
  onEdit: (material: Material) => void;
  onDelete: (material: Material) => void;
}

export function MaterialsTable({
  materials,
  selectedIds,
  onToggleSelect,
  onToggleSelectAll,
  onEdit,
  onDelete,
}: MaterialsTableProps) {
  if (materials.length === 0) {
    return (
      <div className={styles.empty}>
        Bu kategoride malzeme yok — &lsquo;+ Yeni Malzeme&rsquo; veya &lsquo;İçe Aktar&rsquo;
      </div>
    );
  }

  const allChecked = materials.length > 0 && materials.every((m) => selectedIds.has(m.id));
  const partialChecked = !allChecked && materials.some((m) => selectedIds.has(m.id));

  return (
    <table className={styles.table}>
      <thead>
        <tr>
          <th className={styles.th} style={{ width: 32 }}>
            <input
              type="checkbox"
              checked={allChecked}
              ref={(el) => {
                if (el) el.indeterminate = partialChecked;
              }}
              onChange={onToggleSelectAll}
              aria-label="Tümünü seç"
            />
          </th>
          <th className={styles.th}>SIRA</th>
          <th className={styles.th}>AD</th>
          <th className={styles.th}>MARKA</th>
          <th className={styles.th}>MODEL</th>
          <th className={styles.th}>BİRİM</th>
          <th className={styles.th}>FİYAT</th>
          <th className={styles.th}>STOK</th>
          <th className={styles.th}>KAYNAK</th>
          <th className={styles.th}></th>
        </tr>
      </thead>
      <tbody>
        {materials.map((mat, idx) => (
          <tr
            key={mat.id}
            className={styles.row}
            onClick={() => onEdit(mat)}
          >
            <td className={styles.td} onClick={(e) => e.stopPropagation()}>
              <input
                type="checkbox"
                checked={selectedIds.has(mat.id)}
                onChange={() => onToggleSelect(mat.id)}
                aria-label={`${mat.name} seç`}
              />
            </td>
            <td className={styles.td}>{idx + 1}</td>
            <td className={`${styles.td} ${styles.nameCell}`}>{mat.name}</td>
            <td className={styles.td}>{mat.brand ?? "—"}</td>
            <td className={styles.td}>{mat.modelCode ?? "—"}</td>
            <td className={styles.td}>{mat.unit ?? "—"}</td>
            <td className={styles.td}>
              {mat.unitPrice != null
                ? mat.unitPrice.toLocaleString("tr-TR", {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })
                : "—"}
            </td>
            <td className={styles.td}>{mat.stockQty ?? "—"}</td>
            <td className={styles.td}>
              <span className={`${styles.sourceBadge} ${mat.source === "seed" ? styles.seed : styles.user}`}>
                {mat.source === "seed" ? "Seed" : "Kullanıcı"}
              </span>
            </td>
            <td className={styles.td} onClick={(e) => e.stopPropagation()}>
              <button
                type="button"
                className={styles.deleteBtn}
                title="Sil"
                onClick={() => onDelete(mat)}
              >
                ✕
              </button>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
