import { usePersistentPageState } from "../shared/usePersistentPageState";
import { FormulaMode } from "./FormulaMode";
import { TableMode } from "./TableMode";
import styles from "./MotorPage.module.css";

type MotorMode = "formula" | "table";

function isMotorMode(value: unknown): value is MotorMode {
  return value === "formula" || value === "table";
}

export function MotorPage() {
  const [mode, setMode] = usePersistentPageState<MotorMode>({
    key: "elektroplan.page.motor.mode",
    version: 1,
    defaultValue: "formula",
    validate: isMotorMode,
  });

  return (
    <div className={styles.page}>
      <h1 className={styles.heading}>Motor Akımı Hesabı</h1>

      <div className={styles.tabs}>
        <button
          type="button"
          className={`${styles.tab} ${mode === "formula" ? styles.active : ""}`}
          onClick={() => setMode("formula")}
        >
          Formül Modu
        </button>
        <button
          type="button"
          className={`${styles.tab} ${mode === "table" ? styles.active : ""}`}
          onClick={() => setMode("table")}
        >
          Tablo Modu
        </button>
      </div>

      {mode === "formula" ? <FormulaMode /> : <TableMode />}
    </div>
  );
}
