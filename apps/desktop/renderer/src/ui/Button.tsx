import type { ReactNode } from "react";
import styles from "./Button.module.css";

interface ButtonProps {
  variant?: "primary" | "secondary" | "danger";
  disabled?: boolean;
  loading?: boolean;
  type?: "button" | "submit" | "reset";
  onClick?: () => void;
  children: ReactNode;
  className?: string;
}

export function Button({
  variant = "primary",
  disabled,
  loading,
  type = "button",
  onClick,
  children,
  className,
}: ButtonProps) {
  return (
    <button
      type={type}
      className={[styles.btn, styles[variant], className].filter(Boolean).join(" ")}
      disabled={Boolean(disabled || loading)}
      onClick={onClick}
    >
      {loading ? <span className={styles.spinner} /> : null}
      {children}
    </button>
  );
}
