# Theme Overhaul & Sidebar Logo Fix Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Refresh the visual identity of ElektroPlan-V2. Replace the generic blue/slate light and dark themes with a brand-accented palette (white + amber light, black + amber dark), add a new **Cream** light theme (cream + orange), fix the sidebar logo so the single rectangular "ElektroPlan" mark scales edge-to-edge without cropping, and land small UI polish passes (smoother transitions, better elevation, accent-aware focus rings) without breaking any existing layout or feature.

**Architecture:**

1. **Theme tokens stay where they are.** The entire renderer already consumes design tokens (`--color-bg`, `--color-surface`, `--color-text`, `--color-primary`, etc.) exclusively from `apps/desktop/renderer/src/styles/theme.css`. 21 CSS modules read these vars. We keep the **same token names and the same set of tokens** — we only change values, and we add two new tokens (`--color-accent`, `--color-accent-hover`, `--color-accent-soft`, `--color-focus-ring`). This guarantees no feature page breaks: every existing consumer keeps working because token names are unchanged.

2. **Three themes via `data-theme`:**
   - `:root` → default **Light (white + amber)** theme.
   - `:root[data-theme="dark"]` → **Dark (black + amber)** theme.
   - `:root[data-theme="cream"]` → **Cream (cream + orange)** theme — NEW.
   - Legacy `:root[data-theme="light"]` selector also applied (identical to default) so explicit attribute writes continue to work.

3. **Theme state lifted to a context.** Replace the ad-hoc `useState<ThemeMode>` in `Layout.tsx` with a tiny `ThemeProvider` (`features/shared/theme/ThemeContext.tsx`) that exposes `theme: "light" | "dark" | "cream"` plus `setTheme`. Backwards compatible with existing `localStorage` key `elektroplan.theme` — unknown values fall back to `"light"`. All theme-dependent UI (sidebar toggle, settings page theme selector, logo swap) reads from this context. Sidebar toggle becomes a **3-state segmented control** (Light / Dark / Cream), and the Settings page gains a matching theme picker.

4. **Logo system rebuilt around proper aspect-fit:** Three logo PNGs — one per theme — stored as `sidebar-logo-light.png`, `sidebar-logo-dark.png`, `sidebar-logo-cream.png` in `apps/desktop/renderer/src/assets/`. The existing `.ico` imports in `Layout.tsx` are replaced with PNG imports. Logo wrapper drops the `aspect-ratio: 3.05 / 1` + `object-fit: cover` (cropping) pair and instead uses a fixed wrapper height with `object-fit: contain` + `width: 100%` so the rectangular wordmark scales edge-to-edge without cropping, at any sidebar width. `max-width` on the logo wrapper is removed — the logo fills the sidebar content area padding-to-padding. A `@media (max-width: 1280px)` tweak keeps the logo height consistent.

5. **Token-level accent separation.** Today feature pages use `--color-primary` as the accent (blue). We keep `--color-primary` as the **functional action color** (amber in all three themes) but add `--color-accent-*` tokens that mirror it so future redesigns can diverge. Feature pages need no edits — amber becomes their accent automatically.

6. **Polish sub-tasks (scope-contained, non-breaking):**
   - Smooth cross-fade when switching themes (body `transition: background-color 0.25s, color 0.25s` is already there — we extend it to border-color so the UI doesn't snap).
   - Elevation/shadow refresh per theme (amber-tinted soft shadow in light modes, deep black-alpha in dark).
   - Segmented theme control in sidebar with active indicator instead of the current binary switch, matching the new 3-way state.
   - Focus ring uses a dedicated `--color-focus-ring` instead of `--color-primary-soft` so it stays readable on amber backgrounds.

7. **Safety net:** Add a Vitest-level token test that asserts every required token is defined in each of the three theme blocks so we can never ship a theme with a missing var (which would silently break a feature page). Add a React test that mounts `Layout` under `ThemeProvider`, cycles through all three themes, and asserts `document.documentElement.dataset.theme` and the logo `src` update accordingly.

**Tech Stack:** React 18 + Vite renderer, TypeScript strict, CSS Modules + CSS custom properties, Vitest + jsdom, Testing Library (if not present, install `@testing-library/react` + `@testing-library/jest-dom` in the renderer workspace), Electron IPC (unchanged).

---

## Pre-flight

### Task 0: Baseline verification

**Files:** (none)

**Step 1:** Verify clean build before touching anything.

Run: `pnpm -w install`
Run: `pnpm -w -r build`
Expected: all packages build, no TS errors.

**Step 2:** Verify renderer dev server boots.

Run: `pnpm --filter @elektroplan/desktop-renderer dev`
Expected: Vite serves without error; Ctrl-C to stop.

**Step 3:** Snapshot current visual state.

Open the app via `pnpm --filter @elektroplan/desktop dev` (or whatever launches Electron), take a screenshot of:
  - Motor page in light mode
  - Motor page in dark mode
  - Sidebar logo in both modes (note the current cropping issue)
Save screenshots to `docs/plans/assets/2026-04-24-baseline-*.png` for later visual diff reference.

**Step 4:** Confirm no uncommitted state.

Run: `git status`
Expected: clean.

No commit.

---

## Phase 1 — Token expansion (foundation, does not change visible UI yet)

### Task 1: Add accent + focus-ring tokens to every existing theme block

**Files:**
- Modify: `apps/desktop/renderer/src/styles/theme.css`

**Step 1: Open `apps/desktop/renderer/src/styles/theme.css`.**

**Step 2: Inside the `:root` block (light, default), add these new tokens before the closing `}`:**

```css
  --color-accent: #d97706;
  --color-accent-hover: #b45309;
  --color-accent-soft: #fef3c7;
  --color-focus-ring: rgba(217, 119, 6, 0.35);
```

**Step 3: Inside `:root[data-theme="dark"]`, add:**

```css
  --color-accent: #fbbf24;
  --color-accent-hover: #f59e0b;
  --color-accent-soft: rgba(251, 191, 36, 0.18);
  --color-focus-ring: rgba(251, 191, 36, 0.45);
```

**Step 4: Verify tokens parse.**

Run: `pnpm --filter @elektroplan/desktop-renderer build`
Expected: build succeeds. No file uses these tokens yet, so UI is unchanged.

**Step 5: Commit.**

```bash
git add apps/desktop/renderer/src/styles/theme.css
git commit -m "chore(theme): add accent and focus-ring tokens to light+dark"
```

---

### Task 2: Write a token-parity test

**Files:**
- Create: `apps/desktop/renderer/src/styles/__tests__/theme.test.ts`
- Modify: `apps/desktop/renderer/package.json` (add `@testing-library/react`, `@testing-library/jest-dom`, `jsdom` dev deps if missing)

**Step 1: Check current test setup.**

Run: `cat apps/desktop/renderer/package.json | grep -E "vitest|testing-library"`
If `vitest` exists and `@testing-library/react` is missing, install:
Run: `pnpm --filter @elektroplan/desktop-renderer add -D @testing-library/react @testing-library/jest-dom jsdom`
If `vitest` itself is missing, add: `pnpm --filter @elektroplan/desktop-renderer add -D vitest jsdom`

**Step 2: Confirm `vitest.config.ts` or equivalent test setup exists.**

Run: `ls apps/desktop/renderer/vitest.config.* apps/desktop/renderer/vite.config.ts 2>/dev/null`
If there is no vitest config, add a `test` section to `vite.config.ts`:

```ts
// inside defineConfig({...})
test: {
  environment: "jsdom",
  globals: true,
},
```

**Step 3: Write failing test at `apps/desktop/renderer/src/styles/__tests__/theme.test.ts`:**

```ts
import { describe, it, expect, beforeAll } from "vitest";
import fs from "node:fs";
import path from "node:path";

const THEMES = ["__default__", "dark", "cream"] as const;

const REQUIRED_TOKENS = [
  "--color-bg",
  "--color-surface",
  "--color-surface-alt",
  "--color-border",
  "--color-border-strong",
  "--color-text",
  "--color-text-muted",
  "--color-text-subtle",
  "--color-primary",
  "--color-primary-hover",
  "--color-primary-soft",
  "--color-danger",
  "--color-danger-soft",
  "--color-success",
  "--color-success-soft",
  "--color-warning",
  "--color-warning-soft",
  "--color-overlay",
  "--color-brand-wash",
  "--color-accent",
  "--color-accent-hover",
  "--color-accent-soft",
  "--color-focus-ring",
];

let css = "";
beforeAll(() => {
  css = fs.readFileSync(
    path.resolve(__dirname, "../theme.css"),
    "utf8",
  );
});

function blockFor(theme: (typeof THEMES)[number]): string {
  const selector =
    theme === "__default__" ? /:root\s*\{([^}]+)\}/ : new RegExp(`:root\\[data-theme="${theme}"\\]\\s*\\{([^}]+)\\}`);
  const m = css.match(selector);
  if (!m) throw new Error(`theme block ${theme} not found`);
  return m[1];
}

describe("theme tokens", () => {
  it.each(THEMES)("theme %s defines every required token", (theme) => {
    const block = blockFor(theme);
    for (const token of REQUIRED_TOKENS) {
      expect(block, `theme=${theme} missing ${token}`).toMatch(
        new RegExp(`${token}\\s*:`),
      );
    }
  });
});
```

**Step 4: Run test — expect failure for `cream` block (does not exist yet).**

Run: `pnpm --filter @elektroplan/desktop-renderer exec vitest run src/styles/__tests__/theme.test.ts`
Expected: test fails for `theme=cream` with "theme block cream not found".

**Step 5: Commit the failing test.**

```bash
git add apps/desktop/renderer/src/styles/__tests__/theme.test.ts apps/desktop/renderer/package.json apps/desktop/renderer/vite.config.ts apps/desktop/renderer/pnpm-lock.yaml
git commit -m "test(theme): assert token parity across themes (cream pending)"
```

---

## Phase 2 — Palette rewrite (visible change)

### Task 3: Replace the light theme with white + amber

**Files:**
- Modify: `apps/desktop/renderer/src/styles/theme.css`

**Step 1: Replace the entire `:root` block with:**

```css
:root,
:root[data-theme="light"] {
  color-scheme: light;

  /* Surfaces — true white with a whisper of warm grey */
  --color-bg: #fafaf9;
  --color-surface: #ffffff;
  --color-surface-alt: #f6f5f2;
  --color-border: #ece9e2;
  --color-border-strong: #d6d1c4;

  /* Text — near-black, still readable on warm whites */
  --color-text: #1a1410;
  --color-text-muted: #5a4f45;
  --color-text-subtle: #8a7f72;

  /* Primary / accent — amber wordmark */
  --color-primary: #d97706;
  --color-primary-hover: #b45309;
  --color-primary-soft: #fef3c7;
  --color-accent: #d97706;
  --color-accent-hover: #b45309;
  --color-accent-soft: #fef3c7;

  /* Status */
  --color-danger: #dc2626;
  --color-danger-soft: #fee2e2;
  --color-success: #16a34a;
  --color-success-soft: #dcfce7;
  --color-warning: #d97706;
  --color-warning-soft: #fef3c7;

  /* Overlay / wash */
  --color-overlay: rgba(26, 20, 16, 0.38);
  --color-brand-wash: rgba(217, 119, 6, 0.06);
  --color-focus-ring: rgba(217, 119, 6, 0.35);

  /* Radii */
  --radius-sm: 6px;
  --radius-md: 10px;
  --radius-lg: 14px;

  /* Shadows — amber-tinted so cards don't look cold */
  --shadow-sm: 0 1px 2px rgba(120, 83, 44, 0.08);
  --shadow-md: 0 6px 14px rgba(120, 83, 44, 0.10);
  --shadow-lg: 0 14px 30px rgba(120, 83, 44, 0.14);

  --font-sans: "Segoe UI", "Inter", system-ui, -apple-system, sans-serif;
  --font-mono: "JetBrains Mono", Consolas, monospace;

  --space-1: 4px;
  --space-2: 8px;
  --space-3: 12px;
  --space-4: 16px;
  --space-5: 20px;
  --space-6: 24px;
  --space-8: 32px;
}
```

**Step 2: Save, build.**

Run: `pnpm --filter @elektroplan/desktop-renderer build`
Expected: success.

**Step 3: Manual check.**

Run: `pnpm --filter @elektroplan/desktop-renderer dev`
Open the app. Confirm:
  - No white-on-white / black-on-black regressions anywhere.
  - Primary buttons are amber, not blue.
  - Hover states visible.

**Step 4: Re-run token test — still passes (light + dark OK, cream still fails).**

Run: `pnpm --filter @elektroplan/desktop-renderer exec vitest run src/styles/__tests__/theme.test.ts`
Expected: light + dark pass; cream still missing (expected at this point).

**Step 5: Commit.**

```bash
git add apps/desktop/renderer/src/styles/theme.css
git commit -m "feat(theme): rewrite light theme to white + amber"
```

---

### Task 4: Replace the dark theme with black + amber

**Files:**
- Modify: `apps/desktop/renderer/src/styles/theme.css`

**Step 1: Replace the entire `:root[data-theme="dark"]` block with:**

```css
:root[data-theme="dark"] {
  color-scheme: dark;

  /* Near-black surfaces — not pure #000 to avoid OLED smear on borders */
  --color-bg: #0a0806;
  --color-surface: #141210;
  --color-surface-alt: #1c1815;
  --color-border: #2b2620;
  --color-border-strong: #3f3830;

  /* Text — warm-white to match amber accent */
  --color-text: #f5ebdc;
  --color-text-muted: #c9bba2;
  --color-text-subtle: #8f8472;

  /* Primary / accent — brighter amber for dark background contrast */
  --color-primary: #fbbf24;
  --color-primary-hover: #fcd34d;
  --color-primary-soft: rgba(251, 191, 36, 0.16);
  --color-accent: #fbbf24;
  --color-accent-hover: #fcd34d;
  --color-accent-soft: rgba(251, 191, 36, 0.16);

  /* Status */
  --color-danger: #f87171;
  --color-danger-soft: rgba(248, 113, 113, 0.18);
  --color-success: #4ade80;
  --color-success-soft: rgba(74, 222, 128, 0.18);
  --color-warning: #fbbf24;
  --color-warning-soft: rgba(251, 191, 36, 0.18);

  /* Overlay / wash */
  --color-overlay: rgba(0, 0, 0, 0.75);
  --color-brand-wash: rgba(251, 191, 36, 0.08);
  --color-focus-ring: rgba(251, 191, 36, 0.45);

  /* Shadows — deep black alpha so cards lift off the near-black bg */
  --shadow-sm: 0 1px 2px rgba(0, 0, 0, 0.5);
  --shadow-md: 0 10px 30px rgba(0, 0, 0, 0.48);
  --shadow-lg: 0 16px 36px rgba(0, 0, 0, 0.62);
}
```

**Step 2: Build + visually inspect dark mode.**

Run: `pnpm --filter @elektroplan/desktop-renderer dev`
Toggle to dark mode via sidebar. Confirm:
  - Background is near-black; sidebar slightly lifted.
  - Primary buttons are bright amber, text inside them is dark (check Button.module.css).
  - No blue leaks remain.

**Step 3: If primary-button text looks wrong on amber (likely — button text probably hardcoded white), note to revisit in Task 12 (UI polish). Do NOT fix here.**

**Step 4: Commit.**

```bash
git add apps/desktop/renderer/src/styles/theme.css
git commit -m "feat(theme): rewrite dark theme to black + amber"
```

---

### Task 5: Add the new Cream theme

**Files:**
- Modify: `apps/desktop/renderer/src/styles/theme.css`

**Step 1: Append after the dark block:**

```css
:root[data-theme="cream"] {
  color-scheme: light;

  /* Cream surfaces — warm ivory ladder */
  --color-bg: #f5eedc;
  --color-surface: #fbf5e5;
  --color-surface-alt: #efe6cf;
  --color-border: #e2d5b3;
  --color-border-strong: #c9b68a;

  /* Text — deep espresso for legibility on cream */
  --color-text: #2a1d0f;
  --color-text-muted: #5c4632;
  --color-text-subtle: #8a7356;

  /* Primary / accent — vibrant orange */
  --color-primary: #ea580c;
  --color-primary-hover: #c2410c;
  --color-primary-soft: #fed7aa;
  --color-accent: #ea580c;
  --color-accent-hover: #c2410c;
  --color-accent-soft: #fed7aa;

  /* Status — tuned to read on cream */
  --color-danger: #b91c1c;
  --color-danger-soft: #fecaca;
  --color-success: #15803d;
  --color-success-soft: #bbf7d0;
  --color-warning: #ea580c;
  --color-warning-soft: #fed7aa;

  /* Overlay / wash */
  --color-overlay: rgba(42, 29, 15, 0.38);
  --color-brand-wash: rgba(234, 88, 12, 0.07);
  --color-focus-ring: rgba(234, 88, 12, 0.35);

  /* Shadows — orange-tinted warm */
  --shadow-sm: 0 1px 2px rgba(120, 53, 15, 0.10);
  --shadow-md: 0 6px 14px rgba(120, 53, 15, 0.12);
  --shadow-lg: 0 14px 30px rgba(120, 53, 15, 0.16);
}
```

**Step 2: Run token test — should now pass.**

Run: `pnpm --filter @elektroplan/desktop-renderer exec vitest run src/styles/__tests__/theme.test.ts`
Expected: all three themes pass.

**Step 3: Quick DOM smoke test of cream.**

In DevTools console on the dev server, run: `document.documentElement.dataset.theme = "cream"`
Confirm:
  - Background is cream ivory, not white.
  - Borders visible, text readable.
  - Primary is orange.

**Step 4: Reset to previous theme.**

Run in console: `document.documentElement.dataset.theme = "light"` (the sidebar toggle will reset properly in later tasks).

**Step 5: Commit.**

```bash
git add apps/desktop/renderer/src/styles/theme.css
git commit -m "feat(theme): add cream theme (cream + orange)"
```

---

## Phase 3 — State: extend theme mode to 3-way

### Task 6: Extract ThemeContext

**Files:**
- Create: `apps/desktop/renderer/src/features/shared/theme/ThemeContext.tsx`
- Create: `apps/desktop/renderer/src/features/shared/theme/__tests__/ThemeContext.test.tsx`

**Step 1: Write the failing test first** (`ThemeContext.test.tsx`):

```tsx
import { describe, it, expect, beforeEach } from "vitest";
import { render, act } from "@testing-library/react";
import { ThemeProvider, useTheme, THEMES } from "../ThemeContext";

function Probe() {
  const { theme, setTheme } = useTheme();
  return (
    <div>
      <span data-testid="current">{theme}</span>
      {THEMES.map((t) => (
        <button key={t} data-testid={`set-${t}`} onClick={() => setTheme(t)}>
          {t}
        </button>
      ))}
    </div>
  );
}

describe("ThemeContext", () => {
  beforeEach(() => {
    window.localStorage.clear();
    delete document.documentElement.dataset.theme;
  });

  it("falls back to light for unknown stored value", () => {
    window.localStorage.setItem("elektroplan.theme", "neon");
    const { getByTestId } = render(
      <ThemeProvider>
        <Probe />
      </ThemeProvider>,
    );
    expect(getByTestId("current").textContent).toBe("light");
    expect(document.documentElement.dataset.theme).toBe("light");
  });

  it("cycles light → dark → cream and persists", () => {
    const { getByTestId } = render(
      <ThemeProvider>
        <Probe />
      </ThemeProvider>,
    );
    act(() => getByTestId("set-dark").click());
    expect(document.documentElement.dataset.theme).toBe("dark");
    expect(window.localStorage.getItem("elektroplan.theme")).toBe("dark");

    act(() => getByTestId("set-cream").click());
    expect(document.documentElement.dataset.theme).toBe("cream");
    expect(window.localStorage.getItem("elektroplan.theme")).toBe("cream");
  });
});
```

**Step 2: Run the test — expect failure (module doesn't exist).**

Run: `pnpm --filter @elektroplan/desktop-renderer exec vitest run src/features/shared/theme/__tests__/ThemeContext.test.tsx`
Expected: module not found.

**Step 3: Implement `ThemeContext.tsx`:**

```tsx
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

export const THEMES = ["light", "dark", "cream"] as const;
export type ThemeMode = (typeof THEMES)[number];

const STORAGE_KEY = "elektroplan.theme";

type ThemeContextValue = {
  theme: ThemeMode;
  setTheme: (next: ThemeMode) => void;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

function readStoredTheme(): ThemeMode {
  if (typeof window === "undefined") return "light";
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw && (THEMES as readonly string[]).includes(raw)) {
      return raw as ThemeMode;
    }
  } catch {
    // ignore
  }
  if (window.matchMedia?.("(prefers-color-scheme: dark)").matches) {
    return "dark";
  }
  return "light";
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<ThemeMode>(readStoredTheme);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    document.documentElement.style.colorScheme =
      theme === "dark" ? "dark" : "light";
    try {
      window.localStorage.setItem(STORAGE_KEY, theme);
    } catch {
      // ignore
    }
  }, [theme]);

  const setTheme = useCallback((next: ThemeMode) => {
    if (!(THEMES as readonly string[]).includes(next)) return;
    setThemeState(next);
  }, []);

  const value = useMemo(() => ({ theme, setTheme }), [theme, setTheme]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used inside <ThemeProvider>");
  return ctx;
}
```

**Step 4: Run test — expect pass.**

Run: `pnpm --filter @elektroplan/desktop-renderer exec vitest run src/features/shared/theme/__tests__/ThemeContext.test.tsx`
Expected: both tests pass.

**Step 5: Commit.**

```bash
git add apps/desktop/renderer/src/features/shared/theme/
git commit -m "feat(theme): ThemeProvider supporting light/dark/cream with localStorage"
```

---

### Task 7: Wire ThemeProvider at the app root

**Files:**
- Modify: `apps/desktop/renderer/src/app.tsx` (or `main.tsx` — confirm which mounts the router)

**Step 1: Locate where the app root wraps the Router.**

Run: `Grep -n "ReactDOM|createRoot|RouterProvider|Router>" apps/desktop/renderer/src/app.tsx apps/desktop/renderer/src/main.tsx`

**Step 2: Wrap the top-level tree with `<ThemeProvider>`.**

Example — if the current structure is `<QueryClientProvider>...<RouterProvider .../>...</QueryClientProvider>`, change to:

```tsx
<QueryClientProvider client={queryClient}>
  <ThemeProvider>
    <RouterProvider router={router} />
  </ThemeProvider>
</QueryClientProvider>
```

Import: `import { ThemeProvider } from "./features/shared/theme/ThemeContext";`

**Step 3: Build + run.**

Run: `pnpm --filter @elektroplan/desktop-renderer build`
Expected: success. Nothing visibly changes — Layout still uses its own state for now (replaced next task).

**Step 4: Commit.**

```bash
git add apps/desktop/renderer/src/app.tsx apps/desktop/renderer/src/main.tsx
git commit -m "feat(theme): mount ThemeProvider at app root"
```

---

### Task 8: Replace Layout's local theme state with ThemeContext + 3-way segmented control

**Files:**
- Modify: `apps/desktop/renderer/src/ui/Layout.tsx`
- Modify: `apps/desktop/renderer/src/ui/Layout.module.css`
- Create: `apps/desktop/renderer/src/ui/__tests__/Layout.test.tsx`

**Step 1: Write failing UI test first.**

`apps/desktop/renderer/src/ui/__tests__/Layout.test.tsx`:

```tsx
import { describe, it, expect, beforeEach } from "vitest";
import { render, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { ThemeProvider } from "../../features/shared/theme/ThemeContext";
import { Layout } from "../Layout";

function mount() {
  return render(
    <ThemeProvider>
      <MemoryRouter initialEntries={["/motor"]}>
        <Layout />
      </MemoryRouter>
    </ThemeProvider>,
  );
}

describe("Layout theme control", () => {
  beforeEach(() => {
    window.localStorage.clear();
    delete document.documentElement.dataset.theme;
  });

  it("renders a 3-way theme segmented control", () => {
    const { getByRole } = mount();
    expect(getByRole("radio", { name: /Aydınlık/i })).toBeTruthy();
    expect(getByRole("radio", { name: /Koyu/i })).toBeTruthy();
    expect(getByRole("radio", { name: /Krem/i })).toBeTruthy();
  });

  it("switches data-theme when selecting a mode", () => {
    const { getByRole } = mount();
    fireEvent.click(getByRole("radio", { name: /Krem/i }));
    expect(document.documentElement.dataset.theme).toBe("cream");
  });
});
```

**Step 2: Run test — expect failure (old toggle button, not a radiogroup).**

Run: `pnpm --filter @elektroplan/desktop-renderer exec vitest run src/ui/__tests__/Layout.test.tsx`
Expected: fail, "radio not found".

**Step 3: Rewrite Layout.tsx**

Replace the `const [theme, setTheme] = useState<ThemeMode>(...)` block and the existing theme button with:

```tsx
import { useTheme, THEMES, type ThemeMode } from "../features/shared/theme/ThemeContext";

// ...

const THEME_LABELS: Record<ThemeMode, string> = {
  light: "Aydınlık",
  dark: "Koyu",
  cream: "Krem",
};

// inside Layout()
const { theme, setTheme } = useTheme();
// remove the old getInitialTheme / useEffect(dataset.theme)

// replace the existing <button className={styles.themeToggle}> block with:
<div
  role="radiogroup"
  aria-label="Tema seç"
  className={styles.themeSegmented}
>
  {THEMES.map((mode) => (
    <button
      key={mode}
      type="button"
      role="radio"
      aria-checked={theme === mode}
      aria-label={THEME_LABELS[mode]}
      className={`${styles.themeSegment} ${theme === mode ? styles.themeSegmentActive : ""}`}
      onClick={() => setTheme(mode)}
    >
      {THEME_LABELS[mode]}
    </button>
  ))}
</div>
```

Remove the now-unused imports (`useState` if nothing else needs it, `getInitialTheme`, `THEME_STORAGE_KEY` const, `ThemeMode` local type), and remove the `useEffect` that wrote `dataset.theme` (now handled by `ThemeProvider`).

**Step 4: Replace the `.themeToggle` styles in `Layout.module.css` with segmented-control styles:**

```css
.themeSegmented {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 2px;
  padding: 3px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  background: var(--color-surface-alt);
}

.themeSegment {
  appearance: none;
  border: none;
  background: transparent;
  color: var(--color-text-muted);
  font-size: 12px;
  font-weight: 600;
  padding: var(--space-2) 0;
  border-radius: calc(var(--radius-lg) - 4px);
  cursor: pointer;
  transition: background 0.15s, color 0.15s;
}

.themeSegment:hover {
  color: var(--color-text);
}

.themeSegment:focus-visible {
  outline: none;
  box-shadow: 0 0 0 3px var(--color-focus-ring);
}

.themeSegmentActive {
  background: var(--color-surface);
  color: var(--color-accent);
  box-shadow: var(--shadow-sm);
}
```

Delete the old `.themeToggle`, `.themeLabelWrap`, `.themeLabel`, `.themeValue`, `.themeSwitch`, `.themeSwitchThumb`, and `.themeToggle[data-theme="dark"] ...` rules in the same file.

**Step 5: Run tests.**

Run: `pnpm --filter @elektroplan/desktop-renderer exec vitest run src/ui/__tests__/Layout.test.tsx`
Expected: both pass.

**Step 6: Visually verify.**

Run: `pnpm --filter @elektroplan/desktop-renderer dev`
Confirm the sidebar footer now shows a 3-way segmented control (Aydınlık / Koyu / Krem), active state has amber/orange text, and clicking each switches the theme end-to-end.

**Step 7: Commit.**

```bash
git add apps/desktop/renderer/src/ui/Layout.tsx apps/desktop/renderer/src/ui/Layout.module.css apps/desktop/renderer/src/ui/__tests__/Layout.test.tsx
git commit -m "feat(layout): 3-way theme segmented control using ThemeContext"
```

---

## Phase 4 — Logo system rebuild

### Task 9: Drop the new logo assets

**Files:**
- Create: `apps/desktop/renderer/src/assets/sidebar-logo-cream.png`
- Keep existing: `apps/desktop/renderer/src/assets/sidebar-logo-light.png`, `sidebar-logo-dark.png`

**Step 1: Verify existing PNG logos are the intended rectangular wordmark.**

Run: `ls -la apps/desktop/renderer/src/assets/sidebar-logo-*.png`
Expected: `sidebar-logo-light.png`, `sidebar-logo-dark.png` both exist (they do per the current repo state).

**Step 2: Prompt the user for a cream-theme logo.**

Pause the plan execution. Ask the user: "Please drop a transparent-PNG logo file suited to a cream background at `apps/desktop/renderer/src/assets/sidebar-logo-cream.png`. It should be the same rectangular wordmark, dark ink on transparent bg, ideally at ≥ 3× the intended render size (so ~600×200 px). Until then, the cream theme will reuse `sidebar-logo-light.png` as a placeholder."

If the user provides the file, copy it to that path and continue.
If the user says "use the light logo for now", create a temporary re-export shim — see Step 3 fallback.

**Step 3: Fallback if no cream-specific logo provided.**

Create `apps/desktop/renderer/src/assets/sidebar-logo-cream.png` as a literal copy of `sidebar-logo-light.png`:

Run (bash): `cp apps/desktop/renderer/src/assets/sidebar-logo-light.png apps/desktop/renderer/src/assets/sidebar-logo-cream.png`
Note in the commit message that this is a placeholder.

**Step 4: Commit.**

```bash
git add apps/desktop/renderer/src/assets/sidebar-logo-cream.png
git commit -m "chore(assets): add cream-theme sidebar logo (placeholder if reusing light)"
```

---

### Task 10: Swap sidebar logo source to PNGs + fix scaling

**Files:**
- Modify: `apps/desktop/renderer/src/ui/Layout.tsx`
- Modify: `apps/desktop/renderer/src/ui/Layout.module.css`

**Step 1: In `Layout.tsx`, replace the `.ico` imports with PNG imports:**

```tsx
import sidebarLogoLight from "../assets/sidebar-logo-light.png";
import sidebarLogoDark from "../assets/sidebar-logo-dark.png";
import sidebarLogoCream from "../assets/sidebar-logo-cream.png";

// replace the `const logoUrl = theme === "dark" ? darkLogoUrl : lightLogoUrl;`
const logoUrl =
  theme === "dark"
    ? sidebarLogoDark
    : theme === "cream"
      ? sidebarLogoCream
      : sidebarLogoLight;
```

Remove the now-unused `darkLogoUrl` and `lightLogoUrl` imports.

**Step 2: In `Layout.module.css`, replace `.brand`, `.logoWrapper`, `.logoImage` with:**

```css
.brand {
  padding: var(--space-1) var(--space-2) var(--space-5);
}

.logoWrapper {
  width: 100%;
  height: 56px;
  display: flex;
  align-items: center;
  justify-content: flex-start;
}

.logoImage {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: contain;
  object-position: left center;
  image-rendering: auto;
}

@media (max-width: 1280px) {
  .logoWrapper {
    height: 48px;
  }
}
```

Delete the old `--logo-width` custom property, the `aspect-ratio: 3.05 / 1`, and the `object-fit: cover` — those were causing the cropping / non-uniform scaling complaint.

Also delete the overriding `.brand { --logo-width: ... }` block inside the existing `@media (max-width: 1280px)` — it's no longer needed.

**Step 3: Run dev server, visually verify at multiple sidebar widths.**

Run: `pnpm --filter @elektroplan/desktop-renderer dev`
  - Resize the Electron window wide / narrow.
  - Confirm: logo scales edge-to-edge, wordmark never crops, stays vertically centered.
  - Switch all 3 themes; correct logo appears for each.

**Step 4: Run Layout tests — should still pass.**

Run: `pnpm --filter @elektroplan/desktop-renderer exec vitest run src/ui/__tests__/Layout.test.tsx`
Expected: pass.

**Step 5: Commit.**

```bash
git add apps/desktop/renderer/src/ui/Layout.tsx apps/desktop/renderer/src/ui/Layout.module.css
git commit -m "fix(logo): sidebar logo scales edge-to-edge with object-fit contain"
```

---

### Task 11: Logo swap + theme assertion test

**Files:**
- Modify: `apps/desktop/renderer/src/ui/__tests__/Layout.test.tsx`

**Step 1: Add a test asserting logo `src` changes per theme.**

Inside the existing describe block:

```tsx
it("updates logo src when theme changes", () => {
  const { getByRole, getByAltText } = mount();
  const initialSrc = (getByAltText("ElektroPlan") as HTMLImageElement).src;

  fireEvent.click(getByRole("radio", { name: /Koyu/i }));
  const darkSrc = (getByAltText("ElektroPlan") as HTMLImageElement).src;
  expect(darkSrc).not.toBe(initialSrc);

  fireEvent.click(getByRole("radio", { name: /Krem/i }));
  const creamSrc = (getByAltText("ElektroPlan") as HTMLImageElement).src;
  expect(creamSrc).not.toBe(darkSrc);
});
```

**Step 2: Run tests.**

Run: `pnpm --filter @elektroplan/desktop-renderer exec vitest run src/ui/__tests__/Layout.test.tsx`
Expected: all pass. (If the cream logo is a literal copy of the light logo, this test will detect the path difference because Vite hashes each import separately, producing distinct URLs.)

**Step 3: Commit.**

```bash
git add apps/desktop/renderer/src/ui/__tests__/Layout.test.tsx
git commit -m "test(layout): assert logo src flips per theme"
```

---

## Phase 5 — Settings page theme picker

### Task 12: Add theme selector to Settings page

**Files:**
- Modify: `apps/desktop/renderer/src/features/settings/SettingsPage.tsx`
- Modify: `apps/desktop/renderer/src/features/settings/SettingsPage.module.css`

**Step 1: Import theme context in SettingsPage.**

```tsx
import { useTheme, THEMES, type ThemeMode } from "../shared/theme/ThemeContext";

const THEME_LABELS: Record<ThemeMode, string> = {
  light: "Aydınlık (Beyaz + Amber)",
  dark: "Koyu (Siyah + Amber)",
  cream: "Krem (Krem + Turuncu)",
};
```

**Step 2: Inside the component, add `const { theme, setTheme } = useTheme();` near the other hooks.**

**Step 3: Add a new `<Card title="Görünüm">` block directly before the existing `<Card title="Uygulama Ayarları">`:**

```tsx
<Card title="Görünüm">
  <Field label="Tema">
    <div className={styles.themeGrid} role="radiogroup" aria-label="Tema">
      {THEMES.map((mode) => (
        <button
          key={mode}
          type="button"
          role="radio"
          aria-checked={theme === mode}
          className={`${styles.themeCard} ${theme === mode ? styles.themeCardActive : ""}`}
          data-theme-preview={mode}
          onClick={() => setTheme(mode)}
        >
          <span className={styles.themeSwatch} aria-hidden="true">
            <span className={styles.themeSwatchBg} />
            <span className={styles.themeSwatchAccent} />
          </span>
          <span className={styles.themeCardLabel}>{THEME_LABELS[mode]}</span>
        </button>
      ))}
    </div>
  </Field>
</Card>
```

**Step 4: Append the corresponding styles to `SettingsPage.module.css`:**

```css
.themeGrid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: var(--space-3);
}

.themeCard {
  appearance: none;
  text-align: left;
  display: flex;
  align-items: center;
  gap: var(--space-3);
  padding: var(--space-3) var(--space-4);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  background: var(--color-surface-alt);
  color: var(--color-text);
  cursor: pointer;
  transition: border-color 0.15s, background 0.15s, transform 0.15s;
}

.themeCard:hover { border-color: var(--color-border-strong); }
.themeCard:focus-visible {
  outline: none;
  box-shadow: 0 0 0 3px var(--color-focus-ring);
}

.themeCardActive {
  border-color: var(--color-accent);
  background: var(--color-accent-soft);
}

.themeCardLabel { font-weight: 600; font-size: 13px; }

.themeSwatch {
  position: relative;
  width: 40px;
  height: 26px;
  border-radius: var(--radius-md);
  overflow: hidden;
  border: 1px solid var(--color-border);
  flex-shrink: 0;
}

.themeSwatchBg,
.themeSwatchAccent {
  position: absolute;
  inset: 0;
}

.themeCard[data-theme-preview="light"] .themeSwatchBg { background: #ffffff; }
.themeCard[data-theme-preview="light"] .themeSwatchAccent {
  left: 50%;
  background: #d97706;
}

.themeCard[data-theme-preview="dark"] .themeSwatchBg { background: #141210; }
.themeCard[data-theme-preview="dark"] .themeSwatchAccent {
  left: 50%;
  background: #fbbf24;
}

.themeCard[data-theme-preview="cream"] .themeSwatchBg { background: #fbf5e5; }
.themeCard[data-theme-preview="cream"] .themeSwatchAccent {
  left: 50%;
  background: #ea580c;
}
```

**Step 5: Build + visual check.**

Run: `pnpm --filter @elektroplan/desktop-renderer build`
Expected: success.
Then `dev` and confirm the Settings page shows three theme cards with mini swatches and the active card is highlighted; clicking switches the whole app.

**Step 6: Commit.**

```bash
git add apps/desktop/renderer/src/features/settings/SettingsPage.tsx apps/desktop/renderer/src/features/settings/SettingsPage.module.css
git commit -m "feat(settings): theme picker with light/dark/cream swatches"
```

---

## Phase 6 — Polish

### Task 13: Accent-aware focus ring across UI primitives

**Files:**
- Modify: `apps/desktop/renderer/src/ui/Button.module.css`
- Modify: `apps/desktop/renderer/src/ui/Input.module.css`
- Modify: `apps/desktop/renderer/src/ui/Field.module.css` (if it owns focus styles)
- Modify: `apps/desktop/renderer/src/features/settings/SettingsPage.module.css`

**Step 1: Find existing focus-ring declarations.**

Run: `Grep -n "primary-soft|focus-visible|box-shadow: 0 0 0" apps/desktop/renderer/src/ui/ apps/desktop/renderer/src/features/`

**Step 2: Replace `var(--color-primary-soft)` inside any `:focus-visible` rule with `var(--color-focus-ring)`.** Leave non-focus usages of `--color-primary-soft` alone (nav item active state, etc.).

**Step 3: Build.**

Run: `pnpm --filter @elektroplan/desktop-renderer build`
Expected: success.

**Step 4: Tab through inputs/buttons in dev; confirm focus ring is an amber/orange halo appropriate to theme.**

**Step 5: Commit.**

```bash
git add -u apps/desktop/renderer/src/ui/ apps/desktop/renderer/src/features/
git commit -m "style(ui): focus rings use dedicated --color-focus-ring"
```

---

### Task 14: Primary button text contrast on amber

**Files:**
- Modify: `apps/desktop/renderer/src/ui/Button.module.css`

**Step 1: Open the file, look at the `.primary` rule.**

**Step 2: If the primary button's text color is hardcoded white, change it to a token that inverts correctly:**

Add/replace:

```css
.primary {
  background: var(--color-primary);
  color: #1a1410;  /* near-black, readable on amber in all three themes */
  border: 1px solid var(--color-primary);
}

.primary:hover {
  background: var(--color-primary-hover);
  border-color: var(--color-primary-hover);
  color: #1a1410;
}

.primary:focus-visible {
  outline: none;
  box-shadow: 0 0 0 3px var(--color-focus-ring);
}
```

**Step 3: Visually verify in all three themes.** Primary button text should stay dark & readable.

**Step 4: Commit.**

```bash
git add apps/desktop/renderer/src/ui/Button.module.css
git commit -m "style(button): primary uses dark text for amber contrast"
```

---

### Task 15: Smooth theme transition

**Files:**
- Modify: `apps/desktop/renderer/src/styles/global.css`

**Step 1: Extend the `body` transition rule to include borders and fill properties:**

```css
body {
  font-family: var(--font-sans);
  font-size: 14px;
  color: var(--color-text);
  background: var(--color-bg);
  -webkit-font-smoothing: antialiased;
  transition:
    background-color 0.25s ease,
    color 0.25s ease;
}

*,
*::before,
*::after {
  box-sizing: border-box;
  transition:
    background-color 0.2s ease,
    border-color 0.2s ease,
    color 0.2s ease,
    box-shadow 0.2s ease;
}
```

**Step 2: Toggle themes in the dev server.** Confirm the cross-fade feels smooth, nothing snaps, no animations appear on first paint (if they do, gate behind a class applied after first render — optional refinement).

**Step 3: Commit.**

```bash
git add apps/desktop/renderer/src/styles/global.css
git commit -m "style(theme): smooth cross-fade between themes"
```

---

### Task 16: Quick-panel brand-wash uses accent

**Files:**
- Modify: `apps/desktop/renderer/src/features/projects/ProjectQuickPanel.module.css` (only if still blue-tinted after Phase 2)

**Step 1: Check the `.panel` rule — it uses `--color-brand-wash` which we redefined per theme. Confirm it now reads correctly: in light it should be a warm amber wash, in dark a warm amber glow, in cream a soft orange.**

**Step 2: If a hardcoded green `rgba(31,94,64,...)` leaked into any other selector, replace with `var(--color-brand-wash)`.**

Run: `Grep -n "rgba\(31, 94, 64|rgba\(74, 222, 128" apps/desktop/renderer/src`
If matches found, replace each with `var(--color-brand-wash)`.

**Step 3: Commit if changes made.**

```bash
git add -u apps/desktop/renderer/src
git commit -m "style(panel): quick-panel wash uses themed brand-wash token"
```

If no matches found, skip the commit.

---

## Phase 7 — Verification

### Task 17: Full regression sweep

**Files:** (none)

**Step 1: Build everything.**

Run: `pnpm -w -r build`
Expected: all workspaces green.

**Step 2: Run all renderer tests.**

Run: `pnpm --filter @elektroplan/desktop-renderer exec vitest run`
Expected: all pass.

**Step 3: Launch full desktop app (Electron + renderer).**

Run: `pnpm --filter @elektroplan/desktop dev`

**Step 4: Manual checklist — walk every page in each of the 3 themes:**

  - [ ] Motor page — Formula mode + Table mode: inputs, results, buttons
  - [ ] Kablo page — Detailed mode + Ruler mode
  - [ ] Gerilim Düşümü page
  - [ ] Projeler page — tree, group cards, record details
  - [ ] Ayarlar page — theme picker, save flow
  - [ ] Quick panel collapsed + expanded
  - [ ] Save dialog (open a new-record flow to trigger it)
  - [ ] Error banner (trigger an error, e.g. disconnect storage)
  - [ ] Spinner (any loading state)

For each: no white-on-white, no black-on-black, no unreadable text, no blue leaks, hover/focus states visible, logo scaled correctly.

**Step 5: Screenshot all three themes on the Motor page and save to `docs/plans/assets/2026-04-24-after-*.png`.**

**Step 6: If any regression found, file it as a follow-up task in the plan, resolve before merging.**

**Step 7: Final commit — noop if everything passed, otherwise roll up the regression fixes.**

---

### Task 18: Update CLAUDE.md / decisions.md

**Files:**
- Modify: `decisions.md` (append a short entry)

**Step 1: Append:**

```markdown
## 2026-04-24 — Theme overhaul

- Brand palette landed: amber accent on white (light) and black (dark); new cream theme with orange accent.
- `ThemeContext` owns mode state and persistence; `data-theme` attribute drives `:root` blocks in `theme.css`.
- Sidebar logo now uses PNG + `object-fit: contain` with a fixed 56px height wrapper to scale edge-to-edge.
- Added `--color-accent-*` and `--color-focus-ring` tokens so accent can diverge from functional primary in future.
- Settings page gained a theme picker with mini-swatch previews.
```

**Step 2: Commit.**

```bash
git add decisions.md
git commit -m "docs: record theme overhaul decision"
```

---

## Done

**Definition of done:**
- All 18 tasks committed.
- `pnpm -w -r build` green.
- `pnpm --filter @elektroplan/desktop-renderer exec vitest run` green.
- Sidebar logo scales edge-to-edge, never cropped, at any sidebar width, in all 3 themes.
- 3-way segmented theme control in the sidebar + theme picker on Settings page.
- Light = white + amber. Dark = black + amber. Cream = cream + orange.
- No feature page regressed visually (manual checklist in Task 17).

---

## Execution Handoff

Plan complete and saved to `docs/plans/2026-04-24-theme-overhaul-and-logo-fix.md`. Two execution options:

1. **Subagent-Driven (this session)** — I dispatch a fresh subagent per task, review between tasks, fast iteration.

2. **Parallel Session (separate)** — Open a new session with executing-plans, batch execution with checkpoints.

Which approach?
