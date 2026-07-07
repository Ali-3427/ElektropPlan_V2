import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import type { Material, MaterialAssignment, MaterialCategory } from "../../bridge/types";
import { getBridge } from "../../bridge/client";
import { useDebouncedValue } from "../materials/useDebouncedValue";
import styles from "./AssignMaterialPopover.module.css";

interface AssignMaterialPopoverProps {
  recordId: string;
  anchorRect: DOMRect;
  onClose: () => void;
}

export function AssignMaterialPopover({
  recordId,
  anchorRect,
  onClose,
}: AssignMaterialPopoverProps) {
  const qc = useQueryClient();
  const [searchRaw, setSearchRaw] = useState("");
  const search = useDebouncedValue(searchRaw, 200);
  const [results, setResults] = useState<readonly Material[]>([]);
  const [categories, setCategories] = useState<readonly MaterialCategory[]>([]);
  const [highlighted, setHighlighted] = useState(0);
  const [selected, setSelected] = useState<Material | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const searchRequestSequenceRef = useRef(0);

  useEffect(() => {
    getBridge()
      .materials.listCategories()
      .then(setCategories)
      .catch(() => setCategories([]));
  }, []);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    if (!search) {
      searchRequestSequenceRef.current += 1;
      setResults([]);
      setHighlighted(0);
      return;
    }

    const requestSequence = searchRequestSequenceRef.current + 1;
    searchRequestSequenceRef.current = requestSequence;

    getBridge()
      .materials.list({ search })
      .then((list) => {
        if (searchRequestSequenceRef.current !== requestSequence) {
          return;
        }
        setResults(list.slice(0, 10));
        setHighlighted(0);
      })
      .catch(() => {
        if (searchRequestSequenceRef.current !== requestSequence) {
          return;
        }
        setResults([]);
        setHighlighted(0);
      });
  }, [search]);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        onClose();
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [onClose]);

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlighted((h) => Math.min(h + 1, results.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlighted((h) => Math.max(h - 1, 0));
    } else if (e.key === "Enter" && results[highlighted]) {
      e.preventDefault();
      setSelected(results[highlighted]);
    } else if (e.key === "Escape") {
      onClose();
    }
  }

  async function handleAssign() {
    if (!selected) return;
    setLoading(true);
    try {
      const assignment: MaterialAssignment = {
        id: `asg_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
        recordId,
        materialId: selected.id,
        quantity,
        ...(selected.unit ? { unit: selected.unit } : {}),
        snapshotName: selected.name,
        snapshotCategoryId: selected.categoryId,
        snapshotCategoryTitle:
          categories.find((c) => c.id === selected.categoryId)?.title ??
          selected.categoryId,
        ...(selected.brand ? { snapshotBrand: selected.brand } : {}),
        ...(selected.modelCode ? { snapshotModelCode: selected.modelCode } : {}),
        ...(selected.unitPrice != null ? { snapshotUnitPrice: selected.unitPrice } : {}),
        ...(selected.attributes
          ? { snapshotAttributes: selected.attributes as Record<string, unknown> }
          : {}),
      };
      await getBridge().assignments.upsert(assignment);
      await qc.invalidateQueries({ queryKey: ["assignments"] });
      onClose();
    } catch {
      setLoading(false);
    }
  }

  const [position, setPosition] = useState<{ top: number; left: number }>({
    top: anchorRect.bottom + 4,
    left: anchorRect.left,
  });

  useLayoutEffect(() => {
    const el = popoverRef.current;
    if (!el) return;
    const margin = 8;
    const rect = el.getBoundingClientRect();
    const viewportW = window.innerWidth;
    const viewportH = window.innerHeight;

    let left = anchorRect.left;
    if (left + rect.width > viewportW - margin) {
      left = Math.max(margin, viewportW - margin - rect.width);
    }
    if (left < margin) left = margin;

    let top = anchorRect.bottom + 4;
    if (top + rect.height > viewportH - margin) {
      const aboveTop = anchorRect.top - 4 - rect.height;
      top = aboveTop >= margin
        ? aboveTop
        : Math.max(margin, viewportH - margin - rect.height);
    }

    setPosition({ top, left });
  }, [anchorRect, results.length, selected, searchRaw]);

  const style: React.CSSProperties = {
    position: "fixed",
    top: position.top,
    left: position.left,
    zIndex: 200,
  };

  return (
    <div ref={popoverRef} className={styles.popover} style={style}>
      <input
        ref={inputRef}
        className={styles.searchInput}
        value={searchRaw}
        onChange={(e) => {
          setSearchRaw(e.target.value);
          setSelected(null);
        }}
        onKeyDown={handleKeyDown}
        placeholder="Malzeme ara…"
      />
      {results.length > 0 && !selected && (
        <ul className={styles.list}>
          {results.map((mat, i) => (
            <li key={mat.id}>
              <button
                type="button"
                className={`${styles.resultItem} ${i === highlighted ? styles.highlighted : ""}`}
                onClick={() => setSelected(mat)}
                onMouseEnter={() => setHighlighted(i)}
              >
                <span className={styles.matName}>{mat.name}</span>
                <span className={styles.matMeta}>
                  {categories.find((c) => c.id === mat.categoryId)?.title ?? mat.categoryId}
                  {mat.brand ? ` · ${mat.brand}` : ""}
                  {mat.modelCode ? ` · ${mat.modelCode}` : ""}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
      {selected && (
        <div className={styles.selectedRow}>
          <span className={styles.selectedName}>{selected.name}</span>
          <div className={styles.quantityRow}>
            <label className={styles.qtyLabel}>Adet</label>
            <input
              type="number"
              min="0.01"
              step="0.01"
              className={styles.qtyInput}
              value={quantity}
              onChange={(e) => setQuantity(parseFloat(e.target.value) || 1)}
            />
            <button
              type="button"
              className={styles.addBtn}
              onClick={handleAssign}
              disabled={loading}
            >
              Ekle
            </button>
            <button
              type="button"
              className={styles.cancelBtn}
              onClick={() => setSelected(null)}
            >
              Geri
            </button>
          </div>
        </div>
      )}
      {searchRaw && results.length === 0 && !selected && (
        <div className={styles.empty}>Sonuç bulunamadı</div>
      )}
    </div>
  );
}
