import styles from "./ErrorBanner.module.css";

interface ErrorBannerProps {
  title?: string;
  message: string;
}

export function ErrorBanner({ title, message }: ErrorBannerProps) {
  return (
    <div className={styles.banner} role="alert">
      {title && <strong className={styles.title}>{title}</strong>}
      <span className={styles.message}>{message}</span>
    </div>
  );
}
