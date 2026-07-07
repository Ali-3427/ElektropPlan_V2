import { usePersistentPageState } from "../shared/usePersistentPageState";
import { CableDetailedMode } from "./CableDetailedMode";
import { CableRulerMode } from "./CableRulerMode";
import styles from "./CablePage.module.css";

type CableMode = "ruler" | "detailed";

function isCableMode(value: unknown): value is CableMode {
  return value === "ruler" || value === "detailed";
}

export function CablePage() {
  const [mode, setMode] = usePersistentPageState<CableMode>({
    key: "elektroplan.page.cable.mode",
    version: 1,
    defaultValue: "ruler",
    validate: isCableMode,
  });

  return (
    <div className={styles.page}>
      <h1 className={styles.heading}>Kablo Kesiti Seçimi</h1>

      <div className={styles.tabs}>
        <button
          type="button"
          className={`${styles.tab} ${mode === "ruler" ? styles.active : ""}`}
          onClick={() => setMode("ruler")}
        >
          Cetvel Modu
        </button>
        <button
          type="button"
          className={`${styles.tab} ${mode === "detailed" ? styles.active : ""}`}
          onClick={() => setMode("detailed")}
        >
          Detaylı Hesap
        </button>
      </div>

      {mode === "ruler" ? <CableRulerMode /> : <CableDetailedMode />}
    </div>
  );
}
