import type { ReactNode } from "react";
import styles from "./EmptyState.module.css";

interface EmptyStateProps {
  icon?: string;
  message: string;
  hint?: ReactNode;
}

export function EmptyState({ icon = "📭", message, hint }: EmptyStateProps) {
  return (
    <div className={styles.wrap}>
      <div className={styles.icon}>{icon}</div>
      <div className={styles.message}>{message}</div>
      {hint && <div className={styles.hint}>{hint}</div>}
    </div>
  );
}
