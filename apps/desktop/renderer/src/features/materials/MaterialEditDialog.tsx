import { useEffect, useState } from "react";
import type { Material, MaterialCategory } from "../../bridge/types";
import { useMaterialMutations } from "./materialMutations";
import { slugify } from "./slugify";
import styles from "./MaterialEditDialog.module.css";

interface AttributeRow {
  key: string;
  value: string;
}

interface MaterialEditDialogProps {
  existing: Material | undefined;
  categories: readonly MaterialCategory[];
  onClose: () => void;
  onSaved: () => void;
}

const UNITS = ["adet", "m", "kg", "set", "paket"] as const;

export function MaterialEditDialog({
  existing,
  categories,
  onClose,
  onSaved,
}: MaterialEditDialogProps) {
  const mutations = useMaterialMutations();

  const [name, setName] = useState(existing?.name ?? "");
  const [categoryId, setCategoryId] = useState(
    existing?.categoryId ?? categories[0]?.id ?? "",
  );
  const [unit, setUnit] = useState<string>(existing?.unit ?? "");
  const [unitPrice, setUnitPrice] = useState(
    existing?.unitPrice != null ? String(existing.unitPrice) : "",
  );
  const [stockQty, setStockQty] = useState(
    existing?.stockQty != null ? String(existing.stockQty) : "",
  );
  const [brand, setBrand] = useState(existing?.brand ?? "");
  const [modelCode, setModelCode] = useState(existing?.modelCode ?? "");
  const [notes, setNotes] = useState(existing?.notes ?? "");
  const [attrs, setAttrs] = useState<AttributeRow[]>(() => {
    if (!existing?.attributes) return [];
    return Object.entries(existing.attributes).map(([key, value]) => ({
      key,
      value: String(value ?? ""),
    }));
  });
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [onClose]);

  function addAttr() {
    setAttrs((prev) => [...prev, { key: "", value: "" }]);
  }

  function removeAttr(index: number) {
    setAttrs((prev) => prev.filter((_, i) => i !== index));
  }

  function updateAttr(index: number, field: "key" | "value", val: string) {
    setAttrs((prev) =>
      prev.map((row, i) => (i === index ? { ...row, [field]: val } : row)),
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const trimmedName = name.trim();
    if (!trimmedName) {
      setError("Ad zorunludur.");
      return;
    }
    if (!categoryId) {
      setError("Kategori seçilmelidir.");
      return;
    }

    const parsedPrice = unitPrice ? parseFloat(unitPrice) : undefined;
    const parsedStock = stockQty ? parseInt(stockQty, 10) : undefined;

    if (parsedPrice != null && (isNaN(parsedPrice) || parsedPrice < 0)) {
      setError("Geçerli bir fiyat girin.");
      return;
    }

    const attributes =
      attrs.length > 0
        ? Object.fromEntries(
            attrs.filter((r) => r.key.trim()).map((r) => [r.key.trim(), r.value]),
          )
        : undefined;

    const id =
      existing?.id ?? `${categoryId}--${slugify(trimmedName)}-${Date.now().toString(36)}`;

    const material: Material = {
      id,
      categoryId,
      name: trimmedName,
      source: existing?.source ?? "user",
      ...(unit ? { unit } : {}),
      ...(parsedPrice != null ? { unitPrice: parsedPrice } : {}),
      ...(parsedStock != null ? { stockQty: parsedStock } : {}),
      ...(brand.trim() ? { brand: brand.trim() } : {}),
      ...(modelCode.trim() ? { modelCode: modelCode.trim() } : {}),
      ...(notes.trim() ? { notes: notes.trim() } : {}),
      ...(attributes ? { attributes } : {}),
    };

    try {
      await mutations.upsertMaterial.mutateAsync(material);
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Kayıt başarısız.");
    }
  }

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.dialog} onClick={(e) => e.stopPropagation()}>
        <div className={styles.dialogHeader}>
          <h2 className={styles.dialogTitle}>
            {existing ? "Malzeme Düzenle" : "Yeni Malzeme"}
          </h2>
          <button type="button" className={styles.closeBtn} onClick={onClose}>
            ✕
          </button>
        </div>
        <form onSubmit={handleSubmit} className={styles.form}>
          {error && <div className={styles.errorBanner}>{error}</div>}

          <div className={styles.row}>
            <label className={styles.label}>
              Ad <span className={styles.required}>*</span>
            </label>
            <input
              autoFocus
              className={styles.input}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Malzeme adı"
            />
          </div>

          <div className={styles.row}>
            <label className={styles.label}>
              Kategori <span className={styles.required}>*</span>
            </label>
            <select
              className={styles.select}
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
            >
              {categories.map((cat) => (
                <option key={cat.id} value={cat.id}>
                  {cat.title}
                </option>
              ))}
            </select>
          </div>

          <div className={styles.rowGroup}>
            <div className={styles.row}>
              <label className={styles.label}>Birim</label>
              <select
                className={styles.select}
                value={unit}
                onChange={(e) => setUnit(e.target.value)}
              >
                <option value="">—</option>
                {UNITS.map((u) => (
                  <option key={u} value={u}>
                    {u}
                  </option>
                ))}
              </select>
            </div>
            <div className={styles.row}>
              <label className={styles.label}>Birim Fiyat (TL)</label>
              <input
                type="number"
                min="0"
                step="0.01"
                className={styles.input}
                value={unitPrice}
                onChange={(e) => setUnitPrice(e.target.value)}
                placeholder="0.00"
              />
            </div>
            <div className={styles.row}>
              <label className={styles.label}>Stok Adedi</label>
              <input
                type="number"
                min="0"
                step="1"
                className={styles.input}
                value={stockQty}
                onChange={(e) => setStockQty(e.target.value)}
                placeholder="0"
              />
            </div>
          </div>

          <div className={styles.rowGroup}>
            <div className={styles.row}>
              <label className={styles.label}>Marka</label>
              <input
                className={styles.input}
                value={brand}
                onChange={(e) => setBrand(e.target.value)}
                placeholder="ABB, Schneider…"
              />
            </div>
            <div className={styles.row}>
              <label className={styles.label}>Model Kodu</label>
              <input
                className={styles.input}
                value={modelCode}
                onChange={(e) => setModelCode(e.target.value)}
                placeholder="AF38-30-00-13"
              />
            </div>
          </div>

          <div className={styles.row}>
            <label className={styles.label}>Notlar</label>
            <textarea
              className={styles.textarea}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              placeholder="İsteğe bağlı notlar"
            />
          </div>

          <div className={styles.attrsSection}>
            <div className={styles.attrsHeader}>
              <span className={styles.label}>Özellikler</span>
              <button type="button" className={styles.addAttrBtn} onClick={addAttr}>
                + Ekle
              </button>
            </div>
            {attrs.map((row, i) => (
              <div key={i} className={styles.attrRow}>
                <input
                  className={styles.attrInput}
                  value={row.key}
                  onChange={(e) => updateAttr(i, "key", e.target.value)}
                  placeholder="Anahtar"
                />
                <input
                  className={styles.attrInput}
                  value={row.value}
                  onChange={(e) => updateAttr(i, "value", e.target.value)}
                  placeholder="Değer"
                />
                <button
                  type="button"
                  className={styles.removeAttrBtn}
                  onClick={() => removeAttr(i)}
                >
                  ✕
                </button>
              </div>
            ))}
          </div>

          <div className={styles.dialogFooter}>
            <button type="button" className={styles.cancelBtn} onClick={onClose}>
              İptal
            </button>
            <button
              type="submit"
              className={styles.saveBtn}
              disabled={mutations.upsertMaterial.isPending}
            >
              {mutations.upsertMaterial.isPending ? "Kaydediliyor…" : "Kaydet"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
