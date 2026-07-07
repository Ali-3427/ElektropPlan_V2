import { useState } from "react";
import { getBridge } from "../../bridge/client";
import { useMaterialMutations } from "./materialMutations";
import styles from "./ImportExcelDialog.module.css";

interface ImportResult {
  categoriesAdded: number;
  materialsAdded: number;
  materialsUpdated: number;
  untouched: number;
}

interface ImportExcelDialogProps {
  onClose: () => void;
}

export function ImportExcelDialog({ onClose }: ImportExcelDialogProps) {
  const mutations = useMaterialMutations();
  const [result, setResult] = useState<ImportResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handlePick() {
    setError(null);
    setResult(null);
    setLoading(true);
    try {
      const filePath = await getBridge().materials.pickExcel();
      if (!filePath) {
        setLoading(false);
        return;
      }
      const summary = await mutations.importExcel.mutateAsync({ filePath, mode: "merge" });
      setResult(summary);
    } catch (err) {
      setError(err instanceof Error ? err.message : "İçe aktarma başarısız.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.dialog} onClick={(e) => e.stopPropagation()}>
        <div className={styles.header}>
          <h2 className={styles.title}>Excel'den İçe Aktar</h2>
          <button type="button" className={styles.closeBtn} onClick={onClose}>
            ✕
          </button>
        </div>
        <div className={styles.body}>
          <p className={styles.desc}>
            MST malzeme listesi formatında bir Excel dosyası (.xlsx) seçin.
            Mevcut kullanıcı malzemeleri değiştirilmez — sadece seed kayıtları güncellenir.
          </p>
          <div className={styles.modeRow}>
            <span className={styles.modeLabel}>Mod:</span>
            <span className={styles.modeBadge}>Birleştir (Merge)</span>
          </div>
          {error && <div className={styles.errorBanner}>{error}</div>}
          {result && (
            <div className={styles.resultPanel}>
              <div className={styles.resultTitle}>İçe aktarma tamamlandı</div>
              <ul className={styles.resultList}>
                <li>Yeni kategori: <strong>{result.categoriesAdded}</strong></li>
                <li>Yeni malzeme: <strong>{result.materialsAdded}</strong></li>
                <li>Güncellenen malzeme: <strong>{result.materialsUpdated}</strong></li>
                <li>Değiştirilmeyen: <strong>{result.untouched}</strong></li>
              </ul>
            </div>
          )}
        </div>
        <div className={styles.footer}>
          <button type="button" className={styles.cancelBtn} onClick={onClose}>
            Kapat
          </button>
          <button
            type="button"
            className={styles.importBtn}
            onClick={handlePick}
            disabled={loading}
          >
            {loading ? "Aktarılıyor…" : "Dosya Seç ve Aktar"}
          </button>
        </div>
      </div>
    </div>
  );
}
