import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { NavLink, Outlet, useLocation } from "react-router-dom";

import sidebarLogoLight from "../assets/sidebar-logo-light.png";
import sidebarLogoDark from "../assets/sidebar-logo-dark.png";
import sidebarLogoCream from "../assets/sidebar-logo-cream.png";
import { ProjectQuickPanel } from "../features/projects/ProjectQuickPanel";
import {
  THEMES,
  useTheme,
  type ThemeMode,
} from "../features/shared/theme/ThemeContext";
import { useAppVersion } from "../hooks/useAppVersion";
import styles from "./Layout.module.css";

const QUICK_PANEL_STORAGE_KEY = "elektroplan.quickPanel.collapsed";
const SIDEBAR_STORAGE_KEY = "elektroplan.sidebar.collapsed";

const NAV = [
  { to: "/motor", label: "Motor Akımı", shortLabel: "M" },
  { to: "/cable", label: "Kablo Kesiti", shortLabel: "K" },
  { to: "/voltage-drop", label: "Gerilim Düşümü", shortLabel: "GD" },
  { to: "/projects", label: "Projeler", shortLabel: "P" },
  { to: "/materials", label: "Malzemeler", shortLabel: "ML" },
  { to: "/settings", label: "Ayarlar", shortLabel: "A" },
];

const THEME_LABELS: Record<ThemeMode, string> = {
  light: "Aydınlık",
  dark: "Koyu",
  cream: "Krem",
};

const THEME_LOGOS: Record<ThemeMode, string> = {
  light: sidebarLogoLight,
  dark: sidebarLogoDark,
  cream: sidebarLogoCream,
};

export function Layout() {
  const appVersion = useAppVersion();
  const { theme, setTheme } = useTheme();
  const location = useLocation();
  const hideQuickPanel = location.pathname.startsWith("/projects");
  const themeButtonRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const [sidebarCollapsed, setSidebarCollapsed] = useState<boolean>(() => {
    if (typeof window === "undefined") {
      return false;
    }
    try {
      return window.localStorage.getItem(SIDEBAR_STORAGE_KEY) === "true";
    } catch {
      return false;
    }
  });
  const [quickPanelCollapsed, setQuickPanelCollapsed] = useState<boolean>(() => {
    if (typeof window === "undefined") {
      return false;
    }
    try {
      return window.localStorage.getItem(QUICK_PANEL_STORAGE_KEY) === "true";
    } catch {
      return false;
    }
  });

  useEffect(() => {
    try {
      window.localStorage.setItem(
        SIDEBAR_STORAGE_KEY,
        sidebarCollapsed ? "true" : "false",
      );
    } catch {
      // ignore storage failures
    }
  }, [sidebarCollapsed]);

  useEffect(() => {
    try {
      window.localStorage.setItem(
        QUICK_PANEL_STORAGE_KEY,
        quickPanelCollapsed ? "true" : "false",
      );
    } catch {
      // ignore storage failures
    }
  }, [quickPanelCollapsed]);

  const logoUrl = THEME_LOGOS[theme];

  const handleThemeKeyDown = (
    event: KeyboardEvent<HTMLButtonElement>,
    mode: ThemeMode,
  ) => {
    const currentIndex = THEMES.indexOf(mode);
    if (currentIndex === -1) {
      return;
    }

    let nextIndex = currentIndex;
    if (event.key === "ArrowRight" || event.key === "ArrowDown") {
      event.preventDefault();
      nextIndex = (currentIndex + 1) % THEMES.length;
    } else if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
      event.preventDefault();
      nextIndex = (currentIndex - 1 + THEMES.length) % THEMES.length;
    } else if (event.key === "Home") {
      event.preventDefault();
      nextIndex = 0;
    } else if (event.key === "End") {
      event.preventDefault();
      nextIndex = THEMES.length - 1;
    } else {
      return;
    }

    const nextTheme = THEMES[nextIndex];
    if (!nextTheme) {
      return;
    }

    setTheme(nextTheme);
    themeButtonRefs.current[nextIndex]?.focus();
  };

  return (
    <div
      className={styles.shell}
      data-sidebar-collapsed={sidebarCollapsed ? "true" : "false"}
      data-quick-panel-collapsed={quickPanelCollapsed ? "true" : "false"}
      data-quick-panel-hidden={hideQuickPanel ? "true" : "false"}
    >
      <aside className={styles.sidebar}>
        <div className={styles.brand}>
          <button
            type="button"
            className={styles.sidebarToggle}
            aria-label={sidebarCollapsed ? "Menuyu genislet" : "Menuyu daralt"}
            aria-expanded={!sidebarCollapsed}
            onClick={() => setSidebarCollapsed((current) => !current)}
          >
            <span className={styles.sidebarToggleIcon} aria-hidden="true">
              <span />
              <span />
              <span />
            </span>
          </button>
          <div className={styles.logoWrapper}>
            <img src={logoUrl} alt="ElektroPlan" className={styles.logoImage} />
          </div>
        </div>
        <nav className={styles.nav}>
          {NAV.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                isActive
                  ? `${styles.navItem} ${styles.navItemActive}`
                  : styles.navItem
              }
              aria-label={item.label}
              title={item.label}
            >
              <span className={styles.navIcon} aria-hidden="true">
                {item.shortLabel}
              </span>
              <span className={styles.navLabel}>{item.label}</span>
            </NavLink>
          ))}
        </nav>
        <div className={styles.sidebarFooter}>
          <div
            role="radiogroup"
            aria-label="Tema seç"
            className={styles.themeSegmented}
          >
            {THEMES.map((mode) => (
              <button
                key={mode}
                ref={(element) => {
                  const index = THEMES.indexOf(mode);
                  themeButtonRefs.current[index] = element;
                }}
                type="button"
                role="radio"
                aria-checked={theme === mode}
                aria-label={THEME_LABELS[mode]}
                tabIndex={sidebarCollapsed ? -1 : theme === mode ? 0 : -1}
                disabled={sidebarCollapsed}
                className={`${styles.themeSegment} ${theme === mode ? styles.themeSegmentActive : ""}`}
                onClick={() => setTheme(mode)}
                onKeyDown={(event) => handleThemeKeyDown(event, mode)}
              >
                {THEME_LABELS[mode]}
              </button>
            ))}
          </div>
          <div className={styles.footer}>Sürüm {appVersion.data ?? "…"}</div>
        </div>
      </aside>
      <main className={styles.main}>
        <Outlet />
      </main>
      {hideQuickPanel ? null : (
        <ProjectQuickPanel
          collapsed={quickPanelCollapsed}
          onToggle={() => setQuickPanelCollapsed((current) => !current)}
        />
      )}
    </div>
  );
}
