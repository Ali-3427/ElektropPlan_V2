import { useState, type ReactNode } from "react";
import type { WarningEntry, AssumptionEntry } from "../bridge/types";
import { Button } from "./Button";
import styles from "./ResultPanel.module.css";

interface ResultPanelProps {
  title: string;
  children: ReactNode;
  warnings?: WarningEntry[] | undefined;
  assumptions?: AssumptionEntry[] | undefined;
  engineVersion?: string | undefined;
  dataVersion?: string | undefined;
  onSave?: (() => void) | undefined;
}

export function ResultPanel({
  title,
  children,
  warnings,
  assumptions,
  engineVersion,
  dataVersion,
  onSave,
}: ResultPanelProps) {
  const [showWarnings, setShowWarnings] = useState(false);
  const [showAssumptions, setShowAssumptions] = useState(false);

  const hasWarnings = warnings && warnings.length > 0;
  const hasAssumptions = assumptions && assumptions.length > 0;

  return (
    <div className={styles.panel}>
      <div className={styles.header}>
        <h3 className={styles.title}>{title}</h3>
        {onSave && (
          <Button variant="primary" onClick={onSave}>
            Kaydet
          </Button>
        )}
      </div>

      <div className={styles.body}>{children}</div>

      {hasWarnings && (
        <div className={styles.section}>
          <button
            type="button"
            className={styles.toggle}
            onClick={() => setShowWarnings((v) => !v)}
          >
            <span className={styles.warn}>⚠ {warnings.length} Uyarı</span>
            <span className={styles.chevron}>{showWarnings ? "▲" : "▼"}</span>
          </button>
          {showWarnings && (
            <ul className={styles.list}>
              {warnings.map((w, i) => (
                <li key={i} className={styles.warnItem}>
                  <strong>[{w.code}]</strong> {w.detail ?? w.messageKey}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {hasAssumptions && (
        <div className={styles.section}>
          <button
            type="button"
            className={styles.toggle}
            onClick={() => setShowAssumptions((v) => !v)}
          >
            <span>ℹ {assumptions.length} Varsayım</span>
            <span className={styles.chevron}>{showAssumptions ? "▲" : "▼"}</span>
          </button>
          {showAssumptions && (
            <ul className={styles.list}>
              {assumptions.map((a, i) => (
                <li key={i} className={styles.assumptionItem}>
                  <strong>{a.field}:</strong> {String(a.usedValue)}{" "}
                  <em>({a.source})</em>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {(engineVersion ?? dataVersion) && (
        <div className={styles.footer}>
          {engineVersion && <span>Engine: {engineVersion}</span>}
          {dataVersion && <span>Data: {dataVersion}</span>}
        </div>
      )}
    </div>
  );
}
