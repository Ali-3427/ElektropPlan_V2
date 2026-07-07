import { useEffect, useState } from "react";
import type { Material, MaterialCategory } from "../../bridge/types";
import { getBridge } from "../../bridge/client";
import { useQueryClient } from "@tanstack/react-query";
import styles from "./MaterialEditDialog.module.css";

interface BulkEditDialogProps {
  selected: readonly Material[];
  categories: readonly MaterialCategory[];
  onClose: () => void;
  onSaved: () => void;
}

const UNITS = ["adet", "m", "kg", "set", "paket"] as const;

interface FieldState<T> {
  enabled: boolean;
  value: T;
}

function stripPersistenceTimestamps(material: Material): Record<string, unknown> {
  const { createdAt: _createdAt, updatedAt: _updatedAt, ...rest } = material as Material & {
    createdAt?: unknown;
    updatedAt?: unknown;
  };
  return rest;
}

export function BulkEditDialog({
  selected,
  categories,
  onClose,
  onSaved,
}: BulkEditDialogProps) {
  const qc = useQueryClient();
  const [brand, setBrand] = useState<FieldState<string>>({ enabled: false, value: "" });
  const [modelCode, setModelCode] = useState<FieldState<string>>({ enabled: false, value: "" });
  const [unit, setUnit] = useState<FieldState<string>>({ enabled: false, value: "" });
  const [unitPrice, setUnitPrice] = useState<FieldState<string>>({ enabled: false, value: "" });
  const [stockQty, setStockQty] = useState<FieldState<string>>({ enabled: false, value: "" });
  const [categoryId, setCategoryId] = useState<FieldState<string>>({
    enabled: false,
    value: categories[0]?.id ?? "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [onClose]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const anyEnabled =
      brand.enabled ||
      modelCode.enabled ||
      unit.enabled ||
      unitPrice.enabled ||
      stockQty.enabled ||
      categoryId.enabled;

    if (!anyEnabled) {
      setError("En az bir alanı seçin.");
      return;
    }

    let parsedPrice: number | undefined;
    if (unitPrice.enabled) {
      if (unitPrice.value === "") {
        parsedPrice = undefined;
      } else {
        const p = parseFloat(unitPrice.value);
        if (isNaN(p) || p < 0) {
          setError("Geçerli bir fiyat girin.");
          return;
        }
        parsedPrice = p;
      }
    }

    let parsedStock: number | undefined;
    if (stockQty.enabled) {
      if (stockQty.value === "") {
        parsedStock = undefined;
      } else {
        const s = parseInt(stockQty.value, 10);
        if (isNaN(s) || s < 0) {
          setError("Geçerli bir stok girin.");
          return;
        }
        parsedStock = s;
      }
    }

    setSaving(true);
    try {
      const bridge = getBridge();
      for (const mat of selected) {
        const merged = stripPersistenceTimestamps(mat);
        if (categoryId.enabled) merged.categoryId = categoryId.value;
        if (brand.enabled) {
          const v = brand.value.trim();
          if (v) merged.brand = v;
          else delete merged.brand;
        }
        if (modelCode.enabled) {
          const v = modelCode.value.trim();
          if (v) merged.modelCode = v;
          else delete merged.modelCode;
        }
        if (unit.enabled) {
          if (unit.value) merged.unit = unit.value;
          else delete merged.unit;
        }
        if (unitPrice.enabled) {
          if (parsedPrice !== undefined) merged.unitPrice = parsedPrice;
          else delete merged.unitPrice;
        }
        if (stockQty.enabled) {
          if (parsedStock !== undefined) merged.stockQty = parsedStock;
          else delete merged.stockQty;
        }
        await bridge.materials.upsert(merged as unknown as Material);
      }
      await qc.invalidateQueries({ queryKey: ["materials"] });
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Toplu kayıt başarısız.");
      setSaving(false);
    }
  }

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.dialog} onClick={(e) => e.stopPropagation()}>
        <div className={styles.dialogHeader}>
          <h2 className={styles.dialogTitle}>
            Toplu Düzenle ({selected.length} malzeme)
          </h2>
          <button type="button" className={styles.closeBtn} onClick={onClose}>
            ✕
          </button>
        </div>
        <form onSubmit={handleSubmit} className={styles.form}>
          {error && <div className={styles.errorBanner}>{error}</div>}
          <p className={styles.label} style={{ marginBottom: 0 }}>
            Yalnızca işaretlenen alanlar tüm seçili malzemelere uygulanır.
          </p>

          <BulkField
            label="Marka"
            enabled={brand.enabled}
            onToggle={(v) => setBrand({ ...brand, enabled: v })}
          >
            <input
              className={styles.input}
              value={brand.value}
              disabled={!brand.enabled}
              onChange={(e) => setBrand({ ...brand, value: e.target.value })}
              placeholder="(boş = sil)"
            />
          </BulkField>

          <BulkField
            label="Model Kodu"
            enabled={modelCode.enabled}
            onToggle={(v) => setModelCode({ ...modelCode, enabled: v })}
          >
            <input
              className={styles.input}
              value={modelCode.value}
              disabled={!modelCode.enabled}
              onChange={(e) => setModelCode({ ...modelCode, value: e.target.value })}
              placeholder="(boş = sil)"
            />
          </BulkField>

          <BulkField
            label="Birim"
            enabled={unit.enabled}
            onToggle={(v) => setUnit({ ...unit, enabled: v })}
          >
            <select
              className={styles.select}
              value={unit.value}
              disabled={!unit.enabled}
              onChange={(e) => setUnit({ ...unit, value: e.target.value })}
            >
              <option value="">—</option>
              {UNITS.map((u) => (
                <option key={u} value={u}>
                  {u}
                </option>
              ))}
            </select>
          </BulkField>

          <BulkField
            label="Birim Fiyat (TL)"
            enabled={unitPrice.enabled}
            onToggle={(v) => setUnitPrice({ ...unitPrice, enabled: v })}
          >
            <input
              type="number"
              min="0"
              step="0.01"
              className={styles.input}
              value={unitPrice.value}
              disabled={!unitPrice.enabled}
              onChange={(e) => setUnitPrice({ ...unitPrice, value: e.target.value })}
              placeholder="(boş = sil)"
            />
          </BulkField>

          <BulkField
            label="Stok"
            enabled={stockQty.enabled}
            onToggle={(v) => setStockQty({ ...stockQty, enabled: v })}
          >
            <input
              type="number"
              min="0"
              step="1"
              className={styles.input}
              value={stockQty.value}
              disabled={!stockQty.enabled}
              onChange={(e) => setStockQty({ ...stockQty, value: e.target.value })}
              placeholder="(boş = sil)"
            />
          </BulkField>

          <BulkField
            label="Kategori"
            enabled={categoryId.enabled}
            onToggle={(v) => setCategoryId({ ...categoryId, enabled: v })}
          >
            <select
              className={styles.select}
              value={categoryId.value}
              disabled={!categoryId.enabled}
              onChange={(e) => setCategoryId({ ...categoryId, value: e.target.value })}
            >
              {categories.map((cat) => (
                <option key={cat.id} value={cat.id}>
                  {cat.title}
                </option>
              ))}
            </select>
          </BulkField>

          <div className={styles.dialogFooter}>
            <button type="button" className={styles.cancelBtn} onClick={onClose}>
              İptal
            </button>
            <button type="submit" className={styles.saveBtn} disabled={saving}>
              {saving ? "Kaydediliyor…" : "Uygula"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

interface BulkFieldProps {
  label: string;
  enabled: boolean;
  onToggle: (v: boolean) => void;
  children: React.ReactNode;
}

function BulkField({ label, enabled, onToggle, children }: BulkFieldProps) {
  return (
    <div className={styles.row}>
      <label
        className={styles.label}
        style={{ display: "flex", alignItems: "center", gap: 8 }}
      >
        <input
          type="checkbox"
          checked={enabled}
          onChange={(e) => onToggle(e.target.checked)}
        />
        {label}
      </label>
      {children}
    </div>
  );
}
